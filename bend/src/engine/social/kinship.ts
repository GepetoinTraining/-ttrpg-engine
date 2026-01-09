/**
 * SOCIAL CONTRACT ENGINE - Kinship & Inheritance
 *
 * The blood graph - who is related to whom, and what flows between them.
 *
 * Key concepts:
 * - Kinship links are directional (parent->child, spouse<->spouse)
 * - Legitimacy affects inheritance rights
 * - Inheritance can flow through multiple paths
 * - Claims arise from kinship + titles
 */

import {
  KinshipLink,
  KinshipType,
  Legitimacy,
  Title,
  SuccessionType,
  Claim,
  Household,
  HouseholdMembership,
  ContractPolicy,
} from './schema';
import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';

// ============================================
// KINSHIP LINK CREATION
// ============================================

export interface CreateKinshipInput {
  campaignId: string;

  entity1Id: string;
  entity1Type: string;
  entity2Id: string;
  entity2Type: string;

  relationship: KinshipType;
  legitimacy?: Legitimacy;

  sourceContractId?: string; // Marriage, adoption contract
  birthEventId?: string;

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a kinship link between two entities.
 * Also creates the inverse link (parent->child creates child->parent).
 */
export async function createKinshipLink(
  input: CreateKinshipInput
): Promise<{ link: KinshipLink; inverseLink: KinshipLink }> {
  const now = new Date().toISOString();
  const linkId = crypto.randomUUID();
  const inverseLinkId = crypto.randomUUID();

  const link: KinshipLink = {
    id: linkId,
    campaignId: input.campaignId,
    entity1Id: input.entity1Id,
    entity1Type: input.entity1Type,
    entity2Id: input.entity2Id,
    entity2Type: input.entity2Type,
    relationship: input.relationship,
    legitimacy: input.legitimacy ?? 'legitimate',
    sourceContractId: input.sourceContractId,
    birthEventId: input.birthEventId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // Create inverse relationship
  const inverseRelationship = getInverseRelationship(input.relationship);
  const inverseLink: KinshipLink = {
    id: inverseLinkId,
    campaignId: input.campaignId,
    entity1Id: input.entity2Id,
    entity1Type: input.entity2Type,
    entity2Id: input.entity1Id,
    entity2Type: input.entity1Type,
    relationship: inverseRelationship,
    legitimacy: input.legitimacy ?? 'legitimate',
    sourceContractId: input.sourceContractId,
    birthEventId: input.birthEventId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // Write delta for both links
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'kinship_link',
    entityId: linkId,
    operation: 'create',
    delta: { link, inverseLink },
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return { link, inverseLink };
}

/**
 * Get the inverse relationship type.
 */
function getInverseRelationship(relationship: KinshipType): KinshipType {
  const inverses: Record<KinshipType, KinshipType> = {
    parent: 'child',
    child: 'parent',
    sibling: 'sibling',
    spouse: 'spouse',
    grandparent: 'grandchild',
    grandchild: 'grandparent',
    uncle: 'nephew',
    aunt: 'niece',
    nephew: 'uncle',
    niece: 'aunt',
    cousin: 'cousin',
    step_parent: 'step_child',
    step_child: 'step_parent',
    step_sibling: 'step_sibling',
    in_law: 'in_law',
  };
  return inverses[relationship];
}

// ============================================
// KINSHIP OPERATIONS
// ============================================

export interface DisownInput {
  linkId: string;
  campaignId: string;
  reason: string;
  actorId: string;
  actorType: string;
  worldTimestamp: WorldTimestamp;
}

/**
 * Disown a kinship link (severs family ties).
 */
export async function disownKinship(
  link: KinshipLink,
  input: DisownInput
): Promise<KinshipLink> {
  const now = new Date().toISOString();

  const updated: KinshipLink = {
    ...link,
    status: 'disowned',
    updatedAt: now,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'kinship_link',
    entityId: link.id,
    operation: 'update',
    delta: { status: 'disowned', reason: input.reason },
    actorId: input.actorId,
    actorType: input.actorType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface LegitimizeInput {
  linkId: string;
  campaignId: string;
  authorityId: string;
  authorityType: string;
  worldTimestamp: WorldTimestamp;
}

/**
 * Legitimize an illegitimate kinship (e.g., bastard recognized by lord).
 */
export async function legitimizeKinship(
  link: KinshipLink,
  input: LegitimizeInput
): Promise<KinshipLink> {
  const now = new Date().toISOString();

  if (link.legitimacy !== 'illegitimate') {
    throw new Error(`Cannot legitimize a ${link.legitimacy} relationship`);
  }

  const updated: KinshipLink = {
    ...link,
    legitimacy: 'legitimized',
    updatedAt: now,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'kinship_link',
    entityId: link.id,
    operation: 'update',
    delta: { legitimacy: 'legitimized', authorityId: input.authorityId },
    actorId: input.authorityId,
    actorType: input.authorityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// TITLE MANAGEMENT
// ============================================

export interface CreateTitleInput {
  campaignId: string;

  name: string;
  rank: Title['rank'];

  grantingFactionId?: string;
  domainNodeId?: string;
  domainName?: string;

  holderId?: string;
  holderType?: string;
  holderName?: string;

  successionType?: SuccessionType;
  genderPreference?: 'none' | 'male_preference' | 'female_preference' | 'male_only' | 'female_only';
  legitimacyRequired?: boolean;

  rights?: string[];
  obligations?: string[];

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a new title.
 */
export async function createTitle(input: CreateTitleInput): Promise<Title> {
  const now = new Date().toISOString();
  const titleId = crypto.randomUUID();

  const title: Title = {
    id: titleId,
    campaignId: input.campaignId,
    name: input.name,
    rank: input.rank,
    grantingFactionId: input.grantingFactionId,
    domainNodeId: input.domainNodeId,
    domainName: input.domainName,
    holderId: input.holderId,
    holderType: input.holderType,
    holderName: input.holderName,
    heldSince: input.holderId ? now : undefined,
    successionRules: {
      type: input.successionType ?? 'primogeniture',
      genderPreference: input.genderPreference ?? 'none',
      legitimacyRequired: input.legitimacyRequired ?? true,
      electorsIds: [],
    },
    successionLine: [],
    rights: input.rights ?? [],
    obligations: input.obligations ?? [],
    status: input.holderId ? 'active' : 'vacant',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'title',
    entityId: titleId,
    operation: 'create',
    delta: { title },
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return title;
}

export interface TransferTitleInput {
  titleId: string;
  campaignId: string;

  newHolderId: string;
  newHolderType: string;
  newHolderName?: string;

  reason: 'inheritance' | 'grant' | 'conquest' | 'abdication' | 'purchase' | 'election';

  worldTimestamp: WorldTimestamp;
}

/**
 * Transfer a title to a new holder.
 */
export async function transferTitle(
  title: Title,
  input: TransferTitleInput
): Promise<Title> {
  const now = new Date().toISOString();

  const updated: Title = {
    ...title,
    holderId: input.newHolderId,
    holderType: input.newHolderType,
    holderName: input.newHolderName,
    heldSince: now,
    status: 'active',
    updatedAt: now,
    version: title.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'title',
    entityId: title.id,
    operation: 'update',
    delta: {
      previousHolderId: title.holderId,
      newHolderId: input.newHolderId,
      reason: input.reason,
    },
    actorId: input.newHolderId,
    actorType: input.newHolderType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

/**
 * Vacate a title (holder dies/abdicates without successor).
 */
export async function vacateTitle(
  title: Title,
  campaignId: string,
  reason: string,
  worldTimestamp: WorldTimestamp
): Promise<Title> {
  const now = new Date().toISOString();

  const updated: Title = {
    ...title,
    holderId: undefined,
    holderType: undefined,
    holderName: undefined,
    heldSince: undefined,
    status: 'vacant',
    updatedAt: now,
    version: title.version + 1,
  };

  await writeDelta({
    campaignId,
    sessionId: undefined,
    entityType: 'title',
    entityId: title.id,
    operation: 'update',
    delta: {
      previousHolderId: title.holderId,
      status: 'vacant',
      reason,
    },
    timestamp: now,
    worldTimestamp,
  });

  return updated;
}

// ============================================
// CLAIMS
// ============================================

export interface CreateClaimInput {
  campaignId: string;

  targetType: 'title' | 'estate' | 'inheritance' | 'contract_right';
  targetId: string;

  claimantId: string;
  claimantType: string;
  claimantName?: string;

  basis: {
    type: string; // inheritance, conquest, grant, purchase, divine_right
    through?: string; // Ancestor UUID
    legitimacy?: Legitimacy;
    documents?: string[];
  };

  strength?: number;

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a claim to a title, estate, or inheritance.
 */
export async function createClaim(input: CreateClaimInput): Promise<Claim> {
  const now = new Date().toISOString();
  const claimId = crypto.randomUUID();

  const claim: Claim = {
    id: claimId,
    campaignId: input.campaignId,
    targetType: input.targetType,
    targetId: input.targetId,
    claimantId: input.claimantId,
    claimantType: input.claimantType,
    claimantName: input.claimantName,
    basis: {
      type: input.basis.type,
      through: input.basis.through,
      legitimacy: input.basis.legitimacy,
      documents: input.basis.documents ?? [],
    },
    strength: input.strength ?? 50,
    recognizedBy: [],
    opposedBy: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'claim',
    entityId: claimId,
    operation: 'create',
    delta: { claim },
    actorId: input.claimantId,
    actorType: input.claimantType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return claim;
}

export interface PressClaimInput {
  claimId: string;
  campaignId: string;
  method: 'legal' | 'diplomatic' | 'military' | 'divine';
  worldTimestamp: WorldTimestamp;
}

/**
 * Press a claim (actively pursue it).
 */
export async function pressClaim(
  claim: Claim,
  input: PressClaimInput
): Promise<Claim> {
  const now = new Date().toISOString();

  const updated: Claim = {
    ...claim,
    status: 'pressed',
    updatedAt: now,
    version: claim.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'claim',
    entityId: claim.id,
    operation: 'update',
    delta: { status: 'pressed', method: input.method },
    actorId: claim.claimantId,
    actorType: claim.claimantType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface ResolveClaimInput {
  claimId: string;
  campaignId: string;
  resolution: 'granted' | 'rejected' | 'withdrawn';
  resolvedBy?: string;
  worldTimestamp: WorldTimestamp;
}

/**
 * Resolve a claim.
 */
export async function resolveClaim(
  claim: Claim,
  input: ResolveClaimInput
): Promise<Claim> {
  const now = new Date().toISOString();

  const updated: Claim = {
    ...claim,
    status: input.resolution === 'granted' ? 'resolved' :
            input.resolution === 'withdrawn' ? 'abandoned' : 'rejected',
    resolvedAt: now,
    resolution: input.resolution,
    updatedAt: now,
    version: claim.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'claim',
    entityId: claim.id,
    operation: 'update',
    delta: {
      status: updated.status,
      resolution: input.resolution,
      resolvedBy: input.resolvedBy,
    },
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// SUCCESSION CALCULATION
// ============================================

export interface SuccessionCandidate {
  entityId: string;
  entityType: string;
  entityName?: string;
  relationship: KinshipType;
  legitimacy: Legitimacy;
  claimStrength: number;
  order: number;
}

/**
 * Calculate the succession line for a title.
 */
export function calculateSuccessionLine(
  title: Title,
  currentHolderId: string,
  kinshipLinks: KinshipLink[],
  policy?: ContractPolicy
): SuccessionCandidate[] {
  const candidates: SuccessionCandidate[] = [];
  const rules = title.successionRules;

  // Find direct descendants
  const children = kinshipLinks.filter(
    k => k.entity1Id === currentHolderId &&
         k.relationship === 'child' &&
         k.status === 'active'
  );

  // Filter by legitimacy if required
  const eligibleChildren = rules.legitimacyRequired
    ? children.filter(c =>
        c.legitimacy === 'legitimate' ||
        c.legitimacy === 'legitimized' ||
        (policy?.legitimacyRules.illegitimateCanInherit && c.legitimacy === 'illegitimate') ||
        (policy?.legitimacyRules.adoptedCanInherit && c.legitimacy === 'adopted')
      )
    : children;

  // Sort by succession type
  let sortedChildren = [...eligibleChildren];

  switch (rules.type) {
    case 'primogeniture':
      // Oldest first (by creation date as proxy for birth order)
      sortedChildren.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case 'ultimogeniture':
      // Youngest first
      sortedChildren.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'male_primogeniture':
      // Males first, then by age (would need gender info from entity)
      sortedChildren.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    // For elective/appointed, candidates would come from elsewhere
  }

  // Build candidate list
  sortedChildren.forEach((child, index) => {
    candidates.push({
      entityId: child.entity2Id,
      entityType: child.entity2Type,
      relationship: 'child',
      legitimacy: child.legitimacy,
      claimStrength: calculateClaimStrength(child.legitimacy, 'child', index),
      order: index + 1,
    });
  });

  // Add spouse if no children
  if (candidates.length === 0) {
    const spouse = kinshipLinks.find(
      k => k.entity1Id === currentHolderId &&
           k.relationship === 'spouse' &&
           k.status === 'active'
    );
    if (spouse) {
      candidates.push({
        entityId: spouse.entity2Id,
        entityType: spouse.entity2Type,
        relationship: 'spouse',
        legitimacy: 'legitimate',
        claimStrength: 40,
        order: 1,
      });
    }
  }

  // Add siblings if no direct heirs
  if (candidates.length === 0) {
    const siblings = kinshipLinks.filter(
      k => k.entity1Id === currentHolderId &&
           k.relationship === 'sibling' &&
           k.status === 'active'
    );
    siblings.forEach((sibling, index) => {
      candidates.push({
        entityId: sibling.entity2Id,
        entityType: sibling.entity2Type,
        relationship: 'sibling',
        legitimacy: sibling.legitimacy,
        claimStrength: calculateClaimStrength(sibling.legitimacy, 'sibling', index),
        order: index + 1,
      });
    });
  }

  return candidates.sort((a, b) => b.claimStrength - a.claimStrength);
}

/**
 * Calculate claim strength based on legitimacy and relationship.
 */
function calculateClaimStrength(
  legitimacy: Legitimacy,
  relationship: KinshipType,
  birthOrder: number
): number {
  let base = 50;

  // Relationship modifiers
  const relationshipMods: Partial<Record<KinshipType, number>> = {
    child: 40,
    spouse: -10,
    sibling: 20,
    grandchild: 30,
    nephew: 10,
    niece: 10,
    cousin: 0,
  };
  base += relationshipMods[relationship] ?? 0;

  // Legitimacy modifiers
  const legitimacyMods: Record<Legitimacy, number> = {
    legitimate: 10,
    legitimized: 5,
    adopted: 0,
    illegitimate: -20,
    contested: -30,
    unknown: -40,
  };
  base += legitimacyMods[legitimacy];

  // Birth order penalty
  base -= birthOrder * 5;

  return Math.max(0, Math.min(100, base));
}

// ============================================
// INHERITANCE RESOLUTION
// ============================================

export interface InheritancePackage {
  titles: Title[];
  claims: Claim[];
  householdHeadship?: {
    household: Household;
    membership: HouseholdMembership;
  };
  debts: string[]; // Contract IDs
  rights: string[]; // Contract IDs
}

/**
 * Determine what a successor inherits.
 */
export function calculateInheritance(
  deceasedId: string,
  titles: Title[],
  claims: Claim[],
  households: Household[],
  memberships: HouseholdMembership[]
): InheritancePackage {
  const result: InheritancePackage = {
    titles: [],
    claims: [],
    debts: [],
    rights: [],
  };

  // Titles held by deceased
  result.titles = titles.filter(t => t.holderId === deceasedId);

  // Claims held by deceased
  result.claims = claims.filter(
    c => c.claimantId === deceasedId && c.status === 'active'
  );

  // Household headship
  const headship = households.find(h => h.headId === deceasedId);
  if (headship) {
    const membership = memberships.find(
      m => m.memberId === deceasedId && m.householdId === headship.id
    );
    if (membership) {
      result.householdHeadship = {
        household: headship,
        membership,
      };
    }
  }

  return result;
}

// ============================================
// KINSHIP QUERIES
// ============================================

/**
 * Get all kinship links for an entity.
 */
export function getKinshipLinks(
  links: KinshipLink[],
  entityId: string
): KinshipLink[] {
  return links.filter(k => k.entity1Id === entityId && k.status === 'active');
}

/**
 * Get specific relationship type.
 */
export function getRelatives(
  links: KinshipLink[],
  entityId: string,
  relationship: KinshipType
): KinshipLink[] {
  return links.filter(
    k => k.entity1Id === entityId &&
         k.relationship === relationship &&
         k.status === 'active'
  );
}

/**
 * Find parents.
 */
export function getParents(links: KinshipLink[], entityId: string): KinshipLink[] {
  return getRelatives(links, entityId, 'parent');
}

/**
 * Find children.
 */
export function getChildren(links: KinshipLink[], entityId: string): KinshipLink[] {
  return getRelatives(links, entityId, 'child');
}

/**
 * Find siblings.
 */
export function getSiblings(links: KinshipLink[], entityId: string): KinshipLink[] {
  return getRelatives(links, entityId, 'sibling');
}

/**
 * Find spouse.
 */
export function getSpouse(links: KinshipLink[], entityId: string): KinshipLink | undefined {
  return links.find(
    k => k.entity1Id === entityId &&
         k.relationship === 'spouse' &&
         k.status === 'active'
  );
}

/**
 * Check if two entities are related.
 */
export function areRelated(
  links: KinshipLink[],
  entity1Id: string,
  entity2Id: string
): KinshipLink | undefined {
  return links.find(
    k => k.entity1Id === entity1Id &&
         k.entity2Id === entity2Id &&
         k.status === 'active'
  );
}

/**
 * Find common ancestors (for incest checks, etc).
 */
export function findCommonAncestors(
  links: KinshipLink[],
  entity1Id: string,
  entity2Id: string,
  maxDepth: number = 3
): string[] {
  const ancestors1 = new Set<string>();
  const ancestors2 = new Set<string>();

  // BFS to find ancestors
  const findAncestors = (entityId: string, depth: number, ancestors: Set<string>) => {
    if (depth > maxDepth) return;
    const parents = getParents(links, entityId);
    for (const parent of parents) {
      ancestors.add(parent.entity2Id);
      findAncestors(parent.entity2Id, depth + 1, ancestors);
    }
  };

  findAncestors(entity1Id, 0, ancestors1);
  findAncestors(entity2Id, 0, ancestors2);

  // Find intersection
  const common: string[] = [];
  for (const ancestor of ancestors1) {
    if (ancestors2.has(ancestor)) {
      common.push(ancestor);
    }
  }

  return common;
}

/**
 * Calculate degree of kinship (consanguinity).
 */
export function calculateKinshipDegree(
  links: KinshipLink[],
  entity1Id: string,
  entity2Id: string,
  maxDepth: number = 5
): number | undefined {
  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: entity1Id, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.id === entity2Id) {
      return current.depth;
    }

    if (current.depth >= maxDepth || visited.has(current.id)) {
      continue;
    }

    visited.add(current.id);

    // Add all relatives
    const relatives = getKinshipLinks(links, current.id);
    for (const rel of relatives) {
      if (!visited.has(rel.entity2Id)) {
        queue.push({ id: rel.entity2Id, depth: current.depth + 1 });
      }
    }
  }

  return undefined; // Not related within maxDepth
}

// ============================================
// TITLE QUERIES
// ============================================

/**
 * Get all titles held by an entity.
 */
export function getTitlesHeld(titles: Title[], holderId: string): Title[] {
  return titles.filter(t => t.holderId === holderId && t.status === 'active');
}

/**
 * Get highest-ranking title.
 */
export function getHighestTitle(titles: Title[]): Title | undefined {
  const rankOrder = [
    'emperor', 'king', 'archduke', 'duke', 'marquess', 'count',
    'viscount', 'baron', 'baronet', 'knight', 'lord', 'mayor',
    'alderman', 'guildmaster', 'high_priest', 'abbot'
  ];

  return titles.sort((a, b) =>
    rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
  )[0];
}

/**
 * Get claims against a title.
 */
export function getClaimsAgainst(claims: Claim[], titleId: string): Claim[] {
  return claims.filter(
    c => c.targetId === titleId &&
         c.targetType === 'title' &&
         c.status === 'active'
  );
}

/**
 * Check if entity can inherit a title.
 */
export function canInheritTitle(
  title: Title,
  entityId: string,
  kinshipLinks: KinshipLink[],
  policy?: ContractPolicy
): { canInherit: boolean; reason?: string; strength: number } {
  if (!title.holderId) {
    return { canInherit: false, reason: 'Title is vacant', strength: 0 };
  }

  // Check if in succession line
  const successors = calculateSuccessionLine(title, title.holderId, kinshipLinks, policy);
  const candidate = successors.find(s => s.entityId === entityId);

  if (!candidate) {
    return { canInherit: false, reason: 'Not in succession line', strength: 0 };
  }

  // Check legitimacy requirements
  if (title.successionRules.legitimacyRequired &&
      candidate.legitimacy === 'illegitimate') {
    return {
      canInherit: false,
      reason: 'Illegitimate heirs cannot inherit this title',
      strength: candidate.claimStrength
    };
  }

  return { canInherit: true, strength: candidate.claimStrength };
}
