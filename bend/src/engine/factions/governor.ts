import { z } from "zod";

// ============================================
// GOVERNOR SYSTEM
// ============================================
//
// Governors are the local faction leaders.
// They're not robots - they have their own agendas.
//
// A governor might:
//   - Follow orders faithfully
//   - Delay orders that hurt their position
//   - Skim resources for personal use
//   - Secretly work for a rival
//   - Pursue forbidden romance
//   - Plan a coup
//
// This creates organic drama and opportunities for players.
//

// ============================================
// AUTHORITY LEVELS
// ============================================

export const GovernorAuthoritySchema = z.enum([
  "minimal",      // Can only execute explicit orders
  "limited",      // Small tactical decisions only
  "standard",     // Normal local authority
  "broad",        // Significant autonomy
  "viceroy",      // Near-total authority in region
]);
export type GovernorAuthority = z.infer<typeof GovernorAuthoritySchema>;

// What each authority level allows without orders
export const AUTHORITY_PERMISSIONS: Record<GovernorAuthority, string[]> = {
  minimal: [
    "maintain_status_quo",
    "report_to_hq",
  ],
  limited: [
    "maintain_status_quo",
    "report_to_hq",
    "minor_resource_allocation",
    "local_recruitment",
  ],
  standard: [
    "maintain_status_quo",
    "report_to_hq",
    "minor_resource_allocation",
    "local_recruitment",
    "local_operations",
    "respond_to_threats",
    "make_local_deals",
  ],
  broad: [
    "maintain_status_quo",
    "report_to_hq",
    "minor_resource_allocation",
    "local_recruitment",
    "local_operations",
    "respond_to_threats",
    "make_local_deals",
    "regional_initiatives",
    "alliance_negotiations",
    "significant_spending",
  ],
  viceroy: [
    "full_autonomy",  // Can do almost anything faction could do
  ],
};

// ============================================
// PERSONAL AGENDA TYPES
// ============================================

export const PersonalAgendaTypeSchema = z.enum([
  // ─────────────────────────────────────────
  // AMBITION
  // ─────────────────────────────────────────
  "power_grab",           // Wants more authority in faction
  "succession",           // Wants faction leader's position
  "independence",         // Wants to break away, form own faction
  "defection",            // Planning to join rival faction

  // ─────────────────────────────────────────
  // GREED
  // ─────────────────────────────────────────
  "embezzlement",         // Skimming faction resources
  "side_business",        // Running personal operations with faction assets
  "bribery_taking",       // Accepting bribes from outsiders
  "treasure_hunting",     // Pursuing personal wealth opportunities

  // ─────────────────────────────────────────
  // IDEOLOGY
  // ─────────────────────────────────────────
  "reform",               // Wants to change faction goals/methods
  "purism",               // Thinks faction has become too soft
  "moderation",           // Thinks faction has become too extreme
  "religious_agenda",     // Hidden religious motivations

  // ─────────────────────────────────────────
  // PERSONAL
  // ─────────────────────────────────────────
  "revenge",              // Vendetta against specific person
  "protect_family",       // Family interests override faction
  "forbidden_love",       // Romantic relationship that complicates loyalty
  "secret_identity",      // Hiding true nature (disguised noble, etc.)
  "addiction",            // Substance or behavior that can be exploited

  // ─────────────────────────────────────────
  // TREACHERY
  // ─────────────────────────────────────────
  "spy",                  // Working for rival faction
  "crown_loyalist",       // Secretly loyal to the crown/state
  "cult_member",          // Secret cult allegiance
  "double_agent",         // Playing multiple sides

  // ─────────────────────────────────────────
  // LOYAL
  // ─────────────────────────────────────────
  "loyal",                // Genuinely loyal, no hidden agenda
]);
export type PersonalAgendaType = z.infer<typeof PersonalAgendaTypeSchema>;

// How likely each agenda type is to create betrayal
export const AGENDA_BETRAYAL_TENDENCY: Record<PersonalAgendaType, number> = {
  // Ambition (moderate-high risk)
  power_grab: 0.3,
  succession: 0.4,
  independence: 0.6,
  defection: 0.9,

  // Greed (low-moderate risk - usually just skimming)
  embezzlement: 0.2,
  side_business: 0.3,
  bribery_taking: 0.4,
  treasure_hunting: 0.2,

  // Ideology (moderate risk)
  reform: 0.3,
  purism: 0.4,
  moderation: 0.2,
  religious_agenda: 0.5,

  // Personal (variable)
  revenge: 0.5,
  protect_family: 0.4,
  forbidden_love: 0.3,
  secret_identity: 0.3,
  addiction: 0.3,

  // Treachery (very high risk)
  spy: 1.0,
  crown_loyalist: 0.8,
  cult_member: 0.7,
  double_agent: 0.9,

  // Loyal
  loyal: 0.0,
};

// ============================================
// BETRAYAL SEVERITY
// ============================================

export const BetrayalSeveritySchema = z.enum([
  "never",      // Would never betray faction
  "minor",      // Would cut corners, small lies
  "moderate",   // Would disobey orders, redirect resources
  "major",      // Would actively work against faction goals
  "total",      // Would destroy faction if beneficial
]);
export type BetrayalSeverity = z.infer<typeof BetrayalSeveritySchema>;

// ============================================
// LOYALTY FACTORS
// ============================================

export const LoyaltyFactorTypeSchema = z.enum([
  // Positive factors
  "well_paid",
  "respected",
  "ideologically_aligned",
  "family_in_faction",
  "owes_debt",
  "fears_punishment",
  "true_believer",
  "personal_friendship_with_leader",
  "successful_career",

  // Negative factors
  "underpaid",
  "disrespected",
  "ideological_drift",
  "family_threatened",
  "passed_over_promotion",
  "unfair_treatment",
  "disagreement_with_leadership",
  "better_offer_elsewhere",
  "faction_losing",
  "personal_grudge",
]);
export type LoyaltyFactorType = z.infer<typeof LoyaltyFactorTypeSchema>;

// Standard modifiers for each factor
export const LOYALTY_FACTOR_MODIFIERS: Record<LoyaltyFactorType, number> = {
  well_paid: 10,
  respected: 15,
  ideologically_aligned: 20,
  family_in_faction: 15,
  owes_debt: 10,
  fears_punishment: 5,
  true_believer: 25,
  personal_friendship_with_leader: 20,
  successful_career: 10,

  underpaid: -10,
  disrespected: -15,
  ideological_drift: -10,
  family_threatened: -20,
  passed_over_promotion: -15,
  unfair_treatment: -20,
  disagreement_with_leadership: -10,
  better_offer_elsewhere: -15,
  faction_losing: -10,
  personal_grudge: -25,
};

// ============================================
// MAIN GOVERNOR SCHEMA
// ============================================

export const GovernorSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  factionId: z.string().uuid(),

  // ─────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────
  npcId: z.string().uuid(),
  name: z.string(),
  title: z.string(),    // "Trade Factor", "Castellan", "Prior", "Warden"

  // What they govern
  nodeType: z.enum(["settlement", "poi", "region", "operation"]),
  nodeId: z.string().uuid(),
  nodeName: z.string(),

  // ─────────────────────────────────────────
  // AUTHORITY & APPOINTMENT
  // ─────────────────────────────────────────
  authority: GovernorAuthoritySchema,
  appointedAt: z.string(),
  appointedBy: z.string().optional(),  // Who appointed them
  yearsInPosition: z.number().default(0),

  // ─────────────────────────────────────────
  // LOYALTY
  // ─────────────────────────────────────────
  loyalty: z.number().int().min(0).max(100),  // 0 = about to defect, 100 = fanatical
  loyaltyTrend: z.enum(["falling", "stable", "rising"]),

  loyaltyFactors: z.array(z.object({
    type: LoyaltyFactorTypeSchema,
    description: z.string().optional(),
    modifier: z.number().int(),
  })).default([]),

  // ─────────────────────────────────────────
  // COMPETENCE
  // ─────────────────────────────────────────
  competence: z.number().int().min(0).max(100),

  specialties: z.array(z.enum([
    "administration",
    "military",
    "trade",
    "espionage",
    "diplomacy",
    "religion",
    "magic",
    "crime",
  ])).default([]),

  // ─────────────────────────────────────────
  // PERSONAL AGENDA (THE SECRET SAUCE)
  // ─────────────────────────────────────────
  personalAgenda: z.object({
    type: PersonalAgendaTypeSchema,
    description: z.string(),
    progress: z.number().int().min(0).max(100).default(0),

    // What would make them act against faction?
    conflictTriggers: z.array(z.string()).default([]),
    // e.g., "Ordered to harm family", "Faction attacks their true allegiance"

    // How far would they go?
    willingToBetraySeverity: BetrayalSeveritySchema,

    // ─────────────────────────────────────────
    // DISCOVERY MECHANICS
    // ─────────────────────────────────────────
    suspicionLevel: z.number().int().min(0).max(100).default(0),

    // Who knows
    knownToFaction: z.boolean().default(false),
    knownToParty: z.boolean().default(false),
    knownToOthers: z.array(z.object({
      entityId: z.string().uuid(),
      entityName: z.string(),
      entityType: z.enum(["faction", "npc", "party"]),
      howLearned: z.string(),
    })).default([]),

    // Discoverable evidence
    evidence: z.array(z.object({
      type: z.enum([
        "document",
        "witness",
        "behavior_pattern",
        "intercepted_message",
        "physical_evidence",
        "confession",
        "magical_detection",
      ]),
      description: z.string(),
      location: z.string().optional(),
      discoveryDC: z.number().int(),
      canBeDestroyed: z.boolean().default(true),
      isDestroyed: z.boolean().default(false),
    })).default([]),

    // Secret contacts (for spy/double agent agendas)
    secretContacts: z.array(z.object({
      entityId: z.string().uuid(),
      entityName: z.string(),
      relationship: z.string(),
      meetingMethod: z.string(),
    })).default([]),
  }),

  // ─────────────────────────────────────────
  // COMMUNICATION STATE
  // ─────────────────────────────────────────
  lastOrdersReceived: z.string().optional(),
  weeksWithoutContact: z.number().int().default(0),

  standingOrders: z.array(z.object({
    id: z.string().uuid(),
    content: z.string(),
    receivedAt: z.string(),
    expiresAt: z.string().optional(),
    issuedBy: z.string(),
    priority: z.enum(["routine", "important", "urgent", "critical"]),
    followedFaithfully: z.boolean().default(true),
    deviationReason: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // RESOURCES UNDER CONTROL
  // ─────────────────────────────────────────
  controlledResources: z.object({
    gold: z.number().default(0),
    agents: z.number().int().default(0),
    troops: z.number().int().default(0),
    influence: z.number().default(0),
  }),

  // Resources they've personally skimmed (if embezzling)
  personalHoard: z.object({
    gold: z.number().default(0),
    valuables: z.array(z.string()).default([]),
    hiddenLocation: z.string().optional(),
  }).optional(),

  // ─────────────────────────────────────────
  // CORRUPTIBILITY
  // ─────────────────────────────────────────
  corruptibility: z.object({
    canBeBribed: z.boolean(),
    bribeThreshold: z.number().optional(),      // GP to consider
    bribeAcceptanceChance: z.number().optional(), // 0-1, if above threshold

    canBeBlackmailed: z.boolean(),
    blackmailVulnerabilities: z.array(z.string()).default([]),

    canBeTurned: z.boolean(),           // Can they be convinced to defect?
    turningDifficulty: z.enum(["easy", "moderate", "hard", "very_hard", "impossible"]).optional(),
  }),

  // Current compromises (bribes taken, blackmail active)
  currentCompromises: z.array(z.object({
    by: z.string(),                   // Who compromised them
    byType: z.enum(["party", "faction", "npc", "other"]),
    type: z.enum(["bribe", "blackmail", "threat", "ideology", "love"]),
    details: z.string(),
    ongoingCost: z.number().optional(),  // If they're on a payroll
    serviceDemanded: z.string().optional(),
    expiresAt: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // PENDING DECISIONS
  // ─────────────────────────────────────────
  pendingDecisions: z.array(z.object({
    id: z.string().uuid(),
    situation: z.string(),
    arrivedAt: z.string(),
    mustDecideBy: z.string().optional(),
    options: z.array(z.object({
      option: z.string(),
      factionAligned: z.boolean(),
      agendaAligned: z.boolean(),
      risk: z.enum(["low", "medium", "high"]),
      consequences: z.string().optional(),
    })),
    decision: z.string().optional(),
    decidedAt: z.string().optional(),
    decisionReasoning: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // RELATIONSHIPS
  // ─────────────────────────────────────────
  relationships: z.array(z.object({
    entityId: z.string().uuid(),
    entityName: z.string(),
    entityType: z.enum(["governor", "faction_leader", "npc", "party_member"]),
    relationship: z.enum([
      "ally",
      "friend",
      "neutral",
      "rival",
      "enemy",
      "romantic",
      "family",
      "mentor",
      "protege",
    ]),
    strength: z.number().int().min(-100).max(100),
    notes: z.string().optional(),
  })).default([]),

  // ─────────────────────────────────────────
  // VISIBILITY
  // ─────────────────────────────────────────
  knownToParty: z.boolean().default(false),
  partyRelationship: z.number().int().min(-100).max(100).default(0),
  partyInteractions: z.array(z.object({
    date: z.string(),
    description: z.string(),
    outcome: z.string(),
    relationshipChange: z.number().int(),
  })).default([]),

  // ─────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────
  tags: z.array(z.string()).default([]),
  gmNotes: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Governor = z.infer<typeof GovernorSchema>;

// ============================================
// GOVERNOR TITLES BY NODE TYPE
// ============================================

export const GOVERNOR_TITLES: Record<string, string[]> = {
  settlement: [
    "Mayor", "Magistrate", "Prefect", "Consul", "Bailiff",
    "Reeve", "Steward", "Warden", "Governor", "Viceroy",
  ],
  poi: [
    "Castellan", "Keeper", "Warden", "Commander", "Master",
    "Prior", "Abbot", "Captain", "Overseer", "Factor",
  ],
  region: [
    "Lord", "Baron", "Count", "Margrave", "Viceroy",
    "Satrap", "Governor-General", "High Steward",
  ],
  operation: [
    "Handler", "Controller", "Director", "Chief",
    "Master", "Coordinator", "Supervisor",
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate total loyalty including all factors.
 */
export function calculateTotalLoyalty(governor: Governor): number {
  const baseLoyalty = governor.loyalty;
  const factorModifier = governor.loyaltyFactors.reduce(
    (sum, f) => sum + f.modifier,
    0
  );
  return Math.max(0, Math.min(100, baseLoyalty + factorModifier));
}

/**
 * Check if governor would follow a specific order.
 */
export function wouldFollowOrder(
  governor: Governor,
  order: {
    content: string;
    authority: "suggestion" | "request" | "order" | "command";
    conflictsWithAgenda: boolean;
    conflictsWithCompromises: boolean;
  },
): { follows: boolean; compliance: "full" | "partial" | "minimal" | "refused"; reason: string } {
  const loyalty = calculateTotalLoyalty(governor);
  const agendaType = governor.personalAgenda.type;

  // Loyal governors almost always follow
  if (agendaType === "loyal" && loyalty >= 50) {
    return { follows: true, compliance: "full", reason: "Loyal servant" };
  }

  // Check for conflicts
  if (order.conflictsWithAgenda) {
    const betrayalChance = AGENDA_BETRAYAL_TENDENCY[agendaType];
    const severityAllows = governor.personalAgenda.willingToBetraySeverity !== "never";

    if (betrayalChance > 0.5 && severityAllows) {
      return {
        follows: false,
        compliance: "refused",
        reason: "Conflicts with personal agenda",
      };
    }

    if (betrayalChance > 0.3) {
      return {
        follows: true,
        compliance: "minimal",
        reason: "Grudging compliance due to agenda conflict",
      };
    }
  }

  // Check for compromise conflicts
  if (order.conflictsWithCompromises && governor.currentCompromises.length > 0) {
    return {
      follows: false,
      compliance: "refused",
      reason: "Conflicts with existing compromise",
    };
  }

  // Low loyalty governors resist
  if (loyalty < 30) {
    if (order.authority === "command") {
      return { follows: true, compliance: "minimal", reason: "Fear of punishment" };
    }
    return { follows: false, compliance: "refused", reason: "Loyalty too low" };
  }

  // Normal compliance
  return { follows: true, compliance: "full", reason: "Standard loyalty" };
}

/**
 * Generate a random agenda for a new governor.
 */
export function generateRandomAgenda(
  _context: {
    factionType: string;
    nodeImportance: "minor" | "moderate" | "major";
    governorCompetence: number;
  },
): Governor["personalAgenda"] {
  // 60% chance of being loyal, 40% chance of having a hidden agenda
  const hasAgenda = Math.random() < 0.4;

  if (!hasAgenda) {
    return {
      type: "loyal",
      description: "Genuinely committed to the faction's goals",
      progress: 0,
      conflictTriggers: [],
      willingToBetraySeverity: "never",
      suspicionLevel: 0,
      knownToFaction: false,
      knownToParty: false,
      knownToOthers: [],
      evidence: [],
      secretContacts: [],
    };
  }

  // Weight agenda types
  const agendaPool: PersonalAgendaType[] = [
    // Common
    "embezzlement", "embezzlement",
    "side_business", "side_business",
    "power_grab", "power_grab",
    "protect_family",
    "bribery_taking",

    // Less common
    "reform",
    "revenge",
    "succession",
    "forbidden_love",

    // Rare
    "spy",
    "defection",
    "independence",
    "cult_member",
  ];

  const agendaType = agendaPool[Math.floor(Math.random() * agendaPool.length)];
  const betrayalTendency = AGENDA_BETRAYAL_TENDENCY[agendaType];

  let severity: BetrayalSeverity = "minor";
  if (betrayalTendency >= 0.8) severity = "total";
  else if (betrayalTendency >= 0.5) severity = "major";
  else if (betrayalTendency >= 0.3) severity = "moderate";

  return {
    type: agendaType,
    description: generateAgendaDescription(agendaType),
    progress: Math.floor(Math.random() * 30), // Start with some progress
    conflictTriggers: generateConflictTriggers(agendaType),
    willingToBetraySeverity: severity,
    suspicionLevel: 0,
    knownToFaction: false,
    knownToParty: false,
    knownToOthers: [],
    evidence: generateDefaultEvidence(agendaType),
    secretContacts: [],
  };
}

function generateAgendaDescription(type: PersonalAgendaType): string {
  const descriptions: Record<PersonalAgendaType, string[]> = {
    power_grab: [
      "Seeks to expand their authority within the faction",
      "Believes they deserve more responsibility",
    ],
    succession: [
      "Positions themselves as heir to faction leadership",
      "Building coalition to replace current leader",
    ],
    independence: [
      "Dreams of breaking away to form their own organization",
      "Secretly building resources for independence",
    ],
    defection: [
      "In contact with rival faction about switching sides",
      "Waiting for the right moment to defect",
    ],
    embezzlement: [
      "Skimming small amounts from faction coffers",
      "Has a hidden stash of faction gold",
    ],
    side_business: [
      "Running a personal operation using faction resources",
      "Moonlighting with faction assets",
    ],
    bribery_taking: [
      "Accepting bribes to look the other way",
      "On someone's payroll outside the faction",
    ],
    treasure_hunting: [
      "Obsessed with acquiring personal wealth",
      "Pursuing leads on hidden treasure",
    ],
    reform: [
      "Wants to change faction methods or goals",
      "Believes faction has lost its way",
    ],
    purism: [
      "Thinks faction has become too moderate",
      "Advocates for more extreme measures",
    ],
    moderation: [
      "Believes faction has become too extreme",
      "Secretly works to soften faction actions",
    ],
    religious_agenda: [
      "Hidden religious motivations guide their actions",
      "Secretly serves a divine purpose",
    ],
    revenge: [
      "Nursing a vendetta against someone",
      "Waiting for opportunity to strike at an enemy",
    ],
    protect_family: [
      "Family interests come before faction",
      "Would betray faction to protect loved ones",
    ],
    forbidden_love: [
      "In a relationship that complicates their position",
      "Romantic entanglement creates divided loyalties",
    ],
    secret_identity: [
      "Not who they appear to be",
      "Hiding their true background and nature",
    ],
    addiction: [
      "Struggling with a secret addiction",
      "Substance dependency creates vulnerability",
    ],
    spy: [
      "Actually works for a rival faction",
      "Passing information to faction enemies",
    ],
    crown_loyalist: [
      "Secretly loyal to the crown/state over faction",
      "Would side with authorities if pressed",
    ],
    cult_member: [
      "Secretly a member of a forbidden cult",
      "Hidden religious allegiance takes priority",
    ],
    double_agent: [
      "Playing multiple factions against each other",
      "Loyalties are complex and fluid",
    ],
    loyal: [
      "Genuinely committed to faction success",
      "A true believer in the cause",
    ],
  };

  const options = descriptions[type];
  return options[Math.floor(Math.random() * options.length)];
}

function generateConflictTriggers(type: PersonalAgendaType): string[] {
  const triggers: Record<PersonalAgendaType, string[]> = {
    power_grab: ["Passed over for promotion", "Authority publicly undermined"],
    succession: ["Leader dies or is removed", "Opportunity to seize power"],
    independence: ["Faction weakened", "Resources in place"],
    defection: ["Better offer received", "Faction about to lose"],
    embezzlement: ["Audit announced", "Cover about to be blown"],
    side_business: ["Conflict with faction operations", "Discovery imminent"],
    bribery_taking: ["Briber demands action against faction", "Threatened with exposure"],
    treasure_hunting: ["Lead on major treasure", "Opportunity too good to pass"],
    reform: ["Faction does something unconscionable", "Reform rejected"],
    purism: ["Faction shows weakness", "Opportunity for extreme action"],
    moderation: ["Faction plans atrocity", "Innocent lives at stake"],
    religious_agenda: ["Religious duty conflicts with orders", "Divine sign received"],
    revenge: ["Target is vulnerable", "Perfect opportunity arises"],
    protect_family: ["Family threatened", "Orders would harm family"],
    forbidden_love: ["Lover threatened", "Love demands action"],
    secret_identity: ["Identity about to be revealed", "Old life calls"],
    addiction: ["Supply threatened", "Withdrawal risk"],
    spy: ["Handler demands action", "Cover about to be blown"],
    crown_loyalist: ["Faction threatens state", "Authorities apply pressure"],
    cult_member: ["Cult demands action", "Ritual required"],
    double_agent: ["Forced to choose sides", "Game becoming too dangerous"],
    loyal: [],
  };

  return triggers[type];
}

function generateDefaultEvidence(type: PersonalAgendaType): Governor["personalAgenda"]["evidence"] {
  if (type === "loyal") return [];

  const baseEvidence: Governor["personalAgenda"]["evidence"] = [
    {
      type: "behavior_pattern",
      description: "Suspicious behavior that doesn't quite fit",
      discoveryDC: 18,
      canBeDestroyed: false,
      isDestroyed: false,
    },
  ];

  if (["embezzlement", "side_business", "bribery_taking"].includes(type)) {
    baseEvidence.push({
      type: "document",
      description: "Financial records with discrepancies",
      location: "Personal quarters",
      discoveryDC: 15,
      canBeDestroyed: true,
      isDestroyed: false,
    });
  }

  if (["spy", "defection", "double_agent"].includes(type)) {
    baseEvidence.push({
      type: "intercepted_message",
      description: "Coded messages to unknown parties",
      discoveryDC: 20,
      canBeDestroyed: true,
      isDestroyed: false,
    });
  }

  return baseEvidence;
}
