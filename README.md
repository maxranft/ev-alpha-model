# EV Alpha Model

Lightweight TypeScript model to surface bets with:

- highest expected value per dollar staked
- largest discrepancies between market spread and model fair spread

## Design goals

- Pure functions for core math
- High unit-test coverage for easy refactors
- Minimal surface area and no framework lock-in
- Polymarket-first execution scaffolding with one adapter and one local order store

## Core modules

- `src/odds.ts`: odds conversion, implied probability, no-vig helper
- `src/ev.ts`: expected value and Kelly sizing
- `src/spread.ts`: spread discrepancy score
- `src/rank.ts`: single-pick scoring and portfolio ranking
- `src/execution/`: Polymarket order placement, risk checks, and local order state

## Quick start

```bash
npm install
npm test
npm run build
```

## Tune metrics (web UI)

```bash
npm run dev
```

Open the printed URL (default `http://127.0.0.1:5173/`). Adjust sliders for min edge, min EV, Kelly scale, bankroll, and max stake cap.

## Execution

The execution layer is intentionally Polymarket-first. `BetPlacement.platform` defaults to `polymarket`, and order state is kept in memory for local development and tests so the repo runs without external database setup.

## OpenClaw (Docker)

Use the upstream gateway in a separate OpenClaw clone. See `docs/openclaw-docker.md`.

## Live picks

The UI can poll a JSON URL you host (lines + your model probabilities). Contract and sample: `docs/live-feed.md`. Your producer is responsible for odds ingestion and compliance; this repo only ranks normalized `CandidatePick` rows.

### Polymarket (Gamma API)

```bash
npm run polymarket:feed   # http://127.0.0.1:3001/feed
```

Then in the UI choose **Live feed** and use that URL. Details: `docs/polymarket.md`.

Objectives (EV vs friction vs capital efficiency): `docs/strategy.md`.

## Data shape

Input records are `CandidatePick` values:

- line details (market type, odds format, sportsbook, spread)
- your model view (`coverProbability`, optional `fairSpread`)

Output records are `ScoredPick` values with:

- implied probability
- edge (your probability minus market-implied probability)
- expected value per $1 staked
- spread discrepancy
- Kelly fraction (default half-Kelly)

## Next extension points

- Add confidence intervals and uncertainty penalties
- Add line-shopping dedupe across books
- Add a small CLI to read CSV/JSON and print top-N picks
