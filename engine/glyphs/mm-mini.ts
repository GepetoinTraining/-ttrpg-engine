/**
 * MM-MINI — fleshing walker for a creature skeleton
 * ==================================================================
 *
 * The skeleton IS the MM. This module provides the walk: visit every
 * node that has an `mf` attached, run that MF with `FleshParams`, and
 * stamp each returned patch into a single composed glyph matrix.
 *
 * Nodes without an MF are skipped. That's the development path: build
 * one MF at a time (foot → lower_leg → thigh → ...) and watch the body
 * accrete piece by piece without breaking the in-between renders.
 *
 * The composed matrix is at native voxel resolution
 * (`footprint × VOXELS_PER_TILE`). It can be passed straight to the
 * existing pipeline (shell extraction → InstancedMesh).
 */

import type { GlyphMatrix } from './mold-evaluator'
import type {
  FleshParams,
  MfPatch,
  Skeleton,
  SkeletonNode,
} from './skeleton'

/** Native voxel resolution: 1 world tile = this many voxels. */
export const VOXELS_PER_TILE = 64

export interface MmMiniFootprint {
  width: number
  height: number
  depth: number
}

export interface FleshResult {
  /** Composed creature matrix at native resolution. */
  matrix: GlyphMatrix
  /** Per-node receipts produced during the walk. */
  receipts: ReadonlyArray<MfPatch['receipt']>
  /** Diagnostics. */
  stats: {
    nodesVisited: number
    nodesWithMf: number
    cellsStamped: number
    walkMs: number
  }
}

/**
 * Walk a skeleton, fleshing every node that has an `mf` attached, and
 * compose the patches into a single creature-scale glyph matrix.
 */
export function flesh(
  skeleton: Skeleton,
  footprint: MmMiniFootprint,
  params: FleshParams,
): FleshResult {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now())

  const sizeX = Math.round(footprint.width * VOXELS_PER_TILE)
  const sizeY = Math.round(footprint.height * VOXELS_PER_TILE)
  const sizeZ = Math.round(footprint.depth * VOXELS_PER_TILE)
  const total = sizeX * sizeY * sizeZ
  const cells = new Array<string>(total).fill('_')

  const halfX = sizeX / 2
  const halfZ = sizeZ / 2
  const cellIndex = (x: number, y: number, z: number) =>
    y * (sizeX * sizeZ) + z * sizeX + x

  const receipts: MfPatch['receipt'][] = []
  let nodesWithMf = 0
  let cellsStamped = 0

  for (const node of skeleton.nodes) {
    if (!node.mf) continue
    nodesWithMf++
    const patch = node.mf(node, params)
    receipts.push(patch.receipt)
    cellsStamped += stampPatch({
      cells, sizeX, sizeY, sizeZ,
      patch,
      // Convert patch's local-(0,0,0) world coord → global matrix coord.
      // Matrix is centered on x and z; floor at y=0.
      offsetX: Math.round(patch.localOrigin[0] * VOXELS_PER_TILE + halfX),
      offsetY: Math.round(patch.localOrigin[1] * VOXELS_PER_TILE),
      offsetZ: Math.round(patch.localOrigin[2] * VOXELS_PER_TILE + halfZ),
      cellIndex,
    })
  }

  const matrix: GlyphMatrix = { sizeX, sizeY, sizeZ, cells: cells.join('') }
  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now())

  return {
    matrix,
    receipts,
    stats: {
      nodesVisited: skeleton.nodes.length,
      nodesWithMf,
      cellsStamped,
      walkMs: t1 - t0,
    },
  }
}

interface StampInputs {
  cells: string[]
  sizeX: number
  sizeY: number
  sizeZ: number
  patch: MfPatch
  offsetX: number
  offsetY: number
  offsetZ: number
  cellIndex: (x: number, y: number, z: number) => number
}

function stampPatch(input: StampInputs): number {
  const { cells, sizeX, sizeY, sizeZ, patch, offsetX, offsetY, offsetZ, cellIndex } = input
  const { matrix } = patch
  let stamped = 0
  for (let py = 0; py < matrix.sizeY; py++) {
    const gy = offsetY + py
    if (gy < 0 || gy >= sizeY) continue
    for (let pz = 0; pz < matrix.sizeZ; pz++) {
      const gz = offsetZ + pz
      if (gz < 0 || gz >= sizeZ) continue
      for (let px = 0; px < matrix.sizeX; px++) {
        const gx = offsetX + px
        if (gx < 0 || gx >= sizeX) continue
        const pIdx = py * matrix.sizeX * matrix.sizeZ + pz * matrix.sizeX + px
        const ch = matrix.cells.charAt(pIdx)
        if (ch === '_' || ch === '') continue
        cells[cellIndex(gx, gy, gz)] = ch
        stamped++
      }
    }
  }
  return stamped
}

/** Lookup a node's MF by walking the skeleton. */
export function getNodeMf(skeleton: Skeleton, nodeId: string): SkeletonNode['mf'] | undefined {
  return skeleton.nodes.find((n) => n.id === nodeId)?.mf
}
