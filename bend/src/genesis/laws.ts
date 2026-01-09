/**
 * LAWS OF THE UNIVERSE
 *
 * These constants govern all reality precipitation.
 * Derived from the golden ratio (Φ) and its complement.
 */

// The golden ratio - the universe's favorite number
export const PHI = 1.618033988749895;

// Complement of phi (1/φ = φ-1)
export const PHI_INVERSE = 0.618033988749895;

// Intent tax - entropy cost of manifestation
// Every act of creation costs 38.2% to entropy
export const INTENT_TAX = 1 - PHI_INVERSE; // 0.382

// Allocation ratios for resource distribution
export const ALLOC = 0.5;
export const FREE = 0.5;

// Fibonacci scaling for power progression
// Used in rank multipliers, damage scaling, etc.
export const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

// Rank multipliers following Fibonacci
export const RANK_MULTIPLIERS = {
  F: 1.0,
  E: 1.2,
  D: 1.5,
  C: 2.0,
  B: 3.0,
  A: 5.0,
  S: 8.0,
  SS: 13.0,
  SSS: 21.0,
} as const;

// Entropy thresholds - what complexity can exist at each phase
export const ENTROPY_THRESHOLDS = {
  VACUUM: 0,           // Nothing
  QUANTUM: 0.1,        // Fluctuations
  PARTICLE: 0.2,       // Stable particles
  ATOMIC: 0.3,         // Atoms form
  MOLECULAR: 0.4,      // Chemistry begins
  CELLULAR: 0.5,       // Life threshold
  CONSCIOUS: 0.618,    // Awareness emerges (φ⁻¹)
  TRANSCENDENT: 0.786, // φ⁻¹ + entropy headroom
} as const;

// Violence metrics - complexity destruction rates
export const VIOLENCE = {
  PEACEFUL: 0,
  TENSE: 0.1,
  SKIRMISH: 0.25,
  BATTLE: 0.5,
  WAR: 0.75,
  CATACLYSM: 1.0,
} as const;

// Time constants
export const TICK_MS = 16;  // ~60fps
export const BEAT_MS = 1000; // Narrative beat
export const ROUND_MS = 6000; // Combat round (6 seconds)
