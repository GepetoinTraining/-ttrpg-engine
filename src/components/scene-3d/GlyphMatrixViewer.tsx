'use client'

/**
 * GLYPH MATRIX VIEWER — voxel cubes from a parsed glyph matrix
 * ==================================================================
 *
 * Takes a `GlyphMatrix` and renders one cube per occupied non-marker cell,
 * colored by the glyph's `RenderHint.baseColor` (or palette override).
 *
 * **Two layers of size:**
 *   - The matrix dimensions (sizeX × sizeY × sizeZ) are *authoring resolution*.
 *   - The `tileFootprint` is *world placement* in tile units (1 tile = 1 world
 *     unit). A goblin = 1×2×1 tiles. A medium tree = 2×4×2 tiles. A dragon
 *     might be 4×3×4. Each archetype declares its footprint independently
 *     of how many voxel cells were used to author it.
 *
 * **Rendering:**
 * Uses THREE.InstancedMesh — one geometry, one material, N per-instance
 * matrices + colors baked into a buffer. Scales to hundreds of thousands of
 * cubes without React render-cost-per-cube. The matrix should be shell-only
 * by the time it reaches the viewer (interior voxels are dropped upstream
 * by `extractShell`).
 *
 * Coordinate convention:
 *   - matrix.y maps to world Y (up)
 *   - matrix.x maps to world X (right)
 *   - matrix.z maps to world Z (forward)
 *   - The matrix is centered on X/Z; floor at world Y=0.
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  GLYPH_TABLE,
  isOccupied,
  type Glyph,
} from '../../../engine/glyphs/alphabet'
import {
  type GlyphMatrix,
  readCell,
} from '../../../engine/glyphs/mold-evaluator'

export interface RGB { r: number; g: number; b: number }

/**
 * Palette override — per-glyph color substitution at render time.
 * The alphabet's `RenderHint.baseColor` is the *generic* default (skin = pink
 * flesh, fur = brown, etc.). Specific species have specific colors: a goblin's
 * skin is green; an orc's is gray; a dwarf's is ruddy.
 *
 * The matrix stays species-agnostic. The palette is what species-specific data
 * supplies at render time. This is the same principle as the codec doc's
 * "palette wedge channels" — the disc tensor carries the palette indices,
 * the catalog supplies the actual RGB.
 */
export type GlyphPalette = Partial<Record<Glyph, RGB>>

/**
 * Tile-unit footprint for an archetype. 1 tile = 1 world unit.
 * Goblins (Small/Medium): { width: 1, height: 2, depth: 1 }
 * Medium tree:            { width: 2, height: 4, depth: 2 }
 * Large tree / oak:       { width: 4, height: 6, depth: 4 }
 * Bear / ogre (Large):    { width: 2, height: 3, depth: 2 }
 */
export interface TileFootprint {
  /** Tiles wide (X axis) */
  width: number
  /** Tiles tall (Y axis, up) */
  height: number
  /** Tiles deep (Z axis) */
  depth: number
}

interface GlyphMatrixViewerProps {
  matrix: GlyphMatrix
  /**
   * Tile-unit extent of this archetype in the world. The matrix's authoring
   * cells stretch to fill this footprint (rectangular voxels if the aspect
   * ratios don't match — that's fine).
   */
  tileFootprint: TileFootprint
  /** World position of the matrix's local origin (floor center, y=0). */
  position?: [number, number, number]
  /** Optional per-glyph color overrides for this instance. */
  palette?: GlyphPalette
}

interface VoxelInstance {
  pos: [number, number, number]
  color: { r: number; g: number; b: number }
  glyph: Glyph
}

const GAP = 1.0 // flush — adjacent shell cubes touch (no visible seams between voxels)

export function GlyphMatrixViewer({
  matrix,
  tileFootprint,
  position = [0, 0, 0],
  palette,
}: GlyphMatrixViewerProps): React.ReactElement | null {
  const { voxels, sizeX, sizeY, sizeZ } = useMemo(() => {
    const sx = tileFootprint.width / matrix.sizeX
    const sy = tileFootprint.height / matrix.sizeY
    const sz = tileFootprint.depth / matrix.sizeZ
    const cx = (matrix.sizeX - 1) / 2
    const cz = (matrix.sizeZ - 1) / 2
    const out: VoxelInstance[] = []

    for (let y = 0; y < matrix.sizeY; y++) {
      for (let z = 0; z < matrix.sizeZ; z++) {
        for (let x = 0; x < matrix.sizeX; x++) {
          const g = readCell(matrix, x, y, z)
          if (!isOccupied(g)) continue
          const m = GLYPH_TABLE[g]
          if (!m || m.materialClass === null) continue

          const override = palette?.[g]
          const c = override ?? m.renderHint.baseColor
          out.push({
            pos: [
              (x - cx) * sx,
              y * sy + sy / 2,
              (z - cz) * sz,
            ],
            color: c,
            glyph: g,
          })
        }
      }
    }
    return { voxels: out, sizeX: sx, sizeY: sy, sizeZ: sz }
  }, [matrix, tileFootprint.width, tileFootprint.height, tileFootprint.depth, palette])

  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]
      m.makeTranslation(v.pos[0], v.pos[1], v.pos[2])
      mesh.setMatrixAt(i, m)
      c.setRGB(v.color.r / 255, v.color.g / 255, v.color.b / 255)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = voxels.length
  }, [voxels])

  if (voxels.length === 0) return null

  return (
    <group position={position}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, voxels.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sizeX * GAP, sizeY * GAP, sizeZ * GAP]} />
        <meshStandardMaterial roughness={0.85} metalness={0.0} />
      </instancedMesh>
    </group>
  )
}
