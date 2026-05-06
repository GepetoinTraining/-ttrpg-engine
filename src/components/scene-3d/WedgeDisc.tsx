'use client'

/**
 * WEDGE DISC — Hidden 64-wedge geometry that piggybacks the entity tensor
 * ========================================================================
 *
 * Renders a disc of 64 triangles arranged radially around the entity's
 * origin. Each triangle's three vertices share a single RGB vertex color
 * encoding the slot's value (the codec is in ../lib/disc/disc-codec.ts).
 *
 * Visibility: the disc is rendered with `visible={false}` so the player
 * never sees it — it exists purely as data attached to the entity's
 * draw call. (In the real pipeline the disc shares a draw call with the
 * entity's mesh and a stencil/masking shader hides it; for this demo
 * `visible={false}` is sufficient.)
 *
 * The disc geometry is built ONCE per entity and updated only when the
 * tensor changes. Vertex colors are the data; positions are constant.
 */

import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { DiscTensor } from '../../lib/disc/disc-codec'

const NUM_WEDGES = 64
const DISC_RADIUS = 0.05  // tiny, hidden anyway

interface WedgeDiscProps {
  tensor: DiscTensor
  /** Visualize the disc (debug only — defaults to invisible per the spec) */
  showDebug?: boolean
}

export function WedgeDisc({ tensor, showDebug = false }: WedgeDiscProps): React.ReactElement {
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  // Build the static geometry once: 64 triangular wedges, each with 3 vertices
  const geometry = useMemo(() => {
    const positions = new Float32Array(NUM_WEDGES * 3 * 3)
    const colors    = new Float32Array(NUM_WEDGES * 3 * 3)

    for (let i = 0; i < NUM_WEDGES; i++) {
      const a0 = (i     / NUM_WEDGES) * Math.PI * 2
      const a1 = ((i + 1) / NUM_WEDGES) * Math.PI * 2

      // Vertex 0: center
      positions[i * 9 + 0] = 0
      positions[i * 9 + 1] = 0
      positions[i * 9 + 2] = 0
      // Vertex 1: rim at angle a0
      positions[i * 9 + 3] = Math.cos(a0) * DISC_RADIUS
      positions[i * 9 + 4] = 0
      positions[i * 9 + 5] = Math.sin(a0) * DISC_RADIUS
      // Vertex 2: rim at angle a1
      positions[i * 9 + 6] = Math.cos(a1) * DISC_RADIUS
      positions[i * 9 + 7] = 0
      positions[i * 9 + 8] = Math.sin(a1) * DISC_RADIUS
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3))
    return geo
  }, [])

  // Update vertex colors whenever the tensor changes
  useEffect(() => {
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute
    const colors = colorAttr.array as Float32Array

    for (let i = 0; i < NUM_WEDGES; i++) {
      const wedge = tensor[i] ?? { r: 0, g: 0, b: 0 }
      let r = wedge.r / 255
      let g = wedge.g / 255
      let b = wedge.b / 255

      // ── DEBUG-VIZ BRIGHTNESS BOOST ──────────────────────────────────────
      // The encoding is integer-exact (small enum values like LEVEL=2 store
      // as RGB(2,0,0), which is mathematically correct but visually black).
      // For the diagnostic disc-pinwheel only, we normalize each non-empty
      // wedge so its brightest channel hits ~1.0 — making "what data lives
      // in slot N?" visually obvious. The actual tensor bytes are untouched.
      if (showDebug) {
        const peak = Math.max(r, g, b)
        if (peak > 0 && peak < 0.95) {
          const boost = 0.95 / peak
          r = Math.min(1, r * boost)
          g = Math.min(1, g * boost)
          b = Math.min(1, b * boost)
        }
      }

      // Same color on all 3 vertices of the wedge
      for (let v = 0; v < 3; v++) {
        colors[i * 9 + v * 3 + 0] = r
        colors[i * 9 + v * 3 + 1] = g
        colors[i * 9 + v * 3 + 2] = b
      }
    }
    colorAttr.needsUpdate = true
  }, [tensor, geometry, showDebug])

  return (
    <mesh
      ref={geometryRef as never}
      geometry={geometry}
      visible={showDebug}
      // The disc sits flat at y=0; if showDebug it floats above the entity
      position={showDebug ? [0, 2.5, 0] : [0, 0, 0]}
      scale={showDebug ? 30 : 1}
    >
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  )
}
