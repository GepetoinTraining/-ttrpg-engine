/**
 * OBSERVER - The Collapse Mechanism
 *
 * Reality doesn't exist until observed.
 * The observer defines WHAT collapses and at WHAT resolution.
 *
 * This is the quantum parallel made computational:
 * - Superposition = topology exists but isn't rendered
 * - Observation = query the topology
 * - Collapse = precipitate into concrete form (HTML/CSS/JSON/whatever)
 */

import { PHI_INVERSE, ENTROPY_THRESHOLDS } from './laws';
import { factorize, getDominantType, calculateEntropy, type ElementType } from './elements';

// Observer state - what are we looking at and how closely?
export interface ObserverState {
  // Position in the topology (could be world coords, UI tree position, etc.)
  focus: {
    x: number;
    y: number;
    z: number;  // Depth/zoom level
  };

  // Resolution - how much detail do we precipitate?
  // 0 = nothing, 1 = full detail
  resolution: number;

  // Viewport bounds - what's in frame?
  viewport: {
    width: number;
    height: number;
  };

  // Knowledge boundary - what CAN this observer see?
  // Used for fog of war, NPC bounded consciousness, etc.
  knowledgeBoundary: Set<string>;

  // Entropy tolerance - how much complexity can this observer handle?
  entropyThreshold: number;
}

// What we get after observation
export interface CollapsedState<T = unknown> {
  // The precipitated form
  value: T;

  // Metadata about the collapse
  meta: {
    seed: bigint;
    topology: Record<string, number>;
    dominantType: ElementType;
    entropy: number;
    resolution: number;
    timestamp: number;
  };
}

/**
 * Create a default observer
 */
export function createObserver(overrides?: Partial<ObserverState>): ObserverState {
  return {
    focus: { x: 0, y: 0, z: 1 },
    resolution: 1,
    viewport: { width: 1920, height: 1080 },
    knowledgeBoundary: new Set(['*']), // Omniscient by default
    entropyThreshold: ENTROPY_THRESHOLDS.CONSCIOUS,
    ...overrides,
  };
}

/**
 * Calculate effective resolution based on distance from focus
 * Things further from focus get less detail (LOD)
 */
export function calculateResolution(
  observer: ObserverState,
  targetPosition: { x: number; y: number }
): number {
  const dx = targetPosition.x - observer.focus.x;
  const dy = targetPosition.y - observer.focus.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Resolution falls off with phi-based decay
  const falloff = Math.pow(PHI_INVERSE, distance / 100);

  return Math.max(0, Math.min(1, observer.resolution * falloff));
}

/**
 * Check if a seed is observable given the observer's constraints
 */
export function canObserve(
  observer: ObserverState,
  seed: bigint,
  entityId?: string
): boolean {
  // Check knowledge boundary
  if (entityId && !observer.knowledgeBoundary.has('*')) {
    if (!observer.knowledgeBoundary.has(entityId)) {
      return false; // Outside fog of war
    }
  }

  // Check entropy threshold
  const topology = factorize(seed);
  const entropy = calculateEntropy(topology);

  if (entropy > observer.entropyThreshold) {
    return false; // Too complex for this observer
  }

  return true;
}

/**
 * Collapse a seed into observable state
 * This is THE precipitation function
 */
export function collapse<T>(
  seed: bigint,
  observer: ObserverState,
  precipitator: (topology: Record<string, number>, resolution: number) => T
): CollapsedState<T> | null {
  // Can we even observe this?
  if (!canObserve(observer, seed)) {
    return null; // Remains in superposition
  }

  // Factorize the seed
  const topology = factorize(seed);
  const dominantType = getDominantType(topology);
  const entropy = calculateEntropy(topology);

  // Precipitate through the provided function
  const value = precipitator(topology, observer.resolution);

  return {
    value,
    meta: {
      seed,
      topology,
      dominantType,
      entropy,
      resolution: observer.resolution,
      timestamp: Date.now(),
    },
  };
}

/**
 * Batch collapse - observe multiple seeds at once
 * Useful for rendering a scene
 */
export function collapseMany<T>(
  seeds: bigint[],
  observer: ObserverState,
  precipitator: (topology: Record<string, number>, resolution: number) => T
): CollapsedState<T>[] {
  const results: CollapsedState<T>[] = [];

  for (const seed of seeds) {
    const collapsed = collapse(seed, observer, precipitator);
    if (collapsed) {
      results.push(collapsed);
    }
  }

  return results;
}

/**
 * Pan the observer
 */
export function pan(observer: ObserverState, dx: number, dy: number): ObserverState {
  return {
    ...observer,
    focus: {
      ...observer.focus,
      x: observer.focus.x + dx,
      y: observer.focus.y + dy,
    },
  };
}

/**
 * Zoom the observer
 * Affects both z-depth and resolution
 */
export function zoom(observer: ObserverState, factor: number): ObserverState {
  const newZ = observer.focus.z * factor;

  return {
    ...observer,
    focus: {
      ...observer.focus,
      z: newZ,
    },
    // Resolution scales with zoom (closer = more detail)
    resolution: Math.min(1, observer.resolution * factor),
  };
}

/**
 * Expand knowledge boundary (reveal fog of war)
 */
export function reveal(observer: ObserverState, entityIds: string[]): ObserverState {
  const newBoundary = new Set(observer.knowledgeBoundary);
  for (const id of entityIds) {
    newBoundary.add(id);
  }

  return {
    ...observer,
    knowledgeBoundary: newBoundary,
  };
}

/**
 * Contract knowledge boundary (forget/obscure)
 */
export function obscure(observer: ObserverState, entityIds: string[]): ObserverState {
  const newBoundary = new Set(observer.knowledgeBoundary);
  for (const id of entityIds) {
    newBoundary.delete(id);
  }

  return {
    ...observer,
    knowledgeBoundary: newBoundary,
  };
}
