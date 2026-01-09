/**
 * MIGRATION 007: Economy System
 *
 * Markets, merchants, extraction, logistics, trade
 */

export const MIGRATION_007_ECONOMY = {
  version: 7,
  name: '007_economy',
  tables: [
    // ============================================
    // MARKET VENUES
    // ============================================
    {
      name: 'market_venues',
      sql: `
        CREATE TABLE IF NOT EXISTS market_venues (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,

          -- Location
          settlement_id TEXT REFERENCES world_nodes(id),
          district_id TEXT REFERENCES hub_districts(id),
          building_id TEXT REFERENCES hub_buildings(id),

          -- Owner
          owner_id TEXT,
          owner_type TEXT,

          -- Costs
          rent_cost INTEGER DEFAULT 0,
          property_value INTEGER DEFAULT 0,
          maintenance_cost INTEGER DEFAULT 0,

          -- Capacity
          display_capacity INTEGER DEFAULT 50,
          storage_capacity INTEGER DEFAULT 200,
          customer_capacity INTEGER DEFAULT 20,

          -- Features (JSON array)
          features TEXT DEFAULT '[]',

          -- Status
          status TEXT DEFAULT 'active',
          daily_foot_traffic INTEGER DEFAULT 0,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // MERCHANTS
    // ============================================
    {
      name: 'merchants',
      sql: `
        CREATE TABLE IF NOT EXISTS merchants (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- NPC link
          npc_id TEXT REFERENCES characters(id),
          name TEXT NOT NULL,

          -- Business
          tier TEXT DEFAULT 'peddler',
          specialization TEXT,

          -- Location
          settlement_id TEXT REFERENCES world_nodes(id),
          venue_id TEXT REFERENCES market_venues(id),

          -- Finances
          capital INTEGER DEFAULT 100,
          weekly_revenue INTEGER DEFAULT 0,
          weekly_expenses INTEGER DEFAULT 0,

          -- Inventory (JSON array)
          inventory TEXT DEFAULT '[]',

          -- Reputation (JSON)
          reputation TEXT DEFAULT '{}',

          -- Personality traits (JSON)
          personality TEXT DEFAULT '{}',

          -- Business relationships (JSON arrays)
          suppliers TEXT DEFAULT '[]',
          regular_customers TEXT DEFAULT '[]',

          -- Guild
          guild_membership TEXT,

          -- Schedule (JSON)
          schedule TEXT DEFAULT '{}',

          -- Employees (JSON array)
          employees TEXT DEFAULT '[]',

          -- Status
          status TEXT DEFAULT 'active',
          current_goal TEXT,

          -- History
          established TEXT,
          previous_tiers TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // MARKET DISTRICTS
    // ============================================
    {
      name: 'market_districts',
      sql: `
        CREATE TABLE IF NOT EXISTS market_districts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          settlement_id TEXT NOT NULL REFERENCES world_nodes(id),
          hub_district_id TEXT REFERENCES hub_districts(id),

          name TEXT NOT NULL,
          character TEXT,

          -- Venues (JSON array of IDs)
          venue_ids TEXT DEFAULT '[]',

          -- Economics
          average_rent INTEGER DEFAULT 0,
          foot_traffic INTEGER DEFAULT 0,
          wealth_level TEXT DEFAULT 'modest',

          -- Control
          controlled_by TEXT,
          tax_rate REAL DEFAULT 0.05,
          protection_fee INTEGER DEFAULT 0,

          -- Schedule
          market_days TEXT DEFAULT '[]',

          -- Safety
          crime_rate TEXT DEFAULT 'low',
          guard_presence TEXT DEFAULT 'moderate',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // AUCTION HOUSES
    // ============================================
    {
      name: 'auction_houses',
      sql: `
        CREATE TABLE IF NOT EXISTS auction_houses (
          id TEXT PRIMARY KEY,
          venue_id TEXT NOT NULL REFERENCES market_venues(id),

          name TEXT NOT NULL,
          specialization TEXT,

          reputation INTEGER DEFAULT 50,
          exclusivity TEXT DEFAULT 'open',
          minimum_lot_value INTEGER DEFAULT 10,

          -- Schedule (JSON array)
          auction_days TEXT DEFAULT '[]',

          -- Active auctions (JSON arrays of IDs)
          active_auction_ids TEXT DEFAULT '[]',
          upcoming_auction_ids TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // AUCTIONS
    // ============================================
    {
      name: 'auctions',
      sql: `
        CREATE TABLE IF NOT EXISTS auctions (
          id TEXT PRIMARY KEY,
          auction_house_id TEXT NOT NULL REFERENCES auction_houses(id),

          -- Item (JSON)
          item TEXT NOT NULL,

          -- Seller
          seller_id TEXT,
          seller_name TEXT,
          reserve_price INTEGER DEFAULT 0,

          -- Status
          status TEXT DEFAULT 'upcoming',
          start_time TEXT,
          end_time TEXT,

          -- Bidding
          current_bid INTEGER DEFAULT 0,
          current_bidder_id TEXT,
          current_bidder_name TEXT,

          -- Bid history (JSON array)
          bid_history TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // RESOURCE DEPOSITS
    // ============================================
    {
      name: 'resource_deposits',
      sql: `
        CREATE TABLE IF NOT EXISTS resource_deposits (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Location
          location_id TEXT REFERENCES world_nodes(id),
          location_name TEXT,
          region_id TEXT REFERENCES world_nodes(id),

          name TEXT NOT NULL,
          deposit_type TEXT NOT NULL,

          -- Resources
          primary_commodity_id TEXT REFERENCES commodities(id),
          secondary_commodities TEXT DEFAULT '[]',

          -- Quality and reserves
          quality TEXT DEFAULT 'standard',
          total_reserves INTEGER,
          remaining_reserves INTEGER,
          renewable INTEGER DEFAULT 0,
          regeneration_rate REAL DEFAULT 0,

          -- Requirements
          minimum_tech_level TEXT,
          required_building TEXT,
          required_tools TEXT DEFAULT '[]',
          labor_requirement INTEGER DEFAULT 1,

          -- Hazards (JSON array)
          hazards TEXT DEFAULT '[]',

          -- Discovery
          discovered INTEGER DEFAULT 0,
          discovered_by TEXT,
          controlled_by TEXT,
          controller_name TEXT,

          -- Output
          base_output_per_slot REAL DEFAULT 1,
          current_output_per_slot REAL DEFAULT 0,

          -- Infrastructure (JSON array)
          buildings TEXT DEFAULT '[]',
          infrastructure_level INTEGER DEFAULT 0,

          -- Economics
          operating_cost_per_day INTEGER DEFAULT 0,
          tax_rate REAL DEFAULT 0,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // EXTRACTION OPERATIONS
    // ============================================
    {
      name: 'extraction_operations',
      sql: `
        CREATE TABLE IF NOT EXISTS extraction_operations (
          id TEXT PRIMARY KEY,
          deposit_id TEXT NOT NULL REFERENCES resource_deposits(id),

          -- Operator
          operator_id TEXT,
          operator_type TEXT,
          operator_name TEXT,

          -- Workers (JSON array)
          workers TEXT DEFAULT '[]',
          total_workers INTEGER DEFAULT 0,
          worker_efficiency REAL DEFAULT 1.0,

          -- Tools (JSON array)
          tools TEXT DEFAULT '[]',

          -- Status
          status TEXT DEFAULT 'active',
          disruption_reason TEXT,
          resumes_at TEXT,

          -- Output
          output_this_cycle INTEGER DEFAULT 0,
          output_total INTEGER DEFAULT 0,
          output_destination TEXT,

          -- Stockpile (JSON)
          stockpile TEXT DEFAULT '{}',

          -- Finances
          operating_costs INTEGER DEFAULT 0,
          revenue INTEGER DEFAULT 0,
          profit_margin REAL DEFAULT 0,

          started_at TEXT NOT NULL,
          last_tick_at TEXT,

          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // TRADING COMPANIES
    // ============================================
    {
      name: 'trading_companies',
      sql: `
        CREATE TABLE IF NOT EXISTS trading_companies (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,
          reputation INTEGER DEFAULT 50,

          -- Owner
          owner_id TEXT,
          owner_type TEXT,
          owner_name TEXT,

          -- HQ
          headquarters_settlement_id TEXT REFERENCES world_nodes(id),

          -- Fleet (JSON array)
          fleet TEXT DEFAULT '[]',

          -- Routes (JSON array of IDs)
          routes TEXT DEFAULT '[]',

          -- Finances
          treasury INTEGER DEFAULT 1000,
          credit_rating TEXT DEFAULT 'fair',
          operating_costs_per_day INTEGER DEFAULT 0,
          revenue_this_month INTEGER DEFAULT 0,
          expenses_this_month INTEGER DEFAULT 0,

          -- Licenses (JSON array)
          trade_licenses TEXT DEFAULT '[]',

          -- Relationships (JSON)
          faction_standings TEXT DEFAULT '{}',

          -- Staff (JSON arrays)
          employees TEXT DEFAULT '[]',
          warehouses TEXT DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // TRADE ROUTE PROGRAMS
    // ============================================
    {
      name: 'trade_route_programs',
      sql: `
        CREATE TABLE IF NOT EXISTS trade_route_programs (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),
          company_id TEXT REFERENCES trading_companies(id),

          name TEXT NOT NULL,
          route_type TEXT NOT NULL,

          -- Nodes (JSON array)
          nodes TEXT DEFAULT '[]',

          -- Edges (JSON array)
          edges TEXT DEFAULT '[]',

          -- Transport
          preferred_mode TEXT,
          allowed_modes TEXT DEFAULT '[]',

          -- Economics
          estimated_revenue INTEGER DEFAULT 0,
          estimated_cost INTEGER DEFAULT 0,
          estimated_duration INTEGER DEFAULT 0,

          -- Cargo
          primary_commodities TEXT DEFAULT '[]',

          -- Risk
          overall_risk TEXT DEFAULT 'low',
          known_hazards TEXT DEFAULT '[]',

          status TEXT DEFAULT 'active',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // CARAVANS
    // ============================================
    {
      name: 'caravans',
      sql: `
        CREATE TABLE IF NOT EXISTS caravans (
          id TEXT PRIMARY KEY,
          route_id TEXT NOT NULL REFERENCES trade_route_programs(id),
          company_id TEXT REFERENCES trading_companies(id),
          company_name TEXT,

          -- Fleet (JSON array of IDs)
          fleet_ids TEXT DEFAULT '[]',

          -- Current position
          current_node_order INTEGER DEFAULT 0,
          current_settlement_id TEXT REFERENCES world_nodes(id),
          current_settlement_name TEXT,

          -- Transit
          in_transit INTEGER DEFAULT 0,
          transit_progress REAL DEFAULT 0,
          estimated_arrival TEXT,

          -- Cargo (JSON array)
          cargo TEXT DEFAULT '[]',
          total_cargo_weight REAL DEFAULT 0,
          total_cargo_value INTEGER DEFAULT 0,

          -- Crew
          captain TEXT,
          crew_count INTEGER DEFAULT 1,
          guard_count INTEGER DEFAULT 0,
          provisions INTEGER DEFAULT 0,

          -- Status
          status TEXT DEFAULT 'active',
          problems TEXT DEFAULT '[]',

          -- Run stats
          circuit_number INTEGER DEFAULT 1,
          run_revenue INTEGER DEFAULT 0,
          run_expenses INTEGER DEFAULT 0,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // FREIGHT CONTRACTS
    // ============================================
    {
      name: 'freight_contracts',
      sql: `
        CREATE TABLE IF NOT EXISTS freight_contracts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Shipper
          shipper_id TEXT,
          shipper_type TEXT,
          shipper_name TEXT,

          -- Carrier
          carrier_id TEXT REFERENCES trading_companies(id),
          carrier_name TEXT,

          -- Cargo (JSON array)
          cargo TEXT DEFAULT '[]',

          -- Route
          origin_settlement_id TEXT REFERENCES world_nodes(id),
          destination_settlement_id TEXT REFERENCES world_nodes(id),

          -- Payment
          payment_amount INTEGER NOT NULL,
          payment_terms TEXT DEFAULT 'on_delivery',
          insurance_included INTEGER DEFAULT 0,

          -- Deadlines
          pickup_deadline TEXT,
          delivery_deadline TEXT,

          -- Status
          status TEXT DEFAULT 'pending',
          picked_up_at TEXT,
          delivered_at TEXT,
          actual_payment INTEGER,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // MARKET EVENTS
    // ============================================
    {
      name: 'market_events',
      sql: `
        CREATE TABLE IF NOT EXISTS market_events (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,

          -- Scope
          settlement_id TEXT REFERENCES world_nodes(id),
          affected_commodities TEXT DEFAULT '[]',
          affected_merchants TEXT DEFAULT '[]',

          -- Effects (JSON array)
          effects TEXT DEFAULT '[]',

          -- Timing
          start_date TEXT,
          end_date TEXT,
          status TEXT DEFAULT 'active',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // ECONOMIC EVENTS (legacy)
    // ============================================
    {
      name: 'economic_events',
      sql: `
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
      `,
    },

    // ============================================
    // TRADE ROUTES (legacy)
    // ============================================
    {
      name: 'trade_routes',
      sql: `
        CREATE TABLE IF NOT EXISTS trade_routes (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          from_node_id TEXT NOT NULL REFERENCES world_nodes(id),
          to_node_id TEXT NOT NULL REFERENCES world_nodes(id),

          goods TEXT DEFAULT '[]',
          volume TEXT,
          travel_time TEXT,
          danger_level TEXT,

          status TEXT DEFAULT 'active',
          controlled_by TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Market venues
    'CREATE INDEX IF NOT EXISTS idx_venues_campaign ON market_venues(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_venues_settlement ON market_venues(settlement_id)',
    'CREATE INDEX IF NOT EXISTS idx_venues_type ON market_venues(type)',

    // Merchants
    'CREATE INDEX IF NOT EXISTS idx_merchants_campaign ON market_venues(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_merchants_settlement ON merchants(settlement_id)',
    'CREATE INDEX IF NOT EXISTS idx_merchants_venue ON merchants(venue_id)',
    'CREATE INDEX IF NOT EXISTS idx_merchants_npc ON merchants(npc_id)',

    // Market districts
    'CREATE INDEX IF NOT EXISTS idx_market_districts_settlement ON market_districts(settlement_id)',

    // Auction houses
    'CREATE INDEX IF NOT EXISTS idx_auction_houses_venue ON auction_houses(venue_id)',

    // Auctions
    'CREATE INDEX IF NOT EXISTS idx_auctions_house ON auctions(auction_house_id)',
    'CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)',

    // Resource deposits
    'CREATE INDEX IF NOT EXISTS idx_deposits_campaign ON resource_deposits(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_location ON resource_deposits(location_id)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_region ON resource_deposits(region_id)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_commodity ON resource_deposits(primary_commodity_id)',

    // Extraction operations
    'CREATE INDEX IF NOT EXISTS idx_extraction_deposit ON extraction_operations(deposit_id)',
    'CREATE INDEX IF NOT EXISTS idx_extraction_operator ON extraction_operations(operator_id)',

    // Trading companies
    'CREATE INDEX IF NOT EXISTS idx_companies_campaign ON trading_companies(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_companies_hq ON trading_companies(headquarters_settlement_id)',

    // Trade route programs
    'CREATE INDEX IF NOT EXISTS idx_programs_campaign ON trade_route_programs(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_programs_company ON trade_route_programs(company_id)',

    // Caravans
    'CREATE INDEX IF NOT EXISTS idx_caravans_route ON caravans(route_id)',
    'CREATE INDEX IF NOT EXISTS idx_caravans_company ON caravans(company_id)',
    'CREATE INDEX IF NOT EXISTS idx_caravans_location ON caravans(current_settlement_id)',

    // Freight contracts
    'CREATE INDEX IF NOT EXISTS idx_freight_campaign ON freight_contracts(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_freight_carrier ON freight_contracts(carrier_id)',
    'CREATE INDEX IF NOT EXISTS idx_freight_status ON freight_contracts(status)',

    // Market events
    'CREATE INDEX IF NOT EXISTS idx_market_events_campaign ON market_events(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_market_events_settlement ON market_events(settlement_id)',

    // Economic events
    'CREATE INDEX IF NOT EXISTS idx_econ_events_campaign ON economic_events(campaign_id)',

    // Trade routes
    'CREATE INDEX IF NOT EXISTS idx_trade_routes_campaign ON trade_routes(campaign_id)',
  ],
};
