/**
 * Authority & Power Structures
 *
 * Models the "structure of power to compel" - from village militias
 * to imperial legions. Power flows from monopoly on violence,
 * legitimacy, and economic control.
 *
 * Key insight: Small settlements don't have standing armies.
 * The butcher, the hunter, the retired adventurer - they ARE the defense.
 */

import { z } from "zod";

// =============================================================================
// FORCE ORGANIZATION
// =============================================================================

/**
 * How organized is this fighting force?
 * Determines discipline, coordination, and reliability.
 */
export const ForceOrganizationSchema = z.enum([
  // Disorganized - anyone with a weapon
  "mob", // Angry peasants, no structure
  "posse", // Hastily assembled, minimal coordination
  "militia", // Part-time, basic training, local defense

  // Semi-organized - some structure
  "warband", // Raiders, bandits - hierarchy but loose
  "mercenary_company", // Professional but self-interested
  "city_watch", // Law enforcement, not warfare

  // Organized - professional military
  "garrison", // Standing defense force
  "regiment", // Trained, uniformed, disciplined
  "legion", // Elite professional army
  "order", // Religious/knightly order - fanatical discipline
]);
export type ForceOrganization = z.infer<typeof ForceOrganizationSchema>;

/**
 * Force capabilities by organization level
 */
export const FORCE_CAPABILITIES: Record<
  ForceOrganization,
  {
    discipline: number; // 0-100, chance to hold under pressure
    coordination: number; // 0-100, ability to execute complex tactics
    morale: number; // 0-100, baseline morale
    desertion: number; // 0-100, chance to desert when unpaid/losing
    responseTime: number; // slots to mobilize
    trainingWeeks: number; // weeks to train a recruit
  }
> = {
  mob: {
    discipline: 10,
    coordination: 5,
    morale: 60,
    desertion: 80,
    responseTime: 1,
    trainingWeeks: 0,
  },
  posse: {
    discipline: 20,
    coordination: 15,
    morale: 50,
    desertion: 60,
    responseTime: 2,
    trainingWeeks: 0,
  },
  militia: {
    discipline: 35,
    coordination: 30,
    morale: 55,
    desertion: 40,
    responseTime: 6,
    trainingWeeks: 2,
  },
  warband: {
    discipline: 40,
    coordination: 35,
    morale: 65,
    desertion: 50,
    responseTime: 3,
    trainingWeeks: 4,
  },
  mercenary_company: {
    discipline: 60,
    coordination: 55,
    morale: 45,
    desertion: 70,
    responseTime: 4,
    trainingWeeks: 8,
  },
  city_watch: {
    discipline: 50,
    coordination: 45,
    morale: 50,
    desertion: 35,
    responseTime: 1,
    trainingWeeks: 4,
  },
  garrison: {
    discipline: 65,
    coordination: 60,
    morale: 55,
    desertion: 25,
    responseTime: 2,
    trainingWeeks: 12,
  },
  regiment: {
    discipline: 80,
    coordination: 75,
    morale: 70,
    desertion: 15,
    responseTime: 6,
    trainingWeeks: 24,
  },
  legion: {
    discipline: 90,
    coordination: 85,
    morale: 80,
    desertion: 5,
    responseTime: 12,
    trainingWeeks: 52,
  },
  order: {
    discipline: 95,
    coordination: 80,
    morale: 95,
    desertion: 2,
    responseTime: 6,
    trainingWeeks: 104,
  },
};

// =============================================================================
// ARMED FORCE SCHEMA
// =============================================================================

/**
 * An armed force - from village defenders to imperial armies
 */
export const ArmedForceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  settlementId: z.string().uuid().optional(), // If attached to settlement
  factionId: z.string().uuid().optional(), // Controlling faction

  organization: ForceOrganizationSchema,

  composition: z.object({
    totalStrength: z.number().int(), // Total personnel
    combatReady: z.number().int(), // Available for combat
    wounded: z.number().int(),
    detached: z.number().int(), // On other duties

    // Unit types (rough percentages)
    infantry: z.number().min(0).max(100),
    cavalry: z.number().min(0).max(100),
    archers: z.number().min(0).max(100),
    specialists: z.number().min(0).max(100), // Siege, mages, etc.
  }),

  equipment: z.object({
    armorQuality: z.number().int().min(0).max(10), // 0=none, 10=legendary
    weaponQuality: z.number().int().min(0).max(10),
    supplyDays: z.number().int(), // Days of supplies
    siegeCapability: z.boolean(),
  }),

  state: z.object({
    morale: z.number().int().min(0).max(100),
    readiness: z.number().int().min(0).max(100), // Training, rest
    payStatus: z.enum(["paid", "arrears", "mutinous"]),
    weeksUnpaid: z.number().int().default(0),
  }),

  deployment: z.object({
    status: z.enum([
      "garrison",
      "patrol",
      "march",
      "siege",
      "battle",
      "retreat",
      "disbanded",
    ]),
    locationNodeId: z.string().uuid().optional(),
    targetNodeId: z.string().uuid().optional(),
    missionId: z.string().uuid().optional(),
  }),

  history: z.object({
    battlesWon: z.number().int(),
    battlesLost: z.number().int(),
    casualties: z.number().int(),
    notableVictories: z.array(z.string()),
    reputation: z.number().int().min(-100).max(100), // -100=cowards, 100=legends
  }),
});
export type ArmedForce = z.infer<typeof ArmedForceSchema>;

// =============================================================================
// INFORMAL DEFENDERS
// =============================================================================

/**
 * In small settlements, these ARE the defense force.
 * The blacksmith, the retired soldier, the town drunk who's handy with a bow.
 */
export const DefenderRoleSchema = z.enum([
  // Combat-adjacent professions
  "hunter", // Ranged, tracking, wilderness
  "butcher", // Melee, intimidation, strong
  "blacksmith", // Melee, armor, endurance
  "guard", // Basic combat training
  "retired_soldier", // Real training, older
  "adventurer", // High skill, unreliable

  // Non-combat but useful
  "herbalist", // Medical support
  "priest", // Morale, healing magic
  "mage", // Magical support (rare)

  // Warm bodies
  "farmer", // Numbers, pitchforks
  "craftsman", // Better than nothing
  "merchant", // Will fight for their goods
]);
export type DefenderRole = z.infer<typeof DefenderRoleSchema>;

export const DEFENDER_EFFECTIVENESS: Record<
  DefenderRole,
  {
    combatValue: number; // Effective fighters per person
    ranged: boolean;
    mounted: boolean;
    specialAbility?: string;
    reliability: number; // 0-100, chance to show up
  }
> = {
  hunter: {
    combatValue: 1.5,
    ranged: true,
    mounted: false,
    specialAbility: "tracking",
    reliability: 70,
  },
  butcher: {
    combatValue: 1.3,
    ranged: false,
    mounted: false,
    specialAbility: "intimidation",
    reliability: 80,
  },
  blacksmith: {
    combatValue: 1.2,
    ranged: false,
    mounted: false,
    specialAbility: "field_repair",
    reliability: 85,
  },
  guard: {
    combatValue: 1.0,
    ranged: false,
    mounted: false,
    reliability: 95,
  },
  retired_soldier: {
    combatValue: 1.8,
    ranged: true,
    mounted: true,
    specialAbility: "tactics",
    reliability: 75,
  },
  adventurer: {
    combatValue: 3.0,
    ranged: true,
    mounted: true,
    specialAbility: "magic",
    reliability: 40,
  },
  herbalist: {
    combatValue: 0.3,
    ranged: false,
    mounted: false,
    specialAbility: "healing",
    reliability: 60,
  },
  priest: {
    combatValue: 0.5,
    ranged: false,
    mounted: false,
    specialAbility: "morale_healing",
    reliability: 90,
  },
  mage: {
    combatValue: 2.5,
    ranged: true,
    mounted: false,
    specialAbility: "magic",
    reliability: 50,
  },
  farmer: { combatValue: 0.4, ranged: false, mounted: false, reliability: 70 },
  craftsman: {
    combatValue: 0.5,
    ranged: false,
    mounted: false,
    reliability: 65,
  },
  merchant: {
    combatValue: 0.6,
    ranged: false,
    mounted: false,
    reliability: 50,
  },
};

/**
 * Individual defender in a settlement
 */
export const SettlementDefenderSchema = z.object({
  npcId: z.string().uuid(),
  role: DefenderRoleSchema,
  name: z.string(),

  capability: z.object({
    level: z.number().int().min(1).max(20), // Approximate level
    hasArmor: z.boolean(),
    hasWeapon: z.boolean(),
    mounted: z.boolean(),
  }),

  availability: z.object({
    willingToFight: z.boolean(), // Will they answer the call?
    currentlyPresent: z.boolean(), // In town?
    familyToProtect: z.boolean(), // Has dependents = more motivated
    grievances: z.array(z.string()), // Reasons NOT to fight
  }),
});
export type SettlementDefender = z.infer<typeof SettlementDefenderSchema>;

/**
 * Settlement's total defensive capability
 */
export const SettlementDefenseSchema = z.object({
  settlementId: z.string().uuid(),

  // Formal forces (if any)
  armedForces: z.array(z.string().uuid()), // ArmedForce IDs

  // Informal defenders
  informalDefenders: z.array(SettlementDefenderSchema),

  // Fortifications
  fortifications: z.object({
    walls: z.enum(["none", "palisade", "stone", "fortress"]),
    gates: z.number().int(),
    towers: z.number().int(),
    moat: z.boolean(),
    condition: z.number().int().min(0).max(100),
  }),

  // Calculated values (updated on change)
  effectiveStrength: z.object({
    formal: z.number(), // From armed forces
    informal: z.number(), // From defenders
    fortification: z.number(), // Defensive bonus
    total: z.number(),
  }),

  // Readiness
  alertLevel: z.enum(["peacetime", "alert", "mobilized", "siege"]),
  lastDrillDay: z.number().int().optional(),
  responseMinutes: z.number().int(), // Time to mobilize
});
export type SettlementDefense = z.infer<typeof SettlementDefenseSchema>;

// =============================================================================
// POWER STRUCTURES
// =============================================================================

/**
 * Sources of authority - why do people obey?
 */
export const AuthoritySourceSchema = z.enum([
  // Legitimate power
  "hereditary", // Born to rule
  "elected", // Chosen by some process
  "appointed", // Given power by higher authority
  "religious", // Divine mandate
  "meritocratic", // Earned through achievement

  // Coercive power
  "military", // Control through force
  "economic", // Control through wealth
  "criminal", // Control through fear/violence

  // Informal power
  "traditional", // "We've always done it this way"
  "charismatic", // Personal magnetism
  "expertise", // Knowledge/skill others need
]);
export type AuthoritySource = z.infer<typeof AuthoritySourceSchema>;

/**
 * Methods of compelling obedience
 */
export const CompulsionMethodSchema = z.enum([
  // Soft power
  "persuasion", // Convince them it's right
  "incentive", // Reward compliance
  "social_pressure", // Community enforcement
  "tradition", // "This is how we do things"
  "legitimacy", // "I have the right to command"

  // Hard power
  "economic_threat", // "I'll fire you / ruin you"
  "legal_threat", // "I'll have you arrested"
  "violence_threat", // "I'll hurt you"
  "hostage", // "Nice family you have there"
  "exile_threat", // "Leave or else"

  // Direct force
  "arrest", // Physical detention
  "corporal", // Physical punishment
  "execution", // Ultimate sanction
  "collective_punishment", // Punish the group
]);
export type CompulsionMethod = z.infer<typeof CompulsionMethodSchema>;

/**
 * A power holder - someone who can compel others
 */
export const PowerHolderSchema = z.object({
  id: z.string().uuid(),
  npcId: z.string().uuid().optional(), // If individual
  factionId: z.string().uuid().optional(), // If institutional
  title: z.string(), // "Mayor", "Crime Boss", "High Priest"

  jurisdiction: z.object({
    settlementIds: z.array(z.string().uuid()),
    regionIds: z.array(z.string().uuid()),
    scope: z.enum(["local", "regional", "national", "international"]),
  }),

  authority: z.object({
    sources: z.array(AuthoritySourceSchema),
    primarySource: AuthoritySourceSchema,
    legitimacy: z.number().int().min(0).max(100), // How accepted is their rule?
    stability: z.number().int().min(0).max(100), // How secure is their position?
  }),

  enforcement: z.object({
    availableMethods: z.array(CompulsionMethodSchema),
    preferredMethods: z.array(CompulsionMethodSchema),
    willingnessToUseForce: z.number().int().min(0).max(100),
    brutalityReputation: z.number().int().min(0).max(100),
  }),

  resources: z.object({
    armedForceIds: z.array(z.string().uuid()), // Forces they control
    treasury: z.number().int(), // Gold available
    informants: z.number().int(), // Eyes and ears
    prisons: z.number().int(), // Detention capacity
  }),

  relationships: z.object({
    superiorId: z.string().uuid().optional(), // Who they answer to
    subordinateIds: z.array(z.string().uuid()), // Who answers to them
    rivalIds: z.array(z.string().uuid()), // Competing power holders
    allyIds: z.array(z.string().uuid()),
  }),
});
export type PowerHolder = z.infer<typeof PowerHolderSchema>;

// =============================================================================
// REPRESSION & RESISTANCE
// =============================================================================

/**
 * Level of repression in an area
 */
export const RepressionLevelSchema = z.enum([
  "free", // No significant repression
  "regulated", // Laws enforced, some restrictions
  "controlled", // Significant restrictions, surveillance
  "oppressive", // Heavy restrictions, punishment common
  "tyrannical", // Arbitrary rule, terror
]);
export type RepressionLevel = z.infer<typeof RepressionLevelSchema>;

/**
 * What triggers resistance?
 */
export const GrievanceSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),

  type: z.enum([
    "taxation", // Too many taxes
    "conscription", // Forced military service
    "corruption", // Officials abusing power
    "injustice", // Unfair legal treatment
    "religious", // Religious persecution
    "economic", // Economic oppression
    "ethnic", // Ethnic persecution
    "land", // Land disputes
    "food", // Food shortages blamed on rulers
    "foreign_rule", // Ruled by outsiders
  ]),

  severity: z.number().int().min(0).max(100),
  affectedPopulationPercent: z.number().min(0).max(100),
  durationWeeks: z.number().int(),

  // The spark that could ignite rebellion
  flashpoint: z.boolean(),
  flashpointTrigger: z.string().optional(),
});
export type Grievance = z.infer<typeof GrievanceSchema>;

/**
 * Resistance movement
 */
export const ResistanceMovementSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  settlementIds: z.array(z.string().uuid()), // Where they operate

  organization: z.enum([
    "unorganized", // Scattered discontent
    "nascent", // Beginning to organize
    "cells", // Secret cells
    "network", // Connected cells
    "movement", // Open resistance
    "rebellion", // Armed uprising
  ]),

  strength: z.object({
    activeMembers: z.number().int(),
    passiveSupporters: z.number().int(),
    armedCapability: z.number().int(), // Effective fighters
    leadership: z.number().int().min(0).max(100), // Quality of leadership
    secrecy: z.number().int().min(0).max(100), // How hidden
  }),

  goals: z.array(
    z.enum([
      "reform", // Change within system
      "autonomy", // Local self-rule
      "independence", // Break away
      "revolution", // Overthrow system
      "restoration", // Return old order
      "religious", // Religious goals
    ])
  ),

  methods: z.array(
    z.enum([
      "protest", // Public demonstrations
      "strike", // Work stoppages
      "boycott", // Economic resistance
      "propaganda", // Information warfare
      "sabotage", // Destruction of property
      "assassination", // Targeted killing
      "guerrilla", // Armed attacks
      "open_warfare", // Full rebellion
    ])
  ),

  grievances: z.array(z.string().uuid()), // GrievanceIds that fuel them
});
export type ResistanceMovement = z.infer<typeof ResistanceMovementSchema>;

// =============================================================================
// AUTHORITY STATE FOR A SETTLEMENT
// =============================================================================

/**
 * Complete authority/power state for a settlement
 */
export const SettlementAuthoritySchema = z.object({
  settlementId: z.string().uuid(),

  // Who holds power
  powerHolders: z.array(z.string().uuid()), // PowerHolder IDs

  // Primary ruler
  primaryRuler: z
    .object({
      powerHolderId: z.string().uuid(),
      controlPercent: z.number().min(0).max(100), // How much do they actually control?
    })
    .optional(),

  // Competing powers
  powerBalance: z.enum([
    "unified", // Single clear authority
    "shared", // Multiple powers cooperating
    "contested", // Powers competing
    "fragmented", // No clear authority
    "anarchy", // No effective authority
  ]),

  // Repression
  repression: z.object({
    level: RepressionLevelSchema,
    enforcementCapacity: z.number().int().min(0).max(100),
    surveillanceLevel: z.number().int().min(0).max(100),
    corruptionLevel: z.number().int().min(0).max(100),
  }),

  // Resistance
  grievances: z.array(z.string().uuid()),
  resistanceMovements: z.array(z.string().uuid()),
  unrest: z.number().int().min(0).max(100), // General discontent

  // Stability indicators
  stability: z.object({
    overall: z.number().int().min(0).max(100),
    rebellionRisk: z.number().min(0).max(100),
    coupRisk: z.number().min(0).max(100),
    invasionVulnerability: z.number().min(0).max(100),
  }),
});
export type SettlementAuthority = z.infer<typeof SettlementAuthoritySchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate settlement's effective defensive strength
 */
export function calculateDefensiveStrength(
  defense: SettlementDefense,
  armedForces: ArmedForce[]
): number {
  // Formal forces
  const formalStrength = armedForces.reduce((sum, force) => {
    const capabilities = FORCE_CAPABILITIES[force.organization];
    const effectiveness =
      (force.state.morale / 100) *
      (force.state.readiness / 100) *
      (capabilities.discipline / 100);
    return sum + force.composition.combatReady * effectiveness;
  }, 0);

  // Informal defenders
  const informalStrength = defense.informalDefenders.reduce((sum, defender) => {
    if (!defender.availability.willingToFight) return sum;
    if (!defender.availability.currentlyPresent) return sum;

    const effectiveness = DEFENDER_EFFECTIVENESS[defender.role];
    const reliability = effectiveness.reliability / 100;
    const showsUp = Math.random() < reliability ? 1 : 0;

    return sum + effectiveness.combatValue * defender.capability.level * showsUp;
  }, 0);

  // Fortification bonus
  const fortBonus: Record<string, number> = {
    none: 1.0,
    palisade: 1.3,
    stone: 1.8,
    fortress: 2.5,
  };
  const fortMultiplier =
    fortBonus[defense.fortifications.walls] *
    (defense.fortifications.condition / 100);

  return (formalStrength + informalStrength) * fortMultiplier;
}

/**
 * Can this power holder compel this NPC?
 */
export function canCompel(
  holder: PowerHolder,
  npcSettlementId: string,
  method: CompulsionMethod
): boolean {
  // Check jurisdiction
  if (!holder.jurisdiction.settlementIds.includes(npcSettlementId)) {
    return false;
  }

  // Check if method is available
  if (!holder.enforcement.availableMethods.includes(method)) {
    return false;
  }

  // Check willingness for violent methods
  const violentMethods: CompulsionMethod[] = [
    "violence_threat",
    "arrest",
    "corporal",
    "execution",
    "collective_punishment",
  ];
  if (violentMethods.includes(method)) {
    return holder.enforcement.willingnessToUseForce >= 50;
  }

  return true;
}

/**
 * Calculate rebellion risk from grievances
 */
export function calculateRebellionRisk(
  grievances: Grievance[],
  repressionLevel: RepressionLevel,
  unrest: number
): number {
  if (grievances.length === 0) return 0;

  // Base risk from grievances
  const grievanceRisk =
    grievances.reduce((sum, g) => {
      const durationFactor = Math.min(g.durationWeeks / 52, 2); // Caps at 2x
      const flashpointFactor = g.flashpoint ? 1.5 : 1;
      return sum + g.severity * (g.affectedPopulationPercent / 100) * durationFactor * flashpointFactor;
    }, 0) / grievances.length;

  // Repression can suppress or inflame
  const repressionMod: Record<RepressionLevel, number> = {
    free: 0.5, // Less reason to rebel
    regulated: 0.7,
    controlled: 1.0,
    oppressive: 1.3, // Pushes people toward rebellion
    tyrannical: 1.8, // High risk of explosion
  };

  // But effective repression can also prevent it
  const repressionEffectiveness: Record<RepressionLevel, number> = {
    free: 0,
    regulated: 0.1,
    controlled: 0.2,
    oppressive: 0.3,
    tyrannical: 0.4, // Fear works... until it doesn't
  };

  const baseRisk = grievanceRisk * repressionMod[repressionLevel];
  const suppressed = baseRisk * (1 - repressionEffectiveness[repressionLevel]);

  // Unrest amplifies
  const finalRisk = suppressed * (1 + unrest / 100);

  return Math.min(100, Math.max(0, finalRisk));
}

/**
 * Get informal defenders from settlement population
 * (Would integrate with settlement NPC tracking)
 */
export function identifyInformalDefenders(
  settlementPopulation: number,
  _settlementType: string
): { role: DefenderRole; count: number }[] {
  const defenders: { role: DefenderRole; count: number }[] = [];

  // Scale by population
  if (settlementPopulation >= 50) {
    defenders.push({ role: "hunter", count: Math.floor(settlementPopulation / 100) });
    defenders.push({ role: "butcher", count: Math.floor(settlementPopulation / 200) });
    defenders.push({ role: "blacksmith", count: Math.floor(settlementPopulation / 300) });
  }

  if (settlementPopulation >= 100) {
    defenders.push({ role: "retired_soldier", count: Math.floor(settlementPopulation / 500) });
  }

  if (settlementPopulation >= 200) {
    defenders.push({ role: "guard", count: Math.floor(settlementPopulation / 100) });
  }

  // Adventurers are rare but powerful
  if (settlementPopulation >= 500) {
    defenders.push({ role: "adventurer", count: Math.floor(settlementPopulation / 1000) });
  }

  // Farmers are always the bulk
  defenders.push({ role: "farmer", count: Math.floor(settlementPopulation * 0.1) });

  return defenders;
}

/**
 * Determine organization level for settlement's formal defense
 */
export function determineForceOrganization(
  settlementPopulation: number,
  isCapital: boolean,
  hasProfessionalMilitary: boolean
): ForceOrganization {
  if (hasProfessionalMilitary) {
    if (isCapital) return "legion";
    if (settlementPopulation >= 10000) return "regiment";
    return "garrison";
  }

  if (isCapital) return "garrison";
  if (settlementPopulation >= 5000) return "city_watch";
  if (settlementPopulation >= 1000) return "militia";
  if (settlementPopulation >= 200) return "posse";
  return "mob";
}
