import { Avatar, Badge, Button } from '@styles/processors/_internal'
import { ChevronRight, Clock, Skull, Shield, Heart } from 'lucide-react'

export interface InitiativeEntry {
  id: string
  name: string
  imageUrl?: string
  initiative: number
  hp: number
  maxHp: number
  ac: number
  isPlayer: boolean
  isCurrentTurn: boolean
  hasActed: boolean
  conditions?: string[]
  isHidden?: boolean
}

export interface InitiativeBarProps {
  entries: InitiativeEntry[]
  currentRound: number
  isGM: boolean
  onEndTurn?: () => void
  onSelectEntry?: (id: string) => void
  onNextRound?: () => void
}

export function InitiativeBar({
  entries,
  currentRound,
  isGM,
  onEndTurn,
  onSelectEntry,
  onNextRound,
}: InitiativeBarProps) {
  const sortedEntries = [...entries].sort((a, b) => b.initiative - a.initiative)
  const currentEntry = sortedEntries.find(e => e.isCurrentTurn)

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '8px',
      border: '1px solid #334155',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #334155',
        background: '#0f172a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Round {currentRound}</span>
        </div>
        {isGM && onEndTurn && (
          <Button variant="primary" size="sm" onClick={onEndTurn}>
            End Turn <ChevronRight size={14} />
          </Button>
        )}
      </div>

      {/* Initiative List */}
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        {sortedEntries.map((entry, index) => {
          // Hide enemies from players
          if (entry.isHidden && !isGM) return null

          const isDead = entry.hp <= 0
          const hpPercent = Math.max(0, (entry.hp / entry.maxHp) * 100)

          return (
            <div
              key={entry.id}
              onClick={() => onSelectEntry?.(entry.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: entry.isCurrentTurn
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'transparent',
                borderLeft: entry.isCurrentTurn
                  ? '3px solid #f59e0b'
                  : '3px solid transparent',
                opacity: entry.hasActed ? 0.5 : isDead ? 0.4 : 1,
                cursor: 'pointer',
                transition: 'background 100ms',
              }}
            >
              {/* Initiative Number */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: entry.isCurrentTurn ? '#f59e0b' : '#334155',
                color: entry.isCurrentTurn ? '#0f172a' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8125rem',
                flexShrink: 0,
              }}>
                {entry.initiative}
              </div>

              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  src={entry.imageUrl}
                  name={entry.name}
                  size="sm"
                  style={{ opacity: isDead ? 0.5 : 1 }}
                />
                {isDead && (
                  <Skull
                    size={16}
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      color: '#ef4444',
                      background: '#0f172a',
                      borderRadius: '50%',
                      padding: 2,
                    }}
                  />
                )}
              </div>

              {/* Name & HP */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                }}>
                  <span style={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: entry.isCurrentTurn ? '#fcd34d' : isDead ? '#64748b' : '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.name}
                  </span>
                  {entry.conditions && entry.conditions.length > 0 && (
                    <Badge variant="warning" style={{ fontSize: '0.625rem' }}>
                      {entry.conditions.length}
                    </Badge>
                  )}
                </div>

                {/* HP Bar (GM only for enemies) */}
                {(entry.isPlayer || isGM) && (
                  <div style={{
                    height: 4,
                    background: '#0f172a',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${hpPercent}%`,
                      height: '100%',
                      background: hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
                      transition: 'width 200ms',
                    }} />
                  </div>
                )}
              </div>

              {/* Stats */}
              <div style={{
                display: 'flex',
                gap: '8px',
                fontSize: '0.75rem',
                color: '#64748b',
                flexShrink: 0,
              }}>
                {(entry.isPlayer || isGM) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Heart size={12} style={{ color: '#ef4444' }} />
                    {entry.hp}/{entry.maxHp}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Shield size={12} style={{ color: '#64748b' }} />
                  {entry.ac}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* All acted - Next Round */}
      {isGM && sortedEntries.every(e => e.hasActed || e.hp <= 0) && (
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid #334155',
          textAlign: 'center',
        }}>
          <Button variant="primary" onClick={onNextRound} style={{ width: '100%' }}>
            Next Round
          </Button>
        </div>
      )}
    </div>
  )
}
