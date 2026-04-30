/**
 * Simplex Noise — deterministic from seed.
 * 
 * Used for world generation: elevation, moisture, temperature layers.
 * Each layer is a noise function evaluated at hex (q, r) coordinates
 * with different frequency and offset.
 * 
 * Based on Stefan Gustavson's simplex noise implementation (public domain).
 */

// Gradient vectors for 2D simplex noise
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

/**
 * Seeded PRNG — mulberry32.
 * Returns a function that produces deterministic floats [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate a permutation table from a seed.
 */
function buildPerm(seed: number): Uint8Array {
  const rng = mulberry32(seed)
  const perm = new Uint8Array(512)
  const p = new Uint8Array(256)

  // Fill with identity
  for (let i = 0; i < 256; i++) p[i] = i

  // Fisher-Yates shuffle using seeded RNG
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }

  // Double for wrapping
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  return perm
}

/**
 * 2D Simplex noise.
 * Returns value in [-1, 1].
 */
function simplex2d(perm: Uint8Array, x: number, y: number): number {
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0)
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0

  // Skew input space
  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)

  const t = (i + j) * G2
  const X0 = i - t
  const Y0 = j - t
  const x0 = x - X0
  const y0 = y - Y0

  // Determine simplex
  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1.0 + 2.0 * G2
  const y2 = y0 - 1.0 + 2.0 * G2

  // Hash coordinates
  const ii = i & 255
  const jj = j & 255

  const gi0 = perm[ii + perm[jj]] % 8
  const gi1 = perm[ii + i1 + perm[jj + j1]] % 8
  const gi2 = perm[ii + 1 + perm[jj + 1]] % 8

  // Contributions
  let n0 = 0, n1 = 0, n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2)
  }

  // Scale to [-1, 1]
  return 70.0 * (n0 + n1 + n2)
}

/**
 * Create a noise generator from a world seed.
 */
export function createNoise(worldSeed: number) {
  const perm = buildPerm(worldSeed)

  /**
   * Sample noise at (x, y) with given frequency.
   * Returns value in [0, 1].
   */
  function sample(x: number, y: number, frequency: number = 1): number {
    const raw = simplex2d(perm, x * frequency, y * frequency)
    return (raw + 1) / 2 // normalize to [0, 1]
  }

  /**
   * Fractal Brownian Motion — layered noise for more natural terrain.
   * octaves: number of layers, lacunarity: frequency multiplier, gain: amplitude decay.
   */
  function fbm(
    x: number,
    y: number,
    frequency: number = 1,
    octaves: number = 4,
    lacunarity: number = 2.0,
    gain: number = 0.5
  ): number {
    let value = 0
    let amplitude = 1
    let maxAmplitude = 0
    let freq = frequency

    for (let i = 0; i < octaves; i++) {
      value += amplitude * simplex2d(perm, x * freq, y * freq)
      maxAmplitude += amplitude
      amplitude *= gain
      freq *= lacunarity
    }

    // Normalize to [0, 1]
    return (value / maxAmplitude + 1) / 2
  }

  return { sample, fbm }
}

export type NoiseGenerator = ReturnType<typeof createNoise>
