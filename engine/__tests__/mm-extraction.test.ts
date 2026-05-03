/**
 * MM_EXTRACTION TESTS — wraps tickExtraction as ISimulatedMM.
 * Covers the NPC-driven side that shares state with player extraction.
 */

import { describe, it, expect } from 'vitest'
import { MMExtraction } from '../mm-extraction'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import {
  DepositSchema,
  ExtractionSchema,
  type Deposit,
  type Extraction,
} from '../production-chain'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeDeposit(overrides: Partial<Deposit> = {}): Deposit {
  return DepositSchema.parse({
    id: 'iron_vein_thundertree',
    name: 'Thundertree Iron Vein',
    nodeId: 'thundertree',
    depositType: 'shallow',
    primaryCommodityId: 'iron_ore',
    secondaryCommodities: [{ commodityId: 'copper_ore', chance: 0.3, ratio: 0.1 }],
    quality: 'rich',
    tier: 'D',
    totalReserves: 1000,
    remainingReserves: 1000,
    laborRequired: 1,
    optimalLabor: 10,
    baseOutputPerDay: 10,
    discovered: true,
    exploited: true,
    ...overrides,
  })
}

function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return ExtractionSchema.parse({
    id: 'op_thundertree_1',
    depositId: 'iron_vein_thundertree',
    nodeId: 'thundertree',
    operatorId: 'thundertree',
    assignedWorkers: 5,
    workerEfficiency: 1,
    outputContainerId: 'thundertree_warehouse',
    status: 'operating',
    ...overrides,
  })
}

describe('MMExtraction — adapter for production-chain.tickExtraction', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)
    expect(mm.state.id).toBe('extraction:op_thundertree_1')
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('extraction')
  })

  it('accumulatePotential is O(1) — reserves untouched until resolve', () => {
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)
    const reservesBefore = dep.remainingReserves
    mm.accumulatePotential(7, 7)
    expect(mm.pendingDays()).toBe(7)
    expect(dep.remainingReserves).toBe(reservesBefore)  // not mutated
  })

  it('resolve folds daysResolved days of tickExtraction', () => {
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7)
    expect(result.daysResolved).toBe(7)
    // 7 days × baseOutputPerDay 10 × laborRatio 0.5 (5/10) × quality 1.5 (rich) = 52.5
    expect(ext.totalExtracted).toBeCloseTo(52.5, 1)
    expect(dep.remainingReserves).toBeCloseTo(947.5, 1)
  })

  it('writes economy.commodities supply κ at the node on resolve', () => {
    const tp = makeTP()
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('thundertree')!
    const commodities = (ctx.economy.commodities ?? {}) as Record<string, { supply?: number }>
    expect(commodities.iron_ore?.supply).toBeGreaterThan(0)
    expect(commodities.copper_ore?.supply).toBeGreaterThan(0)
  })

  it('idle status produces nothing (matches tickExtraction guard)', () => {
    const dep = makeDeposit()
    const ext = makeExtraction({ status: 'idle' })
    const mm = new MMExtraction(ext, dep, 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    expect(ext.totalExtracted).toBe(0)
    expect(dep.remainingReserves).toBe(1000)  // untouched
  })

  it('exhausted reserves stop the fold early and flip status to exhausted', () => {
    const dep = makeDeposit({ remainingReserves: 30, baseOutputPerDay: 50, quality: 'rich' })
    const ext = makeExtraction({ assignedWorkers: 10 })  // optimal labor
    const mm = new MMExtraction(ext, dep, 0)
    mm.accumulatePotential(30, 30)
    mm.resolve(30)
    // First day's computed output (50 × 1 × 1.5 = 75) drops reserves from 30 to 0
    // and flips status to exhausted; subsequent days return {} so the fold halts.
    // tickExtraction credits the full computed output to totalExtracted even
    // when reserves can't sustain it — over-extraction is silently absorbed.
    expect(dep.remainingReserves).toBe(0)
    expect(ext.status).toBe('exhausted')
    expect(ext.totalExtracted).toBe(75)
  })

  it('renewable deposits drain capacity and regenerate', () => {
    const dep = makeDeposit({
      renewable: true,
      maxCapacity: 100,
      currentCapacity: 100,
      regenerationPerDay: 5,
      remainingReserves: undefined,
      totalReserves: undefined,
      baseOutputPerDay: 8,
      quality: 'standard',
    })
    const ext = makeExtraction({ assignedWorkers: 10 })
    const mm = new MMExtraction(ext, dep, 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    // baseOutputPerDay 8 × laborRatio 1 × quality 1 = 8/day
    // capacity drained 8 × 7 = 56, regenerated 5 × 7 = 35
    // net 100 - 56 + 35 = 79
    expect(dep.currentCapacity).toBe(79)
    expect(dep.overexploited).toBe(false)
  })

  it('stockpile accumulates across resolves', () => {
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)

    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    const after1 = ext.stockpile.iron_ore

    mm.accumulatePotential(7, 14)
    mm.resolve(14)
    const after2 = ext.stockpile.iron_ore

    expect(after2).toBeGreaterThan(after1)
  })

  it('integrates with Clockwork — registers, ticks weekly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)

    // Layer 1 EXTRACTION, weekly cadence
    clockwork.register(mm, 1, 'weekly')
    expect(clockwork.totalMMs()).toBe(1)

    // Crank past one weekly threshold
    clockwork.crankTo(7)
    expect(mm.pendingDays()).toBeGreaterThan(0)
    // No κ yet — observation must happen
    expect((tp.getNode('thundertree')!.dataStatic as any).economy).toBeUndefined()

    const obs = clockwork.observeNode('thundertree')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('extraction:op_thundertree_1')
    const eco = (tp.getNode('thundertree')!.dataStatic as any).economy
    expect(eco?.commodities?.iron_ore?.supply).toBeGreaterThan(0)
  })

  it('shares deposit state with player extract — drains accumulate', () => {
    // Simulates: NPC operation works the vein, player ALSO extracts.
    // Both share the same Deposit object; reserves drop from both sides.
    const dep = makeDeposit({ remainingReserves: 200, baseOutputPerDay: 10 })
    const ext = makeExtraction({ assignedWorkers: 10 })
    const mm = new MMExtraction(ext, dep, 0)

    // Player extracts 30 first (simulated drain on the shared Deposit)
    dep.remainingReserves! -= 30
    expect(dep.remainingReserves).toBe(170)

    // NPC tick advances 7 days
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    // 7 × 10 × 1 × 1.5 = 105 NPC drain
    expect(dep.remainingReserves).toBe(170 - 105)
  })

  it('serializes domain state via getDomainState', () => {
    const dep = makeDeposit()
    const ext = makeExtraction()
    const mm = new MMExtraction(ext, dep, 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    const serialized = mm.serialize()
    const domain = serialized.domain as ReturnType<MMExtraction['getDomainState']>
    expect(domain.extraction.id).toBe('op_thundertree_1')
    expect(domain.deposit.id).toBe('iron_vein_thundertree')
    expect(domain.lastTotal.iron_ore).toBeGreaterThan(0)
    expect(domain.cumulativeTotal.iron_ore).toEqual(domain.lastTotal.iron_ore)
  })
})
