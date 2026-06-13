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

type IsoDateParts = {
  year: number;
  month: number;
  day: number;
};

function parseIsoDateParts(value: string): IsoDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatIsoDateParts({ year, month, day }: IsoDateParts): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonthsToIsoDate(parts: IsoDateParts, monthsToAdd: number): string {
  const zeroBasedMonth = parts.month - 1 + monthsToAdd;
  const year = parts.year + Math.floor(zeroBasedMonth / 12);
  const month = ((zeroBasedMonth % 12) + 12) % 12 + 1;
  const day = Math.min(parts.day, daysInMonth(year, month));
  return formatIsoDateParts({ year, month, day });
}

export function getLocalTodayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getEffectiveNextPaymentDate(
  nextPaymentDate: string,
  todayIsoDate = getLocalTodayIsoDate(),
): string {
  const nextParts = parseIsoDateParts(nextPaymentDate);
  const todayParts = parseIsoDateParts(todayIsoDate);
  if (!nextParts || !todayParts || nextPaymentDate >= todayIsoDate) {
    return nextPaymentDate;
  }

  const monthDiff =
    (todayParts.year - nextParts.year) * 12 + (todayParts.month - nextParts.month);
  const sameMonthCandidate = addMonthsToIsoDate(nextParts, Math.max(monthDiff, 0));
  if (sameMonthCandidate >= todayIsoDate) {
    return sameMonthCandidate;
  }
  return addMonthsToIsoDate(nextParts, Math.max(monthDiff + 1, 1));
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
