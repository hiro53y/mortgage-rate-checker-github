import { Calculator, RefreshCw } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ComparisonTable } from "../components/ComparisonTable";
import { InfoRow } from "../components/InfoRow";
import { PaymentBasisNotice } from "../components/PaymentBasisNotice";
import { SectionTitle } from "../components/SectionTitle";
import { isLatestFetchedCandidate } from "../lib/comparisonMath";
import { formatDateTimeJa, formatMoney, formatRate } from "../lib/formatters";
import type {
  BankComparisonRow,
  BankRateSource,
  LoanPaymentBasisStatus,
  LoanProfile,
  ManualRateVerification,
} from "../types";

type BankComparisonPageProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  loan: LoanProfile;
  paymentBasis: LoanPaymentBasisStatus;
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
  onRecalculateRow: (rowId: string, verification: ManualRateVerification) => void;
  onRefinance: () => void;
};

export function BankComparisonPage({
  rows,
  sources,
  loan,
  paymentBasis,
  rateFetchState,
  isFetchingRates,
  onOpenBank,
  onRefreshRates,
  onRecalculateRow,
  onRefinance,
}: BankComparisonPageProps) {
  const hasFetchedRefinanceCandidate = rows.some((row) => isLatestFetchedCandidate(row));

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold text-navy-700">主要銀行を横並び比較</p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">銀行比較表</h1>
      </header>

      <Card tone="blue" className="space-y-2">
        <SectionTitle title="比較の基準" />
        <dl>
          <InfoRow label="比較元" value={`${loan.bankName} 現在条件`} emphasis />
          <InfoRow label="現在適用金利" value={formatRate(loan.currentRate)} />
          <InfoRow label="比較用の月返済" value={formatMoney(paymentBasis.baselineMonthlyPayment)} />
          <InfoRow
            label="比較用のボーナス返済"
            value={formatMoney(paymentBasis.baselineBonusPayment)}
          />
          <InfoRow label="登録済み月返済" value={formatMoney(loan.monthlyPayment)} />
          {paymentBasis.isNextPaymentDatePast ? (
            <InfoRow label="試算用の次回返済日" value={paymentBasis.effectiveNextPaymentDate} />
          ) : null}
          <InfoRow label="残期間" value={`${paymentBasis.remainingMonths}か月`} />
          <InfoRow
            label="借入者の生年月日"
            value={loan.borrowerBirthDate ?? "未入力（条件判定不可）"}
          />
          <InfoRow
            label="概算物件価値"
            value={
              loan.estimatedPropertyValue
                ? formatMoney(loan.estimatedPropertyValue)
                : "未入力（融資率判定不可）"
            }
          />
          <InfoRow label="表の差額期間" value="144か月（12年）" />
        </dl>
        <p className="text-xs text-slate-500">
          各銀行候補は、同じ残高・残期間で月返済とボーナス返済を概算します。公式取得できない銀行は、価格.comの借換えランキングとダイヤモンド不動産の銀行別ページを照合して表示します。借換え候補は、当月の公式値または公式確認済み手入力値のうち、年齢・融資率・残期間・団信条件に適合した金利だけから選びます。
        </p>
      </Card>

      {!hasFetchedRefinanceCandidate ? (
        <Card tone="amber">
          <p className="text-sm font-semibold leading-6 text-amber-900">
            推薦条件を満たす候補がありません。当月の公式取得値でも、生年月日・概算物件価値・団信上乗せが未確定なら候補にしません。条件入力を確認するか、公式ページで確認した金利・適用年月を手入力してください。
          </p>
        </Card>
      ) : null}

      <PaymentBasisNotice loan={loan} paymentBasis={paymentBasis} />

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
        12年差額目安 = （比較用の月返済 - 候補の月返済）× 144か月。総合サイト値は取得元と照合状態を表示します。複数情報源で一致しても、団信・審査・優遇条件が未確定なら借換え推薦から除外します。
      </p>

      <Button fullWidth onClick={onRefinance}>
        <Calculator className="h-5 w-5" aria-hidden="true" />
        借換えメリットを見る
      </Button>
    </div>
  );
}
