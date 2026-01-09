import { z } from 'zod';
import { MerchantTierSchema } from '../../markets/schema';

// ============================================
// TOP-END ECONOMY: SERVICES TYPE SYSTEM
// ============================================
//
// Services are the core abstraction:
// - Everything is a service (banking, PMC, legal, logistics)
// - Pricing is deterministic and derived
// - Contracts are formal with clear lifecycle
// - Power never erases consequences
//
// Invariants:
// - No global mutable state
// - Delta-driven truth
// - Observation-scoped simulation
// - NPC time slots consumed by execution
//

// ============================================
// SERVICE TYPES
// ============================================

export const ServiceTypeSchema = z.enum([
  // Banking services
  'banking_custody',        // Secure storage of valuables
  'loan',                   // Money lending
  'escrow',                 // Third-party holding
  'guarantee',              // Backing another's obligation
  'insurance',              // Risk transfer

  // Private Military Company (PMC)
  'pmc_escort',             // Travel protection
  'pmc_retainer',           // On-call security
  'pmc_security',           // Fixed location protection
  'pmc_enforcement',        // Contract enforcement

  // Legal services
  'legal_representation',   // Advocacy in disputes
  'legal_arbitration',      // Dispute resolution
  'legal_notary',           // Document authentication
  'legal_investigation',    // Fact-finding

  // Logistics services
  'logistics_coordination', // Route planning and management
  'logistics_storage',      // Warehousing
  'logistics_transport',    // Moving goods

  // Artisan services
  'artisan_craft',          // Creating items
  'artisan_repair',         // Fixing items
  'artisan_enchant',        // Adding magical properties

  // Discretion services
  'discretion_service',     // Confidential handling
  'information_brokering',  // Buying/selling secrets
  'anonymity_service',      // Identity protection
]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

// ============================================
// PROVIDER TYPES
// ============================================

export const ProviderTypeSchema = z.enum([
  'bank',
  'pmc',
  'legal',
  'logistics',
  'artisan',
  'discretion',
  'temple',
  'guild',
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// Which services each provider type can offer
export const PROVIDER_SERVICE_CATALOG: Record<ProviderType, ServiceType[]> = {
  bank: [
    'banking_custody',
    'loan',
    'escrow',
    'guarantee',
    'insurance',
  ],
  pmc: [
    'pmc_escort',
    'pmc_retainer',
    'pmc_security',
    'pmc_enforcement',
  ],
  legal: [
    'legal_representation',
    'legal_arbitration',
    'legal_notary',
    'legal_investigation',
    'guarantee',
  ],
  logistics: [
    'logistics_coordination',
    'logistics_storage',
    'logistics_transport',
    'insurance',
  ],
  artisan: [
    'artisan_craft',
    'artisan_repair',
    'artisan_enchant',
  ],
  discretion: [
    'discretion_service',
    'information_brokering',
    'anonymity_service',
  ],
  temple: [
    'banking_custody',
    'escrow',
    'legal_arbitration',
    'guarantee',
  ],
  guild: [
    'legal_representation',
    'guarantee',
    'artisan_craft',
    'artisan_repair',
  ],
};

// ============================================
// URGENCY LEVELS
// ============================================

export const UrgencySchema = z.enum([
  'routine',    // Normal processing, standard price
  'priority',   // +50% cost, faster execution
  'emergency',  // +200% cost, immediate execution
]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const URGENCY_MULTIPLIERS: Record<Urgency, number> = {
  routine: 1.0,
  priority: 1.5,
  emergency: 3.0,
};

export const URGENCY_SLOT_PRIORITY: Record<Urgency, number> = {
  routine: 0,     // Normal queue
  priority: 1,    // Skip routine queue
  emergency: 2,   // Immediate, may interrupt
};

// ============================================
// CONTRACT STATUS
// ============================================

export const ContractStatusSchema = z.enum([
  'proposed',   // Quote given, not yet accepted
  'active',     // In progress
  'completed',  // Successfully finished
  'failed',     // Execution failed
  'cancelled',  // Terminated before completion
]);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

// ============================================
// ENTITY REFERENCE
// ============================================

export const EntityTypeSchema = z.enum([
  'npc',
  'character',
  'party',
  'faction',
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntityRefSchema = z.object({
  entityId: z.string().uuid(),
  entityType: EntityTypeSchema,
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

// ============================================
// VISIBILITY POLICY
// ============================================

export const VisibilityPolicySchema = z.object({
  public: z.boolean().default(true),
  visibleTo: z.array(z.string().uuid()).default([]),
  hiddenFrom: z.array(z.string().uuid()).default([]),
});
export type VisibilityPolicy = z.infer<typeof VisibilityPolicySchema>;

// ============================================
// OPERATING HOURS
// ============================================

export const OperatingHoursSchema = z.object({
  openSlot: z.number().int().min(0).max(47).default(16),   // ~8am (slot 16 of 48)
  closeSlot: z.number().int().min(0).max(47).default(36),  // ~6pm (slot 36 of 48)
  daysActive: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5]), // Mon-Sat
});
export type OperatingHours = z.infer<typeof OperatingHoursSchema>;

// ============================================
// SERVICE PROVIDER
// ============================================

export const ServiceProviderSchema = z.object({
  id: z.string().uuid(),
  hubId: z.string().uuid(),

  // Operator (mutually exclusive)
  npcId: z.string().uuid().optional(),
  factionId: z.string().uuid().optional(),

  providerType: ProviderTypeSchema,
  merchantTier: MerchantTierSchema,

  fameScore: z.number().int().min(0).max(100).default(0),
  capitalGp: z.number().min(0).default(0),

  licenses: z.array(z.string()).default([]),
  offeredServices: z.array(ServiceTypeSchema).default([]),
  operatingHours: OperatingHoursSchema.default({}),

  status: z.enum(['active', 'suspended', 'closed', 'bankrupt']).default('active'),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type ServiceProvider = z.infer<typeof ServiceProviderSchema>;

// ============================================
// SERVICE SCOPE
// ============================================

export const ServiceScopeSchema = z.object({
  hubIds: z.array(z.string().uuid()).optional(),
  routeIds: z.array(z.string().uuid()).optional(),
  entityIds: z.array(z.string().uuid()).optional(),
  description: z.string().optional(),
});
export type ServiceScope = z.infer<typeof ServiceScopeSchema>;

// ============================================
// EXECUTION METADATA
// ============================================

export const ExecutionMetadataSchema = z.object({
  slotsConsumed: z.number().int().min(0).default(0),
  executorNpcId: z.string().uuid().optional(),
  executionNotes: z.array(z.string()).default([]),
});
export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;

// ============================================
// CONTRACT OUTCOME
// ============================================

export const ContractOutcomeSchema = z.object({
  success: z.boolean(),
  outcome: z.string(),
  deltasWritten: z.array(z.string().uuid()).default([]),
});
export type ContractOutcome = z.infer<typeof ContractOutcomeSchema>;

// ============================================
// SERVICE CONTRACT
// ============================================

export const ServiceContractSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  providerId: z.string().uuid(),

  clientEntityId: z.string().uuid(),
  clientEntityType: EntityTypeSchema,

  serviceType: ServiceTypeSchema,
  scope: ServiceScopeSchema.default({}),

  startTime: z.string(),  // WorldTimestamp JSON
  endTime: z.string().optional(),

  urgency: UrgencySchema.default('routine'),
  visibilityPolicy: VisibilityPolicySchema.default({ public: true }),

  status: ContractStatusSchema.default('proposed'),

  baseQuoteGp: z.number().min(0),
  finalCostGp: z.number().min(0).optional(),

  executionMetadata: ExecutionMetadataSchema.default({}),
  outcome: ContractOutcomeSchema.optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type ServiceContract = z.infer<typeof ServiceContractSchema>;

// ============================================
// RISK CONTRACT (Insurance)
// ============================================

export const CoveredEventTypeSchema = z.enum([
  'cargo_loss',
  'route_attack',
  'theft',
  'fire',
  'flood',
  'death',
  'injury',
  'contract_default',
  'political_seizure',
  'magical_accident',
]);
export type CoveredEventType = z.infer<typeof CoveredEventTypeSchema>;

export const ExclusionSchema = z.object({
  eventType: CoveredEventTypeSchema,
  conditions: z.string(),
});
export type Exclusion = z.infer<typeof ExclusionSchema>;

export const CollateralItemSchema = z.object({
  assetType: z.string(),
  assetId: z.string().uuid(),
  value: z.number().min(0),
  heldBy: z.string().uuid().optional(),
});
export type CollateralItem = z.infer<typeof CollateralItemSchema>;

export const ClaimSchema = z.object({
  claimId: z.string().uuid(),
  eventType: CoveredEventTypeSchema,
  amount: z.number().min(0),
  status: z.enum(['pending', 'approved', 'denied', 'paid']),
  filedAt: z.string(),
  resolvedAt: z.string().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const RiskContractSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  providerId: z.string().uuid(),

  clientEntityId: z.string().uuid(),
  clientEntityType: EntityTypeSchema,

  coveredEventTypes: z.array(CoveredEventTypeSchema),
  coverageLimitGp: z.number().min(0),
  premiumGp: z.number().min(0),

  exclusions: z.array(ExclusionSchema).default([]),
  collateral: z.array(CollateralItemSchema).default([]),

  startTime: z.string(),
  endTime: z.string(),

  status: z.enum(['active', 'expired', 'cancelled', 'claimed_out']).default('active'),
  claims: z.array(ClaimSchema).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type RiskContract = z.infer<typeof RiskContractSchema>;

// ============================================
// GUARANTEE CONTRACT
// ============================================

export const CoveredContractTypeSchema = z.enum([
  'service_contract',
  'loan',
  'trade',
  'custom',
]);
export type CoveredContractType = z.infer<typeof CoveredContractTypeSchema>;

export const FailureTypeSchema = z.object({
  failureType: z.string(),
  description: z.string(),
});
export type FailureType = z.infer<typeof FailureTypeSchema>;

export const EnforcementMethodSchema = z.enum([
  'payment',      // Guarantor pays beneficiary
  'seizure',      // Guarantor seizes obligor's collateral
  'legal_action', // Creates legal service contract
  'pmc_action',   // Creates PMC service contract
]);
export type EnforcementMethod = z.infer<typeof EnforcementMethodSchema>;

export const TriggerMetadataSchema = z.object({
  triggeredAt: z.string(),
  reason: z.string(),
  enforcementContractId: z.string().uuid().optional(),
});
export type TriggerMetadata = z.infer<typeof TriggerMetadataSchema>;

export const GuaranteeContractSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  guarantorProviderId: z.string().uuid(),

  coveredContractId: z.string().uuid(),
  coveredContractType: CoveredContractTypeSchema,

  obligorEntityId: z.string().uuid(),
  obligorEntityType: EntityTypeSchema,

  beneficiaryEntityId: z.string().uuid(),
  beneficiaryEntityType: EntityTypeSchema,

  coveredFailures: z.array(FailureTypeSchema).default([]),
  guaranteeLimitGp: z.number().min(0),

  enforcementMethod: EnforcementMethodSchema,
  collateral: z.array(CollateralItemSchema).default([]),

  visibilityPolicy: VisibilityPolicySchema.default({ public: false }),
  expirationTime: z.string(),

  status: z.enum(['active', 'expired', 'triggered', 'released']).default('active'),
  triggerMetadata: TriggerMetadataSchema.optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type GuaranteeContract = z.infer<typeof GuaranteeContractSchema>;

// ============================================
// SERVICE QUOTE
// ============================================

export const ServiceQuoteSchema = z.object({
  providerId: z.string().uuid(),
  serviceType: ServiceTypeSchema,

  // Pricing breakdown
  baseCostGp: z.number().min(0),
  tierPremium: z.number(),
  famePremium: z.number(),
  urgencyMultiplier: z.number(),
  riskPremium: z.number(),
  hubModifier: z.number(),
  scopeMultiplier: z.number(),

  // Final quote
  totalQuoteGp: z.number().min(0),

  // Time estimate
  estimatedSlots: z.number().int().min(1),
  estimatedStartSlot: z.number().int().min(0).optional(),

  // Quote validity (WorldTimestamp JSON)
  validUntil: z.string(),

  // Metadata for transparency
  quotedAt: z.string(),
  quotedBy: z.string().uuid().optional(),
});
export type ServiceQuote = z.infer<typeof ServiceQuoteSchema>;

// ============================================
// SERVICE EXECUTION RESULT
// ============================================

export const ServiceExecutionResultSchema = z.object({
  contractId: z.string().uuid(),
  success: z.boolean(),

  // What happened
  outcome: z.string(),
  actions: z.array(z.string()).default([]),

  // Time consumed
  slotsConsumed: z.number().int().min(0),
  executorNpcId: z.string().uuid(),

  // Deltas written (all outcomes go through writeDelta)
  deltasWritten: z.array(z.string().uuid()).default([]),

  // Final cost (may differ from quote due to complications)
  actualCostGp: z.number().min(0),

  // Execution window (WorldTimestamp JSON)
  executedAt: z.string(),
  completedAt: z.string(),
});
export type ServiceExecutionResult = z.infer<typeof ServiceExecutionResultSchema>;

// ============================================
// EXECUTION LOG ENTRY
// ============================================

export const ExecutionLogEntrySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  serviceContractId: z.string().uuid(),
  executorNpcId: z.string().uuid(),

  slotStart: z.string(),  // WorldTimestamp JSON
  slotEnd: z.string(),
  slotsConsumed: z.number().int().min(1),

  executionResult: z.object({
    actions: z.array(z.string()).default([]),
    outcome: z.string(),
    deltasWritten: z.array(z.string().uuid()).default([]),
  }),

  success: z.boolean().default(true),
  createdAt: z.string(),
});
export type ExecutionLogEntry = z.infer<typeof ExecutionLogEntrySchema>;

// ============================================
// TIER-BASED CAPABILITY GATES
// ============================================

import type { MerchantTier } from '../../markets/schema';

// Minimum tier required to offer each service
export const SERVICE_TIER_GATES: Record<ServiceType, MerchantTier> = {
  // Banking - high trust required
  banking_custody: 'shop',
  loan: 'emporium',
  escrow: 'shop',
  guarantee: 'trading_house',
  insurance: 'trading_house',

  // PMC - scales with capability
  pmc_escort: 'stall',
  pmc_retainer: 'shop',
  pmc_security: 'emporium',
  pmc_enforcement: 'trading_house',

  // Legal - needs credibility
  legal_representation: 'shop',
  legal_arbitration: 'emporium',
  legal_notary: 'stall',
  legal_investigation: 'shop',

  // Logistics - scales with infrastructure
  logistics_coordination: 'shop',
  logistics_storage: 'stall',
  logistics_transport: 'shop',

  // Artisan - skill-based
  artisan_craft: 'stall',
  artisan_repair: 'peddler',
  artisan_enchant: 'emporium',

  // Discretion - trust-based
  discretion_service: 'shop',
  information_brokering: 'emporium',
  anonymity_service: 'trading_house',
};

// Maximum contract value by tier (as multiple of capital)
export const TIER_CONTRACT_LIMITS: Record<MerchantTier, number> = {
  peddler: 0.5,       // Can handle 50% of capital per contract
  stall: 0.75,
  shop: 1.0,          // Can handle up to 100% of capital
  emporium: 1.5,
  trading_house: 2.0, // Can leverage up to 2x capital
  consortium: 3.0,
  megamart: 5.0,
};

// Fame thresholds for premium services
export const FAME_THRESHOLDS = {
  trusted: 25,        // Basic trust
  reputable: 50,      // Good reputation
  renowned: 75,       // Well-known excellence
  legendary: 90,      // Top of field
} as const;
