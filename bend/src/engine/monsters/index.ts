// ============================================
// MONSTER POPULATION SYSTEM
// ============================================
//
// THE WILDERNESS IS AN OPPONENT
//
// Monsters are why Toril stays medieval.
// They're populations that grow, compete, and push back.
// Dungeons bleed creatures into the world.
// The Director watches what kills adventurers.
//
// This system tracks:
//   - Monster populations by region
//   - Spawning dungeons and their output
//   - Ecological interactions (predation, competition)
//   - Evolutionary adaptations based on success
//   - Civilization vs wilderness pressure
//

// Population schemas and helpers
export {
  // Schemas
  PopulationTierSchema,
  EcologicalRoleSchema,
  HabitatTypeSchema,
  CreatureTypeSchema,
  SocialStructureSchema,
  MonsterSpeciesSchema,
  MonsterPopulationSchema,
  RegionalEcosystemSchema,

  // Types
  type PopulationTier,
  type EcologicalRole,
  type HabitatType,
  type CreatureType,
  type SocialStructure,
  type MonsterSpecies,
  type MonsterPopulation,
  type RegionalEcosystem,

  // Constants
  TIER_THRESHOLDS,
  STANDARD_SPECIES,

  // Helpers
  getTierFromCount,
  calculateCarryingCapacity,
  getHabitatMatchScore,
} from "./population";

// Spawner schemas and helpers
export {
  // Schemas
  SpawnerTypeSchema,
  SpawnerStateSchema,
  ControllerTypeSchema,
  SpawnerSchema,

  // Types
  type SpawnerType,
  type SpawnerState,
  type ControllerType,
  type Spawner,
  type SpawnerOutput,

  // Constants
  SPAWNER_TEMPLATES,

  // Functions
  calculateWeeklyOutput,
  updateSpawnerState,
  capSpawner,
  onControllerDeath,
  createSpawnerFromTemplate,
} from "./spawner";

// Director schemas and helpers
export {
  // Schemas
  ThreatOutcomeSchema,
  EncounterRecordSchema,
  SpeciesFitnessSchema,
  RegionalThreatLevelSchema,
  AdaptationTypeSchema,
  AdaptationSchema,
  EvolutionCycleResultSchema,
  PartyProfileSchema,
  WorldDirectorStateSchema,

  // Types
  type ThreatOutcome,
  type EncounterRecord,
  type SpeciesFitness,
  type RegionalThreatLevel,
  type AdaptationType,
  type Adaptation,
  type EvolutionCycleResult,
  type PartyProfile,
  type WorldDirectorState,

  // Constants
  STANDARD_ADAPTATIONS,

  // Functions
  calculateFitness,
  adjustThreatLevel,
  createWorldDirector,
} from "./director";

// Ecology schemas and helpers
export {
  // Schemas
  BehaviorStateSchema,
  TerritoryRelationshipSchema,
  TerritorySchema,
  MigrationCauseSchema,
  MigrationEventSchema,
  PredationEventSchema,
  CompetitionEventSchema,
  CivilizationInteractionTypeSchema,
  CivilizationInteractionSchema,
  EncounterContextSchema,

  // Types
  type BehaviorState,
  type TerritoryRelationship,
  type Territory,
  type MigrationCause,
  type MigrationEvent,
  type PredationEvent,
  type CompetitionEvent,
  type CivilizationInteractionType,
  type CivilizationInteraction,
  type EncounterContext,

  // Functions
  calculatePredationPressure,
  calculateTerritoryPressure,
  shouldMigrate,
  selectMigrationDestination,
  determineBehaviorState,
  generateEncounterContext,
} from "./ecology";

// Population engine
export {
  tickPopulations,
  applyAdventurerEncounter,
  type PopulationTickResult,
  type PopulationTickContext,
} from "./population-engine";

// Director engine
export {
  tickDirector,
  recordEncounter,
  getSpeciesAdaptations,
  getRegionalThreat,
  getSpeciesFitness,
  calculateAdaptationEffects,
  type DirectorTickResult,
  type DirectorTickContext,
  type AdaptationEffects,
} from "./director-engine";
