/**
 * MOLD AUTHORING — STL → voxel SDF → mold descriptor
 * =====================================================
 *
 * The server-side / dev-time / Vercel-CRON pipeline. Pure file → file.
 * Heavy NPM packages (three-mesh-bvh) live HERE, never ship to the client.
 *
 * Pipeline:
 *   1. Read STL from disk
 *   2. Parse to BufferGeometry (three's STLLoader, ArrayBuffer-based, no DOM)
 *   3. Normalize: translate + scale so the mesh fits inside the [0,1]^3
 *      voxel field with feet at y=0 and head near y=1 (the field convention
 *      our renderer expects)
 *   4. Build a BVH over the mesh for fast spatial queries
 *   5. For each voxel cell:
 *        a. Compute the closest-point distance on the mesh surface
 *        b. Cast a ray to determine inside/outside (sign)
 *        c. Store signed distance
 *   6. Convert SDF → field strength (the form MarchingCubes consumes)
 *   7. Write a mold descriptor JSON under public/molds/
 *
 * Usage:
 *   npx tsx scripts/author-mold.ts <input.stl> <moldId> [resolution]
 *   e.g. npx tsx scripts/author-mold.ts assets/test-humanoid.stl humanoid_test_v1 32
 *
 * The output JSON is ready for the client mold-evaluator to consume.
 *
 * License note: when feeding MZ4250 STLs, this output is a derivative work
 * (CC-BY-NC). Commercial release requires CC0 source assets.
 */

import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { MeshBVH } from 'three-mesh-bvh'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'

// ============================================================
// CLI ARGS
// ============================================================

const inputPath = process.argv[2]
const moldId    = process.argv[3] ?? basename(process.argv[2] ?? 'mold', '.stl')
const resolution = parseInt(process.argv[4] ?? '32', 10)

if (!inputPath) {
  console.error('usage: npx tsx scripts/author-mold.ts <input.stl> <moldId> [resolution=32]')
  process.exit(1)
}
if (resolution < 8 || resolution > 128 || (resolution & (resolution - 1)) !== 0) {
  console.warn(`[author-mold] non-power-of-2 resolution ${resolution} — may cause MarchingCubes artefacts`)
}

console.log(`[author-mold] input:  ${inputPath}`)
console.log(`[author-mold] moldId: ${moldId}`)
console.log(`[author-mold] grid:   ${resolution}^3 = ${(resolution ** 3).toLocaleString()} voxels`)

// ============================================================
// STEP 1+2: load STL → BufferGeometry
// ============================================================

const stlBytes = readFileSync(resolve(process.cwd(), inputPath))
// STLLoader.parse expects an ArrayBuffer (or a string for ASCII STL)
const arrayBuffer = stlBytes.buffer.slice(
  stlBytes.byteOffset,
  stlBytes.byteOffset + stlBytes.byteLength,
) as ArrayBuffer

const loader = new STLLoader()
const rawGeometry = loader.parse(arrayBuffer)
const triangleCount = (rawGeometry.index ? rawGeometry.index.count : rawGeometry.attributes.position.count) / 3
console.log(`[author-mold] parsed: ${triangleCount} triangles`)

// ============================================================
// STEP 3: normalize the mesh into [0,1]^3 with feet at y=0
// ============================================================

rawGeometry.computeBoundingBox()
const bbox = rawGeometry.boundingBox!
const span = new THREE.Vector3().subVectors(bbox.max, bbox.min)
const longestSide = Math.max(span.x, span.y, span.z)

console.log(`[author-mold] bbox span: ${span.x.toFixed(3)} × ${span.y.toFixed(3)} × ${span.z.toFixed(3)}`)
console.log(`[author-mold] longest side: ${longestSide.toFixed(3)}`)

// Margin so the mesh doesn't touch the [0,1] boundary (where MC clips)
const TARGET = 0.86
const scale = TARGET / longestSide
// Centre on x and z; bottom-align on y (feet at the bottom of the field)
const cx = (bbox.min.x + bbox.max.x) / 2
const cz = (bbox.min.z + bbox.max.z) / 2
const ymin = bbox.min.y

rawGeometry.translate(-cx, -ymin, -cz)
rawGeometry.scale(scale, scale, scale)
// Now the mesh is centred horizontally on (0, *, 0), with feet at y=0,
// and longest extent = TARGET. Translate to centre [0.5, 0.5, 0.5] of field:
const yMargin = (1 - TARGET) / 2
rawGeometry.translate(0.5, yMargin, 0.5)

rawGeometry.computeBoundingBox()
const finalBbox = rawGeometry.boundingBox!
console.log(`[author-mold] normalized bbox: ` +
  `(${finalBbox.min.x.toFixed(2)}, ${finalBbox.min.y.toFixed(2)}, ${finalBbox.min.z.toFixed(2)}) → ` +
  `(${finalBbox.max.x.toFixed(2)}, ${finalBbox.max.y.toFixed(2)}, ${finalBbox.max.z.toFixed(2)})`)

// ============================================================
// STEP 4: build BVH for fast distance queries
// ============================================================

const bvh = new MeshBVH(rawGeometry, { strategy: 0 /* CENTER, fast build */ })
console.log(`[author-mold] BVH built`)

// ============================================================
// STEP 5: voxelize — closest-point distance + inside/outside test
// ============================================================
//
// For each voxel cell, query the BVH for closest point on the mesh.
// To determine inside/outside, count ray intersections from the point
// to a far direction (odd = inside, even = outside) — three-mesh-bvh
// has a `bvhcast` / `intersectsBox` / `raycastFirst` helpers; the
// simplest sign test is via raycasting along +X.

const N = resolution
const sdf = new Float32Array(N * N * N)
const probe = new THREE.Vector3()
const closestTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
const raycaster = new THREE.Raycaster()
raycaster.firstHitOnly = false  // we need ALL hits for inside/outside parity

// Majority-vote inside/outside across 3 ray axes. Robust to meshes that
// have overlapping/self-intersecting geometry (very common when the STL
// was authored as a CSG-style boolean union — even MZ4250 files often
// have parts that overlap at joints).
const axes: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
function isInsideMesh(probe: THREE.Vector3): boolean {
  let votes = 0
  for (const [dx, dy, dz] of axes) {
    raycaster.ray.origin.copy(probe)
    raycaster.ray.direction.set(dx, dy, dz)
    const hits = bvh.raycast(raycaster.ray, THREE.DoubleSide)
    if (hits.length % 2 === 1) votes++
  }
  return votes >= 2  // 2 of 3 = inside
}

let insideCount = 0
const t0 = Date.now()
for (let z = 0; z < N; z++) {
  const fz = (z + 0.5) / N
  for (let y = 0; y < N; y++) {
    const fy = (y + 0.5) / N
    for (let x = 0; x < N; x++) {
      const fx = (x + 0.5) / N
      probe.set(fx, fy, fz)

      bvh.closestPointToPoint(probe, closestTarget)
      const dist = closestTarget.distance

      const inside = isInsideMesh(probe)
      if (inside) insideCount++

      sdf[z * N * N + y * N + x] = inside ? -dist : dist
    }
  }
  if (z % 4 === 0) {
    const pct = ((z + 1) / N * 100).toFixed(0)
    process.stdout.write(`\r[author-mold] voxelizing... ${pct}%`)
  }
}
const t1 = Date.now()
process.stdout.write('\n')
console.log(`[author-mold] voxelized in ${((t1 - t0) / 1000).toFixed(1)}s · ${insideCount} interior voxels`)

// ============================================================
// STEP 6: SDF → MarchingCubes field strength
// ============================================================
//
// THREE.MarchingCubes expects field VALUES that are positive inside the
// surface, with the surface forming where field >= isolation. Our SDF is
// negative inside, positive outside. Convert:
//
//   field = max(0, -sdf * SCALE + 0)
//
// Picking SCALE so that the surface (distance ≈ 0) lands near the
// MarchingCubes isolation threshold for our renderer (we'll set
// isolation in the JSON).

const SCALE = 200          // voxel-distance → field-strength scalar
const ISOLATION = 5         // surface threshold (low because we're using
                            // the actual distance field, not metaballs)
const fieldStrength = new Float32Array(N * N * N)
let contentMinX = N, contentMinY = N, contentMinZ = N
let contentMaxX = -1, contentMaxY = -1, contentMaxZ = -1
for (let z = 0; z < N; z++) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = z * N * N + y * N + x
      const v = Math.max(0, -sdf[i] * SCALE)
      fieldStrength[i] = v
      if (v >= ISOLATION) {
        if (x < contentMinX) contentMinX = x
        if (y < contentMinY) contentMinY = y
        if (z < contentMinZ) contentMinZ = z
        if (x > contentMaxX) contentMaxX = x
        if (y > contentMaxY) contentMaxY = y
        if (z > contentMaxZ) contentMaxZ = z
      }
    }
  }
}

// Content bbox in field [0,1] coords — the renderer uses this to position
// the mesh so its actual content (not the empty parts of the field) sits
// on top of the disc.
const contentBox = (contentMaxY < 0)
  ? null  // empty mold; renderer should fall back
  : {
    min: { x: contentMinX / N, y: contentMinY / N, z: contentMinZ / N },
    max: { x: (contentMaxX + 1) / N, y: (contentMaxY + 1) / N, z: (contentMaxZ + 1) / N },
  }
console.log(`[author-mold] content bbox: ` +
  (contentBox
    ? `(${contentBox.min.x.toFixed(2)}, ${contentBox.min.y.toFixed(2)}, ${contentBox.min.z.toFixed(2)}) → ` +
      `(${contentBox.max.x.toFixed(2)}, ${contentBox.max.y.toFixed(2)}, ${contentBox.max.z.toFixed(2)})`
    : '(empty — voxelization failed)'))

// ============================================================
// STEP 7: write the mold descriptor JSON
// ============================================================
//
// The JSON contains:
//   - moldId, archetype, source provenance
//   - resolution
//   - isolation + scale conventions
//   - the field strength array, base64-encoded for compactness
//
// The client mold-evaluator decodes the array, writes each cell into
// MarchingCubes via setCell(), then calls update().

const fieldBytes = Buffer.from(fieldStrength.buffer)
const fieldBase64 = fieldBytes.toString('base64')

const descriptor = {
  moldId,
  archetype: 'humanoid',
  source: {
    file: basename(inputPath),
    sha256: undefined,  // future: hash the input STL for provenance
    license: 'CC-BY-NC: derived from input STL — do not use commercially',
  },
  authoredAt: new Date().toISOString(),

  resolution: N,
  isolation: ISOLATION,
  fieldEncoding: 'float32-base64',
  fieldStrength: fieldBase64,
  contentBox,

  /* Equipment slot addresses — for now, populated with humanoid defaults.
     A real authoring pass would read these from a side-input or detect
     them via mesh feature points. Phase-0 stub: anatomical landmarks
     positioned by humanoid convention. */
  equipmentSlotAddresses: {
    head:        { x: 0.5,  y: 0.92, z: 0.5  },
    torso:       { x: 0.5,  y: 0.66, z: 0.5  },
    shoulders:   { x: 0.5,  y: 0.78, z: 0.5  },
    waist:       { x: 0.5,  y: 0.48, z: 0.5  },
    legs:        { x: 0.5,  y: 0.32, z: 0.5  },
    feet:        { x: 0.5,  y: 0.05, z: 0.5  },
    main_hand:   { x: 0.74, y: 0.32, z: 0.5  },
    off_hand:    { x: 0.26, y: 0.32, z: 0.5  },
    back:        { x: 0.5,  y: 0.66, z: 0.42 },
  },

  footprintTiles: 1,

  notes:
    'Voxelized SDF mold. Strength = -sdf * ' + SCALE + ' (clamped to 0). ' +
    'Surface at field >= ' + ISOLATION + '. Generated by scripts/author-mold.ts.',
}

const outDir = resolve(process.cwd(), 'public/molds')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, `${moldId}.json`)
writeFileSync(outPath, JSON.stringify(descriptor, null, 2))

const sizeKb = (Buffer.byteLength(JSON.stringify(descriptor)) / 1024).toFixed(1)
console.log(`✓ wrote ${outPath}`)
console.log(`  ${sizeKb} KB JSON · ${fieldBase64.length} base64 chars · field=${N}^3`)
