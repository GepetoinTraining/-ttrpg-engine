/**
 * PRECIPITATE - Topology to Reality
 *
 * This is where the magic happens.
 * Topology (what exists) + Physics (how it behaves) = Rendered output
 *
 * The precipitator doesn't care what it's rendering.
 * HTML, CSS, JSON, 3D meshes - all just projections of the same seed.
 */

import { PHI, PHI_INVERSE } from './laws';
import { factorize, getDominantType, ELEMENTS, type ElementType } from './elements';

// Physics properties derived from topology
export interface PhysicsState {
  mass: number;      // Visual weight (shadow depth, border thickness)
  density: number;   // Compactness (padding, spacing)
  temperature: number; // Energy (color warmth, animation speed)
  charge: number;    // Polarity (alignment, attraction/repulsion)
  friction: number;  // Resistance (transition duration, ease)
  pressure: number;  // Containment stress (border radius, overflow)
  buoyancy: number;  // Lift (z-index, elevation)
  rotation: number;  // Angular position (degrees, rotateY)
}

// CSS output from precipitation
export interface CSSProjection {
  // Layout
  display: string;
  flexDirection: string;  // buoyancy > 0 = column, <= 0 = row
  flexWrap: string;       // row layout wraps when pressure > 0.5
  flexGrow: string;       // pressure > 0.5 = expand
  flexShrink: string;     // pressure < 0.5 = shrink
  position: string;
  width: string;
  height: string;
  padding: string;
  margin: string;
  gap: string;

  // Visual
  background: string;
  color: string;
  borderRadius: string;
  boxShadow: string;
  opacity: string;

  // Animation
  transition: string;
  transform: string;

  // Depth
  zIndex: number;
}

// Element type to base physics mapping
const TYPE_PHYSICS: Record<ElementType, Partial<PhysicsState>> = {
  FLUX: {
    temperature: 0.8,
    friction: 0.2,
    charge: 0.5,
  },
  FORM: {
    mass: 0.8,
    density: 0.7,
    pressure: 0.6,
  },
  VITALITY: {
    temperature: 0.6,
    buoyancy: 0.5,
    charge: 0.3,
  },
  AETHER: {
    buoyancy: 0.8,
    friction: 0.1,
    density: 0.2,
  },
  ENTROPY: {
    temperature: 0.9,
    pressure: 0.8,
    friction: 0.9,
  },
};



/**
 * Calculate physics state from topology
 */
export function derivePhysics(topology: Record<string, number>): PhysicsState {
  const dominantType = getDominantType(topology);
  const basePhysics = TYPE_PHYSICS[dominantType];

  // Count total atoms for mass
  let totalAtoms = 0;
  let weightedCharge = 0;

  for (const [symbol, count] of Object.entries(topology)) {
    const element = ELEMENTS[symbol];
    if (element) {
      totalAtoms += count;
      // Charge varies by prime (odd primes = positive, 2 = negative)
      weightedCharge += element.prime === 2 ? -count : count;
    }
  }

  // Normalize mass to 0-1 range (log scale)
  const mass = Math.min(1, Math.log2(totalAtoms + 1) / 10);

  // Density is atoms per unique element
  const uniqueElements = Object.keys(topology).length;
  const density = Math.min(1, totalAtoms / (uniqueElements * 10));

  // Charge normalized to -1 to 1
  const charge = Math.tanh(weightedCharge / 10);

  return {
    mass: basePhysics.mass ?? mass,
    density: basePhysics.density ?? density,
    temperature: basePhysics.temperature ?? 0.5,
    charge: basePhysics.charge ?? charge,
    friction: basePhysics.friction ?? 0.5,
    pressure: basePhysics.pressure ?? 0.5,
    buoyancy: basePhysics.buoyancy ?? 0.5,
    rotation: basePhysics.rotation ?? 0,
  };
}

/**
 * Project physics state to CSS
 * This is the Φ tensor in action
 */
export function projectToCSS(
  physics: PhysicsState,
  resolution: number = 1
): CSSProjection {
  // Scale everything by resolution (LOD)
  const r = resolution;

  // Mass → shadow depth, border weight
  const shadowDepth = Math.round(physics.mass * 24 * r);
  const shadowBlur = Math.round(shadowDepth * PHI);
  const shadowSpread = Math.round(shadowDepth * PHI_INVERSE);

  // Density → padding (inverse - dense = tight)
  const basePadding = Math.round((1 - physics.density) * 32 * r);
  const padding = `${basePadding}px`;

  // Temperature → color warmth
  // 0 = cool (blue shift), 1 = hot (red shift)
  const hue = Math.round(physics.temperature * 60); // 0-60 range (red to yellow)
  const saturation = Math.round(50 + physics.temperature * 50);
  const lightness = Math.round(40 + (1 - physics.temperature) * 20);

  // Friction → transition duration
  const transitionMs = Math.round(100 + physics.friction * 400);

  // Pressure → border radius (high pressure = rounded, contained)
  const borderRadius = Math.round(physics.pressure * 24 * r);

  // Buoyancy → flex-direction AND z-index
  // buoyancy > 0 = column (vertical stacking)
  // buoyancy <= 0 = row (horizontal)
  const flexDirection = physics.buoyancy > 0 ? 'column' : 'row';
  const zIndex = Math.round(Math.abs(physics.buoyancy) * 100);

  // Row layout with high pressure = wrap children
  const flexWrap = (physics.buoyancy <= 0 && physics.pressure > 0.5) ? 'wrap' : 'nowrap';

  // Pressure → flex-grow/shrink (how much space to take)
  // pressure > 0.5 = expand to fill
  // pressure < 0.5 = shrink to content
  let flexGrow = '0';
  let flexShrink = '0';
  let width = 'auto';
  if (physics.pressure > 0.5) {
    flexGrow = String(Math.floor((physics.pressure - 0.5) * 4));
    width = '100%';  // Fill available space
  } else if (physics.pressure < 0.5) {
    flexShrink = String(Math.floor((0.5 - physics.pressure) * 4));
  }

  // Charge → horizontal alignment tendency
  const translateX = physics.charge * 4;

  return {
    display: 'flex',
    flexDirection,
    flexWrap,
    flexGrow,
    flexShrink,
    position: 'relative',
    width,
    height: 'auto',
    padding,
    margin: `${Math.round(basePadding * PHI_INVERSE)}px`,
    gap: `${Math.round(basePadding * PHI_INVERSE)}px`,

    background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: lightness > 50 ? '#1a1a1a' : '#fafafa',
    borderRadius: `${borderRadius}px`,
    boxShadow: shadowDepth > 0
      ? `0 ${shadowDepth}px ${shadowBlur}px -${shadowSpread}px rgba(0,0,0,${0.1 + physics.mass * 0.2})`
      : 'none',
    opacity: r < 0.3 ? `${r * 3}` : '1',

    transition: `all ${transitionMs}ms cubic-bezier(${PHI_INVERSE}, 0, ${1-PHI_INVERSE}, 1)`,
    transform: `translateX(${translateX}px) rotateY(${physics.rotation}deg)`,

    zIndex,
  };
}

/**
 * Convert CSS projection to inline style string
 */
export function cssToString(css: CSSProjection): string {
  return Object.entries(css)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebab}: ${value}`;
    })
    .join('; ');
}

/**
 * Generate HTML element from seed
 */
export function precipitateHTML(
  seed: bigint,
  tag: string = 'div',
  content: string = '',
  resolution: number = 1
): string {
  const topology = factorize(seed);
  const physics = derivePhysics(topology);
  const css = projectToCSS(physics, resolution);
  const style = cssToString(css);
  const dominantType = getDominantType(topology);

  // Data attributes for debugging/inspection
  const dataAttrs = `data-seed="${seed}" data-type="${dominantType}"`;

  return `<${tag} style="${style}" ${dataAttrs}>${content}</${tag}>`;
}

/**
 * Precipitate a full component tree
 * Each child inherits and modifies parent physics
 */
export function precipitateTree(
  rootSeed: bigint,
  children: { seed: bigint; content: string }[],
  resolution: number = 1
): string {
  const rootTopology = factorize(rootSeed);
  const rootPhysics = derivePhysics(rootTopology);
  const rootCSS = projectToCSS(rootPhysics, resolution);
  const rootStyle = cssToString(rootCSS);

  const childrenHTML = children
    .map(child => precipitateHTML(child.seed, 'div', child.content, resolution * PHI_INVERSE))
    .join('\n  ');

  return `<div style="${rootStyle}" data-seed="${rootSeed}">
  ${childrenHTML}
</div>`;
}

/**
 * Quick precipitate - seed to styled div in one call
 */
export function quick(seed: bigint | number, content: string = ''): string {
  return precipitateHTML(BigInt(seed), 'div', content);
}

/**
 * Precipitate with custom physics overrides
 */
export function precipitateCustom(
  seed: bigint,
  physicsOverrides: Partial<PhysicsState>,
  content: string = '',
  tag: string = 'div'
): string {
  const topology = factorize(seed);
  const basePhysics = derivePhysics(topology);
  const physics = { ...basePhysics, ...physicsOverrides };
  const css = projectToCSS(physics);
  const style = cssToString(css);

  return `<${tag} style="${style}" data-seed="${seed}">${content}</${tag}>`;
}
