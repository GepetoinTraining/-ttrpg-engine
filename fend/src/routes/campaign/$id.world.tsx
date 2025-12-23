import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, Button, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { List, ListItem, Badge, Input } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { Map, Building, TreePine, Globe, ChevronRight, Plus, Search } from 'lucide-react'

export function CampaignWorld() {
  const { id } = useParams({ from: '/campaign/$id' })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: worldTree } = trpc.world.tree.useQuery({ campaignId: id })
  const { data: nodeDetails } = trpc.world.node.useQuery(
    { nodeId: selectedNode! },
    { enabled: !!selectedNode }
  )

  return (
    <ShellContent>
      <PageHeader
        title="World"
        description="Explore and manage your campaign world"
        actions={
          <Button variant="primary">
            <Plus size={18} />
            Add Location
          </Button>
        }
      />

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: '300px 1fr' }}>
        {/* Hierarchy Navigation */}
        <Card variant="default" padding="sm">
          <div style={{ padding: '8px' }}>
            <Input
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={16} />}
              size="sm"
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            {worldTree?.children?.map((node: any) => (
              <WorldTreeNode
                key={node.id}
                node={node}
                selectedId={selectedNode}
                onSelect={setSelectedNode}
                depth={0}
              />
            ))}
          </div>
        </Card>

        {/* Node Details */}
        <Card variant="default" padding="md">
          {nodeDetails ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <NodeIcon type={nodeDetails.type} />
                <div>
                  <CardTitle>{nodeDetails.name}</CardTitle>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {nodeDetails.type}
                  </span>
                </div>
              </div>

              <Tabs defaultValue="overview">
                <TabList>
                  <Tab value="overview">Overview</Tab>
                  <Tab value="npcs">NPCs</Tab>
                  <Tab value="locations">Locations</Tab>
                  <Tab value="secrets">Secrets</Tab>
                </TabList>

                <TabPanel value="overview">
                  <div style={{ color: '#e2e8f0', lineHeight: 1.6 }}>
                    {nodeDetails.description || 'No description yet.'}
                  </div>
                </TabPanel>

                <TabPanel value="npcs">
                  <List gap="sm">
                    {nodeDetails.npcs?.map((npc: any) => (
                      <ListItem key={npc.id}>
                        {npc.name}
                        <Badge variant="default" style={{ marginLeft: '8px' }}>{npc.role}</Badge>
                      </ListItem>
                    ))}
                  </List>
                </TabPanel>

                <TabPanel value="locations">
                  <List gap="sm">
                    {nodeDetails.children?.map((child: any) => (
                      <ListItem
                        key={child.id}
                        onClick={() => setSelectedNode(child.id)}
                        trailing={<ChevronRight size={16} />}
                      >
                        {child.name}
                      </ListItem>
                    ))}
                  </List>
                </TabPanel>

                <TabPanel value="secrets">
                  <div style={{
                    padding: '24px',
                    background: '#0f172a',
                    borderRadius: '8px',
                    border: '1px dashed #475569',
                    textAlign: 'center',
                    color: '#64748b',
                  }}>
                    GM-only secrets visible here
                  </div>
                </TabPanel>
              </Tabs>
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px',
              color: '#64748b',
            }}>
              <Globe size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Select a location to view details</p>
            </div>
          )}
        </Card>
      </div>
    </ShellContent>
  )
}

function WorldTreeNode({
  node,
  selectedId,
  onSelect,
  depth
}: {
  node: any
  selectedId: string | null
  onSelect: (id: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children?.length > 0
  const isSelected = node.id === selectedId

  return (
    <div>
      <ListItem
        onClick={() => onSelect(node.id)}
        style={{
          paddingLeft: `${12 + depth * 16}px`,
          background: isSelected ? 'rgba(245, 158, 11, 0.1)' : undefined,
        }}
        leading={
          hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
            >
              <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
            </button>
          ) : (
            <span style={{ width: '18px' }} />
          )
        }
      >
        <span style={{ fontSize: '0.875rem', color: isSelected ? '#f59e0b' : '#e2e8f0' }}>
          {node.name}
        </span>
      </ListItem>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child: any) => (
            <WorldTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NodeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    world: <Globe size={24} style={{ color: '#8b5cf6' }} />,
    continent: <Map size={24} style={{ color: '#22c55e' }} />,
    region: <TreePine size={24} style={{ color: '#22c55e' }} />,
    settlement: <Building size={24} style={{ color: '#f59e0b' }} />,
    building: <Building size={24} style={{ color: '#94a3b8' }} />,
  }
  return icons[type] || <Map size={24} style={{ color: '#64748b' }} />
}
