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

import { Φ, field, getDefinition } from '../index'
import { Button } from '../atomic/button'
import { OnboardingForm, type OnboardingData } from '../molecular/onboarding_form'

// ============================================
// TYPES
// ============================================

export type { OnboardingData, UserRole } from '../molecular/onboarding_form'

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
  // Get physics from definitions
  const containerPhysics = getDefinition('OnboardingContainer', 'default')
  const cardPhysics = getDefinition('OnboardingCard', 'default')

  const containerTensor = Φ(field('OnboardingContainer', containerPhysics))
  const cardTensor = Φ(field('OnboardingCard', cardPhysics))

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
            Let's get you set up for your journey
          </p>
        </div>

        {/* Onboarding Form */}
        <OnboardingForm
          onComplete={onComplete}
          defaultName={defaultName}
          isLoading={isLoading}
        />

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
