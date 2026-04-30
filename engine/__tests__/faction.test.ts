/**
 * FACTION TESTS — Loyalty, Economy, Territory
 * ==============================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createFaction, addMember, addGoal,
  getLoyalty, shiftLoyalty, getLoyaltyStance, areAtWar,
  calculateProductionBonus, calculateFactionPriceModifier,
  tickFaction, resetFactionIdCounter,
  type Faction,
} from '../faction.js'

beforeEach(() => {
  resetFactionIdCounter()
})

// ============================================================
// FACTION CREATION
// ============================================================

describe('Faction — Creation', () => {
  it('creates a faction with defaults', () => {
    const f = createFaction('Zhentarim', 'criminal', 'darkhold')
    expect(f.id).toBe('faction_1')
    expect(f.name).toBe('Zhentarim')
    expect(f.type).toBe('criminal')
    expect(f.headquartersNodeId).toBe('darkhold')
    expect(f.controlledNodes).toContain('darkhold')
    expect(f.influence['darkhold']).toBe(50)
    expect(f.treasury).toBe(0)
    expect(f.members).toHaveLength(0)
  })

  it('accepts initial options', () => {
    const f = createFaction('Harpers', 'guild', 'waterdeep', {
      motto: 'Down with tyranny',
      treasury: 10000,
      controlledNodes: ['waterdeep', 'silverymoon'],
      loyalties: { 'zhentarim_id': -80 },
    })
    expect(f.motto).toBe('Down with tyranny')
    expect(f.treasury).toBe(10000)
    expect(f.controlledNodes).toHaveLength(2)
    expect(f.loyalties['zhentarim_id']).toBe(-80)
  })
})

// ============================================================
// LOYALTY GRAPH — The alignment system
// ============================================================

describe('Faction — Loyalty', () => {
  it('default loyalty is 0 (neutral)', () => {
    const f = createFaction('Test', 'guild', 'hub')
    expect(getLoyalty(f.loyalties, 'stranger')).toBe(0)
  })

  it('shiftLoyalty modifies value', () => {
    const f = createFaction('Test', 'guild', 'hub')
    shiftLoyalty(f.loyalties, 'ally', 50)
    expect(getLoyalty(f.loyalties, 'ally')).toBe(50)
    shiftLoyalty(f.loyalties, 'ally', 30)
    expect(getLoyalty(f.loyalties, 'ally')).toBe(80)
  })

  it('loyalty is clamped to -100..+100', () => {
    const loyalties: Record<string, number> = {}
    shiftLoyalty(loyalties, 'best_friend', 200)
    expect(getLoyalty(loyalties, 'best_friend')).toBe(100)
    shiftLoyalty(loyalties, 'worst_enemy', -200)
    expect(getLoyalty(loyalties, 'worst_enemy')).toBe(-100)
  })

  it('loyalty stance labels are correct', () => {
    expect(getLoyaltyStance(90)).toBe('blood_oath')
    expect(getLoyaltyStance(60)).toBe('allied')
    expect(getLoyaltyStance(30)).toBe('friendly')
    expect(getLoyaltyStance(0)).toBe('neutral')
    expect(getLoyaltyStance(-30)).toBe('unfriendly')
    expect(getLoyaltyStance(-60)).toBe('hostile')
    expect(getLoyaltyStance(-90)).toBe('sworn_enemy')
  })

  it('areAtWar requires both factions below -60', () => {
    const a = createFaction('A', 'guild', 'ha')
    const b = createFaction('B', 'guild', 'hb')

    // Only A hates B
    shiftLoyalty(a.loyalties, b.id, -80)
    expect(areAtWar(a, b)).toBe(false)

    // Now B hates A too
    shiftLoyalty(b.loyalties, a.id, -80)
    expect(areAtWar(a, b)).toBe(true)
  })
})

// ============================================================
// MEMBERS & RANKS
// ============================================================

describe('Faction — Members', () => {
  it('adds members with skill data', () => {
    const f = createFaction('Smiths Guild', 'guild', 'hub')
    addMember(f, 'npc_1', 'Thorin Ironforge', 'member', 1, {
      primarySkill: 'smithing',
      skillModifier: 7,
    })
    expect(f.members).toHaveLength(1)
    expect(f.members[0].primarySkill).toBe('smithing')
    expect(f.members[0].skillModifier).toBe(7)
  })

  it('supports secret membership', () => {
    const f = createFaction('Shadow Thieves', 'criminal', 'hub')
    addMember(f, 'npc_spy', 'The Mole', 'trusted', 1, { isSecret: true })
    expect(f.members[0].isSecret).toBe(true)
  })
})

// ============================================================
// ECONOMIC INFLUENCE — NPCs affect production
// ============================================================

describe('Faction — Economic Influence', () => {
  it('skilled members give production bonuses', () => {
    const f = createFaction('Smiths Guild', 'guild', 'hub')
    addMember(f, 'n1', 'Smith A', 'member', 1, { primarySkill: 'smithing', skillModifier: 5 })
    addMember(f, 'n2', 'Smith B', 'member', 1, { primarySkill: 'smithing', skillModifier: 7 })

    const bonus = calculateProductionBonus(f, 'weapons')
    expect(bonus).toBeGreaterThan(0) // average skill × count factor
  })

  it('no bonus for unrelated commodity', () => {
    const f = createFaction('Smiths Guild', 'guild', 'hub')
    addMember(f, 'n1', 'Smith', 'member', 1, { primarySkill: 'smithing', skillModifier: 10 })

    const bonus = calculateProductionBonus(f, 'fish')
    expect(bonus).toBe(0) // smithing doesn't make fish
  })

  it('price modifier scales with hub influence', () => {
    const f = createFaction('Merchant League', 'merchant', 'hub')
    f.influence['market_hub'] = 80
    f.commodityInfluence['spices'] = { priceModifier: 1.3, supplyControl: 0.5 }

    const mod = calculateFactionPriceModifier(f, 'market_hub', 'spices')
    expect(mod).toBeGreaterThan(1.0) // price goes up
    expect(mod).toBeLessThanOrEqual(1.3) // capped by influence fraction
  })

  it('low influence = no price effect', () => {
    const f = createFaction('Weak Guild', 'guild', 'hub')
    f.influence['market_hub'] = 5 // below 10 = no effect
    f.commodityInfluence['grain'] = { priceModifier: 0.7, supplyControl: 0.3 }

    expect(calculateFactionPriceModifier(f, 'market_hub', 'grain')).toBe(1.0)
  })
})

// ============================================================
// GOALS
// ============================================================

describe('Faction — Goals', () => {
  it('adds typed goals', () => {
    const f = createFaction('Crusaders', 'religious', 'temple_city')
    addGoal(f, 'spread_faith', 'Convert the northern settlements', 8, 'north_region')

    expect(f.goals).toHaveLength(1)
    expect(f.goals[0].type).toBe('spread_faith')
    expect(f.goals[0].priority).toBe(8)
    expect(f.goals[0].progress).toBe(0)
  })
})

// ============================================================
// TICK — Weekly advancement
// ============================================================

describe('Faction — Tick', () => {
  it('processes income and expenses', () => {
    const f = createFaction('Rich Guild', 'merchant', 'hub', { treasury: 1000 })
    f.weeklyIncome = 200
    f.weeklyExpenses = 50
    const result = tickFaction(f)

    expect(result.treasuryDelta).toBe(150)
    expect(f.treasury).toBe(1150)
  })

  it('treasury cannot go below 0', () => {
    const f = createFaction('Broke Guild', 'guild', 'hub', { treasury: 10 })
    f.weeklyExpenses = 500
    tickFaction(f)

    expect(f.treasury).toBe(0)
  })

  it('advances goal progress', () => {
    const f = createFaction('Goal Guild', 'guild', 'hub', { treasury: 100 })
    addGoal(f, 'accumulate_wealth', 'Get rich', 10)
    addMember(f, 'n1', 'Worker', 'member', 1)

    tickFaction(f)
    expect(f.goals[0].progress).toBeGreaterThan(0)
  })

  it('grows influence in controlled nodes', () => {
    const f = createFaction('Growing', 'government', 'capital')
    f.influence['capital'] = 50

    tickFaction(f)
    expect(f.influence['capital']).toBeGreaterThan(50)
  })
})
