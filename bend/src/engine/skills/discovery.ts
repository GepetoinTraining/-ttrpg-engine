/**
 * SKILL DISCOVERY ENGINE
 * =======================
 *
 * Skills aren't chosen from a menu - they're BORN FROM ACTION.
 *
 * The discovery engine watches player actions and identifies when
 * the narrative conditions align for a new skill to emerge. This
 * is inspired by WSES's emergent skill system.
 *
 * DISCOVERY FLOW:
 * 1. Player performs action with tags
 * 2. Engine matches tags against discovery rules
 * 3. If matched, rolls for discovery (chance based on magnitude, crit, etc.)
 * 4. Creates pending skill for DM approval
 * 5. DM approves/modifies/rejects
 * 6. Skill is added to character (if approved)
 *
 * The system remembers WHERE and HOW each skill was born,
 * creating narrative provenance that makes each character unique.
 */

import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
  type ActionContext,
  type DiscoveredSkillDefinition,
  type DiscoveryRule,
  type CharacterSkills,
  type SkillEntry,
  type SkillOrigin,
  type SkillApproval,
  type CoreSkill,
  type Ability,
  DiscoveredSkillDefinitionSchema,
  SkillCategorySchema,
} from './schema'
import { matchTagsToCoreSkills, CORE_SKILLS } from './core-skills'
import { calculateSkillLevel } from './progression'

// ============================================
// DISCOVERY CONFIGURATION
// ============================================

export interface DiscoveryConfig {
  /** Base chance of discovery (0-100) */
  baseChance: number

  /** Bonus chance per matching bonus tag */
  bonusTagChance: number

  /** Bonus chance for critical success */
  criticalBonus: number

  /** Chance increase per 10 magnitude points */
  magnitudeBonus: number

  /** Minimum chance (floor) */
  minChance: number

  /** Maximum chance (ceiling) */
  maxChance: number

  /** Minimum magnitude required for any discovery */
  minMagnitude: number
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  baseChance: 25,
  bonusTagChance: 10,
  criticalBonus: 25,
  magnitudeBonus: 1,
  minChance: 5,
  maxChance: 95,
  minMagnitude: 10,
}

// ============================================
// DISCOVERY RESULT
// ============================================

/** Debug info about tag matching */
export const MatchInfoSchema = z.object({
  requiredTagsMatched: z.array(z.string()),
  bonusTagsMatched: z.array(z.string()),
  excludeTagsPresent: z.array(z.string()),
})
export type MatchInfo = z.infer<typeof MatchInfoSchema>

export const DiscoveryResultSchema = z.object({
  /** Did discovery occur? */
  discovered: z.boolean(),

  /** The discovered skill (if any) */
  skill: DiscoveredSkillDefinitionSchema.optional(),

  /** The rule that triggered discovery */
  matchedRule: z.string().optional(),

  /** Calculated discovery chance */
  chance: z.number(),

  /** The actual roll (0-100) */
  roll: z.number(),

  /** Why discovery failed (if it did) */
  failureReason: z.string().optional(),

  /** Debug info about tag matching */
  matchInfo: MatchInfoSchema.optional(),
})
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>

// ============================================
// DISCOVERY ENGINE
// ============================================

export class SkillDiscoveryEngine {
  constructor(
    private config: DiscoveryConfig = DEFAULT_DISCOVERY_CONFIG
  ) {}

  /**
   * Check if an action triggers skill discovery.
   */
  checkDiscovery(
    context: ActionContext,
    characterSkills: CharacterSkills,
    campaignRules: DiscoveryRule[]
  ): DiscoveryResult {
    // Validate minimum magnitude
    if (context.magnitude < this.config.minMagnitude) {
      return {
        discovered: false,
        chance: 0,
        roll: 0,
        failureReason: `Magnitude ${context.magnitude} below minimum ${this.config.minMagnitude}`,
      }
    }

    // Find matching rules
    const matchingRules = this.findMatchingRules(
      context,
      characterSkills,
      campaignRules
    )

    if (matchingRules.length === 0) {
      return {
        discovered: false,
        chance: 0,
        roll: 0,
        failureReason: 'No matching discovery rules',
      }
    }

    // Pick the best match (highest priority based on tag coverage)
    const bestMatch = this.prioritizeRules(matchingRules, context)[0]
    const rule = bestMatch.rule
    const matchInfo = bestMatch.matchInfo!

    // Calculate discovery chance
    const chance = this.calculateDiscoveryChance(
      rule,
      context,
      matchInfo.bonusTagsMatched.length
    )

    // Roll for discovery
    const roll = Math.random() * 100

    if (roll > chance) {
      return {
        discovered: false,
        chance,
        roll,
        matchedRule: rule.id,
        failureReason: `Roll ${roll.toFixed(1)} > chance ${chance.toFixed(1)}`,
        matchInfo,
      }
    }

    // Discovery succeeded! Create the skill
    const skill = this.createDiscoveredSkill(rule, context)

    return {
      discovered: true,
      skill,
      matchedRule: rule.id,
      chance,
      roll,
      matchInfo,
    }
  }

  /**
   * Find all rules that match the given action context.
   */
  private findMatchingRules(
    context: ActionContext,
    characterSkills: CharacterSkills,
    rules: DiscoveryRule[]
  ): { rule: DiscoveryRule; matchInfo: MatchInfo }[] {
    const matches: { rule: DiscoveryRule; matchInfo: MatchInfo }[] = []

    for (const rule of rules) {
      // Skip inactive rules
      if (!rule.isActive) continue

      // Check if character already has this skill (for unique skills)
      if (rule.unique) {
        const hasSkill = rule.resultSkillId in characterSkills.discoveredSkills ||
                        characterSkills.pendingDiscoveries.some(p => p.id === rule.resultSkillId)
        if (hasSkill) continue
      }

      // Check required tags
      const requiredMatches = rule.requiredTags.filter(tag =>
        context.tags.includes(tag)
      )
      if (requiredMatches.length !== rule.requiredTags.length) continue

      // Check exclude tags
      const excludeMatches = rule.excludeTags?.filter(tag =>
        context.tags.includes(tag)
      ) ?? []
      if (excludeMatches.length > 0) continue

      // Check minimum magnitude
      if (context.magnitude < rule.minMagnitude) continue

      // Check bonus tags
      const bonusMatches = rule.bonusTags?.filter(tag =>
        context.tags.includes(tag)
      ) ?? []

      matches.push({
        rule,
        matchInfo: {
          requiredTagsMatched: requiredMatches,
          bonusTagsMatched: bonusMatches,
          excludeTagsPresent: excludeMatches,
        },
      })
    }

    return matches
  }

  /**
   * Prioritize matched rules by coverage and specificity.
   */
  private prioritizeRules(
    matches: { rule: DiscoveryRule; matchInfo: MatchInfo }[],
    _context: ActionContext
  ): { rule: DiscoveryRule; matchInfo: MatchInfo }[] {
    void _context // Context may be used for future priority logic
    return matches.sort((a, b) => {
      // More required tags = more specific = higher priority
      const aRequired = a.rule.requiredTags.length
      const bRequired = b.rule.requiredTags.length
      if (aRequired !== bRequired) return bRequired - aRequired

      // More bonus tags matched = better fit
      const aBonus = a.matchInfo?.bonusTagsMatched.length ?? 0
      const bBonus = b.matchInfo?.bonusTagsMatched.length ?? 0
      if (aBonus !== bBonus) return bBonus - aBonus

      // Higher base chance = more likely to succeed
      return b.rule.baseChance - a.rule.baseChance
    })
  }

  /**
   * Calculate the chance of discovery.
   */
  private calculateDiscoveryChance(
    rule: DiscoveryRule,
    context: ActionContext,
    bonusTagCount: number
  ): number {
    let chance = rule.baseChance

    // Bonus tags increase chance
    chance += bonusTagCount * this.config.bonusTagChance

    // Critical success dramatically increases chance
    if (context.rollResult?.wasCritical) {
      chance += this.config.criticalBonus
    }

    // High magnitude increases chance
    chance += Math.floor(context.magnitude / 10) * this.config.magnitudeBonus

    // Clamp to min/max
    chance = Math.max(this.config.minChance, Math.min(this.config.maxChance, chance))

    return chance
  }

  /**
   * Create a discovered skill definition from a rule and context.
   */
  private createDiscoveredSkill(
    rule: DiscoveryRule,
    context: ActionContext
  ): DiscoveredSkillDefinition {
    const template = rule.resultSkillTemplate

    // Determine parent skills from the action's skills used
    let parentSkills = template.parentSkills ?? context.skillsUsed
    if (parentSkills.length === 0) {
      // Fall back to tag-based matching
      const matches = matchTagsToCoreSkills(context.tags)
      parentSkills = matches.slice(0, 2).map(m => m.skill)
    }
    if (parentSkills.length === 0) {
      parentSkills = ['investigation'] // Ultimate fallback
    }

    // Determine scaling ability
    let scalingAbility: Ability = template.scalingAbility ?? 'intelligence'
    if (!template.scalingAbility && parentSkills.length > 0) {
      // Use the first parent skill's ability
      const firstParent = parentSkills[0]
      const coreSkillData = CORE_SKILLS[firstParent as CoreSkill]
      if (coreSkillData) {
        scalingAbility = coreSkillData.ability
      }
    }

    // Calculate resonance from context magnitude and roll result
    let resonance = context.magnitude
    if (context.rollResult?.wasCritical) {
      resonance = Math.min(100, resonance + 25)
    }

    // Create the origin story
    const origin: SkillOrigin = {
      discoveredAt: new Date(),
      sessionId: context.sessionId,
      triggerTags: context.tags,
      triggerAction: context.narrativeDescription ?? `Used ${parentSkills.join(' and ')}`,
      locationName: context.locationName,
      resonance,
      narrativeContext: context.narrativeDescription,
    }

    // Create approval status (pending by default)
    const approval: SkillApproval = {
      status: 'pending',
    }

    // Build the skill
    const skill: DiscoveredSkillDefinition = {
      id: template.id ?? rule.resultSkillId ?? randomUUID(),
      name: template.name ?? this.generateSkillName(context, parentSkills),
      description: template.description ?? this.generateDescription(context, parentSkills),
      type: template.type ?? 'discovered',
      category: template.category ?? this.inferCategory(parentSkills),
      parentSkills,
      scalingAbility,
      tags: [...(template.tags ?? []), ...context.tags],
      prerequisites: template.prerequisites,
      origin,
      approval,
      scope: template.scope ?? 'character',
      isActive: true,
      loreEquivalence: template.loreEquivalence,
    }

    return skill
  }

  /**
   * Generate a skill name from context.
   */
  private generateSkillName(
    actionContext: ActionContext,
    parentSkills: string[]
  ): string {
    const context = actionContext
    // Try to create a meaningful name from tags
    const meaningfulTags = context.tags.filter(tag =>
      !['action', 'skill', 'check', 'roll'].includes(tag)
    )

    if (meaningfulTags.length >= 2) {
      // Combine two most relevant tags
      const capitalized = meaningfulTags.slice(0, 2).map(t =>
        t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')
      )
      return capitalized.join(' ')
    }

    if (meaningfulTags.length === 1) {
      const tag = meaningfulTags[0]
      return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/_/g, ' ')
    }

    // Fall back to parent skill based name
    if (parentSkills.length > 0) {
      const parent = parentSkills[0]
      return `Advanced ${parent.charAt(0).toUpperCase() + parent.slice(1).replace(/_/g, ' ')}`
    }

    return 'Discovered Skill'
  }

  /**
   * Generate a description from context.
   */
  private generateDescription(
    context: ActionContext,
    parentSkills: string[]
  ): string {
    const parentNames = parentSkills.map(p =>
      p.replace(/_/g, ' ')
    ).join(' and ')

    if (context.narrativeDescription) {
      return `A specialized skill developed from ${parentNames}. Discovered while ${context.narrativeDescription.toLowerCase()}.`
    }

    if (context.locationName) {
      return `A specialized skill developed from ${parentNames}. First manifested in ${context.locationName}.`
    }

    return `A specialized application of ${parentNames}, discovered through practical experience.`
  }

  /**
   * Infer category from parent skills.
   */
  private inferCategory(parentSkills: string[]): z.infer<typeof SkillCategorySchema> {
    if (parentSkills.length === 0) return 'mental'

    const firstParent = parentSkills[0]
    const coreSkillData = CORE_SKILLS[firstParent as CoreSkill]
    if (coreSkillData) {
      return coreSkillData.category
    }

    return 'mental'
  }
}

// ============================================
// DEFAULT DISCOVERY RULES
// ============================================

/**
 * Standard discovery rules that can be used in any campaign.
 * DMs can add campaign-specific rules on top of these.
 */
export const STANDARD_DISCOVERY_RULES: DiscoveryRule[] = [
  // Dwarven Lockcraft - picking ancient dwarven locks
  {
    id: 'dwarven_lockcraft',
    name: 'Dwarven Lockcraft',
    requiredTags: ['lockpicking', 'dwarven'],
    bonusTags: ['ancient', 'pressure', 'mechanical'],
    minMagnitude: 50,
    resultSkillId: 'dwarven_lockcraft',
    resultSkillTemplate: {
      name: 'Dwarven Lockcraft',
      description: 'Expertise in the intricate mechanical locks crafted by dwarven smiths.',
      type: 'specialized',
      category: 'physical',
      parentSkills: ['sleight_of_hand', 'investigation'],
      scalingAbility: 'intelligence',
      tags: ['lockpicking', 'dwarven', 'mechanical', 'ancient'],
    },
    baseChance: 25,
    unique: true,
    isActive: true,
  },

  // Elvish Pathfinding - navigating ancient elven forests
  {
    id: 'elvish_pathfinding',
    name: 'Elvish Pathfinding',
    requiredTags: ['navigation', 'forest', 'elven'],
    bonusTags: ['ancient', 'fey', 'magical'],
    minMagnitude: 40,
    resultSkillId: 'elvish_pathfinding',
    resultSkillTemplate: {
      name: 'Elvish Pathfinding',
      description: 'The art of navigating enchanted forests using subtle natural signs.',
      type: 'specialized',
      category: 'exploration',
      parentSkills: ['survival', 'nature'],
      scalingAbility: 'wisdom',
      tags: ['navigation', 'forest', 'elven', 'natural'],
    },
    baseChance: 30,
    unique: true,
    isActive: true,
  },

  // Tactical Medicine - healing under combat pressure
  {
    id: 'tactical_medicine',
    name: 'Tactical Medicine',
    requiredTags: ['healing', 'combat', 'pressure'],
    bonusTags: ['triage', 'stabilize', 'emergency'],
    minMagnitude: 60,
    resultSkillId: 'tactical_medicine',
    resultSkillTemplate: {
      name: 'Tactical Medicine',
      description: 'The ability to provide critical medical care in the chaos of battle.',
      type: 'specialized',
      category: 'mental',
      parentSkills: ['medicine', 'perception'],
      scalingAbility: 'wisdom',
      tags: ['healing', 'combat', 'triage', 'emergency'],
    },
    baseChance: 20,
    unique: true,
    isActive: true,
  },

  // Court Intrigue - navigating noble politics
  {
    id: 'court_intrigue',
    name: 'Court Intrigue',
    requiredTags: ['noble', 'politics', 'social'],
    bonusTags: ['deception', 'persuasion', 'etiquette', 'royal'],
    minMagnitude: 45,
    resultSkillId: 'court_intrigue',
    resultSkillTemplate: {
      name: 'Court Intrigue',
      description: 'Mastery of the subtle games played in noble courts.',
      type: 'specialized',
      category: 'social',
      parentSkills: ['persuasion', 'insight'],
      scalingAbility: 'charisma',
      tags: ['noble', 'politics', 'social', 'manipulation'],
    },
    baseChance: 25,
    unique: true,
    isActive: true,
  },

  // Arcane Forensics - investigating magical crime scenes
  {
    id: 'arcane_forensics',
    name: 'Arcane Forensics',
    requiredTags: ['investigation', 'magic', 'trace'],
    bonusTags: ['detect', 'analyze', 'residue', 'arcane'],
    minMagnitude: 55,
    resultSkillId: 'arcane_forensics',
    resultSkillTemplate: {
      name: 'Arcane Forensics',
      description: 'The ability to detect and analyze traces of magical activity.',
      type: 'specialized',
      category: 'magical',
      parentSkills: ['arcana', 'investigation'],
      scalingAbility: 'intelligence',
      tags: ['investigation', 'magic', 'arcane', 'detect'],
      loreEquivalence: {
        'magical_forensics': 3,
      },
    },
    baseChance: 20,
    unique: true,
    isActive: true,
  },

  // Monster Lore - specialized knowledge of creature types
  {
    id: 'monster_lore',
    name: 'Monster Lore',
    requiredTags: ['creature', 'identify', 'weakness'],
    bonusTags: ['combat', 'behavior', 'habitat', 'anatomy'],
    minMagnitude: 50,
    resultSkillId: 'monster_lore',
    resultSkillTemplate: {
      name: 'Monster Lore',
      description: 'Deep knowledge of creatures, their weaknesses and behaviors.',
      type: 'specialized',
      category: 'mental',
      parentSkills: ['nature', 'arcana'],
      scalingAbility: 'intelligence',
      tags: ['creature', 'monster', 'weakness', 'knowledge'],
    },
    baseChance: 30,
    unique: true,
    isActive: true,
  },

  // Underworld Connections - knowing the criminal underground
  {
    id: 'underworld_connections',
    name: 'Underworld Connections',
    requiredTags: ['criminal', 'network', 'underground'],
    bonusTags: ['thieves_guild', 'black_market', 'smuggling', 'fence'],
    minMagnitude: 45,
    resultSkillId: 'underworld_connections',
    resultSkillTemplate: {
      name: 'Underworld Connections',
      description: 'Knowledge of and contacts within the criminal underground.',
      type: 'specialized',
      category: 'social',
      parentSkills: ['deception', 'persuasion'],
      scalingAbility: 'charisma',
      tags: ['criminal', 'network', 'underground', 'contacts'],
    },
    baseChance: 25,
    unique: true,
    isActive: true,
  },

  // Siege Engineering - understanding fortifications
  {
    id: 'siege_engineering',
    name: 'Siege Engineering',
    requiredTags: ['fortification', 'siege', 'structure'],
    bonusTags: ['weak_point', 'defense', 'construction', 'military'],
    minMagnitude: 60,
    resultSkillId: 'siege_engineering',
    resultSkillTemplate: {
      name: 'Siege Engineering',
      description: 'Knowledge of fortifications, siege weapons, and structural weaknesses.',
      type: 'specialized',
      category: 'mental',
      parentSkills: ['investigation', 'history'],
      scalingAbility: 'intelligence',
      tags: ['fortification', 'siege', 'military', 'construction'],
    },
    baseChance: 20,
    unique: true,
    isActive: true,
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Add a discovered skill to character skills (pending approval).
 */
export function addPendingDiscovery(
  skills: CharacterSkills,
  discovery: DiscoveredSkillDefinition
): CharacterSkills {
  return {
    ...skills,
    pendingDiscoveries: [...skills.pendingDiscoveries, discovery],
    updatedAt: new Date(),
  }
}

/**
 * Approve a pending discovery and add to character.
 */
export function approveDiscovery(
  skills: CharacterSkills,
  discoveryId: string,
  dmModifications?: Partial<DiscoveredSkillDefinition>
): CharacterSkills {
  const pendingIndex = skills.pendingDiscoveries.findIndex(d => d.id === discoveryId)
  if (pendingIndex === -1) {
    throw new Error(`Pending discovery ${discoveryId} not found`)
  }

  let discovery = skills.pendingDiscoveries[pendingIndex]

  // Apply DM modifications if any
  if (dmModifications) {
    discovery = { ...discovery, ...dmModifications }
  }

  // Update approval status
  discovery = {
    ...discovery,
    approval: {
      status: 'approved',
      reviewedAt: new Date(),
      dmModifications: dmModifications ? JSON.stringify(dmModifications) : undefined,
    },
  }

  // Create skill entry
  const skillEntry: SkillEntry = {
    skillId: discovery.id,
    xp: Math.floor(discovery.origin.resonance), // Initial XP from resonance
    level: calculateSkillLevel(discovery.origin.resonance),
    proficiency: 'none', // Discovered skills start with no proficiency
    proficiencySources: [],
    timesUsed: 0,
    criticalSuccesses: 0,
    criticalFailures: 0,
  }

  // Remove from pending, add to discovered
  const pendingDiscoveries = [...skills.pendingDiscoveries]
  pendingDiscoveries.splice(pendingIndex, 1)

  return {
    ...skills,
    discoveredSkills: {
      ...skills.discoveredSkills,
      [discovery.id]: skillEntry,
    },
    discoveredSkillDefinitions: {
      ...skills.discoveredSkillDefinitions,
      [discovery.id]: discovery,
    },
    pendingDiscoveries,
    totalSkillXp: skills.totalSkillXp + skillEntry.xp,
    updatedAt: new Date(),
  }
}

/**
 * Reject a pending discovery.
 */
export function rejectDiscovery(
  skills: CharacterSkills,
  discoveryId: string,
  _reason: string
): CharacterSkills {
  const pendingIndex = skills.pendingDiscoveries.findIndex(d => d.id === discoveryId)
  if (pendingIndex === -1) {
    throw new Error(`Pending discovery ${discoveryId} not found: ${_reason}`)
  }

  // Remove from pending (could optionally keep with rejected status)
  const pendingDiscoveries = [...skills.pendingDiscoveries]
  pendingDiscoveries.splice(pendingIndex, 1)

  return {
    ...skills,
    pendingDiscoveries,
    updatedAt: new Date(),
  }
}

// Singleton instance with default config
export const skillDiscovery = new SkillDiscoveryEngine()
