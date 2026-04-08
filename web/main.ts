import { demoCandidates } from "@model/demo-data.js";
import { fetchLiveFeed } from "@model/live-feed.js";
import { rankPicks, scorePick } from "@model/rank.js";
import type { RankOptions, RankSortMode } from "@model/rank.js";
import {
  BetStatus,
  POLYMARKET_PLATFORM,
  type BetSide,
  type ExecutionMode
} from "@model/types/bet.js";
import type { CandidatePick, ScoredPick } from "@model/types.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type DataMode = "demo" | "live";
type TradeStatus = "STAGED" | `${BetStatus}`;

interface Preferences {
  mode: DataMode;
  liveUrl: string;
  pollInterval: number;
  traderId: string;
  executionMode: ExecutionMode;
  minEdge: number;
  minEv: number;
  kellyScale: number;
  bankroll: number;
  maxStakePct: number;
  maxFriction: number;
  minLiquidity: number;
  maxPositions: number;
  sortMode: RankSortMode;
}

interface TicketDraft {
  side: BetSide;
  stake: number;
  odds: number;
  note: string;
}

interface DashboardTrade {
  id: string;
  source: "local" | "server";
  traderId: string;
  pickKey: string;
  eventId: string;
  selection: string;
  side: BetSide;
  platform: string;
  status: TradeStatus;
  stake: number;
  priceLimit: number;
  edge: number;
  expectedValuePerDollar: number;
  kellyFraction: number;
  friction?: number;
  liquidity?: number;
  sourceMode: DataMode;
  executionMode?: ExecutionMode;
  createdAt: string;
  updatedAt: string;
  note: string;
  platformOrderId?: string;
  error?: string;
}

interface ApiStatusResponse {
  ok: boolean;
  executionMode: ExecutionMode;
  liveTradingEnabled: boolean;
  liveTradingReason?: string;
  feedUrl?: string;
}

interface ViewModel {
  preferences: Preferences;
  allScored: ScoredPick[];
  filtered: ScoredPick[];
  displayed: ScoredPick[];
  hiddenCount: number;
  selected: ScoredPick | null;
  stagedTrades: DashboardTrade[];
  serverTrades: DashboardTrade[];
  combinedTrades: DashboardTrade[];
  openTrades: DashboardTrade[];
  plannedStake: number;
  liveLabel?: string;
}

const STORAGE_PREFS = "pm_agent_dashboard_preferences_v3";
const STORAGE_DRAFTS = "pm_agent_dashboard_drafts_v3";
const STORAGE_SELECTED = "pm_agent_dashboard_selected_v3";

const DEFAULT_PREFERENCES: Preferences = {
  mode: "demo",
  liveUrl: "/feed",
  pollInterval: 30,
  traderId: "pm-desk",
  executionMode: "paper",
  minEdge: 0.02,
  minEv: 0.01,
  kellyScale: 0.5,
  bankroll: 10000,
  maxStakePct: 6,
  maxFriction: 0.05,
  minLiquidity: 200000,
  maxPositions: 8,
  sortMode: "alpha_per_friction"
};

let currentCandidates: CandidatePick[] = [...demoCandidates];
let liveError: string | null = null;
let liveAsOf: string | undefined;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let draftTrades: DashboardTrade[] = loadDraftTrades();
let serverTrades: DashboardTrade[] = [];
let selectedPickKey: string | null = loadSelectedPickKey();
let ticketSeedKey: string | null = null;
let actionMessage = "";
let apiStatus: ApiStatusResponse | null = null;
let apiError: string | null = null;
let currentView: ViewModel | null = null;

const currency0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const currency2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fmt(n: number, digits = 3): string {
  return n.toFixed(digits);
}

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtMoney(n: number, digits = 0): string {
  return digits === 0 ? currency0.format(n) : currency2.format(n);
}

function fmtCompactMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(0)}k`;
  }
  return currency0.format(n);
}

function decimalOdds(odds: number, oddsFormat: CandidatePick["line"]["oddsFormat"]): number {
  if (oddsFormat === "decimal") {
    return odds;
  }
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function getPickKey(pick: CandidatePick | ScoredPick): string {
  return `${pick.line.eventId}::${pick.line.selection}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function signedClass(value: number | undefined): string {
  if (value === undefined) {
    return "neutral";
  }
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "neutral";
}

function scoreBarWidth(value: number, max = 0.14): number {
  return clamp((Math.abs(value) / max) * 100, 4, 100);
}

function relativeTime(iso?: string): string | undefined {
  if (!iso) {
    return undefined;
  }
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const deltaSec = Math.round(deltaMs / 1000);
  if (deltaSec < 60) {
    return `${deltaSec}s ago`;
  }
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) {
    return `${deltaMin}m ago`;
  }
  const deltaHr = Math.round(deltaMin / 60);
  if (deltaHr < 24) {
    return `${deltaHr}h ago`;
  }
  return `${Math.round(deltaHr / 24)}d ago`;
}

function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coerceMode(value: unknown): DataMode {
  return value === "live" ? "live" : "demo";
}

function coerceExecutionMode(value: unknown): ExecutionMode {
  return value === "live" ? "live" : "paper";
}

function coerceSortMode(value: unknown): RankSortMode {
  return value === "capital_efficiency" || value === "ev" || value === "alpha_per_friction"
    ? value
    : DEFAULT_PREFERENCES.sortMode;
}

function normalizeTradeStatus(status: unknown): TradeStatus {
  if (status === "STAGED") {
    return "STAGED";
  }
  if (
    status === BetStatus.PENDING ||
    status === BetStatus.PLACED ||
    status === BetStatus.FILLING ||
    status === BetStatus.FILLED ||
    status === BetStatus.CANCELLED ||
    status === BetStatus.SETTLED ||
    status === BetStatus.EXPIRED
  ) {
    return status;
  }
  return BetStatus.PLACED;
}

function isOpenStatus(status: TradeStatus): boolean {
  return (
    status === "STAGED" ||
    status === BetStatus.PENDING ||
    status === BetStatus.PLACED ||
    status === BetStatus.FILLING
  );
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      mode: coerceMode(parsed.mode),
      liveUrl: typeof parsed.liveUrl === "string" ? parsed.liveUrl : DEFAULT_PREFERENCES.liveUrl,
      pollInterval: clamp(coerceNumber(parsed.pollInterval, DEFAULT_PREFERENCES.pollInterval), 5, 600),
      traderId:
        typeof parsed.traderId === "string" && parsed.traderId.trim()
          ? parsed.traderId.trim()
          : DEFAULT_PREFERENCES.traderId,
      executionMode: coerceExecutionMode(parsed.executionMode),
      minEdge: clamp(coerceNumber(parsed.minEdge, DEFAULT_PREFERENCES.minEdge), 0, 0.2),
      minEv: clamp(coerceNumber(parsed.minEv, DEFAULT_PREFERENCES.minEv), -0.05, 0.2),
      kellyScale: clamp(coerceNumber(parsed.kellyScale, DEFAULT_PREFERENCES.kellyScale), 0, 1),
      bankroll: Math.max(0, coerceNumber(parsed.bankroll, DEFAULT_PREFERENCES.bankroll)),
      maxStakePct: clamp(coerceNumber(parsed.maxStakePct, DEFAULT_PREFERENCES.maxStakePct), 1, 25),
      maxFriction: clamp(coerceNumber(parsed.maxFriction, DEFAULT_PREFERENCES.maxFriction), 0, 0.08),
      minLiquidity: Math.max(0, coerceNumber(parsed.minLiquidity, DEFAULT_PREFERENCES.minLiquidity)),
      maxPositions: clamp(Math.round(coerceNumber(parsed.maxPositions, DEFAULT_PREFERENCES.maxPositions)), 1, 20),
      sortMode: coerceSortMode(parsed.sortMode)
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function persistPreferences(preferences: Preferences): void {
  localStorage.setItem(STORAGE_PREFS, JSON.stringify(preferences));
}

function loadDraftTrades(): DashboardTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFTS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as DashboardTrade[];
    return Array.isArray(parsed) ? parsed.map((trade) => ({ ...trade, status: "STAGED", source: "local" })) : [];
  } catch {
    return [];
  }
}

function persistDraftTrades(): void {
  localStorage.setItem(STORAGE_DRAFTS, JSON.stringify(draftTrades));
}

function loadSelectedPickKey(): string | null {
  return localStorage.getItem(STORAGE_SELECTED);
}

function persistSelectedPickKey(): void {
  if (selectedPickKey) {
    localStorage.setItem(STORAGE_SELECTED, selectedPickKey);
  } else {
    localStorage.removeItem(STORAGE_SELECTED);
  }
}

function getMode(): DataMode {
  return $<HTMLInputElement>("sourceLive").checked ? "live" : "demo";
}

function syncLiveUi(): void {
  const live = getMode() === "live";
  $<HTMLElement>("liveControls").classList.toggle("hidden", !live);
  $<HTMLInputElement>("sourceDemo").checked = !live;
  $<HTMLInputElement>("sourceLive").checked = live;
}

function applyPreferences(preferences: Preferences): void {
  $<HTMLInputElement>("sourceDemo").checked = preferences.mode === "demo";
  $<HTMLInputElement>("sourceLive").checked = preferences.mode === "live";
  $<HTMLInputElement>("liveUrl").value = preferences.liveUrl;
  $<HTMLInputElement>("pollInterval").value = String(preferences.pollInterval);
  $<HTMLInputElement>("traderId").value = preferences.traderId;
  $<HTMLSelectElement>("executionMode").value = preferences.executionMode;
  $<HTMLInputElement>("minEdge").value = String(preferences.minEdge);
  $<HTMLInputElement>("minEv").value = String(preferences.minEv);
  $<HTMLInputElement>("kellyScale").value = String(preferences.kellyScale);
  $<HTMLInputElement>("bankroll").value = String(preferences.bankroll);
  $<HTMLInputElement>("maxStakePct").value = String(preferences.maxStakePct);
  $<HTMLInputElement>("maxFriction").value = String(preferences.maxFriction);
  $<HTMLInputElement>("minLiquidity").value = String(preferences.minLiquidity);
  $<HTMLInputElement>("maxPositions").value = String(preferences.maxPositions);
  $<HTMLSelectElement>("sortMode").value = preferences.sortMode;
  syncLiveUi();
}

function readPreferences(): Preferences {
  return {
    mode: getMode(),
    liveUrl: $<HTMLInputElement>("liveUrl").value.trim(),
    pollInterval: clamp(coerceNumber($<HTMLInputElement>("pollInterval").value, DEFAULT_PREFERENCES.pollInterval), 5, 600),
    traderId: $<HTMLInputElement>("traderId").value.trim() || DEFAULT_PREFERENCES.traderId,
    executionMode: coerceExecutionMode($<HTMLSelectElement>("executionMode").value),
    minEdge: clamp(coerceNumber($<HTMLInputElement>("minEdge").value, DEFAULT_PREFERENCES.minEdge), 0, 0.2),
    minEv: clamp(coerceNumber($<HTMLInputElement>("minEv").value, DEFAULT_PREFERENCES.minEv), -0.05, 0.2),
    kellyScale: clamp(coerceNumber($<HTMLInputElement>("kellyScale").value, DEFAULT_PREFERENCES.kellyScale), 0, 1),
    bankroll: Math.max(0, coerceNumber($<HTMLInputElement>("bankroll").value, DEFAULT_PREFERENCES.bankroll)),
    maxStakePct: clamp(coerceNumber($<HTMLInputElement>("maxStakePct").value, DEFAULT_PREFERENCES.maxStakePct), 1, 25),
    maxFriction: clamp(coerceNumber($<HTMLInputElement>("maxFriction").value, DEFAULT_PREFERENCES.maxFriction), 0, 0.08),
    minLiquidity: Math.max(0, coerceNumber($<HTMLInputElement>("minLiquidity").value, DEFAULT_PREFERENCES.minLiquidity)),
    maxPositions: clamp(Math.round(coerceNumber($<HTMLInputElement>("maxPositions").value, DEFAULT_PREFERENCES.maxPositions)), 1, 20),
    sortMode: coerceSortMode($<HTMLSelectElement>("sortMode").value)
  };
}

function updateControlLabels(preferences: Preferences): void {
  $<HTMLElement>("minEdgeVal").textContent = fmt(preferences.minEdge);
  $<HTMLElement>("minEvVal").textContent = fmt(preferences.minEv);
  $<HTMLElement>("kellyScaleVal").textContent = fmt(preferences.kellyScale, 2);
  $<HTMLElement>("maxStakePctVal").textContent = `${Math.round(preferences.maxStakePct)}%`;
  $<HTMLElement>("maxFrictionVal").textContent = fmt(preferences.maxFriction, 3);
}

function suggestedStake(pick: ScoredPick, preferences: Preferences): number {
  if (preferences.bankroll <= 0) {
    return 0;
  }
  const fromKelly = preferences.bankroll * pick.kellyFraction;
  const cap = preferences.bankroll * (preferences.maxStakePct / 100);
  return Math.min(fromKelly, cap);
}

function passesMicroFilters(pick: ScoredPick, preferences: Preferences): boolean {
  const friction = pick.line.polymarket?.bidAskSpread;
  const liquidity = pick.line.polymarket?.liquidity ?? 0;
  const frictionOkay =
    preferences.maxFriction <= 0 || friction === undefined || friction <= preferences.maxFriction;
  const liquidityOkay = liquidity >= preferences.minLiquidity;
  return frictionOkay && liquidityOkay;
}

function buildViewModel(preferences: Preferences): ViewModel {
  const rankOptions: RankOptions = {
    minEdge: preferences.minEdge,
    minExpectedValue: preferences.minEv,
    kellyScale: preferences.kellyScale,
    sortMode: preferences.sortMode
  };
  const allScored = currentCandidates.map((candidate) =>
    scorePick(candidate, { kellyScale: preferences.kellyScale })
  );
  const filtered = rankPicks(currentCandidates, rankOptions).filter((pick) =>
    passesMicroFilters(pick, preferences)
  );
  const displayed = filtered.slice(0, preferences.maxPositions);
  const hiddenCount = Math.max(0, filtered.length - displayed.length);

  if (!displayed.find((pick) => getPickKey(pick) === selectedPickKey)) {
    selectedPickKey = displayed[0] ? getPickKey(displayed[0]) : null;
    persistSelectedPickKey();
  }

  const selected = displayed.find((pick) => getPickKey(pick) === selectedPickKey) ?? null;
  const combinedTrades = [...draftTrades, ...serverTrades].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
  const openTrades = combinedTrades.filter((trade) => isOpenStatus(trade.status));
  const plannedStake = displayed.reduce(
    (sum, pick) => sum + suggestedStake(pick, preferences),
    0
  );
  const liveLabel = liveAsOf ? relativeTime(liveAsOf) : undefined;

  return {
    preferences,
    allScored,
    filtered,
    displayed,
    hiddenCount,
    selected,
    stagedTrades: draftTrades,
    serverTrades,
    combinedTrades,
    openTrades,
    plannedStake,
    liveLabel
  };
}

function ensureTicketSeed(view: ViewModel): void {
  if (!view.selected) {
    return;
  }
  const pickKey = getPickKey(view.selected);
  if (ticketSeedKey === pickKey) {
    return;
  }
  const draft = defaultDraftForPick(view.selected, view.preferences);
  $<HTMLSelectElement>("ticketSide").value = draft.side;
  $<HTMLInputElement>("ticketStake").value = String(Math.round(draft.stake));
  $<HTMLInputElement>("ticketOdds").value = draft.odds.toFixed(2);
  $<HTMLTextAreaElement>("ticketNote").value = draft.note;
  ticketSeedKey = pickKey;
}

function defaultDraftForPick(pick: ScoredPick, preferences: Preferences): TicketDraft {
  return {
    side: pick.edge >= 0 ? "BUY" : "SELL",
    stake: Math.max(0, Math.round(suggestedStake(pick, preferences))),
    odds: decimalOdds(pick.line.odds, pick.line.oddsFormat),
    note: `Edge ${fmtPct(pick.edge)} · EV ${fmt(pick.expectedValuePerDollar, 3)} · Kelly ${fmtPct(
      pick.kellyFraction,
      2
    )}`
  };
}

function readTicketDraft(): TicketDraft | null {
  const side = $<HTMLSelectElement>("ticketSide").value === "SELL" ? "SELL" : "BUY";
  const stake = Math.max(0, coerceNumber($<HTMLInputElement>("ticketStake").value, 0));
  const odds = Math.max(1.01, coerceNumber($<HTMLInputElement>("ticketOdds").value, 1.01));
  const note = $<HTMLTextAreaElement>("ticketNote").value.trim();
  if (stake <= 0) {
    actionMessage = "Stake must be greater than zero.";
    return null;
  }
  return { side, stake, odds, note };
}

function toDraftTrade(pick: ScoredPick, preferences: Preferences, draft: TicketDraft): DashboardTrade {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    source: "local",
    traderId: preferences.traderId,
    pickKey: getPickKey(pick),
    eventId: pick.line.eventId,
    selection: pick.line.selection,
    side: draft.side,
    platform: POLYMARKET_PLATFORM,
    status: "STAGED",
    stake: draft.stake,
    priceLimit: draft.odds,
    edge: pick.edge,
    expectedValuePerDollar: pick.expectedValuePerDollar,
    kellyFraction: pick.kellyFraction,
    friction: pick.line.polymarket?.bidAskSpread,
    liquidity: pick.line.polymarket?.liquidity,
    sourceMode: preferences.mode,
    executionMode: preferences.executionMode,
    createdAt: timestamp,
    updatedAt: timestamp,
    note: draft.note
  };
}

function queueTradeLocal(pick: ScoredPick, draft: TicketDraft): void {
  const preferences = readPreferences();
  draftTrades = [toDraftTrade(pick, preferences, draft), ...draftTrades];
  persistDraftTrades();
  actionMessage = `Staged ${pick.line.selection}.`;
}

function discardDraftTrade(id: string): void {
  draftTrades = draftTrades.filter((trade) => trade.id !== id);
  persistDraftTrades();
  actionMessage = "Removed staged ticket.";
}

function removeDraftsForPick(pickKey: string): void {
  draftTrades = draftTrades.filter((trade) => trade.pickKey !== pickKey);
  persistDraftTrades();
}

function mapServerTrade(raw: Record<string, unknown>): DashboardTrade {
  const metadata = (raw.metadata ?? {}) as Record<string, unknown>;
  const details = (raw.details ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id),
    source: "server",
    traderId: String(raw.userId ?? ""),
    pickKey:
      typeof metadata.candidatePickId === "string"
        ? metadata.candidatePickId
        : `${String(raw.marketId ?? "")}::${String(metadata.selection ?? raw.marketId ?? "")}`,
    eventId: String(raw.marketId ?? ""),
    selection: String(metadata.selection ?? raw.marketId ?? ""),
    side: raw.side === "SELL" ? "SELL" : "BUY",
    platform: String(raw.platform ?? POLYMARKET_PLATFORM),
    status: normalizeTradeStatus(raw.status),
    stake: coerceNumber(raw.stake, 0),
    priceLimit: coerceNumber(raw.odds, 0),
    edge: coerceNumber(metadata.modelEdge, 0),
    expectedValuePerDollar: coerceNumber(metadata.expectedValuePerDollar, 0),
    kellyFraction: coerceNumber(metadata.kellyFraction, 0),
    friction:
      optionalNumber(metadata.friction) ??
      optionalNumber(details.friction) ??
      optionalNumber(details.bidAskSpread),
    liquidity: optionalNumber(metadata.liquidity) ?? optionalNumber(details.liquidity),
    sourceMode:
      metadata.sourceUrl && String(metadata.sourceUrl).startsWith("demo:")
        ? "demo"
        : "live",
    executionMode:
      metadata.orderMode === "live" || metadata.orderMode === "paper"
        ? (metadata.orderMode as ExecutionMode)
        : details.mode === "live"
          ? "live"
          : "paper",
    createdAt: String(raw.placedAt ?? new Date().toISOString()),
    updatedAt: String(raw.filledAt ?? raw.settledAt ?? raw.placedAt ?? new Date().toISOString()),
    note: String(metadata.note ?? ""),
    platformOrderId: raw.platformOrderId ? String(raw.platformOrderId) : undefined,
    error: raw.error ? String(raw.error) : undefined
  };
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const error =
      (typeof body.error === "string" && body.error) ||
      (typeof (body.result as Record<string, unknown> | undefined)?.error === "string" &&
        String((body.result as Record<string, unknown>).error)) ||
      res.statusText;
    throw new Error(error);
  }
  return body as T;
}

async function refreshApiStatus(): Promise<void> {
  try {
    apiStatus = await requestJson<ApiStatusResponse>("/api/status");
    apiError = null;
  } catch (error) {
    apiStatus = null;
    apiError = error instanceof Error ? error.message : String(error);
  }
}

async function refreshServerOrders(refresh = false): Promise<void> {
  const traderId = encodeURIComponent(readPreferences().traderId);
  try {
    const data = await requestJson<{ orders: Record<string, unknown>[] }>(
      `/api/orders?userId=${traderId}${refresh ? "&refresh=1" : ""}`,
      {
        method: "GET",
        headers: { Accept: "application/json" }
      }
    );
    serverTrades = (data.orders ?? []).map((order) => mapServerTrade(order));
    apiError = null;
  } catch (error) {
    serverTrades = [];
    apiError = error instanceof Error ? error.message : String(error);
  }
}

async function syncBackend(refresh = false): Promise<void> {
  await Promise.all([refreshApiStatus(), refreshServerOrders(refresh)]);
  render();
}

function stopPoll(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refreshLive(): Promise<void> {
  if (getMode() !== "live") {
    return;
  }
  const preferences = readPreferences();
  if (!preferences.liveUrl) {
    liveError = "Enter a feed URL.";
    currentCandidates = [];
    render();
    return;
  }
  try {
    const envelope = await fetchLiveFeed(preferences.liveUrl);
    currentCandidates = envelope.candidates;
    liveAsOf = envelope.asOf;
    liveError = null;
  } catch (error) {
    liveError = error instanceof Error ? error.message : String(error);
  }
  render();
}

function startPoll(): void {
  stopPoll();
  if (getMode() !== "live") {
    return;
  }
  const intervalSeconds = readPreferences().pollInterval;
  pollTimer = setInterval(() => {
    void refreshLive();
  }, intervalSeconds * 1000);
}

function applySourceChange(): void {
  const mode = getMode();
  liveError = null;
  liveAsOf = undefined;
  stopPoll();
  if (mode === "demo") {
    currentCandidates = [...demoCandidates];
    actionMessage = "Switched to the local Polymarket demo slate.";
    render();
    return;
  }
  actionMessage = "Live polling enabled.";
  void refreshLive().then(() => {
    startPoll();
  });
}

async function submitTrade(pick: ScoredPick, draft: TicketDraft): Promise<void> {
  const preferences = readPreferences();
  try {
    const response = await requestJson<{
      result: { success: boolean; error?: string };
    }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        userId: preferences.traderId,
        candidate: pick,
        strategy: {
          kellyScale: preferences.kellyScale,
          minEdge: preferences.minEdge,
          bankroll: preferences.bankroll,
          sourceUrl:
            preferences.mode === "live" ? preferences.liveUrl : "demo://polymarket-dashboard"
        },
        ticket: {
          side: draft.side,
          stake: draft.stake,
          oddsLimit: draft.odds,
          note: draft.note,
          mode: preferences.executionMode
        }
      })
    });
    if (!response.result.success) {
      throw new Error(response.result.error || "Order placement failed.");
    }
    removeDraftsForPick(getPickKey(pick));
    actionMessage =
      preferences.executionMode === "live"
        ? `Live order routed for ${pick.line.selection}.`
        : `Paper order stored for ${pick.line.selection}.`;
    await refreshServerOrders(true);
  } catch (error) {
    actionMessage = error instanceof Error ? error.message : String(error);
  }
  render();
}

async function cancelServerTrade(orderId: string): Promise<void> {
  try {
    await requestJson(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({})
    });
    actionMessage = "Order cancelled.";
    await refreshServerOrders(true);
  } catch (error) {
    actionMessage = error instanceof Error ? error.message : String(error);
  }
  render();
}

async function refreshServerTrade(orderId: string): Promise<void> {
  try {
    await requestJson(`/api/orders/${encodeURIComponent(orderId)}/refresh`, {
      method: "POST",
      body: JSON.stringify({})
    });
    actionMessage = "Order status refreshed.";
    await refreshServerOrders(false);
  } catch (error) {
    actionMessage = error instanceof Error ? error.message : String(error);
  }
  render();
}

function selectPickByKey(pickKey: string): void {
  selectedPickKey = pickKey;
  persistSelectedPickKey();
  ticketSeedKey = null;
  render();
}

function renderFeedStatus(view: ViewModel): void {
  const el = $<HTMLElement>("feedStatus");
  const mode = view.preferences.mode;
  el.className = "feed-status";
  if (mode === "demo") {
    el.classList.add("demo");
    el.textContent = `${currentCandidates.length} demo contracts loaded from the local Polymarket tape.`;
    return;
  }
  if (liveError) {
    el.classList.add("error");
    el.textContent = `Live feed error: ${liveError}`;
    return;
  }
  el.classList.add("live");
  const suffix = view.liveLabel ? ` · ${view.liveLabel}` : "";
  el.textContent = `${currentCandidates.length} live contract(s) in view${suffix}`;
}

function renderSummaryCards(view: ViewModel): void {
  const top = view.displayed[0];
  const avgEdge = mean(view.filtered.map((pick) => pick.edge)) ?? 0;
  const avgFriction = mean(
    view.filtered
      .map((pick) => pick.line.polymarket?.bidAskSpread)
      .filter((value): value is number => value !== undefined)
  );
  const deployed = view.openTrades.reduce((sum, trade) => sum + trade.stake, 0);
  const liveReady = apiStatus?.liveTradingEnabled ?? false;
  const execLabel =
    view.preferences.executionMode === "live"
      ? liveReady
        ? "Live armed"
        : "Live blocked"
      : "Paper";
  const execDetail =
    view.preferences.executionMode === "live"
      ? apiStatus?.liveTradingReason ?? "Server ready for live orders."
      : apiError ?? "Server-backed paper orders enabled.";

  $<HTMLElement>("summaryCards").innerHTML = `
    <article class="hero-card">
      <span>Actionable now</span>
      <strong>${view.filtered.length}</strong>
      <small>${view.displayed.length} on board${view.hiddenCount ? ` · ${view.hiddenCount} queued` : ""}</small>
    </article>
    <article class="hero-card">
      <span>Top edge</span>
      <strong>${top ? fmtPct(top.edge) : "—"}</strong>
      <small>${top ? escapeHtml(top.line.selection) : "No active contract"}</small>
    </article>
    <article class="hero-card">
      <span>Planned deployment</span>
      <strong>${fmtMoney(view.plannedStake)}</strong>
      <small>${fmtPct(view.preferences.bankroll > 0 ? view.plannedStake / view.preferences.bankroll : 0)}</small>
    </article>
    <article class="hero-card">
      <span>Execution</span>
      <strong>${escapeHtml(execLabel)}</strong>
      <small>${escapeHtml(execDetail || `Avg edge ${fmtPct(avgEdge)} · avg friction ${avgFriction !== undefined ? fmt(avgFriction, 3) : "—"}`)}</small>
    </article>
  `;
}

function renderBoardCaption(view: ViewModel): void {
  const parts = [
    `${view.filtered.length} pass the current gates`,
    `${view.displayed.length} shown on the board`,
    `${view.openTrades.length} open ticket${view.openTrades.length === 1 ? "" : "s"}`
  ];
  if (view.hiddenCount > 0) {
    parts.push(`${view.hiddenCount} hidden by portfolio depth`);
  }
  $<HTMLElement>("boardCaption").textContent = parts.join(" · ");
}

function renderAnalysisBands(view: ViewModel): void {
  const universe = view.allScored.filter((pick) => passesMicroFilters(pick, view.preferences));
  const attack = universe.filter(
    (pick) => pick.edge >= 0.08 && pick.expectedValuePerDollar >= 0.05
  );
  const workable = universe.filter(
    (pick) =>
      !attack.includes(pick) &&
      pick.edge >= Math.max(view.preferences.minEdge, 0.04) &&
      pick.expectedValuePerDollar >= Math.max(view.preferences.minEv, 0.02)
  );
  const watch = universe.filter(
    (pick) =>
      !attack.includes(pick) &&
      !workable.includes(pick) &&
      pick.edge >= 0.02 &&
      pick.expectedValuePerDollar >= 0
  );
  const counts = {
    attack: attack.length,
    workable: workable.length,
    watch: watch.length,
    rejected: Math.max(0, currentCandidates.length - attack.length - workable.length - watch.length)
  };
  const total = Math.max(1, currentCandidates.length);
  $<HTMLElement>("analysisBands").innerHTML = `
    <article class="band-card">
      <span class="section-kicker">Attack</span>
      <strong>${counts.attack}</strong>
      <p>Wide edge and immediate EV.</p>
      <div class="mini-rail"><span style="width:${(counts.attack / total) * 100}%"></span></div>
    </article>
    <article class="band-card">
      <span class="section-kicker">Workable</span>
      <strong>${counts.workable}</strong>
      <p>Good enough to route if the book stays tight.</p>
      <div class="mini-rail"><span style="width:${(counts.workable / total) * 100}%"></span></div>
    </article>
    <article class="band-card">
      <span class="section-kicker">Watch</span>
      <strong>${counts.watch}</strong>
      <p>Model sees something, but not enough to deploy yet.</p>
      <div class="mini-rail"><span style="width:${(counts.watch / total) * 100}%"></span></div>
    </article>
    <article class="band-card">
      <span class="section-kicker">Rejected</span>
      <strong>${counts.rejected}</strong>
      <p>Below liquidity or above friction thresholds.</p>
      <div class="mini-rail"><span style="width:${(counts.rejected / total) * 100}%"></span></div>
    </article>
  `;
}

function renderMarketPulse(view: ViewModel): void {
  const picks = view.displayed.slice(0, 5);
  const container = $<HTMLElement>("marketPulse");
  if (picks.length === 0) {
    container.innerHTML = `<div class="empty-card">No contracts clear the current signal gates.</div>`;
    return;
  }
  container.innerHTML = picks
    .map((pick) => {
      const pickKey = getPickKey(pick);
      return `
        <button type="button" class="signal-row" data-action="select-pick" data-pick-key="${escapeHtml(pickKey)}">
          <div class="row-topline">
            <strong>${escapeHtml(pick.line.selection)}</strong>
            <span class="${signedClass(pick.edge)}">${fmtPct(pick.edge)}</span>
          </div>
          <div class="row-metrics tiny">
            <span>EV ${fmt(pick.expectedValuePerDollar, 3)}</span>
            <span>Kelly ${fmtPct(pick.kellyFraction, 2)}</span>
            <span>Stake ${fmtMoney(suggestedStake(pick, view.preferences))}</span>
          </div>
          <div class="metric-rail"><span style="width:${scoreBarWidth(pick.edge)}%"></span></div>
        </button>
      `;
    })
    .join("");
}

function renderMarketQuality(view: ViewModel): void {
  const qualityRanked = [...view.filtered]
    .sort((left, right) => {
      const leftScore =
        (left.line.polymarket?.liquidity ?? 0) / ((left.line.polymarket?.bidAskSpread ?? 0.08) + 0.002);
      const rightScore =
        (right.line.polymarket?.liquidity ?? 0) / ((right.line.polymarket?.bidAskSpread ?? 0.08) + 0.002);
      return rightScore - leftScore;
    })
    .slice(0, 5);
  const container = $<HTMLElement>("marketQuality");
  if (qualityRanked.length === 0) {
    container.innerHTML = `<div class="empty-card">Live or demo markets need liquidity and tighter spreads to appear here.</div>`;
    return;
  }
  container.innerHTML = qualityRanked
    .map((pick) => {
      const pickKey = getPickKey(pick);
      const friction = pick.line.polymarket?.bidAskSpread;
      const liquidity = pick.line.polymarket?.liquidity;
      const widthPct = clamp(((liquidity ?? 0) / 1_500_000) * 100, 8, 100);
      return `
        <button type="button" class="quality-row" data-action="select-pick" data-pick-key="${escapeHtml(pickKey)}">
          <div class="row-topline">
            <strong>${escapeHtml(pick.line.selection)}</strong>
            <span>${liquidity !== undefined ? fmtCompactMoney(liquidity) : "—"}</span>
          </div>
          <div class="row-metrics tiny">
            <span>Friction ${friction !== undefined ? fmt(friction, 3) : "—"}</span>
            <span>Best bid ${pick.line.polymarket?.bestBid !== undefined ? fmtPct(pick.line.polymarket.bestBid) : "—"}</span>
            <span>Best ask ${pick.line.polymarket?.bestAsk !== undefined ? fmtPct(pick.line.polymarket.bestAsk) : "—"}</span>
          </div>
          <div class="metric-rail"><span style="width:${widthPct}%"></span></div>
        </button>
      `;
    })
    .join("");
}

function renderOpportunityBoard(view: ViewModel): void {
  const tbody = $<HTMLTableSectionElement>("rows");
  const empty = $<HTMLElement>("empty");
  tbody.innerHTML = "";
  if (view.displayed.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  const routeLabel = view.preferences.executionMode === "live" ? "Live" : "Paper";
  tbody.innerHTML = view.displayed
    .map((pick, index) => {
      const pickKey = getPickKey(pick);
      const selected = pickKey === selectedPickKey;
      const friction = pick.line.polymarket?.bidAskSpread;
      const liquidity = pick.line.polymarket?.liquidity;
      const canLiveRoute = Boolean(pick.line.polymarket?.contract?.tokenId);
      return `
        <tr class="opportunity-row${selected ? " selected" : ""}" data-action="select-pick" data-pick-key="${escapeHtml(pickKey)}">
          <td><span class="rank-badge">#${index + 1}</span></td>
          <td class="contract-cell">
            <strong>${escapeHtml(pick.line.selection)}</strong>
            <span>${escapeHtml(pick.line.sportsbook)} · ${escapeHtml(pick.line.eventId)}</span>
          </td>
          <td class="mono">${fmtPct(pick.impliedProbability)}</td>
          <td class="mono">${fmtPct(pick.model.coverProbability)}</td>
          <td class="mono ${signedClass(pick.edge)}">${fmtPct(pick.edge)}</td>
          <td class="mono ${signedClass(pick.expectedValuePerDollar)}">${fmt(pick.expectedValuePerDollar, 3)}</td>
          <td class="mono">${friction !== undefined ? fmt(friction, 3) : "—"}</td>
          <td class="mono">${liquidity !== undefined ? fmtCompactMoney(liquidity) : "—"}</td>
          <td class="mono">${fmtPct(pick.kellyFraction, 2)}</td>
          <td class="mono">${fmtMoney(suggestedStake(pick, view.preferences))}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="table-btn" data-action="stage-pick" data-pick-key="${escapeHtml(pickKey)}">Stage</button>
              <button type="button" class="table-btn" data-action="route-pick" data-pick-key="${escapeHtml(pickKey)}" ${view.preferences.executionMode === "live" && !canLiveRoute ? "disabled" : ""}>${routeLabel}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSelectedDetail(view: ViewModel): void {
  const detail = $<HTMLElement>("selectedDetail");
  const context = $<HTMLElement>("ticketContext");
  if (!view.selected) {
    detail.innerHTML = `<div class="empty-card">Select a contract from the board to inspect execution inputs.</div>`;
    context.textContent = "Choose a contract from the board.";
    return;
  }
  const pick = view.selected;
  const friction = pick.line.polymarket?.bidAskSpread;
  const liquidity = pick.line.polymarket?.liquidity;
  const contract = pick.line.polymarket?.contract;
  const marketWidth = clamp(pick.impliedProbability * 100, 0, 100);
  const modelWidth = clamp(pick.model.coverProbability * 100, 0, 100);
  const relatedTrades = view.combinedTrades.filter((trade) => trade.pickKey === getPickKey(pick));
  const routeInfo =
    contract?.tokenId
      ? `Token ${contract.tokenId}`
      : "No live execution token metadata on this candidate.";
  context.textContent = `${relatedTrades.length} ticket${relatedTrades.length === 1 ? "" : "s"} linked to this contract. ${routeInfo}`;
  detail.innerHTML = `
    <article class="detail-card">
      <div class="detail-head">
        <strong>${escapeHtml(pick.line.selection)}</strong>
        <span class="muted">${escapeHtml(pick.line.eventId)} · ${escapeHtml(pick.line.sportsbook)}</span>
        <div class="pill-row">
          <span class="pill">${pick.line.market}</span>
          <span class="pill">${POLYMARKET_PLATFORM}</span>
          <span class="pill">${fmtMoney(suggestedStake(pick, view.preferences))} suggested</span>
          ${contract?.slug ? `<span class="pill">${escapeHtml(contract.slug)}</span>` : ""}
        </div>
      </div>
      <div class="prob-card">
        <div class="prob-grid">
          <div class="prob-row">
            <span class="muted">Market implied probability</span>
            <strong>${fmtPct(pick.impliedProbability)}</strong>
            <div class="prob-track">
              <span class="market-bar" style="width:${marketWidth}%"></span>
            </div>
          </div>
          <div class="prob-row">
            <span class="muted">Model probability</span>
            <strong>${fmtPct(pick.model.coverProbability)}</strong>
            <div class="prob-track">
              <span class="model-bar" style="width:${modelWidth}%"></span>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-metrics">
        <div class="metric-chip">
          <span>Edge</span>
          <strong class="${signedClass(pick.edge)}">${fmtPct(pick.edge)}</strong>
        </div>
        <div class="metric-chip">
          <span>EV / $1</span>
          <strong class="${signedClass(pick.expectedValuePerDollar)}">${fmt(pick.expectedValuePerDollar, 3)}</strong>
        </div>
        <div class="metric-chip">
          <span>Kelly</span>
          <strong>${fmtPct(pick.kellyFraction, 2)}</strong>
        </div>
        <div class="metric-chip">
          <span>Friction</span>
          <strong>${friction !== undefined ? fmt(friction, 3) : "—"}</strong>
        </div>
        <div class="metric-chip">
          <span>Liquidity</span>
          <strong>${liquidity !== undefined ? fmtCompactMoney(liquidity) : "—"}</strong>
        </div>
        <div class="metric-chip">
          <span>Contract</span>
          <strong>${contract?.tokenId ? escapeHtml(contract.tokenId) : "Feed only"}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderBlotter(view: ViewModel): void {
  const staged = view.stagedTrades.length;
  const pending = view.serverTrades.filter((trade) => trade.status === BetStatus.PENDING).length;
  const placed = view.serverTrades.filter((trade) => trade.status === BetStatus.PLACED || trade.status === BetStatus.FILLING).length;
  const filled = view.serverTrades.filter((trade) => trade.status === BetStatus.FILLED).length;
  const deployed = view.openTrades.reduce((sum, trade) => sum + trade.stake, 0);

  $<HTMLElement>("blotterSummary").innerHTML = `
    <div class="summary-chip">
      <span>Open tickets</span>
      <strong>${view.openTrades.length}</strong>
    </div>
    <div class="summary-chip">
      <span>Staged local</span>
      <strong>${staged}</strong>
    </div>
    <div class="summary-chip">
      <span>Pending</span>
      <strong>${pending}</strong>
    </div>
    <div class="summary-chip">
      <span>Live / paper open</span>
      <strong>${placed}</strong>
    </div>
    <div class="summary-chip">
      <span>Exposure</span>
      <strong>${fmtMoney(deployed)}</strong>
    </div>
    <div class="summary-chip">
      <span>Filled</span>
      <strong>${filled}</strong>
    </div>
  `;

  const rows = $<HTMLElement>("blotterRows");
  if (view.combinedTrades.length === 0) {
    rows.innerHTML = `<div class="empty-card">No tickets yet. Stage a trade from the board or route an order through the server.</div>`;
    return;
  }

  rows.innerHTML = view.combinedTrades
    .map((trade) => {
      const pickStillVisible = view.allScored.some((pick) => getPickKey(pick) === trade.pickKey);
      const actions: string[] = [];
      if (trade.source === "local") {
        actions.push(`<button type="button" class="mini-btn" data-action="route-draft" data-trade-id="${trade.id}">Route</button>`);
        actions.push(`<button type="button" class="mini-btn" data-action="discard-draft" data-trade-id="${trade.id}">Discard</button>`);
      } else if (trade.status === BetStatus.PENDING || trade.status === BetStatus.PLACED || trade.status === BetStatus.FILLING) {
        actions.push(`<button type="button" class="mini-btn" data-action="refresh-order" data-trade-id="${trade.id}">Refresh</button>`);
        actions.push(`<button type="button" class="mini-btn" data-action="cancel-order" data-trade-id="${trade.id}">Cancel</button>`);
      }
      if (pickStillVisible) {
        actions.push(`<button type="button" class="mini-btn" data-action="focus-trade" data-pick-key="${escapeHtml(trade.pickKey)}">Focus</button>`);
      }
      const execBadge =
        trade.source === "server"
          ? trade.executionMode === "live"
            ? "Live"
            : "Paper"
          : "Draft";
      return `
        <article class="blotter-card">
          <div class="blotter-title">
            <div>
              <strong>${escapeHtml(trade.selection)}</strong>
              <p class="muted tiny">${escapeHtml(trade.traderId)} · ${relativeTime(trade.updatedAt) ?? "just now"} · ${execBadge}</p>
            </div>
            <span class="status-pill ${trade.status.toLowerCase()}">${trade.status}</span>
          </div>
          <div class="blotter-meta">
            <span>${trade.side} ${fmtMoney(trade.stake)} @ ${trade.priceLimit.toFixed(2)}</span>
            <span class="${signedClass(trade.edge)}">Edge ${fmtPct(trade.edge)}</span>
            <span>EV ${fmt(trade.expectedValuePerDollar, 3)}</span>
            <span>${trade.friction !== undefined ? `Friction ${fmt(trade.friction, 3)}` : "No friction data"}</span>
          </div>
          ${trade.note ? `<p class="muted tiny">${escapeHtml(trade.note)}</p>` : ""}
          ${trade.error ? `<p class="negative tiny">${escapeHtml(trade.error)}</p>` : ""}
          ${trade.platformOrderId ? `<p class="muted tiny mono">${escapeHtml(trade.platformOrderId)}</p>` : ""}
          <div class="blotter-actions">${actions.join("")}</div>
        </article>
      `;
    })
    .join("");
}

function renderActionStatus(view: ViewModel): void {
  const selected = view.selected;
  const sendButton = $<HTMLButtonElement>("sendTicket");
  const wantsLive = view.preferences.executionMode === "live";
  const canRouteLive = Boolean(selected?.line.polymarket?.contract?.tokenId) && (apiStatus?.liveTradingEnabled ?? false);
  sendButton.textContent = wantsLive ? "Send live order" : "Send paper order";
  sendButton.disabled = wantsLive && !canRouteLive;

  if (wantsLive && !(apiStatus?.liveTradingEnabled ?? false)) {
    $<HTMLElement>("actionStatus").textContent =
      actionMessage || apiStatus?.liveTradingReason || apiError || "Live execution is not armed on the server.";
    return;
  }
  if (wantsLive && selected && !selected.line.polymarket?.contract?.tokenId) {
    $<HTMLElement>("actionStatus").textContent =
      actionMessage || "This candidate has no Polymarket token ID, so it cannot be routed live.";
    return;
  }
  $<HTMLElement>("actionStatus").textContent =
    actionMessage || apiError || (apiStatus?.liveTradingReason ?? "");
}

function render(): void {
  const preferences = readPreferences();
  persistPreferences(preferences);
  updateControlLabels(preferences);
  syncLiveUi();

  currentView = buildViewModel(preferences);
  ensureTicketSeed(currentView);

  renderFeedStatus(currentView);
  renderSummaryCards(currentView);
  renderBoardCaption(currentView);
  renderAnalysisBands(currentView);
  renderMarketPulse(currentView);
  renderMarketQuality(currentView);
  renderOpportunityBoard(currentView);
  renderSelectedDetail(currentView);
  renderBlotter(currentView);
  renderActionStatus(currentView);
}

function findPickInView(pickKey: string): ScoredPick | undefined {
  return currentView?.allScored.find((pick) => getPickKey(pick) === pickKey);
}

function handleSelectOrTradeAction(target: HTMLElement): void {
  const pickKey = target.dataset.pickKey;
  const action = target.dataset.action;
  if (!pickKey || !currentView) {
    return;
  }
  const pick = findPickInView(pickKey);
  if (!pick) {
    return;
  }

  if (action === "select-pick") {
    selectedPickKey = pickKey;
    persistSelectedPickKey();
    ticketSeedKey = null;
    render();
    return;
  }

  const draft = defaultDraftForPick(pick, currentView.preferences);
  selectedPickKey = pickKey;
  persistSelectedPickKey();
  ticketSeedKey = null;

  if (action === "stage-pick") {
    queueTradeLocal(pick, draft);
    render();
    return;
  }

  if (action === "route-pick") {
    void submitTrade(pick, draft);
  }
}

function handleBlotterAction(target: HTMLElement): void {
  const tradeId = target.dataset.tradeId;
  const action = target.dataset.action;
  const pickKey = target.dataset.pickKey;

  if (action === "focus-trade" && pickKey) {
    selectPickByKey(pickKey);
    return;
  }

  if (!tradeId) {
    return;
  }

  if (action === "discard-draft") {
    discardDraftTrade(tradeId);
    render();
    return;
  }

  const draftTrade = draftTrades.find((trade) => trade.id === tradeId);
  if (action === "route-draft" && draftTrade) {
    const pick = findPickInView(draftTrade.pickKey);
    if (!pick) {
      actionMessage = "Draft contract is not in the current board; refresh the feed before routing.";
      render();
      return;
    }
    void submitTrade(pick, {
      side: draftTrade.side,
      stake: draftTrade.stake,
      odds: draftTrade.priceLimit,
      note: draftTrade.note
    });
    return;
  }

  if (action === "refresh-order") {
    void refreshServerTrade(tradeId);
    return;
  }

  if (action === "cancel-order") {
    void cancelServerTrade(tradeId);
  }
}

function handleManualTicket(stageOnly: boolean): void {
  if (!currentView?.selected) {
    actionMessage = "Select a contract before creating a ticket.";
    render();
    return;
  }
  const draft = readTicketDraft();
  if (!draft) {
    render();
    return;
  }

  if (stageOnly) {
    queueTradeLocal(currentView.selected, draft);
    render();
    return;
  }

  void submitTrade(currentView.selected, draft);
}

for (const id of [
  "minEdge",
  "minEv",
  "kellyScale",
  "bankroll",
  "maxStakePct",
  "maxFriction",
  "minLiquidity",
  "maxPositions",
  "sortMode",
  "executionMode"
] as const) {
  $(id).addEventListener("input", () => {
    actionMessage = "";
    render();
  });
}

$<HTMLInputElement>("traderId").addEventListener("change", () => {
  actionMessage = "";
  void syncBackend(false);
});

$<HTMLInputElement>("sourceDemo").addEventListener("change", applySourceChange);
$<HTMLInputElement>("sourceLive").addEventListener("change", applySourceChange);
$<HTMLInputElement>("liveUrl").addEventListener("change", () => {
  if (getMode() === "live") {
    void refreshLive().then(() => startPoll());
  }
});
$<HTMLInputElement>("pollInterval").addEventListener("change", () => {
  if (getMode() === "live") {
    startPoll();
  }
  render();
});
$<HTMLButtonElement>("refreshNow").addEventListener("click", () => {
  void refreshLive();
});
$<HTMLButtonElement>("stageTicket").addEventListener("click", () => {
  handleManualTicket(true);
});
$<HTMLButtonElement>("sendTicket").addEventListener("click", () => {
  handleManualTicket(false);
});
$<HTMLButtonElement>("syncOrders").addEventListener("click", () => {
  void syncBackend(true);
});

$<HTMLTableSectionElement>("rows").addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (target) {
    handleSelectOrTradeAction(target);
  }
});

$<HTMLElement>("marketPulse").addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (target) {
    handleSelectOrTradeAction(target);
  }
});

$<HTMLElement>("marketQuality").addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (target) {
    handleSelectOrTradeAction(target);
  }
});

$<HTMLElement>("blotterRows").addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (target) {
    handleBlotterAction(target);
  }
});

applyPreferences(loadPreferences());

void syncBackend(false);

if (getMode() === "live") {
  void refreshLive().then(() => startPoll());
} else {
  currentCandidates = [...demoCandidates];
}

window.addEventListener("beforeunload", stopPoll);

render();
