/**
 * ELEMENTS - The Primes of Reality
 *
 * Each element maps to a prime number following the Kabbalah Sephirot.
 * Composition is multiplication. Decomposition is factorization.
 *
 * The seed of any compound IS its identity.
 */

// Element types - the five forces
export type ElementType = 'FLUX' | 'FORM' | 'VITALITY' | 'AETHER' | 'ENTROPY';

// Sephirot structure - the Tree of Life mapped to primes
export const SEPHIROT = {
  // FLUX - Energy, change, potential
  CHOKMAH: { prime: 2, symbol: 'H', name: 'Hydrogen', type: 'FLUX' as ElementType },

  // FORM - Structure, containment, boundary
  BINAH: { prime: 3, symbol: 'He', name: 'Helium', type: 'FORM' as ElementType },

  // VITALITY - Life, growth, carbon-based complexity
  CHESED: { prime: 5, symbol: 'C', name: 'Carbon', type: 'VITALITY' as ElementType },

  // Balance - the mediators
  GEVURAH: { prime: 7, symbol: 'N', name: 'Nitrogen', type: 'AETHER' as ElementType },
  TIFERET: { prime: 11, symbol: 'O', name: 'Oxygen', type: 'VITALITY' as ElementType },

  // Foundation - structural elements
  NETZACH: { prime: 13, symbol: 'Si', name: 'Silicon', type: 'FORM' as ElementType },
  HOD: { prime: 17, symbol: 'Fe', name: 'Iron', type: 'FORM' as ElementType },
  YESOD: { prime: 19, symbol: 'Au', name: 'Gold', type: 'AETHER' as ElementType },

  // ENTROPY - Decay, transformation, the void
  MALKUTH: { prime: 23, symbol: 'U', name: 'Uranium', type: 'ENTROPY' as ElementType },
} as const;

// Quick lookup by symbol
export const ELEMENTS: Record<string, { prime: number; name: string; type: ElementType }> = {
  H:  { prime: 2,  name: 'Hydrogen', type: 'FLUX' },
  He: { prime: 3,  name: 'Helium',   type: 'FORM' },
  C:  { prime: 5,  name: 'Carbon',   type: 'VITALITY' },
  N:  { prime: 7,  name: 'Nitrogen', type: 'AETHER' },
  O:  { prime: 11, name: 'Oxygen',   type: 'VITALITY' },
  Si: { prime: 13, name: 'Silicon',  type: 'FORM' },
  Fe: { prime: 17, name: 'Iron',     type: 'FORM' },
  Au: { prime: 19, name: 'Gold',     type: 'AETHER' },
  U:  { prime: 23, name: 'Uranium',  type: 'ENTROPY' },
};

// Reverse lookup: prime -> element
export const PRIME_TO_ELEMENT: Record<number, string> = {
  2: 'H',
  3: 'He',
  5: 'C',
  7: 'N',
  11: 'O',
  13: 'Si',
  17: 'Fe',
  19: 'Au',
  23: 'U',
};

// Known molecules - topology encoded as seeds
export const MOLECULES = {
  // Water: H2O = 2^2 * 11^1 = 4 * 11 = 44
  WATER: { formula: 'H2O', seed: 44, composition: { H: 2, O: 1 } },

  // Methane: CH4 = 5^1 * 2^4 = 5 * 16 = 80
  METHANE: { formula: 'CH4', seed: 80, composition: { C: 1, H: 4 } },

  // Carbon Dioxide: CO2 = 5^1 * 11^2 = 5 * 121 = 605
  CO2: { formula: 'CO2', seed: 605, composition: { C: 1, O: 2 } },

  // Ammonia: NH3 = 7^1 * 2^3 = 7 * 8 = 56
  AMMONIA: { formula: 'NH3', seed: 56, composition: { N: 1, H: 3 } },

  // Glucose: C6H12O6 = 5^6 * 2^12 * 11^6
  GLUCOSE: { formula: 'C6H12O6', seed: 5**6 * 2**12 * 11**6, composition: { C: 6, H: 12, O: 6 } },

  // Rust: Fe2O3 = 17^2 * 11^3 = 289 * 1331 = 384659
  RUST: { formula: 'Fe2O3', seed: 384659, composition: { Fe: 2, O: 3 } },

  // Gold (pure): Au = 19
  GOLD: { formula: 'Au', seed: 19, composition: { Au: 1 } },
} as const;

/**
 * Compose a topology into a seed
 * { H: 2, O: 1 } -> 2^2 * 11^1 = 44
 */
export function compose(topology: Record<string, number>): bigint {
  let seed = 1n;

  for (const [symbol, count] of Object.entries(topology)) {
    const element = ELEMENTS[symbol];
    if (!element) {
      throw new Error(`Unknown element: ${symbol}`);
    }
    seed *= BigInt(element.prime) ** BigInt(count);
  }

  return seed;
}

/**
 * Factorize a seed back into topology
 * 44 -> { H: 2, O: 1 }
 */
export function factorize(seed: bigint): Record<string, number> {
  const topology: Record<string, number> = {};
  let remaining = seed;

  // Check each prime in order
  const primes = Object.values(ELEMENTS).map(e => e.prime).sort((a, b) => a - b);

  for (const prime of primes) {
    const bigPrime = BigInt(prime);
    let count = 0;

    while (remaining % bigPrime === 0n) {
      remaining /= bigPrime;
      count++;
    }

    if (count > 0) {
      const symbol = PRIME_TO_ELEMENT[prime];
      topology[symbol] = count;
    }
  }

  // If there's remainder, it contains unknown primes
  if (remaining > 1n) {
    topology['?'] = Number(remaining); // Unknown matter
  }

  return topology;
}

/**
 * Get the dominant element type of a compound
 */
export function getDominantType(topology: Record<string, number>): ElementType {
  const typeCounts: Record<ElementType, number> = {
    FLUX: 0,
    FORM: 0,
    VITALITY: 0,
    AETHER: 0,
    ENTROPY: 0,
  };

  for (const [symbol, count] of Object.entries(topology)) {
    const element = ELEMENTS[symbol];
    if (element) {
      typeCounts[element.type] += count;
    }
  }

  let dominant: ElementType = 'AETHER';
  let maxCount = 0;

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = type as ElementType;
    }
  }

  return dominant;
}

/**
 * Calculate the entropy of a compound
 * More complex = higher entropy
 */
export function calculateEntropy(topology: Record<string, number>): number {
  let totalAtoms = 0;
  let uniqueElements = 0;

  for (const count of Object.values(topology)) {
    totalAtoms += count;
    uniqueElements++;
  }

  // Entropy scales with complexity
  // log(atoms) * diversity bonus
  return Math.log2(totalAtoms + 1) * (1 + uniqueElements * 0.1);
}
