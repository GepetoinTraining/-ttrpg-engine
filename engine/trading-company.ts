/**
 * TRADING COMPANY — The Emergent Economic Superpower
 * =====================================================
 *
 * The East India Company of your world. The Zhentarim without the evil.
 * The Costers, the Rundeen, the Seven Suns Trading Company.
 *
 * A trading company IS NOT a faction — it has no territory to defend,
 * no peasants to protect, no armies to raise. It has MONEY. And money
 * buys everything else.
 *
 * CAREER PATH (promotion from local actor merchant):
 *   independent merchant → shopkeeper (stays local)
 *   independent merchant → caravan operator (moves goods)
 *   either → emporium owner → trading_house → ═══ PROMOTION ═══
 *   
 *   Once a merchant hits trading_house tier (10K GP, 70 rep, 20 employees),
 *   they can incorporate as a TradingCompany entity. The local actor
 *   becomes the founder, their assets transfer, and they start operating
 *   across multiple nodes.
 *
 * EXCLUSIVE CAPABILITIES:
 *   - Auction houses (ONLY trading companies can create these)
 *   - Banking charters (requires contract with authority)
 *   - Road infrastructure (rest stops, inns along edges)
 *   - Multi-node branch offices
 *   - Bulk trade routes (permanent caravan circuits)
 *
 * SEEDING:
 *   Metropolis: 2-3 competing companies
 *   City: 1-2 companies
 *   Town: 0-1 companies
 *   Village: none (independent merchants only)
 *
 * TICK INTEGRATION:
 *   Weekly: revenue, expenses, expansion decisions, caravan dispatch
 *   Monthly: tier evaluation, branch performance review
 *   Quarterly: strategic decisions (new routes, new branches, charters)
 */

import { createVenue, type VenueType, type Venue, TIER_REQUIREMENTS, type MerchantTier } from './market.js'
import { type Caravan, createCaravan, type CaravanType } from './caravan.js'

// ============================================================
// TRADING COMPANY TIERS
// ============================================================

export type CompanyTier = 'trading_house' | 'consortium'

export const COMPANY_TIER_REQUIREMENTS: Record<CompanyTier, {
  minCapital: number
  minReputation: number
  minEmployees: number
  minBranches: number
  canCharter: boolean
  canAuction: boolean
  maxCaravans: number
}> = {
  trading_house: {
    minCapital: 10000,
    minReputation: 70,
    minEmployees: 20,
    minBranches: 1,
    canCharter: false,
    canAuction: true,     // Can open auction houses
    maxCaravans: 5,
  },
  consortium: {
    minCapital: 50000,
    minReputation: 85,
    minEmployees: 100,
    minBranches: 3,
    canCharter: true,     // Can obtain banking charters
    canAuction: true,
    maxCaravans: 20,
  },
}

// ============================================================
// COMPANY BRANCH — Presence at a settlement
// ============================================================

export type BranchType = 'office' | 'warehouse' | 'shop' | 'emporium' | 'inn' | 'auction_house' | 'bank'

export interface CompanyBranch {
  nodeId: string
  type: BranchType
  managerId?: string    // Local actor running this branch
  venueId?: string      // Links to market.ts Venue
  weeklyRevenue: number
  weeklyExpenses: number
  established: number   // World day
  status: 'active' | 'closed' | 'under_construction'
}

// ============================================================
// ROAD ASSET — Infrastructure along trade routes
// ============================================================

export type RoadAssetType = 'rest_stop' | 'inn' | 'warehouse' | 'toll_station' | 'guard_post'

export interface RoadAsset {
  id: string
  edgeId: string
  segmentIndex: number
  type: RoadAssetType
  condition: number     // 0-100
  weeklyRevenue: number
  weeklyUpkeep: number
  builtDay: number
}

// ============================================================
// TRADE ROUTE — Permanent caravan circuits
// ============================================================

export interface TradeRoute {
  id: string
  name: string
  nodeIds: string[]     // Ordered list of settlements on the route
  edgeIds: string[]     // Edges connecting them
  frequency: 'weekly' | 'biweekly' | 'monthly'
  caravanType: CaravanType
  commodities: string[] // What's typically traded
  profitable: boolean
  established: number
}

// ============================================================
// TRADING COMPANY — The entity itself
// ============================================================

export interface TradingCompany {
  id: string
  name: string

  // Founder — the local actor who got promoted
  founderId: string
  founderName: string

  // Headquarters
  headquartersNodeId: string

  // Multi-node presence
  branches: CompanyBranch[]

  // Assets — IDs linking to other systems
  ownedVenueIds: string[]       // Venue IDs from market.ts
  ownedCaravanIds: string[]     // Caravan IDs from caravan.ts
  ownedDeedIds: string[]        // PropertyDeed IDs from banking.ts
  ownedAuctionHouseIds: string[]// Auction house Venue IDs (exclusive!)
  bankingCharter: boolean
  bankVaultId?: string

  // Economics
  treasury: number
  weeklyRevenue: number
  weeklyExpenses: number
  employees: number

  // Influence
  reputation: number     // 0-100

  // Tier
  tier: CompanyTier

  // Trade routes
  tradeRoutes: TradeRoute[]

  // Road infrastructure
  roadAssets: RoadAsset[]

  // Active contract IDs from social.ts
  activeContractIds: string[]

  // Status
  status: 'growing' | 'established' | 'dominant' | 'declining' | 'bankrupt' | 'dissolved'
  foundedDay: number
}

// ============================================================
// CREATION — From promoted merchant or from world seed
// ============================================================

export function createTradingCompany(
  name: string,
  founderId: string,
  founderName: string,
  headquartersNodeId: string,
  worldDay: number,
  overrides: Partial<TradingCompany> = {},
): TradingCompany {
  return {
    id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    founderId,
    founderName,
    headquartersNodeId,
    branches: [{
      nodeId: headquartersNodeId,
      type: 'office',
      weeklyRevenue: 0,
      weeklyExpenses: 10,
      established: worldDay,
      status: 'active',
    }],
    ownedVenueIds: [],
    ownedCaravanIds: [],
    ownedDeedIds: [],
    ownedAuctionHouseIds: [],
    bankingCharter: false,
    treasury: 0,
    weeklyRevenue: 0,
    weeklyExpenses: 0,
    employees: 20,
    reputation: 70,
    tier: 'trading_house',
    tradeRoutes: [],
    roadAssets: [],
    activeContractIds: [],
    status: 'growing',
    foundedDay: worldDay,
    ...overrides,
  }
}

// ============================================================
// PROMOTION — Local actor merchant → Trading Company
// ============================================================

/**
 * Check if a merchant qualifies for promotion to Trading Company.
 * Requirements: trading_house tier thresholds from market.ts
 */
export function canPromoteToCompany(
  capital: number,
  reputation: number,
  employees: number,
): boolean {
  const req = COMPANY_TIER_REQUIREMENTS.trading_house
  return capital >= req.minCapital
    && reputation >= req.minReputation
    && employees >= req.minEmployees
}

export interface PromotionResult {
  company: TradingCompany
  /** Assets transferred from the local actor */
  transferredCapital: number
  transferredVenues: string[]
  transferredCaravans: string[]
}

/**
 * Promote a merchant to a TradingCompany.
 * Transfers their capital, venues, and caravans.
 */
export function promoteToCompany(
  merchantName: string,
  companyName: string,
  merchantId: string,
  headquartersNodeId: string,
  capital: number,
  reputation: number,
  employees: number,
  venueIds: string[],
  caravanIds: string[],
  worldDay: number,
): PromotionResult | null {
  if (!canPromoteToCompany(capital, reputation, employees)) return null

  const company = createTradingCompany(
    companyName,
    merchantId,
    merchantName,
    headquartersNodeId,
    worldDay,
    {
      treasury: capital,
      reputation,
      employees,
      ownedVenueIds: [...venueIds],
      ownedCaravanIds: [...caravanIds],
    },
  )

  return {
    company,
    transferredCapital: capital,
    transferredVenues: venueIds,
    transferredCaravans: caravanIds,
  }
}

// ============================================================
// TIER EVALUATION — Can the company tier up?
// ============================================================

export function evaluateTier(company: TradingCompany): CompanyTier {
  const consortiumReq = COMPANY_TIER_REQUIREMENTS.consortium
  if (
    company.treasury >= consortiumReq.minCapital &&
    company.reputation >= consortiumReq.minReputation &&
    company.employees >= consortiumReq.minEmployees &&
    company.branches.filter(b => b.status === 'active').length >= consortiumReq.minBranches
  ) {
    return 'consortium'
  }
  return 'trading_house'
}

export function tierUpCompany(company: TradingCompany): boolean {
  const newTier = evaluateTier(company)
  if (newTier !== company.tier) {
    company.tier = newTier
    return true
  }
  return false
}

// ============================================================
// BRANCHES — Expand to new settlements
// ============================================================

export function addBranch(
  company: TradingCompany,
  nodeId: string,
  type: BranchType,
  worldDay: number,
  venueId?: string,
  managerId?: string,
): CompanyBranch {
  const branch: CompanyBranch = {
    nodeId,
    type,
    managerId,
    venueId,
    weeklyRevenue: 0,
    weeklyExpenses: type === 'office' ? 10 : type === 'warehouse' ? 15 : 20,
    established: worldDay,
    status: 'active',
  }
  company.branches.push(branch)
  return branch
}

export function closeBranch(company: TradingCompany, nodeId: string, type: BranchType): boolean {
  const branch = company.branches.find(b => b.nodeId === nodeId && b.type === type && b.status === 'active')
  if (!branch) return false
  branch.status = 'closed'
  return true
}

export function getActiveBranches(company: TradingCompany): CompanyBranch[] {
  return company.branches.filter(b => b.status === 'active')
}

export function getBranchesAt(company: TradingCompany, nodeId: string): CompanyBranch[] {
  return company.branches.filter(b => b.nodeId === nodeId && b.status === 'active')
}

// ============================================================
// AUCTION HOUSE — Company-exclusive venue
// ============================================================
//
// RULE: Auction houses can ONLY be created by Trading Companies.
// No company → no auction house. Period.
// This gates a powerful economic tool behind mercantile achievement.

export interface AuctionHouse {
  id: string
  companyId: string
  nodeId: string
  venueId: string        // Links to market.ts Venue
  weeklyListings: number
  commissionRate: number  // 5-15% of sale price
  specializations: string[] // What categories it handles
  prestige: number        // 0-100, affects who sells here
  established: number
}

/**
 * Create an auction house at a settlement.
 * GATED: Only trading companies can do this.
 * Returns null if company tier doesn't allow auction houses.
 */
export function createAuctionHouse(
  company: TradingCompany,
  nodeId: string,
  worldDay: number,
  specializations: string[] = ['*'],
  commissionRate: number = 0.10,
): AuctionHouse | null {
  const tierReq = COMPANY_TIER_REQUIREMENTS[company.tier]
  if (!tierReq.canAuction) return null

  // Create the venue via market.ts
  const venue = createVenue(`${company.name} Auction House`, 'auction_house', nodeId)

  const auctionHouse: AuctionHouse = {
    id: `ah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    companyId: company.id,
    nodeId,
    venueId: venue.id,
    weeklyListings: 0,
    commissionRate,
    specializations,
    prestige: Math.floor(company.reputation * 0.5),
    established: worldDay,
  }

  // Register with the company
  company.ownedAuctionHouseIds.push(auctionHouse.id)
  company.ownedVenueIds.push(venue.id)
  addBranch(company, nodeId, 'auction_house', worldDay, venue.id)

  return auctionHouse
}

// ============================================================
// CARAVANS — Company-owned trade vehicles
// ============================================================

export function commissionCaravan(
  company: TradingCompany,
  type: CaravanType,
  originHubId: string,
  destinationHubId: string,
  edgeId: string,
  totalSegments: number,
): Caravan | null {
  const maxCaravans = COMPANY_TIER_REQUIREMENTS[company.tier].maxCaravans
  if (company.ownedCaravanIds.length >= maxCaravans) return null

  const caravan = createCaravan(type, company.id, 'merchant', originHubId, destinationHubId, edgeId, totalSegments)
  company.ownedCaravanIds.push(caravan.id)
  return caravan
}

// ============================================================
// TRADE ROUTES — Permanent circuits
// ============================================================

export function establishTradeRoute(
  company: TradingCompany,
  name: string,
  nodeIds: string[],
  edgeIds: string[],
  caravanType: CaravanType,
  frequency: TradeRoute['frequency'],
  commodities: string[],
  worldDay: number,
): TradeRoute {
  const route: TradeRoute = {
    id: `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    nodeIds,
    edgeIds,
    frequency,
    caravanType,
    commodities,
    profitable: true,  // Assumed profitable at creation
    established: worldDay,
  }
  company.tradeRoutes.push(route)
  return route
}

// ============================================================
// ROAD INFRASTRUCTURE — Rest stops, inns along edges
// ============================================================

export const ROAD_ASSET_COSTS: Record<RoadAssetType, { buildCost: number; weeklyUpkeep: number }> = {
  rest_stop:    { buildCost: 200,   weeklyUpkeep: 5 },
  inn:          { buildCost: 1000,  weeklyUpkeep: 20 },
  warehouse:    { buildCost: 1500,  weeklyUpkeep: 15 },
  toll_station: { buildCost: 500,   weeklyUpkeep: 10 },
  guard_post:   { buildCost: 800,   weeklyUpkeep: 25 },
}

export function buildRoadAsset(
  company: TradingCompany,
  edgeId: string,
  segmentIndex: number,
  type: RoadAssetType,
  worldDay: number,
): RoadAsset | null {
  const costs = ROAD_ASSET_COSTS[type]
  if (company.treasury < costs.buildCost) return null

  company.treasury -= costs.buildCost

  const asset: RoadAsset = {
    id: `road_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    edgeId,
    segmentIndex,
    type,
    condition: 100,
    weeklyRevenue: 0,
    weeklyUpkeep: costs.weeklyUpkeep,
    builtDay: worldDay,
  }

  company.roadAssets.push(asset)
  return asset
}

// ============================================================
// BANKING CHARTER — Consortium exclusive
// ============================================================

/**
 * Obtain a banking charter. Requires:
 *   - Consortium tier
 *   - Sufficient capital
 * Returns false if requirements not met.
 */
export function obtainBankingCharter(
  company: TradingCompany,
  charterCost: number = 5000,
): boolean {
  const tierReq = COMPANY_TIER_REQUIREMENTS[company.tier]
  if (!tierReq.canCharter) return false
  if (company.treasury < charterCost) return false
  if (company.bankingCharter) return false  // Already has one

  company.treasury -= charterCost
  company.bankingCharter = true
  return true
}

// ============================================================
// WEEKLY COMPANY TICK — Revenue, expenses, decisions
// ============================================================

export interface CompanyTickResult {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  branchPerformance: { nodeId: string; type: BranchType; profit: number }[]
  roadAssetRevenue: number
  tieredUp: boolean
  statusChange: TradingCompany['status'] | null
}

export function weeklyCompanyTick(company: TradingCompany): CompanyTickResult {
  const result: CompanyTickResult = {
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    branchPerformance: [],
    roadAssetRevenue: 0,
    tieredUp: false,
    statusChange: null,
  }

  // ── Phase 1: Branch revenue and expenses ──
  for (const branch of company.branches) {
    if (branch.status !== 'active') continue
    result.totalRevenue += branch.weeklyRevenue
    result.totalExpenses += branch.weeklyExpenses
    result.branchPerformance.push({
      nodeId: branch.nodeId,
      type: branch.type,
      profit: branch.weeklyRevenue - branch.weeklyExpenses,
    })
  }

  // ── Phase 2: Road asset revenue ──
  for (const asset of company.roadAssets) {
    result.totalRevenue += asset.weeklyRevenue
    result.totalExpenses += asset.weeklyUpkeep
    result.roadAssetRevenue += asset.weeklyRevenue

    // Degrade condition
    asset.condition = Math.max(0, asset.condition - 1)
    if (asset.condition < 25) {
      asset.weeklyRevenue = Math.floor(asset.weeklyRevenue * 0.5)
    }
  }

  // ── Phase 3: Employee costs (1 GP/employee/week base) ──
  result.totalExpenses += company.employees

  // ── Phase 4: Update treasury ──
  result.netProfit = result.totalRevenue - result.totalExpenses
  company.treasury += result.netProfit
  company.weeklyRevenue = result.totalRevenue
  company.weeklyExpenses = result.totalExpenses

  // ── Phase 5: Tier evaluation ──
  result.tieredUp = tierUpCompany(company)

  // ── Phase 6: Status evaluation ──
  if (company.treasury <= 0) {
    company.status = 'bankrupt'
    result.statusChange = 'bankrupt'
  } else if (company.treasury > COMPANY_TIER_REQUIREMENTS.consortium.minCapital * 2) {
    if (company.status !== 'dominant') {
      company.status = 'dominant'
      result.statusChange = 'dominant'
    }
  } else if (company.tier === 'consortium' && company.status === 'growing') {
    company.status = 'established'
    result.statusChange = 'established'
  }

  return result
}

// ============================================================
// SEEDING — Initial companies for world generation
// ============================================================

export type SettlementScale = 'metropolis' | 'city' | 'town' | 'village' | 'hamlet'

export function getCompanyCount(scale: SettlementScale): { min: number; max: number } {
  switch (scale) {
    case 'metropolis': return { min: 2, max: 3 }
    case 'city':       return { min: 1, max: 2 }
    case 'town':       return { min: 0, max: 1 }
    default:           return { min: 0, max: 0 }
  }
}

/** Seed company names — evocative fantasy trading companies */
export const SEED_COMPANY_NAMES: string[] = [
  'Seven Suns Trading Coster',
  'Baldur\'s Gate Merchantile Compact',
  'Iron Throne Trading Company',
  'Thousandheads Trading Coster',
  'Red Sails Trading Company',
  'Highmoon Trading Priory',
  'Dragoneye Dealing Coster',
  'Many-Starred Cloak Trading',
  'Merchant League of Amn',
  'Waterdeep Trading Company',
  'Calimshan Spice Consortium',
  'Moonshae Straits Shipping',
  'Thayan Trade Enclave',
  'Dalelands Grain Compact',
  'Luskan Ship Kurths',
]

/**
 * Seed initial trading companies for a settlement.
 * Uses settlement scale to determine count and tiers.
 */
export function seedCompanies(
  settlementNodeId: string,
  settlementName: string,
  scale: SettlementScale,
  worldDay: number,
  existingCount: number = 0,
): TradingCompany[] {
  const { min, max } = getCompanyCount(scale)
  const targetCount = Math.max(0, Math.min(max, max - existingCount))
  if (targetCount <= 0 || min === 0 && max === 0) return []

  const companies: TradingCompany[] = []
  const seed = settlementNodeId.length * 7919 + worldDay

  for (let i = 0; i < targetCount; i++) {
    const nameIdx = ((seed + i * 31) & 0x7FFFFFFF) % SEED_COMPANY_NAMES.length
    const isConsortium = scale === 'metropolis' && i === 0

    const company = createTradingCompany(
      SEED_COMPANY_NAMES[nameIdx],
      `founder_${settlementNodeId}_${i}`,
      `Merchant Prince ${i + 1}`,
      settlementNodeId,
      worldDay,
      {
        tier: isConsortium ? 'consortium' : 'trading_house',
        treasury: isConsortium ? 75000 : 15000,
        reputation: isConsortium ? 90 : 75,
        employees: isConsortium ? 150 : 30,
        status: isConsortium ? 'dominant' : 'established',
      },
    )

    companies.push(company)
  }

  return companies
}
