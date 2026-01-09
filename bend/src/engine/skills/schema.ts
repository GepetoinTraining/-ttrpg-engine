/**
 * SKILL SYSTEM SCHEMA
 * ====================
 *
 * The 18 D&D 5e skills are the PERIODIC TABLE.
 * Players and DMs discover new skills through gameplay - the MOLECULES.
 *
 * Skills aren't chosen from a menu - they're BORN FROM ACTION.
 * The rogue who picks an ancient dwarven lock under pressure doesn't
 * just roll Sleight of Hand. They discover "Dwarven Lockcraft" -
 * a skill that remembers where it was born.
 *
 * CORE CONCEPTS:
 * - Core skills: 18 D&D 5e skills (immutable periodic table)
 * - Discovered: Emergent from gameplay (the molecules)
 * - Specialized: Deeper focus of a core skill
 * - Synergy: Combination of multiple skills unlocking new capabilities
 */

import { z } from 'zod'
import {
  SkillSchema as CoreSkillEnum,
  AbilitySchema,
  ProficiencyLevelSchema,
  type Skill as CoreSkill,
  type Ability,
  type ProficiencyLevel,
} from '../character/schema'

// Re-export for convenience
export { CoreSkillEnum, AbilitySchema, ProficiencyLevelSchema }
export type { CoreSkill, Ability, ProficiencyLevel }

// ============================================
// SKILL TYPES
// ============================================

/**
 * Classification of skills in the system.
 *
 * core       - D&D 5e's 18 base skills (immutable)
 * discovered - Emergent skills from gameplay
 * specialized - Deeper focus of a core skill
 * synergy    - Combination of multiple skills
 */
export const SkillTypeSchema = z.enum([
  'core',
  'discovered',
  'specialized',
  'synergy',
])
export type SkillType = z.infer<typeof SkillTypeSchema>

/**
 * Functional categories for skill organization.
 */
export const SkillCategorySchema = z.enum([
  'physical',    // STR/DEX/CON based
  'mental',      // INT/WIS based
  'social',      // CHA based
  'magical',     // Intersects with lore system
  'crafting',    // Making things
  'combat',      // Fighting techniques
  'exploration', // Navigating the world
])
export type SkillCategory = z.infer<typeof SkillCategorySchema>

// ============================================
// SKILL ORIGIN (provenance tracking)
// ============================================

/**
 * Every discovered skill remembers its birth.
 *
 * This is the narrative provenance - where, when, and how
 * a skill came into existence for a character.
 */
export const SkillOriginSchema = z.object({
  /** When the skill was discovered */
  discoveredAt: z.date(),

  /** Session where discovery occurred */
  sessionId: z.string().uuid().optional(),

  /** Action tags that triggered discovery */
  triggerTags: z.array(z.string()),

  /** Human-readable description of the triggering action */
  triggerAction: z.string(),

  /** Where in the world this happened */
  locationName: z.string().optional(),

  /**
   * Resonance: How significant was the discovery moment?
   * 1 = mundane discovery
   * 100 = legendary moment that echoes through the campaign
   */
  resonance: z.number().int().min(1).max(100),

  /** Additional narrative context */
  narrativeContext: z.string().optional(),

  /** DM's private notes about this discovery */
  dmNotes: z.string().optional(),
})
export type SkillOrigin = z.infer<typeof SkillOriginSchema>

// ============================================
// SKILL PREREQUISITES
// ============================================

/**
 * What must a character have before they can use/discover this skill?
 */
export const SkillPrerequisitesSchema = z.object({
  /** Required proficiency in core skills */
  coreSkillProficiency: z.record(
    CoreSkillEnum,
    ProficiencyLevelSchema
  ).optional(),

  /** Required level in discovered skills */
  discoveredSkillLevel: z.record(z.string(), z.number().int()).optional(),

  /** Required lore levels (from magic system) */
  loreLevel: z.record(z.string(), z.number().int()).optional(),

  /** Minimum character level */
  characterLevel: z.number().int().optional(),

  /** Required ability score minimums */
  abilityMinimum: z.record(AbilitySchema, z.number().int()).optional(),
})
export type SkillPrerequisites = z.infer<typeof SkillPrerequisitesSchema>

// ============================================
// DM APPROVAL STATUS
// ============================================

/**
 * Discovered skills require DM approval.
 * This maintains the tabletop RPG flow.
 */
export const SkillApprovalSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'modified']),
  reviewedAt: z.date().optional(),
  dmModifications: z.string().optional(),
  rejectionReason: z.string().optional(),
})
export type SkillApproval = z.infer<typeof SkillApprovalSchema>

// ============================================
// DISCOVERED SKILL DEFINITION
// ============================================

/**
 * A skill that emerged from gameplay.
 *
 * This is the "molecule" - a combination of core skill atoms
 * crystallized through player action and DM approval.
 */
export const DiscoveredSkillDefinitionSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Display name */
  name: z.string(),

  /** What this skill represents */
  description: z.string(),

  /** Classification */
  type: SkillTypeSchema,
  category: SkillCategorySchema,

  /**
   * Parent skills - what core/discovered skills this derives from.
   * At least one parent is required.
   */
  parentSkills: z.array(z.string()).min(1),

  /** Which ability score this skill scales with */
  scalingAbility: AbilitySchema,

  /**
   * Tags for discovery matching.
   * Used by the discovery engine to match actions to potential skills.
   */
  tags: z.array(z.string()),

  /** Requirements to use this skill */
  prerequisites: SkillPrerequisitesSchema.optional(),

  /** The story of how this skill was born */
  origin: SkillOriginSchema,

  /** DM approval tracking */
  approval: SkillApprovalSchema,

  /**
   * Scope - who can see/use this skill?
   * character = only this character
   * campaign = shared within campaign (once approved)
   * global = available to all campaigns (homebrew library)
   */
  scope: z.enum(['character', 'campaign', 'global']),

  /** Is this skill currently usable? */
  isActive: z.boolean().default(true),

  /**
   * Can this skill satisfy lore requirements for magic?
   * Maps skill to lore topics it can substitute for.
   */
  loreEquivalence: z.record(z.string(), z.number().int()).optional(),
})
export type DiscoveredSkillDefinition = z.infer<typeof DiscoveredSkillDefinitionSchema>

// ============================================
// CHARACTER SKILL ENTRY
// ============================================

/**
 * A character's proficiency and progress in a single skill.
 *
 * Uses sqrt(xp/100) progression - same as the lore system.
 * Level 1:  100 XP
 * Level 2:  400 XP
 * Level 3:  900 XP
 * Level 4: 1600 XP
 * Level 5: 2500 XP (mastery)
 */
export const SkillEntrySchema = z.object({
  /** ID of the skill (core skill name or discovered skill id) */
  skillId: z.string(),

  /** Experience points in this skill */
  xp: z.number().int().default(0),

  /**
   * Current level: floor(sqrt(xp / 100))
   * Cached for performance, recalculate on XP change
   */
  level: z.number().int().default(0),

  /** D&D 5e proficiency level */
  proficiency: ProficiencyLevelSchema,

  /** What granted this proficiency (class, background, feat, etc.) */
  proficiencySources: z.array(z.string()),

  // --- Usage Tracking ---

  /** How many times has this skill been rolled? */
  timesUsed: z.number().int().default(0),

  /** Last time this skill was used */
  lastUsedAt: z.date().optional(),

  /** Natural 20s with this skill */
  criticalSuccesses: z.number().int().default(0),

  /** Natural 1s with this skill */
  criticalFailures: z.number().int().default(0),

  /** Highest DC successfully beaten */
  highestDCBeaten: z.number().int().optional(),
})
export type SkillEntry = z.infer<typeof SkillEntrySchema>

// ============================================
// CHARACTER SKILLS STATE
// ============================================

/**
 * Complete skill state for a character.
 *
 * Maintains both the 18 core D&D skills and any discovered skills.
 */
export const CharacterSkillsSchema = z.object({
  /** Character this belongs to */
  characterId: z.string().uuid(),

  /**
   * Core skills - always present, all 18.
   * Key is the core skill name (acrobatics, arcana, etc.)
   */
  coreSkills: z.record(CoreSkillEnum, SkillEntrySchema),

  /**
   * Discovered skills - grows over time.
   * Key is the discovered skill ID.
   */
  discoveredSkills: z.record(z.string(), SkillEntrySchema),

  /**
   * Skill definitions for discovered skills.
   * Stored separately so definitions can be shared campaign-wide.
   */
  discoveredSkillDefinitions: z.record(z.string(), DiscoveredSkillDefinitionSchema),

  /**
   * Pending discoveries awaiting DM approval.
   */
  pendingDiscoveries: z.array(DiscoveredSkillDefinitionSchema),

  /**
   * Synergies this character has unlocked.
   * IDs of synergy definitions.
   */
  synergiesUnlocked: z.array(z.string()),

  /**
   * Total skill XP earned across all skills.
   * Useful for campaign metrics and achievements.
   */
  totalSkillXp: z.number().int().default(0),

  /** When the skill state was last updated */
  updatedAt: z.date(),
})
export type CharacterSkills = z.infer<typeof CharacterSkillsSchema>

// ============================================
// ACTION CONTEXT (for discovery engine)
// ============================================

/**
 * Context about an action a player is taking.
 * Used by the discovery engine to determine if a new skill should emerge.
 */
export const ActionContextSchema = z.object({
  /** Tags describing this action */
  tags: z.array(z.string()),

  /**
   * How significant is this action?
   * 1 = trivial, 100 = campaign-defining
   */
  magnitude: z.number().int().min(1).max(100),

  /** What skills were actually rolled */
  skillsUsed: z.array(z.string()),

  /** The dice roll result, if any */
  rollResult: z.object({
    total: z.number().int(),
    natural: z.number().int(),
    wasCritical: z.boolean(),
    wasFumble: z.boolean(),
  }).optional(),

  /** Session context */
  sessionId: z.string().uuid().optional(),

  /** Where in the world */
  locationName: z.string().optional(),

  /** What the player described they were doing */
  narrativeDescription: z.string().optional(),

  /** Character performing the action */
  characterId: z.string().uuid(),
})
export type ActionContext = z.infer<typeof ActionContextSchema>

// ============================================
// DISCOVERY RULE
// ============================================

/**
 * A rule that defines when a skill can be discovered.
 * DMs can define campaign-specific discovery rules.
 */
export const DiscoveryRuleSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Human-readable name */
  name: z.string(),

  /** Tags that MUST be present in the action */
  requiredTags: z.array(z.string()),

  /** Tags that increase discovery chance if present */
  bonusTags: z.array(z.string()).optional(),

  /** Tags that prevent this discovery */
  excludeTags: z.array(z.string()).optional(),

  /** Minimum magnitude required */
  minMagnitude: z.number().int().default(10),

  /** ID of the skill this discovers */
  resultSkillId: z.string(),

  /** Template for the discovered skill */
  resultSkillTemplate: DiscoveredSkillDefinitionSchema.partial(),

  /** Base percentage chance of discovery (0-100) */
  baseChance: z.number().int().min(0).max(100).default(25),

  /** Can each character only discover this once? */
  unique: z.boolean().default(true),

  /** Is this rule active? */
  isActive: z.boolean().default(true),
})
export type DiscoveryRule = z.infer<typeof DiscoveryRuleSchema>

// ============================================
// SKILL MODIFIER CALCULATION
// ============================================

/**
 * Components that contribute to a skill check modifier.
 * Kept separate for transparency in the UI.
 */
export const SkillModifierBreakdownSchema = z.object({
  /** The skill being checked */
  skillId: z.string(),

  /** Ability modifier contribution */
  abilityModifier: z.number().int(),
  abilityUsed: AbilitySchema,

  /** Proficiency contribution (0, half, full, or double) */
  proficiencyContribution: z.number().int(),
  proficiencyLevel: ProficiencyLevelSchema,

  /**
   * Skill level contribution (for discovered skills).
   * Each level adds +1, capped at +5.
   */
  skillLevelContribution: z.number().int(),

  /** Any additional bonuses (items, features, etc.) */
  miscBonuses: z.array(z.object({
    source: z.string(),
    value: z.number().int(),
  })),

  /** Final total modifier */
  totalModifier: z.number().int(),
})
export type SkillModifierBreakdown = z.infer<typeof SkillModifierBreakdownSchema>

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate skill level from XP using sqrt(xp/100) formula.
 * Same progression as the lore system.
 */
export function calculateSkillLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100))
}

/**
 * Calculate XP required for a given level.
 */
export function xpForLevel(level: number): number {
  return level * level * 100
}

/**
 * Calculate XP remaining until next level.
 */
export function xpToNextLevel(currentXp: number): number {
  const currentLevel = calculateSkillLevel(currentXp)
  return xpForLevel(currentLevel + 1) - currentXp
}

/**
 * Create an empty skill entry for a core skill.
 */
export function createCoreSkillEntry(
  skillId: CoreSkill,
  proficiency: ProficiencyLevel = 'none',
  sources: string[] = []
): SkillEntry {
  return {
    skillId,
    xp: 0,
    level: 0,
    proficiency,
    proficiencySources: sources,
    timesUsed: 0,
    criticalSuccesses: 0,
    criticalFailures: 0,
  }
}

/**
 * Create initial skill state for a new character.
 * Initializes all 18 core skills with no proficiency.
 */
export function createInitialCharacterSkills(characterId: string): CharacterSkills {
  const coreSkills: Record<string, SkillEntry> = {}

  const allCoreSkills: CoreSkill[] = [
    'acrobatics', 'animal_handling', 'arcana', 'athletics',
    'deception', 'history', 'insight', 'intimidation',
    'investigation', 'medicine', 'nature', 'perception',
    'performance', 'persuasion', 'religion', 'sleight_of_hand',
    'stealth', 'survival'
  ]

  for (const skill of allCoreSkills) {
    coreSkills[skill] = createCoreSkillEntry(skill)
  }

  return {
    characterId,
    coreSkills: coreSkills as Record<CoreSkill, SkillEntry>,
    discoveredSkills: {},
    discoveredSkillDefinitions: {},
    pendingDiscoveries: [],
    synergiesUnlocked: [],
    totalSkillXp: 0,
    updatedAt: new Date(),
  }
}

/**
 * Apply proficiencies from character creation sources.
 */
export function applyProficiencies(
  skills: CharacterSkills,
  proficiencies: { skill: CoreSkill; source: string }[],
  level: ProficiencyLevel = 'proficient'
): CharacterSkills {
  const updated = { ...skills, coreSkills: { ...skills.coreSkills } }

  for (const { skill, source } of proficiencies) {
    const entry = updated.coreSkills[skill]
    if (entry) {
      updated.coreSkills[skill] = {
        ...entry,
        proficiency: level,
        proficiencySources: [...entry.proficiencySources, source],
      }
    }
  }

  updated.updatedAt = new Date()
  return updated
}
