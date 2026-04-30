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

// =============================================================================
// THE ETERNAL RECEPTIONIST
// =============================================================================

/**
 * She has many names. They are all the same name.
 */
export const RECEPTIONIST_NAMES = [
  // The K-variants
  'Katarina', 'Katharina', 'Catarina', 'Katherine',
  'Katerina', 'Ekaterina', 'Caterina', 'Katalina',
  // The E-variants
  'Elena', 'Helena', 'Elenna', 'Ellena', 'Helenna',
  // The A-variants
  'Aria', 'Arya', 'Arianna', 'Ariana',
  // The S-variants
  'Sophia', 'Sofia', 'Sofiya', 'Sophie',
  // The L-variants
  'Lyra', 'Lira', 'Lyria', 'Liria',
] as const

export type ReceptionistName = (typeof RECEPTIONIST_NAMES)[number]

/**
 * Get a receptionist name for a guild branch.
 * The name is deterministic based on branch ID — she's always the same
 * at the same branch, but "different" at different branches.
 */
export function getReceptionistName(branchId: string): ReceptionistName {
  let hash = 0
  for (let i = 0; i < branchId.length; i++) {
    const char = branchId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const index = Math.abs(hash) % RECEPTIONIST_NAMES.length
  return RECEPTIONIST_NAMES[index]
}

/**
 * The receptionist's unsettling traits
 */
export type ReceptionistTrait =
  | 'knows_your_name'       // Before you introduce yourself
  | 'knows_your_hometown'   // "How's the weather in [place you never mentioned]?"
  | 'knows_your_class'      // "A [class] like yourself..."
  | 'knows_your_party'      // "Are your friends parking the cart?"
  | 'knows_your_quest'      // "Back from the goblin cave already?"
  | 'knows_your_death'      // "You look well for someone who died last Tuesday"
  | 'knows_your_future'     // "You'll want the fire resistance potions. Trust me."
  | 'knows_your_secrets'    // *knowing smile*
  | 'remembers_other_branches'   // "Your tab from Waterdeep transferred~"
  | 'remembers_other_timelines'  // "You made a different choice last time..."
  | 'remembers_other_campaigns'  // "Your previous character said hi"

/**
 * Things she says that she shouldn't be able to say
 */
export const UNSETTLING_GREETINGS: Record<ReceptionistTrait, string[]> = {
  knows_your_name: [
    'Welcome, {name}! First time at this branch~',
    'Ah, {name}-san! We\'ve been expecting you.',
    '{name}, right? Your reputation precedes you~',
  ],
  knows_your_hometown: [
    'How\'s the weather back in {hometown}?',
    'You\'re far from {hometown}. Long journey?',
    'We don\'t get many from {hometown} here~',
  ],
  knows_your_class: [
    'A {class} like yourself must be tired from the road.',
    'We have special rates for {class}s this month~',
    'The {class} guild discount applies, of course.',
  ],
  knows_your_party: [
    'Are your friends parking the cart outside?',
    'Will {party_member} be joining you today?',
    'Your usual party composition, I see~',
  ],
  knows_your_quest: [
    'Back from {quest_location} already? That was fast~',
    'How did {quest_target} taste? I mean... go?',
    'The {quest_item}? Yes, we heard you found it.',
  ],
  knows_your_death: [
    'You look well! Much better than last Tuesday.',
    'Death becomes you~ ...I mean, welcome back!',
    'The resurrection took well, I see.',
  ],
  knows_your_future: [
    'You\'ll want the fire resistance potions. Trust me~',
    'I\'d avoid the east road today if I were you.',
    'Your next quest will be... interesting.',
  ],
  knows_your_secrets: [
    '*knowing smile* Your secret is safe with the Guild~',
    'About that thing you did... we don\'t judge here.',
    'The Guild sees all, adventurer-san. But we\'re discreet~',
  ],
  remembers_other_branches: [
    'Your tab from {other_city} transferred automatically~',
    'I see you preferred the Neverwinter branch\'s coffee.',
    'The Baldur\'s Gate receptionist sends her regards.',
  ],
  remembers_other_timelines: [
    'You made a different choice last time... interesting~',
    'In another timeline, you\'d be asking about goblins.',
    'This path suits you better, I think.',
  ],
  remembers_other_campaigns: [
    'Your previous... associate... said hello.',
    'You remind me of someone. Same eyes.',
    'The Guild remembers all who serve. ALL.',
  ],
}

// =============================================================================
// THE ORB OF REVELATION
// =============================================================================

/**
 * Adventurer Rank — the isekai power scale.
 * Everyone starts as "F" (hidden). The orb reveals the truth.
 */
export type AdventurerRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'EX'

export const ADVENTURER_RANK_ORDER: AdventurerRank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX']

/**
 * The orb's reaction to measuring someone
 */
export type OrbReaction =
  | 'dim_glow'           // F-E rank, barely registers
  | 'steady_glow'        // D-C rank, normal adventurer
  | 'bright_glow'        // B-A rank, impressive
  | 'blinding_flash'     // S rank, everyone looks
  | 'sustained_radiance' // SS rank, receptionist drops clipboard
  | 'reality_crack'      // SSS rank, orb struggles
  | 'orb_shatters'       // EX rank, this shouldn't happen
  | 'orb_speaks'         // ??? the orb has never spoken before

/**
 * What the orb reveals (or fails to reveal)
 */
export type OrbAnomaly =
  | 'fluctuating'         // Rank keeps changing
  | 'suppressed'          // Something is hiding their power
  | 'dual_reading'        // Two souls? Two classes?
  | 'divine_interference' // A god is watching
  | 'demonic_taint'       // Warlock detected
  | 'isekai_signature'    // Not from this world
  | 'protagonist_aura'    // Plot armor detected
  | 'harem_magnetism'     // ...the orb measures this?

export type ReceptionistReaction =
  | 'professional_smile'    // Normal, expected
  | 'eyebrow_raise'         // Interesting...
  | 'clipboard_drop'        // Oh my
  | 'calls_manager'         // This is above my pay grade
  | 'faints'                // SS+ rank reaction
  | 'ara_ara_intensifies'   // She KNEW
  | 'breaks_character'      // "What the f-" *cough* "How lovely~"
  | 'silent_knowing_nod'    // She expected this

export interface OrbReading {
  characterId: string
  guildBranchId: string
  receptionistName: string
  previousRank: 'F'              // Always starts hidden
  revealedRank: AdventurerRank
  orbReaction: OrbReaction
  anomalies: OrbAnomaly[]
  receptionistReaction: ReceptionistReaction
  revealedDay: number
}

// =============================================================================
// RANK CALCULATION
// =============================================================================

/**
 * Map character level to adventurer rank.
 * (The orb doesn't lie, but it does love drama)
 */
export function calculateTrueRank(
  characterLevel: number,
  hasProtagonistVibes: boolean = false,
): AdventurerRank {
  let rank: AdventurerRank

  if (characterLevel <= 1)       rank = 'F'
  else if (characterLevel <= 3)  rank = 'E'
  else if (characterLevel <= 5)  rank = 'D'
  else if (characterLevel <= 8)  rank = 'C'
  else if (characterLevel <= 11) rank = 'B'
  else if (characterLevel <= 14) rank = 'A'
  else if (characterLevel <= 17) rank = 'S'
  else if (characterLevel <= 19) rank = 'SS'
  else                           rank = 'SSS'

  // Protagonist buff (isekai logic)
  if (hasProtagonistVibes && rank !== 'SSS') {
    const idx = ADVENTURER_RANK_ORDER.indexOf(rank)
    rank = ADVENTURER_RANK_ORDER[Math.min(idx + 1, ADVENTURER_RANK_ORDER.length - 1)]
  }

  return rank
}

/**
 * Determine orb reaction based on rank
 */
export function getOrbReaction(rank: AdventurerRank): OrbReaction {
  switch (rank) {
    case 'F':
    case 'E':   return 'dim_glow'
    case 'D':
    case 'C':   return 'steady_glow'
    case 'B':
    case 'A':   return 'bright_glow'
    case 'S':   return 'blinding_flash'
    case 'SS':  return 'sustained_radiance'
    case 'SSS': return 'reality_crack'
    case 'EX':  return 'orb_shatters'
  }
}

/**
 * Determine receptionist reaction based on rank and anomalies
 */
export function getReceptionistReaction(
  rank: AdventurerRank,
  anomalies: OrbAnomaly[],
): ReceptionistReaction {
  // Anomalies override rank-based reactions
  if (anomalies.includes('isekai_signature'))  return 'ara_ara_intensifies'
  if (anomalies.includes('protagonist_aura'))  return 'silent_knowing_nod'
  if (anomalies.includes('harem_magnetism'))   return 'breaks_character'

  switch (rank) {
    case 'F':
    case 'E':
    case 'D':   return 'professional_smile'
    case 'C':
    case 'B':   return 'eyebrow_raise'
    case 'A':
    case 'S':   return 'clipboard_drop'
    case 'SS':  return 'faints'
    case 'SSS':
    case 'EX':  return 'calls_manager'
  }
}

// =============================================================================
// THE GUILD BRANCH
// =============================================================================

export interface GuildBranch {
  id: string
  settlementId: string
  name: string

  receptionist: {
    name: ReceptionistName
    traits: ReceptionistTrait[]
    knowsAboutPlayer: Record<string, string[]> // characterId → things she "shouldn't" know
  }

  orb: {
    intact: boolean
    shatteredBy?: string
    shatteredDay?: number
    replacementOrdered: boolean
    timesShattered: number
  }

  facilities: {
    questBoard: boolean
    tavern: boolean
    training: boolean
    storage: boolean
    baths: boolean        // Important for isekai
    dormitory: boolean
  }

  registeredAdventurers: number
  highestRankPresent: AdventurerRank
}

// =============================================================================
// THE REGISTRATION CEREMONY
// =============================================================================

export interface OrbReadingContext {
  character: {
    id: string
    name: string
    race: string
    class: string
    level: number
    background?: string
    homeland?: string
    secrets?: string[]
  }

  guild: {
    branchId: string
    branchName: string
    receptionistName: string
    settlementName: string
  }

  // Pre-calculated
  trueRank: AdventurerRank
  orbReaction: OrbReaction
  anomalies: OrbAnomaly[]
  receptionistReaction: ReceptionistReaction

  // What the receptionist "impossibly" knows
  impossibleKnowledge: string[]

  // Tone guidance
  tone: 'comedic' | 'dramatic' | 'mysterious' | 'wholesome'
}

/**
 * Build the structured prompt for the orb reading scene
 */
export function buildOrbReadingPrompt(context: OrbReadingContext): string {
  return `You are narrating the iconic "adventurer's guild registration" scene from isekai/fantasy stories.

SETTING:
- Guild Branch: ${context.guild.branchName} in ${context.guild.settlementName}
- Receptionist: ${context.guild.receptionistName} (beautiful, professional, unsettlingly omniscient)
- Adventurer: ${context.character.name}, a level ${context.character.level} ${context.character.race} ${context.character.class}

THE SCENE:
${context.guild.receptionistName} greets ${context.character.name} at the registration desk. She somehow already knows things she shouldn't (pick 1-2): ${context.impossibleKnowledge.join(', ')}

She brings out the Orb of Revelation - a crystal sphere that measures an adventurer's true potential.

THE REVEAL:
- Current displayed rank: F (hidden/unawakened)
- TRUE rank revealed: ${context.trueRank}
- Orb reaction: ${context.orbReaction}
- Receptionist reaction: ${context.receptionistReaction}
${context.anomalies.length > 0 ? `- Anomalies detected: ${context.anomalies.join(', ')}` : ''}

TONE: ${context.tone}

Write this scene in 3-4 paragraphs:
1. The greeting (she knows something she shouldn't)
2. The orb ceremony begins
3. The dramatic reveal (describe the orb's reaction)
4. The aftermath (receptionist's reaction, nearby adventurers' reactions if rank is high)

Keep ${context.guild.receptionistName}'s dialogue slightly formal but warm, with occasional "ara ara" energy for high-rank reveals. She should seem unsurprised by surprising results, as if she knew all along.`
}

/**
 * Generate impossible knowledge based on character
 */
export function generateImpossibleKnowledge(
  character: OrbReadingContext['character'],
): string[] {
  const knowledge: string[] = []

  knowledge.push(`knows ${character.name}'s name before introduction`)

  if (character.homeland) {
    knowledge.push(`mentions the weather in ${character.homeland}`)
  }

  if (character.class) {
    knowledge.push(`references ${character.class}-specific details`)
  }

  if (character.secrets && character.secrets.length > 0) {
    knowledge.push(`hints at knowing "${character.secrets[0]}"`)
  }

  // Always add one meta-knowledge
  knowledge.push("makes a comment suggesting she's met them before (she hasn't)")

  return knowledge
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
  'Vorn', 'Vorik', 'Varn', 'Varek',
  // The A-variants (dignified)
  'Aldric', 'Aldren', 'Alduin', 'Alaric',
  // The G-variants (weathered)
  'Gideon', 'Gareth', 'Godric', 'Gregor',
  // The R-variants (mysterious)
  'Roland', 'Roderick', 'Ragnar', 'Reinhardt',
  // The M-variants (ancient)
  'Magnus', 'Mordecai', 'Marcus', 'Matthias',
] as const

export type GuildManagerName = (typeof GUILD_MANAGER_NAMES)[number]

/**
 * Get the guild manager name for a branch.
 * Different hash from receptionist to ensure different names.
 */
export function getGuildManagerName(branchId: string): GuildManagerName {
  let hash = 0
  for (let i = 0; i < branchId.length; i++) {
    const char = branchId.charCodeAt(i)
    hash = (hash << 7) - hash + char
    hash = hash & hash
  }
  const index = Math.abs(hash) % GUILD_MANAGER_NAMES.length
  return GUILD_MANAGER_NAMES[index]
}

// =============================================================================
// MANAGER SUMMON SYSTEM
// =============================================================================

export type ManagerSummonTrigger =
  | 'rank_s_or_higher'     // S, SS, SSS, EX
  | 'orb_shatters'         // This is expensive
  | 'orb_speaks'           // This has never happened
  | 'ex_rank'              // Beyond measurement
  | 'multiple_anomalies'   // 2+ anomalies
  | 'divine_interference'  // A god is watching
  | 'demonic_taint'        // Warlock business
  | 'reality_crack'        // The orb is struggling
  | 'isekai_confirmed'     // Otherworlder detected

export type GuildManagerDemeanor =
  | 'weary_acceptance'             // "Another one, huh."
  | 'professional_concern'         // "This is... significant."
  | 'barely_contained_excitement'  // Tries to hide it, fails
  | 'grim_recognition'            // "I've seen this reading before. Once."
  | 'calls_headquarters'          // This is above HIS pay grade
  | 'offers_private_meeting'      // "Perhaps we should discuss this... elsewhere."
  | 'breaks_protocol'             // Does something unprecedented
  | 'reveals_too_much'            // Lets something slip about the Guild's true nature

/**
 * Things the Guild Manager might say (that raise more questions)
 */
export const MANAGER_QUOTES: Record<GuildManagerDemeanor, string[]> = {
  weary_acceptance: [
    'Another one. The third this century.',
    '*sighs* Clear my schedule.',
    'I was wondering when you\'d show up.',
  ],
  professional_concern: [
    'This reading will need to be... verified. By me. Personally.',
    'I\'m going to need you to not leave this building for a moment.',
    'How long have you been... like this?',
  ],
  barely_contained_excitement: [
    'This is... *clears throat* ...this is quite standard. Yes. Normal.',
    'I\'m not excited. Guild Managers don\'t get excited. I\'m... professionally intrigued.',
    '*hands shaking slightly* Would you care for some tea?',
  ],
  grim_recognition: [
    'I\'ve seen this reading once before. The last one... didn\'t end well.',
    'The orb remembers you. It shouldn\'t. It can\'t. But it does.',
    'You\'re not the first. Let\'s hope you last longer than the others.',
  ],
  calls_headquarters: [
    'Excuse me. I need to send a message. To the Founding Branch.',
    '*pulls out a crystal that definitely shouldn\'t exist* ...Priority Omega.',
    'The Council will want to know about this. Immediately.',
  ],
  offers_private_meeting: [
    'Perhaps we should continue this conversation in my office.',
    'There are things I need to tell you. Things not for... public ears.',
    'Walk with me. And try not to attract attention.',
  ],
  breaks_protocol: [
    '*removes his own guild badge and places it on the counter* ...Take it.',
    'I\'m authorizing S-rank access. Yes, I know the reading said higher. Trust me.',
    '*opens a door that wasn\'t there before* After you.',
  ],
  reveals_too_much: [
    'The Guild wasn\'t always about adventurers. We were founded to find people like you.',
    'There\'s a reason we use orbs. A reason we track power levels. A reason we REMEMBER.',
    'She knows, by the way. She always knows. She\'s not... entirely human. Neither am I.',
  ],
}

/**
 * Check if manager summon is triggered
 */
export function shouldSummonManager(
  rank: AdventurerRank,
  orbReaction: OrbReaction,
  anomalies: OrbAnomaly[],
): { triggered: boolean; triggers: ManagerSummonTrigger[] } {
  const triggers: ManagerSummonTrigger[] = []

  // Rank triggers
  if (['S', 'SS', 'SSS', 'EX'].includes(rank)) {
    triggers.push('rank_s_or_higher')
  }
  if (rank === 'EX') {
    triggers.push('ex_rank')
  }

  // Orb reaction triggers
  if (orbReaction === 'orb_shatters')  triggers.push('orb_shatters')
  if (orbReaction === 'orb_speaks')    triggers.push('orb_speaks')
  if (orbReaction === 'reality_crack') triggers.push('reality_crack')

  // Anomaly triggers
  if (anomalies.length >= 2)                       triggers.push('multiple_anomalies')
  if (anomalies.includes('divine_interference'))   triggers.push('divine_interference')
  if (anomalies.includes('demonic_taint'))         triggers.push('demonic_taint')
  if (anomalies.includes('isekai_signature'))      triggers.push('isekai_confirmed')

  return { triggered: triggers.length > 0, triggers }
}

/**
 * Determine manager's demeanor based on triggers
 */
export function getManagerDemeanor(triggers: ManagerSummonTrigger[]): GuildManagerDemeanor {
  // Escalating severity
  if (triggers.includes('orb_speaks'))         return 'reveals_too_much'
  if (triggers.includes('ex_rank'))            return 'calls_headquarters'
  if (triggers.includes('orb_shatters'))       return 'grim_recognition'
  if (triggers.includes('isekai_confirmed'))   return 'barely_contained_excitement'
  if (triggers.includes('divine_interference') || triggers.includes('demonic_taint'))
    return 'offers_private_meeting'
  if (triggers.includes('multiple_anomalies')) return 'professional_concern'

  return 'weary_acceptance'
}

// =============================================================================
// MANAGER SUMMON SCENE
// =============================================================================

export type ReceptionistBreak =
  | 'composure_cracks'   // Slight pause, too-wide eyes
  | 'clipboard_falls'    // The classic
  | 'voice_wavers'       // "I... I need to..."
  | 'freezes'            // Stops moving entirely
  | 'nervous_laugh'      // "Ha ha... ha..."
  | 'drops_honorifics'   // Stops saying "-san" (VERY bad sign)

export type SummonPhrase =
  | 'I need to call the Guild Manager.'
  | 'Please wait here. I must... fetch someone.'
  | 'Excuse me for just one moment.'
  | 'The Guildmaster will want to see this.'
  | '...Don\'t move.'
  | 'Apologies. This is above my... clearance.'

export type TavernReaction =
  | 'silence'          // Everyone stops talking
  | 'ale_drop'         // Someone drops their drink
  | 'chairs_scraping'  // People backing away
  | 'whispers'         // Hushed speculation
  | 'evacuation'       // Experienced adventurers leave
  | 'betting_starts'   // Less experienced adventurers place bets

export type ManagerEntrance =
  | 'walks_in'         // Normal
  | 'already_there'    // Was in the room the whole time
  | 'descends_stairs'  // From the "empty" upper floor
  | 'steps_from_shadow'// Wasn't there, then was
  | 'teleports'        // Doesn't bother hiding it
  | 'door_appears'     // A door that wasn't there opens

export interface ManagerSummon {
  triggered: boolean
  triggers: ManagerSummonTrigger[]
  receptionistBreak: ReceptionistBreak
  summonPhrase: SummonPhrase
  tavernReaction: TavernReaction
  waitDescription: 'moments' | 'minutes' | 'uncomfortable_silence' | 'instant' | 'he_was_watching'
  managerEntrance: ManagerEntrance
  demeanor: GuildManagerDemeanor
}

/**
 * Build the AI prompt for the manager summon scene
 */
export function buildManagerSummonPrompt(
  orbContext: OrbReadingContext,
  summon: ManagerSummon,
  managerName: string,
  managerTitle: 'Guildmaster' | 'Director' | 'Branch Master' | 'Overseer',
): string {
  const quotes = MANAGER_QUOTES[summon.demeanor]
  const quote = quotes[Math.floor(Math.random() * quotes.length)]

  return `You are continuing the adventurer's guild registration scene. The orb reading has triggered something unprecedented, and the receptionist has called for the Guild Manager.

PREVIOUS SCENE:
- ${orbContext.guild.receptionistName} just performed the orb reading for ${orbContext.character.name}
- Revealed rank: ${orbContext.trueRank}
- Orb reaction: ${orbContext.orbReaction}
- Anomalies: ${orbContext.anomalies.length > 0 ? orbContext.anomalies.join(', ') : 'none'}

THE TRANSITION:
- Receptionist's composure: ${summon.receptionistBreak}
- She says: "${summon.summonPhrase}"
- Tavern reaction: ${summon.tavernReaction}
- Wait: ${summon.waitDescription}
- Manager entrance: ${summon.managerEntrance}

THE GUILD MANAGER:
- Name: ${managerTitle} ${managerName}
- Demeanor: ${summon.demeanor}
- He might say something like: "${quote}"

TRIGGERS THAT CAUSED THIS:
${summon.triggers.map(t => `- ${t}`).join('\n')}

Write this scene in 4-5 paragraphs:
1. The receptionist's composure breaking (she's NEVER flustered)
2. The tavern's reaction (experienced adventurers know this is significant)
3. The wait (tension building)
4. The manager's entrance and first assessment of ${orbContext.character.name}
5. His opening line (cryptic, knowing, possibly revealing more than he should)

The Guild Manager should feel like someone who has seen everything - but THIS has surprised even him. Unlike the receptionist's warm omniscience, he radiates "I know things that would break lesser minds" energy.

He should hint that the Guild is more than it appears. That they've been waiting. That this reading means something beyond just "strong adventurer."`
}

// =============================================================================
// FULL REGISTRATION CEREMONY
// =============================================================================

export type RegistrationOutcome =
  | 'normal_registration'       // Just gets their card
  | 'private_meeting'           // Manager wants to talk
  | 'vip_treatment'             // Fast-tracked to high tier
  | 'surveillance_flagged'      // Guild will be watching
  | 'recruitment_attempt'       // They want to hire them
  | 'containment_protocol'      // Uh oh
  | 'founding_branch_notification' // The REAL guild knows now
  | 'prophecy_mentioned'        // "There was a prophecy..."

export interface GuildCard {
  rank: AdventurerRank
  displayedRank: AdventurerRank  // Sometimes they hide the true rank
  specialDesignation?: string    // "WATCH" or "PRIORITY" etc
  restrictions: string[]
  notes?: string                 // Internal guild notes
}

export interface FullRegistrationCeremony {
  orbReading: OrbReading
  managerSummon?: ManagerSummon
  outcome: RegistrationOutcome
  guildCard?: GuildCard
}

// =============================================================================
// CEREMONY ORCHESTRATION — Run the full scene
// =============================================================================

/**
 * Perform a full guild registration ceremony.
 * Pre-calculates everything the AI prompts need.
 */
export function performRegistration(
  characterId: string,
  characterName: string,
  characterLevel: number,
  branchId: string,
  worldDay: number,
  anomalies: OrbAnomaly[] = [],
  hasProtagonistVibes: boolean = false,
): FullRegistrationCeremony {
  const receptionistName = getReceptionistName(branchId)
  const trueRank = calculateTrueRank(characterLevel, hasProtagonistVibes)
  const orbReaction = getOrbReaction(trueRank)
  const receptionistReaction = getReceptionistReaction(trueRank, anomalies)

  const orbReading: OrbReading = {
    characterId,
    guildBranchId: branchId,
    receptionistName,
    previousRank: 'F',
    revealedRank: trueRank,
    orbReaction,
    anomalies,
    receptionistReaction,
    revealedDay: worldDay,
  }

  // Check for manager summon
  const summonCheck = shouldSummonManager(trueRank, orbReaction, anomalies)
  let managerSummon: ManagerSummon | undefined
  let outcome: RegistrationOutcome = 'normal_registration'

  if (summonCheck.triggered) {
    const demeanor = getManagerDemeanor(summonCheck.triggers)

    managerSummon = {
      triggered: true,
      triggers: summonCheck.triggers,
      receptionistBreak: 'clipboard_falls',
      summonPhrase: 'I need to call the Guild Manager.',
      tavernReaction: 'silence',
      waitDescription: 'uncomfortable_silence',
      managerEntrance: 'descends_stairs',
      demeanor,
    }

    // Determine outcome based on severity
    if (summonCheck.triggers.includes('ex_rank') || summonCheck.triggers.includes('orb_speaks')) {
      outcome = 'founding_branch_notification'
    } else if (summonCheck.triggers.includes('isekai_confirmed')) {
      outcome = 'recruitment_attempt'
    } else if (summonCheck.triggers.includes('divine_interference') || summonCheck.triggers.includes('demonic_taint')) {
      outcome = 'surveillance_flagged'
    } else if (trueRank === 'SSS') {
      outcome = 'vip_treatment'
    } else {
      outcome = 'private_meeting'
    }
  }

  // Issue guild card
  const guildCard: GuildCard = {
    rank: trueRank,
    displayedRank: trueRank === 'EX' ? 'SSS' : trueRank, // EX is hidden as SSS
    restrictions: [],
  }

  if (outcome === 'surveillance_flagged') {
    guildCard.specialDesignation = 'WATCH'
    guildCard.notes = 'Anomalous reading — monitor discreetly'
  }
  if (outcome === 'founding_branch_notification') {
    guildCard.specialDesignation = 'PRIORITY OMEGA'
    guildCard.notes = 'Founding Branch notified. Do not lose track of this individual.'
  }

  return {
    orbReading,
    managerSummon,
    outcome,
    guildCard,
  }
}
