/**
 * MM_COOKING TESTS — adapter for cookMeal + calculateFoodMorale.
 */

import { describe, it, expect } from 'vitest'
import { MMCooking } from '../mm-cooking.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode } from '../tp.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

describe('MMCooking — adapter for cookMeal', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const mm = new MMCooking('thundertree', 'thundertree_settlement', 'temperate', 'wood', 0)
    expect(mm.state.id).toBe('cooking:thundertree')
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('cooking')
  })

  it('with no food available, narrative flags it and morale is poor', () => {
    const tp = makeTP()
    const mm = new MMCooking('thundertree', 'thundertree', 'temperate', 'wood', 0, { getD20: () => 10 })
    mm.accumulatePotential(30, 30)
    const result = mm.resolve(30, tp)
    expect(result.narrative).toMatch(/no food available/)
    const state = mm.getState()
    expect(state.varietyScore).toBe(0)
    expect(state.availableFoods).toEqual([])
    expect(state.foodMorale).toBeLessThan(0)
  })

  it('reads economy.commodities for available foods', () => {
    const tp = makeTP()
    // Seed a settlement with grain + meat + ale
    tp.writeDomain('thundertree', 'economy', {
      commodities: {
        grain: { supply: 200 },
        meat: { supply: 50 },
        ale: { supply: 20 },
        // Non-food commodity should be filtered
        iron_ore: { supply: 1000 },
      },
    })
    const mm = new MMCooking('thundertree', 'thundertree', 'temperate', 'wood', 0, { getD20: () => 18 })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)
    const state = mm.getState()
    expect(state.availableFoods).toContain('grain')
    expect(state.availableFoods).toContain('meat')
    expect(state.availableFoods).toContain('ale')
    expect(state.availableFoods).not.toContain('iron_ore')
    expect(state.varietyScore).toBe(3)
  })

  it('writes κ.culture.food on resolve', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { grain: { supply: 200 }, meat: { supply: 50 } },
    })
    const mm = new MMCooking('thundertree', 'thundertree', 'temperate', 'wood', 0, { getD20: () => 15 })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)
    const ctx = tp.resolve('thundertree')!
    const food = (ctx.culture as any)?.food
    expect(food).toBeDefined()
    expect(food.variety).toBe(2)
    expect(typeof food.morale).toBe('number')
  })

  it('higher variety + cultural staple raises meal quality', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: {
        grain: { supply: 200 },     // continental staple
        meat: { supply: 50 },
        fish: { supply: 30 },
        herbs: { supply: 10 },
        spices: { supply: 5 },
        salt: { supply: 100 },
      },
    })
    const mm = new MMCooking('thundertree', 'thundertree', 'temperate', 'charcoal', 0, { getD20: () => 18 })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)
    const meal = (mm.serialize().domain as ReturnType<MMCooking['getDomainState']>).lastMeal!
    // d20 18 + cookSkill 5 + charcoal heat bonus + 5-variety bonus + spices + cultural = high
    expect(['good', 'excellent', 'feast']).toContain(meal.quality)
  })

  it('integrates with Clockwork — registers monthly, observes', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { grain: { supply: 200 } },
    })
    const clockwork = new Clockwork(tp, 0)
    const mm = new MMCooking('thundertree', 'thundertree', 'temperate', 'wood', 0, { getD20: () => 12 })
    clockwork.register(mm, 6, 'monthly')  // L6 HUB SERVICES, monthly
    clockwork.crankTo(30)  // through one monthly threshold
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode('thundertree')
    expect(obs.resolved.length).toBe(1)
    const food = (tp.getNode('thundertree')!.dataStatic as any).culture?.food
    expect(food).toBeDefined()
    expect(food.variety).toBeGreaterThan(0)
  })

  it('serializes domain state via getDomainState', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { grain: { supply: 200 } },
    })
    const mm = new MMCooking('thundertree', 'thundertree', 'temperate', 'wood', 0, { getD20: () => 12 })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)
    const serialized = mm.serialize()
    const domain = serialized.domain as ReturnType<MMCooking['getDomainState']>
    expect(domain.state.cuisine).toBe('temperate')
    expect(domain.state.primaryFuel).toBe('wood')
    expect(domain.lastMeal).not.toBeNull()
    expect(domain.monthsCooked).toBe(1)
  })
})
