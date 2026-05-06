/**
 * GLYPH TEXTURES — Procedural Per-Glyph Micro-Textures
 * ==================================================================
 *
 * For the FIRST PASS, each glyph's "texture" is computed procedurally
 * from its RenderHint at render time — no PNG assets ship initially.
 * Authored bitmap textures can replace per-glyph procedural ones in a
 * later pass without changing the alphabet.
 *
 * The texture for a single voxel face is a small RGBA bitmap (default
 * 16×16, configurable per-call). The procedure for each glyph:
 *
 *   1. Read RenderHint from GLYPH_TABLE[g].
 *   2. Seed an RNG with structured inputs (worldSeed, q, r, y, glyph,
 *      varianceSalt) — this is Pedro's "no hashing for receipts" rule:
 *      we use the literal inputs, not a hash digest.
 *   3. Generate per-pixel jitter scaled by RenderHint.variance.
 *   4. Apply textureKind-specific pattern (specks, fibrous, scaled, etc.).
 *   5. Apply emission (additive) and opacity (alpha).
 *
 * Output: Uint8ClampedArray of length width*height*4 (RGBA).
 * Compatible with HTMLCanvas ImageData and WebGL texture uploads.
 *
 * NO DB imports. NO LLM imports.
 */

import { SeededRNG } from '../hub-topology'
import type { Glyph, GlyphMaterial, RenderHint, TextureKind } from './alphabet'
import { GLYPH_TABLE } from './alphabet'

// ============================================================
// TYPES
// ============================================================

export interface TextureKey {
  /** The glyph being rendered */
  glyph: Glyph
  /** World seed (for instance variation) */
  worldSeed: string
  /** Tile coordinates */
  q: number
  r: number
  /** Y-slice within the matrix */
  y: number
  /** Optional extra salt for sub-instance variation */
  salt?: string
}

export interface MicroTexture {
  width: number
  height: number
  /** RGBA bytes, length = width * height * 4 */
  pixels: Uint8ClampedArray
  /** The glyph this texture renders */
  glyph: Glyph
  /** Average emission across the texture (for renderer hints) */
  emission: number
  /** Average opacity across the texture */
  opacity: number
}

// ============================================================
// TEXTURE GENERATOR
// ============================================================

/**
 * Build a structured key string from TextureKey. Designer-readable;
 * NOT a hash (per Pedro's rule — the bytes ARE the stamp).
 */
export function textureKeyString(key: TextureKey): string {
  const salt = key.salt ?? ''
  return `${key.glyph}:${key.worldSeed}:${key.q}:${key.r}:${key.y}:${salt}`
}

/**
 * Generate a procedural micro-texture for a glyph.
 *
 * Deterministic: same TextureKey + same alphabet version → identical pixels.
 *
 * @param key       structured inputs identifying this voxel face
 * @param size      pixel dimension (default 16)
 * @returns         RGBA texture or null if glyph is unknown
 */
export function generateMicroTexture(
  key: TextureKey,
  size: number = 16,
): MicroTexture | null {
  const material = GLYPH_TABLE[key.glyph]
  if (!material) return null
  if (material.physicsClass === 'address' || material.physicsClass === 'empty') {
    return makeTransparentTexture(key.glyph, size)
  }

  const rng = new SeededRNG(textureKeyString(key))
  const pixels = new Uint8ClampedArray(size * size * 4)
  paintTexture(pixels, size, material.renderHint, rng)

  return {
    width: size,
    height: size,
    pixels,
    glyph: key.glyph,
    emission: material.renderHint.emission,
    opacity: material.renderHint.opacity,
  }
}

/**
 * Bulk generate the entire seed alphabet's textures at one canonical
 * tile (useful for cache pre-warming + visual regression tests).
 */
export function generateAlphabetTextures(
  worldSeed: string,
  size: number = 16,
): Map<Glyph, MicroTexture> {
  const out = new Map<Glyph, MicroTexture>()
  for (const glyph of Object.keys(GLYPH_TABLE)) {
    const tex = generateMicroTexture(
      { glyph, worldSeed, q: 0, r: 0, y: 0 },
      size,
    )
    if (tex) out.set(glyph, tex)
  }
  return out
}

// ============================================================
// PATTERN PAINTERS — one per TextureKind
// ============================================================

function paintTexture(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  switch (hint.textureKind) {
    case 'flat':        return paintFlat(pixels, size, hint, rng)
    case 'specks':      return paintSpecks(pixels, size, hint, rng)
    case 'fibrous':     return paintFibrous(pixels, size, hint, rng)
    case 'scaled':      return paintScaled(pixels, size, hint, rng)
    case 'glassy':      return paintGlassy(pixels, size, hint, rng)
    case 'metallic':    return paintMetallic(pixels, size, hint, rng)
    case 'organic':     return paintOrganic(pixels, size, hint, rng)
    case 'gradient':    return paintGradient(pixels, size, hint, rng)
    case 'crystalline': return paintCrystalline(pixels, size, hint, rng)
  }
}

function paintFlat(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  for (let i = 0; i < size * size; i++) {
    const j = jitter(variance, rng) * 0.4
    pixels[i * 4 + 0] = clamp255(baseColor.r + j * 30 + emission * 60)
    pixels[i * 4 + 1] = clamp255(baseColor.g + j * 30 + emission * 60)
    pixels[i * 4 + 2] = clamp255(baseColor.b + j * 30 + emission * 60)
    pixels[i * 4 + 3] = alpha
  }
}

function paintSpecks(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  for (let i = 0; i < size * size; i++) {
    const speck = rng.next() < 0.18 ? 1 : 0
    const j = jitter(variance, rng)
    const speckShade = speck ? -50 + j * 20 : j * 25
    pixels[i * 4 + 0] = clamp255(baseColor.r + speckShade + emission * 60)
    pixels[i * 4 + 1] = clamp255(baseColor.g + speckShade + emission * 60)
    pixels[i * 4 + 2] = clamp255(baseColor.b + speckShade + emission * 60)
    pixels[i * 4 + 3] = alpha
  }
}

function paintFibrous(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  // Per-column tint, simulating parallel fibers running vertically.
  const columnTints = new Array(size).fill(0).map(() => jitter(variance, rng) * 35)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const colTint = columnTints[x]
      const wobble = jitter(variance, rng) * 12
      pixels[i + 0] = clamp255(baseColor.r + colTint + wobble + emission * 60)
      pixels[i + 1] = clamp255(baseColor.g + colTint + wobble + emission * 60)
      pixels[i + 2] = clamp255(baseColor.b + colTint + wobble + emission * 60)
      pixels[i + 3] = alpha
    }
  }
}

function paintScaled(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  const scaleSize = 4 // overlapping rounded shapes
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Distance to nearest scale center (integer grid offset by row)
      const rowOffset = (Math.floor(y / scaleSize) % 2) * (scaleSize / 2)
      const cx = Math.round((x - rowOffset) / scaleSize) * scaleSize + rowOffset
      const cy = Math.round(y / scaleSize) * scaleSize
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy) / scaleSize
      const shade = (1 - Math.min(d, 1)) * 30 - 15
      const j = jitter(variance, rng) * 15
      const i = (y * size + x) * 4
      pixels[i + 0] = clamp255(baseColor.r + shade + j + emission * 60)
      pixels[i + 1] = clamp255(baseColor.g + shade + j + emission * 60)
      pixels[i + 2] = clamp255(baseColor.b + shade + j + emission * 60)
      pixels[i + 3] = alpha
    }
  }
}

function paintGlassy(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  // Diagonal gradient highlight.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const t = (x + y) / (size * 2) // 0..1 diagonal
      const highlight = (t < 0.3 ? 50 : t > 0.7 ? -25 : 0)
      const j = jitter(variance, rng) * 8
      pixels[i + 0] = clamp255(baseColor.r + highlight + j + emission * 60)
      pixels[i + 1] = clamp255(baseColor.g + highlight + j + emission * 60)
      pixels[i + 2] = clamp255(baseColor.b + highlight + j + emission * 60)
      pixels[i + 3] = alpha
    }
  }
}

function paintMetallic(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  // Horizontal brushed-metal streaks.
  const rowTints = new Array(size).fill(0).map(() => jitter(variance, rng) * 40)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const rowTint = rowTints[y]
      const j = jitter(variance, rng) * 6
      const highlight = (y < 3 ? 35 : y > size - 3 ? -25 : 0)
      pixels[i + 0] = clamp255(baseColor.r + rowTint + highlight + j + emission * 60)
      pixels[i + 1] = clamp255(baseColor.g + rowTint + highlight + j + emission * 60)
      pixels[i + 2] = clamp255(baseColor.b + rowTint + highlight + j + emission * 60)
      pixels[i + 3] = alpha
    }
  }
}

function paintOrganic(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  // Mottled biological — value-noise-ish via sums of jitters.
  for (let i = 0; i < size * size; i++) {
    const blob = (jitter(variance, rng) + jitter(variance, rng) + jitter(variance, rng)) / 3
    const shade = blob * 40
    pixels[i * 4 + 0] = clamp255(baseColor.r + shade + emission * 60)
    pixels[i * 4 + 1] = clamp255(baseColor.g + shade * 0.85 + emission * 60)
    pixels[i * 4 + 2] = clamp255(baseColor.b + shade * 0.7 + emission * 60)
    pixels[i * 4 + 3] = alpha
  }
}

function paintGradient(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  // Radial gradient from center.
  const cx = size / 2
  const cy = size / 2
  const maxD = Math.sqrt(cx * cx + cy * cy)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxD
      const shade = (1 - d) * 35 - 15
      const j = jitter(variance, rng) * 15
      pixels[i + 0] = clamp255(baseColor.r + shade + j + emission * 60)
      pixels[i + 1] = clamp255(baseColor.g + shade + j + emission * 60)
      pixels[i + 2] = clamp255(baseColor.b + shade + j + emission * 60)
      pixels[i + 3] = alpha
    }
  }
}

function paintCrystalline(
  pixels: Uint8ClampedArray,
  size: number,
  hint: RenderHint,
  rng: SeededRNG,
): void {
  const { baseColor, variance, opacity, emission } = hint
  const alpha = Math.round(opacity * 255)
  // Faceted: triangular sectors from center get different shades.
  const cx = size / 2
  const cy = size / 2
  const facetCount = 6
  const facetShades = new Array(facetCount)
    .fill(0)
    .map(() => jitter(variance, rng) * 50)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const angle = Math.atan2(y - cy, x - cx)
      const facet = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * facetCount) % facetCount
      const shade = facetShades[facet]
      const j = jitter(variance, rng) * 8
      pixels[i + 0] = clamp255(baseColor.r + shade + j + emission * 80)
      pixels[i + 1] = clamp255(baseColor.g + shade + j + emission * 80)
      pixels[i + 2] = clamp255(baseColor.b + shade + j + emission * 80)
      pixels[i + 3] = alpha
    }
  }
}

// ============================================================
// HELPERS
// ============================================================

/** Jitter in [-1, 1] scaled by amplitude. */
function jitter(amplitude: number, rng: SeededRNG): number {
  return (rng.next() * 2 - 1) * amplitude
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

function makeTransparentTexture(glyph: Glyph, size: number): MicroTexture {
  return {
    width: size,
    height: size,
    pixels: new Uint8ClampedArray(size * size * 4), // all zeros = transparent
    glyph,
    emission: 0,
    opacity: 0,
  }
}

// ============================================================
// VERIFICATION HELPERS — used by tests
// ============================================================

/**
 * Two textures are byte-identical if they were generated from the
 * same key + alphabet version. This is the determinism check.
 */
export function texturesEqual(a: MicroTexture, b: MicroTexture): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  if (a.glyph !== b.glyph) return false
  if (a.pixels.length !== b.pixels.length) return false
  for (let i = 0; i < a.pixels.length; i++) {
    if (a.pixels[i] !== b.pixels[i]) return false
  }
  return true
}

/** Average RGBA across the texture (for cheap "looks roughly right" checks). */
export function averageColor(tex: MicroTexture): { r: number; g: number; b: number; a: number } {
  let r = 0, g = 0, b = 0, a = 0
  const px = tex.pixels.length / 4
  for (let i = 0; i < px; i++) {
    r += tex.pixels[i * 4 + 0]
    g += tex.pixels[i * 4 + 1]
    b += tex.pixels[i * 4 + 2]
    a += tex.pixels[i * 4 + 3]
  }
  return { r: r / px, g: g / px, b: b / px, a: a / px }
}
