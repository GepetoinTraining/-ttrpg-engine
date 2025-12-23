import { useState } from 'react'
import { Card, CardTitle, Button, Badge, Avatar, Input, Textarea } from '@styles/processors/_internal'
import { Trophy, Star, Clock, Scroll, Swords, Gift, ThumbsUp, MessageSquare, ChevronRight } from 'lucide-react'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'

export interface SessionEndProps {
  session: {
    id: string
    name: string
    duration: number // minutes
    cardCount: number
    combatCount: number
    lootDistributed: number
  }
  players: Array<{
    id: string
    userId: string
    name: string
    characterName: string
    imageUrl?: string
    xpEarned?: number
  }>
  isGM: boolean
  onFinalize: () => void
}

export function SessionEnd({
  session,
  players,
  isGM,
  onFinalize,
}: SessionEndProps) {
  const [xpDistribution, setXpDistribution] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.id, p.xpEarned || 0]))
  )
  const [mvpVote, setMvpVote] = useState<string | null>(null)
  const [gmNotes, setGmNotes] = useState('')
  const [highlights, setHighlights] = useState<string[]>([])

  const finalizeMutation = trpc.session.finalize.useMutation({
    onSuccess: () => {
      toast.success('Session finalized!')
      onFinalize()
    },
  })

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const totalXp = Object.values(xpDistribution).reduce((a, b) => a + b, 0)

  const handleXpChange = (playerId: string, xp: number) => {
    setXpDistribution(prev => ({ ...prev, [playerId]: xp }))
  }

  const distributeXpEvenly = (total: number) => {
    const perPlayer = Math.floor(total / players.length)
    setXpDistribution(Object.fromEntries(players.map(p => [p.id, perPlayer])))
  }

  const handleFinalize = () => {
    finalizeMutation.mutate({
      sessionId: session.id,
      xpDistribution,
      mvpPlayerId: mvpVote,
      gmNotes,
      highlights,
    })
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Trophy size={48} style={{ color: '#f59e0b', marginBottom: '12px' }} />
        <h1 style={{ margin: '0 0 8px', fontSize: '1.75rem', color: '#f8fafc' }}>
          Session Complete!
        </h1>
        <p style={{ margin: 0, color: '#94a3b8' }}>{session.name}</p>
      </div>

      {/* Stats */}
      <Card variant="default" padding="lg" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' }}>
          <StatBox icon={<Clock size={20} />} label="Duration" value={formatDuration(session.duration)} />
          <StatBox icon={<Scroll size={20} />} label="Scenes" value={session.cardCount} />
          <StatBox icon={<Swords size={20} />} label="Combats" value={session.combatCount} />
          <StatBox icon={<Gift size={20} />} label="Gold Looted" value={`${session.lootDistributed} gp`} />
        </div>
      </Card>

      {/* XP Distribution */}
      {isGM && (
        <Card variant="default" padding="lg" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <CardTitle style={{ margin: 0 }}>
              <Star size={18} style={{ marginRight: '8px', color: '#f59e0b' }} />
              Experience Points
            </CardTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Total: {totalXp} XP</span>
              <Button variant="ghost" size="sm" onClick={() => {
                const total = prompt('Total XP to distribute:')
                if (total) distributeXpEvenly(parseInt(total))
              }}>
                Split Evenly
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {players.map(player => (
              <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar src={player.imageUrl} name={player.characterName} size="sm" />
                <span style={{ flex: 1, fontWeight: 500 }}>{player.characterName}</span>
                <input
                  type="number"
                  value={xpDistribution[player.id] || 0}
                  onChange={(e) => handleXpChange(player.id, parseInt(e.target.value) || 0)}
                  style={{
                    width: '80px',
                    padding: '8px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f59e0b',
                    fontSize: '0.9375rem',
                    textAlign: 'right',
                  }}
                />
                <span style={{ color: '#64748b', width: '30px' }}>XP</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MVP Vote */}
      <Card variant="default" padding="lg" style={{ marginBottom: '24px' }}>
        <CardTitle style={{ marginBottom: '16px' }}>
          <ThumbsUp size={18} style={{ marginRight: '8px', color: '#22c55e' }} />
          MVP Vote
        </CardTitle>
        <p style={{ color: '#94a3b8', margin: '0 0 16px', fontSize: '0.875rem' }}>
          Who had the best moment this session?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {players.map(player => (
            <button
              key={player.id}
              onClick={() => setMvpVote(player.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: mvpVote === player.id ? 'rgba(34, 197, 94, 0.2)' : '#1e293b',
                border: mvpVote === player.id ? '2px solid #22c55e' : '1px solid #334155',
                borderRadius: '20px',
                color: mvpVote === player.id ? '#22c55e' : '#e2e8f0',
                cursor: 'pointer',
              }}
            >
              <Avatar src={player.imageUrl} name={player.characterName} size="xs" />
              {player.characterName}
            </button>
          ))}
        </div>
      </Card>

      {/* GM Notes */}
      {isGM && (
        <Card variant="default" padding="lg" style={{ marginBottom: '24px' }}>
          <CardTitle style={{ marginBottom: '16px' }}>
            <MessageSquare size={18} style={{ marginRight: '8px', color: '#8b5cf6' }} />
            Session Notes
          </CardTitle>
          <Textarea
            value={gmNotes}
            onChange={(e) => setGmNotes(e.target.value)}
            placeholder="What happened? Any plot threads to follow up on?"
            rows={4}
          />
        </Card>
      )}

      {/* Finalize Button */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
        {isGM && (
          <Button
            variant="primary"
            size="lg"
            onClick={handleFinalize}
            loading={finalizeMutation.isPending}
          >
            Finalize Session <ChevronRight size={18} />
          </Button>
        )}
      </div>
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ color: '#64748b', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}
