import { z } from "zod";

// ============================================
// WORLD GRAPH SCHEMA
// ============================================
//
// ARCHITECTURE DECISION: Graph-on-SQL
//
// WHY NOT PURE RELATIONAL:
//   - Kara-Tur has honor_system, Sword Coast has guild_reputation
//   - Spelljammer has gravity planes, Faerûn has Weave magic
//   - 30 years of D&D = infinite variety
//   - Schema migrations across 50+ JSON seed files = nightmare
//
// WHY NOT PURE DOCUMENT:
//   - We need to traverse relationships efficiently
//   - "All factions present in Waterdeep" needs fast queries
//   - Pathfinding through trade routes, portals, orbits
//
// SOLUTION: Graph-on-SQL
//   - world_nodes: The skeleton (typed, indexed)
//   - world_edges: The nervous system (relationships)
//   - data_static: JSON for flexibility (culture, physics, lore)
//   - Inheritance: Children inherit parent traits unless overridden
//

// ============================================
// NODE TYPES
// ============================================

export const WorldNodeTypeSchema = z.enum([
  // Cosmic Scale (Spelljammer)
  "multiverse", // The container of all reality
  "crystal_sphere", // Realmspace, Greyspace, Krynnspace
  "phlogiston", // The Flow between spheres
  "wildspace", // Space within a sphere

  // Celestial Bodies
  "star", // Suns
  "planet", // Toril, Oerth, Krynn
  "moon", // Selûne
  "asteroid", // Rock of Bral
  "anomaly", // Dead gods, living ships, weird stuff

  // Planar
  "plane", // Outer/Inner planes
  "demiplane", // Pocket dimensions
  "planar_layer", // Nine Hells layers, etc.

  // Geographic
  "continent", // Faerûn, Kara-Tur, Maztica
  "region", // Sword Coast, Wa, Cormyr
  "subregion", // High Forest, Mere of Dead Men

  // Political/Cultural
  "nation", // Kingdom of Cormyr, Empire of Shou Lung
  "territory", // Tribal lands, claimed wilderness

  // Settlements
  "metropolis", // Waterdeep, Calimport
  "city", // Baldur's Gate, Neverwinter
  "town", // Phandalin, Triboar
  "village", // Barovia village
  "hamlet", // Tiny settlements
  "outpost", // Forts, trading posts

  // Locations
  "district", // City ward, neighborhood
  "landmark", // Famous location within settlement
  "dungeon", // Adventure site
  "wilderness_site", // Ruins, lairs, sacred groves
  "building", // Specific structure

  // Special
  "ship", // Spelljammer vessels
  "mobile", // Moving locations (caravans, nomad camps)
]);
export type WorldNodeType = z.infer<typeof WorldNodeTypeSchema>;

// ============================================
// EDGE TYPES
// ============================================

export const WorldEdgeTypeSchema = z.enum([
  // Hierarchy
  "CONTAINS", // Parent contains child (Faerûn CONTAINS Sword Coast)

  // Geographic
  "BORDERS", // Geographic adjacency
  "TRADE_ROUTE", // Commercial connection
  "ROAD", // Physical path
  "RIVER", // Waterway connection
  "SEA_ROUTE", // Ocean travel

  // Cosmic (Spelljammer)
  "ORBIT", // Celestial body orbits another
  "FLOW_RIVER", // Phlogiston current between spheres
  "PORTAL", // Magical connection

  // Planar
  "PLANAR_GATE", // Connection between planes
  "MANIFEST_ZONE", // Plane bleeds into another
  "COTERMINOUS", // Planes touch

  // Political
  "GOVERNS", // Political control
  "VASSAL_OF", // Feudal relationship
  "ALLIED_WITH", // Political alliance
  "AT_WAR_WITH", // Active conflict
  "TREATY_WITH", // Formal agreement

  // Faction
  "FACTION_PRESENCE", // Faction operates here
  "FACTION_HQ", // Faction headquarters
  "FACTION_CONFLICT", // Factions fighting over location

  // Cultural
  "CULTURAL_TIE", // Shared culture/heritage
  "RELIGIOUS_TIE", // Shared religion
  "TRADE_PARTNER", // Economic relationship

  // Narrative
  "HISTORICAL_EVENT", // Something happened connecting these
  "PROPHECY_LINK", // Tied by prophecy
  "SECRET_CONNECTION", // Hidden relationship
]);
export type WorldEdgeType = z.infer<typeof WorldEdgeTypeSchema>;

// ============================================
// COSMIC PHYSICS
// ============================================
//
// The physical laws that govern a node.
// Children inherit unless they override.
//

export const CosmicPhysicsSchema = z.object({
  // Gravity
  gravity: z
    .object({
      type: z
        .enum([
          "standard", // Normal (1g, down)
          "none", // Weightless
          "low", // Reduced
          "high", // Increased
          "variable", // Changes
          "directional", // Pulls toward something
          "subjective", // Based on perception
          "localized", // Spelljammer ship gravity planes
        ])
        .default("standard"),

      // For non-standard gravity
      strength: z.number().optional(), // Multiplier (0.5 = half)
      direction: z.string().optional(), // "toward_center", "toward_sun", etc.
      notes: z.string().optional(),
    })
    .optional(),

  // Air/Atmosphere
  atmosphere: z
    .object({
      type: z
        .enum([
          "standard", // Breathable
          "none", // Vacuum
          "thin", // High altitude
          "thick", // Dense
          "toxic", // Poisonous
          "magical", // Magically sustained
          "elemental", // Plane of Air, etc.
        ])
        .default("standard"),

      // Spelljammer air envelope
      envelope: z
        .object({
          enabled: z.boolean().default(false),
          fresh_duration: z.string().optional(), // "3 months per crew"
          foul_duration: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  // Magic
  magic: z
    .object({
      level: z
        .enum([
          "dead", // No magic functions
          "low", // Magic is rare/weak
          "standard", // Normal D&D
          "high", // Magic is common
          "wild", // Unpredictable
          "enhanced", // Magic is stronger
          "twisted", // Magic works differently
        ])
        .default("standard"),

      // The source
      source: z.string().optional(), // "The Weave", "Spirits", "Ley Lines"

      // School modifiers
      schoolModifiers: z
        .record(
          z.string(),
          z.object({
            modifier: z.enum(["enhanced", "impeded", "blocked", "wild"]),
            notes: z.string().optional(),
          }),
        )
        .optional(),

      // Special rules
      specialRules: z.array(z.string()).default([]),
    })
    .optional(),

  // Time
  time: z
    .object({
      flow: z
        .enum([
          "standard", // Normal
          "accelerated", // Faster than material
          "decelerated", // Slower
          "static", // Frozen
          "variable", // Changes
          "nonlinear", // Weird
        ])
        .default("standard"),

      ratio: z.string().optional(), // "1 day = 1 year"
      notes: z.string().optional(),
    })
    .optional(),

  // Morphic (how mutable is reality)
  morphic: z
    .object({
      type: z
        .enum([
          "static", // Unchanging
          "standard", // Normal physics
          "magically_morphic", // Spells can alter
          "divinely_morphic", // Gods can alter
          "highly_morphic", // Thoughts alter
          "sentient", // The plane has will
        ])
        .default("standard"),
    })
    .optional(),

  // Spelljammer specific
  spelljammer: z
    .object({
      enabled: z.boolean().default(false),

      // Phlogiston rules
      phlogiston: z
        .object({
          accessible: z.boolean().default(false),
          fireRisk: z.boolean().default(true), // Fire = explosion
        })
        .optional(),

      // Crystal shell
      crystalShell: z
        .object({
          exists: z.boolean().default(false),
          portalLocations: z.array(z.string()).default([]),
        })
        .optional(),
    })
    .optional(),
});
export type CosmicPhysics = z.infer<typeof CosmicPhysicsSchema>;

// ============================================
// CULTURAL TRAITS
// ============================================
//
// The cultural/social context of a node.
// This is where Kara-Tur differs from Sword Coast.
//

export const CulturalTraitsSchema = z.object({
  // Technology level (for shop/item generation)
  techLevel: z
    .enum([
      "stone_age",
      "bronze_age",
      "iron_age",
      "medieval", // Standard D&D
      "renaissance", // Gunpowder, clockwork
      "magipunk", // Eberron-style
      "spelljammer", // Space-faring
    ])
    .optional(),

  // Calendar system (for UI date rendering)
  calendarSystem: z
    .object({
      name: z.string(), // "Calendar of Harptos", "Rokugani Calendar"
      type: z.string().optional(), // "solar", "lunar", "mixed"
      months: z.array(z.string()).optional(), // Month names
      currentYear: z.number().int().optional(),
      yearName: z.string().optional(), // "Year of the Scarlet Witch"
      notes: z.string().optional(),
    })
    .optional(),

  // Social structure
  socialStructure: z
    .object({
      type: z.string().optional(), // "feudal", "merchant_republic", "theocracy"
      hierarchy: z.array(z.string()).default([]), // ["Emperor", "Daimyo", "Samurai", "Peasant"]
      mobility: z.string().optional(), // "rigid", "fluid", "caste"
    })
    .optional(),

  // Honor/Reputation systems
  honorSystem: z
    .object({
      enabled: z.boolean().default(false),
      name: z.string().optional(), // "Face", "Honor", "Reputation"
      mechanics: z
        .object({
          gainedBy: z.array(z.string()).default([]),
          lostBy: z.array(z.string()).default([]),
          effects: z.array(z.string()).default([]),
        })
        .optional(),
    })
    .optional(),

  // Law and order
  law: z
    .object({
      system: z.string().optional(), // "codified", "tribal", "divine"
      enforcement: z.string().optional(), // "city_watch", "samurai", "inquisition"
      punishment: z.array(z.string()).default([]),
      corruption: z.string().optional(), // "low", "moderate", "rampant"
    })
    .optional(),

  // Economy
  economy: z
    .object({
      type: z.string().optional(), // "mercantile", "agrarian", "raiding"
      currency: z.string().optional(), // "gold pieces", "jade coins", "barter"
      tradeGoods: z.array(z.string()).default([]),
      wealthDistribution: z.string().optional(), // "equal", "stratified", "extreme"
    })
    .optional(),

  // Religion
  religion: z
    .object({
      type: z.string().optional(), // "polytheistic", "animist", "ancestor_worship"
      dominantFaiths: z.array(z.string()).default([]),
      tolerance: z.string().optional(), // "tolerant", "state_religion", "persecuting"
      practices: z.array(z.string()).default([]),
    })
    .optional(),

  // Language
  languages: z
    .object({
      common: z.string().optional(), // The lingua franca
      official: z.array(z.string()).default([]),
      regional: z.array(z.string()).default([]),
    })
    .optional(),

  // Customs (freeform for variety)
  customs: z.record(z.string(), z.any()).optional(),

  // Taboos
  taboos: z.array(z.string()).default([]),

  // Attitudes
  attitudes: z
    .object({
      towardsMagic: z.string().optional(),
      towardsOutsiders: z.string().optional(),
      towardsUndead: z.string().optional(),
      towardsDivine: z.string().optional(),
    })
    .optional(),
});
export type CulturalTraits = z.infer<typeof CulturalTraitsSchema>;

// ============================================
// WORLD NODE
// ============================================
//
// The core entity in our graph.
// Type discriminated with flexible JSON payload.
//

export const WorldNodeSchema = z.object({
  // === INDEXED COLUMNS (for queries) ===
  id: z.string().uuid(),
  parentId: z.string().uuid().optional(), // Direct parent for hierarchy
  type: WorldNodeTypeSchema,

  // Identity (indexed for search)
  name: z.string(),
  canonicalName: z.string().optional(), // For deduplication

  // Quick filters (indexed)
  sphereId: z.string().uuid().optional(), // Which crystal sphere
  planetId: z.string().uuid().optional(), // Which planet
  continentId: z.string().uuid().optional(), // Which continent
  regionId: z.string().uuid().optional(), // Which region

  // Flags (indexed for filtering)
  isSeeded: z.boolean().default(false),
  isCanonical: z.boolean().default(true), // Official vs homebrew
  isHidden: z.boolean().default(false), // GM-only

  // === JSON COLUMN: data_static ===
  // This is where the flexibility lives.
  // DO NOT NORMALIZE THIS.
  dataStatic: z.object({
    // Alternate names
    alternateNames: z.array(z.string()).default([]),

    // Description (always present)
    description: z.string().optional(),
    shortDescription: z.string().optional(),

    // Physical (for geographic nodes)
    physical: z
      .object({
        size: z.string().optional(),
        climate: z.string().optional(),
        terrain: z.array(z.string()).default([]),
        features: z.array(z.string()).default([]),
      })
      .optional(),

    // Cosmic physics (inheritable)
    physics: CosmicPhysicsSchema.optional(),

    // Cultural traits (inheritable)
    culture: CulturalTraitsSchema.optional(),

    // Population (for settlements)
    population: z
      .object({
        count: z.number().int().optional(),
        description: z.string().optional(),
        demographics: z.record(z.string(), z.number()).optional(), // {"human": 70, "dwarf": 15}
      })
      .optional(),

    // Government (for political entities)
    government: z
      .object({
        type: z.string().optional(),
        ruler: z.string().optional(),
        rulerTitle: z.string().optional(),
        rulingBody: z.string().optional(),
        succession: z.string().optional(),
      })
      .optional(),

    // Military (for nations/settlements)
    military: z
      .object({
        strength: z.string().optional(),
        composition: z.array(z.string()).default([]),
        specialUnits: z.array(z.string()).default([]),
      })
      .optional(),

    // Economy
    economy: z
      .object({
        type: z.string().optional(),
        exports: z.array(z.string()).default([]),
        imports: z.array(z.string()).default([]),
        resources: z.array(z.string()).default([]),
        wealthLevel: z.string().optional(),
      })
      .optional(),

    // History
    history: z
      .object({
        founded: z.string().optional(),
        founder: z.string().optional(),
        ages: z
          .array(
            z.object({
              name: z.string(),
              period: z.string().optional(),
              description: z.string().optional(),
            }),
          )
          .default([]),
        majorEvents: z
          .array(
            z.object({
              date: z.string().optional(),
              name: z.string(),
              description: z.string().optional(),
            }),
          )
          .default([]),
      })
      .optional(),

    // Landmarks (for settlements/regions)
    landmarks: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          description: z.string().optional(),
        }),
      )
      .default([]),

    // For celestial bodies (Spelljammer)
    celestial: z
      .object({
        bodyType: z.string().optional(), // "earth", "fire", "gas giant"
        orbitPeriod: z.string().optional(),
        moons: z.number().int().optional(),
        rings: z.boolean().optional(),
        inhabitants: z.string().optional(),
      })
      .optional(),

    // For ships (Spelljammer)
    ship: z
      .object({
        class: z.string().optional(), // "Hammership", "Nautiloid"
        tonnage: z.number().int().optional(),
        crew: z
          .object({
            min: z.number().int(),
            max: z.number().int(),
          })
          .optional(),
        weapons: z.array(z.string()).default([]),
        speed: z.string().optional(),
      })
      .optional(),

    // Adventure hooks
    hooks: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          level: z.string().optional(),
          tags: z.array(z.string()).default([]),
        }),
      )
      .default([]),

    // GM secrets
    secrets: z
      .array(
        z.object({
          secret: z.string(),
          revealCondition: z.string().optional(),
        }),
      )
      .default([]),

    // Source attribution
    source: z
      .object({
        book: z.string().optional(),
        page: z.string().optional(),
        edition: z.string().optional(),
      })
      .optional(),

    // Extension point - anything else
    custom: z.record(z.string(), z.any()).optional(),
  }),

  // === METADATA ===
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});
export type WorldNode = z.infer<typeof WorldNodeSchema>;

// ============================================
// WORLD EDGE
// ============================================
//
// Relationships between nodes.
// This is how factions connect to locations,
// trade routes connect cities, etc.
//

export const WorldEdgeSchema = z.object({
  // === INDEXED COLUMNS ===
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  type: WorldEdgeTypeSchema,

  // Bidirectional?
  bidirectional: z.boolean().default(true),

  // === JSON COLUMN: properties ===
  properties: z.object({
    // Common properties
    name: z.string().optional(),
    description: z.string().optional(),

    // Strength/importance of connection
    strength: z.enum(["weak", "moderate", "strong", "critical"]).optional(),

    // Status
    active: z.boolean().default(true),
    hidden: z.boolean().default(false), // GM-only knowledge

    // For TRADE_ROUTE
    trade: z
      .object({
        goods: z.array(z.string()).default([]),
        volume: z.string().optional(),
        dangerLevel: z.string().optional(),
        travelTime: z.string().optional(),
        controlledBy: z.string().optional(),
      })
      .optional(),

    // For PORTAL / PLANAR_GATE
    portal: z
      .object({
        permanent: z.boolean().default(false),
        twoWay: z.boolean().default(true),
        keyRequired: z.string().optional(),
        schedule: z.string().optional(), // "Opens on full moon"
        destination: z.string().optional(),
      })
      .optional(),

    // For ORBIT (Spelljammer)
    orbit: z
      .object({
        period: z.string().optional(),
        distance: z.string().optional(),
        eccentricity: z.string().optional(),
      })
      .optional(),

    // For FLOW_RIVER (Spelljammer phlogiston)
    flowRiver: z
      .object({
        direction: z.enum(["one_way", "two_way"]).optional(),
        travelTime: z.string().optional(),
        hazards: z.array(z.string()).default([]),
        stability: z.string().optional(),
      })
      .optional(),

    // For FACTION_PRESENCE (CRITICAL)
    faction: z
      .object({
        factionId: z.string().uuid(),
        factionName: z.string(),

        // How strong is their presence?
        influence: z.number().int().min(0).max(100).optional(),

        // How visible?
        visibility: z
          .enum(["secret", "rumored", "known", "prominent", "dominant"])
          .optional(),

        // What are they doing here?
        currentAgenda: z.string().optional(),
        activities: z.array(z.string()).default([]),

        // Assets
        assets: z
          .array(
            z.object({
              type: z.string(),
              name: z.string().optional(),
              description: z.string().optional(),
            }),
          )
          .default([]),

        // Key NPCs here
        notableMembers: z
          .array(
            z.object({
              npcId: z.string().uuid().optional(),
              name: z.string(),
              role: z.string(),
            }),
          )
          .default([]),

        // Relations with local power
        localRelations: z.string().optional(),
      })
      .optional(),

    // For political relationships
    political: z
      .object({
        nature: z.string().optional(), // "tributary", "alliance", "cold_war"
        since: z.string().optional(),
        terms: z.array(z.string()).default([]),
        stability: z.string().optional(),
      })
      .optional(),

    // For HISTORICAL_EVENT
    historical: z
      .object({
        date: z.string().optional(),
        event: z.string(),
        significance: z.string().optional(),
      })
      .optional(),

    // Extension point
    custom: z.record(z.string(), z.any()).optional(),
  }),

  // === METADATA ===
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});
export type WorldEdge = z.infer<typeof WorldEdgeSchema>;

// ============================================
// FACTION (Global Entity)
// ============================================
//
// Factions are NOT properties of locations.
// They are top-level entities that CONNECT to
// locations via FACTION_PRESENCE edges.
//

export const FactionSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  type: z.string(), // "secret_society", "guild", "government", etc.

  // Scope
  scope: z.enum([
    "local",
    "regional",
    "continental",
    "planetary",
    "planar",
    "cosmic",
  ]),

  // Home sphere/planet (for cosmic scope)
  homeSphereId: z.string().uuid().optional(),
  homePlanetId: z.string().uuid().optional(),

  // Data (flexible JSON)
  data: z.object({
    description: z.string().optional(),

    // Symbol/iconography
    symbol: z.string().optional(),
    colors: z.array(z.string()).default([]),
    motto: z.string().optional(),

    // Goals
    goals: z
      .object({
        public: z.array(z.string()).default([]),
        secret: z.array(z.string()).default([]),
        beliefs: z.array(z.string()).default([]),
      })
      .optional(),

    // Structure
    structure: z
      .object({
        type: z.string().optional(), // "cell_based", "hierarchical", "council"
        leaderTitle: z.string().optional(),
        leader: z.string().optional(),
        ranks: z
          .array(
            z.object({
              name: z.string(),
              requirements: z.string().optional(),
              privileges: z.array(z.string()).default([]),
            }),
          )
          .default([]),
      })
      .optional(),

    // Resources (abstract)
    resources: z
      .object({
        wealth: z.number().int().min(0).max(100).optional(),
        military: z.number().int().min(0).max(100).optional(),
        political: z.number().int().min(0).max(100).optional(),
        magical: z.number().int().min(0).max(100).optional(),
        information: z.number().int().min(0).max(100).optional(),
      })
      .optional(),

    // History
    history: z
      .object({
        founded: z.string().optional(),
        founder: z.string().optional(),
        majorEvents: z
          .array(
            z.object({
              date: z.string().optional(),
              event: z.string(),
            }),
          )
          .default([]),
      })
      .optional(),

    // Player interaction
    recruitment: z
      .object({
        open: z.boolean().default(false),
        requirements: z.array(z.string()).default([]),
        process: z.string().optional(),
      })
      .optional(),

    // Typical missions
    missions: z.array(z.string()).default([]),

    // Source
    source: z
      .object({
        book: z.string().optional(),
        edition: z.string().optional(),
      })
      .optional(),

    custom: z.record(z.string(), z.any()).optional(),
  }),

  // Metadata
  isSeeded: z.boolean().default(false),
  isCanonical: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});
export type Faction = z.infer<typeof FactionSchema>;

// ============================================
// FACTION RELATION (Faction-to-Faction)
// ============================================

export const FactionRelationSchema = z.object({
  id: z.string().uuid(),
  faction1Id: z.string().uuid(),
  faction2Id: z.string().uuid(),

  relation: z.enum([
    "allied",
    "friendly",
    "neutral",
    "competitive",
    "rival",
    "hostile",
    "war",
  ]),

  properties: z.object({
    description: z.string().optional(),
    since: z.string().optional(),
    publicKnowledge: z.boolean().default(true),
    history: z
      .array(
        z.object({
          date: z.string().optional(),
          event: z.string(),
        }),
      )
      .default([]),
  }),

  version: z.number().int().default(1),
});
export type FactionRelation = z.infer<typeof FactionRelationSchema>;

// ============================================
// DEITY (Global Entity)
// ============================================

export const DeitySchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  titles: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),

  // Classification
  pantheon: z.string().optional(), // "Faerûnian", "Seldarine", "Celestial Bureaucracy"
  rank: z
    .enum(["greater", "intermediate", "lesser", "demigod", "quasi", "dead"])
    .optional(),
  alignment: z.string().optional(),

  // Scope
  sphereId: z.string().uuid().optional(), // Which sphere(s) worshipped
  planetId: z.string().uuid().optional(), // Which planet(s)

  // Data
  data: z.object({
    description: z.string().optional(),
    portfolio: z.array(z.string()).default([]), // What they're god of
    domains: z.array(z.string()).default([]), // 5e domains

    // Symbols
    symbol: z.string().optional(),
    favoredWeapon: z.string().optional(),
    holyDays: z.array(z.string()).default([]),

    // Dogma
    dogma: z
      .object({
        tenets: z.array(z.string()).default([]),
        taboos: z.array(z.string()).default([]),
      })
      .optional(),

    // Clergy
    clergy: z
      .object({
        titles: z.array(z.string()).default([]),
        vestments: z.string().optional(),
        requirements: z.array(z.string()).default([]),
      })
      .optional(),

    // Relationships
    allies: z.array(z.string()).default([]),
    enemies: z.array(z.string()).default([]),

    // History
    history: z
      .object({
        origin: z.string().optional(),
        majorEvents: z.array(z.string()).default([]),
      })
      .optional(),

    source: z
      .object({
        book: z.string().optional(),
        edition: z.string().optional(),
      })
      .optional(),

    custom: z.record(z.string(), z.any()).optional(),
  }),

  isSeeded: z.boolean().default(false),
  isCanonical: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});
export type Deity = z.infer<typeof DeitySchema>;

// ============================================
// TURSO TABLE DEFINITIONS
// ============================================
//
// The actual SQL. Note: JSON columns stay as TEXT.
// SQLite/Turso handles JSON via json_extract().
//

export const WorldGraphTables = {
  // The skeleton
  world_nodes: `
    CREATE TABLE IF NOT EXISTS world_nodes (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES world_nodes(id),
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      canonical_name TEXT,

      -- Hierarchy shortcuts for fast queries
      sphere_id TEXT REFERENCES world_nodes(id),
      planet_id TEXT REFERENCES world_nodes(id),
      continent_id TEXT REFERENCES world_nodes(id),
      region_id TEXT REFERENCES world_nodes(id),

      -- Flags
      is_seeded INTEGER DEFAULT 0,
      is_canonical INTEGER DEFAULT 1,
      is_hidden INTEGER DEFAULT 0,

      -- THE FLEXIBLE PART
      data_static TEXT NOT NULL DEFAULT '{}',

      -- Metadata
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON world_nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON world_nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_name ON world_nodes(name);
    CREATE INDEX IF NOT EXISTS idx_nodes_sphere ON world_nodes(sphere_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_planet ON world_nodes(planet_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_region ON world_nodes(region_id);
  `,

  // The nervous system
  world_edges: `
    CREATE TABLE IF NOT EXISTS world_edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES world_nodes(id),
      target_id TEXT NOT NULL REFERENCES world_nodes(id),
      type TEXT NOT NULL,
      bidirectional INTEGER DEFAULT 1,

      -- THE FLEXIBLE PART
      properties TEXT NOT NULL DEFAULT '{}',

      -- Metadata
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_edges_source ON world_edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON world_edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON world_edges(type);

    -- For reverse lookups
    CREATE INDEX IF NOT EXISTS idx_edges_target_type ON world_edges(target_id, type);
  `,

  // Global entities
  factions: `
    CREATE TABLE IF NOT EXISTS factions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      scope TEXT,
      home_sphere_id TEXT REFERENCES world_nodes(id),
      home_planet_id TEXT REFERENCES world_nodes(id),

      data TEXT NOT NULL DEFAULT '{}',

      is_seeded INTEGER DEFAULT 0,
      is_canonical INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_factions_name ON factions(name);
    CREATE INDEX IF NOT EXISTS idx_factions_scope ON factions(scope);
  `,

  faction_relations: `
    CREATE TABLE IF NOT EXISTS faction_relations (
      id TEXT PRIMARY KEY,
      faction1_id TEXT NOT NULL REFERENCES factions(id),
      faction2_id TEXT NOT NULL REFERENCES factions(id),
      relation TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '{}',
      version INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_faction_rel_1 ON faction_relations(faction1_id);
    CREATE INDEX IF NOT EXISTS idx_faction_rel_2 ON faction_relations(faction2_id);
  `,

  deities: `
    CREATE TABLE IF NOT EXISTS deities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pantheon TEXT,
      rank TEXT,
      alignment TEXT,
      sphere_id TEXT REFERENCES world_nodes(id),
      planet_id TEXT REFERENCES world_nodes(id),

      data TEXT NOT NULL DEFAULT '{}',

      is_seeded INTEGER DEFAULT 0,
      is_canonical INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_deities_name ON deities(name);
    CREATE INDEX IF NOT EXISTS idx_deities_pantheon ON deities(pantheon);
  `,
};

// ============================================
// INHERITANCE HELPERS
// ============================================
//
// CRITICAL: SQLite does NOT handle inheritance.
// The Application Layer MUST resolve parent chains.
//
// When you query a node, its `physics` may be null
// because it inherits from Toril. The service layer
// must walk up the tree to find the effective value.
//

/**
 * Resolve the effective physics for a node.
 * Walks up the parent chain, merging physics objects.
 * Child values override parent values.
 */
export function resolvePhysics(
  node: WorldNode,
  ancestors: WorldNode[],
): CosmicPhysics {
  // Start with defaults
  let resolved: CosmicPhysics = {};

  // Apply from ancestors (oldest first = root of tree)
  for (const ancestor of [...ancestors].reverse()) {
    if (ancestor.dataStatic.physics) {
      resolved = deepMerge(resolved, ancestor.dataStatic.physics);
    }
  }

  // Apply node's own physics (overrides ancestors)
  if (node.dataStatic.physics) {
    resolved = deepMerge(resolved, node.dataStatic.physics);
  }

  return resolved;
}

/**
 * Resolve the effective culture for a node.
 * Same inheritance logic as physics.
 */
export function resolveCulture(
  node: WorldNode,
  ancestors: WorldNode[],
): CulturalTraits {
  let resolved: CulturalTraits = {};

  for (const ancestor of [...ancestors].reverse()) {
    if (ancestor.dataStatic.culture) {
      resolved = deepMerge(resolved, ancestor.dataStatic.culture);
    }
  }

  if (node.dataStatic.culture) {
    resolved = deepMerge(resolved, node.dataStatic.culture);
  }

  return resolved;
}

/**
 * Fetch ancestor chain for a node.
 * Returns array from immediate parent to root.
 *
 * @example
 * // For Waterdeep:
 * // [Sword Coast, Faerûn, Toril, Realmspace]
 */
export async function fetchAncestorChain(
  nodeId: string,
  fetchNode: (id: string) => Promise<WorldNode | null>,
): Promise<WorldNode[]> {
  const ancestors: WorldNode[] = [];
  let currentId: string | undefined = nodeId;

  // Walk up the tree
  while (currentId) {
    const node = await fetchNode(currentId);
    if (!node) break;

    // Don't include the original node
    if (node.id !== nodeId) {
      ancestors.push(node);
    }

    currentId = node.parentId ?? undefined;
  }

  return ancestors;
}

/**
 * Resolve full context for a node.
 * This is what the UI/API should call.
 * Returns the node with inherited physics/culture resolved.
 */
export interface ResolvedWorldNode extends WorldNode {
  effectivePhysics: CosmicPhysics;
  effectiveCulture: CulturalTraits;
  ancestorChain: Array<{ id: string; name: string; type: WorldNodeType }>;
}

export async function resolveNodeContext(
  node: WorldNode,
  fetchNode: (id: string) => Promise<WorldNode | null>,
): Promise<ResolvedWorldNode> {
  const ancestors = await fetchAncestorChain(node.id, fetchNode);

  return {
    ...node,
    effectivePhysics: resolvePhysics(node, ancestors),
    effectiveCulture: resolveCulture(node, ancestors),
    ancestorChain: ancestors.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
    })),
  };
}

/**
 * Check if a specific trait is overridden at this node.
 * Useful for UI to show "inherited" vs "local" indicators.
 */
export function isTraitLocal(
  node: WorldNode,
  path: string[], // e.g., ['physics', 'magic', 'level']
): boolean {
  let current: any = node.dataStatic;
  for (const key of path) {
    if (current === undefined || current === null) return false;
    current = current[key];
  }
  return current !== undefined && current !== null;
}

/**
 * Find which ancestor defines a trait.
 * Returns null if trait is not defined anywhere.
 */
export function findTraitSource(
  node: WorldNode,
  ancestors: WorldNode[],
  path: string[],
): { nodeId: string; nodeName: string } | null {
  // Check self first
  if (isTraitLocal(node, path)) {
    return { nodeId: node.id, nodeName: node.name };
  }

  // Check ancestors (nearest first)
  for (const ancestor of ancestors) {
    if (isTraitLocal(ancestor, path)) {
      return { nodeId: ancestor.id, nodeName: ancestor.name };
    }
  }

  return null;
}

// Simple deep merge (production would use lodash)
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
