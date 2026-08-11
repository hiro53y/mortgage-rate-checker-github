import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveComparisonRowsFromLoan,
  selectBestRefinanceCandidate,
} from "../src/lib/comparisonMath.ts";
import {
  applyFetchedRatesToRows,
  isMonthlyAutoFetchDue,
} from "../src/lib/rateFetch.ts";
import { bankRateSources } from "../src/lib/bankSources.ts";
import { defaultLoanProfile } from "../src/lib/sampleData.ts";
import type { BankComparisonRow, RateFetchResponse, RateOffer } from "../src/types.ts";

const offer: RateOffer = {
  schemaVersion: 12,
  bankRateSourceId: "netbk",
  bankName: "住信SBIネット銀行",
  productName: "WEB申込コース（借換え）",
  loanPurpose: "refinance",
  rateType: "variable",
  advertisedMinRate: 0.95,
  conditionMatchedRate: 0.95,
  applicableMonth: "2026-06",
  fetchedAt: "2026-06-21T00:00:00.000Z",
  sourceUrl: "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
  sourceKind: "official-api",
  confidence: "verified",
  eligibility: "eligible",
  conditionsSummary: "テスト",
  adapterId: "test",
  rateOptions: [{ id: "test", label: "借換え変動", rate: 0.95 }],
};

function candidateRow(): BankComparisonRow {
  return {
    id: "netbk",
    rowKind: "candidate",
    bankName: "住信SBIネット銀行",
    effectiveRate: 0.95,
    insuranceLevel: "一般団信",
    monthlyPayment: 90_000,
    netBenefit: 100_000,
    isPriorityCandidate: false,
    note: "テスト",
  };
}

test("v12: cacheState=staleなら個別statusがsuccessでも推薦行へ昇格しない", () => {
  const response: RateFetchResponse = {
    schemaVersion: 12,
    month: "2026-06",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    cached: true,
    cacheState: "stale",
    staleReason: "month-mismatch",
    message: "保存値",
    items: [{
      bankRateSourceId: "netbk",
      bankName: "住信SBIネット銀行",
      rate: 0.95,
      status: "success",
      fetchedAt: "2026-06-21T00:00:00.000Z",
      sourceUrl: offer.sourceUrl,
      message: "保存値",
      offer,
      lastGoodOffer: offer,
    }],
  };
  const merged = applyFetchedRatesToRows([candidateRow()], bankRateSources, response);
  assert.equal(merged[0].rateStatus, "stale");

  const rows = deriveComparisonRowsFromLoan(
    merged,
    defaultLoanProfile,
    "2026-06-21",
    bankRateSources,
  );
  assert.equal(rows[0].rateStatus, "stale");
  assert.equal(
    selectBestRefinanceCandidate(rows, undefined, undefined, "2026-06-21", bankRateSources),
    null,
  );
});

test("v12: 月次自動取得の要否もJST月境界を使う", () => {
  assert.equal(
    isMonthlyAutoFetchDue("2026-06", new Date("2026-06-30T14:59:59.000Z")),
    false,
  );
  assert.equal(
    isMonthlyAutoFetchDue("2026-06", new Date("2026-06-30T15:00:00.000Z")),
    true,
  );
});
