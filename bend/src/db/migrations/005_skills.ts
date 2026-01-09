/**
 * MIGRATION 005: Skills System
 *
 * Character skills, discovered skills, skill XP tracking
 */

export const MIGRATION_005_SKILLS = {
  version: 5,
  name: '005_skills',
  tables: [
    // ============================================
    // CHARACTER SKILLS (complete skill state)
    // ============================================
    {
      name: 'character_skills',
      sql: `
        CREATE TABLE IF NOT EXISTS character_skills (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Core skills (JSON - Record<CoreSkill, SkillEntry>)
          core_skills TEXT DEFAULT '{}',

          -- Discovered skills (JSON - Record<string, SkillEntry>)
          discovered_skills TEXT DEFAULT '{}',

          -- Discovered skill definitions (JSON - Record<string, SkillDefinition>)
          discovered_skill_definitions TEXT DEFAULT '{}',

          -- Pending discoveries (JSON array)
          pending_discoveries TEXT DEFAULT '[]',

          -- Unlocked synergies (JSON array)
          synergies_unlocked TEXT DEFAULT '[]',

          -- Totals
          total_skill_xp INTEGER DEFAULT 0,

          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1,

          UNIQUE(character_id)
        )
      `,
    },

    // ============================================
    // SKILL DEFINITIONS (discovered/emergent skills)
    // ============================================
    {
      name: 'skill_definitions',
      sql: `
        CREATE TABLE IF NOT EXISTS skill_definitions (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          name TEXT NOT NULL,
          description TEXT,

          -- Classification
          type TEXT NOT NULL,
          category TEXT,

          -- Parent skills (JSON array)
          parent_skills TEXT DEFAULT '[]',

          -- Scaling
          scaling_ability TEXT,

          -- Tags (JSON array)
          tags TEXT DEFAULT '[]',

          -- Prerequisites (JSON)
          prerequisites TEXT DEFAULT '{}',

          -- Origin (JSON - how it was discovered)
          origin TEXT DEFAULT '{}',

          -- Approval status (JSON)
          approval TEXT DEFAULT '{}',

          -- Scope
          scope TEXT DEFAULT 'character',

          is_active INTEGER DEFAULT 1,

          -- Lore equivalence
          lore_equivalence TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // DISCOVERY RULES
    // ============================================
    {
      name: 'discovery_rules',
      sql: `
        CREATE TABLE IF NOT EXISTS discovery_rules (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          name TEXT NOT NULL,

          -- Required tags to trigger (JSON array)
          required_tags TEXT DEFAULT '[]',

          -- Bonus tags (JSON array)
          bonus_tags TEXT DEFAULT '[]',

          -- Result
          result_skill_id TEXT,

          -- Chance
          base_chance REAL DEFAULT 0.1,

          -- Flags
          is_unique INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // SKILL USAGE LOG (for XP tracking)
    // ============================================
    {
      name: 'skill_usage_log',
      sql: `
        CREATE TABLE IF NOT EXISTS skill_usage_log (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          skill_id TEXT NOT NULL,

          -- Link to canonical delta stream
          sync_log_id TEXT REFERENCES sync_log(id),

          -- Roll details
          dc INTEGER,
          roll_total INTEGER,
          natural_roll INTEGER,
          modifier INTEGER,

          -- Result
          success INTEGER,
          critical INTEGER DEFAULT 0,

          -- Context
          context TEXT,
          session_id TEXT REFERENCES sessions(id),

          -- XP awarded
          xp_awarded INTEGER DEFAULT 0,

          timestamp TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Character skills
    'CREATE INDEX IF NOT EXISTS idx_char_skills_character ON character_skills(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_char_skills_campaign ON character_skills(campaign_id)',

    // Skill definitions
    'CREATE INDEX IF NOT EXISTS idx_skill_defs_campaign ON skill_definitions(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_skill_defs_type ON skill_definitions(type)',
    'CREATE INDEX IF NOT EXISTS idx_skill_defs_scope ON skill_definitions(scope)',

    // Discovery rules
    'CREATE INDEX IF NOT EXISTS idx_discovery_rules_campaign ON discovery_rules(campaign_id)',

    // Skill usage log
    'CREATE INDEX IF NOT EXISTS idx_skill_log_character ON skill_usage_log(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_skill_log_skill ON skill_usage_log(skill_id)',
    'CREATE INDEX IF NOT EXISTS idx_skill_log_session ON skill_usage_log(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_skill_log_timestamp ON skill_usage_log(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_skill_log_sync ON skill_usage_log(sync_log_id)',
  ],
};
