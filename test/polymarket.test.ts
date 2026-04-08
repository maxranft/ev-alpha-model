import { describe, expect, it } from "vitest";
import {
  gammaEventsToCandidates,
  gammaMarketToCandidates
} from "../src/polymarket/gamma-feed.js";

describe("polymarket gamma-feed", () => {
  it("maps a binary market to two candidates with zero edge vs market", () => {
    const m = {
      id: "m1",
      conditionId: "c1",
      question: "Will X happen?",
      active: true,
      closed: false,
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.4", "0.6"]',
      clobTokenIds: '["101", "202"]',
      orderPriceMinTickSize: 0.01,
      acceptingOrders: true
    };
    const picks = gammaMarketToCandidates(m);
    expect(picks).toHaveLength(2);
    expect(picks[0]?.line.sportsbook).toBe("Polymarket");
    expect(picks[0]?.line.oddsFormat).toBe("decimal");
    expect(picks[0]?.model.coverProbability).toBeCloseTo(0.4, 8);
    expect(picks[0]?.line.odds).toBeCloseTo(1 / 0.4, 8);
    expect(picks[0]?.line.polymarket?.contract?.tokenId).toBe("101");
    expect(picks[0]?.line.polymarket?.contract?.conditionId).toBe("c1");
    expect(picks[1]?.model.coverProbability).toBeCloseTo(0.6, 8);
  });

  it("flattens nested events", () => {
    const events = [
      {
        id: "e1",
        markets: [
          {
            id: "m2",
            question: "Q?",
            active: true,
            closed: false,
            outcomes: '["Yes", "No"]',
            outcomePrices: '["0.5", "0.5"]'
          }
        ]
      }
    ];
    const c = gammaEventsToCandidates(events);
    expect(c).toHaveLength(2);
  });
});
