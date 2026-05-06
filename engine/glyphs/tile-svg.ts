/**
 * TILE SVG PIPELINE — procedural floor-tile texture generation
 * ==================================================================
 *
 * One tile = a 64×64 SVG texture. The pipeline:
 *
 *   (TileTemplate, worldSeed, q, r)
 *      ↓ noise sampling per cell
 *   2D grid of glyphs (64×64 cells)
 *      ↓ row-RLE compression
 *   SVG string (background + grouped <rect> runs)
 *
 * Each cell's glyph is picked by a template-supplied function from
 * `(noise1, noise2, x, z)`. Two clients with the same world seed and
 * same template version produce literally the same SVG bit-for-bit.
 *
 * Why SVG (not raster):
 *   - Scales without quality loss (TTRPG zoom)
 *   - Compresses well in transit (text + repetition)
 *   - Browser-rasterizable for Three.js textures
 *   - Compositional — features can be primitive shapes, not just pixels
 *
 * Wire size: row-RLE'd SVG of a varied tile is ~5-15 KB raw, gzipping
 * down to ~1-3 KB. A full 64×64 floor of unique tiles ships in single
 * megabytes; with seed-based generation, the *seed* alone is enough
 * (each client regenerates locally and caches in IDB).
 */

import { GLYPH_TABLE, type Glyph } from './alphabet'
import { fbm, makeValueNoise2D, type Noise2D } from './noise'

/** Default tile resolution: 64×64 cells. */
export const TILE_SVG_SIZE = 64

/**
 * Per-template glyph picker. Receives two independent noise samples
 * (`n1`, `n2` ∈ [0, 1]) plus tile-local coords `(x, z) ∈ [0, size)`.
 * Returns a glyph from `GLYPH_TABLE`.
 */
export type GlyphPicker = (
  n1: number,
  n2: number,
  x: number,
  z: number,
) => Glyph

export interface TileTemplate {
  id: string
  name: string
  /** Cell-grid resolution. Default 64. */
  size?: number
  /** Cells per noise period. Smaller = finer-grained variation. */
  noiseScale?: number
  /** Octaves of fbm to sample for n1 / n2. */
  octaves?: number
  /** Glyph picker — receives noise + coords, returns glyph. */
  pickGlyph: GlyphPicker
}

// ============================================================
// CATALOG — first-pass tile templates
// ============================================================

/**
 * Grass tile. Background grass; rare bare-dirt clusters; very rare moss.
 * Two noise channels: n1 controls grass/dirt clustering, n2 modulates moss.
 */
export const GRASS_TEMPLATE: TileTemplate = {
  id: 'grass',
  name: 'Grass',
  noiseScale: 8,    // ~8 cells per noise period → tile shows ~4-8 grass/dirt clusters
  octaves: 4,
  pickGlyph: (n1, n2) => {
    if (n1 < 0.30) return 'd' as Glyph        // bare dirt patch
    if (n2 > 0.82) return ':' as Glyph        // moss tuft
    return 'g' as Glyph                         // grass (dominant)
  },
}

/** Dirt path / packed earth. Mostly dirt with gravel scatter. */
export const DIRT_TEMPLATE: TileTemplate = {
  id: 'dirt',
  name: 'Dirt',
  noiseScale: 6,
  octaves: 3,
  pickGlyph: (n1, n2) => {
    if (n1 < 0.20) return '%' as Glyph        // gravel patch
    if (n2 > 0.88) return 'd' as Glyph        // bumpy dirt (same as base; visual texture from compression)
    return 'd' as Glyph
  },
}

/** Cobblestone — clusters of stone with mortar gaps. */
export const COBBLESTONE_TEMPLATE: TileTemplate = {
  id: 'cobblestone',
  name: 'Cobblestone',
  noiseScale: 4,    // tighter clustering than grass — individual stones
  octaves: 2,
  pickGlyph: (n1, n2) => {
    // Use n1 as stone-vs-mortar gradient with sharp threshold for stone edges
    if (n1 < 0.18) return 'd' as Glyph        // mortar / dirt-line gap
    if (n2 > 0.85) return '%' as Glyph        // gravel chip
    return 'S' as Glyph                         // stone
  },
}

/** Sand — wavy banded distribution. */
export const SAND_TEMPLATE: TileTemplate = {
  id: 'sand',
  name: 'Sand',
  noiseScale: 12,   // long wavelength = sandy ripples
  octaves: 4,
  pickGlyph: (n1, n2) => {
    if (n1 < 0.15) return 'd' as Glyph        // wet/darker sand patch
    if (n2 > 0.92) return '%' as Glyph        // exposed pebbles
    return '~' as Glyph
  },
}

/** Moss-covered forest floor. Grass with frequent moss. */
export const FOREST_FLOOR_TEMPLATE: TileTemplate = {
  id: 'forest_floor',
  name: 'Forest floor',
  noiseScale: 5,
  octaves: 4,
  pickGlyph: (n1, n2) => {
    if (n1 < 0.25) return 'd' as Glyph        // dirt patches under canopy
    if (n2 > 0.55) return ':' as Glyph        // pervasive moss
    return 'g' as Glyph
  },
}

/** Snow — mostly snow with occasional ice patches. */
export const SNOW_TEMPLATE: TileTemplate = {
  id: 'snow',
  name: 'Snow',
  noiseScale: 10,
  octaves: 3,
  pickGlyph: (n1, n2) => {
    if (n1 < 0.10) return 'i' as Glyph        // exposed ice
    if (n2 > 0.92) return 'd' as Glyph        // muddy patch
    return ',' as Glyph
  },
}

export const TILE_TEMPLATE_CATALOG: Record<string, TileTemplate> = {
  grass:        GRASS_TEMPLATE,
  dirt:         DIRT_TEMPLATE,
  cobblestone:  COBBLESTONE_TEMPLATE,
  sand:         SAND_TEMPLATE,
  forest_floor: FOREST_FLOOR_TEMPLATE,
  snow:         SNOW_TEMPLATE,
}

// ============================================================
// PIPELINE — TileTemplate × seed × (q, r) → SVG string
// ============================================================

export interface GeneratedTile {
  /** SVG text — drop into an <img>, an <svg>, or rasterize to canvas. */
  svg: string
  /** Glyph picked for each cell, in row-major order; useful for debugging + composition. */
  cells: Glyph[]
  /** Tile size in cells. */
  size: number
  /** Source template id. */
  templateId: string
  /** Resolved (q, r) of the tile. */
  q: number
  r: number
}

/**
 * Generate one tile's SVG texture. Deterministic in `(template.id,
 * worldSeed, q, r)`.
 *
 * The SVG body is a sequence of `<rect>` runs — each run covers a
 * contiguous span of same-glyph cells in one row, drawn at integer
 * pixel coords with `shape-rendering="crispEdges"` so cells stay sharp
 * when scaled. Background is a single full-tile `<rect>` of the most
 * common glyph; per-row runs only emit non-background runs.
 */
export function generateTileSvg(
  template: TileTemplate,
  worldSeed: string,
  q: number,
  r: number,
): GeneratedTile {
  const size = template.size ?? TILE_SVG_SIZE
  const noiseScale = template.noiseScale ?? 8
  const octaves = template.octaves ?? 4

  const noise1: Noise2D = makeValueNoise2D(`${worldSeed}:${template.id}:${q}:${r}:n1`)
  const noise2: Noise2D = makeValueNoise2D(`${worldSeed}:${template.id}:${q}:${r}:n2`)

  // 1. Pick a glyph for each cell.
  const cells: Glyph[] = new Array(size * size)
  const glyphCounts = new Map<Glyph, number>()
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const sx = x / noiseScale
      const sz = z / noiseScale
      const n1 = fbm(noise1, sx, sz, octaves)
      const n2 = fbm(noise2, sx + 100, sz + 100, octaves)
      const g = template.pickGlyph(n1, n2, x, z) as Glyph
      cells[z * size + x] = g
      glyphCounts.set(g, (glyphCounts.get(g) ?? 0) + 1)
    }
  }

  // 2. Pick the dominant glyph as the SVG background.
  let background: Glyph = cells[0]
  let bgCount = 0
  for (const [g, c] of glyphCounts) {
    if (c > bgCount) { background = g; bgCount = c }
  }

  // 3. Emit row-RLE'd <rect> elements for non-background runs.
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" `
    + `width="${size}" height="${size}" `
    + `shape-rendering="crispEdges" preserveAspectRatio="none">`,
  )
  parts.push(`<rect width="${size}" height="${size}" fill="${glyphHex(background)}"/>`)

  for (let z = 0; z < size; z++) {
    let runStart = -1
    let runGlyph: Glyph = '_' as Glyph
    for (let x = 0; x <= size; x++) {
      const cell = x < size ? cells[z * size + x] : ('_' as Glyph)
      if (runStart < 0) {
        if (x < size && cell !== background) {
          runStart = x
          runGlyph = cell
        }
        continue
      }
      if (cell !== runGlyph) {
        const runLen = x - runStart
        parts.push(
          `<rect x="${runStart}" y="${z}" width="${runLen}" height="1" fill="${glyphHex(runGlyph)}"/>`,
        )
        runStart = (x < size && cell !== background) ? x : -1
        runGlyph = cell
      }
    }
  }

  parts.push('</svg>')

  return {
    svg: parts.join(''),
    cells,
    size,
    templateId: template.id,
    q,
    r,
  }
}

function glyphHex(g: Glyph): string {
  const m = GLYPH_TABLE[g]
  if (!m) return '#000000'
  const c = m.renderHint.baseColor
  return (
    '#'
    + c.r.toString(16).padStart(2, '0')
    + c.g.toString(16).padStart(2, '0')
    + c.b.toString(16).padStart(2, '0')
  )
}

/** Convenience: generate via catalog id. */
export function generateTileSvgById(
  templateId: string,
  worldSeed: string,
  q: number,
  r: number,
): GeneratedTile {
  const t = TILE_TEMPLATE_CATALOG[templateId]
  if (!t) throw new Error(`generateTileSvgById: unknown template '${templateId}'`)
  return generateTileSvg(t, worldSeed, q, r)
}
