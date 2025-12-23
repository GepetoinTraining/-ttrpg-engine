import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, CardHeader, Button, Badge } from '@styles/processors/_internal'
import { List, ListItem, Tabs, TabList, Tab, TabPanel, Modal, useModal } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'
import {
  Play, Plus, GripVertical, Scroll, Swords, Gift, Moon,
  Trash2, ChevronUp, ChevronDown, Wand2
} from 'lucide-react'

type CardType = 'scene' | 'combat' | 'loot' | 'downtime_reveal'

interface SessionCard {
  id: string
  type: CardType
  title: string
  content: any
}

export function SessionNew() {
  const { id } = useParams({ from: '/campaign/$id' })
  const navigate = useNavigate()
  const [cards, setCards] = useState<SessionCard[]>([])
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  const addCardModal = useModal()
  const startMutation = trpc.session.create.useMutation({
    onSuccess: (session) => {
      toast.success('Session started!')
      navigate({ to: '/campaign/$id/session/$sessionId', params: { id, sessionId: session.id } })
    },
  })

  const addCard = (type: CardType) => {
    const newCard: SessionCard = {
      id: `card-${Date.now()}`,
      type,
      title: `New ${type} card`,
      content: {},
    }
    setCards([...cards, newCard])
    setSelectedCard(newCard.id)
    addCardModal.closeModal()
  }

  const moveCard = (index: number, direction: 'up' | 'down') => {
    const newCards = [...cards]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= cards.length) return
    ;[newCards[index], newCards[targetIndex]] = [newCards[targetIndex], newCards[index]]
    setCards(newCards)
  }

  const removeCard = (id: string) => {
    setCards(cards.filter(c => c.id !== id))
    if (selectedCard === id) setSelectedCard(null)
  }

  return (
    <ShellContent>
      <PageHeader
        title="Session Builder"
        description="Prepare your session cards"
        actions={
          <Button
            variant="primary"
            onClick={() => startMutation.mutate({ campaignId: id, cards })}
            disabled={cards.length === 0}
            loading={startMutation.isPending}
          >
            <Play size={18} />
            Start Session
          </Button>
        }
      />

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: '320px 1fr' }}>
        {/* Card Queue */}
        <Card variant="default" padding="sm">
          <CardHeader style={{ padding: '12px' }}>
            <CardTitle style={{ fontSize: '0.9375rem' }}>Card Queue</CardTitle>
            <Button variant="ghost" size="sm" onClick={addCardModal.openModal}>
              <Plus size={16} />
            </Button>
          </CardHeader>

          {cards.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
              <Scroll size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No cards yet</p>
              <Button variant="ghost" size="sm" onClick={addCardModal.openModal} style={{ marginTop: '12px' }}>
                Add your first card
              </Button>
            </div>
          ) : (
            <List gap="sm" style={{ padding: '8px' }}>
              {cards.map((card, index) => (
                <ListItem
                  key={card.id}
                  selected={selectedCard === card.id}
                  onClick={() => setSelectedCard(card.id)}
                  leading={
                    <GripVertical size={14} style={{ color: '#475569', cursor: 'grab' }} />
                  }
                  trailing={
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={(e) => { e.stopPropagation(); moveCard(index, 'up') }} disabled={index === 0} style={iconBtnStyle}>
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveCard(index, 'down') }} disabled={index === cards.length - 1} style={iconBtnStyle}>
                        <ChevronDown size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeCard(card.id) }} style={{ ...iconBtnStyle, color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CardTypeIcon type={card.type} />
                    <span style={{ fontSize: '0.875rem' }}>{card.title}</span>
                  </div>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        {/* Card Editor */}
        <Card variant="default" padding="md">
          {selectedCard ? (
            <CardEditor
              card={cards.find(c => c.id === selectedCard)!}
              onChange={(updated) => setCards(cards.map(c => c.id === updated.id ? updated : c))}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px',
              color: '#64748b',
            }}>
              <Wand2 size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Select a card to edit or add a new one</p>
            </div>
          )}
        </Card>
      </div>

      {/* Add Card Modal */}
      <Modal open={addCardModal.open} onClose={addCardModal.closeModal} title="Add Card">
        <div style={{ display: 'grid', gap: '12px' }}>
          <CardTypeButton type="scene" icon={<Scroll size={24} />} onClick={() => addCard('scene')} />
          <CardTypeButton type="combat" icon={<Swords size={24} />} onClick={() => addCard('combat')} />
          <CardTypeButton type="loot" icon={<Gift size={24} />} onClick={() => addCard('loot')} />
          <CardTypeButton type="downtime_reveal" icon={<Moon size={24} />} onClick={() => addCard('downtime_reveal')} />
        </div>
      </Modal>
    </ShellContent>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
}

function CardTypeIcon({ type }: { type: CardType }) {
  const icons: Record<CardType, React.ReactNode> = {
    scene: <Scroll size={16} style={{ color: '#0ea5e9' }} />,
    combat: <Swords size={16} style={{ color: '#ef4444' }} />,
    loot: <Gift size={16} style={{ color: '#f59e0b' }} />,
    downtime_reveal: <Moon size={16} style={{ color: '#8b5cf6' }} />,
  }
  return <>{icons[type]}</>
}

function CardTypeButton({ type, icon, onClick }: { type: CardType; icon: React.ReactNode; onClick: () => void }) {
  const descriptions: Record<CardType, string> = {
    scene: 'Narrative scene with description and NPC interactions',
    combat: 'Combat encounter with grid and initiative',
    loot: 'Treasure distribution and item discovery',
    downtime_reveal: 'Results from previous downtime actions',
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 150ms, background 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#334155'
        e.currentTarget.style.background = '#1e293b'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1e293b'
        e.currentTarget.style.background = '#0f172a'
      }}
    >
      {icon}
      <div>
        <div style={{ fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>{type.replace('_', ' ')}</div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{descriptions[type]}</div>
      </div>
    </button>
  )
}

function CardEditor({ card, onChange }: { card: SessionCard; onChange: (card: SessionCard) => void }) {
  return (
    <div>
      <input
        value={card.title}
        onChange={(e) => onChange({ ...card, title: e.target.value })}
        style={{
          width: '100%',
          padding: '12px',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #1e293b',
          color: '#f8fafc',
          fontSize: '1.25rem',
          fontWeight: 600,
          fontFamily: '"Crimson Pro", Georgia, serif',
          marginBottom: '16px',
        }}
        placeholder="Card title..."
      />

      <Tabs defaultValue="content">
        <TabList>
          <Tab value="content">Content</Tab>
          <Tab value="visibility">Visibility</Tab>
          <Tab value="triggers">Triggers</Tab>
        </TabList>

        <TabPanel value="content">
          <textarea
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '12px',
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              resize: 'vertical',
            }}
            placeholder="Describe the scene, encounter, or content..."
          />
        </TabPanel>

        <TabPanel value="visibility">
          <p style={{ color: '#64748b' }}>Configure what players can see...</p>
        </TabPanel>

        <TabPanel value="triggers">
          <p style={{ color: '#64748b' }}>Set up automatic triggers...</p>
        </TabPanel>
      </Tabs>
    </div>
  )
}
