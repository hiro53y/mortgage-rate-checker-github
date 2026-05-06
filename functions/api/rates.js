const BANK_SOURCES = [
  {
    id: "momiji",
    bankName: "もみじ銀行",
    rateUrl: "https://www.momijibank.co.jp/personal/borrow/house/tesuuryougata/",
  },
  {
    id: "mufg",
    bankName: "三菱UFJ銀行",
    rateUrl: "https://www.bk.mufg.jp/kariru/jutaku/yuuguu/index.html",
  },
  {
    id: "smbc",
    bankName: "三井住友銀行",
    rateUrl: "https://www.smbc.co.jp/kojin/jutaku_loan/kinri/",
  },
  {
    id: "mizuho",
    bankName: "みずほ銀行",
    rateUrl: "https://www.mizuhobank.co.jp/loan_housing/housingloancost/index.html",
  },
  {
    id: "resona",
    bankName: "りそな銀行",
    rateUrl: "https://www.resonabank.co.jp/kojin/jutaku/karikae/",
  },
  {
    id: "netbk",
    bankName: "住信SBIネット銀行",
    rateUrl: "https://www.netbk.co.jp/contents/lineup/home-loan/",
  },
  {
    id: "jibun",
    bankName: "auじぶん銀行",
    rateUrl: "https://www.jibunbank.co.jp/products/homeloan/interest/",
  },
  {
    id: "paypay",
    bankName: "PayPay銀行",
    rateUrl: "https://www.paypay-bank.co.jp/mortgage/interest/index.html",
  },
  {
    id: "sbishinsei",
    bankName: "SBI新生銀行",
    rateUrl: "https://www.sbishinseibank.co.jp/retail/housing/interest/floating/",
  },
  {
    id: "sonybank",
    bankName: "ソニー銀行",
    rateUrl: "https://sonybank.jp/rate/hl01.html",
  },
  {
    id: "rakuten",
    bankName: "楽天銀行",
    rateUrl: "https://www.rakuten-bank.co.jp/home-loan/rate/",
  },
  {
    id: "hirogin",
    bankName: "広島銀行",
    rateUrl: "https://www.hirogin.co.jp/service/loan/housing-loan/otoku/",
  },
  {
    id: "chugin",
    bankName: "中国銀行",
    rateUrl: "https://www.chugin.co.jp/personal/service/housingloan/rate/",
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

function normalizeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function scoreContext(context) {
  let score = 0;
  if (/変動|変動金利/.test(context)) score += 6;
  if (/借換|借り換え|借換え/.test(context)) score += 4;
  if (/住宅ローン|金利|年/.test(context)) score += 2;
  if (/がん|疾病|団信/.test(context)) score += 1;
  if (/固定|フラット|預金|外貨|カードローン|教育|自動車/.test(context)) score -= 5;
  return score;
}

function extractRate(html) {
  const text = normalizeText(html);
  const candidates = [];
  const regex = /([0-9０-９]+(?:[.．][0-9０-９]{1,3})?)\s*%/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const normalizedNumber = match[1]
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace("．", ".");
    const rate = Number(normalizedNumber);
    if (!Number.isFinite(rate) || rate < 0.2 || rate > 3.0) {
      continue;
    }
    const context = text.slice(Math.max(0, match.index - 80), match.index + 100);
    candidates.push({ rate, score: scoreContext(context), context });
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

async function fetchBankRate(source, fetchedAt) {
  try {
    const response = await fetch(source.rateUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "MortgageRateChecker/1.0 (+https://pages.cloudflare.com)",
      },
    });

    if (!response.ok) {
      return {
        bankRateSourceId: source.id,
        bankName: source.bankName,
        rate: null,
        status: "failed",
        fetchedAt,
        sourceUrl: source.rateUrl,
        message: `公式ページ取得に失敗しました。HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const rate = extractRate(html);
    if (rate === null) {
      return {
        bankRateSourceId: source.id,
        bankName: source.bankName,
        rate: null,
        status: "failed",
        fetchedAt,
        sourceUrl: source.rateUrl,
        message: "金利候補を自動抽出できませんでした。公式確認と手入力補正を行ってください。",
      };
    }

    return {
      bankRateSourceId: source.id,
      bankName: source.bankName,
      rate,
      status: "needs-review",
      fetchedAt,
      sourceUrl: source.rateUrl,
      message: "公式ページから金利候補を自動抽出しました。条件一致は公式確認してください。",
    };
  } catch (error) {
    return {
      bankRateSourceId: source.id,
      bankName: source.bankName,
      rate: null,
      status: "failed",
      fetchedAt,
      sourceUrl: source.rateUrl,
      message:
        error instanceof Error
          ? `公式ページ取得に失敗しました。${error.message}`
          : "公式ページ取得に失敗しました。",
    };
  }
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
    message: `${successCount}/${items.length}件の金利候補を自動取得しました。公式確認と手入力補正を前提にしてください。`,
  };

  if (kv) {
    await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 45 });
  }

  return json(payload);
}
