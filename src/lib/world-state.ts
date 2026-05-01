/**
 * WORLD STATE — DB-backed, source-of-truth = `worlds` row
 * ===========================================================
 *
 * Wave 4 persistence. The DB carries accumulated state; the engine in
 * memory is a transient cache rebuilt per request.
 *
 *   `worlds.currentDay`   = canonical world day (incremented by cron + transport)
 *   `worlds.lastCronAt`   = ISO timestamp of last cron tick
 *   `worlds.partyNodeId`  = where the party is right now
 *
 * Every API call hydrates fresh from DB. The TP graph + Clockwork are
 * reconstructed in-process; they're stateless caches now.
 *
 * Cron endpoint advances `currentDay` on a schedule. Transport advances
 * it ad-hoc when the DM uses the "transport party" superpower.
 *
 * NOT exported to the client. Server only.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/db/connection'
import { worlds, tpbEntries } from '@/db/schema'
import { TP, type WorldNode } from '../../engine/tp'
import { Clockwork } from '../../engine/clockwork'
import { MMTechnologyWeb } from '../../engine/mm-technology-web'
import { applyKappaLog } from './kappa-log'
import {
  attachWriteLog,
  appendAction,
  flushWriteLog,
  snapshotMm,
} from './world-tpb'

const DEFAULT_WORLD_ID = 'default'

export interface WorldState {
  tp: TP
  clockwork: Clockwork
  worldId: string
  worldDay: number
  partyNodeId: string
  lastCronAt: string | null
  /** Numeric world seed — drives client-side biome generation. */
  seed: number
}

/**
 * TP is rebuilt every request from (static base nodes + tpb_entries replay).
 * The static base is cheap (sync new TP + loadNodes). The replay query
 * scales with audit-log size; for the dev playing surface it stays small.
 *
 * No module cache: per `feedback_observation_writes.md` "the world is
 * regenerable from (seed, currentWorldDay, observed_kappa_log,
 * player_actions_log)" — rebuilding from the log every request keeps that
 * property strictly true and avoids cross-request stale-cache bugs.
 */

function buildDefaultTp(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'toril',             type: 'planet',     name: 'Toril',             parentId: null,      dataStatic: {} },
    { id: 'faerun',            type: 'continent',  name: 'Faerûn',            parentId: 'toril',   dataStatic: {} },
    { id: 'cormyr',            type: 'kingdom',    name: 'Cormyr',            parentId: 'faerun',  dataStatic: {} },
    { id: 'suzail',            type: 'settlement', name: 'Suzail',            parentId: 'cormyr',  dataStatic: { settlement: { scale: 'city', population: 53000 } } },
    { id: 'wheloon',           type: 'settlement', name: 'Wheloon',           parentId: 'cormyr',  dataStatic: { settlement: { scale: 'town', population: 4500 } } },
    { id: 'marsember',         type: 'settlement', name: 'Marsember',         parentId: 'cormyr',  dataStatic: { settlement: { scale: 'town', population: 8000 } } },
    { id: 'high_road_25',      type: 'edge_site',  name: 'High Road · mile 25', parentId: 'cormyr',  dataStatic: {} },
    { id: 'cormanthor_portal', type: 'poi',        name: 'Cormanthor Portal', parentId: 'faerun',  dataStatic: {} },
    { id: 'sunset_vault',      type: 'poi',        name: 'Sunset Vault',      parentId: 'cormyr',  dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

/**
 * Hydrate κ from the canonical tpb_entries log. The audit log IS the
 * persistence layer until the per-region-table architecture lands. Pure
 * replay logic lives in `./kappa-log.ts`.
 */
async function hydrateKappaFromLog(tp: TP): Promise<void> {
  const rows = await db
    .select({ deltaJson: tpbEntries.deltaJson })
    .from(tpbEntries)
    .where(eq(tpbEntries.actionType, 'writeKappa'))
  applyKappaLog(tp, rows.map((r) => r.deltaJson))
}

/**
 * Read the singleton world row, inserting a fresh one if missing.
 * Called on every request — must stay fast.
 */
async function getOrBootstrapRow() {
  const existing = await db.select().from(worlds).where(eq(worlds.id, DEFAULT_WORLD_ID)).get()
  if (existing) return existing
  const seed = Math.floor(Math.random() * 2147483647)
  const fresh = {
    id: DEFAULT_WORLD_ID,
    name: 'Toril (default)',
    type: 'custom',
    seed,
    currentDay: 0,
    createdAt: new Date().toISOString(),
    lastCronAt: null,
    partyNodeId: 'suzail',
  }
  await db.insert(worlds).values(fresh).onConflictDoNothing()
  // Re-read — handles race where two requests bootstrap simultaneously
  return (await db.select().from(worlds).where(eq(worlds.id, DEFAULT_WORLD_ID)).get())!
}

/**
 * Settlement node IDs the static TP currently exposes — used to register
 * per-settlement MMs (mm-technology-web, future mm-* hub services).
 *
 * When the per-region-table architecture lands, this becomes a query against
 * the region tables. For now it's the static set baked into buildDefaultTp().
 */
const SETTLEMENT_NODE_IDS = ['suzail', 'wheloon', 'marsember'] as const

/**
 * Register the new Phase-2 MMs into a clockwork. Called per-request after
 * Clockwork construction. Layer 6 HUB SERVICES, weekly cadence — fires when
 * the weekly delta hits 7-day threshold. Resolves are observation-driven.
 */
function registerHubServiceMMs(clockwork: Clockwork, worldDay: number): void {
  for (const nodeId of SETTLEMENT_NODE_IDS) {
    const techWeb = new MMTechnologyWeb({ settlementNodeId: nodeId, worldDay })
    clockwork.register(techWeb, 6, 'weekly')
  }
}

/**
 * Hydrate the live world from DB. Per request: rebuild TP from static nodes,
 * replay κ from audit log, register Phase-2 MMs into the Clockwork at the
 * DB's current day.
 */
export async function getWorldState(): Promise<WorldState> {
  const row = await getOrBootstrapRow()
  const tp = buildDefaultTp()
  await hydrateKappaFromLog(tp)
  const clockwork = new Clockwork(tp, row.currentDay)
  registerHubServiceMMs(clockwork, row.currentDay)
  return {
    tp,
    clockwork,
    worldId: row.id,
    worldDay: row.currentDay,
    partyNodeId: row.partyNodeId ?? 'suzail',
    lastCronAt: row.lastCronAt,
    seed: row.seed,
  }
}

/**
 * Reset — kept for back-compat with tests that import it. Now a no-op since
 * there's no module-scoped state to reset; each `getWorldState` call rebuilds
 * fresh from DB.
 */
export function resetWorldState(): void {
  /* no module state to reset */
}

// ============================================================
// TRANSPORT
// ============================================================

/**
 * Heuristic travel-day estimator. Pre-A*-edge-distance placeholder.
 *
 * Uses TP node types + ancestor sharing to give a sensible default per
 * destination type. Real implementation (when world_edges has seeded
 * distances + tile coordinates per node) will compute via A* over the grid
 * + per-edge terrain modifiers.
 *
 *   - both settlements, same parent kingdom : 2 days
 *   - both settlements, different kingdoms  : 6 days
 *   - destination is `edge_site`            : 1 day
 *   - destination is `poi`                  : 3 days
 *   - default                               : 3 days
 *
 * Returns 0 if dest unknown.
 */
function estimateTravelDays(tp: TP, fromNodeId: string, toNodeId: string): number {
  const fromNode = tp.getNode(fromNodeId)
  const toNode = tp.getNode(toNodeId)
  if (!toNode) return 0

  const fromType = fromNode?.type ?? null
  const toType = toNode.type

  if (toType === 'edge_site') return 1
  if (toType === 'poi') return 3

  if (fromType === 'settlement' && toType === 'settlement') {
    // Walk ancestors looking for shared kingdom/region.
    const fromKingdom = findAncestorOfType(tp, fromNodeId, 'kingdom')
    const toKingdom = findAncestorOfType(tp, toNodeId, 'kingdom')
    if (fromKingdom && toKingdom && fromKingdom === toKingdom) return 2
    return 6
  }

  return 3
}

function findAncestorOfType(tp: TP, nodeId: string, type: string): string | null {
  let cur: string | null | undefined = nodeId
  for (let i = 0; i < 16 && cur; i++) {
    const n = tp.getNode(cur)
    if (!n) return null
    if (n.type === type) return n.id
    cur = n.parentId
  }
  return null
}

export type TimeMode = 'instant' | 'travel' | 'days'

export interface TransportRequest {
  destNodeId: string
  timeMode: TimeMode
  days?: number
}

export interface TransportResult {
  fromNodeId: string
  toNodeId: string
  destLabel: string
  daysAdvanced: number
  worldDay: number
  observed: { mmId: string; narrative: string }[]
}

export async function transportParty(req: TransportRequest): Promise<TransportResult> {
  const state = await getWorldState()
  const dest = state.tp.getNode(req.destNodeId)
  if (!dest) throw new Error(`unknown node: ${req.destNodeId}`)

  const fromNodeId = state.partyNodeId

  let daysAdvanced = 0
  switch (req.timeMode) {
    case 'instant':
      daysAdvanced = 0
      break
    case 'travel':
      daysAdvanced = estimateTravelDays(state.tp, state.partyNodeId, req.destNodeId)
      break
    case 'days':
      daysAdvanced = Math.max(0, Math.floor(req.days ?? 1))
      break
  }

  if (daysAdvanced > 0) {
    state.clockwork.crankTo(state.clockwork.worldDay + daysAdvanced)
  }

  // Capture any κ writes that happen during observation. The capture wraps
  // the per-request TP so writeKappa / writeDomain calls inside MM.onResolve()
  // get logged to tpb_entries.
  const capture = attachWriteLog(state.tp, 'transport')
  const obs = state.clockwork.observeNode(req.destNodeId)
  capture.detach()

  const newDay = state.clockwork.worldDay

  // Persist canonical position + day to the worlds row.
  await db
    .update(worlds)
    .set({ currentDay: newDay, partyNodeId: req.destNodeId })
    .where(eq(worlds.id, state.worldId))

  // Append append-only log entries: entityMove (the party) + observe + every
  // captured κ write, in order.
  await appendAction(newDay, {
    type: 'entityMove',
    entityId: 'party',
    from: { type: 'at_node', nodeId: fromNodeId },
    to: { type: 'at_node', nodeId: req.destNodeId },
  })
  await appendAction(newDay, {
    type: 'observe',
    nodeId: req.destNodeId,
    partyId: 'party',
  })
  await flushWriteLog(newDay, capture)

  // Snapshot any MMs that resolved during observation. These are caches —
  // regenerable from the log, but stored so subsequent reads don't replay.
  for (const r of obs.resolved) {
    const mm = state.clockwork.getMM(r.mmId)
    if (mm) await snapshotMm(mm)
  }

  return {
    fromNodeId,
    toNodeId: req.destNodeId,
    destLabel: dest.name,
    daysAdvanced,
    worldDay: newDay,
    observed: obs.resolved.map((r) => ({ mmId: r.mmId, narrative: r.narrative })),
  }
}

// ============================================================
// CRON TICK — advance world day on a schedule (no observation)
// ============================================================

export interface CronTickResult {
  worldDay: number
  daysAdvanced: number
  lastCronAt: string
}

/**
 * Advance the world by N days without observing any node. This is the
 * autonomous heartbeat — accumulates pending potential in MM state but
 * doesn't fire any resolves (matches the observation-writes rule).
 *
 * Default 1 day per call. The schedule (vercel.json cron) determines the
 * effective game-time rate — 1 cron/30min = 48 days/real-day, etc.
 */
export async function cronTick(daysToAdvance: number = 1): Promise<CronTickResult> {
  const state = await getWorldState()
  const safeDays = Math.max(1, Math.floor(daysToAdvance))
  state.clockwork.crankTo(state.clockwork.worldDay + safeDays)

  const newDay = state.clockwork.worldDay
  const now = new Date().toISOString()
  await db
    .update(worlds)
    .set({
      currentDay: newDay,
      lastCronAt: now,
    })
    .where(eq(worlds.id, state.worldId))

  // Append a single 'tick' action — observation log entry for the heartbeat.
  // No κ writes (cron doesn't observe), so this is the only row added.
  await appendAction(newDay, {
    type: 'tick',
    worldDay: newDay,
    cadence: 'daily',
    mmsTicked: 0,
  })

  return {
    worldDay: newDay,
    daysAdvanced: safeDays,
    lastCronAt: now,
  }
}

// ============================================================
// READ — public status snapshot
// ============================================================

export interface WorldStatus {
  worldDay: number
  partyNodeId: string
  partyNodeLabel: string
  partyNodeType: string
  partyComposition: string[]
  lastCronAt: string | null
  destinations: { id: string; label: string; type: string }[]
  /** Numeric world seed — clients can compute biomes locally from this. */
  seed: number
}

export async function getWorldStatus(): Promise<WorldStatus> {
  const state = await getWorldState()
  const here = state.tp.getNode(state.partyNodeId)
  return {
    worldDay: state.worldDay,
    partyNodeId: state.partyNodeId,
    partyNodeLabel: here?.name ?? state.partyNodeId,
    partyNodeType: here?.type ?? 'unknown',
    partyComposition: [],
    lastCronAt: state.lastCronAt,
    destinations: state.tp
      .getAllNodes()
      .filter((n) => ['settlement', 'poi', 'edge_site'].includes(n.type))
      .map((n) => ({ id: n.id, label: n.name, type: n.type })),
    seed: state.seed,
  }
}
