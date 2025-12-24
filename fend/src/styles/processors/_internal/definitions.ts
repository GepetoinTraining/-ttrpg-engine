/**
 * DEFINITIONS
 * ============
 *
 * Maps semantic component variants to physics configurations.
 * This is where "Button.primary" becomes { mass: 0.7, temperature: 'hot' }
 */

import type { Physics, Temperature, Density } from './phi'

// ============================================
// COMPONENT DEFINITIONS
// ============================================

export interface Definition {
  physics: Partial<Physics>
  className?: string
}

export type DefinitionMap = Record<string, Definition>

// ============================================
// BUTTON DEFINITIONS
// ============================================

export const BUTTON: DefinitionMap = {
  primary: {
    physics: {
      mass: 0.7,
      density: 'solid',
      temperature: 'hot',
      friction: 0.2,
      charge: 0.5,
    },
  },
  secondary: {
    physics: {
      mass: 0.5,
      density: 'solid',
      temperature: 'warm',
      friction: 0.3,
      charge: 0.4,
    },
  },
  ghost: {
    physics: {
      mass: 0.3,
      density: 'gas',
      temperature: 'cold',
      friction: 0.2,
      charge: 0.3,
    },
  },
  danger: {
    physics: {
      mass: 0.7,
      density: 'solid',
      temperature: 'critical',
      friction: 0.2,
      charge: 0.5,
    },
  },
  disabled: {
    physics: {
      mass: 0.2,
      density: 'gas',
      temperature: 'cold',
      friction: 0.8,
      charge: 0.3,
    },
  },
}

// ============================================
// CARD DEFINITIONS
// ============================================

export const CARD: DefinitionMap = {
  default: {
    physics: {
      mass: 0.6,
      density: 'solid',
      temperature: 'cold',
      charge: 0.5,
      friction: 0.3,
    },
  },
  elevated: {
    physics: {
      mass: 0.8,
      density: 'dense',
      temperature: 'cold',
      charge: 0.6,
      friction: 0.3,
    },
  },
  floating: {
    physics: {
      mass: -0.3,
      density: 'liquid',
      temperature: 'warm',
      charge: 0.5,
      friction: 0.2,
    },
  },
  glass: {
    physics: {
      mass: 0.4,
      density: 'liquid',
      temperature: 'cold',
      charge: 0.4,
      friction: 0.3,
    },
  },
  scene: {
    physics: {
      mass: 0.7,
      density: 'solid',
      temperature: 'cold',
      charge: 0.6,
      friction: 0.4,
    },
  },
  combat: {
    physics: {
      mass: 0.8,
      density: 'dense',
      temperature: 'hot',
      charge: 0.5,
      friction: 0.2,
    },
  },
}

// ============================================
// INPUT DEFINITIONS
// ============================================

export const INPUT: DefinitionMap = {
  default: {
    physics: {
      mass: 0.4,
      density: 'solid',
      temperature: 'cold',
      charge: 0.4,
      friction: 0.3,
    },
  },
  focused: {
    physics: {
      mass: 0.5,
      density: 'solid',
      temperature: 'warm',
      charge: 0.4,
      friction: 0.2,
    },
  },
  error: {
    physics: {
      mass: 0.5,
      density: 'solid',
      temperature: 'critical',
      charge: 0.4,
      friction: 0.3,
    },
  },
  disabled: {
    physics: {
      mass: 0.2,
      density: 'gas',
      temperature: 'cold',
      charge: 0.3,
      friction: 0.8,
    },
  },
}

// ============================================
// BADGE DEFINITIONS
// ============================================

export const BADGE: DefinitionMap = {
  default: {
    physics: {
      mass: 0.3,
      density: 'solid',
      temperature: 'cold',
      charge: 0.2,
    },
  },
  success: {
    physics: {
      mass: 0.4,
      density: 'solid',
      temperature: 'warm',
      charge: 0.2,
    },
  },
  warning: {
    physics: {
      mass: 0.4,
      density: 'solid',
      temperature: 'hot',
      charge: 0.2,
    },
  },
  error: {
    physics: {
      mass: 0.4,
      density: 'solid',
      temperature: 'critical',
      charge: 0.2,
    },
  },
  info: {
    physics: {
      mass: 0.3,
      density: 'liquid',
      temperature: 'warm',
      charge: 0.2,
    },
  },
}

// ============================================
// COMBAT DEFINITIONS
// ============================================

export const TOKEN: DefinitionMap = {
  default: {
    physics: {
      mass: 0.6,
      density: 'solid',
      temperature: 'cold',
      friction: 0.3,
    },
  },
  selected: {
    physics: {
      mass: 0.7,
      density: 'solid',
      temperature: 'hot',
      friction: 0.2,
    },
  },
  targeted: {
    physics: {
      mass: 0.6,
      density: 'solid',
      temperature: 'critical',
      friction: 0.3,
    },
  },
  dead: {
    physics: {
      mass: 0.2,
      density: 'gas',
      temperature: 'cold',
      friction: 0.8,
    },
  },
  hidden: {
    physics: {
      mass: 0.3,
      density: 'gas',
      temperature: 'cold',
      friction: 0.3,
    },
  },
}

export const GRID_CELL: DefinitionMap = {
  default: {
    physics: {
      mass: 0.2,
      density: 'gas',
      temperature: 'cold',
    },
  },
  hover: {
    physics: {
      mass: 0.3,
      density: 'gas',
      temperature: 'warm',
    },
  },
  difficult: {
    physics: {
      mass: 0.4,
      density: 'liquid',
      temperature: 'warm',
    },
  },
  impassable: {
    physics: {
      mass: 0.8,
      density: 'dense',
      temperature: 'cold',
    },
  },
  highlight: {
    physics: {
      mass: 0.3,
      density: 'liquid',
      temperature: 'hot',
    },
  },
}

// ============================================
// ROLE CARD DEFINITIONS (Onboarding)
// ============================================

export const ROLE_CARD: DefinitionMap = {
  idle: {
    physics: {
      mass: 0.4,
      density: 'liquid',
      temperature: 'cold',
      charge: 0.4,
      friction: 0.2,
    },
  },
  hover: {
    physics: {
      mass: 0.5,
      density: 'solid',
      temperature: 'warm',
      charge: 0.4,
      friction: 0.15,
    },
  },
  selected: {
    physics: {
      mass: 0.7,
      density: 'solid',
      temperature: 'hot',
      charge: 0.5,
      friction: 0.2,
    },
  },
}

// ============================================
// PROGRESS DOT DEFINITIONS (Onboarding)
// ============================================

export const PROGRESS_DOT: DefinitionMap = {
  inactive: {
    physics: {
      mass: 0.2,
      density: 'gas',
      temperature: 'cold',
      charge: 0.2,
      friction: 0.3,
    },
  },
  active: {
    physics: {
      mass: 0.4,
      density: 'solid',
      temperature: 'hot',
      charge: 0.3,
      friction: 0.2,
    },
  },
  current: {
    physics: {
      mass: 0.5,
      density: 'solid',
      temperature: 'hot',
      charge: 0.4,
      friction: 0.2,
    },
  },
}

// ============================================
// ONBOARDING CONTAINER DEFINITIONS
// ============================================

export const ONBOARDING_CONTAINER: DefinitionMap = {
  default: {
    physics: {
      mass: 0.6,
      density: 'solid',
      temperature: 'cold',
      charge: 0.6,
      friction: 0.3,
    },
  },
}

export const ONBOARDING_CARD: DefinitionMap = {
  default: {
    physics: {
      mass: 0.7,
      density: 'solid',
      temperature: 'cold',
      charge: 0.5,
      friction: 0.3,
    },
  },
}

// ============================================
// LINK DEFINITIONS
// ============================================

export const LINK: DefinitionMap = {
  default: {
    physics: {
      mass: 0.382,
      density: 'gas',
      temperature: 'warm',
      charge: 0.3,
      friction: 0.2,
    },
  },
  muted: {
    physics: {
      mass: 0.3,
      density: 'gas',
      temperature: 'cold',
      charge: 0.2,
      friction: 0.3,
    },
  },
  action: {
    physics: {
      mass: 0.5,
      density: 'liquid',
      temperature: 'hot',
      charge: 0.4,
      friction: 0.2,
    },
  },
}

// ============================================
// ALL DEFINITIONS
// ============================================

export const DEFINITIONS: Record<string, DefinitionMap> = {
  Button: BUTTON,
  Card: CARD,
  Input: INPUT,
  Badge: BADGE,
  Token: TOKEN,
  GridCell: GRID_CELL,
  RoleCard: ROLE_CARD,
  ProgressDot: PROGRESS_DOT,
  OnboardingContainer: ONBOARDING_CONTAINER,
  OnboardingCard: ONBOARDING_CARD,
  Link: LINK,
}

/**
 * Get physics for a component variant
 */
export function getDefinition(component: string, variant: string = 'default'): Partial<Physics> {
  const componentDefs = DEFINITIONS[component]
  if (!componentDefs) return {}

  const variantDef = componentDefs[variant] || componentDefs['default']
  return variantDef?.physics || {}
}
