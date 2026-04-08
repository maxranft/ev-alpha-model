import { describe, expect, it } from "vitest";

import type { ScoredPick } from "../src/types.js";
import { runTrainingSimulation } from "../web/simulation.js";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPick(
  selection: string,
  impliedProbability: number,
  modelProbability: number,
  edge: number,
  expectedValuePerDollar: number,
  kellyFraction: number
): ScoredPick {
  return {
    line: {
      eventId: `event-${selection}`,
      market: "moneyline",
      selection,
      sportsbook: "polymarket",
      oddsFormat: "decimal",
      odds: 1 / impliedProbability,
      polymarket: {
        bidAskSpread: 0.02,
        liquidity: 450_000
      }
    },
    model: {
      coverProbability: modelProbability
    },
    impliedProbability,
    edge,
    expectedValuePerDollar,
    kellyFraction,
    alphaPerFriction: edge / 0.02,
    capitalEfficiencyScore: expectedValuePerDollar / Math.max(kellyFraction, 0.001)
  };
}

describe("training simulation", () => {
  it("returns a ranked recommendation across frequency and volume combinations", () => {
    const picks: ScoredPick[] = [
      buildPick("YES 1", 0.46, 0.56, 0.1, 0.12, 0.06),
      buildPick("YES 2", 0.41, 0.5, 0.09, 0.11, 0.055),
      buildPick("YES 3", 0.38, 0.46, 0.08, 0.095, 0.05),
      buildPick("NO 1", 0.57, 0.48, -0.09, 0.1, 0.05)
    ];

    const report = runTrainingSimulation(picks, {
      bankroll: 10_000,
      maxStakePct: 6,
      trials: 120,
      cycles: 24,
      objective: "balanced",
      frequencies: [1, 2, 3],
      volumeScales: [0.6, 1, 1.4],
      random: mulberry32(7)
    });

    expect(report.cells).toHaveLength(9);
    expect(report.best).not.toBeNull();
    expect(report.best?.score).toBeGreaterThan(report.cells.at(-1)?.score ?? -Infinity);
    expect(report.baseline?.frequency).toBe(1);
    expect(report.baseline?.volumeScale).toBe(1);
  });
});
