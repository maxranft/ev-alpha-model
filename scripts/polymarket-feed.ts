/**
 * Polymarket agent server.
 *
 * Serves:
 * - /feed live Gamma-derived feed
 * - /api/status execution readiness
 * - /api/orders live/paper order routing
 * - /api/orders/:id/cancel order cancellation
 * - /api/orders/:id/refresh order status refresh
 *
 * In production, if dist-web/ exists, it also serves the built dashboard.
 */
import { createPolymarketAgentServer } from "../src/server/agent-api.js";

const PORT = Number(process.env.PORT ?? "3001");

const server = createPolymarketAgentServer();

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Polymarket agent: http://127.0.0.1:${PORT}`);
  console.log(`Feed: http://127.0.0.1:${PORT}/feed`);
  console.log(`API status: http://127.0.0.1:${PORT}/api/status`);
});
