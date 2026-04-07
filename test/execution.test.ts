import { describe, expect, it } from "vitest";

import type { PlatformAdapter } from "../src/execution/api/platform-adapter.js";
import { OrderManager } from "../src/execution/order.js";
import { InMemoryOrderStore } from "../src/execution/storage.js";
import {
  BetStatus,
  BetType,
  POLYMARKET_PLATFORM,
  type BetExecutionResult,
  type BetPlacement
} from "../src/types/bet.js";

function buildPlacement(overrides: Partial<BetPlacement> = {}): BetPlacement {
  return {
    marketId: "pm-market-1",
    side: "BUY",
    stake: 20,
    oddsLimit: 2.15,
    metadata: {
      bankroll: 1000,
      kellyFraction: 0.03,
      minEdge: 0.02,
      modelEdge: 0.08,
      modelProbability: 0.56,
      type: BetType.MONEYLINE
    },
    ...overrides
  };
}

function buildAdapter(overrides: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    async placeBet(): Promise<BetExecutionResult> {
      return {
        success: true,
        platformOrderId: "pm-order-1",
        details: { simulated: true }
      };
    },
    async cancelOrder(): Promise<BetExecutionResult> {
      return {
        success: true,
        details: { cancelled: true }
      };
    },
    async getOrderStatus(): Promise<BetStatus> {
      return BetStatus.PLACED;
    },
    ...overrides
  };
}

describe("execution order manager", () => {
  it("defaults placements to polymarket and stores the platform order id", async () => {
    const store = new InMemoryOrderStore();
    const manager = new OrderManager(buildAdapter(), store);

    const result = await manager.placeBet("user-1", buildPlacement(), "candidate-1");

    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();

    const order = await store.getOrder(result.orderId!);
    expect(order?.platform).toBe(POLYMARKET_PLATFORM);
    expect(order?.status).toBe(BetStatus.PLACED);
    expect(order?.platformOrderId).toBe("pm-order-1");
    expect(order?.metadata.candidatePickId).toBe("candidate-1");
  });

  it("cancels failed placements and preserves the failure reason", async () => {
    const store = new InMemoryOrderStore();
    const manager = new OrderManager(
      buildAdapter({
        async placeBet(): Promise<BetExecutionResult> {
          return {
            success: false,
            error: "limit price moved"
          };
        }
      }),
      store
    );

    const result = await manager.placeBet("user-1", buildPlacement(), "candidate-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("limit price moved");

    const order = await store.getOrder(result.orderId!);
    expect(order?.status).toBe(BetStatus.CANCELLED);
    expect(order?.error).toBe("limit price moved");
  });

  it("supports local cancellation before a platform id exists", async () => {
    const store = new InMemoryOrderStore();
    const order = await store.createOrder({
      userId: "user-1",
      platform: POLYMARKET_PLATFORM,
      marketId: "pm-market-1",
      type: BetType.MONEYLINE,
      stake: 15,
      odds: 2.05,
      side: "BUY",
      status: BetStatus.PENDING,
      placedAt: new Date(),
      metadata: {
        candidatePickId: "candidate-1",
        modelEdge: 0.05,
        modelProbability: 0.54,
        kellyFraction: 0.02,
        riskScore: 0.95
      }
    });
    const manager = new OrderManager(buildAdapter(), store);

    const result = await manager.cancelOrder(order.id);

    expect(result.success).toBe(true);
    const cancelled = await store.getOrder(order.id);
    expect(cancelled?.status).toBe(BetStatus.CANCELLED);
  });

  it("syncs filled status back into the order store", async () => {
    const store = new InMemoryOrderStore();
    const order = await store.createOrder({
      userId: "user-1",
      platform: POLYMARKET_PLATFORM,
      marketId: "pm-market-1",
      type: BetType.MONEYLINE,
      stake: 15,
      odds: 2.05,
      side: "BUY",
      status: BetStatus.PLACED,
      placedAt: new Date(),
      platformOrderId: "pm-order-1",
      metadata: {
        candidatePickId: "candidate-1",
        modelEdge: 0.05,
        modelProbability: 0.54,
        kellyFraction: 0.02,
        riskScore: 0.95
      }
    });
    const manager = new OrderManager(
      buildAdapter({
        async getOrderStatus(): Promise<BetStatus> {
          return BetStatus.FILLED;
        }
      }),
      store
    );

    const updated = await manager.checkOrderStatus(order.id);

    expect(updated?.status).toBe(BetStatus.FILLED);
    expect(updated?.filledAt).toBeInstanceOf(Date);
  });
});
