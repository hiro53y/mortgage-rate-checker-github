import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areRatesEqual,
  calculateAnnualIncrease,
  calculateRateDifference,
  currentRateNegotiationSummary,
  deriveScenarioFromLoan,
  scenarioJudgementText,
  shouldSuggestNegotiation,
} from "../src/lib/scenarioMath.ts";
import type { LoanProfile, ScenarioRate } from "../src/types.ts";

const MOMIJI_LOWER_RATE = 0.95;

const testLoanProfile: LoanProfile = {
  id: "loan-test",
  productName: "YCG住宅ローン 融資手数料型3",
  bankName: "もみじ銀行",
  branchName: "呉営業部",
  startDate: "2023-09-22",
  endDate: "2066-09-27",
  principal: 46200000,
  principalMonthly: 38200000,
  principalBonus: 8000000,
  currentBalance: 43811480,
  currentBalanceMonthly: 36225350,
  currentBalanceBonus: 7586130,
  currentRate: 1.005,
  repaymentType: "元利均等",
  bonusMonths: [6, 12],
  monthlyPayment: 90916,
  bonusPayment: 114283,
  nextPaymentDate: "2026-05-27",
  nextPaymentAmount: 90916,
  cancerInsuranceType: "がん100%込み",
  updatedAt: "2026-06-12T00:00:00.000+09:00",
};

const testScenarios: ScenarioRate[] = [
  {
    id: "scenario-a",
    name: "シナリオA（下限金利と同水準）",
    scenarioType: "same-as-lower-rate",
    rate: 0.95,
    memo: "2026年7月想定",
    monthlyPayment: 89975,
    bonusPayment: 113086,
    annualIncrease: 47795,
    shouldSuggestNegotiation: false,
    note: "新規向け下限金利と同水準です",
  },
  {
    id: "scenario-b",
    name: "シナリオB（上昇幅を反映）",
    scenarioType: "rate-rise",
    rate: 1.005,
    memo: "2026年7月想定",
    monthlyPayment: 90916,
    bonusPayment: 114283,
    annualIncrease: 61477,
    shouldSuggestNegotiation: true,
    note: "新規向け下限金利を上回るため、金利引き下げ交渉を検討してください",
  },
];

describe("scenarioMath", () => {
  it("calculates annual increase including bonus payments", () => {
    assert.equal(calculateAnnualIncrease(110000, 100000, 550000, 500000), 220000);
  });

  it("calculates current rate minus lower rate", () => {
    assert.ok(Math.abs(calculateRateDifference(0.755, 0.95) - -0.195) < 0.000001);
  });

  it("suggests negotiation only when scenario rate is higher than lower rate", () => {
    assert.equal(shouldSuggestNegotiation(0.95, 0.95), false);
    assert.equal(shouldSuggestNegotiation(1.005, 0.95), true);
  });

  it("treats rates within display tolerance as equal", () => {
    assert.equal(areRatesEqual(1.005, 1.0054), true);
    assert.equal(areRatesEqual(1.005, 1.006), false);
  });

  it("returns scenario judgement text", () => {
    assert.match(scenarioJudgementText(0.95, 0.95), /同水準/);
    assert.match(scenarioJudgementText(1.005, 0.95), /交渉/);
    assert.match(scenarioJudgementText(1.005, 0.95, 1.005), /現在条件/);
    assert.match(scenarioJudgementText(0.95, 0.95, 1.005), /現在条件より低く/);
  });

  it("returns current-rate negotiation messages by rate difference", () => {
    assert.match(currentRateNegotiationSummary(1.005, 0.95).title, /高い/);
    assert.match(currentRateNegotiationSummary(0.95, 0.95).title, /同水準/);
    assert.match(currentRateNegotiationSummary(0.755, 0.95).title, /低い/);
  });

  it("derives same-rate scenario from current-rate calculated payment and makes annual difference zero", () => {
    const scenario = deriveScenarioFromLoan(
      testScenarios[1],
      testLoanProfile,
      MOMIJI_LOWER_RATE,
      "2026-06-13",
    );

    assert.equal(scenario.monthlyPayment, 91068);
    assert.equal(scenario.bonusPayment, 114237);
    assert.equal(scenario.annualIncrease, 0);
    assert.equal(scenario.shouldSuggestNegotiation, true);
    assert.match(scenario.note, /現在条件/);
  });

  it("derives lower-rate scenario as a saving against the current loan condition", () => {
    const scenario = deriveScenarioFromLoan(
      testScenarios[0],
      testLoanProfile,
      MOMIJI_LOWER_RATE,
      "2026-06-13",
    );

    assert.ok(scenario.monthlyPayment < testLoanProfile.monthlyPayment);
    assert.ok(scenario.bonusPayment < testLoanProfile.bonusPayment);
    assert.ok(scenario.annualIncrease < 0);
    assert.equal(scenario.shouldSuggestNegotiation, false);
  });
});
