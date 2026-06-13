import type {
  BankComparisonRow,
  LoanProfile,
  RefinanceCostBreakdown,
  RefinanceResult,
} from "../types";
import {
  calculateEqualPeriodicPayment,
  calculateEqualPrincipalAndInterestPayment,
  calculateRemainingBonusPayments,
  calculateRemainingMonths,
} from "./mortgageMath.ts";
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
    row.rowKind === "base" ||
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
  const remainingMonths = Math.max(
    calculateRemainingMonths(loan.nextPaymentDate, loan.endDate),
    1,
  );
  const remainingBonusPayments = calculateRemainingBonusPayments(
    loan.nextPaymentDate,
    loan.endDate,
    loan.bonusMonths,
  );
  if (isBaseComparisonRow(row)) {
    return {
      ...row,
      rowKind: "base",
      bankName: `${loan.bankName}（現在条件）`,
      effectiveRate: loan.currentRate,
      autoFetchedRate: undefined,
      manualOverrideRate: undefined,
      rateUsedForCalculation: loan.currentRate,
      rateStatus: "sample",
      fetchError: undefined,
      insuranceLevel: loan.cancerInsuranceType,
      monthlyPayment: baseMonthlyPayment,
      bonusPayment: loan.bonusPayment,
      remainingTotalPayment: calculateCurrentRemainingTotalPayment(loan),
      netBenefit: null,
      isPriorityCandidate: false,
      note: "現在条件の基準",
    };
  }

  const rate = getRateUsedForCalculation(row);
  const monthlyPayment = Math.round(
    calculateEqualPrincipalAndInterestPayment(
      loan.currentBalanceMonthly,
      rate,
      remainingMonths,
    ),
  );
  const bonusPayment = Math.round(
    calculateEqualPeriodicPayment(
      loan.currentBalanceBonus,
      rate,
      remainingBonusPayments,
      2,
    ),
  );
  const remainingTotalPayment = Math.round(
    monthlyPayment * remainingMonths + bonusPayment * remainingBonusPayments,
  );
  const netBenefit = Math.round((baseMonthlyPayment - monthlyPayment) * BENEFIT_DISPLAY_MONTHS);

  return {
    ...row,
    rowKind: "candidate",
    rateUsedForCalculation: rate,
    rateStatus: getRateStatus(row),
    monthlyPayment,
    bonusPayment,
    remainingTotalPayment,
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
  const remainingBonusPayments = calculateRemainingBonusPayments(
    loan.nextPaymentDate,
    loan.endDate,
    loan.bonusMonths,
  );
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
  const remainingBonusPayments = calculateRemainingBonusPayments(
    loan.nextPaymentDate,
    loan.endDate,
    loan.bonusMonths,
  );
  const currentRemainingTotalPayment = calculateCurrentRemainingTotalPayment(loan);
  const monthlyDifference = loan.monthlyPayment - row.monthlyPayment;
  const candidateBonusPayment =
    row.bonusPayment ??
    Math.round(
      calculateEqualPeriodicPayment(
        loan.currentBalanceBonus,
        getRateUsedForCalculation(row),
        remainingBonusPayments,
        2,
      ),
    );
  const bonusDifference = loan.bonusPayment - candidateBonusPayment;
  const totalCosts = calculateTotalRefinanceCosts(refinanceCosts);
  const refinanceRemainingTotalPayment = Math.round(
    row.monthlyPayment * remainingMonths + candidateBonusPayment * remainingBonusPayments,
  );
  const totalPaymentDifference =
    currentRemainingTotalPayment - refinanceRemainingTotalPayment;
  const netBenefit = calculateNetBenefit(
    currentRemainingTotalPayment,
    refinanceRemainingTotalPayment,
    totalCosts,
  );
  const averageMonthlyDifference = (monthlyDifference * 12 + bonusDifference * 2) / 12;
  const paybackMonths = calculatePaybackMonths(totalCosts, averageMonthlyDifference);
  const candidateReviewWarning = getCandidateReviewWarning(row);

  return {
    bankRateId: row.id,
    candidateBankName: row.bankName,
    candidateRate: getRateUsedForCalculation(row),
    baseMonthlyPayment: loan.monthlyPayment,
    baseBonusPayment: loan.bonusPayment,
    candidateMonthlyPayment: row.monthlyPayment,
    candidateBonusPayment,
    candidateNeedsReview: Boolean(candidateReviewWarning),
    candidateReviewWarning,
    currentRemainingTotalPayment,
    refinanceRemainingTotalPayment,
    refinanceCosts: totalCosts,
    totalPaymentDifference,
    netBenefit,
    monthlyDifference,
    bonusDifference,
    averageMonthlyDifference,
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
  const remainingBonusPayments = calculateRemainingBonusPayments(
    loan.nextPaymentDate,
    loan.endDate,
    loan.bonusMonths,
  );
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
