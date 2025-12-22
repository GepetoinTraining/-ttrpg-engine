import { z } from "zod";

// ============================================
// AUTH LAYER - TYPES
// ============================================
//
// WHO can do WHAT in the system.
//
// Hierarchy:
//   User (Clerk-managed)
//     └── CampaignMembership (role in campaign)
//           └── PartyMembership (role in party)
//                 └── CharacterOwnership
//
// Clerk handles:
//   - Authentication (sign up, sign in, SSO)
//   - Session management
//   - User profiles
//   - Organizations (optional, for game groups)
//
// We handle:
//   - Campaign/Party membership
//   - GM vs Player roles
//   - Character ownership
//   - Permission checks
//

// ============================================
// USER PROFILE (extends Clerk user)
// ============================================

export const UserProfileSchema = z.object({
  // Clerk user ID
  id: z.string(),

  // From Clerk
  email: z.string().email(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().optional(),

  // Our extensions (stored in Clerk metadata or our DB)
  metadata: z.object({
    // Display preferences
    displayName: z.string().optional(),
    pronouns: z.string().optional(),
    timezone: z.string().optional(),

    // Platform stats
    joinedAt: z.date(),
    lastActiveAt: z.date().optional(),

    // Preferences
    preferences: z
      .object({
        theme: z.enum(["light", "dark", "system"]).default("system"),
        diceStyle: z.string().optional(),
        notificationsEnabled: z.boolean().default(true),
        emailDigest: z.enum(["none", "daily", "weekly"]).default("weekly"),
      })
      .optional(),

    // Stats
    stats: z
      .object({
        campaignsGMed: z.number().int().default(0),
        campaignsPlayed: z.number().int().default(0),
        charactersCreated: z.number().int().default(0),
        sessionsPlayed: z.number().int().default(0),
      })
      .optional(),
  }),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ============================================
// SYSTEM ROLES
// ============================================

export const SystemRoleSchema = z.enum([
  "admin", // Platform admin (us)
  "moderator", // Can moderate content
  "premium", // Paid subscriber
  "user", // Regular user
]);
export type SystemRole = z.infer<typeof SystemRoleSchema>;

// ============================================
// CAMPAIGN ROLES
// ============================================

export const CampaignRoleSchema = z.enum([
  "owner", // Created the campaign, full control
  "gm", // Game Master, can run sessions
  "co_gm", // Assistant GM
  "player", // Regular player
  "spectator", // Can view but not interact
  "invited", // Invited but not yet accepted
]);
export type CampaignRole = z.infer<typeof CampaignRoleSchema>;

export const CampaignMembershipSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  campaignId: z.string().uuid(),

  role: CampaignRoleSchema,

  // Permissions (can override role defaults)
  permissions: z
    .object({
      canEditWorld: z.boolean().optional(),
      canEditNPCs: z.boolean().optional(),
      canEditQuests: z.boolean().optional(),
      canRunSessions: z.boolean().optional(),
      canInvitePlayers: z.boolean().optional(),
      canKickPlayers: z.boolean().optional(),
      canViewGMNotes: z.boolean().optional(),
      canEditEconomy: z.boolean().optional(),
      canEditFactions: z.boolean().optional(),
    })
    .optional(),

  // Status
  status: z.enum(["active", "inactive", "banned"]).default("active"),
  joinedAt: z.date(),
  lastActiveAt: z.date().optional(),

  // Invitation tracking
  invitedBy: z.string().optional(),
  invitedAt: z.date().optional(),
  acceptedAt: z.date().optional(),
});
export type CampaignMembership = z.infer<typeof CampaignMembershipSchema>;

// ============================================
// PARTY ROLES
// ============================================

export const PartyRoleSchema = z.enum([
  "leader", // Party leader (usually player-elected)
  "member", // Regular party member
  "npc_companion", // GM-controlled companion in party
  "guest", // Temporary member
]);
export type PartyRole = z.infer<typeof PartyRoleSchema>;

export const PartyMembershipSchema = z.object({
  id: z.string().uuid(),

  userId: z.string(),
  partyId: z.string().uuid(),
  characterId: z.string().uuid(),

  role: PartyRoleSchema,

  // Status
  active: z.boolean().default(true),
  joinedAt: z.date(),
  leftAt: z.date().optional(),
});
export type PartyMembership = z.infer<typeof PartyMembershipSchema>;

// ============================================
// CHARACTER OWNERSHIP
// ============================================

export const CharacterOwnershipSchema = z.object({
  characterId: z.string().uuid(),
  ownerId: z.string(), // Clerk user ID

  // Type
  type: z.enum([
    "player_character", // Player owns and controls
    "npc", // GM controls, no player owner
    "retired", // Former PC, now reference only
    "pregenerated", // Pre-made for one-shots
  ]),

  // Permissions
  canEdit: z.boolean().default(true),
  canDelete: z.boolean().default(false), // Usually only GM can delete
  canTransfer: z.boolean().default(false),

  // Tracking
  createdAt: z.date(),
  lastPlayedAt: z.date().optional(),
});
export type CharacterOwnership = z.infer<typeof CharacterOwnershipSchema>;

// ============================================
// PERMISSIONS
// ============================================

export const PermissionSchema = z.enum([
  // Campaign-level
  "campaign.view",
  "campaign.edit",
  "campaign.delete",
  "campaign.invite",
  "campaign.kick",
  "campaign.settings",

  // Session-level
  "session.view",
  "session.run",
  "session.end",
  "session.notes.view",
  "session.notes.edit",

  // World-level
  "world.view",
  "world.edit",
  "world.secrets.view",

  // NPC-level
  "npc.view",
  "npc.view.stats",
  "npc.view.secrets",
  "npc.edit",
  "npc.create",
  "npc.delete",

  // Quest-level
  "quest.view",
  "quest.view.secrets",
  "quest.edit",
  "quest.create",

  // Character-level
  "character.view.own",
  "character.view.all",
  "character.view.sheets",
  "character.edit.own",
  "character.edit.all",
  "character.create",

  // Party-level
  "party.view",
  "party.edit",
  "party.gold.view",
  "party.gold.edit",
  "party.inventory.view",
  "party.inventory.edit",

  // Combat-level
  "combat.view",
  "combat.run",
  "combat.monster.stats",

  // Economy/Faction (GM stuff)
  "economy.view",
  "economy.edit",
  "economy.simulate",
  "faction.view",
  "faction.view.secrets",
  "faction.edit",
  "faction.simulate",

  // Downtime
  "downtime.view.own",
  "downtime.view.all",
  "downtime.edit.own",
  "downtime.resolve",
]);
export type Permission = z.infer<typeof PermissionSchema>;

// ============================================
// ROLE → PERMISSION MAPPING
// ============================================

export const CampaignRolePermissions: Record<CampaignRole, Permission[]> = {
  owner: [
    // Everything
    "campaign.view",
    "campaign.edit",
    "campaign.delete",
    "campaign.invite",
    "campaign.kick",
    "campaign.settings",
    "session.view",
    "session.run",
    "session.end",
    "session.notes.view",
    "session.notes.edit",
    "world.view",
    "world.edit",
    "world.secrets.view",
    "npc.view",
    "npc.view.stats",
    "npc.view.secrets",
    "npc.edit",
    "npc.create",
    "npc.delete",
    "quest.view",
    "quest.view.secrets",
    "quest.edit",
    "quest.create",
    "character.view.own",
    "character.view.all",
    "character.view.sheets",
    "character.edit.own",
    "character.edit.all",
    "character.create",
    "party.view",
    "party.edit",
    "party.gold.view",
    "party.gold.edit",
    "party.inventory.view",
    "party.inventory.edit",
    "combat.view",
    "combat.run",
    "combat.monster.stats",
    "economy.view",
    "economy.edit",
    "economy.simulate",
    "faction.view",
    "faction.view.secrets",
    "faction.edit",
    "faction.simulate",
    "downtime.view.own",
    "downtime.view.all",
    "downtime.edit.own",
    "downtime.resolve",
  ],

  gm: [
    // Almost everything except delete campaign
    "campaign.view",
    "campaign.edit",
    "campaign.invite",
    "campaign.kick",
    "campaign.settings",
    "session.view",
    "session.run",
    "session.end",
    "session.notes.view",
    "session.notes.edit",
    "world.view",
    "world.edit",
    "world.secrets.view",
    "npc.view",
    "npc.view.stats",
    "npc.view.secrets",
    "npc.edit",
    "npc.create",
    "npc.delete",
    "quest.view",
    "quest.view.secrets",
    "quest.edit",
    "quest.create",
    "character.view.own",
    "character.view.all",
    "character.view.sheets",
    "character.edit.own",
    "character.edit.all",
    "character.create",
    "party.view",
    "party.edit",
    "party.gold.view",
    "party.gold.edit",
    "party.inventory.view",
    "party.inventory.edit",
    "combat.view",
    "combat.run",
    "combat.monster.stats",
    "economy.view",
    "economy.edit",
    "economy.simulate",
    "faction.view",
    "faction.view.secrets",
    "faction.edit",
    "faction.simulate",
    "downtime.view.own",
    "downtime.view.all",
    "downtime.edit.own",
    "downtime.resolve",
  ],

  co_gm: [
    // Can run sessions, view secrets, but limited editing
    "campaign.view",
    "campaign.invite",
    "session.view",
    "session.run",
    "session.notes.view",
    "session.notes.edit",
    "world.view",
    "world.secrets.view",
    "npc.view",
    "npc.view.stats",
    "npc.view.secrets",
    "npc.edit",
    "npc.create",
    "quest.view",
    "quest.view.secrets",
    "quest.edit",
    "character.view.own",
    "character.view.all",
    "character.view.sheets",
    "character.edit.own",
    "character.create",
    "party.view",
    "party.edit",
    "party.gold.view",
    "party.gold.edit",
    "party.inventory.view",
    "party.inventory.edit",
    "combat.view",
    "combat.run",
    "combat.monster.stats",
    "economy.view",
    "faction.view",
    "faction.view.secrets",
    "downtime.view.own",
    "downtime.view.all",
    "downtime.edit.own",
  ],

  player: [
    // Standard player permissions
    "campaign.view",
    "session.view",
    "world.view",
    "npc.view",
    "quest.view",
    "character.view.own",
    "character.edit.own",
    "character.create",
    "party.view",
    "party.gold.view",
    "party.inventory.view",
    "party.inventory.edit",
    "combat.view",
    "downtime.view.own",
    "downtime.edit.own",
  ],

  spectator: [
    // View only
    "campaign.view",
    "session.view",
    "world.view",
    "npc.view",
    "quest.view",
    "party.view",
    "combat.view",
  ],

  invited: [
    // Nothing until they accept
  ],
};

// ============================================
// SESSION AUTH TOKEN
// ============================================

export const SessionAuthSchema = z.object({
  // User info
  userId: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  imageUrl: z.string().optional(),

  // System role
  systemRole: SystemRoleSchema.default("user"),

  // Current context (set when entering a campaign)
  campaignContext: z
    .object({
      campaignId: z.string().uuid(),
      campaignName: z.string(),
      role: CampaignRoleSchema,
      permissions: z.array(PermissionSchema),

      // Active character (if player)
      activeCharacterId: z.string().uuid().optional(),
      activeCharacterName: z.string().optional(),

      // Active party
      partyId: z.string().uuid().optional(),
      partyName: z.string().optional(),
    })
    .optional(),

  // Session info
  sessionId: z.string(),
  issuedAt: z.date(),
  expiresAt: z.date(),
});
export type SessionAuth = z.infer<typeof SessionAuthSchema>;

// ============================================
// INVITE
// ============================================

export const CampaignInviteSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Invite details
  code: z.string(), // Short code for sharing
  link: z.string().optional(), // Full link

  // Who created it
  createdBy: z.string(),
  createdAt: z.date(),

  // Limits
  expiresAt: z.date().optional(),
  maxUses: z.number().int().optional(),
  usedCount: z.number().int().default(0),

  // What role do invitees get
  defaultRole: CampaignRoleSchema.default("player"),

  // Status
  active: z.boolean().default(true),

  // Who used it
  usedBy: z
    .array(
      z.object({
        userId: z.string(),
        usedAt: z.date(),
      }),
    )
    .default([]),
});
export type CampaignInvite = z.infer<typeof CampaignInviteSchema>;

// ============================================
// AUDIT LOG
// ============================================

export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),

  // Who
  userId: z.string(),
  userEmail: z.string().optional(),

  // What
  action: z.string(), // "campaign.created", "character.deleted"
  entityType: z.string(), // "campaign", "character", "session"
  entityId: z.string(),

  // Context
  campaignId: z.string().uuid().optional(),

  // Details
  details: z.record(z.string(), z.any()).optional(),

  // When
  timestamp: z.date(),

  // Request info
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
