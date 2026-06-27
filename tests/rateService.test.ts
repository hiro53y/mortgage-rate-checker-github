import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LOCK_TTL_SECONDS,
  REFRESH_LOCK_KEY,
  refreshAllRates,
} from "../functions/api/rateService.js";

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
  assert.ok(kv.values.has("rates:history:2026-06:netbk"));
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
});

test("v9: 取得失敗時は最後の正常値を履歴フォールバックでstale表示し、lastGoodOfferも保持する", async () => {
  const kv = new FakeKv();
  const lastGood = {
    bankRateSourceId: "netbk",
    advertisedMinRate: 0.95,
    applicableMonth: "2026-05",
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
  // stale結果は当月履歴に書き込まない（前月値で当月を上書きしないこと）
  assert.equal(kv.values.has("rates:history:2026-06:netbk"), false);
});

test("v9: schemaVersionは9を返し、staleと失敗のカウントがメッセージに含まれる", async () => {
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
  assert.equal(result.schemaVersion, 9);
  assert.match(result.message, /前月履歴値の参考表示/);
  assert.match(result.message, /取得失敗/);
});
