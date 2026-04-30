/**
 * PHI.TS - The Golden Ratio and Fibonacci
 * φ = (1 + √5) / 2
 *
 * This is not a library. This is the law.
 */

// φ - The self-referential constant
export const PHI = (1 + Math.sqrt(5)) / 2;

// ψ - The conjugate
export const PSI = (1 - Math.sqrt(5)) / 2;

/**
 * Standard Fibonacci sequence
 */
export function fibonacci(n: number): bigint {
  if (n <= 0) return 0n;
  if (n === 1 || n === 2) return 1n;

  let a = 1n, b = 1n;
  for (let i = 3; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Seeded Fibonacci - YOUR sequence
 * The primes from your enrollment moment determine your path
 */
export function seededFibonacci(n: number, primes: bigint[]): bigint {
  if (n <= 0) return 0n;
  if (primes.length < 2) throw new Error("Need at least 2 primes");

  // Your F₁ and F₂ come from your primes
  const f1 = primes[0];
  const f2 = primes[1];

  // Modulus from third prime (or product of remaining)
  const mod = primes.length > 2
    ? primes.slice(2).reduce((a, b) => a * b, 1n)
    : primes[0] * primes[1];

  if (n === 1) return f1 % mod;
  if (n === 2) return f2 % mod;

  let a = f1 % mod;
  let b = f2 % mod;

  for (let i = 3; i <= n; i++) {
    [a, b] = [b, (a + b) % mod];
  }
  return b;
}

/**
 * Compute ζ - the permission structure
 * ζ = Σ 1/F_k²
 *
 * Standard ζ uses standard Fibonacci
 * Your ζ uses your seeded Fibonacci
 */
export function computeZeta(terms: number = 50): number {
  let sum = 0;
  for (let k = 1; k <= terms; k++) {
    const fk = Number(fibonacci(k));
    if (fk === 0) continue;
    sum += 1 / (fk * fk);
  }
  return sum;
}

/**
 * Compute YOUR ζ from your prime seed
 */
export function computeSeededZeta(primes: bigint[], terms: number = 30): number {
  let sum = 0;
  for (let k = 1; k <= terms; k++) {
    const fk = Number(seededFibonacci(k, primes));
    if (fk === 0) continue;
    sum += 1 / (fk * fk);
  }
  return sum;
}

// The universal ζ ≈ 1.5354
export const ZETA = computeZeta(50);

// The approximation: φ + ζ ≈ π
export const PHI_PLUS_ZETA = PHI + ZETA;
