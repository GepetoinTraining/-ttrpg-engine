import { useParams } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, CardHeader, Button, Badge } from '@styles/processors/_internal'
import { List, ListItem, Avatar, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'
import { Check, X, Clock, Zap, BookOpen, Coins, Hammer, Users } from 'lucide-react'

export function DowntimeGM() {
  const { id } = useParams({ from: '/campaign/$id' })

  const { data: pending } = trpc.downtime.pending.useQuery({ campaignId: id })
  const { data: resolved } = trpc.downtime.resolved.useQuery({ campaignId: id })

  const resolveMutation = trpc.downtime.resolve.useMutation({
    onSuccess: () => {
      toast.success('Action resolved!')
    },
  })

  return (
    <ShellContent>
      <PageHeader
        title="Downtime Actions"
        description="Review and resolve player actions between sessions"
      />

      <Tabs defaultValue="pending">
        <TabList>
          <Tab value="pending">
            Pending
            {pending?.length > 0 && (
              <Badge variant="warning" style={{ marginLeft: '8px' }}>{pending.length}</Badge>
            )}
          </Tab>
          <Tab value="resolved">Resolved</Tab>
          <Tab value="simulation">World Simulation</Tab>
        </TabList>

        <TabPanel value="pending">
          <div style={{ display: 'grid', gap: '16px' }}>
            {pending?.map((action: any) => (
              <DowntimeActionCard
                key={action.id}
                action={action}
                onApprove={() => resolveMutation.mutate({ actionId: action.id, outcome: 'success' })}
                onReject={() => resolveMutation.mutate({ actionId: action.id, outcome: 'failure' })}
              />
            ))}

            {!pending?.length && (
              <Card variant="default" padding="lg" style={{ textAlign: 'center' }}>
                <Clock size={48} style={{ color: '#475569', marginBottom: '16px' }} />
                <p style={{ color: '#64748b' }}>No pending actions</p>
              </Card>
            )}
          </div>
        </TabPanel>

        <TabPanel value="resolved">
          <List gap="sm">
            {resolved?.map((action: any) => (
              <ListItem
                key={action.id}
                leading={<Avatar name={action.characterName} size="sm" />}
                trailing={
                  <Badge variant={action.outcome === 'success' ? 'success' : 'error'}>
                    {action.outcome}
                  </Badge>
                }
              >
                <div>
                  <span style={{ fontWeight: 500 }}>{action.characterName}</span>
                  <span style={{ color: '#64748b', marginLeft: '8px' }}>{action.type}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                  {action.description}
                </div>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value="simulation">
          <Card variant="default" padding="lg">
            <CardTitle>World Simulation</CardTitle>
            <p style={{ color: '#94a3b8', marginTop: '12px' }}>
              Run faction AI, economy simulation, and world events between sessions.
            </p>
            <Button variant="primary" style={{ marginTop: '16px' }}>
              Run Simulation
            </Button>
          </Card>
        </TabPanel>
      </Tabs>
    </ShellContent>
  )
}

function DowntimeActionCard({ action, onApprove, onReject }: { action: any; onApprove: () => void; onReject: () => void }) {
  const typeIcons: Record<string, React.ReactNode> = {
    training: <Zap size={20} style={{ color: '#f59e0b' }} />,
    research: <BookOpen size={20} style={{ color: '#0ea5e9' }} />,
    crafting: <Hammer size={20} style={{ color: '#22c55e' }} />,
    earning: <Coins size={20} style={{ color: '#f59e0b' }} />,
    socializing: <Users size={20} style={{ color: '#8b5cf6' }} />,
  }

  return (
    <Card variant="default" padding="md">
      <div style={{ display: 'flex', gap: '16px' }}>
        <Avatar src={action.character?.imageUrl} name={action.characterName} size="lg" />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>{action.characterName}</span>
            <Badge variant="default" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {typeIcons[action.type]}
              {action.type}
            </Badge>
          </div>

          <p style={{ color: '#e2e8f0', margin: '8px 0', lineHeight: 1.5 }}>
            {action.description}
          </p>

          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Day {action.day} • Requested by {action.player?.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button variant="primary" size="sm" onClick={onApprove}>
            <Check size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onReject}>
            <X size={16} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
