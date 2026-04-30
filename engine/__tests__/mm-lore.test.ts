import { describe, it, expect } from 'vitest'
import { MMLore } from '../mm-lore.js'
import { createRumor, type Library, type KnowledgeEntry } from '../lore.js'

function fakeLibrary(over: Partial<Library> = {}): Library {
  return {
    id: over.id ?? 'lib_1',
    name: over.name ?? 'Civic Library',
    nodeId: over.nodeId ?? 'thundertree',
    settlementId: over.settlementId ?? 'thundertree',
    tier: over.tier ?? 'civic_library',
    bookCount: over.bookCount ?? 50,
    knowledgeIds: over.knowledgeIds ?? [],
    entryRequirement: over.entryRequirement ?? 'free',
  }
}

function fakeKnowledge(over: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: over.id ?? 'k_1',
    topic: over.topic ?? 'arcane theory',
    category: over.category ?? 'arcana',
    form: over.form ?? 'lore',
    accuracy: over.accuracy ?? 0.9,
    spread: over.spread ?? 10,
    discoveredDay: over.discoveredDay ?? 0,
    holderId: over.holderId ?? 'thundertree',
    holderType: over.holderType ?? 'library',
    researchDC: over.researchDC ?? 15,
  }
}

describe('MMLore — construction', () => {
  it('uses lore:<holderId> as id', () => {
    const mm = new MMLore('thundertree', 0)
    expect(mm.state.id).toBe('lore:thundertree')
    expect(mm.state.mmType).toBe('lore')
  })
})

describe('MMLore — monthly fold', () => {
  it('decays rumors and prunes expired ones', () => {
    const r1 = createRumor('orc raid', 'monster', 0.8, 'thundertree', 'npc1', 0, 60)
    const r2 = createRumor('lost map', 'geography', 0.6, 'thundertree', 'npc1', 0, 30)

    const mm = new MMLore('thundertree', 0, { rumors: [r1, r2] })

    // 2 months — r2 expires (30 day decay), r1 still around (60 day)
    mm.accumulatePotential(60, 60)
    const result = mm.resolve(60, undefined)

    expect(result.stateChanges.rumorsDecayed).toBe(2)
    expect(result.stateChanges.rumorsPruned).toBeGreaterThanOrEqual(1)
    expect(mm.getRumors().find(r => r.topic === 'lost map')).toBeUndefined()
  })

  it('lore knowledge entries are durable — not affected by decay', () => {
    const k = fakeKnowledge({ topic: 'metallurgy', form: 'codified' })
    const mm = new MMLore('thundertree', 0, { knowledge: [k] })

    mm.accumulatePotential(360, 360)   // a year
    const result = mm.resolve(360, undefined)
    expect(result.stateChanges.knowledgeEntries).toBe(1)
    expect(mm.getKnowledge()).toHaveLength(1)
  })

  it('library is exposed via getLibrary', () => {
    const lib = fakeLibrary({ tier: 'great_library', bookCount: 1500 })
    const mm = new MMLore('candlekeep', 0, { library: lib })
    expect(mm.getLibrary()?.tier).toBe('great_library')
    mm.accumulatePotential(30, 30)
    mm.resolve(30, undefined)
    expect(mm.getLibrary()?.tier).toBe('great_library')   // intact after tick
  })

  it('zero days resolves to no-op', () => {
    const mm = new MMLore('thundertree', 0)
    const result = mm.resolve(0, undefined)
    expect(result.stateChanges.monthsTicked).toBe(0)
  })

  it('cumulative tracks across multiple resolves', () => {
    const r1 = createRumor('rumor1', 'monster', 0.8, 'thundertree', 'n1', 0, 60)
    const mm = new MMLore('thundertree', 0, { rumors: [r1] })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, undefined)
    mm.accumulatePotential(30, 60)
    mm.resolve(60, undefined)
    const dom = mm.serialize().domain as ReturnType<MMLore['getDomainState']>
    expect(dom.cumulative.monthsTicked).toBe(2)
  })
})

describe('MMLore — mutators', () => {
  it('addRumor / addKnowledge / setLibrary work', () => {
    const mm = new MMLore('thundertree', 0)
    mm.addRumor(createRumor('test', 'monster', 0.5, 'x', 'y', 0, 30))
    mm.addKnowledge(fakeKnowledge({ id: 'k1' }))
    mm.setLibrary(fakeLibrary({ id: 'lib_x' }))
    expect(mm.getRumors()).toHaveLength(1)
    expect(mm.getKnowledge()).toHaveLength(1)
    expect(mm.getLibrary()?.id).toBe('lib_x')
  })
})
