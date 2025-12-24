import { useState, type FormEvent } from 'react'
import { Button } from '../atomic/button'
import { Input } from '../atomic/input'
import { ProgressDots } from '../atomic/progress_dots'
import { RoleCard } from './role_card'

// ============================================
// ONBOARDING FORM MOLECULE
// ============================================

export type UserRole = 'player' | 'gm' | 'both'

export interface OnboardingData {
  displayName: string
  role: UserRole
  pronouns?: string
  timezone?: string
}

export interface OnboardingFormProps {
  onComplete: (data: OnboardingData) => void
  defaultName?: string
  isLoading?: boolean
}

export function OnboardingForm({
  onComplete,
  defaultName = '',
  isLoading = false,
}: OnboardingFormProps) {
  const [step, setStep] = useState<'name' | 'role' | 'extras'>('name')
  const [displayName, setDisplayName] = useState(defaultName)
  const [role, setRole] = useState<UserRole | null>(null)
  const [pronouns, setPronouns] = useState('')
  const [nameError, setNameError] = useState('')

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
    <>
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
    </>
  )
}
