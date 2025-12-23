import { Button, Badge, Tooltip } from '@styles/processors/_internal'
import { Sword, Shield, Footprints, Sparkles, MessageCircle, SkipForward, Dices } from 'lucide-react'

export type ActionType = 'action' | 'bonus' | 'reaction' | 'movement' | 'free'

export interface ActionBarProps {
  actionsUsed: {
    action: boolean
    bonus: boolean
    reaction: boolean
    movement: number // feet moved
  }
  movementSpeed: number
  isMyTurn: boolean
  onAction: (type: ActionType) => void
  onEndTurn: () => void
  onRollDice: () => void
}

export function ActionBar({
  actionsUsed,
  movementSpeed,
  isMyTurn,
  onAction,
  onEndTurn,
  onRollDice,
}: ActionBarProps) {
  const movementRemaining = movementSpeed - actionsUsed.movement

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      background: '#1e293b',
      borderRadius: '8px',
      border: '1px solid #334155',
    }}>
      {/* Action Economy */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <ActionButton
          icon={<Sword size={18} />}
          label="Action"
          used={actionsUsed.action}
          disabled={!isMyTurn || actionsUsed.action}
          onClick={() => onAction('action')}
        />
        <ActionButton
          icon={<Sparkles size={18} />}
          label="Bonus"
          used={actionsUsed.bonus}
          disabled={!isMyTurn || actionsUsed.bonus}
          onClick={() => onAction('bonus')}
          color="#f59e0b"
        />
        <ActionButton
          icon={<Shield size={18} />}
          label="Reaction"
          used={actionsUsed.reaction}
          disabled={actionsUsed.reaction}
          onClick={() => onAction('reaction')}
          color="#8b5cf6"
        />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: '#334155' }} />

      {/* Movement */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        background: '#0f172a',
        borderRadius: '6px',
      }}>
        <Footprints size={16} style={{ color: '#22c55e' }} />
        <span style={{
          fontWeight: 600,
          color: movementRemaining > 0 ? '#22c55e' : '#64748b',
          fontSize: '0.9375rem',
        }}>
          {movementRemaining} ft
        </span>
        <span style={{ color: '#475569', fontSize: '0.75rem' }}>
          / {movementSpeed}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Quick Actions */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRollDice}
        style={{ color: '#0ea5e9' }}
      >
        <Dices size={18} />
      </Button>

      {/* End Turn */}
      {isMyTurn && (
        <Button
          variant="primary"
          size="sm"
          onClick={onEndTurn}
        >
          End Turn <SkipForward size={16} />
        </Button>
      )}
    </div>
  )
}

function ActionButton({
  icon,
  label,
  used,
  disabled,
  onClick,
  color = '#3b82f6',
}: {
  icon: React.ReactNode
  label: string
  used: boolean
  disabled: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <Tooltip content={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          padding: 0,
          background: used ? '#0f172a' : `${color}20`,
          border: used ? '2px solid #334155' : `2px solid ${color}40`,
          borderRadius: '8px',
          color: used ? '#475569' : color,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled && !used ? 0.5 : 1,
          transition: 'all 150ms',
          position: 'relative',
        }}
      >
        {icon}
        {used && (
          <div style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid #1e293b',
          }} />
        )}
      </button>
    </Tooltip>
  )
}
