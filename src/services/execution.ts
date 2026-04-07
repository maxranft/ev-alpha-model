import type {
  BetExecutionResult,
  BetOrder,
  BetPlacement
} from "../types/bet.js";
import { OrderManager } from "../execution/order.js";

export class ExecutionService {
  constructor(private readonly orderManager: OrderManager = new OrderManager()) {}

  async placeBet(
    userId: string,
    placement: BetPlacement,
    candidatePickId: string
  ): Promise<BetExecutionResult> {
    return this.orderManager.placeBet(userId, placement, candidatePickId);
  }

  async cancelOrder(orderId: string): Promise<BetExecutionResult> {
    return this.orderManager.cancelOrder(orderId);
  }

  async checkOrderStatus(orderId: string): Promise<BetOrder | null> {
    return this.orderManager.checkOrderStatus(orderId);
  }

  async getActiveOrders(userId: string): Promise<BetOrder[]> {
    return this.orderManager.getActiveOrders(userId);
  }
}

export const executionService = new ExecutionService();
