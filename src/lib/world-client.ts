/**
 * WORLD CLIENT — browser-side helpers for /api/world/*
 * ========================================================
 *
 * Thin fetch wrappers. Server returns the new state in TransportResult so
 * callers can avoid a follow-up GET.
 */

// Note: redeclared here so client bundle doesn't pull world-state.ts (which
// imports the engine and is server-only).
import { authFetch } from './auth-fetch'

export type TimeMode = 'instant' | 'travel' | 'days'

export interface TransportResultClient {
  fromNodeId: string
  toNodeId: string
  destLabel: string
  daysAdvanced: number
  worldDay: number
  observed: { mmId: string; narrative: string }[]
}

export interface WorldStatusClient {
  worldDay: number
  partyNodeId: string
  partyNodeLabel: string
  partyNodeType: string
  partyComposition: string[]
  lastCronAt: string | null
  destinations: { id: string; label: string; type: string }[]
  /** Numeric world seed — for client-side biome computation. */
  seed: number
}

export interface CronTickResultClient {
  worldDay: number
  daysAdvanced: number
  lastCronAt: string
}

export interface TpbLogEntryClient {
  id: number
  worldDay: number
  realTs: string | null
  action: {
    type: string
    [k: string]: unknown
  }
}

export async function fetchWorldState(): Promise<WorldStatusClient> {
  const res = await authFetch('/api/world/state', { cache: 'no-store' })
  if (!res.ok) throw new Error(`state ${res.status}`)
  return res.json() as Promise<WorldStatusClient>
}

export async function transportParty(
  destNodeId: string,
  timeMode: TimeMode,
  days?: number,
): Promise<TransportResultClient> {
  const res = await authFetch('/api/world/transport', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ destNodeId, timeMode, days }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`transport ${res.status} ${txt}`)
  }
  return res.json() as Promise<TransportResultClient>
}

/**
 * Manually advance the world by N days (DM-only superpower; in prod the
 * cron schedule does this autonomously via vercel.json).
 */
export async function cronTick(days: number = 1): Promise<CronTickResultClient> {
  const res = await authFetch(`/api/cron/tick?days=${encodeURIComponent(String(days))}`, {
    method: 'POST',
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`cron ${res.status} ${txt}`)
  }
  return res.json() as Promise<CronTickResultClient>
}

/**
 * Read the most recent N TPB log entries — for live event feeds.
 */
export async function fetchWorldLog(limit: number = 50): Promise<TpbLogEntryClient[]> {
  const res = await authFetch(`/api/world/log?limit=${encodeURIComponent(String(limit))}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`log ${res.status}`)
  const j = (await res.json()) as { entries: TpbLogEntryClient[] }
  return j.entries
}

/**
 * Read a slice of TPB entries for client-side replay / hydration. Used by
 * `EngineClient.hydrate()` to rebuild the local TP from the canonical log.
 */
export interface TpbReplayEntryClient {
  id: number
  worldDay: number
  realTs: string | null
  action: { type: string; [k: string]: unknown }
}

export async function fetchWorldReplay(opts: {
  fromDay?: number
  toDay?: number
  limit?: number
} = {}): Promise<TpbReplayEntryClient[]> {
  const params = new URLSearchParams()
  if (opts.fromDay !== undefined) params.set('fromDay', String(opts.fromDay))
  if (opts.toDay !== undefined) params.set('toDay', String(opts.toDay))
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  const qs = params.toString()
  const res = await authFetch(`/api/world/replay${qs ? '?' + qs : ''}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`replay ${res.status}`)
  const j = (await res.json()) as { entries: TpbReplayEntryClient[] }
  return j.entries
}
