import { Calculator } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ComparisonTable } from "../components/ComparisonTable";
import { SectionTitle } from "../components/SectionTitle";
import { formatRate } from "../lib/formatters";
import type { BankComparisonRow, BankRateSource, ScenarioRate } from "../types";

type BankComparisonPageProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  selectedScenario: ScenarioRate;
  onOpenBank: (source: BankRateSource) => void;
  onRefinance: () => void;
};

export function BankComparisonPage({
  rows,
  sources,
  selectedScenario,
  onOpenBank,
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
        <p className="text-xs text-slate-500">サンプルデータ / 公式ページ要確認</p>
      </Card>

      <ComparisonTable rows={rows} sources={sources} onOpenBank={onOpenBank} />

      <p className="text-xs leading-5 text-slate-500">
        実質メリットは、もみじ銀行（選択中シナリオ）との差額を目安で表示しています。
      </p>

      <Button fullWidth onClick={onRefinance}>
        <Calculator className="h-5 w-5" aria-hidden="true" />
        借換えメリットを見る
      </Button>
    </div>
  );
}
