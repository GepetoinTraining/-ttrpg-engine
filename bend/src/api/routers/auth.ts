/**
 * AUTH ROUTER
 * ============
 *
 * Handles topology-first authentication:
 * - Enrollment requests
 * - Human vouching
 * - Challenge/response authentication
 * - Seed and certificate management
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import {
  requestEnrollment,
  getEnrollmentRequest,
  getPendingEnrollments,
  vouchEnrollment,
  approveEnrollment,
  rejectEnrollment,
  bootstrapEnrollment,
  getSeed,
  getSeedByUserId,
  getCertificatesForSeed,
} from '../../auth/topology/enrollment';
import type { GeoLocation } from '../../auth/topology/math';
import {
  createChallenge,
  verifyChallenge,
} from '../../auth/topology/challenge';
import {
  revokeSeed,
  revokeCertificate,
  getRevokedSeeds,
} from '../../auth/topology/revocation';

// ============================================
// SCHEMAS
// ============================================

const GeoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

// ============================================
// AUTH ROUTER
// ============================================

export const authRouter = router({
  // ============================================
  // ENROLLMENT
  // ============================================

  /**
   * Request enrollment (new user or new device).
   * This starts the enrollment process - a human must vouch before completion.
   */
  requestEnrollment: publicProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        displayName: z.string().min(1).max(100).optional(),
        userId: z.string().uuid().optional(),
        existingSeedId: z.string().uuid().optional(),
        deviceIdentifier: z.string().min(1).max(255),
        geo: GeoLocationSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const result = await requestEnrollment({
        email: input.email,
        displayName: input.displayName,
        userId: input.userId,
        existingSeedId: input.existingSeedId,
        deviceIdentifier: input.deviceIdentifier,
        geo: input.geo as GeoLocation,
      });

      return {
        requestId: result.requestId,
        expiresAt: result.expiresAt.toISOString(),
        message: 'Enrollment requested. Waiting for human verification.',
      };
    }),

  /**
   * Get an enrollment request by ID.
   */
  getEnrollmentRequest: publicProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .query(async ({ input }) => {
      const request = await getEnrollmentRequest(input.requestId);
      if (!request) {
        return null;
      }

      return {
        id: request.id,
        status: request.status,
        email: request.requestedEmail,
        displayName: request.requestedDisplayName,
        createdAt: request.createdAt.toISOString(),
        expiresAt: request.expiresAt.toISOString(),
        vouchedBy: request.vouchedBy,
        vouchedAt: request.vouchedAt?.toISOString(),
      };
    }),

  /**
   * Get enrollment status for polling.
   * Returns certificate and user info when approved.
   */
  getEnrollmentStatus: publicProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .query(async ({ input }) => {
      const request = await getEnrollmentRequest(input.requestId);
      if (!request) {
        return { status: 'not_found' as const };
      }

      // If still pending or just vouched, return status only
      if (request.status === 'pending') {
        return {
          status: 'pending' as const,
          expiresAt: request.expiresAt.toISOString(),
        };
      }

      if (request.status === 'rejected') {
        return { status: 'rejected' as const };
      }

      if (request.status === 'expired') {
        return { status: 'expired' as const };
      }

      // If vouched, auto-approve and return certificate
      if (request.status === 'vouched' || request.status === 'approved') {
        try {
          const result = await approveEnrollment(input.requestId);
          const { getUser } = await import('../../db/queries/users');
          const user = await getUser(result.userId);

          return {
            status: 'approved' as const,
            certificate: result.certificate,
            user: user ? {
              id: user.id,
              email: user.email,
              displayName: user.displayName || undefined,
              imageUrl: user.imageUrl || undefined,
            } : undefined,
          };
        } catch (error) {
          // Already approved, get existing info
          const { getUser } = await import('../../db/queries/users');
          const { getSeedByUserId, getCertificatesForSeed } = await import('../../auth/topology/enrollment');
          const { serializeCertificate, createCertificate } = await import('../../auth/topology/math');

          if (request.requestedUserId) {
            const user = await getUser(request.requestedUserId);
            const seed = user ? await getSeedByUserId(user.id) : null;
            const certs = seed ? await getCertificatesForSeed(seed.id) : [];
            const latestCert = certs.find(c => c.isActive);

            if (user && seed && latestCert) {
              // Recreate certificate from stored data
              const cert = createCertificate(
                seed.seedCommitment,
                latestCert.deviceIdentifier,
                new Date(latestCert.enrolledAt)
              );
              return {
                status: 'approved' as const,
                certificate: serializeCertificate(cert),
                user: {
                  id: user.id,
                  email: user.email,
                  displayName: user.displayName || undefined,
                  imageUrl: user.imageUrl || undefined,
                },
              };
            }
          }

          return { status: 'approved' as const };
        }
      }

      return { status: request.status as 'pending' | 'approved' | 'rejected' | 'expired' };
    }),

  /**
   * Get all pending enrollment requests.
   * Only authenticated users can see pending enrollments.
   */
  getPendingEnrollments: protectedProcedure.query(async () => {
    const requests = await getPendingEnrollments();

    return requests.map((r) => ({
      id: r.id,
      email: r.requestedEmail,
      displayName: r.requestedDisplayName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      isNewDevice: !!r.existingSeedId,
    }));
  }),

  /**
   * Vouch for an enrollment request.
   * This is the human verification step.
   */
  vouchEnrollment: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await vouchEnrollment(input.requestId, ctx.auth.userId);

      return {
        success: true,
        message: 'Enrollment vouched. User can now complete enrollment.',
      };
    }),

  /**
   * Approve a vouched enrollment.
   * This creates the seed and certificate.
   */
  approveEnrollment: publicProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const result = await approveEnrollment(input.requestId);

      return {
        userId: result.userId,
        seedId: result.seedId,
        certificateId: result.certificateId,
        certificate: result.certificate,
        message: 'Enrollment complete. Store your certificate securely.',
      };
    }),

  /**
   * Reject an enrollment request.
   */
  rejectEnrollment: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await rejectEnrollment(input.requestId);

      return {
        success: true,
        message: 'Enrollment rejected.',
      };
    }),

  /**
   * Bootstrap enrollment - auto-approve for first user or dev mode.
   * Bypasses human verification requirement.
   */
  bootstrapEnrollment: publicProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const result = await bootstrapEnrollment(input.requestId);

      return {
        userId: result.userId,
        seedId: result.seedId,
        certificateId: result.certificateId,
        certificate: result.certificate,
        message: 'Bootstrap complete. Welcome, first user!',
      };
    }),

  // ============================================
  // CHALLENGE/RESPONSE
  // ============================================

  /**
   * Request a challenge for authentication.
   * The client must compute the trajectory and submit it.
   */
  requestChallenge: publicProcedure
    .input(z.object({ certificateHash: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await createChallenge(input.certificateHash);

      return {
        challengeId: result.challengeId,
        n: result.n,
        message: 'Compute M^n and submit the trajectory.',
      };
    }),

  /**
   * Verify a challenge response.
   */
  verifyChallenge: publicProcedure
    .input(
      z.object({
        challengeId: z.string().uuid(),
        trajectory: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await verifyChallenge(input.challengeId, input.trajectory);

      if (!result.valid) {
        return {
          valid: false,
          error: result.error,
        };
      }

      return {
        valid: true,
        userId: result.userId,
        message: 'Authentication successful.',
      };
    }),

  // ============================================
  // SEED & CERTIFICATE MANAGEMENT
  // ============================================

  /**
   * Get current user's seed info.
   */
  getMySeed: protectedProcedure.query(async ({ ctx }) => {
    const seed = await getSeedByUserId(ctx.auth.userId);
    if (!seed) {
      return null;
    }

    const certs = await getCertificatesForSeed(seed.id);

    return {
      id: seed.id,
      isActive: seed.isActive,
      createdAt: seed.createdAt.toISOString(),
      certificates: certs.map((c) => ({
        id: c.id,
        deviceIdentifier: c.deviceIdentifier,
        isActive: c.isActive,
        enrolledAt: c.enrolledAt.toISOString(),
        lastUsedAt: c.lastUsedAt?.toISOString(),
      })),
    };
  }),

  /**
   * Get a seed by ID (admin only).
   */
  getSeed: protectedProcedure
    .input(z.object({ seedId: z.string().uuid() }))
    .query(async ({ input }) => {
      const seed = await getSeed(input.seedId);
      if (!seed) {
        return null;
      }

      return {
        id: seed.id,
        userId: seed.userId,
        isActive: seed.isActive,
        createdAt: seed.createdAt.toISOString(),
        revokedAt: seed.revokedAt?.toISOString(),
        revokeReason: seed.revokeReason,
      };
    }),

  // ============================================
  // REVOCATION
  // ============================================

  /**
   * Revoke a seed (admin only).
   * This kicks the user from all campaigns.
   */
  revokeSeed: protectedProcedure
    .input(
      z.object({
        seedId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Add admin check
      const result = await revokeSeed(
        input.seedId,
        ctx.auth.userId,
        input.reason,
      );

      return {
        success: true,
        revokedCertificates: result.revokedCertificates,
        kickedCharacters: result.kickedCharacters.length,
        message: 'Seed revoked. User has been kicked from all campaigns.',
      };
    }),

  /**
   * Revoke a single certificate.
   * This invalidates one device.
   */
  revokeCertificate: protectedProcedure
    .input(z.object({ certificateId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await revokeCertificate(input.certificateId);

      return {
        success: true,
        message: 'Certificate revoked.',
      };
    }),

  /**
   * Get all revoked seeds (admin only).
   */
  getRevokedSeeds: protectedProcedure.query(async () => {
    const seeds = await getRevokedSeeds();

    return seeds.map((s) => ({
      seedId: s.seedId,
      userId: s.userId,
      revokedAt: s.revokedAt.toISOString(),
      revokedBy: s.revokedBy,
      reason: s.reason,
    }));
  }),

  // ============================================
  // CURRENT USER
  // ============================================

  /**
   * Get current authenticated user info.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      userId: ctx.auth.userId,
      email: ctx.auth.email,
      displayName: ctx.auth.displayName,
      systemRole: ctx.auth.systemRole,
    };
  }),
});
