/**
 * MIGRATION 012: Social Contract Engine
 *
 * The obligation graph - what binds people together.
 *
 * Marriage is just one contract type. So are:
 * - Patronage, oaths, apprenticeships
 * - Vassalage, hostage treaties
 * - Trade partnerships, guild memberships
 * - Religious vows, blood debts
 *
 * This gives us:
 * - Social fabric (stable obligations)
 * - Lineage (inheritance legitimacy)
 * - Faction leverage (policy + coercion)
 * - Emergent drama (without scripted content)
 *
 * Key design: Contracts are truth (evented), households are projections.
 */

export const MIGRATION_012_SOCIAL = {
  version: 12,
  name: '012_social',
  tables: [
    // ============================================
    // SOCIAL CONTRACTS (obligation graph edges)
    // ============================================
    {
      name: 'social_contracts',
      sql: `
        CREATE TABLE IF NOT EXISTS social_contracts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Contract type (marriage, oath, apprenticeship, vassalage, etc.)
          contract_type TEXT NOT NULL,
          subtype TEXT,

          -- Parties involved (JSON array of {entity_type, entity_id, role})
          -- Roles: "spouse", "patron", "client", "master", "apprentice", "lord", "vassal", etc.
          parties TEXT NOT NULL DEFAULT '[]',

          -- Terms of the contract (JSON)
          -- Obligations, rights, conditions, duration
          terms TEXT DEFAULT '{}',

          -- Visibility
          -- public: known to all, enforceable by authorities
          -- private: known to parties, enforceable by reputation/honor
          -- secret: unknown, enforceable only by parties (blackmail, assassination)
          visibility TEXT DEFAULT 'public',

          -- Enforcement
          -- jurisdiction that can enforce (faction, court, church, guild)
          jurisdiction_id TEXT,
          jurisdiction_type TEXT,

          -- Registration (if public/official)
          registered_at TEXT,
          registered_by TEXT,
          registry_node_id TEXT REFERENCES world_nodes(id),

          -- Status
          status TEXT DEFAULT 'active',

          -- Timeline
          proposed_at TEXT,
          ratified_at TEXT,
          start_at TEXT NOT NULL,
          end_at TEXT,
          terminated_at TEXT,
          termination_reason TEXT,

          -- World time context
          world_timestamp_start TEXT,
          world_timestamp_end TEXT,

          -- Breach tracking
          breach_count INTEGER DEFAULT 0,
          last_breach_at TEXT,

          -- Link to sync log
          sync_log_id TEXT REFERENCES sync_log(id),

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // CONTRACT EVENTS (append-only ledger)
    // ============================================
    {
      name: 'social_contract_events',
      sql: `
        CREATE TABLE IF NOT EXISTS social_contract_events (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL REFERENCES social_contracts(id),
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- Event type
          event_type TEXT NOT NULL,
          -- PROPOSED, ACCEPTED, REJECTED, RATIFIED, WITNESSED
          -- BREACHED, ENFORCED, FORGIVEN, RENEGOTIATED
          -- FULFILLED, TERMINATED, EXPIRED, ANNULLED

          -- Who triggered this event
          actor_id TEXT,
          actor_type TEXT,
          actor_name TEXT,

          -- Event details (JSON)
          details TEXT DEFAULT '{}',

          -- Consequences applied (JSON array)
          consequences TEXT DEFAULT '[]',

          -- Witnesses (JSON array of entity refs)
          witnesses TEXT DEFAULT '[]',

          -- World timestamp
          world_timestamp TEXT,

          -- Link to sync log
          sync_log_id TEXT REFERENCES sync_log(id),

          timestamp TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // HOUSEHOLDS (durable social/economic units)
    // ============================================
    {
      name: 'households',
      sql: `
        CREATE TABLE IF NOT EXISTS households (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          type TEXT DEFAULT 'family',
          -- family, noble_house, merchant_house, guild_hall, temple, commune

          -- Head of household
          head_id TEXT,
          head_type TEXT,

          -- Location
          home_hub_id TEXT REFERENCES hubs(id),
          home_building_id TEXT REFERENCES hub_buildings(id),
          home_node_id TEXT REFERENCES world_nodes(id),

          -- Social standing
          standing TEXT DEFAULT 'common',
          -- destitute, poor, common, comfortable, wealthy, noble, royal

          standing_tags TEXT DEFAULT '[]',
          -- ["landed", "titled", "merchant_guild", "clergy", "criminal"]

          -- Shared resources
          treasury INTEGER DEFAULT 0,
          shared_inventory_id TEXT,

          -- Property (JSON array of property refs)
          properties TEXT DEFAULT '[]',

          -- Heraldry / symbols
          heraldry TEXT DEFAULT '{}',
          motto TEXT,

          -- Faction affiliations (JSON array)
          faction_ties TEXT DEFAULT '[]',

          -- Status
          status TEXT DEFAULT 'active',
          founded_at TEXT,
          dissolved_at TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // HOUSEHOLD MEMBERSHIPS (with intervals)
    // ============================================
    {
      name: 'household_memberships',
      sql: `
        CREATE TABLE IF NOT EXISTS household_memberships (
          id TEXT PRIMARY KEY,
          household_id TEXT NOT NULL REFERENCES households(id),

          -- Member
          member_id TEXT NOT NULL,
          member_type TEXT NOT NULL,
          -- character, npc, etc.

          -- Role in household
          role TEXT DEFAULT 'member',
          -- head, spouse, heir, child, ward, servant, retainer, guest

          -- Membership interval (for time travel queries)
          joined_at TEXT NOT NULL,
          joined_sync_version INTEGER,
          left_at TEXT,
          left_sync_version INTEGER,

          -- How they joined/left
          join_reason TEXT,
          leave_reason TEXT,
          -- birth, marriage, adoption, employment, death, divorce, exile, etc.

          -- Status
          active INTEGER DEFAULT 1,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // KINSHIP LINKS (family graph)
    // ============================================
    {
      name: 'kinship_links',
      sql: `
        CREATE TABLE IF NOT EXISTS kinship_links (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- The two related entities
          entity1_id TEXT NOT NULL,
          entity1_type TEXT NOT NULL,
          entity2_id TEXT NOT NULL,
          entity2_type TEXT NOT NULL,

          -- Relationship type (directional from entity1's perspective)
          relationship TEXT NOT NULL,
          -- parent, child, sibling, spouse, grandparent, grandchild
          -- uncle, aunt, nephew, niece, cousin

          -- Legitimacy
          legitimacy TEXT DEFAULT 'legitimate',
          -- legitimate, illegitimate, adopted, contested

          -- Source contract (marriage, adoption, etc.)
          source_contract_id TEXT REFERENCES social_contracts(id),

          -- Birth event (for parent/child)
          birth_event_id TEXT,

          -- Status
          status TEXT DEFAULT 'active',
          -- active, deceased, disowned, annulled

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // TITLES & ESTATES (inheritable positions)
    // ============================================
    {
      name: 'titles',
      sql: `
        CREATE TABLE IF NOT EXISTS titles (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          rank TEXT NOT NULL,
          -- emperor, king, duke, count, baron, knight, lord, mayor, guildmaster, etc.

          -- What faction/authority grants this title
          granting_faction_id TEXT REFERENCES factions(id),

          -- Territory/domain
          domain_node_id TEXT REFERENCES world_nodes(id),
          domain_name TEXT,

          -- Current holder
          holder_id TEXT,
          holder_type TEXT,
          holder_name TEXT,
          held_since TEXT,

          -- Inheritance rules (JSON)
          -- { "type": "primogeniture", "gender": "male_preference", "legitimacy_required": true }
          succession_rules TEXT DEFAULT '{}',

          -- Line of succession (JSON array of claimants)
          succession_line TEXT DEFAULT '[]',

          -- Rights granted (JSON array)
          rights TEXT DEFAULT '[]',
          -- ["collect_taxes", "administer_justice", "raise_levies", "grant_land"]

          -- Obligations (JSON array)
          obligations TEXT DEFAULT '[]',
          -- ["military_service", "tax_tribute", "court_attendance"]

          -- Status
          status TEXT DEFAULT 'active',
          -- active, vacant, disputed, abolished

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // CLAIMS (disputed succession/ownership)
    // ============================================
    {
      name: 'claims',
      sql: `
        CREATE TABLE IF NOT EXISTS claims (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          -- What is claimed
          target_type TEXT NOT NULL,
          -- title, estate, inheritance, contract_right
          target_id TEXT NOT NULL,

          -- Who claims it
          claimant_id TEXT NOT NULL,
          claimant_type TEXT NOT NULL,
          claimant_name TEXT,

          -- Basis for claim (JSON)
          -- { "type": "inheritance", "through": "character_id", "legitimacy": "contested" }
          basis TEXT DEFAULT '{}',

          -- Strength (0-100, affects AI faction behavior)
          strength INTEGER DEFAULT 50,

          -- Recognition (JSON array of factions that recognize this claim)
          recognized_by TEXT DEFAULT '[]',

          -- Opposed by (JSON array of factions/claimants)
          opposed_by TEXT DEFAULT '[]',

          -- Status
          status TEXT DEFAULT 'active',
          -- active, pressed, abandoned, resolved, rejected

          -- Resolution
          resolved_at TEXT,
          resolution TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // JURISDICTIONS (who enforces what, where)
    // ============================================
    {
      name: 'jurisdictions',
      sql: `
        CREATE TABLE IF NOT EXISTS jurisdictions (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id),

          name TEXT NOT NULL,
          type TEXT NOT NULL,
          -- royal_court, church, guild, city, tribal, divine, criminal

          -- Authority (who runs this jurisdiction)
          authority_id TEXT,
          authority_type TEXT,
          -- faction, deity, character

          -- Scope (where it applies)
          scope_node_id TEXT REFERENCES world_nodes(id),
          scope_type TEXT,
          -- region, hub, building, faction_members

          -- Power level (can override lower jurisdictions)
          precedence INTEGER DEFAULT 50,

          -- What contract types this jurisdiction recognizes
          recognized_contracts TEXT DEFAULT '[]',
          -- ["marriage", "vassalage", "guild_membership", "trade_agreement"]

          -- Enforcement capabilities (JSON)
          enforcement TEXT DEFAULT '{}',
          -- { "can_fine": true, "can_imprison": true, "can_exile": true, "can_execute": false }

          -- Registry (does this jurisdiction maintain records?)
          maintains_registry INTEGER DEFAULT 0,
          registry_types TEXT DEFAULT '[]',
          -- ["marriage", "land_deed", "guild_charter"]

          -- Status
          status TEXT DEFAULT 'active',

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },

    // ============================================
    // CONTRACT POLICIES (faction-specific rules)
    // ============================================
    {
      name: 'contract_policies',
      sql: `
        CREATE TABLE IF NOT EXISTS contract_policies (
          id TEXT PRIMARY KEY,
          jurisdiction_id TEXT NOT NULL REFERENCES jurisdictions(id),

          -- What contract type this policy applies to
          contract_type TEXT NOT NULL,

          -- Recognition rules (JSON)
          -- { "requires_registration": true, "requires_witnesses": 2, "minimum_age": 16 }
          recognition_rules TEXT DEFAULT '{}',

          -- Legitimacy rules for inheritance (JSON)
          -- { "illegitimate_can_inherit": false, "adopted_can_inherit": true }
          legitimacy_rules TEXT DEFAULT '{}',

          -- Breach penalties (JSON array)
          -- [{ "offense": "adultery", "penalty": "fine", "amount": 100 }]
          penalties TEXT DEFAULT '[]',

          -- Exceptions (JSON array)
          -- [{ "condition": "noble", "exemption": "public_registration" }]
          exceptions TEXT DEFAULT '[]',

          -- Termination rules (JSON)
          -- { "divorce_allowed": false, "annulment_grounds": ["non_consummation", "fraud"] }
          termination_rules TEXT DEFAULT '{}',

          -- Status
          status TEXT DEFAULT 'active',
          effective_from TEXT,
          effective_until TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `,
    },
  ],

  indexes: [
    // Social contracts
    'CREATE INDEX IF NOT EXISTS idx_contracts_campaign ON social_contracts(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_contracts_type ON social_contracts(contract_type)',
    'CREATE INDEX IF NOT EXISTS idx_contracts_status ON social_contracts(status)',
    'CREATE INDEX IF NOT EXISTS idx_contracts_jurisdiction ON social_contracts(jurisdiction_id)',
    'CREATE INDEX IF NOT EXISTS idx_contracts_sync ON social_contracts(sync_log_id)',

    // Contract events
    'CREATE INDEX IF NOT EXISTS idx_contract_events_contract ON social_contract_events(contract_id)',
    'CREATE INDEX IF NOT EXISTS idx_contract_events_campaign ON social_contract_events(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_contract_events_type ON social_contract_events(event_type)',
    'CREATE INDEX IF NOT EXISTS idx_contract_events_actor ON social_contract_events(actor_id)',
    'CREATE INDEX IF NOT EXISTS idx_contract_events_sync ON social_contract_events(sync_log_id)',

    // Households
    'CREATE INDEX IF NOT EXISTS idx_households_campaign ON households(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_households_hub ON households(home_hub_id)',
    'CREATE INDEX IF NOT EXISTS idx_households_head ON households(head_id)',
    'CREATE INDEX IF NOT EXISTS idx_households_standing ON households(standing)',

    // Household memberships
    'CREATE INDEX IF NOT EXISTS idx_hh_members_household ON household_memberships(household_id)',
    'CREATE INDEX IF NOT EXISTS idx_hh_members_member ON household_memberships(member_id, member_type)',
    'CREATE INDEX IF NOT EXISTS idx_hh_members_active ON household_memberships(active)',

    // Kinship links
    'CREATE INDEX IF NOT EXISTS idx_kinship_campaign ON kinship_links(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_kinship_entity1 ON kinship_links(entity1_id, entity1_type)',
    'CREATE INDEX IF NOT EXISTS idx_kinship_entity2 ON kinship_links(entity2_id, entity2_type)',
    'CREATE INDEX IF NOT EXISTS idx_kinship_relationship ON kinship_links(relationship)',
    'CREATE INDEX IF NOT EXISTS idx_kinship_contract ON kinship_links(source_contract_id)',

    // Titles
    'CREATE INDEX IF NOT EXISTS idx_titles_campaign ON titles(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_titles_holder ON titles(holder_id)',
    'CREATE INDEX IF NOT EXISTS idx_titles_faction ON titles(granting_faction_id)',
    'CREATE INDEX IF NOT EXISTS idx_titles_domain ON titles(domain_node_id)',
    'CREATE INDEX IF NOT EXISTS idx_titles_rank ON titles(rank)',

    // Claims
    'CREATE INDEX IF NOT EXISTS idx_claims_campaign ON claims(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_claims_target ON claims(target_type, target_id)',
    'CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id)',
    'CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)',

    // Jurisdictions
    'CREATE INDEX IF NOT EXISTS idx_jurisdictions_campaign ON jurisdictions(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_jurisdictions_authority ON jurisdictions(authority_id)',
    'CREATE INDEX IF NOT EXISTS idx_jurisdictions_scope ON jurisdictions(scope_node_id)',
    'CREATE INDEX IF NOT EXISTS idx_jurisdictions_type ON jurisdictions(type)',

    // Contract policies
    'CREATE INDEX IF NOT EXISTS idx_policies_jurisdiction ON contract_policies(jurisdiction_id)',
    'CREATE INDEX IF NOT EXISTS idx_policies_type ON contract_policies(contract_type)',
  ],
};
