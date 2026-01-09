/**
 * HUSBANDRY SYSTEM
 *
 * Livestock production - meat, dairy, wool, eggs, draft labor.
 * Animals modeled as stock cohorts with care schedules and yield functions.
 *
 * Core concepts:
 * - Species: Defines what an animal produces and requires
 * - Ranch: Physical site holding livestock
 * - Herd: Cohort of animals at a ranch
 * - Operation: Active production mode (dairy, meat, wool, etc.)
 *
 * All operations emit timeline deltas for party-scoped causality.
 */

// ============================================
// SCHEMA EXPORTS
// ============================================

export {
  // Enums
  LivestockCategorySchema,
  type LivestockCategory,
  DomesticationClassSchema,
  type DomesticationClass,
  OperationModeSchema,
  type OperationMode,
  PastureQualitySchema,
  type PastureQuality,
  SecurityLevelSchema,
  type SecurityLevel,
  ShelterQualitySchema,
  type ShelterQuality,
  RanchStatusSchema,
  type RanchStatus,
  OperationStatusSchema,
  type OperationStatus,
  SeasonSchema,
  type Season,
  BreedingSeasonSchema,
  type BreedingSeason,
  HusbandryEventTypeSchema,
  type HusbandryEventType,
  EventSeveritySchema,
  type EventSeverity,

  // Yield schemas
  MeatYieldSchema,
  type MeatYield,
  MilkYieldSchema,
  type MilkYield,
  WoolYieldSchema,
  type WoolYield,
  EggYieldSchema,
  type EggYield,
  LaborYieldSchema,
  type LaborYield,
  ManureYieldSchema,
  type ManureYield,
  YieldProfileSchema,
  type YieldProfile,

  // Care schemas
  CareRequirementsSchema,
  type CareRequirements,
  ReproductionProfileSchema,
  type ReproductionProfile,
  MortalityProfileSchema,
  type MortalityProfile,
  DiseaseSusceptibilitySchema,
  type DiseaseSusceptibility,

  // Entity schemas
  LivestockSpeciesSchema,
  type LivestockSpecies,
  InfrastructureSchema,
  type Infrastructure,
  RanchWorkerSchema,
  type RanchWorker,
  RanchSchema,
  type Ranch,
  AgeDistributionSchema,
  type AgeDistribution,
  HealthStateSchema,
  type HealthState,
  StressStateSchema,
  type StressState,
  ExpectedBirthSchema,
  type ExpectedBirth,
  NamedIndividualSchema,
  type NamedIndividual,
  HerdSchema,
  type Herd,
  OutputDestinationSchema,
  type OutputDestination,
  HusbandryOperationSchema,
  type HusbandryOperation,
  HusbandryEventImpactSchema,
  type HusbandryEventImpact,
  HusbandryEventSchema,
  type HusbandryEvent,
  HusbandryTickResultSchema,
  type HusbandryTickResult,

  // Constants
  HUSBANDRY_COMMODITIES,
  PASTURE_QUALITY_MULTIPLIERS,
  SHELTER_QUALITY_MULTIPLIERS,
  SEASON_MODIFIERS,
} from './schema';

// ============================================
// SPECIES EXPORTS
// ============================================

export {
  LIVESTOCK_SPECIES,
  getSpecies,
  getSpeciesByCategory,
  getDomesticatedSpecies,
  getSpeciesForClimate,
  calculateDailyFeedCost,
  calculateSpaceRequired,
  calculateLaborHours,
  estimateAnnualMeatYield,
  estimateAnnualMilkYield,
  estimateAnnualWoolYield,
  estimateAnnualEggYield,
} from './species';

// ============================================
// RANCH EXPORTS
// ============================================

export {
  createRanch,
  updateRanch,
  addWorker,
  removeWorker,
  updateOccupancy,
  type CreateRanchInput,
  type UpdateRanchInput,
  type AddWorkerInput,
  type RemoveWorkerInput,
  // Helpers
  calculateOperatingCost,
  getCapacityUtilization,
  hasCapacity,
  getAverageWorkerSkill,
  getWorkersByRole,
  isOperational,
  // Queries
  getRanchesByOwner,
  getRanchesByHub,
  getRanchesByWorldNode,
  getActiveRanches,
} from './ranches';

// ============================================
// HERD EXPORTS
// ============================================

export {
  createHerd,
  addToHerd,
  removeFromHerd,
  slaughterFromHerd,
  updateHealth,
  updateStress,
  addPregnancies,
  processBirths,
  addNamedIndividual,
  updateLastTick,
  type CreateHerdInput,
  type AddToHerdInput,
  type RemoveFromHerdInput,
  type SlaughterInput,
  type SlaughterResult,
  type UpdateHealthInput,
  type UpdateStressInput,
  type AddPregnancyInput,
  type ProcessBirthsInput,
  type AddNamedIndividualInput,
  type UpdateTickInput,
  // Helpers
  getTotalPopulation,
  getBreedingEligible,
  getAverageHealth,
  isHealthy,
  isStressed,
  // Queries
  getHerdsByRanch,
  getHerdsBySpecies,
  getTotalAnimals,
} from './herds';

// ============================================
// OPERATION EXPORTS
// ============================================

export {
  createOperation,
  updateOperation,
  recordOutput,
  addToStockpile,
  removeFromStockpile,
  recordCosts,
  type CreateOperationInput,
  type UpdateOperationInput,
  type RecordOutputInput,
  type AddToStockpileInput,
  type RemoveFromStockpileInput,
  type RecordCostsInput,
  // Helpers
  calculateCareQuality,
  calculateFeedQuality,
  isActive,
  getStockpileWeight,
  hasStockpileCapacity,
  getProfitMargin,
  mapToEconomyCommodities,
  // Queries
  getOperationsByRanch,
  getOperationsByHerd,
  getOperationsByMode,
  getActiveOperations,
} from './operations';

// ============================================
// EVENT EXPORTS
// ============================================

export {
  emitHusbandryEvent,
  emitHusbandryTickDelta,
  type CreateHusbandryEventInput,
  type EmitTickResultInput,
  // Specialized emitters
  emitBirthEvent,
  emitSlaughterEvent,
  emitDeathEvent,
  emitDiseaseEvent,
  emitFeedShortageEvent,
  emitYieldEvent,
  emitWinterAttritionEvent,
  emitPredatorAttackEvent,
  emitRaidLossEvent,
  emitBreedingSuccessEvent,
  emitCareMissedEvent,
} from './events';

// ============================================
// REPRODUCTION EXPORTS
// ============================================

export {
  canBreedInSeason,
  calculateBreedingSuccessRate,
  calculateNewPregnancies,
  processDueBirths,
  getRemainingExpectedBirths,
  progressAges,
  getNextBreedingWindow,
  estimateAnnualGrowthRate,
  type PregnancyResult,
  type BirthResult,
  type AgeProgressionResult,
} from './reproduction';

// ============================================
// MORTALITY EXPORTS
// ============================================

export {
  calculateNaturalMortality,
  calculateWinterAttrition,
  processDiseaseOutbreak,
  checkForDiseaseOutbreak,
  checkForPredatorAttack,
  calculatePredatorAttack,
  calculateRaidLosses,
  calculateHealthRecovery,
  type MortalityResult,
  type WinterAttritionResult,
  type DiseaseOutbreakResult,
  type PredatorAttackResult,
  type RaidResult,
} from './mortality';

// ============================================
// ENGINE EXPORTS
// ============================================

export {
  HusbandryEngine,
  createSeededRng,
} from './engine';
