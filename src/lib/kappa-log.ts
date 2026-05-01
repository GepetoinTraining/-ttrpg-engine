/**
 * κ log replay — pure helper, no DB.
 *
 * Per `feedback_observation_writes.md`: "the world is regenerable from
 * (seed, currentWorldDay, observed_kappa_log, player_actions_log)".
 *
 * `applyKappaLog` consumes the audit-log `deltaJson` strings (one per
 * tpb_entries row) and replays the `writeKappa` deltas into a fresh TP via
 * `tp.writeDomain`. Skips non-writeKappa entries, entries without a value
 * (legacy / pre-Phase-2.9), and malformed JSON.
 *
 * Lives in src/lib/ rather than engine/ because it's a server-side
 * persistence-bridge helper — the engine is pure and doesn't know about
 * tpb_entries shape.
 */

import type { TP } from '../../engine/tp'
import type { WorldTPBAction } from '../../engine/tpb-world'

export function applyKappaLog(tp: TP, deltaJsons: (string | null)[]): void {
  for (const deltaJson of deltaJsons) {
    if (!deltaJson) continue
    try {
      const action = JSON.parse(deltaJson) as WorldTPBAction
      if (
        action.type === 'writeKappa' &&
        action.value !== undefined &&
        action.value !== null
      ) {
        // Cast domain — writeDomain's runtime Zod check rejects unknown
        // domains, so the cast is safe. action.domain is `string` on the
        // wire; the type-narrowing happens inside writeDomain.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tp.writeDomain(action.nodeId, action.domain as any, action.value as any)
      }
    } catch {
      // skip malformed audit entries
    }
  }
}
