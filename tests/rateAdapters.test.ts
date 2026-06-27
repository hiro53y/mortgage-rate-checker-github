import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BANK_RATE_SOURCES } from "../shared/bankRateSources.js";
import {
  buildStaleOfferFromHistory,
  createAdapterContext,
  fetchBankOffer,
  getPreviousMonthKey,
  parseDiamondArticleHtml,
  parseHiroginDiamondHtml,
  parseKakakuCompanyShiftJis,
  parseKakakuShiftJis,
  parseMogecheckArticle,
  parseNetbkJsonp,
  parsePayPayRateJson,
  parseSbiShinseiJson,
  parseZuuArticle,
} from "../functions/api/rateAdapters.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/rates/${name}`, import.meta.url), "utf8");
const source = (id: string) => BANK_RATE_SOURCES.find((item) => item.id === id)!;
const now = new Date("2026-06-21T00:00:00.000Z");
const fetchedAt = now.toISOString();

test("住信SBI JSONPは借換え変動の融資率別金利を区別する", () => {
  const offer = parseNetbkJsonp(fixture("netbk-jsonp.txt"), source("netbk"), fetchedAt, now);
  assert.equal(offer.advertisedMinRate, 0.95);
  assert.equal(offer.baseRate, 3.525);
  assert.deepEqual(offer.rateOptions.map((option) => option.rate), [0.95, 1.3]);
  assert.equal(offer.sourceKind, "official-api");
});

test("住信SBIの実JSONPに連続カンマの欠損値があっても解析できる", () => {
  const liveShape = `callbackHLMr ({"full":{"floatRe":[0.013,-0.02225,-0.016,],"floatReCp":[0.0095,-0.02575,-0.0195,],"fixed5":[0.02499,,]}});`;
  const offer = parseNetbkJsonp(liveShape, source("netbk"), fetchedAt, now);
  assert.equal(offer.advertisedMinRate, 0.95);
  assert.deepEqual(offer.rateOptions.map((option) => option.rate), [0.95, 1.3]);
});

test("PayPay APIは新規や固定ではなく借換え変動金利を採用する", () => {
  const offer = parsePayPayRateJson(
    JSON.parse(fixture("paypay.json")),
    source("paypay"),
    fetchedAt,
    now,
  );
  assert.equal(offer.advertisedMinRate, 1.03);
  assert.equal(offer.baseRate, 2.93);
  assert.equal(offer.applicableMonth, "2026-06");
});

test("SBI新生 APIは当月の通常・自己資金・SBIハイパーを区別する", () => {
  const offer = parseSbiShinseiJson(
    JSON.parse(fixture("sbishinsei.json")),
    source("sbishinsei"),
    fetchedAt,
  );
  assert.equal(offer.advertisedMinRate, 0.99);
  assert.equal(offer.applicableMonth, "2026-06");
  assert.deepEqual(offer.rateOptions.map((option) => option.rate), [1.08, 1.06, 0.99]);
});

test("価格.com Shift_JISを復号して銀行別参考値として扱う", () => {
  const bytes = Uint8Array.from(JSON.parse(fixture("kakaku-shiftjis-bytes.json")));
  const offer = parseKakakuShiftJis(bytes, source("netbk"), fetchedAt, now);
  assert.equal(offer?.advertisedMinRate, 0.95);
  assert.equal(offer?.sourceKind, "aggregator");
  assert.equal(offer?.confidence, "review");
});

test("価格.com銀行別ページから借換え変動金利を構造抽出する", () => {
  const bytes = Uint8Array.from(JSON.parse(fixture("kakaku-company-shiftjis-bytes.json")));
  const offer = parseKakakuCompanyShiftJis(bytes, source("smbc"), fetchedAt, now);
  assert.equal(offer?.advertisedMinRate, 1.325);
  assert.equal(offer?.applicableMonth, "2026-06");
  assert.match(offer?.conditionsSummary ?? "", /銀行別ページ/);
});

test("ダイヤモンド銀行別ページは過去月の低い金利ではなく当月行を使う", () => {
  const offer = parseDiamondArticleHtml(
    `<html><head><title>りそな銀行の住宅ローンの口コミ・金利推移</title></head><body>
      <p>2026年6月1日更新</p><p>年月 変動金利 基準金利</p>
      <p>2026/06 0.950% 3.125%</p><p>2026/05 0.640% 2.875%</p>
    </body></html>`,
    source("resona"),
    fetchedAt,
    now,
  );
  assert.equal(offer?.advertisedMinRate, 0.95);
  assert.equal(offer?.applicableMonth, "2026-06");
});

test("公式構造化データの解析失敗後も価格.comへフォールバックする", async () => {
  const kakakuBytes = Uint8Array.from(JSON.parse(fixture("kakaku-shiftjis-bytes.json")));
  let blockedHtmlRequests = 0;
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("kinri_hl_mr.js")) {
      return new Response(`callbackHLMr({"invalid":true});`, { status: 200 });
    }
    if (url.includes("kakaku.com")) {
      return new Response(kakakuBytes, { status: 200 });
    }
    blockedHtmlRequests += 1;
    return new Response("blocked", { status: 403 });
  };
  const offer = await fetchBankOffer(
    source("netbk"),
    fetchedAt,
    now,
    createAdapterContext(fetchImpl),
  );
  assert.equal(offer.advertisedMinRate, 0.95);
  assert.equal(offer.sourceKind, "aggregator");
  assert.equal(blockedHtmlRequests, 2);
});

test("広島銀行は手数料・口コミ・固定・過去月を採用しない", () => {
  const offer = parseHiroginDiamondHtml(
    fixture("hirogin-diamond.html"),
    source("hirogin"),
    fetchedAt,
    now,
  );
  assert.equal(offer?.advertisedMinRate, 0.95);
  assert.equal(offer?.applicableMonth, "2026-06");
  assert.equal(offer?.sourceKind, "aggregator");
});

test("v9: モゲチェック銀行別記事からエイリアス周辺の借換え変動金利を抽出する", () => {
  const html = `
    <html><body>
      <h2>2026年6月の住宅ローン金利比較</h2>
      <article>
        <h3>住信SBIネット銀行</h3>
        <p>借り換え 変動金利 年0.95% (融資率80%以下)</p>
        <p>事務手数料 借入額×2.2%</p>
      </article>
      <article>
        <h3>auじぶん銀行</h3>
        <p>借り換え 変動金利 年0.98%</p>
      </article>
    </body></html>
  `;
  const offer = parseMogecheckArticle(html, source("netbk"), fetchedAt, now);
  assert.equal(offer?.advertisedMinRate, 0.95);
  assert.equal(offer?.sourceKind, "aggregator");
  assert.equal(offer?.confidence, "review");
});

test("v9: ZUU online 月次まとめは当月を含む記事だけ採用する", () => {
  const matched = parseZuuArticle(
    `<p>2026年6月の住宅ローン比較。住信SBIネット銀行の変動金利は0.95%。</p>`,
    source("netbk"),
    fetchedAt,
    now,
  );
  assert.equal(matched?.advertisedMinRate, 0.95);

  const unmatched = parseZuuArticle(
    `<p>2025年12月の住宅ローン比較。住信SBIネット銀行の変動金利は1.20%。</p>`,
    source("netbk"),
    fetchedAt,
    now,
  );
  assert.equal(unmatched, null);
});

test("v9: getPreviousMonthKeyは前月キーを返す（年跨ぎを含む）", () => {
  assert.equal(getPreviousMonthKey(new Date("2026-06-15T00:00:00Z")), "2026-05");
  assert.equal(getPreviousMonthKey(new Date("2026-01-15T00:00:00Z")), "2025-12");
});

test("v9: buildStaleOfferFromHistoryは履歴値をreview扱いにし、失敗理由に履歴値を明記する", () => {
  const historyOffer = {
    advertisedMinRate: 0.95,
    applicableMonth: "2026-05",
    confidence: "verified",
    conditionsSummary: "前月の公式値",
    evidence: [{ sourceKind: "official-api", sourceUrl: "x", rate: 0.95, applicableMonth: "2026-05", label: "公式" }],
  };
  const stale = buildStaleOfferFromHistory(historyOffer, source("netbk"), fetchedAt, now);
  assert.equal(stale?.confidence, "review");
  assert.match(stale?.failureReason ?? "", /履歴値/);
  assert.equal(stale?.evidence[0].label.includes("履歴値"), true);
});

test("v9: 主系統が全敗してもhistoryOfferLookupがあれば前月履歴をstaleとして返す", async () => {
  const fetchImpl = async () => {
    throw new Error("network down");
  };
  const historyOffer = {
    advertisedMinRate: 0.95,
    applicableMonth: "2026-05",
    confidence: "verified",
    conditionsSummary: "前月公式値",
    evidence: [{ sourceKind: "official-api", sourceUrl: "x", rate: 0.95, applicableMonth: "2026-05", label: "公式" }],
  };
  const context = createAdapterContext(fetchImpl, {
    historyOfferLookup: async () => historyOffer,
  });
  const offer = await fetchBankOffer(source("netbk"), fetchedAt, now, context);
  assert.equal(offer.advertisedMinRate, 0.95);
  assert.match(offer.failureReason ?? "", /履歴値/);
});
