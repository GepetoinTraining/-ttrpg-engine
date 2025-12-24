/**
 * THE Φ TENSOR
 * =============
 *
 * All physics compressed into golden ratio relationships.
 * Two inputs. Complete physics output.
 *
 * φ = 1.618033988749895
 * 1/φ = 0.618033988749895 = φ - 1
 */

const PHI = 1.618033988749895
const PHI_INV = 0.618033988749895
const PHI_SQ = PHI * PHI           // 2.618...
const PHI_INV_SQ = PHI_INV * PHI_INV // 0.382...

// ============================================
// TYPES
// ============================================

export type Intent = 'action' | 'structure' | 'input' | 'visual' | 'alert'
export type Density = 'void' | 'gas' | 'liquid' | 'solid' | 'dense'
export type Temperature = 'cold' | 'warm' | 'hot' | 'critical' | 'fusion'
export type Plane = 'BEDROCK' | 'STAGE' | 'GLASS' | 'ETHER'

export interface Field {
  type: string
  data?: any
  physics?: Partial<Physics>
}

export interface Physics {
  mass: number           // 0.0 - 1.0, affects shadow/weight
  density: Density       // affects background opacity
  temperature: Temperature // affects border color/glow
  charge: number         // affects spacing
  friction: number       // affects transitions
  pressure: number       // affects width/grow
  buoyancy: number       // affects flex direction
}

export interface Tensor {
  css: string
  physics: Physics
  plane: Plane
  type: string
  variant: string
}

// ============================================
// SPECTRUM (Temperature → Color)
// ============================================

const SPECTRUM: Record<Temperature, string> = {
  cold: '#334155',      // slate-700
  warm: '#0ea5e9',      // sky-500
  hot: '#f59e0b',       // amber-500
  critical: '#ef4444',  // red-500
  fusion: '#8b5cf6',    // violet-500
}

// ============================================
// PRIME RESONANCE (Intent → Prime)
// ============================================

const PRIMES: Record<Intent, number> = {
  action: 2,
  structure: 3,
  input: 5,
  visual: 7,
  alert: 11,
}

// ============================================
// THE ACTUALIZATION FUNCTIONAL
// ============================================

export function Φ(field: Field, vacuum?: Map<string, Tensor> | null, entropy: number = 0): Tensor {
  const { type, data, physics: inputPhysics } = field

  // Default physics
  const physics: Physics = {
    mass: inputPhysics?.mass ?? 0.5,
    density: inputPhysics?.density ?? deriveDensity(inputPhysics?.mass ?? 0.5),
    temperature: inputPhysics?.temperature ?? 'cold',
    charge: inputPhysics?.charge ?? 0.5,
    friction: inputPhysics?.friction ?? 0.3,
    pressure: inputPhysics?.pressure ?? 0.5,
    buoyancy: inputPhysics?.buoyancy ?? 0,
  }

  // Check vacuum cache
  const cacheKey = `${type}-${JSON.stringify(physics)}`
  if (vacuum?.has(cacheKey)) {
    return vacuum.get(cacheKey)!
  }

  // Compute CSS from physics
  const css = computeCSS(physics)

  // Determine plane from density
  const plane = derivePlane(physics.density)

  // Build tensor
  const tensor: Tensor = {
    css,
    physics,
    plane,
    type,
    variant: physics.temperature,
  }

  // Cache if vacuum provided
  if (vacuum) {
    vacuum.set(cacheKey, tensor)
  }

  return tensor
}

// ============================================
// DERIVED PROPERTIES
// ============================================

function deriveDensity(mass: number): Density {
  if (mass < PHI_INV_SQ) return 'void'      // < 0.382
  if (mass < PHI_INV) return 'gas'          // < 0.618
  if (mass < PHI_INV + PHI_INV_SQ) return 'liquid' // < 0.854
  if (mass < 1) return 'solid'
  return 'dense'
}

function derivePlane(density: Density): Plane {
  switch (density) {
    case 'void': return 'ETHER'
    case 'gas': return 'GLASS'
    case 'liquid': return 'GLASS'
    case 'solid': return 'STAGE'
    case 'dense': return 'BEDROCK'
  }
}

// ============================================
// CSS GENERATION (The 23 Laws Inlined)
// ============================================

function computeCSS(physics: Physics): string {
  let css = ''

  // LAW OF MASS → Shadow/Elevation
  css += lawOfMass(physics)

  // LAW OF DENSITY → Background/Border
  css += lawOfDensity(physics)

  // LAW OF TEMPERATURE → Border Color/Glow
  css += lawOfTemperature(physics)

  // LAW OF CHARGE → Padding/Gap
  css += lawOfCharge(physics)

  // LAW OF FRICTION → Transitions
  css += lawOfFriction(physics)

  // LAW OF PRESSURE → Width/Flex
  css += lawOfPressure(physics)

  // LAW OF BUOYANCY → Flex Direction
  css += lawOfBuoyancy(physics)

  return css.trim()
}

function lawOfMass(physics: Physics): string {
  const { mass, density } = physics
  let css = ''

  if (mass < 0) {
    // NEGATIVE MASS = LEVITATION
    const lift = Math.abs(mass * 10)
    css += `transform: translateY(-${lift}px) scale(1.02); `
    css += `box-shadow: 0 ${lift * 2}px ${lift * 3}px rgba(14, 165, 233, 0.3); `
    css += `z-index: 50; `
  } else if (mass > 0 && (density === 'solid' || density === 'dense')) {
    // POSITIVE MASS = SHADOW DEPTH
    const depth = Math.floor(mass * 8)
    css += `box-shadow: 0 ${depth}px ${depth * 2}px rgba(0,0,0,${0.15 + (mass * 0.1)}); `
    css += `z-index: ${Math.floor(mass * 10)}; `
  }

  return css
}

function lawOfDensity(physics: Physics): string {
  const { density } = physics

  switch (density) {
    case 'void':
      return 'background: transparent; border: none; '
    case 'gas':
      return 'background: transparent; border: 1px dashed rgba(255,255,255,0.15); border-radius: 4px; '
    case 'liquid':
      return 'background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; '
    case 'solid':
      return 'background: #1e293b; border: 1px solid #334155; border-radius: 8px; '
    case 'dense':
      return 'background: #0f172a; border: 1px solid #475569; border-radius: 12px; '
  }
}

function lawOfTemperature(physics: Physics): string {
  const { temperature } = physics
  const color = SPECTRUM[temperature]
  let css = ''

  if (color && color !== '#334155') {
    css += `border-color: ${color}; `
    if (temperature === 'critical' || temperature === 'fusion' || temperature === 'hot') {
      css += `box-shadow: 0 0 20px ${color}40; `
    }
  }

  return css
}

function lawOfCharge(physics: Physics): string {
  const { charge } = physics
  if (charge === 0) return ''

  const spacing = Math.floor(charge * 24)
  return `padding: ${spacing}px; gap: ${spacing}px; `
}

function lawOfFriction(physics: Physics): string {
  const { friction } = physics
  const duration = 150 + Math.floor(friction * 300)
  const easing = friction > 0.5 ? 'ease-out' : 'ease-in-out'

  return `transition: all ${duration}ms ${easing}; `
}

function lawOfPressure(physics: Physics): string {
  const { pressure } = physics
  if (pressure === 0.5) return ''

  if (pressure > 0.5) {
    const grow = Math.floor((pressure - 0.5) * 2)
    return `flex-grow: ${grow}; `
  } else {
    const shrink = Math.floor((0.5 - pressure) * 2)
    return `flex-shrink: ${shrink}; `
  }
}

function lawOfBuoyancy(physics: Physics): string {
  const { buoyancy } = physics
  if (buoyancy === 0) return ''

  return buoyancy > 0
    ? 'flex-direction: column; '
    : 'flex-direction: row; '
}

// Font scaling function (lowercase phi)
export function φ(power: number): number {
  return Math.pow(PHI, power)
}

// ============================================
// HELPER: Create field shorthand
// ============================================

export function field(type: string, physics?: Partial<Physics>, data?: any): Field {
  return { type, physics, data }
}

// ============================================
// HELPER: Pre-defined physics presets
// ============================================

export const presets = {
  // Buttons
  primaryAction: { mass: 0.7, temperature: 'hot' as Temperature, friction: 0.2 },
  secondaryAction: { mass: 0.5, temperature: 'warm' as Temperature, friction: 0.3 },
  ghostAction: { mass: 0.3, density: 'gas' as Density, friction: 0.2 },

  // Cards
  card: { mass: 0.6, density: 'solid' as Density, charge: 0.5 },
  elevatedCard: { mass: 0.8, density: 'dense' as Density, charge: 0.6 },
  floatingCard: { mass: -0.3, density: 'liquid' as Density },

  // Combat
  token: { mass: 0.6, friction: 0.3, temperature: 'cold' as Temperature },
  selectedToken: { mass: 0.6, friction: 0.3, temperature: 'hot' as Temperature },
  gridCell: { mass: 0.2, density: 'gas' as Density },
  difficultTerrain: { mass: 0.4, density: 'liquid' as Density, temperature: 'warm' as Temperature },
}
