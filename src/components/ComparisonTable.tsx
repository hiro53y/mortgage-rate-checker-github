import { ExternalLink, RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { BankComparisonRow, BankRateSource } from "../types";
import { formatDateTimeJa, formatManYen, formatMoney, formatRate } from "../lib/formatters";
import { getRateStatus, getRateUsedForCalculation } from "../lib/comparisonMath";
import { Button } from "./Button";

type ComparisonTableProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  onOpenBank: (source: BankRateSource, rowId: string) => void;
  onRecalculate: (rowId: string, manualRate: number | null) => void;
};

const statusLabels: Record<NonNullable<BankComparisonRow["rateStatus"]>, string> = {
  sample: "サンプル",
  auto: "自動取得",
  manual: "手入力",
  failed: "取得失敗",
};

const statusClasses: Record<NonNullable<BankComparisonRow["rateStatus"]>, string> = {
  sample: "bg-slate-100 text-slate-600",
  auto: "bg-navy-50 text-navy-800",
  manual: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export function ComparisonTable({
  rows,
  sources,
  onOpenBank,
  onRecalculate,
}: ComparisonTableProps) {
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextInputs: Record<string, string> = {};
    rows.forEach((row) => {
      nextInputs[row.id] =
        row.manualOverrideRate !== undefined ? String(row.manualOverrideRate) : "";
    });
    setManualInputs(nextInputs);
  }, [rows]);

  const findSource = (row: BankComparisonRow) =>
    sources.find((source) => row.bankName.includes(source.bankName));

  const parseManualRate = (rowId: string) => {
    const value = manualInputs[rowId]?.trim();
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft">
      <table className="min-w-[1180px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-3 font-bold">銀行名</th>
            <th className="px-3 py-3 font-bold">自動取得値</th>
            <th className="px-3 py-3 font-bold">手入力補正</th>
            <th className="px-3 py-3 font-bold">判定使用</th>
            <th className="px-3 py-3 font-bold">保障</th>
            <th className="px-3 py-3 font-bold">月返済</th>
            <th className="px-3 py-3 font-bold">実質メリット</th>
            <th className="px-3 py-3 font-bold">公式確認</th>
            <th className="px-3 py-3 font-bold">判定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const source = findSource(row);
            const status = getRateStatus(row);
            const usedRate = getRateUsedForCalculation(row);
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
                  {row.fetchError ? (
                    <p className="mt-1 text-xs font-normal text-red-600">{row.fetchError}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <p className="font-black text-navy-800">
                    {row.autoFetchedRate !== undefined ? formatRate(row.autoFetchedRate) : "未取得"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.lastFetchedAt ? formatDateTimeJa(row.lastFetchedAt) : "取得日時なし"}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <input
                    inputMode="decimal"
                    aria-label={`${row.bankName}の手入力補正金利`}
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100"
                    placeholder="例 0.920"
                    value={manualInputs[row.id] ?? ""}
                    onChange={(event) =>
                      setManualInputs((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">空欄なら自動/サンプル値</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-black text-navy-800">{formatRate(usedRate)}</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold ${statusClasses[status]}`}
                  >
                    {statusLabels[status]}
                  </span>
                </td>
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
                      onClick={() => onOpenBank(source, row.id)}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      公式を開く
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">未設定</span>
                  )}
                  {row.officialCheckedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      確認: {formatDateTimeJa(row.officialCheckedAt)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <Button
                    variant="primary"
                    className="min-h-9 px-3 py-2 text-xs"
                    onClick={() => onRecalculate(row.id, parseManualRate(row.id))}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    再判定
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
