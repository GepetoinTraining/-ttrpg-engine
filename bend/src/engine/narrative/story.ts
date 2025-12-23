import { z } from "zod";

// ============================================
// NARRATIVE PHILOSOPHY
// ============================================
//
// The story is a TREE, not a timeline.
// Sessions are WHEN you played.
// Arcs/Quests/Beats are WHAT the story is.
//
// A campaign has ONE big objective.
// Arcs are major narrative chunks (main story, side stories, character stories).
// Quests are trackable objectives within arcs.
// Beats are the dramatic moments within quests.
//
// This allows:
// - Non-linear play (skip around the tree)
// - Parallel storylines (multiple active arcs)
// - Character-driven narratives (personal arcs)
// - Clear progress tracking (what's done, what's ahead)
//

// ============================================
// OBJECTIVE: The atomic unit of "what we want"
// ============================================

export const ObjectiveStatusSchema = z.enum([
  "unknown", // Players don't know this exists yet
  "revealed", // Players know about it
  "active", // Currently being pursued
  "completed", // Successfully achieved
  "failed", // Failed permanently
  "abandoned", // Gave up / no longer relevant
]);
export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

export const ObjectiveSchema = z.object({
  id: z.string().uuid(),

  // What
  title: z.string(),
  description: z.string().optional(),

  // Status
  status: ObjectiveStatusSchema.default("unknown"),

  // Completion criteria (for GM reference)
  successCondition: z.string().optional(),
  failureCondition: z.string().optional(),

  // When status changed
  revealedAt: z.string().uuid().optional(), // session_id
  completedAt: z.string().uuid().optional(), // session_id

  // Rewards (can be abstract or concrete)
  rewards: z
    .object({
      xp: z.number().int().optional(),
      gold: z.number().int().optional(),
      items: z.array(z.string()).optional(),
      reputation: z
        .array(
          z.object({
            faction: z.string(),
            change: z.number().int(),
          }),
        )
        .optional(),
      narrative: z.string().optional(), // "The king owes you a favor"
    })
    .optional(),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

// ============================================
// BEAT: Dramatic moment in the narrative
// ============================================

export const BeatTypeSchema = z.enum([
  // Story structure beats
  "hook", // The call to adventure
  "inciting", // Point of no return
  "rising", // Complications, obstacles
  "midpoint", // Major revelation or shift
  "escalation", // Stakes increase
  "crisis", // Low point, dark moment
  "climax", // Final confrontation
  "resolution", // Aftermath, denouement
  "cliffhanger", // Unresolved tension

  // Utility beats
  "milestone", // Achievement marker
  "twist", // Unexpected revelation
  "discovery", // Information gained
  "encounter", // Combat or social challenge
  "transition", // Travel, time skip
  "downtime", // Rest, crafting, training
]);
export type BeatType = z.infer<typeof BeatTypeSchema>;

export const BeatStatusSchema = z.enum([
  "planned", // GM has it ready
  "foreshadowed", // Hints dropped
  "active", // Currently happening
  "occurred", // Completed
  "skipped", // Players bypassed it
  "modified", // Changed from original plan
]);
export type BeatStatus = z.infer<typeof BeatStatusSchema>;

export const BeatSchema = z.object({
  id: z.string().uuid(),
  questId: z.string().uuid(),

  // Identity
  name: z.string(),
  description: z.string().optional(),

  // Narrative structure
  beatType: BeatTypeSchema,
  order: z.number().int().default(0), // sequence within quest

  // Status
  status: BeatStatusSchema.default("planned"),

  // When it happened
  occurredInSession: z.string().uuid().optional(),
  worldDate: z.string().optional(),

  // Trigger conditions (when does this beat fire?)
  triggers: z
    .array(
      z.object({
        type: z.enum([
          "location",
          "npc_interaction",
          "item",
          "time",
          "quest_complete",
          "manual",
        ]),
        value: z.string(), // location_id, npc_id, item_id, date, quest_id
        description: z.string().optional(),
      }),
    )
    .default([]),

  // What happens (GM notes)
  content: z
    .object({
      readAloud: z.string().optional(), // Text to read to players
      gmNotes: z.string().optional(), // Private GM notes
      npcsInvolved: z.array(z.string().uuid()).default([]),
      locationsInvolved: z.array(z.string().uuid()).default([]),
      combatEncounter: z.string().uuid().optional(), // links to encounter
    })
    .optional(),

  // Outcomes
  outcomes: z
    .object({
      knowledgeRevealed: z.array(z.string()).default([]), // facts the party learns
      secretsRevealed: z.array(z.string().uuid()).default([]), // secret_ids
      questsUnlocked: z.array(z.string().uuid()).default([]),
      questsCompleted: z.array(z.string().uuid()).default([]),
      stateChanges: z
        .array(
          z.object({
            entityId: z.string().uuid(),
            change: z.string(), // "disposition +10", "status: dead", etc.
          }),
        )
        .default([]),
    })
    .optional(),

  // For alternate paths
  alternatives: z
    .array(
      z.object({
        condition: z.string(), // "If players kill instead of capture"
        outcome: z.string(), // What happens instead
      }),
    )
    .default([]),
});
export type Beat = z.infer<typeof BeatSchema>;

// ============================================
// QUEST: A trackable objective with structure
// ============================================

export const QuestTypeSchema = z.enum([
  "main", // Main storyline quest
  "side", // Optional side content
  "character", // Personal character quest
  "faction", // Faction-related quest
  "bounty", // Kill/capture target
  "fetch", // Retrieve item
  "escort", // Protect someone
  "exploration", // Discover location
  "mystery", // Solve puzzle/investigation
  "social", // Navigate social situation
]);
export type QuestType = z.infer<typeof QuestTypeSchema>;

export const QuestSchema = z.object({
  id: z.string().uuid(),
  arcId: z.string().uuid(),

  // Identity
  name: z.string(),
  description: z.string().optional(),
  questType: QuestTypeSchema.default("side"),

  // Objective (what we're trying to do)
  objective: ObjectiveSchema,

  // Sub-objectives (optional checklist)
  subObjectives: z.array(ObjectiveSchema).default([]),

  // The beats (dramatic structure)
  // Stored separately, linked by questId

  // Quest giver
  giverEntityId: z.string().uuid().optional(),
  giverName: z.string().optional(), // fallback if no entity

  // Prerequisites
  prerequisites: z
    .array(
      z.object({
        type: z.enum([
          "quest_complete",
          "level",
          "reputation",
          "item",
          "location_visited",
        ]),
        value: z.string(),
      }),
    )
    .default([]),

  // Availability
  availableFrom: z.string().optional(), // world date
  availableUntil: z.string().optional(), // world date (time-sensitive quests)

  // Player-facing
  isSecret: z.boolean().default(false), // GM knows, players don't (yet)
  journalEntry: z.string().optional(), // What appears in player's quest log

  // Metadata
  estimatedSessions: z.number().int().optional(),
  difficulty: z
    .enum(["trivial", "easy", "medium", "hard", "deadly"])
    .optional(),

  // Progress tracking
  startedInSession: z.string().uuid().optional(),
  completedInSession: z.string().uuid().optional(),

  // Tags for filtering
  tags: z.array(z.string()).default([]),
});
export type Quest = z.infer<typeof QuestSchema>;

// ============================================
// ARC: Major narrative chunk
// ============================================

export const ArcTypeSchema = z.enum([
  "main", // The main story
  "side", // Optional side story
  "character", // PC's personal story
  "faction", // Faction storyline
  "world", // World events happening in background
]);
export type ArcType = z.infer<typeof ArcTypeSchema>;

export const ArcStatusSchema = z.enum([
  "planned", // Not yet started
  "foreshadowed", // Hints dropped
  "active", // Currently in progress
  "paused", // On hold
  "completed", // Successfully concluded
  "failed", // Ended in failure
  "abandoned", // Dropped
]);
export type ArcStatus = z.infer<typeof ArcStatusSchema>;

export const ArcSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  description: z.string().optional(),
  arcType: ArcTypeSchema.default("side"),

  // Hierarchy (arcs can nest)
  parentArcId: z.string().uuid().optional(),
  order: z.number().int().default(0),

  // The big objective of this arc
  objective: ObjectiveSchema,

  // Status
  status: ArcStatusSchema.default("planned"),

  // Timeline (in-world)
  startsWorldDate: z.string().optional(),
  endsWorldDate: z.string().optional(),

  // For character arcs
  focusCharacterId: z.string().uuid().optional(), // which PC this is about

  // For faction arcs
  focusFactionId: z.string().uuid().optional(),

  // Visual
  color: z.string().optional(), // for timeline display
  icon: z.string().optional(), // emoji or icon name

  // Metadata
  synopsis: z.string().optional(), // GM's summary
  themes: z.array(z.string()).default([]), // "betrayal", "redemption", etc.

  // Tags
  tags: z.array(z.string()).default([]),
});
export type Arc = z.infer<typeof ArcSchema>;

// ============================================
// CAMPAIGN: The top-level container
// ============================================

export const ProgressionTypeSchema = z.enum([
  "xp", // Experience points
  "milestone", // Level at story beats
  "hybrid", // XP + milestone bonuses
]);
export type ProgressionType = z.infer<typeof ProgressionTypeSchema>;

export const CampaignStatusSchema = z.enum([
  "planning", // Not yet started
  "active", // Currently running
  "hiatus", // On break
  "completed", // Finished!
  "abandoned", // Dropped
]);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CampaignSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  slug: z.string().optional(), // URL-friendly name
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),

  // THE BIG OBJECTIVE
  // What is this whole campaign about?
  objective: ObjectiveSchema,

  // Setting
  setting: z.object({
    name: z.string().default("Homebrew"), // "Forgotten Realms", "Eberron", etc.
    region: z.string().optional(), // "Sword Coast", "Sharn", etc.
    startingLocation: z.string().optional(),
    era: z.string().optional(), // "1492 DR", "998 YK"
  }),

  // Time
  worldCalendar: z
    .enum(["gregorian", "harptos", "eberron", "custom"])
    .default("gregorian"),
  worldStartDate: z.string().optional(),
  worldCurrentDate: z.string().optional(),

  // Game system
  gameSystem: z.string().default("5e"), // "5e", "5e-2024", "pf2e", "homebrew"
  systemConfig: z.record(z.unknown()).default({}),

  // Progression
  progression: z.object({
    type: ProgressionTypeSchema.default("milestone"),
    startingLevel: z.number().int().min(1).max(20).default(1),
    currentLevel: z.number().int().min(1).max(20).default(1),
    maxLevel: z.number().int().min(1).max(20).default(20),

    // XP tracking (if type is 'xp' or 'hybrid')
    totalXpAwarded: z.number().int().default(0),

    // Milestone definitions
    milestones: z
      .array(
        z.object({
          level: z.number().int(),
          trigger: z.string(), // "Complete Chapter 1", "Defeat Strahd"
          reached: z.boolean().default(false),
          reachedInSession: z.string().uuid().optional(),
        }),
      )
      .default([]),
  }),

  // Status
  status: CampaignStatusSchema.default("planning"),

  // Ownership
  ownerId: z.string().uuid(), // GM's user ID

  // Players (stored in separate campaign_members table, just count here)
  playerCount: z.number().int().default(0),

  // Schedule
  typicalSessionLength: z.number().int().optional(), // hours
  typicalSessionDay: z.string().optional(), // "Saturday"

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),

  // Tags
  tags: z.array(z.string()).default([]),

  // Tone/themes (helps AI understand the campaign)
  tone: z
    .object({
      seriousness: z
        .enum(["comedic", "light", "balanced", "serious", "grimdark"])
        .default("balanced"),
      combat: z
        .enum(["minimal", "light", "balanced", "heavy", "constant"])
        .default("balanced"),
      roleplay: z
        .enum(["minimal", "light", "balanced", "heavy", "constant"])
        .default("balanced"),
      exploration: z
        .enum(["minimal", "light", "balanced", "heavy", "constant"])
        .default("balanced"),
      themes: z.array(z.string()).default([]), // "political intrigue", "dungeon crawl", etc.
    })
    .optional(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// ============================================
// SESSION: When we played (temporal layer)
// ============================================

export const SessionStatusSchema = z.enum([
  "planned", // Scheduled but not played
  "in_progress", // Currently playing
  "completed", // Finished
  "cancelled", // Didn't happen
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  number: z.number().int().positive(),
  title: z.string().optional(), // "The Sewers of Waterdeep"

  // Real-world time
  scheduledFor: z.date().optional(),
  startedAt: z.date().optional(),
  endedAt: z.date().optional(),
  durationMinutes: z.number().int().optional(),

  // In-world time
  worldDateStart: z.string().optional(),
  worldDateEnd: z.string().optional(),

  // Status
  status: SessionStatusSchema.default("planned"),

  // Attendance
  playersPresent: z.array(z.string().uuid()).default([]),
  playersAbsent: z.array(z.string().uuid()).default([]),

  // Narrative touchpoints
  // What arcs/quests/beats were touched this session
  arcsActive: z.array(z.string().uuid()).default([]),
  questsProgressed: z.array(z.string().uuid()).default([]),
  beatsOccurred: z.array(z.string().uuid()).default([]),

  // Content
  prepNotes: z.string().optional(), // GM's prep
  summary: z.string().optional(), // What happened (post-session)
  highlights: z.array(z.string()).default([]), // Key moments

  // Rewards given
  xpAwarded: z.number().int().default(0),
  goldAwarded: z.number().int().default(0),
  itemsAwarded: z.array(z.string()).default([]),

  // Audio/transcript
  recordingUrl: z.string().url().optional(),
  transcriptId: z.string().uuid().optional(),

  // Cliffhanger (for next session hook)
  cliffhanger: z.string().optional(),
  nextSessionHooks: z.array(z.string()).default([]),

  // Tags
  tags: z.array(z.string()).default([]),
});
export type Session = z.infer<typeof SessionSchema>;

// ============================================
// TIMELINE ENTRY: Unified view for display
// ============================================

export const TimelineEntryTypeSchema = z.enum([
  "campaign_start",
  "campaign_end",
  "arc_start",
  "arc_end",
  "quest_start",
  "quest_complete",
  "beat",
  "session",
  "milestone",
  "level_up",
  "major_event",
  "pc_death",
  "pc_join",
  "pc_leave",
]);
export type TimelineEntryType = z.infer<typeof TimelineEntryTypeSchema>;

export const TimelineEntrySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // What
  entryType: TimelineEntryTypeSchema,
  referenceId: z.string().uuid(), // points to the actual record

  // Display
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),

  // Time (for sorting)
  worldDate: z.string().optional(),
  realDate: z.date().optional(),
  sortOrder: z.number().int().default(0),

  // Hierarchy (for nested display)
  parentEntryId: z.string().uuid().optional(),
  depth: z.number().int().default(0),

  // Visibility
  visibleToPlayers: z.boolean().default(true),

  // Links (what this entry connects)
  linkedArcs: z.array(z.string().uuid()).default([]),
  linkedQuests: z.array(z.string().uuid()).default([]),
  linkedSessions: z.array(z.string().uuid()).default([]),
  linkedEntities: z.array(z.string().uuid()).default([]),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

// ============================================
// HELPER: Build timeline from campaign data
// ============================================

export interface TimelineFilter {
  arcIds?: string[];
  questIds?: string[];
  entryTypes?: TimelineEntryType[];
  fromWorldDate?: string;
  toWorldDate?: string;
  includeHidden?: boolean;
}

export interface TimelineNode {
  entry: TimelineEntry;
  children: TimelineNode[];
}

// This would be implemented as a function that queries all the data
// and builds a unified timeline view
export function buildTimelineQuery(
  campaignId: string,
  filter?: TimelineFilter,
): {
  // Returns a structured tree of timeline entries
  // with arcs containing quests containing beats
  // overlaid with sessions
} {
  // Implementation would:
  // 1. Fetch all arcs for campaign
  // 2. Fetch all quests for those arcs
  // 3. Fetch all beats for those quests
  // 4. Fetch all sessions for campaign
  // 5. Build unified timeline entries
  // 6. Sort by worldDate or sortOrder
  // 7. Build tree structure
  // 8. Apply filters

  throw new Error("Not implemented - needs database queries");
}

// ============================================
// HELPER: Calculate campaign progress
// ============================================

export interface CampaignProgress {
  // Overall
  overallPercent: number;

  // By arc
  arcs: {
    total: number;
    completed: number;
    active: number;
  };

  // By quest
  quests: {
    total: number;
    completed: number;
    active: number;
    available: number;
    hidden: number;
  };

  // By beat (for active quests)
  currentQuestProgress: {
    questId: string;
    questName: string;
    totalBeats: number;
    completedBeats: number;
    currentBeat?: string;
  }[];

  // Sessions
  sessionsPlayed: number;
  totalPlayTime: number; // minutes
}

export function calculateProgress(
  campaign: Campaign,
  arcs: Arc[],
  quests: Quest[],
  beats: Beat[],
  sessions: Session[],
): CampaignProgress {
  const completedArcs = arcs.filter((a) => a.status === "completed").length;
  const completedQuests = quests.filter(
    (q) => q.objective.status === "completed",
  ).length;

  const activeQuests = quests.filter((q) => q.objective.status === "active");
  const questProgress = activeQuests.map((q) => {
    const questBeats = beats.filter((b) => b.questId === q.id);
    const completedBeats = questBeats.filter(
      (b) => b.status === "occurred",
    ).length;
    const currentBeat = questBeats.find((b) => b.status === "active");

    return {
      questId: q.id,
      questName: q.name,
      totalBeats: questBeats.length,
      completedBeats,
      currentBeat: currentBeat?.name,
    };
  });

  const totalPlayTime = sessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  return {
    overallPercent:
      campaign.objective.status === "completed"
        ? 100
        : Math.round((completedQuests / Math.max(quests.length, 1)) * 100),
    arcs: {
      total: arcs.length,
      completed: completedArcs,
      active: arcs.filter((a) => a.status === "active").length,
    },
    quests: {
      total: quests.length,
      completed: completedQuests,
      active: activeQuests.length,
      available: quests.filter((q) => q.objective.status === "revealed").length,
      hidden: quests.filter((q) => q.isSecret).length,
    },
    currentQuestProgress: questProgress,
    sessionsPlayed: sessions.filter((s) => s.status === "completed").length,
    totalPlayTime,
  };
}
