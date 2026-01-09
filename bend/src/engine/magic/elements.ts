/**
 * SPELL ELEMENTS - Prime Number Composition for Magic
 *
 * Each magical concept maps to a prime number.
 * Spell identity = product of primes.
 * Fireball = Fire³ × Area² × Ranged × Instant
 *
 * The seed IS the spell. Forever. Everywhere.
 *
 * This extends the genesis element system with magical concepts.
 */

import type { ElementType } from '../../genesis/elements';
import type { SpellSchool } from './types';

// ============================================
// SPELL ELEMENT TYPES
// ============================================

export interface SpellElement {
  prime: number;
  type: ElementType;
  school?: SpellSchool;
  name: string;
  description: string;
}

// ============================================
// DAMAGE TYPES (FLUX/ENTROPY - Change and Destruction)
// ============================================

export const DAMAGE_ELEMENTS: Record<string, SpellElement> = {
  Fire: {
    prime: 137,
    type: 'FLUX',
    school: 'evocation',
    name: 'Fire',
    description: 'Heat, combustion, light. The most visible form of energy transformation.',
  },
  Cold: {
    prime: 139,
    type: 'FORM',
    school: 'evocation',
    name: 'Cold',
    description: 'Absence of heat, crystallization, stasis. Form imposed on motion.',
  },
  Lightning: {
    prime: 149,
    type: 'FLUX',
    school: 'evocation',
    name: 'Lightning',
    description: 'Electrical potential seeking ground. Pure directed energy.',
  },
  Acid: {
    prime: 151,
    type: 'ENTROPY',
    school: 'conjuration',
    name: 'Acid',
    description: 'Dissolution, breaking bonds. Entropy in liquid form.',
  },
  Poison: {
    prime: 157,
    type: 'ENTROPY',
    school: 'necromancy',
    name: 'Poison',
    description: 'Biological disruption. Life turned against itself.',
  },
  Necrotic: {
    prime: 163,
    type: 'ENTROPY',
    school: 'necromancy',
    name: 'Necrotic',
    description: 'Anti-life energy. The touch of the void.',
  },
  Radiant: {
    prime: 167,
    type: 'AETHER',
    school: 'evocation',
    name: 'Radiant',
    description: 'Divine light, holy energy. The opposite of necrotic.',
  },
  Force: {
    prime: 173,
    type: 'FORM',
    school: 'evocation',
    name: 'Force',
    description: 'Pure magical energy. No resistance, no bypass.',
  },
  Psychic: {
    prime: 179,
    type: 'AETHER',
    school: 'enchantment',
    name: 'Psychic',
    description: 'Mental assault. Damage to the mind, not the body.',
  },
  Thunder: {
    prime: 181,
    type: 'FLUX',
    school: 'evocation',
    name: 'Thunder',
    description: 'Sonic force, pressure waves. The sound of power.',
  },
};

// ============================================
// DELIVERY MECHANISMS (AETHER - Control/Balance)
// ============================================

export const DELIVERY_ELEMENTS: Record<string, SpellElement> = {
  Ranged: {
    prime: 191,
    type: 'AETHER',
    name: 'Ranged',
    description: 'Effect delivered at a distance. Projectile or ray.',
  },
  Touch: {
    prime: 193,
    type: 'AETHER',
    name: 'Touch',
    description: 'Requires physical contact. Intimate and powerful.',
  },
  Self: {
    prime: 197,
    type: 'AETHER',
    name: 'Self',
    description: 'Affects only the caster. Inward-focused magic.',
  },
  Area: {
    prime: 199,
    type: 'AETHER',
    name: 'Area',
    description: 'Affects a zone. Sphere of influence.',
  },
  Cone: {
    prime: 211,
    type: 'AETHER',
    name: 'Cone',
    description: 'Expanding wave from the caster. Breath weapons.',
  },
  Line: {
    prime: 223,
    type: 'AETHER',
    name: 'Line',
    description: 'Straight path of effect. Piercing ray.',
  },
  Chain: {
    prime: 227,
    type: 'AETHER',
    name: 'Chain',
    description: 'Jumps between targets. Spreading effect.',
  },
};

// ============================================
// SCHOOL EFFECTS (Mixed types)
// ============================================

export const SCHOOL_ELEMENTS: Record<string, SpellElement> = {
  Healing: {
    prime: 229,
    type: 'VITALITY',
    school: 'evocation',
    name: 'Healing',
    description: 'Restoration of life force. Closing wounds.',
  },
  Buff: {
    prime: 233,
    type: 'VITALITY',
    school: 'transmutation',
    name: 'Buff',
    description: 'Enhancement. Making the target more than they were.',
  },
  Debuff: {
    prime: 239,
    type: 'ENTROPY',
    school: 'enchantment',
    name: 'Debuff',
    description: 'Weakening. Making the target less than they were.',
  },
  Summon: {
    prime: 241,
    type: 'AETHER',
    school: 'conjuration',
    name: 'Summon',
    description: 'Calling from elsewhere. Manifesting the absent.',
  },
  Illusion: {
    prime: 251,
    type: 'AETHER',
    school: 'illusion',
    name: 'Illusion',
    description: 'False seeming. Reality as the mind perceives it.',
  },
  Divination: {
    prime: 257,
    type: 'AETHER',
    school: 'divination',
    name: 'Divination',
    description: 'Knowing the unknown. Piercing veils.',
  },
  Abjuration: {
    prime: 263,
    type: 'FORM',
    school: 'abjuration',
    name: 'Abjuration',
    description: 'Protection, warding, banishment. Saying no to reality.',
  },
  Transform: {
    prime: 269,
    type: 'FLUX',
    school: 'transmutation',
    name: 'Transform',
    description: 'Changing form. Making one thing into another.',
  },
  Control: {
    prime: 271,
    type: 'AETHER',
    school: 'enchantment',
    name: 'Control',
    description: 'Dominating will. Making others serve.',
  },
  Animate: {
    prime: 277,
    type: 'ENTROPY',
    school: 'necromancy',
    name: 'Animate',
    description: 'False life. Motion without soul.',
  },
  Teleport: {
    prime: 281,
    type: 'AETHER',
    school: 'conjuration',
    name: 'Teleport',
    description: 'Folding space. Being elsewhere instantly.',
  },
  Create: {
    prime: 283,
    type: 'FORM',
    school: 'conjuration',
    name: 'Create',
    description: 'Making from nothing. Temporary existence.',
  },
};

// ============================================
// DURATION MODIFIERS
// ============================================

export const DURATION_ELEMENTS: Record<string, SpellElement> = {
  Instant: {
    prime: 293,
    type: 'FLUX',
    name: 'Instant',
    description: 'Happens immediately and ends. No duration.',
  },
  Sustained: {
    prime: 307,
    type: 'FORM',
    name: 'Sustained',
    description: 'Requires concentration. Active maintenance.',
  },
  Lasting: {
    prime: 311,
    type: 'FORM',
    name: 'Lasting',
    description: 'Persists without concentration. Minutes to hours.',
  },
  Permanent: {
    prime: 313,
    type: 'FORM',
    name: 'Permanent',
    description: 'Lasts until dispelled. Reality altered.',
  },
  Ritual: {
    prime: 317,
    type: 'AETHER',
    name: 'Ritual',
    description: 'Extended casting. Power through patience.',
  },
};

// ============================================
// INTENSITY MODIFIERS
// ============================================

export const INTENSITY_ELEMENTS: Record<string, SpellElement> = {
  Minor: {
    prime: 331,
    type: 'FORM',
    name: 'Minor',
    description: 'Cantrip level. Trivial exertion.',
  },
  Lesser: {
    prime: 337,
    type: 'FORM',
    name: 'Lesser',
    description: 'Low power. 1st-2nd level equivalent.',
  },
  Standard: {
    prime: 347,
    type: 'FORM',
    name: 'Standard',
    description: 'Normal power. 3rd-5th level equivalent.',
  },
  Greater: {
    prime: 349,
    type: 'FORM',
    name: 'Greater',
    description: 'High power. 6th-7th level equivalent.',
  },
  Supreme: {
    prime: 353,
    type: 'FORM',
    name: 'Supreme',
    description: 'Near-maximum power. 8th level equivalent.',
  },
  Ultimate: {
    prime: 359,
    type: 'AETHER',
    name: 'Ultimate',
    description: '9th level. Reality-bending.',
  },
};

// ============================================
// COMBINED ELEMENTS MAP
// ============================================

export const SPELL_ELEMENTS: Record<string, SpellElement> = {
  ...DAMAGE_ELEMENTS,
  ...DELIVERY_ELEMENTS,
  ...SCHOOL_ELEMENTS,
  ...DURATION_ELEMENTS,
  ...INTENSITY_ELEMENTS,
};

// ============================================
// COMPOSITION FUNCTIONS
// ============================================

/**
 * Compose a spell from its elements.
 * Returns the unique seed that IS the spell.
 */
export function composeSpell(elements: Record<string, number>): bigint {
  // Build prime composition from spell elements
  const primeComposition: Record<string, number> = {};

  for (const [elementName, count] of Object.entries(elements)) {
    const element = SPELL_ELEMENTS[elementName];
    if (element) {
      // Use element name as key, but we need to map to prime
      // For now, store as-is and handle in factorization
      primeComposition[elementName] = count;
    }
  }

  // Calculate product of primes
  let seed = 1n;
  for (const [elementName, count] of Object.entries(elements)) {
    const element = SPELL_ELEMENTS[elementName];
    if (element) {
      seed *= BigInt(element.prime) ** BigInt(count);
    }
  }

  return seed;
}

/**
 * Factorize a spell seed back to its elements.
 */
export function factorizeSpell(seed: bigint): Record<string, number> {
  const elements: Record<string, number> = {};
  let remaining = seed;

  // Build reverse lookup
  const primeToElement: Record<number, string> = {};
  for (const [name, element] of Object.entries(SPELL_ELEMENTS)) {
    primeToElement[element.prime] = name;
  }

  // Get primes sorted descending (larger primes first for efficiency)
  const primes = Object.values(SPELL_ELEMENTS)
    .map(e => e.prime)
    .sort((a, b) => b - a);

  for (const prime of primes) {
    const bigPrime = BigInt(prime);
    let count = 0;
    while (remaining % bigPrime === 0n) {
      count++;
      remaining = remaining / bigPrime;
    }
    if (count > 0) {
      const elementName = primeToElement[prime];
      if (elementName) {
        elements[elementName] = count;
      }
    }
  }

  return elements;
}

/**
 * Get the dominant school of a spell from its composition.
 */
export function getSpellSchool(elements: Record<string, number>): string | null {
  // Find the element with highest count that has a school
  let dominant: { name: string; count: number; school?: string } | null = null;

  for (const [name, count] of Object.entries(elements)) {
    const element = SPELL_ELEMENTS[name];
    if (element?.school) {
      if (!dominant || count > dominant.count) {
        dominant = { name, count, school: element.school };
      }
    }
  }

  return dominant?.school || null;
}

/**
 * Calculate the base level of a spell from its composition.
 * More complex compositions = higher level.
 */
export function calculateSpellLevel(elements: Record<string, number>): number {
  // Sum of all element counts determines complexity
  const totalComplexity = Object.values(elements).reduce((sum, count) => sum + count, 0);

  // Check for intensity modifiers
  if (elements['Ultimate']) return 9;
  if (elements['Supreme']) return 8;
  if (elements['Greater']) return Math.min(7, Math.max(6, Math.floor(totalComplexity / 2)));
  if (elements['Standard']) return Math.min(5, Math.max(3, Math.floor(totalComplexity / 2)));
  if (elements['Lesser']) return Math.min(2, Math.max(1, Math.floor(totalComplexity / 3)));
  if (elements['Minor']) return 0;

  // Default calculation: complexity / 3, capped at 9
  return Math.min(9, Math.max(0, Math.floor(totalComplexity / 3)));
}

/**
 * Calculate entropy risk based on spell composition.
 * Higher-level spells, necrotic/void effects = more entropy.
 */
export function calculateEntropyRisk(elements: Record<string, number>): number {
  let baseRisk = 0;

  // Entropy-type elements add risk
  for (const [name, count] of Object.entries(elements)) {
    const element = SPELL_ELEMENTS[name];
    if (element?.type === 'ENTROPY') {
      baseRisk += count * 10;
    }
    if (element?.school === 'necromancy') {
      baseRisk += count * 5;
    }
  }

  // Intensity increases risk
  if (elements['Ultimate']) baseRisk += 30;
  if (elements['Supreme']) baseRisk += 20;
  if (elements['Greater']) baseRisk += 10;

  // Cap at 100
  return Math.min(100, baseRisk);
}

// ============================================
// EXAMPLE SPELL COMPOSITIONS
// ============================================

export const EXAMPLE_SPELLS = {
  // Fireball: 3rd level evocation, 8d6 fire, 20ft radius
  Fireball: {
    elements: { Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 }),
  },

  // Magic Missile: 1st level evocation, 3×1d4+1 force, auto-hit
  MagicMissile: {
    elements: { Force: 3, Ranged: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Force: 3, Ranged: 1, Instant: 1, Lesser: 1 }),
  },

  // Cure Wounds: 1st level evocation, touch healing
  CureWounds: {
    elements: { Healing: 2, Touch: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Healing: 2, Touch: 1, Instant: 1, Lesser: 1 }),
  },

  // Hold Person: 2nd level enchantment, paralyze humanoid
  HoldPerson: {
    elements: { Control: 2, Debuff: 1, Ranged: 1, Sustained: 1, Lesser: 1 },
    seed: composeSpell({ Control: 2, Debuff: 1, Ranged: 1, Sustained: 1, Lesser: 1 }),
  },

  // Animate Dead: 3rd level necromancy, raise skeleton/zombie
  AnimateDead: {
    elements: { Animate: 3, Touch: 1, Lasting: 1, Standard: 1 },
    seed: composeSpell({ Animate: 3, Touch: 1, Lasting: 1, Standard: 1 }),
  },

  // Wish: 9th level, reality alteration
  Wish: {
    elements: { Create: 3, Transform: 3, Teleport: 2, Permanent: 1, Ultimate: 1 },
    seed: composeSpell({ Create: 3, Transform: 3, Teleport: 2, Permanent: 1, Ultimate: 1 }),
  },
};
