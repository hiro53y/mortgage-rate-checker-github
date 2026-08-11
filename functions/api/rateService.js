import {
  BANK_RATE_SOURCES,
  createAdapterContext,
  fetchBankOffer,
  getJstMonthKey,
  getPreviousMonthKey,
} from "./rateAdapters.js";

const LATEST_PAYLOAD_KEY = "rates:latest";
const REFRESH_LOCK_KEY = "rates:refresh-lock";
const LOCK_TTL_SECONDS = 600;
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 400;
const VERIFIED_LATEST_KEY_PREFIX = "rates:verified-latest:";
const VERIFIED_HISTORY_KEY_PREFIX = "rates:verified-history:";
const CACHE_STALE_REASONS = new Set([
  "month-mismatch",
  "invalid-fetched-at",
  "future-fetched-at",
]);

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function isCurrentMonthOffer(offer, month) {
  return offer?.applicableMonth === month;
}

function isStaleHistoryOffer(offer) {
  return (
    typeof offer?.failureReason === "string" && offer.failureReason.includes("履歴値")
  );
}

function isValidMonthKey(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isValidPastIsoInstant(value, date) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > date.getTime()) return false;
  return new Date(parsed).toISOString() === value;
}

function isVerifiedOffer(
  offer,
  { sourceId, expectedMonth, maxMonth, date = new Date() } = {},
) {
  return (
    offer?.confidence === "verified" &&
    ["official-api", "official-html"].includes(offer.sourceKind) &&
    Number.isFinite(offer.advertisedMinRate) &&
    offer.advertisedMinRate > 0 &&
    isValidMonthKey(offer.applicableMonth) &&
    isValidPastIsoInstant(offer.fetchedAt, date) &&
    (sourceId === undefined || offer.bankRateSourceId === sourceId) &&
    (expectedMonth === undefined || offer.applicableMonth === expectedMonth) &&
    (maxMonth === undefined || offer.applicableMonth <= maxMonth)
  );
}

function isVerifiedCurrentOffer(offer, month, date, sourceId = offer?.bankRateSourceId) {
  return isVerifiedOffer(offer, {
    sourceId,
    expectedMonth: month,
    date,
  });
}

function getCacheState(payload, date) {
  const month = getJstMonthKey(date);
  if (payload?.month !== month) return { cacheState: "stale", staleReason: "month-mismatch" };
  const fetchedAt = payload?.fetchedAt;
  const fetchedAtMs = Date.parse(fetchedAt ?? "");
  if (
    typeof fetchedAt !== "string" ||
    !Number.isFinite(fetchedAtMs) ||
    new Date(fetchedAtMs).toISOString() !== fetchedAt
  ) {
    return { cacheState: "stale", staleReason: "invalid-fetched-at" };
  }
  if (fetchedAtMs > date.getTime()) {
    return { cacheState: "stale", staleReason: "future-fetched-at" };
  }
  return { cacheState: "fresh" };
}

function asCachedPayload(payload, date) {
  if (!payload) return null;
  const { cacheState: _cacheState, staleReason: _staleReason, ...cachedPayload } = payload;
  return { ...cachedPayload, cached: true, ...getCacheState(payload, date) };
}

export function makeAllItemsStale(payload, reason) {
  const staleReason = CACHE_STALE_REASONS.has(reason)
    ? reason
    : CACHE_STALE_REASONS.has(payload?.staleReason)
      ? payload.staleReason
      : undefined;
  const { cacheState: _cacheState, staleReason: _staleReason, ...cachedPayload } = payload;
  return {
    ...cachedPayload,
    schemaVersion: 12,
    cached: true,
    cacheState: "stale",
    ...(staleReason ? { staleReason } : {}),
    items: (payload.items ?? []).map((item) => ({
      ...item,
      status: "stale",
      message: `当月のライブ取得に成功した値がないため、保存済みの参考値を表示しています。 ${item.message ?? ""}`.trim(),
    })),
  };
}

function validateOffer(source, offer, previousOffer, month) {
  if (isStaleHistoryOffer(offer)) {
    return offer;
  }
  const rate = offer.advertisedMinRate;
  const [min, max] = source.expectedVariableRateRange;
  if (!Number.isFinite(rate) || rate < min || rate > max) {
    return { ...offer, confidence: "review", failureReason: "商品別の想定範囲外です。" };
  }
  if (!isCurrentMonthOffer(offer, month)) {
    return {
      ...offer,
      confidence: "review",
      failureReason: `適用年月が当月ではありません（${offer.applicableMonth}）。`,
    };
  }
  if (
    previousOffer?.advertisedMinRate !== undefined &&
    previousOffer.applicableMonth !== offer.applicableMonth &&
    Math.abs(previousOffer.advertisedMinRate - rate) > source.maxMonthlyDelta
  ) {
    return {
      ...offer,
      confidence: "review",
      failureReason: `前月差が${source.maxMonthlyDelta.toFixed(3)}ポイントを超えたため要確認です。`,
    };
  }
  return offer;
}

function makeItem(source, fetchedAt, offer, lastGoodOffer, error) {
  if (!offer) {
    return {
      bankRateSourceId: source.id,
      bankName: source.bankName,
      rate: null,
      status: "failed",
      fetchedAt,
      sourceUrl: source.apiUrl ?? source.referenceUrl ?? source.rateUrl,
      attemptedUrls: source.rateUrls,
      message: `取得失敗: ${messageOf(error)} 公式ページを開いて手入力補正してください。`,
      offer: null,
      lastGoodOffer: lastGoodOffer ?? null,
    };
  }
  const rate = offer.conditionMatchedRate ?? offer.advertisedMinRate ?? null;
  const isStale =
    typeof offer.failureReason === "string" && offer.failureReason.includes("履歴値");
  const status = isStale
    ? "stale"
    : ["verified", "corroborated"].includes(offer.confidence)
      ? "success"
      : "needs-review";
  const attemptedUrls = [
    ...(source.rateUrls ?? []),
    source.apiUrl,
    source.backupApiUrl,
    source.referenceUrl,
    ...(offer.evidence ?? []).map((evidence) => evidence.sourceUrl),
  ].filter((url, index, values) => url && values.indexOf(url) === index);
  return {
    bankRateSourceId: source.id,
    bankName: source.bankName,
    rate,
    status,
    fetchedAt,
    sourceUrl: offer.sourceUrl,
    attemptedUrls,
    message:
      status === "success"
        ? offer.confidence === "verified"
          ? "公式構造化データから当月金利を取得しました。利用者条件の適合判定後に推薦可否を決めます。"
          : "当月金利を複数情報源で照合しました。団信・審査・優遇条件は確認が必要です。"
        : status === "stale"
          ? offer.failureReason ?? "履歴値を参考表示しています。公式確認と手入力補正を行ってください。"
          : offer.failureReason ?? "参考値または要確認値のため自動推薦対象外です。",
    offer,
    lastGoodOffer: lastGoodOffer ?? null,
  };
}

async function getJson(kv, key) {
  if (!kv) return null;
  return kv.get(key, "json");
}

async function writeVerifiedOfferHistory(kv, source, offer, month, date) {
  if (!kv || !isVerifiedCurrentOffer(offer, month, date, source.id)) return;
  const serialized = JSON.stringify(offer);
  await Promise.all([
    kv.put(`${VERIFIED_LATEST_KEY_PREFIX}${source.id}`, serialized),
    kv.put(`${VERIFIED_HISTORY_KEY_PREFIX}${month}:${source.id}`, serialized, {
      expirationTtl: HISTORY_TTL_SECONDS,
    }),
  ]);
}

async function getVerifiedOffer(
  kv,
  key,
  legacyKey,
  { sourceId, expectedMonth, maxMonth, date, expirationTtl } = {},
) {
  const verified = await getJson(kv, key);
  const validation = { sourceId, expectedMonth, maxMonth, date };
  if (isVerifiedOffer(verified, validation)) return verified;
  const legacy = await getJson(kv, legacyKey);
  if (!isVerifiedOffer(legacy, validation)) return null;
  if (kv) {
    await kv.put(
      key,
      JSON.stringify(legacy),
      expirationTtl === undefined ? undefined : { expirationTtl },
    );
  }
  return legacy;
}

async function getLatestVerifiedOffer(kv, sourceId, date, maxMonth = getJstMonthKey(date)) {
  return getVerifiedOffer(
    kv,
    `${VERIFIED_LATEST_KEY_PREFIX}${sourceId}`,
    `rates:latest:${sourceId}`,
    { sourceId, maxMonth, date },
  );
}

async function getPreviousVerifiedOffer(kv, month, sourceId, date) {
  const history = await getVerifiedOffer(
    kv,
    `${VERIFIED_HISTORY_KEY_PREFIX}${month}:${sourceId}`,
    `rates:history:${month}:${sourceId}`,
    {
      sourceId,
      expectedMonth: month,
      maxMonth: month,
      date,
      expirationTtl: HISTORY_TTL_SECONDS,
    },
  );
  return history ?? getLatestVerifiedOffer(kv, sourceId, date, month);
}

export async function getCachedRates(env, { date = new Date() } = {}) {
  const cached = await getJson(env?.RATE_CACHE, LATEST_PAYLOAD_KEY);
  return asCachedPayload(cached, date);
}

export async function refreshAllRates(
  env,
  {
    date = new Date(),
    fetchImpl = fetch,
    executionId,
    bypassLock = false,
  } = {},
) {
  const kv = env?.RATE_CACHE;
  const month = getJstMonthKey(date);
  const fetchedAt = date.toISOString();
  const lockId = executionId ?? crypto.randomUUID();
  const cachedBeforeRefresh = await getCachedRates(env, { date });

  if (kv && !bypassLock) {
    const existingLock = await kv.get(REFRESH_LOCK_KEY);
    if (existingLock) {
      const cached = await getCachedRates(env, { date });
      if (cached?.cacheState === "stale") {
        return {
          ...makeAllItemsStale(cached),
          locked: true,
          message: "直近10分以内に再取得を開始済みです。保存済みの参考値を表示します。",
        };
      }
      return {
        ...(cached ?? { month, fetchedAt, items: [] }),
        cached: Boolean(cached),
        locked: true,
        message: "直近10分以内に再取得を開始済みです。現在のキャッシュを表示します。",
      };
    }
    await kv.put(REFRESH_LOCK_KEY, lockId, { expirationTtl: LOCK_TTL_SECONDS });
  }

  const previousMonth = getPreviousMonthKey(date);
  const historyOfferLookup = kv
    ? async (sourceId) => {
        return getPreviousVerifiedOffer(kv, previousMonth, sourceId, date);
      }
    : null;
  const adapterContext = createAdapterContext(fetchImpl, {
    browserBinding: env?.BROWSER,
    historyOfferLookup,
  });
  const previousOffers = await Promise.all(
    BANK_RATE_SOURCES.map((source) => getLatestVerifiedOffer(kv, source.id, date, month)),
  );
  const settled = await Promise.allSettled(
    BANK_RATE_SOURCES.map((source) => fetchBankOffer(source, fetchedAt, date, adapterContext)),
  );

  const items = settled.map((result, index) => {
    const source = BANK_RATE_SOURCES[index];
    const previousOffer = previousOffers[index];
    if (result.status === "rejected") {
      return makeItem(source, fetchedAt, null, previousOffer, result.reason);
    }
    const offer = validateOffer(source, result.value, previousOffer, month);
    return makeItem(source, fetchedAt, offer, previousOffer, null);
  });

  if (kv) {
    await Promise.all(
      items.map((item, index) =>
        isVerifiedCurrentOffer(item.offer, month, date, BANK_RATE_SOURCES[index].id)
          ? writeVerifiedOfferHistory(kv, BANK_RATE_SOURCES[index], item.offer, month, date)
          : undefined,
      ),
    );
  }

  const hasCurrentLiveOffer = items.some(
    (item) => item.offer?.applicableMonth === month && item.status !== "stale",
  );
  if (!hasCurrentLiveOffer && cachedBeforeRefresh) {
    return makeAllItemsStale(cachedBeforeRefresh);
  }

  const officialCurrentCount = items.filter(
    (item) =>
      item.offer?.confidence === "verified" &&
      item.offer?.sourceKind !== "aggregator" &&
      item.offer?.applicableMonth === month,
  ).length;
  const corroboratedCount = items.filter(
    (item) =>
      item.offer?.confidence === "corroborated" &&
      item.offer?.applicableMonth === month,
  ).length;
  const staleCount = items.filter((item) => item.status === "stale").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const message = `${items.length}銀行を確認し、公式構造化データ${officialCurrentCount}銀行、複数情報源の照合値${corroboratedCount}銀行を取得しました。前月履歴値の参考表示は${staleCount}銀行、取得失敗は${failedCount}銀行です。`;
  if (!hasCurrentLiveOffer) {
    return {
      schemaVersion: 12,
      month,
      fetchedAt,
      items,
      cached: false,
      cacheState: "stale",
      locked: false,
      message,
    };
  }
  const payload = {
    schemaVersion: 12,
    month,
    fetchedAt,
    items,
    cached: false,
    cacheState: "fresh",
    locked: false,
    message,
  };
  if (kv) {
    await kv.put(LATEST_PAYLOAD_KEY, JSON.stringify(payload));
  }
  return payload;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export { LATEST_PAYLOAD_KEY, LOCK_TTL_SECONDS, REFRESH_LOCK_KEY };
