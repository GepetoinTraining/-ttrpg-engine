import { useParams, useNavigate } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, CardHeader, Button, Badge, List, ListItem } from '@styles/processors/_internal'
import { Avatar } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { Play, Plus, Clock, Users, Scroll, AlertCircle } from 'lucide-react'

export function CampaignDashboard() {
  const { id } = useParams({ from: '/campaign/$id' })
  const navigate = useNavigate()

  const { data: campaign } = trpc.campaign.get.useQuery({ id })
  const { data: recentSessions } = trpc.session.listRecent.useQuery({ campaignId: id, limit: 5 })
  const { data: pendingDowntime } = trpc.downtime.pending.useQuery({ campaignId: id })

  return (
    <ShellContent>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, Game Master`}
        actions={
          <Button
            variant="primary"
            onClick={() => navigate({ to: '/campaign/$id/session/new', params: { id } })}
          >
            <Play size={18} />
            Start Session
          </Button>
        }
      />

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Quick Stats */}
        <Card variant="default" padding="md">
          <CardHeader>
            <CardTitle>Campaign Stats</CardTitle>
          </CardHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
            <StatBox icon={<Users size={20} />} label="Players" value={campaign?.memberCount || 0} />
            <StatBox icon={<Scroll size={20} />} label="Sessions" value={campaign?.sessionCount || 0} />
            <StatBox icon={<Clock size={20} />} label="Hours Played" value={campaign?.totalHours || 0} />
            <StatBox icon={<AlertCircle size={20} />} label="Active Quests" value={campaign?.activeQuests || 0} />
          </div>
        </Card>

        {/* Pending Downtime */}
        <Card variant="default" padding="md">
          <CardHeader>
            <CardTitle>Pending Downtime</CardTitle>
            <Badge variant={pendingDowntime?.length ? 'warning' : 'default'}>
              {pendingDowntime?.length || 0}
            </Badge>
          </CardHeader>

          {pendingDowntime?.length ? (
            <List gap="sm" style={{ marginTop: '12px' }}>
              {pendingDowntime.slice(0, 4).map((action: any) => (
                <ListItem key={action.id} leading={<Avatar name={action.characterName} size="xs" />}>
                  <span style={{ fontSize: '0.875rem' }}>{action.characterName}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>
                    {action.actionType}
                  </span>
                </ListItem>
              ))}
            </List>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '12px' }}>
              No pending actions
            </p>
          )}

          {(pendingDowntime?.length || 0) > 0 && (
            <Button
              variant="ghost"
              style={{ marginTop: '12px', width: '100%' }}
              onClick={() => navigate({ to: '/campaign/$id/downtime', params: { id } })}
            >
              Review All
            </Button>
          )}
        </Card>

        {/* Recent Sessions */}
        <Card variant="default" padding="md" style={{ gridColumn: 'span 2' }}>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <Button variant="ghost" onClick={() => navigate({ to: '/campaign/$id/sessions', params: { id } })}>
              View All
            </Button>
          </CardHeader>

          {recentSessions?.length ? (
            <List gap="sm" style={{ marginTop: '12px' }}>
              {recentSessions.map((session: any) => (
                <ListItem
                  key={session.id}
                  onClick={() => navigate({
                    to: '/campaign/$id/session/$sessionId',
                    params: { id, sessionId: session.id }
                  })}
                  trailing={
                    <Badge variant={session.status === 'completed' ? 'success' : 'info'}>
                      {session.status}
                    </Badge>
                  }
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>Session {session.number}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                  {session.title && (
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                      {session.title}
                    </div>
                  )}
                </ListItem>
              ))}
            </List>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '12px' }}>
              No sessions yet. Start your first adventure!
            </p>
          )}
        </Card>
      </div>
    </ShellContent>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      background: '#0f172a',
      borderRadius: '8px',
    }}>
      <span style={{ color: '#f59e0b' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</div>
      </div>
    </div>
  )
}
