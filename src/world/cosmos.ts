import { z } from "zod";

// ============================================
// WORLD LAYER - THE COSMOLOGY
// ============================================
//
// Philosophy: EVERYTHING EXISTS SOMEWHERE
//
// This is the TOP of the hierarchy.
// Everything we built hangs off this.
//
// Traditional D&D:
//   World (Faerûn) → Campaign → Party
//
// Spelljammer:
//   Crystal Sphere (Realmspace) → Worlds (Toril, etc.)
//   Phlogiston → Between spheres
//   Campaign can span MULTIPLE spheres!
//
// This layer enables:
//   - Pre-seeded worlds (Faerûn, Greyhawk, Eberron)
//   - Custom world builder
//   - Spelljammer campaigns
//   - Planar adventures
//   - Multiverse connections
//

// ============================================
// COSMOLOGY TYPES
// ============================================

export const CosmologyTypeSchema = z.enum([
  "prime_material", // Standard material plane world
  "crystal_sphere", // Spelljammer sphere containing worlds
  "wildspace", // Space within a crystal sphere
  "phlogiston", // The Flow between spheres
  "inner_plane", // Fire, Water, Earth, Air, etc.
  "outer_plane", // Heavens, Hells, etc.
  "transitive_plane", // Astral, Ethereal, Shadow
  "demiplane", // Pocket dimensions
  "far_realm", // Beyond reality
]);
export type CosmologyType = z.infer<typeof CosmologyTypeSchema>;

export const WorldTypeSchema = z.enum([
  // Standard
  "planet", // Earth-like world
  "continent", // Just one landmass
  "island_chain", // Archipelago setting
  "underground", // Underdark-style
  "planar", // Entire plane as setting

  // Spelljammer
  "crystal_sphere", // Contains multiple worlds
  "wildspace_region", // Area of wildspace
  "asteroid_belt", // Rock of Bral style
  "gas_giant", // Colville's world
  "ringworld", // Artificial structure
  "dyson_sphere", // Mega-structure
  "living_world", // Creature that is a world
  "dead_god", // Corpse floating in space

  // Exotic
  "pocket_dimension", // Demiplane
  "dream_realm", // Dreamscape
  "mirror_world", // Reflection
]);
export type WorldType = z.infer<typeof WorldTypeSchema>;

// ============================================
// MULTIVERSE
// ============================================
//
// The container for ALL reality.
// One per installation/server.
//

export const MultiverseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().default("The Multiverse"),

  // Configuration
  config: z.object({
    // Which cosmology model
    cosmologyModel: z
      .enum([
        "great_wheel", // Traditional D&D
        "world_tree", // 4e style
        "world_axis", // Another 4e variant
        "spelljammer", // Crystal spheres in phlogiston
        "custom", // User-defined
      ])
      .default("great_wheel"),

    // Spelljammer enabled?
    spelljammerEnabled: z.boolean().default(false),

    // Planar travel enabled?
    planarTravelEnabled: z.boolean().default(true),

    // Cross-world campaigns allowed?
    crossWorldCampaigns: z.boolean().default(false),
  }),

  // All crystal spheres (for Spelljammer)
  crystalSpheres: z.array(z.string().uuid()).default([]),

  // All worlds
  worlds: z.array(z.string().uuid()).default([]),

  // Planar structure
  planes: z
    .object({
      innerPlanes: z
        .array(z.string())
        .default(["Fire", "Water", "Earth", "Air"]),
      outerPlanes: z.array(z.string()).default([]), // Defined by cosmology
      transitivePlanes: z
        .array(z.string())
        .default(["Astral", "Ethereal", "Shadow"]),
    })
    .optional(),

  // Metadata
  createdAt: z.date(),
  version: z.number().int().default(1),
});
export type Multiverse = z.infer<typeof MultiverseSchema>;

// ============================================
// CRYSTAL SPHERE (Spelljammer)
// ============================================
//
// A crystal shell containing wildspace and worlds.
// The phlogiston flows between spheres.
//

export const CrystalSphereSchema = z.object({
  id: z.string().uuid(),
  multiverseId: z.string().uuid(),

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  description: z.string().optional(),

  // Physical properties
  properties: z.object({
    // Size
    diameter: z.string(), // "Approximately 2 billion miles"

    // Crystal shell
    shellThickness: z.string().optional(),
    shellMaterial: z.string().default("crystal"),
    shellColor: z.string().optional(),

    // Portals
    portals: z
      .array(
        z.object({
          name: z.string(),
          size: z.string(),
          location: z.string(),
          opensTo: z.string(), // Where in phlogiston
          schedule: z.string().optional(), // When it opens
        }),
      )
      .default([]),
  }),

  // What's inside
  contents: z.object({
    // Primary world(s)
    primaryWorldId: z.string().uuid().optional(),

    // All celestial bodies
    celestialBodies: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          type: z.enum([
            "planet",
            "moon",
            "sun",
            "asteroid",
            "comet",
            "gas_giant",
            "ring",
            "cluster",
            "anomaly",
          ]),
          worldId: z.string().uuid().optional(), // If it's a playable world
          orbitPath: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .default([]),

    // Wildspace features
    wildspaceFeatures: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          location: z.string(),
          description: z.string(),
        }),
      )
      .default([]),
  }),

  // Navigation
  navigation: z.object({
    // Flow rivers (currents in phlogiston TO this sphere)
    flowRiversIn: z
      .array(
        z.object({
          fromSphereId: z.string().uuid(),
          fromSphereName: z.string(),
          travelTime: z.string(),
          difficulty: z.string(),
        }),
      )
      .default([]),

    // Flow rivers OUT
    flowRiversOut: z
      .array(
        z.object({
          toSphereId: z.string().uuid(),
          toSphereName: z.string(),
          travelTime: z.string(),
          difficulty: z.string(),
        }),
      )
      .default([]),

    // Known routes
    knownRoutes: z
      .array(
        z.object({
          name: z.string(),
          from: z.string(),
          to: z.string(),
          travelTime: z.string(),
          hazards: z.array(z.string()),
        }),
      )
      .default([]),
  }),

  // Political situation
  politics: z
    .object({
      dominantFactions: z.array(z.string()).default([]),
      majorConflicts: z.array(z.string()).default([]),
      tradingPowers: z.array(z.string()).default([]),
      pirateActivity: z
        .enum(["none", "low", "moderate", "high", "extreme"])
        .default("moderate"),
    })
    .optional(),

  // Metadata
  isSeeded: z.boolean().default(false), // Pre-built or custom
  seedSource: z.string().optional(), // "Spelljammer: Realmspace"
  createdAt: z.date(),
  version: z.number().int().default(1),
});
export type CrystalSphere = z.infer<typeof CrystalSphereSchema>;

// ============================================
// WORLD
// ============================================
//
// A setting where campaigns take place.
// Can be planet, plane, crystal sphere contents, etc.
//

export const WorldSchema = z.object({
  id: z.string().uuid(),
  multiverseId: z.string().uuid(),

  // Spelljammer linkage
  crystalSphereId: z.string().uuid().optional(), // If inside a sphere
  celestialBodyId: z.string().uuid().optional(), // Which body it is

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  tagline: z.string().optional(), // "The Forgotten Realms"
  description: z.string().optional(),

  // Classification
  type: WorldTypeSchema,
  cosmologyType: CosmologyTypeSchema.default("prime_material"),

  // Genre/Tone
  genre: z.object({
    primary: z.string(), // "High Fantasy"
    secondary: z.array(z.string()).default([]), // ["Political Intrigue", "Horror"]

    // Tone sliders (0-100)
    toneSliders: z
      .object({
        magic: z.number().int().min(0).max(100).default(70), // Low magic ↔ High magic
        technology: z.number().int().min(0).max(100).default(20), // Medieval ↔ Magitech
        grit: z.number().int().min(0).max(100).default(50), // Heroic ↔ Dark
        scope: z.number().int().min(0).max(100).default(60), // Local ↔ Epic
        politics: z.number().int().min(0).max(100).default(40), // Simple ↔ Complex
        horror: z.number().int().min(0).max(100).default(30), // None ↔ Prevalent
      })
      .optional(),
  }),

  // Physical world
  geography: z.object({
    // Map
    mapUrl: z.string().optional(),
    mapStyle: z.string().optional(),

    // Scale
    size: z.string().optional(), // "Earth-sized", "Single continent"

    // Major features
    continents: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string().optional(),
          regions: z.array(z.string()).default([]),
        }),
      )
      .default([]),

    oceans: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
        }),
      )
      .default([]),

    majorFeatures: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(), // "Mountain Range", "Desert", "Forest"
          description: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // History
  history: z.object({
    // Ages/Eras
    ages: z
      .array(
        z.object({
          name: z.string(),
          startYear: z.number().int().optional(),
          endYear: z.number().int().optional(),
          description: z.string(),
          majorEvents: z.array(z.string()).default([]),
        }),
      )
      .default([]),

    // Current year
    currentYear: z.number().int().optional(),
    calendarName: z.string().optional(),

    // Major historical events
    majorEvents: z
      .array(
        z.object({
          name: z.string(),
          year: z.number().int().optional(),
          description: z.string(),
          impact: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // Cosmology connection
  cosmology: z.object({
    // Connected planes
    connectedPlanes: z
      .array(
        z.object({
          planeName: z.string(),
          connectionType: z.string(), // "Barrier thin", "Portal", etc.
          locations: z.array(z.string()).default([]),
        }),
      )
      .default([]),

    // Deities
    pantheon: z
      .object({
        type: z.enum([
          "monotheistic",
          "polytheistic",
          "animistic",
          "absent",
          "custom",
        ]),
        majorDeities: z
          .array(
            z.object({
              name: z.string(),
              domains: z.array(z.string()),
              alignment: z.string().optional(),
              symbol: z.string().optional(),
            }),
          )
          .default([]),
        description: z.string().optional(),
      })
      .optional(),

    // Magic system
    magicSystem: z
      .object({
        type: z.string(), // "Vancian", "Mana-based", "Weave"
        source: z.string().optional(),
        limitations: z.array(z.string()).default([]),
        specialRules: z.array(z.string()).default([]),
      })
      .optional(),
  }),

  // Major factions (world-level)
  majorFactions: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        type: z.string(),
        influence: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),

  // Playable species
  playableSpecies: z
    .array(
      z.object({
        name: z.string(),
        commonality: z.enum([
          "dominant",
          "common",
          "uncommon",
          "rare",
          "exotic",
        ]),
        regions: z.array(z.string()).default([]),
        notes: z.string().optional(),
      }),
    )
    .default([]),

  // Languages
  languages: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum([
          "common",
          "racial",
          "regional",
          "ancient",
          "exotic",
          "secret",
        ]),
        speakers: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  // Seed data
  isSeeded: z.boolean().default(false),
  seedSource: z.string().optional(), // "Forgotten Realms Campaign Setting"
  seedVersion: z.string().optional(),

  // For custom worlds
  createdBy: z.string().uuid().optional(),
  isPublic: z.boolean().default(false),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});
export type World = z.infer<typeof WorldSchema>;

// ============================================
// REGION (within a World)
// ============================================
//
// A geographic/political region.
// Maps to our settlement/location systems.
//

export const RegionSchema = z.object({
  id: z.string().uuid(),
  worldId: z.string().uuid(),
  parentRegionId: z.string().uuid().optional(), // For sub-regions

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  type: z.enum([
    "continent",
    "subcontinent",
    "nation",
    "kingdom",
    "empire",
    "province",
    "territory",
    "city_state",
    "tribal_lands",
    "wilderness",
    "wasteland",
    "ocean",
    "island",
    "archipelago",
    "underdark_region",
    "planar_region",
    "custom",
  ]),

  description: z.string().optional(),

  // Geography
  geography: z.object({
    climate: z.string().optional(),
    terrain: z.array(z.string()).default([]),
    majorLandmarks: z.array(z.string()).default([]),
    borders: z
      .array(
        z.object({
          regionName: z.string(),
          borderType: z.string(), // "Mountain range", "River", "Political"
        }),
      )
      .default([]),
  }),

  // Political
  politics: z
    .object({
      government: z.string().optional(),
      ruler: z.string().optional(),
      rulingFaction: z.string().optional(),
      stability: z.enum(["stable", "uneasy", "unstable", "chaos"]).optional(),

      // Relations with neighbors
      neighborRelations: z
        .array(
          z.object({
            regionName: z.string(),
            relation: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Demographics
  demographics: z
    .object({
      population: z.string().optional(), // "~2 million"
      dominantSpecies: z.array(z.string()).default([]),
      languages: z.array(z.string()).default([]),
      religions: z.array(z.string()).default([]),
    })
    .optional(),

  // Economy
  economy: z
    .object({
      resources: z.array(z.string()).default([]),
      exports: z.array(z.string()).default([]),
      imports: z.array(z.string()).default([]),
      tradingPartners: z.array(z.string()).default([]),
      currency: z.string().optional(),
    })
    .optional(),

  // Major locations (links to settlement system)
  majorSettlements: z.array(z.string().uuid()).default([]),

  // Adventure hooks
  hooks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        level: z.string().optional(),
      }),
    )
    .default([]),

  // Seed data
  isSeeded: z.boolean().default(false),
  seedSource: z.string().optional(),

  version: z.number().int().default(1),
});
export type Region = z.infer<typeof RegionSchema>;

// ============================================
// SPELLJAMMER SHIP
// ============================================
//
// Because Spelljammer needs ships!
//

export const SpelljammerShipSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  shipClass: z.string(), // "Hammership", "Nautiloid", "Squid Ship"

  // Ownership
  ownerId: z.string().uuid().optional(), // Party or character
  ownerType: z.enum(["party", "character", "npc", "faction"]),

  // Stats
  stats: z.object({
    // Size
    size: z.enum(["tiny", "small", "medium", "large", "huge", "gargantuan"]),
    length: z.string(),
    beam: z.string(),

    // Crew
    crewMin: z.number().int(),
    crewMax: z.number().int(),
    currentCrew: z.number().int().default(0),
    passengers: z.number().int().default(0),

    // Cargo
    cargoCapacity: z.string(),
    currentCargo: z
      .array(
        z.object({
          item: z.string(),
          quantity: z.number().int(),
        }),
      )
      .default([]),

    // Combat
    ac: z.number().int(),
    hp: z.object({
      current: z.number().int(),
      max: z.number().int(),
    }),
    damageThreshold: z.number().int().optional(),

    // Movement
    speed: z.object({
      tactical: z.string(), // "4 (40 ft)"
      spelljamming: z.string(), // "4,800,000 miles/day"
    }),
    maneuverability: z.enum(["clumsy", "poor", "average", "good", "perfect"]),

    // Weapons
    weapons: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(), // "Ballista", "Mangonel", "Jettison"
          position: z.string(), // "Fore", "Aft", "Port", "Starboard"
          damage: z.string(),
          range: z.string(),
          crew: z.number().int(),
        }),
      )
      .default([]),
  }),

  // Spelljamming helm
  helm: z
    .object({
      type: z.string(), // "Major Helm", "Minor Helm", "Series Helm"
      attunedTo: z.string().uuid().optional(), // Character ID
      attunedName: z.string().optional(),
      powerRating: z.number().int().optional(),
    })
    .optional(),

  // Special features
  features: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .default([]),

  // Condition
  condition: z.object({
    hull: z.enum(["pristine", "good", "fair", "poor", "critical", "destroyed"]),
    systems: z
      .array(
        z.object({
          system: z.string(),
          status: z.enum(["operational", "damaged", "disabled", "destroyed"]),
        }),
      )
      .default([]),
    lastRepaired: z.date().optional(),
  }),

  // Location
  location: z.object({
    type: z.enum(["docked", "wildspace", "phlogiston", "crashed", "in_combat"]),
    sphereId: z.string().uuid().optional(),
    sphereName: z.string().optional(),
    worldId: z.string().uuid().optional(),
    worldName: z.string().optional(),
    specificLocation: z.string().optional(),

    // If in transit
    destination: z.string().optional(),
    arrivalEstimate: z.string().optional(),
  }),

  // Ship log
  log: z
    .array(
      z.object({
        date: z.string(),
        entry: z.string(),
        author: z.string().optional(),
      }),
    )
    .default([]),

  version: z.number().int().default(1),
});
export type SpelljammerShip = z.infer<typeof SpelljammerShipSchema>;

// ============================================
// CAMPAIGN
// ============================================
//
// A campaign exists within a world.
// (Or multiple worlds for Spelljammer!)
//

export const CampaignSchema = z.object({
  id: z.string().uuid(),

  // World connection
  primaryWorldId: z.string().uuid(),

  // Spelljammer - can span multiple!
  isSpelljammer: z.boolean().default(false),
  accessibleWorlds: z.array(z.string().uuid()).default([]),
  accessibleSpheres: z.array(z.string().uuid()).default([]),

  // Identity
  name: z.string(),
  tagline: z.string().optional(),
  description: z.string().optional(),

  // Based on published adventure?
  sourceAdventure: z
    .object({
      name: z.string(),
      publisher: z.string(),
      modified: z.boolean().default(true),
    })
    .optional(),

  // Campaign settings
  settings: z.object({
    // Difficulty
    difficulty: z.enum(["easy", "normal", "hard", "deadly"]).default("normal"),

    // Tone
    tone: z.array(z.string()).default([]), // ["Heroic", "Political", "Mystery"]

    // Rules
    rulesystem: z.string().default("5e"),
    houseRules: z.array(z.string()).default([]),

    // Features enabled
    downtime: z.boolean().default(true),
    factions: z.boolean().default(true),
    economy: z.boolean().default(true),
    followers: z.boolean().default(true),

    // Spelljammer-specific
    spelljammerRules: z
      .object({
        airSupply: z.boolean().default(true),
        gravity: z.boolean().default(true),
        phlogistonFire: z.boolean().default(true),
      })
      .optional(),
  }),

  // Scope
  scope: z.object({
    // Starting area
    startingRegionId: z.string().uuid().optional(),
    startingSettlementId: z.string().uuid().optional(),

    // Level range
    startingLevel: z.number().int().default(1),
    expectedEndLevel: z.number().int().optional(),

    // Expected duration
    estimatedSessions: z.number().int().optional(),

    // Geographic scope
    geographicScope: z
      .enum(["local", "regional", "continental", "global", "planar", "cosmic"])
      .default("regional"),
  }),

  // Current state
  state: z.object({
    status: z
      .enum(["planning", "active", "hiatus", "completed", "abandoned"])
      .default("planning"),

    // Time
    currentDate: z.string().optional(),
    sessionsPlayed: z.number().int().default(0),
    lastSessionDate: z.date().optional(),

    // Progress
    currentArcId: z.string().uuid().optional(),
    currentArcName: z.string().optional(),

    // Party location
    partyLocationId: z.string().uuid().optional(),
    partyLocationName: z.string().optional(),

    // For Spelljammer
    currentSphereId: z.string().uuid().optional(),
    currentShipId: z.string().uuid().optional(),
  }),

  // Parties in this campaign
  partyIds: z.array(z.string().uuid()).default([]),

  // GM
  gmId: z.string().uuid(),
  coGmIds: z.array(z.string().uuid()).default([]),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// ============================================
// PARTY
// ============================================
//
// A party exists within a campaign.
// Everything we built hangs off this.
//

export const PartySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  motto: z.string().optional(),
  symbol: z.string().optional(),

  // Members
  members: z
    .array(
      z.object({
        characterId: z.string().uuid(),
        playerId: z.string().uuid().optional(),
        role: z.enum([
          "leader",
          "member",
          "npc_companion",
          "temporary",
          "former",
        ]),
        joinedDate: z.string().optional(),
        leftDate: z.string().optional(),
        active: z.boolean().default(true),
      }),
    )
    .default([]),

  // Resources
  resources: z.object({
    gold: z.number().default(0),
    sharedInventoryId: z.string().uuid().optional(),

    // For Spelljammer
    shipIds: z.array(z.string().uuid()).default([]),
    primaryShipId: z.string().uuid().optional(),
  }),

  // Status
  status: z.object({
    // Location (links to existing systems)
    currentLocationId: z.string().uuid().optional(),
    currentLocationName: z.string().optional(),

    // For Spelljammer
    inSpace: z.boolean().default(false),
    currentShipId: z.string().uuid().optional(),

    // Activity
    activity: z
      .enum(["adventuring", "resting", "downtime", "traveling", "in_combat"])
      .default("resting"),

    // Party level (average or milestone)
    averageLevel: z.number().int().default(1),
    milestoneLevel: z.number().int().optional(),
  }),

  // Reputation (by faction/region)
  reputation: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        type: z.enum(["faction", "settlement", "region", "world"]),
        value: z.number().int(), // -100 to 100
        standing: z.string(), // "Hostile", "Friendly", etc.
      }),
    )
    .default({}),

  // History
  history: z.object({
    formedDate: z.string().optional(),

    // Accomplishments
    majorAccomplishments: z
      .array(
        z.object({
          date: z.string(),
          title: z.string(),
          description: z.string(),
        }),
      )
      .default([]),

    // Fallen members
    fallenMembers: z
      .array(
        z.object({
          characterId: z.string().uuid(),
          name: z.string(),
          deathDate: z.string(),
          causeOfDeath: z.string(),
          memorial: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // Stats
  stats: z.object({
    sessionsPlayed: z.number().int().default(0),
    combatsWon: z.number().int().default(0),
    combatsLost: z.number().int().default(0),
    questsCompleted: z.number().int().default(0),
    goldEarned: z.number().default(0),
    goldSpent: z.number().default(0),
  }),

  version: z.number().int().default(1),
});
export type Party = z.infer<typeof PartySchema>;

// ============================================
// WORLD BUILDER
// ============================================
//
// For GMs creating custom worlds.
//

export const WorldBuilderStepSchema = z.enum([
  "concept", // What's the world about?
  "cosmology", // How does the universe work?
  "geography", // What does it look like?
  "history", // What happened before?
  "cultures", // Who lives here?
  "magic", // How does magic work?
  "factions", // Who has power?
  "conflicts", // What's happening now?
  "details", // Fill in the rest
  "complete", // Done!
]);
export type WorldBuilderStep = z.infer<typeof WorldBuilderStepSchema>;

export const WorldBuilderStateSchema = z.object({
  worldId: z.string().uuid().optional(), // Once created

  currentStep: WorldBuilderStepSchema.default("concept"),
  completedSteps: z.array(WorldBuilderStepSchema).default([]),

  // Draft data
  draft: z.object({
    // Concept
    concept: z
      .object({
        name: z.string().optional(),
        tagline: z.string().optional(),
        elevator_pitch: z.string().optional(),
        genre: z.string().optional(),
        inspirations: z.array(z.string()).default([]),
      })
      .optional(),

    // Cosmology
    cosmology: z
      .object({
        type: z.string().optional(),
        planes: z.array(z.string()).default([]),
        deities: z.array(z.any()).default([]),
        magic: z.string().optional(),
      })
      .optional(),

    // Geography
    geography: z
      .object({
        size: z.string().optional(),
        continents: z.array(z.any()).default([]),
        climates: z.array(z.string()).default([]),
        special_features: z.array(z.string()).default([]),
      })
      .optional(),

    // History
    history: z
      .object({
        ages: z.array(z.any()).default([]),
        major_events: z.array(z.any()).default([]),
        current_year: z.number().int().optional(),
      })
      .optional(),

    // Cultures
    cultures: z
      .object({
        species: z.array(z.any()).default([]),
        languages: z.array(z.any()).default([]),
        religions: z.array(z.any()).default([]),
      })
      .optional(),

    // Factions
    factions: z.array(z.any()).default([]),

    // Conflicts
    conflicts: z
      .array(
        z.object({
          name: z.string(),
          parties: z.array(z.string()),
          stakes: z.string(),
          current_state: z.string(),
        }),
      )
      .default([]),
  }),

  // AI assistance
  aiSuggestions: z
    .array(
      z.object({
        forStep: WorldBuilderStepSchema,
        suggestions: z.array(z.string()),
        generated: z.date(),
      }),
    )
    .default([]),

  // Progress
  lastModified: z.date(),
  estimatedCompletion: z.number().int().min(0).max(100).default(0),
});
export type WorldBuilderState = z.infer<typeof WorldBuilderStateSchema>;

// ============================================
// SEEDED WORLDS
// ============================================
//
// Pre-built worlds ready to use.
//

export const SeededWorldInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),

  // Source
  publisher: z.string(),
  source: z.string(),
  edition: z.string().optional(),

  // What's included
  includes: z.object({
    regions: z.number().int(),
    settlements: z.number().int(),
    factions: z.number().int(),
    npcs: z.number().int(),
    deities: z.number().int(),
  }),

  // Spelljammer?
  crystalSphere: z.string().optional(),

  // Preview image
  previewImage: z.string().optional(),

  // Status
  available: z.boolean().default(true),
  premium: z.boolean().default(false),
});
export type SeededWorldInfo = z.infer<typeof SeededWorldInfoSchema>;

export const AvailableSeededWorlds: SeededWorldInfo[] = [
  {
    id: "faerun",
    name: "Faerûn",
    tagline: "The Forgotten Realms",
    description:
      "The most iconic D&D setting. Home to Baldur's Gate, Waterdeep, Neverwinter, and countless adventures.",
    publisher: "Wizards of the Coast",
    source: "Forgotten Realms Campaign Setting",
    edition: "5e",
    includes: {
      regions: 30,
      settlements: 200,
      factions: 50,
      npcs: 150,
      deities: 100,
    },
    crystalSphere: "Realmspace",
    available: true,
    premium: false,
  },
  {
    id: "realmspace",
    name: "Realmspace",
    tagline: "The Crystal Sphere of Toril",
    description:
      "For Spelljammer campaigns. Contains Toril (Faerûn's world), its moons, and the wildspace between.",
    publisher: "Wizards of the Coast",
    source: "Spelljammer: Adventures in Space",
    includes: {
      regions: 10,
      settlements: 20,
      factions: 15,
      npcs: 40,
      deities: 0,
    },
    crystalSphere: "Realmspace",
    available: true,
    premium: false,
  },
  {
    id: "greyspace",
    name: "Greyspace",
    tagline: "The Crystal Sphere of Oerth",
    description:
      "Home to Greyhawk. For Spelljammer or traditional campaigns in the original D&D setting.",
    publisher: "Wizards of the Coast",
    source: "Spelljammer",
    includes: {
      regions: 15,
      settlements: 80,
      factions: 30,
      npcs: 60,
      deities: 40,
    },
    crystalSphere: "Greyspace",
    available: true,
    premium: false,
  },
  {
    id: "krynnspace",
    name: "Krynnspace",
    tagline: "The Crystal Sphere of Krynn",
    description:
      "Home to Dragonlance. The War of the Lance, Dragon Highlords, and the Heroes of the Lance.",
    publisher: "Wizards of the Coast",
    source: "Dragonlance",
    includes: {
      regions: 12,
      settlements: 60,
      factions: 25,
      npcs: 80,
      deities: 30,
    },
    crystalSphere: "Krynnspace",
    available: true,
    premium: false,
  },
  {
    id: "rock_of_bral",
    name: "Rock of Bral",
    tagline: "The City Among the Stars",
    description:
      "The iconic Spelljammer hub. A city-sized asteroid in wildspace. Perfect for space-faring campaigns.",
    publisher: "Wizards of the Coast",
    source: "Spelljammer: Adventures in Space",
    includes: {
      regions: 5,
      settlements: 1, // It IS the settlement
      factions: 20,
      npcs: 50,
      deities: 0,
    },
    available: true,
    premium: false,
  },
];

// ============================================
// HIERARCHY AGGREGATE
// ============================================
//
// The complete hierarchy for navigation.
//

export const WorldHierarchyAggregateSchema = z.object({
  // Current multiverse
  multiverse: z.object({
    id: z.string().uuid(),
    name: z.string(),
    spelljammerEnabled: z.boolean(),
  }),

  // Crystal spheres (if Spelljammer)
  spheres: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        worldCount: z.number().int(),
        isCurrent: z.boolean(),
      }),
    )
    .optional(),

  // Worlds
  worlds: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: WorldTypeSchema,
      sphereId: z.string().uuid().optional(),
      isSeeded: z.boolean(),
      campaignCount: z.number().int(),
      isCurrent: z.boolean(),
    }),
  ),

  // Campaigns
  campaigns: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      worldId: z.string().uuid(),
      worldName: z.string(),
      status: z.string(),
      partyCount: z.number().int(),
      isCurrent: z.boolean(),
      isSpelljammer: z.boolean(),
    }),
  ),

  // Parties
  parties: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      campaignId: z.string().uuid(),
      campaignName: z.string(),
      memberCount: z.number().int(),
      averageLevel: z.number().int(),
      isCurrent: z.boolean(),
    }),
  ),

  // Current selection
  current: z.object({
    sphereId: z.string().uuid().optional(),
    worldId: z.string().uuid().optional(),
    campaignId: z.string().uuid().optional(),
    partyId: z.string().uuid().optional(),
  }),
});
export type WorldHierarchyAggregate = z.infer<
  typeof WorldHierarchyAggregateSchema
>;

// ============================================
// SPELLJAMMER NAVIGATION
// ============================================
//
// For plotting courses through wildspace!
//

export const SpelljammerNavigationSchema = z.object({
  // Current position
  position: z.object({
    type: z.enum(["docked", "wildspace", "phlogiston"]),
    sphereId: z.string().uuid().optional(),
    sphereName: z.string().optional(),
    worldId: z.string().uuid().optional(),
    worldName: z.string().optional(),
    coordinates: z.string().optional(),
  }),

  // Destination
  destination: z
    .object({
      type: z.enum(["world", "sphere", "coordinates", "landmark"]),
      targetId: z.string().uuid().optional(),
      targetName: z.string(),
      sphereId: z.string().uuid().optional(),
    })
    .optional(),

  // Route
  route: z
    .object({
      segments: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          type: z.enum(["wildspace", "phlogiston", "portal"]),
          distance: z.string(),
          duration: z.string(),
          hazards: z.array(z.string()),
        }),
      ),
      totalDuration: z.string(),
      fuelRequired: z.string().optional(),
    })
    .optional(),

  // Known hazards along route
  hazards: z
    .array(
      z.object({
        location: z.string(),
        type: z.string(),
        severity: z.string(),
        description: z.string(),
      }),
    )
    .default([]),

  // Encounters (random encounters along route)
  possibleEncounters: z
    .array(
      z.object({
        type: z.string(),
        likelihood: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
});
export type SpelljammerNavigation = z.infer<typeof SpelljammerNavigationSchema>;
