/**
 * TP WRITE CAPTURE — observation log primitive
 * ==============================================
 *
 * Per `feedback_observation_writes.md`:
 *   "The world is regenerable from (seed, currentWorldDay,
 *    observed_kappa_log, player_actions_log)."
 *
 * `attachWriteLog` monkey-patches a TP instance so every successful
 * `writeKappa` / `writeDomain` call appends a `writeKappa` action to a
 * capture buffer. After the observation window closes, the caller flushes
 * the buffer wherever it persists actions (server → tpb_entries table,
 * client → POST /api/world/append payload).
 *
 * PURE COMPUTE — no DB imports. Lives in engine/ so client + server can
 * share one implementation. The DB-side `appendAction` / `flushWriteLog`
 * helpers in `src/lib/world-tpb.ts` consume the captured entries; an
 * eventual `engine-client.ts` will POST them to /api/world/append.
 */

import type { TP } from './tp.js'
import type { WorldTPBAction } from './tpb-world.js'

// ============================================================
// WRITE CAPTURE
// ============================================================

export interface WriteCapture {
  entries: WorldTPBAction[]
  /** Restore original methods. Always call after the capture window closes. */
  detach: () => void
}

/**
 * Wrap a TP instance so every successful writeKappa / writeDomain call
 * appends a `writeKappa` action to the capture buffer.
 *
 * The TP is mutated. Caller must `detach()` when done so subsequent
 * non-tracked code paths see the original methods. (In practice the TP
 * is per-request anyway, so detach is mostly belt-and-suspenders.)
 *
 * @param tp     The TP whose writes should be captured.
 * @param system Engine system label that owns the writes — e.g.
 *               'transport', 'cron', 'mm-faction'. Stored on each entry.
 */
export function attachWriteLog(tp: TP, system: string): WriteCapture {
  const entries: WorldTPBAction[] = []

  const origWriteDomain = tp.writeDomain.bind(tp)
  const origWriteKappa = tp.writeKappa.bind(tp)

  tp.writeDomain = function (
    nodeId: string,
    domain: string,
    value: unknown,
    options?: { merge?: boolean },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = origWriteDomain(nodeId as any, domain as any, value as any, options)
    if (ok) {
      const paths =
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.keys(value as Record<string, unknown>).map((k) => `${domain}.${k}`)
          : [domain]
      entries.push({
        type: 'writeKappa',
        nodeId,
        domain,
        paths,
        system,
      })
    }
    return ok
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  tp.writeKappa = function (nodeId: string, overrides: Record<string, unknown>) {
    const ok = origWriteKappa(nodeId, overrides)
    if (ok) {
      // Group writes by their top-level domain so the log entry shape stays consistent.
      const byDomain = new Map<string, string[]>()
      for (const path of Object.keys(overrides)) {
        const d = path.split('.')[0]
        if (!byDomain.has(d)) byDomain.set(d, [])
        byDomain.get(d)!.push(path)
      }
      for (const [domain, paths] of byDomain) {
        entries.push({
          type: 'writeKappa',
          nodeId,
          domain,
          paths,
          system,
        })
      }
    }
    return ok
  }

  return {
    entries,
    detach: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tp.writeDomain = origWriteDomain as any
      tp.writeKappa = origWriteKappa
    },
  }
}
