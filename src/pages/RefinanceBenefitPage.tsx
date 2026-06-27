import { ArrowLeft } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow } from "../components/InfoRow";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { PaymentBasisNotice } from "../components/PaymentBasisNotice";
import { SectionTitle } from "../components/SectionTitle";
import {
  formatMoney,
  formatPaybackMonths,
  formatRate,
  formatSignedMoney,
} from "../lib/formatters";
import type {
  LoanPaymentBasisStatus,
  LoanProfile,
  RefinanceCostBreakdown,
  RefinanceResult,
} from "../types";

type RefinanceBenefitPageProps = {
  result: RefinanceResult | null;
  costBreakdown: RefinanceCostBreakdown;
  loan: LoanProfile;
  paymentBasis: LoanPaymentBasisStatus;
  onBack: () => void;
};

function formatDifferenceAsSaving(value: number): string {
  if (value > 0) {
    return `${formatMoney(value)}安い`;
  }
  if (value < 0) {
    return `${formatMoney(Math.abs(value))}高い`;
  }
  return "差なし";
}

export function RefinanceBenefitPage({
  result,
  costBreakdown,
  loan,
  paymentBasis,
  onBack,
}: RefinanceBenefitPageProps) {
  if (!result) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-xs font-bold text-navy-700">借換え候補の概算</p>
          <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
            最新取得済みの候補がありません
          </h1>
        </header>

        <Card tone="amber" className="space-y-3">
          <SectionTitle title="候補選定の条件" />
          <p className="text-sm font-semibold leading-6 text-amber-900">
            借換え候補は、当月の公式アダプタ取得値または公式確認済み手入力値のうち、入力済みの年齢・融資率・残期間・団信条件に適合した金利だけから選びます。参考値、前月値（参考）、Wayback値、条件不足の銀行は候補にしません。
          </p>
        </Card>

        <PaymentBasisNotice loan={loan} paymentBasis={paymentBasis} />

        <Card className="space-y-3">
          <SectionTitle title="次の操作（推奨順）" />
          <ol className="ml-4 list-decimal space-y-1 text-sm leading-6 text-slate-700">
            <li>マイローン設定の生年月日・概算物件価値・団信区分が埋まっているか確認する</li>
            <li>比較表で「前月値（参考）」「取得失敗」になっている銀行の公式ページを開き、当月の変動金利を確認する</li>
            <li>比較表の手入力補正に当月金利・適用年月を入力し、「公式確認済み」にチェックを入れて「再判定」を押す</li>
            <li>条件適合した候補が1行でもできれば、このページに自動で借換えメリットが表示される</li>
          </ol>
        </Card>

        <Button fullWidth onClick={onBack}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          比較表へ戻る
        </Button>
      </div>
    );
  }

  const benefitCardTone = result.netBenefit >= 0 ? "green" : "amber";
  const benefitHelper =
    result.netBenefit >= 0
      ? "残り総返済額差から借換え諸費用を差し引いた見込みプラス"
      : "諸費用を含めると、現在条件を続ける方が有利な見込み";

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">借換え候補の概算</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
          現在条件との差額
        </h1>
      </header>

      <Card tone="blue" className="space-y-3">
        <SectionTitle title="比較しているもの" />
        <dl>
          <InfoRow
            label="比較元"
            value={`${loan.bankName} 現在条件 ${formatRate(loan.currentRate)}`}
            emphasis
          />
          <InfoRow
            label="借換え候補"
            value={`${result.candidateBankName} ${formatRate(result.candidateRate)}`}
            emphasis
          />
          <InfoRow
            label="適用年月"
            value={result.candidateApplicableMonth ?? "不明"}
          />
          <InfoRow
            label="取得元"
            value={
              result.candidateSourceKind === "official-api"
                ? "公式API"
                : result.candidateSourceKind === "official-html"
                  ? "公式HTML"
                  : result.candidateSourceKind === "manual-verified"
                    ? "公式確認済み手入力"
                    : "参考値"
            }
          />
        </dl>
        <p className="rounded-lg bg-white px-3 py-3 text-xs leading-5 text-slate-600">
          当月・公式・条件適合の候補から使用金利が最も低い銀行を自動選択しています。広告下限や総合サイト値だけでは候補にしません。下の金額は、同じ残高・残期間で現在金利を続けた場合と、候補金利へ借換えた場合の概算差です。
        </p>
        {result.candidateEligibilityReason ? (
          <p className="text-xs leading-5 text-slate-600">条件判定: {result.candidateEligibilityReason}</p>
        ) : null}
      </Card>

      <PaymentBasisNotice loan={loan} paymentBasis={paymentBasis} />

      {result.candidateReviewWarning ? (
        <Card tone="amber">
          <p className="text-sm font-semibold leading-6 text-amber-900">
            {result.candidateReviewWarning}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <SectionTitle title="返済額の比較" />
        <dl>
          <InfoRow label="現在の毎月返済額" value={formatMoney(result.baseMonthlyPayment)} />
          <InfoRow
            label="候補の毎月返済額"
            value={formatMoney(result.candidateMonthlyPayment)}
          />
          <InfoRow
            label="毎月返済の差"
            value={formatDifferenceAsSaving(result.monthlyDifference)}
            emphasis
          />
          <InfoRow label="現在のボーナス返済額" value={formatMoney(result.baseBonusPayment)} />
          <InfoRow
            label="候補のボーナス返済額"
            value={formatMoney(result.candidateBonusPayment)}
          />
          <InfoRow
            label="ボーナス返済の差"
            value={formatDifferenceAsSaving(result.bonusDifference)}
            emphasis
          />
          <InfoRow
            label="平均月換算の差"
            value={formatDifferenceAsSaving(Math.round(result.averageMonthlyDifference))}
          />
        </dl>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="残り総返済額の比較" />
        <dl>
          <InfoRow
            label="現在条件を続けた場合"
            value={formatMoney(result.currentRemainingTotalPayment)}
            emphasis
          />
          <InfoRow
            label="候補金利へ借換えた場合"
            value={formatMoney(result.refinanceRemainingTotalPayment)}
            emphasis
          />
          <InfoRow
            label="残り総返済額差"
            value={formatSignedMoney(result.totalPaymentDifference)}
          />
          <InfoRow label="借換え諸費用" value={formatMoney(result.refinanceCosts)} />
        </dl>
      </Card>

      <Card tone={benefitCardTone} className="space-y-3">
        <SectionTitle title="諸費用差引後" />
        <MoneyDisplay
          label="概算メリット"
          value={result.netBenefit}
          helper={benefitHelper}
          tone={result.netBenefit >= 0 ? "positive" : "negative"}
        />
        <p className="rounded-lg bg-white px-3 py-3 text-xs leading-5 text-slate-700">
          実質メリット = 残り総返済額差 {formatSignedMoney(result.totalPaymentDifference)} -
          借換え諸費用 {formatMoney(result.refinanceCosts)} = {formatSignedMoney(result.netBenefit)}
        </p>
        <dl>
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
        <Button fullWidth onClick={onBack}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          比較表へ戻る
        </Button>
      </div>
    </div>
  );
}
