'use client'

/**
 * SVG TILE FLOOR — render generated SVG tiles as Three.js textured planes
 * ==================================================================
 *
 * Direct path: rasterize the SVG to a canvas synchronously via DOMParser
 * + a small custom renderer. Bypasses the async <img> load so textures
 * are ready on first render, no flicker, no missing meshes.
 */

import { useMemo } from 'react'
import * as THREE from 'three'

export interface SvgTilePlacement {
  /** Stable key */
  key: string
  /** SVG text */
  svg: string
  /** Tile world position */
  q: number
  r: number
}

interface SvgTileFloorProps {
  tiles: ReadonlyArray<SvgTilePlacement>
  tileSize?: number
  resolution?: number
}

export function SvgTileFloor({
  tiles,
  tileSize = 1,
  resolution = 64,
}: SvgTileFloorProps): React.ReactElement {
  // Synchronously rasterize each SVG to a CanvasTexture. The SVGs are
  // simple `<rect>` lists, so we can parse them ourselves without going
  // through the browser's <img> SVG renderer.
  const textures = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>()
    for (const t of tiles) {
      const canvas = rasterizeSvgRectsToCanvas(t.svg, resolution)
      if (!canvas) continue
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      tex.needsUpdate = true
      map.set(t.key, tex)
    }
    return map
  }, [tiles, resolution])

  return (
    <group>
      {tiles.map((t) => {
        const tex = textures.get(t.key)
        return (
          <mesh
            key={t.key}
            position={[t.q, 0.01, t.r]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[tileSize, tileSize]} />
            {tex ? (
              <meshStandardMaterial map={tex} roughness={0.9} side={THREE.DoubleSide} />
            ) : (
              <meshStandardMaterial color="#ff00ff" roughness={0.9} side={THREE.DoubleSide} />
            )}
          </mesh>
        )
      })}
    </group>
  )
}

// ============================================================
// Synchronous SVG → canvas rasterizer
// ============================================================
//
// Our generated SVGs are deliberately simple: a `<svg>` with one full-size
// background `<rect>` and many small `<rect>` runs. We parse the rects with
// a regex and paint directly to canvas. No async, no dependencies, no
// browser-quirk rendering paths.

const RECT_RE = /<rect\s+([^/>]*)\/>/g
const ATTR_RE = /(\w+)="([^"]*)"/g
const VIEWBOX_RE = /viewBox="0\s+0\s+(\d+)\s+(\d+)"/

function rasterizeSvgRectsToCanvas(svg: string, resolution: number): HTMLCanvasElement | null {
  const vb = VIEWBOX_RE.exec(svg)
  const svgW = vb ? parseInt(vb[1], 10) : 64
  const svgH = vb ? parseInt(vb[2], 10) : 64
  const sx = resolution / svgW
  const sy = resolution / svgH

  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false

  let m: RegExpExecArray | null
  RECT_RE.lastIndex = 0
  while ((m = RECT_RE.exec(svg)) !== null) {
    const attrs = parseAttrs(m[1])
    const rx = (attrs.x ? parseFloat(attrs.x) : 0) * sx
    const ry = (attrs.y ? parseFloat(attrs.y) : 0) * sy
    const rw = (attrs.width ? parseFloat(attrs.width) : svgW) * sx
    const rh = (attrs.height ? parseFloat(attrs.height) : svgH) * sy
    ctx.fillStyle = attrs.fill ?? '#000'
    ctx.fillRect(rx, ry, rw, rh)
  }
  return canvas
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(s)) !== null) {
    out[m[1]] = m[2]
  }
  return out
}
