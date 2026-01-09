// ============================================
// PLAYER INTERVENTION LAYER
// ============================================
//
// Philosophy: PLAYERS BUILD EMPIRES, NOT COLLECT SWORDS
//
// The player's character is an adventurer, but adventurers don't:
//   - Run shops (they OWN shops)
//   - Craft swords (they EMPLOY smiths)
//   - Guard caravans (they HIRE guards)
//   - Farm fields (they COLLECT rent)
//
// This layer provides:
//   1. PROPERTY SYSTEM - Ownership, deeds, housing market
//   2. ORGANIZATION SYSTEM - Businesses, followers, empires
//   3. DOWNTIME QUEUE - What your minions do while you adventure
//
// Flow:
//   FAME → DEED UNLOCK → PROPERTY ACQUISITION → FOLLOWER ASSIGNMENT →
//   DOWNTIME ORDERS → AUTOMATED OPERATION → PROFIT/LOSS REPORTS
//
// Players make strategic decisions.
// Followers execute.
// The simulation runs.
// Players collect results.
//

// ============================================
// PROPERTY & DEED SYSTEM
// ============================================

export {
  // Deed types
  DeedTypeSchema,
  DeedAcquisitionSchema,
  DeedSchema,
  type DeedType,
  type DeedAcquisition,
  type Deed,

  // Property
  PropertyConditionSchema,
  PropertySchema,
  type Property,

  // Housing market
  HousingMarketSchema,
  type HousingMarket,

  // Fame → Deed thresholds
  FAME_DEED_THRESHOLDS,
  getUnlockedDeedTypes,

  // Dungeon claims
  DungeonClaimSchema,
  generateDungeonClaims,
  type DungeonClaim,

  // Transactions
  purchaseProperty,
  type PropertyPurchaseResult,

  // Financials
  calculatePropertyFinancials,
  type PropertyFinancials,
} from './property';

// ============================================
// ORGANIZATION & BUSINESS SYSTEM
// ============================================

export {
  // Organization types
  OrganizationTypeSchema,
  OrganizationSchema,
  ORGANIZATION_TIER_REQUIREMENTS,
  type OrganizationType,
  type Organization,

  // Player businesses
  PlayerBusinessTypeSchema,
  PlayerBusinessSchema,
  tickBusiness,
  type PlayerBusinessType,
  type PlayerBusiness,
  type BusinessTickResult,

  // Follower assignments
  FollowerAssignmentSchema,
  calculateFollowerEfficiency,
  type FollowerAssignment,

  // Downtime orders
  DowntimeOrderTypeSchema,
  DowntimeOrderSchema,
  processDowntimeOrder,
  type DowntimeOrderType,
  type DowntimeOrder,
} from './organization';
