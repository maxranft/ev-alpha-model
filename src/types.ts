export type OddsFormat = "american" | "decimal";

export interface PolymarketContractMeta {
  marketId: string;
  conditionId?: string;
  slug?: string;
  tokenId?: string;
  outcome?: string;
  outcomeIndex?: number;
  minTickSize?: number;
  negRisk?: boolean;
  acceptingOrders?: boolean;
}

/** Polymarket / CLOB-style venue metadata (optional). */
export interface PolymarketLineMeta {
  /** Best-ask minus best-bid width in probability space (0–1). Smaller = tighter book. */
  bidAskSpread?: number;
  liquidity?: number;
  bestBid?: number;
  bestAsk?: number;
  contract?: PolymarketContractMeta;
}

export interface MarketLine {
  eventId: string;
  market: "spread" | "moneyline";
  selection: string;
  sportsbook: string;
  oddsFormat: OddsFormat;
  odds: number;
  spread?: number;
  polymarket?: PolymarketLineMeta;
}

export interface ModelView {
  coverProbability: number;
  fairSpread?: number;
}

export interface CandidatePick {
  line: MarketLine;
  model: ModelView;
}

export interface ScoredPick extends CandidatePick {
  impliedProbability: number;
  edge: number;
  expectedValuePerDollar: number;
  spreadDiscrepancy?: number;
  kellyFraction: number;
  /** Edge per unit of bid–ask friction (Polymarket). Higher = more “alpha” per trading cost. */
  alphaPerFriction?: number;
  /** EV per unit of Kelly fraction; favors strong edge without huge bankroll use (fractional Kelly). */
  capitalEfficiencyScore?: number;
}
