/**
 * INFER - Semantic Intent → Required Topology
 *
 * The inverse of extraction.
 *
 * Given a concept ("tavern with patrons eating"), infer:
 * 1. What MUST exist (even if unrendered)
 * 2. What interactions are possible
 * 3. What UI systems are needed
 * 4. What edges connect the topology
 *
 * The kitchen exists because the food exists.
 * The door exists because the kitchen is reachable.
 * The form exists because the player might order.
 */

// ============================================
// TYPES
// ============================================

// A node in the inferred topology
export interface InferredNode {
  id: string;
  name: string;
  type: 'location' | 'entity' | 'object' | 'system' | 'interaction';
  seed: bigint;
  rendered: boolean;        // Is this currently visible?
  implied_by: string[];     // What nodes imply this exists?
  implies: string[];        // What nodes does this imply?
  physics?: {
    temperature?: string;
    density?: string;
    mass?: number;
  };
}

// An edge connecting nodes
export interface InferredEdge {
  from: string;
  to: string;
  type: 'contains' | 'connects' | 'requires' | 'produces' | 'serves';
  traversable: boolean;     // Can players cross this edge?
  visible: boolean;         // Is this connection obvious?
}

// UI system requirements
export interface RequiredSystem {
  name: string;
  type: 'form' | 'dialog' | 'menu' | 'action' | 'display';
  trigger: string;          // What triggers this system?
  components: string[];     // What UI components are needed?
  seeds: bigint[];          // Seeds for those components
}

// The full inference result
export interface InferenceResult {
  nodes: InferredNode[];
  edges: InferredEdge[];
  systems: RequiredSystem[];
  unrendered: string[];     // Nodes that exist but aren't shown
  entry_points: string[];   // Where players can interact
}

// ============================================
// IMPLICATION RULES
// ============================================

// If X exists, Y must also exist (even if hidden)
const IMPLICATIONS: Record<string, string[]> = {
  // Food implies kitchen, ingredients, cook
  'food': ['kitchen', 'ingredients', 'cook', 'dishes'],
  'meal': ['food', 'table', 'utensils'],
  'drink': ['bar', 'barkeep', 'glasses', 'storage'],

  // Locations imply structure
  'tavern': ['entrance', 'common_room', 'bar', 'kitchen', 'storage', 'stairs'],
  'inn': ['tavern', 'rooms', 'innkeeper', 'beds'],
  'shop': ['entrance', 'counter', 'storage', 'shopkeeper', 'goods'],
  'temple': ['entrance', 'nave', 'altar', 'priest', 'shrine'],
  'dungeon': ['entrance', 'corridors', 'rooms', 'traps', 'monsters', 'treasure'],

  // Entities imply roles and needs
  'patron': ['seat', 'money', 'wants'],
  'barkeep': ['bar', 'drinks', 'gossip', 'money_box'],
  'cook': ['kitchen', 'tools', 'ingredients'],
  'innkeeper': ['keys', 'ledger', 'rooms'],
  'merchant': ['goods', 'prices', 'haggle'],
  'guard': ['weapon', 'armor', 'patrol_route'],

  // Actions imply systems
  'eating': ['food', 'table', 'menu', 'payment'],
  'drinking': ['drinks', 'bar', 'tab'],
  'sleeping': ['room', 'bed', 'rest_system'],
  'buying': ['goods', 'money', 'transaction_form'],
  'talking': ['npc', 'dialog_system', 'topics'],
  'fighting': ['combat_system', 'initiative', 'health'],
};

// What UI components each system needs
const SYSTEM_COMPONENTS: Record<string, { type: RequiredSystem['type']; components: string[] }> = {
  'menu': { type: 'menu', components: ['Card', 'Button', 'Text', 'Badge'] },
  'dialog_system': { type: 'dialog', components: ['Card', 'Text', 'Button', 'Avatar'] },
  'transaction_form': { type: 'form', components: ['Card', 'Input', 'Button', 'Text', 'Badge'] },
  'rest_system': { type: 'action', components: ['Card', 'Button', 'ProgressDot'] },
  'combat_system': { type: 'display', components: ['Token', 'GridCell', 'Card', 'Button', 'Badge'] },
  'payment': { type: 'form', components: ['Input', 'Button', 'Text'] },
  'tab': { type: 'display', components: ['Card', 'Text', 'Button'] },
};

// Component name to prime (from definitions.ts)
const COMPONENT_PRIMES: Record<string, number> = {
  'Button': 2,
  'Text': 3,
  'Input': 5,
  'Icon': 7,
  'Avatar': 11,
  'Spinner': 13,
  'Card': 6,
  'Badge': 21,
  'Token': 35,
  'GridCell': 9,
  'ProgressDot': 13,
};

// ============================================
// INFERENCE ENGINE
// ============================================

/**
 * Parse natural language into concept tokens
 */
function tokenize(description: string): string[] {
  const lower = description.toLowerCase();
  const tokens: string[] = [];

  // Extract known concepts
  const allConcepts = Object.keys(IMPLICATIONS);
  for (const concept of allConcepts) {
    if (lower.includes(concept)) {
      tokens.push(concept);
    }
  }

  // Extract action words
  const actions = ['eating', 'drinking', 'sleeping', 'buying', 'talking', 'fighting'];
  for (const action of actions) {
    if (lower.includes(action) || lower.includes(action.replace('ing', ''))) {
      tokens.push(action);
    }
  }

  return [...new Set(tokens)];
}

/**
 * Expand tokens to full implication set
 */
function expandImplications(tokens: string[]): Map<string, string[]> {
  const expanded = new Map<string, string[]>();
  const queue = [...tokens];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const implies = IMPLICATIONS[current] || [];
    expanded.set(current, implies);

    // Add unvisited implications to queue
    for (const implied of implies) {
      if (!visited.has(implied)) {
        queue.push(implied);
      }
    }
  }

  return expanded;
}

/**
 * Determine node type from name
 */
function inferNodeType(name: string): InferredNode['type'] {
  const locations = ['tavern', 'inn', 'shop', 'temple', 'dungeon', 'kitchen',
                     'bar', 'room', 'entrance', 'storage', 'common_room',
                     'nave', 'altar', 'corridors'];
  const entities = ['patron', 'barkeep', 'cook', 'innkeeper', 'merchant',
                    'guard', 'priest', 'npc', 'monster'];
  const objects = ['food', 'drink', 'table', 'bed', 'goods', 'weapon',
                   'armor', 'treasure', 'key', 'ingredients', 'dishes',
                   'utensils', 'glasses', 'money', 'ledger'];
  const systems = ['menu', 'dialog_system', 'transaction_form', 'rest_system',
                   'combat_system', 'payment', 'tab'];
  const interactions = ['eating', 'drinking', 'sleeping', 'buying',
                        'talking', 'fighting', 'haggle'];

  if (locations.includes(name)) return 'location';
  if (entities.includes(name)) return 'entity';
  if (objects.includes(name)) return 'object';
  if (systems.includes(name)) return 'system';
  if (interactions.includes(name)) return 'interaction';

  return 'object'; // Default
}

/**
 * Generate a seed for a concept
 */
function conceptToSeed(name: string, type: InferredNode['type']): bigint {
  // Simple hash-based seed generation
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }

  // Type multiplier
  const typeMultiplier: Record<string, number> = {
    'location': 2,
    'entity': 3,
    'object': 5,
    'system': 7,
    'interaction': 11,
  };

  return BigInt(Math.abs(hash)) * BigInt(typeMultiplier[type] || 1);
}

/**
 * Infer physics from node type and name
 */
function inferPhysics(name: string, type: InferredNode['type']): InferredNode['physics'] {
  // Hot things
  if (['kitchen', 'fire', 'forge', 'cook'].includes(name)) {
    return { temperature: 'hot', density: 'solid', mass: 0.7 };
  }

  // Cold things
  if (['storage', 'cellar', 'dungeon', 'ice'].includes(name)) {
    return { temperature: 'cold', density: 'solid', mass: 0.6 };
  }

  // Busy/warm things
  if (['tavern', 'common_room', 'market'].includes(name)) {
    return { temperature: 'warm', density: 'liquid', mass: 0.5 };
  }

  // People
  if (type === 'entity') {
    return { temperature: 'warm', density: 'solid', mass: 0.6 };
  }

  // Systems (ethereal)
  if (type === 'system') {
    return { temperature: 'cold', density: 'gas', mass: 0.3 };
  }

  // Default
  return { temperature: 'cold', density: 'solid', mass: 0.5 };
}

/**
 * Determine if a node should be rendered initially
 */
function shouldRender(name: string, type: InferredNode['type'], primaryTokens: string[]): boolean {
  // Always render primary concepts
  if (primaryTokens.includes(name)) return true;

  // Always render locations the player is in
  if (type === 'location' && ['tavern', 'inn', 'shop', 'common_room', 'entrance'].includes(name)) {
    return true;
  }

  // Render visible entities
  if (type === 'entity' && ['patron', 'barkeep', 'innkeeper', 'merchant'].includes(name)) {
    return true;
  }

  // Don't render behind-the-scenes stuff
  if (['kitchen', 'storage', 'ingredients', 'money_box', 'patrol_route'].includes(name)) {
    return false;
  }

  // Don't render systems until triggered
  if (type === 'system') {
    return false;
  }

  return true;
}

/**
 * Generate edges between nodes
 */
function generateEdges(nodes: Map<string, InferredNode>): InferredEdge[] {
  const edges: InferredEdge[] = [];

  // Location containment
  const containment: Record<string, string[]> = {
    'tavern': ['common_room', 'bar', 'kitchen', 'storage', 'entrance'],
    'inn': ['tavern', 'rooms', 'stairs'],
    'common_room': ['table', 'patron'],
    'bar': ['barkeep', 'drinks', 'glasses'],
    'kitchen': ['cook', 'ingredients', 'dishes', 'food'],
  };

  for (const [parent, children] of Object.entries(containment)) {
    if (!nodes.has(parent)) continue;
    for (const child of children) {
      if (nodes.has(child)) {
        edges.push({
          from: parent,
          to: child,
          type: 'contains',
          traversable: false,
          visible: true,
        });
      }
    }
  }

  // Connections (doors, paths)
  const connections: [string, string][] = [
    ['entrance', 'common_room'],
    ['common_room', 'bar'],
    ['common_room', 'stairs'],
    ['bar', 'kitchen'],
    ['kitchen', 'storage'],
    ['stairs', 'rooms'],
  ];

  for (const [from, to] of connections) {
    if (nodes.has(from) && nodes.has(to)) {
      edges.push({
        from,
        to,
        type: 'connects',
        traversable: true,
        visible: true,
      });
    }
  }

  // Production relationships
  const produces: [string, string][] = [
    ['cook', 'food'],
    ['kitchen', 'meal'],
    ['barkeep', 'drink'],
  ];

  for (const [from, to] of produces) {
    if (nodes.has(from) && nodes.has(to)) {
      edges.push({
        from,
        to,
        type: 'produces',
        traversable: false,
        visible: false,
      });
    }
  }

  // Service relationships
  const serves: [string, string][] = [
    ['barkeep', 'patron'],
    ['innkeeper', 'patron'],
    ['cook', 'barkeep'],
  ];

  for (const [from, to] of serves) {
    if (nodes.has(from) && nodes.has(to)) {
      edges.push({
        from,
        to,
        type: 'serves',
        traversable: false,
        visible: true,
      });
    }
  }

  return edges;
}

/**
 * Identify required UI systems
 */
function identifySystems(nodes: Map<string, InferredNode>): RequiredSystem[] {
  const systems: RequiredSystem[] = [];

  for (const [name, node] of nodes) {
    if (node.type === 'system' || SYSTEM_COMPONENTS[name]) {
      const config = SYSTEM_COMPONENTS[name];
      if (config) {
        systems.push({
          name,
          type: config.type,
          trigger: inferTrigger(name, nodes),
          components: config.components,
          seeds: config.components.map(c => BigInt(COMPONENT_PRIMES[c] || 1)),
        });
      }
    }
  }

  return systems;
}

/**
 * Infer what triggers a system
 */
function inferTrigger(systemName: string, _nodes: Map<string, InferredNode>): string {
  const triggers: Record<string, string> = {
    'menu': 'player approaches bar or table',
    'dialog_system': 'player initiates conversation with NPC',
    'transaction_form': 'player attempts to buy or sell',
    'rest_system': 'player requests to rest',
    'combat_system': 'hostile action detected',
    'payment': 'player completes order',
    'tab': 'player asks for bill',
  };

  return triggers[systemName] || 'player interaction';
}

// ============================================
// MAIN INFERENCE FUNCTION
// ============================================

/**
 * Infer complete topology from natural language description
 */
export function infer(description: string): InferenceResult {
  // 1. Tokenize the description
  const tokens = tokenize(description);

  if (tokens.length === 0) {
    // Try to extract at least something
    tokens.push('location');
  }

  // 2. Expand implications
  const implications = expandImplications(tokens);

  // 3. Build nodes
  const nodes = new Map<string, InferredNode>();

  for (const [concept, implies] of implications) {
    // Add the concept itself
    if (!nodes.has(concept)) {
      const type = inferNodeType(concept);
      nodes.set(concept, {
        id: concept,
        name: concept,
        type,
        seed: conceptToSeed(concept, type),
        rendered: shouldRender(concept, type, tokens),
        implied_by: [],
        implies,
        physics: inferPhysics(concept, type),
      });
    }

    // Add implied concepts
    for (const implied of implies) {
      if (!nodes.has(implied)) {
        const type = inferNodeType(implied);
        nodes.set(implied, {
          id: implied,
          name: implied,
          type,
          seed: conceptToSeed(implied, type),
          rendered: shouldRender(implied, type, tokens),
          implied_by: [concept],
          implies: IMPLICATIONS[implied] || [],
          physics: inferPhysics(implied, type),
        });
      } else {
        // Update implied_by
        const existing = nodes.get(implied)!;
        if (!existing.implied_by.includes(concept)) {
          existing.implied_by.push(concept);
        }
      }
    }
  }

  // 4. Generate edges
  const edges = generateEdges(nodes);

  // 5. Identify required systems
  const systems = identifySystems(nodes);

  // 6. Collect unrendered nodes
  const unrendered = Array.from(nodes.values())
    .filter(n => !n.rendered)
    .map(n => n.id);

  // 7. Identify entry points (interactive nodes)
  const entry_points = Array.from(nodes.values())
    .filter(n => n.type === 'entity' || n.type === 'interaction')
    .filter(n => n.rendered)
    .map(n => n.id);

  return {
    nodes: Array.from(nodes.values()),
    edges,
    systems,
    unrendered,
    entry_points,
  };
}

/**
 * Pretty print an inference result
 */
export function printInference(result: InferenceResult): void {
  console.log('\n=== INFERRED TOPOLOGY ===\n');

  console.log('RENDERED NODES:');
  for (const node of result.nodes.filter(n => n.rendered)) {
    console.log(`  [${node.type}] ${node.name} (seed: ${node.seed})`);
  }

  console.log('\nUNRENDERED (but exist):');
  for (const id of result.unrendered) {
    const node = result.nodes.find(n => n.id === id)!;
    console.log(`  [${node.type}] ${node.name} - implied by: ${node.implied_by.join(', ')}`);
  }

  console.log('\nEDGES:');
  for (const edge of result.edges) {
    const arrow = edge.traversable ? '↔' : '→';
    console.log(`  ${edge.from} ${arrow} ${edge.to} (${edge.type})`);
  }

  console.log('\nREQUIRED SYSTEMS:');
  for (const system of result.systems) {
    console.log(`  [${system.type}] ${system.name}`);
    console.log(`    Trigger: ${system.trigger}`);
    console.log(`    Components: ${system.components.join(', ')}`);
  }

  console.log('\nENTRY POINTS (player can interact):');
  for (const id of result.entry_points) {
    console.log(`  → ${id}`);
  }
}

// ============================================
// CLI TEST
// ============================================

// If run directly, test with sample input
if (import.meta.url.endsWith(process.argv[1]?.replace(/.*\//, '') || '')) {
  const testCases = [
    'tavern with patrons eating',
    'inn where travelers are sleeping',
    'shop with merchant selling goods',
    'dungeon with monsters guarding treasure',
  ];

  for (const test of testCases) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`INPUT: "${test}"`);
    const result = infer(test);
    printInference(result);
  }
}
