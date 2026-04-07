import type {
  BetExecutionResult,
  BetPlacement,
  BetStatus
} from "../../types/bet.js";

export interface PlatformAdapter {
  placeBet(placement: BetPlacement): Promise<BetExecutionResult>;
  cancelOrder(platformOrderId: string): Promise<BetExecutionResult>;
  getOrderStatus(platformOrderId: string): Promise<BetStatus>;
}
