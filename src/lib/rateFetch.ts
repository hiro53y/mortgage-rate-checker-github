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
    headers: { accept: "application/json", "cache-control": "no-cache" },
    cache: "no-store",
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null;
    throw new Error(payload?.error ?? `金利取得APIが失敗しました。HTTP ${response.status}`);
  }
  return (await response.json()) as RateFetchResponse;
}
