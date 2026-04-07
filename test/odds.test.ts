import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  impliedProbabilityFromAmerican,
  impliedProbabilityFromDecimal,
  noVigTwoWay
} from "../src/odds.js";

describe("odds helpers", () => {
  it("converts american odds to decimal", () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 10);
    expect(americanToDecimal(-110)).toBeCloseTo(1.9090909, 6);
  });

  it("computes implied probabilities", () => {
    expect(impliedProbabilityFromDecimal(2)).toBeCloseTo(0.5, 10);
    expect(impliedProbabilityFromAmerican(-110)).toBeCloseTo(0.5238095, 6);
  });

  it("devigs a two-way market", () => {
    const market = noVigTwoWay(0.5238095, 0.5238095);
    expect(market.overround).toBeCloseTo(1.047619, 5);
    expect(market.sideAFair).toBeCloseTo(0.5, 6);
    expect(market.sideBFair).toBeCloseTo(0.5, 6);
  });
});
