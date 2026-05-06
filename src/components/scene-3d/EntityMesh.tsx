'use client'

/**
 * ENTITY MESH — Renders a humanoid mold (decoded from a disc tensor)
 * ====================================================================
 *
 * Reads the disc tensor → decodes the entity → composes the mold pieces →
 * renders each piece as a Three.js primitive (sphere/box/cylinder/cone).
 * Wraps everything in a group so pose tilt + position can be applied at
 * the entity level.
 *
 * The hidden WedgeDisc rides along, so the entity's data is part of its
 * own draw call (the architectural piggyback).
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import type { DiscTensor } from '../../lib/disc/disc-codec'
import { PoseFamily } from '../../lib/disc/disc-spec'
import { decodeEntity, composeMold, type MoldPiece } from '../../lib/mold/goblin-mold'
import { WedgeDisc } from './WedgeDisc'

interface EntityMeshProps {
  tensor: DiscTensor
  position?: [number, number, number]
  /** If true, the wedge disc is visible above the entity for inspection */
  showDiscDebug?: boolean
}

export function EntityMesh({
  tensor,
  position = [0, 0, 0],
  showDiscDebug = false,
}: EntityMeshProps): React.ReactElement {
  // Decode + compose are pure functions — memoize on the tensor identity
  const { entity, pieces } = useMemo(() => {
    const entity = decodeEntity(tensor)
    const pieces = composeMold(entity)
    return { entity, pieces }
  }, [tensor])

  // Pose tilt — applied at the group level
  const tilt = entity.poseFamily === PoseFamily.Combat   ? 0.18
              : entity.poseFamily === PoseFamily.Sneaking ? 0.36
              : entity.poseFamily === PoseFamily.Dead     ? 1.45
              : 0

  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      {pieces.map((piece, i) => (
        <PieceMesh key={`${piece.name}-${i}`} piece={piece} />
      ))}
      {/* Hidden 64-wedge disc carrying the tensor as vertex colors */}
      <WedgeDisc tensor={tensor} showDebug={showDiscDebug} />
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

  // Material settings drive a "plastic-mini" look:
  // - Phong-like with low specular (matte)
  // - Slight metalness if material === 'metal'
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
