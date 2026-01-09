import { z } from "zod";

// ============================================
// MONSTER POPULATION SYSTEM
// ============================================
//
// Philosophy: MONSTERS ARE NOT RESPAWNING TARGETS
//
// They are populations that:
//   - Grow when unchecked
//   - Compete for territory and prey
//   - Are limited by carrying capacity
//   - Migrate when pressured
//   - Die when hunted
//
// The wilderness is an ECOSYSTEM, not a spawn table.
//

// ============================================
// POPULATION TIER (Size Categories)
// ============================================

export const PopulationTierSchema = z.enum([
  "extinct",      // 0 - Gone from this area
  "remnant",      // 1-5 - Nearly wiped out
  "sparse",       // 6-20 - Rare encounters
  "stable",       // 21-50 - Sustainable population
  "thriving",     // 51-100 - Healthy population
  "abundant",     // 101-200 - Very common
  "swarming",     // 201+ - Overpopulated, will spread
]);
export type PopulationTier = z.infer<typeof PopulationTierSchema>;

export const TIER_THRESHOLDS: Record<PopulationTier, { min: number; max: number }> = {
  extinct: { min: 0, max: 0 },
  remnant: { min: 1, max: 5 },
  sparse: { min: 6, max: 20 },
  stable: { min: 21, max: 50 },
  thriving: { min: 51, max: 100 },
  abundant: { min: 101, max: 200 },
  swarming: { min: 201, max: Infinity },
};

// ============================================
// ECOLOGICAL ROLE
// ============================================

export const EcologicalRoleSchema = z.enum([
  "apex_predator",    // Top of food chain, limits others
  "predator",         // Hunts other creatures
  "omnivore",         // Flexible diet
  "herbivore",        // Eats plants (or plant-like things)
  "scavenger",        // Eats the dead
  "parasite",         // Feeds on hosts
  "filter_feeder",    // Ambient feeding (oozes, etc.)
  "magical",          // Sustained by magic
  "undead",           // Doesn't need food
  "construct",        // Doesn't need food
]);
export type EcologicalRole = z.infer<typeof EcologicalRoleSchema>;

// ============================================
// HABITAT TYPES
// ============================================

export const HabitatTypeSchema = z.enum([
  "underground",      // Caves, dungeons
  "forest",           // Woodlands
  "mountain",         // Highlands, peaks
  "plains",           // Grasslands
  "swamp",            // Wetlands
  "desert",           // Arid regions
  "coastal",          // Shores, beaches
  "aquatic",          // Underwater
  "urban",            // Cities, towns
  "ruins",            // Abandoned structures
  "planar",           // Extraplanar
]);
export type HabitatType = z.infer<typeof HabitatTypeSchema>;

// ============================================
// CREATURE TYPE (D&D Standard)
// ============================================

export const CreatureTypeSchema = z.enum([
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
]);
export type CreatureType = z.infer<typeof CreatureTypeSchema>;

// ============================================
// SOCIAL STRUCTURE
// ============================================

export const SocialStructureSchema = z.enum([
  "solitary",       // Lives alone
  "pair",           // Mated pairs
  "pack",           // Small groups (3-12)
  "horde",          // Large groups (13-50)
  "swarm",          // Massive groups (50+)
  "colony",         // Structured society
]);
export type SocialStructure = z.infer<typeof SocialStructureSchema>;

// ============================================
// MONSTER SPECIES (Template)
// ============================================

export const MonsterSpeciesSchema = z.object({
  id: z.string(),
  name: z.string(),
  creatureType: CreatureTypeSchema,

  // Challenge rating range for this species
  crRange: z.object({
    min: z.number(),
    max: z.number(),
  }),

  // Ecological profile
  ecology: z.object({
    role: EcologicalRoleSchema,
    preferredHabitats: z.array(HabitatTypeSchema),

    // Diet and competition
    preySpecies: z.array(z.string()).default([]),
    competitorSpecies: z.array(z.string()).default([]),
    predatorSpecies: z.array(z.string()).default([]),

    // Territorial behavior
    territorialRadius: z.number().default(5),   // Miles per population unit
    aggressive: z.boolean().default(false),

    // Pack behavior
    socialStructure: SocialStructureSchema.default("pack"),
    typicalGroupSize: z.object({
      min: z.number().int(),
      max: z.number().int(),
    }),
  }),

  // Reproduction
  reproduction: z.object({
    baseGrowthRate: z.number().default(0.05),   // 5% per week base
    breedingSeason: z.enum([
      "year_round",
      "spring",
      "summer",
      "fall",
      "winter",
    ]).default("year_round"),
    gestationWeeks: z.number().int().default(4),
    offspringPerBirth: z.object({
      min: z.number().int(),
      max: z.number().int(),
    }),
    maturityWeeks: z.number().int().default(12),
  }),

  // Resource needs
  resources: z.object({
    foodPerWeek: z.number().default(1),
    spaceRequired: z.number().default(1),
    magicDependency: z.boolean().default(false),
  }),

  // Behavior modifiers
  behavior: z.object({
    flightThreshold: z.number().default(0.3),
    migrationTendency: z.number().default(0.5),
    adaptability: z.number().default(0.5),
    intelligence: z.enum(["mindless", "animal", "low", "average", "high"]).default("low"),
  }),

  // Combat profile (for director tracking)
  combatProfile: z.object({
    averageDamagePerRound: z.number(),
    averageHP: z.number(),
    dangerousAbilities: z.array(z.string()).default([]),
  }),
});
export type MonsterSpecies = z.infer<typeof MonsterSpeciesSchema>;

// ============================================
// MONSTER POPULATION (Instance)
// ============================================

export const MonsterPopulationSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // What species
  speciesId: z.string(),
  speciesName: z.string(),

  // Where
  regionId: z.string().uuid(),
  regionName: z.string(),
  poiId: z.string().uuid().optional(),

  // Population state
  count: z.number().int().nonnegative(),
  tier: PopulationTierSchema,

  // Demographics
  demographics: z.object({
    adults: z.number().int().default(0),
    juveniles: z.number().int().default(0),
    elders: z.number().int().default(0),
    elites: z.number().int().default(0),
    leader: z.object({
      exists: z.boolean(),
      name: z.string().optional(),
      cr: z.number().optional(),
      creatureId: z.string().uuid().optional(),
    }).optional(),
  }).optional(),

  // Carrying capacity for this location
  carryingCapacity: z.number().int(),

  // Growth tracking
  growth: z.object({
    currentGrowthRate: z.number(),
    birthsThisWeek: z.number().int().default(0),
    deathsThisWeek: z.number().int().default(0),
    immigrationThisWeek: z.number().int().default(0),
    emigrationThisWeek: z.number().int().default(0),

    growthModifiers: z.array(z.object({
      source: z.string(),
      modifier: z.number(),
      expires: z.string().optional(),
    })).default([]),
  }),

  // Health of population
  health: z.object({
    foodSecurity: z.number().min(0).max(1).default(1),
    territoryPressure: z.number().min(0).max(2).default(1),
    predationPressure: z.number().min(0).max(1).default(0),
    diseaseLevel: z.number().min(0).max(1).default(0),
  }),

  // Behavior state
  behavior: z.object({
    aggression: z.number().min(0).max(1).default(0.5),
    expansion: z.boolean().default(false),
    migration: z.object({
      inProgress: z.boolean().default(false),
      targetRegionId: z.string().uuid().optional(),
      progress: z.number().min(0).max(1).default(0),
    }).optional(),
  }),

  // Conflict tracking
  conflicts: z.object({
    adventurerKills: z.number().int().default(0),
    adventurerDefeats: z.number().int().default(0),
    lastEncounter: z.string().optional(),

    speciesConflicts: z.array(z.object({
      opponentSpeciesId: z.string(),
      killsInflicted: z.number().int(),
      killsSuffered: z.number().int(),
      lastConflict: z.string(),
    })).default([]),

    settlementRaids: z.number().int().default(0),
    caravanAttacks: z.number().int().default(0),
  }),

  // Director tracking
  directorData: z.object({
    fitness: z.number().default(1),
    adaptations: z.array(z.string()).default([]),
    threatRating: z.number().default(0),
  }),

  // History
  history: z.array(z.object({
    week: z.number().int(),
    count: z.number().int(),
    event: z.string().optional(),
  })).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MonsterPopulation = z.infer<typeof MonsterPopulationSchema>;

// ============================================
// REGIONAL ECOSYSTEM
// ============================================

export const RegionalEcosystemSchema = z.object({
  regionId: z.string().uuid(),
  regionName: z.string(),

  // Habitat characteristics
  primaryHabitat: HabitatTypeSchema,
  secondaryHabitats: z.array(HabitatTypeSchema).default([]),

  // Resource pool
  resources: z.object({
    totalCarryingCapacity: z.number().int(),
    currentUsage: z.number().int(),
    foodAvailable: z.number(),
    magicSaturation: z.number().min(0).max(1),
  }),

  // All populations in this region
  populationIds: z.array(z.string().uuid()),

  // Ecological balance
  balance: z.object({
    apexPredatorPressure: z.number(),
    preyAvailability: z.number(),
    herbivoreLoad: z.number(),
    overallStability: z.number().min(0).max(1),
  }),

  // Civilization influence
  civilizationPressure: z.object({
    settlementProximity: z.number(),
    patrolFrequency: z.number(),
    huntingPressure: z.number(),
    developmentLevel: z.number(),
  }),

  lastComputed: z.string(),
});
export type RegionalEcosystem = z.infer<typeof RegionalEcosystemSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTierFromCount(count: number): PopulationTier {
  if (count === 0) return "extinct";
  if (count <= 5) return "remnant";
  if (count <= 20) return "sparse";
  if (count <= 50) return "stable";
  if (count <= 100) return "thriving";
  if (count <= 200) return "abundant";
  return "swarming";
}

export function calculateCarryingCapacity(
  regionCapacity: number,
  species: MonsterSpecies,
  habitatMatch: number,
): number {
  const baseCapacity = regionCapacity / species.resources.spaceRequired;
  return Math.floor(baseCapacity * habitatMatch);
}

export function getHabitatMatchScore(
  speciesHabitats: HabitatType[],
  regionHabitat: HabitatType,
  secondaryHabitats: HabitatType[],
): number {
  if (speciesHabitats.includes(regionHabitat)) return 1;
  for (const secondary of secondaryHabitats) {
    if (speciesHabitats.includes(secondary)) return 0.7;
  }
  return 0.3; // Poor habitat match
}

// ============================================
// STANDARD SPECIES DEFINITIONS
// ============================================

export const STANDARD_SPECIES: Record<string, Partial<MonsterSpecies>> = {
  goblin: {
    id: "goblin",
    name: "Goblin",
    creatureType: "humanoid",
    crRange: { min: 0.25, max: 1 },
    ecology: {
      role: "omnivore",
      preferredHabitats: ["underground", "forest", "ruins"],
      preySpecies: [],
      competitorSpecies: ["kobold", "orc"],
      predatorSpecies: ["hobgoblin", "bugbear"],
      territorialRadius: 3,
      aggressive: true,
      socialStructure: "horde",
      typicalGroupSize: { min: 6, max: 20 },
    },
    reproduction: {
      baseGrowthRate: 0.08,
      breedingSeason: "year_round",
      gestationWeeks: 6,
      offspringPerBirth: { min: 2, max: 4 },
      maturityWeeks: 8,
    },
    resources: {
      foodPerWeek: 0.5,
      spaceRequired: 0.5,
      magicDependency: false,
    },
    behavior: {
      flightThreshold: 0.4,
      migrationTendency: 0.6,
      adaptability: 0.7,
      intelligence: "low",
    },
    combatProfile: {
      averageDamagePerRound: 5,
      averageHP: 7,
      dangerousAbilities: ["nimble_escape"],
    },
  },

  wolf: {
    id: "wolf",
    name: "Wolf",
    creatureType: "beast",
    crRange: { min: 0.25, max: 0.5 },
    ecology: {
      role: "predator",
      preferredHabitats: ["forest", "plains", "mountain"],
      preySpecies: ["deer", "rabbit"],
      competitorSpecies: ["dire_wolf"],
      predatorSpecies: [],
      territorialRadius: 10,
      aggressive: false,
      socialStructure: "pack",
      typicalGroupSize: { min: 4, max: 8 },
    },
    reproduction: {
      baseGrowthRate: 0.04,
      breedingSeason: "spring",
      gestationWeeks: 9,
      offspringPerBirth: { min: 4, max: 6 },
      maturityWeeks: 52,
    },
    resources: {
      foodPerWeek: 2,
      spaceRequired: 2,
      magicDependency: false,
    },
    behavior: {
      flightThreshold: 0.3,
      migrationTendency: 0.4,
      adaptability: 0.6,
      intelligence: "animal",
    },
    combatProfile: {
      averageDamagePerRound: 7,
      averageHP: 11,
      dangerousAbilities: ["pack_tactics"],
    },
  },

  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    creatureType: "undead",
    crRange: { min: 0.25, max: 0.5 },
    ecology: {
      role: "undead",
      preferredHabitats: ["underground", "ruins"],
      preySpecies: [],
      competitorSpecies: [],
      predatorSpecies: [],
      territorialRadius: 0,
      aggressive: true,
      socialStructure: "horde",
      typicalGroupSize: { min: 4, max: 12 },
    },
    reproduction: {
      baseGrowthRate: 0,
      breedingSeason: "year_round",
      gestationWeeks: 0,
      offspringPerBirth: { min: 0, max: 0 },
      maturityWeeks: 0,
    },
    resources: {
      foodPerWeek: 0,
      spaceRequired: 0.5,
      magicDependency: true,
    },
    behavior: {
      flightThreshold: 0,
      migrationTendency: 0,
      adaptability: 0,
      intelligence: "mindless",
    },
    combatProfile: {
      averageDamagePerRound: 5,
      averageHP: 13,
      dangerousAbilities: [],
    },
  },

  troll: {
    id: "troll",
    name: "Troll",
    creatureType: "giant",
    crRange: { min: 5, max: 5 },
    ecology: {
      role: "apex_predator",
      preferredHabitats: ["swamp", "forest", "underground"],
      preySpecies: ["goblin", "orc", "deer"],
      competitorSpecies: ["ogre"],
      predatorSpecies: [],
      territorialRadius: 15,
      aggressive: true,
      socialStructure: "solitary",
      typicalGroupSize: { min: 1, max: 2 },
    },
    reproduction: {
      baseGrowthRate: 0.02,
      breedingSeason: "year_round",
      gestationWeeks: 20,
      offspringPerBirth: { min: 1, max: 2 },
      maturityWeeks: 104,
    },
    resources: {
      foodPerWeek: 10,
      spaceRequired: 5,
      magicDependency: false,
    },
    behavior: {
      flightThreshold: 0.1,
      migrationTendency: 0.3,
      adaptability: 0.4,
      intelligence: "low",
    },
    combatProfile: {
      averageDamagePerRound: 22,
      averageHP: 84,
      dangerousAbilities: ["regeneration"],
    },
  },

  giant_spider: {
    id: "giant_spider",
    name: "Giant Spider",
    creatureType: "beast",
    crRange: { min: 1, max: 1 },
    ecology: {
      role: "predator",
      preferredHabitats: ["underground", "forest"],
      preySpecies: ["goblin", "rat"],
      competitorSpecies: [],
      predatorSpecies: [],
      territorialRadius: 2,
      aggressive: true,
      socialStructure: "solitary",
      typicalGroupSize: { min: 1, max: 3 },
    },
    reproduction: {
      baseGrowthRate: 0.06,
      breedingSeason: "summer",
      gestationWeeks: 4,
      offspringPerBirth: { min: 20, max: 50 },
      maturityWeeks: 8,
    },
    resources: {
      foodPerWeek: 1,
      spaceRequired: 1,
      magicDependency: false,
    },
    behavior: {
      flightThreshold: 0.5,
      migrationTendency: 0.2,
      adaptability: 0.5,
      intelligence: "animal",
    },
    combatProfile: {
      averageDamagePerRound: 7,
      averageHP: 26,
      dangerousAbilities: ["web", "poison"],
    },
  },
};
