/**
 * TRADING COMPANY TESTS
 * ========================
 * Merchant promotion, company operations, auction houses, road infrastructure,
 * banking charters, weekly tick, seeding.
 */

import { describe, it, expect } from 'vitest'
import {
  createTradingCompany,
  canPromoteToCompany,
  promoteToCompany,
  evaluateTier,
  tierUpCompany,
  addBranch,
  closeBranch,
  getActiveBranches,
  getBranchesAt,
  createAuctionHouse,
  commissionCaravan,
  establishTradeRoute,
  buildRoadAsset,
  obtainBankingCharter,
  weeklyCompanyTick,
  getCompanyCount,
  seedCompanies,
  COMPANY_TIER_REQUIREMENTS,
  ROAD_ASSET_COSTS,
  SEED_COMPANY_NAMES,
} from '../trading-company'

// ============================================================
// CREATION & PROMOTION
// ============================================================

describe('Trading Company — Creation & Promotion', () => {
  it('creates a trading company with headquarters branch', () => {
    const tc = createTradingCompany('Iron Throne', 'founder_1', 'Sarevok', 'node_bg', 100)
    expect(tc.name).toBe('Iron Throne')
    expect(tc.founderId).toBe('founder_1')
    expect(tc.headquartersNodeId).toBe('node_bg')
    expect(tc.tier).toBe('trading_house')
    expect(tc.branches).toHaveLength(1)
    expect(tc.branches[0].type).toBe('office')
    expect(tc.status).toBe('growing')
  })

  it('canPromoteToCompany checks thresholds', () => {
    expect(canPromoteToCompany(10000, 70, 20)).toBe(true)  // Exact thresholds
    expect(canPromoteToCompany(9999, 70, 20)).toBe(false)  // Capital too low
    expect(canPromoteToCompany(10000, 69, 20)).toBe(false) // Rep too low
    expect(canPromoteToCompany(10000, 70, 19)).toBe(false) // Employees too low
    expect(canPromoteToCompany(50000, 90, 100)).toBe(true) // Way above
  })

  it('promoteToCompany transfers assets from merchant', () => {
    const result = promoteToCompany(
      'Lord Merchant', 'Golden Scales Trading', 'merch_1',
      'node_waterdeep', 15000, 80, 25,
      ['venue_1', 'venue_2'], ['caravan_1'],
      100,
    )

    expect(result).not.toBeNull()
    expect(result!.company.name).toBe('Golden Scales Trading')
    expect(result!.company.treasury).toBe(15000)
    expect(result!.company.ownedVenueIds).toEqual(['venue_1', 'venue_2'])
    expect(result!.company.ownedCaravanIds).toEqual(['caravan_1'])
    expect(result!.transferredCapital).toBe(15000)
  })

  it('promoteToCompany returns null if below thresholds', () => {
    const result = promoteToCompany(
      'Poor Merchant', 'Sad Company', 'merch_2',
      'node_hamlet', 500, 10, 2,
      [], [], 100,
    )
    expect(result).toBeNull()
  })
})

// ============================================================
// TIERS
// ============================================================

describe('Trading Company — Tiers', () => {
  it('evaluates trading_house tier', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node', 1)
    expect(evaluateTier(tc)).toBe('trading_house')
  })

  it('evaluates consortium tier when requirements met', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node', 1, {
      treasury: 50000,
      reputation: 85,
      employees: 100,
    })
    addBranch(tc, 'node_2', 'shop', 50)
    addBranch(tc, 'node_3', 'warehouse', 50)
    // Now has 3 active branches (1 HQ + 2 new)
    expect(evaluateTier(tc)).toBe('consortium')
  })

  it('tierUpCompany actually changes the tier', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node', 1, {
      treasury: 60000,
      reputation: 90,
      employees: 120,
    })
    addBranch(tc, 'node_2', 'shop', 50)
    addBranch(tc, 'node_3', 'warehouse', 50)

    expect(tc.tier).toBe('trading_house')
    const changed = tierUpCompany(tc)
    expect(changed).toBe(true)
    expect(tc.tier).toBe('consortium')

    // Second call should not change
    expect(tierUpCompany(tc)).toBe(false)
  })
})

// ============================================================
// BRANCHES
// ============================================================

describe('Trading Company — Branches', () => {
  it('adds branches to new settlements', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1)
    addBranch(tc, 'node_suzail', 'shop', 100, 'venue_1')
    addBranch(tc, 'node_arabel', 'warehouse', 100)

    expect(tc.branches).toHaveLength(3) // HQ + 2
    expect(getActiveBranches(tc)).toHaveLength(3)
  })

  it('closes a branch', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1)
    addBranch(tc, 'node_suzail', 'shop', 100)

    expect(closeBranch(tc, 'node_suzail', 'shop')).toBe(true)
    expect(getActiveBranches(tc)).toHaveLength(1) // Only HQ
    expect(closeBranch(tc, 'node_suzail', 'shop')).toBe(false) // Already closed
  })

  it('getBranchesAt queries by node', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1)
    addBranch(tc, 'node_suzail', 'shop', 100)
    addBranch(tc, 'node_suzail', 'warehouse', 100)
    addBranch(tc, 'node_arabel', 'office', 100)

    expect(getBranchesAt(tc, 'node_suzail')).toHaveLength(2)
    expect(getBranchesAt(tc, 'node_arabel')).toHaveLength(1)
    expect(getBranchesAt(tc, 'node_nowhere')).toHaveLength(0)
  })
})

// ============================================================
// AUCTION HOUSE — Company exclusive!
// ============================================================

describe('Trading Company — Auction Houses', () => {
  it('creates auction house for trading_house tier', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, { treasury: 20000 })
    const ah = createAuctionHouse(tc, 'node_suzail', 100, ['weapons', 'gems'])

    expect(ah).not.toBeNull()
    expect(ah!.companyId).toBe(tc.id)
    expect(ah!.specializations).toEqual(['weapons', 'gems'])
    expect(ah!.commissionRate).toBe(0.10)
    expect(tc.ownedAuctionHouseIds).toHaveLength(1)
    expect(tc.ownedVenueIds).toHaveLength(1)
    // Should also add a branch
    expect(tc.branches.find(b => b.type === 'auction_house')).toBeTruthy()
  })

  it('prestige derived from company reputation', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, {
      treasury: 20000,
      reputation: 80,
    })
    const ah = createAuctionHouse(tc, 'node_suzail', 100)
    expect(ah!.prestige).toBe(40) // 80 * 0.5
  })
})

// ============================================================
// CARAVANS
// ============================================================

describe('Trading Company — Caravans', () => {
  it('commissions a caravan', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1)
    const caravan = commissionCaravan(tc, 'wagon', 'node_a', 'node_b', 'edge_1', 10)

    expect(caravan).not.toBeNull()
    expect(caravan!.ownerId).toBe(tc.id)
    expect(tc.ownedCaravanIds).toHaveLength(1)
  })

  it('respects max caravan limit by tier', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1)
    const max = COMPANY_TIER_REQUIREMENTS.trading_house.maxCaravans

    // Fill up to max
    for (let i = 0; i < max; i++) {
      expect(commissionCaravan(tc, 'cart', 'a', 'b', 'e', 5)).not.toBeNull()
    }
    // Next should fail
    expect(commissionCaravan(tc, 'cart', 'a', 'b', 'e', 5)).toBeNull()
  })
})

// ============================================================
// TRADE ROUTES
// ============================================================

describe('Trading Company — Trade Routes', () => {
  it('establishes a trade route', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1)
    const route = establishTradeRoute(
      tc, 'Long Road Run',
      ['node_waterdeep', 'node_daggerford', 'node_dragonspear'],
      ['edge_1', 'edge_2'],
      'wagon', 'weekly',
      ['grain', 'cloth', 'spices'],
      100,
    )

    expect(route.name).toBe('Long Road Run')
    expect(route.nodeIds).toHaveLength(3)
    expect(route.frequency).toBe('weekly')
    expect(tc.tradeRoutes).toHaveLength(1)
  })
})

// ============================================================
// ROAD INFRASTRUCTURE
// ============================================================

describe('Trading Company — Road Infrastructure', () => {
  it('builds a rest stop along an edge', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, { treasury: 5000 })
    const asset = buildRoadAsset(tc, 'edge_1', 3, 'rest_stop', 100)

    expect(asset).not.toBeNull()
    expect(asset!.edgeId).toBe('edge_1')
    expect(asset!.segmentIndex).toBe(3)
    expect(asset!.condition).toBe(100)
    expect(tc.treasury).toBe(5000 - ROAD_ASSET_COSTS.rest_stop.buildCost)
    expect(tc.roadAssets).toHaveLength(1)
  })

  it('fails if treasury too low', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, { treasury: 10 })
    expect(buildRoadAsset(tc, 'edge_1', 0, 'inn', 100)).toBeNull()
  })
})

// ============================================================
// BANKING CHARTER
// ============================================================

describe('Trading Company — Banking Charter', () => {
  it('consortium can obtain banking charter', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, {
      tier: 'consortium',
      treasury: 20000,
    })

    expect(obtainBankingCharter(tc, 5000)).toBe(true)
    expect(tc.bankingCharter).toBe(true)
    expect(tc.treasury).toBe(15000) // Paid 5000
  })

  it('trading_house cannot obtain charter', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, {
      tier: 'trading_house',
      treasury: 50000,
    })
    expect(obtainBankingCharter(tc)).toBe(false)
    expect(tc.bankingCharter).toBe(false)
  })

  it('cannot obtain charter twice', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, {
      tier: 'consortium',
      treasury: 50000,
    })
    obtainBankingCharter(tc)
    expect(obtainBankingCharter(tc)).toBe(false) // Already has one
  })
})

// ============================================================
// WEEKLY TICK
// ============================================================

describe('Trading Company — Weekly Tick', () => {
  it('calculates revenue and expenses from branches', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, { treasury: 10000 })
    // Set some revenue on the HQ branch
    tc.branches[0].weeklyRevenue = 100
    tc.branches[0].weeklyExpenses = 30
    addBranch(tc, 'node_2', 'shop', 50)
    tc.branches[1].weeklyRevenue = 50

    const result = weeklyCompanyTick(tc)

    expect(result.totalRevenue).toBe(150) // 100 + 50
    expect(result.totalExpenses).toBeGreaterThan(0)
    expect(result.branchPerformance).toHaveLength(2)
  })

  it('road assets degrade condition each tick', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, { treasury: 10000 })
    buildRoadAsset(tc, 'edge_1', 0, 'rest_stop', 100)
    expect(tc.roadAssets[0].condition).toBe(100)

    weeklyCompanyTick(tc)
    expect(tc.roadAssets[0].condition).toBe(99)
  })

  it('bankrupt when treasury hits 0', () => {
    const tc = createTradingCompany('Test', 'f', 'F', 'node_hq', 1, { treasury: 5 })
    tc.employees = 50  // High employee cost will bankrupt

    const result = weeklyCompanyTick(tc)
    expect(tc.treasury).toBeLessThanOrEqual(0)
    expect(tc.status).toBe('bankrupt')
    expect(result.statusChange).toBe('bankrupt')
  })
})

// ============================================================
// SEEDING
// ============================================================

describe('Trading Company — Seeding', () => {
  it('metropolis gets 2-3 companies', () => {
    const { min, max } = getCompanyCount('metropolis')
    expect(min).toBe(2)
    expect(max).toBe(3)
  })

  it('city gets 1-2', () => {
    const { min, max } = getCompanyCount('city')
    expect(min).toBe(1)
    expect(max).toBe(2)
  })

  it('village gets 0', () => {
    const { min, max } = getCompanyCount('village')
    expect(min).toBe(0)
    expect(max).toBe(0)
  })

  it('seedCompanies creates correct count for metropolis', () => {
    const companies = seedCompanies('node_waterdeep', 'Waterdeep', 'metropolis', 1)
    expect(companies.length).toBeGreaterThanOrEqual(1)
    expect(companies.length).toBeLessThanOrEqual(3)

    // First should be consortium (dominant)
    expect(companies[0].tier).toBe('consortium')
    expect(companies[0].status).toBe('dominant')
    expect(companies[0].treasury).toBeGreaterThan(50000)
  })

  it('seedCompanies returns nothing for villages', () => {
    const companies = seedCompanies('node_hamlet', 'Hamlet', 'village', 1)
    expect(companies).toHaveLength(0)
  })

  it('has enough seed names', () => {
    expect(SEED_COMPANY_NAMES.length).toBeGreaterThanOrEqual(10)
  })
})
