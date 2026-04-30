/**
 * MATRIX.TS - The Fundamental Matrix
 * M = [[φ, ζ], [ζ, φ]]
 *
 * This is where trajectories are computed.
 */

import { PHI } from "./phi";

// 2x2 Matrix type
export type Matrix2 = [[number, number], [number, number]];

/**
 * Create the fundamental matrix M for a given ζ
 */
export function createMatrix(zeta: number): Matrix2 {
  return [
    [PHI, zeta],
    [zeta, PHI]
  ];
}

/**
 * Matrix multiplication
 */
export function matMul(a: Matrix2, b: Matrix2): Matrix2 {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1]
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1]
    ]
  ];
}

/**
 * Matrix exponentiation by squaring: M^n
 * This is the trajectory computation
 */
export function matPow(m: Matrix2, n: number): Matrix2 {
  if (n === 0) {
    return [[1, 0], [0, 1]]; // Identity
  }
  if (n === 1) {
    return m;
  }

  if (n % 2 === 0) {
    const half = matPow(m, n / 2);
    return matMul(half, half);
  } else {
    return matMul(m, matPow(m, n - 1));
  }
}

/**
 * Compute eigenvalues of symmetric 2x2 matrix [[a, b], [b, a]]
 * λ± = a ± b
 */
export function eigenvalues(m: Matrix2): { plus: number; minus: number } {
  const a = m[0][0];
  const b = m[0][1];
  return {
    plus: a + b,   // φ + ζ ≈ π
    minus: a - b   // φ - ζ ≈ 0.083
  };
}

/**
 * Matrix fingerprint - a compact representation for comparison
 * Uses eigenvalues and trace at resolution n
 */
export function matrixFingerprint(m: Matrix2, n: number): string {
  const powered = matPow(m, n);
  const eigen = eigenvalues(powered);
  const trace = powered[0][0] + powered[1][1];
  const det = powered[0][0] * powered[1][1] - powered[0][1] * powered[1][0];

  // Return fixed precision for comparison
  return `${eigen.plus.toFixed(10)}:${eigen.minus.toFixed(10)}:${trace.toFixed(10)}:${det.toFixed(10)}`;
}

/**
 * The authentication trajectory
 * Given a ζ and challenge n, compute the proof
 */
export function computeTrajectory(zeta: number, n: number): string {
  const M = createMatrix(zeta);
  return matrixFingerprint(M, n);
}
