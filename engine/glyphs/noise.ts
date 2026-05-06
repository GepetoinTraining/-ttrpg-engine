/**
 * NOISE — 2D value noise + fbm for procedural variation
 * ==================================================================
 *
 * Deterministic from a string seed. Same seed → identical noise field.
 * Used by the tile-svg pipeline to produce natural-looking variation
 * within a single 64×64 tile (clusters of grass tufts, scattered dirt
 * patches, mossy spots — instead of uniform random speckle).
 *
 * Value noise is cheaper than simplex/perlin and produces smooth
 * gradients at roughly 0..1. fbm() sums multiple octaves for fractal
 * detail at different frequencies.
 *
 * No DB imports. No LLM imports.
 */

import { SeededRNG } from '../hub-topology'

export type Noise2D = (x: number, y: number) => number

/**
 * Smooth value noise. The grid is `gridSize × gridSize` cells of random
 * floats; coords wrap modulo gridSize. Bilinear interpolation with a
 * smoothstep curve gives `C¹`-continuous output.
 *
 * @param seed     deterministic seed string
 * @param gridSize must be a power of 2 (default 256)
 */
export function makeValueNoise2D(seed: string, gridSize = 256): Noise2D {
  if ((gridSize & (gridSize - 1)) !== 0) {
    throw new Error(`makeValueNoise2D: gridSize must be a power of 2; got ${gridSize}`)
  }
  const rng = new SeededRNG(seed)
  const grid = new Float32Array(gridSize * gridSize)
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next()
  const mask = gridSize - 1

  return (x: number, y: number): number => {
    const xi0 = Math.floor(x)
    const yi0 = Math.floor(y)
    const xf = x - xi0
    const yf = y - yi0
    const xi = xi0 & mask
    const yi = yi0 & mask
    const xn = (xi + 1) & mask
    const yn = (yi + 1) & mask

    const v00 = grid[yi * gridSize + xi]
    const v10 = grid[yi * gridSize + xn]
    const v01 = grid[yn * gridSize + xi]
    const v11 = grid[yn * gridSize + xn]

    // Smoothstep: 3t² - 2t³
    const sx = xf * xf * (3 - 2 * xf)
    const sy = yf * yf * (3 - 2 * yf)

    const top = v00 * (1 - sx) + v10 * sx
    const bot = v01 * (1 - sx) + v11 * sx
    return top * (1 - sy) + bot * sy
  }
}

/**
 * Fractal Brownian Motion — sum the noise at multiple octaves.
 * Octave i samples at frequency `2^i` with amplitude `persistence^i`.
 * Output is normalized to roughly [0, 1].
 */
export function fbm(
  noise: Noise2D,
  x: number,
  y: number,
  octaves = 4,
  persistence = 0.5,
): number {
  let total = 0
  let amplitude = 1
  let frequency = 1
  let max = 0
  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude
    max += amplitude
    amplitude *= persistence
    frequency *= 2
  }
  return total / max
}

/** Map a noise value (0..1) to a discrete bucket index. */
export function bucketize(value: number, thresholds: ReadonlyArray<number>): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (value < thresholds[i]) return i
  }
  return thresholds.length
}

/**
 * Sample noise across a rectangular grid into a Float32Array. Useful
 * for batch processing when generating a full tile.
 */
export function sampleField2D(
  noise: Noise2D,
  startX: number,
  startY: number,
  width: number,
  height: number,
  step: number,
  octaves = 1,
  persistence = 0.5,
): Float32Array {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = startX + x * step
      const sy = startY + y * step
      out[y * width + x] = octaves <= 1
        ? noise(sx, sy)
        : fbm(noise, sx, sy, octaves, persistence)
    }
  }
  return out
}
