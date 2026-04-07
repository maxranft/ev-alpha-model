import { randomUUID } from "node:crypto";

import {
  ACTIVE_BET_STATUSES,
  BetStatus,
  type BetOrder
} from "../types/bet.js";

export type OrderUpdate = Partial<Omit<BetOrder, "id" | "userId">>;

export interface OrderStore {
  createOrder(order: Omit<BetOrder, "id">): Promise<BetOrder>;
  updateOrder(orderId: string, update: OrderUpdate): Promise<BetOrder | null>;
  getOrder(orderId: string): Promise<BetOrder | null>;
  getActiveOrders(userId: string): Promise<BetOrder[]>;
  clear(): Promise<void>;
}

const activeOrderStatusSet = new Set<BetStatus>(ACTIVE_BET_STATUSES);

function cloneDate(date?: Date): Date | undefined {
  return date ? new Date(date) : undefined;
}

function cloneOrder(order: BetOrder): BetOrder {
  return {
    ...order,
    placedAt: new Date(order.placedAt),
    expiresAt: cloneDate(order.expiresAt),
    filledAt: cloneDate(order.filledAt),
    settledAt: cloneDate(order.settledAt),
    details: order.details ? { ...order.details } : undefined,
    settlement: order.settlement ? { ...order.settlement } : undefined,
    metadata: { ...order.metadata }
  };
}

export class InMemoryOrderStore implements OrderStore {
  private readonly orders = new Map<string, BetOrder>();

  async createOrder(order: Omit<BetOrder, "id">): Promise<BetOrder> {
    const created: BetOrder = {
      ...cloneOrder({ ...order, id: randomUUID() })
    };
    this.orders.set(created.id, cloneOrder(created));
    return cloneOrder(created);
  }

  async updateOrder(orderId: string, update: OrderUpdate): Promise<BetOrder | null> {
    const current = this.orders.get(orderId);
    if (!current) {
      return null;
    }

    const next: BetOrder = cloneOrder(current);
    Object.assign(next, update);

    next.metadata = update.metadata ? { ...update.metadata } : { ...current.metadata };

    if ("details" in update) {
      next.details = update.details ? { ...update.details } : undefined;
    } else {
      next.details = current.details ? { ...current.details } : undefined;
    }

    if ("settlement" in update) {
      next.settlement = update.settlement ? { ...update.settlement } : undefined;
    } else {
      next.settlement = current.settlement ? { ...current.settlement } : undefined;
    }

    next.placedAt = cloneDate(update.placedAt) ?? cloneDate(current.placedAt)!;
    next.expiresAt = cloneDate(update.expiresAt) ?? cloneDate(current.expiresAt);
    next.filledAt = cloneDate(update.filledAt) ?? cloneDate(current.filledAt);
    next.settledAt = cloneDate(update.settledAt) ?? cloneDate(current.settledAt);

    this.orders.set(orderId, cloneOrder(next));
    return cloneOrder(next);
  }

  async getOrder(orderId: string): Promise<BetOrder | null> {
    const order = this.orders.get(orderId);
    return order ? cloneOrder(order) : null;
  }

  async getActiveOrders(userId: string): Promise<BetOrder[]> {
    return [...this.orders.values()]
      .filter(
        (order) =>
          order.userId === userId && activeOrderStatusSet.has(order.status)
      )
      .sort((left, right) => right.placedAt.getTime() - left.placedAt.getTime())
      .map(cloneOrder);
  }

  async clear(): Promise<void> {
    this.orders.clear();
  }
}

export const orderStore: OrderStore = new InMemoryOrderStore();
