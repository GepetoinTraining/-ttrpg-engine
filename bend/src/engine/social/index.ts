/**
 * SOCIAL CONTRACT ENGINE
 *
 * The obligation graph - what binds people together.
 *
 * This system enables emergent political drama through:
 * - Contracts: Edges in the social graph (marriage, oaths, vassalage, debts)
 * - Households: Durable social/economic units with succession
 * - Jurisdictions: Who enforces what, where (factions as policy engines)
 * - Kinship: Blood relationships with legitimacy rules
 * - Titles & Claims: Inheritable positions of power and the disputes over them
 *
 * All operations emit timeline deltas for party-scoped causality.
 */

// Schema exports
export {
  // Contract types
  ContractTypeSchema,
  type ContractType,
  ContractPartySchema,
  type ContractParty,
  ContractTermsSchema,
  type ContractTerms,
  ContractVisibilitySchema,
  type ContractVisibility,
  ContractStatusSchema,
  type ContractStatus,
  SocialContractSchema,
  type SocialContract,
  ContractEventTypeSchema,
  type ContractEventType,
  ContractEventSchema,
  type ContractEvent,

  // Household types
  HouseholdTypeSchema,
  type HouseholdType,
  SocialStandingSchema,
  type SocialStanding,
  HouseholdSchema,
  type Household,
  HouseholdRoleSchema,
  type HouseholdRole,
  HouseholdMembershipSchema,
  type HouseholdMembership,

  // Kinship types
  KinshipTypeSchema,
  type KinshipType,
  LegitimacySchema,
  type Legitimacy,
  KinshipLinkSchema,
  type KinshipLink,

  // Title types
  TitleRankSchema,
  type TitleRank,
  SuccessionTypeSchema,
  type SuccessionType,
  TitleSchema,
  type Title,

  // Claim types
  ClaimSchema,
  type Claim,

  // Jurisdiction types
  JurisdictionTypeSchema,
  type JurisdictionType,
  JurisdictionSchema,
  type Jurisdiction,
  ContractPolicySchema,
  type ContractPolicy,
} from './schema';

// Contract operations
export {
  proposeContract,
  acceptContract,
  rejectContract,
  ratifyContract,
  breachContract,
  terminateContract,
  fulfillObligation,
  exerciseRight,
  type CreateContractInput as ProposeContractInput,
  type AcceptContractInput,
  type RatifyContractInput,
  type BreachContractInput,
  type TerminateContractInput,
  type FulfillObligationInput,
  type ExerciseRightInput,
  // Queries
  getActiveContracts,
  getContractsBetween,
  hasActiveContract,
  canExitContract,
} from './contracts';

// Household operations
export {
  createHousehold,
  joinHousehold,
  leaveHousehold,
  succeedHead,
  type CreateHouseholdInput,
  type JoinHouseholdInput,
  type LeaveHouseholdInput,
  type SucceedHeadInput,
  // Queries
  getActiveMembers,
  getMemberHousehold,
  getHouseholdHead,
  getHouseholdHeirs,
  canInherit,
  calculateWealthScore,
} from './households';

// Jurisdiction operations
export {
  createJurisdiction,
  createPolicy,
  enforceBreach,
  type CreateJurisdictionInput,
  type CreatePolicyInput,
  type EnforceBreachInput,
  type EnforcementResult,
  // Queries
  findJurisdiction,
  recognizesContract,
  isEnforceable,
  getEnforcementOptions,
  maintainsRegistry,
  getPolicy,
  canTerminate,
  validateFormation,
} from './jurisdiction';

// Kinship operations
export {
  createKinshipLink,
  disownKinship,
  legitimizeKinship,
  type CreateKinshipInput,
  type DisownInput,
  type LegitimizeInput,
  // Title operations
  createTitle,
  transferTitle,
  vacateTitle,
  type CreateTitleInput,
  type TransferTitleInput,
  // Claim operations
  createClaim,
  pressClaim,
  resolveClaim,
  type CreateClaimInput,
  type PressClaimInput,
  type ResolveClaimInput,
  // Succession
  calculateSuccessionLine,
  calculateInheritance,
  type SuccessionCandidate,
  type InheritancePackage,
  // Kinship queries
  getKinshipLinks,
  getRelatives,
  getParents,
  getChildren,
  getSiblings,
  getSpouse,
  areRelated,
  findCommonAncestors,
  calculateKinshipDegree,
  // Title queries
  getTitlesHeld,
  getHighestTitle,
  getClaimsAgainst,
  canInheritTitle,
} from './kinship';
