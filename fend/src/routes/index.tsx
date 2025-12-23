import { ShellContent, PageHeader, Card, CardTitle, Button, Badge, List, ListItem, ListEmpty } from '@styles/processors/_internal'
import { Avatar, Spinner } from '@styles/processors/_internal'
import { RequireAuth } from '@auth/guards'
import { trpc } from '@api/trpc'
import { Plus, Users, Calendar, ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export function IndexPage() {
  return (
    <RequireAuth>
      <CampaignListContent />
    </RequireAuth>
  )
}

function CampaignListContent() {
  const navigate = useNavigate()
  const { data: campaigns, isLoading } = trpc.campaign.list.useQuery()

  return (
    <ShellContent>
      <PageHeader
        title="Your Campaigns"
        description="Manage your tabletop adventures"
        actions={
          <Button variant="primary" onClick={() => navigate({ to: '/campaign/new' })}>
            <Plus size={18} />
            New Campaign
          </Button>
        }
      />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Spinner size="lg" label="Loading campaigns..." />
        </div>
      ) : !campaigns?.length ? (
        <Card variant="default" padding="lg">
          <ListEmpty>
            <div style={{ marginBottom: '16px' }}>
              <Swords size={48} style={{ color: '#475569' }} />
            </div>
            <p style={{ margin: '0 0 16px' }}>No campaigns yet</p>
            <Button variant="primary" onClick={() => navigate({ to: '/campaign/new' })}>
              Create Your First Campaign
            </Button>
          </ListEmpty>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </ShellContent>
  )
}

function CampaignCard({ campaign }: { campaign: any }) {
  const navigate = useNavigate()

  return (
    <Card
      variant="default"
      padding="md"
      style={{ cursor: 'pointer' }}
      onClick={() => navigate({ to: '/campaign/$id', params: { id: campaign.id } })}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <CardTitle>{campaign.name}</CardTitle>
        <Badge variant={campaign.status === 'active' ? 'success' : 'default'}>
          {campaign.status}
        </Badge>
      </div>

      {campaign.description && (
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
          {campaign.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8125rem', color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={14} />
          {campaign.memberCount} players
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} />
          {campaign.sessionCount} sessions
        </span>
      </div>
    </Card>
  )
}

// Import for empty state icon
import { Swords } from 'lucide-react'
