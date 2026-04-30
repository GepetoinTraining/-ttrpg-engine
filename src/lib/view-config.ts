/**
 * VIEW CONFIG — per-character UI preferences
 * ============================================
 *
 * Each character gets a saved "lens": which surfaces to hide, which to pin,
 * which categories to enable. Lets a wizard prioritize Spells, a merchant
 * prioritize Markets, a noble prioritize Diplomacy.
 *
 * Stored in localStorage keyed by characterId. Falls back to defaults when
 * a character has no config saved (everything visible, default order).
 *
 * Used by: src/components/design/DMHelperApp.tsx (sidebar render),
 *          src/components/design/ConfigMenu.tsx (editor)
 */

const STORAGE_PREFIX = 'claudedm:view-config:'
const DM_DEFAULT_KEY = 'claudedm:view-config:__dm__'

export interface ViewConfig {
  /** Owning character (or '__dm__' for the DM's default config). */
  ownerId: string
  /** Surface ids the user has hidden from sidebar nav. Hash routing still works. */
  hidden: string[]
  /** Surface ids pinned to a "Pinned" section at the top of the workspace. */
  pinned: string[]
  /** Last edit time (ms epoch). */
  updatedAt: number
}

export function defaultViewConfig(ownerId: string): ViewConfig {
  return { ownerId, hidden: [], pinned: [], updatedAt: 0 }
}

function storageKey(ownerId: string): string {
  if (ownerId === '__dm__') return DM_DEFAULT_KEY
  return `${STORAGE_PREFIX}${ownerId}`
}

export function loadViewConfig(ownerId: string | null): ViewConfig {
  if (typeof window === 'undefined') return defaultViewConfig(ownerId ?? '__dm__')
  const id = ownerId ?? '__dm__'
  try {
    const raw = window.localStorage.getItem(storageKey(id))
    if (!raw) return defaultViewConfig(id)
    const parsed = JSON.parse(raw) as Partial<ViewConfig>
    return {
      ownerId: id,
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return defaultViewConfig(id)
  }
}

export function saveViewConfig(config: ViewConfig): void {
  if (typeof window === 'undefined') return
  const next: ViewConfig = { ...config, updatedAt: Date.now() }
  try {
    window.localStorage.setItem(storageKey(config.ownerId), JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('claudedm:view-config-change', { detail: next }))
  } catch {
    // localStorage might be disabled in some contexts; silently no-op.
  }
}

export function toggleHidden(config: ViewConfig, surfaceId: string): ViewConfig {
  const set = new Set(config.hidden)
  if (set.has(surfaceId)) set.delete(surfaceId)
  else set.add(surfaceId)
  return { ...config, hidden: [...set] }
}

export function togglePinned(config: ViewConfig, surfaceId: string): ViewConfig {
  const set = new Set(config.pinned)
  if (set.has(surfaceId)) set.delete(surfaceId)
  else set.add(surfaceId)
  return { ...config, pinned: [...set] }
}

export function resetViewConfig(ownerId: string): ViewConfig {
  const fresh = defaultViewConfig(ownerId)
  saveViewConfig(fresh)
  return fresh
}

/**
 * React hook: returns the active config for a given owner, plus a setter
 * that writes through to storage. Re-syncs on the same-tab change event so
 * the config menu's mutations are visible everywhere immediately.
 */
import * as React from 'react'

export function useViewConfig(ownerId: string | null): [ViewConfig, (next: ViewConfig) => void] {
  const [config, setConfig] = React.useState<ViewConfig>(() =>
    typeof window === 'undefined'
      ? defaultViewConfig(ownerId ?? '__dm__')
      : loadViewConfig(ownerId),
  )

  React.useEffect(() => {
    setConfig(loadViewConfig(ownerId))
  }, [ownerId])

  React.useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ViewConfig>).detail
      if (!detail) return
      if (detail.ownerId !== (ownerId ?? '__dm__')) return
      setConfig(detail)
    }
    window.addEventListener('claudedm:view-config-change', onChange)
    return () => window.removeEventListener('claudedm:view-config-change', onChange)
  }, [ownerId])

  const set = React.useCallback((next: ViewConfig) => {
    setConfig(next)
    saveViewConfig(next)
  }, [])

  return [config, set]
}
