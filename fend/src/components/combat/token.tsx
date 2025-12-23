import { Avatar } from '@styles/processors/_internal'

export interface TokenData {
  id: string
  name: string
  imageUrl?: string
  x: number
  y: number
  size?: number // 1 = medium, 2 = large, 3 = huge, 4 = gargantuan
  hp: number
  maxHp: number
  ac: number
  initiative?: number
  conditions?: string[]
  isPlayerControlled?: boolean
  isHidden?: boolean
  color?: string
}

export interface TokenProps {
  data: TokenData
  gridSize: number
  isSelected?: boolean
  isDragging?: boolean
  ghostPosition?: { x: number; y: number } | null
  onMouseDown?: (e: React.MouseEvent) => void
  isGM: boolean
}

const CONDITION_COLORS: Record<string, string> = {
  blinded: '#64748b',
  charmed: '#ec4899',
  deafened: '#6b7280',
  frightened: '#fbbf24',
  grappled: '#8b5cf6',
  incapacitated: '#374151',
  invisible: '#06b6d4',
  paralyzed: '#dc2626',
  petrified: '#78716c',
  poisoned: '#22c55e',
  prone: '#a16207',
  restrained: '#9333ea',
  stunned: '#facc15',
  unconscious: '#1e293b',
  exhaustion: '#f97316',
  concentration: '#3b82f6',
}

export function Token({
  data,
  gridSize,
  isSelected = false,
  isDragging = false,
  ghostPosition,
  onMouseDown,
  isGM,
}: TokenProps) {
  const tokenSize = (data.size || 1) * gridSize - 4 // 4px padding
  const hpPercent = Math.max(0, Math.min(100, (data.hp / data.maxHp) * 100))

  const getHpColor = () => {
    if (hpPercent > 50) return '#22c55e'
    if (hpPercent > 25) return '#f59e0b'
    return '#ef4444'
  }

  // Don't render hidden tokens for players
  if (data.isHidden && !isGM) return null

  const renderToken = (x: number, y: number, isGhost = false) => (
    <div
      style={{
        position: 'absolute',
        left: x * gridSize + 2,
        top: y * gridSize + 2,
        width: tokenSize,
        height: tokenSize,
        opacity: isGhost ? 0.5 : isDragging ? 0.3 : 1,
        pointerEvents: isGhost ? 'none' : 'auto',
        transition: isGhost ? 'none' : 'left 150ms, top 150ms',
        zIndex: isSelected ? 100 : 10,
      }}
      onMouseDown={!isGhost ? onMouseDown : undefined}
    >
      {/* Token Circle */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: data.color || (data.isPlayerControlled ? '#3b82f6' : '#ef4444'),
          border: isSelected
            ? '3px solid #f59e0b'
            : data.isHidden
              ? '2px dashed rgba(255,255,255,0.3)'
              : '2px solid rgba(255,255,255,0.2)',
          boxShadow: isSelected ? '0 0 12px rgba(245, 158, 11, 0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'grab',
          position: 'relative',
        }}
      >
        {/* Avatar/Image */}
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span style={{
            color: '#fff',
            fontWeight: 700,
            fontSize: tokenSize * 0.4,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            {data.name[0]}
          </span>
        )}

        {/* HP Bar */}
        {!isGhost && (
          <div style={{
            position: 'absolute',
            bottom: -2,
            left: '10%',
            right: '10%',
            height: 4,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 2,
          }}>
            <div style={{
              width: `${hpPercent}%`,
              height: '100%',
              background: getHpColor(),
              borderRadius: 2,
              transition: 'width 200ms',
            }} />
          </div>
        )}
      </div>

      {/* Condition Indicators */}
      {!isGhost && data.conditions && data.conditions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: -4,
          right: -4,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          maxWidth: tokenSize,
        }}>
          {data.conditions.slice(0, 3).map((condition, i) => (
            <div
              key={condition}
              title={condition}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: CONDITION_COLORS[condition.toLowerCase()] || '#64748b',
                border: '1px solid rgba(0,0,0,0.3)',
              }}
            />
          ))}
          {data.conditions.length > 3 && (
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#475569',
              fontSize: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              +{data.conditions.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Initiative Badge */}
      {!isGhost && data.initiative !== undefined && (
        <div style={{
          position: 'absolute',
          top: -6,
          left: -6,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#f59e0b',
          color: '#0f172a',
          fontSize: 10,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #0f172a',
        }}>
          {data.initiative}
        </div>
      )}

      {/* Name Label (on hover or selected) */}
      {!isGhost && isSelected && (
        <div style={{
          position: 'absolute',
          bottom: -20,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          padding: '2px 6px',
          background: 'rgba(0,0,0,0.8)',
          borderRadius: 4,
          fontSize: 10,
          color: '#fff',
        }}>
          {data.name}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Ghost token (drag preview) */}
      {isDragging && ghostPosition && renderToken(ghostPosition.x, ghostPosition.y, true)}

      {/* Actual token */}
      {renderToken(data.x, data.y)}
    </>
  )
}
