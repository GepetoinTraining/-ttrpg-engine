import { z } from "zod";

// ============================================
// SEED DATA TYPES
// ============================================
//
// These types define the structure for importing
// pre-built world data (Faerûn, Greyhawk, etc.)
//
// Gemini is helping build the actual data.
// This defines what we expect to receive.
//

// ============================================
// SEED MANIFEST
// ============================================

export const SeedManifestSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  version: z.string(),

  // Type
  type: z.enum([
    "world", // Full world (Faerûn)
    "crystal_sphere", // Spelljammer sphere
    "region", // Add-on region
    "settlement_pack", // Settlement collection
    "faction_pack", // Faction collection
  ]),

  // Description
  description: z.string(),
  author: z.string().optional(),
  source: z.string().optional(), // Published source

  // Dependencies
  requires: z.array(z.string()).default([]), // Other seeds required

  // Contents
  contents: z.object({
    worlds: z.number().int().default(0),
    regions: z.number().int().default(0),
    settlements: z.number().int().default(0),
    factions: z.number().int().default(0),
    npcs: z.number().int().default(0),
    deities: z.number().int().default(0),
    locations: z.number().int().default(0),
    items: z.number().int().default(0),
  }),

  // Files
  files: z.object({
    world: z.string().optional(),
    sphere: z.string().optional(),
    regions: z.array(z.string()).default([]),
    settlements: z.array(z.string()).default([]),
    factions: z.array(z.string()).default([]),
    npcs: z.array(z.string()).default([]),
    deities: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
  }),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SeedManifest = z.infer<typeof SeedManifestSchema>;

// ============================================
// REGION SEED
// ============================================

export const RegionSeedSchema = z.object({
  id: z.string(),

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  type: z.string(), // "nation", "kingdom", etc.

  // Hierarchy
  parentRegionId: z.string().optional(),

  // Description
  description: z.string(),
  overview: z.string().optional(),

  // Geography
  geography: z
    .object({
      climate: z.string().optional(),
      terrain: z.array(z.string()).default([]),
      size: z.string().optional(),
      borders: z
        .array(
          z.object({
            regionId: z.string(),
            type: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Politics
  politics: z
    .object({
      government: z.string().optional(),
      ruler: z.string().optional(),
      rulerTitle: z.string().optional(),
      rulingFaction: z.string().optional(),
      capital: z.string().optional(),
    })
    .optional(),

  // Demographics
  demographics: z
    .object({
      population: z.string().optional(),
      populationNumber: z.number().optional(),
      races: z
        .array(
          z.object({
            race: z.string(),
            percentage: z.number().optional(),
          }),
        )
        .default([]),
      languages: z.array(z.string()).default([]),
      religions: z.array(z.string()).default([]),
    })
    .optional(),

  // Economy
  economy: z
    .object({
      currency: z.string().optional(),
      exports: z.array(z.string()).default([]),
      imports: z.array(z.string()).default([]),
      resources: z.array(z.string()).default([]),
    })
    .optional(),

  // History
  history: z
    .object({
      founded: z.string().optional(),
      majorEvents: z
        .array(
          z.object({
            year: z.string().optional(),
            event: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Current affairs
  currentAffairs: z
    .object({
      tensions: z.array(z.string()).default([]),
      threats: z.array(z.string()).default([]),
      opportunities: z.array(z.string()).default([]),
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

  // References to other seeds
  settlementIds: z.array(z.string()).default([]),
  factionIds: z.array(z.string()).default([]),
  npcIds: z.array(z.string()).default([]),
  locationIds: z.array(z.string()).default([]),
});
export type RegionSeed = z.infer<typeof RegionSeedSchema>;

// ============================================
// SETTLEMENT SEED
// ============================================

export const SettlementSeedSchema = z.object({
  id: z.string(),
  regionId: z.string(),

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  type: z.enum([
    "hamlet",
    "village",
    "town",
    "city",
    "metropolis",
    "fortress",
    "outpost",
    "ruin",
  ]),
  epithet: z.string().optional(), // "City of Splendors"

  // Description
  description: z.string(),
  atmosphere: z.string().optional(),

  // Stats
  population: z
    .object({
      count: z.number().int().optional(),
      description: z.string().optional(), // "~130,000"
      demographics: z
        .array(
          z.object({
            race: z.string(),
            percentage: z.number().optional(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Government
  government: z
    .object({
      type: z.string(),
      ruler: z.string().optional(),
      rulerTitle: z.string().optional(),
      rulingBody: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),

  // Economy
  economy: z
    .object({
      primaryIndustries: z.array(z.string()).default([]),
      exports: z.array(z.string()).default([]),
      imports: z.array(z.string()).default([]),
      currency: z.string().optional(),
      wealthLevel: z.string().optional(),
    })
    .optional(),

  // Defenses
  defenses: z
    .object({
      walls: z.string().optional(),
      guards: z.string().optional(),
      militia: z.string().optional(),
      navy: z.string().optional(),
      special: z.array(z.string()).default([]),
    })
    .optional(),

  // Districts/Wards
  districts: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string().optional(),
        notable: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  // Landmarks
  landmarks: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        significance: z.string().optional(),
      }),
    )
    .default([]),

  // Inns & Taverns
  establishments: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(), // "inn", "tavern", "shop", "temple"
        description: z.string().optional(),
        owner: z.string().optional(),
        priceLevel: z.string().optional(),
      }),
    )
    .default([]),

  // Temples
  temples: z
    .array(
      z.object({
        deity: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        leader: z.string().optional(),
      }),
    )
    .default([]),

  // History
  history: z
    .object({
      founded: z.string().optional(),
      foundedBy: z.string().optional(),
      majorEvents: z
        .array(
          z.object({
            year: z.string().optional(),
            event: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Current affairs
  currentAffairs: z
    .object({
      rumors: z.array(z.string()).default([]),
      tensions: z.array(z.string()).default([]),
      events: z.array(z.string()).default([]),
    })
    .optional(),

  // Adventure hooks
  hooks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        level: z.string().optional(),
        location: z.string().optional(),
      }),
    )
    .default([]),

  // References
  factionIds: z.array(z.string()).default([]),
  npcIds: z.array(z.string()).default([]),
  locationIds: z.array(z.string()).default([]),
});
export type SettlementSeed = z.infer<typeof SettlementSeedSchema>;

// ============================================
// FACTION SEED
// ============================================

export const FactionSeedSchema = z.object({
  id: z.string(),

  // Identity
  name: z.string(),
  alternateNames: z.array(z.string()).default([]),
  type: z.string(), // "secret society", "guild", "government", etc.
  symbol: z.string().optional(),
  motto: z.string().optional(),

  // Description
  description: z.string(),
  overview: z.string().optional(),

  // Goals
  goals: z.object({
    primary: z.string(),
    secondary: z.array(z.string()).default([]),
    beliefs: z.array(z.string()).default([]),
  }),

  // Structure
  structure: z
    .object({
      leaderTitle: z.string().optional(),
      leader: z.string().optional(),
      ranks: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
          }),
        )
        .default([]),
      memberCount: z.string().optional(),
      memberTypes: z.array(z.string()).default([]),
    })
    .optional(),

  // Resources
  resources: z
    .object({
      wealth: z.string().optional(),
      military: z.string().optional(),
      political: z.string().optional(),
      magical: z.string().optional(),
      special: z.array(z.string()).default([]),
    })
    .optional(),

  // Locations
  locations: z
    .object({
      headquarters: z.string().optional(),
      strongholds: z.array(z.string()).default([]),
      sphereOfInfluence: z.array(z.string()).default([]),
    })
    .optional(),

  // Relations
  relations: z
    .array(
      z.object({
        factionId: z.string(),
        factionName: z.string(),
        relation: z.enum([
          "allied",
          "friendly",
          "neutral",
          "rival",
          "hostile",
          "war",
        ]),
        description: z.string().optional(),
      }),
    )
    .default([]),

  // History
  history: z
    .object({
      founded: z.string().optional(),
      founder: z.string().optional(),
      majorEvents: z
        .array(
          z.object({
            year: z.string().optional(),
            event: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Player interaction
  playerInteraction: z
    .object({
      joinRequirements: z.array(z.string()).default([]),
      rankBenefits: z
        .array(
          z.object({
            rank: z.string(),
            benefits: z.array(z.string()),
          }),
        )
        .default([]),
      missions: z.array(z.string()).default([]),
    })
    .optional(),

  // NPCs
  notableMembers: z
    .array(
      z.object({
        npcId: z.string().optional(),
        name: z.string(),
        role: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),

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
});
export type FactionSeed = z.infer<typeof FactionSeedSchema>;

// ============================================
// NPC SEED
// ============================================

export const NPCSeedSchema = z.object({
  id: z.string(),

  // Identity
  name: z.string(),
  titles: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),

  // Basic info
  race: z.string(),
  gender: z.string().optional(),
  age: z.string().optional(),

  // Location
  locationId: z.string().optional(),
  locationName: z.string().optional(),

  // Affiliations
  factionIds: z.array(z.string()).default([]),
  organizations: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
      }),
    )
    .default([]),

  // Description
  description: z.string(),
  appearance: z.string().optional(),
  personality: z.string().optional(),

  // Capabilities (if notable)
  capabilities: z
    .object({
      class: z.string().optional(),
      level: z.number().int().optional(),
      cr: z.string().optional(),
      notable: z.array(z.string()).default([]),
    })
    .optional(),

  // Background
  background: z
    .object({
      origin: z.string().optional(),
      history: z.string().optional(),
      goals: z.array(z.string()).default([]),
      secrets: z.array(z.string()).default([]),
    })
    .optional(),

  // Relationships
  relationships: z
    .array(
      z.object({
        npcId: z.string().optional(),
        name: z.string(),
        relation: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),

  // Status
  status: z
    .object({
      alive: z.boolean().default(true),
      currentActivity: z.string().optional(),
      whereabouts: z.string().optional(),
    })
    .optional(),

  // Player interaction
  interaction: z
    .object({
      initialAttitude: z.string().optional(),
      services: z.array(z.string()).default([]),
      quests: z.array(z.string()).default([]),
      information: z.array(z.string()).default([]),
    })
    .optional(),
});
export type NPCSeed = z.infer<typeof NPCSeedSchema>;

// ============================================
// DEITY SEED
// ============================================

export const DeitySeedSchema = z.object({
  id: z.string(),

  // Identity
  name: z.string(),
  titles: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),

  // Classification
  alignment: z.string(),
  domains: z.array(z.string()).default([]),
  pantheon: z.string().optional(),
  rank: z.string().optional(), // "Greater", "Intermediate", "Lesser", "Demigod"

  // Symbols
  symbol: z.string().optional(),
  symbolDescription: z.string().optional(),
  favoredWeapon: z.string().optional(),
  holyDays: z.array(z.string()).default([]),

  // Description
  description: z.string(),
  portfolio: z.string().optional(), // What they're god of

  // Dogma
  dogma: z
    .object({
      beliefs: z.array(z.string()).default([]),
      commandments: z.array(z.string()).default([]),
      taboos: z.array(z.string()).default([]),
    })
    .optional(),

  // Clergy
  clergy: z
    .object({
      titles: z.array(z.string()).default([]),
      vestments: z.string().optional(),
      requirements: z.array(z.string()).default([]),
      duties: z.array(z.string()).default([]),
    })
    .optional(),

  // Temples
  temples: z
    .object({
      description: z.string().optional(),
      majorTemples: z
        .array(
          z.object({
            name: z.string(),
            location: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Relationships
  relationships: z
    .object({
      allies: z.array(z.string()).default([]),
      enemies: z.array(z.string()).default([]),
      relationships: z
        .array(
          z.object({
            deity: z.string(),
            relation: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // History
  history: z
    .object({
      origin: z.string().optional(),
      majorEvents: z.array(z.string()).default([]),
    })
    .optional(),

  // Game mechanics
  mechanics: z
    .object({
      clericDomains: z.array(z.string()).default([]), // 5e domains
      channelDivinity: z.array(z.string()).default([]),
      blessings: z.array(z.string()).default([]),
    })
    .optional(),
});
export type DeitySeed = z.infer<typeof DeitySeedSchema>;

// ============================================
// SEED LOADER
// ============================================

export interface SeedLoader {
  // Load manifest
  loadManifest(seedId: string): Promise<SeedManifest>;

  // Load individual parts
  loadRegion(seedId: string, regionId: string): Promise<RegionSeed>;
  loadSettlement(seedId: string, settlementId: string): Promise<SettlementSeed>;
  loadFaction(seedId: string, factionId: string): Promise<FactionSeed>;
  loadNPC(seedId: string, npcId: string): Promise<NPCSeed>;
  loadDeity(seedId: string, deityId: string): Promise<DeitySeed>;

  // Load all of a type
  loadAllRegions(seedId: string): Promise<RegionSeed[]>;
  loadAllSettlements(seedId: string): Promise<SettlementSeed[]>;
  loadAllFactions(seedId: string): Promise<FactionSeed[]>;
  loadAllNPCs(seedId: string): Promise<NPCSeed[]>;
  loadAllDeities(seedId: string): Promise<DeitySeed[]>;

  // Install seed into database
  installSeed(
    seedId: string,
    options?: {
      skipExisting?: boolean;
      updateExisting?: boolean;
      selective?: {
        regions?: string[];
        settlements?: string[];
      };
    },
  ): Promise<{
    success: boolean;
    installed: {
      regions: number;
      settlements: number;
      factions: number;
      npcs: number;
      deities: number;
    };
    errors: string[];
  }>;
}

// ============================================
// PLACEHOLDER MANIFESTS
// ============================================

export const FaerunManifest: SeedManifest = {
  id: "faerun",
  name: "Faerûn",
  version: "1.0.0",
  type: "world",
  description:
    "The Forgotten Realms - the most iconic D&D setting. Home to Baldur's Gate, Waterdeep, Neverwinter, and countless adventures.",
  author: "Wizards of the Coast",
  source: "Forgotten Realms Campaign Setting, Sword Coast Adventurer's Guide",
  requires: [],
  contents: {
    worlds: 1,
    regions: 30,
    settlements: 200,
    factions: 50,
    npcs: 150,
    deities: 100,
    locations: 300,
    items: 50,
  },
  files: {
    world: "world.json",
    regions: [
      "regions/sword_coast.json",
      "regions/western_heartlands.json",
      "regions/north.json",
      "regions/cormyr.json",
      "regions/dalelands.json",
      "regions/moonsea.json",
      "regions/vast.json",
      "regions/impiltur.json",
      "regions/thay.json",
      "regions/rashemen.json",
      // ... more regions
    ],
    settlements: [
      "settlements/waterdeep.json",
      "settlements/baldurs_gate.json",
      "settlements/neverwinter.json",
      "settlements/luskan.json",
      "settlements/silverymoon.json",
      "settlements/mithral_hall.json",
      "settlements/menzoberranzan.json",
      "settlements/calimport.json",
      "settlements/suzail.json",
      "settlements/athkatla.json",
      // ... more settlements
    ],
    factions: [
      "factions/harpers.json",
      "factions/zhentarim.json",
      "factions/lords_alliance.json",
      "factions/emerald_enclave.json",
      "factions/order_of_the_gauntlet.json",
      "factions/cult_of_the_dragon.json",
      "factions/red_wizards.json",
      "factions/xanathar_guild.json",
      "factions/flaming_fist.json",
      // ... more factions
    ],
    deities: [
      "deities/faerunian_pantheon.json",
      "deities/elven_seldarine.json",
      "deities/dwarven_mordinsamman.json",
      "deities/drow_dark_seldarine.json",
    ],
  },
  createdAt: "2024-01-01",
  updatedAt: "2024-12-22",
};

export const RealmspaceManifest: SeedManifest = {
  id: "realmspace",
  name: "Realmspace",
  version: "1.0.0",
  type: "crystal_sphere",
  description:
    "The crystal sphere containing Toril. For Spelljammer campaigns starting from the Forgotten Realms.",
  author: "Wizards of the Coast",
  source: "Spelljammer: Adventures in Space",
  requires: ["faerun"],
  contents: {
    worlds: 0, // Uses Faerun's world
    regions: 0,
    settlements: 5, // Space stations, asteroid settlements
    factions: 10,
    npcs: 30,
    deities: 0,
    locations: 15,
    items: 10,
  },
  files: {
    sphere: "sphere.json",
    settlements: [
      "settlements/rock_of_bral.json", // Often included here
      "settlements/h4rn.json",
      "settlements/dragon_rock.json",
    ],
    factions: [
      "factions/elven_imperial_navy.json",
      "factions/arcane.json",
      "factions/scro.json",
      "factions/neogi.json",
    ],
  },
  createdAt: "2024-01-01",
  updatedAt: "2024-12-22",
};
