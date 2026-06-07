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

export function currentRateNegotiationSummary(
  currentAppliedRate: number,
  lowerRate: number,
): { title: string; message: string; tone: "blue" | "amber" } {
  const difference = calculateRateDifference(currentAppliedRate, lowerRate);
  if (difference > 0.0005) {
    return {
      title: "金利引き下げ交渉を検討してください",
      message:
        "現在の適用金利は新規向け下限金利を上回っています。返済額通知の内容を確認し、引き下げ交渉または借換え比較を進めてください。",
      tone: "amber",
    };
  }
  if (Math.abs(difference) <= 0.0005) {
    return {
      title: "新規向け下限金利と同水準です",
      message:
        "現在の適用金利は新規向け下限金利とほぼ同水準です。公式ページと返済額通知を確認し、条件差があれば交渉材料にしてください。",
      tone: "blue",
    };
  }
  return {
    title: "現時点では交渉優先度は低めです",
    message:
      "現在の適用金利は新規向け下限金利より低いため、現時点では金利引き下げ交渉の優先度は高くありません。通知後に再確認してください。",
    tone: "blue",
  };
}
