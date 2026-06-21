import {
  BANK_RATE_SOURCES,
  createAdapterContext,
  fetchBankOffer,
  getJstMonthKey,
} from "./rateAdapters.js";

const LATEST_PAYLOAD_KEY = "rates:latest";
const REFRESH_LOCK_KEY = "rates:refresh-lock";
const LOCK_TTL_SECONDS = 600;
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 400;

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function isCurrentMonthOffer(offer, month) {
  return offer?.applicableMonth === month;
}

function validateOffer(source, offer, previousOffer, month) {
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
      message: `取得失敗: ${messageOf(error)}`,
      offer: null,
      lastGoodOffer: lastGoodOffer ?? null,
    };
  }
  const rate = offer.conditionMatchedRate ?? offer.advertisedMinRate ?? null;
  const status =
    offer.confidence === "verified" && offer.sourceKind !== "aggregator"
      ? "success"
      : "needs-review";
  return {
    bankRateSourceId: source.id,
    bankName: source.bankName,
    rate,
    status,
    fetchedAt,
    sourceUrl: offer.sourceUrl,
    attemptedUrls: source.rateUrls,
    message:
      status === "success"
        ? "公式構造化データから当月金利を取得しました。利用者条件の適合判定後に推薦可否を決めます。"
        : offer.failureReason ?? "参考値または要確認値のため自動推薦対象外です。",
    offer,
    lastGoodOffer: lastGoodOffer ?? null,
  };
}

async function getJson(kv, key) {
  if (!kv) return null;
  return kv.get(key, "json");
}

async function writeOfferHistory(kv, source, offer, month) {
  if (!kv || !offer) return;
  const serialized = JSON.stringify(offer);
  await Promise.all([
    kv.put(`rates:latest:${source.id}`, serialized),
    kv.put(`rates:history:${month}:${source.id}`, serialized, {
      expirationTtl: HISTORY_TTL_SECONDS,
    }),
  ]);
}

export async function getCachedRates(env) {
  const cached = await getJson(env?.RATE_CACHE, LATEST_PAYLOAD_KEY);
  return cached ? { ...cached, cached: true } : null;
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

  if (kv && !bypassLock) {
    const existingLock = await kv.get(REFRESH_LOCK_KEY);
    if (existingLock) {
      const cached = await getCachedRates(env);
      return {
        ...(cached ?? { month, fetchedAt, items: [] }),
        cached: Boolean(cached),
        locked: true,
        message: "直近10分以内に再取得を開始済みです。現在のキャッシュを表示します。",
      };
    }
    await kv.put(REFRESH_LOCK_KEY, lockId, { expirationTtl: LOCK_TTL_SECONDS });
  }

  const adapterContext = createAdapterContext(fetchImpl);
  const previousOffers = await Promise.all(
    BANK_RATE_SOURCES.map((source) => getJson(kv, `rates:latest:${source.id}`)),
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
        item.offer ? writeOfferHistory(kv, BANK_RATE_SOURCES[index], item.offer, month) : undefined,
      ),
    );
  }

  const officialCurrentCount = items.filter(
    (item) =>
      item.offer?.confidence === "verified" &&
      item.offer?.sourceKind !== "aggregator" &&
      item.offer?.applicableMonth === month,
  ).length;
  const payload = {
    schemaVersion: 7,
    month,
    fetchedAt,
    items,
    cached: false,
    locked: false,
    message: `${items.length}銀行を確認し、当月の公式構造化データを${officialCurrentCount}銀行で取得しました。参考値・要確認値は推薦に使用しません。`,
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
