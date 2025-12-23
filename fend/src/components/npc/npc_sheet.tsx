import { Card, CardTitle, Badge, Avatar, Button } from '@styles/processors/_internal'
import { List, ListItem, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { StatBlock } from '@components/character/stat_block'
import { Heart, Shield, Zap, Swords, BookOpen, Clock, Edit } from 'lucide-react'

export interface NpcSheetProps {
  npc: {
    id: string
    name: string
    role?: string
    imageUrl?: string
    depth: number

    // Core stats
    size: string
    type: string
    alignment: string
    ac: number
    hp: { current: number; max: number }
    speed: string

    // Abilities
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number

    // Details
    savingThrows?: string[]
    skills?: string[]
    vulnerabilities?: string[]
    resistances?: string[]
    immunities?: string[]
    senses?: string[]
    languages?: string[]
    cr?: string

    // Features
    traits?: Array<{ name: string; description: string }>
    actions?: Array<{ name: string; description: string }>
    reactions?: Array<{ name: string; description: string }>
    legendaryActions?: Array<{ name: string; description: string }>

    // Meta
    notes?: string
    createdAt?: string
    lastUsed?: string
  }
  isGM: boolean
  onEdit?: () => void
  onClose?: () => void
}

const DEPTH_COLORS = ['#22c55e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899']

export function NpcSheet({ npc, isGM, onEdit, onClose }: NpcSheetProps) {
  const depthColor = DEPTH_COLORS[npc.depth] || DEPTH_COLORS[0]

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <Card variant="default" padding="lg" style={{ marginBottom: '16px', borderTop: `3px solid ${depthColor}` }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Avatar
            src={npc.imageUrl}
            name={npc.name}
            size="xl"
            style={{ width: 100, height: 100, border: `3px solid ${depthColor}` }}
          />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <CardTitle style={{ fontSize: '1.5rem' }}>{npc.name}</CardTitle>
              <Badge variant="default" style={{ color: depthColor, borderColor: depthColor }}>
                D{npc.depth}
              </Badge>
              {npc.cr && <Badge variant="warning">CR {npc.cr}</Badge>}
            </div>

            <div style={{ color: '#94a3b8', fontSize: '0.9375rem', marginBottom: '12px' }}>
              {npc.size} {npc.type}, {npc.alignment}
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
              <Stat icon={<Shield size={16} />} label="AC" value={npc.ac} />
              <Stat
                icon={<Heart size={16} style={{ color: '#ef4444' }} />}
                label="HP"
                value={`${npc.hp.current}/${npc.hp.max}`}
              />
              <Stat icon={<Zap size={16} />} label="Speed" value={npc.speed} />
            </div>
          </div>

          {isGM && onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit size={16} />
            </Button>
          )}
        </div>
      </Card>

      {/* Stats */}
      <Card variant="default" padding="md" style={{ marginBottom: '16px' }}>
        <StatBlock
          stats={{
            str: npc.str,
            dex: npc.dex,
            con: npc.con,
            int: npc.int,
            wis: npc.wis,
            cha: npc.cha,
          }}
        />
      </Card>

      {/* Details */}
      <Card variant="default" padding="md" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
          {npc.savingThrows && npc.savingThrows.length > 0 && (
            <DetailRow label="Saving Throws" value={npc.savingThrows.join(', ')} />
          )}
          {npc.skills && npc.skills.length > 0 && (
            <DetailRow label="Skills" value={npc.skills.join(', ')} />
          )}
          {npc.vulnerabilities && npc.vulnerabilities.length > 0 && (
            <DetailRow label="Vulnerabilities" value={npc.vulnerabilities.join(', ')} color="#ef4444" />
          )}
          {npc.resistances && npc.resistances.length > 0 && (
            <DetailRow label="Resistances" value={npc.resistances.join(', ')} />
          )}
          {npc.immunities && npc.immunities.length > 0 && (
            <DetailRow label="Immunities" value={npc.immunities.join(', ')} />
          )}
          {npc.senses && npc.senses.length > 0 && (
            <DetailRow label="Senses" value={npc.senses.join(', ')} />
          )}
          {npc.languages && npc.languages.length > 0 && (
            <DetailRow label="Languages" value={npc.languages.join(', ')} />
          )}
        </div>
      </Card>

      {/* Abilities Tabs */}
      <Card variant="default" padding="md">
        <Tabs defaultValue="traits">
          <TabList>
            {npc.traits && npc.traits.length > 0 && <Tab value="traits">Traits</Tab>}
            {npc.actions && npc.actions.length > 0 && <Tab value="actions">Actions</Tab>}
            {npc.reactions && npc.reactions.length > 0 && <Tab value="reactions">Reactions</Tab>}
            {npc.legendaryActions && npc.legendaryActions.length > 0 && <Tab value="legendary">Legendary</Tab>}
          </TabList>

          {npc.traits && (
            <TabPanel value="traits">
              <AbilityList items={npc.traits} />
            </TabPanel>
          )}
          {npc.actions && (
            <TabPanel value="actions">
              <AbilityList items={npc.actions} />
            </TabPanel>
          )}
          {npc.reactions && (
            <TabPanel value="reactions">
              <AbilityList items={npc.reactions} />
            </TabPanel>
          )}
          {npc.legendaryActions && (
            <TabPanel value="legendary">
              <AbilityList items={npc.legendaryActions} />
            </TabPanel>
          )}
        </Tabs>
      </Card>

      {/* GM Notes */}
      {isGM && npc.notes && (
        <Card variant="default" padding="md" style={{ marginTop: '16px', background: 'rgba(139,92,246,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BookOpen size={16} style={{ color: '#c4b5fd' }} />
            <span style={{ fontWeight: 600, color: '#c4b5fd' }}>GM Notes</span>
          </div>
          <div style={{ color: '#e2e8f0', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
            {npc.notes}
          </div>
        </Card>
      )}

      {/* Meta */}
      {(npc.createdAt || npc.lastUsed) && (
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginTop: '16px',
          fontSize: '0.75rem',
          color: '#475569',
        }}>
          {npc.createdAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Created: {new Date(npc.createdAt).toLocaleDateString()}
            </span>
          )}
          {npc.lastUsed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Swords size={12} /> Last used: {new Date(npc.lastUsed).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {icon}
      <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{value}</span>
    </div>
  )
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span style={{ fontWeight: 600, color: '#94a3b8' }}>{label}: </span>
      <span style={{ color: color || '#e2e8f0' }}>{value}</span>
    </div>
  )
}

function AbilityList({ items }: { items: Array<{ name: string; description: string }> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
            {item.name}
          </div>
          <div style={{ color: '#e2e8f0', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {item.description}
          </div>
        </div>
      ))}
    </div>
  )
}
