/**
 * MM_CHARACTER — Individual Character State Machine
 * ===================================================
 * 
 * An MM_character IS a D&D character sheet as a manifold machine.
 * It stores RAW data and computes DERIVED values on demand.
 * 
 * The character is an MM because it contains sub-MFs:
 *   - Ability scores → modifiers (pure function)
 *   - Proficiency bonus (from total level)
 *   - Skill modifiers (ability mod + proficiency)
 *   - HP (from class hit dice + CON mod per level)
 *   - AC (from equipment + DEX + features)
 *   - Save DCs (from class spellcasting ability)
 *   - Attack modifiers (proficiency + ability mod)
 * 
 * RAW → DERIVED is the MF.
 * The character MM manages state transitions (damage, healing,
 * rest, leveling, condition tracking).
 * 
 * Based on: bend/src/engine/character/schema.ts (908 lines)
 */

import { z } from 'zod'
import { type CycleDelta, ZERO_DELTA, addDeltas } from './types'
import { type Combatant } from './mm-scene'

// ============================================================
// ABILITY SCORES — The 6 core attributes
// ============================================================

export const AbilitySchema = z.enum([
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
])
export type Ability = z.infer<typeof AbilitySchema>

export const SkillSchema = z.enum([
  'acrobatics', 'animal_handling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleight_of_hand',
  'stealth', 'survival',
])
export type Skill = z.infer<typeof SkillSchema>

/** Which ability each skill uses */
export const SKILL_ABILITIES: Record<Skill, Ability> = {
  acrobatics: 'dexterity', animal_handling: 'wisdom', arcana: 'intelligence',
  athletics: 'strength', deception: 'charisma', history: 'intelligence',
  insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence',
  medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence',
  sleight_of_hand: 'dexterity', stealth: 'dexterity', survival: 'wisdom',
}

// ============================================================
// CHARACTER DATA — The raw, stored state
// ============================================================

export const CharacterDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  playerName: z.string().optional(),

  /** Race/Species */
  race: z.string(),
  subrace: z.string().optional(),

  /** Classes (supports multiclassing) */
  classes: z.array(z.object({
    name: z.string(),
    level: z.number().int().min(1).max(20),
    subclass: z.string().optional(),
    hitDie: z.enum(['d6', 'd8', 'd10', 'd12']),
    isStartingClass: z.boolean().default(false),
  })).min(1),

  /** Raw ability scores (before modifiers) */
  abilityScores: z.object({
    strength: z.number().int().min(1).max(30),
    dexterity: z.number().int().min(1).max(30),
    constitution: z.number().int().min(1).max(30),
    intelligence: z.number().int().min(1).max(30),
    wisdom: z.number().int().min(1).max(30),
    charisma: z.number().int().min(1).max(30),
  }),

  /** Skill proficiencies */
  skillProficiencies: z.record(SkillSchema, z.enum(['none', 'half', 'proficient', 'expertise'])).optional(),

  /** Saving throw proficiencies */
  saveProficiencies: z.array(AbilitySchema).default([]),

  /** HP state */
  hpMax: z.number().int(),
  hpCurrent: z.number().int(),
  tempHp: z.number().int().default(0),
  hitDiceUsed: z.number().int().default(0),

  /** AC components */
  baseAC: z.number().int().default(10),
  armorType: z.enum(['none', 'light', 'medium', 'heavy']).default('none'),
  shieldEquipped: z.boolean().default(false),
  acBonuses: z.array(z.object({
    source: z.string(),
    value: z.number().int(),
  })).default([]),

  /** Combat info */
  speed: z.number().int().default(30),
  damageType: z.enum([
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
  ]).default('slashing'),

  /** Resistances/vulnerabilities/immunities */
  resistances: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  immunities: z.array(z.string()).default([]),

  /** Conditions */
  conditions: z.array(z.string()).default([]),

  /** Death saves */
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3).default(0),
    failures: z.number().int().min(0).max(3).default(0),
  }).default({ successes: 0, failures: 0 }),

  /** Spellcasting */
  spellcastingAbility: AbilitySchema.optional(),
  spellSlots: z.array(z.object({
    level: z.number().int(),
    max: z.number().int(),
    used: z.number().int().default(0),
  })).default([]),

  /** Experience & Level */
  xp: z.number().int().default(0),

  /** Status */
  status: z.enum(['active', 'unconscious', 'dead', 'petrified']).default('active'),
})
/** The full parsed type (with defaults applied) */
export type CharacterData = z.infer<typeof CharacterDataSchema>
/** The input type (defaults are optional) */
export type CharacterDataInput = z.input<typeof CharacterDataSchema>

// ============================================================
// DERIVED VALUES — Computed from raw data (pure MF)
// ============================================================

export interface DerivedStats {
  /** Total character level (sum of all class levels) */
  totalLevel: number
  /** Proficiency bonus (from total level) */
  proficiencyBonus: number
  /** Ability modifiers */
  abilityModifiers: Record<Ability, number>
  /** Skill modifiers (ability mod + proficiency contribution) */
  skillModifiers: Record<Skill, number>
  /** Saving throw modifiers */
  saveModifiers: Record<Ability, number>
  /** Computed AC */
  ac: number
  /** Passive perception */
  passivePerception: number
  /** Attack modifier (proficiency + primary ability mod) */
  attackModifier: number
  /** Spell save DC (if spellcaster) */
  spellSaveDC: number | null
  /** Spell attack modifier (if spellcaster) */
  spellAttackModifier: number | null
  /** Initiative modifier (DEX mod) */
  initiativeModifier: number
  /** Total hit dice */
  totalHitDice: number
  /** Hit dice remaining */
  hitDiceRemaining: number
}

// ============================================================
// MM_CHARACTER — The character manifold machine
// ============================================================

export class MMCharacter {
  private data: CharacterData
  private deltaAccumulator: CycleDelta = { ...ZERO_DELTA }

  constructor(data: CharacterDataInput) {
    this.data = CharacterDataSchema.parse(data)
  }

  // ============================================================
  // PURE MF: Raw → Derived (the core computation)
  // ============================================================

  /**
   * Compute ALL derived stats from raw data.
   * This is the MF: data → stats. Pure function, no side effects.
   */
  derive(): DerivedStats {
    const d = this.data

    // Total level
    const totalLevel = d.classes.reduce((sum, c) => sum + c.level, 0)

    // Proficiency bonus: (level - 1) / 4 + 2
    const proficiencyBonus = Math.floor((totalLevel - 1) / 4) + 2

    // Ability modifiers: floor((score - 10) / 2)
    const abilityModifiers = {} as Record<Ability, number>
    for (const ability of AbilitySchema.options) {
      abilityModifiers[ability] = Math.floor((d.abilityScores[ability] - 10) / 2)
    }

    // Skill modifiers
    const skillModifiers = {} as Record<Skill, number>
    for (const skill of SkillSchema.options) {
      const ability = SKILL_ABILITIES[skill]
      const baseMod = abilityModifiers[ability]
      const proficiency = (d.skillProficiencies ?? {})[skill] ?? 'none'

      let bonus = baseMod
      if (proficiency === 'half') bonus += Math.floor(proficiencyBonus / 2)
      else if (proficiency === 'proficient') bonus += proficiencyBonus
      else if (proficiency === 'expertise') bonus += proficiencyBonus * 2

      skillModifiers[skill] = bonus
    }

    // Saving throw modifiers
    const saveModifiers = {} as Record<Ability, number>
    for (const ability of AbilitySchema.options) {
      saveModifiers[ability] = abilityModifiers[ability] +
        (d.saveProficiencies.includes(ability) ? proficiencyBonus : 0)
    }

    // AC computation
    let ac = d.baseAC
    if (d.armorType === 'none') {
      ac = 10 + abilityModifiers.dexterity
    } else if (d.armorType === 'light') {
      ac = d.baseAC + abilityModifiers.dexterity
    } else if (d.armorType === 'medium') {
      ac = d.baseAC + Math.min(abilityModifiers.dexterity, 2)
    }
    // Heavy: no DEX bonus, just baseAC
    if (d.shieldEquipped) ac += 2
    for (const bonus of d.acBonuses) ac += bonus.value

    // Passive perception
    const passivePerception = 10 + skillModifiers.perception

    // Attack modifier (use highest ability among STR/DEX for martial, or spellcasting ability)
    const attackModifier = proficiencyBonus + Math.max(
      abilityModifiers.strength,
      abilityModifiers.dexterity,
    )

    // Spellcasting
    let spellSaveDC: number | null = null
    let spellAttackModifier: number | null = null
    if (d.spellcastingAbility) {
      const abilityMod = abilityModifiers[d.spellcastingAbility]
      spellSaveDC = 8 + proficiencyBonus + abilityMod
      spellAttackModifier = proficiencyBonus + abilityMod
    }

    // Hit dice
    const totalHitDice = totalLevel
    const hitDiceRemaining = totalLevel - d.hitDiceUsed

    return {
      totalLevel,
      proficiencyBonus,
      abilityModifiers,
      skillModifiers,
      saveModifiers,
      ac,
      passivePerception,
      attackModifier,
      spellSaveDC,
      spellAttackModifier,
      initiativeModifier: abilityModifiers.dexterity,
      totalHitDice,
      hitDiceRemaining,
    }
  }

  // ============================================================
  // STATE TRANSITIONS — The MM operations
  // ============================================================

  /** Apply damage to this character. */
  takeDamage(amount: number): { hpAfter: number; statusChange?: string } {
    let remaining = amount

    // Temp HP absorbs first
    if (this.data.tempHp > 0) {
      const absorbed = Math.min(this.data.tempHp, remaining)
      this.data.tempHp -= absorbed
      remaining -= absorbed
    }

    const hpBefore = this.data.hpCurrent
    this.data.hpCurrent = Math.max(0, this.data.hpCurrent - remaining)

    let statusChange: string | undefined
    if (this.data.hpCurrent === 0) {
      // D&D 5e: if overkill (damage past 0) >= max HP, instant death
      const overkill = remaining - hpBefore
      if (overkill >= this.data.hpMax) {
        this.data.status = 'dead'
        statusChange = 'dead'
      } else {
        this.data.status = 'unconscious'
        this.data.deathSaves = { successes: 0, failures: 0 }
        statusChange = 'unconscious'
      }
    }

    this.deltaAccumulator = addDeltas(this.deltaAccumulator, {
      potential: -amount, archival: 0, omega: amount,
    })

    return { hpAfter: this.data.hpCurrent, statusChange }
  }

  /** Heal this character. */
  heal(amount: number): { hpAfter: number; statusChange?: string } {
    const wasUnconscious = this.data.status === 'unconscious'
    this.data.hpCurrent = Math.min(this.data.hpMax, this.data.hpCurrent + amount)

    let statusChange: string | undefined
    if (wasUnconscious && this.data.hpCurrent > 0) {
      this.data.status = 'active'
      this.data.deathSaves = { successes: 0, failures: 0 }
      statusChange = 'active'
    }

    this.deltaAccumulator = addDeltas(this.deltaAccumulator, {
      potential: amount, archival: 0, omega: 0,
    })

    return { hpAfter: this.data.hpCurrent, statusChange }
  }

  /** Short rest: spend hit dice to heal. */
  shortRest(hitDiceToSpend: number): { hpHealed: number; diceSpent: number } {
    const stats = this.derive()
    const available = stats.hitDiceRemaining
    const toSpend = Math.min(hitDiceToSpend, available)

    if (toSpend === 0) return { hpHealed: 0, diceSpent: 0 }

    // Roll hit dice: use the first class's hit die for simplicity
    const hitDie = this.data.classes[0].hitDie
    const dieSides = parseInt(hitDie.slice(1))
    const conMod = stats.abilityModifiers.constitution

    // Average roll per die: (sides / 2 + 0.5) + CON mod
    let totalHealed = 0
    for (let i = 0; i < toSpend; i++) {
      const roll = Math.ceil(dieSides / 2) + conMod // Use average
      totalHealed += Math.max(1, roll)
    }

    this.data.hitDiceUsed += toSpend
    this.heal(totalHealed)

    return { hpHealed: totalHealed, diceSpent: toSpend }
  }

  /** Long rest: restore HP, half hit dice, spell slots, features. */
  longRest(): { hpRestored: number; hitDiceRestored: number; spellSlotsRestored: number } {
    const stats = this.derive()

    // Restore all HP
    const hpRestored = this.data.hpMax - this.data.hpCurrent
    this.data.hpCurrent = this.data.hpMax
    this.data.tempHp = 0

    // Restore half hit dice (minimum 1)
    const hitDiceToRestore = Math.max(1, Math.floor(stats.totalHitDice / 2))
    const actualRestored = Math.min(hitDiceToRestore, this.data.hitDiceUsed)
    this.data.hitDiceUsed -= actualRestored

    // Restore all spell slots
    let slotsRestored = 0
    for (const slot of this.data.spellSlots) {
      slotsRestored += slot.used
      slot.used = 0
    }

    // Clear death saves
    this.data.deathSaves = { successes: 0, failures: 0 }

    // Restore status if unconscious
    if (this.data.status === 'unconscious') {
      this.data.status = 'active'
    }

    return { hpRestored, hitDiceRestored: actualRestored, spellSlotsRestored: slotsRestored }
  }

  /** Add a condition. */
  addCondition(condition: string): void {
    if (!this.data.conditions.includes(condition)) {
      this.data.conditions.push(condition)
    }
  }

  /** Remove a condition. */
  removeCondition(condition: string): void {
    this.data.conditions = this.data.conditions.filter(c => c !== condition)
  }

  /** Use a spell slot. */
  useSpellSlot(level: number): boolean {
    const slot = this.data.spellSlots.find(s => s.level === level)
    if (!slot || slot.used >= slot.max) return false
    slot.used++
    return true
  }

  // ============================================================
  // BRIDGE: Convert to combatant for MM_scene
  // ============================================================

  /**
   * Project this character into a Combatant for combat.
   * This is the interface between MM_character and MM_scene.
   */
  toCombatant(): Combatant {
    const stats = this.derive()
    const primaryClass = this.data.classes[0]
    const dieSides = parseInt(primaryClass.hitDie.slice(1))

    return {
      id: this.data.id,
      name: this.data.name,
      side: 'party',
      initiativeModifier: stats.initiativeModifier,
      hpCurrent: this.data.hpCurrent,
      hpMax: this.data.hpMax,
      tempHp: this.data.tempHp,
      ac: stats.ac,
      attackModifier: stats.attackModifier,
      damageDice: { count: 1, sides: dieSides, modifier: Math.max(stats.abilityModifiers.strength, stats.abilityModifiers.dexterity) },
      damageType: this.data.damageType,
      resistances: this.data.resistances,
      vulnerabilities: this.data.vulnerabilities,
      immunities: this.data.immunities,
      status: this.data.status as Combatant['status'],
    }
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  getData(): CharacterData { return { ...this.data } }
  getId(): string { return this.data.id }
  getName(): string { return this.data.name }
  getStatus(): string { return this.data.status }
  getHp(): { current: number; max: number; temp: number } {
    return { current: this.data.hpCurrent, max: this.data.hpMax, temp: this.data.tempHp }
  }
  getDelta(): CycleDelta { return { ...this.deltaAccumulator } }
}
