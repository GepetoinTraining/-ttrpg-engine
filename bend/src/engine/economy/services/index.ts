/**
 * TOP-END ECONOMY: SERVICES MODULE
 *
 * Services are the core abstraction where:
 * - Banking, PMC, Legal, Logistics, Artisan are all service providers
 * - Pricing is deterministic and derived
 * - Guarantees/risk contracts are formal contracts
 * - NPC time slots are consumed by execution
 *
 * Non-negotiable invariants:
 * - No global mutable state
 * - Delta-driven truth (all changes via writeDelta)
 * - Observation-scoped simulation (run only when queried)
 * - Power never erases consequences (only delay/reassign/concentrate)
 * - NPCs are first-class agents with schedules
 */

// ============================================
// TYPES
// ============================================

export {
  // Core types
  type ServiceType,
  type ProviderType,
  type Urgency,
  type ContractStatus,
  type EntityType,
  type EntityRef,
  type VisibilityPolicy,
  type OperatingHours,
  type ServiceScope,
  type ExecutionMetadata,
  type ContractOutcome,

  // Contract types
  type ServiceProvider,
  type ServiceContract,
  type RiskContract,
  type GuaranteeContract,
  type ServiceQuote,
  type ServiceExecutionResult,
  type ExecutionLogEntry,

  // Supporting types
  type CoveredEventType,
  type Exclusion,
  type CollateralItem,
  type Claim,
  type CoveredContractType,
  type FailureType,
  type EnforcementMethod,
  type TriggerMetadata,

  // Schemas
  ServiceTypeSchema,
  ProviderTypeSchema,
  UrgencySchema,
  ContractStatusSchema,
  EntityTypeSchema,
  ServiceProviderSchema,
  ServiceContractSchema,
  RiskContractSchema,
  GuaranteeContractSchema,
  ServiceQuoteSchema,

  // Constants
  PROVIDER_SERVICE_CATALOG,
  URGENCY_MULTIPLIERS,
  SERVICE_TIER_GATES,
  TIER_CONTRACT_LIMITS,
  FAME_THRESHOLDS,
} from './types';

// ============================================
// PRICING
// ============================================

export {
  // Base costs and modifiers
  SERVICE_BASE_COSTS,
  TIER_PRICE_MODIFIERS,
  SERVICE_INHERENT_RISK,
  SERVICE_BASE_SLOTS,

  // Pricing functions
  calculateServiceQuote,
  calculateFullServiceQuote,
  calculateFameModifier,
  calculateFameMultiplier,
  calculateRiskPremium,
  calculateHubModifier,
  calculateScopeMultiplier,
  calculateInsurancePremium,
  calculateGuaranteeFee,
  calculateIOCost,
  calculateTimeSlotCost,
  estimateTimeSlots,
  checkProviderCapability,

  // Guarantee eligibility
  type GuaranteeCapability,
  canIssueGuarantees,
  validateGuaranteeEligibility,
  GUARANTEE_CAPABILITY_LIMITS,

  // Hub economic ceiling
  type HubPricingContext,
  type HubEconomicSignals,
  type ScheduleScarcityContext,
  deriveHubEconomicCeiling,
  isTierSupportedByHub,
} from './pricing';

// ============================================
// CONTRACTS
// ============================================

export {
  // Service contracts
  type CreateServiceContractInput,
  createServiceContract,
  activateContract,
  completeContract,
  cancelContract,
  getServiceContract,
  getProviderActiveContracts,
  getClientContracts,

  // Risk contracts (insurance)
  type CreateRiskContractInput,
  createRiskContract,
  fileClaim,
  getRiskContract,

  // Guarantee contracts
  type CreateGuaranteeContractInput,
  createGuaranteeContract,
  triggerGuarantee,
  getGuaranteeContract,
  findGuaranteesForContract,
} from './contracts';

// ============================================
// PROVIDERS
// ============================================

export {
  // Provider management
  type CreateProviderInput,
  createProvider,
  getProvider,
  getProviderByNpc,
  getProvidersInHub,
  findProvidersForService,
  findProvidersByType,

  // Provider updates
  updateProviderCapital,
  updateProviderFame,
  upgradeProviderTier,
  suspendProvider,
  reactivateProvider,

  // Provider capabilities
  getProviderContractLimit,
  canHandleContract,
  getProviderFameTier,
  calculateFameGain,

  // Provider queries
  getTopProviders,
  findUpgradeReadyProviders,
} from './providers';

// ============================================
// EXECUTION
// ============================================

export {
  // Time reservation
  type TimeReservation,
  reserveProviderTime,
  releaseProviderTime,
  isProviderAvailable,
  getProviderNextAvailable,

  // Scheduling
  type ScheduleExecutionInput,
  checkNpcAvailability,
  scheduleExecution,

  // Execution
  type ExecuteServiceInput,
  executeService,
  handleServiceFailure,
  logPartialExecution,

  // Logging
  logExecution,
  getExecutionLogs,
  getTotalSlotsConsumed,

  // Workload queries
  getNpcWorkload,
  getAvailableNpcs,
} from './execution';

// ============================================
// EVENTS
// ============================================

export {
  // Canonical delta types
  ServiceDeltaType,

  // Event types
  ServiceEventTypeSchema,
  type ServiceEventType,
  ServiceEventSchema,
  type ServiceEvent,

  // Event handling
  type HandleCoveredEventInput,
  handleCoveredEvent,
  handleContractFailure,
  findCoveringInsurance,
  findActiveGuarantees,

  // Claim processing
  type ProcessClaimInput,
  processClaim,

  // Provider events
  emitProviderEvent,

  // Consequences
  ConsequenceTypeSchema,
  type ConsequenceType,
  ConsequenceSchema,
  type Consequence,
  calculateConsequences,
  createConsequence,
  mitigateConsequence,

  // Event queries
  type EventQuery,
  findEvents,
} from './events';
