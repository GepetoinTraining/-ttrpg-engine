import { useState, useCallback } from 'react'
import { Card, Button, Badge } from '@styles/processors/_internal'
import { GripVertical, Trash2, ChevronUp, ChevronDown, Scroll, Swords, Gift, Moon } from 'lucide-react'

export type CardType = 'scene' | 'combat' | 'loot' | 'downtime_reveal'

export interface SessionCard {
  id: string
  type: CardType
  title: string
  content: any
}

export interface CardQueueProps {
  cards: SessionCard[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onRemove: (id: string) => void
  onAdd: () => void
}

const CARD_ICONS: Record<CardType, React.ReactNode> = {
  scene: <Scroll size={16} style={{ color: '#0ea5e9' }} />,
  combat: <Swords size={16} style={{ color: '#ef4444' }} />,
  loot: <Gift size={16} style={{ color: '#f59e0b' }} />,
  downtime_reveal: <Moon size={16} style={{ color: '#8b5cf6' }} />,
}

const CARD_LABELS: Record<CardType, string> = {
  scene: 'Scene',
  combat: 'Combat',
  loot: 'Loot',
  downtime_reveal: 'Downtime',
}

export function CardQueue({
  cards,
  selectedId,
  onSelect,
  onReorder,
  onRemove,
  onAdd,
}: CardQueueProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    onReorder(draggedIndex, index)
    setDraggedIndex(index)
  }, [draggedIndex, onReorder])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  return (
    <Card variant="default" padding="sm">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #1e293b',
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#f8fafc' }}>
          Card Queue
        </span>
        <Badge variant="default">{cards.length}</Badge>
      </div>

      <div style={{ padding: '8px' }}>
        {cards.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.875rem',
          }}>
            <Scroll size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No cards yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {cards.map((card, index) => (
              <CardQueueItem
                key={card.id}
                card={card}
                index={index}
                isSelected={selectedId === card.id}
                isFirst={index === 0}
                isLast={index === cards.length - 1}
                onSelect={() => onSelect(card.id)}
                onMoveUp={() => onReorder(index, index - 1)}
                onMoveDown={() => onReorder(index, index + 1)}
                onRemove={() => onRemove(card.id)}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          style={{ width: '100%', marginTop: '8px' }}
        >
          + Add Card
        </Button>
      </div>
    </Card>
  )
}

interface CardQueueItemProps {
  card: SessionCard
  index: number
  isSelected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function CardQueueItem({
  card,
  index,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CardQueueItemProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        border: isSelected ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
      }}
    >
      <GripVertical
        size={14}
        style={{ color: '#475569', cursor: 'grab', flexShrink: 0 }}
      />

      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        background: '#1e293b',
        fontSize: '0.6875rem',
        color: '#64748b',
        flexShrink: 0,
      }}>
        {index + 1}
      </span>

      {CARD_ICONS[card.type]}

      <span style={{
        flex: 1,
        fontSize: '0.875rem',
        color: isSelected ? '#f59e0b' : '#e2e8f0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {card.title || CARD_LABELS[card.type]}
      </span>

      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        <IconButton onClick={(e) => { e.stopPropagation(); onMoveUp() }} disabled={isFirst}>
          <ChevronUp size={14} />
        </IconButton>
        <IconButton onClick={(e) => { e.stopPropagation(); onMoveDown() }} disabled={isLast}>
          <ChevronDown size={14} />
        </IconButton>
        <IconButton onClick={(e) => { e.stopPropagation(); onRemove() }} danger>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        color: danger ? '#ef4444' : '#64748b',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {children}
    </button>
  )
}
