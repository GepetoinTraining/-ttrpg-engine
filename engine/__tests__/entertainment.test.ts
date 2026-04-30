import { describe, it, expect } from 'vitest'
import {
  resolvePerformance,
  patronBenefit,
  calculateCulturalScore,
  VENUE_CAPACITY,
  VENUE_PRESTIGE,
  type Performer,
  type Patronage,
} from '../entertainment'

function makePerformer(overrides: Partial<Performer> = {}): Performer {
  return {
    id: 'perf_1', npcId: 'npc_1',
    specialties: ['music', 'storytelling'],
    skillMod: 5, reputation: 50,
    homeSettlementId: 'settlement_1',
    ...overrides,
  }
}

describe('Entertainment Engine', () => {   
  describe('Venues', () => {
    it('has 6 venue types', () => {
      expect(Object.keys(VENUE_CAPACITY)).toHaveLength(6)
    })
    it('theater has higher capacity than tavern', () => {
      expect(VENUE_CAPACITY.theater).toBeGreaterThan(VENUE_CAPACITY.tavern)
    })
    it('court has highest prestige', () => {
      expect(VENUE_PRESTIGE.court).toBe(5)
    })
  })

  describe('Performance Resolution', () => {
    it('high roll = masterwork quality', () => {
      const p = makePerformer({ skillMod: 10 })
      const r = resolvePerformance(p, 'theater', 'music', 20, 1.0)
      expect(r.quality).toBe('masterwork')
      expect(r.revenue).toBeGreaterThan(0)
    })

    it('low roll = disaster', () => {
      const p = makePerformer({ skillMod: 0 })
      const r = resolvePerformance(p, 'tavern', 'comedy', 1, 1.0)
      expect(r.quality).toBe('disaster')
      expect(r.revenue).toBe(0)
    })

    it('revenue scales with audience and prestige', () => {
      const p = makePerformer()
      const small = resolvePerformance(p, 'tavern', 'music', 15, 0.5)
      const big = resolvePerformance(p, 'arena', 'music', 15, 1.0)
      expect(big.revenue).toBeGreaterThan(small.revenue)
    })

    it('masterwork gives +5 reputation', () => {
      const p = makePerformer({ reputation: 50, skillMod: 15 })
      const r = resolvePerformance(p, 'court', 'poetry', 20, 1.0)
      expect(r.reputationChange).toBe(5)
      expect(p.reputation).toBe(55)
    })

    it('disaster gives -3 reputation', () => {
      const p = makePerformer({ reputation: 50, skillMod: 0 })
      resolvePerformance(p, 'street', 'dance', 1, 1.0)
      expect(p.reputation).toBe(47)
    })

    it('bards collect rumors on good performances', () => {
      const p = makePerformer({ skillMod: 10 })
      const r = resolvePerformance(p, 'tavern', 'storytelling', 18, 1.0)
      expect(r.rumorsCollected).toBeGreaterThan(0)
    })

    it('disaster collects no rumors', () => {
      const p = makePerformer({ skillMod: 0 })
      const r = resolvePerformance(p, 'tavern', 'music', 1, 0.5)
      expect(r.rumorsCollected).toBe(0)
    })

    it('reputation clamps to 0-100', () => {
      const p = makePerformer({ reputation: 1, skillMod: 0 })
      resolvePerformance(p, 'street', 'dance', 1, 1.0)
      expect(p.reputation).toBe(0) // not negative
    })
  })

  describe('Patronage', () => {
    it('high-rep performer gives more cultural influence', () => {
      const low = makePerformer({ reputation: 20 })
      const high = makePerformer({ reputation: 80 })
      const patronage: Patronage = { patronId: 'noble_1', performerId: 'p', weeklyStipend: 10, exclusivity: false, startedDay: 1 }
      expect(patronBenefit(high, patronage).culturalInfluence).toBeGreaterThan(patronBenefit(low, patronage).culturalInfluence)
    })

    it('exclusivity adds influence bonus', () => {
      const p = makePerformer({ reputation: 50 })
      const excl: Patronage = { patronId: 'n', performerId: 'p', weeklyStipend: 10, exclusivity: true, startedDay: 1 }
      const open: Patronage = { patronId: 'n', performerId: 'p', weeklyStipend: 10, exclusivity: false, startedDay: 1 }
      expect(patronBenefit(p, excl).culturalInfluence).toBeGreaterThan(patronBenefit(p, open).culturalInfluence)
    })
  })

  describe('Cultural Score', () => {
    it('calculates from local performers', () => {
      const performers = [
        makePerformer({ reputation: 40 }),
        makePerformer({ id: 'p2', reputation: 60 }),
      ]
      const score = calculateCulturalScore('settlement_1', performers, 50)
      expect(score.entertainmentScore).toBe(100) // 40 + 60
      expect(score.moraleBonus).toBe(5) // 100 / 20
    })

    it('morale capped at 10', () => {
      const performers = Array.from({ length: 10 }, (_, i) =>
        makePerformer({ id: `p_${i}`, reputation: 100 })
      )
      const score = calculateCulturalScore('settlement_1', performers, 100)
      expect(score.moraleBonus).toBe(10)
    })
  })
})
