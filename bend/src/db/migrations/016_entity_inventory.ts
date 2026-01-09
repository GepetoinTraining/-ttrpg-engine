/**
 * MIGRATION 016: Entity-Based Inventory System
 *
 * Refactors inventory_systems to support any entity type:
 * - characters (players)
 * - npcs (guards, merchants, adventurers)
 * - parties (shared caravan/trolley loot)
 * - locations (treasure chests, vaults, stashes)
 * - vehicles (ship cargo, cart storage)
 * - buildings (shop inventory, guild storage)
 *
 * This enables NPCs to have equipment, merchants to have real stock,
 * and parties to have shared inventory with weight limits.
 */

export const MIGRATION_016_ENTITY_INVENTORY = {
  version: 16,
  name: '016_entity_inventory',
  tables: [
    // ============================================
    // ADD equipped_slot TO EXISTING inventory_items
    // ============================================
    {
      name: 'inventory_items_add_slot',
      sql: `
        ALTER TABLE inventory_items ADD COLUMN equipped_slot TEXT
      `,
    },
    // ============================================
    // ENTITY INVENTORY SYSTEMS
    // Replaces character-only inventory_systems
    // ============================================
    {
      name: 'entity_inventory_systems',
      sql: `
        CREATE TABLE IF NOT EXISTS entity_inventory_systems (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Entity ownership (polymorphic)
          entity_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          -- entity_type values:
          -- 'character' - player characters
          -- 'npc' - NPCs (guards, merchants, adventurers)
          -- 'party' - party shared inventory (caravan, trolley)
          -- 'location' - treasure chests, vaults, stashes
          -- 'vehicle' - ship cargo, cart storage
          -- 'building' - shop inventory, guild storage
          -- 'mount' - saddlebags (alternative to container-based)

          -- Optional label for display
          name TEXT,
          description TEXT,

          -- Wallet (JSON - StandardCurrency, FantasyCurrency, commodities)
          wallet TEXT DEFAULT '{"standard":{"copper":0,"silver":0,"electrum":0,"gold":0,"platinum":0}}',

          -- Container IDs (auto-created for characters/npcs)
          worn_container_id TEXT,
          carried_container_id TEXT,

          -- Attunement (only for characters/npcs)
          attunement_slots INTEGER DEFAULT 3,
          attuned_items TEXT DEFAULT '[]',

          -- Capacity overrides (for locations/vehicles)
          weight_capacity REAL,
          item_capacity INTEGER,

          -- Settings
          track_weight INTEGER DEFAULT 0,
          track_ammunition INTEGER DEFAULT 0,
          encumbrance_rule TEXT DEFAULT 'none',

          -- For merchant NPCs - commerce settings
          is_merchant INTEGER DEFAULT 0,
          price_modifier REAL DEFAULT 1.0,
          buys_categories TEXT DEFAULT '[]',
          restock_interval TEXT,
          last_restocked_at TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1,

          UNIQUE(entity_id, entity_type)
        )
      `,
    },

    // ============================================
    // INVENTORY TEMPLATES
    // Define what items an entity type should have
    // ============================================
    {
      name: 'inventory_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_templates (
          id TEXT PRIMARY KEY,
          campaign_id TEXT REFERENCES campaigns(id),

          -- What this template applies to
          name TEXT NOT NULL,
          description TEXT,

          -- Matching criteria (JSON)
          -- For NPCs: { "occupation": "guard", "level_min": 1, "level_max": 5 }
          -- For locations: { "type": "dungeon_chest", "tier": "uncommon" }
          criteria TEXT DEFAULT '{}',

          -- Items to include (JSON array)
          -- [{ "item_template_id": "...", "quantity": 1, "equipped": true, "slot": "main_hand" }]
          -- [{ "item_category": "weapon", "rarity": "common", "quantity": "1d2" }]
          items TEXT DEFAULT '[]',

          -- Currency to include (JSON)
          -- { "gold": "2d6", "silver": "3d10" } - dice notation supported
          currency TEXT DEFAULT '{}',

          -- Generation settings
          is_random INTEGER DEFAULT 0,
          is_system INTEGER DEFAULT 0,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // DEFAULT NPC LOADOUTS
    // Quick reference for common NPC equipment
    // ============================================
    {
      name: 'npc_loadouts',
      sql: `
        CREATE TABLE IF NOT EXISTS npc_loadouts (
          id TEXT PRIMARY KEY,

          -- What role/occupation this loadout is for
          role TEXT NOT NULL,
          occupation TEXT,
          tier TEXT DEFAULT 'common',

          -- Level range
          level_min INTEGER DEFAULT 1,
          level_max INTEGER DEFAULT 20,

          -- Equipment (JSON)
          -- { "main_hand": "longsword", "chest": "chain_mail", "off_hand": "shield" }
          equipment TEXT DEFAULT '{}',

          -- Carried items (JSON array)
          -- [{ "item": "healing_potion", "quantity": "1d2" }]
          carried TEXT DEFAULT '[]',

          -- Currency (JSON with dice notation)
          currency TEXT DEFAULT '{}',

          -- Is this a system default or campaign-specific
          is_system INTEGER DEFAULT 1,
          campaign_id TEXT REFERENCES campaigns(id),

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // MERCHANT STOCK
    // Tracks what merchants have in stock
    // ============================================
    {
      name: 'merchant_stock',
      sql: `
        CREATE TABLE IF NOT EXISTS merchant_stock (
          id TEXT PRIMARY KEY,
          inventory_system_id TEXT NOT NULL REFERENCES entity_inventory_systems(id),

          -- Item reference
          item_id TEXT REFERENCES items(id),
          item_template_id TEXT,

          -- Stock levels
          quantity INTEGER DEFAULT 1,
          max_quantity INTEGER,
          restock_quantity TEXT,

          -- Pricing
          buy_price INTEGER,
          sell_price INTEGER,
          price_modifier REAL DEFAULT 1.0,

          -- Availability
          is_available INTEGER DEFAULT 1,
          available_from TEXT,
          available_until TEXT,

          -- Restocking
          restock_days TEXT DEFAULT '[]',
          last_restocked_at TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Entity inventory systems
    'CREATE INDEX IF NOT EXISTS idx_eis_campaign ON entity_inventory_systems(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_eis_entity ON entity_inventory_systems(entity_id, entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_eis_type ON entity_inventory_systems(entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_eis_merchant ON entity_inventory_systems(is_merchant) WHERE is_merchant = 1',

    // Inventory templates
    'CREATE INDEX IF NOT EXISTS idx_inv_templates_campaign ON inventory_templates(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_inv_templates_system ON inventory_templates(is_system)',

    // NPC loadouts
    'CREATE INDEX IF NOT EXISTS idx_loadouts_role ON npc_loadouts(role)',
    'CREATE INDEX IF NOT EXISTS idx_loadouts_occupation ON npc_loadouts(occupation)',
    'CREATE INDEX IF NOT EXISTS idx_loadouts_tier ON npc_loadouts(tier)',
    'CREATE INDEX IF NOT EXISTS idx_loadouts_campaign ON npc_loadouts(campaign_id)',

    // Merchant stock
    'CREATE INDEX IF NOT EXISTS idx_merchant_stock_inv ON merchant_stock(inventory_system_id)',
    'CREATE INDEX IF NOT EXISTS idx_merchant_stock_item ON merchant_stock(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_merchant_stock_available ON merchant_stock(is_available)',
  ],
};
