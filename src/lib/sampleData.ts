import type {
  AppStorage,
  BankComparisonRow,
  LoanProfile,
  RefinanceCostBreakdown,
  RefinanceResult,
  ScenarioRate,
  BankRateSource,
} from "../types";
import { bankRateSources } from "./bankSources.ts";

export const MOMIJI_LOWER_RATE = 0.95;

export const defaultLoanProfile: LoanProfile = {
  id: "loan-default",
  productName: "YCG住宅ローン 融資手数料型3",
  bankName: "もみじ銀行",
  branchName: "呉営業部",
  startDate: "2023-09-22",
  endDate: "2066-09-27",
  principal: 46200000,
  principalMonthly: 38200000,
  principalBonus: 8000000,
  currentBalance: 43811480,
  currentBalanceMonthly: 36225350,
  currentBalanceBonus: 7586130,
  currentRate: 0.755,
  repaymentType: "元利均等",
  bonusMonths: [6, 12],
  monthlyPayment: 86689,
  bonusPayment: 108879,
  nextPaymentDate: "2026-05-27",
  nextPaymentAmount: 86689,
  cancerInsuranceType: "がん100%込み",
  desiredInsuranceCoverage: "cancer100",
  updatedAt: "2026-05-06T00:00:00.000+09:00",
};

export const defaultScenarios: ScenarioRate[] = [
  {
    id: "scenario-a",
    name: "シナリオA（下限金利と同水準）",
    scenarioType: "same-as-lower-rate",
    rate: 0.95,
    memo: "2026年7月想定",
    monthlyPayment: 89975,
    bonusPayment: 113086,
    annualIncrease: 47795,
    shouldSuggestNegotiation: false,
    note: "新規向け下限金利と同水準です",
  },
  {
    id: "scenario-b",
    name: "シナリオB（上昇幅を反映）",
    scenarioType: "rate-rise",
    rate: 1.005,
    memo: "2026年7月想定",
    monthlyPayment: 90916,
    bonusPayment: 114283,
    annualIncrease: 61477,
    shouldSuggestNegotiation: true,
    note: "新規向け下限金利を上回るため、金利引き下げ交渉を検討してください",
  },
];

export const defaultComparisonRows: BankComparisonRow[] = [
  {
    id: "momiji-scenario",
    rowKind: "base",
    bankName: "もみじ銀行（現在条件）",
    effectiveRate: 0.755,
    rateUsedForCalculation: 0.755,
    rateStatus: "sample",
    insuranceLevel: "がん100%",
    monthlyPayment: 86689,
    netBenefit: null,
    isPriorityCandidate: false,
    note: "現在条件の基準",
  },
  {
    id: "mufg-row",
    rowKind: "candidate",
    bankName: "三菱UFJ銀行",
    effectiveRate: 0.995,
    rateUsedForCalculation: 0.995,
    rateStatus: "sample",
    insuranceLevel: "要確認",
    monthlyPayment: 90744,
    netBenefit: 35000,
    isPriorityCandidate: false,
    note: "疾病保障プラン要確認",
  },
  {
    id: "netbk-row",
    rowKind: "candidate",
    bankName: "住信SBIネット銀行",
    effectiveRate: 0.95,
    rateUsedForCalculation: 0.95,
    rateStatus: "sample",
    insuranceLevel: "がん50%",
    monthlyPayment: 88955,
    netBenefit: 284000,
    isPriorityCandidate: false,
    note: "保障条件は公式ページで要確認",
  },
  {
    id: "hirogin-row",
    rowKind: "candidate",
    bankName: "広島銀行",
    effectiveRate: 0.95,
    rateUsedForCalculation: 0.95,
    rateStatus: "sample",
    insuranceLevel: "がん保障付",
    monthlyPayment: 91170,
    netBenefit: -32000,
    isPriorityCandidate: false,
    note: "地銀比較対象",
  },
  {
    id: "chugin-row",
    rowKind: "candidate",
    bankName: "中国銀行",
    effectiveRate: 0.95,
    rateUsedForCalculation: 0.95,
    rateStatus: "sample",
    insuranceLevel: "がん100%",
    monthlyPayment: 90014,
    netBenefit: 121000,
    isPriorityCandidate: false,
    note: "がん団信上乗せ条件は要確認",
  },
  {
    id: "jibun-row",
    rowKind: "candidate",
    bankName: "auじぶん銀行",
    effectiveRate: 0.95,
    rateUsedForCalculation: 0.95,
    rateStatus: "sample",
    insuranceLevel: "がん50 / がん100を区別",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "借換え上位候補。公式取得または手入力補正で確認",
  },
  {
    id: "paypay-row",
    rowKind: "candidate",
    bankName: "PayPay銀行",
    effectiveRate: 0.95,
    rateUsedForCalculation: 0.95,
    rateStatus: "sample",
    insuranceLevel: "がん100など要確認",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "借換え上位候補。公式取得または手入力補正で確認",
  },
  {
    id: "sbishinsei-row",
    rowKind: "candidate",
    bankName: "SBI新生銀行",
    effectiveRate: 0.95,
    rateUsedForCalculation: 0.95,
    rateStatus: "sample",
    insuranceLevel: "ガン団信 +0.1%",
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note: "借換え上位候補。公式取得または手入力補正で確認",
  },
];

const fallbackSampleRates: Record<string, number> = {
  mufg: 0.995,
  smbc: 1.1,
  mizuho: 1.2,
  resona: 1.0,
  netbk: 0.95,
  jibun: 0.95,
  paypay: 0.95,
  sbishinsei: 0.95,
  sonybank: 1.0,
  rakuten: 1.0,
  hirogin: 0.95,
  chugin: 0.95,
};

function createComparisonRowFromSource(source: BankRateSource): BankComparisonRow {
  const effectiveRate = fallbackSampleRates[source.id] ?? 1.0;
  return {
    id: `${source.id}-row`,
    rowKind: "candidate",
    bankName: source.bankName,
    effectiveRate,
    rateUsedForCalculation: effectiveRate,
    rateStatus: "sample",
    insuranceLevel: source.cancerInsuranceTarget,
    monthlyPayment: 0,
    netBenefit: 0,
    isPriorityCandidate: false,
    note:
      source.id === "paypay" || source.id === "sbishinsei" || source.id === "jibun"
        ? "借換え上位候補。公式取得または手入力補正で確認"
        : source.note,
  };
}

export function ensureComparisonRowsIncludeBankSources(
  rows: BankComparisonRow[],
  sources: BankRateSource[],
): BankComparisonRow[] {
  const nextRows = [...rows];
  for (const source of sources) {
    if (source.id === "momiji") {
      continue;
    }
    const exists = nextRows.some(
      (row) => row.id === `${source.id}-row` || row.bankName.includes(source.bankName),
    );
    if (!exists) {
      nextRows.push(createComparisonRowFromSource(source));
    }
  }
  return nextRows;
}

export const defaultRefinanceResult: RefinanceResult = {
  bankRateId: "netbk",
  candidateBankName: "住信SBIネット銀行",
  candidateRate: 0.89,
  baseMonthlyPayment: 86689,
  baseBonusPayment: 108879,
  candidateMonthlyPayment: 88955,
  candidateBonusPayment: 111700,
  candidateNeedsReview: true,
  candidateReviewWarning:
    "公式確認が未完了、保障条件に要確認項目ありです。公式ページと手入力補正で条件を確認してください。",
  currentRemainingTotalPayment: 58420000,
  refinanceRemainingTotalPayment: 56980000,
  refinanceCosts: 820000,
  totalPaymentDifference: 1440000,
  netBenefit: 620000,
  monthlyDifference: 3900,
  bonusDifference: 5200,
  averageMonthlyDifference: 4767,
  paybackMonths: 210,
  judgement: "検討価値あり",
};

export const defaultRefinanceCostBreakdown: RefinanceCostBreakdown = {
  loanFee: 330000,
  registrationFee: 220000,
  judicialScrivenerFee: 150000,
  stampDuty: 60000,
  prepaymentFee: 60000,
};

export function createSampleAppStorage(): AppStorage {
  return JSON.parse(
    JSON.stringify({
      loanProfile: defaultLoanProfile,
      scenarios: defaultScenarios,
      bankSources: bankRateSources,
      comparisonRows: ensureComparisonRowsIncludeBankSources(defaultComparisonRows, bankRateSources),
      refinanceResult: null,
      refinanceCostBreakdown: defaultRefinanceCostBreakdown,
      rateFetchState: {
        source: "sample",
        message: "サンプルデータを表示中",
      },
    }),
  ) as AppStorage;
}
