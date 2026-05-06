'use client'

/**
 * SKELETON VIEWER — Blender-armature-style wireframe rendering
 * ==================================================================
 *
 * Renders a `Skeleton` as a stick figure in 3D:
 *   - each node as a colored line from head → tail (the bone)
 *   - each joint as a small sphere (where two nodes meet)
 *   - root joint marked in a different color so the pivot is obvious
 *
 * No fleshing, no voxels — just the wire. The skeleton is the primitive
 * every creature inherits from; the visualization here is what an animator
 * would pose.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import {
  getSkeletonEdges,
  type Skeleton,
} from '../../../engine/glyphs/skeleton'

interface SkeletonViewerProps {
  skeleton: Skeleton
  position?: [number, number, number]
  /** Bone (node) line color. */
  boneColor?: string
  /** Generic joint color. */
  jointColor?: string
  /** Root pivot color (highlighted). */
  rootColor?: string
  /** Joint sphere radius in world units. */
  jointRadius?: number
}

export function SkeletonViewer({
  skeleton,
  position = [0, 0, 0],
  boneColor = '#ffaa44',
  jointColor = '#ff5500',
  rootColor = '#44aaff',
  jointRadius = 0.025,
}: SkeletonViewerProps): React.ReactElement {
  // One BufferGeometry holds all bone-line vertices in a single draw call.
  const linesGeometry = useMemo(() => {
    const positions = new Float32Array(skeleton.nodes.length * 6)
    skeleton.nodes.forEach((n, i) => {
      positions[i * 6 + 0] = n.head[0]
      positions[i * 6 + 1] = n.head[1]
      positions[i * 6 + 2] = n.head[2]
      positions[i * 6 + 3] = n.tail[0]
      positions[i * 6 + 4] = n.tail[1]
      positions[i * 6 + 5] = n.tail[2]
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [skeleton])

  // Joint positions: every unique head/tail in the skeleton.
  const joints = useMemo(() => {
    const seen = new Map<string, { pos: [number, number, number]; isRoot: boolean }>()
    const rootHead = skeleton.nodes.find((n) => n.id === skeleton.rootId)?.head
    for (const n of skeleton.nodes) {
      for (const p of [n.head, n.tail]) {
        const k = `${p[0].toFixed(4)}:${p[1].toFixed(4)}:${p[2].toFixed(4)}`
        if (seen.has(k)) continue
        const isRoot =
          !!rootHead &&
          p[0] === rootHead[0] &&
          p[1] === rootHead[1] &&
          p[2] === rootHead[2]
        seen.set(k, { pos: [p[0], p[1], p[2]], isRoot })
      }
    }
    return Array.from(seen.entries()).map(([key, v]) => ({ key, ...v }))
  }, [skeleton])

  const edges = useMemo(() => getSkeletonEdges(skeleton), [skeleton])

  return (
    <group position={position}>
      {/* Bones (node center-lines) */}
      <lineSegments>
        <primitive object={linesGeometry} attach="geometry" />
        <lineBasicMaterial color={boneColor} linewidth={2} depthTest={false} transparent opacity={0.9} />
      </lineSegments>

      {/* Joints (unique points where nodes meet) */}
      {joints.map((j) => (
        <mesh key={j.key} position={j.pos} renderOrder={2}>
          <sphereGeometry args={[j.isRoot ? jointRadius * 1.6 : jointRadius, 12, 12]} />
          <meshBasicMaterial color={j.isRoot ? rootColor : jointColor} depthTest={false} transparent opacity={0.95} />
        </mesh>
      ))}

      {/* Edge labels would go here — out of scope for first pass. The edge
          list is computed (`edges`) but not rendered to keep the wire clean. */}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {edges.length > 0 && null}
    </group>
  )
}
