// ============================================
// @ttrpg/bend - Backend Package Exports
// ============================================
//
// This file re-exports everything needed by consumers
// (serverless functions, tests, etc.)
//

// API Router & Context
export { appRouter, type AppRouter } from "./api/router";
export { createContext, type Context } from "./api/trpc";

// Auth
export { verifyClerkJWT } from "./auth/clerk";

// Database - Core
export { getClient, initDatabase, closeDatabase } from "./db/client";
export { query, queryOne, queryAll, transaction } from "./db/client";
export { uuid, now, parseJson, toJson } from "./db/client";

// Database - Campaigns (includes getMembership)
export * from "./db/queries/campaigns";

// Database - Characters
export * from "./db/queries/characters";

// Database - Combat
export * from "./db/queries/combat";

// Database - World
export * from "./db/queries/nodes";
export * from "./db/queries/edges";
export * from "./db/queries/factions";

// AI
export * from "./ai";
export { ensureUser } from "./db/queries/users";
