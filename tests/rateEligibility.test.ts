import assert from "node:assert/strict";
import test from "node:test";
import { defaultLoanProfile } from "../src/lib/sampleData.ts";
import {
  evaluateRateOfferForLoan,
} from "../src/lib/rateEligibility.ts";
import { isLatestFetchedCandidate } from "../src/lib/comparisonMath.ts";
import type { BankComparisonRow, LoanProfile, RateOffer } from "../src/types.ts";

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
    bankName: "候補銀行",
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
    manualSourceUrl: "https://bank.example/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), true);
  assert.equal(isLatestFetchedCandidate({ ...manual, manualVerifiedAt: undefined }, now), false);
});

// ===== v11: 手入力推薦の緩和ロジック =====
test("v11: 手入力+公式確認+applicableMonth 当月 → 推薦対象", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "https://bank.example/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), true);
});

test("v11: 手入力+公式確認+applicableMonth 前月 → 推薦対象（緩和仕様）", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: "2026-05",
    manualSourceUrl: "https://bank.example/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), true);
});

test("v11: 手入力+公式確認+applicableMonth 未入力 → 推薦対象", () => {
  const now = new Date("2026-06-21T00:00:00+09:00");
  const manual = row({
    rateOffer: undefined,
    conditionMatchedRate: undefined,
    manualOverrideRate: 0.82,
    manualApplicableMonth: undefined,
    manualSourceUrl: "https://bank.example/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
    sourceKind: "manual-verified",
  });
  assert.equal(isLatestFetchedCandidate(manual, now), true);
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
