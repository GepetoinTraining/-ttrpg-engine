import { describe, it, expect } from 'vitest'
import {
  createRumor,
  spreadRumor,
  decayRumor,
  attemptResearch,
  appraiseBook,
  knowledgeFlowTick,
  LIBRARY_CAPACITY,
  LIBRARY_RESEARCH_BONUS,
  type Library,
  type Book,
} from '../lore'

describe('Lore Engine', () => {

  describe('Rumors', () => {
    it('creates rumor with full fidelity', () => {
      const r = createRumor('Dragon sighted', 'monster', 0.9, 'npc_1', 'npc_source', 1)
      expect(r.fidelity).toBe(1.0)
      expect(r.form).toBe('rumor')
      expect(r.accuracy).toBe(0.9)
    })

    it('spreading degrades fidelity on low roll', () => {
      const r = createRumor('Secret passage', 'geography', 1.0, 'npc_1', 'src', 1)
      const spread = spreadRumor(r, 'npc_2', 5) // low roll
      expect(spread.fidelity).toBeLessThan(1.0)
      expect(spread.holderId).toBe('npc_2')
      expect(spread.sourceChain).toContain('npc_2')
    })

    it('spreading preserves fidelity on high roll', () => {
      const r = createRumor('Market prices', 'trade', 1.0, 'npc_1', 'src', 1)
      const spread = spreadRumor(r, 'npc_2', 18) // high roll
      expect(spread.fidelity).toBe(1.0)
    })

    it('accuracy degrades proportionally to fidelity', () => {
      const r = createRumor('Secret', 'secret', 1.0, 'npc_1', 'src', 1)
      const s1 = spreadRumor(r, 'npc_2', 1) // bad roll, -0.1 fidelity
      expect(s1.accuracy).toBeLessThan(1.0)
    })

    it('decays over time', () => {
      const r = createRumor('Old news', 'history', 0.8, 'npc_1', 'src', 1, 30)
      const forgotten = decayRumor(r, 31)
      expect(forgotten).toBe(true)
    })

    it('survives within decay window', () => {
      const r = createRumor('Fresh news', 'politics', 0.8, 'npc_1', 'src', 1, 60)
      const forgotten = decayRumor(r, 7)
      expect(forgotten).toBe(false)
      expect(r.fidelity).toBeLessThan(1.0)
    })
  })

  describe('Libraries', () => {
    it('has 5 tiers', () => {
      expect(Object.keys(LIBRARY_CAPACITY)).toHaveLength(5)
    })

    it('great_library holds 2000 works', () => {
      expect(LIBRARY_CAPACITY.great_library).toBe(2000)
    })

    it('research bonus scales with tier', () => {
      expect(LIBRARY_RESEARCH_BONUS.private_shelf).toBeLessThan(LIBRARY_RESEARCH_BONUS.great_library)
    })
  })

  describe('Research', () => {
    const library: Library = {
      id: 'lib_1', name: 'Candlekeep', nodeId: 'node_1', settlementId: 's1',
      tier: 'great_library', bookCount: 1500, knowledgeIds: [],
      entryRequirement: 'book_donation',
    }

    it('succeeds with high check', () => {
      const r = attemptResearch({
        researcherId: 'char_1', topic: 'Ancient spell', category: 'arcana',
        skillMod: 8, daysSpent: 14, d20: 18,
      }, 15, library)
      expect(r.success).toBe(true)
      expect(r.knowledgeEntry).toBeDefined()
    })

    it('fails with low check', () => {
      const r = attemptResearch({
        researcherId: 'char_1', topic: 'Secret', category: 'secret',
        skillMod: 2, daysSpent: 1, d20: 3,
      }, 20)
      expect(r.success).toBe(false)
    })

    it('library bonus helps pass DC', () => {
      const attempt = {
        researcherId: 'c1', topic: 'History', category: 'history' as const,
        skillMod: 3, daysSpent: 7, d20: 10,
      }
      const withoutLib = attemptResearch(attempt, 15)
      const withLib = attemptResearch({ ...attempt }, 15, library)
      // With library (+10 bonus + 1 week) should pass, without should fail
      expect(withoutLib.success).toBe(false)
      expect(withLib.success).toBe(true)
    })

    it('higher margin yields better knowledge form', () => {
      const r = attemptResearch({
        researcherId: 'c1', topic: 'Lore', category: 'history',
        skillMod: 10, daysSpent: 28, d20: 20,
      }, 10, library)
      expect(r.formDiscovered).toBe('codified') // huge margin
    })

    it('time spent gives bonus', () => {
      const quick = attemptResearch({
        researcherId: 'c1', topic: 'T', category: 'nature',
        skillMod: 5, daysSpent: 1, d20: 10,
      }, 16)
      const slow = attemptResearch({
        researcherId: 'c1', topic: 'T', category: 'nature',
        skillMod: 5, daysSpent: 28, d20: 10, // +4 time bonus
      }, 16)
      expect(quick.success).toBe(false)
      expect(slow.success).toBe(true)
    })
  })

  describe('Books', () => {
    it('appraises based on rarity and category', () => {
      const common: Book = {
        id: 'b1', title: 'A History', author: 'Unknown',
        knowledgeIds: ['k1', 'k2'], category: 'history', language: 'Common',
        rarity: 'common', valueGP: 0, copyable: true,
      }
      const rare: Book = {
        ...common, id: 'b2', category: 'arcana', rarity: 'rare',
      }
      expect(appraiseBook(rare)).toBeGreaterThan(appraiseBook(common))
    })

    it('more knowledge entries = higher value', () => {
      const small: Book = {
        id: 'b1', title: 'Booklet', author: 'A',
        knowledgeIds: ['k1'], category: 'trade', language: 'Common',
        rarity: 'common', valueGP: 0, copyable: true,
      }
      const big: Book = { ...small, knowledgeIds: ['k1', 'k2', 'k3', 'k4', 'k5'] }
      expect(appraiseBook(big)).toBeGreaterThan(appraiseBook(small))
    })

    it('secret category has highest multiplier', () => {
      const base: Book = {
        id: 'b', title: 'T', author: 'A', knowledgeIds: ['k'],
        category: 'history', language: 'Common', rarity: 'common', valueGP: 0, copyable: true,
      }
      const secret: Book = { ...base, category: 'secret' }
      expect(appraiseBook(secret)).toBeGreaterThan(appraiseBook(base))
    })
  })

  describe('Knowledge Flow', () => {
    it('rumors flow along trade routes', () => {
      const result = knowledgeFlowTick('s1', 's2', 5, 2)
      expect(result.newRumors).toBe(5)
      expect(result.booksTraded).toBe(2)
    })

    it('libraries absorb more knowledge', () => {
      const lib: Library = {
        id: 'l', name: 'Archive', nodeId: 'n', settlementId: 's2',
        tier: 'great_library', bookCount: 100, knowledgeIds: [], entryRequirement: 'fee',
      }
      const withLib = knowledgeFlowTick('s1', 's2', 10, 0, lib)
      const withoutLib = knowledgeFlowTick('s1', 's2', 10, 0)
      expect(withLib.knowledgeDisseminated).toBeGreaterThan(withoutLib.knowledgeDisseminated)
    })
  })
})
