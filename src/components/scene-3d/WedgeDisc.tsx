'use client'

/**
 * WEDGE DISC — The mini's BASE as a true 3D thin cylinder
 * =========================================================
 *
 * Two stacked pieces, both real 3D geometry:
 *
 *   ┌─────────────────┐  ← top face of cylinder (visible to player)
 *   │   CYLINDER      │  ← receives the type-tint masking material
 *   │   (thin, ~5%    │     also picks up clicks/hovers for grid collision
 *   │    of tileSize) │
 *   └─────────────────┘
 *   ┌─────────────────┐  ← stamp at floor level
 *   │  64-WEDGE STAMP │  ← vertex colors = codec data (the entity's 192 bytes)
 *   └─────────────────┘
 *   ▼ floor tile beneath
 *
 * The cylinder normally hides the stamp from view (player sees a clean
 * tinted base). The reveal slider fades the cylinder's opacity so the
 * stamp's wedge colors emerge — like wiping paint off a stamped disc to
 * read what was printed underneath.
 *
 * The 3D mini sits ON TOP of the cylinder: body's y starts at thickness,
 * not at floor level. Pose tilt rotates only the body group, not the base.
 */

import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { DiscTensor } from '../../lib/disc/disc-codec'

const NUM_WEDGES = 64
const BASE_THICKNESS_FRAC = 0.05   // 5% of tileSize — feels like a real mini base

interface WedgeDiscProps {
  tensor: DiscTensor
  /** Footprint side count in tile units (1 = 1×1, 2 = 2×2, etc.) */
  footprintTiles: number
  /** Edge length of one tile in scene units (sets the metric) */
  tileSize: number
  /** Tint to mask the disc with (RGB 0..1). Usually KIND_TINT[entity.kind]. */
  tint: [number, number, number]
  /** 0 = cylinder opaque (player view), 1 = cylinder hidden, stamp visible */
  reveal?: number
  /** Click on the cylinder (the mini's footprint) — for grid pick events */
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  /** Hover on the cylinder — for grid hover events */
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
}

export function WedgeDisc({
  tensor, footprintTiles, tileSize, tint,
  reveal = 0,
  onClick, onPointerOver, onPointerOut,
}: WedgeDiscProps): React.ReactElement {
  const radius = (footprintTiles * tileSize) * 0.45
  const thickness = tileSize * BASE_THICKNESS_FRAC

  // ── Stamp geometry: 64 flat wedges in xz plane, vertex-colored ────────
  const stampGeometry = useMemo(() => {
    const positions = new Float32Array(NUM_WEDGES * 3 * 3)
    const colors    = new Float32Array(NUM_WEDGES * 3 * 3)

    for (let i = 0; i < NUM_WEDGES; i++) {
      const a0 = (i       / NUM_WEDGES) * Math.PI * 2
      const a1 = ((i + 1) / NUM_WEDGES) * Math.PI * 2

      positions[i * 9 + 0] = 0
      positions[i * 9 + 1] = 0
      positions[i * 9 + 2] = 0
      positions[i * 9 + 3] = Math.cos(a0)
      positions[i * 9 + 4] = 0
      positions[i * 9 + 5] = Math.sin(a0)
      positions[i * 9 + 6] = Math.cos(a1)
      positions[i * 9 + 7] = 0
      positions[i * 9 + 8] = Math.sin(a1)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3))
    return geo
  }, [])

  // ── Update stamp colors when tensor changes ──────────────────────────
  useEffect(() => {
    const colorAttr = stampGeometry.getAttribute('color') as THREE.BufferAttribute
    const colors = colorAttr.array as Float32Array

    for (let i = 0; i < NUM_WEDGES; i++) {
      const wedge = tensor[i] ?? { r: 0, g: 0, b: 0 }
      let r = wedge.r / 255
      let g = wedge.g / 255
      let b = wedge.b / 255

      // Per-wedge brightness boost so small enum values become visible
      // when the cylinder is removed (debug view). Encoding is unchanged.
      const peak = Math.max(r, g, b)
      if (peak > 0 && peak < 0.95) {
        const boost = Math.min(0.95 / Math.max(peak, 0.05), 8.0)
        r = Math.min(1, r * boost)
        g = Math.min(1, g * boost)
        b = Math.min(1, b * boost)
      }
      for (let v = 0; v < 3; v++) {
        colors[i * 9 + v * 3 + 0] = r
        colors[i * 9 + v * 3 + 1] = g
        colors[i * 9 + v * 3 + 2] = b
      }
    }
    colorAttr.needsUpdate = true
  }, [tensor, stampGeometry])

  // Cleanup
  useEffect(() => () => { stampGeometry.dispose() }, [stampGeometry])

  // Cylinder visibility/opacity from reveal
  const cylinderOpacity = 1 - reveal
  const cylinderVisible = cylinderOpacity > 0.01

  const tintColor = useMemo(
    () => new THREE.Color(tint[0], tint[1], tint[2]),
    [tint[0], tint[1], tint[2]]
  )

  return (
    <group>
      {/* ── Stamp at floor level (the codec, vertex-colored) ──────── */}
      <mesh
        geometry={stampGeometry}
        position={[0, 0.001, 0]}      // tiny y-offset above floor
        scale={[radius, 1, radius]}
        receiveShadow
      >
        <meshBasicMaterial
          vertexColors
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* ── Cylinder above stamp (the mini base — pickable, masking) ─ */}
      {cylinderVisible && (
        <mesh
          position={[0, thickness / 2 + 0.002, 0]}
          castShadow
          receiveShadow
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <cylinderGeometry args={[radius, radius, thickness, NUM_WEDGES]} />
          <meshStandardMaterial
            color={tintColor}
            roughness={0.55}
            metalness={0.0}
            transparent={reveal > 0}
            opacity={cylinderOpacity}
          />
        </mesh>
      )}
    </group>
  )
}

/** Public — height of the mini base, in scene units. Body must sit at this y. */
export function baseTopY(tileSize: number): number {
  return tileSize * BASE_THICKNESS_FRAC + 0.002
}
