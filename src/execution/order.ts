import {
  BetStatus,
  BetType,
  POLYMARKET_PLATFORM,
  type BetExecutionResult,
  type BetOrder,
  type BetPlacement
} from "../types/bet.js";
import { PolymarketAdapter } from "./api/polymarket.js";
import type { PlatformAdapter } from "./api/platform-adapter.js";
import {
  orderStore as defaultOrderStore,
  type OrderStore
} from "./storage.js";
import { RiskManager } from "./risk.js";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class OrderManager {
  constructor(
    private readonly platformAdapter: PlatformAdapter = new PolymarketAdapter(),
    private readonly orderStore: OrderStore = defaultOrderStore,
    private readonly riskManager: RiskManager = new RiskManager(orderStore)
  ) {}

  private normalizePlacement(placement: BetPlacement): BetPlacement & {
    platform: typeof POLYMARKET_PLATFORM;
  } {
    return {
      ...placement,
      platform: placement.platform ?? POLYMARKET_PLATFORM
    };
  }

  async placeBet(
    userId: string, 
    placement: BetPlacement,
    candidatePickId: string
  ): Promise<BetExecutionResult> {
    const normalizedPlacement = this.normalizePlacement(placement);
    if (normalizedPlacement.platform !== POLYMARKET_PLATFORM) {
      return {
        success: false,
        error: `Unsupported platform: ${normalizedPlacement.platform}`
      };
    }

    const riskCheck = await this.riskManager.checkPlacement(userId, normalizedPlacement);
    if (!riskCheck.approved) {
      return {
        success: false,
        error: `Risk check failed: ${riskCheck.reason}`
      };
    }

    const pendingOrder: Omit<BetOrder, 'id'> = {
      userId,
      platform: normalizedPlacement.platform,
      marketId: normalizedPlacement.marketId,
      type: normalizedPlacement.metadata?.type || BetType.MONEYLINE,
      stake: normalizedPlacement.stake,
      odds: normalizedPlacement.oddsLimit || 0,
      side: normalizedPlacement.side,
      status: BetStatus.PENDING,
      placedAt: new Date(),
      expiresAt: normalizedPlacement.expiration,
      metadata: {
        candidatePickId,
        modelEdge: normalizedPlacement.metadata?.modelEdge || 0,
        modelProbability: normalizedPlacement.metadata?.modelProbability || 0,
        kellyFraction: normalizedPlacement.metadata?.kellyFraction || 0,
        riskScore: riskCheck.score,
        expectedValuePerDollar: normalizedPlacement.metadata?.expectedValuePerDollar,
        friction: normalizedPlacement.metadata?.friction,
        liquidity: normalizedPlacement.metadata?.liquidity,
        note: normalizedPlacement.metadata?.note,
        selection: normalizedPlacement.metadata?.selection,
        sourceUrl: normalizedPlacement.metadata?.sourceUrl,
        orderMode: normalizedPlacement.mode ?? "paper",
        tokenId: normalizedPlacement.tokenId,
        conditionId: normalizedPlacement.conditionId,
        marketSlug: normalizedPlacement.marketSlug,
        outcome: normalizedPlacement.outcome,
        outcomeIndex: normalizedPlacement.outcomeIndex,
        tickSize: normalizedPlacement.tickSize,
        negRisk: normalizedPlacement.negRisk
      }
    };

    const order = await this.orderStore.createOrder(pendingOrder);

    try {
      const executionResult = await this.platformAdapter.placeBet(normalizedPlacement);
      
      if (executionResult.success) {
        const updatedOrder = await this.orderStore.updateOrder(order.id, {
          status: BetStatus.PLACED,
          platformOrderId: executionResult.platformOrderId,
          error: undefined,
          details: executionResult.details
        });
        
        return {
          success: true,
          orderId: updatedOrder?.id || order.id,
          platformOrderId: executionResult.platformOrderId,
          status: updatedOrder?.status ?? BetStatus.PLACED,
          details: executionResult.details
        };
      }

      await this.orderStore.updateOrder(order.id, {
        status: BetStatus.CANCELLED,
        error: executionResult.error || "Order placement failed",
        details: executionResult.details
      });

      return {
        success: false,
        orderId: order.id,
        status: BetStatus.CANCELLED,
        error: executionResult.error || "Order placement failed"
      };
    } catch (error) {
      const message = toErrorMessage(error);
      console.error(`Order execution error: ${message}`);
      await this.orderStore.updateOrder(order.id, {
        status: BetStatus.CANCELLED,
        error: message
      });
      return {
        success: false,
        orderId: order.id,
        status: BetStatus.CANCELLED,
        error: message
      };
    }
  }

  async cancelOrder(orderId: string): Promise<BetExecutionResult> {
    const order = await this.orderStore.getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: "Order not found"
      };
    }

    if (order.status !== BetStatus.PENDING && order.status !== BetStatus.PLACED) {
      return {
        success: false,
        error: `Order cannot be cancelled (status: ${order.status})`
      };
    }

    if (!order.platformOrderId) {
      if (order.status === BetStatus.PENDING) {
        await this.orderStore.updateOrder(orderId, {
          status: BetStatus.CANCELLED,
          error: undefined
        });
        return { success: true, orderId, status: BetStatus.CANCELLED };
      }

      return {
        success: false,
        error: "Placed order is missing Polymarket order ID"
      };
    }

    try {
      const result = await this.platformAdapter.cancelOrder(order.platformOrderId);
      
      if (result.success) {
        await this.orderStore.updateOrder(orderId, {
          status: BetStatus.CANCELLED,
          error: undefined,
          details: result.details
        });
        return { success: true, orderId, status: BetStatus.CANCELLED, details: result.details };
      }

      return {
        success: false,
        orderId,
        status: order.status,
        error: result.error || "Failed to cancel order"
      };
    } catch (error) {
      const message = toErrorMessage(error);
      console.error(`Order cancellation error: ${message}`);
      return {
        success: false,
        orderId,
        status: order.status,
        error: message
      };
    }
  }

  async getOrder(orderId: string): Promise<BetOrder | null> {
    return this.orderStore.getOrder(orderId);
  }

  async listOrders(userId?: string, limit?: number): Promise<BetOrder[]> {
    return this.orderStore.listOrders(userId, limit);
  }

  async checkOrderStatus(orderId: string): Promise<BetOrder | null> {
    const order = await this.orderStore.getOrder(orderId);
    if (!order || !order.platformOrderId) {
      return order;
    }

    try {
      const status = await this.platformAdapter.getOrderStatus(order.platformOrderId);
      
      if (status !== order.status) {
        return await this.orderStore.updateOrder(orderId, {
          status,
          filledAt:
            status === BetStatus.FILLED && !order.filledAt ? new Date() : order.filledAt,
          settledAt:
            status === BetStatus.SETTLED && !order.settledAt
              ? new Date()
              : order.settledAt
        });
      }
      
      return order;
    } catch (error) {
      console.error(`Status check error: ${toErrorMessage(error)}`);
      return order;
    }
  }

  async getActiveOrders(userId: string): Promise<BetOrder[]> {
    return this.orderStore.getActiveOrders(userId);
  }
}
