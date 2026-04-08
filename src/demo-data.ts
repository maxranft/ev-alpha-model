import type { CandidatePick } from "./types.js";

/** Editable Polymarket-style sample slate for UI demos and tests. */
export const demoCandidates: CandidatePick[] = [
  {
    line: {
      eventId: "pm-fed-cut-sep-2026-yes",
      market: "moneyline",
      selection: "Fed cuts rates before Sep 2026 — Yes",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 2.17,
      polymarket: {
        bestBid: 0.448,
        bestAsk: 0.47,
        bidAskSpread: 0.022,
        liquidity: 980000,
        contract: {
          marketId: "demo-fed-cut-sep-2026",
          conditionId: "demo-fed-cut-sep-2026-condition",
          slug: "fed-cuts-rates-before-sep-2026",
          tokenId: "demo-fed-cut-sep-2026-yes",
          outcome: "Yes",
          outcomeIndex: 0,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.54 }
  },
  {
    line: {
      eventId: "pm-fed-cut-sep-2026-no",
      market: "moneyline",
      selection: "Fed cuts rates before Sep 2026 — No",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 1.86,
      polymarket: {
        bestBid: 0.53,
        bestAsk: 0.552,
        bidAskSpread: 0.022,
        liquidity: 980000,
        contract: {
          marketId: "demo-fed-cut-sep-2026",
          conditionId: "demo-fed-cut-sep-2026-condition",
          slug: "fed-cuts-rates-before-sep-2026",
          tokenId: "demo-fed-cut-sep-2026-no",
          outcome: "No",
          outcomeIndex: 1,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.46 }
  },
  {
    line: {
      eventId: "pm-recession-q4-2026-yes",
      market: "moneyline",
      selection: "US recession by Q4 2026 — Yes",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 2.78,
      polymarket: {
        bestBid: 0.345,
        bestAsk: 0.376,
        bidAskSpread: 0.031,
        liquidity: 540000,
        contract: {
          marketId: "demo-recession-q4-2026",
          conditionId: "demo-recession-q4-2026-condition",
          slug: "us-recession-by-q4-2026",
          tokenId: "demo-recession-q4-2026-yes",
          outcome: "Yes",
          outcomeIndex: 0,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.44 }
  },
  {
    line: {
      eventId: "pm-recession-q4-2026-no",
      market: "moneyline",
      selection: "US recession by Q4 2026 — No",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 1.56,
      polymarket: {
        bestBid: 0.624,
        bestAsk: 0.655,
        bidAskSpread: 0.031,
        liquidity: 540000,
        contract: {
          marketId: "demo-recession-q4-2026",
          conditionId: "demo-recession-q4-2026-condition",
          slug: "us-recession-by-q4-2026",
          tokenId: "demo-recession-q4-2026-no",
          outcome: "No",
          outcomeIndex: 1,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.56 }
  },
  {
    line: {
      eventId: "pm-stablecoin-bill-2026-yes",
      market: "moneyline",
      selection: "US stablecoin bill enacted in 2026 — Yes",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 1.72,
      polymarket: {
        bestBid: 0.57,
        bestAsk: 0.588,
        bidAskSpread: 0.018,
        liquidity: 1260000,
        contract: {
          marketId: "demo-stablecoin-bill-2026",
          conditionId: "demo-stablecoin-bill-2026-condition",
          slug: "us-stablecoin-bill-enacted-in-2026",
          tokenId: "demo-stablecoin-bill-2026-yes",
          outcome: "Yes",
          outcomeIndex: 0,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.63 }
  },
  {
    line: {
      eventId: "pm-stablecoin-bill-2026-no",
      market: "moneyline",
      selection: "US stablecoin bill enacted in 2026 — No",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 2.38,
      polymarket: {
        bestBid: 0.412,
        bestAsk: 0.43,
        bidAskSpread: 0.018,
        liquidity: 1260000,
        contract: {
          marketId: "demo-stablecoin-bill-2026",
          conditionId: "demo-stablecoin-bill-2026-condition",
          slug: "us-stablecoin-bill-enacted-in-2026",
          tokenId: "demo-stablecoin-bill-2026-no",
          outcome: "No",
          outcomeIndex: 1,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.37 }
  },
  {
    line: {
      eventId: "pm-sol-etf-2026-yes",
      market: "moneyline",
      selection: "Spot SOL ETF approved in 2026 — Yes",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 2.94,
      polymarket: {
        bestBid: 0.318,
        bestAsk: 0.362,
        bidAskSpread: 0.044,
        liquidity: 310000,
        contract: {
          marketId: "demo-sol-etf-2026",
          conditionId: "demo-sol-etf-2026-condition",
          slug: "spot-sol-etf-approved-in-2026",
          tokenId: "demo-sol-etf-2026-yes",
          outcome: "Yes",
          outcomeIndex: 0,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.41 }
  },
  {
    line: {
      eventId: "pm-sol-etf-2026-no",
      market: "moneyline",
      selection: "Spot SOL ETF approved in 2026 — No",
      sportsbook: "Polymarket",
      oddsFormat: "decimal",
      odds: 1.49,
      polymarket: {
        bestBid: 0.638,
        bestAsk: 0.682,
        bidAskSpread: 0.044,
        liquidity: 310000,
        contract: {
          marketId: "demo-sol-etf-2026",
          conditionId: "demo-sol-etf-2026-condition",
          slug: "spot-sol-etf-approved-in-2026",
          tokenId: "demo-sol-etf-2026-no",
          outcome: "No",
          outcomeIndex: 1,
          minTickSize: 0.01,
          negRisk: false,
          acceptingOrders: true
        }
      }
    },
    model: { coverProbability: 0.59 }
  }
];
