/**
 * MM_AGRICULTURE TESTS — wraps calculateHarvest as ISimulatedMM.
 */

import { describe, it, expect } from 'vitest'
import { MMAgriculture } from '../mm-agriculture'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import { type FarmPlot } from '../agriculture'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makePlot(overrides: Partial<FarmPlot> = {}): FarmPlot {
  return {
    id: 'plot_north_field',
    nodeId: 'thundertree',
    ownerId: 'thundertree',
    farmerId: 'farmhand_1',
    plotSize: 'field',  // 40 acres
    tenure: 'tenant',
    cultivation: 'monoculture',
    crops: [{ type: 'wheat', acresPlanted: 40 }],
    growthDays: 0,
    planted: true,
    season: 'summer',  // wheat grows in spring/summer
    soilQuality: 1.0,
    ...overrides,
  }
}

describe('MMAgriculture — adapter for calculateHarvest', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const plot = makePlot()
    const mm = new MMAgriculture(plot, 0)
    expect(mm.state.id).toBe('farm:plot_north_field')
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('agriculture')
  })

  it('fallow plot produces nothing', () => {
    const plot = makePlot({ planted: false, crops: [] })
    const mm = new MMAgriculture(plot, 0)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7)
    expect(result.stateChanges.fallow).toBe(1)
    expect(result.narrative).toMatch(/fallow/)
  })

  it('immature crops keep growing without harvesting', () => {
    const plot = makePlot()  // wheat, 120 growDays
    const mm = new MMAgriculture(plot, 0)
    mm.accumulatePotential(30, 30)  // 30 days < 120
    const result = mm.resolve(30)
    expect(result.stateChanges.growing).toBe(1)
    expect(plot.growthDays).toBe(30)
    expect(plot.planted).toBe(true)  // still growing
  })

  it('mature in-season crops trigger a harvest', () => {
    const plot = makePlot()  // wheat, 120 growDays, summer season
    const mm = new MMAgriculture(plot, 0, { getD20: () => 15 })  // no blight
    mm.accumulatePotential(120, 120)
    const result = mm.resolve(120)
    expect(result.stateChanges.harvested).toBeGreaterThan(0)
    // 40 acres × 30 baseYield × 1.0 soil × tenant 0.85 × monoculture 1.05 ≈ 1071 bushels (varies)
    expect(plot.planted).toBe(false)  // post-harvest reset
    expect(plot.growthDays).toBe(0)
    expect(plot.crops.length).toBe(0)
  })

  it('out-of-season crop does NOT harvest even if mature', () => {
    const plot = makePlot({ season: 'winter' })  // wheat doesn't grow in winter
    const mm = new MMAgriculture(plot, 0)
    mm.accumulatePotential(120, 120)
    const result = mm.resolve(120)
    // Mature but not in season → keeps growing (no harvest event)
    expect(result.stateChanges.harvested).toBeUndefined()
    expect(result.stateChanges.growing).toBe(1)
  })

  it('writes economy.commodities.grain supply at the node on harvest', () => {
    const tp = makeTP()
    const plot = makePlot()
    const mm = new MMAgriculture(plot, 0, { getD20: () => 15 })  // no blight
    mm.accumulatePotential(120, 120)
    mm.resolve(120, tp)
    const ctx = tp.resolve('thundertree')!
    const grain = (ctx.economy.commodities as any)?.grain
    expect(grain?.supply).toBeGreaterThan(0)
  })

  it('reads weather.modifiers.yieldModifier — bad weather cuts yield', () => {
    const tp = makeTP()
    // Seed a low yieldModifier in weather κ
    tp.writeDomain('thundertree', 'weather', {
      season: 'summer',
      modifiers: {
        yieldModifier: 0.5,  // half yield
        travelSpeed: 1.0,
        monsterActivity: 1.0,
        spoilageRate: 1.0,
        combatEffects: [],
      },
    })

    const plot1 = makePlot()
    const plot2 = makePlot({ id: 'plot_bad_weather' })
    const mm1 = new MMAgriculture(plot1, 0, { getD20: () => 15 })  // both deterministic
    const mm2 = new MMAgriculture(plot2, 0, { getD20: () => 15 })

    // Resolve plot1 with no weather κ on a fresh tp → yieldMod default 1.0
    const tpFresh = makeTP()
    mm1.accumulatePotential(120, 120)
    mm1.resolve(120, tpFresh)
    const yield1 = (mm1.serialize().domain as ReturnType<MMAgriculture['getDomainState']>).lastHarvest!.totalBushels

    // Resolve plot2 with the seeded bad weather → yieldMod 0.5
    mm2.accumulatePotential(120, 120)
    mm2.resolve(120, tp)
    const yield2 = (mm2.serialize().domain as ReturnType<MMAgriculture['getDomainState']>).lastHarvest!.totalBushels

    expect(yield2).toBeLessThan(yield1)
  })

  it('blight on a low d20 reduces monoculture yield', () => {
    const plot = makePlot({ cultivation: 'monoculture' })
    const mm = new MMAgriculture(plot, 0, { getD20: () => 1 })  // forced blight
    mm.accumulatePotential(120, 120)
    mm.resolve(120)
    const harvest = (mm.serialize().domain as ReturnType<MMAgriculture['getDomainState']>).lastHarvest!
    expect(harvest.blighted).toBe(true)
    expect(harvest.blightedCrops).toContain('wheat')
  })

  it('cumulativeYields tracks across multiple harvests', () => {
    const plot = makePlot()
    const mm = new MMAgriculture(plot, 0, { getD20: () => 15 })
    // First harvest
    mm.accumulatePotential(120, 120)
    mm.resolve(120)
    const dom1 = mm.serialize().domain as ReturnType<MMAgriculture['getDomainState']>
    const after1 = dom1.cumulativeYields.wheat ?? 0

    // Replant for second cycle
    plot.planted = true
    plot.crops = [{ type: 'wheat', acresPlanted: 40 }]

    mm.accumulatePotential(120, 240)
    mm.resolve(240)
    const dom2 = mm.serialize().domain as ReturnType<MMAgriculture['getDomainState']>
    const after2 = dom2.cumulativeYields.wheat ?? 0

    expect(after2).toBeGreaterThan(after1)
    expect(dom2.harvestsCompleted).toBe(2)
  })

  it('integrates with Clockwork — registers, ticks weekly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const plot = makePlot()
    const mm = new MMAgriculture(plot, 0, { getD20: () => 15 })
    clockwork.register(mm, 1, 'weekly')
    // Crank past the 120-day grow cycle. Weekly cadence accumulates in
    // 7-day chunks, so we go to 126 to ensure ≥120 days of potential.
    clockwork.crankTo(126)
    expect(mm.pendingDays()).toBeGreaterThanOrEqual(120)

    const obs = clockwork.observeNode('thundertree')
    expect(obs.resolved.length).toBe(1)
    expect(plot.planted).toBe(false)  // harvested
    expect((tp.getNode('thundertree')!.dataStatic as any).economy?.commodities?.grain?.supply)
      .toBeGreaterThan(0)
  })
})
