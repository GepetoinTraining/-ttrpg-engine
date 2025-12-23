import { Card, CardTitle, Badge, Button } from '@styles/processors/_internal'
import { List, ListItem, Avatar } from '@styles/processors/_internal'
import { MapPin, Users, Scroll, Eye, EyeOff, ChevronRight, Building, Trees, Mountain } from 'lucide-react'

export interface WorldNode {
  id: string
  name: string
  type: 'world' | 'continent' | 'region' | 'settlement' | 'district' | 'location'
  description: string
  imageUrl?: string
  population?: number
  climate?: string
  terrain?: string
  government?: string
  notableNpcs?: Array<{ id: string; name: string; role?: string; imageUrl?: string }>
  children?: Array<{ id: string; name: string; type: string }>
  secrets?: string[]
  connectedLocations?: Array<{ id: string; name: string; travelTime?: string }>
}

export interface NodeCardProps {
  node: WorldNode
  isGM: boolean
  onNavigateToChild?: (childId: string) => void
  onNavigateToNpc?: (npcId: string) => void
  onEdit?: () => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  world: <Mountain size={20} style={{ color: '#8b5cf6' }} />,
  continent: <Mountain size={20} style={{ color: '#22c55e' }} />,
  region: <Trees size={20} style={{ color: '#22c55e' }} />,
  settlement: <Building size={20} style={{ color: '#f59e0b' }} />,
  district: <Building size={20} style={{ color: '#0ea5e9' }} />,
  location: <MapPin size={20} style={{ color: '#ef4444' }} />,
}

export function NodeCard({
  node,
  isGM,
  onNavigateToChild,
  onNavigateToNpc,
  onEdit,
}: NodeCardProps) {
  return (
    <Card variant="default" padding="lg">
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        {node.imageUrl ? (
          <img
            src={node.imageUrl}
            alt={node.name}
            style={{
              width: 120,
              height: 80,
              objectFit: 'cover',
              borderRadius: '8px',
            }}
          />
        ) : (
          <div style={{
            width: 120,
            height: 80,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {TYPE_ICONS[node.type]}
          </div>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {TYPE_ICONS[node.type]}
            <CardTitle>{node.name}</CardTitle>
          </div>

          <Badge variant="default" style={{ textTransform: 'capitalize' }}>
            {node.type}
          </Badge>

          {/* Quick stats */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '12px',
            fontSize: '0.8125rem',
            color: '#64748b',
          }}>
            {node.population && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={12} /> {formatPopulation(node.population)}
              </span>
            )}
            {node.terrain && (
              <span>{node.terrain}</span>
            )}
            {node.climate && (
              <span>{node.climate}</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{
        color: '#e2e8f0',
        lineHeight: 1.6,
        marginBottom: '16px',
        whiteSpace: 'pre-wrap',
      }}>
        {node.description}
      </div>

      {/* Government */}
      {node.government && (
        <div style={{
          padding: '12px',
          background: '#1e293b',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.875rem',
        }}>
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>Government: </span>
          <span style={{ color: '#e2e8f0' }}>{node.government}</span>
        </div>
      )}

      {/* Notable NPCs */}
      {node.notableNpcs && node.notableNpcs.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#94a3b8',
            marginBottom: '8px',
          }}>
            NOTABLE FIGURES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {node.notableNpcs.map(npc => (
              <button
                key={npc.id}
                onClick={() => onNavigateToNpc?.(npc.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '20px',
                  cursor: 'pointer',
                }}
              >
                <Avatar src={npc.imageUrl} name={npc.name} size="xs" />
                <span style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>{npc.name}</span>
                {npc.role && (
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({npc.role})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Child Locations */}
      {node.children && node.children.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#94a3b8',
            marginBottom: '8px',
          }}>
            LOCATIONS
          </div>
          <List gap="xs">
            {node.children.map(child => (
              <ListItem
                key={child.id}
                leading={TYPE_ICONS[child.type] || <MapPin size={14} />}
                trailing={<ChevronRight size={14} style={{ color: '#475569' }} />}
                onClick={() => onNavigateToChild?.(child.id)}
                style={{ cursor: 'pointer' }}
              >
                {child.name}
              </ListItem>
            ))}
          </List>
        </div>
      )}

      {/* Connected Locations */}
      {node.connectedLocations && node.connectedLocations.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#94a3b8',
            marginBottom: '8px',
          }}>
            CONNECTED TO
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {node.connectedLocations.map(loc => (
              <Badge key={loc.id} variant="default">
                {loc.name}
                {loc.travelTime && <span style={{ color: '#64748b', marginLeft: '4px' }}>({loc.travelTime})</span>}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* GM Secrets */}
      {isGM && node.secrets && node.secrets.length > 0 && (
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
            {node.secrets.map((secret, i) => (
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

function formatPopulation(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`
  if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`
  return pop.toString()
}
