# LIVING WORLD ARCHITECTURE

## Philosophy

**The world doesn't wait for players.**

This document describes how the TTRPG engine simulates a living economy where:
- Resources cannot be created from nothing
- Geography determines what exists where
- Trade routes are arteries - cut one, and settlements starve
- NPCs and players follow the same rules
- Smart agents (player or NPC) can exploit information asymmetry
- Faction decisions ripple through the economy
- Time passes, and the world changes

---

## System Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GENESIS (Reality Engine)                          │
│                                                                             │
│  Seeds → Topology → Properties → Precipitation → Observation → Collapse    │
│  "Code is not the artifact. Topology is."                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORLD GRAPH (Static Structure)                      │
│                                                                             │
│  Multiverse → Crystal Sphere → Planet → Continent → Region → Settlement    │
│  Nodes store: physics, culture, government, economy                         │
│  Edges store: trade routes, portals, faction presence                       │
│  See: SCHEMA_CONTRACT.md                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ECONOMIC SECTORS (Value Flow)                       │
│                                                                             │
│  PRIMARY ────────► LOGISTICS ────────► SECONDARY ────────► TERTIARY        │
│  (Extraction)      (Transport)         (Transform)         (Services)       │
│  70-80% pop        5-10% pop           10-15% pop          1-5% pop         │
│                                                                             │
│  "The economy flows upward from the land"                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FACTION CONTROL LAYER                               │
│                                                                             │
│  Taxes, Tariffs, Embargoes, Monopolies, Wars, Corruption                   │
│  "The economy is NOT free"                                                  │
│                                                                             │
│  Bad governor → cascading economic collapse                                 │
│  Good governor → prosperity spiral                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HUB SYSTEM (Local Simulation)                       │
│                                                                             │
│  Settlements with: topology, districts, buildings, NPCs                     │
│  Observer-local chunks (100x100 units, LRU cache)                          │
│  Internal graph: pathfinding, visibility, economy flow                      │
│  See: engine/hub/                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NPC AGENTS (Individual Actors)                      │
│                                                                             │
│  NPCs ARE Characters with isNPC=true                                        │
│  Same skills, magic, progression as players                                 │
│  Economic pressure: income vs lifestyle cost                                │
│  Decision engine: information + intelligence + resources + risk             │
└─────────────────────────────────────────────────────────────────────────────┘

```

---

## Time Substrate

**1 TURN = 6 seconds** (D&D combat round)

This is the universal clock. Everything is measured in turns.

```
COMBAT MODE:
  1 turn = 1 action

FREE ROAM MODE:
  600 turns = 1 slot (30 minutes of activity)
  1,200 turns = 1 hour
  14,400 turns = 1 day
  100,800 turns = 1 week
  ~432,000 turns = 1 month

WORK/ACTIVITY:
  Activity has BASE_SLOTS (e.g., forging a sword = 8 slots)
  Worker has VELOCITY (skill-modified multiplier)
  ACTUAL_SLOTS = BASE_SLOTS / VELOCITY
  
  Novice blacksmith (velocity 0.5): 16 slots = 8 hours
  Master blacksmith (velocity 2.0): 4 slots = 2 hours
  
  XP gained per completion → velocity increases over time
```

### Why Turns Matter

- **Combat**: Granular (1 turn = 1 action)
- **Activities**: Aggregated (slots = 600 turns)
- **Schedules**: NPCs follow slot-based daily routines
- **Trade**: Goods move X distance per slot along routes
- **Information**: News propagates at defined turn-speed
- **Economy**: Aggregate production/consumption per day/week

---

## Economic Sectors (from WSES)

### Sector Hierarchy

```typescript
enum EconomicSector {
  PRIMARY = 'PRIMARY',      // Extraction, Agriculture (Raw Materials)
  LOGISTICS = 'LOGISTICS',  // Commoditization, Transport (Trade)
  SECONDARY = 'SECONDARY',  // Transformation, Manufacturing (Industry)
  TERTIARY = 'TERTIARY'     // Commerce, Services (Consumption)
}
```

### Pre-Industrial Distribution

| Sector | Population | Examples |
|--------|------------|----------|
| PRIMARY | 70-80% | Farmers, miners, fishers, hunters, loggers |
| LOGISTICS | 5-10% | Merchants, sailors, caravan drivers |
| SECONDARY | 10-15% | Blacksmiths, weavers, craftsmen, alchemists |
| TERTIARY | 1-5% | Priests, scribes, entertainers, sages |

**Critical insight**: In medieval settings, services are for the ultra-rich. The bard at the tavern is trickling-down entertainment. A sage who researches for hire? You need wealth to afford that.

### Value Flow

```
Geography produces PRIMARY resources
    │
    │ (miners extract ore, farmers grow grain)
    ▼
LOGISTICS standardizes and moves them
    │
    │ (commodities, trade routes, risk)
    ▼
SECONDARY transforms into finished goods
    │
    │ (blacksmith: ore → weapons, weaver: wool → cloth)
    ▼
TERTIARY provides intangible services
    │
    │ (only where wealth concentrates)
    ▼
Consumption (by NPCs, players, factions)
```

### Why Geography Matters

```
MIRABAR (Mining city):
  - PRIMARY producer: iron ore, gems
  - Local blacksmith: cheap materials
  - Exports: ore, ingots, weapons
  
WESTGATE (Trade hub):
  - No local ore production
  - Blacksmith relies on LOGISTICS
  - Iron cost = Mirabar price + transport + tolls + risk + margin
  
IF TRADE ROUTE DISRUPTED:
  - Westgate blacksmith: no iron
  - Prices spike (scarcity)
  - Some craftsmen migrate to Mirabar
  - Westgate's SECONDARY sector shrinks
```

---

## Resource Flow (No Magic Creation)

Resources cannot be created from nothing. They must:

1. **Exist** somewhere (geography determines PRIMARY resources)
2. **Be extracted** (mining, farming, hunting)
3. **Be transported** (trade routes with capacity, cost, risk)
4. **Be transformed** (SECONDARY processing)
5. **Be consumed** (by NPCs, players, factions)

### Trade Route Properties

```typescript
interface TradeRoute {
  fromSettlementId: string;
  toSettlementId: string;
  
  distance: number;        // Miles
  travelDays: number;      // Standard travel time (slots)
  terrain: TerrainType[];  // Affects cost and risk
  
  weeklyCapacity: number;  // Units that can move per week
  currentVolume: number;
  
  safety: 'safe' | 'patrolled' | 'risky' | 'dangerous' | 'deadly';
  lossRate: number;        // Percentage lost to dangers
  
  controlledBy?: string;   // Faction ID
  tollRate: number;        // Percentage toll
  
  status: 'active' | 'disrupted' | 'blocked' | 'destroyed';
}
```

### Material Flow Simulation

Each economic tick (weekly):

1. **Production**: Each settlement produces based on buildings + workers
2. **Consumption**: Population consumes food/fuel/goods
3. **Surplus/Deficit**: Calculate what's left
4. **Trade**: Goods flow along routes (capacity-limited)
5. **Price Update**: Supply/demand ratio → price multiplier
6. **State Update**: Prosperity, stability, issues

---

## Information Propagation

**Markets don't adjust instantly. Information travels.**

```
DAY 0:   War declared (Cormyr vs Sembia)
         - Origin point: Suzail
         - News begins traveling
         
DAY 0-3: Players in Westgate hear rumors (tavern, contacts)
         - Smart players: BUY iron futures, stockpile grain
         - Markets: Still normal prices
         
DAY 4-7: News reaches Westgate officially
         - Merchants start reacting
         - Prices BEGIN to shift
         - Smart NPCs (high INT, merchant role): start hoarding
         
DAY 8-14: Trade routes actually disrupted
          - Supply drops
          - Prices SPIKE
          - Players who bought early: PROFIT
          - Slow NPCs: pay premium or go without
          
DAY 15+:  New equilibrium
          - Alternative routes (longer, more expensive)
          - Smugglers emerge (risk premium)
          - Some businesses fail, others thrive
```

### Information Speed

- **Messenger on horse**: ~50 miles/day
- **Trade caravan**: ~15-20 miles/day
- **Ship**: ~100 miles/day (weather permitting)
- **Magic (Sending)**: Instant (but limited, expensive)
- **Rumor in tavern**: Unreliable but fast (travelers)

### Actor Knowledge State

```typescript
interface ActorKnowledge {
  entityId: string;  // NPC or player
  
  // What they know
  knownEvents: Array<{
    eventId: string;
    learnedAt: number;      // Turn when learned
    source: string;         // "rumor", "official", "witnessed"
    accuracy: number;       // 0-1 (rumors may be wrong)
  }>;
  
  // What they can perceive
  informationNetwork: {
    factionMemberships: string[];
    contacts: string[];      // NPCs who share info
    locationsMonitored: string[];
  };
}
```

---

## Faction Control Layer

Factions aren't just political entities - they're **economic regulators**.

### Economic Interventions

| Intervention | Effect |
|--------------|--------|
| **Tax** | Extracts % of all transactions |
| **Tariff** | Import/export surcharge |
| **Embargo** | Trade route blocked to target |
| **Monopoly** | Only faction can trade X commodity |
| **Price Control** | Ceiling/floor on prices |
| **Conscription** | Workers removed from PRIMARY |
| **War** | Routes dangerous, military demand spikes |
| **Corruption** | Siphons wealth, unpredictable |

### Bad Governor Cascade

```
Day 0:   New lord raises taxes 50%
Day 7:   Merchants raise prices to compensate
Day 14:  Farmers can't afford tools
Day 30:  Farmers produce less (no maintenance)
Day 60:  Food shortage begins
Day 90:  Prices spike, unrest grows
Day 120: Skilled workers emigrate
Day 180: Economy collapses, lord replaced (or revolt)
```

### Good Governor Cascade

```
Day 0:   New lord lowers tariffs on iron
Day 14:  Iron prices drop
Day 30:  Blacksmiths produce more (cheaper inputs)
Day 60:  Tool prices drop
Day 90:  Farmers more productive
Day 120: Food surplus, population grows
Day 180: Tax base expands despite lower rate
```

### Faction Schemes (from factions.ts)

Schemes are **economic interventions with game mechanics**:

```typescript
// These create information asymmetry opportunities
const ECONOMIC_SCHEMES = [
  'trade_monopoly',    // Exclusive rights to commodity
  'embargo',           // Block trade with faction
  'economic_sabotage', // Destroy production
  'counterfeiting',    // Inflate currency
  'smuggling_ring',    // Bypass tariffs
  'price_fixing',      // Cartel behavior
];
```

---

## NPC Economic Agents

**NPCs follow the same rules as players.**

### NPC Decision Model

```typescript
interface NPCDecisionContext {
  // Perception - what do they know?
  knowledge: ActorKnowledge;
  
  // Intelligence - can they see patterns?
  intelligenceModifier: number;  // -5 to +5
  wisdomModifier: number;
  
  // Resources - can they act?
  availableGold: number;
  creditAccess: number;
  inventory: Item[];
  
  // Risk tolerance - will they bet?
  personalityTraits: string[];  // "cautious", "greedy", "loyal"
  currentPressure: number;      // 0-1 (desperation)
}
```

### Economic Pressure States

```typescript
enum EconomicPressure {
  THRIVING = 'THRIVING',       // Income >> expenses, saving
  COMFORTABLE = 'COMFORTABLE', // Income > expenses
  STABLE = 'STABLE',           // Income ~= expenses
  STRUGGLING = 'STRUGGLING',   // Income < expenses, depleting savings
  DESPERATE = 'DESPERATE',     // No savings, can't pay expenses
  MIGRATING = 'MIGRATING',     // Leaving for better opportunities
}
```

### NPC Lifestyle Costs (D&D 5e PHB p.157)

| Lifestyle | Cost/Day | Cost/Year | Typical Roles |
|-----------|----------|-----------|---------------|
| Wretched | 0 | 0 | Beggars, homeless |
| Squalid | 1sp | 36.5gp | Laborers, poor farmers |
| Poor | 2sp | 73gp | Farmhands, servants |
| Modest | 1gp | 365gp | Craftsmen, soldiers |
| Comfortable | 2gp | 730gp | Merchants, skilled artisans |
| Wealthy | 4gp | 1,460gp | Guild masters, minor nobles |
| Aristocratic | 10gp+ | 3,650gp+ | Nobles, successful merchants |

### NPC Income by Role/Sector

```typescript
// Income depends on role, skill, and local economy
function calculateNPCIncome(npc: NPC, settlement: Settlement): number {
  const baseIncome = ROLE_BASE_INCOME[npc.role];
  const skillMultiplier = 1 + (npc.skillVelocity - 1) * 0.5;
  const prosperityMultiplier = settlement.prosperity / 50;  // 0-2x
  
  return baseIncome * skillMultiplier * prosperityMultiplier;
}

const ROLE_BASE_INCOME: Record<NPCRole, number> = {
  // PRIMARY (low base, volume-dependent)
  farmer: 0.5,      // 0.5gp/day base
  miner: 0.7,
  fisher: 0.4,
  
  // LOGISTICS (margin-dependent)
  merchant: 2.0,    // Highly variable
  sailor: 0.6,
  
  // SECONDARY (skill-dependent)
  blacksmith: 1.5,
  craftsman: 1.0,
  
  // TERTIARY (patron-dependent)
  priest: 1.0,      // Temple provides
  sage: 2.0,        // If patrons exist
  bard: 0.5,        // Tips and patronage
};
```

### NPC Ascension/Decline

**Smart NPCs can exploit the same opportunities as players:**

```
SMART MERCHANT (High INT, capital, information network):

Day 0:   Hears rumor of Cormyr war (contacts in guild)
Day 1:   Calculates: Iron from Mirabar will be scarce
Day 2:   Buys iron futures, stockpiles
Day 14:  War confirmed, prices spike
Day 21:  SELLS at 3x profit
Day 30:  Uses profit to buy struggling blacksmith's shop
Day 60:  Now controls iron supply in district
Day 90:  Becomes faction-relevant NPC

         → EMERGENT VILLAIN OR ALLY
         
Players arrive: "Who controls the iron here?"
"There's this merchant... started small, now owns half the forges"
```

**NPCs can also fail:**

```
FOOLISH NOBLE (inherited position, low INT):

Day 0:   Raises taxes because "need more gold"
Day 14:  Doesn't understand second-order effects
Day 60:  Economy collapses under him
Day 90:  Gets overthrown

Players arrive: Civil war, power vacuum
"What happened here?"
"The old lord... he wasn't very clever with coin"
```

---

## Hub System Integration

The hub system (engine/hub/) provides local simulation:

### Hub → World Graph Connection

```
WORLD GRAPH (regions, trade routes)
     │
     ├── Hub entrance nodes connect to world edges
     │
HUB GRAPH (streets, buildings)
     │
     └── NPCs navigate within hub
```

### Hub Economic Flow

```typescript
// Hub receives goods through entrances
interface HubEconomicState {
  hubId: string;
  
  // Inflow from trade routes
  imports: Array<{
    commodityId: string;
    quantity: number;
    sourceSettlement: string;
    arrivalTurn: number;
  }>;
  
  // Outflow to trade routes
  exports: Array<{
    commodityId: string;
    quantity: number;
    destinationSettlement: string;
    departureTurn: number;
  }>;
  
  // Local production/consumption
  localProduction: Record<string, number>;  // commodity → units/week
  localConsumption: Record<string, number>;
  
  // Market state
  prices: Record<string, MarketPrice>;
  
  // NPC economic states
  npcEconomicStates: Map<string, NPCEconomicState>;
}
```

---

## Genesis Integration

Genesis provides the **material foundation**:

### Material Composition

Everything physical has a prime-based seed:

```typescript
// Iron sword
const ironSword = composeMaterial({ Fe: 3, C: 1 });
// seed = 17³ × 5¹ = 24565

// Mithril sword (requires magical binding)
const mithrilSword = composeMaterial({ Mth: 3, Arc: 1 });
// seed = 37³ × 101¹ = 5115989
```

### Property-Based Crafting

Blueprints ask for **properties**, not specific materials:

```typescript
const swordBlueprint: Blueprint = {
  requirements: [
    { slot: 'blade', tags: ['structural'], volume: 3 },
    { slot: 'hilt', tags: [], volume: 1 },
  ],
};

// Can use iron, steel, mithril, adamantine
// Properties determine outcome
```

### Economic Implications

- Materials come from PRIMARY extraction
- Better materials are rarer (geography-dependent)
- Mithril requires arcane dust (magical binding)
- Property-based system = substitution possible in scarcity
- Quality affects price, durability, special effects

---

## Extraction System (PRIMARY Sector)

**This is where resources come from.**

See: `engine/extraction/`

### ResourceDeposit Schema

Every commodity traces back to a geographic source:

```typescript
interface ResourceDeposit {
  id: string;
  locationId: string;        // World graph node
  locationName: string;
  
  // What's here
  name: string;              // "Ironforge Vein", "Darkwood Forest"
  depositType: DepositType;  // "shallow", "deep", "arable", "forest"
  primaryCommodityId: string; // Links to economy commodities
  secondaryCommodities: Array<{
    commodityId: string;
    chance: number;          // 0-1
    ratio: number;           // Amount relative to primary
  }>;
  quality: DepositQuality;   // depleted → poor → standard → rich → legendary
  
  // Reserves (non-renewable)
  totalReserves?: number;
  remainingReserves?: number;
  depletionPerUnit: number;
  
  // Capacity (renewable)
  renewable: boolean;
  regenerationRate: number;
  maxCapacity?: number;
  currentCapacity?: number;
  overexploited: boolean;
  
  // Requirements
  minimumTechLevel: TechLevel;
  requiredBuilding?: string;
  laborRequirement: number;
  optimalLabor: number;
  maxLabor: number;
  
  // Hazards
  hazards: Array<{
    type: HazardType;
    severity: Severity;
    probability: number;
  }>;
  
  // Control
  controlledBy?: string;     // Faction ID
  controlType: ControlType;  // unclaimed, claimed, occupied, contested
  
  // Output
  baseOutputPerSlot: number;
  currentOutputPerSlot: number;
}
```

### Deposit Types

| Category | Types | Examples |
|----------|-------|----------|
| **Mining** | surface, shallow, deep, underwater, volcanic | Iron mines, gold veins, gem caverns |
| **Agriculture** | arable, pasture, orchard, vineyard | Wheat fields, cattle ranches |
| **Forestry** | forest, old_growth, managed | Timber forests |
| **Aquatic** | fishery, deep_sea, shellfish | Coastal fisheries |
| **Gathering** | herb_field, game_land, salt_flat | Medicinal herbs, hunting grounds |
| **Exotic** | ley_line, planar_bleed, ruins | Magic sources, ancient salvage |

### Quality Multipliers

```typescript
const QUALITY_MULTIPLIERS = {
  depleted: 0.25,   // Deposit nearly exhausted
  poor: 0.5,
  standard: 1.0,
  rich: 1.5,
  legendary: 2.0,   // Exceptional quality, rare materials
};
```

### ExtractionOperation

Active extraction at a deposit:

```typescript
interface ExtractionOperation {
  id: string;
  depositId: string;
  
  // Operator
  operatorId: string;
  operatorType: 'faction' | 'character' | 'npc' | 'party';
  
  // Workforce
  workers: Array<{
    npcId?: string;
    role: string;      // "miner", "foreman", "guard"
    skill: number;     // 1-5
    wage: number;
  }>;
  totalWorkers: number;
  workerEfficiency: number;  // 0-2
  
  // Status
  status: 'idle' | 'operating' | 'maintenance' | 'disrupted' | 'abandoned' | 'exhausted';
  
  // Output
  stockpile: Record<string, number>;  // commodityId → amount
  outputDestination: {
    type: 'stockpile' | 'market' | 'transport' | 'consume';
    locationId?: string;
    routeId?: string;
  };
}
```

### Extraction Engine

Tick-based processing (per slot = 600 turns = 30 minutes):

```typescript
// Calculate labor efficiency (diminishing returns curve)
function calculateLaborEfficiency(workers, optimalLabor, maxLabor): number {
  if (workers <= optimalLabor) {
    return 1 - Math.exp(-2 * workers / optimalLabor);  // Ramp up
  } else {
    return 1 + Math.log(workers / optimalLabor) * 0.1;  // Slow gains
  }
}

// Main tick function
ExtractionEngine.tick(deposit, operation, slotsElapsed, techLevel): ExtractionTickResult {
  // 1. Check tech requirements
  // 2. Check labor requirements
  // 3. Calculate output multipliers (quality, labor, skill, tools, buildings)
  // 4. Handle reserves/capacity limits
  // 5. Roll for secondary commodities
  // 6. Roll for bonus yield (5% chance)
  // 7. Roll for hazards
  // 8. Calculate costs
  // 9. Return output + events
}
```

### Commodity → Deposit Mapping

```typescript
const COMMODITY_SOURCES = {
  grain: {
    depositTypes: ['arable'],
    primaryBuilding: 'farm',
    minimumTech: 'stone_age',
  },
  iron_ore: {
    depositTypes: ['surface', 'shallow', 'deep'],
    primaryBuilding: 'mine',
    minimumTech: 'iron_age',
  },
  mithril_ore: {
    depositTypes: ['deep'],
    primaryBuilding: 'deep_mine',
    minimumTech: 'medieval',
  },
  magic_components: {
    depositTypes: ['ley_line', 'planar_bleed', 'herb_field'],
    primaryBuilding: 'mage_tower',
    minimumTech: 'medieval',
  },
};
```

### Discovery System

Deposits must be **discovered** before exploitation:

```typescript
interface DepositDiscovery {
  depositId: string;
  
  discoveredBy: {
    type: 'character' | 'party' | 'npc' | 'faction';
    id: string;
    name: string;
  };
  
  discoveryMethod: 
    | 'prospecting'     // Deliberate search
    | 'accident'        // Stumbled upon
    | 'rumor'           // Heard about it
    | 'divination'      // Magic
    | 'map'             // Found old map
    | 'local_knowledge' // Locals told them
    | 'survey';         // Systematic exploration
  
  knowledgeLevel: 'rumor' | 'confirmed' | 'surveyed' | 'mapped';
  knownTo: string[];    // Who knows about it
  publicKnowledge: boolean;
}
```

### Economic Integration

Extraction feeds into the economy:

```typescript
// Economy tick receives extraction outputs
function simulateEconomicTick(
  economy: WorldEconomy,
  daysElapsed: number,
  extractionInputs: ExtractionInput[]  // ← From extraction engine
) {
  // Phase 1: PRIMARY - Process extraction outputs
  // Phase 2: SECONDARY - Transform raw materials
  // Phase 3: TERTIARY - Consume goods
  // Phase 4: LOGISTICS - Flow along trade routes
  // Phase 5: MARKET - Update prices
  // Phase 6: EVENTS - Random events, ripples
}
```

### Example Flow

```
MIRABAR IRON CYCLE:

1. DEPOSIT: Ironforge Vein
   - type: shallow
   - quality: rich (1.5x)
   - reserves: 50,000 units
   - baseOutput: 2/slot
   
2. OPERATION: Deepdelver Mining Co.
   - workers: 30 (optimal: 20)
   - efficiency: 1.05x
   - foreman skill: 4 (+12% skill bonus)
   
3. TICK (1 slot = 30 min):
   - base: 2 units
   - quality: 2 × 1.5 = 3
   - labor: 3 × 1.05 = 3.15
   - skill: 3.15 × 1.12 = 3.53
   - OUTPUT: 3.53 iron_ore
   - RESERVES: 50,000 - 3.53 = 49,996.47
   
4. STOCKPILE or TRANSPORT:
   - If stockpile: Added to operation.stockpile['iron_ore']
   - If transport: Added to trade route cargo
   
5. ECONOMY TICK (weekly):
   - Mirabar market: +1,200 iron_ore (48 slots × 7 days × 3.5)
   - Price drops due to supply
   - Smiths can produce more weapons
   - Exports flow to Waterdeep, Neverwinter
```

---

## Logistics System

**Routes are the blood vessels. Caravans are the blood cells.**

See: `engine/logistics/`

### The Gem Revelation

**Gems don't come from mines. They come from DUNGEONS.**

The gods of this universe made a peculiar design choice:
- Gems are mob loot, not mineable resources
- This makes adventurers economically NECESSARY
- Dungeons are effectively gem ATMs
- The monetary supply depends on dungeon-crawling
- Exchange houses convert gems → currency

This explains why:
- Adventurers are respected (they mine the monetary supply)
- Dungeons get cleared (they're gem ATMs)
- Monsters hoard treasure (that's where gems ARE)
- There's always another quest (the economy NEEDS adventurer output)

### Gem Tiers (D&D 5e)

| Tier | Value Range | Examples |
|------|-------------|----------|
| Common | 10-50gp | Azurite, Malachite, Turquoise |
| Uncommon | 50-100gp | Moonstone, Onyx, Zircon |
| Rare | 100-500gp | Amber, Pearl, Jade |
| Very Rare | 500-1000gp | Alexandrite, Topaz, Black Pearl |
| Legendary | 1000-5000gp | Emerald, Sapphire, Star Ruby |
| Mythic | 5000+gp | Diamond, Ruby, Star Diamond |

### Gem Generation

```typescript
// Gems are ONLY generated from encounters
const loot = generateGemLoot({
  cr: 10,                    // Challenge rating
  treasureType: 'hoard',     // 'individual' or 'hoard'
  dungeonTier: 'mid',        // 'low', 'mid', 'high', 'legendary'
}, encounterId, encounterName);

// Higher CR = more gems
// Hoard = more gems, better tiers
// Legendary dungeons = mythic gems possible
```

### Exchange Houses

Exchange houses convert gems to currency (and back):

```typescript
interface ExchangeHouse {
  settlementId: string;
  name: string;                    // "The Golden Scale"
  
  exchangeRate: number;            // 0.95 = 5% fee
  appraisalFee: number;            // Per gem
  tierModifiers: Record<GemTier, number>;  // Premium for rare gems
  
  reserves: {                      // What they can pay out
    platinum: number;
    gold: number;
    // ...
  };
  
  services: {
    buyGems: boolean;              // Buy from adventurers
    sellGems: boolean;             // Rare
    appraisal: boolean;
    currencyExchange: boolean;
    letterOfCredit: boolean;       // For large sums
    gemCutting: boolean;           // Improve quality
  };
}
```

### Trader Types

| Type | Business Model | Makes Money By |
|------|----------------|----------------|
| **Stocker** | Arbitrage | Buy low in A, sell high in B |
| **Mover** | Freight | Get paid to transport others' cargo |
| **Hybrid** | Both | Flexibility, higher capital needs |

### Transport Modes

**Land Transport:**

| Mode | Capacity | Speed | Requires Road | Risk |
|------|----------|-------|---------------|------|
| Porter | 50 lbs | 15 mi/day | No | High |
| Pack Animal | 200 lbs | 20 mi/day | No | Medium |
| Cart | 500 lbs | 20 mi/day | Yes | Normal |
| Wagon | 2000 lbs | 15 mi/day | Yes | Low |
| Caravan | 10000 lbs | 12 mi/day | Yes | Very Low |

**Sea Transport:**

| Mode | Capacity | Speed | Crew | Risk |
|------|----------|-------|------|------|
| Rowboat | 500 lbs | 20 mi/day | 2 | High |
| Sailing Boat | 2000 lbs | 40 mi/day | 4 | Medium |
| Cog | 50000 lbs | 60 mi/day | 15 | Low |
| Galleon | 200000 lbs | 80 mi/day | 50 | Very Low |
| Barge (river) | 100000 lbs | 30 mi/day | 8 | Low |

### Trade Route Programs

Routes are **programs** that caravans execute:

```typescript
interface TradeRouteProgram {
  id: string;
  name: string;                    // "The Iron Road"
  
  routeType: 'circuit' | 'shuttle' | 'one_way' | 'hub_spoke';
  
  nodes: Array<{
    settlementId: string;
    order: number;                 // Sequence
    actions: Array<{
      type: 'buy' | 'sell' | 'load' | 'unload' | 'resupply' | 'rest';
      commodityId?: string;
      quantity?: number;
      priceThreshold?: number;     // Only act if price is right
    }>;
  }>;
  
  edges: Array<{
    fromOrder: number;
    toOrder: number;
    distance: number;              // Miles
    dangerLevel: string;
    tolls: number;                 // GP to traverse
  }>;
  
  preferredMode: TransportMode;
  primaryCommodities: string[];
  estimatedProfit: number;         // Per circuit
}
```

### Caravan Execution

```typescript
// Caravans tick through routes
const result = LogisticsEngine.tickCaravan(
  caravan,
  route,
  slotsElapsed,   // 48 slots = 1 day
  marketPrices
);

// Result contains:
// - Events: departed, arrived, bought, sold, attacked, etc.
// - Position: current node, progress on edge
// - Cargo changes: loaded/unloaded
// - Financials: revenue, expenses
// - Problems: bandits, weather, breakdowns
```

### Arbitrage Discovery

Smart traders (and smart NPCs) find profitable opportunities:

```typescript
const opportunities = LogisticsEngine.findArbitrageOpportunities(
  mirabarMarket,
  waterdeepMarket,
  { distance: 300, dangerLevel: 'patrolled', travelDays: 10 },
  'wagon'
);

// Returns sorted by risk-adjusted profit:
// {
//   commodityId: 'iron_ore',
//   buyPrice: 1,
//   sellPrice: 3,
//   transportCost: 0.5,
//   netProfitPerUnit: 1.5,
//   returnOnInvestment: 150%,
//   riskAdjustedProfit: 1425gp
// }
```

### Freight Contracts

Movers take contracts to transport others' cargo:

```typescript
interface FreightContract {
  shipperId: string;               // Who wants cargo moved
  carrierId: string;               // Trading company moving it
  
  cargo: Array<{
    commodityId: string;
    quantity: number;
    declaredValue: number;         // For insurance
  }>;
  
  origin: string;
  destination: string;
  
  paymentAmount: number;           // GP for the job
  paymentTerms: 'upfront' | 'on_delivery' | 'split';
  
  deliveryDeadline: string;
  lateDeliveryPenalty: number;     // GP per day late
}
```

### Information Flow via Trade

Caravans carry more than cargo - they carry **news**:

```
CARAVAN ARRIVES IN WATERDEEP:
  - Crew talks in taverns
  - "Mirabar iron prices dropped" → Merchants adjust
  - "War in the east" → Weapon demand spikes
  - "New mine discovered" → Prospectors depart
  
INFORMATION PROPAGATION:
  - Speed: Caravan speed (not instant)
  - Accuracy: Degrades with distance/retellings
  - Advantage: Those with faster routes know first
```

### Economic Loop Complete

```
DUNGEONS → GEMS → EXCHANGE HOUSES → CURRENCY
                                        ↓
                              SETTLEMENTS (demand)
                                        ↓
GEOGRAPHY → DEPOSITS → EXTRACTION → COMMODITIES
                                        ↓
                              LOGISTICS (transport)
                                        ↓
                              MARKETS (price discovery)
                                        ↓
                              CONSUMPTION + PRODUCTION
                                        ↓
                              ECONOMY TICK (weekly)
```

---

## Industry System (SECONDARY Sector)

**Where raw materials become finished goods.**

See: `engine/industry/`

### Guilds - Proto-Corporations

Guilds solve problems individual craftsmen can't:
- **Bulk purchasing**: Pool money to buy raw materials at scale
- **Quality standards**: Guild mark guarantees minimum quality
- **Training**: Apprenticeship system ensures skill transfer
- **Monopoly power**: Non-members can't practice the trade
- **Legal protection**: Guild defends members in disputes

### Guild Types

| Category | Guild Types |
|----------|-------------|
| **Craft** | Smiths, Masons, Carpenters, Weavers, Tanners, Potters, Jewelers |
| **Food** | Bakers, Brewers, Vintners, Butchers |
| **Specialized** | Alchemists, Scribes, Shipwrights, Glassblowers |
| **Merchant** | Merchants, Importers, Bankers |
| **Service** | Innkeepers, Entertainers, Teamsters |
| **D&D Specific** | Arcane (magic items), Apothecaries, Adventurers |

### Guild Ranks

```
OUTSIDER → APPLICANT → APPRENTICE → JOURNEYMAN → MASTER → GUILD MASTER
              ↓            ↓            ↓           ↓
           (apply)    (3-7 years)  (can sell)  (own shop)
                          ↓                     (train others)
                     (work for master)
```

| Rank | Bulk Discount | Can Sell | Take Apprentices | Vote |
|------|---------------|----------|------------------|------|
| Outsider | 0% | No | No | No |
| Apprentice | 5% | No | No | No |
| Journeyman | 10% | Yes | No | Yes |
| Master | 15% | Yes | Yes | Yes |
| Guild Master | 25% | Yes | Yes | Yes |

### Monopoly Enforcement

```typescript
// What happens if non-members try to work
const monopoly = {
  enforcementLevel: 'strong',
  nonMemberPenalties: {
    cannotSell: true,        // Can't sell goods
    cannotBuy: true,         // Can't buy materials (suppliers won't sell)
    priceMarkup: 0.5,        // 50% extra if they find materials
    fines: 100,              // GP per offense
  },
  licenseType: 'temporary',  // Can buy temporary permission
  licenseFee: 50,            // Per month
};
```

### Guild Economics

```typescript
// Guild pools purchasing power
const smithsGuild = {
  commodityPool: {
    commodities: [
      { commodityId: 'iron_ore', monthlyNeed: 500 },
      { commodityId: 'coal', monthlyNeed: 250 },
    ],
    purchasingPower: 2000,   // GP available
    bulkDiscount: 0.2,       // 20% off for volume
  },
};

// Member price = market × (1 - personal discount - guild discount)
// Master smith buying iron: 5gp × (1 - 0.15 - 0.2) = 3.25gp
```

### Workshops

Physical production sites where transformation happens:

```typescript
interface Workshop {
  type: WorkshopType;          // 'forge', 'alchemy_lab', etc.
  
  capacity: {
    workstations: number;      // How many can work at once
    storageCapacity: number;   // Raw materials storage
  };
  
  workers: Array<{
    npcId: string;
    rank: GuildRank;
    skillLevel: number;        // 1-5
    wage: number;              // Per day
  }>;
  
  tools: Array<{
    name: string;
    condition: number;         // 0-100
    qualityModifier: number;   // +/- to quality rolls
  }>;
  
  materialInventory: Record<string, number>;
  productionQueue: ProductionOrder[];
}
```

### Recipes (Transformation Formulas)

```typescript
const longswordRecipe: Recipe = {
  name: 'Longsword',
  workshopType: 'weaponsmith',
  
  inputs: [
    { commodityId: 'iron', quantity: 3 },
    { commodityId: 'timber', quantity: 1 },
    { commodityId: 'leather', quantity: 1 },
  ],
  
  outputs: [
    { itemId: 'longsword', quantity: 1, qualityInherited: true },
  ],
  
  baseSlots: 8,              // Base production time
  minimumSkillLevel: 2,
  baseDifficulty: 12,        // DC for quality roll
  canProduceMasterwork: true,
};
```

### Quality System

Craftsman skill + tool quality + d20 roll vs recipe difficulty:

| Margin | Quality | Price Mult | Durability |
|--------|---------|------------|------------|
| < -5 | Poor | 0.5x | 0.5x |
| 0-4 | Common | 1.0x | 1.0x |
| 5-9 | Good | 1.5x | 1.25x |
| 10-14 | Excellent | 2.0x | 1.5x |
| 15+ | Masterwork | 3.0x | 2.0x |

```typescript
// Skill 4 smith with excellent tools (+2), DC 12
// Roll 15: total = 15 + 4 + 2 = 21, margin = 9 → Good quality

// Natural 20 bumps quality up one level
// Natural 1 always produces Poor quality
```

### Production Time

Skill affects production speed (velocity concept):

```typescript
// Base: 8 slots for longsword
// Skill 1: 8 × 1.33 = 10.6 slots (slower)
// Skill 3: 8 × 0.67 = 5.4 slots (faster)
// Skill 5: 8 × 0.5 = 4 slots (master speed)

// Apprentice helps: -20%
// Excellent tools: -10%

// Master smith with apprentice and excellent tools:
// 8 × 0.5 × 0.8 × 0.9 = 2.9 slots ≈ 1.5 hours
```

### Workshop ↔ Guild Connection

| Workshop Type | Guild | Inputs | Outputs |
|---------------|-------|--------|---------|
| forge | Smiths | iron_ore, coal | iron, tools |
| weaponsmith | Smiths | iron, timber, leather | weapons |
| armorsmith | Smiths | iron, leather | armor |
| alchemy_lab | Alchemists | herbs, magic_components | potions |
| enchanting_circle | Arcane | gems, magic_components | magic_items |
| tannery | Tanners | hides | leather |
| brewery | Brewers | grain, water | ale, beer |

### Secondary Sector Flow

```
EXTRACTION OUTPUT (iron_ore from Mirabar mines)
        ↓
LOGISTICS (caravan to Waterdeep)
        ↓
GUILD PURCHASE (Smiths Guild buys at bulk discount)
        ↓
DISTRIBUTION (allocated to member workshops)
        ↓
WORKSHOP (Master Grimm's Forge)
        ↓
RECIPE (iron_ore + coal → iron ingot)
        ↓
RECIPE (iron + timber + leather → longsword)
        ↓
QUALITY ROLL (skill 4 + tools 2 + d20 15 = excellent)
        ↓
PRODUCT (Excellent Longsword, worth 30gp)
        ↓
SALE (to adventurer, guild takes 5% fee)
```

### Why Guilds Matter for Players

1. **Crafting characters need membership** to sell goods
2. **Bulk discounts** for materials (15-25% off)
3. **Training access** for skill improvements
4. **Legal protection** in disputes
5. **Information network** for opportunities
6. **Reputation** that opens doors

---

## Markets System (TERTIARY Sector)

**Where goods meet buyers. Where merchants climb the ladder.**

See: `engine/markets/`

### The Merchant's Dream

Every merchant starts somewhere and climbs:

```
PEDDLER → STALL → SHOP → EMPORIUM → TRADING HOUSE → CONSORTIUM → MEGAMART
   ↓         ↓       ↓        ↓            ↓             ↓           ↓
  Cart    Market  Fixed    Multi-     Bulk trade    Regional    Everything
         square  location  product    + routes      network      store
```

**Above shop level, you cross into LOGISTICS territory.**

A trading house is a stocker. A megamart is proto-Walmart.

### Merchant Tiers

| Tier | Min Capital | Min Rep | Guild Required | Employees | Margin |
|------|-------------|---------|----------------|-----------|--------|
| Peddler | 10gp | 0 | No | 0 | 30% |
| Stall | 100gp | 10 | No | 0 | 25% |
| Shop | 500gp | 25 | Yes | 1 | 20% |
| Emporium | 2,000gp | 50 | Yes | 5 | 15% |
| Trading House | 10,000gp | 70 | Yes | 20 | 10% |
| Consortium | 50,000gp | 85 | Yes | 100 | 8% |
| Megamart | 100,000gp | 90 | Yes | 500 | 5% |

**The Walmart Model**: Tiny margins, massive volume. A megamart makes 5% on everything but sells to everyone.

### Merchant Specializations

| Category | Specializations |
|----------|-----------------|
| **Single-Category** | Grocer, Clothier, Armorer, Apothecary, Jeweler, Bookseller, Chandler, Vintner, Spice Merchant, Furrier |
| **Multi-Category** | General Goods, Luxury Goods, Adventuring Supplies |
| **Services** | Moneychanger, Pawnbroker, Fence (illegal) |
| **Wholesale** | Commodities, Importer, Exporter |

### Market Venues

Where merchants operate:

| Type | Description | Features |
|------|-------------|----------|
| Cart | Mobile, follows crowds | No rent, high risk |
| Stall | Market square spot | Weekly rent, moderate traffic |
| Shop | Single storefront | Fixed location, loyal customers |
| Emporium | Large multi-room | Display capacity, prestige |
| Warehouse Outlet | Bulk sales | Low service, high volume |
| Auction House | Bidding on goods | Buyer premium, seller commission |

### Market Districts

Markets cluster by type:

```typescript
const districts = [
  "general_market",      // Mixed goods, town square
  "luxury_quarter",      // High-end shops
  "docks_market",        // Near port, imports
  "craft_district",      // Workshops selling direct
  "foreign_bazaar",      // Exotic goods
  "night_market",        // After-hours, seedier
  "wholesale_district",  // Bulk trading
];
```

Each district has:
- **Rent levels** (luxury quarter costs more)
- **Foot traffic** (docks busy, wholesale quiet)
- **Crime rate** (night market: watch your purse)
- **Market days** (special high-traffic days)

### Haggling System

Every transaction is negotiable:

```typescript
// Seller resistance = base DC + greed + scarcity - buyer reputation
const resistance = calculateSellerResistance(merchant, context);

// Buyer rolls: d20 + Persuasion modifier
const result = resolveHaggle(context, merchant, roll, persuasionBonus);

// Results:
// - Natural 20: Best deal (20%+ off)
// - Beat DC by 10+: Great (15% off)
// - Beat DC by 5+: Good (10% off)
// - Beat DC: Marginal (5% off)
// - Fail: No discount
// - Natural 1: Price goes UP, merchant offended
```

Haggling has **rounds**. Push too hard, merchant walks away.

### Price Discovery

Prices emerge from fundamentals:

```typescript
function discoverPrice(
  commodityId: string,
  basePrice: number,
  supply: number,
  demand: number,
  activeEvents: MarketEvent[],
  speculativePositions: SpeculativePosition[],
  regulations: { priceFloor?, priceCeiling?, taxRate? },
): PriceDiscoveryResult {
  // 1. Supply/demand ratio (fundamental)
  // 2. Market events (temporary shocks)
  // 3. Speculation pressure (smart money betting)
  // 4. Regulations (floors/ceilings)
  // 5. Random noise (volatility)
}
```

### Supply/Demand Ratios

| Ratio | Multiplier | Trend |
|-------|------------|-------|
| 3:1+ (glut) | 0.25x | Crashing |
| 2:1 (oversupply) | 0.4x | Falling |
| 1.5:1 | 0.7x | Falling |
| 1:1 (balanced) | 1.0x | Stable |
| 1:1.25 | 1.5x | Rising |
| 1:2 | 2.5x | Spiking |
| 1:4+ (shortage) | 4.0x | Spiking |

### Market Events

Things that shake the market:

| Category | Events |
|----------|--------|
| **Supply** | Shipment arrived, delayed, lost; warehouse fire; spoilage |
| **Demand** | Festival, military requisition, noble order, fashion change |
| **Price** | Price war, price fixing, currency fluctuation, speculation bubble, bubble burst |
| **Structure** | New merchant, bankruptcy, guild action, regulation |
| **External** | Foreign traders, trade fair, embargo effect |

### Speculation System

Smart merchants bet on the future:

```typescript
interface SpeculativePosition {
  traderId: string;
  commodityId: string;
  positionType: "long" | "short";  // Betting on rise or fall
  quantity: number;
  entryPrice: number;
  
  marginDeposited: number;         // Collateral
  marginRequired: number;          // If position moves against you
  marginCallTriggered: boolean;    // Forced liquidation?
  
  unrealizedPnL: number;           // Current profit/loss
}
```

Speculation affects price discovery - if lots of traders are betting "long", prices rise from the pressure.

### Merchant AI

Merchants make decisions:

```typescript
function simulateMerchantDecision(
  merchant: Merchant,
  market: SettlementMarketComplete,
): MerchantDecision {
  // Priority order:
  // 1. SURVIVAL - Sell inventory if capital < 2x operating costs
  // 2. RESTOCKING - Buy commodities when below 30% optimal stock
  // 3. SPECULATION - Buy crashed goods expecting rebound (if risk-tolerant)
  // 4. TAKE PROFITS - Sell spiking goods at 50%+ profit
  // 5. TIER UPGRADE - Upgrade if requirements met
  // 6. STAFFING - Hire/fire based on needs and finances
}
```

### Merchant Progression Example

```
YEAR 1: Elara the Peddler
  - Capital: 50gp
  - Inventory: Trinkets, minor potions
  - Income: 2gp/day (good days)
  - Dream: A real shop

YEAR 3: Elara's Stall
  - Capital: 250gp
  - Reputation: 15
  - Inventory: Potions, components
  - Income: 5gp/day average
  - Saving for guild membership

YEAR 6: Elara's Apothecary (Shop)
  - Capital: 1,200gp
  - Reputation: 35
  - Guild: Apothecaries (Journeyman)
  - Employees: 1 apprentice
  - Income: 15gp/day
  - Regular customers: 12

YEAR 12: Elara's House of Remedies (Emporium)
  - Capital: 8,000gp
  - Reputation: 60
  - Guild: Apothecaries (Master)
  - Employees: 6
  - Multiple product lines
  - Supplies other merchants

YEAR 20: Remedies Consortium (Trading House)
  - Capital: 45,000gp
  - Reputation: 80
  - Trade routes to 5 cities
  - Employees: 30
  - Wholesale distribution
  - Players might seek her out for rare components
```

### Auction Houses

For rare and valuable items:

```typescript
interface AuctionHouse {
  specialization: "general" | "art_antiques" | "magical" | 
                  "livestock" | "real_estate" | "commodities";
  
  reputation: number;              // 0-100
  exclusivity: "public" | "members" | "invitation";
  minimumLotValue: number;         // Won't auction below this
  
  buyerPremium: number;            // 10% added to hammer price
  sellerCommission: number;        // 15% taken from seller
}
```

Auctions create price discovery for unique items where no market price exists.

### Black Markets

Where illegal goods flow:

```typescript
const blackMarket = {
  exists: true,
  size: "moderate",           // tiny → dominant
  goods: ["poisons", "stolen_goods", "contraband", "slaves"],
  accessDifficulty: 15,       // DC to find a contact
};
```

Black markets emerge when:
- Goods are banned (poisons, some magic)
- Taxes too high (smuggling)
- Guilds too restrictive (unlicensed craftsmen)

### Why Markets Matter for Players

1. **Prices vary by location** - Buy low here, sell high there
2. **Haggling is a skill** - Charisma characters shine
3. **Information is power** - Know about the war before prices spike
4. **Investment opportunities** - Buy cheap during crashes
5. **NPC contacts** - Merchants know things
6. **Economic quests** - Break a monopoly, expose price fixing
7. **Business ownership** - Players can become merchants too

### Complete Economic Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THE LIVING ECONOMY                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DUNGEONS ─────────────► GEMS ─────────────► EXCHANGE HOUSES            │
│  (Adventurers mine      (Mob loot is         (Convert to               │
│   the monetary supply)   the money)           currency)                │
│                                                    │                    │
│                                                    ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     SETTLEMENTS (Demand)                         │  │
│  │  Population consumes food, fuel, goods, services                 │  │
│  │  Lifestyle costs drive NPC economic pressure                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                    ▲                    │
│                                                    │                    │
│  GEOGRAPHY ────► DEPOSITS ────► EXTRACTION ────► COMMODITIES           │
│  (What exists)   (PRIMARY)      (Operations)     (Raw materials)       │
│                                                    │                    │
│                                                    ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  LOGISTICS (Transport)                           │  │
│  │  Stockers: Buy low, sell high (arbitrage)                        │  │
│  │  Movers: Get paid to transport cargo (freight)                   │  │
│  │  Routes: Programs that caravans execute                          │  │
│  │  Caravans: Tick through routes, carry goods AND news             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                    │                    │
│                                                    ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  INDUSTRY (Transform)                            │  │
│  │  Guilds: Pool purchasing, monopolies, training                   │  │
│  │  Workshops: Recipes transform materials                          │  │
│  │  Quality: Skill + tools + roll = poor → masterwork               │  │
│  │  Craftsmen: Apprentice → Journeyman → Master                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                    │                    │
│                                                    ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   MARKETS (Sell)                                 │  │
│  │  Merchants: Peddler → Stall → Shop → Emporium → Trading House    │  │
│  │  Venues: Carts, stalls, shops, auction houses                    │  │
│  │  Price Discovery: Supply + demand + events + speculation         │  │
│  │  Haggling: Charisma vs merchant greed                            │  │
│  │  Events: Shortages, gluts, bubbles, crashes                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                    │                    │
│                                                    ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              FACTION CONTROL LAYER (The Invisible Hand)          │  │
│  │  Taxes, tariffs, embargoes, monopolies                           │  │
│  │  Corrupt officials, protection rackets                           │  │
│  │  BLACK MARKETS: Where banned goods flow                          │  │
│  │  Smuggling routes, crackdowns, heat                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                    │                    │
│                                                    ▼                    │
│                          CONSUMPTION ◄───────────────                   │
│                          (Weekly tick)                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Faction Control Layer

**THE ECONOMY IS NOT FREE.**

See: `engine/factions/`

Every tax, tariff, and embargo is a faction decision. The free market is a myth. Power flows through control of trade.

### Economic Interventions

Factions shape the economy through:

| Intervention | Effect | Creates Black Market? |
|--------------|--------|----------------------|
| **Tax** | % of all transactions | Smuggling to avoid |
| **Tariff** | Import/export surcharge | Smuggling routes |
| **Embargo** | Block trade with target | Contraband demand |
| **Blockade** | Physical route closure | Severe shortage |
| **Monopoly** | Exclusive trade rights | Underground competition |
| **Price Ceiling** | Max price (protects consumers) | Shortages, black market |
| **Price Floor** | Min price (protects producers) | Surplus, illegal dumping |
| **Rationing** | Limit per person | Black market distribution |
| **License Requirement** | Must have permit | Unlicensed trade |
| **Conscription** | Take workers for military | Labor shortage |
| **Protection Racket** | Pay or suffer "accidents" | Underground resistance |
| **Currency Debasement** | Reduce metal in coins | Inflation, barter |

### Intervention Effects

```typescript
// Tax example: 10% sales tax
const effects = {
  priceEffect: 1.10,      // Prices +10%
  supplyEffect: 0.98,     // Slight supply reduction
  demandEffect: 0.97,     // Demand drops
  unrestEffect: 2,        // Minor unrest
  revenueMultiplier: 1.0, // Full collection
};

// Embargo example
const embargoEffects = {
  priceEffect: 3.0,       // Prices TRIPLE
  supplyEffect: 0.1,      // 90% supply reduction
  demandEffect: 1.5,      // Panic buying
  unrestEffect: 40,       // Major unrest
  revenueMultiplier: 0,   // No revenue (it's a ban)
};
```

### Enforcement Levels

| Level | Evasion DC | Effect |
|-------|------------|--------|
| None | Auto | Intervention exists on paper only |
| Minimal | DC 5 | Easy to evade, low risk |
| Normal | DC 12 | Standard enforcement |
| Strict | DC 18 | Active enforcement, high risk |
| Absolute | DC 25 | Military enforcement, severe penalties |

### Unrest from Interventions

Heavy-handed economic control creates unrest:

```
High taxes        → 20% unrest contribution
Embargo          → 40% unrest
Conscription     → 35% unrest
Price controls   → 10-15% unrest
Protection racket → 30% unrest

Unrest > 50%: Protests, strikes
Unrest > 75%: Riots, resistance
Unrest > 90%: Rebellion
```

---

## Black Markets

**Where banned goods flow in shadow.**

### Why Black Markets Exist

Black markets emerge when:
- Goods are **banned** (poisons, some magic, slaves)
- **Taxes** too high (smuggling becomes profitable)
- **Embargoes** create scarcity (people need what they need)
- **Guilds** too restrictive (unlicensed craftsmen)
- **Regulations** burdensome (skip the paperwork)

### Black Market Goods Categories

| Category | Examples | Risk Level |
|----------|----------|------------|
| **Universally Illegal** | Poisons, slaves, necromancy components, demon contracts | Extreme |
| **Conditionally Illegal** | Stolen goods, contraband, unlicensed weapons, narcotics | High |
| **Regulated** | Restricted potions, military equipment, exotic creatures | Medium |
| **Tax Evaded** | Smuggled luxury goods, smuggled commodities | Low |

### Black Market Pricing

```typescript
// Stolen goods: CHEAPER than legal (fence wants to move them)
stolen_goods: { baseMultiplier: 0.5, riskPremium: 0.01 }

// Smuggled luxury: Cheaper (avoiding tariffs)
smuggled_luxury: { baseMultiplier: 0.7, riskPremium: 0.01 }

// Poisons: More expensive (specialized, risky)
poisons: { baseMultiplier: 2.0, riskPremium: 0.02 }

// Demon contracts: Very expensive (extreme risk)
demons_contracts: { baseMultiplier: 5.0, riskPremium: 0.10 }

// Final price = base × multiplier × (1 + riskPremium × heat) × fenceCut
```

### Heat System

"Heat" represents how much attention authorities are paying:

```
Heat 0-20:   Business as usual
Heat 21-40:  Increased patrols, cautious
Heat 41-60:  Active investigation
Heat 61-80:  Crackdowns likely
Heat 81-100: Martial law, desperate

Heat increases from:
  - Failed smuggling attempts
  - Sloppy transactions
  - Informants
  - Crackdowns (ironically)

Heat decreases from:
  - Time passing
  - Bribes to officials
  - Successful crackdowns (temporarily)
  - New distractions for authorities
```

### Fences

NPCs who buy and sell illegal goods:

```typescript
interface Fence {
  name: string;
  specialty: BlackMarketGoodsCategory[];
  trustworthiness: number;     // Will they rat you out?
  priceModifier: number;       // Their cut
  knownToParty: boolean;
}

// Finding a fence:
// Investigation/Streetwise DC = market.accessDifficulty.findContactDC
// Reputation helps
// Method matters:
//   - Tavern gossip: Safe, slow
//   - Follow criminal: Risky, faster
//   - Bribe guard: Expensive, fast
//   - Existing contact: Reliable
```

### Black Market Locations

| Type | Access | Risk | Volume |
|------|--------|------|--------|
| Tavern backroom | Easy | Low | Small |
| Warehouse | Medium | Medium | Large |
| Sewer/Underground | Hard | Low | Medium |
| Docks | Medium | Medium | Large |
| Shop front | Easy | High | Small |
| Traveling | Variable | Low | Small |

---

## Corruption System

**Every official has a price.**

### Corrupt Officials

```typescript
interface CorruptOfficial {
  position: string;           // "Harbor Master", "Tax Collector"
  authority: string[];        // What they control
  corruptionLevel: "opportunistic" | "regular" | "deep" | "total";
  
  services: Array<{
    service: string;          // "Look the other way"
    baseCost: number;
    riskToOfficial: "low" | "medium" | "high";
  }>;
  
  suspicionLevel: number;     // 0-100
}
```

### Authority Types

What corrupt officials can provide:

| Authority | Services |
|-----------|----------|
| **Customs** | Pass goods without inspection, lose paperwork |
| **Taxes** | Reduce assessment, lose records |
| **Licenses** | Issue without qualifications, backdate |
| **Patrols** | Change routes, timing, look away |
| **Investigations** | Warn of raids, lose evidence |
| **Courts** | Favorable rulings, reduce sentences |
| **Prisons** | Comfortable conditions, early release, "escape" |
| **Records** | Falsify documents, erase history |

### Bribery Resolution

```typescript
function attemptBribe(official, amount, service): BribeResult {
  // Base success: 50%
  
  // Corruption level bonus:
  //   opportunistic: +0%
  //   regular: +20%
  //   deep: +30%
  //   total: +40%
  
  // Amount bonus:
  //   >= required: +20%
  //   >= 1.5x required: +30%
  
  // Previous relationship: +5% per past bribe
  
  // Service risk penalty:
  //   low: 0%
  //   medium: -10%
  //   high: -20%
  
  // Failure options:
  //   - Refuses (most common)
  //   - Reports you (rare, opportunistic officials)
  //   - Demands more (greedy)
}
```

---

## Smuggling Routes

**Underground arteries of forbidden trade.**

### Route Types

| Method | Detection Chance | Capacity | Cost |
|--------|------------------|----------|------|
| Hidden cargo | 15% | High | Low |
| False documentation | 10% | High | Medium |
| Overland bypass | 20% | Low | High |
| Underground/Sewers | 5% | Low | Medium |
| Bribed passage | 5% | High | Very High |
| Magical | 2% | Low | Extreme |

### Smuggling Operation

```typescript
function attemptSmuggling(route, goods, smuggler): SmugglingResult {
  // Base success: 70%
  
  // Route status:
  //   active: +0%
  //   watched: -20%
  //   compromised: -40%
  
  // Goods risk (from category multipliers)
  // Smuggler skill bonus
  // Enforcement level of interventions
  
  // Outcomes:
  //   Full success: All goods delivered, 30% profit
  //   Partial: Some goods dumped (10-40%)
  //   Failure: Goods seized, route potentially compromised
}
```

### Route Compromise

When a route is compromised:
1. Detection chance doubles
2. Heat increases significantly
3. Officials watch waypoints
4. May need to abandon route
5. Can be "repaired" with bribes or time

---

## Crackdowns

**When authorities strike back.**

### Crackdown Types

| Type | Resources Needed | Effect |
|------|------------------|--------|
| Raid | Guards, surprise | Seize goods, arrests |
| Sweep | Many guards | Widespread arrests |
| Infiltration | Investigators, time | Expose network |
| Audit | Investigators, records | Financial crimes |
| Execution | Public space | Deterrence, heat |

### Crackdown Success

```typescript
function simulateCrackdown(crackdown, blackMarket, corruptOfficials) {
  let successChance = 0.3;  // Base
  
  // Resources
  successChance += guards * 0.02;
  successChance += investigators * 0.05;
  successChance += gold * 0.0001;
  
  // Corrupt officials sabotage
  for (corrupt of corruptOfficials) {
    successChance -= 0.1;  // Each one helps criminals
  }
  
  // Market size
  //   tiny: +20%
  //   dominant: -20%
  
  // Leaked warning: -40%
}
```

### Crackdown Aftermath

Successful crackdown:
- Arrests made (NPCs removed from play)
- Goods seized (value lost)
- Heat increases temporarily
- Black market shrinks
- Prices spike (scarcity)

Failed crackdown:
- Officials look foolish
- Criminal confidence grows
- Heat may actually drop
- Corruption exposed (sometimes)

---

## Player Interaction

### Criminal Reputation

Players can build criminal standing:

```
Standing -100 to -50: Marked for death (betrayed them)
Standing -50 to 0:    Unwelcome
Standing 0 to 25:     Tolerated (basic access)
Standing 25 to 50:    Trusted (better prices, more goods)
Standing 50 to 75:    Inner circle (rare goods, jobs)
Standing 75 to 100:   Made man (leadership opportunities)
```

### Personal Heat

Each player has heat per settlement:

```
Heat 0-10:   Clean
Heat 11-30:  Person of interest
Heat 31-50:  Wanted for questioning
Heat 51-70:  Arrest warrant
Heat 71-90:  Shoot on sight
Heat 91-100: Military response
```

Heat can be reduced by:
- Bribes
- Laying low (time)
- New identity
- Powerful patrons
- Framing someone else

### Adventure Hooks

The control layer creates adventure opportunities:

1. **Break the Monopoly** - A guild has strangled trade, people suffer
2. **Smuggle the Medicine** - Healing potions are embargoed, people die
3. **Expose the Corruption** - An official is on the take
4. **Find the Fence** - Someone's selling stolen crown jewels
5. **Run the Blockade** - A city is starving, you have a ship
6. **Assassinate the Tax Collector** - Faction wants someone gone
7. **Protect the Caravan** - Smugglers need muscle
8. **Infiltrate the Ring** - Authorities want inside info

---

## Player Intervention Layer

**PLAYERS BUILD EMPIRES, NOT COLLECT SWORDS.**

See: `engine/player/`

The player's character is an adventurer. Adventurers don't:
- Run shops (they **OWN** shops)
- Craft swords (they **EMPLOY** smiths)
- Guard caravans (they **HIRE** guards)
- Farm fields (they **COLLECT** rent)

This layer provides the systems for players to transition from adventurer to landowner, merchant lord, guild master, or faction power.

### The Ownership Pipeline

```
FAME ────► DEED UNLOCK ────► PROPERTY ACQUISITION ────► FOLLOWER ASSIGNMENT
                                                               │
                                                               ▼
                                              DOWNTIME ORDERS ────► AUTOMATED OPERATION
                                                                          │
                                                                          ▼
                                                              PROFIT/LOSS REPORTS
```

Players make **strategic decisions**. Followers **execute**. The simulation **runs**. Players **collect results**.

---

### Property & Deed System

**You can't own what you can't prove you own.**

#### Deed Types

| Category | Types | Examples |
|----------|-------|----------|
| **Urban** | dwelling, shop, workshop, warehouse, tavern, temple | House in the merchant quarter, smithy |
| **Rural** | farmland, pasture, forest, mine, fishery | Wheat fields outside town, iron mine |
| **Special** | fort, tower, manor, ship, guild_seat | Wizard tower, trading vessel |
| **Claims** | land_claim, ruin_claim, dungeon_claim | Undeveloped land, cleared fortress |

#### Acquisition Methods

| Method | Description | Risk |
|--------|-------------|------|
| **Purchase** | Bought with gold | Low (if legal) |
| **Grant** | Given by faction/noble | Comes with obligations |
| **Inheritance** | From family/patron | May be contested |
| **Reward** | Quest completion | Clean |
| **Fame Unlock** | Fame threshold reached | Must maintain standing |
| **Conquest** | Took by force (legitimized) | Political complications |
| **Discovery** | Dungeon claim | Must clear and hold |

#### Deed Rights & Obligations

```typescript
// What a deed grants
rights: {
  occupy: true,       // Live there
  modify: true,       // Renovate
  sublet: true,       // Rent out
  sell: true,         // Transfer ownership
  bequeath: true,     // Pass to heirs
  extract: false,     // Mining/logging (special deeds only)
  tax: false,         // Collect taxes (noble deeds only)
  justice: false,     // Low/high justice (noble deeds only)
}

// What a deed requires
obligations: [
  {
    type: "tax",
    toFaction: "city_council",
    amount: 50,                  // GP per year
    frequency: "yearly",
  },
  {
    type: "service",
    toFaction: "crown",
    description: "Provide 2 soldiers in time of war",
    frequency: "on_demand",
  },
]
```

---

### Fame → Deed Thresholds

**You can't buy what society won't sell you.**

Fame unlocks property tiers:

| Fame Level | Threshold | Deeds Unlocked | Description |
|------------|-----------|----------------|-------------|
| Local Recognition | 10 | dwelling | Can buy a home |
| Trusted Citizen | 25 | shop, workshop | Commercial property |
| Respected Member | 50 | warehouse, tavern, farmland | Larger holdings |
| Notable Figure | 75 | mine, fort, ship | Strategic assets |
| Faction Hero | 100 | manor, tower, guild_seat | Prestige properties |
| Legendary | 150 | temple | Found institutions |

```
EXAMPLE: Elara the Bard

Fame with Merchants Guild: 35
Fame with City Council: 20
Fame with Temple of Sune: 45

→ Highest fame: 45 (Temple)
→ Can purchase: dwelling, shop, workshop
→ Next unlock at 50: warehouse, tavern, farmland

The party cleared the undead from the old temple at fame 45.
At 50 fame, the grateful Temple of Sune offers her the tavern 
attached to the pilgrimage route.
```

---

### Housing Market

**Not every building is for sale. Not every sale is fair.**

Each settlement has a housing market with:

```typescript
interface HousingMarket {
  settlementId: string;
  
  // Market conditions
  marketCondition: "buyers_market" | "balanced" | "sellers_market" | "bubble" | "crash";
  priceIndex: number;           // 100 = normal, 150 = 50% above
  rentIndex: number;
  vacancyRate: number;          // 0-1
  
  // Available properties
  forSale: Property[];
  forRent: Property[];
  
  // Trends
  trends: {
    priceChange30Days: number;
    hotDistricts: string[];
    coldDistricts: string[];
  };
}
```

#### Market Conditions

| Condition | Vacancy | Price Effect | Opportunity |
|-----------|---------|--------------|-------------|
| Buyer's Market | High (>15%) | -20% to -40% | Buy now |
| Balanced | Normal (8-12%) | Normal | Fair deals |
| Seller's Market | Low (<8%) | +20% to +50% | Sell now |
| Bubble | Very low | +100%+ | Danger zone |
| Crash | Very high | -50%+ | Opportunities for bold |

---

### Dungeon → Claim Conversion

**Clear the dungeon. Claim the land.**

When adventurers clear a dungeon, they generate **claimable assets**:

```typescript
// Party clears an abandoned fortress infested with undead
const claim = generateDungeonClaims(
  dungeonId: "fortress_dreadhold",
  dungeonName: "Dreadhold Keep",
  dungeonType: "fortress",
  dungeonSize: "large",
  partyId: "silver_blades",
  partyName: "The Silver Blades"
);

// Result:
claimableAssets: [
  {
    type: "fort",
    name: "Fortress",
    condition: "ruined",          // Dungeons are always ruined
    estimatedValue: 32000,        // 4x base for large
    renovationCost: 48000,        // Significant investment
    requirements: [
      "Military architect",
      "Masons Guild contract",
      "12 months labor",
      "Garrison"
    ],
  },
  {
    type: "dwelling",
    name: "Barracks",
    condition: "ruined",
    estimatedValue: 2000,
    renovationCost: 1500,
    requirements: [...],
  },
]
```

#### Claim Expiration

Claims expire after 90 days if not formalized. This creates urgency:
- Clear dungeon
- Return to civilization
- File claim with appropriate faction
- Begin renovation before someone else claims it

---

### Player Organizations

**The endgame isn't a +5 sword. It's a trading company.**

#### Organization Types

| Category | Types | Purpose |
|----------|-------|---------|
| **Commercial** | trading_company, merchant_house, banking_house, shipping_company, caravan_company | Move goods, make money |
| **Production** | manufacturing_guild, mining_company, farming_estate, logging_company | Make things, extract resources |
| **Service** | mercenary_company, adventuring_guild, spy_network, assassins_guild, thieves_guild | Sell capabilities |
| **Institutional** | wizard_academy, temple, knightly_order, bardic_college | Shape society |
| **Political** | noble_house, faction | Wield power |

#### Organization Tiers

| Tier | Followers | Properties | Treasury | Reputation | Capabilities |
|------|-----------|------------|----------|------------|--------------|
| 1 | 1+ | 0 | 100gp | 0 | Basic operations, local presence |
| 2 | 5+ | 1+ | 1,000gp | 10+ | Multiple locations |
| 3 | 20+ | 3+ | 5,000gp | 25+ | Regional influence, specialists |
| 4 | 50+ | 5+ | 20,000gp | 50+ | Multi-regional, political influence |
| 5 | 100+ | 10+ | 100,000gp | 75+ | Continental reach, shape world events |

```
EXAMPLE: The Iron Wolves Mercenary Company

Year 1 (Tier 1):
  - 3 followers
  - Headquarters: rented room
  - Treasury: 150gp
  - Jobs: guard caravans, clear rats

Year 3 (Tier 2):
  - 12 followers
  - Headquarters: small barracks
  - Treasury: 2,500gp
  - Jobs: protect merchants, hunt bandits

Year 7 (Tier 3):
  - 35 followers
  - Headquarters: fortified compound
  - Treasury: 12,000gp
  - Jobs: nobles hire them, military contracts

Year 15 (Tier 4):
  - 80 followers
  - Headquarters: fortress + branch offices
  - Treasury: 45,000gp
  - Jobs: kingdoms bid for their service
  - Political influence: kings listen when they speak
```

---

### Player Businesses

**Own the shop. Hire the shopkeeper. Collect the gold.**

#### Business Types

| Sector | Types |
|--------|-------|
| **Retail (TERTIARY)** | general_store, specialty_shop, tavern_inn, apothecary, jeweler, armorer, bookseller |
| **Production (SECONDARY)** | smithy, tannery, brewery, bakery, carpentry, alchemy_lab, enchanting_shop |
| **Extraction (PRIMARY)** | mine, farm, ranch, fishery, logging_camp |
| **Services** | bank, moneychanger, shipping, messenger_service, stable |

#### Business Operation

Businesses tick weekly:

```typescript
function tickBusiness(business, marketConditions, managerPresent): BusinessTickResult {
  // Revenue = customers × spend × manager bonus × market × reputation
  // Expenses = wages + rent + supplies + guild dues
  // Profit = revenue - expenses
  
  // Events (5% chance each):
  //   Positive: Big order, good review, lucky find
  //   Negative: Theft, bad review, spoilage
  
  return {
    revenue: 150,
    expenses: 80,
    profit: 70,
    events: ["Big order from wealthy customer"],
    managerReport: "Business is doing well. Profit of 70gp this week.",
  };
}
```

#### Manager Reports

Each week, your manager sends a report:

```
Weekly Report from Grimm the Dwarf:

Business is doing well. Profit of 70gp this week.

Notable events:
- Large order from wealthy customer

Low stock warning: healing_potions, antidotes
```

---

### Follower Assignment

**Your followers DO things. You DIRECT them.**

#### Assignment Types

| Assignment | Location | Skills Needed |
|------------|----------|---------------|
| property_manager | Property | administration, persuasion, insight |
| business_manager | Business | administration, persuasion, appraisal |
| caravan_leader | Trade Route | survival, animal_handling, perception |
| ship_captain | Vessel | navigation, leadership, athletics |
| expedition_leader | Exploration | survival, investigation, nature |
| garrison_commander | Fort | leadership, tactics, intimidation |
| workshop_foreman | Workshop | crafting, administration, perception |
| spy_handler | Spy Network | deception, insight, stealth |
| personal_assistant | You | persuasion, insight, history |
| trainer | Organization | teaching, insight, athletics |
| guard | Property/Business | perception, athletics, intimidation |

#### Follower Efficiency

Skill match determines how well they perform:

```typescript
// Grimm assigned as business_manager
// Relevant skills: administration, persuasion, appraisal
// Grimm's skills: administration 14, persuasion 8, appraisal 12

efficiency = 1.0;  // Base
efficiency += (14 - 10) * 0.05;  // +20% from high administration
efficiency += (8 - 10) * 0.05;   // -10% from low persuasion
efficiency += (12 - 10) * 0.05;  // +10% from good appraisal
// Final: 1.2 (20% better than average)

// Trait bonuses
traits: ["shrewd", "numerate"]
efficiency += 0.1 + 0.1 = +20%  // These help a business manager

// Final efficiency: 1.4 (40% above average)
```

#### Loyalty & Morale

Followers have feelings:

```
Loyalty 0-30:   May betray you
Loyalty 31-60:  Will leave if better offer
Loyalty 61-80:  Reliable
Loyalty 81-100: Devoted

Morale 0-30:    Performs poorly
Morale 31-60:   Average work
Morale 61-80:   Good work
Morale 81-100:  Exceptional effort

Factors:
  + Regular pay
  + Housing provided
  + Bonuses
  + Respect
  + Victories
  
  - Unpaid
  - Dangerous assignments
  - Disrespect
  - Failures
```

---

### Downtime Order Queue

**Queue orders. Followers execute. Collect results.**

#### Order Types

| Category | Orders |
|----------|--------|
| **Business** | expand_business, restock_inventory, adjust_prices, hire_employee, fire_employee, run_promotion |
| **Property** | renovate_property, fortify_property, expand_property, collect_rent |
| **Production** | produce_goods, research_recipe, upgrade_workshop |
| **Trade** | launch_caravan, establish_route, negotiate_contract |
| **Organization** | recruit_followers, train_followers, assign_follower, expand_operations |
| **Special** | gather_information, conduct_ritual, political_maneuvering, throw_party |

#### Order Processing

Orders tick through progress:

```typescript
const order = {
  type: "expand_business",
  target: { entityId: shop.id, entityName: "Elara's Apothecary" },
  goldAllocated: 500,
  followersAssigned: [grimm.id],
  priority: "high",
};

// Each tick:
// baseProgress = 5 (expand_business is slow)
// followerEfficiency = 1.4 (Grimm is good)
// goldBonus = 0.25 (500gp helps)
// progressMade = 5 × 1.4 × 1.25 = 8.75%

// After 12 ticks: 100% complete
// Result: Shop upgraded to Emporium
```

#### Priority Queue

Orders execute in priority order:

```
CRITICAL → HIGH → MEDIUM → LOW

Multiple orders? Most critical first.
Followers busy? Other orders wait.
```

---

### Complete Player Empire Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THE PLAYER INTERVENTION LAYER                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ADVENTURE ────────► FAME ────────► DEED UNLOCKS                        │
│  (Clear dungeons,    (Faction       (Property types                     │
│   help factions)      reputation)    become available)                  │
│                                           │                             │
│                                           ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     PROPERTY ACQUISITION                          │  │
│  │                                                                   │  │
│  │  Purchase ──► Housing market, fair price                         │  │
│  │  Grant ────► Faction reward, comes with obligations              │  │
│  │  Claim ────► Cleared dungeon → file claim → renovate             │  │
│  │  Conquest ─► Take by force, legitimize later                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                             │
│                                           ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     ORGANIZATION GROWTH                           │  │
│  │                                                                   │
│  │  Tier 1: You + a few followers + a dream                         │  │
│  │  Tier 2: Small team, first property                              │  │
│  │  Tier 3: Regional operation, specialists                         │  │
│  │  Tier 4: Political influence, multiple regions                   │  │
│  │  Tier 5: Shape the world, kings seek your counsel                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                             │
│                                           ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     FOLLOWER ASSIGNMENT                           │  │
│  │                                                                   │  │
│  │  Grimm ────────► Business Manager (shop)                         │  │
│  │  Elena ────────► Caravan Leader (trade route)                    │  │
│  │  Viktor ───────► Garrison Commander (fort)                       │  │
│  │  Whisper ──────► Spy Handler (network)                           │  │
│  │                                                                   │  │
│  │  Skills + Traits = Efficiency (0.5x to 2.0x)                     │  │
│  │  Pay + Respect = Loyalty + Morale                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                             │
│                                           ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     DOWNTIME ORDER QUEUE                          │  │
│  │                                                                   │  │
│  │  1. [CRITICAL] Fortify fort before winter                        │  │
│  │  2. [HIGH] Expand apothecary to emporium                         │  │
│  │  3. [MEDIUM] Train new recruits                                  │  │
│  │  4. [LOW] Research new potion recipe                             │  │
│  │                                                                   │  │
│  │  Orders progress → Complete → Results delivered                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                             │
│                                           ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     AUTOMATED OPERATION                           │  │
│  │                                                                   │  │
│  │  Businesses tick weekly → Revenue, expenses, profit              │  │
│  │  Properties generate income → Rent collected                     │  │
│  │  Trade routes run → Caravans arrive, goods sold                  │  │
│  │  Organizations grow → Reputation, influence                      │  │
│  │                                                                   │  │
│  │  YOU DON'T RUN IT. THE SIMULATION DOES.                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                             │
│                                           ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     WEEKLY REPORTS                                │  │
│  │                                                                   │  │
│  │  From: Grimm (Apothecary Manager)                                │  │
│  │  Profit this week: 70gp. Notable: Large order from noble.        │  │
│  │  Low stock: healing potions, antidotes.                          │  │
│  │                                                                   │  │
│  │  From: Elena (Caravan Leader)                                    │  │
│  │  Route completed. Net profit: 450gp after expenses.              │  │
│  │  Bandits spotted on return. Recommend guards for next run.       │  │
│  │                                                                   │  │
│  │  From: Viktor (Garrison Commander)                               │  │
│  │  Fort secure. 2 recruits completed training.                     │  │
│  │  Request: Winter supplies running low.                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Why This Matters for Players

1. **Endgame beyond +5 swords** - Build something lasting
2. **Passive income** - Adventures fund themselves
3. **Faction integration** - Properties lock you into the world
4. **Downtime matters** - What happens between adventures
5. **Strategic decisions** - Expand where? Assign who?
6. **Emergent stories** - Your business rival becomes a plot hook
7. **Power projection** - Mercenary company? Now you're political
8. **Legacy** - Pass it to the next character

---

## Implementation Checklist

### Completed Systems
- [x] Genesis core (seeds, composition, factorization)
- [x] Genesis materials (property-based crafting)
- [x] Genesis observer (collapse, resolution, fog of war)
- [x] World graph schema (nodes, edges, inheritance)
- [x] Hub schema (topology, chunks, districts)
- [x] Hub topology generators (natural, planned, hybrid)
- [x] Hub chunk manager (observer-local, LRU cache)
- [x] Hub internal graph (pathfinding, A*)
- [x] NPC system (44 roles, unified with Character)
- [x] NPC progression (skills, abilities, lore integration)
- [x] NPC scheduling (hourly routines)
- [x] Economy schema (commodities, prices, trade routes)
- [x] Faction schema (schemes, relationships)
- [x] Downtime schema (actions, costs)
- [x] Follower schema (types, upkeep)
- [x] **Extraction system** (PRIMARY sector - deposits, operations, engine)
- [x] **Economic tick simulation** (`simulateEconomicTick()` with real flow)
- [x] **Trade flow simulation** (goods move along routes)
- [x] **Price emergence** (supply/demand from actual extraction flow)
- [x] **Gem/Coining system** (gems from dungeons only, exchange houses)
- [x] **Logistics system** (stockers, movers, trading companies)
- [x] **Transport modes** (land: porter→caravan, sea: rowboat→galleon)
- [x] **Trade route programs** (routes as executable algorithms)
- [x] **Caravan engine** (tick-based route execution)
- [x] **Arbitrage discovery** (find profitable trade opportunities)
- [x] **Freight contracts** (mover business model)
- [x] **Guild system** (pooled purchasing, monopolies, training)
- [x] **Workshop system** (recipes, production queues, quality)
- [x] **Craftsman progression** (apprentice → journeyman → master)
- [x] **Markets system** (TERTIARY sector - merchant progression, venues)
- [x] **Merchant tiers** (peddler → stall → shop → emporium → trading house → megamart)
- [x] **Price discovery engine** (supply/demand, events, speculation, regulations)
- [x] **Haggling system** (negotiation mechanics, merchant personality)
- [x] **Market events** (shortages, gluts, bubbles, price wars)
- [x] **Speculation system** (long/short positions, margin calls)
- [x] **Merchant AI** (restocking, survival, tier upgrades, staffing)
- [x] **Auction houses** (bidding, commissions, specializations)
- [x] **Market districts** (clustering, rent, traffic, crime)
- [x] **Faction control layer** (THE ECONOMY IS NOT FREE)
- [x] **Economic interventions** (taxes, tariffs, embargoes, monopolies, price controls)
- [x] **Intervention effects** (price/supply/demand/unrest modifiers)
- [x] **Enforcement levels** (none → absolute, evasion DCs)
- [x] **Black market system** (illegal goods, fences, locations)
- [x] **Heat system** (criminal attention tracking)
- [x] **Black market pricing** (risk premiums, scarcity, fence cuts)
- [x] **Corruption system** (officials for sale, authority types)
- [x] **Bribery mechanics** (success chances, consequences)
- [x] **Smuggling routes** (methods, detection, compromise)
- [x] **Smuggling operations** (attempt resolution, outcomes)
- [x] **Crackdowns** (raids, sweeps, infiltration, consequences)
- [x] **Player criminal reputation** (standing per black market)
- [x] **Personal heat** (wanted level per settlement)

- [x] **Player intervention layer** (PLAYERS BUILD EMPIRES, NOT SWORDS)
- [x] **Property & deed system** (ownership types, acquisition methods, rights/obligations)
- [x] **Fame → deed thresholds** (fame unlocks property tiers)
- [x] **Housing market** (market conditions, vacancy, price indices)
- [x] **Dungeon → claim conversion** (clear dungeon, file claim, renovate)
- [x] **Player organizations** (trading companies, mercenary bands, guilds)
- [x] **Organization tiers** (1-5 from startup to continental power)
- [x] **Player businesses** (shops, workshops, mines, services)
- [x] **Business tick simulation** (weekly revenue, expenses, events, reports)
- [x] **Follower assignment system** (manager, caravan leader, garrison commander)
- [x] **Follower efficiency** (skills + traits = performance multiplier)
- [x] **Downtime order queue** (orders progress through completion)
- [x] **Order processing** (priority queue, follower allocation, gold investment)

- [x] **Monster population system** (species, populations, carrying capacity)
- [x] **Spawner system** (dungeon monster production, overflow, capping)
- [x] **World Director** (encounter recording, fitness tracking, evolution)
- [x] **Monster ecology** (predation, competition, territory, migration)
- [x] **Population engine** (weekly tick for all populations)
- [x] **Director engine** (adaptation granting, threat level adjustment)

### Pending Implementation
- [x] Turn substrate (unified time, slot aggregation) - `timeline/substrate.ts` WorldTimestamp, SimulationTick, ScheduledEvent
- [x] Information propagation (news travels with trade, caravans carry rumors) - `communication.ts` has "caravan" as MessengerMethod, just wire to `logistics/schema.ts` CaravanSchema
- [x] NPC economic state (income, expenses, pressure) - `economy.ts` SettlementEconomySchema, `downtime.ts` ResourcePoolSchema
- [x] NPC decision engine (evaluate opportunities, act) - `governor.ts` pendingDecisions, wouldFollowOrder(), personalAgenda
- [x] Hub ↔ World graph connection (entrances to routes) - `hub/world-connection.ts` WorldRouteSchema, EntranceConnectionSchema, HubWorldInterface
- [x] Migration system (NPCs leave when pressure high) - `simulation/survival.ts` NPCSurvivalState, SocialBond, SocialGroup, RefugeeWave
- [x] **Authority structures** (power to compel, organized/disorganized military) - `simulation/authority.ts` PowerHolder, ArmedForce, SettlementDefense
- [x] **Informal defenders** (hunters/butchers/adventurers as militia) - `simulation/authority.ts` DefenderRole, SettlementDefender, DEFENDER_EFFECTIVENESS
- [x] **Repression system** (tyranny, grievances, resistance) - `simulation/authority.ts` RepressionLevel, Grievance, ResistanceMovement
- [x] **Timeline tracking** (party position on canonical timeline) - `timeline/substrate.ts` PartyTimelineSchema, CanonicalTimelineSchema
- [x] **Fast travel / quantum tunneling** (catch up to server time) - `timeline/substrate.ts` FastTravelRequest/Result
- [x] **Speculative state management** (session state vs world state) - `timeline/substrate.ts` PartyTimeline.session.speculativeTime
- [ ] **Monster ↔ POI integration** (spawner state tied to POI degradation)
- [ ] **Monster ↔ Economy integration** (route danger from populations)
- [x] **Monster ↔ Bounty integration** (director influences rewards) - `poi/bounty.ts` directorModifiers, generateBountyWarnings, calculateBountyReward with fitness/adaptations
- [x] **Bounty sponsor system** (gold comes from somewhere) - `poi/bounty.ts` BountySponsor, WEALTH_TIER_BUDGETS, calculateGuildCut
- [x] **Adventurer's Guild** (receptionist network, orb reading, ranks) - `guild/receptionist.ts` quantum-entangled waifus

---

## Key Principles

1. **No magic creation** - Resources must exist, be extracted, transported, transformed
2. **Geography is destiny** - What the land produces determines what's possible
3. **Time has cost** - Information travels, markets lag, opportunities exist
4. **Same rules for all** - NPCs and players use identical systems
5. **Emergence over scripting** - Let the simulation create stories
6. **Pressure creates movement** - Economic forces drive NPC behavior
7. **Factions shape economics** - Political power = economic control
8. **The world doesn't wait** - Simulation runs whether players act or not
9. **Monsters are why Toril stays medieval** - They push back against civilization

---

## Timeline System

**Server time is canonical truth. Sessions can lag behind but never ahead.**

### The Problem

Multiple parties exist in the same world. They play at different times. What happens when:
- Party A clears a dungeon on Tuesday
- Party B tries to clear the same dungeon on Wednesday (but their session started "before" Party A's)

### The Solution: Canonical Timeline

```
SERVER TIME (Canonical)
    │
    │ World time advances continuously
    │ NPCs follow schedules
    │ Economy ticks
    │ Monsters breed
    │
    ├── Party A: Session at T+100
    │   └── Actions are REAL, immediately canonical
    │
    └── Party B: Session at T+80 (behind server time)
        └── Actions are SPECULATIVE until caught up
```

### Timeline Rules

1. **Server time = World time** - The canonical state of the world
2. **Sessions can LAG behind** - A party can be "in the past"
3. **Sessions CANNOT be ahead** - No time travel forward
4. **In-session time flows normally** - No freeze during play
5. **Downtime is menu-based** - Players can act between sessions

### Fast Travel as Quantum Tunneling

When a party is behind server time:

```
Party B at T+80, Server at T+120

Option 1: Play out every hour (tedious)
Option 2: FAST TRAVEL

Fast travel = "Quantum tunnel" to server time
  - Discards speculative branch
  - Party "arrives" at current world state
  - Any conflicts resolved by server state winning
```

This creates the **Mandela Effect**:
- Players might remember "we cleared that dungeon"
- But their branch was orphaned
- The canonical timeline says Party A cleared it
- Their memories are of an abandoned timeline

### Session State vs World State

```
IN-SESSION:
  - Local actions are applied immediately (for responsiveness)
  - But marked as "speculative" until server confirms
  - If session ends before catching up, speculative state persists

BETWEEN SESSIONS:
  - Downtime orders execute
  - World simulation ticks
  - Party position on timeline is tracked

NEXT SESSION:
  - If behind: Can fast travel OR play through
  - If caught up: Normal play
```

### Why No WebSockets?

**RPG is turn-based. Turn-based = Request/Response.**

We don't need realtime infrastructure because:
- Combat is turn-by-turn
- NPCs have schedules (poll when needed)
- Economy ticks on server clock
- No "live" multiplayer coordination needed

HTTP request/response handles everything. Simpler. Cheaper. Works offline.

**Removed infrastructure:**
- `src/realtime/` - WebSocket/realtime sync (not needed)
- `src/storage/` - Custom storage layer (use Turso directly)

The architecture is deliberately simple: stateless HTTP handlers + database.

---

## Monster Population System

**Monsters are why Toril stays medieval.**

See: `engine/monsters/` (planned)

They're not respawning targets - they're populations that:
- **Grow** through reproduction
- **Compete** for territory and prey
- **Migrate** when pressured
- **Push back** against civilization

### The Core Insight

Dungeons don't just exist - they **bleed** monsters into the world. If unchecked, the wilderness reclaims everything. This is why:
- Adventurers are economically necessary
- Settlements need walls
- Trade routes are dangerous
- Civilization is fragile

### Population Tiers

| Tier | Count | Description |
|------|-------|-------------|
| extinct | 0 | Gone from area |
| remnant | 1-5 | Nearly wiped out |
| sparse | 6-20 | Rare encounters |
| stable | 21-50 | Sustainable |
| thriving | 51-100 | Healthy population |
| abundant | 101-200 | Very common |
| swarming | 201+ | Overpopulated, will spread |

### Spawner Types

Dungeons have **spawners** - the source of monster populations:

| Type | Description | Example |
|------|-------------|---------|
| breeding_ground | Natural reproduction | Goblin warren |
| summoning_circle | Magical summoning | Demon portal |
| necromantic_source | Raises dead | Lich's crypt |
| hive_queen | Queen produces | Spider nest |
| corruption_node | Corrupts creatures | Aberrant rift |
| elemental_rift | Planar bleed | Fire node |

### Spawner Mechanics

```typescript
interface Spawner {
  baseOutputPerWeek: number;      // Monsters produced
  internalCapacity: number;       // How many fit inside
  spilloverThreshold: number;     // % before overflow
  spilloverRate: number;          // % that spills to region
  
  // State
  state: "dormant" | "active" | "accelerated" | "frenzy" | "depleted" | "capped";
  
  // Controller (boss)
  controller: {
    exists: boolean;
    onControllerDeath: {
      spawnRateChange: number;    // Often -80%
      stateChange?: "depleted";
    };
  };
  
  // Capping (permanently stopping)
  capping: {
    requiresBossKill: boolean;
    requiresRitual: boolean;
    requiresDestruction: boolean;
  };
}
```

### POI Integration

POI degradation accelerates spawners:

```
Degradation 0-25:   Spawner normal
Degradation 25-50:  Spawner accelerated
Degradation 50-75:  Spawner in frenzy
Degradation 75-100: Spawner overflowing, area expanding
```

When adventurers clear a POI:
- Kill boss → Spawner depleted (temporary)
- Complete ritual → Spawner capped (permanent)
- Destroy source → Spawner destroyed

### World Director

**The world learns what kills adventurers.**

The World Director tracks:
- Which monster species are effective vs parties
- What tactics work
- Which adaptations to grant

```typescript
interface SpeciesFitness {
  speciesId: string;
  regionId: string;
  
  encounters: number;
  victories: number;          // Times monsters won
  defeats: number;
  
  fitness: number;            // 0.2 to 2.5 (1.0 = average)
  
  adventurersKilled: number;
  averageSurvivalRounds: number;
  
  effectiveTactics: Array<{
    tactic: string;
    successRate: number;
  }>;
}
```

### Adaptation System

High-fitness species gain adaptations:

| Adaptation | Trigger | Effect |
|------------|---------|--------|
| fire_resistance | Party uses fire | Resist fire damage |
| magic_resistance | Caster-heavy party | Advantage on saves |
| pack_tactics | Group success | Advantage when ally adjacent |
| ambush_tactics | Surprise success | Stealth + surprise bonus |
| increased_hp | High survival | +25% HP |
| focus_fire | Downs weak PCs | Target low-HP characters |

### Evolution Rules

```
Fitness > 1.2 + 3+ encounters → May gain adaptation
Fitness < 0.8 → May lose adaptation

Adaptations spread to adjacent regions (10-25% chance)
High-fitness species spawn more frequently
Low-fitness species spawn less
```

### Ecology System

Monsters have ecological roles:

| Role | Behavior |
|------|----------|
| apex_predator | Hunts other predators |
| predator | Hunts prey species |
| omnivore | Flexible diet |
| herbivore | Consumes plants |
| scavenger | Eats the dead |
| parasite | Drains hosts |
| magical | Sustains on magic |
| undead | Doesn't need to eat |

### Population Tick (Weekly)

1. **Spawner Output** - Dungeons produce, overflow spills
2. **Natural Growth** - Births based on food/territory
3. **Predation** - Predators eat prey populations
4. **Competition** - Species fight for territory
5. **Civilization Pressure** - Patrols kill monsters, monsters raid
6. **Migration** - Overpressured populations move
7. **Director Evolution** - Adaptations granted/removed

### Route Danger Integration

Monster populations affect trade route danger:

```typescript
for (const { population, species } of nearbyPopulations) {
  if (species.ecology.aggressive && population.tier >= "stable") {
    dangerSources.push({
      name: `${species.name} population`,
      dangerContribution: tierDanger[population.tier],
      raidRisk: 0.1,
    });
  }
}
```

### Settlement Problems

Monster raids generate settlement problems:

```typescript
if (recentRaids.length > 0) {
  problems.push({
    type: "attack",
    title: "Monster Raids",
    effects: [{ stat: "stability", change: -5 }],
    responseOptions: [
      { option: "Hire adventurers", cost: { gold: 500 } },
      { option: "Increase patrols", cost: { gold: 200, staff: 5 } },
    ],
  });
}
```

### Bounty Generation

The Director influences bounty rewards:

```typescript
if (regionalThreat.currentThreat >= 7) {
  bounty.goldReward *= 1.5;
  bounty.warnings.push("URGENT: Threat level critical");
}

// Adaptation warnings
if (hasAdaptation("fire_resistance")) {
  bounty.warnings.push("Creatures resistant to fire");
}
```

### Why This Matters

1. **Monsters are the reason** - They keep civilization in check
2. **Dungeons bleed** - Uncapped spawners flood the world
3. **The world learns** - What kills adventurers gets reinforced
4. **Ecology matters** - Predation, competition, migration create emergence
5. **Civilization fights back** - Settlements patrol, hunt, generate bounties

The wilderness isn't a backdrop. It's an opponent.
