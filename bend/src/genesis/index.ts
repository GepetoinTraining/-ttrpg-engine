/**
 * GENESIS - The Reality Engine
 *
 * "Code is not the artifact. Topology is."
 *
 * This module provides the complete foundation for precipitating
 * reality from mathematical seeds. It unifies:
 *
 * - LAWS: Universal constants (Φ, entropy thresholds, Fibonacci scaling)
 * - ELEMENTS: Prime number composition system (Sephirot mapping)
 * - OBSERVER: Collapse mechanism (superposition → observation → reality)
 * - PRECIPITATE: Topology to rendered output (seeds → HTML/CSS)
 * - DIRECTOR: Evolutionary pressure (natural selection for game design)
 * - IDENTITY: Self-sovereign birth certificates (spacetime origin)
 *
 * The pattern:
 *   1. Define topology (what exists, as element composition)
 *   2. Compose to seed (multiply primes)
 *   3. Store seed (64-bit integer, infinite compression)
 *   4. On observation, factorize (recover topology)
 *   5. Apply physics (Φ tensor projection)
 *   6. Precipitate (HTML, CSS, JSON, whatever)
 *   7. Release (garbage collect, return to superposition)
 *
 * Usage:
 *
 *   import { compose, factorize, precipitateHTML } from './genesis';
 *
 *   // Create water
 *   const water = compose({ H: 2, O: 1 }); // = 44n
 *
 *   // Later, render it
 *   const html = precipitateHTML(water, 'div', 'Water droplet');
 *
 *   // The seed 44 IS water. Forever. Everywhere.
 */

// Laws of the universe
export {
  PHI,
  PHI_INVERSE,
  INTENT_TAX,
  ALLOC,
  FREE,
  FIB,
  RANK_MULTIPLIERS,
  ENTROPY_THRESHOLDS,
  VIOLENCE,
  TICK_MS,
  BEAT_MS,
  ROUND_MS,
} from './laws';

// Element system
export {
  SEPHIROT,
  ELEMENTS,
  PRIME_TO_ELEMENT,
  MOLECULES,
  compose,
  factorize,
  getDominantType,
  calculateEntropy,
  type ElementType,
} from './elements';

// Observer mechanics
export {
  createObserver,
  calculateResolution,
  canObserve,
  collapse,
  collapseMany,
  pan,
  zoom,
  reveal,
  obscure,
  type ObserverState,
  type CollapsedState,
} from './observer';

// Precipitation
export {
  derivePhysics,
  projectToCSS,
  cssToString,
  precipitateHTML,
  precipitateTree,
  precipitateCustom,
  quick,
  type PhysicsState,
  type CSSProjection,
} from './precipitate';

// Director (evolutionary system)
export {
  createDirector,
  reportSpawn,
  reportDeath,
  reportPlayerKill,
  evolve,
  selectMutations,
  getDifficultyMultiplier,
  serialize as serializeDirector,
  deserialize as deserializeDirector,
  type MutationType,
  type MutationStats,
  type DirectorState,
} from './director';

// Identity system
export {
  generateEntropy,
  generateUID,
  uidToSeed,
  collectBirthData,
  createCertificate,
  signPayload,
  verifyPayload,
  parseCertificate,
  type BirthData,
  type CertificateMetadata,
  type PlayerCertificate,
  type SignedPayload,
} from './identity';

// Extractor (for decomposing existing components)
export {
  extractComponent,
  extractAll,
  parseDefinitions,
  factorizeUIPrime,
  COMPONENT_LEVELS,
  type ComponentLevel,
  type ComponentDefinition,
  type TopologyRecord,
  type RelationalRecord,
  type VectorDocument,
} from './extractor';

// Inference (semantic intent → required topology)
export {
  infer,
  printInference,
  type InferredNode,
  type InferredEdge,
  type RequiredSystem,
  type InferenceResult,
} from './infer';

// UI Atoms (component factory)
export {
  UI_PRIMES,
  VARIANT_PHYSICS,
  atom,
  button,
  input,
  text,
  label,
  heading,
  badge,
  field,
  select,
  racePicker,
  classPicker,
  abilityScoreRoller,
  abilityScores,
  molecule,
  card,
  form,
  atoms,
  molecules,
  forms,
  type AtomOptions,
  type MoleculeChild,
} from './atoms';

// Character topology
export {
  CHARACTER_ELEMENTS,
  RACE_TOPOLOGIES,
  CLASS_TOPOLOGIES,
  birthCharacter,
  type CharacterBirthInput,
  type CharacterToken,
  type CharacterAtom,
} from './character';

// Materials (property-based crafting)
export {
  FANTASY_ELEMENTS,
  BLUEPRINTS,
  composeMaterial,
  satisfiesRequirement,
  craft,
  exampleCrafting,
  type MaterialProperties,
  type MaterialComposition,
  type MaterialRequirement,
  type Blueprint,
  type CraftedItem,
} from './materials';

// Quick access helpers
export const Genesis = {
  // Create a seed from element composition
  seed: (topology: Record<string, number>) => {
    const { compose } = require('./elements');
    return compose(topology);
  },

  // Render a seed to HTML
  render: (seed: bigint | number, content: string = '') => {
    const { quick } = require('./precipitate');
    return quick(BigInt(seed), content);
  },

  // Common molecules
  molecules: {
    WATER: 44n,      // H2O
    METHANE: 80n,    // CH4
    CO2: 605n,       // CO2
    AMMONIA: 56n,    // NH3
    GOLD: 19n,       // Au
    RUST: 384659n,   // Fe2O3
  },
} as const;
