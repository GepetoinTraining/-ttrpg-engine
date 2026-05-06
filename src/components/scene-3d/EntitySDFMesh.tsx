'use client'

/**
 * ENTITY SDF MESH — Marching-cubes mesh from a metaball SDF composition
 * =======================================================================
 *
 * This is the SDF/cast pipeline from `docs/renderer-pipeline-client.md`
 * Layers 1, 4 — proven in miniature:
 *
 *   disc tensor → decode → mold params → SDF metaball composition
 *                       → marching cubes (resolution N) → triangle mesh
 *                       → render with plastic shader
 *
 * The "mold" here is a small CSG-like composition of metaballs (head,
 * torso, arms, legs). Each metaball position + strength is parameterized
 * by the disc's size + build values. Same disc → same metaball field →
 * same marching-cubes output → same mesh. Bit-identical across clients.
 *
 * Why metaballs?
 *   - They blend smoothly, producing a cohesive plastic-mini look
 *   - Three.js MarchingCubes ships with metaball + plane support
 *   - Server can author a mold as `addBall(...)` calls; client re-evaluates
 *   - Resolution scales with attention (16³ → 32³ → 64³ → 128³)
 *
 * In production, the "mold" is a published catalog entry the server
 * authored once and the client cached. Here we hardcode the goblin mold
 * inline to validate the pipeline shape.
 */

import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import type { DiscTensor } from '../../lib/disc/disc-codec'
import { decodeEntity } from '../../lib/mold/goblin-mold'
import { BuildIdx, PoseFamily } from '../../lib/disc/disc-spec'
import { WedgeDisc } from './WedgeDisc'

interface EntitySDFMeshProps {
  tensor: DiscTensor
  position?: [number, number, number]
  /** Marching cubes resolution (16/24/32/48/64). Higher = smoother + slower */
  resolution?: number
  showDiscDebug?: boolean
}

export function EntitySDFMesh({
  tensor,
  position = [0, 0, 0],
  resolution = 32,
  showDiscDebug = false,
}: EntitySDFMeshProps): React.ReactElement {
  const entity = useMemo(() => decodeEntity(tensor), [tensor])

  // Skin-toned material — the metaball blob is one body, painted by skin palette
  const material = useMemo(() => {
    const skinColor = new THREE.Color(
      entity.paletteSkin.r / 255,
      entity.paletteSkin.g / 255,
      entity.paletteSkin.b / 255,
    )
    return new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.65,
      metalness: 0.0,
      flatShading: false,
    })
  }, [entity.paletteSkin.r, entity.paletteSkin.g, entity.paletteSkin.b])

  // Build the marching cubes mesh once per (resolution, material)
  const marchingCubes = useMemo(() => {
    const mc = new MarchingCubes(resolution, material, true, false, 100000)
    mc.castShadow = true
    mc.receiveShadow = true
    return mc
  }, [resolution, material])

  // Compose the goblin's metaball field whenever the disc changes
  useEffect(() => {
    composeGoblinField(marchingCubes, entity)
  }, [marchingCubes, entity])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      marchingCubes.geometry?.dispose()
      material.dispose()
    }
  }, [marchingCubes, material])

  // The MarchingCubes mesh sits in [-1, +1] space. Scale up so the goblin
  // is roughly 1.5 world units tall, matching the primitive renderer.
  const worldScale = 1.5

  // Pose tilt (same logic as primitive renderer for visual parity)
  const tilt = entity.poseFamily === PoseFamily.Combat   ? 0.18
              : entity.poseFamily === PoseFamily.Sneaking ? 0.36
              : entity.poseFamily === PoseFamily.Dead     ? 1.45
              : 0

  // Weapon as a separate primitive (the SDF body is just flesh; weapon is metal)
  const weapon = entity.equipment.mainHand !== 0 ? (
    <mesh
      position={[0.45, 0.95, 0.15]}
      rotation={[0, 0, -0.3]}
      castShadow
    >
      <boxGeometry args={[0.04, 0.6, 0.02]} />
      <meshStandardMaterial color="#c8d4e0" roughness={0.4} metalness={0.7} flatShading />
    </mesh>
  ) : null

  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      <primitive
        object={marchingCubes}
        scale={[worldScale, worldScale, worldScale]}
        position={[0, worldScale * 0.5, 0]}
      />
      {weapon}
      <WedgeDisc tensor={tensor} showDebug={showDiscDebug} />
    </group>
  )
}

// ============================================================
// THE GOBLIN MOLD — metaball composition over [0,1]^3 field
// ============================================================
//
// This is the "mold" — a function from disc params to a metaball list.
// In production each archetype is one mold authored once, then served
// from the catalog. Here we inline the goblin mold to validate the pipeline.

function composeGoblinField(
  mc: MarchingCubes,
  entity: ReturnType<typeof decodeEntity>,
): void {
  // Reset the implicit field
  mc.reset()
  mc.isolation = 80   // surface threshold; lower = thicker blob, higher = thinner

  // Parameters from the disc
  const sizeScale = 0.8 + (entity.size * 0.06)            // size index drives overall scale
  const girth = entity.build === BuildIdx.Slim    ? 0.85
              : entity.build === BuildIdx.Stout   ? 1.20
              : entity.build === BuildIdx.Hulking ? 1.45
              : 1.00

  // Metaball positions in [0,1]^3 field space.
  // x=0.5 is left-right centered. y=0..1 is bottom→top. z=0.5 is depth-centered.
  // strength = blob radius/intensity. subtract = falloff sharpness (12 is default-ish).
  const SUB = 12
  const s = sizeScale

  // ── Head — sphere blob above torso
  mc.addBall(0.5, 0.86, 0.5, 0.16 * s, SUB)

  // ── Neck — small connector
  mc.addBall(0.5, 0.74, 0.5, 0.08 * s, SUB)

  // ── Torso — primary mass, slightly elongated by girth
  mc.addBall(0.5, 0.60, 0.5, 0.22 * s * girth, SUB)
  mc.addBall(0.5, 0.50, 0.5, 0.20 * s * girth, SUB)

  // ── Pelvis
  mc.addBall(0.5, 0.40, 0.5, 0.16 * s * girth, SUB)

  // ── Shoulders — out from torso
  mc.addBall(0.5 - 0.16 * girth, 0.65, 0.5, 0.10 * s, SUB)
  mc.addBall(0.5 + 0.16 * girth, 0.65, 0.5, 0.10 * s, SUB)

  // ── Upper arms
  mc.addBall(0.5 - 0.20 * girth, 0.55, 0.5, 0.08 * s, SUB)
  mc.addBall(0.5 + 0.20 * girth, 0.55, 0.5, 0.08 * s, SUB)

  // ── Lower arms / hands
  mc.addBall(0.5 - 0.22 * girth, 0.42, 0.5, 0.07 * s, SUB)
  mc.addBall(0.5 + 0.22 * girth, 0.42, 0.5, 0.07 * s, SUB)

  // ── Upper legs
  mc.addBall(0.5 - 0.09, 0.30, 0.5, 0.10 * s, SUB)
  mc.addBall(0.5 + 0.09, 0.30, 0.5, 0.10 * s, SUB)

  // ── Lower legs
  mc.addBall(0.5 - 0.09, 0.18, 0.5, 0.09 * s, SUB)
  mc.addBall(0.5 + 0.09, 0.18, 0.5, 0.09 * s, SUB)

  // ── Feet
  mc.addBall(0.5 - 0.10, 0.08, 0.52, 0.09 * s, SUB)
  mc.addBall(0.5 + 0.10, 0.08, 0.52, 0.09 * s, SUB)

  // Re-evaluate the field → marching cubes → mesh
  mc.update()
}
