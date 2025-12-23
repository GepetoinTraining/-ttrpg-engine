import { useMemo, useRef } from 'react'
import { Φ, field, getDefinition } from '@styles/processors/_internal'
import type { Physics, Tensor, Field } from '@styles/processors/_internal'

// Global vacuum cache for tensor memoization
const vacuum = new Map<string, Tensor>()

export function useTensor(fieldConfig: Field): Tensor {
  return useMemo(() => Φ(fieldConfig, vacuum), [
    fieldConfig.type,
    JSON.stringify(fieldConfig.physics),
  ])
}

export function useComponentTensor(component: string, variant: string = 'default', overrides?: Partial<Physics>): Tensor {
  return useMemo(() => {
    const basePhysics = getDefinition(component, variant)
    const physics = overrides ? { ...basePhysics, ...overrides } : basePhysics
    return Φ(field(component, physics), vacuum)
  }, [component, variant, JSON.stringify(overrides)])
}

export function useDynamicTensor(
  component: string,
  getPhysics: () => Partial<Physics>,
  deps: any[]
): Tensor {
  return useMemo(() => {
    const physics = getPhysics()
    return Φ(field(component, physics), vacuum)
  }, deps)
}

export function useInteractionTensor(
  component: string,
  baseVariant: string,
  states: {
    isHovered?: boolean
    isPressed?: boolean
    isFocused?: boolean
    isDisabled?: boolean
    isSelected?: boolean
  }
): Tensor {
  return useMemo(() => {
    let variant = baseVariant
    let overrides: Partial<Physics> = {}

    if (states.isDisabled) {
      variant = 'disabled'
    } else if (states.isPressed) {
      overrides.temperature = 'hot'
      overrides.mass = 0.8
    } else if (states.isSelected) {
      overrides.temperature = 'hot'
    } else if (states.isHovered) {
      overrides.temperature = 'warm'
    } else if (states.isFocused) {
      overrides.temperature = 'warm'
    }

    const physics = { ...getDefinition(component, variant), ...overrides }
    return Φ(field(component, physics), vacuum)
  }, [component, baseVariant, ...Object.values(states)])
}

export function clearTensorCache() {
  vacuum.clear()
}
