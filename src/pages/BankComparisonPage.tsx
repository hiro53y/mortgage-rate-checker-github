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
  onRecalculateRow: (rowId: string, manualRate: number | null) => void;
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
  const hasFetchedRefinanceCandidate = rows.some(isLatestFetchedCandidate);

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
          <InfoRow label="表の差額期間" value="144か月（12年）" />
        </dl>
        <p className="text-xs text-slate-500">
          各銀行候補は、同じ残高・残期間で月返済とボーナス返済を概算します。表の差額は「比較用の月返済」と候補月返済の12年差額目安です。借換え候補は、最新金利を自動取得できた銀行の中から判定使用金利が最も低い銀行を選びます。
        </p>
      </Card>

      {!hasFetchedRefinanceCandidate ? (
        <Card tone="amber">
          <p className="text-sm font-semibold leading-6 text-amber-900">
            最新金利を自動取得できた候補銀行がまだありません。未取得・取得失敗・サンプル値だけの銀行は借換え候補にしません。「再取得」を押すか、公式ページで確認して手入力補正してください。
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
        12年差額目安 = （比較用の月返済 - 候補の月返済）× 144か月。手入力補正がある場合は手入力値を優先して概算再判定します。借換え候補選定では、自動取得できていない銀行を除外します。
      </p>

      <Button fullWidth onClick={onRefinance}>
        <Calculator className="h-5 w-5" aria-hidden="true" />
        借換えメリットを見る
      </Button>
    </div>
  );
}
