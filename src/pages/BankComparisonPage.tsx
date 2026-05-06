import { Calculator, RefreshCw } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ComparisonTable } from "../components/ComparisonTable";
import { SectionTitle } from "../components/SectionTitle";
import { formatDateTimeJa, formatRate } from "../lib/formatters";
import type { BankComparisonRow, BankRateSource, ScenarioRate } from "../types";

type BankComparisonPageProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  selectedScenario: ScenarioRate;
  rateFetchState?: {
    checkedMonth?: string;
    lastAttemptAt?: string;
    lastSuccessfulAt?: string;
    source?: "api" | "manual" | "sample";
    message?: string;
  };
  isFetchingRates: boolean;
  onOpenBank: (source: BankRateSource, rowId: string) => void;
  onRefreshRates: () => void;
  onRecalculateRow: (rowId: string, manualRate: number | null) => void;
  onRefinance: () => void;
};

export function BankComparisonPage({
  rows,
  sources,
  selectedScenario,
  rateFetchState,
  isFetchingRates,
  onOpenBank,
  onRefreshRates,
  onRecalculateRow,
  onRefinance,
}: BankComparisonPageProps) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">主要銀行を横並び比較</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">銀行比較表</h1>
      </header>

      <Card tone="blue" className="space-y-2">
        <SectionTitle title="比較条件" />
        <p className="text-sm font-bold text-slate-800">
          選択中シナリオ {formatRate(selectedScenario.rate)} / 元利均等 / がん団信込み
        </p>
        <p className="text-xs text-slate-500">シナリオメモ: {selectedScenario.memo}</p>
        <p className="text-xs text-slate-500">
          自動取得値は誤取得の可能性があります。公式確認と手入力補正を優先してください。
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionTitle title="金利データ取得状況" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {rateFetchState?.message ?? "未取得。サンプルデータを表示中です。"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              最終試行: {formatDateTimeJa(rateFetchState?.lastAttemptAt)} / 成功:
              {formatDateTimeJa(rateFetchState?.lastSuccessfulAt)}
            </p>
          </div>
          <Button
            variant="secondary"
            className="min-h-10 shrink-0 px-3 py-2 text-xs"
            disabled={isFetchingRates}
            onClick={onRefreshRates}
          >
            <RefreshCw className={`h-4 w-4 ${isFetchingRates ? "animate-spin" : ""}`} aria-hidden="true" />
            再取得
          </Button>
        </div>
      </Card>

      <ComparisonTable
        rows={rows}
        sources={sources}
        onOpenBank={onOpenBank}
        onRecalculate={onRecalculateRow}
      />

      <p className="text-xs leading-5 text-slate-500">
        実質メリットは、もみじ銀行（選択中シナリオ）との差額を12年分の目安で表示しています。手入力補正がある場合は手入力値を優先して概算再判定します。
      </p>

      <Button fullWidth onClick={onRefinance}>
        <Calculator className="h-5 w-5" aria-hidden="true" />
        借換えメリットを見る
      </Button>
    </div>
  );
}
