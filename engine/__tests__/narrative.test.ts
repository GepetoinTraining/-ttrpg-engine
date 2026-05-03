import { describe, it, expect } from 'vitest'
import {
  calculateProgress, suggestNextBeat, escalateDepth, shouldConnect,
  axesToAlignment, alignmentToAxes,
  type CampaignNarrative, type Beat, type Quest, type Arc,
  type RabbitHole, type MoralAxis,
} from '../narrative'

// ============================================================
// HELPERS
// ============================================================

function makeArc(overrides: Partial<Arc> = {}): Arc {
  return {
    id: 'arc-1', campaignId: 'c-1', name: 'Main Arc', arcType: 'main',
    order: 1, status: 'active', themes: [], tags: [],
    objective: { title: 'Save the world', status: 'active' },
    ...overrides,
  }
}

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1', arcId: 'arc-1', name: 'Find the Key', questType: 'main',
    objective: { title: 'Find the key', status: 'active' },
    subObjectives: [], prerequisites: [], isSecret: false, tags: [],
    ...overrides,
  }
}

function makeBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    id: 'b-1', questId: 'q-1', name: 'The hook', beatType: 'hook',
    order: 1, status: 'planned', triggers: [], npcsInvolved: [],
    ...overrides,
  }
}

function makeNarrative(overrides: Partial<CampaignNarrative> = {}): CampaignNarrative {
  return {
    campaignId: 'c-1',
    campaignObjective: { title: 'Defeat the Lich', status: 'active' },
    arcs: [makeArc()],
    quests: [makeQuest()],
    beats: [makeBeat(), makeBeat({ id: 'b-2', order: 2, beatType: 'rising', status: 'occurred' })],
    villains: [], patrons: [], conflicts: [], rabbitHoles: [],
    ...overrides,
  }
}

// ============================================================
// PROGRESS TRACKING
// ============================================================

describe('Narrative — Progress', () => {
  it('should calculate 0% when no quests completed', () => {
    const narrative = makeNarrative()
    const progress = calculateProgress(narrative)
    expect(progress.overallPercent).toBe(0)
    expect(progress.quests.active).toBe(1)
    expect(progress.quests.completed).toBe(0)
  })

  it('should calculate 100% when campaign objective completed', () => {
    const narrative = makeNarrative({
      campaignObjective: { title: 'Defeat the Lich', status: 'completed' },
    })
    const progress = calculateProgress(narrative)
    expect(progress.overallPercent).toBe(100)
  })

  it('should track quest beat progress for active quests', () => {
    const narrative = makeNarrative()
    const progress = calculateProgress(narrative)
    expect(progress.currentQuestProgress).toHaveLength(1)
    expect(progress.currentQuestProgress[0].totalBeats).toBe(2)
    expect(progress.currentQuestProgress[0].completedBeats).toBe(1)
  })

  it('should count hidden quests', () => {
    const narrative = makeNarrative({
      quests: [makeQuest({ isSecret: true })],
    })
    const progress = calculateProgress(narrative)
    expect(progress.quests.hidden).toBe(1)
  })

  it('should count completed arcs', () => {
    const narrative = makeNarrative({
      arcs: [
        makeArc({ id: 'a1', status: 'completed' }),
        makeArc({ id: 'a2', status: 'active' }),
      ],
    })
    const progress = calculateProgress(narrative)
    expect(progress.arcs.completed).toBe(1)
    expect(progress.arcs.active).toBe(1)
  })
})

// ============================================================
// PACING ENGINE
// ============================================================

describe('Narrative — Pacing', () => {
  it('should suggest downtime when party HP is low', () => {
    const result = suggestNextBeat([], 2, 0.2)
    expect(result.suggestedBeatType).toBe('downtime')
    expect(result.reason).toContain('rest')
  })

  it('should prevent 3 combats in a row', () => {
    const result = suggestNextBeat(['encounter', 'encounter', 'encounter'], 3, 0.8)
    expect(result.suggestedBeatType).toBe('discovery')
    expect(result.reason).toContain('Too many combats')
  })

  it('should prevent 3 narrative lulls in a row', () => {
    const result = suggestNextBeat(['downtime', 'downtime', 'downtime'], 3, 0.8)
    expect(result.suggestedBeatType).toBe('hook')
    expect(result.reason).toContain('slow')
  })

  it('should use bias for normal pacing', () => {
    const result = suggestNextBeat(['hook', 'rising'], 2, 0.8, 'combat')
    expect(result.suggestedBeatType).toBe('encounter')
  })

  it('should increase tension with more active quests', () => {
    const few = suggestNextBeat([], 1, 0.8)
    const many = suggestNextBeat([], 8, 0.8)
    expect(many.tension).toBeGreaterThan(few.tension)
  })
})

// ============================================================
// DEPTH / RABBIT HOLE SYSTEM
// ============================================================

describe('Narrative — Rabbit Holes', () => {
  function makeHole(): RabbitHole {
    return {
      id: 'rh-1', campaignId: 'c-1',
      originDescription: 'A suspicious apple seller',
      currentDepth: 0, depthLevel: 'surface',
      targetThreadId: 'arc-1', targetThreadName: 'Main Arc',
      connectionType: 'information',
      connectionDescription: 'He saw the ritual site',
      layers: [], status: 'active',
    }
  }

  it('should escalate through depth levels', () => {
    const hole = makeHole()
    expect(escalateDepth(hole)).toBe('hook')
    expect(hole.currentDepth).toBe(1)
    expect(escalateDepth(hole)).toBe('investigation')
    expect(escalateDepth(hole)).toBe('mini_quest')
    expect(escalateDepth(hole)).toBe('resolution')
    expect(escalateDepth(hole)).toBe('side_arc')
  })

  it('should signal connection at depth 4+', () => {
    const hole = makeHole()
    hole.currentDepth = 3
    escalateDepth(hole) // → resolution
    expect(shouldConnect(hole)).toBe(true)
  })

  it('should NOT signal connection below depth 4', () => {
    const hole = makeHole()
    expect(shouldConnect(hole)).toBe(false)
    escalateDepth(hole) // → hook
    expect(shouldConnect(hole)).toBe(false)
  })
})

// ============================================================
// MORAL PHYSICS — Alignment conversion
// ============================================================

describe('Narrative — Alignment', () => {
  it('should convert axes to alignment', () => {
    expect(axesToAlignment({ lawChaos: 75, goodEvil: 75 })).toBe('lawful_good')
    expect(axesToAlignment({ lawChaos: -75, goodEvil: -75 })).toBe('chaotic_evil')
    expect(axesToAlignment({ lawChaos: 0, goodEvil: 0 })).toBe('true_neutral')
    expect(axesToAlignment({ lawChaos: 75, goodEvil: 0 })).toBe('lawful_neutral')
    expect(axesToAlignment({ lawChaos: 0, goodEvil: -75 })).toBe('neutral_evil')
  })

  it('should convert alignment back to axes', () => {
    expect(alignmentToAxes('lawful_good')).toEqual({ lawChaos: 75, goodEvil: 75 })
    expect(alignmentToAxes('chaotic_evil')).toEqual({ lawChaos: -75, goodEvil: -75 })
    expect(alignmentToAxes('true_neutral')).toEqual({ lawChaos: 0, goodEvil: 0 })
  })

  it('should round-trip alignment', () => {
    const alignments = [
      'lawful_good', 'neutral_good', 'chaotic_good',
      'lawful_neutral', 'true_neutral', 'chaotic_neutral',
      'lawful_evil', 'neutral_evil', 'chaotic_evil',
    ] as const
    for (const a of alignments) {
      expect(axesToAlignment(alignmentToAxes(a))).toBe(a)
    }
  })
})
