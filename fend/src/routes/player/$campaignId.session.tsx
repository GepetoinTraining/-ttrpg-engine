import { useParams } from '@tanstack/react-router'
import { Card, CardTitle, Badge, Spinner } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { useRoom, useRealtime } from '@api/websocket'
import { Scroll, Swords, Clock } from 'lucide-react'

export function PlayerSession() {
  const { campaignId } = useParams({ from: '/player/$campaignId' })

  const { data: activeSession } = trpc.session.active.useQuery({ campaignId })
  const { data: currentCard } = trpc.session.currentCard.useQuery(
    { sessionId: activeSession?.id! },
    { enabled: !!activeSession?.id }
  )

  // Join session room for live updates
  useRoom('session', activeSession?.id || '')

  // Listen for card changes
  useRealtime('card_changed', (data) => {
    // Refetch current card
  })

  if (!activeSession) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px',
        textAlign: 'center',
      }}>
        <Clock size={48} style={{ color: '#475569', marginBottom: '16px' }} />
        <h2 style={{ color: '#f8fafc', fontSize: '1.125rem', marginBottom: '8px' }}>
          No Active Session
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Waiting for the GM to start a session...
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Session Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Badge variant="success">LIVE</Badge>
        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Session {activeSession.number}
        </span>
      </div>

      {/* Current Card */}
      {currentCard ? (
        <Card variant="scene" padding="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            {currentCard.type === 'combat' ? (
              <Swords size={20} style={{ color: '#ef4444' }} />
            ) : (
              <Scroll size={20} style={{ color: '#0ea5e9' }} />
            )}
            <CardTitle style={{ fontSize: '1.125rem' }}>{currentCard.title}</CardTitle>
          </div>

          <div style={{
            color: '#e2e8f0',
            lineHeight: 1.7,
            fontSize: '0.9375rem',
          }}>
            {currentCard.content?.playerDescription || currentCard.content?.description}
          </div>

          {/* Visible Secrets */}
          {currentCard.content?.visibleSecrets?.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '8px',
              borderLeft: '3px solid #f59e0b',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginBottom: '4px' }}>
                You notice...
              </div>
              {currentCard.content.visibleSecrets.map((secret: string, i: number) => (
                <div key={i} style={{ color: '#fcd34d', fontSize: '0.875rem' }}>
                  {secret}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card variant="default" padding="lg" style={{ textAlign: 'center' }}>
          <Spinner size="md" />
          <p style={{ color: '#64748b', marginTop: '12px' }}>
            Waiting for GM...
          </p>
        </Card>
      )}

      {/* Combat View (if in combat) */}
      {currentCard?.type === 'combat' && (
        <Card variant="combat" padding="md">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>⚔️ COMBAT</span>
            <Badge variant="error">Round {currentCard.content?.round || 1}</Badge>
          </div>

          {/* Simplified combat view for mobile */}
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Combat grid is best viewed on desktop.
          </div>
        </Card>
      )}
    </div>
  )
}
