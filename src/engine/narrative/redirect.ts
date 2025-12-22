import { z } from "zod";
import { Arc, Quest, Beat, Campaign, Session } from "./story";

// ============================================
// THE PARTY ADHD GM SAVER
// ============================================
//
// The Problem:
//   GM: "You enter the tavern where your contact waits—"
//   Player: "Is there a cat?"
//   GM: "...yes?"
//   Player: "I pet the cat. What's its name? Does it like me?"
//   *Quest forgotten, 20 minutes on cat lore*
//
// The Solution:
//   Take WHATEVER they're fixated on and weave it into the plot.
//   The cat belongs to someone who knows something.
//   Their chaos becomes your narrative.
//
// Philosophy:
//   - Never fight player attention, REDIRECT it
//   - Make them feel clever for "discovering" the hook
//   - Every distraction is an opportunity
//   - The improv becomes canon
//

// ============================================
// DISTRACTION CAPTURE
// ============================================

export const DistractionTypeSchema = z.enum([
  "npc", // Random NPC they latched onto
  "object", // Item they're obsessing over
  "location", // Place they want to explore
  "creature", // Animal, monster, etc.
  "detail", // Environmental detail they noticed
  "tangent", // Conversation going off-topic
  "shopping", // Endless merchant haggling
  "backstory", // Player inventing lore on the spot
  "argument", // In-party debate derailing session
  "other",
]);
export type DistractionType = z.infer<typeof DistractionTypeSchema>;

export const DistractionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),

  // What they're focused on
  type: DistractionTypeSchema,
  description: z.string(), // "Random halfling apple seller"

  // Context
  currentLocation: z.string().optional(),
  currentSceneSummary: z.string().optional(),

  // What the GM wanted them to do
  intendedFocus: z.string().optional(), // "Meet the contact in the tavern"

  // Time tracking
  occurredAt: z.date().default(() => new Date()),
  durationBeforeRedirect: z.number().int().optional(), // minutes they spent on this

  // Resolution
  redirectUsed: z.boolean().default(false),
  hookGenerated: z.string().uuid().optional(), // links to generated hook
});
export type Distraction = z.infer<typeof DistractionSchema>;

// ============================================
// ACTIVE NARRATIVE CONTEXT
// ============================================
// What threads can we weave the distraction into?

export const NarrativeThreadSchema = z.object({
  id: z.string().uuid(),

  // Source
  sourceType: z.enum([
    "arc",
    "quest",
    "beat",
    "secret",
    "npc_goal",
    "faction_plan",
  ]),
  sourceId: z.string().uuid(),
  sourceName: z.string(),

  // The thread
  summary: z.string(), // "Cult is kidnapping merchants"
  keywords: z.array(z.string()), // ["cult", "dragon", "kidnapping", "merchants", "south road"]

  // Hookability
  urgency: z.enum(["background", "simmering", "active", "urgent", "critical"]),
  isSecret: z.boolean().default(false),
  canBeDiscoveredBy: z.array(z.string()).optional(), // ["investigation", "persuasion", "luck"]

  // Connections
  relatedNpcs: z.array(z.string().uuid()).default([]),
  relatedLocations: z.array(z.string().uuid()).default([]),
  relatedFactions: z.array(z.string().uuid()).default([]),
});
export type NarrativeThread = z.infer<typeof NarrativeThreadSchema>;

export const RedirectContextSchema = z.object({
  // Campaign context
  campaignId: z.string().uuid(),
  campaignObjective: z.string(),
  campaignTone: z.string().optional(),

  // Current state
  currentSessionId: z.string().uuid(),
  currentLocation: z.string().optional(),
  worldDate: z.string().optional(),

  // Active narrative
  activeArcs: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      objective: z.string(),
      status: z.string(),
    }),
  ),

  activeQuests: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      objective: z.string(),
      currentBeat: z.string().optional(),
    }),
  ),

  // Available threads to weave into
  narrativeThreads: z.array(NarrativeThreadSchema),

  // Secrets that could be revealed
  revealableSecrets: z.array(
    z.object({
      id: z.string().uuid(),
      hint: z.string(), // What the GM sees
      fullTruth: z.string(), // What would be revealed
      discoveryMethod: z.string(), // How it can be found
    }),
  ),

  // Party knowledge (what they already know)
  partyKnowledge: z.array(z.string()),

  // Party composition (for character-specific hooks)
  partyMembers: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      background: z.string().optional(),
      personalQuest: z.string().optional(),
      knownConnections: z.array(z.string()).default([]),
    }),
  ),
});
export type RedirectContext = z.infer<typeof RedirectContextSchema>;

// ============================================
// HOOK GENERATION
// ============================================

export const HookTypeSchema = z.enum([
  "information", // NPC knows something useful
  "connection", // NPC is connected to plot
  "witness", // NPC saw something relevant
  "victim", // NPC affected by the threat
  "agent", // NPC works for relevant faction
  "coincidence", // Object/detail links to plot
  "foreshadowing", // Hints at future events
  "backstory_link", // Connects to PC's past
  "urgent_interrupt", // Something happens that demands attention
  "breadcrumb", // Small clue leading forward
]);
export type HookType = z.infer<typeof HookTypeSchema>;

export const HookToneSchema = z.enum([
  "subtle", // Easily missable, rewards attention
  "moderate", // Clear but not forced
  "obvious", // Direct redirect
  "urgent", // Emergency that demands action
  "comedic", // Funny coincidence
  "dramatic", // High tension reveal
  "mysterious", // Raises questions
]);
export type HookTone = z.infer<typeof HookToneSchema>;

export const GeneratedHookSchema = z.object({
  id: z.string().uuid(),
  distractionId: z.string().uuid(),

  // What kind of redirect
  hookType: HookTypeSchema,
  tone: HookToneSchema,

  // The hook itself
  title: z.string(), // "The Halfling's Cousin"

  // What to say/do
  readAloud: z.string(), // Text the GM can read to players
  gmNotes: z.string(), // Private notes for the GM

  // How it connects
  connectsToThread: z.string().uuid(), // which narrative thread
  connectionExplanation: z.string(), // why this makes sense

  // What this reveals
  informationRevealed: z.array(z.string()), // facts the party learns
  secretsPartiallyRevealed: z.array(z.string().uuid()).optional(),

  // Follow-up possibilities
  possibleFollowUps: z.array(
    z.object({
      playerAction: z.string(), // "If they ask about the symbols"
      gmResponse: z.string(), // What to tell them
    }),
  ),

  // If this creates a new NPC
  generatedNpc: z
    .object({
      name: z.string(),
      role: z.string(), // "Informant", "Red herring", "Future contact"
      personality: z.string(),
      knowledge: z.array(z.string()),
      secrets: z.array(z.string()),
      canRecur: z.boolean(),
    })
    .optional(),

  // Rating/feedback
  wasUsed: z.boolean().default(false),
  gmRating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),

  // Timestamps
  generatedAt: z.date().default(() => new Date()),
});
export type GeneratedHook = z.infer<typeof GeneratedHookSchema>;

// ============================================
// REDIRECT REQUEST
// ============================================
// What the GM sends to the AI

export const RedirectRequestSchema = z.object({
  // The distraction
  distraction: DistractionSchema,

  // Full context
  context: RedirectContextSchema,

  // GM preferences for this redirect
  preferences: z
    .object({
      // Intensity
      subtlety: z.enum(["subtle", "moderate", "obvious"]).default("moderate"),
      urgency: z.enum(["relaxed", "normal", "urgent"]).default("normal"),

      // What to prioritize
      prioritizeThread: z.string().uuid().optional(), // specific thread to connect to
      prioritizeCharacter: z.string().uuid().optional(), // make it about this PC

      // Constraints
      avoidCombat: z.boolean().default(false),
      avoidMajorReveals: z.boolean().default(false),
      keepItLight: z.boolean().default(false),

      // How many options
      numberOfHooks: z.number().int().min(1).max(5).default(3),
    })
    .default({}),
});
export type RedirectRequest = z.infer<typeof RedirectRequestSchema>;

// ============================================
// AI PROMPT BUILDER
// ============================================

export function buildRedirectPrompt(request: RedirectRequest): string {
  const { distraction, context, preferences } = request;

  return `
# PARTY ADHD GM SAVER

You are a master GM assistant. The players have gone off-track and the GM needs a hook to redirect them back to the narrative WITHOUT breaking immersion or making them feel railroaded.

## THE DISTRACTION
Type: ${distraction.type}
What they're focused on: ${distraction.description}
Current location: ${distraction.currentLocation ?? "Unknown"}
What GM wanted them to do: ${distraction.intendedFocus ?? "Continue main plot"}

## CAMPAIGN CONTEXT
Campaign: ${context.campaignObjective}
Tone: ${context.campaignTone ?? "Standard fantasy"}
Current location: ${context.currentLocation ?? "Unknown"}

## ACTIVE STORY THREADS
${context.activeArcs.map((a) => `- ARC: "${a.name}" - ${a.objective}`).join("\n")}

${context.activeQuests.map((q) => `- QUEST: "${q.name}" - ${q.objective}${q.currentBeat ? ` (Current: ${q.currentBeat})` : ""}`).join("\n")}

## NARRATIVE THREADS TO WEAVE INTO
${context.narrativeThreads
  .map(
    (t) => `
- [${t.urgency.toUpperCase()}] ${t.sourceName}: ${t.summary}
  Keywords: ${t.keywords.join(", ")}
`,
  )
  .join("\n")}

## SECRETS THAT COULD BE HINTED
${context.revealableSecrets.map((s) => `- ${s.hint} (discovered via: ${s.discoveryMethod})`).join("\n")}

## PARTY COMPOSITION
${context.partyMembers.map((p) => `- ${p.name}: ${p.background ?? "Unknown background"}${p.personalQuest ? ` | Personal quest: ${p.personalQuest}` : ""}`).join("\n")}

## WHAT THEY ALREADY KNOW
${context.partyKnowledge.map((k) => `- ${k}`).join("\n")}

## GM PREFERENCES
- Subtlety: ${preferences.subtlety}
- Urgency: ${preferences.urgency}
${preferences.prioritizeThread ? `- Connect to specific thread: ${preferences.prioritizeThread}` : ""}
${preferences.prioritizeCharacter ? `- Make it relevant to: ${preferences.prioritizeCharacter}` : ""}
${preferences.avoidCombat ? "- Avoid combat encounters" : ""}
${preferences.avoidMajorReveals ? "- No major plot reveals" : ""}
${preferences.keepItLight ? "- Keep the tone light" : ""}

## YOUR TASK

Generate ${preferences.numberOfHooks} different hooks that:

1. EMBRACE the distraction (don't dismiss what they're interested in)
2. CONNECT it to an active narrative thread
3. Make players feel CLEVER for finding this "connection"
4. Give the GM something to READ ALOUD
5. Provide FOLLOW-UP options if players dig deeper

For each hook, provide:
- Title (catchy name for the hook)
- Type (information/connection/witness/victim/agent/coincidence/foreshadowing/backstory_link/urgent_interrupt/breadcrumb)
- Tone (subtle/moderate/obvious/urgent/comedic/dramatic/mysterious)
- Read Aloud (what GM says to players, in quotes, immersive)
- GM Notes (private context for the GM)
- Connects To (which narrative thread)
- Information Revealed (bullet points of what party learns)
- Follow-ups (if player does X, respond with Y)
- Generated NPC (if applicable: name, role, personality, what they know)

Make the hooks FEEL NATURAL. The players should never realize they've been redirected. Their "random" choice led them to something important—that's the magic.

VARY the hooks: give one subtle, one moderate, one obvious. Or one that connects to character backstory, one to main plot, one to faction intrigue.
`.trim();
}

// ============================================
// HOOK TEMPLATES (for quick generation)
// ============================================

export const HookTemplates: Record<DistractionType, string[]> = {
  npc: [
    "The {npc} is actually a {role} for {faction}",
    "The {npc}'s {relative} was affected by {threat}",
    "The {npc} witnessed {event} and is afraid to talk",
    "The {npc} recognizes {pc} from {backstory_element}",
    "The {npc} is hiding from {antagonist}",
    "The {npc} has a {item} that relates to {quest}",
  ],
  object: [
    "The {object} bears the symbol of {faction}",
    "The {object} was stolen from {location} during {event}",
    "The {object} is a key to {secret_location}",
    "The {object} triggers a memory in {pc}",
    "The {object} is being searched for by {antagonist}",
  ],
  location: [
    "This place was the site of {past_event}",
    "Hidden here is evidence of {conspiracy}",
    "A {npc_type} uses this place as a {purpose}",
    "{faction} has been watching this location",
    "The locals avoid this place because of {rumor}",
  ],
  creature: [
    "The {creature} belongs to {important_npc}",
    "The {creature} fled from {threat_location}",
    "The {creature} is drawn to {magical_thing}",
    "Following the {creature} leads to {discovery}",
    "The {creature}'s behavior hints at {danger}",
  ],
  detail: [
    "This detail is a clue left by {ally}",
    "This is the calling card of {antagonist}",
    "This reveals the presence of {hidden_faction}",
    "This contradicts what {npc} told them",
    "This is exactly what {quest_giver} described",
  ],
  tangent: [
    "Their conversation is overheard by {eavesdropper}",
    "Their debate attracts the attention of {interested_party}",
    "Their tangent accidentally reveals them to {watcher}",
    "A passing {npc} comments with relevant information",
  ],
  shopping: [
    "The merchant recognizes an item from {event}",
    "The shop is a front for {faction}",
    "Another customer is clearly {suspicious_role}",
    "The merchant offers a job related to {quest}",
    "An item in the shop is connected to {backstory}",
  ],
  backstory: [
    "Their invented detail happens to be TRUE",
    "A nearby NPC reacts to what they said",
    "Their story attracts someone who knows more",
    "Their creation has consequences they didn't expect",
  ],
  argument: [
    "Their argument is interrupted by {urgent_event}",
    "A third party offers a solution that advances the plot",
    "Their debate reveals they've been overheard",
    "The subject of their argument becomes immediately relevant",
  ],
  other: [
    "This seemingly random thing connects to {thread}",
    "Their focus reveals something hidden",
    "The universe conspires to make this relevant",
  ],
};

// ============================================
// QUICK REDIRECT FUNCTION
// ============================================

export interface QuickRedirectOptions {
  distraction: string; // Quick description
  distractionType: DistractionType;
  targetThread?: string; // Which thread to connect to
  tone?: HookTone;
  pcToInvolve?: string; // Character name to make it personal
}

export function buildQuickRedirectPrompt(
  options: QuickRedirectOptions,
  threads: string[],
  partyKnowledge: string[],
): string {
  return `
QUICK REDIRECT NEEDED

Distraction: ${options.distraction}
Type: ${options.distractionType}

Available story threads to connect to:
${threads.map((t, i) => `${i + 1}. ${t}`).join("\n")}

${options.targetThread ? `PRIORITY: Connect to "${options.targetThread}"` : ""}
${options.tone ? `TONE: ${options.tone}` : ""}
${options.pcToInvolve ? `MAKE IT PERSONAL FOR: ${options.pcToInvolve}` : ""}

Party already knows:
${partyKnowledge.map((k) => `- ${k}`).join("\n")}

Generate ONE hook that takes their distraction and weaves it into the story.
Format:
- READ ALOUD: [immersive text for GM to read]
- CONNECTS TO: [which thread]
- REVEALS: [what party learns]
- IF THEY ASK MORE: [follow-up response]
`.trim();
}

// ============================================
// USAGE TRACKING
// ============================================
// Track which redirects worked well for learning

export const RedirectOutcomeSchema = z.object({
  hookId: z.string().uuid(),

  // Did it work?
  playerReaction: z.enum([
    "engaged", // They bit the hook
    "suspicious", // They sensed the redirect
    "ignored", // They stayed on distraction
    "delighted", // They loved the connection
  ]),

  // GM assessment
  gmSatisfaction: z.number().int().min(1).max(5),

  // What happened next
  followUpUsed: z.boolean(),
  ledToProgress: z.boolean(), // Did it advance the story?
  generatedNpcReused: z.boolean().optional(), // Did the created NPC come back?

  // Notes for improvement
  whatWorked: z.string().optional(),
  whatDidnt: z.string().optional(),

  // For ML training later
  tags: z.array(z.string()).default([]),
});
export type RedirectOutcome = z.infer<typeof RedirectOutcomeSchema>;

// ============================================
// INTEGRATION WITH SESSION FLOW
// ============================================

export interface LiveSessionRedirect {
  // Current session state
  sessionId: string;

  // One-click capture
  captureDistraction(
    description: string,
    type: DistractionType,
  ): Promise<Distraction>;

  // Generate hooks
  generateHooks(
    distraction: Distraction,
    preferences?: Partial<RedirectRequest["preferences"]>,
  ): Promise<GeneratedHook[]>;

  // Quick single hook
  quickRedirect(
    description: string,
    type: DistractionType,
  ): Promise<GeneratedHook>;

  // Apply hook (marks as used, updates session log)
  useHook(hook: GeneratedHook): Promise<void>;

  // Feedback
  rateHook(hookId: string, outcome: RedirectOutcome): Promise<void>;
}

// ============================================
// UI BUTTON STATES
// ============================================

export const RedirectButtonStateSchema = z.enum([
  "ready", // 🎯 Party ADHD Saver
  "capturing", // 📝 Describe distraction...
  "generating", // ⚡ Generating hooks...
  "selecting", // 🎭 Pick a hook
  "active", // 🎬 Hook in play
]);
export type RedirectButtonState = z.infer<typeof RedirectButtonStateSchema>;

// The button flow:
// 1. GM clicks "🎯 Party ADHD Saver"
// 2. Quick input: "What are they distracted by?" + type dropdown
// 3. AI generates 3 hooks
// 4. GM picks one (or regenerates)
// 5. Hook displays with "Read Aloud" ready to go
// 6. GM uses it, rates it afterward
