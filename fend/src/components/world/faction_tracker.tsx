import { useState } from 'react'
import { Card, CardTitle, Badge, Button, Avatar } from '@styles/processors/_internal'
import { List, ListItem } from '@styles/processors/_internal'
import { Users, TrendingUp, TrendingDown, Minus, Target, Swords, Heart, Handshake, Eye } from 'lucide-react'

export interface Faction {
  id: string
  name: string
  type: 'guild' | 'noble' | 'religious' | 'criminal' | 'military' | 'merchant' | 'arcane'
  imageUrl?: string
  description: string
  power: number // 1-10
  powerTrend: 'rising' | 'stable' | 'falling'
  goals: string[]
  leader?: {
    id: string
    name: string
    title: string
    imageUrl?: string
  }
  relationships: Array<{
    factionId: string
    factionName: string
    type: 'allied' | 'friendly' | 'neutral' | 'rival' | 'hostile'
  }>
  secrets?: string[]
  resources?: string[]
  territory?: string[]
}

export interface FactionTrackerProps {
  factions: Faction[]
  isGM: boolean
  onSelectFaction?: (factionId: string) => void
  onNavigateToNpc?: (npcId: string) => void
}

const TYPE_COLORS: Record<string, string> = {
  guild: '#f59e0b',
  noble: '#8b5cf6',
  religious: '#0ea5e9',
  criminal: '#ef4444',
  military: '#64748b',
  merchant: '#22c55e',
  arcane: '#ec4899',
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  allied: '#22c55e',
  friendly: '#0ea5e9',
  neutral: '#64748b',
  rival: '#f59e0b',
  hostile: '#ef4444',
}

export function FactionTracker({
  factions,
  isGM,
  onSelectFaction,
  onNavigateToNpc,
}: FactionTrackerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list')

  const selectedFaction = factions.find(f => f.id === selectedId)

  // Sort by power
  const sortedFactions = [...factions].sort((a, b) => b.power - a.power)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedFaction ? '1fr 1fr' : '1fr', gap: '16px' }}>
      {/* Faction List */}
      <Card variant="default" padding="md">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <CardTitle style={{ fontSize: '1rem' }}>Factions</CardTitle>
          <Badge variant="default">{factions.length}</Badge>
        </div>

        <List gap="sm">
          {sortedFactions.map(faction => (
            <FactionListItem
              key={faction.id}
              faction={faction}
              isSelected={selectedId === faction.id}
              onClick={() => {
                setSelectedId(selectedId === faction.id ? null : faction.id)
                onSelectFaction?.(faction.id)
              }}
            />
          ))}
        </List>
      </Card>

      {/* Selected Faction Detail */}
      {selectedFaction && (
        <FactionDetail
          faction={selectedFaction}
          isGM={isGM}
          allFactions={factions}
          onNavigateToNpc={onNavigateToNpc}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function FactionListItem({
  faction,
  isSelected,
  onClick,
}: {
  faction: Faction
  isSelected: boolean
  onClick: () => void
}) {
  const color = TYPE_COLORS[faction.type] || '#64748b'

  return (
    <ListItem
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        border: isSelected ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
        borderRadius: '8px',
        padding: '12px',
      }}
      leading={
        faction.imageUrl ? (
          <Avatar src={faction.imageUrl} name={faction.name} size="md" />
        ) : (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            background: `${color}20`,
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Users size={18} style={{ color }} />
          </div>
        )
      }
      trailing={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PowerBar power={faction.power} />
          {faction.powerTrend === 'rising' && <TrendingUp size={14} style={{ color: '#22c55e' }} />}
          {faction.powerTrend === 'falling' && <TrendingDown size={14} style={{ color: '#ef4444' }} />}
          {faction.powerTrend === 'stable' && <Minus size={14} style={{ color: '#64748b' }} />}
        </div>
      }
    >
      <div>
        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{faction.name}</div>
        <div style={{ fontSize: '0.75rem', color: color, textTransform: 'capitalize' }}>
          {faction.type}
        </div>
      </div>
    </ListItem>
  )
}

function FactionDetail({
  faction,
  isGM,
  allFactions,
  onNavigateToNpc,
  onClose,
}: {
  faction: Faction
  isGM: boolean
  allFactions: Faction[]
  onNavigateToNpc?: (npcId: string) => void
  onClose: () => void
}) {
  const color = TYPE_COLORS[faction.type] || '#64748b'

  return (
    <Card variant="default" padding="lg" style={{ borderTop: `3px solid ${color}` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        {faction.imageUrl ? (
          <Avatar src={faction.imageUrl} name={faction.name} size="xl" />
        ) : (
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '12px',
            background: `${color}20`,
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Users size={28} style={{ color }} />
          </div>
        )}

        <div style={{ flex: 1 }}>
          <CardTitle>{faction.name}</CardTitle>
          <Badge variant="default" style={{ color, borderColor: color, textTransform: 'capitalize' }}>
            {faction.type}
          </Badge>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Power:</span>
            <PowerBar power={faction.power} showLabel />
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ color: '#e2e8f0', lineHeight: 1.6, marginBottom: '16px' }}>
        {faction.description}
      </p>

      {/* Leader */}
      {faction.leader && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
            LEADER
          </div>
          <button
            onClick={() => faction.leader?.id && onNavigateToNpc?.(faction.leader.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Avatar src={faction.leader.imageUrl} name={faction.leader.name} size="sm" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500, color: '#e2e8f0' }}>{faction.leader.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{faction.leader.title}</div>
            </div>
          </button>
        </div>
      )}

      {/* Goals */}
      {faction.goals.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#94a3b8',
            marginBottom: '8px'
          }}>
            <Target size={12} /> GOALS
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {faction.goals.map((goal, i) => (
              <li key={i} style={{ color: '#e2e8f0', fontSize: '0.875rem', marginBottom: '4px' }}>
                {goal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relationships */}
      {faction.relationships.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
            RELATIONSHIPS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {faction.relationships.map(rel => (
              <Badge
                key={rel.factionId}
                variant="default"
                style={{
                  color: RELATIONSHIP_COLORS[rel.type],
                  borderColor: RELATIONSHIP_COLORS[rel.type],
                }}
              >
                {getRelationshipIcon(rel.type)}
                {rel.factionName}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* GM Secrets */}
      {isGM && faction.secrets && faction.secrets.length > 0 && (
        <div style={{
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#c4b5fd',
            marginBottom: '8px',
          }}>
            <Eye size={12} /> GM SECRETS
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {faction.secrets.map((secret, i) => (
              <li key={i} style={{ color: '#e2e8f0', fontSize: '0.875rem', marginBottom: '4px' }}>
                {secret}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function PowerBar({ power, showLabel = false }: { power: number; showLabel?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        display: 'flex',
        gap: '2px',
      }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '12px',
              borderRadius: '2px',
              background: i < power ? getPowerColor(power) : '#1e293b',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span style={{ fontSize: '0.8125rem', color: getPowerColor(power), fontWeight: 600 }}>
          {power}/10
        </span>
      )}
    </div>
  )
}

function getPowerColor(power: number): string {
  if (power >= 8) return '#f59e0b'
  if (power >= 5) return '#22c55e'
  if (power >= 3) return '#0ea5e9'
  return '#64748b'
}

function getRelationshipIcon(type: string): React.ReactNode {
  switch (type) {
    case 'allied': return <Handshake size={10} style={{ marginRight: '4px' }} />
    case 'friendly': return <Heart size={10} style={{ marginRight: '4px' }} />
    case 'hostile': return <Swords size={10} style={{ marginRight: '4px' }} />
    case 'rival': return <Target size={10} style={{ marginRight: '4px' }} />
    default: return null
  }
}
