import { query, queryOne, queryAll } from '../../../db/client';
import { writeDelta } from '../../timeline/deltas';
import type { WorldTimestamp } from '../../timeline/substrate';
import {
  type ServiceContract,
  type RiskContract,
  type GuaranteeContract,
  type ServiceQuote,
  type ContractStatus,
  type EntityType,
  type CoveredEventType,
  type EnforcementMethod,
  type ServiceScope,
  type VisibilityPolicy,
  type CollateralItem,
  type FailureType,
  type Exclusion,
  ServiceContractSchema,
  RiskContractSchema,
  GuaranteeContractSchema,
} from './types';

// ============================================
// CONTRACT LIFECYCLE MANAGEMENT
// ============================================
//
// Contract flow: proposed -> active -> completed/failed/cancelled
//
// All state changes go through writeDelta.
// Contracts are immutable once created; only status changes.
//

// ============================================
// SERVICE CONTRACT OPERATIONS
// ============================================

export interface CreateServiceContractInput {
  campaignId: string;
  providerId: string;
  clientEntityId: string;
  clientEntityType: EntityType;
  serviceType: string;
  scope: ServiceScope;
  startTime: WorldTimestamp;
  endTime?: WorldTimestamp;
  urgency: 'routine' | 'priority' | 'emergency';
  visibilityPolicy?: VisibilityPolicy;
  quote: ServiceQuote;
}

/**
 * Create a new service contract from a quote.
 * Contract starts in 'proposed' status.
 */
export async function createServiceContract(
  input: CreateServiceContractInput,
): Promise<ServiceContract> {
  const now = new Date().toISOString();
  const contractId = crypto.randomUUID();

  const contract: ServiceContract = {
    id: contractId,
    campaignId: input.campaignId,
    providerId: input.providerId,
    clientEntityId: input.clientEntityId,
    clientEntityType: input.clientEntityType,
    serviceType: input.quote.serviceType,
    scope: input.scope,
    startTime: JSON.stringify(input.startTime),
    endTime: input.endTime ? JSON.stringify(input.endTime) : undefined,
    urgency: input.urgency,
    visibilityPolicy: input.visibilityPolicy ?? { public: true, visibleTo: [], hiddenFrom: [] },
    status: 'proposed',
    baseQuoteGp: input.quote.totalQuoteGp,
    executionMetadata: { slotsConsumed: 0, executionNotes: [] },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Validate schema
  ServiceContractSchema.parse(contract);

  // Insert into database
  await query(
    `INSERT INTO service_contracts (
      id, campaign_id, provider_id,
      client_entity_id, client_entity_type,
      service_type, scope, start_time, end_time,
      urgency, visibility_policy, status,
      base_quote_gp, final_cost_gp,
      execution_metadata, outcome,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contract.id,
      contract.campaignId,
      contract.providerId,
      contract.clientEntityId,
      contract.clientEntityType,
      contract.serviceType,
      JSON.stringify(contract.scope),
      contract.startTime,
      contract.endTime ?? null,
      contract.urgency,
      JSON.stringify(contract.visibilityPolicy),
      contract.status,
      contract.baseQuoteGp,
      null,
      JSON.stringify(contract.executionMetadata),
      null,
      contract.createdAt,
      contract.updatedAt,
      contract.version,
    ],
  );

  // Emit delta
  await writeDelta({
    campaignId: input.campaignId,
    entityType: 'service_contract',
    entityId: contractId,
    operation: 'create',
    delta: { contract },
    actorType: 'system',
    timestamp: now,
  });

  return contract;
}

/**
 * Accept a proposed contract, making it active.
 */
export async function activateContract(
  contractId: string,
  worldTimestamp: WorldTimestamp,
): Promise<ServiceContract> {
  const contract = await getServiceContract(contractId);
  if (!contract) {
    throw new Error(`Service contract not found: ${contractId}`);
  }

  if (contract.status !== 'proposed') {
    throw new Error(`Cannot activate contract with status: ${contract.status}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE service_contracts
     SET status = 'active', final_cost_gp = base_quote_gp, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [now, contractId],
  );

  await writeDelta({
    campaignId: contract.campaignId,
    entityType: 'service_contract',
    entityId: contractId,
    operation: 'update',
    delta: { status: 'active', finalCostGp: contract.baseQuoteGp },
    actorType: 'system',
    timestamp: now,
    worldTimestamp,
  });

  return {
    ...contract,
    status: 'active',
    finalCostGp: contract.baseQuoteGp,
    updatedAt: now,
    version: contract.version + 1,
  };
}

/**
 * Complete a contract successfully.
 */
export async function completeContract(
  contractId: string,
  outcome: { success: boolean; outcome: string; deltasWritten: string[] },
  executionMetadata: { slotsConsumed: number; executorNpcId?: string; executionNotes?: string[] },
  worldTimestamp: WorldTimestamp,
): Promise<ServiceContract> {
  const contract = await getServiceContract(contractId);
  if (!contract) {
    throw new Error(`Service contract not found: ${contractId}`);
  }

  if (contract.status !== 'active') {
    throw new Error(`Cannot complete contract with status: ${contract.status}`);
  }

  const now = new Date().toISOString();
  const newStatus: ContractStatus = outcome.success ? 'completed' : 'failed';

  await query(
    `UPDATE service_contracts
     SET status = ?, outcome = ?, execution_metadata = ?,
         end_time = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [
      newStatus,
      JSON.stringify(outcome),
      JSON.stringify(executionMetadata),
      JSON.stringify(worldTimestamp),
      now,
      contractId,
    ],
  );

  await writeDelta({
    campaignId: contract.campaignId,
    entityType: 'service_contract',
    entityId: contractId,
    operation: 'update',
    delta: { status: newStatus, outcome, executionMetadata },
    actorType: 'system',
    timestamp: now,
    worldTimestamp,
  });

  return {
    ...contract,
    status: newStatus,
    outcome,
    executionMetadata: {
      slotsConsumed: executionMetadata.slotsConsumed,
      executorNpcId: executionMetadata.executorNpcId,
      executionNotes: executionMetadata.executionNotes ?? [],
    },
    endTime: JSON.stringify(worldTimestamp),
    updatedAt: now,
    version: contract.version + 1,
  };
}

/**
 * Cancel a contract before completion.
 */
export async function cancelContract(
  contractId: string,
  reason: string,
  cancelledBy: string,
  worldTimestamp: WorldTimestamp,
): Promise<ServiceContract> {
  const contract = await getServiceContract(contractId);
  if (!contract) {
    throw new Error(`Service contract not found: ${contractId}`);
  }

  if (contract.status === 'completed' || contract.status === 'failed') {
    throw new Error(`Cannot cancel contract with status: ${contract.status}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE service_contracts
     SET status = 'cancelled', outcome = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [JSON.stringify({ success: false, outcome: reason, deltasWritten: [] }), now, contractId],
  );

  await writeDelta({
    campaignId: contract.campaignId,
    entityType: 'service_contract',
    entityId: contractId,
    operation: 'update',
    delta: { status: 'cancelled', reason, cancelledBy },
    actorType: 'system',
    actorId: cancelledBy,
    timestamp: now,
    worldTimestamp,
  });

  return {
    ...contract,
    status: 'cancelled',
    outcome: { success: false, outcome: reason, deltasWritten: [] },
    updatedAt: now,
    version: contract.version + 1,
  };
}

/**
 * Get a service contract by ID.
 */
export async function getServiceContract(contractId: string): Promise<ServiceContract | null> {
  const row = await queryOne<ServiceContractRow>(
    `SELECT * FROM service_contracts WHERE id = ?`,
    [contractId],
  );

  if (!row) return null;
  return rowToServiceContract(row);
}

/**
 * Get active contracts for a provider.
 */
export async function getProviderActiveContracts(providerId: string): Promise<ServiceContract[]> {
  const rows = await queryAll<ServiceContractRow>(
    `SELECT * FROM service_contracts WHERE provider_id = ? AND status = 'active'`,
    [providerId],
  );

  return rows.map(rowToServiceContract);
}

/**
 * Get contracts for a client entity.
 */
export async function getClientContracts(
  clientEntityId: string,
  clientEntityType: EntityType,
  status?: ContractStatus,
): Promise<ServiceContract[]> {
  let sql = `SELECT * FROM service_contracts WHERE client_entity_id = ? AND client_entity_type = ?`;
  const params: unknown[] = [clientEntityId, clientEntityType];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = await queryAll<ServiceContractRow>(sql, params);
  return rows.map(rowToServiceContract);
}

// ============================================
// RISK CONTRACT (INSURANCE) OPERATIONS
// ============================================

export interface CreateRiskContractInput {
  campaignId: string;
  providerId: string;
  clientEntityId: string;
  clientEntityType: EntityType;
  coveredEventTypes: CoveredEventType[];
  coverageLimitGp: number;
  premiumGp: number;
  exclusions?: Exclusion[];
  collateral?: CollateralItem[];
  startTime: WorldTimestamp;
  endTime: WorldTimestamp;
}

/**
 * Create a new risk contract (insurance policy).
 */
export async function createRiskContract(
  input: CreateRiskContractInput,
): Promise<RiskContract> {
  const now = new Date().toISOString();
  const contractId = crypto.randomUUID();

  const contract: RiskContract = {
    id: contractId,
    campaignId: input.campaignId,
    providerId: input.providerId,
    clientEntityId: input.clientEntityId,
    clientEntityType: input.clientEntityType,
    coveredEventTypes: input.coveredEventTypes,
    coverageLimitGp: input.coverageLimitGp,
    premiumGp: input.premiumGp,
    exclusions: input.exclusions ?? [],
    collateral: input.collateral ?? [],
    startTime: JSON.stringify(input.startTime),
    endTime: JSON.stringify(input.endTime),
    status: 'active',
    claims: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Validate schema
  RiskContractSchema.parse(contract);

  await query(
    `INSERT INTO risk_contracts (
      id, campaign_id, provider_id,
      client_entity_id, client_entity_type,
      covered_event_types, coverage_limit_gp, premium_gp,
      exclusions, collateral,
      start_time, end_time, status, claims,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contract.id,
      contract.campaignId,
      contract.providerId,
      contract.clientEntityId,
      contract.clientEntityType,
      JSON.stringify(contract.coveredEventTypes),
      contract.coverageLimitGp,
      contract.premiumGp,
      JSON.stringify(contract.exclusions),
      JSON.stringify(contract.collateral),
      contract.startTime,
      contract.endTime,
      contract.status,
      JSON.stringify(contract.claims),
      contract.createdAt,
      contract.updatedAt,
      contract.version,
    ],
  );

  await writeDelta({
    campaignId: input.campaignId,
    entityType: 'risk_contract',
    entityId: contractId,
    operation: 'create',
    delta: { contract },
    actorType: 'system',
    timestamp: now,
  });

  return contract;
}

/**
 * File a claim against a risk contract.
 */
export async function fileClaim(
  contractId: string,
  eventType: CoveredEventType,
  amount: number,
  worldTimestamp: WorldTimestamp,
): Promise<{ claimId: string; status: 'pending' | 'denied'; reason?: string }> {
  const contract = await getRiskContract(contractId);
  if (!contract) {
    throw new Error(`Risk contract not found: ${contractId}`);
  }

  if (contract.status !== 'active') {
    return { claimId: '', status: 'denied', reason: `Contract is ${contract.status}` };
  }

  // Check if event type is covered
  if (!contract.coveredEventTypes.includes(eventType)) {
    return { claimId: '', status: 'denied', reason: `Event type ${eventType} not covered` };
  }

  // Check exclusions
  const exclusion = contract.exclusions.find(e => e.eventType === eventType);
  if (exclusion) {
    return { claimId: '', status: 'denied', reason: `Excluded: ${exclusion.conditions}` };
  }

  // Check if coverage limit would be exceeded
  const totalClaimed = contract.claims
    .filter(c => c.status === 'approved' || c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);

  if (totalClaimed + amount > contract.coverageLimitGp) {
    return {
      claimId: '',
      status: 'denied',
      reason: `Would exceed coverage limit (${totalClaimed}/${contract.coverageLimitGp} already claimed)`,
    };
  }

  const now = new Date().toISOString();
  const claimId = crypto.randomUUID();

  const newClaim = {
    claimId,
    eventType,
    amount,
    status: 'pending' as const,
    filedAt: JSON.stringify(worldTimestamp),
  };

  const updatedClaims = [...contract.claims, newClaim];

  await query(
    `UPDATE risk_contracts SET claims = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
    [JSON.stringify(updatedClaims), now, contractId],
  );

  await writeDelta({
    campaignId: contract.campaignId,
    entityType: 'risk_contract',
    entityId: contractId,
    operation: 'update',
    delta: { claim: newClaim },
    actorType: 'system',
    timestamp: now,
    worldTimestamp,
  });

  return { claimId, status: 'pending' };
}

/**
 * Get a risk contract by ID.
 */
export async function getRiskContract(contractId: string): Promise<RiskContract | null> {
  const row = await queryOne<RiskContractRow>(
    `SELECT * FROM risk_contracts WHERE id = ?`,
    [contractId],
  );

  if (!row) return null;
  return rowToRiskContract(row);
}

// ============================================
// GUARANTEE CONTRACT OPERATIONS
// ============================================

export interface CreateGuaranteeContractInput {
  campaignId: string;
  guarantorProviderId: string;
  coveredContractId: string;
  coveredContractType: 'service_contract' | 'loan' | 'trade' | 'custom';
  obligorEntityId: string;
  obligorEntityType: EntityType;
  beneficiaryEntityId: string;
  beneficiaryEntityType: EntityType;
  coveredFailures: FailureType[];
  guaranteeLimitGp: number;
  enforcementMethod: EnforcementMethod;
  collateral?: CollateralItem[];
  visibilityPolicy?: VisibilityPolicy;
  expirationTime: WorldTimestamp;
}

/**
 * Create a guarantee contract.
 */
export async function createGuaranteeContract(
  input: CreateGuaranteeContractInput,
): Promise<GuaranteeContract> {
  const now = new Date().toISOString();
  const contractId = crypto.randomUUID();

  const contract: GuaranteeContract = {
    id: contractId,
    campaignId: input.campaignId,
    guarantorProviderId: input.guarantorProviderId,
    coveredContractId: input.coveredContractId,
    coveredContractType: input.coveredContractType,
    obligorEntityId: input.obligorEntityId,
    obligorEntityType: input.obligorEntityType,
    beneficiaryEntityId: input.beneficiaryEntityId,
    beneficiaryEntityType: input.beneficiaryEntityType,
    coveredFailures: input.coveredFailures,
    guaranteeLimitGp: input.guaranteeLimitGp,
    enforcementMethod: input.enforcementMethod,
    collateral: input.collateral ?? [],
    visibilityPolicy: input.visibilityPolicy ?? { public: false, visibleTo: [], hiddenFrom: [] },
    expirationTime: JSON.stringify(input.expirationTime),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Validate schema
  GuaranteeContractSchema.parse(contract);

  await query(
    `INSERT INTO guarantee_contracts (
      id, campaign_id, guarantor_provider_id,
      covered_contract_id, covered_contract_type,
      obligor_entity_id, obligor_entity_type,
      beneficiary_entity_id, beneficiary_entity_type,
      covered_failures, guarantee_limit_gp,
      enforcement_method, collateral,
      visibility_policy, expiration_time,
      status, trigger_metadata,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contract.id,
      contract.campaignId,
      contract.guarantorProviderId,
      contract.coveredContractId,
      contract.coveredContractType,
      contract.obligorEntityId,
      contract.obligorEntityType,
      contract.beneficiaryEntityId,
      contract.beneficiaryEntityType,
      JSON.stringify(contract.coveredFailures),
      contract.guaranteeLimitGp,
      contract.enforcementMethod,
      JSON.stringify(contract.collateral),
      JSON.stringify(contract.visibilityPolicy),
      contract.expirationTime,
      contract.status,
      null,
      contract.createdAt,
      contract.updatedAt,
      contract.version,
    ],
  );

  await writeDelta({
    campaignId: input.campaignId,
    entityType: 'guarantee_contract',
    entityId: contractId,
    operation: 'create',
    delta: { contract },
    actorType: 'system',
    timestamp: now,
  });

  return contract;
}

/**
 * Trigger a guarantee due to obligor failure.
 * This may create enforcement service contracts (legal/PMC).
 */
export async function triggerGuarantee(
  contractId: string,
  reason: string,
  worldTimestamp: WorldTimestamp,
): Promise<{ success: boolean; enforcementContractId?: string }> {
  const contract = await getGuaranteeContract(contractId);
  if (!contract) {
    throw new Error(`Guarantee contract not found: ${contractId}`);
  }

  if (contract.status !== 'active') {
    throw new Error(`Cannot trigger guarantee with status: ${contract.status}`);
  }

  const now = new Date().toISOString();
  const triggerMetadata = {
    triggeredAt: JSON.stringify(worldTimestamp),
    reason,
  };

  // For enforcement methods that create new contracts, we'd create them here
  // For now, we just mark the guarantee as triggered
  let enforcementContractId: string | undefined;

  if (contract.enforcementMethod === 'legal_action' || contract.enforcementMethod === 'pmc_action') {
    // Would create a service contract for enforcement
    // This is a placeholder - actual implementation would use createServiceContract
    enforcementContractId = crypto.randomUUID();
  }

  await query(
    `UPDATE guarantee_contracts
     SET status = 'triggered', trigger_metadata = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [JSON.stringify({ ...triggerMetadata, enforcementContractId }), now, contractId],
  );

  await writeDelta({
    campaignId: contract.campaignId,
    entityType: 'guarantee_contract',
    entityId: contractId,
    operation: 'update',
    delta: { status: 'triggered', triggerMetadata, enforcementContractId },
    actorType: 'system',
    timestamp: now,
    worldTimestamp,
  });

  return { success: true, enforcementContractId };
}

/**
 * Get a guarantee contract by ID.
 */
export async function getGuaranteeContract(contractId: string): Promise<GuaranteeContract | null> {
  const row = await queryOne<GuaranteeContractRow>(
    `SELECT * FROM guarantee_contracts WHERE id = ?`,
    [contractId],
  );

  if (!row) return null;
  return rowToGuaranteeContract(row);
}

/**
 * Find guarantees covering a specific contract.
 */
export async function findGuaranteesForContract(
  coveredContractId: string,
): Promise<GuaranteeContract[]> {
  const rows = await queryAll<GuaranteeContractRow>(
    `SELECT * FROM guarantee_contracts WHERE covered_contract_id = ? AND status = 'active'`,
    [coveredContractId],
  );

  return rows.map(rowToGuaranteeContract);
}

// ============================================
// ROW TYPES AND CONVERTERS
// ============================================

interface ServiceContractRow {
  id: string;
  campaign_id: string;
  provider_id: string;
  client_entity_id: string;
  client_entity_type: string;
  service_type: string;
  scope: string;
  start_time: string;
  end_time: string | null;
  urgency: string;
  visibility_policy: string;
  status: string;
  base_quote_gp: number;
  final_cost_gp: number | null;
  execution_metadata: string;
  outcome: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToServiceContract(row: ServiceContractRow): ServiceContract {
  return ServiceContractSchema.parse({
    id: row.id,
    campaignId: row.campaign_id,
    providerId: row.provider_id,
    clientEntityId: row.client_entity_id,
    clientEntityType: row.client_entity_type,
    serviceType: row.service_type,
    scope: JSON.parse(row.scope),
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    urgency: row.urgency,
    visibilityPolicy: JSON.parse(row.visibility_policy),
    status: row.status,
    baseQuoteGp: row.base_quote_gp,
    finalCostGp: row.final_cost_gp ?? undefined,
    executionMetadata: JSON.parse(row.execution_metadata),
    outcome: row.outcome ? JSON.parse(row.outcome) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

interface RiskContractRow {
  id: string;
  campaign_id: string;
  provider_id: string;
  client_entity_id: string;
  client_entity_type: string;
  covered_event_types: string;
  coverage_limit_gp: number;
  premium_gp: number;
  exclusions: string;
  collateral: string;
  start_time: string;
  end_time: string;
  status: string;
  claims: string;
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToRiskContract(row: RiskContractRow): RiskContract {
  return RiskContractSchema.parse({
    id: row.id,
    campaignId: row.campaign_id,
    providerId: row.provider_id,
    clientEntityId: row.client_entity_id,
    clientEntityType: row.client_entity_type,
    coveredEventTypes: JSON.parse(row.covered_event_types),
    coverageLimitGp: row.coverage_limit_gp,
    premiumGp: row.premium_gp,
    exclusions: JSON.parse(row.exclusions),
    collateral: JSON.parse(row.collateral),
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    claims: JSON.parse(row.claims),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

interface GuaranteeContractRow {
  id: string;
  campaign_id: string;
  guarantor_provider_id: string;
  covered_contract_id: string;
  covered_contract_type: string;
  obligor_entity_id: string;
  obligor_entity_type: string;
  beneficiary_entity_id: string;
  beneficiary_entity_type: string;
  covered_failures: string;
  guarantee_limit_gp: number;
  enforcement_method: string;
  collateral: string;
  visibility_policy: string;
  expiration_time: string;
  status: string;
  trigger_metadata: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToGuaranteeContract(row: GuaranteeContractRow): GuaranteeContract {
  return GuaranteeContractSchema.parse({
    id: row.id,
    campaignId: row.campaign_id,
    guarantorProviderId: row.guarantor_provider_id,
    coveredContractId: row.covered_contract_id,
    coveredContractType: row.covered_contract_type,
    obligorEntityId: row.obligor_entity_id,
    obligorEntityType: row.obligor_entity_type,
    beneficiaryEntityId: row.beneficiary_entity_id,
    beneficiaryEntityType: row.beneficiary_entity_type,
    coveredFailures: JSON.parse(row.covered_failures),
    guaranteeLimitGp: row.guarantee_limit_gp,
    enforcementMethod: row.enforcement_method,
    collateral: JSON.parse(row.collateral),
    visibilityPolicy: JSON.parse(row.visibility_policy),
    expirationTime: row.expiration_time,
    status: row.status,
    triggerMetadata: row.trigger_metadata ? JSON.parse(row.trigger_metadata) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}
