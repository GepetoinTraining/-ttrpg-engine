/**
 * PRIMITIVES — Static primitive registry for hologram composition
 * ===============================================================
 *
 * One entry per MaterialClass (13 classes), 2-3 geometric variants each.
 * The hologram reads this registry in step 8 (composePrimitives) to instance
 * geometric atoms for each material class visible in a tile's composition.
 *
 * Each registry entry defines the geometric kind + a default base color +
 * available variant keys. `instancePrimitive` picks a variant deterministically
 * from the rng and returns a placed Primitive with position, scale, and rotation.
 */

import type { MaterialClass, Primitive } from './hologram'
import type { SeededRNG } from './hub-topology'

// ============================================================
// PRIMITIVE TEMPLATE
// ============================================================

export interface PrimitiveTemplate {
  geometry: Primitive['geometry']
  defaultColor: { r: number; g: number; b: number }
  variants: string[]
}

// ============================================================
// REGISTRY — one entry per MaterialClass
// ============================================================

export const PRIMITIVE_REGISTRY: Record<MaterialClass, PrimitiveTemplate[]> = {
  metal: [
    { geometry: 'polyhedron', defaultColor: { r: 160, g: 160, b: 172 }, variants: ['ore_lump', 'vein_seam', 'ingot_stack'] },
    { geometry: 'plane',      defaultColor: { r: 140, g: 140, b: 160 }, variants: ['plate_floor', 'grate_floor'] },
  ],
  stone: [
    { geometry: 'polyhedron', defaultColor: { r: 128, g: 120, b: 112 }, variants: ['boulder', 'cliff_face', 'rubble_pile'] },
    { geometry: 'plane',      defaultColor: { r: 110, g: 108, b: 100 }, variants: ['flagstone_floor', 'cave_floor'] },
  ],
  fiber: [
    { geometry: 'cylinder',   defaultColor: { r: 101, g: 130, b: 68  }, variants: ['tree_trunk', 'shrub_cluster'] },
    { geometry: 'card',       defaultColor: { r: 80,  g: 140, b: 60  }, variants: ['undergrowth', 'tall_grass'] },
    { geometry: 'volumetric', defaultColor: { r: 34,  g: 90,  b: 30  }, variants: ['dense_canopy', 'thicket'] },
  ],
  ceramic: [
    { geometry: 'polyhedron', defaultColor: { r: 210, g: 175, b: 130 }, variants: ['clay_pot', 'brick_stack'] },
    { geometry: 'plane',      defaultColor: { r: 190, g: 160, b: 120 }, variants: ['tile_floor', 'adobe_wall'] },
  ],
  glass: [
    { geometry: 'polyhedron', defaultColor: { r: 200, g: 230, b: 240 }, variants: ['crystal_shard', 'obsidian_node'] },
    { geometry: 'lattice',    defaultColor: { r: 180, g: 220, b: 235 }, variants: ['quartz_lattice', 'glass_pane'] },
  ],
  gem: [
    { geometry: 'polyhedron', defaultColor: { r: 100, g: 80,  b: 200 }, variants: ['faceted_gem', 'rough_crystal', 'gem_cluster'] },
    { geometry: 'lattice',    defaultColor: { r: 120, g: 60,  b: 220 }, variants: ['gem_lattice'] },
  ],
  soil: [
    { geometry: 'plane',      defaultColor: { r: 101, g: 67,  b: 33  }, variants: ['loam_flat', 'plowed_earth', 'muddy_ground'] },
    { geometry: 'card',       defaultColor: { r: 120, g: 80,  b: 40  }, variants: ['sandy_patch', 'peat_deposit'] },
  ],
  fluid: [
    { geometry: 'plane',      defaultColor: { r: 50,  g: 130, b: 200 }, variants: ['water_surface', 'pool_shallow', 'river_ford'] },
    { geometry: 'particles',  defaultColor: { r: 60,  g: 140, b: 210 }, variants: ['spray_mist', 'oil_slick'] },
  ],
  gas: [
    { geometry: 'particles',  defaultColor: { r: 200, g: 200, b: 210 }, variants: ['fog_wisp', 'smoke_column', 'miasma_cloud'] },
    { geometry: 'volumetric', defaultColor: { r: 180, g: 180, b: 200 }, variants: ['dense_fog', 'gas_vent'] },
  ],
  organic: [
    { geometry: 'card',       defaultColor: { r: 60,  g: 110, b: 50  }, variants: ['fallen_leaf', 'moss_patch', 'fungal_growth'] },
    { geometry: 'cylinder',   defaultColor: { r: 80,  g: 100, b: 60  }, variants: ['mushroom_ring', 'flesh_pillar'] },
  ],
  ice: [
    { geometry: 'polyhedron', defaultColor: { r: 200, g: 230, b: 255 }, variants: ['ice_chunk', 'permafrost_slab'] },
    { geometry: 'plane',      defaultColor: { r: 210, g: 235, b: 255 }, variants: ['frozen_surface', 'glacier_shelf'] },
  ],
  crystal: [
    { geometry: 'lattice',    defaultColor: { r: 180, g: 100, b: 255 }, variants: ['leyline_lattice', 'mana_crystal', 'resonance_node'] },
    { geometry: 'particles',  defaultColor: { r: 200, g: 120, b: 255 }, variants: ['arcane_sparks', 'mana_drift'] },
  ],
  exotic: [
    { geometry: 'volumetric', defaultColor: { r: 30,  g: 0,   b: 50  }, variants: ['void_pool', 'planar_rift'] },
    { geometry: 'particles',  defaultColor: { r: 60,  g: 0,   b: 100 }, variants: ['chaos_motes', 'null_static'] },
    { geometry: 'lattice',    defaultColor: { r: 100, g: 0,   b: 150 }, variants: ['dimensional_lattice'] },
  ],
}

// ============================================================
// INSTANCE HELPER
// ============================================================

/**
 * Pick a template from the registry for materialClass, then instance
 * a Primitive at the given position using rng for variant + placement.
 * Deterministic: same materialClass + variant + rng state → same primitive.
 */
export function instancePrimitive(
  materialClass: MaterialClass,
  variant: string | undefined,
  rng: SeededRNG,
  position: { x: number; y: number; z: number },
): Primitive {
  const templates = PRIMITIVE_REGISTRY[materialClass]
  const template = templates[Math.floor(rng.next() * templates.length)]
  const chosenVariant = variant ?? template.variants[Math.floor(rng.next() * template.variants.length)]

  const scale  = 0.3 + rng.next() * 0.5     // 0.3 → 0.8 of tile size
  const rotation = rng.next() * Math.PI * 2  // full random rotation

  // Slight color variation (±15 per channel) from the default
  const cr = clamp(template.defaultColor.r + Math.floor((rng.next() - 0.5) * 30), 0, 255)
  const cg = clamp(template.defaultColor.g + Math.floor((rng.next() - 0.5) * 30), 0, 255)
  const cb = clamp(template.defaultColor.b + Math.floor((rng.next() - 0.5) * 30), 0, 255)

  return {
    materialClass,
    geometry: template.geometry,
    position,
    scale,
    rotation,
    color: { r: cr, g: cg, b: cb },
    variant: chosenVariant,
    affixes: [],
  }
}

/**
 * All material classes defined in the registry, in order.
 */
export const MATERIAL_CLASSES: MaterialClass[] = [
  'metal', 'stone', 'fiber', 'ceramic', 'glass', 'gem',
  'soil', 'fluid', 'gas', 'organic', 'ice', 'crystal', 'exotic',
]

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
