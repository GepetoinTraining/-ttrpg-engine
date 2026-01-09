import { query, queryOne, queryAll } from '../../../db/client';
import type { WorldTimestamp } from '../../timeline/substrate';
import {
  type ServiceExecutionResult,
  type ExecutionLogEntry,
  type ServiceType,
  ExecutionLogEntrySchema,
} from './types';
import { getServiceContract, completeContract, activateContract } from './contracts';
import { getProvider, updateProviderCapital, updateProviderFame } from './providers';
import { calculateFameGain } from './providers';
import { estimateTimeSlots } from './pricing';

// ============================================
// SERVICE EXECUTION
// ============================================
//
// Core invariants:
// - Services consume NPC time slots
// - Even failures consume time
// - All outcomes go through writeDelta
// - Power never erases consequences
//

// ============================================
// PROVIDER TIME RESERVATION
// ============================================
//
// Every service execution must:
// - Reserve provider NPC time slots
// - Reduce availability
// - Consume time even on failure
// - Allow derived queries like "provider is busy until..."
//

export interface TimeReservation {
  id: string;
  providerId: string;
  npcId: string;
  contractId: string;
  startSlot: WorldTimestamp;
  endSlot: WorldTimestamp;
  slotsReserved: number;
  status: 'reserved' | 'executing' | 'completed' | 'cancelled';
  createdAt: string;
}

/**
 * Reserve provider time for a service.
 * Returns reservation ID or null if unavailable.
 */
export async function reserveProviderTime(
  providerId: string,
  npcId: string,
  contractId: string,
  startSlot: WorldTimestamp,
  durationSlots: number,
): Promise<{ success: boolean; reservationId?: string; busyUntil?: WorldTimestamp }> {
  // Check availability first
  const availability = await isProviderAvailable(npcId, startSlot, durationSlots);

  if (!availability.available) {
    return { success: false, busyUntil: availability.busyUntil };
  }

  const now = new Date().toISOString();
  const reservationId = crypto.randomUUID();
  const endSlot = advanceWorldTimestamp(startSlot, durationSlots);

  // Store reservation in execution log with 'reserved' status
  await query(
    `INSERT INTO service_execution_log (
      id, campaign_id, service_contract_id, executor_npc_id,
      slot_start, slot_end, slots_consumed,
      execution_result, success, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reservationId,
      providerId, // Using providerId as campaign proxy for now
      contractId,
      npcId,
      JSON.stringify(startSlot),
      JSON.stringify(endSlot),
      durationSlots,
      JSON.stringify({ actions: [], outcome: 'reserved', deltasWritten: [] }),
      1,
      now,
    ],
  );

  return { success: true, reservationId };
}

/**
 * Release a time reservation (only if cancelled before start).
 */
export async function releaseProviderTime(
  reservationId: string,
  currentTime: WorldTimestamp,
): Promise<{ success: boolean; reason?: string }> {
  const reservation = await queryOne<{
    slot_start: string;
    execution_result: string;
  }>(
    `SELECT slot_start, execution_result FROM service_execution_log WHERE id = ?`,
    [reservationId],
  );

  if (!reservation) {
    return { success: false, reason: 'Reservation not found' };
  }

  const startSlot: WorldTimestamp = JSON.parse(reservation.slot_start);
  const result = JSON.parse(reservation.execution_result);

  // Can only release if not yet started
  if (worldTimestampToTurns(currentTime) >= worldTimestampToTurns(startSlot)) {
    return { success: false, reason: 'Cannot release: execution already started' };
  }

  if (result.outcome !== 'reserved') {
    return { success: false, reason: `Cannot release: status is ${result.outcome}` };
  }

  // Delete the reservation
  await query(`DELETE FROM service_execution_log WHERE id = ?`, [reservationId]);

  return { success: true };
}

/**
 * Check if a provider/NPC is available for the given time window.
 */
export async function isProviderAvailable(
  npcId: string,
  startSlot: WorldTimestamp,
  slotsNeeded: number,
): Promise<{ available: boolean; busyUntil?: WorldTimestamp; conflictingContracts: string[] }> {
  const startTurn = worldTimestampToTurns(startSlot);
  const endTurn = startTurn + slotsNeeded * 300;

  const conflicts = await queryAll<{ service_contract_id: string; slot_end: string }>(
    `SELECT service_contract_id, slot_end FROM service_execution_log
     WHERE executor_npc_id = ?
     AND json_extract(slot_start, '$.turn') < ?
     AND json_extract(slot_end, '$.turn') > ?`,
    [npcId, endTurn, startTurn],
  );

  if (conflicts.length === 0) {
    return { available: true, conflictingContracts: [] };
  }

  // Find the latest busy-until time
  let latestEnd: WorldTimestamp | undefined;
  for (const conflict of conflicts) {
    const endSlot: WorldTimestamp = JSON.parse(conflict.slot_end);
    if (!latestEnd || worldTimestampToTurns(endSlot) > worldTimestampToTurns(latestEnd)) {
      latestEnd = endSlot;
    }
  }

  return {
    available: false,
    busyUntil: latestEnd,
    conflictingContracts: conflicts.map(c => c.service_contract_id),
  };
}

/**
 * Get when a provider will next be available.
 */
export async function getProviderNextAvailable(
  npcId: string,
  afterTime: WorldTimestamp,
): Promise<WorldTimestamp> {
  const latestReservation = await queryOne<{ slot_end: string }>(
    `SELECT slot_end FROM service_execution_log
     WHERE executor_npc_id = ?
     AND json_extract(slot_end, '$.turn') > ?
     ORDER BY json_extract(slot_end, '$.turn') DESC
     LIMIT 1`,
    [npcId, worldTimestampToTurns(afterTime)],
  );

  if (!latestReservation) {
    return afterTime;
  }

  return JSON.parse(latestReservation.slot_end);
}

// ============================================
// EXECUTION SCHEDULING
// ============================================

export interface ScheduleExecutionInput {
  contractId: string;
  executorNpcId: string;
  startSlot: WorldTimestamp;
}

/**
 * Check if an NPC has availability for service execution.
 * Returns available slots in the given time window.
 */
export async function checkNpcAvailability(
  npcId: string,
  startSlot: WorldTimestamp,
  slotsNeeded: number,
): Promise<{ available: boolean; conflictingContracts: string[] }> {
  const result = await isProviderAvailable(npcId, startSlot, slotsNeeded);
  return {
    available: result.available,
    conflictingContracts: result.conflictingContracts,
  };
}

/**
 * Schedule service execution.
 * This reserves NPC time slots for the service.
 */
export async function scheduleExecution(
  input: ScheduleExecutionInput,
): Promise<{ success: boolean; reason?: string; scheduledSlots?: number }> {
  const contract = await getServiceContract(input.contractId);
  if (!contract) {
    return { success: false, reason: 'Contract not found' };
  }

  if (contract.status !== 'proposed' && contract.status !== 'active') {
    return { success: false, reason: `Cannot schedule for contract with status: ${contract.status}` };
  }

  const provider = await getProvider(contract.providerId);
  if (!provider) {
    return { success: false, reason: 'Provider not found' };
  }

  // Verify executor is associated with provider
  if (provider.npcId !== input.executorNpcId) {
    // Could also check if NPC is an employee of the provider
    return { success: false, reason: 'Executor not associated with provider' };
  }

  // Estimate slots needed
  const slotsNeeded = estimateTimeSlots(
    contract.serviceType as ServiceType,
    contract.scope,
    contract.urgency,
  );

  // Check availability
  const availability = await checkNpcAvailability(
    input.executorNpcId,
    input.startSlot,
    slotsNeeded,
  );

  if (!availability.available) {
    return {
      success: false,
      reason: `NPC has conflicting commitments: ${availability.conflictingContracts.join(', ')}`,
    };
  }

  // If contract is still proposed, activate it
  if (contract.status === 'proposed') {
    await activateContract(input.contractId, input.startSlot);
  }

  return {
    success: true,
    scheduledSlots: slotsNeeded,
  };
}

// ============================================
// EXECUTION LOGGING
// ============================================

/**
 * Log execution of a service time slot.
 */
export async function logExecution(
  campaignId: string,
  contractId: string,
  executorNpcId: string,
  slotStart: WorldTimestamp,
  slotEnd: WorldTimestamp,
  slotsConsumed: number,
  result: { actions: string[]; outcome: string; deltasWritten: string[] },
  success: boolean,
): Promise<ExecutionLogEntry> {
  const now = new Date().toISOString();
  const logId = crypto.randomUUID();

  const entry: ExecutionLogEntry = {
    id: logId,
    campaignId,
    serviceContractId: contractId,
    executorNpcId,
    slotStart: JSON.stringify(slotStart),
    slotEnd: JSON.stringify(slotEnd),
    slotsConsumed,
    executionResult: result,
    success,
    createdAt: now,
  };

  ExecutionLogEntrySchema.parse(entry);

  await query(
    `INSERT INTO service_execution_log (
      id, campaign_id, service_contract_id, executor_npc_id,
      slot_start, slot_end, slots_consumed,
      execution_result, success, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.campaignId,
      entry.serviceContractId,
      entry.executorNpcId,
      entry.slotStart,
      entry.slotEnd,
      entry.slotsConsumed,
      JSON.stringify(entry.executionResult),
      entry.success ? 1 : 0,
      entry.createdAt,
    ],
  );

  return entry;
}

/**
 * Get execution logs for a contract.
 */
export async function getExecutionLogs(contractId: string): Promise<ExecutionLogEntry[]> {
  const rows = await queryAll<ExecutionLogRow>(
    `SELECT * FROM service_execution_log WHERE service_contract_id = ? ORDER BY created_at ASC`,
    [contractId],
  );

  return rows.map(rowToExecutionLog);
}

/**
 * Get total slots consumed for a contract.
 */
export async function getTotalSlotsConsumed(contractId: string): Promise<number> {
  const result = await queryOne<{ total: number }>(
    `SELECT SUM(slots_consumed) as total FROM service_execution_log WHERE service_contract_id = ?`,
    [contractId],
  );

  return result?.total ?? 0;
}

// ============================================
// EXECUTION COMPLETION
// ============================================

export interface ExecuteServiceInput {
  contractId: string;
  executorNpcId: string;
  worldTimestamp: WorldTimestamp;
  actions: string[];
  outcome: string;
  success: boolean;
  exceptional?: boolean;
  deltasWritten?: string[];
}

/**
 * Execute a service contract to completion.
 * This is the main entry point for service fulfillment.
 *
 * Invariant: All outcomes go through writeDelta.
 * Invariant: NPC time slots are consumed.
 */
export async function executeService(
  input: ExecuteServiceInput,
): Promise<ServiceExecutionResult> {
  const contract = await getServiceContract(input.contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${input.contractId}`);
  }

  if (contract.status !== 'active') {
    throw new Error(`Cannot execute contract with status: ${contract.status}`);
  }

  const provider = await getProvider(contract.providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${contract.providerId}`);
  }

  // Calculate slots consumed
  const slotsConsumed = estimateTimeSlots(
    contract.serviceType as ServiceType,
    contract.scope,
    contract.urgency,
  );

  // Calculate end timestamp
  const endTimestamp = advanceWorldTimestamp(input.worldTimestamp, slotsConsumed);

  // Log the execution
  const execResult = {
    actions: input.actions,
    outcome: input.outcome,
    deltasWritten: input.deltasWritten ?? [],
  };

  await logExecution(
    contract.campaignId,
    input.contractId,
    input.executorNpcId,
    input.worldTimestamp,
    endTimestamp,
    slotsConsumed,
    execResult,
    input.success,
  );

  // Complete the contract
  await completeContract(
    input.contractId,
    {
      success: input.success,
      outcome: input.outcome,
      deltasWritten: input.deltasWritten ?? [],
    },
    {
      slotsConsumed,
      executorNpcId: input.executorNpcId,
      executionNotes: input.actions,
    },
    endTimestamp,
  );

  // Update provider state based on outcome
  const contractValue = contract.finalCostGp ?? contract.baseQuoteGp;

  if (input.success) {
    // Provider receives payment
    await updateProviderCapital(
      provider.id,
      contractValue,
      `Service contract ${input.contractId} completed`,
    );
  }

  // Fame changes (both success and failure affect fame)
  const fameChange = calculateFameGain(
    contractValue,
    provider.merchantTier,
    input.success,
    input.exceptional,
  );

  await updateProviderFame(
    provider.id,
    fameChange,
    input.success
      ? `Successfully completed ${contract.serviceType}`
      : `Failed to complete ${contract.serviceType}`,
  );

  return {
    contractId: input.contractId,
    success: input.success,
    outcome: input.outcome,
    actions: input.actions,
    slotsConsumed,
    executorNpcId: input.executorNpcId,
    deltasWritten: input.deltasWritten ?? [],
    actualCostGp: contractValue,
    executedAt: JSON.stringify(input.worldTimestamp),
    completedAt: JSON.stringify(endTimestamp),
  };
}

// ============================================
// PARTIAL EXECUTION
// ============================================

/**
 * Log partial execution progress.
 * For long-running services that span multiple time slots.
 */
export async function logPartialExecution(
  contractId: string,
  executorNpcId: string,
  slotStart: WorldTimestamp,
  slotEnd: WorldTimestamp,
  slotsConsumed: number,
  progress: { actions: string[]; notes: string },
): Promise<void> {
  const contract = await getServiceContract(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  await logExecution(
    contract.campaignId,
    contractId,
    executorNpcId,
    slotStart,
    slotEnd,
    slotsConsumed,
    {
      actions: progress.actions,
      outcome: 'in_progress',
      deltasWritten: [],
    },
    true, // Partial progress is not a failure
  );

  // Update contract execution metadata
  const currentSlots = await getTotalSlotsConsumed(contractId);

  await query(
    `UPDATE service_contracts
     SET execution_metadata = json_set(execution_metadata, '$.slotsConsumed', ?),
         updated_at = ?,
         version = version + 1
     WHERE id = ?`,
    [currentSlots, new Date().toISOString(), contractId],
  );
}

// ============================================
// FAILURE HANDLING
// ============================================

/**
 * Handle service failure.
 * Power never erases consequences - failures have effects.
 */
export async function handleServiceFailure(
  contractId: string,
  executorNpcId: string,
  worldTimestamp: WorldTimestamp,
  failureReason: string,
  partialActionsCompleted: string[],
): Promise<ServiceExecutionResult> {
  return executeService({
    contractId,
    executorNpcId,
    worldTimestamp,
    actions: partialActionsCompleted,
    outcome: `FAILED: ${failureReason}`,
    success: false,
    deltasWritten: [],
  });
}

// ============================================
// NPC WORKLOAD QUERIES
// ============================================

/**
 * Get NPC's current workload (slots committed).
 */
export async function getNpcWorkload(
  npcId: string,
  fromTimestamp: WorldTimestamp,
  toTimestamp: WorldTimestamp,
): Promise<{ totalSlots: number; contracts: string[] }> {
  const fromTurn = worldTimestampToTurns(fromTimestamp);
  const toTurn = worldTimestampToTurns(toTimestamp);

  const results = await queryAll<{ service_contract_id: string; slots_consumed: number }>(
    `SELECT service_contract_id, slots_consumed FROM service_execution_log
     WHERE executor_npc_id = ?
     AND json_extract(slot_start, '$.turn') >= ?
     AND json_extract(slot_end, '$.turn') <= ?`,
    [npcId, fromTurn, toTurn],
  );

  const contractIds = [...new Set(results.map(r => r.service_contract_id))];
  const totalSlots = results.reduce((sum, r) => sum + r.slots_consumed, 0);

  return { totalSlots, contracts: contractIds };
}

/**
 * Get NPCs available for service execution at a given time.
 */
export async function getAvailableNpcs(
  hubId: string,
  timestamp: WorldTimestamp,
  slotsNeeded: number,
): Promise<string[]> {
  // Get all provider NPCs in the hub
  const providers = await queryAll<{ npc_id: string }>(
    `SELECT npc_id FROM service_providers
     WHERE hub_id = ? AND npc_id IS NOT NULL AND status = 'active'`,
    [hubId],
  );

  const availableNpcs: string[] = [];

  for (const provider of providers) {
    if (provider.npc_id) {
      const availability = await checkNpcAvailability(
        provider.npc_id,
        timestamp,
        slotsNeeded,
      );
      if (availability.available) {
        availableNpcs.push(provider.npc_id);
      }
    }
  }

  return availableNpcs;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert WorldTimestamp to absolute turns for comparison.
 */
function worldTimestampToTurns(ts: WorldTimestamp): number {
  // 1 day = 14400 turns = 48 slots
  // 1 slot = 300 turns
  return ts.day * 14400 + ts.slot * 300 + (ts.turn % 300);
}

/**
 * Advance a WorldTimestamp by a number of slots.
 */
function advanceWorldTimestamp(ts: WorldTimestamp, slots: number): WorldTimestamp {
  const totalSlots = ts.slot + slots;
  const additionalDays = Math.floor(totalSlots / 48);
  const newSlot = totalSlots % 48;
  const additionalTurns = slots * 300;

  return {
    day: ts.day + additionalDays,
    slot: newSlot,
    turn: ts.turn + additionalTurns,
  };
}

// ============================================
// ROW TYPES
// ============================================

interface ExecutionLogRow {
  id: string;
  campaign_id: string;
  service_contract_id: string;
  executor_npc_id: string;
  slot_start: string;
  slot_end: string;
  slots_consumed: number;
  execution_result: string;
  success: number;
  created_at: string;
}

function rowToExecutionLog(row: ExecutionLogRow): ExecutionLogEntry {
  return ExecutionLogEntrySchema.parse({
    id: row.id,
    campaignId: row.campaign_id,
    serviceContractId: row.service_contract_id,
    executorNpcId: row.executor_npc_id,
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    slotsConsumed: row.slots_consumed,
    executionResult: JSON.parse(row.execution_result),
    success: row.success === 1,
    createdAt: row.created_at,
  });
}
