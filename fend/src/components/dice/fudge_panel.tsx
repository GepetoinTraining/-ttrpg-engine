import { useState } from 'react'
import { Card, Button, Badge, Input } from '@styles/processors/_internal'
import { Eye, EyeOff, Edit2, Check, X, AlertTriangle, History } from 'lucide-react'

export interface FudgePanelProps {
  rollId: string
  originalRoll: {
    expression: string
    rolls: number[]
    total: number
  }
  onFudge: (rollId: string, newTotal: number, reason?: string) => void
  onReveal?: (rollId: string) => void
  isHidden?: boolean
}

export function FudgePanel({
  rollId,
  originalRoll,
  onFudge,
  onReveal,
  isHidden = false,
}: FudgePanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newTotal, setNewTotal] = useState(originalRoll.total.toString())
  const [reason, setReason] = useState('')
  const [showWarning, setShowWarning] = useState(false)

  const handleFudge = () => {
    const total = parseInt(newTotal, 10)
    if (isNaN(total)) return

    if (Math.abs(total - originalRoll.total) > 10) {
      setShowWarning(true)
      return
    }

    confirmFudge()
  }

  const confirmFudge = () => {
    const total = parseInt(newTotal, 10)
    if (isNaN(total)) return

    onFudge(rollId, total, reason || undefined)
    setIsEditing(false)
    setShowWarning(false)
    setReason('')
  }

  const cancelEdit = () => {
    setNewTotal(originalRoll.total.toString())
    setReason('')
    setIsEditing(false)
    setShowWarning(false)
  }

  return (
    <Card
      variant="default"
      padding="sm"
      style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.6875rem',
        color: '#c4b5fd',
        marginBottom: '8px',
      }}>
        <Eye size={12} />
        GM ONLY - FUDGE ROLL
      </div>

      {!isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Original Roll Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              {originalRoll.expression}
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {originalRoll.total}
              {isHidden && (
                <Badge variant="default" style={{ fontSize: '0.625rem' }}>
                  <EyeOff size={10} /> Hidden
                </Badge>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              [{originalRoll.rolls.join(', ')}]
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 size={14} /> Fudge
            </Button>
            {isHidden && onReveal && (
              <Button variant="ghost" size="sm" onClick={() => onReveal(rollId)}>
                <Eye size={14} /> Reveal
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Edit Mode */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '0.6875rem',
                color: '#94a3b8',
                marginBottom: '4px',
              }}>
                New Total
              </label>
              <input
                type="number"
                value={newTotal}
                onChange={(e) => setNewTotal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{
                display: 'block',
                fontSize: '0.6875rem',
                color: '#94a3b8',
                marginBottom: '4px',
              }}>
                Reason (optional, logged)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Drama, player struggling, etc."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          {/* Warning */}
          {showWarning && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(245, 158, 11, 0.2)',
              borderRadius: '6px',
              marginBottom: '8px',
              fontSize: '0.8125rem',
              color: '#fcd34d',
            }}>
              <AlertTriangle size={14} />
              Large change detected ({Math.abs(parseInt(newTotal) - originalRoll.total)} difference). Confirm?
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X size={14} /> Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={showWarning ? confirmFudge : handleFudge}
            >
              <Check size={14} /> {showWarning ? 'Confirm' : 'Apply'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// Quick Fudge Buttons for common scenarios
export function QuickFudge({
  originalTotal,
  onSelect,
}: {
  originalTotal: number
  onSelect: (newTotal: number) => void
}) {
  const options = [
    { label: 'Just Fail', delta: -1, color: '#ef4444' },
    { label: 'Just Pass', delta: 1, color: '#22c55e' },
    { label: 'Nat 20', value: 20, color: '#f59e0b' },
    { label: 'Nat 1', value: 1, color: '#64748b' },
  ]

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {options.map(opt => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.value ?? (originalTotal + (opt.delta ?? 0)))}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: `1px solid ${opt.color}40`,
            borderRadius: '4px',
            color: opt.color,
            fontSize: '0.6875rem',
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Fudge History for audit trail
export function FudgeHistory({
  history,
}: {
  history: Array<{
    rollId: string
    original: number
    fudged: number
    reason?: string
    timestamp: Date
  }>
}) {
  if (history.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '16px',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        No fudged rolls this session
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.75rem',
        color: '#94a3b8',
        fontWeight: 600,
      }}>
        <History size={12} />
        FUDGE HISTORY
      </div>

      {history.map((entry, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px',
            background: '#1e293b',
            borderRadius: '6px',
            fontSize: '0.8125rem',
          }}
        >
          <div>
            <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>
              {entry.original}
            </span>
            <span style={{ color: '#64748b', margin: '0 8px' }}>→</span>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>
              {entry.fudged}
            </span>
          </div>
          {entry.reason && (
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              {entry.reason}
            </span>
          )}
          <span style={{ color: '#475569', fontSize: '0.6875rem' }}>
            {entry.timestamp.toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}
