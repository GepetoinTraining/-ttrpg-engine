import { batch, query, getClient } from "./client";

// ============================================
// DATABASE MIGRATIONS
// ============================================
//
// Schema definitions for Turso/SQLite.
//
// Run migrations on startup to ensure tables exist.
// Uses IF NOT EXISTS for idempotency.
//

// ============================================
// MIGRATION RUNNER
// ============================================

export interface MigrationResult {
  success: boolean;
  tablesCreated: string[];
  errors: string[];
}

/**
 * Run all migrations
 */
export async function runMigrations(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    tablesCreated: [],
    errors: [],
  };

  const migrations = [
    // Core tables
    { name: "users", sql: USERS_TABLE },
    { name: "world_nodes", sql: WORLD_NODES_TABLE },
    { name: "world_edges", sql: WORLD_EDGES_TABLE },
    { name: "factions", sql: FACTIONS_TABLE },
    { name: "faction_relations", sql: FACTION_RELATIONS_TABLE },
    { name: "deities", sql: DEITIES_TABLE },

    // Campaign/Party
    { name: "campaigns", sql: CAMPAIGNS_TABLE },
    { name: "campaign_memberships", sql: CAMPAIGN_MEMBERSHIPS_TABLE },
    { name: "campaign_invites", sql: CAMPAIGN_INVITES_TABLE },
    { name: "parties", sql: PARTIES_TABLE },
    { name: "party_memberships", sql: PARTY_MEMBERSHIPS_TABLE },

    // Characters
    { name: "characters", sql: CHARACTERS_TABLE },
    { name: "character_features", sql: CHARACTER_FEATURES_TABLE },
    { name: "inventory_items", sql: INVENTORY_ITEMS_TABLE },
    { name: "conditions", sql: CONDITIONS_TABLE },

    // NPCs
    { name: "npcs", sql: NPCS_TABLE },
    { name: "npc_relationships", sql: NPC_RELATIONSHIPS_TABLE },
    { name: "agents", sql: AGENTS_TABLE },
    { name: "agent_memories", sql: AGENT_MEMORIES_TABLE },

    // Sessions
    { name: "sessions", sql: SESSIONS_TABLE },
    { name: "session_events", sql: SESSION_EVENTS_TABLE },

    // Combat
    { name: "combats", sql: COMBATS_TABLE },
    { name: "combat_participants", sql: COMBAT_PARTICIPANTS_TABLE },
    { name: "combat_log", sql: COMBAT_LOG_TABLE },

    // Quests
    { name: "quests", sql: QUESTS_TABLE },
    { name: "quest_objectives", sql: QUEST_OBJECTIVES_TABLE },

    // Downtime
    { name: "downtime_periods", sql: DOWNTIME_PERIODS_TABLE },
    { name: "downtime_actions", sql: DOWNTIME_ACTIONS_TABLE },
    { name: "followers", sql: FOLLOWERS_TABLE },

    // Economy
    { name: "economic_events", sql: ECONOMIC_EVENTS_TABLE },
    { name: "trade_routes", sql: TRADE_ROUTES_TABLE },

    // Sync
    { name: "sync_log", sql: SYNC_LOG_TABLE },

    // Audit
    { name: "audit_log", sql: AUDIT_LOG_TABLE },
  ];

  for (const migration of migrations) {
    try {
      await query(migration.sql);
      result.tablesCreated.push(migration.name);
    } catch (error) {
      result.success = false;
      result.errors.push(`${migration.name}: ${error}`);
    }
  }

  // Create indexes
  try {
    await createIndexes();
  } catch (error) {
    result.errors.push(`indexes: ${error}`);
  }

  return result;
}

// ============================================
// USERS (extends Clerk)
// ============================================

const USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT,
    display_name TEXT,
    image_url TEXT,

    -- Our metadata
    pronouns TEXT,
    timezone TEXT,
    preferences TEXT DEFAULT '{}',
    stats TEXT DEFAULT '{}',

    -- Status
    system_role TEXT DEFAULT 'user',
    is_premium INTEGER DEFAULT 0,

    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_active_at TEXT
  )
`;

// ============================================
// WORLD GRAPH
// ============================================

const WORLD_NODES_TABLE = `
  CREATE TABLE IF NOT EXISTS world_nodes (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES world_nodes(id),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    canonical_name TEXT,

    -- Hierarchy shortcuts
    sphere_id TEXT REFERENCES world_nodes(id),
    planet_id TEXT REFERENCES world_nodes(id),
    continent_id TEXT REFERENCES world_nodes(id),
    region_id TEXT REFERENCES world_nodes(id),

    -- Flags
    is_seeded INTEGER DEFAULT 0,
    is_canonical INTEGER DEFAULT 1,
    is_hidden INTEGER DEFAULT 0,

    -- Flexible data
    data_static TEXT NOT NULL DEFAULT '{}',

    -- Metadata
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const WORLD_EDGES_TABLE = `
  CREATE TABLE IF NOT EXISTS world_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES world_nodes(id),
    target_id TEXT NOT NULL REFERENCES world_nodes(id),
    type TEXT NOT NULL,
    bidirectional INTEGER DEFAULT 1,

    -- Flexible data
    properties TEXT NOT NULL DEFAULT '{}',

    -- Metadata
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const FACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS factions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    scope TEXT,
    home_sphere_id TEXT REFERENCES world_nodes(id),
    home_planet_id TEXT REFERENCES world_nodes(id),

    data TEXT NOT NULL DEFAULT '{}',

    is_seeded INTEGER DEFAULT 0,
    is_canonical INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const FACTION_RELATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS faction_relations (
    id TEXT PRIMARY KEY,
    faction1_id TEXT NOT NULL REFERENCES factions(id),
    faction2_id TEXT NOT NULL REFERENCES factions(id),
    relation TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    version INTEGER DEFAULT 1
  )
`;

const DEITIES_TABLE = `
  CREATE TABLE IF NOT EXISTS deities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pantheon TEXT,
    rank TEXT,
    alignment TEXT,
    sphere_id TEXT REFERENCES world_nodes(id),
    planet_id TEXT REFERENCES world_nodes(id),

    data TEXT NOT NULL DEFAULT '{}',

    is_seeded INTEGER DEFAULT 0,
    is_canonical INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

// ============================================
// CAMPAIGNS
// ============================================

const CAMPAIGNS_TABLE = `
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,

    -- World connection
    primary_world_id TEXT REFERENCES world_nodes(id),
    starting_region_id TEXT REFERENCES world_nodes(id),

    -- Spelljammer
    is_spelljammer INTEGER DEFAULT 0,
    accessible_worlds TEXT DEFAULT '[]',
    accessible_spheres TEXT DEFAULT '[]',

    -- Settings
    settings TEXT DEFAULT '{}',

    -- State
    status TEXT DEFAULT 'planning',
    current_date TEXT,
    current_arc_id TEXT,
    sessions_played INTEGER DEFAULT 0,

    -- Owner
    owner_id TEXT NOT NULL REFERENCES users(id),

    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_session_at TEXT,
    version INTEGER DEFAULT 1
  )
`;

const CAMPAIGN_MEMBERSHIPS_TABLE = `
  CREATE TABLE IF NOT EXISTS campaign_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    role TEXT NOT NULL DEFAULT 'player',
    permissions TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',

    joined_at TEXT NOT NULL,
    last_active_at TEXT,
    invited_by TEXT REFERENCES users(id),
    invited_at TEXT,
    accepted_at TEXT,

    UNIQUE(user_id, campaign_id)
  )
`;

const CAMPAIGN_INVITES_TABLE = `
  CREATE TABLE IF NOT EXISTS campaign_invites (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    code TEXT NOT NULL UNIQUE,
    default_role TEXT DEFAULT 'player',

    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,

    used_by TEXT DEFAULT '[]'
  )
`;

// ============================================
// PARTIES
// ============================================

const PARTIES_TABLE = `
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    name TEXT NOT NULL,
    motto TEXT,
    symbol TEXT,

    -- Resources
    gold INTEGER DEFAULT 0,
    shared_inventory_id TEXT,

    -- Spelljammer
    ship_ids TEXT DEFAULT '[]',
    primary_ship_id TEXT,

    -- Status
    current_location_id TEXT REFERENCES world_nodes(id),
    current_location_name TEXT,
    in_space INTEGER DEFAULT 0,
    activity TEXT DEFAULT 'resting',
    average_level INTEGER DEFAULT 1,

    -- Reputation
    reputation TEXT DEFAULT '{}',

    -- History
    history TEXT DEFAULT '{}',
    stats TEXT DEFAULT '{}',

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const PARTY_MEMBERSHIPS_TABLE = `
  CREATE TABLE IF NOT EXISTS party_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    character_id TEXT NOT NULL REFERENCES characters(id),

    role TEXT DEFAULT 'member',
    active INTEGER DEFAULT 1,

    joined_at TEXT NOT NULL,
    left_at TEXT,

    UNIQUE(character_id, party_id)
  )
`;

// ============================================
// CHARACTERS
// ============================================

const CHARACTERS_TABLE = `
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    owner_id TEXT REFERENCES users(id),

    -- Identity
    name TEXT NOT NULL,
    race TEXT NOT NULL,
    class TEXT NOT NULL,
    subclass TEXT,
    background TEXT,
    level INTEGER DEFAULT 1,

    -- Type
    character_type TEXT DEFAULT 'player_character',

    -- Stats
    hp_current INTEGER NOT NULL,
    hp_max INTEGER NOT NULL,
    hp_temp INTEGER DEFAULT 0,
    ac INTEGER NOT NULL,
    speed INTEGER DEFAULT 30,
    proficiency_bonus INTEGER DEFAULT 2,

    -- Abilities
    str INTEGER NOT NULL,
    dex INTEGER NOT NULL,
    con INTEGER NOT NULL,
    int INTEGER NOT NULL,
    wis INTEGER NOT NULL,
    cha INTEGER NOT NULL,

    -- Saves & skills
    saving_throws TEXT DEFAULT '{}',
    skills TEXT DEFAULT '{}',

    -- Combat
    hit_dice TEXT DEFAULT '{}',
    death_saves TEXT DEFAULT '{}',

    -- Spellcasting
    spellcasting_ability TEXT,
    spell_slots TEXT DEFAULT '{}',
    spells_known TEXT DEFAULT '[]',
    spells_prepared TEXT DEFAULT '[]',

    -- Details
    appearance TEXT DEFAULT '{}',
    personality TEXT DEFAULT '{}',
    backstory TEXT,

    -- Experience
    xp INTEGER DEFAULT 0,
    inspiration INTEGER DEFAULT 0,

    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_played_at TEXT,
    version INTEGER DEFAULT 1
  )
`;

const CHARACTER_FEATURES_TABLE = `
  CREATE TABLE IF NOT EXISTS character_features (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id),

    name TEXT NOT NULL,
    source TEXT,
    description TEXT,

    -- Uses
    uses_max INTEGER,
    uses_current INTEGER,
    recharge TEXT,

    -- Flags
    is_active INTEGER DEFAULT 1,
    requires_concentration INTEGER DEFAULT 0,

    data TEXT DEFAULT '{}',

    created_at TEXT NOT NULL
  )
`;

const INVENTORY_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    owner_type TEXT NOT NULL,

    -- Item reference or custom
    item_template_id TEXT,
    name TEXT NOT NULL,
    description TEXT,

    -- Quantity
    quantity INTEGER DEFAULT 1,

    -- Status
    equipped INTEGER DEFAULT 0,
    attuned INTEGER DEFAULT 0,

    -- Container
    container_id TEXT REFERENCES inventory_items(id),

    -- Properties
    properties TEXT DEFAULT '{}',

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const CONDITIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS conditions (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id),

    name TEXT NOT NULL,
    source TEXT,
    duration TEXT,
    ends_on TEXT,

    -- Save to end
    save_dc INTEGER,
    save_ability TEXT,

    -- Effects
    effects TEXT DEFAULT '{}',

    created_at TEXT NOT NULL
  )
`;

// ============================================
// NPCS
// ============================================

const NPCS_TABLE = `
  CREATE TABLE IF NOT EXISTS npcs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    -- Identity
    name TEXT NOT NULL,
    title TEXT,
    race TEXT,
    occupation TEXT,

    -- Location
    location_id TEXT REFERENCES world_nodes(id),
    faction_id TEXT REFERENCES factions(id),

    -- Stats (nullable for non-combat NPCs)
    stats TEXT,

    -- Personality
    personality TEXT DEFAULT '{}',
    appearance TEXT DEFAULT '{}',
    voice TEXT DEFAULT '{}',

    -- Knowledge
    knowledge TEXT DEFAULT '{}',
    secrets TEXT DEFAULT '[]',

    -- Status
    is_alive INTEGER DEFAULT 1,
    is_hidden INTEGER DEFAULT 0,
    current_activity TEXT,

    -- Agent link
    agent_id TEXT REFERENCES agents(id),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const NPC_RELATIONSHIPS_TABLE = `
  CREATE TABLE IF NOT EXISTS npc_relationships (
    id TEXT PRIMARY KEY,
    npc_id TEXT NOT NULL REFERENCES npcs(id),
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,

    attitude INTEGER DEFAULT 0,
    disposition TEXT,

    memories TEXT DEFAULT '[]',

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

// ============================================
// AI AGENTS
// ============================================

const AGENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    -- What this agent controls
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    agent_type TEXT NOT NULL,

    -- Soul
    identity TEXT DEFAULT '{}',
    knowledge TEXT DEFAULT '{}',
    voice TEXT DEFAULT '{}',

    -- State
    is_active INTEGER DEFAULT 1,
    last_used_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const AGENT_MEMORIES_TABLE = `
  CREATE TABLE IF NOT EXISTS agent_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id),

    type TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,

    -- Importance
    importance REAL DEFAULT 0.5,
    emotional_weight REAL DEFAULT 0,

    -- Associations
    associations TEXT DEFAULT '[]',
    triggers TEXT DEFAULT '[]',

    -- Decay
    strength REAL DEFAULT 1.0,
    last_accessed_at TEXT,

    created_at TEXT NOT NULL
  )
`;

// ============================================
// SESSIONS
// ============================================

const SESSIONS_TABLE = `
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

    -- Current scene
    current_scene TEXT DEFAULT '{}',

    -- GM notes
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
`;

const SESSION_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),

    type TEXT NOT NULL,
    category TEXT,

    timestamp TEXT NOT NULL,
    world_date TEXT,

    -- Who/what triggered
    triggered_by_type TEXT,
    triggered_by_id TEXT,
    triggered_by_name TEXT,

    -- Event data
    data TEXT NOT NULL DEFAULT '{}',

    -- Flags
    is_important INTEGER DEFAULT 0,
    is_visible_to_players INTEGER DEFAULT 1
  )
`;

// ============================================
// COMBAT
// ============================================

const COMBATS_TABLE = `
  CREATE TABLE IF NOT EXISTS combats (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),

    -- Status
    status TEXT DEFAULT 'preparing',
    round INTEGER DEFAULT 0,
    current_turn_index INTEGER DEFAULT 0,

    -- Grid
    grid_type TEXT,
    grid_data TEXT DEFAULT '{}',
    map_id TEXT,

    -- Environment
    environment TEXT DEFAULT '{}',

    -- Lair
    lair_id TEXT,
    lair_initiative INTEGER,

    started_at TEXT,
    ended_at TEXT,
    outcome TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

const COMBAT_PARTICIPANTS_TABLE = `
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

    -- Conditions
    conditions TEXT DEFAULT '[]',

    -- Status
    is_active INTEGER DEFAULT 1,
    is_hidden INTEGER DEFAULT 0,
    is_surprised INTEGER DEFAULT 0,

    -- AI hints
    ai_hints TEXT DEFAULT '{}',

    sort_order INTEGER DEFAULT 0
  )
`;

const COMBAT_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS combat_log (
    id TEXT PRIMARY KEY,
    combat_id TEXT NOT NULL REFERENCES combats(id),

    round INTEGER NOT NULL,
    turn INTEGER,

    actor_id TEXT,
    actor_name TEXT,
    action TEXT NOT NULL,

    target_id TEXT,
    target_name TEXT,

    result TEXT DEFAULT '{}',

    timestamp TEXT NOT NULL
  )
`;

// ============================================
// QUESTS
// ============================================

const QUESTS_TABLE = `
  CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    party_id TEXT REFERENCES parties(id),

    name TEXT NOT NULL,
    description TEXT,

    -- Source
    giver_npc_id TEXT REFERENCES npcs(id),
    source_type TEXT,

    -- Status
    status TEXT DEFAULT 'available',
    progress REAL DEFAULT 0,

    -- Rewards
    rewards TEXT DEFAULT '{}',

    -- Secrets
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
`;

const QUEST_OBJECTIVES_TABLE = `
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
`;

// ============================================
// DOWNTIME
// ============================================

const DOWNTIME_PERIODS_TABLE = `
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
`;

const DOWNTIME_ACTIONS_TABLE = `
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

    -- Result
    result TEXT DEFAULT '{}',

    created_at TEXT NOT NULL,
    resolved_at TEXT
  )
`;

const FOLLOWERS_TABLE = `
  CREATE TABLE IF NOT EXISTS followers (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    owner_id TEXT NOT NULL REFERENCES characters(id),

    name TEXT NOT NULL,
    type TEXT NOT NULL,
    count INTEGER DEFAULT 1,

    -- Stats
    stats TEXT DEFAULT '{}',

    -- Status
    loyalty INTEGER DEFAULT 50,
    status TEXT DEFAULT 'available',

    -- Mission
    mission TEXT,
    mission_started_at TEXT,
    mission_ends_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )
`;

// ============================================
// ECONOMY
// ============================================

const ECONOMIC_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS economic_events (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    scope TEXT,
    affected_settlements TEXT DEFAULT '[]',

    effects TEXT DEFAULT '{}',

    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const TRADE_ROUTES_TABLE = `
  CREATE TABLE IF NOT EXISTS trade_routes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),

    from_node_id TEXT NOT NULL REFERENCES world_nodes(id),
    to_node_id TEXT NOT NULL REFERENCES world_nodes(id),

    -- Properties
    goods TEXT DEFAULT '[]',
    volume TEXT,
    travel_time TEXT,
    danger_level TEXT,

    -- Status
    status TEXT DEFAULT 'active',
    controlled_by TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

// ============================================
// SYNC
// ============================================

const SYNC_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,

    -- Delta info
    delta_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL,

    -- Sequence
    sequence INTEGER NOT NULL,

    -- Who
    client_id TEXT NOT NULL,
    user_id TEXT,

    -- When
    timestamp TEXT NOT NULL,

    -- Status
    synced INTEGER DEFAULT 0,
    synced_at TEXT,
    error TEXT
  )
`;

// ============================================
// AUDIT
// ============================================

const AUDIT_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,
    user_email TEXT,

    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,

    campaign_id TEXT,

    details TEXT DEFAULT '{}',

    ip_address TEXT,
    user_agent TEXT,

    timestamp TEXT NOT NULL
  )
`;

// ============================================
// INDEXES
// ============================================

async function createIndexes(): Promise<void> {
  const indexes = [
    // World graph
    "CREATE INDEX IF NOT EXISTS idx_nodes_parent ON world_nodes(parent_id)",
    "CREATE INDEX IF NOT EXISTS idx_nodes_type ON world_nodes(type)",
    "CREATE INDEX IF NOT EXISTS idx_nodes_name ON world_nodes(name)",
    "CREATE INDEX IF NOT EXISTS idx_nodes_sphere ON world_nodes(sphere_id)",
    "CREATE INDEX IF NOT EXISTS idx_nodes_planet ON world_nodes(planet_id)",
    "CREATE INDEX IF NOT EXISTS idx_nodes_region ON world_nodes(region_id)",
    "CREATE INDEX IF NOT EXISTS idx_nodes_canonical ON world_nodes(canonical_name)",

    "CREATE INDEX IF NOT EXISTS idx_edges_source ON world_edges(source_id)",
    "CREATE INDEX IF NOT EXISTS idx_edges_target ON world_edges(target_id)",
    "CREATE INDEX IF NOT EXISTS idx_edges_type ON world_edges(type)",
    "CREATE INDEX IF NOT EXISTS idx_edges_source_type ON world_edges(source_id, type)",
    "CREATE INDEX IF NOT EXISTS idx_edges_target_type ON world_edges(target_id, type)",

    "CREATE INDEX IF NOT EXISTS idx_factions_name ON factions(name)",
    "CREATE INDEX IF NOT EXISTS idx_factions_scope ON factions(scope)",

    "CREATE INDEX IF NOT EXISTS idx_deities_name ON deities(name)",
    "CREATE INDEX IF NOT EXISTS idx_deities_pantheon ON deities(pantheon)",

    // Campaigns
    "CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)",

    "CREATE INDEX IF NOT EXISTS idx_memberships_user ON campaign_memberships(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_memberships_campaign ON campaign_memberships(campaign_id)",

    "CREATE INDEX IF NOT EXISTS idx_invites_code ON campaign_invites(code)",
    "CREATE INDEX IF NOT EXISTS idx_invites_campaign ON campaign_invites(campaign_id)",

    // Parties
    "CREATE INDEX IF NOT EXISTS idx_parties_campaign ON parties(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_party_members_party ON party_memberships(party_id)",
    "CREATE INDEX IF NOT EXISTS idx_party_members_character ON party_memberships(character_id)",

    // Characters
    "CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_features_character ON character_features(character_id)",
    "CREATE INDEX IF NOT EXISTS idx_inventory_owner ON inventory_items(owner_id, owner_type)",
    "CREATE INDEX IF NOT EXISTS idx_conditions_character ON conditions(character_id)",

    // NPCs
    "CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_npcs_location ON npcs(location_id)",
    "CREATE INDEX IF NOT EXISTS idx_npcs_faction ON npcs(faction_id)",
    "CREATE INDEX IF NOT EXISTS idx_npc_relations_npc ON npc_relationships(npc_id)",

    // Agents
    "CREATE INDEX IF NOT EXISTS idx_agents_campaign ON agents(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_agents_entity ON agents(entity_id, entity_type)",
    "CREATE INDEX IF NOT EXISTS idx_memories_agent ON agent_memories(agent_id)",

    // Sessions
    "CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON sessions(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)",
    "CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id)",

    // Combat
    "CREATE INDEX IF NOT EXISTS idx_combats_session ON combats(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_participants_combat ON combat_participants(combat_id)",
    "CREATE INDEX IF NOT EXISTS idx_combat_log_combat ON combat_log(combat_id)",

    // Quests
    "CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_quests_party ON quests(party_id)",
    "CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status)",
    "CREATE INDEX IF NOT EXISTS idx_objectives_quest ON quest_objectives(quest_id)",

    // Downtime
    "CREATE INDEX IF NOT EXISTS idx_downtime_campaign ON downtime_periods(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_downtime_actions_period ON downtime_actions(period_id)",
    "CREATE INDEX IF NOT EXISTS idx_downtime_actions_character ON downtime_actions(character_id)",
    "CREATE INDEX IF NOT EXISTS idx_followers_owner ON followers(owner_id)",

    // Economy
    "CREATE INDEX IF NOT EXISTS idx_econ_events_campaign ON economic_events(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_trade_routes_campaign ON trade_routes(campaign_id)",

    // Sync
    "CREATE INDEX IF NOT EXISTS idx_sync_sequence ON sync_log(sequence)",
    "CREATE INDEX IF NOT EXISTS idx_sync_client ON sync_log(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_sync_table_record ON sync_log(table_name, record_id)",

    // Audit
    "CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_campaign ON audit_log(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)",
  ];

  for (const idx of indexes) {
    await query(idx);
  }
}

// ============================================
// DROP ALL (for testing)
// ============================================

export async function dropAllTables(): Promise<void> {
  const tables = [
    "audit_log",
    "sync_log",
    "trade_routes",
    "economic_events",
    "followers",
    "downtime_actions",
    "downtime_periods",
    "quest_objectives",
    "quests",
    "combat_log",
    "combat_participants",
    "combats",
    "session_events",
    "sessions",
    "agent_memories",
    "agents",
    "npc_relationships",
    "npcs",
    "conditions",
    "inventory_items",
    "character_features",
    "characters",
    "party_memberships",
    "parties",
    "campaign_invites",
    "campaign_memberships",
    "campaigns",
    "deities",
    "faction_relations",
    "factions",
    "world_edges",
    "world_nodes",
    "users",
  ];

  for (const table of tables) {
    await query(`DROP TABLE IF EXISTS ${table}`);
  }
}
