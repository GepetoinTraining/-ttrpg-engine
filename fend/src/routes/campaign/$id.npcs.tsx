import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, Button, Badge, Avatar, Input, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { List, ListItem, Modal, useModal } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { Plus, Search, Skull, User, Star, Eye, EyeOff } from 'lucide-react'

export function CampaignNpcs() {
  const { id } = useParams({ from: '/campaign/$id' })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'known' | 'hidden'>('all')

  const { data: npcs } = trpc.npc.list.useQuery({ campaignId: id })
  const quickGenModal = useModal()

  const filteredNpcs = npcs?.filter((npc: any) => {
    const matchesSearch = npc.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' ||
      (filter === 'known' && npc.knownToPlayers) ||
      (filter === 'hidden' && !npc.knownToPlayers)
    return matchesSearch && matchesFilter
  })

  return (
    <ShellContent>
      <PageHeader
        title="NPCs"
        description="Non-player characters in your world"
        actions={
          <Button variant="primary" onClick={quickGenModal.openModal}>
            <Plus size={18} />
            Quick Generate
          </Button>
        }
      />

      <Card variant="default" padding="md">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <Input
            placeholder="Search NPCs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            style={{ flex: 1 }}
          />

          <Tabs value={filter} onChange={(v) => setFilter(v as any)}>
            <TabList>
              <Tab value="all">All</Tab>
              <Tab value="known">Known</Tab>
              <Tab value="hidden">Hidden</Tab>
            </TabList>
          </Tabs>
        </div>

        <List gap="sm">
          {filteredNpcs?.map((npc: any) => (
            <ListItem
              key={npc.id}
              leading={
                <Avatar
                  src={npc.imageUrl}
                  name={npc.name}
                  size="md"
                />
              }
              trailing={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DepthIndicator depth={npc.depth} />
                  {npc.knownToPlayers ? (
                    <Eye size={16} style={{ color: '#22c55e' }} />
                  ) : (
                    <EyeOff size={16} style={{ color: '#64748b' }} />
                  )}
                </div>
              }
            >
              <div>
                <span style={{ fontWeight: 500 }}>{npc.name}</span>
                {npc.isImportant && <Star size={12} style={{ color: '#f59e0b', marginLeft: '6px' }} />}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                {npc.role} • {npc.location}
              </div>
            </ListItem>
          ))}
        </List>

        {!filteredNpcs?.length && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <Skull size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>No NPCs found</p>
          </div>
        )}
      </Card>

      <Modal open={quickGenModal.open} onClose={quickGenModal.closeModal} title="Quick Generate NPC" size="md">
        <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
          Describe the NPC you want to create...
        </p>
        {/* AI generation form would go here */}
      </Modal>
    </ShellContent>
  )
}

function DepthIndicator({ depth }: { depth: number }) {
  const colors = ['#64748b', '#22c55e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444']
  const labels = ['Surface', 'Hook', 'Investigation', 'Mini-Quest', 'Resolution', 'Side-Arc']

  return (
    <Badge
      variant="default"
      style={{
        background: `${colors[depth]}20`,
        borderColor: colors[depth],
        color: colors[depth],
      }}
    >
      D{depth}: {labels[depth]}
    </Badge>
  )
}
