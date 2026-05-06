import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateMonthlyDifference,
  calculateNetBenefit,
  calculatePaybackMonths,
  judgeRefinance,
} from "../src/lib/refinanceMath.ts";

describe("refinanceMath", () => {
  it("calculates net benefit after refinance costs", () => {
    assert.equal(calculateNetBenefit(58420000, 56980000, 820000), 620000);
  });

  it("calculates monthly difference", () => {
    assert.equal(calculateMonthlyDifference(90916, 87016), 3900);
  });

  it("returns null payback when monthly difference is not positive", () => {
    assert.equal(calculatePaybackMonths(820000, 0), null);
    assert.equal(calculatePaybackMonths(820000, -1000), null);
  });

  it("judges refinance by benefit and payback months", () => {
    assert.equal(judgeRefinance(620000, 96), "検討価値あり");
    assert.equal(judgeRefinance(620000, 210), "微妙");
    assert.equal(judgeRefinance(-1, null), "メリット小");
  });
});
