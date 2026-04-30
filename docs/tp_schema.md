# .tp Schema — Complete κ Topology & Wiring Reference

> **Schema = .tp** (what κ is valid at each node type)
> **Rows = .tpb** (append-only history of every mutation)
> **Engine = Clockwork** (the unified heartbeat that drives writes)

---

## Three Things Exist

| Thing | What | Example | Rule |
|-------|------|---------|------|
| **Node** (Hub) | A place where things happen | Settlement, region, dungeon, shrine | Has κ that inherits down the tree |
| **Edge** (Route) | A connection between hubs | Road, river, sea lane, portal, tunnel | Has own typed schema from `world-edge.ts` — NOT `dataStatic` |
| **Entity** | A thing at a node or moving along an edge | Caravan, NPC, army, merchant, herd | Has own lifecycle. Reads κ, may write summary κ |

**The test:** Can it move? Does it have its own lifecycle? → Entity, not κ.

---

## Node Type Hierarchy

```
crystal_sphere          depth 0   (Realmspace)
  └── planet            depth 1   (Toril)
       ├── continent    depth 2   (Faerûn — surface)
       │    └── region  depth 3   (Sword Coast, Heartlands)
       │         └── settlement   depth 4   (Waterdeep, Suzail)
       │              └── district depth 5  (Market Ward)
       │                   └── building depth 6 (The Yawning Portal)
       │
       └── continent    depth 2   (The Underdark — subterranean)
            ├── region  depth 3   (Upperdark, Middledark, Lowerdark)
            │    └── settlement   depth 4   (Menzoberranzan, Skullport)
            └── ...
```

**Underdark = parallel continent**, not a region under Faerûn. Vertical edges (`cavern_access`, `tunnel`, `sealed_portal`, `shaft`, `underground_river`) bridge the two graphs.

---

## κ Domain Table — The Full Map

### Inheritable Domains (10) — merge root→leaf, child overrides parent

| # | Domain Key | Seed Depth | Primary Writers | Primary Readers | Clockwork Cadence |
|---|-----------|------------|----------------|-----------------|-------------------|
| 1 | `physics` | 0→3 | seed data | magic.ts | — (static) |
| 2 | `law` | 3→5 | seed data, faction.ts | market.ts, services.ts, social.ts, npc-agenda.ts | monthly |
| 3 | `economy` | 2→4 | market.ts, production-chain.ts, currency.ts | banking.ts, caravan.ts, services.ts, agriculture.ts | weekly |
| 4 | `weather` | 3→4 | weather.ts | agriculture.ts, water.ts, mm-settlement.ts, caravan entities | weekly |
| 5 | `ecology` | 3→4 | monster-actor.ts (summary), dungeon-gate.ts (overflow) | guild.ts, npc-agenda.ts, mm-settlement.ts | monthly |
| 6 | `faction` | 3→4 | faction.ts, warfare.ts | mm-settlement.ts, market.ts, social.ts, npc-agenda.ts | monthly |
| 7 | `social` | 3→4 | social.ts | faction.ts, npc-agenda.ts, mm-settlement.ts | monthly |
| 8 | `culture` | 2→5 | seed data, entertainment.ts, cooking.ts | npc-agenda.ts, mm-settlement.ts | weekly/monthly |
| 9 | `religion` | 2→4 | religion.ts, seed data | npc-agenda.ts, social.ts, magic.ts | yearly |
| 10 | `military` | 3→4 | warfare.ts | mm-settlement.ts, monster-actor.ts, faction.ts | monthly |

### Non-Inheritable Domains (6) — leaf node only (depth 4)

| # | Domain Key | Primary Writers | Primary Readers | Clockwork Cadence |
|---|-----------|-----------------|-----------------|-------------------|
| 11 | `settlement` | mm-settlement.ts | ALL hub-level systems | weekly |
| 12 | `market` | market.ts | services.ts, npc-agenda.ts | weekly |
| 13 | `infrastructure` | infrastructure-mm.ts | knowledge-pool.ts, production-chain.ts, hub-builder.ts | monthly |
| 14 | `knowledge` | knowledge-pool.ts, lore.ts | magic.ts, infrastructure-mm.ts | monthly |
| 15 | `guild` | guild.ts | faction.ts, npc-agenda.ts | weekly |
| 16 | `water` | water.ts | agriculture.ts, mm-settlement.ts | daily |

---

## Per-Domain κ Shape

### Inheritable Domains

#### 1. `physics` — sphere → planet → region
```typescript
physics: {
  gravity: { type: 'standard'|'plane'|'none'|'reversed'|'variable', strength: number }
  atmosphere: { type: 'standard'|'none'|'envelope'|'toxic'|'explosive' }
  magic: {
    level: 'dead'|'restricted'|'standard'|'enhanced'|'high'|'wild'
    source: string                    // "The Weave"
    specialRules: string[]
    schoolModifiers: Record<string, { modifier: string }>
  }
  time: { flow: 'standard'|'fast'|'slow'|'stopped'|'reversed', ratio: string }
}
```

#### 2. `law` — region → settlement → district
```typescript
law: {
  system: string                      // "The Code of Cormyr"
  enforcement: 'none'|'lax'|'moderate'|'strict'|'tyrannical'
  corruption: 'none'|'low'|'moderate'|'high'|'rampant'
  specialRules: string[]
  taxRate: number
  bannedGoods: string[]
  bannedMagic: string[]
}
```

#### 3. `economy` — continent → region → settlement
```typescript
economy: {
  type: string                        // "imperial_capital"
  currency: string
  tradeModifier: number
  wealthLevel: 'destitute'|'poor'|'modest'|'comfortable'|'wealthy'|'opulent'
  commodities: Record<string, {
    supply: number, demand: number, price: number,
    trend: 'rising'|'stable'|'falling'
  }>
  exchangeRates: Record<string, number>
}
```

#### 4. `weather` — region → settlement
```typescript
weather: {
  climate: 'tropical'|'subtropical'|'temperate'|'subarctic'|'arctic'|'desert'|'oceanic'
  season: 'spring'|'summer'|'autumn'|'winter'
  temperature: number
  precipitation: 'none'|'light'|'moderate'|'heavy'|'torrential'
  wind: 'calm'|'light'|'moderate'|'strong'|'gale'|'hurricane'
  visibility: 'clear'|'hazy'|'foggy'|'obscured'
  severity: number                    // 0.0–1.0
  modifiers: {
    yieldModifier: number, travelSpeed: number,
    monsterActivity: number, spoilageRate: number,
    combatEffects: string[]
  }
}
```

#### 5. `ecology` — region → settlement
```typescript
ecology: {
  wildlifeDensity: number             // 0.0–1.0
  dangerLevel: number                 // 0.0–1.0
  dominantThreats: string[]           // ["wolf_pack", "goblin_tribe"]
}
```
> Monster groups are **entities**, not κ. `ecology` is the **summary** they write.

#### 6. `faction` — region → settlement
```typescript
faction: {
  control: Record<string, {
    influence: number, loyalty: number,
    stance: 'hostile'|'unfriendly'|'neutral'|'friendly'|'allied'
  }>
  dominant: string | null
  contested: boolean
}
```

#### 7. `social` — region → settlement
```typescript
social: {
  titles: Record<string, {
    rank: 'knight'|'baron'|'count'|'duke'|'prince'|'king',
    holder: string | null,
    succession: 'primogeniture'|'elective'|'merit'|'conquest'
  }>
  standingAvg: number
  contracts: { active: number, breached: number, enforceability: number }
}
```

#### 8. `culture` — continent → district
```typescript
culture: {
  government: { type: string, ruler: string, rulingBody: string }
  customs: Record<string, unknown>
  attitudes: Record<string, string>
  entertainment: { culturalScore: number, revenue: number, venues: number }
  food: { variety: number, morale: number }
}
```

#### 9. `religion` — continent → settlement
```typescript
religion: {
  pantheon: string
  dominant: string | null
  temples: Record<string, {
    deity: string, size: 'shrine'|'chapel'|'temple'|'cathedral'|'holy_site',
    clergy: number, faithOutput: number
  }>
  faithPool: Record<string, number>
}
```

#### 10. `military` — region → settlement
```typescript
military: {
  garrison: number
  readiness: number                   // 0.0–1.0
  morale: number
  upkeep: number
  fortification: 'none'|'palisade'|'stone_wall'|'castle'|'fortress'
}
```
> Armies are **entities**. `military` κ is the garrison that doesn't move.

### Non-Inheritable Domains (leaf-only)

#### 11. `settlement`
```typescript
settlement: {
  scale: 'regional_capital'|'city'|'town'|'village'|'hamlet'|'outpost'
  population: number, stability: number, unrest: number,
  morale: number, growthRate: number, guards: number
}
```

#### 12. `market`
```typescript
market: {
  tier: 'none'|'village'|'town'|'city'|'metropolis'
  venues: Record<string, { type: string, capacity: number, reputation: number }>
  events: string[], lastTick: number
}
```

#### 13. `infrastructure`
```typescript
infrastructure: {
  professions: Record<string, { count: number, tier: string, guildId: string | null }>
  buildings: Record<string, { count: number, condition: string }>
  knowledgeTier: number, workshops: string[], recipes: string[]
}
```

#### 14. `knowledge`
```typescript
knowledge: {
  seeds: Record<string, { category: string, source: string, activatedDay: number | null }>
  potentials: string[], tier: number,
  library: { books: number, scrolls: number, researchSpeed: number }
}
```

#### 15. `guild`
```typescript
guild: {
  chapters: Record<string, {
    type: 'adventurer'|'merchant'|'thieves'|'mage'|'craft',
    members: number, treasury: number, reputation: number,
    jobs: { posted: number, active: number, completed: number }
  }>
  intel: { sightings: string[], rumors: string[] }
}
```

#### 16. `water`
```typescript
water: {
  sources: Record<string, {
    type: 'well'|'spring'|'port'|'lake_shore'|'reservoir',
    level: number,
    floodStage: 'normal'|'watch'|'minor'|'moderate'|'major'|'catastrophic',
    fishStock: number
  }>
}
```
> Rivers are **edges**, not κ. Ports/wells are κ because they're infrastructure AT the hub.

---

## Entity Registry — Things With Their Own State Machines

| Entity Type | Module | Positioned At | Reads κ | Writes κ |
|------------|--------|---------------|---------|----------|
| Caravan | `caravan.ts` | on edge (mile) | `weather.modifiers.travelSpeed`, edge segments | — (self-contained) |
| Shipment | `logistics.ts` | on edge (mile) | edge route, `weather.modifiers.travelSpeed` | — |
| Herd | `husbandry.ts` | at settlement | `weather.modifiers.yieldModifier` | `economy.commodities` |
| Monster Group | `monster-actor.ts` | at lair node | `weather.modifiers.monsterActivity` | `ecology.dangerLevel` on nearby |
| Dungeon Gate | `dungeon-gate.ts` | at node | — | `ecology.dangerLevel` (overflow) |
| Faction | `faction.ts` | abstract (spans) | `economy.*`, `military.*` | `faction.control` on nodes |
| Army | `warfare.ts` | at node / on edge | `faction.*`, `military.*` | `military.*` on garrisoned node |
| NPC | `npc-agenda.ts` | at node | `settlement.*`, `market.*`, `ecology.*` | `economy.commodities` |
| Merchant | `market.ts` | at settlement | `market.tier`, `economy.commodities` | `economy.commodities` (prices) |
| Actor (strategic) | `mm-actor.ts` | at node | `faction.*`, `economy.*` | `faction.control` via schemes |
| Actor (local) | `mm-local-actor.ts` | at settlement | `market.*`, `infrastructure.*` | `economy.commodities` |
| Guild Chapter | `guild.ts` | at settlement | `ecology.*` (sightings) | `guild.intel` |
| Bank/Vault | `banking.ts` | at settlement | `law.enforcement`, `economy.*` | `economy.*` (interest) |
| Patrol | `warfare.ts` | on edge segment | edge segment ownership | edge `dangerLevel` |

### Entity Position Model
```typescript
type EntityPosition =
  | { type: 'at_node'; nodeId: string }
  | { type: 'on_edge'; edgeId: string; mile: number; direction: 'forward'|'reverse' }
  | { type: 'abstract' }             // factions, pantheons
```

---

## Clockwork Cadences & Layer Order

The unified `Clockwork` engine fires these cadences:

| Cadence | Days | Fires Per Year | Primary Users |
|---------|------|---------------|---------------|
| daily | 1 | 360 | weather, water, logistics, npc-agenda |
| weekly | 7 | 51 | settlements, markets, agriculture, guilds, entertainment |
| monthly | 30 | 12 | factions, warfare, infrastructure, ecology, social |
| **quarterly** | **90** | **4** | **actor schemes (INT ≥10), large infrastructure** |
| **semesterly** | **180** | **2** | **actor schemes (INT ≥14), governance shifts** |
| yearly | 360 | 1 | religion, political succession |

### 7-Layer Dependency Order

```
L0 — PHYSICAL (zero deps, pure generation)
  ├── weather.ts        → weekly    → writes weather κ on region/settlement
  └── water.ts          → daily     → writes water κ on settlement

L1 — EXTRACTION (reads weather κ)
  ├── production-chain.ts → weekly  → writes economy.commodities
  ├── agriculture.ts      → weekly  → reads weather.modifiers.yieldModifier
  └── husbandry.ts        → weekly  → ENTITY at node, reads weather + ecology

L2 — ECONOMY (reads extraction output)
  ├── market.ts           → weekly  → writes economy.commodities (prices)
  ├── banking.ts          → weekly  → ENTITY at node
  ├── currency.ts         → weekly  → writes economy.exchangeRates
  ├── caravan.ts          → weekly  → ENTITY on edge
  └── logistics.ts        → daily   → ENTITY on edge

L3 — FACTION (reads economy κ)
  ├── faction.ts          → monthly → writes faction κ
  ├── warfare.ts          → monthly → writes military κ, ENTITY armies
  └── intelligence.ts     → monthly → ENTITY spies

L4 — SETTLEMENT (reads economy + faction)
  ├── mm-settlement.ts    → weekly  → writes settlement κ
  ├── infrastructure-mm.ts → monthly → writes infrastructure κ
  ├── knowledge-pool.ts   → monthly → writes knowledge κ
  └── social.ts           → monthly → writes social κ

L5 — ECOLOGY (reads settlement κ)
  ├── monster-actor.ts    → monthly → ENTITY, writes ecology κ
  ├── dungeon-gate.ts     → weekly  → ENTITY, writes ecology κ
  └── guild.ts            → weekly  → ENTITY chapters, writes guild κ

L6 — HUB SERVICES (reads everything above)
  ├── npc-agenda.ts       → daily   → ENTITY at node
  ├── cooking.ts          → monthly → writes culture.food κ
  ├── entertainment.ts    → weekly  → writes culture.entertainment κ
  ├── lore.ts             → weekly  → writes knowledge κ
  ├── services.ts         → weekly  → ENTITY at node
  ├── religion.ts         → yearly  → writes religion κ
  └── narrative.ts        → per-session (observation only)
```

**Cross-layer edges** (from `system-edges.ts`):
- After L5: ecology entities → husbandry entities (predation)
- After L4: social κ → faction entities (contract loyalty)
- After L4: knowledge κ → magic (DC reduction)
- After L5: guild κ → faction entities (intel feed)
- After L5: dungeon clear → knowledge κ (seed deposit)

---

## Implementation Status — `tp.ts` vs Schema

| Feature | Schema Says | `tp.ts` Currently | Status |
|---------|------------|-------------------|--------|
| `resolve()` inheritance | 10 domains | 3 (physics, law, economy) | ⚠️ Missing 7 |
| `LocalContext` shape | 10 typed + 6 optional + edges + entities | 3 typed + nodeData bag | ⚠️ Partial |
| `WorldEdge` | Import from `world-edge.ts` (typed) | Own minimal `{type, sourceId, targetId, properties}` | ⚠️ Untyped duplicate |
| `writeKappa()` | Typed domain validation | Exists — dot-path write, no validation | ✅ Works (untyped) |
| `mutateNode()` | Shallow merge to dataStatic | Exists | ✅ Works |
| Entity registry | `getEntitiesAt(nodeId)`, `getEntitiesOnEdge()` | Not implemented | ❌ Missing |
| `EntityPosition` type | `at_node`, `on_edge`, `abstract` | Not implemented | ❌ Missing |

## Implementation Status — `tpb.ts` vs Schema

| Feature | Schema Says | `tpb.ts` Currently | Status |
|---------|------------|-------------------|--------|
| Generic append-only log | ✅ | ✅ Generic `TPB<TState, TAction>` | ✅ Works |
| Branch/Diff | ✅ | ✅ `branch()`, `static diff()` | ✅ Works |
| World-level action types | `writeKappa`, `writeEdge`, `entitySpawn/Move/Despawn`, `observe`, `session`, `tick` | Not typed — generic `TAction` | ⚠️ Untyped |
| Delta snapshots | Before/after per mutation | Generic `stateSnapshot` — full snapshot, not delta | ⚠️ Full snapshot, not delta |
| Session grouping | `sessionId` on entries | ✅ `sessionId`, `session()` filter | ✅ Works |
| Checkpoint cadence | Daily/weekly/monthly/yearly/observation/entity/session | No cadence-aware writes — Clockwork doesn't append to world tpb yet | ❌ Not wired |

## Implementation Status — `clockwork.ts` vs Schema

| Feature | Schema Says | `clockwork.ts` Currently | Status |
|---------|------------|--------------------------|--------|
| Daily heartbeat | ✅ | ✅ `dailyTick()` | ✅ Works |
| Cadences | daily, weekly, monthly, quarterly, semesterly, yearly | ✅ All 6 + observation (round, slot, hourly) | ✅ Works |
| TP reference | Pass to all tick functions | ✅ Constructor takes `TP`, passes to `accumulatePotential` | ✅ Works |
| 7 layers | L0–L6 dependency order | 5 layers in code (0–4) | ⚠️ Needs expansion to 7 |
| Player ticks | `addPlayerTick()` | ✅ Accumulated + consumed daily | ✅ Works |
| Observation | `observe()`, `observeNode()` | ✅ Both work, pass TP | ✅ Works |
| Domain module adapters | 28+ modules as ISimulatedMM | 0 wired — only MMSettlement/MMActor/MMLocalActor registered | ❌ Phase 5 |
| DicePool refresh | Clockwork calls `tickDicePool()` on actors | Not wired (pool exhausts at 51 weeks) | ❌ Discovered seam |

---

## What Must Change — Priority Order

### P0: Functional Gaps (blocking simulation fidelity)

1. **Expand `resolve()`** — merge all 10 inheritable domains, not just 3
2. **Expand `LocalContext`** — 10 typed domain fields + 6 optional non-inheritable + entity list
3. **Expand Clockwork layers** from 5 to 7 to match dependency order
4. **Wire DicePool refresh** — Clockwork calls `tickDicePool()` on actors weekly

### P1: Type Safety (blocking domain module adapters)

5. **Unify WorldEdge** — `tp.ts` imports `WorldEdge` from `world-edge.ts` (drop duplicate)
6. **Typed `writeKappa()`** — validate domain key + shape before write
7. **World-level TPB action types** — typed `TPBAction` union for clockwork writes

### P2: Entity Infrastructure (blocking entity simulation)

8. **Entity registry in TP** — `registerEntity()`, `getEntitiesAt()`, `getEntitiesOnEdge()`
9. **`EntityPosition` type** — `at_node | on_edge | abstract`
10. **Entity lifecycle tpb** — `entitySpawn`, `entityMove`, `entityDespawn` action types

### P3: Wiring (Phase 5 of clockwork)

11. **Domain module adapters** — wrap all 28 modules as `ISimulatedMM`
12. **Clockwork → world TPB writes** — every tick/observation appends to the world tpb
13. **`hub-builder.ts`** — seeds all 16 κ domains + spawns entities on hub creation

---

## Edge Schema — From `world-edge.ts`

Edges have their own complete schema (NOT `dataStatic`):

| Field | Type | Description |
|-------|------|-------------|
| `distanceMiles` | number | Total route length |
| `terrain` | enum | Surface type |
| `bidirectional` | boolean | Can travel both ways? |
| `segments[]` | array | Per-stretch: controller, road condition, danger, toll, patrol |
| `discoveredSites[]` | array | POIs found: deposits, ruins, landmarks, lairs |
| `exploredFraction` | number | Fog of war (0.0–1.0) |
| `fastTravelUnlocked` | boolean | Can skip traversal? |
| `fastTravelType` | string | How (horse relay, teleport, etc.) |
| `fastTravelCost` | number | Gold cost to fast travel |

**What is NOT on an edge:** cargo (caravan entity), shipments (entity), news (carried by entities), monster encounters (entity danger radius → segment `dangerLevel`).

**Vertical edges** (surface ↔ Underdark): `cavern_access`, `tunnel`, `sealed_portal`, `shaft`, `underground_river`. These have `terrain: 'underground'` + depth transition properties.

---

## .tpb Integration — World History

### Proposed World TPB Action Types

```typescript
type WorldTPBAction =
  // Clock
  | { type: 'tick'; worldDay: number; cadence: TickCadence }
  // Node κ
  | { type: 'writeKappa'; nodeId: string; domain: string; paths: string[]; system: string }
  // Edge
  | { type: 'writeEdge'; edgeId: string; field: string; system: string }
  // Entity lifecycle
  | { type: 'entitySpawn'; entityType: string; entityId: string; position: EntityPosition }
  | { type: 'entityMove'; entityId: string; from: EntityPosition; to: EntityPosition }
  | { type: 'entityDespawn'; entityId: string; reason: string }
  // Observation
  | { type: 'observe'; nodeId: string; partyId: string }
  // Session
  | { type: 'session'; sessionId: string; event: 'start'|'end' }
```

### Checkpoint Cadence

| Event | tpb entry? | What's snapshotted |
|-------|-----------|-------------------:|
| Daily tick | Yes | Weather, water levels, NPC schedules |
| Weekly resolve | Yes | Market prices, settlement stats, guild jobs |
| Monthly resolve | Yes | Faction control, ecology, infrastructure |
| Quarterly resolve | Yes | Actor strategic schemes (INT ≥ 10) |
| Semesterly resolve | Yes | Governance shifts, territorial campaigns |
| Yearly resolve | Yes | Faith pools, political succession |
| Observation | Yes | Collapsed potential at observed node |
| Entity spawn/move/despawn | Yes | Entity position + state |
| Session start/end | Yes | Marker + party state |
| Player MF action | No | Too granular — receipts live in MF chain |

---

## Seas as Parallel Worlds

Seas and oceans are **not edges**. They are full parallel node trees — the Catan seafaring expansion model.

```
crystal_sphere          depth 0   (Realmspace)
  └── planet            depth 1   (Toril)
       ├── continent    depth 2   (Faerûn — surface)
       ├── continent    depth 2   (The Underdark — subterranean)
       ├── sea          depth 2   (Sea of Fallen Stars — inland sea)
       │    ├── region  depth 3   (Dragonmere, Vilhon Reach)
       │    │    └── port_settlement depth 4 (Westgate, Pros)
       │    └── region  depth 3   (Pirate Isles)
       │         └── settlement depth 4 (Immurk's Hold)
       ├── sea          depth 2   (Trackless Sea — open ocean)
       │    ├── region  depth 3   (Sword Coast shipping lanes)
       │    ├── region  depth 3   (Moonshae passage)
       │    └── region  depth 3   (Deep ocean — uncharted)
       └── sea          depth 2   (Great Sea — southern)
```

### Why Seas Are Node Trees

A sea has its own κ — weather (storms, doldrums, currents), ecology (krakens, sea monsters, merfolk), economy (fishing grounds, trade lanes, piracy), and factions (pirate leagues, merchant marine, naval powers). None of this inherits from surface Faerûn.

**Sea regions** have depth 3 — same as land regions. They get their own weather generation, their own ecology ticks, their own faction control.

**Port settlements** are hybrid — they exist at the boundary between land and sea node trees. A port's κ resolves via the **land** ancestry (it's a settlement on a continent), but it has **edges** to sea regions (shipping lanes).

### Sea-Specific κ

```typescript
// Additional weather fields for sea regions:
weather: {
  // ...standard fields...
  seaState: 'calm'|'choppy'|'rough'|'storm'|'hurricane'
  currentDirection: 'north'|'south'|'east'|'west'|'variable'
  currentStrength: number     // knots
}

// Sea ecology (replaces land ecology on sea nodes):
ecology: {
  fishDensity: number         // 0.0-1.0
  predatorLevel: number       // krakens, sea serpents
  dominantThreats: string[]   // ["pirate_fleet", "kraken", "sahuagin"]
}
```

### Sea Edges

Sea lanes connect ports and sea regions. Same edge schema as land routes but with `terrain: 'open_sea'|'coastal'|'river_mouth'|'strait'`. Ships are **entities** on sea edges — same as caravans on land edges.

---

## Population Migration Pressure

When a settlement can't support its population, people leave. Migration is an **entity on an edge**.

### Migration Triggers (monthly, L4 settlement tick)

```typescript
const pressure =
  (settlement.unrest * 0.3) +          // political instability
  (worklessRate * 0.4) +                // no jobs → leave
  (homelessRate * 0.2) +                // no housing → leave
  (ecology.dangerLevel * 0.1)           // monsters → leave

if (pressure > MIGRATION_THRESHOLD) {
  const migrants = Math.floor(settlement.population * pressure * 0.02)
  spawnEntity('migration', {
    type: 'on_edge', edgeId: bestRoute, mile: 0, direction: 'forward',
    population: migrants, origin: settlementId,
    destination: bestDestinationId,   // highest job surplus among connected hubs
  })
}
```

### Destination Selection

Migrants pick the best connected settlement: job surplus, safety, route safety, distance.

### On Arrival

Destination `settlement.population += migrants`. Origin population decreases. Some migrants fill `infrastructure.professions` gaps. If destination is over capacity → chain migration.

---

## Disease as Religion Burn

Disease is NOT a standalone module. It's a **settlement event** + **religion modifier**.

1. **Plague flag** set by settlement weekly event (d20 roll):
   `settlement.plague = { active: true, severity: number, startDay: worldDay }`

2. **Settlement effects** (while active): population loss, morale drop, unrest rise, commodity supply drop.

3. **Religion burn** (yearly tick): temples can't gather worshippers → `religion.faithPool` reduced. BUT healing deities gain faith from plague response. Can shift `religion.dominant`.

4. **Resolution:** natural burnout after `severity * 4` weeks, divine cure, or medicine knowledge seed.

---

## Trade Decision-Making — Caravan Spawning

Caravans spawn when profitable, despawn when not.

### Price Gap Detection (weekly, L2 market tick)

For each pair of connected settlements via trade edges:
```
profitMargin = destPrice - originPrice - transportCost - tollCost - riskPremium
if profitMargin > PROFIT_THRESHOLD → spawn caravan entity
```

### Caravan Lifecycle

Spawn → travel (daily mile advance) → encounters per segment → arrive (sell cargo) → return or despawn.

---

## Harptos Calendar

The Forgotten Realms Calendar of Harptos: 12 months × 30 days + 5 festival days = 365 days/year.

### Months

Hammer, Alturiak, Ches, Tarsakh, Mirtul, Kythorn, Flamerule, Eleasis, Eleint, Marpenoth, Uktar, Nightal.

### Festival Days (intercalated)

| After Month | Festival | worldDay % 365 |
|------------|---------|----------------|
| Hammer | Midwinter | 30 |
| Tarsakh | Greengrass | 121 |
| Kythorn | Midsummer (+Shieldmeet every 4yr) | 152 |
| Eleint | Highharvestide | 213 |
| Uktar | Feast of the Moon | 274 |

### Clockwork Integration

- Festivals trigger special yearly ticks: markets close, temples gather extra faith, factions hold ceremonies
- Seasons: Hammer-Ches = winter, Tarsakh-Kythorn = spring, Flamerule-Eleint = summer, Marpenoth-Nightal = autumn
- Holy days per deity → bonus `religion.faithPool` accumulation
- Shieldmeet (every 4 years) → truces, tournaments, diplomatic meetings
