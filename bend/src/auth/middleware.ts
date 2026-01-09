import { z } from "zod";
import type {
  SessionAuth,
  Permission,
  CampaignMembership,
  AuditLogEntry,
} from "./types";
import {
  PermissionChecker,
  AuthorizationError,
  AuthenticationError,
  createChecker,
} from "./permissions";
import { verifyTopologyAuthQuick } from "./topology/verify";

// ============================================
// AUTH MIDDLEWARE
// ============================================
//
// Middleware for:
//   - HTTP API routes
//   - WebSocket connections
//   - Server actions
//
// Uses Topology-First Authentication:
//   - No bearer tokens
//   - Challenge/response based on M^n trajectory
//   - Certificate + trajectory verification
//

// ============================================
// MIDDLEWARE CONTEXT
// ============================================

export interface AuthenticatedContext {
  auth: SessionAuth;
  membership: CampaignMembership | null;
  checker: PermissionChecker;

  // Helper functions
  assertPermission: (permission: Permission) => void;
  assertGM: () => void;
  assertCanEditCharacter: (ownerId: string) => void;
}

export interface RequestContext {
  // Request info
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body?: any;

  // IP and user agent
  ip?: string;
  userAgent?: string;
}

// ============================================
// TOPOLOGY AUTH HEADERS
// ============================================

export interface TopologyAuthHeaders {
  certificateHash?: string;
}

/**
 * Extract topology auth headers from request
 */
export function extractTopologyHeaders(
  headers: Record<string, string | undefined>
): TopologyAuthHeaders {
  return {
    certificateHash: headers["x-topology-cert"],
  };
}

// ============================================
// MIDDLEWARE OPTIONS
// ============================================

export const AuthMiddlewareOptionsSchema = z.object({
  // Require authentication?
  required: z.boolean().default(true),

  // Required permissions
  permissions: z.array(z.string()).optional(),

  // All or any?
  permissionMode: z.enum(["all", "any"]).default("all"),

  // Require campaign context?
  requireCampaign: z.boolean().default(false),

  // Require GM role?
  requireGM: z.boolean().default(false),

  // Require owner role?
  requireOwner: z.boolean().default(false),

  // Audit this request?
  audit: z.boolean().default(false),

  // Rate limiting
  rateLimit: z
    .object({
      enabled: z.boolean().default(false),
      maxRequests: z.number().int().default(100),
      windowMs: z.number().int().default(60000), // 1 minute
    })
    .optional(),
});
export type AuthMiddlewareOptions = z.infer<typeof AuthMiddlewareOptionsSchema>;

// ============================================
// MIDDLEWARE RESULT
// ============================================

export type MiddlewareResult =
  | { success: true; context: AuthenticatedContext }
  | { success: false; error: AuthenticationError | AuthorizationError };

// ============================================
// CREATE AUTH MIDDLEWARE
// ============================================

export function createAuthMiddleware(
  getMembership: (
    userId: string,
    campaignId: string,
  ) => Promise<CampaignMembership | null>,
  options: Partial<AuthMiddlewareOptions> = {},
) {
  const opts = AuthMiddlewareOptionsSchema.parse(options);

  return async (request: RequestContext): Promise<MiddlewareResult> => {
    // Extract topology auth headers
    const topologyHeaders = extractTopologyHeaders(request.headers);

    if (!topologyHeaders.certificateHash) {
      if (opts.required) {
        return {
          success: false,
          error: new AuthenticationError("No topology certificate provided"),
        };
      }
      // Continue without auth
      return {
        success: true,
        context: createGuestContext(),
      };
    }

    // Verify topology auth (quick path using certificate hash)
    const auth = await verifyTopologyAuthQuick(
      topologyHeaders.certificateHash
    );

    if (!auth) {
      return {
        success: false,
        error: new AuthenticationError("Invalid topology certificate"),
      };
    }

    // Get campaign context
    let membership: CampaignMembership | null = null;
    const campaignId =
      request.headers["x-campaign-id"] || request.query.campaignId;

    if (campaignId) {
      membership = await getMembership(auth.userId, campaignId);

      if (opts.requireCampaign && !membership) {
        return {
          success: false,
          error: new AuthorizationError(
            "Not a member of this campaign",
            "campaign.view",
          ),
        };
      }
    } else if (opts.requireCampaign) {
      return {
        success: false,
        error: new AuthorizationError(
          "Campaign context required",
          "campaign.view",
        ),
      };
    }

    // Create permission checker
    const checker = createChecker(auth, membership);

    // Check GM requirement
    if (opts.requireGM && !checker.isGM()) {
      return {
        success: false,
        error: new AuthorizationError("GM access required", "session.run"),
      };
    }

    // Check owner requirement
    if (opts.requireOwner && !checker.isOwner()) {
      return {
        success: false,
        error: new AuthorizationError(
          "Owner access required",
          "campaign.delete",
        ),
      };
    }

    // Check permissions
    if (opts.permissions && opts.permissions.length > 0) {
      const perms = opts.permissions as Permission[];

      if (opts.permissionMode === "all") {
        const missing = perms.filter((p) => !checker.hasPermission(p));
        if (missing.length > 0) {
          return {
            success: false,
            error: new AuthorizationError(
              `Missing permissions: ${missing.join(", ")}`,
              missing[0],
            ),
          };
        }
      } else {
        if (!checker.hasAnyPermission(perms)) {
          return {
            success: false,
            error: new AuthorizationError(
              `Requires one of: ${perms.join(", ")}`,
              perms[0],
            ),
          };
        }
      }
    }

    // Build context
    const context: AuthenticatedContext = {
      auth,
      membership,
      checker,
      assertPermission: (permission: Permission) => {
        if (!checker.hasPermission(permission)) {
          throw new AuthorizationError(
            `Missing permission: ${permission}`,
            permission,
          );
        }
      },
      assertGM: () => {
        if (!checker.isGM()) {
          throw new AuthorizationError("GM access required", "session.run");
        }
      },
      assertCanEditCharacter: (ownerId: string) => {
        if (!checker.canEditCharacter(ownerId)) {
          throw new AuthorizationError(
            "Cannot edit this character",
            "character.edit.own",
          );
        }
      },
    };

    return { success: true, context };
  };
}

/**
 * Create guest context for unauthenticated requests
 */
function createGuestContext(): AuthenticatedContext {
  const guestAuth: SessionAuth = {
    userId: "guest",
    email: "",
    systemRole: "user",
    sessionId: "guest",
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  const checker = createChecker(guestAuth, null);

  return {
    auth: guestAuth,
    membership: null,
    checker,
    assertPermission: () => {
      throw new AuthenticationError("Authentication required");
    },
    assertGM: () => {
      throw new AuthenticationError("Authentication required");
    },
    assertCanEditCharacter: () => {
      throw new AuthenticationError("Authentication required");
    },
  };
}

// ============================================
// WEBSOCKET AUTH
// ============================================

export interface WebSocketAuthResult {
  authenticated: boolean;
  auth?: SessionAuth;
  membership?: CampaignMembership;
  checker?: PermissionChecker;
  error?: string;
}

/**
 * Authenticate WebSocket connection using topology auth
 */
export async function authenticateWebSocket(
  getMembership: (
    userId: string,
    campaignId: string,
  ) => Promise<CampaignMembership | null>,
  params: {
    certificateHash: string;
    campaignId?: string;
  },
): Promise<WebSocketAuthResult> {
  const { certificateHash, campaignId } = params;

  // Verify topology auth
  const auth = await verifyTopologyAuthQuick(certificateHash);

  if (!auth) {
    return { authenticated: false, error: "Invalid topology certificate" };
  }

  // Get membership if campaign specified
  let membership: CampaignMembership | null = null;
  if (campaignId) {
    membership = await getMembership(auth.userId, campaignId);
  }

  const checker = createChecker(auth, membership);

  return {
    authenticated: true,
    auth,
    membership: membership || undefined,
    checker,
  };
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLogger {
  log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void>;
}

/**
 * Create audit middleware
 */
export function createAuditMiddleware(logger: AuditLogger) {
  return async (
    context: AuthenticatedContext,
    request: RequestContext,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, any>,
  ): Promise<void> => {
    await logger.log({
      userId: context.auth.userId,
      userEmail: context.auth.email,
      action,
      entityType,
      entityId,
      campaignId: context.membership?.campaignId,
      details,
      ipAddress: request.ip,
      userAgent: request.userAgent,
    });
  };
}

// ============================================
// RATE LIMITING
// ============================================

export interface RateLimiter {
  check(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }>;

  increment(key: string): Promise<void>;
}

/**
 * Simple in-memory rate limiter
 */
export function createInMemoryRateLimiter(
  maxRequests: number = 100,
  windowMs: number = 60000,
): RateLimiter {
  const store = new Map<string, { count: number; resetAt: number }>();

  return {
    async check(key: string) {
      const now = Date.now();
      const record = store.get(key);

      if (!record || record.resetAt < now) {
        return {
          allowed: true,
          remaining: maxRequests,
          resetAt: new Date(now + windowMs),
        };
      }

      return {
        allowed: record.count < maxRequests,
        remaining: Math.max(0, maxRequests - record.count),
        resetAt: new Date(record.resetAt),
      };
    },

    async increment(key: string) {
      const now = Date.now();
      const record = store.get(key);

      if (!record || record.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        record.count++;
      }
    },
  };
}

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(
  limiter: RateLimiter,
  getKey: (context: AuthenticatedContext) => string = (ctx) => ctx.auth.userId,
) {
  return async (
    context: AuthenticatedContext,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> => {
    const key = getKey(context);
    const result = await limiter.check(key);

    if (result.allowed) {
      await limiter.increment(key);
    }

    return result;
  };
}

// ============================================
// HELPER TYPES FOR FRAMEWORKS
// ============================================

/**
 * For Next.js API routes
 */
export type NextAuthMiddleware = (
  handler: (req: any, res: any, context: AuthenticatedContext) => Promise<void>,
) => (req: any, res: any) => Promise<void>;

/**
 * For Express
 */
export type ExpressAuthMiddleware = (
  req: any,
  res: any,
  next: (err?: any) => void,
) => Promise<void>;

/**
 * For tRPC
 */
export type TRPCAuthMiddleware = {
  auth: SessionAuth;
  membership: CampaignMembership | null;
  checker: PermissionChecker;
};
