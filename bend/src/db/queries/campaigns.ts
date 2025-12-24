import {
  query,
  queryOne,
  queryAll,
  transaction,
  parseJson,
  toJson,
  uuid,
  now,
  NotFoundError,
  ConflictError,
} from "../client";
import type { CampaignRole } from "../../auth/types";

// ============================================
// CAMPAIGN QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface Campaign {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  primaryWorldId?: string;
  startingRegionId?: string;
  isSpelljammer: boolean;
  accessibleWorlds: string[];
  accessibleSpheres: string[];
  settings: Record<string, any>;
  status: "planning" | "active" | "hiatus" | "completed" | "abandoned";
  currentDate?: string;
  currentArcId?: string;
  sessionsPlayed: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  lastSessionAt?: Date;
  version: number;
}

export interface CampaignMembership {
  id: string;
  userId: string;
  campaignId: string;
  role: CampaignRole;
  permissions: Record<string, boolean>;
  status: "active" | "inactive" | "banned";
  joinedAt: Date;
  lastActiveAt?: Date;
  invitedBy?: string;
  invitedAt?: Date;
  acceptedAt?: Date;
}

export interface CampaignInvite {
  id: string;
  campaignId: string;
  code: string;
  defaultRole: CampaignRole;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  usedBy: Array<{ userId: string; usedAt: string }>;
}

export interface CreateCampaignInput {
  name: string;
  tagline?: string;
  description?: string;
  primaryWorldId?: string;
  startingRegionId?: string;
  isSpelljammer?: boolean;
  settings?: Record<string, any>;
  ownerId: string;
}

export interface UpdateCampaignInput {
  name?: string;
  tagline?: string;
  description?: string;
  primaryWorldId?: string;
  startingRegionId?: string;
  settings?: Record<string, any>;
  status?: Campaign["status"];
  currentDate?: string;
  currentArcId?: string;
}

// ============================================
// ROW CONVERTERS
// ============================================

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || undefined,
    description: row.description || undefined,
    primaryWorldId: row.primary_world_id || undefined,
    startingRegionId: row.starting_region_id || undefined,
    isSpelljammer: row.is_spelljammer === 1,
    accessibleWorlds: parseJson(row.accessible_worlds) || [],
    accessibleSpheres: parseJson(row.accessible_spheres) || [],
    settings: parseJson(row.settings) || {},
    status: row.status,
    currentDate: row.current_date || undefined,
    currentArcId: row.current_arc_id || undefined,
    sessionsPlayed: row.sessions_played,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastSessionAt: row.last_session_at ? new Date(row.last_session_at) : undefined,
    version: row.version,
  };
}

function rowToMembership(row: any): CampaignMembership {
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    role: row.role,
    permissions: parseJson(row.permissions) || {},
    status: row.status,
    joinedAt: new Date(row.joined_at),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
    invitedBy: row.invited_by || undefined,
    invitedAt: row.invited_at ? new Date(row.invited_at) : undefined,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
  };
}

function rowToInvite(row: any): CampaignInvite {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    code: row.code,
    defaultRole: row.default_role,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    maxUses: row.max_uses || undefined,
    usedCount: row.used_count,
    active: row.active === 1,
    usedBy: parseJson(row.used_by) || [],
  };
}

// ============================================
// CAMPAIGN CRUD
// ============================================

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<Campaign> {
  const id = uuid();
  const timestamp = now();

  await query(
    `INSERT INTO campaigns
     (id, name, tagline, description, primary_world_id, starting_region_id,
      is_spelljammer, accessible_worlds, accessible_spheres, settings,
      status, owner_id, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.tagline || null,
      input.description || null,
      input.primaryWorldId || null,
      input.startingRegionId || null,
      input.isSpelljammer ? 1 : 0,
      "[]",
      "[]",
      toJson(input.settings || {}),
      "planning",
      input.ownerId,
      timestamp,
      timestamp,
      1,
    ],
  );

  // Add owner as member
  await addMember(id, input.ownerId, "owner");

  return getCampaignById(id) as Promise<Campaign>;
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const row = await queryOne("SELECT * FROM campaigns WHERE id = ?", [id]);
  return row ? rowToCampaign(row) : null;
}

export async function getCampaignByIdOrThrow(id: string): Promise<Campaign> {
  const campaign = await getCampaignById(id);
  if (!campaign) throw new NotFoundError("Campaign", id);
  return campaign;
}

export async function getCampaignsForUser(userId: string): Promise<Campaign[]> {
  const rows = await queryAll(
    `SELECT c.* FROM campaigns c
     JOIN campaign_memberships m ON m.campaign_id = c.id
     WHERE m.user_id = ? AND m.status = 'active'
     ORDER BY c.updated_at DESC`,
    [userId],
  );

  return rows.map(rowToCampaign);
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
): Promise<Campaign> {
  const existing = await getCampaignById(id);
  if (!existing) throw new NotFoundError("Campaign", id);

  const updates: string[] = ["updated_at = ?", "version = version + 1"];
  const params: any[] = [now()];

  if (input.name !== undefined) {
    updates.push("name = ?");
    params.push(input.name);
  }
  if (input.tagline !== undefined) {
    updates.push("tagline = ?");
    params.push(input.tagline);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    params.push(input.description);
  }
  if (input.primaryWorldId !== undefined) {
    updates.push("primary_world_id = ?");
    params.push(input.primaryWorldId);
  }
  if (input.startingRegionId !== undefined) {
    updates.push("starting_region_id = ?");
    params.push(input.startingRegionId);
  }
  if (input.settings !== undefined) {
    updates.push("settings = ?");
    params.push(toJson({ ...existing.settings, ...input.settings }));
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    params.push(input.status);
  }
  if (input.currentDate !== undefined) {
    updates.push("current_date = ?");
    params.push(input.currentDate);
  }
  if (input.currentArcId !== undefined) {
    updates.push("current_arc_id = ?");
    params.push(input.currentArcId);
  }

  params.push(id);

  await query(
    `UPDATE campaigns SET ${updates.join(", ")} WHERE id = ?`,
    params,
  );

  return getCampaignByIdOrThrow(id);
}

export async function deleteCampaign(id: string): Promise<void> {
  await transaction(async (tx) => {
    // Delete related data
    await tx.query("DELETE FROM campaign_invites WHERE campaign_id = ?", [id]);
    await tx.query("DELETE FROM campaign_memberships WHERE campaign_id = ?", [
      id,
    ]);
    // TODO: Delete parties, characters, sessions, etc.
    await tx.query("DELETE FROM campaigns WHERE id = ?", [id]);
  });
}

// ============================================
// MEMBERSHIP
// ============================================

export async function addMember(
  campaignId: string,
  userId: string,
  role: CampaignRole,
  invitedBy?: string,
): Promise<CampaignMembership> {
  const id = uuid();
  const timestamp = now();

  // Check if already member
  const existing = await getMembership(campaignId, userId);
  if (existing) {
    throw new ConflictError("User is already a member of this campaign");
  }

  await query(
    `INSERT INTO campaign_memberships
     (id, user_id, campaign_id, role, permissions, status, joined_at, invited_by, invited_at, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      campaignId,
      role,
      "{}",
      "active",
      timestamp,
      invitedBy || null,
      invitedBy ? timestamp : null,
      timestamp,
    ],
  );

  return getMembershipById(id) as Promise<CampaignMembership>;
}

export async function getMembership(
  campaignId: string,
  userId: string,
): Promise<CampaignMembership | null> {
  const row = await queryOne(
    "SELECT * FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?",
    [campaignId, userId],
  );

  return row ? rowToMembership(row) : null;
}

export async function getMembershipById(
  id: string,
): Promise<CampaignMembership | null> {
  const row = await queryOne(
    "SELECT * FROM campaign_memberships WHERE id = ?",
    [id],
  );
  return row ? rowToMembership(row) : null;
}

export async function getCampaignMembers(
  campaignId: string,
): Promise<CampaignMembership[]> {
  const rows = await queryAll(
    `SELECT * FROM campaign_memberships
     WHERE campaign_id = ? AND status = 'active'
     ORDER BY role, joined_at`,
    [campaignId],
  );

  return rows.map(rowToMembership);
}

export async function updateMemberRole(
  campaignId: string,
  userId: string,
  newRole: CampaignRole,
): Promise<CampaignMembership> {
  await query(
    `UPDATE campaign_memberships
     SET role = ?, last_active_at = ?
     WHERE campaign_id = ? AND user_id = ?`,
    [newRole, now(), campaignId, userId],
  );

  const membership = await getMembership(campaignId, userId);
  if (!membership)
    throw new NotFoundError("CampaignMembership", `${campaignId}/${userId}`);
  return membership;
}

export async function updateMemberPermissions(
  campaignId: string,
  userId: string,
  permissions: Record<string, boolean>,
): Promise<CampaignMembership> {
  const existing = await getMembership(campaignId, userId);
  if (!existing)
    throw new NotFoundError("CampaignMembership", `${campaignId}/${userId}`);

  await query(
    `UPDATE campaign_memberships
     SET permissions = ?, last_active_at = ?
     WHERE campaign_id = ? AND user_id = ?`,
    [
      toJson({ ...existing.permissions, ...permissions }),
      now(),
      campaignId,
      userId,
    ],
  );

  return getMembership(campaignId, userId) as Promise<CampaignMembership>;
}

export async function removeMember(
  campaignId: string,
  userId: string,
): Promise<void> {
  await query(
    `UPDATE campaign_memberships
     SET status = 'inactive'
     WHERE campaign_id = ? AND user_id = ?`,
    [campaignId, userId],
  );
}

export async function banMember(
  campaignId: string,
  userId: string,
): Promise<void> {
  await query(
    `UPDATE campaign_memberships
     SET status = 'banned'
     WHERE campaign_id = ? AND user_id = ?`,
    [campaignId, userId],
  );
}

export async function touchMemberActivity(
  campaignId: string,
  userId: string,
): Promise<void> {
  await query(
    `UPDATE campaign_memberships
     SET last_active_at = ?
     WHERE campaign_id = ? AND user_id = ?`,
    [now(), campaignId, userId],
  );
}

// ============================================
// INVITES
// ============================================

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createInvite(
  campaignId: string,
  createdBy: string,
  options: {
    defaultRole?: CampaignRole;
    expiresAt?: Date;
    maxUses?: number;
  } = {},
): Promise<CampaignInvite> {
  const id = uuid();
  const code = generateInviteCode();
  const timestamp = now();

  await query(
    `INSERT INTO campaign_invites
     (id, campaign_id, code, default_role, created_by, created_at, expires_at, max_uses, used_count, active, used_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      campaignId,
      code,
      options.defaultRole || "player",
      createdBy,
      timestamp,
      options.expiresAt?.toISOString() || null,
      options.maxUses || null,
      0,
      1,
      "[]",
    ],
  );

  return getInviteById(id) as Promise<CampaignInvite>;
}

export async function getInviteById(
  id: string,
): Promise<CampaignInvite | null> {
  const row = await queryOne("SELECT * FROM campaign_invites WHERE id = ?", [
    id,
  ]);
  return row ? rowToInvite(row) : null;
}

export async function getInviteByCode(
  code: string,
): Promise<CampaignInvite | null> {
  const row = await queryOne(
    "SELECT * FROM campaign_invites WHERE code = ? AND active = 1",
    [code.toUpperCase()],
  );
  return row ? rowToInvite(row) : null;
}

export async function getCampaignInvites(
  campaignId: string,
): Promise<CampaignInvite[]> {
  const rows = await queryAll(
    "SELECT * FROM campaign_invites WHERE campaign_id = ? ORDER BY created_at DESC",
    [campaignId],
  );
  return rows.map(rowToInvite);
}

export async function useInvite(
  code: string,
  userId: string,
): Promise<{ campaign: Campaign; membership: CampaignMembership }> {
  const invite = await getInviteByCode(code);

  if (!invite) {
    throw new NotFoundError("CampaignInvite", code);
  }

  // Check expiration
  if (invite.expiresAt && new Date() > invite.expiresAt) {
    throw new ConflictError("Invite has expired");
  }

  // Check max uses
  if (invite.maxUses && invite.usedCount >= invite.maxUses) {
    throw new ConflictError("Invite has reached maximum uses");
  }

  // Check if already member
  const existingMembership = await getMembership(invite.campaignId, userId);
  if (existingMembership) {
    throw new ConflictError("Already a member of this campaign");
  }

  // Add member and update invite
  const membership = await addMember(
    invite.campaignId,
    userId,
    invite.defaultRole,
    invite.createdBy,
  );

  // Update invite usage
  const usedBy = [...invite.usedBy, { userId, usedAt: now() }];
  await query(
    `UPDATE campaign_invites
     SET used_count = used_count + 1, used_by = ?
     WHERE id = ?`,
    [toJson(usedBy), invite.id],
  );

  const campaign = await getCampaignByIdOrThrow(invite.campaignId);

  return { campaign, membership };
}

export async function deactivateInvite(id: string): Promise<void> {
  await query("UPDATE campaign_invites SET active = 0 WHERE id = ?", [id]);
}

// ============================================
// STATS
// ============================================

export async function getCampaignStats(campaignId: string): Promise<{
  memberCount: number;
  partyCount: number;
  characterCount: number;
  sessionCount: number;
}> {
  const [members, parties, characters, sessions] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM campaign_memberships
       WHERE campaign_id = ? AND status = 'active'`,
      [campaignId],
    ),
    queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM parties WHERE campaign_id = ?",
      [campaignId],
    ),
    queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM characters WHERE campaign_id = ?",
      [campaignId],
    ),
    queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM sessions WHERE campaign_id = ?",
      [campaignId],
    ),
  ]);

  return {
    memberCount: members?.count || 0,
    partyCount: parties?.count || 0,
    characterCount: characters?.count || 0,
    sessionCount: sessions?.count || 0,
  };
}

// ============================================
// ROUTER COMPATIBILITY ALIASES
// ============================================
//
// These bridge the router's expected API to the actual implementations.
// The router was written with different function names/signatures.
//

/**
 * Alias: getCampaign -> getCampaignById
 */
export const getCampaign = getCampaignById;

/**
 * Alias: getCampaignMembership(userId, campaignId) -> getMembership(campaignId, userId)
 * Note: Router passes (userId, campaignId) but getMembership expects (campaignId, userId)
 */
export function getCampaignMembership(
  userId: string,
  campaignId: string,
): Promise<CampaignMembership | null> {
  return getMembership(campaignId, userId);
}

/**
 * Alias: getUserCampaigns(userId, page?, pageSize?) -> getCampaignsForUser(userId)
 * TODO: Add pagination to getCampaignsForUser if needed
 */
export function getUserCampaigns(
  userId: string,
  _page?: number,
  _pageSize?: number,
): Promise<Campaign[]> {
  return getCampaignsForUser(userId);
}

/**
 * Alias: addCampaignMember({...}) -> addMember(a, b, c, d)
 * Router passes object, original uses positional args
 */
export function addCampaignMember(opts: {
  campaignId: string;
  userId: string;
  role: CampaignRole;
  invitedBy?: string;
}): Promise<CampaignMembership> {
  return addMember(opts.campaignId, opts.userId, opts.role, opts.invitedBy);
}

/**
 * Alias: createCampaignInvite({...}) -> createInvite(a, b, opts)
 * Router passes flat object, original uses positional + options
 */
export function createCampaignInvite(opts: {
  campaignId: string;
  createdBy: string;
  defaultRole?: CampaignRole;
  expiresAt?: Date;
  maxUses?: number;
}): Promise<CampaignInvite> {
  return createInvite(opts.campaignId, opts.createdBy, {
    defaultRole: opts.defaultRole,
    expiresAt: opts.expiresAt,
    maxUses: opts.maxUses,
  });
}

/**
 * Alias: removeCampaignMember -> removeMember
 */
export const removeCampaignMember = removeMember;

/**
 * Mark invite as used by ID (not code)
 * Used after router has already fetched and validated the invite.
 * This avoids the double-fetch that would happen with useInvite(code).
 */
export async function markInviteUsed(
  inviteId: string,
  userId: string,
): Promise<void> {
  const invite = await getInviteById(inviteId);
  if (!invite) return; // Already validated by router

  const usedBy = [...invite.usedBy, { userId, usedAt: now() }];
  await query(
    `UPDATE campaign_invites
     SET used_count = used_count + 1, used_by = ?
     WHERE id = ?`,
    [toJson(usedBy), inviteId],
  );

}
  // ============================================
  // PARTY TYPES
  // ============================================

  export interface Party {
    id: string;
    campaignId: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface PartyMembership {
    id: string;
    partyId: string;
    characterId: string;
    joinedAt: Date;
    isActive: boolean;
  }

  export interface CreatePartyInput {
    campaignId: string;
    name: string;
    description?: string;
  }

  export interface UpdatePartyInput {
    name?: string;
    description?: string;
    isActive?: boolean;
  }

  interface PartyRow {
    id: string;
    campaign_id: string;
    name: string;
    description: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
  }

  interface PartyMembershipRow {
    id: string;
    party_id: string;
    character_id: string;
    joined_at: string;
    is_active: number;
  }

  // ============================================
  // PARTY FUNCTIONS
  // ============================================

  function rowToParty(row: PartyRow): Party {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      name: row.name,
      description: row.description || undefined,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  export async function getParty(id: string): Promise<Party | null> {
    const row = await queryOne<PartyRow>(
      "SELECT * FROM parties WHERE id = ?",
      [id],
    );
    return row ? rowToParty(row) : null;
  }

  export async function getCampaignParties(campaignId: string): Promise<Party[]> {
    const rows = await queryAll<PartyRow>(
      "SELECT * FROM parties WHERE campaign_id = ? ORDER BY created_at",
      [campaignId],
    );
    return rows.map(rowToParty);
  }

  export async function createParty(input: CreatePartyInput): Promise<Party> {
    const id = uuid();
    const timestamp = now();

    await query(
      `INSERT INTO parties (id, campaign_id, name, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.campaignId, input.name, input.description || null, 1, timestamp, timestamp],
    );

    const created = await getParty(id);
    if (!created) throw new NotFoundError("Party", id);
    return created;
  }

  export async function updateParty(
    id: string,
    input: UpdatePartyInput,
  ): Promise<Party> {
    const existing = await getParty(id);
    if (!existing) throw new NotFoundError("Party", id);

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      params.push(input.name);
    }

    if (input.description !== undefined) {
      updates.push("description = ?");
      params.push(input.description);
    }

    if (input.isActive !== undefined) {
      updates.push("is_active = ?");
      params.push(input.isActive ? 1 : 0);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(now());
    params.push(id);

    await query(`UPDATE parties SET ${updates.join(", ")} WHERE id = ?`, params);

    const updated = await getParty(id);
    if (!updated) throw new NotFoundError("Party", id);
    return updated;
  }

  export async function deleteParty(id: string): Promise<void> {
    return transaction(async (tx) => {
      await tx.query("DELETE FROM party_memberships WHERE party_id = ?", [id]);
      await tx.query("DELETE FROM parties WHERE id = ?", [id]);
    });
  }
