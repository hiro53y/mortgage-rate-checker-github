import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateEqualPrincipalAndInterestPayment,
  calculateRemainingMonths,
} from "../src/lib/mortgageMath.ts";

describe("mortgageMath", () => {
  it("calculates zero-rate equal payment", () => {
    assert.equal(calculateEqualPrincipalAndInterestPayment(1200000, 0, 12), 100000);
  });

  it("calculates fixed-rate payment with rounded expected value", () => {
    const payment = calculateEqualPrincipalAndInterestPayment(10000000, 1.2, 360);
    assert.equal(Math.round(payment), 33091);
  });

  it("calculates remaining months inclusively", () => {
    assert.equal(calculateRemainingMonths("2026-05-27", "2066-09-27"), 485);
  });
});
