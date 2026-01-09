/**
 * SOCIAL CONTRACT ENGINE - Schema
 *
 * The obligation graph - what binds people together.
 *
 * Core concepts:
 * 1. Contracts - edges in the social graph (marriage, oaths, vassalage)
 * 2. Households - durable social/economic units
 * 3. Kinship - family relationships with legitimacy
 * 4. Titles - inheritable positions of power
 * 5. Jurisdictions - who enforces what, where
 */

import { z } from 'zod';

// ============================================
// CONTRACT TYPES
// ============================================

export const ContractTypeSchema = z.enum([
  // Personal/Family
  'marriage',
  'betrothal',
  'adoption',
  'guardianship',
  'concubinage',

  // Service/Labor
  'apprenticeship',
  'employment',
  'indenture',
  'slavery',

  // Feudal/Political
  'vassalage',
  'fealty',
  'homage',
  'hostage',
  'alliance',
  'truce',
  'peace_treaty',

  // Religious
  'holy_vow',
  'ordination',
  'excommunication',
  'sanctuary',

  // Economic
  'trade_partnership',
  'guild_membership',
  'loan',
  'debt',
  'land_lease',
  'merchant_license',

  // Oaths
  'oath_of_service',
  'blood_oath',
  'geas',
  'promise',

  // Criminal/Informal
  'protection_racket',
  'blackmail',
  'blood_debt',
]);
export type ContractType = z.infer<typeof ContractTypeSchema>;

// ============================================
// CONTRACT PARTY
// ============================================

export const ContractPartySchema = z.object({
  entityType: z.enum(['character', 'faction', 'household', 'deity']),
  entityId: z.string().uuid(),
  entityName: z.string().optional(),

  // Role in the contract
  role: z.string(),
  // Examples: spouse, patron, client, master, apprentice, lord, vassal,
  // creditor, debtor, guarantor, witness

  // Did they consent?
  consented: z.boolean().default(true),
  consentedAt: z.string().optional(),

  // Can they exit voluntarily?
  canExit: z.boolean().default(false),
  exitConditions: z.array(z.string()).default([]),
});
export type ContractParty = z.infer<typeof ContractPartySchema>;

// ============================================
// CONTRACT TERMS
// ============================================

export const ContractTermsSchema = z.object({
  // Duration
  durationType: z.enum(['perpetual', 'fixed', 'conditional', 'until_death']).default('perpetual'),
  durationDays: z.number().int().optional(),
  endCondition: z.string().optional(),

  // Obligations (what each party must do)
  obligations: z.array(z.object({
    partyRole: z.string(),
    obligation: z.string(),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly', 'ongoing']).default('ongoing'),
    measurable: z.boolean().default(false),
    measureType: z.string().optional(),
    measureTarget: z.number().optional(),
  })).default([]),

  // Rights (what each party gains)
  rights: z.array(z.object({
    partyRole: z.string(),
    right: z.string(),
    exclusive: z.boolean().default(false),
  })).default([]),

  // Conditions for validity
  validityConditions: z.array(z.string()).default([]),

  // Breach definitions
  breachConditions: z.array(z.object({
    condition: z.string(),
    severity: z.enum(['minor', 'major', 'total']),
    penalty: z.string().optional(),
  })).default([]),

  // Termination clauses
  terminationClauses: z.array(z.object({
    trigger: z.string(),
    initiatedBy: z.string(), // party role or 'either' or 'jurisdiction'
    consequences: z.array(z.string()).default([]),
  })).default([]),

  // Special provisions
  provisions: z.record(z.string(), z.any()).default({}),
});
export type ContractTerms = z.infer<typeof ContractTermsSchema>;

// ============================================
// CONTRACT VISIBILITY
// ============================================

export const ContractVisibilitySchema = z.enum([
  'public',    // Known to all, enforceable by authorities
  'private',   // Known to parties + witnesses, enforceable by reputation
  'secret',    // Unknown to others, enforceable only by parties (blackmail, assassination)
  'sacred',    // Known to deity, enforceable by divine power
]);
export type ContractVisibility = z.infer<typeof ContractVisibilitySchema>;

// ============================================
// CONTRACT STATUS
// ============================================

export const ContractStatusSchema = z.enum([
  'proposed',    // Offer made, awaiting response
  'negotiating', // Counter-offers in progress
  'accepted',    // Parties agreed, not yet ratified
  'ratified',    // Officially recognized by jurisdiction
  'active',      // In effect
  'suspended',   // Temporarily inactive
  'breached',    // One party violated terms
  'disputed',    // Under adjudication
  'fulfilled',   // All obligations complete
  'terminated',  // Ended by agreement or clause
  'annulled',    // Declared invalid (never existed)
  'expired',     // Duration elapsed
]);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

// ============================================
// SOCIAL CONTRACT
// ============================================

export const SocialContractSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  contractType: ContractTypeSchema,
  subtype: z.string().optional(),

  parties: z.array(ContractPartySchema),
  terms: ContractTermsSchema,

  visibility: ContractVisibilitySchema.default('public'),
  status: ContractStatusSchema.default('proposed'),

  // Jurisdiction
  jurisdictionId: z.string().uuid().optional(),
  jurisdictionType: z.string().optional(),

  // Registration
  registered: z.boolean().default(false),
  registeredAt: z.string().optional(),
  registeredBy: z.string().optional(),
  registryNodeId: z.string().uuid().optional(),

  // Timeline
  proposedAt: z.string().optional(),
  ratifiedAt: z.string().optional(),
  startAt: z.string(),
  endAt: z.string().optional(),
  terminatedAt: z.string().optional(),
  terminationReason: z.string().optional(),

  // World time
  worldTimestampStart: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }).optional(),
  worldTimestampEnd: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }).optional(),

  // Breach tracking
  breachCount: z.number().int().default(0),
  lastBreachAt: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type SocialContract = z.infer<typeof SocialContractSchema>;

// ============================================
// CONTRACT EVENT TYPES
// ============================================

export const ContractEventTypeSchema = z.enum([
  // Lifecycle
  'proposed',
  'counter_proposed',
  'accepted',
  'rejected',
  'ratified',
  'witnessed',
  'registered',

  // Active phase
  'obligation_fulfilled',
  'obligation_failed',
  'right_exercised',
  'right_denied',

  // Problems
  'breached',
  'disputed',
  'suspended',

  // Resolution
  'enforced',
  'forgiven',
  'renegotiated',
  'mediated',

  // End
  'fulfilled',
  'terminated',
  'annulled',
  'expired',

  // Special
  'transferred',
  'inherited',
]);
export type ContractEventType = z.infer<typeof ContractEventTypeSchema>;

// ============================================
// CONTRACT EVENT
// ============================================

export const ContractEventSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  campaignId: z.string().uuid(),

  eventType: ContractEventTypeSchema,

  // Who triggered
  actorId: z.string().optional(),
  actorType: z.string().optional(),
  actorName: z.string().optional(),

  // Details
  details: z.record(z.string(), z.any()).default({}),

  // Consequences applied
  consequences: z.array(z.object({
    type: z.string(),
    target: z.string(),
    effect: z.string(),
    applied: z.boolean().default(false),
  })).default([]),

  // Witnesses
  witnesses: z.array(z.object({
    entityType: z.string(),
    entityId: z.string(),
    entityName: z.string().optional(),
  })).default([]),

  // World time
  worldTimestamp: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }).optional(),

  // Sync
  syncLogId: z.string().uuid().optional(),

  timestamp: z.string(),
});
export type ContractEvent = z.infer<typeof ContractEventSchema>;

// ============================================
// HOUSEHOLD
// ============================================

export const HouseholdTypeSchema = z.enum([
  'family',
  'noble_house',
  'merchant_house',
  'guild_hall',
  'temple',
  'commune',
  'criminal_gang',
  'adventuring_company',
]);
export type HouseholdType = z.infer<typeof HouseholdTypeSchema>;

export const SocialStandingSchema = z.enum([
  'outcast',
  'destitute',
  'poor',
  'common',
  'comfortable',
  'wealthy',
  'noble',
  'royal',
]);
export type SocialStanding = z.infer<typeof SocialStandingSchema>;

export const HouseholdSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  name: z.string(),
  type: HouseholdTypeSchema.default('family'),

  // Head of household
  headId: z.string().uuid().optional(),
  headType: z.string().optional(),

  // Location
  homeHubId: z.string().uuid().optional(),
  homeBuildingId: z.string().uuid().optional(),
  homeNodeId: z.string().uuid().optional(),

  // Social standing
  standing: SocialStandingSchema.default('common'),
  standingTags: z.array(z.string()).default([]),
  // ["landed", "titled", "merchant_guild", "clergy", "criminal"]

  // Resources
  treasury: z.number().int().default(0),
  sharedInventoryId: z.string().uuid().optional(),

  // Properties
  properties: z.array(z.object({
    type: z.string(),
    nodeId: z.string().uuid().optional(),
    buildingId: z.string().uuid().optional(),
    name: z.string(),
  })).default([]),

  // Heraldry
  heraldry: z.object({
    colors: z.array(z.string()).default([]),
    symbol: z.string().optional(),
    motto: z.string().optional(),
  }).default({}),

  // Faction ties
  factionTies: z.array(z.object({
    factionId: z.string().uuid(),
    relationship: z.string(),
    strength: z.number().int().default(0),
  })).default([]),

  // Status
  status: z.enum(['active', 'declining', 'dissolved']).default('active'),
  foundedAt: z.string().optional(),
  dissolvedAt: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type Household = z.infer<typeof HouseholdSchema>;

// ============================================
// HOUSEHOLD MEMBERSHIP
// ============================================

export const HouseholdRoleSchema = z.enum([
  'head',
  'spouse',
  'heir',
  'child',
  'ward',
  'elder',
  'servant',
  'retainer',
  'guest',
  'prisoner',
]);
export type HouseholdRole = z.infer<typeof HouseholdRoleSchema>;

export const HouseholdMembershipSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),

  memberId: z.string().uuid(),
  memberType: z.string(),

  role: HouseholdRoleSchema.default('retainer'),

  // Interval for time-travel
  joinedAt: z.string(),
  joinedSyncVersion: z.number().int().optional(),
  leftAt: z.string().optional(),
  leftSyncVersion: z.number().int().optional(),

  // Reason
  joinReason: z.string().optional(),
  // birth, marriage, adoption, employment, etc.
  leaveReason: z.string().optional(),
  // death, divorce, exile, marriage_out, etc.

  active: z.boolean().default(true),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HouseholdMembership = z.infer<typeof HouseholdMembershipSchema>;

// ============================================
// KINSHIP
// ============================================

export const KinshipTypeSchema = z.enum([
  'parent',
  'child',
  'sibling',
  'spouse',
  'grandparent',
  'grandchild',
  'uncle',
  'aunt',
  'nephew',
  'niece',
  'cousin',
  'step_parent',
  'step_child',
  'step_sibling',
  'in_law',
]);
export type KinshipType = z.infer<typeof KinshipTypeSchema>;

export const LegitimacySchema = z.enum([
  'legitimate',
  'illegitimate',
  'adopted',
  'legitimized', // Born illegitimate, later recognized
  'contested',
  'unknown',
]);
export type Legitimacy = z.infer<typeof LegitimacySchema>;

export const KinshipLinkSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // The two related entities
  entity1Id: z.string().uuid(),
  entity1Type: z.string(),
  entity2Id: z.string().uuid(),
  entity2Type: z.string(),

  // Relationship (from entity1's perspective)
  relationship: KinshipTypeSchema,

  // Legitimacy
  legitimacy: LegitimacySchema.default('legitimate'),

  // Source
  sourceContractId: z.string().uuid().optional(), // Marriage, adoption
  birthEventId: z.string().uuid().optional(),

  // Status
  status: z.enum(['active', 'deceased', 'disowned', 'annulled']).default('active'),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type KinshipLink = z.infer<typeof KinshipLinkSchema>;

// ============================================
// TITLES
// ============================================

export const TitleRankSchema = z.enum([
  'emperor',
  'king',
  'archduke',
  'duke',
  'marquess',
  'count',
  'viscount',
  'baron',
  'baronet',
  'knight',
  'lord',
  'mayor',
  'alderman',
  'guildmaster',
  'high_priest',
  'abbot',
]);
export type TitleRank = z.infer<typeof TitleRankSchema>;

export const SuccessionTypeSchema = z.enum([
  'primogeniture',      // Eldest child
  'male_primogeniture', // Eldest son
  'ultimogeniture',     // Youngest child
  'gavelkind',          // Split among children
  'elective',           // Chosen by electors
  'appointed',          // Granted by authority
  'conquest',           // Whoever takes it
  'seniority',          // Oldest family member
]);
export type SuccessionType = z.infer<typeof SuccessionTypeSchema>;

export const TitleSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  name: z.string(),
  rank: TitleRankSchema,

  // Granting authority
  grantingFactionId: z.string().uuid().optional(),

  // Domain
  domainNodeId: z.string().uuid().optional(),
  domainName: z.string().optional(),

  // Current holder
  holderId: z.string().uuid().optional(),
  holderType: z.string().optional(),
  holderName: z.string().optional(),
  heldSince: z.string().optional(),

  // Succession
  successionRules: z.object({
    type: SuccessionTypeSchema.default('primogeniture'),
    genderPreference: z.enum(['none', 'male_preference', 'female_preference', 'male_only', 'female_only']).default('none'),
    legitimacyRequired: z.boolean().default(true),
    electorsIds: z.array(z.string().uuid()).default([]),
  }).default({}),

  // Line of succession
  successionLine: z.array(z.object({
    entityId: z.string().uuid(),
    entityType: z.string(),
    entityName: z.string().optional(),
    claim: z.string(),
    strength: z.number().int(),
  })).default([]),

  // Rights
  rights: z.array(z.string()).default([]),
  // ["collect_taxes", "administer_justice", "raise_levies", "grant_land"]

  // Obligations
  obligations: z.array(z.string()).default([]),
  // ["military_service", "tax_tribute", "court_attendance"]

  // Status
  status: z.enum(['active', 'vacant', 'disputed', 'abolished']).default('active'),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type Title = z.infer<typeof TitleSchema>;

// ============================================
// CLAIMS
// ============================================

export const ClaimSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // What is claimed
  targetType: z.enum(['title', 'estate', 'inheritance', 'contract_right']),
  targetId: z.string().uuid(),

  // Who claims
  claimantId: z.string().uuid(),
  claimantType: z.string(),
  claimantName: z.string().optional(),

  // Basis
  basis: z.object({
    type: z.string(), // inheritance, conquest, grant, purchase, divine_right
    through: z.string().uuid().optional(), // Ancestor who held it
    legitimacy: LegitimacySchema.optional(),
    documents: z.array(z.string()).default([]),
  }),

  // Strength (0-100)
  strength: z.number().int().min(0).max(100).default(50),

  // Recognition
  recognizedBy: z.array(z.string().uuid()).default([]),
  opposedBy: z.array(z.string().uuid()).default([]),

  // Status
  status: z.enum(['active', 'pressed', 'abandoned', 'resolved', 'rejected']).default('active'),
  resolvedAt: z.string().optional(),
  resolution: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type Claim = z.infer<typeof ClaimSchema>;

// ============================================
// JURISDICTION
// ============================================

export const JurisdictionTypeSchema = z.enum([
  'royal_court',
  'noble_court',
  'church',
  'temple',
  'guild',
  'city',
  'village',
  'tribal',
  'divine',
  'criminal', // Underworld justice
]);
export type JurisdictionType = z.infer<typeof JurisdictionTypeSchema>;

export const JurisdictionSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  name: z.string(),
  type: JurisdictionTypeSchema,

  // Authority
  authorityId: z.string().uuid().optional(),
  authorityType: z.string().optional(),
  // faction, deity, character

  // Scope
  scopeNodeId: z.string().uuid().optional(),
  scopeType: z.string().optional(),
  // region, hub, building, faction_members

  // Precedence (higher overrides lower)
  precedence: z.number().int().default(50),

  // Recognized contract types
  recognizedContracts: z.array(ContractTypeSchema).default([]),

  // Enforcement capabilities
  enforcement: z.object({
    canFine: z.boolean().default(true),
    canImprison: z.boolean().default(false),
    canExile: z.boolean().default(false),
    canExecute: z.boolean().default(false),
    canExcommunicate: z.boolean().default(false),
    canConfiscate: z.boolean().default(false),
    canCurse: z.boolean().default(false),
  }).default({}),

  // Registry
  maintainsRegistry: z.boolean().default(false),
  registryTypes: z.array(z.string()).default([]),
  // ["marriage", "land_deed", "guild_charter"]

  status: z.enum(['active', 'suspended', 'abolished']).default('active'),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

// ============================================
// CONTRACT POLICY
// ============================================

export const ContractPolicySchema = z.object({
  id: z.string().uuid(),
  jurisdictionId: z.string().uuid(),

  contractType: ContractTypeSchema,

  // Recognition rules
  recognitionRules: z.object({
    requiresRegistration: z.boolean().default(false),
    requiresWitnesses: z.number().int().default(0),
    minimumAge: z.number().int().optional(),
    requiresConsent: z.boolean().default(true),
    prohibitedParties: z.array(z.string()).default([]),
    // ["same_sex", "same_family", "different_faith", "commoner_noble"]
  }).default({}),

  // Legitimacy rules
  legitimacyRules: z.object({
    illegitimateCanInherit: z.boolean().default(false),
    adoptedCanInherit: z.boolean().default(true),
    legitimizationAllowed: z.boolean().default(true),
    legitimizationCost: z.number().int().optional(),
  }).default({}),

  // Penalties
  penalties: z.array(z.object({
    offense: z.string(),
    penalty: z.string(),
    amount: z.number().int().optional(),
    duration: z.string().optional(),
  })).default([]),

  // Exceptions
  exceptions: z.array(z.object({
    condition: z.string(), // "noble", "clergy", "guild_member"
    exemption: z.string(), // What they're exempt from
  })).default([]),

  // Termination rules
  terminationRules: z.object({
    divorceAllowed: z.boolean().default(false),
    divorceCost: z.number().int().optional(),
    annulmentGrounds: z.array(z.string()).default([]),
    // ["non_consummation", "fraud", "coercion", "impotence", "infidelity"]
    mutualTermination: z.boolean().default(true),
    unilateralTermination: z.boolean().default(false),
  }).default({}),

  status: z.enum(['active', 'suspended', 'repealed']).default('active'),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type ContractPolicy = z.infer<typeof ContractPolicySchema>;
