/**
 * MM_WATER TESTS — verify adapter wraps water.ts correctly,
 * reads weather κ from the same node, evolves level day-by-day,
 * and writes summary κ on observation.
 */

import { describe, it, expect } from 'vitest'
import { MMWater } from '../mm-water.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode, type WaterRules } from '../tp.js'
import { createWaterLevel, type WaterBody } from '../water.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    {
      id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate",
      parentId: 'sword_coast', dataStatic: {},
    },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeRiverBody(): WaterBody {
  // Construct directly so the id is stable and test-friendly.
  return {
    id: 'chionthar',
    name: 'River Chionthar',
    type: 'river',
    regionId: 'sword_coast',
    salinity: 'fresh',
    area: 3,
    depth: 'moderate',
    navigable: true,
    fishingYield: 30,
    drinkable: true,
  }
}

describe('MMWater — adapter for water.ts', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)
    expect(mm.state.id).toBe('water:chionthar')
    expect(mm.state.nodeId).toBe('baldurs_gate')
    expect(mm.state.mmType).toBe('water')
  })

  it('initial level state is normal (100%)', () => {
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)
    const ls = mm.getLevelState()
    expect(ls.level).toBe(100)
    expect(ls.floodStage).toBe('normal')
  })

  it('accumulatePotential is O(1) — only tracks daysPending', () => {
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)
    mm.accumulatePotential(7, 7)
    expect(mm.pendingDays()).toBe(7)
    // Level didn't change yet — no resolve happened
    expect(mm.getLevelState().level).toBe(100)
  })

  it('resolve writes κ.water with one source keyed by waterBodyId', () => {
    const tp = makeTP()
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)

    mm.accumulatePotential(1, 1)
    mm.resolve(1, tp)

    const ctx = tp.resolve('baldurs_gate')!
    expect(ctx.water).toBeDefined()
    const sources = (ctx.water as WaterRules).sources!
    expect(sources['chionthar']).toBeDefined()
    const src = sources['chionthar']
    expect(src.type).toBe('river')
    expect(typeof src.level).toBe('number')
    expect(src.salinity).toBe('fresh')
    expect(src.navigable).toBe(true)
  })

  it('with no weather κ, level drifts toward equilibrium across many days', () => {
    const tp = makeTP()
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)

    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)

    const ls = mm.getLevelState()
    // River drainage > recharge by default, so level falls below 100
    expect(ls.level).toBeLessThan(100)
    expect(ls.level).toBeGreaterThan(0)
  })

  it('storm conditions raise water level', () => {
    const tp = makeTP()
    // Seed weather κ at the node — storm conditions
    tp.writeDomain('baldurs_gate', 'weather', {
      season: 'spring',
      temperature: 55,
      precipitation: 'storm',  // → rainfall = 3
      wind: 'gale',
      visibility: 'poor',
      severity: 0.8,
    })

    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)

    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ls = mm.getLevelState()
    // Storm pushed level above 100 (and likely into watch/warning range)
    expect(ls.level).toBeGreaterThan(100)
    expect(['watch', 'warning', 'flood', 'catastrophic']).toContain(ls.floodStage)
  })

  it('drought conditions (no rain, hot, summer) lower water level', () => {
    const tp = makeTP()
    tp.writeDomain('baldurs_gate', 'weather', {
      season: 'summer',
      temperature: 95,
      precipitation: 'none',
      wind: 'calm',
      visibility: 'clear',
      severity: 0.1,
    })

    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)

    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)

    const ls = mm.getLevelState()
    expect(ls.level).toBeLessThan(100)
  })

  it('integrates with Clockwork — registers daily, observes writes κ', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)

    // Layer 0 = PHYSICAL, daily cadence
    clockwork.register(mm, 0, 'daily')

    expect(clockwork.totalMMs()).toBe(1)
    clockwork.crankTo(5)
    // 5 daily ticks should accumulate
    expect(mm.pendingDays()).toBeGreaterThan(0)

    // No κ written yet — observation must happen
    const beforeObserve = (tp.getNode('baldurs_gate')!.dataStatic as any).water
    expect(beforeObserve).toBeUndefined()

    const obs = clockwork.observeNode('baldurs_gate')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('water:chionthar')

    const afterObserve = (tp.getNode('baldurs_gate')!.dataStatic as any).water
    expect(afterObserve).toBeDefined()
    expect(afterObserve.sources.chionthar.type).toBe('river')
  })

  it('narrative includes level, flood stage, and delta', () => {
    const tp = makeTP()
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)

    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7, tp)
    expect(result.narrative).toContain('Water:River Chionthar')
    expect(result.narrative).toMatch(/level/)
    expect(result.narrative).toMatch(/Δ/)
  })

  it('serializes domain state via getDomainState', () => {
    const body = makeRiverBody()
    const mm = new MMWater('baldurs_gate', body, createWaterLevel(body.id, body.type), 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    const serialized = mm.serialize()
    const domain = serialized.domain as ReturnType<MMWater['getDomainState']>
    expect(domain.waterBody.id).toBe('chionthar')
    expect(domain.waterBody.type).toBe('river')
    expect(typeof domain.levelState.level).toBe('number')
  })

  it('different body types have different drainage characteristics', () => {
    const tp = makeTP()
    const stream: WaterBody = {
      id: 'stream1', name: 'Mountain Stream', type: 'stream', regionId: 'sword_coast',
      salinity: 'fresh', area: 1, depth: 'shallow',
      navigable: false, fishingYield: 5, drinkable: true,
    }
    const ocean: WaterBody = {
      id: 'ocean1', name: 'Trackless Sea', type: 'ocean', regionId: 'sword_coast',
      salinity: 'salt', area: 50000, depth: 'abyssal',
      navigable: true, fishingYield: 200, drinkable: false,
    }

    const mmStream = new MMWater('baldurs_gate', stream, createWaterLevel(stream.id, stream.type), 0)
    const mmOcean = new MMWater('baldurs_gate', ocean, createWaterLevel(ocean.id, ocean.type), 0)

    // Same dry conditions
    tp.writeDomain('baldurs_gate', 'weather', {
      season: 'summer', temperature: 90, precipitation: 'none',
      wind: 'calm', visibility: 'clear', severity: 0.1,
    })

    mmStream.accumulatePotential(30, 30)
    mmStream.resolve(30, tp)
    mmOcean.accumulatePotential(30, 30)
    mmOcean.resolve(30, tp)

    // Stream drains 5%/day baseline; ocean ~0.01%/day. Stream falls much further.
    expect(mmStream.getLevelState().level).toBeLessThan(mmOcean.getLevelState().level)
  })
})
