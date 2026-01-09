/**
 * SOCIAL CONTRACT ENGINE - Contract Operations
 *
 * Core operations for creating and managing social contracts.
 * Every operation emits a delta for the timeline.
 */

import {
  SocialContract,
  ContractEvent,
  ContractType,
  ContractParty,
  ContractTerms,
  ContractVisibility,
  ContractStatus,
} from './schema';
import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';

// ============================================
// CONTRACT CREATION
// ============================================

export interface CreateContractInput {
  campaignId: string;
  partyId?: string; // For sync_log scoping

  contractType: ContractType;
  subtype?: string;

  parties: ContractParty[];
  terms: ContractTerms;

  visibility?: ContractVisibility;
  jurisdictionId?: string;
  jurisdictionType?: string;

  worldTimestamp: WorldTimestamp;
  proposedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };
}

/**
 * Create a new contract proposal.
 * The contract starts in 'proposed' status and must be accepted by other parties.
 */
export async function proposeContract(input: CreateContractInput): Promise<{
  contract: SocialContract;
  event: ContractEvent;
}> {
  const now = new Date().toISOString();
  const contractId = crypto.randomUUID();
  const eventId = crypto.randomUUID();

  // Create the contract
  const contract: SocialContract = {
    id: contractId,
    campaignId: input.campaignId,
    contractType: input.contractType,
    subtype: input.subtype,
    parties: input.parties,
    terms: input.terms,
    visibility: input.visibility ?? 'public',
    status: 'proposed',
    jurisdictionId: input.jurisdictionId,
    jurisdictionType: input.jurisdictionType,
    proposedAt: now,
    startAt: now, // Will be updated on ratification
    worldTimestampStart: input.worldTimestamp,
    breachCount: 0,
    registered: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Create the proposal event
  const event: ContractEvent = {
    id: eventId,
    contractId,
    campaignId: input.campaignId,
    eventType: 'proposed',
    actorId: input.proposedBy.entityId,
    actorType: input.proposedBy.entityType,
    actorName: input.proposedBy.entityName,
    details: {
      contractType: input.contractType,
      parties: input.parties.map(p => ({ role: p.role, entityId: p.entityId })),
    },
    consequences: [],
    witnesses: [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  // Write to sync log
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: contractId,
    operation: 'create',
    delta: { contract, event },
    actorId: input.proposedBy.entityId,
    actorType: input.proposedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { contract, event };
}

// ============================================
// CONTRACT ACCEPTANCE
// ============================================

export interface AcceptContractInput {
  contractId: string;
  campaignId: string;
  partyId?: string;

  acceptedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  worldTimestamp: WorldTimestamp;
  witnesses?: Array<{ entityType: string; entityId: string; entityName?: string }>;
}

/**
 * Accept a contract proposal.
 * If all parties have accepted, moves to 'accepted' status.
 */
export async function acceptContract(
  contract: SocialContract,
  input: AcceptContractInput
): Promise<{
  contract: SocialContract;
  event: ContractEvent;
  allAccepted: boolean;
}> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  // Find the accepting party
  const partyIndex = contract.parties.findIndex(
    p => p.entityId === input.acceptedBy.entityId
  );

  if (partyIndex === -1) {
    throw new Error('Accepting entity is not a party to this contract');
  }

  // Update consent
  const updatedParties = [...contract.parties];
  updatedParties[partyIndex] = {
    ...updatedParties[partyIndex],
    consented: true,
    consentedAt: now,
  };

  // Check if all parties have consented
  const allAccepted = updatedParties.every(p => p.consented);

  // Update contract
  const updatedContract: SocialContract = {
    ...contract,
    parties: updatedParties,
    status: allAccepted ? 'accepted' : contract.status,
    updatedAt: now,
    version: contract.version + 1,
  };

  // Create event
  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: 'accepted',
    actorId: input.acceptedBy.entityId,
    actorType: input.acceptedBy.entityType,
    actorName: input.acceptedBy.entityName,
    details: {
      partyRole: contract.parties[partyIndex].role,
      allAccepted,
    },
    consequences: [],
    witnesses: input.witnesses ?? [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  // Write delta
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: contract.id,
    operation: 'update',
    delta: {
      status: updatedContract.status,
      parties: updatedContract.parties,
      event,
    },
    actorId: input.acceptedBy.entityId,
    actorType: input.acceptedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { contract: updatedContract, event, allAccepted };
}

// ============================================
// CONTRACT RATIFICATION
// ============================================

export interface RatifyContractInput {
  contractId: string;
  campaignId: string;
  partyId?: string;

  ratifiedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  jurisdictionId: string;
  registryNodeId?: string;

  worldTimestamp: WorldTimestamp;
  witnesses?: Array<{ entityType: string; entityId: string; entityName?: string }>;
}

/**
 * Ratify a contract - official recognition by a jurisdiction.
 * Moves contract to 'active' status.
 */
export async function ratifyContract(
  contract: SocialContract,
  input: RatifyContractInput
): Promise<{
  contract: SocialContract;
  event: ContractEvent;
}> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  if (contract.status !== 'accepted') {
    throw new Error('Contract must be accepted before ratification');
  }

  // Update contract
  const updatedContract: SocialContract = {
    ...contract,
    status: 'active',
    ratifiedAt: now,
    registered: true,
    registeredAt: now,
    registeredBy: input.ratifiedBy.entityId,
    registryNodeId: input.registryNodeId,
    jurisdictionId: input.jurisdictionId,
    startAt: now,
    worldTimestampStart: input.worldTimestamp,
    updatedAt: now,
    version: contract.version + 1,
  };

  // Create event
  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: 'ratified',
    actorId: input.ratifiedBy.entityId,
    actorType: input.ratifiedBy.entityType,
    actorName: input.ratifiedBy.entityName,
    details: {
      jurisdictionId: input.jurisdictionId,
      registryNodeId: input.registryNodeId,
    },
    consequences: [],
    witnesses: input.witnesses ?? [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  // Write delta
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: contract.id,
    operation: 'update',
    delta: {
      status: 'active',
      ratifiedAt: now,
      registered: true,
      event,
    },
    actorId: input.ratifiedBy.entityId,
    actorType: input.ratifiedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { contract: updatedContract, event };
}

// ============================================
// CONTRACT BREACH
// ============================================

export interface BreachContractInput {
  contractId: string;
  campaignId: string;
  partyId?: string;

  breachedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  breachType: string;
  severity: 'minor' | 'major' | 'total';
  description: string;

  worldTimestamp: WorldTimestamp;
  witnesses?: Array<{ entityType: string; entityId: string; entityName?: string }>;
}

/**
 * Record a contract breach.
 * This may trigger enforcement by the jurisdiction.
 */
export async function breachContract(
  contract: SocialContract,
  input: BreachContractInput
): Promise<{
  contract: SocialContract;
  event: ContractEvent;
}> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  // Update contract
  const updatedContract: SocialContract = {
    ...contract,
    status: 'breached',
    breachCount: contract.breachCount + 1,
    lastBreachAt: now,
    updatedAt: now,
    version: contract.version + 1,
  };

  // Create event
  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: 'breached',
    actorId: input.breachedBy.entityId,
    actorType: input.breachedBy.entityType,
    actorName: input.breachedBy.entityName,
    details: {
      breachType: input.breachType,
      severity: input.severity,
      description: input.description,
    },
    consequences: [], // Filled by enforcement
    witnesses: input.witnesses ?? [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  // Write delta
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: contract.id,
    operation: 'update',
    delta: {
      status: 'breached',
      breachCount: updatedContract.breachCount,
      event,
    },
    actorId: input.breachedBy.entityId,
    actorType: input.breachedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { contract: updatedContract, event };
}

// ============================================
// CONTRACT TERMINATION
// ============================================

export interface TerminateContractInput {
  contractId: string;
  campaignId: string;
  partyId?: string;

  terminatedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  reason: string;
  terminationType: 'mutual' | 'unilateral' | 'fulfilled' | 'expired' | 'annulled';

  worldTimestamp: WorldTimestamp;
}

/**
 * Terminate a contract.
 */
export async function terminateContract(
  contract: SocialContract,
  input: TerminateContractInput
): Promise<{
  contract: SocialContract;
  event: ContractEvent;
}> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const status: ContractStatus =
    input.terminationType === 'fulfilled' ? 'fulfilled' :
    input.terminationType === 'expired' ? 'expired' :
    input.terminationType === 'annulled' ? 'annulled' :
    'terminated';

  // Update contract
  const updatedContract: SocialContract = {
    ...contract,
    status,
    terminatedAt: now,
    terminationReason: input.reason,
    endAt: now,
    worldTimestampEnd: input.worldTimestamp,
    updatedAt: now,
    version: contract.version + 1,
  };

  // Create event
  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: input.terminationType === 'fulfilled' ? 'fulfilled' :
               input.terminationType === 'expired' ? 'expired' :
               input.terminationType === 'annulled' ? 'annulled' :
               'terminated',
    actorId: input.terminatedBy.entityId,
    actorType: input.terminatedBy.entityType,
    actorName: input.terminatedBy.entityName,
    details: {
      reason: input.reason,
      terminationType: input.terminationType,
    },
    consequences: [],
    witnesses: [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  // Write delta
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: contract.id,
    operation: 'update',
    delta: {
      status,
      terminatedAt: now,
      terminationReason: input.reason,
      event,
    },
    actorId: input.terminatedBy.entityId,
    actorType: input.terminatedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { contract: updatedContract, event };
}

// ============================================
// CONTRACT QUERIES
// ============================================

/**
 * Get all active contracts for an entity.
 */
export function getActiveContracts(
  contracts: SocialContract[],
  entityId: string
): SocialContract[] {
  return contracts.filter(c =>
    c.status === 'active' &&
    c.parties.some(p => p.entityId === entityId)
  );
}

/**
 * Get contracts by type for an entity.
 */
export function getContractsByType(
  contracts: SocialContract[],
  entityId: string,
  contractType: ContractType
): SocialContract[] {
  return contracts.filter(c =>
    c.contractType === contractType &&
    c.parties.some(p => p.entityId === entityId)
  );
}

/**
 * Check if entity has a specific type of active contract.
 */
export function hasActiveContract(
  contracts: SocialContract[],
  entityId: string,
  contractType: ContractType
): boolean {
  return contracts.some(c =>
    c.status === 'active' &&
    c.contractType === contractType &&
    c.parties.some(p => p.entityId === entityId)
  );
}

/**
 * Get the other party in a two-party contract.
 */
export function getOtherParty(
  contract: SocialContract,
  entityId: string
): ContractParty | undefined {
  return contract.parties.find(p => p.entityId !== entityId);
}

/**
 * Check if entity can exit a contract.
 */
export function canExitContract(
  contract: SocialContract,
  entityId: string
): { canExit: boolean; conditions: string[] } {
  const party = contract.parties.find(p => p.entityId === entityId);
  if (!party) {
    return { canExit: false, conditions: ['Not a party to this contract'] };
  }
  return {
    canExit: party.canExit,
    conditions: party.exitConditions,
  };
}

/**
 * Get contracts between two entities.
 */
export function getContractsBetween(
  contracts: SocialContract[],
  entity1Id: string,
  entity2Id: string
): SocialContract[] {
  return contracts.filter(c =>
    c.parties.some(p => p.entityId === entity1Id) &&
    c.parties.some(p => p.entityId === entity2Id)
  );
}

// ============================================
// CONTRACT OBLIGATION/RIGHT EVENTS
// ============================================

export interface FulfillObligationInput {
  contractId: string;
  campaignId: string;
  partyId?: string;

  fulfilledBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  obligation: string;
  evidence?: string;

  worldTimestamp: WorldTimestamp;
}

/**
 * Record fulfillment of a contract obligation.
 */
export async function fulfillObligation(
  contract: SocialContract,
  input: FulfillObligationInput
): Promise<ContractEvent> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: 'obligation_fulfilled',
    actorId: input.fulfilledBy.entityId,
    actorType: input.fulfilledBy.entityType,
    actorName: input.fulfilledBy.entityName,
    details: {
      obligation: input.obligation,
      evidence: input.evidence,
    },
    consequences: [],
    witnesses: [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract_event',
    entityId: eventId,
    operation: 'create',
    delta: { event },
    actorId: input.fulfilledBy.entityId,
    actorType: input.fulfilledBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return event;
}

export interface ExerciseRightInput {
  contractId: string;
  campaignId: string;
  partyId?: string;

  exercisedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  right: string;
  details?: string;

  worldTimestamp: WorldTimestamp;
}

/**
 * Record exercise of a contract right.
 */
export async function exerciseRight(
  contract: SocialContract,
  input: ExerciseRightInput
): Promise<ContractEvent> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: 'right_exercised',
    actorId: input.exercisedBy.entityId,
    actorType: input.exercisedBy.entityType,
    actorName: input.exercisedBy.entityName,
    details: {
      right: input.right,
      exerciseDetails: input.details,
    },
    consequences: [],
    witnesses: [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract_event',
    entityId: eventId,
    operation: 'create',
    delta: { event },
    actorId: input.exercisedBy.entityId,
    actorType: input.exercisedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return event;
}

/**
 * Reject a contract proposal.
 */
export async function rejectContract(
  contract: SocialContract,
  input: {
    campaignId: string;
    rejectedBy: { entityId: string; entityType: string; entityName?: string };
    reason?: string;
    worldTimestamp: WorldTimestamp;
  }
): Promise<{ contract: SocialContract; event: ContractEvent }> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const updatedContract: SocialContract = {
    ...contract,
    status: 'terminated',
    terminatedAt: now,
    terminationReason: input.reason ?? 'Proposal rejected',
    updatedAt: now,
    version: contract.version + 1,
  };

  const event: ContractEvent = {
    id: eventId,
    contractId: contract.id,
    campaignId: input.campaignId,
    eventType: 'rejected',
    actorId: input.rejectedBy.entityId,
    actorType: input.rejectedBy.entityType,
    actorName: input.rejectedBy.entityName,
    details: { reason: input.reason },
    consequences: [],
    witnesses: [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: contract.id,
    operation: 'update',
    delta: { status: 'terminated', event },
    actorId: input.rejectedBy.entityId,
    actorType: input.rejectedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { contract: updatedContract, event };
}
