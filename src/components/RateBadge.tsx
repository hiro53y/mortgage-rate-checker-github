import { formatRate } from "../lib/formatters";

type RateBadgeProps = {
  value: number;
  label?: string;
  tone?: "blue" | "green" | "amber" | "red";
};

const tones = {
  blue: "bg-navy-50 text-navy-800 ring-navy-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
};

export function RateBadge({ value, label, tone = "blue" }: RateBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black ring-1 ${tones[tone]}`}>
      {label ? <span className="text-xs font-semibold opacity-80">{label}</span> : null}
      {formatRate(value)}
    </span>
  );
}
