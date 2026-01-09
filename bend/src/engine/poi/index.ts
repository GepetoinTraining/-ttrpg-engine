// ============================================
// POINTS OF INTEREST (POI) SYSTEM
// ============================================
//
// POIs are WHERE adventures happen outside towns.
//
// This module provides:
//   - POI schemas and types
//   - Discovery state machine
//   - Rumor generation and propagation
//   - Respawn and degradation processing
//   - Bounty board system
//   - Economic impact calculation
//   - Trade route danger analysis
//   - Caravan raid simulation
//
// Core Philosophy:
//   - POIs are LIVING entities that evolve
//   - They affect the economy (routes, resources)
//   - They generate adventure hooks (bounties)
//   - They have consequences when cleared (claims, reputation)
//   - They GET WORSE if left unchecked (degradation)
//

// ============================================
// SCHEMA EXPORTS
// ============================================

export {
  // Type schemas
  POITypeSchema,
  POISubtypeSchema,
  POIDiscoveryStateSchema,
  POIDiscoveryMethodSchema,
  POIThreatLevelSchema,
  EncounterTypeSchema,
  POIControllerTypeSchema,
  DefenderStrengthSchema,
  RouteBlockageTypeSchema,
  DegradationRateSchema,
  FortificationLevelSchema,
  PatrolFrequencySchema,
  TreasureHoardTypeSchema,
  BountyProofTypeSchema,

  // Main POI schema
  POISchema,

  // Constants
  THREAT_LEVEL_CR,
  DEGRADATION_RATE_VALUES,
  POI_TYPE_DEFAULTS,
  STANDARD_DEGRADATION_EFFECTS,

  // Helper functions
  createPOI,
  shouldRespawn,
  daysUntilRespawn,
  escalateThreatLevel,

  // Types
  type POIType,
  type POISubtype,
  type POIDiscoveryState,
  type POIDiscoveryMethod,
  type POIThreatLevel,
  type EncounterType,
  type POIControllerType,
  type DefenderStrength,
  type RouteBlockageType,
  type DegradationRate,
  type FortificationLevel,
  type PatrolFrequency,
  type TreasureHoardType,
  type BountyProofType,
  type POI,
} from "./schema";

// ============================================
// ENGINE EXPORTS
// ============================================

export {
  // Rumor system
  POIRumorSchema,
  type POIRumor,

  // NPC knowledge
  getNPCPOIKnowledge,
  type NPCPOIKnowledge,

  // Discovery state machine
  canTransitionDiscovery,
  getDiscoveryStateFromAction,

  // Rumor generation
  generateRumors,
  type RumorGenerationContext,

  // Respawn processing
  processRespawns,
  type RespawnEvent,

  // Degradation processing
  processDegradation,
  type DegradationEvent,

  // POI lifecycle
  clearPOI,
  claimPOI,

  // World tick
  processPOITick,
  type POITickResult,
} from "./engine";

// ============================================
// BOUNTY EXPORTS
// ============================================

export {
  // Sponsor schemas
  BountySponsorTypeSchema,
  BountySponsorSchema,
  WEALTH_TIER_BUDGETS,

  // Bounty type schemas
  BountyTypeSchema,
  BASE_BOUNTY_REWARDS,

  // Legacy aliases (backwards compat)
  BountyObjectiveTypeSchema,
  BountyStatusSchema,
  BountyRewardTypeSchema,
  BountyIssuerTypeSchema,

  // Main schemas
  BountySchema,
  BountyBoardSchema,
  BountyProofSchema,
  BountyCompletionSchema,
  BountyGenerationContextSchema,

  // Types
  type BountySponsorType,
  type BountySponsor,
  type BountyType,
  type BountyObjectiveType,
  type BountyStatus,
  type BountyRewardType,
  type BountyIssuerType,
  type Bounty,
  type BountyBoard,
  type BountyProof,
  type BountyCompletion,
  type BountyGenerationContext,

  // Reward calculation
  calculateBountyReward,
  generateBountyWarnings,
  calculateGuildCut,

  // Bounty generation
  generateBountiesFromPOI,

  // Bounty lifecycle
  claimBounty,
  completeObjective,
  payBounty,
  failBounty,
  expireBounties,

  // AI prompts
  buildBountyPostingPrompt,
  buildBountyCompletionPrompt,
} from "./bounty";

// ============================================
// ECONOMICS EXPORTS
// ============================================

export {
  // Route danger
  calculateRouteDanger,
  type RouteDangerSource,
  type RouteDangerAnalysis,

  // Resource access
  calculateResourceAccess,
  type ResourceAccessAnalysis,

  // Caravan raids
  CaravanRaidEventSchema,
  simulateCaravanRaid,
  type CaravanRaidEvent,

  // Economic events
  POIEconomicEventSchema,
  generateEconomicEventsFromPOI,
  type POIEconomicEvent,

  // Clearing benefits
  calculateClearingBenefits,
  type ClearingBenefitAnalysis,

  // Market impacts
  propagateMarketImpacts,
  type MarketImpact,

  // Route profitability
  calculateRouteProfitability,
  type RouteProfitability,
} from "./economics";
