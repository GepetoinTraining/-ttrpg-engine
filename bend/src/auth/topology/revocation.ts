/**
 * TOPOLOGY REVOCATION
 * ====================
 *
 * Handles revocation of seeds and certificates.
 *
 * When a seed is revoked:
 * 1. All certificates for that seed are revoked
 * 2. Characters are kicked from campaign parties
 * 3. Characters remain in world timeline (can play solo)
 */

import { query, queryAll } from '../../db/client';
import { getSeed, getCertificatesForSeed } from './enrollment';

// ============================================
// SEED REVOCATION
// ============================================

/**
 * Revoke a seed and all its certificates.
 * This kicks the player from all campaigns but preserves their characters.
 */
export async function revokeSeed(
  seedId: string,
  revokerId: string,
  reason: string,
): Promise<{
  revokedCertificates: number;
  kickedCharacters: string[];
}> {
  const now = new Date().toISOString();

  // Get seed to find user
  const seed = await getSeed(seedId);
  if (!seed) {
    throw new Error('Seed not found');
  }

  if (!seed.isActive) {
    throw new Error('Seed already revoked');
  }

  // 1. Mark seed as revoked
  await query(
    `UPDATE topology_seeds
     SET is_active = 0, revoked_at = ?, revoked_by = ?, revoke_reason = ?
     WHERE id = ?`,
    [now, revokerId, reason, seedId],
  );

  // 2. Revoke all certificates for this seed
  const certs = await getCertificatesForSeed(seedId);
  for (const cert of certs) {
    await query(
      `UPDATE topology_certificates SET is_active = 0, revoked_at = ? WHERE id = ?`,
      [now, cert.id],
    );
  }

  // 3. Get characters owned by this seed
  const characters = await queryAll<{ id: string; name: string }>(
    `SELECT id, name FROM characters WHERE owner_seed_id = ?`,
    [seedId],
  );

  const kickedCharacterIds: string[] = [];

  // 4. Kick characters from all campaign parties
  for (const char of characters) {
    // Remove from party memberships (but don't delete the character)
    await query(
      `UPDATE party_memberships
       SET active = 0, left_at = ?
       WHERE character_id = ? AND active = 1`,
      [now, char.id],
    );

    kickedCharacterIds.push(char.id);

    // TODO: Emit real-time event for character kicked
    // await emitCharacterKicked(char.id, reason);
  }

  return {
    revokedCertificates: certs.length,
    kickedCharacters: kickedCharacterIds,
  };
}

// ============================================
// CERTIFICATE REVOCATION
// ============================================

/**
 * Revoke a single certificate.
 * This invalidates one device but keeps the seed active.
 */
export async function revokeCertificate(certificateId: string): Promise<void> {
  const now = new Date().toISOString();

  await query(
    `UPDATE topology_certificates SET is_active = 0, revoked_at = ? WHERE id = ?`,
    [now, certificateId],
  );
}

// ============================================
// QUERIES
// ============================================

/**
 * Check if a user's seed is revoked.
 */
export async function isUserRevoked(userId: string): Promise<boolean> {
  const rows = await queryAll<{ is_active: number }>(
    `SELECT is_active FROM topology_seeds WHERE user_id = ?`,
    [userId],
  );

  if (rows.length === 0) {
    return true; // No seed = effectively revoked
  }

  return rows[0].is_active === 0;
}

/**
 * Get revocation info for a seed.
 */
export async function getRevocationInfo(seedId: string): Promise<{
  isRevoked: boolean;
  revokedAt: Date | null;
  revokedBy: string | null;
  reason: string | null;
} | null> {
  const seed = await getSeed(seedId);
  if (!seed) {
    return null;
  }

  return {
    isRevoked: !seed.isActive,
    revokedAt: seed.revokedAt,
    revokedBy: seed.revokedBy,
    reason: seed.revokeReason,
  };
}

/**
 * Get all revoked seeds (for admin).
 */
export async function getRevokedSeeds(): Promise<
  Array<{
    seedId: string;
    userId: string;
    revokedAt: Date;
    revokedBy: string | null;
    reason: string | null;
  }>
> {
  const rows = await queryAll<{
    id: string;
    user_id: string;
    revoked_at: string;
    revoked_by: string | null;
    revoke_reason: string | null;
  }>(
    `SELECT id, user_id, revoked_at, revoked_by, revoke_reason
     FROM topology_seeds
     WHERE is_active = 0
     ORDER BY revoked_at DESC`,
    [],
  );

  return rows.map((row) => ({
    seedId: row.id,
    userId: row.user_id,
    revokedAt: new Date(row.revoked_at),
    revokedBy: row.revoked_by,
    reason: row.revoke_reason,
  }));
}
