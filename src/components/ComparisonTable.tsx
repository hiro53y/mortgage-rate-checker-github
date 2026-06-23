import { AlertTriangle, ExternalLink, RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { BankComparisonRow, BankRateSource, ManualRateVerification } from "../types";
import { formatDateTimeJa, formatManYen, formatMoney, formatRate } from "../lib/formatters";
import { getRateStatus, getRateUsedForCalculation } from "../lib/comparisonMath";
import { Button } from "./Button";
import { InfoRow } from "./InfoRow";

type ComparisonTableProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  onOpenBank: (source: BankRateSource, rowId: string) => void;
  onRecalculate: (rowId: string, verification: ManualRateVerification) => void;
};

const statusLabels: Record<NonNullable<BankComparisonRow["rateStatus"]>, string> = {
  sample: "サンプル",
  auto: "自動取得",
  manual: "手入力",
  reference: "参考値",
  stale: "前回値",
  failed: "取得失敗",
};

const statusClasses: Record<NonNullable<BankComparisonRow["rateStatus"]>, string> = {
  sample: "bg-slate-100 text-slate-600",
  auto: "bg-navy-50 text-navy-800",
  manual: "bg-emerald-50 text-emerald-700",
  reference: "bg-amber-50 text-amber-800",
  stale: "bg-slate-100 text-slate-600",
  failed: "bg-red-50 text-red-700",
};

const sourceLabels = {
  "official-api": "公式API",
  "official-html": "公式HTML",
  aggregator: "総合サイト",
  "manual-verified": "公式確認済み手入力",
};

const eligibilityLabels = {
  eligible: "条件適合",
  conditional: "条件付き",
  ineligible: "対象外",
  unknown: "条件不足",
};

const confidenceLabels = {
  verified: "公式構造化データ",
  corroborated: "複数情報源で一致",
  review: "単一情報源・要確認",
  failed: "取得失敗",
};

function getEvidenceSourceLabel(row: BankComparisonRow) {
  const labels = (row.rateOffer?.evidence ?? []).map((evidence) => {
    if (evidence.sourceKind === "official-api") return "公式API";
    if (evidence.sourceUrl.includes("kakaku.com")) return "価格.com";
    if (evidence.sourceUrl.includes("diamond-fudosan.jp")) return "ダイヤモンド不動産";
    if (evidence.sourceKind === "official-html") return "公式サイト";
    return "参考サイト";
  });
  return [...new Set(labels)].join("・") || "なし";
}

export function ComparisonTable({
  rows,
  sources,
  onOpenBank,
  onRecalculate,
}: ComparisonTableProps) {
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [manualMonths, setManualMonths] = useState<Record<string, string>>({});
  const [manualConfirmed, setManualConfirmed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const nextInputs: Record<string, string> = {};
    const nextMonths: Record<string, string> = {};
    const nextConfirmed: Record<string, boolean> = {};
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    rows.forEach((row) => {
      nextInputs[row.id] =
        row.manualOverrideRate !== undefined ? String(row.manualOverrideRate) : "";
      nextMonths[row.id] = row.manualApplicableMonth ?? currentMonth;
      nextConfirmed[row.id] = Boolean(row.manualVerifiedAt);
    });
    setManualInputs(nextInputs);
    setManualMonths(nextMonths);
    setManualConfirmed(nextConfirmed);
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

  const buildVerification = (
    rowId: string,
    source: BankRateSource | undefined,
  ): ManualRateVerification => ({
    rate: parseManualRate(rowId),
    confirmed: Boolean(manualConfirmed[rowId]),
    applicableMonth: manualMonths[rowId],
    sourceUrl: source?.rateUrl,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const source = findSource(row);
          const status = getRateStatus(row);
          const usedRate = getRateUsedForCalculation(row);
          const primaryRate = row.manualOverrideRate ?? row.conditionMatchedRate;
          const canShowCalculation =
            row.rowKind === "base" || primaryRate !== undefined || !row.rateOffer;
          return (
            <div
              key={row.id}
              className={`rounded-lg border p-3 shadow-soft ${
                row.isPriorityCandidate
                  ? "border-navy-100 bg-navy-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {row.isPriorityCandidate ? (
                      <Star className="h-4 w-4 fill-navy-700 text-navy-700" aria-hidden="true" />
                    ) : null}
                    <h3 className="text-sm font-black text-slate-950">{row.bankName}</h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{row.note}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-black text-navy-800">
                    {row.rowKind === "base"
                      ? formatRate(usedRate)
                      : primaryRate !== undefined
                        ? formatRate(primaryRate)
                        : "算定不可"}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold ${statusClasses[status]}`}
                  >
                    {statusLabels[status]}
                  </span>
                </div>
              </div>

              {row.fetchError ? (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
                  {row.fetchError}
                </p>
              ) : null}

              <dl className="mt-3 rounded-lg bg-white/80 px-3 py-2">
                {row.rowKind !== "base" ? (
                  <>
                    <InfoRow
                      label="条件適合金利"
                      value={row.conditionMatchedRate !== undefined ? formatRate(row.conditionMatchedRate) : "算定不可"}
                      emphasis
                    />
                    <InfoRow
                      label="広告下限金利"
                      value={row.advertisedMinRate !== undefined ? formatRate(row.advertisedMinRate) : "未取得"}
                    />
                    <InfoRow label="適用年月" value={row.applicableMonth ?? "不明"} />
                    <InfoRow
                      label="取得元"
                      value={row.sourceKind ? sourceLabels[row.sourceKind] : "未取得"}
                    />
                    <InfoRow
                      label="照合状態"
                      value={row.confidence ? confidenceLabels[row.confidence] : "未確認"}
                    />
                    <InfoRow label="照合元" value={getEvidenceSourceLabel(row)} />
                    <InfoRow
                      label="適合状態"
                      value={eligibilityLabels[row.eligibility ?? "unknown"]}
                    />
                  </>
                ) : null}
                <InfoRow
                  label="月返済"
                  value={canShowCalculation ? formatMoney(row.monthlyPayment) : "算定不可"}
                />
                <InfoRow
                  label="ボーナス返済"
                  value={
                    canShowCalculation && row.bonusPayment !== undefined
                      ? formatMoney(row.bonusPayment)
                      : "算定不可"
                  }
                />
                <InfoRow
                  label="12年月返済差"
                  value={canShowCalculation ? formatManYen(row.netBenefit) : "算定不可"}
                  emphasis
                />
                <InfoRow label="保障" value={row.insuranceLevel} />
              </dl>

              {row.eligibilityReason && row.rowKind !== "base" ? (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {row.eligibilityReason}
                </p>
              ) : null}

              {row.rowKind !== "base" ? <div className="mt-3 space-y-2">
                <input
                  inputMode="decimal"
                  aria-label={`${row.bankName}の手入力補正金利`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100"
                  placeholder="手入力補正 例 0.920"
                  value={manualInputs[row.id] ?? ""}
                  onChange={(event) =>
                    setManualInputs((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))
                  }
                />
                <input
                  type="month"
                  aria-label={`${row.bankName}の手入力金利の適用年月`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100"
                  value={manualMonths[row.id] ?? ""}
                  onChange={(event) =>
                    setManualMonths((current) => ({ ...current, [row.id]: event.target.value }))
                  }
                />
                <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={Boolean(manualConfirmed[row.id])}
                    onChange={(event) =>
                      setManualConfirmed((current) => ({ ...current, [row.id]: event.target.checked }))
                    }
                  />
                  公式ページで借換え・変動・団信条件を確認済み
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {source ? (
                    <Button
                      variant="secondary"
                      className="min-h-10 px-3 py-2 text-xs"
                      onClick={() => onOpenBank(source, row.id)}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      公式
                    </Button>
                  ) : (
                    <span className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs text-slate-400">
                      公式未設定
                    </span>
                  )}
                  <Button
                    variant="primary"
                    className="min-h-10 px-3 py-2 text-xs"
                    onClick={() => onRecalculate(row.id, buildVerification(row.id, source))}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    再判定
                  </Button>
                </div>
              </div> : null}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-soft md:block">
        <table className="min-w-[1320px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-3 font-bold">銀行名</th>
            <th className="px-3 py-3 font-bold">条件適合 / 広告下限</th>
            <th className="px-3 py-3 font-bold">手入力補正</th>
            <th className="px-3 py-3 font-bold">判定使用</th>
            <th className="px-3 py-3 font-bold">保障</th>
            <th className="px-3 py-3 font-bold">月返済</th>
            <th className="px-3 py-3 font-bold">ボーナス返済</th>
            <th className="px-3 py-3 font-bold">12年累計差（月返済分）</th>
            <th className="px-3 py-3 font-bold">取得元 / 適用年月</th>
            <th className="px-3 py-3 font-bold">判定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const source = findSource(row);
            const status = getRateStatus(row);
            const usedRate = getRateUsedForCalculation(row);
            const canShowCalculation =
              row.rowKind === "base" ||
              row.manualOverrideRate !== undefined ||
              row.conditionMatchedRate !== undefined ||
              !row.rateOffer;
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
                    {row.conditionMatchedRate !== undefined ? formatRate(row.conditionMatchedRate) : "算定不可"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    下限 {row.advertisedMinRate !== undefined ? formatRate(row.advertisedMinRate) : "未取得"}
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
                  <input
                    type="month"
                    className="mt-2 w-28 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold"
                    value={manualMonths[row.id] ?? ""}
                    onChange={(event) =>
                      setManualMonths((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                  />
                  <label className="mt-2 flex w-32 items-start gap-2 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={Boolean(manualConfirmed[row.id])}
                      onChange={(event) =>
                        setManualConfirmed((current) => ({ ...current, [row.id]: event.target.checked }))
                      }
                    />
                    公式確認済み
                  </label>
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
                <td className="px-3 py-3 font-bold text-slate-900">
                  {canShowCalculation ? formatMoney(row.monthlyPayment) : "算定不可"}
                </td>
                <td className="px-3 py-3 font-bold text-slate-900">
                  {canShowCalculation && row.bonusPayment !== undefined
                    ? formatMoney(row.bonusPayment)
                    : "算定不可"}
                </td>
                <td
                  className={`px-3 py-3 font-black ${
                    row.netBenefit === null
                      ? "text-slate-700"
                      : row.netBenefit >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                  }`}
                >
                  {canShowCalculation ? formatManYen(row.netBenefit) : "算定不可"}
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
                  <p className="mt-2 text-xs text-slate-500">
                    {row.sourceKind ? sourceLabels[row.sourceKind] : "未取得"} / {row.applicableMonth ?? "年月不明"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {eligibilityLabels[row.eligibility ?? "unknown"]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.confidence ? confidenceLabels[row.confidence] : "未確認"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    照合元: {getEvidenceSourceLabel(row)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Button
                    variant="primary"
                    className="min-h-9 px-3 py-2 text-xs"
                    onClick={() => onRecalculate(row.id, buildVerification(row.id, source))}
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
    </div>
  );
}
