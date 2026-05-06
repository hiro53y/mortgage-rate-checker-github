import type { ReactNode } from "react";

type InfoRowProps = {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
};

export function InfoRow({ label, value, emphasis = false }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd
        className={`max-w-[58%] text-right text-sm ${
          emphasis ? "font-bold text-navy-800" : "font-semibold text-slate-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
