import { z } from 'zod';
import { writeDelta } from '../../timeline/deltas';
import type { WorldTimestamp } from '../../timeline/substrate';
import {
  type ServiceContract,
  type RiskContract,
  type GuaranteeContract,
  type CoveredEventType,
} from './types';
import { getRiskContract, fileClaim } from './contracts';
import { triggerGuarantee, findGuaranteesForContract } from './contracts';

// ============================================
// ECONOMY SERVICE EVENTS
// ============================================
//
// Services emit deltas ONLY when:
// - contract is created
// - payment missed
// - contract completed
// - contract failed
// - guarantee triggered
// - claim filed/approved/denied
// - enforcement action begins
// - enforcement completes
//
// NO continuous delta emission.
// All commits go through existing timeline delta pipeline.
//
// Invariant: Power never erases consequences.
// Services only delay, reassign, or concentrate consequences.
//

// ============================================
// CANONICAL DELTA TYPES
// ============================================

/**
 * Canonical delta event types for service economy.
 * These are the ONLY events that emit deltas.
 */
export const ServiceDeltaType = {
  // Service contracts
  SERVICE_CONTRACT_CREATED: 'SERVICE_CONTRACT_CREATED',
  SERVICE_CONTRACT_ACTIVATED: 'SERVICE_CONTRACT_ACTIVATED',
  SERVICE_CONTRACT_COMPLETED: 'SERVICE_CONTRACT_COMPLETED',
  SERVICE_CONTRACT_FAILED: 'SERVICE_CONTRACT_FAILED',
  SERVICE_CONTRACT_CANCELLED: 'SERVICE_CONTRACT_CANCELLED',
  SERVICE_PAYMENT_MISSED: 'SERVICE_PAYMENT_MISSED',

  // Risk contracts (insurance)
  RISK_CONTRACT_CREATED: 'RISK_CONTRACT_CREATED',
  CLAIM_FILED: 'CLAIM_FILED',
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_DENIED: 'CLAIM_DENIED',
  CLAIM_PAID: 'CLAIM_PAID',

  // Guarantee contracts
  GUARANTEE_ISSUED: 'GUARANTEE_ISSUED',
  GUARANTEE_TRIGGERED: 'GUARANTEE_TRIGGERED',
  GUARANTEE_RELEASED: 'GUARANTEE_RELEASED',

  // Enforcement
  ENFORCEMENT_ACTION_STARTED: 'ENFORCEMENT_ACTION_STARTED',
  ENFORCEMENT_ACTION_COMPLETED: 'ENFORCEMENT_ACTION_COMPLETED',

  // Provider lifecycle
  PROVIDER_REGISTERED: 'PROVIDER_REGISTERED',
  PROVIDER_UPGRADED: 'PROVIDER_UPGRADED',
  PROVIDER_SUSPENDED: 'PROVIDER_SUSPENDED',
  PROVIDER_BANKRUPT: 'PROVIDER_BANKRUPT',
} as const;
export type ServiceDeltaType = typeof ServiceDeltaType[keyof typeof ServiceDeltaType];

// ============================================
// EVENT TYPES (For queries, not delta emission)
// ============================================

export const ServiceEventTypeSchema = z.enum([
  // Contract lifecycle
  'contract_created',
  'contract_activated',
  'contract_completed',
  'contract_failed',
  'contract_cancelled',

  // Insurance events
  'claim_filed',
  'claim_approved',
  'claim_denied',
  'claim_paid',

  // Guarantee events
  'guarantee_triggered',
  'guarantee_enforced',
  'guarantee_released',

  // Provider events
  'provider_registered',
  'provider_upgraded',
  'provider_suspended',
  'provider_bankrupt',
  'fame_changed',
  'capital_changed',

  // Covered event types (for insurance)
  'cargo_loss',
  'route_attack',
  'theft',
  'fire',
  'flood',
  'death',
  'injury',
  'contract_default',
  'political_seizure',
  'magical_accident',
]);
export type ServiceEventType = z.infer<typeof ServiceEventTypeSchema>;

export const ServiceEventSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  eventType: ServiceEventTypeSchema,
  timestamp: z.string(), // WorldTimestamp JSON

  // What triggered this event
  sourceEntityId: z.string().uuid(),
  sourceEntityType: z.string(),

  // Affected parties
  affectedEntities: z.array(z.object({
    entityId: z.string().uuid(),
    entityType: z.string(),
    impact: z.string(),
  })).default([]),

  // Event details
  details: z.record(z.string(), z.unknown()).default({}),

  // Monetary impact
  monetaryImpact: z.number().optional(),

  // Was this handled by insurance/guarantee?
  mitigatedBy: z.object({
    contractType: z.enum(['insurance', 'guarantee']),
    contractId: z.string().uuid(),
    mitigationAmount: z.number(),
  }).optional(),

  createdAt: z.string(),
});
export type ServiceEvent = z.infer<typeof ServiceEventSchema>;

// ============================================
// EVENT DETECTION
// ============================================

/**
 * Check if an event is covered by any active risk contracts.
 * Returns matching contracts that could pay out.
 */
export async function findCoveringInsurance(
  _campaignId: string,
  _eventType: CoveredEventType,
  _affectedEntityId: string,
  _affectedEntityType: string,
): Promise<RiskContract[]> {
  // This would query risk_contracts where:
  // - client matches affected entity
  // - event type is in covered list
  // - contract is active
  // For now, return empty - full implementation would use database query
  return [];
}

/**
 * Check if a contract failure triggers any guarantees.
 */
export async function findActiveGuarantees(
  contractId: string,
): Promise<GuaranteeContract[]> {
  return findGuaranteesForContract(contractId);
}

// ============================================
// EVENT HANDLING
// ============================================

export interface HandleCoveredEventInput {
  campaignId: string;
  eventType: CoveredEventType;
  worldTimestamp: WorldTimestamp;
  affectedEntityId: string;
  affectedEntityType: string;
  damageAmount: number;
  description: string;
}

/**
 * Handle a covered event (loss, attack, etc.)
 * This automatically files claims against applicable insurance.
 */
export async function handleCoveredEvent(
  input: HandleCoveredEventInput,
): Promise<{
  eventId: string;
  claimsFiled: Array<{ contractId: string; claimId: string; status: string }>;
}> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  // Find applicable insurance
  const coveringContracts = await findCoveringInsurance(
    input.campaignId,
    input.eventType,
    input.affectedEntityId,
    input.affectedEntityType,
  );

  const claimsFiled: Array<{ contractId: string; claimId: string; status: string }> = [];

  // File claims against each covering contract
  for (const contract of coveringContracts) {
    const claimResult = await fileClaim(
      contract.id,
      input.eventType,
      input.damageAmount,
      input.worldTimestamp,
    );

    claimsFiled.push({
      contractId: contract.id,
      claimId: claimResult.claimId,
      status: claimResult.status,
    });
  }

  // Emit event delta
  await writeDelta({
    campaignId: input.campaignId,
    entityType: 'service_event',
    entityId: eventId,
    operation: 'create',
    delta: {
      eventType: input.eventType,
      affectedEntityId: input.affectedEntityId,
      damageAmount: input.damageAmount,
      description: input.description,
      claimsFiled,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return { eventId, claimsFiled };
}

/**
 * Handle contract failure and trigger guarantees.
 */
export async function handleContractFailure(
  contractId: string,
  failureReason: string,
  worldTimestamp: WorldTimestamp,
): Promise<{
  guaranteesTriggered: Array<{ guaranteeId: string; enforcementContractId?: string }>;
}> {
  const guarantees = await findActiveGuarantees(contractId);
  const results: Array<{ guaranteeId: string; enforcementContractId?: string }> = [];

  for (const guarantee of guarantees) {
    // Check if failure type is covered
    const isCovered = guarantee.coveredFailures.some(
      f => f.failureType === 'any' || f.failureType === failureReason,
    );

    if (isCovered) {
      const triggerResult = await triggerGuarantee(
        guarantee.id,
        failureReason,
        worldTimestamp,
      );

      if (triggerResult.success) {
        results.push({
          guaranteeId: guarantee.id,
          enforcementContractId: triggerResult.enforcementContractId,
        });
      }
    }
  }

  return { guaranteesTriggered: results };
}

// ============================================
// CONSEQUENCE PROPAGATION
// ============================================

/**
 * Calculate ripple effects of a service failure.
 * Power never erases consequences - they propagate.
 */
export function calculateConsequences(
  failedContract: ServiceContract,
  dependentContracts: ServiceContract[],
): Array<{
  contractId: string;
  consequence: 'delayed' | 'degraded' | 'failed';
  impact: string;
}> {
  const consequences: Array<{
    contractId: string;
    consequence: 'delayed' | 'degraded' | 'failed';
    impact: string;
  }> = [];

  for (const dependent of dependentContracts) {
    // Analyze dependency relationship
    // For now, simple propagation: failure causes delays
    consequences.push({
      contractId: dependent.id,
      consequence: 'delayed',
      impact: `Dependent on failed contract ${failedContract.id}`,
    });
  }

  return consequences;
}

// ============================================
// INSURANCE CLAIM PROCESSING
// ============================================

export interface ProcessClaimInput {
  contractId: string;
  claimId: string;
  approved: boolean;
  approvedAmount?: number;
  denialReason?: string;
  worldTimestamp: WorldTimestamp;
}

/**
 * Process an insurance claim (approve or deny).
 */
export async function processClaim(
  input: ProcessClaimInput,
): Promise<{ success: boolean; payoutAmount?: number }> {
  const contract = await getRiskContract(input.contractId);
  if (!contract) {
    throw new Error(`Risk contract not found: ${input.contractId}`);
  }

  const claimIndex = contract.claims.findIndex(c => c.claimId === input.claimId);
  if (claimIndex === -1) {
    throw new Error(`Claim not found: ${input.claimId}`);
  }

  const claim = contract.claims[claimIndex];
  if (claim.status !== 'pending') {
    throw new Error(`Claim already processed: ${claim.status}`);
  }

  const now = new Date().toISOString();
  const newStatus = input.approved ? 'approved' : 'denied';
  const payoutAmount = input.approved ? (input.approvedAmount ?? claim.amount) : 0;

  // Update claim status
  const updatedClaims = [...contract.claims];
  updatedClaims[claimIndex] = {
    ...claim,
    status: newStatus as 'pending' | 'approved' | 'denied' | 'paid',
    resolvedAt: JSON.stringify(input.worldTimestamp),
  };

  // This would update the database
  // For now, just emit the delta
  await writeDelta({
    campaignId: contract.campaignId,
    entityType: 'risk_contract',
    entityId: contract.id,
    operation: 'update',
    delta: {
      claimProcessed: {
        claimId: input.claimId,
        status: newStatus,
        amount: payoutAmount,
        denialReason: input.denialReason,
      },
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return { success: true, payoutAmount };
}

// ============================================
// PROVIDER EVENTS
// ============================================

/**
 * Emit a provider event (registration, upgrade, etc.)
 */
export async function emitProviderEvent(
  campaignId: string,
  providerId: string,
  eventType: 'provider_registered' | 'provider_upgraded' | 'provider_suspended' | 'provider_bankrupt' | 'fame_changed' | 'capital_changed',
  details: Record<string, unknown>,
  worldTimestamp: WorldTimestamp,
): Promise<void> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  await writeDelta({
    campaignId,
    entityType: 'service_event',
    entityId: eventId,
    operation: 'create',
    delta: {
      eventType,
      providerId,
      details,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp,
  });
}

// ============================================
// EVENT QUERIES
// ============================================

/**
 * Query structure for finding events affecting an entity.
 * (Would be implemented with actual database queries)
 */
export interface EventQuery {
  campaignId: string;
  entityId?: string;
  eventTypes?: ServiceEventType[];
  fromTimestamp?: WorldTimestamp;
  toTimestamp?: WorldTimestamp;
  limit?: number;
}

/**
 * Find events matching query criteria.
 * This is observation-scoped: events are only "run" when queried.
 */
export async function findEvents(_query: EventQuery): Promise<ServiceEvent[]> {
  // Would query sync_log for service_event deltas
  // For now, return empty - full implementation would use getDeltasByTime
  return [];
}

// ============================================
// CONSEQUENCE TYPES
// ============================================

/**
 * Consequences that can result from service events.
 * Power never erases these - only transfers responsibility.
 */
export const ConsequenceTypeSchema = z.enum([
  // Financial
  'monetary_loss',
  'payment_obligation',
  'collateral_seizure',

  // Reputational
  'fame_loss',
  'fame_gain',
  'trust_damage',

  // Operational
  'service_delay',
  'service_degradation',
  'contract_breach',

  // Legal
  'legal_liability',
  'enforcement_action',

  // Physical
  'cargo_destroyed',
  'property_damaged',
  'injury_sustained',
]);
export type ConsequenceType = z.infer<typeof ConsequenceTypeSchema>;

export const ConsequenceSchema = z.object({
  id: z.string().uuid(),
  type: ConsequenceTypeSchema,
  sourceEventId: z.string().uuid(),
  affectedEntityId: z.string().uuid(),
  affectedEntityType: z.string(),
  severity: z.enum(['minor', 'moderate', 'major', 'catastrophic']),
  monetaryValue: z.number().optional(),
  description: z.string(),

  // How was this consequence handled?
  mitigatedBy: z.enum(['insurance', 'guarantee', 'self', 'none']).default('none'),
  mitigationContractId: z.string().uuid().optional(),
  residualDamage: z.number().optional(),
});
export type Consequence = z.infer<typeof ConsequenceSchema>;

/**
 * Create a consequence from an event.
 * This makes the consequence relationship explicit in the data model.
 */
export function createConsequence(
  sourceEventId: string,
  type: ConsequenceType,
  affectedEntityId: string,
  affectedEntityType: string,
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic',
  monetaryValue: number | undefined,
  description: string,
): Consequence {
  return {
    id: crypto.randomUUID(),
    type,
    sourceEventId,
    affectedEntityId,
    affectedEntityType,
    severity,
    monetaryValue,
    description,
    mitigatedBy: 'none',
  };
}

/**
 * Apply mitigation to a consequence (insurance/guarantee payout).
 * The consequence still exists; it's just been reassigned.
 */
export function mitigateConsequence(
  consequence: Consequence,
  mitigationType: 'insurance' | 'guarantee',
  mitigationContractId: string,
  mitigationAmount: number,
): Consequence {
  const residualDamage = consequence.monetaryValue
    ? Math.max(0, consequence.monetaryValue - mitigationAmount)
    : undefined;

  return {
    ...consequence,
    mitigatedBy: mitigationType,
    mitigationContractId,
    residualDamage,
  };
}
