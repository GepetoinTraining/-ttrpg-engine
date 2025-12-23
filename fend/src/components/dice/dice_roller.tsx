import { useState, useCallback } from 'react'
import { Card, Button, Badge, Input } from '@styles/processors/_internal'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Plus, Minus } from 'lucide-react'
import { parseRoll, rollDice } from '@utils/dice'

export interface DiceRollerProps {
  onRoll?: (result: RollResult) => void
  showHistory?: boolean
  compact?: boolean
}

export interface RollResult {
  expression: string
  rolls: number[]
  modifier: number
  total: number
  timestamp: Date
}

const QUICK_DICE = [
  { sides: 4, label: 'd4' },
  { sides: 6, label: 'd6' },
  { sides: 8, label: 'd8' },
  { sides: 10, label: 'd10' },
  { sides: 12, label: 'd12' },
  { sides: 20, label: 'd20' },
  { sides: 100, label: 'd100' },
]

export function DiceRoller({ onRoll, showHistory = true, compact = false }: DiceRollerProps) {
  const [expression, setExpression] = useState('')
  const [history, setHistory] = useState<RollResult[]>([])
  const [lastResult, setLastResult] = useState<RollResult | null>(null)
  const [isRolling, setIsRolling] = useState(false)

  const performRoll = useCallback((expr: string) => {
    setIsRolling(true)

    // Brief animation delay
    setTimeout(() => {
      try {
        const parsed = parseRoll(expr)
        const rolls = rollDice(parsed.count, parsed.sides)
        const total = rolls.reduce((a, b) => a + b, 0) + parsed.modifier

        const result: RollResult = {
          expression: expr,
          rolls,
          modifier: parsed.modifier,
          total,
          timestamp: new Date(),
        }

        setLastResult(result)
        setHistory(prev => [result, ...prev].slice(0, 20))
        onRoll?.(result)
      } catch (e) {
        console.error('Invalid roll expression:', expr)
      }
      setIsRolling(false)
    }, 300)
  }, [onRoll])

  const handleQuickRoll = (sides: number) => {
    performRoll(`1d${sides}`)
  }

  const handleCustomRoll = () => {
    if (expression.trim()) {
      performRoll(expression.trim())
      setExpression('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomRoll()
    }
  }

  const clearHistory = () => {
    setHistory([])
    setLastResult(null)
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {QUICK_DICE.slice(0, 4).map(d => (
            <button
              key={d.sides}
              onClick={() => handleQuickRoll(d.sides)}
              style={{
                padding: '6px 10px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        {lastResult && (
          <Badge variant="warning" style={{ fontSize: '1rem', padding: '6px 12px' }}>
            {lastResult.total}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card variant="default" padding="md">
      {/* Quick Dice */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '0.75rem',
          color: '#64748b',
          marginBottom: '8px',
          fontWeight: 600,
        }}>
          QUICK ROLL
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {QUICK_DICE.map(d => (
            <button
              key={d.sides}
              onClick={() => handleQuickRoll(d.sides)}
              disabled={isRolling}
              style={{
                padding: '10px 16px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Expression */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '0.75rem',
          color: '#64748b',
          marginBottom: '8px',
          fontWeight: 600,
        }}>
          CUSTOM ROLL
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g. 2d6+3, 4d8-2, d20"
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '0.9375rem',
              outline: 'none',
            }}
          />
          <Button variant="primary" onClick={handleCustomRoll} disabled={!expression.trim() || isRolling}>
            Roll
          </Button>
        </div>
      </div>

      {/* Result Display */}
      {lastResult && (
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.1))',
          borderRadius: '12px',
          border: '1px solid rgba(245,158,11,0.2)',
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          <div style={{
            fontSize: '0.875rem',
            color: '#94a3b8',
            marginBottom: '8px',
          }}>
            {lastResult.expression}
          </div>

          <div style={{
            fontSize: '3rem',
            fontWeight: 700,
            color: '#f59e0b',
            lineHeight: 1,
            marginBottom: '8px',
            animation: isRolling ? 'shake 0.3s' : 'none',
          }}>
            {lastResult.total}
          </div>

          {lastResult.rolls.length > 1 && (
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              [{lastResult.rolls.join(', ')}]
              {lastResult.modifier !== 0 && (
                <span style={{ color: lastResult.modifier > 0 ? '#22c55e' : '#ef4444' }}>
                  {lastResult.modifier > 0 ? ' + ' : ' - '}{Math.abs(lastResult.modifier)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && history.length > 0 && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              HISTORY
            </span>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <RotateCcw size={12} /> Clear
            </Button>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '150px',
            overflowY: 'auto',
          }}>
            {history.slice(0, 10).map((roll, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: i === 0 ? 'rgba(245,158,11,0.1)' : 'transparent',
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: '#94a3b8' }}>{roll.expression}</span>
                <span style={{
                  color: i === 0 ? '#f59e0b' : '#e2e8f0',
                  fontWeight: i === 0 ? 600 : 400,
                }}>
                  {roll.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
