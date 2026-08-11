import type {
  InsuranceCoverage,
  LoanProfile,
  RateEligibility,
  RateOffer,
  RateOption,
} from "../types";
import {
  calculateRemainingMonths,
  getEffectiveNextPaymentDate,
  getLocalTodayIsoDate,
} from "./mortgageMath.ts";
import { getJstMonthKey } from "./jstDate.ts";

export type RateEligibilityResult = {
  eligibility: RateEligibility;
  conditionMatchedRate?: number;
  selectedOption?: RateOption;
  ltv?: number;
  borrowerAge?: number;
  insuranceAddonRate?: number;
  longTermAddonRate?: number;
  reason: string;
};

export function normalizeInsuranceCoverage(loan: LoanProfile): InsuranceCoverage {
  if (loan.desiredInsuranceCoverage) return loan.desiredInsuranceCoverage;
  const text = loan.cancerInsuranceType.normalize("NFKC").toLowerCase();
  if (/100|全疾病|8大|3大/.test(text)) return text.includes("100") ? "cancer100" : "full-disease";
  if (/50/.test(text)) return "cancer50";
  if (/一般|通常|なし|標準/.test(text)) return "standard";
  return "unknown";
}

export function getBorrowerAge(birthDate: string, asOfIsoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(asOfIsoDate)) {
    return null;
  }
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = asOfIsoDate.split("-").map(Number);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function optionMatches(option: RateOption, ltv: number, age: number, remainingMonths: number) {
  if (option.requiresSbiHyper) return false;
  if (option.ltvMax !== undefined && ltv > option.ltvMax) return false;
  if (option.ltvMinExclusive !== undefined && ltv <= option.ltvMinExclusive) return false;
  if (option.ownFundsMinRatio !== undefined && 1 - ltv < option.ownFundsMinRatio) return false;
  if (option.maxBorrowerAge !== undefined && age > option.maxBorrowerAge) return false;
  if (option.maxRemainingMonths !== undefined && remainingMonths > option.maxRemainingMonths) return false;
  return true;
}

function getInsuranceAddon(offer: RateOffer, coverage: InsuranceCoverage) {
  if (coverage === "standard") return { addon: 0, known: true };
  if (coverage === "cancer100" && offer.insuranceAddonRate !== undefined) {
    return { addon: offer.insuranceAddonRate, known: true };
  }
  return { addon: 0, known: false };
}

export function evaluateRateOfferForLoan(
  offer: RateOffer,
  loan: LoanProfile,
  todayIsoDate = getLocalTodayIsoDate(),
): RateEligibilityResult {
  const missing: string[] = [];
  if (!loan.borrowerBirthDate) missing.push("生年月日");
  if (!loan.estimatedPropertyValue || loan.estimatedPropertyValue <= 0) missing.push("概算物件価値");
  if (missing.length > 0) {
    return { eligibility: "unknown", reason: `${missing.join("・")}が未入力です。` };
  }

  const borrowerBirthDate = loan.borrowerBirthDate;
  const estimatedPropertyValue = loan.estimatedPropertyValue;
  if (!borrowerBirthDate || !estimatedPropertyValue) {
    return { eligibility: "unknown", reason: "生年月日・概算物件価値が未入力です。" };
  }
  const borrowerAge = getBorrowerAge(borrowerBirthDate, todayIsoDate);
  if (borrowerAge === null) {
    return { eligibility: "unknown", reason: "生年月日の形式を確認してください。" };
  }
  const ltv = loan.currentBalance / estimatedPropertyValue;
  if (!Number.isFinite(ltv) || ltv <= 0) {
    return { eligibility: "unknown", borrowerAge, reason: "融資率を計算できません。" };
  }
  if (ltv > 1.5) {
    return {
      eligibility: "ineligible",
      borrowerAge,
      ltv,
      reason: "残高が概算物件価値を大きく上回るため対象条件を確認してください。",
    };
  }

  const effectiveNextPaymentDate = getEffectiveNextPaymentDate(loan.nextPaymentDate, todayIsoDate);
  const remainingMonths = calculateRemainingMonths(effectiveNextPaymentDate, loan.endDate);
  const options = offer.rateOptions.filter((option) =>
    optionMatches(option, ltv, borrowerAge, remainingMonths),
  );
  const selectedOption = [...options].sort((a, b) => a.rate - b.rate)[0];
  if (!selectedOption) {
    return {
      eligibility: "ineligible",
      borrowerAge,
      ltv,
      reason: "年齢・融資率・残期間に合う金利区分がありません。",
    };
  }

  const coverage = normalizeInsuranceCoverage(loan);
  if (coverage === "unknown") {
    return {
      eligibility: "unknown",
      borrowerAge,
      ltv,
      selectedOption,
      reason: "団信区分を選択してください。",
    };
  }
  const insurance = getInsuranceAddon(offer, coverage);
  if (!insurance.known) {
    return {
      eligibility: "conditional",
      borrowerAge,
      ltv,
      selectedOption,
      reason: "選択した団信の上乗せ金利を公式データから確定できません。",
    };
  }

  const longTermAddonRate = remainingMonths > 420 ? (offer.longTermAddonRate ?? 0) : 0;
  const conditionMatchedRate = Number(
    (selectedOption.rate + insurance.addon + longTermAddonRate).toFixed(3),
  );
  return {
    eligibility: "eligible",
    conditionMatchedRate,
    selectedOption,
    ltv,
    borrowerAge,
    insuranceAddonRate: insurance.addon,
    longTermAddonRate,
    reason: `${selectedOption.label}、融資率${(ltv * 100).toFixed(1)}%、年齢${borrowerAge}歳で算定。`,
  };
}

export function isOfferCurrentMonth(offer: RateOffer | undefined, date = new Date()) {
  if (!offer) return false;
  return offer.applicableMonth === getJstMonthKey(date);
}
