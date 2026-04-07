import { alphaPerFriction, capitalEfficiencyScore } from "./efficiency.js";
import { expectedValuePerDollar, kellyFraction } from "./ev.js";
import { impliedProbabilityFromAmerican, impliedProbabilityFromDecimal } from "./odds.js";
import { spreadDiscrepancyScore } from "./spread.js";
import type { CandidatePick, ScoredPick } from "./types.js";

export type RankSortMode = "ev" | "alpha_per_friction" | "capital_efficiency";

export interface RankOptions {
  minEdge?: number;
  minExpectedValue?: number;
  kellyScale?: number;
  /** How to order passing picks after filters. */
  sortMode?: RankSortMode;
}

export function scorePick(
  candidate: CandidatePick,
  options: RankOptions = {}
): ScoredPick {
  const impliedProbability =
    candidate.line.oddsFormat === "american"
      ? impliedProbabilityFromAmerican(candidate.line.odds)
      : impliedProbabilityFromDecimal(candidate.line.odds);

  const decimalOdds =
    candidate.line.oddsFormat === "american"
      ? (candidate.line.odds > 0
          ? 1 + candidate.line.odds / 100
          : 1 + 100 / Math.abs(candidate.line.odds))
      : candidate.line.odds;

  const expectedValue = expectedValuePerDollar(
    candidate.model.coverProbability,
    decimalOdds
  );
  const edge = candidate.model.coverProbability - impliedProbability;

  const spreadDiscrepancy =
    candidate.line.market === "spread" &&
    candidate.line.spread !== undefined &&
    candidate.model.fairSpread !== undefined
      ? spreadDiscrepancyScore(candidate.line.spread, candidate.model.fairSpread)
      : undefined;

  const kf = kellyFraction(
    candidate.model.coverProbability,
    decimalOdds,
    options.kellyScale ?? 0.5
  );
  const pmSpread = candidate.line.polymarket?.bidAskSpread;
  const apf = alphaPerFriction(edge, pmSpread);
  const ces = capitalEfficiencyScore(expectedValue, kf);

  return {
    ...candidate,
    impliedProbability,
    edge,
    expectedValuePerDollar: expectedValue,
    spreadDiscrepancy,
    kellyFraction: kf,
    alphaPerFriction: apf,
    capitalEfficiencyScore: ces
  };
}

function compareRanked(a: ScoredPick, b: ScoredPick, sortMode: RankSortMode): number {
  if (sortMode === "alpha_per_friction") {
    const apfB = b.alphaPerFriction ?? -Infinity;
    const apfA = a.alphaPerFriction ?? -Infinity;
    if (apfB !== apfA) {
      return apfB - apfA;
    }
  }
  if (sortMode === "capital_efficiency") {
    const ceB = b.capitalEfficiencyScore ?? -Infinity;
    const ceA = a.capitalEfficiencyScore ?? -Infinity;
    if (ceB !== ceA) {
      return ceB - ceA;
    }
  }
  if (b.expectedValuePerDollar !== a.expectedValuePerDollar) {
    return b.expectedValuePerDollar - a.expectedValuePerDollar;
  }
  const apfB2 = b.alphaPerFriction ?? -Infinity;
  const apfA2 = a.alphaPerFriction ?? -Infinity;
  if (apfB2 !== apfA2) {
    return apfB2 - apfA2;
  }
  const bSpreadScore = Math.abs(b.spreadDiscrepancy ?? 0);
  const aSpreadScore = Math.abs(a.spreadDiscrepancy ?? 0);
  return bSpreadScore - aSpreadScore;
}

export function rankPicks(
  candidates: CandidatePick[],
  options: RankOptions = {}
): ScoredPick[] {
  const minEdge = options.minEdge ?? 0;
  const minExpectedValue = options.minExpectedValue ?? 0;
  const sortMode = options.sortMode ?? "ev";

  return candidates
    .map((candidate) => scorePick(candidate, options))
    .filter(
      (pick) =>
        pick.edge >= minEdge && pick.expectedValuePerDollar >= minExpectedValue
    )
    .sort((a, b) => compareRanked(a, b, sortMode));
}
