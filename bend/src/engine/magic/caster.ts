/**
 * CASTER PROFILES - Class Identity Through Magic
 *
 * How you pay for magic defines who you are.
 *
 * WIZARD:    Lore + Materials. Prepared caster. Ritual casting. Study or die.
 * SORCERER:  Health + Innate. Known caster. Metamagic. Blood is the price.
 * CLERIC:    Faith + Divine. Prepared caster. Domain spells free. Deity provides.
 * WARLOCK:   Pact + Patron. Known caster. Short rest slots. Deal with the devil.
 * DRUID:     Nature + Materials. Prepared caster. Wild Shape. Circle of life.
 * BARD:      Performance + Innate. Known caster. Jack of all trades.
 * PALADIN:   Oath + Divine. Prepared caster. Half-caster. Smite is life.
 * RANGER:    Nature + Survival. Known caster. Half-caster. Hunter's mark.
 * ARTIFICER: Technology + Study. Prepared caster. Half-caster. Infusions.
 */

import { z } from 'zod';

// ============================================
// CASTER TYPES
// ============================================

export const CasterTypeSchema = z.enum([
  'wizard',
  'sorcerer',
  'cleric',
  'warlock',
  'druid',
  'bard',
  'paladin',
  'ranger',
  'artificer',
  'none',  // Non-caster
]);

export type CasterType = z.infer<typeof CasterTypeSchema>;

// ============================================
// SLOT PROGRESSION
// ============================================

export type SlotProgression = 'full' | 'half' | 'third' | 'pact' | 'none';

// Full caster spell slots by level
export const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1:  [2],
  2:  [3],
  3:  [4, 2],
  4:  [4, 3],
  5:  [4, 3, 2],
  6:  [4, 3, 3],
  7:  [4, 3, 3, 1],
  8:  [4, 3, 3, 2],
  9:  [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

// Half caster spell slots by level
export const HALF_CASTER_SLOTS: Record<number, number[]> = {
  1:  [],
  2:  [2],
  3:  [3],
  4:  [3],
  5:  [4, 2],
  6:  [4, 2],
  7:  [4, 3],
  8:  [4, 3],
  9:  [4, 3, 2],
  10: [4, 3, 2],
  11: [4, 3, 3],
  12: [4, 3, 3],
  13: [4, 3, 3, 1],
  14: [4, 3, 3, 1],
  15: [4, 3, 3, 2],
  16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
  20: [4, 3, 3, 3, 2],
};

// Third caster (Eldritch Knight, Arcane Trickster)
export const THIRD_CASTER_SLOTS: Record<number, number[]> = {
  1:  [],
  2:  [],
  3:  [2],
  4:  [3],
  5:  [3],
  6:  [3],
  7:  [4, 2],
  8:  [4, 2],
  9:  [4, 2],
  10: [4, 3],
  11: [4, 3],
  12: [4, 3],
  13: [4, 3, 2],
  14: [4, 3, 2],
  15: [4, 3, 2],
  16: [4, 3, 3],
  17: [4, 3, 3],
  18: [4, 3, 3],
  19: [4, 3, 3, 1],
  20: [4, 3, 3, 1],
};

// Warlock pact magic
export const WARLOCK_PACT_SLOTS: Record<number, { slots: number; level: number }> = {
  1:  { slots: 1, level: 1 },
  2:  { slots: 2, level: 1 },
  3:  { slots: 2, level: 2 },
  4:  { slots: 2, level: 2 },
  5:  { slots: 2, level: 3 },
  6:  { slots: 2, level: 3 },
  7:  { slots: 2, level: 4 },
  8:  { slots: 2, level: 4 },
  9:  { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 },
};

// ============================================
// CASTER PROFILE
// ============================================

export interface CasterProfile {
  type: CasterType;
  name: string;
  description: string;

  // Spellcasting ability
  spellcastingAbility: 'int' | 'wis' | 'cha';

  // Slot progression
  slotProgression: SlotProgression;

  // Known vs Prepared
  preparedCaster: boolean;
  spellsKnownFormula?: string;  // e.g., "level + 1" for sorcerer
  spellsPreparedFormula?: string;  // e.g., "level + mod" for cleric

  // Cost requirements
  requiresLore: boolean;
  requiresMaterials: boolean;
  canPayWithHealth: boolean;
  healthCostMultiplier?: number;  // HP per spell level

  // Special features
  ritualCasting: boolean;
  metamagic: boolean;
  divineIntervention: boolean;
  channelDivinity: boolean;
  wildShape: boolean;
  invocations: boolean;
  infusions: boolean;

  // Component handling
  focusType: string[];  // What can be used as a focus

  // Free lore (topics always satisfied)
  freeTopics: string[];
}

// ============================================
// CASTER PROFILES
// ============================================

export const CASTER_PROFILES: Record<CasterType, CasterProfile> = {
  wizard: {
    type: 'wizard',
    name: 'Wizard',
    description: 'Scholars of the arcane who learn magic through intense study. They must understand to cast.',

    spellcastingAbility: 'int',
    slotProgression: 'full',
    preparedCaster: true,
    spellsPreparedFormula: 'level + int_mod',

    requiresLore: true,      // MUST study
    requiresMaterials: true, // MUST have components
    canPayWithHealth: false,

    ritualCasting: true,
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: ['arcane_focus', 'component_pouch', 'spellbook'],
    freeTopics: [],
  },

  sorcerer: {
    type: 'sorcerer',
    name: 'Sorcerer',
    description: 'Magic runs in their blood. They cast by instinct, not study. The body is the focus.',

    spellcastingAbility: 'cha',
    slotProgression: 'full',
    preparedCaster: false,
    spellsKnownFormula: 'level + 1',  // Limited spells known

    requiresLore: false,     // Innate knowledge
    requiresMaterials: false, // Body IS the focus
    canPayWithHealth: true,   // Blood magic
    healthCostMultiplier: 3,  // 3 HP per spell level

    ritualCasting: false,
    metamagic: true,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: ['arcane_focus', 'self'],
    freeTopics: ['arcane_theory', 'wild_magic', 'metamagic'],
  },

  cleric: {
    type: 'cleric',
    name: 'Cleric',
    description: 'Conduits of divine power. The deity provides spells. Faith is the requirement.',

    spellcastingAbility: 'wis',
    slotProgression: 'full',
    preparedCaster: true,
    spellsPreparedFormula: 'level + wis_mod',

    requiresLore: false,     // Deity provides knowledge
    requiresMaterials: true, // Holy symbols required
    canPayWithHealth: false,

    ritualCasting: true,
    metamagic: false,
    divineIntervention: true,
    channelDivinity: true,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: ['holy_symbol', 'component_pouch'],
    freeTopics: ['divine_magic'],
  },

  warlock: {
    type: 'warlock',
    name: 'Warlock',
    description: 'Power through pacts. The patron grants magic, but at a price. Short rest recovery.',

    spellcastingAbility: 'cha',
    slotProgression: 'pact',
    preparedCaster: false,
    spellsKnownFormula: 'level + 1',

    requiresLore: true,      // Patron teaches, but you must learn
    requiresMaterials: true,
    canPayWithHealth: false, // Patron wouldn't like that

    ritualCasting: false,    // Unless Pact of Tome
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: true,
    infusions: false,

    focusType: ['arcane_focus', 'pact_weapon', 'component_pouch'],
    freeTopics: ['forbidden_arts'],
  },

  druid: {
    type: 'druid',
    name: 'Druid',
    description: 'Wielders of nature magic. The land provides. Wild Shape transforms.',

    spellcastingAbility: 'wis',
    slotProgression: 'full',
    preparedCaster: true,
    spellsPreparedFormula: 'level + wis_mod',

    requiresLore: true,      // Nature must be understood
    requiresMaterials: true, // Natural components
    canPayWithHealth: false,

    ritualCasting: true,
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: true,
    invocations: false,
    infusions: false,

    focusType: ['druidic_focus', 'component_pouch'],
    freeTopics: ['nature_magic'],
  },

  bard: {
    type: 'bard',
    name: 'Bard',
    description: 'Magic through performance and intuition. Jack of all trades, master of none.',

    spellcastingAbility: 'cha',
    slotProgression: 'full',
    preparedCaster: false,
    spellsKnownFormula: 'level + 4',  // Generous spells known

    requiresLore: false,     // Magic through intuition/performance
    requiresMaterials: true,
    canPayWithHealth: false,

    ritualCasting: true,     // With Ritual Caster feat equivalent
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: ['musical_instrument', 'component_pouch'],
    freeTopics: ['arcane_theory', 'enchantment', 'illusion'],
  },

  paladin: {
    type: 'paladin',
    name: 'Paladin',
    description: 'Holy warriors. Magic through oath and faith. Divine smite is the way.',

    spellcastingAbility: 'cha',
    slotProgression: 'half',
    preparedCaster: true,
    spellsPreparedFormula: 'half_level + cha_mod',

    requiresLore: false,     // Oath provides
    requiresMaterials: true,
    canPayWithHealth: false,

    ritualCasting: false,
    metamagic: false,
    divineIntervention: false,
    channelDivinity: true,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: ['holy_symbol', 'component_pouch'],
    freeTopics: ['divine_magic'],
  },

  ranger: {
    type: 'ranger',
    name: 'Ranger',
    description: 'Nature warriors. Magic through connection to the wild. Hunter\'s mark.',

    spellcastingAbility: 'wis',
    slotProgression: 'half',
    preparedCaster: false,
    spellsKnownFormula: 'half_level + 2',

    requiresLore: true,      // Must understand nature
    requiresMaterials: true,
    canPayWithHealth: false,

    ritualCasting: false,
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: ['component_pouch'],
    freeTopics: ['nature_magic'],
  },

  artificer: {
    type: 'artificer',
    name: 'Artificer',
    description: 'Magic through technology. Infusions and inventions. Intelligence-based casting.',

    spellcastingAbility: 'int',
    slotProgression: 'half',
    preparedCaster: true,
    spellsPreparedFormula: 'half_level + int_mod',

    requiresLore: true,      // Must study technology
    requiresMaterials: true, // Tools are components
    canPayWithHealth: false,

    ritualCasting: true,
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: false,
    infusions: true,

    focusType: ['artisan_tools', 'component_pouch'],
    freeTopics: ['arcane_theory'],
  },

  none: {
    type: 'none',
    name: 'Non-Caster',
    description: 'No spellcasting ability.',

    spellcastingAbility: 'int',
    slotProgression: 'none',
    preparedCaster: false,

    requiresLore: false,
    requiresMaterials: false,
    canPayWithHealth: false,

    ritualCasting: false,
    metamagic: false,
    divineIntervention: false,
    channelDivinity: false,
    wildShape: false,
    invocations: false,
    infusions: false,

    focusType: [],
    freeTopics: [],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get caster profile for a class.
 */
export function getCasterProfile(type: CasterType): CasterProfile {
  return CASTER_PROFILES[type];
}

/**
 * Get spell slots for a caster at a given level.
 */
export function getSpellSlots(
  type: CasterType,
  level: number
): { level: number; max: number; used: number }[] {
  const profile = CASTER_PROFILES[type];

  if (profile.slotProgression === 'none') {
    return [];
  }

  if (profile.slotProgression === 'pact') {
    const pact = WARLOCK_PACT_SLOTS[level];
    return [{ level: pact.level, max: pact.slots, used: 0 }];
  }

  let slotTable: Record<number, number[]>;
  switch (profile.slotProgression) {
    case 'full':
      slotTable = FULL_CASTER_SLOTS;
      break;
    case 'half':
      slotTable = HALF_CASTER_SLOTS;
      break;
    case 'third':
      slotTable = THIRD_CASTER_SLOTS;
      break;
    default:
      return [];
  }

  const slots = slotTable[level] || [];
  return slots.map((max, index) => ({
    level: index + 1,
    max,
    used: 0,
  }));
}

/**
 * Check if a caster can use blood magic (pay HP for slots).
 */
export function canUseBloodMagic(type: CasterType): boolean {
  return CASTER_PROFILES[type].canPayWithHealth;
}

/**
 * Calculate HP cost for blood magic.
 */
export function calculateBloodCost(
  type: CasterType,
  spellLevel: number
): number {
  const profile = CASTER_PROFILES[type];
  if (!profile.canPayWithHealth) return 0;

  const multiplier = profile.healthCostMultiplier || 3;
  return spellLevel * multiplier;
}

/**
 * Check if a class bypasses lore requirements.
 */
export function bypassesLore(type: CasterType): boolean {
  return !CASTER_PROFILES[type].requiresLore;
}

/**
 * Check if a class bypasses material requirements.
 */
export function bypassesMaterials(type: CasterType): boolean {
  return !CASTER_PROFILES[type].requiresMaterials;
}

/**
 * Get the spellcasting ability for a class.
 */
export function getSpellcastingAbility(type: CasterType): 'int' | 'wis' | 'cha' {
  return CASTER_PROFILES[type].spellcastingAbility;
}

/**
 * Check if a caster has a valid focus.
 */
export function hasValidFocus(
  type: CasterType,
  equippedItems: string[]
): boolean {
  const profile = CASTER_PROFILES[type];
  if (profile.focusType.includes('self')) return true;  // Sorcerer

  return profile.focusType.some(focus =>
    equippedItems.includes(focus)
  );
}
