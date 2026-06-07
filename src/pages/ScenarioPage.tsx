import { BarChart3, ExternalLink } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow } from "../components/InfoRow";
import { ScenarioCard } from "../components/ScenarioCard";
import { SectionTitle } from "../components/SectionTitle";
import { formatRate, formatSignedRate } from "../lib/formatters";
import { MOMIJI_LOWER_RATE } from "../lib/sampleData";
import { calculateRateDifference, currentRateNegotiationSummary } from "../lib/scenarioMath";
import type { LoanProfile, ScenarioRate } from "../types";

type ScenarioPageProps = {
  loan: LoanProfile;
  scenarios: ScenarioRate[];
  onComparison: () => void;
  onOpenOfficial: () => void;
};

export function ScenarioPage({
  loan,
  scenarios,
  onComparison,
  onOpenOfficial,
}: ScenarioPageProps) {
  const rateDifference = calculateRateDifference(loan.currentRate, MOMIJI_LOWER_RATE);
  const summary = currentRateNegotiationSummary(loan.currentRate, MOMIJI_LOWER_RATE);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">金利変更シナリオ</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
          {summary.title}
        </h1>
      </header>

      <Card tone={summary.tone} className="space-y-4">
        <dl>
          <InfoRow label="現在の適用金利" value={formatRate(loan.currentRate)} emphasis />
          <InfoRow
            label="もみじ銀行の新規向け下限金利"
            value={formatRate(MOMIJI_LOWER_RATE)}
            emphasis
          />
          <InfoRow label="差（現在 - 下限金利）" value={formatSignedRate(rateDifference)} />
        </dl>
        <p className="rounded-lg bg-white px-3 py-3 text-sm leading-6 text-slate-700">
          {summary.message}
        </p>
      </Card>

      <SectionTitle title="金利変更シナリオ" subtitle="表示額は登録済み条件に基づく概算です。" />

      <div className="space-y-3">
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} lowerRate={MOMIJI_LOWER_RATE} />
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
