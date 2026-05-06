'use client'

/**
 * TILE FLOOR — Grid of SVG-textured planes
 * ==========================================
 *
 * Loads SVG floor tiles from /public/sprites/ via an Image element rasterized
 * into a CanvasTexture, then lays them out as flat plane geometries on the
 * y=0 plane.
 *
 * Each tile also gets a thin wireframe border so the grid is visible
 * regardless of texture-load state.
 */

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

interface TileFloorProps {
  cols: number
  rows: number
  tileSize?: number
  tileSvgs: string[]
}

export function TileFloor({
  cols, rows, tileSize = 1, tileSvgs,
}: TileFloorProps): React.ReactElement {
  const uniqueSvgs = useMemo(() => Array.from(new Set(tileSvgs)), [tileSvgs])
  const textures = useSvgTextures(uniqueSvgs)

  // Slight epsilon so the wireframe sits above the tile and doesn't z-fight
  const EPS = 0.001

  return (
    <group position={[-(cols - 1) * tileSize / 2, 0, -(rows - 1) * tileSize / 2]}>
      {Array.from({ length: cols * rows }).map((_, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const svgPath = tileSvgs[idx % tileSvgs.length]
        const texture = textures[svgPath]
        return (
          <group key={idx} position={[col * tileSize, 0, row * tileSize]}>
            {/* The tile face */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[tileSize, tileSize]} />
              {texture ? (
                <meshStandardMaterial map={texture} roughness={0.95} />
              ) : (
                /* Fallback color — clearly visible against the dark scene bg */
                <meshStandardMaterial color="#5a5a64" roughness={0.95} />
              )}
            </mesh>
            {/* Wireframe edge — always renders, makes the grid legible */}
            <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, EPS, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(tileSize, tileSize)]} />
              <lineBasicMaterial color="#888888" />
            </lineSegments>
          </group>
        )
      })}
    </group>
  )
}

// ============================================================
// SVG → CANVAS → TEXTURE LOADER
// ============================================================

function useSvgTextures(paths: string[]): Record<string, THREE.Texture | undefined> {
  const [textures, setTextures] = useState<Record<string, THREE.Texture | undefined>>({})

  useEffect(() => {
    let cancelled = false

    const loaders = paths.map(async (path) => {
      try {
        const img = await loadImage(path)
        if (cancelled) return [path, null] as const
        const canvas = document.createElement('canvas')
        const size = 512
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return [path, null] as const
        // Clear with a fallback color in case the SVG has transparent regions
        ctx.fillStyle = '#5a5a64'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        const tex = new THREE.CanvasTexture(canvas)
        tex.needsUpdate = true
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        tex.colorSpace = THREE.SRGBColorSpace
        return [path, tex] as const
      } catch (err) {
        // Log so loading failures aren't silent in dev tools
        // eslint-disable-next-line no-console
        console.warn('[TileFloor] failed to load SVG:', path, err)
        return [path, null] as const
      }
    })

    Promise.all(loaders).then((entries) => {
      if (cancelled) return
      const next: Record<string, THREE.Texture | undefined> = {}
      for (const [path, tex] of entries) {
        if (tex) next[path] = tex
      }
      setTextures(next)
    })

    return () => { cancelled = true }
  }, [paths.join('|')])

  return textures
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // No crossOrigin attribute — same-origin Next.js SVGs don't need CORS,
    // and setting crossOrigin='anonymous' can taint the canvas on some dev configs.
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}
