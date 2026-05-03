/**
 * MM_KNOWLEDGE_POOL TESTS — adapter for tickKnowledgePool.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MMKnowledgePool } from '../mm-knowledge-pool'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import {
  createKnowledgePool,
  addSeed,
  resetSeedIdCounter,
  resetPotentialIdCounter,
  type HubContext,
} from '../knowledge-pool'

beforeEach(() => {
  resetSeedIdCounter()
  resetPotentialIdCounter()
})

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'phandalin', type: 'settlement', name: 'Phandalin', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makePool() {
  return createKnowledgePool('phandalin', 0)
}

function makeContext(overrides: Partial<HubContext> = {}): HubContext {
  return {
    npcRoles: ['healer'],
    commoditiesAvailable: [],
    population: 200,
    hasTradeRoute: false,
    ...overrides,
  }
}

describe('MMKnowledgePool — construction', () => {
  it('id derived from pool.hubId', () => {
    const pool = makePool()
    const mm = new MMKnowledgePool(pool, makeContext(), 0)
    expect(mm.state.id).toBe('knowledge:phandalin')
    expect(mm.state.nodeId).toBe('phandalin')
    expect(mm.state.mmType).toBe('knowledge')
  })
})

describe('MMKnowledgePool — monthly tick', () => {
  it('sub-month resolve does nothing', () => {
    const pool = makePool()
    const mm = new MMKnowledgePool(pool, makeContext(), 0)
    mm.accumulatePotential(20, 20)
    const result = mm.resolve(20)
    expect(result.stateChanges.monthsTicked).toBe(0)
  })

  it('with seeds matching a potential, activation can fire', () => {
    const pool = makePool()
    addSeed(pool, 'glassmaking', 'Glassmaking', 'technique', 'research', 'master_jora', 0, 0.7, '')
    addSeed(pool, 'herbalism', 'Herbalism', 'technique', 'research', 'witch_sera', 0, 0.7, '')
    const mm = new MMKnowledgePool(pool, makeContext({ npcRoles: ['healer'] }), 0, {
      // d20=20 (crit) ensures activation passes any reasonable DC
      getD20s: () => [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
                      20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    })
    mm.accumulatePotential(30, 30); mm.resolve(30)
    expect(pool.realizedPotentials.length).toBeGreaterThan(0)
  })

  it('writes κ.knowledge at the hub on resolve', () => {
    const tp = makeTP()
    const pool = makePool()
    addSeed(pool, 'glassmaking', 'Glassmaking', 'technique', 'research', 'jora', 0, 0.7, '')
    const mm = new MMKnowledgePool(pool, makeContext(), 0)
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)

    const ctx = tp.resolve('phandalin')!
    const k = (ctx.knowledge as any)
    expect(k).toBeDefined()
    expect(k.seeds).toBeDefined()
    // Seeds are keyed by their internal id (seed_1, seed_2, ...)
    expect(Object.keys(k.seeds).length).toBeGreaterThan(0)
    const firstSeed = Object.values(k.seeds)[0] as { category: string; source: string }
    expect(firstSeed.category).toBe('technique')
  })

  it('cumulative tracks across multiple resolves', () => {
    const pool = makePool()
    addSeed(pool, 'glassmaking', 'Glassmaking', 'technique', 'research', 'j', 0, 0.7, '')
    addSeed(pool, 'herbalism', 'Herbalism', 'technique', 'research', 's', 0, 0.7, '')
    const mm = new MMKnowledgePool(pool, makeContext({ npcRoles: ['healer'] }), 0, {
      getD20s: () => Array(32).fill(20),
    })
    mm.accumulatePotential(30, 30); mm.resolve(30)
    const dom1 = mm.serialize().domain as ReturnType<MMKnowledgePool['getDomainState']>
    const after1 = dom1.cumulative.monthsTicked

    mm.accumulatePotential(60, 90); mm.resolve(90)  // 2 more months
    const dom2 = mm.serialize().domain as ReturnType<MMKnowledgePool['getDomainState']>
    expect(dom2.cumulative.monthsTicked).toBe(after1 + 2)
  })

  it('tier reflects total activations', () => {
    const pool = makePool()
    pool.totalActivations = 12  // mid-tier 3
    addSeed(pool, 's1', 'S1', 'technique', 'research', 'x', 0, 0.5, '')
    const mm = new MMKnowledgePool(pool, makeContext(), 0)
    const tp = makeTP()
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)
    const k = (tp.resolve('phandalin')!.knowledge as any)
    expect(k.tier).toBe(3)
  })
})

describe('MMKnowledgePool — Clockwork integration', () => {
  it('registers monthly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const pool = makePool()
    addSeed(pool, 'glassmaking', 'Glassmaking', 'technique', 'research', 'j', 0, 0.7, '')
    const mm = new MMKnowledgePool(pool, makeContext(), 0)
    clockwork.register(mm, 4, 'monthly')
    clockwork.crankTo(30)
    const obs = clockwork.observeNode('phandalin')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('knowledge:phandalin')
  })
})
