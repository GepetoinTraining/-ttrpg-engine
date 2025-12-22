import { z } from "zod";

// ============================================
// MIDDLEWARE LAYER - DELTAS
// ============================================
//
// Philosophy: MINIMAL SYNC
//
// Turso/SQLite needs efficient sync.
// We don't send entire state every time.
// We send DELTAS - what changed.
//
// This enables:
//   - Offline-first operation
//   - Efficient network usage
//   - Conflict resolution
//   - Undo/redo
//   - Time travel debugging
//

// ============================================
// DELTA TYPES
// ============================================

export const DeltaOperationSchema = z.enum([
  "INSERT", // New record
  "UPDATE", // Partial update
  "DELETE", // Soft delete
  "RESTORE", // Undelete
  "UPSERT", // Insert or update
]);
export type DeltaOperation = z.infer<typeof DeltaOperationSchema>;

// ============================================
// BASE DELTA SCHEMA
// ============================================

export const DeltaSchema = z.object({
  // Unique delta ID
  id: z.string().uuid(),

  // Sequence number (for ordering)
  sequence: z.number().int(),

  // What changed
  table: z.string(),
  recordId: z.string(),
  operation: DeltaOperationSchema,

  // The change
  data: z.record(z.string(), z.any()).optional(), // New/changed fields
  previousData: z.record(z.string(), z.any()).optional(), // For undo

  // Version control
  version: z.number().int(),
  previousVersion: z.number().int().optional(),

  // Metadata
  timestamp: z.date(),
  clientId: z.string(), // Which client made the change
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),

  // Conflict resolution
  conflictResolution: z
    .enum(["client_wins", "server_wins", "merge", "manual"])
    .optional(),

  // Sync state
  synced: z.boolean().default(false),
  syncedAt: z.date().optional(),
  syncError: z.string().optional(),
});
export type Delta = z.infer<typeof DeltaSchema>;

// ============================================
// DELTA BATCH
// ============================================

export const DeltaBatchSchema = z.object({
  id: z.string().uuid(),

  // Batch metadata
  clientId: z.string(),
  userId: z.string().uuid(),
  timestamp: z.date(),

  // Deltas in this batch
  deltas: z.array(DeltaSchema),

  // Ordering
  firstSequence: z.number().int(),
  lastSequence: z.number().int(),

  // Batch status
  status: z.enum(["pending", "syncing", "synced", "failed", "conflict"]),

  // If failed
  error: z.string().optional(),
  conflictingDeltas: z.array(z.string().uuid()).optional(),
});
export type DeltaBatch = z.infer<typeof DeltaBatchSchema>;

// ============================================
// SYNC STATE
// ============================================

export const SyncStateSchema = z.object({
  clientId: z.string(),

  // Last synced
  lastSyncedSequence: z.number().int(),
  lastSyncedAt: z.date().optional(),

  // Pending changes
  pendingDeltas: z.number().int(),
  pendingBatches: z.number().int(),

  // Sync health
  status: z.enum(["synced", "syncing", "pending", "offline", "error"]),
  error: z.string().optional(),

  // Conflict state
  hasConflicts: z.boolean().default(false),
  conflictCount: z.number().int().default(0),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

// ============================================
// TABLE DEFINITIONS (for Turso schema)
// ============================================

export const TableDefinitions = {
  // Campaign level
  campaigns: {
    id: "TEXT PRIMARY KEY",
    name: "TEXT NOT NULL",
    world_id: "TEXT",
    current_arc_id: "TEXT",
    current_session: "INTEGER",
    world_date: "TEXT",
    created_at: "TEXT",
    updated_at: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  sessions: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    session_number: "INTEGER",
    title: "TEXT",
    status: "TEXT",
    world_date: "TEXT",
    started_at: "TEXT",
    ended_at: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Characters
  characters: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    player_id: "TEXT",
    name: "TEXT NOT NULL",
    race: "TEXT",
    class: "TEXT",
    subclass: "TEXT",
    level: "INTEGER",
    background: "TEXT",
    hp_current: "INTEGER",
    hp_max: "INTEGER",
    hp_temp: "INTEGER DEFAULT 0",
    ac: "INTEGER",
    speed: "INTEGER",
    stats_json: "TEXT", // JSON blob for abilities/skills
    features_json: "TEXT",
    spells_json: "TEXT",
    portrait_url: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Inventory - separate table for granular sync
  inventory_items: {
    id: "TEXT PRIMARY KEY",
    owner_id: "TEXT NOT NULL", // Character or party ID
    owner_type: "TEXT NOT NULL", // 'character' or 'party'
    item_id: "TEXT",
    name: "TEXT NOT NULL",
    quantity: "INTEGER DEFAULT 1",
    equipped: "INTEGER DEFAULT 0",
    attuned: "INTEGER DEFAULT 0",
    properties_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Conditions - separate for real-time updates
  conditions: {
    id: "TEXT PRIMARY KEY",
    character_id: "TEXT NOT NULL",
    name: "TEXT NOT NULL",
    source: "TEXT",
    duration: "TEXT",
    ends_on: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Parties
  parties: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    name: "TEXT NOT NULL",
    gold: "INTEGER DEFAULT 0",
    current_location_id: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  party_members: {
    id: "TEXT PRIMARY KEY",
    party_id: "TEXT NOT NULL",
    character_id: "TEXT NOT NULL",
    role: 'TEXT DEFAULT "member"',
    joined_at: "TEXT",
    active: "INTEGER DEFAULT 1",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // NPCs
  npcs: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    name: "TEXT NOT NULL",
    title: "TEXT",
    race: "TEXT",
    occupation: "TEXT",
    location_id: "TEXT",
    faction_id: "TEXT",
    stats_json: "TEXT",
    personality_json: "TEXT",
    knowledge_json: "TEXT",
    secrets_json: "TEXT",
    portrait_url: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // NPC relationships (with party/characters)
  npc_relationships: {
    id: "TEXT PRIMARY KEY",
    npc_id: "TEXT NOT NULL",
    target_id: "TEXT NOT NULL", // Character or party
    target_type: "TEXT NOT NULL",
    attitude: "INTEGER DEFAULT 0",
    memories_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Locations
  locations: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    parent_id: "TEXT",
    name: "TEXT NOT NULL",
    type: "TEXT",
    description: "TEXT",
    details_json: "TEXT",
    secrets_json: "TEXT",
    map_url: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Settlements
  settlements: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    location_id: "TEXT",
    name: "TEXT NOT NULL",
    type: "TEXT",
    population: "INTEGER",
    prosperity: "INTEGER DEFAULT 50",
    stability: "INTEGER DEFAULT 50",
    defense: "INTEGER DEFAULT 50",
    economy_json: "TEXT",
    buildings_json: "TEXT",
    issues_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Factions
  factions: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    name: "TEXT NOT NULL",
    type: "TEXT",
    power: "INTEGER DEFAULT 50",
    goals_json: "TEXT",
    resources_json: "TEXT",
    schemes_json: "TEXT",
    relationships_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Quests
  quests: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    party_id: "TEXT",
    name: "TEXT NOT NULL",
    giver_npc_id: "TEXT",
    status: 'TEXT DEFAULT "available"',
    progress: "INTEGER DEFAULT 0",
    objectives_json: "TEXT",
    rewards_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Combat instances
  combats: {
    id: "TEXT PRIMARY KEY",
    session_id: "TEXT NOT NULL",
    status: 'TEXT DEFAULT "active"',
    round: "INTEGER DEFAULT 1",
    current_turn_index: "INTEGER DEFAULT 0",
    initiative_json: "TEXT",
    grid_json: "TEXT",
    lair_id: "TEXT",
    started_at: "TEXT",
    ended_at: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Combat log entries
  combat_log: {
    id: "TEXT PRIMARY KEY",
    combat_id: "TEXT NOT NULL",
    round: "INTEGER",
    turn: "INTEGER",
    actor_id: "TEXT",
    action: "TEXT",
    target_id: "TEXT",
    result_json: "TEXT",
    timestamp: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Downtime
  downtime_periods: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    start_date: "TEXT",
    end_date: "TEXT",
    days_total: "INTEGER",
    status: 'TEXT DEFAULT "active"',
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  downtime_actions: {
    id: "TEXT PRIMARY KEY",
    period_id: "TEXT NOT NULL",
    character_id: "TEXT NOT NULL",
    day: "INTEGER",
    slot: "INTEGER",
    activity_type: "TEXT",
    activity_json: "TEXT",
    status: 'TEXT DEFAULT "queued"',
    result_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Followers
  followers: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    owner_id: "TEXT NOT NULL",
    name: "TEXT NOT NULL",
    type: "TEXT",
    count: "INTEGER DEFAULT 1",
    loyalty: "INTEGER DEFAULT 50",
    status: 'TEXT DEFAULT "available"',
    mission_json: "TEXT",
    stats_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Economic events
  economic_events: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    type: "TEXT",
    name: "TEXT",
    description: "TEXT",
    scope: "TEXT",
    effects_json: "TEXT",
    start_date: "TEXT",
    end_date: "TEXT",
    status: 'TEXT DEFAULT "active"',
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // AI Agents
  agents: {
    id: "TEXT PRIMARY KEY",
    campaign_id: "TEXT NOT NULL",
    entity_id: "TEXT",
    entity_type: "TEXT",
    agent_type: "TEXT",
    identity_json: "TEXT",
    knowledge_json: "TEXT",
    voice_json: "TEXT",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Agent memories
  agent_memories: {
    id: "TEXT PRIMARY KEY",
    agent_id: "TEXT NOT NULL",
    type: "TEXT",
    content: "TEXT",
    summary: "TEXT",
    importance: "REAL",
    emotional_weight: "REAL",
    associations_json: "TEXT",
    triggers_json: "TEXT",
    created_at: "TEXT",
    last_accessed: "TEXT",
    strength: "REAL DEFAULT 1.0",
    version: "INTEGER DEFAULT 1",
    deleted: "INTEGER DEFAULT 0",
  },

  // Sync metadata
  sync_log: {
    id: "TEXT PRIMARY KEY",
    delta_id: "TEXT NOT NULL",
    table_name: "TEXT NOT NULL",
    record_id: "TEXT NOT NULL",
    operation: "TEXT",
    sequence: "INTEGER",
    client_id: "TEXT",
    user_id: "TEXT",
    timestamp: "TEXT",
    synced: "INTEGER DEFAULT 0",
    synced_at: "TEXT",
    error: "TEXT",
  },
};

// ============================================
// DELTA GENERATOR
// ============================================

export function generateDelta(
  table: string,
  recordId: string,
  operation: DeltaOperation,
  data: Record<string, any>,
  previousData?: Record<string, any>,
  context?: {
    clientId: string;
    userId: string;
    sessionId?: string;
    version?: number;
  },
): Delta {
  return {
    id: crypto.randomUUID(),
    sequence: Date.now(), // Would be proper sequence in production
    table,
    recordId,
    operation,
    data,
    previousData,
    version: context?.version || 1,
    previousVersion: previousData ? (context?.version || 1) - 1 : undefined,
    timestamp: new Date(),
    clientId: context?.clientId || "unknown",
    userId: context?.userId || "unknown",
    sessionId: context?.sessionId,
    synced: false,
  };
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

export const ConflictResolutionSchema = z.object({
  deltaId: z.string().uuid(),
  conflictType: z.enum([
    "concurrent_update", // Same record updated by multiple clients
    "delete_update", // Record deleted while being updated
    "version_mismatch", // Version number conflict
    "constraint_violation", // Database constraint violated
  ]),

  localDelta: DeltaSchema,
  remoteDelta: DeltaSchema,

  resolution: z
    .enum(["local_wins", "remote_wins", "merge", "manual"])
    .optional(),

  mergedData: z.record(z.string(), z.any()).optional(),

  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
});
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

export function resolveConflict(
  local: Delta,
  remote: Delta,
  strategy: "last_write_wins" | "server_wins" | "merge",
): { winner: "local" | "remote" | "merged"; data: Record<string, any> } {
  switch (strategy) {
    case "last_write_wins":
      if (local.timestamp > remote.timestamp) {
        return { winner: "local", data: local.data || {} };
      }
      return { winner: "remote", data: remote.data || {} };

    case "server_wins":
      return { winner: "remote", data: remote.data || {} };

    case "merge":
      // Merge non-conflicting fields
      const merged = { ...remote.data, ...local.data };
      return { winner: "merged", data: merged };

    default:
      return { winner: "remote", data: remote.data || {} };
  }
}

// ============================================
// SYNC PROTOCOL
// ============================================

export interface SyncProtocol {
  // Get pending deltas
  getPendingDeltas(clientId: string): Promise<Delta[]>;

  // Push deltas to server
  pushDeltas(batch: DeltaBatch): Promise<{
    success: boolean;
    syncedSequence: number;
    conflicts: ConflictResolution[];
  }>;

  // Pull deltas from server
  pullDeltas(
    clientId: string,
    sinceSequence: number,
  ): Promise<{
    deltas: Delta[];
    currentSequence: number;
  }>;

  // Resolve conflicts
  resolveConflicts(resolutions: ConflictResolution[]): Promise<void>;

  // Get sync state
  getSyncState(clientId: string): Promise<SyncState>;
}

// ============================================
// OPTIMISTIC UPDATES
// ============================================
//
// For immediate UI response:
// 1. Apply change locally
// 2. Generate delta
// 3. Update UI
// 4. Queue for sync
// 5. Handle server response
//

export const OptimisticUpdateSchema = z.object({
  id: z.string().uuid(),

  // The change
  table: z.string(),
  recordId: z.string(),
  operation: DeltaOperationSchema,
  data: z.record(z.string(), z.any()),

  // Rollback info
  previousState: z.record(z.string(), z.any()).optional(),

  // Status
  status: z.enum([
    "pending",
    "syncing",
    "confirmed",
    "rolled_back",
    "conflicted",
  ]),

  // Associated delta
  deltaId: z.string().uuid(),

  // Timestamps
  appliedAt: z.date(),
  confirmedAt: z.date().optional(),
  rolledBackAt: z.date().optional(),
});
export type OptimisticUpdate = z.infer<typeof OptimisticUpdateSchema>;

// ============================================
// SUBSCRIPTION PATTERN
// ============================================
//
// For real-time updates across clients:
//

export interface DeltaSubscription {
  // Subscribe to changes for specific tables
  subscribe(tables: string[], callback: (deltas: Delta[]) => void): () => void; // Returns unsubscribe

  // Subscribe to specific record
  subscribeToRecord(
    table: string,
    recordId: string,
    callback: (delta: Delta) => void,
  ): () => void;

  // Subscribe to query results
  subscribeToQuery(
    query: { table: string; where: Record<string, any> },
    callback: (deltas: Delta[]) => void,
  ): () => void;
}

// ============================================
// DELTA COMPRESSION
// ============================================
//
// Compress multiple deltas on same record.
//

export function compressDeltas(deltas: Delta[]): Delta[] {
  const byRecord = new Map<string, Delta[]>();

  // Group by table:recordId
  for (const delta of deltas) {
    const key = `${delta.table}:${delta.recordId}`;
    if (!byRecord.has(key)) {
      byRecord.set(key, []);
    }
    byRecord.get(key)!.push(delta);
  }

  // Compress each group
  const compressed: Delta[] = [];

  for (const [key, recordDeltas] of byRecord) {
    if (recordDeltas.length === 1) {
      compressed.push(recordDeltas[0]);
      continue;
    }

    // Sort by sequence
    recordDeltas.sort((a, b) => a.sequence - b.sequence);

    const first = recordDeltas[0];
    const last = recordDeltas[recordDeltas.length - 1];

    // If first is INSERT and last is DELETE, skip entirely
    if (first.operation === "INSERT" && last.operation === "DELETE") {
      continue;
    }

    // If last is DELETE, just keep that
    if (last.operation === "DELETE") {
      compressed.push(last);
      continue;
    }

    // Otherwise, merge all updates into one
    let mergedData: Record<string, any> = {};
    for (const delta of recordDeltas) {
      if (delta.data) {
        mergedData = { ...mergedData, ...delta.data };
      }
    }

    compressed.push({
      ...last,
      operation: first.operation === "INSERT" ? "INSERT" : "UPDATE",
      data: mergedData,
      previousData: first.previousData,
    });
  }

  return compressed;
}
