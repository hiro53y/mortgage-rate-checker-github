export type ViewName =
  | "home"
  | "setup"
  | "scenario"
  | "comparison"
  | "refinance"
  | "settings";

export type LoanProfile = {
  id: string;
  productName: string;
  branchName: string;
  bankName: string;
  principal: number;
  principalMonthly: number;
  principalBonus: number;
  startDate: string;
  endDate: string;
  currentBalance: number;
  currentBalanceMonthly: number;
  currentBalanceBonus: number;
  currentRate: number;
  repaymentType: string;
  bonusMonths: number[];
  monthlyPayment: number;
  bonusPayment: number;
  nextPaymentDate: string;
  nextPaymentAmount: number;
  cancerInsuranceType: string;
  updatedAt: string;
};

export type ScenarioRate = {
  id: string;
  name: string;
  scenarioType: string;
  rate: number;
  memo: string;
  monthlyPayment: number;
  bonusPayment: number;
  annualIncrease: number;
  shouldSuggestNegotiation: boolean;
  note: string;
};

export type BankRateSource = {
  id: string;
  bankName: string;
  productName: string;
  rateUrl: string;
  insuranceUrl: string;
  ratePurpose: string;
  compareType: string;
  targetRateType: string;
  cancerInsuranceTarget: string;
  note: string;
};

export type BankComparisonRow = {
  id: string;
  bankName: string;
  effectiveRate: number;
  insuranceLevel: string;
  monthlyPayment: number;
  netBenefit: number | null;
  isPriorityCandidate: boolean;
  note: string;
};

export type RefinanceResult = {
  bankRateId: string;
  currentRemainingTotalPayment: number;
  refinanceRemainingTotalPayment: number;
  refinanceCosts: number;
  netBenefit: number;
  monthlyDifference: number;
  paybackMonths: number | null;
  judgement: "検討価値あり" | "微妙" | "メリット小";
};

export type RefinanceCostBreakdown = {
  loanFee: number;
  registrationFee: number;
  judicialScrivenerFee: number;
  stampDuty: number;
  prepaymentFee: number;
};

export type AppStorage = {
  loanProfile: LoanProfile;
  scenarios: ScenarioRate[];
  bankSources: BankRateSource[];
  comparisonRows: BankComparisonRow[];
  refinanceResult: RefinanceResult;
  refinanceCostBreakdown: RefinanceCostBreakdown;
  lastCheckedAt?: string;
};
