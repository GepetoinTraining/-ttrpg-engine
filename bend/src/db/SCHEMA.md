# Database Schema

A living world TTRPG engine with 71 tables across 11 domains.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CORE (9 tables)                         │
│  users → campaigns → parties → characters                       │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORLD GRAPH (6 tables)                       │
│  spheres → planets → continents → regions → settlements         │
│  + factions, deities, points of interest                        │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SETTLEMENTS (5 tables)                       │
│  hubs → districts → chunks → buildings                          │
│  Observer-local rendering: only generate what players see       │
└─────────────────────────────────────────────────────────────────┘
          │
          ├──────────────────┬──────────────────┐
          ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  INVENTORY (7)   │ │   SKILLS (4)     │ │   MAGIC (5)      │
│  items           │ │   discovery      │ │   entropy        │
│  containers      │ │   emergent       │ │   rest events    │
│  mounts          │ │   skills from    │ │   spell casts    │
│  followers       │ │   play           │ │   timeline-aware │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ECONOMY (14 tables)                        │
│                                                                 │
│  EXTRACTION          MARKETS            LOGISTICS               │
│  ───────────         ───────            ─────────               │
│  deposits      →     venues        →    trading companies       │
│  operations          merchants          trade routes            │
│                      auctions           caravans                │
│                      districts          freight contracts       │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  COMBAT (5)      │ │  SESSIONS (6)    │ │   NPCs (5)       │
│  encounters      │ │  quests          │ │   AI agents      │
│  participants    │ │  objectives      │ │   memories       │
│  lairs           │ │  downtime        │ │   conversations  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SOCIAL CONTRACTS (9 tables)                   │
│  Obligation graph: marriages, oaths, vassalage, apprenticeships │
│  Households, kinship, titles, claims, jurisdictions             │
│  Factions become policy engines with real enforcement teeth     │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TIMELINE (5 tables)                         │
│  Every change is a delta. Time travel queries. Speculative      │
│  projections. The sync log is the source of truth.              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain Details

### 001_core — Foundation (9 tables)

| Table | Purpose |
|-------|---------|
| `users` | Player accounts (extends Clerk auth) |
| `campaigns` | Game campaigns with world connections |
| `campaign_memberships` | User ↔ campaign relationships |
| `campaign_invites` | Invite codes with expiry and usage limits |
| `parties` | Adventuring groups within campaigns |
| `party_memberships` | Character ↔ party relationships |
| `characters` | PCs and NPCs (unified model, `is_npc` flag) |
| `character_features` | Class features, racial traits, feats |
| `conditions` | Active conditions (poisoned, stunned, etc.) |

**Key design:** Characters are unified — NPCs are just characters with `is_npc=1`. Same stats, same progression, same systems.

---

### 002_world — Cosmic Graph (6 tables)

| Table | Purpose |
|-------|---------|
| `world_nodes` | Hierarchical locations (sphere → planet → continent → region) |
| `world_edges` | Connections between nodes (roads, portals, trade routes) |
| `factions` | Organizations with scope (local → cosmic) |
| `faction_relations` | Inter-faction relationships |
| `deities` | Pantheon entities tied to spheres/planets |
| `pois` | Points of interest (dungeons, landmarks, lairs) |

**Key design:** Spelljammer-ready. A campaign can span multiple planets across crystal spheres. Factions can be local guilds or multiverse-spanning powers.

---

### 003_hub — Settlements (5 tables)

| Table | Purpose |
|-------|---------|
| `hubs` | Settlements (villages → metropolises) |
| `hub_districts` | Neighborhoods (market, slums, noble, docks...) |
| `hub_chunks` | 100×100 unit tiles for procedural generation |
| `hub_buildings` | Specific locations (taverns, shops, temples) |
| `hub_observer_states` | What each character has discovered/seen |

**Key design:** Observer-local rendering. Only generate chunks the player can see. LRU cache for recently visited. Cold storage for the rest. The city exists as potential until observed.

---

### 004_inventory — Possessions (7 tables)

| Table | Purpose |
|-------|---------|
| `inventory_systems` | Per-character inventory root |
| `inventory_containers` | Backpacks, worn slots, saddlebags |
| `items` | Item templates and instances |
| `inventory_items` | Items in containers with quantity/equipped state |
| `mounts` | Horses, wagons, ships with cargo capacity |
| `followers` | Hirelings and companions that carry things |
| `commodities` | Trade goods with market values |

**Key design:** Containers have weight limits and dimensional space (bag of holding). Mounts have containers. Followers have inventory. Currency includes regional variants and trade goods.

---

### 005_skills — Emergent Mastery (4 tables)

| Table | Purpose |
|-------|---------|
| `character_skills` | Complete skill state per character |
| `skill_definitions` | Discovered/emergent skill definitions |
| `discovery_rules` | Rules for when new skills emerge |
| `skill_usage_log` | Every roll tracked for XP calculation |

**Key design:** Skills emerge from play. Roll enough Stealth in forests? Discover "Woodland Stalker". The system watches what you do and creates skills from patterns.

---

### 006_magic — Entropy & Lore (5 tables)

| Table | Purpose |
|-------|---------|
| `caster_states` | Slots, sorcery points, lore knowledge |
| `spell_casts` | Every cast recorded as a delta |
| `rest_events` | Long rest / short rest as timeline events |
| `spell_formulas` | Spell definitions (canonical + homebrew) |
| `scrolls` | Scroll items with contained spells |

**Key design:** Magic has entropy. Cast too much, risk paradox. Entropy resets on long rest — but that reset is a *timeline event*, not a field wipe. Query "what was their entropy at noon?" and get an answer.

---

### 007_economy — Living Markets (14 tables)

**Extraction (Primary Sector)**
| Table | Purpose |
|-------|---------|
| `resource_deposits` | Mines, farms, forests with reserves |
| `extraction_operations` | Active mining/harvesting operations |

**Markets (Tertiary Sector)**
| Table | Purpose |
|-------|---------|
| `market_venues` | Shops, stalls, emporiums |
| `merchants` | NPCs who buy/sell with personalities |
| `market_districts` | Areas with foot traffic and crime rates |
| `auction_houses` | Special venues for high-value sales |
| `auctions` | Individual auctions with bid history |
| `market_events` | Festivals, shortages, booms |

**Logistics (Distribution)**
| Table | Purpose |
|-------|---------|
| `trading_companies` | Organizations that move goods |
| `trade_route_programs` | Defined routes (circuit, shuttle, hub-spoke) |
| `caravans` | Active shipments on routes |
| `freight_contracts` | Shipping jobs with deadlines |
| `commodities` | (shared with inventory) |

**Legacy**
| Table | Purpose |
|-------|---------|
| `economic_events` | Region-wide economic effects |
| `trade_routes` | Simple A→B routes |

**Key design:** Goods flow from deposits → extraction → caravans → markets → players. Prices respond to supply/demand. Block a trade route and watch prices shift.

---

### 008_combat — Tactical Layer (5 tables)

| Table | Purpose |
|-------|---------|
| `combats` | Combat instances with round/turn tracking |
| `combat_participants` | Initiative, position, HP, conditions |
| `combat_log` | Turn-by-turn action record |
| `lairs` | Creature lairs with lair actions |
| `encounters` | Pre-built encounter templates |

**Key design:** Lairs have lair actions and regional effects. The dragon's lair changes the terrain in a 6-mile radius. Combat integrates with the lair system.

---

### 009_sessions — Play Structure (6 tables)

| Table | Purpose |
|-------|---------|
| `sessions` | Game sessions with world date tracking |
| `session_events` | Timeline of what happened |
| `quests` | Active and available quests |
| `quest_objectives` | Individual objectives with progress |
| `downtime_periods` | Between-session time blocks |
| `downtime_actions` | What characters do during downtime |

**Key design:** Downtime is structured. Characters queue actions (craft, research, work, carouse). The system resolves them with rolls and consequences.

---

### 010_npcs — Living Characters (5 tables)

| Table | Purpose |
|-------|---------|
| `npcs` | NPC-specific data (links to characters) |
| `npc_relationships` | How NPCs feel about entities |
| `agents` | AI agent configurations |
| `agent_memories` | What agents remember (with decay) |
| `conversations` | Dialogue history with outcomes |

**Key design:** NPCs have schedules (overnight shifts work correctly now). They remember conversations. Memories decay over time but important ones persist. Agents can control NPCs with consistent personality.

---

### 011_timeline — Delta Substrate (5 tables)

| Table | Purpose |
|-------|---------|
| `sync_log` | Every state change as a delta |
| `timeline_cursors` | Where each scope is in the timeline |
| `scheduled_events` | Future events waiting to trigger |
| `audit_log` | Who did what when |
| `speculative_projections` | "What if" calculations with TTL |

**Key design:** The sync log is truth. State is computed by projecting deltas. Want to know the world state at any point in history? Replay deltas to that point. Speculative projections let you ask "if they rest now, what happens?" without committing.

---

## Key Patterns

### 1. Everything is a Delta
State changes are recorded as events, not overwrites. This enables:
- Time-travel queries
- Undo/redo
- Speculative projections
- Audit trails

### 2. Observer-Local Generation
Don't generate the whole world. Generate what's observed:
- Hub chunks render on demand
- NPCs activate when nearby
- Markets simulate when visited

### 3. Unified Character Model
PCs and NPCs share the same table. An NPC can:
- Learn skills through action
- Level up
- Own property
- Join factions
The only difference is who controls them.

### 4. Seeded Determinism
All procedural generation uses `SeededRNG`. Same seed → same world. Essential for:
- Reproducible bugs
- Shared world state
- Time-travel consistency

### 5. Economic Flow
```
Deposits → Extraction → Caravans → Markets → Players
              ↑                        ↓
           Workers                  Currency
              ↑                        ↓
           Wages ←─────────────────────┘
```
Money circulates. Block a route, prices change. A real economy, not just loot tables.

---

## Migration Commands

```bash
# Run all migrations
bun run db:migrate

# Check status
bun --eval "require('./src/db/migrations').getMigrationStatus().then(console.log)"

# Drop everything (development only!)
bun --eval "require('./src/db/migrations').dropAllTables()"
```

---

---

### 012_social — Social Contract Engine (9 tables)

| Table | Purpose |
|-------|---------|
| `social_contracts` | Obligation graph edges (marriage, oaths, vassalage, etc.) |
| `social_contract_events` | Append-only ledger (proposed, accepted, breached, enforced) |
| `households` | Durable social/economic units (families, noble houses) |
| `household_memberships` | Who belongs to which household (with intervals) |
| `kinship_links` | Family graph (parent, child, spouse, with legitimacy) |
| `titles` | Inheritable positions (duke, guildmaster, etc.) |
| `claims` | Disputed succession/ownership |
| `jurisdictions` | Who enforces what, where (courts, churches, guilds) |
| `contract_policies` | Faction-specific rules for contract types |

**Key design:** Marriage is just one contract type. So are patronage, oaths, apprenticeships, vassalage, hostage treaties, trade partnerships, guild memberships, religious vows...

This gives us:
- **Social fabric** - stable obligations that bind NPCs
- **Lineage** - inheritance legitimacy, succession disputes
- **Faction leverage** - policy + coercion with real teeth
- **Emergent drama** - without scripted content

**The gameplay loop:**
```
Faction controls jurisdiction
    → defines recognized contracts
    → sets breach penalties
    → maintains registries
    
Player destabilizes rival
    → steals registry records
    → delegitimizes heirs
    → manufactures succession crisis
```

Contracts are truth (evented). Households are projections (rebuildable).

---

## Stats

- **12 migrations**
- **80 tables**
- **238 indexes**
- **~3,000 lines of schema SQL**

Built for a world that lives and breathes while you're not looking.
