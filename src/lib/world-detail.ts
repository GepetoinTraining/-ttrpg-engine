/**
 * Browser-side helpers for settlement / npc / market / spells data.
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

// ── Settlements ────────────────────────────────────────────────────────────

export interface SettlementSummary {
  id: string
  name: string
  regionId: string
  population: number
  stability: number
  hubSize: string | null
  era: string
  regionName: string | null
  terrain: string | null
}

export async function listSettlements(opts: { search?: string; limit?: number } = {}): Promise<{ settlements: SettlementSummary[]; total: number }> {
  const params = new URLSearchParams()
  if (opts.search) params.set('search', opts.search)
  if (opts.limit) params.set('limit', String(opts.limit))
  return getJson(`/api/settlement/list?${params}`)
}

export async function loadSettlement(id: string): Promise<any> {
  return getJson(`/api/settlement/${id}`)
}

// ── NPCs ───────────────────────────────────────────────────────────────────

export interface NPCSummary {
  id: string
  name: string
  settlementId: string | null
  role: string | null
  disposition: string
  craft: string | null
  agenda: any
  personality: any
}

export async function listNPCs(opts: { settlementId?: string; search?: string; limit?: number } = {}): Promise<{ npcs: NPCSummary[]; total: number }> {
  const params = new URLSearchParams()
  if (opts.settlementId) params.set('settlementId', opts.settlementId)
  if (opts.search) params.set('search', opts.search)
  if (opts.limit) params.set('limit', String(opts.limit))
  return getJson(`/api/npc/list?${params}`)
}

export async function loadNPC(id: string): Promise<any> {
  return getJson(`/api/npc/${id}`)
}

// ── Markets ────────────────────────────────────────────────────────────────

export interface PriceRow {
  id: string
  commodity: string
  category: string | null
  unit: string | null
  basePrice: number | null
  currentPrice: number
  priceDeltaPct: number
  supply: number
  demand: number
}

export async function loadMarket(settlementId: string): Promise<{
  prices: PriceRow[]
  merchants: any[]
  caravansInFlight: number
}> {
  return getJson(`/api/market/${settlementId}`)
}

// ── Spells ─────────────────────────────────────────────────────────────────

export async function loadSpells(characterId: string): Promise<any> {
  return getJson(`/api/character/${characterId}/spells`)
}
