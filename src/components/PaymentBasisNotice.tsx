import { AlertTriangle } from "lucide-react";
import type { LoanPaymentBasisStatus, LoanProfile } from "../types";
import { formatDateJa, formatMoney, formatRate } from "../lib/formatters";
import { Card } from "./Card";
import { InfoRow } from "./InfoRow";

type PaymentBasisNoticeProps = {
  loan: LoanProfile;
  paymentBasis: LoanPaymentBasisStatus;
  formatAmount?: (value: number) => string;
};

export function PaymentBasisNotice({ loan, paymentBasis, formatAmount }: PaymentBasisNoticeProps) {
  if (!paymentBasis.hasPaymentGap && !paymentBasis.isNextPaymentDatePast) {
    return null;
  }
  const moneyText = formatAmount ?? formatMoney;

  return (
    <Card tone="amber" className="space-y-3">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-black text-amber-950">返済額の登録確認が必要です</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
            {paymentBasis.hasPaymentGap
              ? `登録済み返済額と、現在適用金利 ${formatRate(
                  loan.currentRate,
                )} から同じ残高・残期間で逆算した概算額に差があります。金利比較と借換え試算では、下の概算額を比較元に使います。`
              : "次回返済日が過去日のため、試算前提が古い可能性があります。最新通知に合わせて登録内容を確認してください。"}
          </p>
        </div>
      </div>
      <dl className="rounded-lg bg-white px-3 py-2">
        <InfoRow label="登録済みの毎月返済" value={moneyText(paymentBasis.registeredMonthlyPayment)} />
        <InfoRow label="比較用の毎月返済" value={moneyText(paymentBasis.baselineMonthlyPayment)} emphasis />
        <InfoRow label="登録済みのボーナス返済" value={moneyText(paymentBasis.registeredBonusPayment)} />
        <InfoRow label="比較用のボーナス返済" value={moneyText(paymentBasis.baselineBonusPayment)} emphasis />
      </dl>
      {paymentBasis.isNextPaymentDatePast ? (
        <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold leading-5 text-amber-900">
          次回返済日 {formatDateJa(loan.nextPaymentDate)}
          は過去日です。試算では同じ返済日で繰り上げた
          {formatDateJa(paymentBasis.effectiveNextPaymentDate)}
          を次回返済日として扱います。残高・次回返済日・返済予定額は最新通知に合わせて更新してください。
        </p>
      ) : null}
    </Card>
  );
}
