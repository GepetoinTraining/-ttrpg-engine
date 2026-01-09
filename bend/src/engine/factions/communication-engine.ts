import type {
  FactionMessage,
  MessengerMethod,
  FactionMessageType,
  MessageStatus,
  InterceptionResult,
  MessageQueue,
  MessagePriority,
} from "./communication";
import {
  calculateTravelDays,
  calculateMessageCost,
  calculateInterceptionChance,
  createMessage,
  hasMessageArrived,
} from "./communication";
import type { FactionNetwork } from "./network";
import { getRouteTravelTime } from "./network";

// ============================================
// COMMUNICATION ENGINE
// ============================================
//
// Processes faction communications:
//   - Dispatch messages with travel time
//   - Process arrivals each week
//   - Handle interception attempts
//   - Decrypt encrypted messages
//   - Simulate message loss
//

// ============================================
// MESSAGE DISPATCH
// ============================================

export interface DispatchResult {
  message: FactionMessage;
  cost: number;
  estimatedArrivalDays: number;
  route: string[];
  risks: string[];
}

/**
 * Dispatch a message through the faction network.
 */
export function dispatchMessage(
  params: {
    campaignId: string;
    factionId: string;
    type: FactionMessageType;
    sender: {
      id: string;
      name: string;
      title?: string;
      locationId: string;
      locationName: string;
    };
    recipient: {
      id: string;
      name: string;
      title?: string;
      locationId: string;
      locationName: string;
    };
    subject: string;
    content: string;
    priority: MessagePriority;
    method?: MessengerMethod;
    encrypt?: boolean;
    orderDetails?: FactionMessage["orderDetails"];
    intelligence?: FactionMessage["intelligence"];
    attachedResources?: FactionMessage["attachedResources"];
  },
  network: FactionNetwork,
  currentDate: string,
): DispatchResult {
  // Find route between sender and recipient
  const senderNode = network.nodes.find(n => n.locationId === params.sender.locationId);
  const recipientNode = network.nodes.find(n => n.locationId === params.recipient.locationId);

  // Calculate distance (estimate if no direct route)
  let distanceMiles = 100; // Default estimate
  let method = params.method ?? network.communicationPolicy.preferredMethod;

  if (senderNode && recipientNode) {
    const routeInfo = getRouteTravelTime(network, senderNode.id, recipientNode.id);
    if (routeInfo.route) {
      distanceMiles = routeInfo.route.distanceMiles;
      method = routeInfo.route.method;
    } else {
      // Estimate based on hierarchy
      distanceMiles = (Math.abs(senderNode.hierarchyLevel - recipientNode.hierarchyLevel) + 1) * 50;
    }
  }

  // Override method based on priority
  if (params.priority === "critical" && network.nodes.some(n => n.specialCapabilities.includes("magic_sending"))) {
    method = "magic_sending";
  }

  // Calculate travel time and cost
  const travelDays = calculateTravelDays(distanceMiles, method);
  const cost = calculateMessageCost(distanceMiles, method, params.priority);

  // Build the message
  const baseMessage = createMessage({
    campaignId: params.campaignId,
    factionId: params.factionId,
    type: params.type,
    senderId: params.sender.id,
    senderName: params.sender.name,
    senderLocation: params.sender.locationId,
    senderLocationName: params.sender.locationName,
    recipientId: params.recipient.id,
    recipientName: params.recipient.name,
    recipientLocation: params.recipient.locationId,
    recipientLocationName: params.recipient.locationName,
    subject: params.subject,
    content: params.content,
    priority: params.priority,
    messengerMethod: method,
    distanceMiles,
    currentDate,
  });

  // Add optional fields
  const message: FactionMessage = {
    ...baseMessage,
    id: crypto.randomUUID(),
    senderTitle: params.sender.title,
    recipientTitle: params.recipient.title,
    orderDetails: params.orderDetails,
    intelligence: params.intelligence ?? [],
    attachedResources: params.attachedResources,
    isEncrypted: params.encrypt ?? (network.communicationPolicy.encryptSensitive && params.priority !== "routine"),
    encryptionDC: params.encrypt ? 15 : undefined,
    status: "dispatched",
  };

  // Identify risks
  const risks: string[] = [];
  const interceptionChance = calculateInterceptionChance(method, distanceMiles, 0);
  if (interceptionChance > 0.2) {
    risks.push("High interception risk");
  }
  if (method === "carrier_bird") {
    risks.push("Bird could be shot down");
  }
  if (distanceMiles > 200) {
    risks.push("Long distance increases exposure");
  }

  return {
    message,
    cost,
    estimatedArrivalDays: travelDays,
    route: [], // Would be populated with waypoints
    risks,
  };
}

// ============================================
// MESSAGE ARRIVAL PROCESSING
// ============================================

export interface ArrivalResult {
  arrivedMessages: FactionMessage[];
  inTransitMessages: FactionMessage[];
  lostMessages: FactionMessage[];
  delayedMessages: FactionMessage[];
}

/**
 * Process message arrivals for a time period.
 */
export function processMessageArrivals(
  messages: FactionMessage[],
  currentDate: string,
  _daysElapsed: number,
  routeDangers: Map<string, number>, // locationId -> danger level
): ArrivalResult {
  const arrivedMessages: FactionMessage[] = [];
  const inTransitMessages: FactionMessage[] = [];
  const lostMessages: FactionMessage[] = [];
  const delayedMessages: FactionMessage[] = [];

  for (const message of messages) {
    // Skip already resolved messages
    if (["delivered", "read", "acted_upon", "intercepted", "lost"].includes(message.status)) {
      continue;
    }

    // Check if message should have arrived
    if (hasMessageArrived(message, currentDate)) {
      // Check for loss (weather, bandits, etc.)
      const lossChance = calculateLossChance(message, routeDangers);
      if (Math.random() < lossChance) {
        lostMessages.push({
          ...message,
          status: "lost",
          updatedAt: new Date().toISOString(),
        });
        continue;
      }

      // Message arrives successfully
      arrivedMessages.push({
        ...message,
        status: "delivered",
        actualArrival: currentDate,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Check for delays
      const delayChance = 0.1; // 10% chance of delay per transit period
      if (Math.random() < delayChance) {
        const delayDays = 1 + Math.floor(Math.random() * 3);
        const reasons = ["Bad weather", "Road blocked", "Courier illness", "Horse lame", "Detour required"];
        const reason = reasons[Math.floor(Math.random() * reasons.length)];

        const newArrival = new Date(new Date(message.estimatedArrival).getTime() + delayDays * 24 * 60 * 60 * 1000);

        delayedMessages.push({
          ...message,
          status: "delayed" as MessageStatus,
          estimatedArrival: newArrival.toISOString(),
          delays: [
            ...message.delays,
            { reason, daysLost: delayDays },
          ],
          updatedAt: new Date().toISOString(),
        });
      } else {
        inTransitMessages.push(message);
      }
    }
  }

  return {
    arrivedMessages,
    inTransitMessages,
    lostMessages,
    delayedMessages,
  };
}

function calculateLossChance(
  message: FactionMessage,
  routeDangers: Map<string, number>,
): number {
  let baseChance = 0.02; // 2% base loss chance

  // Method affects loss chance
  const methodLoss: Record<MessengerMethod, number> = {
    foot_courier: 0.05,
    mounted_courier: 0.03,
    relay_network: 0.01,
    carrier_bird: 0.08,
    magic_sending: 0,
    smuggler_network: 0.04,
    ship_courier: 0.06,
    caravan: 0.02,
  };
  baseChance += methodLoss[message.messengerMethod];

  // Long distance increases risk
  baseChance += message.distanceMiles / 2000;

  // Route danger
  const danger = routeDangers.get(message.recipientLocation) ?? 0;
  baseChance += danger * 0.02;

  return Math.min(0.3, baseChance); // Cap at 30%
}

// ============================================
// INTERCEPTION
// ============================================

export interface InterceptionAttempt {
  messageId: string;
  interceptorId: string;
  interceptorName: string;
  method: "ambush" | "bribery" | "theft" | "magic" | "spy_network" | "turned_courier";
  skill: number;          // Modifier to add to roll
  location?: string;      // Where the interception happens
  hasCodebook?: boolean;  // Can they decrypt?
}

/**
 * Attempt to intercept a message in transit.
 */
export function attemptInterception(
  message: FactionMessage,
  attempt: InterceptionAttempt,
): InterceptionResult {
  // Base DC to intercept
  let interceptDC = 15;

  // Method modifiers
  const methodDC: Record<typeof attempt.method, number> = {
    ambush: 12,
    bribery: 10,
    theft: 15,
    magic: 18,
    spy_network: 8,
    turned_courier: 5,
  };
  interceptDC = methodDC[attempt.method];

  // Message security adds to DC
  if (message.isEncrypted) interceptDC += 2;
  if (message.priority === "critical") interceptDC += 3;

  // Roll
  const roll = Math.floor(Math.random() * 20) + 1 + attempt.skill;
  const success = roll >= interceptDC;

  if (!success) {
    // Failed interception
    const alertChance = attempt.method === "ambush" ? 0.8 : 0.3;
    const alertGenerated = Math.random() < alertChance;

    return {
      success: false,
      messageId: message.id,
      method: attempt.method,
      outcome: "copied_and_sent", // Message continues unharmed
      decryptionAttempted: false,
      decryptionSuccess: false,
      courierFate: "unaware",
      alertGenerated,
      suspicionRaised: alertGenerated ? 20 : 5,
      contentLearned: false,
      senderLearned: false,
      recipientLearned: false,
    };
  }

  // Successful interception!
  // Determine outcome based on method
  let outcome: InterceptionResult["outcome"] = "copied_and_sent";
  let courierFate: InterceptionResult["courierFate"] = "unaware";

  switch (attempt.method) {
    case "ambush":
      outcome = Math.random() < 0.5 ? "destroyed" : "delayed_and_sent";
      courierFate = Math.random() < 0.3 ? "killed" : "captured";
      break;
    case "bribery":
      outcome = "copied_and_sent";
      courierFate = "bribed";
      break;
    case "theft":
      outcome = "copied_and_sent";
      courierFate = "unaware";
      break;
    case "magic":
      outcome = "copied_and_sent";
      courierFate = "unaware";
      break;
    case "spy_network":
      outcome = "copied_and_sent";
      courierFate = "unaware";
      break;
    case "turned_courier":
      outcome = Math.random() < 0.3 ? "replaced" : "copied_and_sent";
      courierFate = "bribed";
      break;
  }

  // Try to decrypt if encrypted
  let decryptionSuccess = !message.isEncrypted; // Auto-success if not encrypted
  if (message.isEncrypted && (attempt.hasCodebook || attempt.method === "magic")) {
    const decryptRoll = Math.floor(Math.random() * 20) + 1 + attempt.skill;
    const decryptDC = message.encryptionDC ?? 15;
    decryptionSuccess = attempt.hasCodebook ? true : decryptRoll >= decryptDC;
  }

  // What was learned?
  const contentLearned = decryptionSuccess;
  const senderLearned = true; // Usually visible on message
  const recipientLearned = true;

  return {
    success: true,
    messageId: message.id,
    method: attempt.method,
    outcome,
    decryptionAttempted: message.isEncrypted,
    decryptionSuccess,
    courierFate,
    alertGenerated: courierFate === "killed" || courierFate === "captured",
    suspicionRaised: courierFate === "killed" ? 50 : (courierFate === "captured" ? 30 : 0),
    contentLearned,
    senderLearned,
    recipientLearned,
  };
}

/**
 * Apply interception result to a message.
 */
export function applyInterception(
  message: FactionMessage,
  result: InterceptionResult,
  interceptorId: string,
  interceptorName: string,
  currentDate: string,
): FactionMessage {
  const updated: FactionMessage = {
    ...message,
    wasIntercepted: true,
    interceptedBy: interceptorId,
    interceptedByName: interceptorName,
    interceptedAt: currentDate,
    interceptionMethod: result.method,
    interceptionOutcome: result.outcome,
    decryptedByInterceptor: result.decryptionSuccess,
    updatedAt: new Date().toISOString(),
  };

  // Update status based on outcome
  switch (result.outcome) {
    case "destroyed":
      updated.status = "intercepted";
      break;
    case "delayed_and_sent":
      // Add delay
      const delay = 2 + Math.floor(Math.random() * 5);
      updated.estimatedArrival = new Date(
        new Date(updated.estimatedArrival).getTime() + delay * 24 * 60 * 60 * 1000
      ).toISOString();
      updated.delays = [...updated.delays, { reason: "Interception delay", daysLost: delay }];
      break;
    case "replaced":
      // Content would be replaced - caller handles this
      break;
    case "copied_and_sent":
      // Message continues normally
      break;
  }

  return updated;
}

// ============================================
// MESSAGE QUEUE MANAGEMENT
// ============================================

/**
 * Add a message to a node's queue.
 */
export function addToInbox(
  queue: MessageQueue,
  messageId: string,
): MessageQueue {
  return {
    ...queue,
    inbox: [...queue.inbox, messageId],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark a message as read.
 */
export function markAsRead(
  queue: MessageQueue,
  messageId: string,
): MessageQueue {
  return {
    ...queue,
    inbox: queue.inbox.filter(id => id !== messageId),
    readMessages: [...queue.readMessages, messageId],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Process standing orders from a message.
 */
export function addStandingOrder(
  queue: MessageQueue,
  order: {
    content: string;
    issuedBy: string;
    priority: MessagePriority;
    expiresAt?: string;
  },
  receivedAt: string,
): MessageQueue {
  return {
    ...queue,
    standingOrders: [
      ...queue.standingOrders,
      {
        id: crypto.randomUUID(),
        content: order.content,
        receivedAt,
        issuedBy: order.issuedBy,
        expiresAt: order.expiresAt,
        priority: order.priority,
        stillValid: true,
      },
    ],
    lastContactWithHQ: receivedAt,
    weeksWithoutContact: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update weeks without contact.
 */
export function incrementWeeksWithoutContact(
  queue: MessageQueue,
): MessageQueue {
  return {
    ...queue,
    weeksWithoutContact: queue.weeksWithoutContact + 1,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Send orders to all nodes in a network.
 */
export function broadcastOrders(
  network: FactionNetwork,
  order: {
    content: string;
    priority: MessagePriority;
    authority: "suggestion" | "request" | "order" | "command";
    targetNodes?: string[]; // If empty, all nodes
  },
  sender: {
    id: string;
    name: string;
    title: string;
    locationId: string;
    locationName: string;
  },
  currentDate: string,
): { messages: FactionMessage[]; totalCost: number } {
  const messages: FactionMessage[] = [];
  let totalCost = 0;

  const targetNodes = order.targetNodes?.length
    ? network.nodes.filter(n => order.targetNodes!.includes(n.id))
    : network.nodes.filter(n => n.id !== network.headquartersId);

  for (const node of targetNodes) {
    if (!node.governorId && !node.actingLeader) continue;

    const recipientId = node.governorId ?? node.actingLeader!.npcId;
    const recipientName = node.governorName ?? node.actingLeader!.name;

    const result = dispatchMessage(
      {
        campaignId: network.campaignId,
        factionId: network.factionId,
        type: "order",
        sender,
        recipient: {
          id: recipientId,
          name: recipientName,
          locationId: node.locationId,
          locationName: node.locationName,
        },
        subject: `Orders: ${order.content.substring(0, 50)}...`,
        content: order.content,
        priority: order.priority,
        encrypt: order.priority !== "routine",
        orderDetails: {
          actionRequired: order.content,
          authority: order.authority,
        },
      },
      network,
      currentDate,
    );

    messages.push(result.message);
    totalCost += result.cost;
  }

  return { messages, totalCost };
}

/**
 * Process all message arrivals and update queues.
 */
export function processWeeklyMessages(
  messages: FactionMessage[],
  queues: Map<string, MessageQueue>,
  currentDate: string,
  daysElapsed: number,
  routeDangers: Map<string, number>,
): {
  updatedMessages: FactionMessage[];
  updatedQueues: Map<string, MessageQueue>;
  arrivals: Map<string, FactionMessage[]>; // nodeId -> arrived messages
  losses: FactionMessage[];
} {
  const result = processMessageArrivals(messages, currentDate, daysElapsed, routeDangers);

  const updatedQueues = new Map(queues);
  const arrivals = new Map<string, FactionMessage[]>();

  // Add arrived messages to recipient queues
  for (const message of result.arrivedMessages) {
    // Find the queue for the recipient location
    const nodeId = findNodeIdByLocation(message.recipientLocation, queues);
    if (!nodeId) continue;

    const queue = updatedQueues.get(nodeId);
    if (!queue) continue;

    updatedQueues.set(nodeId, addToInbox(queue, message.id));

    // Track arrivals by node
    const nodeArrivals = arrivals.get(nodeId) ?? [];
    nodeArrivals.push(message);
    arrivals.set(nodeId, nodeArrivals);
  }

  // Combine all message states
  const updatedMessages = [
    ...result.arrivedMessages,
    ...result.inTransitMessages,
    ...result.lostMessages,
    ...result.delayedMessages,
  ];

  return {
    updatedMessages,
    updatedQueues,
    arrivals,
    losses: result.lostMessages,
  };
}

function findNodeIdByLocation(
  _locationId: string,
  queues: Map<string, MessageQueue>,
): string | null {
  // In practice, you'd have a lookup. For now, iterate.
  for (const [_nodeId, queue] of queues) {
    // Queue should have locationId, but we're checking by nodeId pattern
    if (queue.nodeId) return queue.nodeId;
  }
  return null;
}
