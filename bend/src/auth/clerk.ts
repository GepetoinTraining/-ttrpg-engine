import { z } from "zod";
import { createClerkClient } from "@clerk/backend";
import type {
  UserProfile,
  SessionAuth,
  CampaignRole,
  CampaignRolePermissions,
  Permission,
  SystemRole,
} from "./types";

// ============================================
// CLERK CLIENT
// ============================================

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || "",
});

// ============================================
// JWT VERIFICATION
// ============================================

/**
 * Verify Clerk JWT token and extract claims
 */
export async function verifyClerkJWT(
  token: string
): Promise<ClerkJWTClaims | null> {
  try {
    // Use Clerk's backend SDK to verify the token
    const { payload } = await clerkClient.verifyToken(token);

    // Parse and validate the claims
    const claims = ClerkJWTClaimsSchema.safeParse({
      sub: payload.sub,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      nbf: payload.nbf,
      azp: payload.azp,
      sid: payload.sid,
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      picture: payload.picture,
      metadata: payload.metadata,
    });

    if (!claims.success) {
      console.warn("[Clerk] Invalid JWT claims:", claims.error);
      return null;
    }

    return claims.data;
  } catch (error) {
    console.error("[Clerk] JWT verification failed:", error);
    return null;
  }
}

// ============================================
// CLERK INTEGRATION
// ============================================
//
// Clerk handles:
//   - User authentication
//   - Session tokens
//   - User metadata
//   - Organizations (optional)
//
// We integrate by:
//   - Validating Clerk JWT tokens
//   - Extending user with our metadata
//   - Building session context
//

// ============================================
// CLERK CONFIG
// ============================================

export const ClerkConfigSchema = z.object({
  // Clerk publishable key (client-side)
  publishableKey: z.string(),

  // Clerk secret key (server-side)
  secretKey: z.string(),

  // JWT verification
  jwtKey: z.string().optional(),

  // Webhook secret (for sync events)
  webhookSecret: z.string().optional(),

  // Domain config
  domain: z.string().optional(),

  // Feature flags
  features: z
    .object({
      organizations: z.boolean().default(false), // Use Clerk orgs for game groups
      magicLinks: z.boolean().default(true),
      socialLogin: z.boolean().default(true),
      mfa: z.boolean().default(false),
    })
    .optional(),
});
export type ClerkConfig = z.infer<typeof ClerkConfigSchema>;

// ============================================
// CLERK USER (from Clerk SDK)
// ============================================

export const ClerkUserSchema = z.object({
  id: z.string(),

  // Primary email
  primaryEmailAddressId: z.string().optional(),
  emailAddresses: z
    .array(
      z.object({
        id: z.string(),
        emailAddress: z.string().email(),
        verification: z
          .object({
            status: z.string(),
          })
          .optional(),
      }),
    )
    .default([]),

  // Primary phone
  primaryPhoneNumberId: z.string().optional(),
  phoneNumbers: z
    .array(
      z.object({
        id: z.string(),
        phoneNumber: z.string(),
      }),
    )
    .default([]),

  // Profile
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  imageUrl: z.string().optional(),

  // Metadata (where we store our stuff)
  publicMetadata: z.record(z.string(), z.any()).default({}),
  privateMetadata: z.record(z.string(), z.any()).default({}),
  unsafeMetadata: z.record(z.string(), z.any()).default({}),

  // Timestamps
  createdAt: z.number(), // Unix timestamp
  updatedAt: z.number(),
  lastSignInAt: z.number().nullable().optional(),

  // Status
  banned: z.boolean().default(false),
  locked: z.boolean().default(false),
});
export type ClerkUser = z.infer<typeof ClerkUserSchema>;

// ============================================
// CLERK SESSION (from Clerk SDK)
// ============================================

export const ClerkSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),

  status: z.enum(["active", "ended", "expired", "abandoned", "revoked"]),

  // Timestamps
  createdAt: z.number(),
  updatedAt: z.number(),
  lastActiveAt: z.number(),
  expireAt: z.number(),
  abandonAt: z.number(),
});
export type ClerkSession = z.infer<typeof ClerkSessionSchema>;

// ============================================
// JWT CLAIMS (from Clerk JWT)
// ============================================

export const ClerkJWTClaimsSchema = z.object({
  // Standard claims
  sub: z.string(), // User ID
  iss: z.string(), // Issuer
  aud: z.string().or(z.array(z.string())).optional(),
  exp: z.number(), // Expiration
  iat: z.number(), // Issued at
  nbf: z.number().optional(), // Not before

  // Clerk-specific
  azp: z.string().optional(), // Authorized party
  sid: z.string().optional(), // Session ID

  // User info
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  picture: z.string().optional(),

  // Our custom claims (set via Clerk dashboard or webhook)
  metadata: z
    .object({
      systemRole: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});
export type ClerkJWTClaims = z.infer<typeof ClerkJWTClaimsSchema>;

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

/**
 * Transform Clerk user to our UserProfile
 */
export function clerkUserToProfile(clerkUser: ClerkUser): UserProfile {
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  );

  const metadata = clerkUser.publicMetadata as any;

  return {
    id: clerkUser.id,
    email:
      primaryEmail?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      "",
    username: clerkUser.username || undefined,
    firstName: clerkUser.firstName || undefined,
    lastName: clerkUser.lastName || undefined,
    imageUrl: clerkUser.imageUrl,
    metadata: {
      displayName:
        metadata?.displayName ||
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        undefined,
      pronouns: metadata?.pronouns,
      timezone: metadata?.timezone,
      joinedAt: new Date(clerkUser.createdAt),
      lastActiveAt: clerkUser.lastSignInAt
        ? new Date(clerkUser.lastSignInAt)
        : undefined,
      preferences: metadata?.preferences,
      stats: metadata?.stats || {
        campaignsGMed: 0,
        campaignsPlayed: 0,
        charactersCreated: 0,
        sessionsPlayed: 0,
      },
    },
  };
}

/**
 * Transform JWT claims to SessionAuth
 */
export function claimsToSessionAuth(
  claims: ClerkJWTClaims,
  campaignContext?: SessionAuth["campaignContext"],
): SessionAuth {
  return {
    userId: claims.sub,
    email: claims.email || "",
    displayName: claims.name || claims.given_name || undefined,
    imageUrl: claims.picture,
    systemRole: (claims.metadata?.systemRole as SystemRole) || "user",
    campaignContext,
    sessionId: claims.sid || claims.sub,
    issuedAt: new Date(claims.iat * 1000),
    expiresAt: new Date(claims.exp * 1000),
  };
}

// ============================================
// CLERK SERVICE INTERFACE
// ============================================
//
// Abstract interface so we can mock in tests
//

export interface ClerkService {
  // Verify JWT token
  verifyToken(token: string): Promise<ClerkJWTClaims | null>;

  // Get user by ID
  getUser(userId: string): Promise<ClerkUser | null>;

  // Get current user from request
  getCurrentUser(): Promise<ClerkUser | null>;

  // Update user metadata
  updateUserMetadata(
    userId: string,
    metadata: {
      public?: Record<string, any>;
      private?: Record<string, any>;
    },
  ): Promise<void>;

  // Get session
  getSession(sessionId: string): Promise<ClerkSession | null>;

  // Revoke session
  revokeSession(sessionId: string): Promise<void>;

  // Create sign-in ticket (for custom flows)
  createSignInTicket(userId: string): Promise<string>;
}

// ============================================
// CLERK WEBHOOK EVENTS
// ============================================

export const ClerkWebhookEventSchema = z.discriminatedUnion("type", [
  // User events
  z.object({
    type: z.literal("user.created"),
    data: ClerkUserSchema,
  }),
  z.object({
    type: z.literal("user.updated"),
    data: ClerkUserSchema,
  }),
  z.object({
    type: z.literal("user.deleted"),
    data: z.object({ id: z.string(), deleted: z.boolean() }),
  }),

  // Session events
  z.object({
    type: z.literal("session.created"),
    data: ClerkSessionSchema,
  }),
  z.object({
    type: z.literal("session.ended"),
    data: ClerkSessionSchema,
  }),
  z.object({
    type: z.literal("session.revoked"),
    data: ClerkSessionSchema,
  }),

  // Organization events (if using Clerk orgs)
  z.object({
    type: z.literal("organization.created"),
    data: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("organizationMembership.created"),
    data: z.object({
      id: z.string(),
      organization: z.object({ id: z.string() }),
      publicUserData: z.object({ userId: z.string() }),
      role: z.string(),
    }),
  }),
]);
export type ClerkWebhookEvent = z.infer<typeof ClerkWebhookEventSchema>;

// ============================================
// WEBHOOK HANDLERS
// ============================================

export interface ClerkWebhookHandler {
  // Handle user created
  onUserCreated(user: ClerkUser): Promise<void>;

  // Handle user updated
  onUserUpdated(user: ClerkUser): Promise<void>;

  // Handle user deleted
  onUserDeleted(userId: string): Promise<void>;

  // Handle session ended
  onSessionEnded(session: ClerkSession): Promise<void>;
}

/**
 * Default webhook handler implementation
 */
export const defaultWebhookHandler: ClerkWebhookHandler = {
  async onUserCreated(user) {
    // Create user profile in our database
    console.log(`[Clerk] User created: ${user.id}`);
    // TODO: Insert into users table
  },

  async onUserUpdated(user) {
    // Sync user profile
    console.log(`[Clerk] User updated: ${user.id}`);
    // TODO: Update users table
  },

  async onUserDeleted(userId) {
    // Handle user deletion
    console.log(`[Clerk] User deleted: ${userId}`);
    // TODO: Soft delete or anonymize user data
  },

  async onSessionEnded(session) {
    // Clean up any real-time connections
    console.log(`[Clerk] Session ended: ${session.id}`);
    // TODO: Disconnect WebSocket, clean up presence
  },
};

// ============================================
// CLERK MIDDLEWARE HELPERS
// ============================================

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(claims: ClerkJWTClaims): boolean {
  return claims.exp * 1000 < Date.now();
}

/**
 * Get time until token expires
 */
export function getTokenTTL(claims: ClerkJWTClaims): number {
  return Math.max(0, claims.exp * 1000 - Date.now());
}

// ============================================
// SOCIAL PROVIDERS
// ============================================

export const SocialProviderSchema = z.enum([
  "google",
  "discord", // Great for TTRPG communities
  "github",
  "twitch", // Actual play streams
  "apple",
]);
export type SocialProvider = z.infer<typeof SocialProviderSchema>;

export const SocialConnectionSchema = z.object({
  provider: SocialProviderSchema,
  providerId: z.string(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  imageUrl: z.string().optional(),
  connectedAt: z.date(),
});
export type SocialConnection = z.infer<typeof SocialConnectionSchema>;
