export function calculateEqualPrincipalAndInterestPayment(
  principal: number,
  annualRate: number,
  remainingMonths: number,
): number {
  if (principal < 0 || annualRate < 0 || remainingMonths <= 0) {
    throw new Error("Invalid mortgage calculation input");
  }

  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) {
    return principal / remainingMonths;
  }

  const compounded = (1 + monthlyRate) ** remainingMonths;
  return (principal * monthlyRate * compounded) / (compounded - 1);
}

export function calculateRemainingMonths(fromDate: string, endDate: string): number {
  const start = new Date(fromDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}
