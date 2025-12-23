import { Card, CardTitle, Badge, Button, Avatar } from '@styles/processors/_internal'
import { Moon, Clock, Check, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export interface DowntimeAction {
  id: string
  playerId: string
  playerName: string
  characterName: string
  imageUrl?: string
  actionType: string
  description: string
  daysSpent: number
  status: 'pending' | 'approved' | 'denied' | 'completed'
  outcome?: string
  rolls?: Array<{ type: string; result: number; dc?: number; success?: boolean }>
  rewards?: Array<{ type: string; name: string; quantity?: number }>
  consequences?: string
}

export interface DowntimeRevealProps {
  actions: DowntimeAction[]
  gameDaysPassed: number
  isGM: boolean
  onRevealNext?: () => void
  onRevealAll?: () => void
}

export function DowntimeReveal({
  actions,
  gameDaysPassed,
  isGM,
  onRevealNext,
  onRevealAll,
}: DowntimeRevealProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  const revealAction = (id: string) => {
    setRevealedIds(prev => new Set([...prev, id]))
    setExpandedId(id)
  }

  const completedActions = actions.filter(a => a.status === 'completed')
  const unrevealed = completedActions.filter(a => !revealedIds.has(a.id))

  return (
    <Card variant="default" padding="lg">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Moon size={24} style={{ color: '#8b5cf6' }} />
          <div>
            <CardTitle>Downtime Report</CardTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Clock size={14} style={{ color: '#64748b' }} />
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {gameDaysPassed} days have passed
              </span>
            </div>
          </div>
        </div>

        {isGM && unrevealed.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={onRevealAll}>
              Reveal All
            </Button>
            <Button variant="primary" size="sm" onClick={onRevealNext}>
              Next ({unrevealed.length})
            </Button>
          </div>
        )}
      </div>

      {/* Actions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {completedActions.map(action => {
          const isRevealed = revealedIds.has(action.id)
          const isExpanded = expandedId === action.id

          return (
            <div
              key={action.id}
              style={{
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155',
                overflow: 'hidden',
              }}
            >
              {/* Action Header */}
              <div
                onClick={() => {
                  if (isRevealed) {
                    setExpandedId(isExpanded ? null : action.id)
                  } else if (isGM) {
                    revealAction(action.id)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                }}
              >
                <Avatar src={action.imageUrl} name={action.characterName} size="md" />

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                    {action.characterName}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {isRevealed ? action.actionType : '???'}
                    <span style={{ margin: '0 6px' }}>•</span>
                    {action.daysSpent} days
                  </div>
                </div>

                {!isRevealed && isGM && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); revealAction(action.id) }}>
                    Reveal
                  </Button>
                )}

                {isRevealed && (
                  isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />
                )}
              </div>

              {/* Expanded Content */}
              {isRevealed && isExpanded && (
                <div style={{
                  padding: '16px',
                  borderTop: '1px solid #334155',
                  background: 'rgba(0,0,0,0.2)',
                }}>
                  {/* Description */}
                  <p style={{ margin: '0 0 16px', color: '#e2e8f0', lineHeight: 1.6 }}>
                    {action.description}
                  </p>

                  {/* Rolls */}
                  {action.rolls && action.rolls.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h5 style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 8px' }}>
                        ROLLS
                      </h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {action.rolls.map((roll, i) => (
                          <Badge
                            key={i}
                            variant={roll.success ? 'success' : roll.success === false ? 'danger' : 'default'}
                          >
                            {roll.type}: {roll.result}
                            {roll.dc && ` (DC ${roll.dc})`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outcome */}
                  {action.outcome && (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      borderRadius: '6px',
                      marginBottom: '16px',
                    }}>
                      <h5 style={{ fontSize: '0.75rem', color: '#a78bfa', margin: '0 0 8px' }}>
                        OUTCOME
                      </h5>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9375rem' }}>
                        {action.outcome}
                      </p>
                    </div>
                  )}

                  {/* Rewards */}
                  {action.rewards && action.rewards.length > 0 && (
                    <div style={{ marginBottom: action.consequences ? '16px' : 0 }}>
                      <h5 style={{ fontSize: '0.75rem', color: '#22c55e', margin: '0 0 8px' }}>
                        REWARDS
                      </h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {action.rewards.map((reward, i) => (
                          <Badge key={i} variant="success">
                            {reward.quantity && `${reward.quantity}× `}{reward.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Consequences */}
                  {action.consequences && (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}>
                      <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
                      <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.875rem' }}>
                        {action.consequences}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: '#0f172a',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        {revealedIds.size} of {completedActions.length} actions revealed
      </div>
    </Card>
  )
}
