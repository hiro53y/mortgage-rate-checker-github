import { ExternalLink, Star } from "lucide-react";
import type { BankComparisonRow, BankRateSource } from "../types";
import { formatManYen, formatMoney, formatRate } from "../lib/formatters";
import { Button } from "./Button";

type ComparisonTableProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  onOpenBank: (source: BankRateSource) => void;
};

export function ComparisonTable({ rows, sources, onOpenBank }: ComparisonTableProps) {
  const findSource = (row: BankComparisonRow) =>
    sources.find((source) => row.bankName.includes(source.bankName));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft">
      <table className="min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-3 font-bold">銀行名</th>
            <th className="px-3 py-3 font-bold">実質金利</th>
            <th className="px-3 py-3 font-bold">保障</th>
            <th className="px-3 py-3 font-bold">月返済</th>
            <th className="px-3 py-3 font-bold">実質メリット</th>
            <th className="px-3 py-3 font-bold">公式</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const source = findSource(row);
            return (
              <tr
                key={row.id}
                className={`border-t border-slate-100 ${
                  row.isPriorityCandidate ? "bg-navy-50" : "bg-white"
                }`}
              >
                <td className="px-3 py-3 font-bold text-slate-950">
                  <div className="flex items-center gap-2">
                    {row.isPriorityCandidate ? (
                      <Star className="h-4 w-4 fill-navy-700 text-navy-700" aria-hidden="true" />
                    ) : null}
                    {row.bankName}
                  </div>
                  <p className="mt-1 text-xs font-normal text-slate-500">{row.note}</p>
                </td>
                <td className="px-3 py-3 font-black text-navy-800">{formatRate(row.effectiveRate)}</td>
                <td className="px-3 py-3 text-slate-700">{row.insuranceLevel}</td>
                <td className="px-3 py-3 font-bold text-slate-900">{formatMoney(row.monthlyPayment)}</td>
                <td
                  className={`px-3 py-3 font-black ${
                    row.netBenefit === null
                      ? "text-slate-700"
                      : row.netBenefit >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                  }`}
                >
                  {formatManYen(row.netBenefit)}
                </td>
                <td className="px-3 py-3">
                  {source ? (
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 py-2 text-xs"
                      onClick={() => onOpenBank(source)}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      開く
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">未設定</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
