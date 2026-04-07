import { demoCandidates } from "@model/demo-data.js";
import { fetchLiveFeed } from "@model/live-feed.js";
import { rankPicks } from "@model/rank.js";
import type { RankOptions, RankSortMode } from "@model/rank.js";
import type { CandidatePick, ScoredPick } from "@model/types.js";

const $ = (id: string) => document.getElementById(id)!;

const STORAGE_MODE = "ev_alpha_mode";
const STORAGE_URL = "ev_alpha_live_url";
const STORAGE_INTERVAL = "ev_alpha_poll_s";
const STORAGE_SORT = "ev_alpha_sort";

let currentCandidates: CandidatePick[] = [...demoCandidates];
let liveError: string | null = null;
let liveAsOf: string | undefined;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function fmt(n: number, d = 3): string {
  return n.toFixed(d);
}

function getMode(): "demo" | "live" {
  const m = sessionStorage.getItem(STORAGE_MODE);
  return m === "live" ? "live" : "demo";
}

function setMode(mode: "demo" | "live"): void {
  sessionStorage.setItem(STORAGE_MODE, mode);
}

function suggestedStake(pick: ScoredPick, bankroll: number, maxStakePct: number): number {
  if (bankroll <= 0) {
    return 0;
  }
  const fromKelly = bankroll * pick.kellyFraction;
  const cap = bankroll * (maxStakePct / 100);
  return Math.min(fromKelly, cap);
}

function stopPoll(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function updateFeedStatus(): void {
  const el = $("feedStatus") as HTMLElement;
  el.classList.remove("error");
  if (getMode() === "demo") {
    el.textContent = `${demoCandidates.length} demo picks (static).`;
    return;
  }
  const url = ($("liveUrl") as HTMLInputElement).value.trim();
  if (!url) {
    el.textContent = "Live mode: enter a feed URL.";
    return;
  }
  if (liveError) {
    el.textContent = `Live error: ${liveError}`;
    el.classList.add("error");
    return;
  }
  const n = currentCandidates.length;
  const asOf = liveAsOf ? ` · asOf ${liveAsOf}` : "";
  el.textContent = `Live: ${n} pick(s)${asOf}`;
}

async function refreshLive(): Promise<void> {
  if (getMode() !== "live") {
    return;
  }
  const url = ($("liveUrl") as HTMLInputElement).value.trim();
  if (!url) {
    liveError = "Enter a feed URL.";
    currentCandidates = [];
    render();
    return;
  }
  sessionStorage.setItem(STORAGE_URL, url);
  try {
    const env = await fetchLiveFeed(url);
    currentCandidates = env.candidates;
    liveAsOf = env.asOf;
    liveError = null;
  } catch (e) {
    liveError = e instanceof Error ? e.message : String(e);
  }
  render();
}

function startPoll(): void {
  stopPoll();
  if (getMode() !== "live") {
    return;
  }
  const sec = Math.max(
    5,
    Number(($("pollInterval") as HTMLInputElement).value) || 30
  );
  sessionStorage.setItem(STORAGE_INTERVAL, String(sec));
  ($("pollInterval") as HTMLInputElement).value = String(sec);
  pollTimer = setInterval(() => {
    void refreshLive();
  }, sec * 1000);
}

function syncLiveUi(): void {
  const live = getMode() === "live";
  ($("liveControls") as HTMLElement).classList.toggle("hidden", !live);
  ($("sourceDemo") as HTMLInputElement).checked = !live;
  ($("sourceLive") as HTMLInputElement).checked = live;
}

function applySourceChange(): void {
  const live = ($("sourceLive") as HTMLInputElement).checked;
  setMode(live ? "live" : "demo");
  syncLiveUi();
  liveError = null;
  liveAsOf = undefined;
  stopPoll();
  if (!live) {
    currentCandidates = [...demoCandidates];
    render();
    return;
  }
  const savedUrl = sessionStorage.getItem(STORAGE_URL) ?? "";
  if (savedUrl) {
    ($("liveUrl") as HTMLInputElement).value = savedUrl;
  }
  const savedPoll = sessionStorage.getItem(STORAGE_INTERVAL);
  if (savedPoll) {
    ($("pollInterval") as HTMLInputElement).value = savedPoll;
  }
  void refreshLive().then(() => {
    startPoll();
  });
}

function render(): void {
  const minEdge = Number(($("minEdge") as HTMLInputElement).value);
  const minEv = Number(($("minEv") as HTMLInputElement).value);
  const kellyScale = Number(($("kellyScale") as HTMLInputElement).value);
  const bankroll = Number(($("bankroll") as HTMLInputElement).value);
  const maxStakePct = Number(($("maxStakePct") as HTMLInputElement).value);
  const sortMode = ($("sortMode") as HTMLSelectElement).value as RankSortMode;
  sessionStorage.setItem(STORAGE_SORT, sortMode);

  ($("minEdgeVal") as HTMLElement).textContent = fmt(minEdge);
  ($("minEvVal") as HTMLElement).textContent = fmt(minEv);
  ($("kellyScaleVal") as HTMLElement).textContent = fmt(kellyScale, 2);
  ($("maxStakePctVal") as HTMLElement).textContent = `${maxStakePct}%`;

  const options: RankOptions = {
    minEdge,
    minExpectedValue: minEv,
    kellyScale,
    sortMode
  };

  const ranked = rankPicks(currentCandidates, options);
  const tbody = $("rows") as HTMLTableSectionElement;
  const empty = $("empty") as HTMLElement;
  tbody.innerHTML = "";

  updateFeedStatus();

  if (ranked.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const p of ranked) {
    const tr = document.createElement("tr");
    const stake = suggestedStake(p, bankroll, maxStakePct);
    const sd = p.spreadDiscrepancy;
    const fr = p.line.polymarket?.bidAskSpread;
    const apf = p.alphaPerFriction;
    const ce = p.capitalEfficiencyScore;
    tr.innerHTML = `
      <td>${escapeHtml(p.line.eventId)}</td>
      <td>${escapeHtml(p.line.selection)}</td>
      <td>${fmt(p.edge)}</td>
      <td>${fmt(p.expectedValuePerDollar)}</td>
      <td>${sd === undefined ? "—" : fmt(sd, 2)}</td>
      <td>${fr === undefined ? "—" : fmt(fr, 4)}</td>
      <td>${apf === undefined ? "—" : fmt(apf, 4)}</td>
      <td>${ce === undefined ? "—" : fmt(ce, 2)}</td>
      <td>${fmt(p.kellyFraction, 4)}</td>
      <td>$${fmt(stake, 2)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

for (const id of ["minEdge", "minEv", "kellyScale", "maxStakePct"]) {
  $(id).addEventListener("input", render);
}
$("sortMode").addEventListener("change", render);
$("bankroll").addEventListener("input", render);

$("sourceDemo").addEventListener("change", applySourceChange);
$("sourceLive").addEventListener("change", applySourceChange);
$("refreshNow").addEventListener("click", () => {
  void refreshLive();
});
$("liveUrl").addEventListener("change", () => {
  if (getMode() === "live") {
    void refreshLive().then(() => startPoll());
  }
});
$("pollInterval").addEventListener("change", () => {
  if (getMode() === "live") {
    startPoll();
  }
});

if (sessionStorage.getItem(STORAGE_MODE) === "live") {
  ($("sourceLive") as HTMLInputElement).checked = true;
}
const urlInput = $("liveUrl") as HTMLInputElement;
urlInput.value = sessionStorage.getItem(STORAGE_URL) ?? "";
const pollSaved = sessionStorage.getItem(STORAGE_INTERVAL);
if (pollSaved) {
  ($("pollInterval") as HTMLInputElement).value = pollSaved;
}
const sortSaved = sessionStorage.getItem(STORAGE_SORT);
if (sortSaved) {
  ($("sortMode") as HTMLSelectElement).value = sortSaved;
}
syncLiveUi();
if (getMode() === "live") {
  void refreshLive().then(() => startPoll());
} else {
  render();
}
