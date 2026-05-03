/**
 * MM_INTELLIGENCE TESTS — adapter for decayMemories + agent state.
 */

import { describe, it, expect } from 'vitest'
import { MMIntelligence, agentEntityId } from '../mm-intelligence'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import {
  type IdentityAnchor,
  type KnowledgeBoundary,
  type AgentMemory,
  type MemoryType,
} from '../intelligence'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate", parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeIdentity(overrides: Partial<IdentityAnchor> = {}): IdentityAnchor {
  return {
    agentId: 'duke_alric',
    agentType: 'npc',
    name: 'Duke Alric',
    coreIdentity: 'A weathered duke ruling Baldur\'s Gate',
    personality: {
      values: ['order', 'family'],
      fears: ['losing the city'],
      desires: ['legacy'],
      quirks: ['polishes sword when nervous'],
      flaws: ['proud'],
    },
    speech: {
      vocabulary: 'educated',
      sentenceLength: 'normal',
      formality: 'formal',
    },
    constraints: {
      canReveal: ['city affairs'],
      cannotReveal: ['the cult under the docks'],
      mustMention: [],
      canLie: true,
      canFight: true,
      canTrade: false,
    },
    partyRelationship: 'unknown',
    ...overrides,
  }
}

function makeBoundary(): KnowledgeBoundary {
  return {
    entries: [],
    exclusions: [],
    allowedScopes: ['personal', 'witnessed', 'location', 'faction', 'party'],
  }
}

function makeMemory(overrides: Partial<AgentMemory> = {}): AgentMemory {
  return {
    id: 'mem_1',
    memoryType: 'episodic',
    content: 'Met Kaelith at the tavern',
    worldDay: 0,
    importance: 5,
    vividness: 1.0,
    tags: ['kaelith', 'tavern'],
    valence: 2,
    ...overrides,
  }
}

describe('MMIntelligence — construction + registration', () => {
  it('id derived from identity.agentId; nodeId set explicitly', () => {
    const id = makeIdentity()
    const mm = new MMIntelligence(id, makeBoundary(), [], 'baldurs_gate', 0)
    expect(mm.state.id).toBe(agentEntityId(id))
    expect(mm.state.id).toBe('agent:duke_alric')
    expect(mm.state.nodeId).toBe('baldurs_gate')
    expect(mm.state.mmType).toBe('intelligence')
  })

  it('registerWith puts agent in TP entity registry', () => {
    const tp = makeTP()
    const id = makeIdentity()
    const mm = new MMIntelligence(id, makeBoundary(), [], 'baldurs_gate', 0)
    mm.registerWith(tp)
    const at = tp.getEntitiesAt('baldurs_gate')
    const agent = at.find(e => e.type === 'agent')
    expect(agent).toBeDefined()
    expect(agent?.id).toBe('agent:duke_alric')
  })
})

describe('MMIntelligence — memory decay', () => {
  it('sub-month resolve does nothing', () => {
    const mems = [makeMemory({ vividness: 1.0 })]
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), mems, 'baldurs_gate', 0)
    mm.accumulatePotential(20, 20); mm.resolve(20)
    expect(mm.memoryCount()).toBe(1)
    // Still vivid (no decay applied to the in-memory copy yet)
    expect(mems[0].vividness).toBe(1.0)
  })

  it('one month decay reduces vividness for episodic memory', () => {
    const m = makeMemory({ memoryType: 'episodic', importance: 5, vividness: 1.0, worldDay: 0 })
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), [m], 'baldurs_gate', 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    // decay rate 0.02/day × 30 days = 0.6 decay → vividness 0.4
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    expect(dom.memories[0].vividness).toBeCloseTo(0.4, 1)
  })

  it('emotional memories decay 4× slower than episodic', () => {
    const ep = makeMemory({ id: 'ep', memoryType: 'episodic', importance: 5, vividness: 1.0, worldDay: 0 })
    const em = makeMemory({ id: 'em', memoryType: 'emotional', importance: 5, vividness: 1.0, worldDay: 0 })
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), [ep, em], 'baldurs_gate', 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    const epOut = dom.memories.find(m => m.id === 'ep')!
    const emOut = dom.memories.find(m => m.id === 'em')!
    expect(emOut.vividness).toBeGreaterThan(epOut.vividness)
  })

  it('important (≥7) memories decay 2× slower', () => {
    const trivial = makeMemory({ id: 't', importance: 3, vividness: 1.0, worldDay: 0 })
    const major = makeMemory({ id: 'M', importance: 8, vividness: 1.0, worldDay: 0 })
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), [trivial, major], 'baldurs_gate', 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    const tOut = dom.memories.find(m => m.id === 't')!
    const mOut = dom.memories.find(m => m.id === 'M')!
    expect(mOut.vividness).toBeGreaterThan(tOut.vividness)
  })

  it('legendary (≥9) memories nearly permanent', () => {
    const m = makeMemory({ importance: 10, vividness: 1.0, worldDay: 0 })
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), [m], 'baldurs_gate', 0)
    // 1 year of decay
    mm.accumulatePotential(360, 360); mm.resolve(360)
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    // Decay rate 0.02 × 0.5 (importance≥7) × 0.1 (importance≥9) = 0.001/day
    // After 360 days: 1 - 0.36 = 0.64
    expect(dom.memories[0].vividness).toBeGreaterThan(0.5)
  })

  it('memories below forgetThreshold get pruned', () => {
    const fresh = makeMemory({ id: 'fresh', importance: 8, vividness: 1.0, worldDay: 0 })
    const fading = makeMemory({ id: 'fading', importance: 1, vividness: 1.0, worldDay: 0 })
    const mm = new MMIntelligence(
      makeIdentity(),
      makeBoundary(),
      [fresh, fading],
      'baldurs_gate',
      0,
      { forgetThreshold: 0.1 },
    )
    // 60 days: fading (importance 1) decays at 0.02/day → 0 (forgotten)
    //           fresh (importance 8) decays at 0.01/day → 0.4 (still vivid)
    mm.accumulatePotential(60, 60); mm.resolve(60)
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    expect(dom.memories.find(m => m.id === 'fading')).toBeUndefined()
    expect(dom.memories.find(m => m.id === 'fresh')).toBeDefined()
    expect(dom.cumulative.memoriesForgotten).toBe(1)
  })
})

describe('MMIntelligence — adding state mid-life', () => {
  it('recordMemory adds a fresh memory', () => {
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), [], 'baldurs_gate', 0)
    mm.recordMemory(makeMemory({ id: 'new', content: 'Saw a dragon' }))
    expect(mm.memoryCount()).toBe(1)
  })

  it('recordKnowledge adds a knowledge entry', () => {
    const mm = new MMIntelligence(makeIdentity(), makeBoundary(), [], 'baldurs_gate', 0)
    mm.recordKnowledge({
      scope: 'witnessed', topic: 'red dragon', content: 'Spotted near Sword Mountains',
      confidence: 'certain', isTrue: true, source: 'self',
    })
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    expect(dom.knowledge.entries.length).toBe(1)
  })
})

describe('MMIntelligence — Clockwork integration', () => {
  it('registers monthly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const mm = new MMIntelligence(
      makeIdentity(), makeBoundary(),
      [makeMemory({ vividness: 1.0, worldDay: 0 })],
      'baldurs_gate', 0,
    )
    mm.registerWith(tp)
    clockwork.register(mm, 3, 'monthly')  // L3 FACTION layer alongside MMFaction/MMWarfare
    clockwork.crankTo(30)
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode('baldurs_gate')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('agent:duke_alric')
  })
})

describe('Slow-life integration: leader-NPC has intelligence', () => {
  it('a faction leader\'s memory of the player persists across years', () => {
    // Duke Alric meets Kaelith at tavern, important moment.
    // Years later, Duke still remembers.
    const meetMemory: AgentMemory = makeMemory({
      id: 'mem_meet_kaelith',
      memoryType: 'emotional',
      content: 'Kaelith saved my daughter',
      worldDay: 0,
      importance: 9,
      vividness: 1.0,
      tags: ['kaelith', 'family', 'gratitude'],
      valence: 8,
    })
    const mm = new MMIntelligence(
      makeIdentity(),
      makeBoundary(),
      [meetMemory],
      'baldurs_gate', 0,
    )
    // 720 days = 2 years
    mm.accumulatePotential(720, 720); mm.resolve(720)
    const dom = mm.serialize().domain as ReturnType<MMIntelligence['getDomainState']>
    // emotional × importance≥9 makes decay nearly nil
    // 0.02 × 0.25 (emotional) × 0.5 (imp≥7) × 0.1 (imp≥9) = 0.00025/day
    // After 720 days: 1 - 0.18 = 0.82 — still very vivid
    expect(dom.memories[0].vividness).toBeGreaterThan(0.75)
  })
})
