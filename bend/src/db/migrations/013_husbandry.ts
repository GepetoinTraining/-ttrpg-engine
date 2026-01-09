/**
 * MIGRATION 013: Husbandry System
 *
 * Livestock production - meat, dairy, wool, eggs, draft labor.
 * Animals modeled as stock cohorts with care schedules and yield functions.
 */

export const MIGRATION_013_HUSBANDRY = {
  version: 13,
  name: '013_husbandry',
  tables: [
    // ============================================
    // LIVESTOCK SPECIES
    // ============================================
    {
      name: 'livestock_species',
      sql: `
        CREATE TABLE IF NOT EXISTS livestock_species (
          id TEXT PRIMARY KEY,

          -- Identity
          name TEXT NOT NULL,
          scientific_name TEXT,
          description TEXT,

          -- Classification
          category TEXT NOT NULL,
          domestication_class TEXT NOT NULL,
          creature_type TEXT DEFAULT 'beast',

          -- Profiles (JSON)
          yield_profiles TEXT DEFAULT '{}',
          care_requirements TEXT DEFAULT '{}',
          reproduction_profile TEXT DEFAULT '{}',
          mortality_profile TEXT DEFAULT '{}',
          disease_susceptibility TEXT DEFAULT '[]',

          -- Habitat
          preferred_climates TEXT DEFAULT '[]',
          terrain_adaptations TEXT DEFAULT '[]',

          -- Economics
          base_purchase_price INTEGER DEFAULT 10,
          base_sale_price INTEGER DEFAULT 8,

          -- Metadata
          is_canonical INTEGER DEFAULT 1,
          source TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // RANCHES (Husbandry Sites)
    // ============================================
    {
      name: 'ranches',
      sql: `
        CREATE TABLE IF NOT EXISTS ranches (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Location binding
          hub_id TEXT REFERENCES hubs(id),
          world_node_id TEXT REFERENCES world_nodes(id),
          district_id TEXT REFERENCES hub_districts(id),
          building_id TEXT REFERENCES hub_buildings(id),

          name TEXT NOT NULL,

          -- Owner
          owner_id TEXT,
          owner_type TEXT,
          owner_name TEXT,

          -- Capacity
          total_capacity INTEGER DEFAULT 50,
          current_occupancy INTEGER DEFAULT 0,

          -- Infrastructure (JSON)
          infrastructure TEXT DEFAULT '{}',

          -- Quality factors
          pasture_quality TEXT DEFAULT 'standard',
          security_level TEXT DEFAULT 'basic',
          shelter_quality TEXT DEFAULT 'basic',

          -- Staff (JSON array)
          workers TEXT DEFAULT '[]',
          total_workers INTEGER DEFAULT 0,

          -- Economics
          operating_cost_per_day INTEGER DEFAULT 0,
          tax_rate REAL DEFAULT 0,
          tax_collector TEXT,

          -- Status
          status TEXT DEFAULT 'active',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // HERDS (Livestock Cohorts)
    // ============================================
    {
      name: 'herds',
      sql: `
        CREATE TABLE IF NOT EXISTS herds (
          id TEXT PRIMARY KEY,
          ranch_id TEXT NOT NULL REFERENCES ranches(id),
          species_id TEXT NOT NULL REFERENCES livestock_species(id),

          -- Population
          count INTEGER NOT NULL DEFAULT 0,

          -- Age distribution (JSON)
          age_distribution TEXT DEFAULT '{}',

          -- Health state (JSON)
          health_state TEXT DEFAULT '{}',

          -- Stress state (JSON)
          stress_state TEXT DEFAULT '{}',

          -- Breeding
          breeding_enabled INTEGER DEFAULT 1,
          pregnant_count INTEGER DEFAULT 0,
          expected_births TEXT DEFAULT '[]',

          -- Yield tracking
          last_yield_collected TEXT,
          yield_this_cycle REAL DEFAULT 0,

          -- Timeline integration
          last_care_tick_version INTEGER,
          last_care_tick_timestamp TEXT,

          -- Named individuals (JSON array - special animals only)
          named_individuals TEXT DEFAULT '[]',

          -- Tags
          tags TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // HUSBANDRY OPERATIONS
    // ============================================
    {
      name: 'husbandry_operations',
      sql: `
        CREATE TABLE IF NOT EXISTS husbandry_operations (
          id TEXT PRIMARY KEY,
          ranch_id TEXT NOT NULL REFERENCES ranches(id),
          herd_id TEXT NOT NULL REFERENCES herds(id),

          -- Operation mode
          mode TEXT NOT NULL,

          -- Resource allocation
          labor_allocated INTEGER DEFAULT 0,
          feed_allocated REAL DEFAULT 0,
          feed_source TEXT DEFAULT 'stockpile',

          -- Quality metrics
          care_quality REAL DEFAULT 1.0,
          feed_quality REAL DEFAULT 1.0,

          -- Status
          status TEXT DEFAULT 'active',
          disruption_reason TEXT,
          resumes_at TEXT,

          -- Output tracking (JSON)
          output_this_cycle TEXT DEFAULT '{}',
          output_total TEXT DEFAULT '{}',
          output_destination TEXT DEFAULT '{}',

          -- Stockpile (JSON)
          stockpile TEXT DEFAULT '{}',
          stockpile_capacity INTEGER DEFAULT 500,

          -- Economics
          operating_costs REAL DEFAULT 0,
          revenue REAL DEFAULT 0,

          started_at TEXT NOT NULL,
          last_tick_at TEXT,
          last_tick_version INTEGER,

          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // HUSBANDRY EVENTS
    // ============================================
    {
      name: 'husbandry_events',
      sql: `
        CREATE TABLE IF NOT EXISTS husbandry_events (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          ranch_id TEXT REFERENCES ranches(id),
          herd_id TEXT REFERENCES herds(id),
          operation_id TEXT REFERENCES husbandry_operations(id),

          -- Event type
          event_type TEXT NOT NULL,

          -- Event details (JSON)
          details TEXT DEFAULT '{}',

          -- Impact (JSON)
          impact TEXT DEFAULT '{}',

          -- Severity
          severity TEXT DEFAULT 'info',

          -- Timeline
          occurred_at TEXT NOT NULL,
          world_timestamp TEXT,
          sync_log_id TEXT,

          -- Visibility
          public_knowledge INTEGER DEFAULT 1,

          created_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Livestock species
    'CREATE INDEX IF NOT EXISTS idx_species_category ON livestock_species(category)',
    'CREATE INDEX IF NOT EXISTS idx_species_domestication ON livestock_species(domestication_class)',

    // Ranches
    'CREATE INDEX IF NOT EXISTS idx_ranches_campaign ON ranches(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_ranches_hub ON ranches(hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_ranches_world_node ON ranches(world_node_id)',
    'CREATE INDEX IF NOT EXISTS idx_ranches_owner ON ranches(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_ranches_status ON ranches(status)',

    // Herds
    'CREATE INDEX IF NOT EXISTS idx_herds_ranch ON herds(ranch_id)',
    'CREATE INDEX IF NOT EXISTS idx_herds_species ON herds(species_id)',
    'CREATE INDEX IF NOT EXISTS idx_herds_tick_version ON herds(last_care_tick_version)',

    // Husbandry operations
    'CREATE INDEX IF NOT EXISTS idx_husbandry_ops_ranch ON husbandry_operations(ranch_id)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_ops_herd ON husbandry_operations(herd_id)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_ops_mode ON husbandry_operations(mode)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_ops_status ON husbandry_operations(status)',

    // Husbandry events
    'CREATE INDEX IF NOT EXISTS idx_husbandry_events_campaign ON husbandry_events(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_events_ranch ON husbandry_events(ranch_id)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_events_herd ON husbandry_events(herd_id)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_events_type ON husbandry_events(event_type)',
    'CREATE INDEX IF NOT EXISTS idx_husbandry_events_occurred ON husbandry_events(occurred_at)',
  ],
};
