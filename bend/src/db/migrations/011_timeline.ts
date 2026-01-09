/**
 * MIGRATION 011: Timeline & Sync
 *
 * Sync log, deltas, audit log, timeline tracking
 */

export const MIGRATION_011_TIMELINE = {
  version: 11,
  name: '011_timeline',
  tables: [
    // ============================================
    // SYNC LOG (Delta storage)
    // ============================================
    //
    // Party-scoped causality:
    // - version is monotonic WITHIN a party scope
    // - Characters inherit timeline from their party
    // - Campaign-level events use party_id = NULL
    //
    {
      name: 'sync_log',
      sql: `
        CREATE TABLE IF NOT EXISTS sync_log (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Scope: party is the authoritative causal stream
          -- NULL party_id = campaign-level event
          party_id TEXT REFERENCES parties(id),
          session_id TEXT REFERENCES sessions(id),

          -- What changed
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,

          -- The change payload (JSON)
          delta TEXT NOT NULL DEFAULT '{}',

          -- Ordering (monotonic within party scope)
          version INTEGER NOT NULL,
          sequence INTEGER,

          -- Who made the change
          actor_id TEXT,
          actor_type TEXT,

          -- When (real time)
          timestamp TEXT NOT NULL,

          -- When (world time - JSON)
          world_timestamp TEXT,

          -- Sync status
          synced INTEGER DEFAULT 0,
          synced_at TEXT,
          error TEXT
        )
      `,
    },

    // ============================================
    // TIMELINE CURSORS
    // ============================================
    {
      name: 'timeline_cursors',
      sql: `
        CREATE TABLE IF NOT EXISTS timeline_cursors (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Scope (campaign, party, character)
          scope_type TEXT NOT NULL,
          scope_id TEXT NOT NULL,

          -- Position
          sequence INTEGER NOT NULL DEFAULT 0,
          version INTEGER NOT NULL DEFAULT 0,

          -- World time position (JSON)
          world_timestamp TEXT,

          -- Delta count
          delta_count INTEGER DEFAULT 0,

          -- Last update
          computed_at TEXT NOT NULL,

          UNIQUE(campaign_id, scope_type, scope_id)
        )
      `,
    },

    // ============================================
    // SCHEDULED EVENTS
    // ============================================
    {
      name: 'scheduled_events',
      sql: `
        CREATE TABLE IF NOT EXISTS scheduled_events (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- When to trigger (JSON - WorldTimestamp)
          trigger_at TEXT NOT NULL,

          -- Event type
          event_type TEXT NOT NULL,

          -- Payload (JSON)
          payload TEXT DEFAULT '{}',

          -- Recurrence
          recurring INTEGER DEFAULT 0,
          recurrence_pattern TEXT,

          -- Status
          status TEXT DEFAULT 'pending',
          triggered_at TEXT,
          result TEXT,

          -- Scope
          scope_type TEXT,
          scope_id TEXT,

          created_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // AUDIT LOG
    // ============================================
    {
      name: 'audit_log',
      sql: `
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,

          user_id TEXT NOT NULL,
          user_email TEXT,

          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,

          campaign_id TEXT,

          -- Details (JSON)
          details TEXT DEFAULT '{}',

          -- Request info
          ip_address TEXT,
          user_agent TEXT,

          timestamp TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // SPECULATIVE PROJECTIONS
    // ============================================
    {
      name: 'speculative_projections',
      sql: `
        CREATE TABLE IF NOT EXISTS speculative_projections (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Base state reference
          base_version INTEGER NOT NULL,

          -- Speculative deltas (JSON array)
          deltas TEXT DEFAULT '[]',

          -- Computed state (JSON)
          computed_state TEXT DEFAULT '{}',

          -- TTL
          expires_at TEXT NOT NULL,

          -- Status
          status TEXT DEFAULT 'active',
          committed_at TEXT,

          created_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Sync log - party-scoped ordering
    'CREATE INDEX IF NOT EXISTS idx_sync_campaign ON sync_log(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_sync_party ON sync_log(party_id)',
    'CREATE INDEX IF NOT EXISTS idx_sync_party_version ON sync_log(party_id, version)',
    'CREATE INDEX IF NOT EXISTS idx_sync_session ON sync_log(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_sync_version ON sync_log(campaign_id, version)',
    'CREATE INDEX IF NOT EXISTS idx_sync_sequence ON sync_log(sequence)',
    'CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_log(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_sync_actor ON sync_log(actor_id)',
    'CREATE INDEX IF NOT EXISTS idx_sync_timestamp ON sync_log(timestamp)',

    // Timeline cursors
    'CREATE INDEX IF NOT EXISTS idx_cursors_campaign ON timeline_cursors(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_cursors_scope ON timeline_cursors(scope_type, scope_id)',

    // Scheduled events
    'CREATE INDEX IF NOT EXISTS idx_scheduled_campaign ON scheduled_events(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_events(status)',
    'CREATE INDEX IF NOT EXISTS idx_scheduled_type ON scheduled_events(event_type)',

    // Audit log
    'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_campaign ON audit_log(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)',

    // Speculative projections
    'CREATE INDEX IF NOT EXISTS idx_speculative_campaign ON speculative_projections(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_speculative_status ON speculative_projections(status)',
    'CREATE INDEX IF NOT EXISTS idx_speculative_expires ON speculative_projections(expires_at)',
  ],
};
