import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type {
  SessionAuth,
  CampaignMembership,
  Permission,
} from "../auth/types";
import { PermissionChecker, createChecker } from "../auth/permissions";
import {
  verifyTopologyAuth,
  verifyTopologyAuthQuick,
} from "../auth/topology";

// ============================================
// tRPC SETUP
// ============================================
//
// Type-safe API layer connecting frontend to backend.
//
// Features:
//   - Full TypeScript inference
//   - Auth context on every request
//   - Permission checking middleware
//   - Input validation with Zod
//

// ============================================
// CONTEXT
// ============================================

export interface Context {
  // Auth (null if unauthenticated)
  auth: SessionAuth | null;

  // Campaign membership (null if not in campaign context)
  membership: CampaignMembership | null;

  // Permission checker
  checker: PermissionChecker | null;

  // Request info
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthenticatedContext extends Context {
  auth: SessionAuth;
  checker: PermissionChecker;
}

export interface CampaignContext extends AuthenticatedContext {
  membership: CampaignMembership;
  campaignId: string;
}

// ============================================
// CONTEXT CREATOR
// ============================================

export interface CreateContextOptions {
  // Topology auth (new)
  certificateHash?: string;
  challengeId?: string;
  trajectory?: string;

  getMembership: (
    userId: string,
    campaignId: string,
  ) => Promise<CampaignMembership | null>;
  campaignId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

export async function createContext(
  opts: CreateContextOptions,
): Promise<Context> {
  const {
    certificateHash,
    challengeId,
    trajectory,
    getMembership,
    campaignId,
    requestId,
    ip,
    userAgent,
  } = opts;

  // No auth credentials provided
  if (!certificateHash) {
    return {
      auth: null,
      membership: null,
      checker: null,
      requestId: requestId || crypto.randomUUID(),
      ip,
      userAgent,
    };
  }

  // Verify topology auth
  let auth: SessionAuth | null = null;

  if (challengeId && trajectory) {
    // Full challenge/response verification
    auth = await verifyTopologyAuth(certificateHash, challengeId, trajectory);
  } else {
    // Quick verification using certificate hash only
    // (for subsequent requests after initial challenge/response)
    auth = await verifyTopologyAuthQuick(certificateHash);
  }

  if (!auth) {
    return {
      auth: null,
      membership: null,
      checker: null,
      requestId: requestId || crypto.randomUUID(),
      ip,
      userAgent,
    };
  }

  // Get membership if campaign specified
  let membership: CampaignMembership | null = null;
  if (campaignId) {
    membership = await getMembership(auth.userId, campaignId);
  }

  // Build checker
  const checker = createChecker(auth, membership);

  return {
    auth,
    membership,
    checker,
    requestId: requestId || crypto.randomUUID(),
    ip,
    userAgent,
  };
}

// ============================================
// tRPC INITIALIZATION
// ============================================

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Add custom error data here
      },
    };
  },
});

// ============================================
// EXPORTS
// ============================================

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

// ============================================
// AUTH MIDDLEWARE
// ============================================

const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      checker: ctx.checker!,
    } as AuthenticatedContext,
  });
});

const hasCampaignContext = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  if (!ctx.membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Campaign context required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      membership: ctx.membership,
      checker: ctx.checker!,
      campaignId: ctx.membership.campaignId,
    } as CampaignContext,
  });
});

const isGM = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  if (!ctx.checker?.isGM()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "GM access required",
    });
  }

  return next({
    ctx: ctx as CampaignContext,
  });
});

const isOwner = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  if (!ctx.checker?.isOwner()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Campaign owner access required",
    });
  }

  return next({
    ctx: ctx as CampaignContext,
  });
});

// ============================================
// PROTECTED PROCEDURES
// ============================================

/**
 * Requires authentication
 */
export const protectedProcedure = publicProcedure.use(isAuthenticated);

/**
 * Requires authentication + campaign membership
 */
export const campaignProcedure = publicProcedure.use(hasCampaignContext);

/**
 * Requires GM role in campaign
 */
export const gmProcedure = publicProcedure.use(hasCampaignContext).use(isGM);

/**
 * Requires campaign owner
 */
export const ownerProcedure = publicProcedure
  .use(hasCampaignContext)
  .use(isOwner);

// ============================================
// PERMISSION MIDDLEWARE FACTORY
// ============================================

/**
 * Create middleware that checks for specific permission
 */
export function requirePermission(permission: Permission) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.auth) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    if (!ctx.checker?.hasPermission(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Create middleware that checks for any of permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.auth) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    if (!ctx.checker?.hasAnyPermission(permissions)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of: ${permissions.join(", ")}`,
      });
    }

    return next({ ctx });
  });
}

// ============================================
// ERROR HELPERS
// ============================================

export function notFound(entity: string, id: string): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `${entity} not found: ${id}`,
  });
}

export function forbidden(message: string = "Access denied"): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message,
  });
}

export function badRequest(message: string): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message,
  });
}

export function conflict(message: string): never {
  throw new TRPCError({
    code: "CONFLICT",
    message,
  });
}

// ============================================
// COMMON INPUT SCHEMAS
// ============================================

export const PaginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const IdInput = z.object({
  id: z.string().uuid(),
});

export const CampaignIdInput = z.object({
  campaignId: z.string().uuid(),
});

export const SearchInput = z.object({
  query: z.string().min(1).max(100),
  ...PaginationInput.shape,
});
