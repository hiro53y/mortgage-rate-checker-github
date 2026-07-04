export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function formatApproxMoney(value: number): string {
  return `約${formatMoney(value)}`;
}

export function formatApproxSignedMoney(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `約${sign}${formatMoney(value)}`;
}

export function formatSignedMoney(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value)}`;
}

export function formatRate(value: number): string {
  return `${value.toFixed(3)}%`;
}

export function formatSignedRate(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(3)}%`;
}

export function formatDateJa(value?: string): string {
  if (!value) {
    return "未確認";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter
    .format(date)
    .replace(/\//g, "年")
    .replace(/年(\d{2})年/, "年$1月")
    .concat("日");
}

export function formatDateTimeJa(value?: string): string {
  if (!value) {
    return "未確認";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatBonusMonths(months: number[]): string {
  return months.map((month) => `${month}月`).join("、");
}

export function formatManYen(value: number | null): string {
  if (value === null) {
    return "基準";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value / 10000).toFixed(1)}万円`;
}

export function formatPaybackMonths(months: number | null): string {
  if (months === null || !Number.isFinite(months)) {
    return "回収不可";
  }
  const roundedMonths = Math.ceil(months);
  const years = Math.floor(roundedMonths / 12);
  const remainingMonths = roundedMonths % 12;
  return `${years}年${remainingMonths}か月`;
}

export function parseNumberInput(value: string): number {
  // v12: 全角数字・全角記号（NFKC正規化）とカンマ・空白に対応する。
  const normalized = value.normalize("NFKC").replace(/[,\s]/g, "");
  if (normalized === "") {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
