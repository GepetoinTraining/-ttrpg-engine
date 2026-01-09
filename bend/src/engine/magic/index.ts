/**
 * MAGIC SYSTEM - Unified Exports
 *
 * Magic is chemistry with a different substrate.
 * Spells are compositions. Components are reagents.
 * Spell slots are thermodynamic budgets. Reality pushes back.
 *
 * This module provides:
 * - Prime-based spell composition (seeds ARE spells)
 * - 5-axis cost system (energy, materials, lore, entropy, biome)
 * - 4 difficulty modes (EASY -> BRUTAL where magic doesn't exist)
 * - White Wolf paradigm magic (paradox, lore gates)
 * - Class identity (Wizard studies, Sorcerer bleeds)
 * - Scroll batteries (capture abundance for scarcity)
 */

// ============================================
// TYPES - Core Interfaces
// ============================================

export {
  // Schemas (for runtime validation)
  SpellSchoolSchema,
  SpellScaleSchema,
  DamageTypeSchema,
  BiomeTypeSchema,
  MaterialRequirementSchema,
  LoreRequirementSchema,
  SpellCostSchema,
  SpellEffectSchema,
  SpellFormulaSchema,
  CasterStateSchema,
  CastResultSchema,
  LoreEntrySchema,
  ScrollItemSchema,
  ParadoxResultSchema,
  ResolvedCostSchema,

  // Types
  type SpellSchool,
  type SpellScale,
  type DamageType,
  type BiomeType,
  type MaterialRequirement,
  type LoreRequirement,
  type SpellCost,
  type SpellEffect,
  type SpellFormula,
  type CasterState,
  type CastResult,
  type LoreEntry,
  type ScrollItem,
  type ParadoxResult,
  type ResolvedCost,
} from './types';

// ============================================
// ELEMENTS - Prime Number Composition
// ============================================

export {
  // Element collections
  DAMAGE_ELEMENTS,
  DELIVERY_ELEMENTS,
  SCHOOL_ELEMENTS,
  DURATION_ELEMENTS,
  INTENSITY_ELEMENTS,
  SPELL_ELEMENTS,

  // Composition functions
  composeSpell,
  factorizeSpell,
  getSpellSchool,
  calculateSpellLevel,
  calculateEntropyRisk,

  // Example spells
  EXAMPLE_SPELLS,

  // Types
  type SpellElement,
} from './elements';

// ============================================
// DIFFICULTY - Physics Dial for Magic
// ============================================

export {
  // Schema
  DifficultyModeSchema,

  // Configurations
  DIFFICULTY_CONFIGS,

  // Functions
  getDifficultyConfig,
  magicAvailable,
  featureEnabled,
  getEntropyMultiplier,
  modifyEntropyRisk,
  modifyLoreXp,
  getDifficultyDelta,
  getCampaignConfig,

  // Types
  type DifficultyMode,
  type DifficultyConfig,
  type CampaignMagicSettings,
} from './difficulty';

// ============================================
// LORE - Knowledge Gates
// ============================================

export {
  // Schema
  LoreTopicSchema,

  // Constants
  LORE_SOURCES,
  CLASS_LORE_PROFILES,

  // Manager class
  LoreManager,

  // Functions
  getDefaultLoreRequirements,
  classHasFreeLore,

  // Types
  type LoreTopic,
  type LoreSource,
  type ClassLoreProfile,
} from './lore';

// ============================================
// PARADOX - Entropy and Backlash
// ============================================

export {
  // Schema
  ParadoxSeveritySchema,

  // Tables
  FIZZLE_EFFECTS,
  MINOR_EFFECTS,
  MAJOR_EFFECTS,
  CATASTROPHIC_EFFECTS,
  WILD_MAGIC_TABLE,

  // Engine
  ParadoxEngine,

  // Functions
  rollWildMagic,

  // Types
  type ParadoxSeverity,
  type BacklashEffect,
  type WildMagicEffect,
} from './paradox';

// ============================================
// CASTER - Class Identity
// ============================================

export {
  // Schema
  CasterTypeSchema,

  // Profiles and slot tables
  CASTER_PROFILES,
  FULL_CASTER_SLOTS,
  HALF_CASTER_SLOTS,
  THIRD_CASTER_SLOTS,
  WARLOCK_PACT_SLOTS,

  // Functions
  getCasterProfile,
  getSpellSlots,
  canUseBloodMagic,
  calculateBloodCost,
  bypassesLore,
  bypassesMaterials,
  getSpellcastingAbility,
  hasValidFocus,

  // Types
  type CasterType,
  type CasterProfile,
  type SlotProgression,
} from './caster';

// ============================================
// COSTS - Multi-dimensional Cost System
// ============================================

export {
  // Substitution rules
  MATERIAL_SUBSTITUTES,

  // Calculator
  CostCalculator,

  // Blood magic
  getBloodMagicOptions,
  convertHealthToSlot,

  // Types
  type InventoryQuery,
  type InventoryItem,
  type CostFailure,
  type BloodMagicOption,
} from './costs';

// ============================================
// SCROLLS - Spell Batteries
// ============================================

export {
  // Quality modifiers
  SCROLL_QUALITY_MODS,

  // Functions
  calculateScribingCost,
  scribeScroll,
  useScroll,
  getScrollMarketPrice,
  getScrollRarity,
  getScrollsOfSpell,
  getScrollsByLevel,
  getScrollInventoryValue,
  sortScrolls,
  planDowntimeScribing,

  // Types
  type ScrollQuality,
  type ScrollQualityMod,
  type ScribingCost,
  type ScribingResult,
  type ScrollUseResult,
  type DowntimeScribingPlan,
} from './scrolls';

// ============================================
// ENGINE - Main Spell Resolution
// ============================================

export {
  // Class
  SpellEngine,

  // Singleton
  getSpellEngine,
  resetSpellEngine,

  // Convenience functions
  quickCast,
  isSpellAvailable,
} from './engine';

// ============================================
// REST EVENTS - Timeline-Aware Resets
// ============================================

export {
  // Types
  RestEventTypeSchema,
  RestEventSchema,
  type RestEventType,
  type RestEvent,

  // Recording
  recordRestEvent,

  // Queries
  getLastRestEvent,
  getEntropyResetBoundary,
  getRestEventsSince,

  // Computed state
  computeCurrentEntropy,
  computeCurrentSlots,
} from './rest-events';
