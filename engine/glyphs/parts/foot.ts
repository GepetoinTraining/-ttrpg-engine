/**
 * MF — Humanoid foot
 * ==================================================================
 *
 * Procedural voxel generator for a foot. Reads the foot node's head
 * (ankle / heel-back) and tail (toe tip) from the skeleton, plus the
 * `FleshParams` (species, height, constitution, instance seed), and
 * produces the foot's voxel patch.
 *
 * Vitruvian ratios (the defaults for `humanoid` species):
 *   foot_length    = body_height × ~1/8     (Da Vinci put it ~1/6, classical canon ~1/7-1/8)
 *   foot_width_max = foot_length × 0.36     (widest at metatarsal arch)
 *   foot_height_max= foot_length × 0.32     (tallest at instep)
 *
 * Profile (cross-section width and top-curve height) varies along the
 * length-fraction t ∈ [0, 1] (heel → toe):
 *
 *     t      width    height     anatomical landmark
 *   0.00     0.55      0.65      heel / ankle base
 *   0.20     0.85      1.00      instep peak (highest dorsum)
 *   0.65     1.00      0.55      ball of foot (widest)
 *   0.90     0.70      0.30      toe joint
 *   1.00     0.00      0.00      toe tip (closes)
 *
 * Linear interpolation between control points. Multiplied by maxWidth /
 * maxHeight to produce per-voxel-row dimensions.
 *
 * The patch is generated in foot-local coords:
 *   - x: width axis (0 .. sizeX-1, centered on bone at (sizeX-1)/2)
 *   - y: height axis (0 = sole on ground, sizeY-1 = top of dorsum)
 *   - z: length axis (0 = heel back, sizeZ-1 = toe tip)
 *
 * Glyph assignment:
 *   - empty cells:        '_'  (outside the foot shape)
 *   - boundary cells:     's'  (skin — any 6-neighbor is empty / OOB)
 *   - inner cells:        'f'  (flesh — fully surrounded by occupied)
 *
 * Note: bone (`b`) glyphs are deferred. The interior `f` cells will mostly
 * be dropped by global shell extraction; only the outer `s` shell ships.
 */

import type { GlyphMatrix } from '../mold-evaluator'
import type { FleshParams, MfPatch, SkeletonNode } from '../skeleton'

// ──────────────────────────────────────────────────────────────
// Constants — Vitruvian humanoid foot
// ──────────────────────────────────────────────────────────────

/** Native voxel resolution: 1 world tile = 64 voxels in each axis. */
const TILE_VOXELS = 64

/** Foot length as a fraction of total body height (Da Vinci canon). */
const FOOT_LENGTH_RATIO = 1 / 8

/** Max foot width as a fraction of foot length (ball-of-foot wider span). */
const FOOT_WIDTH_RATIO = 0.45

/** Max foot height (top of instep) as a fraction of foot length. */
const FOOT_HEIGHT_RATIO = 0.22

/** Width and height profile along the length axis (t = 0 heel, t = 1 toe). */
const FOOT_PROFILE: ReadonlyArray<{ t: number; w: number; h: number }> = [
  { t: 0.00, w: 0.55, h: 0.65 }, // heel / ankle base
  { t: 0.20, w: 0.85, h: 1.00 }, // instep peak
  { t: 0.65, w: 1.00, h: 0.55 }, // ball of foot (widest)
  { t: 0.90, w: 0.70, h: 0.30 }, // toe joint
  { t: 1.00, w: 0.00, h: 0.00 }, // toe tip closes
]

function profileAt(t: number): { w: number; h: number } {
  if (t <= 0) return { w: FOOT_PROFILE[0].w, h: FOOT_PROFILE[0].h }
  if (t >= 1) return { w: 0, h: 0 }
  for (let i = 0; i < FOOT_PROFILE.length - 1; i++) {
    const a = FOOT_PROFILE[i]
    const b = FOOT_PROFILE[i + 1]
    if (t >= a.t && t <= b.t) {
      const frac = (t - a.t) / (b.t - a.t)
      return {
        w: a.w + (b.w - a.w) * frac,
        h: a.h + (b.h - a.h) * frac,
      }
    }
  }
  return { w: 0, h: 0 }
}

// ──────────────────────────────────────────────────────────────
// MF — generate a foot patch for a humanoid foot node
// ──────────────────────────────────────────────────────────────

export function mfHumanoidFoot(
  node: SkeletonNode,
  params: FleshParams,
): MfPatch {
  // Bone vector. The skeleton's foot has head at heel/ankle and tail at toe.
  const dx = node.tail[0] - node.head[0]
  const dy = node.tail[1] - node.head[1]
  const dz = node.tail[2] - node.head[2]
  const boneLen = Math.sqrt(dx * dx + dy * dy + dz * dz)

  // Vitruvian-derived target length (height × 1/8). If the bone in the
  // skeleton is shorter, the bone wins (skeleton is canonical pose).
  // For first iteration we honor the skeleton's bone length directly so
  // the foot lines up with the wire.
  const length = boneLen
  const maxWidth = length * FOOT_WIDTH_RATIO * params.constitution
  const maxHeight = length * FOOT_HEIGHT_RATIO * params.constitution

  // Voxel counts (round up so we don't truncate the silhouette).
  const lengthVox = Math.max(1, Math.ceil(length * TILE_VOXELS))
  const widthVox = Math.max(1, Math.ceil(maxWidth * TILE_VOXELS))
  const heightVox = Math.max(1, Math.ceil(maxHeight * TILE_VOXELS))

  // Patch dimensions: extra margin so the boundary cells have room for skin.
  // sizeX must be odd so we can center the bone on a single column.
  const sizeX = widthVox + 1 + ((widthVox + 1) % 2 === 0 ? 1 : 0)
  const sizeY = heightVox + 1
  const sizeZ = lengthVox + 1
  const cellsArr: string[] = new Array(sizeX * sizeY * sizeZ).fill('_')
  const idx = (x: number, y: number, z: number) =>
    y * sizeX * sizeZ + z * sizeX + x

  // Pass 1 — mark which cells are inside the foot shape.
  const insideMap = new Uint8Array(sizeX * sizeY * sizeZ)
  const centerX = (sizeX - 1) / 2
  for (let z = 0; z < sizeZ; z++) {
    const t = z / lengthVox
    if (t > 1) continue
    const profile = profileAt(t)
    const halfWidthVox = (profile.w * maxWidth * TILE_VOXELS) / 2
    const heightAtZ = profile.h * maxHeight * TILE_VOXELS
    for (let y = 0; y < sizeY; y++) {
      if (y >= heightAtZ) continue
      for (let x = 0; x < sizeX; x++) {
        if (Math.abs(x - centerX) > halfWidthVox) continue
        insideMap[idx(x, y, z)] = 1
      }
    }
  }

  // Pass 2 — for each inside cell, decide skin vs flesh by checking 6 neighbors.
  // Out-of-bounds = outside (so the bottom y=0 sole, the toe-tip front, and
  // the heel back all become skin automatically).
  for (let z = 0; z < sizeZ; z++) {
    for (let y = 0; y < sizeY; y++) {
      for (let x = 0; x < sizeX; x++) {
        if (!insideMap[idx(x, y, z)]) continue
        let exposed = false
        for (const [dx2, dy2, dz2] of NEIGHBORS) {
          const nx = x + dx2
          const ny = y + dy2
          const nz = z + dz2
          if (
            nx < 0 || nx >= sizeX ||
            ny < 0 || ny >= sizeY ||
            nz < 0 || nz >= sizeZ
          ) {
            exposed = true
            break
          }
          if (!insideMap[idx(nx, ny, nz)]) {
            exposed = true
            break
          }
        }
        cellsArr[idx(x, y, z)] = exposed ? 's' : 'f'
      }
    }
  }

  const matrix: GlyphMatrix = {
    sizeX,
    sizeY,
    sizeZ,
    cells: cellsArr.join(''),
  }

  // Patch local-(0,0,0) corner sits at the foot's heel-bottom-back-left in
  // world coords. With foot bone going +z and centered on x:
  //   corner.x = node.head.x − maxWidth/2  − halfPaddingX
  //   corner.y = node.head.y                (sole on ground)
  //   corner.z = node.head.z                 (heel back)
  // Patch is sized symmetrically around the bone's x; the half-pad accounts
  // for the +1 padding ensuring sizeX is odd.
  const padCellsX = (sizeX - 1) / 2
  const halfPadWorldX = padCellsX / TILE_VOXELS
  const localOrigin: [number, number, number] = [
    node.head[0] - halfPadWorldX,
    node.head[1],
    node.head[2],
  ]

  return {
    matrix,
    localOrigin,
    receipt: {
      mfId: 'mf-humanoid-foot-v1',
      nodeId: node.id,
      inputs: {
        head: node.head,
        tail: node.tail,
        params,
        ratios: {
          length: FOOT_LENGTH_RATIO,
          width: FOOT_WIDTH_RATIO,
          height: FOOT_HEIGHT_RATIO,
        },
      },
    },
  }
}

const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, 0, 0], [1, 0, 0],
  [0, -1, 0], [0, 1, 0],
  [0, 0, -1], [0, 0, 1],
]
