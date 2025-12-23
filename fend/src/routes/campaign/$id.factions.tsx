import { useParams } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, CardHeader, Button, Badge, Avatar } from '@styles/processors/_internal'
import { List, ListItem } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { Plus, TrendingUp, TrendingDown, Minus, Users, Target, Handshake, Swords } from 'lucide-react'

export function CampaignFactions() {
  const { id } = useParams({ from: '/campaign/$id' })
  const { data: factions } = trpc.faction.list.useQuery({ campaignId: id })

  return (
    <ShellContent>
      <PageHeader
        title="Factions"
        description="Power groups and their relationships"
        actions={
          <Button variant="primary">
            <Plus size={18} />
            Add Faction
          </Button>
        }
      />

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {factions?.map((faction: any) => (
          <FactionCard key={faction.id} faction={faction} />
        ))}
      </div>
    </ShellContent>
  )
}

function FactionCard({ faction }: { faction: any }) {
  return (
    <Card variant="default" padding="md">
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: faction.color || '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Users size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <CardTitle style={{ fontSize: '1rem' }}>{faction.name}</CardTitle>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>{faction.type}</span>
          </div>
        </div>
        <RelationBadge relation={faction.playerRelation} />
      </CardHeader>

      <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '12px 0', lineHeight: 1.5 }}>
        {faction.description}
      </p>

      {/* Power Level */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Power</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{faction.power}/100</span>
        </div>
        <div style={{ height: '4px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: `${faction.power}%`,
            height: '100%',
            background: '#f59e0b',
          }} />
        </div>
      </div>

      {/* Goals */}
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <Target size={12} /> Current Goals
        </span>
        <List gap="none">
          {faction.goals?.slice(0, 2).map((goal: any, i: number) => (
            <ListItem key={i} style={{ padding: '4px 0' }}>
              <span style={{ fontSize: '0.8125rem' }}>• {goal}</span>
            </ListItem>
          ))}
        </List>
      </div>

      {/* Key Members */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingTop: '12px',
        borderTop: '1px solid #1e293b',
      }}>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Key members:</span>
        <div style={{ display: 'flex', marginLeft: 'auto' }}>
          {faction.keyMembers?.slice(0, 4).map((member: any, i: number) => (
            <Avatar
              key={member.id}
              src={member.imageUrl}
              name={member.name}
              size="xs"
              style={{ marginLeft: i > 0 ? '-8px' : 0, border: '2px solid #1e293b' }}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}

function RelationBadge({ relation }: { relation: number }) {
  let variant: 'success' | 'warning' | 'error' | 'default' = 'default'
  let icon = <Minus size={12} />
  let label = 'Neutral'

  if (relation > 50) {
    variant = 'success'
    icon = <Handshake size={12} />
    label = 'Allied'
  } else if (relation > 20) {
    variant = 'info'
    icon = <TrendingUp size={12} />
    label = 'Friendly'
  } else if (relation < -50) {
    variant = 'error'
    icon = <Swords size={12} />
    label = 'Hostile'
  } else if (relation < -20) {
    variant = 'warning'
    icon = <TrendingDown size={12} />
    label = 'Unfriendly'
  }

  return (
    <Badge variant={variant} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {icon} {label}
    </Badge>
  )
}
