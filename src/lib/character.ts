/**
 * Browser-side character client.
 * Wraps /api/character/* endpoints.
 */

import type { Ability } from '@/game/chargen'

export interface ComposedSpellDraft {
  /** Player-typed name; ignored if compositionSeed already exists in ledger. */
  name?: string
  /** Prime-element composition (e.g. { Fire: 2, Projectile: 1 }). */
  elements: Record<string, number>
}

export interface CharacterDraft {
  userId?: string
  campaignId?: string
  name: string
  raceKey: string
  subrace?: string
  classKey: string
  abilityScores: Record<Ability, number>
  background?: string
  alignment?: string
  hook?: string
  /** Starter inventory (class kit + background kit item names). */
  kitItems?: string[]
  /** Composed cantrip + L1 spell at chargen. */
  startingSpells?: {
    cantrip?: ComposedSpellDraft
    spell1?: ComposedSpellDraft
  }
  /** Character cert id — used to credit first-creator on the spell ledger. */
  certId?: string
}

export interface SpellLedgerOutcome {
  spellId: string
  name: string
  level: number
  school: string
  /** True if this character cert was the first to compose this seed. */
  isFirstCreator: boolean
  creatorCertId: string | null
  compositionSeed: string
}

export interface CharacterCreateResult {
  characterId: string
  playerId: string | null
  summary: {
    name: string
    race: string
    class: string
    level: number
    hp: number
    finalScores: Record<Ability, number>
    modifiers: Record<Ability, number>
  }
  inventory: { inventoryId: string; containerId: string; itemCount: number } | null
  spells: SpellLedgerOutcome[]
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

export async function createCharacter(draft: CharacterDraft): Promise<CharacterCreateResult> {
  return postJson('/api/character/create', draft)
}

export interface SheetData {
  character: {
    id: string
    name: string
    race: string
    subrace: string | null
    background: string | null
    size: string
    speed: number
    hp: { current: number; max: number; temp: number }
    status: string
    deathSaves: { successes: number; failures: number }
    xp: number
  }
  classes: { name: string; level: number; subclass: string | null; hitDie: string }[]
  level: number
  proficiencyBonus: number
  abilityScores: Record<Ability, number>
  modifiers: Record<Ability, number>
  savingThrows: Record<Ability, { bonus: number; proficient: boolean }>
  skills: Record<string, { ability: Ability; bonus: number; proficiency: 'none' | 'half' | 'proficient' | 'expertise' }>
  ac: number
  initBonus: number
}

export async function loadCharacterSheet(id: string): Promise<SheetData> {
  const res = await fetch(`/api/character/${id}`)
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<SheetData>
}

export interface CharacterListItem {
  id: string
  name: string
  race: string
  subrace: string | null
  hpCurrent: number
  hpMax: number
  status: string
  playerId: string | null
  classes: { className: string; level: number }[]
}

export async function listCharacters(): Promise<{ characters: CharacterListItem[] }> {
  const res = await fetch('/api/character/list')
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── PDF Import ─────────────────────────────────────────────────────────────

export async function importPdf(file: File): Promise<{ imported: any }> {
  const fd = new FormData()
  fd.append('pdf', file)
  const res = await fetch('/api/character/import', { method: 'POST', body: fd })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// ── Inventory ──────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  category: string
  rarity: string
  weight: number
  volume: number
  valueGP: number
  stackable: boolean
  quantity: number
  magical: boolean
  requiresAttunement: boolean
  sourceType: string
  properties: Record<string, any> | null
}

export interface InventoryContainer {
  id: string
  name: string
  type: string
  weightCapacity: number
  volumeCapacity: number
  spatialMagic: string
  locked: boolean
  lockDC: number
  currency: Record<string, number> | null
  items: InventoryItem[]
}

export interface InventoryRoot {
  id: string
  locationNodeId: string
  containers: InventoryContainer[]
}

export interface InventoryTotals {
  containers: number
  items: number
  weight: number
  valueGP: number
}

export interface CharacterInventory {
  characterId: string
  inventories: InventoryRoot[]
  totals: InventoryTotals
}

export async function loadInventory(characterId: string): Promise<CharacterInventory> {
  const res = await fetch(`/api/character/${characterId}/inventory`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── Attunement ─────────────────────────────────────────────────────────────

export interface AttunementSlot {
  slotIndex: number
  itemId: string
  attunedDay: number
  item: any | null
}

export interface AttunementState {
  slots: (AttunementSlot | null)[]
  used: number
  max: number
}

export async function loadAttunement(characterId: string): Promise<AttunementState> {
  const res = await fetch(`/api/character/${characterId}/attunement`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function attune(
  characterId: string,
  itemId: string,
  slotIndex: number,
  attunedDay = 0
): Promise<{ id: string; slotIndex: number; itemId: string }> {
  const res = await fetch(`/api/character/${characterId}/attunement`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ itemId, slotIndex, attunedDay }),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export async function unattune(characterId: string, slotIndex: number): Promise<{ slotIndex: number; freed: boolean }> {
  const res = await fetch(`/api/character/${characterId}/attunement?slotIndex=${slotIndex}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// localStorage key for the "currently selected" character per campaign.
export function activeCharKey(campaignId: string | null): string {
  return `claudedm:active-character${campaignId ? ':' + campaignId : ''}`
}

const SAME_TAB_EVENT = 'claudedm:session-change'

export function setActiveCharacter(campaignId: string | null, characterId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(activeCharKey(campaignId), characterId)
  window.dispatchEvent(new Event(SAME_TAB_EVENT))
}

export function getActiveCharacter(campaignId: string | null): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(activeCharKey(campaignId))
}
