/**
 * SOCIAL CONTRACT ENGINE - Jurisdiction & Enforcement
 *
 * Jurisdictions define who can enforce what, where.
 * This is where factions become policy engines with real teeth.
 */

import {
  Jurisdiction,
  JurisdictionType,
  ContractType,
  ContractPolicy,
  SocialContract,
  ContractEvent,
} from './schema';
import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';

// ============================================
// JURISDICTION CREATION
// ============================================

export interface CreateJurisdictionInput {
  campaignId: string;

  name: string;
  type: JurisdictionType;

  authorityId?: string;
  authorityType?: string;

  scopeNodeId?: string;
  scopeType?: string;

  precedence?: number;
  recognizedContracts?: ContractType[];

  enforcement?: {
    canFine?: boolean;
    canImprison?: boolean;
    canExile?: boolean;
    canExecute?: boolean;
    canExcommunicate?: boolean;
    canConfiscate?: boolean;
    canCurse?: boolean;
  };

  maintainsRegistry?: boolean;
  registryTypes?: string[];

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a new jurisdiction.
 */
export async function createJurisdiction(
  input: CreateJurisdictionInput
): Promise<Jurisdiction> {
  const now = new Date().toISOString();
  const jurisdictionId = crypto.randomUUID();

  const jurisdiction: Jurisdiction = {
    id: jurisdictionId,
    campaignId: input.campaignId,
    name: input.name,
    type: input.type,
    authorityId: input.authorityId,
    authorityType: input.authorityType,
    scopeNodeId: input.scopeNodeId,
    scopeType: input.scopeType,
    precedence: input.precedence ?? 50,
    recognizedContracts: input.recognizedContracts ?? [],
    enforcement: {
      canFine: input.enforcement?.canFine ?? true,
      canImprison: input.enforcement?.canImprison ?? false,
      canExile: input.enforcement?.canExile ?? false,
      canExecute: input.enforcement?.canExecute ?? false,
      canExcommunicate: input.enforcement?.canExcommunicate ?? false,
      canConfiscate: input.enforcement?.canConfiscate ?? false,
      canCurse: input.enforcement?.canCurse ?? false,
    },
    maintainsRegistry: input.maintainsRegistry ?? false,
    registryTypes: input.registryTypes ?? [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'jurisdiction',
    entityId: jurisdictionId,
    operation: 'create',
    delta: { jurisdiction },
    actorId: input.authorityId,
    actorType: input.authorityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return jurisdiction;
}

// ============================================
// POLICY MANAGEMENT
// ============================================

export interface CreatePolicyInput {
  jurisdictionId: string;
  campaignId: string;

  contractType: ContractType;

  recognitionRules?: {
    requiresRegistration?: boolean;
    requiresWitnesses?: number;
    minimumAge?: number;
    requiresConsent?: boolean;
    prohibitedParties?: string[];
  };

  legitimacyRules?: {
    illegitimateCanInherit?: boolean;
    adoptedCanInherit?: boolean;
    legitimizationAllowed?: boolean;
    legitimizationCost?: number;
  };

  penalties?: Array<{
    offense: string;
    penalty: string;
    amount?: number;
    duration?: string;
  }>;

  terminationRules?: {
    divorceAllowed?: boolean;
    divorceCost?: number;
    annulmentGrounds?: string[];
    mutualTermination?: boolean;
    unilateralTermination?: boolean;
  };

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a contract policy for a jurisdiction.
 */
export async function createPolicy(
  input: CreatePolicyInput
): Promise<ContractPolicy> {
  const now = new Date().toISOString();
  const policyId = crypto.randomUUID();

  const policy: ContractPolicy = {
    id: policyId,
    jurisdictionId: input.jurisdictionId,
    contractType: input.contractType,
    recognitionRules: {
      requiresRegistration: input.recognitionRules?.requiresRegistration ?? false,
      requiresWitnesses: input.recognitionRules?.requiresWitnesses ?? 0,
      minimumAge: input.recognitionRules?.minimumAge,
      requiresConsent: input.recognitionRules?.requiresConsent ?? true,
      prohibitedParties: input.recognitionRules?.prohibitedParties ?? [],
    },
    legitimacyRules: {
      illegitimateCanInherit: input.legitimacyRules?.illegitimateCanInherit ?? false,
      adoptedCanInherit: input.legitimacyRules?.adoptedCanInherit ?? true,
      legitimizationAllowed: input.legitimacyRules?.legitimizationAllowed ?? true,
      legitimizationCost: input.legitimacyRules?.legitimizationCost,
    },
    penalties: input.penalties ?? [],
    exceptions: [],
    terminationRules: {
      divorceAllowed: input.terminationRules?.divorceAllowed ?? false,
      divorceCost: input.terminationRules?.divorceCost,
      annulmentGrounds: input.terminationRules?.annulmentGrounds ?? [],
      mutualTermination: input.terminationRules?.mutualTermination ?? true,
      unilateralTermination: input.terminationRules?.unilateralTermination ?? false,
    },
    status: 'active',
    effectiveFrom: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'contract_policy',
    entityId: policyId,
    operation: 'create',
    delta: { policy },
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return policy;
}

// ============================================
// ENFORCEMENT
// ============================================

export interface EnforceBreachInput {
  contract: SocialContract;
  breachEvent: ContractEvent;
  jurisdiction: Jurisdiction;
  policy?: ContractPolicy;
  campaignId: string;
  partyId?: string;

  enforcedBy: {
    entityId: string;
    entityType: string;
    entityName?: string;
  };

  worldTimestamp: WorldTimestamp;
}

export interface EnforcementResult {
  event: ContractEvent;
  consequences: Array<{
    type: string;
    target: string;
    effect: string;
    applied: boolean;
  }>;
}

/**
 * Enforce a contract breach according to jurisdiction policy.
 */
export async function enforceBreach(
  input: EnforceBreachInput
): Promise<EnforcementResult> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const consequences: EnforcementResult['consequences'] = [];

  // Find applicable penalty from policy
  if (input.policy) {
    const breachType = input.breachEvent.details?.breachType;
    const penalty = input.policy.penalties.find(p => p.offense === breachType);

    if (penalty) {
      consequences.push({
        type: penalty.penalty,
        target: input.breachEvent.actorId ?? 'unknown',
        effect: penalty.amount ? `${penalty.penalty}: ${penalty.amount}` : penalty.penalty,
        applied: true,
      });
    }
  }

  // Default consequences based on jurisdiction capabilities
  if (consequences.length === 0) {
    if (input.jurisdiction.enforcement.canFine) {
      consequences.push({
        type: 'fine',
        target: input.breachEvent.actorId ?? 'unknown',
        effect: 'Standard fine applied',
        applied: true,
      });
    }
  }

  // Create enforcement event
  const event: ContractEvent = {
    id: eventId,
    contractId: input.contract.id,
    campaignId: input.campaignId,
    eventType: 'enforced',
    actorId: input.enforcedBy.entityId,
    actorType: input.enforcedBy.entityType,
    actorName: input.enforcedBy.entityName,
    details: {
      breachEventId: input.breachEvent.id,
      jurisdictionId: input.jurisdiction.id,
      policyId: input.policy?.id,
    },
    consequences,
    witnesses: [],
    worldTimestamp: input.worldTimestamp,
    timestamp: now,
  };

  // Write delta
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'social_contract',
    entityId: input.contract.id,
    operation: 'update',
    delta: {
      enforcement: event,
      consequences,
    },
    actorId: input.enforcedBy.entityId,
    actorType: input.enforcedBy.entityType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return { event, consequences };
}

// ============================================
// JURISDICTION QUERIES
// ============================================

/**
 * Find the highest-precedence jurisdiction for a location.
 */
export function findJurisdiction(
  jurisdictions: Jurisdiction[],
  nodeId: string,
  contractType?: ContractType
): Jurisdiction | undefined {
  const applicable = jurisdictions
    .filter(j =>
      j.status === 'active' &&
      (j.scopeNodeId === nodeId || !j.scopeNodeId) &&
      (!contractType || j.recognizedContracts.includes(contractType))
    )
    .sort((a, b) => b.precedence - a.precedence);

  return applicable[0];
}

/**
 * Check if a jurisdiction recognizes a contract type.
 */
export function recognizesContract(
  jurisdiction: Jurisdiction,
  contractType: ContractType
): boolean {
  return jurisdiction.recognizedContracts.includes(contractType);
}

/**
 * Check if a contract is enforceable in a jurisdiction.
 */
export function isEnforceable(
  contract: SocialContract,
  jurisdiction: Jurisdiction
): boolean {
  // Secret contracts are not enforceable by public authorities
  if (contract.visibility === 'secret') {
    return false;
  }

  // Must be a recognized contract type
  if (!recognizesContract(jurisdiction, contract.contractType)) {
    return false;
  }

  // Must be registered if required
  // (Would check policy here)

  return true;
}

/**
 * Get all enforcement options for a jurisdiction.
 */
export function getEnforcementOptions(jurisdiction: Jurisdiction): string[] {
  const options: string[] = [];

  if (jurisdiction.enforcement.canFine) options.push('fine');
  if (jurisdiction.enforcement.canImprison) options.push('imprison');
  if (jurisdiction.enforcement.canExile) options.push('exile');
  if (jurisdiction.enforcement.canExecute) options.push('execute');
  if (jurisdiction.enforcement.canExcommunicate) options.push('excommunicate');
  if (jurisdiction.enforcement.canConfiscate) options.push('confiscate');
  if (jurisdiction.enforcement.canCurse) options.push('curse');

  return options;
}

/**
 * Check if a jurisdiction maintains a registry for a type.
 */
export function maintainsRegistry(
  jurisdiction: Jurisdiction,
  registryType: string
): boolean {
  return jurisdiction.maintainsRegistry &&
         jurisdiction.registryTypes.includes(registryType);
}

// ============================================
// POLICY QUERIES
// ============================================

/**
 * Get policy for a contract type in a jurisdiction.
 */
export function getPolicy(
  policies: ContractPolicy[],
  jurisdictionId: string,
  contractType: ContractType
): ContractPolicy | undefined {
  return policies.find(
    p => p.jurisdictionId === jurisdictionId &&
         p.contractType === contractType &&
         p.status === 'active'
  );
}

/**
 * Check if a contract can be terminated under policy.
 */
export function canTerminate(
  policy: ContractPolicy,
  terminationType: 'mutual' | 'unilateral' | 'divorce' | 'annulment',
  grounds?: string
): { allowed: boolean; cost?: number; reason?: string } {
  switch (terminationType) {
    case 'mutual':
      return { allowed: policy.terminationRules.mutualTermination };

    case 'unilateral':
      return { allowed: policy.terminationRules.unilateralTermination };

    case 'divorce':
      if (!policy.terminationRules.divorceAllowed) {
        return { allowed: false, reason: 'Divorce not allowed under this jurisdiction' };
      }
      return {
        allowed: true,
        cost: policy.terminationRules.divorceCost
      };

    case 'annulment':
      if (!grounds) {
        return { allowed: false, reason: 'Annulment requires grounds' };
      }
      if (!policy.terminationRules.annulmentGrounds.includes(grounds)) {
        return { allowed: false, reason: `"${grounds}" is not valid grounds for annulment` };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Unknown termination type' };
  }
}

/**
 * Check if contract formation is valid under policy.
 */
export function validateFormation(
  policy: ContractPolicy,
  parties: Array<{ age?: number; consented: boolean }>,
  witnesses: number,
  isRegistered: boolean
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check registration
  if (policy.recognitionRules.requiresRegistration && !isRegistered) {
    errors.push('Contract must be registered');
  }

  // Check witnesses
  if (witnesses < policy.recognitionRules.requiresWitnesses) {
    errors.push(`Requires ${policy.recognitionRules.requiresWitnesses} witnesses, has ${witnesses}`);
  }

  // Check consent
  if (policy.recognitionRules.requiresConsent) {
    const nonConsenting = parties.filter(p => !p.consented);
    if (nonConsenting.length > 0) {
      errors.push('All parties must consent');
    }
  }

  // Check age
  if (policy.recognitionRules.minimumAge) {
    const underage = parties.filter(p => p.age && p.age < policy.recognitionRules.minimumAge!);
    if (underage.length > 0) {
      errors.push(`Parties must be at least ${policy.recognitionRules.minimumAge} years old`);
    }
  }

  return { valid: errors.length === 0, errors };
}
