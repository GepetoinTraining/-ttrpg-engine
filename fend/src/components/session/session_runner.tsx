import { useState, useEffect } from 'react'
import { Card, Button, Badge } from '@styles/processors/_internal'
import { CardQueue, SessionCard } from './card_queue'
import { FlipCard } from '@organisms/flip_card'
import { SceneCard } from './scene_card'
import { CombatCard } from '../combat/combat_card'
import { LootCard } from './loot_card'
import { DowntimeReveal } from './downtime_reveal'
import { useSessionStore } from '@stores/session_store'
import { useSession } from '@hooks/use_session'
import { Play, Pause, SkipForward, StopCircle, Clock, Users } from 'lucide-react'

export interface SessionRunnerProps {
  sessionId: string
  campaignId: string
  isGM: boolean
  players: Array<{ id: string; name: string; characterName: string; imageUrl?: string }>
}

export function SessionRunner({
  sessionId,
  campaignId,
  isGM,
  players,
}: SessionRunnerProps) {
  const { session, cards } = useSession(sessionId)
  const {
    currentCardIndex,
    isLive,
    isPaused,
    setCurrentCard,
    togglePause,
    endSession,
  } = useSessionStore()

  const [flipPhase, setFlipPhase] = useState<'front' | 'back'>('front')
  const [sessionTime, setSessionTime] = useState(0)

  const currentCard = cards[currentCardIndex]
  const isFlippable = currentCard?.type === 'scene' && currentCard.content?.hasCombat

  // Session timer
  useEffect(() => {
    if (!isLive || isPaused) return
    const interval = setInterval(() => {
      setSessionTime(t => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isLive, isPaused])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleFlipToCombat = () => {
    setFlipPhase('back')
  }

  const handleFlipToScene = () => {
    setFlipPhase('front')
  }

  const handleNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCard(currentCardIndex + 1)
      setFlipPhase('front')
    }
  }

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCard(currentCardIndex - 1)
      setFlipPhase('front')
    }
  }

  const renderCardContent = (card: SessionCard, side: 'front' | 'back') => {
    if (card.type === 'scene') {
      if (side === 'front') {
        return (
          <SceneCard
            scene={{
              id: card.id,
              title: card.title || 'Untitled Scene',
              description: card.content.description || '',
              location: card.content.location,
              hasCombat: card.content.hasCombat,
            }}
            isGM={isGM}
            onStartCombat={handleFlipToCombat}
          />
        )
      } else {
        // Combat back side
        return (
          <CombatCard
            combat={{
              id: card.id,
              enemies: parseEnemies(card.content.enemies),
              mapUrl: card.content.mapUrl,
            }}
            isGM={isGM}
            onEndCombat={handleFlipToScene}
          />
        )
      }
    }

    if (card.type === 'combat') {
      return (
        <CombatCard
          combat={{
            id: card.id,
            enemies: parseEnemies(card.content.enemies),
            mapUrl: card.content.mapUrl,
            description: card.content.description,
          }}
          isGM={isGM}
        />
      )
    }

    if (card.type === 'loot') {
      return (
        <LootCard
          loot={{
            id: card.id,
            title: card.title || 'Loot',
            source: card.content.source,
            items: parseItems(card.content.items),
            goldTotal: card.content.gold,
          }}
          players={players}
          isGM={isGM}
        />
      )
    }

    if (card.type === 'downtime_reveal') {
      return (
        <DowntimeReveal
          actions={[]} // Would be fetched from campaign
          gameDaysPassed={card.content.daysPassed || 7}
          isGM={isGM}
        />
      )
    }

    return null
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: '16px', height: '100%' }}>
      {/* Left Sidebar - Card Queue */}
      {isGM && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CardQueue
            cards={cards}
            selectedId={currentCard?.id || null}
            onSelect={(id) => {
              const idx = cards.findIndex(c => c.id === id)
              if (idx !== -1) setCurrentCard(idx)
            }}
            onReorder={() => {}}
            onRemove={() => {}}
            onAdd={() => {}}
          />
        </div>
      )}

      {/* Main Content - Current Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Control Bar */}
        <Card variant="default" padding="sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Badge variant={isPaused ? 'warning' : 'success'} style={{ fontSize: '0.875rem' }}>
                {isPaused ? 'PAUSED' : 'LIVE'}
              </Badge>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                <Clock size={16} />
                <span style={{ fontFamily: 'monospace' }}>{formatTime(sessionTime)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                <Users size={16} />
                <span>{players.length} players</span>
              </div>
            </div>

            {isGM && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" size="sm" onClick={handlePrevCard} disabled={currentCardIndex === 0}>
                  ← Prev
                </Button>
                <Button variant="ghost" size="sm" onClick={togglePause}>
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNextCard} disabled={currentCardIndex >= cards.length - 1}>
                  Next →
                </Button>
                <Button variant="danger" size="sm" onClick={() => endSession()}>
                  <StopCircle size={16} /> End
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Card Display */}
        <div style={{ flex: 1, position: 'relative' }}>
          {currentCard && (
            isFlippable ? (
              <FlipCard
                front={renderCardContent(currentCard, 'front')}
                back={renderCardContent(currentCard, 'back')}
                flipped={flipPhase === 'back'}
                style={{ height: '100%' }}
              />
            ) : (
              <div style={{ height: '100%' }}>
                {renderCardContent(currentCard, 'front')}
              </div>
            )
          )}
        </div>

        {/* Card Progress */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {cards.map((card, i) => (
            <div
              key={card.id}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: i < currentCardIndex
                  ? '#22c55e'
                  : i === currentCardIndex
                    ? '#f59e0b'
                    : '#334155',
              }}
            />
          ))}
        </div>
      </div>

      {/* Right Sidebar - Players/Chat would go here */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Card variant="default" padding="md">
          <h4 style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#94a3b8' }}>Players</h4>
          {players.map(player => (
            <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#22c55e', // Would be dynamic based on presence
              }} />
              <span style={{ fontSize: '0.875rem' }}>{player.characterName}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function parseEnemies(str: string): Array<{ name: string; ac: number; hp: number }> {
  if (!str) return []
  return str.split('\n').filter(Boolean).map(line => {
    const [name, ac, hp] = line.split(',').map(s => s.trim())
    return { name, ac: parseInt(ac) || 10, hp: parseInt(hp) || 1 }
  })
}

function parseItems(str: string): Array<{ id: string; name: string; type: string; rarity?: string }> {
  if (!str) return []
  return str.split('\n').filter(Boolean).map((line, i) => {
    const match = line.match(/^(.+?)\s*\((\w+)\)?$/)
    if (match) {
      return { id: `item-${i}`, name: match[1].trim(), type: 'item', rarity: match[2].toLowerCase() }
    }
    return { id: `item-${i}`, name: line.trim(), type: 'item' }
  })
}
