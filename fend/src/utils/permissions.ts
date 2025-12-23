// Client-side permission checks
// Server is source of truth, these are for UI gating

export type Role = 'owner' | 'gm' | 'player' | 'spectator'

export type Permission =
  | 'campaign.edit'
  | 'campaign.delete'
  | 'campaign.invite'
  | 'session.create'
  | 'session.run'
  | 'session.end'
  | 'character.create'
  | 'character.edit_any'
  | 'character.edit_own'
  | 'character.delete'
  | 'npc.create'
  | 'npc.edit'
  | 'npc.view_secrets'
  | 'world.edit'
  | 'world.view_secrets'
  | 'combat.control_all'
  | 'combat.control_own'
  | 'combat.fudge_rolls'
  | 'downtime.approve'
  | 'downtime.submit'
  | 'chat.send'
  | 'chat.delete_any'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'campaign.edit', 'campaign.delete', 'campaign.invite',
    'session.create', 'session.run', 'session.end',
    'character.create', 'character.edit_any', 'character.edit_own', 'character.delete',
    'npc.create', 'npc.edit', 'npc.view_secrets',
    'world.edit', 'world.view_secrets',
    'combat.control_all', 'combat.control_own', 'combat.fudge_rolls',
    'downtime.approve', 'downtime.submit',
    'chat.send', 'chat.delete_any',
  ],
  gm: [
    'campaign.edit', 'campaign.invite',
    'session.create', 'session.run', 'session.end',
    'character.create', 'character.edit_any', 'character.edit_own',
    'npc.create', 'npc.edit', 'npc.view_secrets',
    'world.edit', 'world.view_secrets',
    'combat.control_all', 'combat.control_own', 'combat.fudge_rolls',
    'downtime.approve', 'downtime.submit',
    'chat.send', 'chat.delete_any',
  ],
  player: [
    'character.edit_own',
    'combat.control_own',
    'downtime.submit',
    'chat.send',
  ],
  spectator: [
    // Read-only, no permissions
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

// Check if user can perform action on specific resource
export function canEditCharacter(role: Role, characterOwnerId: string, userId: string): boolean {
  if (hasPermission(role, 'character.edit_any')) return true
  if (hasPermission(role, 'character.edit_own') && characterOwnerId === userId) return true
  return false
}

export function canControlToken(role: Role, tokenOwnerId: string | null, userId: string): boolean {
  if (hasPermission(role, 'combat.control_all')) return true
  if (hasPermission(role, 'combat.control_own') && tokenOwnerId === userId) return true
  return false
}

export function isGMOrAbove(role: Role): boolean {
  return role === 'owner' || role === 'gm'
}

export function isOwner(role: Role): boolean {
  return role === 'owner'
}

// UI helper - returns reason if denied
export function checkPermission(role: Role, permission: Permission): { allowed: boolean; reason?: string } {
  if (hasPermission(role, permission)) {
    return { allowed: true }
  }

  const reasons: Partial<Record<Permission, string>> = {
    'campaign.edit': 'Only GMs can edit campaign settings',
    'campaign.delete': 'Only the owner can delete this campaign',
    'session.run': 'Only GMs can run sessions',
    'combat.fudge_rolls': 'Only GMs can fudge dice rolls',
    'npc.view_secrets': 'NPC secrets are hidden from players',
    'world.view_secrets': 'Location secrets are hidden from players',
    'downtime.approve': 'Only GMs can approve downtime actions',
  }

  return {
    allowed: false,
    reason: reasons[permission] || 'You do not have permission for this action'
  }
}
