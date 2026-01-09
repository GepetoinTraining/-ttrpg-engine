/**
 * SOCIAL CONTRACT ENGINE - Household Operations
 *
 * Households are durable social/economic units.
 * They can be rebuilt from membership events (projection).
 */

import {
  Household,
  HouseholdMembership,
  HouseholdType,
  HouseholdRole,
  SocialStanding,
} from './schema';
import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';

// ============================================
// HOUSEHOLD CREATION
// ============================================

export interface CreateHouseholdInput {
  campaignId: string;
  partyId?: string;

  name: string;
  type: HouseholdType;

  founderId: string;
  founderType: string;

  homeHubId?: string;
  homeBuildingId?: string;
  homeNodeId?: string;

  standing?: SocialStanding;
  standingTags?: string[];

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a new household.
 */
export async function createHousehold(input: CreateHouseholdInput): Promise<{
  household: Household;
  membership: HouseholdMembership;
}> {
  const now = new Date().toISOString();
  const householdId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();

  // Create household
  const household: Household = {
    id: householdId,
    campaignId: input.campaignId,
    name: input.name,
    type: input.type,
    headId: input.founderId,
    headType: input.founderType,
    homeHubId: input.homeHubId,
    homeBuildingId: input.homeBuildingId,
    homeNodeId: input.homeNodeId,
    standing: input.standing ?? 'common',
    standingTags: input.standingTags ?? [],
    treasury: 0,
    properties: [],
    heraldry: { colors: [] },
    factionTies: [],
    status: 'active',
    foundedAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Create founder membership
  const membership: HouseholdMembership = {
    id: membershipId,
    householdId,
    memberId: input.founderId,
    memberType: input.founderType,
    role: 'head',
    joinedAt: now,
    joinReason: 'founded',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'household',
    entityId: householdId,
    operation: 'create',
    delta: { household, membership },
    actorId: input.founderId,
    actorType: input.founderType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return { household, membership };
}

// ============================================
// MEMBERSHIP OPERATIONS
// ============================================

export interface JoinHouseholdInput {
  householdId: string;
  campaignId: string;
  partyId?: string;

  memberId: string;
  memberType: string;
  role: HouseholdRole;
  joinReason: string;

  worldTimestamp: WorldTimestamp;
  syncVersion?: number;
}

/**
 * Add a member to a household.
 */
export async function joinHousehold(
  _household: Household,
  input: JoinHouseholdInput
): Promise<HouseholdMembership> {
  const now = new Date().toISOString();
  const membershipId = crypto.randomUUID();

  const membership: HouseholdMembership = {
    id: membershipId,
    householdId: input.householdId,
    memberId: input.memberId,
    memberType: input.memberType,
    role: input.role,
    joinedAt: now,
    joinedSyncVersion: input.syncVersion,
    joinReason: input.joinReason,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'household_membership',
    entityId: membershipId,
    operation: 'create',
    delta: { membership, householdId: input.householdId },
    actorId: input.memberId,
    actorType: input.memberType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return membership;
}

export interface LeaveHouseholdInput {
  membershipId: string;
  campaignId: string;
  partyId?: string;

  leaveReason: string;

  worldTimestamp: WorldTimestamp;
  syncVersion?: number;
}

/**
 * Remove a member from a household.
 */
export async function leaveHousehold(
  membership: HouseholdMembership,
  input: LeaveHouseholdInput
): Promise<HouseholdMembership> {
  const now = new Date().toISOString();

  const updatedMembership: HouseholdMembership = {
    ...membership,
    leftAt: now,
    leftSyncVersion: input.syncVersion,
    leaveReason: input.leaveReason,
    active: false,
    updatedAt: now,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'household_membership',
    entityId: membership.id,
    operation: 'update',
    delta: {
      leftAt: now,
      leftSyncVersion: input.syncVersion,
      leaveReason: input.leaveReason,
      active: false,
    },
    actorId: membership.memberId,
    actorType: membership.memberType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updatedMembership;
}

// ============================================
// HEAD SUCCESSION
// ============================================

export interface SucceedHeadInput {
  householdId: string;
  campaignId: string;
  partyId?: string;

  newHeadId: string;
  newHeadType: string;
  reason: string;

  worldTimestamp: WorldTimestamp;
}

/**
 * Change the head of a household.
 */
export async function succeedHead(
  household: Household,
  memberships: HouseholdMembership[],
  input: SucceedHeadInput
): Promise<{
  household: Household;
  oldHeadMembership?: HouseholdMembership;
  newHeadMembership: HouseholdMembership;
}> {
  const now = new Date().toISOString();

  // Find old head membership
  const oldHeadMembership = memberships.find(
    m => m.memberId === household.headId && m.active
  );

  // Update old head role
  let updatedOldHead: HouseholdMembership | undefined;
  if (oldHeadMembership) {
    updatedOldHead = {
      ...oldHeadMembership,
      role: 'elder', // Former head becomes elder
      updatedAt: now,
    };
  }

  // Find new head membership or create one
  let newHeadMembership = memberships.find(
    m => m.memberId === input.newHeadId && m.active
  );

  if (newHeadMembership) {
    newHeadMembership = {
      ...newHeadMembership,
      role: 'head',
      updatedAt: now,
    };
  } else {
    // New head wasn't a member, add them
    newHeadMembership = {
      id: crypto.randomUUID(),
      householdId: input.householdId,
      memberId: input.newHeadId,
      memberType: input.newHeadType,
      role: 'head',
      joinedAt: now,
      joinReason: input.reason,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Update household
  const updatedHousehold: Household = {
    ...household,
    headId: input.newHeadId,
    headType: input.newHeadType,
    updatedAt: now,
    version: household.version + 1,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'household',
    entityId: input.householdId,
    operation: 'update',
    delta: {
      headId: input.newHeadId,
      headType: input.newHeadType,
      reason: input.reason,
      oldHeadId: household.headId,
    },
    actorId: input.newHeadId,
    actorType: input.newHeadType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return {
    household: updatedHousehold,
    oldHeadMembership: updatedOldHead,
    newHeadMembership,
  };
}

// ============================================
// HOUSEHOLD QUERIES
// ============================================

/**
 * Get all active members of a household.
 */
export function getActiveMembers(
  memberships: HouseholdMembership[],
  householdId: string
): HouseholdMembership[] {
  return memberships.filter(m => m.householdId === householdId && m.active);
}

/**
 * Get member's household.
 */
export function getMemberHousehold(
  memberships: HouseholdMembership[],
  memberId: string
): HouseholdMembership | undefined {
  return memberships.find(m => m.memberId === memberId && m.active);
}

/**
 * Get household head.
 */
export function getHouseholdHead(
  memberships: HouseholdMembership[],
  householdId: string
): HouseholdMembership | undefined {
  return memberships.find(
    m => m.householdId === householdId && m.role === 'head' && m.active
  );
}

/**
 * Get household heirs (in order).
 */
export function getHouseholdHeirs(
  memberships: HouseholdMembership[],
  householdId: string
): HouseholdMembership[] {
  return memberships
    .filter(m => m.householdId === householdId && m.role === 'heir' && m.active)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

/**
 * Check if member can inherit headship.
 */
export function canInherit(
  membership: HouseholdMembership,
  _household: Household
): boolean {
  // Simple rule: heirs and children can inherit
  return ['heir', 'child', 'spouse'].includes(membership.role);
}

/**
 * Calculate household wealth score.
 */
export function calculateWealthScore(household: Household): number {
  let score = household.treasury;

  // Add property values (simplified)
  score += household.properties.length * 1000;

  // Standing multiplier
  const standingMultipliers: Record<SocialStanding, number> = {
    outcast: 0.1,
    destitute: 0.25,
    poor: 0.5,
    common: 1,
    comfortable: 2,
    wealthy: 5,
    noble: 10,
    royal: 50,
  };

  return Math.floor(score * (standingMultipliers[household.standing] ?? 1));
}
