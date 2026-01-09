-- TTRPG Engine Database Schema
-- SQLite/libSQL compatible
-- Run this to initialize a local development database

-- ============================================
-- USERS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    system_role TEXT DEFAULT 'user' CHECK (system_role IN ('user', 'admin', 'moderator')),
    settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT,
    onboarding_complete INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    primary_world_id TEXT,
    starting_region_id TEXT,
    is_spelljammer INTEGER DEFAULT 0,
    accessible_worlds TEXT DEFAULT '[]',
    accessible_spheres TEXT DEFAULT '[]',
    settings TEXT DEFAULT '{}',
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'hiatus', 'completed', 'abandoned')),
    current_date TEXT,
    current_arc_id TEXT,
    sessions_played INTEGER DEFAULT 0,
    owner_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_session_at TEXT,
    version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================
-- CAMPAIGN MEMBERSHIPS
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'gm', 'co_gm', 'player', 'spectator')),
    permissions TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    joined_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT,
    invited_by TEXT,
    invited_at TEXT,
    accepted_at TEXT,
    UNIQUE(user_id, campaign_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON campaign_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_campaign ON campaign_memberships(campaign_id);

-- ============================================
-- CAMPAIGN INVITES
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_invites (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    default_role TEXT DEFAULT 'player',
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    used_by TEXT DEFAULT '[]',
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON campaign_invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_campaign ON campaign_invites(campaign_id);

-- ============================================
-- CHARACTERS
-- ============================================

CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    owner_id TEXT,
    party_id TEXT,
    name TEXT NOT NULL,
    race TEXT,
    class TEXT,
    subclass TEXT,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    background TEXT,
    alignment TEXT,
    ability_scores TEXT DEFAULT '{}',
    max_hp INTEGER DEFAULT 10,
    current_hp INTEGER DEFAULT 10,
    temp_hp INTEGER DEFAULT 0,
    armor_class INTEGER DEFAULT 10,
    speed INTEGER DEFAULT 30,
    proficiency_bonus INTEGER DEFAULT 2,
    skills TEXT DEFAULT '{}',
    saving_throws TEXT DEFAULT '{}',
    features TEXT DEFAULT '[]',
    spells TEXT DEFAULT '{}',
    equipment TEXT DEFAULT '[]',
    currency TEXT DEFAULT '{"cp":0,"sp":0,"ep":0,"gp":0,"pp":0}',
    backstory TEXT,
    personality_traits TEXT,
    ideals TEXT,
    bonds TEXT,
    flaws TEXT,
    notes TEXT,
    portrait_url TEXT,
    token_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'dead', 'retired')),
    conditions TEXT DEFAULT '[]',
    death_saves TEXT DEFAULT '{"successes":0,"failures":0}',
    inspiration INTEGER DEFAULT 0,
    data_static TEXT DEFAULT '{}',
    data_dynamic TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version INTEGER DEFAULT 1,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_party ON characters(party_id);

-- ============================================
-- WORLD NODES
-- ============================================

CREATE TABLE IF NOT EXISTS world_nodes (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('sphere', 'planet', 'continent', 'region', 'settlement', 'district', 'poi', 'dungeon', 'room')),
    name TEXT NOT NULL,
    canonical_name TEXT,
    sphere_id TEXT,
    planet_id TEXT,
    continent_id TEXT,
    region_id TEXT,
    is_seeded INTEGER DEFAULT 0,
    data_static TEXT DEFAULT '{}',
    data_dynamic TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON world_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON world_nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_canonical ON world_nodes(canonical_name);

-- ============================================
-- WORLD EDGES
-- ============================================

CREATE TABLE IF NOT EXISTS world_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('road', 'river', 'trade_route', 'portal', 'border', 'passage', 'teleport')),
    bidirectional INTEGER DEFAULT 1,
    distance_km REAL,
    travel_days REAL,
    danger_level INTEGER DEFAULT 1,
    data_static TEXT DEFAULT '{}',
    data_dynamic TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_id, target_id, type),
    FOREIGN KEY (source_id) REFERENCES world_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES world_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON world_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON world_edges(target_id);

-- ============================================
-- FACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS factions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('guild', 'government', 'religion', 'criminal', 'military', 'merchant', 'academic', 'secret', 'other')),
    alignment TEXT,
    power_level INTEGER DEFAULT 5,
    influence TEXT DEFAULT '{}',
    goals TEXT DEFAULT '[]',
    resources TEXT DEFAULT '{}',
    leadership TEXT DEFAULT '{}',
    headquarters_id TEXT,
    data_static TEXT DEFAULT '{}',
    data_dynamic TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (headquarters_id) REFERENCES world_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_factions_campaign ON factions(campaign_id);

-- ============================================
-- NPCS
-- ============================================

CREATE TABLE IF NOT EXISTS npcs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    name TEXT NOT NULL,
    race TEXT,
    occupation TEXT,
    faction_id TEXT,
    location_id TEXT,
    disposition INTEGER DEFAULT 50,
    importance TEXT DEFAULT 'minor' CHECK (importance IN ('minor', 'notable', 'major', 'legendary')),
    stats TEXT DEFAULT '{}',
    personality TEXT DEFAULT '{}',
    secrets TEXT DEFAULT '[]',
    relationships TEXT DEFAULT '[]',
    schedule TEXT DEFAULT '{}',
    inventory TEXT DEFAULT '[]',
    dialogue_style TEXT,
    voice_notes TEXT,
    portrait_url TEXT,
    is_alive INTEGER DEFAULT 1,
    data_static TEXT DEFAULT '{}',
    data_dynamic TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES world_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_npcs_location ON npcs(location_id);
CREATE INDEX IF NOT EXISTS idx_npcs_faction ON npcs(faction_id);

-- ============================================
-- PARTIES
-- ============================================

CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location_id TEXT,
    treasury TEXT DEFAULT '{"cp":0,"sp":0,"ep":0,"gp":0,"pp":0}',
    shared_inventory TEXT DEFAULT '[]',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES world_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_parties_campaign ON parties(campaign_id);

-- ============================================
-- SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    session_number INTEGER NOT NULL,
    title TEXT,
    summary TEXT,
    planned_date TEXT,
    actual_date TEXT,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    location_id TEXT,
    attendees TEXT DEFAULT '[]',
    notes TEXT,
    loot TEXT DEFAULT '[]',
    experience_awarded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES world_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ============================================
-- QUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    giver_id TEXT,
    type TEXT CHECK (type IN ('main', 'side', 'personal', 'faction', 'rumor')),
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed', 'abandoned')),
    priority INTEGER DEFAULT 5,
    objectives TEXT DEFAULT '[]',
    rewards TEXT DEFAULT '{}',
    deadline TEXT,
    location_id TEXT,
    notes TEXT,
    secret_notes TEXT,
    data_static TEXT DEFAULT '{}',
    data_dynamic TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (giver_id) REFERENCES npcs(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES world_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);

-- ============================================
-- COMBAT ENCOUNTERS
-- ============================================

CREATE TABLE IF NOT EXISTS combats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    session_id TEXT,
    name TEXT,
    status TEXT DEFAULT 'preparing' CHECK (status IN ('preparing', 'active', 'paused', 'completed')),
    round INTEGER DEFAULT 0,
    turn_index INTEGER DEFAULT 0,
    participants TEXT DEFAULT '[]',
    initiative_order TEXT DEFAULT '[]',
    environment TEXT DEFAULT '{}',
    loot TEXT DEFAULT '[]',
    notes TEXT,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_combats_campaign ON combats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_combats_session ON combats(session_id);
CREATE INDEX IF NOT EXISTS idx_combats_status ON combats(status);

-- ============================================
-- ECONOMY - SETTLEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS settlement_economies (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL UNIQUE,
    population INTEGER DEFAULT 100,
    wealth_level INTEGER DEFAULT 5,
    trade_volume REAL DEFAULT 1.0,
    price_modifiers TEXT DEFAULT '{}',
    available_goods TEXT DEFAULT '[]',
    available_services TEXT DEFAULT '[]',
    production TEXT DEFAULT '{}',
    consumption TEXT DEFAULT '{}',
    trade_routes TEXT DEFAULT '[]',
    last_update TEXT,
    data_dynamic TEXT DEFAULT '{}',
    FOREIGN KEY (node_id) REFERENCES world_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_economies_node ON settlement_economies(node_id);

-- ============================================
-- ITEMS (Templates)
-- ============================================

CREATE TABLE IF NOT EXISTS item_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    subtype TEXT,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact')),
    base_value_gp REAL DEFAULT 0,
    weight REAL DEFAULT 0,
    description TEXT,
    properties TEXT DEFAULT '{}',
    requires_attunement INTEGER DEFAULT 0,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_type ON item_templates(type);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON item_templates(rarity);

-- ============================================
-- INVENTORY ITEMS (Character equipment instances)
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    template_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    subtype TEXT,
    quantity INTEGER DEFAULT 1,
    weight REAL DEFAULT 0,
    value_gp REAL DEFAULT 0,
    equipped INTEGER DEFAULT 0,
    attuned INTEGER DEFAULT 0,
    slot TEXT,
    description TEXT,
    properties TEXT DEFAULT '{}',
    custom_properties TEXT DEFAULT '{}',
    condition TEXT DEFAULT 'normal',
    charges INTEGER,
    max_charges INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES item_templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory_items(character_id);
CREATE INDEX IF NOT EXISTS idx_inventory_equipped ON inventory_items(equipped);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_items(type);

-- ============================================
-- SESSION EVENTS (Event log for sessions)
-- ============================================

CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    subtype TEXT,
    actor_id TEXT,
    actor_name TEXT,
    actor_type TEXT CHECK (actor_type IN ('player', 'gm', 'npc', 'system')),
    target_id TEXT,
    target_name TEXT,
    data TEXT DEFAULT '{}',
    scene_id TEXT,
    location_id TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    correlation_id TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES world_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON session_events(type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON session_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_actor ON session_events(actor_id);

-- ============================================
-- COMBAT PARTICIPANTS (Entities in combat)
-- ============================================

CREATE TABLE IF NOT EXISTS combat_participants (
    id TEXT PRIMARY KEY,
    combat_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('character', 'npc', 'monster', 'object')),
    entity_id TEXT,
    name TEXT NOT NULL,
    image_url TEXT,
    initiative INTEGER DEFAULT 0,
    initiative_modifier INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 10,
    max_hp INTEGER DEFAULT 10,
    temp_hp INTEGER DEFAULT 0,
    ac INTEGER DEFAULT 10,
    position_x REAL,
    position_y REAL,
    position_z REAL,
    conditions TEXT DEFAULT '[]',
    is_visible INTEGER DEFAULT 1,
    is_alive INTEGER DEFAULT 1,
    is_concentrating INTEGER DEFAULT 0,
    turn_taken INTEGER DEFAULT 0,
    reactions_used INTEGER DEFAULT 0,
    group_id TEXT,
    sort_order INTEGER DEFAULT 0,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (combat_id) REFERENCES combats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_participants_combat ON combat_participants(combat_id);
CREATE INDEX IF NOT EXISTS idx_participants_entity ON combat_participants(entity_id);
CREATE INDEX IF NOT EXISTS idx_participants_initiative ON combat_participants(initiative DESC);

-- ============================================
-- COMBAT LOG (Action history for combat)
-- ============================================

CREATE TABLE IF NOT EXISTS combat_log (
    id TEXT PRIMARY KEY,
    combat_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    turn_index INTEGER,
    actor_id TEXT,
    actor_name TEXT,
    action_type TEXT NOT NULL,
    action_name TEXT,
    action_data TEXT DEFAULT '{}',
    target_ids TEXT DEFAULT '[]',
    results TEXT DEFAULT '{}',
    dice_rolls TEXT DEFAULT '[]',
    damage_dealt INTEGER,
    healing_done INTEGER,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (combat_id) REFERENCES combats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_combat_log_combat ON combat_log(combat_id);
CREATE INDEX IF NOT EXISTS idx_combat_log_round ON combat_log(round);
CREATE INDEX IF NOT EXISTS idx_combat_log_actor ON combat_log(actor_id);

-- ============================================
-- FACTION RELATIONS (Diplomacy between factions)
-- ============================================

CREATE TABLE IF NOT EXISTS faction_relations (
    id TEXT PRIMARY KEY,
    faction1_id TEXT NOT NULL,
    faction2_id TEXT NOT NULL,
    relation TEXT NOT NULL CHECK (relation IN ('allied', 'friendly', 'neutral', 'unfriendly', 'hostile', 'war')),
    relation_score INTEGER DEFAULT 0,
    public_stance TEXT,
    secret_stance TEXT,
    treaties TEXT DEFAULT '[]',
    history TEXT DEFAULT '[]',
    last_interaction TEXT,
    properties TEXT DEFAULT '{}',
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(faction1_id, faction2_id),
    FOREIGN KEY (faction1_id) REFERENCES factions(id) ON DELETE CASCADE,
    FOREIGN KEY (faction2_id) REFERENCES factions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relations_faction1 ON faction_relations(faction1_id);
CREATE INDEX IF NOT EXISTS idx_relations_faction2 ON faction_relations(faction2_id);
CREATE INDEX IF NOT EXISTS idx_relations_relation ON faction_relations(relation);

-- ============================================
-- SYNC LOG (Real-time sync tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    session_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    delta TEXT DEFAULT '{}',
    version INTEGER NOT NULL,
    actor_id TEXT,
    actor_type TEXT CHECK (actor_type IN ('player', 'gm', 'system')),
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_campaign ON sync_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sync_session ON sync_log(session_id);
CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_timestamp ON sync_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_version ON sync_log(version);

-- ============================================
-- DONE
-- ============================================

-- Verify tables created
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
