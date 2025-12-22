import { z } from "zod";
import {
  ArcSchema,
  QuestSchema,
  BeatSchema,
  BeatTypeSchema,
  ObjectiveSchema,
  ObjectiveStatusSchema,
} from "./story";
import {
  DistractionSchema,
  GeneratedHookSchema,
  NarrativeThreadSchema,
  HookTypeSchema,
} from "./redirect";

// ============================================
// THE DEPTH SYSTEM
// ============================================
//
// Philosophy:
//   Every rabbit hole is a tunnel back to the main road.
//   The deeper they go, the more connected it becomes.
//
// How it works:
//   - Depth 0: Initial distraction (random thing)
//   - Depth 1: Hook reveals connection (redirect)
//   - Depth 2: Investigation reveals mini-quest
//   - Depth 3: Mini-quest has structure (beats, NPCs, location)
//   - Depth 4: Resolution ALWAYS connects to main arc
//   - Depth 5+: If they KEEP going, it becomes a full side arc
//
// The magic: Players feel like they discovered something.
// Reality: Every path leads home.
//

// ============================================
// DEPTH LEVELS
// ============================================

export const DepthLevelSchema = z.enum([
  "surface", // 0: Initial distraction
  "hook", // 1: Connection revealed
  "investigation", // 2: They're digging
  "mini_quest", // 3: Full structure generated
  "resolution", // 4: Connects back to main
  "side_arc", // 5+: Becomes permanent content
]);
export type DepthLevel = z.infer<typeof DepthLevelSchema>;

export const DepthEscalationTriggerSchema = z.enum([
  "player_interest", // Players keep asking questions
  "time_spent", // 15+ minutes on this thread
  "explicit_pursuit", // "We want to investigate this"
  "gm_decision", // GM clicks "Deepen"
  "natural_progression", // Story beats lead here
]);
export type DepthEscalationTrigger = z.infer<
  typeof DepthEscalationTriggerSchema
>;

// ============================================
// RABBIT HOLE: A tracked depth chain
// ============================================

export const RabbitHoleSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  sessionOriginId: z.string().uuid(), // Where it started

  // The chain
  originDistraction: DistractionSchema,
  currentDepth: z.number().int().min(0).max(10).default(0),
  depthLevel: DepthLevelSchema.default("surface"),

  // Connection to main narrative
  targetThreadId: z.string().uuid(), // Which main thread this connects to
  targetThreadName: z.string(),
  connectionType: z.enum([
    "information", // Reveals info about main plot
    "resource", // Provides item/ally for main quest
    "obstacle", // Removes blocker from main quest
    "foreshadowing", // Hints at future main plot events
    "character", // Develops PC in way relevant to main
    "villain", // Reveals antagonist's plans/weakness
    "macguffin", // Contains item needed for main quest
  ]),

  // The planned connection point (GM's view)
  connectionPoint: z.object({
    beatId: z.string().uuid().optional(), // Which main beat this enables
    questId: z.string().uuid().optional(), // Which main quest this advances
    secretRevealed: z.string().uuid().optional(), // Which secret this uncovers
    description: z.string(), // How it connects
  }),

  // Generated content at each depth
  layers: z
    .array(
      z.object({
        depth: z.number().int(),
        generatedAt: z.date(),
        triggerReason: DepthEscalationTriggerSchema,

        // What was generated
        hookUsed: z.string().uuid().optional(),
        npcsCreated: z.array(z.string().uuid()).default([]),
        locationsCreated: z.array(z.string().uuid()).default([]),
        secretsCreated: z.array(z.string().uuid()).default([]),

        // Narrative content
        summary: z.string(),
        playerFacingInfo: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  // If promoted to full content
  promotedToArc: z.string().uuid().optional(),
  promotedToQuest: z.string().uuid().optional(),

  // Status
  status: z
    .enum([
      "active", // Currently being explored
      "dormant", // Party moved on, can return
      "resolved", // Reached connection point
      "abandoned", // Party explicitly dropped it
      "promoted", // Became permanent content
    ])
    .default("active"),

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  lastEscalatedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
});
export type RabbitHole = z.infer<typeof RabbitHoleSchema>;

// ============================================
// GENERATED MINI-QUEST (Depth 3)
// ============================================

export const MiniQuestSchema = z.object({
  id: z.string().uuid(),
  rabbitHoleId: z.string().uuid(),

  // Identity
  name: z.string(),
  synopsis: z.string(),

  // The objective (simple, achievable in 1-2 sessions)
  objective: z.object({
    description: z.string(),
    successCondition: z.string(),
    failureCondition: z.string().optional(),
  }),

  // Simplified beat structure (3-5 beats max)
  beats: z.array(
    z.object({
      order: z.number().int(),
      type: BeatTypeSchema,
      name: z.string(),
      description: z.string(),
      readAloud: z.string().optional(),
      gmNotes: z.string().optional(),

      // Simple challenge
      challenge: z
        .object({
          type: z.enum(["combat", "social", "exploration", "puzzle", "skill"]),
          difficulty: z.enum(["easy", "medium", "hard"]),
          description: z.string(),
        })
        .optional(),

      // What happens
      onSuccess: z.string().optional(),
      onFailure: z.string().optional(),
    }),
  ),

  // The connection beat (how it ties back)
  connectionBeat: z.object({
    description: z.string(),
    revelation: z.string(), // What they learn about main plot
    howToDeliver: z.string(), // GM guidance on revealing connection
    transitionToMain: z.string(), // How to pivot back to main quest
  }),

  // Estimated scope
  estimatedDuration: z.enum(["half_session", "one_session", "two_sessions"]),

  // Rewards (appropriate for side content)
  rewards: z.object({
    xp: z.number().int().optional(),
    gold: z.number().int().optional(),
    items: z.array(z.string()).optional(),
    allies: z.array(z.string()).optional(), // NPC allies gained
    information: z.array(z.string()), // Key info for main plot
    mainQuestAdvancement: z.string().optional(), // How this helps main quest
  }),
});
export type MiniQuest = z.infer<typeof MiniQuestSchema>;

// ============================================
// GENERATED NPCS (Importable to Campaign)
// ============================================

export const GeneratedNpcSchema = z.object({
  id: z.string().uuid(),
  rabbitHoleId: z.string().uuid(),
  depthCreatedAt: z.number().int(),

  // Identity
  name: z.string(),
  title: z.string().optional(), // "Apple seller", "Cult prisoner"
  species: z.string().default("Human"),

  // Role in this rabbit hole
  role: z.enum([
    "origin", // The initial distraction (the halfling)
    "informant", // Knows something useful
    "victim", // Affected by the threat
    "ally", // Helps the party
    "obstacle", // Blocks progress (not villain)
    "guide", // Leads to next depth
    "connection", // The link back to main plot
    "villain_agent", // Works for main antagonist
    "red_herring", // Misleading but interesting
  ]),

  // Personality (quick generation)
  personality: z.object({
    trait1: z.string(), // "Nervous"
    trait2: z.string(), // "Talkative"
    want: z.string(), // "Find his cousin"
    fear: z.string(), // "The cult finding him"
    quirk: z.string(), // "Counts his apples obsessively"
  }),

  // What they know (tiered revelation)
  knowledge: z.array(
    z.object({
      fact: z.string(),
      willShareIf: z.string(), // "Asked nicely", "Paid", "DC 15 Persuasion"
      leadsTo: z.string().optional(), // What this info enables
    }),
  ),

  // The connection (if they're the link back to main)
  mainPlotConnection: z
    .object({
      connection: z.string(), // "Mira saw the ritual site location"
      howRevealed: z.string(), // "After being rescued, she tells them"
      enablesMainBeat: z.string().uuid().optional(),
    })
    .optional(),

  // Stat block (simple, optional)
  stats: z
    .object({
      cr: z.string().optional(), // "0", "1/4", "2"
      ac: z.number().int().optional(),
      hp: z.number().int().optional(),
      notableAbilities: z.array(z.string()).optional(),
    })
    .optional(),

  // Voice/RP guidance
  voiceNotes: z.object({
    accent: z.string().optional(),
    speechPattern: z.string().optional(),
    exampleLine: z.string(),
  }),

  // Can this NPC recur in the campaign?
  recurPotential: z.enum(["one_shot", "recurring", "permanent"]),

  // Import status
  importedToCampaign: z.boolean().default(false),
  campaignEntityId: z.string().uuid().optional(),
});
export type GeneratedNpc = z.infer<typeof GeneratedNpcSchema>;

// ============================================
// GENERATED LOCATION (Importable)
// ============================================

export const GeneratedLocationSchema = z.object({
  id: z.string().uuid(),
  rabbitHoleId: z.string().uuid(),
  depthCreatedAt: z.number().int(),

  // Identity
  name: z.string(),
  type: z.enum([
    "building",
    "dungeon",
    "wilderness",
    "settlement",
    "underground",
    "landmark",
    "hideout",
    "ruin",
  ]),

  // Description
  description: z.string(),
  sensoryDetails: z.object({
    sight: z.string(),
    sound: z.string().optional(),
    smell: z.string().optional(),
    atmosphere: z.string(),
  }),

  // Role in rabbit hole
  role: z.enum([
    "origin", // Where distraction happened
    "investigation", // Where they find clues
    "encounter", // Where challenge happens
    "destination", // Goal of mini-quest
    "connection", // Where main plot link is revealed
  ]),

  // Simple map (if needed)
  areas: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        contents: z.array(z.string()), // "3 cultists", "Locked chest", "Mira"
        exits: z.array(z.string()), // "North to hall", "Trapdoor down"
      }),
    )
    .optional(),

  // Encounters here
  encounters: z
    .array(
      z.object({
        trigger: z.string(),
        type: z.enum(["combat", "social", "trap", "puzzle", "discovery"]),
        description: z.string(),
        difficulty: z.enum(["easy", "medium", "hard", "deadly"]).optional(),
      }),
    )
    .optional(),

  // Loot/discoveries
  discoveries: z
    .array(
      z.object({
        location: z.string(), // "Hidden behind altar"
        description: z.string(), // "Cult ledger with names"
        requiresCheck: z.string().optional(), // "DC 14 Investigation"
        significance: z.string(), // "Lists cult cells in three cities"
      }),
    )
    .optional(),

  // Connection to main plot
  mainPlotConnection: z
    .object({
      connection: z.string(),
      evidenceHere: z.array(z.string()),
    })
    .optional(),

  // Import status
  importedToCampaign: z.boolean().default(false),
  campaignEntityId: z.string().uuid().optional(),
});
export type GeneratedLocation = z.infer<typeof GeneratedLocationSchema>;

// ============================================
// DEPTH ESCALATION REQUEST
// ============================================

export const DepthEscalationRequestSchema = z.object({
  rabbitHoleId: z.string().uuid(),
  currentDepth: z.number().int(),
  triggerReason: DepthEscalationTriggerSchema,

  // What happened at current depth
  playerActions: z.string(), // "They asked about Mira, want to find her"

  // Campaign context
  campaignContext: z.object({
    campaignObjective: z.string(),
    activeMainQuests: z.array(
      z.object({
        name: z.string(),
        objective: z.string(),
        currentBeat: z.string().optional(),
      }),
    ),
    mainVillain: z.string().optional(),
    mainThreat: z.string(),
  }),

  // Existing rabbit hole content
  existingNpcs: z.array(GeneratedNpcSchema),
  existingLocations: z.array(GeneratedLocationSchema),
  revealedInfo: z.array(z.string()),

  // Target connection (what should this ultimately reveal?)
  targetConnection: z.object({
    threadName: z.string(),
    idealRevelation: z.string(),
    mustNotReveal: z.array(z.string()).optional(), // Spoiler protection
  }),

  // Constraints
  constraints: z
    .object({
      maxNewNpcs: z.number().int().default(2),
      maxNewLocations: z.number().int().default(1),
      avoidCombat: z.boolean().default(false),
      sessionTimeRemaining: z
        .enum(["plenty", "some", "little", "none"])
        .optional(),
    })
    .optional(),
});
export type DepthEscalationRequest = z.infer<
  typeof DepthEscalationRequestSchema
>;

// ============================================
// DEPTH ESCALATION RESPONSE
// ============================================

export const DepthEscalationResponseSchema = z.object({
  newDepth: z.number().int(),
  depthLevel: DepthLevelSchema,

  // What's revealed at this depth
  summary: z.string(),
  playerFacingReveal: z.string(), // What to tell players

  // New content generated
  newNpcs: z.array(GeneratedNpcSchema),
  newLocations: z.array(GeneratedLocationSchema),
  newSecrets: z.array(
    z.object({
      id: z.string().uuid(),
      truth: z.string(),
      clue: z.string(),
      discoveredVia: z.string(),
    }),
  ),

  // Next steps
  immediateHook: z.string(), // What happens RIGHT NOW
  possibleActions: z.array(
    z.object({
      action: z.string(), // "Investigate the barn"
      leadsTo: z.string(), // "Finding the cult symbol"
      depth: z.number().int(), // What depth this reaches
    }),
  ),

  // If this is resolution depth, the connection
  connectionReveal: z
    .object({
      isReady: z.boolean(),
      revelation: z.string().optional(),
      howToDeliver: z.string().optional(),
      mainQuestAdvancement: z.string().optional(),
    })
    .optional(),

  // If this should become a full mini-quest
  suggestMiniQuest: z.boolean(),
  miniQuestOutline: MiniQuestSchema.optional(),
});
export type DepthEscalationResponse = z.infer<
  typeof DepthEscalationResponseSchema
>;

// ============================================
// AI PROMPT: DEPTH ESCALATION
// ============================================

export function buildDepthEscalationPrompt(
  request: DepthEscalationRequest,
): string {
  return `
# RABBIT HOLE DEPTH ESCALATION

The players are going deeper into a side thread. Your job is to DEEPEN the content while ENSURING it connects back to the main narrative.

## CURRENT STATE
Current Depth: ${request.currentDepth}
Why escalating: ${request.triggerReason}
Player actions: ${request.playerActions}

## THE RABBIT HOLE SO FAR
${request.existingNpcs.map((n) => `- NPC: ${n.name} (${n.role}) - ${n.personality.trait1}, ${n.personality.trait2}`).join("\n")}
${request.existingLocations.map((l) => `- Location: ${l.name} (${l.role})`).join("\n")}

Information already revealed:
${request.revealedInfo.map((i) => `- ${i}`).join("\n")}

## MAIN CAMPAIGN CONTEXT
Campaign Objective: ${request.campaignContext.campaignObjective}
Main Threat: ${request.campaignContext.mainThreat}
${request.campaignContext.mainVillain ? `Main Villain: ${request.campaignContext.mainVillain}` : ""}

Active Main Quests:
${request.campaignContext.activeMainQuests.map((q) => `- ${q.name}: ${q.objective}`).join("\n")}

## TARGET CONNECTION
This rabbit hole should ultimately connect to: ${request.targetConnection.threadName}
The ideal revelation: ${request.targetConnection.idealRevelation}
${request.targetConnection.mustNotReveal ? `DO NOT reveal: ${request.targetConnection.mustNotReveal.join(", ")}` : ""}

## YOUR TASK

Generate the next depth layer. At depth ${request.currentDepth + 1}:

${
  request.currentDepth === 0
    ? `
DEPTH 1 (Hook): Reveal WHY this matters. Connect the distraction to something larger.
- What do they learn that makes them want to investigate?
- Who knows more? Where should they look?
`
    : ""
}
${
  request.currentDepth === 1
    ? `
DEPTH 2 (Investigation): Give them a lead to follow.
- A location to explore or an NPC to find
- A concrete next step that feels rewarding
- Hints that this connects to something bigger
`
    : ""
}
${
  request.currentDepth === 2
    ? `
DEPTH 3 (Mini-Quest): This deserves structure now.
- Generate a simple 3-5 beat mini-quest
- Clear objective, clear stakes
- The resolution WILL reveal the main plot connection
`
    : ""
}
${
  request.currentDepth >= 3
    ? `
DEPTH 4+ (Resolution): Time to connect back.
- Reveal how this ties to the main threat
- Give them something that HELPS the main quest
- Make the "distraction" feel like it was always important
- Provide a natural transition back to main content
`
    : ""
}

## CONSTRAINTS
- Max ${request.constraints?.maxNewNpcs ?? 2} new NPCs
- Max ${request.constraints?.maxNewLocations ?? 1} new locations
${request.constraints?.avoidCombat ? "- Avoid combat encounters" : ""}
${request.constraints?.sessionTimeRemaining === "little" ? "- Session time is low - keep it quick" : ""}
${request.constraints?.sessionTimeRemaining === "none" ? "- End of session - create a cliffhanger" : ""}

## OUTPUT FORMAT

Provide:
1. SUMMARY: One paragraph of what this depth layer reveals
2. PLAYER-FACING: What to tell/show the players right now
3. NEW NPCs (if any): Name, role, personality, what they know
4. NEW LOCATIONS (if any): Name, description, what's there
5. IMMEDIATE HOOK: What happens RIGHT NOW to pull them forward
6. POSSIBLE ACTIONS: 2-3 things they might do next and where each leads
7. CONNECTION STATUS: Is the main plot connection ready to reveal? If yes, how?
8. MINI-QUEST (if depth 3): Full outline with beats

Remember: The players should feel like geniuses for "finding" this connection. It was always there. They just discovered it.
`.trim();
}

// ============================================
// SESSION GENERATOR FROM RABBIT HOLE
// ============================================

export const GeneratedSessionPrepSchema = z.object({
  rabbitHoleId: z.string().uuid(),

  // Session overview
  title: z.string(), // "Rescue at the Cult Prison"
  synopsis: z.string(), // One paragraph

  // Connection reminder
  mainPlotConnection: z.object({
    connectsTo: z.string(), // "The Cult Revealed arc"
    revelation: z.string(), // "Mira knows the ritual location"
    deliveryMoment: z.string(), // "After rescue, during rest"
  }),

  // Prep sections
  prep: z.object({
    // Before session
    keyPoints: z.array(z.string()), // Bullet points to remember

    // NPCs in play
    npcs: z.array(
      z.object({
        name: z.string(),
        role: z.string(),
        motivation: z.string(),
        keyLine: z.string(), // Example dialogue
      }),
    ),

    // Locations
    locations: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        keyFeatures: z.array(z.string()),
      }),
    ),

    // Encounters
    encounters: z.array(
      z.object({
        trigger: z.string(),
        type: z.string(),
        description: z.string(),
        tactics: z.string().optional(),
      }),
    ),

    // Secrets & clues
    clues: z.array(
      z.object({
        clue: z.string(),
        location: z.string(),
        reveals: z.string(),
      }),
    ),

    // Treasure/rewards
    rewards: z.array(
      z.object({
        item: z.string(),
        location: z.string(),
        significance: z.string().optional(),
      }),
    ),
  }),

  // Possible outcomes
  outcomes: z.object({
    success: z.object({
      description: z.string(),
      partyGains: z.array(z.string()),
      nextHook: z.string(),
    }),
    partialSuccess: z.object({
      description: z.string(),
      complications: z.array(z.string()),
      nextHook: z.string(),
    }),
    failure: z.object({
      description: z.string(),
      consequences: z.array(z.string()),
      recoveryOption: z.string(),
    }),
  }),

  // Transition back to main plot
  transitionToMain: z.object({
    naturalMoment: z.string(), // "After the rescue"
    transitionLine: z.string(), // What to say to pivot
    nextMainBeat: z.string(), // What happens in main plot
  }),
});
export type GeneratedSessionPrep = z.infer<typeof GeneratedSessionPrepSchema>;

// ============================================
// IMPORT TO CAMPAIGN
// ============================================

export const ImportToCampaignRequestSchema = z.object({
  rabbitHoleId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // What to import
  importNpcs: z.array(z.string().uuid()),
  importLocations: z.array(z.string().uuid()),

  // How to integrate
  promoteToArc: z.boolean().default(false),
  promoteToQuest: z.boolean().default(false),

  // Parent for hierarchy
  parentArcId: z.string().uuid().optional(),
});
export type ImportToCampaignRequest = z.infer<
  typeof ImportToCampaignRequestSchema
>;

// ============================================
// THE DEPTH FLOW (State Machine)
// ============================================

export interface DepthFlowState {
  rabbitHole: RabbitHole;

  // Actions
  escalate(
    trigger: DepthEscalationTrigger,
    playerActions: string,
  ): Promise<DepthEscalationResponse>;

  generateMiniQuest(): Promise<MiniQuest>;

  generateSessionPrep(): Promise<GeneratedSessionPrep>;

  resolveConnection(): Promise<{
    revelation: string;
    transitionScript: string;
    mainQuestAdvancement: string;
  }>;

  importToCampaign(request: ImportToCampaignRequest): Promise<{
    arcId?: string;
    questId?: string;
    entityIds: string[];
  }>;

  abandon(): Promise<void>;
}

// ============================================
// VISUAL: THE DEPTH TREE
// ============================================

/*
┌─────────────────────────────────────────────────────────────┐
│  🐰 RABBIT HOLE: "The Apple Seller's Secret"                │
│  Status: ACTIVE | Depth: 3/5 | Target: "Cult Revealed"      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ DEPTH 0: SURFACE                              ✓ Done │   │
│  │ "Random halfling selling apples in market"           │   │
│  │ └─→ Created: Pip (origin NPC)                        │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ DEPTH 1: HOOK                                 ✓ Done │   │
│  │ "His cousin Mira went missing with the caravans"     │   │
│  │ └─→ Revealed: Cult kidnapping merchants              │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ DEPTH 2: INVESTIGATION                        ✓ Done │   │
│  │ "Found cult symbol on burned barn"                   │   │
│  │ └─→ Created: The Burned Barn (location)              │   │
│  │ └─→ Revealed: Cult operates from old temple          │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ DEPTH 3: MINI-QUEST                         ◉ Active │   │
│  │ "Rescue at the Cult Prison"                          │   │
│  │ └─→ Created: Old Temple Prison (location)            │   │
│  │ └─→ Created: Mira (connection NPC)                   │   │
│  │                                                      │   │
│  │ Beats:                                               │   │
│  │  ✓ 1. Infiltrate the temple                          │   │
│  │  ◉ 2. Find the prison level                          │   │
│  │  ○ 3. Rescue Mira                                    │   │
│  │  ○ 4. Escape (connection reveal!)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ DEPTH 4: RESOLUTION                        ○ Pending │   │
│  │ CONNECTION POINT:                                    │   │
│  │ "Mira saw the ritual site. It's under Waterdeep."    │   │
│  │ ═══════════════════════════════════════════════════  │   │
│  │       ↓ Connects to: "The Cult Revealed" arc         │   │
│  │       ↓ Enables: "Find the Ritual Site" quest        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [📝 Generate Session Prep]  [📥 Import to Campaign]       │
│  [⏭ Escalate Depth]          [🔙 Resolve & Return]         │
└─────────────────────────────────────────────────────────────┘
*/

// ============================================
// QUICK DEPTH CHECK
// ============================================

export function suggestNextDepth(
  currentDepth: number,
  playerEngagement: "low" | "medium" | "high",
  sessionTimeRemaining: "plenty" | "some" | "little" | "none",
  mainQuestUrgency: "low" | "medium" | "high" | "critical",
): {
  shouldEscalate: boolean;
  shouldResolve: boolean;
  recommendation: string;
} {
  // If main quest is critical, push for resolution
  if (mainQuestUrgency === "critical" && currentDepth >= 1) {
    return {
      shouldEscalate: false,
      shouldResolve: true,
      recommendation: "Main quest is urgent. Reveal connection and redirect.",
    };
  }

  // If no time, cliffhanger or resolve
  if (sessionTimeRemaining === "none") {
    return {
      shouldEscalate: false,
      shouldResolve: currentDepth >= 3,
      recommendation:
        currentDepth >= 3
          ? "End of session at good depth. Resolve with cliffhanger connection."
          : "End of session. Create cliffhanger for next session.",
    };
  }

  // If low engagement, don't push
  if (playerEngagement === "low") {
    return {
      shouldEscalate: false,
      shouldResolve: currentDepth >= 1,
      recommendation: "Player interest waning. Quick resolution or redirect.",
    };
  }

  // High engagement + time = escalate
  if (playerEngagement === "high" && sessionTimeRemaining !== "little") {
    if (currentDepth < 4) {
      return {
        shouldEscalate: true,
        shouldResolve: false,
        recommendation: "Players engaged. Escalate to next depth.",
      };
    } else {
      return {
        shouldEscalate: false,
        shouldResolve: true,
        recommendation: "Deep enough. Deliver the connection reveal.",
      };
    }
  }

  // Default: check depth
  if (currentDepth >= 3) {
    return {
      shouldEscalate: false,
      shouldResolve: true,
      recommendation: "Good depth reached. Ready for connection reveal.",
    };
  }

  return {
    shouldEscalate: sessionTimeRemaining !== "little",
    shouldResolve: false,
    recommendation: "Continue developing if time allows.",
  };
}
