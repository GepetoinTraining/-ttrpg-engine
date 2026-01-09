/**
 * LORE SYSTEM - Knowledge Gates
 *
 * You can't cast what you don't understand.
 * Wizards MUST study. Sorcerers bypass lore (innate).
 * Clerics get lore from deity. Warlocks from patron.
 *
 * Lore progression: sqrt(xp / 100)
 * Level 1: 100 XP
 * Level 2: 400 XP
 * Level 3: 900 XP
 * Level 4: 1600 XP
 * Level 5: 2500 XP
 */

import { z } from 'zod';
import type { LoreRequirement, LoreEntry } from './types';
import { modifyLoreXp, type DifficultyMode } from './difficulty';

// ============================================
// LORE TOPICS
// ============================================

export const LoreTopicSchema = z.enum([
  // Spell schools
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',

  // Damage types
  'fire_magic',
  'cold_magic',
  'lightning_magic',
  'acid_magic',
  'poison_magic',
  'necrotic_magic',
  'radiant_magic',
  'force_magic',
  'psychic_magic',
  'thunder_magic',

  // Special topics
  'ritual_casting',
  'metamagic',
  'wild_magic',
  'planar_knowledge',
  'forbidden_arts',
  'divine_magic',
  'nature_magic',
  'arcane_theory',

  // Advanced/dangerous
  'blood_magic',
  'soul_magic',
  'time_magic',
  'reality_alteration',
  'true_naming',
  'elder_runes',
]);

export type LoreTopic = z.infer<typeof LoreTopicSchema>;

// ============================================
// LORE SOURCES
// ============================================

export interface LoreSource {
  id: string;
  name: string;
  type: 'tome' | 'scroll' | 'teacher' | 'practice' | 'divine' | 'patron' | 'innate' | 'item';
  xpPerHour: number;
  maxLevel: number;  // Can't learn beyond this from this source
  topics: LoreTopic[];
  requirements?: {
    minLevel?: number;
    prerequisiteLore?: LoreRequirement[];
    goldCost?: number;
    consumed?: boolean;  // Is the source used up?
  };
}

export const LORE_SOURCES: Record<string, LoreSource> = {
  // Basic sources
  basic_spellbook: {
    id: 'basic_spellbook',
    name: 'Basic Spellbook',
    type: 'tome',
    xpPerHour: 10,
    maxLevel: 2,
    topics: ['arcane_theory', 'evocation', 'abjuration', 'transmutation'],
  },

  apprentice_scroll: {
    id: 'apprentice_scroll',
    name: 'Apprentice Scroll',
    type: 'scroll',
    xpPerHour: 5,
    maxLevel: 1,
    topics: ['arcane_theory'],
    requirements: { consumed: true },
  },

  // Teachers
  wizard_tutor: {
    id: 'wizard_tutor',
    name: 'Wizard Tutor',
    type: 'teacher',
    xpPerHour: 20,
    maxLevel: 4,
    topics: ['arcane_theory', 'evocation', 'conjuration', 'abjuration', 'transmutation', 'divination', 'illusion', 'enchantment'],
    requirements: { goldCost: 50 },  // Per hour
  },

  // Practice
  spell_practice: {
    id: 'spell_practice',
    name: 'Spell Practice',
    type: 'practice',
    xpPerHour: 2,
    maxLevel: 5,  // Slow but unlimited
    topics: ['arcane_theory', 'evocation', 'conjuration', 'abjuration', 'transmutation', 'divination', 'illusion', 'enchantment', 'necromancy'],
  },

  // Divine sources
  prayer_meditation: {
    id: 'prayer_meditation',
    name: 'Prayer and Meditation',
    type: 'divine',
    xpPerHour: 15,
    maxLevel: 5,
    topics: ['divine_magic', 'radiant_magic', 'abjuration', 'evocation'],
  },

  // Dangerous sources
  forbidden_tome: {
    id: 'forbidden_tome',
    name: 'Forbidden Tome',
    type: 'tome',
    xpPerHour: 30,
    maxLevel: 5,
    topics: ['forbidden_arts', 'necromancy', 'blood_magic', 'soul_magic'],
    requirements: {
      minLevel: 5,
      prerequisiteLore: [{ topic: 'arcane_theory', level: 3 }],
    },
  },

  elder_codex: {
    id: 'elder_codex',
    name: 'Elder Codex',
    type: 'tome',
    xpPerHour: 50,
    maxLevel: 5,
    topics: ['elder_runes', 'reality_alteration', 'time_magic', 'true_naming'],
    requirements: {
      minLevel: 10,
      prerequisiteLore: [
        { topic: 'arcane_theory', level: 4 },
        { topic: 'planar_knowledge', level: 3 },
      ],
    },
  },

  // Innate (for sorcerers)
  innate_power: {
    id: 'innate_power',
    name: 'Innate Power',
    type: 'innate',
    xpPerHour: 100,  // Fast because it's in your blood
    maxLevel: 5,
    topics: ['arcane_theory', 'wild_magic', 'metamagic'],
  },

  // Patron (for warlocks)
  patron_whispers: {
    id: 'patron_whispers',
    name: 'Patron Whispers',
    type: 'patron',
    xpPerHour: 25,
    maxLevel: 5,
    topics: ['forbidden_arts', 'planar_knowledge', 'psychic_magic'],
  },
};

// ============================================
// LORE MANAGER CLASS
// ============================================

export class LoreManager {
  /**
   * Calculate lore level from XP.
   * Uses sqrt scaling: level = floor(sqrt(xp / 100))
   */
  static getLevelFromXP(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
  }

  /**
   * Calculate XP required for a given level.
   */
  static getXPForLevel(level: number): number {
    return level * level * 100;
  }

  /**
   * Calculate XP needed for next level.
   */
  static getXPToNextLevel(currentXP: number): number {
    const currentLevel = this.getLevelFromXP(currentXP);
    const nextLevelXP = this.getXPForLevel(currentLevel + 1);
    return nextLevelXP - currentXP;
  }

  /**
   * Check if caster has required lore for a spell.
   */
  static hasRequiredLore(
    requirements: LoreRequirement[],
    casterLore: Record<string, { level: number; xp: number; sources: string[] }>
  ): boolean {
    for (const req of requirements) {
      const entry = casterLore[req.topic];
      if (!entry || entry.level < req.level) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get missing lore requirements.
   */
  static getMissingLore(
    requirements: LoreRequirement[],
    casterLore: Record<string, { level: number; xp: number; sources: string[] }>
  ): LoreRequirement[] {
    const missing: LoreRequirement[] = [];

    for (const req of requirements) {
      const entry = casterLore[req.topic];
      if (!entry) {
        missing.push(req);
      } else if (entry.level < req.level) {
        missing.push({
          topic: req.topic,
          level: req.level - entry.level,  // How much more needed
        });
      }
    }

    return missing;
  }

  /**
   * Study from a source for a duration.
   * Returns XP gained.
   */
  static study(
    topic: string,
    source: LoreSource,
    durationHours: number,
    casterLore: Record<string, LoreEntry>,
    difficulty: DifficultyMode
  ): { xpGained: number; newLevel: number; cappedBySource: boolean } {
    // Check if source covers this topic
    if (!source.topics.includes(topic as LoreTopic)) {
      return { xpGained: 0, newLevel: 0, cappedBySource: false };
    }

    const currentEntry = casterLore[topic] || { topic, xp: 0, level: 0, sources: [] };
    const currentLevel = this.getLevelFromXP(currentEntry.xp);

    // Check if capped by source
    if (currentLevel >= source.maxLevel) {
      return {
        xpGained: 0,
        newLevel: currentLevel,
        cappedBySource: true
      };
    }

    // Calculate base XP
    let baseXP = source.xpPerHour * durationHours;

    // Apply difficulty modifier
    baseXP = modifyLoreXp(baseXP, difficulty);

    // Calculate new total
    const newXP = currentEntry.xp + baseXP;
    const newLevel = Math.min(source.maxLevel, this.getLevelFromXP(newXP));

    // Cap XP at source max level
    const cappedXP = Math.min(newXP, this.getXPForLevel(source.maxLevel));
    const actualGain = cappedXP - currentEntry.xp;

    return {
      xpGained: actualGain,
      newLevel,
      cappedBySource: newLevel >= source.maxLevel,
    };
  }

  /**
   * Add lore XP to a character's knowledge.
   */
  static addLoreXP(
    topic: string,
    xp: number,
    source: string,
    casterLore: Record<string, LoreEntry>
  ): LoreEntry {
    const current = casterLore[topic] || {
      topic,
      xp: 0,
      level: 0,
      sources: [],
    };

    const newXP = current.xp + xp;
    const newLevel = this.getLevelFromXP(newXP);
    const sources = current.sources.includes(source)
      ? current.sources
      : [...current.sources, source];

    return {
      topic,
      xp: newXP,
      level: newLevel,
      sources,
    };
  }

  /**
   * Get all lore topics a caster has studied.
   */
  static getKnownTopics(
    casterLore: Record<string, LoreEntry>,
    minLevel: number = 1
  ): string[] {
    return Object.entries(casterLore)
      .filter(([_, entry]) => entry.level >= minLevel)
      .map(([topic, _]) => topic);
  }

  /**
   * Get the highest level lore a caster has.
   */
  static getHighestLore(
    casterLore: Record<string, LoreEntry>
  ): { topic: string; level: number } | null {
    let highest: { topic: string; level: number } | null = null;

    for (const [topic, entry] of Object.entries(casterLore)) {
      if (!highest || entry.level > highest.level) {
        highest = { topic, level: entry.level };
      }
    }

    return highest;
  }

  /**
   * Check if a source can be used.
   */
  static canUseSource(
    source: LoreSource,
    casterLevel: number,
    casterLore: Record<string, LoreEntry>
  ): { canUse: boolean; reason?: string } {
    if (!source.requirements) {
      return { canUse: true };
    }

    const reqs = source.requirements;

    if (reqs.minLevel && casterLevel < reqs.minLevel) {
      return {
        canUse: false,
        reason: `Requires caster level ${reqs.minLevel}`
      };
    }

    if (reqs.prerequisiteLore) {
      const missing = this.getMissingLore(reqs.prerequisiteLore, casterLore);
      if (missing.length > 0) {
        return {
          canUse: false,
          reason: `Missing prerequisite: ${missing[0].topic} level ${missing[0].level}`,
        };
      }
    }

    return { canUse: true };
  }
}

// ============================================
// SPELL LORE REQUIREMENTS
// ============================================

/**
 * Get default lore requirements for a spell based on its properties.
 */
export function getDefaultLoreRequirements(
  spellLevel: number,
  school: string,
  isDangerous: boolean = false
): LoreRequirement[] {
  const requirements: LoreRequirement[] = [];

  // Base school requirement
  const schoolLevel = Math.max(1, Math.ceil(spellLevel / 2));
  requirements.push({
    topic: school,
    level: schoolLevel,
  });

  // High level spells need arcane theory
  if (spellLevel >= 5) {
    requirements.push({
      topic: 'arcane_theory',
      level: Math.ceil(spellLevel / 2),
    });
  }

  // Dangerous spells (necromancy, summoning, etc.)
  if (isDangerous) {
    requirements.push({
      topic: 'forbidden_arts',
      level: Math.max(1, spellLevel - 3),
    });
  }

  // 9th level spells need reality alteration understanding
  if (spellLevel === 9) {
    requirements.push({
      topic: 'reality_alteration',
      level: 3,
    });
  }

  return requirements;
}

// ============================================
// CLASS-SPECIFIC LORE HANDLING
// ============================================

export interface ClassLoreProfile {
  type: string;
  bypassesLore: boolean;          // Sorcerers don't need to study
  freeTopics: string[];           // Topics always satisfied
  loreSource: string;             // How they learn
  startingLore?: LoreRequirement[];  // What they know at creation
}

export const CLASS_LORE_PROFILES: Record<string, ClassLoreProfile> = {
  wizard: {
    type: 'wizard',
    bypassesLore: false,
    freeTopics: [],
    loreSource: 'study',
    startingLore: [
      { topic: 'arcane_theory', level: 1 },
    ],
  },

  sorcerer: {
    type: 'sorcerer',
    bypassesLore: true,  // Magic is in their blood
    freeTopics: ['arcane_theory', 'wild_magic', 'metamagic'],
    loreSource: 'innate',
    startingLore: [
      { topic: 'arcane_theory', level: 2 },  // Natural understanding
    ],
  },

  cleric: {
    type: 'cleric',
    bypassesLore: false,
    freeTopics: ['divine_magic'],  // Deity provides
    loreSource: 'divine',
    startingLore: [
      { topic: 'divine_magic', level: 2 },
    ],
  },

  warlock: {
    type: 'warlock',
    bypassesLore: false,
    freeTopics: [],
    loreSource: 'patron',  // Patron teaches
    startingLore: [
      { topic: 'forbidden_arts', level: 1 },
    ],
  },

  druid: {
    type: 'druid',
    bypassesLore: false,
    freeTopics: ['nature_magic'],
    loreSource: 'nature',
    startingLore: [
      { topic: 'nature_magic', level: 2 },
    ],
  },

  bard: {
    type: 'bard',
    bypassesLore: true,  // Magic through performance/intuition
    freeTopics: ['arcane_theory', 'enchantment', 'illusion'],
    loreSource: 'performance',
    startingLore: [
      { topic: 'arcane_theory', level: 1 },
    ],
  },

  paladin: {
    type: 'paladin',
    bypassesLore: false,
    freeTopics: ['divine_magic'],
    loreSource: 'divine',
    startingLore: [],  // Starts without magical lore
  },

  ranger: {
    type: 'ranger',
    bypassesLore: false,
    freeTopics: ['nature_magic'],
    loreSource: 'nature',
    startingLore: [],
  },
};

/**
 * Check if a class bypasses lore requirements for a topic.
 */
export function classHasFreeLore(
  classType: string,
  topic: string
): boolean {
  const profile = CLASS_LORE_PROFILES[classType];
  if (!profile) return false;

  if (profile.bypassesLore) return true;
  return profile.freeTopics.includes(topic);
}
