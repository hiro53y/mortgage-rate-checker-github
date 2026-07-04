import { BarChart3, ExternalLink } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow } from "../components/InfoRow";
import { ScenarioCard } from "../components/ScenarioCard";
import { SectionTitle } from "../components/SectionTitle";
import { formatRate, formatSignedRate } from "../lib/formatters";
import { calculateRateDifference, currentRateNegotiationSummary } from "../lib/scenarioMath";
import type { LoanProfile, ScenarioRate } from "../types";

type ScenarioPageProps = {
  loan: LoanProfile;
  scenarios: ScenarioRate[];
  lowerRate: number;
  lowerRateApplicableMonth?: string;
  onComparison: () => void;
  onOpenOfficial: () => void;
};

export function ScenarioPage({
  loan,
  scenarios,
  lowerRate,
  lowerRateApplicableMonth,
  onComparison,
  onOpenOfficial,
}: ScenarioPageProps) {
  const rateDifference = calculateRateDifference(loan.currentRate, lowerRate);
  const summary = currentRateNegotiationSummary(loan.currentRate, lowerRate);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">現在金利の判定</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
          {summary.title}
        </h1>
      </header>

      <Card tone={summary.tone} className="space-y-4">
        <dl>
          <InfoRow label="現在の適用金利" value={formatRate(loan.currentRate)} emphasis />
          <InfoRow
            label={`もみじ銀行の新規向け下限金利${lowerRateApplicableMonth ? `（${lowerRateApplicableMonth} 自動取得）` : "（基準値）"}`}
            value={formatRate(lowerRate)}
            emphasis
          />
          <InfoRow label="差（現在 - 下限金利）" value={formatSignedRate(rateDifference)} />
        </dl>
        <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-navy-800">
          判定式: {formatRate(loan.currentRate)} - {formatRate(lowerRate)} ={" "}
          {formatSignedRate(rateDifference)}
        </p>
        <p className="rounded-lg bg-white px-3 py-3 text-sm leading-6 text-slate-700">
          {summary.message}
        </p>
      </Card>

      <SectionTitle
        title="将来シナリオ別試算"
        subtitle={`表示額は同じ残高・残期間で再計算した概算です。差額は現在金利${formatRate(loan.currentRate)}相当の概算返済額との比較です。`}
      />

      <div className="space-y-3">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            lowerRate={lowerRate}
            currentRate={loan.currentRate}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button fullWidth onClick={onComparison}>
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
          銀行比較を見る
        </Button>
        <Button variant="secondary" fullWidth onClick={onOpenOfficial}>
          <ExternalLink className="h-5 w-5" aria-hidden="true" />
          公式ページを開く
        </Button>
      </div>
    </div>
  );
}
