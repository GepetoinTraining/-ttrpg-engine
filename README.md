# TTRPG Engine

A full-stack tabletop RPG campaign management system. **141k lines of TypeScript** built in 7 hours across 2 commits.

> **Note:** The game engine library is at `/bend/src/engine/index.ts` - this is the barrel export for all game mechanics (grid, rules, narrative, assets, simulation, etc.)

## Project Status: Wiring Incomplete

The architecture is complete. The backend (55k lines) and frontend (20k lines) are fully scaffolded with types, schemas, and UI. What's missing is the **glue code** - the actual query function implementations that connect routers to the database.

### What's Done
- 34 database tables defined in migrations
- 13 tRPC routers with all procedures defined
- Turso client connection code
- WebSocket realtime infrastructure (types, handlers)
- Frontend components wired to tRPC hooks
- Clerk auth integration structure
- Gemini AI client structure
- Zod schema contracts in middleware layer

### What's Missing (The Glue)

1. **DB Query Functions** - Routers call functions that don't exist yet:
   - `getNode()`, `getParty()`, `getCampaignParties()`, `createParty()`, `updateParty()`, `deleteParty()`
   - `getHierarchy()`, `getNodesByType()`, `getSiblings()`
   - `getEdgesFrom()`, `getEdgesTo()`, `getConnectedNodes()`
   
2. **`createRealtimeServer()` factory** - `index.ts` imports this but `realtime/server.ts` only exports individual handlers

3. **`.env` files** - No credentials for Turso, Clerk, Gemini, Vercel Blob

4. **Some import path fixes** in `db/seeds/*.ts` files

---

## Architecture

```
/bend (55k lines)                    /fend (20k lines)
├── src/                             ├── src/
│   ├── index.ts      [entry]        │   ├── app.tsx        [entry]
│   ├── api/                         │   ├── api/
│   │   ├── router.ts [13 routers]   │   │   ├── trpc.ts    [client]
│   │   └── routers/  [5.4k lines]   │   │   └── websocket.ts
│   ├── db/                          │   ├── routes/        [19 routes]
│   │   ├── client.ts [Turso]        │   ├── components/    [44 files, 10k lines]
│   │   ├── migrations.ts [schema]   │   ├── hooks/         [6 hooks]
│   │   └── queries/  [INCOMPLETE]   │   ├── stores/        [Zustand]
│   ├── realtime/                    │   └── styles/        [Phi tensor UI]
│   │   ├── server.ts [handlers]     │
│   │   └── types.ts  [30+ msg types]│
│   ├── middleware/   [Zod contracts]│
│   ├── auth/         [Clerk]        │
│   ├── ai/           [Gemini]       │
│   ├── engine/       [game logic]   │
│   └── world/        [graph types]  │
```

---

## Key Files to Read

### Understanding the Architecture
1. `/bend/src/middleware/index.ts` - Architecture diagram and data flow docs (500 lines of comments)
2. `/bend/src/db/migrations.ts` - All 34 table schemas (~1200 lines)
3. `/bend/src/api/router.ts` - Main router combining 13 sub-routers

### What Needs Implementation
1. `/bend/src/db/queries/campaigns.ts` - Has some functions, missing `getParty`, `createParty`, etc.
2. `/bend/src/db/queries/nodes.ts` - Has `getNodes()`, missing `getNode()` (singular)
3. `/bend/src/db/queries/edges.ts` - Has `getEdges()`, missing `getEdgesFrom()`, `getEdgesTo()`
4. `/bend/src/realtime/server.ts` - Has handlers, missing `createRealtimeServer()` factory

### The Routers (what calls the missing functions)
- `/bend/src/api/routers/party.ts` - Calls missing party functions
- `/bend/src/api/routers/world.ts` - Calls missing node/edge functions
- `/bend/src/api/routers/economy.ts` - Calls missing `getNode()`

---

## Database Schema (34 Tables)

**Core:** campaigns, campaign_memberships, campaign_invites, users

**World Graph:** world_nodes, world_edges, factions, faction_relations, deities

**Characters:** characters, character_features, inventory_items, conditions

**NPCs:** npcs, npc_relationships, agents, agent_memories

**Sessions:** sessions, session_events, combats, combat_participants, combat_log

**Other:** parties, party_members, quests, quest_objectives, downtime_periods, downtime_actions, followers, economic_events, trade_routes, sync_log, audit_log

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TanStack Router/Query |
| Backend | Bun, tRPC v11 |
| Database | Turso (libSQL/SQLite) |
| Auth | Clerk |
| Realtime | WebSocket |
| AI | Google Gemini |
| Storage | Vercel Blob |
| Validation | Zod |

---

## Type Errors Summary

Running `bunx tsc --noEmit` shows ~160 real errors (plus ~200 unused variable warnings). Main categories:

1. **Missing exports** - Routers import functions that don't exist in query files
2. **API mismatches** - GeminiClient interface changed, Clerk `verifyToken` doesn't exist
3. **Schema mismatches** - Some Zod schemas have conflicting definitions

The unused variable errors (TS6133) can be ignored - they're just `ctx` parameters that aren't used yet.

---

## To Make It Run

### Minimum Viable Path (Campaign List → View)

1. Add `getNode()` to `/bend/src/db/queries/nodes.ts`:
```typescript
export async function getNode(id: string) {
  return queryOne<WorldNode>('SELECT * FROM world_nodes WHERE id = ?', [id]);
}
```

2. Add party functions to `/bend/src/db/queries/campaigns.ts`:
```typescript
export async function getParty(id: string) { ... }
export async function getCampaignParties(campaignId: string) { ... }
export async function createParty(input: CreatePartyInput) { ... }
export async function updateParty(id: string, input: UpdatePartyInput) { ... }
export async function deleteParty(id: string) { ... }
```

3. Add `createRealtimeServer()` factory to `/bend/src/realtime/server.ts`:
```typescript
export function createRealtimeServer(wss: WebSocketServer, config: RealtimeConfig) {
  // Wire up the existing handlers
  wss.on('connection', (ws, req) => handleConnect(...));
  return { wss, broadcast: broadcastToRoom, ... };
}
```

4. Create `/bend/.env`:
```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
CLERK_SECRET_KEY=sk_test_...
GOOGLE_AI_API_KEY=...
```

5. Create `/fend/.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

---

## Development

```bash
# Install
bun install

# Run backend (port 3001 HTTP, 3002 WS)
cd bend && bun run dev

# Run frontend (port 3003)
cd fend && bun run dev
```

---

## Ports

| Service | Port |
|---------|------|
| Backend HTTP (tRPC) | 3001 |
| Backend WebSocket | 3002 |
| Frontend (Vite) | 3003 |

---

## License

Private - All rights reserved
