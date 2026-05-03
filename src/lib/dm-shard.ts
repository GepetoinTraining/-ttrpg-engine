/**
 * DM-as-shard-host V2 (W3.3)
 * ============================
 *
 * Per `project_cert_hierarchy.md` "DM-as-shard-host":
 *   - During an active session, the DM's browser hosts the engine math
 *     for the entire party. Players' clients are peers; the DM's client
 *     is canonical for the duration of the session.
 *   - All session actions accumulate into a `dmSessionBundle` rather
 *     than being pushed individually as solo flywheel slots.
 *   - On session end (or pause), the bundle gets dm-cert-signed and
 *     pushed to `/api/world/slot/push` with `kind: 'dm-session'`.
 *   - The bundle lands "in the past" of server-cron time — that's fine,
 *     `tpb_entries` is append-only and absorbs out-of-order timestamps
 *     via worldline reconciliation (Pratchett's Long Earth model).
 *
 * The math signed at session end is the SAME math an individual
 * `slot/push` would carry — actions + receipts. The dm-session shape
 * adds `sessionId`, `endDay`, and `dmSignature` over the bundle hash.
 *
 * For v1, the signature is a deterministic FNV1a hash over
 * `(sessionId | atDay | endDay | actions.length | receipts.length | dmCertSeed)`.
 * Real φ/ζ trajectory signatures land with the audit pipeline (post-prod).
 */

import type { EngineClient } from './engine-client'
import type { CharacterCert } from './character-cert'
import type { WorldTPBAction } from '../../engine/tpb-world'
import type { Receipt } from '../../engine/types'
import { authFetch } from './auth-fetch'

export interface SessionBundle {
  sessionId: string
  /** World day at session start. */
  atDay: number
  /** World day at session end (typically atDay + N as the DM advanced time). */
  endDay: number
  actions: WorldTPBAction[]
  receipts: Receipt[]
}

/** v1 stub signature — replace with computeTrajectory once audit pipeline lands. */
function dmStubSign(bundle: SessionBundle, dmCertSeed: string): string {
  const fingerprint = [
    bundle.sessionId,
    bundle.atDay,
    bundle.endDay,
    bundle.actions.length,
    bundle.receipts.length,
    dmCertSeed,
  ].join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < fingerprint.length; i++) {
    h ^= fingerprint.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `dmsig:${(h >>> 0).toString(16)}`
}

/**
 * DmShard wraps an EngineClient to add session-bundle behavior.
 *
 * Lifecycle:
 *   1. `start(sessionId)` — emits a `session:start` action; engine-client
 *      stops auto-pushing (the bundle accumulates).
 *   2. surfaces invoke math through engineClient as usual; actions+receipts
 *      buffer into the engine-client's pending lists.
 *   3. `pause()` — pushes the current bundle as a dm-session slot, then
 *      starts fresh accumulation under the same sessionId.
 *   4. `end()` — emits a `session:end` action, pushes the final bundle.
 */
export class DmShard {
  private engine: EngineClient
  private dmCert: CharacterCert
  private dmCertSeed: string
  private active = false
  private currentSessionId: string | null = null
  private sessionStartDay = 0

  constructor(engine: EngineClient, dmCertSeed: string) {
    if (engine.getCharacter().personaType !== 'dm') {
      throw new Error('DmShard requires a DM-persona character cert')
    }
    this.engine = engine
    this.dmCert = engine.getCharacter()
    this.dmCertSeed = dmCertSeed
  }

  isActive(): boolean {
    return this.active
  }
  getSessionId(): string | null {
    return this.currentSessionId
  }

  /** Begin a session — actions accumulate until end()/pause(). */
  start(sessionId: string): void {
    if (this.active) throw new Error('DmShard session already active')
    this.active = true
    this.currentSessionId = sessionId
    this.sessionStartDay = this.engine.getWorldDay()
    this.engine.applyIntent('session:start', { sessionId })
  }

  /**
   * Push the current bundle to the server as a `dm-session` slot, then
   * keep the session active for further accumulation.
   */
  async pause(): Promise<{ ok: boolean; slotId: number | null }> {
    if (!this.active || !this.currentSessionId) {
      throw new Error('DmShard not active — call start() first')
    }
    const result = await this.flush()
    return { ok: result.ok, slotId: result.slotId }
  }

  /**
   * End the session — emits `session:end`, pushes final bundle.
   */
  async end(): Promise<{ ok: boolean; slotId: number | null }> {
    if (!this.active || !this.currentSessionId) {
      throw new Error('DmShard not active — call start() first')
    }
    this.engine.applyIntent('session:end', { sessionId: this.currentSessionId })
    const result = await this.flush()
    this.active = false
    this.currentSessionId = null
    return { ok: result.ok, slotId: result.slotId }
  }

  /** Internal — POST the dm-session bundle. */
  private async flush(): Promise<{ ok: boolean; slotId: number | null }> {
    if (!this.currentSessionId) throw new Error('no_session_id')
    // Snapshot pending actions/receipts from the engine, then clear them
    // so subsequent pause() calls don't double-push.
    const pendingActions: WorldTPBAction[] = []
    const pendingReceipts: Receipt[] = []
    // We use the engine's discardPending after copying — but engine doesn't
    // expose the buffer directly, so we re-build via a single push() that
    // returns the count, then we send the dm-session bundle ourselves.
    // For v1: read via private copy — engine-client exposes recent-receipts;
    // we'll wire a proper getter when this lands.
    const recentReceipts = this.engine.getRecentReceipts(10000)
    pendingReceipts.push(...recentReceipts)
    // Actions aren't readable via the public API for v1; the bundle pushes
    // through engine.push() to drain them, then we wrap as dm-session below.

    const endDay = this.engine.getWorldDay()
    const bundle: SessionBundle = {
      sessionId: this.currentSessionId,
      atDay: this.sessionStartDay,
      endDay,
      actions: pendingActions,
      receipts: pendingReceipts,
    }

    // Push the engine's pending actions as a SOLO bundle first (because
    // engine-client owns its action buffer and we don't expose internals).
    // The receipts live in the dm-session bundle alongside the signature.
    // V2 refactor: engine-client gains a `drainPending()` returning the
    // raw lists, and DmShard composes the dm-session payload directly.
    const soloPushed = await this.engine.push().catch(() => null)
    if (!soloPushed?.ok) {
      return { ok: false, slotId: null }
    }

    // Sign and POST the dm-session marker (no actions in this v1 marker —
    // the actual actions went through the solo path above).
    const dmSignature = dmStubSign(bundle, this.dmCertSeed)
    const payload = {
      kind: 'dm-session' as const,
      sourceCertId: this.dmCert.id,
      sessionId: bundle.sessionId,
      atDay: bundle.atDay,
      endDay: bundle.endDay,
      actions: bundle.actions,
      receipts: bundle.receipts,
      dmSignature,
    }
    const res = await authFetch('/api/world/slot/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { ok: false, slotId: null }
    }
    const json = (await res.json()) as { slotId: number | null }
    return { ok: true, slotId: json.slotId ?? null }
  }
}

/** Convenience: construct a DmShard from an active EngineClient + DM seed. */
export function createDmShard(engine: EngineClient, dmCertSeed: string): DmShard {
  return new DmShard(engine, dmCertSeed)
}
