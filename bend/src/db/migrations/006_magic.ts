/**
 * MIGRATION 006: Magic System
 *
 * Spell casts, rest events, entropy tracking, scrolls
 */

export const MIGRATION_006_MAGIC = {
  version: 6,
  name: '006_magic',
  tables: [
    // ============================================
    // CASTER STATE
    // ============================================
    {
      name: 'caster_states',
      sql: `
        CREATE TABLE IF NOT EXISTS caster_states (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Caster type
          caster_type TEXT NOT NULL,

          -- Spell slots (JSON array of {level, max, used})
          slots TEXT DEFAULT '[]',

          -- Pact slots for warlocks (JSON)
          pact_slots TEXT,

          -- Sorcery points
          sorcery_points INTEGER,
          sorcery_points_max INTEGER,

          -- Spellcasting ability
          spellcasting_ability TEXT,
          spellcasting_mod INTEGER DEFAULT 0,
          spell_save_dc INTEGER DEFAULT 8,
          spell_attack_bonus INTEGER DEFAULT 0,

          -- Lore knowledge (JSON - Record<string, LoreEntry>)
          lore TEXT DEFAULT '{}',

          -- Daily entropy (computed from rest events)
          daily_entropy REAL DEFAULT 0,

          -- Concentration
          concentrating TEXT,

          -- Focus
          has_focus INTEGER DEFAULT 0,
          focus_type TEXT,

          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1,

          UNIQUE(character_id)
        )
      `,
    },

    // ============================================
    // SPELL CASTS (delta events)
    // ============================================
    {
      name: 'spell_casts',
      sql: `
        CREATE TABLE IF NOT EXISTS spell_casts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          session_id TEXT REFERENCES sessions(id),
          character_id TEXT NOT NULL REFERENCES characters(id),

          -- Link to canonical delta stream
          sync_log_id TEXT REFERENCES sync_log(id),

          -- Spell info
          spell_id TEXT NOT NULL,
          spell_name TEXT NOT NULL,
          spell_level INTEGER NOT NULL,
          cast_at_level INTEGER,

          -- Slot used
          slot_used INTEGER,

          -- Result
          success INTEGER NOT NULL,
          reason TEXT,

          -- Effects (JSON array)
          effects TEXT DEFAULT '[]',

          -- Costs paid
          materials_consumed TEXT DEFAULT '[]',
          health_paid INTEGER DEFAULT 0,

          -- Paradox
          paradox_triggered INTEGER DEFAULT 0,
          paradox_severity TEXT,
          paradox_effect TEXT,

          -- Entropy
          entropy_gained REAL DEFAULT 0,

          -- World timestamp (JSON)
          world_timestamp TEXT,

          -- Real timestamp
          timestamp TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // REST EVENTS (timeline deltas for resets)
    // ============================================
    {
      name: 'rest_events',
      sql: `
        CREATE TABLE IF NOT EXISTS rest_events (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          session_id TEXT REFERENCES sessions(id),
          character_id TEXT NOT NULL REFERENCES characters(id),

          -- Link to canonical delta stream
          sync_log_id TEXT REFERENCES sync_log(id),

          -- Rest type
          type TEXT NOT NULL,

          -- World timestamp (JSON)
          world_timestamp TEXT NOT NULL,

          -- What was reset (JSON)
          resets TEXT DEFAULT '{}',

          -- Pre-reset state for history (JSON)
          before_state TEXT DEFAULT '{}',

          -- Real timestamp
          timestamp TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // SPELL FORMULAS (known/prepared spells)
    // ============================================
    {
      name: 'spell_formulas',
      sql: `
        CREATE TABLE IF NOT EXISTS spell_formulas (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          -- Is canonical or campaign-specific
          is_canonical INTEGER DEFAULT 0,

          name TEXT NOT NULL,
          level INTEGER NOT NULL,
          school TEXT NOT NULL,

          -- Casting
          casting_time TEXT NOT NULL,
          range TEXT NOT NULL,
          duration TEXT NOT NULL,

          -- Components (JSON)
          components TEXT DEFAULT '{}',

          -- Effects (JSON array)
          effects TEXT DEFAULT '[]',

          -- Classes that can learn (JSON array)
          classes TEXT DEFAULT '[]',

          -- Description
          description TEXT,

          -- Ritual
          is_ritual INTEGER DEFAULT 0,

          -- Concentration
          concentration INTEGER DEFAULT 0,

          -- Lore requirements (JSON)
          lore_requirements TEXT DEFAULT '{}',

          -- Source
          source TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // SCROLLS
    // ============================================
    {
      name: 'scrolls',
      sql: `
        CREATE TABLE IF NOT EXISTS scrolls (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL REFERENCES items(id),

          -- Spell contained
          spell_formula_id TEXT REFERENCES spell_formulas(id),
          spell_name TEXT NOT NULL,
          spell_level INTEGER NOT NULL,

          -- Creator info
          creator_id TEXT,
          creator_name TEXT,
          creation_date TEXT,

          -- Quality
          quality TEXT DEFAULT 'standard',

          -- Usage restrictions
          class_restrictions TEXT DEFAULT '[]',

          -- Status
          is_consumed INTEGER DEFAULT 0,
          consumed_at TEXT,
          consumed_by TEXT,

          created_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Caster states
    'CREATE INDEX IF NOT EXISTS idx_caster_character ON caster_states(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_caster_campaign ON caster_states(campaign_id)',

    // Spell casts
    'CREATE INDEX IF NOT EXISTS idx_spell_casts_campaign ON spell_casts(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_spell_casts_session ON spell_casts(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_spell_casts_character ON spell_casts(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_spell_casts_spell ON spell_casts(spell_id)',
    'CREATE INDEX IF NOT EXISTS idx_spell_casts_timestamp ON spell_casts(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_spell_casts_sync ON spell_casts(sync_log_id)',

    // Rest events
    'CREATE INDEX IF NOT EXISTS idx_rest_events_campaign ON rest_events(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_rest_events_character ON rest_events(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_rest_events_type ON rest_events(type)',
    'CREATE INDEX IF NOT EXISTS idx_rest_events_timestamp ON rest_events(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_rest_events_sync ON rest_events(sync_log_id)',

    // Spell formulas
    'CREATE INDEX IF NOT EXISTS idx_formulas_campaign ON spell_formulas(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_formulas_level ON spell_formulas(level)',
    'CREATE INDEX IF NOT EXISTS idx_formulas_school ON spell_formulas(school)',
    'CREATE INDEX IF NOT EXISTS idx_formulas_name ON spell_formulas(name)',

    // Scrolls
    'CREATE INDEX IF NOT EXISTS idx_scrolls_item ON scrolls(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_scrolls_spell ON scrolls(spell_formula_id)',
  ],
};
