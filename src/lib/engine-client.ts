/**
 * Engine client — browser-side world action producer.
 *
 * Per `project_next_routing_pass.md` + `project_cert_hierarchy.md`:
 *   - Client produces `WorldTPBAction[]` locally + buffers them
 *   - Pushes to `/api/world/slot/push` when ready (manual or auto)
 *   - Server appends without re-running the math (forensic-only sigs)
 *   - Cron drains slots into the canonical `tpb_entries` ledger
 *
 * V1 SCOPE: TP-level operations only (entityMove + observe + dice rolls).
 * World-tree MM resolution stays server-side (autonomous cron ticks).
 * The client doesn't need a local Clockwork yet — it produces action
 * intents, server's cron resolves the world.
 *
 * V2 (when DM-hosted parties land): full local TP + Clockwork so the DM's
 * client runs MM resolution for the party's session, signs the bundle,
 * pushes at session end. See `project_cert_hierarchy.md` "DM-as-shard-host".
 */

import { mfDice, type DiceFormula, type DiceResult, diceToReceipt } from '../../engine/mf-dice'
import type { WorldTPBAction, EntityPosition } from '../../engine/tpb-world'
import type { Receipt } from '../../engine/types'
import type { AccountCert } from './account-cert'
import type { CharacterCert } from './character-cert'

export interface EngineClientInit {
  account: AccountCert
  character: CharacterCert
  /** Current world day (typically server's `worldDay` at mount time) */
  worldDay: number
  /** Where the party is right now (server-canonical at mount) */
  partyNodeId: string
}

export interface ProducedActions {
  actions: WorldTPBAction[]
  receipts: Receipt[]
}

export interface PushResult {
  ok: boolean
  slotId: number | null
  queuedAt: string | null
  actionCount: number
}

/**
 * The engine client. One instance per active character session.
 *
 * Action producers are SYNCHRONOUS (pure compute) — they buffer into
 * `pendingActions`. `push()` is the only async I/O.
 */
export class EngineClient {
  private account: AccountCert
  private character: CharacterCert
  private worldDay: number
  private partyNodeId: string

  /** Buffered actions waiting to be pushed */
  private pendingActions: WorldTPBAction[] = []
  private pendingReceipts: Receipt[] = []
  /** Monotonically incrementing local tick counter for receipts */
  private localTick = 0

  constructor(init: EngineClientInit) {
    this.account = init.account
    this.character = init.character
    this.worldDay = init.worldDay
    this.partyNodeId = init.partyNodeId
  }

  // ── Read-only accessors ──

  getWorldDay(): number {
    return this.worldDay
  }
  getPartyNodeId(): string {
    return this.partyNodeId
  }
  pendingCount(): number {
    return this.pendingActions.length
  }
  getCharacter(): CharacterCert {
    return this.character
  }
  getAccount(): AccountCert {
    return this.account
  }

  // ── Action producers (pure, synchronous, buffer into pendingActions) ──

  /**
   * Transport the party to a destination node. Local clock advances by
   * `daysAdvanced` for tagging purposes — the server's canonical `worldDay`
   * advances independently via cron. This is NOT a `tick` action (only
   * cron emits those); it's `entityMove` + `observe`.
   */
  transport(destNodeId: string, daysAdvanced: number = 0): ProducedActions {
    const fromNodeId = this.partyNodeId
    let safeDays = Math.max(0, Math.floor(daysAdvanced))

    // Time-flow rule (project_cert_hierarchy.md):
    //   session-time personas (player / dm / gm-ai) can fast-travel via DM authority.
    //   `dmless` lives at server-cron time and cannot skip days — their world
    //   advances only via /api/cron/tick.
    if (this.character.personaType === 'dmless' && safeDays > 0) {
      // Silently clamp to 0; DMless transport is a free observe at the current
      // world day. The cron heartbeat is the only thing that moves their clock.
      safeDays = 0
    }

    if (safeDays > 0) {
      this.worldDay += safeDays
    }

    const from: EntityPosition = { type: 'at_node', nodeId: fromNodeId }
    const to: EntityPosition = { type: 'at_node', nodeId: destNodeId }

    const actions: WorldTPBAction[] = [
      { type: 'entityMove', entityId: 'party', from, to },
      { type: 'observe', nodeId: destNodeId, partyId: 'party' },
    ]

    this.partyNodeId = destNodeId
    this.pendingActions.push(...actions)

    return { actions, receipts: [] }
  }

  /**
   * Observe the current node (no movement). Emits an `observe` event so
   * the server-side cron MMs at this node will resolve their pending
   * potential into κ writes on the next drain.
   */
  observe(nodeId?: string): ProducedActions {
    const target = nodeId ?? this.partyNodeId
    const action: WorldTPBAction = {
      type: 'observe',
      nodeId: target,
      partyId: 'party',
    }
    this.pendingActions.push(action)
    return { actions: [action], receipts: [] }
  }

  /**
   * Roll dice locally. Produces a receipt that proves the math (per
   * Theorem 1 in MM-MF-TP-TPB.md: receipt R falls out of forward pass).
   * The receipt is stored as audit data; not a gating sig.
   *
   * Dice rolls don't produce world actions on their own — the consumer
   * decides what action (if any) to record. E.g. an attack roll might
   * produce no action (just a check result), but a successful damage
   * roll might record a `writeKappa` for the target's HP.
   */
  roll(formula: DiceFormula, seed?: number): { result: DiceResult; receipt: Receipt } {
    const { output, receipt } = mfDice(formula, seed)
    const fullReceipt = diceToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  /**
   * Apply a slow-life intent (study, sell, plant, tend, etc.). For v1
   * this is a placeholder that emits a generic `writeKappa` recording
   * the player's intent at their current node. The actual κ change
   * computation happens server-side.
   */
  applyIntent(intent: string, params: Record<string, unknown> = {}): ProducedActions {
    const action: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: this.partyNodeId,
      domain: 'intent',
      paths: [`intent.${intent}`, ...Object.keys(params).map((k) => `intent.${intent}.${k}`)],
      system: `client-intent:${this.character.id}`,
    }
    this.pendingActions.push(action)
    return { actions: [action], receipts: [] }
  }

  // ── I/O — push the buffered actions to the server ──

  /**
   * Push all pending actions + receipts to `/api/world/slot/push` as a
   * solo bundle. On success, clears the local buffer. On failure, leaves
   * the buffer intact so callers can retry.
   *
   * DM-hosted session bundles (kind: 'dm-session') are produced by a
   * different code path — see `pushDmBundle()` (TBD; not in v1).
   */
  async push(): Promise<PushResult> {
    if (this.pendingActions.length === 0) {
      return { ok: true, slotId: null, queuedAt: null, actionCount: 0 }
    }

    const payload = {
      kind: 'solo' as const,
      sourceCertId: this.character.id,
      atDay: this.worldDay,
      actions: this.pendingActions,
      receipts: this.pendingReceipts,
    }

    const res = await fetch('/api/world/slot/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      let msg = `${res.status}`
      try {
        const j = await res.json()
        if (j?.error) msg = j.error
      } catch {}
      throw new Error(`slot push failed: ${msg}`)
    }

    const json = (await res.json()) as { slotId: number | null; queuedAt: string; actionCount: number }
    const buffered = this.pendingActions.length
    this.pendingActions = []
    this.pendingReceipts = []

    return {
      ok: true,
      slotId: json.slotId,
      queuedAt: json.queuedAt,
      actionCount: buffered,
    }
  }

  /**
   * Discard the buffer without pushing. Useful for "cancel intent" UX.
   */
  discardPending(): void {
    this.pendingActions = []
    this.pendingReceipts = []
  }

  /**
   * Replace local state from a fresh server snapshot. Called after a push
   * or after a reconcile if divergence is suspected.
   */
  hydrate(state: { worldDay: number; partyNodeId: string }): void {
    this.worldDay = state.worldDay
    this.partyNodeId = state.partyNodeId
  }
}
