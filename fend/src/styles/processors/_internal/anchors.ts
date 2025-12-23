/**
 * L-POINTS (LAGRANGE POINTS)
 * ===========================
 *
 * Spatial anchoring system using gravitational metaphor.
 * Elements can anchor to stable points relative to their container.
 *
 * Like celestial Lagrange points, these are stable positions
 * where visual "gravitational" forces balance.
 */

export type LPoint = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'CENTER'

// ============================================
// L-POINT POSITIONS
// ============================================
//
// L1 = Top center (between sun and planet)
// L2 = Bottom center (beyond planet from sun)
// L3 = Left center (opposite side of orbit)
// L4 = Top-right (leading trojan point)
// L5 = Top-left (trailing trojan point)
// CENTER = Dead center

export const L_POSITIONS: Record<LPoint, {
  justify: string
  align: string
  transform?: string
}> = {
  L1: {
    justify: 'center',
    align: 'flex-start',
  },
  L2: {
    justify: 'center',
    align: 'flex-end',
  },
  L3: {
    justify: 'flex-start',
    align: 'center',
  },
  L4: {
    justify: 'flex-end',
    align: 'flex-start',
  },
  L5: {
    justify: 'flex-start',
    align: 'flex-start',
  },
  CENTER: {
    justify: 'center',
    align: 'center',
  },
}

// ============================================
// ANCHOR CSS
// ============================================

/**
 * Get CSS for anchoring to an L-point
 */
export function anchorTo(point: LPoint): string {
  const pos = L_POSITIONS[point]
  return `display: flex; justify-content: ${pos.justify}; align-items: ${pos.align}; `
}

/**
 * Get CSS for absolutely positioning at an L-point
 */
export function absoluteAnchor(point: LPoint): string {
  switch (point) {
    case 'L1':
      return 'position: absolute; top: 0; left: 50%; transform: translateX(-50%); '
    case 'L2':
      return 'position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); '
    case 'L3':
      return 'position: absolute; left: 0; top: 50%; transform: translateY(-50%); '
    case 'L4':
      return 'position: absolute; top: 0; right: 0; '
    case 'L5':
      return 'position: absolute; top: 0; left: 0; '
    case 'CENTER':
      return 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); '
  }
}

// ============================================
// CONTAINER HELPERS
// ============================================

/**
 * Create a container that anchors children to a point
 */
export function anchorContainer(point: LPoint, fill: boolean = true): string {
  let css = anchorTo(point)
  if (fill) {
    css += 'width: 100%; height: 100%; '
  }
  return css
}

/**
 * Grid-based L-point layout (3x3)
 */
export function lPointGrid(): string {
  return `
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      "L5 L1 L4"
      "L3 CENTER ."
      ". L2 .";
  `.replace(/\s+/g, ' ').trim()
}

/**
 * Get grid area name for L-point
 */
export function lPointArea(point: LPoint): string {
  return `grid-area: ${point}; `
}
