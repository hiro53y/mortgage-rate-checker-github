import type {
  BankComparisonRow,
  LoanProfile,
  RefinanceCostBreakdown,
  RefinanceResult,
} from "../types";
import { calculateRemainingMonths, calculateEqualPrincipalAndInterestPayment } from "./mortgageMath.ts";
import {
  calculateNetBenefit,
  calculatePaybackMonths,
  judgeRefinance,
} from "./refinanceMath.ts";

const BENEFIT_DISPLAY_MONTHS = 144;

export function getRateUsedForCalculation(row: BankComparisonRow): number {
  return row.manualOverrideRate ?? row.autoFetchedRate ?? row.rateUsedForCalculation ?? row.effectiveRate;
}

export function getRateStatus(row: BankComparisonRow): NonNullable<BankComparisonRow["rateStatus"]> {
  if (row.manualOverrideRate !== undefined) {
    return "manual";
  }
  if (row.autoFetchedRate !== undefined) {
    return "auto";
  }
  return row.rateStatus ?? "sample";
}

export function isBaseComparisonRow(row: BankComparisonRow): boolean {
  return row.netBenefit === null || row.bankName.includes("選択中シナリオ");
}

export function recalculateComparisonRow(
  row: BankComparisonRow,
  loan: LoanProfile,
  baseMonthlyPayment: number,
): BankComparisonRow {
  if (isBaseComparisonRow(row)) {
    return {
      ...row,
      rateUsedForCalculation: row.effectiveRate,
      rateStatus: getRateStatus(row),
      monthlyPayment: baseMonthlyPayment,
      netBenefit: null,
      isPriorityCandidate: false,
    };
  }

  const remainingMonths = Math.max(
    calculateRemainingMonths(loan.nextPaymentDate, loan.endDate),
    1,
  );
  const rate = getRateUsedForCalculation(row);
  const monthlyPayment = Math.round(
    calculateEqualPrincipalAndInterestPayment(
      loan.currentBalanceMonthly,
      rate,
      remainingMonths,
    ),
  );
  const netBenefit = Math.round((baseMonthlyPayment - monthlyPayment) * BENEFIT_DISPLAY_MONTHS);

  return {
    ...row,
    effectiveRate: rate,
    rateUsedForCalculation: rate,
    rateStatus: getRateStatus(row),
    monthlyPayment,
    netBenefit,
    isPriorityCandidate: netBenefit >= 250000,
  };
}

export function recalculateComparisonRows(
  rows: BankComparisonRow[],
  loan: LoanProfile,
  baseMonthlyPayment: number,
): BankComparisonRow[] {
  return rows.map((row) => recalculateComparisonRow(row, loan, baseMonthlyPayment));
}

export function buildRefinanceResultFromComparisonRow(
  row: BankComparisonRow,
  currentRemainingTotalPayment: number,
  refinanceCosts: RefinanceCostBreakdown,
  baseMonthlyPayment: number,
  loan: LoanProfile,
): RefinanceResult {
  const remainingMonths = Math.max(
    calculateRemainingMonths(loan.nextPaymentDate, loan.endDate),
    1,
  );
  const monthlyDifference = baseMonthlyPayment - row.monthlyPayment;
  const totalCosts =
    refinanceCosts.loanFee +
    refinanceCosts.registrationFee +
    refinanceCosts.judicialScrivenerFee +
    refinanceCosts.stampDuty +
    refinanceCosts.prepaymentFee;
  const refinanceRemainingTotalPayment = Math.round(
    currentRemainingTotalPayment - monthlyDifference * remainingMonths,
  );
  const netBenefit = calculateNetBenefit(
    currentRemainingTotalPayment,
    refinanceRemainingTotalPayment,
    totalCosts,
  );
  const paybackMonths = calculatePaybackMonths(totalCosts, monthlyDifference);

  return {
    bankRateId: row.id,
    currentRemainingTotalPayment,
    refinanceRemainingTotalPayment,
    refinanceCosts: totalCosts,
    netBenefit,
    monthlyDifference,
    paybackMonths,
    judgement: judgeRefinance(netBenefit, paybackMonths),
  };
}
