// ============================================
// API LAYER
// ============================================
//
// Type-safe tRPC API for the TTRPG engine.
//
// Usage (Next.js API route):
//
//   // pages/api/trpc/[trpc].ts
//   import { createNextApiHandler } from '@trpc/server/adapters/next';
//   import { appRouter, createContext } from '@/api';
//
//   export default createNextApiHandler({
//     router: appRouter,
//     createContext,
//   });
//
// Usage (Client):
//
//   import { createTRPCClient } from '@trpc/client';
//   import type { AppRouter } from '@/api';
//
//   const client = createTRPCClient<AppRouter>({
//     url: '/api/trpc',
//   });
//
//   // Full type inference
//   const campaigns = await client.campaign.list.query();
//   const character = await client.character.get.query({ id: '...' });
//

// Core tRPC setup
export {
  router,
  publicProcedure,
  protectedProcedure,
  campaignProcedure,
  gmProcedure,
  ownerProcedure,
  middleware,
  mergeRouters,
  createContext,
  requirePermission,
  requireAnyPermission,
  notFound,
  forbidden,
  badRequest,
  conflict,
  PaginationInput,
  IdInput,
  CampaignIdInput,
  SearchInput,
  type Context,
  type AuthenticatedContext,
  type CampaignContext,
  type CreateContextOptions,
} from "./trpc";

// Main router
export { appRouter, type AppRouter } from "./router";

// Sub-routers (for testing or custom composition)
export { campaignRouter } from "./routers/campaign";
export { characterRouter } from "./routers/character";
export { combatRouter } from "./routers/combat";
export { downtimeRouter } from "./routers/downtime";
export { economyRouter } from "./routers/economy";
export { gmRouter } from "./routers/gm";
export { npcRouter } from "./routers/npc";
export { partyRouter } from "./routers/party";
export { questRouter } from "./routers/quest";
export { sessionRouter } from "./routers/session";
export { syncRouter } from "./routers/sync";
export { worldRouter } from "./routers/world";
