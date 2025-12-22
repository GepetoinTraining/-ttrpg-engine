import { z } from "zod";
import { AbilitySchema } from "../rules/core";

// ============================================
// PLAYER CONTRIBUTION SYSTEM
// ============================================
//
// Philosophy: ENGAGEMENT IS THE LEVER
//
// Problem:
//   High CHA character should have more social power.
//   But just giving them more actions breaks balance.
//   Players who don't engage get bored.
//   GMs can't reward effort without seeming arbitrary.
//
// Solution:
//   Quality multipliers on actions.
//   Session diaries that feed bonuses.
//   Written contributions = mechanical rewards.
//   The game rewards those who PLAY the game.
//
// The Loop:
//   1. Player writes quality action description
//   2. AI + GM evaluate contribution
//   3. Bonuses applied to resolution
//   4. Player sees that effort matters
//   5. Player engages more
//   6. Richer game for everyone
//

// ============================================
// ACTION QUALITY TIERS
// ============================================

export const ActionQualityTierSchema = z.enum([
  "minimal", // "I send a letter" - no bonus
  "basic", // "I send a letter to the Duke asking for help" - +1
  "detailed", // Includes context, reasoning, approach - +2
  "immersive", // Written in character, compelling, creative - +3
  "exceptional", // Full roleplay, artwork, props, or extraordinary effort - +5
]);
export type ActionQualityTier = z.infer<typeof ActionQualityTierSchema>;

export const QualityTierBonus: Record<ActionQualityTier, number> = {
  minimal: 0,
  basic: 1,
  detailed: 2,
  immersive: 3,
  exceptional: 5,
};

// ============================================
// ACTION CONTRIBUTION
// ============================================

export const ActionContributionSchema = z.object({
  actionId: z.string().uuid(),
  characterId: z.string().uuid(),

  // The raw contribution
  contribution: z.object({
    // Written description of what they're doing
    description: z.string(),
    wordCount: z.number().int(),

    // Optional: In-character writing (letters, speeches, etc.)
    inCharacterContent: z.string().optional(),

    // Optional: Reasoning and strategy
    reasoning: z.string().optional(),

    // Optional: Connection to character goals/backstory
    characterConnection: z.string().optional(),

    // Optional: Connection to recent session events
    sessionConnection: z.string().optional(),

    // Optional: Attachments (maps, portraits, documents)
    attachments: z
      .array(
        z.object({
          type: z.enum(["image", "document", "audio", "map"]),
          url: z.string(),
          description: z.string(),
        }),
      )
      .default([]),
  }),

  // AI Evaluation
  aiEvaluation: z
    .object({
      qualityTier: ActionQualityTierSchema,

      // Breakdown
      scores: z.object({
        clarity: z.number().int().min(0).max(5), // Is it clear what they want?
        creativity: z.number().int().min(0).max(5), // Is it creative/clever?
        immersion: z.number().int().min(0).max(5), // Is it in-character?
        relevance: z.number().int().min(0).max(5), // Does it connect to the game?
        effort: z.number().int().min(0).max(5), // How much work did they put in?
      }),

      totalScore: z.number().int(),

      // Specific bonuses granted
      bonuses: z
        .array(
          z.object({
            type: z.string(), // "roll_bonus", "advantage", "extra_effect"
            value: z.number().optional(),
            description: z.string(),
          }),
        )
        .default([]),

      // Narrative hooks extracted
      narrativeHooks: z.array(z.string()).default([]),

      // AI notes for GM
      notes: z.string().optional(),
    })
    .optional(),

  // GM Override
  gmOverride: z
    .object({
      qualityTier: ActionQualityTierSchema.optional(),
      bonusAdjustment: z.number().int().optional(),
      additionalBonus: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),

  // Final bonus applied
  finalBonus: z.number().int().default(0),
});
export type ActionContribution = z.infer<typeof ActionContributionSchema>;

// ============================================
// CONTRIBUTION EVALUATION PROMPT
// ============================================

export function buildContributionEvalPrompt(
  contribution: ActionContribution["contribution"],
  context: {
    actionType: string;
    actionTemplate: string;
    characterName: string;
    characterClass: string;
    characterGoals: string[];
    recentSessionEvents: string[];
  },
): string {
  return `
# EVALUATE PLAYER CONTRIBUTION

A player has submitted a downtime action. Evaluate the quality of their contribution.

## ACTION TYPE
${context.actionType}
Standard template: ${context.actionTemplate}

## CHARACTER
${context.characterName}, ${context.characterClass}
Personal goals: ${context.characterGoals.join(", ")}

## RECENT SESSION EVENTS
${context.recentSessionEvents.map((e) => `- ${e}`).join("\n")}

## PLAYER'S CONTRIBUTION

**Description** (${contribution.wordCount} words):
${contribution.description}

${
  contribution.inCharacterContent
    ? `
**In-Character Content**:
${contribution.inCharacterContent}
`
    : ""
}

${
  contribution.reasoning
    ? `
**Player's Reasoning**:
${contribution.reasoning}
`
    : ""
}

${
  contribution.characterConnection
    ? `
**Connection to Character**:
${contribution.characterConnection}
`
    : ""
}

${
  contribution.sessionConnection
    ? `
**Connection to Session**:
${contribution.sessionConnection}
`
    : ""
}

${
  contribution.attachments.length
    ? `
**Attachments**: ${contribution.attachments.map((a) => a.description).join(", ")}
`
    : ""
}

## EVALUATION CRITERIA

Rate each 0-5:
1. **Clarity**: Is it clear what they want to accomplish?
2. **Creativity**: Is their approach creative or clever?
3. **Immersion**: Is it written in-character or immersively?
4. **Relevance**: Does it connect to their character or recent events?
5. **Effort**: How much thought/work did they put in?

## QUALITY TIERS

- **Minimal** (0-5 total): Just a button click, no description
- **Basic** (6-10 total): Simple description of intent
- **Detailed** (11-15 total): Context, reasoning, approach explained
- **Immersive** (16-20 total): In-character writing, creative, compelling
- **Exceptional** (21-25 total): Extraordinary effort, props, full roleplay

## OUTPUT

Provide:
1. Scores for each criterion
2. Total score and quality tier
3. Specific bonuses to grant:
   - roll_bonus: +N to the check
   - advantage: Roll twice, take higher
   - extra_effect: Additional beneficial outcome
   - narrative_weight: This action matters more to the story
4. Any narrative hooks extracted (things the GM can use)
5. Notes for the GM

Be generous but fair. Reward engagement without making it feel mandatory.
`.trim();
}

// ============================================
// SESSION DIARY
// ============================================

export const SessionDiarySchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  characterId: z.string().uuid(),
  playerId: z.string().uuid(),

  // When written
  submittedAt: z.date(),
  submittedBefore: z.string().uuid().optional(), // Before which session

  // The content
  content: z.object({
    // Required: What happened from their perspective
    summary: z.string(),

    // Required: What did they notice/find interesting?
    observations: z
      .array(
        z.object({
          observation: z.string(),
          category: z.enum([
            "npc_behavior", // "The innkeeper seemed nervous"
            "plot_clue", // "The symbol matched the cult's"
            "world_detail", // "The town was unusually quiet"
            "character_moment", // "Theron's speech was inspiring"
            "combat_tactic", // "The goblins retreated when flanked"
            "mystery", // "Who sent the assassin?"
            "opportunity", // "The merchant might be an ally"
            "threat", // "The cult knows we're coming"
            "other",
          ]),
        }),
      )
      .min(1),

    // Required: What do they want to pursue next?
    pursuits: z
      .array(
        z.object({
          goal: z.string(),
          priority: z.enum(["curious", "interested", "important", "urgent"]),
          approach: z.string().optional(), // How they might pursue it
        }),
      )
      .min(1),

    // Optional: Character feelings/reactions
    characterReflection: z.string().optional(),

    // Optional: Theories about the plot
    theories: z
      .array(
        z.object({
          theory: z.string(),
          confidence: z.enum(["wild_guess", "hunch", "likely", "certain"]),
          evidence: z.string().optional(),
        }),
      )
      .optional(),

    // Optional: Questions for the GM
    questionsForGM: z.array(z.string()).optional(),

    // Optional: Feedback on the session
    sessionFeedback: z
      .object({
        highlights: z.array(z.string()).optional(),
        improvements: z.array(z.string()).optional(),
        rating: z.number().int().min(1).max(5).optional(),
      })
      .optional(),

    // Optional: In-character journal entry
    inCharacterJournal: z.string().optional(),
  }),

  // Word count for contribution tracking
  wordCount: z.number().int(),

  // AI Processing
  aiProcessing: z
    .object({
      processed: z.boolean().default(false),

      // Extracted elements
      extractedNpcs: z.array(z.string()).default([]),
      extractedLocations: z.array(z.string()).default([]),
      extractedPlotPoints: z.array(z.string()).default([]),

      // Generated bonuses
      generatedBonuses: z
        .array(
          z.object({
            type: z.enum([
              "session_bonus", // Bonus for next session
              "downtime_bonus", // Bonus for specific downtime action
              "knowledge_bonus", // Character learns something
              "relationship_bonus", // Bonus with specific NPC
              "skill_bonus", // Temporary skill bonus
              "inspiration", // D&D inspiration point
            ]),
            target: z.string(), // What it applies to
            value: z.number().optional(),
            duration: z.string().optional(), // "next_session", "permanent", etc.
            reason: z.string(),
          }),
        )
        .default([]),

      // GM hooks generated
      gmHooks: z
        .array(
          z.object({
            hook: z.string(),
            source: z.string(), // Which observation/theory triggered this
            urgency: z.enum([
              "whenever",
              "soon",
              "next_session",
              "immediately",
            ]),
          }),
        )
        .default([]),

      // Narrative weight
      narrativeWeight: z.number().int().min(0).max(10).default(5),
    })
    .optional(),

  // GM Review
  gmReview: z
    .object({
      reviewed: z.boolean().default(false),
      bonusesApproved: z.array(z.string()).default([]),
      bonusesModified: z
        .array(
          z.object({
            originalId: z.string(),
            newValue: z.number().optional(),
            notes: z.string(),
          }),
        )
        .default([]),
      additionalBonuses: z
        .array(
          z.object({
            type: z.string(),
            value: z.number().optional(),
            reason: z.string(),
          }),
        )
        .default([]),
      gmNotes: z.string().optional(),
    })
    .optional(),
});
export type SessionDiary = z.infer<typeof SessionDiarySchema>;

// ============================================
// DIARY PROCESSING PROMPT
// ============================================

export function buildDiaryProcessingPrompt(
  diary: SessionDiary,
  context: {
    sessionSummary: string;
    characterInfo: string;
    activeQuests: string[];
    activeSecrets: string[]; // Things the player might have noticed
    npcRelationships: Record<string, number>;
  },
): string {
  return `
# PROCESS SESSION DIARY

A player has submitted their session diary. Extract useful information and generate appropriate bonuses.

## SESSION SUMMARY (GM's version)
${context.sessionSummary}

## CHARACTER
${context.characterInfo}

## ACTIVE QUESTS
${context.activeQuests.map((q) => `- ${q}`).join("\n")}

## SECRETS THAT COULD BE NOTICED
${context.activeSecrets.map((s) => `- ${s}`).join("\n")}

## PLAYER'S DIARY

**Summary** (${diary.wordCount} words):
${diary.content.summary}

**Observations**:
${diary.content.observations.map((o) => `- [${o.category}] ${o.observation}`).join("\n")}

**Pursuits**:
${diary.content.pursuits.map((p) => `- [${p.priority}] ${p.goal}${p.approach ? ` (${p.approach})` : ""}`).join("\n")}

${
  diary.content.characterReflection
    ? `
**Character Reflection**:
${diary.content.characterReflection}
`
    : ""
}

${
  diary.content.theories?.length
    ? `
**Theories**:
${diary.content.theories.map((t) => `- [${t.confidence}] ${t.theory}`).join("\n")}
`
    : ""
}

${
  diary.content.inCharacterJournal
    ? `
**In-Character Journal**:
${diary.content.inCharacterJournal}
`
    : ""
}

## YOUR TASK

1. **Extract NPCs, Locations, Plot Points** they noticed
2. **Evaluate Observations**:
   - Did they notice something important?
   - Did they connect dots correctly?
   - Did they miss something obvious?
3. **Evaluate Theories**:
   - Are any theories correct or close?
   - Should we reward good detective work?
4. **Generate Bonuses**:
   - session_bonus: +N to relevant checks next session
   - downtime_bonus: Advantage on specific downtime actions
   - knowledge_bonus: Character gains specific knowledge
   - relationship_bonus: +N with NPCs they paid attention to
   - inspiration: Grant inspiration point for exceptional insight
5. **Generate GM Hooks**:
   - Things the GM can use based on player interest
   - Ways to reward their engagement
   - Opportunities to reveal what they're seeking

## BONUS GUIDELINES

Be generous with small bonuses (+1, +2) for:
- Paying attention to NPCs
- Connecting plot points
- Writing in-character

Be moderate with medium bonuses (+3, advantage) for:
- Correct theories
- Creative observations
- Detailed character work

Reserve large bonuses (+5, multiple effects) for:
- Exceptional insight
- Extraordinary effort
- Correct predictions about secrets

The goal is to make players feel that engagement is rewarded without making diaries mandatory for success.
`.trim();
}

// ============================================
// ABILITY SCORE LEVERAGE
// ============================================

export const AbilityLeverageSchema = z.object({
  ability: AbilitySchema,

  // How this ability enhances downtime
  downtimeEffects: z.object({
    // Number of enhanced actions (not extra, just better)
    enhancedActions: z.number().int(),

    // Quality cap (how immersive can their actions be rated)
    maxQualityTier: ActionQualityTierSchema,

    // Specific bonuses
    bonuses: z.array(
      z.object({
        actionCategory: z.string(),
        bonusType: z.string(),
        value: z.number().optional(),
      }),
    ),
  }),

  // Follower effects
  followerEffects: z.object({
    // Soft cap on followers (can exceed with effort)
    recommendedFollowers: z.number().int(),

    // Hard cap (system limit)
    maxFollowers: z.number().int(),

    // Bonus to follower actions
    followerBonus: z.number().int(),

    // Follower types that work better
    affinityTypes: z.array(z.string()),
  }),

  // Social effects
  socialEffects: z
    .object({
      // Daily social actions
      socialActionsPerDay: z.number().int(),

      // Relationship building speed
      relationshipMultiplier: z.number(),

      // Network effects (letters get forwarded, etc.)
      networkReach: z.number().int(),
    })
    .optional(),
});
export type AbilityLeverage = z.infer<typeof AbilityLeverageSchema>;

// Default ability leverage tables
export function calculateAbilityLeverage(
  abilityScore: number,
  ability: string,
): AbilityLeverage["downtimeEffects"] {
  const modifier = Math.floor((abilityScore - 10) / 2);

  // Base effects by ability
  const baseEffects: Record<string, () => AbilityLeverage["downtimeEffects"]> =
    {
      STR: () => ({
        enhancedActions: Math.max(0, modifier),
        maxQualityTier:
          modifier >= 3
            ? "exceptional"
            : modifier >= 1
              ? "immersive"
              : "detailed",
        bonuses: [
          {
            actionCategory: "military",
            bonusType: "roll_bonus",
            value: modifier,
          },
          {
            actionCategory: "construction",
            bonusType: "speed",
            value: modifier,
          },
        ],
      }),

      DEX: () => ({
        enhancedActions: Math.max(0, modifier),
        maxQualityTier:
          modifier >= 3
            ? "exceptional"
            : modifier >= 1
              ? "immersive"
              : "detailed",
        bonuses: [
          {
            actionCategory: "intelligence",
            bonusType: "roll_bonus",
            value: modifier,
          },
          {
            actionCategory: "personal",
            bonusType: "training_speed",
            value: modifier,
          },
        ],
      }),

      CON: () => ({
        enhancedActions: Math.max(0, Math.floor(modifier / 2)),
        maxQualityTier: "detailed", // CON doesn't help quality
        bonuses: [
          {
            actionCategory: "personal",
            bonusType: "recovery_speed",
            value: modifier,
          },
          {
            actionCategory: "military",
            bonusType: "endurance",
            value: modifier,
          },
        ],
      }),

      INT: () => ({
        enhancedActions: Math.max(0, modifier),
        maxQualityTier:
          modifier >= 3
            ? "exceptional"
            : modifier >= 1
              ? "immersive"
              : "detailed",
        bonuses: [
          {
            actionCategory: "intelligence",
            bonusType: "roll_bonus",
            value: modifier,
          },
          {
            actionCategory: "magical",
            bonusType: "research_speed",
            value: modifier,
          },
          {
            actionCategory: "economic",
            bonusType: "analysis",
            value: modifier,
          },
        ],
      }),

      WIS: () => ({
        enhancedActions: Math.max(0, modifier),
        maxQualityTier:
          modifier >= 3
            ? "exceptional"
            : modifier >= 1
              ? "immersive"
              : "detailed",
        bonuses: [
          {
            actionCategory: "organizational",
            bonusType: "insight",
            value: modifier,
          },
          {
            actionCategory: "intelligence",
            bonusType: "detection",
            value: modifier,
          },
        ],
      }),

      CHA: () => ({
        enhancedActions: Math.max(0, modifier + 1), // CHA gets extra
        maxQualityTier:
          modifier >= 2
            ? "exceptional"
            : modifier >= 0
              ? "immersive"
              : "detailed",
        bonuses: [
          {
            actionCategory: "political",
            bonusType: "roll_bonus",
            value: modifier,
          },
          {
            actionCategory: "social",
            bonusType: "roll_bonus",
            value: modifier,
          },
          {
            actionCategory: "organizational",
            bonusType: "morale",
            value: modifier,
          },
        ],
      }),
    };

  return (
    baseEffects[ability]?.() ?? {
      enhancedActions: 0,
      maxQualityTier: "detailed",
      bonuses: [],
    }
  );
}

export function calculateFollowerCapacity(charismaScore: number): {
  softCap: number;
  hardCap: number;
  leadershipBonus: number;
} {
  const modifier = Math.floor((charismaScore - 10) / 2);

  // Base: 3 followers
  // +2 per CHA modifier (soft cap)
  // Hard cap is double soft cap
  const softCap = Math.max(1, 3 + modifier * 2);
  const hardCap = softCap * 2;

  return {
    softCap,
    hardCap,
    leadershipBonus: modifier,
  };
}

// ============================================
// THE CONTRIBUTION ECONOMY
// ============================================

export const ContributionRewardSchema = z.object({
  playerId: z.string().uuid(),
  characterId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Contribution type
  contributionType: z.enum([
    "action_quality", // Well-written downtime action
    "session_diary", // Post-session reflection
    "in_character_letter", // Written in-character correspondence
    "character_journal", // Ongoing character journal
    "world_contribution", // Created content (maps, art, lore)
    "npc_backstory", // Wrote backstory for an NPC
    "session_notes", // Took notes during session
    "recap_volunteer", // Volunteered to do session recap
  ]),

  contributionId: z.string().uuid(),

  // Evaluation
  qualityTier: ActionQualityTierSchema,

  // Rewards granted
  rewards: z.array(
    z.object({
      type: z.enum([
        "bonus_to_roll", // +N to specific roll
        "advantage", // Advantage on specific thing
        "inspiration", // D&D inspiration
        "extra_action", // Bonus downtime action
        "follower_bonus", // Followers work better
        "resource_bonus", // Extra gold/materials/etc.
        "narrative_weight", // Actions matter more to story
        "gm_favor", // GM will look for opportunities
        "relationship_boost", // Better NPC reactions
        "knowledge", // Learn something useful
      ]),
      value: z.number().optional(),
      target: z.string().optional(),
      duration: z.enum(["once", "session", "downtime_period", "permanent"]),
      description: z.string(),
    }),
  ),

  // When granted
  grantedAt: z.date(),
  expiresAt: z.date().optional(),

  // Status
  used: z.boolean().default(false),
  usedAt: z.date().optional(),
});
export type ContributionReward = z.infer<typeof ContributionRewardSchema>;

// ============================================
// CONTRIBUTION TRACKING
// ============================================

export const PlayerEngagementSchema = z.object({
  playerId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Lifetime stats
  lifetime: z.object({
    diariesSubmitted: z.number().int().default(0),
    actionsEnhanced: z.number().int().default(0),
    totalWordCount: z.number().int().default(0),
    averageQuality: z.number().default(0),
    exceptionalContributions: z.number().int().default(0),
  }),

  // Current period stats
  currentPeriod: z.object({
    diarySubmitted: z.boolean().default(false),
    actionsEnhanced: z.number().int().default(0),
    qualityScores: z.array(z.number().int()).default([]),
  }),

  // Active bonuses
  activeBonuses: z
    .array(
      z.object({
        rewardId: z.string().uuid(),
        type: z.string(),
        value: z.number().optional(),
        target: z.string().optional(),
        expiresAt: z.date().optional(),
      }),
    )
    .default([]),

  // Streak tracking
  streaks: z.object({
    currentDiaryStreak: z.number().int().default(0),
    longestDiaryStreak: z.number().int().default(0),
    currentQualityStreak: z.number().int().default(0), // Consecutive 'detailed' or better
  }),
});
export type PlayerEngagement = z.infer<typeof PlayerEngagementSchema>;

// ============================================
// THE UI FLOW
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│  📝 DOWNTIME ACTION: Write Letter                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  To: [Duke Maldwyn          ▼]                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Quick Description (required):                                       │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ I write to the Duke requesting military aid against the cult.  │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  │                                                            +1 bonus │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ── ENHANCE YOUR ACTION (Optional) ─────────────────────────────────────    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✉️ Write the actual letter (in-character):                    +1-3  │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Your Grace,                                                     │ │    │
│  │ │                                                                 │ │    │
│  │ │ I hope this letter finds you well. We met briefly at the       │ │    │
│  │ │ harvest festival, where you remarked on my father's service    │ │    │
│  │ │ to your house. I write now in that same spirit of duty.        │ │    │
│  │ │                                                                 │ │    │
│  │ │ A darkness grows in the south. The Cult of the Dragon has      │ │    │
│  │ │ established a foothold near Thornwood, and we have evidence    │ │    │
│  │ │ of their plans to...                                           │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  │                                                       247 words     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 💭 Your reasoning/strategy:                                   +1-2  │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ The Duke owes my family. If I remind him of that, and frame   │ │    │
│  │ │ the cult as a threat to HIS lands, he's more likely to act.   │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔗 Connect to session events:                                 +1-2  │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ We freed the Duke's niece from the cult last session. I'll    │ │    │
│  │ │ mention that we returned her safely - he owes us.             │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  📊 ESTIMATED QUALITY: IMMERSIVE (+3 bonus)                                 │
│                                                                             │
│  Your CHA modifier (+3) allows up to EXCEPTIONAL quality.                   │
│  Current word count: 312 words                                              │
│                                                                             │
│  [Submit Action]                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  📓 SESSION DIARY - Session 12: "The Temple of Shadows"                     │
│  Due: Before Session 13 (2 days remaining)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  What happened? (Your perspective) *                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ We infiltrated the cult's temple and freed the prisoners. The     │    │
│  │ high priest escaped through a portal, but not before we saw...    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  What did you notice? * (Add observations)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ [+] The high priest's robes had a different symbol than the       │    │
│  │     regular cultists - five heads instead of one                   │    │
│  │     Category: [Plot Clue ▼]                                        │    │
│  │                                                                     │    │
│  │ [+] The Duke's niece recognized one of the guards - said he was   │    │
│  │     from Waterdeep, from a noble house                             │    │
│  │     Category: [NPC Behavior ▼]                                     │    │
│  │                                                                     │    │
│  │ [+ Add Another Observation]                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  What do you want to pursue? *                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ [+] Find out which noble house the guard was from                  │    │
│  │     Priority: [Important ▼]                                        │    │
│  │     Approach: Ask the niece more questions, research noble houses  │    │
│  │                                                                     │    │
│  │ [+] Investigate what the five-headed symbol means                  │    │
│  │     Priority: [Urgent ▼]                                           │    │
│  │     Approach: Library research, ask my Harper contact              │    │
│  │                                                                     │    │
│  │ [+ Add Another Goal]                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ── BONUS SECTIONS (More = More Rewards) ───────────────────────────────    │
│                                                                             │
│  ▶ Character Reflection (How did your character feel?)                      │
│  ▶ Theories (What do you think is going on?)                                │
│  ▶ In-Character Journal Entry                                               │
│  ▶ Questions for the GM                                                     │
│  ▶ Session Feedback                                                         │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  📊 CURRENT REWARDS PREVIEW:                                                │
│  • +2 to Investigation checks about the noble house (next session)          │
│  • +1 to Research actions about cult symbols (downtime)                     │
│  • Relationship bonus with Duke's niece                                     │
│                                                                             │
│  🔥 STREAK: 3 sessions in a row! (Bonus: Inspiration point)                 │
│                                                                             │
│  [Submit Diary]                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
*/

// ============================================
// GM CONTRIBUTION REVIEW
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│  👁️ PLAYER CONTRIBUTIONS - Session 12 Downtime                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📓 SESSION DIARIES                                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ⭐ Kira (Sarah) - 523 words - EXCEPTIONAL                           │    │
│  │                                                                     │    │
│  │ Notable observations:                                               │    │
│  │ • Noticed five-headed symbol (CORRECT - this is Tiamat!)            │    │
│  │ • Connected guard to noble house (IMPORTANT - leads to plot)        │    │
│  │                                                                     │    │
│  │ AI-Generated Bonuses:                                               │    │
│  │ ✓ +2 Investigation (noble house) - APPROVE                          │    │
│  │ ✓ +1 Research (cult symbols) - APPROVE                              │    │
│  │ ✓ Inspiration point (3-session streak) - APPROVE                    │    │
│  │ ? Advantage on next Cult interaction - MODIFY: +2 instead           │    │
│  │                                                                     │    │
│  │ GM Hooks Generated:                                                 │    │
│  │ • Player wants noble house info → Prepare House Blackwood reveal    │    │
│  │ • Interested in Tiamat → Foreshadow in next session                 │    │
│  │                                                                     │    │
│  │ [Approve All] [Review Details]                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Theron (Mike) - 287 words - DETAILED                              │    │
│  │                                                                     │    │
│  │ Notable: Focused on combat tactics and troop morale                 │    │
│  │ Bonuses: +1 Train Troops, +1 Inspire Followers                      │    │
│  │                                                                     │    │
│  │ [Approve All] [Review Details]                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ○ Bjorn (Alex) - NOT SUBMITTED                                      │    │
│  │                                                                     │    │
│  │ No bonuses this period.                                             │    │
│  │ [Send Reminder]                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  📝 NOTABLE ACTION CONTRIBUTIONS                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ⭐ Kira - Letter to Duke - IMMERSIVE (312 words in-character)        │    │
│  │                                                                     │    │
│  │ Quality breakdown:                                                  │    │
│  │ • Clarity: 5/5 - Crystal clear ask                                  │    │
│  │ • Creativity: 4/5 - Good leverage of family history                 │    │
│  │ • Immersion: 5/5 - Full in-character letter                         │    │
│  │ • Relevance: 5/5 - Mentions niece rescue from last session          │    │
│  │ • Effort: 4/5 - Substantial work                                    │    │
│  │                                                                     │    │
│  │ Total: 23/25 → IMMERSIVE (+3 bonus to roll)                         │    │
│  │                                                                     │    │
│  │ [Approve] [Upgrade to Exceptional (+5)]                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
*/
