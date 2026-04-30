/**
 * MM_INFRASTRUCTURE TESTS — adapter for tickInfrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MMInfrastructure } from '../mm-infrastructure.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode } from '../tp.js'
import { createInfrastructure } from '../infrastructure-mm.js'
import { addSeed, resetSeedIdCounter, resetPotentialIdCounter } from '../knowledge-pool.js'

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

describe('MMInfrastructure — construction', () => {
  it('id derived from hubId', () => {
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    const mm = new MMInfrastructure(state, 0)
    expect(mm.state.id).toBe('infrastructure:phandalin')
    expect(mm.state.nodeId).toBe('phandalin')
    expect(mm.state.mmType).toBe('infrastructure')
  })
})

describe('MMInfrastructure — monthly tick', () => {
  it('sub-month resolve does nothing', () => {
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    const mm = new MMInfrastructure(state, 0)
    mm.accumulatePotential(20, 20)
    const result = mm.resolve(20)
    expect(result.stateChanges.monthsTicked).toBe(0)
  })

  it('one month tick increments totalMonthsTicked on the underlying state', () => {
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    const mm = new MMInfrastructure(state, 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    expect(state.totalMonthsTicked).toBe(1)
  })

  it('seeded knowledge → activated potentials → new workshops appear', () => {
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    addSeed(state.knowledgePool, 'glassmaking', 'Glassmaking', 'technique', 'research', 'jora', 0, 0.7, '')
    addSeed(state.knowledgePool, 'herbalism', 'Herbalism', 'technique', 'research', 'sera', 0, 0.7, '')

    const mm = new MMInfrastructure(state, 0, {
      // High rolls so activations succeed
      getD20s: () => Array(32).fill(20),
    })
    mm.accumulatePotential(30, 30); mm.resolve(30)
    // Basic Alchemy potential should activate (glassmaking + herbalism + healer role)
    // and add 'alchemy_lab' to workshops
    expect(state.workshops.length).toBeGreaterThan(0)
    const dom = mm.serialize().domain as ReturnType<MMInfrastructure['getDomainState']>
    expect(dom.cumulative.workshopsAdded).toBeGreaterThan(0)
  })

  it('writes κ.infrastructure at the hub on resolve', () => {
    const tp = makeTP()
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    const mm = new MMInfrastructure(state, 0)
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)

    const ctx = tp.resolve('phandalin')!
    const i = (ctx.infrastructure as any)
    expect(i).toBeDefined()
    expect(i.professions).toBeDefined()
    expect(typeof i.knowledgeTier).toBe('number')
  })

  it('multi-month fold accumulates development', () => {
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    addSeed(state.knowledgePool, 'glassmaking', 'Glassmaking', 'technique', 'research', 'j', 0, 0.7, '')
    addSeed(state.knowledgePool, 'herbalism', 'Herbalism', 'technique', 'research', 's', 0, 0.7, '')

    const mm = new MMInfrastructure(state, 0, {
      getD20s: () => Array(32).fill(20),
    })
    mm.accumulatePotential(90, 90); mm.resolve(90)  // 3 months
    expect(state.totalMonthsTicked).toBe(3)
    expect(state.developmentScore).toBeGreaterThan(0)
  })
})

describe('MMInfrastructure — Clockwork integration', () => {
  it('registers monthly, observes, fires tick', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const state = createInfrastructure('phandalin', 'Phandalin', 200, 0, 1)
    const mm = new MMInfrastructure(state, 0)
    clockwork.register(mm, 4, 'monthly')
    clockwork.crankTo(30)

    const obs = clockwork.observeNode('phandalin')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('infrastructure:phandalin')
    expect(state.totalMonthsTicked).toBe(1)
  })
})
