import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAnnualIncrease,
  calculateRateDifference,
  scenarioJudgementText,
  shouldSuggestNegotiation,
} from "../src/lib/scenarioMath.ts";

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

  it("returns scenario judgement text", () => {
    assert.match(scenarioJudgementText(0.95, 0.95), /同水準/);
    assert.match(scenarioJudgementText(1.005, 0.95), /交渉/);
  });
});
