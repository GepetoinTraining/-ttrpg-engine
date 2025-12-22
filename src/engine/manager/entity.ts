import { z } from "zod";

// ============================================
// ENTITY MANAGER - UNIFIED CRUD SYSTEM
// ============================================
//
// Philosophy: ONE INTERFACE TO RULE THEM ALL
//
// Every entity in the system (characters, parties,
// settlements, resources, followers, etc.) can be:
//   - Created
//   - Read (with filtering/search)
//   - Updated (partial or full)
//   - Deleted (soft or hard)
//
// With:
//   - Permission checks (GM vs Player)
//   - Change tracking (for sync)
//   - Validation (Zod schemas)
//   - Relationships (auto-update related)
//   - History (who changed what when)
//

// ============================================
// ENTITY TYPES
// ============================================

export const EntityTypeSchema = z.enum([
  // Core
  "campaign",
  "session",
  "party",

  // Characters
  "player_character",
  "npc",
  "creature",

  // World
  "settlement",
  "location",
  "region",

  // Organizations
  "faction",
  "guild",
  "organization",

  // Units
  "follower",
  "troop",
  "agent",
  "specialist",

  // Items
  "item",
  "artifact",
  "vehicle",
  "property",

  // Economy
  "trade_route",
  "market",
  "commodity",
  "economic_event",

  // Narrative
  "quest",
  "arc",
  "beat",
  "secret",

  // Systems
  "downtime_action",
  "faction_scheme",
  "lair",
  "puzzle",

  // Meta
  "user",
  "player_account",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

// ============================================
// PERMISSIONS
// ============================================

export const PermissionLevelSchema = z.enum([
  "none", // Cannot access
  "view", // Read only
  "edit", // Can modify
  "manage", // Can create/delete
  "owner", // Full control
  "gm", // Game Master (all access)
  "admin", // System admin
]);
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

export const EntityPermissionSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),

  // Who has access
  userId: z.string().uuid(),
  userRole: z.enum(["player", "gm", "spectator", "admin"]),

  // What access
  permission: PermissionLevelSchema,

  // Specific field restrictions
  hiddenFields: z.array(z.string()).default([]), // Fields user cannot see
  readOnlyFields: z.array(z.string()).default([]), // Fields user cannot edit

  // Granted by
  grantedBy: z.string().uuid().optional(),
  grantedAt: z.date().optional(),
});
export type EntityPermission = z.infer<typeof EntityPermissionSchema>;

// Default permissions by role
export const DefaultPermissions: Record<
  string,
  Record<EntityType, PermissionLevel>
> = {
  player: {
    campaign: "view",
    session: "view",
    party: "edit",
    player_character: "owner", // Own characters only
    npc: "view",
    creature: "none", // GM info
    settlement: "view",
    location: "view",
    region: "view",
    faction: "view",
    guild: "view",
    organization: "view",
    follower: "manage", // Own followers
    troop: "manage",
    agent: "manage",
    specialist: "manage",
    item: "manage", // Own items
    artifact: "view",
    vehicle: "edit",
    property: "edit",
    trade_route: "view",
    market: "view",
    commodity: "view",
    economic_event: "view",
    quest: "view",
    arc: "view",
    beat: "none", // GM info
    secret: "none", // GM info
    downtime_action: "manage", // Own actions
    faction_scheme: "none", // GM info
    lair: "none", // GM info
    puzzle: "view",
    user: "none",
    player_account: "owner", // Own account
  },
  gm: {
    // GM has 'gm' permission on everything
    campaign: "gm",
    session: "gm",
    party: "gm",
    player_character: "gm",
    npc: "gm",
    creature: "gm",
    settlement: "gm",
    location: "gm",
    region: "gm",
    faction: "gm",
    guild: "gm",
    organization: "gm",
    follower: "gm",
    troop: "gm",
    agent: "gm",
    specialist: "gm",
    item: "gm",
    artifact: "gm",
    vehicle: "gm",
    property: "gm",
    trade_route: "gm",
    market: "gm",
    commodity: "gm",
    economic_event: "gm",
    quest: "gm",
    arc: "gm",
    beat: "gm",
    secret: "gm",
    downtime_action: "gm",
    faction_scheme: "gm",
    lair: "gm",
    puzzle: "gm",
    user: "view",
    player_account: "view",
  },
};

// ============================================
// QUERY SYSTEM
// ============================================

export const QueryOperatorSchema = z.enum([
  "eq", // Equals
  "neq", // Not equals
  "gt", // Greater than
  "gte", // Greater than or equal
  "lt", // Less than
  "lte", // Less than or equal
  "in", // In array
  "nin", // Not in array
  "contains", // String contains
  "startsWith", // String starts with
  "endsWith", // String ends with
  "exists", // Field exists
  "isNull", // Field is null
  "between", // Between two values
  "regex", // Regex match
]);
export type QueryOperator = z.infer<typeof QueryOperatorSchema>;

export const QueryConditionSchema = z.object({
  field: z.string(),
  operator: QueryOperatorSchema,
  value: z.any(),
  value2: z.any().optional(), // For 'between'
});
export type QueryCondition = z.infer<typeof QueryConditionSchema>;

export const QuerySchema = z.object({
  // What to query
  entityType: EntityTypeSchema,

  // Conditions (AND by default)
  conditions: z.array(QueryConditionSchema).default([]),

  // OR groups
  orGroups: z.array(z.array(QueryConditionSchema)).optional(),

  // Sorting
  orderBy: z
    .array(
      z.object({
        field: z.string(),
        direction: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .optional(),

  // Pagination
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),

  // Include related entities
  include: z.array(z.string()).optional(), // Relationship names

  // Select specific fields
  select: z.array(z.string()).optional(),

  // Full-text search
  search: z.string().optional(),
  searchFields: z.array(z.string()).optional(),
});
export type Query = z.infer<typeof QuerySchema>;

// ============================================
// CHANGE TRACKING
// ============================================

export const ChangeTypeSchema = z.enum([
  "create",
  "update",
  "delete",
  "restore", // Undelete
  "archive", // Soft delete
  "transfer", // Ownership change
  "link", // Relationship added
  "unlink", // Relationship removed
]);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const ChangeRecordSchema = z.object({
  id: z.string().uuid(),

  // What changed
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),
  entityName: z.string().optional(),

  // Change details
  changeType: ChangeTypeSchema,

  // For updates
  changedFields: z
    .array(
      z.object({
        field: z.string(),
        oldValue: z.any(),
        newValue: z.any(),
      }),
    )
    .optional(),

  // Who changed it
  changedBy: z.object({
    userId: z.string().uuid(),
    userName: z.string(),
    role: z.enum(["player", "gm", "system", "admin"]),
  }),

  // When
  changedAt: z.date(),

  // Context
  reason: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(), // For batch operations

  // Sync
  synced: z.boolean().default(false),
  syncedAt: z.date().optional(),
});
export type ChangeRecord = z.infer<typeof ChangeRecordSchema>;

// ============================================
// CRUD OPERATIONS
// ============================================

// Create
export const CreateOperationSchema = z.object({
  entityType: EntityTypeSchema,
  data: z.record(z.string(), z.any()),

  // Options
  options: z
    .object({
      // Return the created entity
      returnEntity: z.boolean().default(true),
      // Skip validation (dangerous!)
      skipValidation: z.boolean().default(false),
      // Auto-generate ID
      generateId: z.boolean().default(true),
      // Set owner to current user
      setOwner: z.boolean().default(true),
      // Reason for audit
      reason: z.string().optional(),
    })
    .optional(),
});
export type CreateOperation = z.infer<typeof CreateOperationSchema>;

// Read (single)
export const ReadOperationSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),

  options: z
    .object({
      // Include related entities
      include: z.array(z.string()).optional(),
      // Select specific fields
      select: z.array(z.string()).optional(),
      // Include deleted
      includeDeleted: z.boolean().default(false),
    })
    .optional(),
});
export type ReadOperation = z.infer<typeof ReadOperationSchema>;

// Update
export const UpdateOperationSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),

  // Partial update data
  data: z.record(z.string(), z.any()),

  options: z
    .object({
      // Return the updated entity
      returnEntity: z.boolean().default(true),
      // Replace entirely (PUT) vs merge (PATCH)
      replace: z.boolean().default(false),
      // Skip validation
      skipValidation: z.boolean().default(false),
      // Reason for audit
      reason: z.string().optional(),
      // Optimistic locking
      expectedVersion: z.number().int().optional(),
    })
    .optional(),
});
export type UpdateOperation = z.infer<typeof UpdateOperationSchema>;

// Delete
export const DeleteOperationSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),

  options: z
    .object({
      // Soft delete (archive) vs hard delete
      soft: z.boolean().default(true),
      // Cascade delete related
      cascade: z.boolean().default(false),
      // Reason for audit
      reason: z.string().optional(),
    })
    .optional(),
});
export type DeleteOperation = z.infer<typeof DeleteOperationSchema>;

// Batch operations
export const BatchOperationSchema = z.object({
  operations: z.array(
    z.discriminatedUnion("operation", [
      z.object({
        operation: z.literal("create"),
        ...CreateOperationSchema.shape,
      }),
      z.object({
        operation: z.literal("update"),
        ...UpdateOperationSchema.shape,
      }),
      z.object({
        operation: z.literal("delete"),
        ...DeleteOperationSchema.shape,
      }),
    ]),
  ),

  options: z
    .object({
      // All or nothing
      atomic: z.boolean().default(true),
      // Stop on first error
      stopOnError: z.boolean().default(true),
      // Reason for audit
      reason: z.string().optional(),
    })
    .optional(),
});
export type BatchOperation = z.infer<typeof BatchOperationSchema>;

// ============================================
// OPERATION RESULTS
// ============================================

export const OperationResultSchema = z.object({
  success: z.boolean(),

  // Created/Updated/Read entity
  entity: z.any().optional(),

  // For queries
  entities: z.array(z.any()).optional(),
  total: z.number().int().optional(),
  hasMore: z.boolean().optional(),

  // Change record
  changeRecord: ChangeRecordSchema.optional(),

  // Errors
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      field: z.string().optional(),
      details: z.any().optional(),
    })
    .optional(),

  // Warnings
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});
export type OperationResult = z.infer<typeof OperationResultSchema>;

// ============================================
// CHARACTER MANAGER
// ============================================

export const CharacterSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),

  // Quick reference
  race: z.string(),
  class: z.string(),
  level: z.number().int(),

  // Status
  currentHp: z.number().int(),
  maxHp: z.number().int(),
  tempHp: z.number().int().default(0),
  conditions: z.array(z.string()).default([]),

  // Key stats
  ac: z.number().int(),
  speed: z.number().int(),
  initiative: z.number().int(),

  // Resources
  hitDiceRemaining: z.number().int(),
  deathSaves: z
    .object({
      successes: z.number().int().default(0),
      failures: z.number().int().default(0),
    })
    .optional(),

  // Ownership
  playerId: z.string().uuid().optional(),
  playerName: z.string().optional(),
  partyId: z.string().uuid().optional(),

  // Portrait
  portraitUrl: z.string().optional(),
  tokenUrl: z.string().optional(),

  // Quick actions
  favoriteActions: z.array(z.string()).default([]),

  // Last modified
  lastModified: z.date(),
});
export type CharacterSummary = z.infer<typeof CharacterSummarySchema>;

export const CharacterManagerSchema = z.object({
  // All characters accessible to user
  characters: z.array(CharacterSummarySchema).default([]),

  // Filters
  filters: z.object({
    showNPCs: z.boolean().default(false),
    showDead: z.boolean().default(false),
    partyOnly: z.boolean().default(true),
    searchTerm: z.string().optional(),
  }),

  // Sorting
  sortBy: z
    .enum(["name", "level", "hp", "class", "lastModified"])
    .default("name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),

  // Selected character (for detail view)
  selectedCharacterId: z.string().uuid().optional(),
});
export type CharacterManager = z.infer<typeof CharacterManagerSchema>;

// ============================================
// PARTY MANAGER
// ============================================

export const PartySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),

  // Members
  members: z
    .array(
      z.object({
        characterId: z.string().uuid(),
        characterName: z.string(),
        playerId: z.string().uuid().optional(),
        playerName: z.string().optional(),
        role: z
          .enum(["leader", "member", "npc_companion", "temporary"])
          .default("member"),
        active: z.boolean().default(true),
      }),
    )
    .default([]),

  // Resources
  sharedGold: z.number().default(0),
  sharedInventory: z
    .array(
      z.object({
        itemId: z.string(),
        name: z.string(),
        quantity: z.number().int(),
      }),
    )
    .default([]),

  // Status
  currentLocation: z.string().optional(),
  currentQuest: z.string().optional(),

  // Stats
  averageLevel: z.number(),
  totalMembers: z.number().int(),
  activeMembers: z.number().int(),

  // Campaign
  campaignId: z.string().uuid(),
  campaignName: z.string(),
});
export type PartySummary = z.infer<typeof PartySummarySchema>;

export const PartyManagerSchema = z.object({
  // All parties
  parties: z.array(PartySummarySchema).default([]),

  // Current/selected party
  activePartyId: z.string().uuid().optional(),

  // Party actions
  availableActions: z
    .array(
      z.enum([
        "add_member",
        "remove_member",
        "promote_leader",
        "split_party",
        "merge_parties",
        "distribute_loot",
        "manage_inventory",
        "set_marching_order",
      ]),
    )
    .default([]),
});
export type PartyManager = z.infer<typeof PartyManagerSchema>;

// ============================================
// SETTLEMENT MANAGER
// ============================================

export const SettlementSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),

  // Type
  type: z.enum(["hamlet", "village", "town", "city", "metropolis"]),
  population: z.number().int(),

  // Ownership
  controlledBy: z.string().optional(), // Faction name
  governor: z.string().optional(), // NPC name

  // Status
  prosperity: z.number().int().min(0).max(100),
  stability: z.number().int().min(0).max(100),
  defense: z.number().int().min(0).max(100),

  // Economy quick view
  primaryExports: z.array(z.string()).default([]),
  primaryImports: z.array(z.string()).default([]),
  marketSize: z.enum(["none", "small", "medium", "large", "major"]),

  // Issues
  activeIssues: z.array(z.string()).default([]),

  // Player interaction
  partyReputation: z.number().int().default(0),
  visitedByParty: z.boolean().default(false),
  lastVisit: z.date().optional(),

  // Location
  regionId: z.string().uuid().optional(),
  regionName: z.string().optional(),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});
export type SettlementSummary = z.infer<typeof SettlementSummarySchema>;

export const SettlementManagerSchema = z.object({
  // All settlements
  settlements: z.array(SettlementSummarySchema).default([]),

  // Filters
  filters: z.object({
    type: z.array(z.string()).optional(),
    region: z.string().uuid().optional(),
    minPopulation: z.number().int().optional(),
    visited: z.boolean().optional(),
    hasIssues: z.boolean().optional(),
  }),

  // View mode
  viewMode: z.enum(["list", "map", "economy"]).default("list"),

  // Selected
  selectedSettlementId: z.string().uuid().optional(),

  // GM actions
  gmActions: z
    .array(
      z.enum([
        "create_settlement",
        "simulate_economy",
        "trigger_event",
        "manage_buildings",
        "manage_npcs",
      ]),
    )
    .default([]),
});
export type SettlementManager = z.infer<typeof SettlementManagerSchema>;

// ============================================
// RESOURCE MANAGER
// ============================================

export const ResourceSummarySchema = z.object({
  // Currency
  currency: z.object({
    copper: z.number().int().default(0),
    silver: z.number().int().default(0),
    electrum: z.number().int().default(0),
    gold: z.number().int().default(0),
    platinum: z.number().int().default(0),
    totalGold: z.number(), // Calculated
  }),

  // Inventory categories
  inventory: z.object({
    weapons: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          quantity: z.number().int(),
          equipped: z.boolean().default(false),
          value: z.number().optional(),
        }),
      )
      .default([]),

    armor: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          quantity: z.number().int(),
          equipped: z.boolean().default(false),
          value: z.number().optional(),
        }),
      )
      .default([]),

    consumables: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          quantity: z.number().int(),
          charges: z.number().int().optional(),
          value: z.number().optional(),
        }),
      )
      .default([]),

    gear: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          quantity: z.number().int(),
          value: z.number().optional(),
        }),
      )
      .default([]),

    treasures: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          quantity: z.number().int(),
          value: z.number(),
          description: z.string().optional(),
        }),
      )
      .default([]),

    questItems: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          questName: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .default([]),

    magicItems: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          rarity: z.string(),
          attuned: z.boolean().default(false),
          attunedTo: z.string().optional(),
          charges: z.number().int().optional(),
          maxCharges: z.number().int().optional(),
        }),
      )
      .default([]),
  }),

  // Carrying capacity
  capacity: z
    .object({
      current: z.number(),
      max: z.number(),
      encumbered: z.boolean().default(false),
      heavilyEncumbered: z.boolean().default(false),
    })
    .optional(),

  // Properties & vehicles
  properties: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        location: z.string().optional(),
        value: z.number().optional(),
        income: z.number().optional(), // Per week
      }),
    )
    .default([]),

  vehicles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        capacity: z.number().int().optional(),
        speed: z.string().optional(),
      }),
    )
    .default([]),
});
export type ResourceSummary = z.infer<typeof ResourceSummarySchema>;

export const ResourceManagerSchema = z.object({
  // Whose resources
  ownerId: z.string().uuid(),
  ownerType: z.enum(["character", "party", "settlement", "faction"]),
  ownerName: z.string(),

  // Resources
  resources: ResourceSummarySchema,

  // Actions
  actions: z
    .array(
      z.enum([
        "add_item",
        "remove_item",
        "transfer_item",
        "sell_item",
        "buy_item",
        "equip_item",
        "attune_item",
        "split_currency",
        "convert_currency",
      ]),
    )
    .default([]),

  // Transaction history
  recentTransactions: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.enum(["add", "remove", "transfer", "buy", "sell"]),
        item: z.string().optional(),
        currency: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        date: z.date(),
        note: z.string().optional(),
      }),
    )
    .default([]),
});
export type ResourceManager = z.infer<typeof ResourceManagerSchema>;

// ============================================
// FOLLOWER MANAGER
// ============================================

export const FollowerSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),

  // Type
  type: z.enum(["troop", "agent", "specialist", "companion", "hireling"]),

  // Stats
  level: z.number().int().optional(),
  loyalty: z.number().int().min(0).max(100),
  morale: z.number().int().min(0).max(100).optional(),

  // Status
  status: z.enum([
    "available",
    "on_mission",
    "recovering",
    "training",
    "missing",
    "dead",
  ]),
  currentMission: z.string().optional(),
  missionEndDate: z.string().optional(),

  // For troops
  count: z.number().int().optional(),
  maxCount: z.number().int().optional(),

  // Capabilities
  specialties: z.array(z.string()).default([]),

  // Cost
  upkeep: z.number().default(0), // Per week

  // Assignment
  assignedTo: z.string().optional(), // Character name
});
export type FollowerSummary = z.infer<typeof FollowerSummarySchema>;

export const FollowerManagerSchema = z.object({
  // Owner
  ownerId: z.string().uuid(),
  ownerName: z.string(),

  // Followers
  followers: z.array(FollowerSummarySchema).default([]),

  // Capacity
  followerSlots: z.object({
    used: z.number().int(),
    max: z.number().int(),
    bonusFrom: z
      .array(
        z.object({
          source: z.string(),
          bonus: z.number().int(),
        }),
      )
      .optional(),
  }),

  // Costs
  totalUpkeep: z.number(),

  // Filters
  filters: z.object({
    type: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    assignedTo: z.string().optional(),
  }),

  // Actions
  actions: z
    .array(
      z.enum([
        "recruit",
        "dismiss",
        "assign_mission",
        "recall",
        "train",
        "promote",
        "transfer",
      ]),
    )
    .default([]),
});
export type FollowerManager = z.infer<typeof FollowerManagerSchema>;

// ============================================
// SYSTEMS MANAGER (GM Only)
// ============================================

export const SystemsManagerSchema = z.object({
  // Campaign overview
  campaign: z.object({
    id: z.string().uuid(),
    name: z.string(),
    currentArc: z.string().optional(),
    currentSession: z.number().int(),
    worldDate: z.string(),
    realWorldStartDate: z.date(),
  }),

  // Active systems status
  systems: z.object({
    // Economy
    economy: z.object({
      enabled: z.boolean().default(true),
      lastSimulated: z.date().optional(),
      activeEvents: z.number().int().default(0),
      volatility: z.number().default(0.2),
    }),

    // Factions
    factions: z.object({
      enabled: z.boolean().default(true),
      activeFactions: z.number().int().default(0),
      activeSchemes: z.number().int().default(0),
      pendingTurns: z.number().int().default(0),
    }),

    // Downtime
    downtime: z.object({
      enabled: z.boolean().default(true),
      currentPeriod: z.string().optional(),
      pendingActions: z.number().int().default(0),
      daysRemaining: z.number().int().default(0),
    }),

    // Settlements
    settlements: z.object({
      enabled: z.boolean().default(true),
      totalSettlements: z.number().int().default(0),
      settlementsWithIssues: z.number().int().default(0),
    }),

    // Narrative
    narrative: z.object({
      activeQuests: z.number().int().default(0),
      completedQuests: z.number().int().default(0),
      openPlotThreads: z.number().int().default(0),
      rabbitHoles: z.number().int().default(0),
    }),
  }),

  // Quick actions
  quickActions: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        category: z.enum([
          "economy",
          "factions",
          "downtime",
          "narrative",
          "combat",
          "world",
        ]),
        description: z.string(),
      }),
    )
    .default([]),

  // Alerts
  alerts: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.enum(["warning", "info", "action_required", "reminder"]),
        message: z.string(),
        source: z.string(),
        actionUrl: z.string().optional(),
        dismissable: z.boolean().default(true),
      }),
    )
    .default([]),
});
export type SystemsManager = z.infer<typeof SystemsManagerSchema>;

// ============================================
// UNIFIED DASHBOARD
// ============================================

export const PlayerDashboardSchema = z.object({
  // User info
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.enum(["player", "gm", "spectator"]),
  }),

  // Quick access
  myCharacters: z.array(CharacterSummarySchema).default([]),
  activeCharacter: CharacterSummarySchema.optional(),

  // Party
  party: PartySummarySchema.optional(),

  // Resources (active character)
  resources: ResourceSummarySchema.optional(),

  // Followers (active character)
  followers: z.array(FollowerSummarySchema).default([]),

  // Pending
  pending: z.object({
    downtimeActions: z.number().int().default(0),
    unreadMessages: z.number().int().default(0),
    pendingDiaries: z.number().int().default(0),
    lootToClaim: z.number().int().default(0),
  }),

  // Recent activity
  recentActivity: z
    .array(
      z.object({
        type: z.string(),
        description: z.string(),
        timestamp: z.date(),
        url: z.string().optional(),
      }),
    )
    .default([]),

  // Next session
  nextSession: z
    .object({
      date: z.date().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});
export type PlayerDashboard = z.infer<typeof PlayerDashboardSchema>;

export const GmDashboardSchema = z.object({
  // Include player dashboard
  ...PlayerDashboardSchema.shape,

  // GM-specific
  systems: SystemsManagerSchema.shape.systems,

  // All parties
  parties: z.array(PartySummarySchema).default([]),

  // World overview
  worldState: z.object({
    currentDate: z.string(),
    season: z.string(),
    majorEvents: z.array(z.string()).default([]),
  }),

  // Prep checklist
  sessionPrep: z.object({
    nextSessionDate: z.date().optional(),
    prepProgress: z.number().int().min(0).max(100).default(0),
    checklist: z
      .array(
        z.object({
          item: z.string(),
          completed: z.boolean().default(false),
        }),
      )
      .default([]),
  }),

  // GM alerts (higher priority)
  gmAlerts: z
    .array(
      z.object({
        type: z.enum(["urgent", "warning", "info", "reminder"]),
        message: z.string(),
        source: z.string(),
        action: z.string().optional(),
      }),
    )
    .default([]),
});
export type GmDashboard = z.infer<typeof GmDashboardSchema>;

// ============================================
// API INTERFACE
// ============================================

export interface EntityManagerAPI {
  // CRUD
  create<T>(operation: CreateOperation): Promise<OperationResult>;
  read<T>(operation: ReadOperation): Promise<OperationResult>;
  update<T>(operation: UpdateOperation): Promise<OperationResult>;
  delete(operation: DeleteOperation): Promise<OperationResult>;

  // Query
  query<T>(query: Query): Promise<OperationResult>;
  search<T>(
    entityType: EntityType,
    term: string,
    options?: { limit?: number; fields?: string[] },
  ): Promise<OperationResult>;

  // Batch
  batch(operation: BatchOperation): Promise<OperationResult[]>;

  // Relationships
  link(
    fromType: EntityType,
    fromId: string,
    toType: EntityType,
    toId: string,
    relationship: string,
  ): Promise<OperationResult>;
  unlink(
    fromType: EntityType,
    fromId: string,
    toType: EntityType,
    toId: string,
    relationship: string,
  ): Promise<OperationResult>;

  // Permissions
  checkPermission(
    userId: string,
    entityType: EntityType,
    entityId: string,
    action: string,
  ): Promise<boolean>;
  grantPermission(permission: EntityPermission): Promise<OperationResult>;
  revokePermission(
    userId: string,
    entityType: EntityType,
    entityId: string,
  ): Promise<OperationResult>;

  // Change tracking
  getChanges(since: Date, entityType?: EntityType): Promise<ChangeRecord[]>;
  getEntityHistory(
    entityType: EntityType,
    entityId: string,
  ): Promise<ChangeRecord[]>;

  // Sync
  sync(
    changes: ChangeRecord[],
  ): Promise<{ synced: number; conflicts: ChangeRecord[] }>;

  // Dashboards
  getPlayerDashboard(userId: string): Promise<PlayerDashboard>;
  getGmDashboard(userId: string): Promise<GmDashboard>;

  // Managers
  getCharacterManager(userId: string, filters?: any): Promise<CharacterManager>;
  getPartyManager(userId: string): Promise<PartyManager>;
  getSettlementManager(userId: string): Promise<SettlementManager>;
  getResourceManager(
    ownerId: string,
    ownerType: string,
  ): Promise<ResourceManager>;
  getFollowerManager(ownerId: string): Promise<FollowerManager>;
  getSystemsManager(userId: string): Promise<SystemsManager>;
}

// ============================================
// STANDARD QUERIES
// ============================================

export const StandardQueries = {
  // My characters
  myCharacters: (userId: string): Query => ({
    entityType: "player_character",
    conditions: [{ field: "playerId", operator: "eq", value: userId }],
    orderBy: [{ field: "name", direction: "asc" }],
    limit: 100,
  }),

  // Party members
  partyMembers: (partyId: string): Query => ({
    entityType: "player_character",
    conditions: [{ field: "partyId", operator: "eq", value: partyId }],
    include: ["player"],
    limit: 20,
  }),

  // Available followers
  availableFollowers: (ownerId: string): Query => ({
    entityType: "follower",
    conditions: [
      { field: "ownerId", operator: "eq", value: ownerId },
      { field: "status", operator: "eq", value: "available" },
    ],
    orderBy: [
      { field: "type", direction: "asc" },
      { field: "name", direction: "asc" },
    ],
    limit: 100,
  }),

  // Settlements in region
  settlementsInRegion: (regionId: string): Query => ({
    entityType: "settlement",
    conditions: [{ field: "regionId", operator: "eq", value: regionId }],
    orderBy: [{ field: "population", direction: "desc" }],
    limit: 100,
  }),

  // Active quests
  activeQuests: (partyId: string): Query => ({
    entityType: "quest",
    conditions: [
      { field: "partyId", operator: "eq", value: partyId },
      { field: "status", operator: "in", value: ["active", "in_progress"] },
    ],
    orderBy: [{ field: "priority", direction: "desc" }],
    limit: 50,
  }),

  // Pending downtime actions
  pendingDowntime: (characterId: string): Query => ({
    entityType: "downtime_action",
    conditions: [
      { field: "characterId", operator: "eq", value: characterId },
      { field: "status", operator: "eq", value: "pending" },
    ],
    orderBy: [{ field: "queuedAt", direction: "asc" }],
    limit: 50,
  }),

  // Recent economic events
  recentEconomicEvents: (daysBack: number = 7): Query => ({
    entityType: "economic_event",
    conditions: [
      {
        field: "startDate",
        operator: "gte",
        value: new Date(
          Date.now() - daysBack * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ],
    orderBy: [{ field: "startDate", direction: "desc" }],
    limit: 20,
  }),

  // Active faction schemes (GM only)
  activeFactionSchemes: (): Query => ({
    entityType: "faction_scheme",
    conditions: [
      { field: "status", operator: "in", value: ["planning", "executing"] },
    ],
    include: ["faction"],
    orderBy: [{ field: "priority", direction: "desc" }],
    limit: 50,
  }),
};
