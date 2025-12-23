import { useState } from 'react'
import { Card, Button, Badge, Spinner } from '@styles/processors/_internal'
import { ChevronDown, ChevronUp, Sparkles, Lock, Unlock, AlertTriangle } from 'lucide-react'
import { trpc } from '@api/trpc'

export interface DepthEscalatorProps {
  npcId: string
  currentDepth: number
  maxDepth?: number
  onDepthChange?: (newDepth: number) => void
}

const DEPTH_INFO = [
  { level: 0, name: 'Surface', desc: 'Name, role, basic appearance', color: '#22c55e' },
  { level: 1, name: 'Shallow', desc: 'Personality, motivations, relationships', color: '#0ea5e9' },
  { level: 2, name: 'Medium', desc: 'Backstory, secrets, fears', color: '#8b5cf6' },
  { level: 3, name: 'Deep', desc: 'Hidden agendas, dark past, true nature', color: '#f59e0b' },
  { level: 4, name: 'Very Deep', desc: 'Campaign-altering revelations', color: '#ef4444' },
  { level: 5, name: 'Abyss', desc: 'Fundamental truths that reshape reality', color: '#ec4899' },
]

export function DepthEscalator({
  npcId,
  currentDepth,
  maxDepth = 5,
  onDepthChange,
}: DepthEscalatorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [generating, setGenerating] = useState<number | null>(null)

  const deepenMutation = trpc.ai.deepenNpc.useMutation({
    onSuccess: (result) => {
      setGenerating(null)
      onDepthChange?.(result.newDepth)
    },
    onError: () => {
      setGenerating(null)
    },
  })

  const handleDeepen = (targetDepth: number) => {
    if (targetDepth <= currentDepth || targetDepth > maxDepth) return
    setGenerating(targetDepth)
    deepenMutation.mutate({ npcId, targetDepth })
  }

  const currentInfo = DEPTH_INFO[currentDepth]

  return (
    <Card variant="default" padding="md">
      {/* Current Depth Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${currentInfo.color}40, ${currentInfo.color}20)`,
            border: `2px solid ${currentInfo.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: currentInfo.color,
          }}>
            D{currentDepth}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: currentInfo.color }}>
              {currentInfo.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              {currentInfo.desc}
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {/* Depth Levels */}
      {isExpanded && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #1e293b',
        }}>
          {/* Depth Ladder */}
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute',
              left: '11px',
              top: '0',
              bottom: '0',
              width: '2px',
              background: 'linear-gradient(to bottom, #22c55e, #0ea5e9, #8b5cf6, #f59e0b, #ef4444, #ec4899)',
            }} />

            {DEPTH_INFO.map((depth) => {
              const isLocked = depth.level > currentDepth
              const isCurrent = depth.level === currentDepth
              const isGenerating = generating === depth.level
              const canDeepen = depth.level === currentDepth + 1 && depth.level <= maxDepth

              return (
                <div
                  key={depth.level}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    opacity: isLocked && !canDeepen ? 0.4 : 1,
                  }}
                >
                  {/* Node */}
                  <div style={{
                    position: 'absolute',
                    left: '4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: isCurrent ? depth.color : isLocked ? '#1e293b' : depth.color,
                    border: `2px solid ${depth.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {isCurrent && (
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#fff',
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: isCurrent ? 600 : 400,
                      color: isLocked ? '#475569' : depth.color,
                    }}>
                      D{depth.level}: {depth.name}
                      {isLocked && <Lock size={12} />}
                      {!isLocked && depth.level < currentDepth && <Unlock size={12} style={{ color: '#22c55e' }} />}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {depth.desc}
                    </div>
                  </div>

                  {/* Deepen Button */}
                  {canDeepen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeepen(depth.level)}
                      disabled={isGenerating}
                      style={{ color: depth.color }}
                    >
                      {isGenerating ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <Sparkles size={14} /> Deepen
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Warning for deep levels */}
          {currentDepth >= 3 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              gap: '8px',
              fontSize: '0.8125rem',
              color: '#fcd34d',
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Deep NPCs may reveal campaign-altering information.
                Generated content becomes canon once revealed to players.
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
