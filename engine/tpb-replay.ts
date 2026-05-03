/**
 * TPB REPLAY — apply WorldTPBAction[] to a TP
 * ============================================
 *
 * Pure compute. Used by both:
 *   - server: hydrating a fresh TP per request from `tpb_entries`
 *   - client: hydrating local TP from `/api/world/replay`
 *
 * Math symmetry: same code, same input → same TP state on both sides.
 *
 * Handles:
 *   - writeKappa  → tp.writeDomain (when value present)
 *   - entitySpawn → tp.registerEntity
 *   - entityMove  → tp.moveEntity
 *   - entityDespawn → tp.unregisterEntity
 *
 * Other action types (tick, observe, session, writeEdge, characterTransfer)
 * are no-ops at the TP level — they're audit-trail only or affect other
 * stores (DB-side only).
 */

import type { TP } from './tp'
import type { WorldTPBAction } from './tpb-world'

export function applyTpbAction(tp: TP, action: WorldTPBAction): void {
  switch (action.type) {
    case 'writeKappa': {
      if (action.value !== undefined && action.value !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tp.writeDomain(action.nodeId, action.domain as any, action.value as any)
      }
      break
    }
    case 'entitySpawn': {
      tp.registerEntity({
        id: action.entityId,
        type: action.entityType,
        position: action.position,
      })
      break
    }
    case 'entityMove': {
      tp.moveEntity(action.entityId, action.to)
      break
    }
    case 'entityDespawn': {
      tp.unregisterEntity(action.entityId)
      break
    }
    // tick / observe / session / writeEdge / characterTransfer — audit-only
    default:
      break
  }
}

export function applyTpbActions(tp: TP, actions: WorldTPBAction[]): void {
  for (const action of actions) {
    try {
      applyTpbAction(tp, action)
    } catch {
      // skip malformed / version-skewed actions
    }
  }
}
