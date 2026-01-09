/**
 * Bounty System
 *
 * Gold doesn't appear from nowhere. Someone PAYS.
 *
 * Bounties flow from:
 * - Settlement treasuries (taxes → defense budget)
 * - Guild reserves (fees → bounty pool)
 * - Faction coffers (political investment)
 * - Individual wealth (personal stakes)
 * - Crowdfunding (desperate villagers pooling copper)
 *
 * The Adventurer's Guild takes a cut. Always.
 * That's how they fund the receptionist network.
 */

import { z } from "zod";

// =============================================================================
// BOUNTY SPONSORS
// =============================================================================

/**
 * Who's putting up the gold?
 */
export const BountySponsorTypeSchema = z.enum([
  // Institutional
  "settlement", // Town/city treasury
  "guild", // Adventurer's Guild reserves
  "faction", // Noble house, church, consortium
  "military", // Army/guard budget
  "crown", // Royal treasury

  // Private
  "merchant", // Lost goods, attacked caravans
  "noble", // Personal vendetta, family honor
  "temple", // Religious duty, holy sites
  "individual", // Farmer, innkeeper, grieving parent

  // Collective
  "crowdfunded", // Village pooled resources
  "consortium", // Multiple merchants together
  "bounty_board", // Generic posted bounty (guild-backed)
]);
export type BountySponsorType = z.infer<typeof BountySponsorTypeSchema>;

/**
 * The actual sponsor entity
 */
export const BountySponsorSchema = z.object({
  type: BountySponsorTypeSchema,
  entityId: z.string().uuid(), // Settlement, faction, NPC, etc.
  name: z.string(),

  wealth: z.object({
    tier: z.enum(["destitute", "poor", "modest", "comfortable", "wealthy", "rich", "aristocratic"]),
    availableBudget: z.number().int(), // Gold they CAN spend on bounties
    maxSingleBounty: z.number().int(), // Won't post more than this
  }),

  motivation: z.object({
    urgency: z.number().int().min(0).max(100), // How desperate
    personal: z.boolean(), // Personal stake vs civic duty
    recurring: z.boolean(), // Will they post again?
  }),
});
export type BountySponsor = z.infer<typeof BountySponsorSchema>;

/**
 * Wealth tier to gold conversion
 */
export const WEALTH_TIER_BUDGETS: Record<
  BountySponsor["wealth"]["tier"],
  { minBudget: number; maxBudget: number; maxSingle: number }
> = {
  destitute: { minBudget: 5, maxBudget: 25, maxSingle: 10 },
  poor: { minBudget: 25, maxBudget: 100, maxSingle: 50 },
  modest: { minBudget: 100, maxBudget: 500, maxSingle: 200 },
  comfortable: { minBudget: 500, maxBudget: 2000, maxSingle: 1000 },
  wealthy: { minBudget: 2000, maxBudget: 10000, maxSingle: 5000 },
  rich: { minBudget: 10000, maxBudget: 50000, maxSingle: 25000 },
  aristocratic: { minBudget: 50000, maxBudget: 500000, maxSingle: 100000 },
};

// =============================================================================
// BOUNTY TYPES
// =============================================================================

/**
 * What kind of job is this?
 */
export const BountyTypeSchema = z.enum([
  // Monster-related
  "extermination", // Kill X monsters
  "population_cull", // Reduce population to tier Y
  "alpha_hunt", // Kill specific leader/alpha
  "nest_destruction", // Destroy spawner
  "capture", // Bring back alive (harder, pays more)

  // Location-related
  "dungeon_clear", // Clear POI of monsters
  "route_patrol", // Make trade route safe
  "area_secure", // Secure region for X days
  "escort", // Protect caravan/person through danger

  // Investigation
  "scout", // Gather intel on threat
  "track", // Find monster lair
  "identify", // What IS this thing?

  // Recovery
  "rescue", // Save kidnapped person
  "retrieval", // Recover item/body from dangerous area
  "caravan_recovery", // Find lost caravan
]);
export type BountyType = z.infer<typeof BountyTypeSchema>;

/**
 * Base rewards by bounty type (before modifiers)
 */
export const BASE_BOUNTY_REWARDS: Record<
  BountyType,
  { baseGold: number; xpMultiplier: number; reputationGain: number }
> = {
  extermination: { baseGold: 50, xpMultiplier: 1.0, reputationGain: 5 },
  population_cull: { baseGold: 100, xpMultiplier: 1.2, reputationGain: 10 },
  alpha_hunt: { baseGold: 200, xpMultiplier: 1.5, reputationGain: 15 },
  nest_destruction: { baseGold: 500, xpMultiplier: 2.0, reputationGain: 25 },
  capture: { baseGold: 300, xpMultiplier: 1.3, reputationGain: 20 },
  dungeon_clear: { baseGold: 400, xpMultiplier: 1.8, reputationGain: 30 },
  route_patrol: { baseGold: 75, xpMultiplier: 0.8, reputationGain: 8 },
  area_secure: { baseGold: 150, xpMultiplier: 1.0, reputationGain: 12 },
  escort: { baseGold: 100, xpMultiplier: 0.7, reputationGain: 10 },
  scout: { baseGold: 50, xpMultiplier: 0.5, reputationGain: 5 },
  track: { baseGold: 75, xpMultiplier: 0.6, reputationGain: 8 },
  identify: { baseGold: 100, xpMultiplier: 0.4, reputationGain: 10 },
  rescue: { baseGold: 200, xpMultiplier: 1.2, reputationGain: 20 },
  retrieval: { baseGold: 150, xpMultiplier: 1.0, reputationGain: 15 },
  caravan_recovery: { baseGold: 175, xpMultiplier: 1.1, reputationGain: 15 },
};

// =============================================================================
// BOUNTY SCHEMA
// =============================================================================

/**
 * A posted bounty
 */
export const BountySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Who's paying
  sponsor: BountySponsorSchema,
  guildBranchId: z.string().uuid().optional(), // If posted through guild

  // What's the job
  type: BountyTypeSchema,
  title: z.string(),
  description: z.string(),

  // Target
  target: z.object({
    // Monster target
    speciesId: z.string().optional(),
    populationId: z.string().uuid().optional(),
    targetCount: z.number().int().optional(), // For extermination
    targetTier: z.string().optional(), // For population_cull

    // Location target
    poiId: z.string().uuid().optional(),
    regionId: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),

    // Person target
    rescueNpcId: z.string().uuid().optional(),
    escortNpcId: z.string().uuid().optional(),

    // Item target
    retrieveItemId: z.string().uuid().optional(),
  }),

  // Requirements
  requirements: z.object({
    minimumRank: z.string().optional(), // Adventurer rank
    minimumPartySize: z.number().int().optional(),
    specialSkills: z.array(z.string()).optional(),
    timeLimit: z.number().int().optional(), // Days
  }),

  // Rewards (calculated)
  rewards: z.object({
    gold: z.number().int(),
    bonusGold: z.number().int().optional(), // For exceptional completion
    xpReward: z.number().int(),
    reputationGain: z.number().int(),
    itemRewards: z.array(z.string().uuid()).optional(),
  }),

  // Fees
  fees: z.object({
    guildCut: z.number().int(), // Guild takes this from reward
    guildCutPercent: z.number(), // Usually 10-15%
    upfrontDeposit: z.number().int().optional(), // Some bounties require deposit
  }),

  // Director influence
  directorModifiers: z.object({
    threatLevel: z.number().int().min(0).max(10),
    rewardMultiplier: z.number(), // Higher threat = higher pay
    urgencyBonus: z.number().int(), // Bonus for fast completion
    warnings: z.array(z.string()), // "Creatures resistant to fire", etc.
    adaptations: z.array(z.string()), // Known monster adaptations
  }),

  // State
  status: z.enum([
    "draft", // Being created
    "posted", // On the board
    "claimed", // Party accepted
    "in_progress", // Party working on it
    "pending_verification", // Awaiting proof
    "completed", // Done, paid out
    "failed", // Party failed/abandoned
    "expired", // Time ran out
    "withdrawn", // Sponsor cancelled
  ]),

  // Tracking
  claimedBy: z.string().uuid().optional(), // Party ID
  claimedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),

  // Proof requirements
  proofRequired: z.enum([
    "honor_system", // Just their word
    "trophy", // Bring back head/claw/etc
    "witness", // Guild witness or magical scrying
    "body", // Bring back whole creature
    "magical_verification", // Guild mage confirms
  ]),

  // History
  previousAttempts: z.number().int().default(0),
  failedParties: z.array(z.string().uuid()).default([]),

  createdAt: z.string().datetime(),
});
export type Bounty = z.infer<typeof BountySchema>;

// =============================================================================
// BOUNTY GENERATION
// =============================================================================

/**
 * Context for generating a bounty
 */
export const BountyGenerationContextSchema = z.object({
  // The threat
  population: z.object({
    id: z.string().uuid(),
    speciesId: z.string(),
    speciesName: z.string(),
    tier: z.string(),
    count: z.number().int(),
    regionId: z.string().uuid(),
    regionName: z.string(),
  }).optional(),

  poi: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.string(),
    degradation: z.number().int(),
    hasSpawner: z.boolean(),
  }).optional(),

  // Director data
  director: z.object({
    regionalThreat: z.number().int().min(0).max(10),
    speciesFitness: z.number().optional(),
    knownAdaptations: z.array(z.string()),
    recentPartyDefeats: z.number().int(),
  }),

  // Sponsor context
  sponsor: BountySponsorSchema,

  // Settlement context (for calculating urgency)
  nearestSettlement: z.object({
    id: z.string().uuid(),
    name: z.string(),
    population: z.number().int(),
    distanceMiles: z.number(),
    recentRaids: z.number().int(),
  }).optional(),
});
export type BountyGenerationContext = z.infer<typeof BountyGenerationContextSchema>;

/**
 * Calculate bounty reward based on context
 */
export function calculateBountyReward(
  type: BountyType,
  context: BountyGenerationContext
): {
  gold: number;
  xp: number;
  reputation: number;
  multiplierBreakdown: Record<string, number>;
} {
  const base = BASE_BOUNTY_REWARDS[type];
  let gold = base.baseGold;
  const breakdown: Record<string, number> = { base: base.baseGold };

  // CR/Threat multiplier
  const threatMult = 1 + (context.director.regionalThreat * 0.15);
  gold *= threatMult;
  breakdown["threat_level"] = threatMult;

  // Population size multiplier (bigger problem = more pay)
  if (context.population) {
    const tierMults: Record<string, number> = {
      remnant: 0.5,
      sparse: 0.8,
      stable: 1.0,
      thriving: 1.3,
      abundant: 1.6,
      swarming: 2.0,
    };
    const tierMult = tierMults[context.population.tier] || 1.0;
    gold *= tierMult;
    breakdown["population_tier"] = tierMult;
  }

  // Fitness multiplier (dangerous monsters = more pay)
  if (context.director.speciesFitness) {
    const fitnessMult = Math.max(0.8, Math.min(2.0, context.director.speciesFitness));
    gold *= fitnessMult;
    breakdown["species_fitness"] = fitnessMult;
  }

  // Urgency multiplier (desperate sponsors pay more)
  const urgencyMult = 1 + (context.sponsor.motivation.urgency / 200);
  gold *= urgencyMult;
  breakdown["urgency"] = urgencyMult;

  // Recent defeats multiplier (if parties keep dying, pay goes up)
  if (context.director.recentPartyDefeats > 0) {
    const defeatMult = 1 + (context.director.recentPartyDefeats * 0.2);
    gold *= defeatMult;
    breakdown["previous_failures"] = defeatMult;
  }

  // POI degradation (worse condition = harder = more pay)
  if (context.poi && context.poi.degradation > 50) {
    const degradeMult = 1 + ((context.poi.degradation - 50) / 100);
    gold *= degradeMult;
    breakdown["poi_degradation"] = degradeMult;
  }

  // Spawner bonus (destroying source is worth more)
  if (context.poi?.hasSpawner && type === "nest_destruction") {
    gold *= 1.5;
    breakdown["spawner_bonus"] = 1.5;
  }

  // Cap at sponsor's max
  gold = Math.min(gold, context.sponsor.wealth.maxSingleBounty);

  // Calculate XP and reputation
  const xp = Math.floor(gold * base.xpMultiplier);
  const reputation = Math.floor(base.reputationGain * (context.director.regionalThreat / 5));

  return {
    gold: Math.floor(gold),
    xp,
    reputation: Math.max(1, reputation),
    multiplierBreakdown: breakdown,
  };
}

/**
 * Generate warnings based on director data
 */
export function generateBountyWarnings(
  context: BountyGenerationContext
): string[] {
  const warnings: string[] = [];

  // Threat level warnings
  if (context.director.regionalThreat >= 7) {
    warnings.push("URGENT: Regional threat level critical");
  } else if (context.director.regionalThreat >= 5) {
    warnings.push("WARNING: Elevated threat in area");
  }

  // Adaptation warnings
  for (const adaptation of context.director.knownAdaptations) {
    switch (adaptation) {
      case "fire_resistance":
        warnings.push("Intel: Creatures resistant to fire");
        break;
      case "magic_resistance":
        warnings.push("Intel: Creatures show magic resistance");
        break;
      case "pack_tactics":
        warnings.push("Caution: Creatures fight in coordinated groups");
        break;
      case "ambush_tactics":
        warnings.push("Danger: Creatures known to ambush");
        break;
      case "increased_hp":
        warnings.push("Note: Creatures unusually resilient");
        break;
      case "focus_fire":
        warnings.push("Warning: Creatures target vulnerable party members");
        break;
      default:
        warnings.push(`Intel: Creatures exhibit ${adaptation.replace(/_/g, " ")}`);
    }
  }

  // Previous failure warnings
  if (context.director.recentPartyDefeats >= 3) {
    warnings.push("DANGER: Multiple parties have failed this bounty");
  } else if (context.director.recentPartyDefeats >= 1) {
    warnings.push(`Note: ${context.director.recentPartyDefeats} previous attempt(s) failed`);
  }

  // Fitness warnings
  if (context.director.speciesFitness && context.director.speciesFitness > 1.5) {
    warnings.push("Caution: Species showing high combat effectiveness");
  }

  return warnings;
}

/**
 * Calculate guild cut
 */
export function calculateGuildCut(
  reward: number,
  sponsor: BountySponsor,
  throughGuild: boolean
): { amount: number; percent: number } {
  if (!throughGuild) {
    return { amount: 0, percent: 0 };
  }

  // Base 10%
  let percent = 10;

  // Wealthy sponsors pay more (they can afford it)
  if (sponsor.wealth.tier === "rich" || sponsor.wealth.tier === "aristocratic") {
    percent = 15;
  }

  // Crowdfunded/poor get a discount
  if (sponsor.type === "crowdfunded" || sponsor.wealth.tier === "poor" || sponsor.wealth.tier === "destitute") {
    percent = 5;
  }

  // Guild members get better rates (future feature)
  // if (isGuildMember) percent -= 2;

  const amount = Math.floor(reward * (percent / 100));

  return { amount, percent };
}

// =============================================================================
// BOUNTY BOARD
// =============================================================================

/**
 * A guild's bounty board
 */
export const BountyBoardSchema = z.object({
  guildBranchId: z.string().uuid(),
  settlementId: z.string().uuid(),

  // Posted bounties
  activeBounties: z.array(z.string().uuid()),

  // Filters by rank
  bountyCountByRank: z.record(z.string(), z.number().int()),

  // Stats
  stats: z.object({
    totalPosted: z.number().int(),
    totalCompleted: z.number().int(),
    totalFailed: z.number().int(),
    totalGoldPaidOut: z.number().int(),
    averageCompletionDays: z.number(),
  }),

  // Board state
  lastRefresh: z.string().datetime(),
  nextRefresh: z.string().datetime(),
});
export type BountyBoard = z.infer<typeof BountyBoardSchema>;

// =============================================================================
// BOUNTY COMPLETION
// =============================================================================

/**
 * Proof of completion
 */
export const BountyProofSchema = z.object({
  bountyId: z.string().uuid(),
  partyId: z.string().uuid(),

  proofType: BountySchema.shape.proofRequired,

  evidence: z.object({
    // Trophy
    trophyItemId: z.string().uuid().optional(),
    trophyDescription: z.string().optional(),

    // Witness
    witnessNpcId: z.string().uuid().optional(),
    witnessStatement: z.string().optional(),

    // Magical
    magicalVerificationResult: z.string().optional(),
    verifyingMageId: z.string().uuid().optional(),

    // General
    additionalNotes: z.string().optional(),
  }),

  // Verification
  verified: z.boolean(),
  verifiedBy: z.string().uuid().optional(),
  verifiedAt: z.string().datetime().optional(),
  disputeReason: z.string().optional(),
});
export type BountyProof = z.infer<typeof BountyProofSchema>;

/**
 * Bounty completion result
 */
export const BountyCompletionSchema = z.object({
  bountyId: z.string().uuid(),
  partyId: z.string().uuid(),

  // How'd it go?
  result: z.enum([
    "complete", // Full success
    "partial", // Some objectives met
    "exceptional", // Exceeded expectations
    "failed", // Didn't complete
    "abandoned", // Gave up
  ]),

  // Rewards earned
  rewards: z.object({
    goldEarned: z.number().int(),
    guildCutPaid: z.number().int(),
    netGold: z.number().int(),
    xpEarned: z.number().int(),
    reputationEarned: z.number().int(),
    bonusRewards: z.array(z.string()).optional(),
  }),

  // Impact on world
  worldImpact: z.object({
    populationReduction: z.number().int().optional(),
    spawnerCapped: z.boolean().optional(),
    routeDangerReduction: z.number().optional(),
    settlementStabilityGain: z.number().optional(),
  }),

  // Director records this
  encounterData: z.object({
    totalKills: z.number().int(),
    partyDeaths: z.number().int(),
    partyDowns: z.number().int(),
    roundsFought: z.number().int(),
    tacticsUsed: z.array(z.string()),
  }).optional(),

  completedAt: z.string().datetime(),
});
export type BountyCompletion = z.infer<typeof BountyCompletionSchema>;

// =============================================================================
// AI PROMPT BUILDERS
// =============================================================================

/**
 * Generate bounty posting text
 */
export function buildBountyPostingPrompt(bounty: Bounty): string {
  return `
Generate a bounty board posting for an adventurer's guild.

BOUNTY DETAILS:
- Type: ${bounty.type}
- Title: ${bounty.title}
- Sponsor: ${bounty.sponsor.name} (${bounty.sponsor.type})
- Reward: ${bounty.rewards.gold} gold pieces
- Guild Cut: ${bounty.fees.guildCutPercent}%

TARGET:
${bounty.target.speciesId ? `- Monster: ${bounty.target.speciesId}` : ""}
${bounty.target.poiId ? `- Location: Specific dungeon/lair` : ""}
${bounty.target.targetCount ? `- Kill Count Required: ${bounty.target.targetCount}` : ""}

REQUIREMENTS:
${bounty.requirements.minimumRank ? `- Minimum Rank: ${bounty.requirements.minimumRank}` : "- Open to all ranks"}
${bounty.requirements.timeLimit ? `- Time Limit: ${bounty.requirements.timeLimit} days` : ""}

WARNINGS:
${bounty.directorModifiers.warnings.length > 0 ? bounty.directorModifiers.warnings.map(w => `- ${w}`).join("\n") : "- None"}

PREVIOUS ATTEMPTS: ${bounty.previousAttempts} (${bounty.failedParties.length} failures)

Write the bounty posting in two parts:
1. OFFICIAL POSTING (formal, posted on the board)
2. RECEPTIONIST'S VERBAL ADDENDUM (what she says when someone asks about it - hints, warnings, "off the record" info)

The tone should match the sponsor type and urgency. A crowdfunded village bounty sounds different from a noble's vendetta.
`.trim();
}

/**
 * Generate bounty completion narration
 */
export function buildBountyCompletionPrompt(
  bounty: Bounty,
  completion: BountyCompletion
): string {
  return `
Generate the bounty turn-in scene at the adventurer's guild.

BOUNTY: ${bounty.title}
RESULT: ${completion.result}

REWARDS:
- Gold Earned: ${completion.rewards.goldEarned}
- Guild Cut: ${completion.rewards.guildCutPaid}
- Net Payout: ${completion.rewards.netGold}
- Reputation Gained: ${completion.rewards.reputationEarned}

PROOF PROVIDED: ${bounty.proofRequired}

WORLD IMPACT:
${completion.worldImpact.populationReduction ? `- Reduced monster population by ${completion.worldImpact.populationReduction}` : ""}
${completion.worldImpact.spawnerCapped ? `- Capped a monster spawner` : ""}
${completion.worldImpact.routeDangerReduction ? `- Trade route is safer` : ""}

Write the scene in 2-3 paragraphs:
1. The proof presentation (dramatic if exceptional, routine if normal)
2. The receptionist's response (she knows things about the impact they don't)
3. The payout and any hints about follow-up work

${completion.result === "exceptional" ? "The receptionist should be impressed but hide it behind professionalism (mostly)." : ""}
${completion.result === "partial" ? "The receptionist should be understanding but business-like about reduced payment." : ""}
${bounty.previousAttempts > 0 ? `Remember, ${bounty.previousAttempts} parties failed this before. Acknowledge their success where others failed.` : ""}
`.trim();
}

// =============================================================================
// BOUNTY LIFECYCLE FUNCTIONS
// =============================================================================

// Legacy type aliases for backwards compatibility with index.ts exports
export const BountyObjectiveTypeSchema = BountyTypeSchema;
export type BountyObjectiveType = BountyType;
export const BountyStatusSchema = BountySchema.shape.status;
export type BountyStatus = Bounty["status"];
export const BountyRewardTypeSchema = z.enum(["gold", "item", "reputation", "xp"]);
export type BountyRewardType = z.infer<typeof BountyRewardTypeSchema>;
export const BountyIssuerTypeSchema = BountySponsorTypeSchema;
export type BountyIssuerType = BountySponsorType;

/**
 * Generate bounties from a POI's current state
 */
export function generateBountiesFromPOI(
  poi: { id: string; name: string; type: string; degradation: number },
  context: BountyGenerationContext
): Bounty[] {
  const bounties: Bounty[] = [];
  const now = new Date().toISOString();

  // Determine bounty type based on POI and population
  let bountyType: BountyType = "dungeon_clear";
  if (context.population) {
    if (context.population.tier === "swarming") {
      bountyType = "population_cull";
    } else if (context.poi?.hasSpawner) {
      bountyType = "nest_destruction";
    } else {
      bountyType = "extermination";
    }
  }

  const rewards = calculateBountyReward(bountyType, context);
  const warnings = generateBountyWarnings(context);
  const guildCut = calculateGuildCut(rewards.gold, context.sponsor, true);

  const bounty: Bounty = {
    id: crypto.randomUUID(),
    campaignId: "", // To be filled by caller
    sponsor: context.sponsor,
    guildBranchId: undefined,
    type: bountyType,
    title: `Clear the ${poi.name}`,
    description: `Eliminate the threat at ${poi.name}`,
    target: {
      poiId: poi.id,
      speciesId: context.population?.speciesId,
      populationId: context.population?.id,
      regionId: context.population?.regionId,
    },
    requirements: {
      minimumRank: context.director.regionalThreat >= 7 ? "A" :
                   context.director.regionalThreat >= 5 ? "B" :
                   context.director.regionalThreat >= 3 ? "C" : undefined,
    },
    rewards: {
      gold: rewards.gold,
      xpReward: rewards.xp,
      reputationGain: rewards.reputation,
    },
    fees: {
      guildCut: guildCut.amount,
      guildCutPercent: guildCut.percent,
    },
    directorModifiers: {
      threatLevel: context.director.regionalThreat,
      rewardMultiplier: rewards.gold / BASE_BOUNTY_REWARDS[bountyType].baseGold,
      urgencyBonus: context.sponsor.motivation.urgency >= 80 ? Math.floor(rewards.gold * 0.2) : 0,
      warnings,
      adaptations: context.director.knownAdaptations,
    },
    status: "posted",
    proofRequired: bountyType === "nest_destruction" ? "magical_verification" : "trophy",
    previousAttempts: 0,
    failedParties: [],
    createdAt: now,
  };

  bounties.push(bounty);
  return bounties;
}

/**
 * Claim a bounty for a party
 */
export function claimBounty(
  bounty: Bounty,
  partyId: string
): Bounty {
  if (bounty.status !== "posted") {
    throw new Error(`Cannot claim bounty in status: ${bounty.status}`);
  }

  return {
    ...bounty,
    status: "claimed",
    claimedBy: partyId,
    claimedAt: new Date().toISOString(),
  };
}

/**
 * Complete an objective (for multi-objective bounties)
 */
export function completeObjective(
  bounty: Bounty,
  _objectiveId: string
): Bounty {
  // For now, simple bounties complete fully
  return {
    ...bounty,
    status: "pending_verification",
  };
}

/**
 * Pay out a completed bounty
 */
export function payBounty(
  bounty: Bounty,
  completion: BountyCompletion
): { bounty: Bounty; payout: number } {
  const netPayout = completion.rewards.netGold;

  return {
    bounty: {
      ...bounty,
      status: "completed",
      completedAt: completion.completedAt,
    },
    payout: netPayout,
  };
}

/**
 * Mark a bounty as failed
 */
export function failBounty(
  bounty: Bounty,
  partyId: string
): Bounty {
  return {
    ...bounty,
    status: "failed",
    previousAttempts: bounty.previousAttempts + 1,
    failedParties: [...bounty.failedParties, partyId],
    claimedBy: undefined,
    claimedAt: undefined,
  };
}

/**
 * Expire old bounties
 */
export function expireBounties(
  bounties: Bounty[],
  currentDate: Date
): { expired: Bounty[]; active: Bounty[] } {
  const expired: Bounty[] = [];
  const active: Bounty[] = [];

  for (const bounty of bounties) {
    if (bounty.expiresAt && new Date(bounty.expiresAt) < currentDate) {
      expired.push({ ...bounty, status: "expired" });
    } else {
      active.push(bounty);
    }
  }

  return { expired, active };
}
