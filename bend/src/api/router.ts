import { router } from "./trpc";
import { campaignRouter } from "./routers/campaign";
import { characterRouter } from "./routers/character";
import { combatRouter } from "./routers/combat";
import { sessionRouter } from "./routers/session";
import { worldRouter } from "./routers/world";
import { syncRouter } from "./routers/sync";
import { partyRouter } from "./routers/party";
import { npcRouter } from "./routers/npc";
import { questRouter } from "./routers/quest";
import { downtimeRouter } from "./routers/downtime";
import { economyRouter } from "./routers/economy";
import { gmRouter } from "./routers/gm";

// ============================================
// APP ROUTER
// ============================================
//
// Main tRPC router combining all sub-routers.
//
// Structure:
//   api.campaign.*   - Campaign CRUD, membership, invites
//   api.party.*      - Party management, treasury
//   api.character.*  - Character CRUD, HP, inventory
//   api.npc.*        - NPC management, AI conversations
//   api.combat.*     - Combat lifecycle, participants, turns
//   api.session.*    - Session lifecycle, events, chat
//   api.quest.*      - Quest management, objectives
//   api.downtime.*   - Downtime activities, crafting
//   api.economy.*    - Trade, prices, settlements
//   api.world.*      - World nodes, edges, factions
//   api.sync.*       - Delta sync for real-time
//   api.gm.*         - GM-only tools, notes, secrets
//

export const appRouter = router({
  campaign: campaignRouter,
  party: partyRouter,
  character: characterRouter,
  npc: npcRouter,
  combat: combatRouter,
  session: sessionRouter,
  quest: questRouter,
  downtime: downtimeRouter,
  economy: economyRouter,
  world: worldRouter,
  sync: syncRouter,
  gm: gmRouter,
});

// Export type for client
export type AppRouter = typeof appRouter;
