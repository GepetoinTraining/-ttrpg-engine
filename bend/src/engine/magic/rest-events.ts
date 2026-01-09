/**
 * MAGIC REST EVENTS
 *
 * Treats entropy/slot resets as timeline deltas rather than hard field resets.
 * This allows:
 * - Time-travel queries ("what was their entropy at noon?")
 * - Speculative projections ("if they rest now...")
 * - Canonical reset boundaries tied to world time
 *
 * "The rest doesn't erase the entropy—it marks the boundary."
 */

import { z } from 'zod';
import { writeDelta, getDeltas, type Delta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import { timestampToTurns } from '../timeline/substrate';

// ============================================
// REST EVENT SCHEMA
// ============================================

export const RestEventTypeSchema = z.enum([
  'short_rest',
  'long_rest',
  'new_day',        // Dawn boundary
  'meditation',     // Special focus recovery
  'arcane_recovery', // Wizard feature
]);
export type RestEventType = z.infer<typeof RestEventTypeSchema>;

export const RestEventSchema = z.object({
  type: RestEventTypeSchema,
  characterId: z.string().uuid(),

  // When in world time this rest occurred
  worldTimestamp: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }),

  // What was reset
  resets: z.object({
    entropy: z.boolean().default(false),
    entropyDecayAmount: z.number().optional(), // For partial decay
    allSlots: z.boolean().default(false),
    pactSlots: z.boolean().default(false),
    specificSlots: z.array(z.number().int()).optional(), // Arcane recovery
    concentration: z.boolean().default(false),
  }),

  // Pre-reset values (for undo/history)
  beforeState: z.object({
    entropy: z.number(),
    slots: z.array(z.object({
      level: z.number().int(),
      used: z.number().int(),
    })).optional(),
  }).optional(),
});
export type RestEvent = z.infer<typeof RestEventSchema>;

// ============================================
// REST EVENT WRITER
// ============================================

/**
 * Record a rest event as a timeline delta.
 */
export async function recordRestEvent(
  campaignId: string,
  sessionId: string | undefined,
  event: RestEvent
): Promise<Delta> {
  return writeDelta({
    campaignId,
    sessionId,
    entityType: 'rest_event',
    entityId: event.characterId,
    operation: 'create',
    delta: event,
    actorType: 'system',
    timestamp: new Date().toISOString(),
    worldTimestamp: event.worldTimestamp,
  });
}

// ============================================
// REST BOUNDARY QUERIES
// ============================================

/**
 * Get the last rest event for a character.
 * Used to determine the canonical reset boundary.
 */
export async function getLastRestEvent(
  campaignId: string,
  characterId: string,
  restTypes?: RestEventType[]
): Promise<RestEvent | null> {
  // Get all rest events for this character
  const deltas = await getDeltas(
    campaignId,
    0,
    Number.MAX_SAFE_INTEGER,
    {
      entityTypes: ['rest_event'],
      entityIds: [characterId],
    }
  );

  if (deltas.length === 0) return null;

  // Filter by rest type if specified
  let relevantDeltas = deltas;
  if (restTypes?.length) {
    relevantDeltas = deltas.filter(d => {
      const event = d.delta as RestEvent;
      return restTypes.includes(event.type);
    });
  }

  if (relevantDeltas.length === 0) return null;

  // Return the most recent (highest version)
  const latest = relevantDeltas[relevantDeltas.length - 1];
  return latest.delta as RestEvent;
}

/**
 * Get the last long rest (or new day) for entropy calculation.
 * This is the canonical reset boundary for daily entropy.
 */
export async function getEntropyResetBoundary(
  campaignId: string,
  characterId: string
): Promise<{ timestamp: WorldTimestamp; entropyAtReset: number } | null> {
  const lastRest = await getLastRestEvent(
    campaignId,
    characterId,
    ['long_rest', 'new_day']
  );

  if (!lastRest) return null;

  return {
    timestamp: lastRest.worldTimestamp,
    entropyAtReset: 0, // Long rest/new day resets to 0
  };
}

/**
 * Get all rest events since a given timestamp.
 * Useful for projecting slot/entropy state.
 */
export async function getRestEventsSince(
  campaignId: string,
  characterId: string,
  since: WorldTimestamp
): Promise<RestEvent[]> {
  const deltas = await getDeltas(
    campaignId,
    0,
    Number.MAX_SAFE_INTEGER,
    {
      entityTypes: ['rest_event'],
      entityIds: [characterId],
    }
  );

  const sinceTurns = timestampToTurns(since);

  return deltas
    .map(d => d.delta as RestEvent)
    .filter(event => {
      const eventTurns = timestampToTurns(event.worldTimestamp);
      return eventTurns > sinceTurns;
    });
}

// ============================================
// ENTROPY COMPUTATION
// ============================================

/**
 * Compute current entropy for a character by:
 * 1. Finding the last reset boundary
 * 2. Summing all entropy-gaining events since then
 * 3. Subtracting any partial decay from short rests
 *
 * This replaces the hard dailyEntropy field with a computed value.
 */
export async function computeCurrentEntropy(
  campaignId: string,
  characterId: string,
  currentTimestamp: WorldTimestamp
): Promise<number> {
  // Get the reset boundary
  const resetBoundary = await getEntropyResetBoundary(campaignId, characterId);

  const startTimestamp = resetBoundary?.timestamp ?? { day: 0, slot: 0, turn: 0 };
  let entropy = resetBoundary?.entropyAtReset ?? 0;

  // Get all deltas since the reset
  const deltas = await getDeltas(
    campaignId,
    0,
    Number.MAX_SAFE_INTEGER,
    {
      entityIds: [characterId],
    }
  );

  const startTurns = timestampToTurns(startTimestamp);
  const currentTurns = timestampToTurns(currentTimestamp);

  for (const delta of deltas) {
    if (!delta.worldTimestamp) continue;

    const deltaTurns = timestampToTurns(delta.worldTimestamp);
    if (deltaTurns <= startTurns || deltaTurns > currentTurns) continue;

    // Check for entropy gain (from spell casting)
    if (delta.entityType === 'spell_cast' && delta.delta.entropyGained) {
      entropy += delta.delta.entropyGained;
    }

    // Check for entropy decay (from short rest)
    if (delta.entityType === 'rest_event') {
      const restEvent = delta.delta as RestEvent;
      if (restEvent.resets.entropyDecayAmount) {
        entropy = Math.max(0, entropy - restEvent.resets.entropyDecayAmount);
      }
    }
  }

  return entropy;
}

// ============================================
// SLOT STATE COMPUTATION
// ============================================

/**
 * Compute current slot usage by projecting from last long rest.
 */
export async function computeCurrentSlots(
  campaignId: string,
  characterId: string,
  baseSlots: Array<{ level: number; max: number }>,
  currentTimestamp: WorldTimestamp
): Promise<Array<{ level: number; max: number; used: number }>> {
  // Find last long rest
  const lastLongRest = await getLastRestEvent(
    campaignId,
    characterId,
    ['long_rest', 'new_day']
  );

  const startTimestamp = lastLongRest?.worldTimestamp ?? { day: 0, slot: 0, turn: 0 };

  // Start with all slots available
  const slots = baseSlots.map(s => ({ ...s, used: 0 }));

  // Get all spell casts and rests since then
  const deltas = await getDeltas(
    campaignId,
    0,
    Number.MAX_SAFE_INTEGER,
    {
      entityIds: [characterId],
      entityTypes: ['spell_cast', 'rest_event'],
    }
  );

  const startTurns = timestampToTurns(startTimestamp);
  const currentTurns = timestampToTurns(currentTimestamp);

  for (const delta of deltas) {
    if (!delta.worldTimestamp) continue;

    const deltaTurns = timestampToTurns(delta.worldTimestamp);
    if (deltaTurns <= startTurns || deltaTurns > currentTurns) continue;

    if (delta.entityType === 'spell_cast' && delta.delta.slotUsed) {
      const slotLevel = delta.delta.slotUsed;
      const slot = slots.find(s => s.level === slotLevel);
      if (slot) {
        slot.used = Math.min(slot.max, slot.used + 1);
      }
    }

    if (delta.entityType === 'rest_event') {
      const restEvent = delta.delta as RestEvent;

      // Arcane recovery: restore specific slots
      if (restEvent.resets.specificSlots) {
        for (const level of restEvent.resets.specificSlots) {
          const slot = slots.find(s => s.level === level);
          if (slot) {
            slot.used = Math.max(0, slot.used - 1);
          }
        }
      }

      // Short rest pact slot recovery
      if (restEvent.resets.pactSlots) {
        // Pact slots are handled separately by warlock
      }
    }
  }

  return slots;
}
