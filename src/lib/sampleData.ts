import type {
  AppStorage,
  BankComparisonRow,
  LoanProfile,
  RefinanceCostBreakdown,
  RefinanceResult,
  ScenarioRate,
} from "../types";
import { bankRateSources } from "./bankSources";

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
    bankName: "もみじ銀行（選択中シナリオ）",
    effectiveRate: 1.005,
    rateUsedForCalculation: 1.005,
    rateStatus: "sample",
    insuranceLevel: "がん100%",
    monthlyPayment: 90916,
    netBenefit: null,
    isPriorityCandidate: false,
    note: "選択中シナリオの基準",
  },
  {
    id: "mufg-row",
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
    bankName: "住信SBIネット銀行",
    effectiveRate: 0.89,
    rateUsedForCalculation: 0.89,
    rateStatus: "sample",
    insuranceLevel: "がん50%",
    monthlyPayment: 88955,
    netBenefit: 284000,
    isPriorityCandidate: true,
    note: "有力候補。保障条件は公式ページで要確認",
  },
  {
    id: "hirogin-row",
    bankName: "広島銀行",
    effectiveRate: 1.02,
    rateUsedForCalculation: 1.02,
    rateStatus: "sample",
    insuranceLevel: "がん保障付",
    monthlyPayment: 91170,
    netBenefit: -32000,
    isPriorityCandidate: false,
    note: "地銀比較対象",
  },
  {
    id: "chugin-row",
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
];

export const defaultRefinanceResult: RefinanceResult = {
  bankRateId: "netbk",
  currentRemainingTotalPayment: 58420000,
  refinanceRemainingTotalPayment: 56980000,
  refinanceCosts: 820000,
  netBenefit: 620000,
  monthlyDifference: 3900,
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
      comparisonRows: defaultComparisonRows,
      refinanceResult: defaultRefinanceResult,
      refinanceCostBreakdown: defaultRefinanceCostBreakdown,
      rateFetchState: {
        source: "sample",
        message: "サンプルデータを表示中",
      },
    }),
  ) as AppStorage;
}
