import { describe, expect, it } from "vitest";
import { parseLiveFeed } from "../src/live-feed.js";

describe("parseLiveFeed", () => {
  it("accepts a valid envelope", () => {
    const env = parseLiveFeed({
      asOf: "2026-01-01T00:00:00Z",
      candidates: [
        {
          line: {
            eventId: "a",
            market: "spread",
            selection: "X -3",
            sportsbook: "S",
            oddsFormat: "american",
            odds: -110,
            spread: -3,
            polymarket: {
              contract: {
                marketId: "m1",
                conditionId: "c1",
                tokenId: "t1",
                outcome: "Yes",
                outcomeIndex: 0,
                minTickSize: 0.01,
                negRisk: false,
                acceptingOrders: true
              }
            }
          },
          model: { coverProbability: 0.52, fairSpread: -4 }
        }
      ]
    });
    expect(env.candidates).toHaveLength(1);
    expect(env.asOf).toBe("2026-01-01T00:00:00Z");
    expect(env.candidates[0]?.line.polymarket?.contract?.tokenId).toBe("t1");
  });

  it("rejects spread market without line.spread", () => {
    expect(() =>
      parseLiveFeed({
        candidates: [
          {
            line: {
              eventId: "a",
              market: "spread",
              selection: "X",
              sportsbook: "S",
              oddsFormat: "american",
              odds: -110
            },
            model: { coverProbability: 0.5 }
          }
        ]
      })
    ).toThrow();
  });
});
