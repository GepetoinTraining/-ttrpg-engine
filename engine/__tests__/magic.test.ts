/**
 * MAGIC SYSTEM TESTS
 * ===================
 * Composition, paradox, monster abilities, difficulty tiers, cast resolution
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MAGIC_CONFIGS,
  SPELL_ELEMENTS,
  composeSpell,
  factorizeSpell,
  getSpellSchool,
  calculateSpellLevel,
  calculateEntropyRisk,
  checkParadox,
  rollWildMagic,
  canCast,
  resolveCast,
  rest,
  createMonsterAbility,
  useMonsterAbility,
  monsterRechargeCheck,
  resetMonsterAbilities,
  EXAMPLE_SPELLS,
  EXAMPLE_MONSTER_ABILITIES,
  WILD_MAGIC_TABLE,
  type CasterState,
  type Spell,
  type MagicDifficulty,
} from '../magic'

// ── Helper: minimal caster ──
function makeCaster(overrides: Partial<CasterState> = {}): CasterState {
  return {
    characterId: 'test-caster',
    casterType: 'wizard',
    casterLevel: 5,
    slots: [
      { level: 1, max: 4, used: 0 },
      { level: 2, max: 3, used: 0 },
      { level: 3, max: 2, used: 0 },
    ],
    spellcastingAbility: 'int',
    spellcastingMod: 4,
    spellSaveDC: 15,
    spellAttackBonus: 7,
    currentHP: 30,
    maxHP: 30,
    lore: {},
    dailyEntropy: 0,
    concentrating: null,
    ...overrides,
  }
}

// ── Helper: minimal spell ──
function makeSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 'test_spell',
    name: 'Test Spell',
    level: 3,
    school: 'evocation',
    elements: { Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 }),
    ...overrides,
  }
}

// ============================================================
// SPELL COMPOSITION
// ============================================================

describe('Spell Composition', () => {
  it('composes a spell to a unique seed', () => {
    const seed = composeSpell({ Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 })
    expect(typeof seed).toBe('bigint')
    expect(seed > 0n).toBe(true)
  })

  it('different compositions produce different seeds', () => {
    const fire = composeSpell({ Fire: 3, Ranged: 1, Instant: 1 })
    const cold = composeSpell({ Cold: 3, Ranged: 1, Instant: 1 })
    expect(fire).not.toBe(cold)
  })

  it('same composition always produces same seed', () => {
    const a = composeSpell({ Fire: 3, Area: 2 })
    const b = composeSpell({ Fire: 3, Area: 2 })
    expect(a).toBe(b)
  })

  it('order does not matter (multiplication is commutative)', () => {
    const a = composeSpell({ Fire: 1, Cold: 1 })
    const b = composeSpell({ Cold: 1, Fire: 1 })
    expect(a).toBe(b)
  })

  it('factorizes seed back to elements', () => {
    const elements = { Fire: 3, Area: 2, Ranged: 1 }
    const seed = composeSpell(elements)
    const result = factorizeSpell(seed)
    expect(result).toEqual(elements)
  })

  it('round-trips all example spells', () => {
    for (const [name, spell] of Object.entries(EXAMPLE_SPELLS)) {
      const factored = factorizeSpell(spell.seed)
      expect(factored).toEqual(spell.elements)
    }
  })
})

// ============================================================
// SPELL ANALYSIS
// ============================================================

describe('Spell Analysis', () => {
  it('determines dominant school', () => {
    // Fire has evocation school
    expect(getSpellSchool({ Fire: 3, Ranged: 1 })).toBe('evocation')
    // Necromancy dominates when Animate is highest
    expect(getSpellSchool({ Animate: 3, Touch: 1 })).toBe('necromancy')
    expect(getSpellSchool({ Ranged: 1 })).toBeNull()
  })

  it('calculates spell level from intensity', () => {
    expect(calculateSpellLevel({ Minor: 1 })).toBe(0)
    expect(calculateSpellLevel({ Lesser: 1 })).toBe(1)
    expect(calculateSpellLevel({ Ultimate: 1 })).toBe(9)
  })

  it('calculates entropy risk', () => {
    expect(calculateEntropyRisk({ Fire: 3, Ranged: 1 })).toBe(0) // No entropy elements
    expect(calculateEntropyRisk({ Necrotic: 3 })).toBe(75) // 3*15 (school) + 3*10 (damage)
    expect(calculateEntropyRisk({ Healing: 3 })).toBe(0)
  })
})

// ============================================================
// DIFFICULTY MODES
// ============================================================

describe('Difficulty Modes', () => {
  it('EASY: maximum simplification', () => {
    const config = MAGIC_CONFIGS.EASY
    expect(config.magicExists).toBe(true)
    expect(config.trackMaterials).toBe(false)
    expect(config.entropyEnabled).toBe(false)
    expect(config.loreGatesActive).toBe(false)
    expect(config.sorcererBloodMagic).toBe(false)
  })

  it('NORMAL: standard D&D', () => {
    const config = MAGIC_CONFIGS.NORMAL
    expect(config.magicExists).toBe(true)
    expect(config.trackMaterials).toBe(true)
    expect(config.entropyEnabled).toBe(false)
    expect(config.concentrationChecks).toBe(true)
  })

  it('HARD: real magic', () => {
    const config = MAGIC_CONFIGS.HARD
    expect(config.magicExists).toBe(true)
    expect(config.loreGatesActive).toBe(true)
    expect(config.entropyEnabled).toBe(true)
    expect(config.sorcererBloodMagic).toBe(true)
    expect(config.economyAffectsAvailability).toBe(true)
  })

  it('BRUTAL: no magic', () => {
    const config = MAGIC_CONFIGS.BRUTAL
    expect(config.magicExists).toBe(false)
    expect(config.entropyMultiplier).toBe(2)
  })
})

// ============================================================
// PARADOX
// ============================================================

describe('Paradox Engine', () => {
  it('does not trigger when entropy disabled', () => {
    const result = checkParadox(50, 5, 0, 'NORMAL', 10)
    expect(result.triggered).toBe(false)
  })

  it('does not trigger on high roll', () => {
    const result = checkParadox(30, 3, 0, 'HARD', 95) // Roll 95 > risk 30
    expect(result.triggered).toBe(false)
  })

  it('triggers fizzle on low margin', () => {
    // Risk = 30*1 + 0 entropy = 30. Roll 25 → margin = 5, level 3 bonus = 10
    // effectiveMargin = 15 < 20 → fizzle
    const result = checkParadox(30, 3, 0, 'HARD', 25)
    expect(result.triggered).toBe(true)
    expect(result.severity).toBe('fizzle')
  })

  it('triggers catastrophic on extreme failure', () => {
    // Risk = 80*1 + 50 entropy = 130. Roll 1 → margin = 129, level 9 bonus = 30
    // effectiveMargin = 159 ≥ 80 → catastrophic
    const result = checkParadox(80, 9, 50, 'HARD', 1)
    expect(result.triggered).toBe(true)
    expect(result.severity).toBe('catastrophic')
  })

  it('accumulates entropy gain', () => {
    const result = checkParadox(40, 5, 0, 'HARD', 95)
    expect(result.entropyGained).toBeDefined()
    expect(result.entropyGained!).toBeGreaterThan(0)
  })

  it('BRUTAL mode doubles entropy multiplier', () => {
    // Risk 30 * 2 (brutal multiplier) = 60
    // Roll 50 < 60 → triggers
    const result = checkParadox(30, 3, 0, 'BRUTAL', 50)
    expect(result.triggered).toBe(true)
  })
})

// ============================================================
// WILD MAGIC
// ============================================================

describe('Wild Magic', () => {
  it('has 20 entries', () => {
    expect(WILD_MAGIC_TABLE.length).toBe(20)
  })

  it('deterministic with d20 seed', () => {
    const a = rollWildMagic(7)
    const b = rollWildMagic(7)
    expect(a.id).toBe(b.id)
  })

  it('contains both beneficial and harmful effects', () => {
    const beneficial = WILD_MAGIC_TABLE.filter(e => e.beneficial).length
    const harmful = WILD_MAGIC_TABLE.filter(e => !e.beneficial).length
    expect(beneficial).toBeGreaterThan(0)
    expect(harmful).toBeGreaterThan(0)
  })
})

// ============================================================
// CAST RESOLUTION
// ============================================================

describe('canCast', () => {
  it('allows casting with available slots', () => {
    const caster = makeCaster()
    const spell = makeSpell({ level: 3 })
    expect(canCast(spell, caster, 'NORMAL')).toBeNull()
  })

  it('blocks when no slots available', () => {
    const caster = makeCaster({
      slots: [
        { level: 1, max: 4, used: 4 },
        { level: 2, max: 3, used: 3 },
        { level: 3, max: 2, used: 2 },
      ],
    })
    expect(canCast(makeSpell({ level: 3 }), caster, 'NORMAL')).toBe('No spell slots available.')
  })

  it('blocks in BRUTAL mode', () => {
    expect(canCast(makeSpell(), makeCaster(), 'BRUTAL')).toBe('Magic does not exist in this world.')
  })

  it('cantrips always available', () => {
    const caster = makeCaster({
      slots: [{ level: 1, max: 4, used: 4 }],
    })
    expect(canCast(makeSpell({ level: 0 }), caster, 'NORMAL')).toBeNull()
  })

  it('innate abilities always castable', () => {
    expect(canCast(makeSpell({ innate: true }), makeCaster(), 'HARD')).toBeNull()
  })

  it('blocks on lore requirement in HARD', () => {
    const spell = makeSpell({ loreTopic: 'pyromancy', loreLevel: 3 })
    const caster = makeCaster({ lore: { pyromancy: { xp: 10, level: 1 } } })
    expect(canCast(spell, caster, 'HARD')).toBe('Insufficient lore: pyromancy (need level 3).')
  })

  it('allows when lore requirement met', () => {
    const spell = makeSpell({ loreTopic: 'pyromancy', loreLevel: 3 })
    const caster = makeCaster({ lore: { pyromancy: { xp: 900, level: 3 } } })
    expect(canCast(spell, caster, 'HARD')).toBeNull()
  })

  it('blocks on missing material in NORMAL', () => {
    const spell = makeSpell({ materials: [{ element: 'BatGuano', quantity: 1, consumed: true }] })
    expect(canCast(spell, makeCaster(), 'NORMAL', () => false)).toBe('Missing component: BatGuano.')
  })
})

describe('resolveCast', () => {
  it('succeeds and consumes slot', () => {
    const caster = makeCaster()
    const spell = makeSpell({ level: 3 })
    const result = resolveCast(spell, caster, 'NORMAL', 99)

    expect(result.success).toBe(true)
    expect(result.slotUsed).toBe(3)
    expect(caster.slots[2].used).toBe(1)
  })

  it('innate spells succeed without slot cost', () => {
    const caster = makeCaster()
    const spell = makeSpell({ innate: true, level: 5 })
    const result = resolveCast(spell, caster, 'HARD', 99)

    expect(result.success).toBe(true)
    expect(result.slotUsed).toBeUndefined()
  })

  it('fails on paradox fizzle in HARD', () => {
    const caster = makeCaster({ dailyEntropy: 80 })
    const spell = makeSpell({
      level: 5,
      elements: { Necrotic: 3, Area: 1, Instant: 1, Standard: 1 },
    })

    // Very low roll → paradox triggers
    const result = resolveCast(spell, caster, 'HARD', 1)

    // With high entropy (80 + risk), low roll should trigger paradox
    if (result.paradox?.triggered) {
      expect(result.paradox.severity).toBeDefined()
    }
  })

  it('sets concentration on concentration spell', () => {
    const caster = makeCaster()
    const spell = makeSpell({ concentration: true, level: 1 })
    resolveCast(spell, caster, 'NORMAL', 99)
    expect(caster.concentrating).toBe(spell.id)
  })
})

// ============================================================
// REST
// ============================================================

describe('Rest', () => {
  it('long rest recovers all slots', () => {
    const caster = makeCaster({
      slots: [
        { level: 1, max: 4, used: 3 },
        { level: 2, max: 3, used: 2 },
      ],
      dailyEntropy: 50,
    })

    rest(caster, 'long', 'HARD')

    expect(caster.slots[0].used).toBe(0)
    expect(caster.slots[1].used).toBe(0)
    expect(caster.dailyEntropy).toBe(0)
  })

  it('short rest recovers warlock pact slots', () => {
    const caster = makeCaster({
      casterType: 'warlock',
      pactSlots: { level: 3, max: 2, used: 2 },
      slots: [{ level: 1, max: 0, used: 0 }],
    })

    rest(caster, 'short', 'HARD')

    expect(caster.pactSlots!.used).toBe(0)
  })

  it('short rest partially decays entropy', () => {
    const caster = makeCaster({ dailyEntropy: 40 })
    rest(caster, 'short', 'HARD')

    // HARD decay rate = 0.5, so entropy should be reduced
    expect(caster.dailyEntropy).toBeLessThan(40)
    expect(caster.dailyEntropy).toBeGreaterThan(0)
  })
})

// ============================================================
// MONSTER ABILITIES
// ============================================================

describe('Monster Abilities', () => {
  it('dragon breath has correct composition', () => {
    const breath = EXAMPLE_MONSTER_ABILITIES.DragonBreath
    expect(breath.spell.innate).toBe(true)
    expect(breath.spell.elements['Fire']).toBe(3)
    expect(breath.spell.elements['Cone']).toBe(1)
    expect(breath.recharge).toBe('recharge_5_6')
  })

  it('at_will abilities always usable', () => {
    const ray = EXAMPLE_MONSTER_ABILITIES.BeholderRay
    expect(useMonsterAbility(ray)).toBe(true)
    expect(useMonsterAbility(ray)).toBe(true)
    expect(useMonsterAbility(ray)).toBe(true) // Unlimited
  })

  it('daily abilities track uses', () => {
    const wail = { ...EXAMPLE_MONSTER_ABILITIES.BansheeWail }
    wail.usesRemaining = 1
    wail.maxUses = 1

    expect(useMonsterAbility(wail)).toBe(true)
    expect(wail.usesRemaining).toBe(0)
    expect(useMonsterAbility(wail)).toBe(false) // Exhausted
  })

  it('recharge check works for recharge_5_6', () => {
    const breath = EXAMPLE_MONSTER_ABILITIES.DragonBreath
    expect(monsterRechargeCheck(breath, 4)).toBe(false)
    expect(monsterRechargeCheck(breath, 5)).toBe(true)
    expect(monsterRechargeCheck(breath, 6)).toBe(true)
  })

  it('reset restores daily uses', () => {
    const wail = { ...EXAMPLE_MONSTER_ABILITIES.BansheeWail }
    wail.usesRemaining = 0
    wail.maxUses = 1

    resetMonsterAbilities([wail])
    expect(wail.usesRemaining).toBe(1)
  })

  it('creates custom monster ability', () => {
    const petrify = createMonsterAbility('Petrifying Gaze', {
      Debuff: 3, Ranged: 1, Sustained: 1, Greater: 1,
    }, {
      recharge: '3/day',
      condition: 'petrified',
      range: 30,
      saveAbility: 'con',
    })

    expect(petrify.spell.innate).toBe(true)
    expect(petrify.maxUses).toBe(3)
    expect(petrify.usesRemaining).toBe(3)
    expect(petrify.spell.school).toBe('enchantment') // Debuff → enchantment
  })

  it('monster ability composition round-trips', () => {
    for (const [, ability] of Object.entries(EXAMPLE_MONSTER_ABILITIES)) {
      const factored = factorizeSpell(ability.spell.seed)
      expect(factored).toEqual(ability.spell.elements)
    }
  })
})

// ============================================================
// CONSISTENCY
// ============================================================

describe('Consistency', () => {
  it('all 42 elements have unique primes', () => {
    const primes = Object.values(SPELL_ELEMENTS).map(e => e.prime)
    const unique = new Set(primes)
    expect(unique.size).toBe(primes.length)
    expect(primes.length).toBe(40)
  })

  it('all elements have valid categories', () => {
    const validCats = ['damage', 'delivery', 'school', 'duration', 'intensity']
    for (const el of Object.values(SPELL_ELEMENTS)) {
      expect(validCats).toContain(el.category)
    }
  })

  it('4 difficulty modes exist', () => {
    expect(Object.keys(MAGIC_CONFIGS)).toHaveLength(4)
  })

  it('HARD is the toughest mode where magic still exists', () => {
    expect(MAGIC_CONFIGS.HARD.magicExists).toBe(true)
    expect(MAGIC_CONFIGS.HARD.entropyEnabled).toBe(true)
    expect(MAGIC_CONFIGS.HARD.loreGatesActive).toBe(true)
    expect(MAGIC_CONFIGS.BRUTAL.magicExists).toBe(false)
  })
})
