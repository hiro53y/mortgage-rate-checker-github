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
  return checkedMonth !== getCurrentMonthKey(date);
}

export async function fetchLatestRates(force = false): Promise<RateFetchResponse> {
  const response = await fetch("/api/rates", {
    method: force ? "POST" : "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`金利取得APIが失敗しました。HTTP ${response.status}`);
  }
  return (await response.json()) as RateFetchResponse;
}
