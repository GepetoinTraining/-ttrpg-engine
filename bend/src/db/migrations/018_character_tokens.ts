/**
 * MIGRATION 018: Character Tokens (Topology-First Characters)
 *
 * Characters are two things:
 * 1. TOKEN - The topology/seed that EXISTS in the world (source of truth)
 * 2. ATOM - The projected stats (cached, derived from token)
 *
 * This migration adds the character_tokens table to store the
 * topology-first character data.
 *
 * The existing `characters` table becomes a projection/cache of the token.
 */

export const MIGRATION_018_CHARACTER_TOKENS = {
  version: 18,
  name: '018_character_tokens',
  tables: [
    // ============================================
    // CHARACTER TOKENS (Source of Truth)
    // ============================================
    {
      name: 'character_tokens',
      sql: `
        CREATE TABLE IF NOT EXISTS character_tokens (
          id TEXT PRIMARY KEY,

          -- Genesis identity (unforgeable)
          uid TEXT NOT NULL UNIQUE,
          seed TEXT NOT NULL,

          -- Lineage (who birthed this character)
          player_seed_id TEXT NOT NULL REFERENCES topology_seeds(id),

          -- Birth record
          birth_timestamp INTEGER NOT NULL,
          birth_entropy TEXT NOT NULL,

          -- Topology breakdown (JSON for debugging/display)
          topology TEXT NOT NULL,
          dominant_type TEXT NOT NULL,
          entropy REAL NOT NULL,

          -- Link to projected character data
          character_id TEXT REFERENCES characters(id),

          -- World position (where in the world is this token)
          world_id TEXT,
          region_id TEXT,
          location_id TEXT,
          position_x REAL DEFAULT 0,
          position_y REAL DEFAULT 0,
          position_z REAL DEFAULT 0,

          -- Physics state
          is_represented INTEGER DEFAULT 0,
          represented_at TEXT,
          last_physics_tick INTEGER,

          -- Status
          status TEXT DEFAULT 'configured',
          destroyed_at TEXT,
          destroyed_by TEXT,

          -- Timestamps
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // TOKEN EVENTS (Timeline of existence)
    // ============================================
    {
      name: 'character_token_events',
      sql: `
        CREATE TABLE IF NOT EXISTS character_token_events (
          id TEXT PRIMARY KEY,
          token_id TEXT NOT NULL REFERENCES character_tokens(id),

          -- Event type
          event_type TEXT NOT NULL,

          -- Event data (JSON)
          event_data TEXT DEFAULT '{}',

          -- Seed evolution (if topology changed)
          seed_before TEXT,
          seed_after TEXT,

          -- Causality
          caused_by_token TEXT,
          caused_by_action TEXT,

          -- Timeline
          game_timestamp TEXT,
          real_timestamp TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Character tokens
    'CREATE INDEX IF NOT EXISTS idx_tokens_uid ON character_tokens(uid)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_seed ON character_tokens(seed)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_player_seed ON character_tokens(player_seed_id)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_character ON character_tokens(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_world ON character_tokens(world_id)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_region ON character_tokens(region_id)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_location ON character_tokens(location_id)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_status ON character_tokens(status)',
    'CREATE INDEX IF NOT EXISTS idx_tokens_represented ON character_tokens(is_represented)',

    // Token events
    'CREATE INDEX IF NOT EXISTS idx_token_events_token ON character_token_events(token_id)',
    'CREATE INDEX IF NOT EXISTS idx_token_events_type ON character_token_events(event_type)',
    'CREATE INDEX IF NOT EXISTS idx_token_events_caused_by ON character_token_events(caused_by_token)',
  ],
};
