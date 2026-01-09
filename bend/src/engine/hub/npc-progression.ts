import { SeededRNG } from './topology';
import { NPCRole, NPCMetadata } from './npc';

// ============================================
// NPC PROGRESSION INTEGRATION
// ============================================
//
// NPCs use the SAME systems as player characters:
// - Skills (core + discovered)
// - Magic (lore, spell slots, entropy)
// - Ability scores and proficiencies
//
// The difference is in how they're GENERATED and ADVANCED.
// Players choose; NPCs are rolled from seeds.
//

// ============================================
// NPC SKILL CONFIGURATION
// ============================================

// Which skills an NPC role is likely to have proficiency in
export const NPC_ROLE_SKILLS: Record<NPCRole, {
  primary: string[];    // Always proficient
  secondary: string[];  // 50% chance
  tertiary: string[];   // 25% chance
}> = {
  // Service
  innkeeper: {
    primary: ['insight', 'persuasion'],
    secondary: ['perception', 'deception'],
    tertiary: ['intimidation', 'history'],
  },
  bartender: {
    primary: ['insight', 'perception'],
    secondary: ['persuasion', 'sleight_of_hand'],
    tertiary: ['intimidation', 'deception'],
  },
  merchant: {
    primary: ['persuasion', 'insight'],
    secondary: ['deception', 'perception'],
    tertiary: ['history', 'investigation'],
  },
  blacksmith: {
    primary: ['athletics'],
    secondary: ['perception', 'history'],
    tertiary: ['insight', 'intimidation'],
  },
  apothecary: {
    primary: ['medicine', 'nature'],
    secondary: ['arcana', 'investigation'],
    tertiary: ['persuasion', 'insight'],
  },
  healer: {
    primary: ['medicine'],
    secondary: ['insight', 'religion'],
    tertiary: ['nature', 'persuasion'],
  },
  stablehand: {
    primary: ['animal_handling'],
    secondary: ['perception', 'athletics'],
    tertiary: ['nature', 'survival'],
  },
  banker: {
    primary: ['insight', 'persuasion'],
    secondary: ['investigation', 'deception'],
    tertiary: ['intimidation', 'history'],
  },

  // Civic
  guard: {
    primary: ['perception', 'athletics'],
    secondary: ['intimidation', 'insight'],
    tertiary: ['investigation', 'survival'],
  },
  official: {
    primary: ['persuasion', 'insight'],
    secondary: ['history', 'investigation'],
    tertiary: ['intimidation', 'deception'],
  },
  judge: {
    primary: ['insight', 'investigation'],
    secondary: ['persuasion', 'history'],
    tertiary: ['intimidation', 'perception'],
  },
  mayor: {
    primary: ['persuasion', 'insight'],
    secondary: ['history', 'deception'],
    tertiary: ['intimidation', 'performance'],
  },
  noble: {
    primary: ['persuasion', 'history'],
    secondary: ['insight', 'deception'],
    tertiary: ['intimidation', 'performance'],
  },
  servant: {
    primary: ['perception', 'stealth'],
    secondary: ['insight', 'sleight_of_hand'],
    tertiary: ['persuasion', 'deception'],
  },

  // Religious
  priest: {
    primary: ['religion', 'insight'],
    secondary: ['persuasion', 'medicine'],
    tertiary: ['history', 'arcana'],
  },
  acolyte: {
    primary: ['religion'],
    secondary: ['insight', 'medicine'],
    tertiary: ['history', 'persuasion'],
  },
  monk: {
    primary: ['religion', 'insight'],
    secondary: ['acrobatics', 'stealth'],
    tertiary: ['athletics', 'perception'],
  },

  // Criminal
  thief: {
    primary: ['stealth', 'sleight_of_hand'],
    secondary: ['perception', 'deception'],
    tertiary: ['acrobatics', 'insight'],
  },
  fence: {
    primary: ['deception', 'insight'],
    secondary: ['persuasion', 'stealth'],
    tertiary: ['investigation', 'sleight_of_hand'],
  },
  smuggler: {
    primary: ['stealth', 'deception'],
    secondary: ['perception', 'sleight_of_hand'],
    tertiary: ['survival', 'athletics'],
  },
  assassin: {
    primary: ['stealth', 'perception'],
    secondary: ['acrobatics', 'deception'],
    tertiary: ['insight', 'intimidation'],
  },

  // Labor
  farmer: {
    primary: ['nature', 'animal_handling'],
    secondary: ['survival', 'athletics'],
    tertiary: ['perception', 'medicine'],
  },
  miner: {
    primary: ['athletics'],
    secondary: ['perception', 'survival'],
    tertiary: ['nature', 'investigation'],
  },
  fisher: {
    primary: ['survival', 'nature'],
    secondary: ['perception', 'athletics'],
    tertiary: ['animal_handling', 'insight'],
  },
  craftsman: {
    primary: ['perception'],
    secondary: ['insight', 'investigation'],
    tertiary: ['persuasion', 'history'],
  },
  laborer: {
    primary: ['athletics'],
    secondary: ['perception', 'survival'],
    tertiary: ['insight', 'intimidation'],
  },

  // Scholarly
  sage: {
    primary: ['arcana', 'history'],
    secondary: ['investigation', 'religion'],
    tertiary: ['nature', 'insight'],
  },
  librarian: {
    primary: ['history', 'investigation'],
    secondary: ['arcana', 'perception'],
    tertiary: ['insight', 'religion'],
  },
  teacher: {
    primary: ['history', 'insight'],
    secondary: ['persuasion', 'investigation'],
    tertiary: ['arcana', 'religion'],
  },
  mage: {
    primary: ['arcana'],
    secondary: ['history', 'investigation'],
    tertiary: ['insight', 'perception'],
  },
  alchemist: {
    primary: ['arcana', 'nature'],
    secondary: ['investigation', 'medicine'],
    tertiary: ['perception', 'history'],
  },

  // Entertainment
  bard: {
    primary: ['performance', 'persuasion'],
    secondary: ['deception', 'insight'],
    tertiary: ['history', 'acrobatics'],
  },
  actor: {
    primary: ['performance', 'deception'],
    secondary: ['persuasion', 'insight'],
    tertiary: ['acrobatics', 'history'],
  },
  courtesan: {
    primary: ['persuasion', 'insight'],
    secondary: ['performance', 'deception'],
    tertiary: ['perception', 'stealth'],
  },
  gambler: {
    primary: ['insight', 'deception'],
    secondary: ['sleight_of_hand', 'perception'],
    tertiary: ['persuasion', 'intimidation'],
  },

  // Military
  soldier: {
    primary: ['athletics', 'perception'],
    secondary: ['intimidation', 'survival'],
    tertiary: ['insight', 'acrobatics'],
  },
  mercenary: {
    primary: ['athletics', 'intimidation'],
    secondary: ['perception', 'survival'],
    tertiary: ['insight', 'stealth'],
  },
  knight: {
    primary: ['athletics', 'persuasion'],
    secondary: ['history', 'insight'],
    tertiary: ['animal_handling', 'intimidation'],
  },
  captain: {
    primary: ['athletics', 'intimidation'],
    secondary: ['perception', 'insight'],
    tertiary: ['persuasion', 'survival'],
  },

  // Other
  beggar: {
    primary: ['perception', 'stealth'],
    secondary: ['deception', 'insight'],
    tertiary: ['sleight_of_hand', 'persuasion'],
  },
  child: {
    primary: ['perception'],
    secondary: ['stealth', 'acrobatics'],
    tertiary: ['insight', 'deception'],
  },
  elder: {
    primary: ['insight', 'history'],
    secondary: ['persuasion', 'medicine'],
    tertiary: ['religion', 'perception'],
  },
  traveler: {
    primary: ['survival', 'perception'],
    secondary: ['insight', 'persuasion'],
    tertiary: ['history', 'nature'],
  },
  adventurer: {
    primary: ['athletics', 'perception'],
    secondary: ['survival', 'insight'],
    tertiary: ['arcana', 'stealth'],
  },

  // Additional roles
  sailor: {
    primary: ['athletics', 'perception'],
    secondary: ['survival', 'acrobatics'],
    tertiary: ['nature', 'intimidation'],
  },
  pilgrim: {
    primary: ['religion', 'survival'],
    secondary: ['insight', 'history'],
    tertiary: ['persuasion', 'medicine'],
  },
  apprentice: {
    primary: ['perception'],
    secondary: ['insight', 'investigation'],
    tertiary: ['arcana', 'history'],
  },
  gardener: {
    primary: ['nature', 'survival'],
    secondary: ['perception', 'medicine'],
    tertiary: ['animal_handling', 'athletics'],
  },
  gravedigger: {
    primary: ['athletics', 'religion'],
    secondary: ['perception', 'survival'],
    tertiary: ['history', 'stealth'],
  },
};

// ============================================
// NPC ABILITY SCORE GENERATION
// ============================================

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

// Role priority for ability scores (highest to lowest)
export const NPC_ROLE_ABILITIES: Record<NPCRole, (keyof AbilityScores)[]> = {
  innkeeper: ['charisma', 'wisdom', 'constitution', 'intelligence', 'strength', 'dexterity'],
  bartender: ['charisma', 'wisdom', 'dexterity', 'constitution', 'intelligence', 'strength'],
  merchant: ['charisma', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'strength'],
  blacksmith: ['strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma'],
  apothecary: ['intelligence', 'wisdom', 'dexterity', 'constitution', 'charisma', 'strength'],
  healer: ['wisdom', 'intelligence', 'charisma', 'constitution', 'dexterity', 'strength'],
  stablehand: ['dexterity', 'wisdom', 'strength', 'constitution', 'intelligence', 'charisma'],
  banker: ['intelligence', 'charisma', 'wisdom', 'dexterity', 'constitution', 'strength'],

  guard: ['strength', 'constitution', 'wisdom', 'dexterity', 'intelligence', 'charisma'],
  official: ['intelligence', 'charisma', 'wisdom', 'constitution', 'dexterity', 'strength'],
  judge: ['wisdom', 'intelligence', 'charisma', 'constitution', 'dexterity', 'strength'],
  mayor: ['charisma', 'intelligence', 'wisdom', 'constitution', 'dexterity', 'strength'],
  noble: ['charisma', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'strength'],
  servant: ['dexterity', 'wisdom', 'constitution', 'charisma', 'intelligence', 'strength'],

  priest: ['wisdom', 'charisma', 'constitution', 'intelligence', 'dexterity', 'strength'],
  acolyte: ['wisdom', 'intelligence', 'charisma', 'constitution', 'dexterity', 'strength'],
  monk: ['wisdom', 'dexterity', 'constitution', 'strength', 'intelligence', 'charisma'],

  thief: ['dexterity', 'intelligence', 'wisdom', 'charisma', 'constitution', 'strength'],
  fence: ['charisma', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'strength'],
  smuggler: ['dexterity', 'charisma', 'wisdom', 'constitution', 'intelligence', 'strength'],
  assassin: ['dexterity', 'wisdom', 'constitution', 'strength', 'intelligence', 'charisma'],

  farmer: ['constitution', 'strength', 'wisdom', 'dexterity', 'intelligence', 'charisma'],
  miner: ['strength', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'charisma'],
  fisher: ['constitution', 'wisdom', 'dexterity', 'strength', 'intelligence', 'charisma'],
  craftsman: ['dexterity', 'intelligence', 'constitution', 'wisdom', 'strength', 'charisma'],
  laborer: ['strength', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'charisma'],

  sage: ['intelligence', 'wisdom', 'charisma', 'constitution', 'dexterity', 'strength'],
  librarian: ['intelligence', 'wisdom', 'dexterity', 'constitution', 'charisma', 'strength'],
  teacher: ['intelligence', 'charisma', 'wisdom', 'constitution', 'dexterity', 'strength'],
  mage: ['intelligence', 'constitution', 'wisdom', 'dexterity', 'charisma', 'strength'],
  alchemist: ['intelligence', 'dexterity', 'wisdom', 'constitution', 'charisma', 'strength'],

  bard: ['charisma', 'dexterity', 'intelligence', 'wisdom', 'constitution', 'strength'],
  actor: ['charisma', 'dexterity', 'intelligence', 'wisdom', 'constitution', 'strength'],
  courtesan: ['charisma', 'wisdom', 'dexterity', 'intelligence', 'constitution', 'strength'],
  gambler: ['charisma', 'wisdom', 'dexterity', 'intelligence', 'constitution', 'strength'],

  soldier: ['strength', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'charisma'],
  mercenary: ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
  knight: ['strength', 'charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence'],
  captain: ['strength', 'charisma', 'wisdom', 'constitution', 'dexterity', 'intelligence'],

  beggar: ['constitution', 'wisdom', 'dexterity', 'charisma', 'intelligence', 'strength'],
  child: ['dexterity', 'constitution', 'charisma', 'wisdom', 'intelligence', 'strength'],
  elder: ['wisdom', 'intelligence', 'charisma', 'constitution', 'dexterity', 'strength'],
  traveler: ['constitution', 'wisdom', 'dexterity', 'charisma', 'intelligence', 'strength'],
  adventurer: ['constitution', 'strength', 'dexterity', 'wisdom', 'intelligence', 'charisma'],

  // Additional roles
  sailor: ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
  pilgrim: ['wisdom', 'constitution', 'charisma', 'strength', 'dexterity', 'intelligence'],
  apprentice: ['intelligence', 'dexterity', 'wisdom', 'constitution', 'charisma', 'strength'],
  gardener: ['constitution', 'wisdom', 'dexterity', 'strength', 'intelligence', 'charisma'],
  gravedigger: ['strength', 'constitution', 'wisdom', 'dexterity', 'intelligence', 'charisma'],
};

export class NPCStatGenerator {
  private rng: SeededRNG;

  constructor(seed: string) {
    this.rng = new SeededRNG(seed);
  }

  /**
   * Generate ability scores for an NPC.
   * Uses the role's ability priority to assign scores.
   */
  generateAbilityScores(
    role: NPCRole,
    importance: NPCMetadata['importance']
  ): AbilityScores {
    // Roll ability scores (better for more important NPCs)
    const rolls = this.rollAbilityScores(importance);

    // Sort rolls high to low
    rolls.sort((a, b) => b - a);

    // Assign based on role priority
    const priority = NPC_ROLE_ABILITIES[role];
    const scores: AbilityScores = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    for (let i = 0; i < priority.length; i++) {
      scores[priority[i]] = rolls[i];
    }

    return scores;
  }

  /**
   * Roll ability scores using importance-based method.
   */
  private rollAbilityScores(importance: NPCMetadata['importance']): number[] {
    const rolls: number[] = [];

    // Method varies by importance
    switch (importance) {
      case 'legendary':
        // Elite array: 18, 16, 14, 13, 12, 10
        return [18, 16, 14, 13, 12, 10];

      case 'major':
        // Strong array: 16, 14, 13, 12, 11, 10
        return [16, 14, 13, 12, 11, 10];

      case 'notable':
        // Good array: 15, 14, 13, 12, 10, 8
        return [15, 14, 13, 12, 10, 8];

      case 'minor':
        // Standard array: 15, 14, 13, 12, 10, 8 (same but worse rolls)
        for (let i = 0; i < 6; i++) {
          rolls.push(this.roll4d6DropLowest());
        }
        return rolls;

      case 'background':
      default:
        // Commoner: mostly 10s with variance
        for (let i = 0; i < 6; i++) {
          rolls.push(8 + this.rng.rangeInt(0, 4));
        }
        return rolls;
    }
  }

  /**
   * Roll 4d6 drop lowest (standard D&D method).
   */
  private roll4d6DropLowest(): number {
    const dice = [
      this.rng.rangeInt(1, 6),
      this.rng.rangeInt(1, 6),
      this.rng.rangeInt(1, 6),
      this.rng.rangeInt(1, 6),
    ];
    dice.sort((a, b) => b - a);
    return dice[0] + dice[1] + dice[2];
  }

  /**
   * Generate skill proficiencies for an NPC.
   */
  generateSkillProficiencies(role: NPCRole): {
    proficient: string[];
    expertise: string[];
  } {
    const roleSkills = NPC_ROLE_SKILLS[role];
    const proficient: string[] = [...roleSkills.primary];
    const expertise: string[] = [];

    // Secondary skills: 50% chance each
    for (const skill of roleSkills.secondary) {
      if (this.rng.next() < 0.5) {
        proficient.push(skill);
      }
    }

    // Tertiary skills: 25% chance each
    for (const skill of roleSkills.tertiary) {
      if (this.rng.next() < 0.25) {
        proficient.push(skill);
      }
    }

    // One primary skill might have expertise (10% chance)
    if (this.rng.next() < 0.1 && roleSkills.primary.length > 0) {
      expertise.push(this.rng.pick(roleSkills.primary));
    }

    return { proficient, expertise };
  }

  /**
   * Determine if NPC is a spellcaster and what type.
   */
  generateSpellcasting(
    role: NPCRole,
    importance: NPCMetadata['importance']
  ): {
    isSpellcaster: boolean;
    casterType?: 'arcane' | 'divine' | 'nature' | 'innate';
    casterLevel?: number;
    knownSpells?: string[];
  } {
    // Only certain roles can cast
    const arcaneRoles: NPCRole[] = ['mage', 'alchemist', 'sage', 'bard'];
    const divineRoles: NPCRole[] = ['priest', 'acolyte', 'monk', 'healer'];
    const natureRoles: NPCRole[] = ['farmer', 'fisher']; // Rare druidic connection

    let casterType: 'arcane' | 'divine' | 'nature' | undefined;

    if (arcaneRoles.includes(role)) {
      casterType = 'arcane';
    } else if (divineRoles.includes(role)) {
      casterType = 'divine';
    } else if (natureRoles.includes(role) && this.rng.next() < 0.1) {
      casterType = 'nature';
    }

    if (!casterType) {
      return { isSpellcaster: false };
    }

    // Caster level based on importance
    const baseLevels: Record<NPCMetadata['importance'], number> = {
      background: 0,
      minor: 1,
      notable: 3,
      major: 5,
      legendary: 9,
    };

    const casterLevel = baseLevels[importance] + this.rng.rangeInt(0, 2);

    if (casterLevel === 0) {
      return { isSpellcaster: false };
    }

    // Generate known spells (placeholder IDs)
    const spellCount = Math.min(casterLevel + 2, 10);
    const knownSpells: string[] = [];
    for (let i = 0; i < spellCount; i++) {
      knownSpells.push(`spell_${casterType}_${i}`);
    }

    return {
      isSpellcaster: true,
      casterType,
      casterLevel,
      knownSpells,
    };
  }

  /**
   * Calculate NPC level (challenge rating equivalent).
   */
  calculateLevel(
    importance: NPCMetadata['importance'],
    role: NPCRole
  ): number {
    const baseLevels: Record<NPCMetadata['importance'], number> = {
      background: 0,  // Commoner (CR 0)
      minor: 1,       // CR 1/4 to 1/2
      notable: 3,     // CR 1-2
      major: 6,       // CR 3-5
      legendary: 12,  // CR 6+
    };

    // Some roles get bonus levels
    const combatRoles: NPCRole[] = ['guard', 'soldier', 'knight', 'mercenary', 'assassin', 'captain', 'adventurer'];
    const magicRoles: NPCRole[] = ['mage', 'priest', 'alchemist'];

    let level = baseLevels[importance];

    if (combatRoles.includes(role)) {
      level += this.rng.rangeInt(1, 3);
    }
    if (magicRoles.includes(role)) {
      level += this.rng.rangeInt(0, 2);
    }

    return Math.max(0, level);
  }

  /**
   * Generate discovered skills for notable+ NPCs.
   * Uses the skill discovery system but pre-generates results.
   */
  generateDiscoveredSkills(
    role: NPCRole,
    importance: NPCMetadata['importance'],
    level: number
  ): Array<{
    skillId: string;
    name: string;
    xp: number;
    level: number;
    origin: string;
  }> {
    // Only notable+ NPCs have discovered skills
    if (importance === 'background' || importance === 'minor') {
      return [];
    }

    const discoveredSkills: Array<{
      skillId: string;
      name: string;
      xp: number;
      level: number;
      origin: string;
    }> = [];

    // Number of discovered skills by importance
    const counts: Record<string, number> = {
      notable: 1,
      major: 2,
      legendary: 4,
    };

    const count = counts[importance] ?? 0;

    // Role-specific discovered skills
    const roleDiscoveries: Partial<Record<NPCRole, Array<{ id: string; name: string }>>> = {
      blacksmith: [
        { id: 'masterwork_forging', name: 'Masterwork Forging' },
        { id: 'alloy_crafting', name: 'Alloy Crafting' },
      ],
      mage: [
        { id: 'spell_research', name: 'Spell Research' },
        { id: 'arcane_identification', name: 'Arcane Identification' },
      ],
      thief: [
        { id: 'lockcraft', name: 'Lockcraft' },
        { id: 'fence_contacts', name: 'Fence Contacts' },
      ],
      priest: [
        { id: 'ritual_casting', name: 'Ritual Casting' },
        { id: 'divine_channeling', name: 'Divine Channeling' },
      ],
      knight: [
        { id: 'mounted_combat', name: 'Mounted Combat' },
        { id: 'heraldry', name: 'Heraldry' },
      ],
      sage: [
        { id: 'ancient_languages', name: 'Ancient Languages' },
        { id: 'forbidden_lore', name: 'Forbidden Lore' },
      ],
      assassin: [
        { id: 'poison_craft', name: 'Poison Craft' },
        { id: 'silent_kill', name: 'Silent Kill' },
      ],
    };

    const available = roleDiscoveries[role] ?? [
      { id: 'local_knowledge', name: 'Local Knowledge' },
    ];

    for (let i = 0; i < Math.min(count, available.length); i++) {
      const skill = available[i];
      const xp = 100 * (1 + this.rng.rangeInt(0, level));

      discoveredSkills.push({
        skillId: skill.id,
        name: skill.name,
        xp,
        level: Math.floor(Math.sqrt(xp / 100)),
        origin: `Learned through years as ${role}`,
      });
    }

    return discoveredSkills;
  }
}

// ============================================
// NPC LORE INTEGRATION
// ============================================

export interface NPCLoreState {
  // Topics the NPC has knowledge in
  topics: Array<{
    topic: string;
    xp: number;
    level: number;
  }>;

  // What arcane traditions they know
  traditions: string[];
}

export function generateNPCLore(
  role: NPCRole,
  importance: NPCMetadata['importance'],
  rng: SeededRNG
): NPCLoreState {
  const topics: NPCLoreState['topics'] = [];
  const traditions: string[] = [];

  // Role-based lore topics
  const roleLore: Partial<Record<NPCRole, string[]>> = {
    sage: ['arcane_theory', 'history', 'planar_knowledge'],
    mage: ['arcane_theory', 'metamagic'],
    priest: ['divine_magic', 'religious_rites'],
    alchemist: ['arcane_theory', 'transmutation'],
    librarian: ['history', 'languages'],
    monk: ['divine_magic', 'meditation'],
  };

  const roleTopics = roleLore[role] ?? [];

  // Generate XP based on importance
  const baseXP: Record<NPCMetadata['importance'], number> = {
    background: 0,
    minor: 50,
    notable: 200,
    major: 500,
    legendary: 1000,
  };

  for (const topic of roleTopics) {
    const xp = baseXP[importance] + rng.rangeInt(0, 200);
    topics.push({
      topic,
      xp,
      level: Math.floor(Math.sqrt(xp / 100)),
    });
  }

  // Traditions for spellcasters
  if (['mage', 'alchemist'].includes(role)) {
    traditions.push('arcane');
  }
  if (['priest', 'acolyte', 'monk'].includes(role)) {
    traditions.push('divine');
  }

  return { topics, traditions };
}
