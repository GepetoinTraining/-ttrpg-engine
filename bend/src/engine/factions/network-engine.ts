import type { FactionNetwork, FactionNode } from "./network";
import { calculateNetworkHealth } from "./network";
import type { Governor } from "./governor";
import type { FactionMessage, MessageQueue, MessagePriority } from "./communication";
import {
  processWeeklyMessages,
  broadcastOrders,
  addStandingOrder,
} from "./communication-engine";
import {
  progressPersonalAgenda,
  updateGovernorLoyalty,
  evaluateOrderCompliance,
  applyLoyaltyUpdate,
  applyAgendaProgress,
  AgendaProgressResult,
  LoyaltyUpdateResult,
  ComplianceResult,
} from "./governor-engine";

// ============================================
// NETWORK ENGINE
// ============================================
//
// The weekly tick that processes the entire faction network:
//   1. Process message arrivals
//   2. Governors read and respond to messages
//   3. Governors pursue personal agendas
//   4. Governors make local decisions
//   5. Update loyalty and suspicion
//   6. Check for network health issues
//   7. Generate events for GM/players
//

// ============================================
// WEEKLY TICK RESULT
// ============================================

export interface FactionNetworkTickResult {
  factionId: string;
  weekNumber: number;

  // Message processing
  messagesDelivered: FactionMessage[];
  messagesLost: FactionMessage[];
  messagesDispatched: FactionMessage[];

  // Governor actions
  governorActions: Array<{
    governorId: string;
    governorName: string;
    nodeName: string;
    ordersReceived: number;
    ordersComplied: number;
    ordersResisted: number;
    agendaProgress: AgendaProgressResult;
    loyaltyChange: LoyaltyUpdateResult;
    complianceResults: ComplianceResult[];
  }>;

  // Network state
  networkHealthBefore: number;
  networkHealthAfter: number;
  nodesIsolated: string[];
  nodesCompromised: string[];

  // Events generated (for narrative)
  events: Array<{
    type: "defection_risk" | "agenda_milestone" | "exposure" | "isolation" | "betrayal" | "communication_breakdown";
    severity: "minor" | "moderate" | "major" | "critical";
    description: string;
    nodeId?: string;
    governorId?: string;
    visibleToParty: boolean;
  }>;

  // Costs
  communicationCost: number;
  maintenanceCost: number;
  totalCost: number;
}

// ============================================
// MAIN TICK FUNCTION
// ============================================

/**
 * Process a weekly tick for the entire faction network.
 */
export function tickFactionNetwork(
  network: FactionNetwork,
  governors: Governor[],
  inTransitMessages: FactionMessage[],
  messageQueues: Map<string, MessageQueue>,
  currentDate: string,
  daysElapsed: number,
  context: {
    routeDangers: Map<string, number>;
    factionDistracted: boolean;
    partyLocations: string[];
    weeklyEvents: {
      factionSuccesses: number;
      factionFailures: number;
    };
  },
): {
  result: FactionNetworkTickResult;
  updatedNetwork: FactionNetwork;
  updatedGovernors: Governor[];
  updatedMessages: FactionMessage[];
  updatedQueues: Map<string, MessageQueue>;
} {
  const events: FactionNetworkTickResult["events"] = [];
  const governorActions: FactionNetworkTickResult["governorActions"] = [];
  const newMessages: FactionMessage[] = [];

  const networkHealthBefore = network.health.overallHealth;

  // Clone for mutation
  let updatedGovernors = [...governors];
  let updatedQueues = new Map(messageQueues);
  let updatedNodes = [...network.nodes];

  // ─────────────────────────────────────────
  // 1. PROCESS MESSAGE ARRIVALS
  // ─────────────────────────────────────────
  const messageResult = processWeeklyMessages(
    inTransitMessages,
    updatedQueues,
    currentDate,
    daysElapsed,
    context.routeDangers,
  );

  updatedQueues = messageResult.updatedQueues;

  // Track lost messages as events
  for (const lost of messageResult.losses) {
    if (lost.priority === "critical" || lost.priority === "urgent") {
      events.push({
        type: "communication_breakdown",
        severity: lost.priority === "critical" ? "critical" : "major",
        description: `Critical message to ${lost.recipientName} was lost`,
        visibleToParty: false,
      });
    }
  }

  // ─────────────────────────────────────────
  // 2. PROCESS EACH GOVERNOR
  // ─────────────────────────────────────────
  for (let i = 0; i < updatedGovernors.length; i++) {
    const governor = updatedGovernors[i];
    const node = updatedNodes.find(n => n.governorId === governor.id);
    if (!node) continue;

    const queue = updatedQueues.get(node.id);
    const arrivedMessages = messageResult.arrivals.get(node.id) ?? [];
    const partyPresent = context.partyLocations.includes(node.locationId);

    // Count orders
    const orderMessages = arrivedMessages.filter(m =>
      ["order", "directive", "command"].includes(m.type)
    );

    // Evaluate compliance for each order
    const complianceResults: ComplianceResult[] = [];
    let ordersComplied = 0;
    let ordersResisted = 0;

    for (const order of orderMessages) {
      const compliance = evaluateOrderCompliance(governor, order);
      complianceResults.push(compliance);

      if (compliance.willComply) {
        ordersComplied++;

        // Add to standing orders if applicable
        if (order.orderDetails && queue) {
          updatedQueues.set(node.id, addStandingOrder(
            queue,
            {
              content: order.orderDetails.actionRequired,
              issuedBy: order.senderName,
              priority: order.priority,
              expiresAt: order.orderDetails.deadline,
            },
            currentDate,
          ));
        }
      } else {
        ordersResisted++;

        // Resistance may generate events
        if (compliance.complianceLevel === "refused" || compliance.complianceLevel === "subverted") {
          events.push({
            type: "betrayal",
            severity: compliance.complianceLevel === "subverted" ? "major" : "moderate",
            description: `${governor.name} ${compliance.complianceLevel} orders at ${node.name}`,
            nodeId: node.id,
            governorId: governor.id,
            visibleToParty: partyPresent,
          });
        }
      }
    }

    // ─────────────────────────────────────────
    // 3. PROGRESS PERSONAL AGENDA
    // ─────────────────────────────────────────
    const agendaResult = progressPersonalAgenda(governor, {
      opportunities: [], // Would come from world state
      threats: ordersResisted > 0 ? ["Faction attention"] : [],
      factionDistracted: context.factionDistracted,
      partyPresent,
      resourcesAvailable: governor.controlledResources.gold,
    });

    // Milestone events
    if (agendaResult.milestone && agendaResult.milestoneDescription) {
      events.push({
        type: "agenda_milestone",
        severity: agendaResult.newProgress >= 75 ? "major" : "moderate",
        description: `${governor.name}: ${agendaResult.milestoneDescription}`,
        governorId: governor.id,
        nodeId: node.id,
        visibleToParty: false,
      });
    }

    // Exposure risk
    if (agendaResult.exposureRisk === "imminent") {
      events.push({
        type: "exposure",
        severity: "critical",
        description: `${governor.name}'s secret agenda is about to be discovered`,
        governorId: governor.id,
        nodeId: node.id,
        visibleToParty: partyPresent && Math.random() < 0.3,
      });
    }

    // ─────────────────────────────────────────
    // 4. UPDATE LOYALTY
    // ─────────────────────────────────────────
    const loyaltyResult = updateGovernorLoyalty(governor, {
      ordersReceived: orderMessages.length > 0,
      ordersReasonable: ordersResisted === 0,
      resourcesProvided: arrivedMessages.some(m => m.attachedResources && m.attachedResources.gold > 0),
      threatsFromFaction: arrivedMessages.some(m => m.content.toLowerCase().includes("consequence") || m.content.toLowerCase().includes("punish")),
      opportunitiesFromOutside: Math.random() < 0.1,
      personalSuccesses: ordersComplied,
      personalFailures: ordersResisted,
      factionSuccesses: context.weeklyEvents.factionSuccesses,
      factionFailures: context.weeklyEvents.factionFailures,
    });

    // Defection risk events
    if (loyaltyResult.defectionRisk === "imminent") {
      events.push({
        type: "defection_risk",
        severity: "critical",
        description: `${governor.name} is on the verge of defecting`,
        governorId: governor.id,
        nodeId: node.id,
        visibleToParty: false,
      });
    } else if (loyaltyResult.defectionRisk === "high") {
      events.push({
        type: "defection_risk",
        severity: "major",
        description: `${governor.name}'s loyalty is dangerously low`,
        governorId: governor.id,
        nodeId: node.id,
        visibleToParty: false,
      });
    }

    // ─────────────────────────────────────────
    // 5. APPLY UPDATES TO GOVERNOR
    // ─────────────────────────────────────────
    let updatedGov = applyLoyaltyUpdate(governor, loyaltyResult);
    updatedGov = applyAgendaProgress(updatedGov, agendaResult);
    updatedGovernors[i] = updatedGov;

    // Record actions
    governorActions.push({
      governorId: governor.id,
      governorName: governor.name,
      nodeName: node.name,
      ordersReceived: orderMessages.length,
      ordersComplied,
      ordersResisted,
      agendaProgress: agendaResult,
      loyaltyChange: loyaltyResult,
      complianceResults,
    });
  }

  // ─────────────────────────────────────────
  // 6. UPDATE NODE CONTACT STATUS
  // ─────────────────────────────────────────
  const nodesIsolated: string[] = [];

  for (let i = 0; i < updatedNodes.length; i++) {
    const node = updatedNodes[i];
    const receivedMessages = messageResult.arrivals.get(node.id)?.length ?? 0;

    if (receivedMessages === 0) {
      // Increment weeks without contact
      updatedNodes[i] = {
        ...node,
        weeksWithoutContact: node.weeksWithoutContact + 1,
        operatingOnStaleOrders: node.weeksWithoutContact >= 2,
        updatedAt: new Date().toISOString(),
      };

      if (node.weeksWithoutContact >= 4 && node.status === "active") {
        updatedNodes[i] = {
          ...updatedNodes[i],
          status: "isolated",
          statusReason: "No contact with network",
          statusSince: currentDate,
        };
        nodesIsolated.push(node.id);

        events.push({
          type: "isolation",
          severity: "major",
          description: `${node.name} has lost contact with the network`,
          nodeId: node.id,
          visibleToParty: false,
        });
      }
    } else {
      // Reset contact
      updatedNodes[i] = {
        ...node,
        weeksWithoutContact: 0,
        lastContactWithParent: currentDate,
        operatingOnStaleOrders: false,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // ─────────────────────────────────────────
  // 7. RECALCULATE NETWORK HEALTH
  // ─────────────────────────────────────────
  const updatedNetwork: FactionNetwork = {
    ...network,
    nodes: updatedNodes,
    updatedAt: new Date().toISOString(),
  };
  updatedNetwork.health = calculateNetworkHealth(updatedNetwork);

  const networkHealthAfter = updatedNetwork.health.overallHealth;

  // Calculate costs
  const communicationCost = updatedNetwork.health.communicationBudget;
  const maintenanceCost = updatedNetwork.health.maintenanceCost;

  // Compile result
  const result: FactionNetworkTickResult = {
    factionId: network.factionId,
    weekNumber: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)), // Approximate

    messagesDelivered: Array.from(messageResult.arrivals.values()).flat(),
    messagesLost: messageResult.losses,
    messagesDispatched: newMessages,

    governorActions,

    networkHealthBefore,
    networkHealthAfter,
    nodesIsolated,
    nodesCompromised: updatedNodes.filter(n => n.status === "compromised").map(n => n.id),

    events,

    communicationCost,
    maintenanceCost,
    totalCost: communicationCost + maintenanceCost,
  };

  return {
    result,
    updatedNetwork,
    updatedGovernors,
    updatedMessages: [
      ...messageResult.updatedMessages,
      ...newMessages,
    ],
    updatedQueues,
  };
}

// ============================================
// ORDER PROPAGATION
// ============================================

export interface PropagationResult {
  messages: FactionMessage[];
  totalCost: number;
  estimatedFullPropagation: number; // Days until all nodes receive
  unreachableNodes: string[];
}

/**
 * Propagate orders from HQ to all nodes.
 */
export function propagateOrders(
  network: FactionNetwork,
  order: {
    content: string;
    priority: MessagePriority;
    authority: "suggestion" | "request" | "order" | "command";
    targetNodes?: string[];
  },
  hqGovernor: {
    id: string;
    name: string;
    title: string;
  },
  currentDate: string,
): PropagationResult {
  const hqNode = network.nodes.find(n => n.id === network.headquartersId);
  if (!hqNode) {
    return {
      messages: [],
      totalCost: 0,
      estimatedFullPropagation: Infinity,
      unreachableNodes: network.nodes.map(n => n.id),
    };
  }

  const { messages, totalCost } = broadcastOrders(
    network,
    order,
    {
      id: hqGovernor.id,
      name: hqGovernor.name,
      title: hqGovernor.title,
      locationId: hqNode.locationId,
      locationName: hqNode.locationName,
    },
    currentDate,
  );

  // Calculate propagation time
  let maxDays = 0;
  const unreachableNodes: string[] = [];

  for (const node of network.nodes) {
    if (node.id === network.headquartersId) continue;

    const message = messages.find(m => m.recipientLocation === node.locationId);
    if (message) {
      const arrivalDate = new Date(message.estimatedArrival);
      const dispatchDate = new Date(message.dispatchedAt);
      const days = (arrivalDate.getTime() - dispatchDate.getTime()) / (24 * 60 * 60 * 1000);
      maxDays = Math.max(maxDays, days);
    } else {
      unreachableNodes.push(node.id);
    }
  }

  return {
    messages,
    totalCost,
    estimatedFullPropagation: maxDays,
    unreachableNodes,
  };
}

// ============================================
// NETWORK HEALTH ANALYSIS
// ============================================

export interface NetworkHealthReport {
  overallHealth: number;
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];

  // Node analysis
  healthyNodes: number;
  atRiskNodes: number;
  criticalNodes: number;

  // Governor analysis
  loyalGovernors: number;
  waverignGovernors: number;
  disloyal: number;

  // Communication analysis
  averageResponseTime: number;
  communicationBottlenecks: string[];
}

/**
 * Analyze network health and generate report.
 */
export function analyzeNetworkHealth(
  network: FactionNetwork,
  governors: Governor[],
): NetworkHealthReport {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Node analysis
  let healthyNodes = 0;
  let atRiskNodes = 0;
  let criticalNodes = 0;

  for (const node of network.nodes) {
    if (node.status === "active" && node.weeksWithoutContact < 2) {
      healthyNodes++;
    } else if (node.status === "isolated" || node.status === "destroyed") {
      criticalNodes++;
      criticalIssues.push(`Node ${node.name} is ${node.status}`);
    } else {
      atRiskNodes++;
      if (node.weeksWithoutContact >= 2) {
        warnings.push(`${node.name} has been out of contact for ${node.weeksWithoutContact} weeks`);
      }
    }
  }

  // Governor analysis
  let loyalGovernors = 0;
  let waveringGovernors = 0;
  let disloyalGovernors = 0;

  for (const gov of governors) {
    if (gov.loyalty >= 60) {
      loyalGovernors++;
    } else if (gov.loyalty >= 30) {
      waveringGovernors++;
      warnings.push(`Governor ${gov.name} has wavering loyalty (${gov.loyalty}%)`);
    } else {
      disloyalGovernors++;
      criticalIssues.push(`Governor ${gov.name} is disloyal (${gov.loyalty}%) - defection risk!`);
    }

    // Check agenda exposure
    if (gov.personalAgenda.suspicionLevel >= 50) {
      warnings.push(`${gov.name} is under suspicion (${gov.personalAgenda.suspicionLevel}%)`);
    }
  }

  // Communication analysis
  const communicationBottlenecks: string[] = [];
  for (const node of network.nodes) {
    if (node.communicationRoutes.length === 1) {
      communicationBottlenecks.push(`${node.name} has only one communication route`);
    }
    if (node.communicationRoutes.some(r => r.isCompromised)) {
      criticalIssues.push(`${node.name} has compromised communication routes`);
    }
  }

  // Generate recommendations
  if (criticalNodes > 0) {
    recommendations.push("Dispatch agents to re-establish contact with isolated nodes");
  }
  if (disloyalGovernors > 0) {
    recommendations.push("Consider replacing disloyal governors or addressing their grievances");
  }
  if (communicationBottlenecks.length > network.nodes.length / 3) {
    recommendations.push("Invest in redundant communication routes");
  }
  if (network.health.averageResponseTime > 7) {
    recommendations.push("Consider faster messenger methods for critical nodes");
  }

  return {
    overallHealth: network.health.overallHealth,
    criticalIssues,
    warnings,
    recommendations,
    healthyNodes,
    atRiskNodes,
    criticalNodes,
    loyalGovernors,
    waverignGovernors: waveringGovernors,
    disloyal: disloyalGovernors,
    averageResponseTime: network.health.averageResponseTime,
    communicationBottlenecks,
  };
}

// ============================================
// COUNTER-INTELLIGENCE
// ============================================

export interface CounterIntelResult {
  discoveredSpies: Array<{
    nodeId: string;
    nodeName: string;
    spyInfo: string;
  }>;
  compromisedRoutes: Array<{
    fromNode: string;
    toNode: string;
    compromisedBy: string;
  }>;
  leakedInformation: string[];
  securityRecommendations: string[];
}

/**
 * Simulate counter-intelligence sweep.
 */
export function performCounterIntelligenceSweep(
  network: FactionNetwork,
  resources: {
    agents: number;
    gold: number;
    magicAvailable: boolean;
  },
): CounterIntelResult {
  const discoveredSpies: CounterIntelResult["discoveredSpies"] = [];
  const compromisedRoutes: CounterIntelResult["compromisedRoutes"] = [];
  const leakedInformation: string[] = [];
  const securityRecommendations: string[] = [];

  // Base detection chance
  const baseChance = 0.1 + (resources.agents * 0.02) + (resources.gold / 1000 * 0.01);
  const detectionChance = resources.magicAvailable ? baseChance * 1.5 : baseChance;

  // Check each node for spies
  for (const node of network.nodes) {
    if (Math.random() < detectionChance * 0.3) {
      // Found something suspicious
      if (node.status === "compromised") {
        discoveredSpies.push({
          nodeId: node.id,
          nodeName: node.name,
          spyInfo: "Confirmed enemy presence",
        });
      } else if (Math.random() < 0.2) {
        // False positive or minor issue
        securityRecommendations.push(`Increase security at ${node.name}`);
      }
    }

    // Check routes
    for (const route of node.communicationRoutes) {
      if (route.isCompromised && Math.random() < detectionChance) {
        compromisedRoutes.push({
          fromNode: node.name,
          toNode: route.targetNodeName,
          compromisedBy: "Unknown faction",
        });
      }
    }
  }

  // Check for leaked information
  if (network.counterIntelligence.recentBreaches.length > 0) {
    for (const breach of network.counterIntelligence.recentBreaches.filter(b => !b.resolved)) {
      leakedInformation.push(`Breach at ${breach.nodeName}: ${breach.breachType}`);
    }
  }

  return {
    discoveredSpies,
    compromisedRoutes,
    leakedInformation,
    securityRecommendations,
  };
}

// ============================================
// NETWORK MODIFICATIONS
// ============================================

/**
 * Add a new node to the network.
 */
export function addNodeToNetwork(
  network: FactionNetwork,
  node: Omit<FactionNode, "id" | "createdAt" | "updatedAt">,
): FactionNetwork {
  const now = new Date().toISOString();
  const newNode: FactionNode = {
    ...node,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  // Update parent's children
  const updatedNodes = network.nodes.map(n => {
    if (n.id === node.parentNodeId) {
      return {
        ...n,
        childNodeIds: [...n.childNodeIds, newNode.id],
        updatedAt: now,
      };
    }
    return n;
  });

  const updatedNetwork: FactionNetwork = {
    ...network,
    nodes: [...updatedNodes, newNode],
    updatedAt: now,
  };

  // Recalculate health
  updatedNetwork.health = calculateNetworkHealth(updatedNetwork);

  return updatedNetwork;
}

/**
 * Remove a node from the network.
 */
export function removeNodeFromNetwork(
  network: FactionNetwork,
  nodeId: string,
): FactionNetwork {
  const now = new Date().toISOString();

  // Can't remove HQ
  if (nodeId === network.headquartersId) {
    throw new Error("Cannot remove headquarters node");
  }

  const nodeToRemove = network.nodes.find(n => n.id === nodeId);
  if (!nodeToRemove) return network;

  // Reassign children to parent
  const updatedNodes = network.nodes
    .filter(n => n.id !== nodeId)
    .map(n => {
      // If this was a child of removed node, reassign to grandparent
      if (n.parentNodeId === nodeId) {
        return {
          ...n,
          parentNodeId: nodeToRemove.parentNodeId,
          hierarchyLevel: n.hierarchyLevel - 1,
          updatedAt: now,
        };
      }
      // If this was parent of removed node, remove from children
      if (n.childNodeIds.includes(nodeId)) {
        return {
          ...n,
          childNodeIds: [
            ...n.childNodeIds.filter(id => id !== nodeId),
            ...nodeToRemove.childNodeIds,
          ],
          updatedAt: now,
        };
      }
      return n;
    });

  const updatedNetwork: FactionNetwork = {
    ...network,
    nodes: updatedNodes,
    updatedAt: now,
  };

  updatedNetwork.health = calculateNetworkHealth(updatedNetwork);

  return updatedNetwork;
}

/**
 * Assign a governor to a node.
 */
export function assignGovernor(
  network: FactionNetwork,
  nodeId: string,
  governor: Governor,
): FactionNetwork {
  const now = new Date().toISOString();

  const updatedNodes = network.nodes.map(n => {
    if (n.id === nodeId) {
      return {
        ...n,
        governorId: governor.id,
        governorName: governor.name,
        updatedAt: now,
      };
    }
    return n;
  });

  return {
    ...network,
    nodes: updatedNodes,
    updatedAt: now,
  };
}
