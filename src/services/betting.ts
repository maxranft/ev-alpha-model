import type { BetPlacement } from "../types/bet.js";
import { executionService } from "./execution.js";

export const placeBet = async (
  userId: string,
  placement: BetPlacement,
  candidatePickId: string
) => {
  return executionService.placeBet(userId, placement, candidatePickId);
};

export const cancelOrder = async (orderId: string) => {
  return executionService.cancelOrder(orderId);
};

export const getOrderStatus = async (orderId: string) => {
  return executionService.checkOrderStatus(orderId);
};

export const getActiveOrders = async (userId: string) => {
  return executionService.getActiveOrders(userId);
};
