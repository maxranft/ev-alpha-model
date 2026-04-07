import { describe, expect, it } from "vitest";
import { alphaPerFriction, capitalEfficiencyScore } from "../src/efficiency.js";

describe("efficiency", () => {
  it("computes alpha per friction", () => {
    expect(alphaPerFriction(0.05, 0.02)).toBeCloseTo(0.05 / 0.025, 8);
    expect(alphaPerFriction(0.05, undefined)).toBeUndefined();
  });

  it("computes capital efficiency score", () => {
    expect(capitalEfficiencyScore(0.08, 0.04)).toBeCloseTo(0.08 / 0.041, 6);
  });
});
