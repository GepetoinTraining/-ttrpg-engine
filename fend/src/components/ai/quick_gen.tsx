import { useState } from 'react'
import { Card, Button, Badge, Input, Dropdown } from '@styles/processors/_internal'
import { Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { Sparkles, User, Swords, Gift, Dice6, Copy, Check, RefreshCw } from 'lucide-react'
import { trpc } from '@api/trpc'

export interface QuickGenProps {
  campaignId: string
  currentLocation?: string
  partyLevel?: number
  onInsertNpc?: (npc: any) => void
  onInsertEncounter?: (encounter: any) => void
  onInsertLoot?: (loot: any) => void
}

export function QuickGen({
  campaignId,
  currentLocation,
  partyLevel = 1,
  onInsertNpc,
  onInsertEncounter,
  onInsertLoot,
}: QuickGenProps) {
  const [activeTab, setActiveTab] = useState('npc')

  return (
    <Card variant="default" padding="md">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Sparkles size={20} style={{ color: '#f59e0b' }} />
        <span style={{ fontWeight: 600, color: '#f8fafc' }}>Quick Generate</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabList>
          <Tab value="npc"><User size={14} /> NPC</Tab>
          <Tab value="encounter"><Swords size={14} /> Encounter</Tab>
          <Tab value="loot"><Gift size={14} /> Loot</Tab>
        </TabList>

        <TabPanel value="npc">
          <NpcGenerator
            campaignId={campaignId}
            currentLocation={currentLocation}
            onInsert={onInsertNpc}
          />
        </TabPanel>

        <TabPanel value="encounter">
          <EncounterGenerator
            campaignId={campaignId}
            partyLevel={partyLevel}
            onInsert={onInsertEncounter}
          />
        </TabPanel>

        <TabPanel value="loot">
          <LootGenerator
            partyLevel={partyLevel}
            onInsert={onInsertLoot}
          />
        </TabPanel>
      </Tabs>
    </Card>
  )
}

function NpcGenerator({
  campaignId,
  currentLocation,
  onInsert,
}: {
  campaignId: string
  currentLocation?: string
  onInsert?: (npc: any) => void
}) {
  const [role, setRole] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const genMutation = trpc.ai.generateNpc.useMutation({
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const handleGenerate = () => {
    genMutation.mutate({
      campaignId,
      role: role || undefined,
      location: currentLocation,
      context: context || undefined,
    })
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
        <Input
          label="Role (optional)"
          placeholder="e.g. tavern keeper, guard captain, merchant"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <Input
          label="Additional context"
          placeholder="e.g. suspicious, has a secret, knows about the heist"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <Button
        variant="primary"
        onClick={handleGenerate}
        loading={genMutation.isPending}
        style={{ width: '100%' }}
      >
        <Dice6 size={16} /> Generate NPC
      </Button>

      {result && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#1e293b',
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>{result.name}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleGenerate}>
                <RefreshCw size={14} />
              </Button>
            </div>
          </div>

          <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '8px' }}>
            {result.role}
          </div>

          <p style={{ color: '#e2e8f0', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '12px' }}>
            {result.description}
          </p>

          {result.personality && (
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              <strong>Personality:</strong> {result.personality}
            </div>
          )}

          {onInsert && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onInsert(result)}
              style={{ marginTop: '12px', width: '100%' }}
            >
              Insert into Campaign
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function EncounterGenerator({
  campaignId,
  partyLevel,
  onInsert,
}: {
  campaignId: string
  partyLevel: number
  onInsert?: (encounter: any) => void
}) {
  const [difficulty, setDifficulty] = useState<string>('medium')
  const [environment, setEnvironment] = useState('')
  const [result, setResult] = useState<any>(null)

  const genMutation = trpc.ai.generateEncounter.useMutation({
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const handleGenerate = () => {
    genMutation.mutate({
      campaignId,
      partyLevel,
      difficulty: difficulty as any,
      environment: environment || undefined,
    })
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '4px' }}>
            Difficulty
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['easy', 'medium', 'hard', 'deadly'].map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: difficulty === d ? getDifficultyColor(d) : '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: difficulty === d ? '#0f172a' : '#e2e8f0',
                  fontSize: '0.8125rem',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  fontWeight: difficulty === d ? 600 : 400,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Environment"
          placeholder="e.g. forest, dungeon, city streets"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
        />
      </div>

      <Button
        variant="primary"
        onClick={handleGenerate}
        loading={genMutation.isPending}
        style={{ width: '100%' }}
      >
        <Swords size={16} /> Generate Encounter
      </Button>

      {result && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#1e293b',
          borderRadius: '8px',
        }}>
          <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '12px' }}>
            {result.name}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>ENEMIES</div>
            {result.enemies?.map((enemy: any, i: number) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0',
                fontSize: '0.875rem',
                color: '#e2e8f0',
              }}>
                <span>{enemy.count}× {enemy.name}</span>
                <Badge variant="default">CR {enemy.cr}</Badge>
              </div>
            ))}
          </div>

          {result.tactics && (
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              <strong>Tactics:</strong> {result.tactics}
            </div>
          )}

          {onInsert && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onInsert(result)}
              style={{ marginTop: '12px', width: '100%' }}
            >
              Add to Session
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function LootGenerator({
  partyLevel,
  onInsert,
}: {
  partyLevel: number
  onInsert?: (loot: any) => void
}) {
  const [tier, setTier] = useState<string>('individual')
  const [result, setResult] = useState<any>(null)

  const genMutation = trpc.ai.generateLoot.useMutation({
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const handleGenerate = () => {
    genMutation.mutate({
      partyLevel,
      tier: tier as any,
    })
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '4px' }}>
          Loot Tier
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['individual', 'hoard', 'boss'].map(t => (
            <button
              key={t}
              onClick={() => setTier(t)}
              style={{
                flex: 1,
                padding: '8px',
                background: tier === t ? '#f59e0b' : '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: tier === t ? '#0f172a' : '#e2e8f0',
                fontSize: '0.8125rem',
                textTransform: 'capitalize',
                cursor: 'pointer',
                fontWeight: tier === t ? 600 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        onClick={handleGenerate}
        loading={genMutation.isPending}
        style={{ width: '100%' }}
      >
        <Gift size={16} /> Generate Loot
      </Button>

      {result && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#1e293b',
          borderRadius: '8px',
        }}>
          {result.gold > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '1.25rem',
              color: '#f59e0b',
              fontWeight: 600,
            }}>
              💰 {result.gold} gp
            </div>
          )}

          {result.items?.length > 0 && (
            <div>
              {result.items.map((item: any, i: number) => (
                <div key={i} style={{
                  padding: '8px 0',
                  borderBottom: i < result.items.length - 1 ? '1px solid #334155' : 'none',
                }}>
                  <div style={{
                    fontWeight: 500,
                    color: getRarityColor(item.rarity),
                  }}>
                    {item.name}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                      {item.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {onInsert && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onInsert(result)}
              style={{ marginTop: '12px', width: '100%' }}
            >
              Add to Session
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return '#22c55e'
    case 'medium': return '#f59e0b'
    case 'hard': return '#ef4444'
    case 'deadly': return '#ec4899'
    default: return '#64748b'
  }
}

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#94a3b8'
    case 'uncommon': return '#22c55e'
    case 'rare': return '#0ea5e9'
    case 'very_rare': return '#8b5cf6'
    case 'legendary': return '#f59e0b'
    default: return '#e2e8f0'
  }
}
