/**
 * Engine client — browser-side world action producer.
 *
 * Per `project_next_routing_pass.md` + `project_cert_hierarchy.md`:
 *   - Client produces `WorldTPBAction[]` locally + buffers them
 *   - Pushes to `/api/world/slot/push` when ready (manual or auto)
 *   - Server appends without re-running the math (forensic-only sigs)
 *   - Cron drains slots into the canonical `tpb_entries` ledger
 *
 * Math symmetry (Pedro's correction): the SAME engine math runs on both
 * client and server. Server doesn't recompute anything — it just appends
 * what the client already computed. Receipts are produced as side-effects
 * of the .mf forward pass (Theorem 1, MM-MF-TP-TPB.md).
 *
 * The client carries a local `TP` + `Clockwork` after `hydrate()`. From
 * that point:
 *   - `engineClient.tp.resolve(nodeId)` returns the same κ the server would
 *   - `engineClient.observeNode(nodeId)` runs the local Clockwork's MM
 *     resolution and produces the resulting `writeKappa[]` actions
 *   - MF wrappers (`mfDice`, `mfCheck`, `mfDamage`) produce receipts
 *
 * V2 (DM-as-shard-host): when persona === 'dm' and a session is active,
 * the engine-client upgrades to "shard mode" — bundles signed at session
 * end. See `src/lib/dm-shard.ts` (W3.3).
 */

import { mfDice, type DiceFormula, type DiceResult, diceToReceipt } from '../../engine/mf-dice'
import { mfCheck, checkToReceipt, type CheckParams, type CheckResult } from '../../engine/mf-check'
import { mfDamage, damageToReceipt, type DamageInput, type TargetState, type DamageResult } from '../../engine/mf-damage'
import { mfSmelt, smeltToReceipt, type SmeltContext, type SmeltInput, type SmeltOutput } from '../../engine/mf-smelt'
import { mfForge, forgeToReceipt, type ForgeContext, type ForgeInput, type ForgeOutput } from '../../engine/mf-forge'
import { mfIdentify, identifyToReceipt, type IdentifyContext, type IdentifyInput, type IdentifyOutput } from '../../engine/mf-identify'
import {
  resolveChopTree,
  chopTreeToReceipt,
  STUDY_INTENT_SYSTEMS,
  type StartStudyValue,
  type CompleteStudyValue,
  type ChopTreeArgs,
  type ChopTreeOutcome,
} from '../../engine/study'
import type { WorldTPBAction, EntityPosition } from '../../engine/tpb-world'
import type { Receipt } from '../../engine/types'
import type { LocalContext, WorldNode, Entity } from '../../engine/tp'
import { TP } from '../../engine/tp'
import { Clockwork } from '../../engine/clockwork'
import { buildBaseTp, registerCanonicalMMs } from '../../engine/world-bootstrap'
import { applyTpbActions } from '../../engine/tpb-replay'
import { attachWriteLog } from '../../engine/tp-write-capture'
import type { AccountCert } from './account-cert'
import type { CharacterCert } from './character-cert'
import { authFetch } from './auth-fetch'
import { fetchWorldReplay } from './world-client'

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
 * Read-only view onto the local TP. Surfaces should treat this as immutable
 * — mutation goes through producers (transport / observeNode / applyIntent)
 * which buffer actions for the next push.
 */
export interface TpReadView {
  getNode: (nodeId: string) => WorldNode | undefined
  getAllNodes: () => WorldNode[]
  resolve: (nodeId: string) => LocalContext | null
  getEntitiesAt: (nodeId: string) => Entity[]
}

/**
 * The engine client. One instance per active character session.
 *
 * Lifecycle:
 *   1. Construct with init data (worldDay, partyNodeId from /api/world/state).
 *   2. Optionally `await client.hydrate()` to build local TP + Clockwork from
 *      the canonical log. After hydrate, tp/observeNode are usable.
 *   3. Surfaces invoke math (transport / observeNode / mfDice / applyIntent).
 *   4. Periodic `client.push()` drains pending actions to the server slot.
 *
 * Action producers are SYNCHRONOUS (pure compute). `push()` and `hydrate()`
 * are the only async I/O.
 */
export class EngineClient {
  private account: AccountCert
  private character: CharacterCert
  private worldDay: number
  private partyNodeId: string

  /** Local TP — populated after hydrate(). */
  private localTp: TP | null = null
  /** Local Clockwork — populated after hydrate(). */
  private localClockwork: Clockwork | null = null
  /** True once hydrate() has completed at least once. */
  private hydrated = false

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
  isHydrated(): boolean {
    return this.hydrated
  }

  /**
   * Read-only view onto the local TP. Throws if hydrate() hasn't run yet —
   * surfaces that need TP reads should await client.hydrate() first.
   */
  get tp(): TpReadView {
    if (!this.localTp) {
      throw new Error('EngineClient.tp accessed before hydrate()')
    }
    const t = this.localTp
    return {
      getNode: (nodeId) => t.getNode(nodeId),
      getAllNodes: () => t.getAllNodes(),
      resolve: (nodeId) => t.resolve(nodeId),
      getEntitiesAt: (nodeId) => t.getEntitiesAt(nodeId),
    }
  }

  // ── Hydration ──

  /**
   * Build the local TP from the canonical log. Pulls the entire `/api/world/replay`
   * stream and applies every entry to a fresh TP via `applyTpbActions`. After
   * this, the local TP matches the server's bit-for-bit at the snapshot day.
   *
   * Idempotent — calling twice rebuilds from scratch (use after a long pause
   * to recover from drift). Cheap-ish: replay is bounded by audit-log size,
   * which is small for v1.
   */
  async hydrate(): Promise<void> {
    const entries = await fetchWorldReplay()
    const tp = buildBaseTp()
    applyTpbActions(
      tp,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entries.map((e) => e.action as any),
    )
    const cw = new Clockwork(tp, this.worldDay)
    registerCanonicalMMs(cw, this.worldDay)
    this.localTp = tp
    this.localClockwork = cw
    this.hydrated = true
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
    ]

    // If hydrated, run the local Clockwork's observation at the destination —
    // this fires MMs and captures κ writes as additional writeKappa actions.
    // If not hydrated, just record the bare `observe` action.
    if (this.localTp && this.localClockwork) {
      this.localTp.moveEntity('party', to)
      const capture = attachWriteLog(this.localTp, `client-transport:${destNodeId}`)
      this.localClockwork.observeNode(destNodeId)
      capture.detach()
      actions.push({ type: 'observe', nodeId: destNodeId, partyId: 'party' })
      actions.push(...capture.entries)
    } else {
      actions.push({ type: 'observe', nodeId: destNodeId, partyId: 'party' })
    }

    this.partyNodeId = destNodeId
    this.pendingActions.push(...actions)

    return { actions, receipts: [] }
  }

  /**
   * Observe the current node (no movement). When hydrated, runs the local
   * Clockwork's `observeNode` and captures κ writes. When not hydrated,
   * just emits a placeholder `observe` action.
   */
  observeNode(nodeId?: string): ProducedActions {
    const target = nodeId ?? this.partyNodeId
    const actions: WorldTPBAction[] = [
      { type: 'observe', nodeId: target, partyId: 'party' },
    ]

    if (this.localTp && this.localClockwork) {
      const capture = attachWriteLog(this.localTp, `client-observe:${target}`)
      this.localClockwork.observeNode(target)
      capture.detach()
      actions.push(...capture.entries)
    }

    this.pendingActions.push(...actions)
    return { actions, receipts: [] }
  }

  /** Alias for observeNode for backward-compat with V1 callers. */
  observe(nodeId?: string): ProducedActions {
    return this.observeNode(nodeId)
  }

  /**
   * Roll dice locally. Produces a receipt that proves the math (per
   * Theorem 1 in MM-MF-TP-TPB.md: receipt R falls out of forward pass).
   */
  roll(formula: DiceFormula, seed?: number): { result: DiceResult; receipt: Receipt } {
    const { output, receipt } = mfDice(formula, seed)
    const fullReceipt = diceToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  /**
   * Resolve a check (skill / attack / save). Chains from one or two
   * DiceResults; the caller produces dice via `roll()` first, then passes
   * the result(s) to `check()`. For advantage/disadvantage, pass two
   * dice results.
   */
  check(diceResults: DiceResult[], params: CheckParams): { result: CheckResult; receipt: Receipt } {
    const { output, receipt } = mfCheck(diceResults, params)
    const fullReceipt = checkToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  /**
   * Resolve damage application against a target. Pure compute — caller
   * passes target's current TargetState, gets back the post-state and a
   * receipt; the caller is responsible for persisting the new HP via a
   * `writeKappa` if appropriate.
   */
  damage(input: DamageInput, target: TargetState): { result: DamageResult; receipt: Receipt } {
    const { output, receipt } = mfDamage(input, target)
    const fullReceipt = damageToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  // ── Slow-life v2 (W3.2): smelt / forge / identify ──

  /**
   * Smelt ore into an ingot. Returns the resulting ItemV2 (with affixes)
   * and a receipt. Pure compute — caller pushes the receipt + any state-
   * change actions via the action buffer.
   */
  smelt(ctx: SmeltContext, input: SmeltInput): { result: SmeltOutput; receipt: Receipt } {
    const { output, receipt } = mfSmelt(ctx, input)
    const fullReceipt = smeltToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  /** Forge an ingot into a finished item. */
  forge(ctx: ForgeContext, input: ForgeInput): { result: ForgeOutput; receipt: Receipt } {
    const { output, receipt } = mfForge(ctx, input)
    const fullReceipt = forgeToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  /** Inspect an item to reveal affixes (mastery + skill gated). */
  identify(ctx: IdentifyContext, input: IdentifyInput): { result: IdentifyOutput; receipt: Receipt } {
    const { output, receipt } = mfIdentify(ctx, input)
    const fullReceipt = identifyToReceipt(output, receipt, this.localTick++)
    this.pendingReceipts.push(fullReceipt)
    return { result: output, receipt: fullReceipt }
  }

  /**
   * Apply a slow-life intent (study, sell, plant, tend, etc.). Records the
   * intent as a `writeKappa` carrying the player's intent at their current
   * node. Server-side drain (or a future client-side resolver) computes the
   * actual κ change.
   *
   * V2 (per W3.2): client computes the intent locally via the resolvers in
   * `engine/interactions.ts` and produces the full action set + receipt.
   * For v1, this is an intent record that the drain interprets.
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

  // ── Studies / harvest (W3.4) ──

  /**
   * Start a study. Emits a `writeKappa` with `system='client-intent:start-study'`
   * and the typed `StartStudyValue` in `.value` so `extractStudyValuesFromActions`
   * (engine/study.ts) can rebuild the queue from the TPB log on either side.
   */
  startStudy(value: StartStudyValue): ProducedActions {
    const action: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: value.hubId,
      domain: 'intent',
      paths: ['intent.start-study', `intent.start-study.${value.studyId}`],
      system: STUDY_INTENT_SYSTEMS.start,
      value,
    }
    this.pendingActions.push(action)
    return { actions: [action], receipts: [] }
  }

  /**
   * Complete a study. The discovery payload (what knowledge gets unlocked) is
   * produced by `/api/study/complete` — an LLM-supervised endpoint per
   * `engine/study.ts:18`. This method just records the player's intent to
   * claim; the surface is responsible for POSTing to `/api/study/complete`
   * after `push()`.
   */
  completeStudy(value: CompleteStudyValue): ProducedActions {
    const action: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: this.partyNodeId,
      domain: 'intent',
      paths: ['intent.complete-study', `intent.complete-study.${value.studyId}`],
      system: STUDY_INTENT_SYSTEMS.complete,
      value,
    }
    this.pendingActions.push(action)
    return { actions: [action], receipts: [] }
  }

  /**
   * Resolve a chop-tree action — tool-gated harvest, d20 quality roll. Pushes
   * a forensic receipt and a `writeKappa` carrying both args and outcome so
   * the entry is self-describing for replay. The outcome is returned
   * synchronously so the caller can render "you chopped 6 fair logs."
   */
  chopTree(args: ChopTreeArgs): { result: ChopTreeOutcome; receipt: Receipt } {
    const outcome = resolveChopTree(args)
    const fullReceipt = chopTreeToReceipt(args, outcome, this.localTick++)
    const action: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: args.hubId,
      domain: 'intent',
      paths: ['intent.chop-tree', `intent.chop-tree.tree:${args.treeId}`],
      system: STUDY_INTENT_SYSTEMS.chop,
      value: { args, outcome },
    }
    this.pendingActions.push(action)
    this.pendingReceipts.push(fullReceipt)
    return { result: outcome, receipt: fullReceipt }
  }

  // ── I/O — push the buffered actions to the server ──

  /**
   * Push all pending actions + receipts to `/api/world/slot/push` as a
   * solo bundle. On success, clears the local buffer. On failure, leaves
   * the buffer intact so callers can retry.
   *
   * DM-hosted session bundles (kind: 'dm-session') are produced by a
   * different code path — see `src/lib/dm-shard.ts` (W3.3).
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

    const res = await authFetch('/api/world/slot/push', {
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
   * Get a copy of the recent receipts buffered locally — surfaces use
   * this to display "receipt strips" (per W5.3).
   */
  getRecentReceipts(limit: number = 10): Receipt[] {
    return this.pendingReceipts.slice(-limit)
  }

  /**
   * Replace local state from a fresh server snapshot. Called after a push
   * or after a reconcile if divergence is suspected.
   */
  hydrateState(state: { worldDay: number; partyNodeId: string }): void {
    this.worldDay = state.worldDay
    this.partyNodeId = state.partyNodeId
  }

  /** @deprecated use `hydrateState` for state-only updates or `hydrate()` for full TP rebuild. */
  hydrateLegacy(state: { worldDay: number; partyNodeId: string }): void {
    this.hydrateState(state)
  }
}
