# SCHEMA CONTRACT: World Graph Shapes
## For Gemini Seed Data Generation

---

## ARCHITECTURE AGREED

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TURSO DATABASE                                 │
│                                                                             │
│  ┌────────────────────┐              ┌────────────────────┐                │
│  │    world_nodes     │◄────────────►│    world_edges     │                │
│  │                    │   CONNECTS   │                    │                │
│  │  id (PK)           │              │  id (PK)           │                │
│  │  parent_id (FK)    │              │  source_id (FK)    │                │
│  │  type (indexed)    │              │  target_id (FK)    │                │
│  │  name (indexed)    │              │  type (indexed)    │                │
│  │                    │              │                    │                │
│  │  data_static JSON  │              │  properties JSON   │                │
│  │  ▲                 │              │  ▲                 │                │
│  │  │ FLEXIBLE        │              │  │ FLEXIBLE        │                │
│  └──┼─────────────────┘              └──┼─────────────────┘                │
│     │                                   │                                   │
│     │ Contains: physics, culture,       │ Contains: trade, faction,        │
│     │ government, economy, etc.         │ portal, orbit, etc.              │
│                                                                             │
│  ┌────────────────────┐              ┌────────────────────┐                │
│  │     factions       │◄────────────►│  faction_relations │                │
│  │  (Global Entities) │              │                    │                │
│  │                    │              │  faction1_id       │                │
│  │  NOT embedded in   │              │  faction2_id       │                │
│  │  locations!        │              │  relation          │                │
│  └────────────────────┘              └────────────────────┘                │
│                                                                             │
│  ┌────────────────────┐                                                    │
│  │      deities       │                                                    │
│  │  (Global Entities) │                                                    │
│  └────────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## HIERARCHY (Node Types)

```
COSMIC SCALE
├── multiverse          # Container of all reality
├── crystal_sphere      # Realmspace, Greyspace, Krynnspace
├── phlogiston          # The Flow between spheres
└── wildspace           # Space within a sphere

CELESTIAL BODIES
├── star                # Suns
├── planet              # Toril, Oerth, Krynn
├── moon                # Selûne
├── asteroid            # Rock of Bral
└── anomaly             # Dead gods, living ships

PLANAR
├── plane               # Outer/Inner planes
├── demiplane           # Pocket dimensions
└── planar_layer        # Nine Hells layers

GEOGRAPHIC
├── continent           # Faerûn, Kara-Tur, Maztica
├── region              # Sword Coast, Wa, Cormyr
└── subregion           # High Forest

POLITICAL/CULTURAL
├── nation              # Kingdom of Cormyr
└── territory           # Tribal lands

SETTLEMENTS
├── metropolis          # Waterdeep, Calimport
├── city                # Baldur's Gate
├── town                # Phandalin
├── village             # Barovia
├── hamlet              # Tiny settlements
└── outpost             # Forts, trading posts

LOCATIONS
├── district            # City ward
├── landmark            # Famous location
├── dungeon             # Adventure site
├── wilderness_site     # Ruins, lairs
└── building            # Specific structure

SPECIAL
├── ship                # Spelljammer vessels
└── mobile              # Caravans, nomad camps
```

---

## EDGE TYPES

```
HIERARCHY
└── CONTAINS            # Parent contains child

GEOGRAPHIC
├── BORDERS             # Geographic adjacency
├── TRADE_ROUTE         # Commercial connection
├── ROAD                # Physical path
├── RIVER               # Waterway
└── SEA_ROUTE           # Ocean travel

COSMIC (Spelljammer)
├── ORBIT               # Celestial orbit
├── FLOW_RIVER          # Phlogiston current
└── PORTAL              # Magical connection

PLANAR
├── PLANAR_GATE         # Connection between planes
├── MANIFEST_ZONE       # Plane bleeds into another
└── COTERMINOUS         # Planes touch

POLITICAL
├── GOVERNS             # Political control
├── VASSAL_OF           # Feudal relationship
├── ALLIED_WITH         # Political alliance
├── AT_WAR_WITH         # Active conflict
└── TREATY_WITH         # Formal agreement

FACTION (CRITICAL)
├── FACTION_PRESENCE    # Faction operates here
├── FACTION_HQ          # Faction headquarters
└── FACTION_CONFLICT    # Factions fighting

CULTURAL
├── CULTURAL_TIE        # Shared culture
├── RELIGIOUS_TIE       # Shared religion
└── TRADE_PARTNER       # Economic relationship

NARRATIVE
├── HISTORICAL_EVENT    # Something happened connecting
├── PROPHECY_LINK       # Tied by prophecy
└── SECRET_CONNECTION   # Hidden relationship
```

---

## LOCKED SHAPES

### WorldNode.dataStatic JSON Shape

```typescript
{
  // Always present
  alternateNames?: string[],
  description?: string,
  shortDescription?: string,
  
  // Physical (geographic nodes)
  physical?: {
    size?: string,
    climate?: string,
    terrain?: string[],
    features?: string[]
  },
  
  // Cosmic physics (INHERITABLE - children get parent's unless override)
  physics?: {
    gravity?: {
      type: "standard" | "none" | "low" | "high" | "variable" | 
            "directional" | "subjective" | "localized",
      strength?: number,
      direction?: string,
      notes?: string
    },
    atmosphere?: {
      type: "standard" | "none" | "thin" | "thick" | "toxic" | 
            "magical" | "elemental",
      envelope?: { enabled: boolean, fresh_duration?: string, foul_duration?: string }
    },
    magic?: {
      level: "dead" | "low" | "standard" | "high" | "wild" | "enhanced" | "twisted",
      source?: string,  // "The Weave", "Spirits", "Ley Lines"
      schoolModifiers?: Record<string, { modifier: string, notes?: string }>,
      specialRules?: string[]
    },
    time?: {
      flow: "standard" | "accelerated" | "decelerated" | "static" | "variable" | "nonlinear",
      ratio?: string,
      notes?: string
    },
    spelljammer?: {
      enabled: boolean,
      phlogiston?: { accessible: boolean, fireRisk: boolean },
      crystalShell?: { exists: boolean, portalLocations: string[] }
    }
  },
  
  // Cultural traits (INHERITABLE)
  culture?: {
    // NEW: Technology level (for shop/item generation)
    techLevel?: "stone_age" | "bronze_age" | "iron_age" | "medieval" | 
                "renaissance" | "magipunk" | "spelljammer",
    
    // NEW: Calendar system (for UI date rendering)
    calendarSystem?: {
      name: string,           // "Calendar of Harptos", "Rokugani Calendar"
      type?: string,          // "solar", "lunar", "mixed"
      months?: string[],      // Month names
      currentYear?: number,
      yearName?: string,      // "Year of the Scarlet Witch"
      notes?: string
    },
    
    socialStructure?: {
      type?: string,     // "feudal", "merchant_republic", "theocracy", "celestial_bureaucracy"
      hierarchy?: string[],
      mobility?: string
    },
    honorSystem?: {
      enabled: boolean,
      name?: string,     // "Face", "Honor", "Reputation"
      mechanics?: { gainedBy: string[], lostBy: string[], effects: string[] }
    },
    law?: {
      system?: string,
      enforcement?: string,
      punishment?: string[],
      corruption?: string
    },
    economy?: {
      type?: string,
      currency?: string,
      tradeGoods?: string[],
      wealthDistribution?: string
    },
    religion?: {
      type?: string,     // "polytheistic", "animist", "ancestor_worship", "celestial_bureaucracy"
      dominantFaiths?: string[],
      tolerance?: string,
      practices?: string[]
    },
    languages?: {
      common?: string,
      official?: string[],
      regional?: string[]
    },
    customs?: Record<string, any>,  // FLEXIBLE - put Kara-Tur specific stuff here
    taboos?: string[],
    attitudes?: {
      towardsMagic?: string,
      towardsOutsiders?: string,
      towardsUndead?: string,
      towardsDivine?: string
    }
  },
  
  // Population (settlements)
  population?: {
    count?: number,
    description?: string,
    demographics?: Record<string, number>  // {"human": 70, "dwarf": 15}
  },
  
  // Government
  government?: {
    type?: string,
    ruler?: string,
    rulerTitle?: string,
    rulingBody?: string,
    succession?: string
  },
  
  // Military
  military?: {
    strength?: string,
    composition?: string[],
    specialUnits?: string[]
  },
  
  // Economy
  economy?: {
    type?: string,
    exports?: string[],
    imports?: string[],
    resources?: string[],
    wealthLevel?: string
  },
  
  // History
  history?: {
    founded?: string,
    founder?: string,
    ages?: Array<{ name: string, period?: string, description?: string }>,
    majorEvents?: Array<{ date?: string, name: string, description?: string }>
  },
  
  // Landmarks
  landmarks?: Array<{ name: string, type: string, description?: string }>,
  
  // Celestial (Spelljammer)
  celestial?: {
    bodyType?: string,
    orbitPeriod?: string,
    moons?: number,
    rings?: boolean,
    inhabitants?: string
  },
  
  // Ship (Spelljammer)
  ship?: {
    class?: string,
    tonnage?: number,
    crew?: { min: number, max: number },
    weapons?: string[],
    speed?: string
  },
  
  // Adventure hooks
  hooks?: Array<{
    title: string,
    description: string,
    level?: string,
    tags?: string[]
  }>,
  
  // GM secrets
  secrets?: Array<{
    secret: string,
    revealCondition?: string
  }>,
  
  // Source
  source?: {
    book?: string,
    page?: string,
    edition?: string
  },
  
  // EXTENSION POINT - anything else goes here
  custom?: Record<string, any>
}
```

### WorldEdge.properties JSON Shape

```typescript
{
  // Common
  name?: string,
  description?: string,
  strength?: "weak" | "moderate" | "strong" | "critical",
  active?: boolean,
  hidden?: boolean,
  
  // For TRADE_ROUTE
  trade?: {
    goods?: string[],
    volume?: string,
    dangerLevel?: string,
    travelTime?: string,
    controlledBy?: string
  },
  
  // For PORTAL / PLANAR_GATE
  portal?: {
    permanent?: boolean,
    twoWay?: boolean,
    keyRequired?: string,
    schedule?: string,
    destination?: string
  },
  
  // For ORBIT (Spelljammer)
  orbit?: {
    period?: string,
    distance?: string,
    eccentricity?: string
  },
  
  // For FLOW_RIVER (Spelljammer)
  flowRiver?: {
    direction?: "one_way" | "two_way",
    travelTime?: string,
    hazards?: string[],
    stability?: string
  },
  
  // For FACTION_PRESENCE (CRITICAL - this is how factions connect)
  faction?: {
    factionId: string,      // UUID
    factionName: string,
    influence?: number,     // 0-100
    visibility?: "secret" | "rumored" | "known" | "prominent" | "dominant",
    currentAgenda?: string,
    activities?: string[],
    assets?: Array<{ type: string, name?: string, description?: string }>,
    notableMembers?: Array<{ npcId?: string, name: string, role: string }>,
    localRelations?: string
  },
  
  // For political relationships
  political?: {
    nature?: string,
    since?: string,
    terms?: string[],
    stability?: string
  },
  
  // For HISTORICAL_EVENT
  historical?: {
    date?: string,
    event: string,
    significance?: string
  },
  
  // EXTENSION POINT
  custom?: Record<string, any>
}
```

### Faction Shape (Global Entity)

```typescript
{
  id: string,           // UUID
  name: string,
  alternateNames?: string[],
  type: string,         // "secret_society", "guild", "government", "merchant_house", etc.
  scope: "local" | "regional" | "continental" | "planetary" | "planar" | "cosmic",
  homeSphereId?: string,
  homePlanetId?: string,
  
  data: {
    description?: string,
    symbol?: string,
    colors?: string[],
    motto?: string,
    
    goals?: {
      public?: string[],
      secret?: string[],
      beliefs?: string[]
    },
    
    structure?: {
      type?: string,
      leaderTitle?: string,
      leader?: string,
      ranks?: Array<{ name: string, requirements?: string, privileges?: string[] }>
    },
    
    resources?: {
      wealth?: number,      // 0-100
      military?: number,
      political?: number,
      magical?: number,
      information?: number
    },
    
    history?: {
      founded?: string,
      founder?: string,
      majorEvents?: Array<{ date?: string, event: string }>
    },
    
    recruitment?: {
      open?: boolean,
      requirements?: string[],
      process?: string
    },
    
    missions?: string[],
    
    source?: { book?: string, edition?: string },
    custom?: Record<string, any>
  }
}
```

### Deity Shape (Global Entity)

```typescript
{
  id: string,
  name: string,
  titles?: string[],
  aliases?: string[],
  
  pantheon?: string,     // "Faerûnian", "Seldarine", "Celestial Bureaucracy"
  rank?: "greater" | "intermediate" | "lesser" | "demigod" | "quasi" | "dead",
  alignment?: string,
  
  sphereId?: string,
  planetId?: string,
  
  data: {
    description?: string,
    portfolio?: string[],
    domains?: string[],   // 5e domains
    
    symbol?: string,
    favoredWeapon?: string,
    holyDays?: string[],
    
    dogma?: {
      tenets?: string[],
      taboos?: string[]
    },
    
    clergy?: {
      titles?: string[],
      vestments?: string,
      requirements?: string[]
    },
    
    allies?: string[],
    enemies?: string[],
    
    history?: {
      origin?: string,
      majorEvents?: string[]
    },
    
    source?: { book?: string, edition?: string },
    custom?: Record<string, any>
  }
}
```

---

## CRITICAL RULES FOR SEED GENERATION

### 1. Factions are EDGES, not Properties
```
❌ WRONG:
waterdeep_node.data_static.factions = ["Harpers", "Zhentarim"]

✅ CORRECT:
harpers_faction (in factions table)
  └── FACTION_PRESENCE edge → waterdeep_node
        properties.faction = { influence: 60, visibility: "known", ... }
```

### 2. Inheritance Works Top-Down
```
Realmspace (crystal_sphere)
  └── physics.spelljammer.enabled = true     ← SET ONCE
      │
      └── Toril (planet)
          └── physics inherits spelljammer    ← INHERITED
              │
              └── Faerûn (continent)
                  └── physics inherits        ← INHERITED
                      │
                      └── Waterdeep (city)
                          └── Still inherits   ← INHERITED
```

Only set physics/culture at the HIGHEST level where it applies. Children inherit automatically.

### 3. Use `custom` for Region-Specific Stuff
```typescript
// Kara-Tur specific
karaТur_node.dataStatic.culture.customs = {
  "face_mechanics": {
    "levels": ["Shameful", "Common", "Respected", "Honored", "Legendary"],
    "effects": { ... }
  },
  "ancestor_worship": { ... },
  "spirit_bureaucracy": { ... }
}

// Sword Coast specific
swordCoast_node.dataStatic.culture.customs = {
  "guild_reputation": { ... },
  "lords_alliance_standing": { ... }
}
```

### 4. IDs Must Be UUIDs
All `id`, `parent_id`, `source_id`, `target_id`, `factionId`, etc. must be valid UUIDs.

Generate them consistently so relationships work.

### 5. Use Canonical Names for Deduplication
```typescript
{
  name: "Baldur's Gate",
  canonicalName: "baldurs_gate"  // Lowercase, underscores, no apostrophes
}
```

---

## EXAMPLE: Waterdeep Seed

```json
{
  "node": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "parentId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "metropolis",
    "name": "Waterdeep",
    "canonicalName": "waterdeep",
    "sphereId": "...",
    "planetId": "...",
    "continentId": "...",
    "regionId": "...",
    "isSeeded": true,
    "isCanonical": true,
    "dataStatic": {
      "alternateNames": ["City of Splendors", "Crown of the North"],
      "description": "The greatest and most influential city in the North...",
      "population": {
        "count": 130000,
        "description": "~130,000 within walls, ~1 million including surroundings",
        "demographics": { "human": 64, "dwarf": 10, "elf": 10, "halfling": 5 }
      },
      "government": {
        "type": "oligarchy",
        "rulingBody": "Lords of Waterdeep",
        "ruler": "Open Lord Laeral Silverhand"
      },
      "economy": {
        "type": "mercantile",
        "exports": ["finished goods", "books", "magical items"],
        "wealthLevel": "extremely wealthy"
      },
      "landmarks": [
        { "name": "Castle Waterdeep", "type": "fortress", "description": "..." },
        { "name": "Yawning Portal", "type": "tavern", "description": "..." }
      ],
      "source": { "book": "Sword Coast Adventurer's Guide", "edition": "5e" }
    }
  },
  "edges": [
    {
      "id": "...",
      "sourceId": "<harpers_faction_id>",
      "targetId": "550e8400-e29b-41d4-a716-446655440001",
      "type": "FACTION_PRESENCE",
      "properties": {
        "faction": {
          "factionId": "<harpers_faction_id>",
          "factionName": "Harpers",
          "influence": 55,
          "visibility": "rumored",
          "currentAgenda": "Monitor Lords of Waterdeep for corruption",
          "assets": [
            { "type": "safe_house", "name": "The Pampered Traveler" }
          ]
        }
      }
    },
    {
      "type": "TRADE_ROUTE",
      "sourceId": "550e8400-e29b-41d4-a716-446655440001",
      "targetId": "<baldurs_gate_id>",
      "properties": {
        "trade": {
          "goods": ["textiles", "weapons", "magical components"],
          "travelTime": "40 days by road",
          "dangerLevel": "moderate"
        }
      }
    }
  ]
}
```

---

## FILES TO GENERATE

```
seeds/
├── faerun/
│   ├── manifest.json           # SeedManifest
│   ├── world_toril.json        # Planet node
│   ├── continent_faerun.json   # Continent node
│   │
│   ├── regions/
│   │   ├── sword_coast.json    # Region + subregions
│   │   ├── western_heartlands.json
│   │   └── ...
│   │
│   ├── settlements/
│   │   ├── waterdeep.json      # City node + district nodes
│   │   ├── baldurs_gate.json
│   │   └── ...
│   │
│   ├── factions/
│   │   ├── harpers.json        # Faction entity
│   │   ├── zhentarim.json
│   │   └── ...
│   │
│   ├── faction_presence/
│   │   ├── sword_coast.json    # All FACTION_PRESENCE edges for region
│   │   └── ...
│   │
│   ├── deities/
│   │   ├── faerunian_pantheon.json
│   │   └── ...
│   │
│   └── edges/
│       ├── trade_routes.json   # TRADE_ROUTE edges
│       ├── political.json      # Political edges
│       └── ...
│
├── kara_tur/
│   └── ... (same structure)
│
├── realmspace/
│   ├── sphere.json             # Crystal sphere node
│   ├── celestial_bodies.json   # Star, planets, moons
│   ├── orbits.json             # ORBIT edges
│   └── ...
│
└── rock_of_bral/
    └── ...
```

---

## SYSTEM LOCK 🔒

**Status: LOCKED** - Do not modify the following architectural decisions.

### 1. The Physics of Data

- **Nodes (`world_nodes`)**: Use `data_static` (JSON) to store physics/lore. This allows "Dimensional Variance" (Space vs. Land).
- **Edges (`world_edges`)**: Use `properties` (JSON) to store context.
- **Factions**: Are Global Entities linked via `FACTION_PRESENCE` edges. They are **never** embedded properties of a location.

### 2. The Inheritance Protocol

- **Data is Sparse.** If a child node lacks a `physics` object, the Application Layer MUST resolve the parent chain to find the "Effective Physics."
- **Override Logic:** A child explicitly defining a trait (e.g., `magic: "dead"`) overrides the parent's trait (e.g., `magic: "high"`).
- **Resolution Functions:** Use `resolvePhysics()`, `resolveCulture()`, and `resolveNodeContext()` from `graph.ts`.

### 3. The Cosmic Hierarchy

```
Multiverse
  └── Crystal Sphere (Realmspace, Greyspace)
        └── Wildspace
              └── Planet (Toril, Oerth)
                    └── Continent (Faerûn, Kara-Tur)
                          └── Region (Sword Coast, Wa)
                                └── Settlement (Waterdeep, Kozakura)
                                      └── District / Building
```

**Spelljammer Support:** Valid node types include `ship`, `asteroid`, `star`, `anomaly`, `phlogiston`.

### 4. Stress Test Results ✓

| Test Case | Scenario | Schema Element | Result |
|-----------|----------|----------------|--------|
| Spelljammer Physics | Player jumps off ship in Phlogiston | `physics.gravity.type: "subjective"`, `atmosphere.envelope` | ✅ PASSED |
| Kara-Tur Honor | Samurai insults a lord | `culture.honorSystem`, `culture.customs` | ✅ PASSED |
| Faction Layering | Waterdeep independent but Harper spies | `FACTION_PRESENCE` edge with `influence: 55`, `visibility: "rumored"` | ✅ PASSED |

---

## READY TO CUT ✂️

Schema is locked. Gemini confirmed. Generate seed data now.

---

## ⚠️ CRITICAL: INHERITANCE WARNING

**SQLite does NOT handle inheritance automatically.**

### The Trap
```sql
SELECT * FROM world_nodes WHERE id = 'waterdeep';
-- Returns: physics = NULL (because it inherits from Toril)
```

### The Fix
The **Application Layer** (TypeScript) must resolve the parent chain:

```typescript
// graph.ts already provides these:
import { 
  resolvePhysics,     // Walks parent chain, merges physics
  resolveCulture,     // Walks parent chain, merges culture  
  resolveEffectiveContext,  // Returns full resolved context
  isTraitLocal,       // Check if trait is local vs inherited
  findTraitSource     // Find which ancestor defines a trait
} from './world/graph';

// Usage:
const ancestors = await getAncestors(waterdeepNode); // You implement this query
const effectivePhysics = resolvePhysics(waterdeepNode, ancestors);
const effectiveCulture = resolveCulture(waterdeepNode, ancestors);
```

**DO NOT try to solve this in SQL.** Keep the DB normalized (sparse data), let the code build the "Effective Context."

---

## 🔒 SYSTEM LOCK

**Status: LOCKED. Do not modify the following architectural decisions.**

### 1. The Physics of Data
- **Nodes (`world_nodes`)**: Use `data_static` (JSON) to store physics/lore. This allows "Dimensional Variance" (Space vs. Land).
- **Edges (`world_edges`)**: Use `properties` (JSON) to store context.
- **Factions**: Are Global Entities linked via `FACTION_PRESENCE` edges. They are **never** embedded properties of a location.

### 2. The Inheritance Protocol
- **Data is Sparse.** If a child node lacks a `physics` object, the Application Layer MUST resolve the parent chain to find the "Effective Physics."
- **Override Logic:** A child explicitly defining a trait (e.g., `magic: "dead"`) overrides the parent's trait (e.g., `magic: "high"`).

### 3. The Cosmic Hierarchy
```
Multiverse → Crystal Sphere → Wildspace → Planet → Continent → Region → Settlement
```
- **Spelljammer Support:** Valid node types include `ship`, `asteroid`, `star`, and `anomaly`.

### 4. Flexibility Points
- `culture.customs`: Record<string, any> for region-specific mechanics
- `dataStatic.custom`: Record<string, any> for anything else
- Edge `properties.custom`: Record<string, any> for relationship-specific data

**This schema survives Sword Coast, Kara-Tur, Spelljammer, and beyond.**
