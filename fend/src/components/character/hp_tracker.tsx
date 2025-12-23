import { useState } from 'react'
import { Button, Badge, Input } from '@styles/processors/_internal'
import { Heart, Shield, Zap, Plus, Minus, RotateCcw } from 'lucide-react'

export interface HpTrackerProps {
  hp: {
    current: number
    max: number
    temp: number
  }
  hitDice?: {
    current: number
    max: number
    die: string
  }
  editable?: boolean
  onChange?: (hp: { current: number; max: number; temp: number }) => void
  onHitDiceChange?: (hitDice: { current: number; max: number; die: string }) => void
}

export function HpTracker({
  hp,
  hitDice,
  editable = false,
  onChange,
  onHitDiceChange,
}: HpTrackerProps) {
  const [damageInput, setDamageInput] = useState('')
  const [healInput, setHealInput] = useState('')
  const [tempInput, setTempInput] = useState('')

  const hpPercentage = Math.max(0, Math.min(100, (hp.current / hp.max) * 100))

  const getHpColor = () => {
    if (hpPercentage <= 25) return '#ef4444'
    if (hpPercentage <= 50) return '#f59e0b'
    return '#22c55e'
  }

  const applyDamage = () => {
    const damage = parseInt(damageInput) || 0
    if (damage <= 0) return

    let remaining = damage
    let newTemp = hp.temp
    let newCurrent = hp.current

    // Temp HP absorbs first
    if (newTemp > 0) {
      if (remaining >= newTemp) {
        remaining -= newTemp
        newTemp = 0
      } else {
        newTemp -= remaining
        remaining = 0
      }
    }

    // Then regular HP
    newCurrent = Math.max(0, newCurrent - remaining)

    onChange?.({ ...hp, current: newCurrent, temp: newTemp })
    setDamageInput('')
  }

  const applyHealing = () => {
    const healing = parseInt(healInput) || 0
    if (healing <= 0) return

    const newCurrent = Math.min(hp.max, hp.current + healing)
    onChange?.({ ...hp, current: newCurrent })
    setHealInput('')
  }

  const applyTempHp = () => {
    const temp = parseInt(tempInput) || 0
    if (temp <= 0) return

    // Temp HP doesn't stack, take higher
    const newTemp = Math.max(hp.temp, temp)
    onChange?.({ ...hp, temp: newTemp })
    setTempInput('')
  }

  const useHitDie = () => {
    if (!hitDice || hitDice.current <= 0) return

    // Roll the hit die (simplified - just use average + CON mod would be added by caller)
    const dieMax = parseInt(hitDice.die.replace('d', ''))
    const roll = Math.floor(Math.random() * dieMax) + 1
    const healing = Math.max(1, roll) // Minimum 1 HP

    const newCurrent = Math.min(hp.max, hp.current + healing)
    onChange?.({ ...hp, current: newCurrent })
    onHitDiceChange?.({ ...hitDice, current: hitDice.current - 1 })
  }

  const resetHp = () => {
    onChange?.({ current: hp.max, max: hp.max, temp: 0 })
    if (hitDice) {
      onHitDiceChange?.({ ...hitDice, current: hitDice.max })
    }
  }

  return (
    <div>
      {/* HP Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={20} style={{ color: getHpColor() }} />
            <span style={{ fontWeight: 600, fontSize: '1.25rem', color: getHpColor() }}>
              {hp.current}
            </span>
            <span style={{ color: '#64748b' }}>/ {hp.max}</span>
            {hp.temp > 0 && (
              <Badge variant="info" style={{ marginLeft: '4px' }}>
                <Shield size={12} /> +{hp.temp}
              </Badge>
            )}
          </div>

          {editable && (
            <Button variant="ghost" size="sm" onClick={resetHp} title="Full Rest">
              <RotateCcw size={14} />
            </Button>
          )}
        </div>

        {/* HP Bar Visual */}
        <div style={{
          height: '12px',
          background: '#1e293b',
          borderRadius: '6px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Temp HP overlay */}
          {hp.temp > 0 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${Math.min(100, ((hp.current + hp.temp) / hp.max) * 100)}%`,
              background: '#0ea5e9',
              opacity: 0.5,
              borderRadius: '6px',
            }} />
          )}
          {/* Current HP */}
          <div style={{
            position: 'relative',
            height: '100%',
            width: `${hpPercentage}%`,
            background: getHpColor(),
            borderRadius: '6px',
            transition: 'width 300ms, background-color 300ms',
          }} />
        </div>
      </div>

      {/* Quick Actions */}
      {editable && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}>
          {/* Damage */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
              DAMAGE
            </label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <input
                type="number"
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                }}
                onKeyPress={(e) => e.key === 'Enter' && applyDamage()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={applyDamage}
                style={{ color: '#ef4444' }}
              >
                <Minus size={16} />
              </Button>
            </div>
          </div>

          {/* Healing */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 500 }}>
              HEAL
            </label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <input
                type="number"
                value={healInput}
                onChange={(e) => setHealInput(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#22c55e',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                }}
                onKeyPress={(e) => e.key === 'Enter' && applyHealing()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={applyHealing}
                style={{ color: '#22c55e' }}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>

          {/* Temp HP */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#0ea5e9', fontWeight: 500 }}>
              TEMP HP
            </label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <input
                type="number"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#0ea5e9',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                }}
                onKeyPress={(e) => e.key === 'Enter' && applyTempHp()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={applyTempHp}
                style={{ color: '#0ea5e9' }}
              >
                <Shield size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hit Dice */}
      {hitDice && (
        <div style={{
          padding: '12px',
          background: '#1e293b',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Hit Dice</span>
            <span style={{ fontWeight: 600 }}>
              {hitDice.current}/{hitDice.max} {hitDice.die}
            </span>
          </div>

          {editable && hitDice.current > 0 && hp.current < hp.max && (
            <Button
              variant="ghost"
              size="sm"
              onClick={useHitDie}
              style={{ color: '#f59e0b' }}
            >
              Use {hitDice.die}
            </Button>
          )}
        </div>
      )}

      {/* Death Saves (shown when at 0 HP) */}
      {hp.current === 0 && (
        <DeathSaves />
      )}
    </div>
  )
}

function DeathSaves() {
  const [successes, setSuccesses] = useState(0)
  const [failures, setFailures] = useState(0)

  const toggleSuccess = (index: number) => {
    setSuccesses(prev => index < prev ? index : index + 1)
  }

  const toggleFailure = (index: number) => {
    setFailures(prev => index < prev ? index : index + 1)
  }

  const reset = () => {
    setSuccesses(0)
    setFailures(0)
  }

  return (
    <div style={{
      marginTop: '16px',
      padding: '16px',
      background: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{ fontWeight: 600, color: '#ef4444' }}>Death Saves</span>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw size={14} />
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Successes */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#22c55e', marginBottom: '6px' }}>
            Successes
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map(i => (
              <button
                key={i}
                onClick={() => toggleSuccess(i)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: i < successes ? '#22c55e' : 'transparent',
                  border: `2px solid ${i < successes ? '#22c55e' : '#334155'}`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        {/* Failures */}
        <div>
          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '6px' }}>
            Failures
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map(i => (
              <button
                key={i}
                onClick={() => toggleFailure(i)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: i < failures ? '#ef4444' : 'transparent',
                  border: `2px solid ${i < failures ? '#ef4444' : '#334155'}`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {successes >= 3 && (
        <div style={{ marginTop: '12px', color: '#22c55e', fontWeight: 500 }}>
          Stabilized! 🎉
        </div>
      )}
      {failures >= 3 && (
        <div style={{ marginTop: '12px', color: '#ef4444', fontWeight: 500 }}>
          💀
        </div>
      )}
    </div>
  )
}
