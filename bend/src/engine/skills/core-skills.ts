/**
 * CORE SKILLS - The Periodic Table
 * ==================================
 *
 * The 18 D&D 5e skills are IMMUTABLE.
 * They are the atoms from which all discovered skills are composed.
 *
 * Each skill includes:
 * - Metadata for UI display
 * - Category for organization
 * - Tags for discovery matching
 * - Lore equivalence for magic integration
 */

import { z } from 'zod'
import {
  type CoreSkill,
  type Ability,
  type SkillCategory,
  SkillCategorySchema,
} from './schema'

// ============================================
// CORE SKILL METADATA
// ============================================

export const CoreSkillMetadataSchema = z.object({
  /** The skill identifier */
  id: z.string(),

  /** Display name */
  name: z.string(),

  /** Description of what this skill covers */
  description: z.string(),

  /** Primary ability score */
  ability: z.enum([
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma'
  ]),

  /** Functional category */
  category: SkillCategorySchema,

  /**
   * Tags for discovery matching.
   * Actions with these tags can evolve into specialized skills.
   */
  tags: z.array(z.string()),

  /**
   * Lore topics this skill can partially satisfy.
   * Key is lore topic, value is max level it can substitute.
   */
  loreEquivalence: z.record(z.string(), z.number().int()).optional(),

  /**
   * Example uses from PHB.
   */
  examples: z.array(z.string()),
})
export type CoreSkillMetadata = z.infer<typeof CoreSkillMetadataSchema>

// ============================================
// THE 18 CORE SKILLS
// ============================================

export const CORE_SKILLS: Record<CoreSkill, CoreSkillMetadata> = {
  // ==========================================
  // STRENGTH SKILLS
  // ==========================================

  athletics: {
    id: 'athletics',
    name: 'Athletics',
    description: 'Covers difficult situations you encounter while climbing, jumping, or swimming.',
    ability: 'strength',
    category: 'physical',
    tags: [
      'climbing', 'jumping', 'swimming', 'running',
      'grappling', 'shoving', 'lifting', 'carrying',
      'physical_endurance', 'scaling', 'leaping'
    ],
    examples: [
      'Climb a sheer cliff',
      'Cling to a surface while something tries to knock you off',
      'Jump an unusually long distance',
      'Struggle free from a grapple'
    ],
  },

  // ==========================================
  // DEXTERITY SKILLS
  // ==========================================

  acrobatics: {
    id: 'acrobatics',
    name: 'Acrobatics',
    description: 'Covers your attempt to stay on your feet in tricky situations.',
    ability: 'dexterity',
    category: 'physical',
    tags: [
      'balance', 'tumbling', 'diving', 'rolling',
      'flipping', 'contortion', 'slipping', 'landing',
      'equilibrium', 'agility', 'grace'
    ],
    examples: [
      'Stay on your feet on a treacherous surface',
      'Perform acrobatic stunts',
      'Dive and roll to reduce fall damage',
      'Squeeze through tight spaces'
    ],
  },

  sleight_of_hand: {
    id: 'sleight_of_hand',
    name: 'Sleight of Hand',
    description: 'Whenever you attempt an act of legerdemain or manual trickery.',
    ability: 'dexterity',
    category: 'physical',
    tags: [
      'pickpocket', 'palm', 'conceal', 'plant',
      'lockpicking', 'disarm_trap', 'finesse', 'dexterity',
      'theft', 'misdirection', 'prestidigitation'
    ],
    examples: [
      'Plant something on someone',
      'Conceal an object on your person',
      'Pick a pocket',
      'Pick a lock or disarm a trap'
    ],
  },

  stealth: {
    id: 'stealth',
    name: 'Stealth',
    description: 'Allows you to conceal yourself from enemies and sneak past guards.',
    ability: 'dexterity',
    category: 'exploration',
    tags: [
      'hiding', 'sneaking', 'silent', 'invisible',
      'shadows', 'concealment', 'ambush', 'infiltration',
      'undetected', 'covert', 'stalking'
    ],
    examples: [
      'Slip past a guard unnoticed',
      'Hide from enemies',
      'Move silently through a forest',
      'Set up an ambush'
    ],
  },

  // ==========================================
  // INTELLIGENCE SKILLS
  // ==========================================

  arcana: {
    id: 'arcana',
    name: 'Arcana',
    description: 'Measures your ability to recall lore about spells, magic items, and planes of existence.',
    ability: 'intelligence',
    category: 'magical',
    tags: [
      'magic', 'spells', 'enchantment', 'conjuration',
      'planar', 'arcane', 'wizard', 'runes',
      'magical_theory', 'eldritch', 'mystical'
    ],
    loreEquivalence: {
      'arcane_theory': 3,
      'metamagic': 2,
      'planar_knowledge': 2,
    },
    examples: [
      'Identify a spell being cast',
      'Recall lore about magical traditions',
      'Recognize a magic item',
      'Know about planes of existence'
    ],
  },

  history: {
    id: 'history',
    name: 'History',
    description: 'Measures your ability to recall lore about historical events and people.',
    ability: 'intelligence',
    category: 'mental',
    tags: [
      'past', 'lore', 'ancient', 'civilization',
      'war', 'kingdom', 'dynasty', 'chronicle',
      'legend', 'artifact', 'genealogy'
    ],
    loreEquivalence: {
      'historical_magic': 2,
      'ancient_civilizations': 3,
    },
    examples: [
      'Recall significant historical events',
      'Know about legendary people',
      'Recognize ancient symbols',
      'Know the history of a kingdom'
    ],
  },

  investigation: {
    id: 'investigation',
    name: 'Investigation',
    description: 'When you look for clues and make deductions based on those clues.',
    ability: 'intelligence',
    category: 'mental',
    tags: [
      'clues', 'deduction', 'search', 'examine',
      'analyze', 'deduce', 'forensic', 'inspect',
      'study', 'uncover', 'detect'
    ],
    examples: [
      'Deduce the location of a hidden object',
      'Find a hidden compartment',
      'Determine what kind of weapon caused a wound',
      'Find a weak point in a structure'
    ],
  },

  nature: {
    id: 'nature',
    name: 'Nature',
    description: 'Measures your ability to recall lore about terrain, plants, animals, and weather.',
    ability: 'intelligence',
    category: 'exploration',
    tags: [
      'flora', 'fauna', 'terrain', 'weather',
      'beast', 'plant', 'ecosystem', 'natural',
      'wilderness', 'seasonal', 'elemental'
    ],
    loreEquivalence: {
      'nature_magic': 3,
      'elemental_theory': 2,
    },
    examples: [
      'Recall lore about terrain',
      'Identify plants and animals',
      'Predict weather patterns',
      'Know about natural hazards'
    ],
  },

  religion: {
    id: 'religion',
    name: 'Religion',
    description: 'Measures your ability to recall lore about deities, rites, and religious hierarchies.',
    ability: 'intelligence',
    category: 'mental',
    tags: [
      'deity', 'divine', 'faith', 'ritual',
      'prayer', 'clergy', 'sacred', 'profane',
      'cult', 'undead', 'celestial', 'fiend'
    ],
    loreEquivalence: {
      'divine_magic': 3,
      'planar_knowledge': 2,
      'undead_lore': 2,
    },
    examples: [
      'Recall lore about deities',
      'Know about religious rites',
      'Recognize holy symbols',
      'Know about cults and secret orders'
    ],
  },

  // ==========================================
  // WISDOM SKILLS
  // ==========================================

  animal_handling: {
    id: 'animal_handling',
    name: 'Animal Handling',
    description: 'When there is any question about calming, controlling, or understanding an animal.',
    ability: 'wisdom',
    category: 'exploration',
    tags: [
      'beast', 'mount', 'tame', 'calm',
      'train', 'bond', 'ride', 'command',
      'domesticate', 'wild', 'creature'
    ],
    examples: [
      'Calm a domesticated animal',
      'Keep a mount from getting spooked',
      'Intuit an animal\'s intentions',
      'Control a mount during a risky maneuver'
    ],
  },

  insight: {
    id: 'insight',
    name: 'Insight',
    description: 'Determines whether you can determine the true intentions of a creature.',
    ability: 'wisdom',
    category: 'social',
    tags: [
      'read', 'motive', 'truth', 'lie',
      'emotion', 'intent', 'body_language', 'tell',
      'intuition', 'empathy', 'discern'
    ],
    examples: [
      'Determine if someone is lying',
      'Predict someone\'s next move',
      'Read body language',
      'Sense hidden agendas'
    ],
  },

  medicine: {
    id: 'medicine',
    name: 'Medicine',
    description: 'Lets you try to stabilize a dying companion or diagnose an illness.',
    ability: 'wisdom',
    category: 'mental',
    tags: [
      'heal', 'diagnose', 'stabilize', 'treat',
      'wound', 'disease', 'poison', 'anatomy',
      'surgery', 'remedy', 'triage'
    ],
    loreEquivalence: {
      'healing_magic': 2,
      'anatomy': 3,
    },
    examples: [
      'Stabilize a dying creature',
      'Diagnose an illness',
      'Determine cause of death',
      'Treat a wound without magic'
    ],
  },

  perception: {
    id: 'perception',
    name: 'Perception',
    description: 'Lets you spot, hear, or otherwise detect the presence of something.',
    ability: 'wisdom',
    category: 'exploration',
    tags: [
      'spot', 'listen', 'smell', 'sense',
      'notice', 'detect', 'awareness', 'alert',
      'watchful', 'keen', 'observe'
    ],
    examples: [
      'Spot a hidden creature',
      'Hear an approaching enemy',
      'Notice something out of place',
      'Detect an ambush'
    ],
  },

  survival: {
    id: 'survival',
    name: 'Survival',
    description: 'Allows you to follow tracks, hunt wild game, or avoid natural hazards.',
    ability: 'wisdom',
    category: 'exploration',
    tags: [
      'track', 'hunt', 'forage', 'navigate',
      'wilderness', 'camp', 'trap', 'weather',
      'endure', 'pathfinding', 'shelter'
    ],
    examples: [
      'Follow tracks',
      'Hunt wild game',
      'Guide your group through dangerous terrain',
      'Predict the weather'
    ],
  },

  // ==========================================
  // CHARISMA SKILLS
  // ==========================================

  deception: {
    id: 'deception',
    name: 'Deception',
    description: 'Determines whether you can convincingly hide the truth.',
    ability: 'charisma',
    category: 'social',
    tags: [
      'lie', 'bluff', 'disguise', 'mislead',
      'con', 'trick', 'false', 'mask',
      'fabricate', 'misdirect', 'feign'
    ],
    examples: [
      'Tell a convincing lie',
      'Disguise yourself',
      'Fast-talk a guard',
      'Maintain a false identity'
    ],
  },

  intimidation: {
    id: 'intimidation',
    name: 'Intimidation',
    description: 'When you attempt to influence someone through threats or hostile actions.',
    ability: 'charisma',
    category: 'social',
    tags: [
      'threaten', 'coerce', 'bully', 'menace',
      'frighten', 'pressure', 'dominate', 'command',
      'terrorize', 'browbeat', 'overawe'
    ],
    examples: [
      'Pry information from a prisoner',
      'Convince thugs to back down',
      'Use your physical presence to intimidate',
      'Make a threat'
    ],
  },

  performance: {
    id: 'performance',
    name: 'Performance',
    description: 'Determines how well you can delight an audience with entertainment.',
    ability: 'charisma',
    category: 'social',
    tags: [
      'music', 'dance', 'act', 'sing',
      'orate', 'storytelling', 'entertain', 'drama',
      'comedy', 'poetry', 'instrument'
    ],
    examples: [
      'Play a musical instrument',
      'Tell a compelling story',
      'Perform a dance',
      'Act in a play'
    ],
  },

  persuasion: {
    id: 'persuasion',
    name: 'Persuasion',
    description: 'When you attempt to influence someone through good-faith arguments.',
    ability: 'charisma',
    category: 'social',
    tags: [
      'convince', 'negotiate', 'charm', 'diplomacy',
      'bargain', 'etiquette', 'speech', 'influence',
      'appeal', 'reason', 'advocate'
    ],
    examples: [
      'Convince a chamberlain to grant an audience',
      'Negotiate peace between warring parties',
      'Inspire a crowd',
      'Navigate a social gathering'
    ],
  },
}

// ============================================
// SKILL CATEGORY MAPPING
// ============================================

/**
 * Group core skills by category for UI organization.
 */
export const SKILLS_BY_CATEGORY: Record<SkillCategory, CoreSkill[]> = {
  physical: ['athletics', 'acrobatics', 'sleight_of_hand'],
  mental: ['history', 'investigation', 'medicine', 'religion'],
  social: ['insight', 'deception', 'intimidation', 'performance', 'persuasion'],
  magical: ['arcana'],
  crafting: [], // No core skills, only discovered
  combat: [],   // No core skills, only discovered (like Battle Master maneuvers)
  exploration: ['stealth', 'nature', 'animal_handling', 'perception', 'survival'],
}

/**
 * Group core skills by ability score.
 */
export const SKILLS_BY_ABILITY: Record<Ability, CoreSkill[]> = {
  strength: ['athletics'],
  dexterity: ['acrobatics', 'sleight_of_hand', 'stealth'],
  constitution: [], // No skills scale with CON
  intelligence: ['arcana', 'history', 'investigation', 'nature', 'religion'],
  wisdom: ['animal_handling', 'insight', 'medicine', 'perception', 'survival'],
  charisma: ['deception', 'intimidation', 'performance', 'persuasion'],
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get metadata for a core skill.
 */
export function getCoreSkillMetadata(skill: CoreSkill): CoreSkillMetadata {
  return CORE_SKILLS[skill]
}

/**
 * Get all tags for a core skill.
 */
export function getCoreSkillTags(skill: CoreSkill): string[] {
  return CORE_SKILLS[skill].tags
}

/**
 * Check if a set of tags could evolve a core skill.
 * Returns the matching skills ordered by tag overlap.
 */
export function matchTagsToCoreSkills(
  tags: string[]
): { skill: CoreSkill; matchCount: number }[] {
  const matches: { skill: CoreSkill; matchCount: number }[] = []

  for (const [skillId, metadata] of Object.entries(CORE_SKILLS)) {
    const matchCount = metadata.tags.filter(t => tags.includes(t)).length
    if (matchCount > 0) {
      matches.push({ skill: skillId as CoreSkill, matchCount })
    }
  }

  return matches.sort((a, b) => b.matchCount - a.matchCount)
}

/**
 * Get lore equivalence for a skill.
 * Returns what lore topics this skill can partially satisfy.
 */
export function getSkillLoreEquivalence(
  skill: CoreSkill
): Record<string, number> | undefined {
  return CORE_SKILLS[skill].loreEquivalence
}
