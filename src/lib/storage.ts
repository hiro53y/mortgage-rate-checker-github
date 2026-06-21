import type {
  AppStorage,
  BankComparisonRow,
  BankRateSource,
  LoanProfile,
  ScenarioRate,
} from "../types";
import { createSampleAppStorage, defaultRefinanceResult } from "./sampleData.ts";

const STORAGE_KEY = "mortgage-rate-checker-v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isLoanProfile(value: unknown): value is LoanProfile {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.productName === "string" &&
    typeof value.bankName === "string" &&
    typeof value.currentBalance === "number" &&
    typeof value.currentRate === "number" &&
    typeof value.monthlyPayment === "number" &&
    Array.isArray(value.bonusMonths)
  );
}

export function isScenarioRate(value: unknown): value is ScenarioRate {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.rate === "number" &&
    typeof value.monthlyPayment === "number" &&
    typeof value.bonusPayment === "number"
  );
}

export function isBankRateSource(value: unknown): value is BankRateSource {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.bankName === "string" &&
    typeof value.rateUrl === "string" &&
    typeof value.insuranceUrl === "string"
  );
}

export function isBankComparisonRow(value: unknown): value is BankComparisonRow {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.bankName === "string" &&
    typeof value.effectiveRate === "number" &&
    typeof value.monthlyPayment === "number"
  );
}

export function validateAppStorage(value: unknown): AppStorage | null {
  if (!isObject(value)) {
    return null;
  }
  if (!isLoanProfile(value.loanProfile)) {
    return null;
  }
  if (!Array.isArray(value.scenarios) || !value.scenarios.every(isScenarioRate)) {
    return null;
  }
  if (!Array.isArray(value.bankSources) || !value.bankSources.every(isBankRateSource)) {
    return null;
  }
  if (
    !Array.isArray(value.comparisonRows) ||
    !value.comparisonRows.every(isBankComparisonRow)
  ) {
    return null;
  }

  const sample = createSampleAppStorage();
  const savedSources = value.bankSources as BankRateSource[];
  const mergedSources = sample.bankSources.map((source) => ({
    ...source,
    ...(savedSources.find((saved) => saved.id === source.id) ?? {}),
    adapter: source.adapter,
    apiUrl: source.apiUrl,
    backupApiUrl: source.backupApiUrl,
    referenceUrl: source.referenceUrl,
    rateUrls: source.rateUrls,
    aggregateAliases: source.aggregateAliases,
    preferredKeywords: source.preferredKeywords,
    expectedVariableRateRange: source.expectedVariableRateRange,
    maxMonthlyDelta: source.maxMonthlyDelta,
  }));
  return {
    ...sample,
    ...value,
    loanProfile: { ...sample.loanProfile, ...value.loanProfile },
    scenarios: value.scenarios,
    bankSources: mergedSources,
    comparisonRows: value.comparisonRows,
    refinanceResult: isObject(value.refinanceResult)
      ? { ...defaultRefinanceResult, ...value.refinanceResult }
      : null,
    refinanceCostBreakdown: isObject(value.refinanceCostBreakdown)
      ? { ...sample.refinanceCostBreakdown, ...value.refinanceCostBreakdown }
      : sample.refinanceCostBreakdown,
    lastCheckedAt:
      typeof value.lastCheckedAt === "string" ? value.lastCheckedAt : undefined,
  };
}

export function loadAppStorage(): AppStorage | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return validateAppStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveAppStorage(data: AppStorage): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
}

export function clearAppStorage(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function exportAppStorage(data: AppStorage): string {
  return JSON.stringify(data, null, 2);
}

export function importAppStorage(rawJson: string): AppStorage {
  const parsed = JSON.parse(rawJson) as unknown;
  const validated = validateAppStorage(parsed);
  if (!validated) {
    throw new Error("JSONの形式がアプリの保存形式と一致しません。");
  }
  return validated;
}
