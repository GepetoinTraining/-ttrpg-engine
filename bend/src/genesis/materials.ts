/**
 * MATERIALS - Property-Based Crafting
 *
 * Items aren't defined by name. They're defined by composition.
 * A sword isn't "iron sword" - it's { Fe: 3, C: 1 }.
 * The physics (weight, hardness, conductivity) precipitate from that.
 *
 * Blueprints don't ask for "10 iron ingots".
 * They ask for "structural material, high hardness, 5 units".
 * You can use iron, steel, mithril, adamantine - the PROPERTIES determine the outcome.
 *
 * This unifies:
 * - Extraction shooter's MaterialPropertyType
 * - TTRPG's item crafting
 * - Genesis prime composition
 */

import { ELEMENTS, type ElementType } from './elements';

// ============================================
// MATERIAL PROPERTIES
// ============================================

export interface MaterialProperties {
  // Physical
  density: number;      // 0-1: affects weight, durability
  hardness: number;     // 0-1: affects damage, armor class
  elasticity: number;   // 0-1: affects flexibility, bounce

  // Thermal/Energy
  conductivity: number; // 0-1: affects lightning damage, tech speed
  temperature: number;  // 0-1: 0=cold, 1=hot (for magical materials)

  // Magical
  resonance: number;    // 0-1: affects magic capacity, spell storing
  luminosity: number;   // 0-1: emits light

  // Hazard
  toxicity: number;     // 0-1: poison damage, environmental hazard
  volatility: number;   // 0-1: explosive potential
}

// ============================================
// D&D MATERIALS → PRIME COMPOSITION
// ============================================

// Extend the element system with fantasy materials
export const FANTASY_ELEMENTS: Record<string, { prime: number; name: string; type: ElementType }> = {
  // Base metals (reuse existing)
  Fe: { prime: 17, name: 'Iron', type: 'FORM' },
  Au: { prime: 19, name: 'Gold', type: 'AETHER' },

  // Fantasy metals
  Ag: { prime: 29, name: 'Silver', type: 'AETHER' },
  Cu: { prime: 31, name: 'Copper', type: 'FLUX' },
  Mth: { prime: 37, name: 'Mithril', type: 'AETHER' },
  Adm: { prime: 41, name: 'Adamantine', type: 'FORM' },
  Orc: { prime: 43, name: 'Orichalcum', type: 'FLUX' },

  // Organic
  Wd: { prime: 47, name: 'Wood', type: 'VITALITY' },
  Bn: { prime: 53, name: 'Bone', type: 'FORM' },
  Lth: { prime: 59, name: 'Leather', type: 'VITALITY' },
  Slk: { prime: 61, name: 'Silk', type: 'VITALITY' },

  // Stone
  St: { prime: 67, name: 'Stone', type: 'FORM' },
  Obs: { prime: 71, name: 'Obsidian', type: 'ENTROPY' },
  Cry: { prime: 73, name: 'Crystal', type: 'AETHER' },

  // Magical
  Drg: { prime: 79, name: 'Dragonbone', type: 'FLUX' },
  Dem: { prime: 83, name: 'Demon Ichor', type: 'ENTROPY' },
  Cel: { prime: 89, name: 'Celestial Essence', type: 'AETHER' },
  Vd: { prime: 97, name: 'Void Crystal', type: 'ENTROPY' },

  // Enchanting catalysts
  Arc: { prime: 101, name: 'Arcane Dust', type: 'AETHER' },
  Soul: { prime: 103, name: 'Soul Fragment', type: 'VITALITY' },
  Fire: { prime: 107, name: 'Fire Essence', type: 'FLUX' },
  Ice: { prime: 109, name: 'Frost Essence', type: 'FORM' },
  Lgt: { prime: 113, name: 'Lightning Essence', type: 'FLUX' },
};

// Base properties for each material
const MATERIAL_PROPERTIES: Record<string, MaterialProperties> = {
  // Metals
  Fe: { density: 0.7, hardness: 0.6, elasticity: 0.3, conductivity: 0.5, temperature: 0.5, resonance: 0.1, luminosity: 0, toxicity: 0, volatility: 0 },
  Au: { density: 0.9, hardness: 0.3, elasticity: 0.4, conductivity: 0.9, temperature: 0.5, resonance: 0.4, luminosity: 0.1, toxicity: 0, volatility: 0 },
  Ag: { density: 0.8, hardness: 0.4, elasticity: 0.4, conductivity: 0.95, temperature: 0.4, resonance: 0.5, luminosity: 0.15, toxicity: 0.3, volatility: 0 }, // Toxic to undead/lycanthropes
  Cu: { density: 0.7, hardness: 0.4, elasticity: 0.5, conductivity: 0.9, temperature: 0.5, resonance: 0.2, luminosity: 0, toxicity: 0, volatility: 0 },
  Mth: { density: 0.3, hardness: 0.8, elasticity: 0.6, conductivity: 0.7, temperature: 0.4, resonance: 0.8, luminosity: 0.3, toxicity: 0, volatility: 0 },
  Adm: { density: 0.9, hardness: 1.0, elasticity: 0.1, conductivity: 0.3, temperature: 0.5, resonance: 0.3, luminosity: 0, toxicity: 0, volatility: 0 },
  Orc: { density: 0.6, hardness: 0.7, elasticity: 0.4, conductivity: 0.8, temperature: 0.7, resonance: 0.6, luminosity: 0.2, toxicity: 0, volatility: 0.1 },

  // Organic
  Wd: { density: 0.3, hardness: 0.3, elasticity: 0.6, conductivity: 0.1, temperature: 0.5, resonance: 0.3, luminosity: 0, toxicity: 0, volatility: 0.2 },
  Bn: { density: 0.4, hardness: 0.5, elasticity: 0.2, conductivity: 0.1, temperature: 0.4, resonance: 0.4, luminosity: 0, toxicity: 0, volatility: 0 },
  Lth: { density: 0.2, hardness: 0.2, elasticity: 0.8, conductivity: 0.05, temperature: 0.5, resonance: 0.2, luminosity: 0, toxicity: 0, volatility: 0.1 },
  Slk: { density: 0.1, hardness: 0.1, elasticity: 0.9, conductivity: 0.02, temperature: 0.5, resonance: 0.5, luminosity: 0, toxicity: 0, volatility: 0 },

  // Stone
  St: { density: 0.8, hardness: 0.7, elasticity: 0.1, conductivity: 0.1, temperature: 0.5, resonance: 0.1, luminosity: 0, toxicity: 0, volatility: 0 },
  Obs: { density: 0.7, hardness: 0.9, elasticity: 0.0, conductivity: 0.05, temperature: 0.3, resonance: 0.4, luminosity: 0, toxicity: 0, volatility: 0.3 },
  Cry: { density: 0.5, hardness: 0.6, elasticity: 0.1, conductivity: 0.6, temperature: 0.4, resonance: 0.9, luminosity: 0.4, toxicity: 0, volatility: 0.1 },

  // Magical
  Drg: { density: 0.5, hardness: 0.8, elasticity: 0.3, conductivity: 0.4, temperature: 0.8, resonance: 0.7, luminosity: 0.1, toxicity: 0.1, volatility: 0.2 },
  Dem: { density: 0.6, hardness: 0.5, elasticity: 0.5, conductivity: 0.3, temperature: 0.9, resonance: 0.6, luminosity: 0.3, toxicity: 0.8, volatility: 0.5 },
  Cel: { density: 0.2, hardness: 0.6, elasticity: 0.7, conductivity: 0.8, temperature: 0.3, resonance: 0.95, luminosity: 0.8, toxicity: 0, volatility: 0 },
  Vd: { density: 0.1, hardness: 0.4, elasticity: 0.3, conductivity: 0.1, temperature: 0.1, resonance: 0.8, luminosity: 0.5, toxicity: 0.4, volatility: 0.6 },

  // Essences
  Arc: { density: 0.05, hardness: 0, elasticity: 1, conductivity: 0.5, temperature: 0.5, resonance: 1.0, luminosity: 0.3, toxicity: 0, volatility: 0.3 },
  Soul: { density: 0, hardness: 0, elasticity: 1, conductivity: 0.2, temperature: 0.6, resonance: 0.9, luminosity: 0.2, toxicity: 0.2, volatility: 0.4 },
  Fire: { density: 0, hardness: 0, elasticity: 1, conductivity: 0.8, temperature: 1.0, resonance: 0.6, luminosity: 0.9, toxicity: 0.1, volatility: 0.8 },
  Ice: { density: 0.3, hardness: 0.4, elasticity: 0.2, conductivity: 0.3, temperature: 0, resonance: 0.5, luminosity: 0.3, toxicity: 0, volatility: 0.2 },
  Lgt: { density: 0, hardness: 0, elasticity: 1, conductivity: 1.0, temperature: 0.8, resonance: 0.7, luminosity: 1.0, toxicity: 0.2, volatility: 0.7 },
};

// ============================================
// MATERIAL COMPOSITION
// ============================================

export interface MaterialComposition {
  elements: Record<string, number>;  // Symbol → count
  seed: bigint;
  properties: MaterialProperties;
  dominantElement: string;
  tier: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
}

/**
 * Compose materials into a seed and calculate properties
 */
export function composeMaterial(elements: Record<string, number>): MaterialComposition {
  // Calculate seed (product of primes)
  let seed = 1n;
  for (const [symbol, count] of Object.entries(elements)) {
    const element = FANTASY_ELEMENTS[symbol] || ELEMENTS[symbol];
    if (element) {
      seed *= BigInt(element.prime) ** BigInt(count);
    }
  }

  // Calculate blended properties
  const properties = blendProperties(elements);

  // Find dominant element (highest count)
  let dominant = '';
  let maxCount = 0;
  for (const [symbol, count] of Object.entries(elements)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = symbol;
    }
  }

  // Calculate tier based on material rarity
  const tier = calculateTier(elements);

  return {
    elements,
    seed,
    properties,
    dominantElement: dominant,
    tier,
  };
}

/**
 * Blend properties from multiple materials
 */
function blendProperties(elements: Record<string, number>): MaterialProperties {
  const result: MaterialProperties = {
    density: 0, hardness: 0, elasticity: 0, conductivity: 0,
    temperature: 0, resonance: 0, luminosity: 0, toxicity: 0, volatility: 0,
  };

  let totalWeight = 0;

  for (const [symbol, count] of Object.entries(elements)) {
    const props = MATERIAL_PROPERTIES[symbol];
    if (!props) continue;

    const weight = count;
    totalWeight += weight;

    for (const key of Object.keys(result) as (keyof MaterialProperties)[]) {
      result[key] += props[key] * weight;
    }
  }

  if (totalWeight > 0) {
    for (const key of Object.keys(result) as (keyof MaterialProperties)[]) {
      result[key] /= totalWeight;
    }
  }

  return result;
}

/**
 * Calculate rarity tier from composition
 */
function calculateTier(elements: Record<string, number>): MaterialComposition['tier'] {
  const rareMaterials = ['Mth', 'Adm', 'Orc', 'Drg', 'Dem', 'Cel', 'Vd'];
  const veryRareMaterials = ['Adm', 'Cel', 'Vd'];
  const legendaryMaterials = ['Cel', 'Vd', 'Soul'];

  let maxRarity = 0;

  for (const symbol of Object.keys(elements)) {
    if (legendaryMaterials.includes(symbol)) maxRarity = Math.max(maxRarity, 4);
    else if (veryRareMaterials.includes(symbol)) maxRarity = Math.max(maxRarity, 3);
    else if (rareMaterials.includes(symbol)) maxRarity = Math.max(maxRarity, 2);
    else if (['Ag', 'Au'].includes(symbol)) maxRarity = Math.max(maxRarity, 1);
  }

  const tiers: MaterialComposition['tier'][] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact'];
  return tiers[Math.min(maxRarity, tiers.length - 1)];
}

// ============================================
// BLUEPRINTS (Property-based recipes)
// ============================================

export interface MaterialRequirement {
  slot: string;           // "blade", "hilt", "binding"
  tags: string[];         // Required properties: "structural", "conductive", "magical"
  minProperties?: Partial<MaterialProperties>;  // Minimum property values
  volume: number;         // Units required
}

// Materials that require magical binding to hold physical form
const REQUIRES_MAGICAL_BINDING: Set<string> = new Set([
  'Mth',   // Mithril - too ethereal
  'Cel',   // Celestial Essence - pure aether
  'Vd',    // Void Crystal - entropy-unstable
  'Arc',   // Arcane Dust - formless without binding
]);

/**
 * Check if a composition requires magical binding to be craftable
 */
export function requiresMagicalBinding(composition: MaterialComposition): boolean {
  for (const symbol of Object.keys(composition.elements)) {
    if (REQUIRES_MAGICAL_BINDING.has(symbol)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if composition has sufficient magical binding
 * Binding can come from:
 * - Another material with high resonance in the same slot
 * - A dedicated 'binding' slot with magical material
 * - Arcane dust mixed into the composition itself
 */
export function hasMagicalBinding(
  composition: MaterialComposition,
  allSlots: Record<string, MaterialComposition>
): boolean {
  // Self-binding: if the composition includes a binding agent
  if (composition.elements['Arc'] || composition.elements['Soul']) {
    return true;
  }

  // Check if a DIFFERENT slot provides magical binding (resonance >= 0.7)
  // Ethereal materials can't bind themselves - the binding must be external
  for (const mat of Object.values(allSlots)) {
    // Skip if this is the same composition (comparing by seed)
    if (mat.seed === composition.seed) {
      continue;
    }
    if (mat.properties.resonance >= 0.7) {
      return true;
    }
  }

  // Check for explicit binding slot (that's not the composition itself)
  if (allSlots['binding'] && allSlots['binding'].seed !== composition.seed) {
    return true;
  }

  return false;
}

export interface Blueprint {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'tool' | 'jewelry' | 'structure' | 'consumable';
  requirements: MaterialRequirement[];
  baseStats: Record<string, number>;
  description: string;
}

// Property tags for blueprint matching
const PROPERTY_TAGS: Record<string, (props: MaterialProperties) => boolean> = {
  structural: (p) => p.hardness >= 0.5,  // Only hardness matters for structural integrity
  flexible: (p) => p.elasticity >= 0.6,
  conductive: (p) => p.conductivity >= 0.6,
  magical: (p) => p.resonance >= 0.5,
  luminous: (p) => p.luminosity >= 0.3,
  toxic: (p) => p.toxicity >= 0.3,
  volatile: (p) => p.volatility >= 0.4,
  light: (p) => p.density <= 0.3,
  heavy: (p) => p.density >= 0.7,
  cold: (p) => p.temperature <= 0.3,
  hot: (p) => p.temperature >= 0.7,
  protective: (p) => p.hardness >= 0.6 && p.density >= 0.5,
  ornamental: (p) => p.luminosity >= 0.1 || p.conductivity >= 0.7,
};

/**
 * Check if a material composition satisfies a requirement
 */
export function satisfiesRequirement(
  composition: MaterialComposition,
  requirement: MaterialRequirement
): boolean {
  // Check tags
  for (const tag of requirement.tags) {
    const checker = PROPERTY_TAGS[tag];
    if (checker && !checker(composition.properties)) {
      return false;
    }
  }

  // Check minimum properties
  if (requirement.minProperties) {
    for (const [key, minValue] of Object.entries(requirement.minProperties)) {
      if (composition.properties[key as keyof MaterialProperties] < minValue) {
        return false;
      }
    }
  }

  return true;
}

// ============================================
// CRAFTING OUTCOME
// ============================================

export interface CraftedItem {
  blueprintId: string;
  name: string;
  composition: MaterialComposition;
  slots: Record<string, MaterialComposition>;  // slot → material used
  stats: Record<string, number>;               // Final calculated stats
  tier: MaterialComposition['tier'];
  specialEffects: string[];
}

/**
 * Craft an item from a blueprint and materials
 */
export function craft(
  blueprint: Blueprint,
  materials: Record<string, MaterialComposition>  // slot → material
): CraftedItem | { error: string } {
  // Validate all slots are filled
  for (const req of blueprint.requirements) {
    const mat = materials[req.slot];
    if (!mat) {
      return { error: `Missing material for slot: ${req.slot}` };
    }
    if (!satisfiesRequirement(mat, req)) {
      return { error: `Material in ${req.slot} doesn't satisfy requirements` };
    }

    // Check magical binding requirement
    if (requiresMagicalBinding(mat) && !hasMagicalBinding(mat, materials)) {
      const etherealMaterial = Object.keys(mat.elements).find(s => REQUIRES_MAGICAL_BINDING.has(s));
      return {
        error: `${etherealMaterial} requires magical binding to hold form. Add arcane dust to the composition or include a magical focus.`
      };
    }
  }

  // Calculate final stats based on material properties
  const stats = { ...blueprint.baseStats };
  const specialEffects: string[] = [];

  // Blend all material properties
  const allElements: Record<string, number> = {};
  for (const mat of Object.values(materials)) {
    for (const [symbol, count] of Object.entries(mat.elements)) {
      allElements[symbol] = (allElements[symbol] || 0) + count;
    }
  }
  const finalComposition = composeMaterial(allElements);

  // Modify stats based on properties
  if (stats.damage !== undefined) {
    // Harder materials do more damage
    stats.damage = Math.round(stats.damage * (1 + finalComposition.properties.hardness * 0.5));
  }

  if (stats.weight !== undefined) {
    // Denser materials are heavier
    stats.weight = Math.round(stats.weight * (0.5 + finalComposition.properties.density));
  }

  if (stats.ac !== undefined) {
    // Harder materials provide better AC
    stats.ac = Math.round(stats.ac + finalComposition.properties.hardness * 2);
  }

  // Add special effects based on properties
  if (finalComposition.properties.conductivity >= 0.7) {
    specialEffects.push('+1d6 lightning damage');
  }
  if (finalComposition.properties.luminosity >= 0.5) {
    specialEffects.push('Emits bright light 20ft, dim light 40ft');
  }
  if (finalComposition.properties.toxicity >= 0.5) {
    specialEffects.push('+1d6 poison damage, DC 13 CON save');
  }
  if (finalComposition.properties.resonance >= 0.8) {
    specialEffects.push('Can store 1 spell of 3rd level or lower');
  }
  if (finalComposition.properties.temperature >= 0.8) {
    specialEffects.push('+1d6 fire damage');
  }
  if (finalComposition.properties.temperature <= 0.2) {
    specialEffects.push('+1d6 cold damage');
  }

  // Generate name based on dominant material
  const dominantName = FANTASY_ELEMENTS[finalComposition.dominantElement]?.name
    || ELEMENTS[finalComposition.dominantElement]?.name
    || 'Unknown';
  const name = `${dominantName} ${blueprint.name}`;

  return {
    blueprintId: blueprint.id,
    name,
    composition: finalComposition,
    slots: materials,
    stats,
    tier: finalComposition.tier,
    specialEffects,
  };
}

// ============================================
// EXAMPLE BLUEPRINTS
// ============================================

export const BLUEPRINTS: Record<string, Blueprint> = {
  longsword: {
    id: 'longsword',
    name: 'Longsword',
    category: 'weapon',
    requirements: [
      { slot: 'blade', tags: ['structural'], volume: 3 },
      { slot: 'hilt', tags: [], volume: 1 },
    ],
    baseStats: { damage: 8, weight: 3 },
    description: 'A versatile one-handed sword',
  },

  chainmail: {
    id: 'chainmail',
    name: 'Chain Mail',
    category: 'armor',
    requirements: [
      { slot: 'rings', tags: ['structural'], minProperties: { hardness: 0.5 }, volume: 10 },
      { slot: 'padding', tags: ['flexible'], volume: 2 },
    ],
    baseStats: { ac: 16, weight: 55 },
    description: 'Interlocking metal rings over padding',
  },

  staff: {
    id: 'staff',
    name: 'Staff',
    category: 'weapon',
    requirements: [
      { slot: 'shaft', tags: [], volume: 2 },
      { slot: 'focus', tags: ['magical'], volume: 1 },
    ],
    baseStats: { damage: 6, weight: 4, spellBonus: 1 },
    description: 'A magical focus in staff form',
  },

  ring: {
    id: 'ring',
    name: 'Ring',
    category: 'jewelry',
    requirements: [
      { slot: 'band', tags: ['ornamental'], volume: 1 },
      { slot: 'gem', tags: ['magical'], volume: 1 },
    ],
    baseStats: {},
    description: 'A ring that can hold enchantments',
  },
};

// ============================================
// QUICK CRAFTING EXAMPLES
// ============================================

/**
 * Quick craft examples for testing
 */
export function exampleCrafting() {
  // Iron longsword - mundane, anyone can forge it
  const ironBlade = composeMaterial({ Fe: 3, C: 1 });
  const leatherHilt = composeMaterial({ Lth: 1 });
  const ironSword = craft(BLUEPRINTS.longsword, {
    blade: ironBlade,
    hilt: leatherHilt,
  });

  // Mithril longsword - FAILS without magical binding
  const pureMithrilBlade = composeMaterial({ Mth: 3 });
  const silverHilt = composeMaterial({ Ag: 1 });
  const mithrilSwordFailed = craft(BLUEPRINTS.longsword, {
    blade: pureMithrilBlade,
    hilt: silverHilt,
  });

  // Mithril longsword - SUCCESS with arcane dust binding
  const boundMithrilBlade = composeMaterial({ Mth: 3, Arc: 1 });  // Arcane dust binds the ethereal metal
  const mithrilSword = craft(BLUEPRINTS.longsword, {
    blade: boundMithrilBlade,
    hilt: silverHilt,
  });

  // Dragonbone staff with void crystal focus
  // Void crystal needs binding, but Arc is already in the focus
  const dragonShaft = composeMaterial({ Drg: 2 });
  const voidFocus = composeMaterial({ Vd: 1, Arc: 1 });
  const dragonStaff = craft(BLUEPRINTS.staff, {
    shaft: dragonShaft,
    focus: voidFocus,
  });

  return { ironSword, mithrilSwordFailed, mithrilSword, dragonStaff };
}
