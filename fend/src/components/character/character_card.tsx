import { Card, Avatar, Badge, ProgressBar } from '@styles/processors/_internal'
import { Heart, Shield, Zap, User } from 'lucide-react'

export interface CharacterCardProps {
  character: {
    id: string
    name: string
    imageUrl?: string
    class: string
    level: number
    race?: string
    hp: number
    maxHp: number
    tempHp?: number
    ac: number
    initiative?: number
    speed?: number
    player?: {
      id: string
      name: string
    }
  }
  isCompact?: boolean
  isSelected?: boolean
  onClick?: () => void
}

export function CharacterCard({
  character,
  isCompact = false,
  isSelected = false,
  onClick,
}: CharacterCardProps) {
  const hpPercent = (character.hp / character.maxHp) * 100

  if (isCompact) {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          background: isSelected ? 'rgba(245, 158, 11, 0.1)' : '#1e293b',
          borderRadius: '8px',
          border: isSelected ? '1px solid #f59e0b' : '1px solid #334155',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <Avatar src={character.imageUrl} name={character.name} size="md" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>
            {character.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Level {character.level} {character.class}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8125rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
            <Heart size={14} />
            {character.hp}/{character.maxHp}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
            <Shield size={14} />
            {character.ac}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card
      variant="default"
      padding="md"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        border: isSelected ? '2px solid #f59e0b' : undefined,
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <Avatar src={character.imageUrl} name={character.name} size="lg" />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#f8fafc' }}>
              {character.name}
            </h3>
            <Badge variant="default">Lv {character.level}</Badge>
          </div>

          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            {character.race && `${character.race} `}{character.class}
          </div>

          {character.player && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px',
              fontSize: '0.75rem',
              color: '#64748b',
            }}>
              <User size={12} />
              {character.player.name}
            </div>
          )}
        </div>
      </div>

      {/* HP Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: '0.8125rem',
        }}>
          <span style={{ color: '#94a3b8' }}>Hit Points</span>
          <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
            {character.hp} / {character.maxHp}
            {character.tempHp && character.tempHp > 0 && (
              <span style={{ color: '#22c55e' }}> (+{character.tempHp})</span>
            )}
          </span>
        </div>
        <ProgressBar
          value={hpPercent}
          color={hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444'}
        />
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        padding: '12px',
        background: '#0f172a',
        borderRadius: '8px',
      }}>
        <StatBox
          icon={<Shield size={16} />}
          label="AC"
          value={character.ac}
        />
        <StatBox
          icon={<Zap size={16} />}
          label="Init"
          value={character.initiative !== undefined ? `+${character.initiative}` : '—'}
        />
        <StatBox
          icon={<span style={{ fontSize: '14px' }}>🏃</span>}
          label="Speed"
          value={character.speed ? `${character.speed}ft` : '30ft'}
        />
      </div>
    </Card>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#64748b', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
