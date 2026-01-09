/**
 * HUSBANDRY SYSTEM - Schema
 *
 * Livestock production types and validation.
 * Animals modeled as stock cohorts with care schedules and yield functions.
 */

import { z } from 'zod';

// ============================================
// LIVESTOCK CATEGORY
// ============================================

export const LivestockCategorySchema = z.enum([
  'MEAT',   // Beef cattle, pigs, sheep (meat focus)
  'DAIRY',  // Dairy cattle, goats (milk focus)
  'WOOL',   // Sheep, alpaca (fiber focus)
  'LABOR',  // Oxen, donkeys (draft work)
  'MOUNT',  // Horses, mules (riding)
  'EGGS',   // Chickens, ducks, geese
  'MULTI',  // Multiple outputs
]);
export type LivestockCategory = z.infer<typeof LivestockCategorySchema>;

// ============================================
// DOMESTICATION CLASS
// ============================================

export const DomesticationClassSchema = z.enum([
  'DOMESTICATED',  // Standard husbandry (cattle, sheep, chickens)
  'TAMEABLE',      // Requires handler contracts (exotic mounts)
  'SYMBIOTIC',     // Social/alliance contracts (bees, familiars)
]);
export type DomesticationClass = z.infer<typeof DomesticationClassSchema>;

// ============================================
// OPERATION MODE
// ============================================

export const OperationModeSchema = z.enum([
  'BREEDING',  // Maximize reproduction
  'MEAT',      // Slaughter for meat/hides
  'DAIRY',     // Milk production
  'WOOL',      // Fiber harvesting
  'EGGS',      // Egg collection
  'DRAFT',     // Labor/work animals
  'MIXED',     // Balanced approach
]);
export type OperationMode = z.infer<typeof OperationModeSchema>;

// ============================================
// QUALITY ENUMS
// ============================================

export const PastureQualitySchema = z.enum([
  'poor',
  'standard',
  'rich',
  'exceptional',
]);
export type PastureQuality = z.infer<typeof PastureQualitySchema>;

export const SecurityLevelSchema = z.enum([
  'none',
  'basic',
  'guarded',
  'fortified',
]);
export type SecurityLevel = z.infer<typeof SecurityLevelSchema>;

export const ShelterQualitySchema = z.enum([
  'none',
  'basic',
  'adequate',
  'excellent',
]);
export type ShelterQuality = z.infer<typeof ShelterQualitySchema>;

export const RanchStatusSchema = z.enum([
  'active',
  'abandoned',
  'under_construction',
  'damaged',
]);
export type RanchStatus = z.infer<typeof RanchStatusSchema>;

export const OperationStatusSchema = z.enum([
  'active',
  'paused',
  'suspended',
  'terminated',
]);
export type OperationStatus = z.infer<typeof OperationStatusSchema>;

export const SeasonSchema = z.enum([
  'spring',
  'summer',
  'fall',
  'winter',
]);
export type Season = z.infer<typeof SeasonSchema>;

// ============================================
// YIELD PROFILES
// ============================================

export const MeatYieldSchema = z.object({
  perUnit: z.number(),           // lbs per slaughtered adult
  maturityWeeks: z.number(),     // weeks until slaughter-ready
  hideYield: z.number().optional(), // lbs of hide per animal
  tallowYield: z.number().optional(),
});
export type MeatYield = z.infer<typeof MeatYieldSchema>;

export const MilkYieldSchema = z.object({
  perDay: z.number(),            // gallons per day per lactating animal
  lactationWeeks: z.number(),    // weeks of production post-birth
  cheeseRatio: z.number().optional(), // gallons milk per lb cheese
});
export type MilkYield = z.infer<typeof MilkYieldSchema>;

export const WoolYieldSchema = z.object({
  perShearing: z.number(),       // lbs per shearing
  shearingsPerYear: z.number(),  // typically 1-2
  qualityGrade: z.string().optional(),
});
export type WoolYield = z.infer<typeof WoolYieldSchema>;

export const EggYieldSchema = z.object({
  perDay: z.number(),            // eggs per day per laying hen
  layingWeeks: z.number(),       // productive laying period
  hatchRate: z.number().optional(), // % that hatch if incubated
});
export type EggYield = z.infer<typeof EggYieldSchema>;

export const LaborYieldSchema = z.object({
  carryCapacity: z.number(),     // lbs can carry
  pullStrength: z.number(),      // lbs can pull
  workHoursPerDay: z.number(),   // sustainable work hours
});
export type LaborYield = z.infer<typeof LaborYieldSchema>;

export const ManureYieldSchema = z.object({
  perDay: z.number(),            // lbs per day (fertilizer output)
});
export type ManureYield = z.infer<typeof ManureYieldSchema>;

export const YieldProfileSchema = z.object({
  meat: MeatYieldSchema.optional(),
  milk: MilkYieldSchema.optional(),
  wool: WoolYieldSchema.optional(),
  eggs: EggYieldSchema.optional(),
  labor: LaborYieldSchema.optional(),
  manure: ManureYieldSchema.optional(),
});
export type YieldProfile = z.infer<typeof YieldProfileSchema>;

// ============================================
// CARE REQUIREMENTS
// ============================================

export const CareRequirementsSchema = z.object({
  feedPerDay: z.number(),          // lbs of feed per day
  feedTypes: z.array(z.string()),  // acceptable feed commodities
  waterPerDay: z.number(),         // gallons per day
  spacePerHead: z.number(),        // sq ft per animal
  shelterNeeded: z.boolean(),
  minCareSkill: z.number().int().min(0).max(5),
  careHoursPerDay: z.number(),     // labor hours per 10 animals
});
export type CareRequirements = z.infer<typeof CareRequirementsSchema>;

// ============================================
// REPRODUCTION PROFILE
// ============================================

export const BreedingSeasonSchema = z.enum([
  'year_round',
  'spring',
  'fall',
  'seasonal',
]);
export type BreedingSeason = z.infer<typeof BreedingSeasonSchema>;

export const ReproductionProfileSchema = z.object({
  gestationWeeks: z.number(),
  offspringMin: z.number().int(),
  offspringMax: z.number().int(),
  breedingAgeWeeks: z.number(),
  maxBreedingAgeWeeks: z.number(),
  breedingSeason: BreedingSeasonSchema,
  twinRate: z.number().optional(),  // % chance of twins
});
export type ReproductionProfile = z.infer<typeof ReproductionProfileSchema>;

// ============================================
// MORTALITY PROFILE
// ============================================

export const MortalityProfileSchema = z.object({
  baseLifespanYears: z.number(),
  infantMortalityRate: z.number(),  // % die in first weeks
  adultMortalityRate: z.number(),   // % annual mortality
  elderMortalityRate: z.number(),   // % annual for old animals
  winterAttritionRate: z.number(),  // % extra mortality in winter
  starvationDaysToMortality: z.number(),
});
export type MortalityProfile = z.infer<typeof MortalityProfileSchema>;

// ============================================
// DISEASE SUSCEPTIBILITY
// ============================================

export const DiseaseSusceptibilitySchema = z.object({
  diseaseId: z.string(),
  susceptibility: z.number().min(0).max(1),
  mortalityIfUntreated: z.number().min(0).max(1),
});
export type DiseaseSusceptibility = z.infer<typeof DiseaseSusceptibilitySchema>;

// ============================================
// LIVESTOCK SPECIES
// ============================================

export const LivestockSpeciesSchema = z.object({
  id: z.string(),
  name: z.string(),
  scientificName: z.string().optional(),
  description: z.string().optional(),

  category: LivestockCategorySchema,
  domesticationClass: DomesticationClassSchema,
  creatureType: z.string().default('beast'),

  yieldProfiles: YieldProfileSchema,
  careRequirements: CareRequirementsSchema,
  reproductionProfile: ReproductionProfileSchema,
  mortalityProfile: MortalityProfileSchema,
  diseaseSusceptibility: z.array(DiseaseSusceptibilitySchema).default([]),

  preferredClimates: z.array(z.string()).default([]),
  terrainAdaptations: z.array(z.string()).default([]),

  basePurchasePrice: z.number().int().default(10),
  baseSalePrice: z.number().int().default(8),

  isCanonical: z.boolean().default(true),
  source: z.string().optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.number().int().default(1),
});
export type LivestockSpecies = z.infer<typeof LivestockSpeciesSchema>;

// ============================================
// INFRASTRUCTURE
// ============================================

export const InfrastructureSchema = z.object({
  barns: z.number().int().default(0),
  pastures: z.number().int().default(0),
  fencing: z.string().optional(),  // none, wood, stone
  waterAccess: z.boolean().default(false),
  feedStorage: z.number().int().default(0),  // capacity in lbs
});
export type Infrastructure = z.infer<typeof InfrastructureSchema>;

// ============================================
// WORKER
// ============================================

export const RanchWorkerSchema = z.object({
  npcId: z.string().uuid().optional(),
  name: z.string().optional(),
  role: z.string(),
  skill: z.number().int().min(0).max(5),
  wage: z.number().int(),
});
export type RanchWorker = z.infer<typeof RanchWorkerSchema>;

// ============================================
// RANCH
// ============================================

export const RanchSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  hubId: z.string().uuid().optional(),
  worldNodeId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),

  name: z.string(),

  ownerId: z.string().optional(),
  ownerType: z.string().optional(),
  ownerName: z.string().optional(),

  totalCapacity: z.number().int().default(50),
  currentOccupancy: z.number().int().default(0),

  infrastructure: InfrastructureSchema.default({}),

  pastureQuality: PastureQualitySchema.default('standard'),
  securityLevel: SecurityLevelSchema.default('basic'),
  shelterQuality: ShelterQualitySchema.default('basic'),

  workers: z.array(RanchWorkerSchema).default([]),
  totalWorkers: z.number().int().default(0),

  operatingCostPerDay: z.number().int().default(0),
  taxRate: z.number().default(0),
  taxCollector: z.string().optional(),

  status: RanchStatusSchema.default('active'),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type Ranch = z.infer<typeof RanchSchema>;

// ============================================
// AGE DISTRIBUTION
// ============================================

/**
 * Tracks cohort counts by age class.
 *
 * SEMANTICS:
 * - infants: Age 0-8 weeks (pre-weaned)
 * - juveniles: Age 8 weeks to breedingAgeWeeks (weaned but immature)
 * - adults: Age breedingAgeWeeks to ~70% lifespan (mature, productive)
 * - elders: Age >70% lifespan (reduced productivity, higher mortality)
 * - breedingEligible: Count of adults CAPABLE of breeding (not currently pregnant)
 *
 * Note: breedingEligible is a derived subset of adults, not additive.
 * Total population = infants + juveniles + adults + elders
 */
export const AgeDistributionSchema = z.object({
  infants: z.number().int().default(0),
  juveniles: z.number().int().default(0),
  adults: z.number().int().default(0),
  elders: z.number().int().default(0),
  breedingEligible: z.number().int().default(0),  // Adults capable of breeding (subset of adults, not additive)
});
export type AgeDistribution = z.infer<typeof AgeDistributionSchema>;

// ============================================
// HEALTH STATE
// ============================================

export const HealthStateSchema = z.object({
  overall: z.number().min(0).max(100).default(100),
  diseased: z.number().int().default(0),
  injured: z.number().int().default(0),
  malnourished: z.number().int().default(0),
});
export type HealthState = z.infer<typeof HealthStateSchema>;

// ============================================
// STRESS STATE
// ============================================

export const StressStateSchema = z.object({
  overall: z.number().min(0).max(100).default(0),
  overcrowding: z.number().min(0).max(100).default(0),
  predatorFear: z.number().min(0).max(100).default(0),
  careNeglect: z.number().min(0).max(100).default(0),
});
export type StressState = z.infer<typeof StressStateSchema>;

// ============================================
// EXPECTED BIRTH
// ============================================

/**
 * Tracks expected births for a breeding cohort.
 * dueWorldDay is canonical world time (not wall-clock).
 */
export const ExpectedBirthSchema = z.object({
  dueWorldDay: z.number().int(),  // World day when birth is expected
  expectedCount: z.number().int(),
  cohortId: z.string().uuid().optional(),  // Optional tracking for breeding cohort
});
export type ExpectedBirth = z.infer<typeof ExpectedBirthSchema>;

// ============================================
// NAMED INDIVIDUAL
// ============================================

export const NamedIndividualSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['mount', 'familiar', 'prize', 'breeder']),
  stats: z.record(z.string(), z.any()).optional(),
  ownerId: z.string().uuid().optional(),
  ownerName: z.string().optional(),
});
export type NamedIndividual = z.infer<typeof NamedIndividualSchema>;

// ============================================
// HERD
// ============================================

export const HerdSchema = z.object({
  id: z.string().uuid(),
  ranchId: z.string().uuid(),
  speciesId: z.string(),

  count: z.number().int().default(0),

  ageDistribution: AgeDistributionSchema.default({}),
  healthState: HealthStateSchema.default({}),
  stressState: StressStateSchema.default({}),

  breedingEnabled: z.boolean().default(true),
  pregnantCount: z.number().int().default(0),
  expectedBirths: z.array(ExpectedBirthSchema).default([]),

  lastYieldCollected: z.string().optional(),
  yieldThisCycle: z.number().default(0),

  lastCareTickVersion: z.number().int().optional(),
  lastCareTickTimestamp: z.string().optional(),

  namedIndividuals: z.array(NamedIndividualSchema).default([]),

  tags: z.array(z.string()).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type Herd = z.infer<typeof HerdSchema>;

// ============================================
// OUTPUT DESTINATION
// ============================================

export const OutputDestinationSchema = z.object({
  type: z.enum(['stockpile', 'market', 'transport', 'consume']),
  locationId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
});
export type OutputDestination = z.infer<typeof OutputDestinationSchema>;

// ============================================
// HUSBANDRY OPERATION
// ============================================

export const HusbandryOperationSchema = z.object({
  id: z.string().uuid(),
  ranchId: z.string().uuid(),
  herdId: z.string().uuid(),

  mode: OperationModeSchema,

  laborAllocated: z.number().int().default(0),
  feedAllocated: z.number().default(0),
  feedSource: z.enum(['pasture', 'stockpile', 'market']).default('stockpile'),

  careQuality: z.number().min(0).max(2).default(1.0),
  feedQuality: z.number().min(0).max(2).default(1.0),

  status: OperationStatusSchema.default('active'),
  disruptionReason: z.string().optional(),
  resumesAt: z.string().optional(),

  outputThisCycle: z.record(z.string(), z.number()).default({}),
  outputTotal: z.record(z.string(), z.number()).default({}),
  outputDestination: OutputDestinationSchema.optional(),

  stockpile: z.record(z.string(), z.number()).default({}),
  stockpileCapacity: z.number().int().default(500),

  operatingCosts: z.number().default(0),
  revenue: z.number().default(0),

  startedAt: z.string(),
  lastTickAt: z.string().optional(),
  lastTickVersion: z.number().int().optional(),

  version: z.number().int().default(1),
});
export type HusbandryOperation = z.infer<typeof HusbandryOperationSchema>;

// ============================================
// HUSBANDRY EVENT TYPES
// ============================================

export const HusbandryEventTypeSchema = z.enum([
  'HERD_BORN',
  'HERD_SLAUGHTERED',
  'DISEASE_OUTBREAK',
  'CARE_MISSED',
  'RAID_LOSS',
  'WINTER_ATTRITION',
  'YIELD_COLLECTED',
  'PREDATOR_ATTACK',
  'ANIMAL_ESCAPED',
  'BREEDING_SUCCESS',
  'BREEDING_FAILURE',
  'ANIMAL_DIED',
  'VETERINARY_CARE',
  'FEED_SHORTAGE',
  'MARKET_SALE',
  'MARKET_PURCHASE',
]);
export type HusbandryEventType = z.infer<typeof HusbandryEventTypeSchema>;

export const EventSeveritySchema = z.enum([
  'info',
  'warning',
  'danger',
  'critical',
]);
export type EventSeverity = z.infer<typeof EventSeveritySchema>;

// ============================================
// HUSBANDRY EVENT IMPACT
// ============================================

export const HusbandryEventImpactSchema = z.object({
  populationDelta: z.number().int().optional(),
  healthDelta: z.number().optional(),
  commodityOutput: z.record(z.string(), z.number()).optional(),
  goldDelta: z.number().optional(),
});
export type HusbandryEventImpact = z.infer<typeof HusbandryEventImpactSchema>;

// ============================================
// HUSBANDRY EVENT
// ============================================

export const HusbandryEventSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  ranchId: z.string().uuid().optional(),
  herdId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),

  eventType: HusbandryEventTypeSchema,

  details: z.record(z.string(), z.any()).default({}),
  impact: HusbandryEventImpactSchema.optional(),

  severity: EventSeveritySchema.default('info'),

  occurredAt: z.string(),
  worldTimestamp: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }).optional(),
  syncLogId: z.string().uuid().optional(),

  publicKnowledge: z.boolean().default(true),

  createdAt: z.string(),
});
export type HusbandryEvent = z.infer<typeof HusbandryEventSchema>;

// ============================================
// TICK RESULT
// ============================================

/**
 * INVARIANT: No pricing authority in tick result.
 * Outputs are quantities only - economy layer handles pricing separately.
 */
export const HusbandryTickResultSchema = z.object({
  ranchId: z.string().uuid(),
  operationId: z.string().uuid(),
  herdId: z.string().uuid(),

  // Canonical time reference (no wall-clock)
  worldDay: z.number().int(),

  // What was produced (quantities only, no prices)
  output: z.record(z.string(), z.number()),

  // Population changes
  births: z.number().int(),
  deaths: z.number().int(),
  slaughtered: z.number().int(),
  newPopulation: z.number().int(),

  // Resource consumption (quantities only)
  feedConsumed: z.record(z.string(), z.number()),
  laborUsed: z.number(),

  // Events generated
  events: z.array(z.object({
    type: HusbandryEventTypeSchema,
    description: z.string(),
    severity: EventSeveritySchema.optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })),

  // Updated states
  newHealthState: HealthStateSchema,
  newStressState: StressStateSchema,
  newAgeDistribution: AgeDistributionSchema,

  daysProcessed: z.number(),
});
export type HusbandryTickResult = z.infer<typeof HusbandryTickResultSchema>;

// ============================================
// COMMODITY MAPPING
// ============================================

export const HUSBANDRY_COMMODITIES = {
  meat: 'meat',
  milk: 'milk',
  eggs: 'eggs',
  wool: 'wool',
  hides: 'hides',
  leather: 'leather',
  tallow: 'tallow',
  manure: 'manure',
  cheese: 'cheese',
  honey: 'honey',
  wax: 'wax',
} as const;

// ============================================
// QUALITY MULTIPLIERS
// ============================================

export const PASTURE_QUALITY_MULTIPLIERS: Record<PastureQuality, number> = {
  poor: 0.6,
  standard: 1.0,
  rich: 1.3,
  exceptional: 1.5,
};

export const SHELTER_QUALITY_MULTIPLIERS: Record<ShelterQuality, number> = {
  none: 0.7,
  basic: 0.9,
  adequate: 1.0,
  excellent: 1.1,
};

export const SEASON_MODIFIERS: Record<Season, { yield: number; mortality: number; breeding: number }> = {
  spring: { yield: 1.1, mortality: 0.9, breeding: 1.3 },
  summer: { yield: 1.2, mortality: 0.8, breeding: 1.0 },
  fall: { yield: 1.0, mortality: 1.0, breeding: 1.2 },
  winter: { yield: 0.7, mortality: 1.5, breeding: 0.5 },
};
