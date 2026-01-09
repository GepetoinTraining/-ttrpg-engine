/**
 * TOPOLOGY-FIRST AUTHENTICATION: CORE MATH
 * ==========================================
 *
 * The math IS the handshake.
 *
 * φ + ζ = π
 *
 * Authentication without passwords, tokens, or sessions.
 * Just: same seed + same math = same answer.
 *
 * How it works:
 * 1. Enrollment captures datetime + geolocation
 * 2. Creates seed: concatenate → prime factorize → Fibonacci variant → ζ
 * 3. Challenge: Server sends n, both compute M^n
 * 4. M = [[φ, ζ], [ζ, φ]] where φ = golden ratio
 * 5. Match? You're you. Diverge? You're nobody.
 */

import { createHash } from 'crypto';

// ============================================
// CONSTANTS
// ============================================

/** Golden ratio - the self-referential constant */
export const PHI = (1 + Math.sqrt(5)) / 2;

/** Number of Fibonacci terms for ζ computation */
const ZETA_TERMS = 20;

/** Challenge exponent range */
export const CHALLENGE_N_MIN = 37;
export const CHALLENGE_N_MAX = 97;

// ============================================
// TYPES
// ============================================

export type Matrix2x2 = [[number, number], [number, number]];

export interface GeoLocation {
  lat: number;
  lon: number;
}

export interface EnrollmentMoment {
  datetime: Date;
  geo: GeoLocation;
}

export interface Challenge {
  challengeId: string;
  n: number;
  expiresAt: Date;
}

// ============================================
// SEED GENERATION
// ============================================

/**
 * Create a seed from the enrollment moment.
 * The seed captures the unreproducible spacetime coordinate.
 *
 * @param moment - The enrollment datetime and geolocation
 * @returns A deterministic seed string
 */
export function createSeed(moment: EnrollmentMoment): string {
  // Concatenate datetime and geo into a unique string
  const timestamp = moment.datetime.getTime();
  const geoString = `${moment.geo.lat.toFixed(8)},${moment.geo.lon.toFixed(8)}`;
  const raw = `${timestamp}:${geoString}`;

  // Hash to get consistent length
  const hash = createHash('sha256').update(raw).digest('hex');

  return hash;
}

/**
 * Create a commitment (hash) of the seed.
 * Server stores this, not the raw seed.
 */
export function createSeedCommitment(seed: string): string {
  return createHash('sha256').update(`commitment:${seed}`).digest('hex');
}

// ============================================
// PRIME FACTORIZATION
// ============================================

/**
 * Convert seed to a BigInt for factorization.
 * Uses first 16 hex chars to avoid overflow.
 */
export function seedToBigInt(seed: string): bigint {
  // Take first 16 hex characters (64 bits)
  const hex = seed.slice(0, 16);
  return BigInt(`0x${hex}`);
}

/**
 * Prime factorize a BigInt.
 * Returns array of prime factors (with repetition).
 */
export function primeFactorize(n: bigint): bigint[] {
  const factors: bigint[] = [];
  let num = n;

  // Handle 2s
  while (num % 2n === 0n) {
    factors.push(2n);
    num = num / 2n;
  }

  // Check odd factors up to sqrt(n)
  let i = 3n;
  while (i * i <= num) {
    while (num % i === 0n) {
      factors.push(i);
      num = num / i;
    }
    i += 2n;
  }

  // If n is still > 1, it's a prime factor
  if (num > 1n) {
    factors.push(num);
  }

  return factors;
}

// ============================================
// FIBONACCI VARIANT
// ============================================

/**
 * Generate a seeded Fibonacci-like sequence.
 * The seed influences the starting values.
 */
export function fibonacciVariant(seed: string, k: number): bigint {
  // Derive starting values from seed
  const seedInt = seedToBigInt(seed);
  const a0 = (seedInt % 1000n) + 1n;
  const a1 = ((seedInt >> 10n) % 1000n) + 1n;

  if (k === 0) return a0;
  if (k === 1) return a1;

  let prev2 = a0;
  let prev1 = a1;

  for (let i = 2; i <= k; i++) {
    const next = prev1 + prev2;
    prev2 = prev1;
    prev1 = next;
  }

  return prev1;
}

// ============================================
// ZETA COMPUTATION
// ============================================

/**
 * Compute ζ (zeta) from seed.
 * ζ = Σ 1/F_k² for k = 1 to ZETA_TERMS
 *
 * This is the player's "permission structure" - their unique counting.
 */
export function computeZeta(seed: string): number {
  let sum = 0;

  for (let k = 1; k <= ZETA_TERMS; k++) {
    const fk = fibonacciVariant(seed, k);
    // Convert to number for floating point arithmetic
    // Use string conversion to handle large BigInts
    const fkNum = Number(fk);
    if (fkNum > 0 && isFinite(fkNum)) {
      sum += 1 / (fkNum * fkNum);
    }
  }

  return sum;
}

/**
 * Create a commitment of ζ.
 */
export function createZetaCommitment(zeta: number): string {
  // Round to avoid floating point inconsistencies
  const rounded = zeta.toFixed(15);
  return createHash('sha256').update(`zeta:${rounded}`).digest('hex');
}

// ============================================
// MATRIX OPERATIONS
// ============================================

/**
 * Create the fundamental matrix M.
 * M = [[φ, ζ], [ζ, φ]]
 */
export function createM(zeta: number): Matrix2x2 {
  return [
    [PHI, zeta],
    [zeta, PHI],
  ];
}

/**
 * Multiply two 2x2 matrices.
 */
export function matrixMultiply(A: Matrix2x2, B: Matrix2x2): Matrix2x2 {
  return [
    [
      A[0][0] * B[0][0] + A[0][1] * B[1][0],
      A[0][0] * B[0][1] + A[0][1] * B[1][1],
    ],
    [
      A[1][0] * B[0][0] + A[1][1] * B[1][0],
      A[1][0] * B[0][1] + A[1][1] * B[1][1],
    ],
  ];
}

/**
 * Compute M^n using fast exponentiation.
 */
export function matrixPower(M: Matrix2x2, n: number): Matrix2x2 {
  if (n === 0) {
    return [
      [1, 0],
      [0, 1],
    ]; // Identity
  }

  if (n === 1) {
    return M;
  }

  if (n % 2 === 0) {
    const half = matrixPower(M, n / 2);
    return matrixMultiply(half, half);
  } else {
    return matrixMultiply(M, matrixPower(M, n - 1));
  }
}

/**
 * Hash a matrix to create a trajectory fingerprint.
 * This is what gets compared for authentication.
 */
export function trajectoryHash(M: Matrix2x2): string {
  // Round to avoid floating point issues across systems
  const precision = 12;
  const str = [
    M[0][0].toFixed(precision),
    M[0][1].toFixed(precision),
    M[1][0].toFixed(precision),
    M[1][1].toFixed(precision),
  ].join(':');

  return createHash('sha256').update(str).digest('hex');
}

// ============================================
// CHALLENGE/RESPONSE
// ============================================

/**
 * Generate a random challenge exponent.
 */
export function generateChallengeN(): number {
  return (
    Math.floor(Math.random() * (CHALLENGE_N_MAX - CHALLENGE_N_MIN + 1)) +
    CHALLENGE_N_MIN
  );
}

/**
 * Compute the trajectory for a challenge.
 * This is what the client computes and sends back.
 *
 * @param seed - The client's seed (from certificate)
 * @param n - The challenge exponent
 * @returns The trajectory hash
 */
export function computeTrajectory(seed: string, n: number): string {
  const zeta = computeZeta(seed);
  const M = createM(zeta);
  const Mn = matrixPower(M, n);
  return trajectoryHash(Mn);
}

/**
 * Verify that two trajectories match.
 */
export function verifyTrajectory(expected: string, actual: string): boolean {
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== actual.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }

  return result === 0;
}

// ============================================
// CERTIFICATE OPERATIONS
// ============================================

/**
 * Certificate structure stored on client.
 * Contains the seed (secret) and metadata.
 */
export interface Certificate {
  version: 1;
  seed: string;
  enrolledAt: string; // ISO timestamp
  deviceId: string;
}

/**
 * Create a certificate from enrollment data.
 */
export function createCertificate(
  seed: string,
  deviceId: string,
  enrolledAt: Date,
): Certificate {
  return {
    version: 1,
    seed,
    enrolledAt: enrolledAt.toISOString(),
    deviceId,
  };
}

/**
 * Serialize certificate for storage.
 */
export function serializeCertificate(cert: Certificate): string {
  return Buffer.from(JSON.stringify(cert)).toString('base64');
}

/**
 * Parse certificate from storage.
 */
export function parseCertificate(serialized: string): Certificate | null {
  try {
    const json = Buffer.from(serialized, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    if (parsed.version !== 1 || !parsed.seed || !parsed.deviceId) {
      return null;
    }

    return parsed as Certificate;
  } catch {
    return null;
  }
}

/**
 * Get the hash of a certificate for identification.
 * This is what gets sent to the server (not the full cert).
 */
export function getCertificateHash(cert: Certificate): string {
  // Hash seed + deviceId
  return createHash('sha256')
    .update(`cert:${cert.seed}:${cert.deviceId}`)
    .digest('hex');
}

/**
 * Extract seed from a serialized certificate.
 */
export function extractSeedFromCertificate(serialized: string): string | null {
  const cert = parseCertificate(serialized);
  return cert?.seed ?? null;
}
