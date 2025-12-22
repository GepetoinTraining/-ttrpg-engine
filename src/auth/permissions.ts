import { z } from "zod";
import type {
  Permission,
  CampaignRole,
  CampaignMembership,
  SessionAuth,
  CharacterOwnership,
} from "./types";
import { CampaignRolePermissions } from "./types";

// ============================================
// PERMISSION CHECKING
// ============================================
//
// The actual logic for "can user X do action Y?"
//
// Three levels:
//   1. System-level (admin, moderator)
//   2. Campaign-level (owner, gm, player)
//   3. Entity-level (owns character, created NPC)
//

// ============================================
// PERMISSION CHECK RESULT
// ============================================

export const PermissionCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),

  // What would grant this permission
  requiredRole: z.string().optional(),
  requiredPermission: z.string().optional(),

  // Audit
  checkedAt: z.date(),
  checkedBy: z.string(),
});
export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;

// ============================================
// PERMISSION CHECKER
// ============================================

export class PermissionChecker {
  private auth: SessionAuth;
  private membership: CampaignMembership | null;

  constructor(auth: SessionAuth, membership: CampaignMembership | null = null) {
    this.auth = auth;
    this.membership = membership;
  }

  // ==========================================
  // SYSTEM-LEVEL CHECKS
  // ==========================================

  /**
   * Is this user a platform admin?
   */
  isAdmin(): boolean {
    return this.auth.systemRole === "admin";
  }

  /**
   * Is this user a moderator?
   */
  isModerator(): boolean {
    return this.auth.systemRole === "moderator" || this.isAdmin();
  }

  /**
   * Is this user a premium subscriber?
   */
  isPremium(): boolean {
    return this.auth.systemRole === "premium" || this.isAdmin();
  }

  // ==========================================
  // CAMPAIGN-LEVEL CHECKS
  // ==========================================

  /**
   * Get the user's role in the current campaign
   */
  getCampaignRole(): CampaignRole | null {
    return this.membership?.role || this.auth.campaignContext?.role || null;
  }

  /**
   * Is this user the campaign owner?
   */
  isOwner(): boolean {
    return this.getCampaignRole() === "owner";
  }

  /**
   * Is this user a GM (owner, gm, or co_gm)?
   */
  isGM(): boolean {
    const role = this.getCampaignRole();
    return role === "owner" || role === "gm" || role === "co_gm";
  }

  /**
   * Is this user a player (not spectator or invited)?
   */
  isPlayer(): boolean {
    const role = this.getCampaignRole();
    return role === "player" || this.isGM();
  }

  /**
   * Is this user a member of the campaign?
   */
  isMember(): boolean {
    const role = this.getCampaignRole();
    return role !== null && role !== "invited";
  }

  // ==========================================
  // PERMISSION CHECKS
  // ==========================================

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: Permission): boolean {
    // Admins have all permissions
    if (this.isAdmin()) return true;

    // Check campaign context
    const role = this.getCampaignRole();
    if (!role) return false;

    // Check role permissions
    const rolePerms = CampaignRolePermissions[role];
    if (rolePerms.includes(permission)) return true;

    // Check custom permissions on membership
    if (this.membership?.permissions) {
      // Map permission to custom permission field
      const customCheck = this.checkCustomPermission(permission);
      if (customCheck !== null) return customCheck;
    }

    return false;
  }

  /**
   * Check custom permissions override
   */
  private checkCustomPermission(permission: Permission): boolean | null {
    if (!this.membership?.permissions) return null;

    const perms = this.membership.permissions;

    // Map permissions to custom fields
    switch (permission) {
      case "world.edit":
        return perms.canEditWorld ?? null;
      case "npc.edit":
      case "npc.create":
        return perms.canEditNPCs ?? null;
      case "quest.edit":
      case "quest.create":
        return perms.canEditQuests ?? null;
      case "session.run":
        return perms.canRunSessions ?? null;
      case "campaign.invite":
        return perms.canInvitePlayers ?? null;
      case "campaign.kick":
        return perms.canKickPlayers ?? null;
      case "session.notes.view":
      case "world.secrets.view":
        return perms.canViewGMNotes ?? null;
      case "economy.edit":
        return perms.canEditEconomy ?? null;
      case "faction.edit":
        return perms.canEditFactions ?? null;
      default:
        return null;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  /**
   * Full permission check with result object
   */
  check(permission: Permission): PermissionCheckResult {
    const allowed = this.hasPermission(permission);

    return {
      allowed,
      reason: allowed ? undefined : `Missing permission: ${permission}`,
      requiredPermission: permission,
      requiredRole: this.findRequiredRole(permission),
      checkedAt: new Date(),
      checkedBy: this.auth.userId,
    };
  }

  /**
   * Find minimum role required for permission
   */
  private findRequiredRole(permission: Permission): string | undefined {
    const roles: CampaignRole[] = [
      "spectator",
      "player",
      "co_gm",
      "gm",
      "owner",
    ];

    for (const role of roles) {
      if (CampaignRolePermissions[role].includes(permission)) {
        return role;
      }
    }

    return undefined;
  }

  // ==========================================
  // ENTITY-LEVEL CHECKS
  // ==========================================

  /**
   * Can user view this character?
   */
  canViewCharacter(characterOwnerId: string): boolean {
    // GM can view all
    if (this.isGM()) return true;
    if (this.hasPermission("character.view.all")) return true;

    // Players can view their own
    if (characterOwnerId === this.auth.userId) {
      return this.hasPermission("character.view.own");
    }

    // Players can view party members' sheets (usually)
    if (this.hasPermission("character.view.sheets")) return true;

    return false;
  }

  /**
   * Can user edit this character?
   */
  canEditCharacter(characterOwnerId: string): boolean {
    // GM can edit all
    if (this.isGM()) return true;
    if (this.hasPermission("character.edit.all")) return true;

    // Players can edit their own
    if (characterOwnerId === this.auth.userId) {
      return this.hasPermission("character.edit.own");
    }

    return false;
  }

  /**
   * Can user view NPC stats (HP, AC, etc)?
   */
  canViewNPCStats(): boolean {
    return this.hasPermission("npc.view.stats");
  }

  /**
   * Can user view NPC secrets?
   */
  canViewNPCSecrets(): boolean {
    return this.hasPermission("npc.view.secrets");
  }

  /**
   * Can user view quest secrets?
   */
  canViewQuestSecrets(): boolean {
    return this.hasPermission("quest.view.secrets");
  }

  /**
   * Can user view faction secrets?
   */
  canViewFactionSecrets(): boolean {
    return this.hasPermission("faction.view.secrets");
  }

  /**
   * Can user view monster stats in combat?
   */
  canViewMonsterStats(): boolean {
    return this.hasPermission("combat.monster.stats");
  }

  /**
   * Can user run a session?
   */
  canRunSession(): boolean {
    return this.hasPermission("session.run");
  }

  /**
   * Can user invite players?
   */
  canInvite(): boolean {
    return this.hasPermission("campaign.invite");
  }

  /**
   * Can user kick players?
   */
  canKick(targetRole: CampaignRole): boolean {
    if (!this.hasPermission("campaign.kick")) return false;

    // Can't kick higher roles
    const roleHierarchy: CampaignRole[] = [
      "invited",
      "spectator",
      "player",
      "co_gm",
      "gm",
      "owner",
    ];
    const myRoleIndex = roleHierarchy.indexOf(
      this.getCampaignRole() || "invited",
    );
    const targetRoleIndex = roleHierarchy.indexOf(targetRole);

    return myRoleIndex > targetRoleIndex;
  }
}

// ============================================
// AUTHORIZATION DECORATORS
// ============================================
//
// For use with API routes
//

export type AuthContext = {
  auth: SessionAuth;
  membership: CampaignMembership | null;
  checker: PermissionChecker;
};

/**
 * Create permission checker from context
 */
export function createChecker(
  auth: SessionAuth,
  membership: CampaignMembership | null = null,
): PermissionChecker {
  return new PermissionChecker(auth, membership);
}

/**
 * Assert permission or throw
 */
export function assertPermission(
  checker: PermissionChecker,
  permission: Permission,
  message?: string,
): void {
  if (!checker.hasPermission(permission)) {
    throw new AuthorizationError(
      message || `Missing permission: ${permission}`,
      permission,
    );
  }
}

/**
 * Assert any of permissions or throw
 */
export function assertAnyPermission(
  checker: PermissionChecker,
  permissions: Permission[],
  message?: string,
): void {
  if (!checker.hasAnyPermission(permissions)) {
    throw new AuthorizationError(
      message || `Missing permissions: ${permissions.join(" or ")}`,
      permissions[0],
    );
  }
}

/**
 * Assert all permissions or throw
 */
export function assertAllPermissions(
  checker: PermissionChecker,
  permissions: Permission[],
  message?: string,
): void {
  const missing = permissions.filter((p) => !checker.hasPermission(p));
  if (missing.length > 0) {
    throw new AuthorizationError(
      message || `Missing permissions: ${missing.join(", ")}`,
      missing[0],
    );
  }
}

/**
 * Assert user is GM or throw
 */
export function assertGM(checker: PermissionChecker, message?: string): void {
  if (!checker.isGM()) {
    throw new AuthorizationError(
      message || "GM access required",
      "session.run",
    );
  }
}

/**
 * Assert user can view character or throw
 */
export function assertCanViewCharacter(
  checker: PermissionChecker,
  characterOwnerId: string,
  message?: string,
): void {
  if (!checker.canViewCharacter(characterOwnerId)) {
    throw new AuthorizationError(
      message || "Cannot view this character",
      "character.view.own",
    );
  }
}

/**
 * Assert user can edit character or throw
 */
export function assertCanEditCharacter(
  checker: PermissionChecker,
  characterOwnerId: string,
  message?: string,
): void {
  if (!checker.canEditCharacter(characterOwnerId)) {
    throw new AuthorizationError(
      message || "Cannot edit this character",
      "character.edit.own",
    );
  }
}

// ============================================
// AUTHORIZATION ERROR
// ============================================

export class AuthorizationError extends Error {
  public readonly permission: Permission;
  public readonly statusCode = 403;

  constructor(message: string, permission: Permission) {
    super(message);
    this.name = "AuthorizationError";
    this.permission = permission;
  }
}

export class AuthenticationError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// ============================================
// QUERY FILTERS
// ============================================
//
// Generate database query filters based on permissions
//

export interface QueryFilter {
  where: Record<string, any>;
  select?: Record<string, boolean>;
}

/**
 * Get character query filter based on permissions
 */
export function getCharacterQueryFilter(
  checker: PermissionChecker,
  userId: string,
): QueryFilter {
  // GM sees all
  if (checker.isGM()) {
    return { where: {} };
  }

  // Players see own + party members
  if (checker.hasPermission("character.view.sheets")) {
    return {
      where: {
        OR: [{ ownerId: userId }, { party: { members: { some: { userId } } } }],
      },
    };
  }

  // Otherwise just own
  return { where: { ownerId: userId } };
}

/**
 * Get NPC query filter based on permissions
 */
export function getNPCQueryFilter(checker: PermissionChecker): QueryFilter {
  const canViewSecrets = checker.canViewNPCSecrets();
  const canViewStats = checker.canViewNPCStats();

  return {
    where: {}, // All NPCs visible
    select: {
      id: true,
      name: true,
      description: true,
      appearance: true,
      // Only select if permitted
      ...(canViewStats && { stats: true, hp: true, ac: true }),
      ...(canViewSecrets && { secrets: true, notes: true }),
    },
  };
}

/**
 * Get quest query filter based on permissions
 */
export function getQuestQueryFilter(checker: PermissionChecker): QueryFilter {
  const canViewSecrets = checker.canViewQuestSecrets();

  return {
    where: {},
    select: {
      id: true,
      name: true,
      description: true,
      objectives: true,
      status: true,
      ...(canViewSecrets && {
        secrets: true,
        hiddenObjectives: true,
        gmNotes: true,
      }),
    },
  };
}

/**
 * Get combat query filter based on permissions
 */
export function getCombatQueryFilter(checker: PermissionChecker): QueryFilter {
  const canViewMonsterStats = checker.canViewMonsterStats();

  // For combatants array
  return {
    where: {},
    select: {
      id: true,
      name: true,
      position: true,
      conditions: true,
      // Only GMs see full stats
      ...(canViewMonsterStats && {
        hp: true,
        maxHp: true,
        ac: true,
        actions: true,
      }),
      // Players see their own stats always
    },
  };
}
