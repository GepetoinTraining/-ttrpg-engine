import { z } from "zod";
import { ResourceTypeSchema } from "./downtime";

// ============================================
// SETTLEMENTS & TERRITORIES
// ============================================
//
// Players can own, develop, and manage:
//   - Strongholds (castles, towers, keeps)
//   - Settlements (towns, villages)
//   - Businesses (taverns, shops, guildhalls)
//   - Territories (land, regions)
//
// Settlements have:
//   - Buildings (provide bonuses, actions, income)
//   - Population (workers, specialists, soldiers)
//   - Defenses (walls, guards, traps)
//   - Problems (events that need resolution)
//

// ============================================
// SETTLEMENT SIZE
// ============================================

export const SettlementSizeSchema = z.enum([
  "outpost", // 1-20 people
  "hamlet", // 21-100
  "village", // 101-500
  "town", // 501-2000
  "city", // 2001-10000
  "metropolis", // 10000+
]);
export type SettlementSize = z.infer<typeof SettlementSizeSchema>;

export const SettlementSizeStats: Record<
  SettlementSize,
  {
    minPop: number;
    maxPop: number;
    maxBuildings: number;
    baseIncome: number;
    baseDefense: number;
  }
> = {
  outpost: {
    minPop: 1,
    maxPop: 20,
    maxBuildings: 3,
    baseIncome: 10,
    baseDefense: 1,
  },
  hamlet: {
    minPop: 21,
    maxPop: 100,
    maxBuildings: 8,
    baseIncome: 50,
    baseDefense: 2,
  },
  village: {
    minPop: 101,
    maxPop: 500,
    maxBuildings: 15,
    baseIncome: 150,
    baseDefense: 4,
  },
  town: {
    minPop: 501,
    maxPop: 2000,
    maxBuildings: 30,
    baseIncome: 500,
    baseDefense: 8,
  },
  city: {
    minPop: 2001,
    maxPop: 10000,
    maxBuildings: 60,
    baseIncome: 2000,
    baseDefense: 15,
  },
  metropolis: {
    minPop: 10001,
    maxPop: 999999,
    maxBuildings: 150,
    baseIncome: 10000,
    baseDefense: 30,
  },
};

// ============================================
// BUILDING TYPES
// ============================================

export const BuildingCategorySchema = z.enum([
  "residential", // Housing
  "commercial", // Shops, markets
  "industrial", // Workshops, mills
  "military", // Barracks, walls
  "religious", // Temples, shrines
  "governmental", // Town hall, courts
  "entertainment", // Taverns, theaters
  "educational", // Schools, libraries
  "magical", // Wizard towers, enchanting
  "infrastructure", // Roads, wells, sewers
]);
export type BuildingCategory = z.infer<typeof BuildingCategorySchema>;

export const BuildingSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),

  // Identity
  name: z.string(),
  type: z.string(), // "Tavern", "Blacksmith", "Barracks"
  category: BuildingCategorySchema,
  tier: z.number().int().min(1).max(5).default(1),

  // Construction
  constructionStatus: z.enum([
    "planned",
    "under_construction",
    "complete",
    "damaged",
    "ruined",
  ]),
  constructionProgress: z.number().int().min(0).max(100).default(0),
  constructionDaysRemaining: z.number().int().optional(),

  // Requirements to build
  requirements: z.object({
    gold: z.number(),
    materials: z.number(),
    labor: z.number(), // Worker-days
    prerequisites: z.array(z.string()).default([]), // Other buildings needed
    minSettlementSize: SettlementSizeSchema.optional(),
  }),

  // Benefits when complete
  benefits: z.object({
    // Income
    incomeGold: z.number().default(0),
    incomeOther: z
      .array(
        z.object({
          type: ResourceTypeSchema,
          amount: z.number(),
        }),
      )
      .default([]),

    // Population effects
    housingCapacity: z.number().int().default(0),
    employmentCapacity: z.number().int().default(0),

    // Defense
    defenseBonus: z.number().int().default(0),
    garrisonCapacity: z.number().int().default(0),

    // Unlocks
    unlocksActions: z.array(z.string()).default([]), // Downtime actions
    unlocksRecruitment: z.array(z.string()).default([]), // Follower types
    unlocksBuildings: z.array(z.string()).default([]), // Other buildings

    // Bonuses
    bonuses: z
      .array(
        z.object({
          type: z.string(), // "crafting_speed", "research_bonus", etc.
          value: z.number(),
        }),
      )
      .default([]),
  }),

  // Upkeep
  upkeep: z.object({
    gold: z.number().default(0),
    staff: z.number().int().default(0),
  }),

  // Current state
  currentStaff: z.number().int().default(0),
  condition: z.number().int().min(0).max(100).default(100),

  // Manager (NPC or follower)
  managerId: z.string().uuid().optional(),
  managerName: z.string().optional(),
});
export type Building = z.infer<typeof BuildingSchema>;

// ============================================
// STANDARD BUILDINGS
// ============================================

export const StandardBuildings: Array<{
  type: string;
  category: BuildingCategory;
  requirements: {
    gold: number;
    materials: number;
    labor: number;
    minSize?: SettlementSize;
  };
  benefits: {
    incomeGold?: number;
    housing?: number;
    defense?: number;
    unlocks?: string[];
  };
  upkeep: { gold: number; staff: number };
}> = [
  // Residential
  {
    type: "Houses",
    category: "residential",
    requirements: { gold: 100, materials: 50, labor: 10 },
    benefits: { housing: 10 },
    upkeep: { gold: 2, staff: 0 },
  },
  {
    type: "Tenements",
    category: "residential",
    requirements: { gold: 300, materials: 150, labor: 30, minSize: "town" },
    benefits: { housing: 50 },
    upkeep: { gold: 5, staff: 1 },
  },
  {
    type: "Manor House",
    category: "residential",
    requirements: { gold: 2000, materials: 500, labor: 100 },
    benefits: { housing: 5, unlocks: ["Noble recruitment"] },
    upkeep: { gold: 50, staff: 5 },
  },

  // Commercial
  {
    type: "Marketplace",
    category: "commercial",
    requirements: { gold: 500, materials: 100, labor: 20 },
    benefits: { incomeGold: 50, unlocks: ["Trade actions"] },
    upkeep: { gold: 10, staff: 2 },
  },
  {
    type: "General Store",
    category: "commercial",
    requirements: { gold: 200, materials: 50, labor: 10 },
    benefits: { incomeGold: 20 },
    upkeep: { gold: 5, staff: 1 },
  },
  {
    type: "Trading Post",
    category: "commercial",
    requirements: { gold: 1000, materials: 200, labor: 40, minSize: "village" },
    benefits: { incomeGold: 100, unlocks: ["Trade expeditions"] },
    upkeep: { gold: 20, staff: 3 },
  },

  // Industrial
  {
    type: "Blacksmith",
    category: "industrial",
    requirements: { gold: 300, materials: 100, labor: 20 },
    benefits: {
      incomeGold: 25,
      unlocks: ["Craft weapons", "Repair equipment"],
    },
    upkeep: { gold: 8, staff: 2 },
  },
  {
    type: "Lumber Mill",
    category: "industrial",
    requirements: { gold: 400, materials: 150, labor: 30 },
    benefits: { incomeGold: 30, unlocks: ["Produce materials"] },
    upkeep: { gold: 10, staff: 4 },
  },
  {
    type: "Mine",
    category: "industrial",
    requirements: { gold: 1000, materials: 300, labor: 100 },
    benefits: { incomeGold: 100, unlocks: ["Extract ore"] },
    upkeep: { gold: 30, staff: 10 },
  },

  // Military
  {
    type: "Watchtower",
    category: "military",
    requirements: { gold: 200, materials: 100, labor: 20 },
    benefits: { defense: 2 },
    upkeep: { gold: 5, staff: 2 },
  },
  {
    type: "Barracks",
    category: "military",
    requirements: { gold: 500, materials: 200, labor: 40 },
    benefits: { defense: 3, unlocks: ["Recruit soldiers", "Train troops"] },
    upkeep: { gold: 15, staff: 5 },
  },
  {
    type: "Walls",
    category: "military",
    requirements: {
      gold: 2000,
      materials: 1000,
      labor: 200,
      minSize: "village",
    },
    benefits: { defense: 10 },
    upkeep: { gold: 20, staff: 5 },
  },
  {
    type: "Keep",
    category: "military",
    requirements: { gold: 5000, materials: 2000, labor: 500, minSize: "town" },
    benefits: { defense: 20, housing: 20, unlocks: ["Garrison"] },
    upkeep: { gold: 100, staff: 20 },
  },
  {
    type: "Castle",
    category: "military",
    requirements: {
      gold: 20000,
      materials: 8000,
      labor: 2000,
      minSize: "city",
    },
    benefits: { defense: 50, housing: 100 },
    upkeep: { gold: 500, staff: 50 },
  },

  // Religious
  {
    type: "Shrine",
    category: "religious",
    requirements: { gold: 100, materials: 50, labor: 10 },
    benefits: { unlocks: ["Pray"] },
    upkeep: { gold: 2, staff: 1 },
  },
  {
    type: "Temple",
    category: "religious",
    requirements: { gold: 1000, materials: 400, labor: 80, minSize: "village" },
    benefits: { unlocks: ["Healing services", "Recruit priests"] },
    upkeep: { gold: 25, staff: 5 },
  },
  {
    type: "Cathedral",
    category: "religious",
    requirements: {
      gold: 10000,
      materials: 4000,
      labor: 1000,
      minSize: "city",
    },
    benefits: { defense: 5, unlocks: ["Divine rituals"] },
    upkeep: { gold: 200, staff: 20 },
  },

  // Governmental
  {
    type: "Town Hall",
    category: "governmental",
    requirements: { gold: 800, materials: 300, labor: 60, minSize: "village" },
    benefits: { unlocks: ["Governance actions", "Collect taxes"] },
    upkeep: { gold: 20, staff: 5 },
  },
  {
    type: "Courthouse",
    category: "governmental",
    requirements: { gold: 1500, materials: 500, labor: 100, minSize: "town" },
    benefits: { unlocks: ["Legal actions", "Reduce crime"] },
    upkeep: { gold: 40, staff: 8 },
  },

  // Entertainment
  {
    type: "Tavern",
    category: "entertainment",
    requirements: { gold: 300, materials: 100, labor: 20 },
    benefits: { incomeGold: 30, unlocks: ["Carousing", "Gather rumors"] },
    upkeep: { gold: 8, staff: 3 },
  },
  {
    type: "Inn",
    category: "entertainment",
    requirements: { gold: 500, materials: 200, labor: 40 },
    benefits: { incomeGold: 40, housing: 5, unlocks: ["Safe rest"] },
    upkeep: { gold: 12, staff: 4 },
  },
  {
    type: "Theater",
    category: "entertainment",
    requirements: { gold: 2000, materials: 600, labor: 150, minSize: "town" },
    benefits: { incomeGold: 75, unlocks: ["Performances"] },
    upkeep: { gold: 30, staff: 10 },
  },

  // Educational
  {
    type: "School",
    category: "educational",
    requirements: { gold: 400, materials: 150, labor: 30 },
    benefits: { unlocks: ["Train skills"] },
    upkeep: { gold: 10, staff: 3 },
  },
  {
    type: "Library",
    category: "educational",
    requirements: { gold: 1000, materials: 300, labor: 60, minSize: "town" },
    benefits: { unlocks: ["Research", "Lore actions"] },
    upkeep: { gold: 25, staff: 5 },
  },
  {
    type: "Academy",
    category: "educational",
    requirements: { gold: 5000, materials: 1500, labor: 300, minSize: "city" },
    benefits: { unlocks: ["Advanced training", "Recruit sages"] },
    upkeep: { gold: 100, staff: 20 },
  },

  // Magical
  {
    type: "Wizard Tower",
    category: "magical",
    requirements: { gold: 3000, materials: 800, labor: 200 },
    benefits: { unlocks: ["Arcane research", "Enchanting"] },
    upkeep: { gold: 75, staff: 3 },
  },
  {
    type: "Alchemy Lab",
    category: "magical",
    requirements: { gold: 800, materials: 300, labor: 40 },
    benefits: { unlocks: ["Brew potions", "Alchemical research"] },
    upkeep: { gold: 20, staff: 2 },
  },

  // Infrastructure
  {
    type: "Roads",
    category: "infrastructure",
    requirements: { gold: 200, materials: 100, labor: 50 },
    benefits: { unlocks: ["Faster travel", "Trade bonus"] },
    upkeep: { gold: 5, staff: 2 },
  },
  {
    type: "Wells",
    category: "infrastructure",
    requirements: { gold: 100, materials: 50, labor: 20 },
    benefits: { housing: 5 },
    upkeep: { gold: 2, staff: 0 },
  },
  {
    type: "Sewers",
    category: "infrastructure",
    requirements: { gold: 1000, materials: 500, labor: 200, minSize: "town" },
    benefits: { housing: 20, unlocks: ["Reduce disease"] },
    upkeep: { gold: 15, staff: 5 },
  },
  {
    type: "Harbor",
    category: "infrastructure",
    requirements: { gold: 3000, materials: 1500, labor: 400 },
    benefits: { incomeGold: 150, unlocks: ["Sea trade", "Naval actions"] },
    upkeep: { gold: 50, staff: 10 },
  },
];

// ============================================
// SETTLEMENT
// ============================================

export const SettlementSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  size: SettlementSizeSchema,

  // Ownership
  ownerId: z.string().uuid().optional(), // Character, party, or NPC
  ownerType: z
    .enum(["character", "party", "organization", "npc", "none"])
    .default("none"),

  // Location
  locationId: z.string().uuid().optional(),
  region: z.string().optional(),
  terrain: z.string().optional(),

  // Population
  population: z.object({
    total: z.number().int().default(0),
    housing: z.number().int().default(0), // Max population based on buildings
    employed: z.number().int().default(0),
    unemployed: z.number().int().default(0),
    militia: z.number().int().default(0),
    specialists: z.record(z.string(), z.number().int()).default({}),
  }),

  // Resources
  treasury: z.number().default(0),
  resources: z.object({
    materials: z.number().default(0),
    provisions: z.number().default(0),
    arms: z.number().default(0),
  }),

  // Economy
  economy: z.object({
    // Per downtime period
    grossIncome: z.number().default(0),
    expenses: z.number().default(0),
    netIncome: z.number().default(0),

    // Breakdown
    incomeBreakdown: z
      .array(
        z.object({
          source: z.string(),
          amount: z.number(),
        }),
      )
      .default([]),
    expenseBreakdown: z
      .array(
        z.object({
          reason: z.string(),
          amount: z.number(),
        }),
      )
      .default([]),

    // Modifiers
    taxRate: z.number().min(0).max(1).default(0.1),
    tradeModifier: z.number().default(1.0),
  }),

  // Defense
  defense: z.object({
    rating: z.number().int().default(0),
    garrison: z.number().int().default(0),
    walls: z.boolean().default(false),
    morale: z.number().int().min(0).max(10).default(5),
  }),

  // Buildings
  buildings: z.array(z.string().uuid()).default([]), // Building IDs
  buildingSlots: z.number().int(),

  // Status
  stability: z.number().int().min(0).max(100).default(50),
  prosperity: z.number().int().min(0).max(100).default(50),
  loyalty: z.number().int().min(0).max(100).default(50),

  // Problems & Events
  activeProblems: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        description: z.string(),
        severity: z.enum(["minor", "moderate", "major", "crisis"]),
        daysActive: z.number().int(),
        effects: z.array(z.string()),
      }),
    )
    .default([]),

  // Development queue
  constructionQueue: z
    .array(
      z.object({
        buildingType: z.string(),
        daysRemaining: z.number().int(),
        priority: z.number().int(),
      }),
    )
    .default([]),

  // Unlocked capabilities
  unlockedActions: z.array(z.string()).default([]),
  unlockedRecruitment: z.array(z.string()).default([]),
});
export type Settlement = z.infer<typeof SettlementSchema>;

// ============================================
// SETTLEMENT EVENTS
// ============================================

export const SettlementEventSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),

  type: z.enum([
    "growth", // Population increase
    "decline", // Population decrease
    "prosperity", // Economic boom
    "hardship", // Economic trouble
    "crime", // Crime wave
    "festival", // Celebration
    "disease", // Plague/illness
    "disaster", // Fire, flood, etc.
    "attack", // External threat
    "unrest", // Civil unrest
    "opportunity", // Special opportunity
    "visitor", // Notable visitor
    "discovery", // Something found
    "construction", // Building complete
  ]),

  title: z.string(),
  description: z.string(),

  // Timing
  occurredAt: z.date(),
  duration: z.number().int().optional(), // Days

  // Effects
  effects: z
    .array(
      z.object({
        stat: z.string(),
        change: z.number(),
        duration: z.number().int().optional(),
      }),
    )
    .default([]),

  // Required response
  requiresResponse: z.boolean().default(false),
  responseDeadline: z.date().optional(),
  responseOptions: z
    .array(
      z.object({
        option: z.string(),
        cost: z.record(z.string(), z.number()).optional(),
        outcome: z.string(),
      }),
    )
    .optional(),

  // Resolution
  resolved: z.boolean().default(false),
  resolution: z.string().optional(),
});
export type SettlementEvent = z.infer<typeof SettlementEventSchema>;

// ============================================
// TERRITORY
// ============================================

export const TerritorySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  name: z.string(),
  type: z.enum([
    "wilderness",
    "farmland",
    "forest",
    "mountain",
    "swamp",
    "desert",
    "coastal",
    "plains",
  ]),

  // Size (in square miles or hexes)
  size: z.number().int().positive(),

  // Ownership
  ownerId: z.string().uuid().optional(),
  ownerType: z
    .enum(["character", "party", "organization", "npc", "none"])
    .default("none"),

  // Contents
  settlements: z.array(z.string().uuid()).default([]),
  resources: z
    .array(
      z.object({
        type: z.string(), // "Iron ore", "Timber", "Farmland"
        abundance: z.enum(["scarce", "moderate", "abundant", "rich"]),
        exploited: z.boolean().default(false),
      }),
    )
    .default([]),

  // Development
  development: z
    .enum(["wild", "explored", "patrolled", "settled", "developed"])
    .default("wild"),
  infrastructure: z.object({
    roads: z.boolean().default(false),
    bridges: z.boolean().default(false),
    watchtowers: z.number().int().default(0),
  }),

  // Control
  control: z.number().int().min(0).max(100).default(0),
  threats: z
    .array(
      z.object({
        type: z.string(), // "Bandits", "Monsters", "Rival faction"
        severity: z.enum(["minor", "moderate", "major", "extreme"]),
        location: z.string().optional(),
      }),
    )
    .default([]),

  // Income (per downtime period)
  income: z.object({
    gold: z.number().default(0),
    materials: z.number().default(0),
    provisions: z.number().default(0),
  }),
});
export type Territory = z.infer<typeof TerritorySchema>;

// ============================================
// SETTLEMENT ACTIONS
// ============================================

export const SettlementActionTemplates = [
  {
    id: "collect_taxes",
    name: "Collect Taxes",
    description: "Gather taxes from the population",
    effect: "Gain gold based on population and tax rate. May affect loyalty.",
    category: "economic",
  },
  {
    id: "recruit_militia",
    name: "Recruit Militia",
    description: "Call up citizens to serve in the militia",
    effect: "Increase garrison. May affect population and economy.",
    category: "military",
  },
  {
    id: "improve_infrastructure",
    name: "Improve Infrastructure",
    description: "Build roads, wells, or other improvements",
    effect: "Increase prosperity and enable new buildings.",
    category: "construction",
  },
  {
    id: "hold_festival",
    name: "Hold Festival",
    description: "Sponsor a celebration for the people",
    effect: "Increase loyalty and stability. Costs gold.",
    category: "social",
  },
  {
    id: "patrol_territory",
    name: "Patrol Territory",
    description: "Send guards to patrol surrounding lands",
    effect: "Reduce threats, increase control.",
    category: "military",
  },
  {
    id: "encourage_trade",
    name: "Encourage Trade",
    description: "Offer incentives to merchants",
    effect: "Increase trade income. Costs gold upfront.",
    category: "economic",
  },
  {
    id: "suppress_unrest",
    name: "Suppress Unrest",
    description: "Use force to maintain order",
    effect: "Increase stability but decrease loyalty.",
    category: "military",
  },
  {
    id: "address_grievances",
    name: "Address Grievances",
    description: "Listen to the people and address concerns",
    effect: "Increase loyalty. May cost resources.",
    category: "social",
  },
];
