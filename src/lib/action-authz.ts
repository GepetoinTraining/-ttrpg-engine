/**
 * action-authz.ts — content-policy gate at the action boundary.
 *
 * Per Pedro 2026-04-30: math is the gate, signatures/hashes are NOT
 * verified on the happy path. But there are a handful of action variants
 * that are only meant to be emitted by specific server paths or by certs
 * with specific persona authority. Letting any client emit any action
 * means a misbehaving client can pollute the canonical .tpb in ways the
 * math alone can't catch (e.g. a `tick` action emitted by a player would
 * pretend cron fired; a `characterTransfer` that bypasses the 2-step
 * trade flow would corrupt the cert ownership chain).
 *
 * This module is content-policy: which personas are allowed to emit
 * which action types. Pure function, no DB, no math. Used at the action
 * boundary (e.g. `/api/hub/[settlementId]/receipt` before sequencing into
 * `hub_runtime_receipts`).
 *
 * Returns null if allowed; returns a string reason if denied.
 */

import type { WorldTPBAction } from '../../engine/tpb-world'
import type { PersonaType } from './character-cert'

export function checkActionAllowed(
  action: WorldTPBAction,
  personaType: PersonaType,
): string | null {
  const isGm = personaType === 'dm' || personaType === 'gm-ai'

  switch (action.type) {
    case 'tick':
      return 'tick is cron-only; clients cannot emit tick actions'

    case 'characterTransfer':
      return 'characterTransfer flows through /api/character/trade/{initiate,accept}'

    case 'entitySpawn':
    case 'entityDespawn':
    case 'writeEdge':
    case 'session':
      return isGm
        ? null
        : `${action.type} requires GM authority (dm or gm-ai), got ${personaType}`

    case 'writeKappa':
    case 'entityMove':
    case 'observe':
      return null

    default: {
      // Exhaustiveness check — if a new action type lands without an
      // explicit policy, fall back to deny so the omission surfaces.
      const _exhaustive: never = action
      void _exhaustive
      return `unknown action type — add an explicit policy in action-authz.ts`
    }
  }
}

export function assertActionAllowed(
  action: WorldTPBAction,
  personaType: PersonaType,
): void {
  const reason = checkActionAllowed(action, personaType)
  if (reason) throw new Error(reason)
}
