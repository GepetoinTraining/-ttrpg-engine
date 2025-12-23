import { useState, useCallback } from 'react'
import { Card, CardTitle, Button, Input, Textarea, Modal, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { CardQueue, SessionCard, CardType } from './card_queue'
import { Plus, Play, Save, Scroll, Swords, Gift, Moon, Trash2 } from 'lucide-react'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'

export interface SessionBuilderProps {
  campaignId: string
  sessionId?: string // If editing existing session
  initialCards?: SessionCard[]
  onStart: (sessionId: string) => void
  onSave: () => void
}

const CARD_TYPE_OPTIONS: Array<{ type: CardType; label: string; icon: React.ReactNode; description: string }> = [
  { type: 'scene', label: 'Scene', icon: <Scroll size={24} />, description: 'Narrative moment, roleplay, exploration' },
  { type: 'combat', label: 'Combat', icon: <Swords size={24} />, description: 'Tactical battle encounter' },
  { type: 'loot', label: 'Loot', icon: <Gift size={24} />, description: 'Treasure distribution' },
  { type: 'downtime_reveal', label: 'Downtime', icon: <Moon size={24} />, description: 'Reveal downtime outcomes' },
]

export function SessionBuilder({
  campaignId,
  sessionId,
  initialCards = [],
  onStart,
  onSave,
}: SessionBuilderProps) {
  const [cards, setCards] = useState<SessionCard[]>(initialCards)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [sessionName, setSessionName] = useState('')

  const selectedCard = cards.find(c => c.id === selectedId)

  const saveMutation = trpc.session.save.useMutation({
    onSuccess: () => {
      toast.success('Session saved')
      onSave()
    },
  })

  const startMutation = trpc.session.start.useMutation({
    onSuccess: (data) => {
      onStart(data.id)
    },
  })

  const handleReorder = useCallback((from: number, to: number) => {
    if (to < 0 || to >= cards.length) return
    setCards(prev => {
      const newCards = [...prev]
      const [removed] = newCards.splice(from, 1)
      newCards.splice(to, 0, removed)
      return newCards
    })
  }, [cards.length])

  const handleRemove = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleAddCard = (type: CardType) => {
    const newCard: SessionCard = {
      id: crypto.randomUUID(),
      type,
      title: '',
      content: getDefaultContent(type),
    }
    setCards(prev => [...prev, newCard])
    setSelectedId(newCard.id)
    setShowAddModal(false)
  }

  const updateCard = (updates: Partial<SessionCard>) => {
    if (!selectedId) return
    setCards(prev => prev.map(c =>
      c.id === selectedId ? { ...c, ...updates } : c
    ))
  }

  const handleSave = () => {
    saveMutation.mutate({
      campaignId,
      sessionId,
      name: sessionName,
      cards: cards.map(c => ({ type: c.type, title: c.title, content: c.content })),
    })
  }

  const handleStart = () => {
    startMutation.mutate({
      campaignId,
      sessionId,
      name: sessionName,
      cards: cards.map(c => ({ type: c.type, title: c.title, content: c.content })),
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', height: '100%' }}>
      {/* Sidebar - Card Queue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input
          placeholder="Session Name"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
        />

        <CardQueue
          cards={cards}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={handleReorder}
          onRemove={handleRemove}
          onAdd={() => setShowAddModal(true)}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="ghost"
            onClick={handleSave}
            loading={saveMutation.isPending}
            style={{ flex: 1 }}
          >
            <Save size={16} /> Save
          </Button>
          <Button
            variant="primary"
            onClick={handleStart}
            loading={startMutation.isPending}
            disabled={cards.length === 0}
            style={{ flex: 1 }}
          >
            <Play size={16} /> Start
          </Button>
        </div>
      </div>

      {/* Main - Card Editor */}
      <Card variant="default" padding="lg" style={{ overflow: 'auto' }}>
        {selectedCard ? (
          <CardEditor card={selectedCard} onUpdate={updateCard} />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#64748b',
          }}>
            <Scroll size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>Select a card to edit, or add a new one</p>
          </div>
        )}
      </Card>

      {/* Add Card Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {CARD_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => handleAddCard(opt.type)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '20px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#f59e0b'
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#334155'
                e.currentTarget.style.background = '#1e293b'
              }}
            >
              {opt.icon}
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function CardEditor({ card, onUpdate }: { card: SessionCard; onUpdate: (updates: Partial<SessionCard>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input
        label="Title"
        value={card.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder={`Untitled ${card.type}`}
      />

      {card.type === 'scene' && (
        <SceneEditor content={card.content} onChange={(content) => onUpdate({ content })} />
      )}
      {card.type === 'combat' && (
        <CombatEditor content={card.content} onChange={(content) => onUpdate({ content })} />
      )}
      {card.type === 'loot' && (
        <LootEditor content={card.content} onChange={(content) => onUpdate({ content })} />
      )}
      {card.type === 'downtime_reveal' && (
        <DowntimeEditor content={card.content} onChange={(content) => onUpdate({ content })} />
      )}
    </div>
  )
}

function SceneEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <>
      <Input
        label="Location"
        value={content.location || ''}
        onChange={(e) => onChange({ ...content, location: e.target.value })}
        placeholder="The Rusty Dragon Inn"
      />
      <Textarea
        label="Read-Aloud Text"
        value={content.description || ''}
        onChange={(e) => onChange({ ...content, description: e.target.value })}
        placeholder="The scene the players see..."
        rows={6}
      />
      <Textarea
        label="GM Notes (hidden)"
        value={content.gmNotes || ''}
        onChange={(e) => onChange({ ...content, gmNotes: e.target.value })}
        placeholder="Secret information, triggers, DCs..."
        rows={4}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
        <input
          type="checkbox"
          checked={content.hasCombat || false}
          onChange={(e) => onChange({ ...content, hasCombat: e.target.checked })}
        />
        This scene can trigger combat
      </label>
    </>
  )
}

function CombatEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <>
      <Textarea
        label="Encounter Description"
        value={content.description || ''}
        onChange={(e) => onChange({ ...content, description: e.target.value })}
        rows={3}
      />
      <Input
        label="Map (optional)"
        value={content.mapUrl || ''}
        onChange={(e) => onChange({ ...content, mapUrl: e.target.value })}
        placeholder="URL to battle map image"
      />
      <Textarea
        label="Enemies (one per line: Name, AC, HP)"
        value={content.enemies || ''}
        onChange={(e) => onChange({ ...content, enemies: e.target.value })}
        placeholder="Goblin, 15, 7&#10;Hobgoblin, 18, 11"
        rows={6}
      />
    </>
  )
}

function LootEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <>
      <Input
        label="Source"
        value={content.source || ''}
        onChange={(e) => onChange({ ...content, source: e.target.value })}
        placeholder="Dragon's Hoard"
      />
      <Input
        label="Gold"
        type="number"
        value={content.gold || 0}
        onChange={(e) => onChange({ ...content, gold: parseInt(e.target.value) || 0 })}
      />
      <Textarea
        label="Items (one per line)"
        value={content.items || ''}
        onChange={(e) => onChange({ ...content, items: e.target.value })}
        placeholder="Potion of Healing&#10;+1 Longsword (rare)"
        rows={6}
      />
    </>
  )
}

function DowntimeEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <>
      <Input
        label="Days Passed"
        type="number"
        value={content.daysPassed || 7}
        onChange={(e) => onChange({ ...content, daysPassed: parseInt(e.target.value) || 7 })}
      />
      <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
        Completed downtime actions will be loaded automatically from the campaign.
      </p>
    </>
  )
}

function getDefaultContent(type: CardType): any {
  switch (type) {
    case 'scene': return { location: '', description: '', gmNotes: '', hasCombat: false }
    case 'combat': return { description: '', mapUrl: '', enemies: '' }
    case 'loot': return { source: '', gold: 0, items: '' }
    case 'downtime_reveal': return { daysPassed: 7 }
  }
}
