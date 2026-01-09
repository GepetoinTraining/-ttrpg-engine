/**
 * COST CALCULATOR - Multi-Dimensional Spell Costs
 *
 * Every spell has 5 cost axes:
 * 1. Energy (spell slots) - Your ΔG budget
 * 2. Materials (reagents) - The chemistry
 * 3. Lore (knowledge) - What you understand
 * 4. Entropy (paradox risk) - Reality's resistance
 * 5. Biome (location) - Where you are
 *
 * Plus optional:
 * - Health (sorcerer blood magic)
 * - Focus (arcane focus requirement)
 */

import type {
  SpellFormula,
  CasterState,
  ResolvedCost,
} from './types';
import { getDifficultyConfig, type DifficultyMode } from './difficulty';
import {
  getCasterProfile,
  bypassesLore,
  bypassesMaterials,
} from './caster';
import { classHasFreeLore } from './lore';

// ============================================
// MATERIAL SUBSTITUTION RULES
// ============================================

export const MATERIAL_SUBSTITUTES: Record<string, string[]> = {
  // Fire spell components
  'Sulfur': ['AlchemistFire', 'VolcanicAsh', 'DragonsBreath'],
  'BatGuano': ['PhosphorusCompound', 'NitrateSalt', 'GuanoExtract'],

  // Cold spell components
  'IceShard': ['FrostEssence', 'WinterWolf_Fur', 'GlacialDust'],

  // Lightning spell components
  'CopperWire': ['BronzeFilament', 'GoldThread', 'SilverWire'],
  'Amber': ['StaticCrystal', 'StormCloud_Essence'],

  // Necromancy components
  'BoneFragment': ['GraveDust', 'SkeletonShard', 'UndeadAsh'],
  'BloodDrop': ['LifeEssence', 'VitalFluid'],

  // Illusion components
  'GlassBeads': ['CrystalDust', 'MirrorShard'],
  'Fleece': ['IllusionSilk', 'PhantomThread'],

  // Transmutation components
  'ClayPiece': ['EarthEssence', 'MoldableMatter'],
  'Mercury': ['QuicksilverDrop', 'TransmutationFluid'],

  // Enchantment components
  'CharmedToken': ['HypnoticPendant', 'EnchantedGem'],

  // Divination components
  'CrystalBall': ['SeerStone', 'DivinationOrb'],
  'OwlFeather': ['WisdomPlume', 'SightFeather'],

  // Abjuration components
  'IronFilings': ['SteelDust', 'ProtectiveMetal'],
  'Diamond': ['ProtectionGem', 'WardStone'],

  // Conjuration components
  'SummoningCircle': ['BindingRune', 'ConjurationSalt'],
  'PlanarEssence': ['ExtraplanarDust', 'RealmFragment'],

  // Universal substitutes
  'GenericArcane': ['ArcaneDust', 'ManaEssence', 'SpellComponent'],
};

// ============================================
// INVENTORY INTERFACE
// ============================================

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  element?: string;  // For spell components
}

export interface InventoryQuery {
  hasItem: (element: string) => boolean;
  getQuantity: (element: string) => number;
  findSubstitute: (element: string, substitutes: string[]) => string | null;
}

// ============================================
// COST RESOLUTION
// ============================================

export interface CostFailure {
  type: 'lore' | 'materials' | 'biome' | 'slots' | 'health' | 'focus';
  message: string;
  missing?: string;
  required?: number;
  available?: number;
}

export class CostCalculator {
  /**
   * Calculate the full resolved cost for casting a spell.
   */
  static calculate(
    spell: SpellFormula,
    caster: CasterState,
    difficulty: DifficultyMode,
    inventory: InventoryQuery
  ): ResolvedCost {
    const config = getDifficultyConfig(difficulty);
    const profile = getCasterProfile(caster.casterType);
    const failures: CostFailure[] = [];

    // ============================================
    // 1. ENERGY COST (Spell Slots)
    // ============================================

    const energyCost = spell.cost.energy;
    let slotsSatisfied = true;

    if (energyCost > 0) {
      // Find a slot of appropriate level or higher
      const availableSlot = caster.slots.find(
        s => s.level >= energyCost && s.used < s.max
      );

      if (!availableSlot) {
        slotsSatisfied = false;
        failures.push({
          type: 'slots',
          message: `No spell slot of level ${energyCost} or higher available`,
          required: energyCost,
        });
      }
    }

    // ============================================
    // 2. MATERIAL COSTS
    // ============================================

    const materialsCost: { element: string; quantity: number; itemId?: string }[] = [];
    let materialsSatisfied = true;

    if (config.trackMaterials && spell.cost.materials && !bypassesMaterials(caster.casterType)) {
      for (const req of spell.cost.materials) {
        // Check if we have the material
        if (inventory.hasItem(req.element)) {
          if (inventory.getQuantity(req.element) >= req.quantity) {
            materialsCost.push({
              element: req.element,
              quantity: req.quantity,
            });
          } else {
            materialsSatisfied = false;
            failures.push({
              type: 'materials',
              message: `Insufficient ${req.element}`,
              missing: req.element,
              required: req.quantity,
              available: inventory.getQuantity(req.element),
            });
          }
        } else if (req.substitutes) {
          // Try substitutes
          const substitute = inventory.findSubstitute(req.element, req.substitutes);
          if (substitute) {
            materialsCost.push({
              element: substitute,
              quantity: req.quantity,
            });
          } else if (!config.infiniteCommonMaterials) {
            materialsSatisfied = false;
            failures.push({
              type: 'materials',
              message: `Missing ${req.element} (no substitutes available)`,
              missing: req.element,
              required: req.quantity,
            });
          }
        } else if (!config.infiniteCommonMaterials) {
          // Check global substitutes
          const globalSubs = MATERIAL_SUBSTITUTES[req.element];
          if (globalSubs) {
            const substitute = inventory.findSubstitute(req.element, globalSubs);
            if (substitute) {
              materialsCost.push({
                element: substitute,
                quantity: req.quantity,
              });
            } else {
              materialsSatisfied = false;
              failures.push({
                type: 'materials',
                message: `Missing ${req.element}`,
                missing: req.element,
                required: req.quantity,
              });
            }
          } else {
            materialsSatisfied = false;
            failures.push({
              type: 'materials',
              message: `Missing ${req.element}`,
              missing: req.element,
              required: req.quantity,
            });
          }
        }
        // If infiniteCommonMaterials is true, we assume common materials are available
      }
    }

    // ============================================
    // 3. LORE REQUIREMENTS
    // ============================================

    let loreSatisfied = true;

    if (config.loreGatesActive && spell.cost.lore && !bypassesLore(caster.casterType)) {
      for (const req of spell.cost.lore) {
        // Check if class has free access to this topic
        if (classHasFreeLore(caster.casterType, req.topic)) {
          continue;
        }

        // Check caster's lore
        const casterLoreEntry = caster.lore[req.topic];
        if (!casterLoreEntry || casterLoreEntry.level < req.level) {
          loreSatisfied = false;
          failures.push({
            type: 'lore',
            message: `Insufficient knowledge of ${req.topic}`,
            missing: req.topic,
            required: req.level,
            available: casterLoreEntry?.level || 0,
          });
        }
      }
    }

    // ============================================
    // 4. BIOME REQUIREMENTS
    // ============================================

    let biomeSatisfied = true;

    if (spell.cost.biome && spell.cost.biome !== 'any') {
      if (caster.currentBiome !== spell.cost.biome) {
        biomeSatisfied = false;
        failures.push({
          type: 'biome',
          message: `Spell requires ${spell.cost.biome} biome`,
          missing: spell.cost.biome,
        });
      }
    }

    // ============================================
    // 5. FOCUS REQUIREMENT
    // ============================================

    if (config.requireFocus && profile.requiresMaterials) {
      if (!caster.hasFocus) {
        failures.push({
          type: 'focus',
          message: 'No arcane focus equipped',
        });
      }
    }

    // ============================================
    // 6. HEALTH COST (Sorcerer blood magic)
    // ============================================

    let healthCost = 0;

    if (spell.cost.health) {
      healthCost = spell.cost.health;
      if (caster.currentHP <= healthCost) {
        failures.push({
          type: 'health',
          message: `Insufficient HP for blood magic (need ${healthCost})`,
          required: healthCost,
          available: caster.currentHP,
        });
      }
    }

    // ============================================
    // 7. ENTROPY RISK
    // ============================================

    let entropyRisk = 0;

    if (config.entropyEnabled) {
      entropyRisk = spell.cost.entropy || 0;
      entropyRisk *= config.entropyMultiplier;

      // Add daily accumulated entropy
      entropyRisk += (caster.dailyEntropy || 0) * 0.1;
    }

    // ============================================
    // COMBINE RESULTS
    // ============================================

    const canCast = failures.length === 0;

    return {
      energyCost,
      materialsCost,
      healthCost,
      entropyRisk,

      loreSatisfied,
      biomeSatisfied,
      materialsSatisfied,
      slotsSatisfied,

      failures,
      canCast,
    };
  }

  /**
   * Check if a caster can afford a resolved cost.
   */
  static canAfford(cost: ResolvedCost): boolean {
    return cost.canCast;
  }

  /**
   * Pay the costs for casting a spell.
   * Returns the updated caster state.
   */
  static pay(
    cost: ResolvedCost,
    caster: CasterState,
    difficulty: DifficultyMode
  ): CasterState {
    const config = getDifficultyConfig(difficulty);
    const newCaster = { ...caster };

    // Pay spell slot
    if (cost.energyCost > 0) {
      const slotIndex = newCaster.slots.findIndex(
        s => s.level >= cost.energyCost && s.used < s.max
      );
      if (slotIndex >= 0) {
        newCaster.slots = [...newCaster.slots];
        newCaster.slots[slotIndex] = {
          ...newCaster.slots[slotIndex],
          used: newCaster.slots[slotIndex].used + 1,
        };
      }
    }

    // Pay health cost
    if (cost.healthCost > 0) {
      newCaster.currentHP = Math.max(0, newCaster.currentHP - cost.healthCost);
    }

    // Add entropy
    if (config.entropyEnabled) {
      newCaster.dailyEntropy = (newCaster.dailyEntropy || 0) + cost.entropyRisk;
    }

    // Note: Material consumption would be handled by inventory system

    return newCaster;
  }

  /**
   * Get a human-readable summary of costs.
   */
  static summarize(cost: ResolvedCost): string {
    const parts: string[] = [];

    if (cost.energyCost > 0) {
      parts.push(`Level ${cost.energyCost} spell slot`);
    }

    if (cost.materialsCost.length > 0) {
      const mats = cost.materialsCost
        .map(m => `${m.quantity}× ${m.element}`)
        .join(', ');
      parts.push(`Materials: ${mats}`);
    }

    if (cost.healthCost > 0) {
      parts.push(`${cost.healthCost} HP`);
    }

    if (cost.entropyRisk > 0) {
      parts.push(`${Math.round(cost.entropyRisk)}% paradox risk`);
    }

    if (parts.length === 0) {
      return 'No cost';
    }

    return parts.join(' | ');
  }

  /**
   * Get failure messages.
   */
  static getFailureMessage(cost: ResolvedCost): string {
    if (cost.canCast) return '';

    return cost.failures
      .map(f => f.message)
      .join('; ');
  }
}

// ============================================
// SORCERER BLOOD MAGIC
// ============================================

export interface BloodMagicOption {
  hpCost: number;
  slotLevel: number;
  viable: boolean;
}

/**
 * Calculate blood magic options for a sorcerer.
 * They can convert HP into spell slots.
 */
export function getBloodMagicOptions(
  caster: CasterState,
  maxSlotLevel: number = 5
): BloodMagicOption[] {
  const options: BloodMagicOption[] = [];

  const profile = getCasterProfile(caster.casterType);
  if (!profile.canPayWithHealth) {
    return options;
  }

  const multiplier = profile.healthCostMultiplier || 3;

  for (let level = 1; level <= maxSlotLevel; level++) {
    const hpCost = level * multiplier;
    options.push({
      hpCost,
      slotLevel: level,
      viable: caster.currentHP > hpCost,  // Must have HP > cost (can't kill yourself)
    });
  }

  return options;
}

/**
 * Convert HP to a spell slot (sorcerer blood magic).
 */
export function convertHealthToSlot(
  caster: CasterState,
  slotLevel: number
): CasterState | null {
  const options = getBloodMagicOptions(caster);
  const option = options.find(o => o.slotLevel === slotLevel);

  if (!option || !option.viable) {
    return null;
  }

  const newCaster = { ...caster };
  newCaster.currentHP -= option.hpCost;

  // Find or create a temporary slot
  const slotIndex = newCaster.slots.findIndex(s => s.level === slotLevel);
  if (slotIndex >= 0) {
    newCaster.slots = [...newCaster.slots];
    newCaster.slots[slotIndex] = {
      ...newCaster.slots[slotIndex],
      used: Math.max(0, newCaster.slots[slotIndex].used - 1),
    };
  }

  return newCaster;
}
