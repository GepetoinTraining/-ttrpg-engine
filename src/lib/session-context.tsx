'use client'

import React from 'react'
import {
  loadCert,
  saveCert as persistCert,
  clearCert as persistClearCert,
  type Certificate,
} from './auth'
import {
  getActiveCharacter,
  setActiveCharacter as persistActiveCharacter,
} from './character'

// SessionContext — single source of truth for cert / campaignId / activeCharacterId.
//
// All three values were previously read ad-hoc from localStorage / window.location.hash
// in each surface. That meant cross-surface updates didn't propagate (Sheet picks a
// character → Combat keeps showing the old one until it remounts).
//
// This provider:
//   - Hydrates from localStorage + URL hash on mount.
//   - Subscribes to hashchange (campaign in URL) and storage events (cross-tab).
//   - Exposes setters that write through so existing direct-localStorage callers
//     (legacy surfaces, server-side imports) keep working during migration.

export interface SessionState {
  cert: Certificate | null
  campaignId: string | null
  activeCharacterId: string | null
  hydrated: boolean
}

export interface SessionApi extends SessionState {
  setCert: (cert: Certificate | null) => void
  clearCert: () => void
  setActiveCharacterId: (id: string | null) => void
  refresh: () => void
}

const SessionContext = React.createContext<SessionApi | null>(null)

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

const SAME_TAB_EVENT = 'claudedm:session-change'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [cert, setCertState] = React.useState<Certificate | null>(null)
  const [campaignId, setCampaignIdState] = React.useState<string | null>(null)
  const [activeCharacterId, setActiveCharacterIdState] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  // Hydrate from storage + URL on first mount.
  const hydrate = React.useCallback(() => {
    setCertState(loadCert())
    const cid = readCampaignFromHash()
    setCampaignIdState(cid)
    setActiveCharacterIdState(getActiveCharacter(cid))
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  // hashchange → re-read campaign + active character (active is per-campaign).
  React.useEffect(() => {
    const onHash = () => {
      const cid = readCampaignFromHash()
      setCampaignIdState((prev) => (prev === cid ? prev : cid))
      setActiveCharacterIdState(getActiveCharacter(cid))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // storage event → cross-tab sync (other tab logs in/out, picks character, etc.)
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (e.key === 'claudedm:cert') {
        setCertState(loadCert())
      } else if (e.key.startsWith('claudedm:active-character')) {
        const cid = readCampaignFromHash()
        setActiveCharacterIdState(getActiveCharacter(cid))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Same-tab custom event → propagate setter calls from non-context callers
  // (legacy code that calls saveCert/setActiveCharacter directly).
  React.useEffect(() => {
    const onSame = () => hydrate()
    window.addEventListener(SAME_TAB_EVENT, onSame)
    return () => window.removeEventListener(SAME_TAB_EVENT, onSame)
  }, [hydrate])

  const setCert = React.useCallback((next: Certificate | null) => {
    if (next) persistCert(next)
    else persistClearCert()
    setCertState(next)
  }, [])

  const clearCert = React.useCallback(() => {
    persistClearCert()
    setCertState(null)
  }, [])

  const setActiveCharacterId = React.useCallback((id: string | null) => {
    setActiveCharacterIdState((prev) => {
      if (prev === id) return prev
      if (id !== null) persistActiveCharacter(campaignId, id)
      return id
    })
  }, [campaignId])

  const value = React.useMemo<SessionApi>(
    () => ({
      cert,
      campaignId,
      activeCharacterId,
      hydrated,
      setCert,
      clearCert,
      setActiveCharacterId,
      refresh: hydrate,
    }),
    [cert, campaignId, activeCharacterId, hydrated, setCert, clearCert, setActiveCharacterId, hydrate]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionApi {
  const ctx = React.useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession() must be called inside <SessionProvider>')
  }
  return ctx
}

// Optional helper for legacy code paths to broadcast "I just touched localStorage"
// so the provider re-hydrates without waiting for a hashchange.
export function notifySessionChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SAME_TAB_EVENT))
}
