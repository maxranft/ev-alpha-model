import { describe, expect, it } from "vitest";
import { rankPicks } from "../src/rank.js";
import type { CandidatePick } from "../src/types.js";

describe("rankPicks", () => {
  it("ranks by expected value and spread discrepancy", () => {
    const picks: CandidatePick[] = [
      {
        line: {
          eventId: "A",
          market: "spread",
          selection: "Team A -3.5",
          sportsbook: "Book1",
          oddsFormat: "american",
          odds: -110,
          spread: -3.5
        },
        model: { coverProbability: 0.57, fairSpread: -5.0 }
      },
      {
        line: {
          eventId: "B",
          market: "spread",
          selection: "Team B +2.5",
          sportsbook: "Book1",
          oddsFormat: "american",
          odds: -110,
          spread: 2.5
        },
        model: { coverProbability: 0.53, fairSpread: 3.0 }
      }
    ];

    const ranked = rankPicks(picks, { minEdge: 0, minExpectedValue: 0 });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.line.eventId).toBe("A");
    expect(ranked[0]?.expectedValuePerDollar).toBeGreaterThan(
      ranked[1]?.expectedValuePerDollar ?? 0
    );
  });

  it("filters bets below thresholds", () => {
    const picks: CandidatePick[] = [
      {
        line: {
          eventId: "C",
          market: "moneyline",
          selection: "Team C",
          sportsbook: "Book2",
          oddsFormat: "decimal",
          odds: 2.2
        },
        model: { coverProbability: 0.4 }
      }
    ];

    const ranked = rankPicks(picks, { minExpectedValue: 0.01 });
    expect(ranked).toHaveLength(0);
  });

  it("sorts by alpha per friction when Polymarket bid–ask is present", () => {
    const picks: CandidatePick[] = [
      {
        line: {
          eventId: "loose",
          market: "moneyline",
          selection: "Loose book",
          sportsbook: "Polymarket",
          oddsFormat: "decimal",
          odds: 2,
          polymarket: { bidAskSpread: 0.08 }
        },
        model: { coverProbability: 0.55 }
      },
      {
        line: {
          eventId: "tight",
          market: "moneyline",
          selection: "Tight book",
          sportsbook: "Polymarket",
          oddsFormat: "decimal",
          odds: 2,
          polymarket: { bidAskSpread: 0.02 }
        },
        model: { coverProbability: 0.55 }
      }
    ];
    const ranked = rankPicks(picks, {
      minEdge: 0,
      minExpectedValue: 0,
      sortMode: "alpha_per_friction"
    });
    expect(ranked[0]?.line.eventId).toBe("tight");
  });
});
