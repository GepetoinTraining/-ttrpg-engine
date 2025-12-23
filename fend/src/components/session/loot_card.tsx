import { useState } from 'react'
import { Card, CardTitle, Button, Badge, Avatar } from '@styles/processors/_internal'
import { List, ListItem, Dropdown } from '@styles/processors/_internal'
import { Gift, Coins, Gem, Scroll, Sword, Shield, Sparkles, Check } from 'lucide-react'

export interface LootItem {
  id: string
  name: string
  type: 'gold' | 'item' | 'consumable' | 'equipment' | 'scroll' | 'gem'
  rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'
  quantity?: number
  value?: number
  description?: string
  assignedTo?: string
}

export interface LootCardProps {
  loot: {
    id: string
    title: string
    source?: string
    items: LootItem[]
    goldTotal?: number
  }
  players: Array<{ id: string; name: string; characterName: string; imageUrl?: string }>
  isGM: boolean
  onAssign?: (itemId: string, playerId: string) => void
  onDistributeGold?: (distribution: Record<string, number>) => void
  onComplete?: () => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  gold: <Coins size={16} style={{ color: '#f59e0b' }} />,
  item: <Gift size={16} style={{ color: '#64748b' }} />,
  consumable: <Sparkles size={16} style={{ color: '#22c55e' }} />,
  equipment: <Sword size={16} style={{ color: '#94a3b8' }} />,
  scroll: <Scroll size={16} style={{ color: '#0ea5e9' }} />,
  gem: <Gem size={16} style={{ color: '#8b5cf6' }} />,
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#22c55e',
  rare: '#0ea5e9',
  very_rare: '#8b5cf6',
  legendary: '#f59e0b',
}

export function LootCard({
  loot,
  players,
  isGM,
  onAssign,
  onDistributeGold,
  onComplete,
}: LootCardProps) {
  const [goldDistribution, setGoldDistribution] = useState<Record<string, number>>(() => {
    if (!loot.goldTotal) return {}
    const perPlayer = Math.floor(loot.goldTotal / players.length)
    return Object.fromEntries(players.map(p => [p.id, perPlayer]))
  })

  const unassignedItems = loot.items.filter(item => !item.assignedTo && item.type !== 'gold')
  const assignedItems = loot.items.filter(item => item.assignedTo)

  const handleGoldChange = (playerId: string, amount: number) => {
    setGoldDistribution(prev => ({ ...prev, [playerId]: amount }))
  }

  const distributeGoldEvenly = () => {
    if (!loot.goldTotal) return
    const perPlayer = Math.floor(loot.goldTotal / players.length)
    const remainder = loot.goldTotal % players.length
    const dist: Record<string, number> = {}
    players.forEach((p, i) => {
      dist[p.id] = perPlayer + (i < remainder ? 1 : 0)
    })
    setGoldDistribution(dist)
  }

  return (
    <Card variant="default" padding="lg">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Gift size={24} style={{ color: '#f59e0b' }} />
        <div>
          <CardTitle>{loot.title}</CardTitle>
          {loot.source && (
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
              From: {loot.source}
            </span>
          )}
        </div>
      </div>

      {/* Gold Distribution */}
      {loot.goldTotal && loot.goldTotal > 0 && (
        <div style={{
          padding: '16px',
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={20} style={{ color: '#f59e0b' }} />
              <span style={{ fontWeight: 600, color: '#fcd34d' }}>{loot.goldTotal} gp</span>
            </div>
            {isGM && (
              <Button variant="ghost" size="sm" onClick={distributeGoldEvenly}>
                Split Evenly
              </Button>
            )}
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {players.map(player => (
              <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar src={player.imageUrl} name={player.characterName} size="sm" />
                <span style={{ flex: 1, fontSize: '0.875rem' }}>{player.characterName}</span>
                {isGM ? (
                  <input
                    type="number"
                    value={goldDistribution[player.id] || 0}
                    onChange={(e) => handleGoldChange(player.id, parseInt(e.target.value) || 0)}
                    style={{
                      width: '80px',
                      padding: '6px 10px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f59e0b',
                      fontSize: '0.875rem',
                      textAlign: 'right',
                    }}
                  />
                ) : (
                  <span style={{ color: '#f59e0b', fontWeight: 500 }}>
                    {goldDistribution[player.id] || 0} gp
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Items */}
      {unassignedItems.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '12px' }}>
            Unclaimed ({unassignedItems.length})
          </h4>
          <List gap="sm">
            {unassignedItems.map(item => (
              <LootItemRow
                key={item.id}
                item={item}
                players={players}
                isGM={isGM}
                onAssign={onAssign}
              />
            ))}
          </List>
        </div>
      )}

      {/* Assigned Items */}
      {assignedItems.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '12px' }}>
            Claimed ({assignedItems.length})
          </h4>
          <List gap="sm">
            {assignedItems.map(item => {
              const player = players.find(p => p.id === item.assignedTo)
              return (
                <ListItem
                  key={item.id}
                  leading={TYPE_ICONS[item.type]}
                  trailing={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={14} style={{ color: '#22c55e' }} />
                      <Avatar src={player?.imageUrl} name={player?.characterName} size="xs" />
                    </div>
                  }
                >
                  <span style={{ color: RARITY_COLORS[item.rarity || 'common'] }}>
                    {item.name}
                  </span>
                </ListItem>
              )
            })}
          </List>
        </div>
      )}

      {/* Complete Button */}
      {isGM && onComplete && (
        <Button variant="primary" onClick={onComplete} style={{ width: '100%' }}>
          <Check size={18} /> Distribute Loot
        </Button>
      )}
    </Card>
  )
}

function LootItemRow({
  item,
  players,
  isGM,
  onAssign,
}: {
  item: LootItem
  players: Array<{ id: string; name: string; characterName: string; imageUrl?: string }>
  isGM: boolean
  onAssign?: (itemId: string, playerId: string) => void
}) {
  return (
    <ListItem leading={TYPE_ICONS[item.type]}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontWeight: 500,
            color: RARITY_COLORS[item.rarity || 'common'],
          }}>
            {item.name}
          </span>
          {item.rarity && item.rarity !== 'common' && (
            <Badge variant="default" style={{
              fontSize: '0.625rem',
              color: RARITY_COLORS[item.rarity],
              borderColor: RARITY_COLORS[item.rarity],
            }}>
              {item.rarity}
            </Badge>
          )}
          {item.quantity && item.quantity > 1 && (
            <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>
              ×{item.quantity}
            </span>
          )}
        </div>
        {item.description && (
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
            {item.description}
          </p>
        )}
      </div>

      {isGM && onAssign && (
        <Dropdown
          options={[
            { value: '', label: 'Assign to...' },
            ...players.map(p => ({ value: p.id, label: p.characterName })),
          ]}
          value=""
          onChange={(playerId) => playerId && onAssign(item.id, playerId)}
        />
      )}
    </ListItem>
  )
}
