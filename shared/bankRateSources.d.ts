export type SharedBankRateSource = {
  id: string;
  bankName: string;
  productName: string;
  rateUrl: string;
  insuranceUrl: string;
  adapter: string;
  apiUrl?: string;
  backupApiUrl?: string;
  referenceUrl?: string;
  kakakuCompanyCode?: string;
  rateUrls: string[];
  aggregateAliases: string[];
  preferredKeywords: string[];
  ratePurpose: string;
  compareType: string;
  targetRateType: string;
  cancerInsuranceTarget: string;
  note: string;
  expectedVariableRateRange: [number, number];
  maxMonthlyDelta: number;
};

export const BANK_RATE_SOURCES: SharedBankRateSource[];
export function getBankRateSource(id: string): SharedBankRateSource | undefined;
