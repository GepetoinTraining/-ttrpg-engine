'use client'

/**
 * ENTITY MESH — Renders a humanoid mold (decoded from a disc tensor)
 * ====================================================================
 *
 * Reads disc tensor → decodes entity → composes mold pieces → renders each
 * as a Three.js primitive. The mini's BASE (visible WedgeDisc) sits on the
 * floor; the body parts sit above it inside a tilt-rotation group so pose
 * adjustments don't tip the base.
 *
 * Sizing is metric: scale = tileSize × CREATURE_VISUAL_SCALE[entity.size].
 * Change tileSize and everything (creature, weapon, base) scales coherently.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import type { DiscTensor } from '../../lib/disc/disc-codec'
import {
  PoseFamily,
  CREATURE_VISUAL_SCALE,
  CREATURE_FOOTPRINT,
  KIND_TINT,
  snapOffsetForFootprint,
} from '../../lib/disc/disc-spec'
import { decodeEntity, composeMold, type MoldPiece } from '../../lib/mold/goblin-mold'
import { WedgeDisc, baseTopY } from './WedgeDisc'
import type { ThreeEvent } from '@react-three/fiber'

interface EntityMeshProps {
  tensor: DiscTensor
  position?: [number, number, number]
  /** Size of one tile in scene units — sets the metric */
  tileSize?: number
  /** 0 = fully masked base (player view), 1 = revealed wedges (debug) */
  discReveal?: number
  /** Click on the mini base — for grid pick events */
  onBaseClick?: (event: ThreeEvent<MouseEvent>) => void
}

export function EntityMesh({
  tensor,
  position = [0, 0, 0],
  tileSize = 1,
  discReveal = 0,
  onBaseClick,
}: EntityMeshProps): React.ReactElement {
  const { entity, pieces } = useMemo(() => {
    const entity = decodeEntity(tensor)
    const pieces = composeMold(entity)
    return { entity, pieces }
  }, [tensor])

  // Metric scale — composeMold currently produces pieces in [-0.5..1.6] units;
  // we treat that as "Medium-creature reference" and scale by the size factor.
  // Final world scale = tileSize × CREATURE_VISUAL_SCALE[size]
  const scale = tileSize * (CREATURE_VISUAL_SCALE[entity.size] ?? 1.0)
  const footprint = CREATURE_FOOTPRINT[entity.size] ?? 1
  const tint = KIND_TINT[entity.kind] ?? KIND_TINT[0]

  // Grid-snap: even footprints anchor on the 4-tile shared corner;
  // odd footprints anchor on a tile center. Applied to the entity position.
  const snap = snapOffsetForFootprint(footprint, tileSize)
  const snapped: [number, number, number] = [
    position[0] + snap, position[1], position[2] + snap,
  ]

  // Pose tilt only applies to the body, NOT the base
  const tilt = entity.poseFamily === PoseFamily.Combat   ? 0.18
              : entity.poseFamily === PoseFamily.Sneaking ? 0.36
              : entity.poseFamily === PoseFamily.Dead     ? 1.45
              : 0

  const bodyY = baseTopY(tileSize)  // mini stands on top of the cylinder

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
      {/* Body — tilts with pose; sits at top of the base cylinder */}
      <group position={[0, bodyY, 0]} rotation={[tilt, 0, 0]} scale={[scale, scale, scale]}>
        {pieces.map((piece, i) => (
          <PieceMesh key={`${piece.name}-${i}`} piece={piece} />
        ))}
      </group>
    </group>
  )
}

// ============================================================
// PIECE MESH — One primitive per body part
// ============================================================

function PieceMesh({ piece }: { piece: MoldPiece }): React.ReactElement {
  const color = useMemo(
    () => new THREE.Color(piece.color.r / 255, piece.color.g / 255, piece.color.b / 255),
    [piece.color.r, piece.color.g, piece.color.b]
  )

  const isMetal = piece.material === 'metal'
  const isCloth = piece.material === 'cloth' || piece.material === 'leather'

  const material = (
    <meshStandardMaterial
      color={color}
      roughness={isMetal ? 0.35 : isCloth ? 0.85 : 0.6}
      metalness={isMetal ? 0.7 : 0.0}
      flatShading
    />
  )

  switch (piece.shape) {
    case 'sphere':
      return (
        <mesh position={piece.position} castShadow receiveShadow>
          <sphereGeometry args={[piece.size[0], 16, 12]} />
          {material}
        </mesh>
      )
    case 'box':
      return (
        <mesh position={piece.position} castShadow receiveShadow>
          <boxGeometry args={[piece.size[0], piece.size[1], piece.size[2]]} />
          {material}
        </mesh>
      )
    case 'cylinder':
      return (
        <mesh position={piece.position} castShadow receiveShadow>
          <cylinderGeometry args={[piece.size[0], piece.size[0], piece.size[1], 12]} />
          {material}
        </mesh>
      )
    case 'cone':
      return (
        <mesh position={piece.position} castShadow receiveShadow>
          <coneGeometry args={[piece.size[0], piece.size[1], 12]} />
          {material}
        </mesh>
      )
  }
}
