import { z } from "zod";

// ============================================
// EXTRACTION SYSTEM - THE PRIMARY SECTOR
// ============================================
//
// Philosophy: NOTHING COMES FROM NOWHERE
//
// Every commodity in the economy traces back to a geographic source.
// Iron weapons? From iron ingots. From iron ore. From a mine.
// That mine? Sits on a deposit. That deposit? Has finite reserves.
//
// This is the PRIMARY sector - extraction and agriculture.
// Pre-industrial economies: 70-80% of labor here.
// Everything downstream depends on this layer existing.
//
// The map IS the economy. Geography IS destiny.
//

// ============================================
// DEPOSIT TYPES
// ============================================

export const DepositTypeSchema = z.enum([
  // Mining
  "surface",      // Easy access, low tech required
  "shallow",      // Basic mining
  "deep",         // Advanced mining, dangerous
  "underwater",   // Requires specialized equipment
  "volcanic",     // Near magma, extreme conditions

  // Agriculture
  "arable",       // Farmland
  "pasture",      // Grazing land
  "orchard",      // Fruit/nut trees
  "vineyard",     // Grape cultivation

  // Forestry
  "forest",       // Standard timber
  "old_growth",   // Ancient trees, better quality
  "managed",      // Replanted, sustainable

  // Aquatic
  "fishery",      // Coastal/river fishing
  "deep_sea",     // Ocean fishing
  "shellfish",    // Oysters, clams, etc.

  // Gathering
  "herb_field",   // Medicinal/alchemical plants
  "game_land",    // Hunting grounds
  "salt_flat",    // Salt deposits

  // Exotic
  "ley_line",     // Magical energy source
  "planar_bleed", // Extraplanar materials
  "ruins",        // Ancient salvage
]);
export type DepositType = z.infer<typeof DepositTypeSchema>;

// ============================================
// DEPOSIT QUALITY
// ============================================

export const DepositQualitySchema = z.enum([
  "depleted",     // Nearly exhausted (0.25x output)
  "poor",         // Low quality (0.5x output)
  "standard",     // Normal (1x output)
  "rich",         // High quality (1.5x output)
  "legendary",    // Exceptional (2x output, rare materials)
]);
export type DepositQuality = z.infer<typeof DepositQualitySchema>;

export const QUALITY_MULTIPLIERS: Record<DepositQuality, number> = {
  depleted: 0.25,
  poor: 0.5,
  standard: 1.0,
  rich: 1.5,
  legendary: 2.0,
};

// ============================================
// TECH LEVELS (from world schema)
// ============================================

export const TechLevelSchema = z.enum([
  "stone_age",
  "bronze_age",
  "iron_age",
  "medieval",
  "renaissance",
  "magipunk",
  "spelljammer",
]);
export type TechLevel = z.infer<typeof TechLevelSchema>;

export const TECH_LEVEL_ORDER: Record<TechLevel, number> = {
  stone_age: 0,
  bronze_age: 1,
  iron_age: 2,
  medieval: 3,
  renaissance: 4,
  magipunk: 5,
  spelljammer: 6,
};

// ============================================
// RESOURCE DEPOSIT - THE CORE SCHEMA
// ============================================

export const ResourceDepositSchema = z.object({
  id: z.string().uuid(),

  // ─────────────────────────────────────────
  // LOCATION (ties to world graph)
  // ─────────────────────────────────────────
  locationId: z.string().uuid(),        // World graph node ID
  locationName: z.string(),             // Cached for display
  regionId: z.string().uuid().optional(), // Parent region

  // ─────────────────────────────────────────
  // WHAT'S HERE
  // ─────────────────────────────────────────
  name: z.string(),                     // "Ironforge Vein", "Darkwood Forest"
  depositType: DepositTypeSchema,

  // What commodity this produces (links to economy.ts)
  primaryCommodityId: z.string(),       // "iron_ore", "timber", "grain"
  secondaryCommodities: z.array(z.object({
    commodityId: z.string(),
    chance: z.number().min(0).max(1),   // Probability per extraction
    ratio: z.number(),                  // Amount relative to primary
  })).default([]),

  // Quality affects output multiplier
  quality: DepositQualitySchema.default("standard"),

  // ─────────────────────────────────────────
  // RESERVES (finite resources)
  // ─────────────────────────────────────────
  // For non-renewable (mining):
  totalReserves: z.number().optional(),      // Original amount (units)
  remainingReserves: z.number().optional(),  // Current amount
  depletionPerUnit: z.number().default(1),   // How much reserve lost per unit extracted

  // For renewable (farming, forestry, fishing):
  renewable: z.boolean().default(false),
  regenerationRate: z.number().default(0),   // Units per day naturally restored
  maxCapacity: z.number().optional(),        // Maximum sustainable yield
  currentCapacity: z.number().optional(),    // Current yield capacity
  overexploited: z.boolean().default(false), // Pushed past sustainable limits

  // ─────────────────────────────────────────
  // EXTRACTION REQUIREMENTS
  // ─────────────────────────────────────────
  minimumTechLevel: TechLevelSchema.default("stone_age"),
  requiredBuilding: z.string().optional(),   // "mine", "farm", "lumber_camp"
  requiredTools: z.array(z.string()).default([]), // Special equipment

  // Labor
  laborRequirement: z.number().int().default(1), // Minimum workers needed
  optimalLabor: z.number().int().default(10),    // Workers for max efficiency
  maxLabor: z.number().int().default(50),        // Diminishing returns cap

  // Skill requirements (ties to skills system)
  requiredSkills: z.array(z.object({
    skillId: z.string(),
    minLevel: z.number().int().default(1),
  })).default([]),

  // ─────────────────────────────────────────
  // HAZARDS
  // ─────────────────────────────────────────
  hazards: z.array(z.object({
    type: z.enum([
      "cave_in",        // Mining
      "flooding",       // Mining, fishing
      "gas_pocket",     // Deep mining
      "monster_lair",   // Any wilderness
      "bandit_camp",    // Trade routes
      "disease",        // Agriculture, swamps
      "extreme_weather", // Exposed locations
      "magical_anomaly", // Near ley lines
      "territorial_creature", // Fishing, forestry
    ]),
    severity: z.enum(["minor", "moderate", "severe", "deadly"]),
    probability: z.number().min(0).max(1), // Per extraction cycle
    description: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // CURRENT STATE
  // ─────────────────────────────────────────
  discovered: z.boolean().default(false),
  discoveredBy: z.string().uuid().optional(),  // Character/party ID
  discoveredAt: z.string().optional(),         // ISO date

  exploited: z.boolean().default(false),
  exploitedSince: z.string().optional(),       // ISO date

  // Who controls this
  controlledBy: z.string().uuid().optional(),  // Faction ID
  controllerName: z.string().optional(),
  controlType: z.enum([
    "unclaimed",
    "claimed",         // Legal ownership
    "occupied",        // Military control
    "contested",       // Multiple claimants
    "protected",       // Cannot be exploited (sacred, etc.)
  ]).default("unclaimed"),

  // ─────────────────────────────────────────
  // OUTPUT (when exploited)
  // ─────────────────────────────────────────
  // Base output per slot (600 turns = 30 minutes)
  baseOutputPerSlot: z.number().default(1),

  // Current effective output (modified by workers, quality, tech, etc.)
  currentOutputPerSlot: z.number().default(0),

  // Extraction history
  totalExtracted: z.number().default(0),
  lastExtractionAt: z.string().optional(),

  // ─────────────────────────────────────────
  // INFRASTRUCTURE
  // ─────────────────────────────────────────
  buildings: z.array(z.object({
    buildingId: z.string().uuid(),
    buildingType: z.string(),        // "mine", "smelter", "warehouse"
    condition: z.number().min(0).max(100).default(100),
    outputModifier: z.number().default(1),
  })).default([]),

  // Roads, etc. affect transport cost
  infrastructureLevel: z.enum([
    "none",           // Carry by hand
    "trail",          // Pack animals
    "road",           // Carts
    "paved",          // Heavy wagons
    "rail",           // If tech allows
    "magical",        // Teleportation circles, etc.
  ]).default("none"),

  // ─────────────────────────────────────────
  // ECONOMICS
  // ─────────────────────────────────────────
  // Operating costs per day
  operatingCostPerDay: z.number().default(0),

  // Revenue goes to controller
  revenuePerUnit: z.number().optional(),  // If selling at source

  // Taxes/tariffs applied
  taxRate: z.number().min(0).max(1).default(0),
  taxCollector: z.string().uuid().optional(),  // Faction receiving tax

  // ─────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────
  createdAt: z.string(),
  updatedAt: z.string(),
  notes: z.string().optional(),           // GM notes
  secret: z.boolean().default(false),     // Hidden from players
});
export type ResourceDeposit = z.infer<typeof ResourceDepositSchema>;

// ============================================
// EXTRACTION OPERATION
// ============================================
// Represents active extraction at a deposit

export const ExtractionOperationSchema = z.object({
  id: z.string().uuid(),
  depositId: z.string().uuid(),

  // Who's doing the extraction
  operatorId: z.string().uuid(),          // Faction, character, or NPC
  operatorType: z.enum(["faction", "character", "npc", "party"]),
  operatorName: z.string(),

  // Workforce
  workers: z.array(z.object({
    npcId: z.string().uuid().optional(),  // Named NPC
    role: z.string(),                     // "miner", "foreman", "guard"
    skill: z.number().int().default(1),   // 1-5 skill level
    wage: z.number().default(0),          // Per day
  })).default([]),

  totalWorkers: z.number().int().default(0),
  workerEfficiency: z.number().min(0).max(2).default(1), // Modified by morale, health, etc.

  // Equipment
  tools: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int(),
    condition: z.number().min(0).max(100),
    outputBonus: z.number().default(0),
  })).default([]),

  // Current status
  status: z.enum([
    "idle",           // Not operating
    "operating",      // Normal extraction
    "maintenance",    // Repairing/upgrading
    "disrupted",      // Temporary stoppage
    "abandoned",      // No longer active
    "exhausted",      // Deposit depleted
  ]).default("idle"),

  disruptionReason: z.string().optional(),
  resumesAt: z.string().optional(),       // ISO date

  // Output tracking
  outputThisCycle: z.number().default(0),
  outputTotal: z.number().default(0),
  cycleStartedAt: z.string().optional(),

  // Where output goes
  outputDestination: z.object({
    type: z.enum(["stockpile", "market", "transport", "consume"]),
    locationId: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),
  }).default({ type: "stockpile" }),

  // Stockpile (if not immediately transported)
  stockpile: z.record(z.string(), z.number()).default({}), // commodityId -> amount
  stockpileCapacity: z.number().default(1000),

  // Economics
  operatingCosts: z.number().default(0),   // Accumulated costs
  revenue: z.number().default(0),          // Accumulated revenue
  profitMargin: z.number().default(0),     // Calculated

  // Timestamps
  startedAt: z.string(),
  lastTickAt: z.string(),
});
export type ExtractionOperation = z.infer<typeof ExtractionOperationSchema>;

// ============================================
// DEPOSIT DISCOVERY
// ============================================
// How deposits are found

export const DepositDiscoverySchema = z.object({
  id: z.string().uuid(),

  // What was discovered
  depositId: z.string().uuid(),
  depositName: z.string(),
  commodityId: z.string(),

  // Who discovered it
  discoveredBy: z.object({
    type: z.enum(["character", "party", "npc", "faction", "random"]),
    id: z.string().uuid().optional(),
    name: z.string(),
  }),

  // How
  discoveryMethod: z.enum([
    "prospecting",     // Deliberate search
    "accident",        // Stumbled upon
    "rumor",           // Heard about it
    "divination",      // Magic
    "map",             // Found old map
    "local_knowledge", // Locals told them
    "survey",          // Systematic exploration
  ]),

  // When/where
  discoveredAt: z.string(),              // ISO date
  locationDescription: z.string(),

  // Quality of knowledge
  knowledgeLevel: z.enum([
    "rumor",          // Might exist
    "confirmed",      // Definitely exists
    "surveyed",       // Know basic details
    "mapped",         // Full knowledge
  ]).default("confirmed"),

  // Who knows about it
  knownTo: z.array(z.string().uuid()).default([]), // Faction/character IDs
  publicKnowledge: z.boolean().default(false),

  // Value of discovery
  estimatedValue: z.number().optional(),

  // Session context
  sessionId: z.string().uuid().optional(),
  narrativeContext: z.string().optional(),
});
export type DepositDiscovery = z.infer<typeof DepositDiscoverySchema>;

// ============================================
// REGION RESOURCE SUMMARY
// ============================================
// Aggregated view of resources in a region

export const RegionResourceSummarySchema = z.object({
  regionId: z.string().uuid(),
  regionName: z.string(),

  // All deposits in region
  deposits: z.array(z.object({
    depositId: z.string().uuid(),
    name: z.string(),
    commodityId: z.string(),
    quality: DepositQualitySchema,
    discovered: z.boolean(),
    exploited: z.boolean(),
    controlledBy: z.string().optional(),
    remainingReserves: z.number().optional(),
    percentRemaining: z.number().optional(),
  })).default([]),

  // Production summary
  production: z.record(z.string(), z.object({
    commodityId: z.string(),
    totalOutputPerDay: z.number(),
    activeOperations: z.number(),
    trend: z.enum(["growing", "stable", "declining", "exhausting"]),
  })).default({}),

  // Strategic assessment
  strategicResources: z.array(z.string()).default([]), // Military value
  luxuryResources: z.array(z.string()).default([]),    // Trade value
  basicResources: z.array(z.string()).default([]),     // Survival needs

  // Undiscovered potential (GM only)
  undiscoveredDeposits: z.number().int().default(0),
  hiddenValue: z.number().default(0),

  // Last updated
  computedAt: z.string(),
});
export type RegionResourceSummary = z.infer<typeof RegionResourceSummarySchema>;

// ============================================
// STANDARD DEPOSIT TEMPLATES
// ============================================
// Pre-configured deposit types for quick creation

export const DEPOSIT_TEMPLATES: Record<string, Partial<ResourceDeposit>> = {
  // Mining
  iron_mine: {
    name: "Iron Deposit",
    depositType: "shallow",
    primaryCommodityId: "iron_ore",
    secondaryCommodities: [
      { commodityId: "stone", chance: 0.3, ratio: 0.5 },
    ],
    requiredBuilding: "mine",
    minimumTechLevel: "iron_age",
    laborRequirement: 5,
    optimalLabor: 20,
    maxLabor: 50,
    baseOutputPerSlot: 2,
    renewable: false,
    hazards: [
      { type: "cave_in", severity: "moderate", probability: 0.02 },
    ],
  },

  gold_mine: {
    name: "Gold Vein",
    depositType: "deep",
    primaryCommodityId: "gold_ore",
    secondaryCommodities: [
      { commodityId: "gems", chance: 0.1, ratio: 0.1 },
    ],
    requiredBuilding: "mine",
    minimumTechLevel: "bronze_age",
    laborRequirement: 10,
    optimalLabor: 30,
    maxLabor: 100,
    baseOutputPerSlot: 0.5,
    renewable: false,
    hazards: [
      { type: "cave_in", severity: "severe", probability: 0.03 },
      { type: "gas_pocket", severity: "deadly", probability: 0.01 },
    ],
  },

  // Agriculture
  wheat_field: {
    name: "Wheat Field",
    depositType: "arable",
    primaryCommodityId: "grain",
    requiredBuilding: "farm",
    minimumTechLevel: "stone_age",
    laborRequirement: 2,
    optimalLabor: 10,
    maxLabor: 20,
    baseOutputPerSlot: 5,
    renewable: true,
    regenerationRate: 0, // Seasonal, not continuous
    maxCapacity: 1000,
    hazards: [
      { type: "disease", severity: "moderate", probability: 0.05 },
      { type: "extreme_weather", severity: "severe", probability: 0.02 },
    ],
  },

  // Forestry
  timber_forest: {
    name: "Timber Forest",
    depositType: "forest",
    primaryCommodityId: "timber",
    secondaryCommodities: [
      { commodityId: "herbs", chance: 0.2, ratio: 0.1 },
      { commodityId: "game", chance: 0.1, ratio: 0.05 },
    ],
    requiredBuilding: "lumber_camp",
    minimumTechLevel: "stone_age",
    laborRequirement: 3,
    optimalLabor: 15,
    maxLabor: 30,
    baseOutputPerSlot: 3,
    renewable: true,
    regenerationRate: 0.1, // Slow regrowth
    hazards: [
      { type: "territorial_creature", severity: "moderate", probability: 0.03 },
    ],
  },

  // Fishing
  coastal_fishery: {
    name: "Coastal Fishery",
    depositType: "fishery",
    primaryCommodityId: "fish",
    requiredBuilding: "dock",
    minimumTechLevel: "stone_age",
    laborRequirement: 2,
    optimalLabor: 8,
    maxLabor: 15,
    baseOutputPerSlot: 4,
    renewable: true,
    regenerationRate: 2, // Fish replenish quickly
    maxCapacity: 500,
    hazards: [
      { type: "extreme_weather", severity: "severe", probability: 0.05 },
      { type: "territorial_creature", severity: "moderate", probability: 0.02 },
    ],
  },

  // Exotic
  mithril_vein: {
    name: "Mithril Vein",
    depositType: "deep",
    primaryCommodityId: "mithril_ore",
    quality: "legendary",
    requiredBuilding: "deep_mine",
    minimumTechLevel: "medieval",
    laborRequirement: 20,
    optimalLabor: 50,
    maxLabor: 100,
    baseOutputPerSlot: 0.1,
    renewable: false,
    requiredSkills: [
      { skillId: "mining", minLevel: 3 },
    ],
    hazards: [
      { type: "cave_in", severity: "severe", probability: 0.05 },
      { type: "monster_lair", severity: "deadly", probability: 0.1 },
      { type: "magical_anomaly", severity: "moderate", probability: 0.08 },
    ],
  },

  ley_line_nexus: {
    name: "Ley Line Nexus",
    depositType: "ley_line",
    primaryCommodityId: "magic_components",
    secondaryCommodities: [
      { commodityId: "arcane_crystals", chance: 0.3, ratio: 0.2 },
    ],
    quality: "rich",
    requiredBuilding: "mage_tower",
    minimumTechLevel: "medieval",
    laborRequirement: 1,
    optimalLabor: 5,
    maxLabor: 10,
    baseOutputPerSlot: 1,
    renewable: true,
    regenerationRate: 0.5,
    requiredSkills: [
      { skillId: "arcana", minLevel: 2 },
    ],
    hazards: [
      { type: "magical_anomaly", severity: "severe", probability: 0.1 },
    ],
  },
};

// ============================================
// COMMODITY TO DEPOSIT MAPPING
// ============================================
// What deposit types can produce each commodity

export const COMMODITY_SOURCES: Record<string, {
  depositTypes: DepositType[];
  primaryBuilding: string;
  minimumTech: TechLevel;
}> = {
  // Food
  grain: {
    depositTypes: ["arable"],
    primaryBuilding: "farm",
    minimumTech: "stone_age",
  },
  meat: {
    depositTypes: ["pasture", "game_land"],
    primaryBuilding: "ranch",
    minimumTech: "stone_age",
  },
  fish: {
    depositTypes: ["fishery", "deep_sea", "shellfish"],
    primaryBuilding: "dock",
    minimumTech: "stone_age",
  },

  // Raw materials
  timber: {
    depositTypes: ["forest", "old_growth", "managed"],
    primaryBuilding: "lumber_camp",
    minimumTech: "stone_age",
  },
  iron_ore: {
    depositTypes: ["surface", "shallow", "deep"],
    primaryBuilding: "mine",
    minimumTech: "iron_age",
  },
  copper_ore: {
    depositTypes: ["surface", "shallow"],
    primaryBuilding: "mine",
    minimumTech: "bronze_age",
  },
  gold_ore: {
    depositTypes: ["shallow", "deep", "underwater"],
    primaryBuilding: "mine",
    minimumTech: "bronze_age",
  },
  gems: {
    depositTypes: ["deep", "volcanic"],
    primaryBuilding: "mine",
    minimumTech: "bronze_age",
  },
  stone: {
    depositTypes: ["surface"],
    primaryBuilding: "quarry",
    minimumTech: "stone_age",
  },

  // Specialty
  herbs: {
    depositTypes: ["herb_field", "forest"],
    primaryBuilding: "herbalist_hut",
    minimumTech: "stone_age",
  },
  salt: {
    depositTypes: ["salt_flat", "shallow"],
    primaryBuilding: "salt_works",
    minimumTech: "bronze_age",
  },

  // Luxury
  wine_grapes: {
    depositTypes: ["vineyard"],
    primaryBuilding: "vineyard",
    minimumTech: "bronze_age",
  },
  spices: {
    depositTypes: ["arable"], // Specific climates
    primaryBuilding: "exotic_plantation",
    minimumTech: "iron_age",
  },

  // Magical
  magic_components: {
    depositTypes: ["ley_line", "planar_bleed", "herb_field"],
    primaryBuilding: "mage_tower",
    minimumTech: "medieval",
  },
  mithril_ore: {
    depositTypes: ["deep"],
    primaryBuilding: "deep_mine",
    minimumTech: "medieval",
  },
  adamantine_ore: {
    depositTypes: ["deep", "volcanic"],
    primaryBuilding: "deep_mine",
    minimumTech: "medieval",
  },
};
