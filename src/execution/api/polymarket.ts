import { randomUUID } from "node:crypto";

import {
  BetStatus,
  POLYMARKET_PLATFORM,
  type BetExecutionResult,
  type BetPlacement
} from "../../types/bet.js";
import type { PlatformAdapter } from "./platform-adapter.js";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class PolymarketAdapter implements PlatformAdapter {
  private readonly apiKey: string;
  private readonly apiUrl = "https://api.polymarket.com";

  constructor() {
    this.apiKey = process.env.POLYMARKET_API_KEY || "";
    if (!this.apiKey) {
      console.warn(
        "Polymarket API key not configured; execution calls will fail until POLYMARKET_API_KEY is set."
      );
    }
  }

  async placeBet(placement: BetPlacement): Promise<BetExecutionResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Polymarket API key not configured"
      };
    }

    try {
      console.log(
        `Placing Polymarket order: ${placement.marketId} ${placement.side} ${placement.stake} @ ${placement.oddsLimit ?? "market"}`
      );

      return {
        success: true,
        platformOrderId: `PM-${randomUUID()}`,
        details: {
          simulated: true,
          endpoint: this.apiUrl,
          platform: POLYMARKET_PLATFORM,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error)
      };
    }
  }

  async cancelOrder(platformOrderId: string): Promise<BetExecutionResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Polymarket API key not configured"
      };
    }

    try {
      console.log(`Cancelling Polymarket order: ${platformOrderId}`);
      return {
        success: true,
        details: {
          simulated: true,
          endpoint: this.apiUrl,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error)
      };
    }
  }

  async getOrderStatus(platformOrderId: string): Promise<BetStatus> {
    if (!this.apiKey) {
      throw new Error("Polymarket API key not configured");
    }

    console.log(`Checking Polymarket order status: ${platformOrderId}`);
    return BetStatus.PLACED;
  }
}
