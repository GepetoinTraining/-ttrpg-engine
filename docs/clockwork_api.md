# Clockwork API — What Gets Called When

**Purpose:** Maps every tick system to its exact function calls, .tp reads, .tp writes, and .tpb entries. This is the wiring spec that connects `clockwork_wiring.md` (the engine) to `tp_schema.md` (the schema). Claude IDE uses this to implement each system.

**Companion docs:**
- `clockwork_wiring.md` — engine architecture, unification plan, adapter pattern
- `tp_schema.md` — complete κ domain shapes, node/edge/entity ontology

---

## Cascade Map: Rain Falls → What Happens

Weather is L0 for a reason. One `precipitation: 'heavy_rain'` write cascades through every layer. This is the proof that the layer order is correct — every downstream reader sees fresh data.

### The Weather Write (L0, weekly)

`weather.ts:weeklyWeatherTick()` generates weather and writes **12 κ properties** to the region node:

```
tp.writeKappa(regionId, {
  'weather.precipitation':         'heavy_rain',
  'weather.temperature':           62,
  'weather.wind':                  'moderate',
  'weather.visibility':            'poor',
  'weather.severity':              0.55,
  'weather.season':                'spring',
  'weather.yield_modifier':        0.7,      // severity 0.55 → reduced yield
  'weather.travel_speed':          0.6,      // heavy_rain → 60% speed
  'weather.monster_activity':      0.5,      // severity 0.55 → monsters hide
  'weather.spoilage_rate':         1.2,      // rain + moderate temp → faster spoilage
  'weather.starvation_modifier':   0,        // temp fine, not blizzard
  'weather.combat_effects':        ['fire_resistance', 'perception_disadvantage'],
})
```

### The Cascade — Layer by Layer

```
L0 WEATHER WRITES κ
│
├──→ L0 WATER (daily, reads precipitation)
│    │ rainfall = heavy_rain → contribution = 3 × 5 = +15% water level
│    │ If water body was already at 135 (watch):
│    │   135 + 15 = 150 → floodStage: 'warning'
│    │
│    └──→ FLOOD DAMAGE (if warning/flood/catastrophic)
│         │ moralePenalty: -3
│         │ cropDamage: 0.15 (15% of crops destroyed)
│         │ buildingDamage: 0.05
│         │ displacedPopulation: 0.05 (5% displaced)
│         │ tradeDisrupted: false (warning, not flood yet)
│         │
│         └──→ writes to settlement κ:
│              settlement.morale -= 3
│              economy.commodities.grain.supply *= 0.85
│              infrastructure.buildings.* condition degrades
│              settlement.population -= displaced
│
├──→ L1 EXTRACTION (weekly, reads yield_modifier)
│    │ agriculture.calculateHarvest():
│    │   baseYield × 0.7 (weather penalty) = 30% less grain
│    │   PLUS flood cropDamage: another 15% gone
│    │   Net: ~40% reduction in food supply this week
│    │
│    │ agriculture.calculateFisheryYield():
│    │   Flooding CAN increase fish temporarily (overflow brings fish upstream)
│    │
│    │ agriculture.calculateGatheringYield():
│    │   Herbs thrive in rain → gathering yield slightly UP
│    │   (yieldModifier applies to crops, not wild gathering)
│    │
│    └── husbandry.weeklyYield():
│         starvationModifier: 0 (not cold enough)
│         But if flooding displaces herds → emergency slaughter or loss
│         writes: economy.commodities.meat.supply (reduced if displacement)
│
├──→ L2 ECONOMY (weekly, reads commodities + travel_speed)
│    │ market.weeklyMarketTick():
│    │   grain.supply DOWN 40% → grain.price UP (supply/demand)
│    │   fish.supply slightly up → fish.price stable
│    │   Commodity trends shift: grain 'rising', meat 'rising'
│    │
│    │ caravan entities:
│    │   effectiveSpeed = baseSpeed × 0.6 (heavy_rain travel penalty)
│    │   Caravans take 67% LONGER to reach destination
│    │   spoilageMultiplier: 1.2 → perishable cargo spoils 20% faster
│    │   Spoiled cargo = lost supply at destination
│    │
│    │ logistics.tickShipment():
│    │   Same travel penalty. Shipments delayed.
│    │
│    └── currency.ts:
│         Trade volume drops (fewer caravans arriving) → exchange rate shift
│
├──→ L3 FACTION (monthly, reads economy)
│    │ faction.tickFaction():
│    │   Faction revenue from controlled territory DOWN (less trade tax)
│    │   If grain crisis persists → faction stability check
│    │
│    │ warfare.ts:
│    │   Army morale affected by supply shortage
│    │   weatherModifier: 0.6 → combat disadvantage if battle happens
│    │
│    └── intelligence.ts:
│         Spy operations unaffected by rain (but travel to target slowed)
│
├──→ L4 SETTLEMENT (weekly, reads economy + faction)
│    │ mm-settlement.onResolve():
│    │   morale: DOWN (flood penalty + grain price spike)
│    │   unrest: UP (food shortage + displaced population)
│    │   stability: DOWN (cascade from above)
│    │   growthRate: negative if food shortage persists
│    │
│    │ infrastructure-mm.tickInfrastructure():
│    │   Building damage from flood → repair queue
│    │   Workshops near river may be damaged
│    │
│    │ social.ts:
│    │   Contract enforcement harder during crisis
│    │   Breached contracts UP (merchants can't deliver)
│    │
│    └── knowledge-pool.tickKnowledgePool():
│         Library damage if flooding reaches buildings
│         Research speed: slower (scholars dealing with crisis)
│
├──→ L5 ECOLOGY (monthly, reads settlement)
│    │ monster-actor.tickMonsterAdvancement():
│    │   monsterActivityMultiplier: 0.5 → monsters HIDE during storms
│    │   But displaced wildlife from flooding → new encounters elsewhere
│    │   ecology.dangerLevel may shift (predators pushed to new areas)
│    │
│    │ dungeon-gate.tickDungeonGate():
│    │   Flooding can INCREASE dungeon danger (water drives creatures UP)
│    │   Gate overflow accelerated if dungeon floods
│    │
│    └── guild.tickGuildChapter():
│         Monster sightings DOWN (hiding) but displaced creature reports UP
│         Bounty board shifts
│
└──→ L6 HUB SERVICES (reads everything)
     │ npc-agenda.tickAgenda():
     │   Safety need: UP (flooding + displaced people)
     │   Economic need: UP (grain prices spiking)
     │   NPCs with craft occupations: output DOWN (workshops damaged)
     │   NPCs may change goals: "find food" priority rises
     │
     │ cooking.calculateHubFoodMorale():
     │   grain supply DOWN → food variety DOWN → morale penalty compounds
     │
     │ entertainment.ts:
     │   Revenue DOWN (people worried about flooding, not entertainment)
     │
     │ lore.ts:
     │   Rumor generation: "The river is flooding!" spreads along trade routes
     │   Knowledge flow disrupted (trade routes slowed)
     │
     └── services.ts:
          Contract fulfillment disrupted (can't deliver in flood)
```

### The Numbers: One Week of Heavy Rain

Starting from a healthy settlement (pop 5000, morale 80, unrest 10, stability 70):

| Metric | Before | After 1 Week Heavy Rain | Delta | Source |
|--------|--------|------------------------|-------|--------|
| Water level | 120 (normal) | 155 (warning) | +35 | rain × 5/day × 7 |
| Grain supply | 100 | 60 | -40% | yield × 0.7 + flood cropDamage 15% |
| Grain price | 2gp | 3.2gp | +60% | supply/demand |
| Caravan speed | 100% | 60% | -40% | travel_speed modifier |
| Morale | 80 | 71 | -9 | flood(-3) + food(-3) + price(-3) |
| Unrest | 10 | 18 | +8 | food shortage + displacement |
| Stability | 70 | 64 | -6 | morale drop + unrest rise |
| Monster activity | 1.0× | 0.5× | -50% | severity 0.55 |
| Population | 5000 | 4750 | -250 | 5% displacement |
| Buildings | good | 5% damaged | -5% | flood building damage |

### If Rain Persists (3+ Weeks)

The cascade **compounds**:
- Water hits 200+ → `catastrophic` flood stage
- Crop damage reaches 50%+ → famine conditions
- Population migration triggers (unrest × 0.3 + workless × 0.4 > threshold)
- Factions may intervene (send grain caravans, but THEY'RE slow too)
- Monster displacement → secondary danger as creatures flee flooding
- Trade routes effectively blocked → price spirals in isolated settlements
- Religion: if temple floods → faith output drops → plague vulnerability rises

### Drought Is The Mirror

`precipitation: 'none'` for 4+ weeks:
- Water level drops → `drought` stage
- Navigation blocked (too shallow) → trade disrupted
- Crop damage: 30% from drought
- Fire risk UP (temperature-driven)
- Monster activity: UP (mild weather = 1.3×)
- Wells dry up → `water.sources.*.level` → 0

---

## How the Clockwork Fires

```
clockwork.dailyTick()
│
├── Phase 1: Fire ALL daily MMs (L0→L6 order)
│     for each layer 0..6:
│       for each MM where cadence='daily' && !observationOnly:
│         mm.accumulatePotential(1, worldDay, tp)
│
├── Phase 2: Increment deltas (weekly++, monthly++, yearly++)
│
├── Phase 3: Fire cadence thresholds
│     if weeklyDelta >= 7:
│       for each layer 0..6:
│         for each MM where cadence='weekly' && !observationOnly:
│           mm.accumulatePotential(weeklyDelta, worldDay, tp)
│       reset weeklyDelta = 0
│
│     if monthlyDelta >= 30:  (same pattern, cadence='monthly')
│     if yearlyDelta >= 360:  (same pattern, cadence='yearly')
│
└── Phase 4: Consume playerTicksToday → totalPlayerTicks
```

### Observation (Party Arrives)

```
clockwork.observeNode(nodeId)
│
└── for each layer 0..6:
      for each MM where mm.state.nodeId === nodeId && pendingDays > 0:
        mm.resolve(worldDay, tp)
          → onResolve() fires
          → writes κ to .tp via tp.writeKappa()
          → returns ResolveResult { stateChanges, narrative, events }
```

### The Two-Phase Pattern

**accumulate** = cheap O(1). Count days. No side effects. No .tp writes.
**resolve** = expensive. Reads κ, generates results, writes κ back. Only on observation OR explicit resolve.

For world-clock cadence systems (weather, economy, etc.), `accumulatePotential` fires every cadence tick but `resolve` only fires on observation. This means the world "knows" N days have passed but doesn't compute the result until someone looks.

**Exception:** Some systems write κ directly during accumulate (weather must write κ even when nobody's looking, because other systems read it). These are marked with `WRITES ON ACCUMULATE` below.

---

## Layer 0 — PHYSICAL

Zero dependencies. Pure world generation. Other layers read these outputs.

### `weather` — Daily accumulate, Weekly resolve

**Module:** `weather.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| accumulate (daily) | `onAccumulate` | `(days: 1, worldDay, tp)` |
| resolve (weekly or observe) | `generateWeather()` | `(climate, worldDay, d100) → WeatherResult` |
| resolve (yearly) | `getSeason()` | `(worldDay) → Season` |

**.tp READS:**
```
tp.resolve(regionNodeId).weather.climate     → climate zone for generation
```

**.tp WRITES ON ACCUMULATE:** (other systems need weather daily)
```
tp.writeKappa(regionNodeId, {
  'weather.temperature':   number,
  'weather.precipitation': enum,
  'weather.wind':          enum,
  'weather.visibility':    enum,
  'weather.severity':      number,
  'weather.season':        enum,       // on yearly tick
  'weather.modifiers.yieldModifier':    number,
  'weather.modifiers.travelSpeed':      number,
  'weather.modifiers.monsterActivity':  number,
  'weather.modifiers.spoilageRate':     number,
  'weather.modifiers.combatEffects':    string[],
})
```

**Writes to:** Region nodes (depth 3). Settlements inherit via resolve().

**.tpb ENTRY:**
```typescript
{ type: 'writeKappa', nodeId: regionId, domain: 'weather', paths: ['temperature','precipitation','wind','severity','modifiers'], system: 'weather' }
```

**Pool:** Uses DicePool for d100 rolls. `dicePool.tick(worldDay)` on daily accumulate.

---

### `water` — Daily accumulate

**Module:** `water.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| accumulate (daily) | `updateWaterLevel()` | `(waterBody, precipitation, temperature, season) → WaterLevelResult` |
| on-event | `floodDamageToSettlement()` | `(floodStage) → FloodDamage` |

**.tp READS:**
```
tp.resolve(settlementNodeId).weather.precipitation → feeds water level
tp.resolve(settlementNodeId).weather.temperature   → evaporation rate
tp.resolve(settlementNodeId).weather.season        → seasonal baseline
node.dataStatic.water.sources[sourceId]            → current water state
```

**.tp WRITES ON ACCUMULATE:**
```
tp.writeKappa(settlementNodeId, {
  'water.sources.<sourceId>.level':      number,
  'water.sources.<sourceId>.floodStage': enum,
  'water.sources.<sourceId>.fishStock':  number,   // weekly only
})
```

**Writes to:** Settlement nodes (depth 4). Non-inheritable.

**Cross-system trigger:** If `floodStage >= 'moderate'`, calls `floodDamageToSettlement()` → writes settlement.morale, settlement.stability decrements.

---

## Layer 1 — EXTRACTION

Reads weather κ from L0. Produces commodities.

### `production-chain` — Weekly

**Module:** `production-chain.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| accumulate (weekly) | `tickExtraction()` | `(extraction, deposit) → Record<commodityId, qty>` |
| accumulate (daily) | `tickMarket()` | `(prices[], consumption, production) → void` |

**.tp READS:**
```
tp.resolve(nodeId).weather.modifiers.yieldModifier → extraction efficiency
node.dataStatic.infrastructure.workshops[]         → active extraction sites
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'economy.commodities.<id>.supply': number,    // += extraction output
})
```

**Writes to:** Settlement nodes. Feeds L2 economy.

---

### `agriculture` — Weekly harvest/gathering, Monthly tax-in-kind

**Module:** `agriculture.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | `harvestCrops()` | `(plots, weather, season) → HarvestResult` |
| weekly | `calculateFisheryYield()` | `(fisheryType, waterLevel, weather) → number` |
| weekly | `calculateGatheringYield()` | `(gatheringType, season, weather) → number` |
| monthly | `collectTaxInKind()` | `(production, taxRate, population) → TaxResult` |

**.tp READS:**
```
tp.resolve(nodeId).weather.modifiers.yieldModifier → crop/fish yield
tp.resolve(nodeId).weather.season                  → seasonal availability
node.dataStatic.water.sources[id].fishStock        → fishing input
tp.resolve(nodeId).law.taxRate                     → tax collection rate
node.dataStatic.settlement.population              → tax base
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'economy.commodities.grain.supply':  number,   // harvest output
  'economy.commodities.fish.supply':   number,   // fishery output
  'economy.commodities.herbs.supply':  number,   // gathering output
})
```

**Monthly tax writes:** Moves commodity supply from farms → granary/army/market pools.

---

### `husbandry` — Weekly yield, Monthly herd tick (ENTITY)

**Module:** `husbandry.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | `weeklyYield()` | `(herd, season) → YieldResult` (milk, eggs, wool, manure) |
| monthly | `monthlyHerdTick()` | `(herd, feed, weather) → HerdTickResult` (births, deaths, growth) |

**.tp READS:**
```
tp.resolve(nodeId).weather.modifiers.yieldModifier → yield efficiency
tp.resolve(nodeId).weather.season                  → breeding season check
tp.resolve(nodeId).ecology.dangerLevel             → predation risk (via system-edges)
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'economy.commodities.meat.supply':  number,
  'economy.commodities.milk.supply':  number,
  'economy.commodities.eggs.supply':  number,
  'economy.commodities.wool.supply':  number,
})
```

**Entity state:** Herd is an entity at settlement node. Has population, age distribution, feed state, breed. Not κ — lives in entity registry.

---

## Layer 2 — ECONOMY

Reads extraction output from L1. Price discovery, trade, banking.

### `market` — Weekly

**Module:** `market.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | `weeklyMarketTick()` | `(market, d20) → MarketTickResult` |
| on-demand | `discoverPrice()` | `(commodity, supply, demand, ...) → price` |
| weekly | `simulateMerchantDecision()` | `(merchant, market, prices) → MerchantDecision` |

**.tp READS:**
```
node.dataStatic.economy.commodities           → supply/demand per commodity
node.dataStatic.market.tier                   → market capacity
node.dataStatic.settlement.population         → demand scaling
tp.resolve(nodeId).law.bannedGoods            → restricted commodities
tp.resolve(nodeId).economy.tradeModifier      → regional price multiplier
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'economy.commodities.<id>.price': number,
  'economy.commodities.<id>.trend': enum,
  'market.events':                  string[],
  'market.lastTick':                worldDay,
})
```

**Pool:** Uses DicePool for d20 merchant decisions.

---

### `banking` — Weekly (ENTITY)

**Module:** `banking.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | interest accrual | reads accounts, applies rate |
| weekly | loan payments | processes payments, checks defaults |

**.tp READS:**
```
tp.resolve(nodeId).law.enforcement    → default penalty severity
tp.resolve(nodeId).economy.*          → interest rate environment
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'economy.commodities.gold.supply': number,   // interest/fee flows
})
```

**Entity state:** Bank/vault entity at settlement. Has accounts, loans, reserves.

---

### `currency` — Weekly

**Module:** `currency.ts`

**.tp READS:**
```
tp.resolve(nodeId).economy.commodities → trade volume (price × qty)
```

**.tp WRITES:**
```
tp.writeKappa(regionNodeId, {
  'economy.exchangeRates.<currencyPair>': number,
})
```

**Writes to:** Region nodes (depth 3). Inheritable — settlements use regional rates.

---

### `caravan` — Weekly (ENTITY on edge)

**Module:** `caravan.ts`

**.tp READS:**
```
tp.resolve(originNodeId).economy.commodities   → price at origin (buy low)
tp.resolve(destNodeId).economy.commodities     → price at dest (sell high)
tp.resolve(regionNodeId).weather.modifiers.travelSpeed → movement modifier
edge.segments[i].dangerLevel                   → encounter risk
edge.segments[i].tollAmount                    → toll costs
edge.terrain                                   → base travel speed
```

**.tp WRITES:** None — caravan state is self-contained entity. On arrival, caravan sells cargo which triggers market price writes.

**Entity position:** `{ type: 'on_edge', edgeId, mile, direction }` → advances each tick.

**Trade spawning logic (NOT YET IMPLEMENTED):**
```
For each pair of connected settlements:
  priceGap = destPrice - originPrice - transportCost - tollCost
  if priceGap > profitThreshold:
    spawn caravan entity with cargo manifest
```

---

### `logistics` — Daily (ENTITY on edge)

**Module:** `logistics.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| daily | `tickShipment()` | `(shipment, worldDay, d20Seed) → ShipmentTickResult` |

**.tp READS:**
```
edge.distanceMiles     → total distance
edge.terrain           → speed lookup (via TRANSPORT_SPECS)
shipment.dangerLevel   → hazard check threshold
```

**.tp WRITES:** None — shipment entity state only.

**Entity position:** Same as caravan. `progressMiles` advances daily.

---

## Layer 3 — FACTION

Reads economy κ from L2.

### `faction` — Monthly

**Module:** `faction.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | `tickFaction()` | `(faction) → FactionTickResult` |

**.tp READS:**
```
tp.resolve(controlledNodeId).economy.*       → revenue from controlled territory
tp.resolve(controlledNodeId).military.*      → garrison strength
tp.resolve(controlledNodeId).settlement.population → tax base
```

**.tp WRITES:**
```
For each controlled node:
tp.writeKappa(nodeId, {
  'faction.control.<factionId>.influence': number,
  'faction.control.<factionId>.loyalty':   number,
  'faction.control.<factionId>.stance':    enum,
  'faction.dominant':                      string | null,
  'faction.contested':                     boolean,
})
```

**Also writes `law` κ when faction controls a region:**
```
tp.writeKappa(nodeId, {
  'law.enforcement': enum,      // tyrannical factions → strict
  'law.bannedGoods': string[],  // faction policy
  'law.taxRate':     number,    // faction tax
})
```

**Entity state:** Faction is abstract entity. Has treasury, goals, members, controlledNodes.

---

### `warfare` — Monthly (ENTITY armies)

**Module:** `warfare.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | readiness decay | `readiness -= 0.03` |
| monthly | influence overlay | project army influence to nearby nodes |
| monthly | upkeep drain | `faction.treasury -= army.upkeep` |

**.tp READS:**
```
node.dataStatic.military.*              → garrison state
tp.resolve(nodeId).faction.control.*    → who controls what
```

**.tp WRITES:**
```
tp.writeKappa(nodeId, {
  'military.readiness': number,   // decay
  'military.morale':    number,   // from upkeep shortfall
  'military.upkeep':    number,
  'faction.control.<id>.influence': number,   // army projection
})
```

**Entity:** Army entities can be at nodes (garrisoned) or on edges (marching). Patrols are entities on edge segments.

---

### `intelligence` — Monthly (ENTITY spies)

**Module:** `intelligence.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | spy mission resolution | d20 + skill vs DC |
| monthly | diplomatic drift | standing → 0 over time |

**.tp READS:**
```
tp.resolve(nodeId).faction.control.*      → who to spy on
tp.resolve(nodeId).military.garrison      → defense against spies
```

**.tp WRITES:**
```
tp.writeKappa(nodeId, {
  'faction.control.<factionId>.stance': enum,  // diplomatic drift
})
```

---

## Layer 4 — SETTLEMENT

Reads economy + faction κ from L2/L3.

### `mm-settlement` — Weekly (ALREADY ISimulatedMM)

**Module:** `mm-settlement.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| accumulate | `onAccumulate()` | adds daysPending |
| resolve | `onResolve()` | rolls events from pool, applies to settlement state |

**.tp READS:**
```
tp.resolve(nodeId).economy.*        → wealth for morale
tp.resolve(nodeId).faction.*        → control affects stability
tp.resolve(nodeId).weather.*        → extreme weather → morale hit
tp.resolve(nodeId).ecology.*        → danger → unrest
tp.resolve(nodeId).military.*       → garrison → security
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'settlement.population': number,
  'settlement.stability':  number,
  'settlement.unrest':     number,
  'settlement.morale':     number,
  'settlement.growthRate':  number,
  'settlement.guards':     number,
})
```

**Pool:** `MFPool<number>` for settlement events. `refillEventPool(worldDay)` on resolve.

---

### `infrastructure-mm` — Monthly

**Module:** `infrastructure-mm.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | `tickInfrastructure()` | `(state, worldDay, d20s[]) → InfrastructureTickResult` |

**.tp READS:**
```
node.dataStatic.knowledge.*         → knowledge tier drives profession unlocks
node.dataStatic.settlement.population → population drives demand
node.dataStatic.economy.commodities → available raw materials
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'infrastructure.professions.<role>.count': number,
  'infrastructure.professions.<role>.tier':  string,
  'infrastructure.workshops':   string[],
  'infrastructure.recipes':     string[],
  'infrastructure.knowledgeTier': number,
})
```

**Calls internally:** `tickKnowledgePool()` from `knowledge-pool.ts`.

---

### `knowledge-pool` — Monthly

**Module:** `knowledge-pool.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | `tickKnowledgePool()` | `(pool, hubContext, worldDay, d20s[], potentials?) → KnowledgeTickResult` |

**.tp READS:**
```
node.dataStatic.infrastructure.professions → available expertise
node.dataStatic.settlement.population     → research capacity
node.dataStatic.economy.commodities       → available materials
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'knowledge.seeds.<id>.activatedDay': number | null,
  'knowledge.potentials':              string[],
  'knowledge.tier':                    number,
  'knowledge.library.books':           number,
  'knowledge.library.researchSpeed':   number,
})
```

---

### `social` — Monthly

**Module:** `social.ts`

**.tp READS:**
```
tp.resolve(nodeId).faction.*        → who holds titles
tp.resolve(nodeId).law.*            → enforceability
node.dataStatic.settlement.*        → population for contract volume
```

**.tp WRITES:**
```
tp.writeKappa(nodeId, {
  'social.standingAvg':               number,
  'social.contracts.active':          number,
  'social.contracts.breached':        number,
  'social.contracts.enforceability':  number,
})
```

**Writes to:** Region → settlement (inheritable). Titles flow down from region.

---

## Layer 5 — ECOLOGY

Reads settlement κ from L4 for proximity calculations.

### `monster-actor` — Monthly (ENTITY at node)

**Module:** `monster-actor.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | `tickMonsterAdvancement()` | `(actor, d20, actionD20) → AdvancementResult` |

**.tp READS:**
```
tp.resolve(nodeId).weather.modifiers.monsterActivity → activity modifier
tp.resolve(nodeId).settlement.population             → nearby food source (for expansion check)
tp.resolve(nodeId).military.garrison                 → threat deterrent
```

**.tp WRITES:** (summary κ on nearby nodes)
```
tp.writeKappa(nearbyNodeId, {
  'ecology.dangerLevel':      number,     // 0.0-1.0
  'ecology.dominantThreats':  string[],   // ["wolf_pack", "goblin_tribe"]
  'ecology.wildlifeDensity':  number,     // predation reduces this
})
```

**Entity state:** MonsterActorState with population, CR, tenure, treasury, foodSecurity. Lives at lair node.

---

### `dungeon-gate` — Weekly (ENTITY at node)

**Module:** `dungeon-gate.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | `tickDungeonGate()` | `(gate, worldDay, d20) → GateTickResult` |

**.tp READS:** None from κ directly — gate has its own spawn rate/capacity config.

**.tp WRITES:** (overflow radius)
```
tp.writeKappa(nearbyNodeId, {
  'ecology.dangerLevel': number,   // += overflow contribution
})
```

**Entity state:** DungeonGate with state machine (dormant→active→overflowing→capped), spawn rate, internal count.

---

### `guild` — Weekly (ENTITY chapters at nodes)

**Module:** `guild.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | `tickGuildChapter()` | `(guild, chapterNodeId, parties[], worldDay) → GuildTickResult` |

**.tp READS:**
```
node.dataStatic.ecology.*           → monster sightings for bounties
node.dataStatic.settlement.*        → population for membership
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'guild.chapters.<guildId>.members':      number,
  'guild.chapters.<guildId>.treasury':     number,
  'guild.chapters.<guildId>.reputation':   number,
  'guild.chapters.<guildId>.jobs.posted':  number,
  'guild.chapters.<guildId>.jobs.active':  number,
  'guild.chapters.<guildId>.jobs.completed': number,
  'guild.intel.sightings':                 string[],
  'guild.intel.rumors':                    string[],
})
```

---

## Layer 6 — HUB SERVICES

Reads everything above. NPC behavior, culture, religion.

### `npc-agenda` — Daily accumulate, Monthly needs (ENTITY)

**Module:** `npc-agenda.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| daily | `tickAgenda()` | `(npc) → AgendaTickResult` |
| monthly | needs evaluation | evaluates Maslow hierarchy against local κ |

**.tp READS:**
```
tp.resolve(nodeId).settlement.*     → job availability, safety
tp.resolve(nodeId).market.*         → trade opportunities
tp.resolve(nodeId).ecology.*        → danger (safety need)
tp.resolve(nodeId).faction.*        → political climate
tp.resolve(nodeId).economy.*        → wealth level
node.dataStatic.culture.*           → cultural norms
node.dataStatic.religion.*          → religious obligations
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'economy.commodities.<craft>.supply': number,   // NPC craft output
})
```

**Entity state:** NPCAgenda with needs[], occupation, loyalties, goals, motivation.

---

### `cooking` — Monthly

**Module:** `cooking.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| monthly | `calculateHubFoodMorale()` | `(foodSources) → FoodMorale` |

**.tp READS:**
```
node.dataStatic.economy.commodities.grain.supply   → bread availability
node.dataStatic.economy.commodities.meat.supply    → meat availability
node.dataStatic.economy.commodities.fish.supply    → fish availability
node.dataStatic.economy.commodities.herbs.supply   → spice variety
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'culture.food.variety': number,
  'culture.food.morale':  number,
})
```

---

### `entertainment` — Weekly

**Module:** `entertainment.ts`

**.tp READS:**
```
node.dataStatic.settlement.population → audience size
node.dataStatic.economy.*            → venue revenue
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'culture.entertainment.culturalScore': number,
  'culture.entertainment.revenue':       number,
  'culture.entertainment.venues':        number,
})
```

---

### `lore` — Weekly rumor decay, Monthly research

**Module:** `lore.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| weekly | rumor decay | fidelity -= rate, prune dead rumors |
| weekly | knowledge flow | books/rumors propagate along trade edges |
| monthly | research progress | NPC scholars attempt research rolls |

**.tp READS:**
```
node.dataStatic.knowledge.library.*    → research capacity
node.dataStatic.knowledge.seeds.*      → what's known here
connected edges with trade routes      → propagation paths
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'knowledge.library.books':         number,   // propagation arrivals
  'knowledge.library.scrolls':       number,
  'knowledge.library.researchSpeed': number,
  'knowledge.seeds.<id>':           { category, source, activatedDay },
})
```

---

### `services` — Weekly

**Module:** `services.ts`

**.tp READS:**
```
node.dataStatic.settlement.*       → population for demand
tp.resolve(nodeId).law.*           → contract enforceability
```

**.tp WRITES:** Entity-level only (contracts on service entities).

---

### `religion` — Yearly

**Module:** `religion.ts`

| Phase | Function Called | Signature |
|-------|---------------|-----------|
| yearly | faith accrual | clergy × temples → faith pool per deity |
| yearly | pantheon tick | faith pools → deity power tiers |

**.tp READS:**
```
tp.resolve(nodeId).religion.temples.*   → clergy count, temple size
tp.resolve(nodeId).religion.faithPool.* → current faith
node.dataStatic.settlement.population   → base worshippers
```

**.tp WRITES:**
```
tp.writeKappa(settlementNodeId, {
  'religion.faithPool.<deityId>':  number,
  'religion.dominant':             string | null,
})

// At continent level (inheritable):
tp.writeKappa(continentNodeId, {
  'religion.pantheon':  string,   // if deity dies or ascends
})
```

**Disease as religion burn (NOT YET IMPLEMENTED):**
Plague events are NOT a standalone system. They are a burn on the `religion.faithPool` — a plague reduces faith output from temples, creates demand for divine healing, and can shift the dominant deity if one faith handles the crisis better. Implementation: religion yearly tick checks for plague flag on settlement κ, applies faith penalty.

---

### `narrative` — Per-session (NOT a cadence tick)

**Module:** `narrative.ts`

Fires on session start/end, not on world clock. Reads resolved κ at party node to generate scene hooks, quest beats, arc progression.

---

## Cross-Layer System Edges

**Module:** `system-edges.ts` — Fires after the layer that produces the output.

| # | Edge | When | Source | Target | Function |
|---|------|------|--------|--------|----------|
| 1 | Ecology → Husbandry | After L5 ecology tick | `ecology.dangerLevel` on settlement node | Herd entity at that node | `resolvePredation(monsterCR, type, herdSize, guards, d20)` |
| 2 | Social → Faction | After L4 social tick | `social.contracts.breached` | Faction entity loyalty | `resolveContractLoyalty(breaches, factionId)` |
| 3 | Knowledge → Magic | After L4 knowledge tick | `knowledge.seeds` activations | Magic lore gate DCs | `resolveKnowledgeMagic(seeds, loreGates)` |
| 4 | Guild → Faction | After L5 guild tick | `guild.intel.sightings` | Faction decision input | `resolveGuildIntel(intel, factionGoals)` |
| 5 | Dungeon → Knowledge | After L5 (on dungeon clear) | Cleared dungeon loot | `knowledge.seeds` deposit | `resolveDungeonKnowledge(loot, knowledgePool)` |
| 6 | Followers → Combat | On combat start | Follower NPC profiles | Combat scene entity list | `resolveFollowerCombat(followers, scene)` |

---

## Observation Ticks (Player-Triggered)

These only fire when a party is present at a node. NOT on the world clock.

### Hourly (entering a hub)

| System | What Fires | .tp Reads | .tp Writes |
|--------|-----------|-----------|------------|
| `obs_npc_movement` | NPC entities update position within hub | npc.agenda, node.market hours | NPC entity position |
| `obs_market_update` | Refresh visible prices from accumulated state | node.economy.commodities | None (display only) |
| `obs_encounter_check` | d20 roll vs ecology.dangerLevel | node.ecology.dangerLevel | None (event result) |

### Slot / 5 min (exploring dungeon)

| System | What Fires | .tp Reads | .tp Writes |
|--------|-----------|-----------|------------|
| `obs_dungeon_state` | Trap resets, patrol movement, room state | dungeon entity internal state | Dungeon entity state |
| `obs_exploration` | Discovery check, environment hazards | node.ecology, edge.discoveredSites | edge.exploredFraction |
| `obs_lair_actions` | Lair action recharge check | monster entity state | Monster entity state |

### Round / 6 sec (combat)

| System | What Fires | .tp Reads | .tp Writes |
|--------|-----------|-----------|------------|
| `obs_combat` | Initiative, attacks, damage | node.physics.magic (spell rules) | MF receipts, HP/conditions |
| `obs_conditions` | Duration tick on active conditions | Character condition list | Condition entity state |
| `obs_concentration` | Concentration save check | Caster state, damage taken | Spell entity state |

---

## .tpb Entry Creation

Every κ write creates a .tpb entry. The cadence tick itself also gets an entry.

### Per Daily Tick

```typescript
tpb.append(
  { type: 'tick', worldDay, cadence: 'daily' },
  { worldDay, nodeMutations: [...weatherWrites, ...waterWrites], edgeMutations: [], entityChanges: [] },
  { description: `Day ${worldDay}: weather, water` }
)
```

### Per Weekly/Monthly/Yearly Tick

Same pattern, with all κ writes from all systems that fired at that cadence bundled into one .tpb entry per cadence.

### Per Observation

```typescript
tpb.append(
  { type: 'observe', nodeId, partyId },
  { worldDay, nodeMutations: [...resolveWrites], edgeMutations: [], entityChanges: [...entityResolves] },
  { sessionId, description: `Party observed ${nodeName}` }
)
```

### Per Entity Lifecycle Event

```typescript
// Caravan spawns
tpb.append(
  { type: 'entitySpawn', entityType: 'caravan', entityId, position: { type: 'on_edge', edgeId, mile: 0, direction: 'forward' } },
  { worldDay, nodeMutations: [], edgeMutations: [], entityChanges: [{ entityId, type: 'spawn', before: null, after: caravanState }] },
)

// Caravan arrives
tpb.append(
  { type: 'entityMove', entityId, from: { type: 'on_edge', ... }, to: { type: 'at_node', nodeId: destId } },
  { worldDay, ..., entityChanges: [{ entityId, type: 'arrive', before: onEdgeState, after: atNodeState }] },
)
```

---

## MF Pool Integration

Pools are NOT .tp κ. They're per-entity computation caches.

| Pool Owner | Pool Type | When Refilled | Used By |
|-----------|-----------|---------------|---------|
| `Clockwork` (global) | `DicePool` (d20, d100) | Daily accumulate: `dicePool.tick(worldDay)` | All systems needing dice |
| `MMSettlement` | `MFPool<number>` (events) | On resolve: `refillEventPool(worldDay)` | Settlement event selection |
| `MMActor` | `DicePool` | On resolve: `tickDicePool(worldDay)` | Actor scheme rolls |
| `MMLocalActor` | `DicePool` | On resolve: `tickDicePool(worldDay)` | Local actor craft/trade rolls |

**Critical:** Pools MUST refill during resolve, not just during accumulate. The 357-day simulation failure (all cadences at 0, unrest 100%) happened because pools exhausted without refill.

---

## Complete Call Graph — One Day

```
clockwork.dailyTick()                        worldDay: N → N+1
│
├── L0 PHYSICAL
│   ├── weather.accumulatePotential(1, N+1, tp)
│   │   └── generateWeather() → tp.writeKappa(regionId, weather.*)
│   │   └── dicePool.tick(N+1)                                    ← pool refill
│   └── water.accumulatePotential(1, N+1, tp)
│       └── updateWaterLevel() → tp.writeKappa(settlementId, water.*)
│       └── if flood: floodDamageToSettlement() → tp.writeKappa(settlementId, settlement.*)
│
├── L1 EXTRACTION (reads weather.* written above)
│   ├── production-chain.accumulatePotential(1, N+1, tp)
│   │   └── tickExtraction() → tp.writeKappa(settlementId, economy.commodities.*)
│   │   └── tickMarket() → mutates prices in-place
│   ├── agriculture.accumulatePotential(1, N+1, tp)           ← daily: nothing; weekly: harvest
│   └── husbandry.accumulatePotential(1, N+1, tp)             ← daily: nothing; weekly: yield
│
├── L2 ECONOMY (reads economy.commodities.* written above)
│   ├── market.accumulatePotential(1, N+1, tp)                 ← daily: nothing; weekly: price tick
│   ├── banking.accumulatePotential(1, N+1, tp)
│   ├── currency.accumulatePotential(1, N+1, tp)
│   ├── caravan.accumulatePotential(1, N+1, tp)                ← entity: advance mile
│   └── logistics.accumulatePotential(1, N+1, tp)
│       └── tickShipment() → entity state only
│
├── L3 FACTION (reads economy.* from L2)
│   ├── faction.accumulatePotential(1, N+1, tp)                ← daily: nothing; monthly: tick
│   ├── warfare.accumulatePotential(1, N+1, tp)
│   └── intelligence.accumulatePotential(1, N+1, tp)
│
├── L4 SETTLEMENT (reads economy.* + faction.*)
│   ├── mm-settlement.accumulatePotential(1, N+1, tp)
│   ├── infrastructure-mm.accumulatePotential(1, N+1, tp)      ← monthly only
│   ├── knowledge-pool.accumulatePotential(1, N+1, tp)         ← monthly only
│   └── social.accumulatePotential(1, N+1, tp)                 ← monthly only
│
├── L5 ECOLOGY (reads settlement.* from L4)
│   ├── monster-actor.accumulatePotential(1, N+1, tp)          ← monthly only
│   ├── dungeon-gate.accumulatePotential(1, N+1, tp)           ← weekly only
│   └── guild.accumulatePotential(1, N+1, tp)                  ← weekly only
│
├── L6 HUB SERVICES (reads everything)
│   ├── npc-agenda.accumulatePotential(1, N+1, tp)
│   │   └── tickAgenda() → entity state
│   ├── cooking.accumulatePotential(1, N+1, tp)                ← monthly only
│   ├── entertainment.accumulatePotential(1, N+1, tp)          ← weekly only
│   ├── lore.accumulatePotential(1, N+1, tp)                   ← weekly only
│   ├── services.accumulatePotential(1, N+1, tp)               ← weekly only
│   └── religion.accumulatePotential(1, N+1, tp)               ← yearly only
│
├── CROSS-LAYER (system-edges.ts)
│   └── (fires only on weeks/months where both source and target ticked)
│
├── INCREMENT DELTAS: weekly++, monthly++, yearly++
│
├── IF weeklyDelta >= 7:
│   └── tickMMs('weekly', 7, tp) across all layers
│       (all weekly MMs get accumulatePotential with 7 days)
│
├── IF monthlyDelta >= 30:
│   └── tickMMs('monthly', 30, tp) across all layers
│
├── IF yearlyDelta >= 360:
│   └── tickMMs('yearly', 360, tp) across all layers
│
├── .tpb ENTRY: bundle all κ writes from this day
│
└── CONSUME playerTicksToday → totalPlayerTicks
```

---

## Registration Table — Complete

This is what Claude IDE builds when wiring each system into the Clockwork.

| # | MM ID | Module | Layer | Cadence | ObsOnly | Writes κ On |
|---|-------|--------|-------|---------|---------|-------------|
| 1 | `weather:<regionId>` | weather.ts | 0 | daily | No | ACCUMULATE |
| 2 | `water:<settlementId>` | water.ts | 0 | daily | No | ACCUMULATE |
| 3 | `extraction:<settlementId>` | production-chain.ts | 1 | daily | No | ACCUMULATE |
| 4 | `agriculture:<settlementId>` | agriculture.ts | 1 | weekly | No | resolve |
| 5 | `husbandry:<settlementId>` | husbandry.ts | 1 | weekly | No | resolve |
| 6 | `market:<settlementId>` | market.ts | 2 | weekly | No | resolve |
| 7 | `banking:<settlementId>` | banking.ts | 2 | weekly | No | resolve |
| 8 | `currency:<regionId>` | currency.ts | 2 | weekly | No | resolve |
| 9 | `caravan:<entityId>` | caravan.ts | 2 | weekly | No | — (entity) |
| 10 | `logistics:<entityId>` | logistics.ts | 2 | daily | No | — (entity) |
| 11 | `faction:<factionId>` | faction.ts | 3 | monthly | No | resolve |
| 12 | `warfare:<factionId>` | warfare.ts | 3 | monthly | No | resolve |
| 13 | `intelligence:<factionId>` | intelligence.ts | 3 | monthly | No | resolve |
| 14 | `settlement:<settlementId>` | mm-settlement.ts | 4 | weekly | No | resolve |
| 15 | `infrastructure:<settlementId>` | infrastructure-mm.ts | 4 | monthly | No | resolve |
| 16 | `knowledge:<settlementId>` | knowledge-pool.ts | 4 | monthly | No | resolve |
| 17 | `social:<regionId>` | social.ts | 4 | monthly | No | resolve |
| 18 | `monster:<entityId>` | monster-actor.ts | 5 | monthly | No | resolve |
| 19 | `dungeon:<entityId>` | dungeon-gate.ts | 5 | weekly | No | resolve |
| 20 | `guild:<settlementId>` | guild.ts | 5 | weekly | No | resolve |
| 21 | `npc:<entityId>` | npc-agenda.ts | 6 | daily | No | resolve |
| 22 | `cooking:<settlementId>` | cooking.ts | 6 | monthly | No | resolve |
| 23 | `entertainment:<settlementId>` | entertainment.ts | 6 | weekly | No | resolve |
| 24 | `lore:<settlementId>` | lore.ts | 6 | weekly | No | resolve |
| 25 | `services:<settlementId>` | services.ts | 6 | weekly | No | resolve |
| 26 | `religion:<settlementId>` | religion.ts | 6 | yearly | No | resolve |
| 27 | `obs_npc_movement` | npc-agenda.ts | 6 | hourly | Yes | — |
| 28 | `obs_market_update` | market.ts | 6 | hourly | Yes | — |
| 29 | `obs_encounter_check` | — | 6 | hourly | Yes | — |
| 30 | `obs_dungeon_state` | dungeon-interior.ts | 6 | slot | Yes | — |
| 31 | `obs_exploration` | — | 6 | slot | Yes | — |
| 32 | `obs_lair_actions` | — | 6 | slot | Yes | — |
| 33 | `obs_combat` | mm-combat.ts | 6 | round | Yes | — |
| 34 | `obs_conditions` | — | 6 | round | Yes | — |
| 35 | `obs_concentration` | — | 6 | round | Yes | — |

**Per settlement:** 1 weather (region-level), 1 water, 1 extraction, 1 agriculture, 1+ husbandry, 1 market, 0-1 banking, 1+ caravan, 0+ logistics, 1 settlement, 1 infrastructure, 1 knowledge, 1 cooking, 1 entertainment, 1 lore, 1 services, 1 religion, N npcs, N guild chapters.

**Per region:** 1 weather, 1 currency, 1 social.

**Per faction:** 1 faction, 1 warfare, 1 intelligence.

**Per entity:** 1 per caravan, 1 per logistics shipment, 1 per monster group, 1 per dungeon gate, 1 per NPC.

---

## GM Mode Controls

**Module:** `gm.ts`

The GM selects a simulation depth (4 play modes). This controls which layers are active:

| Mode | L0 | L1 | L2 | L3 | L4 | L5 | L6 | Observation |
|------|----|----|----|----|----|----|----|----|
| `narrative` | weather only | — | — | — | settlement (simplified) | — | NPC (simplified) | hourly only |
| `standard` | all | extraction | market, caravan | faction | all | ecology, dungeon | all | hourly, slot |
| `simulation` | all | all | all | all | all | all | all | all |
| `sandbox` | all | all | all | all | all | all | all | all + debug |

Claude IDE registers only the MMs appropriate for the campaign's play mode.

---

## What's NOT Here Yet (Placeholders)

| Item | Status | Blocking? |
|------|--------|-----------|
| Seas as parallel worlds | Schema defined, no implementation | No — add when oceans matter |
| Population migration pressure | Concept documented, no module | No — homeless/workless → edge migration |
| Harptos calendar mapping | No module | No — worldDay → FR date is pure math |
| Trade decision-making (spawn caravans from price gaps) | Concept in caravan section above | Yes — caravans don't spawn autonomously yet |
| Disease as religion burn | Concept documented in religion section | No — plague flag on settlement is enough |
| `rest_resolution` | No module | No — character-level, not world |
| `great_events` | No module | No — yearly random events, low priority |
| `mf_pool_refill` | Logic exists in MFPool but not wired as system | Yes — pools exhaust without daily refill |
