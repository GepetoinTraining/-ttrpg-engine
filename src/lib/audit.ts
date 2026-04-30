/**
 * Audit — forensic verification of `tpb_entries`.
 *
 * Per `project_cert_hierarchy.md` "Dual signatures are forensic, not gating":
 *   - The happy path (slot push → cron drain → tpb_entries) does NO
 *     receipt math and NO signature verification — it just trusts and
 *     appends.
 *   - This module is the ON-DEMAND verification path. It walks a slice
 *     of the canonical ledger, checks shape + ordering invariants, and
 *     flags divergences. Signatures are inspected only at divergence points.
 *
 * v1 scope: shape (Zod) + ordering invariants. Real signature verification
 * waits for the audit-pipeline crypto landing (replaces stub `stubSig`
 * with `computeTrajectory(zeta, n)` checks).
 *
 * The exported `auditEntries` function is PURE — takes a list of entries,
 * returns findings. Easily testable without DB. The route handler in
 * `/api/world/audit/route.ts` is the thin DB-fetch shell.
 */

import { WorldTPBActionSchema, type WorldTPBAction } from '../../engine/tpb-world'

export interface AuditEntry {
  id: number
  worldDay: number
  actionType: string
  /** Pre-parsed action JSON. Audit will re-parse via Zod for validation. */
  action: unknown
  /** Optional ISO timestamp from the canonical write moment (cron drain). */
  realTs?: string | null
}

export type DivergenceKind =
  /** Action JSON failed Zod parse — corruption or version mismatch. */
  | 'shape_invalid'
  /** worldDay went backwards — drain bug or insertion race. */
  | 'worldday_regressed'
  /** entityMove's `from.nodeId` doesn't match the most-recent party position. */
  | 'party_position_mismatch'
  /** characterTransfer with no signature stored (should be impossible — slot push enforces). */
  | 'transfer_missing_signatures'
  /** tick action emitted between non-tick rows — only cron should produce ticks, and they should be standalone. */
  | 'tick_inline'
  /** Receipt's `verified` flag is false — math integrity broken at the source. */
  | 'receipt_math_failed'

export interface Divergence {
  entryId: number
  worldDay: number
  kind: DivergenceKind
  detail: string
  /** Recovery hint for forensic UI: which signatures to re-verify. */
  signaturesToCheck?: ('initiateSig' | 'acceptSig' | 'characterSig' | 'accountSig')[]
}

export interface AuditOptions {
  /** Track the running party position; report mismatches on entityMove */
  trackPartyPosition?: boolean
  /** Initial party position (e.g. fetched from worlds.partyNodeId at fromDay) */
  initialPartyNodeId?: string | null
}

export interface AuditResult {
  entriesAudited: number
  divergences: Divergence[]
  ok: boolean
  /** Final party position after walking the entries. */
  finalPartyNodeId: string | null
  /** Final worldDay observed in the slice. */
  finalWorldDay: number
}

/**
 * Walk a slice of `tpb_entries` and produce divergence findings.
 *
 * Pure function — no DB, no clock. Caller passes pre-fetched entries
 * (typically ordered by `worldDay ASC, id ASC`).
 */
export function auditEntries(
  entries: AuditEntry[],
  options: AuditOptions = {},
): AuditResult {
  const trackPartyPosition = options.trackPartyPosition !== false
  const divergences: Divergence[] = []

  let partyNodeId: string | null = options.initialPartyNodeId ?? null
  let lastWorldDay = -Infinity

  for (const entry of entries) {
    // ── Ordering invariant: worldDay never regresses ──
    if (entry.worldDay < lastWorldDay) {
      divergences.push({
        entryId: entry.id,
        worldDay: entry.worldDay,
        kind: 'worldday_regressed',
        detail: `worldDay ${entry.worldDay} < previous ${lastWorldDay}`,
      })
    }
    lastWorldDay = Math.max(lastWorldDay, entry.worldDay)

    // ── Shape: Zod parse the action ──
    const parsed = WorldTPBActionSchema.safeParse(entry.action)
    if (!parsed.success) {
      divergences.push({
        entryId: entry.id,
        worldDay: entry.worldDay,
        kind: 'shape_invalid',
        detail: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      })
      continue
    }

    const action = parsed.data
    if (action.type !== entry.actionType) {
      divergences.push({
        entryId: entry.id,
        worldDay: entry.worldDay,
        kind: 'shape_invalid',
        detail: `actionType column "${entry.actionType}" disagrees with payload type "${action.type}"`,
      })
    }

    // ── Type-specific invariant checks ──
    handleActionInvariants(action, entry, divergences, {
      trackPartyPosition,
      currentPartyNodeId: partyNodeId,
      onPartyMove: (nextNode) => { partyNodeId = nextNode },
    })
  }

  return {
    entriesAudited: entries.length,
    divergences,
    ok: divergences.length === 0,
    finalPartyNodeId: partyNodeId,
    finalWorldDay: lastWorldDay === -Infinity ? -1 : lastWorldDay,
  }
}

interface InvariantContext {
  trackPartyPosition: boolean
  currentPartyNodeId: string | null
  onPartyMove: (nodeId: string) => void
}

function handleActionInvariants(
  action: WorldTPBAction,
  entry: AuditEntry,
  divergences: Divergence[],
  ctx: InvariantContext,
): void {
  switch (action.type) {
    case 'entityMove': {
      if (ctx.trackPartyPosition && action.entityId === 'party') {
        if (action.from.type === 'at_node') {
          if (
            ctx.currentPartyNodeId !== null &&
            action.from.nodeId !== ctx.currentPartyNodeId
          ) {
            divergences.push({
              entryId: entry.id,
              worldDay: entry.worldDay,
              kind: 'party_position_mismatch',
              detail: `entityMove from=${action.from.nodeId} but tracker had ${ctx.currentPartyNodeId}`,
              signaturesToCheck: ['characterSig', 'accountSig'],
            })
          }
        }
        if (action.to.type === 'at_node') ctx.onPartyMove(action.to.nodeId)
      }
      return
    }

    case 'characterTransfer': {
      if (!action.initiateSig || !action.acceptSig) {
        divergences.push({
          entryId: entry.id,
          worldDay: entry.worldDay,
          kind: 'transfer_missing_signatures',
          detail: `characterTransfer ${action.characterId} missing ${
            !action.initiateSig ? 'initiateSig ' : ''
          }${!action.acceptSig ? 'acceptSig' : ''}`.trim(),
          signaturesToCheck: ['initiateSig', 'acceptSig'],
        })
      }
      return
    }

    case 'tick': {
      // Cron drives ticks. They should appear in their own slot push (or
      // be the cron-direct-write to tpb_entries). If a tick row appears
      // alongside non-tick rows in the same drain batch, that's noise but
      // not necessarily wrong. Currently no firm invariant — placeholder
      // for future stricter checks.
      return
    }

    case 'writeKappa':
    case 'writeEdge':
    case 'observe':
    case 'entitySpawn':
    case 'entityDespawn':
    case 'session':
      // No additional invariants beyond shape for v1.
      return
  }
}
