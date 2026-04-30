/**
 * PRIME.TS - Prime Factorization
 * Breaking the enrollment moment into irreducible components
 */

/**
 * Simple primality test (sufficient for our scale)
 */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n) return true;
  if (n % 2n === 0n) return false;

  const sqrt = BigInt(Math.floor(Math.sqrt(Number(n)))) + 1n;
  for (let i = 3n; i <= sqrt; i += 2n) {
    if (n % i === 0n) return false;
  }
  return true;
}

/**
 * Prime factorization
 * Returns array of prime factors (with repetition)
 */
export function primeFactorize(n: bigint): bigint[] {
  if (n <= 1n) return [];

  const factors: bigint[] = [];
  let remaining = n;

  // Factor out 2s
  while (remaining % 2n === 0n) {
    factors.push(2n);
    remaining /= 2n;
  }

  // Factor out odd primes
  let i = 3n;
  while (i * i <= remaining) {
    while (remaining % i === 0n) {
      factors.push(i);
      remaining /= i;
    }
    i += 2n;
  }

  // If remaining is prime > 2
  if (remaining > 2n) {
    factors.push(remaining);
  }

  return factors;
}

/**
 * Get unique prime factors
 */
export function uniquePrimeFactors(n: bigint): bigint[] {
  return [...new Set(primeFactorize(n))];
}

/**
 * Create seed from datetime + geo
 * datetime: ISO string or timestamp
 * geo: { lat: number, lon: number }
 */
export function createSeedNumber(
  datetime: Date | number,
  geo: { lat: number; lon: number }
): bigint {
  // Get timestamp in ms
  const ts = datetime instanceof Date ? datetime.getTime() : datetime;

  // Convert geo to integers (6 decimal places → multiply by 1e6)
  const lat = Math.abs(Math.round(geo.lat * 1e6));
  const lon = Math.abs(Math.round(geo.lon * 1e6));

  // Concatenate: timestamp + lat + lon
  const seedStr = `${ts}${lat}${lon}`;

  return BigInt(seedStr);
}

/**
 * Full pipeline: datetime + geo → primes
 */
export function momentToPrimes(
  datetime: Date | number,
  geo: { lat: number; lon: number }
): bigint[] {
  const seedNumber = createSeedNumber(datetime, geo);
  return primeFactorize(seedNumber);
}
