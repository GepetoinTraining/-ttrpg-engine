/**
 * EXTRACTOR - Decompose existing components into topology
 *
 * Walks the definitions and produces:
 * 1. Topology JSON - seed, elements, physics, relationships
 * 2. Relational records - for graph queries (parent/child/variant)
 * 3. Vector documents - for semantic search
 *
 * This is the bridge from the old world to the new.
 */

import type { ElementType } from './elements';

// ============================================
// TYPES
// ============================================

// Component hierarchy level
export type ComponentLevel = 'atom' | 'molecule' | 'organism' | 'world';

// Physics from definitions.ts (mirror the structure)
export interface PhysicsConfig {
  mass?: number;
  density?: 'void' | 'gas' | 'liquid' | 'solid' | 'dense';
  temperature?: 'cold' | 'warm' | 'hot' | 'critical' | 'fusion';
  charge?: number;
  friction?: number;
  pressure?: number;
  buoyancy?: number;
}

// A variant of a component
export interface VariantConfig {
  physics: PhysicsConfig;
  prime?: number;
  material?: string;
}

// Component definition from the codebase
export interface ComponentDefinition {
  name: string;
  level: ComponentLevel;
  prime: number;
  variants: Record<string, VariantConfig>;
  children?: string[];  // Component names this contains
  parents?: string[];   // Component names that contain this
  tags?: string[];      // Semantic tags for search
  description?: string; // Human description for embeddings
}

// ============================================
// TOPOLOGY OUTPUT (for seeds)
// ============================================

export interface TopologyRecord {
  id: string;                          // Unique ID
  name: string;                        // Component name
  variant: string;                     // Variant name
  seed: string;                        // BigInt as string
  prime: number;                       // Base prime
  level: ComponentLevel;
  physics: PhysicsConfig;
  material?: string;
  composition: Record<string, number>; // Element counts from factorization
  dominant_type: ElementType;
}

// ============================================
// RELATIONAL OUTPUT (for graph)
// ============================================

export interface RelationalRecord {
  id: string;
  name: string;
  level: ComponentLevel;
  prime: number;
  parent_ids: string[];     // Parents in composition hierarchy
  child_ids: string[];      // Children in composition hierarchy
  variant_of?: string;      // Base component if this is a variant
  variant_name?: string;
  tags: string[];
}

// ============================================
// VECTOR OUTPUT (for semantic search)
// ============================================

export interface VectorDocument {
  id: string;
  namespace: 'components';
  content: string;           // Text to embed
  metadata: {
    name: string;
    level: ComponentLevel;
    prime: number;
    variant?: string;
    tags: string[];
    physics_summary: string;
  };
}

// ============================================
// PRIME TO ELEMENT MAPPING (UI Domain)
// ============================================

// Map UI primes to element symbols for composition
const UI_PRIMES: Record<number, string> = {
  2: 'Action',    // Button
  3: 'Structure', // Text/Container
  5: 'Input',     // Form inputs
  7: 'Visual',    // Icons/Images
  11: 'Identity', // Avatars/Users
  13: 'Hierarchy',// Spinners/Progress
};

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Factorize a UI prime into element composition
 */
export function factorizeUIPrime(prime: number): Record<string, number> {
  const composition: Record<string, number> = {};
  let remaining = prime;

  const primes = [2, 3, 5, 7, 11, 13];

  for (const p of primes) {
    let count = 0;
    while (remaining % p === 0) {
      remaining = remaining / p;
      count++;
    }
    if (count > 0) {
      composition[UI_PRIMES[p]] = count;
    }
  }

  // If there's remainder, it's an atomic prime (not composite)
  if (remaining > 1) {
    composition['Atomic'] = remaining;
  }

  return composition;
}

/**
 * Get dominant element type from composition
 */
function getDominantUIType(composition: Record<string, number>): ElementType {
  const typeMap: Record<string, ElementType> = {
    Action: 'FLUX',
    Structure: 'FORM',
    Input: 'VITALITY',
    Visual: 'AETHER',
    Identity: 'VITALITY',
    Hierarchy: 'FORM',
    Atomic: 'AETHER',
  };

  let dominant = 'AETHER' as ElementType;
  let maxCount = 0;

  for (const [element, count] of Object.entries(composition)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = typeMap[element] || 'AETHER';
    }
  }

  return dominant;
}

/**
 * Generate physics summary for embeddings
 */
function summarizePhysics(physics: PhysicsConfig): string {
  const parts: string[] = [];

  if (physics.mass !== undefined) {
    if (physics.mass < 0.3) parts.push('light');
    else if (physics.mass > 0.7) parts.push('heavy');
    else parts.push('medium weight');
  }

  if (physics.density) {
    parts.push(physics.density);
  }

  if (physics.temperature) {
    parts.push(physics.temperature);
  }

  if (physics.friction !== undefined) {
    if (physics.friction > 0.5) parts.push('sluggish');
    else if (physics.friction < 0.2) parts.push('snappy');
  }

  return parts.join(', ');
}

/**
 * Generate unique ID for a component variant
 */
function generateId(name: string, variant?: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (variant && variant !== 'default') {
    return `${base}_${variant.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  return base;
}

/**
 * Extract a single component definition to all output formats
 */
export function extractComponent(def: ComponentDefinition): {
  topologies: TopologyRecord[];
  relations: RelationalRecord[];
  vectors: VectorDocument[];
} {
  const topologies: TopologyRecord[] = [];
  const relations: RelationalRecord[] = [];
  const vectors: VectorDocument[] = [];

  // Base relational record
  const baseRelation: RelationalRecord = {
    id: generateId(def.name),
    name: def.name,
    level: def.level,
    prime: def.prime,
    parent_ids: (def.parents || []).map(p => generateId(p)),
    child_ids: (def.children || []).map(c => generateId(c)),
    tags: def.tags || [],
  };
  relations.push(baseRelation);

  // Process each variant
  for (const [variantName, variantConfig] of Object.entries(def.variants)) {
    const id = generateId(def.name, variantName);
    const composition = factorizeUIPrime(variantConfig.prime || def.prime);
    const dominantType = getDominantUIType(composition);

    // Topology record
    topologies.push({
      id,
      name: def.name,
      variant: variantName,
      seed: BigInt(variantConfig.prime || def.prime).toString(),
      prime: variantConfig.prime || def.prime,
      level: def.level,
      physics: variantConfig.physics,
      material: variantConfig.material,
      composition,
      dominant_type: dominantType,
    });

    // Variant relation (if not default)
    if (variantName !== 'default') {
      relations.push({
        id,
        name: `${def.name}.${variantName}`,
        level: def.level,
        prime: variantConfig.prime || def.prime,
        parent_ids: [generateId(def.name)],
        child_ids: [],
        variant_of: generateId(def.name),
        variant_name: variantName,
        tags: [...(def.tags || []), variantName],
      });
    }

    // Vector document
    const physicsSummary = summarizePhysics(variantConfig.physics);
    const content = [
      def.name,
      variantName !== 'default' ? variantName : '',
      def.description || '',
      `${def.level} component`,
      physicsSummary,
      ...(def.tags || []),
    ].filter(Boolean).join(' ');

    vectors.push({
      id,
      namespace: 'components',
      content,
      metadata: {
        name: def.name,
        level: def.level,
        prime: variantConfig.prime || def.prime,
        variant: variantName !== 'default' ? variantName : undefined,
        tags: [...(def.tags || []), ...(variantName !== 'default' ? [variantName] : [])],
        physics_summary: physicsSummary,
      },
    });
  }

  return { topologies, relations, vectors };
}

/**
 * Parse the DEFINITIONS object from definitions.ts
 * Returns ComponentDefinition array
 */
export function parseDefinitions(
  definitions: Record<string, Record<string, { physics: PhysicsConfig; prime?: number; material?: string }>>,
  primes: Record<string, number>,
  levelMap: Record<string, ComponentLevel>
): ComponentDefinition[] {
  const components: ComponentDefinition[] = [];

  for (const [name, variants] of Object.entries(definitions)) {
    const prime = primes[name] || 1;
    const level = levelMap[name] || 'atom';

    const variantConfigs: Record<string, VariantConfig> = {};
    for (const [variantName, config] of Object.entries(variants)) {
      variantConfigs[variantName] = {
        physics: config.physics,
        prime: config.prime,
        material: config.material,
      };
    }

    components.push({
      name,
      level,
      prime,
      variants: variantConfigs,
      tags: inferTags(name, level),
      description: inferDescription(name, level),
    });
  }

  return components;
}

/**
 * Infer semantic tags from component name
 */
function inferTags(name: string, level: ComponentLevel): string[] {
  const tags: string[] = [level];

  // UI patterns
  if (name.includes('Button')) tags.push('interactive', 'action', 'clickable');
  if (name.includes('Input')) tags.push('interactive', 'form', 'editable');
  if (name.includes('Card')) tags.push('container', 'content');
  if (name.includes('Modal')) tags.push('overlay', 'popup', 'dialog');
  if (name.includes('Grid')) tags.push('layout', 'container');
  if (name.includes('List')) tags.push('layout', 'container', 'items');

  // Domain patterns
  if (name.includes('Campaign')) tags.push('game', 'campaign');
  if (name.includes('Character')) tags.push('game', 'character', 'player');
  if (name.includes('World')) tags.push('game', 'world', 'map');
  if (name.includes('Combat')) tags.push('game', 'combat', 'battle');
  if (name.includes('User') || name.includes('GM') || name.includes('Player') || name.includes('NPC')) {
    tags.push('user', 'identity', 'role');
  }

  // Visual patterns
  if (name.includes('3D') || name.includes('Scatter') || name.includes('Cube') || name.includes('Orb')) {
    tags.push('3d', 'visual', 'spatial');
  }
  if (name.includes('Alignment')) tags.push('morality', 'alignment', 'd&d');

  return [...new Set(tags)];
}

/**
 * Infer description from component name
 */
function inferDescription(name: string, level: ComponentLevel): string {
  const levelDesc = {
    atom: 'A fundamental building block',
    molecule: 'A composed component',
    organism: 'A complex section',
    world: 'A full page or view',
  };

  return `${levelDesc[level]}: ${name.replace(/([A-Z])/g, ' $1').trim()}`;
}

/**
 * Extract all components and write to JSON files
 */
export function extractAll(
  definitions: Record<string, Record<string, VariantConfig>>,
  primes: Record<string, number>,
  levelMap: Record<string, ComponentLevel>
): {
  topologies: TopologyRecord[];
  relations: RelationalRecord[];
  vectors: VectorDocument[];
} {
  const allTopologies: TopologyRecord[] = [];
  const allRelations: RelationalRecord[] = [];
  const allVectors: VectorDocument[] = [];

  const components = parseDefinitions(definitions, primes, levelMap);

  for (const component of components) {
    const { topologies, relations, vectors } = extractComponent(component);
    allTopologies.push(...topologies);
    allRelations.push(...relations);
    allVectors.push(...vectors);
  }

  return {
    topologies: allTopologies,
    relations: allRelations,
    vectors: allVectors,
  };
}

// ============================================
// LEVEL MAP (from your file structure)
// ============================================

export const COMPONENT_LEVELS: Record<string, ComponentLevel> = {
  // Atoms
  Button: 'atom',
  Text: 'atom',
  Badge: 'atom',
  Icon: 'atom',
  Input: 'atom',
  Avatar: 'atom',
  Pill: 'atom',
  Spinner: 'atom',
  ProgressDot: 'atom',
  Link: 'atom',
  UserGM: 'atom',
  UserPlayer: 'atom',
  UserNPC: 'atom',
  CampaignIcon: 'atom',
  CampaignStat: 'atom',
  AlignmentOrb: 'atom',

  // Molecules
  Card: 'molecule',
  RoleCard: 'molecule',
  FlipCard: 'molecule',
  Form: 'molecule',
  CampaignCard: 'molecule',
  CampaignGrid: 'molecule',
  EmptyState: 'molecule',
  WorldBrowser: 'molecule',
  SettingsPicker: 'molecule',
  SettingToggle: 'molecule',
  WorldNode: 'molecule',

  // Organisms
  Navbar: 'organism',
  Modal: 'organism',
  Sidebar: 'organism',
  Shell: 'organism',
  OnboardingContainer: 'organism',
  OnboardingCard: 'organism',

  // 3D Primitives (special atoms)
  Scatter3D: 'atom',
  CubeChart: 'atom',
  SurfacePlot: 'atom',
  Pyramid: 'atom',
  Prism: 'atom',
  Orb: 'atom',

  // Combat
  Token: 'atom',
  GridCell: 'atom',

  // Builders
  TerrainPicker: 'molecule',
  ClimateSelector: 'molecule',
  RegionSize: 'molecule',
  GovernmentType: 'molecule',
  EconomyType: 'molecule',
  PopulationEditor: 'molecule',
  FeatureTags: 'molecule',
  EdgeConnector: 'molecule',
  AbilityScoreRoller: 'molecule',
  RacePicker: 'molecule',
  ClassPicker: 'molecule',
  BackgroundPicker: 'molecule',
};
