import { formatMoney } from "../lib/formatters";

type MoneyDisplayProps = {
  label: string;
  value: number;
  helper?: string;
  tone?: "default" | "positive" | "negative";
};

const tones = {
  default: "text-slate-950",
  positive: "text-emerald-700",
  negative: "text-red-700",
};

export function MoneyDisplay({ label, value, helper, tone = "default" }: MoneyDisplayProps) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black tracking-normal ${tones[tone]}`}>
        {formatMoney(value)}
      </p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}
