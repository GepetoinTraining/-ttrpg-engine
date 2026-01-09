import { z } from "zod";

// ============================================
// POINTS OF INTEREST (POI) SYSTEM
// ============================================
//
// Philosophy: POIs are WHERE adventures happen outside towns.
//
// They're not just map markers - they are LIVING ENTITIES that:
//   - Affect the economy (blocked routes, guarded resources)
//   - Are faction assets or targets
//   - Generate adventure hooks
//   - Have consequences when cleared (claims, reputation, economy)
//   - GET WORSE if left unchecked (the world doesn't wait)
//
// POIs are the connective tissue between settlements.
// They're why the road is dangerous.
// They're why iron prices spiked.
// They're why the king is offering 500 gold.
//

// ============================================
// POI TYPES
// ============================================

export const POITypeSchema = z.enum([
  // Dungeons (explorable multi-room structures)
  "dungeon_lair",        // Monster home with boss
  "dungeon_tomb",        // Undead, traps, treasure
  "dungeon_ruins",       // Collapsed civilization
  "dungeon_fortress",    // Military structure
  "dungeon_cave",        // Natural cave system
  "dungeon_temple",      // Religious site (corrupted/abandoned)
  "dungeon_mine",        // Abandoned/infested mine

  // Wilderness Sites (outdoor adventure locations)
  "wilderness_grove",       // Sacred/corrupted natural site
  "wilderness_battlefield", // Historic battle site
  "wilderness_territory",   // Monster hunting ground
  "wilderness_camp",        // Bandit/cult camp
  "wilderness_nest",        // Flying creature lair
  "wilderness_den",         // Beast den

  // Landmarks (notable locations, may not be adventurable)
  "landmark_monument",   // Famous structure
  "landmark_natural",    // Geographic feature (waterfall, peak)
  "landmark_crossing",   // Bridge, ford, pass
  "landmark_ruins",      // Visible ruins (may hide dungeon)
  "landmark_shrine",     // Small religious site
]);
export type POIType = z.infer<typeof POITypeSchema>;

// ============================================
// POI SUBTYPES (creature/theme flavoring)
// ============================================

export const POISubtypeSchema = z.enum([
  // Monster types
  "goblin_warren",
  "orc_stronghold",
  "kobold_tunnels",
  "gnoll_camp",
  "bugbear_lair",
  "hobgoblin_fort",

  // Undead
  "zombie_horde",
  "skeleton_crypt",
  "ghoul_nest",
  "vampire_coven",
  "lich_sanctum",
  "wraith_haunt",

  // Beasts
  "wolf_pack",
  "bear_den",
  "giant_spider_nest",
  "owlbear_lair",
  "wyvern_nest",
  "basilisk_cave",

  // Humanoids
  "bandit_hideout",
  "cultist_sanctum",
  "pirate_cove",
  "smuggler_den",

  // Giants
  "giant_hold",
  "ogre_lair",
  "troll_bridge",
  "hill_giant_steading",

  // Dragons
  "dragon_lair",
  "drake_nest",
  "dragon_cult",

  // Magical
  "fey_crossing",
  "elemental_node",
  "aberrant_hive",
  "construct_facility",
  "wizard_tower",
  "demon_shrine",

  // Natural
  "sacred_grove",
  "cursed_ground",
  "haunted_ruins",
  "ancient_battlefield",
]);
export type POISubtype = z.infer<typeof POISubtypeSchema>;

// ============================================
// DISCOVERY STATE MACHINE
// ============================================

export const POIDiscoveryStateSchema = z.enum([
  "unknown",      // Not on anyone's radar
  "rumored",      // Heard about it (may be inaccurate)
  "confirmed",    // Know it exists and rough location
  "located",      // Know exact location
  "mapped",       // Have detailed layout
  "explored",     // Have been inside
  "cleared",      // Defeated/neutralized (may respawn)
  "claimed",      // Player has claimed ownership
]);
export type POIDiscoveryState = z.infer<typeof POIDiscoveryStateSchema>;

// ============================================
// DISCOVERY METHODS
// ============================================

export const POIDiscoveryMethodSchema = z.enum([
  "exploration",      // Wandering into it
  "tavern_rumor",     // Heard in town
  "map_found",        // Found a map
  "npc_info",         // NPC told them
  "faction_intel",    // Faction provided info
  "quest_revealed",   // Quest pointed here
  "divination",       // Magic revealed it
  "landmark_visible", // Can be seen from distance
  "tracks_followed",  // Followed monster tracks
  "refugee_report",   // Fleeing villagers told them
]);
export type POIDiscoveryMethod = z.infer<typeof POIDiscoveryMethodSchema>;

// ============================================
// THREAT LEVELS
// ============================================

export const POIThreatLevelSchema = z.enum([
  "trivial",     // CR 0-1, no real danger
  "easy",        // CR 2-4, cautious party handles it
  "moderate",    // CR 5-8, challenging but doable
  "hard",        // CR 9-12, dangerous, prepare well
  "deadly",      // CR 13-16, significant risk
  "legendary",   // CR 17-20, campaign-defining
  "mythic",      // CR 21+, world-ending threat
]);
export type POIThreatLevel = z.infer<typeof POIThreatLevelSchema>;

// Threat level to CR range mapping
export const THREAT_LEVEL_CR: Record<POIThreatLevel, { min: number; max: number }> = {
  trivial: { min: 0, max: 1 },
  easy: { min: 2, max: 4 },
  moderate: { min: 5, max: 8 },
  hard: { min: 9, max: 12 },
  deadly: { min: 13, max: 16 },
  legendary: { min: 17, max: 20 },
  mythic: { min: 21, max: 30 },
};

// ============================================
// ENCOUNTER TYPES
// ============================================

export const EncounterTypeSchema = z.enum([
  "combat",         // Fight monsters
  "trap",           // Avoid/disarm traps
  "puzzle",         // Solve puzzles
  "social",         // Negotiate, interrogate
  "environmental",  // Navigate hazards
  "stealth",        // Sneak past enemies
  "chase",          // Pursuit sequences
  "ritual",         // Interrupt/complete rituals
]);
export type EncounterType = z.infer<typeof EncounterTypeSchema>;

// ============================================
// CONTROLLER TYPES
// ============================================

export const POIControllerTypeSchema = z.enum([
  "none",       // Abandoned/empty
  "monster",    // Creature(s) lair here
  "faction",    // Faction controls it
  "npc",        // Individual NPC
  "player",     // Player claimed it
  "contested",  // Multiple claimants
]);
export type POIControllerType = z.infer<typeof POIControllerTypeSchema>;

// ============================================
// DEFENDER STRENGTH
// ============================================

export const DefenderStrengthSchema = z.enum([
  "none",       // Empty
  "minimal",    // 1-3 weak creatures
  "light",      // 4-8 creatures or 1-2 strong
  "moderate",   // 9-15 creatures with leader
  "heavy",      // 16+ creatures, multiple leaders
  "fortress",   // Heavily fortified, boss + lieutenants
]);
export type DefenderStrength = z.infer<typeof DefenderStrengthSchema>;

// ============================================
// ROUTE BLOCKAGE TYPES
// ============================================

export const RouteBlockageTypeSchema = z.enum([
  "total",      // Route completely impassable
  "dangerous",  // Route usable but risky
  "toll",       // Must pay or fight
  "delay",      // Adds travel time
]);
export type RouteBlockageType = z.infer<typeof RouteBlockageTypeSchema>;

// ============================================
// DEGRADATION RATES
// ============================================

export const DegradationRateSchema = z.enum([
  "none",    // Stable, doesn't get worse
  "slow",    // 1% per week
  "normal",  // 2% per week
  "fast",    // 5% per week
]);
export type DegradationRate = z.infer<typeof DegradationRateSchema>;

export const DEGRADATION_RATE_VALUES: Record<DegradationRate, number> = {
  none: 0,
  slow: 1,
  normal: 2,
  fast: 5,
};

// ============================================
// FORTIFICATION LEVELS
// ============================================

export const FortificationLevelSchema = z.enum([
  "none",       // No defenses
  "basic",      // Barricades, simple traps
  "improved",   // Walls, watchtowers
  "strong",     // Fortified walls, gates
  "fortress",   // Castle-level defenses
]);
export type FortificationLevel = z.infer<typeof FortificationLevelSchema>;

// ============================================
// PATROL FREQUENCY
// ============================================

export const PatrolFrequencySchema = z.enum([
  "none",     // No patrols
  "weekly",   // Check once per week
  "daily",    // Check every day
  "constant", // Always manned
]);
export type PatrolFrequency = z.infer<typeof PatrolFrequencySchema>;

// ============================================
// TREASURE HOARD TYPES
// ============================================

export const TreasureHoardTypeSchema = z.enum([
  "none",           // No treasure
  "individual",     // Individual monster loot
  "hoard_cr0-4",    // DMG hoard table CR 0-4
  "hoard_cr5-10",   // DMG hoard table CR 5-10
  "hoard_cr11-16",  // DMG hoard table CR 11-16
  "hoard_cr17+",    // DMG hoard table CR 17+
]);
export type TreasureHoardType = z.infer<typeof TreasureHoardTypeSchema>;

// ============================================
// BOUNTY PROOF TYPES
// ============================================

export const BountyProofTypeSchema = z.enum([
  "none",        // Trust them
  "trophy",      // Body part, item from boss
  "witness",     // NPC who saw
  "item",        // Specific item
  "inspection",  // Issuer verifies in person
]);
export type BountyProofType = z.infer<typeof BountyProofTypeSchema>;

// ============================================
// MAIN POI SCHEMA
// ============================================

export const POISchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // ─────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────
  name: z.string(),
  type: POITypeSchema,
  subtype: POISubtypeSchema.optional(),
  description: z.string().optional(),

  // World Graph Integration
  worldNodeId: z.string().uuid(),   // This POI IS a WorldNode
  regionId: z.string().uuid(),      // Parent region

  // ─────────────────────────────────────────
  // THREAT ASSESSMENT
  // ─────────────────────────────────────────
  threatLevel: POIThreatLevelSchema,

  recommendedLevel: z.object({
    min: z.number().int().min(1).max(20),
    max: z.number().int().min(1).max(20),
  }),

  partySize: z.object({
    min: z.number().int().default(3),
    max: z.number().int().default(6),
  }).optional(),

  // ─────────────────────────────────────────
  // ENCOUNTER PROFILE
  // ─────────────────────────────────────────
  encounters: z.object({
    primaryCreatureType: z.string(),   // "goblinoid", "undead", "beast"
    bossCreature: z.string().optional(), // "Grimtooth, Bugbear Chief"
    encounterTypes: z.array(EncounterTypeSchema),
    estimatedEncounters: z.number().int(),

    // Environmental factors
    lighting: z.enum(["bright", "dim", "dark", "magical_darkness"]).default("dim"),
    terrain: z.array(z.string()).default([]),   // ["difficult", "water", "elevation"]
    hazards: z.array(z.string()).default([]),   // ["poison_gas", "cave_in_risk", "flooding"]
  }),

  // ─────────────────────────────────────────
  // LOOT & REWARDS
  // ─────────────────────────────────────────
  loot: z.object({
    treasureHoard: TreasureHoardTypeSchema.default("individual"),
    guaranteedItems: z.array(z.string()).default([]),  // Specific item IDs
    specialLoot: z.array(z.object({
      description: z.string(),
      value: z.number().optional(),
      questRelated: z.boolean().default(false),
    })).default([]),
    resourceDeposit: z.string().uuid().optional(),  // Links to extraction system
  }),

  // ─────────────────────────────────────────
  // DISCOVERY & KNOWLEDGE
  // ─────────────────────────────────────────
  discovery: z.object({
    state: POIDiscoveryStateSchema.default("unknown"),

    // How it can be discovered
    discoveryMethods: z.array(POIDiscoveryMethodSchema).default(["exploration", "tavern_rumor"]),

    // Distance-based discovery
    visibleFromDistance: z.number().optional(),  // Miles
    signsSeen: z.array(z.string()).default([]),  // "smoke", "tracks", "refugees"

    // Rumor accuracy (for rumored state)
    rumorAccuracy: z.number().min(0).max(1).default(0.7),
    falseRumors: z.array(z.string()).default([]),  // Possible misinformation

    // Who knows about it
    knownToFactions: z.array(z.string().uuid()).default([]),
    knownToParty: z.boolean().default(false),
    discoveredBy: z.string().uuid().optional(),
    discoveredAt: z.string().optional(),
  }),

  // ─────────────────────────────────────────
  // CONTROL & OWNERSHIP
  // ─────────────────────────────────────────
  control: z.object({
    controllerType: POIControllerTypeSchema.default("monster"),
    controllerId: z.string().uuid().optional(),
    controllerName: z.string().optional(),

    // For faction control
    factionInfluence: z.number().int().min(0).max(100).optional(),

    // Defense capability
    defenderCount: z.number().int().default(0),
    defenderStrength: DefenderStrengthSchema.default("moderate"),

    // Alert state (ties into Lair system)
    alertLevel: z.number().int().min(0).max(10).default(0),

    // If cleared
    clearedBy: z.string().uuid().optional(),
    clearedAt: z.string().optional(),
    clearMethod: z.enum(["combat", "negotiation", "stealth", "magic", "other"]).optional(),
  }),

  // ─────────────────────────────────────────
  // ECONOMIC IMPACT
  // ─────────────────────────────────────────
  economics: z.object({
    // Route blocking
    blocksRoutes: z.array(z.object({
      routeId: z.string().uuid(),
      routeName: z.string().optional(),
      blockageType: RouteBlockageTypeSchema,
      dangerLevel: z.number().int().min(0).max(10),
      tollAmount: z.number().optional(),
    })).default([]),

    // Resource guarding
    guardsDeposits: z.array(z.string().uuid()).default([]),  // Extraction deposit IDs

    // Caravan raiding
    raidsCaravans: z.boolean().default(false),
    raidRange: z.number().optional(),        // Miles from POI
    raidFrequency: z.number().optional(),    // Raids per week (0-1)
    raidSeverity: z.enum(["minor", "moderate", "severe", "devastating"]).optional(),

    // Economic opportunity if cleared
    economicBenefitIfCleared: z.object({
      routesOpened: z.array(z.string().uuid()).default([]),
      depositsAccessible: z.array(z.string().uuid()).default([]),
      tradeVolumeIncrease: z.number().optional(),  // Percentage
      priceStabilization: z.array(z.string()).default([]),  // Commodity IDs
    }).optional(),
  }),

  // ─────────────────────────────────────────
  // FACTION CONTEXT
  // ─────────────────────────────────────────
  factionContext: z.object({
    // Bounties offered
    bounties: z.array(z.object({
      factionId: z.string().uuid(),
      factionName: z.string(),
      amount: z.number(),
      additionalRewards: z.array(z.string()).default([]),
      expiresAt: z.string().optional(),
      requiresProof: BountyProofTypeSchema.default("trophy"),
    })).default([]),

    // Faction schemes involving this POI
    involvedInSchemes: z.array(z.object({
      schemeId: z.string().uuid(),
      factionId: z.string().uuid(),
      role: z.enum(["target", "asset", "staging_area", "objective"]),
    })).default([]),

    // Standing changes for clearing
    standingChangesOnClear: z.array(z.object({
      factionId: z.string().uuid(),
      factionName: z.string(),
      change: z.number().int(),
      reason: z.string(),
    })).default([]),
  }),

  // ─────────────────────────────────────────
  // RESPAWN & DEGRADATION
  // ─────────────────────────────────────────
  lifecycle: z.object({
    // Respawn mechanics
    canRespawn: z.boolean().default(true),
    respawnDays: z.number().int().default(30),     // Days until respawn
    respawnConditions: z.array(z.string()).default([]),  // "not_claimed", "no_patrols"
    respawnEscalation: z.boolean().default(true),  // Gets stronger each respawn?
    respawnCount: z.number().int().default(0),

    // Current respawn timer
    respawnAt: z.string().optional(),

    // Degradation if unchecked
    degradationRate: DegradationRateSchema.default("normal"),
    currentDegradation: z.number().int().min(0).max(100).default(0),
    degradationEffects: z.array(z.object({
      threshold: z.number().int(),
      effect: z.string(),  // "threat_increases", "area_expands", "new_boss"
      description: z.string().optional(),
      triggered: z.boolean().default(false),
    })).default([]),

    // Last activity
    lastActivityAt: z.string().optional(),
    lastActivityType: z.string().optional(),
  }),

  // ─────────────────────────────────────────
  // PLAYER CLAIMS
  // ─────────────────────────────────────────
  claim: z.object({
    claimable: z.boolean().default(true),
    claimRequirements: z.array(z.string()).default(["cleared"]),
    claimType: z.string().optional(),  // DeedType from property.ts

    // If claimed
    claimId: z.string().uuid().optional(),
    claimedAt: z.string().optional(),

    // Renovation
    renovationCost: z.number().optional(),
    renovationTime: z.string().optional(),  // "3 months"
    renovationRequirements: z.array(z.string()).default([]),

    // Defense requirements to prevent respawn
    defenseRequirements: z.object({
      minGarrison: z.number().int().default(0),
      fortificationLevel: FortificationLevelSchema.default("none"),
      patrolFrequency: PatrolFrequencySchema.default("none"),
    }).optional(),
  }).optional(),

  // ─────────────────────────────────────────
  // LAIR INTEGRATION
  // ─────────────────────────────────────────
  lairId: z.string().uuid().optional(),  // Links to Lair system for combat

  // ─────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────
  tags: z.array(z.string()).default([]),
  gmNotes: z.string().optional(),
  secret: z.boolean().default(false),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type POI = z.infer<typeof POISchema>;

// ============================================
// POI DEFAULTS BY TYPE
// ============================================

export const POI_TYPE_DEFAULTS: Record<POIType, {
  defaultThreatLevel: POIThreatLevel;
  defaultEncounterTypes: EncounterType[];
  defaultDegradationRate: DegradationRate;
  defaultRespawnDays: number;
  claimType?: string;
}> = {
  // Dungeons
  dungeon_lair: {
    defaultThreatLevel: "moderate",
    defaultEncounterTypes: ["combat", "trap"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 30,
    claimType: "dungeon_claim",
  },
  dungeon_tomb: {
    defaultThreatLevel: "hard",
    defaultEncounterTypes: ["combat", "trap", "puzzle"],
    defaultDegradationRate: "slow",
    defaultRespawnDays: 90,
    claimType: "ruin_claim",
  },
  dungeon_ruins: {
    defaultThreatLevel: "moderate",
    defaultEncounterTypes: ["combat", "environmental", "puzzle"],
    defaultDegradationRate: "slow",
    defaultRespawnDays: 60,
    claimType: "ruin_claim",
  },
  dungeon_fortress: {
    defaultThreatLevel: "hard",
    defaultEncounterTypes: ["combat", "trap", "social"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 45,
    claimType: "fort",
  },
  dungeon_cave: {
    defaultThreatLevel: "easy",
    defaultEncounterTypes: ["combat", "environmental"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 30,
    claimType: "mine",
  },
  dungeon_temple: {
    defaultThreatLevel: "hard",
    defaultEncounterTypes: ["combat", "puzzle", "ritual"],
    defaultDegradationRate: "slow",
    defaultRespawnDays: 120,
    claimType: "temple",
  },
  dungeon_mine: {
    defaultThreatLevel: "moderate",
    defaultEncounterTypes: ["combat", "environmental", "trap"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 45,
    claimType: "mine",
  },

  // Wilderness
  wilderness_grove: {
    defaultThreatLevel: "moderate",
    defaultEncounterTypes: ["combat", "social", "ritual"],
    defaultDegradationRate: "slow",
    defaultRespawnDays: 60,
  },
  wilderness_battlefield: {
    defaultThreatLevel: "moderate",
    defaultEncounterTypes: ["combat", "environmental"],
    defaultDegradationRate: "none",
    defaultRespawnDays: 90,
  },
  wilderness_territory: {
    defaultThreatLevel: "easy",
    defaultEncounterTypes: ["combat", "stealth", "chase"],
    defaultDegradationRate: "fast",
    defaultRespawnDays: 14,
  },
  wilderness_camp: {
    defaultThreatLevel: "easy",
    defaultEncounterTypes: ["combat", "stealth", "social"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 21,
  },
  wilderness_nest: {
    defaultThreatLevel: "moderate",
    defaultEncounterTypes: ["combat", "environmental"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 30,
  },
  wilderness_den: {
    defaultThreatLevel: "easy",
    defaultEncounterTypes: ["combat"],
    defaultDegradationRate: "fast",
    defaultRespawnDays: 14,
  },

  // Landmarks
  landmark_monument: {
    defaultThreatLevel: "trivial",
    defaultEncounterTypes: [],
    defaultDegradationRate: "none",
    defaultRespawnDays: 0,
  },
  landmark_natural: {
    defaultThreatLevel: "trivial",
    defaultEncounterTypes: ["environmental"],
    defaultDegradationRate: "none",
    defaultRespawnDays: 0,
  },
  landmark_crossing: {
    defaultThreatLevel: "easy",
    defaultEncounterTypes: ["combat", "social"],
    defaultDegradationRate: "normal",
    defaultRespawnDays: 30,
  },
  landmark_ruins: {
    defaultThreatLevel: "easy",
    defaultEncounterTypes: ["combat", "puzzle"],
    defaultDegradationRate: "slow",
    defaultRespawnDays: 60,
    claimType: "ruin_claim",
  },
  landmark_shrine: {
    defaultThreatLevel: "trivial",
    defaultEncounterTypes: ["ritual"],
    defaultDegradationRate: "none",
    defaultRespawnDays: 0,
  },
};

// ============================================
// DEGRADATION EFFECT THRESHOLDS
// ============================================

export const STANDARD_DEGRADATION_EFFECTS = [
  { threshold: 25, effect: "scouts_appear", description: "Creatures start scouting nearby area" },
  { threshold: 50, effect: "threat_increases", description: "Threat level increases by one step" },
  { threshold: 75, effect: "area_expands", description: "Area of influence doubles" },
  { threshold: 100, effect: "boss_upgrade", description: "New boss or reinforcements arrive" },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a new POI with sensible defaults based on type.
 */
export function createPOI(
  base: {
    id: string;
    campaignId: string;
    name: string;
    type: POIType;
    worldNodeId: string;
    regionId: string;
    subtype?: POISubtype;
    primaryCreatureType: string;
  }
): POI {
  const defaults = POI_TYPE_DEFAULTS[base.type];
  const now = new Date().toISOString();

  return {
    id: base.id,
    campaignId: base.campaignId,
    name: base.name,
    type: base.type,
    subtype: base.subtype,
    worldNodeId: base.worldNodeId,
    regionId: base.regionId,

    threatLevel: defaults.defaultThreatLevel,
    recommendedLevel: {
      min: THREAT_LEVEL_CR[defaults.defaultThreatLevel].min + 1,
      max: THREAT_LEVEL_CR[defaults.defaultThreatLevel].max,
    },

    encounters: {
      primaryCreatureType: base.primaryCreatureType,
      encounterTypes: defaults.defaultEncounterTypes,
      estimatedEncounters: 5,
      lighting: "dim",
      terrain: [],
      hazards: [],
    },

    loot: {
      treasureHoard: "individual",
      guaranteedItems: [],
      specialLoot: [],
    },

    discovery: {
      state: "unknown",
      discoveryMethods: ["exploration", "tavern_rumor"],
      signsSeen: [],
      rumorAccuracy: 0.7,
      falseRumors: [],
      knownToFactions: [],
      knownToParty: false,
    },

    control: {
      controllerType: "monster",
      defenderCount: 10,
      defenderStrength: "moderate",
      alertLevel: 0,
    },

    economics: {
      blocksRoutes: [],
      guardsDeposits: [],
      raidsCaravans: false,
    },

    factionContext: {
      bounties: [],
      involvedInSchemes: [],
      standingChangesOnClear: [],
    },

    lifecycle: {
      canRespawn: true,
      respawnDays: defaults.defaultRespawnDays,
      respawnConditions: ["not_claimed", "no_patrols"],
      respawnEscalation: true,
      respawnCount: 0,
      degradationRate: defaults.defaultDegradationRate,
      currentDegradation: 0,
      degradationEffects: STANDARD_DEGRADATION_EFFECTS.map(e => ({
        ...e,
        triggered: false,
      })),
    },

    claim: defaults.claimType ? {
      claimable: true,
      claimRequirements: ["cleared"],
      claimType: defaults.claimType,
      renovationRequirements: [],
      defenseRequirements: {
        minGarrison: 5,
        fortificationLevel: "basic",
        patrolFrequency: "weekly",
      },
    } : undefined,

    secret: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check if a POI should respawn.
 */
export function shouldRespawn(poi: POI, currentDate: Date): boolean {
  if (!poi.lifecycle.canRespawn) return false;
  if (poi.control.controllerType === "player") return false;
  if (!poi.lifecycle.respawnAt) return false;

  const respawnDate = new Date(poi.lifecycle.respawnAt);
  return currentDate >= respawnDate;
}

/**
 * Calculate days until respawn.
 */
export function daysUntilRespawn(poi: POI, currentDate: Date): number | null {
  if (!poi.lifecycle.canRespawn) return null;
  if (poi.control.controllerType === "player") return null;
  if (!poi.lifecycle.respawnAt) return null;

  const respawnDate = new Date(poi.lifecycle.respawnAt);
  const diff = respawnDate.getTime() - currentDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get the next threat level (for escalation).
 */
export function escalateThreatLevel(current: POIThreatLevel): POIThreatLevel {
  const levels: POIThreatLevel[] = [
    "trivial", "easy", "moderate", "hard", "deadly", "legendary", "mythic"
  ];
  const idx = levels.indexOf(current);
  return levels[Math.min(idx + 1, levels.length - 1)];
}
