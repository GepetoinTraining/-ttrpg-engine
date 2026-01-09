/**
 * MIGRATION 009: Sessions & Quests
 *
 * Game sessions, events, quests, downtime
 */

export const MIGRATION_009_SESSIONS = {
  version: 9,
  name: '009_sessions',
  tables: [
    // ============================================
    // SESSIONS
    // ============================================
    {
      name: 'sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          session_number INTEGER NOT NULL,
          title TEXT,

          -- Status
          status TEXT DEFAULT 'planned',

          -- Timing
          world_date TEXT,
          started_at TEXT,
          ended_at TEXT,

          -- Current scene (JSON)
          current_scene TEXT DEFAULT '{}',

          -- GM notes (JSON)
          gm_notes TEXT DEFAULT '{}',

          -- Summary
          summary TEXT,

          -- XP/Loot awarded
          xp_awarded INTEGER DEFAULT 0,
          loot_distributed TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // SESSION EVENTS
    // ============================================
    {
      name: 'session_events',
      sql: `
        CREATE TABLE IF NOT EXISTS session_events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),

          -- Link to canonical delta stream (when event caused world changes)
          sync_log_id TEXT REFERENCES sync_log(id),

          type TEXT NOT NULL,
          category TEXT,

          timestamp TEXT NOT NULL,
          world_date TEXT,

          -- Who/what triggered
          triggered_by_type TEXT,
          triggered_by_id TEXT,
          triggered_by_name TEXT,

          -- Event data (JSON)
          data TEXT NOT NULL DEFAULT '{}',

          -- Flags
          is_important INTEGER DEFAULT 0,
          is_visible_to_players INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // QUESTS
    // ============================================
    {
      name: 'quests',
      sql: `
        CREATE TABLE IF NOT EXISTS quests (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          party_id TEXT REFERENCES parties(id),

          name TEXT NOT NULL,
          description TEXT,

          -- Source
          giver_npc_id TEXT REFERENCES characters(id),
          source_type TEXT,

          -- Status
          status TEXT DEFAULT 'available',
          progress REAL DEFAULT 0,

          -- Rewards (JSON)
          rewards TEXT DEFAULT '{}',

          -- Secrets (JSON arrays)
          secrets TEXT DEFAULT '[]',
          hidden_objectives TEXT DEFAULT '[]',

          -- GM notes
          gm_notes TEXT,

          -- Timing
          accepted_at TEXT,
          completed_at TEXT,
          deadline TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // QUEST OBJECTIVES
    // ============================================
    {
      name: 'quest_objectives',
      sql: `
        CREATE TABLE IF NOT EXISTS quest_objectives (
          id TEXT PRIMARY KEY,
          quest_id TEXT NOT NULL REFERENCES quests(id),

          name TEXT NOT NULL,
          description TEXT,

          -- Status
          status TEXT DEFAULT 'incomplete',
          progress REAL DEFAULT 0,
          required_progress REAL DEFAULT 1,

          -- Type
          objective_type TEXT,
          target_id TEXT,
          target_count INTEGER,
          current_count INTEGER DEFAULT 0,

          -- Flags
          is_optional INTEGER DEFAULT 0,
          is_hidden INTEGER DEFAULT 0,

          sort_order INTEGER DEFAULT 0,

          completed_at TEXT
        )
      `,
    },

    // ============================================
    // DOWNTIME PERIODS
    // ============================================
    {
      name: 'downtime_periods',
      sql: `
        CREATE TABLE IF NOT EXISTS downtime_periods (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          start_date TEXT NOT NULL,
          end_date TEXT,
          days_total INTEGER NOT NULL,

          status TEXT DEFAULT 'active',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // DOWNTIME ACTIONS
    // ============================================
    {
      name: 'downtime_actions',
      sql: `
        CREATE TABLE IF NOT EXISTS downtime_actions (
          id TEXT PRIMARY KEY,
          period_id TEXT NOT NULL REFERENCES downtime_periods(id),
          character_id TEXT NOT NULL REFERENCES characters(id),

          day INTEGER NOT NULL,
          slot INTEGER DEFAULT 0,

          activity_type TEXT NOT NULL,
          activity_data TEXT DEFAULT '{}',

          -- Costs
          gold_cost INTEGER DEFAULT 0,
          items_required TEXT DEFAULT '[]',

          -- Status
          status TEXT DEFAULT 'queued',

          -- Result (JSON)
          result TEXT DEFAULT '{}',

          created_at TEXT NOT NULL,
          resolved_at TEXT
        )
      `,
    },
  ],

  indexes: [
    // Sessions
    'CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON sessions(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_number ON sessions(campaign_id, session_number)',

    // Session events
    'CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_type ON session_events(type)',
    'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON session_events(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_events_sync ON session_events(sync_log_id)',

    // Quests
    'CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_quests_party ON quests(party_id)',
    'CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status)',
    'CREATE INDEX IF NOT EXISTS idx_quests_giver ON quests(giver_npc_id)',

    // Quest objectives
    'CREATE INDEX IF NOT EXISTS idx_objectives_quest ON quest_objectives(quest_id)',
    'CREATE INDEX IF NOT EXISTS idx_objectives_status ON quest_objectives(status)',

    // Downtime periods
    'CREATE INDEX IF NOT EXISTS idx_downtime_campaign ON downtime_periods(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_downtime_status ON downtime_periods(status)',

    // Downtime actions
    'CREATE INDEX IF NOT EXISTS idx_downtime_actions_period ON downtime_actions(period_id)',
    'CREATE INDEX IF NOT EXISTS idx_downtime_actions_character ON downtime_actions(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_downtime_actions_status ON downtime_actions(status)',
  ],
};
