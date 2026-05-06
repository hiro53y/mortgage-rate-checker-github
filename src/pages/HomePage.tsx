import { BarChart3, Calculator, Eye, EyeOff, ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InfoRow } from "../components/InfoRow";
import { RateBadge } from "../components/RateBadge";
import { SectionTitle } from "../components/SectionTitle";
import {
  formatBonusMonths,
  formatDateJa,
  formatDateTimeJa,
  formatMoney,
  formatSignedRate,
} from "../lib/formatters";
import { MOMIJI_LOWER_RATE } from "../lib/sampleData";
import { calculateRateDifference } from "../lib/scenarioMath";
import type { LoanProfile } from "../types";

type HomePageProps = {
  loan: LoanProfile;
  lastCheckedAt?: string;
  onCheckLatest: () => void;
  onScenario: () => void;
  onComparison: () => void;
  onEdit: () => void;
};

export function HomePage({
  loan,
  lastCheckedAt,
  onCheckLatest,
  onScenario,
  onComparison,
  onEdit,
}: HomePageProps) {
  const rateDifference = calculateRateDifference(loan.currentRate, MOMIJI_LOWER_RATE);
  const [showMoney, setShowMoney] = useState(false);
  const maskedMoney = "*****";
  const moneyText = (value: number) => (showMoney ? formatMoney(value) : maskedMoney);

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-bold text-navy-700">スマホ向け概算シミュレーション</p>
        <h1 className="text-2xl font-black tracking-normal text-slate-950">
          住宅ローン金利チェッカー
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          保存済みの条件を使い、金利変更と借換え候補を概算で確認します。
        </p>
      </header>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">現在の登録条件</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">{loan.bankName}</h2>
          </div>
          <Button variant="ghost" className="min-h-9 px-3 py-2 text-xs" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            編集
          </Button>
        </div>

        <Button
          variant="secondary"
          fullWidth
          className="min-h-10 py-2 text-xs"
          onClick={() => setShowMoney((current) => !current)}
        >
          {showMoney ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
          {showMoney ? "金額を隠す" : "金額を表示する"}
        </Button>

        <div className="rounded-lg bg-navy-50 p-4">
          <p className="text-xs font-bold text-navy-700">現在適用金利</p>
          <p className="mt-1 text-4xl font-black tracking-normal text-navy-800">
            {loan.currentRate.toFixed(3)}%
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            もみじ銀行の新規向け下限金利 {MOMIJI_LOWER_RATE.toFixed(3)}% との差:
            <span className="ml-1 font-bold text-navy-800">
              {formatSignedRate(rateDifference)}
            </span>
          </p>
        </div>

        <dl>
          <InfoRow label="返済方式" value={loan.repaymentType} />
          <InfoRow label="団信" value={loan.cancerInsuranceType} />
          <InfoRow label="現在残高" value={moneyText(loan.currentBalance)} emphasis />
          <InfoRow label="ボーナス返済月" value={formatBonusMonths(loan.bonusMonths)} />
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 shadow-soft">
          <p className="text-xs font-semibold text-slate-500">毎月返済額</p>
          <p className="mt-1 text-2xl font-black tracking-normal text-slate-950">
            {moneyText(loan.monthlyPayment)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 shadow-soft">
          <p className="text-xs font-semibold text-slate-500">ボーナス返済額</p>
          <p className="mt-1 text-2xl font-black tracking-normal text-slate-950">
            {moneyText(loan.bonusPayment)}
          </p>
          <p className="mt-1 text-xs text-slate-500">6月・12月</p>
        </div>
      </div>

      <div className="space-y-3">
        <Button fullWidth onClick={onCheckLatest}>
          <ExternalLink className="h-5 w-5" aria-hidden="true" />
          最新金利を確認する
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" fullWidth onClick={onScenario}>
            <Calculator className="h-5 w-5" aria-hidden="true" />
            金利変更を試算する
          </Button>
          <Button variant="secondary" fullWidth onClick={onComparison}>
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            銀行比較を見る
          </Button>
        </div>
      </div>

      <Card tone="blue" className="space-y-3">
        <SectionTitle title="確認状況" subtitle="比較条件: 元利均等・がん団信込み" />
        <dl>
          <InfoRow label="前回確認日" value={formatDateTimeJa(lastCheckedAt)} />
          <InfoRow label="比較対象金利" value={<RateBadge value={MOMIJI_LOWER_RATE} />} />
        </dl>
      </Card>

      <Card className="space-y-3">
        <SectionTitle title="契約概要" />
        <dl>
          <InfoRow label="商品名" value={loan.productName} />
          <InfoRow label="支店名" value={loan.branchName} />
          <InfoRow label="当初お借入金額" value={moneyText(loan.principal)} emphasis />
          <InfoRow label="お借入日" value={formatDateJa(loan.startDate)} />
          <InfoRow label="最終返済日" value={formatDateJa(loan.endDate)} />
          <InfoRow label="次回返済日" value={formatDateJa(loan.nextPaymentDate)} />
          <InfoRow label="次回返済予定額" value={moneyText(loan.nextPaymentAmount)} />
        </dl>
      </Card>
    </div>
  );
}
