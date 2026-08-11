import type { BankComparisonRow, BankRateSource, RateFetchResponse } from "../types";
import { isBaseComparisonRow } from "./comparisonMath.ts";
import { getJstMonthKey } from "./jstDate.ts";

export function getCurrentMonthKey(date = new Date()): string {
  return getJstMonthKey(date);
}

export function isMonthlyAutoFetchDue(
  checkedMonth: string | undefined,
  date = new Date(),
): boolean {
  return checkedMonth !== getCurrentMonthKey(date);
}

export function applyFetchedRatesToRows(
  responseRows: BankComparisonRow[],
  bankSources: BankRateSource[],
  response: RateFetchResponse,
): BankComparisonRow[] {
  return responseRows.map((row) => {
    if (isBaseComparisonRow(row)) return row;
    const source = bankSources.find((bankSource) => row.bankName.includes(bankSource.bankName));
    const item = response.items.find((rateItem) => rateItem.bankRateSourceId === source?.id);
    if (!item) return row;

    const isStaleResponseItem = response.cacheState === "stale" || item.status === "stale";
    if (!item.offer) {
      const lastGoodOffer = item.lastGoodOffer ?? row.lastGoodRateOffer;
      return {
        ...row,
        rateOffer: lastGoodOffer ?? row.rateOffer,
        lastGoodRateOffer: lastGoodOffer,
        autoFetchedRate: lastGoodOffer?.advertisedMinRate,
        advertisedMinRate: lastGoodOffer?.advertisedMinRate,
        rateStatus:
          row.manualOverrideRate !== undefined
            ? "manual"
            : isStaleResponseItem || lastGoodOffer
              ? "stale"
              : "failed",
        lastFetchedAt: item.fetchedAt,
        fetchError: item.message,
      };
    }

    return {
      ...row,
      rateOffer: item.offer,
      lastGoodRateOffer: isStaleResponseItem ? row.lastGoodRateOffer : item.offer,
      autoFetchedRate: item.offer.advertisedMinRate,
      advertisedMinRate: item.offer.advertisedMinRate,
      rateStatus:
        row.manualOverrideRate !== undefined
          ? "manual"
          : isStaleResponseItem
            ? "stale"
            : item.offer.sourceKind === "aggregator" || item.status === "needs-review"
              ? "reference"
              : "auto",
      lastFetchedAt: item.fetchedAt,
      fetchError:
        item.status === "needs-review" || isStaleResponseItem ? item.message : undefined,
    };
  });
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
