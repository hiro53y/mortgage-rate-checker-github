import { AlertTriangle, TrendingUp } from "lucide-react";
import type { ScenarioRate } from "../types";
import { formatApproxMoney, formatApproxSignedMoney, formatRate } from "../lib/formatters";
import { areRatesEqual, scenarioJudgementText, shouldSuggestNegotiation } from "../lib/scenarioMath";
import { Card } from "./Card";
import { InfoRow } from "./InfoRow";
import { RateBadge } from "./RateBadge";

type ScenarioCardProps = {
  scenario: ScenarioRate;
  lowerRate: number;
  currentRate: number;
};

export function ScenarioCard({ scenario, lowerRate, currentRate }: ScenarioCardProps) {
  const suggestNegotiation = shouldSuggestNegotiation(scenario.rate, lowerRate);
  const matchesCurrentRate = areRatesEqual(scenario.rate, currentRate);
  const isLowerThanCurrent = scenario.rate < currentRate && !matchesCurrentRate;
  const tone = suggestNegotiation ? "amber" : isLowerThanCurrent ? "green" : "default";
  const alertText = matchesCurrentRate
    ? "現在条件は交渉検討水準"
    : `${formatRate(scenario.rate)}は下限金利超過`;

  return (
    <Card tone={tone} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-950">{scenario.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            シナリオ金利: {formatRate(scenario.rate)} / {scenario.memo}
          </p>
        </div>
        <RateBadge value={scenario.rate} tone={suggestNegotiation ? "amber" : "blue"} />
      </div>

      {suggestNegotiation ? (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-amber-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {alertText}
        </div>
      ) : null}

      <dl>
        <InfoRow label="毎月返済額" value={formatApproxMoney(scenario.monthlyPayment)} emphasis />
        <InfoRow label="ボーナス返済額" value={formatApproxMoney(scenario.bonusPayment)} />
        <InfoRow
          label="年間差額（現在比）"
          value={formatApproxSignedMoney(scenario.annualIncrease)}
        />
      </dl>

      <p className="flex gap-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-700">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" aria-hidden="true" />
        {scenarioJudgementText(scenario.rate, lowerRate, currentRate)}
      </p>
    </Card>
  );
}
