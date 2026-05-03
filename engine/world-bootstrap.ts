/**
 * WORLD BOOTSTRAP — Shared TP + Clockwork construction
 * ======================================================
 *
 * Pure compute. Zero DB imports. Imported by both:
 *   - server: `src/lib/world-state.ts` (rebuilt per request)
 *   - client: `src/lib/engine-client.ts` (rebuilt on hydrate)
 *
 * Math symmetry: both sides construct the SAME TP from the same hardcoded
 * static base. After hydration (server: replay-from-tpb_entries; client:
 * replay-from-/api/world/replay), the two TPs are bit-identical. From that
 * point any computation either side runs produces the same result.
 *
 * When the per-region-table architecture lands (Wave 4 wave-2), the static
 * `BASE_NODES` constant becomes a query against `world_regions` —
 * but the SAME query result feeds both sides, so symmetry is preserved.
 */

import { TP, type WorldNode } from './tp'
import { Clockwork } from './clockwork'
import { MMTechnologyWeb } from './mm-technology-web'

// ============================================================
// STATIC BASE NODES
// ============================================================

/** Settlement node IDs the static TP currently exposes. */
export const SETTLEMENT_NODE_IDS = ['suzail', 'wheloon', 'marsember'] as const

/** All static .tp nodes — the world's hardcoded skeleton. */
export const BASE_NODES: WorldNode[] = [
  { id: 'toril',             type: 'planet',     name: 'Toril',               parentId: null,     dataStatic: {} },
  { id: 'faerun',            type: 'continent',  name: 'Faerûn',              parentId: 'toril',  dataStatic: {} },
  { id: 'cormyr',            type: 'kingdom',    name: 'Cormyr',              parentId: 'faerun', dataStatic: {} },
  { id: 'suzail',            type: 'settlement', name: 'Suzail',              parentId: 'cormyr', dataStatic: { settlement: { scale: 'city', population: 53000 } } },
  { id: 'wheloon',           type: 'settlement', name: 'Wheloon',             parentId: 'cormyr', dataStatic: { settlement: { scale: 'town', population: 4500 } } },
  { id: 'marsember',         type: 'settlement', name: 'Marsember',           parentId: 'cormyr', dataStatic: { settlement: { scale: 'town', population: 8000 } } },
  { id: 'high_road_25',      type: 'edge_site',  name: 'High Road · mile 25', parentId: 'cormyr', dataStatic: {} },
  { id: 'cormanthor_portal', type: 'poi',        name: 'Cormanthor Portal',   parentId: 'faerun', dataStatic: {} },
  { id: 'sunset_vault',      type: 'poi',        name: 'Sunset Vault',        parentId: 'cormyr', dataStatic: {} },
]

// ============================================================
// TP BUILDER
// ============================================================

/** Construct a fresh TP loaded with the static base nodes. */
export function buildBaseTp(): TP {
  const tp = new TP()
  tp.loadNodes(BASE_NODES)
  return tp
}

// ============================================================
// MM REGISTRATION
// ============================================================

/**
 * Register the canonical MM set into a Clockwork. Called by both the server
 * (per-request, after TP hydration) and the client (after hydrate).
 *
 * V1 set: MMTechnologyWeb per settlement (layer 6 hub services, weekly).
 * Future expansion: mm-faction, mm-market, mm-weather, etc. Each MM added
 * here automatically lands on both client and server with no other change.
 *
 * **Active-hub gate is enabled here** (per Pedro 2026-05-02). Hub-bound MMs
 * (those with `state.nodeId`) only tick when the player has accumulated
 * `ACTIVE_HUB_THRESHOLD_DAYS` (default 16) of presence within the
 * `ACTIVE_HUB_WINDOW_DAYS` (default 30) window. World-tree MMs (no nodeId)
 * always tick. Player IDB carries hubs with lighter presence; the server
 * only spends ticks on hubs the player has invested in. Tests that build
 * Clockwork directly (without this canonical registration) keep the gate
 * default-OFF; tests can also call `setActiveHubThreshold(1)` for
 * "any-observation" behavior when seeding 16 visits is impractical.
 */
export function registerCanonicalMMs(clockwork: Clockwork, worldDay: number): void {
  clockwork.setActiveHubGate(true)
  for (const nodeId of SETTLEMENT_NODE_IDS) {
    const techWeb = new MMTechnologyWeb({ settlementNodeId: nodeId, worldDay })
    clockwork.register(techWeb, 6, 'weekly')
  }
}
