import type { CandidatePick } from "./types.js";

/** Editable sample slate for UI demos and tests. */
export const demoCandidates: CandidatePick[] = [
  {
    line: {
      eventId: "ev-1",
      market: "spread",
      selection: "Eagles -3.5",
      sportsbook: "DemoBook",
      oddsFormat: "american",
      odds: -110,
      spread: -3.5
    },
    model: { coverProbability: 0.58, fairSpread: -5.0 }
  },
  {
    line: {
      eventId: "ev-2",
      market: "spread",
      selection: "Chiefs +2.5",
      sportsbook: "DemoBook",
      oddsFormat: "american",
      odds: -108,
      spread: 2.5
    },
    model: { coverProbability: 0.52, fairSpread: 3.0 }
  },
  {
    line: {
      eventId: "ev-3",
      market: "moneyline",
      selection: "Rangers ML",
      sportsbook: "DemoBook",
      oddsFormat: "decimal",
      odds: 2.15
    },
    model: { coverProbability: 0.48 }
  },
  {
    line: {
      eventId: "ev-4",
      market: "spread",
      selection: "Lakers -7.0",
      sportsbook: "DemoBook",
      oddsFormat: "american",
      odds: -105,
      spread: -7.0
    },
    model: { coverProbability: 0.55, fairSpread: -8.5 }
  }
];
