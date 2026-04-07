import type { CandidatePick, MarketLine } from "../types.js";
import type { LiveFeedEnvelope } from "../live-feed.js";

/** Minimal Gamma API shapes (https://gamma-api.polymarket.com). */
export interface GammaMarket {
  id: string;
  question: string;
  slug?: string;
  active?: boolean;
  closed?: boolean;
  outcomes?: string;
  outcomePrices?: string;
  bestBid?: number | string;
  bestAsk?: number | string;
  spread?: number | string;
  liquidityNum?: number | string;
}

export interface GammaEvent {
  id: string;
  slug?: string;
  title?: string;
  markets?: GammaMarket[];
}

const GAMMA_BASE = "https://gamma-api.polymarket.com";

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null) {
    return undefined;
  }
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function polymarketMetaFromMarket(m: GammaMarket): MarketLine["polymarket"] | undefined {
  const bestBid = toNum(m.bestBid);
  const bestAsk = toNum(m.bestAsk);
  const spreadField = toNum(m.spread);
  const liquidity = toNum(m.liquidityNum);
  const bidAskSpread =
    bestBid !== undefined && bestAsk !== undefined
      ? Math.max(0, bestAsk - bestBid)
      : spreadField;
  if (
    bidAskSpread === undefined &&
    liquidity === undefined &&
    bestBid === undefined &&
    bestAsk === undefined
  ) {
    return undefined;
  }
  return {
    bidAskSpread,
    liquidity,
    bestBid,
    bestAsk
  };
}

function parseJsonStringArray(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseOutcomePrices(raw: string | undefined): number[] {
  const parts = parseJsonStringArray(raw);
  return parts.map((p) => Number.parseFloat(p)).filter((n) => Number.isFinite(n));
}

/**
 * Map one Polymarket market to {@link CandidatePick} rows (one per outcome).
 * Uses outcome price as implied probability and sets `model.coverProbability` to the same value
 * so **edge starts at zero** until you overlay your own beliefs.
 */
export function gammaMarketToCandidates(m: GammaMarket): CandidatePick[] {
  if (m.closed || m.active === false) {
    return [];
  }
  const labels = parseJsonStringArray(m.outcomes);
  const prices = parseOutcomePrices(m.outcomePrices);
  if (labels.length === 0 || labels.length !== prices.length) {
    return [];
  }
  const pm = polymarketMetaFromMarket(m);
  const picks: CandidatePick[] = [];
  for (let i = 0; i < labels.length; i++) {
    const p = prices[i]!;
    if (p <= 0 || p >= 1) {
      continue;
    }
    const decimalOdds = 1 / p;
    picks.push({
      line: {
        eventId: `pm-${m.id}-${i}`,
        market: "moneyline",
        selection: `${m.question} — ${labels[i]}`,
        sportsbook: "Polymarket",
        oddsFormat: "decimal",
        odds: decimalOdds,
        polymarket: pm
      },
      model: {
        coverProbability: p
      }
    });
  }
  return picks;
}

export function gammaEventsToCandidates(events: GammaEvent[]): CandidatePick[] {
  const out: CandidatePick[] = [];
  for (const ev of events) {
    for (const m of ev.markets ?? []) {
      out.push(...gammaMarketToCandidates(m));
    }
  }
  return out;
}

export interface FetchGammaOptions {
  limit?: number;
  offset?: number;
}

export async function fetchGammaEvents(
  options: FetchGammaOptions = {}
): Promise<GammaEvent[]> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const url = new URL(`${GAMMA_BASE}/events`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Gamma API HTTP ${res.status}: ${res.statusText}`);
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    throw new Error("Gamma API: expected array of events.");
  }
  return body as GammaEvent[];
}

export async function buildPolymarketLiveFeed(
  options: FetchGammaOptions = {}
): Promise<LiveFeedEnvelope> {
  const events = await fetchGammaEvents(options);
  return {
    asOf: new Date().toISOString(),
    candidates: gammaEventsToCandidates(events)
  };
}
