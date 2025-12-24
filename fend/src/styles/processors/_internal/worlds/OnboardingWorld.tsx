/**
 * ONBOARDING WORLD
 * =================
 *
 * First-time user flow. Collects:
 * - Display name
 * - Role preference (Player / GM / Both)
 * - Optional: pronouns, timezone
 *
 * Uses Φ physics for all styling via proper component hierarchy.
 */

import { useState, type FormEvent } from 'react'
import { Φ, field, getDefinition } from '../index'
import { Button } from '../atomic/button'
import { Input } from '../atomic/input'
import { ProgressDots } from '../atomic/progress_dots'
import { RoleCard } from '../molecular/role_card'

// ============================================
// TYPES
// ============================================

export type UserRole = 'player' | 'gm' | 'both'

export interface OnboardingData {
  displayName: string
  role: UserRole
  pronouns?: string
  timezone?: string
}

export interface OnboardingWorldProps {
  onComplete: (data: OnboardingData) => void
  onSkip?: () => void
  defaultName?: string
  isLoading?: boolean
}

// ============================================
// ONBOARDING WORLD
// ============================================

export function OnboardingWorld({
  onComplete,
  onSkip,
  defaultName = '',
  isLoading = false,
}: OnboardingWorldProps) {
  const [step, setStep] = useState<'name' | 'role' | 'extras'>('name')
  const [displayName, setDisplayName] = useState(defaultName)
  const [role, setRole] = useState<UserRole | null>(null)
  const [pronouns, setPronouns] = useState('')
  const [nameError, setNameError] = useState('')

  // Get physics from definitions
  const containerPhysics = getDefinition('OnboardingContainer', 'default')
  const cardPhysics = getDefinition('OnboardingCard', 'default')

  const containerTensor = Φ(field('OnboardingContainer', containerPhysics))
  const cardTensor = Φ(field('OnboardingCard', cardPhysics))

  const handleNameSubmit = () => {
    if (!displayName.trim()) {
      setNameError('Please enter a display name')
      return
    }
    if (displayName.trim().length < 2) {
      setNameError('Name must be at least 2 characters')
      return
    }
    setNameError('')
    setStep('role')
  }

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole)
    setStep('extras')
  }

  const handleComplete = (e: FormEvent) => {
    e.preventDefault()
    if (!displayName.trim() || !role) return

    onComplete({
      displayName: displayName.trim(),
      role,
      pronouns: pronouns.trim() || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }

  const canComplete = displayName.trim().length >= 2 && role !== null

  return (
    <div style={{
      ...parseInlineStyle(containerTensor.css),
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: 24,
    }}>
      <div style={{
        ...parseInlineStyle(cardTensor.css),
        width: '100%',
        maxWidth: 480,
        padding: 32,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎲</div>
          <h1 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#f8fafc',
            fontFamily: '"Crimson Pro", Georgia, serif',
          }}>
            Welcome, Adventurer
          </h1>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '0.9375rem',
            color: '#94a3b8',
          }}>
            {step === 'name' && "Let's get you set up for your journey"}
            {step === 'role' && "What brings you to the table?"}
            {step === 'extras' && "Almost there! Any final touches?"}
          </p>
        </div>

        {/* Progress Dots */}
        <ProgressDots
          steps={['name', 'role', 'extras']}
          current={step}
        />

        <form onSubmit={handleComplete}>
          {/* Step 1: Name */}
          {step === 'name' && (
            <div style={{ marginTop: 24 }}>
              <Input
                label="What should we call you?"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={nameError}
                autoFocus
              />

              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <Button
                  variant="primary"
                  onClick={handleNameSubmit}
                  disabled={!displayName.trim()}
                  style={{ flex: 1 }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Role */}
          {step === 'role' && (
            <div style={{ marginTop: 24 }}>
              <div style={{
                display: 'grid',
                gap: 12,
              }}>
                <RoleCard
                  icon="⚔️"
                  title="Player"
                  description="Join campaigns and bring characters to life"
                  selected={role === 'player'}
                  onClick={() => handleRoleSelect('player')}
                />
                <RoleCard
                  icon="📖"
                  title="Game Master"
                  description="Create worlds and run epic adventures"
                  selected={role === 'gm'}
                  onClick={() => handleRoleSelect('gm')}
                />
                <RoleCard
                  icon="🎭"
                  title="Both"
                  description="Switch between player and GM as needed"
                  selected={role === 'both'}
                  onClick={() => handleRoleSelect('both')}
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <Button
                  variant="secondary"
                  onClick={() => setStep('name')}
                  style={{ width: '100%' }}
                >
                  ← Back
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Extras */}
          {step === 'extras' && (
            <div style={{ marginTop: 24 }}>
              <Input
                label="Pronouns (optional)"
                placeholder="e.g., they/them, she/her, he/him"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
              />

              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: 8,
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}>
                <div style={{
                  fontSize: '0.8125rem',
                  color: '#f59e0b',
                  fontWeight: 500,
                }}>
                  Your timezone
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#fcd34d',
                  marginTop: 4,
                }}>
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <Button
                  variant="secondary"
                  onClick={() => setStep('role')}
                >
                  ← Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canComplete}
                  loading={isLoading}
                  style={{ flex: 1 }}
                >
                  {isLoading ? 'Setting up...' : "Let's Go!"}
                </Button>
              </div>
            </div>
          )}
        </form>

        {/* Skip option */}
        {onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            style={{
              marginTop: 24,
              width: '100%',
            }}
          >
            Skip for now
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================
// HELPER: Parse CSS string to object
// ============================================

function parseInlineStyle(styleString: string): React.CSSProperties {
  const style: Record<string, string> = {}

  styleString
    .split(';')
    .filter(Boolean)
    .forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim())
      if (property && value) {
        const camelProperty = property.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
        style[camelProperty] = value
      }
    })

  return style as React.CSSProperties
}

// ============================================
// EXPORT
// ============================================

export default OnboardingWorld
