import { z } from "zod";

// ============================================
// MIDDLEWARE LAYER - HOOKS
// ============================================
//
// Philosophy: FRONTEND PATTERNS
//
// These are the patterns the frontend uses
// to interact with the middleware.
//
// Each hook:
//   - Fetches the right aggregate
//   - Subscribes to updates
//   - Provides actions
//   - Handles loading/error states
//
// Implementation-agnostic: works with
// React Query, SWR, or custom state.
//

// ============================================
// HOOK RETURN TYPE
// ============================================

export const HookStateSchema = z.object({
  // Data
  data: z.any().optional(),

  // Status
  isLoading: z.boolean().default(false),
  isError: z.boolean().default(false),
  isSuccess: z.boolean().default(false),

  // Error
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),

  // Freshness
  lastFetched: z.date().optional(),
  isStale: z.boolean().default(false),

  // Sync
  isSyncing: z.boolean().default(false),
  pendingChanges: z.number().int().default(0),
});
export type HookState<T> = Omit<z.infer<typeof HookStateSchema>, "data"> & {
  data?: T;
};

// ============================================
// HOOK DEFINITIONS
// ============================================
//
// These define the "contract" for each hook.
// The actual implementation depends on the
// frontend framework.
//

export interface HookDefinition<TData, TParams = void, TActions = {}> {
  // Hook name
  name: string;

  // What aggregate this loads
  aggregate: string;

  // Parameters needed
  params: z.ZodType<TParams>;

  // Return type
  returns: z.ZodType<TData>;

  // Available actions
  actions: TActions;

  // Subscription pattern
  subscriptions?: string[]; // Event types to subscribe to

  // Cache configuration
  cache?: {
    ttl: number; // Seconds
    staleWhileRevalidate: boolean;
    invalidateOn: string[]; // Events that invalidate
  };
}

// ============================================
// CHARACTER HOOKS
// ============================================

export const UseCharacterHook = {
  name: "useCharacter",
  aggregate: "CharacterSheetAggregate",

  params: z.object({
    characterId: z.string().uuid(),
  }),

  subscriptions: [
    "character.damaged",
    "character.healed",
    "character.conditionApplied",
    "character.conditionRemoved",
    "character.leveledUp",
    "inventory.transfer",
  ],

  cache: {
    ttl: 300,
    staleWhileRevalidate: true,
    invalidateOn: ["character.leveledUp"],
  },

  actions: {
    takeDamage: "(amount: number, type: string, source: string) => void",
    heal: "(amount: number, source: string) => void",
    addCondition: "(condition: string, duration?: string) => void",
    removeCondition: "(condition: string) => void",
    shortRest: "(hitDice: number) => void",
    longRest: "() => void",
    updateNotes: "(notes: Partial<CharacterNotes>) => void",
  },
};

export const UseMyCharactersHook = {
  name: "useMyCharacters",
  aggregate: "CharacterCard[]",

  params: z.object({
    playerId: z.string().uuid(),
    campaignId: z.string().uuid().optional(),
  }),

  cache: {
    ttl: 600,
    staleWhileRevalidate: true,
    invalidateOn: ["character.created", "character.deleted"],
  },

  actions: {
    createCharacter: "(data: CreateCharacterInput) => Promise<string>",
    deleteCharacter: "(characterId: string) => void",
    setActiveCharacter: "(characterId: string) => void",
  },
};

// ============================================
// PARTY HOOKS
// ============================================

export const UsePartyHook = {
  name: "useParty",
  aggregate: "PartySummaryAggregate",

  params: z.object({
    partyId: z.string().uuid(),
  }),

  subscriptions: [
    "party.memberJoined",
    "party.memberLeft",
    "inventory.transfer",
    "party.goldChanged",
  ],

  actions: {
    addMember: "(characterId: string) => void",
    removeMember: "(characterId: string) => void",
    promoteMember: "(characterId: string, role: string) => void",
    distributeGold: "(distribution: Record<string, number>) => void",
    setMarchingOrder: "(order: string[]) => void",
  },
};

// ============================================
// SESSION HOOKS
// ============================================

export const UseSessionHook = {
  name: "useSession",
  aggregate: "SessionStateAggregate",

  params: z.object({
    sessionId: z.string().uuid(),
  }),

  subscriptions: [
    "session.sceneChanged",
    "combat.started",
    "combat.ended",
    "combat.turnStarted",
    "character.damaged",
    "character.healed",
    "quest.progressed",
  ],

  cache: {
    ttl: 0, // Always fresh during active session
    staleWhileRevalidate: false,
    invalidateOn: ["session.ended"],
  },

  actions: {
    changeScene: "(scene: SceneInput) => void",
    addEvent: "(event: string) => void",
    updateGMNotes: "(notes: string) => void",
  },
};

export const UseActiveSessionHook = {
  name: "useActiveSession",
  aggregate: "SessionStateAggregate | null",

  params: z.object({
    campaignId: z.string().uuid(),
  }),

  // Automatically finds active session for campaign

  actions: {
    startSession: "() => Promise<string>",
    endSession: "() => void",
  },
};

// ============================================
// COMBAT HOOKS
// ============================================

export const UseCombatHook = {
  name: "useCombat",
  aggregate: "CombatEncounterAggregate",

  params: z.object({
    combatId: z.string().uuid(),
  }),

  subscriptions: [
    "combat.turnStarted",
    "combat.damageDealt",
    "combat.spellCast",
    "character.damaged",
    "character.conditionApplied",
    "combat.ended",
  ],

  cache: {
    ttl: 0,
    staleWhileRevalidate: false,
    invalidateOn: ["combat.ended"],
  },

  actions: {
    attack: "(targetId: string, attackName: string) => void",
    castSpell: "(spellName: string, level: number, targets: string[]) => void",
    move: "(path: Position[]) => void",
    endTurn: "() => void",
    delay: "() => void",
    useItem: "(itemId: string) => void",
    useFeature: "(featureName: string) => void",
  },
};

export const UseCombatantHook = {
  name: "useCombatant",
  aggregate: "CombatantState",

  params: z.object({
    combatId: z.string().uuid(),
    combatantId: z.string().uuid(),
  }),

  // Individual combatant within combat

  actions: {
    takeDamage: "(amount: number, type: string) => void",
    heal: "(amount: number) => void",
    addCondition: "(condition: string) => void",
    removeCondition: "(condition: string) => void",
    updatePosition: "(position: Position) => void",
  },
};

// ============================================
// NPC HOOKS
// ============================================

export const UseNPCHook = {
  name: "useNPC",
  aggregate: "NPCEncounterAggregate",

  params: z.object({
    npcId: z.string().uuid(),
  }),

  subscriptions: ["npc.attitudeChanged", "npc.memoryAdded"],

  actions: {
    startConversation: "() => void",
    updateAttitude: "(change: number, reason: string) => void",
    revealSecret: "(secretId: string) => void",
  },
};

export const UseNPCConversationHook = {
  name: "useNPCConversation",
  aggregate: "NPCConversationState",

  params: z.object({
    npcId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),

  // Real-time conversation with AI agent

  actions: {
    sendMessage: "(message: string) => Promise<string>",
    endConversation: "() => void",
    rollPersuasion: "(dc: number) => void",
    rollInsight: "(dc: number) => void",
  },
};

// ============================================
// WORLD HOOKS
// ============================================

export const UseWorldHook = {
  name: "useWorld",
  aggregate: "WorldSnapshotAggregate",

  params: z.object({
    campaignId: z.string().uuid(),
  }),

  subscriptions: [
    "economy.eventOccurred",
    "faction.schemeAdvanced",
    "settlement.updated",
    "world.timeAdvanced",
  ],

  cache: {
    ttl: 300,
    staleWhileRevalidate: true,
    invalidateOn: ["world.simulated"],
  },

  actions: {
    advanceTime: "(amount: number, unit: string) => void",
    simulateEconomy: "(days: number) => void",
    processFactionTurn: "() => void",
  },
};

export const UseSettlementHook = {
  name: "useSettlement",
  aggregate: "SettlementDetailAggregate",

  params: z.object({
    settlementId: z.string().uuid(),
  }),

  subscriptions: [
    "economy.priceChanged",
    "settlement.issueAdded",
    "settlement.buildingCompleted",
  ],

  actions: {
    updateEconomy: "(changes: EconomyChanges) => void",
    addBuilding: "(building: BuildingInput) => void",
    resolveIssue: "(issueId: string) => void",
  },
};

// ============================================
// QUEST HOOKS
// ============================================

export const UseQuestsHook = {
  name: "useQuests",
  aggregate: "QuestCard[]",

  params: z.object({
    partyId: z.string().uuid(),
    status: z.enum(["active", "completed", "failed", "all"]).optional(),
  }),

  subscriptions: [
    "quest.accepted",
    "quest.progressed",
    "quest.completed",
    "quest.failed",
  ],

  actions: {
    acceptQuest: "(questId: string) => void",
    abandonQuest: "(questId: string) => void",
  },
};

export const UseQuestHook = {
  name: "useQuest",
  aggregate: "QuestDetailAggregate",

  params: z.object({
    questId: z.string().uuid(),
  }),

  actions: {
    updateProgress: "(objectiveId: string, progress: number) => void",
    completeObjective: "(objectiveId: string) => void",
    addNote: "(note: string) => void",
  },
};

// ============================================
// INVENTORY HOOKS
// ============================================

export const UseInventoryHook = {
  name: "useInventory",
  aggregate: "InventoryAggregate",

  params: z.object({
    ownerId: z.string().uuid(),
    ownerType: z.enum(["character", "party"]),
  }),

  subscriptions: [
    "inventory.itemAdded",
    "inventory.itemRemoved",
    "inventory.itemTransferred",
  ],

  actions: {
    addItem: "(item: ItemInput) => void",
    removeItem: "(itemId: string, quantity?: number) => void",
    transferItem: "(itemId: string, toId: string, toType: string) => void",
    equipItem: "(itemId: string) => void",
    unequipItem: "(itemId: string) => void",
    attuneItem: "(itemId: string) => void",
    unattuneItem: "(itemId: string) => void",
    useConsumable: "(itemId: string) => void",
  },
};

// ============================================
// DOWNTIME HOOKS
// ============================================

export const UseDowntimeHook = {
  name: "useDowntime",
  aggregate: "DowntimeAggregate",

  params: z.object({
    periodId: z.string().uuid(),
  }),

  subscriptions: [
    "downtime.actionQueued",
    "downtime.actionResolved",
    "downtime.periodEnded",
  ],

  actions: {
    queueAction:
      "(characterId: string, day: number, slot: number, activity: ActivityInput) => void",
    removeAction: "(actionId: string) => void",
    resolveAll: "() => void",
  },
};

export const UseMyDowntimeHook = {
  name: "useMyDowntime",
  aggregate: "CharacterDowntimeAggregate",

  params: z.object({
    characterId: z.string().uuid(),
    periodId: z.string().uuid(),
  }),

  // Character-specific downtime view

  actions: {
    queueAction: "(day: number, slot: number, activity: ActivityInput) => void",
    cancelAction: "(actionId: string) => void",
  },
};

// ============================================
// FOLLOWER HOOKS
// ============================================

export const UseFollowersHook = {
  name: "useFollowers",
  aggregate: "FollowerSummary[]",

  params: z.object({
    ownerId: z.string().uuid(),
  }),

  subscriptions: [
    "follower.recruited",
    "follower.dismissed",
    "follower.missionStarted",
    "follower.missionCompleted",
  ],

  actions: {
    recruit: "(followerType: string, details: RecruitInput) => void",
    dismiss: "(followerId: string) => void",
    sendOnMission: "(followerId: string, mission: MissionInput) => void",
    recall: "(followerId: string) => void",
  },
};

// ============================================
// GM HOOKS
// ============================================

export const UseGMDashboardHook = {
  name: "useGMDashboard",
  aggregate: "GMDashboardAggregate",

  params: z.object({
    campaignId: z.string().uuid(),
  }),

  subscriptions: [
    // Subscribes to everything relevant to GM
    "*",
  ],

  actions: {
    quickGenerate: "(type: string, constraints: GenerateConstraints) => void",
    revealSecret: "(secretId: string, toCharacterIds: string[]) => void",
    triggerEvent: "(event: EventInput) => void",
    advanceTime: "(amount: number, unit: string) => void",
  },
};

export const UseSystemsManagerHook = {
  name: "useSystemsManager",
  aggregate: "SystemsManagerAggregate",

  params: z.object({
    campaignId: z.string().uuid(),
  }),

  actions: {
    simulateEconomy: "(days: number) => void",
    processFactionTurn: "(factionIds?: string[]) => void",
    resolveDowntime: "(periodId: string) => void",
    runWorldEvents: "() => void",
  },
};

// ============================================
// REAL-TIME HOOKS
// ============================================

export const UseRealtimeHook = {
  name: "useRealtime",

  // Connection state
  state: {
    connected: "boolean",
    latency: "number",
    lastMessage: "Date",
  },

  // For live session sync

  actions: {
    subscribe: "(channels: string[]) => void",
    unsubscribe: "(channels: string[]) => void",
    broadcast: "(channel: string, message: any) => void",
  },
};

export const UsePresenceHook = {
  name: "usePresence",
  aggregate: "PresenceState",

  params: z.object({
    sessionId: z.string().uuid(),
  }),

  // Who's online in the session

  returns: {
    users:
      "Array<{ userId: string; userName: string; characterId?: string; status: string }>",
    typing: "string[]",
  },

  actions: {
    setStatus: "(status: string) => void",
    setTyping: "(isTyping: boolean) => void",
  },
};

// ============================================
// HOOK REGISTRY
// ============================================

export const HookRegistry = {
  // Character
  useCharacter: UseCharacterHook,
  useMyCharacters: UseMyCharactersHook,

  // Party
  useParty: UsePartyHook,

  // Session
  useSession: UseSessionHook,
  useActiveSession: UseActiveSessionHook,

  // Combat
  useCombat: UseCombatHook,
  useCombatant: UseCombatantHook,

  // NPC
  useNPC: UseNPCHook,
  useNPCConversation: UseNPCConversationHook,

  // World
  useWorld: UseWorldHook,
  useSettlement: UseSettlementHook,

  // Quest
  useQuests: UseQuestsHook,
  useQuest: UseQuestHook,

  // Inventory
  useInventory: UseInventoryHook,

  // Downtime
  useDowntime: UseDowntimeHook,
  useMyDowntime: UseMyDowntimeHook,

  // Followers
  useFollowers: UseFollowersHook,

  // GM
  useGMDashboard: UseGMDashboardHook,
  useSystemsManager: UseSystemsManagerHook,

  // Real-time
  useRealtime: UseRealtimeHook,
  usePresence: UsePresenceHook,
};

// ============================================
// HOOK FACTORY (Framework-agnostic)
// ============================================

export interface HookFactory {
  // Create a hook implementation for the framework
  createHook<TData, TParams, TActions>(
    definition: HookDefinition<TData, TParams, TActions>,
  ): (params: TParams) => HookState<TData> & TActions;
}

// Example React implementation would be:
//
// const useCharacter = (params: { characterId: string }) => {
//   const { data, isLoading, error } = useQuery(
//     ['character', params.characterId],
//     () => api.getCharacterSheet(params.characterId),
//     { staleTime: 300000 }
//   );
//
//   const takeDamage = useMutation(/* ... */);
//   const heal = useMutation(/* ... */);
//
//   // Subscribe to real-time updates
//   useSubscription(['character.damaged', 'character.healed'], (event) => {
//     if (event.data.characterId === params.characterId) {
//       queryClient.invalidateQueries(['character', params.characterId]);
//     }
//   });
//
//   return {
//     data,
//     isLoading,
//     isError: !!error,
//     error,
//     takeDamage: takeDamage.mutate,
//     heal: heal.mutate,
//     // ... other actions
//   };
// };
