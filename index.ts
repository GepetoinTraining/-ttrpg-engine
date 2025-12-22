// ============================================
// TTRPG ENGINE - MASTER INDEX
// ============================================
//
// A complete engine for AI-powered tabletop RPGs
//
// ARCHITECTURE:
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │                         TTRPG ENGINE                                │
// ├─────────────────────────────────────────────────────────────────────┤
// │                                                                     │
// │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
// │  │     GRID      │  │     RULES     │  │   NARRATIVE   │           │
// │  │               │  │               │  │               │           │
// │  │ • Hex/Square  │  │ • Dice        │  │ • Campaign    │           │
// │  │ • Pathfinding │  │ • Combat      │  │ • Arcs/Quests │           │
// │  │ • Line of     │  │ • Creatures   │  │ • Beats       │           │
// │  │   Sight       │  │ • Conditions  │  │ • Sessions    │           │
// │  │ • AoE         │  │ • Actions     │  │ • Timeline    │           │
// │  │ • Tokens      │  │ • Spells      │  │               │           │
// │  └───────────────┘  └───────────────┘  └───────────────┘           │
// │         │                   │                   │                   │
// │         └───────────────────┼───────────────────┘                   │
// │                             │                                       │
// │  ┌───────────────┐  ┌──────┴────────┐  ┌───────────────┐           │
// │  │    REDIRECT   │  │    ASSETS     │  │     DEPTH     │           │
// │  │               │  │               │  │               │           │
// │  │ • ADHD Saver  │  │ • NPCs        │  │ • Rabbit Hole │           │
// │  │ • Hook Gen    │  │ • Locations   │  │ • Mini-Quests │           │
// │  │ • Weave Back  │  │ • Items       │  │ • Auto-Connect│           │
// │  │               │  │ • Factions    │  │ • Session Gen │           │
// │  │               │  │ • Quick Gen   │  │               │           │
// │  │               │  │ • Detail Lvls │  │               │           │
// │  └───────────────┘  └───────────────┘  └───────────────┘           │
// │                             │                                       │
// │                             ▼                                       │
// │  ┌─────────────────────────────────────────────────────────────┐   │
// │  │                     AI INTEGRATION                          │   │
// │  │                                                             │   │
// │  │  • Orchestrator (GM's omniscient companion)                 │   │
// │  │  • NPC Agents (bounded perspective, character voice)        │   │
// │  │  • Generation (hooks, NPCs, locations, encounters)          │   │
// │  │  • Memory (NPC memories, party knowledge, secrets)          │   │
// │  │  • Voice (STT → AI → TTS loop)                              │   │
// │  └─────────────────────────────────────────────────────────────┘   │
// │                                                                     │
// └─────────────────────────────────────────────────────────────────────┘
//

// ============================================
// GRID SYSTEM
// ============================================
// Spatial calculations, pathfinding, combat positioning

export {
  // Types
  SquareCoordSchema,
  HexCoordSchema,
  HexAxialSchema,
  CoordinateSchema,
  GridTypeSchema,
  GridConfigSchema,
  TerrainTypeSchema,
  CoverTypeSchema,
  CellSchema,
  SizeSchema,
  SizeToGridMap,
  TokenSchema,
  VisionTypeSchema,
  VisionSchema,
  LineOfSightResultSchema,
  MovementTypeSchema,
  PathNodeSchema,
  PathResultSchema,
  AoeShapeSchema,
  AreaOfEffectSchema,
  AoeResultSchema,
  // Type inference
  type SquareCoord,
  type HexCoord,
  type HexAxial,
  type Coordinate,
  type GridType,
  type GridConfig,
  type TerrainType,
  type CoverType,
  type Cell,
  type Size,
  type Token,
  type VisionType,
  type Vision,
  type LineOfSightResult,
  type MovementType,
  type PathNode,
  type PathResult,
  type AoeShape,
  type AreaOfEffect,
  type AoeResult,
} from "./grid/types";

export {
  // Coordinate utilities
  axialToCube,
  cubeToAxial,
  pixelToHexPointy,
  pixelToHexFlat,
  hexToPixelPointy,
  hexToPixelFlat,
  hexNeighbor,
  hexNeighbors,
  squareNeighbors,
  // Distance
  squareDistance,
  hexDistance,
  calculateDistance,
  // Line of sight
  getLine,
  checkLineOfSight,
  // Pathfinding
  findPath,
  // Area of Effect
  calculateAoE,
  // Rendering helpers
  cellToPixel,
  pixelToCell,
} from "./grid/math";

// ============================================
// RULES SYSTEM
// ============================================
// D&D 5e rules, dice, combat, creatures

export {
  // Dice
  DieTypeSchema,
  DieToMax,
  DiceExpressionSchema,
  RollResultSchema,
  RollModifierSchema,
  AdvantageStateSchema,
  parseDiceExpression,
  rollDice,
  rollD20,
  // Abilities
  AbilitySchema,
  AbilityScoresSchema,
  getAbilityModifier,
  // Skills
  SkillSchema,
  SkillToAbility,
  ProficiencyLevelSchema,
  SkillProficiencySchema,
  getProficiencyBonus,
  getSkillModifier,
  // Conditions
  ConditionSchema,
  ConditionInstanceSchema,
  ConditionEffects,
  // Damage
  DamageTypeSchema,
  DamageResistanceSchema,
  DamageInstanceSchema,
  HealingInstanceSchema,
  applyDamage,
  // Actions
  ActionTypeSchema,
  StandardActionSchema,
  ActionEconomySchema,
  ActionSchema,
  // Combat
  InitiativeEntrySchema,
  CombatStateSchema,
  AttackRollSchema,
  SavingThrowSchema,
  resolveAttack,
  resolveSavingThrow,
  // Type inference
  type DieType,
  type DiceExpression,
  type RollResult,
  type RollModifier,
  type AdvantageState,
  type Ability,
  type AbilityScores,
  type Skill,
  type ProficiencyLevel,
  type SkillProficiency,
  type Condition,
  type ConditionInstance,
  type DamageType,
  type DamageResistance,
  type DamageInstance,
  type HealingInstance,
  type ActionType,
  type StandardAction,
  type ActionEconomy,
  type Action,
  type InitiativeEntry,
  type CombatState,
  type AttackRoll,
  type SavingThrow,
} from "./rules/core";

export {
  // Creature types
  CreatureTypeSchema,
  AlignmentSchema,
  ChallengeRatingSchema,
  CRToXP,
  // Movement
  MovementSpeedsSchema,
  // Senses
  SensesSchema,
  // HP & AC
  HitPointsSchema,
  ArmorTypeSchema,
  ArmorClassSchema,
  calculateAC,
  // Saves & Skills
  SavingThrowProficienciesSchema,
  SkillProficienciesSchema,
  // Damage modifiers
  DamageModifiersSchema,
  ConditionImmunitiesSchema,
  // Features
  FeatureSchema,
  // Spellcasting
  SpellSchema,
  SpellSlotSchema,
  SpellcastingSchema,
  // Weapons
  WeaponPropertySchema,
  WeaponSchema,
  AttackSchema,
  // Legendary
  LegendaryActionsSchema,
  LairActionsSchema,
  // Full creature
  CreatureSchema,
  // Player character
  CharacterClassSchema,
  BackgroundSchema,
  PlayerCharacterSchema,
  // Helpers
  calculateProficiencyFromCR,
  calculateXPFromCR,
  createDefaultCreature,
  // Type inference
  type CreatureType,
  type Alignment,
  type ChallengeRating,
  type MovementSpeeds,
  type Senses,
  type HitPoints,
  type ArmorType,
  type ArmorClass,
  type SavingThrowProficiencies,
  type SkillProficiencies,
  type DamageModifiers,
  type ConditionImmunities,
  type Feature,
  type Spell,
  type SpellSlot,
  type Spellcasting,
  type WeaponProperty,
  type Weapon,
  type Attack,
  type LegendaryActions,
  type LairActions,
  type Creature,
  type CharacterClass,
  type Background,
  type PlayerCharacter,
} from "./rules/creature";

export {
  // Lair types
  LairTypeSchema,
  LairPhaseSchema,
  // Lair entity
  LairSchema,
  // Lair action selection
  LairActionSelectionSchema,
  // Alert events
  AlertEventSchema,
  // Lair turn
  LairTurnSchema,
  // AI prompt
  buildLairActionPrompt,
  // Standard content
  StandardLairActions,
  StandardTraps,
  // Type inference
  type LairType,
  type LairPhase,
  type Lair,
  type LairActionSelection,
  type AlertEvent,
  type LairTurn,
} from "./rules/lair";

// ============================================
// NARRATIVE SYSTEM
// ============================================
// Campaigns, arcs, quests, beats, sessions

export {
  // Objectives
  ObjectiveStatusSchema,
  ObjectiveSchema,
  // Beats
  BeatTypeSchema,
  BeatStatusSchema,
  BeatSchema,
  // Quests
  QuestTypeSchema,
  QuestSchema,
  // Arcs
  ArcTypeSchema,
  ArcStatusSchema,
  ArcSchema,
  // Campaign
  ProgressionTypeSchema,
  CampaignStatusSchema,
  CampaignSchema,
  // Sessions
  SessionStatusSchema,
  SessionSchema,
  // Timeline
  TimelineEntryTypeSchema,
  TimelineEntrySchema,
  // Helpers
  calculateProgress,
  // Type inference
  type ObjectiveStatus,
  type Objective,
  type BeatType,
  type BeatStatus,
  type Beat,
  type QuestType,
  type Quest,
  type ArcType,
  type ArcStatus,
  type Arc,
  type ProgressionType,
  type CampaignStatus,
  type Campaign,
  type SessionStatus,
  type Session,
  type TimelineEntryType,
  type TimelineEntry,
  type CampaignProgress,
} from "./narrative/story";

// ============================================
// REDIRECT SYSTEM (ADHD SAVER)
// ============================================
// Capture distractions, generate hooks, weave back

export {
  // Distraction
  DistractionTypeSchema,
  DistractionSchema,
  // Narrative threads
  NarrativeThreadSchema,
  RedirectContextSchema,
  // Hook generation
  HookTypeSchema,
  HookToneSchema,
  GeneratedHookSchema,
  // Requests
  RedirectRequestSchema,
  // Prompts
  buildRedirectPrompt,
  buildQuickRedirectPrompt,
  // Templates
  HookTemplates,
  // Outcomes
  RedirectOutcomeSchema,
  // Button states
  RedirectButtonStateSchema,
  // Type inference
  type DistractionType,
  type Distraction,
  type NarrativeThread,
  type RedirectContext,
  type HookType,
  type HookTone,
  type GeneratedHook,
  type RedirectRequest,
  type RedirectOutcome,
  type RedirectButtonState,
} from "./narrative/redirect";

// ============================================
// DEPTH SYSTEM (RABBIT HOLES)
// ============================================
// Escalating side content that always connects back

export {
  // Depth levels
  DepthLevelSchema,
  DepthEscalationTriggerSchema,
  // Rabbit hole
  RabbitHoleSchema,
  // Mini-quest
  MiniQuestSchema,
  // Generated content
  GeneratedNpcSchema,
  GeneratedLocationSchema,
  // Escalation
  DepthEscalationRequestSchema,
  DepthEscalationResponseSchema,
  buildDepthEscalationPrompt,
  // Session prep
  GeneratedSessionPrepSchema,
  // Import
  ImportToCampaignRequestSchema,
  // Helpers
  suggestNextDepth,
  // Type inference
  type DepthLevel,
  type DepthEscalationTrigger,
  type RabbitHole,
  type MiniQuest,
  type GeneratedNpc,
  type GeneratedLocation,
  type DepthEscalationRequest,
  type DepthEscalationResponse,
  type GeneratedSessionPrep,
  type ImportToCampaignRequest,
} from "./narrative/depth";

// ============================================
// ASSET SYSTEM
// ============================================
// Lazy-loaded worldbuilding with detail levels

export {
  // Detail levels
  DetailLevelSchema,
  DetailLevelRequirements,
  // Asset types
  AssetTypeSchema,
  // Base
  BaseAssetSchema,
  // NPC levels
  NpcStubSchema,
  NpcBasicSchema,
  NpcDevelopedSchema,
  NpcFullSchema,
  NpcIntegratedSchema,
  NpcAssetSchema,
  // Location levels
  LocationTypeSchema,
  LocationStubSchema,
  LocationBasicSchema,
  LocationDevelopedSchema,
  LocationFullSchema,
  LocationIntegratedSchema,
  LocationAssetSchema,
  // Item levels
  ItemRaritySchema,
  ItemStubSchema,
  ItemBasicSchema,
  ItemDevelopedSchema,
  ItemFullSchema,
  ItemIntegratedSchema,
  ItemAssetSchema,
  // Faction levels
  FactionStubSchema,
  FactionBasicSchema,
  FactionDevelopedSchema,
  FactionFullSchema,
  FactionIntegratedSchema,
  FactionAssetSchema,
  // Generation
  DetailGenerationRequestSchema,
  QuickSheetRequestSchema,
  buildDeepenPrompt,
  buildQuickSheetPrompt,
  // Type inference
  type DetailLevel,
  type AssetType,
  type BaseAsset,
  type NpcAsset,
  type LocationType,
  type LocationAsset,
  type ItemRarity,
  type ItemAsset,
  type FactionAsset,
  type DetailGenerationRequest,
  type QuickSheetRequest,
  type DeepenAssetResult,
} from "./assets/entity";

export {
  // Quick generation
  QuickNpcInputSchema,
  QuickNpcOutputSchema,
  QuickLocationInputSchema,
  QuickLocationOutputSchema,
  QuickLootInputSchema,
  QuickLootOutputSchema,
  QuickEncounterInputSchema,
  QuickEncounterOutputSchema,
  QuickRumorInputSchema,
  QuickRumorOutputSchema,
  // Prompts
  buildQuickNpcPrompt,
  buildQuickLocationPrompt,
  // Batch generation
  BatchNpcRequestSchema,
  BatchLocationRequestSchema,
  // Queue
  GenerationQueueItemSchema,
  // Auto-deepen
  AutoDeepenTriggerSchema,
  DefaultAutoDeepen,
  // Interaction tracking
  AssetInteractionSchema,
  checkDeepenSuggestion,
  // Type inference
  type QuickNpcInput,
  type QuickNpcOutput,
  type QuickLocationInput,
  type QuickLocationOutput,
  type QuickLootInput,
  type QuickLootOutput,
  type QuickEncounterInput,
  type QuickEncounterOutput,
  type QuickRumorInput,
  type QuickRumorOutput,
  type BatchNpcRequest,
  type BatchLocationRequest,
  type GenerationQueueItem,
  type AutoDeepenTrigger,
  type AssetInteraction,
} from "./assets/quickgen";

// ============================================
// SIMULATION MODULE (Meta-game between sessions)
// ============================================

export {
  // Resources
  ResourceTypeSchema,
  ResourceSchema,
  ResourcePoolSchema,
  // Downtime
  ActionCategorySchema,
  DowntimeActionTemplateSchema,
  QueuedActionSchema,
  DowntimePeriodSchema,
  StandardDowntimeActions,
  GmReviewQueueSchema,
  buildActionResolutionPrompt,
  // Type inference
  type ResourceType,
  type Resource,
  type ResourcePool,
  type ActionCategory,
  type DowntimeActionTemplate,
  type QueuedAction,
  type DowntimePeriod,
  type GmReviewQueue,
} from "./simulation/downtime";

export {
  // Followers
  FollowerTypeSchema,
  FollowerQualitySchema,
  FollowerStatusSchema,
  FollowerSchema,
  FollowerUnitSchema,
  FollowerCosts,
  QualityMultiplier,
  // Organizations
  OrganizationTypeSchema,
  OrganizationSchema,
  // Type inference
  type FollowerType,
  type FollowerQuality,
  type FollowerStatus,
  type Follower,
  type FollowerUnit,
  type OrganizationType,
  type Organization,
} from "./simulation/followers";

export {
  // Settlements
  SettlementSizeSchema,
  BuildingCategorySchema,
  BuildingSchema,
  StandardBuildings,
  SettlementSchema,
  SettlementEventSchema,
  TerritorySchema,
  SettlementActionTemplates,
  // Type inference
  type SettlementSize,
  type BuildingCategory,
  type Building,
  type Settlement,
  type SettlementEvent,
  type Territory,
} from "./simulation/settlements";

export {
  // Factions
  FactionSchema,
  SchemeTypeSchema,
  FactionSchemeSchema,
  FactionTurnSchema,
  PoliticalMapSchema,
  PoliticalSecretSchema,
  buildFactionTurnPrompt,
  // Type inference
  type Faction,
  type SchemeType,
  type FactionScheme,
  type FactionTurn,
  type PoliticalMap,
  type PoliticalSecret,
} from "./simulation/factions";

export {
  // Quality & Contributions
  ActionQualityTierSchema,
  QualityTierBonus,
  ActionContributionSchema,
  buildContributionEvalPrompt,
  // Session Diaries
  SessionDiarySchema,
  buildDiaryProcessingPrompt,
  // Ability Leverage
  AbilityLeverageSchema,
  calculateAbilityLeverage,
  calculateFollowerCapacity,
  // Rewards & Tracking
  ContributionRewardSchema,
  PlayerEngagementSchema,
  // Type inference
  type ActionQualityTier,
  type ActionContribution,
  type SessionDiary,
  type AbilityLeverage,
  type ContributionReward,
  type PlayerEngagement,
} from "./simulation/contributions";

export {
  // Resources & Commodities
  ResourceCategorySchema,
  CommoditySchema,
  StandardCommodities,
  // Markets
  MarketPriceSchema,
  SettlementMarketSchema,
  // Trade Routes
  TradeRouteSchema,
  // Economic Events
  EconomicEventTypeSchema,
  EconomicEventSchema,
  // Settlement Economy
  SettlementEconomySchema,
  // World Economy
  WorldEconomySchema,
  // Simulation
  simulateEconomicTick,
  calculatePrice,
  calculateRippleEffects,
  // Player Actions
  PlayerEconomicActionSchema,
  processPlayerAction,
  // News
  generateEconomicNews,
  // Multi-party
  MultiPartySyncSchema,
  // AI Prompts
  buildEconomicSimulationPrompt,
  buildEconomicNewsPrompt,
  // Type inference
  type ResourceCategory,
  type Commodity,
  type MarketPrice,
  type SettlementMarket,
  type TradeRoute,
  type EconomicEventType,
  type EconomicEvent,
  type SettlementEconomy,
  type WorldEconomy,
  type PlayerEconomicAction,
  type MultiPartySync,
} from "./simulation/economy";

// ============================================
// SESSION MODULE (Live at-the-table play)
// ============================================

export {
  // Card types
  CardTypeSchema,
  VisibilitySchema,
  ContentLayerSchema,
  SceneCardSchema,
  // Specialized cards
  CombatCardSchema,
  DowntimeRevealCardSchema,
  LootCardSchema,
  // Live session
  LiveSessionSchema,
  // Dice
  DiceRollRequestSchema,
  DiceRollResultSchema,
  // Views
  PlayerViewSchema,
  GmControlPanelSchema,
  // Builder
  SessionBuilderSchema,
  // End
  SessionEndSchema,
  // Inventory
  PartyInventorySchema,
  // Type inference
  type CardType,
  type Visibility,
  type ContentLayer,
  type SceneCard,
  type CombatCard,
  type DowntimeRevealCard,
  type LootCard,
  type LiveSession,
  type DiceRollRequest,
  type DiceRollResult,
  type PlayerView,
  type GmControlPanel,
  type SessionBuilder,
  type SessionEnd,
  type PartyInventory,
} from "./session/live";

// ============================================
// PUZZLE MODULE (Interactive puzzles)
// ============================================

export {
  // Types
  PuzzleTypeSchema,
  PuzzleDifficultySchema,
  PuzzleElementTypeSchema,
  PuzzleElementSchema,
  // Hints
  PuzzleHintSchema,
  // Solutions
  PuzzleSolutionSchema,
  // Rewards
  PuzzleRewardSchema,
  // Main puzzle
  PuzzleSchema,
  // Templates
  PuzzleTemplates,
  // HTML/React generation
  generatePuzzleHTML,
  generatePuzzleReact,
  // AI generation
  buildPuzzleGenerationPrompt,
  // Type inference
  type PuzzleType,
  type PuzzleDifficulty,
  type PuzzleElementType,
  type PuzzleElement,
  type PuzzleHint,
  type PuzzleSolution,
  type PuzzleReward,
  type Puzzle,
} from "./puzzle/builder";

// ============================================
// MANAGER MODULE (CRUD for all entities)
// ============================================

export {
  // Entity types
  EntityTypeSchema,
  // Permissions
  PermissionLevelSchema,
  EntityPermissionSchema,
  DefaultPermissions,
  // Query system
  QueryOperatorSchema,
  QueryConditionSchema,
  QuerySchema,
  // Change tracking
  ChangeTypeSchema,
  ChangeRecordSchema,
  // CRUD operations
  CreateOperationSchema,
  ReadOperationSchema,
  UpdateOperationSchema,
  DeleteOperationSchema,
  BatchOperationSchema,
  OperationResultSchema,
  // Managers
  CharacterSummarySchema,
  CharacterManagerSchema,
  PartySummarySchema,
  PartyManagerSchema,
  SettlementSummarySchema,
  SettlementManagerSchema,
  ResourceSummarySchema,
  ResourceManagerSchema,
  FollowerSummarySchema,
  FollowerManagerSchema,
  SystemsManagerSchema,
  // Dashboards
  PlayerDashboardSchema,
  GmDashboardSchema,
  // Standard queries
  StandardQueries,
  // Type inference
  type EntityType,
  type PermissionLevel,
  type EntityPermission,
  type QueryOperator,
  type QueryCondition,
  type Query,
  type ChangeType,
  type ChangeRecord,
  type CreateOperation,
  type ReadOperation,
  type UpdateOperation,
  type DeleteOperation,
  type BatchOperation,
  type OperationResult,
  type CharacterSummary,
  type CharacterManager,
  type PartySummary,
  type PartyManager,
  type SettlementSummary,
  type SettlementManager,
  type ResourceSummary,
  type ResourceManager,
  type FollowerSummary,
  type FollowerManager,
  type SystemsManager,
  type PlayerDashboard,
  type GmDashboard,
  type EntityManagerAPI,
} from "./manager/entity";

// ============================================
// INTELLIGENCE LAYER (AI Agents & Grounding)
// ============================================

export {
  // Agent types
  AgentTypeSchema,
  // Identity
  IdentityAnchorSchema,
  // Knowledge
  KnowledgeBoundarySchema,
  // Memory
  MemoryTypeSchema,
  MemorySchema,
  MemoryQuerySchema,
  // Context
  ContextSectionSchema,
  ContextBudgetSchema,
  ContextWindowSchema,
  // Agent state
  AgentStateSchema,
  // Context assembly
  assembleContext,
  // Prompt builders
  buildIdentityPrompt,
  buildSituationPrompt,
  buildKnowledgePrompt,
  buildRelationshipsPrompt,
  buildGoalsPrompt,
  buildConstraintsPrompt,
  // Orchestrator
  OrchestratorConfigSchema,
  OrchestratorStateSchema,
  routeMessage,
  // Templates
  IdentityTemplates,
  // Voice
  VoiceConsistencySchema,
  verifyGrounding,
  // Multi-agent
  MultiAgentConversationSchema,
  // Generation
  buildAgentGenerationPrompt,
  // Type inference
  type AgentType,
  type IdentityAnchor,
  type KnowledgeBoundary,
  type MemoryType,
  type Memory,
  type MemoryQuery,
  type ContextSection,
  type ContextBudget,
  type ContextWindow,
  type AgentState,
  type OrchestratorConfig,
  type OrchestratorState,
  type VoiceConsistency,
  type MultiAgentConversation,
} from "./intelligence/agent";

// ============================================
// ENGINE SUMMARY
// ============================================
//
// CORE FEATURES:
//
// 1. GRID ENGINE
//    - Hex & square grids with proper math
//    - A* pathfinding with opportunity attacks
//    - Line of sight & cover calculations
//    - Area of effect (cone, sphere, cube, line)
//    - Token management for all creature sizes
//
// 2. RULES ENGINE (5e SRD Compatible)
//    - Complete dice system with advantage/disadvantage
//    - Full ability score & skill system
//    - All conditions with mechanical effects
//    - Action economy tracking
//    - Combat resolution (attacks, saves, damage)
//    - Complete creature stat blocks
//    - Player character support with classes & backgrounds
//    - Spellcasting system with slots
//
// 3. NARRATIVE ENGINE
//    - Campaign → Arc → Quest → Beat hierarchy
//    - Session management with timeline overlay
//    - Story progression tracking
//    - Milestone & XP systems
//
// 4. REDIRECT SYSTEM (Party ADHD GM Saver)
//    - Capture player distractions
//    - Generate contextual hooks
//    - Weave random elements into main plot
//    - Track what worked for learning
//
// 5. DEPTH SYSTEM (Rabbit Holes)
//    - Escalating side content
//    - Auto-generated mini-quests
//    - NPCs & locations created on demand
//    - Always connects back to main narrative
//    - Session prep generation
//    - Import to permanent campaign content
//
// 6. ASSET SYSTEM (Lazy Worldbuilding)
//    - Five detail levels: Stub → Basic → Developed → Full → Integrated
//    - NPCs, Locations, Items, Factions
//    - Quick generation for immediate needs
//    - Deepen on demand as importance grows
//    - Auto-deepen triggers based on usage
//    - Interaction tracking
//
// DESIGNED FOR:
// - AI Orchestrator (omniscient GM companion)
// - AI NPC Agents (bounded perspective characters)
// - Voice integration (STT/TTS loop)
// - Real-time session support
// - Post-session content generation
//
// PHILOSOPHY:
// - Story is structure, sessions are when you touched it
// - Every rabbit hole leads back to the main road
// - Everything starts as a stub, depth on demand
// - AI enhances, never replaces the human GM
// - Player chaos becomes narrative opportunity
//
