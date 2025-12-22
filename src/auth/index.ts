// ============================================
// AUTH LAYER
// ============================================
//
// Authentication and authorization for TTRPG.
//
// Uses Clerk for:
//   - User authentication (sign up, sign in, SSO)
//   - Session management
//   - JWT tokens
//   - User metadata
//
// We handle:
//   - Campaign/Party membership
//   - GM vs Player roles
//   - Permission checking
//   - Character ownership
//   - API middleware
//   - WebSocket auth
//

export * from "./types";
export * from "./clerk";
export * from "./permissions";
export * from "./middleware";

// ============================================
// ARCHITECTURE
// ============================================
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                              CLERK                                      │
//  │                                                                         │
//  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
//  │  │  Sign Up  │  │  Sign In  │  │   SSO     │  │  Session  │           │
//  │  │           │  │           │  │  Discord  │  │  Tokens   │           │
//  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘           │
//  │                                                                         │
//  │                         JWT Token                                       │
//  └─────────────────────────────┬───────────────────────────────────────────┘
//                                │
//  ┌─────────────────────────────┼───────────────────────────────────────────┐
//  │                       AUTH LAYER                                        │
//  │                             │                                           │
//  │  ┌──────────────────────────▼──────────────────────────────┐           │
//  │  │                   MIDDLEWARE                             │           │
//  │  │                                                          │           │
//  │  │  1. Extract token from header                           │           │
//  │  │  2. Verify with Clerk                                   │           │
//  │  │  3. Load campaign membership                            │           │
//  │  │  4. Build SessionAuth                                   │           │
//  │  │  5. Create PermissionChecker                            │           │
//  │  │  6. Check required permissions                          │           │
//  │  └──────────────────────────┬──────────────────────────────┘           │
//  │                             │                                           │
//  │  ┌──────────────────────────▼──────────────────────────────┐           │
//  │  │               PERMISSION CHECKER                         │           │
//  │  │                                                          │           │
//  │  │  • hasPermission('npc.edit')                            │           │
//  │  │  • canViewCharacter(ownerId)                            │           │
//  │  │  • canEditCharacter(ownerId)                            │           │
//  │  │  • isGM() / isOwner() / isPlayer()                      │           │
//  │  └──────────────────────────────────────────────────────────┘           │
//  │                                                                         │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// ROLE HIERARCHY
// ============================================
//
//   OWNER
//     │  • Full control of campaign
//     │  • Can delete campaign
//     │  • Can promote/demote anyone
//     ▼
//    GM
//     │  • Run sessions
//     │  • Edit world, NPCs, quests
//     │  • View all secrets
//     │  • Manage economy/factions
//     ▼
//  CO_GM
//     │  • Run sessions
//     │  • View secrets
//     │  • Limited editing
//     ▼
//  PLAYER
//     │  • Play character
//     │  • View public info
//     │  • Manage own character
//     │  • Downtime actions
//     ▼
//  SPECTATOR
//     │  • View only
//     │  • No interaction
//     ▼
//  INVITED
//        • Pending acceptance
//

// ============================================
// PERMISSION EXAMPLES
// ============================================
//
// GM Creating NPC:
//   checker.hasPermission('npc.create')  // true
//
// Player Viewing Own Character:
//   checker.canViewCharacter(userId)     // true
//
// Player Viewing Other Character:
//   checker.canViewCharacter(otherId)    // depends on 'character.view.sheets'
//
// Player Editing Other Character:
//   checker.canEditCharacter(otherId)    // false (unless GM)
//
// Co-GM Viewing Secrets:
//   checker.canViewNPCSecrets()          // true
//
// Player Viewing Secrets:
//   checker.canViewNPCSecrets()          // false
//

// ============================================
// USAGE EXAMPLES
// ============================================
//
// API Route (Next.js style):
//
// ```typescript
// import { createAuthMiddleware } from '@/auth';
//
// const authMiddleware = createAuthMiddleware(
//   clerkService,
//   getMembership,
//   {
//     required: true,
//     requireCampaign: true,
//   }
// );
//
// export async function POST(req: Request) {
//   const result = await authMiddleware({
//     method: 'POST',
//     path: '/api/npc',
//     headers: Object.fromEntries(req.headers),
//     query: {},
//     body: await req.json(),
//   });
//
//   if (!result.success) {
//     return new Response(result.error.message, {
//       status: result.error.statusCode
//     });
//   }
//
//   const { context } = result;
//
//   // Check specific permission
//   context.assertPermission('npc.create');
//
//   // Do the thing
//   const npc = await createNPC(req.body);
//   return Response.json(npc);
// }
// ```
//
// WebSocket:
//
// ```typescript
// import { authenticateWebSocket } from '@/auth';
//
// wss.on('connection', async (ws, req) => {
//   const token = new URL(req.url, 'http://localhost').searchParams.get('token');
//   const campaignId = req.headers['x-campaign-id'];
//
//   const result = await authenticateWebSocket(
//     clerkService,
//     getMembership,
//     { token, campaignId }
//   );
//
//   if (!result.authenticated) {
//     ws.close(4001, result.error);
//     return;
//   }
//
//   // Attach auth to connection
//   ws.auth = result.auth;
//   ws.checker = result.checker;
//
//   ws.on('message', (data) => {
//     // Check permissions per message
//     if (data.type === 'combat.action' && !ws.checker.isGM()) {
//       ws.send({ error: 'Only GM can do that' });
//       return;
//     }
//   });
// });
// ```
//
// tRPC:
//
// ```typescript
// import { TRPCError } from '@trpc/server';
// import { createChecker } from '@/auth';
//
// const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
//   if (!ctx.auth) {
//     throw new TRPCError({ code: 'UNAUTHORIZED' });
//   }
//
//   const checker = createChecker(ctx.auth, ctx.membership);
//
//   return next({
//     ctx: {
//       ...ctx,
//       checker,
//     },
//   });
// });
//
// const gmProcedure = protectedProcedure.use(async ({ ctx, next }) => {
//   if (!ctx.checker.isGM()) {
//     throw new TRPCError({ code: 'FORBIDDEN' });
//   }
//   return next();
// });
// ```
//

// ============================================
// CLERK SETUP
// ============================================
//
// 1. Create Clerk account: https://clerk.com
//
// 2. Get API keys from dashboard
//
// 3. Add to environment:
//    CLERK_PUBLISHABLE_KEY=pk_...
//    CLERK_SECRET_KEY=sk_...
//    CLERK_WEBHOOK_SECRET=whsec_...
//
// 4. Configure social logins (Discord recommended!)
//
// 5. Set up webhook for user sync:
//    - user.created
//    - user.updated
//    - user.deleted
//    - session.ended
//
// 6. Configure metadata:
//    Public metadata: displayName, pronouns
//    Private metadata: stats, preferences
//

// ============================================
// DATABASE TABLES (Turso)
// ============================================
//
// These tables supplement Clerk:
//
// campaign_memberships:
//   id, user_id, campaign_id, role, permissions, status,
//   joined_at, last_active_at, invited_by
//
// party_memberships:
//   id, user_id, party_id, character_id, role, active, joined_at
//
// character_ownership:
//   character_id, owner_id, type, can_edit, can_delete, created_at
//
// campaign_invites:
//   id, campaign_id, code, created_by, expires_at, max_uses,
//   used_count, default_role, active
//
// audit_log:
//   id, user_id, action, entity_type, entity_id, campaign_id,
//   details, ip_address, user_agent, timestamp
//

// ============================================
// FILE SUMMARY
// ============================================
//
// auth/
// ├── types.ts       (300+ lines)
// │   ├── UserProfile
// │   ├── SystemRole / CampaignRole / PartyRole
// │   ├── CampaignMembership / PartyMembership
// │   ├── CharacterOwnership
// │   ├── Permission enum (50+ permissions)
// │   ├── CampaignRolePermissions mapping
// │   ├── SessionAuth
// │   ├── CampaignInvite
// │   └── AuditLogEntry
// │
// ├── clerk.ts       (280+ lines)
// │   ├── ClerkConfig
// │   ├── ClerkUser / ClerkSession
// │   ├── ClerkJWTClaims
// │   ├── Transform functions
// │   ├── ClerkService interface
// │   ├── Webhook events
// │   └── Helper functions
// │
// ├── permissions.ts (380+ lines)
// │   ├── PermissionChecker class
// │   ├── System/Campaign/Entity checks
// │   ├── Assert functions
// │   ├── AuthorizationError
// │   └── Query filters
// │
// ├── middleware.ts  (350+ lines)
// │   ├── AuthenticatedContext
// │   ├── createAuthMiddleware
// │   ├── authenticateWebSocket
// │   ├── Audit logging
// │   ├── Rate limiting
// │   └── Framework helpers
// │
// └── index.ts       (this file)
//     └── Exports and documentation
//
