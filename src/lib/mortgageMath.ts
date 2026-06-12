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

export function calculateEqualPeriodicPayment(
  principal: number,
  annualRate: number,
  periods: number,
  paymentsPerYear: number,
): number {
  if (principal <= 0 || periods <= 0) {
    return 0;
  }
  if (annualRate < 0 || paymentsPerYear <= 0) {
    throw new Error("Invalid mortgage calculation input");
  }

  const periodicRate = annualRate / 100 / paymentsPerYear;
  if (periodicRate === 0) {
    return principal / periods;
  }
  const compounded = (1 + periodicRate) ** periods;
  return (principal * periodicRate * compounded) / (compounded - 1);
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

export function calculateRemainingBonusPayments(
  nextPaymentDate: string,
  endDate: string,
  bonusMonths: number[],
): number {
  const start = new Date(nextPaymentDate);
  const end = new Date(endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start ||
    bonusMonths.length === 0
  ) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    if (bonusMonths.includes(cursor.getMonth() + 1)) {
      count += 1;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}
