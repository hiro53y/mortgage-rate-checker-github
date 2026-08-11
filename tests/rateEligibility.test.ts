import assert from "node:assert/strict";
import test from "node:test";
import { defaultLoanProfile } from "../src/lib/sampleData.ts";
import {
  evaluateRateOfferForLoan,
} from "../src/lib/rateEligibility.ts";
import { isLatestFetchedCandidate } from "../src/lib/comparisonMath.ts";
import { getJstDateKey, getJstMonthKey } from "../src/lib/jstDate.ts";
import type { BankComparisonRow, BankRateSource, LoanProfile, RateOffer } from "../src/types.ts";

const baseOffer: RateOffer = {
  schemaVersion: 1,
  bankRateSourceId: "netbk",
  bankName: "住信SBIネット銀行",
  productName: "WEB申込コース",
  loanPurpose: "refinance",
  rateType: "variable",
  advertisedMinRate: 0.95,
  applicableMonth: "2026-06",
  fetchedAt: "2026-06-21T00:00:00.000Z",
  sourceUrl: "https://www.netbk.co.jp/rates.json",
  sourceKind: "official-api",
  confidence: "verified",
  eligibility: "unknown",
  conditionsSummary: "test",
  adapterId: "netbk-jsonp",
  longTermAddonRate: 0.15,
  rateOptions: [
    { id: "low", label: "融資率80%以下", rate: 0.95, ltvMax: 0.8 },
    { id: "high", label: "融資率80%超", rate: 1.3, ltvMinExclusive: 0.8 },
  ],
};

function loan(overrides: Partial<LoanProfile> = {}): LoanProfile {
  return {
    ...defaultLoanProfile,
    borrowerBirthDate: "1980-01-01",
    estimatedPropertyValue: 60_000_000,
    desiredInsuranceCoverage: "standard",
    nextPaymentDate: "2026-06-27",
    endDate: "2066-09-27",
    ...overrides,
  };
}

test("融資率80%以下と35年超上乗せを条件適合金利へ反映する", () => {
  const result = evaluateRateOfferForLoan(baseOffer, loan(), "2026-06-21");
  assert.equal(result.eligibility, "eligible");
  assert.equal(result.conditionMatchedRate, 1.1);
});

test("融資率80%超は上位金利区分を使う", () => {
  const result = evaluateRateOfferForLoan(
    baseOffer,
    loan({ estimatedPropertyValue: 50_000_000 }),
    "2026-06-21",
  );
  assert.equal(result.conditionMatchedRate, 1.45);
});

test("団信上乗せ不明は条件付きで推薦しない", () => {
  const result = evaluateRateOfferForLoan(
    baseOffer,
    loan({ desiredInsuranceCoverage: "cancer100" }),
    "2026-06-21",
  );
  assert.equal(result.eligibility, "conditional");
  assert.equal(result.conditionMatchedRate, undefined);
});

test("生年月日・物件価値不足と年齢超過を区別する", () => {
  const missing = evaluateRateOfferForLoan(
    baseOffer,
    { ...defaultLoanProfile, borrowerBirthDate: undefined, estimatedPropertyValue: undefined },
    "2026-06-21",
  );
  assert.equal(missing.eligibility, "unknown");

  const ageLimited: RateOffer = {
    ...baseOffer,
    rateOptions: [{ id: "age", label: "64歳以下", rate: 1, maxBorrowerAge: 64 }],
  };
  const tooOld = evaluateRateOfferForLoan(
    ageLimited,
    loan({ borrowerBirthDate: "1950-01-01" }),
    "2026-06-21",
  );
  assert.equal(tooOld.eligibility, "ineligible");
});

function row(overrides: Partial<BankComparisonRow> = {}): BankComparisonRow {
  return {
    id: "candidate",
    rowKind: "candidate",
    bankName: "住信SBIネット銀行",
    effectiveRate: 1,
    conditionMatchedRate: 1,
    rateOffer: baseOffer,
    rateStatus: "auto",
    sourceKind: "official-api",
    confidence: "verified",
    eligibility: "eligible",
    applicableMonth: "2026-06",
    insuranceLevel: "一般団信",
    monthlyPayment: 90_000,
    netBenefit: 100_000,
    isPriorityCandidate: false,
    note: "test",
    ...overrides,
  };
}

test("当月公式条件適合だけを推薦し、期限切れ・総合サイトを除外する", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(row(), now), true);
  assert.equal(
    isLatestFetchedCandidate(
      row({ rateOffer: { ...baseOffer, applicableMonth: "2026-05" } }),
      now,
    ),
    false,
  );
  assert.equal(
    isLatestFetchedCandidate(
      row({ rateOffer: { ...baseOffer, sourceKind: "aggregator" } }),
      now,
    ),
    false,
  );
});

test("公式確認済み手入力だけを推薦候補にできる", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.9,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), true);
  assert.equal(isLatestFetchedCandidate({ ...manual, manualVerifiedAt: undefined }, now), false);
});

// ===== v12: 手入力推薦の鮮度・公式ホスト確認 =====
test("v12: 手入力+公式確認+JST当月+公式host → 推薦対象", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), true);
});

test("v12: 手入力+公式確認+前月 → 推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-05",
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), false);
});

test("v12: 手入力+公式確認+翌月または不正年月 → 推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-07",
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), false);
  assert.equal(
    isLatestFetchedCandidate({ ...manual, manualApplicableMonth: "2026-13" }, now),
    false,
  );
});

test("v12: 手入力+公式確認+applicableMonth 未入力 → 推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: undefined,
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), false);
});

test("v11: 手入力のみ（公式確認なし）→ 推薦対象外（参考表示のみ）", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: undefined,
    manualVerifiedAt: undefined,
    sourceKind: undefined,
    eligibility: "unknown",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), false);
});

test("v11: 手入力+公式確認だが sourceUrl が http (非HTTPS) → 推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "http://bank.example/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
    eligibility: "unknown",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), false);
});

test("v12: 手入力URLが対象銀行マスタの公式hostと異なる場合は推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(
    isLatestFetchedCandidate(row({
      rateOffer: undefined,
      manualOverrideRate: 0.82,
      manualApplicableMonth: "2026-06",
      manualSourceUrl: "https://example.com/rate",
      manualVerifiedAt: "2026-06-21T00:00:00.000Z",
      eligibility: "eligible",
    }), now),
    false,
  );
});

test("v12: JST月境界で当月判定する", () => {
  const manual = row({
    rateOffer: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-07",
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(isLatestFetchedCandidate(manual, new Date("2026-06-30T14:59:59.000Z")), false);
  assert.equal(isLatestFetchedCandidate(manual, new Date("2026-06-30T15:00:00.000Z")), true);
});

test("v12: JST年月・日付helperは23:59:59と00:00:00の境界を共有する", () => {
  const before = new Date("2026-06-30T14:59:59.000Z");
  const after = new Date("2026-06-30T15:00:00.000Z");
  assert.equal(getJstMonthKey(before), "2026-06");
  assert.equal(getJstDateKey(before), "2026-06-30");
  assert.equal(getJstMonthKey(after), "2026-07");
  assert.equal(getJstDateKey(after), "2026-07-01");
});

test("v12: 公式確認日時が不正な手入力は推薦対象外", () => {
  const manual = row({
    rateOffer: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
    manualVerifiedAt: "not-a-date",
    eligibility: "eligible",
  });
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(manual, now), false);
  assert.equal(
    isLatestFetchedCandidate(
      { ...manual, manualVerifiedAt: "2026-06-22T00:00:00.000Z" },
      now,
    ),
    false,
  );
});

test("v12: ユーザー登録銀行は登録済み公式hostと一致する手入力だけ推薦できる", () => {
  const source: BankRateSource = {
    id: "user-added-bank",
    bankName: "ユーザー追加銀行",
    productName: "住宅ローン",
    rateUrl: "https://rates.user-bank.example/refinance",
    insuranceUrl: "https://www.user-bank.example/insurance",
    ratePurpose: "refinance-comparison",
    compareType: "refinance-comparison",
    targetRateType: "variable",
    cancerInsuranceTarget: "要確認",
    note: "ユーザー登録",
  };
  const manual = row({
    bankName: source.bankName,
    rateOffer: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: source.rateUrl,
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    eligibility: "eligible",
  });
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(manual, now, [source]), true);
  assert.equal(
    isLatestFetchedCandidate({ ...manual, manualSourceUrl: "https://evil.example/rate" }, now, [source]),
    false,
  );
});

test("v12: stale API行は当月公式値でも推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(row({ rateStatus: "stale" }), now), false);
});

test("v11: 基準行（rowKind=base）に手入力しても推薦対象外", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const baseRow = row({
    rowKind: "base",
    bankName: "もみじ銀行（現在条件）",
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.5,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "https://momijibank.co.jp/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
    netBenefit: null,
  });
  assert.equal(isLatestFetchedCandidate(baseRow, now), false);
});
