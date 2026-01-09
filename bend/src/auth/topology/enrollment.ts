/**
 * TOPOLOGY ENROLLMENT
 * ====================
 *
 * Handles the enrollment flow for new users and new devices.
 *
 * Flow:
 * 1. User requests enrollment with geo + datetime
 * 2. Request is stored as pending
 * 3. Another human vouches for them
 * 4. Enrollment is approved, seed + certificate created
 * 5. Certificate is returned to client for storage
 */

import { query, queryOne, queryAll } from '../../db/client';
import {
  createSeed,
  createSeedCommitment,
  computeZeta,
  createZetaCommitment,
  createCertificate,
  serializeCertificate,
  getCertificateHash,
  type GeoLocation,
  type EnrollmentMoment,
} from './math';

// ============================================
// TYPES
// ============================================

export interface EnrollmentRequest {
  id: string;
  requestedUserId: string | null;
  requestedEmail: string | null;
  requestedDisplayName: string | null;
  deviceIdentifier: string;
  enrollmentGeo: GeoLocation | null;
  enrollmentDatetime: Date;
  vouchedBy: string | null;
  vouchedAt: Date | null;
  status: 'pending' | 'vouched' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  existingSeedId: string | null;
  resultSeedId: string | null;
  resultCertificateId: string | null;
}

export interface TopologySeed {
  id: string;
  userId: string;
  seedCommitment: string;
  zetaCommitment: string;
  isActive: boolean;
  createdAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

export interface TopologyCertificate {
  id: string;
  seedId: string;
  deviceIdentifier: string;
  certificateHash: string;
  enrolledAt: Date;
  enrolledBy: string | null;
  enrollmentGeo: GeoLocation | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

// ============================================
// ENROLLMENT REQUEST
// ============================================

/** Default expiration for enrollment requests (24 hours) */
const ENROLLMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Request a new enrollment.
 *
 * For new users: provide email + displayName
 * For new device on existing user: provide userId + existingSeedId
 */
export async function requestEnrollment(input: {
  email?: string;
  displayName?: string;
  userId?: string;
  existingSeedId?: string;
  deviceIdentifier: string;
  geo: GeoLocation;
}): Promise<{ requestId: string; expiresAt: Date }> {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ENROLLMENT_EXPIRY_MS);

  await query(
    `INSERT INTO topology_enrollment_requests (
      id, requested_user_id, requested_email, requested_display_name,
      device_identifier, enrollment_geo, enrollment_datetime,
      status, created_at, expires_at, existing_seed_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId || null,
      input.email || null,
      input.displayName || null,
      input.deviceIdentifier,
      JSON.stringify(input.geo),
      now.toISOString(),
      'pending',
      now.toISOString(),
      expiresAt.toISOString(),
      input.existingSeedId || null,
    ],
  );

  return { requestId: id, expiresAt };
}

/**
 * Get an enrollment request by ID.
 */
export async function getEnrollmentRequest(
  requestId: string,
): Promise<EnrollmentRequest | null> {
  // Note: libsql returns camelCase column names
  const row = await queryOne<{
    id: string;
    requestedUserId: string | null;
    requestedEmail: string | null;
    requestedDisplayName: string | null;
    deviceIdentifier: string;
    enrollmentGeo: string | null;
    enrollmentDatetime: string;
    vouchedBy: string | null;
    vouchedAt: string | null;
    status: string;
    createdAt: string;
    expiresAt: string;
    existingSeedId: string | null;
    resultSeedId: string | null;
    resultCertificateId: string | null;
  }>(`SELECT * FROM topology_enrollment_requests WHERE id = ?`, [requestId]);

  if (!row) return null;

  return {
    id: row.id,
    requestedUserId: row.requestedUserId,
    requestedEmail: row.requestedEmail,
    requestedDisplayName: row.requestedDisplayName,
    deviceIdentifier: row.deviceIdentifier,
    enrollmentGeo: row.enrollmentGeo ? JSON.parse(row.enrollmentGeo) : null,
    enrollmentDatetime: new Date(row.enrollmentDatetime),
    vouchedBy: row.vouchedBy,
    vouchedAt: row.vouchedAt ? new Date(row.vouchedAt) : null,
    status: row.status as EnrollmentRequest['status'],
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt),
    existingSeedId: row.existingSeedId,
    resultSeedId: row.resultSeedId,
    resultCertificateId: row.resultCertificateId,
  };
}

/**
 * Get all pending enrollment requests.
 */
export async function getPendingEnrollments(): Promise<EnrollmentRequest[]> {
  const rows = await queryAll<{
    id: string;
    requested_user_id: string | null;
    requested_email: string | null;
    requested_display_name: string | null;
    device_identifier: string;
    enrollment_geo: string | null;
    enrollment_datetime: string;
    vouched_by: string | null;
    vouched_at: string | null;
    status: string;
    created_at: string;
    expires_at: string;
    existing_seed_id: string | null;
    result_seed_id: string | null;
    result_certificate_id: string | null;
  }>(
    `SELECT * FROM topology_enrollment_requests
     WHERE status IN ('pending', 'vouched')
     AND expires_at > ?
     ORDER BY created_at DESC`,
    [new Date().toISOString()],
  );

  return rows.map((row) => ({
    id: row.id,
    requestedUserId: row.requested_user_id,
    requestedEmail: row.requested_email,
    requestedDisplayName: row.requested_display_name,
    deviceIdentifier: row.device_identifier,
    enrollmentGeo: row.enrollment_geo ? JSON.parse(row.enrollment_geo) : null,
    enrollmentDatetime: new Date(row.enrollment_datetime),
    vouchedBy: row.vouched_by,
    vouchedAt: row.vouched_at ? new Date(row.vouched_at) : null,
    status: row.status as EnrollmentRequest['status'],
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    existingSeedId: row.existing_seed_id,
    resultSeedId: row.result_seed_id,
    resultCertificateId: row.result_certificate_id,
  }));
}

// ============================================
// VOUCHING (HUMAN VERIFICATION)
// ============================================

/**
 * Vouch for an enrollment request.
 * This is the human verification step.
 */
export async function vouchEnrollment(
  requestId: string,
  voucherId: string,
): Promise<void> {
  const request = await getEnrollmentRequest(requestId);

  if (!request) {
    throw new Error('Enrollment request not found');
  }

  if (request.status !== 'pending') {
    throw new Error(`Cannot vouch for request with status: ${request.status}`);
  }

  if (new Date() > request.expiresAt) {
    throw new Error('Enrollment request has expired');
  }

  // Cannot vouch for yourself (unless bootstrap mode)
  if (request.requestedUserId === voucherId) {
    throw new Error('Cannot vouch for your own enrollment');
  }

  await query(
    `UPDATE topology_enrollment_requests
     SET vouched_by = ?, vouched_at = ?, status = 'vouched'
     WHERE id = ?`,
    [voucherId, new Date().toISOString(), requestId],
  );
}

/**
 * Bootstrap enrollment - auto-vouch for first user or dev mode.
 * This bypasses the human verification requirement.
 *
 * Use cases:
 * - First user in the system (no one to vouch)
 * - Development/testing
 */
export async function bootstrapEnrollment(
  requestId: string,
): Promise<{ userId: string; seedId: string; certificateId: string; certificate: string }> {
  const request = await getEnrollmentRequest(requestId);

  if (!request) {
    throw new Error('Enrollment request not found');
  }

  if (request.status === 'approved') {
    throw new Error('Already approved');
  }

  if (request.status === 'rejected') {
    throw new Error('Request was rejected');
  }

  if (new Date() > request.expiresAt) {
    throw new Error('Enrollment request has expired');
  }

  // Check if this is the first user (bootstrap allowed)
  const existingSeeds = await queryAll<{ id: string }>(
    'SELECT id FROM topology_seeds LIMIT 1',
    [],
  );

  const isFirstUser = existingSeeds.length === 0;
  const isDevMode = process.env.NODE_ENV === 'development';

  if (!isFirstUser && !isDevMode) {
    throw new Error('Bootstrap only allowed for first user or in dev mode');
  }

  // Auto-vouch - set vouched_by to NULL (no human voucher for bootstrap)
  // We use a special status marker instead
  await query(
    `UPDATE topology_enrollment_requests
     SET vouched_by = NULL, vouched_at = ?, status = 'vouched'
     WHERE id = ?`,
    [new Date().toISOString(), requestId],
  );

  // Now approve it
  return approveEnrollment(requestId);
}

// ============================================
// APPROVAL (CREATE SEED + CERTIFICATE)
// ============================================

/**
 * Approve a vouched enrollment request.
 * Creates the seed (if new user) and certificate.
 *
 * Returns the serialized certificate for the client.
 */
export async function approveEnrollment(requestId: string): Promise<{
  userId: string;
  seedId: string;
  certificateId: string;
  certificate: string;
}> {
  const request = await getEnrollmentRequest(requestId);

  if (!request) {
    throw new Error('Enrollment request not found');
  }

  if (request.status !== 'vouched') {
    throw new Error(`Cannot approve request with status: ${request.status}`);
  }

  if (new Date() > request.expiresAt) {
    throw new Error('Enrollment request has expired');
  }

  const now = new Date();
  let userId = request.requestedUserId;
  let seedId = request.existingSeedId;

  // If new user, create user record first
  if (!userId) {
    userId = crypto.randomUUID();
    await query(
      `INSERT INTO users (id, email, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        request.requestedEmail || '',
        request.requestedDisplayName || null,
        now.toISOString(),
        now.toISOString(),
      ],
    );
  }

  // Create enrollment moment for seed generation
  const moment: EnrollmentMoment = {
    datetime: request.enrollmentDatetime,
    geo: request.enrollmentGeo || { lat: 0, lon: 0 },
  };

  // Generate seed from enrollment moment
  const seed = createSeed(moment);
  const seedCommitment = createSeedCommitment(seed);
  const zeta = computeZeta(seed);
  const zetaCommitment = createZetaCommitment(zeta);

  // If new user (no existing seed), create seed
  if (!seedId) {
    seedId = crypto.randomUUID();
    await query(
      `INSERT INTO topology_seeds (
        id, user_id, seed_commitment, zeta_commitment,
        is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [seedId, userId, seedCommitment, zetaCommitment, 1, now.toISOString()],
    );
  }

  // Create certificate
  const cert = createCertificate(seed, request.deviceIdentifier, now);
  const certHash = getCertificateHash(cert);
  const certId = crypto.randomUUID();

  // enrolled_by should be null if it's a bootstrap (vouchedBy is null) or not a real user
  const enrolledBy = request.vouchedBy;

  await query(
    `INSERT INTO topology_certificates (
      id, seed_id, device_identifier, certificate_hash,
      enrolled_at, enrolled_by, enrollment_geo, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      certId,
      seedId,
      request.deviceIdentifier,
      certHash,
      now.toISOString(),
      enrolledBy,
      JSON.stringify(request.enrollmentGeo),
      1,
    ],
  );

  // Update enrollment request with results
  await query(
    `UPDATE topology_enrollment_requests
     SET status = 'approved', result_seed_id = ?, result_certificate_id = ?
     WHERE id = ?`,
    [seedId, certId, requestId],
  );

  // Serialize certificate for client
  const serializedCert = serializeCertificate(cert);

  return {
    userId,
    seedId,
    certificateId: certId,
    certificate: serializedCert,
  };
}

// ============================================
// REJECTION
// ============================================

/**
 * Reject an enrollment request.
 */
export async function rejectEnrollment(requestId: string): Promise<void> {
  await query(
    `UPDATE topology_enrollment_requests SET status = 'rejected' WHERE id = ?`,
    [requestId],
  );
}

// ============================================
// SEED & CERTIFICATE QUERIES
// ============================================

/**
 * Get a seed by ID.
 */
export async function getSeed(seedId: string): Promise<TopologySeed | null> {
  // Note: libsql returns camelCase column names
  const row = await queryOne<{
    id: string;
    userId: string;
    seedCommitment: string;
    zetaCommitment: string;
    isActive: number;
    createdAt: string;
    revokedAt: string | null;
    revokedBy: string | null;
    revokeReason: string | null;
  }>(`SELECT * FROM topology_seeds WHERE id = ?`, [seedId]);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    seedCommitment: row.seedCommitment,
    zetaCommitment: row.zetaCommitment,
    isActive: row.isActive === 1,
    createdAt: new Date(row.createdAt),
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
    revokedBy: row.revokedBy,
    revokeReason: row.revokeReason,
  };
}

/**
 * Get a seed by user ID.
 */
export async function getSeedByUserId(
  userId: string,
): Promise<TopologySeed | null> {
  // Note: libsql returns camelCase column names
  const row = await queryOne<{
    id: string;
    userId: string;
    seedCommitment: string;
    zetaCommitment: string;
    isActive: number;
    createdAt: string;
    revokedAt: string | null;
    revokedBy: string | null;
    revokeReason: string | null;
  }>(`SELECT * FROM topology_seeds WHERE user_id = ? AND is_active = 1`, [
    userId,
  ]);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    seedCommitment: row.seedCommitment,
    zetaCommitment: row.zetaCommitment,
    isActive: row.isActive === 1,
    createdAt: new Date(row.createdAt),
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
    revokedBy: row.revokedBy,
    revokeReason: row.revokeReason,
  };
}

/**
 * Get a certificate by hash.
 */
export async function getCertificateByHash(
  hash: string,
): Promise<TopologyCertificate | null> {
  // Note: libsql returns camelCase column names
  const row = await queryOne<{
    id: string;
    seedId: string;
    deviceIdentifier: string;
    certificateHash: string;
    enrolledAt: string;
    enrolledBy: string | null;
    enrollmentGeo: string | null;
    isActive: number;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }>(
    `SELECT * FROM topology_certificates WHERE certificate_hash = ? AND is_active = 1`,
    [hash],
  );

  if (!row) return null;

  return {
    id: row.id,
    seedId: row.seedId,
    deviceIdentifier: row.deviceIdentifier,
    certificateHash: row.certificateHash,
    enrolledAt: new Date(row.enrolledAt),
    enrolledBy: row.enrolledBy,
    enrollmentGeo: row.enrollmentGeo ? JSON.parse(row.enrollmentGeo) : null,
    isActive: row.isActive === 1,
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
  };
}

/**
 * Get all certificates for a seed.
 */
export async function getCertificatesForSeed(
  seedId: string,
): Promise<TopologyCertificate[]> {
  // Note: libsql returns camelCase column names
  const rows = await queryAll<{
    id: string;
    seedId: string;
    deviceIdentifier: string;
    certificateHash: string;
    enrolledAt: string;
    enrolledBy: string | null;
    enrollmentGeo: string | null;
    isActive: number;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }>(`SELECT * FROM topology_certificates WHERE seed_id = ?`, [seedId]);

  return rows.map((row) => ({
    id: row.id,
    seedId: row.seedId,
    deviceIdentifier: row.deviceIdentifier,
    certificateHash: row.certificateHash,
    enrolledAt: new Date(row.enrolledAt),
    enrolledBy: row.enrolledBy,
    enrollmentGeo: row.enrollmentGeo ? JSON.parse(row.enrollmentGeo) : null,
    isActive: row.isActive === 1,
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
  }));
}

/**
 * Update certificate last used time.
 */
export async function touchCertificate(certificateId: string): Promise<void> {
  await query(
    `UPDATE topology_certificates SET last_used_at = ? WHERE id = ?`,
    [new Date().toISOString(), certificateId],
  );
}
