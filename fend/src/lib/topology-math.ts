/**
 * TOPOLOGY MATH - CLIENT SIDE
 * ============================
 *
 * Must produce identical results to server-side math.ts
 * Core formula: phi + zeta = pi (conceptually)
 *
 * Flow:
 * 1. Seed generated from enrollment (datetime + geo)
 * 2. Zeta derived from seed via Fibonacci variant
 * 3. Matrix M = [[phi, zeta], [zeta, phi]]
 * 4. Challenge: compute M^n and hash result
 */

// ============================================
// CONSTANTS
// ============================================

/** Golden ratio - the heart of our topology */
export const PHI = (1 + Math.sqrt(5)) / 2;

// ============================================
// MATRIX OPERATIONS
// ============================================

export type Matrix2x2 = [[number, number], [number, number]];

/**
 * Create the topology matrix M from zeta
 * M = [[phi, zeta], [zeta, phi]]
 */
export function createM(zeta: number): Matrix2x2 {
  return [
    [PHI, zeta],
    [zeta, PHI],
  ];
}

/**
 * Multiply two 2x2 matrices
 */
export function matrixMultiply(a: Matrix2x2, b: Matrix2x2): Matrix2x2 {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1],
    ],
  ];
}

/**
 * Identity matrix
 */
export function identityMatrix(): Matrix2x2 {
  return [
    [1, 0],
    [0, 1],
  ];
}

/**
 * Compute M^n using fast exponentiation
 */
export function matrixPower(M: Matrix2x2, n: number): Matrix2x2 {
  if (n === 0) return identityMatrix();
  if (n === 1) return M;

  let result = identityMatrix();
  let base: Matrix2x2 = [...M.map((row) => [...row])] as Matrix2x2;

  while (n > 0) {
    if (n % 2 === 1) {
      result = matrixMultiply(result, base);
    }
    base = matrixMultiply(base, base);
    n = Math.floor(n / 2);
  }

  return result;
}

/**
 * Hash a matrix to produce trajectory string
 * Uses a simple but deterministic approach
 */
export function trajectoryHash(M: Matrix2x2): string {
  // Flatten matrix values with high precision
  const values = [M[0][0], M[0][1], M[1][0], M[1][1]];

  // Create a deterministic string representation
  const str = values.map((v) => v.toFixed(10)).join('|');

  // Simple hash (must match server implementation)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================
// SEED & ZETA COMPUTATION
// ============================================

/**
 * Generate Fibonacci variant numbers from seed
 */
export function fibonacciVariant(seed: string, k: number): bigint {
  // Use seed to create initial conditions
  let a = 1n;
  let b = 1n;

  // Mix in seed
  for (let i = 0; i < seed.length; i++) {
    const char = BigInt(seed.charCodeAt(i));
    a = (a * 31n + char) % 1000000007n;
    b = (b * 37n + char) % 1000000007n;
  }

  // Generate k-th Fibonacci variant
  for (let i = 0; i < k; i++) {
    const next = a + b;
    a = b;
    b = next;
  }

  return b;
}

/**
 * Compute zeta from seed
 * zeta = sum of 1/F_k^2 for k = 1 to 20
 */
export function computeZeta(seed: string): number {
  let zeta = 0;

  for (let k = 1; k <= 20; k++) {
    const fk = fibonacciVariant(seed, k);
    // Convert to number safely (may lose precision for very large values)
    const fkNum = Number(fk);
    if (fkNum > 0) {
      zeta += 1 / (fkNum * fkNum);
    }
  }

  return zeta;
}

// ============================================
// MAIN API
// ============================================

/**
 * Compute trajectory for challenge response
 *
 * @param seed - The user's seed (from certificate)
 * @param n - The challenge exponent
 * @returns Trajectory hash string
 */
export function computeTrajectory(seed: string, n: number): string {
  const zeta = computeZeta(seed);
  const M = createM(zeta);
  const Mn = matrixPower(M, n);
  return trajectoryHash(Mn);
}

/**
 * Verify that a trajectory matches expected
 */
export function verifyTrajectory(expected: string, actual: string): boolean {
  return expected === actual;
}

// ============================================
// CERTIFICATE HANDLING
// ============================================

export interface TopologyCertificate {
  seed: string;
  hash: string;
  deviceId: string;
  issuedAt: string;
}

/**
 * Parse a certificate string into its components
 */
export function parseCertificate(certString: string): TopologyCertificate | null {
  try {
    const decoded = atob(certString);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Extract seed from certificate
 */
export function extractSeedFromCertificate(certString: string): string | null {
  const cert = parseCertificate(certString);
  return cert?.seed || null;
}

/**
 * Get certificate hash (used as identifier)
 */
export function getCertificateHash(certString: string): string | null {
  const cert = parseCertificate(certString);
  return cert?.hash || null;
}
