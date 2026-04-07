# Live picks feed

The UI can poll a URL that returns **your** normalized lines plus **your model** probabilities (`coverProbability`, optional `fairSpread`). The model layer only ranks; it does not scrape books.

## Polymarket (built-in)

Run `npm run polymarket:feed` and point the UI at `http://127.0.0.1:3001/feed`. See `docs/polymarket.md`.

## JSON shape

`GET` your endpoint → `application/json`:

```json
{
  "asOf": "2026-04-03T16:00:00.000Z",
  "candidates": [
    {
      "line": {
        "eventId": "string",
        "market": "spread",
        "selection": "string",
        "sportsbook": "string",
        "oddsFormat": "american",
        "odds": -110,
        "spread": 4.5
      },
      "model": {
        "coverProbability": 0.56,
        "fairSpread": 6.0
      }
    }
  ]
}
```

- `asOf`: optional ISO 8601 string (shown in the UI when present).
- `candidates[]`: same structure as in-code `CandidatePick` (see `src/types.ts`).
- For `market: "spread"`, include `line.spread` (number, points; negative = favorite).

## Local test without a backend

With `npm run dev`, open the UI and set the live feed URL to:

`/live-sample.json`

(served from `web/public/live-sample.json`).

## Production

- Serve the JSON over HTTPS with **CORS** allowed for your UI origin, or put the UI and API on the **same origin**.
- Respect each data provider’s **terms of service** and applicable law.
- Refresh interval in the UI is configurable; avoid abusive polling.
