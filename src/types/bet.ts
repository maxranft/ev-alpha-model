export const POLYMARKET_PLATFORM = "polymarket";

export type ExecutionPlatform = typeof POLYMARKET_PLATFORM;
export type BetSide = "BUY" | "SELL";
export type ExecutionMode = "paper" | "live";

export enum BetStatus {
  PENDING = "PENDING",
  PLACED = "PLACED",
  FILLING = "FILLING",
  FILLED = "FILLED",
  CANCELLED = "CANCELLED",
  SETTLED = "SETTLED",
  EXPIRED = "EXPIRED"
}

export const ACTIVE_BET_STATUSES = [
  BetStatus.PENDING,
  BetStatus.PLACED,
  BetStatus.FILLING
] as const;

export enum BetType {
  MONEYLINE = "MONEYLINE",
  SPREAD = "SPREAD",
  TOTAL = "TOTAL"
}

export interface BetSettlement {
  result: "WIN" | "LOSS" | "PUSH" | "VOID";
  payout?: number;
  oddsAtSettlement?: number;
}

export interface BetOrderMetadata {
  candidatePickId: string;
  modelEdge: number;
  modelProbability: number;
  kellyFraction: number;
  riskScore: number;
  expectedValuePerDollar?: number;
  friction?: number;
  liquidity?: number;
  note?: string;
  selection?: string;
  sourceUrl?: string;
  orderMode?: ExecutionMode;
  tokenId?: string;
  conditionId?: string;
  marketSlug?: string;
  outcome?: string;
  outcomeIndex?: number;
  tickSize?: string;
  negRisk?: boolean;
}

export interface BetPlacementMetadata {
  type?: BetType;
  bankroll?: number;
  minEdge?: number;
  modelEdge?: number;
  modelProbability?: number;
  kellyFraction?: number;
  expectedValuePerDollar?: number;
  friction?: number;
  liquidity?: number;
  note?: string;
  selection?: string;
  sourceUrl?: string;
}

export interface BetOrder {
  id: string;
  userId: string;
  platform: ExecutionPlatform;
  marketId: string;
  type: BetType;
  stake: number;
  odds: number;
  side: BetSide;
  status: BetStatus;
  placedAt: Date;
  expiresAt?: Date;
  filledAt?: Date;
  settledAt?: Date;
  platformOrderId?: string;
  error?: string;
  details?: Record<string, unknown>;
  settlement?: BetSettlement;
  metadata: BetOrderMetadata;
}

export interface BetPlacement {
  platform?: ExecutionPlatform;
  mode?: ExecutionMode;
  marketId: string;
  side: BetSide;
  stake: number;
  oddsLimit?: number;
  expiration?: Date;
  tokenId?: string;
  conditionId?: string;
  marketSlug?: string;
  outcome?: string;
  outcomeIndex?: number;
  tickSize?: string;
  negRisk?: boolean;
  metadata?: BetPlacementMetadata;
}

export interface BetExecutionResult {
  success: boolean;
  orderId?: string;
  platformOrderId?: string;
  status?: BetStatus;
  error?: string;
  details?: Record<string, unknown>;
}
  
