import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { scorePick } from "../rank.js";
import { type CandidatePick } from "../types.js";
import {
  BetStatus,
  type BetOrder,
  type BetPlacement,
  type ExecutionMode
} from "../types/bet.js";
import { PolymarketAdapter } from "../execution/api/polymarket.js";
import { OrderManager } from "../execution/order.js";
import { FileOrderStore } from "../execution/storage.js";
import { ExecutionService } from "../services/execution.js";
import { buildPolymarketLiveFeed } from "../polymarket/gamma-feed.js";

interface TicketRequestBody {
  userId?: string;
  candidate?: CandidatePick;
  strategy?: {
    kellyScale?: number;
    minEdge?: number;
    bankroll?: number;
    sourceUrl?: string;
  };
  ticket?: {
    side?: "BUY" | "SELL";
    stake?: number;
    oddsLimit?: number;
    note?: string;
    mode?: ExecutionMode;
    expiration?: string;
  };
}

function getPickKey(candidate: CandidatePick): string {
  return `${candidate.line.eventId}::${candidate.line.selection}`;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function text(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function decimalOdds(candidate: CandidatePick): number {
  return candidate.line.oddsFormat === "decimal"
    ? candidate.line.odds
    : candidate.line.odds > 0
      ? 1 + candidate.line.odds / 100
      : 1 + 100 / Math.abs(candidate.line.odds);
}

function toPlacement(body: TicketRequestBody): { placement: BetPlacement; candidatePickId: string } {
  if (!body.userId) {
    throw new Error("userId is required.");
  }
  if (!body.candidate) {
    throw new Error("candidate is required.");
  }

  const candidate = body.candidate;
  const scored = scorePick(candidate, {
    kellyScale: body.strategy?.kellyScale
  });
  const contract = candidate.line.polymarket?.contract;
  const ticket = body.ticket ?? {};
  const placement: BetPlacement = {
    mode: ticket.mode ?? "paper",
    marketId: contract?.conditionId ?? contract?.marketId ?? candidate.line.eventId,
    side: ticket.side === "SELL" ? "SELL" : "BUY",
    stake: Number(ticket.stake ?? 0),
    oddsLimit: Number(ticket.oddsLimit ?? decimalOdds(candidate)),
    expiration: ticket.expiration ? new Date(ticket.expiration) : undefined,
    tokenId: contract?.tokenId,
    conditionId: contract?.conditionId,
    marketSlug: contract?.slug,
    outcome: contract?.outcome,
    outcomeIndex: contract?.outcomeIndex,
    tickSize:
      contract?.minTickSize !== undefined ? String(contract.minTickSize) : undefined,
    negRisk: contract?.negRisk,
    metadata: {
      bankroll: body.strategy?.bankroll,
      minEdge: body.strategy?.minEdge,
      modelEdge: scored.edge,
      modelProbability: scored.model.coverProbability,
      kellyFraction: scored.kellyFraction,
      expectedValuePerDollar: scored.expectedValuePerDollar,
      friction: candidate.line.polymarket?.bidAskSpread,
      liquidity: candidate.line.polymarket?.liquidity,
      note: ticket.note,
      selection: candidate.line.selection,
      sourceUrl: body.strategy?.sourceUrl
    }
  };

  if (!Number.isFinite(placement.stake) || placement.stake <= 0) {
    throw new Error("ticket.stake must be greater than zero.");
  }
  if (!Number.isFinite(placement.oddsLimit) || (placement.oddsLimit ?? 0) <= 1) {
    throw new Error("ticket.oddsLimit must be decimal odds greater than 1.");
  }
  if (placement.mode === "live" && contract?.acceptingOrders === false) {
    throw new Error("Polymarket market is not currently accepting orders.");
  }

  return {
    placement,
    candidatePickId: getPickKey(candidate)
  };
}

function summarizeOrder(order: BetOrder): Record<string, unknown> {
  return {
    id: order.id,
    userId: order.userId,
    platform: order.platform,
    marketId: order.marketId,
    side: order.side,
    stake: order.stake,
    odds: order.odds,
    status: order.status,
    placedAt: order.placedAt.toISOString(),
    expiresAt: order.expiresAt?.toISOString(),
    filledAt: order.filledAt?.toISOString(),
    settledAt: order.settledAt?.toISOString(),
    platformOrderId: order.platformOrderId,
    error: order.error,
    details: order.details,
    metadata: order.metadata
  };
}

async function maybeServeStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/") || url.pathname === "/feed" || url.pathname === "/feed/") {
    return false;
  }
  const distDir = path.resolve(process.cwd(), "dist-web");
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = path.resolve(distDir, relative);
  if (!filePath.startsWith(distDir)) {
    return false;
  }
  try {
    const content = await readFile(filePath);
    const type = filePath.endsWith(".html")
      ? "text/html; charset=utf-8"
      : filePath.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : filePath.endsWith(".css")
          ? "text/css; charset=utf-8"
          : "application/octet-stream";
    text(res, 200, content.toString("utf8"), type);
    return true;
  } catch {
    if (url.pathname !== "/") {
      return false;
    }
    return false;
  }
}

export function createPolymarketAgentServer() {
  const orderStore = new FileOrderStore(
    process.env.ORDER_STORE_PATH ?? path.resolve(process.cwd(), "data/orders.json")
  );
  const adapter = new PolymarketAdapter();
  const orderManager = new OrderManager(adapter, orderStore);
  const executionService = new ExecutionService(orderManager);

  async function refreshOrders(userId?: string): Promise<BetOrder[]> {
    const orders = await executionService.listOrders(userId, 100);
    for (const order of orders) {
      if (
        (order.status === BetStatus.PENDING ||
          order.status === BetStatus.PLACED ||
          order.status === BetStatus.FILLING) &&
        order.platformOrderId
      ) {
        await executionService.checkOrderStatus(order.id);
      }
    }
    return executionService.listOrders(userId, 100);
  }

  return http.createServer(async (req, res) => {
    try {
      if (await maybeServeStatic(req, res)) {
        return;
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method === "GET" && (url.pathname === "/feed" || url.pathname === "/feed/")) {
        const limit = Number(url.searchParams.get("limit") ?? process.env.PM_LIMIT ?? "40");
        const env = await buildPolymarketLiveFeed({ limit, offset: 0 });
        json(res, 200, env);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        const live = await adapter.canTradeLive();
        json(res, 200, {
          ok: true,
          executionMode: adapter.getExecutionMode(),
          liveTradingEnabled: live.enabled,
          liveTradingReason: live.reason,
          feedUrl: "/feed"
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/orders") {
        const userId = url.searchParams.get("userId") ?? undefined;
        const refresh = url.searchParams.get("refresh") === "1";
        const orders = refresh
          ? await refreshOrders(userId)
          : await executionService.listOrders(userId, 100);
        json(res, 200, {
          orders: orders.map((order) => summarizeOrder(order))
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/orders") {
        const body = await readJsonBody<TicketRequestBody>(req);
        const { placement, candidatePickId } = toPlacement(body);
        const result = await executionService.placeBet(body.userId!, placement, candidatePickId);
        const order = result.orderId ? await executionService.getOrder(result.orderId) : null;
        json(res, result.success ? 200 : 400, {
          result,
          order: order ? summarizeOrder(order) : null
        });
        return;
      }

      const cancelMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
      if (req.method === "POST" && cancelMatch) {
        const orderId = decodeURIComponent(cancelMatch[1] ?? "");
        const result = await executionService.cancelOrder(orderId);
        const order = await executionService.getOrder(orderId);
        json(res, result.success ? 200 : 400, {
          result,
          order: order ? summarizeOrder(order) : null
        });
        return;
      }

      const refreshMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/refresh$/);
      if (req.method === "POST" && refreshMatch) {
        const orderId = decodeURIComponent(refreshMatch[1] ?? "");
        const order = await executionService.checkOrderStatus(orderId);
        json(res, order ? 200 : 404, {
          order: order ? summarizeOrder(order) : null
        });
        return;
      }

      text(res, 404, "Not found\n");
    } catch (error) {
      json(res, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
