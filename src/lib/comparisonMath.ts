import type {
  BankComparisonRow,
  BankRateSource,
  LoanPaymentBasisStatus,
  LoanProfile,
  RateEstimationTier,
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
import { bankRateSources } from "./bankSources.ts";
import { getJstDateKey, getJstMonthKey, isValidMonthKey } from "./jstDate.ts";

/**
 * 団信込み（がん100%相当）に揃えるための想定上乗せ幅。
 * - もみじ銀行の現在ローンは「がん100%団信込み」のため、推定値もそれに揃える
 * - 業界平均：標準団信から がん100%団信 で +0.2〜0.3% が一般的
 * - 安全側として +0.3% を採用
 */
export const INSURANCE_ADDON_ESTIMATE = 0.3;

export type EstimatedRateResult = {
  rate: number;
  tier: RateEstimationTier;
  label: string;
};

/**
 * 3層フォールバックで必ず金利を返す。
 * 第1: 公式条件適合金利（rateOffer + 条件評価）
 * 第2: aggregator（まとめサイト）由来の参考値
 * 第3: 広告下限 + 一律団信上乗せ（+0.3%）
 * 第4: 銀行の expectedVariableRateRange 中央値
 */
export function getEstimatedRate(
  row: BankComparisonRow,
  source?: BankRateSource,
  conditionMatchedRate?: number,
): EstimatedRateResult {
  // 第1優先: 公式の条件適合金利
  if (conditionMatchedRate !== undefined) {
    return {
      rate: conditionMatchedRate,
      tier: "official-condition-matched",
      label: "条件適合",
    };
  }

  const advertisedMin = row.rateOffer?.advertisedMinRate ?? row.advertisedMinRate;

  // 第2優先: aggregator (まとめサイト) 由来の参考値
  if (
    advertisedMin !== undefined &&
    row.rateOffer?.sourceKind === "aggregator"
  ) {
    return {
      rate: Number(advertisedMin.toFixed(3)),
      tier: "aggregator-reference",
      label: "参考値（まとめサイト）",
    };
  }

  // 第3優先: 広告下限 + 一律団信上乗せ (+0.3%)
  if (advertisedMin !== undefined) {
    return {
      rate: Number((advertisedMin + INSURANCE_ADDON_ESTIMATE).toFixed(3)),
      tier: "estimated-with-insurance",
      label: "推定値（広告下限+団信0.3%）",
    };
  }

  // 第4優先: expectedVariableRateRange 中央値
  const range = source?.expectedVariableRateRange;
  if (range && range.length === 2) {
    const midrange = (range[0] + range[1]) / 2;
    return {
      rate: Number(midrange.toFixed(3)),
      tier: "estimated-midrange",
      label: "推定値（業界中央レンジ）",
    };
  }

  // 最終フォールバック: 元の effectiveRate
  return {
    rate: row.effectiveRate,
    tier: "estimated-midrange",
    label: "推定値（業界中央レンジ）",
  };
}

function findBankSource(
  row: BankComparisonRow,
  sources: BankRateSource[] = bankRateSources,
): BankRateSource | undefined {
  if (row.rateOffer?.bankRateSourceId) {
    const matched = sources.find(
      (source) => source.id === row.rateOffer?.bankRateSourceId,
    );
    if (matched) return matched;
  }
  return sources.find((source) => row.bankName.includes(source.bankName));
}

const BENEFIT_DISPLAY_MONTHS = 144;
const PAYMENT_STALENESS_THRESHOLD_YEN = 1000;

export function getRateUsedForCalculation(row: BankComparisonRow): number {
  if (Number.isFinite(row.manualOverrideRate) && (row.manualOverrideRate ?? 0) > 0) {
    return row.manualOverrideRate as number;
  }
  for (const rate of [row.conditionMatchedRate, row.autoFetchedRate, row.effectiveRate]) {
    if (Number.isFinite(rate) && (rate ?? -1) >= 0) return rate as number;
  }
  throw new Error("比較計算に使用できる金利がありません。");
}

export function getRateStatus(row: BankComparisonRow): NonNullable<BankComparisonRow["rateStatus"]> {
  if (row.manualOverrideRate !== undefined) {
    return "manual";
  }
  if (row.rateStatus === "stale" || row.rateStatus === "failed") {
    return row.rateStatus;
  }
  if (row.autoFetchedRate !== undefined) {
    return row.rateOffer?.sourceKind === "aggregator" ? "reference" : "auto";
  }
  return row.rateStatus ?? "sample";
}

function getManualVerificationIssue(
  row: BankComparisonRow,
  date = new Date(),
  sources: BankRateSource[] = bankRateSources,
): string | undefined {
  if (!Number.isFinite(row.manualOverrideRate) || (row.manualOverrideRate ?? 0) <= 0) {
    return "手入力金利が正の数値ではないため参考表示です。";
  }
  const verifiedAt = row.manualVerifiedAt;
  const isoInstantMatch = verifiedAt?.match(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
  );
  const verifiedAtMs = verifiedAt ? Date.parse(verifiedAt) : Number.NaN;
  const normalizedVerifiedAt = verifiedAt?.includes(".")
    ? verifiedAt
    : verifiedAt?.replace("Z", ".000Z");
  if (
    !verifiedAt ||
    !isoInstantMatch ||
    !Number.isFinite(verifiedAtMs) ||
    new Date(verifiedAtMs).toISOString() !== normalizedVerifiedAt
  ) {
    return "公式確認日時が未登録または形式不正のため参考表示です。";
  }
  const referenceDayEndMs = Date.parse(`${getJstDateKey(date)}T23:59:59.999+09:00`);
  if (verifiedAtMs > referenceDayEndMs) {
    return "公式確認日時が未来日のため参考表示です。";
  }
  if (!row.manualSourceUrl?.startsWith("https://")) {
    return "公式URLがHTTPSではないため参考表示です。";
  }
  const source = findBankSource(row, sources);
  if (!source) return "対象銀行マスタが見つからないため参考表示です。";
  let manualHost: string;
  let officialHost: string;
  try {
    manualHost = new URL(row.manualSourceUrl).hostname;
    officialHost = new URL(source.rateUrl).hostname;
  } catch {
    return "公式URLの形式が不正なため参考表示です。";
  }
  if (manualHost !== officialHost) {
    return "入力したURLが対象銀行マスタの公式サイトと一致しないため参考表示です。";
  }
  if (!isValidMonthKey(row.manualApplicableMonth)) {
    return `適用年月が未入力または形式不正のため参考表示です。当月（${getJstMonthKey(date)}）を入力してください。`;
  }
  if (row.manualApplicableMonth !== getJstMonthKey(date)) {
    return `適用年月（${row.manualApplicableMonth}）が当月（${getJstMonthKey(date)}）ではないため参考表示です。`;
  }
  return undefined;
}

function hasOfficialManualEvidence(row: BankComparisonRow): boolean {
  return (
    row.manualOverrideRate !== undefined &&
    Boolean(row.manualVerifiedAt) &&
    Boolean(row.manualSourceUrl)
  );
}

export function isLatestFetchedCandidate(
  row: BankComparisonRow,
  date = new Date(),
  sources: BankRateSource[] = bankRateSources,
): boolean {
  if (isBaseComparisonRow(row) || row.eligibility !== "eligible") return false;
  if (row.rateStatus === "stale") return false;
  if (row.manualOverrideRate !== undefined) return !getManualVerificationIssue(row, date, sources);
  // 推定値（第3・4優先）は推薦対象外。
  // v10: 第1優先（公式条件適合）のみが自動推薦の対象。
  if (
    row.estimationTier !== undefined &&
    row.estimationTier !== "official-condition-matched"
  ) {
    return false;
  }
  return (
    row.conditionMatchedRate !== undefined &&
    row.rateOffer?.confidence === "verified" &&
    row.rateOffer.sourceKind !== "aggregator" &&
    isOfferCurrentMonth(row.rateOffer, date)
  );
}

export function isBaseComparisonRow(row: BankComparisonRow): boolean {
  if (row.rowKind !== undefined) {
    return row.rowKind === "base";
  }
  return (
    row.netBenefit === null ||
    row.bankName.includes("選択中シナリオ") ||
    row.bankName.includes("現在条件")
  );
}

export function recalculateComparisonRow(
  row: BankComparisonRow,
  loan: LoanProfile,
  paymentBasis = getLoanPaymentBasisStatus(loan),
  sources: BankRateSource[] = bankRateSources,
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
  const hasManualInput = row.manualOverrideRate !== undefined;
  const hasVerifiedManual = hasOfficialManualEvidence(row);
  const manualVerificationIssue = hasManualInput
    ? getManualVerificationIssue(
        row,
        new Date(`${paymentBasis.todayIsoDate}T00:00:00+09:00`),
        sources,
      )
    : undefined;
  const isCurrentVerifiedManual = hasVerifiedManual && !manualVerificationIssue;

  // 3層フォールバックで「条件適合金利」を必ず確定する。
  // 第1: offerEvaluation?.conditionMatchedRate
  // 第2: aggregator由来の参考値
  // 第3: 広告下限 + 0.3% 一律団信上乗せ
  // 第4: 銀行のexpectedVariableRateRange中央値
  const bankSource = findBankSource(row, sources);
  const estimation = getEstimatedRate(
    row,
    bankSource,
    offerEvaluation?.conditionMatchedRate,
  );
  const finalConditionMatchedRate = estimation.rate;

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
    conditionMatchedRate: finalConditionMatchedRate,
    // v11: 手入力+公式確認済みのときは推薦対象に並ぶため、
    //      tier は「公式条件適合」相当として扱い、ラベルも手入力であることを明示する。
    estimationTier: hasVerifiedManual ? "official-condition-matched" : estimation.tier,
    estimationLabel: hasVerifiedManual
      ? isCurrentVerifiedManual
        ? "公式確認済み手入力"
        : "公式確認済み手入力（参考）"
      : estimation.label,
    sourceKind: hasVerifiedManual ? "manual-verified" : row.rateOffer?.sourceKind,
    confidence: hasVerifiedManual ? "verified" : row.rateOffer?.confidence,
    eligibility: hasManualInput
      ? isCurrentVerifiedManual
        ? "eligible"
        : "conditional"
      : (offerEvaluation?.eligibility ?? "unknown"),
    eligibilityReason: hasManualInput
      ? isCurrentVerifiedManual
        ? `公式URL・確認日・適用年月（${row.manualApplicableMonth}）を登録した手入力値`
        : `${hasVerifiedManual ? "公式確認済み手入力ですが、" : "手入力値は"}${manualVerificationIssue}`
      : (offerEvaluation?.reason ?? "取得条件がありません。"),
    applicableMonth: hasVerifiedManual
      ? (row.manualApplicableMonth ?? row.rateOffer?.applicableMonth)
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
  sources: BankRateSource[] = bankRateSources,
): BankComparisonRow[] {
  const recalculatedRows = rows.map((row) =>
    recalculateComparisonRow(row, loan, paymentBasis, sources),
  );
  const lowestFetchedCandidate = selectBestRefinanceCandidate(
    recalculatedRows,
    undefined,
    undefined,
    paymentBasis.todayIsoDate,
    sources,
  );
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
  sources: BankRateSource[] = bankRateSources,
): BankComparisonRow[] {
  return recalculateComparisonRows(
    rows,
    loan,
    getLoanPaymentBasisStatus(loan, todayIsoDate),
    sources,
  );
}

function toReferenceDate(todayIsoDate?: string): Date {
  if (todayIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(todayIsoDate)) {
    return new Date(`${todayIsoDate}T00:00:00+09:00`);
  }
  return new Date();
}

export function selectBestRefinanceCandidate(
  rows: BankComparisonRow[],
  refinanceCosts?: RefinanceCostBreakdown,
  loan?: LoanProfile,
  todayIsoDate?: string,
  sources: BankRateSource[] = bankRateSources,
): BankComparisonRow | null {
  const referenceDate = toReferenceDate(todayIsoDate);
  const candidates = rows.filter((row) =>
    isLatestFetchedCandidate(row, referenceDate, sources),
  );
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
            sources,
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

function getCandidateReviewWarning(
  row: BankComparisonRow,
  referenceDate = new Date(),
  sources: BankRateSource[] = bankRateSources,
): string | undefined {
  const warnings: string[] = [];
  if (!isLatestFetchedCandidate(row, referenceDate, sources)) {
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
  sources: BankRateSource[] = bankRateSources,
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
  const candidateReviewWarning = getCandidateReviewWarning(
    row,
    toReferenceDate(todayIsoDate),
    sources,
  );

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
