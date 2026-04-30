/**
 * WORLD-TPB — observation-log bridge between the engine and the DB
 * ===================================================================
 *
 * Per `feedback_observation_writes.md`:
 *   "The world is regenerable from (seed, currentWorldDay,
 *    observed_kappa_log, player_actions_log). Anything else is
 *    optional cache."
 *
 * This module is the DB SIDE of that bridge: every WorldTPBAction
 * (κ writes, observations, entity moves, ticks) appends to `tpb_entries`,
 * and resolved MMs snapshot to `mm_states`.
 *
 * The κ-write CAPTURE primitive lives in `engine/tp-write-capture.ts` so
 * client + server share one implementation (re-exported below for
 * existing callers). The capture monkey-patches a per-request TP; after
 * observation completes we flush the buffer to `tpb_entries`.
 *
 * Existing schemas (src/db/schema.ts):
 *   tpb_entries: id · worldDay · actionType · targetId · deltaJson · timestamp
 *   mm_states:   id · mmType · nodeId · layer · cadence · pendingPotential · domainStateJson
 *
 * SERVER ONLY. Imported by `world-state.ts` and route handlers.
 */

import { db } from '../db/connection'
import { tpbEntries, mmStates } from '../db/schema'
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm'
import type { ISimulatedMM } from '../../engine/mm-simulated'
import type { WorldTPBAction } from '../../engine/tpb-world'

// ============================================================
// WRITE-CAPTURE — re-exported from engine/ for backward-compat
// ============================================================
//
// Implementation lives in `engine/tp-write-capture.ts`. The eventual
// browser engine-client imports it directly; server-side callers can
// continue importing from this module.

import { attachWriteLog, type WriteCapture } from '../../engine/tp-write-capture'
export { attachWriteLog, type WriteCapture }

// ============================================================
// APPEND HELPERS
// ============================================================

/**
 * Pick the canonical "subject" of an action for the targetId column.
 * Lets simple `WHERE target_id = ?` queries answer "what happened to X?".
 */
function targetIdForAction(action: WorldTPBAction): string | null {
  switch (action.type) {
    case 'tick':              return null
    case 'writeKappa':        return action.nodeId
    case 'writeEdge':         return action.edgeId
    case 'entitySpawn':       return action.entityId
    case 'entityMove':        return action.entityId
    case 'entityDespawn':     return action.entityId
    case 'observe':           return action.nodeId
    case 'session':           return action.sessionId
    case 'characterTransfer': return action.characterId
  }
}

/**
 * Append a single WorldTPBAction to `tpb_entries`. Used directly for
 * 'tick' / 'observe' / 'entityMove' / 'session' actions that aren't
 * caught by the writeKappa capture.
 */
export async function appendAction(
  worldDay: number,
  action: WorldTPBAction,
): Promise<void> {
  await db.insert(tpbEntries).values({
    worldDay,
    actionType: action.type,
    targetId: targetIdForAction(action),
    deltaJson: JSON.stringify(action),
    timestamp: new Date().toISOString(),
  })
}

/**
 * Flush a capture buffer to `tpb_entries`. Single bulk insert; cheap.
 */
export async function flushWriteLog(
  worldDay: number,
  capture: WriteCapture,
): Promise<number> {
  if (capture.entries.length === 0) return 0
  const ts = new Date().toISOString()
  await db.insert(tpbEntries).values(
    capture.entries.map((action) => ({
      worldDay,
      actionType: action.type,
      targetId: targetIdForAction(action),
      deltaJson: JSON.stringify(action),
      timestamp: ts,
    })),
  )
  return capture.entries.length
}

// ============================================================
// MM SNAPSHOT
// ============================================================

/**
 * Snapshot a resolved MM's domain state to `mm_states`. UPSERT keyed on `id`.
 *
 * Call this only after `mm.resolve()` so the snapshot reflects the
 * latest observation. Between observations the MM lives in memory (or
 * is regenerable from log replay) — no per-tick writes needed.
 *
 * @param layer    Clockwork layer (0–6). Caller knows it from the Clockwork
 *                 registration; we don't read it back from the MM.
 * @param cadence  Cadence string ('daily' / 'weekly' / etc.).
 */
export async function snapshotMm(
  mm: ISimulatedMM,
  layer: number = 0,
  cadence: string = 'weekly',
): Promise<void> {
  const ser = mm.serialize()
  await db
    .insert(mmStates)
    .values({
      id: mm.state.id,
      mmType: mm.state.mmType,
      nodeId: mm.state.nodeId,
      layer,
      cadence,
      pendingPotential: mm.state.pendingPotential.daysPending,
      domainStateJson: JSON.stringify(ser.domain),
    })
    .onConflictDoUpdate({
      target: mmStates.id,
      set: {
        mmType: mm.state.mmType,
        nodeId: mm.state.nodeId,
        layer,
        cadence,
        pendingPotential: mm.state.pendingPotential.daysPending,
        domainStateJson: JSON.stringify(ser.domain),
      },
    })
}

// ============================================================
// REPLAY READS — for surfaces that show timeline / history
// ============================================================

export interface TpbReadOptions {
  fromDay?: number
  toDay?: number
  actionType?: string
  targetId?: string
  limit?: number
}

export interface TpbEntryRow {
  id: number
  worldDay: number
  realTs: string | null
  action: WorldTPBAction
}

export async function readTpbEntries(opts: TpbReadOptions = {}): Promise<TpbEntryRow[]> {
  const conds = []
  if (opts.fromDay != null) conds.push(gte(tpbEntries.worldDay, opts.fromDay))
  if (opts.toDay != null) conds.push(lte(tpbEntries.worldDay, opts.toDay))
  if (opts.actionType) conds.push(eq(tpbEntries.actionType, opts.actionType))
  if (opts.targetId) conds.push(eq(tpbEntries.targetId, opts.targetId))

  const q = db.select().from(tpbEntries)
  const rows = await (conds.length > 0 ? q.where(and(...conds)) : q)
    .orderBy(asc(tpbEntries.worldDay), asc(tpbEntries.id))
    .limit(opts.limit ?? 500)

  return rows.map((r) => ({
    id: r.id,
    worldDay: r.worldDay,
    realTs: r.timestamp,
    action: JSON.parse(r.deltaJson ?? 'null') as WorldTPBAction,
  }))
}

/**
 * Newest entries first — for live event feeds in surfaces like Play.tsx.
 */
export async function readRecentTpbEntries(limit: number = 50): Promise<TpbEntryRow[]> {
  const rows = await db
    .select()
    .from(tpbEntries)
    .orderBy(desc(tpbEntries.id))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    worldDay: r.worldDay,
    realTs: r.timestamp,
    action: JSON.parse(r.deltaJson ?? 'null') as WorldTPBAction,
  }))
}
