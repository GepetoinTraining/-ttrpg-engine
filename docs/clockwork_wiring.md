# Clockwork Wiring Blueprint

**Purpose:** Wire the 28 isolated domain modules into the world simulation through the Clockwork/WorldTickEngine unification. This document is the implementation spec.

**Last audit:** 2026-03-12 — after agriculture, cooking, water, banking, entertainment, lore, warfare, religion, extraction additions.

## Current State

Two tick engines exist independently. Neither knows the other. Neither connects to the domain modules or the player tree.

| Engine | File | What It Does | What It's Missing |
|--------|------|-------------|-------------------|
| `clockwork.ts` | 5-layer dependency-ordered crank. Ticks `ISimulatedMM` instances. Weekly base tick. `crankTo()` + `observe()` + `observeNode()`. | Only `MM_settlement`, `MM_actor`, `MM_local_actor` registered. No cadence system. No daily/monthly/yearly. No `.tp` reference. |
| `world-tick.ts` | Cadence orchestrator. Daily base heartbeat. Fires `TickSystem` callbacks at daily/weekly/monthly/yearly + observation (hourly/slot/round). `addPlayerTick()`. | **53 placeholder strings** instead of real module calls. No dependency ordering. No `ISimulatedMM`. No `.tp` access. |

### The Player Tree (`mm-adventure.ts`)

- Maintains its own `worldDay` (line 120) and increments it manually in `endSession()` (line 237) and `resolveDowntime()` (line 348)
- Has NO reference to either tick engine
- Cannot crank forward, cannot observe, cannot feed player ticks back

### `.tp` Topology (`tp.ts`)

- Has `getNode()`, `resolve()`, `ancestry()`, `getAllNodes()` — all **read-only**
- Has `loadNodes()` — bulk load, not granular mutation
- **Missing:** `writeKappa(nodeId, path, value)` and `mutateNode(nodeId, data)` for tick systems to write κ

### `ISimulatedMM` (`mm-simulated.ts`)

- Interface: `accumulatePotential(days, worldDay)` / `resolve(worldDay)` — **no TP parameter**
- Base class: `SimulatedMMBase` — delegates to `onAccumulate()` / `onResolve()` — **no TP parameter**
- Only 3 implementations: `MMSettlement`, `MMActor`, `MMLocalActor`
- The 28 domain modules are NOT wrapped as `ISimulatedMM`

---

## Full System Audit — 53 Registered Tick Systems

### Status Key

| Symbol | Meaning |
|--------|---------|
| 🔴 | **Placeholder** — returns a string literal, no real logic |
| 🟡 | **Module exists** — real function exported but NOT wired |
| 🟢 | **Wired** — calls the real module (currently: NONE) |

### DAILY (6 systems)

| # | System ID | Real Module | Export Function | Status | κ Writes To |
|---|-----------|------------|-----------------|--------|-------------|
| 1 | `weather` | `weather.ts` | `generateWeather()` | 🟡 Module exists, placeholder tick | `weather.*` → region nodes |
| 2 | `npc_schedules` | `npc-agenda.ts` | No daily tick fn | 🔴 Placeholder | `npc.schedule` → hub nodes |
| 3 | `danger_accumulation` | `dungeon-gate.ts` | No daily tick fn | 🔴 Placeholder | `danger.level` → region nodes |
| 4 | `mf_pool_refill` | `mf-pool.ts` | Pool reset logic exists | 🔴 Placeholder | MF pool state |
| 5 | `rest_resolution` | — | No module | 🔴 Placeholder | character HP/spell slots |
| 6 | `water_level_tick` | `water.ts` | `updateWaterLevel()` | 🟡 Module exists, placeholder tick | `water.level`, `water.floodStage` → water body nodes |

### WEEKLY (19 systems)

| # | System ID | Real Module | Export Function | Status | κ Writes To |
|---|-----------|------------|-----------------|--------|-------------|
| 7 | `economy_prices` | `market.ts` | `weeklyMarketTick(market, d20)` | 🟡 Module exists, placeholder tick | `economy.prices` → settlement nodes |
| 8 | `economy_trade` | `caravan.ts` | Route/cargo logic, no tick fn | 🔴 Placeholder | edge `cargo`, `news` |
| 9 | `logistics` | `logistics.ts` | Shipment logic, no tick fn | 🔴 Placeholder | edge `shipment.progress` |
| 10 | `production` | `production-chain.ts` | Extraction/recipe logic, no tick fn | 🔴 Placeholder | `economy.commodities` |
| 11 | `settlement_events` | `mm-settlement.ts` | `accumulatePotential()` (ISimulatedMM, not TickSystem) | 🟡 Different interface | population, stability, unrest |
| 12 | `npc_actor_schemes` | `npc-agenda.ts` | Decision logic, no weekly tick fn | 🔴 Placeholder | `npc.scheme` → actor nodes |
| 13 | `exchange_rates` | `currency.ts` | Exchange logic, no tick fn | 🔴 Placeholder | `economy.exchange_rates` |
| 14 | `banking_interest` | `banking.ts` | Interest/fee logic, no tick fn | 🔴 Placeholder | `economy.accounts` |
| 15 | `loan_payments` | `banking.ts` | Loan logic, no tick fn | 🔴 Placeholder | `economy.loans` |
| 16 | `entertainment_revenue` | `entertainment.ts` | Revenue logic, no tick fn | 🔴 Placeholder | `culture.revenue` |
| 17 | `cultural_influence` | `entertainment.ts` | Cultural logic, no tick fn | 🔴 Placeholder | `culture.morale` → settlement nodes |
| 18 | `rumor_decay` | `lore.ts` | Rumor logic, no tick fn | 🔴 Placeholder | `lore.rumors` |
| 19 | `knowledge_flow` | `lore.ts` | Propagation logic, no tick fn | 🔴 Placeholder | `lore.books` → library nodes |
| 20 | `fishing_yield` | `agriculture.ts` | `calculateFisheryYield()` | 🟡 Module exists, placeholder tick | `economy.commodities` (fish) |
| 21 | `services_contracts` | `services.ts` | Contract logic, no tick fn | 🔴 Placeholder | `services.contracts` |
| 22 | `caravan_progress` | `caravan.ts` | Route logic, no tick fn | 🔴 Placeholder | edge `cargo.position` |
| 23 | `harvest_tick` | `agriculture.ts` | `harvestCrops()` implied | 🟡 Module exists, placeholder tick | `economy.commodities` (food) |
| 24 | `gathering_tick` | `agriculture.ts` | `calculateGatheringYield()` | 🟡 Module exists, placeholder tick | `economy.commodities` (herbs) |
| 25 | `extraction_output` | `agriculture.ts` | Extraction industry data | 🟡 Module exists, placeholder tick | `economy.commodities` (timber, stone, etc.) |

### MONTHLY (14 systems)

| # | System ID | Real Module | Export Function | Status | κ Writes To |
|---|-----------|------------|-----------------|--------|-------------|
| 26 | `faction_schemes` | `faction.ts` | Loyalty/territory logic, no tick fn | 🔴 Placeholder | `faction.control`, `faction.law` |
| 27 | `infrastructure` | `infrastructure-mm.ts` | Profession/guild logic, no tick fn | 🔴 Placeholder | `professions`, `knowledge.tier` |
| 28 | `ecology` | `monster-actor.ts` | Monthly expansion logic, no tick fn | 🔴 Placeholder | monster `population`, `range` |
| 29 | `population_growth` | `mm-settlement.ts` | In `onResolve()` | 🟡 Different interface | population |
| 30 | `guild_operations` | `guild.ts` | Chapter/job logic, no tick fn | 🔴 Placeholder | `guild.jobs`, `guild.intel` |
| 31 | `npc_needs` | `npc-agenda.ts` | Maslow needs logic, no tick fn | 🔴 Placeholder | `npc.needs` |
| 32 | `army_readiness` | `warfare.ts` | Readiness logic, no tick fn | 🔴 Placeholder | `faction.military.readiness` |
| 33 | `influence_overlay` | `warfare.ts` | Influence overlay logic, no tick fn | 🔴 Placeholder | `faction.influence` → territory nodes |
| 34 | `army_upkeep` | `warfare.ts` | Upkeep logic, no tick fn | 🔴 Placeholder | `faction.military.upkeep` |
| 35 | `spy_reports` | `intelligence.ts` | Spy mission logic, no tick fn | 🔴 Placeholder | `intel.reports` |
| 36 | `diplomatic_drift` | `intelligence.ts` | Diplomatic logic, no tick fn | 🔴 Placeholder | `diplomacy.standing` |
| 37 | `research_progress` | `lore.ts` | Research logic, no tick fn | 🔴 Placeholder | `lore.research` → library nodes |
| 38 | `tax_in_kind` | `agriculture.ts` | `collectTaxInKind()` | 🟡 Module exists, placeholder tick | granary, army, market |
| 39 | `food_variety` | `cooking.ts` | `calculateFoodVariety()` | 🟡 Module exists, placeholder tick | morale modifier |

### YEARLY (5 systems)

| # | System ID | Real Module | Export Function | Status | κ Writes To |
|---|-----------|------------|-----------------|--------|-------------|
| 40 | `seasons` | `weather.ts` | `getSeason(worldDay)` | 🟡 Module exists, placeholder tick | `weather.season` → region nodes |
| 41 | `kingdom_politics` | `faction.ts` | No yearly tick fn | 🔴 Placeholder | `faction.politics` |
| 42 | `great_events` | — | No module | 🔴 Placeholder | global events |
| 43 | `faith_accrual` | `religion.ts` | Faith logic, no tick fn | 🔴 Placeholder | `religion.faith_pool` |
| 44 | `pantheon_tick` | `religion.ts` | Pantheon logic, no tick fn | 🔴 Placeholder | `deity.power_tier` |

### OBSERVATION — Hourly (3 systems)

| # | System ID | Real Module | Status |
|---|-----------|------------|--------|
| 45 | `obs_npc_movement` | `npc-agenda.ts` | 🔴 Placeholder |
| 46 | `obs_market_update` | `market.ts` | 🔴 Placeholder |
| 47 | `obs_encounter_check` | — | 🔴 Placeholder |

### OBSERVATION — Slot / 5 min (3 systems)

| # | System ID | Real Module | Status |
|---|-----------|------------|--------|
| 48 | `obs_dungeon_state` | `dungeon-interior.ts` | 🔴 Placeholder |
| 49 | `obs_exploration` | — | 🔴 Placeholder |
| 50 | `obs_lair_actions` | — | 🔴 Placeholder |

### OBSERVATION — Round / 6 sec (3 systems)

| # | System ID | Real Module | Status |
|---|-----------|------------|--------|
| 51 | `obs_combat` | `mm-combat.ts` | 🔴 Placeholder |
| 52 | `obs_conditions` | — | 🔴 Placeholder |
| 53 | `obs_concentration` | — | 🔴 Placeholder |

---

## Scorecard

| Category | Count | 🟢 Wired | 🟡 Module Exists | 🔴 Placeholder |
|----------|-------|---------|------------------|----------------|
| Daily | 6 | 0 | 2 | 4 |
| Weekly | 19 | 0 | 7 | 12 |
| Monthly | 14 | 0 | 2 | 12 |
| Yearly | 5 | 0 | 1 | 4 |
| Obs: Hourly | 3 | 0 | 0 | 3 |
| Obs: Slot | 3 | 0 | 0 | 3 |
| Obs: Round | 3 | 0 | 0 | 3 |
| **TOTAL** | **53** | **0** | **12** | **41** |

**Zero systems are wired.** 12 have real modules with exported functions. 41 are pure placeholder strings.

---

## Architecture Target

```
                    ┌─────────────────────────────┐
                    │     UNIFIED CLOCKWORK        │
                    │  (clockwork.ts + world-tick)  │
                    │                               │
                    │  Cadence: daily base heartbeat │
                    │  Layers: 5 dependency-ordered  │
                    │  ISimulatedMM for all domains  │
                    │  Observation ticks on demand    │
                    │  Player tick accumulation       │
                    │  .tp read/write per tick        │
                    └──────────────┬────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
     ┌────────▼────────┐  ┌───────▼────────┐  ┌────────▼────────┐
     │  WORLD TREE      │  │  PLAYER TREE   │  │  .tp            │
     │  (domain MMs)    │  │  (adventure)   │  │  (world graph)  │
     │                  │  │                │  │                  │
     │  L0: economy     │  │  reads worldDay│  │  κ written by   │
     │  L1: faction     │  │  crankTo()     │  │  domain ticks   │
     │  L2: settlement  │  │  observeNode() │  │  κ read by      │
     │  L3: ecology     │  │  addPlayerTick │  │  resolve()      │
     │  L4: hub         │  │                │  │                  │
     └─────────────────┘  └────────────────┘  └──────────────────┘
```

### Why Players Never Catch Up

The world simulation is ALWAYS ahead. Parties lag behind the server's `worldDay`. This is correct and intentional:

- **Fast travel is free.** The simulation already ran those days. Party arrives at current world state. Zero computation on travel.
- **Sessions advance party time by ~1-3 days.** World advanced by 1 real day per real day.
- **Downtime bridges some gap** but never closes it.
- **The gap IS the feature.** When the party arrives somewhere, the world has ALREADY CHANGED since they last saw it. Trade routes ran, factions schemed, monsters bred, prices shifted, NPCs made decisions — all without the party.

```
WORLD:  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ Day 67
PARTY:  ━━━━━━━━━━━━━━━━━━━━━▶ Day 49
                               Gap = 18 days (already simulated)
                               Fast travel to Waterdeep? FREE.
                               World already ran those 18 days.
```

## Bridge 1: Unify WorldTickEngine into Clockwork

### What Changes

Clockwork absorbs WorldTickEngine's cadence system. The result is one engine with:
- **Daily base heartbeat** (from WorldTickEngine)
- **5 dependency-ordered layers** (from Clockwork)
- **Multi-cadence firing** (daily/weekly/monthly/yearly delta counting from WorldTickEngine)
- **Observation ticks** (hourly/slot/round, player-triggered, from WorldTickEngine)
- **Player tick accumulation** (from WorldTickEngine)
- **`ISimulatedMM` interface** for all domain modules (from Clockwork)
- **`.tp` reference** passed to tick functions so they can read/write κ

### Signature Changes

Current `ISimulatedMM.accumulatePotential`:
```typescript
accumulatePotential(days: number, worldDay: number): void
```

Needs to become:
```typescript
accumulatePotential(days: number, worldDay: number, tp: TP): void
```

Current `ISimulatedMM.resolve`:
```typescript
resolve(worldDay: number): ResolveResult
```

Needs to become:
```typescript
resolve(worldDay: number, tp: TP): ResolveResult
```

This lets every domain MM read κ from and write κ to `.tp` nodes during both accumulation and resolution.

### Cadence Integration

Current `TickSystem.tick` signature:
```typescript
tick: (worldDay: number, delta: number) => string
```

This gets replaced entirely. Domain modules implement `ISimulatedMM` instead. The cadence logic (delta counting for weekly/monthly/yearly) moves into Clockwork itself:

```typescript
// Inside Clockwork
interface CadenceConfig {
  /** Which cadence this MM fires at */
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** Does this MM only fire on player observation? */
  observationOnly: boolean
}
```

Each registered `ISimulatedMM` gets a cadence tag. On `dailyTick()`:
1. ALL daily MMs accumulate
2. Increment weekly/monthly/yearly deltas
3. If weekly delta >= 7, fire all weekly MMs, reset delta
4. If monthly delta >= 30, fire all monthly MMs, reset delta
5. If yearly delta >= 360, fire all yearly MMs, reset delta

Observation MMs (hourly/slot/round) only fire via `observeNode()`.

### Player Tick Accumulation

Keep `addPlayerTick()` from WorldTickEngine. Player math ticks (rolls, checks, actions) contribute to the world's richness:
```typescript
// On player action (roll, check, combat turn)
clockwork.addPlayerTick(1)

// During daily tick, playerTicksToday feeds into settlement vitality
// More players = more detail in the world
// Solo player = world still ticks daily
// 20 active players = world gets richer NPC schedules, more market events
```

### File Changes

- `clockwork.ts` — absorb cadence system, add `.tp` to signatures, add cadence tags to registration, add `addPlayerTick()`, add observation tick methods
- `world-tick.ts` — becomes a re-export or thin wrapper around Clockwork for backward compatibility, OR gets deleted entirely (prefer deletion, less confusion)
- `mm-simulated.ts` — add `tp: TP` param to `accumulatePotential` and `resolve` signatures

## Bridge 2: Domain Modules → ISimulatedMM Adapters

Each domain module needs a thin `ISimulatedMM` wrapper that:
1. Extends `SimulatedMMBase`
2. Implements `onAccumulate()` — calls the module's cheap delta logic
3. Implements `onResolve()` — calls the module's expensive resolution logic
4. Registers into the correct Clockwork layer

### Layer Assignment

```
Layer 0 — ECONOMY (global, reads trade routes)
  ├── production-chain.ts  → weekly: extraction output, recipe processing
  ├── market.ts            → weekly: price discovery, merchant decisions
  ├── banking.ts           → weekly: interest, fees, loan payments
  ├── currency.ts          → weekly: exchange rate shifts
  └── caravan.ts           → weekly: route progress, cargo, encounters

Layer 1 — FACTION (reads economy for interventions)
  ├── faction.ts           → monthly: schemes, territory, loyalty
  ├── warfare.ts           → monthly: army readiness, influence overlay, upkeep
  └── intelligence.ts      → monthly: spy reports, diplomatic drift

Layer 2 — SETTLEMENT (reads economy + faction)
  ├── mm-settlement.ts     → weekly: population, stability, events (ALREADY ISimulatedMM ✓)
  ├── infrastructure-mm.ts → monthly: professions, guilds, tier advancement
  ├── knowledge-pool.ts    → monthly: seeds, potentials, resonance, tier
  └── social.ts            → monthly: contracts, households, titles

Layer 3 — ECOLOGY (reads settlement)
  ├── monster-actor.ts     → monthly: d20+CR+tenure, expansion, migration
  ├── dungeon-gate.ts      → weekly: spawn, overflow, cap, respawn
  └── guild.ts             → weekly: chapters, NPC parties, jobs, intel

Layer 4 — HUB (reads settlement + ecology)
  ├── weather.ts           → daily: severity; weekly: full generation + κ write
  ├── water.ts             → daily: levels; weekly: fishing yields
  ├── npc-agenda.ts        → daily: schedules; monthly: needs evaluation
  ├── agriculture.ts       → weekly: harvest, gathering; monthly: tax-in-kind
  ├── cooking.ts           → monthly: food variety + morale
  ├── entertainment.ts     → weekly: revenue, cultural influence
  ├── lore.ts              → weekly: rumor decay, knowledge flow; monthly: research
  ├── services.ts          → weekly: contract renewal
  ├── religion.ts          → yearly: faith accrual, pantheon tick
  └── narrative.ts         → per-session: arc/quest/beat pacing
```

### Adapter Pattern

For each domain module, create a wrapper. Example for weather:

```typescript
// In weather.ts or a new file weather-mm.ts
import { SimulatedMMBase } from './mm-simulated.js'
import { weeklyWeatherTick, type Climate } from './weather.js'
import { type TP } from './tp.js'

export class MMWeather extends SimulatedMMBase {
  private climate: Climate
  private lastWeather: WeatherState | null = null

  constructor(nodeId: string, climate: Climate, worldDay: number = 0) {
    super(`weather:${nodeId}`, `Weather:${nodeId}`, nodeId, 'weather', worldDay)
    this.climate = climate
  }

  protected onAccumulate(days: number, worldDay: number): void {
    // O(1) — just count days, weather resolves on observation
    this.state.pendingPotential.deltas['daysPending'] =
      (this.state.pendingPotential.deltas['daysPending'] ?? 0) + days
  }

  protected onResolve(daysResolved: number, worldDay: number, tp: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // Generate weather for the resolved period
    const result = weeklyWeatherTick(this.climate, worldDay)
    this.lastWeather = result.weather

    // Write κ to .tp node
    // tp.writeKappa(this.state.nodeId, result.kappaOverrides)

    return {
      stateChanges: {
        temperature: result.weather.temperature,
        severity: result.weather.severity,
      },
      narrative: `Weather: ${result.weather.precipitation}, ${result.weather.temperature}°F, ${result.weather.wind} wind`,
      additionalEvents: [],
    }
  }

  protected getDomainState() {
    return { climate: this.climate, lastWeather: this.lastWeather }
  }
}
```

### What Each Module Already Exports (tick functions to wrap)

| Module | Existing Tick Function | Cadence | κ Writes |
|--------|----------------------|---------|----------|
| `weather.ts` | `weeklyWeatherTick(climate, worldDay, d100)` | weekly | `weather.*` (season, temp, precip, severity, modifiers) |
| `weather.ts` | `generateWeather(climate, worldDay, d100)` | daily | `weather.*` (per-day state) |
| `weather.ts` | `getSeason(worldDay)` | yearly | `weather.season` |
| `market.ts` | `weeklyMarketTick(market, d20)` | weekly | `economy.prices`, merchant decisions |
| `market.ts` | `discoverPrice(...)` | on-demand | individual commodity prices |
| `market.ts` | `simulateMerchantDecision(...)` | weekly | merchant AI state |
| `water.ts` | `updateWaterLevel(waterBody, ...)` | daily | `water.level`, `water.floodStage` |
| `water.ts` | `floodDamageToSettlement(floodStage)` | on-event | morale, crop, building damage |
| `water.ts` | `getFloodStage(waterLevel)` | daily | flood classification |
| `agriculture.ts` | `calculateFisheryYield(type, ...)` | weekly | fish commodity output |
| `agriculture.ts` | `calculateGatheringYield(type, ...)` | weekly | herb/ingredient output |
| `agriculture.ts` | `collectTaxInKind(...)` | monthly | granary/army/market grain |
| `agriculture.ts` | `calculateFoodVariety(sources)` | monthly | food variety score → morale |
| `cooking.ts` | `calculateMealQuality(...)` | on-demand | meal quality per cooking event |
| `cooking.ts` | `calculateHubFoodMorale(...)` | monthly | settlement morale from food |
| `production-chain.ts` | extraction / recipe data | weekly | commodity output quantities |
| `banking.ts` | interest / loan data | weekly | account balances, defaults |
| `currency.ts` | exchange rate data | weekly | exchange rates |
| `caravan.ts` | route / cargo data | weekly | cargo position, encounters |
| `faction.ts` | loyalty / territory data | monthly | faction control, law |
| `warfare.ts` | army / influence data | monthly | military readiness, influence |
| `intelligence.ts` | spy / diplomatic data | monthly | intel reports, standings |
| `guild.ts` | chapter / job data | weekly | guild jobs, intel |
| `npc-agenda.ts` | needs / decision data | daily/monthly | NPC disposition, economy |
| `lore.ts` | rumor / knowledge data | weekly/monthly | rumor fidelity, book propagation |
| `entertainment.ts` | performance / cultural data | weekly | cultural score, revenue |
| `services.ts` | contract data | weekly | service contracts |
| `religion.ts` | faith / pantheon data | yearly | faith pools, deity tiers |
| `monster-actor.ts` | expansion / migration data | monthly | monster population, range |
| `dungeon-gate.ts` | spawn / overflow data | weekly | dungeon danger radius |
| `knowledge-pool.ts` | resonance / tier data | monthly | knowledge tier, professions |
| `social.ts` | contract / household data | monthly | social standing, territory |
| `mm-settlement.ts` | `accumulatePotential()` / `resolve()` | weekly | population, stability, unrest ✓ |
| `mm-actor.ts` | `accumulatePotential()` / `resolve()` | varies | actor state ✓ |
| `mm-local-actor.ts` | `accumulatePotential()` / `resolve()` | varies | local actor state ✓ |

## Bridge 3: MMAdventure ↔ Clockwork

### What Changes in `mm-adventure.ts`

1. **Remove `private worldDay = 1`** — Read from Clockwork instead
2. **Constructor takes a `Clockwork` reference**
3. **`startSession()` calls `clockwork.crankTo(serverWorldDay)`** then `clockwork.observeNode(partyNodeId)` to collapse accumulated potential at the party's location
4. **`endSession()` advances party's session time** but does NOT touch Clockwork's worldDay (the world is always ahead)
5. **Player actions during session** call `clockwork.addPlayerTick()`
6. **`getWorldDay()`** returns Clockwork's canonical worldDay
7. **Add `getPartyDay()`** — the party's local time (always behind world)

### The Two Times

```typescript
class MMAdventure {
  private clockwork: Clockwork        // THE canonical world time
  private partyDay: number = 1        // Party's local time (always <= clockwork.worldDay)

  getWorldDay(): number {
    return this.clockwork.worldDay    // Server truth
  }

  getPartyDay(): number {
    return this.partyDay              // Party's experienced time
  }

  getGap(): number {
    return this.clockwork.worldDay - this.partyDay
  }

  startSession(): MMSession {
    // Party is behind. Crank to current world time?
    // NO — the world already ran. Just read the current state.
    // The party observes whatever node they're at.
    const partyNodeId = this.party.getCurrentNodeId()
    const observations = this.clockwork.observeNode(partyNodeId)
    // observations contains: what changed since party last visited
    // weather shifted, prices moved, NPCs made decisions, etc.
    // This is what creates the "living world" feeling
    // ...
  }

  endSession(worldDaysDuration: number = 1): SessionRecord {
    this.partyDay += worldDaysDuration  // Party advanced by 1-3 days
    // clockwork.worldDay is UNCHANGED — it ticks on the server clock
    // Gap may shrink slightly but never closes
    // ...
  }

  fastTravel(destinationNodeId: string): void {
    // Party jumps to current world state at destination
    // NO computation — world already simulated
    const observations = this.clockwork.observeNode(destinationNodeId)
    // Party sees destination as it IS now, not as it was when they left
    this.party.moveTo(destinationNodeId)
    // partyDay += travelDays (time passes for party too)
  }
}
```

## .tp κ Read/Write Pattern

Every domain tick needs to read and write κ on `.tp` nodes. Currently `.tp` has `resolve()` (read) and `loadNodes()` (write entire nodes) but no granular κ write.

### Needed: `tp.writeKappa(nodeId, overrides)`

```typescript
// In tp.ts — add this method
writeKappa(nodeId: string, overrides: Record<string, unknown>): void {
  const node = this.nodes.get(nodeId)
  if (!node) return
  for (const [key, value] of Object.entries(overrides)) {
    // Dot-path write: 'weather.temperature' → node.dataStatic.weather.temperature
    setByDotPath(node.dataStatic, key, value)
  }
}
```

This is how domain ticks mutate the world:
- Weather writes `weather.severity`, `weather.temperature` → region nodes
- Market writes `economy.prices` → settlement nodes
- Faction writes `faction.control` → territory nodes
- Ecology writes `ecology.population` → region nodes
- NPC agenda writes `npc.disposition` → hub nodes

The κ merge walk (`tp.resolve()`) then reads these values with child-overrides-parent. A district can override settlement-level prices. A building can override district-level law enforcement.

## Implementation Order

### Phase 1: Foundation
1. Add `writeKappa(nodeId, overrides)` to `tp.ts`
2. Add `tp: TP` parameter to `ISimulatedMM.accumulatePotential()` and `resolve()` in `mm-simulated.ts`
3. Update `SimulatedMMBase` accordingly
4. Update `mm-settlement.ts`, `mm-actor.ts`, `mm-local-actor.ts` (the 3 existing ISimulatedMM implementations) to accept TP

### Phase 2: Unify Tick Engines
5. Add cadence system to `clockwork.ts` (daily/weekly/monthly/yearly delta counting)
6. Add observation tick methods to `clockwork.ts` (hourly/slot/round)
7. Add `addPlayerTick()` to `clockwork.ts`
8. Add `.tp` reference to `Clockwork` constructor
9. Delete or deprecate `world-tick.ts` (Clockwork now does everything)

### Phase 3: Wire Domain Modules (Layer by Layer)
10. **Layer 0 — Economy:** Wrap `production-chain.ts`, `market.ts`, `banking.ts`, `currency.ts`, `caravan.ts`
11. **Layer 1 — Faction:** Wrap `faction.ts`, `warfare.ts`, `intelligence.ts`
12. **Layer 2 — Settlement:** `mm-settlement.ts` already done. Wrap `infrastructure-mm.ts`, `knowledge-pool.ts`, `social.ts`
13. **Layer 3 — Ecology:** Wrap `monster-actor.ts`, `dungeon-gate.ts`, `guild.ts`
14. **Layer 4 — Hub:** Wrap `weather.ts`, `water.ts`, `npc-agenda.ts`, `agriculture.ts`, `cooking.ts`, `entertainment.ts`, `lore.ts`, `services.ts`, `religion.ts`

### Phase 4: Player Tree Bridge
15. Refactor `MMAdventure` to take `Clockwork` reference
16. Replace `worldDay` with `partyDay` (always behind `clockwork.worldDay`)
17. Wire `startSession()` → `clockwork.observeNode(partyNodeId)`
18. Wire player actions → `clockwork.addPlayerTick()`
19. Implement `fastTravel()` — observe destination, zero computation

### Phase 5: Cross-System Edges
20. Wire `system-edges.ts` into the tick cycle:
    - Ecology → Husbandry (monster predation reduces herds)
    - Social → Faction (contract loyalty flows)
    - Knowledge → Magic (DC reduction from research)
    - Guild Intel → Faction (intel network reports)
    - Dungeon → Knowledge (cleared dungeons seed knowledge)
    - Follower → Combat (NPC profiles feed pocket manifolds)

## Test Strategy

Each phase should maintain the existing 1179 tests passing. New tests per phase:

- **Phase 1:** `tp.writeKappa()` tests, updated `mm-settlement`/`mm-actor`/`mm-local-actor` tests with TP
- **Phase 2:** Unified clockwork cadence tests (daily fires, weekly fires at delta 7, monthly at 30, yearly at 360), observation tick tests, player tick tests
- **Phase 3:** Per-module: register into clockwork, tick N times, verify pending potential, observe, verify κ written to .tp
- **Phase 4:** Adventure integration: start session → observe → session plays → end session → verify partyDay < worldDay, fast travel → verify zero-cost observation
- **Phase 5:** Cross-system: ecology tick → husbandry herd reduction, cleared dungeon → knowledge seed deposit

## File Reference

All files live in `engine/`. Paths relative to `D:\-ttrpg-engine\engine\`.

### Core (modify)
- `clockwork.ts` — absorb cadence, add TP, add observation
- `mm-simulated.ts` — add TP to signatures
- `mm-settlement.ts` — update to new signatures (already ISimulatedMM)
- `mm-actor.ts` — update to new signatures (already ISimulatedMM)
- `mm-local-actor.ts` — update to new signatures (already ISimulatedMM)
- `tp.ts` — add `writeKappa()`
- `mm-adventure.ts` — take Clockwork ref, partyDay vs worldDay

### Domain (wrap as ISimulatedMM)
- `weather.ts`, `water.ts`, `market.ts`, `production-chain.ts`, `banking.ts`, `currency.ts`, `caravan.ts`, `faction.ts`, `warfare.ts`, `intelligence.ts`, `knowledge-pool.ts`, `social.ts`, `agriculture.ts`, `cooking.ts`, `entertainment.ts`, `lore.ts`, `services.ts`, `religion.ts`, `npc-agenda.ts`, `guild.ts`, `monster-actor.ts`, `dungeon-gate.ts`, `narrative.ts`

### Delete or Deprecate
- `world-tick.ts` — replaced by unified Clockwork

### Reference Docs
- `docs/mm_topology.md` — MM ↔ .tp interaction diagrams
- `docs/mm_cycles.md` — tick ratios, why players are always behind
- `docs/mf_simulation.md` — potential compute pattern (grind/pool/select)
- `docs/tp_mapping.md` — what κ each module reads/writes
- `docs/mm_nesting.md` — complete hierarchy, what's built, tick rates
