const MAX_URLS_PER_SOURCE = 5;
const FETCH_TIMEOUT_MS = 12000;
const MIN_RATE = 0.25;
const MAX_RATE = 3.0;
const MIN_CONFIDENCE_SCORE = 5;

const REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
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
      "https://www.netbk.co.jp/contents/lineup/home-loan/web/kinri/",
      "https://www.netbk.co.jp/contents/lineup/home-loan/",
    ],
    preferredKeywords: ["変動", "WEB申込", "借換", "住宅ローン"],
  },
  {
    id: "jibun",
    bankName: "auじぶん銀行",
    rateUrls: [
      "https://www.jibunbank.co.jp/products/homeloan/interest/",
      "https://www.jibunbank.co.jp/products/homeloan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "借換"],
  },
  {
    id: "paypay",
    bankName: "PayPay銀行",
    rateUrls: [
      "https://www.paypay-bank.co.jp/mortgage/interest/index.html",
      "https://www.paypay-bank.co.jp/mortgage/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
  },
  {
    id: "sbishinsei",
    bankName: "SBI新生銀行",
    rateUrls: [
      "https://www.sbishinseibank.co.jp/retail/housing/interest/floating/",
      "https://www.sbishinseibank.co.jp/retail/housing/interest/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "金利"],
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
      "https://www.hirogin.co.jp/service/loan/housing-loan/otoku/",
      "https://www.hirogin.co.jp/service/loan/housing-loan/",
    ],
    preferredKeywords: ["変動", "住宅ローン", "地銀"],
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
  if (contextHas(text, /団信|疾病|がん|保障|特約/)) {
    score -= 1;
  }

  return score;
}

export function extractRate(html, source = {}) {
  const text = normalizeText(html);
  const candidates = [];
  const regex = /([0-9]+(?:\.[0-9]{1,3})?)\s*%/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const rate = Number(match[1]);
    if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
      continue;
    }

    const context = text.slice(Math.max(0, match.index - 120), match.index + 140);
    const score = scoreContext(context, source);
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

  return {
    bankRateSourceId: source.id,
    bankName: source.bankName,
    rate: null,
    status: "failed",
    fetchedAt,
    sourceUrl: attemptedUrls[0] ?? getRateUrls(source)[0] ?? "",
    attemptedUrls,
    message: `複数URL（${attemptedUrls.length}件）を確認しましたが、金利候補を自動抽出できませんでした。${lastMessage} 公式確認と手入力補正を行ってください。`,
  };
}

export async function onRequestGet(context) {
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
