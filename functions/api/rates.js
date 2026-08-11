import { getCachedRates, jsonResponse, makeAllItemsStale, refreshAllRates } from "./rateService.js";
import {
  extractRate as extractRateV7,
  extractRateFromAggregate as extractRateFromAggregateV7,
  getJstMonthKey,
  getRateUrls as getRateUrlsV7,
  normalizeText as normalizeTextV7,
} from "./rateAdapters.js";

/* v6 generic scraper snapshot. Kept as a migration reference only.
const MAX_URLS_PER_SOURCE = 8;
const FETCH_TIMEOUT_MS = 12000;
const MIN_RATE = 0.25;
const MAX_RATE = 3.0;
const MIN_CONFIDENCE_SCORE = 5;

const AGGREGATE_RATE_URLS = [
  "https://mogecheck.jp/mortgage-ranking/refinance",
  "https://s.kakaku.com/housing-loan/ranking.asp?hl_ltype=1&utm_source=chatgpt.com",
  "https://kakaku.com/housing-loan/ranking.asp?hl_ltype=1",
  "https://diamond-fudosan.jp/category/housing-loan",
];

const REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,any;q=0.7",
  "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.6,en;q=0.4",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 MortgageRateChecker/1.0",
};

const BANK_SOURCES = [
  {
    id: "momiji",
    bankName: "もみじ銀行",
    rateUrls: [
      "https://www.momijibank.co.jp/personal/borrow/house/tesuuryougata/",
      "https://www.momijibank.co.jp/personal/borrow/house/",
    ],
    preferredKeywords: ["変動", "下限", "融資手数料型", "住宅ローン"],
  },
  {
    id: "mufg",
    bankName: "三菱UFJ銀行",
    rateUrls: [
      "https://www.bk.mufg.jp/kariru/jutaku/yuuguu/index.html",
      "https://www.bk.mufg.jp/kariru/jutaku/kinri/index.html",
    ],
    preferredKeywords: ["変動", "住宅ローン", "適用金利", "借換"],
  },
  {
    id: "smbc",
    bankName: "三井住友銀行",
    rateUrls: [
      "https://www.smbc.co.jp/kojin/jutaku_loan/kinri/",
      "https://www.smbc.co.jp/kojin/jutaku_loan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "借換"],
  },
  {
    id: "mizuho",
    bankName: "みずほ銀行",
    rateUrls: [
      "https://www.mizuhobank.co.jp/loan_housing/housingloancost/index.html",
      "https://www.mizuhobank.co.jp/loan_housing/index.html",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
  },
  {
    id: "resona",
    bankName: "りそな銀行",
    rateUrls: [
      "https://www.resonabank.co.jp/kojin/jutaku/karikae/",
      "https://www.resonabank.co.jp/kojin/jutaku/kinri/",
    ],
    preferredKeywords: ["変動", "借換", "住宅ローン"],
  },
  {
    id: "netbk",
    bankName: "住信SBIネット銀行",
    rateUrls: [
      "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
      "https://www.netbk.co.jp/contents/lineup/home-loan/web/kinri/",
      "https://www.netbk.co.jp/contents/lineup/home-loan/",
    ],
    preferredKeywords: ["変動", "WEB申込", "WEB申込コース", "借換", "住宅ローン", "表面金利"],
    aggregateAliases: ["住信SBIネット銀行", "住信SBI", "NEOBANK", "SBI"],
    aggregateRateUrls: [
      "https://s.kakaku.com/housing-loan/ranking.asp?hl_ltype=1&utm_source=chatgpt.com",
      "https://kakaku.com/housing-loan/ranking.asp?hl_ltype=1",
      "https://mogecheck.jp/mortgage-ranking/refinance",
    ],
    minExpectedRate: 0.7,
    maxExpectedRate: 1.5,
  },
  {
    id: "jibun",
    bankName: "auじぶん銀行",
    rateUrls: [
      "https://www.jibunbank.co.jp/products/homeloan/interest/",
      "https://www.jibunbank.co.jp/products/homeloan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "借換"],
    aggregateAliases: ["auじぶん銀行", "じぶん銀行"],
    aggregateRateUrls: [
      "https://mogecheck.jp/mortgage-ranking/refinance",
      "https://s.kakaku.com/housing-loan/ranking.asp?hl_ltype=1&utm_source=chatgpt.com",
      "https://kakaku.com/housing-loan/ranking.asp?hl_ltype=1",
    ],
    minExpectedRate: 0.7,
    maxExpectedRate: 1.5,
  },
  {
    id: "paypay",
    bankName: "PayPay銀行",
    rateUrls: [
      "https://www.paypay-bank.co.jp/mortgage/interest/index.html",
      "https://www.paypay-bank.co.jp/mortgage/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
    aggregateAliases: ["PayPay銀行", "ペイペイ銀行", "PayPay"],
    aggregateRateUrls: [
      "https://mogecheck.jp/mortgage-ranking/refinance",
      "https://s.kakaku.com/housing-loan/ranking.asp?hl_ltype=1&utm_source=chatgpt.com",
      "https://kakaku.com/housing-loan/ranking.asp?hl_ltype=1",
    ],
    minExpectedRate: 0.7,
    maxExpectedRate: 1.5,
  },
  {
    id: "sbishinsei",
    bankName: "SBI新生銀行",
    rateUrls: [
      "https://www.sbishinseibank.co.jp/retail/housing/interest/floating/",
      "https://www.sbishinseibank.co.jp/retail/housing/interest/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
    aggregateAliases: ["SBI新生銀行", "SBI新生", "新生銀行"],
    aggregateRateUrls: [
      "https://mogecheck.jp/mortgage-ranking/refinance",
      "https://s.kakaku.com/housing-loan/ranking.asp?hl_ltype=1&utm_source=chatgpt.com",
      "https://kakaku.com/housing-loan/ranking.asp?hl_ltype=1",
    ],
    minExpectedRate: 0.7,
    maxExpectedRate: 1.5,
  },
  {
    id: "sonybank",
    bankName: "ソニー銀行",
    rateUrls: [
      "https://sonybank.jp/rate/hl01.html",
      "https://moneykit.net/visitor/hl/hl20.html",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
  },
  {
    id: "rakuten",
    bankName: "楽天銀行",
    rateUrls: [
      "https://www.rakuten-bank.co.jp/home-loan/rate/",
      "https://www.rakuten-bank.co.jp/home-loan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
  },
  {
    id: "hirogin",
    bankName: "広島銀行",
    rateUrls: [
      "https://www.hirogin.co.jp/service/loan/housing-loan/super/",
      "https://www.hirogin.co.jp/service/loan/housing-loan/otoku/",
      "https://www.hirogin.co.jp/service/loan/housing-loan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "スーパー住宅ローン", "地銀", "表面金利"],
    aggregateAliases: ["広島銀行", "ひろぎん", "hirogin"],
    aggregateRateUrls: [
      "https://diamond-fudosan.jp/articles/-/1111034",
      "https://diamond-fudosan.jp/category/housing-loan",
      "https://mogecheck.jp/mortgage-ranking/refinance",
    ],
    minExpectedRate: 0.7,
    maxExpectedRate: 1.2,
  },
  {
    id: "chugin",
    bankName: "中国銀行",
    rateUrls: [
      "https://www.chugin.co.jp/personal/service/housingloan/rate/",
      "https://www.chugin.co.jp/personal/service/housingloan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
  },
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getJstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: map.year,
    month: map.month,
    day: Number(map.day),
  };
}

function getMonthKey(date = new Date()) {
  const parts = getJstParts(date);
  return `${parts.year}-${parts.month}`;
}

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

function normalizeUrl(url, baseUrl) {
  try {
    const parsed = baseUrl ? new URL(url, baseUrl) : new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

function dedupeUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

export function getRateUrls(source) {
  return dedupeUrls([...(source.rateUrls ?? []), source.rateUrl]);
}

function getAggregateRateUrls(source) {
  return dedupeUrls([...(source.aggregateRateUrls ?? []), ...AGGREGATE_RATE_URLS]);
}

function getBankAliases(source = {}) {
  return dedupeUrls([source.bankName, ...(source.aggregateAliases ?? [])]).map((alias) =>
    alias.normalize("NFKC"),
  );
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function contextHas(context, pattern) {
  return pattern.test(context);
}

function scoreContext(context, source = {}) {
  let score = 0;
  const text = context.normalize("NFKC");

  if (contextHas(text, /住宅ローン|ホームローン|住まい|マイホーム/)) score += 4;
  if (contextHas(text, /変動金利|変動/)) score += 12;
  if (contextHas(text, /借換|借り換え|借換え|お借換/)) score += 5;
  if (contextHas(text, /適用金利|優遇金利|下限|最優遇|金利プラン|新規|当初/)) score += 3;
  if (contextHas(text, /表面金利|店頭金利ではなく|適用利率/)) score += 6;
  if (contextHas(text, /年\s*[0-9.]+\s*%|金利/)) score += 2;

  for (const keyword of source.preferredKeywords ?? []) {
    if (keyword && text.includes(keyword.normalize("NFKC"))) {
      score += 3;
    }
  }

  if (contextHas(text, /上乗せ|上乗せ金利|保険料|保証料|事務手数料|融資手数料|登記|印紙|繰上|返済手数料/)) {
    score -= 12;
  }
  if (contextHas(text, /固定金利|固定期間|当初固定|フラット|Flat|10年固定|20年固定|35年固定/)) {
    score -= 9;
  }
  if (contextHas(text, /預金|外貨|カードローン|教育ローン|自動車|マイカー|投資|証券|定期/)) {
    score -= 8;
  }
  if (contextHas(text, /店頭表示金利|基準金利|基準利率|引下げ幅|引き下げ幅/)) {
    score -= 4;
  }
  if (contextHas(text, /実質金利|手数料込|手数料込み|総返済額|毎月返済額|月々の返済額/)) {
    score -= 6;
  }
  if (contextHas(text, /団信|疾病|がん|保障|特約/)) {
    score -= 1;
  }

  return score;
}

function isRateWithinSourceBounds(rate, source = {}) {
  if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
    return false;
  }
  if (source.minExpectedRate !== undefined && rate < source.minExpectedRate) {
    return false;
  }
  if (source.maxExpectedRate !== undefined && rate > source.maxExpectedRate) {
    return false;
  }
  return true;
}

function extractLatestMonthlyTableRate(text, source = {}, date = new Date()) {
  const aliases = getBankAliases(source);
  const currentMonth = getMonthKey(date).replace("-", "/");
  const rows = [];
  const rowRegex = /(20\d{2})[/-](0[1-9]|1[0-2])\s+([0-9]+(?:\.[0-9]{1,3})?)\s*%/g;
  let match;

  while ((match = rowRegex.exec(text)) !== null) {
    const rate = Number(match[3]);
    if (!isRateWithinSourceBounds(rate, source)) {
      continue;
    }

    const context = text.slice(Math.max(0, match.index - 160), match.index + 120);
    const hasMonthlyRateContext =
      /住宅ローン|変動金利|金利推移|借り換え|借換/.test(context) ||
      aliases.some((alias) => context.includes(alias));
    if (!hasMonthlyRateContext) {
      continue;
    }

    const monthKey = `${match[1]}/${match[2]}`;
    rows.push({
      rate,
      monthKey,
      monthValue: Number(`${match[1]}${match[2]}`),
    });
  }

  if (rows.length === 0) {
    return null;
  }

  const currentMonthRow = rows.find((row) => row.monthKey === currentMonth);
  if (currentMonthRow) {
    return currentMonthRow.rate;
  }

  rows.sort((a, b) => b.monthValue - a.monthValue);
  return rows[0].rate;
}

function shouldRejectRateCandidate({ rate, context, localPrefix, localSuffix, source = {} }) {
  const text = `${localPrefix} ${context} ${localSuffix}`.normalize("NFKC");
  const nearPrefix = localPrefix.slice(-16);
  const nearText = `${nearPrefix} ${localSuffix}`.normalize("NFKC");
  const immediateSuffix = localSuffix.slice(0, 12).normalize("NFKC");
  if (!isRateWithinSourceBounds(rate, source)) {
    return true;
  }
  if (/口コミ|評判|利用者|回答時期|借入時期|推奨度合|物件|物 件|金利種別/.test(localPrefix)) {
    return true;
  }
  if (/％位|%位|位|くらい|程度/.test(immediateSuffix) && /借入時期|回答時期|口コミ|評判/.test(text)) {
    return true;
  }
  if (/事務手数料|手数料\(税込\)|手数料税込|借入額×|融資実行額|保証料/.test(nearText)) {
    return true;
  }
  if (/上乗せ|上乗せ金利|保険料/.test(nearText)) {
    return true;
  }
  if (/固定金利|固定期間|フラット35|Flat35|10年固定|20年固定|35年固定/.test(nearPrefix)) {
    return true;
  }
  return false;
}

export function extractRate(html, source = {}) {
  const text = normalizeText(html);
  const monthlyTableRate = extractLatestMonthlyTableRate(text, source);
  if (monthlyTableRate !== null) {
    return monthlyTableRate;
  }

  const candidates = [];
  const regex = /([0-9]+(?:\.[0-9]{1,3})?)\s*%/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const rate = Number(match[1]);
    if (!isRateWithinSourceBounds(rate, {})) {
      continue;
    }

    const context = text.slice(Math.max(0, match.index - 120), match.index + 140);
    const localPrefix = text.slice(Math.max(0, match.index - 32), match.index);
    const localSuffix = text.slice(match.index + match[0].length, match.index + match[0].length + 32);
    if (shouldRejectRateCandidate({ rate, context, localPrefix, localSuffix, source })) {
      continue;
    }
    let score = scoreContext(context, source);
    if (/表面金利|適用金利|優遇金利|変動金利|下限金利/.test(localPrefix)) {
      score += 10;
    }
    if (/実質金利|手数料込|手数料込み|上乗せ|保証料|保険料/.test(localPrefix)) {
      score -= 12;
    }
    if (score < MIN_CONFIDENCE_SCORE) {
      continue;
    }
    candidates.push({ rate, score, context });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.rate - b.rate;
  });

  return candidates[0].rate;
}

export function extractRateFromAggregate(html, source = {}) {
  const text = normalizeText(html);
  const aliases = getBankAliases(source);
  const makeBlockSnippets = (pattern) =>
    html
      .split(pattern)
      .map((block) => normalizeText(block))
      .filter((block) => block.length > 0 && aliases.some((alias) => block.includes(alias)))
      .slice(0, 12);
  const semanticBlockSnippets = makeBlockSnippets(/<\/(?:section|article|tr|li)>/gi);
  const divBlockSnippets = makeBlockSnippets(/<\/div>/gi);
  const indexedSnippets = [];

  for (const alias of aliases) {
    let index = text.indexOf(alias);
    while (index !== -1 && indexedSnippets.length < 12) {
      indexedSnippets.push(text.slice(Math.max(0, index - 80), index + 220));
      index = text.indexOf(alias, index + alias.length);
    }
  }

  const aggregateSource = {
    ...source,
    preferredKeywords: [
      ...(source.preferredKeywords ?? []),
      ...aliases,
      "借換",
      "変動",
      "表面金利",
      "適用金利",
    ],
  };
  const extractRates = (snippets) =>
    snippets
      .map((snippet) => extractRate(snippet, aggregateSource))
      .filter((rate) => rate !== null);

  const semanticBlockRates = extractRates(semanticBlockSnippets);
  if (semanticBlockRates.length > 0) {
    return Math.min(...semanticBlockRates);
  }

  const divBlockRates = extractRates(divBlockSnippets);
  if (divBlockRates.length > 0) {
    return Math.min(...divBlockRates);
  }

  const indexedRates = extractRates(indexedSnippets);
  if (indexedRates.length === 0) {
    return null;
  }
  return Math.min(...indexedRates);
}

function scoreDiscoveredLink(url, text) {
  const normalizedUrl = safeDecodeURIComponent(url).normalize("NFKC");
  const normalizedText = text.normalize("NFKC");
  const haystack = `${normalizedUrl} ${normalizedText}`;
  let score = 0;

  if (/金利|kinri|rate|interest|yuuguu|住宅ローン|home-loan|housing|jutaku|借換|karikae/.test(haystack)) {
    score += 8;
  }
  if (/変動|floating|variable/.test(haystack)) {
    score += 4;
  }
  if (/pdf|javascript:|mailto:|tel:|login|faq|qa|simulation|simulator|contact|insurance|団信/.test(haystack)) {
    score -= 8;
  }

  return score;
}

function discoverRateUrls(html, baseUrl) {
  const base = new URL(baseUrl);
  const candidates = [];
  const linkRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = normalizeUrl(match[1], baseUrl);
    if (!href) {
      continue;
    }
    const parsed = new URL(href);
    if (parsed.origin !== base.origin || parsed.pathname.toLowerCase().endsWith(".pdf")) {
      continue;
    }

    const text = normalizeText(match[2]);
    const score = scoreDiscoveredLink(href, text);
    if (score <= 0) {
      continue;
    }
    candidates.push({ href, score });
  }

  return dedupeUrls(
    candidates
      .sort((a, b) => b.score - a.score)
      .map((candidate) => candidate.href),
  ).slice(0, 4);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: "follow",
      signal: controller.signal,
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        html: "",
        message: `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      html: await response.text(),
      message: "",
    };
  } catch (error) {
    return {
      ok: false,
      html: "",
      message:
        error instanceof Error
          ? error.name === "AbortError"
            ? "取得がタイムアウトしました"
            : error.message
          : "公式ページ取得に失敗しました",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBankRate(source, fetchedAt) {
  const urlsToTry = getRateUrls(source);
  const attemptedUrls = [];
  let lastMessage = "金利候補を自動抽出できませんでした。";

  for (let index = 0; index < urlsToTry.length && attemptedUrls.length < MAX_URLS_PER_SOURCE; index += 1) {
    const sourceUrl = urlsToTry[index];
    if (!sourceUrl || attemptedUrls.includes(sourceUrl)) {
      continue;
    }

    attemptedUrls.push(sourceUrl);
    const fetchResult = await fetchHtml(sourceUrl);
    if (!fetchResult.ok) {
      lastMessage = fetchResult.message;
      continue;
    }

    for (const discoveredUrl of discoverRateUrls(fetchResult.html, sourceUrl)) {
      if (!urlsToTry.includes(discoveredUrl) && !attemptedUrls.includes(discoveredUrl)) {
        urlsToTry.push(discoveredUrl);
      }
    }

    const rate = extractRate(fetchResult.html, source);
    if (rate !== null) {
      return {
        bankRateSourceId: source.id,
        bankName: source.bankName,
        rate,
        status: "needs-review",
        fetchedAt,
        sourceUrl,
        attemptedUrls,
        message: `公式ページから金利候補を自動抽出しました。確認URL ${attemptedUrls.length}件。条件一致は公式確認してください。`,
      };
    }

    lastMessage = "取得したページ内で住宅ローン変動金利らしい数値を特定できませんでした。";
  }

  for (const sourceUrl of getAggregateRateUrls(source)) {
    if (!sourceUrl || attemptedUrls.includes(sourceUrl) || attemptedUrls.length >= MAX_URLS_PER_SOURCE) {
      continue;
    }

    attemptedUrls.push(sourceUrl);
    const fetchResult = await fetchHtml(sourceUrl);
    if (!fetchResult.ok) {
      lastMessage = fetchResult.message;
      continue;
    }

    const rate = extractRateFromAggregate(fetchResult.html, source);
    if (rate !== null) {
      return {
        bankRateSourceId: source.id,
        bankName: source.bankName,
        rate,
        status: "needs-review",
        fetchedAt,
        sourceUrl,
        attemptedUrls,
        message: `公式ページでは金利を特定できなかったため、総合サイトから${source.bankName}の金利候補を抽出しました。確認URL ${attemptedUrls.length}件。必ず公式条件と照合してください。`,
      };
    }

    lastMessage = "総合サイト内でも銀行名と住宅ローン変動金利の組み合わせを特定できませんでした。";
  }

  return {
    bankRateSourceId: source.id,
    bankName: source.bankName,
    rate: null,
    status: "failed",
    fetchedAt,
    sourceUrl: attemptedUrls[0] ?? getRateUrls(source)[0] ?? "",
    attemptedUrls,
    message: `公式ページと総合サイト（計${attemptedUrls.length}件）を確認しましたが、金利候補を自動抽出できませんでした。${lastMessage} 公式確認と手入力補正を行ってください。`,
  };
}

async function onRequestGetV6(context) {
  const requestUrl = new URL(context.request.url);
  const force = requestUrl.searchParams.get("force") === "1";
  const now = new Date();
  const month = getMonthKey(now);
  const day = getJstParts(now).day;
  const cacheKey = `rates:${month}`;
  const kv = context.env.RATE_CACHE;

  if (!force && kv) {
    const cached = await kv.get(cacheKey, "json");
    if (cached) {
      return json({ ...cached, cached: true });
    }
  }

  if (!force && day < 10) {
    return json({
      month,
      fetchedAt: now.toISOString(),
      items: [],
      cached: false,
      message: "毎月10日より前のため、自動取得は行いません。",
    });
  }

  const fetchedAt = now.toISOString();
  const items = await Promise.all(BANK_SOURCES.map((source) => fetchBankRate(source, fetchedAt)));
  const successCount = items.filter((item) => item.rate !== null).length;
  const payload = {
    month,
    fetchedAt,
    items,
    cached: false,
    message: `${successCount}/${items.length}件の金利候補を自動取得しました。借換え候補は取得成功した銀行だけから選びます。公式確認と手入力補正を前提にしてください。`,
  };

  if (kv) {
    await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 45 });
  }

  return json(payload);
}

*/

export {
  extractRateV7 as extractRate,
  extractRateFromAggregateV7 as extractRateFromAggregate,
  getRateUrlsV7 as getRateUrls,
  normalizeTextV7 as normalizeText,
};

export async function onRequestGet(context) {
  try {
    const date = new Date();
    const cached = await getCachedRates(context.env, { date });
    if (cached?.cacheState === "fresh") return jsonResponse(cached);
    if (cached?.cacheState === "stale") {
      try {
        return jsonResponse(await refreshAllRates(context.env, { date }));
      } catch (error) {
        console.error(
          JSON.stringify({
            message: "stale rate cache refresh failed",
            month: getJstMonthKey(date),
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return jsonResponse(makeAllItemsStale(cached));
      }
    }
    return jsonResponse(
      await refreshAllRates(context.env, {
        date,
        bypassLock: !context.env?.RATE_CACHE,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "rate cache miss refresh failed",
        month: getJstMonthKey(new Date()),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonResponse(
      {
        error: "金利取得に失敗しました。時間をおいて再取得してください。",
        month: getJstMonthKey(new Date()),
      },
      502,
    );
  }
}

export async function onRequestPost(context) {
  const requestUrl = new URL(context.request.url);
  const origin = context.request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  try {
    return jsonResponse(await refreshAllRates(context.env));
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "rate refresh failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonResponse({ error: "金利再取得に失敗しました。" }, 502);
  }
}
