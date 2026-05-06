import { ArrowLeft, Save } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow } from "../components/InfoRow";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { SectionTitle } from "../components/SectionTitle";
import { formatMoney, formatPaybackMonths, formatRate } from "../lib/formatters";
import type { RefinanceCostBreakdown, RefinanceResult, ScenarioRate } from "../types";

type RefinanceBenefitPageProps = {
  result: RefinanceResult;
  costBreakdown: RefinanceCostBreakdown;
  selectedScenario: ScenarioRate;
  onBack: () => void;
  onSaveCandidate: () => void;
};

export function RefinanceBenefitPage({
  result,
  costBreakdown,
  selectedScenario,
  onBack,
  onSaveCandidate,
}: RefinanceBenefitPageProps) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">借換え候補の概算</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
          借換えメリット
        </h1>
      </header>

      <Card tone="blue">
        <p className="text-sm font-bold text-slate-800">
          比較前提: 選択中シナリオ {formatRate(selectedScenario.rate)}
        </p>
        <p className="mt-1 text-xs text-slate-500">シナリオメモ: {selectedScenario.memo}</p>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="借換え試算" />
        <dl>
          <InfoRow
            label="現在ローンの残り総返済額"
            value={formatMoney(result.currentRemainingTotalPayment)}
            emphasis
          />
          <InfoRow
            label="借換え後の総返済額"
            value={formatMoney(result.refinanceRemainingTotalPayment)}
            emphasis
          />
          <InfoRow label="借換え諸費用" value={formatMoney(result.refinanceCosts)} />
        </dl>
      </Card>

      <Card tone="green" className="space-y-3">
        <SectionTitle title="実質メリット" />
        <MoneyDisplay
          label="概算メリット"
          value={result.netBenefit}
          helper="総返済額差から諸費用を差し引いた目安"
          tone="positive"
        />
        <dl>
          <InfoRow
            label="毎月差額"
            value={`-${formatMoney(Math.abs(result.monthlyDifference))}`}
            emphasis
          />
          <InfoRow label="回収期間" value={formatPaybackMonths(result.paybackMonths)} />
          <InfoRow label="判定" value={result.judgement} emphasis />
        </dl>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="諸費用内訳" />
        <dl>
          <InfoRow label="融資手数料" value={formatMoney(costBreakdown.loanFee)} />
          <InfoRow label="登記費用" value={formatMoney(costBreakdown.registrationFee)} />
          <InfoRow
            label="司法書士費用"
            value={formatMoney(costBreakdown.judicialScrivenerFee)}
          />
          <InfoRow label="印紙代" value={formatMoney(costBreakdown.stampDuty)} />
          <InfoRow
            label="全額繰上返済手数料"
            value={formatMoney(costBreakdown.prepaymentFee)}
          />
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Button fullWidth onClick={onSaveCandidate}>
          <Save className="h-5 w-5" aria-hidden="true" />
          この候補を保存
        </Button>
        <Button variant="secondary" fullWidth onClick={onBack}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          比較表へ戻る
        </Button>
      </div>
    </div>
  );
}
