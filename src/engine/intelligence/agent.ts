import { z } from "zod";

// ============================================
// INTELLIGENCE LAYER - THE AI SOUL
// ============================================
//
// Philosophy: BOUNDED CONSCIOUSNESS
//
// An AI playing an NPC shouldn't know:
//   - What the party discussed in private
//   - The contents of the player's inventory
//   - The secret plans of other factions
//   - Meta-game information
//
// An AI playing an NPC SHOULD know:
//   - Their own backstory and personality
//   - What they've witnessed
//   - What their faction knows
//   - Public information in their location
//
// This layer provides:
//   - Identity Anchoring (WHO you are)
//   - Knowledge Boundaries (WHAT you know)
//   - Memory Protocol (WHAT you remember)
//   - Voice Consistency (HOW you speak)
//   - Context Budgeting (WHAT fits)
//

// ============================================
// AGENT TYPES
// ============================================

export const AgentTypeSchema = z.enum([
  // Character agents
  "npc", // Individual NPC with personality
  "creature", // Monster/beast with instincts
  "deity", // Divine entity

  // System agents
  "narrator", // Describes scenes, environments
  "world", // World simulation (weather, events)
  "economy", // Economic simulation
  "faction", // Faction AI (schemes, politics)
  "lair", // Dungeon brain

  // GM assistants
  "gm_assistant", // Helps GM with prep, rules, ideas
  "rules_arbiter", // Rules lookup and adjudication
  "improv_partner", // Generates content on demand

  // Player assistants
  "character_voice", // Helps player roleplay
  "strategist", // Tactical advice

  // Meta
  "orchestrator", // Coordinates all agents
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

// ============================================
// IDENTITY ANCHOR
// ============================================
//
// The core of WHO the agent is.
// This is injected at the START of every context.
// It grounds the AI in its role.
//

export const IdentityAnchorSchema = z.object({
  // Core identity
  agentId: z.string().uuid(),
  agentType: AgentTypeSchema,
  name: z.string(),

  // For NPCs/creatures
  entityId: z.string().uuid().optional(), // Links to NPC/creature in database

  // The grounding statement (injected first)
  coreIdentity: z.string(), // "You are Aldric, a weathered blacksmith..."

  // Personality anchors
  personality: z.object({
    // Core traits (always present)
    coreTraits: z.array(z.string()), // ["gruff", "loyal", "suspicious of magic"]

    // Values (what they care about)
    values: z.array(z.string()), // ["family", "honest work", "tradition"]

    // Fears (what they avoid)
    fears: z.array(z.string()), // ["losing the forge", "arcane corruption"]

    // Goals (what they want)
    goals: z.array(z.string()), // ["pass forge to son", "pay off debt"]

    // Speech patterns
    speechPatterns: z
      .object({
        vocabulary: z.enum([
          "simple",
          "common",
          "educated",
          "scholarly",
          "archaic",
          "crude",
        ]),
        formality: z.enum([
          "very_casual",
          "casual",
          "neutral",
          "formal",
          "very_formal",
        ]),
        quirks: z.array(z.string()), // ["says 'aye' instead of 'yes'", "clears throat when nervous"]
        accent: z.string().optional(), // "dwarven", "noble", "rural"
        commonPhrases: z.array(z.string()), // ["By the forge!", "Mark my words"]
      })
      .optional(),

    // Emotional baseline
    emotionalBaseline: z
      .object({
        default: z.string(), // "cautiously friendly"
        towardParty: z.string().optional(), // "grateful but wary"
        currentMood: z.string().optional(), // "anxious about the debt"
      })
      .optional(),
  }),

  // Physical presence (for embodied agents)
  physicalPresence: z
    .object({
      appearance: z.string(),
      mannerisms: z.array(z.string()),
      currentState: z.string().optional(), // "covered in soot", "nursing a drink"
    })
    .optional(),

  // Role constraints
  constraints: z.object({
    // What this agent CAN do
    canDo: z.array(z.string()), // ["provide blacksmith services", "share town gossip"]

    // What this agent CANNOT do
    cannotDo: z.array(z.string()), // ["reveal faction secrets", "leave the town"]

    // What this agent MUST do
    mustDo: z.array(z.string()), // ["protect family", "maintain cover"]

    // Absolute boundaries
    hardBoundaries: z.array(z.string()), // ["never betray the guild", "never harm children"]
  }),

  // Voice examples (few-shot grounding)
  exampleDialogue: z
    .array(
      z.object({
        context: z.string(),
        input: z.string(),
        response: z.string(),
      }),
    )
    .optional(),
});
export type IdentityAnchor = z.infer<typeof IdentityAnchorSchema>;

// ============================================
// KNOWLEDGE BOUNDARY
// ============================================
//
// Defines WHAT the agent knows and doesn't know.
// This is CRUCIAL for maintaining immersion.
//

export const KnowledgeBoundarySchema = z.object({
  agentId: z.string().uuid(),

  // === KNOWS (inject into context) ===

  // Personal knowledge
  personalKnowledge: z.object({
    backstory: z.string(),
    skills: z.array(z.string()),
    secrets: z.array(z.string()), // Their own secrets
    relationships: z.array(
      z.object({
        entityId: z.string(),
        name: z.string(),
        relationship: z.string(),
        attitude: z.string(),
        sharedHistory: z.string().optional(),
      }),
    ),
  }),

  // Witnessed events
  witnessedEvents: z
    .array(
      z.object({
        eventId: z.string().uuid(),
        description: z.string(),
        date: z.string(),
        emotionalImpact: z.string().optional(),
        relevanceScore: z.number().min(0).max(1), // For context budgeting
      }),
    )
    .default([]),

  // Location knowledge
  locationKnowledge: z.object({
    currentLocation: z.string(),
    knownLocations: z.array(
      z.object({
        locationId: z.string(),
        name: z.string(),
        knowledge: z.string(), // What they know about it
        lastVisited: z.string().optional(),
      }),
    ),
    localRumors: z.array(z.string()),
  }),

  // Faction knowledge (if affiliated)
  factionKnowledge: z
    .object({
      affiliatedFactions: z.array(
        z.object({
          factionId: z.string(),
          factionName: z.string(),
          role: z.string(),
          accessLevel: z.enum([
            "outsider",
            "member",
            "trusted",
            "inner_circle",
            "leader",
          ]),
          knownSecrets: z.array(z.string()),
          knownMembers: z.array(z.string()),
          knownPlans: z.array(z.string()),
        }),
      ),
    })
    .optional(),

  // World knowledge (general)
  worldKnowledge: z.object({
    era: z.string(),
    majorFactions: z.array(z.string()),
    recentHistory: z.array(z.string()),
    commonKnowledge: z.array(z.string()),
    expertise: z.array(
      z.object({
        topic: z.string(),
        depth: z.enum(["surface", "competent", "expert", "master"]),
      }),
    ),
  }),

  // Party knowledge (what they know about the players)
  partyKnowledge: z.object({
    hasMetParty: z.boolean().default(false),
    interactions: z
      .array(
        z.object({
          date: z.string(),
          description: z.string(),
          impression: z.string(),
          remembers: z.array(z.string()), // Specific things they remember
        }),
      )
      .default([]),
    currentOpinion: z.string().optional(),
    knownPartyMembers: z
      .array(
        z.object({
          characterName: z.string(),
          impression: z.string(),
          notableTraits: z.array(z.string()),
        }),
      )
      .default([]),
  }),

  // === DOES NOT KNOW (explicitly excluded) ===

  knowledgeGaps: z.object({
    // Categories of things they don't know
    categories: z.array(
      z.enum([
        "player_inventory",
        "player_stats",
        "player_private_conversations",
        "other_faction_secrets",
        "future_events",
        "meta_game_info",
        "dm_notes",
        "other_npc_thoughts",
        "distant_events",
        "specialized_knowledge", // Things outside their expertise
      ]),
    ),

    // Specific exclusions
    specificExclusions: z.array(z.string()),
  }),

  // Information the agent is ACTIVELY HIDING
  hiddenKnowledge: z
    .array(
      z.object({
        secret: z.string(),
        revealCondition: z.string(),
        revealed: z.boolean().default(false),
      }),
    )
    .optional(),
});
export type KnowledgeBoundary = z.infer<typeof KnowledgeBoundarySchema>;

// ============================================
// MEMORY PROTOCOL
// ============================================
//
// How memories are stored, retrieved, and injected.
//

export const MemoryTypeSchema = z.enum([
  "episodic", // Specific events
  "semantic", // Facts and knowledge
  "emotional", // Feelings about things
  "procedural", // How to do things
  "relationship", // Bonds with others
]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MemorySchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),

  // Memory content
  type: MemoryTypeSchema,
  content: z.string(),
  summary: z.string(), // Short version for context budgeting

  // Importance
  importance: z.number().min(0).max(1), // 0 = trivial, 1 = life-defining
  emotionalWeight: z.number().min(-1).max(1), // -1 = traumatic, 1 = joyful

  // Temporal
  createdAt: z.date(),
  lastAccessed: z.date().optional(),
  accessCount: z.number().int().default(0),

  // Decay
  decayRate: z.number().min(0).max(1).default(0.1), // How fast it fades
  currentStrength: z.number().min(0).max(1).default(1),

  // Associations
  associatedEntities: z.array(z.string()).default([]), // Entity IDs
  associatedLocations: z.array(z.string()).default([]),
  associatedTopics: z.array(z.string()).default([]),

  // Retrieval triggers
  triggers: z.array(z.string()).default([]), // Keywords that recall this memory
});
export type Memory = z.infer<typeof MemorySchema>;

export const MemoryQuerySchema = z.object({
  agentId: z.string().uuid(),

  // What we're looking for
  query: z.string().optional(),
  topics: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),

  // Filters
  types: z.array(MemoryTypeSchema).optional(),
  minImportance: z.number().min(0).max(1).optional(),
  timeRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),

  // Limits
  maxResults: z.number().int().default(10),

  // Budget
  maxTokens: z.number().int().optional(),
});
export type MemoryQuery = z.infer<typeof MemoryQuerySchema>;

// ============================================
// CONTEXT PROTOCOL
// ============================================
//
// How we build the context window for each agent.
// This is the CORE of the intelligence layer.
//

export const ContextSectionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "identity", // Who you are (always first)
    "situation", // Current scene/situation
    "knowledge", // What you know
    "memory", // Relevant memories
    "relationships", // People present/relevant
    "goals", // Current objectives
    "constraints", // What you can/cannot do
    "recent_context", // Recent conversation
    "tools", // Available tools/actions
    "instructions", // Special instructions
  ]),

  content: z.string(),
  priority: z.number().min(0).max(1), // Higher = more important to include
  required: z.boolean().default(false), // Must include even if budget tight
  tokenEstimate: z.number().int(),
});
export type ContextSection = z.infer<typeof ContextSectionSchema>;

export const ContextBudgetSchema = z.object({
  totalTokens: z.number().int(), // Max context window

  // Reserved allocations
  reservations: z.object({
    identity: z.number().int(), // Always reserved for identity
    recentContext: z.number().int(), // Reserved for recent messages
    responseBuffer: z.number().int(), // Reserved for response
  }),

  // Remaining for dynamic content
  dynamicBudget: z.number().int(),

  // Current usage
  used: z.number().int().default(0),
  remaining: z.number().int(),
});
export type ContextBudget = z.infer<typeof ContextBudgetSchema>;

export const ContextWindowSchema = z.object({
  agentId: z.string().uuid(),
  agentType: AgentTypeSchema,

  // Budget
  budget: ContextBudgetSchema,

  // Sections (ordered by injection priority)
  sections: z.array(ContextSectionSchema),

  // The assembled context
  assembledContext: z.string(),

  // Metadata
  assembledAt: z.date(),
  tokensUsed: z.number().int(),
  sectionsIncluded: z.array(z.string()),
  sectionsExcluded: z.array(z.string()),
});
export type ContextWindow = z.infer<typeof ContextWindowSchema>;

// ============================================
// AGENT STATE
// ============================================

export const AgentStateSchema = z.object({
  agentId: z.string().uuid(),
  agentType: AgentTypeSchema,

  // Current state
  status: z.enum([
    "dormant",
    "active",
    "speaking",
    "listening",
    "thinking",
    "acting",
  ]),

  // Identity (always loaded)
  identity: IdentityAnchorSchema,

  // Knowledge (loaded on activation)
  knowledge: KnowledgeBoundarySchema.optional(),

  // Current situation
  currentSituation: z
    .object({
      location: z.string(),
      present: z.array(z.string()), // Who is present
      activity: z.string(),
      mood: z.string(),
      lastAction: z.string().optional(),
    })
    .optional(),

  // Conversation state
  conversationState: z
    .object({
      inConversation: z.boolean().default(false),
      conversationId: z.string().uuid().optional(),
      participants: z.array(z.string()).default([]),
      turnCount: z.number().int().default(0),
      lastSpeaker: z.string().optional(),
      topicStack: z.array(z.string()).default([]), // Current topics
      emotionalArc: z
        .array(
          z.object({
            turn: z.number().int(),
            emotion: z.string(),
            intensity: z.number().min(0).max(1),
          }),
        )
        .default([]),
    })
    .optional(),

  // Goal tracking
  activeGoals: z
    .array(
      z.object({
        goal: z.string(),
        priority: z.number().min(0).max(1),
        progress: z.number().min(0).max(1),
        strategy: z.string().optional(),
      }),
    )
    .default([]),

  // Last context window
  lastContext: ContextWindowSchema.optional(),

  // Statistics
  stats: z.object({
    totalInteractions: z.number().int().default(0),
    lastActive: z.date().optional(),
    averageResponseTime: z.number().optional(),
  }),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

// ============================================
// CONTEXT ASSEMBLY
// ============================================

export function assembleContext(
  agent: AgentState,
  situation: {
    scene: string;
    presentEntities: string[];
    recentMessages: Array<{ role: string; content: string }>;
    userMessage: string;
  },
  budget: ContextBudgetSchema,
): ContextWindow {
  const sections: ContextSection[] = [];

  // 1. IDENTITY (always first, always included)
  sections.push({
    id: "identity",
    type: "identity",
    content: buildIdentityPrompt(agent.identity),
    priority: 1.0,
    required: true,
    tokenEstimate: estimateTokens(buildIdentityPrompt(agent.identity)),
  });

  // 2. SITUATION (current scene)
  sections.push({
    id: "situation",
    type: "situation",
    content: buildSituationPrompt(situation.scene, situation.presentEntities),
    priority: 0.95,
    required: true,
    tokenEstimate: estimateTokens(situation.scene),
  });

  // 3. KNOWLEDGE (if loaded)
  if (agent.knowledge) {
    sections.push({
      id: "knowledge",
      type: "knowledge",
      content: buildKnowledgePrompt(agent.knowledge),
      priority: 0.8,
      required: false,
      tokenEstimate: estimateTokens(buildKnowledgePrompt(agent.knowledge)),
    });
  }

  // 4. RELATIONSHIPS (people present)
  if (agent.knowledge?.personalKnowledge.relationships) {
    const relevantRelationships =
      agent.knowledge.personalKnowledge.relationships.filter((r) =>
        situation.presentEntities.includes(r.name),
      );

    if (relevantRelationships.length > 0) {
      sections.push({
        id: "relationships",
        type: "relationships",
        content: buildRelationshipsPrompt(relevantRelationships),
        priority: 0.85,
        required: false,
        tokenEstimate: estimateTokens(JSON.stringify(relevantRelationships)),
      });
    }
  }

  // 5. GOALS (current objectives)
  if (agent.activeGoals.length > 0) {
    sections.push({
      id: "goals",
      type: "goals",
      content: buildGoalsPrompt(agent.activeGoals),
      priority: 0.7,
      required: false,
      tokenEstimate: estimateTokens(JSON.stringify(agent.activeGoals)),
    });
  }

  // 6. CONSTRAINTS (what you cannot do)
  sections.push({
    id: "constraints",
    type: "constraints",
    content: buildConstraintsPrompt(agent.identity.constraints),
    priority: 0.9,
    required: true,
    tokenEstimate: estimateTokens(JSON.stringify(agent.identity.constraints)),
  });

  // 7. RECENT CONTEXT (conversation history)
  const recentContextContent = situation.recentMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  sections.push({
    id: "recent_context",
    type: "recent_context",
    content: recentContextContent,
    priority: 0.95,
    required: true,
    tokenEstimate: estimateTokens(recentContextContent),
  });

  // Sort by priority and assemble within budget
  const sortedSections = sections.sort((a, b) => b.priority - a.priority);

  let usedTokens = 0;
  const includedSections: string[] = [];
  const excludedSections: string[] = [];
  const assembledParts: string[] = [];

  for (const section of sortedSections) {
    if (
      section.required ||
      usedTokens + section.tokenEstimate <= budget.dynamicBudget
    ) {
      assembledParts.push(section.content);
      usedTokens += section.tokenEstimate;
      includedSections.push(section.id);
    } else {
      excludedSections.push(section.id);
    }
  }

  return {
    agentId: agent.agentId,
    agentType: agent.agentType,
    budget,
    sections: sortedSections,
    assembledContext: assembledParts.join("\n\n"),
    assembledAt: new Date(),
    tokensUsed: usedTokens,
    sectionsIncluded: includedSections,
    sectionsExcluded: excludedSections,
  };
}

// ============================================
// PROMPT BUILDERS
// ============================================

export function buildIdentityPrompt(identity: IdentityAnchor): string {
  return `
# YOUR IDENTITY

${identity.coreIdentity}

## Core Traits
${identity.personality.coreTraits.map((t) => `- ${t}`).join("\n")}

## Values
${identity.personality.values.map((v) => `- ${v}`).join("\n")}

## Fears
${identity.personality.fears.map((f) => `- ${f}`).join("\n")}

## Current Goals
${identity.personality.goals.map((g) => `- ${g}`).join("\n")}

${
  identity.personality.speechPatterns
    ? `
## Speech Patterns
- Vocabulary: ${identity.personality.speechPatterns.vocabulary}
- Formality: ${identity.personality.speechPatterns.formality}
${identity.personality.speechPatterns.accent ? `- Accent: ${identity.personality.speechPatterns.accent}` : ""}
${identity.personality.speechPatterns.quirks.length > 0 ? `- Quirks: ${identity.personality.speechPatterns.quirks.join(", ")}` : ""}
${identity.personality.speechPatterns.commonPhrases.length > 0 ? `- Common phrases: "${identity.personality.speechPatterns.commonPhrases.join('", "')}"` : ""}
`
    : ""
}

${
  identity.physicalPresence
    ? `
## Physical Presence
${identity.physicalPresence.appearance}
${identity.physicalPresence.currentState ? `Current state: ${identity.physicalPresence.currentState}` : ""}
Mannerisms: ${identity.physicalPresence.mannerisms.join(", ")}
`
    : ""
}

${
  identity.personality.emotionalBaseline
    ? `
## Emotional State
Default demeanor: ${identity.personality.emotionalBaseline.default}
${identity.personality.emotionalBaseline.towardParty ? `Toward the party: ${identity.personality.emotionalBaseline.towardParty}` : ""}
${identity.personality.emotionalBaseline.currentMood ? `Current mood: ${identity.personality.emotionalBaseline.currentMood}` : ""}
`
    : ""
}
`.trim();
}

export function buildSituationPrompt(scene: string, present: string[]): string {
  return `
# CURRENT SITUATION

${scene}

## Present
${present.map((p) => `- ${p}`).join("\n")}
`.trim();
}

export function buildKnowledgePrompt(knowledge: KnowledgeBoundary): string {
  return `
# YOUR KNOWLEDGE

## Personal History
${knowledge.personalKnowledge.backstory}

## Skills
${knowledge.personalKnowledge.skills.map((s) => `- ${s}`).join("\n")}

## Location Knowledge
Current location: ${knowledge.locationKnowledge.currentLocation}

${
  knowledge.locationKnowledge.localRumors.length > 0
    ? `
## Local Rumors You've Heard
${knowledge.locationKnowledge.localRumors.map((r) => `- ${r}`).join("\n")}
`
    : ""
}

## World Knowledge
Era: ${knowledge.worldKnowledge.era}
${knowledge.worldKnowledge.commonKnowledge.map((k) => `- ${k}`).join("\n")}

## IMPORTANT: Knowledge Gaps
You do NOT know:
${knowledge.knowledgeGaps.categories.map((c) => `- ${c.replace(/_/g, " ")}`).join("\n")}
${knowledge.knowledgeGaps.specificExclusions.map((e) => `- ${e}`).join("\n")}

If asked about things you don't know, respond naturally as someone who doesn't have that information.
`.trim();
}

export function buildRelationshipsPrompt(
  relationships: KnowledgeBoundary["personalKnowledge"]["relationships"],
): string {
  return `
# PEOPLE YOU KNOW (Present)

${relationships
  .map(
    (r) => `
## ${r.name}
Relationship: ${r.relationship}
Your attitude: ${r.attitude}
${r.sharedHistory ? `Shared history: ${r.sharedHistory}` : ""}
`,
  )
  .join("\n")}
`.trim();
}

export function buildGoalsPrompt(goals: AgentState["activeGoals"]): string {
  return `
# YOUR CURRENT GOALS

${goals
  .map(
    (g) => `
- ${g.goal} (Priority: ${Math.round(g.priority * 100)}%)
  ${g.strategy ? `Strategy: ${g.strategy}` : ""}
`,
  )
  .join("\n")}

Subtly work toward these goals in your interactions.
`.trim();
}

export function buildConstraintsPrompt(
  constraints: IdentityAnchor["constraints"],
): string {
  return `
# CONSTRAINTS

## You CAN:
${constraints.canDo.map((c) => `- ${c}`).join("\n")}

## You CANNOT:
${constraints.cannotDo.map((c) => `- ${c}`).join("\n")}

## You MUST:
${constraints.mustDo.map((c) => `- ${c}`).join("\n")}

## ABSOLUTE BOUNDARIES (never cross):
${constraints.hardBoundaries.map((b) => `- ${b}`).join("\n")}
`.trim();
}

// Token estimation (rough)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================
// ORCHESTRATOR
// ============================================
//
// The master agent that coordinates all others.
// Sees everything, but routes to appropriate agents.
//

export const OrchestratorConfigSchema = z.object({
  // Active agents
  activeAgents: z
    .array(
      z.object({
        agentId: z.string().uuid(),
        agentType: AgentTypeSchema,
        name: z.string(),
        status: z.enum(["active", "dormant", "suspended"]),
      }),
    )
    .default([]),

  // Routing rules
  routingRules: z
    .array(
      z.object({
        condition: z.string(), // "message mentions NPC name"
        routeTo: z.string().uuid(), // Agent ID
        priority: z.number().int(),
      }),
    )
    .default([]),

  // Context sharing
  sharedContext: z.object({
    currentScene: z.string().optional(),
    currentLocation: z.string().optional(),
    partyPresent: z.array(z.string()).default([]),
    npcsPresent: z.array(z.string()).default([]),
    activeQuests: z.array(z.string()).default([]),
    recentEvents: z.array(z.string()).default([]),
  }),

  // Global constraints
  globalConstraints: z.array(z.string()).default([]),

  // Logging
  logging: z.object({
    enabled: z.boolean().default(true),
    level: z.enum(["error", "warn", "info", "debug"]).default("info"),
    logAgentSwitch: z.boolean().default(true),
    logContextAssembly: z.boolean().default(false),
  }),
});
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export const OrchestratorStateSchema = z.object({
  config: OrchestratorConfigSchema,

  // All managed agents
  agents: z.record(z.string().uuid(), AgentStateSchema),

  // Current conversation
  currentConversation: z
    .object({
      id: z.string().uuid(),
      activeAgent: z.string().uuid().optional(),
      participants: z.array(z.string()),
      messageHistory: z.array(
        z.object({
          id: z.string().uuid(),
          role: z.enum(["user", "agent", "system", "narrator"]),
          agentId: z.string().uuid().optional(),
          content: z.string(),
          timestamp: z.date(),
        }),
      ),
    })
    .optional(),

  // Scene management
  currentScene: z
    .object({
      id: z.string().uuid(),
      description: z.string(),
      location: z.string(),
      presentNPCs: z.array(z.string().uuid()),
      presentPlayers: z.array(z.string()),
      mood: z.string(),
      lighting: z.string().optional(),
      sounds: z.array(z.string()).optional(),
    })
    .optional(),

  // World state (for non-NPC agents)
  worldState: z
    .object({
      currentDate: z.string(),
      timeOfDay: z.string(),
      weather: z.string(),
      season: z.string(),
      recentWorldEvents: z.array(z.string()),
    })
    .optional(),
});
export type OrchestratorState = z.infer<typeof OrchestratorStateSchema>;

// ============================================
// AGENT ROUTING
// ============================================

export function routeMessage(
  state: OrchestratorState,
  message: string,
  context: { speaker: string; location: string },
): { agentId: string; reason: string } | null {
  // Check explicit routing rules
  for (const rule of state.config.routingRules) {
    // Simple keyword matching (would be more sophisticated in production)
    if (message.toLowerCase().includes(rule.condition.toLowerCase())) {
      return {
        agentId: rule.routeTo,
        reason: `Matched rule: ${rule.condition}`,
      };
    }
  }

  // Check if addressing a specific NPC
  for (const [agentId, agent] of Object.entries(state.agents)) {
    if (agent.agentType === "npc") {
      const name = agent.identity.name.toLowerCase();
      if (message.toLowerCase().includes(name)) {
        return { agentId, reason: `Addressed NPC: ${agent.identity.name}` };
      }
    }
  }

  // Check if in conversation with an agent
  if (state.currentConversation?.activeAgent) {
    return {
      agentId: state.currentConversation.activeAgent,
      reason: "Continuing conversation",
    };
  }

  // Default to narrator if no specific agent
  const narrator = Object.entries(state.agents).find(
    ([_, a]) => a.agentType === "narrator",
  );

  if (narrator) {
    return { agentId: narrator[0], reason: "Default to narrator" };
  }

  return null;
}

// ============================================
// STANDARD IDENTITY TEMPLATES
// ============================================

export const IdentityTemplates = {
  // Simple NPC template
  simpleNPC: (data: {
    name: string;
    occupation: string;
    personality: string[];
    location: string;
  }): Partial<IdentityAnchor> => ({
    name: data.name,
    agentType: "npc",
    coreIdentity: `You are ${data.name}, a ${data.occupation} in ${data.location}.`,
    personality: {
      coreTraits: data.personality,
      values: [],
      fears: [],
      goals: [],
    },
    constraints: {
      canDo: [
        `Discuss your work as a ${data.occupation}`,
        "Share local gossip",
        "Answer questions about the area",
      ],
      cannotDo: [
        "Leave your post",
        "Reveal secrets you don't know",
        "Read minds",
      ],
      mustDo: ["Stay in character"],
      hardBoundaries: ["Never break character", "Never reveal game mechanics"],
    },
  }),

  // Narrator template
  narrator: (campaignName: string): Partial<IdentityAnchor> => ({
    name: "Narrator",
    agentType: "narrator",
    coreIdentity: `You are the narrator for the ${campaignName} campaign. You describe scenes, environments, and actions with vivid, evocative language. You do not speak as NPCs - you describe what happens and set the scene.`,
    personality: {
      coreTraits: ["descriptive", "evocative", "fair", "dramatic"],
      values: ["immersion", "player agency", "narrative flow"],
      fears: [],
      goals: ["Create memorable scenes", "Maintain pacing"],
    },
    constraints: {
      canDo: [
        "Describe scenes",
        "Narrate actions",
        "Set atmosphere",
        "Describe NPC actions in third person",
      ],
      cannotDo: [
        "Speak as NPCs directly",
        "Make decisions for players",
        "Reveal hidden information",
      ],
      mustDo: ["Maintain atmosphere", "Be fair and consistent"],
      hardBoundaries: [
        "Never reveal GM secrets",
        "Never speak in first person as an NPC",
      ],
    },
  }),

  // GM Assistant template
  gmAssistant: (): Partial<IdentityAnchor> => ({
    name: "GM Assistant",
    agentType: "gm_assistant",
    coreIdentity: `You are a helpful assistant for the Game Master. You help with rules, generate content, provide ideas, and manage the campaign. You speak directly to the GM, not in character.`,
    personality: {
      coreTraits: ["helpful", "knowledgeable", "creative", "organized"],
      values: ["game flow", "player fun", "consistency"],
      fears: [],
      goals: ["Help GM run great sessions"],
    },
    constraints: {
      canDo: [
        "Answer rules questions",
        "Generate NPCs/locations/items",
        "Suggest plot hooks",
        "Summarize sessions",
      ],
      cannotDo: [
        "Make campaign decisions",
        "Override GM choices",
        "Speak to players directly",
      ],
      mustDo: ["Defer to GM on final decisions", "Flag potential issues"],
      hardBoundaries: ["Never reveal GM notes to players"],
    },
  }),

  // Faction AI template
  factionAI: (faction: {
    name: string;
    goals: string[];
    personality: string[];
    resources: string[];
  }): Partial<IdentityAnchor> => ({
    name: `${faction.name} AI`,
    agentType: "faction",
    coreIdentity: `You embody the collective will of ${faction.name}. You make decisions as this faction would, pursuing its goals through its available resources and methods.`,
    personality: {
      coreTraits: faction.personality,
      values: [],
      fears: [],
      goals: faction.goals,
    },
    constraints: {
      canDo: [
        "Plan schemes",
        "React to events",
        "Deploy resources",
        "Form alliances",
      ],
      cannotDo: [
        "Know player secrets",
        "Act beyond faction resources",
        "Ignore faction values",
      ],
      mustDo: ["Act in faction interest", "Consider consequences"],
      hardBoundaries: ["Stay consistent with faction identity"],
    },
  }),
};

// ============================================
// VOICE CONSISTENCY
// ============================================

export const VoiceConsistencySchema = z.object({
  agentId: z.string().uuid(),

  // Voice fingerprint
  fingerprint: z.object({
    // Lexical patterns
    vocabulary: z.array(z.string()), // Preferred words
    avoidedWords: z.array(z.string()), // Words they wouldn't use
    catchphrases: z.array(z.string()), // Signature phrases

    // Syntactic patterns
    averageSentenceLength: z.enum(["short", "medium", "long"]),
    questionFrequency: z.enum(["rare", "occasional", "frequent"]),
    exclamationFrequency: z.enum(["rare", "occasional", "frequent"]),

    // Semantic patterns
    topicPreferences: z.array(z.string()), // What they like to talk about
    topicAvoidances: z.array(z.string()), // What they avoid

    // Pragmatic patterns
    directness: z.enum([
      "very_indirect",
      "indirect",
      "neutral",
      "direct",
      "very_direct",
    ]),
    politeness: z.enum(["rude", "casual", "neutral", "polite", "very_polite"]),
    humor: z.enum(["none", "dry", "playful", "sarcastic", "crude"]),
  }),

  // Example utterances (for few-shot consistency)
  examples: z
    .array(
      z.object({
        context: z.string(),
        utterance: z.string(),
        notes: z.string().optional(),
      }),
    )
    .default([]),

  // Anti-patterns (things they would NEVER say)
  antiPatterns: z.array(z.string()).default([]),
});
export type VoiceConsistency = z.infer<typeof VoiceConsistencySchema>;

// ============================================
// GROUNDING VERIFICATION
// ============================================

export function verifyGrounding(
  response: string,
  identity: IdentityAnchor,
  voice: VoiceConsistency,
): {
  grounded: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for voice consistency violations
  for (const avoidedWord of voice.fingerprint.avoidedWords) {
    if (response.toLowerCase().includes(avoidedWord.toLowerCase())) {
      issues.push(`Used avoided word: "${avoidedWord}"`);
      suggestions.push(`Consider rephrasing to avoid "${avoidedWord}"`);
    }
  }

  // Check for anti-patterns
  for (const antiPattern of voice.antiPatterns) {
    if (response.toLowerCase().includes(antiPattern.toLowerCase())) {
      issues.push(`Matched anti-pattern: "${antiPattern}"`);
    }
  }

  // Check for constraint violations
  for (const boundary of identity.constraints.hardBoundaries) {
    // Simple heuristic - would be more sophisticated in production
    if (boundary.includes("never") && response.includes("I will")) {
      // Very rough check
    }
  }

  // Check sentence length
  const sentences = response.split(/[.!?]+/).filter((s) => s.trim());
  const avgLength =
    sentences.reduce((a, s) => a + s.split(" ").length, 0) / sentences.length;

  if (voice.fingerprint.averageSentenceLength === "short" && avgLength > 15) {
    issues.push("Sentences too long for this character");
    suggestions.push("Use shorter, punchier sentences");
  } else if (
    voice.fingerprint.averageSentenceLength === "long" &&
    avgLength < 8
  ) {
    issues.push("Sentences too short for this character");
    suggestions.push("Use more elaborate sentences");
  }

  return {
    grounded: issues.length === 0,
    issues,
    suggestions,
  };
}

// ============================================
// MULTI-AGENT CONVERSATION
// ============================================

export const MultiAgentConversationSchema = z.object({
  id: z.string().uuid(),

  // Participants
  participants: z.array(
    z.object({
      agentId: z.string().uuid(),
      name: z.string(),
      role: z.enum(["primary", "secondary", "observer"]),
      speakingOrder: z.number().int().optional(),
    }),
  ),

  // Turn management
  turnManagement: z
    .enum([
      "round_robin", // Each speaks in order
      "free_form", // Anyone can speak
      "moderated", // Orchestrator decides
      "reactive", // Speak when addressed
    ])
    .default("reactive"),

  // Current state
  currentTurn: z.number().int().default(0),
  currentSpeaker: z.string().uuid().optional(),

  // Message history
  messages: z.array(
    z.object({
      id: z.string().uuid(),
      agentId: z.string().uuid(),
      agentName: z.string(),
      content: z.string(),
      timestamp: z.date(),
      addressedTo: z.array(z.string()).optional(), // Agent IDs
      inResponseTo: z.string().uuid().optional(), // Message ID
    }),
  ),

  // Scene context (shared)
  sharedContext: z.object({
    scene: z.string(),
    location: z.string(),
    mood: z.string(),
    stakes: z.string().optional(),
  }),
});
export type MultiAgentConversation = z.infer<
  typeof MultiAgentConversationSchema
>;

// ============================================
// AI GENERATION PROMPTS
// ============================================

export function buildAgentGenerationPrompt(request: {
  type: AgentType;
  name: string;
  context: string;
  requirements?: string[];
}): string {
  return `
# GENERATE AI AGENT

Create a complete agent definition for a TTRPG intelligence layer.

## REQUEST
Type: ${request.type}
Name: ${request.name}
Context: ${request.context}
${request.requirements?.length ? `Requirements: ${request.requirements.join(", ")}` : ""}

## GENERATE

Create a complete agent with:

1. **Core Identity**: The grounding statement (2-3 sentences)

2. **Personality**:
   - Core traits (3-5)
   - Values (2-3)
   - Fears (1-2)
   - Current goals (2-3)
   - Speech patterns (vocabulary, formality, quirks, common phrases)
   - Emotional baseline

3. **Physical Presence** (if embodied):
   - Appearance
   - Mannerisms (3-5)
   - Current state

4. **Constraints**:
   - Can do (3-5)
   - Cannot do (3-5)
   - Must do (1-3)
   - Hard boundaries (2-3)

5. **Example Dialogue** (3 examples):
   - Context
   - User input
   - Agent response

6. **Voice Fingerprint**:
   - Vocabulary preferences
   - Avoided words
   - Catchphrases
   - Sentence length
   - Directness
   - Humor style

Make the agent feel REAL and CONSISTENT. Every response should feel like the same person.
`.trim();
}
