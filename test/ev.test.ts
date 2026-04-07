import { describe, expect, it } from "vitest";
import { expectedValuePerDollar, kellyFraction } from "../src/ev.js";

describe("ev helpers", () => {
  it("computes expected value per dollar staked", () => {
    const ev = expectedValuePerDollar(0.55, 1.91);
    expect(ev).toBeCloseTo(0.0505, 4);
  });

  it("returns zero Kelly for negative-edge bets", () => {
    expect(kellyFraction(0.45, 1.91, 0.5)).toBe(0);
  });

  it("scales Kelly for positive-edge bets", () => {
    const halfKelly = kellyFraction(0.55, 1.91, 0.5);
    const quarterKelly = kellyFraction(0.55, 1.91, 0.25);
    expect(halfKelly).toBeGreaterThan(0);
    expect(quarterKelly).toBeCloseTo(halfKelly / 2, 8);
  });
});
