/**
 * MIGRATION 014: GM Orchestrator Module
 *
 * Three game modes:
 * - PARTY_HUMAN_GM: Classic TTRPG with human GM, engine validates
 * - PARTY_AI_GM: AI mediates party play, human can override
 * - SOLO_AI_GM: AI mediates solo "corridor" experience
 *
 * SOLO_HUMAN_GM explicitly rejected - solo play requires AI assistance.
 *
 * Core principle: GM is "lens + pacing interface, not authority"
 * All world changes via validated deltas through canonical engine pathways.
 */

export const MIGRATION_014_GM_MODULE = {
  version: 14,
  name: '014_gm_module',
  tables: [
    // ============================================
    // AI PROFILES
    // ============================================
    //
    // GM personality/style presets for AI-mediated modes.
    // Can be system presets or user-created.
    //
    {
      name: 'ai_profiles',
      sql: `
        CREATE TABLE IF NOT EXISTS ai_profiles (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          -- Identity
          name TEXT NOT NULL,
          description TEXT,

          -- Style parameters (JSON)
          -- { descriptiveness, combatNarration, challengeLevel, railroading, humor, darkness }
          style TEXT DEFAULT '{}',

          -- Tone: serious | balanced | lighthearted
          tone TEXT DEFAULT 'balanced',

          -- Pacing: slow | moderate | fast
          pacing TEXT DEFAULT 'moderate',

          -- Narrative preferences (JSON)
          -- { hooksEnabled: [...], themes: [...], intensity: 0-1 }
          narrative_config TEXT DEFAULT '{}',

          -- Voice consistency fingerprint (JSON)
          voice TEXT DEFAULT '{}',

          -- System preset vs user-created
          is_system_preset INTEGER DEFAULT 0,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // GM SESSIONS
    // ============================================
    //
    // Active GM session tracking.
    // Links campaign, party, and mode together.
    // One active session per party at a time.
    //
    {
      name: 'gm_sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS gm_sessions (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          party_id TEXT NOT NULL REFERENCES parties(id),

          -- Mode: PARTY_HUMAN_GM | PARTY_AI_GM | SOLO_AI_GM
          mode TEXT NOT NULL,

          -- Who is GMing?
          ai_profile_id TEXT REFERENCES ai_profiles(id),
          human_gm_id TEXT REFERENCES users(id),

          -- Status: active | paused | ended
          status TEXT DEFAULT 'active',

          -- Current scene
          current_scene_id TEXT,

          -- Context packet (JSON - truth slice GM is allowed to know)
          context_packet TEXT DEFAULT '{}',

          -- Timeline cursor position (JSON - WorldTimestamp)
          timeline_cursor TEXT DEFAULT '{}',

          -- Base session reference (links to sessions table)
          session_id TEXT REFERENCES sessions(id),

          -- For SOLO_AI_GM: current corridor
          active_corridor_id TEXT,

          -- Override tracking for PARTY_AI_GM
          override_count INTEGER DEFAULT 0,
          last_override_at TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          ended_at TEXT,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // GM SCENES
    // ============================================
    //
    // Scene proposals and outcomes.
    // Follows two-phase commit: proposed -> validated -> committed/rejected
    //
    {
      name: 'gm_scenes',
      sql: `
        CREATE TABLE IF NOT EXISTS gm_scenes (
          id TEXT PRIMARY KEY,
          gm_session_id TEXT NOT NULL REFERENCES gm_sessions(id),

          -- Scene type (from CardTypeSchema)
          scene_type TEXT NOT NULL,

          -- Proposal metadata
          proposed_at TEXT NOT NULL,
          proposed_by TEXT NOT NULL,

          -- The scene plan (JSON - ScenePlan schema)
          proposal TEXT NOT NULL DEFAULT '{}',

          -- Validation result (JSON)
          validation_result TEXT,
          validated_at TEXT,

          -- Status: proposed | validated | committed | rejected
          status TEXT DEFAULT 'proposed',

          -- Committed deltas (JSON array of delta IDs)
          committed_deltas TEXT DEFAULT '[]',
          committed_at TEXT,

          -- Player choice that triggered commit
          player_choice_id TEXT,

          -- World time advancement (JSON - WorldTimestamp delta)
          time_advancement TEXT,

          -- Ordering within session
          sequence_order INTEGER DEFAULT 0,

          -- Parent scene (for nested/branching)
          parent_scene_id TEXT REFERENCES gm_scenes(id),

          created_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // SCENE CHOICES
    // ============================================
    //
    // Player options within scenes.
    // Each choice has proposed delta effects.
    //
    {
      name: 'scene_choices',
      sql: `
        CREATE TABLE IF NOT EXISTS scene_choices (
          id TEXT PRIMARY KEY,
          scene_id TEXT NOT NULL REFERENCES gm_scenes(id),

          -- Choice info
          label TEXT NOT NULL,
          description TEXT,

          -- Proposed deltas if this choice is selected (JSON)
          proposed_deltas TEXT DEFAULT '[]',

          -- Requirements to see/select this choice (JSON)
          requirements TEXT DEFAULT '{}',

          -- Ordering
          sort_order INTEGER DEFAULT 0,

          -- Was this chosen?
          selected INTEGER DEFAULT 0,
          selected_by TEXT REFERENCES characters(id),
          selected_at TEXT,

          -- Speculative projection ID (for preview)
          speculation_id TEXT REFERENCES speculative_projections(id),

          created_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // SOLO CORRIDORS
    // ============================================
    //
    // For SOLO_AI_GM mode.
    // Branch from main timeline, accumulate local deltas,
    // merge back with conflict resolution.
    //
    {
      name: 'solo_corridors',
      sql: `
        CREATE TABLE IF NOT EXISTS solo_corridors (
          id TEXT PRIMARY KEY,
          gm_session_id TEXT NOT NULL REFERENCES gm_sessions(id),

          -- Parent campaign state at branch point
          parent_campaign_state_version INTEGER NOT NULL,

          -- Rejoin point (JSON)
          -- { locationId, worldTimestamp, narrativeContext, triggerCondition }
          rejoin_point TEXT NOT NULL DEFAULT '{}',

          -- Status: active | completed | abandoned | merged
          status TEXT DEFAULT 'active',

          -- Merge resolution (JSON)
          -- { strategy, conflictResolutions[], finalDeltas[] }
          merge_resolution TEXT,
          merged_at TEXT,
          merged_by TEXT REFERENCES users(id),

          -- Corridor metadata
          corridor_type TEXT DEFAULT 'exploration',
          estimated_duration TEXT,

          -- Deltas accumulated in this corridor (JSON array)
          corridor_deltas TEXT DEFAULT '[]',

          -- INVARIANT: No character_snapshot column.
          -- Character state is derived from deltas at parent_campaign_state_version.
          -- Snapshots are truth hazards and must not exist in canonical paths.

          -- WorldTimestamp (JSON), not wall-clock
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // CONTEXT PACKETS
    // ============================================
    //
    // Cached truth slices for GM consumption.
    // What the GM (human or AI) is allowed to know.
    //
    {
      name: 'context_packets',
      sql: `
        CREATE TABLE IF NOT EXISTS context_packets (
          id TEXT PRIMARY KEY,
          gm_session_id TEXT NOT NULL REFERENCES gm_sessions(id),

          -- What's included (JSON - structured truth slice)
          party_state TEXT DEFAULT '{}',
          visible_npcs TEXT DEFAULT '[]',
          known_quests TEXT DEFAULT '[]',
          revealed_secrets TEXT DEFAULT '[]',
          current_location TEXT DEFAULT '{}',
          world_state TEXT DEFAULT '{}',

          -- Exclusions (JSON - what GM must NOT know)
          exclusions TEXT DEFAULT '{}',

          -- Cache metadata
          computed_at TEXT NOT NULL,
          valid_until TEXT,
          base_version INTEGER NOT NULL,

          version INTEGER DEFAULT 1
        )
      `,
    },
  ],

  indexes: [
    // AI Profiles
    'CREATE INDEX IF NOT EXISTS idx_ai_profiles_campaign ON ai_profiles(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_profiles_preset ON ai_profiles(is_system_preset)',

    // GM Sessions
    'CREATE INDEX IF NOT EXISTS idx_gm_sessions_campaign ON gm_sessions(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_gm_sessions_party ON gm_sessions(party_id)',
    'CREATE INDEX IF NOT EXISTS idx_gm_sessions_status ON gm_sessions(status)',
    'CREATE INDEX IF NOT EXISTS idx_gm_sessions_mode ON gm_sessions(mode)',
    'CREATE INDEX IF NOT EXISTS idx_gm_sessions_session ON gm_sessions(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_gm_sessions_active ON gm_sessions(party_id, status)',

    // GM Scenes
    'CREATE INDEX IF NOT EXISTS idx_gm_scenes_session ON gm_scenes(gm_session_id)',
    'CREATE INDEX IF NOT EXISTS idx_gm_scenes_status ON gm_scenes(status)',
    'CREATE INDEX IF NOT EXISTS idx_gm_scenes_type ON gm_scenes(scene_type)',
    'CREATE INDEX IF NOT EXISTS idx_gm_scenes_sequence ON gm_scenes(gm_session_id, sequence_order)',
    'CREATE INDEX IF NOT EXISTS idx_gm_scenes_parent ON gm_scenes(parent_scene_id)',

    // Scene Choices
    'CREATE INDEX IF NOT EXISTS idx_scene_choices_scene ON scene_choices(scene_id)',
    'CREATE INDEX IF NOT EXISTS idx_scene_choices_selected ON scene_choices(selected)',
    'CREATE INDEX IF NOT EXISTS idx_scene_choices_order ON scene_choices(scene_id, sort_order)',

    // Solo Corridors
    'CREATE INDEX IF NOT EXISTS idx_corridors_session ON solo_corridors(gm_session_id)',
    'CREATE INDEX IF NOT EXISTS idx_corridors_status ON solo_corridors(status)',
    'CREATE INDEX IF NOT EXISTS idx_corridors_type ON solo_corridors(corridor_type)',

    // Context Packets
    'CREATE INDEX IF NOT EXISTS idx_context_session ON context_packets(gm_session_id)',
    'CREATE INDEX IF NOT EXISTS idx_context_version ON context_packets(base_version)',
    'CREATE INDEX IF NOT EXISTS idx_context_valid ON context_packets(valid_until)',
  ],
};
