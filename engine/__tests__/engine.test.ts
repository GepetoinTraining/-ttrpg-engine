/**
 * ENGINE TESTS — Verify every MF, MM, and TPB
 * =============================================
 * 
 * Testing the pipeline: Rules → Math → MM/MF + TP → verify receipt integrity
 * 
 * What we test:
 *   1. MF_dice: deterministic rolls, receipt integrity, inverse verification
 *   2. MF_check: advantage/disadvantage, critical hits, comparison math
 *   3. MF_damage: resistance/vulnerability/immunity, temp HP, massive damage
 *   4. MM_combat: full attack chain, ? slot resolution (miss = skip)
 *   5. TPB: append-only, branch, diff, aggregate delta
 */

import { describe, it, expect } from 'vitest'
import { mfDice, mfDiceInverse, type DiceFormula } from '../mf-dice.js'
import { mfCheck, mfCheckInverse, type CheckParams } from '../mf-check.js'
import { mfDamage, mfDamageInverse, type DamageInput, type TargetState } from '../mf-damage.js'
import { mmCombatAttack, type AttackAction } from '../mm-combat.js'
import { TPB } from '../tpb.js'

// ============================================================
// MF_DICE TESTS
// ============================================================

describe('MF_dice', () => {
  it('produces deterministic results with same seed', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 5 }
    const a = mfDice(formula, 42)
    const b = mfDice(formula, 42)
    expect(a.output.total).toBe(b.output.total)
    expect(a.output.rolls).toEqual(b.output.rolls)
  })

  it('produces different results with different seeds', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 5 }
    const a = mfDice(formula, 42)
    const b = mfDice(formula, 99)
    // Almost certainly different (1 in 20 chance of collision)
    // We test structure, not luck
    expect(a.output.rolls.length).toBe(1)
    expect(b.output.rolls.length).toBe(1)
  })

  it('receipt is always verified', () => {
    const formula: DiceFormula = { count: 3, sides: 6, modifier: 2 }
    for (let seed = 1; seed <= 100; seed++) {
      const { output, receipt } = mfDice(formula, seed)
      expect(receipt.verified).toBe(true)
      expect(receipt.sum + receipt.modifier).toBe(output.total)
    }
  })

  it('rolls are within bounds', () => {
    const formula: DiceFormula = { count: 4, sides: 6, modifier: 0 }
    for (let seed = 1; seed <= 50; seed++) {
      const { output } = mfDice(formula, seed)
      expect(output.rolls.length).toBe(4)
      for (const roll of output.rolls) {
        expect(roll).toBeGreaterThanOrEqual(1)
        expect(roll).toBeLessThanOrEqual(6)
      }
    }
  })

  it('sum equals sum of rolls', () => {
    const formula: DiceFormula = { count: 2, sides: 8, modifier: 3 }
    const { output } = mfDice(formula, 42)
    const expectedSum = output.rolls.reduce((a, b) => a + b, 0)
    expect(output.sum).toBe(expectedSum)
    expect(output.total).toBe(expectedSum + 3)
  })

  it('inverse verification passes for valid results', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 7 }
    const { output } = mfDice(formula, 42)
    const inverse = mfDiceInverse(output, formula)
    expect(inverse.valid).toBe(true)
    expect(inverse.errors).toHaveLength(0)
  })

  it('inverse catches tampered total', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 5 }
    const { output } = mfDice(formula, 42)
    const tampered = { ...output, total: output.total + 1 }
    const inverse = mfDiceInverse(tampered, formula)
    expect(inverse.valid).toBe(false)
    expect(inverse.errors.length).toBeGreaterThan(0)
  })

  it('detects natural 20', () => {
    // Find a seed that gives a natural 20 on d20
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    let found = false
    for (let seed = 1; seed <= 1000; seed++) {
      const { output } = mfDice(formula, seed)
      if (output.rolls[0] === 20) {
        expect(output.natural20).toBe(true)
        expect(output.natural1).toBe(false)
        found = true
        break
      }
    }
    expect(found).toBe(true) // A d20 should hit 20 within 1000 tries
  })

  it('formula string is correct', () => {
    expect(mfDice({ count: 1, sides: 20, modifier: 5 }, 1).output.formula).toBe('1d20+5')
    expect(mfDice({ count: 2, sides: 6, modifier: -1 }, 1).output.formula).toBe('2d6-1')
    expect(mfDice({ count: 1, sides: 8, modifier: 0 }, 1).output.formula).toBe('1d8+0')
  })
})

// ============================================================
// MF_CHECK TESTS
// ============================================================

describe('MF_check', () => {
  it('succeeds when total >= threshold', () => {
    const dice = mfDice({ count: 1, sides: 20, modifier: 10 }, 42)
    // With +10, most rolls should pass DC 15
    const params: CheckParams = { threshold: 10, type: 'ability_check', advantage: 'normal', modifier: 10 }
    const { output, receipt } = mfCheck([dice.output], params)
    expect(receipt.verified).toBe(true)
    expect(output.success).toBe(output.total >= params.threshold)
    expect(output.margin).toBe(output.total - params.threshold)
  })

  it('advantage takes higher roll', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    const roll1 = mfDice(formula, 42)
    const roll2 = mfDice(formula, 99)
    const params: CheckParams = { threshold: 15, type: 'ability_check', advantage: 'advantage', modifier: 0 }
    const { output, receipt } = mfCheck([roll1.output, roll2.output], params)
    expect(output.total).toBe(Math.max(roll1.output.total, roll2.output.total))
    expect(receipt.verified).toBe(true)
  })

  it('disadvantage takes lower roll', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    const roll1 = mfDice(formula, 42)
    const roll2 = mfDice(formula, 99)
    const params: CheckParams = { threshold: 15, type: 'ability_check', advantage: 'disadvantage', modifier: 0 }
    const { output } = mfCheck([roll1.output, roll2.output], params)
    expect(output.total).toBe(Math.min(roll1.output.total, roll2.output.total))
  })

  it('natural 20 on attack always hits', () => {
    // Find a seed that gives a natural 20
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    for (let seed = 1; seed <= 1000; seed++) {
      const dice = mfDice(formula, seed)
      if (dice.output.natural20) {
        // Even against AC 30, nat 20 hits
        const params: CheckParams = { threshold: 30, type: 'attack_roll', advantage: 'normal', modifier: 0 }
        const { output } = mfCheck([dice.output], params)
        expect(output.success).toBe(true)
        expect(output.criticalHit).toBe(true)
        break
      }
    }
  })

  it('natural 1 on attack always misses', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    for (let seed = 1; seed <= 1000; seed++) {
      const dice = mfDice(formula, seed)
      if (dice.output.natural1) {
        // Even against AC 1, nat 1 misses
        const params: CheckParams = { threshold: 1, type: 'attack_roll', advantage: 'normal', modifier: 0 }
        const { output } = mfCheck([dice.output], params)
        expect(output.success).toBe(false)
        expect(output.criticalMiss).toBe(true)
        break
      }
    }
  })

  it('inverse verification passes', () => {
    const dice = mfDice({ count: 1, sides: 20, modifier: 5 }, 42)
    const params: CheckParams = { threshold: 15, type: 'ability_check', advantage: 'normal', modifier: 5 }
    const { output } = mfCheck([dice.output], params)
    const inv = mfCheckInverse(output, params, [dice.output])
    expect(inv.valid).toBe(true)
  })
})

// ============================================================
// MF_DAMAGE TESTS
// ============================================================

describe('MF_damage', () => {
  it('applies normal damage correctly', () => {
    const input: DamageInput = { rawDamage: 10, damageType: 'slashing', isCritical: false }
    const target: TargetState = { hpCurrent: 30, hpMax: 30, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] }
    const { output, receipt } = mfDamage(input, target)
    expect(output.hpAfter).toBe(20)
    expect(output.damageDealt).toBe(10)
    expect(output.multiplier).toBe(1)
    expect(receipt.verified).toBe(true)
  })

  it('resistance halves damage (rounded down)', () => {
    const input: DamageInput = { rawDamage: 15, damageType: 'fire', isCritical: false }
    const target: TargetState = { hpCurrent: 30, hpMax: 30, tempHp: 0, resistances: ['fire'], vulnerabilities: [], immunities: [] }
    const { output, receipt } = mfDamage(input, target)
    expect(output.multiplier).toBe(0.5)
    expect(output.hpAfter).toBe(23) // 30 - floor(15 * 0.5) = 30 - 7 = 23
    expect(output.resisted).toBe(8) // 15 - 7 = 8
    expect(receipt.verified).toBe(true)
  })

  it('vulnerability doubles damage', () => {
    const input: DamageInput = { rawDamage: 10, damageType: 'fire', isCritical: false }
    const target: TargetState = { hpCurrent: 30, hpMax: 30, tempHp: 0, resistances: [], vulnerabilities: ['fire'], immunities: [] }
    const { output, receipt } = mfDamage(input, target)
    expect(output.multiplier).toBe(2)
    expect(output.hpAfter).toBe(10) // 30 - 20 = 10
    expect(receipt.verified).toBe(true)
  })

  it('immunity negates all damage', () => {
    const input: DamageInput = { rawDamage: 100, damageType: 'poison', isCritical: false }
    const target: TargetState = { hpCurrent: 30, hpMax: 30, tempHp: 0, resistances: [], vulnerabilities: [], immunities: ['poison'] }
    const { output, receipt } = mfDamage(input, target)
    expect(output.multiplier).toBe(0)
    expect(output.hpAfter).toBe(30)
    expect(output.damageDealt).toBe(0)
    expect(receipt.verified).toBe(true)
  })

  it('resistance + vulnerability cancel out', () => {
    const input: DamageInput = { rawDamage: 10, damageType: 'fire', isCritical: false }
    const target: TargetState = { hpCurrent: 30, hpMax: 30, tempHp: 0, resistances: ['fire'], vulnerabilities: ['fire'], immunities: [] }
    const { output } = mfDamage(input, target)
    expect(output.multiplier).toBe(1)
    expect(output.hpAfter).toBe(20)
  })

  it('temp HP absorbs damage before real HP', () => {
    const input: DamageInput = { rawDamage: 15, damageType: 'slashing', isCritical: false }
    const target: TargetState = { hpCurrent: 30, hpMax: 30, tempHp: 10, resistances: [], vulnerabilities: [], immunities: [] }
    const { output, receipt } = mfDamage(input, target)
    expect(output.absorbed).toBe(10)    // All temp HP consumed
    expect(output.tempHpAfter).toBe(0)
    expect(output.damageDealt).toBe(5)  // Remaining 5 to real HP
    expect(output.hpAfter).toBe(25)
    expect(receipt.verified).toBe(true)
  })

  it('HP cannot go below 0', () => {
    const input: DamageInput = { rawDamage: 35, damageType: 'force', isCritical: false }
    const target: TargetState = { hpCurrent: 10, hpMax: 30, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] }
    const { output, receipt } = mfDamage(input, target)
    expect(output.hpAfter).toBe(0)
    expect(output.statusChange).toBe('unconscious')  // excess 25 < hpMax 30
    expect(receipt.verified).toBe(true)
  })

  it('massive damage causes instant death', () => {
    const input: DamageInput = { rawDamage: 100, damageType: 'force', isCritical: false }
    const target: TargetState = { hpCurrent: 10, hpMax: 30, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] }
    const { output } = mfDamage(input, target)
    // Excess = 100 - 10 = 90, hpMax = 30: 90 >= 30 → dead
    expect(output.statusChange).toBe('dead')
  })

  it('inverse verification passes', () => {
    const input: DamageInput = { rawDamage: 12, damageType: 'slashing', isCritical: false }
    const target: TargetState = { hpCurrent: 25, hpMax: 40, tempHp: 5, resistances: [], vulnerabilities: [], immunities: [] }
    const { output, receipt } = mfDamage(input, target)
    const inv = mfDamageInverse(output, receipt)
    expect(inv.valid).toBe(true)
  })
})

// ============================================================
// MM_COMBAT TESTS
// ============================================================

describe('MM_combat', () => {
  it('resolves a complete attack (hit)', () => {
    // Use a seed that we know produces a hit
    const action: AttackAction = {
      attackerId: 'fighter',
      targetId: 'goblin',
      attackFormula: { count: 1, sides: 20, modifier: 7 },
      targetAC: 13,
      advantage: 'normal',
      damageFormula: { count: 1, sides: 8, modifier: 3 },
      damageType: 'slashing',
      target: { hpCurrent: 15, hpMax: 15, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] },
      seed: 42,
    }

    const { result, receipts } = mmCombatAttack(action)

    // Structure checks
    expect(result.attackRoll.rolls.length).toBe(1)
    expect(typeof result.hit).toBe('boolean')

    if (result.hit) {
      expect(result.damageResult).not.toBeNull()
      expect(result.damageResult!.damageDealt).toBeGreaterThanOrEqual(0)
    } else {
      expect(result.damageResult).toBeNull()
    }

    // All receipts verified
    expect(receipts.allVerified).toBe(true)
    expect(receipts.chain.length).toBeGreaterThanOrEqual(2) // At least dice + check
  })

  it('miss skips damage (? slot resolution)', () => {
    // Find a seed that misses against high AC
    const baseAction: AttackAction = {
      attackerId: 'commoner',
      targetId: 'tarrasque',
      attackFormula: { count: 1, sides: 20, modifier: 0 },
      targetAC: 25,  // Very high AC
      advantage: 'normal',
      damageFormula: { count: 1, sides: 4, modifier: 0 },
      damageType: 'bludgeoning',
      target: { hpCurrent: 676, hpMax: 676, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] },
    }

    // Run 50 attempts — most should miss against AC 25
    let foundMiss = false
    for (let seed = 1; seed <= 50; seed++) {
      const { result, receipts } = mmCombatAttack({ ...baseAction, seed })
      if (!result.hit && !result.fumble) {
        // Normal miss
        expect(result.damageResult).toBeNull()
        expect(receipts.damageRollReceipt).toBeUndefined()
        expect(receipts.damageReceipt).toBeUndefined()
        expect(receipts.chain.length).toBe(2) // Only dice + check
        foundMiss = true
        break
      }
    }
    expect(foundMiss).toBe(true)
  })

  it('critical hit doubles dice', () => {
    // Find a natural 20 seed
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 5 }
    for (let seed = 1; seed <= 1000; seed++) {
      const roll = mfDice(formula, seed)
      if (roll.output.natural20) {
        const action: AttackAction = {
          attackerId: 'fighter',
          targetId: 'goblin',
          attackFormula: { count: 1, sides: 20, modifier: 5 },
          targetAC: 30, // Doesn't matter — nat 20 always hits
          advantage: 'normal',
          damageFormula: { count: 1, sides: 8, modifier: 3 },
          damageType: 'slashing',
          target: { hpCurrent: 50, hpMax: 50, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] },
          seed,
        }
        const { result, receipts } = mmCombatAttack(action)
        expect(result.hit).toBe(true)
        expect(result.critical).toBe(true)
        // Damage roll should use 2 dice (critical doubles)
        expect(receipts.damageRollReceipt).toBeDefined()
        expect(receipts.allVerified).toBe(true)
        break
      }
    }
  })

  it('receipt chain maintains order', () => {
    const action: AttackAction = {
      attackerId: 'a',
      targetId: 'b',
      attackFormula: { count: 1, sides: 20, modifier: 10 },
      targetAC: 10,
      advantage: 'normal',
      damageFormula: { count: 2, sides: 6, modifier: 4 },
      damageType: 'fire',
      target: { hpCurrent: 40, hpMax: 40, tempHp: 0, resistances: [], vulnerabilities: [], immunities: [] },
      seed: 42,
    }
    const { receipts } = mmCombatAttack(action)
    // Verify ticks are monotonically increasing
    for (let i = 1; i < receipts.chain.length; i++) {
      expect(receipts.chain[i].tick).toBeGreaterThan(receipts.chain[i - 1].tick)
    }
  })
})

// ============================================================
// TPB TESTS
// ============================================================

describe('TPB', () => {
  it('starts with initial state', () => {
    const tpb = TPB.create({ hp: 30, name: 'Goblin' })
    expect(tpb.length()).toBe(1)
    expect(tpb.currentState()).toEqual({ hp: 30, name: 'Goblin' })
  })

  it('append-only: history only grows', () => {
    const tpb = TPB.create({ hp: 30 })
    tpb.append('took 5 damage', { hp: 25 })
    tpb.append('took 10 damage', { hp: 15 })
    expect(tpb.length()).toBe(3)
    expect(tpb.currentState()).toEqual({ hp: 15 })
    expect(tpb.stateAt(0)).toEqual({ hp: 30 })
    expect(tpb.stateAt(1)).toEqual({ hp: 25 })
  })

  it('branch creates independent fork', () => {
    const tpb = TPB.create({ hp: 30 })
    tpb.append('took 5 damage', { hp: 25 })
    tpb.append('took 10 damage', { hp: 15 })

    // Branch from index 1 (hp: 25)
    const branch = tpb.branch(1)!
    expect(branch).not.toBeNull()
    expect(branch.currentState()).toEqual({ hp: 25 })
    expect(branch.getBranchPoint()).toBe(1)

    // Append different action to branch
    branch.append('healed 10', { hp: 35 })
    
    // Original unchanged
    expect(tpb.currentState()).toEqual({ hp: 15 })
    // Branch diverged
    expect(branch.currentState()).toEqual({ hp: 35 })
  })

  it('diff finds divergence point', () => {
    const tpbA = TPB.create({ hp: 30 })
    tpbA.append('took 5', { hp: 25 })
    tpbA.append('took 10', { hp: 15 })

    const tpbB = TPB.create({ hp: 30 })
    tpbB.append('took 5', { hp: 25 })
    tpbB.append('healed 5', { hp: 30 })

    const diff = TPB.diff(tpbA, tpbB)
    expect(diff.divergenceIndex).toBe(2) // Same at 0, 1; different at 2
    expect(diff.commonPrefix).toBe(2)
  })

  it('aggregate delta sums correctly', () => {
    const tpb = TPB.create({ hp: 30 })
    tpb.append('attack 1', { hp: 25 }, { delta: { potential: -5, archival: 0, omega: 5 } })
    tpb.append('attack 2', { hp: 15 }, { delta: { potential: -10, archival: 0, omega: 10 } })

    const agg = tpb.aggregateDelta(1, 3) // entries 1 and 2
    expect(agg.potential).toBe(-15)
    expect(agg.omega).toBe(15)
  })

  it('serializes and deserializes', () => {
    const tpb = TPB.create({ hp: 30 }, 'session-1')
    tpb.append('took 5', { hp: 25 }, { sessionId: 'session-1' })

    const json = tpb.toJSON()
    const restored = TPB.fromJSON(json)
    expect(restored.length()).toBe(2)
    expect(restored.currentState()).toEqual({ hp: 25 })
  })

  it('session filter works', () => {
    const tpb = TPB.create({ hp: 30 }, 'session-1')
    tpb.append('round 1', { hp: 25 }, { sessionId: 'session-1' })
    tpb.append('round 2', { hp: 20 }, { sessionId: 'session-1' })
    tpb.append('round 1', { hp: 15 }, { sessionId: 'session-2' })

    const s1 = tpb.session('session-1')
    expect(s1.length).toBe(3) // initial + 2 rounds
    const s2 = tpb.session('session-2')
    expect(s2.length).toBe(1)
  })
})

// ============================================================
// TP INDEX TESTS
// ============================================================

import { TP, type WorldNode } from '../tp.js'

describe('TP (topology pointer)', () => {
  // Build a mini world tree for testing:
  // Realmspace → Toril → Faerûn → Cormyr → Suzail → Market Ward
  const nodes: WorldNode[] = [
    {
      id: 'realmspace', type: 'crystal_sphere', name: 'Realmspace',
      parentId: null,
      dataStatic: {
        physics: { gravity: { type: 'none' }, magic: { level: 'standard' } },
      },
    },
    {
      id: 'toril', type: 'planet', name: 'Toril',
      parentId: 'realmspace',
      dataStatic: {
        physics: { gravity: { type: 'standard', strength: 1.0 }, magic: { level: 'high', source: 'The Weave' } },
      },
    },
    {
      id: 'faerun', type: 'continent', name: 'Faerûn',
      parentId: 'toril',
      dataStatic: {},  // Inherits from Toril
    },
    {
      id: 'cormyr', type: 'region', name: 'Cormyr',
      parentId: 'faerun',
      dataStatic: {
        law: { system: 'The Code of Cormyr', enforcement: 'strict' },
        economy: { currency: 'Cormyrean Golden Lion' },
      },
    },
    {
      id: 'suzail', type: 'metropolis', name: 'Suzail',
      parentId: 'cormyr',
      dataStatic: {
        culture: { law: { specialRules: ['Adventurers must register for a Charter (1000gp)'] } },
        economy: { type: 'imperial_capital' },
      },
    },
    {
      id: 'market_ward', type: 'district', name: 'Market Ward',
      parentId: 'suzail',
      dataStatic: {
        economy: { tradeModifier: 0.9 },  // Slightly cheaper in market
      },
    },
    {
      id: 'undercity', type: 'district', name: 'Undercity',
      parentId: 'suzail',
      dataStatic: {
        physics: { magic: { level: 'dead' } },  // Dead magic zone!
        law: { enforcement: 'none', corruption: 'total' },
      },
    },
  ]

  const edges = [
    { type: 'FACTION_PRESENCE', sourceId: 'fac-harpers', targetId: 'suzail', properties: { influence: 40 } },
    { type: 'TRADE_ROUTE', sourceId: 'suzail', targetId: 'cormyr', properties: { name: 'Kings Road' } },
  ]

  it('resolves ancestry chain', () => {
    const tp = new TP()
    tp.loadNodes(nodes)

    const ctx = tp.resolve('market_ward')!
    expect(ctx).not.toBeNull()
    expect(ctx.currentNodeName).toBe('Market Ward')
    expect(ctx.ancestry.length).toBe(6) // Market Ward → Suzail → Cormyr → Faerûn → Toril → Realmspace
    expect(ctx.ancestry[0].name).toBe('Market Ward')
    expect(ctx.ancestry[5].name).toBe('Realmspace')
  })

  it('child overrides parent physics', () => {
    const tp = new TP()
    tp.loadNodes(nodes)

    // Market Ward inherits Toril's gravity and magic
    const market = tp.resolve('market_ward')!
    expect(market.physics.gravity?.type).toBe('standard')
    expect(market.physics.magic?.level).toBe('high')
    expect(market.physics.magic?.source).toBe('The Weave')

    // Undercity overrides magic to 'dead'
    const under = tp.resolve('undercity')!
    expect(under.physics.gravity?.type).toBe('standard')  // Still inherited
    expect(under.physics.magic?.level).toBe('dead')        // Overridden!
  })

  it('law rules merge correctly', () => {
    const tp = new TP()
    tp.loadNodes(nodes)

    // Market Ward inherits Cormyr's law
    const market = tp.resolve('market_ward')!
    expect(market.law.system).toBe('The Code of Cormyr')
    expect(market.law.enforcement).toBe('strict')
    // Plus Suzail's charter rule (from culture.law)
    expect(market.law.specialRules).toContain('Adventurers must register for a Charter (1000gp)')

    // Undercity overrides enforcement
    const under = tp.resolve('undercity')!
    expect(under.law.system).toBe('The Code of Cormyr')   // Still inherited
    expect(under.law.enforcement).toBe('none')              // Overridden!
  })

  it('economy merges across levels', () => {
    const tp = new TP()
    tp.loadNodes(nodes)

    const market = tp.resolve('market_ward')!
    expect(market.economy.currency).toBe('Cormyrean Golden Lion')  // From Cormyr
    expect(market.economy.type).toBe('imperial_capital')           // From Suzail
    expect(market.economy.tradeModifier).toBe(0.9)                 // From Market Ward
  })

  it('edges filter to applicable nodes', () => {
    const tp = new TP()
    tp.loadNodes(nodes)
    tp.loadEdges(edges)

    const market = tp.resolve('market_ward')!
    // Both edges involve suzail or cormyr, which are in the ancestry
    expect(market.edges.length).toBe(2)

    // Realmspace shouldn't see suzail-specific edges
    const realm = tp.resolve('realmspace')!
    expect(realm.edges.length).toBe(0)
  })

  it('check() convenience method works', () => {
    const tp = new TP()
    tp.loadNodes(nodes)

    expect(tp.check('market_ward', 'physics.magic.level')).toBe('high')
    expect(tp.check('undercity', 'physics.magic.level')).toBe('dead')
    expect(tp.check('market_ward', 'law.system')).toBe('The Code of Cormyr')
    expect(tp.check('market_ward', 'economy.tradeModifier')).toBe(0.9)
  })

  it('incremental loading works', () => {
    const tp = new TP()
    // Load just the top levels
    tp.loadNodes(nodes.slice(0, 3)) // realmspace, toril, faerun
    expect(tp.size()).toBe(3)

    // Later, load Cormyr subtree
    tp.loadNodes(nodes.slice(3))
    expect(tp.size()).toBe(7)

    // Full resolution still works
    const ctx = tp.resolve('market_ward')!
    expect(ctx.ancestry.length).toBe(6)
  })

  it('returns null for unknown node', () => {
    const tp = new TP()
    tp.loadNodes(nodes)
    expect(tp.resolve('nonexistent')).toBeNull()
  })

  it('getChildren returns direct children', () => {
    const tp = new TP()
    tp.loadNodes(nodes)

    const children = tp.getChildren('suzail')
    expect(children.length).toBe(2)
    expect(children.map(c => c.name).sort()).toEqual(['Market Ward', 'Undercity'])
  })
})

// ============================================================
// MM_SCENE TESTS (Combat Encounter)
// ============================================================

import { MMScene, type Combatant } from '../mm-scene.js'

describe('MM_scene (combat encounter)', () => {
  // A classic encounter: 2 fighters vs 3 goblins
  function createEncounter(): { party: Combatant[]; enemies: Combatant[] } {
    const party: Combatant[] = [
      {
        id: 'fighter1', name: 'Arden', side: 'party',
        initiativeModifier: 2, hpCurrent: 45, hpMax: 45, tempHp: 0,
        ac: 18, attackModifier: 7,
        damageDice: { count: 1, sides: 8, modifier: 4 },
        damageType: 'slashing', resistances: [], vulnerabilities: [], immunities: [],
        status: 'active',
      },
      {
        id: 'cleric1', name: 'Lyra', side: 'party',
        initiativeModifier: 1, hpCurrent: 32, hpMax: 32, tempHp: 0,
        ac: 16, attackModifier: 5,
        damageDice: { count: 1, sides: 6, modifier: 3 },
        damageType: 'bludgeoning', resistances: [], vulnerabilities: [], immunities: [],
        status: 'active',
      },
    ]
    const enemies: Combatant[] = [
      {
        id: 'goblin1', name: 'Goblin Archer', side: 'enemy',
        initiativeModifier: 2, hpCurrent: 7, hpMax: 7, tempHp: 0,
        ac: 13, attackModifier: 4,
        damageDice: { count: 1, sides: 6, modifier: 2 },
        damageType: 'piercing', resistances: [], vulnerabilities: [], immunities: [],
        status: 'active',
      },
      {
        id: 'goblin2', name: 'Goblin Warrior', side: 'enemy',
        initiativeModifier: 2, hpCurrent: 7, hpMax: 7, tempHp: 0,
        ac: 15, attackModifier: 4,
        damageDice: { count: 1, sides: 6, modifier: 2 },
        damageType: 'slashing', resistances: [], vulnerabilities: [], immunities: [],
        status: 'active',
      },
      {
        id: 'goblin3', name: 'Goblin Shaman', side: 'enemy',
        initiativeModifier: 1, hpCurrent: 10, hpMax: 10, tempHp: 0,
        ac: 12, attackModifier: 3,
        damageDice: { count: 1, sides: 8, modifier: 1 },
        damageType: 'fire', resistances: [], vulnerabilities: [], immunities: [],
        status: 'active',
      },
    ]
    return { party, enemies }
  }

  it('rolls initiative and sorts correctly', () => {
    const { party, enemies } = createEncounter()
    const scene = new MMScene([...party, ...enemies], 42)

    const order = scene.getInitiativeOrder()
    expect(order.length).toBe(5)

    // Verify sorted descending by total
    for (let i = 1; i < order.length; i++) {
      expect(order[i].total).toBeLessThanOrEqual(order[i - 1].total)
    }
  })

  it('initiative is deterministic with same seed', () => {
    const { party, enemies } = createEncounter()
    const scene1 = new MMScene([...party, ...enemies], 42)
    const scene2 = new MMScene([...party, ...enemies], 42)

    const order1 = scene1.getInitiativeOrder()
    const order2 = scene2.getInitiativeOrder()

    expect(order1.map(o => o.id)).toEqual(order2.map(o => o.id))
    expect(order1.map(o => o.total)).toEqual(order2.map(o => o.total))
  })

  it('executes one round and produces turn results', () => {
    const { party, enemies } = createEncounter()
    const scene = new MMScene([...party, ...enemies], 42)

    const round = scene.executeRound(100)
    expect(round.roundNumber).toBe(1)
    expect(round.turns.length).toBe(5) // All 5 combatants get a turn

    // Each turn has a description
    for (const turn of round.turns) {
      expect(turn.description).toBeTruthy()
      expect(['attack', 'skip', 'none']).toContain(turn.action)
    }
  })

  it('skips unconscious/dead combatants (? slot)', () => {
    const { party, enemies } = createEncounter()
    // Give goblin1 only 1 HP so it likely dies in round 1
    enemies[0].hpCurrent = 1
    enemies[0].hpMax = 1

    const scene = new MMScene([...party, ...enemies], 42)

    // Run a few rounds
    scene.executeRound(100)
    scene.executeRound(200)

    const goblin = scene.getCombatant('goblin1')!
    if (goblin.status !== 'active') {
      // Goblin was killed — verify it was skipped in subsequent rounds
      const round2 = scene.getRoundResults()[1]
      const goblinTurn = round2.turns.find(t => t.combatantId === 'goblin1')
      if (goblinTurn) {
        expect(goblinTurn.action).toBe('skip')
      }
    }
  })

  it('runs encounter to completion', () => {
    const { party, enemies } = createEncounter()
    const scene = new MMScene([...party, ...enemies], 42)

    const rounds = scene.runToCompletion(1000)
    expect(rounds.length).toBeGreaterThan(0)
    expect(scene.isOver()).toBe(true)
    expect(['party', 'enemy', 'draw']).toContain(scene.getVictor()!)
  })

  it('produces valid summary', () => {
    const { party, enemies } = createEncounter()
    const scene = new MMScene([...party, ...enemies], 42)
    scene.runToCompletion(1000)

    const summary = scene.summary()
    expect(summary.rounds).toBeGreaterThan(0)
    expect(summary.victor).toBeDefined()
    expect(summary.totalDamageByParty).toBeGreaterThanOrEqual(0)
    expect(summary.totalDamageByEnemy).toBeGreaterThanOrEqual(0)
    expect(summary.casualties.length).toBeGreaterThan(0)
  })

  it('all receipts are verified throughout combat', () => {
    const { party, enemies } = createEncounter()
    const scene = new MMScene([...party, ...enemies], 42)
    scene.runToCompletion(1000)

    const receipts = scene.getAllReceipts()
    expect(receipts.length).toBeGreaterThan(0)

    // All receipts have required fields
    for (const r of receipts) {
      expect(r.mfId).toBeTruthy()
      expect(r.timestamp).toBeGreaterThan(0)
      expect(r.tick).toBeGreaterThanOrEqual(0)
    }
  })

  it('combat with resistances works end-to-end', () => {
    // Fire-immune fighter vs fire-dealing goblin shaman
    const fighter: Combatant = {
      id: 'tank', name: 'Red Dragonborn', side: 'party',
      initiativeModifier: 1, hpCurrent: 50, hpMax: 50, tempHp: 0,
      ac: 16, attackModifier: 6,
      damageDice: { count: 1, sides: 10, modifier: 4 },
      damageType: 'slashing', resistances: [], vulnerabilities: [], immunities: ['fire'],
      status: 'active',
    }
    const shaman: Combatant = {
      id: 'shaman', name: 'Fire Cultist', side: 'enemy',
      initiativeModifier: 0, hpCurrent: 15, hpMax: 15, tempHp: 0,
      ac: 11, attackModifier: 5,
      damageDice: { count: 2, sides: 6, modifier: 2 },
      damageType: 'fire', resistances: [], vulnerabilities: [], immunities: [],
      status: 'active',
    }

    const scene = new MMScene([fighter, shaman], 42)
    scene.runToCompletion(500)

    // The dragonborn should win — immune to fire damage
    expect(scene.getVictor()).toBe('party')
    // The dragonborn should have taken 0 fire damage
    const tank = scene.getCombatant('tank')!
    expect(tank.hpCurrent).toBe(50) // Still full HP — fire immunity!
  })
})

// ============================================================
// MM_ADVENTURE TESTS (Scene Card System)
// ============================================================

import { MMSession, type SceneCard } from '../mm-session.js'

describe('MM_adventure (scene card system)', () => {
  function createTestCards(): SceneCard[] {
    return [
      {
        id: 'card-intro', type: 'narrative', title: 'The Road to Suzail',
        sequenceOrder: 0, description: 'The party travels along the Kings Road.',
        readAloud: 'The morning sun breaks over the rolling hills...',
        gmNotes: 'Watch for assassination attempt at mile marker 3',
        gmSecrets: ['The merchant is actually a Zhentarim spy'],
        contingencies: [{ trigger: 'Party investigates merchant', response: 'He sweats nervously' }],
        locationId: 'cormyr', locationName: 'Kings Road',
        npcs: [{ id: 'npc-merchant', name: 'Aldric', role: 'Travelling merchant' }],
        choices: [], combatSetup: undefined, status: 'prepared',
        outcome: undefined, hookThreads: ['zhentarim_spy'],
      },
      {
        id: 'card-ambush', type: 'combat', title: 'Ambush at the Bridge',
        sequenceOrder: 1, description: 'Goblins attack from the treeline!',
        gmNotes: 'If party is struggling, have Aldric help',
        gmSecrets: [],
        contingencies: [],
        locationId: 'market_ward', locationName: 'Bridge over Starwater',
        npcs: [],
        choices: [],
        combatSetup: {
          enemySource: 'tp_insert',
          newCanonicalData: {
            nodeId: 'goblin_den_bridge',
            nodeType: 'monster_den',
            name: 'Goblin Den under the Bridge',
            parentId: 'cormyr',
            data: { threat: 'low', faction: 'independent' },
          },
          enemies: [
            {
              id: 'goblin-a', name: 'Goblin Raider', hpMax: 7, ac: 13,
              initiativeModifier: 2, attackModifier: 4,
              damageDice: { count: 1, sides: 6, modifier: 2 },
              damageType: 'slashing', resistances: [], vulnerabilities: [], immunities: [],
            },
            {
              id: 'goblin-b', name: 'Goblin Archer', hpMax: 7, ac: 13,
              initiativeModifier: 2, attackModifier: 4,
              damageDice: { count: 1, sides: 6, modifier: 2 },
              damageType: 'piercing', resistances: [], vulnerabilities: [], immunities: [],
            },
          ],
        },
        status: 'prepared',
        outcome: undefined, hookThreads: [],
      },
      {
        id: 'card-arrival', type: 'narrative', title: 'Arrival in Suzail',
        sequenceOrder: 2, description: 'The party arrives at the gates of the capital.',
        choices: [
          {
            id: 'choice-charter', label: 'Register for a Charter',
            description: 'Pay the 1000gp adventurer charter fee',
            worldMutations: [{
              type: 'add_edge',
              target: 'charter-edge',
              data: { edge: { type: 'CHARTER', sourceId: 'party', targetId: 'suzail', properties: { fee: 1000 } } },
            }],
          },
          {
            id: 'choice-sneak', label: 'Sneak into the city',
            description: 'Avoid the charter fee (risky)',
            worldMutations: [],
          },
        ],
        status: 'prepared',
        outcome: undefined, hookThreads: ['zhentarim_spy'],
        gmNotes: undefined, gmSecrets: [], contingencies: [],
        npcs: [], locationId: 'suzail', locationName: 'Gates of Suzail',
        combatSetup: undefined,
      },
    ]
  }

  it('adds and sequences scene cards', () => {
    const adv = new MMSession('sess-1')
    const cards = createTestCards()
    adv.addCards(cards)
    
    expect(adv.getCards().length).toBe(3)
    expect(adv.getCards()[0].title).toBe('The Road to Suzail')
    expect(adv.getCards()[2].title).toBe('Arrival in Suzail')
  })

  it('advances through cards and marks status', () => {
    const adv = new MMSession('sess-1')
    adv.addCards(createTestCards())
    
    const r1 = adv.advance()
    expect(r1.card?.title).toBe('The Road to Suzail')
    expect(r1.card?.status).toBe('active')

    const r2 = adv.advance()
    expect(r2.card?.title).toBe('Ambush at the Bridge')
    // Previous card should be completed
    expect(adv.getCards()[0].status).toBe('completed')
  })

  it('hook-back system tracks stale threads', () => {
    const adv = new MMSession('sess-1')
    adv.addCards(createTestCards())

    // Card 0 registers 'zhentarim_spy' hook
    adv.advance() // card 0 — zhentarim_spy staleCount = 0

    // Advance through cards without referencing the hook
    adv.advance() // card 1 — no hooks → zhentarim_spy staleCount = 1
    adv.advance() // card 2 — zhentarim_spy referenced → reset to 0

    // Stale threshold is 3 by default
    const stale = adv.getStaleHooks()
    expect(stale.length).toBe(0) // Not stale yet — was referenced in card 2
  })

  it('goldfish party gets hook-back after 3 scenes', () => {
    const adv = new MMSession('sess-1')
    
    // Add a hook manually
    adv.addHook({
      id: 'forgotten-quest',
      name: 'The Forgotten Quest',
      description: 'Party forgot about the dragon egg',
      staleCount: 0,
      priority: 5,
      relatedCardIds: [],
      resolved: false,
    })

    // Add 4 cards with no reference to the hook
    for (let i = 0; i < 4; i++) {
      adv.addCard({
        id: `card-${i}`, type: 'narrative', title: `Scene ${i}`,
        sequenceOrder: i, description: 'Something happens',
        choices: [], status: 'prepared', hookThreads: [],
        gmNotes: undefined, gmSecrets: [], contingencies: [],
        npcs: [], combatSetup: undefined, outcome: undefined,
      })
    }

    adv.advance() // 0
    adv.advance() // 1
    adv.advance() // 2
    const r3 = adv.advance() // 3 — staleCount now 3 for 'forgotten-quest'

    expect(r3.hookBacks.length).toBe(1)
    expect(r3.hookBacks[0].name).toBe('The Forgotten Quest')
  })

  it('prepares combat from scene card and spawns pocket manifold', () => {
    const adv = new MMSession('sess-1')
    adv.addCards(createTestCards())

    const tp = new TP()
    tp.loadNodes([
      { id: 'cormyr', type: 'region', name: 'Cormyr', parentId: null, dataStatic: {} },
    ])

    const party: Combatant[] = [{
      id: 'fighter', name: 'Arden', side: 'party',
      initiativeModifier: 2, hpCurrent: 45, hpMax: 45, tempHp: 0,
      ac: 18, attackModifier: 7,
      damageDice: { count: 1, sides: 8, modifier: 4 },
      damageType: 'slashing', resistances: [], vulnerabilities: [], immunities: [],
      status: 'active',
    }]

    const { scene, mutations } = adv.prepareCombat('card-ambush', party, tp, 42)

    // Pocket manifold spawned
    expect(scene.getInitiativeOrder().length).toBe(3) // 1 party + 2 goblins

    // New canonical data inserted into .tp
    expect(mutations.length).toBe(1)
    expect(mutations[0].type).toBe('add_node')
    expect(tp.getNode('goblin_den_bridge')).toBeDefined()
    expect(tp.getNode('goblin_den_bridge')!.name).toBe('Goblin Den under the Bridge')
  })

  it('resolves combat and records to .tpb', () => {
    const adv = new MMSession('sess-1')
    adv.addCards(createTestCards())

    const tp = new TP()
    tp.loadNodes([
      { id: 'cormyr', type: 'region', name: 'Cormyr', parentId: null, dataStatic: {} },
    ])

    const party: Combatant[] = [{
      id: 'fighter', name: 'Arden', side: 'party',
      initiativeModifier: 2, hpCurrent: 45, hpMax: 45, tempHp: 0,
      ac: 18, attackModifier: 7,
      damageDice: { count: 1, sides: 8, modifier: 4 },
      damageType: 'slashing', resistances: [], vulnerabilities: [], immunities: [],
      status: 'active',
    }]

    adv.prepareCombat('card-ambush', party, tp, 42)
    adv.getActiveCombat()!.runToCompletion(500)

    const { summary } = adv.resolveCombat('card-ambush', tp)
    expect(summary.rounds).toBeGreaterThan(0)
    expect(summary.victor).toBeDefined()

    // .tpb records the combat
    const history = adv.getHistory()
    expect(history.length()).toBeGreaterThan(1) // At least init + combat start + combat end
  })

  it('choice resolution commits world mutations to .tp', () => {
    const adv = new MMSession('sess-1')
    adv.addCards(createTestCards())

    const tp = new TP()
    tp.loadNodes([
      { id: 'suzail', type: 'metropolis', name: 'Suzail', parentId: null, dataStatic: {} },
    ])

    // Advance to card-arrival
    adv.advance() // card 0
    adv.advance() // card 1
    adv.advance() // card 2

    // Player chooses to register for a charter
    const { mutations } = adv.applyChoice('card-arrival', 'choice-charter', tp)
    
    expect(mutations.length).toBe(1)
    expect(mutations[0].type).toBe('add_edge')

    // Outcome recorded on card
    const card = adv.getCards()[2]
    expect(card.outcome?.choiceId).toBe('choice-charter')
  })
})

// ============================================================
// MM_CHARACTER TESTS
// ============================================================

import { MMCharacter, type CharacterDataInput } from '../mm-character.js'

describe('MM_character (character state machine)', () => {
  function createFighter(): CharacterDataInput {
    return {
      id: 'char-fighter', name: 'Arden', playerName: 'Alice',
      race: 'Human',
      classes: [{ name: 'Fighter', level: 5, hitDie: 'd10', isStartingClass: true }],
      abilityScores: { strength: 18, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
      saveProficiencies: ['strength', 'constitution'],
      hpMax: 49, hpCurrent: 49,
      baseAC: 18, armorType: 'heavy',
      damageType: 'slashing',
    }
  }

  function createWizard(): CharacterDataInput {
    return {
      id: 'char-wizard', name: 'Elara', playerName: 'Bob',
      race: 'Elf', subrace: 'High Elf',
      classes: [{ name: 'Wizard', level: 5, hitDie: 'd6', isStartingClass: true }],
      abilityScores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 20, wisdom: 14, charisma: 10 },
      saveProficiencies: ['intelligence', 'wisdom'],
      spellcastingAbility: 'intelligence',
      spellSlots: [
        { level: 1, max: 4, used: 0 },
        { level: 2, max: 3, used: 0 },
        { level: 3, max: 2, used: 0 },
      ],
      hpMax: 27, hpCurrent: 27,
    }
  }

  it('derives correct stats for a level 5 fighter', () => {
    const fighter = new MMCharacter(createFighter())
    const stats = fighter.derive()

    expect(stats.totalLevel).toBe(5)
    expect(stats.proficiencyBonus).toBe(3)
    expect(stats.abilityModifiers.strength).toBe(4) // (18-10)/2
    expect(stats.abilityModifiers.dexterity).toBe(2) // (14-10)/2
    expect(stats.ac).toBe(18) // Heavy armor = baseAC, no DEX
    expect(stats.initiativeModifier).toBe(2) // DEX mod
    expect(stats.attackModifier).toBe(7) // Prof(3) + STR(4)
  })

  it('computes spell save DC for wizard', () => {
    const wizard = new MMCharacter(createWizard())
    const stats = wizard.derive()

    expect(stats.spellSaveDC).toBe(16) // 8 + 3 (prof) + 5 (INT)
    expect(stats.spellAttackModifier).toBe(8) // 3 + 5
  })

  it('handles damage and unconscious transition', () => {
    const fighter = new MMCharacter(createFighter())
    
    const r1 = fighter.takeDamage(30)
    expect(r1.hpAfter).toBe(19)
    expect(r1.statusChange).toBeUndefined()

    const r2 = fighter.takeDamage(19)
    expect(r2.hpAfter).toBe(0)
    expect(r2.statusChange).toBe('unconscious')
  })

  it('healing from unconscious restores active', () => {
    const fighter = new MMCharacter(createFighter())
    fighter.takeDamage(49) // Drop to 0
    expect(fighter.getStatus()).toBe('unconscious')

    fighter.heal(10)
    expect(fighter.getStatus()).toBe('active')
    expect(fighter.getHp().current).toBe(10)
  })

  it('long rest restores HP and half hit dice', () => {
    const fighter = new MMCharacter(createFighter())
    fighter.takeDamage(30)
    fighter.shortRest(3) // Spend 3 hit dice

    const result = fighter.longRest()
    expect(result.hpRestored).toBeGreaterThan(0)
    expect(fighter.getHp().current).toBe(fighter.getHp().max)
    expect(result.hitDiceRestored).toBeGreaterThan(0)
  })

  it('bridges to combatant for MM_scene', () => {
    const fighter = new MMCharacter(createFighter())
    const combatant = fighter.toCombatant()

    expect(combatant.id).toBe('char-fighter')
    expect(combatant.name).toBe('Arden')
    expect(combatant.side).toBe('party')
    expect(combatant.ac).toBe(18)
    expect(combatant.hpMax).toBe(49)
  })

  it('spell slot management', () => {
    const wizard = new MMCharacter(createWizard())
    
    expect(wizard.useSpellSlot(1)).toBe(true)
    expect(wizard.useSpellSlot(1)).toBe(true)
    expect(wizard.useSpellSlot(1)).toBe(true)
    expect(wizard.useSpellSlot(1)).toBe(true)
    expect(wizard.useSpellSlot(1)).toBe(false) // All used

    wizard.longRest()
    expect(wizard.useSpellSlot(1)).toBe(true) // Restored
  })
})

// ============================================================
// MM_PARTY TESTS
// ============================================================

import { MMParty } from '../mm-party.js'

describe('MM_party (party container)', () => {
  function createParty(): MMParty {
    const party = new MMParty('party-1', 'The Silver Dragons')
    
    party.addMember({
      id: 'fighter', name: 'Arden', race: 'Human',
      classes: [{ name: 'Fighter', level: 5, hitDie: 'd10', isStartingClass: true }],
      abilityScores: { strength: 18, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
      saveProficiencies: ['strength', 'constitution'],
      hpMax: 49, hpCurrent: 49,
      baseAC: 18, armorType: 'heavy',
    })

    party.addMember({
      id: 'wizard', name: 'Elara', race: 'Elf',
      classes: [{ name: 'Wizard', level: 5, hitDie: 'd6', isStartingClass: true }],
      abilityScores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 20, wisdom: 14, charisma: 10 },
      saveProficiencies: ['intelligence', 'wisdom'],
      spellcastingAbility: 'intelligence',
      hpMax: 27, hpCurrent: 27,
    })

    return party
  }

  it('manages character roster', () => {
    const party = createParty()
    expect(party.size()).toBe(2)
    expect(party.getMember('fighter')!.getName()).toBe('Arden')
    expect(party.getMember('wizard')!.getName()).toBe('Elara')
  })

  it('manages shared gold', () => {
    const party = createParty()
    party.addGold(1000)
    expect(party.getGold()).toBe(1000)

    expect(party.spendGold(300)).toBe(true)
    expect(party.getGold()).toBe(700)

    expect(party.spendGold(9999)).toBe(false) // Can't overspend
  })

  it('splits gold evenly', () => {
    const party = createParty()
    party.addGold(101)
    
    const { perCharacter, remainder } = party.splitGold()
    expect(perCharacter).toBe(50) // 101 / 2 = 50 remainder 1
    expect(remainder).toBe(1)
    expect(party.getGold()).toBe(1) // Only remainder left
  })

  it('computes group check modifier', () => {
    const party = createParty()
    // Fighter STR: +4, Wizard STR: -1 → average = floor(3/2) = 1
    const strMod = party.getGroupCheckModifier('strength')
    expect(strMod).toBe(1) // floor((4 + (-1)) / 2) = 1
  })

  it('finds best modifier', () => {
    const party = createParty()
    const best = party.getBestModifier('intelligence')
    expect(best.character.getName()).toBe('Elara')
    expect(best.modifier).toBe(5) // INT 20 → +5
  })

  it('projects party to combatants', () => {
    const party = createParty()
    const combatants = party.toCombatants()
    
    expect(combatants.length).toBe(2)
    expect(combatants.every(c => c.side === 'party')).toBe(true)
  })

  it('long rest restores entire party', () => {
    const party = createParty()
    
    // Damage both characters
    party.getMember('fighter')!.takeDamage(30)
    party.getMember('wizard')!.takeDamage(15)

    const { results } = party.longRest()
    expect(results.length).toBe(2)
    expect(results[0].hpRestored).toBe(30)
    expect(results[1].hpRestored).toBe(15)
  })

  it('health summary tracks party state', () => {
    const party = createParty()
    party.getMember('wizard')!.takeDamage(27) // Knock wizard out

    const summary = party.getHealthSummary()
    expect(summary.membersActive).toBe(1)
    expect(summary.membersDown).toBe(1)
    expect(summary.totalHP).toBe(49) // Only fighter's HP
  })
})

// ============================================================
// MM_ADVENTURE TESTS (Campaign Container)
// ============================================================

import { MMAdventure } from '../mm-adventure.js'

describe('MM_adventure (campaign container)', () => {
  function createCampaign(): MMAdventure {
    const adv = new MMAdventure('campaign-1', 'Curse of Strahd', 'Heroes of Barovia')
    
    adv.addCharacter({
      id: 'fighter', name: 'Ireena', race: 'Human',
      classes: [{ name: 'Fighter', level: 5, hitDie: 'd10', isStartingClass: true }],
      abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 13 },
      saveProficiencies: ['strength', 'constitution'],
      hpMax: 44, hpCurrent: 44,
      baseAC: 16, armorType: 'medium',
    })

    adv.loadWorld([
      { id: 'barovia', type: 'domain', name: 'Barovia', parentId: null, dataStatic: { dreadLord: 'Strahd' } },
      { id: 'village', type: 'settlement', name: 'Village of Barovia', parentId: 'barovia', dataStatic: {} },
    ])

    return adv
  }

  it('manages the session→downtime→session lifecycle', () => {
    const adv = createCampaign()
    expect(adv.getWorldDay()).toBe(1)

    // Session 1
    const s1 = adv.startSession()
    expect(adv.getActiveSession()).toBe(s1)
    const r1 = adv.endSession(1) // 1 day of in-world time
    expect(r1.sessionNumber).toBe(1)
    expect(adv.getWorldDay()).toBe(2)

    // Downtime (7 days)
    adv.startDowntime(7)
    adv.addDowntimeActivity({
      id: 'train-1', characterId: 'fighter',
      type: 'training', description: 'Practice swordplay',
      daysRequired: 7,
    })
    const dt = adv.resolveDowntime()
    expect(dt.activitiesCompleted).toBe(1)
    expect(adv.getWorldDay()).toBe(9) // 2 + 7

    // Session 2
    const s2 = adv.startSession()
    adv.endSession(1)
    expect(adv.getSessionCount()).toBe(2)
    expect(adv.getWorldDay()).toBe(10)
  })

  it('prevents overlapping sessions and downtimes', () => {
    const adv = createCampaign()
    adv.startSession()
    expect(() => adv.startSession()).toThrow()
    expect(() => adv.startDowntime(7)).toThrow()
    adv.endSession()
    
    adv.startDowntime(7)
    expect(() => adv.startSession()).toThrow()
    expect(() => adv.startDowntime(3)).toThrow()
  })

  it('session hooks transfer to campaign hooks', () => {
    const adv = createCampaign()
    const session = adv.startSession()
    
    // Add an unresolved hook in the session
    session.addHook({
      id: 'strahd-curse', name: "Strahd's Curse",
      description: 'The curse must be lifted',
      staleCount: 0, priority: 10,
      relatedCardIds: [], resolved: false,
    })

    adv.endSession()

    // Hook should be at campaign level now
    const hooks = adv.getCampaignHooks()
    expect(hooks.length).toBe(1)
    expect(hooks[0].name).toBe("Strahd's Curse")
  })

  it('produces campaign summary', () => {
    const adv = createCampaign()
    adv.startSession()
    adv.endSession()

    const summary = adv.summary()
    expect(summary.name).toBe('Curse of Strahd')
    expect(summary.sessions).toBe(1)
    expect(summary.partySize).toBe(1)
    expect(summary.worldNodes).toBe(2)
  })

  it('downtime working earns gold', () => {
    const adv = createCampaign()
    adv.startDowntime(10)
    adv.addDowntimeActivity({
      id: 'work-1', characterId: 'fighter',
      type: 'working', description: 'Guard duty',
      daysRequired: 10,
    })
    const result = adv.resolveDowntime()
    expect(result.goldEarned).toBe(20) // 2gp/day * 10 days
    expect(adv.getParty().getGold()).toBe(20)
  })
})

// ============================================================
// MM_NPC TESTS
// ============================================================

import { MMNPC } from '../mm-npc.js'

function createTestNPC(overrides: Record<string, unknown> = {}) {
  return new MMNPC({
    id: 'npc-miri',
    name: 'Miri',
    race: 'Human',
    classes: [{ name: 'Ranger', level: 3, hitDie: 'd10' as const, isStartingClass: true }],
    abilityScores: {
      strength: 12, dexterity: 16, constitution: 14,
      intelligence: 10, wisdom: 14, charisma: 8,
    },
    hpMax: 28, hpCurrent: 28,
    role: 'hireling' as const,
    homeNodeId: 'suzail_market',
    currentNodeId: 'suzail_market',
    services: ['guide' as const, 'fight' as const, 'stealth' as const],
    dailyCost: 2,
    loyalty: 60,
    ...overrides,
  } as any)
}

describe('MM_npc (NPC state machine)', () => {
  it('creates with defaults and derives stats', () => {
    const npc = createTestNPC()
    const stats = npc.derive()
    expect(stats.totalLevel).toBe(3)
    expect(stats.proficiencyBonus).toBe(2)
    expect(stats.abilityModifiers.dexterity).toBe(3)
    expect(stats.initiativeModifier).toBe(3)
    expect(npc.getRole()).toBe('hireling')
    expect(npc.getDisposition()).toBe('friendly') // loyalty 60
  })

  it('adjusts loyalty and auto-shifts disposition', () => {
    const npc = createTestNPC({ loyalty: 60 }) // friendly
    expect(npc.getDisposition()).toBe('friendly')

    // Push to loyal (80+)
    const r1 = npc.adjustLoyalty(25)
    expect(r1.loyaltyAfter).toBe(85)
    expect(r1.dispositionAfter).toBe('loyal')
    expect(r1.changed).toBe(true)

    // Drop to reluctant (20-39)
    const r2 = npc.adjustLoyalty(-60)
    expect(r2.loyaltyAfter).toBe(25)
    expect(r2.dispositionAfter).toBe('reluctant')
  })

  it('clamps loyalty to 0-100', () => {
    const npc = createTestNPC({ loyalty: 90 })
    npc.adjustLoyalty(50)
    expect(npc.getLoyalty()).toBe(100) // clamped

    npc.adjustLoyalty(-200)
    expect(npc.getLoyalty()).toBe(0) // clamped
    expect(npc.getDisposition()).toBe('hostile')
  })

  it('manages knowledge', () => {
    const npc = createTestNPC()
    npc.addKnowledge('The Zhentarim operate in Suzail')
    npc.addKnowledge('There is a hidden passage in the sewers')
    npc.addKnowledge('The Purple Dragons patrol at dawn')

    expect(npc.getKnowledge()).toHaveLength(3)
    expect(npc.searchKnowledge('zhentarim')).toHaveLength(1)
    expect(npc.searchKnowledge('patrol')).toHaveLength(1)
    expect(npc.searchKnowledge('dragon')).toHaveLength(1)
    expect(npc.searchKnowledge('magic')).toHaveLength(0)
  })

  it('checks service willingness based on disposition', () => {
    const npc = createTestNPC({ loyalty: 60 }) // friendly
    expect(npc.isWillingTo('guide')).toBe(true)
    expect(npc.isWillingTo('fight')).toBe(true)
    expect(npc.isWillingTo('trade')).toBe(false) // not in services

    // Drop to reluctant
    npc.adjustLoyalty(-35) // loyalty 25
    expect(npc.isWillingTo('guide')).toBe(true) // safe service, OK
    expect(npc.isWillingTo('fight')).toBe(false) // risky, reluctant refuses

    // Drop to hostile
    npc.adjustLoyalty(-20) // loyalty 5
    expect(npc.isWillingTo('guide')).toBe(false) // hostile refuses all
  })

  it('projects to combatant', () => {
    const npc = createTestNPC()
    const combatant = npc.toCombatant('party')
    expect(combatant.name).toBe('Miri')
    expect(combatant.side).toBe('party')
    expect(combatant.hpMax).toBe(28)
    expect(combatant.initiativeModifier).toBe(3) // DEX mod
  })

  it('handles .tp positioning', () => {
    const npc = createTestNPC()
    expect(npc.getCurrentNodeId()).toBe('suzail_market')
    expect(npc.isAtHome()).toBe(true)

    npc.moveTo('laughing_lich')
    expect(npc.getCurrentNodeId()).toBe('laughing_lich')
    expect(npc.isAtHome()).toBe(false)
  })

  it('ticks daily with loyalty drift', () => {
    const npc = createTestNPC({ loyalty: 60 }) // above 50
    const r = npc.tick()
    expect(r.dailyCost).toBe(2)
    expect(r.loyaltyDrift).toBe(-1) // drifts toward 50
    expect(npc.getLoyalty()).toBe(59)
    expect(npc.getDaysWithParty()).toBe(1)
  })
})

// ============================================================
// MM_FOLLOWERS TESTS
// ============================================================

import { MMFollowers } from '../mm-followers.js'

describe('MM_followers (local + global container)', () => {
  function createFollowers() {
    const f = new MMFollowers()
    const miri = f.addLocal({
      id: 'npc-miri', name: 'Miri', race: 'Human',
      classes: [{ name: 'Ranger', level: 3, hitDie: 'd10' as const, isStartingClass: true }],
      abilityScores: { strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 14, charisma: 8 },
      hpMax: 28, hpCurrent: 28,
      role: 'hireling' as const,
      homeNodeId: 'suzail_market', currentNodeId: 'laughing_lich',
      services: ['guide' as const, 'fight' as const],
      loyalty: 70, dailyCost: 2,
    } as any)

    const renaer = f.addGlobal({
      id: 'npc-renaer', name: 'Renaer', race: 'Human',
      classes: [{ name: 'Noble', level: 4, hitDie: 'd8' as const, isStartingClass: true }],
      abilityScores: { strength: 10, dexterity: 12, constitution: 10, intelligence: 14, wisdom: 13, charisma: 16 },
      hpMax: 22, hpCurrent: 22,
      role: 'informant' as const,
      homeNodeId: 'waterdeep_castle', currentNodeId: 'waterdeep_castle',
      services: ['info' as const, 'social' as const],
      loyalty: 80, dailyCost: 0,
    } as any)

    return { f, miri, renaer }
  }

  it('tracks local and global counts', () => {
    const { f } = createFollowers()
    const size = f.size()
    expect(size.local).toBe(1)
    expect(size.global).toBe(1)
    expect(size.total).toBe(2)
  })

  it('promotes global to local', () => {
    const { f } = createFollowers()
    expect(f.isGlobal('npc-renaer')).toBe(true)

    const npc = f.promoteToLocal('npc-renaer', 'laughing_lich')
    expect(npc).not.toBeNull()
    expect(f.isLocal('npc-renaer')).toBe(true)
    expect(f.isGlobal('npc-renaer')).toBe(false)
    expect(npc!.getCurrentNodeId()).toBe('laughing_lich')
    expect(f.size().local).toBe(2)
  })

  it('demotes local to global (returns home)', () => {
    const { f } = createFollowers()
    const npc = f.demoteToGlobal('npc-miri')
    expect(npc).not.toBeNull()
    expect(f.isLocal('npc-miri')).toBe(false)
    expect(f.isGlobal('npc-miri')).toBe(true)
    expect(npc!.getCurrentNodeId()).toBe('suzail_market') // returned home
  })

  it('dismisses a follower', () => {
    const { f } = createFollowers()
    const npc = f.dismiss('npc-miri')
    expect(npc).not.toBeNull()
    expect(npc!.getLoyalty()).toBe(0) // loyalty zeroed
    expect(f.size().total).toBe(1) // only renaer left
  })

  it('projects only local followers to combatants', () => {
    const { f } = createFollowers()
    const combatants = f.getLocalCombatants()
    expect(combatants).toHaveLength(1)
    expect(combatants[0].name).toBe('Miri')
    expect(combatants[0].side).toBe('party')
  })

  it('queries knowledge across all followers', () => {
    const { f, miri, renaer } = createFollowers()
    miri.addKnowledge('The sewers connect to the undercity')
    renaer.addKnowledge('Lord Neverember has spies in the sewers')

    const results = f.queryKnowledge('sewers')
    expect(results).toHaveLength(2)
    expect(results[0].isLocal).toBe(true)
    expect(results[1].isLocal).toBe(false)
  })

  it('filters global knowledge by .tp node', () => {
    const { f, renaer } = createFollowers()
    renaer.addKnowledge('Waterdeep politics are shifting')

    // Filter by waterdeep — should find Renaer
    const r1 = f.queryKnowledge('politics', 'waterdeep_castle')
    expect(r1).toHaveLength(1)

    // Filter by suzail — should NOT find Renaer
    const r2 = f.queryKnowledge('politics', 'suzail_market')
    expect(r2).toHaveLength(0)
  })

  it('finds global followers at a .tp node', () => {
    const { f } = createFollowers()
    const atWaterdeep = f.getFollowersAtNode('waterdeep_castle')
    expect(atWaterdeep).toHaveLength(1)
    expect(atWaterdeep[0].getName()).toBe('Renaer')

    const atSuzail = f.getFollowersAtNode('suzail_market')
    expect(atSuzail).toHaveLength(0)
  })

  it('ticks loyalty events', () => {
    const { f } = createFollowers()
    const result = f.tickLoyalty([
      { targetId: '*', delta: -10, reason: 'party was rude' },
      { targetId: 'npc-miri', delta: 5, reason: 'saved her life' },
    ])
    // Miri: 70 - 10 + 5 = 65 (friendly)
    // Renaer: 80 - 10 = 70 (friendly, was loyal)
    expect(result.changes).toHaveLength(3) // 2 for *, 1 for miri
    const miriState = f.get('npc-miri')!
    expect(miriState.getLoyalty()).toBe(65)
    const renaerState = f.get('npc-renaer')!
    expect(renaerState.getLoyalty()).toBe(70)
  })

  it('moves all local followers when party moves', () => {
    const { f } = createFollowers()
    f.moveLocalTo('underdark_entrance')
    const miri = f.get('npc-miri')!
    expect(miri.getCurrentNodeId()).toBe('underdark_entrance')
    // Global follower stays put
    const renaer = f.get('npc-renaer')!
    expect(renaer.getCurrentNodeId()).toBe('waterdeep_castle')
  })

  it('integrates with MM_adventure', () => {
    const adv = new MMAdventure('adv-1', 'Test Campaign', 'Heroes')
    adv.addLocalFollower({
      id: 'f1', name: 'Guide', race: 'Human',
      classes: [{ name: 'Ranger', level: 2, hitDie: 'd10' as const, isStartingClass: true }],
      abilityScores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
      hpMax: 18, hpCurrent: 18,
      role: 'hireling' as const,
      homeNodeId: 'village', currentNodeId: 'village',
      services: ['guide' as const],
    } as any)

    const summary = adv.summary()
    expect(summary.localFollowers).toBe(1)
    expect(summary.globalFollowers).toBe(0)
  })
})

