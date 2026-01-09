import { z } from "zod";
import {
  POI,
  POIDiscoveryState,
  POIThreatLevel,
  POIType,
  DEGRADATION_RATE_VALUES,
  escalateThreatLevel,
  STANDARD_DEGRADATION_EFFECTS,
} from "./schema";

// ============================================
// POI ENGINE
// ============================================
//
// Handles the living aspects of POIs:
//   - Discovery state transitions
//   - Rumor generation and propagation
//   - Respawn processing
//   - Degradation processing
//   - NPC knowledge calculation
//
// The world doesn't wait. POIs evolve.
//

// ============================================
// RUMOR SYSTEM
// ============================================

export const POIRumorSchema = z.object({
  id: z.string().uuid(),
  poiId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Source
  sourceSettlementId: z.string().uuid(),
  sourceSettlementName: z.string(),
  sourceNpcId: z.string().uuid().optional(),
  sourceNpcName: z.string().optional(),

  // Rumor content
  rumorText: z.string(),
  accuracy: z.number().min(0).max(1), // 0 = completely false, 1 = perfectly accurate

  // What the rumor claims (may be wrong)
  claims: z.object({
    location: z.object({
      claimed: z.boolean(),
      accuracy: z.number().min(0).max(1).optional(), // How close to real location
      description: z.string().optional(), // "in the hills north of town"
    }).optional(),

    threat: z.object({
      claimed: z.boolean(),
      claimedType: z.string().optional(),  // "goblins" (might be wrong)
      claimedStrength: z.string().optional(), // "dozens of them" (exaggerated?)
    }).optional(),

    treasure: z.object({
      claimed: z.boolean(),
      claimedValue: z.string().optional(), // "mountains of gold" (unlikely)
    }).optional(),

    danger: z.object({
      claimed: z.boolean(),
      claimedLevel: z.string().optional(), // "certain death" (dramatic locals)
    }).optional(),
  }),

  // State
  heardByParty: z.boolean().default(false),
  heardAt: z.string().optional(),
  verifiedAs: z.enum(["unknown", "true", "partially_true", "false"]).default("unknown"),

  // Metadata
  createdAt: z.string(),
  expiresAt: z.string().optional(), // Old rumors fade
});
export type POIRumor = z.infer<typeof POIRumorSchema>;

// ============================================
// NPC KNOWLEDGE
// ============================================

export interface NPCPOIKnowledge {
  knows: boolean;
  knowledgeLevel: POIDiscoveryState;
  accuracy: number; // 0-1, how accurate their info is
  willShare: boolean; // Will they share freely?
  shareCondition?: string; // "for 10gp", "if helped first", "faction members only"
  rumorId?: string; // Links to a specific rumor they can share
}

// Knowledge factors by profession
const PROFESSION_KNOWLEDGE_BONUS: Record<string, {
  poiTypes: POIType[];
  bonus: number;
}> = {
  merchant: {
    poiTypes: ["landmark_crossing", "wilderness_camp", "dungeon_cave"],
    bonus: 0.3,
  },
  guard: {
    poiTypes: ["wilderness_camp", "wilderness_den", "dungeon_lair"],
    bonus: 0.2,
  },
  hunter: {
    poiTypes: ["wilderness_territory", "wilderness_den", "wilderness_nest"],
    bonus: 0.4,
  },
  sage: {
    poiTypes: ["dungeon_tomb", "dungeon_temple", "dungeon_ruins", "landmark_monument"],
    bonus: 0.3,
  },
  priest: {
    poiTypes: ["dungeon_temple", "landmark_shrine", "wilderness_grove"],
    bonus: 0.3,
  },
  adventurer: {
    poiTypes: [], // All types
    bonus: 0.3,
  },
  scout: {
    poiTypes: [], // All types
    bonus: 0.4,
  },
};

/**
 * Calculate what an NPC knows about a specific POI.
 */
export function getNPCPOIKnowledge(
  npc: {
    id: string;
    settlementId?: string;
    profession?: string;
    factionIds?: string[];
    isAdventurer?: boolean;
    travelRange?: number; // How far they've been from home
  },
  poi: POI,
  distanceMiles: number,
): NPCPOIKnowledge {
  // Base knowledge chance decreases with distance
  let knowledgeChance = Math.max(0, 1 - (distanceMiles / 50));

  // Profession bonus
  const professionData = npc.profession
    ? PROFESSION_KNOWLEDGE_BONUS[npc.profession.toLowerCase()]
    : undefined;

  if (professionData) {
    if (professionData.poiTypes.length === 0 || professionData.poiTypes.includes(poi.type)) {
      knowledgeChance += professionData.bonus;
    }
  }

  // Adventurers know more
  if (npc.isAdventurer) {
    knowledgeChance += 0.3;
  }

  // Faction knowledge
  const npcFactions = npc.factionIds ?? [];
  const poiKnownFactions = poi.discovery.knownToFactions;
  const sharedFaction = npcFactions.some(f => poiKnownFactions.includes(f));
  if (sharedFaction) {
    knowledgeChance += 0.4;
  }

  // Travel range
  if (npc.travelRange && distanceMiles <= npc.travelRange) {
    knowledgeChance += 0.2;
  }

  // Cap at 95% (never certain)
  knowledgeChance = Math.min(0.95, knowledgeChance);

  // Roll for knowledge
  const knows = Math.random() < knowledgeChance;

  if (!knows) {
    return {
      knows: false,
      knowledgeLevel: "unknown",
      accuracy: 0,
      willShare: false,
    };
  }

  // Determine knowledge level based on distance and profession
  let knowledgeLevel: POIDiscoveryState = "rumored";
  if (distanceMiles < 5) {
    knowledgeLevel = "located";
  } else if (distanceMiles < 15) {
    knowledgeLevel = "confirmed";
  }

  // Adventurers/scouts might have explored
  if ((npc.isAdventurer || npc.profession === "scout") && distanceMiles < 20) {
    if (Math.random() < 0.3) {
      knowledgeLevel = "mapped";
    }
  }

  // Accuracy based on distance and profession
  let accuracy = Math.max(0.3, 1 - (distanceMiles / 30));
  if (professionData) {
    accuracy = Math.min(1, accuracy + 0.1);
  }

  // Will they share?
  let willShare = true;
  let shareCondition: string | undefined;

  // Some NPCs want something in return
  if (Math.random() < 0.3) {
    willShare = false;
    const conditions = [
      "for a modest fee",
      "if you help them first",
      "only to faction members",
      "if you buy them a drink",
      "in exchange for news",
    ];
    shareCondition = conditions[Math.floor(Math.random() * conditions.length)];
  }

  return {
    knows: true,
    knowledgeLevel,
    accuracy,
    willShare,
    shareCondition: willShare ? undefined : shareCondition,
  };
}

// ============================================
// DISCOVERY STATE MACHINE
// ============================================

const DISCOVERY_TRANSITIONS: Record<POIDiscoveryState, POIDiscoveryState[]> = {
  unknown: ["rumored", "confirmed", "located"], // Can skip rumored if directly found
  rumored: ["confirmed", "located"],
  confirmed: ["located"],
  located: ["mapped"],
  mapped: ["explored"],
  explored: ["cleared"],
  cleared: ["claimed", "explored"], // Can regress if respawns
  claimed: [], // Terminal state (unless lost)
};

/**
 * Check if a discovery state transition is valid.
 */
export function canTransitionDiscovery(
  from: POIDiscoveryState,
  to: POIDiscoveryState,
): boolean {
  return DISCOVERY_TRANSITIONS[from].includes(to);
}

/**
 * Get the discovery state change when party interacts with a POI.
 */
export function getDiscoveryStateFromAction(
  currentState: POIDiscoveryState,
  action: "heard_rumor" | "found_map" | "spotted" | "visited" | "explored_fully" | "cleared" | "claimed",
): POIDiscoveryState {
  switch (action) {
    case "heard_rumor":
      if (currentState === "unknown") return "rumored";
      return currentState;

    case "found_map":
      if (["unknown", "rumored", "confirmed"].includes(currentState)) return "located";
      return currentState;

    case "spotted":
      if (["unknown", "rumored"].includes(currentState)) return "confirmed";
      return currentState;

    case "visited":
      if (["unknown", "rumored", "confirmed", "located"].includes(currentState)) return "explored";
      return currentState;

    case "explored_fully":
      if (currentState !== "cleared" && currentState !== "claimed") return "explored";
      return currentState;

    case "cleared":
      return "cleared";

    case "claimed":
      if (currentState === "cleared") return "claimed";
      return currentState;

    default:
      return currentState;
  }
}

// ============================================
// RUMOR GENERATION
// ============================================

export interface RumorGenerationContext {
  poi: POI;
  nearbySettlements: Array<{
    id: string;
    name: string;
    distanceMiles: number;
    population: number;
  }>;
  currentDate: Date;
}

/**
 * Generate rumors about a POI that could spread from nearby settlements.
 */
export function generateRumors(ctx: RumorGenerationContext): Omit<POIRumor, "id">[] {
  const rumors: Omit<POIRumor, "id">[] = [];
  const { poi, nearbySettlements, currentDate } = ctx;

  // Only generate rumors for POIs that aren't already well-known
  if (["mapped", "explored", "cleared", "claimed"].includes(poi.discovery.state)) {
    return [];
  }

  for (const settlement of nearbySettlements) {
    // Chance of rumor based on distance and POI impact
    let rumorChance = Math.max(0.1, 0.8 - (settlement.distanceMiles / 50));

    // Higher chance if POI affects this settlement's trade
    if (poi.economics.raidsCaravans) {
      rumorChance += 0.3;
    }

    // Higher chance for more threatening POIs
    const threatMultiplier: Record<POIThreatLevel, number> = {
      trivial: 0.5,
      easy: 0.7,
      moderate: 1.0,
      hard: 1.3,
      deadly: 1.5,
      legendary: 2.0,
      mythic: 2.5,
    };
    rumorChance *= threatMultiplier[poi.threatLevel];

    // Population affects rumor spread
    rumorChance *= Math.min(2, settlement.population / 500);

    if (Math.random() > rumorChance) continue;

    // Generate the rumor
    const accuracy = poi.discovery.rumorAccuracy * (0.7 + Math.random() * 0.6);
    const rumor = createRumor(poi, settlement, accuracy, currentDate);
    rumors.push(rumor);
  }

  return rumors;
}

function createRumor(
  poi: POI,
  settlement: { id: string; name: string; distanceMiles: number },
  accuracy: number,
  currentDate: Date,
): Omit<POIRumor, "id"> {
  // Generate rumor text based on accuracy
  const rumorTemplates = [
    `Travelers speak of ${poi.name} in the ${getDirectionText()} ${getDistanceText(settlement.distanceMiles)}`,
    `Folk whisper about strange happenings at ${poi.name}`,
    `A ${getCreatureRumor(poi, accuracy)} has been seen near ${poi.name}`,
    `${poi.name} has become ${getThreatRumor(poi, accuracy)}`,
  ];

  const rumorText = rumorTemplates[Math.floor(Math.random() * rumorTemplates.length)];

  // Build claims (may be inaccurate)
  const locationClaimed = Math.random() < 0.7;
  const threatClaimed = Math.random() < 0.8;
  const treasureClaimed = Math.random() < 0.4;
  const dangerClaimed = Math.random() < 0.6;

  return {
    poiId: poi.id,
    campaignId: poi.campaignId,
    sourceSettlementId: settlement.id,
    sourceSettlementName: settlement.name,
    rumorText,
    accuracy,
    claims: {
      location: locationClaimed ? {
        claimed: true,
        accuracy: accuracy * (0.8 + Math.random() * 0.4),
        description: `${getDistanceText(settlement.distanceMiles)} ${getDirectionText()}`,
      } : undefined,
      threat: threatClaimed ? {
        claimed: true,
        claimedType: getCreatureRumor(poi, accuracy),
        claimedStrength: getStrengthRumor(poi, accuracy),
      } : undefined,
      treasure: treasureClaimed ? {
        claimed: true,
        claimedValue: getTreasureRumor(poi, accuracy),
      } : undefined,
      danger: dangerClaimed ? {
        claimed: true,
        claimedLevel: getThreatRumor(poi, accuracy),
      } : undefined,
    },
    heardByParty: false,
    verifiedAs: "unknown",
    createdAt: currentDate.toISOString(),
    expiresAt: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
}

function getDirectionText(): string {
  const directions = ["north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"];
  return directions[Math.floor(Math.random() * directions.length)];
}

function getDistanceText(miles: number): string {
  if (miles < 5) return "very close by";
  if (miles < 15) return "a short journey away";
  if (miles < 30) return "a day's travel away";
  if (miles < 50) return "several days travel";
  return "far from here";
}

function getCreatureRumor(poi: POI, accuracy: number): string {
  const actual = poi.encounters.primaryCreatureType;

  if (accuracy > 0.8) return actual;

  // Inaccurate descriptions
  const vague = ["strange creatures", "monsters", "beasts", "evil things", "dark beings"];
  if (accuracy < 0.4) return vague[Math.floor(Math.random() * vague.length)];

  // Partially accurate
  const similar: Record<string, string[]> = {
    goblinoid: ["goblins", "small green things", "cave creatures"],
    undead: ["walking dead", "ghosts", "cursed spirits"],
    beast: ["wild animals", "dangerous beasts", "monstrous creatures"],
    humanoid: ["bandits", "outlaws", "raiders"],
  };

  for (const [category, options] of Object.entries(similar)) {
    if (actual.toLowerCase().includes(category)) {
      return options[Math.floor(Math.random() * options.length)];
    }
  }

  return actual;
}

function getStrengthRumor(poi: POI, accuracy: number): string {
  const actual = poi.control.defenderCount;

  if (accuracy > 0.9) return `about ${actual}`;

  // Exaggeration factor
  const exaggeration = 1 + (1 - accuracy) * 3;
  const reported = Math.floor(actual * (0.5 + Math.random() * exaggeration));

  if (reported < 5) return "a handful";
  if (reported < 15) return "a dozen or so";
  if (reported < 30) return "scores of them";
  if (reported < 100) return "a horde";
  return "an army";
}

function getThreatRumor(poi: POI, _accuracy: number): string {
  const threatDescriptions: Record<POIThreatLevel, string[]> = {
    trivial: ["a minor nuisance", "barely worth noting", "not much of a threat"],
    easy: ["somewhat dangerous", "a concern", "risky for the unprepared"],
    moderate: ["quite dangerous", "a real threat", "not to be underestimated"],
    hard: ["extremely dangerous", "deadly", "a serious threat"],
    deadly: ["certain death for most", "a death trap", "legendary danger"],
    legendary: ["world-ending", "apocalyptic", "beyond mortal power"],
    mythic: ["a god-level threat", "the end of all things", "unimaginable horror"],
  };

  const options = threatDescriptions[poi.threatLevel];
  return options[Math.floor(Math.random() * options.length)];
}

function getTreasureRumor(poi: POI, accuracy: number): string {
  const hoards = ["none", "individual", "hoard_cr0-4", "hoard_cr5-10", "hoard_cr11-16", "hoard_cr17+"];
  const idx = hoards.indexOf(poi.loot.treasureHoard);

  if (accuracy > 0.8) {
    return ["nothing", "a few coins", "modest treasure", "considerable wealth", "great riches", "legendary hoard"][idx];
  }

  // Exaggerate!
  const exaggeratedIdx = Math.min(hoards.length - 1, idx + Math.floor((1 - accuracy) * 3));
  return ["nothing", "some coin", "treasure", "wealth beyond measure", "dragon's hoard", "the wealth of kings"][exaggeratedIdx];
}

// ============================================
// RESPAWN PROCESSING
// ============================================

export interface RespawnEvent {
  poiId: string;
  poiName: string;
  previousController: string;
  newController: string;
  threatEscalated: boolean;
  newThreatLevel?: POIThreatLevel;
  narrativeReason: string;
}

/**
 * Process respawns for all cleared POIs.
 */
export function processRespawns(
  pois: POI[],
  currentDate: Date,
): { events: RespawnEvent[]; updatedPOIs: POI[] } {
  const events: RespawnEvent[] = [];
  const updatedPOIs: POI[] = [];

  for (const poi of pois) {
    // Skip if not cleared or not ready to respawn
    if (poi.discovery.state !== "cleared") continue;
    if (poi.control.controllerType === "player") continue;
    if (!poi.lifecycle.canRespawn) continue;
    if (!poi.lifecycle.respawnAt) continue;

    const respawnDate = new Date(poi.lifecycle.respawnAt);
    if (currentDate < respawnDate) continue;

    // Check respawn conditions
    const conditionsMet = checkRespawnConditions(poi);
    if (!conditionsMet) continue;

    // RESPAWN!
    const respawnResult = executeRespawn(poi, currentDate);
    events.push(respawnResult.event);
    updatedPOIs.push(respawnResult.poi);
  }

  return { events, updatedPOIs };
}

function checkRespawnConditions(poi: POI): boolean {
  const conditions = poi.lifecycle.respawnConditions;

  for (const condition of conditions) {
    switch (condition) {
      case "not_claimed":
        if (poi.claim?.claimId) return false;
        break;

      case "no_patrols":
        if (poi.claim?.defenseRequirements?.patrolFrequency !== "none") {
          // If claimed with patrols, don't respawn
          if (poi.claim?.claimId) return false;
        }
        break;

      case "no_garrison":
        if (poi.claim?.defenseRequirements?.minGarrison && poi.claim.defenseRequirements.minGarrison > 0) {
          if (poi.claim?.claimId) return false;
        }
        break;
    }
  }

  return true;
}

function executeRespawn(poi: POI, currentDate: Date): { event: RespawnEvent; poi: POI } {
  const previousController = poi.control.controllerName ?? "empty";

  // Determine new controller
  const newController = generateNewController(poi);

  // Check for escalation
  let newThreatLevel: POIThreatLevel | undefined;
  if (poi.lifecycle.respawnEscalation && poi.lifecycle.respawnCount > 0) {
    newThreatLevel = escalateThreatLevel(poi.threatLevel);
  }

  // Generate narrative reason
  const narrativeReason = generateRespawnNarrative(poi, newController);

  // Create updated POI
  const updatedPOI: POI = {
    ...poi,
    discovery: {
      ...poi.discovery,
      state: "confirmed", // No longer cleared
    },
    control: {
      ...poi.control,
      controllerType: "monster",
      controllerName: newController,
      defenderStrength: poi.control.defenderStrength,
      alertLevel: 0,
      clearedBy: undefined,
      clearedAt: undefined,
    },
    threatLevel: newThreatLevel ?? poi.threatLevel,
    lifecycle: {
      ...poi.lifecycle,
      respawnCount: poi.lifecycle.respawnCount + 1,
      respawnAt: undefined,
    },
    updatedAt: currentDate.toISOString(),
  };

  const event: RespawnEvent = {
    poiId: poi.id,
    poiName: poi.name,
    previousController,
    newController,
    threatEscalated: !!newThreatLevel,
    newThreatLevel,
    narrativeReason,
  };

  return { event, poi: updatedPOI };
}

function generateNewController(poi: POI): string {
  // Same type returns with reinforcements
  if (poi.lifecycle.respawnCount === 0) {
    return poi.encounters.primaryCreatureType + " survivors";
  }

  // Escalation options
  const escalations: Record<string, string[]> = {
    goblinoid: ["Hobgoblin war band", "Bugbear enforcers", "Goblin horde"],
    undead: ["Greater undead", "Necromancer's servants", "Restless dead"],
    beast: ["Pack alpha", "Monstrous mutation", "Territorial apex predator"],
    humanoid: ["Veteran bandits", "Cult cell", "Professional mercenaries"],
  };

  const creatureType = poi.encounters.primaryCreatureType.toLowerCase();
  for (const [category, options] of Object.entries(escalations)) {
    if (creatureType.includes(category)) {
      return options[Math.min(poi.lifecycle.respawnCount - 1, options.length - 1)];
    }
  }

  return "New occupants";
}

function generateRespawnNarrative(poi: POI, newController: string): string {
  const narratives = [
    `${newController} have moved into ${poi.name}`,
    `${poi.name} has been reoccupied by ${newController}`,
    `Scouts report ${newController} at ${poi.name}`,
    `Travelers warn that ${poi.name} is dangerous again - ${newController} have claimed it`,
  ];

  if (poi.lifecycle.respawnCount > 1) {
    narratives.push(
      `${poi.name} proves impossible to keep clear - ${newController} are now in control`,
      `The curse of ${poi.name} continues - ${newController} have arrived`,
    );
  }

  return narratives[Math.floor(Math.random() * narratives.length)];
}

// ============================================
// DEGRADATION PROCESSING
// ============================================

export interface DegradationEvent {
  poiId: string;
  poiName: string;
  previousDegradation: number;
  newDegradation: number;
  triggeredEffects: Array<{
    effect: string;
    description: string;
  }>;
}

/**
 * Process degradation for unchecked POIs.
 */
export function processDegradation(
  pois: POI[],
  daysElapsed: number,
): { events: DegradationEvent[]; updatedPOIs: POI[] } {
  const events: DegradationEvent[] = [];
  const updatedPOIs: POI[] = [];

  for (const poi of pois) {
    // Skip if cleared, claimed, or no degradation
    if (["cleared", "claimed"].includes(poi.discovery.state)) continue;
    if (poi.lifecycle.degradationRate === "none") continue;

    const ratePerWeek = DEGRADATION_RATE_VALUES[poi.lifecycle.degradationRate];
    const degradationPerDay = ratePerWeek / 7;
    const degradationIncrease = degradationPerDay * daysElapsed;

    const previousDegradation = poi.lifecycle.currentDegradation;
    const newDegradation = Math.min(100, previousDegradation + degradationIncrease);

    // Check for triggered effects
    const triggeredEffects: Array<{ effect: string; description: string }> = [];
    const updatedEffects = poi.lifecycle.degradationEffects.map(effect => {
      if (!effect.triggered && newDegradation >= effect.threshold) {
        triggeredEffects.push({ effect: effect.effect, description: effect.description ?? effect.effect });
        return { ...effect, triggered: true };
      }
      return effect;
    });

    // Apply effects
    let updatedPOI: POI = {
      ...poi,
      lifecycle: {
        ...poi.lifecycle,
        currentDegradation: newDegradation,
        degradationEffects: updatedEffects,
      },
    };

    // Handle specific effect types
    for (const effect of triggeredEffects) {
      updatedPOI = applyDegradationEffect(updatedPOI, effect.effect);
    }

    if (triggeredEffects.length > 0 || newDegradation !== previousDegradation) {
      events.push({
        poiId: poi.id,
        poiName: poi.name,
        previousDegradation,
        newDegradation,
        triggeredEffects,
      });
      updatedPOIs.push(updatedPOI);
    }
  }

  return { events, updatedPOIs };
}

function applyDegradationEffect(poi: POI, effect: string): POI {
  switch (effect) {
    case "threat_increases":
      return {
        ...poi,
        threatLevel: escalateThreatLevel(poi.threatLevel),
      };

    case "area_expands":
      // Double raid range if applicable
      if (poi.economics.raidsCaravans && poi.economics.raidRange) {
        return {
          ...poi,
          economics: {
            ...poi.economics,
            raidRange: poi.economics.raidRange * 2,
          },
        };
      }
      return poi;

    case "scouts_appear":
      // Increase alert level
      return {
        ...poi,
        control: {
          ...poi.control,
          alertLevel: Math.min(10, poi.control.alertLevel + 2),
        },
      };

    case "boss_upgrade":
      // Increase defender strength
      const strengthProgression: Record<string, string> = {
        minimal: "light",
        light: "moderate",
        moderate: "heavy",
        heavy: "fortress",
        fortress: "fortress",
        none: "minimal",
      };
      return {
        ...poi,
        control: {
          ...poi.control,
          defenderStrength: (strengthProgression[poi.control.defenderStrength] ?? poi.control.defenderStrength) as typeof poi.control.defenderStrength,
        },
      };

    default:
      return poi;
  }
}

// ============================================
// POI CLEARING
// ============================================

/**
 * Mark a POI as cleared and set up respawn timer.
 */
export function clearPOI(
  poi: POI,
  clearedBy: string,
  currentDate: Date,
  method: "combat" | "negotiation" | "stealth" | "magic" | "other" = "combat",
): POI {
  const respawnDate = poi.lifecycle.canRespawn
    ? new Date(currentDate.getTime() + poi.lifecycle.respawnDays * 24 * 60 * 60 * 1000)
    : undefined;

  return {
    ...poi,
    discovery: {
      ...poi.discovery,
      state: "cleared",
    },
    control: {
      ...poi.control,
      controllerType: "none",
      clearedBy,
      clearedAt: currentDate.toISOString(),
      clearMethod: method,
      defenderCount: 0,
      alertLevel: 0,
    },
    lifecycle: {
      ...poi.lifecycle,
      respawnAt: respawnDate?.toISOString(),
      currentDegradation: 0, // Reset degradation when cleared
      degradationEffects: STANDARD_DEGRADATION_EFFECTS.map(e => ({ ...e, triggered: false })),
    },
    updatedAt: currentDate.toISOString(),
  };
}

// ============================================
// POI CLAIMING
// ============================================

/**
 * Claim a cleared POI for the player.
 */
export function claimPOI(
  poi: POI,
  claimId: string,
  currentDate: Date,
): POI {
  if (poi.discovery.state !== "cleared") {
    throw new Error("Cannot claim POI that is not cleared");
  }

  if (!poi.claim?.claimable) {
    throw new Error("This POI is not claimable");
  }

  return {
    ...poi,
    discovery: {
      ...poi.discovery,
      state: "claimed",
    },
    control: {
      ...poi.control,
      controllerType: "player",
    },
    claim: {
      ...poi.claim!,
      claimId,
      claimedAt: currentDate.toISOString(),
    },
    lifecycle: {
      ...poi.lifecycle,
      canRespawn: false, // Claimed POIs don't respawn while held
      respawnAt: undefined,
    },
    updatedAt: currentDate.toISOString(),
  };
}

// ============================================
// WORLD TICK PROCESSING
// ============================================

export interface POITickResult {
  respawnEvents: RespawnEvent[];
  degradationEvents: DegradationEvent[];
  newRumors: Omit<POIRumor, "id">[];
  updatedPOIs: POI[];
}

/**
 * Process all POI events for a world tick.
 */
export function processPOITick(
  pois: POI[],
  settlements: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    population: number;
  }>,
  currentDate: Date,
  daysElapsed: number,
  getDistance: (poiId: string, settlementId: string) => number,
): POITickResult {
  const allUpdatedPOIs = new Map<string, POI>();

  // Process respawns
  const { events: respawnEvents, updatedPOIs: respawnedPOIs } = processRespawns(pois, currentDate);
  for (const poi of respawnedPOIs) {
    allUpdatedPOIs.set(poi.id, poi);
  }

  // Process degradation
  const currentPOIs = pois.map(p => allUpdatedPOIs.get(p.id) ?? p);
  const { events: degradationEvents, updatedPOIs: degradedPOIs } = processDegradation(currentPOIs, daysElapsed);
  for (const poi of degradedPOIs) {
    allUpdatedPOIs.set(poi.id, poi);
  }

  // Generate rumors
  const newRumors: Omit<POIRumor, "id">[] = [];
  const finalPOIs = pois.map(p => allUpdatedPOIs.get(p.id) ?? p);

  for (const poi of finalPOIs) {
    // Only generate rumors periodically
    if (Math.random() > 0.1) continue; // 10% chance per tick

    const nearbySettlements = settlements
      .map(s => ({
        ...s,
        distanceMiles: getDistance(poi.id, s.id),
      }))
      .filter(s => s.distanceMiles < 100)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 5); // Closest 5 settlements

    const rumors = generateRumors({ poi, nearbySettlements, currentDate });
    newRumors.push(...rumors);
  }

  return {
    respawnEvents,
    degradationEvents,
    newRumors,
    updatedPOIs: Array.from(allUpdatedPOIs.values()),
  };
}
