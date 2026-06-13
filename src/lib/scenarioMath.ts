import type { LoanProfile, ScenarioRate } from "../types";
import {
  calculateEqualPeriodicPayment,
  calculateEqualPrincipalAndInterestPayment,
  calculateRemainingBonusPayments,
  calculateRemainingMonths,
} from "./mortgageMath.ts";

const RATE_EQUAL_TOLERANCE = 0.0005;

export function calculateAnnualIncrease(
  scenarioMonthlyPayment: number,
  currentMonthlyPayment: number,
  scenarioBonusPayment: number,
  currentBonusPayment: number,
): number {
  return (
    (scenarioMonthlyPayment - currentMonthlyPayment) * 12 +
    (scenarioBonusPayment - currentBonusPayment) * 2
  );
}

export function calculateRateDifference(currentAppliedRate: number, lowerRate: number): number {
  return currentAppliedRate - lowerRate;
}

export function areRatesEqual(firstRate: number, secondRate: number): boolean {
  return Math.abs(firstRate - secondRate) <= RATE_EQUAL_TOLERANCE;
}

export function shouldSuggestNegotiation(scenarioRate: number, lowerRate: number): boolean {
  return scenarioRate - lowerRate > RATE_EQUAL_TOLERANCE;
}

export function scenarioJudgementText(
  scenarioRate: number,
  lowerRate: number,
  currentAppliedRate?: number,
): string {
  if (currentAppliedRate !== undefined && areRatesEqual(scenarioRate, currentAppliedRate)) {
    if (shouldSuggestNegotiation(scenarioRate, lowerRate)) {
      return "現在条件と同水準です。新規向け下限金利を上回るため、金利引き下げ交渉を検討してください";
    }
    if (areRatesEqual(scenarioRate, lowerRate)) {
      return "現在条件・新規向け下限金利と同水準です";
    }
    return "現在条件と同水準で、新規向け下限金利より低い水準です";
  }

  if (currentAppliedRate !== undefined && scenarioRate < currentAppliedRate) {
    if (shouldSuggestNegotiation(scenarioRate, lowerRate)) {
      return "現在条件より低い金利ですが、新規向け下限金利は上回ります。交渉余地を確認してください";
    }
    if (areRatesEqual(scenarioRate, lowerRate)) {
      return "現在条件より低く、新規向け下限金利と同水準です";
    }
    return "現在条件より低く、新規向け下限金利も下回る水準です";
  }

  if (currentAppliedRate !== undefined && scenarioRate > currentAppliedRate) {
    return "現在条件より上昇するシナリオです。返済額増加と交渉余地を確認してください";
  }

  if (shouldSuggestNegotiation(scenarioRate, lowerRate)) {
    return "新規向け下限金利を上回るため、金利引き下げ交渉を検討してください";
  }
  return "新規向け下限金利と同水準です";
}

export function currentRateNegotiationSummary(
  currentAppliedRate: number,
  lowerRate: number,
): { title: string; message: string; tone: "blue" | "amber" } {
  const difference = calculateRateDifference(currentAppliedRate, lowerRate);
  if (difference > RATE_EQUAL_TOLERANCE) {
    return {
      title: "現在金利は下限金利より高いです",
      message:
        "現在の適用金利は新規向け下限金利を上回っています。この差は金利引き下げ交渉や借換え比較の材料になります。返済額通知の内容と公式金利を確認してください。",
      tone: "amber",
    };
  }
  if (areRatesEqual(currentAppliedRate, lowerRate)) {
    return {
      title: "新規向け下限金利と同水準です",
      message:
        "現在の適用金利は新規向け下限金利とほぼ同水準です。公式ページと返済額通知を確認し、条件差があれば交渉材料にしてください。",
      tone: "blue",
    };
  }
  return {
    title: "現在金利は下限金利より低いです",
    message:
      "現在の適用金利は新規向け下限金利より低い水準です。金利引き下げ交渉よりも、次回通知や他行条件の変化を確認する位置づけです。",
    tone: "blue",
  };
}

export function deriveScenarioFromLoan(
  scenario: ScenarioRate,
  loan: LoanProfile,
  lowerRate: number,
): ScenarioRate {
  if (areRatesEqual(scenario.rate, loan.currentRate)) {
    return {
      ...scenario,
      monthlyPayment: loan.monthlyPayment,
      bonusPayment: loan.bonusPayment,
      annualIncrease: 0,
      shouldSuggestNegotiation: shouldSuggestNegotiation(scenario.rate, lowerRate),
      note: scenarioJudgementText(scenario.rate, lowerRate, loan.currentRate),
    };
  }

  const remainingMonths = Math.max(
    calculateRemainingMonths(loan.nextPaymentDate, loan.endDate),
    1,
  );
  const remainingBonusPayments = calculateRemainingBonusPayments(
    loan.nextPaymentDate,
    loan.endDate,
    loan.bonusMonths,
  );
  const monthlyPayment = Math.round(
    calculateEqualPrincipalAndInterestPayment(
      loan.currentBalanceMonthly,
      scenario.rate,
      remainingMonths,
    ),
  );
  const bonusPayment = Math.round(
    calculateEqualPeriodicPayment(
      loan.currentBalanceBonus,
      scenario.rate,
      remainingBonusPayments,
      2,
    ),
  );

  return {
    ...scenario,
    monthlyPayment,
    bonusPayment,
    annualIncrease: calculateAnnualIncrease(
      monthlyPayment,
      loan.monthlyPayment,
      bonusPayment,
      loan.bonusPayment,
    ),
    shouldSuggestNegotiation: shouldSuggestNegotiation(scenario.rate, lowerRate),
    note: scenarioJudgementText(scenario.rate, lowerRate, loan.currentRate),
  };
}

export function deriveScenariosFromLoan(
  scenarios: ScenarioRate[],
  loan: LoanProfile,
  lowerRate: number,
): ScenarioRate[] {
  return scenarios.map((scenario) => deriveScenarioFromLoan(scenario, loan, lowerRate));
}
