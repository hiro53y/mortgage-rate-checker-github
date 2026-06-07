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
  autoFetchedRate?: number;
  manualOverrideRate?: number;
  rateUsedForCalculation?: number;
  rateStatus?: "sample" | "auto" | "manual" | "failed";
  lastFetchedAt?: string;
  lastManualUpdatedAt?: string;
  officialCheckedAt?: string;
  fetchError?: string;
  insuranceLevel: string;
  monthlyPayment: number;
  netBenefit: number | null;
  isPriorityCandidate: boolean;
  note: string;
};

export type RefinanceResult = {
  bankRateId: string;
  candidateBankName: string;
  candidateRate: number;
  baseMonthlyPayment: number;
  candidateNeedsReview: boolean;
  candidateReviewWarning?: string;
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
  rateFetchState?: {
    checkedMonth?: string;
    lastAttemptAt?: string;
    lastSuccessfulAt?: string;
    source?: "api" | "manual" | "sample";
    message?: string;
  };
};

export type RateFetchItem = {
  bankRateSourceId: string;
  bankName: string;
  rate: number | null;
  status: "success" | "failed" | "needs-review";
  fetchedAt: string;
  sourceUrl: string;
  message: string;
};

export type RateFetchResponse = {
  month: string;
  fetchedAt: string;
  items: RateFetchItem[];
  cached: boolean;
  message: string;
};
