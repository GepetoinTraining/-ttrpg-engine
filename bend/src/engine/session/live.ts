import { z } from "zod";
import { GridConfigSchema, TokenSchema } from "../grid/types";
import { ResourceTypeSchema } from "../simulation/downtime";

// ============================================
// THE LIVE SESSION SYSTEM
// ============================================
//
// This is where everything comes together.
// The actual at-the-table experience.
//
// Philosophy:
//   - Cards are the atomic unit of play
//   - Everything flows through cards
//   - Nothing gets lost
//   - GM controls the narrative
//   - Players see what they should see
//   - Combat cards BECOME the grid
//   - Phones are the player interface
//

// ============================================
// SCENE CARD TYPES
// ============================================

export const CardTypeSchema = z.enum([
  // Narrative
  "narrative", // Description, dialogue, story
  "revelation", // Information reveal (can be layered)
  "transition", // Scene change, travel, time skip

  // Interaction
  "encounter", // Social encounter, NPC interaction
  "exploration", // Investigating, searching
  "puzzle", // Riddle, mechanism, challenge

  // Action
  "combat", // Battle (transforms to grid)
  "chase", // Pursuit sequence
  "skill_challenge", // Group challenge, timed event

  // Meta
  "downtime_reveal", // Show downtime outcomes
  "loot", // Treasure, rewards
  "rest", // Short/long rest
  "milestone", // Level up, major achievement

  // GM Tools
  "notes", // GM-only notes
  "contingency", // "If they do X" prepared content
]);
export type CardType = z.infer<typeof CardTypeSchema>;

// ============================================
// VISIBILITY & LAYERING
// ============================================

export const VisibilitySchema = z.enum([
  "gm_only", // Only GM sees
  "all_players", // Everyone sees
  "specific_players", // Named players only
  "perception_gated", // Requires check to see
  "knowledge_gated", // Requires specific knowledge
  "stat_gated", // Requires stat threshold
]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const ContentLayerSchema = z.object({
  id: z.string().uuid(),

  // What's in this layer
  content: z.string(),
  contentType: z.enum(["text", "image", "audio", "map", "token", "stat_block"]),

  // Who sees it
  visibility: VisibilitySchema,

  // Visibility conditions
  visibleTo: z.array(z.string().uuid()).optional(), // Specific character IDs

  // Gating conditions
  gating: z
    .object({
      // Perception gated
      perceptionDC: z.number().int().optional(),
      passivePerceptionMin: z.number().int().optional(),

      // Knowledge gated
      requiredKnowledge: z.string().optional(), // "cult_symbols", "noble_houses"

      // Stat gated
      statRequirement: z
        .object({
          stat: z.string(),
          minimum: z.number().int(),
        })
        .optional(),

      // Skill gated
      skillRequirement: z
        .object({
          skill: z.string(),
          dc: z.number().int(),
        })
        .optional(),

      // Item/Feature gated
      requiresItem: z.string().optional(),
      requiresFeature: z.string().optional(),

      // Class/Race gated
      requiresClass: z.string().optional(),
      requiresRace: z.string().optional(),
    })
    .optional(),

  // Has this been revealed?
  revealed: z.boolean().default(false),
  revealedTo: z.array(z.string().uuid()).default([]),
  revealedAt: z.date().optional(),

  // GM notes about this layer
  gmNotes: z.string().optional(),
});
export type ContentLayer = z.infer<typeof ContentLayerSchema>;

// ============================================
// SCENE CARD
// ============================================

export const SceneCardSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),

  // Identity
  type: CardTypeSchema,
  title: z.string(),

  // Sequencing
  sequenceOrder: z.number().int(), // Position in session
  parentCardId: z.string().uuid().optional(), // For nested cards

  // Content (layered)
  layers: z.array(ContentLayerSchema).default([]),

  // Primary content (what everyone sees first)
  primaryContent: z.object({
    description: z.string(),
    readAloud: z.string().optional(), // Box text for GM to read
    imageUrl: z.string().optional(),
    audioUrl: z.string().optional(),
  }),

  // GM-only content
  gmContent: z
    .object({
      notes: z.string().optional(),
      secrets: z.array(z.string()).optional(),
      contingencies: z
        .array(
          z.object({
            trigger: z.string(),
            response: z.string(),
          }),
        )
        .optional(),
      hints: z.array(z.string()).optional(),
    })
    .optional(),

  // NPCs in this scene
  npcsPresent: z
    .array(
      z.object({
        npcId: z.string().uuid(),
        name: z.string(),
        role: z.string(),
        statBlockReady: z.boolean().default(false),
      }),
    )
    .default([]),

  // Locations
  locationId: z.string().uuid().optional(),
  locationName: z.string().optional(),

  // State
  status: z
    .enum([
      "prepared", // Ready to use
      "active", // Currently displayed
      "completed", // Done
      "skipped", // Didn't happen
    ])
    .default("prepared"),

  // Timing
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  estimatedDuration: z.number().int().optional(), // Minutes
  actualDuration: z.number().int().optional(),

  // Player notes (each player can add notes)
  playerNotes: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        characterId: z.string().uuid(),
        notes: z.string(),
        timestamp: z.date(),
      }),
    )
    .default([]),

  // Outcomes (what happened)
  outcomes: z
    .array(
      z.object({
        type: z.string(),
        description: z.string(),
        affectedCharacters: z.array(z.string().uuid()).optional(),
      }),
    )
    .default([]),

  // Tags for search/filter
  tags: z.array(z.string()).default([]),
});
export type SceneCard = z.infer<typeof SceneCardSchema>;

// ============================================
// COMBAT CARD (Extends Scene Card → Grid)
// ============================================

export const CombatCardSchema = SceneCardSchema.extend({
  type: z.literal("combat"),

  // Grid configuration
  grid: z
    .object({
      config: GridConfigSchema,

      // Pre-placed tokens
      tokens: z.array(TokenSchema).default([]),

      // Map image
      mapImageUrl: z.string().optional(),
      mapScale: z.number().optional(), // Pixels per cell

      // Fog of war
      fogOfWar: z.boolean().default(true),
      revealedCells: z
        .array(
          z.object({
            q: z.number().int(),
            r: z.number().int(),
          }),
        )
        .default([]),

      // Environment
      terrain: z
        .array(
          z.object({
            cells: z.array(
              z.object({ q: z.number().int(), r: z.number().int() }),
            ),
            type: z.string(), // "difficult", "water", "lava", etc.
            effect: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Combat state
  combatState: z
    .object({
      active: z.boolean().default(false),
      round: z.number().int().default(0),

      // Initiative order
      initiativeOrder: z
        .array(
          z.object({
            entityId: z.string().uuid(),
            entityName: z.string(),
            entityType: z.enum(["pc", "npc", "monster", "lair"]),
            initiative: z.number().int(),
            hasActed: z.boolean().default(false),
            isCurrentTurn: z.boolean().default(false),
          }),
        )
        .default([]),

      // Current turn
      currentTurnIndex: z.number().int().default(0),

      // Combatants
      combatants: z
        .array(
          z.object({
            entityId: z.string().uuid(),
            name: z.string(),
            type: z.enum(["pc", "ally", "enemy", "neutral"]),

            // Position on grid
            position: z
              .object({
                q: z.number().int(),
                r: z.number().int(),
              })
              .optional(),

            // Combat stats
            hp: z.object({
              current: z.number().int(),
              max: z.number().int(),
              temp: z.number().int().default(0),
            }),
            ac: z.number().int(),

            // Conditions
            conditions: z.array(z.string()).default([]),
            concentrating: z.string().optional(),

            // Status
            isVisible: z.boolean().default(true),
            isDefeated: z.boolean().default(false),
          }),
        )
        .default([]),

      // Combat log
      combatLog: z
        .array(
          z.object({
            round: z.number().int(),
            turn: z.string(),
            action: z.string(),
            result: z.string(),
            damage: z.number().int().optional(),
            timestamp: z.date(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Pre-set encounter info
  encounterInfo: z
    .object({
      name: z.string().optional(),
      difficulty: z
        .enum(["trivial", "easy", "medium", "hard", "deadly"])
        .optional(),
      xpBudget: z.number().int().optional(),
      monsters: z
        .array(
          z.object({
            name: z.string(),
            count: z.number().int(),
            cr: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type CombatCard = z.infer<typeof CombatCardSchema>;

// ============================================
// DOWNTIME REVEAL CARD
// ============================================

export const DowntimeRevealCardSchema = SceneCardSchema.extend({
  type: z.literal("downtime_reveal"),

  // Outcomes to reveal
  downtimeOutcomes: z
    .array(
      z.object({
        actionId: z.string().uuid(),
        characterId: z.string().uuid(),
        characterName: z.string(),

        // The action
        actionName: z.string(),
        actionDescription: z.string(),

        // Visibility
        isSecret: z.boolean().default(false),
        visibleTo: z.array(z.string().uuid()), // Character IDs who see this

        // Result
        outcome: z.enum([
          "critical_success",
          "success",
          "partial",
          "failure",
          "critical_failure",
        ]),
        resultSummary: z.string(),
        resultDetails: z.string().optional(),

        // Rewards/Consequences
        rewards: z
          .array(
            z.object({
              type: ResourceTypeSchema,
              amount: z.number(),
            }),
          )
          .default([]),

        consequences: z.array(z.string()).default([]),

        // Revealed?
        revealed: z.boolean().default(false),
        revealedAt: z.date().optional(),
      }),
    )
    .default([]),

  // Secret action tracking
  secretActionsRevealed: z.boolean().default(false),
});
export type DowntimeRevealCard = z.infer<typeof DowntimeRevealCardSchema>;

// ============================================
// LOOT CARD
// ============================================

export const LootCardSchema = SceneCardSchema.extend({
  type: z.literal("loot"),

  // Items found
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),

        // Value
        value: z.number().optional(),
        valueUnit: z.string().default("gp"),

        // Properties
        magical: z.boolean().default(false),
        requiresIdentification: z.boolean().default(false),
        identified: z.boolean().default(true),
        identifiedDescription: z.string().optional(),

        // Claiming
        claimedBy: z.string().uuid().optional(),
        claimedByName: z.string().optional(),

        // Status
        status: z
          .enum(["found", "claimed", "party_inventory", "sold", "discarded"])
          .default("found"),
      }),
    )
    .default([]),

  // Currency found
  currency: z
    .object({
      cp: z.number().int().default(0),
      sp: z.number().int().default(0),
      ep: z.number().int().default(0),
      gp: z.number().int().default(0),
      pp: z.number().int().default(0),
    })
    .default({}),

  // Distribution
  distributed: z.boolean().default(false),
  distributionMethod: z
    .enum(["equal_split", "need_based", "auction", "manual"])
    .optional(),

  // Auto-tracking
  autoAddedToInventory: z.boolean().default(false),
});
export type LootCard = z.infer<typeof LootCardSchema>;

// ============================================
// LIVE SESSION
// ============================================

export const LiveSessionSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  sessionId: z.string().uuid(), // Links to SessionSchema in narrative

  // Session info
  sessionNumber: z.number().int(),
  title: z.string(),
  scheduledFor: z.date().optional(),

  // State
  status: z
    .enum([
      "preparing", // GM is setting up
      "ready", // Ready to start
      "live", // In progress
      "paused", // Temporarily paused
      "ending", // Wrapping up
      "completed", // Done
      "cancelled", // Didn't happen
    ])
    .default("preparing"),

  // Timing
  startedAt: z.date().optional(),
  endedAt: z.date().optional(),
  pausedAt: z.date().optional(),
  totalPauseDuration: z.number().int().default(0), // Minutes

  // Cards
  cards: z.array(z.string().uuid()).default([]), // Card IDs in order
  currentCardId: z.string().uuid().optional(),
  currentCardIndex: z.number().int().default(0),

  // Participants
  participants: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        characterId: z.string().uuid(),
        characterName: z.string(),

        // Connection status (for remote play)
        connected: z.boolean().default(true),
        lastSeen: z.date().optional(),

        // Their device
        deviceType: z.enum(["desktop", "tablet", "phone"]).optional(),
      }),
    )
    .default([]),

  // Accumulated session data
  sessionData: z.object({
    // All loot found
    lootFound: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          name: z.string(),
          value: z.number().optional(),
          claimedBy: z.string().uuid().optional(),
          foundInCard: z.string().uuid(),
        }),
      )
      .default([]),

    // Currency collected
    currencyCollected: z.object({
      cp: z.number().int().default(0),
      sp: z.number().int().default(0),
      ep: z.number().int().default(0),
      gp: z.number().int().default(0),
      pp: z.number().int().default(0),
    }),

    // XP earned (if using XP)
    xpEarned: z.number().int().default(0),
    xpBreakdown: z
      .array(
        z.object({
          source: z.string(),
          amount: z.number().int(),
        }),
      )
      .default([]),

    // NPCs encountered
    npcsEncountered: z
      .array(
        z.object({
          npcId: z.string().uuid(),
          name: z.string(),
          impression: z
            .enum(["hostile", "unfriendly", "neutral", "friendly", "allied"])
            .optional(),
        }),
      )
      .default([]),

    // Locations visited
    locationsVisited: z
      .array(
        z.object({
          locationId: z.string().uuid(),
          name: z.string(),
        }),
      )
      .default([]),

    // Quests progressed
    questProgress: z
      .array(
        z.object({
          questId: z.string().uuid(),
          questName: z.string(),
          progressMade: z.string(),
        }),
      )
      .default([]),

    // Key decisions made
    keyDecisions: z
      .array(
        z.object({
          description: z.string(),
          madeBy: z.array(z.string().uuid()),
          consequences: z.string().optional(),
        }),
      )
      .default([]),

    // Dice rolls (all of them)
    diceLog: z
      .array(
        z.object({
          characterId: z.string().uuid().optional(),
          characterName: z.string().optional(),
          rollType: z.string(), // "attack", "save", "skill", "damage"
          diceExpression: z.string(), // "1d20+5"
          naturalRoll: z.number().int(),
          modifiers: z.number().int(),
          total: z.number().int(),
          gmModified: z.boolean().default(false),
          finalResult: z.number().int(),
          timestamp: z.date(),
          context: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // Session settings
  settings: z.object({
    // Dice
    digitalDice: z.boolean().default(true),
    allowPhysicalDice: z.boolean().default(true),
    showDiceToPlayers: z.boolean().default(true),

    // Display
    showInitiativeOrder: z.boolean().default(true),
    showEnemyHP: z
      .enum(["hidden", "descriptive", "percentage", "exact"])
      .default("descriptive"),

    // Automation
    autoTrackConditions: z.boolean().default(true),
    autoCalculateDamage: z.boolean().default(true),
    autoDeathSaves: z.boolean().default(true),

    // Player features
    playersCanAddNotes: z.boolean().default(true),
    playersCanSeeOthersNotes: z.boolean().default(false),

    // Breaks
    breakReminder: z.number().int().optional(), // Minutes
  }),

  // Auto-summary (generated when session ends)
  autoSummary: z
    .object({
      generated: z.boolean().default(false),
      summary: z.string().optional(),
      keyEvents: z.array(z.string()).optional(),
      cliffhanger: z.string().optional(),
      generatedAt: z.date().optional(),
    })
    .optional(),

  // Post-session settings
  postSession: z
    .object({
      downtimeDays: z.number().int().default(7),
      downtimeEnabled: z.boolean().default(true),
      diaryDeadline: z.date().optional(),
      nextSessionDate: z.date().optional(),
    })
    .optional(),
});
export type LiveSession = z.infer<typeof LiveSessionSchema>;

// ============================================
// DICE ROLL (with GM fudging support)
// ============================================

export const DiceRollRequestSchema = z.object({
  sessionId: z.string().uuid(),

  // Who's rolling
  characterId: z.string().uuid().optional(),
  characterName: z.string().optional(),
  isGmRoll: z.boolean().default(false),

  // What they're rolling
  rollType: z.enum([
    "attack",
    "damage",
    "save",
    "skill",
    "ability",
    "initiative",
    "death_save",
    "hit_dice",
    "custom",
  ]),

  diceExpression: z.string(), // "1d20+5", "2d6+3", etc.

  // Context
  reason: z.string().optional(),
  targetDC: z.number().int().optional(),
  targetAC: z.number().int().optional(),

  // Modifiers
  advantage: z.boolean().default(false),
  disadvantage: z.boolean().default(false),

  // Physical dice input
  isPhysicalRoll: z.boolean().default(false),
  physicalResult: z.number().int().optional(),

  // Visibility
  isSecretRoll: z.boolean().default(false),
});
export type DiceRollRequest = z.infer<typeof DiceRollRequestSchema>;

export const DiceRollResultSchema = z.object({
  id: z.string().uuid(),
  request: DiceRollRequestSchema,

  // The actual roll
  rolls: z.array(
    z.object({
      diceType: z.string(), // "d20", "d6"
      result: z.number().int(),
      kept: z.boolean().default(true), // For advantage/disadvantage
    }),
  ),

  // Calculations
  naturalTotal: z.number().int(),
  modifiers: z.number().int(),
  calculatedTotal: z.number().int(),

  // GM fudging
  gmModified: z.boolean().default(false),
  gmModification: z.number().int().optional(),
  finalTotal: z.number().int(),

  // Outcome
  outcome: z
    .object({
      success: z.boolean().optional(),
      criticalSuccess: z.boolean().default(false),
      criticalFailure: z.boolean().default(false),
      margin: z.number().int().optional(), // By how much
    })
    .optional(),

  timestamp: z.date(),
});
export type DiceRollResult = z.infer<typeof DiceRollResultSchema>;

// ============================================
// PLAYER DEVICE VIEW
// ============================================

export const PlayerViewSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  characterId: z.string().uuid(),

  // What they see
  currentCard: z
    .object({
      id: z.string().uuid(),
      type: CardTypeSchema,
      title: z.string(),

      // Visible content layers
      visibleContent: z
        .array(
          z.object({
            id: z.string().uuid(),
            content: z.string(),
            contentType: z.string(),
          }),
        )
        .default([]),

      // Can they add notes?
      canAddNotes: z.boolean().default(true),

      // Their notes on this card
      myNotes: z.string().optional(),
    })
    .optional(),

  // Their character quick reference
  characterQuickRef: z.object({
    name: z.string(),
    hp: z.object({
      current: z.number().int(),
      max: z.number().int(),
      temp: z.number().int().default(0),
    }),
    ac: z.number().int(),
    conditions: z.array(z.string()).default([]),
    resources: z
      .record(
        z.string(),
        z.object({
          current: z.number().int(),
          max: z.number().int(),
        }),
      )
      .optional(), // Spell slots, Ki, etc.
  }),

  // Combat view (if in combat)
  combatView: z
    .object({
      isInCombat: z.boolean(),
      isMyTurn: z.boolean().default(false),

      // What they see
      initiativeOrder: z
        .array(
          z.object({
            name: z.string(),
            isMe: z.boolean(),
            isAlly: z.boolean(),
            isCurrentTurn: z.boolean(),
            // Enemies might have hidden initiative
          }),
        )
        .optional(),

      // Map position
      myPosition: z
        .object({
          q: z.number().int(),
          r: z.number().int(),
        })
        .optional(),

      // Available actions
      actions: z
        .object({
          action: z.boolean().default(true),
          bonusAction: z.boolean().default(true),
          reaction: z.boolean().default(true),
          movement: z.number().int(), // Feet remaining
        })
        .optional(),
    })
    .optional(),

  // Secret information (only they see)
  secretInfo: z
    .array(
      z.object({
        source: z.string(),
        content: z.string(),
      }),
    )
    .default([]),

  // Downtime outcomes (private)
  downtimeOutcomes: z
    .array(
      z.object({
        actionName: z.string(),
        result: z.string(),
        isSecret: z.boolean(),
      }),
    )
    .default([]),

  // Session accumulation (what they've gained)
  sessionGains: z.object({
    lootClaimed: z.array(z.string()).default([]),
    goldShare: z.number().default(0),
    xpEarned: z.number().int().default(0),
  }),

  // Pending rolls
  pendingRolls: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
});
export type PlayerView = z.infer<typeof PlayerViewSchema>;

// ============================================
// GM CONTROL PANEL
// ============================================

export const GmControlPanelSchema = z.object({
  sessionId: z.string().uuid(),

  // Card management
  cardQueue: z.array(
    z.object({
      cardId: z.string().uuid(),
      title: z.string(),
      type: CardTypeSchema,
      status: z.string(),
      hasSecrets: z.boolean(),
      hasCombat: z.boolean(),
    }),
  ),
  currentCardIndex: z.number().int(),

  // Quick actions
  quickActions: z.object({
    revealSecretAction: z.boolean().default(false), // Reveal secret downtime outcomes
    startCombat: z.boolean().default(false),
    endCombat: z.boolean().default(false),
    nextCard: z.boolean().default(false),
    previousCard: z.boolean().default(false),
  }),

  // NPC quick access
  activeNpcs: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      quickStats: z.string(),
      hasFullStats: z.boolean(),
    }),
  ),

  // Dice control
  pendingRolls: z.array(
    z.object({
      id: z.string().uuid(),
      characterName: z.string(),
      rollType: z.string(),
      awaitingResult: z.boolean(),
    }),
  ),

  // Override panel
  overrides: z.object({
    // Fudge last roll
    lastRollId: z.string().uuid().optional(),
    canFudge: z.boolean().default(true),

    // Manual HP adjustment
    hpAdjustments: z
      .array(
        z.object({
          entityId: z.string().uuid(),
          name: z.string(),
          currentHp: z.number().int(),
          newHp: z.number().int().optional(),
        }),
      )
      .optional(),
  }),

  // Quick generators
  generators: z.object({
    npcAvailable: z.boolean().default(true),
    lootAvailable: z.boolean().default(true),
    encounterAvailable: z.boolean().default(true),
    locationAvailable: z.boolean().default(true),
    rumorAvailable: z.boolean().default(true),
  }),

  // Session stats (live)
  liveStats: z.object({
    duration: z.number().int(), // Minutes since start
    cardsCompleted: z.number().int(),
    combatsRun: z.number().int(),
    playersConnected: z.number().int(),
    totalPlayers: z.number().int(),
  }),
});
export type GmControlPanel = z.infer<typeof GmControlPanelSchema>;

// ============================================
// SESSION BUILDER (Pre-session)
// ============================================

export const SessionBuilderSchema = z.object({
  sessionId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Session metadata
  sessionNumber: z.number().int(),
  title: z.string(),
  synopsis: z.string().optional(),

  // Card building
  cards: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: CardTypeSchema,
        title: z.string(),
        prepared: z.boolean().default(false),

        // Prep checklist
        checklist: z
          .array(
            z.object({
              item: z.string(),
              done: z.boolean().default(false),
            }),
          )
          .optional(),

        // Dependencies
        requiresPreviousCard: z.boolean().default(false),
        isOptional: z.boolean().default(false),
        isBranching: z.boolean().default(false), // Multiple paths from here

        // Estimates
        estimatedMinutes: z.number().int().optional(),
      }),
    )
    .default([]),

  // Prepared content
  preparedNpcs: z.array(z.string().uuid()).default([]),
  preparedLocations: z.array(z.string().uuid()).default([]),
  preparedEncounters: z.array(z.string().uuid()).default([]),

  // Downtime outcomes to reveal
  downtimeOutcomes: z
    .array(
      z.object({
        actionId: z.string().uuid(),
        characterName: z.string(),
        summary: z.string(),
        isSecret: z.boolean(),
      }),
    )
    .default([]),

  // Prep notes
  gmNotes: z.string().optional(),
  playerHooks: z
    .array(
      z.object({
        characterId: z.string().uuid(),
        characterName: z.string(),
        hook: z.string(),
        cardId: z.string().uuid().optional(),
      }),
    )
    .default([]),

  // Last session recap
  lastSessionRecap: z.string().optional(),

  // Goals for this session
  sessionGoals: z.array(z.string()).default([]),

  // Readiness
  readinessChecklist: z
    .array(
      z.object({
        item: z.string(),
        done: z.boolean(),
        required: z.boolean().default(false),
      }),
    )
    .default([]),

  isReady: z.boolean().default(false),
});
export type SessionBuilder = z.infer<typeof SessionBuilderSchema>;

// ============================================
// SESSION END / SUMMARY
// ============================================

export const SessionEndSchema = z.object({
  sessionId: z.string().uuid(),

  // How it ended
  endType: z.enum([
    "natural", // Reached good stopping point
    "time_limit", // Out of time
    "cliffhanger", // Dramatic moment
    "emergency", // Had to stop suddenly
  ]),

  // Auto-generated summary
  autoSummary: z.object({
    // What happened (AI-generated)
    events: z.array(z.string()),

    // Key moments
    highlights: z.array(
      z.object({
        description: z.string(),
        characters: z.array(z.string()),
      }),
    ),

    // Cliffhanger for next time
    cliffhanger: z.string().optional(),

    // Questions raised
    openQuestions: z.array(z.string()),

    // For recap next session
    recapPoints: z.array(z.string()),
  }),

  // Loot distribution
  lootDistribution: z.object({
    distributed: z.boolean().default(false),
    method: z
      .enum([
        "equal_split",
        "need_based",
        "auction",
        "manual",
        "party_inventory",
      ])
      .optional(),

    // Per-character
    characterShares: z
      .array(
        z.object({
          characterId: z.string().uuid(),
          characterName: z.string(),
          items: z.array(z.string()),
          gold: z.number(),
        }),
      )
      .optional(),

    // Party inventory
    partyInventoryItems: z.array(z.string()).optional(),
    partyGold: z.number().optional(),
  }),

  // XP distribution
  xpDistribution: z
    .object({
      totalXp: z.number().int(),
      perCharacter: z.number().int(),
      levelUps: z
        .array(
          z.object({
            characterId: z.string().uuid(),
            characterName: z.string(),
            newLevel: z.number().int(),
          }),
        )
        .optional(),
    })
    .optional(),

  // Downtime setup
  downtimeSetup: z.object({
    enabled: z.boolean().default(true),
    days: z.number().int().default(7),
    actionsPerDay: z.number().int().default(3),
    deadline: z.date().optional(),

    // Restrictions (if any)
    restrictions: z
      .array(
        z.object({
          characterId: z.string().uuid(),
          reason: z.string(),
          actionLimit: z.number().int().optional(),
          disabledCategories: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  }),

  // Diary deadline
  diaryDeadline: z.date().optional(),
  diaryBonusActive: z.boolean().default(true),

  // Next session
  nextSession: z
    .object({
      scheduled: z.boolean().default(false),
      date: z.date().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});
export type SessionEnd = z.infer<typeof SessionEndSchema>;

// ============================================
// PARTY INVENTORY (Nothing gets lost)
// ============================================

export const PartyInventorySchema = z.object({
  campaignId: z.string().uuid(),

  // Shared gold
  gold: z.object({
    cp: z.number().int().default(0),
    sp: z.number().int().default(0),
    ep: z.number().int().default(0),
    gp: z.number().int().default(0),
    pp: z.number().int().default(0),
  }),

  // Shared items
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
        quantity: z.number().int().default(1),

        // Value
        value: z.number().optional(),
        valueUnit: z.string().default("gp"),

        // Properties
        magical: z.boolean().default(false),
        identified: z.boolean().default(true),

        // Tracking
        foundInSession: z.number().int(),
        foundDate: z.date(),
        addedBy: z.string().optional(), // Who found it

        // Notes
        notes: z.string().optional(),
      }),
    )
    .default([]),

  // Vehicles, properties, etc.
  assets: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        type: z.enum([
          "vehicle",
          "property",
          "business",
          "ship",
          "mount",
          "other",
        ]),
        description: z.string(),
        value: z.number().optional(),
        location: z.string().optional(),
      }),
    )
    .default([]),

  // Transaction log (every gold piece tracked)
  transactionLog: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.enum([
          "found",
          "earned",
          "spent",
          "given",
          "received",
          "lost",
          "distributed",
        ]),
        amount: z.number(),
        unit: z.string().default("gp"),
        description: z.string(),
        sessionNumber: z.number().int(),
        timestamp: z.date(),
        characterId: z.string().uuid().optional(),
      }),
    )
    .default([]),

  // Quest items (important things)
  questItems: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
        questId: z.string().uuid().optional(),
        questName: z.string().optional(),
        importance: z.enum(["clue", "required", "optional", "macguffin"]),
        heldBy: z.string().uuid().optional(),
        heldByName: z.string().optional(),
      }),
    )
    .default([]),

  // Last updated
  lastUpdated: z.date(),
  lastUpdatedBy: z.string().uuid().optional(),
});
export type PartyInventory = z.infer<typeof PartyInventorySchema>;
