/**
 * CHARACTER TOPOLOGY
 * ==================
 *
 * A character is TWO things:
 * 1. TOKEN (topology) - The physics-enabled thing that EXISTS in the world
 * 2. ATOM (sheet) - The stats/abilities projection
 *
 * The TOKEN is the source of truth. The ATOM is derived.
 *
 * Birth flow:
 * 1. Player's seed (from topology auth) → parent topology
 * 2. Character choices (race, class, etc.) → element composition
 * 3. Compose topology → character seed
 * 4. Store: seed (source) + projected stats (cache)
 * 5. On observation: factorize seed → derive current state
 *
 * The seed IS the character. Forever. Everywhere.
 */

import { compose, factorize, getDominantType, calculateEntropy, type ElementType } from './elements';
import { generateEntropy, generateUID, type BirthData } from './identity';
import { PHI } from './laws';

// ============================================
// CHARACTER ELEMENTS
// ============================================

/**
 * Character element primes - extending beyond base elements
 * These represent the essential nature of character aspects
 *
 * Using primes > 23 (after Uranium) for character-specific elements
 */
export const CHARACTER_ELEMENTS = {
  // Races (29-47)
  HUMAN: 29,      // Adaptable, balanced
  ELF: 31,        // Magical, long-lived
  DWARF: 37,      // Sturdy, earth-bound
  HALFLING: 41,   // Lucky, nimble
  GNOME: 43,      // Inventive, curious
  HALF_ORC: 47,   // Strong, fierce

  // Classes (53-79)
  FIGHTER: 53,    // Martial prowess
  WIZARD: 59,     // Arcane mastery
  CLERIC: 61,     // Divine connection
  ROGUE: 67,      // Cunning, stealth
  BARBARIAN: 71,  // Primal fury
  BARD: 73,       // Inspiration, magic
  RANGER: 79,     // Nature, tracking

  // Ability focuses (83-103)
  MIGHT: 83,      // STR focus
  AGILITY: 89,    // DEX focus
  VITALITY: 97,   // CON focus
  INTELLECT: 101, // INT focus
  INSIGHT: 103,   // WIS focus
  PRESENCE: 107,  // CHA focus

  // Alignments (109-131)
  LAWFUL: 109,
  CHAOTIC: 113,
  GOOD: 127,
  EVIL: 131,
} as const;

// Reverse lookup
export const PRIME_TO_CHARACTER_ELEMENT: Record<number, string> = {};
for (const [name, prime] of Object.entries(CHARACTER_ELEMENTS)) {
  PRIME_TO_CHARACTER_ELEMENT[prime] = name;
}

// ============================================
// RACE TOPOLOGIES
// ============================================

export interface RaceTopology {
  name: string;
  prime: number;
  baseElements: Record<string, number>;
  abilityBonus: Record<string, number>;
  traits: string[];
}

export const RACE_TOPOLOGIES: Record<string, RaceTopology> = {
  human: {
    name: 'Human',
    prime: CHARACTER_ELEMENTS.HUMAN,
    baseElements: { C: 2, O: 1, N: 1 },  // Carbon-based, balanced
    abilityBonus: { all: 1 },  // +1 to all
    traits: ['versatile', 'adaptable'],
  },
  elf: {
    name: 'Elf',
    prime: CHARACTER_ELEMENTS.ELF,
    baseElements: { Au: 1, O: 1 },  // Gold + oxygen = ethereal
    abilityBonus: { dexterity: 2 },
    traits: ['darkvision', 'fey_ancestry', 'trance'],
  },
  dwarf: {
    name: 'Dwarf',
    prime: CHARACTER_ELEMENTS.DWARF,
    baseElements: { Fe: 2, Si: 1 },  // Iron + silicon = earth
    abilityBonus: { constitution: 2 },
    traits: ['darkvision', 'dwarven_resilience', 'stonecunning'],
  },
  halfling: {
    name: 'Halfling',
    prime: CHARACTER_ELEMENTS.HALFLING,
    baseElements: { H: 3, C: 1 },  // Light, nimble
    abilityBonus: { dexterity: 2 },
    traits: ['lucky', 'brave', 'nimble'],
  },
  gnome: {
    name: 'Gnome',
    prime: CHARACTER_ELEMENTS.GNOME,
    baseElements: { Si: 1, Au: 1, H: 1 },  // Curious mix
    abilityBonus: { intelligence: 2 },
    traits: ['darkvision', 'gnome_cunning'],
  },
  'half-orc': {
    name: 'Half-Orc',
    prime: CHARACTER_ELEMENTS.HALF_ORC,
    baseElements: { Fe: 2, N: 1, U: 1 },  // Iron will, primal
    abilityBonus: { strength: 2, constitution: 1 },
    traits: ['darkvision', 'relentless_endurance', 'savage_attacks'],
  },
};

// ============================================
// CLASS TOPOLOGIES
// ============================================

export interface ClassTopology {
  name: string;
  prime: number;
  baseElements: Record<string, number>;
  primaryAbility: string;
  hitDie: number;
}

export const CLASS_TOPOLOGIES: Record<string, ClassTopology> = {
  fighter: {
    name: 'Fighter',
    prime: CHARACTER_ELEMENTS.FIGHTER,
    baseElements: { Fe: 2, H: 1 },  // Iron + energy
    primaryAbility: 'strength',
    hitDie: 10,
  },
  wizard: {
    name: 'Wizard',
    prime: CHARACTER_ELEMENTS.WIZARD,
    baseElements: { Au: 2, N: 1 },  // Gold + aether
    primaryAbility: 'intelligence',
    hitDie: 6,
  },
  cleric: {
    name: 'Cleric',
    prime: CHARACTER_ELEMENTS.CLERIC,
    baseElements: { Au: 1, O: 2 },  // Divine breath
    primaryAbility: 'wisdom',
    hitDie: 8,
  },
  rogue: {
    name: 'Rogue',
    prime: CHARACTER_ELEMENTS.ROGUE,
    baseElements: { H: 3, N: 1 },  // Quick, shadowy
    primaryAbility: 'dexterity',
    hitDie: 8,
  },
  barbarian: {
    name: 'Barbarian',
    prime: CHARACTER_ELEMENTS.BARBARIAN,
    baseElements: { Fe: 1, U: 1, H: 2 },  // Primal fury
    primaryAbility: 'strength',
    hitDie: 12,
  },
  bard: {
    name: 'Bard',
    prime: CHARACTER_ELEMENTS.BARD,
    baseElements: { Au: 1, H: 2, O: 1 },  // Inspiring
    primaryAbility: 'charisma',
    hitDie: 8,
  },
  ranger: {
    name: 'Ranger',
    prime: CHARACTER_ELEMENTS.RANGER,
    baseElements: { C: 2, N: 1, H: 1 },  // Nature-bound
    primaryAbility: 'dexterity',
    hitDie: 10,
  },
};

// ============================================
// CHARACTER BIRTH
// ============================================

export interface CharacterBirthInput {
  // Parent topology (player's seed from topology auth)
  playerSeedId: string;

  // Character choices
  name: string;
  race: string;
  class: string;
  background?: string;

  // Ability scores (rolled or assigned)
  abilityScores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };

  // Birth moment (for unique identity)
  birthData?: Partial<BirthData>;
}

export interface CharacterToken {
  // Core identity
  id: string;           // UUID
  uid: string;          // Genesis UID (unforgeable)
  seed: bigint;         // Composed topology

  // Lineage
  playerSeedId: string; // Topology auth seed ID (parent)

  // Birth record
  birthTimestamp: number;
  birthEntropy: string;

  // Topology breakdown (for debugging/display)
  topology: Record<string, number>;
  dominantType: ElementType;
  entropy: number;
}

export interface CharacterAtom {
  // Projected from token
  name: string;
  race: string;
  class: string;
  level: number;
  background: string | null;

  // Ability scores
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;

  // Derived stats
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  proficiencyBonus: number;

  // Traits from topology
  traits: string[];
}

/**
 * Birth a character - create its topology and project initial stats
 */
export async function birthCharacter(
  input: CharacterBirthInput
): Promise<{ token: CharacterToken; atom: CharacterAtom }> {
  const raceTopology = RACE_TOPOLOGIES[input.race.toLowerCase()];
  const classTopology = CLASS_TOPOLOGIES[input.class.toLowerCase()];

  if (!raceTopology) {
    throw new Error(`Unknown race: ${input.race}`);
  }
  if (!classTopology) {
    throw new Error(`Unknown class: ${input.class}`);
  }

  // Generate birth data for unique identity
  const birthEntropy = input.birthData?.entropy || generateEntropy();
  const birthTimestamp = input.birthData?.timestamp || Date.now();

  // Create birth data for UID generation
  const birthData: BirthData = {
    coordinates: input.birthData?.coordinates || { latitude: 0, longitude: 0, accuracy: 0 },
    timestamp: birthTimestamp,
    entropy: birthEntropy,
    userAgent: input.birthData?.userAgent || 'genesis-character-birth',
  };

  // Generate unique character UID
  const uid = await generateUID(birthData);

  // Build the character's element topology
  const topology: Record<string, number> = {};

  // 1. Add race elements
  for (const [element, count] of Object.entries(raceTopology.baseElements)) {
    topology[element] = (topology[element] || 0) + count;
  }

  // 2. Add class elements
  for (const [element, count] of Object.entries(classTopology.baseElements)) {
    topology[element] = (topology[element] || 0) + count;
  }

  // 3. Add ability focus based on highest score
  const abilities = Object.entries(input.abilityScores);
  abilities.sort((a, b) => b[1] - a[1]);
  const primaryAbility = abilities[0][0];

  const abilityElement = {
    strength: 'Fe',      // Iron = strength
    dexterity: 'H',      // Hydrogen = speed
    constitution: 'Si',  // Silicon = stability
    intelligence: 'Au',  // Gold = brilliance
    wisdom: 'N',         // Nitrogen = insight
    charisma: 'O',       // Oxygen = breath/voice
  }[primaryAbility];

  if (abilityElement) {
    topology[abilityElement] = (topology[abilityElement] || 0) + 1;
  }

  // 4. Compose into seed (multiply primes for base elements)
  //    Then multiply by race and class primes
  const baseSeed = compose(topology);
  const seed = baseSeed * BigInt(raceTopology.prime) * BigInt(classTopology.prime);

  // Create token
  const token: CharacterToken = {
    id: crypto.randomUUID(),
    uid,
    seed,
    playerSeedId: input.playerSeedId,
    birthTimestamp,
    birthEntropy,
    topology: {
      ...topology,
      [raceTopology.name]: 1,
      [classTopology.name]: 1,
    },
    dominantType: getDominantType(topology),
    entropy: calculateEntropy(topology),
  };

  // Apply racial ability bonuses
  const bonusedScores = { ...input.abilityScores };
  for (const [ability, bonus] of Object.entries(raceTopology.abilityBonus)) {
    if (ability === 'all') {
      for (const key of Object.keys(bonusedScores) as (keyof typeof bonusedScores)[]) {
        bonusedScores[key] += bonus;
      }
    } else if (ability in bonusedScores) {
      bonusedScores[ability as keyof typeof bonusedScores] += bonus;
    }
  }

  // Calculate derived stats
  const conMod = Math.floor((bonusedScores.constitution - 10) / 2);
  const dexMod = Math.floor((bonusedScores.dexterity - 10) / 2);

  const hpMax = classTopology.hitDie + conMod;
  const ac = 10 + dexMod;  // Unarmored
  const speed = input.race.toLowerCase() === 'dwarf' ? 25 : 30;

  // Create atom (projected stats)
  const atom: CharacterAtom = {
    name: input.name,
    race: raceTopology.name,
    class: classTopology.name,
    level: 1,
    background: input.background || null,
    ...bonusedScores,
    hpMax,
    hpCurrent: hpMax,
    ac,
    speed,
    proficiencyBonus: 2,
    traits: raceTopology.traits,
  };

  return { token, atom };
}

// ============================================
// TOPOLOGY OPERATIONS
// ============================================

/**
 * Factorize a character seed back into its components
 */
export function factorizeCharacter(seed: bigint): {
  baseTopology: Record<string, number>;
  race: RaceTopology | null;
  class: ClassTopology | null;
} {
  let remaining = seed;
  let race: RaceTopology | null = null;
  let classTopology: ClassTopology | null = null;

  // Check for race primes
  for (const [, raceTop] of Object.entries(RACE_TOPOLOGIES)) {
    const prime = BigInt(raceTop.prime);
    if (remaining % prime === 0n) {
      remaining /= prime;
      race = raceTop;
      break;
    }
  }

  // Check for class primes
  for (const [, classTop] of Object.entries(CLASS_TOPOLOGIES)) {
    const prime = BigInt(classTop.prime);
    if (remaining % prime === 0n) {
      remaining /= prime;
      classTopology = classTop;
      break;
    }
  }

  // Remaining is base element topology
  const baseTopology = factorize(remaining);

  return { baseTopology, race, class: classTopology };
}

/**
 * Calculate character power from seed
 * Used for encounter balancing, etc.
 */
export function calculatePower(seed: bigint): number {
  const { baseTopology, race, class: classTopology } = factorizeCharacter(seed);

  let power = 0;

  // Base from element entropy
  power += calculateEntropy(baseTopology) * 10;

  // Bonus from race/class (higher primes = rarer = stronger)
  if (race) {
    power += Math.log2(race.prime);
  }
  if (classTopology) {
    power += Math.log2(classTopology.prime);
  }

  return Math.round(power * PHI);
}

/**
 * Check if two characters share lineage (same player)
 */
export function shareLineage(token1: CharacterToken, token2: CharacterToken): boolean {
  return token1.playerSeedId === token2.playerSeedId;
}

/**
 * Evolve a character (level up, mutation, etc.)
 * Returns new seed with additional elements
 */
export function evolveCharacter(
  seed: bigint,
  evolution: Record<string, number>
): bigint {
  // Add new elements to existing topology
  const evolutionSeed = compose(evolution);
  return seed * evolutionSeed;
}
