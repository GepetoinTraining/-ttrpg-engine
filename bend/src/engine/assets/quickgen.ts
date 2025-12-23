import { z } from "zod";
import {
  DetailLevel,
  AssetType,
  NpcStubSchema,
  LocationStubSchema,
  ItemStubSchema,
  FactionStubSchema,
} from "./entity";
import { CreatureSchema } from "../rules/creature";

// ============================================
// INSTANT GENERATION
// ============================================
//
// When you need something NOW:
// - "Quick! A guard captain just showed up!"
// - "They asked about the next town over."
// - "Random loot for this chest?"
//
// One click. Instant stub. Can deepen later.
//

// ============================================
// QUICK NPC GENERATOR
// ============================================

export const QuickNpcInputSchema = z.object({
  // Minimum: just a role
  role: z.string(), // "Guard", "Merchant", "Beggar"

  // Optional context
  location: z.string().optional(),
  species: z.string().optional(),
  gender: z.string().optional(),

  // Constraints
  hostile: z.boolean().optional(),
  knowsAbout: z.array(z.string()).optional(), // Topics they should know
  connectedTo: z.string().optional(), // Faction, NPC, or quest

  // For immediate combat
  needsCombatStats: z.boolean().default(false),
  approximateCR: z.string().optional(),
});
export type QuickNpcInput = z.infer<typeof QuickNpcInputSchema>;

export const QuickNpcOutputSchema = z.object({
  // Identity
  name: z.string(),
  species: z.string(),
  gender: z.string(),
  role: z.string(),

  // Quick personality (2-3 words)
  traits: z.array(z.string()).max(3),
  quirk: z.string(),

  // One-liner description
  description: z.string(),

  // Voice hint
  voiceHint: z.string(), // "Speaks slowly, deep voice"
  exampleLine: z.string(), // Something they might say

  // What they know (if specified)
  knowledgeHints: z.array(z.string()).optional(),

  // Combat stats (if needed)
  combatStats: z
    .object({
      ac: z.number().int(),
      hp: z.number().int(),
      speed: z.number().int(),
      attacks: z.array(
        z.object({
          name: z.string(),
          bonus: z.number().int(),
          damage: z.string(),
        }),
      ),
      abilities: z.array(z.string()).optional(),
    })
    .optional(),
});
export type QuickNpcOutput = z.infer<typeof QuickNpcOutputSchema>;

export function buildQuickNpcPrompt(input: QuickNpcInput): string {
  return `
Generate a quick NPC:

Role: ${input.role}
${input.location ? `Location: ${input.location}` : ""}
${input.species ? `Species: ${input.species}` : "Species: Your choice (human most common)"}
${input.gender ? `Gender: ${input.gender}` : "Gender: Your choice"}
${input.hostile ? "Disposition: Hostile to party" : ""}
${input.knowsAbout?.length ? `Should know about: ${input.knowsAbout.join(", ")}` : ""}
${input.connectedTo ? `Connected to: ${input.connectedTo}` : ""}

Provide:
1. Name (appropriate for fantasy setting)
2. 2-3 personality traits
3. One quirk (memorable detail)
4. One-sentence description
5. Voice hint (how they speak)
6. Example line of dialogue

${
  input.needsCombatStats
    ? `
Also provide combat stats for CR ${input.approximateCR || "appropriate"}:
- AC, HP, Speed
- Attack(s) with bonus and damage
`
    : ""
}

Keep it brief and immediately usable.
`.trim();
}

// ============================================
// QUICK LOCATION GENERATOR
// ============================================

export const QuickLocationInputSchema = z.object({
  // Minimum: type and context
  type: z.string(), // "Town", "Dungeon", "Tavern"
  context: z.string().optional(), // "On the road to Waterdeep"

  // Optional
  size: z.string().optional(),
  atmosphere: z.string().optional(), // "Gloomy", "Bustling", "Abandoned"

  // What should be here
  mustHave: z.array(z.string()).optional(), // ["Blacksmith", "Temple"]

  // Connection
  nearbyLocation: z.string().optional(),
});
export type QuickLocationInput = z.infer<typeof QuickLocationInputSchema>;

export const QuickLocationOutputSchema = z.object({
  name: z.string(),
  type: z.string(),

  // Quick description
  description: z.string(),
  atmosphere: z.string(),

  // Key features (3-5)
  keyFeatures: z.array(z.string()),

  // Key NPCs (names only, can deepen later)
  notableNpcs: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
    }),
  ),

  // Current situation (one line)
  currentEvent: z.string().optional(),

  // Travel info
  nearbyLocations: z
    .array(
      z.object({
        name: z.string(),
        direction: z.string(),
        travelTime: z.string(),
      }),
    )
    .optional(),
});
export type QuickLocationOutput = z.infer<typeof QuickLocationOutputSchema>;

export function buildQuickLocationPrompt(input: QuickLocationInput): string {
  return `
Generate a quick location:

Type: ${input.type}
${input.context ? `Context: ${input.context}` : ""}
${input.size ? `Size: ${input.size}` : ""}
${input.atmosphere ? `Atmosphere: ${input.atmosphere}` : ""}
${input.mustHave?.length ? `Must include: ${input.mustHave.join(", ")}` : ""}
${input.nearbyLocation ? `Near: ${input.nearbyLocation}` : ""}

Provide:
1. Name (evocative, memorable)
2. Type
3. One-paragraph description
4. Atmosphere (one sentence)
5. 3-5 key features
6. 2-3 notable NPCs (name + role only)
7. Current situation (optional, something happening)

Keep it brief and immediately usable. Details can be generated later.
`.trim();
}

// ============================================
// QUICK LOOT GENERATOR
// ============================================

export const QuickLootInputSchema = z.object({
  context: z.string(), // "Bandit chest", "Dragon hoard", "Merchant inventory"
  partyLevel: z.number().int().optional(),
  value: z.enum(["poor", "modest", "valuable", "rich", "legendary"]).optional(),
  mustInclude: z.string().optional(), // "A magic weapon"
  numberOfItems: z.number().int().default(5),
});
export type QuickLootInput = z.infer<typeof QuickLootInputSchema>;

export const QuickLootOutputSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      value: z.string(), // "50 gp", "Priceless"
      magical: z.boolean(),
      noteworthy: z.boolean(), // Worth creating as an asset?
    }),
  ),
  totalValue: z.string(),
  hiddenItem: z
    .object({
      name: z.string(),
      description: z.string(),
      findDC: z.number().int(),
    })
    .optional(),
});
export type QuickLootOutput = z.infer<typeof QuickLootOutputSchema>;

// ============================================
// QUICK ENCOUNTER GENERATOR
// ============================================

export const QuickEncounterInputSchema = z.object({
  context: z.string(), // "Forest path", "Dungeon room", "City street"
  type: z.enum(["combat", "social", "exploration", "puzzle", "trap"]),
  difficulty: z.enum(["easy", "medium", "hard", "deadly"]).optional(),
  partyLevel: z.number().int().optional(),
  partySize: z.number().int().optional(),
  mustInclude: z.string().optional(),
});
export type QuickEncounterInput = z.infer<typeof QuickEncounterInputSchema>;

export const QuickEncounterOutputSchema = z.object({
  title: z.string(),
  type: z.string(),
  description: z.string(),

  // Setup
  setup: z.string(), // Read-aloud or situation description

  // For combat
  enemies: z
    .array(
      z.object({
        name: z.string(),
        count: z.number().int(),
        cr: z.string(),
        tactics: z.string(),
      }),
    )
    .optional(),

  // For social
  npc: z
    .object({
      name: z.string(),
      goal: z.string(),
      approach: z.string(),
      dcToConvince: z.number().int(),
    })
    .optional(),

  // For exploration/puzzle
  challenge: z
    .object({
      description: z.string(),
      solution: z.string(),
      hints: z.array(z.string()),
      dcToSolve: z.number().int(),
    })
    .optional(),

  // For trap
  trap: z
    .object({
      trigger: z.string(),
      effect: z.string(),
      damage: z.string(),
      saveDC: z.number().int(),
      disarmDC: z.number().int(),
    })
    .optional(),

  // Outcomes
  outcomes: z.object({
    success: z.string(),
    failure: z.string(),
    twist: z.string().optional(),
  }),

  // Loot/reward
  reward: z.string().optional(),
});
export type QuickEncounterOutput = z.infer<typeof QuickEncounterOutputSchema>;

// ============================================
// QUICK RUMOR/HOOK GENERATOR
// ============================================

export const QuickRumorInputSchema = z.object({
  location: z.string(),
  source: z.string().optional(), // "Tavern gossip", "Guard", "Merchant"
  theme: z.string().optional(), // "Danger", "Treasure", "Mystery"
  relatedToQuest: z.string().optional(),
  truthfulness: z
    .enum(["true", "mostly_true", "half_true", "mostly_false", "false"])
    .optional(),
});
export type QuickRumorInput = z.infer<typeof QuickRumorInputSchema>;

export const QuickRumorOutputSchema = z.object({
  rumor: z.string(), // What people are saying
  source: z.string(), // Who's saying it

  truth: z.object({
    level: z.string(), // How true it is
    actualTruth: z.string(), // What's really going on
  }),

  // If investigated
  investigation: z.object({
    leadTo: z.string(), // Where this leads
    keyNpc: z.string().optional(), // Who knows more
    keyLocation: z.string().optional(), // Where to look
  }),

  // Hook potential
  questPotential: z.object({
    isHook: z.boolean(),
    hookType: z.string().optional(),
    estimatedScope: z.string().optional(),
  }),
});
export type QuickRumorOutput = z.infer<typeof QuickRumorOutputSchema>;

// ============================================
// BATCH GENERATION (for town populating)
// ============================================

export const BatchNpcRequestSchema = z.object({
  location: z.string(),
  roles: z.array(z.string()), // ["Mayor", "Blacksmith", "Innkeeper", "Guard Captain"]
  commonSpecies: z.string().optional(),
  tone: z.string().optional(), // "Suspicious of strangers", "Welcoming"
});
export type BatchNpcRequest = z.infer<typeof BatchNpcRequestSchema>;

export const BatchLocationRequestSchema = z.object({
  parentLocation: z.string(),
  types: z.array(z.string()), // ["Temple", "Market", "Barracks", "Slums"]
  atmosphere: z.string().optional(),
});
export type BatchLocationRequest = z.infer<typeof BatchLocationRequestSchema>;

// ============================================
// GENERATION QUEUE (for async batch ops)
// ============================================

export const GenerationQueueItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["npc", "location", "item", "encounter", "loot", "rumor"]),
  input: z.record(z.unknown()),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z
    .enum(["queued", "generating", "complete", "failed"])
    .default("queued"),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  completedAt: z.date().optional(),
});
export type GenerationQueueItem = z.infer<typeof GenerationQueueItemSchema>;

// ============================================
// THE BUTTON FLOWS
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUICK GENERATION PANEL                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 👤 NPC      │ │ 📍 Location │ │ ⚔️ Encounter│ │ 💰 Loot     │       │
│  │             │ │             │ │             │ │             │       │
│  │ "Guard"     │ │ "Tavern"    │ │ "Ambush"    │ │ "Chest"     │       │
│  │ [Generate]  │ │ [Generate]  │ │ [Generate]  │ │ [Generate]  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │ 📜 Rumor    │ │ 🏘️ Town     │ │ 🎲 Random   │                       │
│  │             │ │             │ │             │                       │
│  │ "Tavern"    │ │ "5 NPCs,    │ │ "Surprise   │                       │
│  │ [Generate]  │ │  4 places"  │ │  me"        │                       │
│  └─────────────┘ └─────────────┘ └─────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼ (Click "NPC" → type "Guard Captain")

┌─────────────────────────────────────────────────────────────────────────┐
│  ⚡ GENERATING...                                                       │
└─────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼ (0.5 seconds later)

┌─────────────────────────────────────────────────────────────────────────┐
│  👤 CAPTAIN MARTHA IRONWOOD                               [Save] [Edit] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Human female • Guard Captain • STUB                                    │
│                                                                         │
│  "Stern, fair, veteran of the Orc Wars"                                │
│                                                                         │
│  Traits: Stern, Fair, Protective                                       │
│  Quirk: Unconsciously touches old scar when lying is mentioned          │
│  Voice: "Clipped military speech, rarely raises voice"                  │
│                                                                         │
│  Example: "State your business. Quickly."                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 📊 ADD COMBAT STATS  │  ⬆️ DEEPEN  │  🔗 CONNECT TO...          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼ (Party keeps interacting, GM clicks DEEPEN)

┌─────────────────────────────────────────────────────────────────────────┐
│  👤 CAPTAIN MARTHA IRONWOOD                         [Save] [Edit] ⭐    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Human female • Guard Captain • DEVELOPED                               │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════    │
│  STATS: AC 16 | HP 52 | Speed 30ft                                      │
│  STR 16 (+3) DEX 14 (+2) CON 14 (+2) INT 12 (+1) WIS 15 (+2) CHA 14 (+2)│
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                         │
│  MOTIVATIONS                                                            │
│  • Wants: Order, justice, to protect the innocent                       │
│  • Fears: Failing her soldiers, corruption spreading                    │
│  • Secret: Her brother joined the cult she's investigating              │
│                                                                         │
│  KNOWLEDGE                                                              │
│  • Guard operations [Expert, will share]                                │
│  • Cult activity [Informed, DC 15 to share]                             │
│  • Duke's politics [Surface, won't share]                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ ⬆️ FULL CHARACTER   │  🎭 VOICE PROFILE  │  🔗 MAP CONNECTIONS   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  SUGGESTED CONNECTIONS:                                                 │
│  • Brother → Cult of the Dragon (create NPC?)                           │
│  • Reports to → Duke Maldwyn (create NPC?)                              │
│  • Guards → The Barracks (create location?)                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
*/

// ============================================
// AUTO-DEEPEN TRIGGERS
// ============================================

export const AutoDeepenTriggerSchema = z.object({
  assetId: z.string().uuid(),

  // Conditions that trigger auto-deepen
  trigger: z.enum([
    "interaction_count", // After N interactions
    "combat_involvement", // NPC was in combat
    "quest_involvement", // Asset tied to quest
    "player_interest", // Players asked about them repeatedly
    "time_in_session", // Spent X minutes with this asset
    "gm_bookmark", // GM starred/bookmarked
    "recurring_mention", // Mentioned in multiple sessions
  ]),

  threshold: z.number().optional(),

  // What level to deepen to
  targetLevel: DetailLevelSchema,

  // Auto or suggest?
  autoGenerate: z.boolean().default(false),
});
export type AutoDeepenTrigger = z.infer<typeof AutoDeepenTriggerSchema>;

// Default triggers
export const DefaultAutoDeepen: AutoDeepenTrigger[] = [
  // After 3 interactions, suggest deepening to BASIC
  {
    assetId: "",
    trigger: "interaction_count",
    threshold: 3,
    targetLevel: "basic",
    autoGenerate: false,
  },

  // If in combat, need DEVELOPED for stats
  {
    assetId: "",
    trigger: "combat_involvement",
    targetLevel: "developed",
    autoGenerate: true,
  },

  // If tied to quest, should be at least DEVELOPED
  {
    assetId: "",
    trigger: "quest_involvement",
    targetLevel: "developed",
    autoGenerate: false,
  },

  // If mentioned in 3+ sessions, suggest FULL
  {
    assetId: "",
    trigger: "recurring_mention",
    threshold: 3,
    targetLevel: "full",
    autoGenerate: false,
  },

  // GM bookmarked = important, suggest INTEGRATED
  {
    assetId: "",
    trigger: "gm_bookmark",
    targetLevel: "integrated",
    autoGenerate: false,
  },
];

// ============================================
// INTERACTION TRACKING
// ============================================

export const AssetInteractionSchema = z.object({
  assetId: z.string().uuid(),
  sessionId: z.string().uuid(),
  interactionType: z.enum([
    "mentioned", // GM or player mentioned
    "spoke_with", // Dialogue with NPC
    "visited", // Went to location
    "used", // Used item
    "combat", // Combat involving asset
    "investigated", // Actively looked into
    "quest_related", // Part of quest
    "bookmarked", // GM marked as important
  ]),
  timestamp: z.date().default(() => new Date()),
  notes: z.string().optional(),
});
export type AssetInteraction = z.infer<typeof AssetInteractionSchema>;

export function checkDeepenSuggestion(
  assetId: string,
  currentLevel: DetailLevel,
  interactions: AssetInteraction[],
): {
  shouldSuggest: boolean;
  targetLevel: DetailLevel;
  reason: string;
} | null {
  const interactionCount = interactions.length;
  const hasCombat = interactions.some((i) => i.interactionType === "combat");
  const hasQuest = interactions.some(
    (i) => i.interactionType === "quest_related",
  );
  const isBookmarked = interactions.some(
    (i) => i.interactionType === "bookmarked",
  );
  const sessionCount = new Set(interactions.map((i) => i.sessionId)).size;

  // Already at max level
  if (currentLevel === "integrated") return null;

  // Combat needs stats NOW
  if (hasCombat && (currentLevel === "stub" || currentLevel === "basic")) {
    return {
      shouldSuggest: true,
      targetLevel: "developed",
      reason: "Combat encounter requires full stats",
    };
  }

  // Quest involvement should be developed
  if (hasQuest && currentLevel === "stub") {
    return {
      shouldSuggest: true,
      targetLevel: "developed",
      reason: "Quest-related asset should be fleshed out",
    };
  }

  // Recurring across sessions
  if (
    sessionCount >= 3 &&
    currentLevel !== "full" &&
    currentLevel !== "integrated"
  ) {
    return {
      shouldSuggest: true,
      targetLevel: "full",
      reason: `Appeared in ${sessionCount} sessions - worth full development`,
    };
  }

  // Bookmarked = important
  if (isBookmarked && currentLevel !== "integrated") {
    return {
      shouldSuggest: true,
      targetLevel: "integrated",
      reason: "Bookmarked as important - integrate into campaign",
    };
  }

  // Many interactions
  if (interactionCount >= 5 && currentLevel === "stub") {
    return {
      shouldSuggest: true,
      targetLevel: "basic",
      reason: "Frequent interactions - add more detail",
    };
  }

  return null;
}
