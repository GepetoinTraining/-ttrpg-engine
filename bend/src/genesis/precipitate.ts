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

  // Density baseline 0.5 so small seeds don't get bloated padding
  const uniqueElements = Object.keys(topology).length;
  const density = Math.min(1, 0.5 + totalAtoms / (uniqueElements * 10));

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
 *
 * Color mapping aligned to dark slate theme (globals.css):
 *   Cool (temp ≤ 0.5)  → blue-slate HSL(215, 15-30%, 15-27%)
 *   Neutral (0.5-0.65)  → desaturated gray
 *   Warm (0.65-1.0)     → amber HSL(42°) → red HSL(0°)
 *
 * Background alpha driven by mass (visual weight):
 *   mass 0 = transparent (text, containers)
 *   mass 0.5 = semi-opaque (cards)
 *   mass 0.8+ = solid (buttons, badges)
 *
 * Padding driven by density (compactness):
 *   density 0.95 = 1px (text)
 *   density 0.7 = 5px (buttons)
 *   density 0.5 = 8px (cards)
 */
export function projectToCSS(
  physics: PhysicsState,
  resolution: number = 1
): CSSProjection {
  const r = resolution;

  // Mass → shadow depth (reduced from 24 max to 16)
  const shadowDepth = Math.round(physics.mass * 16 * r);
  const shadowBlur = Math.round(shadowDepth * PHI);
  const shadowSpread = Math.round(shadowDepth * 0.3);

  // Density → padding (inverse - dense = tight, max 16px down from 32)
  const basePadding = Math.round((1 - physics.density) * 16 * r);
  const padding = `${basePadding}px`;

  // Temperature → color, aligned to dark theme palette
  // Theme anchors: surface=HSL(215,28%,17%), amber=HSL(38,93%,50%), red=HSL(0,84%,60%)
  let hue: number;
  let saturation: number;
  let lightness: number;

  if (physics.temperature <= 0.5) {
    // Cool range: blue-slate (matching theme surfaces)
    hue = 215;
    saturation = Math.round(15 + physics.temperature * 30);     // 15-30%
    lightness = Math.round(15 + (1 - physics.mass) * 12);       // 15-27%
  } else if (physics.temperature <= 0.65) {
    // Neutral transition: desaturated gray (hue irrelevant at low sat)
    hue = 215;
    const t = (physics.temperature - 0.5) / 0.15;
    saturation = Math.round(15 * (1 - t));                       // 15% → 0%
    lightness = Math.round(15 + (1 - physics.mass) * 12);       // 15-27%
  } else {
    // Warm/hot: amber → red (accent colors)
    const t = (physics.temperature - 0.65) / 0.35;
    hue = Math.round(42 - t * 42);                              // 42° → 0°
    saturation = Math.round(70 + t * 25);                        // 70% → 95%
    lightness = Math.round(45 + (1 - physics.mass) * 10);       // 45-55%
  }

  // Background alpha from mass (visual weight)
  // mass 0 = weightless = transparent (text, forms)
  // mass 0.8 = heavy = near-opaque (buttons)
  const bgAlpha = physics.mass <= 0 ? 0 : Math.min(1, physics.mass * 1.1);

  let background: string;
  if (bgAlpha < 0.05) {
    background = 'transparent';
  } else {
    background = `hsla(${hue}, ${saturation}%, ${lightness}%, ${bgAlpha.toFixed(2)})`;
  }

  // Text color
  // Bright warm backgrounds → dark text (like theme amber buttons)
  // Weightless cool elements → muted text (temp < 0.25) or bright text
  // Everything else → light text
  let color: string;
  if (lightness > 40 && bgAlpha > 0.5) {
    color = '#0f172a';    // Dark text on bright warm backgrounds
  } else if (physics.mass <= 0 && physics.temperature < 0.25) {
    color = '#94a3b8';    // Muted text for cool weightless elements
  } else {
    color = '#f8fafc';    // Bright light text (default)
  }

  // Friction → transition duration
  const transitionMs = Math.round(100 + physics.friction * 400);

  // Pressure → border radius (max 16px, down from 24)
  const borderRadius = Math.round(physics.pressure * 16 * r);

  // Buoyancy → flex-direction (threshold 0.5, not 0)
  // buoyancy > 0.5 = column (cards, surfaces, fields)
  // buoyancy ≤ 0.5 = row (buttons, text, forms)
  const flexDirection = physics.buoyancy > 0.5 ? 'column' : 'row';
  const zIndex = Math.round(Math.abs(physics.buoyancy) * 100);

  // Row layout with high pressure = wrap children
  const flexWrap = (physics.buoyancy <= 0.5 && physics.pressure > 0.5) ? 'wrap' : 'nowrap';

  // Pressure → flex-grow/shrink
  let flexGrow = '0';
  let flexShrink = '0';
  let width = 'auto';
  if (physics.pressure > 0.5) {
    flexGrow = String(Math.floor((physics.pressure - 0.5) * 4));
    width = '100%';
  } else if (physics.pressure < 0.5) {
    flexShrink = String(Math.floor((0.5 - physics.pressure) * 4));
  }

  // Tighter margin and gap (was PHI_INVERSE ≈ 0.62, now 0.25 and 0.5)
  const margin = `${Math.round(basePadding * 0.25)}px`;
  const gap = `${Math.round(basePadding * 0.5)}px`;

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
    margin,
    gap,

    background,
    color,
    borderRadius: `${borderRadius}px`,
    boxShadow: shadowDepth > 1
      ? `0 ${shadowDepth}px ${shadowBlur}px -${shadowSpread}px rgba(0,0,0,${(0.15 + physics.mass * 0.25).toFixed(2)})`
      : 'none',
    opacity: r < 0.3 ? `${r * 3}` : '1',

    transition: `all ${transitionMs}ms cubic-bezier(${PHI_INVERSE}, 0, ${1 - PHI_INVERSE}, 1)`,
    transform: `rotateY(${physics.rotation}deg)`, // Removed charge→translateX drift

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
