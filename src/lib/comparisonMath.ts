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
const PAYMENT_STALENESS_THRESHOLD_YEN = 1000;

export function getRateUsedForCalculation(row: BankComparisonRow): number {
  return row.manualOverrideRate ?? row.autoFetchedRate ?? row.effectiveRate;
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
  return (
    row.netBenefit === null ||
    row.bankName.includes("選択中シナリオ") ||
    row.bankName.includes("現在条件")
  );
}

export function recalculateComparisonRow(
  row: BankComparisonRow,
  loan: LoanProfile,
  baseMonthlyPayment = loan.monthlyPayment,
): BankComparisonRow {
  if (isBaseComparisonRow(row)) {
    return {
      ...row,
      bankName: `${loan.bankName}（現在条件）`,
      effectiveRate: loan.currentRate,
      autoFetchedRate: undefined,
      manualOverrideRate: undefined,
      rateUsedForCalculation: loan.currentRate,
      rateStatus: "sample",
      fetchError: undefined,
      insuranceLevel: loan.cancerInsuranceType,
      monthlyPayment: baseMonthlyPayment,
      netBenefit: null,
      isPriorityCandidate: false,
      note: "現在条件の基準",
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
  baseMonthlyPayment = loan.monthlyPayment,
): BankComparisonRow[] {
  return rows.map((row) => recalculateComparisonRow(row, loan, baseMonthlyPayment));
}

function calculateEqualPeriodicPayment(
  principal: number,
  annualRate: number,
  periods: number,
  paymentsPerYear: number,
): number {
  if (principal <= 0 || periods <= 0) {
    return 0;
  }
  const periodicRate = annualRate / 100 / paymentsPerYear;
  if (periodicRate === 0) {
    return principal / periods;
  }
  const compounded = (1 + periodicRate) ** periods;
  return (principal * periodicRate * compounded) / (compounded - 1);
}

function calculateRemainingBonusPayments(loan: LoanProfile): number {
  const start = new Date(loan.nextPaymentDate);
  const end = new Date(loan.endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start ||
    loan.bonusMonths.length === 0
  ) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    if (loan.bonusMonths.includes(cursor.getMonth() + 1)) {
      count += 1;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}

function calculateTotalRefinanceCosts(refinanceCosts: RefinanceCostBreakdown): number {
  return (
    refinanceCosts.loanFee +
    refinanceCosts.registrationFee +
    refinanceCosts.judicialScrivenerFee +
    refinanceCosts.stampDuty +
    refinanceCosts.prepaymentFee
  );
}

export function calculateCurrentRemainingTotalPayment(loan: LoanProfile): number {
  const remainingMonths = Math.max(
    calculateRemainingMonths(loan.nextPaymentDate, loan.endDate),
    1,
  );
  const remainingBonusPayments = calculateRemainingBonusPayments(loan);
  return Math.round(
    loan.monthlyPayment * remainingMonths + loan.bonusPayment * remainingBonusPayments,
  );
}

export function deriveComparisonRowsFromLoan(
  rows: BankComparisonRow[],
  loan: LoanProfile,
): BankComparisonRow[] {
  return recalculateComparisonRows(rows, loan, loan.monthlyPayment);
}

export function selectBestRefinanceCandidate(
  rows: BankComparisonRow[],
): BankComparisonRow | null {
  return rows
    .filter((row) => !isBaseComparisonRow(row) && row.netBenefit !== null)
    .sort((a, b) => (b.netBenefit ?? -Infinity) - (a.netBenefit ?? -Infinity))[0] ?? null;
}

function getCandidateReviewWarning(row: BankComparisonRow): string | undefined {
  const warnings: string[] = [];
  if (!row.officialCheckedAt) {
    warnings.push("公式確認が未完了");
  }
  if (row.insuranceLevel.includes("要確認") || row.note.includes("要確認")) {
    warnings.push("保障条件に要確認項目あり");
  }
  if (row.fetchError) {
    warnings.push("自動取得値に確認事項あり");
  }
  if (warnings.length === 0) {
    return undefined;
  }
  return `${warnings.join("、")}です。公式ページと手入力補正で条件を確認してください。`;
}

export function buildRefinanceResultFromCurrentLoan(
  row: BankComparisonRow,
  refinanceCosts: RefinanceCostBreakdown,
  loan: LoanProfile,
): RefinanceResult {
  const remainingMonths = Math.max(
    calculateRemainingMonths(loan.nextPaymentDate, loan.endDate),
    1,
  );
  const currentRemainingTotalPayment = calculateCurrentRemainingTotalPayment(loan);
  const monthlyDifference = loan.monthlyPayment - row.monthlyPayment;
  const totalCosts = calculateTotalRefinanceCosts(refinanceCosts);
  const refinanceRemainingTotalPayment = Math.round(
    currentRemainingTotalPayment - monthlyDifference * remainingMonths,
  );
  const netBenefit = calculateNetBenefit(
    currentRemainingTotalPayment,
    refinanceRemainingTotalPayment,
    totalCosts,
  );
  const paybackMonths = calculatePaybackMonths(totalCosts, monthlyDifference);
  const candidateReviewWarning = getCandidateReviewWarning(row);

  return {
    bankRateId: row.id,
    candidateBankName: row.bankName,
    candidateRate: getRateUsedForCalculation(row),
    baseMonthlyPayment: loan.monthlyPayment,
    candidateNeedsReview: Boolean(candidateReviewWarning),
    candidateReviewWarning,
    currentRemainingTotalPayment,
    refinanceRemainingTotalPayment,
    refinanceCosts: totalCosts,
    netBenefit,
    monthlyDifference,
    paybackMonths,
    judgement: judgeRefinance(netBenefit, paybackMonths),
  };
}

export function buildRefinanceResultFromComparisonRow(
  row: BankComparisonRow,
  _currentRemainingTotalPayment: number,
  refinanceCosts: RefinanceCostBreakdown,
  _baseMonthlyPayment: number,
  loan: LoanProfile,
): RefinanceResult {
  return buildRefinanceResultFromCurrentLoan(row, refinanceCosts, loan);
}

export function getLoanPaymentStalenessWarning(loan: LoanProfile): string | null {
  const remainingMonths = calculateRemainingMonths(loan.nextPaymentDate, loan.endDate);
  if (remainingMonths <= 0) {
    return null;
  }

  const expectedMonthlyPayment = Math.round(
    calculateEqualPrincipalAndInterestPayment(
      loan.currentBalanceMonthly,
      loan.currentRate,
      remainingMonths,
    ),
  );
  const remainingBonusPayments = calculateRemainingBonusPayments(loan);
  const expectedBonusPayment = Math.round(
    calculateEqualPeriodicPayment(
      loan.currentBalanceBonus,
      loan.currentRate,
      remainingBonusPayments,
      2,
    ),
  );

  const monthlyDiff = Math.abs(expectedMonthlyPayment - loan.monthlyPayment);
  const bonusDiff =
    remainingBonusPayments > 0 ? Math.abs(expectedBonusPayment - loan.bonusPayment) : 0;
  if (
    monthlyDiff <= PAYMENT_STALENESS_THRESHOLD_YEN &&
    bonusDiff <= PAYMENT_STALENESS_THRESHOLD_YEN
  ) {
    return null;
  }

  const warnings = [`現在適用金利 ${loan.currentRate.toFixed(3)}% から逆算した概算返済額と、登録済み返済額に差があります。`];
  if (monthlyDiff > PAYMENT_STALENESS_THRESHOLD_YEN) {
    warnings.push(
      `毎月返済額は概算 ${Math.round(expectedMonthlyPayment).toLocaleString("ja-JP")}円に対して登録 ${loan.monthlyPayment.toLocaleString("ja-JP")}円です。`,
    );
  }
  if (bonusDiff > PAYMENT_STALENESS_THRESHOLD_YEN) {
    warnings.push(
      `ボーナス返済額は概算 ${Math.round(expectedBonusPayment).toLocaleString("ja-JP")}円に対して登録 ${loan.bonusPayment.toLocaleString("ja-JP")}円です。`,
    );
  }
  warnings.push("銀行通知額が確定している場合は、マイローン設定で返済額を手入力してください。");
  return warnings.join("");
}
