'use client'

/**
 * TILE FLOOR — Grid of SVG-textured planes
 * ==========================================
 *
 * Loads SVG floor tiles via:
 *   1. fetch the SVG as text
 *   2. wrap in a Blob with MIME image/svg+xml (forces correct treatment)
 *   3. load Blob URL into an Image with explicit dimensions
 *   4. await image.decode() so the SVG is fully rasterized before draw
 *   5. drawImage onto a 256×256 canvas
 *   6. CanvasTexture from the canvas, sRGB colorSpace
 *
 * This sequence is much more reliable than the naive `img.src = path`
 * approach, which can capture pre-render frames or fail silently on
 * SVGs without intrinsic dimensions.
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

  const EPS = 0.001  // tiny y-offset so wireframe doesn't z-fight tile face

  return (
    <group position={[-(cols - 1) * tileSize / 2, 0, -(rows - 1) * tileSize / 2]}>
      {Array.from({ length: cols * rows }).map((_, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const svgPath = tileSvgs[idx % tileSvgs.length]
        const texture = textures[svgPath]
        return (
          <group key={idx} position={[col * tileSize, 0, row * tileSize]}>
            {/* The tile face — DIAGNOSTIC pass:
                  red fallback  = no texture (loader didn't deliver)
                  textured face = use meshBasicMaterial (no lighting math)
                                  so we see raw texture content directly */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[tileSize, tileSize]} />
              {texture ? (
                <meshBasicMaterial
                  map={texture}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                />
              ) : (
                <meshBasicMaterial
                  color="#ff2244"
                  side={THREE.DoubleSide}
                />
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
// SVG → BLOB URL → IMAGE → CANVAS → TEXTURE LOADER
// ============================================================

function useSvgTextures(paths: string[]): Record<string, THREE.Texture | undefined> {
  const [textures, setTextures] = useState<Record<string, THREE.Texture | undefined>>({})

  useEffect(() => {
    let cancelled = false

    const loaders = paths.map(async (path): Promise<readonly [string, THREE.Texture | null]> => {
      try {
        const tex = await loadSvgToTexture(path, 256)
        return [path, tex]
      } catch (err) {
        // Log clearly in dev tools if anything fails
        // eslint-disable-next-line no-console
        console.warn('[TileFloor] failed to load SVG → texture:', path, err)
        return [path, null]
      }
    })

    Promise.all(loaders).then((entries) => {
      if (cancelled) return
      const next: Record<string, THREE.Texture | undefined> = {}
      let succeeded = 0
      for (const [path, tex] of entries) {
        if (tex) {
          next[path] = tex
          succeeded += 1
        }
      }
      // eslint-disable-next-line no-console
      console.info(`[TileFloor] textures ready: ${succeeded}/${paths.length}`)
      setTextures(next)
    })

    return () => { cancelled = true }
  }, [paths.join('|')])

  return textures
}

/**
 * Load an SVG file → texture via the Blob-URL + decode() path.
 * Resilient to:
 *   - server returning an unexpected Content-Type
 *   - SVGs without intrinsic width/height (we set them explicitly)
 *   - browsers that need image.decode() to ensure rasterization is complete
 */
async function loadSvgToTexture(path: string, size: number): Promise<THREE.Texture> {
  // 1. Fetch the SVG as text
  const response = await fetch(path)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`)
  const svgText = await response.text()

  // 2. Wrap in a Blob with the correct MIME type
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  try {
    // 3. Load into an Image with explicit dimensions
    const img = new Image(size, size)
    img.src = url
    // 4. Wait for the image to fully decode (rasterize)
    if (img.decode) {
      await img.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error(`Image load failed: ${path}`))
      })
    }

    // 5. Draw onto a canvas at the requested size
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    // Clear to a slate color in case the SVG has transparent regions
    ctx.fillStyle = '#5a5a64'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)

    // 6. Build the Three.js texture
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.minFilter = THREE.LinearMipMapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
    return tex
  } finally {
    URL.revokeObjectURL(url)
  }
}
