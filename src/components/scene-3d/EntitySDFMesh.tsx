'use client'

/**
 * ENTITY SDF MESH — Marching-cubes mesh from a metaball SDF composition
 * =======================================================================
 *
 * (Phase-0 stub of the full pipeline — composes hand-coded metaballs from
 * disc params and marches them via Three.js's MarchingCubes addon. Will be
 * replaced by mold descriptors authored server-side from MZ4250 STLs.)
 *
 * The mini's BASE (visible WedgeDisc) sits on the floor; the marched body
 * sits above it. Sizing is metric: tileSize × CREATURE_VISUAL_SCALE[size].
 */

import { useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import type { DiscTensor } from '../../lib/disc/disc-codec'
import { decodeEntity } from '../../lib/mold/goblin-mold'
import {
  BuildIdx,
  PoseFamily,
  CREATURE_VISUAL_SCALE,
  CREATURE_FOOTPRINT,
  KIND_TINT,
  snapOffsetForFootprint,
} from '../../lib/disc/disc-spec'
import { WedgeDisc, baseTopY } from './WedgeDisc'
import type { ThreeEvent } from '@react-three/fiber'
import {
  loadMold, applyMoldToMarchingCubes,
  type MoldDescriptor,
} from '../../lib/catalog/mold-evaluator'

interface EntitySDFMeshProps {
  tensor: DiscTensor
  position?: [number, number, number]
  /** Marching-cubes resolution (16/24/32/48/64). Higher = smoother + slower */
  resolution?: number
  /** Size of one tile in scene units — sets the metric */
  tileSize?: number
  /** 0 = masked base (player view), 1 = revealed wedges (debug) */
  discReveal?: number
  /** Click on the mini base — for grid pick events */
  onBaseClick?: (event: ThreeEvent<MouseEvent>) => void
  /**
   * Optional baked mold descriptor (loaded from /molds/<id>.json).
   * When provided, the marching-cubes field is populated from the
   * descriptor's voxel SDF instead of the hardcoded composeGoblinField.
   * Resolution is overridden to match the descriptor.
   */
  moldId?: string
}

export function EntitySDFMesh({
  tensor,
  position = [0, 0, 0],
  resolution = 32,
  tileSize = 1,
  discReveal = 0,
  onBaseClick,
  moldId,
}: EntitySDFMeshProps): React.ReactElement {
  const entity = useMemo(() => decodeEntity(tensor), [tensor])

  const scale = tileSize * (CREATURE_VISUAL_SCALE[entity.size] ?? 1.0)
  const footprint = CREATURE_FOOTPRINT[entity.size] ?? 1
  const tint = KIND_TINT[entity.kind] ?? KIND_TINT[0]

  // Grid-snap by footprint (even = corner of 4 tiles, odd = tile center)
  const snap = snapOffsetForFootprint(footprint, tileSize)
  const snapped: [number, number, number] = [
    position[0] + snap, position[1], position[2] + snap,
  ]

  // ── Optional baked mold descriptor (overrides hand-coded metaball mold) ──
  const [mold, setMold] = useState<MoldDescriptor | null>(null)
  useEffect(() => {
    if (!moldId) { setMold(null); return }
    let cancelled = false
    loadMold(moldId)
      .then(d => { if (!cancelled) setMold(d) })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.warn('[EntitySDFMesh] failed to load mold', moldId, err)
      })
    return () => { cancelled = true }
  }, [moldId])

  // If a mold loaded, use ITS resolution (must match for setCell to address right)
  const effectiveResolution = mold?.resolution ?? resolution

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

  const marchingCubes = useMemo(() => {
    const mc = new MarchingCubes(effectiveResolution, material, true, false, 100000)
    mc.castShadow = true
    mc.receiveShadow = true
    return mc
  }, [effectiveResolution, material])

  // Field population — either from baked mold or from the hardcoded humanoid stub
  useEffect(() => {
    if (mold) {
      applyMoldToMarchingCubes(marchingCubes, mold)
    } else {
      composeGoblinField(marchingCubes, entity)
    }
  }, [marchingCubes, entity, mold])

  useEffect(() => {
    return () => {
      marchingCubes.geometry?.dispose()
      material.dispose()
    }
  }, [marchingCubes, material])

  // Pose tilt only on the body
  const tilt = entity.poseFamily === PoseFamily.Combat   ? 0.18
              : entity.poseFamily === PoseFamily.Sneaking ? 0.36
              : entity.poseFamily === PoseFamily.Dead     ? 1.45
              : 0

  const bodyY = baseTopY(tileSize)

  // For the baked-mold path, position the MC primitive so the bottom of
  // *actual content* sits at the body group's origin — not the bottom of
  // the field, which may be empty if the mold's content doesn't reach all
  // the way down. Field y = 0 → MC local y = -1; field y = contentMinY →
  // MC local y = 2*contentMinY - 1. We want that local-y at the body's y=0:
  //   primitive.position.y = scale - (2 * contentMinY - 1) * scale
  //                        = scale * (2 - 2 * contentMinY)
  //                        = scale * 2 * (1 - contentMinY)
  // For the hardcoded-metaball path (no contentBox), use the original
  // assumption (content fills the field, feet at field y≈0).
  const contentMinY = mold?.contentBox?.min.y ?? 0
  const mcOffsetY = scale * 2 * (1 - contentMinY) - scale  // = scale * (1 - 2*contentMinY)

  // Weapon as a separate primitive (the SDF body is just flesh; weapon is metal)
  const weapon = entity.equipment.mainHand !== 0 ? (
    <mesh
      position={[0.45 * scale, 0.95 * scale, 0.15 * scale]}
      rotation={[0, 0, -0.3]}
      castShadow
    >
      <boxGeometry args={[0.04 * scale, 0.6 * scale, 0.02 * scale]} />
      <meshStandardMaterial color="#c8d4e0" roughness={0.4} metalness={0.7} flatShading />
    </mesh>
  ) : null

  return (
    <group position={snapped}>
      {/* Mini base — 3D thin cylinder + codec stamp underneath */}
      <WedgeDisc
        tensor={tensor}
        footprintTiles={footprint}
        tileSize={tileSize}
        tint={tint}
        reveal={discReveal}
        onClick={onBaseClick}
      />
      {/* Body — tilts with pose; sits at top of the base cylinder. */}
      <group position={[0, bodyY, 0]} rotation={[tilt, 0, 0]}>
        <primitive
          object={marchingCubes}
          scale={[scale, scale, scale]}
          position={[0, mcOffsetY, 0]}
        />
        {weapon}
      </group>
    </group>
  )
}

// ============================================================
// THE GOBLIN MOLD — metaball composition over [0,1]^3 field
// (Phase-0 stub — replaced by published mold descriptors from MZ4250 catalog)
// ============================================================

function composeGoblinField(
  mc: MarchingCubes,
  entity: ReturnType<typeof decodeEntity>,
): void {
  mc.reset()
  // Default isolation: surfaces form at field >= 80, which means strength
  // ~0.4 per ball gives a small distinct sphere, and merging only happens
  // where balls overlap closely. This is the "Three.js example" calibration.
  mc.isolation = 80

  const girth = entity.build === BuildIdx.Slim    ? 0.85
              : entity.build === BuildIdx.Stout   ? 1.20
              : entity.build === BuildIdx.Hulking ? 1.45
              : 1.00

  const SUB = 12  // falloff sharpness

  // ── Head + neck — head is a clear ball; neck is a small weaker ball
  // close enough to merge with the top of the torso below
  mc.addBall(0.5, 0.85, 0.5, 0.55, SUB)
  mc.addBall(0.5, 0.73, 0.5, 0.30, SUB)

  // ── Torso — single tall mass; one main ball + one small sub-ball below
  mc.addBall(0.5, 0.62, 0.5, 0.75 * girth, SUB)
  mc.addBall(0.5, 0.50, 0.5, 0.65 * girth, SUB)

  // ── Pelvis — narrower than torso, where legs branch
  mc.addBall(0.5, 0.40, 0.5, 0.45 * girth, SUB)

  // ── ARMS — pulled OUT further (0.24 vs 0.13) so the limb is distinct
  // from the torso. Strengths kept low so each arm is a thin tube.
  // Shoulder ball overlaps torso just enough to attach; the rest of the
  // arm extends outward + downward without re-merging.
  mc.addBall(0.5 - 0.16 * girth, 0.62, 0.5, 0.30, SUB)  // shoulder L
  mc.addBall(0.5 + 0.16 * girth, 0.62, 0.5, 0.30, SUB)  // shoulder R
  mc.addBall(0.5 - 0.24 * girth, 0.52, 0.5, 0.25, SUB)  // upper arm L
  mc.addBall(0.5 + 0.24 * girth, 0.52, 0.5, 0.25, SUB)  // upper arm R
  mc.addBall(0.5 - 0.28 * girth, 0.40, 0.5, 0.22, SUB)  // forearm L
  mc.addBall(0.5 + 0.28 * girth, 0.40, 0.5, 0.22, SUB)  // forearm R
  mc.addBall(0.5 - 0.30 * girth, 0.30, 0.5, 0.20, SUB)  // hand L
  mc.addBall(0.5 + 0.30 * girth, 0.30, 0.5, 0.20, SUB)  // hand R

  // ── LEGS — pulled apart enough to be two distinct columns
  mc.addBall(0.5 - 0.10, 0.32, 0.5, 0.32, SUB)  // hip L
  mc.addBall(0.5 + 0.10, 0.32, 0.5, 0.32, SUB)  // hip R
  mc.addBall(0.5 - 0.10, 0.22, 0.5, 0.28, SUB)  // thigh L
  mc.addBall(0.5 + 0.10, 0.22, 0.5, 0.28, SUB)  // thigh R
  mc.addBall(0.5 - 0.10, 0.12, 0.5, 0.25, SUB)  // shin L
  mc.addBall(0.5 + 0.10, 0.12, 0.5, 0.25, SUB)  // shin R

  // ── Feet — slightly forward of shins (z=0.53), low (y=0.05)
  mc.addBall(0.5 - 0.11, 0.05, 0.54, 0.25, SUB)
  mc.addBall(0.5 + 0.11, 0.05, 0.54, 0.25, SUB)

  mc.update()
}
