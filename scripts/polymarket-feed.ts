/**
 * Local JSON feed backed by Polymarket Gamma API (public).
 * Run: npm run polymarket:feed
 * UI live URL: http://127.0.0.1:3001/feed
 */
import http from "node:http";

import { buildPolymarketLiveFeed } from "../src/polymarket/gamma-feed.js";

const PORT = Number(process.env.PORT ?? "3001");
const LIMIT = Number(process.env.PM_LIMIT ?? "40");

const server = http.createServer(async (req, res) => {
  if (req.url !== "/feed" && req.url !== "/feed/") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found. GET /feed\n");
    return;
  }
  try {
    const env = await buildPolymarketLiveFeed({ limit: LIMIT, offset: 0 });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify(env));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify({ error: msg }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Polymarket feed: http://127.0.0.1:${PORT}/feed (CORS *)`);
  console.log(`PM_LIMIT=${LIMIT} (set env to fetch more events per request)`);
});
