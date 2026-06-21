import { BANK_RATE_SOURCES } from "../../shared/bankRateSources.js";

const FETCH_TIMEOUT_MS = 12000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const KAKAKU_URL =
  "https://s.kakaku.com/housing-loan/ranking.asp?hl_ltype=1&utm_source=mortgage-rate-checker";

const REQUEST_HEADERS = {
  accept: "text/html,application/json,text/javascript,*/*;q=0.8",
  "accept-language": "ja-JP,ja;q=0.9",
  "cache-control": "no-cache",
  "user-agent":
    "Mozilla/5.0 (compatible; MortgageRateChecker/7.0; +https://mortgage-rate-checker-github.pages.dev/)",
};

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    );
}

export function normalizeText(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFKC")
    .replace(/[−－]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getJstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: map.year, month: map.month, day: map.day };
}

export function getJstMonthKey(date = new Date()) {
  const parts = getJstParts(date);
  return `${parts.year}-${parts.month}`;
}

function asPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.abs(parsed) < 0.2 ? parsed * 100 : parsed;
}

function baseOffer(source, fetchedAt, applicableMonth, sourceUrl, sourceKind) {
  return {
    schemaVersion: 1,
    bankRateSourceId: source.id,
    bankName: source.bankName,
    productName: source.productName,
    loanPurpose: "refinance",
    rateType: "variable",
    advertisedMinRate: undefined,
    conditionMatchedRate: undefined,
    baseRate: undefined,
    discountRate: undefined,
    insuranceAddonRate: undefined,
    longTermAddonRate: undefined,
    applicableMonth,
    fetchedAt,
    sourceUrl,
    sourceKind,
    confidence: sourceKind === "official-api" ? "verified" : "review",
    eligibility: "unknown",
    conditionsSummary: "条件判定前",
    failureReason: undefined,
    adapterId: source.adapter,
    rateOptions: [],
  };
}

export function parseNetbkJsonp(text, source, fetchedAt, date = new Date()) {
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/^\s*[\w$]+\s*\(/, "")
    .replace(/\)\s*;?\s*$/, "")
    .replace(/,\s*([}\]])/g, "$1");
  const payload = JSON.parse(cleaned);
  const standard = asPercent(payload?.full?.floatRe?.[0] ?? payload?.full?.float?.[0]);
  const ltv80 = asPercent(payload?.full?.floatReCp?.[0] ?? payload?.full?.floatCp?.[0]);
  if (standard === undefined || ltv80 === undefined) {
    throw new Error("住信SBI公式JSONPに借換え変動金利がありません。");
  }
  const standardDiscount = asPercent(payload?.full?.floatRe?.[1]);
  const offer = baseOffer(source, fetchedAt, getJstMonthKey(date), source.apiUrl, "official-api");
  offer.advertisedMinRate = ltv80;
  offer.baseRate =
    standardDiscount === undefined ? undefined : Number((standard - standardDiscount).toFixed(3));
  offer.discountRate = standardDiscount === undefined ? undefined : Math.abs(standardDiscount);
  offer.longTermAddonRate = 0.15;
  offer.conditionsSummary =
    "融資率80%以下は優遇金利、80%超は標準金利。借入期間35年超は年0.15%上乗せ。団信上乗せは要確認。";
  offer.rateOptions = [
    { id: "ltv-80-or-less", label: "融資率80%以下", rate: ltv80, ltvMax: 0.8 },
    { id: "ltv-over-80", label: "融資率80%超", rate: standard, ltvMinExclusive: 0.8 },
  ];
  return offer;
}

export function parsePayPayRateJson(payload, source, fetchedAt, date = new Date()) {
  const rows = Array.isArray(payload) ? payload : payload?.items;
  const row = rows?.find(
    (item) => item?.target === "refinancing" && item?.name === "変動金利",
  );
  const rate = Number(row?.params?.kinri3 ?? row?.params?.kinri10);
  const baseRate = Number(row?.params?.kinri1 ?? row?.params?.kinri8);
  const discount = Number(row?.params?.kinri2 ?? row?.params?.kinri9);
  if (!Number.isFinite(rate)) {
    throw new Error("PayPay銀行公式APIに借換え変動金利がありません。");
  }
  const monthMatch = String(row?.honjitsuDate ?? "").match(/(20\d{2})年(\d{1,2})月/);
  const applicableMonth = monthMatch
    ? `${monthMatch[1]}-${String(monthMatch[2]).padStart(2, "0")}`
    : getJstMonthKey(date);
  const offer = baseOffer(source, fetchedAt, applicableMonth, source.apiUrl, "official-api");
  offer.advertisedMinRate = rate;
  offer.baseRate = Number.isFinite(baseRate) ? baseRate : undefined;
  offer.discountRate = Number.isFinite(discount) ? Math.abs(discount) : undefined;
  offer.conditionsSummary =
    "公式APIの借換え・変動金利。団信プラン、審査結果、物件条件による上乗せは公式確認が必要。";
  offer.rateOptions = [{ id: "refinance-variable", label: "借換え変動金利", rate }];
  return offer;
}

export function parseSbiShinseiJson(payload, source, fetchedAt) {
  const current = payload?.MASS?.INITIAL?.FLOATING?.normal?.body?.current;
  const standard = Number(current?.normal?.interestRate ?? current?.interestRate);
  const ownFunds = Number(current?.ownFunds10per?.interestRate);
  const sbiHyper = Number(current?.sbiHyper?.interestRate);
  const dateText = String(payload?.COMMON?.interestRateDateHL ?? "");
  if (!Number.isFinite(standard) || !/^20\d{2}-\d{2}/.test(dateText)) {
    throw new Error("SBI新生銀行公式APIに当月の変動金利がありません。");
  }
  const sourceUrl = source.apiUrl;
  const offer = baseOffer(source, fetchedAt, dateText.slice(0, 7), sourceUrl, "official-api");
  const available = [standard, ownFunds, sbiHyper].filter(Number.isFinite);
  offer.advertisedMinRate = Math.min(...available);
  offer.insuranceAddonRate = 0.1;
  offer.conditionsSummary =
    "通常金利、自己資金10%以上、SBIハイパー預金利用を区別。ガン団信は年0.1%上乗せ。";
  offer.rateOptions = [
    { id: "normal", label: "通常", rate: standard },
    ...(Number.isFinite(ownFunds)
      ? [{ id: "own-funds-10", label: "自己資金10%以上", rate: ownFunds, ownFundsMinRatio: 0.1 }]
      : []),
    ...(Number.isFinite(sbiHyper)
      ? [{ id: "sbi-hyper", label: "SBIハイパー預金利用", rate: sbiHyper, requiresSbiHyper: true }]
      : []),
  ];
  return offer;
}

export function decodeShiftJis(bytes) {
  return new TextDecoder("shift_jis").decode(bytes);
}

function findRatesNearAlias(text, aliases) {
  const normalized = normalizeText(text);
  const values = [];
  for (const alias of aliases) {
    let index = normalized.indexOf(alias);
    while (index >= 0 && values.length < 20) {
      const block = normalized.slice(Math.max(0, index - 80), index + 500);
      if (/借り換え|借換|変動金利/.test(block)) {
        for (const match of block.matchAll(/([0-9]+(?:\.[0-9]{1,3})?)\s*%/g)) {
          const rate = Number(match[1]);
          if (rate >= 0.2 && rate <= 3.5) values.push(rate);
        }
      }
      index = normalized.indexOf(alias, index + alias.length);
    }
  }
  return values;
}

export function parseKakakuShiftJis(bytes, source, fetchedAt, date = new Date()) {
  const text = decodeShiftJis(bytes);
  const rates = findRatesNearAlias(text, source.aggregateAliases ?? [source.bankName]);
  if (rates.length === 0) return null;
  const offer = baseOffer(source, fetchedAt, getJstMonthKey(date), KAKAKU_URL, "aggregator");
  offer.advertisedMinRate = Math.min(...rates);
  offer.confidence = "review";
  offer.conditionsSummary = "価格.com掲載値。公式の商品・借換え・団信条件との一致確認が必要。";
  offer.failureReason = "総合サイト参考値のため自動推薦対象外";
  offer.rateOptions = [
    { id: "kakaku-reference", label: "価格.com参考値", rate: offer.advertisedMinRate },
  ];
  return offer;
}

export function parseHiroginDiamondHtml(html, source, fetchedAt, date = new Date()) {
  const text = normalizeText(html);
  const rows = [];
  for (const match of text.matchAll(/(20\d{2})[\/-](0?[1-9]|1[0-2])\s+([0-9]+(?:\.[0-9]{1,3})?)\s*%/g)) {
    const context = text.slice(Math.max(0, match.index - 180), match.index + 160);
    if (!/広島銀行|変動金利|住宅ローン/.test(context)) continue;
    const rate = Number(match[3]);
    if (rate < 0.5 || rate > 2.0) continue;
    rows.push({ month: `${match[1]}-${String(match[2]).padStart(2, "0")}`, rate });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.month.localeCompare(a.month));
  const row = rows.find((item) => item.month === getJstMonthKey(date)) ?? rows[0];
  const offer = baseOffer(source, fetchedAt, row.month, source.referenceUrl, "aggregator");
  offer.advertisedMinRate = row.rate;
  offer.confidence = "review";
  offer.conditionsSummary = "ダイヤモンド不動産の最新月表。広島銀行公式ページで手動確認が必要。";
  offer.failureReason = "公式HTMLに金利表がないため自動推薦対象外";
  offer.rateOptions = [{ id: "diamond-reference", label: "総合サイト参考値", rate: row.rate }];
  return offer;
}

function scoreDiagnosticContext(context, source) {
  let score = 0;
  if (/変動金利|住宅ローン|借換|借り換え/.test(context)) score += 8;
  if (/適用金利|優遇金利|下限|最優遇/.test(context)) score += 5;
  for (const keyword of source.preferredKeywords ?? []) {
    if (context.includes(keyword)) score += 2;
  }
  if (/手数料|上乗せ|団信|口コミ|固定金利|預金|カードローン/.test(context)) score -= 12;
  return score;
}

export function getRateUrls(source) {
  return [...new Set([...(source.rateUrls ?? []), source.rateUrl].filter(Boolean))];
}

export function extractRate(html, source = {}) {
  const text = normalizeText(html);
  const candidates = [];
  for (const match of text.matchAll(/([0-9]+(?:\.[0-9]{1,3})?)\s*%/g)) {
    const rate = Number(match[1]);
    const [defaultMin, defaultMax] = source.expectedVariableRateRange ?? [0.2, 3.5];
    const min = source.minExpectedRate ?? defaultMin;
    const max = source.maxExpectedRate ?? defaultMax;
    if (rate < min || rate > max) continue;
    const localPrefix = text.slice(Math.max(0, match.index - 24), match.index);
    const immediatePrefix = text.slice(Math.max(0, match.index - 18), match.index);
    if (/上乗せ|事務手数料|保証料|口コミ|固定金利/.test(localPrefix)) continue;
    const context = text.slice(Math.max(0, match.index - 140), match.index + 180);
    let score = scoreDiagnosticContext(context, source);
    if (/表面金利|適用金利|優遇金利|下限金利/.test(immediatePrefix)) score += 12;
    if (/実質金利|手数料込|手数料込み/.test(immediatePrefix)) score -= 12;
    if (score >= 6) candidates.push({ rate, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.rate - b.rate);
  return candidates[0]?.rate ?? null;
}

export function extractRateFromAggregate(html, source = {}) {
  const text = normalizeText(html);
  const [defaultMin, defaultMax] = source.expectedVariableRateRange ?? [0.2, 3.5];
  const min = source.minExpectedRate ?? defaultMin;
  const max = source.maxExpectedRate ?? defaultMax;
  const monthlyRows = [...text.matchAll(/(20\d{2})[\/-](0[1-9]|1[0-2])\s+([0-9]+(?:\.[0-9]{1,3})?)\s*%/g)]
    .map((match) => ({ month: `${match[1]}-${match[2]}`, rate: Number(match[3]) }))
    .filter((row) => row.rate >= min && row.rate <= max)
    .sort((a, b) => b.month.localeCompare(a.month));
  if (monthlyRows.length > 0) return monthlyRows[0].rate;

  const aliases = source.aggregateAliases ?? [source.bankName];
  const blocks = html
    .split(/<\/(?:section|article|tr|li|div)>/gi)
    .filter((block) => aliases.some((alias) => normalizeText(block).includes(alias)));
  const rates = blocks
    .map((block) => extractRate(block, source))
    .filter((rate) => rate !== null);
  return rates.length > 0 ? Math.min(...rates) : null;
}

async function fetchBounded(url, init, fetchImpl) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: { ...REQUEST_HEADERS, ...(init?.headers ?? {}) },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("レスポンスが上限を超えました。");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error("レスポンスが上限を超えました。");
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("取得に失敗しました。");
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

export function createAdapterContext(fetchImpl = fetch) {
  let kakakuPromise;
  return {
    fetchImpl,
    getKakakuBytes() {
      kakakuPromise ??= fetchBounded(KAKAKU_URL, undefined, fetchImpl);
      return kakakuPromise;
    },
  };
}

async function fetchStructuredOffer(source, fetchedAt, date, context) {
  if (source.adapter === "netbk-jsonp") {
    const bytes = await fetchBounded(source.apiUrl, undefined, context.fetchImpl);
    return parseNetbkJsonp(decodeUtf8(bytes), source, fetchedAt, date);
  }
  if (source.adapter === "paypay-api") {
    const bytes = await fetchBounded(
      source.apiUrl,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "target=refinancing",
      },
      context.fetchImpl,
    );
    return parsePayPayRateJson(JSON.parse(decodeUtf8(bytes)), source, fetchedAt, date);
  }
  if (source.adapter === "sbishinsei-api") {
    let bytes;
    try {
      bytes = await fetchBounded(source.apiUrl, undefined, context.fetchImpl);
    } catch {
      bytes = await fetchBounded(source.backupApiUrl, undefined, context.fetchImpl);
    }
    return parseSbiShinseiJson(JSON.parse(decodeUtf8(bytes)), source, fetchedAt);
  }
  return null;
}

async function fetchDiagnosticOfficialHtml(source, fetchedAt, date, context) {
  let lastError;
  for (const url of source.rateUrls.slice(0, 2)) {
    try {
      const bytes = await fetchBounded(url, undefined, context.fetchImpl);
      const rate = extractRate(decodeUtf8(bytes), source);
      if (rate === null) continue;
      const offer = baseOffer(source, fetchedAt, getJstMonthKey(date), url, "official-html");
      offer.advertisedMinRate = rate;
      offer.confidence = "review";
      offer.conditionsSummary = "公式HTMLからの診断用候補値。商品・借換え・団信条件を確定できていません。";
      offer.failureReason = "汎用HTML診断値のため自動推薦対象外";
      offer.rateOptions = [{ id: "html-diagnostic", label: "公式HTML診断値", rate }];
      return offer;
    } catch (error) {
      lastError = error;
    }
  }
  try {
    const kakakuBytes = await context.getKakakuBytes();
    const reference = parseKakakuShiftJis(kakakuBytes, source, fetchedAt, date);
    if (reference) return reference;
  } catch (error) {
    lastError = error;
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("公式HTMLと価格.com参考ページから金利を特定できませんでした。");
}

export async function fetchBankOffer(source, fetchedAt, date, context) {
  const structured = await fetchStructuredOffer(source, fetchedAt, date, context);
  if (structured) return structured;
  if (source.adapter === "hirogin-diamond") {
    const bytes = await fetchBounded(source.referenceUrl, undefined, context.fetchImpl);
    const offer = parseHiroginDiamondHtml(decodeUtf8(bytes), source, fetchedAt, date);
    if (!offer) throw new Error("広島銀行の最新月参考金利を特定できませんでした。");
    return offer;
  }
  return fetchDiagnosticOfficialHtml(source, fetchedAt, date, context);
}

export { BANK_RATE_SOURCES, KAKAKU_URL };
