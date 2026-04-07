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
        liquidity: 980000
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
        liquidity: 980000
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
        liquidity: 540000
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
        liquidity: 540000
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
        liquidity: 1260000
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
        liquidity: 1260000
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
        liquidity: 310000
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
        liquidity: 310000
      }
    },
    model: { coverProbability: 0.59 }
  }
];
