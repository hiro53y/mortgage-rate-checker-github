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
  desiredInsuranceCoverage?: InsuranceCoverage;
  borrowerBirthDate?: string;
  estimatedPropertyValue?: number;
  updatedAt: string;
};

export type InsuranceCoverage =
  | "standard"
  | "cancer50"
  | "cancer100"
  | "full-disease"
  | "unknown";

export type InsuranceMatchQuality = "exact" | "near" | "base-reference";

export type LoanPaymentBasisStatus = {
  registeredMonthlyPayment: number;
  registeredBonusPayment: number;
  calculatedMonthlyPayment: number;
  calculatedBonusPayment: number;
  baselineMonthlyPayment: number;
  baselineBonusPayment: number;
  monthlyDifference: number;
  bonusDifference: number;
  effectiveNextPaymentDate: string;
  remainingMonths: number;
  remainingBonusPayments: number;
  usesCalculatedBaseline: boolean;
  hasPaymentGap: boolean;
  isNextPaymentDatePast: boolean;
  todayIsoDate: string;
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
  adapter?: string;
  apiUrl?: string;
  backupApiUrl?: string;
  referenceUrl?: string;
  kakakuCompanyCode?: string;
  rateUrls?: string[];
  aggregateAliases?: string[];
  preferredKeywords?: string[];
  expectedVariableRateRange?: [number, number];
  maxMonthlyDelta?: number;
};

export type RateSourceKind =
  | "official-api"
  | "official-html"
  | "aggregator"
  | "manual-verified";

export type RateConfidence = "verified" | "corroborated" | "review" | "failed";
export type RateEligibility = "eligible" | "conditional" | "ineligible" | "unknown";

export type RateEstimationTier =
  | "official-condition-matched"
  | "aggregator-reference"
  | "estimated-with-insurance"
  | "estimated-midrange";

export type RateOption = {
  id: string;
  label: string;
  rate: number;
  ltvMax?: number;
  ltvMinExclusive?: number;
  ownFundsMinRatio?: number;
  requiresSbiHyper?: boolean;
  maxBorrowerAge?: number;
  maxRemainingMonths?: number;
};

export type InsurancePlanRate = {
  coverage: Exclude<InsuranceCoverage, "unknown">;
  label: string;
  addonRate: number;
  sourceUrl?: string;
};

export type RateEvidence = {
  sourceKind: Exclude<RateSourceKind, "manual-verified">;
  sourceUrl: string;
  rate: number;
  applicableMonth: string;
  label: string;
};

export type RateOffer = {
  schemaVersion: number;
  bankRateSourceId: string;
  bankName: string;
  productName: string;
  loanPurpose: "refinance";
  rateType: "variable";
  advertisedMinRate?: number;
  conditionMatchedRate?: number;
  baseRate?: number;
  discountRate?: number;
  insuranceAddonRate?: number;
  insurancePlans?: InsurancePlanRate[];
  insuranceCoverageUsed?: InsuranceCoverage;
  insuranceMatchQuality?: InsuranceMatchQuality;
  longTermAddonRate?: number;
  applicableMonth: string;
  fetchedAt: string;
  sourceUrl: string;
  sourceKind: RateSourceKind;
  confidence: RateConfidence;
  eligibility: RateEligibility;
  conditionsSummary: string;
  failureReason?: string;
  adapterId: string;
  rateOptions: RateOption[];
  evidence?: RateEvidence[];
};

export type ManualRateVerification = {
  rate: number | null;
  confirmed: boolean;
  applicableMonth?: string;
  sourceUrl?: string;
};

export type BankComparisonRow = {
  id: string;
  rowKind?: "base" | "candidate";
  bankName: string;
  effectiveRate: number;
  autoFetchedRate?: number;
  advertisedMinRate?: number;
  conditionMatchedRate?: number;
  rateOffer?: RateOffer;
  lastGoodRateOffer?: RateOffer;
  manualOverrideRate?: number;
  manualApplicableMonth?: string;
  manualSourceUrl?: string;
  manualVerifiedAt?: string;
  rateUsedForCalculation?: number;
  rateStatus?: "sample" | "auto" | "manual" | "reference" | "stale" | "failed";
  sourceKind?: RateSourceKind;
  confidence?: RateConfidence;
  eligibility?: RateEligibility;
  eligibilityReason?: string;
  insuranceCoverageUsed?: InsuranceCoverage;
  insuranceMatchQuality?: InsuranceMatchQuality;
  estimationTier?: RateEstimationTier;
  estimationLabel?: string;
  applicableMonth?: string;
  lastFetchedAt?: string;
  lastManualUpdatedAt?: string;
  officialCheckedAt?: string;
  fetchError?: string;
  insuranceLevel: string;
  monthlyPayment: number;
  bonusPayment?: number;
  remainingTotalPayment?: number;
  netBenefit: number | null;
  isPriorityCandidate: boolean;
  note: string;
};

export type RefinanceResult = {
  bankRateId: string;
  candidateBankName: string;
  candidateRate: number;
  baseMonthlyPayment: number;
  baseBonusPayment: number;
  candidateMonthlyPayment: number;
  candidateBonusPayment: number;
  candidateNeedsReview: boolean;
  candidateReviewWarning?: string;
  candidateSourceKind?: RateSourceKind;
  candidateApplicableMonth?: string;
  candidateEligibilityReason?: string;
  candidateInsuranceCoverageUsed?: InsuranceCoverage;
  candidateInsuranceMatchQuality?: InsuranceMatchQuality;
  currentRemainingTotalPayment: number;
  refinanceRemainingTotalPayment: number;
  refinanceCosts: number;
  totalPaymentDifference: number;
  netBenefit: number;
  monthlyDifference: number;
  bonusDifference: number;
  averageMonthlyDifference: number;
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
  refinanceResult: RefinanceResult | null;
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
  status: "success" | "failed" | "needs-review" | "stale";
  fetchedAt: string;
  sourceUrl: string;
  attemptedUrls?: string[];
  message: string;
  offer?: RateOffer | null;
  lastGoodOffer?: RateOffer | null;
};

export type RateFetchResponse = {
  schemaVersion?: number;
  month: string;
  fetchedAt: string;
  items: RateFetchItem[];
  cached: boolean;
  locked?: boolean;
  message: string;
};
