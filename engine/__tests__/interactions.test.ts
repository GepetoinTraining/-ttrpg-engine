/**
 * INTERACTIONS TESTS — the slow-life blacksmith loop end-to-end.
 *
 * Spec from the design conversation:
 *   - Character at level 0 examines an iron vein. Fails perception → sees
 *     only generic ground. Passes → learns "Iron Ore" (mastery 0 → 1).
 *   - Character extracts with a pickaxe. Gets ore. Reserves drop.
 *   - Character studies a piece of ore. Mastery 1 → 2.
 *   - Character re-examines. Now sees quality + tier + reserves.
 *   - One more study. Mastery 2 → 3. Now sees secondaries.
 *   - Keep extracting until reserves hit 0 → deposit becomes 'depleted'.
 *   - Tier-S deposit raises the perception DC and the extraction DC.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveExamineDeposit,
  resolveExtract,
  resolveStudyMaterial,
  resolveClaimPlot,
  resolveTendHerd,
  resolveSlaughter,
  resolvePlantCrops,
  resolveSellItem,
  getAvailableInteractions,
  PlayerIntentSchema,
} from '../interactions.js'
import { MaterialMasteryStore } from '../material-mastery.js'
import { ClaimRegistry, resetClaimIdCounter, createClaim } from '../claims.js'
import { COMMODITIES, DepositSchema, type Deposit } from '../production-chain.js'
import { createHerd, getSpecies, type Species } from '../husbandry.js'
import { type FarmPlot } from '../agriculture.js'
import { createSettlementMarket, type CommodityPrice } from '../market.js'
import { TP, type WorldNode } from '../tp.js'

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
    optimalLabor: 5,
    baseOutputPerDay: 10,
    discovered: true,
    exploited: false,
    ...overrides,
  })
}

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

const KAELITH = 'character_kaelith'
const IRON_ORE = COMMODITIES['iron_ore']

describe('PlayerIntent schema parses each variant', () => {
  it('examine_deposit', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'examine_deposit', characterId: KAELITH, depositId: 'iron_vein_thundertree',
    })
    expect(ok.success).toBe(true)
  })
  it('extract', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'extract', characterId: KAELITH, depositId: 'iron_vein_thundertree',
      toolItemId: 'pickaxe_42', toolBonus: 3, days: 7,
    })
    expect(ok.success).toBe(true)
  })
  it('study_material', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'study_material', characterId: KAELITH, resourceId: 'iron_ore',
    })
    expect(ok.success).toBe(true)
  })
})

describe('examine_deposit — gated by mastery', () => {
  let tp: TP
  let store: MaterialMasteryStore
  let deposit: Deposit

  beforeEach(() => {
    tp = makeTP()
    store = new MaterialMasteryStore()
    deposit = makeDeposit()
  })

  it('mastery 0, failed perception → no name revealed', () => {
    const result = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 0,
      worldDay: 1,
      tp, masteryStore: store,
      d20: 5,  // total 5 vs DC 13 (D-tier = 10 + 3) — fail
    })
    expect(result.ok).toBe(true)
    expect(result.observed?.name).toBeNull()
    expect(result.observed?.resource).toBeNull()
    expect(result.masteryChanges).toBeUndefined()
    expect(result.narrative).toMatch(/might hold something|failed/)
  })

  it('mastery 0, passed perception → mastery 0 → 1, name revealed', () => {
    const result = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 5,
      worldDay: 1,
      tp, masteryStore: store,
      d20: 15,  // total 20 vs DC 13 — pass
    })
    expect(result.ok).toBe(true)
    expect(result.masteryChanges).toEqual([
      { resourceId: 'iron_ore', before: 0, after: 1, reason: 'examination' },
    ])
    expect(result.observed?.name).toBe('Thundertree Iron Vein')
    expect(result.observed?.resource).toBe('Iron Ore')
    // Quality / tier / reserves still hidden at level 1
    expect(result.observed?.quality).toBeNull()
    expect(result.observed?.tier).toBeNull()
    expect(result.observed?.reserves).toBeNull()
  })

  it('wrong node → fails immediately', () => {
    const result = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'baldurs_gate',  // somewhere else
      perceptionModifier: 5,
      worldDay: 1,
      tp, masteryStore: store,
      d20: 20,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/character is at baldurs_gate/)
  })

  it('higher tier deposit raises the DC (S-tier rejects a peasant)', () => {
    const sTier = makeDeposit({ tier: 'S' })  // DC = 10 + 6 = 16
    const result = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: sTier.id },
      deposit: sTier, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 0,
      worldDay: 1,
      tp, masteryStore: store,
      d20: 10,  // total 10 vs DC 16 — fail
    })
    expect(result.ok).toBe(true)
    expect(result.masteryChanges).toBeUndefined()
  })

  it('emits observe TPB entry pointing at the deposit node', () => {
    const result = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 0,
      worldDay: 1,
      tp, masteryStore: store,
      d20: 12,
    })
    expect(result.tpbEntries).toEqual([
      { type: 'observe', nodeId: 'thundertree', partyId: KAELITH },
    ])
  })
})

describe('extract — yield + reserves + quality ladder', () => {
  let tp: TP
  let store: MaterialMasteryStore
  let deposit: Deposit

  beforeEach(() => {
    tp = makeTP()
    store = new MaterialMasteryStore()
    deposit = makeDeposit()
  })

  it('one day with mid roll → some ore, reserves drop', () => {
    const before = deposit.remainingReserves
    const result = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: deposit.id, toolBonus: 3, days: 1 },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      skillModifier: 5,
      worldDay: 1,
      tp, masteryStore: store,
      d20PerDay: [12],
    })
    expect(result.ok).toBe(true)
    expect(result.itemsGenerated?.length).toBe(1)
    const item = result.itemsGenerated![0]
    expect(item.resourceId).toBe('iron_ore')
    expect(item.quantity).toBeGreaterThan(0)
    expect(['poor', 'common', 'good', 'excellent', 'masterwork']).toContain(item.quality)
    expect(deposit.remainingReserves).toBeLessThan(before!)
  })

  it('seven days produces seven yield rolls (or until reserves run out)', () => {
    const result = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: deposit.id, toolBonus: 3, days: 7 },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      skillModifier: 5,
      worldDay: 1,
      tp, masteryStore: store,
      d20PerDay: [10, 12, 14, 16, 18, 20, 8],
    })
    expect(result.ok).toBe(true)
    expect(result.daysSpent).toBe(7)
    expect(result.itemsGenerated?.length).toBeGreaterThan(0)
    expect(result.worldDay).toBe(8)  // 1 + 7
  })

  it('a critical fail day yields reduced "poor" quality ore', () => {
    const result = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: deposit.id, toolBonus: 0, days: 1 },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      skillModifier: 0,
      worldDay: 1,
      tp, masteryStore: store,
      d20PerDay: [1],  // d20=1 → forced 'poor' regardless of total
    })
    expect(result.ok).toBe(true)
    expect(result.itemsGenerated?.length).toBe(1)
    expect(result.itemsGenerated![0].quality).toBe('poor')
    // 'poor' quantity is < base output but > 0
    expect(result.itemsGenerated![0].quantity).toBeGreaterThan(0)
    expect(result.itemsGenerated![0].quantity).toBeLessThan(deposit.baseOutputPerDay)
  })

  it('reserves running out marks the deposit depleted and stops yield', () => {
    const small = makeDeposit({ remainingReserves: 15, baseOutputPerDay: 10, quality: 'rich' })
    const result = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: small.id, toolBonus: 5, days: 5 },
      deposit: small, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      skillModifier: 10,
      worldDay: 1,
      tp, masteryStore: store,
      d20PerDay: [20, 20, 20, 20, 20],  // crit every day
    })
    expect(result.ok).toBe(true)
    expect(small.remainingReserves).toBe(0)
    expect(small.quality).toBe('depleted')
  })

  it('emits writeKappa TPB entry when reserves change', () => {
    const result = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: deposit.id, toolBonus: 3, days: 1 },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      skillModifier: 5,
      worldDay: 1,
      tp, masteryStore: store,
      d20PerDay: [15],
    })
    const writeK = result.tpbEntries.find(e => e.type === 'writeKappa')
    expect(writeK).toBeDefined()
    if (writeK?.type === 'writeKappa') {
      expect(writeK.nodeId).toBe('thundertree')
      expect(writeK.system).toBe('interactions:extract')
      expect(writeK.paths).toContain(`remainingReserves:${deposit.id}`)
    }
  })

  it('wrong node → fails immediately', () => {
    const result = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: deposit.id, toolBonus: 3, days: 1 },
      deposit, resource: IRON_ORE,
      characterNodeId: 'baldurs_gate',
      skillModifier: 5,
      worldDay: 1,
      tp, masteryStore: store,
      d20PerDay: [15],
    })
    expect(result.ok).toBe(false)
  })
})

describe('study_material — knowledge level pump', () => {
  it('0 → 1 → 2 → 3, then capped', () => {
    const store = new MaterialMasteryStore()
    let day = 1
    for (let target = 1 as 1 | 2 | 3; target <= 3; target = (target + 1) as 1 | 2 | 3) {
      const result = resolveStudyMaterial({
        intent: { type: 'study_material', characterId: KAELITH, resourceId: 'iron_ore' },
        resource: IRON_ORE,
        worldDay: day,
        masteryStore: store,
      })
      expect(result.ok).toBe(true)
      expect(result.masteryChanges?.[0].after).toBe(target)
      day = result.worldDay
    }
    expect(store.get(KAELITH, 'iron_ore').knowledgeLevel).toBe(3)

    // One more study — already at cap
    const cap = resolveStudyMaterial({
      intent: { type: 'study_material', characterId: KAELITH, resourceId: 'iron_ore' },
      resource: IRON_ORE,
      worldDay: day,
      masteryStore: store,
    })
    expect(cap.masteryChanges).toBeUndefined()
    expect(cap.narrative).toMatch(/maximum/)
  })
})

describe('the full slow-life loop — one character, one vein', () => {
  it('examine → extract → study → re-examine reveals more each step', () => {
    const tp = makeTP()
    const store = new MaterialMasteryStore()
    const deposit = makeDeposit()

    // Step 1: blind examine (mastery 0, mid roll → fails DC 13)
    const r1 = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 0,
      worldDay: 1,
      tp, masteryStore: store,
      d20: 7,
    })
    expect(r1.observed?.name).toBeNull()

    // Step 2: try again with luck (passes DC 13)
    const r2 = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 0,
      worldDay: 2,
      tp, masteryStore: store,
      d20: 18,
    })
    expect(r2.observed?.name).toBe('Thundertree Iron Vein')
    expect(r2.observed?.resource).toBe('Iron Ore')
    expect(r2.observed?.quality).toBeNull()  // still hidden at level 1
    expect(store.get(KAELITH, 'iron_ore').knowledgeLevel).toBe(1)

    // Step 3: extract some ore
    const r3 = resolveExtract({
      intent: { type: 'extract', characterId: KAELITH, depositId: deposit.id, toolBonus: 5, days: 3 },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      skillModifier: 5,
      worldDay: 3,
      tp, masteryStore: store,
      d20PerDay: [12, 16, 18],
    })
    expect(r3.itemsGenerated!.length).toBeGreaterThan(0)

    // Step 4: study what we extracted (manual study still works regardless of drift)
    const r4 = resolveStudyMaterial({
      intent: { type: 'study_material', characterId: KAELITH, resourceId: 'iron_ore' },
      resource: IRON_ORE,
      worldDay: r3.worldDay,
      masteryStore: store,
    })
    const finalLevel = store.get(KAELITH, 'iron_ore').knowledgeLevel
    expect(finalLevel).toBeGreaterThanOrEqual(2)

    // Step 5: re-examine — quality + tier + reserves now visible
    const r5 = resolveExamineDeposit({
      intent: { type: 'examine_deposit', characterId: KAELITH, depositId: deposit.id },
      deposit, resource: IRON_ORE,
      characterNodeId: 'thundertree',
      perceptionModifier: 0,
      worldDay: r4.worldDay,
      tp, masteryStore: store,
      d20: 12,
    })
    expect(r5.observed?.quality).toBe('rich')
    expect(r5.observed?.tier).toBe('D')
    expect(typeof r5.observed?.reserves).toBe('number')

    // Step 6: study once more if not already at 3
    if (store.get(KAELITH, 'iron_ore').knowledgeLevel < 3) {
      resolveStudyMaterial({
        intent: { type: 'study_material', characterId: KAELITH, resourceId: 'iron_ore' },
        resource: IRON_ORE,
        worldDay: r5.worldDay,
        masteryStore: store,
      })
    }
    expect(store.get(KAELITH, 'iron_ore').knowledgeLevel).toBe(3)
  })
})

describe('claim_plot — the slow-life land grab', () => {
  beforeEach(() => resetClaimIdCounter())

  it('schema validates a claim_plot intent', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'claim_plot', characterId: KAELITH,
      targetType: 'farm_plot', targetId: 'plot_north', nodeId: 'thundertree',
    })
    expect(ok.success).toBe(true)
  })

  it('files an unclaimed plot — status active', () => {
    const reg = new ClaimRegistry()
    const result = resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: KAELITH,
        targetType: 'farm_plot', targetId: 'plot_north',
        nodeId: 'thundertree', legitimacy: 'self',
      },
      characterNodeId: 'thundertree',
      worldDay: 1,
      registry: reg,
    })
    expect(result.ok).toBe(true)
    expect(result.claim?.status).toBe('active')
    expect(result.claim?.claimantId).toBe(KAELITH)
    expect(reg.getActiveOwner('farm_plot', 'plot_north')).toBe(KAELITH)
    expect(result.narrative).toMatch(/active/)
  })

  it('a second filing on the same plot triggers contested', () => {
    const reg = new ClaimRegistry()
    resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: KAELITH,
        targetType: 'farm_plot', targetId: 'plot_north',
        nodeId: 'thundertree', legitimacy: 'self',
      },
      characterNodeId: 'thundertree', worldDay: 1, registry: reg,
    })
    const second = resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: 'rivanon',
        targetType: 'farm_plot', targetId: 'plot_north',
        nodeId: 'thundertree', legitimacy: 'self',
      },
      characterNodeId: 'thundertree', worldDay: 5, registry: reg,
    })
    expect(second.claim?.status).toBe('contested')
    expect(second.contestedExisting?.length).toBe(1)
    expect(second.contestedExisting?.[0].claimantId).toBe(KAELITH)
    // Nobody actively owns it during the contest
    expect(reg.getActiveOwner('farm_plot', 'plot_north')).toBeUndefined()
    expect(second.narrative).toMatch(/contested/)
  })

  it('wrong node fails with reason', () => {
    const reg = new ClaimRegistry()
    const result = resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: KAELITH,
        targetType: 'farm_plot', targetId: 'plot_north',
        nodeId: 'thundertree', legitimacy: 'self',
      },
      characterNodeId: 'phandalin',  // not at the target node
      worldDay: 1,
      registry: reg,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/character is at phandalin/)
  })

  it('emits an observe TPB entry at the claimed node', () => {
    const reg = new ClaimRegistry()
    const result = resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: KAELITH,
        targetType: 'deposit', targetId: 'iron_vein',
        nodeId: 'thundertree', legitimacy: 'self',
      },
      characterNodeId: 'thundertree', worldDay: 1, registry: reg,
    })
    expect(result.tpbEntries).toEqual([
      { type: 'observe', nodeId: 'thundertree', partyId: KAELITH },
    ])
  })

  it('lapseAfterDays carried through; claim auto-lapses on sweep', () => {
    const reg = new ClaimRegistry()
    const r = resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: KAELITH,
        targetType: 'farm_plot', targetId: 'plot_north',
        nodeId: 'thundertree', legitimacy: 'self',
        lapseAfterDays: 30,
      },
      characterNodeId: 'thundertree', worldDay: 1, registry: reg,
    })
    expect(r.claim?.lapseAfterDays).toBe(30)
    const lapsed = reg.sweepLapses(60)  // 60 - 1 > 30
    expect(lapsed).toContain(r.claim!.id)
  })
})

describe('getAvailableInteractions — claim_plot availability', () => {
  beforeEach(() => resetClaimIdCounter())

  it('shows claim_plot when an unclaimed target is nearby', () => {
    const reg = new ClaimRegistry()
    const types = getAvailableInteractions({
      characterId: KAELITH,
      characterNodeId: 'thundertree',
      hasMiningTool: false,
      claimRegistry: reg,
      claimableTargets: [{ targetType: 'farm_plot', targetId: 'plot_north' }],
    })
    expect(types).toContain('claim_plot')
  })

  it('hides claim_plot when the target already has an active owner', () => {
    const reg = new ClaimRegistry()
    resolveClaimPlot({
      intent: {
        type: 'claim_plot', characterId: 'rivanon',
        targetType: 'farm_plot', targetId: 'plot_north',
        nodeId: 'thundertree', legitimacy: 'self',
      },
      characterNodeId: 'thundertree', worldDay: 1, registry: reg,
    })
    const types = getAvailableInteractions({
      characterId: KAELITH,
      characterNodeId: 'thundertree',
      hasMiningTool: false,
      claimRegistry: reg,
      claimableTargets: [{ targetType: 'farm_plot', targetId: 'plot_north' }],
    })
    expect(types).not.toContain('claim_plot')
  })
})

describe('tend_herd — feed + heal + refresh claim', () => {
  function getCattle(): Species {
    const s = getSpecies('cattle')
    if (!s) throw new Error('cattle missing')
    return s
  }

  it('schema validates', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'tend_herd', characterId: KAELITH,
      herdId: 'herd:thundertree:cattle', nodeId: 'thundertree', days: 2,
    })
    expect(ok.success).toBe(true)
  })

  it('resets daysSinceLastFeed and raises health', () => {
    const herd = createHerd('thundertree', 'cattle', 12)
    herd.health = 60
    herd.daysSinceLastFeed = 5
    const result = resolveTendHerd({
      intent: { type: 'tend_herd', characterId: KAELITH, herdId: 'herd:thundertree:cattle',
                nodeId: 'thundertree', days: 3 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(herd.daysSinceLastFeed).toBe(0)
    expect(herd.health).toBe(90)  // 60 + 3*10
  })

  it('clamps health at 100', () => {
    const herd = createHerd('thundertree', 'cattle', 12)
    herd.health = 95
    const result = resolveTendHerd({
      intent: { type: 'tend_herd', characterId: KAELITH, herdId: 'herd:thundertree:cattle',
                nodeId: 'thundertree', days: 5 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(herd.health).toBe(100)
  })

  it('refreshes a claim and rescues a lapsed one', () => {
    resetClaimIdCounter()
    const reg = new ClaimRegistry()
    const herd = createHerd('thundertree', 'cattle', 12)
    const herdId = 'herd:thundertree:cattle'

    const { claim } = reg.register(createClaim({
      claimantId: KAELITH, targetType: 'herd', targetId: herdId,
      nodeId: 'thundertree', claimedDay: 1, lapseAfterDays: 30,
    }))
    // Sweep at day 100 → lapses
    reg.sweepLapses(100)
    expect(reg.getClaim(claim.id)!.status).toBe('lapsed')

    resolveTendHerd({
      intent: { type: 'tend_herd', characterId: KAELITH, herdId, nodeId: 'thundertree', days: 1 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 105,
      registry: reg,
    })
    // Tend rescued the claim
    expect(reg.getClaim(claim.id)!.status).toBe('active')
    expect(reg.getClaim(claim.id)!.lastTendedDay).toBe(106)  // worldDay + days
  })

  it('empty herd cannot be tended', () => {
    const herd = createHerd('thundertree', 'cattle', 0)
    const result = resolveTendHerd({
      intent: { type: 'tend_herd', characterId: KAELITH, herdId: 'h',
                nodeId: 'thundertree', days: 1 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no animals/)
  })
})

describe('slaughter — head → meat/hide/tallow', () => {
  function getCattle(): Species {
    const s = getSpecies('cattle')
    if (!s) throw new Error('cattle missing')
    return s
  }

  it('schema validates', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'slaughter', characterId: KAELITH,
      herdId: 'herd:thundertree:cattle', nodeId: 'thundertree', count: 3,
    })
    expect(ok.success).toBe(true)
  })

  it('reduces head and produces meat + hide + tallow items', () => {
    const herd = createHerd('thundertree', 'cattle', 10)
    const headBefore = herd.adults
    const result = resolveSlaughter({
      intent: { type: 'slaughter', characterId: KAELITH,
                herdId: 'herd:thundertree:cattle', nodeId: 'thundertree', count: 3 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(herd.adults).toBe(headBefore - 3)
    const items = result.itemsGenerated!
    expect(items.find(i => i.resourceId === 'meat')?.quantity).toBeGreaterThan(0)
    expect(items.find(i => i.resourceId === 'leather')?.quantity).toBeGreaterThan(0)
    expect(items.find(i => i.resourceId === 'tallow')?.quantity).toBeGreaterThan(0)
  })

  it('caps count at available adults+elders', () => {
    const herd = createHerd('thundertree', 'cattle', 5)
    const result = resolveSlaughter({
      intent: { type: 'slaughter', characterId: KAELITH,
                herdId: 'h', nodeId: 'thundertree', count: 100 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(herd.adults + herd.elders).toBe(0)  // all slaughtered, no error
  })

  it('rejects when no mature animals (only young)', () => {
    const herd = createHerd('thundertree', 'cattle', 0)
    herd.young = 3
    const result = resolveSlaughter({
      intent: { type: 'slaughter', characterId: KAELITH,
                herdId: 'h', nodeId: 'thundertree', count: 1 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/No mature animals/)
  })

  it('takes ~1 day per 5 head, min 1', () => {
    const herd = createHerd('thundertree', 'cattle', 20)
    const result = resolveSlaughter({
      intent: { type: 'slaughter', characterId: KAELITH,
                herdId: 'h', nodeId: 'thundertree', count: 12 },
      herd, species: getCattle(),
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.daysSpent).toBe(3)  // ceil(12/5) = 3
  })
})

describe('plant_crops — fallow → planted', () => {
  function makePlot(overrides: Partial<FarmPlot> = {}): FarmPlot {
    return {
      id: 'plot_north_field',
      nodeId: 'thundertree',
      ownerId: 'thundertree',
      farmerId: 'farmhand_1',
      plotSize: 'small_plot',  // 5 acres
      tenure: 'tenant',
      cultivation: 'monoculture',
      crops: [],
      growthDays: 0,
      planted: false,
      season: 'spring',
      soilQuality: 1.0,
      ...overrides,
    }
  }

  it('schema validates', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'plant_crops', characterId: KAELITH,
      plotId: 'plot_north_field', nodeId: 'thundertree',
      crops: [{ type: 'wheat', acresPlanted: 5 }], season: 'spring',
    })
    expect(ok.success).toBe(true)
  })

  it('plants on a fallow plot', () => {
    const plot = makePlot()
    const result = resolvePlantCrops({
      intent: {
        type: 'plant_crops', characterId: KAELITH,
        plotId: plot.id, nodeId: 'thundertree',
        crops: [{ type: 'wheat', acresPlanted: 5 }],
        season: 'spring',
      },
      plot,
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(plot.planted).toBe(true)
    expect(plot.growthDays).toBe(0)
    expect(plot.crops.length).toBe(1)
    expect(plot.crops[0].type).toBe('wheat')
    expect(plot.season).toBe('spring')
  })

  it('rejects already-planted plot', () => {
    const plot = makePlot({ planted: true, crops: [{ type: 'wheat', acresPlanted: 5 }] })
    const result = resolvePlantCrops({
      intent: {
        type: 'plant_crops', characterId: KAELITH,
        plotId: plot.id, nodeId: 'thundertree',
        crops: [{ type: 'barley', acresPlanted: 5 }], season: 'spring',
      },
      plot,
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already planted/)
  })

  it('rejects unknown crop type', () => {
    const plot = makePlot()
    const result = resolvePlantCrops({
      intent: {
        type: 'plant_crops', characterId: KAELITH,
        plotId: plot.id, nodeId: 'thundertree',
        crops: [{ type: 'unobtainium', acresPlanted: 5 }], season: 'spring',
      },
      plot,
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/Unknown crop type/)
  })

  it('rejects when acres exceed plot capacity', () => {
    const plot = makePlot({ plotSize: 'small_plot' })  // 5 acres
    const result = resolvePlantCrops({
      intent: {
        type: 'plant_crops', characterId: KAELITH,
        plotId: plot.id, nodeId: 'thundertree',
        crops: [{ type: 'wheat', acresPlanted: 100 }], season: 'spring',
      },
      plot,
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/exceeds plot capacity/)
  })

  it('multi-crop multiculture sums acres correctly', () => {
    const plot = makePlot({ plotSize: 'field' })  // 40 acres
    const result = resolvePlantCrops({
      intent: {
        type: 'plant_crops', characterId: KAELITH,
        plotId: plot.id, nodeId: 'thundertree',
        crops: [
          { type: 'wheat', acresPlanted: 20 },
          { type: 'barley', acresPlanted: 15 },
        ],
        season: 'spring',
      },
      plot,
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(plot.crops.length).toBe(2)
  })
})

describe('sell_item — slow-life economy closes the loop', () => {
  function seedMarketWithIron(taxRate = 0.05) {
    const market = createSettlementMarket('thundertree', taxRate)
    market.prices['iron_ore'] = {
      commodityId: 'iron_ore', basePrice: 1, currentPrice: 2,
      supply: 100, demand: 50, trend: 'stable', available: true,
    } satisfies CommodityPrice
    return market
  }

  it('schema validates', () => {
    const ok = PlayerIntentSchema.safeParse({
      type: 'sell_item', characterId: KAELITH,
      nodeId: 'thundertree', resourceId: 'iron_ore', quantity: 10,
    })
    expect(ok.success).toBe(true)
  })

  it('sells at current price; gold = qty × price × (1 - tax)', () => {
    const market = seedMarketWithIron(0.05)
    const result = resolveSellItem({
      intent: { type: 'sell_item', characterId: KAELITH,
                nodeId: 'thundertree', resourceId: 'iron_ore', quantity: 10 },
      market,
      characterNodeId: 'thundertree',
      worldDay: 1,
    })
    expect(result.ok).toBe(true)
    expect(result.unitPrice).toBe(2)
    expect(result.goldEarned).toBe(10 * 2 * 0.95)   // 19
    expect(result.taxPaid).toBeCloseTo(10 * 2 * 0.05) // 1
  })

  it('adds quantity into market supply (re-prices on next tick)', () => {
    const market = seedMarketWithIron()
    const supplyBefore = market.prices['iron_ore'].supply
    resolveSellItem({
      intent: { type: 'sell_item', characterId: KAELITH,
                nodeId: 'thundertree', resourceId: 'iron_ore', quantity: 25 },
      market, characterNodeId: 'thundertree', worldDay: 1,
    })
    expect(market.prices['iron_ore'].supply).toBe(supplyBefore + 25)
  })

  it('fails when commodity is not on the market price table', () => {
    const market = seedMarketWithIron()
    const result = resolveSellItem({
      intent: { type: 'sell_item', characterId: KAELITH,
                nodeId: 'thundertree', resourceId: 'unicorn_horn', quantity: 1 },
      market, characterNodeId: 'thundertree', worldDay: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no buyer/)
  })

  it('fails on wrong node', () => {
    const market = seedMarketWithIron()
    const result = resolveSellItem({
      intent: { type: 'sell_item', characterId: KAELITH,
                nodeId: 'thundertree', resourceId: 'iron_ore', quantity: 1 },
      market, characterNodeId: 'baldurs_gate', worldDay: 1,
    })
    expect(result.ok).toBe(false)
  })

  it('emits an observe TPB entry at the market node', () => {
    const market = seedMarketWithIron()
    const result = resolveSellItem({
      intent: { type: 'sell_item', characterId: KAELITH,
                nodeId: 'thundertree', resourceId: 'iron_ore', quantity: 5 },
      market, characterNodeId: 'thundertree', worldDay: 1,
    })
    expect(result.tpbEntries).toEqual([
      { type: 'observe', nodeId: 'thundertree', partyId: KAELITH },
    ])
  })
})

describe('getAvailableInteractions', () => {
  it('returns examine + extract when at deposit with a tool', () => {
    const dep = makeDeposit()
    const types = getAvailableInteractions({
      characterId: KAELITH,
      characterNodeId: 'thundertree',
      hasMiningTool: true,
      deposit: dep,
    })
    expect(types).toContain('examine_deposit')
    expect(types).toContain('extract')
  })

  it('hides extract when no tool', () => {
    const dep = makeDeposit()
    const types = getAvailableInteractions({
      characterId: KAELITH,
      characterNodeId: 'thundertree',
      hasMiningTool: false,
      deposit: dep,
    })
    expect(types).toContain('examine_deposit')
    expect(types).not.toContain('extract')
  })

  it('hides examine + extract when at wrong node', () => {
    const dep = makeDeposit()
    const types = getAvailableInteractions({
      characterId: KAELITH,
      characterNodeId: 'baldurs_gate',
      hasMiningTool: true,
      deposit: dep,
    })
    expect(types).not.toContain('examine_deposit')
    expect(types).not.toContain('extract')
  })

  it('shows study_material when holding resources', () => {
    const types = getAvailableInteractions({
      characterId: KAELITH,
      characterNodeId: 'thundertree',
      hasMiningTool: false,
      heldResourceIds: ['iron_ore'],
    })
    expect(types).toContain('study_material')
  })
})
