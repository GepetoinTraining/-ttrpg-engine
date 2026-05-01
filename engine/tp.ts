/**
 * TP INDEX — Topology Pointer (Local Rule Resolution)
 * =====================================================
 * 
 * The .tp is NOT a monolith. A party is LOCAL, not non-local.
 * They're in the Market Ward of Suzail, not in Realmspace.
 * 
 * The .tp is an INDEX that resolves the local κ by walking
 * the ancestor chain. Each node in the world graph can override
 * rules from its parent. The party's current position determines
 * which overrides apply.
 * 
 * Resolution: walk up the tree, merge κ at each level.
 * 
 *   Market Ward → Suzail → Cormyr → Heartlands → Faerûn → Toril → Realmspace
 *   Each level may override: physics, magic, law, economy, time
 * 
 * Locally flat: the party sees ONE set of rules.
 * Globally curved: those rules emerge from the full ancestry.
 * 
 * This is the hub schema's observer-local rendering applied to rules.
 */

import { z } from 'zod'

// ============================================================
// WORLD NODE — A node in the world graph (from seed data)
// ============================================================

export const WorldNodeSchema = z.object({
  id: z.string(),
  type: z.string(),                    // crystal_sphere, planet, continent, region, settlement, district, building
  name: z.string(),
  canonicalName: z.string().optional(),
  parentId: z.string().nullable(),

  /** Static data — the κ at this level */
  dataStatic: z.record(z.string(), z.unknown()).default({}),
})
export type WorldNode = z.infer<typeof WorldNodeSchema>

// ============================================================
// PHYSICS RULES — κ for physics at any level
// ============================================================

export const PhysicsRulesSchema = z.object({
  gravity: z.object({
    type: z.enum(['standard', 'plane', 'none', 'reversed', 'variable']).default('standard'),
    strength: z.number().default(1.0),
    notes: z.string().optional(),
  }).optional(),

  atmosphere: z.object({
    type: z.enum(['standard', 'none', 'envelope', 'toxic', 'explosive']).default('standard'),
    notes: z.string().optional(),
  }).optional(),

  magic: z.object({
    level: z.enum(['dead', 'restricted', 'standard', 'enhanced', 'high', 'wild']).default('standard'),
    source: z.string().optional(),       // "The Weave", "Shadow Weave"
    specialRules: z.array(z.string()).default([]),
    schoolModifiers: z.record(z.string(), z.object({
      modifier: z.string(),
      notes: z.string().optional(),
    })).default({}),
  }).optional(),

  time: z.object({
    flow: z.enum(['standard', 'fast', 'slow', 'stopped', 'reversed']).default('standard'),
    ratio: z.string().default('1:1'),
  }).optional(),
}).partial()
export type PhysicsRules = z.infer<typeof PhysicsRulesSchema>

// ============================================================
// LAW RULES — κ for law enforcement at any level
// ============================================================

export const LawRulesSchema = z.object({
  system: z.string().optional(),         // "The Code of Cormyr"
  enforcement: z.enum(['none', 'lax', 'moderate', 'strict', 'tyrannical']).optional(),
  corruption: z.string().optional(),
  specialRules: z.array(z.string()).default([]),
  // e.g., "Adventurers must register for a Charter (1000gp)"
}).partial()
export type LawRules = z.infer<typeof LawRulesSchema>

// ============================================================
// ECONOMY RULES — κ for economy at any level
// ============================================================

export const EconomyRulesSchema = z.object({
  type: z.string().optional(),           // "imperial_capital", "trade"
  currency: z.string().optional(),       // "Cormyrean Golden Lion"
  taxRate: z.number().optional(),
  tradeModifier: z.number().optional(),  // multiplier on base prices
  wealthLevel: z.enum(['destitute', 'poor', 'modest', 'comfortable', 'wealthy', 'opulent']).optional(),
  commodities: z.record(z.string(), z.object({
    supply: z.number().optional(),
    demand: z.number().optional(),
    price: z.number().optional(),
    trend: z.enum(['rising', 'stable', 'falling']).optional(),
  })).optional(),
  exchangeRates: z.record(z.string(), z.number()).optional(),
  specialRules: z.array(z.string()).default([]),
}).partial()
export type EconomyRules = z.infer<typeof EconomyRulesSchema>

// ============================================================
// WEATHER — region → settlement (also covers sea regions)
// ============================================================

export const WeatherRulesSchema = z.object({
  // enums aligned with engine/weather.ts (the canonical source)
  climate: z.enum(['arctic', 'subarctic', 'temperate', 'subtropical', 'tropical', 'arid', 'oceanic']).optional(),
  season: z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
  temperature: z.number().optional(),
  precipitation: z.enum([
    'none', 'light_rain', 'rain', 'heavy_rain', 'storm',
    'light_snow', 'snow', 'blizzard', 'fog', 'hail',
  ]).optional(),
  wind: z.enum(['calm', 'breeze', 'windy', 'gale', 'hurricane']).optional(),
  visibility: z.enum(['clear', 'hazy', 'poor', 'blind']).optional(),
  severity: z.number().min(0).max(1).optional(),
  modifiers: z.object({
    yieldModifier: z.number().optional(),
    travelSpeed: z.number().optional(),
    monsterActivity: z.number().optional(),
    spoilageRate: z.number().optional(),
    starvationModifier: z.number().optional(),
    combatEffects: z.array(z.string()).default([]),
  }).optional(),
  // Sea-region extensions
  seaState: z.enum(['calm', 'choppy', 'rough', 'storm', 'hurricane']).optional(),
  currentDirection: z.enum(['north', 'south', 'east', 'west', 'variable']).optional(),
  currentStrength: z.number().optional(),
}).partial()
export type WeatherRules = z.infer<typeof WeatherRulesSchema>

// ============================================================
// ECOLOGY — region → settlement (sea variant has fish + predator)
// ============================================================

export const EcologyRulesSchema = z.object({
  wildlifeDensity: z.number().min(0).max(1).optional(),
  dangerLevel: z.number().min(0).max(1).optional(),
  dominantThreats: z.array(z.string()).default([]),
  // Sea variant
  fishDensity: z.number().min(0).max(1).optional(),
  predatorLevel: z.number().min(0).max(1).optional(),
  // Per-species adaptation pools (region-scoped). See engine/adaptation.ts
  // for the structured AdaptationPool type — this is the storage shape.
  adaptations: z.record(z.string(), z.object({
    speciesId: z.string(),
    weights: z.record(z.string(), z.number()).default({}),
    generation: z.number().int().nonnegative().default(0),
    fitness: z.record(z.string(), z.object({
      spawned: z.number().int().nonnegative().default(0),
      survivedClears: z.number().int().nonnegative().default(0),
      causedCasualties: z.number().int().nonnegative().default(0),
      lastSeenAtGen: z.number().int().nonnegative().default(0),
    })).default({}),
  })).optional(),
  // Wild herds with persistence-required deviations from biome baseline.
  // Keyed by herd id. Mirrors `WildHerd` shape from engine/wild-fauna.ts.
  // Unobserved regions don't allocate this — herds derive from biome+seed
  // until the first interaction or autonomous tick produces a delta.
  herds: z.record(z.string(), z.object({
    id: z.string(),
    speciesId: z.string(),
    currentNodeId: z.string(),
    destinationNodeId: z.string().nullable(),
    edgeId: z.string().nullable(),
    edgeMile: z.number().nonnegative(),
    edgeTotalMiles: z.number().nonnegative(),
    population: z.number().int().nonnegative(),
    daysHungry: z.number().int().nonnegative(),
    foodSecurity: z.number().min(0).max(1),
    formation: z.enum(['column', 'defensive_box', 'spread', 'scattered']),
    status: z.enum(['grazing', 'migrating', 'fleeing', 'starving', 'decimated']),
    bornDay: z.number().int().nonnegative(),
    lastTransitionDay: z.number().int().nonnegative(),
  })).optional(),
  // Per-species deviation from biome baseline density for ecology
  // interactables (Δ.1: flora / fauna / fungi / moss). Default 1.0 = at
  // baseline; harvest reduces, regen restores toward baseline.
  interactableDensity: z.record(z.string(), z.number().min(0).max(1)).optional(),
}).partial()
export type EcologyRules = z.infer<typeof EcologyRulesSchema>

// ============================================================
// FACTION — region → settlement
// ============================================================

export const FactionRulesSchema = z.object({
  control: z.record(z.string(), z.object({
    influence: z.number().optional(),
    loyalty: z.number().optional(),
    stance: z.enum(['hostile', 'unfriendly', 'neutral', 'friendly', 'allied']).optional(),
  })).optional(),
  dominant: z.string().nullable().optional(),
  contested: z.boolean().optional(),
}).partial()
export type FactionRules = z.infer<typeof FactionRulesSchema>

// ============================================================
// SOCIAL — region → settlement
// ============================================================

export const SocialRulesSchema = z.object({
  titles: z.record(z.string(), z.object({
    rank: z.enum(['knight', 'baron', 'count', 'duke', 'prince', 'king']).optional(),
    holder: z.string().nullable().optional(),
    succession: z.enum(['primogeniture', 'elective', 'merit', 'conquest']).optional(),
  })).optional(),
  standingAvg: z.number().optional(),
  contracts: z.object({
    active: z.number().optional(),
    breached: z.number().optional(),
    enforceability: z.number().optional(),
  }).optional(),
}).partial()
export type SocialRules = z.infer<typeof SocialRulesSchema>

// ============================================================
// CULTURE — continent → district
// ============================================================

export const CultureRulesSchema = z.object({
  government: z.object({
    type: z.string().optional(),
    ruler: z.string().optional(),
    rulingBody: z.string().optional(),
  }).optional(),
  customs: z.record(z.string(), z.unknown()).optional(),
  attitudes: z.record(z.string(), z.string()).optional(),
  entertainment: z.object({
    culturalScore: z.number().optional(),
    revenue: z.number().optional(),
    venues: z.number().optional(),
  }).optional(),
  food: z.object({
    variety: z.number().optional(),
    morale: z.number().optional(),
  }).optional(),
  // legacy: some hub seed data nests law inside culture
  law: z.unknown().optional(),
}).partial()
export type CultureRules = z.infer<typeof CultureRulesSchema>

// ============================================================
// RELIGION — continent → settlement
// ============================================================

export const ReligionRulesSchema = z.object({
  pantheon: z.string().optional(),
  dominant: z.string().nullable().optional(),
  temples: z.record(z.string(), z.object({
    deity: z.string().optional(),
    size: z.enum(['shrine', 'chapel', 'temple', 'cathedral', 'holy_site']).optional(),
    clergy: z.number().optional(),
    faithOutput: z.number().optional(),
  })).optional(),
  faithPool: z.record(z.string(), z.number()).optional(),
}).partial()
export type ReligionRules = z.infer<typeof ReligionRulesSchema>

// ============================================================
// MILITARY — region → settlement (the garrison that doesn't move)
// ============================================================

export const MilitaryRulesSchema = z.object({
  garrison: z.number().optional(),
  readiness: z.number().min(0).max(1).optional(),
  morale: z.number().optional(),
  upkeep: z.number().optional(),
  fortification: z.enum(['none', 'palisade', 'stone_wall', 'castle', 'fortress']).optional(),
}).partial()
export type MilitaryRules = z.infer<typeof MilitaryRulesSchema>

// ============================================================
// LEAF-ONLY κ DOMAINS — settlement scope, not inherited
// ============================================================

export const SettlementRulesSchema = z.object({
  scale: z.enum(['regional_capital', 'city', 'town', 'village', 'hamlet', 'outpost']).optional(),
  population: z.number().optional(),
  stability: z.number().optional(),
  unrest: z.number().optional(),
  morale: z.number().optional(),
  growthRate: z.number().optional(),
  guards: z.number().optional(),
}).partial()
export type SettlementRules = z.infer<typeof SettlementRulesSchema>

export const MarketRulesSchema = z.object({
  tier: z.enum(['none', 'village', 'town', 'city', 'metropolis']).optional(),
  venues: z.record(z.string(), z.object({
    type: z.string().optional(),
    capacity: z.number().optional(),
    reputation: z.number().optional(),
  })).optional(),
  events: z.array(z.string()).default([]),
  lastTick: z.number().optional(),
}).partial()
export type MarketRules = z.infer<typeof MarketRulesSchema>

export const InfrastructureRulesSchema = z.object({
  professions: z.record(z.string(), z.object({
    count: z.number().optional(),
    tier: z.string().optional(),
    guildId: z.string().nullable().optional(),
  })).optional(),
  buildings: z.record(z.string(), z.object({
    count: z.number().optional(),
    condition: z.string().optional(),
  })).optional(),
  knowledgeTier: z.number().optional(),
  workshops: z.array(z.string()).default([]),
  recipes: z.array(z.string()).default([]),
  // Mining strata at this leaf node (Δ.4). Mirrors `MineLayer` shape from
  // engine/mining-layers.ts. The first layer (layerId 0) is created on
  // first observation; deeper layers are revealed by `mfMineReveal`.
  mineLayers: z.array(z.object({
    layerId: z.number().int().min(0).max(10),
    depth: z.number().nonnegative(),
    resourceType: z.string(),
    initialReserve: z.number().nonnegative(),
    reserve: z.number().nonnegative(),
    depletionRate: z.number().nonnegative(),
    structuralIntegrity: z.number().min(0).max(1),
    hazardThreshold: z.number().min(0).max(1),
    revealed: z.boolean(),
  })).optional(),
}).partial()
export type InfrastructureRules = z.infer<typeof InfrastructureRulesSchema>

export const KnowledgeRulesSchema = z.object({
  seeds: z.record(z.string(), z.object({
    category: z.string().optional(),
    source: z.string().optional(),
    activatedDay: z.number().nullable().optional(),
  })).optional(),
  potentials: z.array(z.string()).default([]),
  tier: z.number().optional(),
  library: z.object({
    books: z.number().optional(),
    scrolls: z.number().optional(),
    researchSpeed: z.number().optional(),
  }).optional(),
  // Unlocked tech blobs at this settlement (Δ.6). Maps purpose
  // (e.g. 'fishing-tool', 'mining-tool') → highest tier reached
  // (one of TIER_ORDER from engine/tier.ts: F, E, D, C, B, A, S, SS, SSS, EX).
  unlockedTech: z.record(z.string(), z.string()).optional(),
}).partial()
export type KnowledgeRules = z.infer<typeof KnowledgeRulesSchema>

export const GuildRulesSchema = z.object({
  chapters: z.record(z.string(), z.object({
    type: z.enum(['adventurer', 'merchant', 'thieves', 'mage', 'craft']).optional(),
    members: z.number().optional(),
    treasury: z.number().optional(),
    reputation: z.number().optional(),
    jobs: z.object({
      posted: z.number().optional(),
      active: z.number().optional(),
      completed: z.number().optional(),
    }).optional(),
  })).optional(),
  intel: z.object({
    sightings: z.array(z.string()).default([]),
    rumors: z.array(z.string()).default([]),
  }).optional(),
}).partial()
export type GuildRules = z.infer<typeof GuildRulesSchema>

export const WaterRulesSchema = z.object({
  // Per-source state — keyed by waterBodyId or sourceId.
  // `type` covers both abstract source concepts (well, spring, port) AND
  // concrete water-body kinds (stream, river, lake, bay, sea, ocean, delta,
  // swamp). The string is open so MMWater can persist the body type directly
  // and a future settlement-level aggregator can write source-type strings.
  sources: z.record(z.string(), z.object({
    type: z.string().optional(),
    level: z.number().optional(),
    // Aligned with engine/water.ts FloodStage union.
    floodStage: z.enum([
      'drought', 'low', 'normal', 'watch', 'warning', 'flood', 'catastrophic',
    ]).optional(),
    fishStock: z.number().optional(),
    /** Salinity if known (fresh/brackish/salt) */
    salinity: z.enum(['fresh', 'brackish', 'salt']).optional(),
    /** Is this body navigable by boats? */
    navigable: z.boolean().optional(),
  })).optional(),
}).partial()
export type WaterRules = z.infer<typeof WaterRulesSchema>

/**
 * Inheritable κ domain keys — merged root→leaf during resolve().
 * Child overrides parent.
 */
export const INHERITABLE_DOMAINS = [
  'physics', 'law', 'economy', 'weather', 'ecology',
  'faction', 'social', 'culture', 'religion', 'military',
] as const
export type InheritableDomain = typeof INHERITABLE_DOMAINS[number]

/**
 * Leaf-only κ domain keys — only valid at hub-level nodes,
 * never merged through ancestry.
 */
export const LEAF_DOMAINS = [
  'settlement', 'market', 'infrastructure', 'knowledge', 'guild', 'water',
] as const
export type LeafDomain = typeof LEAF_DOMAINS[number]

export type KappaDomain = InheritableDomain | LeafDomain

/**
 * Type-level map from domain key to its inferred TS type.
 * Used by writeDomain() for compile-time validation of κ writes.
 */
export type DomainValueMap = {
  physics: PhysicsRules
  law: LawRules
  economy: EconomyRules
  weather: WeatherRules
  ecology: EcologyRules
  faction: FactionRules
  social: SocialRules
  culture: CultureRules
  religion: ReligionRules
  military: MilitaryRules
  settlement: SettlementRules
  market: MarketRules
  infrastructure: InfrastructureRules
  knowledge: KnowledgeRules
  guild: GuildRules
  water: WaterRules
}

// ============================================================
// ENTITY POSITION — Where things live and move
// ============================================================

/**
 * EntityPosition — the three ways an entity can be located.
 *
 * - `at_node`:  static at a .tp node (NPC at hub, garrison at fortress)
 * - `on_edge`:  moving along a route (caravan at mile 47, shipment in transit)
 * - `abstract`: not bound to topology (factions, pantheons, ideas)
 */
export const EntityPositionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('at_node'), nodeId: z.string() }),
  z.object({
    type: z.literal('on_edge'),
    edgeId: z.string(),
    mile: z.number().nonnegative(),
    direction: z.enum(['forward', 'reverse']),
  }),
  z.object({ type: z.literal('abstract') }),
])
export type EntityPosition = z.infer<typeof EntityPositionSchema>

/**
 * Entity — a thing with its own lifecycle. Reads κ, may write summary κ.
 *
 * The TP entity registry is a POSITION INDEX only. State lives in the
 * domain MM that owns the entity (MMNpc, MMCaravan, MMArmy, etc).
 *
 * Examples: caravan, npc, army, herd, merchant, monster_group, dungeon_gate,
 * faction (abstract), patrol (on_edge segment).
 */
export const EntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  position: EntityPositionSchema,
})
export type Entity = z.infer<typeof EntitySchema>

/**
 * Runtime schema lookup for typed writes.
 * Mirrors DomainValueMap at runtime so writeDomain can validate via Zod.
 */
export const DOMAIN_SCHEMAS: { [K in KappaDomain]: z.ZodType } = {
  physics: PhysicsRulesSchema,
  law: LawRulesSchema,
  economy: EconomyRulesSchema,
  weather: WeatherRulesSchema,
  ecology: EcologyRulesSchema,
  faction: FactionRulesSchema,
  social: SocialRulesSchema,
  culture: CultureRulesSchema,
  religion: ReligionRulesSchema,
  military: MilitaryRulesSchema,
  settlement: SettlementRulesSchema,
  market: MarketRulesSchema,
  infrastructure: InfrastructureRulesSchema,
  knowledge: KnowledgeRulesSchema,
  guild: GuildRulesSchema,
  water: WaterRulesSchema,
}

// ============================================================
// LOCAL CONTEXT — The resolved κ at a specific position
// ============================================================

export const LocalContextSchema = z.object({
  /** The leaf node where the party currently is */
  currentNodeId: z.string(),
  currentNodeName: z.string(),
  currentNodeType: z.string(),

  /** The full ancestry chain (leaf → root) */
  ancestry: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
  })),

  // ── Inheritable domains (10) — merged through ancestry ──
  /** Physical laws (gravity, atmosphere, magic level, time flow) */
  physics: PhysicsRulesSchema,
  /** Legal/jurisdictional κ */
  law: LawRulesSchema,
  /** Economic environment (currency, prices, trade) */
  economy: EconomyRulesSchema,
  /** Weather state at this location */
  weather: WeatherRulesSchema,
  /** Ecological pressure (wildlife, danger, threats) */
  ecology: EcologyRulesSchema,
  /** Faction control / contested territory */
  faction: FactionRulesSchema,
  /** Social titles / contracts / standing */
  social: SocialRulesSchema,
  /** Cultural government / customs / entertainment / food */
  culture: CultureRulesSchema,
  /** Religious pantheon / temples / faith */
  religion: ReligionRulesSchema,
  /** Garrison / fortification / readiness */
  military: MilitaryRulesSchema,

  // ── Leaf-only domains (6) — only present at hub-level nodes ──
  /** Population, stability, unrest at this hub */
  settlement: SettlementRulesSchema.optional(),
  /** Market tier, venues, commodity events */
  market: MarketRulesSchema.optional(),
  /** Professions, buildings, knowledge tier */
  infrastructure: InfrastructureRulesSchema.optional(),
  /** Knowledge seeds, library, research progress */
  knowledge: KnowledgeRulesSchema.optional(),
  /** Guild chapters and intel */
  guild: GuildRulesSchema.optional(),
  /** Water sources, flood stage, fish stock */
  water: WaterRulesSchema.optional(),

  /** Applicable edges at this location */
  edges: z.array(z.object({
    type: z.string(),
    sourceId: z.string(),
    targetId: z.string(),
    properties: z.record(z.string(), z.unknown()).default({}),
  })).default([]),

  /** Entities currently at this leaf node (NPCs, caravans staged here, etc.) */
  entitiesAt: z.array(EntitySchema).default([]),

  /** Raw data from the current node */
  nodeData: z.record(z.string(), z.unknown()).default({}),
})
export type LocalContext = z.infer<typeof LocalContextSchema>

// ============================================================
// TP INDEX — The topology pointer
// ============================================================

/**
 * Edge in the world graph.
 */
export interface WorldEdge {
  type: string
  sourceId: string
  targetId: string
  properties: Record<string, unknown>
}

/**
 * TP — the topology pointer.
 * 
 * An index over the world graph. Does NOT load the whole world.
 * Resolves the local rule context for any position by walking
 * up the parent chain.
 * 
 * Usage:
 *   const tp = new TP()
 *   tp.loadNodes(nodesFromSeedFiles)
 *   tp.loadEdges(edgesFromSeedFiles)
 *   const ctx = tp.resolve('market_ward_suzail')
 *   // ctx.physics.magic.level → 'high'
 *   // ctx.law.enforcement → 'strict'
 *   // ctx.ancestry → [Market Ward, Suzail, Cormyr, Heartlands, Faerûn, Toril, Realmspace]
 */
export class TP {
  private nodes = new Map<string, WorldNode>()
  private edges: WorldEdge[] = []
  private childrenIndex = new Map<string, string[]>()

  // ── Entity position registry ──
  // Main map: entityId → Entity record
  private entities = new Map<string, Entity>()
  // Reverse indices for O(1) lookup by location
  private entitiesByNode = new Map<string, Set<string>>()
  private entitiesByEdge = new Map<string, Set<string>>()

  /**
   * Load nodes into the index (from seed files).
   * Can be called incrementally — only load what you need.
   */
  loadNodes(nodes: WorldNode[]): void {
    for (const node of nodes) {
      this.nodes.set(node.id, node)

      // Build children index
      if (node.parentId) {
        const siblings = this.childrenIndex.get(node.parentId) ?? []
        if (!siblings.includes(node.id)) {
          siblings.push(node.id)
          this.childrenIndex.set(node.parentId, siblings)
        }
      }
    }
  }

  /**
   * Load edges into the index.
   */
  loadEdges(edges: WorldEdge[]): void {
    this.edges.push(...edges)
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): WorldNode | undefined {
    return this.nodes.get(id)
  }

  /**
   * Get children of a node.
   */
  getChildren(nodeId: string): WorldNode[] {
    const childIds = this.childrenIndex.get(nodeId) ?? []
    return childIds.map(id => this.nodes.get(id)).filter(Boolean) as WorldNode[]
  }

  /**
   * Walk up the ancestor chain from a node.
   * Returns [leaf, ..., root].
   */
  ancestry(nodeId: string): WorldNode[] {
    const chain: WorldNode[] = []
    let current = this.nodes.get(nodeId)

    while (current) {
      chain.push(current)
      current = current.parentId ? this.nodes.get(current.parentId) : undefined
    }

    return chain
  }

  /**
   * Resolve — get the local context for a position.
   * 
   * This is the core operation. Walks up the ancestor chain
   * and merges κ at each level. Child overrides parent.
   * 
   * O(depth) — world trees are shallow (8 levels max).
   */
  resolve(nodeId: string): LocalContext | null {
    const chain = this.ancestry(nodeId)
    if (chain.length === 0) return null

    const leaf = chain[0]

    // Merge rules: parent first, child overrides
    // Walk from root → leaf so leaf wins
    const reversed = [...chain].reverse()

    // Initialize empty bags for every inheritable domain
    const merged: Record<InheritableDomain, Record<string, unknown>> = {
      physics: {},
      law: {},
      economy: {},
      weather: {},
      ecology: {},
      faction: {},
      social: {},
      culture: {},
      religion: {},
      military: {},
    }

    for (const node of reversed) {
      const data = node.dataStatic as Record<string, unknown>

      for (const domain of INHERITABLE_DOMAINS) {
        const slice = data[domain]
        if (slice && typeof slice === 'object' && !Array.isArray(slice)) {
          merged[domain] = deepMerge(
            merged[domain],
            slice as Record<string, unknown>,
          )
        }
      }

      // Legacy hub seed data nests law inside culture
      const cultureSlice = data.culture as Record<string, unknown> | undefined
      if (cultureSlice?.law && typeof cultureSlice.law === 'object' && !Array.isArray(cultureSlice.law)) {
        merged.law = deepMerge(merged.law, cultureSlice.law as Record<string, unknown>)
      }
    }

    // Pull leaf-only domains from the leaf node only
    const leafData = leaf.dataStatic as Record<string, unknown>
    const leafSlice = (key: LeafDomain): Record<string, unknown> | undefined => {
      const v = leafData[key]
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : undefined
    }

    // Find applicable edges
    const nodeIds = new Set(chain.map(n => n.id))
    const applicableEdges = this.edges.filter(
      e => nodeIds.has(e.sourceId) || nodeIds.has(e.targetId)
    )

    return {
      currentNodeId: leaf.id,
      currentNodeName: leaf.name,
      currentNodeType: leaf.type,
      ancestry: chain.map(n => ({ id: n.id, name: n.name, type: n.type })),
      physics: merged.physics as PhysicsRules,
      law: merged.law as LawRules,
      economy: merged.economy as EconomyRules,
      weather: merged.weather as WeatherRules,
      ecology: merged.ecology as EcologyRules,
      faction: merged.faction as FactionRules,
      social: merged.social as SocialRules,
      culture: merged.culture as CultureRules,
      religion: merged.religion as ReligionRules,
      military: merged.military as MilitaryRules,
      settlement: leafSlice('settlement') as SettlementRules | undefined,
      market: leafSlice('market') as MarketRules | undefined,
      infrastructure: leafSlice('infrastructure') as InfrastructureRules | undefined,
      knowledge: leafSlice('knowledge') as KnowledgeRules | undefined,
      guild: leafSlice('guild') as GuildRules | undefined,
      water: leafSlice('water') as WaterRules | undefined,
      edges: applicableEdges,
      entitiesAt: this.getEntitiesAt(leaf.id),
      nodeData: leafData,
    }
  }

  /**
   * Check if a specific rule applies at a position.
   * 
   * Examples:
   *   tp.check('market_ward', 'magic.level')  → 'high'
   *   tp.check('undercity', 'magic.level')     → 'dead' (if override exists)
   *   tp.check('phlogiston', 'magic.level')    → 'restricted'
   */
  check(nodeId: string, path: string): unknown {
    const ctx = this.resolve(nodeId)
    if (!ctx) return undefined

    // Walk the dot-path into the merged physics/law/economy
    const parts = path.split('.')
    const domain = parts[0]
    const rest = parts.slice(1)

    let obj: unknown
    if (domain === 'physics') obj = ctx.physics
    else if (domain === 'law') obj = ctx.law
    else if (domain === 'economy') obj = ctx.economy
    else obj = ctx.nodeData

    for (const part of rest) {
      if (obj && typeof obj === 'object' && part in (obj as Record<string, unknown>)) {
        obj = (obj as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return obj
  }

  /**
   * Get all loaded nodes count.
   */
  size(): number {
    return this.nodes.size
  }

  /**
   * Get all node IDs at a given depth.
   */
  nodesAtDepth(depth: number): WorldNode[] {
    const result: WorldNode[] = []
    for (const node of this.nodes.values()) {
      if (this.ancestry(node.id).length - 1 === depth) {
        result.push(node)
      }
    }
    return result
  }

  /**
   * Get all loaded nodes.
   */
  getAllNodes(): WorldNode[] {
    return Array.from(this.nodes.values())
  }

  // ============================================================
  // MUTATION — κ write methods for tick systems
  // ============================================================

  /**
   * Write κ overrides to a node using dot-path notation.
   * This is how tick systems mutate the world:
   *   tp.writeKappa('suzail', { 'weather.severity': 0.7, 'weather.temperature': 65 })
   * 
   * Creates nested objects automatically.
   * Returns true if the node was found and written to.
   */
  writeKappa(nodeId: string, overrides: Record<string, unknown>): boolean {
    const node = this.nodes.get(nodeId)
    if (!node) return false
    for (const [key, value] of Object.entries(overrides)) {
      setByDotPath(node.dataStatic as Record<string, unknown>, key, value)
    }
    return true
  }

  /**
   * Typed κ write — validates the value against the domain's Zod schema
   * and merges into the existing slice (or replaces if `merge: false`).
   *
   * Domain modules in Wave 2+ should prefer this over writeKappa() because
   * it gives compile-time + runtime validation against the canonical schema:
   *
   *   tp.writeDomain('suzail', 'weather', {
   *     severity: 0.7, temperature: 65, precipitation: 'light',
   *   })
   *
   * Throws ZodError on invalid input. Returns false if the node doesn't exist.
   */
  writeDomain<D extends KappaDomain>(
    nodeId: string,
    domain: D,
    value: DomainValueMap[D],
    options?: { merge?: boolean },
  ): boolean {
    const node = this.nodes.get(nodeId)
    if (!node) return false

    // Runtime validation against the canonical schema
    const schema = DOMAIN_SCHEMAS[domain]
    const parsed = schema.parse(value) as Record<string, unknown>

    const ds = node.dataStatic as Record<string, unknown>
    const merge = options?.merge !== false
    const existing = ds[domain]

    if (
      merge &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      ds[domain] = deepMerge(existing as Record<string, unknown>, parsed)
    } else {
      ds[domain] = parsed
    }
    return true
  }

  /**
   * Shallow-merge data into a node's dataStatic.
   * For top-level κ writes that don't need dot-path:
   *   tp.mutateNode('suzail', { weather: { severity: 0.7 } })
   */
  mutateNode(nodeId: string, data: Record<string, unknown>): boolean {
    const node = this.nodes.get(nodeId)
    if (!node) return false
    const ds = node.dataStatic as Record<string, unknown>
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value) &&
          ds[key] && typeof ds[key] === 'object' && !Array.isArray(ds[key])) {
        ds[key] = { ...(ds[key] as Record<string, unknown>), ...(value as Record<string, unknown>) }
      } else {
        ds[key] = value
      }
    }
    return true
  }

  // ============================================================
  // ENTITY REGISTRY — position index for things with lifecycles
  // ============================================================

  /**
   * Register an entity (or replace if it already exists).
   * Updates reverse indices so getEntitiesAt/OnEdge stays O(1).
   */
  registerEntity(entity: Entity): void {
    // If replacing, clear previous index entries
    const prev = this.entities.get(entity.id)
    if (prev) this.removeFromIndex(prev)

    this.entities.set(entity.id, entity)
    this.addToIndex(entity)
  }

  /**
   * Remove an entity from the registry. Returns false if not found.
   */
  unregisterEntity(entityId: string): boolean {
    const e = this.entities.get(entityId)
    if (!e) return false
    this.removeFromIndex(e)
    this.entities.delete(entityId)
    return true
  }

  /**
   * Look up an entity by ID.
   */
  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId)
  }

  /**
   * Get all entities currently positioned at a node.
   * Empty array if none or if the node doesn't exist.
   */
  getEntitiesAt(nodeId: string): Entity[] {
    const ids = this.entitiesByNode.get(nodeId)
    if (!ids) return []
    const out: Entity[] = []
    for (const id of ids) {
      const e = this.entities.get(id)
      if (e) out.push(e)
    }
    return out
  }

  /**
   * Get all entities currently traveling along an edge.
   */
  getEntitiesOnEdge(edgeId: string): Entity[] {
    const ids = this.entitiesByEdge.get(edgeId)
    if (!ids) return []
    const out: Entity[] = []
    for (const id of ids) {
      const e = this.entities.get(id)
      if (e) out.push(e)
    }
    return out
  }

  /**
   * Move an entity to a new position. Returns false if entity not found.
   * Re-indexes for the new position type (at_node / on_edge / abstract).
   */
  moveEntity(entityId: string, newPosition: EntityPosition): boolean {
    const e = this.entities.get(entityId)
    if (!e) return false
    this.removeFromIndex(e)
    e.position = newPosition
    this.addToIndex(e)
    return true
  }

  /**
   * Get all registered entities (for serialization / debug).
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values())
  }

  /** Internal: add an entity to the appropriate reverse index. */
  private addToIndex(e: Entity): void {
    if (e.position.type === 'at_node') {
      const set = this.entitiesByNode.get(e.position.nodeId) ?? new Set<string>()
      set.add(e.id)
      this.entitiesByNode.set(e.position.nodeId, set)
    } else if (e.position.type === 'on_edge') {
      const set = this.entitiesByEdge.get(e.position.edgeId) ?? new Set<string>()
      set.add(e.id)
      this.entitiesByEdge.set(e.position.edgeId, set)
    }
    // abstract entities are not location-indexed
  }

  /** Internal: remove an entity from its current reverse index entry. */
  private removeFromIndex(e: Entity): void {
    if (e.position.type === 'at_node') {
      const set = this.entitiesByNode.get(e.position.nodeId)
      if (set) {
        set.delete(e.id)
        if (set.size === 0) this.entitiesByNode.delete(e.position.nodeId)
      }
    } else if (e.position.type === 'on_edge') {
      const set = this.entitiesByEdge.get(e.position.edgeId)
      if (set) {
        set.delete(e.id)
        if (set.size === 0) this.entitiesByEdge.delete(e.position.edgeId)
      }
    }
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Set a value at a dot-path in an object, creating intermediate objects.
 * 'weather.temperature' → obj.weather.temperature = value
 */
function setByDotPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

/**
 * Deep merge two objects. Target values override source.
 * Arrays are replaced, not concatenated.
 */
function deepMerge<T extends Record<string, unknown>>(source: T, target: Record<string, unknown>): T {
  const result = { ...source } as Record<string, unknown>
  for (const key of Object.keys(target)) {
    const targetVal = target[key]
    const sourceVal = result[key]

    if (
      targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal) &&
      sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        sourceVal as Record<string, unknown>,
        targetVal as Record<string, unknown>,
      )
    } else if (targetVal !== undefined) {
      result[key] = targetVal
    }
  }
  return result as T
}
