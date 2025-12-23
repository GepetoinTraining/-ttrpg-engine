import { useParams } from '@tanstack/react-router'
import { Card, CardTitle, Badge, Avatar, Button } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { Heart, Shield, Zap, Sword, Package } from 'lucide-react'

export function PlayerCharacter() {
  const { campaignId } = useParams({ from: '/player/$campaignId' })

  const { data: character } = trpc.character.mine.useQuery({ campaignId })

  if (!character) return null

  const hpPercent = (character.currentHp / character.maxHp) * 100
  const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Character Header */}
      <Card variant="default" padding="md">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Avatar src={character.imageUrl} name={character.name} size="xl" />
          <div style={{ flex: 1 }}>
            <CardTitle>{character.name}</CardTitle>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Level {character.level} {character.race} {character.class}
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <Badge variant="default">{character.background}</Badge>
              <Badge variant="info">{character.alignment}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* HP Bar */}
      <Card variant="default" padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Heart size={20} style={{ color: hpColor }} />
          <span style={{ fontWeight: 600 }}>Hit Points</span>
          <span style={{ marginLeft: 'auto', color: hpColor, fontWeight: 600 }}>
            {character.currentHp} / {character.maxHp}
          </span>
        </div>
        <div style={{ height: '12px', background: '#1e293b', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{
            width: `${hpPercent}%`,
            height: '100%',
            background: hpColor,
            transition: 'width 300ms',
          }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <Button variant="ghost" size="sm" style={{ flex: 1 }}>- Damage</Button>
          <Button variant="ghost" size="sm" style={{ flex: 1 }}>+ Heal</Button>
        </div>
      </Card>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <StatCard icon={<Shield size={20} />} label="AC" value={character.ac} />
        <StatCard icon={<Zap size={20} />} label="Initiative" value={`+${character.initiative}`} />
        <StatCard icon={<Sword size={20} />} label="Speed" value={`${character.speed}ft`} />
      </div>

      {/* Ability Scores */}
      <Card variant="default" padding="md">
        <CardTitle style={{ fontSize: '0.9375rem', marginBottom: '12px' }}>Abilities</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {Object.entries(character.abilities || {}).map(([ability, score]) => (
            <div key={ability} style={{
              padding: '12px 8px',
              background: '#0f172a',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>
                {ability}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                {score as number}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {Math.floor(((score as number) - 10) / 2) >= 0 ? '+' : ''}
                {Math.floor(((score as number) - 10) / 2)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Inventory */}
      <Card variant="default" padding="md">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <CardTitle style={{ fontSize: '0.9375rem' }}>
            <Package size={16} style={{ marginRight: '8px' }} />
            Inventory
          </CardTitle>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {character.gold || 0} gp
          </span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          {character.inventory?.length || 0} items
        </div>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card variant="default" padding="sm" style={{ textAlign: 'center' }}>
      <div style={{ color: '#f59e0b', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc' }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{label}</div>
    </Card>
  )
}
