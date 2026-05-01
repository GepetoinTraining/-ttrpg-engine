/**
 * hub-tensor.ts — helpers for the additive `hub_runtime_state` table.
 *
 * Per Pedro 2026-05-01: the `hub_runtime_state` table acts like a tensor.
 * Each row corresponds to one open `hub_runtimes` row; each column is a
 * WorldTPBAction variant carrying a JSON array of posted entries. Both
 * shards in a multi-DM (or multi-live-cert) lease post their alterations
 * here; reading the row gives the live shared view grouped by alteration
 * type.
 *
 * The receipts table (`hub_runtime_receipts`) remains the time-axis (the
 * sequenced audit log "checked" via deterministic replay on drain). This
 * table is the dimension-axis (per-type fast read for live shared view).
 * Same posts, two views.
 *
 * Pure helpers — no DB. The actual UPDATE happens in the route handler.
 */

import type { WorldTPBAction } from '../../engine/tpb-world'

/** What a posted entry looks like in any of the per-type columns. */
export interface TensorEntry {
  seq: number
  actorCertId: string
  at: string
  action: WorldTPBAction
  receipt: unknown
}

/**
 * Map a WorldTPBAction variant to the column name on `hub_runtime_state`.
 * Exhaustive — TS will surface any new variant that lacks a column.
 */
export function tensorColumnFor(
  type: WorldTPBAction['type'],
):
  | 'tickJson'
  | 'writeKappaJson'
  | 'writeEdgeJson'
  | 'entitySpawnJson'
  | 'entityMoveJson'
  | 'entityDespawnJson'
  | 'observeJson'
  | 'sessionJson'
  | 'characterTransferJson' {
  switch (type) {
    case 'tick':              return 'tickJson'
    case 'writeKappa':        return 'writeKappaJson'
    case 'writeEdge':         return 'writeEdgeJson'
    case 'entitySpawn':       return 'entitySpawnJson'
    case 'entityMove':        return 'entityMoveJson'
    case 'entityDespawn':     return 'entityDespawnJson'
    case 'observe':           return 'observeJson'
    case 'session':           return 'sessionJson'
    case 'characterTransfer': return 'characterTransferJson'
  }
}

/**
 * Append a single entry to a JSON-array column body. Pure string-in,
 * string-out so the route handler can compose its UPDATE.
 *
 * Tolerant of malformed input — if the existing JSON is unreadable,
 * starts a fresh array (the receipts table is the authoritative
 * record; the tensor is regenerable).
 */
export function appendTensorEntry(existingJson: string, entry: TensorEntry): string {
  let arr: TensorEntry[]
  try {
    const parsed = JSON.parse(existingJson)
    arr = Array.isArray(parsed) ? (parsed as TensorEntry[]) : []
  } catch {
    arr = []
  }
  arr.push(entry)
  return JSON.stringify(arr)
}

/** Snapshot of all per-type entries for one runtime — shape returned by /runtime GET. */
export interface TensorSnapshot {
  tick: TensorEntry[]
  writeKappa: TensorEntry[]
  writeEdge: TensorEntry[]
  entitySpawn: TensorEntry[]
  entityMove: TensorEntry[]
  entityDespawn: TensorEntry[]
  observe: TensorEntry[]
  session: TensorEntry[]
  characterTransfer: TensorEntry[]
}

interface RawStateRow {
  tickJson: string
  writeKappaJson: string
  writeEdgeJson: string
  entitySpawnJson: string
  entityMoveJson: string
  entityDespawnJson: string
  observeJson: string
  sessionJson: string
  characterTransferJson: string
}

function parseColumn(json: string): TensorEntry[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as TensorEntry[]) : []
  } catch {
    return []
  }
}

/** Project a row from `hub_runtime_state` into a typed snapshot. */
export function snapshotFromRow(row: RawStateRow): TensorSnapshot {
  return {
    tick:              parseColumn(row.tickJson),
    writeKappa:        parseColumn(row.writeKappaJson),
    writeEdge:         parseColumn(row.writeEdgeJson),
    entitySpawn:       parseColumn(row.entitySpawnJson),
    entityMove:        parseColumn(row.entityMoveJson),
    entityDespawn:     parseColumn(row.entityDespawnJson),
    observe:           parseColumn(row.observeJson),
    session:           parseColumn(row.sessionJson),
    characterTransfer: parseColumn(row.characterTransferJson),
  }
}

/**
 * Flatten a snapshot back into a single sequence-ordered list. Used at
 * drain time when no receipts table is available — the tensor row alone
 * still yields the canonical order via each entry's `seq`. (In practice
 * the drain reads `hub_runtime_receipts` directly because it's already
 * sorted by the SQL layer.)
 */
export function flattenSnapshot(snap: TensorSnapshot): TensorEntry[] {
  const all: TensorEntry[] = [
    ...snap.tick,
    ...snap.writeKappa,
    ...snap.writeEdge,
    ...snap.entitySpawn,
    ...snap.entityMove,
    ...snap.entityDespawn,
    ...snap.observe,
    ...snap.session,
    ...snap.characterTransfer,
  ]
  all.sort((a, b) => a.seq - b.seq)
  return all
}
