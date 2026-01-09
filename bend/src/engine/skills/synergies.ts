/**
 * SKILL SYNERGIES
 * =================
 *
 * When skills combine, new capabilities emerge.
 * Synergies are the BONDS between skill atoms.
 *
 * A synergy isn't just a stat bonus - it unlocks new ACTIONS.
 * The rogue with Stealth + Sleight of Hand can now
 * "Pickpocket while remaining hidden" - an action neither
 * skill enables alone.
 *
 * Synergies are tracked separately from skills because:
 * 1. They're unlocked, not trained
 * 2. They don't have XP progression
 * 3. They grant capabilities, not modifiers
 * 4. They can gate content (like lore gates magic)
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
// SYNERGY REQUIREMENT
// ============================================

/**
 * A single skill requirement for a synergy.
 */
export const SynergyRequirementSchema = z.object({
  /** Skill ID (core or discovered) */
  skillId: z.string(),

  /** Minimum level required (for discovered skills) */
  minLevel: z.number().int().min(0).optional(),

  /** Minimum proficiency required */
  minProficiency: ProficiencyLevelSchema.optional(),
})
export type SynergyRequirement = z.infer<typeof SynergyRequirementSchema>

// ============================================
// SYNERGY GRANTS
// ============================================

/**
 * What a synergy unlocks when achieved.
 */
export const SynergyGrantsSchema = z.object({
  /** Name of the capability */
  capability: z.string(),

  /** Description of what you can now do */
  capabilityDescription: z.string(),

  /** Bonus to combined skill checks (if applicable) */
  combinedBonus: z.number().int().optional(),

  /** New actions this synergy enables */
  newActions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    actionType: z.enum(['action', 'bonus_action', 'reaction', 'free']),
  })).optional(),

  /** Skill gates this synergy unlocks */
  gatesUnlocked: z.array(z.string()).optional(),

  /** Advantage on specific check types */
  advantageOn: z.array(z.string()).optional(),

  /** Can reroll specific failures */
  canReroll: z.array(z.string()).optional(),
})
export type SynergyGrants = z.infer<typeof SynergyGrantsSchema>

// ============================================
// SYNERGY DEFINITION
// ============================================

/**
 * A synergy between two or more skills.
 */
export const SynergySchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Display name */
  name: z.string(),

  /** What this synergy represents */
  description: z.string(),

  /**
   * Skills required (must have at least 2).
   * All requirements must be met.
   */
  requiredSkills: z.array(SynergyRequirementSchema).min(2),

  /** What the synergy grants */
  grants: SynergyGrantsSchema,

  /** Is this synergy active? */
  isActive: z.boolean().default(true),

  /** Source (standard, homebrew, campaign-specific) */
  source: z.string().optional(),
})
export type Synergy = z.infer<typeof SynergySchema>

// ============================================
// SYNERGY CHECK RESULT
// ============================================

export const SynergyCheckResultSchema = z.object({
  /** The synergy being checked */
  synergy: SynergySchema,

  /** Is the synergy unlocked? */
  unlocked: z.boolean(),

  /** Which requirements are met */
  requirementsMet: z.array(z.object({
    requirement: SynergyRequirementSchema,
    met: z.boolean(),
    currentLevel: z.number().int(),
    currentProficiency: ProficiencyLevelSchema.optional(),
    reason: z.string().optional(),
  })),

  /** Overall progress (0-100%) */
  progress: z.number(),
})
export type SynergyCheckResult = z.infer<typeof SynergyCheckResultSchema>

// ============================================
// SYNERGY ENGINE
// ============================================

export class SynergyEngine {
  /**
   * Check if a character has unlocked a synergy.
   */
  checkSynergy(
    synergy: Synergy,
    skills: CharacterSkills
  ): SynergyCheckResult {
    const requirementsMet: SynergyCheckResult['requirementsMet'] = []
    let metCount = 0

    for (const req of synergy.requiredSkills) {
      const result = this.checkRequirement(req, skills)
      requirementsMet.push(result)
      if (result.met) metCount++
    }

    const progress = (metCount / synergy.requiredSkills.length) * 100
    const unlocked = metCount === synergy.requiredSkills.length

    return {
      synergy,
      unlocked,
      requirementsMet,
      progress,
    }
  }

  /**
   * Check a single requirement against character skills.
   */
  private checkRequirement(
    req: SynergyRequirement,
    skills: CharacterSkills
  ): SynergyCheckResult['requirementsMet'][0] {
    // Check if it's a core skill
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
   * Evaluate an entry against a requirement.
   */
  private evaluateEntry(
    req: SynergyRequirement,
    entry: SkillEntry
  ): SynergyCheckResult['requirementsMet'][0] {
    const currentLevel = entry.level
    const currentProficiency = entry.proficiency

    let met = true
    let reason: string | undefined

    // Check level requirement
    if (req.minLevel !== undefined && req.minLevel > 0 && currentLevel < req.minLevel) {
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
   * Get all synergies a character has unlocked.
   */
  getUnlockedSynergies(
    skills: CharacterSkills,
    availableSynergies: Synergy[]
  ): Synergy[] {
    const unlocked: Synergy[] = []

    for (const synergy of availableSynergies) {
      if (!synergy.isActive) continue

      const result = this.checkSynergy(synergy, skills)
      if (result.unlocked) {
        unlocked.push(synergy)
      }
    }

    return unlocked
  }

  /**
   * Get synergies in progress (partially met requirements).
   */
  getSynergiesInProgress(
    skills: CharacterSkills,
    availableSynergies: Synergy[]
  ): SynergyCheckResult[] {
    const inProgress: SynergyCheckResult[] = []

    for (const synergy of availableSynergies) {
      if (!synergy.isActive) continue

      const result = this.checkSynergy(synergy, skills)
      if (!result.unlocked && result.progress > 0) {
        inProgress.push(result)
      }
    }

    // Sort by progress (closest to unlocking first)
    return inProgress.sort((a, b) => b.progress - a.progress)
  }
}

// ============================================
// STANDARD SYNERGIES
// ============================================

/**
 * Standard synergies available in any D&D 5e campaign.
 * These represent common skill combinations.
 */
export const STANDARD_SYNERGIES: Synergy[] = [
  // Combat synergies
  {
    id: 'tactical_medicine',
    name: 'Tactical Medicine',
    description: 'Combat awareness combined with healing knowledge allows rapid field triage.',
    requiredSkills: [
      { skillId: 'medicine', minProficiency: 'proficient' },
      { skillId: 'perception', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Combat Triage',
      capabilityDescription: 'Stabilize as a bonus action when within 30 feet of the target.',
      combinedBonus: 2,
      newActions: [
        {
          name: 'Quick Stabilize',
          description: 'Use a bonus action to stabilize a creature within 30 feet.',
          actionType: 'bonus_action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'ambush_predator',
    name: 'Ambush Predator',
    description: 'The perfect combination of stealth and observation for deadly ambushes.',
    requiredSkills: [
      { skillId: 'stealth', minProficiency: 'proficient' },
      { skillId: 'perception', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Perfect Ambush',
      capabilityDescription: 'Advantage on initiative when attacking from hiding.',
      advantageOn: ['initiative when hidden'],
      newActions: [
        {
          name: 'Setup Ambush',
          description: 'Spend 1 minute to prepare an ambush position, granting advantage on the first attack.',
          actionType: 'action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  // Investigation synergies
  {
    id: 'arcane_investigation',
    name: 'Arcane Investigation',
    description: 'Magical knowledge enhances investigative insight, revealing hidden arcane traces.',
    requiredSkills: [
      { skillId: 'arcana', minLevel: 2 },
      { skillId: 'investigation', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Detect Magic Traces',
      capabilityDescription: 'Detect residual magic from the last 24 hours without using a spell slot.',
      gatesUnlocked: ['magical_forensics'],
      newActions: [
        {
          name: 'Trace Magic',
          description: 'Spend 10 minutes to detect magical residue from the past 24 hours.',
          actionType: 'action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'crime_scene_analysis',
    name: 'Crime Scene Analysis',
    description: 'Keen perception combined with analytical thinking reveals what others miss.',
    requiredSkills: [
      { skillId: 'perception', minProficiency: 'proficient' },
      { skillId: 'investigation', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Scene Reconstruction',
      capabilityDescription: 'Spend 10 minutes to reconstruct events from a scene.',
      combinedBonus: 2,
      newActions: [
        {
          name: 'Reconstruct Events',
          description: 'Analyze a scene to understand what happened in the last 24 hours.',
          actionType: 'action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  // Social synergies
  {
    id: 'master_manipulator',
    name: 'Master Manipulator',
    description: 'Reading people and deceiving them work hand in hand.',
    requiredSkills: [
      { skillId: 'insight', minProficiency: 'proficient' },
      { skillId: 'deception', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Exploit Weakness',
      capabilityDescription: 'After succeeding on an Insight check, gain advantage on the next Deception check against that creature.',
      advantageOn: ['deception after successful insight'],
      combinedBonus: 2,
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'crowd_control',
    name: 'Crowd Control',
    description: 'Performance skills combined with persuasion allow manipulation of groups.',
    requiredSkills: [
      { skillId: 'performance', minProficiency: 'proficient' },
      { skillId: 'persuasion', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Sway the Crowd',
      capabilityDescription: 'Attempt to shift the attitude of a crowd (up to 50 people) with a single check.',
      newActions: [
        {
          name: 'Crowd Speech',
          description: 'Spend 1 minute addressing a crowd to shift their attitude one step.',
          actionType: 'action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'silver_tongue',
    name: 'Silver Tongue',
    description: 'Intimidation backed by persuasion creates irresistible pressure.',
    requiredSkills: [
      { skillId: 'intimidation', minProficiency: 'proficient' },
      { skillId: 'persuasion', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Good Cop Bad Cop',
      capabilityDescription: 'Switch between intimidation and persuasion without resetting social encounter progress.',
      combinedBonus: 2,
      canReroll: ['intimidation', 'persuasion'],
    },
    isActive: true,
    source: 'standard',
  },

  // Exploration synergies
  {
    id: 'master_tracker',
    name: 'Master Tracker',
    description: 'Survival instincts combined with investigative skills make you an unmatched tracker.',
    requiredSkills: [
      { skillId: 'survival', minProficiency: 'proficient' },
      { skillId: 'investigation', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Persistent Tracking',
      capabilityDescription: 'Can track creatures up to 7 days after they passed, even through weather.',
      combinedBonus: 2,
      newActions: [
        {
          name: 'Deep Track',
          description: 'Spend 10 minutes to find tracks up to 7 days old.',
          actionType: 'action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'beast_whisperer',
    name: 'Beast Whisperer',
    description: 'Understanding animal behavior and nature as a whole.',
    requiredSkills: [
      { skillId: 'animal_handling', minProficiency: 'proficient' },
      { skillId: 'nature', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Animal Empathy',
      capabilityDescription: 'Communicate simple ideas with beasts, and sense their emotional state.',
      newActions: [
        {
          name: 'Beast Sense',
          description: 'Understand a beast\'s current emotional state and basic intent.',
          actionType: 'free',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  // Thievery synergies
  {
    id: 'master_infiltrator',
    name: 'Master Infiltrator',
    description: 'Stealth and sleight of hand combine for perfect infiltration.',
    requiredSkills: [
      { skillId: 'stealth', minProficiency: 'proficient' },
      { skillId: 'sleight_of_hand', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Ghost Touch',
      capabilityDescription: 'Pick pockets or plant items while remaining hidden.',
      combinedBonus: 2,
      newActions: [
        {
          name: 'Hidden Lift',
          description: 'Attempt Sleight of Hand without breaking Stealth.',
          actionType: 'action',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'cat_burglar',
    name: 'Cat Burglar',
    description: 'Acrobatics and stealth make you nearly impossible to catch.',
    requiredSkills: [
      { skillId: 'acrobatics', minProficiency: 'proficient' },
      { skillId: 'stealth', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Silent Movement',
      capabilityDescription: 'No penalty to Stealth while climbing or moving through difficult terrain.',
      newActions: [
        {
          name: 'Quick Escape',
          description: 'Use a reaction to attempt to hide after an acrobatic maneuver.',
          actionType: 'reaction',
        },
      ],
    },
    isActive: true,
    source: 'standard',
  },

  // Knowledge synergies
  {
    id: 'loremaster',
    name: 'Loremaster',
    description: 'Deep historical and arcane knowledge combine for comprehensive understanding.',
    requiredSkills: [
      { skillId: 'history', minProficiency: 'proficient' },
      { skillId: 'arcana', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Ancient Secrets',
      capabilityDescription: 'Can attempt to recall information about ancient magical artifacts and their history.',
      gatesUnlocked: ['ancient_lore'],
      combinedBonus: 2,
    },
    isActive: true,
    source: 'standard',
  },

  {
    id: 'theologian',
    name: 'Theologian',
    description: 'Deep religious knowledge combined with historical understanding.',
    requiredSkills: [
      { skillId: 'religion', minProficiency: 'proficient' },
      { skillId: 'history', minProficiency: 'proficient' },
    ],
    grants: {
      capability: 'Divine Lore',
      capabilityDescription: 'Identify religious artifacts and understand ancient religious texts.',
      gatesUnlocked: ['divine_history'],
      combinedBonus: 2,
    },
    isActive: true,
    source: 'standard',
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Update character's unlocked synergies.
 */
export function updateCharacterSynergies(
  skills: CharacterSkills,
  availableSynergies: Synergy[]
): CharacterSkills {
  const engine = new SynergyEngine()
  const unlocked = engine.getUnlockedSynergies(skills, availableSynergies)

  return {
    ...skills,
    synergiesUnlocked: unlocked.map(s => s.id),
    updatedAt: new Date(),
  }
}

/**
 * Check if a character has a specific synergy.
 */
export function hasSynergy(
  skills: CharacterSkills,
  synergyId: string
): boolean {
  return skills.synergiesUnlocked.includes(synergyId)
}

/**
 * Get synergy by ID.
 */
export function getSynergyById(
  synergyId: string,
  synergies: Synergy[] = STANDARD_SYNERGIES
): Synergy | undefined {
  return synergies.find(s => s.id === synergyId)
}

// Singleton instance
export const synergyEngine = new SynergyEngine()
