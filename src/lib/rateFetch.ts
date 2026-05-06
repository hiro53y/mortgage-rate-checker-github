import type { RateFetchResponse } from "../types";

export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isMonthlyAutoFetchDue(
  checkedMonth: string | undefined,
  date = new Date(),
): boolean {
  return date.getDate() >= 10 && checkedMonth !== getCurrentMonthKey(date);
}

export async function fetchLatestRates(force = false): Promise<RateFetchResponse> {
  const response = await fetch(`/api/rates${force ? "?force=1" : ""}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`金利取得APIが失敗しました。HTTP ${response.status}`);
  }
  return (await response.json()) as RateFetchResponse;
}
