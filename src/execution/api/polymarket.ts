import {
  Chain,
  ClobClient,
  OrderType,
  Side,
  SignatureType,
  type ApiKeyCreds,
  type TickSize
} from "@polymarket/clob-client";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, polygonAmoy } from "viem/chains";

import {
  BetStatus,
  type BetExecutionResult,
  type BetPlacement
} from "../../types/bet.js";
import type { PlatformAdapter } from "./platform-adapter.js";

export interface PolymarketAdapterConfig {
  host?: string;
  chainId?: Chain;
  privateKey?: string;
  funderAddress?: string;
  signatureType?: SignatureType;
  apiCredentials?: ApiKeyCreds;
  liveTradingEnabled?: boolean;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeHex(value: string): Hex {
  return value.startsWith("0x") ? (value as Hex) : (`0x${value}` as Hex);
}

function decimalsForStep(step: number): number {
  const raw = step.toString();
  if (!raw.includes(".")) {
    return 0;
  }
  return raw.split(".")[1]?.length ?? 0;
}

function roundPriceToTick(price: number, tickSize: string, side: Side): number {
  const step = Number.parseFloat(tickSize);
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error(`Invalid Polymarket tick size: ${tickSize}`);
  }
  const scale = 10 ** decimalsForStep(step);
  const scaledPrice = Math.round(price * scale);
  const scaledStep = Math.round(step * scale);
  const roundedTicks =
    side === Side.BUY
      ? Math.floor(scaledPrice / scaledStep)
      : Math.ceil(scaledPrice / scaledStep);
  const rounded = (roundedTicks * scaledStep) / scale;
  return Number(rounded.toFixed(decimalsForStep(step)));
}

function probabilityFromOdds(oddsLimit: number | undefined): number {
  if (oddsLimit === undefined || !Number.isFinite(oddsLimit) || oddsLimit <= 1) {
    throw new Error("Live Polymarket execution requires decimal limit odds above 1.");
  }
  return 1 / oddsLimit;
}

function shareSizeFromStake(stake: number, probability: number): number {
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new Error("Stake must be greater than zero.");
  }
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new Error(`Probability must be between 0 and 1 for CLOB orders. Received ${probability}.`);
  }
  return Number((stake / probability).toFixed(6));
}

function mapOrderStatus(status: string): BetStatus {
  switch (status.toUpperCase()) {
    case "LIVE":
    case "OPEN":
    case "UNMATCHED":
      return BetStatus.PLACED;
    case "MATCHED":
    case "FILLED":
      return BetStatus.FILLED;
    case "DELAYED":
    case "PARTIAL":
    case "PARTIALLY_FILLED":
      return BetStatus.FILLING;
    case "CANCELED":
    case "CANCELLED":
      return BetStatus.CANCELLED;
    default:
      return BetStatus.PLACED;
  }
}

export class PolymarketAdapter implements PlatformAdapter {
  private readonly host: string;
  private readonly chainId: Chain;
  private readonly privateKey?: string;
  private readonly funderAddress?: string;
  private readonly signatureType: SignatureType;
  private readonly seededCreds?: ApiKeyCreds;
  private readonly liveTradingEnabled: boolean;
  private clientPromise: Promise<ClobClient> | null = null;

  constructor(config: PolymarketAdapterConfig = {}) {
    this.host = config.host ?? process.env.POLYMARKET_HOST ?? "https://clob.polymarket.com";
    this.chainId = Number(
      config.chainId ?? process.env.POLYMARKET_CHAIN_ID ?? Chain.POLYGON
    ) as Chain;
    this.privateKey = config.privateKey ?? process.env.POLYMARKET_PRIVATE_KEY;
    this.funderAddress = config.funderAddress ?? process.env.POLYMARKET_FUNDER_ADDRESS;
    this.signatureType = Number(
      config.signatureType ?? process.env.POLYMARKET_SIGNATURE_TYPE ?? SignatureType.EOA
    ) as SignatureType;
    this.seededCreds =
      config.apiCredentials ??
      (process.env.POLYMARKET_API_KEY &&
      process.env.POLYMARKET_API_SECRET &&
      process.env.POLYMARKET_API_PASSPHRASE
        ? {
            key: process.env.POLYMARKET_API_KEY,
            secret: process.env.POLYMARKET_API_SECRET,
            passphrase: process.env.POLYMARKET_API_PASSPHRASE
          }
        : undefined);
    this.liveTradingEnabled =
      config.liveTradingEnabled ?? process.env.POLYMARKET_LIVE_TRADING === "true";
  }

  async placeBet(placement: BetPlacement): Promise<BetExecutionResult> {
    const probability = probabilityFromOdds(placement.oddsLimit);
    const shares = shareSizeFromStake(placement.stake, probability);
    const side = placement.side === "SELL" ? Side.SELL : Side.BUY;

    if ((placement.mode ?? "paper") !== "live") {
      return {
        success: true,
        platformOrderId: `PAPER-${crypto.randomUUID()}`,
        status: BetStatus.PLACED,
        details: {
          mode: "paper",
          probability,
          shares,
          tokenId: placement.tokenId,
          tickSize: placement.tickSize,
          negRisk: placement.negRisk
        }
      };
    }

    if (!this.liveTradingEnabled) {
      return {
        success: false,
        status: BetStatus.CANCELLED,
        error:
          "Live trading is disabled. Set POLYMARKET_LIVE_TRADING=true on the server to send real orders."
      };
    }

    if (!placement.tokenId) {
      return {
        success: false,
        status: BetStatus.CANCELLED,
        error: "Candidate is missing a Polymarket token ID."
      };
    }

    try {
      const client = await this.getClient();
      const tickSize =
        (placement.tickSize as TickSize | undefined) ??
        (await client.getTickSize(placement.tokenId));
      const negRisk = placement.negRisk ?? (await client.getNegRisk(placement.tokenId));
      const roundedPrice = roundPriceToTick(probability, tickSize, side);
      const response = await client.createAndPostOrder(
        {
          tokenID: placement.tokenId,
          price: roundedPrice,
          size: shares,
          side
        },
        {
          tickSize,
          negRisk
        },
        OrderType.GTC
      );

      if (response?.errorMsg) {
        return {
          success: false,
          status: BetStatus.CANCELLED,
          error: String(response.errorMsg),
          details: {
            mode: "live",
            response
          }
        };
      }

      return {
        success: true,
        platformOrderId: String(response?.orderID),
        status: mapOrderStatus(String(response?.status ?? "LIVE")),
        details: {
          mode: "live",
          probability: roundedPrice,
          shares,
          tickSize,
          negRisk,
          response
        }
      };
    } catch (error) {
      return {
        success: false,
        status: BetStatus.CANCELLED,
        error: toErrorMessage(error)
      };
    }
  }

  async cancelOrder(platformOrderId: string): Promise<BetExecutionResult> {
    if (platformOrderId.startsWith("PAPER-")) {
      return {
        success: true,
        status: BetStatus.CANCELLED,
        details: {
          mode: "paper"
        }
      };
    }

    try {
      const client = await this.getClient();
      const response = await client.cancelOrder({ orderID: platformOrderId });
      if (response?.error || response?.errorMsg) {
        return {
          success: false,
          status: BetStatus.PLACED,
          error: String(response.error ?? response.errorMsg)
        };
      }
      return {
        success: true,
        status: BetStatus.CANCELLED,
        details: {
          mode: "live",
          response
        }
      };
    } catch (error) {
      return {
        success: false,
        status: BetStatus.PLACED,
        error: toErrorMessage(error)
      };
    }
  }

  async getOrderStatus(platformOrderId: string): Promise<BetStatus> {
    if (platformOrderId.startsWith("PAPER-")) {
      return BetStatus.PLACED;
    }

    const client = await this.getClient();
    const order = await client.getOrder(platformOrderId);
    return mapOrderStatus(String(order.status));
  }

  getExecutionMode(): "paper" | "live" {
    return this.liveTradingEnabled ? "live" : "paper";
  }

  async canTradeLive(): Promise<{ enabled: boolean; reason?: string }> {
    if (!this.liveTradingEnabled) {
      return {
        enabled: false,
        reason: "POLYMARKET_LIVE_TRADING is not enabled."
      };
    }
    if (!this.privateKey) {
      return {
        enabled: false,
        reason: "POLYMARKET_PRIVATE_KEY is missing."
      };
    }
    if (!this.funderAddress) {
      return {
        enabled: false,
        reason: "POLYMARKET_FUNDER_ADDRESS is missing."
      };
    }
    return { enabled: true };
  }

  private async getClient(): Promise<ClobClient> {
    if (this.clientPromise) {
      return this.clientPromise;
    }

    this.clientPromise = (async () => {
      if (!this.privateKey) {
        throw new Error("POLYMARKET_PRIVATE_KEY is required for live execution.");
      }
      if (!this.funderAddress) {
        throw new Error("POLYMARKET_FUNDER_ADDRESS is required for live execution.");
      }

      const account = privateKeyToAccount(normalizeHex(this.privateKey));
      const walletClient = createWalletClient({
        account,
        chain: this.chainId === Chain.AMOY ? polygonAmoy : polygon,
        transport: http()
      });

      const baseClient = new ClobClient(
        this.host,
        this.chainId,
        walletClient,
        this.seededCreds,
        this.signatureType,
        this.funderAddress,
        undefined,
        true,
        undefined,
        undefined,
        true,
        undefined,
        true
      );

      const creds =
        this.seededCreds ??
        (await baseClient.createOrDeriveApiKey());

      return new ClobClient(
        this.host,
        this.chainId,
        walletClient,
        creds,
        this.signatureType,
        this.funderAddress,
        undefined,
        true,
        undefined,
        undefined,
        true,
        undefined,
        true
      );
    })();

    return this.clientPromise;
  }
}
