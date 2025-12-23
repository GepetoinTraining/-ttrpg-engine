import { useState, useCallback, useRef, useEffect } from 'react'

export interface FlipState {
  isFlipped: boolean
  isFlipping: boolean
  progress: number // 0-1, where 0.5 is edge-on
  phase: 'front' | 'edge' | 'back'
}

export interface FlipOptions {
  duration?: number
  onMidpoint?: () => void | Promise<void>
  onComplete?: () => void
}

export function useFlip(options: FlipOptions = {}) {
  const { duration = 800, onMidpoint, onComplete } = options

  const [state, setState] = useState<FlipState>({
    isFlipped: false,
    isFlipping: false,
    progress: 0,
    phase: 'front',
  })

  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const midpointFiredRef = useRef(false)

  const animate = useCallback((targetFlipped: boolean) => {
    setState(prev => ({ ...prev, isFlipping: true }))
    startTimeRef.current = performance.now()
    midpointFiredRef.current = false

    const tick = async (now: number) => {
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Determine phase
      let phase: 'front' | 'edge' | 'back'
      if (progress < 0.45) phase = targetFlipped ? 'front' : 'back'
      else if (progress < 0.55) phase = 'edge'
      else phase = targetFlipped ? 'back' : 'front'

      // Fire midpoint callback once
      if (progress >= 0.5 && !midpointFiredRef.current) {
        midpointFiredRef.current = true
        if (onMidpoint) await onMidpoint()
      }

      setState({
        isFlipped: progress >= 0.5 ? targetFlipped : !targetFlipped,
        isFlipping: progress < 1,
        progress,
        phase,
      })

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick)
      } else {
        onComplete?.()
      }
    }

    animationRef.current = requestAnimationFrame(tick)
  }, [duration, onMidpoint, onComplete])

  const flip = useCallback(() => {
    if (state.isFlipping) return
    animate(true)
  }, [state.isFlipping, animate])

  const unflip = useCallback(() => {
    if (state.isFlipping) return
    animate(false)
  }, [state.isFlipping, animate])

  const toggle = useCallback(() => {
    if (state.isFlipping) return
    animate(!state.isFlipped)
  }, [state.isFlipping, state.isFlipped, animate])

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return {
    ...state,
    flip,
    unflip,
    toggle,
  }
}

// Temperature during flip for physics-based glow
export function useFlipTemperature(phase: 'front' | 'edge' | 'back') {
  switch (phase) {
    case 'front': return 'cold'
    case 'edge': return 'hot'  // Peak temperature at edge-on
    case 'back': return 'warm'
  }
}
