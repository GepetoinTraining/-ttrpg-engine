import { useState } from 'react'
import { Modal, Button, Badge, Card } from '@styles/processors/_internal'
import { ArrowUp, Heart, Sparkles, Star, Check } from 'lucide-react'

export interface LevelUpModalProps {
  open: boolean
  onClose: () => void
  character: {
    id: string
    name: string
    class: string
    currentLevel: number
    newLevel: number
  }
  choices: {
    hitDie: number
    hpRoll?: number
    abilityScoreIncrease?: boolean
    featChoices?: Array<{ id: string; name: string; description: string }>
    classFeatures: Array<{ name: string; description: string }>
    spellsToLearn?: number
  }
  onConfirm: (selections: LevelUpSelections) => void
}

export interface LevelUpSelections {
  hpChoice: 'roll' | 'average'
  hpGained: number
  abilityScores?: { first: string; second: string } | { feat: string }
  newSpells?: string[]
}

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export function LevelUpModal({
  open,
  onClose,
  character,
  choices,
  onConfirm,
}: LevelUpModalProps) {
  const [hpChoice, setHpChoice] = useState<'roll' | 'average'>('average')
  const [rolledHp, setRolledHp] = useState<number | null>(choices.hpRoll ?? null)
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  const [selectedFeat, setSelectedFeat] = useState<string | null>(null)

  const averageHp = Math.ceil(choices.hitDie / 2) + 1
  const hpGained = hpChoice === 'roll' ? (rolledHp ?? averageHp) : averageHp

  const handleRollHp = () => {
    const roll = Math.floor(Math.random() * choices.hitDie) + 1
    setRolledHp(roll)
    setHpChoice('roll')
  }

  const toggleAbility = (ability: string) => {
    if (selectedFeat) return
    if (selectedAbilities.includes(ability)) {
      setSelectedAbilities(prev => prev.filter(a => a !== ability))
    } else if (selectedAbilities.length < 2) {
      setSelectedAbilities(prev => [...prev, ability])
    }
  }

  const selectFeat = (featId: string) => {
    setSelectedFeat(featId)
    setSelectedAbilities([])
  }

  const handleConfirm = () => {
    const selections: LevelUpSelections = {
      hpChoice,
      hpGained,
    }

    if (choices.abilityScoreIncrease) {
      if (selectedFeat) {
        selections.abilityScores = { feat: selectedFeat }
      } else if (selectedAbilities.length === 2) {
        selections.abilityScores = { first: selectedAbilities[0], second: selectedAbilities[1] }
      }
    }

    onConfirm(selections)
    onClose()
  }

  const canConfirm = () => {
    if (choices.abilityScoreIncrease) {
      return selectedFeat || selectedAbilities.length === 2
    }
    return true
  }

  return (
    <Modal open={open} onClose={onClose} title="Level Up!" size="lg">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,88,12,0.2))',
          borderRadius: '12px',
          border: '1px solid rgba(245,158,11,0.3)',
        }}>
          <Star size={24} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fcd34d' }}>
            {character.name}
          </span>
          <Badge variant="warning" style={{ fontSize: '1rem', padding: '4px 12px' }}>
            Level {character.currentLevel} → {character.newLevel}
          </Badge>
        </div>
      </div>

      {/* HP Section */}
      <Card variant="default" padding="md" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Heart size={18} style={{ color: '#ef4444' }} />
          <span style={{ fontWeight: 600 }}>Hit Points</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => setHpChoice('average')}
            style={{
              padding: '16px',
              background: hpChoice === 'average' ? 'rgba(34,197,94,0.2)' : '#1e293b',
              border: hpChoice === 'average' ? '2px solid #22c55e' : '1px solid #334155',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>
              +{averageHp}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Average</div>
          </button>

          <button
            onClick={handleRollHp}
            style={{
              padding: '16px',
              background: hpChoice === 'roll' ? 'rgba(14,165,233,0.2)' : '#1e293b',
              border: hpChoice === 'roll' ? '2px solid #0ea5e9' : '1px solid #334155',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0ea5e9' }}>
              {rolledHp !== null ? `+${rolledHp}` : `1d${choices.hitDie}`}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              {rolledHp !== null ? 'Rolled!' : 'Click to Roll'}
            </div>
          </button>
        </div>
      </Card>

      {/* ASI / Feat Section */}
      {choices.abilityScoreIncrease && (
        <Card variant="default" padding="md" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <ArrowUp size={18} style={{ color: '#8b5cf6' }} />
            <span style={{ fontWeight: 600 }}>Ability Score Increase</span>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '16px' }}>
            Choose two abilities to increase by 1, or select a feat.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {ABILITIES.map(ability => (
              <button
                key={ability}
                onClick={() => toggleAbility(ability)}
                disabled={!!selectedFeat}
                style={{
                  padding: '12px 8px',
                  background: selectedAbilities.includes(ability) ? 'rgba(139,92,246,0.2)' : '#1e293b',
                  border: selectedAbilities.includes(ability) ? '2px solid #8b5cf6' : '1px solid #334155',
                  borderRadius: '8px',
                  cursor: selectedFeat ? 'not-allowed' : 'pointer',
                  opacity: selectedFeat ? 0.5 : 1,
                }}
              >
                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{ability}</div>
                {selectedAbilities.includes(ability) && (
                  <div style={{ fontSize: '0.75rem', color: '#8b5cf6' }}>+1</div>
                )}
              </button>
            ))}
          </div>

          {choices.featChoices && choices.featChoices.length > 0 && (
            <>
              <div style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.8125rem',
                margin: '12px 0',
              }}>
                — OR —
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {choices.featChoices.map(feat => (
                  <button
                    key={feat.id}
                    onClick={() => selectFeat(feat.id)}
                    style={{
                      padding: '12px',
                      background: selectedFeat === feat.id ? 'rgba(245,158,11,0.2)' : '#1e293b',
                      border: selectedFeat === feat.id ? '2px solid #f59e0b' : '1px solid #334155',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#f59e0b' }}>{feat.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                      {feat.description}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Class Features */}
      {choices.classFeatures.length > 0 && (
        <Card variant="default" padding="md" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={18} style={{ color: '#22c55e' }} />
            <span style={{ fontWeight: 600 }}>New Class Features</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {choices.classFeatures.map((feature, i) => (
              <div key={i}>
                <div style={{ fontWeight: 500, color: '#e2e8f0' }}>{feature.name}</div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px' }}>
                  {feature.description}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm()}>
          <Check size={18} /> Confirm Level Up
        </Button>
      </div>
    </Modal>
  )
}
