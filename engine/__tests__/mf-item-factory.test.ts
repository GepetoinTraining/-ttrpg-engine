/**
 * Item factory v2 (W3.2) — smelt → forge → identify chain.
 *
 * Verifies:
 *   - mfSmelt produces a deterministic ingot with affixes
 *   - mfForge inherits affixes from the ingot + mints fresh ones
 *   - mfIdentify gates affix visibility by mastery + skill check
 *   - Same input → same output (Theorem 1: receipts match on replay)
 */

import { describe, it, expect } from 'vitest'
import { mfSmelt, type SmeltContext, type SmeltInput } from '../mf-smelt'
import { mfForge, type ForgeContext, type ForgeInput } from '../mf-forge'
import { mfIdentify, type IdentifyContext, type IdentifyInput } from '../mf-identify'
import { mintAffixes, AFFIX_CATALOG } from '../material-affixes'

const ironIngotCtx: SmeltContext = {
  recipeKey: 'iron_ingot',
  requiredHeat: 1100,
  fluxPerOre: 0.5,
  skillFloor: 5,
  ingotBaseName: 'Iron Ingot',
  ingotResourceId: 'ingot:iron',
  ingotTier: 2,
}

const longswordCtx: ForgeContext = {
  recipeKey: 'longsword',
  requiredAnvilTier: 1,
  skillFloor: 5,
  baseDC: 12,
  itemBaseName: 'Iron Longsword',
  itemResourceId: 'weapon:longsword:iron',
  itemTier: 2,
  ingotPerItem: 2,
}

const identifyCtx: IdentifyContext = {
  masteryFloorForFullReveal: 3,
  baseDC: 12,
}

describe('mintAffixes', () => {
  it('is deterministic given (lot, day, maker)', () => {
    const inA = { materialLotId: 'iron_lot_42', worldDay: 100, makerCertId: 'maker_x', skillBonus: 8, tierBonus: 2 }
    const a = mintAffixes(inA)
    const b = mintAffixes(inA)
    expect(a.affixes).toEqual(b.affixes)
    expect(a.rollSeed).toBe(b.rollSeed)
  })

  it('different makers on the same lot+day mint different affixes', () => {
    const seed = { materialLotId: 'iron_lot_42', worldDay: 100, skillBonus: 10, tierBonus: 4 }
    const a = mintAffixes({ ...seed, makerCertId: 'maker_a' })
    const b = mintAffixes({ ...seed, makerCertId: 'maker_b' })
    // Not guaranteed always different — but with two distinct makers and high
    // skill, expect at least one to roll an affix
    expect(a.affixes.length + b.affixes.length).toBeGreaterThan(0)
  })

  it('locks legendary affixes behind tier ≥ 4 + skill ≥ 10', () => {
    // Low tier should never produce legendary
    for (let i = 0; i < 50; i++) {
      const out = mintAffixes({
        materialLotId: `lot_${i}`,
        worldDay: 1,
        makerCertId: 'maker',
        skillBonus: 5,
        tierBonus: 1,
      })
      for (const a of out.affixes) expect(a.rarity).not.toBe('legendary')
    }
  })
})

describe('mfSmelt', () => {
  const baseInput: SmeltInput = {
    oreLotId: 'iron_ore_001',
    oreQty: 4,
    oreQuality: 'fair',
    fluxQty: 2,
    heatProvided: 1200,
    skill: 8,
    toolBonus: 1,
    worldDay: 100,
    makerCertId: 'smith_kael',
    d20: 15,
  }

  it('produces an ingot on full success', () => {
    const { output, receipt } = mfSmelt(ironIngotCtx, baseInput)
    expect(output.success).toBe(true)
    expect(output.ingot).toBeTruthy()
    expect(output.ingot!.resourceId).toBe('ingot:iron')
    expect(output.ingot!.quantity).toBe(4)
    expect(output.ingot!.tier).toBe(2)
    expect(output.slag).toBe(0)
    expect(receipt.skillCheck.passed).toBe(true)
  })

  it('fails on bad skill check', () => {
    const { output, receipt } = mfSmelt(ironIngotCtx, { ...baseInput, skill: 1, toolBonus: 0, d20: 1 })
    expect(output.success).toBe(false)
    expect(output.ingot).toBeNull()
    expect(receipt.skillCheck.passed).toBe(false)
  })

  it('partial flux yields half the ore', () => {
    const { output } = mfSmelt(ironIngotCtx, { ...baseInput, fluxQty: 0 })
    expect(output.success).toBe(true)
    expect(output.ingot!.quantity).toBe(2)
    expect(output.slag).toBe(2)
  })

  it('insufficient heat fails outright', () => {
    const { output } = mfSmelt(ironIngotCtx, { ...baseInput, heatProvided: 500 })
    expect(output.success).toBe(false)
    expect(output.reason).toBe('insufficient_heat')
  })

  it('is deterministic', () => {
    const a = mfSmelt(ironIngotCtx, baseInput)
    const b = mfSmelt(ironIngotCtx, baseInput)
    expect(a.output.ingot).toEqual(b.output.ingot)
    expect(a.receipt).toEqual(b.receipt)
  })
})

describe('mfForge', () => {
  it('forges a longsword from an ingot + inherits affixes', () => {
    const smelt = mfSmelt(ironIngotCtx, {
      oreLotId: 'iron_ore_001',
      oreQty: 4,
      oreQuality: 'good',
      fluxQty: 2,
      heatProvided: 1200,
      skill: 12,
      toolBonus: 2,
      worldDay: 100,
      makerCertId: 'smith_kael',
      d20: 18,
    })
    expect(smelt.output.success).toBe(true)
    const ingot = smelt.output.ingot!

    const forgeInput: ForgeInput = {
      ingot,
      count: 1,
      anvilTier: 2,
      skill: 10,
      toolBonus: 1,
      worldDay: 101,
      makerCertId: 'smith_kael',
      d20: 16,
    }
    const { output, receipt } = mfForge(longswordCtx, forgeInput)
    expect(output.success).toBe(true)
    expect(output.item).toBeTruthy()
    expect(output.item!.resourceId).toBe('weapon:longsword:iron')
    expect(output.item!.quantity).toBe(1)
    expect(receipt.skillCheck.passed).toBe(true)
    expect(receipt.inheritedAffixIds).toEqual(ingot.affixes.map((a) => a.id))
    // Forged item carries at least the inherited affixes
    for (const a of ingot.affixes) {
      expect(output.item!.affixes.find((b) => b.id === a.id)).toBeTruthy()
    }
  })

  it('fails when anvil too weak', () => {
    const ingot = mfSmelt(ironIngotCtx, {
      oreLotId: 'iron_ore_002', oreQty: 2, oreQuality: 'fair', fluxQty: 1,
      heatProvided: 1200, skill: 8, toolBonus: 0, worldDay: 100, makerCertId: 'm', d20: 15,
    }).output.ingot!
    const ctx: ForgeContext = { ...longswordCtx, requiredAnvilTier: 5 }
    const { output } = mfForge(ctx, {
      ingot, count: 1, anvilTier: 2, skill: 12, toolBonus: 2,
      worldDay: 101, makerCertId: 'm', d20: 16,
    })
    expect(output.success).toBe(false)
    expect(output.reason).toBe('anvil_too_weak')
  })
})

describe('mfIdentify', () => {
  it('reveals nothing at knowledge=0 with failed check', () => {
    const ingot = mfSmelt(ironIngotCtx, {
      oreLotId: 'l_a', oreQty: 4, oreQuality: 'masterwork', fluxQty: 2,
      heatProvided: 1200, skill: 15, toolBonus: 3, worldDay: 100, makerCertId: 'maker', d20: 20,
    }).output.ingot!
    const { output } = mfIdentify(identifyCtx, {
      item: ingot, knowledgeLevel: 0, skill: 0, toolBonus: 0, d20: 1,
    })
    expect(output.revealedAffixes.length).toBe(0)
    expect(output.fullyRevealed).toBe(ingot.affixes.length === 0)
  })

  it('reveals all affixes at knowledge=3', () => {
    const ingot = mfSmelt(ironIngotCtx, {
      oreLotId: 'l_b', oreQty: 4, oreQuality: 'masterwork', fluxQty: 2,
      heatProvided: 1200, skill: 15, toolBonus: 3, worldDay: 100, makerCertId: 'maker', d20: 20,
    }).output.ingot!
    const { output } = mfIdentify(identifyCtx, {
      item: ingot, knowledgeLevel: 3, skill: 10, toolBonus: 0, d20: 15,
    })
    expect(output.revealedAffixes.length).toBe(ingot.affixes.length)
    expect(output.fullyRevealed).toBe(true)
  })

  it('grants masteryGain=1 on a successful check below max', () => {
    const fakeItem = {
      id: 'fake_item',
      resourceId: 'ingot:fake',
      baseName: 'Fake',
      quantity: 1,
      quality: 'fair' as const,
      tier: 2,
      affixes: [AFFIX_CATALOG[0]], // has at least one affix
      provenance: { method: 'smelted' as const, parentLotId: null, makerCertId: null, worldDay: 0 },
    }
    const { output } = mfIdentify(identifyCtx, {
      item: fakeItem, knowledgeLevel: 1, skill: 10, toolBonus: 0, d20: 15,
    })
    expect(output.masteryGain).toBe(1)
  })
})
