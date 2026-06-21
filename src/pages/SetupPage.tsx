import { Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { parseNumberInput } from "../lib/formatters";
import type { LoanProfile } from "../types";

type SetupPageProps = {
  loan: LoanProfile;
  isInitial: boolean;
  onSave: (loan: LoanProfile) => void;
};

type LoanFormState = Omit<LoanProfile, "bonusMonths"> & {
  bonusMonths: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-base font-semibold text-slate-900 outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100";

const labelClass = "text-sm font-bold text-slate-700";

function toFormState(loan: LoanProfile): LoanFormState {
  return {
    ...loan,
    bonusMonths: loan.bonusMonths.join(","),
  };
}

function parseBonusMonths(value: string): number[] {
  return value
    .split(/[,\s、]+/)
    .map((item) => Number(item.trim()))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
}

export function validateLoanProfile(loan: LoanProfile): string[] {
  const errors: string[] = [];
  if (!loan.productName.trim()) errors.push("商品名を入力してください。");
  if (!loan.bankName.trim()) errors.push("銀行名を入力してください。");
  if (!loan.branchName.trim()) errors.push("支店名を入力してください。");
  if (loan.principal <= 0) errors.push("当初借入金額は1円以上で入力してください。");
  if (loan.currentBalance <= 0) errors.push("現在残高は1円以上で入力してください。");
  if (loan.currentRate <= 0) errors.push("現在適用金利は0より大きい値で入力してください。");
  if (loan.monthlyPayment <= 0) errors.push("毎月返済額は1円以上で入力してください。");
  if (loan.bonusMonths.length === 0) errors.push("ボーナス返済月を入力してください。");
  if (new Date(loan.endDate) <= new Date(loan.startDate)) {
    errors.push("最終返済日は借入日より後の日付にしてください。");
  }
  return errors;
}

export function SetupPage({ loan, isInitial, onSave }: SetupPageProps) {
  const [form, setForm] = useState<LoanFormState>(() => toFormState(loan));
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setForm(toFormState(loan));
  }, [loan]);

  const updateText = (field: keyof LoanFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateNumber = (field: keyof LoanFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: parseNumberInput(value) }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextLoan: LoanProfile = {
      ...form,
      bonusMonths: parseBonusMonths(form.bonusMonths),
      updatedAt: new Date().toISOString(),
    };
    const nextErrors = validateLoanProfile(nextLoan);
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);
    onSave(nextLoan);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <header>
        <p className="text-xs font-bold text-navy-700">
          {isInitial ? "初回設定" : "マイローン設定"}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
          現在条件設定
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          保存後は毎回の入力不要です。実データはこの端末のlocalStorageに保存されます。
        </p>
      </header>

      {errors.length > 0 ? (
        <Card tone="amber">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <SectionTitle title="契約情報" />
        <label className={labelClass}>
          商品名
          <input
            className={inputClass}
            value={form.productName}
            onChange={(event) => updateText("productName", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          銀行名
          <input
            className={inputClass}
            value={form.bankName}
            onChange={(event) => updateText("bankName", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          支店名
          <input
            className={inputClass}
            value={form.branchName}
            onChange={(event) => updateText("branchName", event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            借入日
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(event) => updateText("startDate", event.target.value)}
            />
          </label>
          <label className={labelClass}>
            最終返済日
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              onChange={(event) => updateText("endDate", event.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="借入金額" />
        {[
          ["principal", "当初借入金額"],
          ["principalMonthly", "当初借入金額（毎月返済分）"],
          ["principalBonus", "当初借入金額（ボーナス返済分）"],
          ["currentBalance", "現在残高"],
          ["currentBalanceMonthly", "現在残高（毎月返済分）"],
          ["currentBalanceBonus", "現在残高（ボーナス返済分）"],
        ].map(([field, label]) => (
          <label className={labelClass} key={field}>
            {label}
            <input
              inputMode="numeric"
              className={inputClass}
              value={String(form[field as keyof LoanFormState])}
              onChange={(event) =>
                updateNumber(field as keyof LoanFormState, event.target.value)
              }
            />
          </label>
        ))}
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="返済条件" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            借入者の生年月日
            <input
              type="date"
              className={inputClass}
              value={form.borrowerBirthDate ?? ""}
              onChange={(event) => updateText("borrowerBirthDate", event.target.value)}
            />
          </label>
          <label className={labelClass}>
            概算物件価値（円）
            <input
              inputMode="numeric"
              className={inputClass}
              value={form.estimatedPropertyValue ?? ""}
              onChange={(event) => updateNumber("estimatedPropertyValue", event.target.value)}
              placeholder="例 50,000,000"
            />
          </label>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          年齢条件と融資率を判定するために使います。未入力でも保存できますが、条件適合金利と借換え推薦は算定できません。
        </p>
        <label className={labelClass}>
          現在適用金利（%）
          <input
            inputMode="decimal"
            className={inputClass}
            value={String(form.currentRate)}
            onChange={(event) => updateNumber("currentRate", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          返済方法
          <input
            className={inputClass}
            value={form.repaymentType}
            onChange={(event) => updateText("repaymentType", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          ボーナス返済月
          <input
            className={inputClass}
            value={form.bonusMonths}
            onChange={(event) => updateText("bonusMonths", event.target.value)}
            placeholder="6,12"
          />
        </label>
        <label className={labelClass}>
          毎月返済額
          <input
            inputMode="numeric"
            className={inputClass}
            value={String(form.monthlyPayment)}
            onChange={(event) => updateNumber("monthlyPayment", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          ボーナス返済額
          <input
            inputMode="numeric"
            className={inputClass}
            value={String(form.bonusPayment)}
            onChange={(event) => updateNumber("bonusPayment", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          次回返済日
          <input
            type="date"
            className={inputClass}
            value={form.nextPaymentDate}
            onChange={(event) => updateText("nextPaymentDate", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          次回返済予定額
          <input
            inputMode="numeric"
            className={inputClass}
            value={String(form.nextPaymentAmount)}
            onChange={(event) => updateNumber("nextPaymentAmount", event.target.value)}
          />
        </label>
        <label className={labelClass}>
          団信条件
          <select
            className={inputClass}
            value={form.desiredInsuranceCoverage ?? "unknown"}
            onChange={(event) => {
              const value = event.target.value as LoanProfile["desiredInsuranceCoverage"];
              const labels = {
                standard: "一般団信",
                cancer50: "がん50%保障",
                cancer100: "がん100%保障",
                "full-disease": "全疾病・多疾病保障",
                unknown: "未選択",
              };
              setForm((current) => ({
                ...current,
                desiredInsuranceCoverage: value,
                cancerInsuranceType: labels[value ?? "unknown"],
              }));
            }}
          >
            <option value="unknown">選択してください</option>
            <option value="standard">一般団信</option>
            <option value="cancer50">がん50%保障</option>
            <option value="cancer100">がん100%保障</option>
            <option value="full-disease">全疾病・多疾病保障</option>
          </select>
        </label>
      </Card>

      <Button type="submit" fullWidth>
        <Save className="h-5 w-5" aria-hidden="true" />
        この条件で保存する
      </Button>
    </form>
  );
}
