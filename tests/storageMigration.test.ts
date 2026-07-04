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

test("v12: 設定画面で追加したサンプル外の銀行がリロード後も保持される", () => {
  const saved = createSampleAppStorage() as unknown as Record<string, unknown>;
  const sources = saved.bankSources as Array<Record<string, unknown>>;
  sources.push({
    id: "user-added-bank",
    bankName: "ユーザー追加銀行",
    productName: "住宅ローン",
    rateUrl: "https://example.com/rate",
    insuranceUrl: "https://example.com/insurance",
    ratePurpose: "refinance-comparison",
    compareType: "refinance-comparison",
    targetRateType: "variable",
    cancerInsuranceTarget: "要確認",
    note: "ユーザーが手動追加",
  });

  const restored = validateAppStorage(saved);
  assert.ok(restored);
  assert.ok(restored.bankSources.some((source) => source.id === "user-added-bank"));
  // サンプル銀行のコード管理フィールドは上書きされない
  assert.ok(restored.bankSources.some((source) => source.adapter === "netbk-jsonp"));
});

test("v12: momijiLowerRate が保存JSONから復元される", () => {
  const saved = createSampleAppStorage() as unknown as Record<string, unknown>;
  saved.momijiLowerRate = { rate: 0.975, applicableMonth: "2026-07", fetchedAt: "2026-07-01T00:00:00.000Z" };
  const restored = validateAppStorage(saved);
  assert.ok(restored);
  assert.equal(restored.momijiLowerRate?.rate, 0.975);
  assert.equal(restored.momijiLowerRate?.applicableMonth, "2026-07");

  const savedInvalid = createSampleAppStorage() as unknown as Record<string, unknown>;
  savedInvalid.momijiLowerRate = { rate: "bad" };
  const restoredInvalid = validateAppStorage(savedInvalid);
  assert.ok(restoredInvalid);
  assert.equal(restoredInvalid.momijiLowerRate, undefined);
});
