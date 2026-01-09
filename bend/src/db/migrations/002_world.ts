/**
 * MIGRATION 002: World Graph
 *
 * World nodes, edges, factions, deities - the cosmic structure
 */

export const MIGRATION_002_WORLD = {
  version: 2,
  name: '002_world',
  tables: [
    // ============================================
    // WORLD NODES
    // ============================================
    {
      name: 'world_nodes',
      sql: `
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

          -- Flexible data (WorldNodeData schema)
          data_static TEXT NOT NULL DEFAULT '{}',

          -- Metadata
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // WORLD EDGES
    // ============================================
    {
      name: 'world_edges',
      sql: `
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
      `,
    },

    // ============================================
    // FACTIONS
    // ============================================
    {
      name: 'factions',
      sql: `
        CREATE TABLE IF NOT EXISTS factions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT,
          scope TEXT,
          home_sphere_id TEXT REFERENCES world_nodes(id),
          home_planet_id TEXT REFERENCES world_nodes(id),

          -- Full faction data (FactionSchema)
          data TEXT NOT NULL DEFAULT '{}',

          is_seeded INTEGER DEFAULT 0,
          is_canonical INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },
    {
      name: 'faction_relations',
      sql: `
        CREATE TABLE IF NOT EXISTS faction_relations (
          id TEXT PRIMARY KEY,
          faction1_id TEXT NOT NULL REFERENCES factions(id),
          faction2_id TEXT NOT NULL REFERENCES factions(id),
          relation TEXT NOT NULL,
          properties TEXT NOT NULL DEFAULT '{}',
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // DEITIES
    // ============================================
    {
      name: 'deities',
      sql: `
        CREATE TABLE IF NOT EXISTS deities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pantheon TEXT,
          rank TEXT,
          alignment TEXT,
          sphere_id TEXT REFERENCES world_nodes(id),
          planet_id TEXT REFERENCES world_nodes(id),

          -- Full deity data
          data TEXT NOT NULL DEFAULT '{}',

          is_seeded INTEGER DEFAULT 0,
          is_canonical INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // POINTS OF INTEREST
    // ============================================
    {
      name: 'pois',
      sql: `
        CREATE TABLE IF NOT EXISTS pois (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,
          subtype TEXT,

          -- Location
          world_node_id TEXT REFERENCES world_nodes(id),
          region_id TEXT REFERENCES world_nodes(id),

          -- Difficulty
          threat_level TEXT,
          recommended_level_min INTEGER,
          recommended_level_max INTEGER,
          party_size INTEGER,

          -- Encounters (JSON)
          encounters TEXT DEFAULT '{}',

          -- Loot (JSON)
          loot TEXT DEFAULT '{}',

          -- Discovery state (JSON)
          discovery TEXT DEFAULT '{}',

          -- Control (JSON)
          control TEXT DEFAULT '{}',

          -- Economics impact (JSON)
          economics TEXT DEFAULT '{}',

          -- Faction context (JSON)
          faction_context TEXT DEFAULT '{}',

          -- Lifecycle (JSON)
          lifecycle TEXT DEFAULT '{}',

          -- Claim system (JSON)
          claim TEXT DEFAULT '{}',

          -- Lair link
          lair_id TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },
  ],

  indexes: [
    // World nodes
    'CREATE INDEX IF NOT EXISTS idx_nodes_parent ON world_nodes(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_type ON world_nodes(type)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_name ON world_nodes(name)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_sphere ON world_nodes(sphere_id)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_planet ON world_nodes(planet_id)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_region ON world_nodes(region_id)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_canonical ON world_nodes(canonical_name)',

    // World edges
    'CREATE INDEX IF NOT EXISTS idx_edges_source ON world_edges(source_id)',
    'CREATE INDEX IF NOT EXISTS idx_edges_target ON world_edges(target_id)',
    'CREATE INDEX IF NOT EXISTS idx_edges_type ON world_edges(type)',
    'CREATE INDEX IF NOT EXISTS idx_edges_source_type ON world_edges(source_id, type)',
    'CREATE INDEX IF NOT EXISTS idx_edges_target_type ON world_edges(target_id, type)',

    // Factions
    'CREATE INDEX IF NOT EXISTS idx_factions_name ON factions(name)',
    'CREATE INDEX IF NOT EXISTS idx_factions_scope ON factions(scope)',
    'CREATE INDEX IF NOT EXISTS idx_faction_relations_f1 ON faction_relations(faction1_id)',
    'CREATE INDEX IF NOT EXISTS idx_faction_relations_f2 ON faction_relations(faction2_id)',

    // Deities
    'CREATE INDEX IF NOT EXISTS idx_deities_name ON deities(name)',
    'CREATE INDEX IF NOT EXISTS idx_deities_pantheon ON deities(pantheon)',

    // POIs
    'CREATE INDEX IF NOT EXISTS idx_pois_campaign ON pois(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_pois_world_node ON pois(world_node_id)',
    'CREATE INDEX IF NOT EXISTS idx_pois_region ON pois(region_id)',
    'CREATE INDEX IF NOT EXISTS idx_pois_type ON pois(type)',
  ],
};
