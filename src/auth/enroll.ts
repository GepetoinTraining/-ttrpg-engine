/**
 * ENROLL.TS - Enrollment (Turso-backed)
 * Request → admin approve → cert issued → stored in DB
 */

import { db } from '@/db/connection'
import { users, authEnrollments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createSeedData } from './seed'
import { randomUUID } from 'crypto'

export interface Certificate {
  id: string
  seed: string
  zeta: number
  issuedAt: number
}

/**
 * Request enrollment — stores pending enrollment in DB
 */
export async function requestEnrollment(
  requestedId: string,
  geo: { lat: number; lon: number }
): Promise<string> {
  const token = randomUUID()
  const now = new Date()
  const expires = new Date(Date.now() + 3600000) // 1 hour

  await db.insert(authEnrollments).values({
    token,
    requestedId,
    geoLat: geo.lat,
    geoLon: geo.lon,
    requestedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    approved: false,
  })

  return token
}

/**
 * Approve enrollment — creates user + cert
 */
export async function approveEnrollment(token: string): Promise<Certificate | null> {
  const rows = await db.select()
    .from(authEnrollments)
    .where(eq(authEnrollments.token, token))
    .limit(1)

  const pending = rows[0]
  if (!pending || pending.approved) return null

  const datetime = new Date(pending.requestedAt)
  const geo = { lat: pending.geoLat, lon: pending.geoLon }

  // Math: spacetime → seed → primes → ζ
  const seedData = createSeedData(datetime, geo)

  // Create user
  const userId = randomUUID()
  await db.insert(users).values({
    id: userId,
    displayName: pending.requestedId,
    seed: seedData.seed,
    primesJson: JSON.stringify(seedData.primes),
    zeta: seedData.zeta,
    enrollGeoLat: geo.lat,
    enrollGeoLon: geo.lon,
    enrolledAt: datetime.toISOString(),
    active: true,
  })

  // Mark enrollment approved
  await db.update(authEnrollments)
    .set({ approved: true })
    .where(eq(authEnrollments.token, token))

  return {
    id: userId,
    seed: seedData.seed,
    zeta: seedData.zeta,
    issuedAt: Date.now(),
  }
}

/**
 * List pending enrollments (admin)
 */
export async function listPendingEnrollments() {
  return db.select({
    token: authEnrollments.token,
    requestedId: authEnrollments.requestedId,
    requestedAt: authEnrollments.requestedAt,
  })
    .from(authEnrollments)
    .where(eq(authEnrollments.approved, false))
}
