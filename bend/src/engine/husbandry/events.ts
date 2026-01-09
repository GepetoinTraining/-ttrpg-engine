/**
 * HUSBANDRY SYSTEM - Event Emission
 *
 * Delta emission for husbandry events following the timeline pattern.
 */

import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import type {
  HusbandryEvent,
  HusbandryEventType,
  HusbandryEventImpact,
  EventSeverity,
  HusbandryTickResult,
} from './schema';

// ============================================
// EVENT CREATION
// ============================================

export interface CreateHusbandryEventInput {
  campaignId: string;
  ranchId?: string;
  herdId?: string;
  operationId?: string;

  eventType: HusbandryEventType;
  details?: Record<string, unknown>;
  impact?: HusbandryEventImpact;
  severity?: EventSeverity;

  worldTimestamp?: WorldTimestamp;
  publicKnowledge?: boolean;
}

/**
 * Create a husbandry event and emit a delta.
 */
export async function emitHusbandryEvent(
  input: CreateHusbandryEventInput
): Promise<HusbandryEvent> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const event: HusbandryEvent = {
    id: eventId,
    campaignId: input.campaignId,
    ranchId: input.ranchId,
    herdId: input.herdId,
    operationId: input.operationId,
    eventType: input.eventType,
    details: input.details ?? {},
    impact: input.impact,
    severity: input.severity ?? 'info',
    occurredAt: now,
    worldTimestamp: input.worldTimestamp,
    publicKnowledge: input.publicKnowledge ?? true,
    createdAt: now,
  };

  // Write delta to sync log
  const delta = await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_event',
    entityId: eventId,
    operation: 'create',
    delta: { event },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  event.syncLogId = delta.id;

  return event;
}

// ============================================
// TICK RESULT EMISSION
// ============================================

export interface EmitTickResultInput {
  campaignId: string;
  result: HusbandryTickResult;
  worldTimestamp?: WorldTimestamp;
}

/**
 * Emit a delta for a husbandry tick result.
 */
export async function emitHusbandryTickDelta(
  input: EmitTickResultInput
): Promise<void> {
  const now = new Date().toISOString();

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: input.result.operationId,
    operation: 'update',
    delta: {
      output: input.result.output,
      population: input.result.newPopulation,
      births: input.result.births,
      deaths: input.result.deaths,
      slaughtered: input.result.slaughtered,
      feedConsumed: input.result.feedConsumed,
      laborUsed: input.result.laborUsed,
      daysProcessed: input.result.daysProcessed,
      healthState: input.result.newHealthState,
      stressState: input.result.newStressState,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });
}

// ============================================
// SPECIALIZED EVENT EMITTERS
// ============================================

/**
 * Emit a birth event.
 */
export async function emitBirthEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  operationId: string,
  birthCount: number,
  speciesName: string,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    operationId,
    eventType: 'HERD_BORN',
    details: {
      count: birthCount,
      species: speciesName,
    },
    impact: {
      populationDelta: birthCount,
    },
    severity: 'info',
    worldTimestamp,
  });
}

/**
 * Emit a slaughter event.
 */
export async function emitSlaughterEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  operationId: string,
  slaughterCount: number,
  meatYield: number,
  hideYield: number,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    operationId,
    eventType: 'HERD_SLAUGHTERED',
    details: {
      count: slaughterCount,
      meatYield,
      hideYield,
    },
    impact: {
      populationDelta: -slaughterCount,
      commodityOutput: {
        meat: meatYield,
        hides: hideYield,
      },
    },
    severity: 'info',
    worldTimestamp,
  });
}

/**
 * Emit a death event.
 */
export async function emitDeathEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  deathCount: number,
  cause: string,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  const severity: EventSeverity =
    deathCount > 10 ? 'critical' :
    deathCount > 5 ? 'danger' :
    deathCount > 1 ? 'warning' : 'info';

  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'ANIMAL_DIED',
    details: {
      count: deathCount,
      cause,
    },
    impact: {
      populationDelta: -deathCount,
    },
    severity,
    worldTimestamp,
  });
}

/**
 * Emit a disease outbreak event.
 */
export async function emitDiseaseEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  diseaseId: string,
  affectedCount: number,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'DISEASE_OUTBREAK',
    details: {
      diseaseId,
      affectedCount,
    },
    impact: {
      healthDelta: -20,
    },
    severity: 'danger',
    worldTimestamp,
    publicKnowledge: true,
  });
}

/**
 * Emit a feed shortage event.
 */
export async function emitFeedShortageEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  shortfall: number,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'FEED_SHORTAGE',
    details: {
      shortfall,
    },
    impact: {
      healthDelta: -10,
    },
    severity: 'warning',
    worldTimestamp,
  });
}

/**
 * Emit a yield collection event.
 */
export async function emitYieldEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  operationId: string,
  yields: Record<string, number>,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    operationId,
    eventType: 'YIELD_COLLECTED',
    details: {
      yields,
    },
    impact: {
      commodityOutput: yields,
    },
    severity: 'info',
    worldTimestamp,
  });
}

/**
 * Emit a winter attrition event.
 */
export async function emitWinterAttritionEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  deaths: number,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'WINTER_ATTRITION',
    details: {
      deaths,
    },
    impact: {
      populationDelta: -deaths,
    },
    severity: deaths > 5 ? 'danger' : 'warning',
    worldTimestamp,
  });
}

/**
 * Emit a predator attack event.
 */
export async function emitPredatorAttackEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  losses: number,
  predatorType: string,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'PREDATOR_ATTACK',
    details: {
      losses,
      predatorType,
    },
    impact: {
      populationDelta: -losses,
    },
    severity: 'danger',
    worldTimestamp,
    publicKnowledge: true,
  });
}

/**
 * Emit a raid loss event.
 */
export async function emitRaidLossEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  losses: number,
  raiderFaction: string,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'RAID_LOSS',
    details: {
      losses,
      raiderFaction,
    },
    impact: {
      populationDelta: -losses,
    },
    severity: 'critical',
    worldTimestamp,
    publicKnowledge: true,
  });
}

/**
 * Emit a breeding success event.
 */
export async function emitBreedingSuccessEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  pregnancies: number,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'BREEDING_SUCCESS',
    details: {
      pregnancies,
    },
    severity: 'info',
    worldTimestamp,
  });
}

/**
 * Emit a care missed event.
 */
export async function emitCareMissedEvent(
  campaignId: string,
  ranchId: string,
  herdId: string,
  reason: string,
  worldTimestamp?: WorldTimestamp
): Promise<HusbandryEvent> {
  return emitHusbandryEvent({
    campaignId,
    ranchId,
    herdId,
    eventType: 'CARE_MISSED',
    details: {
      reason,
    },
    impact: {
      healthDelta: -5,
    },
    severity: 'warning',
    worldTimestamp,
  });
}
