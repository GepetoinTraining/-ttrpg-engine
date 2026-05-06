/**
 * GLYPH ALPHABET — The 3D MRI Bitmap System
 * ==================================================================
 *
 * The dictionary every downstream module reads against. Each glyph is
 * a single ASCII character that denotes a material / anatomical / structural
 * marker in a glyph matrix. Authoring is ASCII-art slice-stacks (Y-stacked
 * 2D matrices); rendering composes per-glyph micro-textures into voxel faces.
 *
 * Lineage: Rogue → NetHack → Dwarf Fortress → this. Same data model,
 * extended to 3D, decoupled from terminal rendering.
 *
 * The alphabet has two layers:
 *
 *   1. SEED ALPHABET — the engine-shipped reserved glyphs (this file).
 *      ASCII printable. Cannot be redefined at runtime.
 *
 *   2. DISCOVERED ALPHABET — runtime extension via cert-signed entries
 *      in `tpb_entries`. Uses Unicode private-use codepoints (U+E000+).
 *      Lookups merge SEED ⊕ DISCOVERED at observation time.
 *
 * Conventions:
 *   - lowercase = soft / fine / common
 *   - UPPERCASE = hard / structural / large
 *   - digits 1-9 = snap addresses (limb anchors, equip slots)
 *   - punctuation = sparse semantic slots (snow, fire, etc.)
 *
 * Each glyph carries:
 *   - A MaterialClass (or null for engine-internal markers)
 *   - A RenderHint (color, emission, opacity, variance, textureKind)
 *   - A PhysicsClass (solid/liquid/gas/trigger/decoration/address/empty)
 *   - opaque / addressable flags
 *   - mirrorPartner — for bilateral symmetry authoring
 *
 * The mirrorGlyph function satisfies:
 *   mirrorGlyph(mirrorGlyph(g)) === g     for all g
 *
 * See docs/glyph-alphabet.md for the human-readable reference.
 * See src/docs/3D-mri.md for the original brief.
 *
 * NO DB imports. NO LLM imports. Pure data.
 */

import type { MaterialClass } from '../hologram'

// ============================================================
// TYPES
// ============================================================

/**
 * A single ASCII character. Branded for clarity but TypeScript can't
 * statically enforce length=1 — runtime guards in the helpers do.
 */
export type Glyph = string

export type GlyphCategory =
  | 'marker'     // engine-internal, no render
  | 'creature'   // anatomical tissue
  | 'flora'      // plant structure
  | 'terrain'    // ground substrate
  | 'effect'     // emission/transparency channel
  | 'equipment'  // baked-in armor/weapon material
  | 'exotic'     // magical / planar

export type PhysicsClass =
  | 'solid'       // blocks movement, default LOS-blocker for opaque solids
  | 'liquid'      // walkable with swim, splashes
  | 'gas'         // does not block movement; partial LOS
  | 'trigger'     // damages/affects on entry (lava, fire)
  | 'decoration'  // no physics (leaves, flowers — visual only)
  | 'address'     // snap address marker, not rendered
  | 'empty'       // air, no compute

export type TextureKind =
  | 'flat'        // uniform color
  | 'specks'      // low-density dots
  | 'fibrous'     // parallel streaks (wood, hair)
  | 'scaled'      // overlapping rounded shapes (scales, leaves)
  | 'glassy'      // smooth gradient
  | 'metallic'    // brushed shine
  | 'organic'     // mottled biological
  | 'gradient'    // radial or directional gradient
  | 'crystalline' // faceted

export interface RenderHint {
  /** Base RGB color (0-255 each) */
  baseColor: { r: number; g: number; b: number }
  /** Self-emission amount (0 = no glow, 1 = fully emissive) */
  emission: number
  /** Opacity (0 = invisible, 1 = fully opaque) */
  opacity: number
  /** Per-instance noise amplitude (0 = uniform, 1 = wildly varied) */
  variance: number
  textureKind: TextureKind
}

export interface GlyphMaterial {
  glyph: Glyph
  name: string
  category: GlyphCategory
  /** null for markers (empty, ground-anchor, snap addresses) */
  materialClass: MaterialClass | null
  renderHint: RenderHint
  physicsClass: PhysicsClass
  /** True for occlusion + top-face composition (top-down render) */
  opaque: boolean
  /** True for snap addresses 1-9 (engine indexes these for equipment placement) */
  addressable: boolean
  /** Glyph this maps to under bilateral mirror; self for most */
  mirrorPartner: Glyph
}

// ============================================================
// COLOR PALETTE — keep numbers grouped so a designer can recolor
// ============================================================

const C = {
  // Earth tones
  flesh:     { r: 220, g: 180, b: 160 },
  pinkFlesh: { r: 240, g: 195, b: 175 },
  hide:      { r:  90, g:  70, b:  55 },
  bone:      { r: 235, g: 225, b: 195 },
  tooth:     { r: 245, g: 240, b: 220 },
  claw:      { r:  60, g:  50, b:  40 },
  nail:      { r: 130, g: 110, b:  90 },
  horn:      { r:  85, g:  70, b:  55 },
  hoof:      { r:  55, g:  45, b:  35 },
  fur:       { r: 110, g:  85, b:  60 },
  feather:   { r: 200, g: 180, b: 150 },
  scale:     { r: 100, g: 130, b:  85 },
  scute:     { r:  95, g: 110, b:  75 },
  chitin:    { r:  60, g:  45, b:  30 },
  membrane:  { r: 230, g: 180, b: 160 },
  eye:       { r:  35, g:  35, b:  45 },
  ooze:      { r: 110, g: 180, b:  95 },
  whisker:   { r: 200, g: 195, b: 180 },
  viscera:   { r: 140, g:  35, b:  35 },

  // Plants
  grass:     { r:  85, g: 145, b:  70 },
  trunk:     { r:  90, g:  60, b:  35 },
  rootMajor: { r:  80, g:  55, b:  35 },
  rootFine:  { r: 105, g:  75, b:  50 },
  branch:    { r: 100, g:  70, b:  45 },
  leaf:      { r:  70, g: 130, b:  55 },
  flower:    { r: 220, g: 110, b: 180 },
  fruit:     { r: 200, g:  60, b:  60 },
  mushroom:  { r: 200, g: 175, b: 145 },
  vine:      { r:  85, g: 130, b:  65 },
  moss:      { r:  90, g: 130, b:  70 },

  // Terrain
  dirt:      { r: 110, g:  85, b:  60 },
  mud:       { r:  85, g:  65, b:  45 },
  sand:      { r: 220, g: 195, b: 140 },
  stone:     { r: 130, g: 130, b: 130 },
  water:     { r:  60, g: 110, b: 175 },
  deepWater: { r:  35, g:  75, b: 130 },
  ice:       { r: 200, g: 225, b: 240 },
  lava:      { r: 235, g: 105, b:  35 },
  snow:      { r: 245, g: 245, b: 250 },
  gravel:    { r: 140, g: 135, b: 125 },
  oreVein:   { r: 200, g: 180, b: 110 },

  // Effects
  fire:      { r: 240, g: 140, b:  40 },
  smoke:     { r:  90, g:  90, b:  95 },
  fog:       { r: 200, g: 205, b: 215 },
  glow:      { r: 240, g: 240, b: 200 },
  crystal:   { r: 180, g: 220, b: 240 },
  lattice:   { r: 130, g: 195, b: 230 },
  arcane:    { r: 175, g: 100, b: 220 },

  // Equipment
  plate:     { r: 165, g: 165, b: 175 },
  leather:   { r: 110, g:  75, b:  45 },
  cloth:     { r: 175, g: 165, b: 150 },
  metal:     { r: 145, g: 145, b: 155 },
  gem:       { r: 220, g:  60, b: 100 },
  paper:     { r: 235, g: 220, b: 195 },
  rope:      { r: 180, g: 150, b: 110 },
  glass:     { r: 200, g: 220, b: 235 },

  // Exotic
  spirit:    { r: 200, g: 220, b: 250 },
  voidd:     { r:  20, g:  18, b:  25 },

  empty:     { r:   0, g:   0, b:   0 },
} as const

// ============================================================
// GLYPH TABLE — the seed alphabet
// ============================================================

const M = (
  glyph: Glyph,
  name: string,
  category: GlyphCategory,
  materialClass: MaterialClass | null,
  renderHint: RenderHint,
  physicsClass: PhysicsClass,
  opts: {
    opaque?: boolean
    addressable?: boolean
    mirrorPartner?: Glyph
  } = {},
): GlyphMaterial => ({
  glyph,
  name,
  category,
  materialClass,
  renderHint,
  physicsClass,
  opaque: opts.opaque ?? true,
  addressable: opts.addressable ?? false,
  mirrorPartner: opts.mirrorPartner ?? glyph,
})

const RH = (
  baseColor: { r: number; g: number; b: number },
  textureKind: TextureKind,
  variance: number,
  emission: number = 0,
  opacity: number = 1,
): RenderHint => ({
  baseColor,
  emission,
  opacity,
  variance,
  textureKind,
})

export const GLYPH_TABLE: Record<Glyph, GlyphMaterial> = {
  // ─── Markers (12) ───────────────────────────────────────────
  '_': M('_', 'empty / air',         'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'empty',   { opaque: false }),
  '.': M('.', 'ground-anchor',       'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),
  '0': M('0', 'reserved',            'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),
  '1': M('1', 'snap: hand_R_grip',   'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true, mirrorPartner: '2' }),
  '2': M('2', 'snap: hand_L_grip',   'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true, mirrorPartner: '1' }),
  '3': M('3', 'snap: head_crown',    'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),
  '4': M('4', 'snap: back',          'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),
  '5': M('5', 'snap: hip_R',         'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true, mirrorPartner: '6' }),
  '6': M('6', 'snap: hip_L',         'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true, mirrorPartner: '5' }),
  '7': M('7', 'snap: neck',          'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),
  '8': M('8', 'snap: feet',          'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),
  '9': M('9', 'snap: core',          'marker', null, RH(C.empty, 'flat', 0, 0, 0), 'address', { opaque: false, addressable: true }),

  // ─── Creature tissues (19) ──────────────────────────────────
  'f': M('f', 'flesh / muscle',      'creature', 'organic', RH(C.flesh,     'organic', 0.20), 'solid'),
  's': M('s', 'skin (smooth)',       'creature', 'organic', RH(C.pinkFlesh, 'organic', 0.10), 'solid'),
  'H': M('H', 'hide (thick leather)','creature', 'organic', RH(C.hide,      'organic', 0.15), 'solid'),
  'Z': M('Z', 'scale',               'creature', 'organic', RH(C.scale,     'scaled',  0.15), 'solid'),
  'K': M('K', 'scute (heavy plate)', 'creature', 'organic', RH(C.scute,     'scaled',  0.10), 'solid'),
  'F': M('F', 'fur',                 'creature', 'organic', RH(C.fur,       'fibrous', 0.30), 'solid'),
  'q': M('q', 'feather',             'creature', 'organic', RH(C.feather,   'fibrous', 0.25), 'solid'),
  'X': M('X', 'chitin (exoskeleton)','creature', 'organic', RH(C.chitin,    'glassy',  0.10), 'solid'),
  'b': M('b', 'bone',                'creature', 'organic', RH(C.bone,      'organic', 0.05), 'solid'),
  't': M('t', 'tooth / fang',        'creature', 'organic', RH(C.tooth,     'glassy',  0.05), 'solid'),
  'c': M('c', 'claw / talon',        'creature', 'organic', RH(C.claw,      'glassy',  0.05), 'solid'),
  'e': M('e', 'eye',                 'creature', 'organic', RH(C.eye,       'glassy',  0.05, 0.15), 'solid'),
  'n': M('n', 'nail / beak',         'creature', 'organic', RH(C.nail,      'glassy',  0.05), 'solid'),
  'Y': M('Y', 'horn / antler',       'creature', 'organic', RH(C.horn,      'fibrous', 0.10), 'solid'),
  'u': M('u', 'hoof',                'creature', 'organic', RH(C.hoof,      'glassy',  0.05), 'solid'),
  'o': M('o', 'ooze / slime',        'creature', 'organic', RH(C.ooze,      'gradient',0.20, 0.05, 0.85), 'liquid', { opaque: false }),
  'M': M('M', 'membrane (translucent)', 'creature', 'organic', RH(C.membrane,'gradient',0.10, 0,    0.55), 'solid', { opaque: false }),
  "'": M("'", 'whisker / fine filament','creature','organic', RH(C.whisker,  'fibrous', 0.30), 'decoration'),
  '&': M('&', 'viscera (interior)',  'creature', 'organic', RH(C.viscera,   'organic', 0.30), 'solid'),

  // ─── Flora (11) ─────────────────────────────────────────────
  'g': M('g', 'grass',               'flora', 'fiber',   RH(C.grass,     'fibrous', 0.35), 'decoration'),
  'T': M('T', 'trunk (tree wood)',   'flora', 'fiber',   RH(C.trunk,     'fibrous', 0.20), 'solid'),
  'R': M('R', 'root (major)',        'flora', 'fiber',   RH(C.rootMajor, 'fibrous', 0.20), 'solid'),
  'r': M('r', 'rootlet (fine)',      'flora', 'fiber',   RH(C.rootFine,  'fibrous', 0.30), 'decoration'),
  'B': M('B', 'branch (incl. twig)', 'flora', 'fiber',   RH(C.branch,    'fibrous', 0.25), 'solid'),
  'L': M('L', 'leaf',                'flora', 'organic', RH(C.leaf,      'scaled',  0.30), 'decoration'),
  '*': M('*', 'flower',              'flora', 'organic', RH(C.flower,    'scaled',  0.40), 'decoration'),
  'O': M('O', 'fruit',               'flora', 'organic', RH(C.fruit,     'gradient',0.25), 'solid'),
  'Q': M('Q', 'mushroom / fungus',   'flora', 'organic', RH(C.mushroom,  'gradient',0.20), 'decoration'),
  'v': M('v', 'vine / creeper',      'flora', 'fiber',   RH(C.vine,      'fibrous', 0.30), 'decoration'),
  ':': M(':', 'moss / lichen',       'flora', 'organic', RH(C.moss,      'specks',  0.30), 'decoration'),

  // ─── Terrain (11) ───────────────────────────────────────────
  'd': M('d', 'dirt',                'terrain', 'soil',  RH(C.dirt,      'specks',  0.20), 'solid'),
  'D': M('D', 'mud (wet dirt)',      'terrain', 'soil',  RH(C.mud,       'gradient',0.25), 'solid'),
  '~': M('~', 'sand',                'terrain', 'soil',  RH(C.sand,      'specks',  0.15), 'solid'),
  'S': M('S', 'stone',               'terrain', 'stone', RH(C.stone,     'specks',  0.20), 'solid'),
  'w': M('w', 'water',               'terrain', 'fluid', RH(C.water,     'gradient',0.20, 0.05, 0.70), 'liquid', { opaque: false }),
  'W': M('W', 'deep water',          'terrain', 'fluid', RH(C.deepWater, 'gradient',0.15, 0.05, 0.85), 'liquid', { opaque: false }),
  'i': M('i', 'ice',                 'terrain', 'ice',   RH(C.ice,       'glassy',  0.10, 0,    0.85), 'solid', { opaque: false }),
  'j': M('j', 'lava',                'terrain', 'fluid', RH(C.lava,      'gradient',0.30, 0.85, 1.00), 'trigger'),
  ',': M(',', 'snow',                'terrain', 'ice',   RH(C.snow,      'specks',  0.10), 'solid'),
  '%': M('%', 'gravel / scree',      'terrain', 'stone', RH(C.gravel,    'specks',  0.30), 'solid'),
  '$': M('$', 'ore vein',            'terrain', 'metal', RH(C.oreVein,   'metallic',0.40), 'solid'),

  // ─── Effects (7) ────────────────────────────────────────────
  '^': M('^', 'fire',                'effect', 'gas',     RH(C.fire,    'gradient',0.50, 0.95, 0.65), 'trigger', { opaque: false }),
  '"': M('"', 'smoke',               'effect', 'gas',     RH(C.smoke,   'gradient',0.40, 0,    0.45), 'gas',     { opaque: false }),
  ';': M(';', 'fog',                 'effect', 'gas',     RH(C.fog,     'gradient',0.30, 0,    0.30), 'gas',     { opaque: false }),
  '!': M('!', 'glow / magical light','effect', 'crystal', RH(C.glow,    'gradient',0.20, 1.00, 0.40), 'decoration', { opaque: false }),
  '+': M('+', 'crystal (radiating)', 'effect', 'crystal', RH(C.crystal, 'crystalline', 0.20, 0.20, 0.85), 'solid', { opaque: false }),
  '#': M('#', 'lattice (mana)',      'effect', 'crystal', RH(C.lattice, 'crystalline', 0.30, 0.40, 0.75), 'solid', { opaque: false }),
  '?': M('?', 'arcane / discovery-pending','effect', 'exotic', RH(C.arcane,'gradient',0.80, 0.30, 0.70), 'decoration', { opaque: false }),

  // ─── Equipment (8) — for baked-in armor/weapon authoring ─────
  'P': M('P', 'plate armor',         'equipment', 'metal',   RH(C.plate,   'metallic', 0.10), 'solid'),
  'l': M('l', 'leather',             'equipment', 'organic', RH(C.leather, 'organic',  0.20), 'solid'),
  'C': M('C', 'cloth / fabric',      'equipment', 'fiber',   RH(C.cloth,   'fibrous',  0.20), 'solid'),
  'm': M('m', 'metal (raw)',         'equipment', 'metal',   RH(C.metal,   'metallic', 0.10), 'solid'),
  'G': M('G', 'gem (faceted)',       'equipment', 'gem',     RH(C.gem,     'crystalline', 0.20, 0.10, 0.85), 'solid', { opaque: false }),
  'p': M('p', 'paper / parchment',   'equipment', 'fiber',   RH(C.paper,   'flat',     0.10), 'decoration'),
  '\\':M('\\','rope / chain',        'equipment', 'fiber',   RH(C.rope,    'fibrous',  0.20), 'decoration'),
  '=': M('=', 'glass',               'equipment', 'glass',   RH(C.glass,   'glassy',   0.05, 0,    0.40), 'solid', { opaque: false }),

  // ─── Exotic (2) ─────────────────────────────────────────────
  '`': M('`', 'spirit / ethereal',   'exotic', 'exotic', RH(C.spirit, 'gradient', 0.50, 0.30, 0.30), 'gas', { opaque: false }),
  '@': M('@', 'void / planar null',  'exotic', 'exotic', RH(C.voidd,  'flat',     0.05, 0,    1.00), 'trigger'),
}

// ============================================================
// HELPERS
// ============================================================

/** All glyphs in the seed alphabet. */
export const GLYPHS: readonly Glyph[] = Object.freeze(Object.keys(GLYPH_TABLE))

/** A glyph is "occupied" if it's not air and not a snap address. */
export function isOccupied(g: Glyph): boolean {
  if (g === '_' || g === '.') return false
  return !isAddress(g)
}

/** True for digits 0-9 (snap addresses). */
export function isAddress(g: Glyph): boolean {
  return g.length === 1 && g >= '0' && g <= '9'
}

/** True for glyphs whose mirror partner differs (asymmetric content). */
export function isLateral(g: Glyph): boolean {
  const entry = GLYPH_TABLE[g]
  return entry !== undefined && entry.mirrorPartner !== g
}

/** Map a glyph to its bilateral-mirror counterpart. */
export function mirrorGlyph(g: Glyph): Glyph {
  return GLYPH_TABLE[g]?.mirrorPartner ?? g
}

/** Get the full material record for a glyph; null if unknown. */
export function lookupGlyph(g: Glyph): GlyphMaterial | null {
  return GLYPH_TABLE[g] ?? null
}

/** True if every glyph in a string is in the seed alphabet. */
export function isValidGlyphString(s: string): boolean {
  for (const ch of s) {
    if (!(ch in GLYPH_TABLE)) return false
  }
  return true
}

/** Categorize glyphs for documentation / pickers. */
export function glyphsByCategory(): Record<GlyphCategory, GlyphMaterial[]> {
  const out: Record<GlyphCategory, GlyphMaterial[]> = {
    marker: [], creature: [], flora: [], terrain: [], effect: [], equipment: [], exotic: [],
  }
  for (const g of GLYPHS) {
    const m = GLYPH_TABLE[g]
    out[m.category].push(m)
  }
  return out
}
