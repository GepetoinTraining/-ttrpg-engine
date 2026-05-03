/**
 * useWorld — React hook glueing the engine-client to surfaces.
 *
 * Per `project_next_routing_pass.md`:
 *   - Holds the EngineClient instance for the active character cert
 *   - Subscribes to log changes (polling for v1; railgun spectrum in Slice 6+)
 *   - Surfaces re-render on engine state changes via useState/useEffect
 *
 * Lifecycle:
 *   1. Hydrate active account + character from IDB (via account-cert / character-cert helpers)
 *   2. Fetch current world state from /api/world/state
 *   3. Construct EngineClient
 *   4. Poll /api/world/log every 5s for live event feed
 *   5. Bridge surface data: party members, nearby NPCs (scoped to partyNodeId), quest arcs
 *   6. Expose imperative methods (transport, observe, roll, applyIntent, push)
 */

'use client'

import * as React from 'react'
import { loadAccount, type AccountCert } from './account-cert'
import { getActiveCharacterCert, type CharacterCert } from './character-cert'
import {
  fetchWorldState,
  fetchWorldLog,
  type WorldStatusClient,
  type TpbLogEntryClient,
} from './world-client'
import { EngineClient } from './engine-client'
import { subscribeSpectrum } from './spectrum-client'
import { listCharacters, type CharacterListItem } from './character'
import { listNPCs, type NPCSummary } from './world-detail'
import { loadQuests } from './narrative'
import type { DiceFormula } from '../../engine/mf-dice'
import type {
  StartStudyValue,
  CompleteStudyValue,
  ChopTreeArgs,
  ChopTreeOutcome,
} from '../../engine/study'

const LOG_POLL_MS = 5000
const LOG_LIMIT = 50

export interface UseWorldState {
  /** True until hydration completes */
  loading: boolean
  /** Last error, if any */
  error: string | null
  /** Active session cert chain — null if no active character */
  account: AccountCert | null
  character: CharacterCert | null
  /** Server snapshot — updated after each refresh */
  worldStatus: WorldStatusClient | null
  /** Recent TPB log — updated by the poll */
  log: TpbLogEntryClient[]
  /** Pending action count — surfaces can show "N pending" */
  pendingCount: number
  /** All known characters — used as party roster surrogate until cert-hash party formation lands. */
  partyMembers: CharacterListItem[]
  /** NPCs at the current partyNodeId (settlement-scoped). Refetches when partyNodeId changes. */
  nearbyNpcs: NPCSummary[]
  /** Quest arcs (each with quests + beats). Currently global; scoped to adventureId once campaign linkage lands. */
  arcs: any[]
}

export interface UseWorldApi extends UseWorldState {
  /**
   * Direct access to the EngineClient instance. Surfaces that want full
   * math reach (mfDice / mfCheck / mfDamage / tp.resolve / observeNode)
   * should use this rather than the convenience wrappers below.
   *
   * Null until hydration completes.
   */
  engine: EngineClient | null
  /** Imperative — produce a transport action set + buffer locally */
  transport: (destNodeId: string, daysAdvanced?: number) => void
  /** Imperative — observe current or specified node */
  observe: (nodeId?: string) => void
  /** Imperative — roll dice + receipt */
  roll: (formula: DiceFormula, seed?: number) => ReturnType<EngineClient['roll']> | null
  /** Imperative — apply slow-life intent */
  applyIntent: (intent: string, params?: Record<string, unknown>) => void
  /** Imperative — start a study (writeKappa with typed StartStudyValue) */
  startStudy: (value: StartStudyValue) => void
  /** Imperative — claim a completed study (writeKappa with typed CompleteStudyValue) */
  completeStudy: (value: CompleteStudyValue) => void
  /** Imperative — resolve a chop-tree action; returns the outcome synchronously */
  chopTree: (args: ChopTreeArgs) => ChopTreeOutcome | null
  /** Push buffered actions to the server's slot. Resolves with slotId. */
  push: () => Promise<void>
  /** Discard buffered actions without pushing */
  discardPending: () => void
  /** Manual refresh of world state + log + party + nearby + quests */
  refresh: () => Promise<void>
}

export function useWorld(): UseWorldApi {
  const [state, setState] = React.useState<UseWorldState>({
    loading: true,
    error: null,
    account: null,
    character: null,
    worldStatus: null,
    log: [],
    pendingCount: 0,
    partyMembers: [],
    nearbyNpcs: [],
    arcs: [],
  })

  const engineRef = React.useRef<EngineClient | null>(null)

  const tickPendingCount = React.useCallback(() => {
    const n = engineRef.current?.pendingCount() ?? 0
    setState((s) => (s.pendingCount === n ? s : { ...s, pendingCount: n }))
  }, [])

  // ── Hydrate on mount ──
  React.useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const [account, character, worldStatus, log, charList, quests] = await Promise.all([
          loadAccount(),
          getActiveCharacterCert(),
          fetchWorldState().catch(() => null),
          fetchWorldLog(LOG_LIMIT).catch(() => []),
          listCharacters().then(r => r.characters).catch(() => []),
          loadQuests().then(r => r.arcs).catch(() => []),
        ])

        if (cancelled) return

        if (!account || !character || !worldStatus) {
          setState({
            loading: false,
            error: !account
              ? 'no_account'
              : !character
                ? 'no_active_character'
                : 'world_state_unavailable',
            account,
            character,
            worldStatus,
            log,
            pendingCount: 0,
            partyMembers: charList,
            nearbyNpcs: [],
            arcs: quests,
          })
          return
        }

        const eng = new EngineClient({
          account,
          character,
          worldDay: worldStatus.worldDay,
          partyNodeId: worldStatus.partyNodeId,
        })
        engineRef.current = eng

        // Hydrate local TP from canonical log (best-effort — surfaces that
        // need TP reads gate on `engine.isHydrated()`).
        eng.hydrate().catch(() => {
          // Replay endpoint may be empty / unauthorized; surfaces fall back
          // to direct fetch helpers in that case.
        })

        // Fire nearbyNpcs separately — needs partyNodeId we just got
        const nearbyNpcs = await listNPCs({ settlementId: worldStatus.partyNodeId, limit: 100 })
          .then(r => r.npcs)
          .catch(() => [])

        if (cancelled) return

        setState({
          loading: false,
          error: null,
          account,
          character,
          worldStatus,
          log,
          pendingCount: 0,
          partyMembers: charList,
          nearbyNpcs,
          arcs: quests,
        })
      } catch (e: unknown) {
        if (cancelled) return
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'boot_failed',
        }))
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Spectrum subscription (W3.4) ──
  // Replaces the legacy 5s log poll. Subscribes to /api/world/spectrum via
  // SSE and prepends each new envelope to `state.log`. Falls back to
  // polling internally if SSE is unavailable.
  React.useEffect(() => {
    if (state.loading || state.error) return
    let cancelled = false
    let lastSeenId = 0
    if (state.log.length > 0) lastSeenId = state.log[0].id

    const sub = subscribeSpectrum({
      sinceId: lastSeenId,
      onEnvelope: (env) => {
        if (cancelled) return
        setState((s) => {
          const entry: TpbLogEntryClient = {
            id: env.id,
            worldDay: env.worldDay,
            realTs: env.realTs,
            action: env.action,
          }
          // Newest-first; cap at LOG_LIMIT.
          const next = [entry, ...s.log.filter((e) => e.id !== env.id)].slice(0, LOG_LIMIT)
          return { ...s, log: next }
        })
      },
      onError: () => {
        // best-effort — fallback path inside spectrum-client polls /api/world/log
      },
    })
    return () => {
      cancelled = true
      sub.close()
    }
  }, [state.loading, state.error])

  // ── Refetch nearby NPCs when partyNodeId changes ──
  const partyNodeId = state.worldStatus?.partyNodeId
  React.useEffect(() => {
    if (!partyNodeId) return
    let cancelled = false
    listNPCs({ settlementId: partyNodeId, limit: 100 })
      .then(r => {
        if (!cancelled) setState((s) => ({ ...s, nearbyNpcs: r.npcs }))
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, nearbyNpcs: [] }))
      })
    return () => {
      cancelled = true
    }
  }, [partyNodeId])

  // ── Imperative actions ──
  const transport = React.useCallback(
    (destNodeId: string, daysAdvanced?: number) => {
      engineRef.current?.transport(destNodeId, daysAdvanced ?? 0)
      tickPendingCount()
    },
    [tickPendingCount],
  )

  const observe = React.useCallback(
    (nodeId?: string) => {
      engineRef.current?.observe(nodeId)
      tickPendingCount()
    },
    [tickPendingCount],
  )

  const roll = React.useCallback(
    (formula: DiceFormula, seed?: number) => {
      const r = engineRef.current?.roll(formula, seed) ?? null
      tickPendingCount()
      return r
    },
    [tickPendingCount],
  )

  const applyIntent = React.useCallback(
    (intent: string, params?: Record<string, unknown>) => {
      engineRef.current?.applyIntent(intent, params)
      tickPendingCount()
    },
    [tickPendingCount],
  )

  const startStudy = React.useCallback(
    (value: StartStudyValue) => {
      engineRef.current?.startStudy(value)
      tickPendingCount()
    },
    [tickPendingCount],
  )

  const completeStudy = React.useCallback(
    (value: CompleteStudyValue) => {
      engineRef.current?.completeStudy(value)
      tickPendingCount()
    },
    [tickPendingCount],
  )

  const chopTree = React.useCallback(
    (args: ChopTreeArgs): ChopTreeOutcome | null => {
      const r = engineRef.current?.chopTree(args)
      tickPendingCount()
      return r?.result ?? null
    },
    [tickPendingCount],
  )

  const push = React.useCallback(async () => {
    const eng = engineRef.current
    if (!eng) return
    await eng.push()
    tickPendingCount()
    // Refresh server state after push so partyNodeId/worldDay sync.
    try {
      const ws = await fetchWorldState()
      eng.hydrateState({ worldDay: ws.worldDay, partyNodeId: ws.partyNodeId })
      setState((s) => ({ ...s, worldStatus: ws }))
    } catch {
      // ignore; next manual refresh will catch up
    }
  }, [tickPendingCount])

  const discardPending = React.useCallback(() => {
    engineRef.current?.discardPending()
    tickPendingCount()
  }, [tickPendingCount])

  const refresh = React.useCallback(async () => {
    try {
      const [worldStatus, log, charList, quests] = await Promise.all([
        fetchWorldState(),
        fetchWorldLog(LOG_LIMIT),
        listCharacters().then(r => r.characters).catch(() => []),
        loadQuests().then(r => r.arcs).catch(() => []),
      ])
      const eng = engineRef.current
      if (eng) {
        eng.hydrateState({ worldDay: worldStatus.worldDay, partyNodeId: worldStatus.partyNodeId })
      }
      // nearbyNpcs refetch happens via the partyNodeId effect when worldStatus updates
      setState((s) => ({ ...s, worldStatus, log, partyMembers: charList, arcs: quests, error: null }))
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'refresh_failed',
      }))
    }
  }, [])

  return {
    ...state,
    engine: engineRef.current,
    transport,
    observe,
    roll,
    applyIntent,
    startStudy,
    completeStudy,
    chopTree,
    push,
    discardPending,
    refresh,
  }
}
