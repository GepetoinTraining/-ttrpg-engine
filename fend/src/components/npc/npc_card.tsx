import { Card, CardTitle, Badge, Avatar, Button } from '@styles/processors/_internal'
import { MapPin, Users, Eye, EyeOff, MessageCircle, FileText, ChevronDown } from 'lucide-react'

export interface NpcCardProps {
  npc: {
    id: string
    name: string
    role?: string
    description: string
    imageUrl?: string
    depth: number
    isKnown: boolean
    location?: string
    faction?: string
    disposition?: 'friendly' | 'neutral' | 'hostile' | 'unknown'
    secrets?: string[]
    connections?: Array<{ id: string; name: string; relationship: string }>
  }
  isGM: boolean
  onChat?: () => void
  onViewSheet?: () => void
  onToggleKnown?: () => void
  onDeepen?: () => void
}

const DEPTH_COLORS = ['#22c55e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899']
const DISPOSITION_COLORS = {
  friendly: '#22c55e',
  neutral: '#64748b',
  hostile: '#ef4444',
  unknown: '#8b5cf6',
}

export function NpcCard({
  npc,
  isGM,
  onChat,
  onViewSheet,
  onToggleKnown,
  onDeepen,
}: NpcCardProps) {
  const depthColor = DEPTH_COLORS[npc.depth] || DEPTH_COLORS[0]

  return (
    <Card
      variant="default"
      padding="lg"
      style={{ borderTop: `3px solid ${depthColor}` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <Avatar
          src={npc.imageUrl}
          name={npc.name}
          size="xl"
          style={{ border: `3px solid ${depthColor}` }}
        />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CardTitle>{npc.name}</CardTitle>
            <Badge variant="default" style={{ color: depthColor, borderColor: depthColor }}>
              D{npc.depth}
            </Badge>
            {npc.disposition && (
              <Badge
                variant="default"
                style={{
                  color: DISPOSITION_COLORS[npc.disposition],
                  borderColor: DISPOSITION_COLORS[npc.disposition],
                }}
              >
                {npc.disposition}
              </Badge>
            )}
          </div>

          {npc.role && (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
              {npc.role}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8125rem', color: '#64748b' }}>
            {npc.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {npc.location}
              </span>
            )}
            {npc.faction && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={12} /> {npc.faction}
              </span>
            )}
          </div>
        </div>

        {isGM && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleKnown}
            title={npc.isKnown ? 'Hide from players' : 'Reveal to players'}
          >
            {npc.isKnown ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
        )}
      </div>

      {/* Description */}
      <div style={{
        color: '#e2e8f0',
        lineHeight: 1.6,
        marginBottom: '16px',
        whiteSpace: 'pre-wrap',
      }}>
        {npc.description}
      </div>

      {/* GM Secrets */}
      {isGM && npc.secrets && npc.secrets.length > 0 && (
        <div style={{
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          marginBottom: '16px',
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#c4b5fd',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Eye size={12} /> GM SECRETS
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {npc.secrets.map((secret, i) => (
              <li key={i} style={{ color: '#e2e8f0', fontSize: '0.875rem', marginBottom: '4px' }}>
                {secret}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Connections */}
      {npc.connections && npc.connections.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#94a3b8',
            marginBottom: '8px',
          }}>
            CONNECTIONS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {npc.connections.map(conn => (
              <Badge key={conn.id} variant="default">
                {conn.name} ({conn.relationship})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
        {onChat && (
          <Button variant="ghost" size="sm" onClick={onChat}>
            <MessageCircle size={16} /> Chat
          </Button>
        )}
        {onViewSheet && (
          <Button variant="ghost" size="sm" onClick={onViewSheet}>
            <FileText size={16} /> Full Sheet
          </Button>
        )}
        {isGM && onDeepen && npc.depth < 5 && (
          <Button variant="ghost" size="sm" onClick={onDeepen} style={{ marginLeft: 'auto' }}>
            <ChevronDown size={16} /> Deepen (D{npc.depth + 1})
          </Button>
        )}
      </div>
    </Card>
  )
}
