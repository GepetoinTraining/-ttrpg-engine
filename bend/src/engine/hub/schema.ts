import { z } from 'zod';

// ============================================
// HUB SCHEMA
// ============================================
//
// PHILOSOPHY:
// A hub is a settlement - from hamlet to metropolis.
// It exists as a WorldNode in the graph, but internally
// it has structure: districts, streets, buildings, lots.
//
// The key insight: render only what the observer sees.
// A city is locally flat (the neighborhood you're in)
// but globally curved (the full layout emerges from
// stitching neighborhoods together).
//
// GENERATION MODES:
// - NATURAL: Organic growth (medieval towns, villages)
//   Streets curve, buildings cluster, density varies
// - PLANNED: Grid-based (Roman cities, forts, new districts)
//   Straight streets, regular lots, uniform density
// - HYBRID: Old natural core + planned expansions
//   (Most real cities work this way)
//

// ============================================
// HUB SIZE TIERS
// ============================================

export const HubSizeSchema = z.enum([
  'outpost',     // 10-50 people, 1 chunk
  'hamlet',      // 50-200 people, 1-2 chunks
  'village',     // 200-1000 people, 2-4 chunks
  'town',        // 1000-5000 people, 4-9 chunks
  'city',        // 5000-25000 people, 9-25 chunks
  'metropolis',  // 25000+ people, 25+ chunks
]);
export type HubSize = z.infer<typeof HubSizeSchema>;

// Size tier determines chunk count and complexity
export const HUB_SIZE_CONFIG: Record<HubSize, {
  minPop: number;
  maxPop: number;
  minChunks: number;
  maxChunks: number;
  districtCount: { min: number; max: number };
  hasWalls: boolean;
  hasCastle: boolean;
}> = {
  outpost:    { minPop: 10,    maxPop: 50,    minChunks: 1,  maxChunks: 1,  districtCount: { min: 1, max: 1 },  hasWalls: false, hasCastle: false },
  hamlet:     { minPop: 50,    maxPop: 200,   minChunks: 1,  maxChunks: 2,  districtCount: { min: 1, max: 2 },  hasWalls: false, hasCastle: false },
  village:    { minPop: 200,   maxPop: 1000,  minChunks: 2,  maxChunks: 4,  districtCount: { min: 1, max: 3 },  hasWalls: false, hasCastle: false },
  town:       { minPop: 1000,  maxPop: 5000,  minChunks: 4,  maxChunks: 9,  districtCount: { min: 2, max: 5 },  hasWalls: true,  hasCastle: false },
  city:       { minPop: 5000,  maxPop: 25000, minChunks: 9,  maxChunks: 25, districtCount: { min: 4, max: 8 },  hasWalls: true,  hasCastle: true },
  metropolis: { minPop: 25000, maxPop: 100000, minChunks: 25, maxChunks: 64, districtCount: { min: 6, max: 12 }, hasWalls: true,  hasCastle: true },
};

// ============================================
// TOPOLOGY
// ============================================

export const TopologyTypeSchema = z.enum([
  'natural',    // Organic growth - curved streets, irregular lots
  'planned',    // Grid-based - straight streets, regular lots
  'hybrid',     // Natural core + planned districts
  'radial',     // Concentric rings (ancient cities)
  'linear',     // Along a road/river
  'clustered',  // Multiple nuclei that grew together
]);
export type TopologyType = z.infer<typeof TopologyTypeSchema>;

// ============================================
// DISTRICT TYPES
// ============================================

export const DistrictTypeSchema = z.enum([
  // Core
  'center',         // Town square, market, civic buildings
  'residential',    // Housing
  'commercial',     // Shops, markets
  'industrial',     // Smiths, tanneries, workshops
  'religious',      // Temple district
  'administrative', // Government, courts

  // Specialized
  'noble',          // Wealthy residences, manors
  'slums',          // Poor housing, crime
  'docks',          // Harbor, warehouses
  'military',       // Barracks, armory, walls
  'academic',       // University, libraries
  'entertainment',  // Taverns, theaters, arenas
  'magical',        // Wizard towers, arcane shops
  'foreign',        // Immigrant quarter, exotic goods
  'garden',         // Parks, noble estates
  'necropolis',     // Cemetery, catacombs
]);
export type DistrictType = z.infer<typeof DistrictTypeSchema>;

// District adjacency rules (what can be next to what)
export const DISTRICT_ADJACENCY: Record<DistrictType, DistrictType[]> = {
  center:         ['commercial', 'residential', 'administrative', 'religious', 'noble'],
  residential:    ['center', 'commercial', 'religious', 'garden', 'slums', 'noble'],
  commercial:     ['center', 'residential', 'docks', 'industrial', 'entertainment', 'foreign'],
  industrial:     ['commercial', 'docks', 'slums', 'military'],
  religious:      ['center', 'residential', 'academic', 'necropolis', 'noble'],
  administrative: ['center', 'noble', 'military', 'religious'],
  noble:          ['center', 'residential', 'garden', 'administrative', 'religious'],
  slums:          ['residential', 'industrial', 'docks', 'entertainment'],
  docks:          ['commercial', 'industrial', 'slums', 'foreign'],
  military:       ['administrative', 'industrial', 'center'],
  academic:       ['religious', 'magical', 'noble', 'center'],
  entertainment:  ['commercial', 'slums', 'docks', 'residential'],
  magical:        ['academic', 'noble', 'center'],
  foreign:        ['commercial', 'docks', 'entertainment'],
  garden:         ['noble', 'residential', 'religious'],
  necropolis:     ['religious', 'slums'],
};

// ============================================
// BUILDING TYPES
// ============================================

export const BuildingTypeSchema = z.enum([
  // Residential
  'hovel',          // Poor housing
  'house',          // Common housing
  'townhouse',      // Middle class
  'manor',          // Wealthy
  'apartment',      // Multi-family

  // Commercial
  'shop',           // General store
  'market_stall',   // Temporary vendor
  'warehouse',      // Storage
  'inn',            // Lodging
  'tavern',         // Drinks
  'restaurant',     // Food
  'bank',           // Money
  'guildhall',      // Trade guild

  // Industrial
  'smithy',         // Metalwork
  'tannery',        // Leatherwork
  'mill',           // Grain processing
  'workshop',       // General crafting
  'brewery',        // Alcohol production

  // Religious
  'temple',         // Major religious
  'shrine',         // Minor religious
  'monastery',      // Religious community

  // Civic
  'town_hall',      // Government
  'courthouse',     // Justice
  'prison',         // Incarceration
  'barracks',       // Military housing
  'guardhouse',     // Watch station
  'gatehouse',      // Wall entrance
  'tower',          // Defensive/magical

  // Special
  'library',        // Books
  'school',         // Education
  'hospital',       // Healing
  'theater',        // Entertainment
  'arena',          // Combat entertainment
  'bathhouse',      // Social/hygiene
  'stable',         // Animals
  'dock',           // Ship mooring

  // Infrastructure
  'well',           // Water
  'fountain',       // Decorative water
  'bridge',         // River crossing
  'wall_section',   // Fortification
]);
export type BuildingType = z.infer<typeof BuildingTypeSchema>;

// ============================================
// CHUNK SCHEMA
// ============================================
//
// A chunk is a 100x100 unit area of the hub.
// It contains the local geometry that gets rendered.
// Chunks are generated on-demand and cached.
//

export const HubChunkSchema = z.object({
  // Position in chunk grid
  x: z.number().int(),
  y: z.number().int(),

  // Which hub this belongs to
  hubId: z.string().uuid(),

  // District this chunk is part of
  districtId: z.string().uuid(),
  districtType: DistrictTypeSchema,

  // Topology for this chunk
  topology: TopologyTypeSchema,

  // Buildings in this chunk
  buildings: z.array(z.object({
    id: z.string().uuid(),
    type: BuildingTypeSchema,
    name: z.string().optional(),

    // Position within chunk (0-100)
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),

    // Size
    size: z.object({
      width: z.number(),
      height: z.number(),
    }),

    // Rotation (for natural topology)
    rotation: z.number().default(0),

    // Owner (NPC or faction)
    ownerId: z.string().uuid().optional(),
    factionId: z.string().uuid().optional(),

    // State
    isOpen: z.boolean().default(true),    // Is it accessible?
    isAbandoned: z.boolean().default(false),

    // Floors (for multi-story)
    floors: z.number().int().default(1),

    // Interior (generated on-demand when entered)
    hasInterior: z.boolean().default(true),
    interiorSeed: z.string().optional(),
  })),

  // Streets/paths in this chunk
  streets: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),

    // Path points (polyline)
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
    })),

    // Width
    width: z.number().default(4),

    // Type
    type: z.enum(['main', 'side', 'alley', 'path']).default('side'),

    // Material (affects movement)
    material: z.enum(['cobblestone', 'dirt', 'gravel', 'wooden']).default('dirt'),
  })),

  // Points of interest (wells, fountains, statues)
  pois: z.array(z.object({
    id: z.string().uuid(),
    type: z.string(),
    name: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    interactable: z.boolean().default(false),
    metadata: z.record(z.string(), z.any()).optional(),
  })),

  // Edges to adjacent chunks (for stitching)
  edges: z.object({
    north: z.string().optional(),  // Chunk ID
    south: z.string().optional(),
    east: z.string().optional(),
    west: z.string().optional(),
  }),

  // Generation metadata
  generatedAt: z.date(),
  seed: z.string(),
});
export type HubChunk = z.infer<typeof HubChunkSchema>;

// ============================================
// DISTRICT SCHEMA
// ============================================

export const HubDistrictSchema = z.object({
  id: z.string().uuid(),
  hubId: z.string().uuid(),

  // Identity
  name: z.string(),
  type: DistrictTypeSchema,

  // Which chunks this district covers
  chunkCoords: z.array(z.object({
    x: z.number().int(),
    y: z.number().int(),
  })),

  // Topology for this district
  topology: TopologyTypeSchema,

  // Demographics
  population: z.number().int().default(0),
  wealthLevel: z.enum(['destitute', 'poor', 'modest', 'comfortable', 'wealthy', 'aristocratic']).default('modest'),

  // Safety/Order
  crimeLevel: z.enum(['lawless', 'dangerous', 'rough', 'average', 'safe', 'patrolled']).default('average'),

  // Dominant faction(s)
  factions: z.array(z.object({
    factionId: z.string().uuid(),
    influence: z.number().int().min(0).max(100),
    visibility: z.enum(['secret', 'rumored', 'known', 'prominent', 'dominant']),
  })).default([]),

  // Notable locations (references to buildings)
  notableLocations: z.array(z.string().uuid()).default([]),

  // Description
  description: z.string().optional(),
  atmosphere: z.string().optional(),  // "busy markets", "quiet residential", etc.

  // Generation
  seed: z.string(),
});
export type HubDistrict = z.infer<typeof HubDistrictSchema>;

// ============================================
// HUB SCHEMA (The Settlement)
// ============================================

export const HubSchema = z.object({
  // Link to WorldNode
  worldNodeId: z.string().uuid(),

  // Identity (redundant with WorldNode but useful for caching)
  name: z.string(),
  size: HubSizeSchema,

  // Generation seed (deterministic regeneration)
  seed: z.string(),

  // Population
  population: z.number().int(),
  demographics: z.record(z.string(), z.number()).optional(),  // { "human": 60, "dwarf": 25, "elf": 10, "other": 5 }

  // Layout
  topology: TopologyTypeSchema,
  chunkGrid: z.object({
    width: z.number().int(),   // Number of chunks wide
    height: z.number().int(),  // Number of chunks tall
  }),

  // Districts
  districts: z.array(HubDistrictSchema),

  // Key locations (building IDs)
  keyLocations: z.object({
    entrance: z.array(z.string().uuid()).default([]),    // Gates, main roads in
    center: z.string().uuid().optional(),                 // Town square/market
    government: z.string().uuid().optional(),             // Town hall, keep
    temple: z.string().uuid().optional(),                 // Main religious
    market: z.string().uuid().optional(),                 // Main market
    inn: z.string().uuid().optional(),                    // Primary inn
    tavern: z.string().uuid().optional(),                 // Primary tavern
  }),

  // Defenses
  defenses: z.object({
    hasWalls: z.boolean().default(false),
    wallCondition: z.enum(['ruined', 'poor', 'fair', 'good', 'excellent']).optional(),
    gateCount: z.number().int().default(0),
    hasCastle: z.boolean().default(false),
    hasMoat: z.boolean().default(false),
    militia: z.number().int().default(0),
    guards: z.number().int().default(0),
  }),

  // Economy
  economy: z.object({
    type: z.enum(['agricultural', 'trade', 'craft', 'mining', 'fishing', 'military', 'religious', 'academic']),
    wealthLevel: z.enum(['impoverished', 'poor', 'modest', 'prosperous', 'wealthy', 'opulent']).default('modest'),
    exports: z.array(z.string()).default([]),
    imports: z.array(z.string()).default([]),
    hasMarket: z.boolean().default(true),
    marketDays: z.array(z.string()).default([]),  // "Godsday", "every day", etc.
  }),

  // Governance
  governance: z.object({
    type: z.enum(['none', 'elder', 'council', 'mayor', 'lord', 'guild', 'theocratic', 'military']),
    ruler: z.object({
      npcId: z.string().uuid().optional(),
      name: z.string(),
      title: z.string(),
    }).optional(),
    lawLevel: z.enum(['lawless', 'corrupt', 'weak', 'fair', 'strict', 'tyrannical']).default('fair'),
  }),

  // Services available
  services: z.object({
    hasTemple: z.boolean().default(false),
    hasInn: z.boolean().default(true),
    hasTavern: z.boolean().default(true),
    hasSmith: z.boolean().default(false),
    hasMarket: z.boolean().default(false),
    hasStables: z.boolean().default(false),
    hasBank: z.boolean().default(false),
    hasMageGuild: z.boolean().default(false),
    hasThievesGuild: z.boolean().default(false),
    hasHospital: z.boolean().default(false),
  }),

  // NPC tracking
  residentNPCs: z.array(z.string().uuid()).default([]),  // Character IDs where isNPC=true
  visitingNPCs: z.array(z.string().uuid()).default([]),

  // Current state
  state: z.object({
    isUnderAttack: z.boolean().default(false),
    isPlagued: z.boolean().default(false),
    isFamine: z.boolean().default(false),
    isOccupied: z.boolean().default(false),
    mood: z.enum(['fearful', 'tense', 'neutral', 'content', 'festive']).default('neutral'),
    currentEvent: z.string().optional(),  // "Harvest Festival", "Siege", etc.
  }),

  // Chunk cache status
  cachedChunks: z.record(z.string(), z.boolean()).default({}),  // "x,y" -> cached

  // Generation metadata
  generatedAt: z.date(),
  version: z.number().int().default(1),
});
export type Hub = z.infer<typeof HubSchema>;

// ============================================
// HUB SEED COMPOSITION
// ============================================
//
// The hub seed encodes the settlement's identity.
// From seed + size, we can regenerate the entire hub.
//
// Seed composition:
//   seed = worldNodeId + size + topology + era
//
// This ensures the same settlement always generates
// the same layout, but can evolve over time.
//

export const HubSeedSchema = z.object({
  worldNodeId: z.string().uuid(),
  size: HubSizeSchema,
  topology: TopologyTypeSchema,
  era: z.number().int().default(0),  // Increment to "evolve" the city
  cultureSeed: z.string().optional(),  // Inherited from region
});
export type HubSeed = z.infer<typeof HubSeedSchema>;

// ============================================
// OBSERVER STATE
// ============================================
//
// What the observer (player) can see.
// This is the "locally flat" view of the hub.
//

export const HubObserverStateSchema = z.object({
  // Who is observing
  characterId: z.string().uuid(),

  // Current position (world coordinates)
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),

  // Which chunk they're in
  currentChunk: z.object({
    x: z.number().int(),
    y: z.number().int(),
  }),

  // Which chunks are loaded (visible + hot cache)
  loadedChunks: z.array(z.object({
    x: z.number().int(),
    y: z.number().int(),
  })),

  // Trajectory prediction (where they might go)
  trajectory: z.array(z.object({
    x: z.number().int(),
    y: z.number().int(),
    probability: z.number(),  // 0-1, how likely to visit
  })).default([]),

  // Discovered locations (fog of war)
  discoveredBuildings: z.array(z.string().uuid()).default([]),
  discoveredDistricts: z.array(z.string().uuid()).default([]),

  // Known NPCs in this hub
  knownNPCs: z.array(z.string().uuid()).default([]),
});
export type HubObserverState = z.infer<typeof HubObserverStateSchema>;

// ============================================
// CHUNK LOADING STRATEGY
// ============================================
//
// Observer-local rendering:
// 1. IMMEDIATE: Current chunk (always loaded)
// 2. ADJACENT: 8 surrounding chunks (loaded)
// 3. TRAJECTORY: Predicted path (pre-loaded)
// 4. CACHED: Recently visited (kept warm)
// 5. COLD: Everything else (regenerated on demand)
//

export const CHUNK_LOAD_RADIUS = {
  immediate: 0,    // Current chunk
  adjacent: 1,     // 8 neighbors
  trajectory: 2,   // 24 chunks in prediction zone
  cached: 3,       // Keep last N visited chunks
};

export const MAX_CACHED_CHUNKS = 16;  // LRU cache size

// ============================================
// GENERATION PARAMETERS
// ============================================

export const HubGenerationParamsSchema = z.object({
  seed: HubSeedSchema,

  // Overrides (for custom settlements)
  forceDistricts: z.array(DistrictTypeSchema).optional(),
  forceBuildings: z.array(z.object({
    type: BuildingTypeSchema,
    name: z.string(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  })).optional(),

  // Cultural influence
  culturalTraits: z.any().optional(),  // From world graph

  // Economic context
  tradeRoutes: z.array(z.string()).default([]),
  nearbyResources: z.array(z.string()).default([]),

  // Historical context
  age: z.enum(['new', 'young', 'established', 'old', 'ancient']).default('established'),
  hasBeenDestroyed: z.boolean().default(false),
  wasRebuilt: z.boolean().default(false),
});
export type HubGenerationParams = z.infer<typeof HubGenerationParamsSchema>;
