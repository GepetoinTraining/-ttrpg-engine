/**
 * useHub — React hook for hub runtime presence (Phase Δ.7).
 *
 * Per docs/to-be implemented/hub-runtime-proposal.md. Wraps the four routes
 * under /api/hub/[settlementId]/{runtime, join, receipt, leave}.
 *
 * Lifecycle the surface drives:
 *   1. Mount with a settlementId → `enter()` — GET runtime, POST join
 *   2. While present → `receipt(input)` — append observed/acted receipts
 *   3. Leave → `leave()` — decrement activeN; if last out, runtime closes
 *      and the leave route inline-drains receipts to canonical tpb_entries.
 *
 * The sessionId is generated per-tab (sessionStorage) so reload = new session.
 * The certId is read from the active character cert (useWorld surface).
 */

'use client'

import * as React from 'react'

export interface HubRuntimeState {
  id: string
  settlementId: string
  hubId: string
  aperture: string
  canonicalHeadId: string
  activeN: number
  joinedSessionIds: string[]
  status: 'open' | 'closing' | 'committed' | 'failed' | 'abandoned'
  openedAt: string
  lastSeenAt: string
  leaseExpiresAt: string
  districtIds: string[] | null
}

export interface ReceiptInput {
  /** Serialized WorldTPBAction the client computed locally. */
  action: unknown
  /** MF receipt produced by the forward pass (audit trail). */
  receipt: unknown
}

export interface UseHubState {
  loading: boolean
  error: string | null
  runtime: HubRuntimeState | null
  isJoined: boolean
  /** Receipts pushed during this session (sequence numbers). */
  receipts: number[]
  /** Set when the runtime has closed via this client's `leave()` call. */
  closed: boolean
}

export interface UseHubApi extends UseHubState {
  enter: () => Promise<void>
  receipt: (input: ReceiptInput, actorCertId: string) => Promise<number | null>
  leave: () => Promise<{ closing: boolean; receiptCount?: number } | null>
  refresh: () => Promise<void>
}

/** Per-tab session id, stable across re-renders within the same tab. */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  const KEY = 'claudedm:hub-session-id'
  try {
    let id = window.sessionStorage.getItem(KEY)
    if (!id) {
      id = `s-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
      window.sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return `s-${Math.random().toString(36).slice(2, 10)}`
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}

/**
 * Hook a settlement's hub runtime. Pass `null` for `settlementId` when the
 * caller doesn't want any runtime activity (e.g. Settlement surface with
 * nothing selected).
 *
 * `certId` is required for join + receipt — typically the active character
 * cert id from useWorld.
 */
export function useHub(settlementId: string | null, certId: string | null): UseHubApi {
  const [state, setState] = React.useState<UseHubState>({
    loading: false,
    error: null,
    runtime: null,
    isJoined: false,
    receipts: [],
    closed: false,
  })

  const sessionId = React.useMemo(() => getOrCreateSessionId(), [])

  const enter = React.useCallback(async () => {
    if (!settlementId || !certId) {
      setState((s) => ({ ...s, error: 'settlementId_and_certId_required' }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null, closed: false }))
    try {
      const r = await getJson<{ runtime: HubRuntimeState }>(
        `/api/hub/${encodeURIComponent(settlementId)}/runtime`,
      )
      // Now POST join.
      const joined = await postJson<{
        hubRuntimeId: string
        activeN: number
        joinedSessionIds: string[]
        lastSeenAt: string
      }>(`/api/hub/${encodeURIComponent(settlementId)}/join`, { sessionId, certId })

      setState({
        loading: false,
        error: null,
        runtime: {
          ...r.runtime,
          activeN: joined.activeN,
          joinedSessionIds: joined.joinedSessionIds,
          lastSeenAt: joined.lastSeenAt,
        },
        isJoined: true,
        receipts: [],
        closed: false,
      })
    } catch (e: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.message ?? 'enter_failed',
      }))
    }
  }, [settlementId, certId, sessionId])

  const receipt = React.useCallback(
    async (input: ReceiptInput, actorCertId: string): Promise<number | null> => {
      if (!settlementId) return null
      try {
        const r = await postJson<{ sequence: number; lastSeenAt: string }>(
          `/api/hub/${encodeURIComponent(settlementId)}/receipt`,
          { ...input, actorCertId },
        )
        setState((s) => ({
          ...s,
          receipts: [...s.receipts, r.sequence],
          runtime: s.runtime ? { ...s.runtime, lastSeenAt: r.lastSeenAt } : s.runtime,
        }))
        return r.sequence
      } catch (e: any) {
        setState((s) => ({ ...s, error: e?.message ?? 'receipt_failed' }))
        return null
      }
    },
    [settlementId],
  )

  const leave = React.useCallback(async () => {
    if (!settlementId) return null
    try {
      const r = await postJson<{
        activeN: number
        joinedSessionIds: string[]
        closing: boolean
        receiptCount?: number
        closedAt?: string
      }>(`/api/hub/${encodeURIComponent(settlementId)}/leave`, { sessionId })
      setState((s) => ({
        ...s,
        isJoined: false,
        closed: r.closing,
        runtime: s.runtime
          ? {
              ...s.runtime,
              activeN: r.activeN,
              joinedSessionIds: r.joinedSessionIds,
              status: r.closing ? 'closing' : s.runtime.status,
            }
          : s.runtime,
      }))
      return { closing: r.closing, receiptCount: r.receiptCount }
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? 'leave_failed' }))
      return null
    }
  }, [settlementId, sessionId])

  const refresh = React.useCallback(async () => {
    if (!settlementId) return
    try {
      const r = await getJson<{ runtime: HubRuntimeState }>(
        `/api/hub/${encodeURIComponent(settlementId)}/runtime`,
      )
      setState((s) => ({ ...s, runtime: r.runtime, error: null }))
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? 'refresh_failed' }))
    }
  }, [settlementId])

  // Auto-leave on unmount (best-effort).
  React.useEffect(() => {
    return () => {
      // Fire-and-forget — the user may have closed the tab, so we use
      // sendBeacon when available for delivery without awaiting.
      if (!settlementId || !state.isJoined) return
      const url = `/api/hub/${encodeURIComponent(settlementId)}/leave`
      const body = JSON.stringify({ sessionId })
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
        } else {
          // Fallback: no-await fetch
          fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        // best effort
      }
    }
    // We intentionally only depend on settlementId — re-running this cleanup
    // on every isJoined change would cause spurious leaves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId, sessionId])

  return {
    ...state,
    enter,
    receipt,
    leave,
    refresh,
  }
}
