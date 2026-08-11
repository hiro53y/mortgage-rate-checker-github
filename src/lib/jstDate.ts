function getJstDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("JST日付を取得できません。");
  }
  return { year, month, day };
}

export function getJstMonthKey(date = new Date()): string {
  const { year, month } = getJstDateParts(date);
  return `${year}-${month}`;
}

export function getJstDateKey(date = new Date()): string {
  const { year, month, day } = getJstDateParts(date);
  return `${year}-${month}-${day}`;
}

export function isValidMonthKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
