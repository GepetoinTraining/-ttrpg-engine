/**
 * MIGRATION 003: Hub (Settlements)
 *
 * Hubs, districts, chunks, buildings - the urban layer
 */

export const MIGRATION_003_HUB = {
  version: 3,
  name: '003_hub',
  tables: [
    // ============================================
    // HUBS (Settlements)
    // ============================================
    {
      name: 'hubs',
      sql: `
        CREATE TABLE IF NOT EXISTS hubs (
          id TEXT PRIMARY KEY,
          world_node_id TEXT NOT NULL REFERENCES world_nodes(id),
          campaign_id TEXT REFERENCES campaigns(id),

          name TEXT NOT NULL,
          size TEXT NOT NULL,
          seed TEXT NOT NULL,
          population INTEGER DEFAULT 0,

          -- Grid
          topology TEXT DEFAULT '{}',
          chunk_grid_width INTEGER DEFAULT 10,
          chunk_grid_height INTEGER DEFAULT 10,

          -- Key locations (JSON - building IDs)
          key_locations TEXT DEFAULT '{}',

          -- Settlement attributes (JSON)
          defenses TEXT DEFAULT '{}',
          economy TEXT DEFAULT '{}',
          governance TEXT DEFAULT '{}',
          services TEXT DEFAULT '{}',

          -- NPCs (JSON arrays of character IDs)
          resident_npcs TEXT DEFAULT '[]',
          visiting_npcs TEXT DEFAULT '[]',

          generated_at TEXT,
          version INTEGER DEFAULT 1,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // DISTRICTS
    // ============================================
    {
      name: 'hub_districts',
      sql: `
        CREATE TABLE IF NOT EXISTS hub_districts (
          id TEXT PRIMARY KEY,
          hub_id TEXT NOT NULL REFERENCES hubs(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,

          -- Chunk coverage (JSON array of {x, y})
          chunk_coords TEXT DEFAULT '[]',

          -- District attributes
          topology TEXT DEFAULT '{}',
          population INTEGER DEFAULT 0,
          wealth_level TEXT DEFAULT 'modest',
          crime_level TEXT DEFAULT 'low',

          -- Factions present (JSON array)
          factions TEXT DEFAULT '[]',

          -- Notable locations (JSON array)
          notable_locations TEXT DEFAULT '[]',

          seed TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // CHUNKS (100x100 unit tiles)
    // ============================================
    {
      name: 'hub_chunks',
      sql: `
        CREATE TABLE IF NOT EXISTS hub_chunks (
          id TEXT PRIMARY KEY,
          hub_id TEXT NOT NULL REFERENCES hubs(id),
          district_id TEXT REFERENCES hub_districts(id),

          -- Position
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,

          district_type TEXT,

          -- Content (JSON)
          topology TEXT DEFAULT '{}',
          buildings TEXT DEFAULT '[]',
          streets TEXT DEFAULT '[]',
          pois TEXT DEFAULT '[]',

          -- Edge connections (JSON)
          edges TEXT DEFAULT '{}',

          seed TEXT,
          generated_at TEXT,

          UNIQUE(hub_id, x, y)
        )
      `,
    },

    // ============================================
    // BUILDINGS
    // ============================================
    {
      name: 'hub_buildings',
      sql: `
        CREATE TABLE IF NOT EXISTS hub_buildings (
          id TEXT PRIMARY KEY,
          hub_id TEXT NOT NULL REFERENCES hubs(id),
          district_id TEXT REFERENCES hub_districts(id),
          chunk_id TEXT REFERENCES hub_chunks(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,
          subtype TEXT,

          -- Position within chunk
          lot_x INTEGER,
          lot_y INTEGER,
          lot_width INTEGER,
          lot_height INTEGER,

          -- Building attributes (JSON)
          floors INTEGER DEFAULT 1,
          capacity INTEGER,
          quality TEXT DEFAULT 'common',

          -- Owner/operator
          owner_id TEXT,
          owner_type TEXT,
          operator_npc_id TEXT REFERENCES characters(id),

          -- Services offered (JSON)
          services TEXT DEFAULT '[]',

          -- Inventory if shop (JSON)
          inventory TEXT DEFAULT '[]',

          -- State
          is_open INTEGER DEFAULT 1,
          opening_hour INTEGER DEFAULT 6,
          closing_hour INTEGER DEFAULT 22,

          -- Faction control
          faction_id TEXT REFERENCES factions(id),

          seed TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // OBSERVER STATE (what a character sees)
    // ============================================
    {
      name: 'hub_observer_states',
      sql: `
        CREATE TABLE IF NOT EXISTS hub_observer_states (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          hub_id TEXT NOT NULL REFERENCES hubs(id),

          -- Current position (JSON {x, y})
          position TEXT DEFAULT '{}',
          current_chunk TEXT,

          -- Loaded chunks (JSON array)
          loaded_chunks TEXT DEFAULT '[]',

          -- Predicted trajectory (JSON array)
          trajectory TEXT DEFAULT '[]',

          -- Discovery (JSON arrays)
          discovered_buildings TEXT DEFAULT '[]',
          discovered_districts TEXT DEFAULT '[]',

          updated_at TEXT NOT NULL,

          UNIQUE(character_id, hub_id)
        )
      `,
    },
  ],

  indexes: [
    // Hubs
    'CREATE INDEX IF NOT EXISTS idx_hubs_world_node ON hubs(world_node_id)',
    'CREATE INDEX IF NOT EXISTS idx_hubs_campaign ON hubs(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_hubs_name ON hubs(name)',

    // Districts
    'CREATE INDEX IF NOT EXISTS idx_districts_hub ON hub_districts(hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_districts_type ON hub_districts(type)',

    // Chunks
    'CREATE INDEX IF NOT EXISTS idx_chunks_hub ON hub_chunks(hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_chunks_district ON hub_chunks(district_id)',
    'CREATE INDEX IF NOT EXISTS idx_chunks_pos ON hub_chunks(hub_id, x, y)',

    // Buildings
    'CREATE INDEX IF NOT EXISTS idx_buildings_hub ON hub_buildings(hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_district ON hub_buildings(district_id)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_chunk ON hub_buildings(chunk_id)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_type ON hub_buildings(type)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_operator ON hub_buildings(operator_npc_id)',

    // Observer states
    'CREATE INDEX IF NOT EXISTS idx_observer_character ON hub_observer_states(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_observer_hub ON hub_observer_states(hub_id)',
  ],
};
