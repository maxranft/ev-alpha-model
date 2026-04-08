import type { CandidatePick, MarketLine, ModelView, OddsFormat } from "./types.js";

export interface LiveFeedEnvelope {
  /** ISO 8601 timestamp from the producer (when lines were snapshotted). */
  asOf?: string;
  candidates: CandidatePick[];
}

function isOddsFormat(x: unknown): x is OddsFormat {
  return x === "american" || x === "decimal";
}

function isPolymarketMeta(raw: unknown): boolean {
  if (raw === undefined) {
    return true;
  }
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const o = raw as Record<string, unknown>;
  for (const k of ["bidAskSpread", "liquidity", "bestBid", "bestAsk"] as const) {
    if (
      o[k] !== undefined &&
      (typeof o[k] !== "number" || !Number.isFinite(o[k]))
    ) {
      return false;
    }
  }
  if (o.contract !== undefined) {
    if (!o.contract || typeof o.contract !== "object") {
      return false;
    }
    const contract = o.contract as Record<string, unknown>;
    if (typeof contract.marketId !== "string") {
      return false;
    }
    for (const key of ["conditionId", "slug", "tokenId", "outcome"] as const) {
      if (contract[key] !== undefined && typeof contract[key] !== "string") {
        return false;
      }
    }
    if (
      contract.outcomeIndex !== undefined &&
      (!Number.isInteger(contract.outcomeIndex) || Number(contract.outcomeIndex) < 0)
    ) {
      return false;
    }
    for (const key of ["minTickSize"] as const) {
      if (
        contract[key] !== undefined &&
        (typeof contract[key] !== "number" || !Number.isFinite(contract[key]))
      ) {
        return false;
      }
    }
    for (const key of ["negRisk", "acceptingOrders"] as const) {
      if (contract[key] !== undefined && typeof contract[key] !== "boolean") {
        return false;
      }
    }
  }
  return true;
}

function isMarketLine(raw: unknown): raw is MarketLine {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const o = raw as Record<string, unknown>;
  return (
    typeof o.eventId === "string" &&
    (o.market === "spread" || o.market === "moneyline") &&
    typeof o.selection === "string" &&
    typeof o.sportsbook === "string" &&
    isOddsFormat(o.oddsFormat) &&
    typeof o.odds === "number" &&
    Number.isFinite(o.odds) &&
    (o.spread === undefined ||
      (typeof o.spread === "number" && Number.isFinite(o.spread))) &&
    isPolymarketMeta(o.polymarket)
  );
}

function isModelView(raw: unknown): raw is ModelView {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const o = raw as Record<string, unknown>;
  if (
    typeof o.coverProbability !== "number" ||
    !Number.isFinite(o.coverProbability) ||
    o.coverProbability < 0 ||
    o.coverProbability > 1
  ) {
    return false;
  }
  if (o.fairSpread !== undefined) {
    if (typeof o.fairSpread !== "number" || !Number.isFinite(o.fairSpread)) {
      return false;
    }
  }
  return true;
}

function isCandidatePick(raw: unknown): raw is CandidatePick {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const o = raw as Record<string, unknown>;
  return isMarketLine(o.line) && isModelView(o.model);
}

/**
 * Parse and validate a live feed body. Throws on invalid shape.
 * Your HTTP endpoint should return JSON matching {@link LiveFeedEnvelope}.
 */
export function parseLiveFeed(json: unknown): LiveFeedEnvelope {
  if (!json || typeof json !== "object") {
    throw new Error("Live feed root must be a JSON object.");
  }
  const root = json as Record<string, unknown>;
  const rawList = root.candidates;
  if (!Array.isArray(rawList)) {
    throw new Error("Live feed must include a candidates array.");
  }
  const candidates: CandidatePick[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!isCandidatePick(item)) {
      throw new Error(`Invalid candidate at index ${i}.`);
    }
    if (item.line.market === "spread" && item.line.spread === undefined) {
      throw new Error(`Spread market missing line.spread at index ${i}.`);
    }
    candidates.push(item);
  }
  const asOf =
    root.asOf === undefined
      ? undefined
      : typeof root.asOf === "string"
        ? root.asOf
        : (() => {
            throw new Error("asOf must be a string when present.");
          })();
  return { asOf, candidates };
}

export async function fetchLiveFeed(
  url: string,
  init?: RequestInit
): Promise<LiveFeedEnvelope> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers
    }
  });
  if (!res.ok) {
    throw new Error(`Live feed HTTP ${res.status}: ${res.statusText}`);
  }
  const body: unknown = await res.json();
  return parseLiveFeed(body);
}
