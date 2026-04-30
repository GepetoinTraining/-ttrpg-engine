/**
 * VERIFY.TS - Challenge-Response Auth (Turso-backed)
 * Generate challenge → client computes M^n → verify trajectory
 */

import { db } from '@/db/connection'
import { authChallenges, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { computeTrajectory } from './math/matrix'
import { getUserZeta } from './seed'
import { randomUUID } from 'crypto'

const CHALLENGE_TTL_MS = 30000 // 30 seconds

/**
 * Generate a challenge for a user
 */
export async function generateChallenge(userId: string): Promise<{
  challengeId: string
  n: number
} | null> {
  const zeta = await getUserZeta(userId)
  if (zeta === null) return null

  // Random exponent between 10 and 1000
  const n = Math.floor(Math.random() * 990) + 10

  // Server computes expected trajectory
  const expectedTrajectory = computeTrajectory(zeta, n)

  const challengeId = randomUUID()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()

  await db.insert(authChallenges).values({
    id: challengeId,
    userId,
    n,
    expectedTrajectory,
    createdAt: now,
    expiresAt,
  })

  return { challengeId, n }
}

/**
 * Verify a challenge response
 */
export async function verifyChallenge(
  challengeId: string,
  clientTrajectory: string
): Promise<{ valid: boolean; userId?: string }> {
  const rows = await db.select()
    .from(authChallenges)
    .where(eq(authChallenges.id, challengeId))
    .limit(1)

  const challenge = rows[0]
  if (!challenge) return { valid: false }

  // Check expiry
  if (new Date(challenge.expiresAt) < new Date()) {
    await db.delete(authChallenges).where(eq(authChallenges.id, challengeId))
    return { valid: false }
  }

  // THE MOMENT OF TRUTH
  const valid = clientTrajectory === challenge.expectedTrajectory

  // Clean up used challenge
  await db.delete(authChallenges).where(eq(authChallenges.id, challengeId))

  if (valid) {
    // Update last auth timestamp
    await db.update(users)
      .set({ lastAuthAt: new Date().toISOString() })
      .where(eq(users.id, challenge.userId))

    return { valid: true, userId: challenge.userId }
  }

  return { valid: false }
}
