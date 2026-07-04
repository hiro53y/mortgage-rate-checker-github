import assert from "node:assert/strict";
import test from "node:test";
import { defaultLoanProfile } from "../src/lib/sampleData.ts";
import {
  INSURANCE_ADDON_ESTIMATE,
  getEstimatedRate,
  getLoanPaymentBasisStatus,
  isLatestFetchedCandidate,
  recalculateComparisonRow,
  recalculateComparisonRows,
} from "../src/lib/comparisonMath.ts";
import type {
  BankComparisonRow,
  BankRateSource,
  LoanProfile,
  RateOffer,
} from "../src/types.ts";

const baseOffer: RateOffer = {
  schemaVersion: 10,
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

const sampleSource: BankRateSource = {
  id: "netbk",
  bankName: "住信SBIネット銀行",
  productName: "WEB申込コース",
  rateUrl: "https://example.com/",
  insuranceUrl: "https://example.com/",
  ratePurpose: "refinance-comparison",
  compareType: "refinance-comparison",
  targetRateType: "variable",
  cancerInsuranceTarget: "団信プラン別上乗せ要確認",
  note: "test",
  expectedVariableRateRange: [0.4, 2.5],
};

function row(overrides: Partial<BankComparisonRow> = {}): BankComparisonRow {
  return {
    id: "candidate",
    rowKind: "candidate",
    bankName: "住信SBIネット銀行",
    effectiveRate: 1,
    insuranceLevel: "がん100%",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
    ...overrides,
  };
}

function loan(overrides: Partial<LoanProfile> = {}): LoanProfile {
  return {
    ...defaultLoanProfile,
    borrowerBirthDate: "1980-01-01",
    estimatedPropertyValue: 60_000_000,
    desiredInsuranceCoverage: "cancer100",
    nextPaymentDate: "2026-06-27",
    endDate: "2066-09-27",
    ...overrides,
  };
}

// ===== 第1優先: 公式条件適合金利 =====
test("第1優先：公式条件適合金利が渡されていればそのまま返す", () => {
  const result = getEstimatedRate(row(), sampleSource, 1.1);
  assert.equal(result.tier, "official-condition-matched");
  assert.equal(result.rate, 1.1);
  assert.equal(result.label, "条件適合");
});

// ===== 第2優先: aggregator 由来の参考値 =====
test("第2優先：aggregator 由来の advertisedMinRate を参考値として返す", () => {
  const offer: RateOffer = {
    ...baseOffer,
    sourceKind: "aggregator",
    advertisedMinRate: 0.97,
  };
  const result = getEstimatedRate(row({ rateOffer: offer }), sampleSource, undefined);
  assert.equal(result.tier, "aggregator-reference");
  assert.equal(result.rate, 0.97);
  assert.match(result.label, /参考値/);
});

// ===== 第3優先: 広告下限 + 0.3% =====
test("第3優先：広告下限 + 0.3% の推定値を返す（公式HTML系で団信不明）", () => {
  const offer: RateOffer = {
    ...baseOffer,
    sourceKind: "official-html",
    advertisedMinRate: 0.62,
  };
  const result = getEstimatedRate(row({ rateOffer: offer }), sampleSource, undefined);
  assert.equal(result.tier, "estimated-with-insurance");
  // 0.62 + 0.3 = 0.92
  assert.equal(result.rate, 0.92);
  assert.match(result.label, /推定値/);
  assert.match(result.label, /団信/);
});

test("INSURANCE_ADDON_ESTIMATE は +0.3% である", () => {
  assert.equal(INSURANCE_ADDON_ESTIMATE, 0.3);
});

// ===== 第4優先: expectedVariableRateRange 中央値 =====
test("第4優先：広告下限が無い場合 expectedVariableRateRange の中央値を返す", () => {
  const result = getEstimatedRate(row(), sampleSource, undefined);
  assert.equal(result.tier, "estimated-midrange");
  // (0.4 + 2.5) / 2 = 1.45
  assert.equal(result.rate, 1.45);
  assert.match(result.label, /中央レンジ/);
});

test("第4優先：source が無くても落ちずに effectiveRate を返す", () => {
  const result = getEstimatedRate(row({ effectiveRate: 1.234 }), undefined, undefined);
  assert.equal(result.tier, "estimated-midrange");
  assert.equal(result.rate, 1.234);
});

// ===== 推薦対象外の検証 =====
test("第3優先（推定値・団信込み）は推薦対象外", () => {
  const candidateRow: BankComparisonRow = {
    ...row(),
    rateOffer: { ...baseOffer, sourceKind: "official-html" },
    conditionMatchedRate: 0.92,
    eligibility: "eligible",
    estimationTier: "estimated-with-insurance",
    estimationLabel: "推定値（広告下限+団信0.3%）",
  };
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(candidateRow, now), false);
});

test("第4優先（推定値・中央レンジ）は推薦対象外", () => {
  const candidateRow: BankComparisonRow = {
    ...row(),
    conditionMatchedRate: 1.45,
    eligibility: "eligible",
    estimationTier: "estimated-midrange",
    estimationLabel: "推定値（業界中央レンジ）",
  };
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(candidateRow, now), false);
});

test("第2優先（参考値・aggregator）も推薦対象外", () => {
  const candidateRow: BankComparisonRow = {
    ...row(),
    rateOffer: { ...baseOffer, sourceKind: "aggregator" },
    conditionMatchedRate: 0.95,
    eligibility: "eligible",
    estimationTier: "aggregator-reference",
    estimationLabel: "参考値（まとめサイト）",
  };
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(candidateRow, now), false);
});

test("第1優先（公式条件適合）は推薦対象", () => {
  const candidateRow: BankComparisonRow = {
    ...row(),
    rateOffer: baseOffer,
    conditionMatchedRate: 1.1,
    eligibility: "eligible",
    estimationTier: "official-condition-matched",
    estimationLabel: "条件適合",
  };
  const now = new Date("2026-06-21T00:00:00+09:00");
  assert.equal(isLatestFetchedCandidate(candidateRow, now), true);
});

// ===== recalculateComparisonRow 経由で必ず conditionMatchedRate が埋まる =====
test("recalculateComparisonRow：rateOffer無しでも conditionMatchedRate が undefined にならない", () => {
  const candidateRow: BankComparisonRow = {
    id: "candidate-without-offer",
    rowKind: "candidate",
    bankName: "三菱UFJ銀行",
    effectiveRate: 0.995,
    insuranceLevel: "要確認",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
  };
  const result = recalculateComparisonRow(candidateRow, loan());
  assert.notEqual(result.conditionMatchedRate, undefined);
  assert.notEqual(result.estimationTier, undefined);
  // expectedVariableRateRange [0.4, 2.5] -> (0.4+2.5)/2 = 1.45
  assert.equal(result.estimationTier, "estimated-midrange");
  assert.equal(result.conditionMatchedRate, 1.45);
});

test("recalculateComparisonRow：advertisedMinRate のみある場合は +0.3% 推定", () => {
  const candidateRow: BankComparisonRow = {
    id: "candidate-with-min-only",
    rowKind: "candidate",
    bankName: "三菱UFJ銀行",
    effectiveRate: 0.995,
    advertisedMinRate: 0.62,
    rateOffer: {
      ...baseOffer,
      bankRateSourceId: "mufg",
      bankName: "三菱UFJ銀行",
      sourceKind: "official-html",
      advertisedMinRate: 0.62,
      rateOptions: [], // 条件適合金利が出ない状態
    },
    insuranceLevel: "要確認",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
  };
  const result = recalculateComparisonRow(candidateRow, loan());
  assert.equal(result.estimationTier, "estimated-with-insurance");
  // 0.62 + 0.3 = 0.92
  assert.equal(result.conditionMatchedRate, 0.92);
});

// ===== v11: 手入力推薦の end-to-end =====
test("v11: recalculateComparisonRow で 手入力+公式確認 → eligibility=eligible & tier=official-condition-matched", () => {
  const candidateRow: BankComparisonRow = {
    id: "candidate-manual-verified",
    rowKind: "candidate",
    bankName: "中国銀行",
    effectiveRate: 0.995,
    insuranceLevel: "要確認",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
    manualOverrideRate: 0.55,
    manualApplicableMonth: "2026-05",
    manualSourceUrl: "https://www.chugin.co.jp/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
  };
  const result = recalculateComparisonRow(candidateRow, loan());
  assert.equal(result.eligibility, "eligible");
  assert.equal(result.estimationTier, "official-condition-matched");
  assert.equal(result.estimationLabel, "公式確認済み手入力");
  assert.equal(result.sourceKind, "manual-verified");
  assert.equal(result.confidence, "verified");
});

test("v11: recalculateComparisonRows で 手入力公式確認済み行が最低金利なら推薦に選ばれる", () => {
  const officialRow: BankComparisonRow = {
    id: "official-row",
    rowKind: "candidate",
    bankName: "住信SBIネット銀行",
    effectiveRate: 1.1,
    rateOffer: baseOffer,
    insuranceLevel: "がん100%",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
  };
  const manualRow: BankComparisonRow = {
    id: "manual-row",
    rowKind: "candidate",
    bankName: "中国銀行",
    effectiveRate: 0.995,
    insuranceLevel: "がん100%",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
    manualOverrideRate: 0.45,
    manualApplicableMonth: "2026-06",
    manualSourceUrl: "https://www.chugin.co.jp/rate",
    manualVerifiedAt: "2026-06-21T00:00:00.000Z",
  };
  const baseRow: BankComparisonRow = {
    id: "base-row",
    rowKind: "base",
    bankName: "もみじ銀行（現在条件）",
    effectiveRate: 0.5,
    insuranceLevel: "がん100%",
    monthlyPayment: 0,
    netBenefit: null,
    isPriorityCandidate: false,
    note: "test",
  };
  const results = recalculateComparisonRows([baseRow, officialRow, manualRow], loan());
  const manualResult = results.find((r) => r.id === "manual-row");
  const officialResult = results.find((r) => r.id === "official-row");
  const baseResult = results.find((r) => r.id === "base-row");
  assert.equal(manualResult?.isPriorityCandidate, true);
  assert.equal(officialResult?.isPriorityCandidate, false);
  assert.equal(baseResult?.isPriorityCandidate, false);
});

test("v11: 手入力のみ（公式確認なし）は推薦に選ばれず、公式条件適合行が推薦になる", () => {
  const officialRow: BankComparisonRow = {
    id: "official-row",
    rowKind: "candidate",
    bankName: "住信SBIネット銀行",
    effectiveRate: 1.1,
    rateOffer: baseOffer,
    insuranceLevel: "がん100%",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
  };
  const unverifiedManualRow: BankComparisonRow = {
    id: "manual-row-unverified",
    rowKind: "candidate",
    bankName: "中国銀行",
    effectiveRate: 0.995,
    insuranceLevel: "がん100%",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
    manualOverrideRate: 0.45,
  };
  // v12: 基準日をfixtureの適用年月（2026-06）に固定する。
  const fixedLoan = loan({ desiredInsuranceCoverage: "standard" });
  const results = recalculateComparisonRows(
    [officialRow, unverifiedManualRow],
    fixedLoan,
    getLoanPaymentBasisStatus(fixedLoan, "2026-06-21"),
  );
  const manualResult = results.find((r) => r.id === "manual-row-unverified");
  const officialResult = results.find((r) => r.id === "official-row");
  assert.equal(manualResult?.isPriorityCandidate, false);
  assert.equal(officialResult?.isPriorityCandidate, true);
});

test("recalculateComparisonRow：算定不可状態でも月返済額が計算される", () => {
  const candidateRow: BankComparisonRow = {
    id: "candidate-without-offer",
    rowKind: "candidate",
    bankName: "中国銀行",
    effectiveRate: 0.995,
    insuranceLevel: "要確認",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "test",
  };
  const result = recalculateComparisonRow(candidateRow, loan());
  assert.ok(result.monthlyPayment > 0, "月返済額が必ず計算される");
  assert.ok(result.remainingTotalPayment !== undefined);
});
