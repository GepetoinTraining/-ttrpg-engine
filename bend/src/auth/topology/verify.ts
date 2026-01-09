/**
 * TOPOLOGY VERIFICATION
 * ======================
 *
 * Main entry point for topology authentication.
 * Replaces Clerk's verifyClerkJWT.
 */

import type { SessionAuth } from '../types';
import { getUser } from '../../db/queries/users';
import { verifyChallenge } from './challenge';
import { getSeed, touchCertificate } from './enrollment';

// ============================================
// MAIN VERIFICATION FUNCTION
// ============================================

/**
 * Verify topology authentication.
 * Replaces verifyClerkJWT from the Clerk integration.
 *
 * @param certificateHash - Hash of the client's certificate
 * @param challengeId - The challenge ID from createChallenge
 * @param trajectory - The client's computed trajectory
 * @returns SessionAuth if valid, null otherwise
 */
export async function verifyTopologyAuth(
  _certificateHash: string,
  challengeId: string,
  trajectory: string,
): Promise<SessionAuth | null> {
  // Verify the challenge response
  const result = await verifyChallenge(challengeId, trajectory);

  if (!result.valid || !result.userId) {
    return null;
  }

  // Get user from database
  const user = await getUser(result.userId);
  if (!user) {
    return null;
  }

  // Build SessionAuth (compatible with existing permission system)
  return topologyToSessionAuth(user, result.seedId!, result.certificateId!);
}

/**
 * Transform topology auth result to SessionAuth.
 * Replaces claimsToSessionAuth from Clerk integration.
 */
export function topologyToSessionAuth(
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    imageUrl?: string | null;
    systemRole?: string | null;
  },
  seedId: string,
  certificateId: string,
): SessionAuth {
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName || undefined,
    imageUrl: user.imageUrl || undefined,
    // Topology auth fields
    seedId,
    certificateId,
    systemRole: (user.systemRole as SessionAuth['systemRole']) || 'user',
    // Campaign context is added later by middleware
    campaignContext: undefined,
    // Session info
    sessionId: certificateId, // Use certificate ID as session ID
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour session
  };
}

// ============================================
// QUICK VERIFICATION (NO CHALLENGE)
// ============================================

/**
 * Quick verification using certificate hash only.
 * Used for subsequent requests after initial challenge/response.
 *
 * This is a session-like optimization where we trust the certificate
 * for a short time after successful challenge/response.
 *
 * In production, you might want to:
 * 1. Cache successful verifications with TTL
 * 2. Require periodic re-challenge
 * 3. Use the certificate hash as a session token
 */
export async function verifyTopologyAuthQuick(
  certificateHash: string,
): Promise<SessionAuth | null> {
  // Get certificate info from database
  const { getCertificateByHash } = await import('./enrollment');
  const cert = await getCertificateByHash(certificateHash);

  if (!cert || !cert.isActive) {
    return null;
  }

  // Get seed
  const seed = await getSeed(cert.seedId);
  if (!seed || !seed.isActive) {
    return null;
  }

  // Get user
  const user = await getUser(seed.userId);
  if (!user) {
    return null;
  }

  // Update last used
  await touchCertificate(cert.id);

  return topologyToSessionAuth(user, seed.id, cert.id);
}
