import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BANK_RATE_SOURCES } from "../shared/bankRateSources.js";
import {
  parseHiroginDiamondHtml,
  parseKakakuShiftJis,
  parseNetbkJsonp,
  parsePayPayRateJson,
  parseSbiShinseiJson,
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
