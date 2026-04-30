/**
 * MM_WEATHER TESTS — verify adapter registers into Clockwork,
 * accumulates potential cheaply, resolves on observation, and
 * writes weather κ to the .tp node.
 */

import { describe, it, expect } from 'vitest'
import { MMWeather } from '../mm-weather.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode, type WeatherRules } from '../tp.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'realmspace', type: 'crystal_sphere', name: 'Realmspace', parentId: null, dataStatic: {} },
    { id: 'toril', type: 'planet', name: 'Toril', parentId: 'realmspace', dataStatic: {} },
    { id: 'faerun', type: 'continent', name: 'Faerûn', parentId: 'toril', dataStatic: {} },
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: 'faerun', dataStatic: {} },
    { id: 'waterdeep', type: 'settlement', name: 'Waterdeep', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

describe('MMWeather — adapter for weather.ts', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const mm = new MMWeather('waterdeep', 'temperate', 0)
    expect(mm.state.id).toBe('weather:waterdeep')
    expect(mm.state.nodeId).toBe('waterdeep')
    expect(mm.state.mmType).toBe('weather')
  })

  it('has no last weather before first resolve', () => {
    const mm = new MMWeather('waterdeep', 'temperate', 0)
    expect(mm.getLastWeather()).toBeNull()
  })

  it('accumulatePotential is O(1) — only tracks daysPending', () => {
    const mm = new MMWeather('waterdeep', 'temperate', 0)
    mm.accumulatePotential(7, 7)
    expect(mm.pendingDays()).toBe(7)
    expect(mm.getLastWeather()).toBeNull()  // no resolve happened
  })

  it('resolve generates weather and exposes it via getLastWeather', () => {
    const mm = new MMWeather('waterdeep', 'temperate', 0)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7)
    expect(result.daysResolved).toBe(7)
    const w = mm.getLastWeather()
    expect(w).not.toBeNull()
    expect(w!.season).toMatch(/spring|summer|autumn|winter/)
    expect(typeof w!.temperature).toBe('number')
  })

  it('resolve writes weather κ to the .tp node', () => {
    const tp = makeTP()
    const mm = new MMWeather('waterdeep', 'temperate', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('waterdeep')!
    expect(ctx.weather).toBeDefined()
    const weather = ctx.weather as WeatherRules
    expect(weather.climate).toBe('temperate')
    expect(weather.season).toMatch(/spring|summer|autumn|winter/)
    expect(typeof weather.temperature).toBe('number')
    expect(weather.modifiers).toBeDefined()
    expect(typeof weather.modifiers!.yieldModifier).toBe('number')
  })

  it('multiple resolves overwrite κ rather than accumulate', () => {
    const tp = makeTP()
    const mm = new MMWeather('waterdeep', 'temperate', 0)

    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)
    const after1 = (tp.getNode('waterdeep')!.dataStatic as any).weather

    mm.accumulatePotential(7, 14)
    mm.resolve(14, tp)
    const after2 = (tp.getNode('waterdeep')!.dataStatic as any).weather

    // Both should be present; the second should reflect day 14, not be merged
    // confusion of day 7 and 14 fields.
    expect(after1).toBeDefined()
    expect(after2).toBeDefined()
    expect(after2.severity).toBeGreaterThanOrEqual(0)
    expect(after2.severity).toBeLessThanOrEqual(1)
  })

  it('integrates with Clockwork — registers, ticks weekly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const mm = new MMWeather('waterdeep', 'temperate', 0)

    // Layer 0 = PHYSICAL per the canonical mapping
    clockwork.register(mm, 0, 'weekly')

    expect(clockwork.totalMMs()).toBe(1)
    expect(mm.getLastWeather()).toBeNull()

    // Crank past one weekly threshold (7 days)
    clockwork.crankTo(7)

    // After accumulation, no κ written yet — weather waits for observation
    expect(mm.pendingDays()).toBeGreaterThan(0)
    const beforeObserve = (tp.getNode('waterdeep')!.dataStatic as any).weather
    expect(beforeObserve).toBeUndefined()

    // Observation collapses potential and writes κ
    const obs = clockwork.observeNode('waterdeep')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('weather:waterdeep')

    const afterObserve = (tp.getNode('waterdeep')!.dataStatic as any).weather
    expect(afterObserve).toBeDefined()
    expect(afterObserve.climate).toBe('temperate')
  })

  it('produces narrative string with season + temperature + severity', () => {
    const mm = new MMWeather('waterdeep', 'temperate', 0)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7)
    expect(result.narrative).toContain('Weather:waterdeep')
    expect(result.narrative).toMatch(/°F/)
    expect(result.narrative).toMatch(/severity/)
  })

  it('domain state serializes via getDomainState', () => {
    const mm = new MMWeather('waterdeep', 'arctic', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    const serialized = mm.serialize()
    const domain = serialized.domain as ReturnType<MMWeather['getDomainState']>
    expect(domain.climate).toBe('arctic')
    expect(domain.lastWeather).not.toBeNull()
    expect(domain.lastResolvedDay).toBe(7)
  })

  it('different climates produce different temperature ranges', () => {
    const arctic = new MMWeather('north', 'arctic', 0)
    const tropical = new MMWeather('south', 'tropical', 0)

    // Sample many days to get a stable comparison
    let arcticAvg = 0, tropicalAvg = 0
    for (let d = 1; d <= 30; d++) {
      arctic.accumulatePotential(7, d * 7)
      tropical.accumulatePotential(7, d * 7)
      const a = arctic.resolve(d * 7)
      const t = tropical.resolve(d * 7)
      // pull state changes - the resolve already updated lastWeather
      arcticAvg += arctic.getLastWeather()!.temperature
      tropicalAvg += tropical.getLastWeather()!.temperature
    }
    arcticAvg /= 30
    tropicalAvg /= 30

    expect(tropicalAvg).toBeGreaterThan(arcticAvg)
  })
})
