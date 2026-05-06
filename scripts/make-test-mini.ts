/**
 * Test mini generator
 * ====================
 *
 * Builds a simple humanoid mesh from Three.js primitives and writes it
 * to assets/ as a binary STL. Use this to validate the author-mold
 * pipeline without needing a real MZ4250 STL on disk.
 *
 * Usage:
 *   npx tsx scripts/make-test-mini.ts [outName]
 *   → writes assets/<outName>.stl  (default: test-humanoid.stl)
 *
 * Swap the input to author-mold.ts when an actual MZ4250 STL is dropped
 * into assets/.
 */

import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const outName = process.argv[2] ?? 'test-humanoid'

// Compose a humanoid out of primitives — simplistic but recognizable.
// Pose: standing, arms relaxed at sides, facing +Z.
function buildHumanoid(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  function add(geo: THREE.BufferGeometry, x: number, y: number, z: number) {
    geo.translate(x, y, z)
    parts.push(geo)
  }

  // Coordinates: y=0 at feet, y=1.0 at top of head (a Medium 5e creature)
  add(new THREE.SphereGeometry(0.10, 16, 12),                  0,    0.92, 0)        // head
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12),        0,    0.83, 0)        // neck
  add(new THREE.BoxGeometry(0.30, 0.32, 0.18),                 0,    0.66, 0)        // torso
  add(new THREE.BoxGeometry(0.20, 0.10, 0.15),                 0,    0.48, 0)        // pelvis

  // Arms (cylinders)
  add(new THREE.CylinderGeometry(0.05, 0.04, 0.30, 10),       -0.20, 0.62, 0)        // upper arm L
  add(new THREE.CylinderGeometry(0.05, 0.04, 0.30, 10),        0.20, 0.62, 0)        // upper arm R
  add(new THREE.CylinderGeometry(0.04, 0.035, 0.25, 10),      -0.22, 0.36, 0)        // forearm L
  add(new THREE.CylinderGeometry(0.04, 0.035, 0.25, 10),       0.22, 0.36, 0)        // forearm R
  add(new THREE.SphereGeometry(0.05, 10, 8),                  -0.22, 0.22, 0)        // hand L
  add(new THREE.SphereGeometry(0.05, 10, 8),                   0.22, 0.22, 0)        // hand R

  // Legs
  add(new THREE.CylinderGeometry(0.06, 0.05, 0.30, 10),       -0.08, 0.32, 0)        // thigh L
  add(new THREE.CylinderGeometry(0.06, 0.05, 0.30, 10),        0.08, 0.32, 0)        // thigh R
  add(new THREE.CylinderGeometry(0.05, 0.045, 0.25, 10),      -0.08, 0.10, 0)        // shin L
  add(new THREE.CylinderGeometry(0.05, 0.045, 0.25, 10),       0.08, 0.10, 0)        // shin R
  add(new THREE.BoxGeometry(0.10, 0.04, 0.15),                -0.08, 0,    0.025)    // foot L
  add(new THREE.BoxGeometry(0.10, 0.04, 0.15),                 0.08, 0,    0.025)    // foot R

  return mergeGeometries(parts) ?? parts[0]
}

const geometry = buildHumanoid()
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())

const exporter = new STLExporter()
const stlBinary = exporter.parse(mesh, { binary: true }) as DataView

const outDir = resolve(process.cwd(), 'assets')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, `${outName}.stl`)

// STLExporter binary returns DataView; write its underlying buffer
const buf = Buffer.from(stlBinary.buffer, stlBinary.byteOffset, stlBinary.byteLength)
writeFileSync(outPath, buf)

const triangleCount = (stlBinary.byteLength - 84) / 50  // STL binary: 84-byte header + 50 bytes/triangle
console.log(`✓ wrote ${outPath}`)
console.log(`  ${triangleCount} triangles · ${stlBinary.byteLength} bytes`)
