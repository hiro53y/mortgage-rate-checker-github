import { Calculator, RefreshCw } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ComparisonTable } from "../components/ComparisonTable";
import { InfoRow } from "../components/InfoRow";
import { SectionTitle } from "../components/SectionTitle";
import { formatDateTimeJa, formatMoney, formatRate } from "../lib/formatters";
import { calculateRemainingMonths } from "../lib/mortgageMath";
import type { BankComparisonRow, BankRateSource, LoanProfile } from "../types";

type BankComparisonPageProps = {
  rows: BankComparisonRow[];
  sources: BankRateSource[];
  loan: LoanProfile;
  paymentWarning: string | null;
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
  paymentWarning,
  rateFetchState,
  isFetchingRates,
  onOpenBank,
  onRefreshRates,
  onRecalculateRow,
  onRefinance,
}: BankComparisonPageProps) {
  const remainingMonths = calculateRemainingMonths(loan.nextPaymentDate, loan.endDate);

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
          <InfoRow label="現在の月返済" value={formatMoney(loan.monthlyPayment)} />
          <InfoRow label="現在のボーナス返済" value={formatMoney(loan.bonusPayment)} />
          <InfoRow label="残期間" value={`${remainingMonths}か月`} />
          <InfoRow label="表の差額期間" value="144か月（12年）" />
        </dl>
        <p className="text-xs text-slate-500">
          各銀行候補は、同じ残高・残期間で月返済とボーナス返済を概算します。表の差額は「12年分の月返済差額」の目安で、借換え画面では残期間全体と諸費用を含めて再計算します。
        </p>
      </Card>

      {paymentWarning ? (
        <Card tone="amber">
          <p className="text-sm font-semibold leading-6 text-amber-900">
            {paymentWarning}
          </p>
        </Card>
      ) : null}

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
        12年差額目安 = （現在の月返済 - 候補の月返済）× 144か月。手入力補正がある場合は手入力値を優先して概算再判定します。
      </p>

      <Button fullWidth onClick={onRefinance}>
        <Calculator className="h-5 w-5" aria-hidden="true" />
        借換えメリットを見る
      </Button>
    </div>
  );
}
