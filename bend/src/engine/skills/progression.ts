/**
 * SKILL PROGRESSION SYSTEM
 * =========================
 *
 * Uses sqrt(xp/100) scaling - same as the lore system.
 * Consistent thermodynamics across all knowledge acquisition.
 *
 * LEVEL TABLE:
 * Level 1:  100 XP  (novice understanding)
 * Level 2:  400 XP  (competent practice)
 * Level 3:  900 XP  (experienced application)
 * Level 4: 1600 XP  (advanced mastery)
 * Level 5: 2500 XP  (legendary expertise)
 *
 * XP is earned through:
 * - Using skills (more for harder checks)
 * - Critical successes (bonus XP)
 * - Learning from failures (reduced but non-zero XP)
 * - Training downtime
 * - Discovery moments (high resonance = high XP)
 */

import { z } from 'zod'
import {
  type SkillEntry,
  type ActionContext,
  type ProficiencyLevel,
  type Ability,
  calculateSkillLevel,
  xpForLevel,
  xpToNextLevel,
} from './schema'

// Re-export core functions
export { calculateSkillLevel, xpForLevel, xpToNextLevel }

// ============================================
// XP GAIN CONFIGURATION
// ============================================

/**
 * Configuration for XP gain calculations.
 */
export interface XPGainConfig {
  /** Base XP per skill use (scales with DC) */
  baseXPPerUse: number

  /** Multiplier for critical success (natural 20) */
  criticalSuccessMultiplier: number

  /** Multiplier for critical failure (natural 1) - still learn from mistakes */
  criticalFailureMultiplier: number

  /** Multiplier for success vs DC */
  successMultiplier: number

  /** Multiplier for failure vs DC */
  failureMultiplier: number

  /** Maximum XP from a single check */
  maxXPPerCheck: number

  /** XP per hour of dedicated training */
  trainingXPPerHour: number

  /** Multiplier based on training source quality */
  trainingSourceMultipliers: Record<string, number>
}

/**
 * Default XP configuration.
 */
export const DEFAULT_XP_CONFIG: XPGainConfig = {
  baseXPPerUse: 5,
  criticalSuccessMultiplier: 3.0,
  criticalFailureMultiplier: 0.5,
  successMultiplier: 1.5,
  failureMultiplier: 0.75,
  maxXPPerCheck: 50,
  trainingXPPerHour: 10,
  trainingSourceMultipliers: {
    'self_study': 0.5,
    'book': 1.0,
    'mentor': 1.5,
    'master': 2.0,
    'legendary_master': 3.0,
  },
}

// ============================================
// XP GAIN CALCULATION
// ============================================

/**
 * Input for calculating XP gain from a skill check.
 */
export const SkillCheckResultSchema = z.object({
  /** Total roll result */
  total: z.number().int(),

  /** Natural die roll (before modifiers) */
  natural: z.number().int().min(1).max(20),

  /** Difficulty class of the check */
  dc: z.number().int().min(1),

  /** Did the check succeed? */
  success: z.boolean(),

  /** Was this a critical (natural 20)? */
  isCritical: z.boolean(),

  /** Was this a fumble (natural 1)? */
  isFumble: z.boolean(),

  /** Margin of success/failure */
  margin: z.number().int(),
})
export type SkillCheckResult = z.infer<typeof SkillCheckResultSchema>

/**
 * Calculate XP gain from a skill check.
 */
export function calculateCheckXP(
  result: SkillCheckResult,
  currentEntry: SkillEntry,
  config: XPGainConfig = DEFAULT_XP_CONFIG
): number {
  // Base XP scales with DC difficulty
  // DC 10 = 1x, DC 15 = 1.5x, DC 20 = 2x, DC 25 = 2.5x, DC 30 = 3x
  const dcMultiplier = Math.max(0.5, result.dc / 10)
  let xp = config.baseXPPerUse * dcMultiplier

  // Critical success: major learning moment
  if (result.isCritical) {
    xp *= config.criticalSuccessMultiplier
  }
  // Critical failure: learn from mistakes (but less)
  else if (result.isFumble) {
    xp *= config.criticalFailureMultiplier
  }
  // Normal success/failure
  else if (result.success) {
    xp *= config.successMultiplier
  } else {
    xp *= config.failureMultiplier
  }

  // Margin bonus: bigger success = more learning
  // +1 XP per 2 points of margin
  if (result.success && result.margin > 0) {
    xp += Math.floor(result.margin / 2)
  }

  // Diminishing returns at high levels
  // Learning basic things when you're a master doesn't teach much
  const currentLevel = calculateSkillLevel(currentEntry.xp)
  if (currentLevel >= 3) {
    const diminishingFactor = Math.max(0.25, 1 - (currentLevel - 2) * 0.15)
    xp *= diminishingFactor
  }

  // DC below character's effective level reduces XP
  // If you're level 5 and doing DC 10 checks, you learn little
  const effectiveLevel = currentLevel + (currentEntry.proficiency === 'expertise' ? 2 :
                                          currentEntry.proficiency === 'proficient' ? 1 : 0)
  const levelDCThreshold = 10 + effectiveLevel * 2
  if (result.dc < levelDCThreshold) {
    const trivialityFactor = Math.max(0.1, result.dc / levelDCThreshold)
    xp *= trivialityFactor
  }

  // Cap maximum XP per check
  xp = Math.min(config.maxXPPerCheck, xp)

  return Math.floor(Math.max(1, xp))
}

/**
 * Calculate XP gain from an action context (for discovery engine).
 */
export function calculateActionXP(
  context: ActionContext,
  skillEntry: SkillEntry,
  abilityModifier: number,
  config: XPGainConfig = DEFAULT_XP_CONFIG
): number {
  let baseXP = context.magnitude

  // Critical = 2x, Fumble = 0.5x (still learn from failure)
  if (context.rollResult?.wasCritical) {
    baseXP *= config.criticalSuccessMultiplier
  } else if (context.rollResult?.wasFumble) {
    baseXP *= config.criticalFailureMultiplier
  }

  // Proficiency affects learning rate
  const profMult: Record<ProficiencyLevel, number> = {
    'none': 0.5,
    'half': 0.75,
    'proficient': 1.0,
    'expertise': 1.25,
  }
  baseXP *= profMult[skillEntry.proficiency]

  // Ability score affects learning
  baseXP *= (1 + abilityModifier * 0.05)

  // Diminishing returns at high levels
  const currentLevel = calculateSkillLevel(skillEntry.xp)
  if (currentLevel >= 3) {
    baseXP *= Math.max(0.5, 1 - (currentLevel - 3) * 0.1)
  }

  return Math.floor(Math.max(1, baseXP))
}

// ============================================
// TRAINING SYSTEM
// ============================================

/**
 * Training source types with their XP multipliers.
 */
export const TrainingSourceSchema = z.object({
  type: z.enum([
    'self_study',       // Practicing alone
    'book',             // Learning from written material
    'mentor',           // Basic instruction
    'master',           // Expert instruction
    'legendary_master', // Legendary practitioner
    'divine_insight',   // Cleric/Paladin domain
    'innate_talent',    // Sorcerer-like natural ability
  ]),
  name: z.string(),
  maxLevel: z.number().int().min(1).max(5).optional(),
})
export type TrainingSource = z.infer<typeof TrainingSourceSchema>

/**
 * Calculate XP gained from training.
 */
export function calculateTrainingXP(
  hours: number,
  source: TrainingSource,
  currentEntry: SkillEntry,
  config: XPGainConfig = DEFAULT_XP_CONFIG
): { xp: number; effectiveHours: number; cappedBySource: boolean } {
  const multiplier = config.trainingSourceMultipliers[source.type] ?? 1.0
  let xp = hours * config.trainingXPPerHour * multiplier

  // Check if source caps the level
  const currentLevel = calculateSkillLevel(currentEntry.xp)
  const sourceMaxLevel = source.maxLevel ?? 5

  if (currentLevel >= sourceMaxLevel) {
    // Can't learn more from this source
    return { xp: 0, effectiveHours: 0, cappedBySource: true }
  }

  // Calculate effective hours (diminishing returns)
  // First 8 hours = full value, then 50% per additional 8
  let effectiveHours = 0
  let remainingHours = hours
  let currentMultiplier = 1.0

  while (remainingHours > 0) {
    const block = Math.min(8, remainingHours)
    effectiveHours += block * currentMultiplier
    remainingHours -= block
    currentMultiplier *= 0.5
  }

  xp = effectiveHours * config.trainingXPPerHour * multiplier

  // Cap XP gain at the amount needed for source's max level
  const xpCap = xpForLevel(sourceMaxLevel) - currentEntry.xp
  xp = Math.min(xp, Math.max(0, xpCap))

  return {
    xp: Math.floor(xp),
    effectiveHours,
    cappedBySource: xp >= xpCap,
  }
}

// ============================================
// SKILL MODIFIER CALCULATION
// ============================================

/**
 * Calculate the total modifier for a skill check.
 */
export function calculateSkillModifier(
  skillEntry: SkillEntry,
  abilityModifier: number,
  proficiencyBonus: number
): number {
  let modifier = abilityModifier

  // Proficiency contribution
  switch (skillEntry.proficiency) {
    case 'half':
      modifier += Math.floor(proficiencyBonus / 2)
      break
    case 'proficient':
      modifier += proficiencyBonus
      break
    case 'expertise':
      modifier += proficiencyBonus * 2
      break
    // 'none' adds nothing
  }

  // Skill level contribution (for discovered skills)
  // Each level adds +1, capped at +5
  modifier += Math.min(5, skillEntry.level)

  return modifier
}

/**
 * Get detailed breakdown of skill modifier components.
 */
export function getSkillModifierBreakdown(
  skillEntry: SkillEntry,
  abilityModifier: number,
  _abilityUsed: Ability,
  proficiencyBonus: number,
  miscBonuses: { source: string; value: number }[] = []
): {
  abilityModifier: number
  proficiencyContribution: number
  skillLevelContribution: number
  miscBonuses: { source: string; value: number }[]
  totalModifier: number
} {
  void _abilityUsed // Used for display purposes in calling code
  let proficiencyContribution = 0
  switch (skillEntry.proficiency) {
    case 'half':
      proficiencyContribution = Math.floor(proficiencyBonus / 2)
      break
    case 'proficient':
      proficiencyContribution = proficiencyBonus
      break
    case 'expertise':
      proficiencyContribution = proficiencyBonus * 2
      break
  }

  const skillLevelContribution = Math.min(5, skillEntry.level)

  const miscTotal = miscBonuses.reduce((sum, b) => sum + b.value, 0)

  return {
    abilityModifier,
    proficiencyContribution,
    skillLevelContribution,
    miscBonuses,
    totalModifier: abilityModifier + proficiencyContribution + skillLevelContribution + miscTotal,
  }
}

// ============================================
// LEVEL MILESTONES
// ============================================

/**
 * Descriptions of what each skill level represents.
 */
export const SKILL_LEVEL_DESCRIPTIONS: Record<number, {
  name: string
  description: string
  mechanicalBenefit: string
}> = {
  0: {
    name: 'Untrained',
    description: 'No formal training or experience.',
    mechanicalBenefit: 'Ability modifier only (may have disadvantage on some checks)',
  },
  1: {
    name: 'Novice',
    description: 'Basic understanding and initial practice.',
    mechanicalBenefit: '+1 bonus to checks',
  },
  2: {
    name: 'Competent',
    description: 'Reliable performance under normal conditions.',
    mechanicalBenefit: '+2 bonus to checks',
  },
  3: {
    name: 'Experienced',
    description: 'Handles difficult situations with confidence.',
    mechanicalBenefit: '+3 bonus to checks',
  },
  4: {
    name: 'Expert',
    description: 'Recognized specialist in this field.',
    mechanicalBenefit: '+4 bonus to checks',
  },
  5: {
    name: 'Master',
    description: 'Legendary practitioner, teaches others.',
    mechanicalBenefit: '+5 bonus to checks (maximum)',
  },
}

/**
 * Get level description for a skill entry.
 */
export function getSkillLevelDescription(skillEntry: SkillEntry): {
  level: number
  name: string
  description: string
  mechanicalBenefit: string
  xpToNext: number | null
  progressPercent: number
} {
  const level = skillEntry.level
  const desc = SKILL_LEVEL_DESCRIPTIONS[Math.min(5, level)] ?? SKILL_LEVEL_DESCRIPTIONS[5]

  const xpToNext = level < 5 ? xpToNextLevel(skillEntry.xp) : null

  // Progress percentage to next level
  const currentLevelXP = xpForLevel(level)
  const nextLevelXP = xpForLevel(level + 1)
  const xpIntoLevel = skillEntry.xp - currentLevelXP
  const xpNeededForLevel = nextLevelXP - currentLevelXP
  const progressPercent = level >= 5 ? 100 : Math.floor((xpIntoLevel / xpNeededForLevel) * 100)

  return {
    level,
    name: desc.name,
    description: desc.description,
    mechanicalBenefit: desc.mechanicalBenefit,
    xpToNext,
    progressPercent,
  }
}

// ============================================
// EXPERIENCE APPLICATION
// ============================================

/**
 * Apply XP gain to a skill entry and recalculate level.
 */
export function applySkillXP(
  entry: SkillEntry,
  xpGain: number
): { entry: SkillEntry; leveledUp: boolean; newLevel: number } {
  const oldLevel = entry.level
  const newXP = entry.xp + xpGain
  const newLevel = calculateSkillLevel(newXP)

  return {
    entry: {
      ...entry,
      xp: newXP,
      level: newLevel,
    },
    leveledUp: newLevel > oldLevel,
    newLevel,
  }
}

/**
 * Record a skill usage (for tracking stats).
 */
export function recordSkillUsage(
  entry: SkillEntry,
  result: SkillCheckResult,
  xpGained: number
): SkillEntry {
  const updated = applySkillXP(entry, xpGained)

  return {
    ...updated.entry,
    timesUsed: entry.timesUsed + 1,
    lastUsedAt: new Date(),
    criticalSuccesses: entry.criticalSuccesses + (result.isCritical ? 1 : 0),
    criticalFailures: entry.criticalFailures + (result.isFumble ? 1 : 0),
    highestDCBeaten: result.success && result.dc > (entry.highestDCBeaten ?? 0)
      ? result.dc
      : entry.highestDCBeaten,
  }
}
