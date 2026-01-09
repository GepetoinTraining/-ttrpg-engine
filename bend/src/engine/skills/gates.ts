/**
 * SKILL GATES
 * ============
 *
 * Like lore gates for magic, skills can gate content.
 *
 * A skill gate says: "You cannot do X unless you have Y skill."
 * This creates meaningful progression where skills unlock
 * new possibilities, not just higher numbers.
 *
 * GATE TYPES:
 * - action: Can't attempt this action
 * - information: Can't understand this info
 * - item_use: Can't use this item effectively
 * - location_access: Can't enter/navigate this area
 * - dialogue_option: Can't say this in conversation
 * - crafting_recipe: Can't craft this
 *
 * FAILURE MODES:
 * - blocked: Simply can't do it
 * - disadvantage: Can try at disadvantage
 * - increased_dc: DC increases significantly
 * - dangerous: Can try but risks harm
 */

import { z } from 'zod'
import {
  type CharacterSkills,
  type SkillEntry,
  type ProficiencyLevel,
  type CoreSkill,
  ProficiencyLevelSchema,
} from './schema'

// ============================================
// GATE REQUIREMENT
// ============================================

/**
 * A single skill requirement for a gate.
 */
export const GateRequirementSchema = z.object({
  /** Skill ID (core or discovered) */
  skillId: z.string(),

  /** Minimum level required (for discovered skills) */
  minLevel: z.number().int().min(0).optional(),

  /** Minimum proficiency required */
  minProficiency: ProficiencyLevelSchema.optional(),
})
export type GateRequirement = z.infer<typeof GateRequirementSchema>

// ============================================
// GATED CONTENT
// ============================================

/**
 * What the gate protects.
 */
export const GatedContentSchema = z.object({
  /** Type of content being gated */
  type: z.enum([
    'action',           // Can't attempt this action
    'information',      // Can't understand this info
    'item_use',         // Can't use this item effectively
    'location_access',  // Can't enter/navigate this area
    'dialogue_option',  // Can't say this in conversation
    'crafting_recipe',  // Can't craft this
  ]),

  /** Unique ID of the gated content */
  id: z.string(),

  /** Display name */
  name: z.string(),

  /** Description of what's being gated */
  description: z.string().optional(),
})
export type GatedContent = z.infer<typeof GatedContentSchema>

// ============================================
// SKILL GATE DEFINITION
// ============================================

/**
 * A gate that requires specific skills to pass.
 */
export const SkillGateSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Display name */
  name: z.string(),

  /** What this gate represents */
  description: z.string(),

  /**
   * Skill requirements.
   * All must be met unless requireAll is false.
   */
  requirements: z.array(GateRequirementSchema).min(1),

  /** Must all requirements be met, or just one? */
  requireAll: z.boolean().default(true),

  /** What this gate protects */
  gatedContent: GatedContentSchema,

  /** What happens if you try without the skill */
  failureMode: z.enum([
    'blocked',      // Simply can't do it
    'disadvantage', // Can try at disadvantage
    'increased_dc', // DC increases
    'dangerous',    // Can try but risks harm
  ]).default('blocked'),

  /** For increased_dc mode: how much to increase */
  dcIncrease: z.number().int().optional(),

  /** For dangerous mode: what risk is incurred */
  dangerDescription: z.string().optional(),

  /** Is this gate active? */
  isActive: z.boolean().default(true),

  /** Source (standard, homebrew, campaign-specific) */
  source: z.string().optional(),
})
export type SkillGate = z.infer<typeof SkillGateSchema>

// ============================================
// GATE CHECK RESULT
// ============================================

export const GateCheckResultSchema = z.object({
  /** The gate being checked */
  gate: SkillGateSchema,

  /** Can the character pass this gate? */
  canPass: z.boolean(),

  /** Which requirements are met */
  requirementsMet: z.array(z.object({
    requirement: GateRequirementSchema,
    met: z.boolean(),
    currentLevel: z.number().int(),
    currentProficiency: ProficiencyLevelSchema.optional(),
    reason: z.string().optional(),
  })),

  /** What happens if they try anyway */
  consequence: z.enum([
    'success',      // Gate passed
    'blocked',      // Can't attempt
    'disadvantage', // Can try with disadvantage
    'increased_dc', // Higher DC
    'dangerous',    // Risk harm
  ]),

  /** DC increase (if applicable) */
  dcIncrease: z.number().int().optional(),

  /** Danger description (if applicable) */
  dangerDescription: z.string().optional(),
})
export type GateCheckResult = z.infer<typeof GateCheckResultSchema>

// ============================================
// GATE ENGINE
// ============================================

export class SkillGateEngine {
  /**
   * Check if a character can pass a skill gate.
   */
  checkGate(
    gate: SkillGate,
    skills: CharacterSkills
  ): GateCheckResult {
    const requirementsMet: GateCheckResult['requirementsMet'] = []
    let passCount = 0

    for (const req of gate.requirements) {
      const result = this.checkRequirement(req, skills)
      requirementsMet.push(result)
      if (result.met) passCount++
    }

    // Determine if gate is passed
    const canPass = gate.requireAll
      ? passCount === gate.requirements.length
      : passCount > 0

    // Determine consequence
    let consequence: GateCheckResult['consequence'] = 'success'
    let dcIncrease: number | undefined
    let dangerDescription: string | undefined

    if (!canPass) {
      consequence = gate.failureMode
      if (gate.failureMode === 'increased_dc') {
        dcIncrease = gate.dcIncrease ?? 5
      }
      if (gate.failureMode === 'dangerous') {
        dangerDescription = gate.dangerDescription ?? 'Unknown danger awaits.'
      }
    }

    return {
      gate,
      canPass,
      requirementsMet,
      consequence,
      dcIncrease,
      dangerDescription,
    }
  }

  /**
   * Check a single requirement.
   */
  private checkRequirement(
    req: GateRequirement,
    skills: CharacterSkills
  ): GateCheckResult['requirementsMet'][0] {
    // Check core skills
    const coreEntry = skills.coreSkills[req.skillId as CoreSkill]
    if (coreEntry) {
      return this.evaluateEntry(req, coreEntry)
    }

    // Check discovered skills
    const discoveredEntry = skills.discoveredSkills[req.skillId]
    if (discoveredEntry) {
      return this.evaluateEntry(req, discoveredEntry)
    }

    // Skill not found
    return {
      requirement: req,
      met: false,
      currentLevel: 0,
      reason: 'Skill not found on character',
    }
  }

  /**
   * Evaluate a skill entry against a requirement.
   */
  private evaluateEntry(
    req: GateRequirement,
    entry: SkillEntry
  ): GateCheckResult['requirementsMet'][0] {
    const currentLevel = entry.level
    const currentProficiency = entry.proficiency

    let met = true
    let reason: string | undefined

    // Check level requirement
    if (req.minLevel !== undefined && currentLevel < req.minLevel) {
      met = false
      reason = `Requires level ${req.minLevel}, currently ${currentLevel}`
    }

    // Check proficiency requirement
    if (req.minProficiency && met) {
      const profOrder: ProficiencyLevel[] = ['none', 'half', 'proficient', 'expertise']
      const reqIndex = profOrder.indexOf(req.minProficiency)
      const currentIndex = profOrder.indexOf(currentProficiency)

      if (currentIndex < reqIndex) {
        met = false
        reason = `Requires ${req.minProficiency}, currently ${currentProficiency}`
      }
    }

    return {
      requirement: req,
      met,
      currentLevel,
      currentProficiency,
      reason,
    }
  }

  /**
   * Find all gates a character can pass.
   */
  getPassableGates(
    skills: CharacterSkills,
    gates: SkillGate[]
  ): SkillGate[] {
    return gates.filter(gate => {
      if (!gate.isActive) return false
      const result = this.checkGate(gate, skills)
      return result.canPass
    })
  }

  /**
   * Find all gates blocking a character.
   */
  getBlockingGates(
    skills: CharacterSkills,
    gates: SkillGate[]
  ): GateCheckResult[] {
    const blocking: GateCheckResult[] = []

    for (const gate of gates) {
      if (!gate.isActive) continue
      const result = this.checkGate(gate, skills)
      if (!result.canPass) {
        blocking.push(result)
      }
    }

    return blocking
  }

  /**
   * Find gates for specific content.
   */
  findGatesForContent(
    contentId: string,
    gates: SkillGate[]
  ): SkillGate[] {
    return gates.filter(gate =>
      gate.isActive && gate.gatedContent.id === contentId
    )
  }
}

// ============================================
// STANDARD SKILL GATES
// ============================================

/**
 * Standard skill gates for common D&D content.
 */
export const STANDARD_SKILL_GATES: SkillGate[] = [
  // Reading ancient languages
  {
    id: 'read_draconic_ancient',
    name: 'Ancient Draconic Script',
    description: 'Reading the archaic form of Draconic used in ancient texts.',
    requirements: [
      { skillId: 'arcana', minLevel: 3 },
      { skillId: 'history', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'information',
      id: 'ancient_draconic',
      name: 'Ancient Draconic Texts',
      description: 'Scrolls, tomes, and inscriptions in archaic Draconic.',
    },
    failureMode: 'blocked',
    isActive: true,
    source: 'standard',
  },

  // Using complex magical items
  {
    id: 'attune_complex_artifacts',
    name: 'Complex Artifact Attunement',
    description: 'Attuning to artifacts that require magical understanding.',
    requirements: [
      { skillId: 'arcana', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'item_use',
      id: 'complex_artifacts',
      name: 'Complex Magical Artifacts',
      description: 'Items that require deep arcane knowledge to attune.',
    },
    failureMode: 'dangerous',
    dangerDescription: 'Wild magic surge or psychic backlash (2d6 psychic damage).',
    isActive: true,
    source: 'standard',
  },

  // Navigating the Underdark
  {
    id: 'navigate_underdark',
    name: 'Underdark Navigation',
    description: 'Finding your way through the lightless depths.',
    requirements: [
      { skillId: 'survival', minProficiency: 'proficient' },
      { skillId: 'perception', minProficiency: 'proficient' },
    ],
    requireAll: false, // Either works, but both is best
    gatedContent: {
      type: 'location_access',
      id: 'underdark_depths',
      name: 'Deep Underdark',
      description: 'The deeper passages of the Underdark.',
    },
    failureMode: 'increased_dc',
    dcIncrease: 5,
    isActive: true,
    source: 'standard',
  },

  // Negotiating with nobility
  {
    id: 'noble_audience',
    name: 'Formal Court Protocol',
    description: 'Proper etiquette required for noble audiences.',
    requirements: [
      { skillId: 'persuasion', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'dialogue_option',
      id: 'formal_petition',
      name: 'Formal Petition',
      description: 'Making a formal request to nobility.',
    },
    failureMode: 'disadvantage',
    isActive: true,
    source: 'standard',
  },

  // Crafting magical items
  {
    id: 'craft_magic_items',
    name: 'Magical Crafting',
    description: 'The knowledge required to create magical items.',
    requirements: [
      { skillId: 'arcana', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'crafting_recipe',
      id: 'magic_items',
      name: 'Magical Items',
      description: 'Creating items with magical properties.',
    },
    failureMode: 'blocked',
    isActive: true,
    source: 'standard',
  },

  // Identifying poisons
  {
    id: 'identify_poison',
    name: 'Poison Identification',
    description: 'Recognizing and understanding poisons.',
    requirements: [
      { skillId: 'medicine', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'information',
      id: 'poison_identification',
      name: 'Poison Type',
      description: 'Identifying the specific poison and its effects.',
    },
    failureMode: 'increased_dc',
    dcIncrease: 5,
    isActive: true,
    source: 'standard',
  },

  // Tracking intelligent creatures
  {
    id: 'track_intelligent',
    name: 'Intelligent Quarry Tracking',
    description: 'Tracking creatures that actively avoid detection.',
    requirements: [
      { skillId: 'survival', minProficiency: 'proficient' },
      { skillId: 'investigation', minProficiency: 'half' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'action',
      id: 'track_smart_creature',
      name: 'Track Intelligent Creature',
      description: 'Following the trail of a creature trying to hide its tracks.',
    },
    failureMode: 'increased_dc',
    dcIncrease: 5,
    isActive: true,
    source: 'standard',
  },

  // Deciphering thieves' cant
  {
    id: 'read_thieves_marks',
    name: 'Thieves\' Marks',
    description: 'Understanding the secret symbols of the criminal underworld.',
    requirements: [
      { skillId: 'sleight_of_hand', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'information',
      id: 'thieves_marks',
      name: 'Criminal Symbols',
      description: 'Markings left by thieves and smugglers.',
    },
    failureMode: 'blocked',
    isActive: true,
    source: 'standard',
  },

  // Performing ritual magic
  {
    id: 'ritual_magic',
    name: 'Ritual Performance',
    description: 'Properly performing magical rituals.',
    requirements: [
      { skillId: 'arcana', minProficiency: 'proficient' },
      { skillId: 'religion', minProficiency: 'half' },
    ],
    requireAll: false,
    gatedContent: {
      type: 'action',
      id: 'perform_ritual',
      name: 'Perform Ritual',
      description: 'Casting spells as rituals without a spell slot.',
    },
    failureMode: 'dangerous',
    dangerDescription: 'Ritual backlash causes 1d6 damage per spell level.',
    isActive: true,
    source: 'standard',
  },

  // Understanding siege tactics
  {
    id: 'siege_tactics',
    name: 'Siege Warfare',
    description: 'Understanding fortification weaknesses and siege equipment.',
    requirements: [
      { skillId: 'history', minProficiency: 'proficient' },
    ],
    requireAll: true,
    gatedContent: {
      type: 'information',
      id: 'siege_knowledge',
      name: 'Siege Information',
      description: 'Identifying weak points in fortifications.',
    },
    failureMode: 'increased_dc',
    dcIncrease: 5,
    isActive: true,
    source: 'standard',
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if content is gated and return result.
 */
export function checkContentGate(
  contentId: string,
  skills: CharacterSkills,
  gates: SkillGate[] = STANDARD_SKILL_GATES
): GateCheckResult | null {
  const engine = new SkillGateEngine()
  const relevantGates = engine.findGatesForContent(contentId, gates)

  if (relevantGates.length === 0) return null

  // Check the first (most restrictive) gate
  return engine.checkGate(relevantGates[0], skills)
}

/**
 * Check if a character can access gated content.
 */
export function canAccessContent(
  contentId: string,
  skills: CharacterSkills,
  gates: SkillGate[] = STANDARD_SKILL_GATES
): boolean {
  const result = checkContentGate(contentId, skills, gates)
  return result === null || result.canPass
}

/**
 * Get all content a character is blocked from.
 */
export function getBlockedContent(
  skills: CharacterSkills,
  gates: SkillGate[] = STANDARD_SKILL_GATES
): GateCheckResult[] {
  const engine = new SkillGateEngine()
  return engine.getBlockingGates(skills, gates)
}

// Singleton instance
export const skillGateEngine = new SkillGateEngine()
