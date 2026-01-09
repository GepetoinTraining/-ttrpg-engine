import type {
  Governor,
  PersonalAgendaType,
} from "./governor";
import {
  AGENDA_BETRAYAL_TENDENCY,
  calculateTotalLoyalty,
  wouldFollowOrder,
} from "./governor";
import type { FactionMessage } from "./communication";

// ============================================
// GOVERNOR ENGINE
// ============================================
//
// Governs how governors... govern.
//
// Key mechanics:
//   - Decision making (faction vs personal agenda)
//   - Order compliance (follow, delay, subvert)
//   - Agenda progression (their secret goals advance)
//   - Exposure risk (can they be caught?)
//   - Loyalty drift (getting more or less loyal)
//

// ============================================
// DECISION MAKING
// ============================================

export interface GovernorOption {
  id: string;
  option: string;
  factionAligned: boolean;
  agendaAligned: boolean;
  risk: "low" | "medium" | "high";
  consequences?: string;
  suspicionGenerated?: number;
}

export interface GovernorDecision {
  chosenOptionId: string;
  chosenOption: string;
  publicJustification: string;
  trueMotivation: string;
  suspicionGenerated: number;
  agendaProgress: number;
  loyaltyChange: number;
  secretActionsResolted: string[];
}

/**
 * Resolve what a governor decides when facing a situation.
 */
export function resolveGovernorDecision(
  governor: Governor,
  situation: {
    description: string;
    options: GovernorOption[];
    hasStandingOrders: boolean;
    orderGuidance?: string;
    urgency: "low" | "medium" | "high";
  },
): GovernorDecision {
  const loyalty = calculateTotalLoyalty(governor);
  const agendaType = governor.personalAgenda.type;
  const betrayalTendency = AGENDA_BETRAYAL_TENDENCY[agendaType];

  // Score each option
  const scoredOptions = situation.options.map(option => {
    let score = 0;

    // Faction alignment (weighted by loyalty)
    if (option.factionAligned) {
      score += (loyalty / 100) * 50;
    }

    // Agenda alignment (weighted by betrayal tendency)
    if (option.agendaAligned) {
      score += betrayalTendency * 40;

      // Boost if agenda progress is high (more committed)
      score += (governor.personalAgenda.progress / 100) * 20;
    }

    // Risk aversion (competent governors avoid unnecessary risk)
    if (option.risk === "high") {
      score -= (governor.competence / 100) * 20;
    } else if (option.risk === "low") {
      score += 10;
    }

    // Standing orders influence
    if (situation.hasStandingOrders && option.factionAligned) {
      score += 15;
    }

    // Urgency affects willingness to take risks
    if (situation.urgency === "high" && option.risk !== "high") {
      score += 10;
    }

    return { option, score };
  });

  // Sort by score and pick highest
  scoredOptions.sort((a, b) => b.score - a.score);
  const chosen = scoredOptions[0].option;

  // Calculate consequences
  let suspicionGenerated = chosen.suspicionGenerated ?? 0;
  let agendaProgress = 0;
  let loyaltyChange = 0;
  const secretActions: string[] = [];

  // If chose agenda over faction, consequences occur
  if (chosen.agendaAligned && !chosen.factionAligned) {
    agendaProgress = 5 + Math.floor(Math.random() * 10);
    suspicionGenerated += 5;
    loyaltyChange = -2;

    // May take additional secret actions
    if (betrayalTendency > 0.5 && Math.random() < 0.3) {
      secretActions.push(generateSecretAction(agendaType));
    }
  } else if (chosen.factionAligned && !chosen.agendaAligned) {
    // Loyal choice, but agenda stalls
    loyaltyChange = 1;
    agendaProgress = -2;
  } else if (chosen.factionAligned && chosen.agendaAligned) {
    // Best of both worlds
    agendaProgress = 2;
    loyaltyChange = 1;
  }

  // Generate justifications
  const publicJustification = generatePublicJustification(chosen, situation.orderGuidance);
  const trueMotivation = chosen.agendaAligned && !chosen.factionAligned
    ? `Serves personal agenda: ${governor.personalAgenda.description}`
    : "Genuine faction loyalty";

  return {
    chosenOptionId: chosen.id,
    chosenOption: chosen.option,
    publicJustification,
    trueMotivation,
    suspicionGenerated,
    agendaProgress,
    loyaltyChange,
    secretActionsResolted: secretActions,
  };
}

function generatePublicJustification(option: GovernorOption, orderGuidance?: string): string {
  if (option.factionAligned) {
    if (orderGuidance) {
      return `Following standing orders: ${orderGuidance}`;
    }
    return "Acting in the faction's best interests";
  }

  // Need to justify non-faction-aligned choice
  const justifications = [
    "Local conditions required adaptation",
    "Time-sensitive decision, couldn't wait for orders",
    "Preserving faction resources for future operations",
    "Intelligence suggested alternative approach",
    "Maintaining our cover required this action",
  ];
  return justifications[Math.floor(Math.random() * justifications.length)];
}

function generateSecretAction(agendaType: PersonalAgendaType): string {
  const actions: Record<PersonalAgendaType, string[]> = {
    power_grab: ["Cultivated ally among local officials", "Undermined rival's reputation"],
    succession: ["Sent message to potential supporters", "Documented leader's failures"],
    independence: ["Diverted small amount to hidden account", "Made contact with potential ally"],
    defection: ["Passed intelligence to rival faction", "Tested escape route"],
    embezzlement: ["Skimmed gold from operation", "Falsified expense report"],
    side_business: ["Met with outside business partner", "Used faction resources for personal venture"],
    bribery_taking: ["Accepted payment for favorable treatment", "Looked the other way on violation"],
    treasure_hunting: ["Investigated lead on treasure", "Diverted resources to personal search"],
    reform: ["Documented faction excesses", "Contacted like-minded members"],
    purism: ["Took harder action than ordered", "Punished perceived weakness"],
    moderation: ["Softened implementation of harsh orders", "Warned potential victim"],
    religious_agenda: ["Performed secret ritual", "Advanced religious cause"],
    revenge: ["Gathered information on target", "Positioned for future strike"],
    protect_family: ["Diverted resources to family", "Ensured family safety"],
    forbidden_love: ["Secret meeting with lover", "Protected lover's interests"],
    secret_identity: ["Maintained old identity connections", "Covered tracks on true identity"],
    addiction: ["Indulged addiction", "Secured supply"],
    spy: ["Passed information to handler", "Received new instructions"],
    crown_loyalist: ["Reported to crown contact", "Softened anti-crown action"],
    cult_member: ["Performed cult duty", "Advanced cult goals subtly"],
    double_agent: ["Played factions against each other", "Increased own leverage"],
    loyal: [],
  };

  const options = actions[agendaType];
  if (!options.length) return "";
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================
// ORDER COMPLIANCE
// ============================================

export interface ComplianceResult {
  willComply: boolean;
  complianceLevel: "full" | "partial" | "minimal" | "refused" | "subverted";
  publicResponse: string;
  trueReason: string;
  suspicionGenerated: number;
  executionQuality: number;  // 0-100, how well they execute
  delayDays: number;         // How long they delay
  modifiedExecution?: string; // How they changed the order
}

/**
 * Evaluate how a governor responds to a specific order.
 */
export function evaluateOrderCompliance(
  governor: Governor,
  order: FactionMessage,
): ComplianceResult {
  calculateTotalLoyalty(governor);
  const agendaType = governor.personalAgenda.type;

  // Check for conflicts
  const conflictsWithAgenda = checkAgendaConflict(governor, order);
  const conflictsWithCompromises = governor.currentCompromises.some(c =>
    order.content.toLowerCase().includes(c.serviceDemanded?.toLowerCase() ?? "NOMATCH")
  );

  // Get base compliance
  const baseResult = wouldFollowOrder(governor, {
    content: order.content,
    authority: order.orderDetails?.authority ?? "order",
    conflictsWithAgenda,
    conflictsWithCompromises,
  });

  // Calculate execution quality
  let executionQuality = governor.competence;
  let delayDays = 0;
  let suspicionGenerated = 0;
  let modifiedExecution: string | undefined;

  switch (baseResult.compliance) {
    case "full":
      executionQuality = Math.min(100, governor.competence + 10);
      delayDays = 0;
      break;

    case "partial":
      executionQuality = governor.competence * 0.7;
      delayDays = 1 + Math.floor(Math.random() * 3);
      modifiedExecution = "Executed with unauthorized modifications";
      suspicionGenerated = 5;
      break;

    case "minimal":
      executionQuality = governor.competence * 0.4;
      delayDays = 3 + Math.floor(Math.random() * 7);
      modifiedExecution = "Letter of the order followed, spirit ignored";
      suspicionGenerated = 10;
      break;

    case "refused":
      executionQuality = 0;
      delayDays = Infinity;
      modifiedExecution = "Order ignored entirely";
      suspicionGenerated = 25;
      break;
  }

  // Subversion (actively working against order)
  const subverts = baseResult.compliance === "refused" &&
    AGENDA_BETRAYAL_TENDENCY[agendaType] > 0.5 &&
    Math.random() < 0.3;

  const publicResponse = generatePublicResponse(baseResult.compliance, order);

  return {
    willComply: baseResult.follows,
    complianceLevel: subverts ? "subverted" : baseResult.compliance,
    publicResponse,
    trueReason: baseResult.reason,
    suspicionGenerated,
    executionQuality,
    delayDays,
    modifiedExecution,
  };
}

function checkAgendaConflict(governor: Governor, order: FactionMessage): boolean {
  const content = order.content.toLowerCase();
  const triggers = governor.personalAgenda.conflictTriggers.map(t => t.toLowerCase());

  // Check explicit conflict triggers
  for (const trigger of triggers) {
    if (content.includes(trigger)) return true;
  }

  // Check agenda-specific conflicts
  const agendaType = governor.personalAgenda.type;

  switch (agendaType) {
    case "embezzlement":
    case "side_business":
      if (content.includes("audit") || content.includes("account")) return true;
      break;
    case "spy":
    case "defection":
      if (content.includes("loyalty") || content.includes("security")) return true;
      break;
    case "protect_family":
      if (content.includes("family") || content.includes(governor.name.split(" ")[1]?.toLowerCase() ?? "")) return true;
      break;
    case "revenge":
      // Would need to know target name
      break;
  }

  return false;
}

function generatePublicResponse(
  compliance: "full" | "partial" | "minimal" | "refused",
  order: FactionMessage,
): string {
  switch (compliance) {
    case "full":
      return `Understood. Will execute immediately: ${order.subject}`;
    case "partial":
      return `Acknowledged. Will adapt to local conditions as needed.`;
    case "minimal":
      return `Received. Will consider when resources permit.`;
    case "refused":
      return `Unable to comply due to local circumstances. Requesting clarification.`;
  }
}

// ============================================
// AGENDA PROGRESSION
// ============================================

export interface AgendaProgressResult {
  progressChange: number;
  newProgress: number;
  milestone: boolean;
  milestoneDescription?: string;
  suspicionChange: number;
  newSuspicion: number;
  evidenceGenerated?: Governor["personalAgenda"]["evidence"][0];
  exposureRisk: "low" | "medium" | "high" | "imminent";
}

/**
 * Progress a governor's personal agenda during a week.
 */
export function progressPersonalAgenda(
  governor: Governor,
  weeklyContext: {
    opportunities: string[];
    threats: string[];
    factionDistracted: boolean;
    partyPresent: boolean;
    resourcesAvailable: number;
  },
): AgendaProgressResult {
  const agenda = governor.personalAgenda;

  // Loyal governors don't progress agendas
  if (agenda.type === "loyal") {
    return {
      progressChange: 0,
      newProgress: 0,
      milestone: false,
      suspicionChange: 0,
      newSuspicion: agenda.suspicionLevel,
      exposureRisk: "low",
    };
  }

  // Base progress
  let progressChange = 2 + Math.floor(Math.random() * 5);

  // Opportunities boost progress
  if (weeklyContext.opportunities.length > 0) {
    progressChange += 3 * weeklyContext.opportunities.length;
  }

  // Threats slow progress
  if (weeklyContext.threats.length > 0) {
    progressChange -= 2 * weeklyContext.threats.length;
  }

  // Faction distraction helps
  if (weeklyContext.factionDistracted) {
    progressChange += 5;
  }

  // Party presence is dangerous
  if (weeklyContext.partyPresent) {
    progressChange -= 3;
  }

  // Resources help certain agendas
  if (["embezzlement", "side_business", "independence"].includes(agenda.type)) {
    progressChange += Math.floor(weeklyContext.resourcesAvailable / 1000);
  }

  // Clamp progress
  progressChange = Math.max(-5, Math.min(15, progressChange));
  const newProgress = Math.max(0, Math.min(100, agenda.progress + progressChange));

  // Check for milestone
  const milestone = Math.floor(newProgress / 25) > Math.floor(agenda.progress / 25);
  const milestoneDescription = milestone ? generateMilestoneDescription(agenda.type, newProgress) : undefined;

  // Suspicion changes
  let suspicionChange = 0;
  if (progressChange > 5) {
    suspicionChange = Math.floor(progressChange / 3);
  }
  if (weeklyContext.partyPresent) {
    suspicionChange += 2;
  }
  const newSuspicion = Math.max(0, Math.min(100, agenda.suspicionLevel + suspicionChange));

  // Evidence generation (high progress = more evidence)
  let evidenceGenerated: Governor["personalAgenda"]["evidence"][0] | undefined;
  if (milestone && Math.random() < 0.4) {
    evidenceGenerated = generateNewEvidence(agenda.type);
  }

  // Exposure risk
  let exposureRisk: AgendaProgressResult["exposureRisk"] = "low";
  if (newSuspicion >= 75) exposureRisk = "imminent";
  else if (newSuspicion >= 50) exposureRisk = "high";
  else if (newSuspicion >= 25) exposureRisk = "medium";

  return {
    progressChange,
    newProgress,
    milestone,
    milestoneDescription,
    suspicionChange,
    newSuspicion,
    evidenceGenerated,
    exposureRisk,
  };
}

function generateMilestoneDescription(agendaType: PersonalAgendaType, progress: number): string {
  const tier = Math.floor(progress / 25);

  const milestones: Record<PersonalAgendaType, string[]> = {
    power_grab: [
      "Identified key supporters",
      "Built coalition of allies",
      "Positioned for power move",
      "Ready to seize authority",
    ],
    succession: [
      "Documented leader's weaknesses",
      "Cultivated successor supporters",
      "Prepared transition plan",
      "Ready to assume leadership",
    ],
    independence: [
      "Established hidden resources",
      "Recruited loyal followers",
      "Secured escape route",
      "Ready to declare independence",
    ],
    defection: [
      "Made contact with rival",
      "Negotiated terms",
      "Prepared intelligence package",
      "Ready to switch sides",
    ],
    embezzlement: [
      "Established skimming method",
      "Accumulated significant wealth",
      "Created plausible cover",
      "Wealth secured for retirement",
    ],
    side_business: [
      "Established side operation",
      "Business becoming profitable",
      "Significant resources diverted",
      "Side business rivals main role",
    ],
    bribery_taking: [
      "Established bribe network",
      "Multiple payers on roster",
      "Significant income stream",
      "Completely compromised",
    ],
    treasure_hunting: [
      "Found promising leads",
      "Expedition planned",
      "Treasure located",
      "Ready to claim treasure",
    ],
    reform: [
      "Documented problems",
      "Found like-minded members",
      "Built reform coalition",
      "Ready to push for change",
    ],
    purism: [
      "Identified soft elements",
      "Built hardliner network",
      "Prepared purification plan",
      "Ready to purge moderates",
    ],
    moderation: [
      "Softened harsh policies",
      "Built moderate coalition",
      "Prepared reform proposals",
      "Ready to push moderation",
    ],
    religious_agenda: [
      "Established religious practice",
      "Recruited fellow believers",
      "Advanced divine cause",
      "Ready for major religious action",
    ],
    revenge: [
      "Gathered intelligence on target",
      "Positioned for strike",
      "Prepared revenge plan",
      "Ready to strike",
    ],
    protect_family: [
      "Established family safety",
      "Diverted resources to family",
      "Family well-protected",
      "Family completely secure",
    ],
    forbidden_love: [
      "Relationship established",
      "Deep emotional connection",
      "Willing to sacrifice for love",
      "Love overrides all else",
    ],
    secret_identity: [
      "Identity carefully maintained",
      "Close calls avoided",
      "Identity increasingly strained",
      "Identity about to unravel",
    ],
    addiction: [
      "Addiction managed",
      "Addiction affecting judgment",
      "Addiction creating problems",
      "Addiction out of control",
    ],
    spy: [
      "Intelligence network established",
      "Valuable intel passed",
      "Deep cover maintained",
      "Ready for major betrayal",
    ],
    crown_loyalist: [
      "Crown contact established",
      "Reporting regularly",
      "Significant intel shared",
      "Ready to act for crown",
    ],
    cult_member: [
      "Cult duties performed",
      "Rose in cult hierarchy",
      "Significant cult actions taken",
      "Ready for major cult operation",
    ],
    double_agent: [
      "Multiple handlers managed",
      "Playing all sides",
      "Maximizing personal benefit",
      "Complete free agent",
    ],
    loyal: [],
  };

  const stages = milestones[agendaType];
  return stages[Math.min(tier, stages.length - 1)] ?? "Agenda progresses";
}

function generateNewEvidence(agendaType: PersonalAgendaType): Governor["personalAgenda"]["evidence"][0] {
  const evidenceTypes: Record<PersonalAgendaType, Array<{ type: Governor["personalAgenda"]["evidence"][0]["type"]; description: string; dc: number }>> = {
    embezzlement: [
      { type: "document", description: "Falsified ledger entries", dc: 14 },
      { type: "witness", description: "Clerk noticed discrepancies", dc: 16 },
    ],
    spy: [
      { type: "intercepted_message", description: "Coded message to handler", dc: 18 },
      { type: "behavior_pattern", description: "Regular unexplained absences", dc: 15 },
    ],
    defection: [
      { type: "intercepted_message", description: "Communication with rival faction", dc: 17 },
      { type: "witness", description: "Seen meeting with enemy agent", dc: 19 },
    ],
    revenge: [
      { type: "document", description: "List of grievances and plans", dc: 13 },
      { type: "behavior_pattern", description: "Obsessive interest in target", dc: 14 },
    ],
    forbidden_love: [
      { type: "witness", description: "Seen in compromising situation", dc: 12 },
      { type: "physical_evidence", description: "Love letters", dc: 11 },
    ],
    power_grab: [{ type: "behavior_pattern", description: "Cultivating unusual alliances", dc: 16 }],
    succession: [{ type: "document", description: "Notes on leader's failures", dc: 15 }],
    independence: [{ type: "document", description: "Hidden resource accounts", dc: 17 }],
    side_business: [{ type: "document", description: "Side business records", dc: 14 }],
    bribery_taking: [{ type: "physical_evidence", description: "Hidden wealth", dc: 13 }],
    treasure_hunting: [{ type: "document", description: "Treasure maps and notes", dc: 12 }],
    reform: [{ type: "document", description: "Reform manifesto", dc: 11 }],
    purism: [{ type: "behavior_pattern", description: "Extreme statements to allies", dc: 14 }],
    moderation: [{ type: "behavior_pattern", description: "Softening orders", dc: 13 }],
    religious_agenda: [{ type: "physical_evidence", description: "Religious artifacts", dc: 15 }],
    protect_family: [{ type: "document", description: "Resource transfers to family", dc: 12 }],
    secret_identity: [{ type: "document", description: "False identity papers", dc: 18 }],
    addiction: [{ type: "physical_evidence", description: "Substance stash", dc: 11 }],
    crown_loyalist: [{ type: "intercepted_message", description: "Reports to crown", dc: 17 }],
    cult_member: [{ type: "physical_evidence", description: "Cult paraphernalia", dc: 16 }],
    double_agent: [{ type: "behavior_pattern", description: "Inconsistent loyalties", dc: 19 }],
    loyal: [],
  };

  const options = evidenceTypes[agendaType];
  if (!options || options.length === 0) {
    return {
      type: "behavior_pattern",
      description: "Suspicious behavior",
      discoveryDC: 15,
      canBeDestroyed: false,
      isDestroyed: false,
    };
  }

  const chosen = options[Math.floor(Math.random() * options.length)];
  return {
    type: chosen.type,
    description: chosen.description,
    discoveryDC: chosen.dc,
    canBeDestroyed: chosen.type !== "behavior_pattern" && chosen.type !== "witness",
    isDestroyed: false,
  };
}

// ============================================
// EXPOSURE & INVESTIGATION
// ============================================

export interface ExposureCheckResult {
  exposed: boolean;
  partiallyExposed: boolean;
  discoveredEvidence: Governor["personalAgenda"]["evidence"];
  suspicionIncrease: number;
  investigatorLearned: string[];
}

/**
 * Check if a governor's agenda is discovered during investigation.
 */
export function checkAgendaExposure(
  governor: Governor,
  investigators: Array<{
    id: string;
    name: string;
    type: "faction" | "party" | "rival";
    skill: number;
    method: "audit" | "interrogation" | "surveillance" | "magic" | "informant";
  }>,
): ExposureCheckResult {
  const agenda = governor.personalAgenda;
  const evidence = agenda.evidence.filter(e => !e.isDestroyed);

  const discoveredEvidence: Governor["personalAgenda"]["evidence"] = [];
  let suspicionIncrease = 0;
  const investigatorLearned: string[] = [];

  for (const investigator of investigators) {
    // Method bonuses
    const methodBonus: Record<typeof investigator.method, number> = {
      audit: 2,
      interrogation: 0,
      surveillance: 3,
      magic: 5,
      informant: 4,
    };

    const totalSkill = investigator.skill + methodBonus[investigator.method];

    // Check each piece of evidence
    for (const piece of evidence) {
      if (discoveredEvidence.includes(piece)) continue;

      const roll = Math.floor(Math.random() * 20) + 1 + totalSkill;
      if (roll >= piece.discoveryDC) {
        discoveredEvidence.push(piece);
        investigatorLearned.push(`${investigator.name} found: ${piece.description}`);
        suspicionIncrease += 15;
      }
    }

    // General suspicion from investigation
    suspicionIncrease += 5;
  }

  const exposed = discoveredEvidence.length >= 2 ||
    discoveredEvidence.some(e => e.type === "confession");
  const partiallyExposed = discoveredEvidence.length > 0 && !exposed;

  return {
    exposed,
    partiallyExposed,
    discoveredEvidence,
    suspicionIncrease,
    investigatorLearned,
  };
}

// ============================================
// LOYALTY CHANGES
// ============================================

export interface LoyaltyUpdateResult {
  previousLoyalty: number;
  newLoyalty: number;
  change: number;
  newTrend: "falling" | "stable" | "rising";
  factorsChanged: Array<{ factor: string; change: number }>;
  defectionRisk: "none" | "low" | "medium" | "high" | "imminent";
}

/**
 * Update governor loyalty based on weekly events.
 */
export function updateGovernorLoyalty(
  governor: Governor,
  weeklyEvents: {
    ordersReceived: boolean;
    ordersReasonable: boolean;
    resourcesProvided: boolean;
    threatsFromFaction: boolean;
    opportunitiesFromOutside: boolean;
    personalSuccesses: number;
    personalFailures: number;
    factionSuccesses: number;
    factionFailures: number;
  },
): LoyaltyUpdateResult {
  const previousLoyalty = governor.loyalty;
  let change = 0;
  const factorsChanged: Array<{ factor: string; change: number }> = [];

  // Orders received = faction cares
  if (weeklyEvents.ordersReceived) {
    if (weeklyEvents.ordersReasonable) {
      change += 2;
      factorsChanged.push({ factor: "Reasonable orders received", change: 2 });
    } else {
      change -= 3;
      factorsChanged.push({ factor: "Unreasonable orders received", change: -3 });
    }
  } else if (governor.weeksWithoutContact > 2) {
    change -= 3;
    factorsChanged.push({ factor: "Feeling abandoned", change: -3 });
  }

  // Resources = faction supports them
  if (weeklyEvents.resourcesProvided) {
    change += 3;
    factorsChanged.push({ factor: "Resources provided", change: 3 });
  }

  // Threats = faction is scary
  if (weeklyEvents.threatsFromFaction) {
    // Fear increases short-term compliance but hurts long-term loyalty
    change -= 5;
    factorsChanged.push({ factor: "Threatened by faction", change: -5 });
  }

  // Outside opportunities tempt them
  if (weeklyEvents.opportunitiesFromOutside) {
    change -= 2;
    factorsChanged.push({ factor: "Outside opportunities", change: -2 });
  }

  // Personal performance
  if (weeklyEvents.personalSuccesses > weeklyEvents.personalFailures) {
    change += 1;
    factorsChanged.push({ factor: "Personal success", change: 1 });
  } else if (weeklyEvents.personalFailures > weeklyEvents.personalSuccesses) {
    change -= 2;
    factorsChanged.push({ factor: "Personal failures", change: -2 });
  }

  // Faction performance affects morale
  if (weeklyEvents.factionSuccesses > weeklyEvents.factionFailures) {
    change += 2;
    factorsChanged.push({ factor: "Faction doing well", change: 2 });
  } else if (weeklyEvents.factionFailures > weeklyEvents.factionSuccesses) {
    change -= 3;
    factorsChanged.push({ factor: "Faction struggling", change: -3 });
  }

  // Apply change
  const newLoyalty = Math.max(0, Math.min(100, previousLoyalty + change));

  // Determine trend
  let newTrend: "falling" | "stable" | "rising" = "stable";
  if (change > 2) newTrend = "rising";
  else if (change < -2) newTrend = "falling";

  // Defection risk
  let defectionRisk: LoyaltyUpdateResult["defectionRisk"] = "none";
  if (newLoyalty <= 10) defectionRisk = "imminent";
  else if (newLoyalty <= 25) defectionRisk = "high";
  else if (newLoyalty <= 40) defectionRisk = "medium";
  else if (newLoyalty <= 55) defectionRisk = "low";

  return {
    previousLoyalty,
    newLoyalty,
    change,
    newTrend,
    factorsChanged,
    defectionRisk,
  };
}

/**
 * Apply loyalty update to governor.
 */
export function applyLoyaltyUpdate(
  governor: Governor,
  result: LoyaltyUpdateResult,
): Governor {
  return {
    ...governor,
    loyalty: result.newLoyalty,
    loyaltyTrend: result.newTrend,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply agenda progress to governor.
 */
export function applyAgendaProgress(
  governor: Governor,
  result: AgendaProgressResult,
): Governor {
  const updatedEvidence = result.evidenceGenerated
    ? [...governor.personalAgenda.evidence, result.evidenceGenerated]
    : governor.personalAgenda.evidence;

  return {
    ...governor,
    personalAgenda: {
      ...governor.personalAgenda,
      progress: result.newProgress,
      suspicionLevel: result.newSuspicion,
      evidence: updatedEvidence,
    },
    updatedAt: new Date().toISOString(),
  };
}
