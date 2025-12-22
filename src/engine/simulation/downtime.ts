import { z } from "zod";

// ============================================
// THE DOWNTIME SYSTEM
// ============================================
//
// Philosophy:
//   Sessions are ADVENTURES (real-time, at the table)
//   Downtime is KINGDOM MANAGEMENT (async, between sessions)
//
// The Loop:
//   1. Session ends
//   2. Players queue downtime actions (3/day)
//   3. AI resolves actions with rolls & context
//   4. GM reviews & approves (quick workflow)
//   5. Players see outcomes
//   6. World changes before next session
//   7. Next session: consequences play out
//
// What this enables:
//   - Political intrigue (letters, alliances, schemes)
//   - Economic gameplay (investments, trade, taxes)
//   - City building (construction, upgrades)
//   - Follower management (training, missions, morale)
//   - Research & crafting (long-term projects)
//   - Faction dynamics (NPCs act too!)
//

// ============================================
// RESOURCE TYPES
// ============================================

export const ResourceTypeSchema = z.enum([
  // Tangible
  "gold", // Currency
  "materials", // Building/crafting resources
  "provisions", // Food, supplies
  "arms", // Weapons, armor
  "magic_items", // Magical resources

  // Intangible
  "influence", // Political capital
  "renown", // Fame/reputation
  "information", // Intelligence, secrets
  "favor", // Owed favors, goodwill

  // Time-based
  "action_points", // Daily actions (typically 3)
  "downtime_days", // Calendar time

  // Special
  "divine_favor", // For clerics/paladins
  "arcane_power", // For wizards
  "nature_bond", // For druids/rangers
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceSchema = z.object({
  type: ResourceTypeSchema,
  amount: z.number(),

  // Some resources have subtypes
  subtype: z.string().optional(), // "gold:dwarven_mint", "influence:waterdeep"

  // Tracking
  source: z.string().optional(), // Where it came from
  expiresAt: z.date().optional(), // Some resources expire
});
export type Resource = z.infer<typeof ResourceSchema>;

export const ResourcePoolSchema = z.object({
  ownerId: z.string().uuid(), // Character, party, or organization
  ownerType: z.enum(["character", "party", "organization", "settlement"]),

  resources: z.array(ResourceSchema),

  // Caps (optional)
  caps: z.record(ResourceTypeSchema, z.number()).optional(),

  // Income (per downtime day)
  income: z
    .array(
      z.object({
        type: ResourceTypeSchema,
        amount: z.number(),
        source: z.string(),
      }),
    )
    .default([]),

  // Expenses (per downtime day)
  expenses: z
    .array(
      z.object({
        type: ResourceTypeSchema,
        amount: z.number(),
        reason: z.string(),
      }),
    )
    .default([]),
});
export type ResourcePool = z.infer<typeof ResourcePoolSchema>;

// ============================================
// DOWNTIME ACTION CATEGORIES
// ============================================

export const ActionCategorySchema = z.enum([
  "political", // Diplomacy, intrigue, alliances
  "economic", // Trade, investment, business
  "military", // Training, recruitment, logistics
  "construction", // Building, fortifying, crafting
  "intelligence", // Spying, gathering info, counter-intel
  "personal", // Training, research, recovery
  "social", // Relationships, reputation, influence
  "magical", // Enchanting, rituals, research
  "organizational", // Managing followers, organizations
  "exploration", // Scouting, mapping, resource finding
]);
export type ActionCategory = z.infer<typeof ActionCategorySchema>;

// ============================================
// DOWNTIME ACTION DEFINITION
// ============================================

export const ActionDurationSchema = z.enum([
  "instant", // Resolved immediately
  "hours", // Takes part of a day
  "day", // Takes full day
  "days", // Multiple days
  "week", // Week-long project
  "month", // Month-long project
  "ongoing", // Continues until stopped
]);
export type ActionDuration = z.infer<typeof ActionDurationSchema>;

export const DowntimeActionTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: ActionCategorySchema,

  // Requirements
  requirements: z.object({
    // Resources needed
    costs: z
      .array(
        z.object({
          type: ResourceTypeSchema,
          amount: z.number(),
          consumed: z.boolean().default(true),
        }),
      )
      .default([]),

    // Prerequisites
    minLevel: z.number().int().optional(),
    requiredSkills: z.array(z.string()).optional(),
    requiredFeatures: z.array(z.string()).optional(),
    requiredBuildings: z.array(z.string()).optional(),
    requiredFollowers: z.number().int().optional(),

    // Context
    requiredLocation: z.string().optional(),
    requiresTarget: z.boolean().default(false),
  }),

  // Duration
  duration: ActionDurationSchema,
  durationValue: z.number().optional(), // e.g., 3 for "3 days"

  // Resolution
  resolution: z.object({
    // What skill/ability is checked
    checkType: z.enum(["skill", "ability", "flat", "automatic", "contested"]),
    checkValue: z.string().optional(), // "persuasion", "INT", etc.
    dc: z.number().int().optional(),

    // Modifiers
    modifiers: z
      .array(
        z.object({
          condition: z.string(),
          bonus: z.number().int(),
        }),
      )
      .default([]),
  }),

  // Outcomes
  outcomes: z.object({
    criticalSuccess: z
      .object({
        description: z.string(),
        rewards: z
          .array(
            z.object({
              type: ResourceTypeSchema,
              amount: z.number(),
            }),
          )
          .default([]),
        effects: z.array(z.string()).default([]),
      })
      .optional(),

    success: z.object({
      description: z.string(),
      rewards: z
        .array(
          z.object({
            type: ResourceTypeSchema,
            amount: z.number(),
          }),
        )
        .default([]),
      effects: z.array(z.string()).default([]),
    }),

    failure: z.object({
      description: z.string(),
      penalties: z
        .array(
          z.object({
            type: ResourceTypeSchema,
            amount: z.number(),
          }),
        )
        .default([]),
      effects: z.array(z.string()).default([]),
    }),

    criticalFailure: z
      .object({
        description: z.string(),
        penalties: z
          .array(
            z.object({
              type: ResourceTypeSchema,
              amount: z.number(),
            }),
          )
          .default([]),
        effects: z.array(z.string()).default([]),
      })
      .optional(),
  }),

  // For AI context
  narrativeHints: z.array(z.string()).default([]),

  // Tags
  tags: z.array(z.string()).default([]),
});
export type DowntimeActionTemplate = z.infer<
  typeof DowntimeActionTemplateSchema
>;

// ============================================
// QUEUED ACTION (player's actual action)
// ============================================

export const QueuedActionStatusSchema = z.enum([
  "queued", // Waiting to be resolved
  "in_progress", // Multi-day action, ongoing
  "pending_review", // AI resolved, waiting for GM
  "approved", // GM approved
  "modified", // GM modified outcome
  "rejected", // GM rejected (with reason)
  "completed", // Done, effects applied
  "cancelled", // Player cancelled
]);
export type QueuedActionStatus = z.infer<typeof QueuedActionStatusSchema>;

export const QueuedActionSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  characterId: z.string().uuid(),

  // What action
  templateId: z.string(),
  actionName: z.string(),
  category: ActionCategorySchema,

  // When
  queuedAt: z.date(),
  scheduledFor: z.date(), // Which downtime day
  dayNumber: z.number().int(), // Day 1, 2, 3, etc. of downtime period
  slotNumber: z.number().int().min(1).max(3), // Which of 3 daily slots

  // Target (if applicable)
  target: z
    .object({
      type: z.enum([
        "npc",
        "faction",
        "location",
        "character",
        "organization",
        "custom",
      ]),
      id: z.string().uuid().optional(),
      name: z.string(),
      context: z.string().optional(),
    })
    .optional(),

  // Player's intent/notes
  playerNotes: z.string().optional(),
  specificGoal: z.string().optional(),

  // Resources committed
  resourcesSpent: z.array(ResourceSchema).default([]),

  // Resolution
  status: QueuedActionStatusSchema.default("queued"),

  // AI resolution
  aiResolution: z
    .object({
      roll: z.number().int().optional(),
      modifiers: z
        .array(
          z.object({
            source: z.string(),
            value: z.number().int(),
          }),
        )
        .default([]),
      total: z.number().int().optional(),
      dc: z.number().int().optional(),
      outcomeLevel: z
        .enum(["critical_failure", "failure", "success", "critical_success"])
        .optional(),

      // Generated narrative
      narrativeResult: z.string().optional(),
      detailedOutcome: z.string().optional(),

      // Calculated rewards/penalties
      resourceChanges: z
        .array(
          z.object({
            type: ResourceTypeSchema,
            amount: z.number(),
            reason: z.string(),
          }),
        )
        .default([]),

      // Side effects
      sideEffects: z
        .array(
          z.object({
            type: z.string(),
            description: z.string(),
            entityAffected: z.string().optional(),
          }),
        )
        .default([]),

      // Follow-up opportunities
      followUpHooks: z.array(z.string()).default([]),

      resolvedAt: z.date().optional(),
    })
    .optional(),

  // GM review
  gmReview: z
    .object({
      reviewed: z.boolean().default(false),
      reviewedAt: z.date().optional(),
      decision: z.enum(["approve", "modify", "reject"]).optional(),

      // Modifications
      modifiedOutcome: z.string().optional(),
      modifiedRewards: z
        .array(
          z.object({
            type: ResourceTypeSchema,
            amount: z.number(),
          }),
        )
        .optional(),

      // GM notes
      gmNotes: z.string().optional(),
      narrativeAddition: z.string().optional(),

      // Rejection reason
      rejectionReason: z.string().optional(),
    })
    .optional(),

  // Final outcome (what player sees)
  finalOutcome: z
    .object({
      summary: z.string(),
      details: z.string().optional(),
      resourceChanges: z
        .array(
          z.object({
            type: ResourceTypeSchema,
            amount: z.number(),
            reason: z.string(),
          }),
        )
        .default([]),
      narrativeConsequences: z.array(z.string()).default([]),
      unlockedActions: z.array(z.string()).default([]),
    })
    .optional(),

  completedAt: z.date().optional(),
});
export type QueuedAction = z.infer<typeof QueuedActionSchema>;

// ============================================
// DOWNTIME PERIOD (between sessions)
// ============================================

export const DowntimePeriodSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Bookends
  afterSessionId: z.string().uuid(),
  beforeSessionId: z.string().uuid().optional(), // null if period is ongoing

  // Calendar
  startWorldDate: z.string(),
  endWorldDate: z.string().optional(),
  totalDays: z.number().int(),

  // Real-world timing
  periodStarted: z.date(),
  periodEnds: z.date().optional(), // When next session is
  queueingDeadline: z.date().optional(), // Last day to queue actions

  // Status
  status: z
    .enum([
      "queueing", // Players can queue actions
      "resolving", // AI is resolving
      "reviewing", // GM is reviewing
      "complete", // All done
    ])
    .default("queueing"),

  // Per-character action slots
  characterSlots: z
    .array(
      z.object({
        characterId: z.string().uuid(),
        characterName: z.string(),
        actionsPerDay: z.number().int().default(3),
        totalActions: z.number().int(), // days * actionsPerDay
        actionsQueued: z.number().int().default(0),
        actionsCompleted: z.number().int().default(0),
      }),
    )
    .default([]),

  // Summary (for quick view)
  summary: z
    .object({
      totalActionsQueued: z.number().int().default(0),
      totalActionsResolved: z.number().int().default(0),
      totalActionsApproved: z.number().int().default(0),
      majorEvents: z.array(z.string()).default([]),
    })
    .optional(),
});
export type DowntimePeriod = z.infer<typeof DowntimePeriodSchema>;

// ============================================
// STANDARD DOWNTIME ACTIONS
// ============================================

export const StandardDowntimeActions: DowntimeActionTemplate[] = [
  // ═══════════════════════════════════════
  // POLITICAL
  // ═══════════════════════════════════════
  {
    id: "write_letter",
    name: "Write Letter",
    description: "Compose and send a letter to an NPC or faction",
    category: "political",
    requirements: {
      costs: [{ type: "gold", amount: 5, consumed: true }],
      requiresTarget: true,
    },
    duration: "hours",
    resolution: {
      checkType: "skill",
      checkValue: "persuasion",
      modifiers: [
        { condition: "Previous positive relationship", bonus: 2 },
        { condition: "Sending gift with letter", bonus: 2 },
        { condition: "Bad reputation with target", bonus: -3 },
      ],
    },
    outcomes: {
      success: {
        description: "Your letter is well-received",
        rewards: [{ type: "influence", amount: 1 }],
        effects: ["Relationship improves", "May receive response"],
      },
      failure: {
        description: "Your letter is ignored or poorly received",
        penalties: [],
        effects: [
          "No response",
          "May damage relationship if tone was aggressive",
        ],
      },
    },
    narrativeHints: ["Consider what you're asking for", "Tone matters"],
    tags: ["communication", "diplomacy"],
  },

  {
    id: "political_maneuvering",
    name: "Political Maneuvering",
    description:
      "Navigate court politics, build alliances, or undermine rivals",
    category: "political",
    requirements: {
      costs: [
        { type: "gold", amount: 50, consumed: true },
        { type: "influence", amount: 1, consumed: true },
      ],
      requiredLocation: "settlement_with_politics",
    },
    duration: "day",
    resolution: {
      checkType: "skill",
      checkValue: "persuasion",
      dc: 15,
      modifiers: [
        { condition: "Noble background", bonus: 2 },
        { condition: "Have allies in court", bonus: 3 },
        { condition: "Recent scandal", bonus: -5 },
      ],
    },
    outcomes: {
      criticalSuccess: {
        description: "Masterful political play",
        rewards: [
          { type: "influence", amount: 3 },
          { type: "favor", amount: 1 },
        ],
        effects: ["Gain powerful ally", "Learn a secret"],
      },
      success: {
        description: "Successful politicking",
        rewards: [{ type: "influence", amount: 2 }],
        effects: ["Position improved", "New contact made"],
      },
      failure: {
        description: "Political misstep",
        penalties: [{ type: "influence", amount: 1 }],
        effects: ["Embarrassment", "Rival gains advantage"],
      },
      criticalFailure: {
        description: "Political disaster",
        penalties: [
          { type: "influence", amount: 3 },
          { type: "renown", amount: 1 },
        ],
        effects: ["Made enemy", "Scandal", "Possible exile"],
      },
    },
    narrativeHints: ["Who are you targeting?", "What's your angle?"],
    tags: ["intrigue", "court", "high-risk"],
  },

  // ═══════════════════════════════════════
  // ECONOMIC
  // ═══════════════════════════════════════
  {
    id: "run_business",
    name: "Run Business",
    description: "Manage your business for the day",
    category: "economic",
    requirements: {
      requiredBuildings: ["business"],
    },
    duration: "day",
    resolution: {
      checkType: "ability",
      checkValue: "INT",
      dc: 10,
    },
    outcomes: {
      success: {
        description: "Profitable day",
        rewards: [{ type: "gold", amount: 25 }], // Base, modified by business type
        effects: [],
      },
      failure: {
        description: "Slow day",
        rewards: [{ type: "gold", amount: 5 }],
        effects: [],
      },
    },
    tags: ["passive_income", "requires_business"],
  },

  {
    id: "trade_expedition",
    name: "Trade Expedition",
    description: "Send goods to another settlement for profit",
    category: "economic",
    requirements: {
      costs: [
        { type: "gold", amount: 100, consumed: true },
        { type: "provisions", amount: 10, consumed: true },
      ],
      requiredFollowers: 3,
    },
    duration: "days",
    durationValue: 7,
    resolution: {
      checkType: "skill",
      checkValue: "persuasion", // Or INT for route planning
      dc: 13,
      modifiers: [
        { condition: "Safe trade route", bonus: 3 },
        { condition: "Dangerous territory", bonus: -3 },
        { condition: "Trade agreement with destination", bonus: 2 },
      ],
    },
    outcomes: {
      criticalSuccess: {
        description: "Exceptional trade!",
        rewards: [{ type: "gold", amount: 300 }],
        effects: ["New trade contact", "Route secured"],
      },
      success: {
        description: "Profitable expedition",
        rewards: [{ type: "gold", amount: 175 }],
        effects: [],
      },
      failure: {
        description: "Expenses ate profits",
        rewards: [{ type: "gold", amount: 50 }],
        effects: ["Followers fatigued"],
      },
      criticalFailure: {
        description: "Disaster! Bandits or worse.",
        penalties: [{ type: "gold", amount: 100 }],
        effects: ["Followers injured or lost", "Goods stolen"],
      },
    },
    tags: ["trade", "risky", "multi-day"],
  },

  // ═══════════════════════════════════════
  // MILITARY
  // ═══════════════════════════════════════
  {
    id: "train_troops",
    name: "Train Troops",
    description: "Drill and train your soldiers",
    category: "military",
    requirements: {
      costs: [{ type: "gold", amount: 20, consumed: true }],
      requiredFollowers: 5,
    },
    duration: "day",
    resolution: {
      checkType: "skill",
      checkValue: "athletics", // Or CHA for inspiring
      dc: 12,
    },
    outcomes: {
      success: {
        description: "Good training day",
        rewards: [],
        effects: ["Troop quality +1", "Morale maintained"],
      },
      failure: {
        description: "Unproductive training",
        penalties: [],
        effects: ["No improvement", "Minor morale loss"],
      },
    },
    tags: ["military", "followers"],
  },

  {
    id: "recruit_soldiers",
    name: "Recruit Soldiers",
    description: "Hire new soldiers for your forces",
    category: "military",
    requirements: {
      costs: [
        { type: "gold", amount: 100, consumed: true },
        { type: "renown", amount: 1, consumed: false }, // Need reputation
      ],
      requiredLocation: "settlement",
    },
    duration: "day",
    resolution: {
      checkType: "skill",
      checkValue: "persuasion",
      dc: 12,
      modifiers: [
        { condition: "Good pay offered", bonus: 2 },
        { condition: "Wartime (people want to fight)", bonus: 3 },
        { condition: "Bad reputation", bonus: -4 },
      ],
    },
    outcomes: {
      criticalSuccess: {
        description: "Veterans answer the call!",
        rewards: [],
        effects: ["Recruit 5 quality soldiers", "One has special skill"],
      },
      success: {
        description: "Successful recruitment",
        rewards: [],
        effects: ["Recruit 3 soldiers"],
      },
      failure: {
        description: "Few takers",
        rewards: [],
        effects: ["Recruit 1 soldier"],
      },
    },
    tags: ["military", "recruitment"],
  },

  {
    id: "send_patrol",
    name: "Send Patrol",
    description: "Send troops to patrol an area",
    category: "military",
    requirements: {
      requiredFollowers: 5,
    },
    duration: "day",
    resolution: {
      checkType: "flat",
      dc: 0, // Automatic, but random events possible
    },
    outcomes: {
      success: {
        description: "Patrol complete",
        rewards: [{ type: "information", amount: 1 }],
        effects: ["Area secured", "May discover events"],
      },
      failure: {
        description: "Patrol encountered trouble",
        penalties: [],
        effects: ["Some soldiers injured", "Threat revealed"],
      },
    },
    tags: ["military", "scouting"],
  },

  // ═══════════════════════════════════════
  // CONSTRUCTION
  // ═══════════════════════════════════════
  {
    id: "construction_project",
    name: "Construction Project",
    description: "Work on building or upgrading a structure",
    category: "construction",
    requirements: {
      costs: [
        { type: "gold", amount: 50, consumed: true },
        { type: "materials", amount: 10, consumed: true },
      ],
    },
    duration: "day",
    resolution: {
      checkType: "ability",
      checkValue: "INT",
      dc: 10,
    },
    outcomes: {
      success: {
        description: "Good progress",
        rewards: [],
        effects: ["Project advances 1 day"],
      },
      failure: {
        description: "Setbacks",
        rewards: [],
        effects: ["No progress", "Materials may be wasted"],
      },
    },
    tags: ["building", "settlement"],
  },

  // ═══════════════════════════════════════
  // INTELLIGENCE
  // ═══════════════════════════════════════
  {
    id: "gather_information",
    name: "Gather Information",
    description: "Spend time collecting rumors and intel",
    category: "intelligence",
    requirements: {
      costs: [{ type: "gold", amount: 10, consumed: true }],
      requiredLocation: "settlement",
    },
    duration: "hours",
    resolution: {
      checkType: "skill",
      checkValue: "investigation",
      dc: 12,
    },
    outcomes: {
      criticalSuccess: {
        description: "Valuable intel!",
        rewards: [{ type: "information", amount: 2 }],
        effects: ["Learn a secret", "Discover opportunity"],
      },
      success: {
        description: "Useful information gathered",
        rewards: [{ type: "information", amount: 1 }],
        effects: ["Learn local rumors"],
      },
      failure: {
        description: "Nothing useful",
        rewards: [],
        effects: ["Time wasted"],
      },
    },
    tags: ["intel", "urban"],
  },

  {
    id: "spy_mission",
    name: "Spy Mission",
    description: "Send an agent to gather intel on a target",
    category: "intelligence",
    requirements: {
      costs: [{ type: "gold", amount: 75, consumed: true }],
      requiredFollowers: 1,
      requiresTarget: true,
    },
    duration: "days",
    durationValue: 3,
    resolution: {
      checkType: "contested",
      checkValue: "stealth",
    },
    outcomes: {
      criticalSuccess: {
        description: "Deep cover success!",
        rewards: [{ type: "information", amount: 3 }],
        effects: [
          "Learn secrets",
          "Agent remains undetected",
          "Ongoing access",
        ],
      },
      success: {
        description: "Mission successful",
        rewards: [{ type: "information", amount: 2 }],
        effects: ["Learn target's plans"],
      },
      failure: {
        description: "Mission failed",
        rewards: [],
        effects: ["Agent escapes", "Target alerted"],
      },
      criticalFailure: {
        description: "Agent caught!",
        penalties: [{ type: "influence", amount: 2 }],
        effects: [
          "Agent captured or killed",
          "Target hostile",
          "Evidence links to you",
        ],
      },
    },
    tags: ["espionage", "high-risk"],
  },

  // ═══════════════════════════════════════
  // PERSONAL
  // ═══════════════════════════════════════
  {
    id: "train_skill",
    name: "Train Skill",
    description: "Practice and improve a skill",
    category: "personal",
    requirements: {
      costs: [{ type: "gold", amount: 25, consumed: true }],
    },
    duration: "day",
    resolution: {
      checkType: "automatic",
    },
    outcomes: {
      success: {
        description: "Training progress",
        rewards: [],
        effects: ["Training points +1 toward skill proficiency"],
      },
      failure: {
        description: "Training progress",
        rewards: [],
        effects: ["Training points +1 toward skill proficiency"],
      },
    },
    tags: ["training", "advancement"],
  },

  {
    id: "research_lore",
    name: "Research Lore",
    description: "Study in a library or with a sage",
    category: "personal",
    requirements: {
      costs: [{ type: "gold", amount: 20, consumed: true }],
      requiredBuildings: ["library"],
    },
    duration: "day",
    resolution: {
      checkType: "skill",
      checkValue: "investigation",
      dc: 13,
    },
    outcomes: {
      criticalSuccess: {
        description: "Breakthrough!",
        rewards: [{ type: "information", amount: 2 }],
        effects: ["Learn significant lore", "New lead discovered"],
      },
      success: {
        description: "Productive research",
        rewards: [{ type: "information", amount: 1 }],
        effects: ["Learn useful information"],
      },
      failure: {
        description: "Dead ends",
        rewards: [],
        effects: ["Time spent, little learned"],
      },
    },
    tags: ["knowledge", "study"],
  },

  {
    id: "recuperate",
    name: "Recuperate",
    description: "Rest and recover from wounds or exhaustion",
    category: "personal",
    requirements: {},
    duration: "day",
    resolution: {
      checkType: "automatic",
    },
    outcomes: {
      success: {
        description: "Rest and recovery",
        rewards: [],
        effects: ["Heal additional HP", "Remove one level of exhaustion"],
      },
      failure: {
        description: "Rest and recovery",
        rewards: [],
        effects: ["Heal additional HP", "Remove one level of exhaustion"],
      },
    },
    tags: ["rest", "healing"],
  },

  // ═══════════════════════════════════════
  // SOCIAL
  // ═══════════════════════════════════════
  {
    id: "carousing",
    name: "Carousing",
    description: "Party, drink, and make friends",
    category: "social",
    requirements: {
      costs: [{ type: "gold", amount: 50, consumed: true }],
      requiredLocation: "settlement",
    },
    duration: "day",
    resolution: {
      checkType: "skill",
      checkValue: "persuasion",
      dc: 10,
    },
    outcomes: {
      criticalSuccess: {
        description: "Legendary night!",
        rewards: [
          { type: "renown", amount: 1 },
          { type: "favor", amount: 1 },
        ],
        effects: ["Make valuable contact", "Learn rumors"],
      },
      success: {
        description: "Fun night out",
        rewards: [{ type: "renown", amount: 1 }],
        effects: ["Make acquaintances"],
      },
      failure: {
        description: "Rough night",
        penalties: [],
        effects: ["Hangover", "May have made fool of self"],
      },
      criticalFailure: {
        description: "Disaster!",
        penalties: [
          { type: "gold", amount: 50 },
          { type: "renown", amount: 1 },
        ],
        effects: ["Got in fight", "Made enemy", "Legal trouble"],
      },
    },
    tags: ["social", "risky", "fun"],
  },

  {
    id: "build_relationship",
    name: "Build Relationship",
    description: "Spend quality time with an NPC to strengthen your bond",
    category: "social",
    requirements: {
      costs: [{ type: "gold", amount: 15, consumed: true }],
      requiresTarget: true,
    },
    duration: "hours",
    resolution: {
      checkType: "skill",
      checkValue: "persuasion",
      dc: 10,
      modifiers: [
        { condition: "Shared interests", bonus: 2 },
        { condition: "Cultural differences", bonus: -2 },
        { condition: "Previous positive interaction", bonus: 3 },
      ],
    },
    outcomes: {
      success: {
        description: "Relationship strengthened",
        rewards: [],
        effects: ["Relationship +1 level", "May learn personal information"],
      },
      failure: {
        description: "Awkward encounter",
        rewards: [],
        effects: ["No change", "Minor embarrassment"],
      },
    },
    tags: ["relationship", "npc"],
  },

  // ═══════════════════════════════════════
  // ORGANIZATIONAL
  // ═══════════════════════════════════════
  {
    id: "inspire_followers",
    name: "Inspire Followers",
    description: "Give a speech or demonstration to boost morale",
    category: "organizational",
    requirements: {
      requiredFollowers: 5,
    },
    duration: "hours",
    resolution: {
      checkType: "skill",
      checkValue: "persuasion",
      dc: 12,
    },
    outcomes: {
      criticalSuccess: {
        description: "Rousing inspiration!",
        rewards: [],
        effects: ["Morale +2", "Loyalty increased", "Productivity bonus"],
      },
      success: {
        description: "Followers inspired",
        rewards: [],
        effects: ["Morale +1"],
      },
      failure: {
        description: "Speech falls flat",
        rewards: [],
        effects: ["No effect"],
      },
    },
    tags: ["leadership", "morale"],
  },

  {
    id: "assign_mission",
    name: "Assign Mission",
    description: "Send followers on a specific task",
    category: "organizational",
    requirements: {
      requiredFollowers: 1,
      requiresTarget: true,
    },
    duration: "day",
    resolution: {
      checkType: "flat", // Follower's skills determine outcome
    },
    outcomes: {
      success: {
        description: "Mission completed",
        rewards: [],
        effects: ["Mission goal achieved"],
      },
      failure: {
        description: "Mission failed",
        rewards: [],
        effects: ["Goal not achieved", "Followers may be injured"],
      },
    },
    tags: ["delegation", "followers"],
  },
];

// ============================================
// GM REVIEW WORKFLOW
// ============================================

export const GmReviewQueueSchema = z.object({
  campaignId: z.string().uuid(),
  downtimePeriodId: z.string().uuid(),

  // Pending items
  pendingActions: z
    .array(
      z.object({
        actionId: z.string().uuid(),
        characterName: z.string(),
        actionName: z.string(),
        category: ActionCategorySchema,
        aiOutcome: z.string(),
        suggestedApproval: z.boolean(),
        flagged: z.boolean(), // AI thinks GM should look closely
        flagReason: z.string().optional(),
      }),
    )
    .default([]),

  // Stats
  totalPending: z.number().int().default(0),
  totalReviewed: z.number().int().default(0),

  // Quick actions
  bulkApprovable: z.array(z.string().uuid()).default([]), // Low-risk auto-approve
});
export type GmReviewQueue = z.infer<typeof GmReviewQueueSchema>;

// ============================================
// AI RESOLUTION PROMPT
// ============================================

export function buildActionResolutionPrompt(
  action: QueuedAction,
  template: DowntimeActionTemplate,
  context: {
    characterName: string;
    characterLevel: number;
    characterClass: string;
    relevantSkillBonus: number;
    resources: ResourcePool;
    recentHistory: string[];
    targetInfo?: string;
    locationInfo?: string;
    activeQuests?: string[];
    factionStandings?: Record<string, number>;
  },
): string {
  return `
# DOWNTIME ACTION RESOLUTION

## ACTION
${action.actionName} (${action.category})
Template: ${template.description}

## CHARACTER
${context.characterName}, Level ${context.characterLevel} ${context.characterClass}
Relevant skill bonus: +${context.relevantSkillBonus}

## TARGET
${
  action.target
    ? `
Target: ${action.target.name} (${action.target.type})
Context: ${action.target.context ?? "None provided"}
${context.targetInfo ?? ""}
`
    : "No specific target"
}

## PLAYER'S NOTES
${action.playerNotes ?? "None"}
Specific goal: ${action.specificGoal ?? "Not specified"}

## CONTEXT
Location: ${context.locationInfo ?? "Unknown"}
Recent events: ${context.recentHistory.join(", ")}
${context.activeQuests?.length ? `Active quests: ${context.activeQuests.join(", ")}` : ""}
${context.factionStandings ? `Faction standings: ${JSON.stringify(context.factionStandings)}` : ""}

## RESOLUTION RULES
Check type: ${template.resolution.checkType}
${template.resolution.checkValue ? `Using: ${template.resolution.checkValue}` : ""}
${template.resolution.dc ? `DC: ${template.resolution.dc}` : ""}

Modifiers to consider:
${template.resolution.modifiers.map((m) => `- ${m.condition}: ${m.bonus >= 0 ? "+" : ""}${m.bonus}`).join("\n")}

## OUTCOME TEMPLATES
Critical Success: ${template.outcomes.criticalSuccess?.description ?? "N/A"}
Success: ${template.outcomes.success.description}
Failure: ${template.outcomes.failure.description}
Critical Failure: ${template.outcomes.criticalFailure?.description ?? "N/A"}

## YOUR TASK

1. Determine which modifiers apply based on context
2. Roll the check (d20 + skill bonus + modifiers vs DC)
3. Determine outcome level
4. Write a brief narrative result (2-3 sentences)
5. List specific consequences:
   - Resource changes
   - Relationship changes
   - Information gained
   - Side effects
   - Follow-up opportunities

Keep the narrative grounded in the campaign context. Reference specific NPCs, locations, or events when relevant.

Flag for GM review if:
- Outcome significantly affects campaign plot
- Involves major NPC
- Could cause PC death or major loss
- Player's intent is unclear
`.trim();
}

// ============================================
// PLAYER ACTION QUEUE UI
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│  📅 DOWNTIME: Days 1-7 of Marpenoth                    [Submit Queue]      │
│  After Session 12 • Before Session 13 (Saturday)       3 days to deadline  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DAY 1 - Marpenoth 15                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ☀️ SLOT 1   │ 🌤️ SLOT 2   │ 🌙 SLOT 3                               │    │
│  │             │             │                                        │    │
│  │ ✉️ Write    │ 🏋️ Train    │ ❓ Empty                                │    │
│  │ Letter      │ Troops      │                                        │    │
│  │ → Duke      │             │ [Add Action]                           │    │
│  │ Maldwyn     │             │                                        │    │
│  │             │             │                                        │    │
│  │ [Edit]      │ [Edit]      │                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  DAY 2 - Marpenoth 16                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ☀️ SLOT 1   │ 🌤️ SLOT 2   │ 🌙 SLOT 3                               │    │
│  │             │             │                                        │    │
│  │ 🏗️ Build    │ 🍺 Carousing│ 🔍 Gather                              │    │
│  │ Barracks    │             │ Information                            │    │
│  │ (Day 3/10)  │             │                                        │    │
│  │             │             │ "Ask about                             │    │
│  │             │             │  cult activity"                        │    │
│  │ [Edit]      │ [Edit]      │ [Edit]                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  📊 RESOURCES                        📜 COMPLETED (from last period)       │
│  ├─ 💰 Gold: 2,340                   ├─ ✓ Letter to Duke (awaiting reply)  │
│  ├─ 👥 Followers: 12                 ├─ ✓ Recruited 3 soldiers             │
│  ├─ 🏛️ Influence: 5                  └─ ✓ Barracks 5/10 days complete      │
│  ├─ ⭐ Renown: 8                                                           │
│  └─ 📦 Materials: 45                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
*/

// ============================================
// GM REVIEW UI
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚖️ GM REVIEW QUEUE                                      [Approve All ✓]   │
│  Downtime Period: Marpenoth 15-21                        12 actions pending │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠️ FLAGGED FOR REVIEW (3)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔴 Kira - Spy Mission → Cult of the Dragon                          │    │
│  │    AI Result: CRITICAL FAILURE - Agent captured                     │    │
│  │    Flag: "High stakes - affects main plot"                          │    │
│  │                                                                     │    │
│  │    [View Details]  [✓ Approve] [✏️ Modify] [✗ Reject]               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🟡 Theron - Political Maneuvering → Duke's Court                    │    │
│  │    AI Result: SUCCESS - Gained Duke's ear                           │    │
│  │    Flag: "Involves major NPC"                                       │    │
│  │                                                                     │    │
│  │    [View Details]  [✓ Approve] [✏️ Modify] [✗ Reject]               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ✅ AUTO-APPROVABLE (9)                                  [Review Anyway]    │
│  ├─ Kira - Train Skill (Investigation) ..................... Day 1 Slot 2  │
│  ├─ Theron - Write Letter (Merchant Guild) ................. Day 1 Slot 1  │
│  ├─ Bjorn - Train Troops .................................. Day 1 Slot 1  │
│  ├─ Bjorn - Train Troops .................................. Day 2 Slot 1  │
│  └─ ... 5 more                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼ (Click "View Details" on flagged item)

┌─────────────────────────────────────────────────────────────────────────────┐
│  🔴 FLAGGED: Spy Mission                                           [Back]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CHARACTER: Kira Shadowmend (Rogue 7)                                       │
│  ACTION: Send spy to infiltrate Cult of the Dragon                         │
│  TARGET: Cult's Waterdeep cell                                              │
│  PLAYER NOTES: "I want to find out where they're keeping prisoners"        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  AI RESOLUTION:                                                             │
│  Roll: 4 + 5 (stealth) - 3 (cult on alert) = 6 vs DC 15                    │
│  Result: CRITICAL FAILURE                                                   │
│                                                                             │
│  NARRATIVE:                                                                 │
│  "Kira's agent, a halfling named Pip, was caught attempting to             │
│   infiltrate the cult's safehouse in the Dock Ward. Under torture,         │
│   he revealed that he was working for the party. The cult now knows        │
│   they're being watched."                                                   │
│                                                                             │
│  CONSEQUENCES:                                                              │
│  • -2 Influence (blown operation)                                          │
│  • Pip captured (follower lost)                                            │
│  • Cult of the Dragon now hostile                                          │
│  • Cult increases security (future infiltration harder)                    │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  GM OPTIONS:                                                                │
│                                                                             │
│  [✓ APPROVE AS-IS]                                                         │
│                                                                             │
│  [✏️ MODIFY]                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Modified outcome:                                                   │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Pip was caught but managed to feed misinformation before       │ │    │
│  │ │ escaping. The cult thinks the Harpers are behind the spying.   │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  │                                                                     │    │
│  │ Adjusted consequences: [Remove Pip lost] [Add: Harpers annoyed]    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [✗ REJECT]                                                                 │
│  Reason: ________________________________________________                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
*/
