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

export function shouldSuggestNegotiation(scenarioRate: number, lowerRate: number): boolean {
  return scenarioRate > lowerRate;
}

export function scenarioJudgementText(scenarioRate: number, lowerRate: number): string {
  if (shouldSuggestNegotiation(scenarioRate, lowerRate)) {
    return "新規向け下限金利を上回るため、金利引き下げ交渉を検討してください";
  }
  return "新規向け下限金利と同水準です";
}
