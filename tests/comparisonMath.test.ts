import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRefinanceResultFromCurrentLoan,
  deriveComparisonRowsFromLoan,
  getLoanPaymentBasisStatus,
  getLoanPaymentStalenessWarning,
  getRateUsedForCalculation,
  recalculateComparisonRow,
  selectBestRefinanceCandidate,
} from "../src/lib/comparisonMath.ts";
import { ensureComparisonRowsIncludeBankSources } from "../src/lib/sampleData.ts";
import type { BankComparisonRow, LoanProfile, RateOffer, RefinanceCostBreakdown } from "../src/types.ts";

function makeOffer(id: string, bankName: string, rate: number): RateOffer {
  return {
    schemaVersion: 1,
    bankRateSourceId: id,
    bankName,
    productName: "住宅ローン",
    loanPurpose: "refinance",
    rateType: "variable",
    advertisedMinRate: rate,
    applicableMonth: "2026-06",
    fetchedAt: "2026-06-13T06:47:00.000Z",
    sourceUrl: `https://example.com/${id}`,
    sourceKind: "official-api",
    confidence: "verified",
    eligibility: "unknown",
    conditionsSummary: "test",
    adapterId: `${id}-fixture`,
    rateOptions: [{ id: "normal", label: "通常", rate }],
  };
}

const row: BankComparisonRow = {
  id: "test-bank",
  bankName: "テスト銀行",
  effectiveRate: 1.0,
  autoFetchedRate: 0.9,
  manualOverrideRate: 0.85,
  insuranceLevel: "要確認",
  monthlyPayment: 90000,
  netBenefit: 100000,
  isPriorityCandidate: false,
  note: "test",
};

const loan: LoanProfile = {
  id: "loan-test",
  productName: "test",
  branchName: "test",
  bankName: "test",
  principal: 46200000,
  principalMonthly: 38200000,
  principalBonus: 8000000,
  startDate: "2023-09-22",
  endDate: "2066-09-27",
  currentBalance: 43811480,
  currentBalanceMonthly: 36225350,
  currentBalanceBonus: 7586130,
  currentRate: 0.755,
  repaymentType: "元利均等",
  bonusMonths: [6, 12],
  monthlyPayment: 86689,
  bonusPayment: 108879,
  nextPaymentDate: "2026-05-27",
  nextPaymentAmount: 86689,
  cancerInsuranceType: "がん100%込み",
  desiredInsuranceCoverage: "standard",
  borrowerBirthDate: "1980-01-01",
  estimatedPropertyValue: 60_000_000,
  updatedAt: "2026-05-06T00:00:00.000+09:00",
};

const refinanceCosts: RefinanceCostBreakdown = {
  loanFee: 330000,
  registrationFee: 220000,
  judicialScrivenerFee: 150000,
  stampDuty: 60000,
  prepaymentFee: 60000,
};

describe("comparisonMath", () => {
  it("prioritizes manual override over auto and sample rates", () => {
    assert.equal(getRateUsedForCalculation(row), 0.85);
    assert.equal(getRateUsedForCalculation({ ...row, manualOverrideRate: undefined }), 0.9);
    assert.equal(
      getRateUsedForCalculation({
        ...row,
        manualOverrideRate: undefined,
        autoFetchedRate: undefined,
      }),
      1.0,
    );
    assert.equal(
      getRateUsedForCalculation({
        ...row,
        manualOverrideRate: undefined,
        autoFetchedRate: undefined,
        rateUsedForCalculation: 0.7,
      }),
      1.0,
    );
  });

  it("recalculates monthly payment and display benefit", () => {
    const recalculated = recalculateComparisonRow(
      { ...row, manualOverrideRate: 0.89, autoFetchedRate: undefined },
      loan,
      getLoanPaymentBasisStatus(loan, "2026-06-13"),
    );
    assert.equal(recalculated.rateUsedForCalculation, 0.89);
    assert.ok(recalculated.monthlyPayment > 0);
    assert.ok(recalculated.netBenefit !== null);
  });

  it("derives comparison rows from the current loan and selects the best candidate", () => {
    const changedLoan = {
      ...loan,
      currentRate: 1.005,
      monthlyPayment: 90916,
      bonusPayment: 114283,
    };
    const rows = deriveComparisonRowsFromLoan(
      [
        {
          ...row,
          id: "base",
          bankName: "もみじ銀行（選択中シナリオ）",
          effectiveRate: 1.005,
          autoFetchedRate: undefined,
          manualOverrideRate: undefined,
          monthlyPayment: 90916,
          netBenefit: null,
        },
        {
          ...row,
          id: "netbk-row",
          bankName: "住信SBIネット銀行",
          effectiveRate: 0.89,
          autoFetchedRate: undefined,
          manualOverrideRate: undefined,
          insuranceLevel: "がん50%",
          rateStatus: "failed",
          note: "保障条件は公式ページで要確認",
        },
        {
          ...row,
          id: "mufg-row",
          bankName: "三菱UFJ銀行",
          effectiveRate: 1.2,
          autoFetchedRate: 0.995,
          rateOffer: makeOffer("mufg", "三菱UFJ銀行", 0.995),
          manualOverrideRate: undefined,
          lastFetchedAt: "2026-06-13T06:47:00.000Z",
          insuranceLevel: "疾病保障プラン要確認",
          note: "公式ページから金利候補を自動抽出",
        },
        {
          ...row,
          id: "chugin-row",
          bankName: "中国銀行",
          effectiveRate: 1.2,
          autoFetchedRate: 1.1,
          rateOffer: makeOffer("chugin", "中国銀行", 1.1),
          manualOverrideRate: undefined,
          lastFetchedAt: "2026-06-13T06:47:00.000Z",
          insuranceLevel: "がん団信上乗せ条件は要確認",
          note: "公式ページから金利候補を自動抽出",
        },
      ],
      changedLoan,
      "2026-06-13",
    );

    assert.equal(rows[0].bankName, "test（現在条件）");
    assert.equal(rows[0].rowKind, "base");
    assert.equal(rows[0].rateUsedForCalculation, 1.005);
    assert.equal(rows[0].monthlyPayment, 90916);
    assert.equal(rows[0].bonusPayment, 114283);

    const candidate = selectBestRefinanceCandidate(rows, undefined, undefined, "2026-06-13");
    assert.ok(candidate);
    assert.equal(candidate.id, "mufg-row");
    assert.equal(candidate.rowKind, "candidate");
    assert.ok((candidate.bonusPayment ?? 0) > 0);
    assert.equal(rows.find((candidateRow) => candidateRow.id === "netbk-row")?.isPriorityCandidate, false);
    assert.equal(rows.find((candidateRow) => candidateRow.id === "mufg-row")?.isPriorityCandidate, true);

    const result = buildRefinanceResultFromCurrentLoan(
      candidate,
      refinanceCosts,
      changedLoan,
      "2026-06-13",
    );
    assert.equal(result.candidateBankName, "三菱UFJ銀行");
    assert.equal(result.candidateRate, 0.995);
    assert.equal(result.baseMonthlyPayment, 90916);
    assert.equal(result.baseBonusPayment, 114283);
    assert.equal(result.candidateMonthlyPayment, candidate.monthlyPayment);
    assert.equal(result.candidateBonusPayment, candidate.bonusPayment);
    assert.equal(result.totalPaymentDifference, result.currentRemainingTotalPayment - result.refinanceRemainingTotalPayment);
    assert.equal(result.netBenefit, result.totalPaymentDifference - result.refinanceCosts);
    assert.equal(result.candidateNeedsReview, true);
    assert.ok(Number.isFinite(result.netBenefit));
  });

  it("does not select a refinance candidate when no bank has a latest auto-fetched rate", () => {
    const rows = deriveComparisonRowsFromLoan(
      [
        {
          ...row,
          id: "base",
          bankName: "もみじ銀行（現在条件）",
          autoFetchedRate: undefined,
          manualOverrideRate: undefined,
          monthlyPayment: 90916,
          netBenefit: null,
        },
        {
          ...row,
          id: "netbk-row",
          bankName: "住信SBIネット銀行",
          effectiveRate: 0.89,
          autoFetchedRate: undefined,
          manualOverrideRate: undefined,
          rateStatus: "failed",
          lastFetchedAt: "2026-06-13T06:47:00.000Z",
          fetchError: "金利候補を自動抽出できませんでした。",
        },
        {
          ...row,
          id: "manual-only-row",
          bankName: "手入力だけの銀行",
          effectiveRate: 1.2,
          autoFetchedRate: undefined,
          manualOverrideRate: 0.87,
          rateStatus: "manual",
          lastManualUpdatedAt: "2026-06-13T06:47:00.000Z",
        },
      ],
      {
        ...loan,
        currentRate: 1.005,
        monthlyPayment: 90916,
        bonusPayment: 114283,
      },
      "2026-06-13",
    );

    assert.equal(selectBestRefinanceCandidate(rows), null);
    assert.equal(rows.some((candidateRow) => candidateRow.isPriorityCandidate), false);
  });

  it("warns when the current rate changed but registered payments still look stale", () => {
    const paymentBasis = getLoanPaymentBasisStatus(
      {
        ...loan,
        currentRate: 1.005,
      },
      "2026-06-13",
    );
    assert.equal(paymentBasis.effectiveNextPaymentDate, "2026-06-27");
    assert.equal(paymentBasis.remainingMonths, 484);
    assert.equal(paymentBasis.baselineMonthlyPayment, 91068);
    assert.equal(paymentBasis.baselineBonusPayment, 114237);

    const warning = getLoanPaymentStalenessWarning({
      ...loan,
      currentRate: 1.005,
    });
    assert.match(warning ?? "", /登録済み返済額/);
    assert.match(warning ?? "", /概算額/);
    assert.match(warning ?? "", /次回返済日/);
  });

  it("selects the lowest latest auto-fetched rate before benefit size", () => {
    const changedLoan = {
      ...loan,
      currentRate: 1.005,
      monthlyPayment: 91068,
      bonusPayment: 114237,
    };
    const selected = selectBestRefinanceCandidate(
      [
        {
          ...row,
          id: "lower-rate",
          rowKind: "candidate",
          bankName: "低金利銀行",
          effectiveRate: 1.2,
          autoFetchedRate: 0.92,
          conditionMatchedRate: 0.92,
          rateOffer: makeOffer("lower", "低金利銀行", 0.92),
          sourceKind: "official-api",
          confidence: "verified",
          eligibility: "eligible",
          applicableMonth: "2026-06",
          manualOverrideRate: undefined,
          lastFetchedAt: "2026-06-13T06:47:00.000Z",
          monthlyPayment: 88000,
          bonusPayment: 160000,
          netBenefit: -400000,
        },
        {
          ...row,
          id: "higher-rate",
          rowKind: "candidate",
          bankName: "総額差が大きい銀行",
          effectiveRate: 1.2,
          autoFetchedRate: 0.99,
          conditionMatchedRate: 0.99,
          rateOffer: makeOffer("higher", "総額差が大きい銀行", 0.99),
          sourceKind: "official-api",
          confidence: "verified",
          eligibility: "eligible",
          applicableMonth: "2026-06",
          manualOverrideRate: undefined,
          lastFetchedAt: "2026-06-13T06:47:00.000Z",
          monthlyPayment: 90000,
          bonusPayment: 100000,
          netBenefit: 800000,
        },
      ],
      refinanceCosts,
      changedLoan,
      "2026-06-13",
    );

    assert.equal(selected?.id, "lower-rate");
  });

  it("adds ranking candidate banks that are missing from saved comparison rows", () => {
    const rows = ensureComparisonRowsIncludeBankSources(
      [
        {
          ...row,
          id: "base",
          bankName: "もみじ銀行（現在条件）",
          autoFetchedRate: undefined,
          manualOverrideRate: undefined,
          netBenefit: null,
        },
      ],
      [
        {
          id: "momiji",
          bankName: "もみじ銀行",
          productName: "test",
          rateUrl: "https://example.com/momiji",
          insuranceUrl: "https://example.com/momiji",
          ratePurpose: "current",
          compareType: "current",
          targetRateType: "variable",
          cancerInsuranceTarget: "がん100%",
          note: "base",
        },
        {
          id: "paypay",
          bankName: "PayPay銀行",
          productName: "test",
          rateUrl: "https://example.com/paypay",
          insuranceUrl: "https://example.com/paypay",
          ratePurpose: "refinance",
          compareType: "refinance",
          targetRateType: "variable",
          cancerInsuranceTarget: "要確認",
          note: "ranking",
        },
        {
          id: "sbishinsei",
          bankName: "SBI新生銀行",
          productName: "test",
          rateUrl: "https://example.com/sbishinsei",
          insuranceUrl: "https://example.com/sbishinsei",
          ratePurpose: "refinance",
          compareType: "refinance",
          targetRateType: "variable",
          cancerInsuranceTarget: "要確認",
          note: "ranking",
        },
      ],
    );

    assert.ok(rows.some((candidateRow) => candidateRow.bankName === "PayPay銀行"));
    assert.ok(rows.some((candidateRow) => candidateRow.bankName === "SBI新生銀行"));
    assert.equal(rows.filter((candidateRow) => candidateRow.bankName.includes("もみじ")).length, 1);
  });
});
// v12: 日付固定（2026-06-13）で候補選定の回帰を防ぐ。
