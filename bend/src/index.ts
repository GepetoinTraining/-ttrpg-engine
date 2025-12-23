import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import cors from "cors";

import { appRouter, type AppRouter } from "./api/router";
import { createContext, type CreateContextOptions } from "./api/trpc";
import { initDatabase, closeDatabase } from "./db/client";
import { getMembership } from "./db/queries/campaigns";
import { verifyClerkJWT, type ClerkJWTClaims } from "./auth/clerk";
import { createRealtimeServer } from "./realtime/server";

// ============================================
// CONFIGURATION
// ============================================

const PORT = parseInt(process.env.PORT || "3001", 10);
const WS_PORT = parseInt(process.env.WS_PORT || "3002", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// ============================================
// CONTEXT FACTORY
// ============================================

async function extractClaims(
  authHeader: string | undefined,
): Promise<ClerkJWTClaims | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    return await verifyClerkJWT(token);
  } catch {
    return null;
  }
}

function createContextFactory(getCampaignId: (req: any) => string | undefined) {
  return async ({ req }: { req: any }): Promise<CreateContextOptions> => {
    const claims = await extractClaims(req.headers.authorization);
    const campaignId = getCampaignId(req);

    return createContext({
      claims,
      getMembership,
      campaignId,
      requestId: crypto.randomUUID(),
      ip: req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  };
}

// ============================================
// HTTP SERVER (tRPC)
// ============================================

async function startHTTPServer() {
  // Extract campaign ID from header or query param
  const getCampaignId = (req: any): string | undefined => {
    return (
      req.headers["x-campaign-id"] ||
      new URL(req.url, `http://localhost:${PORT}`).searchParams.get(
        "campaignId",
      ) ||
      undefined
    );
  };

  const server = createHTTPServer({
    router: appRouter,
    createContext: createContextFactory(getCampaignId),
    middleware: cors({ origin: CORS_ORIGIN, credentials: true }),
  });

  server.listen(PORT);
  console.log(`🚀 tRPC HTTP server running on http://localhost:${PORT}`);

  return server;
}

// ============================================
// WEBSOCKET SERVER (Realtime)
// ============================================

async function startWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });

  // Create realtime server (handles rooms, presence, sync)
  const realtime = createRealtimeServer(wss, {
    verifyAuth: async (token: string) => {
      const claims = await verifyClerkJWT(token);
      return claims ? { userId: claims.sub, claims } : null;
    },
    getMembership,
  });

  console.log(`🔌 WebSocket server running on ws://localhost:${WS_PORT}`);

  return { wss, realtime };
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function setupGracefulShutdown(
  httpServer: ReturnType<typeof createHTTPServer>,
  wss: WebSocketServer,
) {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Close WebSocket connections
    wss.clients.forEach((client) => {
      client.close(1001, "Server shutting down");
    });
    wss.close();

    // Close HTTP server
    httpServer.server.close();

    // Close database
    await closeDatabase();

    console.log("✅ Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🎲 TTRPG Engine starting...\n");

  // Initialize database
  console.log("📦 Initializing database...");
  await initDatabase();

  // Start servers
  const httpServer = await startHTTPServer();
  const { wss, realtime } = await startWebSocketServer();

  // Setup shutdown handlers
  setupGracefulShutdown(httpServer, wss);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    TTRPG ENGINE READY                     ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP API:     http://localhost:${PORT.toString().padEnd(26)}║
║  WebSocket:    ws://localhost:${WS_PORT.toString().padEnd(28)}║
║  CORS Origin:  ${CORS_ORIGIN.padEnd(41)}║
╚═══════════════════════════════════════════════════════════╝
  `);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// ============================================
// TYPE EXPORTS
// ============================================

export type { AppRouter };
