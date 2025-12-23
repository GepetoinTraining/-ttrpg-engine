import { useParams, useNavigate } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, CardHeader, Button, Badge } from '@styles/processors/_internal'
import { List, ListItem, Avatar, Input, Form, FormField, FormActions } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'
import { CheckCircle, Star, Gift, Scroll, Clock, Users } from 'lucide-react'

export function SessionEnd() {
  const { id, sessionId } = useParams({ from: '/campaign/$id/session/$sessionId/end' })
  const navigate = useNavigate()

  const { data: session } = trpc.session.get.useQuery({ sessionId })
  const { data: summary } = trpc.session.summary.useQuery({ sessionId })

  const completeMutation = trpc.session.complete.useMutation({
    onSuccess: () => {
      toast.success('Session completed!', 'XP and loot have been distributed.')
      navigate({ to: '/campaign/$id', params: { id } })
    },
  })

  return (
    <ShellContent maxWidth="lg">
      <PageHeader
        title="Session Complete"
        description={`Wrap up Session ${session?.number}`}
      />

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: '1fr 320px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Session Summary */}
          <Card variant="default" padding="md">
            <CardHeader>
              <CardTitle>Session Summary</CardTitle>
              <Badge variant="success"><Clock size={12} /> {session?.duration}</Badge>
            </CardHeader>

            <textarea
              defaultValue={summary?.aiSummary}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                resize: 'vertical',
                marginTop: '12px',
              }}
              placeholder="AI-generated session summary..."
            />
          </Card>

          {/* XP Distribution */}
          <Card variant="default" padding="md">
            <CardHeader>
              <CardTitle>Experience Points</CardTitle>
            </CardHeader>

            <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Base XP</span>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{summary?.baseXp || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Combat Bonus</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>+{summary?.combatXp || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Roleplay Bonus</span>
                <span style={{ color: '#0ea5e9', fontWeight: 600 }}>+{summary?.roleplayXp || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Total XP per Character</span>
                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.25rem' }}>{summary?.totalXp || 0}</span>
              </div>
            </div>
          </Card>

          {/* Loot Summary */}
          <Card variant="default" padding="md">
            <CardHeader>
              <CardTitle>Loot Distributed</CardTitle>
            </CardHeader>

            <List gap="sm" style={{ marginTop: '12px' }}>
              {summary?.loot?.map((item: any) => (
                <ListItem key={item.id} leading={<Gift size={16} style={{ color: item.rarity === 'rare' ? '#8b5cf6' : '#64748b' }} />}>
                  <span>{item.name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '0.8125rem', color: '#64748b' }}>
                    → {item.recipient}
                  </span>
                </ListItem>
              ))}
            </List>
          </Card>
        </div>

        {/* Right Column - Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* MVP Vote */}
          <Card variant="default" padding="md">
            <CardHeader>
              <CardTitle style={{ fontSize: '0.9375rem' }}>
                <Star size={16} style={{ color: '#f59e0b', marginRight: '8px' }} />
                Session MVP
              </CardTitle>
            </CardHeader>

            <List gap="sm" style={{ marginTop: '12px' }}>
              {summary?.players?.map((player: any) => (
                <ListItem
                  key={player.id}
                  leading={<Avatar src={player.imageUrl} name={player.characterName} size="sm" />}
                  style={{ cursor: 'pointer' }}
                >
                  {player.characterName}
                </ListItem>
              ))}
            </List>
          </Card>

          {/* Downtime Preview */}
          <Card variant="default" padding="md">
            <CardHeader>
              <CardTitle style={{ fontSize: '0.9375rem' }}>Downtime Actions</CardTitle>
            </CardHeader>

            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '8px' }}>
              {summary?.downtimeDays || 7} days until next session. Players can queue up to 21 actions.
            </p>
          </Card>

          {/* Complete Button */}
          <Button
            variant="primary"
            size="lg"
            onClick={() => completeMutation.mutate({ sessionId })}
            loading={completeMutation.isPending}
            style={{ width: '100%' }}
          >
            <CheckCircle size={20} />
            Complete Session
          </Button>
        </div>
      </div>
    </ShellContent>
  )
}
