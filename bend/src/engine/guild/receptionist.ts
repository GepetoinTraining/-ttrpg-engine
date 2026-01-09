/**
 * The Adventurer's Guild Receptionist
 *
 * She exists in every branch. In every city. Across every world.
 * Same face. Same smile. Same unsettling omniscience.
 *
 * "Ara ara, adventurer-san~ First time at THIS branch, I see..."
 * (How did she know?)
 *
 * The Guild Receptionist Network is non-local. They share information
 * instantaneously across all branches. Quantum entangled waifus.
 * This is never explained. This is never questioned.
 */

import { z } from "zod";

// =============================================================================
// THE ETERNAL RECEPTIONIST
// =============================================================================

/**
 * She has many names. They are all the same name.
 */
export const RECEPTIONIST_NAMES = [
  // The K-variants
  "Katarina",
  "Katharina",
  "Catarina",
  "Katherine",
  "Katerina",
  "Ekaterina",
  "Caterina",
  "Katalina",

  // The E-variants
  "Elena",
  "Helena",
  "Elenna",
  "Ellena",
  "Helenna",

  // The A-variants
  "Aria",
  "Arya",
  " Aria",
  "Arianna",
  "Ariana",

  // The S-variants
  "Sophia",
  "Sofia",
  "Sofiya",
  "Sophie",

  // The L-variants
  "Lyra",
  "Lira",
  "Lyria",
  "Liria",
] as const;

export type ReceptionistName = (typeof RECEPTIONIST_NAMES)[number];

/**
 * Get a receptionist name for a guild branch.
 * The name is deterministic based on branch ID - she's always the same
 * at the same branch, but "different" at different branches.
 */
export function getReceptionistName(branchId: string): ReceptionistName {
  // Hash the branch ID to get a consistent index
  let hash = 0;
  for (let i = 0; i < branchId.length; i++) {
    const char = branchId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % RECEPTIONIST_NAMES.length;
  return RECEPTIONIST_NAMES[index];
}

/**
 * The receptionist's unsettling traits
 */
export const ReceptionistTraitSchema = z.enum([
  "knows_your_name", // Before you introduce yourself
  "knows_your_hometown", // "How's the weather in [place you never mentioned]?"
  "knows_your_class", // "A [class] like yourself..."
  "knows_your_party", // "Are your friends parking the cart?"
  "knows_your_quest", // "Back from the goblin cave already?"
  "knows_your_death", // "You look well for someone who died last Tuesday"
  "knows_your_future", // "You'll want the fire resistance potions. Trust me."
  "knows_your_secrets", // *knowing smile*
  "remembers_other_branches", // "Your tab from Waterdeep transferred~"
  "remembers_other_timelines", // "You made a different choice last time..."
  "remembers_other_campaigns", // "Your previous character said hi"
]);
export type ReceptionistTrait = z.infer<typeof ReceptionistTraitSchema>;

/**
 * Things she says that she shouldn't be able to say
 */
export const UNSETTLING_GREETINGS: Record<ReceptionistTrait, string[]> = {
  knows_your_name: [
    "Welcome, {name}! First time at this branch~",
    "Ah, {name}-san! We've been expecting you.",
    "{name}, right? Your reputation precedes you~",
  ],
  knows_your_hometown: [
    "How's the weather back in {hometown}?",
    "You're far from {hometown}. Long journey?",
    "We don't get many from {hometown} here~",
  ],
  knows_your_class: [
    "A {class} like yourself must be tired from the road.",
    "We have special rates for {class}s this month~",
    "The {class} guild discount applies, of course.",
  ],
  knows_your_party: [
    "Are your friends parking the cart outside?",
    "Will {party_member} be joining you today?",
    "Your usual party composition, I see~",
  ],
  knows_your_quest: [
    "Back from {quest_location} already? That was fast~",
    "How did {quest_target} taste? I mean... go?",
    "The {quest_item}? Yes, we heard you found it.",
  ],
  knows_your_death: [
    "You look well! Much better than last Tuesday.",
    "Death becomes you~ ...I mean, welcome back!",
    "The resurrection took well, I see.",
  ],
  knows_your_future: [
    "You'll want the fire resistance potions. Trust me~",
    "I'd avoid the east road today if I were you.",
    "Your next quest will be... interesting.",
  ],
  knows_your_secrets: [
    "*knowing smile* Your secret is safe with the Guild~",
    "About that thing you did... we don't judge here.",
    "The Guild sees all, adventurer-san. But we're discreet~",
  ],
  remembers_other_branches: [
    "Your tab from {other_city} transferred automatically~",
    "I see you preferred the Neverwinter branch's coffee.",
    "The Baldur's Gate receptionist sends her regards.",
  ],
  remembers_other_timelines: [
    "You made a different choice last time... interesting~",
    "In another timeline, you'd be asking about goblins.",
    "This path suits you better, I think.",
  ],
  remembers_other_campaigns: [
    "Your previous... associate... said hello.",
    "You remind me of someone. Same eyes.",
    "The Guild remembers all who serve. ALL.",
  ],
};

// =============================================================================
// THE ORB OF REVELATION
// =============================================================================

/**
 * Adventurer Rank - the isekai power scale
 * Everyone starts as "F" (hidden). The orb reveals the truth.
 */
export const AdventurerRankSchema = z.enum([
  "F", // Unawakened / Hidden
  "E", // Beginner
  "D", // Novice
  "C", // Intermediate
  "B", // Advanced
  "A", // Expert
  "S", // Elite
  "SS", // Legendary
  "SSS", // Mythical
  "EX", // Beyond measurement (error? or...)
]);
export type AdventurerRank = z.infer<typeof AdventurerRankSchema>;

/**
 * The orb's reaction to measuring someone
 */
export const OrbReactionSchema = z.enum([
  "dim_glow", // F-E rank, barely registers
  "steady_glow", // D-C rank, normal adventurer
  "bright_glow", // B-A rank, impressive
  "blinding_flash", // S rank, everyone looks
  "sustained_radiance", // SS rank, receptionist drops clipboard
  "reality_crack", // SSS rank, orb struggles
  "orb_shatters", // EX rank, this shouldn't happen
  "orb_speaks", // ??? the orb has never spoken before
]);
export type OrbReaction = z.infer<typeof OrbReactionSchema>;

/**
 * What the orb reveals (or fails to reveal)
 */
export const OrbReadingSchema = z.object({
  characterId: z.string().uuid(),
  guildBranchId: z.string().uuid(),
  receptionistName: z.string(),

  // The reveal
  previousRank: z.literal("F"), // Always starts hidden
  revealedRank: AdventurerRankSchema,
  orbReaction: OrbReactionSchema,

  // Special cases
  anomalies: z.array(
    z.enum([
      "fluctuating", // Rank keeps changing
      "suppressed", // Something is hiding their power
      "dual_reading", // Two souls? Two classes?
      "divine_interference", // A god is watching
      "demonic_taint", // Warlock detected
      "isekai_signature", // Not from this world
      "protagonist_aura", // Plot armor detected
      "harem_magnetism", // ...the orb measures this?
    ])
  ),

  // The receptionist's reaction
  receptionistReaction: z.enum([
    "professional_smile", // Normal, expected
    "eyebrow_raise", // Interesting...
    "clipboard_drop", // Oh my
    "calls_manager", // This is above my pay grade
    "faints", // SS+ rank reaction
    "ara_ara_intensifies", // She KNEW
    "breaks_character", // "What the f-" *cough* "How lovely~"
    "silent_knowing_nod", // She expected this
  ]),

  // Timestamp
  revealedAt: z.string().datetime(),
});
export type OrbReading = z.infer<typeof OrbReadingSchema>;

// =============================================================================
// RANK CALCULATION
// =============================================================================

/**
 * Map character level to adventurer rank
 * (The orb doesn't lie, but it does love drama)
 */
export function calculateTrueRank(
  characterLevel: number,
  hasProtagonistVibes: boolean = false
): AdventurerRank {
  // Base rank from level
  let rank: AdventurerRank;

  if (characterLevel <= 1) rank = "F";
  else if (characterLevel <= 3) rank = "E";
  else if (characterLevel <= 5) rank = "D";
  else if (characterLevel <= 8) rank = "C";
  else if (characterLevel <= 11) rank = "B";
  else if (characterLevel <= 14) rank = "A";
  else if (characterLevel <= 17) rank = "S";
  else if (characterLevel <= 19) rank = "SS";
  else rank = "SSS";

  // Protagonist buff (isekai logic)
  if (hasProtagonistVibes && rank !== "SSS") {
    const ranks: AdventurerRank[] = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];
    const currentIndex = ranks.indexOf(rank);
    rank = ranks[Math.min(currentIndex + 1, ranks.length - 1)];
  }

  return rank;
}

/**
 * Determine orb reaction based on rank
 */
export function getOrbReaction(rank: AdventurerRank): OrbReaction {
  switch (rank) {
    case "F":
    case "E":
      return "dim_glow";
    case "D":
    case "C":
      return "steady_glow";
    case "B":
    case "A":
      return "bright_glow";
    case "S":
      return "blinding_flash";
    case "SS":
      return "sustained_radiance";
    case "SSS":
      return "reality_crack";
    case "EX":
      return "orb_shatters";
  }
}

/**
 * Determine receptionist reaction based on rank and anomalies
 */
export function getReceptionistReaction(
  rank: AdventurerRank,
  anomalies: string[]
): OrbReading["receptionistReaction"] {
  // Anomalies override rank-based reactions
  if (anomalies.includes("isekai_signature")) return "ara_ara_intensifies";
  if (anomalies.includes("protagonist_aura")) return "silent_knowing_nod";
  if (anomalies.includes("harem_magnetism")) return "breaks_character";

  // Rank-based reactions
  switch (rank) {
    case "F":
    case "E":
    case "D":
      return "professional_smile";
    case "C":
    case "B":
      return "eyebrow_raise";
    case "A":
    case "S":
      return "clipboard_drop";
    case "SS":
      return "faints";
    case "SSS":
    case "EX":
      return "calls_manager";
  }
}

// =============================================================================
// THE GUILD BRANCH
// =============================================================================

export const GuildBranchSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),
  name: z.string(), // "Waterdeep Adventurer's Guild - Main Branch"

  receptionist: z.object({
    name: z.string(), // One of THE names
    traits: z.array(ReceptionistTraitSchema),
    knowsAboutPlayer: z.record(z.string().uuid(), z.array(z.string())), // What she "shouldn't" know
  }),

  orb: z.object({
    intact: z.boolean(), // Has anyone shattered it?
    shatteredBy: z.string().uuid().optional(),
    shatteredAt: z.string().datetime().optional(),
    replacementOrdered: z.boolean(),
    timesShattered: z.number().int(), // Guild keeps count
  }),

  facilities: z.object({
    questBoard: z.boolean(),
    tavern: z.boolean(),
    training: z.boolean(),
    storage: z.boolean(),
    baths: z.boolean(), // Important for isekai
    dormitory: z.boolean(),
  }),

  registeredAdventurers: z.number().int(),
  highestRankPresent: AdventurerRankSchema,
});
export type GuildBranch = z.infer<typeof GuildBranchSchema>;

// =============================================================================
// THE REGISTRATION CEREMONY (AI PROMPT STRUCTURE)
// =============================================================================

/**
 * Context for the AI-driven orb reading scene
 */
export const OrbReadingContextSchema = z.object({
  character: z.object({
    id: z.string().uuid(),
    name: z.string(),
    race: z.string(),
    class: z.string(),
    level: z.number().int(),
    background: z.string().optional(),
    homeland: z.string().optional(),
    secrets: z.array(z.string()).optional(),
  }),

  guild: z.object({
    branchId: z.string().uuid(),
    branchName: z.string(),
    receptionistName: z.string(),
    settlementName: z.string(),
  }),

  // Pre-calculated for the AI
  trueRank: AdventurerRankSchema,
  orbReaction: OrbReactionSchema,
  anomalies: z.array(z.string()),
  receptionistReaction: z.string(),

  // What the receptionist "impossibly" knows
  impossibleKnowledge: z.array(z.string()),

  // Tone guidance
  tone: z.enum(["comedic", "dramatic", "mysterious", "wholesome"]),
});
export type OrbReadingContext = z.infer<typeof OrbReadingContextSchema>;

/**
 * Build the structured prompt for the orb reading scene
 */
export function buildOrbReadingPrompt(context: OrbReadingContext): string {
  return `
You are narrating the iconic "adventurer's guild registration" scene from isekai/fantasy stories.

SETTING:
- Guild Branch: ${context.guild.branchName} in ${context.guild.settlementName}
- Receptionist: ${context.guild.receptionistName} (beautiful, professional, unsettlingly omniscient)
- Adventurer: ${context.character.name}, a level ${context.character.level} ${context.character.race} ${context.character.class}

THE SCENE:
${context.guild.receptionistName} greets ${context.character.name} at the registration desk. She somehow already knows things she shouldn't (pick 1-2): ${context.impossibleKnowledge.join(", ")}

She brings out the Orb of Revelation - a crystal sphere that measures an adventurer's true potential.

THE REVEAL:
- Current displayed rank: F (hidden/unawakened)
- TRUE rank revealed: ${context.trueRank}
- Orb reaction: ${context.orbReaction}
- Receptionist reaction: ${context.receptionistReaction}
${context.anomalies.length > 0 ? `- Anomalies detected: ${context.anomalies.join(", ")}` : ""}

TONE: ${context.tone}

Write this scene in 3-4 paragraphs:
1. The greeting (she knows something she shouldn't)
2. The orb ceremony begins
3. The dramatic reveal (describe the orb's reaction)
4. The aftermath (receptionist's reaction, nearby adventurers' reactions if rank is high)

Keep ${context.guild.receptionistName}'s dialogue slightly formal but warm, with occasional "ara ara" energy for high-rank reveals. She should seem unsurprised by surprising results, as if she knew all along.
`.trim();
}

/**
 * Generate impossible knowledge based on character
 */
export function generateImpossibleKnowledge(
  character: OrbReadingContext["character"]
): string[] {
  const knowledge: string[] = [];

  knowledge.push(`knows ${character.name}'s name before introduction`);

  if (character.homeland) {
    knowledge.push(`mentions the weather in ${character.homeland}`);
  }

  if (character.class) {
    knowledge.push(`references ${character.class}-specific details`);
  }

  if (character.secrets && character.secrets.length > 0) {
    knowledge.push(`hints at knowing "${character.secrets[0]}"`);
  }

  // Always add one meta-knowledge
  knowledge.push("makes a comment suggesting she's met them before (she hasn't)");

  return knowledge;
}

// =============================================================================
// THE GUILD MANAGER
// =============================================================================

/**
 * He is also always the same person. At every branch. Simultaneously.
 * Unlike the receptionist's warm omniscience, he radiates
 * "I've seen too much" energy.
 *
 * When she says "I need to call the Guild Manager," the tavern goes silent.
 */

export const GUILD_MANAGER_NAMES = [
  // The V-variants (gruff)
  "Vorn",
  "Vorik",
  "Varn",
  "Varek",

  // The A-variants (dignified)
  "Aldric",
  "Aldren",
  "Alduin",
  "Alaric",

  // The G-variants (weathered)
  "Gideon",
  "Gareth",
  "Godric",
  "Gregor",

  // The R-variants (mysterious)
  "Roland",
  "Roderick",
  "Ragnar",
  "Reinhardt",

  // The M-variants (ancient)
  "Magnus",
  "Mordecai",
  "Marcus",
  "Matthias",
] as const;

export type GuildManagerName = (typeof GUILD_MANAGER_NAMES)[number];

/**
 * Get the guild manager name for a branch.
 * Different from receptionist hash to ensure different names.
 */
export function getGuildManagerName(branchId: string): GuildManagerName {
  let hash = 0;
  for (let i = 0; i < branchId.length; i++) {
    const char = branchId.charCodeAt(i);
    hash = (hash << 7) - hash + char; // Different shift than receptionist
    hash = hash & hash;
  }
  const index = Math.abs(hash) % GUILD_MANAGER_NAMES.length;
  return GUILD_MANAGER_NAMES[index];
}

/**
 * Conditions that trigger "I need to call the Guild Manager"
 */
export const MANAGER_SUMMON_TRIGGERS = [
  "rank_s_or_higher", // S, SS, SSS, EX
  "orb_shatters", // This is expensive
  "orb_speaks", // This has never happened
  "ex_rank", // Beyond measurement
  "multiple_anomalies", // 2+ anomalies
  "divine_interference", // A god is watching
  "demonic_taint", // Warlock business
  "reality_crack", // The orb is struggling
  "isekai_confirmed", // Otherworlder detected
] as const;

export type ManagerSummonTrigger = (typeof MANAGER_SUMMON_TRIGGERS)[number];

/**
 * The Manager's demeanor types
 */
export const GuildManagerDemeanorSchema = z.enum([
  "weary_acceptance", // "Another one, huh."
  "professional_concern", // "This is... significant."
  "barely_contained_excitement", // Tries to hide it, fails
  "grim_recognition", // "I've seen this reading before. Once."
  "calls_headquarters", // This is above HIS pay grade
  "offers_private_meeting", // "Perhaps we should discuss this... elsewhere."
  "breaks_protocol", // Does something unprecedented
  "reveals_too_much", // Lets something slip about the Guild's true nature
]);
export type GuildManagerDemeanor = z.infer<typeof GuildManagerDemeanorSchema>;

/**
 * Things the Guild Manager might say (that raise more questions)
 */
export const MANAGER_QUOTES = {
  weary_acceptance: [
    "Another one. The third this century.",
    "*sighs* Clear my schedule.",
    "I was wondering when you'd show up.",
  ],
  professional_concern: [
    "This reading will need to be... verified. By me. Personally.",
    "I'm going to need you to not leave this building for a moment.",
    "How long have you been... like this?",
  ],
  barely_contained_excitement: [
    "This is... *clears throat* ...this is quite standard. Yes. Normal.",
    "I'm not excited. Guild Managers don't get excited. I'm... professionally intrigued.",
    "*hands shaking slightly* Would you care for some tea?",
  ],
  grim_recognition: [
    "I've seen this reading once before. The last one... didn't end well.",
    "The orb remembers you. It shouldn't. It can't. But it does.",
    "You're not the first. Let's hope you last longer than the others.",
  ],
  calls_headquarters: [
    "Excuse me. I need to send a message. To the Founding Branch.",
    "*pulls out a crystal that definitely shouldn't exist* ...Priority Omega.",
    "The Council will want to know about this. Immediately.",
  ],
  offers_private_meeting: [
    "Perhaps we should continue this conversation in my office.",
    "There are things I need to tell you. Things not for... public ears.",
    "Walk with me. And try not to attract attention.",
  ],
  breaks_protocol: [
    "*removes his own guild badge and places it on the counter* ...Take it.",
    "I'm authorizing S-rank access. Yes, I know the reading said higher. Trust me.",
    "*opens a door that wasn't there before* After you.",
  ],
  reveals_too_much: [
    "The Guild wasn't always about adventurers. We were founded to find people like you.",
    "There's a reason we use orbs. A reason we track power levels. A reason we REMEMBER.",
    "She knows, by the way. She always knows. She's not... entirely human. Neither am I.",
  ],
};

/**
 * The summoning scene structure
 */
export const ManagerSummonSchema = z.object({
  triggered: z.boolean(),
  triggers: z.array(z.enum(MANAGER_SUMMON_TRIGGERS)),

  // The moment of transition
  receptionistBreak: z.enum([
    "composure_cracks", // Slight pause, too-wide eyes
    "clipboard_falls", // The classic
    "voice_wavers", // "I... I need to..."
    "freezes", // Stops moving entirely
    "nervous_laugh", // "Ha ha... ha..."
    "drops_honorifics", // Stops saying "-san" (VERY bad sign)
  ]),

  // The line
  summonPhrase: z.enum([
    "I need to call the Guild Manager.",
    "Please wait here. I must... fetch someone.",
    "Excuse me for just one moment.",
    "The Guildmaster will want to see this.",
    "...Don't move.", // Ominous variant
    "Apologies. This is above my... clearance.", // She has clearance?
  ]),

  // Ambient reaction
  tavernReaction: z.enum([
    "silence", // Everyone stops talking
    "ale_drop", // Someone drops their drink
    "chairs_scraping", // People backing away
    "whispers", // Hushed speculation
    "evacuation", // Experienced adventurers leave
    "betting_starts", // Less experienced adventurers place bets
  ]),

  // Wait time (narrative tension)
  waitDescription: z.enum([
    "moments", // He was close
    "minutes", // Had to be summoned
    "uncomfortable_silence", // Time dilates
    "instant", // He was already here (waiting?)
    "he_was_watching", // Steps out of shadows
  ]),

  // The manager appears
  managerEntrance: z.enum([
    "walks_in", // Normal
    "already_there", // Was in the room the whole time
    "descends_stairs", // From the "empty" upper floor
    "steps_from_shadow", // Wasn't there, then was
    "teleports", // Doesn't bother hiding it
    "door_appears", // A door that wasn't there opens
  ]),

  // His demeanor
  demeanor: GuildManagerDemeanorSchema,
});
export type ManagerSummon = z.infer<typeof ManagerSummonSchema>;

/**
 * Check if manager summon is triggered
 */
export function shouldSummonManager(
  rank: AdventurerRank,
  orbReaction: OrbReaction,
  anomalies: string[]
): { triggered: boolean; triggers: ManagerSummonTrigger[] } {
  const triggers: ManagerSummonTrigger[] = [];

  // Rank triggers
  if (["S", "SS", "SSS", "EX"].includes(rank)) {
    triggers.push("rank_s_or_higher");
  }
  if (rank === "EX") {
    triggers.push("ex_rank");
  }

  // Orb reaction triggers
  if (orbReaction === "orb_shatters") {
    triggers.push("orb_shatters");
  }
  if (orbReaction === "orb_speaks") {
    triggers.push("orb_speaks");
  }
  if (orbReaction === "reality_crack") {
    triggers.push("reality_crack");
  }

  // Anomaly triggers
  if (anomalies.length >= 2) {
    triggers.push("multiple_anomalies");
  }
  if (anomalies.includes("divine_interference")) {
    triggers.push("divine_interference");
  }
  if (anomalies.includes("demonic_taint")) {
    triggers.push("demonic_taint");
  }
  if (anomalies.includes("isekai_signature")) {
    triggers.push("isekai_confirmed");
  }

  return {
    triggered: triggers.length > 0,
    triggers,
  };
}

/**
 * Determine manager's demeanor based on triggers
 */
export function getManagerDemeanor(
  triggers: ManagerSummonTrigger[]
): GuildManagerDemeanor {
  // Escalating severity
  if (triggers.includes("orb_speaks")) {
    return "reveals_too_much"; // This has NEVER happened
  }
  if (triggers.includes("ex_rank")) {
    return "calls_headquarters";
  }
  if (triggers.includes("orb_shatters")) {
    return "grim_recognition";
  }
  if (triggers.includes("isekai_confirmed")) {
    return "barely_contained_excitement";
  }
  if (triggers.includes("divine_interference") || triggers.includes("demonic_taint")) {
    return "offers_private_meeting";
  }
  if (triggers.includes("multiple_anomalies")) {
    return "professional_concern";
  }

  return "weary_acceptance"; // Default for S-rank
}

/**
 * Extended context for manager summon scene
 */
export const ManagerSummonContextSchema = z.object({
  // Base orb reading context
  orbReading: OrbReadingContextSchema,

  // Manager summon details
  summon: ManagerSummonSchema,

  // Manager info
  manager: z.object({
    name: z.string(),
    title: z.enum(["Guildmaster", "Director", "Branch Master", "Overseer"]),
  }),
});
export type ManagerSummonContext = z.infer<typeof ManagerSummonContextSchema>;

/**
 * Build the AI prompt for the manager summon scene
 */
export function buildManagerSummonPrompt(context: ManagerSummonContext): string {
  const quotes = MANAGER_QUOTES[context.summon.demeanor];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  return `
You are continuing the adventurer's guild registration scene. The orb reading has triggered something unprecedented, and the receptionist has called for the Guild Manager.

PREVIOUS SCENE:
- ${context.orbReading.guild.receptionistName} just performed the orb reading for ${context.orbReading.character.name}
- Revealed rank: ${context.orbReading.trueRank}
- Orb reaction: ${context.orbReading.orbReaction}
- Anomalies: ${context.orbReading.anomalies.length > 0 ? context.orbReading.anomalies.join(", ") : "none"}

THE TRANSITION:
- Receptionist's composure: ${context.summon.receptionistBreak}
- She says: "${context.summon.summonPhrase}"
- Tavern reaction: ${context.summon.tavernReaction}
- Wait: ${context.summon.waitDescription}
- Manager entrance: ${context.summon.managerEntrance}

THE GUILD MANAGER:
- Name: ${context.manager.title} ${context.manager.name}
- Demeanor: ${context.summon.demeanor}
- He might say something like: "${quote}"

TRIGGERS THAT CAUSED THIS:
${context.summon.triggers.map((t) => `- ${t}`).join("\n")}

Write this scene in 4-5 paragraphs:
1. The receptionist's composure breaking (she's NEVER flustered)
2. The tavern's reaction (experienced adventurers know this is significant)
3. The wait (tension building)
4. The manager's entrance and first assessment of ${context.orbReading.character.name}
5. His opening line (cryptic, knowing, possibly revealing more than he should)

The Guild Manager should feel like someone who has seen everything - but THIS has surprised even him. Unlike the receptionist's warm omniscience, he radiates "I know things that would break lesser minds" energy.

He should hint that the Guild is more than it appears. That they've been waiting. That this reading means something beyond just "strong adventurer."
`.trim();
}

/**
 * Full registration ceremony including potential manager summon
 */
export const FullRegistrationCeremonySchema = z.object({
  // Phase 1: Orb reading
  orbReading: OrbReadingSchema,

  // Phase 2: Manager summon (if triggered)
  managerSummon: ManagerSummonSchema.optional(),

  // Phase 3: What happens next
  outcome: z.enum([
    "normal_registration", // Just gets their card
    "private_meeting", // Manager wants to talk
    "vip_treatment", // Fast-tracked to high tier
    "surveillance_flagged", // Guild will be watching
    "recruitment_attempt", // They want to hire them
    "containment_protocol", // Uh oh
    "founding_branch_notification", // The REAL guild knows now
    "prophecy_mentioned", // "There was a prophecy..."
  ]),

  // The guild card issued
  guildCard: z
    .object({
      rank: AdventurerRankSchema,
      displayedRank: AdventurerRankSchema, // Sometimes they hide the true rank
      specialDesignation: z.string().optional(), // "WATCH" or "PRIORITY" etc
      restrictions: z.array(z.string()),
      notes: z.string().optional(), // Internal guild notes
    })
    .optional(),
});
export type FullRegistrationCeremony = z.infer<typeof FullRegistrationCeremonySchema>;
