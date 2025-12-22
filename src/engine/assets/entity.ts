import { z } from "zod";
import { CreatureSchema, PlayerCharacterSchema } from "../rules/creature";
import { SizeSchema } from "../grid/types";

// ============================================
// UNIVERSAL ASSET SYSTEM
// ============================================
//
// Philosophy: LAZY-LOADED WORLDBUILDING
//
// Everything starts as a stub. One name, maybe a role.
// As players interact, it gains depth.
// One button generates the next level.
// Eventually, full integration into the campaign.
//
// This mirrors how GMs actually work:
// - "There's a blacksmith" (stub)
// - Players talk to him (basic)
// - He becomes important (full)
// - He's now a recurring character (integrated)
//
// The system tracks detail level and can generate
// the next level on demand.
//

// ============================================
// DETAIL LEVELS (Universal)
// ============================================

export const DetailLevelSchema = z.enum([
  "stub", // Just a name/type. "A blacksmith"
  "basic", // Key traits, role. "Torvak, grumpy dwarf smith"
  "developed", // Full stats/details. Complete stat block, motivations
  "full", // Rich content. Backstory, connections, voice
  "integrated", // Campaign-woven. Faction ties, quest hooks, relationships
]);
export type DetailLevel = z.infer<typeof DetailLevelSchema>;

export const DetailLevelRequirements: Record<DetailLevel, string[]> = {
  stub: ["name", "type"],
  basic: ["name", "type", "description", "keyTraits"],
  developed: [
    "name",
    "type",
    "description",
    "keyTraits",
    "stats",
    "motivations",
  ],
  full: [
    "name",
    "type",
    "description",
    "keyTraits",
    "stats",
    "motivations",
    "backstory",
    "connections",
    "voice",
  ],
  integrated: [
    "name",
    "type",
    "description",
    "keyTraits",
    "stats",
    "motivations",
    "backstory",
    "connections",
    "voice",
    "campaignRole",
    "factionTies",
    "questHooks",
  ],
};

// ============================================
// ASSET TYPES
// ============================================

export const AssetTypeSchema = z.enum([
  "npc",
  "location",
  "item",
  "faction",
  "creature", // Monster/beast (not NPC)
  "vehicle",
  "organization",
  "event", // Historical or upcoming
  "secret",
  "rumor",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

// ============================================
// BASE ASSET (shared fields)
// ============================================

export const BaseAssetSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  assetType: AssetTypeSchema,

  // Detail tracking
  detailLevel: DetailLevelSchema.default("stub"),
  lastDetailedAt: z.date().optional(),
  detailHistory: z
    .array(
      z.object({
        level: DetailLevelSchema,
        generatedAt: z.date(),
        triggeredBy: z.string(), // "Player interaction", "GM request", "Quest need"
      }),
    )
    .default([]),

  // Quick reference (always populated)
  oneLiner: z.string().optional(), // "Grumpy dwarf blacksmith who hates elves"

  // Tags for search/filter
  tags: z.array(z.string()).default([]),

  // Source tracking
  source: z
    .enum([
      "generated", // AI created
      "imported", // From SRD/book
      "manual", // GM created
      "promoted", // From rabbit hole
    ])
    .default("generated"),
  sourceReference: z.string().optional(), // "MM p.45", "Rabbit hole #xyz"

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),

  // Soft delete
  archived: z.boolean().default(false),
});
export type BaseAsset = z.infer<typeof BaseAssetSchema>;

// ============================================
// NPC ASSET
// ============================================

export const NpcStubSchema = BaseAssetSchema.extend({
  assetType: z.literal("npc"),

  // STUB level (minimum)
  role: z.string().optional(), // "Blacksmith", "Guard", "Merchant"
  species: z.string().default("Human"),
});

export const NpcBasicSchema = NpcStubSchema.extend({
  // BASIC level
  description: z.string(),

  keyTraits: z.object({
    personality: z.array(z.string()).max(3), // ["Grumpy", "Honest"]
    appearance: z.string().optional(),
    quirk: z.string().optional(),
  }),

  // Quick stats (not full stat block)
  quickStats: z
    .object({
      cr: z.string().optional(),
      ac: z.number().int().optional(),
      hp: z.number().int().optional(),
      mainAbility: z.string().optional(), // "Strong", "Clever", "Charismatic"
    })
    .optional(),

  // What they know (simple)
  knowledgeAreas: z.array(z.string()).default([]), // ["Local gossip", "Smithing", "Old wars"]
});

export const NpcDevelopedSchema = NpcBasicSchema.extend({
  // DEVELOPED level - full stat block
  statBlock: CreatureSchema.optional(),

  // Motivations
  motivations: z.object({
    wants: z.array(z.string()), // ["Wealth", "Respect"]
    fears: z.array(z.string()), // ["Poverty", "Orcs"]
    bonds: z.array(z.string()), // ["Family", "Guild"]
    secrets: z.array(z.string()), // Things they hide
  }),

  // Knowledge (detailed)
  knowledge: z.array(
    z.object({
      topic: z.string(),
      depth: z.enum(["surface", "informed", "expert"]),
      willShare: z.boolean(),
      requiresPersuasion: z.number().int().optional(), // DC
    }),
  ),

  // Inventory (if relevant)
  notableItems: z
    .array(
      z.object({
        name: z.string(),
        significance: z.string().optional(),
      }),
    )
    .default([]),
});

export const NpcFullSchema = NpcDevelopedSchema.extend({
  // FULL level
  backstory: z.object({
    summary: z.string(),
    keyEvents: z.array(
      z.object({
        event: z.string(),
        impact: z.string(),
      }),
    ),
    origin: z.string().optional(),
  }),

  // Connections to other entities
  connections: z
    .array(
      z.object({
        entityId: z.string().uuid(),
        entityName: z.string(),
        entityType: AssetTypeSchema,
        relationship: z.string(), // "Enemy", "Lover", "Employer"
        details: z.string().optional(),
      }),
    )
    .default([]),

  // Voice/RP guidance
  voice: z.object({
    accent: z.string().optional(),
    speechPattern: z.string().optional(), // "Formal", "Crude", "Verbose"
    vocabulary: z.string().optional(), // "Uses nautical terms"
    examplePhrases: z.array(z.string()).default([]),
    voiceProfileId: z.string().uuid().optional(), // For TTS
  }),

  // Daily routine (for encounter planning)
  routine: z
    .object({
      morning: z.string().optional(),
      afternoon: z.string().optional(),
      evening: z.string().optional(),
      location: z.string().optional(), // Where they usually are
    })
    .optional(),
});

export const NpcIntegratedSchema = NpcFullSchema.extend({
  // INTEGRATED level
  campaignRole: z.object({
    importance: z.enum(["minor", "supporting", "major", "critical"]),
    arcInvolvement: z.array(z.string().uuid()).default([]), // Which arcs they're in
    questInvolvement: z.array(z.string().uuid()).default([]),
    potentialArcs: z.array(z.string()).default([]), // Possible future storylines
  }),

  // Faction ties
  factionTies: z
    .array(
      z.object({
        factionId: z.string().uuid(),
        factionName: z.string(),
        role: z.string(), // "Member", "Leader", "Spy", "Enemy"
        publicKnowledge: z.boolean(),
      }),
    )
    .default([]),

  // Quest hooks this NPC can provide
  questHooks: z
    .array(
      z.object({
        hookId: z.string().uuid(),
        description: z.string(),
        questType: z.string(),
        available: z.boolean(),
        prerequisites: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  // Relationship with party
  partyRelationship: z
    .object({
      disposition: z.number().int().min(-100).max(100).default(0),
      history: z
        .array(
          z.object({
            event: z.string(),
            date: z.string().optional(),
            impactOnDisposition: z.number().int(),
          }),
        )
        .default([]),
      currentStatus: z.string().optional(), // "Ally", "Neutral", "Hostile"
    })
    .optional(),

  // AI memory (for NPC agent)
  aiMemory: z
    .object({
      memories: z
        .array(
          z.object({
            content: z.string(),
            timestamp: z.string(),
            importance: z.number().int().min(1).max(10),
            emotional: z.boolean(),
          }),
        )
        .default([]),
      lastInteraction: z.date().optional(),
      partyKnowledge: z.array(z.string()).default([]), // What this NPC knows about party
    })
    .optional(),
});

// Union type for any NPC detail level
export const NpcAssetSchema = z.union([
  NpcStubSchema,
  NpcBasicSchema,
  NpcDevelopedSchema,
  NpcFullSchema,
  NpcIntegratedSchema,
]);
export type NpcAsset = z.infer<typeof NpcAssetSchema>;

// ============================================
// LOCATION ASSET
// ============================================

export const LocationTypeSchema = z.enum([
  "city",
  "town",
  "village",
  "hamlet",
  "dungeon",
  "wilderness",
  "building",
  "room",
  "landmark",
  "region",
  "plane",
  "poi", // Point of interest
]);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const LocationStubSchema = BaseAssetSchema.extend({
  assetType: z.literal("location"),
  locationType: LocationTypeSchema,

  // Parent location (for hierarchy)
  parentLocationId: z.string().uuid().optional(),
});

export const LocationBasicSchema = LocationStubSchema.extend({
  description: z.string(),

  // Sensory
  atmosphere: z
    .object({
      sight: z.string(),
      sound: z.string().optional(),
      smell: z.string().optional(),
      feel: z.string().optional(), // Temperature, humidity, etc.
    })
    .optional(),

  // Key features
  keyFeatures: z.array(z.string()).default([]),

  // Population (for settlements)
  population: z
    .object({
      size: z
        .enum(["empty", "sparse", "small", "medium", "large", "metropolis"])
        .optional(),
      demographics: z.string().optional(), // "Mostly humans, some dwarves"
    })
    .optional(),

  // Governance
  governance: z
    .object({
      type: z.string().optional(), // "Duchy", "Theocracy", "Anarchy"
      leader: z.string().optional(),
    })
    .optional(),
});

export const LocationDevelopedSchema = LocationBasicSchema.extend({
  // Key NPCs here
  keyNpcs: z
    .array(
      z.object({
        npcId: z.string().uuid().optional(),
        name: z.string(),
        role: z.string(), // "Mayor", "Blacksmith", "Crime boss"
      }),
    )
    .default([]),

  // Sub-locations
  subLocations: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string(),
        type: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),

  // Services available
  services: z
    .array(
      z.object({
        type: z.string(), // "Inn", "Smith", "Temple"
        name: z.string().optional(),
        quality: z.enum(["poor", "average", "good", "excellent"]).optional(),
        priceModifier: z.number().optional(), // 1.0 = normal, 1.5 = 50% more expensive
      }),
    )
    .default([]),

  // Current situation
  currentEvents: z.array(z.string()).default([]), // "Festival next week", "Orc raids"

  // Travel info
  travel: z
    .object({
      nearbyLocations: z
        .array(
          z.object({
            name: z.string(),
            direction: z.string(),
            distance: z.string(),
            travelTime: z.string(),
          }),
        )
        .default([]),
      terrain: z.string().optional(),
      roads: z.string().optional(),
    })
    .optional(),
});

export const LocationFullSchema = LocationDevelopedSchema.extend({
  // History
  history: z
    .object({
      summary: z.string(),
      foundingDate: z.string().optional(),
      keyEvents: z
        .array(
          z.object({
            event: z.string(),
            date: z.string().optional(),
            impact: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Secrets
  secrets: z
    .array(
      z.object({
        id: z.string().uuid(),
        description: z.string(),
        knownBy: z.array(z.string().uuid()).default([]), // NPC IDs who know
        discoveryMethod: z.string(),
      }),
    )
    .default([]),

  // Economy
  economy: z
    .object({
      primaryIndustry: z.string().optional(),
      wealthLevel: z
        .enum(["destitute", "poor", "modest", "wealthy", "rich"])
        .optional(),
      tradeGoods: z.array(z.string()).default([]),
      currency: z.string().optional(),
    })
    .optional(),

  // Religion
  religion: z
    .object({
      primaryDeity: z.string().optional(),
      temples: z.array(z.string()).default([]),
      religiousConflicts: z.string().optional(),
    })
    .optional(),

  // Law & Order
  law: z
    .object({
      enforcementLevel: z
        .enum(["none", "minimal", "moderate", "strict", "oppressive"])
        .optional(),
      guards: z.string().optional(),
      laws: z.array(z.string()).default([]), // Notable local laws
      punishment: z.string().optional(),
    })
    .optional(),

  // Map data
  mapData: z
    .object({
      hasMap: z.boolean().default(false),
      mapUrl: z.string().optional(),
      gridConfig: z
        .object({
          width: z.number().int(),
          height: z.number().int(),
          scale: z.number(),
        })
        .optional(),
    })
    .optional(),
});

export const LocationIntegratedSchema = LocationFullSchema.extend({
  // Campaign role
  campaignRole: z.object({
    importance: z.enum(["minor", "supporting", "major", "critical"]),
    arcInvolvement: z.array(z.string().uuid()).default([]),
    questsAvailable: z.array(z.string().uuid()).default([]),
  }),

  // Faction presence
  factionPresence: z
    .array(
      z.object({
        factionId: z.string().uuid(),
        factionName: z.string(),
        influence: z.enum([
          "none",
          "minor",
          "moderate",
          "major",
          "controlling",
        ]),
        publicPresence: z.boolean(),
        headquarters: z.boolean(),
      }),
    )
    .default([]),

  // Party history here
  partyHistory: z
    .array(
      z.object({
        sessionId: z.string().uuid(),
        event: z.string(),
        date: z.string().optional(),
        reputation: z.number().int().optional(),
      }),
    )
    .default([]),

  // Active hooks
  activeHooks: z
    .array(
      z.object({
        hookId: z.string().uuid(),
        description: z.string(),
        questId: z.string().uuid().optional(),
        available: z.boolean(),
      }),
    )
    .default([]),
});

export const LocationAssetSchema = z.union([
  LocationStubSchema,
  LocationBasicSchema,
  LocationDevelopedSchema,
  LocationFullSchema,
  LocationIntegratedSchema,
]);
export type LocationAsset = z.infer<typeof LocationAssetSchema>;

// ============================================
// ITEM ASSET
// ============================================

export const ItemRaritySchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "artifact",
]);
export type ItemRarity = z.infer<typeof ItemRaritySchema>;

export const ItemStubSchema = BaseAssetSchema.extend({
  assetType: z.literal("item"),
  itemType: z.string(), // "Weapon", "Armor", "Potion", "Wondrous"
  rarity: ItemRaritySchema.optional(),
});

export const ItemBasicSchema = ItemStubSchema.extend({
  description: z.string(),

  // Quick stats
  properties: z.object({
    magical: z.boolean().default(false),
    attunement: z.boolean().default(false),
    cursed: z.boolean().default(false),
    sentient: z.boolean().default(false),
  }),

  value: z
    .object({
      gp: z.number().optional(),
      priceless: z.boolean().default(false),
    })
    .optional(),
});

export const ItemDevelopedSchema = ItemBasicSchema.extend({
  // Full mechanics
  mechanics: z.object({
    bonuses: z
      .array(
        z.object({
          type: z.string(), // "Attack", "AC", "Save DC"
          value: z.string(), // "+1", "+2", "Advantage"
        }),
      )
      .default([]),
    abilities: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          charges: z.number().int().optional(),
          recharge: z.string().optional(),
        }),
      )
      .default([]),
    requirements: z.array(z.string()).default([]),
  }),

  // Physical description
  physical: z
    .object({
      appearance: z.string(),
      weight: z.string().optional(),
      size: z.string().optional(),
    })
    .optional(),
});

export const ItemFullSchema = ItemDevelopedSchema.extend({
  // History & lore
  lore: z
    .object({
      origin: z.string().optional(),
      creator: z.string().optional(),
      previousOwners: z
        .array(
          z.object({
            name: z.string(),
            fate: z.string().optional(),
          }),
        )
        .default([]),
      legends: z.array(z.string()).default([]),
    })
    .optional(),

  // If sentient
  sentience: z
    .object({
      intelligence: z.number().int(),
      wisdom: z.number().int(),
      charisma: z.number().int(),
      alignment: z.string(),
      personality: z.string(),
      purpose: z.string(),
      communication: z.string(), // "Telepathy", "Speech", "Emotions"
      conflict: z.string().optional(), // When it might conflict with wielder
    })
    .optional(),

  // If cursed
  curse: z
    .object({
      effect: z.string(),
      trigger: z.string(),
      removal: z.string(),
    })
    .optional(),
});

export const ItemIntegratedSchema = ItemFullSchema.extend({
  campaignRole: z.object({
    importance: z.enum(["mundane", "useful", "significant", "macguffin"]),
    questInvolvement: z.array(z.string().uuid()).default([]),
    currentHolder: z.string().uuid().optional(),
    soughtBy: z.array(z.string().uuid()).default([]), // Who wants it
  }),
});

export const ItemAssetSchema = z.union([
  ItemStubSchema,
  ItemBasicSchema,
  ItemDevelopedSchema,
  ItemFullSchema,
  ItemIntegratedSchema,
]);
export type ItemAsset = z.infer<typeof ItemAssetSchema>;

// ============================================
// FACTION ASSET
// ============================================

export const FactionStubSchema = BaseAssetSchema.extend({
  assetType: z.literal("faction"),
  factionType: z.string().optional(), // "Guild", "Religious order", "Crime syndicate"
});

export const FactionBasicSchema = FactionStubSchema.extend({
  description: z.string(),

  // Core identity
  identity: z.object({
    motto: z.string().optional(),
    symbol: z.string().optional(),
    colors: z.string().optional(),
    publicGoal: z.string(),
  }),

  // Size & scope
  scope: z.object({
    size: z.enum(["tiny", "small", "medium", "large", "vast"]),
    reach: z.enum([
      "local",
      "regional",
      "national",
      "continental",
      "global",
      "planar",
    ]),
    headquarters: z.string().optional(),
  }),
});

export const FactionDevelopedSchema = FactionBasicSchema.extend({
  // Leadership
  leadership: z.object({
    structure: z.string(), // "Hierarchy", "Council", "Single leader"
    leader: z
      .object({
        npcId: z.string().uuid().optional(),
        name: z.string(),
        title: z.string(),
      })
      .optional(),
    innerCircle: z
      .array(
        z.object({
          npcId: z.string().uuid().optional(),
          name: z.string(),
          role: z.string(),
        }),
      )
      .default([]),
  }),

  // Goals (public & secret)
  goals: z.object({
    public: z.array(z.string()),
    secret: z.array(z.string()).default([]),
    methods: z.array(z.string()).default([]),
  }),

  // Resources
  resources: z.object({
    wealth: z.enum(["poor", "modest", "wealthy", "rich", "vast"]).optional(),
    military: z
      .enum(["none", "minimal", "moderate", "strong", "army"])
      .optional(),
    political: z
      .enum(["none", "minimal", "moderate", "strong", "dominant"])
      .optional(),
    magical: z
      .enum(["none", "minimal", "moderate", "strong", "legendary"])
      .optional(),
  }),

  // Membership
  membership: z.object({
    requirements: z.array(z.string()).default([]),
    ranks: z
      .array(
        z.object({
          name: z.string(),
          requirements: z.string().optional(),
          privileges: z.string().optional(),
        }),
      )
      .default([]),
    numbers: z.string().optional(),
  }),
});

export const FactionFullSchema = FactionDevelopedSchema.extend({
  // History
  history: z
    .object({
      founding: z.string().optional(),
      keyEvents: z
        .array(
          z.object({
            event: z.string(),
            date: z.string().optional(),
            impact: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Relationships with other factions
  relationships: z
    .array(
      z.object({
        factionId: z.string().uuid().optional(),
        factionName: z.string(),
        relationship: z.enum([
          "allied",
          "friendly",
          "neutral",
          "rival",
          "hostile",
          "war",
        ]),
        details: z.string().optional(),
      }),
    )
    .default([]),

  // Locations
  locations: z
    .array(
      z.object({
        locationId: z.string().uuid().optional(),
        name: z.string(),
        type: z.string(), // "Headquarters", "Safehouse", "Temple"
        isSecret: z.boolean().default(false),
      }),
    )
    .default([]),

  // Secrets
  secrets: z
    .array(
      z.object({
        id: z.string().uuid(),
        secret: z.string(),
        knownBy: z.enum([
          "leadership_only",
          "inner_circle",
          "members",
          "rumored",
        ]),
      }),
    )
    .default([]),
});

export const FactionIntegratedSchema = FactionFullSchema.extend({
  campaignRole: z.object({
    alignment: z.enum(["ally", "neutral", "enemy", "complicated"]),
    importance: z.enum(["minor", "supporting", "major", "central"]),
    arcInvolvement: z.array(z.string().uuid()).default([]),
    activeAgenda: z.string().optional(),
  }),

  // Party standing
  partyRelationship: z.object({
    standing: z.number().int().min(-100).max(100).default(0),
    rank: z.string().optional(), // If party has joined
    history: z
      .array(
        z.object({
          event: z.string(),
          impact: z.number().int(),
          date: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // Active plots
  activePlots: z
    .array(
      z.object({
        plotId: z.string().uuid(),
        description: z.string(),
        status: z.enum(["planning", "active", "completed", "foiled"]),
        partyAware: z.boolean(),
      }),
    )
    .default([]),
});

export const FactionAssetSchema = z.union([
  FactionStubSchema,
  FactionBasicSchema,
  FactionDevelopedSchema,
  FactionFullSchema,
  FactionIntegratedSchema,
]);
export type FactionAsset = z.infer<typeof FactionAssetSchema>;

// ============================================
// DETAIL GENERATION REQUEST
// ============================================

export const DetailGenerationRequestSchema = z.object({
  assetId: z.string().uuid(),
  assetType: AssetTypeSchema,
  currentLevel: DetailLevelSchema,
  targetLevel: DetailLevelSchema,

  // Current data
  currentData: z.record(z.unknown()),

  // Context
  context: z.object({
    campaignSetting: z.string(),
    campaignTone: z.string().optional(),
    nearbyLocations: z.array(z.string()).optional(),
    relatedFactions: z.array(z.string()).optional(),
    relatedNpcs: z.array(z.string()).optional(),
    activeQuests: z.array(z.string()).optional(),
    partyLevel: z.number().int().optional(),
  }),

  // Constraints
  constraints: z
    .object({
      mustInclude: z.array(z.string()).optional(), // "Must be connected to the cult"
      mustAvoid: z.array(z.string()).optional(), // "Not a mage"
      tonePreference: z.string().optional(), // "Dark", "Comedic"
      importanceHint: z.string().optional(), // "Will be recurring"
    })
    .optional(),
});
export type DetailGenerationRequest = z.infer<
  typeof DetailGenerationRequestSchema
>;

// ============================================
// THE BIG BUTTON: DEEPEN ASSET
// ============================================

export interface DeepenAssetResult {
  success: boolean;
  previousLevel: DetailLevel;
  newLevel: DetailLevel;
  updatedAsset: BaseAsset;
  generatedFields: string[];
  suggestedConnections: Array<{
    entityId?: string;
    entityName: string;
    entityType: AssetType;
    suggestedRelationship: string;
  }>;
}

export function buildDeepenPrompt(
  request: DetailGenerationRequestSchema,
): string {
  const {
    assetType,
    currentLevel,
    targetLevel,
    currentData,
    context,
    constraints,
  } = request;

  const levelDescriptions: Record<DetailLevel, string> = {
    stub: "Just a name and type. Minimal information.",
    basic: "Key traits, description, and role. Enough to roleplay briefly.",
    developed:
      "Full stats, motivations, and detailed knowledge. Ready for extended interaction.",
    full: "Complete backstory, connections, voice guidance. A fully realized entity.",
    integrated:
      "Campaign-woven with faction ties, quest hooks, and relationship tracking.",
  };

  return `
# DEEPEN ASSET: ${assetType.toUpperCase()}

You are expanding a ${assetType} from "${currentLevel}" to "${targetLevel}" detail level.

## CURRENT LEVEL: ${currentLevel}
${levelDescriptions[currentLevel]}

## TARGET LEVEL: ${targetLevel}
${levelDescriptions[targetLevel]}

## CURRENT DATA
${JSON.stringify(currentData, null, 2)}

## CAMPAIGN CONTEXT
Setting: ${context.campaignSetting}
${context.campaignTone ? `Tone: ${context.campaignTone}` : ""}
${context.nearbyLocations?.length ? `Nearby: ${context.nearbyLocations.join(", ")}` : ""}
${context.relatedFactions?.length ? `Factions: ${context.relatedFactions.join(", ")}` : ""}
${context.relatedNpcs?.length ? `NPCs: ${context.relatedNpcs.join(", ")}` : ""}
${context.partyLevel ? `Party Level: ${context.partyLevel}` : ""}

## CONSTRAINTS
${constraints?.mustInclude?.length ? `MUST INCLUDE: ${constraints.mustInclude.join(", ")}` : ""}
${constraints?.mustAvoid?.length ? `MUST AVOID: ${constraints.mustAvoid.join(", ")}` : ""}
${constraints?.tonePreference ? `TONE: ${constraints.tonePreference}` : ""}
${constraints?.importanceHint ? `IMPORTANCE: ${constraints.importanceHint}` : ""}

## YOUR TASK

Generate ALL the fields required for "${targetLevel}" level that are not already present.

For ${assetType}, the ${targetLevel} level requires:
${DetailLevelRequirements[targetLevel].join(", ")}

Be consistent with existing data. Expand, don't contradict.

Make suggestions for connections to:
- Other NPCs (relationships, history)
- Locations (where they go, where they're from)
- Factions (membership, opposition)
- Active quests (could be involved in)

OUTPUT FORMAT:
Provide the generated fields as JSON, plus a list of suggested connections.
`.trim();
}

// ============================================
// QUICK SHEET (One-click stat block)
// ============================================

export const QuickSheetRequestSchema = z.object({
  name: z.string(),
  role: z.string(), // "Guard", "Bandit", "Noble"
  context: z.string().optional(), // "In a tavern fight"
  cr: z.string().optional(), // "1/4", "5"
  species: z.string().optional(),
  notableAbility: z.string().optional(), // "Should be a spellcaster"
});
export type QuickSheetRequest = z.infer<typeof QuickSheetRequestSchema>;

export function buildQuickSheetPrompt(request: QuickSheetRequest): string {
  return `
Generate a quick combat stat block for:

Name: ${request.name}
Role: ${request.role}
${request.cr ? `CR: ${request.cr}` : "CR: Appropriate for role"}
${request.species ? `Species: ${request.species}` : ""}
${request.context ? `Context: ${request.context}` : ""}
${request.notableAbility ? `Notable: ${request.notableAbility}` : ""}

Provide:
1. AC, HP, Speed
2. Ability scores (STR/DEX/CON/INT/WIS/CHA)
3. Key skills (2-3)
4. One or two attacks with to-hit and damage
5. One special ability if appropriate
6. Two personality traits for roleplay

Keep it simple and usable in combat NOW.
`.trim();
}

// ============================================
// UI: THE DEEPEN BUTTON
// ============================================

/*
┌─────────────────────────────────────────────────────────────┐
│  TORVAK                                          [NPC] 🔵   │
│  "Grumpy dwarf blacksmith"                      BASIC      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Personality: Grumpy, Honest, Perfectionist                 │
│  Role: Blacksmith                                           │
│  Knows about: Smithing, Local gossip, Old wars              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         DETAIL LEVEL: ████████░░░░░ BASIC           │    │
│  │                                                     │    │
│  │  STUB → BASIC → DEVELOPED → FULL → INTEGRATED      │    │
│  │           ↑                                         │    │
│  │      You are here                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📊 QUICK SHEET    │  ⬆️ DEEPEN TO DEVELOPED          │    │
│  │ (Combat stats)    │  (Full stats, motivations,      │    │
│  │                   │   detailed knowledge)            │    │
│  └───────────────────┴─────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ⬆️⬆️ FULL CHARACTER                                  │    │
│  │ (Backstory, connections, voice guide)               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Recent interactions: Session 3, Session 7                  │
│  [Edit Manually]  [Archive]  [Connect to...]               │
└─────────────────────────────────────────────────────────────┘
*/
