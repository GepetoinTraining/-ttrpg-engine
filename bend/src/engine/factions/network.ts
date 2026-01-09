import { z } from "zod";
import type { MessengerMethod } from "./communication";
import { MessengerMethodSchema } from "./communication";

// ============================================
// FACTION NETWORK TOPOLOGY
// ============================================
//
// A faction is a NETWORK of nodes connected by communication routes.
//
// HQ → Regional HQ → Settlement Posts → POI Controls
//          ↓
//     Safe Houses, Cells, Assets
//
// The further from HQ, the more delay, the more autonomy,
// and the more opportunity for treachery or isolation.
//

// ============================================
// NODE TYPES
// ============================================

export const FactionNodeTypeSchema = z.enum([
  "headquarters",       // Main command center
  "regional_hq",        // Regional command (large factions)
  "settlement_post",    // Presence in a settlement
  "poi_control",        // Control of a POI
  "safe_house",         // Hidden location for agents
  "cell",               // Secret operational unit
  "asset",              // Controlled resource/NPC
  "embassy",            // Diplomatic presence
  "outpost",            // Remote station
]);
export type FactionNodeType = z.infer<typeof FactionNodeTypeSchema>;

// ============================================
// NODE STATUS
// ============================================

export const NodeStatusSchema = z.enum([
  "active",           // Operating normally
  "compromised",      // Enemy knows about it
  "isolated",         // Cut off from network
  "dormant",          // Inactive but not destroyed
  "destroyed",        // No longer exists
  "contested",        // Under attack/pressure
]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

// ============================================
// SECURITY LEVEL
// ============================================

export const SecurityLevelSchema = z.enum([
  "open",       // No special security
  "guarded",    // Some precautions
  "secure",     // Serious security measures
  "paranoid",   // Maximum security, slow but safe
]);
export type SecurityLevel = z.infer<typeof SecurityLevelSchema>;

// Security affects discovery DC
export const SECURITY_DISCOVERY_DC: Record<SecurityLevel, number> = {
  open: 10,
  guarded: 15,
  secure: 20,
  paranoid: 25,
};

// ============================================
// COMMUNICATION ROUTE
// ============================================

export const CommunicationRouteSchema = z.object({
  targetNodeId: z.string().uuid(),
  targetNodeName: z.string(),

  // Primary method
  method: MessengerMethodSchema,
  distanceMiles: z.number(),
  travelDays: z.number(),

  // Reliability (0-1, chance of successful delivery)
  reliability: z.number().min(0).max(1),

  // Route danger (from POIs, terrain, etc.)
  dangerLevel: z.number().int().min(0).max(10).default(0),

  // Is this route known to enemies?
  isCompromised: z.boolean().default(false),
  compromisedBy: z.string().uuid().optional(),

  // Alternative methods available
  alternativeMethods: z.array(z.object({
    method: MessengerMethodSchema,
    travelDays: z.number(),
    costMultiplier: z.number(),
  })).default([]),

  // Last successful communication
  lastUsed: z.string().optional(),
  lastSuccessful: z.string().optional(),
});
export type CommunicationRoute = z.infer<typeof CommunicationRouteSchema>;

// ============================================
// FACTION NODE
// ============================================

export const FactionNodeSchema = z.object({
  id: z.string().uuid(),
  factionId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // ─────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────
  name: z.string(),
  nodeType: FactionNodeTypeSchema,

  // Location (settlement or POI)
  locationId: z.string().uuid(),
  locationName: z.string(),
  locationType: z.enum(["settlement", "poi", "wilderness", "hidden"]),
  regionId: z.string().uuid().optional(),

  // ─────────────────────────────────────────
  // HIERARCHY
  // ─────────────────────────────────────────
  parentNodeId: z.string().uuid().optional(),
  childNodeIds: z.array(z.string().uuid()).default([]),

  // Distance from HQ (0 = is HQ)
  hierarchyLevel: z.number().int().min(0),

  // Authority delegation
  delegatedAuthority: z.enum([
    "none",       // Must follow orders exactly
    "tactical",   // Can make small decisions
    "operational",// Can run local operations
    "strategic",  // Can make significant decisions
  ]).default("tactical"),

  // ─────────────────────────────────────────
  // LEADERSHIP
  // ─────────────────────────────────────────
  governorId: z.string().uuid().optional(),
  governorName: z.string().optional(),

  // If no governor, who's in charge?
  actingLeader: z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    temporary: z.boolean(),
    since: z.string(),
  }).optional(),

  // ─────────────────────────────────────────
  // RESOURCES
  // ─────────────────────────────────────────
  resources: z.object({
    gold: z.number().default(0),
    agents: z.number().int().default(0),
    troops: z.number().int().default(0),
    influence: z.number().default(0),
  }),

  // Resource capacity (max this node can hold)
  capacity: z.object({
    maxAgents: z.number().int().default(10),
    maxTroops: z.number().int().default(0),
    maxGold: z.number().default(10000),
  }).optional(),

  // ─────────────────────────────────────────
  // COMMUNICATION
  // ─────────────────────────────────────────
  communicationRoutes: z.array(CommunicationRouteSchema).default([]),

  // Preferred method for outgoing messages
  preferredMethod: MessengerMethodSchema.default("mounted_courier"),

  // Does this node have special communication capabilities?
  specialCapabilities: z.array(z.enum([
    "relay_station",      // Part of relay network
    "carrier_birds",      // Has trained birds
    "magic_sending",      // Has access to sending spell
    "smuggler_contacts",  // Can use smuggler network
  ])).default([]),

  // ─────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────
  status: NodeStatusSchema.default("active"),
  statusReason: z.string().optional(),
  statusSince: z.string().optional(),

  // Security
  securityLevel: SecurityLevelSchema.default("guarded"),
  discoveryDC: z.number().int().optional(),  // Override if special

  // ─────────────────────────────────────────
  // ACTIVITIES
  // ─────────────────────────────────────────
  activeSchemes: z.array(z.string().uuid()).default([]),
  pendingOrders: z.array(z.string().uuid()).default([]),
  ongoingOperations: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    startedAt: z.string(),
    expectedCompletion: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // COMMUNICATION STATE
  // ─────────────────────────────────────────
  lastContactWithParent: z.string().optional(),
  weeksWithoutContact: z.number().int().default(0),
  lastReportSent: z.string().optional(),
  lastOrdersReceived: z.string().optional(),
  operatingOnStaleOrders: z.boolean().default(false),

  // ─────────────────────────────────────────
  // THREATS
  // ─────────────────────────────────────────
  knownThreats: z.array(z.object({
    type: z.enum(["enemy_faction", "authority", "monster", "natural", "internal"]),
    description: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    since: z.string(),
  })).default([]),

  // ─────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────
  establishedAt: z.string(),
  tags: z.array(z.string()).default([]),
  gmNotes: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FactionNode = z.infer<typeof FactionNodeSchema>;

// ============================================
// NETWORK HEALTH METRICS
// ============================================

export const NetworkHealthSchema = z.object({
  totalNodes: z.number().int(),
  activeNodes: z.number().int(),
  compromisedNodes: z.number().int(),
  isolatedNodes: z.number().int(),
  destroyedNodes: z.number().int(),

  // Response times
  averageResponseTime: z.number(),  // Days to reach average node
  maxResponseTime: z.number(),      // Days to reach furthest node
  nodesOutOfContact: z.number().int(),

  // Communication health
  totalRoutes: z.number().int(),
  compromisedRoutes: z.number().int(),
  reliableRoutes: z.number().int(),  // > 80% reliability

  // Resource distribution
  totalGold: z.number(),
  totalAgents: z.number().int(),
  totalTroops: z.number().int(),

  // Weekly costs
  communicationBudget: z.number(),   // GP spent on messengers
  maintenanceCost: z.number(),       // GP for node upkeep

  // Overall health (0-100)
  overallHealth: z.number().int().min(0).max(100),
});
export type NetworkHealth = z.infer<typeof NetworkHealthSchema>;

// ============================================
// FACTION NETWORK
// ============================================

export const FactionNetworkSchema = z.object({
  id: z.string().uuid(),
  factionId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // ─────────────────────────────────────────
  // STRUCTURE
  // ─────────────────────────────────────────
  nodes: z.array(FactionNodeSchema),

  // Headquarters
  headquartersId: z.string().uuid(),
  headquartersLocation: z.string(),

  // ─────────────────────────────────────────
  // COMMUNICATION POLICY
  // ─────────────────────────────────────────
  communicationPolicy: z.object({
    preferredMethod: MessengerMethodSchema.default("mounted_courier"),
    encryptSensitive: z.boolean().default(true),
    encryptionMethod: z.string().optional(),

    reportingFrequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).default("weekly"),
    standingOrderDuration: z.number().int().default(30),  // Days

    // Budget allocation
    weeklyCommsBudget: z.number().default(100),  // GP
  }),

  // ─────────────────────────────────────────
  // CENTRAL PLANNING
  // ─────────────────────────────────────────
  centralPlanning: z.object({
    currentDirective: z.string().optional(),
    directiveIssuedAt: z.string().optional(),
    planningHorizon: z.enum(["immediate", "short", "medium", "long"]),

    // Which nodes have received current orders?
    nodesUpdated: z.array(z.string().uuid()).default([]),
    nodesOutdated: z.array(z.string().uuid()).default([]),

    // Pending mass communications
    pendingBroadcasts: z.array(z.object({
      id: z.string().uuid(),
      content: z.string(),
      priority: z.enum(["routine", "important", "urgent", "critical"]),
      targetNodes: z.array(z.string().uuid()),  // Or empty for all
      dispatchedAt: z.string().optional(),
    })).default([]),
  }),

  // ─────────────────────────────────────────
  // HEALTH
  // ─────────────────────────────────────────
  health: NetworkHealthSchema,

  // ─────────────────────────────────────────
  // COUNTER-INTELLIGENCE
  // ─────────────────────────────────────────
  counterIntelligence: z.object({
    // Known enemy surveillance
    knownSpies: z.array(z.object({
      entityId: z.string().uuid(),
      entityName: z.string(),
      factionId: z.string().uuid().optional(),
      compromisedNodes: z.array(z.string().uuid()),
      discoveredAt: z.string(),
      status: z.enum(["active", "fed_disinfo", "expelled", "turned"]),
    })).default([]),

    // Security events
    recentBreaches: z.array(z.object({
      id: z.string().uuid(),
      nodeId: z.string().uuid(),
      nodeName: z.string(),
      breachType: z.string(),
      severity: z.enum(["minor", "moderate", "major", "catastrophic"]),
      discoveredAt: z.string(),
      resolved: z.boolean(),
    })).default([]),

    // Overall paranoia level
    alertLevel: z.enum(["normal", "elevated", "high", "maximum"]).default("normal"),
  }),

  // ─────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FactionNetwork = z.infer<typeof FactionNetworkSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate travel time between two nodes.
 */
export function getRouteTravelTime(
  network: FactionNetwork,
  fromNodeId: string,
  toNodeId: string,
): { days: number; method: MessengerMethod; route: CommunicationRoute | null } {
  const fromNode = network.nodes.find(n => n.id === fromNodeId);
  if (!fromNode) return { days: Infinity, method: "foot_courier", route: null };

  // Direct route?
  const directRoute = fromNode.communicationRoutes.find(r => r.targetNodeId === toNodeId);
  if (directRoute) {
    return {
      days: directRoute.travelDays,
      method: directRoute.method,
      route: directRoute,
    };
  }

  // Need to find path through network
  // For now, estimate based on hierarchy
  const toNode = network.nodes.find(n => n.id === toNodeId);
  if (!toNode) return { days: Infinity, method: "foot_courier", route: null };

  // Go up to common ancestor, then down
  const levelDiff = Math.abs(fromNode.hierarchyLevel - toNode.hierarchyLevel);
  const estimatedDays = (levelDiff + 2) * 3; // Rough estimate: 3 days per hop

  return {
    days: estimatedDays,
    method: network.communicationPolicy.preferredMethod,
    route: null,
  };
}

/**
 * Find all nodes at a given hierarchy level.
 */
export function getNodesAtLevel(
  network: FactionNetwork,
  level: number,
): FactionNode[] {
  return network.nodes.filter(n => n.hierarchyLevel === level);
}

/**
 * Get all child nodes of a parent.
 */
export function getChildNodes(
  network: FactionNetwork,
  parentId: string,
): FactionNode[] {
  return network.nodes.filter(n => n.parentNodeId === parentId);
}

/**
 * Check if a node is isolated (no contact for too long).
 */
export function isNodeIsolated(
  node: FactionNode,
  maxWeeksWithoutContact: number = 4,
): boolean {
  return node.weeksWithoutContact >= maxWeeksWithoutContact;
}

/**
 * Calculate network health metrics.
 */
export function calculateNetworkHealth(network: FactionNetwork): NetworkHealth {
  const nodes = network.nodes;

  const totalNodes = nodes.length;
  const activeNodes = nodes.filter(n => n.status === "active").length;
  const compromisedNodes = nodes.filter(n => n.status === "compromised").length;
  const isolatedNodes = nodes.filter(n => n.status === "isolated").length;
  const destroyedNodes = nodes.filter(n => n.status === "destroyed").length;

  // Calculate response times
  nodes.find(n => n.id === network.headquartersId);
  let totalResponseTime = 0;
  let maxResponseTime = 0;
  let nodesOutOfContact = 0;

  for (const node of nodes) {
    if (node.id === network.headquartersId) continue;

    const { days } = getRouteTravelTime(network, network.headquartersId, node.id);
    if (days === Infinity) {
      nodesOutOfContact++;
    } else {
      totalResponseTime += days;
      maxResponseTime = Math.max(maxResponseTime, days);
    }
  }

  const averageResponseTime = nodes.length > 1
    ? totalResponseTime / (nodes.length - 1 - nodesOutOfContact)
    : 0;

  // Count routes
  const allRoutes = nodes.flatMap(n => n.communicationRoutes);
  const totalRoutes = allRoutes.length;
  const compromisedRoutes = allRoutes.filter(r => r.isCompromised).length;
  const reliableRoutes = allRoutes.filter(r => r.reliability >= 0.8).length;

  // Sum resources
  const totalGold = nodes.reduce((sum, n) => sum + n.resources.gold, 0);
  const totalAgents = nodes.reduce((sum, n) => sum + n.resources.agents, 0);
  const totalTroops = nodes.reduce((sum, n) => sum + n.resources.troops, 0);

  // Estimate costs
  const communicationBudget = network.communicationPolicy.weeklyCommsBudget;
  const maintenanceCost = activeNodes * 10; // 10gp per node per week

  // Overall health (weighted formula)
  const healthFactors = [
    (activeNodes / totalNodes) * 30,          // Active nodes: 30 points
    ((totalNodes - compromisedNodes) / totalNodes) * 20,  // Uncompromised: 20 points
    ((totalNodes - isolatedNodes) / totalNodes) * 20,     // Connected: 20 points
    (reliableRoutes / Math.max(1, totalRoutes)) * 15,     // Reliable routes: 15 points
    (1 - nodesOutOfContact / Math.max(1, totalNodes - 1)) * 15, // In contact: 15 points
  ];

  const overallHealth = Math.round(healthFactors.reduce((sum, f) => sum + f, 0));

  return {
    totalNodes,
    activeNodes,
    compromisedNodes,
    isolatedNodes,
    destroyedNodes,
    averageResponseTime,
    maxResponseTime,
    nodesOutOfContact,
    totalRoutes,
    compromisedRoutes,
    reliableRoutes,
    totalGold,
    totalAgents,
    totalTroops,
    communicationBudget,
    maintenanceCost,
    overallHealth,
  };
}

/**
 * Create a minimal network for a new faction.
 */
export function createBasicNetwork(
  factionId: string,
  campaignId: string,
  headquarters: {
    locationId: string;
    locationName: string;
    locationType: "settlement" | "poi" | "wilderness" | "hidden";
  },
): FactionNetwork {
  const now = new Date().toISOString();
  const hqNodeId = crypto.randomUUID();

  const hqNode: FactionNode = {
    id: hqNodeId,
    factionId,
    campaignId,
    name: `${headquarters.locationName} Headquarters`,
    nodeType: "headquarters",
    locationId: headquarters.locationId,
    locationName: headquarters.locationName,
    locationType: headquarters.locationType,
    hierarchyLevel: 0,
    childNodeIds: [],
    delegatedAuthority: "strategic",
    resources: { gold: 0, agents: 0, troops: 0, influence: 0 },
    communicationRoutes: [],
    preferredMethod: "mounted_courier",
    specialCapabilities: [],
    status: "active",
    securityLevel: "secure",
    activeSchemes: [],
    pendingOrders: [],
    ongoingOperations: [],
    weeksWithoutContact: 0,
    operatingOnStaleOrders: false,
    knownThreats: [],
    establishedAt: now,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: crypto.randomUUID(),
    factionId,
    campaignId,
    nodes: [hqNode],
    headquartersId: hqNodeId,
    headquartersLocation: headquarters.locationName,
    communicationPolicy: {
      preferredMethod: "mounted_courier",
      encryptSensitive: true,
      reportingFrequency: "weekly",
      standingOrderDuration: 30,
      weeklyCommsBudget: 100,
    },
    centralPlanning: {
      planningHorizon: "short",
      nodesUpdated: [],
      nodesOutdated: [],
      pendingBroadcasts: [],
    },
    health: {
      totalNodes: 1,
      activeNodes: 1,
      compromisedNodes: 0,
      isolatedNodes: 0,
      destroyedNodes: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      nodesOutOfContact: 0,
      totalRoutes: 0,
      compromisedRoutes: 0,
      reliableRoutes: 0,
      totalGold: 0,
      totalAgents: 0,
      totalTroops: 0,
      communicationBudget: 100,
      maintenanceCost: 10,
      overallHealth: 100,
    },
    counterIntelligence: {
      knownSpies: [],
      recentBreaches: [],
      alertLevel: "normal",
    },
    createdAt: now,
    updatedAt: now,
  };
}
