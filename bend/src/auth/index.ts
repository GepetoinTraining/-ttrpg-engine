// ============================================
// AUTH LAYER
// ============================================
//
// Authentication and authorization for TTRPG.
//
// Uses Topology-First Authentication:
//   - φ + ζ = π
//   - No passwords, no tokens, no sessions
//   - Same seed + same math = same answer
//   - Device-bound enrollment with human verification
//
// We handle:
//   - Campaign/Party membership
//   - GM vs Player roles
//   - Permission checking
//   - Character ownership
//   - API middleware
//

export * from "./types";
export * from "./topology";
export * from "./permissions";

// ============================================
// ARCHITECTURE
// ============================================
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                        TOPOLOGY AUTH                                    │
//  │                                                                         │
//  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
//  │  │ Enrollment│  │  Vouch    │  │Certificate│  │ Challenge │           │
//  │  │ (geo+time)│  │  (human)  │  │  (device) │  │ (M^n)     │           │
//  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘           │
//  │                                                                         │
//  │                    Certificate Hash                                     │
//  └─────────────────────────────┬───────────────────────────────────────────┘
//                                │
//  ┌─────────────────────────────┼───────────────────────────────────────────┐
//  │                       AUTH LAYER                                        │
//  │                             │                                           │
//  │  ┌──────────────────────────▼──────────────────────────────┐           │
//  │  │                   MIDDLEWARE                             │           │
//  │  │                                                          │           │
//  │  │  1. Extract certificate hash from header                │           │
//  │  │  2. Verify with topology auth                           │           │
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
// TOPOLOGY AUTH FLOW
// ============================================
//
// ENROLLMENT (new user or new device):
//
//   1. Client captures geo + datetime
//   2. Client requests enrollment
//   3. Another human vouches for them (or bootstrap for first user)
//   4. Server creates seed + certificate
//   5. Client stores certificate locally
//
// AUTHENTICATION (every request):
//
//   1. Client computes certificate hash
//   2. Client sends hash in x-topology-cert header
//   3. Server looks up certificate by hash
//   4. Server verifies seed is active
//   5. Server returns SessionAuth
//
// CHALLENGE/RESPONSE (optional, for sensitive ops):
//
//   1. Server sends challenge: n (random exponent)
//   2. Both compute M^n where M = [[φ, ζ], [ζ, φ]]
//   3. Client sends trajectory hash
//   4. Server verifies trajectories match
//

// ============================================
// DATABASE TABLES (Turso)
// ============================================
//
// Topology auth tables:
//
// topology_seeds:
//   id, user_id, seed_commitment, zeta_commitment,
//   is_active, created_at, revoked_at, revoked_by, revoke_reason
//
// topology_certificates:
//   id, seed_id, device_identifier, certificate_hash,
//   enrolled_at, enrolled_by, enrollment_geo, is_active,
//   last_used_at, revoked_at
//
// topology_enrollment_requests:
//   id, requested_user_id, requested_email, device_identifier,
//   enrollment_geo, enrollment_datetime, vouched_by, vouched_at,
//   status, created_at, expires_at, existing_seed_id
//
// topology_challenges:
//   id, seed_id, certificate_id, n, expected_trajectory,
//   created_at, expires_at, used
//
// Campaign membership tables:
//
// campaign_memberships:
//   id, user_id, campaign_id, role, permissions, status,
//   joined_at, last_active_at, invited_by
//
// party_memberships:
//   id, user_id, party_id, character_id, role, active, joined_at
//
// character_ownership:
//   character_id, owner_id, owner_seed_id, type, can_edit,
//   can_delete, created_at
//

// ============================================
// FILE SUMMARY
// ============================================
//
// auth/
// ├── types.ts           (SessionAuth, Permissions, Roles)
// │   ├── UserProfile
// │   ├── SystemRole / CampaignRole / PartyRole
// │   ├── CampaignMembership / PartyMembership
// │   ├── CharacterOwnership
// │   ├── Permission enum (50+ permissions)
// │   ├── CampaignRolePermissions mapping
// │   ├── SessionAuth (with seedId, certificateId)
// │   └── CampaignInvite
// │
// ├── topology/          (Topology-First Authentication)
// │   ├── math.ts        (φ, ζ, M^n, trajectories)
// │   ├── enrollment.ts  (seed + certificate creation)
// │   ├── challenge.ts   (challenge/response protocol)
// │   ├── verify.ts      (auth verification)
// │   ├── revocation.ts  (seed/cert revocation)
// │   └── index.ts       (exports)
// │
// ├── permissions.ts     (Permission checking)
// │   ├── PermissionChecker class
// │   ├── System/Campaign/Entity checks
// │   ├── Assert functions
// │   ├── AuthorizationError
// │   └── Query filters
// │
// └── index.ts           (this file)
//     └── Exports and documentation
//
