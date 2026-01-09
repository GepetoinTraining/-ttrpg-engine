import { z } from 'zod';

// ============================================
// TURN SUBSTRATE - THE HEARTBEAT OF TIME
// ============================================
//
// Philosophy: TIME IS DISCRETE, NOT CONTINUOUS
//
// The world doesn't flow - it ticks.
// Each tick is a TURN (6 seconds of world time).
// Turns aggregate into SLOTS (5 minutes = 50 turns).
// Slots aggregate into DAYS (288 slots = 1 day).
//
// Why this matters:
//   - Combat happens in turns
//   - Exploration happens in slots
//   - Travel/downtime happens in days
//   - Economy/population happens in weeks
//
// The PARTY owns a position on the timeline.
// Characters INHERIT time from their party.
// The SERVER maintains CANONICAL time.
// Sessions can LAG but never LEAD canonical time.
//

// ============================================
// TIME UNITS
// ============================================

export const TURNS_PER_SLOT = 50;        // 5 minutes = 50 rounds of 6 seconds
export const SLOTS_PER_DAY = 288;        // 24 hours * 12 slots/hour
export const TURNS_PER_DAY = TURNS_PER_SLOT * SLOTS_PER_DAY;  // 14,400 turns

export const SLOTS_PER_HOUR = 12;        // 5-minute slots
export const HOURS_PER_DAY = 24;

// Slot periods (for scheduling, NPC behavior)
export const SLOT_PERIODS = {
  DAWN: { start: 60, end: 84 },          // 5am-7am (slots 60-84)
  MORNING: { start: 84, end: 144 },      // 7am-12pm
  AFTERNOON: { start: 144, end: 204 },   // 12pm-5pm
  EVENING: { start: 204, end: 240 },     // 5pm-8pm
  NIGHT: { start: 240, end: 288 },       // 8pm-12am
  LATE_NIGHT: { start: 0, end: 60 },     // 12am-5am
} as const;

// ============================================
// WORLD TIMESTAMP
// ============================================
//
// Absolute position in world time.
// day=0 is campaign start.
//

export const WorldTimestampSchema = z.object({
  day: z.number().int().min(0),          // Days since campaign start
  slot: z.number().int().min(0).max(287), // Slot within day (0-287)
  turn: z.number().int().min(0).max(49).default(0), // Turn within slot (0-49)
});
export type WorldTimestamp = z.infer<typeof WorldTimestampSchema>;

/**
 * Convert timestamp to total turns since campaign start.
 */
export function timestampToTurns(ts: WorldTimestamp): number {
  return (ts.day * TURNS_PER_DAY) + (ts.slot * TURNS_PER_SLOT) + ts.turn;
}

/**
 * Convert total turns to timestamp.
 */
export function turnsToTimestamp(totalTurns: number): WorldTimestamp {
  const day = Math.floor(totalTurns / TURNS_PER_DAY);
  const remainder = totalTurns % TURNS_PER_DAY;
  const slot = Math.floor(remainder / TURNS_PER_SLOT);
  const turn = remainder % TURNS_PER_SLOT;
  return { day, slot, turn };
}

/**
 * Add turns to a timestamp.
 */
export function addTurns(ts: WorldTimestamp, turns: number): WorldTimestamp {
  return turnsToTimestamp(timestampToTurns(ts) + turns);
}

/**
 * Add slots to a timestamp.
 */
export function addSlots(ts: WorldTimestamp, slots: number): WorldTimestamp {
  return addTurns(ts, slots * TURNS_PER_SLOT);
}

/**
 * Add days to a timestamp.
 */
export function addDays(ts: WorldTimestamp, days: number): WorldTimestamp {
  return { ...ts, day: ts.day + days };
}

/**
 * Compare two timestamps. Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareTimestamps(a: WorldTimestamp, b: WorldTimestamp): number {
  return timestampToTurns(a) - timestampToTurns(b);
}

/**
 * Get the current slot period (dawn, morning, etc).
 */
export function getSlotPeriod(slot: number): keyof typeof SLOT_PERIODS {
  if (slot >= SLOT_PERIODS.DAWN.start && slot < SLOT_PERIODS.DAWN.end) return 'DAWN';
  if (slot >= SLOT_PERIODS.MORNING.start && slot < SLOT_PERIODS.MORNING.end) return 'MORNING';
  if (slot >= SLOT_PERIODS.AFTERNOON.start && slot < SLOT_PERIODS.AFTERNOON.end) return 'AFTERNOON';
  if (slot >= SLOT_PERIODS.EVENING.start && slot < SLOT_PERIODS.EVENING.end) return 'EVENING';
  if (slot >= SLOT_PERIODS.NIGHT.start && slot < SLOT_PERIODS.NIGHT.end) return 'NIGHT';
  return 'LATE_NIGHT';
}

/**
 * Get hour of day from slot (0-23).
 */
export function slotToHour(slot: number): number {
  return Math.floor(slot / SLOTS_PER_HOUR);
}

/**
 * Get slot from hour (0-287, at start of hour).
 */
export function hourToSlot(hour: number): number {
  return hour * SLOTS_PER_HOUR;
}

// ============================================
// CANONICAL TIMELINE (Server Truth)
// ============================================

export const CanonicalTimelineSchema = z.object({
  campaignId: z.string().uuid(),

  // The ONE TRUE TIME
  canonicalTime: WorldTimestampSchema,

  // Campaign calendar info
  calendar: z.object({
    startDate: z.string(),               // "1 Hammer, 1492 DR"
    currentDate: z.string(),             // Formatted current date
    daysElapsed: z.number().int(),
  }),

  // When canonical time last advanced
  lastAdvanced: z.string(),              // ISO timestamp
  advancedBy: z.enum(['session', 'downtime', 'simulation', 'manual']),

  // Simulation state
  simulation: z.object({
    lastEconomyTick: z.number().int(),   // Day number
    lastPopulationTick: z.number().int(),
    lastFactionTick: z.number().int(),
    pendingEvents: z.array(z.string().uuid()).default([]),
  }),
});
export type CanonicalTimeline = z.infer<typeof CanonicalTimelineSchema>;

// ============================================
// PARTY TIMELINE (Party's Position)
// ============================================

export const PartyTimelineSchema = z.object({
  partyId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Party's current position on the timeline
  currentTime: WorldTimestampSchema,

  // How far behind canonical time
  lagBehindCanonical: z.number().int().default(0),  // In turns

  // Session tracking
  session: z.object({
    // Is party currently in a session?
    inSession: z.boolean().default(false),
    sessionId: z.string().uuid().optional(),

    // Time when session started (for delta calculation)
    sessionStartTime: WorldTimestampSchema.optional(),

    // Speculative time during session (may be discarded)
    speculativeTime: WorldTimestampSchema.optional(),
  }),

  // Location on world graph
  location: z.object({
    type: z.enum(['hub', 'poi', 'route', 'wilderness']),
    nodeId: z.string().uuid(),
    nodeName: z.string(),

    // If on a route, position along it
    routeProgress: z.number().min(0).max(1).optional(),

    // If in a hub, which entrance they used
    entranceId: z.string().uuid().optional(),
  }),

  // Travel state
  travel: z.object({
    isTraveling: z.boolean().default(false),
    travelMode: z.enum(['foot', 'mounted', 'wagon', 'ship', 'flying', 'teleport']).optional(),
    departureTime: WorldTimestampSchema.optional(),
    estimatedArrival: WorldTimestampSchema.optional(),
    destination: z.object({
      nodeId: z.string().uuid(),
      nodeName: z.string(),
    }).optional(),
  }),

  // Rest state
  rest: z.object({
    isResting: z.boolean().default(false),
    restType: z.enum(['short', 'long']).optional(),
    restStarted: WorldTimestampSchema.optional(),
    restEnds: WorldTimestampSchema.optional(),
  }),

  // Activity mode (what resolution are we in?)
  activityMode: z.enum([
    'combat',       // Turn-by-turn (6 seconds)
    'exploration',  // Slot-by-slot (5 minutes)
    'travel',       // Hour-by-hour
    'downtime',     // Day-by-day
    'narrative',    // GM-controlled time
  ]).default('narrative'),

  // Last update
  updatedAt: z.string(),
});
export type PartyTimeline = z.infer<typeof PartyTimelineSchema>;

// ============================================
// TIME ADVANCEMENT
// ============================================

export const TimeAdvancementSchema = z.object({
  partyId: z.string().uuid(),

  // What caused the advancement
  cause: z.enum([
    'combat_round',      // Combat turn completed
    'exploration_action', // Searched, investigated, etc.
    'travel',            // Moved between locations
    'rest_short',        // Short rest
    'rest_long',         // Long rest
    'downtime',          // Downtime activity
    'fast_travel',       // Quantum tunneling to catch up
    'narrative',         // GM advanced time
    'waiting',           // Party chose to wait
  ]),

  // How much time passed
  turnsPassed: z.number().int().min(0),

  // Position before/after
  from: WorldTimestampSchema,
  to: WorldTimestampSchema,

  // Location before/after (if changed)
  fromLocation: z.string().uuid().optional(),
  toLocation: z.string().uuid().optional(),

  // Metadata
  description: z.string().optional(),
  triggeredBy: z.string().uuid().optional(),  // Character/action that caused it
  timestamp: z.string(),                       // Real-world timestamp
});
export type TimeAdvancement = z.infer<typeof TimeAdvancementSchema>;

// ============================================
// FAST TRAVEL / QUANTUM TUNNELING
// ============================================
//
// When a party is behind canonical time and needs to catch up.
// The speculative branch is DISCARDED.
// The party "wakes up" at canonical time with Mandela Effect.
//

export const FastTravelRequestSchema = z.object({
  partyId: z.string().uuid(),

  // Where they want to be
  targetTime: WorldTimestampSchema,
  targetLocation: z.object({
    nodeId: z.string().uuid(),
    nodeName: z.string(),
  }),

  // How they're traveling
  method: z.enum([
    'montage',           // Narrated travel sequence
    'skip',              // Just skip ahead
    'teleport',          // Magical instant travel
    'downtime_resolve',  // Resolve queued downtime
  ]),

  // What happens to speculative state
  speculativeResolution: z.enum([
    'discard',           // Throw it away (Mandela Effect)
    'integrate',         // Try to merge (risky)
    'archive',           // Save for reference
  ]).default('discard'),
});
export type FastTravelRequest = z.infer<typeof FastTravelRequestSchema>;

export const FastTravelResultSchema = z.object({
  partyId: z.string().uuid(),
  success: z.boolean(),

  // Time jumped
  from: WorldTimestampSchema,
  to: WorldTimestampSchema,
  turnsTraveled: z.number().int(),

  // What was lost (Mandela Effect)
  discardedState: z.object({
    speculativeTurns: z.number().int(),
    discardedEvents: z.array(z.string()).default([]),
    memoriesLost: z.array(z.string()).default([]),  // For narrative flavor
  }).optional(),

  // What happened during travel
  travelEvents: z.array(z.object({
    day: z.number().int(),
    event: z.string(),
    consequence: z.string().optional(),
  })).default([]),

  // New state
  newTimeline: PartyTimelineSchema,
});
export type FastTravelResult = z.infer<typeof FastTravelResultSchema>;

// ============================================
// SIMULATION TICK AGGREGATION
// ============================================
//
// Different systems tick at different rates.
// This aggregates them properly.
//

export const SimulationTickSchema = z.object({
  campaignId: z.string().uuid(),

  // What's being ticked
  tickType: z.enum([
    'turn',        // Every 6 seconds (combat only)
    'slot',        // Every 5 minutes (exploration)
    'hour',        // Every hour (travel, NPC schedules)
    'day',         // Daily (rest, some economy)
    'week',        // Weekly (population, major economy)
  ]),

  // Time range being processed
  from: WorldTimestampSchema,
  to: WorldTimestampSchema,

  // Systems to tick
  systems: z.array(z.enum([
    'combat',           // Active combats
    'conditions',       // Condition durations
    'npc_schedules',    // NPC movements
    'lair_actions',     // Lair recharge
    'exploration',      // Dungeon state
    'travel',           // Party movement
    'rest',             // Rest completion
    'economy',          // Market prices, trade
    'population',       // Monster populations
    'factions',         // Faction schemes
    'weather',          // Weather changes
    'events',           // Random events
  ])).default([]),

  // Results
  results: z.array(z.object({
    system: z.string(),
    processed: z.boolean(),
    changes: z.array(z.string()).default([]),
    errors: z.array(z.string()).default([]),
  })).default([]),

  processedAt: z.string(),
});
export type SimulationTick = z.infer<typeof SimulationTickSchema>;

// ============================================
// TIME-BASED EVENT SCHEDULING
// ============================================

export const ScheduledEventSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // When it triggers
  triggerTime: WorldTimestampSchema,

  // What it is
  eventType: z.enum([
    'condition_ends',    // A condition expires
    'spell_ends',        // Concentration/duration ends
    'rest_completes',    // Rest finishes
    'travel_arrives',    // Party arrives at destination
    'lair_recharges',    // Lair action recharges
    'reinforcements',    // Enemies arrive
    'scheduled_event',   // Pre-planned world event
    'faction_action',    // Faction does something
    'population_event',  // Monster population event
    'economic_event',    // Market event
    'custom',            // GM-defined
  ]),

  // Target
  targetType: z.enum(['character', 'party', 'npc', 'location', 'faction', 'global']),
  targetId: z.string().uuid().optional(),

  // Event data
  data: z.record(z.string(), z.any()).default({}),

  // Description
  description: z.string(),

  // Status
  status: z.enum(['pending', 'triggered', 'cancelled', 'expired']).default('pending'),
  triggeredAt: WorldTimestampSchema.optional(),

  // Recurrence
  recurring: z.boolean().default(false),
  recurrenceInterval: z.number().int().optional(),  // In turns
  recurrenceCount: z.number().int().optional(),     // How many times to repeat
  recurrencesRemaining: z.number().int().optional(),
});
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate how far a party is behind canonical time.
 */
export function calculateLag(
  partyTime: WorldTimestamp,
  canonicalTime: WorldTimestamp,
): number {
  return Math.max(0, timestampToTurns(canonicalTime) - timestampToTurns(partyTime));
}

/**
 * Check if a party can perform an action that would advance past canonical time.
 */
export function canAdvancePastCanonical(
  partyTime: WorldTimestamp,
  canonicalTime: WorldTimestamp,
  turnsToAdvance: number,
): boolean {
  const newTime = addTurns(partyTime, turnsToAdvance);
  return compareTimestamps(newTime, canonicalTime) <= 0;
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(ts: WorldTimestamp): string {
  const hour = slotToHour(ts.slot);
  const minute = (ts.slot % SLOTS_PER_HOUR) * 5;
  const period = getSlotPeriod(ts.slot);
  return `Day ${ts.day + 1}, ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} (${period.toLowerCase()})`;
}

/**
 * Get events that should trigger between two timestamps.
 */
export function getTriggeredEvents(
  events: ScheduledEvent[],
  from: WorldTimestamp,
  to: WorldTimestamp,
): ScheduledEvent[] {
  const fromTurns = timestampToTurns(from);
  const toTurns = timestampToTurns(to);

  return events.filter(event => {
    if (event.status !== 'pending') return false;
    const eventTurns = timestampToTurns(event.triggerTime);
    return eventTurns > fromTurns && eventTurns <= toTurns;
  });
}

/**
 * Create a new party timeline at campaign start.
 */
export function createPartyTimeline(
  partyId: string,
  campaignId: string,
  startLocation: { nodeId: string; nodeName: string; type: 'hub' | 'poi' | 'wilderness' },
): PartyTimeline {
  return {
    partyId,
    campaignId,
    currentTime: { day: 0, slot: 96, turn: 0 },  // Start at 8am Day 1
    lagBehindCanonical: 0,
    session: { inSession: false },
    location: {
      type: startLocation.type,
      nodeId: startLocation.nodeId,
      nodeName: startLocation.nodeName,
    },
    travel: { isTraveling: false },
    rest: { isResting: false },
    activityMode: 'narrative',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Advance party time and return the time advancement record.
 */
export function advancePartyTime(
  timeline: PartyTimeline,
  turns: number,
  cause: TimeAdvancement['cause'],
  description?: string,
): { timeline: PartyTimeline; advancement: TimeAdvancement } {
  const from = timeline.currentTime;
  const to = addTurns(from, turns);

  const advancement: TimeAdvancement = {
    partyId: timeline.partyId,
    cause,
    turnsPassed: turns,
    from,
    to,
    description,
    timestamp: new Date().toISOString(),
  };

  const newTimeline: PartyTimeline = {
    ...timeline,
    currentTime: to,
    updatedAt: new Date().toISOString(),
  };

  return { timeline: newTimeline, advancement };
}
