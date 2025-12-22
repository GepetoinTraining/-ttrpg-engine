import { z } from "zod";
import type {
  SessionAuth,
  Permission,
  CampaignMembership,
  AuditLogEntry,
} from "./types";
import type { ClerkJWTClaims, ClerkService } from "./clerk";
import {
  PermissionChecker,
  AuthorizationError,
  AuthenticationError,
  createChecker,
} from "./permissions";
import {
  claimsToSessionAuth,
  extractBearerToken,
  isTokenExpired,
} from "./clerk";

// ============================================
// AUTH MIDDLEWARE
// ============================================
//
// Middleware for:
//   - HTTP API routes
//   - WebSocket connections
//   - Server actions
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
  clerkService: ClerkService,
  getMembership: (
    userId: string,
    campaignId: string,
  ) => Promise<CampaignMembership | null>,
  options: Partial<AuthMiddlewareOptions> = {},
) {
  const opts = AuthMiddlewareOptionsSchema.parse(options);

  return async (request: RequestContext): Promise<MiddlewareResult> => {
    // Extract token
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      if (opts.required) {
        return {
          success: false,
          error: new AuthenticationError("No authorization token provided"),
        };
      }
      // Continue without auth
      return {
        success: true,
        context: createGuestContext(),
      };
    }

    // Verify token
    const claims = await clerkService.verifyToken(token);

    if (!claims) {
      return {
        success: false,
        error: new AuthenticationError("Invalid token"),
      };
    }

    if (isTokenExpired(claims)) {
      return {
        success: false,
        error: new AuthenticationError("Token expired"),
      };
    }

    // Get campaign context
    let membership: CampaignMembership | null = null;
    const campaignId =
      request.headers["x-campaign-id"] || request.query.campaignId;

    if (campaignId) {
      membership = await getMembership(claims.sub, campaignId);

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

    // Build session auth
    const auth = claimsToSessionAuth(
      claims,
      membership
        ? {
            campaignId: membership.campaignId,
            campaignName: "", // Would be fetched
            role: membership.role,
            permissions: [], // Would be computed
          }
        : undefined,
    );

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
 * Authenticate WebSocket connection
 */
export async function authenticateWebSocket(
  clerkService: ClerkService,
  getMembership: (
    userId: string,
    campaignId: string,
  ) => Promise<CampaignMembership | null>,
  params: {
    token: string;
    campaignId?: string;
  },
): Promise<WebSocketAuthResult> {
  const { token, campaignId } = params;

  // Verify token
  const claims = await clerkService.verifyToken(token);

  if (!claims) {
    return { authenticated: false, error: "Invalid token" };
  }

  if (isTokenExpired(claims)) {
    return { authenticated: false, error: "Token expired" };
  }

  // Get membership if campaign specified
  let membership: CampaignMembership | null = null;
  if (campaignId) {
    membership = await getMembership(claims.sub, campaignId);
  }

  const auth = claimsToSessionAuth(
    claims,
    membership
      ? {
          campaignId: membership.campaignId,
          campaignName: "",
          role: membership.role,
          permissions: [],
        }
      : undefined,
  );

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
