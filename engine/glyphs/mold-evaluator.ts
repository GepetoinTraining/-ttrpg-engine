/**
 * GLYPH MOLD EVALUATOR — Matrix → Primitives
 * ==================================================================
 *
 * Consumes a glyph matrix (a 3D grid of single-character cells) +
 * entity parameters and produces an array of renderer Primitives
 * compatible with the hologram's RenderedTile shape.
 *
 * This is the function that REPLACES `composeGoblinField` in
 * `EntitySDFMesh.tsx` once the migration runs (per the contract in
 * `src/docs/codec-client-side-rolling.md`). The metaball positions
 * become voxel cells in a glyph matrix; the function emits one
 * Primitive per occupied non-marker cell.
 *
 * Two consumption paths:
 *
 *   1. applyGlyphMatrix(matrix, params) → Primitive[]
 *      Full 3D voxel render. Renderer instances each Primitive as a
 *      cube with per-glyph micro-texture on each face.
 *
 *   2. topFaceProjection(matrix) → Glyph[][]
 *      Top-down 2D projection. For each (x, z), the highest occupied
 *      glyph is the visible-from-above face. Cheap render path for
 *      TTRPG top-down view (Pedro's "MRI from above").
 *
 * Plus utilities:
 *   - parseGlyphMatrix(text) — read .txt files in the slice format
 *   - serializeGlyphMatrix(matrix) — round-trip back to .txt
 *   - indexSnapAddresses(matrix) — locate snap address voxels
 *   - mirrorMatrix(matrix, axis) — bilateral symmetry generation
 *
 * Format expected by parseGlyphMatrix:
 *
 *   --- y=0 ---
 *   ________________
 *   ________________
 *   ...
 *   --- y=1 ---
 *   ________________
 *   ...
 *
 * NO DB imports. NO LLM imports.
 */

import type { Primitive } from '../hologram'
import type { Glyph, GlyphMaterial } from './alphabet'
import { GLYPH_TABLE, isOccupied, isAddress, mirrorGlyph } from './alphabet'

// ============================================================
// TYPES
// ============================================================

export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * A 3D grid of glyphs.
 *
 * `cells` is a flat string indexed as:
 *   index(x, y, z) = y * (sizeX * sizeZ) + z * sizeX + x
 *
 * String storage (vs Glyph[]) is compact and naturally JSON-friendly
 * since each glyph is a single character.
 */
export interface GlyphMatrix {
  sizeX: number
  sizeY: number
  sizeZ: number
  cells: string
}

export interface MatrixParams {
  worldSeed: string
  entityId: string
  encounterTime: number
  /** Scale relative to a tile (1 = one matrix cell = one tile sub-unit) */
  scale: number
  /** Build / proportions modifier from disc tensor SIZE+BUILD slots */
  build?: number
  /** Pose family (idle, attack, walk, ...) — drives rotation */
  poseFamily?: number
  /** Pose progress 0..1 — drives animation perturbation */
  poseProgress?: number
  /** Local-to-tile origin offset (default: matrix center on x,z; y=0 at floor) */
  origin?: Vec3
}

// ============================================================
// PARSING
// ============================================================

const SLICE_HEADER = /^---\s*y\s*=\s*(\d+)\s*---\s*$/

/**
 * Parse a .txt slice-stack into a GlyphMatrix.
 *
 * Empty lines between slices are ignored. Trailing whitespace on each
 * row is trimmed but the row's character count must match sizeX (after
 * trimming).
 *
 * Throws on:
 *   - non-monotonic y headers (gap or duplicate)
 *   - inconsistent row width
 *   - inconsistent slice height
 *   - unknown glyphs (not in GLYPH_TABLE)
 */
export function parseGlyphMatrix(text: string): GlyphMatrix {
  const lines = text.split(/\r?\n/)
  const slices: { y: number; rows: string[] }[] = []
  let current: { y: number; rows: string[] } | null = null

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '') // trim trailing whitespace
    const headerMatch = SLICE_HEADER.exec(line)
    if (headerMatch) {
      if (current) slices.push(current)
      current = { y: parseInt(headerMatch[1], 10), rows: [] }
      continue
    }
    if (line === '' && current === null) continue // pre-header blank
    if (line === '') continue                     // blank within a slice → skip
    if (current === null) {
      throw new Error(`glyph-matrix: content before first --- y=N --- header: ${line}`)
    }
    current.rows.push(line)
  }
  if (current) slices.push(current)

  if (slices.length === 0) {
    throw new Error('glyph-matrix: no slices found')
  }

  // Validate y values are 0..N-1 in order
  for (let i = 0; i < slices.length; i++) {
    if (slices[i].y !== i) {
      throw new Error(
        `glyph-matrix: slice y=${slices[i].y} out of order at position ${i} ` +
        `(expected y=${i}; slices must be 0,1,2,... contiguous)`,
      )
    }
  }

  const sizeY = slices.length
  const sizeZ = slices[0].rows.length
  const sizeX = slices[0].rows[0]?.length ?? 0
  if (sizeX === 0 || sizeZ === 0) {
    throw new Error('glyph-matrix: empty slice (sizeX or sizeZ is 0)')
  }

  for (const slice of slices) {
    if (slice.rows.length !== sizeZ) {
      throw new Error(
        `glyph-matrix: slice y=${slice.y} has ${slice.rows.length} rows; expected ${sizeZ}`,
      )
    }
    for (let z = 0; z < slice.rows.length; z++) {
      const row = slice.rows[z]
      if (row.length !== sizeX) {
        throw new Error(
          `glyph-matrix: slice y=${slice.y} row z=${z} has width ${row.length}; expected ${sizeX}`,
        )
      }
      for (let x = 0; x < sizeX; x++) {
        const ch = row[x]
        if (!(ch in GLYPH_TABLE)) {
          throw new Error(
            `glyph-matrix: unknown glyph '${ch}' at (x=${x}, y=${slice.y}, z=${z})`,
          )
        }
      }
    }
  }

  // Build the flat cells string.
  const buf: string[] = []
  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      buf.push(slices[y].rows[z])
    }
  }

  return {
    sizeX,
    sizeY,
    sizeZ,
    cells: buf.join(''),
  }
}

/** Round-trip serialize a GlyphMatrix back to the .txt slice format. */
export function serializeGlyphMatrix(matrix: GlyphMatrix): string {
  const out: string[] = []
  for (let y = 0; y < matrix.sizeY; y++) {
    out.push(`--- y=${y} ---`)
    for (let z = 0; z < matrix.sizeZ; z++) {
      out.push(readRow(matrix, y, z))
    }
    out.push('')
  }
  return out.join('\n')
}

// ============================================================
// CELL ACCESSORS
// ============================================================

export function readCell(matrix: GlyphMatrix, x: number, y: number, z: number): Glyph {
  if (
    x < 0 || x >= matrix.sizeX ||
    y < 0 || y >= matrix.sizeY ||
    z < 0 || z >= matrix.sizeZ
  ) {
    return '_'
  }
  return matrix.cells.charAt(cellIndex(matrix, x, y, z))
}

export function cellIndex(matrix: GlyphMatrix, x: number, y: number, z: number): number {
  return y * (matrix.sizeX * matrix.sizeZ) + z * matrix.sizeX + x
}

function readRow(matrix: GlyphMatrix, y: number, z: number): string {
  const start = cellIndex(matrix, 0, y, z)
  return matrix.cells.substring(start, start + matrix.sizeX)
}

// ============================================================
// SNAP ADDRESS INDEX
// ============================================================

/**
 * Find every snap address (digit 0-9) in the matrix.
 * Returns map: address-digit → world-relative position (post-scale + origin).
 *
 * If a digit appears multiple times, only the first occurrence (lowest y,
 * then z, then x) is recorded. This is by design — snap addresses should
 * be unique in a well-formed matrix.
 */
export function indexSnapAddresses(
  matrix: GlyphMatrix,
  origin: Vec3 = { x: 0, y: 0, z: 0 },
  scale: number = 1,
): Map<number, Vec3> {
  const out = new Map<number, Vec3>()
  for (let y = 0; y < matrix.sizeY; y++) {
    for (let z = 0; z < matrix.sizeZ; z++) {
      for (let x = 0; x < matrix.sizeX; x++) {
        const g = readCell(matrix, x, y, z)
        if (!isAddress(g)) continue
        const digit = parseInt(g, 10)
        if (out.has(digit)) continue
        out.set(digit, localToWorld(matrix, x, y, z, origin, scale))
      }
    }
  }
  return out
}

function localToWorld(
  matrix: GlyphMatrix,
  x: number,
  y: number,
  z: number,
  origin: Vec3,
  scale: number,
): Vec3 {
  // Center the matrix on the X-Z plane around origin; floor-anchor at y=0.
  const cx = (matrix.sizeX - 1) / 2
  const cz = (matrix.sizeZ - 1) / 2
  return {
    x: origin.x + (x - cx) * scale,
    y: origin.y + y * scale,
    z: origin.z + (z - cz) * scale,
  }
}

// ============================================================
// THE MOLD EVALUATOR — applyGlyphMatrix
// ============================================================

/**
 * Convert a glyph matrix + entity params into a flat Primitive array.
 * Each occupied non-marker cell becomes one Primitive (a voxel cube).
 *
 * Replaces `composeGoblinField` in EntitySDFMesh.tsx. Same call shape
 * as the hologram's `composePrimitives`, so RenderedTile.primitives
 * can be set directly from this output.
 *
 * Determinism: same matrix + same params → identical Primitive[] order
 * + content. Pure function.
 */
export function applyGlyphMatrix(
  matrix: GlyphMatrix,
  params: MatrixParams,
): Primitive[] {
  const out: Primitive[] = []
  const origin = params.origin ?? { x: 0, y: 0, z: 0 }
  const rotation = rotationForPose(params.poseFamily ?? 0, params.poseProgress ?? 0)
  const buildScale = scaleForBuild(params.scale, params.build ?? 0.5)

  for (let y = 0; y < matrix.sizeY; y++) {
    for (let z = 0; z < matrix.sizeZ; z++) {
      for (let x = 0; x < matrix.sizeX; x++) {
        const g = readCell(matrix, x, y, z)
        if (!isOccupied(g)) continue
        const material = GLYPH_TABLE[g]
        if (!material) continue
        // Skip render-only-by-renderer-side glyphs that have no material class.
        if (material.materialClass === null) continue

        const position = localToWorld(matrix, x, y, z, origin, buildScale)
        out.push({
          materialClass: material.materialClass,
          geometry: geometryForMaterial(material),
          position,
          scale: buildScale,
          rotation,
          color: material.renderHint.baseColor,
          variant: g,
          affixes: [],
        })
      }
    }
  }

  return out
}

// ============================================================
// TOP-FACE PROJECTION (the "MRI from above" path)
// ============================================================

/**
 * For each (x, z) column, find the highest y where an occupied glyph
 * lives. Returns a 2D array of glyphs — the visible-from-above slice.
 *
 * This is the cheap render path for TTRPG top-down view: instead of
 * compositing 64×64×64 voxels, the client only draws (sizeX × sizeZ)
 * visible faces.
 *
 * Returned array: rows[z][x] = top-most-glyph (or '_' if column empty).
 */
export function topFaceProjection(matrix: GlyphMatrix): Glyph[][] {
  const rows: Glyph[][] = []
  for (let z = 0; z < matrix.sizeZ; z++) {
    const row: Glyph[] = []
    for (let x = 0; x < matrix.sizeX; x++) {
      let top: Glyph = '_'
      for (let y = matrix.sizeY - 1; y >= 0; y--) {
        const g = readCell(matrix, x, y, z)
        if (isOccupied(g) && GLYPH_TABLE[g]?.opaque) {
          top = g
          break
        }
        if (isOccupied(g) && top === '_') {
          // Top-most non-opaque is provisional; keep looking for opaque underneath.
          top = g
        }
      }
      row.push(top)
    }
    rows.push(row)
  }
  return rows
}

// ============================================================
// MIRROR — bilateral symmetry helper
// ============================================================

/**
 * Generate a mirrored matrix by reflecting across the X axis.
 * Author one half of a creature (say, the left side) and mirror to
 * produce the full bilateral-symmetric body.
 *
 * For each cell at (x, y, z), the mirrored cell at (sizeX-1-x, y, z)
 * is set to mirrorGlyph(cell). Snap addresses 1↔2, 5↔6 swap correctly.
 *
 * If both halves are already authored, this is a no-op (when symmetric)
 * or destructive (when asymmetric). Use only on half-authored input.
 */
export function mirrorMatrixX(matrix: GlyphMatrix): GlyphMatrix {
  const cells = matrix.cells.split('')
  const halfX = Math.floor(matrix.sizeX / 2)
  for (let y = 0; y < matrix.sizeY; y++) {
    for (let z = 0; z < matrix.sizeZ; z++) {
      for (let x = 0; x < halfX; x++) {
        const srcIdx = cellIndex(matrix, x, y, z)
        const dstX = matrix.sizeX - 1 - x
        const dstIdx = cellIndex(matrix, dstX, y, z)
        const src = cells[srcIdx]
        if (src === undefined) continue
        cells[dstIdx] = mirrorGlyph(src)
      }
    }
  }
  return { ...matrix, cells: cells.join('') }
}

// ============================================================
// HELPERS — shaping per-Primitive output
// ============================================================

function geometryForMaterial(m: GlyphMaterial): Primitive['geometry'] {
  // Most glyphs render as polyhedral voxel cubes. A few classes have
  // shapes that hint at thinner/finer geometry; the renderer is free
  // to ignore the hint and use cubes uniformly.
  switch (m.physicsClass) {
    case 'gas':        return 'volumetric'
    case 'liquid':     return 'volumetric'
    case 'decoration': return 'card'
    case 'trigger':    return 'particles'
    default:           return 'polyhedron'
  }
}

function rotationForPose(poseFamily: number, poseProgress: number): number {
  // Simple deterministic rotation: family seeds a base angle; progress
  // adds a small wobble. Real animation systems will replace this with
  // per-bone perturbation.
  const base = (poseFamily * 0.7853981633974483) % (Math.PI * 2) // 45° per family
  const wobble = poseProgress * 0.1
  return base + wobble
}

function scaleForBuild(baseScale: number, build: number): number {
  // build in [0,1]: 0.5 = canonical proportions, <0.5 = leaner, >0.5 = bulkier.
  // Multiplicative factor in [0.85, 1.15].
  return baseScale * (0.85 + build * 0.30)
}

// ============================================================
// VERIFICATION HELPERS — used by tests
// ============================================================

/**
 * Two Primitive arrays are deep-equal if they have the same length and
 * each element matches field-by-field. Used by determinism tests.
 */
export function primitivesEqual(a: Primitive[], b: Primitive[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const pa = a[i]
    const pb = b[i]
    if (pa.materialClass !== pb.materialClass) return false
    if (pa.geometry      !== pb.geometry)      return false
    if (pa.scale         !== pb.scale)         return false
    if (pa.rotation      !== pb.rotation)      return false
    if (pa.variant       !== pb.variant)       return false
    if (pa.position.x !== pb.position.x || pa.position.y !== pb.position.y || pa.position.z !== pb.position.z) return false
    if (pa.color.r !== pb.color.r || pa.color.g !== pb.color.g || pa.color.b !== pb.color.b) return false
    if (pa.affixes.length !== pb.affixes.length) return false
    for (let j = 0; j < pa.affixes.length; j++) {
      if (pa.affixes[j] !== pb.affixes[j]) return false
    }
  }
  return true
}

// ============================================================
// EQUIPMENT — pieces that snap onto a body's snap addresses
// ============================================================

/**
 * One piece of equipment. Its own glyph matrix; attaches to a snap address
 * (1-9) on a body matrix. The body's snap voxel + the equipment's
 * `attachPoint` voxel align in world space.
 *
 * The matrix-as-equipment carries no palette here — palette is a render-time
 * concern (different iron vs steel vs gilded versions of the same shape).
 */
export interface EquipmentPiece {
  id: string
  matrix: GlyphMatrix
  /** Snap address on the body (1-9) this piece attaches to. */
  snapAddress: number
  /**
   * Cell within the equipment matrix that aligns with the body's snap voxel.
   * Default: bottom-center — `(sizeX/2, 0, sizeZ/2)`. Override for pieces that
   * naturally hang from a point (e.g., a sword whose grip is mid-handle).
   */
  attachPoint?: Vec3
}

/**
 * Resolved placement for one equipment piece in body-relative world space.
 * The page hands these to the viewer (one viewer per placement) along with
 * any palette override.
 */
export interface EquipmentPlacement {
  id: string
  matrix: GlyphMatrix
  /** World position to pass as the viewer's `position` prop. */
  worldPosition: [number, number, number]
  /** Tile footprint at the body's voxel scale. */
  tileFootprint: { width: number; height: number; depth: number }
}

/**
 * Snap addresses present in a body matrix, mapped to their (cellX, cellY, cellZ)
 * grid coordinates. Returns the FIRST occurrence of each digit (matrices should
 * have at most one cell per snap address).
 */
export function findSnapCells(matrix: GlyphMatrix): Map<number, Vec3> {
  const out = new Map<number, Vec3>()
  for (let y = 0; y < matrix.sizeY; y++) {
    for (let z = 0; z < matrix.sizeZ; z++) {
      for (let x = 0; x < matrix.sizeX; x++) {
        const g = readCell(matrix, x, y, z)
        if (!isAddress(g)) continue
        const digit = parseInt(g, 10)
        if (Number.isNaN(digit) || out.has(digit)) continue
        out.set(digit, { x, y, z })
      }
    }
  }
  return out
}

/**
 * Compute world-space placements for a list of equipment pieces attached to
 * a body matrix. Equipment voxels render at the body's per-axis voxel scale,
 * so a 6×3×6 helm fills 6 body-voxels worth of world space (no extra scaling).
 *
 * The body matrix is centered on its X/Z axes, with floor at y=0 — same
 * convention as `applyGlyphMatrix`. Each equipment piece's `attachPoint` cell
 * coincides with the body's snap voxel in world space.
 */
export function placeEquipment(
  body: GlyphMatrix,
  bodyFootprint: { width: number; height: number; depth: number },
  equipment: ReadonlyArray<EquipmentPiece>,
): EquipmentPlacement[] {
  const bvx = bodyFootprint.width  / body.sizeX
  const bvy = bodyFootprint.height / body.sizeY
  const bvz = bodyFootprint.depth  / body.sizeZ
  const bcx = (body.sizeX - 1) / 2
  const bcz = (body.sizeZ - 1) / 2

  const snaps = findSnapCells(body)
  const out: EquipmentPlacement[] = []

  for (const eq of equipment) {
    const snap = snaps.get(eq.snapAddress)
    if (!snap) {
      throw new Error(
        `placeEquipment: body has no snap address ${eq.snapAddress} for piece '${eq.id}'`,
      )
    }
    // Body voxel → world position (same math as applyGlyphMatrix).
    const snapWorldX = (snap.x - bcx) * bvx
    const snapWorldY = snap.y * bvy + bvy / 2
    const snapWorldZ = (snap.z - bcz) * bvz

    // Equipment renders at body's voxel scale, so its tile footprint =
    // (eqMatrixSize × bodyVoxelSize) per axis.
    const eqFootprint = {
      width:  eq.matrix.sizeX * bvx,
      height: eq.matrix.sizeY * bvy,
      depth:  eq.matrix.sizeZ * bvz,
    }

    // The viewer renders an equipment matrix centered on its X/Z, with floor
    // at y=0. We want the equipment's attach voxel to coincide with the body's
    // snap voxel in world space. Solve for the equipment's group `position`.
    const ecx = (eq.matrix.sizeX - 1) / 2
    const ecz = (eq.matrix.sizeZ - 1) / 2
    const ax = eq.attachPoint?.x ?? ecx
    const ay = eq.attachPoint?.y ?? 0
    const az = eq.attachPoint?.z ?? ecz

    // World offset of the equipment's attach voxel, relative to the equipment
    // group's `position`:
    const localAttachX = (ax - ecx) * bvx
    const localAttachY = ay * bvy + bvy / 2
    const localAttachZ = (az - ecz) * bvz

    out.push({
      id: eq.id,
      matrix: eq.matrix,
      worldPosition: [
        snapWorldX - localAttachX,
        snapWorldY - localAttachY,
        snapWorldZ - localAttachZ,
      ],
      tileFootprint: eqFootprint,
    })
  }

  return out
}

/** Count occupied (rendering) cells in a matrix. */
export function countOccupied(matrix: GlyphMatrix): number {
  let n = 0
  for (const ch of matrix.cells) {
    if (isOccupied(ch) && GLYPH_TABLE[ch]?.materialClass !== null) n++
  }
  return n
}

// ============================================================
// WIRE CODEC — pack a matrix as bytes for transport
// ============================================================
//
// The matrix IS the wire format. Each cell is a glyph index (1 byte).
// Header is 6 bytes: [sizeX_hi, sizeX_lo, sizeY_hi, sizeY_lo, sizeZ_hi, sizeZ_lo].
// RLE variant: each run is 3 bytes [glyphIdx, runLen_hi, runLen_lo], up to 65535.
//
// The receiving client decodes the bytes back into a matrix, optionally
// upscales, runs shell extraction, builds the InstancedMesh, and caches
// the result. The interior bytes never leave RAM. The wire only carries
// the authored 16³ matrix (~4 KB raw, often <1 KB gzipped).
//
// Indices are stable as long as `GLYPH_TABLE`'s key order is stable
// (which it is, because it's a const literal). Server and client share
// the same alphabet code; index = position in the table.

let GLYPH_INDEX_CACHE: { idxOf: Map<Glyph, number>; glyphOf: readonly Glyph[] } | null = null

function glyphIndex(): { idxOf: Map<Glyph, number>; glyphOf: readonly Glyph[] } {
  if (GLYPH_INDEX_CACHE) return GLYPH_INDEX_CACHE
  const keys = Object.keys(GLYPH_TABLE) as Glyph[]
  const idxOf = new Map<Glyph, number>()
  keys.forEach((g, i) => idxOf.set(g, i))
  GLYPH_INDEX_CACHE = { idxOf, glyphOf: keys }
  return GLYPH_INDEX_CACHE
}

/** Encode a matrix as a flat byte stream — 6-byte header + 1 byte per cell. */
export function encodeMatrixRaw(matrix: GlyphMatrix): Uint8Array {
  const { idxOf } = glyphIndex()
  const n = matrix.cells.length
  const buf = new Uint8Array(6 + n)
  buf[0] = (matrix.sizeX >>> 8) & 0xff
  buf[1] = matrix.sizeX & 0xff
  buf[2] = (matrix.sizeY >>> 8) & 0xff
  buf[3] = matrix.sizeY & 0xff
  buf[4] = (matrix.sizeZ >>> 8) & 0xff
  buf[5] = matrix.sizeZ & 0xff
  for (let i = 0; i < n; i++) {
    const g = matrix.cells[i] as Glyph
    const idx = idxOf.get(g)
    if (idx === undefined) throw new Error(`encodeMatrixRaw: unknown glyph '${g}'`)
    buf[6 + i] = idx
  }
  return buf
}

/** Decode a raw matrix byte stream back into a GlyphMatrix. */
export function decodeMatrixRaw(buf: Uint8Array): GlyphMatrix {
  const { glyphOf } = glyphIndex()
  const sizeX = (buf[0] << 8) | buf[1]
  const sizeY = (buf[2] << 8) | buf[3]
  const sizeZ = (buf[4] << 8) | buf[5]
  const n = sizeX * sizeY * sizeZ
  const cells = new Array<string>(n)
  for (let i = 0; i < n; i++) {
    cells[i] = glyphOf[buf[6 + i]] ?? '_'
  }
  return { sizeX, sizeY, sizeZ, cells: cells.join('') }
}

/** Run-length encode the matrix. Excellent for sparse content (mostly `_`). */
export function encodeMatrixRLE(matrix: GlyphMatrix): Uint8Array {
  const { idxOf } = glyphIndex()
  const n = matrix.cells.length
  const out: number[] = [
    (matrix.sizeX >>> 8) & 0xff, matrix.sizeX & 0xff,
    (matrix.sizeY >>> 8) & 0xff, matrix.sizeY & 0xff,
    (matrix.sizeZ >>> 8) & 0xff, matrix.sizeZ & 0xff,
  ]
  let i = 0
  while (i < n) {
    const g = matrix.cells[i] as Glyph
    const idx = idxOf.get(g)
    if (idx === undefined) throw new Error(`encodeMatrixRLE: unknown glyph '${g}'`)
    let runLen = 1
    const MAX = 65535
    while (i + runLen < n && matrix.cells[i + runLen] === g && runLen < MAX) {
      runLen++
    }
    out.push(idx, (runLen >>> 8) & 0xff, runLen & 0xff)
    i += runLen
  }
  return new Uint8Array(out)
}

/** Decode an RLE matrix back. Inverse of encodeMatrixRLE. */
export function decodeMatrixRLE(buf: Uint8Array): GlyphMatrix {
  const { glyphOf } = glyphIndex()
  const sizeX = (buf[0] << 8) | buf[1]
  const sizeY = (buf[2] << 8) | buf[3]
  const sizeZ = (buf[4] << 8) | buf[5]
  const out: string[] = []
  let i = 6
  while (i < buf.length) {
    const g = glyphOf[buf[i]] ?? '_'
    const runLen = (buf[i + 1] << 8) | buf[i + 2]
    for (let j = 0; j < runLen; j++) out.push(g)
    i += 3
  }
  return { sizeX, sizeY, sizeZ, cells: out.join('') }
}

/** gzip a byte buffer using the browser's CompressionStream. */
export async function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream not available (need browser or Node 18+)')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enqueueInput: any = input
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(enqueueInput)
      controller.close()
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: ReadableStream<Uint8Array> = source.pipeThrough(new CompressionStream('gzip') as any)
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}

// ============================================================
// UPSCALE — expand authoring-resolution to native voxel resolution
// ============================================================

/**
 * Each authoring cell expands to a `sx × sy × sz` block of identical-glyph
 * cells in the new matrix. Nearest-neighbor upscale; no smoothing.
 *
 * Use case: a goblin authored at 16³ for human tractability gets upscaled to
 * its native voxel resolution (e.g., 64×128×64 if 1 tile = 64 voxels and the
 * goblin is 1×2×1 tiles). The fine-grained matrix is then shell-extracted —
 * the interior bytes never leave RAM, only the surface ships.
 *
 * Pure function. Original matrix is not mutated.
 */
export function upscaleMatrix(
  matrix: GlyphMatrix,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): GlyphMatrix {
  if (scaleX < 1 || scaleY < 1 || scaleZ < 1) {
    throw new Error(`upscaleMatrix: scale must be >= 1; got (${scaleX}, ${scaleY}, ${scaleZ})`)
  }
  if (scaleX === 1 && scaleY === 1 && scaleZ === 1) return matrix

  const newSizeX = matrix.sizeX * scaleX
  const newSizeY = matrix.sizeY * scaleY
  const newSizeZ = matrix.sizeZ * scaleZ

  // Build a flat Uint8 lookup of the source so we don't pay charAt cost in the hot loop.
  const src = matrix.cells
  const buf = new Array<string>(newSizeY * newSizeZ * newSizeX)

  let i = 0
  for (let y = 0; y < newSizeY; y++) {
    const cy = (y / scaleY) | 0
    for (let z = 0; z < newSizeZ; z++) {
      const cz = (z / scaleZ) | 0
      const rowStart = cy * matrix.sizeX * matrix.sizeZ + cz * matrix.sizeX
      for (let x = 0; x < newSizeX; x++) {
        const cx = (x / scaleX) | 0
        buf[i++] = src[rowStart + cx]
      }
    }
  }
  return {
    sizeX: newSizeX,
    sizeY: newSizeY,
    sizeZ: newSizeZ,
    cells: buf.join(''),
  }
}

// ============================================================
// SHELL EXTRACTION — drop hidden interior voxels
// ============================================================

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, 0, 0], [1, 0, 0],
  [0, -1, 0], [0, 1, 0],
  [0, 0, -1], [0, 0, 1],
]

/**
 * True if all 6 axis neighbors of (x, y, z) are occupied AND opaque.
 * An interior voxel is invisible from any viewpoint — its faces are
 * occluded on all sides by neighboring opaque material — so the renderer
 * can drop it without changing what the viewer sees.
 *
 * Out-of-bounds neighbors count as empty (a voxel on the matrix edge
 * is always shell because at least one face faces "outside the world").
 */
export function isInteriorVoxel(
  matrix: GlyphMatrix,
  x: number,
  y: number,
  z: number,
): boolean {
  for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    const nz = z + dz
    if (
      nx < 0 || nx >= matrix.sizeX ||
      ny < 0 || ny >= matrix.sizeY ||
      nz < 0 || nz >= matrix.sizeZ
    ) {
      return false // out of bounds = exposed face
    }
    const ng = readCell(matrix, nx, ny, nz)
    if (!isOccupied(ng)) return false
    const nm = GLYPH_TABLE[ng]
    if (!nm || !nm.opaque) return false
  }
  return true
}

/**
 * Return a new matrix with all interior voxels replaced by `_` empty.
 * The visible shape is unchanged from any viewpoint; the cube count drops
 * dramatically (typically 60-80% for solid objects). This is the matrix
 * to ship to the renderer.
 *
 * Pure function. Original matrix is not mutated.
 */
export function extractShell(matrix: GlyphMatrix): GlyphMatrix {
  const cells = matrix.cells.split('')
  for (let y = 0; y < matrix.sizeY; y++) {
    for (let z = 0; z < matrix.sizeZ; z++) {
      for (let x = 0; x < matrix.sizeX; x++) {
        const idx = cellIndex(matrix, x, y, z)
        const g = cells[idx]
        if (!isOccupied(g)) continue
        const m = GLYPH_TABLE[g]
        if (!m || m.materialClass === null) continue
        if (isInteriorVoxel(matrix, x, y, z)) {
          cells[idx] = '_'
        }
      }
    }
  }
  return { ...matrix, cells: cells.join('') }
}
