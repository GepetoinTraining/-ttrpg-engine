/**
 * TOPOLOGY PLANES
 * ================
 *
 * Z-axis stratification for UI elements.
 * Elements exist on one of four planes based on their density.
 *
 * BEDROCK - Fixed background elements (z: 0-9)
 * STAGE   - Primary interactive layer (z: 10-39)
 * GLASS   - Floating/overlay elements (z: 40-79)
 * ETHER   - Top-level modals/tooltips (z: 80-99)
 */

export type Plane = 'BEDROCK' | 'STAGE' | 'GLASS' | 'ETHER'

// ============================================
// Z-INDEX RANGES
// ============================================

export const PLANE_Z: Record<Plane, { min: number; max: number }> = {
  BEDROCK: { min: 0, max: 9 },
  STAGE: { min: 10, max: 39 },
  GLASS: { min: 40, max: 79 },
  ETHER: { min: 80, max: 99 },
}

// ============================================
// PLANE CHARACTERISTICS
// ============================================

export const PLANE_PHYSICS: Record<Plane, {
  baseOpacity: number
  blur: number
  shadow: boolean
  interactive: boolean
}> = {
  BEDROCK: {
    baseOpacity: 1.0,
    blur: 0,
    shadow: false,
    interactive: false,
  },
  STAGE: {
    baseOpacity: 1.0,
    blur: 0,
    shadow: true,
    interactive: true,
  },
  GLASS: {
    baseOpacity: 0.9,
    blur: 10,
    shadow: true,
    interactive: true,
  },
  ETHER: {
    baseOpacity: 1.0,
    blur: 0,
    shadow: true,
    interactive: true,
  },
}

// ============================================
// HELPERS
// ============================================

/**
 * Get z-index for element within its plane
 * @param plane The plane the element exists on
 * @param priority 0.0 - 1.0, position within plane
 */
export function getZIndex(plane: Plane, priority: number = 0.5): number {
  const { min, max } = PLANE_Z[plane]
  const range = max - min
  return min + Math.floor(priority * range)
}

/**
 * Get plane-appropriate backdrop styles
 */
export function getPlaneBackdrop(plane: Plane): string {
  const { blur, baseOpacity } = PLANE_PHYSICS[plane]

  if (blur > 0) {
    return `backdrop-filter: blur(${blur}px); opacity: ${baseOpacity}; `
  }

  return ''
}

/**
 * Check if plane allows interaction
 */
export function isInteractive(plane: Plane): boolean {
  return PLANE_PHYSICS[plane].interactive
}

/**
 * Get CSS for plane positioning
 */
export function planeStyles(plane: Plane, priority: number = 0.5): string {
  const zIndex = getZIndex(plane, priority)
  const backdrop = getPlaneBackdrop(plane)

  return `position: relative; z-index: ${zIndex}; ${backdrop}`.trim()
}
