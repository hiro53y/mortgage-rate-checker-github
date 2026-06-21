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
import { evaluateRateOfferForLoan, isOfferCurrentMonth } from "./rateEligibility.ts";

const BENEFIT_DISPLAY_MONTHS = 144;
const PAYMENT_STALENESS_THRESHOLD_YEN = 1000;

export function getRateUsedForCalculation(row: BankComparisonRow): number {
  return (
    row.manualOverrideRate ??
    row.conditionMatchedRate ??
    row.autoFetchedRate ??
    row.effectiveRate
  );
}

export function getRateStatus(row: BankComparisonRow): NonNullable<BankComparisonRow["rateStatus"]> {
  if (row.manualOverrideRate !== undefined) {
    return "manual";
  }
  if (row.autoFetchedRate !== undefined) {
    return row.rateOffer?.sourceKind === "aggregator" ? "reference" : "auto";
  }
  return row.rateStatus ?? "sample";
}

export function isLatestFetchedCandidate(row: BankComparisonRow, date = new Date()): boolean {
  if (isBaseComparisonRow(row) || row.eligibility !== "eligible") return false;
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const verifiedManual =
    row.manualOverrideRate !== undefined &&
    Boolean(row.manualVerifiedAt) &&
    row.manualApplicableMonth === currentMonth &&
    Boolean(row.manualSourceUrl?.startsWith("https://"));
  if (verifiedManual) return true;
  return (
    row.conditionMatchedRate !== undefined &&
    row.rateOffer?.confidence === "verified" &&
    row.rateOffer.sourceKind !== "aggregator" &&
    isOfferCurrentMonth(row.rateOffer, date)
  );
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
      advertisedMinRate: undefined,
      conditionMatchedRate: loan.currentRate,
      rateOffer: undefined,
      sourceKind: undefined,
      confidence: undefined,
      eligibility: "eligible",
      eligibilityReason: "現在の登録条件",
      applicableMonth: undefined,
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

  const offerEvaluation = row.rateOffer
    ? evaluateRateOfferForLoan(row.rateOffer, loan, paymentBasis.todayIsoDate)
    : null;
  const hasVerifiedManual =
    row.manualOverrideRate !== undefined &&
    Boolean(row.manualVerifiedAt) &&
    Boolean(row.manualApplicableMonth) &&
    Boolean(row.manualSourceUrl);
  const derivedRow: BankComparisonRow = {
    ...row,
    rateOffer:
      row.rateOffer && offerEvaluation
        ? {
            ...row.rateOffer,
            conditionMatchedRate: offerEvaluation.conditionMatchedRate,
            eligibility: offerEvaluation.eligibility,
            insuranceAddonRate: offerEvaluation.insuranceAddonRate,
            longTermAddonRate: offerEvaluation.longTermAddonRate,
          }
        : row.rateOffer,
    advertisedMinRate: row.rateOffer?.advertisedMinRate ?? row.advertisedMinRate,
    conditionMatchedRate: offerEvaluation?.conditionMatchedRate,
    sourceKind: hasVerifiedManual ? "manual-verified" : row.rateOffer?.sourceKind,
    confidence: hasVerifiedManual ? "verified" : row.rateOffer?.confidence,
    eligibility: hasVerifiedManual ? "eligible" : (offerEvaluation?.eligibility ?? "unknown"),
    eligibilityReason: hasVerifiedManual
      ? "公式URL・確認日・適用年月を登録した手入力値"
      : (offerEvaluation?.reason ?? "取得条件がありません。"),
    applicableMonth: hasVerifiedManual
      ? row.manualApplicableMonth
      : row.rateOffer?.applicableMonth,
  };
  const rate = getRateUsedForCalculation(derivedRow);
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
    ...derivedRow,
    rowKind: "candidate",
    rateUsedForCalculation: rate,
    rateStatus: getRateStatus(row),
    monthlyPayment,
    bonusPayment,
    remainingTotalPayment,
    netBenefit,
    isPriorityCandidate: false,
  };
}

export function recalculateComparisonRows(
  rows: BankComparisonRow[],
  loan: LoanProfile,
  paymentBasis = getLoanPaymentBasisStatus(loan),
): BankComparisonRow[] {
  const recalculatedRows = rows.map((row) => recalculateComparisonRow(row, loan, paymentBasis));
  const lowestFetchedCandidate = selectBestRefinanceCandidate(recalculatedRows);
  return recalculatedRows.map((row) => ({
    ...row,
    isPriorityCandidate: lowestFetchedCandidate?.id === row.id,
  }));
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
  const candidates = rows.filter((row) => isLatestFetchedCandidate(row));
  if (candidates.length === 0) {
    return null;
  }

  const sortedByRate = [...candidates].sort((a, b) => {
    const rateDifference = getRateUsedForCalculation(a) - getRateUsedForCalculation(b);
    if (Math.abs(rateDifference) > 0.000001) {
      return rateDifference;
    }
    return (b.netBenefit ?? -Infinity) - (a.netBenefit ?? -Infinity);
  });

  if (refinanceCosts && loan) {
    return (
      sortedByRate
        .map((row) => ({
          row,
          netBenefit: buildRefinanceResultFromCurrentLoan(
            row,
            refinanceCosts,
            loan,
            todayIsoDate,
          ).netBenefit,
        }))
        .sort((a, b) => {
          const rateDifference =
            getRateUsedForCalculation(a.row) - getRateUsedForCalculation(b.row);
          if (Math.abs(rateDifference) > 0.000001) {
            return rateDifference;
          }
          return b.netBenefit - a.netBenefit;
        })[0]?.row ?? null
    );
  }
  return sortedByRate[0] ?? null;
}

function getCandidateReviewWarning(row: BankComparisonRow): string | undefined {
  const warnings: string[] = [];
  if (!isLatestFetchedCandidate(row)) {
    warnings.push("最新金利を自動取得できていない候補");
  }
  if (row.sourceKind === "manual-verified" && !row.manualVerifiedAt) warnings.push("手入力の公式確認が未完了");
  if (row.rateOffer?.confidence !== "verified" && row.sourceKind !== "manual-verified") warnings.push("取得値の信頼度が要確認");
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
    candidateSourceKind: row.sourceKind,
    candidateApplicableMonth: row.applicableMonth,
    candidateEligibilityReason: row.eligibilityReason,
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
