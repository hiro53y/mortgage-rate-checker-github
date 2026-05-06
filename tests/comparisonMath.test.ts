import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRateUsedForCalculation,
  recalculateComparisonRow,
} from "../src/lib/comparisonMath.ts";
import type { BankComparisonRow, LoanProfile } from "../src/types.ts";

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
  });

  it("recalculates monthly payment and display benefit", () => {
    const recalculated = recalculateComparisonRow(
      { ...row, manualOverrideRate: 0.89, autoFetchedRate: undefined },
      loan,
      90916,
    );
    assert.equal(recalculated.rateUsedForCalculation, 0.89);
    assert.ok(recalculated.monthlyPayment > 0);
    assert.ok(recalculated.netBenefit !== null);
  });
});
