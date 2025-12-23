import { z } from "zod";

// ============================================
// MIDDLEWARE LAYER - AGGREGATES
// ============================================
//
// Philosophy: SEMANTIC COMPRESSION
//
// 20k lines of schemas is overwhelming.
// Frontend needs ~50 usable things.
// Database needs clean storage patterns.
//
// Aggregates are the VIEWS:
//   - CharacterSheet: Everything about a character
//   - SessionState: Everything for live play
//   - WorldSnapshot: Everything about the world
//   - GMDashboard: Everything GM needs
//
// This is what gets sent over the wire.
// This is what gets cached.
// This is what the UI renders.
//

// ============================================
// CHARACTER SHEET AGGREGATE
// ============================================
//
// Everything needed to display/use a character.
// Pulls from: creature, items, spells, conditions,
// followers, downtime, relationships, memories
//

export const CharacterSheetAggregateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(), // For optimistic updates
  lastModified: z.date(),

  // === CORE IDENTITY ===
  identity: z.object({
    name: z.string(),
    player: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
      })
      .optional(),
    race: z.string(),
    class: z.string(),
    subclass: z.string().optional(),
    level: z.number().int(),
    background: z.string(),
    alignment: z.string().optional(),

    // Visuals
    portraitUrl: z.string().optional(),
    tokenUrl: z.string().optional(),
  }),

  // === COMBAT STATS ===
  combat: z.object({
    // Health
    hp: z.object({
      current: z.number().int(),
      max: z.number().int(),
      temp: z.number().int().default(0),
    }),
    hitDice: z.object({
      current: z.number().int(),
      max: z.number().int(),
      dieType: z.string(), // "d10"
    }),
    deathSaves: z
      .object({
        successes: z.number().int().default(0),
        failures: z.number().int().default(0),
      })
      .optional(),

    // Defense
    ac: z.number().int(),
    acSources: z
      .array(
        z.object({
          source: z.string(),
          value: z.number().int(),
        }),
      )
      .optional(),

    // Movement
    speed: z.object({
      walk: z.number().int(),
      fly: z.number().int().optional(),
      swim: z.number().int().optional(),
      climb: z.number().int().optional(),
      burrow: z.number().int().optional(),
    }),

    // Initiative
    initiativeBonus: z.number().int(),

    // Conditions
    conditions: z
      .array(
        z.object({
          name: z.string(),
          duration: z.string().optional(),
          source: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // === ABILITY SCORES ===
  abilities: z.object({
    str: z.object({
      score: z.number().int(),
      modifier: z.number().int(),
      save: z.number().int(),
      proficient: z.boolean(),
    }),
    dex: z.object({
      score: z.number().int(),
      modifier: z.number().int(),
      save: z.number().int(),
      proficient: z.boolean(),
    }),
    con: z.object({
      score: z.number().int(),
      modifier: z.number().int(),
      save: z.number().int(),
      proficient: z.boolean(),
    }),
    int: z.object({
      score: z.number().int(),
      modifier: z.number().int(),
      save: z.number().int(),
      proficient: z.boolean(),
    }),
    wis: z.object({
      score: z.number().int(),
      modifier: z.number().int(),
      save: z.number().int(),
      proficient: z.boolean(),
    }),
    cha: z.object({
      score: z.number().int(),
      modifier: z.number().int(),
      save: z.number().int(),
      proficient: z.boolean(),
    }),
  }),

  // === SKILLS ===
  skills: z.array(
    z.object({
      name: z.string(),
      ability: z.string(),
      bonus: z.number().int(),
      proficiency: z.enum(["none", "proficient", "expertise"]),
    }),
  ),

  // === ACTIONS (Combat) ===
  actions: z.object({
    // Attacks
    attacks: z
      .array(
        z.object({
          name: z.string(),
          attackBonus: z.number().int(),
          damage: z.string(),
          damageType: z.string(),
          range: z.string(),
          properties: z.array(z.string()).default([]),
        }),
      )
      .default([]),

    // Class features
    features: z
      .array(
        z.object({
          name: z.string(),
          uses: z
            .object({
              current: z.number().int(),
              max: z.number().int(),
              recharge: z.string(), // "short rest", "long rest", "dawn"
            })
            .optional(),
          description: z.string(),
        }),
      )
      .default([]),

    // Bonus actions / reactions
    bonusActions: z.array(z.string()).default([]),
    reactions: z.array(z.string()).default([]),
  }),

  // === SPELLCASTING ===
  spellcasting: z
    .object({
      enabled: z.boolean().default(false),
      ability: z.string().optional(),
      saveDC: z.number().int().optional(),
      attackBonus: z.number().int().optional(),

      slots: z
        .array(
          z.object({
            level: z.number().int(),
            current: z.number().int(),
            max: z.number().int(),
          }),
        )
        .optional(),

      spellsKnown: z
        .array(
          z.object({
            name: z.string(),
            level: z.number().int(),
            school: z.string(),
            prepared: z.boolean().default(false),
            ritual: z.boolean().default(false),
            concentration: z.boolean().default(false),
          }),
        )
        .optional(),
    })
    .optional(),

  // === INVENTORY (Summarized) ===
  inventory: z.object({
    // Currency
    currency: z.object({
      cp: z.number().int().default(0),
      sp: z.number().int().default(0),
      ep: z.number().int().default(0),
      gp: z.number().int().default(0),
      pp: z.number().int().default(0),
      totalGp: z.number(),
    }),

    // Equipped items (quick reference)
    equipped: z.object({
      armor: z.string().optional(),
      shield: z.string().optional(),
      mainHand: z.string().optional(),
      offHand: z.string().optional(),
      other: z.array(z.string()).default([]),
    }),

    // Attuned items
    attunedItems: z
      .array(
        z.object({
          name: z.string(),
          rarity: z.string(),
        }),
      )
      .default([]),
    attunementSlots: z.object({
      used: z.number().int(),
      max: z.number().int().default(3),
    }),

    // Carrying
    carrying: z.object({
      current: z.number(),
      max: z.number(),
      encumbered: z.boolean().default(false),
    }),

    // Counts only (full inventory via separate query)
    itemCounts: z.object({
      weapons: z.number().int(),
      armor: z.number().int(),
      consumables: z.number().int(),
      gear: z.number().int(),
      treasures: z.number().int(),
      magicItems: z.number().int(),
    }),
  }),

  // === FOLLOWERS (Summarized) ===
  followers: z
    .object({
      count: z.number().int(),
      upkeepPerWeek: z.number(),
      available: z.number().int(),
      onMission: z.number().int(),
      slots: z.object({
        used: z.number().int(),
        max: z.number().int(),
      }),
    })
    .optional(),

  // === PARTY MEMBERSHIP ===
  party: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      role: z.string(),
      sharedGoldAccess: z.boolean(),
    })
    .optional(),

  // === DOWNTIME STATUS ===
  downtime: z
    .object({
      actionsRemaining: z.number().int(),
      currentActivity: z.string().optional(),
      pendingResults: z.number().int(),
    })
    .optional(),

  // === RELATIONSHIPS (Top 5) ===
  relationships: z
    .array(
      z.object({
        entityId: z.string(),
        name: z.string(),
        type: z.string(),
        attitude: z.number().int(), // -100 to 100
      }),
    )
    .default([]),

  // === NOTES ===
  notes: z
    .object({
      backstory: z.string().optional(),
      personality: z.string().optional(),
      goals: z.string().optional(),
      playerNotes: z.string().optional(),
    })
    .optional(),
});
export type CharacterSheetAggregate = z.infer<
  typeof CharacterSheetAggregateSchema
>;

// ============================================
// SESSION STATE AGGREGATE
// ============================================
//
// Everything needed for live play.
// Real-time updated during session.
//

export const SessionStateAggregateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  lastModified: z.date(),

  // === SESSION INFO ===
  session: z.object({
    number: z.number().int(),
    title: z.string().optional(),
    date: z.date(),
    status: z.enum(["preparing", "active", "paused", "ended"]),
    worldDate: z.string(),
    timeOfDay: z.string(),
  }),

  // === CURRENT SCENE ===
  scene: z.object({
    id: z.string().uuid(),
    type: z.enum([
      "exploration",
      "social",
      "combat",
      "puzzle",
      "travel",
      "downtime",
    ]),
    location: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
    }),
    mood: z.string(),
    lighting: z.string().optional(),
    music: z.string().optional(),

    // Who's here
    presentNPCs: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          attitude: z.string(),
          agentActive: z.boolean().default(false),
        }),
      )
      .default([]),
  }),

  // === PARTY STATE (Quick reference) ===
  party: z.object({
    id: z.string().uuid(),
    name: z.string(),

    members: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        class: z.string(),
        level: z.number().int(),
        hp: z.object({
          current: z.number().int(),
          max: z.number().int(),
        }),
        ac: z.number().int(),
        conditions: z.array(z.string()).default([]),
        playerOnline: z.boolean().default(false),
      }),
    ),

    marchingOrder: z.array(z.string()).optional(),
    sharedGold: z.number(),
  }),

  // === COMBAT (If active) ===
  combat: z.object({
    active: z.boolean().default(false),
    round: z.number().int().optional(),

    currentTurn: z
      .object({
        entityId: z.string(),
        entityName: z.string(),
        isPlayer: z.boolean(),
        actionsRemaining: z.number().int(),
        bonusActionUsed: z.boolean(),
        reactionUsed: z.boolean(),
        movementRemaining: z.number().int(),
      })
      .optional(),

    initiativeOrder: z
      .array(
        z.object({
          entityId: z.string(),
          name: z.string(),
          initiative: z.number().int(),
          isPlayer: z.boolean(),
          hp: z
            .object({ current: z.number().int(), max: z.number().int() })
            .optional(),
          conditions: z.array(z.string()).default([]),
        }),
      )
      .optional(),

    // Grid state (if using grid)
    grid: z
      .object({
        enabled: z.boolean().default(false),
        mapUrl: z.string().optional(),
        tokens: z
          .array(
            z.object({
              entityId: z.string(),
              position: z.object({ x: z.number().int(), y: z.number().int() }),
              size: z.number().int().default(1),
            }),
          )
          .optional(),
      })
      .optional(),
  }),

  // === ACTIVE QUESTS (Quick reference) ===
  activeQuests: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        status: z.string(),
        currentObjective: z.string().optional(),
        progress: z.number().int().min(0).max(100),
      }),
    )
    .default([]),

  // === RECENT EVENTS ===
  recentEvents: z
    .array(
      z.object({
        timestamp: z.date(),
        type: z.string(),
        description: z.string(),
        importance: z.enum(["minor", "normal", "major"]),
      }),
    )
    .default([]),

  // === LOOT PENDING ===
  pendingLoot: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        claimedBy: z.string().optional(),
      }),
    )
    .default([]),

  // === GM NOTES (GM only) ===
  gmNotes: z
    .object({
      sceneNotes: z.string().optional(),
      secretsRevealed: z.array(z.string()).default([]),
      secretsPending: z.array(z.string()).default([]),
      nextBeats: z.array(z.string()).default([]),
    })
    .optional(),
});
export type SessionStateAggregate = z.infer<typeof SessionStateAggregateSchema>;

// ============================================
// WORLD SNAPSHOT AGGREGATE
// ============================================
//
// Current state of the world.
// For GM dashboard and world simulation.
//

export const WorldSnapshotAggregateSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  version: z.number().int(),
  lastModified: z.date(),

  // === TIME & CALENDAR ===
  time: z.object({
    currentDate: z.string(),
    dayOfWeek: z.string(),
    season: z.string(),
    timeOfDay: z.string(),
    moonPhase: z.string().optional(),

    // Elapsed since campaign start
    daysSinceStart: z.number().int(),
    sessionCount: z.number().int(),
  }),

  // === WEATHER ===
  weather: z
    .object({
      current: z.string(),
      temperature: z.string(),
      forecast: z
        .array(
          z.object({
            day: z.string(),
            weather: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),

  // === SETTLEMENTS (Summary) ===
  settlements: z.object({
    total: z.number().int(),

    // Top 10 by importance
    major: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          type: z.string(),
          population: z.number().int(),
          prosperity: z.number().int(),
          stability: z.number().int(),
          issues: z.array(z.string()).default([]),
          partyLocation: z.boolean().default(false),
        }),
      )
      .default([]),

    // Aggregated issues
    settlementsWithIssues: z.number().int(),
    criticalIssues: z
      .array(
        z.object({
          settlementName: z.string(),
          issue: z.string(),
          severity: z.string(),
        }),
      )
      .default([]),
  }),

  // === FACTIONS (Summary) ===
  factions: z.object({
    total: z.number().int(),

    // Major factions with party relationship
    major: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          type: z.string(),
          power: z.number().int(),
          partyRelation: z.number().int(), // -100 to 100
          activeSchemes: z.number().int(),
        }),
      )
      .default([]),

    // Faction tensions
    tensions: z
      .array(
        z.object({
          faction1: z.string(),
          faction2: z.string(),
          level: z.string(),
        }),
      )
      .default([]),
  }),

  // === ECONOMY (Summary) ===
  economy: z.object({
    lastSimulated: z.date(),

    globalIndicators: z.object({
      prosperity: z.number().int(),
      stability: z.number().int(),
      tradeVolume: z.number(),
      inflation: z.number(),
    }),

    // Active events
    activeEvents: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          type: z.string(),
          affectedSettlements: z.array(z.string()),
          severity: z.string(),
        }),
      )
      .default([]),

    // Price anomalies
    priceAnomalies: z
      .array(
        z.object({
          settlement: z.string(),
          commodity: z.string(),
          priceMultiplier: z.number(),
          reason: z.string(),
        }),
      )
      .default([]),

    // Trade route status
    disruptedRoutes: z.number().int(),
  }),

  // === NARRATIVE STATE ===
  narrative: z.object({
    currentArc: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        progress: z.number().int().min(0).max(100),
      })
      .optional(),

    activeQuests: z.number().int(),
    completedQuests: z.number().int(),
    openPlotThreads: z.number().int(),

    // Recent major events
    recentMajorEvents: z
      .array(
        z.object({
          date: z.string(),
          description: z.string(),
          impact: z.string(),
        }),
      )
      .default([]),
  }),

  // === PARTY IMPACT ===
  partyImpact: z.object({
    reputation: z.record(z.string(), z.number().int()), // Faction/settlement -> rep
    economicImpact: z.number(), // GP equivalent
    eventsTriggered: z.number().int(),
    settlementsVisited: z.number().int(),
    npcsEncountered: z.number().int(),
  }),

  // === PENDING SIMULATIONS ===
  pending: z.object({
    economySimDue: z.boolean(),
    factionTurnDue: z.boolean(),
    downtimeResolutionDue: z.boolean(),
    worldEventsDue: z.boolean(),
  }),
});
export type WorldSnapshotAggregate = z.infer<
  typeof WorldSnapshotAggregateSchema
>;

// ============================================
// NPC ENCOUNTER AGGREGATE
// ============================================
//
// Everything needed to run an NPC interaction.
// Includes AI agent context.
//

export const NPCEncounterAggregateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),

  // === NPC IDENTITY ===
  npc: z.object({
    id: z.string().uuid(),
    name: z.string(),
    title: z.string().optional(),
    race: z.string(),
    occupation: z.string(),

    appearance: z.string(),
    mannerisms: z.array(z.string()).default([]),
    currentState: z.string().optional(),

    // Quick stats (if needed for combat)
    stats: z
      .object({
        ac: z.number().int(),
        hp: z.object({ current: z.number().int(), max: z.number().int() }),
        cr: z.string().optional(),
      })
      .optional(),
  }),

  // === RELATIONSHIP WITH PARTY ===
  partyRelation: z.object({
    hasMetBefore: z.boolean(),
    attitude: z.number().int(), // -100 to 100
    disposition: z.string(), // "hostile", "unfriendly", "neutral", "friendly", "helpful"

    // What they remember about party
    memories: z
      .array(
        z.object({
          event: z.string(),
          impression: z.string(),
          date: z.string(),
        }),
      )
      .default([]),

    // Individual party member opinions
    memberOpinions: z
      .array(
        z.object({
          characterName: z.string(),
          opinion: z.string(),
          reason: z.string().optional(),
        }),
      )
      .default([]),
  }),

  // === CURRENT CONTEXT ===
  context: z.object({
    location: z.string(),
    activity: z.string(),
    mood: z.string(),
    availability: z.enum(["available", "busy", "unavailable", "hostile"]),

    // What they currently know/care about
    currentConcerns: z.array(z.string()).default([]),
    recentEvents: z.array(z.string()).default([]),
  }),

  // === WHAT THEY CAN OFFER ===
  services: z.object({
    trades: z.array(z.string()).default([]), // "blacksmith", "healing"
    information: z.array(z.string()).default([]), // Topics they can discuss
    quests: z.array(z.string()).default([]), // Quests they can give
    connections: z.array(z.string()).default([]), // People they can introduce
  }),

  // === SECRETS (GM Only) ===
  secrets: z
    .array(
      z.object({
        secret: z.string(),
        revealCondition: z.string(),
        revealed: z.boolean().default(false),
      }),
    )
    .optional(),

  // === AI AGENT CONFIG ===
  agentConfig: z.object({
    agentId: z.string().uuid().optional(),

    // Identity injection
    coreIdentity: z.string(),
    personality: z.array(z.string()),
    speechPatterns: z.object({
      vocabulary: z.string(),
      formality: z.string(),
      quirks: z.array(z.string()),
      commonPhrases: z.array(z.string()),
    }),

    // Knowledge boundaries
    knows: z.array(z.string()),
    doesNotKnow: z.array(z.string()),

    // Constraints
    canDo: z.array(z.string()),
    cannotDo: z.array(z.string()),
    mustDo: z.array(z.string()),

    // Example dialogue
    exampleDialogue: z
      .array(
        z.object({
          input: z.string(),
          response: z.string(),
        }),
      )
      .optional(),
  }),
});
export type NPCEncounterAggregate = z.infer<typeof NPCEncounterAggregateSchema>;

// ============================================
// COMBAT ENCOUNTER AGGREGATE
// ============================================
//
// Everything needed to run a combat.
//

export const CombatEncounterAggregateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),

  // === ENCOUNTER INFO ===
  encounter: z.object({
    name: z.string(),
    difficulty: z.string(),
    environment: z.string(),
    specialConditions: z.array(z.string()).default([]),
  }),

  // === COMBATANTS ===
  combatants: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.enum(["player", "ally", "enemy", "neutral"]),

      // Stats
      hp: z.object({
        current: z.number().int(),
        max: z.number().int(),
        temp: z.number().int().default(0),
      }),
      ac: z.number().int(),
      speed: z.number().int(),

      // Initiative
      initiative: z.number().int(),
      initiativeBonus: z.number().int(),

      // Conditions
      conditions: z
        .array(
          z.object({
            name: z.string(),
            duration: z.string().optional(),
            endCondition: z.string().optional(),
          }),
        )
        .default([]),

      // Position (if grid)
      position: z
        .object({
          x: z.number().int(),
          y: z.number().int(),
        })
        .optional(),

      // Actions available
      actions: z
        .array(
          z.object({
            name: z.string(),
            type: z.enum(["action", "bonus", "reaction", "legendary", "lair"]),
            attackBonus: z.number().int().optional(),
            damage: z.string().optional(),
            description: z.string(),
            usesRemaining: z.number().int().optional(),
          }),
        )
        .default([]),

      // Resources
      resources: z
        .array(
          z.object({
            name: z.string(),
            current: z.number().int(),
            max: z.number().int(),
          }),
        )
        .default([]),

      // For enemies: AI behavior
      aiHints: z
        .object({
          tacticalStyle: z.string().optional(),
          targetPriority: z.string().optional(),
          fleeThreshold: z.number().optional(),
          specialBehavior: z.string().optional(),
        })
        .optional(),
    }),
  ),

  // === TURN STATE ===
  turnState: z.object({
    round: z.number().int(),
    currentIndex: z.number().int(),
    currentCombatantId: z.string().uuid(),

    // Current turn resources
    actionsUsed: z.number().int().default(0),
    bonusActionUsed: z.boolean().default(false),
    reactionUsed: z.boolean().default(false),
    movementUsed: z.number().int().default(0),

    // Concentration tracking
    concentratingOn: z
      .array(
        z.object({
          combatantId: z.string().uuid(),
          spell: z.string(),
        }),
      )
      .default([]),
  }),

  // === GRID (If using) ===
  grid: z
    .object({
      type: z.enum(["hex", "square"]),
      width: z.number().int(),
      height: z.number().int(),
      cellSize: z.number().int(),

      // Terrain
      terrain: z
        .array(
          z.object({
            x: z.number().int(),
            y: z.number().int(),
            type: z.string(), // "difficult", "water", "pit", etc.
          }),
        )
        .default([]),

      // Effects
      effects: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            shape: z.object({
              type: z.string(),
              origin: z.object({ x: z.number().int(), y: z.number().int() }),
              size: z.number().int(),
            }),
            effect: z.string(),
            duration: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),

  // === LAIR (If in lair) ===
  lair: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      initiative: z.number().int(),
      actionsAvailable: z.array(z.string()),
      actionsUsedThisRound: z.array(z.string()).default([]),
    })
    .optional(),

  // === COMBAT LOG ===
  log: z
    .array(
      z.object({
        round: z.number().int(),
        turn: z.number().int(),
        actor: z.string(),
        action: z.string(),
        target: z.string().optional(),
        result: z.string(),
        damage: z.number().int().optional(),
        timestamp: z.date(),
      }),
    )
    .default([]),
});
export type CombatEncounterAggregate = z.infer<
  typeof CombatEncounterAggregateSchema
>;

// ============================================
// DOWNTIME AGGREGATE
// ============================================
//
// Everything for downtime management.
//

export const DowntimeAggregateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),

  // === PERIOD INFO ===
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
    daysTotal: z.number().int(),
    daysRemaining: z.number().int(),
    deadline: z.date(), // Real-world deadline
  }),

  // === CHARACTER DOWNTIME ===
  characters: z.array(
    z.object({
      characterId: z.string().uuid(),
      characterName: z.string(),
      playerId: z.string().uuid(),
      playerName: z.string(),

      // Actions
      actionsPerDay: z.number().int(),
      totalActionsAvailable: z.number().int(),
      actionsQueued: z.number().int(),
      actionsCompleted: z.number().int(),

      // Queued actions
      queue: z
        .array(
          z.object({
            id: z.string().uuid(),
            day: z.number().int(),
            slot: z.number().int(),
            activity: z.string(),
            status: z.enum(["queued", "processing", "completed", "failed"]),
            result: z.string().optional(),
          }),
        )
        .default([]),

      // Resources
      goldSpent: z.number(),
      goldEarned: z.number(),
    }),
  ),

  // === FOLLOWERS ON MISSIONS ===
  followerMissions: z
    .array(
      z.object({
        followerId: z.string().uuid(),
        followerName: z.string(),
        ownerId: z.string().uuid(),
        mission: z.string(),
        daysRemaining: z.number().int(),
        status: z.enum(["in_progress", "returning", "completed", "failed"]),
      }),
    )
    .default([]),

  // === WORLD EVENTS DURING PERIOD ===
  worldEvents: z
    .array(
      z.object({
        day: z.number().int(),
        event: z.string(),
        affectsCharacters: z.array(z.string()),
      }),
    )
    .default([]),

  // === FACTION ACTIVITY ===
  factionActivity: z
    .array(
      z.object({
        factionName: z.string(),
        activity: z.string(),
        visible: z.boolean(),
      }),
    )
    .default([]),

  // === PENDING RESOLUTIONS ===
  pendingResolutions: z.number().int(),
});
export type DowntimeAggregate = z.infer<typeof DowntimeAggregateSchema>;

// ============================================
// QUICK REFERENCE CARDS
// ============================================
//
// Minimal data for UI cards/lists.
//

export const CharacterCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  race: z.string(),
  class: z.string(),
  level: z.number().int(),
  hp: z.object({ current: z.number().int(), max: z.number().int() }),
  ac: z.number().int(),
  conditions: z.array(z.string()).default([]),
  portraitUrl: z.string().optional(),
  playerName: z.string().optional(),
  isOnline: z.boolean().default(false),
});
export type CharacterCard = z.infer<typeof CharacterCardSchema>;

export const NPCCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  title: z.string().optional(),
  location: z.string(),
  disposition: z.string(),
  portraitUrl: z.string().optional(),
  hasActiveAgent: z.boolean().default(false),
});
export type NPCCard = z.infer<typeof NPCCardSchema>;

export const SettlementCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  population: z.number().int(),
  prosperity: z.number().int(),
  stability: z.number().int(),
  hasIssues: z.boolean(),
  isPartyLocation: z.boolean().default(false),
});
export type SettlementCard = z.infer<typeof SettlementCardSchema>;

export const QuestCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  giver: z.string().optional(),
  status: z.string(),
  progress: z.number().int(),
  currentObjective: z.string().optional(),
  reward: z.string().optional(),
});
export type QuestCard = z.infer<typeof QuestCardSchema>;

export const FactionCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  power: z.number().int(),
  partyRelation: z.number().int(),
  activeSchemes: z.number().int(),
  iconUrl: z.string().optional(),
});
export type FactionCard = z.infer<typeof FactionCardSchema>;
