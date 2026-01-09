/**
 * MIGRATION 010: NPCs & AI Agents
 *
 * NPCs, relationships, AI agents, memories
 */

export const MIGRATION_010_NPCS = {
  version: 10,
  name: '010_npcs',
  tables: [
    // ============================================
    // NPCS
    // ============================================
    {
      name: 'npcs',
      sql: `
        CREATE TABLE IF NOT EXISTS npcs (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Character link (NPCs are characters with is_npc=1)
          character_id TEXT REFERENCES characters(id),

          -- Identity
          name TEXT NOT NULL,
          title TEXT,
          race TEXT,
          occupation TEXT,

          -- Location
          location_id TEXT REFERENCES world_nodes(id),
          hub_id TEXT REFERENCES hubs(id),
          building_id TEXT REFERENCES hub_buildings(id),
          faction_id TEXT REFERENCES factions(id),

          -- Stats (JSON - for non-character NPCs)
          stats TEXT,

          -- Personality (JSON)
          personality TEXT DEFAULT '{}',
          appearance TEXT DEFAULT '{}',
          voice TEXT DEFAULT '{}',

          -- Knowledge (JSON)
          knowledge TEXT DEFAULT '{}',
          secrets TEXT DEFAULT '[]',

          -- Status
          is_alive INTEGER DEFAULT 1,
          is_hidden INTEGER DEFAULT 0,
          current_activity TEXT,

          -- Schedule (JSON)
          schedule TEXT DEFAULT '{}',

          -- Commerce if merchant (JSON)
          commerce TEXT,

          -- Services (JSON array)
          services TEXT DEFAULT '[]',

          -- Importance
          importance TEXT DEFAULT 'background',

          -- Agent link
          agent_id TEXT REFERENCES agents(id),

          -- Generation
          generated_from_seed TEXT,
          is_generated INTEGER DEFAULT 1,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // NPC RELATIONSHIPS
    // ============================================
    {
      name: 'npc_relationships',
      sql: `
        CREATE TABLE IF NOT EXISTS npc_relationships (
          id TEXT PRIMARY KEY,
          npc_id TEXT NOT NULL REFERENCES npcs(id),
          target_id TEXT NOT NULL,
          target_type TEXT NOT NULL,

          -- Relationship
          relationship_type TEXT,
          attitude INTEGER DEFAULT 0,
          disposition TEXT DEFAULT 'indifferent',

          -- Strength
          strength INTEGER DEFAULT 0,

          -- History (JSON array)
          memories TEXT DEFAULT '[]',

          -- Notes
          notes TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // AI AGENTS
    // ============================================
    {
      name: 'agents',
      sql: `
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- What this agent controls
          entity_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          agent_type TEXT NOT NULL,

          -- Soul (JSON)
          identity TEXT DEFAULT '{}',
          knowledge TEXT DEFAULT '{}',
          voice TEXT DEFAULT '{}',

          -- Behavioral parameters (JSON)
          behavior TEXT DEFAULT '{}',

          -- State
          is_active INTEGER DEFAULT 1,
          last_used_at TEXT,

          -- Performance tracking
          interactions_count INTEGER DEFAULT 0,
          avg_response_quality REAL,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // AGENT MEMORIES
    // ============================================
    {
      name: 'agent_memories',
      sql: `
        CREATE TABLE IF NOT EXISTS agent_memories (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id),

          type TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,

          -- Importance
          importance REAL DEFAULT 0.5,
          emotional_weight REAL DEFAULT 0,

          -- Associations (JSON arrays)
          associations TEXT DEFAULT '[]',
          triggers TEXT DEFAULT '[]',

          -- Decay
          strength REAL DEFAULT 1.0,
          last_accessed_at TEXT,
          access_count INTEGER DEFAULT 0,

          -- Context
          session_id TEXT REFERENCES sessions(id),
          world_timestamp TEXT,

          created_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // CONVERSATION HISTORY
    // ============================================
    {
      name: 'conversations',
      sql: `
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          session_id TEXT REFERENCES sessions(id),

          -- Participants
          npc_id TEXT NOT NULL REFERENCES npcs(id),
          character_id TEXT REFERENCES characters(id),
          player_id TEXT REFERENCES users(id),

          -- Messages (JSON array)
          messages TEXT DEFAULT '[]',

          -- Topics covered (JSON array)
          topics TEXT DEFAULT '[]',

          -- Outcome
          disposition_change INTEGER DEFAULT 0,
          secrets_revealed TEXT DEFAULT '[]',
          quests_given TEXT DEFAULT '[]',

          -- Timing
          started_at TEXT NOT NULL,
          ended_at TEXT,

          -- World time
          world_timestamp TEXT,

          created_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // NPCs
    'CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_character ON npcs(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_location ON npcs(location_id)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_hub ON npcs(hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_building ON npcs(building_id)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_faction ON npcs(faction_id)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_importance ON npcs(importance)',

    // NPC relationships
    'CREATE INDEX IF NOT EXISTS idx_npc_relations_npc ON npc_relationships(npc_id)',
    'CREATE INDEX IF NOT EXISTS idx_npc_relations_target ON npc_relationships(target_id, target_type)',

    // Agents
    'CREATE INDEX IF NOT EXISTS idx_agents_campaign ON agents(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_agents_entity ON agents(entity_id, entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type)',

    // Agent memories
    'CREATE INDEX IF NOT EXISTS idx_memories_agent ON agent_memories(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_memories_type ON agent_memories(type)',
    'CREATE INDEX IF NOT EXISTS idx_memories_importance ON agent_memories(importance)',

    // Conversations
    'CREATE INDEX IF NOT EXISTS idx_conversations_campaign ON conversations(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_npc ON conversations(npc_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_character ON conversations(character_id)',
  ],
};
