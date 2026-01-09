// ============================================
// HUB SYSTEM
// ============================================
//
// Procedural settlement generation with:
// - Seed-based deterministic generation
// - Natural (organic) vs Planned (grid) topology
// - Observer-local chunk rendering
// - NPCs as full Characters (isNPC=true)
// - NPC scheduling and pathfinding
//

// Core schema
export {
  // Size and configuration
  HubSizeSchema,
  HUB_SIZE_CONFIG,
  type HubSize,

  // Topology
  TopologyTypeSchema,
  type TopologyType,

  // Districts
  DistrictTypeSchema,
  DISTRICT_ADJACENCY,
  type DistrictType,

  // Buildings
  BuildingTypeSchema,
  type BuildingType,

  // Chunks
  HubChunkSchema,
  type HubChunk,

  // Districts
  HubDistrictSchema,
  type HubDistrict,

  // Hub (settlement)
  HubSchema,
  type Hub,

  // Generation
  HubSeedSchema,
  type HubSeed,
  HubGenerationParamsSchema,
  type HubGenerationParams,

  // Observer state
  HubObserverStateSchema,
  type HubObserverState,

  // Constants
  CHUNK_LOAD_RADIUS,
  MAX_CACHED_CHUNKS,
} from './schema';

// Topology generation
export {
  SeededRNG,

  // Layout types
  type Point,
  type Street,
  type Lot,
  type ChunkLayout,

  // Topology generators
  NaturalTopology,
  PlannedTopology,
  RadialTopology,
  LinearTopology,
  HybridTopology,

  // Factory
  generateChunkLayout,
  generateDistrictLayout,
} from './topology';

// Chunk management
export {
  ChunkManager,
  HubGenerator,
} from './chunks';

// NPC system
export {
  // Roles and traits
  NPCRoleSchema,
  NPCDispositionSchema,
  NPCMetadataSchema,
  type NPCRole,
  type NPCDisposition,
  type NPCMetadata,

  // Generation context
  type NPCGenerationContext,

  // Generators
  NPCGenerator,
  NPCNameGenerator,
  NPCPopulator,
  type PopulationConfig,
} from './npc';

// NPC progression (skills, abilities, spells)
export {
  // Skill configuration
  NPC_ROLE_SKILLS,
  NPC_ROLE_ABILITIES,

  // Types
  type AbilityScores,
  type NPCLoreState,

  // Generators
  NPCStatGenerator,
  generateNPCLore,
} from './npc-progression';

// Hub internal graph
export {
  // Node types
  HubNodeTypeSchema,
  HubNodeSchema,
  type HubNodeType,
  type HubNode,

  // Edge types
  HubEdgeTypeSchema,
  HubEdgeSchema,
  type HubEdgeType,
  type HubEdge,

  // Graph
  HubGraph,
  HubGraphBuilder,
} from './graph';

// NPC scheduling
export {
  // Time
  type GameTime,
  TIME_PERIODS,
  getTimePeriod,

  // Location state
  NPCLocationStateSchema,
  type NPCLocationState,

  // Schedules
  type ScheduleSlot,
  ROLE_SCHEDULES,

  // Scheduler
  NPCScheduler,
  HubSimulator,
} from './scheduling';

// Hub ↔ World graph connection
export {
  // World routes
  WorldRouteTypeSchema,
  WorldRouteSchema,
  type WorldRouteType,
  type WorldRoute,

  // Entrance connections
  EntranceConnectionSchema,
  type EntranceConnection,

  // Hub world interface
  HubWorldInterfaceSchema,
  type HubWorldInterface,

  // Helper functions
  findEntranceForRoute,
  canEnterHub,
  calculateEntryToll,
  buildHubWorldInterface,
  getCaravanArrivalEntrance,
} from './world-connection';
