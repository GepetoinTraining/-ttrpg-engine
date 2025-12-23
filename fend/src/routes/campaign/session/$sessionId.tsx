import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ShellContent, Card, Button, Badge, Avatar } from '@styles/processors/_internal'
import { FlipCard, useFlipCard, List, ListItem, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { useRoom, useSendMessage } from '@api/websocket'
import {
  Play, Pause, SkipForward, Swords, MessageSquare,
  Dice5, Users, Clock, ChevronRight
} from 'lucide-react'

export function SessionLive() {
  const { id, sessionId } = useParams({ from: '/campaign/$id/session/$sessionId' })
  const [isPaused, setIsPaused] = useState(false)

  const { data: session } = trpc.session.get.useQuery({ sessionId })
  const { data: currentCard } = trpc.session.currentCard.useQuery({ sessionId })
  const sendMessage = useSendMessage()

  // Join session room for realtime
  useRoom('session', sessionId)

  // FlipCard for scene ↔ combat
  const flipCard = useFlipCard()

  const advanceCard = () => {
    sendMessage('advance_card', { sessionId })
  }

  const startCombat = () => {
    flipCard.flip()
    sendMessage('start_combat', { sessionId, cardId: currentCard?.id })
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Session Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #1e293b',
          background: '#0f172a',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Badge variant="success">LIVE</Badge>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>
              Session {session?.number}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
              <Clock size={14} style={{ marginRight: '4px' }} />
              {session?.duration || '0:00'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="ghost"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="secondary" onClick={advanceCard}>
              <SkipForward size={18} />
              Next Card
            </Button>
          </div>
        </div>

        {/* Card Display with FlipCard */}
        <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {currentCard ? (
            <div style={{ maxWidth: '900px', margin: '0 auto', height: '100%' }}>
              {currentCard.type === 'combat' || flipCard.isFlipped ? (
                <FlipCard
                  front={<SceneCardContent card={currentCard} onStartCombat={startCombat} />}
                  back={<CombatGridContent card={currentCard} />}
                  flipped={flipCard.isFlipped}
                  onFlip={(flipped) => {
                    if (!flipped) flipCard.unflip()
                  }}
                />
              ) : (
                <Card variant="scene" padding="lg" style={{ height: '100%' }}>
                  <SceneCardContent card={currentCard} onStartCombat={startCombat} />
                </Card>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '64px', color: '#64748b' }}>
              No active card
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div style={{ width: '320px', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
        <Tabs defaultValue="players" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TabList style={{ padding: '8px', background: '#0f172a' }}>
            <Tab value="players"><Users size={16} /></Tab>
            <Tab value="chat"><MessageSquare size={16} /></Tab>
            <Tab value="dice"><Dice5 size={16} /></Tab>
          </TabList>

          <TabPanel value="players" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
            <PlayerList sessionId={sessionId} />
          </TabPanel>

          <TabPanel value="chat" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
            <ChatPanel sessionId={sessionId} />
          </TabPanel>

          <TabPanel value="dice" style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            <DicePanel />
          </TabPanel>
        </Tabs>

        {/* Card Queue Preview */}
        <div style={{ padding: '12px', borderTop: '1px solid #1e293b', background: '#0f172a' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>
            Up Next
          </div>
          <CardQueuePreview sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}

function SceneCardContent({ card, onStartCombat }: { card: any; onStartCombat: () => void }) {
  return (
    <div>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#f8fafc',
        fontFamily: '"Crimson Pro", Georgia, serif',
        marginBottom: '16px',
      }}>
        {card.title}
      </h2>

      <div style={{
        color: '#e2e8f0',
        lineHeight: 1.7,
        fontSize: '1rem',
        marginBottom: '24px',
      }}>
        {card.content?.description}
      </div>

      {card.content?.hasCombat && (
        <Button variant="danger" onClick={onStartCombat}>
          <Swords size={18} />
          Roll Initiative!
        </Button>
      )}
    </div>
  )
}

function CombatGridContent({ card }: { card: any }) {
  // This is where the Manifold physics-based combat grid would render
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f172a',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600, color: '#ef4444' }}>⚔️ COMBAT</span>
        <Badge variant="error">Round 1</Badge>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        {/* Combat grid would render here using Manifold Token and GridCell components */}
        <p>Combat grid loads here with Φ tensor physics</p>
      </div>
    </div>
  )
}

function PlayerList({ sessionId }: { sessionId: string }) {
  const { data: players } = trpc.session.players.useQuery({ sessionId })

  return (
    <List gap="none">
      {players?.map((player: any) => (
        <ListItem key={player.id} leading={<Avatar src={player.imageUrl} name={player.name} size="sm" status={player.online ? 'online' : 'offline'} />}>
          <div>
            <span style={{ fontWeight: 500 }}>{player.characterName}</span>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{player.name}</div>
          </div>
        </ListItem>
      ))}
    </List>
  )
}

function ChatPanel({ sessionId }: { sessionId: string }) {
  return (
    <div style={{ padding: '12px', color: '#64748b', fontSize: '0.875rem' }}>
      Chat messages appear here...
    </div>
  )
}

function DicePanel() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(die => (
          <Button key={die} variant="ghost" style={{ aspectRatio: '1' }}>
            {die}
          </Button>
        ))}
      </div>
    </div>
  )
}

function CardQueuePreview({ sessionId }: { sessionId: string }) {
  const { data: queue } = trpc.session.cardQueue.useQuery({ sessionId })

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {queue?.slice(0, 3).map((card: any, i: number) => (
        <div key={card.id} style={{
          flex: 1,
          padding: '8px',
          background: '#1e293b',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#94a3b8',
          textAlign: 'center',
        }}>
          {card.title || `Card ${i + 1}`}
        </div>
      ))}
    </div>
  )
}
