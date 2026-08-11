import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LOCK_TTL_SECONDS,
  REFRESH_LOCK_KEY,
  getCachedRates,
  refreshAllRates,
} from "../functions/api/rateService.js";
import { onRequestGet } from "../functions/api/rates.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/rates/${name}`, import.meta.url), "utf8");

class FakeKv {
  values = new Map<string, string>();
  puts: Array<{ key: string; options?: { expirationTtl?: number } }> = [];

  async get(key: string, type?: string) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.values.set(key, value);
    this.puts.push({ key, options });
  }
}

function response(body: string, contentType = "application/json") {
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

function partialFetch(input: string | URL | Request) {
  const url = String(input);
  if (url.includes("kinri_hl_mr.js")) return Promise.resolve(response(fixture("netbk-jsonp.txt")));
  if (url.includes("MortgageRates.do")) return Promise.resolve(response(fixture("paypay.json")));
  if (url.includes("interest_rate_hl")) return Promise.resolve(response(fixture("sbishinsei.json")));
  return Promise.reject(new Error("fixtureなし"));
}

test("一部銀行が失敗しても公式API成功分と履歴を保存する", async () => {
  const kv = new FakeKv();
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-06-21T00:00:00.000Z"),
      fetchImpl: partialFetch,
      bypassLock: true,
    },
  );
  assert.equal(result.items.length, 13);
  assert.equal(result.items.filter((item) => item.status === "success").length, 3);
  assert.equal(result.items.find((item) => item.bankRateSourceId === "netbk")?.rate, 0.95);
  assert.ok(kv.values.has("rates:latest"));
  assert.ok(kv.values.has("rates:verified-history:2026-06:netbk"));
  assert.equal(kv.values.has("rates:history:2026-06:netbk"), false);
});

test("v12: JST当月かつ正常な取得時刻のpayloadキャッシュだけをfreshとする", async () => {
  const kv = new FakeKv();
  await kv.put(
    "rates:latest",
    JSON.stringify({ month: "2026-06", fetchedAt: "2026-06-21T00:00:00.000Z", items: [] }),
  );
  const fresh = await getCachedRates(
    { RATE_CACHE: kv },
    { date: new Date("2026-06-21T00:00:00.000Z") },
  );
  assert.equal(fresh?.cached, true);
  assert.equal(fresh?.cacheState, "fresh");
});

test("v12: 月跨ぎ、不正時刻、未来時刻のpayloadキャッシュはstaleとする", async () => {
  const date = new Date("2026-07-01T00:00:00.000Z");
  const cases = [
    { month: "2026-06", fetchedAt: "2026-06-30T23:00:00.000Z", reason: "month-mismatch" },
    { month: "2026-07", fetchedAt: "not-a-date", reason: "invalid-fetched-at" },
    { month: "2026-07", fetchedAt: "2026-07-01", reason: "invalid-fetched-at" },
    { month: "2026-07", fetchedAt: "2026-07-02T00:00:00.000Z", reason: "future-fetched-at" },
  ];
  for (const item of cases) {
    const kv = new FakeKv();
    await kv.put("rates:latest", JSON.stringify({ ...item, items: [] }));
    const cached = await getCachedRates({ RATE_CACHE: kv }, { date });
    assert.equal(cached?.cacheState, "stale");
    assert.equal(cached?.staleReason, item.reason);
  }
});

test("v12: Pages GETは月跨ぎcacheでライブ更新を試み、当月値を返す", async () => {
  const kv = new FakeKv();
  await kv.put(
    "rates:latest",
    JSON.stringify({ month: "2026-05", fetchedAt: "2026-05-31T21:00:00.000Z", items: [] }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = partialFetch as typeof fetch;
  try {
    const response = await onRequestGet({ env: { RATE_CACHE: kv } });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.schemaVersion, 12);
    assert.equal(payload.month, new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" })
      .formatToParts(new Date())
      .filter((part) => part.type === "year" || part.type === "month")
      .map((part) => part.value)
      .join("-"));
    assert.equal(payload.cached, false);
    assert.equal(payload.cacheState, "fresh");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("10分ロック中は重複再取得せずキャッシュを返す", async () => {
  const kv = new FakeKv();
  await kv.put(REFRESH_LOCK_KEY, "running", { expirationTtl: LOCK_TTL_SECONDS });
  await kv.put(
    "rates:latest",
    JSON.stringify({ month: "2026-06", fetchedAt: "x", items: [], message: "cached" }),
  );
  let called = false;
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    { fetchImpl: async () => { called = true; throw new Error("should not call"); } },
  );
  assert.equal(result.locked, true);
  assert.equal(called, false);
  assert.equal(result.cacheState, "stale");
});

test("v12: 当月ライブ取得が全失敗なら旧payloadの証跡を保ち全行staleで返す", async () => {
  const kv = new FakeKv();
  const cachedOffer = {
    bankRateSourceId: "netbk",
    advertisedMinRate: 0.95,
    applicableMonth: "2026-06",
    confidence: "verified",
    sourceKind: "official-api",
    evidence: [{ sourceUrl: "https://bank.example/rate", label: "公式" }],
  };
  await kv.put(
    "rates:latest",
    JSON.stringify({
      schemaVersion: 11,
      month: "2026-06",
      fetchedAt: "2026-06-21T00:00:00.000Z",
      items: [
        {
          bankRateSourceId: "netbk",
          bankName: "住信SBIネット銀行",
          rate: 0.95,
          status: "success",
          sourceUrl: "https://bank.example/rate",
          message: "公式値",
          offer: cachedOffer,
          lastGoodOffer: cachedOffer,
        },
      ],
    }),
  );
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-07-01T00:00:00.000Z"),
      fetchImpl: async () => { throw new Error("network down"); },
      bypassLock: true,
    },
  );
  assert.equal(result.cached, true);
  assert.equal(result.cacheState, "stale");
  assert.equal(result.staleReason, "month-mismatch");
  assert.equal(result.items[0].status, "stale");
  assert.equal(result.items[0].offer?.evidence?.[0].sourceUrl, "https://bank.example/rate");
  assert.equal(result.items[0].lastGoodOffer?.advertisedMinRate, 0.95);
});

test("v12: 初回全失敗はlatestへ保存せず次の通常GETで再取得する", async () => {
  const kv = new FakeKv();
  const first = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date(),
      fetchImpl: async () => { throw new Error("initial outage"); },
      bypassLock: true,
    },
  );
  assert.equal(first.cacheState, "stale");
  assert.equal(first.items.every((item) => item.status === "failed"), true);
  assert.equal(kv.values.has("rates:latest"), false);
  assert.equal(await getCachedRates({ RATE_CACHE: kv }), null);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = partialFetch as typeof fetch;
  try {
    const response = await onRequestGet({ env: { RATE_CACHE: kv } });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.cacheState, "fresh");
    assert.ok(payload.items.some((item: { status: string }) => item.status === "success"));
    assert.equal(kv.values.has("rates:latest"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("v9: 取得失敗時は最後の正常値を履歴フォールバックでstale表示し、lastGoodOfferも保持する", async () => {
  const kv = new FakeKv();
  const lastGood = {
    bankRateSourceId: "netbk",
    advertisedMinRate: 0.95,
    applicableMonth: "2026-05",
    fetchedAt: "2026-05-21T00:00:00.000Z",
    confidence: "verified",
    sourceKind: "official-api",
    conditionsSummary: "前月の公式値",
    evidence: [
      {
        sourceKind: "official-api",
        sourceUrl: "x",
        rate: 0.95,
        applicableMonth: "2026-05",
        label: "公式",
      },
    ],
  };
  await kv.put("rates:latest:netbk", JSON.stringify(lastGood));
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-06-21T00:00:00.000Z"),
      fetchImpl: async () => { throw new Error("all failed"); },
      bypassLock: true,
    },
  );
  const netbk = result.items.find((item) => item.bankRateSourceId === "netbk");
  assert.equal(netbk?.status, "stale");
  assert.equal(netbk?.rate, 0.95);
  assert.equal(netbk?.lastGoodOffer?.advertisedMinRate, 0.95);
  assert.ok(kv.values.has("rates:verified-latest:netbk"));
});

test("前月の公式値は表示用に保持しても当月成功扱いにしない", async () => {
  const kv = new FakeKv();
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-07-21T00:00:00.000Z"),
      fetchImpl: partialFetch,
      bypassLock: true,
    },
  );
  const paypay = result.items.find((item) => item.bankRateSourceId === "paypay");
  assert.equal(paypay?.status, "needs-review");
  assert.match(paypay?.offer?.failureReason ?? "", /当月ではありません/);
  assert.equal(kv.values.has("rates:verified-history:2026-07:paypay"), false);
});

test("v9: 主系統が全失敗かつ前月履歴があればstaleとして表示し、当月の履歴は上書きしない", async () => {
  const kv = new FakeKv();
  await kv.put(
    "rates:history:2026-05:netbk",
    JSON.stringify({
      bankRateSourceId: "netbk",
      bankName: "住信SBIネット銀行",
      productName: "WEB申込コース（借換え）",
      schemaVersion: 1,
      advertisedMinRate: 0.95,
      applicableMonth: "2026-05",
      fetchedAt: "2026-05-21T00:00:00.000Z",
      confidence: "verified",
      sourceKind: "official-api",
      conditionsSummary: "前月の公式値",
      adapterId: "netbk-jsonp",
      rateOptions: [],
      evidence: [
        {
          sourceKind: "official-api",
          sourceUrl: "x",
          rate: 0.95,
          applicableMonth: "2026-05",
          label: "公式",
        },
      ],
    }),
  );
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-06-21T00:00:00.000Z"),
      fetchImpl: async () => {
        throw new Error("network down");
      },
      bypassLock: true,
    },
  );
  const netbk = result.items.find((item) => item.bankRateSourceId === "netbk");
  assert.equal(netbk?.status, "stale");
  assert.equal(netbk?.rate, 0.95);
  assert.match(netbk?.message ?? "", /履歴値/);
  assert.ok(kv.values.has("rates:verified-history:2026-05:netbk"));
  assert.equal(
    kv.puts.find((put) => put.key === "rates:verified-history:2026-05:netbk")?.options
      ?.expirationTtl,
    60 * 60 * 24 * 400,
  );
  // stale結果は当月履歴に書き込まない（前月値で当月を上書きしないこと）
  assert.equal(kv.values.has("rates:history:2026-06:netbk"), false);
});

test("v12: schemaVersionは12を返し、staleと失敗のカウントがメッセージに含まれる", async () => {
  const kv = new FakeKv();
  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-06-21T00:00:00.000Z"),
      fetchImpl: async () => {
        throw new Error("network down");
      },
      bypassLock: true,
    },
  );
  assert.equal(result.schemaVersion, 12);
  assert.match(result.message, /前月履歴値の参考表示/);
  assert.match(result.message, /取得失敗/);
});

test("v12: legacy履歴のaggregator・review・月違い・未来日時はverifiedキーへ移行しない", async () => {
  const kv = new FakeKv();
  const baseOffer = {
    bankName: "テスト銀行",
    productName: "借換え変動",
    loanPurpose: "refinance",
    rateType: "variable",
    schemaVersion: 1,
    advertisedMinRate: 0.95,
    applicableMonth: "2026-05",
    fetchedAt: "2026-05-21T00:00:00.000Z",
    sourceUrl: "https://bank.example/rate",
    sourceKind: "official-api",
    confidence: "verified",
    eligibility: "unknown",
    conditionsSummary: "テスト",
    adapterId: "test",
    rateOptions: [],
    evidence: [],
  };
  const invalidOffers = [
    { sourceId: "netbk", patch: { sourceKind: "aggregator" } },
    { sourceId: "paypay", patch: { confidence: "review" } },
    { sourceId: "sbishinsei", patch: { applicableMonth: "2026-04" } },
    { sourceId: "jibun", patch: { fetchedAt: "2026-07-01T00:00:00.000Z" } },
  ];
  for (const { sourceId, patch } of invalidOffers) {
    await kv.put(
      `rates:history:2026-05:${sourceId}`,
      JSON.stringify({ ...baseOffer, bankRateSourceId: sourceId, ...patch }),
    );
  }

  const result = await refreshAllRates(
    { RATE_CACHE: kv },
    {
      date: new Date("2026-06-21T00:00:00.000Z"),
      fetchImpl: async () => { throw new Error("network down"); },
      bypassLock: true,
    },
  );

  for (const { sourceId } of invalidOffers) {
    assert.equal(result.items.find((item) => item.bankRateSourceId === sourceId)?.status, "failed");
    assert.equal(kv.values.has(`rates:verified-history:2026-05:${sourceId}`), false);
  }
});
