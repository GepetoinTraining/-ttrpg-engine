/**
 * DIFFICULTY MODES - Physics Dial for Magic
 *
 * EASY     → Power fantasy. Infinite reagents. Spell slots only.
 * NORMAL   → D20 RAW. Track components, shops always have stock.
 * HARD     → White Wolf in D20. Entropy, lore gates, economy matters.
 * BRUTAL   → No magic. Technology only. Want fireball? Invent napalm.
 */

import { z } from 'zod';

// ============================================
// DIFFICULTY MODES
// ============================================

export const DifficultyModeSchema = z.enum([
  'EASY',
  'NORMAL',
  'HARD',
  'BRUTAL',
]);

export type DifficultyMode = z.infer<typeof DifficultyModeSchema>;

// ============================================
// DIFFICULTY CONFIGURATION
// ============================================

export interface DifficultyConfig {
  // Display
  name: string;
  description: string;

  // Component tracking
  trackMaterials: boolean;           // Do we track spell components?
  materialsConsumed: boolean;        // Are components used up?
  infiniteCommonMaterials: boolean;  // Are basic components always available?
  requireFocus: boolean;             // Must have arcane focus?

  // Lore requirements
  requireLore: boolean;              // Must have studied the spell?
  loreGatesActive: boolean;          // Are knowledge gates enforced?
  loreXpMultiplier: number;          // How fast do you learn?

  // Entropy/Paradox
  entropyEnabled: boolean;           // Can spells backfire?
  entropyMultiplier: number;         // How risky is reality?
  entropyDecayRate: number;          // How fast does daily entropy reset?

  // Economy integration
  economyAffectsAvailability: boolean;  // Do supply chains matter?
  priceFluctuation: boolean;            // Do component prices change?
  scrollsAsResource: boolean;           // Are scrolls important?

  // Class differences
  classIdentityStrong: boolean;      // Do Wizard/Sorcerer feel different?
  sorcererHealthCost: boolean;       // Can sorcerers pay in blood?

  // Magic existence
  magicExists: boolean;              // Does magic work at all?

  // Combat integration
  concentrationChecks: boolean;      // Must maintain concentration?
  counterspellEnabled: boolean;      // Can spells be countered?

  // Metamagic (Sorcerer)
  metamagicCostMultiplier: number;   // How expensive is metamagic?

  // Wild Magic
  wildMagicEnabled: boolean;         // Random magical effects?
  wildMagicChance: number;           // Base % chance on cast
}

// ============================================
// DIFFICULTY CONFIGURATIONS
// ============================================

export const DIFFICULTY_CONFIGS: Record<DifficultyMode, DifficultyConfig> = {
  EASY: {
    name: 'Easy',
    description: 'Power fantasy. Cast spells freely without resource management.',

    trackMaterials: false,
    materialsConsumed: false,
    infiniteCommonMaterials: true,
    requireFocus: false,

    requireLore: false,
    loreGatesActive: false,
    loreXpMultiplier: 3.0,

    entropyEnabled: false,
    entropyMultiplier: 0,
    entropyDecayRate: 1.0,

    economyAffectsAvailability: false,
    priceFluctuation: false,
    scrollsAsResource: false,

    classIdentityStrong: false,
    sorcererHealthCost: false,

    magicExists: true,

    concentrationChecks: false,
    counterspellEnabled: true,

    metamagicCostMultiplier: 0.5,

    wildMagicEnabled: false,
    wildMagicChance: 0,
  },

  NORMAL: {
    name: 'Normal',
    description: 'Standard D20 rules. Track spell slots and expensive components.',

    trackMaterials: true,
    materialsConsumed: true,
    infiniteCommonMaterials: true,  // Shops always have basics
    requireFocus: true,

    requireLore: false,
    loreGatesActive: false,
    loreXpMultiplier: 1.0,

    entropyEnabled: false,
    entropyMultiplier: 0,
    entropyDecayRate: 1.0,

    economyAffectsAvailability: false,
    priceFluctuation: false,
    scrollsAsResource: true,

    classIdentityStrong: true,
    sorcererHealthCost: false,

    magicExists: true,

    concentrationChecks: true,
    counterspellEnabled: true,

    metamagicCostMultiplier: 1.0,

    wildMagicEnabled: true,
    wildMagicChance: 5,  // 5% on wild magic sorcerer
  },

  HARD: {
    name: 'Hard',
    description: 'White Wolf meets D20. Lore gates, entropy, economy. Magic has consequences.',

    trackMaterials: true,
    materialsConsumed: true,
    infiniteCommonMaterials: false,  // Must find/buy everything
    requireFocus: true,

    requireLore: true,
    loreGatesActive: true,
    loreXpMultiplier: 1.0,

    entropyEnabled: true,
    entropyMultiplier: 1.0,
    entropyDecayRate: 0.5,  // Entropy decays slower

    economyAffectsAvailability: true,
    priceFluctuation: true,
    scrollsAsResource: true,

    classIdentityStrong: true,
    sorcererHealthCost: true,  // Blood magic enabled

    magicExists: true,

    concentrationChecks: true,
    counterspellEnabled: true,

    metamagicCostMultiplier: 1.5,

    wildMagicEnabled: true,
    wildMagicChance: 10,
  },

  BRUTAL: {
    name: 'Brutal',
    description: 'No magic. Technology only. Want fireball? Invent napalm.',

    trackMaterials: true,
    materialsConsumed: true,
    infiniteCommonMaterials: false,
    requireFocus: true,

    requireLore: true,
    loreGatesActive: true,
    loreXpMultiplier: 0.5,  // Learning is harder

    entropyEnabled: true,
    entropyMultiplier: 2.0,  // Very dangerous
    entropyDecayRate: 0.25,  // Entropy lingers

    economyAffectsAvailability: true,
    priceFluctuation: true,
    scrollsAsResource: true,

    classIdentityStrong: true,
    sorcererHealthCost: true,

    magicExists: false,  // NO MAGIC

    concentrationChecks: true,
    counterspellEnabled: false,  // No magic = no counterspell

    metamagicCostMultiplier: 2.0,

    wildMagicEnabled: false,
    wildMagicChance: 0,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the configuration for a difficulty mode.
 */
export function getDifficultyConfig(mode: DifficultyMode): DifficultyConfig {
  return DIFFICULTY_CONFIGS[mode];
}

/**
 * Check if magic is available in this difficulty.
 */
export function magicAvailable(mode: DifficultyMode): boolean {
  return DIFFICULTY_CONFIGS[mode].magicExists;
}

/**
 * Check if a feature is enabled in this difficulty.
 */
export function featureEnabled(
  mode: DifficultyMode,
  feature: keyof DifficultyConfig
): boolean {
  const config = DIFFICULTY_CONFIGS[mode];
  const value = config[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return false;
}

/**
 * Get the entropy multiplier for a difficulty.
 */
export function getEntropyMultiplier(mode: DifficultyMode): number {
  return DIFFICULTY_CONFIGS[mode].entropyMultiplier;
}

/**
 * Calculate modified entropy risk based on difficulty.
 */
export function modifyEntropyRisk(
  baseRisk: number,
  mode: DifficultyMode
): number {
  const config = DIFFICULTY_CONFIGS[mode];
  if (!config.entropyEnabled) return 0;
  return Math.min(100, baseRisk * config.entropyMultiplier);
}

/**
 * Calculate lore XP gain modified by difficulty.
 */
export function modifyLoreXp(
  baseXp: number,
  mode: DifficultyMode
): number {
  return Math.floor(baseXp * DIFFICULTY_CONFIGS[mode].loreXpMultiplier);
}

/**
 * Get description of what's different from NORMAL mode.
 */
export function getDifficultyDelta(mode: DifficultyMode): string[] {
  const differences: string[] = [];

  if (mode === 'EASY') {
    differences.push('No material component tracking');
    differences.push('No focus required');
    differences.push('No concentration checks');
    differences.push('Faster lore learning (3x)');
    differences.push('Cheaper metamagic (0.5x)');
  }

  if (mode === 'HARD') {
    differences.push('Must find/buy ALL components');
    differences.push('Lore requirements enforced');
    differences.push('Entropy/paradox enabled');
    differences.push('Economy affects availability');
    differences.push('Sorcerers can pay in blood');
    differences.push('Wild magic more common (10%)');
  }

  if (mode === 'BRUTAL') {
    differences.push('MAGIC DOES NOT EXIST');
    differences.push('Technology only');
    differences.push('Slower learning (0.5x)');
    differences.push('If magic existed, 2x entropy');
  }

  return differences;
}

// ============================================
// CAMPAIGN SETTINGS INTEGRATION
// ============================================

export interface CampaignMagicSettings {
  baseDifficulty: DifficultyMode;

  // Overrides for specific features
  overrides?: Partial<DifficultyConfig>;

  // World-specific rules
  forbiddenSchools?: string[];      // Schools that don't exist
  restrictedSpells?: string[];      // Specific spells banned
  componentMultiplier?: number;     // Cost adjustment

  // House rules
  noHealingMagic?: boolean;
  noResurrection?: boolean;
  noTeleportation?: boolean;
  noDivination?: boolean;
}

/**
 * Merge campaign settings with base difficulty.
 */
export function getCampaignConfig(
  settings: CampaignMagicSettings
): DifficultyConfig {
  const base = DIFFICULTY_CONFIGS[settings.baseDifficulty];

  if (!settings.overrides) return base;

  return {
    ...base,
    ...settings.overrides,
  };
}
