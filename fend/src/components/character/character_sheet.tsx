import { useState } from 'react'
import { Card, CardTitle, Badge, Button, Avatar } from '@styles/processors/_internal'
import { Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { StatBlock } from './stat_block'
import { Inventory } from './inventory'
import { HpTracker } from './hp_tracker'
import { Edit, Save, X, Shield, Swords, BookOpen, Backpack, User } from 'lucide-react'

export interface Character {
  id: string
  name: string
  race: string
  class: string
  level: number
  background: string
  alignment: string
  imageUrl?: string

  // Core stats
  stats: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }

  // Combat
  ac: number
  hp: { current: number; max: number; temp: number }
  hitDice: { current: number; max: number; die: string }
  speed: number
  initiative: number

  // Proficiencies
  proficiencyBonus: number
  savingThrows: string[]
  skills: string[]
  languages: string[]
  tools: string[]

  // Features
  features: Array<{ name: string; source: string; description: string }>

  // Spellcasting (optional)
  spellcasting?: {
    ability: string
    saveDC: number
    attackBonus: number
    spellSlots: Record<number, { current: number; max: number }>
    knownSpells: Array<{ name: string; level: number; prepared?: boolean }>
  }

  // Equipment
  equipment: Array<{
    id: string
    name: string
    quantity: number
    weight?: number
    equipped?: boolean
  }>
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number }

  // Backstory
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  backstory: string

  // Notes
  notes?: string
}

export interface CharacterSheetProps {
  character: Character
  isEditable?: boolean
  onSave?: (character: Character) => void
}

export function CharacterSheet({ character, isEditable = false, onSave }: CharacterSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedCharacter, setEditedCharacter] = useState(character)

  const handleSave = () => {
    onSave?.(editedCharacter)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedCharacter(character)
    setIsEditing(false)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <Card variant="default" padding="lg" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <Avatar
            src={character.imageUrl}
            name={character.name}
            size="xl"
            style={{ width: 100, height: 100 }}
          />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <CardTitle style={{ fontSize: '1.5rem' }}>{character.name}</CardTitle>
              <Badge variant="warning">Level {character.level}</Badge>
            </div>

            <div style={{ color: '#94a3b8', marginBottom: '12px' }}>
              {character.race} {character.class} • {character.background}
            </div>

            <div style={{ display: 'flex', gap: '24px', fontSize: '0.875rem' }}>
              <StatDisplay icon={<Shield size={16} />} label="AC" value={character.ac} />
              <StatDisplay
                icon={<Swords size={16} />}
                label="Initiative"
                value={character.initiative >= 0 ? `+${character.initiative}` : character.initiative}
              />
              <StatDisplay icon={<User size={16} />} label="Speed" value={`${character.speed} ft`} />
              <StatDisplay
                icon={<BookOpen size={16} />}
                label="Proficiency"
                value={`+${character.proficiencyBonus}`}
              />
            </div>
          </div>

          {isEditable && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {isEditing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    <X size={16} />
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave}>
                    <Save size={16} />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit size={16} />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* HP Tracker */}
      <Card variant="default" padding="md" style={{ marginBottom: '16px' }}>
        <HpTracker
          hp={character.hp}
          hitDice={character.hitDice}
          onChange={(hp) => setEditedCharacter(prev => ({ ...prev, hp }))}
          editable={isEditing}
        />
      </Card>

      {/* Main Content Tabs */}
      <Card variant="default" padding="md">
        <Tabs defaultValue="stats">
          <TabList>
            <Tab value="stats">Stats</Tab>
            <Tab value="features">Features</Tab>
            {character.spellcasting && <Tab value="spells">Spells</Tab>}
            <Tab value="inventory">Inventory</Tab>
            <Tab value="backstory">Backstory</Tab>
          </TabList>

          {/* Stats Tab */}
          <TabPanel value="stats">
            <div style={{ marginTop: '16px' }}>
              <StatBlock stats={character.stats} />

              {/* Saving Throws */}
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '12px' }}>
                  SAVING THROWS
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(ability => {
                    const isProficient = character.savingThrows.includes(ability)
                    const mod = getModifier(character.stats[ability.toLowerCase() as keyof typeof character.stats])
                    const bonus = isProficient ? mod + character.proficiencyBonus : mod

                    return (
                      <Badge
                        key={ability}
                        variant={isProficient ? 'success' : 'default'}
                      >
                        {ability} {bonus >= 0 ? `+${bonus}` : bonus}
                      </Badge>
                    )
                  })}
                </div>
              </div>

              {/* Skills */}
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '12px' }}>
                  SKILLS
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '8px'
                }}>
                  {SKILLS.map(skill => {
                    const isProficient = character.skills.includes(skill.name)
                    const mod = getModifier(character.stats[skill.ability as keyof typeof character.stats])
                    const bonus = isProficient ? mod + character.proficiencyBonus : mod

                    return (
                      <div
                        key={skill.name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          background: isProficient ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                          borderRadius: '4px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span style={{ color: isProficient ? '#22c55e' : '#94a3b8' }}>
                          {skill.name}
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {bonus >= 0 ? `+${bonus}` : bonus}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Features Tab */}
          <TabPanel value="features">
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {character.features.map((feature, i) => (
                <div key={i} style={{
                  padding: '12px',
                  background: '#1e293b',
                  borderRadius: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>{feature.name}</span>
                    <Badge variant="default">{feature.source}</Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </TabPanel>

          {/* Spells Tab */}
          {character.spellcasting && (
            <TabPanel value="spells">
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
                  <StatDisplay label="Spell DC" value={character.spellcasting.saveDC} />
                  <StatDisplay
                    label="Attack Bonus"
                    value={`+${character.spellcasting.attackBonus}`}
                  />
                  <StatDisplay label="Ability" value={character.spellcasting.ability} />
                </div>

                {/* Spell Slots */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '12px' }}>
                    SPELL SLOTS
                  </h4>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {Object.entries(character.spellcasting.spellSlots).map(([level, slots]) => (
                      <div key={level} style={{
                        padding: '8px 12px',
                        background: '#1e293b',
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Level {level}</div>
                        <div style={{ fontWeight: 600 }}>{slots.current}/{slots.max}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Known Spells */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '12px' }}>
                    SPELLS
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {character.spellcasting.knownSpells.map((spell, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#1e293b',
                        borderRadius: '6px',
                      }}>
                        <span>{spell.name}</span>
                        <Badge variant={spell.level === 0 ? 'default' : 'warning'}>
                          {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabPanel>
          )}

          {/* Inventory Tab */}
          <TabPanel value="inventory">
            <div style={{ marginTop: '16px' }}>
              <Inventory
                items={character.equipment}
                currency={character.currency}
                editable={isEditing}
                onChange={(equipment, currency) =>
                  setEditedCharacter(prev => ({ ...prev, equipment, currency }))
                }
              />
            </div>
          </TabPanel>

          {/* Backstory Tab */}
          <TabPanel value="backstory">
            <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
              <TraitBox label="Personality Traits" value={character.personalityTraits} />
              <TraitBox label="Ideals" value={character.ideals} />
              <TraitBox label="Bonds" value={character.bonds} />
              <TraitBox label="Flaws" value={character.flaws} />

              {character.backstory && (
                <div>
                  <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '8px' }}>
                    BACKSTORY
                  </h4>
                  <div style={{
                    padding: '12px',
                    background: '#1e293b',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {character.backstory}
                  </div>
                </div>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </Card>
    </div>
  )
}

function StatDisplay({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {icon && <span style={{ color: '#64748b' }}>{icon}</span>}
      <span style={{ color: '#64748b' }}>{label}:</span>
      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{value}</span>
    </div>
  )
}

function TraitBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '8px' }}>
        {label.toUpperCase()}
      </h4>
      <div style={{
        padding: '12px',
        background: '#1e293b',
        borderRadius: '8px',
        color: '#e2e8f0',
        fontSize: '0.875rem',
        lineHeight: 1.5,
      }}>
        {value}
      </div>
    </div>
  )
}

function getModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

const SKILLS = [
  { name: 'Acrobatics', ability: 'dex' },
  { name: 'Animal Handling', ability: 'wis' },
  { name: 'Arcana', ability: 'int' },
  { name: 'Athletics', ability: 'str' },
  { name: 'Deception', ability: 'cha' },
  { name: 'History', ability: 'int' },
  { name: 'Insight', ability: 'wis' },
  { name: 'Intimidation', ability: 'cha' },
  { name: 'Investigation', ability: 'int' },
  { name: 'Medicine', ability: 'wis' },
  { name: 'Nature', ability: 'int' },
  { name: 'Perception', ability: 'wis' },
  { name: 'Performance', ability: 'cha' },
  { name: 'Persuasion', ability: 'cha' },
  { name: 'Religion', ability: 'int' },
  { name: 'Sleight of Hand', ability: 'dex' },
  { name: 'Stealth', ability: 'dex' },
  { name: 'Survival', ability: 'wis' },
]
