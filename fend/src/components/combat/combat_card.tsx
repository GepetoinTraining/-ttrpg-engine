import { useState } from 'react'
import { Card, CardTitle, Button, Badge } from '@styles/processors/_internal'
import { BattleGrid } from './battle_grid'
import { InitiativeBar } from './initiative_bar'
import { ActionBar } from './action_bar'
import { CombatLog } from './combat_log'
import { TokenData } from './token'
import { useCombat } from '@hooks/use_combat'
import { Swords, Flag, Settings, Maximize2, Minimize2 } from 'lucide-react'

export interface CombatCardProps {
  combat: {
    id: string
    description?: string
    mapUrl?: string
    enemies?: Array<{ name: string; ac: number; hp: number }>
  }
  isGM: boolean
  onEndCombat?: () => void
}

export function CombatCard({
  combat,
  isGM,
  onEndCombat,
}: CombatCardProps) {
  const {
    tokens,
    initiative,
    currentRound,
    currentTurnId,
    log,
    endTurn,
    moveToken,
    nextRound,
  } = useCombat(combat.id)

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showLog, setShowLog] = useState(true)

  const currentToken = tokens.find(t => t.id === currentTurnId)
  const isMyTurn = currentToken?.isPlayerControlled || isGM

  // Convert initiative entries for InitiativeBar
  const initiativeEntries = tokens.map(token => ({
    id: token.id,
    name: token.name,
    imageUrl: token.imageUrl,
    initiative: token.initiative || 0,
    hp: token.hp,
    maxHp: token.maxHp,
    ac: token.ac,
    isPlayer: token.isPlayerControlled || false,
    isCurrentTurn: token.id === currentTurnId,
    hasActed: false, // Would track from combat state
    conditions: token.conditions,
    isHidden: token.isHidden,
  }))

  const handleTokenMove = (id: string, x: number, y: number) => {
    moveToken(id, x, y)
  }

  return (
    <Card
      variant="combat"
      padding="none"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(isFullscreen && {
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          borderRadius: 0,
        }),
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #334155',
        background: 'rgba(239, 68, 68, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Swords size={20} style={{ color: '#ef4444' }} />
          <CardTitle style={{ margin: 0 }}>Combat</CardTitle>
          <Badge variant="danger">Round {currentRound}</Badge>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLog(!showLog)}
          >
            Log
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
          {isGM && onEndCombat && (
            <Button variant="ghost" size="sm" onClick={onEndCombat}>
              <Flag size={16} /> End
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Initiative Sidebar */}
        <div style={{
          width: '220px',
          borderRight: '1px solid #334155',
          overflow: 'auto',
          flexShrink: 0,
        }}>
          <InitiativeBar
            entries={initiativeEntries}
            currentRound={currentRound}
            isGM={isGM}
            onEndTurn={endTurn}
            onSelectEntry={setSelectedTokenId}
            onNextRound={nextRound}
          />
        </div>

        {/* Battle Grid */}
        <div style={{ flex: 1, position: 'relative' }}>
          <BattleGrid
            combatId={combat.id}
            mapUrl={combat.mapUrl}
            tokens={tokens}
            isGM={isGM}
            selectedTokenId={selectedTokenId}
            onTokenSelect={setSelectedTokenId}
            onTokenMove={handleTokenMove}
          />
        </div>

        {/* Combat Log */}
        {showLog && (
          <div style={{
            width: '260px',
            borderLeft: '1px solid #334155',
            overflow: 'auto',
            flexShrink: 0,
          }}>
            <CombatLog entries={log} />
          </div>
        )}
      </div>

      {/* Action Bar */}
      {isMyTurn && (
        <div style={{ borderTop: '1px solid #334155' }}>
          <ActionBar
            actionsUsed={{
              action: false,
              bonus: false,
              reaction: false,
              movement: 0,
            }}
            movementSpeed={currentToken?.size === 1 ? 30 : 40}
            isMyTurn={true}
            onAction={(type) => console.log('Action:', type)}
            onEndTurn={endTurn}
            onRollDice={() => console.log('Roll dice')}
          />
        </div>
      )}
    </Card>
  )
}
