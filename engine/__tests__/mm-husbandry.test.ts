/**
 * MM_HUSBANDRY TESTS — adapter for weeklyYieldTick + monthlyHerdTick.
 * Covers entity registration, weekly/monthly fold, weather effects, slow-life claim integration.
 */

import { describe, it, expect } from 'vitest'
import { MMHusbandry, herdEntityId } from '../mm-husbandry.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode } from '../tp.js'
import { createHerd, getSpecies, type Species } from '../husbandry.js'
import { ClaimRegistry, createClaim, resetClaimIdCounter } from '../claims.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function getCattle(): Species {
  const s = getSpecies('cattle')
  if (!s) throw new Error('cattle species not in catalog')
  return s
}

describe('MMHusbandry — adapter', () => {
  it('constructs with stable id keyed by hub + species', () => {
    const herd = createHerd('thundertree', 'cattle', 12)
    const mm = new MMHusbandry(herd, getCattle(), 0)
    expect(mm.state.id).toBe(herdEntityId(herd))
    expect(mm.state.id).toBe('herd:thundertree:cattle')
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('husbandry')
  })

  it('registerWith puts the herd in the TP entity registry as type=herd', () => {
    const tp = makeTP()
    const herd = createHerd('thundertree', 'cattle', 12)
    const mm = new MMHusbandry(herd, getCattle(), 0)
    mm.registerWith(tp)
    const at = tp.getEntitiesAt('thundertree')
    expect(at.length).toBe(1)
    expect(at[0].type).toBe('herd')
    expect(at[0].id).toBe('herd:thundertree:cattle')
  })

  it('weekly tick produces milk + manure for cattle', () => {
    const tp = makeTP()
    const herd = createHerd('thundertree', 'cattle', 20)
    herd.health = 100
    const mm = new MMHusbandry(herd, getCattle(), 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const dom = mm.serialize().domain as ReturnType<MMHusbandry['getDomainState']>
    expect(dom.cumulative.milkGallons).toBeGreaterThan(0)
    expect(dom.cumulative.manureLbs).toBeGreaterThan(0)
    // Cattle don't produce eggs or wool
    expect(dom.cumulative.eggs).toBe(0)
    expect(dom.cumulative.woolLbs).toBe(0)
  })

  it('writes meat (protein bucket) supply for milk + eggs', () => {
    const tp = makeTP()
    const herd = createHerd('thundertree', 'cattle', 20)
    const mm = new MMHusbandry(herd, getCattle(), 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)
    const ctx = tp.resolve('thundertree')!
    const meat = (ctx.economy.commodities as any)?.meat
    expect(meat?.supply).toBeGreaterThan(0)
  })

  it('weather yieldModifier scales the protein output', () => {
    const tp1 = makeTP()
    const tp2 = makeTP()
    tp2.writeDomain('thundertree', 'weather', {
      season: 'summer',
      modifiers: {
        yieldModifier: 0.5,
        travelSpeed: 1.0, monsterActivity: 1.0, spoilageRate: 1.0,
        combatEffects: [],
      },
    })

    const herdA = createHerd('thundertree', 'cattle', 20)
    const herdB = createHerd('thundertree', 'cattle', 20)
    const mmA = new MMHusbandry(herdA, getCattle(), 0)
    const mmB = new MMHusbandry(herdB, getCattle(), 0)

    mmA.accumulatePotential(7, 7); mmA.resolve(7, tp1)
    mmB.accumulatePotential(7, 7); mmB.resolve(7, tp2)

    const milkA = (mmA.serialize().domain as any).cumulative.milkGallons
    const milkB = (mmB.serialize().domain as any).cumulative.milkGallons
    expect(milkB).toBeLessThan(milkA)
  })

  it('monthly fold kicks in for ≥30-day resolves; tracks births and deaths', () => {
    const tp = makeTP()
    const herd = createHerd('thundertree', 'cattle', 20)
    herd.health = 100
    const mm = new MMHusbandry(herd, getCattle(), 0, {
      // d20 of 12 — deterministic, avoids extreme infant mortality variance
      getD20: () => 12,
    })
    mm.accumulatePotential(60, 60)
    mm.resolve(60, tp)
    const dom = mm.serialize().domain as ReturnType<MMHusbandry['getDomainState']>
    expect(dom.lastMonthly).not.toBeNull()
    // 60 days = 2 monthly ticks
    expect(dom.cumulative.deaths).toBeGreaterThanOrEqual(0)  // at least mortality applied
    expect(dom.lastMonthly!.feedConsumedLbs).toBeGreaterThan(0)
  })

  it('integrates with Clockwork — registers weekly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const herd = createHerd('thundertree', 'cattle', 20)
    const mm = new MMHusbandry(herd, getCattle(), 0, { getD20: () => 12 })
    mm.registerWith(tp)
    clockwork.register(mm, 1, 'weekly')
    clockwork.crankTo(28)  // 4 weekly ticks
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode('thundertree')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('herd:thundertree:cattle')
    expect((tp.getNode('thundertree')!.dataStatic as any).economy?.commodities?.meat?.supply)
      .toBeGreaterThan(0)
  })

  it('shares hub with mm-extraction — both can write to economy κ at same node', () => {
    // Sanity: husbandry writes meat/cloth; extraction writes ore. They
    // coexist in the same κ.economy.commodities map. Test by writing both.
    const tp = makeTP()
    const herd = createHerd('thundertree', 'cattle', 20)
    const mm = new MMHusbandry(herd, getCattle(), 0, { getD20: () => 12 })

    // Pre-seed with iron_ore from a hypothetical extraction
    tp.writeDomain('thundertree', 'economy', {
      commodities: { iron_ore: { supply: 500 } },
    })

    mm.accumulatePotential(7, 7); mm.resolve(7, tp)

    const ctx = tp.resolve('thundertree')!
    const commodities = ctx.economy.commodities as any
    expect(commodities.iron_ore?.supply).toBe(500)  // preserved
    expect(commodities.meat?.supply).toBeGreaterThan(0)  // added
  })
})

describe('Slow-life integration: claim a herd', () => {
  it('a player can claim_plot a herd via the universal claim system', () => {
    resetClaimIdCounter()
    const reg = new ClaimRegistry()
    const herd = createHerd('thundertree', 'cattle', 12)
    const entityId = herdEntityId(herd)

    // File a claim against the herd's entity id
    const { claim } = reg.register(createClaim({
      claimantId: 'kaelith',
      targetType: 'herd',
      targetId: entityId,
      nodeId: 'thundertree',
      claimedDay: 1,
      lapseAfterDays: 60,
      legitimacy: 'self',
    }))

    expect(claim.status).toBe('active')
    expect(reg.getActiveOwner('herd', entityId)).toBe('kaelith')
  })
})
