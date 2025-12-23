import { useNavigate } from '@tanstack/react-router'
import { Card, CardTitle, Badge, Avatar } from '@styles/processors/_internal'
import { Users, Calendar, Clock } from 'lucide-react'

export interface CampaignCardProps {
  campaign: {
    id: string
    name: string
    description?: string
    imageUrl?: string
    status: 'active' | 'paused' | 'completed'
    memberCount: number
    sessionCount: number
    lastSessionDate?: string
    role: 'owner' | 'gm' | 'player'
  }
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate()

  const statusColors = {
    active: 'success',
    paused: 'warning',
    completed: 'default',
  } as const

  return (
    <Card
      variant="default"
      padding="md"
      style={{ cursor: 'pointer', transition: 'transform 150ms, box-shadow 150ms' }}
      onClick={() => navigate({ to: '/campaign/$id', params: { id: campaign.id } })}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {campaign.imageUrl ? (
            <img
              src={campaign.imageUrl}
              alt={campaign.name}
              style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#fff',
            }}>
              {campaign.name[0]}
            </div>
          )}
          <div>
            <CardTitle style={{ fontSize: '1rem' }}>{campaign.name}</CardTitle>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
              {campaign.role}
            </span>
          </div>
        </div>
        <Badge variant={statusColors[campaign.status]}>
          {campaign.status}
        </Badge>
      </div>

      {/* Description */}
      {campaign.description && (
        <p style={{
          fontSize: '0.875rem',
          color: '#94a3b8',
          margin: '0 0 16px',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {campaign.description}
        </p>
      )}

      {/* Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '0.8125rem',
        color: '#64748b',
        paddingTop: '12px',
        borderTop: '1px solid #1e293b',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={14} />
          {campaign.memberCount}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} />
          {campaign.sessionCount} sessions
        </span>
        {campaign.lastSessionDate && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <Clock size={14} />
            {formatRelativeDate(campaign.lastSessionDate)}
          </span>
        )}
      </div>
    </Card>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}
