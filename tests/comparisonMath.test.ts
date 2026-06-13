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
import type { BankComparisonRow, LoanProfile, RefinanceCostBreakdown } from "../src/types.ts";

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
          note: "保障条件は公式ページで要確認",
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

    const candidate = selectBestRefinanceCandidate(rows);
    assert.ok(candidate);
    assert.equal(candidate.id, "netbk-row");
    assert.equal(candidate.rowKind, "candidate");
    assert.ok((candidate.bonusPayment ?? 0) > 0);

    const result = buildRefinanceResultFromCurrentLoan(
      candidate,
      refinanceCosts,
      changedLoan,
      "2026-06-13",
    );
    assert.equal(result.candidateBankName, "住信SBIネット銀行");
    assert.equal(result.candidateRate, 0.89);
    assert.equal(result.baseMonthlyPayment, 90916);
    assert.equal(result.baseBonusPayment, 114283);
    assert.equal(result.candidateMonthlyPayment, candidate.monthlyPayment);
    assert.equal(result.candidateBonusPayment, candidate.bonusPayment);
    assert.equal(result.totalPaymentDifference, result.currentRemainingTotalPayment - result.refinanceRemainingTotalPayment);
    assert.equal(result.netBenefit, result.totalPaymentDifference - result.refinanceCosts);
    assert.equal(result.candidateNeedsReview, true);
    assert.ok(result.netBenefit > 0);
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

  it("selects the refinance candidate by full net benefit, not monthly-only display benefit", () => {
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
          id: "monthly-only",
          rowKind: "candidate",
          bankName: "月返済だけ安い銀行",
          monthlyPayment: 88000,
          bonusPayment: 160000,
          netBenefit: 400000,
        },
        {
          ...row,
          id: "full-benefit",
          rowKind: "candidate",
          bankName: "総額で有利な銀行",
          monthlyPayment: 90000,
          bonusPayment: 100000,
          netBenefit: 150000,
        },
      ],
      refinanceCosts,
      changedLoan,
      "2026-06-13",
    );

    assert.equal(selected?.id, "full-benefit");
  });
});
