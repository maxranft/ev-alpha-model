# EV Alpha Model

Polymarket-first TypeScript stack for:

- highest expected value per dollar staked
- largest discrepancies between market spread and model fair spread
- dashboard-driven paper/live order routing against the Polymarket CLOB

## Design goals

- Pure functions for core math
- High unit-test coverage for easy refactors
- Minimal surface area and no framework lock-in
- Polymarket-first execution with a server-side CLOB adapter and persisted order blotter

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
npm run agent
npm run dev
```

Open `http://127.0.0.1:5173/`. The Vite UI proxies `/api` and `/feed` to the local agent server on `127.0.0.1:3001`.

## Execution

The execution layer is intentionally Polymarket-first.

- `npm run agent` starts the local Polymarket agent server.
- `/feed` serves a Gamma-backed live feed with execution metadata attached to each contract.
- `/api/orders` routes paper or live orders through the execution service.
- Orders persist to `data/orders.json`, so the dashboard blotter survives server restarts.

### Live trading prerequisites

Paper execution works without wallet credentials. Live execution is blocked unless the server has:

```bash
POLYMARKET_LIVE_TRADING=true
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_FUNDER_ADDRESS=0x...
POLYMARKET_SIGNATURE_TYPE=0
```

Optional:

```bash
POLYMARKET_HOST=https://clob.polymarket.com
POLYMARKET_CHAIN_ID=137
POLYMARKET_API_KEY=...
POLYMARKET_API_SECRET=...
POLYMARKET_API_PASSPHRASE=...
ORDER_STORE_PATH=./data/orders.json
```

`POLYMARKET_FUNDER_ADDRESS` is the Polymarket profile / funder wallet used for CLOB auth. If API credentials are omitted, the server derives or creates them from the signing wallet on first use.

### Derived alpha and live routing

The dashboard can only route live orders for candidates that include Polymarket contract metadata such as token ID and condition ID.

- The built-in `/feed` endpoint provides executable market metadata, but its model probability is market-neutral by default.
- To trade on real alpha, point the dashboard at a live feed whose `model.coverProbability` reflects your model and whose `line.polymarket.contract` block includes the Polymarket token metadata.

## OpenClaw (Docker)

Use the upstream gateway in a separate OpenClaw clone. See `docs/openclaw-docker.md`.

## Live picks

The UI can poll a JSON URL you host (lines + your model probabilities). Contract and sample: `docs/live-feed.md`. Your producer is responsible for odds ingestion and compliance; this repo only ranks normalized `CandidatePick` rows.

### Polymarket (Gamma API)

```bash
npm run agent   # http://127.0.0.1:3001/feed
```

Then in the UI choose **Live feed** and use `/feed` or another compatible feed URL. Details: `docs/polymarket.md`.

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
