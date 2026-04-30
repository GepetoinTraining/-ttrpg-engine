/**
 * SEED.TS - Seed Management (Turso-backed)
 * Create and store enrollment seeds in the database
 */

import { db } from '@/db/connection'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createSeedNumber, primeFactorize } from './math/prime'
import { computeSeededZeta } from './math/phi'
import { createMatrix, type Matrix2 } from './math/matrix'

export interface SeedData {
  seed: string
  primes: string[]
  zeta: number
}

/**
 * Create seed data from enrollment moment (pure math, no DB)
 */
export function createSeedData(
  datetime: Date,
  geo: { lat: number; lon: number }
): SeedData {
  const seedNumber = createSeedNumber(datetime, geo)
  const primes = primeFactorize(seedNumber)
  const zeta = computeSeededZeta(primes)

  return {
    seed: seedNumber.toString(),
    primes: primes.map(p => p.toString()),
    zeta,
  }
}

/**
 * Get user's ζ from DB
 */
export async function getUserZeta(userId: string): Promise<number | null> {
  const user = await db.select({ zeta: users.zeta, active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user[0] || !user[0].active || user[0].zeta === null) return null
  return user[0].zeta
}

/**
 * Get user's matrix M from DB
 */
export async function getUserMatrix(userId: string): Promise<Matrix2 | null> {
  const zeta = await getUserZeta(userId)
  if (zeta === null) return null
  return createMatrix(zeta)
}
