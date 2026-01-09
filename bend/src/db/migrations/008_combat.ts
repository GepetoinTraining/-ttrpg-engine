/**
 * MIGRATION 008: Combat System
 *
 * Combats, participants, actions, lairs
 */

export const MIGRATION_008_COMBAT = {
  version: 8,
  name: '008_combat',
  tables: [
    // ============================================
    // COMBATS
    // ============================================
    {
      name: 'combats',
      sql: `
        CREATE TABLE IF NOT EXISTS combats (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          session_id TEXT REFERENCES sessions(id),

          -- Status
          status TEXT DEFAULT 'preparing',
          round INTEGER DEFAULT 0,
          current_turn_index INTEGER DEFAULT 0,

          -- Grid
          grid_type TEXT,
          grid_data TEXT DEFAULT '{}',
          map_id TEXT,

          -- Environment (JSON)
          environment TEXT DEFAULT '{}',

          -- Lair
          lair_id TEXT,
          lair_initiative INTEGER,

          -- Timing
          started_at TEXT,
          ended_at TEXT,
          outcome TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // COMBAT PARTICIPANTS
    // ============================================
    {
      name: 'combat_participants',
      sql: `
        CREATE TABLE IF NOT EXISTS combat_participants (
          id TEXT PRIMARY KEY,
          combat_id TEXT NOT NULL REFERENCES combats(id),

          -- Who
          entity_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          name TEXT NOT NULL,

          -- Initiative
          initiative INTEGER NOT NULL,
          initiative_modifier INTEGER DEFAULT 0,

          -- Position
          x INTEGER,
          y INTEGER,

          -- Current state
          hp_current INTEGER,
          hp_max INTEGER,
          ac INTEGER,

          -- Actions
          action_used INTEGER DEFAULT 0,
          bonus_action_used INTEGER DEFAULT 0,
          reaction_used INTEGER DEFAULT 0,
          movement_remaining INTEGER,

          -- Conditions (JSON array)
          conditions TEXT DEFAULT '[]',

          -- Status
          is_active INTEGER DEFAULT 1,
          is_hidden INTEGER DEFAULT 0,
          is_surprised INTEGER DEFAULT 0,

          -- AI hints (JSON)
          ai_hints TEXT DEFAULT '{}',

          sort_order INTEGER DEFAULT 0
        )
      `,
    },

    // ============================================
    // COMBAT LOG
    // ============================================
    {
      name: 'combat_log',
      sql: `
        CREATE TABLE IF NOT EXISTS combat_log (
          id TEXT PRIMARY KEY,
          combat_id TEXT NOT NULL REFERENCES combats(id),

          -- Link to canonical delta stream
          sync_log_id TEXT REFERENCES sync_log(id),

          round INTEGER NOT NULL,
          turn INTEGER,

          actor_id TEXT,
          actor_name TEXT,
          action TEXT NOT NULL,

          target_id TEXT,
          target_name TEXT,

          -- Result (JSON)
          result TEXT DEFAULT '{}',

          timestamp TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // LAIRS
    // ============================================
    {
      name: 'lairs',
      sql: `
        CREATE TABLE IF NOT EXISTS lairs (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Location
          poi_id TEXT REFERENCES pois(id),
          world_node_id TEXT REFERENCES world_nodes(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,

          -- Owner
          creature_type TEXT,
          creature_id TEXT,
          creature_name TEXT,

          -- Lair actions (JSON array)
          lair_actions TEXT DEFAULT '[]',

          -- Regional effects (JSON array)
          regional_effects TEXT DEFAULT '[]',
          regional_effect_radius INTEGER DEFAULT 1,

          -- Lair initiative
          lair_initiative INTEGER DEFAULT 20,

          -- Difficulty
          challenge_rating INTEGER,

          -- Status
          is_active INTEGER DEFAULT 1,
          last_used_at TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // ENCOUNTERS (pre-built combat templates)
    // ============================================
    {
      name: 'encounters',
      sql: `
        CREATE TABLE IF NOT EXISTS encounters (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          description TEXT,

          -- Difficulty
          difficulty TEXT DEFAULT 'medium',
          adjusted_xp INTEGER DEFAULT 0,

          -- Creatures (JSON array)
          creatures TEXT DEFAULT '[]',

          -- Environment (JSON)
          environment TEXT DEFAULT '{}',

          -- Loot (JSON)
          loot TEXT DEFAULT '{}',

          -- Location
          poi_id TEXT REFERENCES pois(id),
          world_node_id TEXT REFERENCES world_nodes(id),

          -- Status
          is_template INTEGER DEFAULT 0,
          times_used INTEGER DEFAULT 0,
          last_used_at TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },
  ],

  indexes: [
    // Combats
    'CREATE INDEX IF NOT EXISTS idx_combats_campaign ON combats(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_combats_session ON combats(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_combats_status ON combats(status)',

    // Combat participants
    'CREATE INDEX IF NOT EXISTS idx_participants_combat ON combat_participants(combat_id)',
    'CREATE INDEX IF NOT EXISTS idx_participants_entity ON combat_participants(entity_id, entity_type)',

    // Combat log
    'CREATE INDEX IF NOT EXISTS idx_combat_log_combat ON combat_log(combat_id)',
    'CREATE INDEX IF NOT EXISTS idx_combat_log_round ON combat_log(combat_id, round)',
    'CREATE INDEX IF NOT EXISTS idx_combat_log_sync ON combat_log(sync_log_id)',

    // Lairs
    'CREATE INDEX IF NOT EXISTS idx_lairs_campaign ON lairs(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_lairs_poi ON lairs(poi_id)',
    'CREATE INDEX IF NOT EXISTS idx_lairs_creature ON lairs(creature_id)',

    // Encounters
    'CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounters(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_encounters_poi ON encounters(poi_id)',
  ],
};
