export function calculateNetBenefit(
  currentRemainingTotalPayment: number,
  refinanceRemainingTotalPayment: number,
  refinanceCosts: number,
): number {
  return currentRemainingTotalPayment - refinanceRemainingTotalPayment - refinanceCosts;
}

export function calculateMonthlyDifference(
  currentMonthlyPayment: number,
  refinanceMonthlyPayment: number,
): number {
  return currentMonthlyPayment - refinanceMonthlyPayment;
}

export function calculatePaybackMonths(
  refinanceCosts: number,
  monthlyDifference: number,
): number | null {
  if (monthlyDifference <= 0) {
    return null;
  }
  return refinanceCosts / monthlyDifference;
}

export function judgeRefinance(
  netBenefit: number,
  paybackMonths: number | null,
): "検討価値あり" | "微妙" | "メリット小" {
  if (netBenefit >= 300000 && paybackMonths !== null && paybackMonths <= 120) {
    return "検討価値あり";
  }
  if (netBenefit >= 0) {
    return "微妙";
  }
  return "メリット小";
}
