import { ReactNode, createContext, useContext } from 'react'
import { User, Eye, EyeOff } from 'lucide-react'
import { Badge } from '@styles/processors/_internal'

interface PlayerViewContextValue {
  isGM: boolean
  playerId?: string
  playerName?: string
  characterId?: string
  permissions: {
    canViewSecrets: boolean
    canEditCharacter: boolean
    canControlNpcs: boolean
    canModifySession: boolean
  }
}

const PlayerViewContext = createContext<PlayerViewContextValue>({
  isGM: false,
  permissions: {
    canViewSecrets: false,
    canEditCharacter: true,
    canControlNpcs: false,
    canModifySession: false,
  },
})

export function usePlayerView() {
  return useContext(PlayerViewContext)
}

export interface PlayerViewProviderProps {
  children: ReactNode
  isGM: boolean
  playerId?: string
  playerName?: string
  characterId?: string
}

/**
 * PlayerViewProvider - Provides player context to the entire tree
 */
export function PlayerViewProvider({
  children,
  isGM,
  playerId,
  playerName,
  characterId,
}: PlayerViewProviderProps) {
  const value: PlayerViewContextValue = {
    isGM,
    playerId,
    playerName,
    characterId,
    permissions: {
      canViewSecrets: isGM,
      canEditCharacter: true,
      canControlNpcs: isGM,
      canModifySession: isGM,
    },
  }

  return (
    <PlayerViewContext.Provider value={value}>
      {children}
    </PlayerViewContext.Provider>
  )
}

/**
 * PlayerOnly - Only renders for players (not GM)
 */
export function PlayerOnly({
  children,
  playerId,
}: {
  children: ReactNode
  playerId?: string
}) {
  const { isGM, playerId: currentPlayerId } = usePlayerView()

  // If specific player required, check that too
  if (playerId && playerId !== currentPlayerId) {
    return null
  }

  if (isGM) return null

  return <>{children}</>
}

/**
 * OwnerOnly - Only renders for the owner of a character/item
 */
export function OwnerOnly({
  children,
  ownerId,
  fallback,
}: {
  children: ReactNode
  ownerId: string
  fallback?: ReactNode
}) {
  const { isGM, playerId } = usePlayerView()

  if (isGM || playerId === ownerId) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}

/**
 * PlayerViewIndicator - Shows who is viewing
 */
export function PlayerViewIndicator() {
  const { isGM, playerName, characterId } = usePlayerView()

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      background: isGM ? 'rgba(139, 92, 246, 0.2)' : 'rgba(14, 165, 233, 0.2)',
      borderRadius: '20px',
      fontSize: '0.8125rem',
    }}>
      {isGM ? (
        <>
          <Eye size={14} style={{ color: '#c4b5fd' }} />
          <span style={{ color: '#c4b5fd', fontWeight: 500 }}>GM View</span>
        </>
      ) : (
        <>
          <User size={14} style={{ color: '#7dd3fc' }} />
          <span style={{ color: '#7dd3fc' }}>{playerName || 'Player'}</span>
        </>
      )}
    </div>
  )
}

/**
 * ViewToggleButton - Let GM toggle between views
 */
export function ViewToggleButton({
  isGMView,
  onToggle,
}: {
  isGMView: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: isGMView ? 'rgba(139, 92, 246, 0.2)' : 'rgba(14, 165, 233, 0.2)',
        border: `1px solid ${isGMView ? 'rgba(139, 92, 246, 0.4)' : 'rgba(14, 165, 233, 0.4)'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 200ms',
      }}
    >
      {isGMView ? (
        <>
          <Eye size={16} style={{ color: '#c4b5fd' }} />
          <span style={{ color: '#c4b5fd', fontWeight: 500 }}>GM View</span>
        </>
      ) : (
        <>
          <User size={16} style={{ color: '#7dd3fc' }} />
          <span style={{ color: '#7dd3fc', fontWeight: 500 }}>Player View</span>
        </>
      )}
    </button>
  )
}

/**
 * FilteredForPlayer - Filters content based on what player should see
 */
export function FilteredForPlayer<T extends { isHidden?: boolean; visibleTo?: string[] }>({
  items,
  render,
  emptyMessage = 'Nothing to show',
}: {
  items: T[]
  render: (item: T, index: number) => ReactNode
  emptyMessage?: string
}) {
  const { isGM, playerId } = usePlayerView()

  const visibleItems = items.filter(item => {
    if (isGM) return true
    if (item.isHidden) return false
    if (item.visibleTo && playerId && !item.visibleTo.includes(playerId)) return false
    return true
  })

  if (visibleItems.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        {emptyMessage}
      </div>
    )
  }

  return <>{visibleItems.map(render)}</>
}
