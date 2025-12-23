import { Card, CardTitle, Badge, Button } from '@styles/processors/_internal'
import { List, ListItem, Avatar } from '@styles/processors/_internal'
import { Scroll, MapPin, Users, Eye, EyeOff, Swords, ChevronRight } from 'lucide-react'

export interface SceneCardProps {
  scene: {
    id: string
    title: string
    description: string
    location?: string
    npcsPresent?: Array<{
      id: string
      name: string
      imageUrl?: string
      role?: string
    }>
    secrets?: Array<{
      id: string
      text: string
      revealed: boolean
      revealedTo?: string[]
    }>
    hasCombat?: boolean
  }
  isGM: boolean
  onStartCombat?: () => void
  onRevealSecret?: (secretId: string) => void
  onNavigateToNpc?: (npcId: string) => void
}

export function SceneCard({
  scene,
  isGM,
  onStartCombat,
  onRevealSecret,
  onNavigateToNpc,
}: SceneCardProps) {
  return (
    <Card variant="scene" padding="lg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Scroll size={24} style={{ color: '#0ea5e9' }} />
          <CardTitle style={{ fontSize: '1.5rem' }}>{scene.title}</CardTitle>
        </div>

        {scene.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.875rem' }}>
            <MapPin size={14} />
            <span>{scene.location}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{
        flex: 1,
        color: '#e2e8f0',
        lineHeight: 1.7,
        fontSize: '1rem',
        marginBottom: '24px',
        whiteSpace: 'pre-wrap',
      }}>
        {scene.description}
      </div>

      {/* NPCs Present */}
      {scene.npcsPresent && scene.npcsPresent.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            color: '#94a3b8',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}>
            <Users size={14} />
            NPCs Present
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {scene.npcsPresent.map(npc => (
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
                  color: '#e2e8f0',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <Avatar src={npc.imageUrl} name={npc.name} size="xs" />
                <span>{npc.name}</span>
                {npc.role && (
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    ({npc.role})
                  </span>
                )}
                <ChevronRight size={12} style={{ color: '#64748b' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GM Secrets */}
      {isGM && scene.secrets && scene.secrets.length > 0 && (
        <div style={{
          padding: '16px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            color: '#c4b5fd',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}>
            <Eye size={14} />
            GM Secrets
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scene.secrets.map(secret => (
              <div
                key={secret.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                }}
              >
                <span style={{
                  color: secret.revealed ? '#94a3b8' : '#e2e8f0',
                  fontSize: '0.875rem',
                  textDecoration: secret.revealed ? 'line-through' : 'none',
                }}>
                  {secret.text}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevealSecret?.(secret.id)}
                  disabled={secret.revealed}
                  style={{ flexShrink: 0 }}
                >
                  {secret.revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Combat Trigger */}
      {scene.hasCombat && onStartCombat && (
        <div style={{ marginTop: 'auto' }}>
          <Button variant="danger" onClick={onStartCombat} style={{ width: '100%' }}>
            <Swords size={18} />
            Roll Initiative!
          </Button>
        </div>
      )}
    </Card>
  )
}
