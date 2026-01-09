/**
 * MIGRATION 001: Core Tables
 *
 * Foundation tables: users, campaigns, parties, characters
 */

export const MIGRATION_001_CORE = {
  version: 1,
  name: '001_core',
  tables: [
    // ============================================
    // USERS (extends Clerk)
    // ============================================
    {
      name: 'users',
      sql: `
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

          -- Onboarding
          onboarding_completed INTEGER DEFAULT 0,
          onboarding_step TEXT,

          -- Timestamps
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_active_at TEXT
        )
      `,
    },

    // ============================================
    // CAMPAIGNS
    // ============================================
    {
      name: 'campaigns',
      sql: `
        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tagline TEXT,
          description TEXT,

          -- World connection
          primary_world_id TEXT,
          starting_region_id TEXT,

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
      `,
    },
    {
      name: 'campaign_memberships',
      sql: `
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
      `,
    },
    {
      name: 'campaign_invites',
      sql: `
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
      `,
    },

    // ============================================
    // PARTIES
    // ============================================
    {
      name: 'parties',
      sql: `
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
          current_location_id TEXT,
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
      `,
    },
    {
      name: 'party_memberships',
      sql: `
        CREATE TABLE IF NOT EXISTS party_memberships (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          party_id TEXT NOT NULL REFERENCES parties(id),
          character_id TEXT NOT NULL,

          role TEXT DEFAULT 'member',
          active INTEGER DEFAULT 1,

          -- Timeline boundaries for party-scoped causality
          -- Character inherits party timeline between these versions
          joined_at TEXT NOT NULL,
          joined_sync_version INTEGER,
          left_at TEXT,
          left_sync_version INTEGER,

          UNIQUE(character_id, party_id)
        )
      `,
    },

    // ============================================
    // CHARACTERS
    // ============================================
    {
      name: 'characters',
      sql: `
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
          is_npc INTEGER DEFAULT 0,

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

          -- NPC metadata (when is_npc = 1)
          npc_metadata TEXT DEFAULT '{}',

          -- Timestamps
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_played_at TEXT,
          version INTEGER DEFAULT 1
        )
      `,
    },
    {
      name: 'character_features',
      sql: `
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
      `,
    },
    {
      name: 'conditions',
      sql: `
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
      `,
    },
  ],

  indexes: [
    // Users
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',

    // Campaigns
    'CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',

    // Memberships
    'CREATE INDEX IF NOT EXISTS idx_memberships_user ON campaign_memberships(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_memberships_campaign ON campaign_memberships(campaign_id)',

    // Invites
    'CREATE INDEX IF NOT EXISTS idx_invites_code ON campaign_invites(code)',
    'CREATE INDEX IF NOT EXISTS idx_invites_campaign ON campaign_invites(campaign_id)',

    // Parties
    'CREATE INDEX IF NOT EXISTS idx_parties_campaign ON parties(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_party_members_party ON party_memberships(party_id)',
    'CREATE INDEX IF NOT EXISTS idx_party_members_character ON party_memberships(character_id)',

    // Characters
    'CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_characters_npc ON characters(is_npc)',
    'CREATE INDEX IF NOT EXISTS idx_features_character ON character_features(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_conditions_character ON conditions(character_id)',
  ],
};
