/**
 * MIGRATION 004: Inventory System
 *
 * Items, containers, mounts, followers, currency
 */

export const MIGRATION_004_INVENTORY = {
  version: 4,
  name: '004_inventory',
  tables: [
    // ============================================
    // INVENTORY SYSTEMS (per character)
    // ============================================
    {
      name: 'inventory_systems',
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_systems (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Wallet (JSON - StandardCurrency, FantasyCurrency, commodities)
          wallet TEXT DEFAULT '{}',

          -- Container IDs
          worn_container_id TEXT,
          carried_container_id TEXT,

          -- Attunement
          attunement_slots INTEGER DEFAULT 3,
          attuned_items TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1,

          UNIQUE(character_id)
        )
      `,
    },

    // ============================================
    // CONTAINERS (backpacks, worn slots, etc.)
    // ============================================
    {
      name: 'inventory_containers',
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_containers (
          id TEXT PRIMARY KEY,
          inventory_system_id TEXT NOT NULL REFERENCES inventory_systems(id),

          type TEXT NOT NULL,
          name TEXT NOT NULL,

          -- Capacity
          weight_capacity REAL,
          item_slots INTEGER,
          dimensional_space INTEGER DEFAULT 0,

          -- Items (JSON array with quantity, equipped, attuned)
          items TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // ITEMS (templates and instances)
    // ============================================
    {
      name: 'items',
      sql: `
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          -- Is this a template or instance?
          is_template INTEGER DEFAULT 0,
          template_id TEXT REFERENCES items(id),

          name TEXT NOT NULL,
          description TEXT,

          -- Classification
          category TEXT NOT NULL,
          subcategory TEXT,
          rarity TEXT DEFAULT 'common',

          -- Physical
          weight REAL DEFAULT 0,
          base_value INTEGER DEFAULT 0,

          -- Magic
          magical INTEGER DEFAULT 0,
          requires_attunement INTEGER DEFAULT 0,
          attunement_requirements TEXT,

          -- Weapon data (JSON)
          weapon TEXT,

          -- Armor data (JSON)
          armor TEXT,

          -- Container data (JSON) - if item is a container
          container TEXT,

          -- Charges (JSON)
          charges TEXT,

          -- Abilities (JSON array)
          abilities TEXT DEFAULT '[]',

          -- Tags
          tags TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // INVENTORY ITEMS (items in containers)
    // ============================================
    {
      name: 'inventory_items',
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          owner_type TEXT NOT NULL,

          -- Item reference or custom
          item_template_id TEXT REFERENCES items(id),
          item_id TEXT REFERENCES items(id),
          name TEXT NOT NULL,
          description TEXT,

          -- Quantity
          quantity INTEGER DEFAULT 1,

          -- Status
          equipped INTEGER DEFAULT 0,
          attuned INTEGER DEFAULT 0,

          -- Container
          container_id TEXT,

          -- Properties override (JSON)
          properties TEXT DEFAULT '{}',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // MOUNTS
    // ============================================
    {
      name: 'mounts',
      sql: `
        CREATE TABLE IF NOT EXISTS mounts (
          id TEXT PRIMARY KEY,
          inventory_system_id TEXT NOT NULL REFERENCES inventory_systems(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,

          -- Stats
          strength INTEGER DEFAULT 10,
          carrying_capacity INTEGER DEFAULT 480,
          speed INTEGER DEFAULT 60,

          -- Equipment
          barding TEXT,
          saddle TEXT,

          -- Containers on mount (JSON array of container IDs)
          containers TEXT DEFAULT '[]',

          -- Health
          hp_current INTEGER,
          hp_max INTEGER,

          -- Status
          status TEXT DEFAULT 'healthy',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // FOLLOWERS (that carry inventory)
    // ============================================
    {
      name: 'followers',
      sql: `
        CREATE TABLE IF NOT EXISTS followers (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          owner_id TEXT NOT NULL REFERENCES characters(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,
          count INTEGER DEFAULT 1,

          -- Stats (JSON)
          stats TEXT DEFAULT '{}',

          -- Inventory container
          inventory_container_id TEXT REFERENCES inventory_containers(id),

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
      `,
    },

    // ============================================
    // COMMODITIES (trade goods with market value)
    // ============================================
    {
      name: 'commodities',
      sql: `
        CREATE TABLE IF NOT EXISTS commodities (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          name TEXT NOT NULL,
          category TEXT NOT NULL,
          unit TEXT DEFAULT 'unit',

          -- Base value per unit
          base_value INTEGER DEFAULT 1,

          -- Weight per unit
          weight_per_unit REAL DEFAULT 1,

          -- Market factors (JSON)
          market_factors TEXT DEFAULT '{}',

          -- Is canonical (core commodity) or campaign-specific
          is_canonical INTEGER DEFAULT 0,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },
  ],

  indexes: [
    // Inventory systems
    'CREATE INDEX IF NOT EXISTS idx_inv_sys_character ON inventory_systems(character_id)',
    'CREATE INDEX IF NOT EXISTS idx_inv_sys_campaign ON inventory_systems(campaign_id)',

    // Containers
    'CREATE INDEX IF NOT EXISTS idx_containers_inv_sys ON inventory_containers(inventory_system_id)',
    'CREATE INDEX IF NOT EXISTS idx_containers_type ON inventory_containers(type)',

    // Items
    'CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_items_template ON items(is_template)',
    'CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)',
    'CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity)',

    // Inventory items
    'CREATE INDEX IF NOT EXISTS idx_inv_items_owner ON inventory_items(owner_id, owner_type)',
    'CREATE INDEX IF NOT EXISTS idx_inv_items_container ON inventory_items(container_id)',
    'CREATE INDEX IF NOT EXISTS idx_inv_items_template ON inventory_items(item_template_id)',

    // Mounts
    'CREATE INDEX IF NOT EXISTS idx_mounts_inv_sys ON mounts(inventory_system_id)',

    // Followers
    'CREATE INDEX IF NOT EXISTS idx_followers_owner ON followers(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_followers_campaign ON followers(campaign_id)',

    // Commodities
    'CREATE INDEX IF NOT EXISTS idx_commodities_campaign ON commodities(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_commodities_category ON commodities(category)',
  ],
};
