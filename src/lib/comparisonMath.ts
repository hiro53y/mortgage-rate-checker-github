import type {
  BankComparisonRow,
  LoanPaymentBasisStatus,
  LoanProfile,
  RefinanceCostBreakdown,
  RefinanceResult,
} from "../types";
import {
  calculateEqualPeriodicPayment,
  calculateEqualPrincipalAndInterestPayment,
  getEffectiveNextPaymentDate,
  getLocalTodayIsoDate,
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
  paymentBasis = getLoanPaymentBasisStatus(loan),
): BankComparisonRow {
  const remainingMonths = Math.max(paymentBasis.remainingMonths, 1);
  const remainingBonusPayments = paymentBasis.remainingBonusPayments;
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
      monthlyPayment: paymentBasis.baselineMonthlyPayment,
      bonusPayment: paymentBasis.baselineBonusPayment,
      remainingTotalPayment: Math.round(
        paymentBasis.baselineMonthlyPayment * remainingMonths +
          paymentBasis.baselineBonusPayment * remainingBonusPayments,
      ),
      netBenefit: null,
      isPriorityCandidate: false,
      note: paymentBasis.usesCalculatedBaseline
        ? "現在金利から逆算した比較用の基準"
        : "現在条件の基準",
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
  const netBenefit = Math.round(
    (paymentBasis.baselineMonthlyPayment - monthlyPayment) * BENEFIT_DISPLAY_MONTHS,
  );

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
  paymentBasis = getLoanPaymentBasisStatus(loan),
): BankComparisonRow[] {
  return rows.map((row) => recalculateComparisonRow(row, loan, paymentBasis));
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

export function calculateCurrentRemainingTotalPayment(
  loan: LoanProfile,
  todayIsoDate?: string,
): number {
  const paymentBasis = getLoanPaymentBasisStatus(loan, todayIsoDate);
  return Math.round(
    paymentBasis.baselineMonthlyPayment * paymentBasis.remainingMonths +
      paymentBasis.baselineBonusPayment * paymentBasis.remainingBonusPayments,
  );
}

export function deriveComparisonRowsFromLoan(
  rows: BankComparisonRow[],
  loan: LoanProfile,
  todayIsoDate?: string,
): BankComparisonRow[] {
  return recalculateComparisonRows(rows, loan, getLoanPaymentBasisStatus(loan, todayIsoDate));
}

export function selectBestRefinanceCandidate(
  rows: BankComparisonRow[],
  refinanceCosts?: RefinanceCostBreakdown,
  loan?: LoanProfile,
  todayIsoDate?: string,
): BankComparisonRow | null {
  const candidates = rows.filter((row) => !isBaseComparisonRow(row) && row.netBenefit !== null);
  if (refinanceCosts && loan) {
    return (
      candidates
        .map((row) => ({
          row,
          netBenefit: buildRefinanceResultFromCurrentLoan(
            row,
            refinanceCosts,
            loan,
            todayIsoDate,
          ).netBenefit,
        }))
        .sort((a, b) => b.netBenefit - a.netBenefit)[0]?.row ?? null
    );
  }
  return candidates.sort((a, b) => (b.netBenefit ?? -Infinity) - (a.netBenefit ?? -Infinity))[0] ?? null;
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
  todayIsoDate?: string,
): RefinanceResult {
  const paymentBasis = getLoanPaymentBasisStatus(loan, todayIsoDate);
  const remainingMonths = Math.max(paymentBasis.remainingMonths, 1);
  const remainingBonusPayments = paymentBasis.remainingBonusPayments;
  const currentRemainingTotalPayment = calculateCurrentRemainingTotalPayment(loan, todayIsoDate);
  const monthlyDifference = paymentBasis.baselineMonthlyPayment - row.monthlyPayment;
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
  const bonusDifference = paymentBasis.baselineBonusPayment - candidateBonusPayment;
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
    baseMonthlyPayment: paymentBasis.baselineMonthlyPayment,
    baseBonusPayment: paymentBasis.baselineBonusPayment,
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
  const paymentBasis = getLoanPaymentBasisStatus(loan);
  if (!paymentBasis.hasPaymentGap && !paymentBasis.isNextPaymentDatePast) {
    return null;
  }
  const warnings = ["返済額の登録確認が必要です。"];
  if (paymentBasis.hasPaymentGap) {
    warnings.push(
      `登録済み返済額と、現在適用金利 ${loan.currentRate.toFixed(3)}% から逆算した概算額に差があります。`,
    );
  }
  if (paymentBasis.isNextPaymentDatePast) {
    warnings.push("次回返済日が過去日のため、残高・次回返済日・返済予定額を更新してください。");
  }
  return warnings.join("");
}

export function getLoanPaymentBasisStatus(
  loan: LoanProfile,
  todayIsoDate = getLocalTodayIsoDate(),
): LoanPaymentBasisStatus {
  const effectiveNextPaymentDate = getEffectiveNextPaymentDate(loan.nextPaymentDate, todayIsoDate);
  const remainingMonths = Math.max(
    calculateRemainingMonths(effectiveNextPaymentDate, loan.endDate),
    1,
  );
  const remainingBonusPayments = calculateRemainingBonusPayments(
    effectiveNextPaymentDate,
    loan.endDate,
    loan.bonusMonths,
  );

  const expectedMonthlyPayment = Math.round(
    calculateEqualPrincipalAndInterestPayment(
      loan.currentBalanceMonthly,
      loan.currentRate,
      remainingMonths,
    ),
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
  const hasPaymentGap =
    monthlyDiff > PAYMENT_STALENESS_THRESHOLD_YEN ||
    bonusDiff > PAYMENT_STALENESS_THRESHOLD_YEN;
  const usesCalculatedBaseline = hasPaymentGap;

  return {
    registeredMonthlyPayment: loan.monthlyPayment,
    registeredBonusPayment: loan.bonusPayment,
    calculatedMonthlyPayment: expectedMonthlyPayment,
    calculatedBonusPayment: expectedBonusPayment,
    baselineMonthlyPayment: usesCalculatedBaseline ? expectedMonthlyPayment : loan.monthlyPayment,
    baselineBonusPayment: usesCalculatedBaseline ? expectedBonusPayment : loan.bonusPayment,
    monthlyDifference: expectedMonthlyPayment - loan.monthlyPayment,
    bonusDifference: expectedBonusPayment - loan.bonusPayment,
    effectiveNextPaymentDate,
    remainingMonths,
    remainingBonusPayments,
    usesCalculatedBaseline,
    hasPaymentGap,
    isNextPaymentDatePast: effectiveNextPaymentDate !== loan.nextPaymentDate,
    todayIsoDate,
  };
}
