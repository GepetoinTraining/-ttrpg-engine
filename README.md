# TTRPG Engine

A full-stack tabletop RPG campaign management system built for the Forgotten Realms and beyond.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Mantine)                     │
│                         Gold/Parchment theme, mobile-first                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────────┐
│         tRPC API Layer          │   │       WebSocket Realtime Server     │
│      src/api/routers/*.ts       │   │        src/realtime/server.ts       │
│                                 │   │                                     │
│  • campaign.ts                  │   │  • Room management (campaign/session)│
│  • character.ts                 │   │  • Presence tracking                │
│  • combat.ts                    │   │  • Delta sync                       │
│  • session.ts                   │   │  • Chat/dice/cursor broadcasting   │
│  • world.ts                     │   │                                     │
└─────────────────────────────────┘   └─────────────────────────────────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE LAYER                                   │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   src/db/client.ts  │  │  src/db/queries/*   │  │ src/db/migrations   │  │
│  │   Turso/libSQL      │  │  Entity CRUD        │  │ Schema definitions  │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORLD GRAPH (Graph-on-SQL)                          │
│                                                                             │
│  world_nodes table          world_edges table         Inheritance Protocol  │
│  ┌─────────────────┐        ┌─────────────────┐       Children inherit from │
│  │ id, type, name  │◄──────►│ source, target  │       parents unless they   │
│  │ parent_id       │        │ type, properties│       explicitly override   │
│  │ data_static     │        │ bidirectional   │                             │
│  │ sphere/planet/  │        └─────────────────┘                             │
│  │ continent/region│                                                        │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── api/                    # tRPC API layer
│   ├── trpc.ts            # tRPC setup, auth middleware, permission procedures
│   ├── router.ts          # Main router combining all sub-routers
│   └── routers/           # Domain-specific routers
│       ├── campaign.ts    # Campaign CRUD, membership, invites
│       ├── character.ts   # Character CRUD, HP, inventory, level up
│       ├── combat.ts      # Combat lifecycle, turns, participants
│       ├── session.ts     # Game session management
│       └── world.ts       # World graph queries
│
├── auth/                   # Authentication
│   ├── clerk.ts           # Clerk integration, JWT validation, transforms
│   ├── types.ts           # Auth types (UserProfile, SessionAuth, roles)
│   └── permissions.ts     # Permission checker, role-based access
│
├── db/                     # Database layer
│   ├── client.ts          # Turso client, transaction support, helpers
│   ├── migrations.ts      # Schema definitions (~1200 lines)
│   ├── index.ts           # Exports
│   ├── queries/           # Query functions by entity
│   │   ├── campaigns.ts   # Campaign, membership, invites
│   │   ├── characters.ts  # Characters, inventory, HP operations
│   │   ├── combat.ts      # Combat, participants, initiative, logging
│   │   ├── nodes.ts       # World nodes with hierarchy traversal
│   │   ├── edges.ts       # World edges with BFS pathfinding
│   │   ├── factions.ts    # Faction queries
│   │   ├── sessions.ts    # Game session queries
│   │   └── sync.ts        # Delta sync for realtime
│   └── seeds/             # Seed data system
│       ├── importer.ts    # Batch import with validation
│       ├── validator.ts   # Seed data validation
│       └── loader.ts      # Manifest loading
│
├── realtime/              # WebSocket layer
│   ├── server.ts          # WebSocket server, rooms, presence, sync
│   └── types.ts           # Message types, payloads
│
├── world/                 # World graph system
│   ├── graph.ts           # WorldNode, WorldEdge types and schemas
│   └── SCHEMA_CONTRACT.md # Architecture contract (500+ lines)
│
├── middleware/            # Type contracts (Zod schemas)
│   ├── aggregates.ts      # Combined view schemas (CharacterSheet, etc.)
│   ├── actions.ts         # Atomic operation schemas
│   ├── events.ts          # Cross-system event schemas
│   ├── deltas.ts          # Sync delta schemas
│   └── hooks.ts           # Frontend hook contracts
│
└── engine/                # Game engine modules
    ├── combat/            # Combat manager
    ├── session/           # Live session engine
    ├── simulation/        # World simulation (economy, factions, etc.)
    ├── narrative/         # Story/narrative systems
    ├── rules/             # D&D 5e rules (creatures, lairs, etc.)
    ├── puzzle/            # Puzzle builder
    ├── intelligence/      # AI agent system
    ├── assets/            # Quick generation
    ├── grid/              # Hex/square grid math
    └── manager/           # Entity CRUD layer
```

## Core Concepts

### World Graph Architecture

The world is stored as a **graph-on-SQL** structure:

- **Nodes**: Spheres → Planets → Continents → Regions → Settlements → Buildings → Rooms
- **Edges**: Connections between nodes (travel routes, portals, relationships)
- **Inheritance**: Child nodes inherit parent properties (physics, culture, climate) unless overridden

```typescript
// Node types hierarchy
type NodeType =
  | "sphere"      // Crystal sphere (Realmspace, Greyspace)
  | "planet"      // Toril, Oerth
  | "continent"   // Faerûn, Kara-Tur
  | "region"      // Sword Coast, Dalelands
  | "settlement"  // Waterdeep, Baldur's Gate
  | "district"    // Castle Ward, Dock Ward
  | "building"    // Yawning Portal, Blackstaff Tower
  | "room"        // Specific locations
  | "poi";        // Points of interest
```

### Authentication & Authorization

- **Clerk** handles authentication (JWT, social login, magic links)
- **Campaign roles**: owner, gm, co_gm, player, spectator
- **Permission system**: Role-based + granular permissions per campaign

```typescript
// Procedure types (src/api/trpc.ts)
publicProcedure    // No auth required
protectedProcedure // Requires authentication
campaignProcedure  // Requires campaign membership
gmProcedure        // Requires GM role
ownerProcedure     // Requires campaign owner
```

### Realtime Sync

Delta-based sync for multiplayer:

1. Changes logged to `sync_log` table with version numbers
2. Clients subscribe to campaign/session rooms
3. Server broadcasts deltas to room members
4. Clients acknowledge, cursor advances

### Seed Data System

Canonical Forgotten Realms data imported via:

```typescript
// Manifest-based import
await importFromManifest("seeds/manifest.json", {
  onConflict: "skip",  // or "update" or "error"
  batchSize: 100,
  validateFirst: true,
});
```

## Database Schema (Key Tables)

```sql
-- Campaigns
campaigns (id, name, owner_id, status, settings, ...)

-- Membership
campaign_memberships (user_id, campaign_id, role, permissions, ...)

-- Characters
characters (id, campaign_id, owner_id, name, class, level, hp, ...)
inventory_items (id, character_id, name, type, quantity, equipped, ...)

-- Combat
combats (id, session_id, status, round, turn_index, ...)
combat_participants (id, combat_id, entity_type, initiative, hp, ...)
combat_log (id, combat_id, action_type, action_data, ...)

-- World Graph
world_nodes (id, parent_id, type, name, data_static, ...)
world_edges (id, source_id, target_id, type, properties, ...)

-- Factions & Deities
factions (id, name, type, scope, data, ...)
deities (id, name, pantheon, alignment, data, ...)

-- Sync
sync_log (id, campaign_id, entity_type, entity_id, operation, delta, version, ...)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Mantine UI |
| API | tRPC (type-safe RPC) |
| Validation | Zod |
| Auth | Clerk |
| Database | Turso (libSQL/SQLite) |
| Realtime | WebSocket |
| Runtime | Node.js / Bun |

## Key Files for Context

When starting a new session, read these files first:

1. **Schema Contract**: `src/world/SCHEMA_CONTRACT.md` - Full architecture spec
2. **Database Schema**: `src/db/migrations.ts` - All table definitions
3. **API Layer**: `src/api/trpc.ts` - Auth middleware and procedures
4. **World Graph Types**: `src/world/graph.ts` - Node/edge type definitions

## Known Wiring Issues

1. **Campaign router function names** - `src/api/routers/campaign.ts` calls functions with names that don't match `src/db/queries/campaigns.ts` exports. Need to add aliases or rename.

2. **Entry point** - `src/index.ts` is empty. Needs to wire together API + realtime + db init.

## Development

```bash
# Install dependencies
bun install

# Run migrations
bun run migrate

# Import seed data
bun run seed

# Start dev server
bun run dev
```

## License

Private - All rights reserved
