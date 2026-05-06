/**
 * MOLD EVALUATOR — load a baked mold descriptor and apply to MarchingCubes
 * ===========================================================================
 *
 * Client-side counterpart to scripts/author-mold.mts.
 *
 *   server (dev-time):  STL → voxel SDF → JSON descriptor → CDN
 *   client (runtime):   fetch JSON → decode field → mc.setCell × N³ → mc.update()
 *
 * The client never sees the heavy SDF/CSG packages. It just consumes the
 * baked field-strength array. Marching-cubes evaluation is the only render-
 * time work, and that's standard Three.js.
 */

import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

// ============================================================
// MOLD DESCRIPTOR — the wire format
// ============================================================

export interface EquipmentSlotAddress {
  x: number
  y: number
  z: number
}

export interface MoldDescriptor {
  moldId: string
  archetype: string
  source: { file: string; sha256?: string; license: string }
  authoredAt: string

  resolution: number
  isolation: number
  fieldEncoding: 'float32-base64'
  fieldStrength: string         // base64 of Float32Array
  /** Bounding box of actual content in field [0,1] coords (null if empty). */
  contentBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null

  equipmentSlotAddresses: Record<string, EquipmentSlotAddress>
  footprintTiles: number
  notes: string
}

// ============================================================
// FETCH + DECODE
// ============================================================

/** Fetch a mold descriptor from /public/molds/. Caches in a module-level Map. */
const CACHE = new Map<string, Promise<MoldDescriptor>>()

export function loadMold(moldId: string): Promise<MoldDescriptor> {
  let p = CACHE.get(moldId)
  if (!p) {
    p = fetch(`/molds/${moldId}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`mold ${moldId}: HTTP ${r.status}`)
        return r.json() as Promise<MoldDescriptor>
      })
      .then(descriptor => {
        if (descriptor.fieldEncoding !== 'float32-base64') {
          throw new Error(`mold ${moldId}: unsupported encoding ${descriptor.fieldEncoding}`)
        }
        return descriptor
      })
    CACHE.set(moldId, p)
  }
  return p
}

/** Decode the base64 field-strength buffer into a Float32Array. */
export function decodeFieldStrength(descriptor: MoldDescriptor): Float32Array {
  const N = descriptor.resolution
  const expected = N * N * N
  // Browser-side base64 → Uint8Array → Float32Array
  const binary = atob(descriptor.fieldStrength)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const floats = new Float32Array(bytes.buffer)
  if (floats.length !== expected) {
    throw new Error(`mold ${descriptor.moldId}: expected ${expected} cells, got ${floats.length}`)
  }
  return floats
}

// ============================================================
// APPLY TO MARCHING CUBES — write the field, not metaballs
// ============================================================

/**
 * Write the descriptor's voxel field directly into the MarchingCubes' field
 * buffer via setCell(). This bypasses addBall() — instead of a sum of
 * sphere fields, we use the literal voxelized SDF from the authored mold.
 *
 * IMPORTANT: the MarchingCubes resolution must match the descriptor's
 * resolution (same N for both). A mismatch produces wrong topology.
 */
export function applyMoldToMarchingCubes(
  mc: MarchingCubes,
  descriptor: MoldDescriptor,
): void {
  if (mc.resolution !== descriptor.resolution) {
    throw new Error(
      `MarchingCubes resolution (${mc.resolution}) does not match mold resolution (${descriptor.resolution}). ` +
      `Recreate the MC instance at the descriptor's resolution before applying.`
    )
  }

  const field = decodeFieldStrength(descriptor)
  mc.reset()
  mc.isolation = descriptor.isolation

  const N = mc.resolution
  for (let z = 0; z < N; z++) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const value = field[z * N * N + y * N + x]
        if (value > 0) mc.setCell(x, y, z, value)
      }
    }
  }
  mc.update()
}
