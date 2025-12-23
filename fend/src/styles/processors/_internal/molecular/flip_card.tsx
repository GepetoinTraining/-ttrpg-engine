import { Φ, field, getDefinition } from '../index'
import { useState, useCallback, useRef, useEffect } from 'react'
import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// FLIP CARD MOLECULE
// ============================================

export interface FlipCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onLoad'> {
  front: ReactNode
  back: ReactNode | (() => Promise<ReactNode>)
  flipped?: boolean
  onFlip?: (isFlipped: boolean) => void
  onBackLoaded?: () => void
  flipDuration?: number
}

export function FlipCard({
  front,
  back,
  flipped: controlledFlipped,
  onFlip,
  onBackLoaded,
  flipDuration = 800,
  className = '',
  style,
  ...props
}: FlipCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false)
  const [backContent, setBackContent] = useState<ReactNode | null>(
    typeof back === 'function' ? null : back
  )
  const [isLoading, setIsLoading] = useState(false)
  const hasLoadedBack = useRef(false)

  // Controlled vs uncontrolled
  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped

  // Physics for the card
  const frontPhysics = getDefinition('Card', 'scene')
  const backPhysics = getDefinition('Card', 'combat')
  const frontTensor = Φ(field('FlipCard.Front', frontPhysics))
  const backTensor = Φ(field('FlipCard.Back', backPhysics))

  // Temperature for edge glow during flip
  const glowColor = isFlipped ? 'rgba(239, 68, 68, 0.4)' : 'transparent'

  // Load back content at 90° rotation
  const loadBackContent = useCallback(async () => {
    if (hasLoadedBack.current || typeof back !== 'function') return

    setIsLoading(true)
    try {
      const content = await back()
      setBackContent(content)
      hasLoadedBack.current = true
      onBackLoaded?.()
    } catch (error) {
      console.error('Failed to load flip card back:', error)
      setBackContent(
        <div style={{ padding: 20, color: '#ef4444' }}>
          Failed to load content
        </div>
      )
    } finally {
      setIsLoading(false)
    }
  }, [back, onBackLoaded])

  // Trigger back load when flip starts
  useEffect(() => {
    if (isFlipped && typeof back === 'function' && !hasLoadedBack.current) {
      // Delay load until card is edge-on
      const timer = setTimeout(loadBackContent, flipDuration / 2)
      return () => clearTimeout(timer)
    }
  }, [isFlipped, back, flipDuration, loadBackContent])

  const handleFlip = useCallback(() => {
    const newFlipped = !isFlipped

    if (controlledFlipped === undefined) {
      setInternalFlipped(newFlipped)
    }

    onFlip?.(newFlipped)
  }, [isFlipped, controlledFlipped, onFlip])

  return (
    <div
      className={className}
      style={{
        perspective: '1000px',
        width: '100%',
        height: '100%',
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: `transform ${flipDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          boxShadow: `0 0 30px ${glowColor}`,
        }}
      >
        {/* FRONT FACE */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            ...parseInlineStyle(frontTensor.css),
            overflow: 'auto',
          }}
        >
          {front}
        </div>

        {/* BACK FACE */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            ...parseInlineStyle(backTensor.css),
            overflow: 'auto',
          }}
        >
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94a3b8',
            }}>
              Preparing battle...
            </div>
          ) : backContent}
        </div>
      </div>
    </div>
  )
}

// Hook for flip card control
export function useFlipCard() {
  const [isFlipped, setIsFlipped] = useState(false)

  const flip = useCallback(() => setIsFlipped(true), [])
  const unflip = useCallback(() => setIsFlipped(false), [])
  const toggle = useCallback(() => setIsFlipped(f => !f), [])

  return { isFlipped, flip, unflip, toggle, setIsFlipped }
}

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
