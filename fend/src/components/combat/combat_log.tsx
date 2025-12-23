import { Badge } from '@styles/processors/_internal'
import { Sword, Shield, Heart, Skull, Dices, Footprints, Sparkles, AlertTriangle } from 'lucide-react'

export type LogEntryType = 'attack' | 'damage' | 'heal' | 'death' | 'roll' | 'move' | 'condition' | 'round'

export interface CombatLogEntry {
  id: string
  type: LogEntryType
  timestamp: Date
  actorName?: string
  targetName?: string
  message: string
  value?: number
  isHit?: boolean
  isCritical?: boolean
}

export interface CombatLogProps {
  entries: CombatLogEntry[]
}

const ENTRY_ICONS: Record<LogEntryType, React.ReactNode> = {
  attack: <Sword size={12} />,
  damage: <Heart size={12} />,
  heal: <Heart size={12} style={{ color: '#22c55e' }} />,
  death: <Skull size={12} />,
  roll: <Dices size={12} />,
  move: <Footprints size={12} />,
  condition: <AlertTriangle size={12} />,
  round: <Sparkles size={12} />,
}

const ENTRY_COLORS: Record<LogEntryType, string> = {
  attack: '#64748b',
  damage: '#ef4444',
  heal: '#22c55e',
  death: '#ef4444',
  roll: '#64748b',
  move: '#64748b',
  condition: '#f59e0b',
  round: '#f59e0b',
}

export function CombatLog({ entries }: CombatLogProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #334155',
        fontWeight: 600,
        fontSize: '0.8125rem',
        color: '#94a3b8',
        background: '#0f172a',
      }}>
        Combat Log
      </div>

      {/* Log Entries */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column-reverse', // Newest at bottom, scrolls up
      }}>
        <div style={{ padding: '8px' }}>
          {entries.length === 0 ? (
            <div style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: '#475569',
              fontSize: '0.8125rem',
            }}>
              Combat started
            </div>
          ) : (
            entries.map(entry => (
              <LogEntry key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function LogEntry({ entry }: { entry: CombatLogEntry }) {
  const renderContent = () => {
    switch (entry.type) {
      case 'round':
        return (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '6px',
            textAlign: 'center',
            color: '#fcd34d',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
          }}>
            Round {entry.value}
          </div>
        )

      case 'attack':
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{
              color: ENTRY_COLORS[entry.type],
              marginTop: 2,
            }}>
              {ENTRY_ICONS[entry.type]}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{entry.actorName}</span>
              <span style={{ color: '#64748b' }}> attacks </span>
              <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{entry.targetName}</span>
              {entry.value && (
                <Badge
                  variant={entry.isHit ? 'success' : 'danger'}
                  style={{
                    marginLeft: 6,
                    fontSize: '0.625rem',
                  }}
                >
                  {entry.value}
                  {entry.isCritical && ' CRIT!'}
                </Badge>
              )}
              {entry.isHit === false && (
                <Badge variant="default" style={{ marginLeft: 6, fontSize: '0.625rem' }}>
                  MISS
                </Badge>
              )}
            </div>
          </div>
        )

      case 'damage':
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ color: ENTRY_COLORS[entry.type], marginTop: 2 }}>
              {ENTRY_ICONS[entry.type]}
            </div>
            <div>
              <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{entry.targetName}</span>
              <span style={{ color: '#64748b' }}> takes </span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>{entry.value}</span>
              <span style={{ color: '#64748b' }}> damage</span>
            </div>
          </div>
        )

      case 'heal':
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ color: ENTRY_COLORS[entry.type], marginTop: 2 }}>
              {ENTRY_ICONS[entry.type]}
            </div>
            <div>
              <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{entry.targetName}</span>
              <span style={{ color: '#64748b' }}> heals </span>
              <span style={{ fontWeight: 600, color: '#22c55e' }}>{entry.value}</span>
              <span style={{ color: '#64748b' }}> HP</span>
            </div>
          </div>
        )

      case 'death':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '4px',
          }}>
            <Skull size={14} style={{ color: '#ef4444' }} />
            <span style={{ fontWeight: 500, color: '#fca5a5' }}>
              {entry.targetName} has fallen!
            </span>
          </div>
        )

      case 'condition':
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ color: ENTRY_COLORS[entry.type], marginTop: 2 }}>
              {ENTRY_ICONS[entry.type]}
            </div>
            <div>
              <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{entry.targetName}</span>
              <span style={{ color: '#64748b' }}> {entry.message}</span>
            </div>
          </div>
        )

      default:
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ color: ENTRY_COLORS[entry.type], marginTop: 2 }}>
              {ENTRY_ICONS[entry.type]}
            </div>
            <span style={{ color: '#94a3b8' }}>{entry.message}</span>
          </div>
        )
    }
  }

  return (
    <div style={{
      padding: '6px 0',
      fontSize: '0.8125rem',
      borderBottom: entry.type === 'round' ? 'none' : '1px solid rgba(51, 65, 85, 0.5)',
    }}>
      {renderContent()}
    </div>
  )
}
