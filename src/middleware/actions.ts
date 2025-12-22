import { z } from "zod";

// ============================================
// MIDDLEWARE LAYER - ACTIONS
// ============================================
//
// Philosophy: ATOMIC OPERATIONS
//
// An "action" is a single user intent that may
// touch multiple systems. The middleware handles
// the orchestration.
//
// Example: "Start Combat"
//   1. Create combat instance
//   2. Roll initiative for all
//   3. Position tokens on grid
//   4. Switch scene mode
//   5. Notify all players
//   6. Activate AI for enemies
//
// The frontend calls ONE action.
// The middleware does the rest.
//

// ============================================
// ACTION RESULT
// ============================================

export const ActionResultSchema = z.object({
  success: z.boolean(),
  actionId: z.string().uuid(),
  actionType: z.string(),

  // What changed (for UI updates)
  changes: z
    .array(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        changeType: z.enum(["created", "updated", "deleted"]),
        fields: z.array(z.string()).optional(),
      }),
    )
    .default([]),

  // New aggregate states (if needed)
  updatedAggregates: z.record(z.string(), z.any()).optional(),

  // For display
  message: z.string().optional(),
  toast: z
    .object({
      type: z.enum(["success", "info", "warning", "error"]),
      message: z.string(),
    })
    .optional(),

  // Errors
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    })
    .optional(),

  // Events triggered (for other systems)
  triggeredEvents: z.array(z.string()).default([]),

  // Timestamp
  timestamp: z.date(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ============================================
// SESSION ACTIONS
// ============================================

export const StartSessionActionSchema = z.object({
  type: z.literal("session.start"),
  campaignId: z.string().uuid(),
  partyId: z.string().uuid(),
  sessionNumber: z.number().int().optional(), // Auto-increment if not provided
  worldDate: z.string().optional(),
  startingScene: z
    .object({
      locationId: z.string().uuid(),
      description: z.string().optional(),
    })
    .optional(),
});

export const EndSessionActionSchema = z.object({
  type: z.literal("session.end"),
  sessionId: z.string().uuid(),

  // Session wrap-up
  xpAwarded: z.number().int().optional(),
  lootDistributed: z.boolean().optional(),

  // Next session
  cliffhanger: z.string().optional(),
  nextSessionNotes: z.string().optional(),

  // Trigger downtime?
  startDowntime: z.boolean().default(true),
  downtimeDays: z.number().int().optional(),
});

export const ChangeSceneActionSchema = z.object({
  type: z.literal("session.changeScene"),
  sessionId: z.string().uuid(),

  newScene: z.object({
    type: z.enum([
      "exploration",
      "social",
      "combat",
      "puzzle",
      "travel",
      "downtime",
    ]),
    locationId: z.string().uuid(),
    description: z.string(),
    mood: z.string().optional(),
    presentNPCs: z.array(z.string().uuid()).optional(),
    musicUrl: z.string().optional(),
  }),

  // Transition
  transitionNarration: z.string().optional(),
});

// ============================================
// COMBAT ACTIONS
// ============================================

export const StartCombatActionSchema = z.object({
  type: z.literal("combat.start"),
  sessionId: z.string().uuid(),

  // Combatants
  playerCharacterIds: z.array(z.string().uuid()),
  enemyIds: z.array(z.string().uuid()),
  allyIds: z.array(z.string().uuid()).optional(),

  // Setup
  surprise: z
    .object({
      surprisedIds: z.array(z.string().uuid()),
    })
    .optional(),

  // Grid
  useGrid: z.boolean().default(false),
  mapId: z.string().uuid().optional(),
  initialPositions: z
    .array(
      z.object({
        entityId: z.string().uuid(),
        x: z.number().int(),
        y: z.number().int(),
      }),
    )
    .optional(),

  // Lair
  lairId: z.string().uuid().optional(),

  // Environment
  environment: z
    .object({
      lighting: z.string().optional(),
      terrain: z.array(z.string()).optional(),
      hazards: z.array(z.string()).optional(),
    })
    .optional(),
});

export const EndCombatActionSchema = z.object({
  type: z.literal("combat.end"),
  combatId: z.string().uuid(),

  outcome: z.enum(["victory", "defeat", "fled", "negotiated", "interrupted"]),

  // Loot
  generateLoot: z.boolean().default(true),

  // XP
  awardXP: z.boolean().default(true),
  bonusXP: z.number().int().optional(),
});

export const CombatTurnActionSchema = z.object({
  type: z.literal("combat.turn"),
  combatId: z.string().uuid(),
  combatantId: z.string().uuid(),

  action: z.discriminatedUnion("actionType", [
    // Attack
    z.object({
      actionType: z.literal("attack"),
      targetId: z.string().uuid(),
      attackName: z.string(),
      advantage: z.boolean().optional(),
      disadvantage: z.boolean().optional(),
    }),

    // Cast spell
    z.object({
      actionType: z.literal("cast"),
      spellName: z.string(),
      level: z.number().int(),
      targetIds: z.array(z.string().uuid()).optional(),
      targetPoint: z.object({ x: z.number(), y: z.number() }).optional(),
    }),

    // Move
    z.object({
      actionType: z.literal("move"),
      path: z.array(z.object({ x: z.number().int(), y: z.number().int() })),
    }),

    // Dash
    z.object({
      actionType: z.literal("dash"),
    }),

    // Dodge
    z.object({
      actionType: z.literal("dodge"),
    }),

    // Help
    z.object({
      actionType: z.literal("help"),
      targetId: z.string().uuid(),
    }),

    // Hide
    z.object({
      actionType: z.literal("hide"),
      stealthRoll: z.number().int().optional(),
    }),

    // Use item
    z.object({
      actionType: z.literal("useItem"),
      itemId: z.string(),
      targetId: z.string().uuid().optional(),
    }),

    // Use feature
    z.object({
      actionType: z.literal("useFeature"),
      featureName: z.string(),
      targetIds: z.array(z.string().uuid()).optional(),
    }),

    // End turn
    z.object({
      actionType: z.literal("endTurn"),
    }),

    // Delay
    z.object({
      actionType: z.literal("delay"),
    }),
  ]),

  // Action economy
  consumesAction: z.boolean().default(true),
  consumesBonusAction: z.boolean().default(false),
  consumesReaction: z.boolean().default(false),
  consumesMovement: z.number().int().optional(),
});

// ============================================
// CHARACTER ACTIONS
// ============================================

export const LevelUpActionSchema = z.object({
  type: z.literal("character.levelUp"),
  characterId: z.string().uuid(),

  newLevel: z.number().int(),

  choices: z.object({
    hitPoints: z.enum(["roll", "average"]),
    hitPointRoll: z.number().int().optional(),

    // Class features
    subclass: z.string().optional(),
    featureChoices: z
      .array(
        z.object({
          featureName: z.string(),
          choice: z.string(),
        }),
      )
      .optional(),

    // ASI or Feat
    asiOrFeat: z
      .discriminatedUnion("choice", [
        z.object({
          choice: z.literal("asi"),
          ability1: z.string(),
          ability2: z.string().optional(),
        }),
        z.object({
          choice: z.literal("feat"),
          featName: z.string(),
          featChoices: z.any().optional(),
        }),
      ])
      .optional(),

    // Spells
    newSpells: z.array(z.string()).optional(),
    replacedSpells: z
      .array(
        z.object({
          oldSpell: z.string(),
          newSpell: z.string(),
        }),
      )
      .optional(),
  }),
});

export const ShortRestActionSchema = z.object({
  type: z.literal("character.shortRest"),
  characterIds: z.array(z.string().uuid()),

  hitDiceSpent: z
    .array(
      z.object({
        characterId: z.string().uuid(),
        dice: z.number().int(),
        hpRecovered: z.number().int(),
      }),
    )
    .optional(),

  durationHours: z.number().default(1),
});

export const LongRestActionSchema = z.object({
  type: z.literal("character.longRest"),
  characterIds: z.array(z.string().uuid()),

  // Interruptions?
  interrupted: z.boolean().default(false),
  interruptionDetails: z.string().optional(),

  // Advance time?
  advanceWorldTime: z.boolean().default(true),
});

export const TakeDamageActionSchema = z.object({
  type: z.literal("character.takeDamage"),
  characterId: z.string().uuid(),

  damage: z.number().int(),
  damageType: z.string(),
  source: z.string(),

  // Modifiers
  resistance: z.boolean().default(false),
  vulnerability: z.boolean().default(false),
  immunity: z.boolean().default(false),
});

export const HealActionSchema = z.object({
  type: z.literal("character.heal"),
  characterId: z.string().uuid(),

  healing: z.number().int(),
  source: z.string(),

  tempHp: z.boolean().default(false),
});

export const AddConditionActionSchema = z.object({
  type: z.literal("character.addCondition"),
  characterId: z.string().uuid(),

  condition: z.string(),
  duration: z.string().optional(),
  source: z.string().optional(),
  saveDC: z.number().int().optional(),
  saveAbility: z.string().optional(),
});

// ============================================
// INVENTORY ACTIONS
// ============================================

export const TransferItemActionSchema = z.object({
  type: z.literal("inventory.transfer"),

  fromType: z.enum(["character", "party", "npc", "loot"]),
  fromId: z.string().uuid(),

  toType: z.enum(["character", "party", "npc", "sold"]),
  toId: z.string().uuid(),

  items: z.array(
    z.object({
      itemId: z.string(),
      quantity: z.number().int(),
    }),
  ),

  // For selling
  goldReceived: z.number().optional(),
});

export const DistributeLootActionSchema = z.object({
  type: z.literal("inventory.distributeLoot"),
  lootSourceId: z.string().uuid(),

  distribution: z.array(
    z.object({
      itemId: z.string(),
      recipientId: z.string().uuid(),
      recipientType: z.enum(["character", "party"]),
    }),
  ),

  goldDistribution: z
    .array(
      z.object({
        recipientId: z.string().uuid(),
        amount: z.number().int(),
      }),
    )
    .optional(),
});

export const UseConsumableActionSchema = z.object({
  type: z.literal("inventory.useConsumable"),
  characterId: z.string().uuid(),
  itemId: z.string(),

  targetId: z.string().uuid().optional(),

  // Result details populated by system
});

// ============================================
// QUEST ACTIONS
// ============================================

export const AcceptQuestActionSchema = z.object({
  type: z.literal("quest.accept"),
  questId: z.string().uuid(),
  partyId: z.string().uuid(),

  giverNPCId: z.string().uuid().optional(),
  negotiatedReward: z.any().optional(),
});

export const UpdateQuestProgressActionSchema = z.object({
  type: z.literal("quest.progress"),
  questId: z.string().uuid(),

  objectiveId: z.string().uuid().optional(),
  progress: z.number().int(), // 0-100

  note: z.string().optional(),
});

export const CompleteQuestActionSchema = z.object({
  type: z.literal("quest.complete"),
  questId: z.string().uuid(),

  outcome: z.enum(["success", "partial", "failed"]),

  // Rewards
  xpAwarded: z.number().int().optional(),
  goldAwarded: z.number().int().optional(),
  itemsAwarded: z.array(z.string()).optional(),

  // Consequences
  reputationChanges: z
    .array(
      z.object({
        factionId: z.string().uuid(),
        change: z.number().int(),
      }),
    )
    .optional(),

  // Follow-up
  unlockedQuestIds: z.array(z.string().uuid()).optional(),
});

// ============================================
// NPC ACTIONS
// ============================================

export const StartNPCConversationActionSchema = z.object({
  type: z.literal("npc.startConversation"),
  npcId: z.string().uuid(),
  sessionId: z.string().uuid(),

  initiatingCharacterId: z.string().uuid().optional(),

  // Context for AI
  situation: z.string().optional(),
  playerIntent: z.string().optional(),
});

export const NPCReactionActionSchema = z.object({
  type: z.literal("npc.reaction"),
  npcId: z.string().uuid(),

  trigger: z.string(),
  witnessedEvent: z.string(),

  // System calculates appropriate reaction
});

export const UpdateNPCAttitudeActionSchema = z.object({
  type: z.literal("npc.updateAttitude"),
  npcId: z.string().uuid(),

  change: z.number().int(), // -100 to 100
  reason: z.string(),

  towardCharacterId: z.string().uuid().optional(), // If toward specific character
});

// ============================================
// DOWNTIME ACTIONS
// ============================================

export const QueueDowntimeActionSchema = z.object({
  type: z.literal("downtime.queue"),
  characterId: z.string().uuid(),

  day: z.number().int(),
  slot: z.number().int(),

  activity: z.object({
    type: z.string(),
    details: z.any(),
    goldCost: z.number().optional(),
    itemsRequired: z.array(z.string()).optional(),
  }),
});

export const ResolveDowntimeActionSchema = z.object({
  type: z.literal("downtime.resolve"),
  periodId: z.string().uuid(),

  // GM can override results
  overrides: z
    .array(
      z.object({
        actionId: z.string().uuid(),
        result: z.any(),
      }),
    )
    .optional(),
});

export const SendFollowerMissionActionSchema = z.object({
  type: z.literal("downtime.followerMission"),
  followerId: z.string().uuid(),

  mission: z.object({
    type: z.string(),
    target: z.string().optional(),
    duration: z.number().int(), // Days
    resources: z.number().optional(),
  }),
});

// ============================================
// WORLD/ECONOMY ACTIONS
// ============================================

export const SimulateEconomyActionSchema = z.object({
  type: z.literal("world.simulateEconomy"),
  worldId: z.string().uuid(),

  daysToSimulate: z.number().int(),

  // Options
  generateEvents: z.boolean().default(true),
  updatePrices: z.boolean().default(true),
  processTradeRoutes: z.boolean().default(true),
});

export const TriggerWorldEventActionSchema = z.object({
  type: z.literal("world.triggerEvent"),
  worldId: z.string().uuid(),

  event: z.object({
    type: z.string(),
    name: z.string(),
    description: z.string(),
    scope: z.enum(["local", "regional", "continental", "global"]),
    affectedSettlementIds: z.array(z.string().uuid()).optional(),
    effects: z.array(z.any()),
  }),

  causedByParty: z.boolean().default(false),
});

export const ProcessFactionTurnActionSchema = z.object({
  type: z.literal("world.factionTurn"),
  worldId: z.string().uuid(),

  factionIds: z.array(z.string().uuid()).optional(), // Specific factions or all

  // AI makes decisions based on faction goals/resources
});

// ============================================
// GM ACTIONS
// ============================================

export const QuickGenerateActionSchema = z.object({
  type: z.literal("gm.quickGenerate"),

  entityType: z.enum([
    "npc",
    "location",
    "item",
    "encounter",
    "settlement",
    "faction",
  ]),

  constraints: z
    .object({
      style: z.string().optional(),
      level: z.number().int().optional(),
      theme: z.string().optional(),
      location: z.string().optional(),
      count: z.number().int().default(1),
    })
    .optional(),

  // Quick or detailed
  detailLevel: z
    .enum(["minimal", "basic", "detailed", "complete"])
    .default("basic"),
});

export const RevealSecretActionSchema = z.object({
  type: z.literal("gm.revealSecret"),
  secretId: z.string().uuid(),

  revealedToCharacterIds: z.array(z.string().uuid()),

  howRevealed: z.string(),
});

export const AdjustDifficultyActionSchema = z.object({
  type: z.literal("gm.adjustDifficulty"),

  targetType: z.enum(["combat", "puzzle", "encounter"]),
  targetId: z.string().uuid(),

  adjustment: z.enum(["much_easier", "easier", "harder", "much_harder"]),

  method: z.string().optional(), // How to adjust
});

export const AdvanceTimeActionSchema = z.object({
  type: z.literal("gm.advanceTime"),

  amount: z.number().int(),
  unit: z.enum(["minutes", "hours", "days", "weeks", "months"]),

  // What to simulate during time skip
  simulateEconomy: z.boolean().default(true),
  simulateFactions: z.boolean().default(true),
  processDowntime: z.boolean().default(true),
  generateEvents: z.boolean().default(true),
});

// ============================================
// ACTION TYPE UNION
// ============================================

export const ActionSchema = z.discriminatedUnion("type", [
  // Session
  StartSessionActionSchema,
  EndSessionActionSchema,
  ChangeSceneActionSchema,

  // Combat
  StartCombatActionSchema,
  EndCombatActionSchema,
  CombatTurnActionSchema,

  // Character
  LevelUpActionSchema,
  ShortRestActionSchema,
  LongRestActionSchema,
  TakeDamageActionSchema,
  HealActionSchema,
  AddConditionActionSchema,

  // Inventory
  TransferItemActionSchema,
  DistributeLootActionSchema,
  UseConsumableActionSchema,

  // Quest
  AcceptQuestActionSchema,
  UpdateQuestProgressActionSchema,
  CompleteQuestActionSchema,

  // NPC
  StartNPCConversationActionSchema,
  NPCReactionActionSchema,
  UpdateNPCAttitudeActionSchema,

  // Downtime
  QueueDowntimeActionSchema,
  ResolveDowntimeActionSchema,
  SendFollowerMissionActionSchema,

  // World
  SimulateEconomyActionSchema,
  TriggerWorldEventActionSchema,
  ProcessFactionTurnActionSchema,

  // GM
  QuickGenerateActionSchema,
  RevealSecretActionSchema,
  AdjustDifficultyActionSchema,
  AdvanceTimeActionSchema,
]);
export type Action = z.infer<typeof ActionSchema>;

// ============================================
// ACTION DISPATCHER INTERFACE
// ============================================

export interface ActionDispatcher {
  // Execute an action
  dispatch(action: Action, userId: string): Promise<ActionResult>;

  // Validate before dispatch
  validate(
    action: Action,
    userId: string,
  ): Promise<{ valid: boolean; errors: string[] }>;

  // Undo last action (if possible)
  undo(actionId: string): Promise<ActionResult>;

  // Get action history
  getHistory(filters?: {
    userId?: string;
    sessionId?: string;
    actionType?: string;
    since?: Date;
  }): Promise<ActionResult[]>;
}

// ============================================
// ACTION HANDLERS MAP
// ============================================
//
// Each action type has a handler that:
// 1. Validates the action
// 2. Executes changes across systems
// 3. Generates events
// 4. Returns updated aggregates
//

export const ActionHandlers: Record<string, string> = {
  "session.start": "Creates session, loads party, sets scene, notifies players",
  "session.end": "Closes session, awards XP, triggers downtime, saves state",
  "session.changeScene":
    "Updates scene, loads NPCs, activates agents, broadcasts",

  "combat.start":
    "Creates combat, rolls initiative, positions tokens, switches mode",
  "combat.end": "Resolves combat, generates loot, awards XP, cleans up",
  "combat.turn":
    "Validates action, applies effects, checks death, advances turn",

  "character.levelUp":
    "Updates stats, adds features, recalculates derived values",
  "character.shortRest":
    "Heals HP, refreshes short rest abilities, advances time",
  "character.longRest":
    "Full heal, refresh all abilities, advance time, trigger events",
  "character.takeDamage": "Applies damage, checks death, triggers reactions",
  "character.heal": "Applies healing, checks temp HP, updates display",
  "character.addCondition": "Adds condition, sets duration, triggers effects",

  "inventory.transfer": "Moves items, updates weights, logs transaction",
  "inventory.distributeLoot": "Distributes items/gold, updates all inventories",
  "inventory.useConsumable": "Consumes item, applies effect, updates count",

  "quest.accept": "Adds quest to party, updates NPC, creates objectives",
  "quest.progress": "Updates progress, checks completion, triggers events",
  "quest.complete": "Awards rewards, updates reputation, unlocks content",

  "npc.startConversation":
    "Loads NPC agent, builds context, initiates dialogue",
  "npc.reaction": "Calculates reaction, updates attitude, may trigger events",
  "npc.updateAttitude": "Changes attitude, updates memories, adjusts behavior",

  "downtime.queue": "Validates action, deducts resources, adds to queue",
  "downtime.resolve": "Processes all actions, generates results, updates world",
  "downtime.followerMission":
    "Dispatches follower, sets timer, creates mission",

  "world.simulateEconomy": "Runs economy sim, updates prices, generates events",
  "world.triggerEvent": "Creates event, calculates effects, propagates changes",
  "world.factionTurn": "Runs faction AI, executes schemes, updates relations",

  "gm.quickGenerate": "AI generates content based on constraints",
  "gm.revealSecret": "Updates secret, notifies characters, logs reveal",
  "gm.adjustDifficulty": "Modifies encounter, updates stats, recalculates",
  "gm.advanceTime": "Advances calendar, runs simulations, processes events",
};
