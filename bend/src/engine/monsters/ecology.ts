import { z } from "zod";
import { MonsterSpecies } from "./population";

// ============================================
// MONSTER ECOLOGY SYSTEM
// ============================================
//
// Philosophy: MONSTERS HAVE REASONS
//
// Creatures don't just exist - they:
//   - Defend territory
//   - Hunt for food
//   - Compete with rivals
//   - Flee from predators
//   - Migrate when pressured
//
// Every monster encounter has ecological CONTEXT.
//

// ============================================
// BEHAVIOR STATES
// ============================================

export const BehaviorStateSchema = z.enum([
  "resting",        // In lair, low activity
  "hunting",        // Actively seeking prey
  "patrolling",     // Defending territory
  "migrating",      // Moving to new territory
  "fleeing",        // Running from threat
  "raiding",        // Attacking settlements/caravans
  "nesting",        // Breeding/protecting young
  "feeding",        // Currently eating
  "aggressive",     // Will attack on sight
]);
export type BehaviorState = z.infer<typeof BehaviorStateSchema>;

// ============================================
// TERRITORY RELATIONSHIP
// ============================================

export const TerritoryRelationshipSchema = z.enum([
  "hostile",        // Will fight on sight
  "competitive",    // Avoid each other, occasional clashes
  "tolerant",       // Coexist peacefully
  "allied",         // Work together
  "predator_prey",  // One hunts the other
]);
export type TerritoryRelationship = z.infer<typeof TerritoryRelationshipSchema>;

// ============================================
// TERRITORY SCHEMA
// ============================================

export const TerritorySchema = z.object({
  id: z.string().uuid(),

  // Owner
  populationId: z.string().uuid(),
  speciesId: z.string(),
  speciesName: z.string(),

  // Location
  regionId: z.string().uuid(),
  centerPoiId: z.string().uuid().optional(),
  radiusMiles: z.number(),

  // Coverage
  regionCoverage: z.number().min(0).max(1),

  // Resources
  resources: z.object({
    foodSources: z.number().int(),
    waterAccess: z.boolean(),
    shelterQuality: z.number().min(0).max(1),
  }),

  // Defense
  defense: z.object({
    patrolStrength: z.number(),
    warningMarkers: z.boolean(),
    trapDensity: z.number().min(0).max(1),
  }),

  // Overlap with other territories
  overlaps: z.array(z.object({
    otherTerritoryId: z.string().uuid(),
    otherSpeciesId: z.string(),
    otherSpeciesName: z.string(),
    overlapPercent: z.number(),
    relationship: TerritoryRelationshipSchema,
  })).default([]),

  // Status
  stability: z.number().min(0).max(1).default(1),
  lastPatrolled: z.string().optional(),
  contested: z.boolean().default(false),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Territory = z.infer<typeof TerritorySchema>;

// ============================================
// MIGRATION CAUSE
// ============================================

export const MigrationCauseSchema = z.enum([
  "overpopulation",     // Too crowded
  "food_shortage",      // Not enough food
  "predation",          // Fleeing predators
  "civilization",       // Pushed out by settlements
  "competition",        // Lost territory war
  "disaster",           // Natural disaster
  "seasonal",           // Normal migration pattern
  "spawner_overflow",   // Spawner spillover
]);
export type MigrationCause = z.infer<typeof MigrationCauseSchema>;

// ============================================
// MIGRATION EVENT
// ============================================

export const MigrationEventSchema = z.object({
  id: z.string().uuid(),

  // Who's moving
  populationId: z.string().uuid(),
  speciesId: z.string(),
  speciesName: z.string(),
  migrantsCount: z.number().int(),

  // From/to
  originRegionId: z.string().uuid(),
  originRegionName: z.string(),
  destinationRegionId: z.string().uuid(),
  destinationRegionName: z.string(),

  // Cause
  cause: MigrationCauseSchema,

  // Progress
  status: z.enum(["preparing", "in_transit", "arriving", "complete", "failed"]),
  startedAt: z.string(),
  expectedArrival: z.string(),
  progress: z.number().min(0).max(1),

  // Hazards during migration
  hazards: z.object({
    exposedToSettlements: z.boolean(),
    crossesTradeRoutes: z.boolean(),
    passesOtherTerritories: z.array(z.string().uuid()),
  }),

  // Losses
  losses: z.number().int().default(0),
  lossReasons: z.array(z.string()).default([]),
});
export type MigrationEvent = z.infer<typeof MigrationEventSchema>;

// ============================================
// PREDATION EVENT
// ============================================

export const PredationEventSchema = z.object({
  id: z.string().uuid(),

  // Participants
  predatorPopulationId: z.string().uuid(),
  predatorSpeciesId: z.string(),
  predatorSpeciesName: z.string(),
  preyPopulationId: z.string().uuid(),
  preySpeciesId: z.string(),
  preySpeciesName: z.string(),

  // Location
  regionId: z.string().uuid(),

  // Outcome
  preyKilled: z.number().int(),
  predatorCasualties: z.number().int(),

  occurredAt: z.string(),
});
export type PredationEvent = z.infer<typeof PredationEventSchema>;

// ============================================
// COMPETITION EVENT
// ============================================

export const CompetitionEventSchema = z.object({
  id: z.string().uuid(),

  // Competitors
  populationAId: z.string().uuid(),
  speciesAId: z.string(),
  speciesAName: z.string(),
  populationBId: z.string().uuid(),
  speciesBId: z.string(),
  speciesBName: z.string(),

  // Location
  regionId: z.string().uuid(),

  // What they're competing for
  competitionType: z.enum([
    "territory",
    "food",
    "water",
    "lair_site",
    "dominance",
  ]),

  // Outcome
  winnerId: z.string().uuid().optional(),
  loserEffect: z.enum([
    "displaced",
    "reduced",
    "subordinated",
    "unchanged",
  ]),

  casualties: z.object({
    populationA: z.number().int(),
    populationB: z.number().int(),
  }),

  occurredAt: z.string(),
});
export type CompetitionEvent = z.infer<typeof CompetitionEventSchema>;

// ============================================
// CIVILIZATION INTERACTION TYPE
// ============================================

export const CivilizationInteractionTypeSchema = z.enum([
  "raid",             // Monsters attack settlement
  "caravan_attack",   // Monsters attack travelers
  "farm_predation",   // Monsters eat livestock
  "patrol_clash",     // Fought settlement patrols
  "hunt",             // Settlement hunted monsters
  "clearing",         // Settlement cleared monsters
  "treaty",           // Negotiated coexistence
]);
export type CivilizationInteractionType = z.infer<typeof CivilizationInteractionTypeSchema>;

// ============================================
// CIVILIZATION INTERACTION
// ============================================

export const CivilizationInteractionSchema = z.object({
  id: z.string().uuid(),

  // Monster side
  populationId: z.string().uuid(),
  speciesId: z.string(),
  speciesName: z.string(),

  // Civilization side
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Type
  interactionType: CivilizationInteractionTypeSchema,

  // Outcome
  outcome: z.object({
    monsterCasualties: z.number().int(),
    civilianCasualties: z.number().int().optional(),
    guardCasualties: z.number().int().optional(),
    goldLost: z.number().optional(),
    livestockLost: z.number().int().optional(),
    buildingsDamaged: z.number().int().optional(),
  }),

  // Effects
  effects: z.object({
    settlementUnrestChange: z.number().optional(),
    bountyGenerated: z.boolean().default(false),
    bountyId: z.string().uuid().optional(),
    populationPushedBack: z.boolean().default(false),
  }),

  occurredAt: z.string(),
});
export type CivilizationInteraction = z.infer<typeof CivilizationInteractionSchema>;

// ============================================
// ENCOUNTER CONTEXT
// ============================================

export const EncounterContextSchema = z.object({
  // Where
  regionId: z.string().uuid(),
  terrainType: z.string(),
  nearPOI: z.string().uuid().optional(),

  // Who
  populationId: z.string().uuid(),
  speciesId: z.string(),
  speciesName: z.string(),

  // Why they're here
  behaviorState: BehaviorStateSchema,
  motivation: z.enum([
    "defending_territory",
    "hunting",
    "returning_to_lair",
    "migrating",
    "fleeing",
    "raiding",
    "exploring",
    "random_encounter",
  ]),

  // Context
  groupSize: z.number().int(),
  hasLeader: z.boolean(),
  morale: z.number().min(0).max(1),

  // Environmental factors
  timeOfDay: z.enum(["dawn", "day", "dusk", "night"]),
  weather: z.string().optional(),
  advantageousTerrain: z.boolean(),

  // Tactical info
  alerted: z.boolean(),
  ambushPossible: z.boolean(),
  retreatRouteClear: z.boolean(),
});
export type EncounterContext = z.infer<typeof EncounterContextSchema>;

// ============================================
// ECOLOGICAL HELPER FUNCTIONS
// ============================================

export function calculatePredationPressure(
  population: { speciesId: string; count: number },
  predatorPopulations: Array<{ speciesId: string; count: number; preySpecies: string[] }>,
): number {
  let pressure = 0;

  for (const predator of predatorPopulations) {
    if (predator.preySpecies.includes(population.speciesId)) {
      const ratio = predator.count / Math.max(1, population.count);
      pressure += ratio * 0.2;
    }
  }

  return Math.min(1, pressure);
}

export function calculateTerritoryPressure(
  population: { count: number },
  carryingCapacity: number,
): number {
  return population.count / Math.max(1, carryingCapacity);
}

export function shouldMigrate(
  foodSecurity: number,
  territoryPressure: number,
  predationPressure: number,
  migrationTendency: number,
): boolean {
  // Higher pressure = more likely to migrate
  const pressure =
    (1 - foodSecurity) * 0.4 +
    Math.max(0, territoryPressure - 1) * 0.3 +
    predationPressure * 0.3;

  return Math.random() < pressure * migrationTendency;
}

export function selectMigrationDestination(
  adjacentRegions: Array<{
    regionId: string;
    regionName: string;
    habitatMatch: number;
    currentPopulationDensity: number;
    civilizationPresence: number;
  }>,
): { regionId: string; regionName: string } | null {
  // Score each region
  const scored = adjacentRegions.map(region => ({
    regionId: region.regionId,
    regionName: region.regionName,
    score:
      region.habitatMatch * 0.4 +
      (1 - region.currentPopulationDensity) * 0.3 +
      (1 - region.civilizationPresence) * 0.3,
  }));

  // Filter out poor options
  const viable = scored.filter(r => r.score > 0.3);
  if (viable.length === 0) return null;

  // Weighted random selection
  const totalScore = viable.reduce((sum, r) => sum + r.score, 0);
  let roll = Math.random() * totalScore;

  for (const region of viable) {
    roll -= region.score;
    if (roll <= 0) {
      return { regionId: region.regionId, regionName: region.regionName };
    }
  }

  return { regionId: viable[0].regionId, regionName: viable[0].regionName };
}

export function determineBehaviorState(
  population: {
    count: number;
    health: {
      foodSecurity: number;
      territoryPressure: number;
      predationPressure: number;
    };
    behavior: {
      aggression: number;
      expansion: boolean;
    };
  },
  species: MonsterSpecies,
  timeOfDay: "dawn" | "day" | "dusk" | "night",
  nearSettlement: boolean,
): BehaviorState {
  // Fleeing takes priority
  if (population.health.predationPressure > 0.7) {
    return "fleeing";
  }

  // Migration
  if (population.health.territoryPressure > 1.5 || population.health.foodSecurity < 0.3) {
    return "migrating";
  }

  // Raiding - aggressive species near settlements when hungry
  if (
    species.ecology.aggressive &&
    nearSettlement &&
    population.health.foodSecurity < 0.6 &&
    population.behavior.aggression > 0.6
  ) {
    return "raiding";
  }

  // Hunting - predators hunt during appropriate times
  if (
    species.ecology.role === "predator" ||
    species.ecology.role === "apex_predator"
  ) {
    if (population.health.foodSecurity < 0.8) {
      return "hunting";
    }
  }

  // Patrolling - territorial species protect their ground
  if (species.ecology.territorialRadius > 0 && population.behavior.expansion) {
    return "patrolling";
  }

  // Aggressive species attack on sight
  if (species.ecology.aggressive && population.behavior.aggression > 0.7) {
    return "aggressive";
  }

  // Default based on time
  if (timeOfDay === "night" && species.behavior.intelligence !== "mindless") {
    return "resting";
  }

  return "patrolling";
}

export function generateEncounterContext(
  population: {
    id: string;
    speciesId: string;
    speciesName: string;
    count: number;
    health: {
      foodSecurity: number;
      territoryPressure: number;
      predationPressure: number;
    };
    behavior: {
      aggression: number;
      expansion: boolean;
    };
    demographics?: {
      leader?: { exists: boolean };
    };
  },
  species: MonsterSpecies,
  region: {
    id: string;
    primaryHabitat: string;
    nearSettlement: boolean;
  },
  poiId?: string,
): EncounterContext {
  const timeOfDay = getTimeOfDay();
  const behaviorState = determineBehaviorState(
    population,
    species,
    timeOfDay,
    region.nearSettlement,
  );

  // Determine group size based on social structure
  const { min, max } = species.ecology.typicalGroupSize;
  const availableCount = Math.min(population.count, max);
  const groupSize = Math.max(min, Math.floor(Math.random() * (availableCount - min + 1)) + min);

  return {
    regionId: region.id,
    terrainType: region.primaryHabitat,
    nearPOI: poiId,
    populationId: population.id,
    speciesId: population.speciesId,
    speciesName: population.speciesName,
    behaviorState,
    motivation: behaviorStateToMotivation(behaviorState),
    groupSize,
    hasLeader: population.demographics?.leader?.exists ?? false,
    morale: calculateMorale(population, species),
    timeOfDay,
    advantageousTerrain: species.ecology.preferredHabitats.includes(region.primaryHabitat as any),
    alerted: behaviorState === "patrolling" || behaviorState === "aggressive",
    ambushPossible: behaviorState === "hunting" && species.behavior.intelligence !== "mindless",
    retreatRouteClear: population.health.territoryPressure < 1,
  };
}

// ============================================
// INTERNAL HELPERS
// ============================================

function getTimeOfDay(): "dawn" | "day" | "dusk" | "night" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 18) return "day";
  if (hour >= 18 && hour < 20) return "dusk";
  return "night";
}

function behaviorStateToMotivation(
  state: BehaviorState,
): EncounterContext["motivation"] {
  switch (state) {
    case "hunting":
      return "hunting";
    case "patrolling":
      return "defending_territory";
    case "migrating":
      return "migrating";
    case "fleeing":
      return "fleeing";
    case "raiding":
      return "raiding";
    case "resting":
      return "returning_to_lair";
    case "aggressive":
      return "random_encounter";
    default:
      return "random_encounter";
  }
}

function calculateMorale(
  population: {
    count: number;
    health: {
      foodSecurity: number;
      territoryPressure: number;
      predationPressure: number;
    };
  },
  species: MonsterSpecies,
): number {
  let morale = 0.5;

  // Well-fed = higher morale
  morale += (population.health.foodSecurity - 0.5) * 0.3;

  // Overcrowding = lower morale
  morale -= Math.max(0, population.health.territoryPressure - 1) * 0.2;

  // Being hunted = lower morale
  morale -= population.health.predationPressure * 0.3;

  // Population size matters
  if (population.count < 5) {
    morale -= 0.2; // Remnant populations are demoralized
  } else if (population.count > 100) {
    morale += 0.1; // Large populations are confident
  }

  // Intelligence affects morale stability
  if (species.behavior.intelligence === "mindless") {
    morale = 0.5; // Mindless creatures don't have morale
  }

  return Math.max(0, Math.min(1, morale));
}
