import {
  POLYMARKET_PLATFORM,
  type BetPlacement
} from "../types/bet.js";
import {
  orderStore as defaultOrderStore,
  type OrderStore
} from "./storage.js";

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  score: number;
}

export class RiskManager {
  constructor(private readonly orderStore: OrderStore = defaultOrderStore) {}

  async checkPlacement(userId: string, placement: BetPlacement): Promise<RiskCheckResult> {
    const platform = placement.platform ?? POLYMARKET_PLATFORM;
    if (platform !== POLYMARKET_PLATFORM) {
      return {
        approved: false,
        reason: `Unsupported platform: ${platform}`,
        score: 0
      };
    }

    const activeOrders = await this.orderStore.getActiveOrders(userId);
    const totalActiveStake = activeOrders.reduce((sum, order) => sum + order.stake, 0);
    
    const maxSingleBet = 0.05 * (placement.metadata?.bankroll || 1000);
    if (placement.stake > maxSingleBet) {
      return {
        approved: false,
        reason: `Bet size exceeds max single bet (stake: ${placement.stake}, max: ${maxSingleBet})`,
        score: 0.1
      };
    }
    
    const maxTotalExposure = 0.15 * (placement.metadata?.bankroll || 1000);
    if (totalActiveStake + placement.stake > maxTotalExposure) {
      return {
        approved: false,
        reason: `Total exposure exceeds limit (active: ${totalActiveStake}, new: ${placement.stake}, max: ${maxTotalExposure})`,
        score: 0.2
      };
    }
    
    const minEdge = placement.metadata?.minEdge || 0.02;
    const modelEdge = placement.metadata?.modelEdge || 0;
    if (modelEdge < minEdge) {
      return {
        approved: false,
        reason: `Edge below minimum threshold (${modelEdge}, min: ${minEdge})`,
        score: 0.3
      };
    }
    
    const liquidityCheck = await this.checkMarketLiquidity(platform, placement.marketId);
    
    if (!liquidityCheck.approved) {
      return liquidityCheck;
    }
    
    const score = 0.9 + (0.1 * modelEdge);
    return {
      approved: true,
      score
    };
  }
  
  private async checkMarketLiquidity(platform: string, marketId: string): Promise<RiskCheckResult> {
    if (platform !== POLYMARKET_PLATFORM) {
      return {
        approved: false,
        reason: `Unsupported platform: ${platform}`,
        score: 0
      };
    }

    return { approved: true, score: 0.95 };
  }
}
