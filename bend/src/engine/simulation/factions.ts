import { z } from "zod";
import { ResourceTypeSchema } from "./downtime";

// ============================================
// FACTION & POLITICAL SYSTEM
// ============================================
//
// The world doesn't wait for the players.
// During downtime, factions act too:
//   - Make alliances
//   - Plot against rivals
//   - Expand influence
//   - Pursue goals
//   - React to player actions
//
// This creates a LIVING WORLD where:
//   - The political landscape shifts
//   - Opportunities appear and disappear
//   - Consequences ripple outward
//   - Players' choices matter
//

// ============================================
// FACTION (NPC Factions)
// ============================================

export const FactionSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  type: z.string(), // "Noble House", "Thieves Guild", "Church", etc.
  description: z.string().optional(),

  // Power & Reach
  tier: z.number().int().min(1).max(5).default(2),
  influence: z.number().int().min(0).max(100).default(50),
  resources: z.number().int().min(0).max(100).default(50),
  military: z.number().int().min(0).max(100).default(50),

  // Territory
  headquarters: z.string().optional(),
  territories: z.array(z.string()).default([]),

  // Leadership
  leader: z
    .object({
      npcId: z.string().uuid().optional(),
      name: z.string(),
      title: z.string(),
    })
    .optional(),

  // Goals
  goals: z
    .array(
      z.object({
        id: z.string().uuid(),
        description: z.string(),
        priority: z.enum(["low", "medium", "high", "critical"]),
        progress: z.number().int().min(0).max(100).default(0),
        deadline: z.string().optional(), // World date
        secret: z.boolean().default(false),
      }),
    )
    .default([]),

  // Relationships with other factions
  relationships: z
    .array(
      z.object({
        factionId: z.string().uuid(),
        factionName: z.string(),
        standing: z.number().int().min(-100).max(100).default(0),
        // -100 to -50: At war/mortal enemies
        // -50 to -20: Hostile
        // -20 to 20: Neutral
        // 20 to 50: Friendly
        // 50 to 100: Allied
        publicStance: z.enum([
          "war",
          "hostile",
          "cold",
          "neutral",
          "warm",
          "friendly",
          "allied",
        ]),
        secretStance: z
          .enum([
            "war",
            "hostile",
            "cold",
            "neutral",
            "warm",
            "friendly",
            "allied",
          ])
          .optional(),
        treaties: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  // Relationship with party
  partyStanding: z.number().int().min(-100).max(100).default(0),
  partyRelationHistory: z
    .array(
      z.object({
        event: z.string(),
        change: z.number().int(),
        date: z.string().optional(),
      }),
    )
    .default([]),

  // AI behavior
  behavior: z.object({
    aggression: z.number().int().min(0).max(10).default(5),
    caution: z.number().int().min(0).max(10).default(5),
    opportunism: z.number().int().min(0).max(10).default(5),
    loyalty: z.number().int().min(0).max(10).default(5), // To allies
    expansionism: z.number().int().min(0).max(10).default(5),
  }),

  // Current state
  currentSchemes: z.array(z.string().uuid()).default([]),
  activeAgents: z.number().int().default(0),

  // Visibility
  knownToParty: z.boolean().default(true),
  partyKnowsGoals: z.boolean().default(false),
  partyKnowsLeader: z.boolean().default(true),
});
export type Faction = z.infer<typeof FactionSchema>;

// ============================================
// FACTION SCHEMES (What they're doing)
// ============================================

export const SchemeTypeSchema = z.enum([
  // Diplomatic
  "form_alliance",
  "break_alliance",
  "peace_negotiation",
  "trade_agreement",
  "marriage_alliance",

  // Intrigue
  "espionage",
  "sabotage",
  "assassination",
  "blackmail",
  "spread_rumors",
  "infiltrate",

  // Military
  "raise_army",
  "fortify",
  "raid",
  "conquest",
  "siege",
  "defend",

  // Economic
  "trade_monopoly",
  "economic_warfare",
  "establish_business",
  "acquire_resources",

  // Political
  "gain_influence",
  "undermine_rival",
  "install_puppet",
  "coup",
  "rebellion",

  // Other
  "research",
  "ritual",
  "recruitment",
  "expansion",
]);
export type SchemeType = z.infer<typeof SchemeTypeSchema>;

export const FactionSchemeSchema = z.object({
  id: z.string().uuid(),
  factionId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // What
  type: SchemeTypeSchema,
  name: z.string(),
  description: z.string(),

  // Target
  target: z
    .object({
      type: z.enum([
        "faction",
        "settlement",
        "character",
        "territory",
        "abstract",
      ]),
      id: z.string().uuid().optional(),
      name: z.string(),
    })
    .optional(),

  // Progress
  status: z.enum([
    "planning",
    "active",
    "paused",
    "completed",
    "failed",
    "discovered",
  ]),
  progress: z.number().int().min(0).max(100).default(0),
  progressPerDay: z.number().default(5), // Base progress rate

  // Resources committed
  resourcesCommitted: z.object({
    gold: z.number().default(0),
    agents: z.number().int().default(0),
    influence: z.number().default(0),
  }),

  // Timing
  startedAt: z.string().optional(), // World date
  estimatedCompletion: z.string().optional(),
  deadline: z.string().optional(), // Must complete by this date

  // Secrecy
  isSecret: z.boolean().default(true),
  discoveryDC: z.number().int().default(15),
  discovered: z.boolean().default(false),
  discoveredBy: z.array(z.string().uuid()).default([]), // Who knows

  // Opposition
  opposition: z
    .array(
      z.object({
        factionId: z.string().uuid(),
        factionName: z.string(),
        counterEffort: z.number().int(), // Slows progress
      }),
    )
    .default([]),

  // Outcomes
  successOutcome: z.string(),
  failureOutcome: z.string(),
  partialOutcome: z.string().optional(),

  // Consequences (for world state)
  consequenceOnSuccess: z
    .array(
      z.object({
        type: z.string(),
        target: z.string(),
        effect: z.string(),
      }),
    )
    .default([]),
});
export type FactionScheme = z.infer<typeof FactionSchemeSchema>;

// ============================================
// FACTION TURN (What happens during downtime)
// ============================================

export const FactionTurnSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  downtimePeriodId: z.string().uuid(),

  // Which faction
  factionId: z.string().uuid(),
  factionName: z.string(),

  // Actions taken
  actions: z
    .array(
      z.object({
        type: z.string(),
        description: z.string(),
        target: z.string().optional(),
        outcome: z.string(),
        visible: z.boolean(), // Did the party see this?
      }),
    )
    .default([]),

  // Schemes progressed
  schemesProgressed: z
    .array(
      z.object({
        schemeId: z.string().uuid(),
        progressMade: z.number().int(),
        newStatus: z.string().optional(),
      }),
    )
    .default([]),

  // Relationship changes
  relationshipChanges: z
    .array(
      z.object({
        targetFactionId: z.string().uuid(),
        targetName: z.string(),
        previousStanding: z.number().int(),
        newStanding: z.number().int(),
        reason: z.string(),
      }),
    )
    .default([]),

  // Resource changes
  resourceChanges: z.object({
    influence: z.number().int().default(0),
    resources: z.number().int().default(0),
    military: z.number().int().default(0),
  }),

  // Events triggered
  eventsTriggered: z.array(z.string()).default([]),

  // Summary for GM
  summary: z.string(),
  importantForParty: z.boolean().default(false),
});
export type FactionTurn = z.infer<typeof FactionTurnSchema>;

// ============================================
// FACTION AI - Decision Making
// ============================================

export function buildFactionTurnPrompt(
  faction: Faction,
  context: {
    worldState: string;
    recentEvents: string[];
    partyActions: string[];
    factionGoals: string[];
    availableResources: { gold: number; agents: number; influence: number };
    otherFactionActions: string[];
    knownThreats: string[];
    knownOpportunities: string[];
  },
): string {
  return `
# FACTION TURN: ${faction.name}

You are the AI determining what this faction does during the downtime period.

## FACTION PROFILE
Name: ${faction.name}
Type: ${faction.type}
Tier: ${faction.tier}/5
Leader: ${faction.leader?.name ?? "Unknown"} (${faction.leader?.title ?? ""})

## RESOURCES
- Influence: ${faction.influence}/100
- Resources: ${faction.resources}/100
- Military: ${faction.military}/100
- Available Agents: ${context.availableResources.agents}
- Available Gold: ${context.availableResources.gold}

## BEHAVIOR PROFILE
- Aggression: ${faction.behavior.aggression}/10
- Caution: ${faction.behavior.caution}/10
- Opportunism: ${faction.behavior.opportunism}/10
- Loyalty to Allies: ${faction.behavior.loyalty}/10
- Expansionism: ${faction.behavior.expansionism}/10

## CURRENT GOALS
${context.factionGoals.map((g, i) => `${i + 1}. ${g}`).join("\n")}

## WORLD STATE
${context.worldState}

## RECENT EVENTS
${context.recentEvents.map((e) => `- ${e}`).join("\n")}

## PARTY ACTIONS THIS PERIOD
${context.partyActions.length ? context.partyActions.map((a) => `- ${a}`).join("\n") : "None observed"}

## OTHER FACTIONS' ACTIONS
${context.otherFactionActions.length ? context.otherFactionActions.map((a) => `- ${a}`).join("\n") : "None observed"}

## KNOWN THREATS
${context.knownThreats.length ? context.knownThreats.map((t) => `- ${t}`).join("\n") : "None"}

## KNOWN OPPORTUNITIES
${context.knownOpportunities.length ? context.knownOpportunities.map((o) => `- ${o}`).join("\n") : "None"}

## RELATIONSHIPS
${faction.relationships
  .map((r) => `- ${r.factionName}: ${r.publicStance} (${r.standing})`)
  .join("\n")}
- Player Party: Standing ${faction.partyStanding}

## YOUR TASK

Determine what ${faction.name} does this downtime period:

1. **Primary Action**: One significant action the faction takes
2. **Secondary Actions**: 1-2 minor actions (if resources allow)
3. **Scheme Progress**: How much progress on existing schemes?
4. **New Schemes**: Start any new schemes?
5. **Relationship Moves**: Any diplomatic overtures or hostilities?
6. **Reactions**: How do they react to party actions or other events?

Consider:
- Their goals and priorities
- Their behavioral profile
- Available resources
- Opportunities and threats
- Relationships and alliances

For each action, specify:
- What they do
- Whether it's visible to the party
- Resource cost (if any)
- Likely outcome
- Consequences for the world

Be consistent with the faction's established character.
`.trim();
}

// ============================================
// POLITICAL MAP
// ============================================

export const PoliticalMapSchema = z.object({
  campaignId: z.string().uuid(),

  // All factions
  factions: z.array(z.string().uuid()),

  // Relationship matrix (for quick lookup)
  relationshipMatrix: z.record(
    z.string(), // faction1Id
    z.record(
      z.string(), // faction2Id
      z.number().int(), // standing
    ),
  ),

  // Current state
  atWar: z
    .array(
      z.object({
        faction1: z.string().uuid(),
        faction2: z.string().uuid(),
        startDate: z.string(),
        casualties: z.object({
          faction1: z.number().int(),
          faction2: z.number().int(),
        }),
      }),
    )
    .default([]),

  alliances: z
    .array(
      z.object({
        members: z.array(z.string().uuid()),
        name: z.string(),
        type: z.enum(["mutual_defense", "trade", "political", "secret"]),
        formed: z.string(),
      }),
    )
    .default([]),

  // Tension hotspots
  tensions: z
    .array(
      z.object({
        factions: z.array(z.string().uuid()),
        reason: z.string(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        likelyOutcome: z.string(),
      }),
    )
    .default([]),

  // Recent changes
  recentChanges: z
    .array(
      z.object({
        date: z.string(),
        description: z.string(),
        factionsInvolved: z.array(z.string().uuid()),
        significance: z.enum(["minor", "moderate", "major", "historic"]),
      }),
    )
    .default([]),
});
export type PoliticalMap = z.infer<typeof PoliticalMapSchema>;

// ============================================
// INTRIGUE & SECRETS
// ============================================

export const PoliticalSecretSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // What
  type: z.enum([
    "affair",
    "bastard",
    "debt",
    "crime",
    "betrayal",
    "secret_alliance",
    "hidden_identity",
    "forbidden_magic",
    "conspiracy",
    "weakness",
    "corruption",
    "heresy",
  ]),
  description: z.string(),
  truth: z.string(),

  // Who
  subjectId: z.string().uuid().optional(),
  subjectName: z.string(),
  subjectType: z.enum(["npc", "faction", "character"]),

  // Who knows
  knownBy: z
    .array(
      z.object({
        entityId: z.string().uuid(),
        entityName: z.string(),
        howLearned: z.string(),
        wouldReveal: z.boolean(), // Would they tell if asked?
      }),
    )
    .default([]),

  partyKnows: z.boolean().default(false),

  // Consequences if revealed
  consequenceIfRevealed: z.object({
    description: z.string(),
    affectedEntities: z.array(z.string().uuid()),
    severity: z.enum(["embarrassing", "damaging", "devastating", "fatal"]),
  }),

  // Blackmail value
  blackmailValue: z
    .object({
      gold: z.number().optional(),
      favor: z.string().optional(),
      influence: z.number().optional(),
    })
    .optional(),
});
export type PoliticalSecret = z.infer<typeof PoliticalSecretSchema>;

// ============================================
// GM WORLD UPDATE PANEL
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│  🌍 WORLD UPDATE - Marpenoth 15-21 Downtime                    [Generate]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚔️ FACTION ACTIONS THIS PERIOD                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🏰 House Blackwood                                           Tier 3 │    │
│  │ PRIMARY: Sent envoy to Duke requesting trade rights                 │    │
│  │ SCHEME: "Undermine House Ravencrest" - 45% → 52%                    │    │
│  │ VISIBLE TO PARTY: Yes (they saw the envoy)                          │    │
│  │ [✓ Approve] [✏️ Modify] [👁️ Hide from Party]                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🗡️ Cult of the Dragon                                        Tier 2 │    │
│  │ PRIMARY: Recruited 20 new cultists in Waterdeep                     │    │
│  │ SCHEME: "Awaken Severin" - 78% → 85% ⚠️ NEARING COMPLETION           │    │
│  │ REACTION: Increased security after party's spy was caught           │    │
│  │ VISIBLE TO PARTY: No                                                │    │
│  │ [✓ Approve] [✏️ Modify] [👁️ Reveal to Party]                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ⚖️ Lords' Alliance                                           Tier 4 │    │
│  │ PRIMARY: Called emergency summit about cult activity                │    │
│  │ DIPLOMATIC: Improved relations with Harpers (+5)                    │    │
│  │ REACTION: Investigating party (they've noticed them)                │    │
│  │ VISIBLE TO PARTY: Partially (they hear about the summit)            │    │
│  │ [✓ Approve] [✏️ Modify] [👁️ Details]                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  📊 RELATIONSHIP CHANGES                                                    │
│  • House Blackwood ↔ House Ravencrest: 12 → 5 (worsening)                  │
│  • Lords' Alliance ↔ Harpers: 45 → 50 (improving)                          │
│  • Cult ↔ Party: -30 → -50 (now hostile)                                   │
│                                                                             │
│  ⚠️ ALERTS                                                                  │
│  • Cult scheme nearing completion - party should be warned?                │
│  • Two factions now investigating the party                                │
│                                                                             │
│  [Apply All & Generate Summary] [Save Draft] [Regenerate]                  │
└─────────────────────────────────────────────────────────────────────────────┘
*/
