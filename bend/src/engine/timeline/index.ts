// ============================================
// TIMELINE SYSTEM
// ============================================
//
// The heartbeat of the living world.
//
// Server time is canonical truth.
// Parties track their position on the timeline.
// Characters inherit time from their party.
// Sessions can lag behind but never lead.
//

export {
  // Constants
  TURNS_PER_SLOT,
  SLOTS_PER_DAY,
  TURNS_PER_DAY,
  SLOTS_PER_HOUR,
  HOURS_PER_DAY,
  SLOT_PERIODS,

  // World timestamp
  WorldTimestampSchema,
  type WorldTimestamp,

  // Timestamp operations
  timestampToTurns,
  turnsToTimestamp,
  addTurns,
  addSlots,
  addDays,
  compareTimestamps,
  getSlotPeriod,
  slotToHour,
  hourToSlot,
  formatTimestamp,

  // Canonical timeline (server truth)
  CanonicalTimelineSchema,
  type CanonicalTimeline,

  // Party timeline (party's position)
  PartyTimelineSchema,
  type PartyTimeline,

  // Time advancement
  TimeAdvancementSchema,
  type TimeAdvancement,

  // Fast travel / quantum tunneling
  FastTravelRequestSchema,
  FastTravelResultSchema,
  type FastTravelRequest,
  type FastTravelResult,

  // Simulation ticks
  SimulationTickSchema,
  type SimulationTick,

  // Scheduled events
  ScheduledEventSchema,
  type ScheduledEvent,

  // Helper functions
  calculateLag,
  canAdvancePastCanonical,
  getTriggeredEvents,
  createPartyTimeline,
  advancePartyTime,
} from './substrate';

// ============================================
// CANONICAL CURSOR
// ============================================

export {
  // Cursor types
  CanonicalCursorSchema,
  type CanonicalCursor,

  // Cursor functions
  getCanonicalCursor,
  getScopeCursor,
  isCursorBehind,
  cursorLag,
} from './cursor';

// ============================================
// DELTAS
// ============================================

export {
  // Delta types
  DeltaSchema,
  DeltaScopeSchema,
  type Delta,
  type DeltaScope,

  // Delta functions
  getDeltas,
  getDeltasByTime,
  getLatestDelta,
  countDeltas,
  writeDelta,
} from './deltas';

// ============================================
// STATE PROJECTION
// ============================================

export {
  // Projection types
  ProjectionResultSchema,
  type ProjectionResult,
  type ProjectionOptions,
  type SpeculativeProjection,

  // Projection functions
  project,
  createSpeculativeProjection,
  commitSpeculativeProjection,
} from './projection';
