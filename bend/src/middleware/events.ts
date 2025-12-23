import { z } from "zod";

// ============================================
// MIDDLEWARE LAYER - EVENTS
// ============================================
//
// Philosophy: REACTIVE ORCHESTRATION
//
// When something happens in one system,
// other systems may need to react.
//
// Example: Character dies
//   → Combat system marks as dead
//   → Party system updates roster
//   → Quest system checks fail conditions
//   → NPC system triggers reactions
//   → Narrative system logs event
//   → UI system shows death animation
//
// Events are the NERVOUS SYSTEM of the engine.
//

// ============================================
// EVENT TYPES
// ============================================

export const EventCategorySchema = z.enum([
  "session", // Session lifecycle
  "combat", // Combat events
  "character", // Character state changes
  "party", // Party events
  "inventory", // Item events
  "quest", // Quest progression
  "npc", // NPC events
  "world", // World state changes
  "economy", // Economic events
  "faction", // Faction events
  "narrative", // Story events
  "system", // System events
]);
export type EventCategory = z.infer<typeof EventCategorySchema>;

// ============================================
// BASE EVENT SCHEMA
// ============================================

export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  category: EventCategorySchema,
  type: z.string(),

  // When
  timestamp: z.date(),
  worldDate: z.string().optional(),

  // Context
  sessionId: z.string().uuid().optional(),
  campaignId: z.string().uuid(),

  // Who triggered
  triggeredBy: z.object({
    type: z.enum(["player", "gm", "system", "npc", "faction"]),
    id: z.string().uuid().optional(),
    name: z.string().optional(),
  }),

  // Event data (specific to type)
  data: z.any(),

  // For cascading
  causedByEventId: z.string().uuid().optional(),

  // Handling
  handled: z.boolean().default(false),
  handlers: z.array(z.string()).default([]), // Which systems handled it
});
export type BaseEvent = z.infer<typeof BaseEventSchema>;

// ============================================
// SESSION EVENTS
// ============================================

export const SessionStartedEventSchema = BaseEventSchema.extend({
  category: z.literal("session"),
  type: z.literal("session.started"),
  data: z.object({
    sessionId: z.string().uuid(),
    sessionNumber: z.number().int(),
    partyId: z.string().uuid(),
    playerCount: z.number().int(),
    startingLocation: z.string(),
  }),
});

export const SessionEndedEventSchema = BaseEventSchema.extend({
  category: z.literal("session"),
  type: z.literal("session.ended"),
  data: z.object({
    sessionId: z.string().uuid(),
    duration: z.number().int(), // Minutes
    xpAwarded: z.number().int(),
    worldTimeAdvanced: z.string(),
  }),
});

export const SceneChangedEventSchema = BaseEventSchema.extend({
  category: z.literal("session"),
  type: z.literal("session.sceneChanged"),
  data: z.object({
    previousSceneType: z.string(),
    newSceneType: z.string(),
    newLocationId: z.string().uuid(),
    newLocationName: z.string(),
  }),
});

// ============================================
// COMBAT EVENTS
// ============================================

export const CombatStartedEventSchema = BaseEventSchema.extend({
  category: z.literal("combat"),
  type: z.literal("combat.started"),
  data: z.object({
    combatId: z.string().uuid(),
    combatantCount: z.number().int(),
    enemyCount: z.number().int(),
    environment: z.string(),
    hasLair: z.boolean(),
  }),
});

export const CombatEndedEventSchema = BaseEventSchema.extend({
  category: z.literal("combat"),
  type: z.literal("combat.ended"),
  data: z.object({
    combatId: z.string().uuid(),
    outcome: z.string(),
    roundsElapsed: z.number().int(),
    playerDeaths: z.number().int(),
    enemiesDefeated: z.number().int(),
    xpEarned: z.number().int(),
  }),
});

export const TurnStartedEventSchema = BaseEventSchema.extend({
  category: z.literal("combat"),
  type: z.literal("combat.turnStarted"),
  data: z.object({
    combatId: z.string().uuid(),
    combatantId: z.string().uuid(),
    combatantName: z.string(),
    isPlayer: z.boolean(),
    round: z.number().int(),
  }),
});

export const AttackRolledEventSchema = BaseEventSchema.extend({
  category: z.literal("combat"),
  type: z.literal("combat.attackRolled"),
  data: z.object({
    attackerId: z.string().uuid(),
    targetId: z.string().uuid(),
    attackName: z.string(),
    roll: z.number().int(),
    total: z.number().int(),
    hit: z.boolean(),
    critical: z.boolean(),
  }),
});

export const DamageDealtEventSchema = BaseEventSchema.extend({
  category: z.literal("combat"),
  type: z.literal("combat.damageDealt"),
  data: z.object({
    attackerId: z.string().uuid(),
    targetId: z.string().uuid(),
    damage: z.number().int(),
    damageType: z.string(),
    wasResisted: z.boolean(),
    wasVulnerable: z.boolean(),
    targetHpAfter: z.number().int(),
  }),
});

export const SpellCastEventSchema = BaseEventSchema.extend({
  category: z.literal("combat"),
  type: z.literal("combat.spellCast"),
  data: z.object({
    casterId: z.string().uuid(),
    spellName: z.string(),
    spellLevel: z.number().int(),
    targetIds: z.array(z.string().uuid()),
    concentration: z.boolean(),
    slotUsed: z.boolean(),
  }),
});

// ============================================
// CHARACTER EVENTS
// ============================================

export const CharacterDamagedEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.damaged"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    damage: z.number().int(),
    damageType: z.string(),
    source: z.string(),
    hpBefore: z.number().int(),
    hpAfter: z.number().int(),
    bloodied: z.boolean(), // Crossed 50% threshold
  }),
});

export const CharacterHealedEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.healed"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    healing: z.number().int(),
    source: z.string(),
    hpAfter: z.number().int(),
    wasUnconscious: z.boolean(),
  }),
});

export const CharacterDiedEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.died"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    causeOfDeath: z.string(),
    killedBy: z.string().optional(),
    location: z.string(),
    isPlayer: z.boolean(),
  }),
});

export const CharacterUnconsciousEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.unconscious"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    cause: z.string(),
  }),
});

export const CharacterLeveledUpEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.leveledUp"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    previousLevel: z.number().int(),
    newLevel: z.number().int(),
    newFeatures: z.array(z.string()),
  }),
});

export const ConditionAppliedEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.conditionApplied"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    condition: z.string(),
    source: z.string(),
    duration: z.string().optional(),
  }),
});

export const ConditionRemovedEventSchema = BaseEventSchema.extend({
  category: z.literal("character"),
  type: z.literal("character.conditionRemoved"),
  data: z.object({
    characterId: z.string().uuid(),
    characterName: z.string(),
    condition: z.string(),
    reason: z.string(),
  }),
});

// ============================================
// QUEST EVENTS
// ============================================

export const QuestAcceptedEventSchema = BaseEventSchema.extend({
  category: z.literal("quest"),
  type: z.literal("quest.accepted"),
  data: z.object({
    questId: z.string().uuid(),
    questName: z.string(),
    giverNPCId: z.string().uuid().optional(),
    giverName: z.string().optional(),
    partyId: z.string().uuid(),
  }),
});

export const QuestProgressedEventSchema = BaseEventSchema.extend({
  category: z.literal("quest"),
  type: z.literal("quest.progressed"),
  data: z.object({
    questId: z.string().uuid(),
    questName: z.string(),
    objectiveCompleted: z.string().optional(),
    progressBefore: z.number().int(),
    progressAfter: z.number().int(),
  }),
});

export const QuestCompletedEventSchema = BaseEventSchema.extend({
  category: z.literal("quest"),
  type: z.literal("quest.completed"),
  data: z.object({
    questId: z.string().uuid(),
    questName: z.string(),
    outcome: z.string(),
    xpAwarded: z.number().int(),
    goldAwarded: z.number().int(),
    itemsAwarded: z.array(z.string()),
  }),
});

export const QuestFailedEventSchema = BaseEventSchema.extend({
  category: z.literal("quest"),
  type: z.literal("quest.failed"),
  data: z.object({
    questId: z.string().uuid(),
    questName: z.string(),
    reason: z.string(),
    consequences: z.array(z.string()),
  }),
});

// ============================================
// NPC EVENTS
// ============================================

export const NPCMetEventSchema = BaseEventSchema.extend({
  category: z.literal("npc"),
  type: z.literal("npc.met"),
  data: z.object({
    npcId: z.string().uuid(),
    npcName: z.string(),
    location: z.string(),
    firstImpression: z.string(),
  }),
});

export const NPCAttitudeChangedEventSchema = BaseEventSchema.extend({
  category: z.literal("npc"),
  type: z.literal("npc.attitudeChanged"),
  data: z.object({
    npcId: z.string().uuid(),
    npcName: z.string(),
    previousAttitude: z.number().int(),
    newAttitude: z.number().int(),
    reason: z.string(),
  }),
});

export const NPCDiedEventSchema = BaseEventSchema.extend({
  category: z.literal("npc"),
  type: z.literal("npc.died"),
  data: z.object({
    npcId: z.string().uuid(),
    npcName: z.string(),
    causeOfDeath: z.string(),
    location: z.string(),
    wasImportant: z.boolean(),
    consequences: z.array(z.string()),
  }),
});

// ============================================
// WORLD EVENTS
// ============================================

export const EconomicEventOccurredEventSchema = BaseEventSchema.extend({
  category: z.literal("economy"),
  type: z.literal("economy.eventOccurred"),
  data: z.object({
    eventId: z.string().uuid(),
    eventType: z.string(),
    eventName: z.string(),
    scope: z.string(),
    affectedSettlements: z.array(z.string()),
    severity: z.string(),
  }),
});

export const PriceChangedEventSchema = BaseEventSchema.extend({
  category: z.literal("economy"),
  type: z.literal("economy.priceChanged"),
  data: z.object({
    settlementId: z.string().uuid(),
    settlementName: z.string(),
    commodity: z.string(),
    previousPrice: z.number(),
    newPrice: z.number(),
    changePercent: z.number(),
    reason: z.string(),
  }),
});

export const FactionSchemeAdvancedEventSchema = BaseEventSchema.extend({
  category: z.literal("faction"),
  type: z.literal("faction.schemeAdvanced"),
  data: z.object({
    factionId: z.string().uuid(),
    factionName: z.string(),
    schemeName: z.string(),
    stage: z.number().int(),
    visibleToParty: z.boolean(),
    effects: z.array(z.string()),
  }),
});

export const FactionRelationChangedEventSchema = BaseEventSchema.extend({
  category: z.literal("faction"),
  type: z.literal("faction.relationChanged"),
  data: z.object({
    faction1Id: z.string().uuid(),
    faction1Name: z.string(),
    faction2Id: z.string().uuid(),
    faction2Name: z.string(),
    previousRelation: z.string(),
    newRelation: z.string(),
    reason: z.string(),
  }),
});

// ============================================
// NARRATIVE EVENTS
// ============================================

export const SecretRevealedEventSchema = BaseEventSchema.extend({
  category: z.literal("narrative"),
  type: z.literal("narrative.secretRevealed"),
  data: z.object({
    secretId: z.string().uuid(),
    secretSummary: z.string(),
    revealedToCharacterIds: z.array(z.string().uuid()),
    howRevealed: z.string(),
    impact: z.string(),
  }),
});

export const PlotThreadCreatedEventSchema = BaseEventSchema.extend({
  category: z.literal("narrative"),
  type: z.literal("narrative.plotThreadCreated"),
  data: z.object({
    threadId: z.string().uuid(),
    threadName: z.string(),
    origin: z.string(),
    hooks: z.array(z.string()),
  }),
});

export const MilestoneReachedEventSchema = BaseEventSchema.extend({
  category: z.literal("narrative"),
  type: z.literal("narrative.milestoneReached"),
  data: z.object({
    milestoneName: z.string(),
    arcId: z.string().uuid().optional(),
    xpAwarded: z.number().int().optional(),
    worldStateChanges: z.array(z.string()),
  }),
});

// ============================================
// EVENT HANDLER INTERFACE
// ============================================

export interface EventHandler {
  // Systems that this handler updates
  systems: string[];

  // Event types this handler responds to
  handles: string[];

  // Priority (higher = runs first)
  priority: number;

  // Handle the event
  handle(event: BaseEvent): Promise<{
    success: boolean;
    changes: any[];
    triggeredEvents: BaseEvent[];
  }>;
}

// ============================================
// EVENT BUS INTERFACE
// ============================================

export interface EventBus {
  // Publish an event
  publish(event: BaseEvent): Promise<void>;

  // Subscribe to events
  subscribe(
    eventTypes: string[],
    handler: (event: BaseEvent) => Promise<void>,
  ): () => void; // Returns unsubscribe function

  // Get event history
  getHistory(filters?: {
    category?: EventCategory;
    types?: string[];
    sessionId?: string;
    since?: Date;
    limit?: number;
  }): Promise<BaseEvent[]>;

  // Replay events (for debugging/recovery)
  replay(eventIds: string[]): Promise<void>;
}

// ============================================
// EVENT HANDLERS REGISTRY
// ============================================
//
// Maps events to systems that need to respond.
//

export const EventHandlersRegistry: Record<string, string[]> = {
  // Combat events
  "combat.started": ["session", "ui", "audio"],
  "combat.ended": ["session", "inventory", "experience", "narrative", "ui"],
  "combat.damageDealt": ["character", "combat", "ui", "audio"],

  // Character events
  "character.damaged": ["combat", "ui", "conditions"],
  "character.died": ["combat", "party", "quest", "narrative", "npc", "ui"],
  "character.leveledUp": ["character", "party", "narrative", "ui"],
  "character.conditionApplied": ["combat", "ui"],

  // Quest events
  "quest.completed": ["party", "reputation", "narrative", "economy", "ui"],
  "quest.failed": ["party", "reputation", "narrative", "npc", "ui"],

  // NPC events
  "npc.attitudeChanged": ["npc", "reputation", "quest", "dialogue"],
  "npc.died": ["quest", "faction", "narrative", "economy"],

  // Economy events
  "economy.eventOccurred": ["settlement", "faction", "trade", "narrative"],
  "economy.priceChanged": ["settlement", "trade", "ui"],

  // Faction events
  "faction.schemeAdvanced": ["world", "narrative", "settlement", "npc"],

  // Narrative events
  "narrative.secretRevealed": ["quest", "npc", "faction", "ui"],
  "narrative.milestoneReached": ["party", "experience", "narrative", "ui"],
};

// ============================================
// EVENT CASCADES
// ============================================
//
// Some events trigger other events.
//

export const EventCascades: Record<string, string[]> = {
  // Character death can trigger multiple cascades
  "character.died": [
    // If important NPC
    "faction.memberLost",
    "quest.failCheck",
    "narrative.plotImpact",
    // If player character
    "party.memberLost",
    "session.playerDeath",
  ],

  // Quest completion cascades
  "quest.completed": [
    "reputation.update",
    "faction.reaction",
    "npc.reaction",
    "narrative.threadUpdate",
  ],

  // Economic events cascade
  "economy.eventOccurred": [
    "settlement.update",
    "trade.routeAffected",
    "faction.resourceChange",
  ],

  // Faction scheme completion
  "faction.schemeCompleted": [
    "world.stateChange",
    "settlement.affected",
    "npc.reactions",
    "narrative.plotAdvance",
  ],
};
