/**
 * TPB-WORLD — Typed action union for the WORLD-level TPB
 * ========================================================
 *
 * The base TPB class is generic — TPB<TState, TAction>. For player-tree
 * sessions we use it with a session-action type. For the world-tree we use
 * it with WorldTPBAction below — every clockwork tick, every κ write,
 * every entity move, every observation appends an entry.
 *
 * The discriminator is `type`. Each variant carries the minimum data needed
 * to replay the change. Snapshots of state live separately on the TPBEntry.
 *
 * Cadences (per docs/tp_schema.md "Checkpoint Cadence"):
 *   Daily/Weekly/Monthly/Quarterly/Semesterly/Yearly tick → 'tick'
 *   κ write inside a domain resolve   → 'writeKappa'
 *   Edge field mutation                → 'writeEdge'
 *   Entity spawn/move/despawn          → 'entitySpawn' | 'entityMove' | 'entityDespawn'
 *   Player observes a node             → 'observe'
 *   Session start/end markers          → 'session'
 */

import { z } from 'zod'
import { EntityPositionSchema, type EntityPosition } from './tp'
import type { TickCadence } from './clockwork'
import type { TPB } from './tpb'

// ============================================================
// ACTION VARIANTS
// ============================================================

const TickCadenceSchema = z.enum([
  'round', 'slot', 'hourly',
  'daily', 'weekly', 'monthly',
  'quarterly', 'semesterly', 'yearly',
])

export const WorldTPBActionSchema = z.discriminatedUnion('type', [
  // ── Clock ──
  z.object({
    type: z.literal('tick'),
    worldDay: z.number().int().nonnegative(),
    cadence: TickCadenceSchema,
    mmsTicked: z.number().int().nonnegative().default(0),
  }),

  // ── Node κ ──
  z.object({
    type: z.literal('writeKappa'),
    nodeId: z.string(),
    domain: z.string(),
    paths: z.array(z.string()),
    /** Which engine system performed the write (e.g. "weather.ts", "market.ts") */
    system: z.string(),
    /**
     * Optional κ delta payload. The path-level new state(s) the writer
     * computed locally — drain-side application merges this into the
     * canonical κ store at (nodeId, domain). Old writes (pre-Phase-2.9)
     * omit this field and only record the audit trail.
     *
     * For partial-domain writes (most writeKappa intents), the value is
     * a partial of the domain's `Rules` shape — e.g. for a hunt at a
     * region, value = `{ herds: { [herdId]: <updatedWildHerd> } }`.
     */
    value: z.unknown().optional(),
  }),

  // ── Edge ──
  z.object({
    type: z.literal('writeEdge'),
    edgeId: z.string(),
    field: z.string(),
    system: z.string(),
  }),

  // ── Entity lifecycle ──
  z.object({
    type: z.literal('entitySpawn'),
    entityType: z.string(),
    entityId: z.string(),
    position: EntityPositionSchema,
  }),
  z.object({
    type: z.literal('entityMove'),
    entityId: z.string(),
    from: EntityPositionSchema,
    to: EntityPositionSchema,
  }),
  z.object({
    type: z.literal('entityDespawn'),
    entityId: z.string(),
    reason: z.string(),
  }),

  // ── Observation ──
  z.object({
    type: z.literal('observe'),
    nodeId: z.string(),
    /** Identity of the observer — party id, GM, autonomous tick, etc. */
    partyId: z.string().optional(),
  }),

  // ── Session markers ──
  z.object({
    type: z.literal('session'),
    sessionId: z.string(),
    event: z.enum(['start', 'end']),
  }),

  // ── Character cert transfer (trade) ──
  // Per `project_cert_hierarchy.md`: trades are 2-step (initiate + accept).
  // This action records the COMPLETED transfer — both signatures captured.
  // The character cert's ownerChain has already been updated server-side
  // when this row is appended.
  z.object({
    type: z.literal('characterTransfer'),
    characterId: z.string(),
    fromAccountId: z.string(),
    toAccountId: z.string(),
    /** Initiator signature (current owner consenting to handoff) */
    initiateSig: z.string(),
    /** Receiver signature (new owner accepting) */
    acceptSig: z.string(),
  }),
])
export type WorldTPBAction = z.infer<typeof WorldTPBActionSchema>

// Re-export EntityPosition so callers don't need a second import for
// constructing actions.
export type { EntityPosition, TickCadence }

// ============================================================
// TYPED INSTANCE ALIAS
// ============================================================

/**
 * The world-level TPB carries an arbitrary state snapshot (often null or a
 * coarse summary — full state lives in `mm_states` + `world_nodes`) and the
 * typed action union above.
 *
 * Use:
 *   import { TPB } from './tpb'
 *   const worldTpb: WorldTPB = TPB.create<unknown, WorldTPBAction>(null)
 */
export type WorldTPB = TPB<unknown, WorldTPBAction>
