/**
 * MIGRATION 015: Top-End Economy - Services & Contracts
 *
 * Services are the core abstraction:
 * - Banking, PMC, Legal, Logistics, Artisan, etc.
 * - Pricing is deterministic and derived
 * - Guarantees/risk contracts exist as formal contracts
 * - NPC time slots are consumed by service execution
 *
 * Non-negotiable invariants:
 * - No global mutable state
 * - Delta-driven truth (all changes via writeDelta)
 * - Observation-scoped simulation (run only when queried)
 * - Power never erases consequences (only delay/reassign/concentrate)
 * - NPCs are first-class agents with schedules
 */

export const MIGRATION_015_ECONOMY_SERVICES_CONTRACTS = {
  version: 15,
  name: '015_economy_services_contracts',
  tables: [
    // ============================================
    // SERVICE PROVIDERS
    // ============================================
    //
    // Any entity that can offer services:
    // - Banks (custody, loans, escrow)
    // - PMCs (escort, retainer, security)
    // - Legal (representation, arbitration)
    // - Logistics (coordination, warehousing)
    // - Artisans (crafting, repair)
    // - Discretion services (information, anonymity)
    //
    // Provider capability emerges from tier, not hard flags.
    //
    {
      name: 'service_providers',
      sql: `
        CREATE TABLE IF NOT EXISTS service_providers (
          id TEXT PRIMARY KEY,
          hub_id TEXT NOT NULL,

          -- Operator (mutually exclusive - only one set)
          npc_id TEXT REFERENCES characters(id),
          faction_id TEXT REFERENCES factions(id),

          -- Provider classification
          -- bank, pmc, legal, logistics, artisan, discretion, temple, guild
          provider_type TEXT NOT NULL,

          -- Uses MERCHANT_TIER_REQUIREMENTS from markets/schema.ts
          -- peddler, stall, shop, emporium, trading_house, consortium, megamart
          merchant_tier TEXT NOT NULL DEFAULT 'stall',

          -- Fame score affects pricing (demand premium) and trust (lower risk premium)
          -- 0-100, derived from completed contracts and public events
          fame_score INTEGER NOT NULL DEFAULT 0,

          -- Liquid capital in GP
          -- Determines max contract sizes, risk capacity
          capital_gp REAL NOT NULL DEFAULT 0,

          -- Licenses JSON array of strings
          -- e.g. ["banking_license", "weapons_permit", "legal_charter"]
          licenses TEXT NOT NULL DEFAULT '[]',

          -- Service catalog: which ServiceTypes this provider offers
          -- JSON array of ServiceType strings
          offered_services TEXT NOT NULL DEFAULT '[]',

          -- Operating hours (links to NPC schedule if npc_id set)
          -- JSON: { openSlot: number, closeSlot: number, daysActive: number[] }
          operating_hours TEXT NOT NULL DEFAULT '{}',

          -- Status
          status TEXT NOT NULL DEFAULT 'active',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,

          -- Constraints
          CHECK (
            (npc_id IS NOT NULL AND faction_id IS NULL) OR
            (npc_id IS NULL AND faction_id IS NOT NULL)
          ),
          CHECK (fame_score >= 0 AND fame_score <= 100),
          CHECK (capital_gp >= 0),
          CHECK (merchant_tier IN ('peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium', 'megamart')),
          CHECK (status IN ('active', 'suspended', 'closed', 'bankrupt'))
        )
      `,
    },

    // ============================================
    // SERVICE CONTRACTS
    // ============================================
    //
    // A contract between a provider and a client for a specific service.
    // Two-phase commit: proposed -> active -> completed/failed/cancelled
    //
    // Service execution consumes NPC time slots.
    // All outcomes are deltas into canonical timeline.
    //
    {
      name: 'service_contracts',
      sql: `
        CREATE TABLE IF NOT EXISTS service_contracts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          provider_id TEXT NOT NULL REFERENCES service_providers(id),

          -- Client: who is paying for the service
          -- One of: npc, character, party, faction
          client_entity_id TEXT NOT NULL,
          client_entity_type TEXT NOT NULL,

          -- Service classification
          -- banking_custody, loan, escrow, guarantee, insurance,
          -- pmc_escort, pmc_retainer, pmc_security,
          -- legal_representation, legal_arbitration,
          -- logistics_coordination, logistics_storage,
          -- artisan_craft, artisan_repair,
          -- discretion_service, information_brokering
          service_type TEXT NOT NULL,

          -- Scope: what/who/where is affected
          -- JSON: { hubIds?: string[], routeIds?: string[], entityIds?: string[], description?: string }
          scope TEXT NOT NULL DEFAULT '{}',

          -- Timeline (WorldTimestamp JSON)
          start_time TEXT NOT NULL,
          end_time TEXT,

          -- Urgency affects pricing and slot consumption
          -- routine (normal), priority (+50% cost, faster), emergency (+200% cost, immediate)
          urgency TEXT NOT NULL DEFAULT 'routine',

          -- Visibility policy: who can know about this contract
          -- JSON: { public: boolean, visibleTo: string[], hiddenFrom: string[] }
          visibility_policy TEXT NOT NULL DEFAULT '{"public": true}',

          -- Status lifecycle: proposed -> active -> completed/failed/cancelled
          status TEXT NOT NULL DEFAULT 'proposed',

          -- Pricing (derived from pricing.ts at quote time, locked at activation)
          base_quote_gp REAL NOT NULL,
          final_cost_gp REAL,

          -- Execution metadata
          -- JSON: { slotsConsumed: number, executorNpcId?: string, executionNotes?: string[] }
          execution_metadata TEXT NOT NULL DEFAULT '{}',

          -- Outcome: what happened
          -- JSON: { success: boolean, outcome: string, deltasWritten: string[] }
          outcome TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,

          CHECK (client_entity_type IN ('npc', 'character', 'party', 'faction')),
          CHECK (urgency IN ('routine', 'priority', 'emergency')),
          CHECK (status IN ('proposed', 'active', 'completed', 'failed', 'cancelled'))
        )
      `,
    },

    // ============================================
    // RISK CONTRACTS (Insurance)
    // ============================================
    //
    // Insurance against specific event types.
    // Power never erases consequences - only transfers cost.
    //
    // Payout triggers on matching event deltas.
    // Exclusions and limits are strictly enforced.
    //
    {
      name: 'risk_contracts',
      sql: `
        CREATE TABLE IF NOT EXISTS risk_contracts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          provider_id TEXT NOT NULL REFERENCES service_providers(id),

          -- Policyholder
          client_entity_id TEXT NOT NULL,
          client_entity_type TEXT NOT NULL,

          -- Coverage: what events are covered
          -- JSON array of event type strings
          -- e.g. ["cargo_loss", "route_attack", "theft", "fire", "death"]
          covered_event_types TEXT NOT NULL DEFAULT '[]',

          -- Monetary limits
          coverage_limit_gp REAL NOT NULL,
          premium_gp REAL NOT NULL,

          -- Exclusions: what is NOT covered
          -- JSON array: [{ eventType: string, conditions: string }]
          exclusions TEXT NOT NULL DEFAULT '[]',

          -- Collateral: assets held by provider as security
          -- JSON array: [{ assetType: string, assetId: string, value: number }]
          collateral TEXT NOT NULL DEFAULT '[]',

          -- Timeline (WorldTimestamp JSON)
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,

          -- Status
          status TEXT NOT NULL DEFAULT 'active',

          -- Claims history
          -- JSON array: [{ claimId: string, eventType: string, amount: number, status: string }]
          claims TEXT NOT NULL DEFAULT '[]',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,

          CHECK (client_entity_type IN ('npc', 'character', 'party', 'faction')),
          CHECK (coverage_limit_gp > 0),
          CHECK (premium_gp > 0),
          CHECK (status IN ('active', 'expired', 'cancelled', 'claimed_out'))
        )
      `,
    },

    // ============================================
    // GUARANTEE CONTRACTS
    // ============================================
    //
    // A guarantor backs another contract.
    // If the obligor fails, the guarantor must perform.
    //
    // Enforcement methods: payment, seizure, legal_action, pmc_action
    // These create service_contracts when triggered.
    //
    {
      name: 'guarantee_contracts',
      sql: `
        CREATE TABLE IF NOT EXISTS guarantee_contracts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,

          -- The entity providing the guarantee
          guarantor_provider_id TEXT NOT NULL REFERENCES service_providers(id),

          -- What contract is being guaranteed
          -- Can be a service_contract, loan, trade agreement, etc.
          covered_contract_id TEXT NOT NULL,
          covered_contract_type TEXT NOT NULL,

          -- The party who must perform (whose failure triggers guarantee)
          obligor_entity_id TEXT NOT NULL,
          obligor_entity_type TEXT NOT NULL,

          -- The party who benefits if guarantee is invoked
          beneficiary_entity_id TEXT NOT NULL,
          beneficiary_entity_type TEXT NOT NULL,

          -- What failures trigger the guarantee
          -- JSON array: [{ failureType: string, description: string }]
          covered_failures TEXT NOT NULL DEFAULT '[]',

          -- Monetary limit
          guarantee_limit_gp REAL NOT NULL,

          -- How guarantee is enforced if triggered
          -- payment: guarantor pays beneficiary
          -- seizure: guarantor seizes obligor's collateral
          -- legal_action: creates legal service contract
          -- pmc_action: creates PMC service contract
          enforcement_method TEXT NOT NULL,

          -- Collateral held by guarantor
          -- JSON array: [{ assetType: string, assetId: string, value: number, heldBy: string }]
          collateral TEXT NOT NULL DEFAULT '[]',

          -- Visibility: who knows this guarantee exists
          -- JSON: { public: boolean, visibleTo: string[] }
          visibility_policy TEXT NOT NULL DEFAULT '{"public": false}',

          -- Timeline (WorldTimestamp JSON)
          expiration_time TEXT NOT NULL,

          -- Status
          status TEXT NOT NULL DEFAULT 'active',

          -- If triggered, what happened
          -- JSON: { triggeredAt: string, reason: string, enforcementContractId?: string }
          trigger_metadata TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,

          CHECK (covered_contract_type IN ('service_contract', 'loan', 'trade', 'custom')),
          CHECK (obligor_entity_type IN ('npc', 'character', 'party', 'faction')),
          CHECK (beneficiary_entity_type IN ('npc', 'character', 'party', 'faction')),
          CHECK (guarantee_limit_gp > 0),
          CHECK (enforcement_method IN ('payment', 'seizure', 'legal_action', 'pmc_action')),
          CHECK (status IN ('active', 'expired', 'triggered', 'released'))
        )
      `,
    },

    // ============================================
    // SERVICE EXECUTION LOG
    // ============================================
    //
    // Tracks NPC time slot consumption for services.
    // Links service execution to NPC schedules.
    //
    // Even failed services consume time.
    //
    {
      name: 'service_execution_log',
      sql: `
        CREATE TABLE IF NOT EXISTS service_execution_log (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,

          -- Which contract is being executed
          service_contract_id TEXT NOT NULL REFERENCES service_contracts(id),

          -- Which NPC is doing the work
          executor_npc_id TEXT NOT NULL,

          -- Time slot consumption (WorldTimestamp JSON)
          slot_start TEXT NOT NULL,
          slot_end TEXT NOT NULL,
          slots_consumed INTEGER NOT NULL,

          -- What happened in this execution window
          -- JSON: { actions: string[], outcome: string, deltasWritten: string[] }
          execution_result TEXT NOT NULL DEFAULT '{}',

          -- Did this succeed or fail?
          success INTEGER NOT NULL DEFAULT 1,

          created_at TEXT NOT NULL,

          CHECK (slots_consumed > 0)
        )
      `,
    },
  ],

  indexes: [
    // Service providers
    'CREATE INDEX IF NOT EXISTS idx_service_providers_hub ON service_providers(hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_providers_npc ON service_providers(npc_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_providers_faction ON service_providers(faction_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_providers_type ON service_providers(provider_type)',
    'CREATE INDEX IF NOT EXISTS idx_service_providers_tier ON service_providers(merchant_tier)',
    'CREATE INDEX IF NOT EXISTS idx_service_providers_status ON service_providers(status)',

    // Service contracts
    'CREATE INDEX IF NOT EXISTS idx_service_contracts_campaign ON service_contracts(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_contracts_provider ON service_contracts(provider_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_contracts_client ON service_contracts(client_entity_id, client_entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_service_contracts_type ON service_contracts(service_type)',
    'CREATE INDEX IF NOT EXISTS idx_service_contracts_status ON service_contracts(status)',

    // Risk contracts
    'CREATE INDEX IF NOT EXISTS idx_risk_contracts_campaign ON risk_contracts(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_risk_contracts_provider ON risk_contracts(provider_id)',
    'CREATE INDEX IF NOT EXISTS idx_risk_contracts_client ON risk_contracts(client_entity_id, client_entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_risk_contracts_status ON risk_contracts(status)',

    // Guarantee contracts
    'CREATE INDEX IF NOT EXISTS idx_guarantee_contracts_campaign ON guarantee_contracts(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_contracts_guarantor ON guarantee_contracts(guarantor_provider_id)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_contracts_covered ON guarantee_contracts(covered_contract_id)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_contracts_obligor ON guarantee_contracts(obligor_entity_id, obligor_entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_contracts_beneficiary ON guarantee_contracts(beneficiary_entity_id, beneficiary_entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_contracts_status ON guarantee_contracts(status)',

    // Execution log
    'CREATE INDEX IF NOT EXISTS idx_service_execution_log_campaign ON service_execution_log(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_execution_log_contract ON service_execution_log(service_contract_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_execution_log_executor ON service_execution_log(executor_npc_id)',
  ],
};
