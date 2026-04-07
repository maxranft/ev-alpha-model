export const POLYMARKET_PLATFORM = "polymarket";

export type ExecutionPlatform = typeof POLYMARKET_PLATFORM;
export type BetSide = "BUY" | "SELL";

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
}

export interface BetPlacementMetadata {
  type?: BetType;
  bankroll?: number;
  minEdge?: number;
  modelEdge?: number;
  modelProbability?: number;
  kellyFraction?: number;
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
  marketId: string;
  side: BetSide;
  stake: number;
  oddsLimit?: number;
  expiration?: Date;
  metadata?: BetPlacementMetadata;
}

export interface BetExecutionResult {
  success: boolean;
  orderId?: string;
  platformOrderId?: string;
  error?: string;
  details?: Record<string, unknown>;
}
  
