import assert from "node:assert/strict";
import test from "node:test";
import { deriveComparisonRowsFromLoan, selectBestRefinanceCandidate } from "../src/lib/comparisonMath.ts";
import { createSampleAppStorage } from "../src/lib/sampleData.ts";
import { validateAppStorage } from "../src/lib/storage.ts";

test("v6以前の保存JSONを読み込み、v7派生値を再計算できる", () => {
  const legacy = createSampleAppStorage() as unknown as Record<string, unknown>;
  const legacyLoan = { ...(legacy.loanProfile as Record<string, unknown>) };
  delete legacyLoan.borrowerBirthDate;
  delete legacyLoan.estimatedPropertyValue;
  delete legacyLoan.desiredInsuranceCoverage;
  legacy.loanProfile = legacyLoan;

  const legacyRows = (legacy.comparisonRows as Array<Record<string, unknown>>).map((row) => {
    const next = { ...row };
    delete next.rateOffer;
    delete next.eligibility;
    return next;
  });
  legacy.comparisonRows = legacyRows;

  const migrated = validateAppStorage(legacy);
  assert.ok(migrated);
  assert.equal(migrated.loanProfile.borrowerBirthDate, undefined);
  assert.ok(migrated.bankSources.some((source) => source.adapter === "netbk-jsonp"));

  const rows = deriveComparisonRowsFromLoan(
    migrated.comparisonRows,
    migrated.loanProfile,
    "2026-06-21",
  );
  assert.equal(rows[0].rowKind, "base");
  assert.equal(selectBestRefinanceCandidate(rows), null);
});
