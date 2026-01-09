import { z } from "zod";
import { CreatureTypeSchema } from "./population";

// ============================================
// SPAWNING DUNGEON SYSTEM
// ============================================
//
// Philosophy: DUNGEONS BLEED MONSTERS
//
// A "spawning dungeon" is a POI that generates creatures:
//   - Goblin warrens birth more goblins
//   - Necromancer towers raise undead
//   - Demon portals summon fiends
//   - Hives produce swarms
//
// If unchecked, these monsters SPILL into the surrounding region.
// The dungeon must be "capped" (cleared) or it keeps producing.
//

// ============================================
// SPAWNER TYPES
// ============================================

export const SpawnerTypeSchema = z.enum([
  "breeding_ground",    // Natural reproduction (goblin warren)
  "summoning_circle",   // Magical summoning (demon portal)
  "necromantic_source", // Raises dead (graveyard, lich lair)
  "hive_queen",         // Queen produces (insectoids)
  "corruption_node",    // Corrupts creatures (aberrant)
  "elemental_rift",     // Planar bleed (elemental nodes)
  "construct_factory",  // Builds creatures (wizard lab)
  "curse_wellspring",   // Curse creates (lycanthropy, vampirism)
]);
export type SpawnerType = z.infer<typeof SpawnerTypeSchema>;

// ============================================
// SPAWNER STATE
// ============================================

export const SpawnerStateSchema = z.enum([
  "dormant",      // Not actively spawning
  "active",       // Normal spawning rate
  "accelerated",  // Increased spawning (threat response)
  "frenzy",       // Maximum spawning (desperate)
  "depleted",     // Temporarily exhausted
  "capped",       // Cleared/sealed by adventurers
  "destroyed",    // Permanently disabled
]);
export type SpawnerState = z.infer<typeof SpawnerStateSchema>;

// ============================================
// CONTROLLER TYPE
// ============================================

export const ControllerTypeSchema = z.enum([
  "queen",          // Biological (hive queen)
  "necromancer",    // Magical controller
  "summoner",       // Binds creatures
  "leader",         // Social leader
  "none",           // No controller
]);
export type ControllerType = z.infer<typeof ControllerTypeSchema>;

// ============================================
// SPAWNER SCHEMA
// ============================================

export const SpawnerSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Location
  poiId: z.string().uuid(),
  poiName: z.string(),
  regionId: z.string().uuid(),

  // Link to Lair system
  lairId: z.string().uuid().optional(),

  // Spawner identity
  name: z.string(),
  type: SpawnerTypeSchema,

  // What it produces
  output: z.object({
    primarySpeciesId: z.string(),
    primarySpeciesName: z.string(),
    secondarySpecies: z.array(z.object({
      speciesId: z.string(),
      speciesName: z.string(),
      ratio: z.number().min(0).max(1),
    })).default([]),

    creatureType: CreatureTypeSchema,
    baseCR: z.number(),
    crVariance: z.number().default(0.5),
  }),

  // Production rates
  production: z.object({
    baseOutputPerWeek: z.number().int(),
    currentOutputPerWeek: z.number().int(),

    modifiers: z.array(z.object({
      source: z.string(),
      multiplier: z.number(),
      expires: z.string().optional(),
    })).default([]),

    // Resource requirements
    requiresCorpses: z.boolean().default(false),
    requiresMagic: z.boolean().default(false),
    requiresBiomass: z.boolean().default(false),
    resourcesAvailable: z.number().default(100),
  }),

  // Capacity
  capacity: z.object({
    internalCapacity: z.number().int(),
    currentInternal: z.number().int(),
    spilloverThreshold: z.number().default(0.8),
    spilloverRate: z.number().default(0.2),
  }),

  // Current state
  state: SpawnerStateSchema.default("active"),
  stateChangedAt: z.string().optional(),
  stateExpiresAt: z.string().optional(),

  // Boss/Controller
  controller: z.object({
    exists: z.boolean(),
    name: z.string().optional(),
    creatureId: z.string().uuid().optional(),
    controlType: ControllerTypeSchema.default("none"),

    onControllerDeath: z.object({
      spawnRateChange: z.number().default(-0.5),
      stateChange: SpawnerStateSchema.optional(),
      durationDays: z.number().int().optional(),
    }).optional(),
  }),

  // Spillover tracking
  spillover: z.object({
    totalSpilled: z.number().int().default(0),
    spilloverThisWeek: z.number().int().default(0),

    targetRegions: z.array(z.object({
      regionId: z.string().uuid(),
      weight: z.number(),
    })).default([]),

    fedPopulationIds: z.array(z.string().uuid()).default([]),
  }),

  // Threat response
  threatResponse: z.object({
    awarenessLevel: z.number().min(0).max(10).default(0),
    acceleratedThreshold: z.number().default(3),
    frenzyThreshold: z.number().default(7),

    clearedBefore: z.boolean().default(false),
    clearAttempts: z.number().int().default(0),
    lastClearAttempt: z.string().optional(),

    canCallReinforcements: z.boolean().default(true),
    reinforcementsAvailable: z.number().int().default(0),
  }),

  // Capping requirements
  capping: z.object({
    requiresBossKill: z.boolean().default(true),
    requiresRitual: z.boolean().default(false),
    requiresDestruction: z.boolean().default(false),
    requiresSealing: z.boolean().default(false),

    cappingRequirements: z.array(z.string()).default([]),

    canBeTemporarilyCapped: z.boolean().default(true),
    temporaryCapDurationDays: z.number().int().default(30),
  }),

  // History
  history: z.array(z.object({
    week: z.number().int(),
    produced: z.number().int(),
    spilled: z.number().int(),
    state: SpawnerStateSchema,
    event: z.string().optional(),
  })).default([]),

  // Director integration
  directorData: z.object({
    contributionToThreat: z.number().default(0),
    adaptationsApplied: z.array(z.string()).default([]),
  }),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Spawner = z.infer<typeof SpawnerSchema>;

// ============================================
// SPAWNER OUTPUT CALCULATION
// ============================================

export interface SpawnerOutput {
  speciesId: string;
  speciesName: string;
  count: number;
  cr: number;
  destination: "internal" | "spillover";
  targetRegionId?: string;
}

export function calculateWeeklyOutput(
  spawner: Spawner,
  daysElapsed: number = 7,
): SpawnerOutput[] {
  const outputs: SpawnerOutput[] = [];

  // Non-producing states
  if (
    spawner.state === "capped" ||
    spawner.state === "destroyed" ||
    spawner.state === "dormant"
  ) {
    return outputs;
  }

  // Calculate effective output
  let outputMultiplier = 1;

  switch (spawner.state) {
    case "accelerated":
      outputMultiplier = 1.5;
      break;
    case "frenzy":
      outputMultiplier = 2.5;
      break;
    case "depleted":
      outputMultiplier = 0.25;
      break;
  }

  // Apply resource availability
  outputMultiplier *= spawner.production.resourcesAvailable / 100;

  // Apply modifiers
  for (const mod of spawner.production.modifiers) {
    outputMultiplier *= mod.multiplier;
  }

  // Calculate scaled production
  const weeklyOutput = spawner.production.currentOutputPerWeek * outputMultiplier;
  const totalOutput = Math.floor(weeklyOutput * (daysElapsed / 7));

  if (totalOutput <= 0) return outputs;

  // Distribute between primary and secondary species
  const primaryRatio = 1 - spawner.output.secondarySpecies.reduce((sum, s) => sum + s.ratio, 0);
  const primaryCount = Math.floor(totalOutput * primaryRatio);

  // Check capacity for spillover
  const capacityUsed = spawner.capacity.currentInternal / spawner.capacity.internalCapacity;
  const spilloverNeeded = capacityUsed >= spawner.capacity.spilloverThreshold;

  // Primary species output
  if (primaryCount > 0) {
    if (spilloverNeeded) {
      const spillCount = Math.floor(primaryCount * spawner.capacity.spilloverRate);
      const internalCount = primaryCount - spillCount;

      if (internalCount > 0) {
        outputs.push({
          speciesId: spawner.output.primarySpeciesId,
          speciesName: spawner.output.primarySpeciesName,
          count: internalCount,
          cr: spawner.output.baseCR,
          destination: "internal",
        });
      }

      if (spillCount > 0) {
        const targetRegion = spawner.spillover.targetRegions[0]?.regionId;
        outputs.push({
          speciesId: spawner.output.primarySpeciesId,
          speciesName: spawner.output.primarySpeciesName,
          count: spillCount,
          cr: spawner.output.baseCR,
          destination: "spillover",
          targetRegionId: targetRegion,
        });
      }
    } else {
      outputs.push({
        speciesId: spawner.output.primarySpeciesId,
        speciesName: spawner.output.primarySpeciesName,
        count: primaryCount,
        cr: spawner.output.baseCR,
        destination: "internal",
      });
    }
  }

  // Secondary species output
  for (const secondary of spawner.output.secondarySpecies) {
    const count = Math.floor(totalOutput * secondary.ratio);
    if (count > 0) {
      outputs.push({
        speciesId: secondary.speciesId,
        speciesName: secondary.speciesName,
        count,
        cr: spawner.output.baseCR * 1.5,
        destination: spilloverNeeded ? "spillover" : "internal",
        targetRegionId: spilloverNeeded ? spawner.spillover.targetRegions[0]?.regionId : undefined,
      });
    }
  }

  return outputs;
}

// ============================================
// SPAWNER STATE TRANSITIONS
// ============================================

export function updateSpawnerState(
  spawner: Spawner,
  awarenessChange: number,
  currentDate: string,
): Spawner {
  const newSpawner = { ...spawner };
  newSpawner.threatResponse.awarenessLevel = Math.max(
    0,
    Math.min(10, spawner.threatResponse.awarenessLevel + awarenessChange)
  );

  const awareness = newSpawner.threatResponse.awarenessLevel;

  // State transitions based on awareness
  if (spawner.state === "active" || spawner.state === "accelerated" || spawner.state === "frenzy") {
    if (awareness >= spawner.threatResponse.frenzyThreshold) {
      newSpawner.state = "frenzy";
      newSpawner.stateChangedAt = currentDate;
    } else if (awareness >= spawner.threatResponse.acceleratedThreshold) {
      newSpawner.state = "accelerated";
      newSpawner.stateChangedAt = currentDate;
    } else {
      newSpawner.state = "active";
    }
  }

  return newSpawner;
}

export function capSpawner(
  spawner: Spawner,
  bossKilled: boolean,
  ritualPerformed: boolean,
  currentDate: string,
): Spawner {
  const newSpawner = { ...spawner };

  // Check if fully capped
  const canFullyCap =
    (!spawner.capping.requiresBossKill || bossKilled) &&
    (!spawner.capping.requiresRitual || ritualPerformed) &&
    !spawner.capping.requiresDestruction &&
    !spawner.capping.requiresSealing;

  if (canFullyCap) {
    newSpawner.state = "capped";
    newSpawner.stateChangedAt = currentDate;
  } else if (spawner.capping.canBeTemporarilyCapped) {
    newSpawner.state = "depleted";
    newSpawner.stateChangedAt = currentDate;
    newSpawner.stateExpiresAt = new Date(
      new Date(currentDate).getTime() + spawner.capping.temporaryCapDurationDays * 24 * 60 * 60 * 1000
    ).toISOString();
  }

  newSpawner.threatResponse.clearAttempts++;
  newSpawner.threatResponse.lastClearAttempt = currentDate;
  newSpawner.threatResponse.clearedBefore = true;

  return newSpawner;
}

export function onControllerDeath(
  spawner: Spawner,
  currentDate: string,
): Spawner {
  if (!spawner.controller.exists || !spawner.controller.onControllerDeath) {
    return spawner;
  }

  const newSpawner = { ...spawner };
  const deathEffect = spawner.controller.onControllerDeath;

  // Apply spawn rate change
  newSpawner.production.currentOutputPerWeek = Math.floor(
    spawner.production.baseOutputPerWeek * (1 + deathEffect.spawnRateChange)
  );

  // Apply state change
  if (deathEffect.stateChange) {
    newSpawner.state = deathEffect.stateChange;
    newSpawner.stateChangedAt = currentDate;

    if (deathEffect.durationDays) {
      newSpawner.stateExpiresAt = new Date(
        new Date(currentDate).getTime() + deathEffect.durationDays * 24 * 60 * 60 * 1000
      ).toISOString();
    }
  }

  newSpawner.controller.exists = false;

  return newSpawner;
}

// ============================================
// SPAWNER TEMPLATES
// ============================================

export const SPAWNER_TEMPLATES: Record<string, Partial<Spawner>> = {
  goblin_warren: {
    type: "breeding_ground",
    output: {
      primarySpeciesId: "goblin",
      primarySpeciesName: "Goblin",
      secondarySpecies: [
        { speciesId: "hobgoblin", speciesName: "Hobgoblin", ratio: 0.1 },
        { speciesId: "bugbear", speciesName: "Bugbear", ratio: 0.05 },
      ],
      creatureType: "humanoid",
      baseCR: 0.25,
      crVariance: 0.25,
    },
    production: {
      baseOutputPerWeek: 5,
      currentOutputPerWeek: 5,
      modifiers: [],
      requiresCorpses: false,
      requiresMagic: false,
      requiresBiomass: false,
      resourcesAvailable: 100,
    },
    capacity: {
      internalCapacity: 50,
      currentInternal: 25,
      spilloverThreshold: 0.8,
      spilloverRate: 0.2,
    },
    capping: {
      requiresBossKill: true,
      requiresRitual: false,
      requiresDestruction: false,
      requiresSealing: false,
      cappingRequirements: [],
      canBeTemporarilyCapped: true,
      temporaryCapDurationDays: 30,
    },
  },

  undead_crypt: {
    type: "necromantic_source",
    output: {
      primarySpeciesId: "skeleton",
      primarySpeciesName: "Skeleton",
      secondarySpecies: [
        { speciesId: "zombie", speciesName: "Zombie", ratio: 0.5 },
        { speciesId: "ghoul", speciesName: "Ghoul", ratio: 0.2 },
      ],
      creatureType: "undead",
      baseCR: 0.25,
      crVariance: 0.5,
    },
    production: {
      baseOutputPerWeek: 3,
      currentOutputPerWeek: 3,
      modifiers: [],
      requiresCorpses: true,
      requiresMagic: true,
      requiresBiomass: false,
      resourcesAvailable: 100,
    },
    capacity: {
      internalCapacity: 100,
      currentInternal: 50,
      spilloverThreshold: 0.9,
      spilloverRate: 0.1,
    },
    capping: {
      requiresBossKill: true,
      requiresRitual: true,
      requiresDestruction: false,
      requiresSealing: false,
      cappingRequirements: ["holy_water", "consecration_ritual"],
      canBeTemporarilyCapped: true,
      temporaryCapDurationDays: 14,
    },
  },

  demon_portal: {
    type: "summoning_circle",
    output: {
      primarySpeciesId: "dretch",
      primarySpeciesName: "Dretch",
      secondarySpecies: [
        { speciesId: "quasit", speciesName: "Quasit", ratio: 0.3 },
      ],
      creatureType: "fiend",
      baseCR: 0.25,
      crVariance: 1,
    },
    production: {
      baseOutputPerWeek: 2,
      currentOutputPerWeek: 2,
      modifiers: [],
      requiresCorpses: false,
      requiresMagic: true,
      requiresBiomass: false,
      resourcesAvailable: 100,
    },
    capacity: {
      internalCapacity: 30,
      currentInternal: 10,
      spilloverThreshold: 0.7,
      spilloverRate: 0.3,
    },
    capping: {
      requiresBossKill: false,
      requiresRitual: true,
      requiresDestruction: false,
      requiresSealing: true,
      cappingRequirements: ["dispel_magic_5th", "portal_key"],
      canBeTemporarilyCapped: false,
      temporaryCapDurationDays: 0,
    },
  },

  spider_nest: {
    type: "hive_queen",
    output: {
      primarySpeciesId: "giant_spider",
      primarySpeciesName: "Giant Spider",
      secondarySpecies: [
        { speciesId: "swarm_spiders", speciesName: "Spider Swarm", ratio: 0.4 },
      ],
      creatureType: "beast",
      baseCR: 1,
      crVariance: 0.5,
    },
    production: {
      baseOutputPerWeek: 4,
      currentOutputPerWeek: 4,
      modifiers: [],
      requiresCorpses: false,
      requiresMagic: false,
      requiresBiomass: true,
      resourcesAvailable: 100,
    },
    capacity: {
      internalCapacity: 40,
      currentInternal: 20,
      spilloverThreshold: 0.75,
      spilloverRate: 0.25,
    },
    controller: {
      exists: true,
      controlType: "queen",
      onControllerDeath: {
        spawnRateChange: -0.8,
        stateChange: "depleted",
        durationDays: 60,
      },
    },
    capping: {
      requiresBossKill: true,
      requiresRitual: false,
      requiresDestruction: true,
      requiresSealing: false,
      cappingRequirements: ["destroy_egg_sacs"],
      canBeTemporarilyCapped: true,
      temporaryCapDurationDays: 60,
    },
  },

  elemental_rift: {
    type: "elemental_rift",
    output: {
      primarySpeciesId: "fire_elemental",
      primarySpeciesName: "Fire Elemental",
      secondarySpecies: [
        { speciesId: "magmin", speciesName: "Magmin", ratio: 0.6 },
      ],
      creatureType: "elemental",
      baseCR: 5,
      crVariance: 2,
    },
    production: {
      baseOutputPerWeek: 1,
      currentOutputPerWeek: 1,
      modifiers: [],
      requiresCorpses: false,
      requiresMagic: true,
      requiresBiomass: false,
      resourcesAvailable: 100,
    },
    capacity: {
      internalCapacity: 10,
      currentInternal: 3,
      spilloverThreshold: 0.6,
      spilloverRate: 0.4,
    },
    capping: {
      requiresBossKill: false,
      requiresRitual: true,
      requiresDestruction: false,
      requiresSealing: true,
      cappingRequirements: ["elemental_binding_ritual", "opposing_element"],
      canBeTemporarilyCapped: true,
      temporaryCapDurationDays: 7,
    },
  },

  aberrant_corruption: {
    type: "corruption_node",
    output: {
      primarySpeciesId: "gibbering_mouther",
      primarySpeciesName: "Gibbering Mouther",
      secondarySpecies: [
        { speciesId: "nothic", speciesName: "Nothic", ratio: 0.2 },
      ],
      creatureType: "aberration",
      baseCR: 2,
      crVariance: 1,
    },
    production: {
      baseOutputPerWeek: 1,
      currentOutputPerWeek: 1,
      modifiers: [],
      requiresCorpses: true,
      requiresMagic: true,
      requiresBiomass: true,
      resourcesAvailable: 100,
    },
    capacity: {
      internalCapacity: 15,
      currentInternal: 5,
      spilloverThreshold: 0.8,
      spilloverRate: 0.15,
    },
    capping: {
      requiresBossKill: false,
      requiresRitual: true,
      requiresDestruction: true,
      requiresSealing: false,
      cappingRequirements: ["purification_ritual", "destroy_corruption_heart"],
      canBeTemporarilyCapped: false,
      temporaryCapDurationDays: 0,
    },
  },
};

// ============================================
// SPAWNER FACTORY
// ============================================

export function createSpawnerFromTemplate(
  templateId: string,
  poiId: string,
  poiName: string,
  regionId: string,
  campaignId: string,
  targetRegionIds: string[] = [],
): Spawner | null {
  const template = SPAWNER_TEMPLATES[templateId];
  if (!template) return null;

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    campaignId,
    poiId,
    poiName,
    regionId,
    name: `${template.output?.primarySpeciesName} ${template.type}`,
    type: template.type!,
    output: template.output as Spawner["output"],
    production: template.production as Spawner["production"],
    capacity: template.capacity as Spawner["capacity"],
    state: "active",
    controller: template.controller || { exists: false, controlType: "none" },
    spillover: {
      totalSpilled: 0,
      spilloverThisWeek: 0,
      targetRegions: targetRegionIds.map((id, i) => ({
        regionId: id,
        weight: 1 / (i + 1),
      })),
      fedPopulationIds: [],
    },
    threatResponse: {
      awarenessLevel: 0,
      acceleratedThreshold: 3,
      frenzyThreshold: 7,
      clearedBefore: false,
      clearAttempts: 0,
      canCallReinforcements: true,
      reinforcementsAvailable: Math.floor((template.capacity?.currentInternal || 10) * 0.5),
    },
    capping: template.capping as Spawner["capping"],
    history: [],
    directorData: {
      contributionToThreat: 0,
      adaptationsApplied: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}
