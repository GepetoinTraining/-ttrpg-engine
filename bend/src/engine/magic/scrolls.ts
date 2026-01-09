/**
 * SCROLL SYSTEM - Spell Batteries
 *
 * Scrolls are spells captured in material form.
 * Made during abundance, used during scarcity.
 *
 * The wizard who stockpiles scrolls survives.
 * The wizard who doesn't throws rocks.
 *
 * Scribing costs:
 * - Time: spell level × 8 hours
 * - Gold: spell level² × 25 gp
 * - Materials: spell components + ink + parchment
 * - Slot: must have the slot to scribe
 *
 * Using scrolls:
 * - Lore check required (can't read what you don't understand)
 * - No slot cost (baked into the scroll)
 * - No material cost (baked in)
 * - Scroll consumed on use (unless masterwork)
 */

import { randomUUID } from 'crypto';
import type { SpellFormula, CasterState, ScrollItem } from './types';
import { LoreManager, classHasFreeLore } from './lore';
import { getDifficultyConfig, type DifficultyMode } from './difficulty';
import { getCasterProfile } from './caster';

// ============================================
// SCROLL QUALITY
// ============================================

export type ScrollQuality = 'poor' | 'standard' | 'fine' | 'masterwork';

export interface ScrollQualityMod {
  name: string;
  description: string;
  dcModifier: number;      // Modifier to use DC
  valueMultiplier: number; // Multiplier to base price
  failureChance: number;   // % chance scroll malfunctions
  multiUse: boolean;       // Can be used multiple times?
  maxCharges?: number;     // If multi-use, how many?
}

export const SCROLL_QUALITY_MODS: Record<ScrollQuality, ScrollQualityMod> = {
  poor: {
    name: 'Poor',
    description: 'Hastily scribed or damaged. Unreliable.',
    dcModifier: 2,         // +2 to DC to use
    valueMultiplier: 0.5,  // Half price
    failureChance: 20,     // 20% chance of failure
    multiUse: false,
  },
  standard: {
    name: 'Standard',
    description: 'Properly scribed scroll.',
    dcModifier: 0,
    valueMultiplier: 1.0,
    failureChance: 5,      // 5% chance of mishap
    multiUse: false,
  },
  fine: {
    name: 'Fine',
    description: 'Expertly crafted with premium materials.',
    dcModifier: -2,        // -2 to DC (easier to use)
    valueMultiplier: 2.0,
    failureChance: 0,
    multiUse: false,
  },
  masterwork: {
    name: 'Masterwork',
    description: 'A work of art. Can be used multiple times.',
    dcModifier: -4,
    valueMultiplier: 5.0,
    failureChance: 0,
    multiUse: true,
    maxCharges: 3,
  },
};

// ============================================
// SCRIBING COSTS
// ============================================

export interface ScribingCost {
  timeHours: number;
  goldCost: number;
  inkCost: number;
  parchmentCost: number;
  spellComponentsCost: number;  // Same as casting
  totalGold: number;
  requiredSlotLevel: number;
}

/**
 * Calculate the cost to scribe a scroll.
 */
export function calculateScribingCost(
  spell: SpellFormula,
  quality: ScrollQuality = 'standard'
): ScribingCost {
  const level = spell.level === 0 ? 0.5 : spell.level;  // Cantrips = 0.5
  const qualityMod = SCROLL_QUALITY_MODS[quality];

  const timeHours = Math.max(2, level * 8);  // Minimum 2 hours for cantrips
  const baseGold = level * level * 25;
  const inkCost = level * 10;
  const parchmentCost = Math.ceil(level / 2) * 5;

  // Component cost from spell
  let spellComponentsCost = 0;
  if (spell.cost.materials) {
    for (const mat of spell.cost.materials) {
      spellComponentsCost += (mat.goldValue || 0) * mat.quantity;
    }
  }

  const totalGold = Math.ceil(
    (baseGold + inkCost + parchmentCost + spellComponentsCost) * qualityMod.valueMultiplier
  );

  return {
    timeHours,
    goldCost: baseGold,
    inkCost,
    parchmentCost,
    spellComponentsCost,
    totalGold,
    requiredSlotLevel: spell.level,
  };
}

// ============================================
// SCROLL CREATION
// ============================================

export interface ScribingResult {
  success: boolean;
  scroll?: ScrollItem;
  reason?: string;
}

/**
 * Attempt to scribe a scroll.
 */
export function scribeScroll(
  spell: SpellFormula,
  caster: CasterState,
  quality: ScrollQuality = 'standard',
  availableGold: number,
  availableTime: number
): ScribingResult {
  const cost = calculateScribingCost(spell, quality);

  // Check if caster knows the spell (has lore or is innate caster)
  const profile = getCasterProfile(caster.casterType);
  if (profile.requiresLore && spell.cost.lore) {
    if (!LoreManager.hasRequiredLore(spell.cost.lore, caster.lore)) {
      return {
        success: false,
        reason: 'Insufficient knowledge to scribe this spell',
      };
    }
  }

  // Check resources
  if (availableGold < cost.totalGold) {
    return {
      success: false,
      reason: `Insufficient gold (need ${cost.totalGold} gp, have ${availableGold} gp)`,
    };
  }

  if (availableTime < cost.timeHours) {
    return {
      success: false,
      reason: `Insufficient time (need ${cost.timeHours} hours, have ${availableTime} hours)`,
    };
  }

  // Check if caster has a slot of the required level
  if (spell.level > 0) {
    const hasSlot = caster.slots.some(s => s.level >= spell.level);
    if (!hasSlot) {
      return {
        success: false,
        reason: `Cannot scribe level ${spell.level} spell - no slot of that level`,
      };
    }
  }

  // Create the scroll
  const qualityMod = SCROLL_QUALITY_MODS[quality];
  const scroll: ScrollItem = {
    id: randomUUID(),
    spellId: spell.id,
    spellName: spell.name,
    spellLevel: spell.level,
    scribedBy: caster.characterId,
    scriberLevel: caster.casterLevel,
    quality,
    charges: qualityMod.multiUse ? (qualityMod.maxCharges || 1) : 1,
    maxCharges: qualityMod.multiUse ? (qualityMod.maxCharges || 1) : 1,
    baseValue: cost.totalGold,
    createdAt: new Date(),
  };

  return {
    success: true,
    scroll,
  };
}

// ============================================
// SCROLL USAGE
// ============================================

export interface ScrollUseResult {
  success: boolean;
  consumed: boolean;
  chargesRemaining: number;
  reason?: string;
  wildMagic?: boolean;
}

/**
 * Use a scroll to cast a spell.
 */
export function useScroll(
  scroll: ScrollItem,
  caster: CasterState,
  spellFormula: SpellFormula,
  difficulty: DifficultyMode
): ScrollUseResult {
  const config = getDifficultyConfig(difficulty);
  const qualityMod = SCROLL_QUALITY_MODS[scroll.quality];

  // Check lore requirement
  if (config.loreGatesActive && spellFormula.cost.lore) {
    const profile = getCasterProfile(caster.casterType);
    if (profile.requiresLore) {
      for (const req of spellFormula.cost.lore) {
        if (!classHasFreeLore(caster.casterType, req.topic)) {
          const entry = caster.lore[req.topic];
          if (!entry || entry.level < req.level) {
            return {
              success: false,
              consumed: false,
              chargesRemaining: scroll.charges,
              reason: `Cannot read scroll - insufficient ${req.topic} knowledge`,
            };
          }
        }
      }
    }
  }

  // Check for scroll failure (quality-based)
  if (qualityMod.failureChance > 0) {
    const roll = Math.random() * 100;
    if (roll < qualityMod.failureChance) {
      return {
        success: false,
        consumed: true,  // Scroll is consumed on failure
        chargesRemaining: 0,
        reason: 'Scroll malfunctions and crumbles to dust',
        wildMagic: true,  // Trigger wild magic on scroll failure
      };
    }
  }

  // Check if spell level exceeds caster's ability (DC check)
  if (scroll.spellLevel > 0) {
    // DC = 10 + spell level + quality modifier
    const dc = 10 + scroll.spellLevel + qualityMod.dcModifier;

    // Roll = d20 + spellcasting modifier
    const roll = Math.floor(Math.random() * 20) + 1 + caster.spellcastingMod;

    // If spell level is higher than caster's max, must make check
    const maxCasterSlot = Math.max(...caster.slots.map(s => s.level), 0);

    if (scroll.spellLevel > maxCasterSlot) {
      if (roll < dc) {
        return {
          success: false,
          consumed: true,
          chargesRemaining: 0,
          reason: `Failed to cast from scroll (rolled ${roll} vs DC ${dc})`,
          wildMagic: true,
        };
      }
    }
  }

  // Success! Use a charge
  const newCharges = scroll.charges - 1;
  const consumed = !qualityMod.multiUse || newCharges <= 0;

  return {
    success: true,
    consumed,
    chargesRemaining: Math.max(0, newCharges),
  };
}

// ============================================
// SCROLL MARKET
// ============================================

/**
 * Get market price for a scroll.
 */
export function getScrollMarketPrice(
  spellLevel: number,
  quality: ScrollQuality = 'standard'
): number {
  const qualityMod = SCROLL_QUALITY_MODS[quality];
  const level = spellLevel === 0 ? 0.5 : spellLevel;
  const basePrice = level * level * 25;
  return Math.ceil(basePrice * qualityMod.valueMultiplier * 1.5);  // 50% markup
}

/**
 * Get rarity category for a scroll.
 */
export function getScrollRarity(spellLevel: number): string {
  if (spellLevel === 0) return 'common';
  if (spellLevel <= 2) return 'common';
  if (spellLevel <= 4) return 'uncommon';
  if (spellLevel <= 6) return 'rare';
  if (spellLevel <= 8) return 'very_rare';
  return 'legendary';
}

// ============================================
// SCROLL INVENTORY HELPERS
// ============================================

/**
 * Get all scrolls of a specific spell.
 */
export function getScrollsOfSpell(
  scrolls: ScrollItem[],
  spellId: string
): ScrollItem[] {
  return scrolls.filter(s => s.spellId === spellId);
}

/**
 * Get scrolls by level range.
 */
export function getScrollsByLevel(
  scrolls: ScrollItem[],
  minLevel: number,
  maxLevel: number
): ScrollItem[] {
  return scrolls.filter(
    s => s.spellLevel >= minLevel && s.spellLevel <= maxLevel
  );
}

/**
 * Get total value of scroll inventory.
 */
export function getScrollInventoryValue(scrolls: ScrollItem[]): number {
  return scrolls.reduce((sum, s) => sum + s.baseValue, 0);
}

/**
 * Sort scrolls by level, then name.
 */
export function sortScrolls(scrolls: ScrollItem[]): ScrollItem[] {
  return [...scrolls].sort((a, b) => {
    if (a.spellLevel !== b.spellLevel) {
      return a.spellLevel - b.spellLevel;
    }
    return a.spellName.localeCompare(b.spellName);
  });
}

// ============================================
// DOWNTIME SCROLL SCRIBING
// ============================================

export interface DowntimeScribingPlan {
  scrollsToScribe: {
    spell: SpellFormula;
    quality: ScrollQuality;
    cost: ScribingCost;
  }[];
  totalTimeHours: number;
  totalGoldCost: number;
  feasible: boolean;
  reason?: string;
}

/**
 * Plan scroll scribing for a downtime period.
 */
export function planDowntimeScribing(
  spells: SpellFormula[],
  availableHours: number,
  availableGold: number,
  quality: ScrollQuality = 'standard'
): DowntimeScribingPlan {
  const scrollsToScribe: DowntimeScribingPlan['scrollsToScribe'] = [];
  let totalTime = 0;
  let totalGold = 0;

  for (const spell of spells) {
    const cost = calculateScribingCost(spell, quality);

    if (totalTime + cost.timeHours <= availableHours &&
        totalGold + cost.totalGold <= availableGold) {
      scrollsToScribe.push({ spell, quality, cost });
      totalTime += cost.timeHours;
      totalGold += cost.totalGold;
    }
  }

  return {
    scrollsToScribe,
    totalTimeHours: totalTime,
    totalGoldCost: totalGold,
    feasible: scrollsToScribe.length > 0,
    reason: scrollsToScribe.length === 0
      ? 'Insufficient time or gold for any scroll'
      : undefined,
  };
}
