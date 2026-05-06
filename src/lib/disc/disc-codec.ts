/**
 * DISC CODEC — RGB-via-matrix encoding for the 64-wedge entity tensor
 * ====================================================================
 *
 * Each entity carries a hidden 64-wedge disc geometry. Each wedge is a
 * triangle with one effective RGB color. The slot's position (0-63) is
 * its column in the shared dictionary; the color encodes its value via
 * a matrix-multiplication decoder.
 *
 *   value = M · [R, G, B]    (matrix-multiply, integer arithmetic)
 *
 * Same matrix on client and server → same decoded value, guaranteed.
 * No lookup tables. No hashing. No floats. The matrix IS the dictionary.
 *
 * This file holds the codec primitives. The actual slot allocations
 * (what slot 0 means, what slot 1 means, etc.) live in `disc-spec.ts`.
 */

// ============================================================
// TYPES
// ============================================================

/** RGB triple, each channel 0-255 (8-bit unsigned). */
export interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Decoder matrix for one slot.
 * Each row produces one semantic value. Most slots use a single 1×3 row.
 * A slot can carry up to 3 independent values via 3 rows (3×3 matrix).
 *
 * Coefficients are integers — preserves determinism across platforms.
 */
export type DecoderMatrix = number[][]

/** A 64-wedge disc tensor — one RGB per wedge. */
export type DiscTensor = RGB[]

// ============================================================
// CORE CODEC
// ============================================================

/** Apply a decoder matrix to an RGB triple. Returns one value per matrix row. */
export function decode(matrix: DecoderMatrix, rgb: RGB): number[] {
  const v = [rgb.r, rgb.g, rgb.b]
  return matrix.map(row => row.reduce((sum, coeff, i) => sum + coeff * v[i], 0))
}

/**
 * Encode a single integer value via a 1×3 row matrix into RGB.
 * Inverts the trivial cases: identity-on-R/G/B, or "pack into channel C".
 *
 * This is the encoder side of the codec. Designers compose entities by
 * calling encode(...) per slot; the engine then renders the resulting
 * disc tensor and reads it back via decode() with the same matrix.
 */
export function encodeChannel(channel: 'r' | 'g' | 'b', value: number): RGB {
  const v = clamp8(value)
  return {
    r: channel === 'r' ? v : 0,
    g: channel === 'g' ? v : 0,
    b: channel === 'b' ? v : 0,
  }
}

/** Encode three independent values into one RGB triple (one per channel). */
export function encodeRGB(rValue: number, gValue: number, bValue: number): RGB {
  return { r: clamp8(rValue), g: clamp8(gValue), b: clamp8(bValue) }
}

/**
 * Encode a packed 24-bit value into RGB (high → R, mid → G, low → B).
 * Use when one slot needs to carry a wider value than 8 bits.
 */
export function encodePacked24(value: number): RGB {
  const v = Math.max(0, Math.min(0xffffff, Math.floor(value)))
  return {
    r: (v >> 16) & 0xff,
    g: (v >> 8)  & 0xff,
    b:  v        & 0xff,
  }
}

/** Decode a packed 24-bit value back via the canonical packing matrix. */
export const PACKED_24_MATRIX: DecoderMatrix = [[65536, 256, 1]]

// ============================================================
// CANONICAL DECODER MATRICES (the most common shapes)
// ============================================================

/** Read just R (8-bit unsigned, 0-255). */
export const READ_R: DecoderMatrix = [[1, 0, 0]]
/** Read just G. */
export const READ_G: DecoderMatrix = [[0, 1, 0]]
/** Read just B. */
export const READ_B: DecoderMatrix = [[0, 0, 1]]
/** Read all three independently as a 3-vector. */
export const READ_RGB: DecoderMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
/** Read R as signed 8-bit (-128..127), centered at 128. */
export const READ_R_SIGNED: DecoderMatrix = [[1, 0, 0]]   // caller subtracts 128

// ============================================================
// TENSOR HELPERS
// ============================================================

/** Make a fresh 64-wedge tensor with all wedges zeroed (= "feature absent"). */
export function blankTensor(): DiscTensor {
  return Array.from({ length: 64 }, () => ({ r: 0, g: 0, b: 0 }))
}

/** Read slot N's RGB from a tensor. */
export function readSlot(tensor: DiscTensor, slot: number): RGB {
  return tensor[slot] ?? { r: 0, g: 0, b: 0 }
}

/** Write slot N's RGB into a tensor (mutates). */
export function writeSlot(tensor: DiscTensor, slot: number, rgb: RGB): void {
  if (slot >= 0 && slot < 64) tensor[slot] = rgb
}

/**
 * Compare two tensors field-by-field. Equivalent tensors produce equivalent
 * entities by construction — no hash needed. The bytes ARE the stamp.
 */
export function tensorsMatch(a: DiscTensor, b: DiscTensor): boolean {
  for (let i = 0; i < 64; i++) {
    const ax = a[i], bx = b[i]
    if (ax.r !== bx.r || ax.g !== bx.g || ax.b !== bx.b) return false
  }
  return true
}

/** Serialize a tensor to a flat 192-byte array (R,G,B per wedge × 64 wedges). */
export function tensorToBytes(tensor: DiscTensor): Uint8Array {
  const bytes = new Uint8Array(192)
  for (let i = 0; i < 64; i++) {
    bytes[i * 3 + 0] = tensor[i].r
    bytes[i * 3 + 1] = tensor[i].g
    bytes[i * 3 + 2] = tensor[i].b
  }
  return bytes
}

/** Deserialize a 192-byte array back to a tensor. */
export function tensorFromBytes(bytes: Uint8Array): DiscTensor {
  const tensor = blankTensor()
  for (let i = 0; i < 64; i++) {
    tensor[i] = { r: bytes[i * 3] ?? 0, g: bytes[i * 3 + 1] ?? 0, b: bytes[i * 3 + 2] ?? 0 }
  }
  return tensor
}

// ============================================================
// HELPERS
// ============================================================

function clamp8(v: number): number {
  const n = Math.floor(v)
  return n < 0 ? 0 : n > 255 ? 255 : n
}
