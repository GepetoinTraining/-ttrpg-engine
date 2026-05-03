/**
 * Browser-side helpers for Phase 3 surfaces:
 *   - wiki (Lore + Diplomacy briefings)
 *   - quests + beats
 *   - scene cards
 *   - diplomacy bundle
 *   - army roster
 */

import { authFetch } from './auth-fetch'

async function getJson<T>(url: string): Promise<T> {
  const res = await authFetch(url)
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

// ── Wiki / Lore ────────────────────────────────────────────────────────────

export interface WikiArticle {
  id: string
  nodeId: string
  worldDay: number
  articleType: string
  title: string
  content: string
  depthOfKnowledge: string
  supersedesId: string | null
  observerId: string | null
}

export async function loadWiki(opts: { type?: string; nodeId?: string; limit?: number } = {}): Promise<{ articles: WikiArticle[]; total: number }> {
  const params = new URLSearchParams()
  if (opts.type) params.set('type', opts.type)
  if (opts.nodeId) params.set('nodeId', opts.nodeId)
  if (opts.limit) params.set('limit', String(opts.limit))
  return getJson(`/api/wiki/list?${params}`)
}

// ── Quests + beats ─────────────────────────────────────────────────────────

export interface LoadQuestsOptions {
  /** Filter by specific adventure id (direct) */
  adventureId?: string
  /** Filter by campaign id (server resolves campaign → adventure) */
  campaignId?: string
}

/**
 * Loads quest arcs (with quests + beats).
 *
 * Three forms:
 *   - `loadQuests()` — all arcs across the DB (cross-campaign view)
 *   - `loadQuests('adv-id')` — positional adventureId for back-compat
 *   - `loadQuests({ campaignId })` — campaign-scoped (server does lookup)
 */
export async function loadQuests(
  arg?: string | LoadQuestsOptions,
): Promise<{ arcs: any[]; total: number; resolved?: { adventureId: string | null; campaignId: string | null } }> {
  const params = new URLSearchParams()
  if (typeof arg === 'string') {
    params.set('adventureId', arg)
  } else if (arg && typeof arg === 'object') {
    if (arg.adventureId) params.set('adventureId', arg.adventureId)
    if (arg.campaignId) params.set('campaignId', arg.campaignId)
  }
  const qs = params.toString()
  return getJson(`/api/quest/list${qs ? `?${qs}` : ''}`)
}

// ── Scenes ─────────────────────────────────────────────────────────────────

export async function loadScenes(opts: { sessionId?: string; adventureId?: string } = {}): Promise<any> {
  const params = new URLSearchParams()
  if (opts.sessionId) params.set('sessionId', opts.sessionId)
  if (opts.adventureId) params.set('adventureId', opts.adventureId)
  return getJson(`/api/scene/list?${params}`)
}

// ── Diplomacy bundle ───────────────────────────────────────────────────────

export async function loadDiplomacy(): Promise<any> {
  return getJson('/api/diplomacy/list')
}

// ── Armies ─────────────────────────────────────────────────────────────────

export async function loadArmies(): Promise<any> {
  return getJson('/api/army/list')
}
