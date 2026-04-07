# Polymarket source data

This project pulls **public** market metadata and prices from Polymarket’s **Gamma API** (`https://gamma-api.polymarket.com`). See Polymarket’s developer docs for terms and acceptable use.

## What gets imported

- Active, non-closed markets from `GET /events?active=true&closed=false&limit=…`
- For each outcome, `outcomePrices` becomes the implied probability **p** (0–1).
- Each row is converted to a `moneyline` `CandidatePick` with:
  - `line.odds` as decimal odds **1 / p**
  - `model.coverProbability` set to **p** so **edge is zero at import** (market-only baseline).
  - `line.polymarket` (bid–ask spread, liquidity when present) for ranking modes in `docs/strategy.md`.

To hunt alpha, replace or merge `model.coverProbability` with **your** belief (script, spreadsheet, or separate model).

## Run a local feed for the UI

Terminal 1:

```bash
npm run polymarket:feed
```

Terminal 2 (UI):

```bash
npm run dev
```

In the UI:

1. Choose **Live feed (poll)**.
2. Set URL to **`http://127.0.0.1:3001/feed`**.
3. Click **Refresh now** or wait for the poll interval.

Optional:

- `PORT=3002` — change port.
- `PM_LIMIT=80` — fetch more events per request (pagination).

## Programmatic use

```ts
import { buildPolymarketLiveFeed } from "./polymarket/gamma-feed.js";

const feed = await buildPolymarketLiveFeed({ limit: 30, offset: 0 });
```

Returns the same JSON shape as `docs/live-feed.md`.
