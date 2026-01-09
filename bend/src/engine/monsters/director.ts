import { z } from "zod";

// ============================================
// WORLD DIRECTOR SYSTEM
// ============================================
//
// Philosophy: THE WORLD LEARNS
//
// Inspired by extraction shooter directors:
//   - Track what kills adventurers
//   - Reinforce successful monster types
//   - Prune ineffective threats
//   - Evolve regional adaptations
//
// The world becomes HARDER if players fail, EASIER if they succeed.
// But "harder" means DIFFERENT, not just "more HP".
//

// ============================================
// THREAT OUTCOMES
// ============================================

export const ThreatOutcomeSchema = z.enum([
  "party_victory",      // Adventurers won decisively
  "party_retreat",      // Adventurers fled
  "party_defeat",       // TPK or near-TPK
  "mutual_destruction", // Both sides devastated
  "negotiated",         // Resolved without combat
  "avoided",            // Encounter avoided entirely
]);
export type ThreatOutcome = z.infer<typeof ThreatOutcomeSchema>;

// ============================================
// ENCOUNTER RECORD
// ============================================

export const EncounterRecordSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // When/where
  occurredAt: z.string(),
  regionId: z.string().uuid(),
  poiId: z.string().uuid().optional(),

  // Participants - monster side
  monsterSide: z.object({
    speciesIds: z.array(z.string()),
    totalCount: z.number().int(),
    totalCR: z.number(),
    hadLeader: z.boolean(),
    tactics: z.array(z.string()).default([]),
  }),

  // Participants - adventurer side
  adventurerSide: z.object({
    partyId: z.string().uuid(),
    partyLevel: z.number(),
    partySize: z.number().int(),
    characterIds: z.array(z.string().uuid()),
  }),

  // Outcome
  outcome: ThreatOutcomeSchema,

  // Casualties
  casualties: z.object({
    monsterDeaths: z.number().int(),
    adventurerDeaths: z.number().int(),
    adventurerDowns: z.number().int(),
  }),

  // Effectiveness metrics
  effectiveness: z.object({
    damageDealtToParty: z.number(),
    damageReceivedFromParty: z.number(),
    roundsLasted: z.number().int(),

    effectiveTactics: z.array(z.string()).default([]),
    effectiveAbilities: z.array(z.string()).default([]),
    ineffectiveTactics: z.array(z.string()).default([]),
    countered: z.array(z.string()).default([]),
  }),

  // Environmental factors
  environment: z.object({
    terrain: z.string().optional(),
    lighting: z.string().optional(),
    usedLairActions: z.boolean().default(false),
    usedTraps: z.boolean().default(false),
  }),
});
export type EncounterRecord = z.infer<typeof EncounterRecordSchema>;

// ============================================
// SPECIES FITNESS
// ============================================

export const SpeciesFitnessSchema = z.object({
  speciesId: z.string(),
  speciesName: z.string(),
  regionId: z.string().uuid(),

  // Win/loss tracking
  encounters: z.number().int().default(0),
  victories: z.number().int().default(0),
  defeats: z.number().int().default(0),
  draws: z.number().int().default(0),

  // Effectiveness score (0.2-2.5, 1 = average)
  fitness: z.number().default(1),

  // Kill/death metrics
  adventurersKilled: z.number().int().default(0),
  adventurersRouted: z.number().int().default(0),
  totalDamageDealt: z.number().default(0),

  // Survival metrics
  averageSurvivalRounds: z.number().default(0),
  averageSurvivalRate: z.number().default(0),

  // What's working
  effectiveTactics: z.array(z.object({
    tactic: z.string(),
    successRate: z.number(),
    useCount: z.number().int(),
  })).default([]),

  effectiveAbilities: z.array(z.object({
    ability: z.string(),
    damageContribution: z.number(),
    useCount: z.number().int(),
  })).default([]),

  // What's not working
  countered: z.array(z.object({
    counter: z.string(),
    effectiveness: z.number(),
  })).default([]),

  // Trend
  trend: z.enum(["declining", "stable", "rising"]).default("stable"),
  lastUpdated: z.string(),
});
export type SpeciesFitness = z.infer<typeof SpeciesFitnessSchema>;

// ============================================
// REGIONAL THREAT LEVEL
// ============================================

export const RegionalThreatLevelSchema = z.object({
  regionId: z.string().uuid(),
  regionName: z.string(),

  // Overall threat (0-10 scale)
  currentThreat: z.number().min(0).max(10).default(5),
  baseThreat: z.number().min(0).max(10).default(5),

  // Threat modifiers
  modifiers: z.array(z.object({
    source: z.string(),
    modifier: z.number(),
    expires: z.string().optional(),
  })).default([]),

  // Violence index (rises on party deaths, falls on successes)
  violenceIndex: z.number().min(0).max(10).default(5),

  // History
  history: z.array(z.object({
    week: z.number().int(),
    threat: z.number(),
    violenceIndex: z.number(),
    majorEvent: z.string().optional(),
  })).default([]),

  // Active threats
  dominantSpecies: z.array(z.object({
    speciesId: z.string(),
    speciesName: z.string(),
    populationId: z.string().uuid(),
    threatContribution: z.number(),
    fitness: z.number(),
  })).default([]),

  // Adaptations active in this region
  activeAdaptations: z.array(z.string()).default([]),

  lastUpdated: z.string(),
});
export type RegionalThreatLevel = z.infer<typeof RegionalThreatLevelSchema>;

// ============================================
// ADAPTATION TYPES
// ============================================

export const AdaptationTypeSchema = z.enum([
  // Defensive
  "increased_hp",
  "damage_resistance",
  "condition_immunity",
  "improved_ac",
  "regeneration",

  // Offensive
  "increased_damage",
  "multiattack_upgrade",
  "new_ability",
  "pack_tactics",
  "ambush_tactics",

  // Environmental
  "terrain_adaptation",
  "darkvision_upgrade",
  "burrow_speed",
  "climb_speed",

  // Behavioral
  "flee_threshold_lower",
  "call_reinforcements",
  "better_positioning",
  "focus_fire",

  // Counter-specific
  "fire_resistance",
  "cold_resistance",
  "lightning_resistance",
  "magic_resistance",
  "martial_defense",
]);
export type AdaptationType = z.infer<typeof AdaptationTypeSchema>;

// ============================================
// ADAPTATION SCHEMA
// ============================================

export const AdaptationSchema = z.object({
  id: z.string().uuid(),
  type: AdaptationTypeSchema,
  name: z.string(),
  description: z.string(),

  // Requirements
  requirements: z.object({
    minFitness: z.number().default(1.2),
    minEncounters: z.number().int().default(3),
    triggeredBy: z.array(z.string()).default([]),
  }),

  // Effects
  effects: z.object({
    crIncrease: z.number().default(0),
    hpMultiplier: z.number().default(1),
    damageMultiplier: z.number().default(1),
    acBonus: z.number().int().default(0),
    newAbilities: z.array(z.string()).default([]),
    behaviorChanges: z.array(z.string()).default([]),
  }),

  // Spread
  spreadChance: z.number().default(0.1),
  generational: z.boolean().default(true),
});
export type Adaptation = z.infer<typeof AdaptationSchema>;

// ============================================
// EVOLUTION CYCLE RESULT
// ============================================

export const EvolutionCycleResultSchema = z.object({
  cycleWeek: z.number().int(),
  processedAt: z.string(),

  fitnessChanges: z.array(z.object({
    speciesId: z.string(),
    regionId: z.string().uuid(),
    previousFitness: z.number(),
    newFitness: z.number(),
    reason: z.string(),
  })),

  populationAdjustments: z.array(z.object({
    populationId: z.string().uuid(),
    speciesId: z.string(),
    regionId: z.string().uuid(),
    spawnWeightChange: z.number(),
    reason: z.string(),
  })),

  adaptationsGranted: z.array(z.object({
    speciesId: z.string(),
    regionId: z.string().uuid(),
    adaptation: AdaptationTypeSchema,
    reason: z.string(),
  })),

  adaptationsRemoved: z.array(z.object({
    speciesId: z.string(),
    regionId: z.string().uuid(),
    adaptation: AdaptationTypeSchema,
    reason: z.string(),
  })),

  threatChanges: z.array(z.object({
    regionId: z.string().uuid(),
    previousThreat: z.number(),
    newThreat: z.number(),
    reason: z.string(),
  })),

  summary: z.string(),
});
export type EvolutionCycleResult = z.infer<typeof EvolutionCycleResultSchema>;

// ============================================
// PARTY PROFILE (for counter-adaptations)
// ============================================

export const PartyProfileSchema = z.object({
  partyId: z.string().uuid(),

  // Combat profile
  preferredDamageTypes: z.array(z.string()).default([]),
  preferredTactics: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),

  // Success metrics
  totalEncounters: z.number().int().default(0),
  victories: z.number().int().default(0),
  averageEncounterDuration: z.number().default(0),

  lastUpdated: z.string(),
});
export type PartyProfile = z.infer<typeof PartyProfileSchema>;

// ============================================
// WORLD DIRECTOR STATE
// ============================================

export const WorldDirectorStateSchema = z.object({
  campaignId: z.string().uuid(),

  // Global settings
  settings: z.object({
    evolutionEnabled: z.boolean().default(true),
    adaptationRate: z.number().default(1),
    threatAdjustmentRate: z.number().default(1),
    violenceDecayRate: z.number().default(0.1),
  }),

  // Species fitness by region
  speciesFitness: z.array(SpeciesFitnessSchema).default([]),

  // Regional threat levels
  regionalThreats: z.array(RegionalThreatLevelSchema).default([]),

  // Active adaptations by species+region
  activeAdaptations: z.array(z.object({
    speciesId: z.string(),
    regionId: z.string().uuid(),
    adaptations: z.array(AdaptationTypeSchema),
    grantedAt: z.string(),
  })).default([]),

  // Encounter history
  recentEncounters: z.array(EncounterRecordSchema).default([]),

  // Evolution tracking
  lastEvolutionCycle: z.number().int().default(0),
  evolutionHistory: z.array(EvolutionCycleResultSchema).default([]),

  // Party profiles
  partyProfiles: z.array(PartyProfileSchema).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorldDirectorState = z.infer<typeof WorldDirectorStateSchema>;

// ============================================
// STANDARD ADAPTATIONS
// ============================================

export const STANDARD_ADAPTATIONS: Adaptation[] = [
  {
    id: crypto.randomUUID(),
    type: "fire_resistance",
    name: "Fire-Hardened",
    description: "Creatures develop resistance to fire damage",
    requirements: {
      minFitness: 1.0,
      minEncounters: 3,
      triggeredBy: ["fire_damage", "fireball", "burning_hands"],
    },
    effects: {
      crIncrease: 0.5,
      hpMultiplier: 1,
      damageMultiplier: 1,
      acBonus: 0,
      newAbilities: ["fire_resistance"],
      behaviorChanges: [],
    },
    spreadChance: 0.15,
    generational: true,
  },
  {
    id: crypto.randomUUID(),
    type: "magic_resistance",
    name: "Spell-Scarred",
    description: "Exposure to magic grants resistance",
    requirements: {
      minFitness: 1.0,
      minEncounters: 4,
      triggeredBy: ["spell_damage", "save_spells", "caster_heavy_party"],
    },
    effects: {
      crIncrease: 1,
      hpMultiplier: 1,
      damageMultiplier: 1,
      acBonus: 0,
      newAbilities: ["magic_resistance"],
      behaviorChanges: ["target_casters"],
    },
    spreadChance: 0.1,
    generational: true,
  },
  {
    id: crypto.randomUUID(),
    type: "pack_tactics",
    name: "Coordinated Hunters",
    description: "Creatures learn to attack in coordinated groups",
    requirements: {
      minFitness: 1.2,
      minEncounters: 5,
      triggeredBy: ["numerical_advantage", "group_combat"],
    },
    effects: {
      crIncrease: 0.5,
      hpMultiplier: 1,
      damageMultiplier: 1.2,
      acBonus: 0,
      newAbilities: ["pack_tactics"],
      behaviorChanges: ["attack_same_target"],
    },
    spreadChance: 0.2,
    generational: false,
  },
  {
    id: crypto.randomUUID(),
    type: "ambush_tactics",
    name: "Shadow Hunters",
    description: "Creatures learn to ambush from hiding",
    requirements: {
      minFitness: 1.3,
      minEncounters: 4,
      triggeredBy: ["successful_surprise", "stealth_kills"],
    },
    effects: {
      crIncrease: 0.5,
      hpMultiplier: 1,
      damageMultiplier: 1,
      acBonus: 0,
      newAbilities: ["cunning_action_hide"],
      behaviorChanges: ["ambush_preferred", "stealth_approach"],
    },
    spreadChance: 0.15,
    generational: false,
  },
  {
    id: crypto.randomUUID(),
    type: "increased_hp",
    name: "Hardy Stock",
    description: "Only the toughest survive, breeding hardier offspring",
    requirements: {
      minFitness: 1.1,
      minEncounters: 5,
      triggeredBy: ["high_survival_rate"],
    },
    effects: {
      crIncrease: 0.25,
      hpMultiplier: 1.25,
      damageMultiplier: 1,
      acBonus: 0,
      newAbilities: [],
      behaviorChanges: [],
    },
    spreadChance: 0.25,
    generational: true,
  },
  {
    id: crypto.randomUUID(),
    type: "focus_fire",
    name: "Predator Instinct",
    description: "Creatures learn to focus on weak targets",
    requirements: {
      minFitness: 1.2,
      minEncounters: 3,
      triggeredBy: ["downed_adventurers", "kill_secured"],
    },
    effects: {
      crIncrease: 0.25,
      hpMultiplier: 1,
      damageMultiplier: 1,
      acBonus: 0,
      newAbilities: [],
      behaviorChanges: ["target_low_hp", "target_casters", "finish_downed"],
    },
    spreadChance: 0.2,
    generational: false,
  },
  {
    id: crypto.randomUUID(),
    type: "flee_threshold_lower",
    name: "Desperate Fighters",
    description: "Creatures fight to the death more often",
    requirements: {
      minFitness: 0.8,
      minEncounters: 5,
      triggeredBy: ["frequent_routing", "high_casualties"],
    },
    effects: {
      crIncrease: 0.25,
      hpMultiplier: 1,
      damageMultiplier: 1.1,
      acBonus: 0,
      newAbilities: [],
      behaviorChanges: ["fight_to_death", "no_retreat"],
    },
    spreadChance: 0.15,
    generational: false,
  },
  {
    id: crypto.randomUUID(),
    type: "call_reinforcements",
    name: "War Cries",
    description: "Creatures learn to call for backup",
    requirements: {
      minFitness: 1.1,
      minEncounters: 4,
      triggeredBy: ["outnumbered", "losing_battle"],
    },
    effects: {
      crIncrease: 0.5,
      hpMultiplier: 1,
      damageMultiplier: 1,
      acBonus: 0,
      newAbilities: ["call_reinforcements"],
      behaviorChanges: ["alert_nearby"],
    },
    spreadChance: 0.2,
    generational: false,
  },
];

// ============================================
// FITNESS CALCULATION
// ============================================

export function calculateFitness(
  encounters: EncounterRecord[],
  speciesId: string,
): number {
  const relevantEncounters = encounters.filter(e =>
    e.monsterSide.speciesIds.includes(speciesId)
  );

  if (relevantEncounters.length === 0) return 1;

  let fitnessScore = 1;

  for (const encounter of relevantEncounters) {
    switch (encounter.outcome) {
      case "party_defeat":
        fitnessScore += 0.3;
        break;
      case "party_retreat":
        fitnessScore += 0.15;
        break;
      case "mutual_destruction":
        fitnessScore += 0.05;
        break;
      case "party_victory":
        fitnessScore -= 0.1;
        break;
      case "negotiated":
      case "avoided":
        break;
    }

    // Bonus for killing/downing adventurers
    fitnessScore += encounter.casualties.adventurerDeaths * 0.2;
    fitnessScore += encounter.casualties.adventurerDowns * 0.05;

    // Penalty for getting wiped out quickly
    if (encounter.effectiveness.roundsLasted < 2) {
      fitnessScore -= 0.1;
    }

    // Bonus for lasting long
    if (encounter.effectiveness.roundsLasted > 5) {
      fitnessScore += 0.1;
    }
  }

  // Normalize to 0.2 - 2.5 range
  return Math.max(0.2, Math.min(2.5, fitnessScore));
}

export function adjustThreatLevel(
  currentThreat: number,
  violenceIndex: number,
  recentOutcomes: ThreatOutcome[],
): number {
  let adjustment = 0;

  for (const outcome of recentOutcomes) {
    switch (outcome) {
      case "party_defeat":
        adjustment += 0.5;
        break;
      case "party_retreat":
        adjustment += 0.2;
        break;
      case "party_victory":
        adjustment -= 0.3;
        break;
      case "mutual_destruction":
        adjustment += 0.1;
        break;
    }
  }

  // Violence index pulls threat toward it
  const violencePull = (violenceIndex - currentThreat) * 0.1;
  adjustment += violencePull;

  return Math.max(0, Math.min(10, currentThreat + adjustment));
}

// ============================================
// DIRECTOR FACTORY
// ============================================

export function createWorldDirector(campaignId: string): WorldDirectorState {
  const now = new Date().toISOString();

  return {
    campaignId,
    settings: {
      evolutionEnabled: true,
      adaptationRate: 1,
      threatAdjustmentRate: 1,
      violenceDecayRate: 0.1,
    },
    speciesFitness: [],
    regionalThreats: [],
    activeAdaptations: [],
    recentEncounters: [],
    lastEvolutionCycle: 0,
    evolutionHistory: [],
    partyProfiles: [],
    createdAt: now,
    updatedAt: now,
  };
}
