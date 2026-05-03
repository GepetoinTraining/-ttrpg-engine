import { describe, it, expect } from 'vitest'
import { MMNarrative } from '../mm-narrative'
import type { CampaignNarrative, Arc, Quest, Beat, Objective, RabbitHole } from '../narrative'

function obj(over: Partial<Objective> = {}): Objective {
  return {
    title: over.title ?? 'do the thing',
    description: over.description,
    status: over.status ?? 'active',
  }
}

function arc(over: Partial<Arc>): Arc {
  return {
    id: over.id ?? 'arc_1',
    campaignId: over.campaignId ?? 'cmpgn_1',
    name: over.name ?? 'Main Arc',
    arcType: over.arcType ?? 'main',
    order: over.order ?? 0,
    objective: over.objective ?? obj({}),
    status: over.status ?? 'active',
    themes: over.themes ?? [],
    tags: over.tags ?? [],
  }
}

function quest(over: Partial<Quest>): Quest {
  return {
    id: over.id ?? 'q_1',
    arcId: over.arcId ?? 'arc_1',
    name: over.name ?? 'Test Quest',
    questType: over.questType ?? 'main',
    objective: over.objective ?? obj({}),
    subObjectives: over.subObjectives ?? [],
    prerequisites: over.prerequisites ?? [],
    isSecret: over.isSecret ?? false,
    tags: over.tags ?? [],
  }
}

function fakeNarrative(over: Partial<CampaignNarrative> = {}): CampaignNarrative {
  return {
    campaignId: over.campaignId ?? 'cmpgn_1',
    campaignObjective: over.campaignObjective ?? obj({ title: 'main_obj' }),
    arcs: over.arcs ?? [arc({ id: 'arc_1' })],
    quests: over.quests ?? [quest({ id: 'q_1' })],
    beats: over.beats ?? [],
    villains: over.villains ?? [],
    patrons: over.patrons ?? [],
    conflicts: over.conflicts ?? [],
    rabbitHoles: over.rabbitHoles ?? [],
  }
}

describe('MMNarrative — construction', () => {
  it('uses narrative:<campaignId> as id', () => {
    const mm = new MMNarrative('toril', fakeNarrative(), 0)
    expect(mm.state.id).toBe('narrative:cmpgn_1')
    expect(mm.state.mmType).toBe('narrative')
    expect(mm.state.nodeId).toBe('toril')
  })
})

describe('MMNarrative — weekly fold', () => {
  it('snapshots progress on resolve', () => {
    const mm = new MMNarrative('toril', fakeNarrative(), 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, undefined)
    const progress = mm.getProgress()
    expect(progress).not.toBeNull()
    expect(progress!.quests.active).toBeGreaterThanOrEqual(1)
  })

  it('suggests a next beat', () => {
    const mm = new MMNarrative('toril', fakeNarrative(), 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, undefined)
    const sug = mm.getSuggestion()
    expect(sug).not.toBeNull()
    expect(typeof sug!.suggestedBeatType).toBe('string')
  })

  it('low party HP biases suggestion to downtime', () => {
    const mm = new MMNarrative('toril', fakeNarrative(), 0, { partyHpPercent: 0.2 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, undefined)
    expect(mm.getSuggestion()?.suggestedBeatType).toBe('downtime')
  })

  it('zero days is no-op', () => {
    const mm = new MMNarrative('toril', fakeNarrative(), 0)
    const result = mm.resolve(0, undefined)
    expect(result.stateChanges.weeksTicked).toBe(0)
  })
})

describe('MMNarrative — recordBeatOccurred', () => {
  it('marks the beat occurred and tracks recent type', () => {
    const beat: Beat = {
      id: 'b_1',
      questId: 'q_1',
      name: 'Goblin ambush',
      beatType: 'encounter',
      order: 0,
      status: 'active',
      triggers: [],
      npcsInvolved: [],
    }
    const narrative = fakeNarrative({ beats: [beat] })
    const mm = new MMNarrative('toril', narrative, 0)
    mm.recordBeatOccurred('b_1', 'encounter')
    expect(beat.status).toBe('occurred')
    const dom = mm.serialize().domain as ReturnType<MMNarrative['getDomainState']>
    expect(dom.recentBeatTypes).toContain('encounter')
  })

  it('caps recentBeatTypes at 10 entries', () => {
    const mm = new MMNarrative('toril', fakeNarrative(), 0)
    for (let i = 0; i < 15; i++) {
      mm.recordBeatOccurred('x', 'encounter')
    }
    const dom = mm.serialize().domain as ReturnType<MMNarrative['getDomainState']>
    expect(dom.recentBeatTypes.length).toBe(10)
  })
})

describe('MMNarrative — rabbit holes', () => {
  it('escalates depth of an active rabbit hole over weeks', () => {
    const hole: RabbitHole = {
      id: 'rh_1',
      campaignId: 'cmpgn_1',
      originDescription: 'A door no one expected',
      currentDepth: 0,
      depthLevel: 'surface',
      targetThreadId: 'arc_1',
      targetThreadName: 'Main Arc',
      connectionType: 'foreshadowing',
      connectionDescription: 'Connects to the main villain',
      layers: [],
      status: 'active',
    }
    const mm = new MMNarrative('toril', fakeNarrative({ rabbitHoles: [hole] }), 0)
    mm.accumulatePotential(28, 28)   // 4 weeks
    const result = mm.resolve(28, undefined)
    expect(result.stateChanges.rabbitHolesEscalated).toBeGreaterThanOrEqual(0)
    // After 4 weeks, depth should have advanced
    expect(hole.currentDepth).toBeGreaterThan(0)
  })
})
