import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculatePowerTier,
  clergyFaithOutput,
  templeFaithOutput,
  requestIntervention,
  yearlyFaithTick,
  yearlyPantheonTick,
  dominantDeity,
  FAITH_TIER_THRESHOLDS,
  RANK_FAITH_MULTIPLIER,
  TEMPLE_BASE_FAITH,
  INTERVENTION_COST,
  type Deity,
  type ClergyMember,
  type Temple,
} from '../religion'

function makeDeity(overrides: Partial<Deity> = {}): Deity {
  return {
    id: 'deity_1',
    worldId: 'world_1',
    name: 'Mystra',
    titles: ['Lady of Mysteries'],
    alignment: 'NG',
    domains: [{ domain: 'magic', edicts: ['preserve the Weave'], anathema: ['destroy magic'], grantedPowers: ['arcana'] }],
    plane: 'Elysium',
    status: 'active',
    faithPool: 0,
    faithPerYear: 0,
    powerTier: 0,
    allies: [],
    enemies: [],
    ...overrides,
  }
}

function makeClergy(overrides: Partial<ClergyMember> = {}): ClergyMember {
  return {
    id: 'clergy_1',
    deityId: 'deity_1',
    npcId: 'npc_1',
    rank: 'priest',
    piety: 80,
    yearsOfService: 5,
    ...overrides,
  }
}

function makeTemple(overrides: Partial<Temple> = {}): Temple {
  return {
    id: 'temple_1',
    deityId: 'deity_1',
    settlementId: 'settlement_1',
    buildingId: 'building_1',
    size: 'temple',
    condition: 100,
    relicCount: 0,
    consecrated: true,
    ...overrides,
  }
}

describe('Religion Engine', () => {

  // ──────────────────────────────────────
  // FAITH TIERS
  // ──────────────────────────────────────

  describe('Power Tiers', () => {
    it('tier 0 for zero faith', () => {
      expect(calculatePowerTier(0)).toBe(0)
    })

    it('tier 1 at 100 faith', () => {
      expect(calculatePowerTier(100)).toBe(1)
    })

    it('tier 3 at 2000 faith', () => {
      expect(calculatePowerTier(2000)).toBe(3)
    })

    it('tier 5 at 50000+ faith', () => {
      expect(calculatePowerTier(60000)).toBe(5)
    })

    it('stays at lower tier below threshold', () => {
      expect(calculatePowerTier(99)).toBe(0)
      expect(calculatePowerTier(499)).toBe(1)
      expect(calculatePowerTier(1999)).toBe(2)
    })
  })

  // ──────────────────────────────────────
  // CLERGY FAITH OUTPUT
  // ──────────────────────────────────────

  describe('Clergy Faith', () => {
    it('acolyte with 100 piety = 1.0 faith/yr', () => {
      const c = makeClergy({ rank: 'acolyte', piety: 100 })
      expect(clergyFaithOutput(c)).toBe(1)
    })

    it('priest with 80 piety = 2.4 faith/yr', () => {
      const c = makeClergy({ rank: 'priest', piety: 80 })
      expect(clergyFaithOutput(c)).toBeCloseTo(2.4)
    })

    it('chosen with 100 piety = 100 faith/yr', () => {
      const c = makeClergy({ rank: 'chosen', piety: 100 })
      expect(clergyFaithOutput(c)).toBe(100)
    })

    it('zero piety = zero faith regardless of rank', () => {
      const c = makeClergy({ rank: 'chosen', piety: 0 })
      expect(clergyFaithOutput(c)).toBe(0)
    })

    it('rank multipliers are correctly defined', () => {
      expect(RANK_FAITH_MULTIPLIER.acolyte).toBe(1)
      expect(RANK_FAITH_MULTIPLIER.priest).toBe(3)
      expect(RANK_FAITH_MULTIPLIER.high_priest).toBe(10)
      expect(RANK_FAITH_MULTIPLIER.archpriest).toBe(25)
      expect(RANK_FAITH_MULTIPLIER.chosen).toBe(100)
    })
  })

  // ──────────────────────────────────────
  // TEMPLE FAITH OUTPUT
  // ──────────────────────────────────────

  describe('Temple Faith', () => {
    it('standard temple at full condition = 15 faith/yr', () => {
      const t = makeTemple()
      expect(templeFaithOutput(t)).toBe(15)
    })

    it('shrine generates 2 faith/yr', () => {
      const t = makeTemple({ size: 'shrine' })
      expect(templeFaithOutput(t)).toBe(2)
    })

    it('grand cathedral = 100 faith/yr', () => {
      const t = makeTemple({ size: 'grand_cathedral' })
      expect(templeFaithOutput(t)).toBe(100)
    })

    it('50% condition halves output', () => {
      const t = makeTemple({ condition: 50 })
      expect(templeFaithOutput(t)).toBe(7.5)
    })

    it('unconsecrated halves output', () => {
      const t = makeTemple({ consecrated: false })
      expect(templeFaithOutput(t)).toBe(7.5)
    })

    it('relics boost faith by 20% each', () => {
      const t = makeTemple({ relicCount: 3 })
      // 15 * (1 + 3*0.2) = 15 * 1.6 = 24
      expect(templeFaithOutput(t)).toBe(24)
    })

    it('all penalties stack', () => {
      const t = makeTemple({ condition: 50, consecrated: false, relicCount: 1 })
      // 15 * 1.2 * 0.5 * 0.5 = 4.5
      expect(templeFaithOutput(t)).toBeCloseTo(4.5)
    })
  })

  // ──────────────────────────────────────
  // DIVINE INTERVENTIONS
  // ──────────────────────────────────────

  describe('Divine Interventions', () => {
    it('succeeds when deity has enough faith', () => {
      const d = makeDeity({ faithPool: 100, powerTier: 2 })
      const result = requestIntervention(d, 'minor_miracle', 'node_1', 1, 'heal wounds')
      expect(result).not.toBeNull()
      expect(result!.faithCost).toBe(5)
      expect(d.faithPool).toBe(95)
    })

    it('fails when faith insufficient', () => {
      const d = makeDeity({ faithPool: 3, powerTier: 0 })
      const result = requestIntervention(d, 'minor_miracle', 'node_1', 1, 'heal')
      expect(result).toBeNull()
    })

    it('dead gods cannot intervene', () => {
      const d = makeDeity({ status: 'dead', faithPool: 10000, powerTier: 5 })
      const result = requestIntervention(d, 'minor_miracle', 'node_1', 1, 'heal')
      expect(result).toBeNull()
    })

    it('dormant gods pay double', () => {
      const d = makeDeity({ status: 'dormant', faithPool: 100, powerTier: 2 })
      const result = requestIntervention(d, 'minor_miracle', 'node_1', 1, 'heal')
      expect(result).not.toBeNull()
      expect(result!.faithCost).toBe(10) // double 5
    })

    it('resurrection requires tier 3+', () => {
      const d = makeDeity({ faithPool: 1000, powerTier: 2 })
      expect(requestIntervention(d, 'resurrection', 'n', 1, 'r')).toBeNull()

      const d2 = makeDeity({ faithPool: 1000, powerTier: 3 })
      expect(requestIntervention(d2, 'resurrection', 'n', 1, 'r')).not.toBeNull()
    })

    it('avatar_fragment requires tier 4+', () => {
      const d = makeDeity({ faithPool: 1000, powerTier: 3 })
      expect(requestIntervention(d, 'avatar_fragment', 'n', 1, 'a')).toBeNull()

      const d2 = makeDeity({ faithPool: 1000, powerTier: 4 })
      expect(requestIntervention(d2, 'avatar_fragment', 'n', 1, 'a')).not.toBeNull()
    })

    it('spending faith updates power tier', () => {
      const d = makeDeity({ faithPool: 105, powerTier: 1 }) // just above tier 1
      requestIntervention(d, 'minor_miracle', 'n', 1, 'heal') // costs 5
      expect(d.faithPool).toBe(100)
      expect(d.powerTier).toBe(1) // still tier 1

      requestIntervention(d, 'omen', 'n', 1, 'warning') // costs 10
      expect(d.faithPool).toBe(90)
      expect(d.powerTier).toBe(0) // dropped to tier 0
    })
  })

  // ──────────────────────────────────────
  // YEARLY FAITH TICK
  // ──────────────────────────────────────

  describe('Yearly Faith Tick', () => {
    it('accrues faith from clergy + temples', () => {
      const d = makeDeity({ faithPool: 50 })
      const clergy = [
        makeClergy({ piety: 100, rank: 'priest' }),        // 3.0
        makeClergy({ id: 'c2', piety: 50, rank: 'acolyte' }), // 0.5
      ]
      const temples = [makeTemple()]                        // 15.0
      const result = yearlyFaithTick(d, clergy, temples)
      expect(result.faithFromClergy).toBeCloseTo(3.5)
      expect(result.faithFromTemples).toBe(15)
      expect(result.totalAccrued).toBeCloseTo(18.5)
      expect(result.newFaith).toBeCloseTo(68.5)
    })

    it('dead god decays 10%/year with 0 accrual', () => {
      const d = makeDeity({ status: 'dead', faithPool: 1000 })
      const result = yearlyFaithTick(d, [makeClergy()], [makeTemple()])
      expect(result.totalAccrued).toBe(0)
      expect(result.newFaith).toBe(900) // 1000 * 0.9
    })

    it('dormant god gets 50% accrual', () => {
      const d = makeDeity({ status: 'dormant', faithPool: 0 })
      const clergy = [makeClergy({ piety: 100, rank: 'acolyte' })] // 1.0
      const result = yearlyFaithTick(d, clergy, [])
      expect(result.totalAccrued).toBe(0.5)
    })

    it('imprisoned god gets 25% accrual', () => {
      const d = makeDeity({ status: 'imprisoned', faithPool: 0 })
      const clergy = [makeClergy({ piety: 100, rank: 'acolyte' })] // 1.0
      const result = yearlyFaithTick(d, clergy, [])
      expect(result.totalAccrued).toBe(0.25)
    })

    it('detects tier changes', () => {
      const d = makeDeity({ faithPool: 90 })
      const clergy = [makeClergy({ piety: 100, rank: 'high_priest' })] // 10.0
      const result = yearlyFaithTick(d, clergy, [])
      expect(result.previousTier).toBe(0)
      expect(result.newTier).toBe(1) // crossed 100
      expect(result.tierChanged).toBe(true)
    })
  })

  // ──────────────────────────────────────
  // PANTHEON TICK
  // ──────────────────────────────────────

  describe('Pantheon', () => {
    it('ticks all deities in a world', () => {
      const d1 = makeDeity({ id: 'd1', faithPool: 50 })
      const d2 = makeDeity({ id: 'd2', name: 'Kelemvor', faithPool: 200 })
      const pantheon = { worldId: 'w1', deities: [d1, d2] }
      const clergy = [
        makeClergy({ deityId: 'd1', piety: 100, rank: 'priest' }),
        makeClergy({ id: 'c2', deityId: 'd2', piety: 80, rank: 'high_priest' }),
      ]
      const results = yearlyPantheonTick(pantheon, clergy, [])
      expect(results).toHaveLength(2)
    })

    it('finds dominant deity at settlement', () => {
      const clergy = [
        makeClergy({ deityId: 'd1', piety: 100, rank: 'high_priest' }), // 10
        makeClergy({ id: 'c2', deityId: 'd2', piety: 100, rank: 'acolyte' }),  // 1
      ]
      const temples = [
        makeTemple({ deityId: 'd1', settlementId: 's1' }),  // 15
        makeTemple({ id: 't2', deityId: 'd2', settlementId: 's1', size: 'shrine' }), // 2
      ]
      expect(dominantDeity(clergy, temples, 's1')).toBe('d1')
    })

    it('returns null for empty settlement', () => {
      expect(dominantDeity([], [], 's1')).toBeNull()
    })
  })
})
