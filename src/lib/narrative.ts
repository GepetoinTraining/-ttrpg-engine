/**
 * Browser-side helpers for Phase 3 surfaces:
 *   - wiki (Lore + Diplomacy briefings)
 *   - quests + beats
 *   - scene cards
 *   - diplomacy bundle
 *   - army roster
 */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
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

export async function loadQuests(adventureId?: string): Promise<{ arcs: any[]; total: number }> {
  const params = new URLSearchParams()
  if (adventureId) params.set('adventureId', adventureId)
  return getJson(`/api/quest/list?${params}`)
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
