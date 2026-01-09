import { z } from "zod";

// ============================================
// FACTION COMMUNICATION SYSTEM
// ============================================
//
// Factions don't operate in real-time - they operate through a network.
//
// Orders take time to propagate:
//   - Mounted courier: 50 miles/day (350 miles/week)
//   - Foot courier: 25 miles/day (175 miles/week)
//   - Carrier bird: 150 miles/day (but can be shot down)
//   - Magic: instant (but expensive and rare)
//
// This creates exploitable windows for players:
//   - Intercept messengers
//   - Act before orders arrive
//   - Feed disinformation
//   - Exploit stale standing orders
//

// ============================================
// MESSENGER METHODS
// ============================================

export const MessengerMethodSchema = z.enum([
  "foot_courier",       // Cheap, slow, moderate risk
  "mounted_courier",    // Standard, good speed
  "relay_network",      // Fast but expensive infrastructure
  "carrier_bird",       // Very fast but can be intercepted
  "magic_sending",      // Instant but very expensive
  "smuggler_network",   // Slow but hard to detect
  "ship_courier",       // For coastal/river routes
  "caravan",            // Piggyback on trade, slow but hidden
]);
export type MessengerMethod = z.infer<typeof MessengerMethodSchema>;

// Miles per day by method
export const MESSENGER_SPEEDS: Record<MessengerMethod, number> = {
  foot_courier: 25,
  mounted_courier: 50,
  relay_network: 100,
  carrier_bird: 150,
  magic_sending: Infinity,  // Instant
  smuggler_network: 15,
  ship_courier: 80,
  caravan: 15,
};

// Cost per 100 miles (in gold)
export const MESSENGER_COSTS: Record<MessengerMethod, number> = {
  foot_courier: 1,
  mounted_courier: 5,
  relay_network: 20,
  carrier_bird: 10,
  magic_sending: 100,  // Per message, regardless of distance
  smuggler_network: 15,
  ship_courier: 8,
  caravan: 2,
};

// Base interception chance (0-1)
export const MESSENGER_INTERCEPTION_RISK: Record<MessengerMethod, number> = {
  foot_courier: 0.15,
  mounted_courier: 0.12,
  relay_network: 0.05,    // Hard to catch, organized
  carrier_bird: 0.25,     // Can be shot down
  magic_sending: 0,       // Cannot intercept
  smuggler_network: 0.08, // Hard to identify as messenger
  ship_courier: 0.10,
  caravan: 0.05,          // Hidden among goods
};

// ============================================
// MESSAGE TYPES
// ============================================

export const FactionMessageTypeSchema = z.enum([
  // Orders (HQ → node)
  "directive",          // General policy change
  "order",              // Specific action required
  "recall",             // Return resources/agents
  "reinforcement",      // Sending support
  "warning",            // Threat notification
  "appointment",        // New governor/agent assignment
  "recall_governor",    // Governor being replaced

  // Reports (node → HQ)
  "status_report",      // Regular update
  "intelligence",       // Discovered information
  "request",            // Asking for resources/orders
  "alert",              // Urgent situation
  "confirmation",       // Order acknowledged
  "completion_report",  // Task completed

  // Coordination (node ↔ node)
  "coordination",       // Synchronize actions
  "resource_transfer",  // Moving assets
  "handoff",            // Passing responsibility
  "mutual_support",     // Request for help from peer
]);
export type FactionMessageType = z.infer<typeof FactionMessageTypeSchema>;

// ============================================
// MESSAGE PRIORITY
// ============================================

export const MessagePrioritySchema = z.enum([
  "routine",      // Standard reporting, can wait
  "important",    // Should be acted on promptly
  "urgent",       // Requires immediate attention
  "critical",     // Life or death, faction survival
]);
export type MessagePriority = z.infer<typeof MessagePrioritySchema>;

// Priority affects method selection and cost multiplier
export const PRIORITY_COST_MULTIPLIER: Record<MessagePriority, number> = {
  routine: 1.0,
  important: 1.5,
  urgent: 2.0,
  critical: 3.0,
};

// ============================================
// ORDER AUTHORITY LEVELS
// ============================================

export const OrderAuthoritySchema = z.enum([
  "suggestion",   // Consider doing this
  "request",      // Please do this
  "order",        // Do this (standard command)
  "command",      // Do this immediately (no discretion)
]);
export type OrderAuthority = z.infer<typeof OrderAuthoritySchema>;

// ============================================
// MESSAGE STATUS
// ============================================

export const MessageStatusSchema = z.enum([
  "drafting",       // Being composed
  "dispatched",     // Sent, courier departed
  "in_transit",     // On the way
  "delivered",      // Arrived at destination
  "read",           // Recipient has read it
  "acted_upon",     // Recipient took action
  "intercepted",    // Captured by enemy
  "lost",           // Courier lost/killed, message destroyed
  "delayed",        // Courier delayed (weather, danger)
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

// ============================================
// MAIN MESSAGE SCHEMA
// ============================================

export const FactionMessageSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  factionId: z.string().uuid(),

  // ─────────────────────────────────────────
  // ROUTING
  // ─────────────────────────────────────────
  type: FactionMessageTypeSchema,

  senderId: z.string().uuid(),        // Governor/Node ID
  senderName: z.string(),
  senderTitle: z.string().optional(),
  senderLocation: z.string().uuid(),  // Settlement/POI ID
  senderLocationName: z.string(),

  recipientId: z.string().uuid(),     // Governor/Node ID
  recipientName: z.string(),
  recipientTitle: z.string().optional(),
  recipientLocation: z.string().uuid(),
  recipientLocationName: z.string(),

  // ─────────────────────────────────────────
  // CONTENT
  // ─────────────────────────────────────────
  subject: z.string(),
  content: z.string(),
  priority: MessagePrioritySchema,

  // If this is an order
  orderDetails: z.object({
    actionRequired: z.string(),
    deadline: z.string().optional(),      // World date
    authority: OrderAuthoritySchema,
    resourcesAllocated: z.object({
      gold: z.number().default(0),
      agents: z.number().int().default(0),
      troops: z.number().int().default(0),
    }).optional(),
    expectedOutcome: z.string().optional(),
    failureConsequences: z.string().optional(),
  }).optional(),

  // Attached intelligence
  intelligence: z.array(z.object({
    topic: z.string(),
    content: z.string(),
    reliability: z.enum(["rumor", "unverified", "likely", "confirmed"]),
    source: z.string().optional(),
    actionable: z.boolean().default(false),
  })).default([]),

  // Attached resources (if resource_transfer)
  attachedResources: z.object({
    gold: z.number().default(0),
    agents: z.number().int().default(0),
    troops: z.number().int().default(0),
    items: z.array(z.string()).default([]),
  }).optional(),

  // ─────────────────────────────────────────
  // DELIVERY
  // ─────────────────────────────────────────
  messengerMethod: MessengerMethodSchema,
  messengerName: z.string().optional(),   // Named courier if important

  dispatchedAt: z.string(),               // World date sent
  estimatedArrival: z.string(),           // World date expected
  actualArrival: z.string().optional(),   // World date arrived
  distanceMiles: z.number(),

  // Route taken
  route: z.array(z.object({
    locationId: z.string().uuid(),
    locationName: z.string(),
    arrivedAt: z.string().optional(),
  })).default([]),

  // Delays
  delays: z.array(z.object({
    reason: z.string(),
    daysLost: z.number(),
    location: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────
  status: MessageStatusSchema.default("drafting"),

  readAt: z.string().optional(),
  actedUponAt: z.string().optional(),
  responseRequired: z.boolean().default(false),
  responseDeadline: z.string().optional(),
  responseMessageId: z.string().uuid().optional(),

  // ─────────────────────────────────────────
  // SECURITY
  // ─────────────────────────────────────────
  isEncrypted: z.boolean().default(false),
  encryptionMethod: z.string().optional(),   // "Faction cipher", "One-time pad"
  encryptionDC: z.number().int().optional(), // DC to decrypt

  // Code phrases
  usesCodePhrases: z.boolean().default(false),
  codePhraseDC: z.number().int().optional(), // DC to understand hidden meaning

  // ─────────────────────────────────────────
  // INTERCEPTION
  // ─────────────────────────────────────────
  wasIntercepted: z.boolean().default(false),
  interceptedBy: z.string().uuid().optional(),
  interceptedByName: z.string().optional(),
  interceptedAt: z.string().optional(),
  interceptionLocation: z.string().optional(),
  interceptionMethod: z.enum([
    "ambush",
    "bribery",
    "theft",
    "magic",
    "spy_network",
    "turned_courier",
  ]).optional(),

  // What happened after interception
  interceptionOutcome: z.enum([
    "copied_and_sent",      // Message continued, but copied
    "delayed_and_sent",     // Message delayed but arrived
    "destroyed",            // Message never arrived
    "replaced",             // Original destroyed, false message sent
  ]).optional(),

  // Was content decrypted by interceptor?
  decryptedByInterceptor: z.boolean().default(false),

  // ─────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────
  tags: z.array(z.string()).default([]),
  gmNotes: z.string().optional(),
  isPlotRelevant: z.boolean().default(false),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FactionMessage = z.infer<typeof FactionMessageSchema>;

// ============================================
// MESSAGE QUEUE (per node)
// ============================================

export const MessageQueueSchema = z.object({
  nodeId: z.string().uuid(),
  factionId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Current messages
  inbox: z.array(z.string().uuid()).default([]),      // Received, unread
  readMessages: z.array(z.string().uuid()).default([]), // Read but not acted
  outbox: z.array(z.string().uuid()).default([]),     // Sent
  inTransit: z.array(z.string().uuid()).default([]),  // Currently traveling TO this node

  // Standing orders (persist until countermanded)
  standingOrders: z.array(z.object({
    id: z.string().uuid(),
    content: z.string(),
    receivedAt: z.string(),
    issuedBy: z.string(),           // Who gave the order
    expiresAt: z.string().optional(),
    priority: MessagePrioritySchema,
    stillValid: z.boolean().default(true),
  })).default([]),

  // Communication state
  lastContactWithHQ: z.string().optional(),
  weeksWithoutContact: z.number().int().default(0),
  lastReportSent: z.string().optional(),
  reportingSchedule: z.enum(["daily", "weekly", "biweekly", "monthly"]).default("weekly"),
  overdueReports: z.number().int().default(0),

  updatedAt: z.string(),
});
export type MessageQueue = z.infer<typeof MessageQueueSchema>;

// ============================================
// INTERCEPTION RESULT
// ============================================

export const InterceptionResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().uuid(),

  // What happened
  method: z.enum(["ambush", "bribery", "theft", "magic", "spy_network", "turned_courier"]),
  outcome: z.enum(["copied_and_sent", "delayed_and_sent", "destroyed", "replaced"]),

  // If decryption attempted
  decryptionAttempted: z.boolean().default(false),
  decryptionSuccess: z.boolean().default(false),

  // Consequences
  courierFate: z.enum(["unaware", "bribed", "captured", "killed", "escaped"]),
  alertGenerated: z.boolean().default(false),
  suspicionRaised: z.number().int().default(0),

  // What was learned
  contentLearned: z.boolean(),
  senderLearned: z.boolean(),
  recipientLearned: z.boolean(),

  // If replaced
  replacementContent: z.string().optional(),
});
export type InterceptionResult = z.infer<typeof InterceptionResultSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate travel time in days between two locations.
 */
export function calculateTravelDays(
  distanceMiles: number,
  method: MessengerMethod,
): number {
  const speed = MESSENGER_SPEEDS[method];
  if (speed === Infinity) return 0; // Magic
  return Math.ceil(distanceMiles / speed);
}

/**
 * Calculate message cost in gold.
 */
export function calculateMessageCost(
  distanceMiles: number,
  method: MessengerMethod,
  priority: MessagePriority,
): number {
  const baseCost = method === "magic_sending"
    ? MESSENGER_COSTS[method]  // Flat rate for magic
    : (distanceMiles / 100) * MESSENGER_COSTS[method];

  return Math.ceil(baseCost * PRIORITY_COST_MULTIPLIER[priority]);
}

/**
 * Calculate base interception chance.
 */
export function calculateInterceptionChance(
  method: MessengerMethod,
  distanceMiles: number,
  routeDanger: number,  // 0-10 scale from POIs
): number {
  const baseRisk = MESSENGER_INTERCEPTION_RISK[method];

  // Longer distance = more exposure
  const distanceFactor = Math.min(2, distanceMiles / 200);

  // Dangerous routes increase risk
  const dangerFactor = 1 + (routeDanger / 10);

  return Math.min(0.5, baseRisk * distanceFactor * dangerFactor);
}

/**
 * Create a new message with calculated fields.
 */
export function createMessage(
  base: {
    campaignId: string;
    factionId: string;
    type: FactionMessageType;
    senderId: string;
    senderName: string;
    senderLocation: string;
    senderLocationName: string;
    recipientId: string;
    recipientName: string;
    recipientLocation: string;
    recipientLocationName: string;
    subject: string;
    content: string;
    priority: MessagePriority;
    messengerMethod: MessengerMethod;
    distanceMiles: number;
    currentDate: string;
  },
): Omit<FactionMessage, "id"> {
  const travelDays = calculateTravelDays(base.distanceMiles, base.messengerMethod);
  const currentDateObj = new Date(base.currentDate);
  const arrivalDate = new Date(currentDateObj.getTime() + travelDays * 24 * 60 * 60 * 1000);

  const now = new Date().toISOString();

  return {
    campaignId: base.campaignId,
    factionId: base.factionId,
    type: base.type,
    senderId: base.senderId,
    senderName: base.senderName,
    senderLocation: base.senderLocation,
    senderLocationName: base.senderLocationName,
    recipientId: base.recipientId,
    recipientName: base.recipientName,
    recipientLocation: base.recipientLocation,
    recipientLocationName: base.recipientLocationName,
    subject: base.subject,
    content: base.content,
    priority: base.priority,
    messengerMethod: base.messengerMethod,
    distanceMiles: base.distanceMiles,
    dispatchedAt: base.currentDate,
    estimatedArrival: arrivalDate.toISOString(),
    route: [],
    delays: [],
    status: "dispatched",
    responseRequired: false,
    isEncrypted: false,
    usesCodePhrases: false,
    wasIntercepted: false,
    decryptedByInterceptor: false,
    intelligence: [],
    tags: [],
    isPlotRelevant: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check if a message has arrived based on current date.
 */
export function hasMessageArrived(
  message: FactionMessage,
  currentDate: string,
): boolean {
  if (message.status === "intercepted" || message.status === "lost") {
    return false;
  }
  if (message.actualArrival) {
    return new Date(currentDate) >= new Date(message.actualArrival);
  }
  return new Date(currentDate) >= new Date(message.estimatedArrival);
}

/**
 * Get all valid standing orders for a node.
 */
export function getValidStandingOrders(
  queue: MessageQueue,
  currentDate: string,
): MessageQueue["standingOrders"] {
  const now = new Date(currentDate);
  return queue.standingOrders.filter(order => {
    if (!order.stillValid) return false;
    if (order.expiresAt && new Date(order.expiresAt) < now) return false;
    return true;
  });
}
