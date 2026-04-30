/**
 * NPC AGENDA — AI First-Person Inner Life
 * ==========================================
 * 
 * This is what makes an NPC a PERSON, not cattle.
 * 
 * Every NPC has:
 *   - SKILLS: A block of 18 core D&D skills + optional magic.
 *     These aren't decoration — they give PRODUCTION BONUSES.
 *     A smithing +7 blacksmith makes hub weapon quality better.
 *     A persuasion +5 merchant shifts local commodity prices.
 *   
 *   - NEEDS: Maslow's hierarchy, gamified.
 *     survival → safety → belonging → esteem → purpose
 *     The unmet need drives their behavior and conversation.
 *   
 *   - SECRETS: Things they know but won't reveal easily.
 *     Gated by disposition + persuasion/intimidation checks.
 *   
 *   - OPINIONS: How they feel about current events/factions.
 *     Shaped by their loyalty graph + personal experience.
 *   
 *   - MEMORY: Who talked to them, what happened.
 *     This IS their .tpb — append-only life history.
 * 
 * ECONOMIC IMPACT:
 *   NPCs with high skill modifiers give bonuses to production
 *   in their hub. A hub with many skilled NPCs produces better
 *   goods at lower cost. Losing key NPCs hurts the economy.
 *   Moving skilled NPCs to a new hub is a strategic play.
 */

import { z } from 'zod'

// ============================================================
// SKILL BLOCK — Distilled character capability
// ============================================================

/**
 * The 18 core D&D 5e skills + modifiers.
 * This is the distilled version of mm-character.ts derive().
 * NPCs don't need the full character sheet for daily life.
 */
export const SkillBlockSchema = z.object({
  // Physical
  acrobatics:      z.number().int().default(0),
  athletics:       z.number().int().default(0),
  // Mental
  arcana:          z.number().int().default(0),
  history:         z.number().int().default(0),
  investigation:   z.number().int().default(0),
  nature:          z.number().int().default(0),
  religion:        z.number().int().default(0),
  // Social
  deception:       z.number().int().default(0),
  insight:         z.number().int().default(0),
  intimidation:    z.number().int().default(0),
  performance:     z.number().int().default(0),
  persuasion:      z.number().int().default(0),
  // Practical
  animal_handling: z.number().int().default(0),
  medicine:        z.number().int().default(0),
  perception:      z.number().int().default(0),
  sleight_of_hand: z.number().int().default(0),
  stealth:         z.number().int().default(0),
  survival:        z.number().int().default(0),
})
export type SkillBlock = z.infer<typeof SkillBlockSchema>

// ============================================================
// MAGIC CAPABILITY — Optional spellcasting
// ============================================================

export const MagicCapabilitySchema = z.object({
  /** Can they cast at all? */
  isCaster: z.boolean().default(false),
  /** Spellcasting school focus */
  schoolFocus: z.enum([
    'abjuration', 'conjuration', 'divination', 'enchantment',
    'evocation', 'illusion', 'necromancy', 'transmutation',
  ]).optional(),
  /** Highest spell level they can cast */
  maxSpellLevel: z.number().int().min(0).max(9).default(0),
  /** Spellcasting modifier */
  spellModifier: z.number().int().default(0),
  /** Known lore topics (for knowledge gates) */
  loreTopics: z.array(z.string()).default([]),
})
export type MagicCapability = z.infer<typeof MagicCapabilitySchema>

// ============================================================
// COMBAT RATING — How dangerous they are
// ============================================================

export function calculateCombatRating(
  level: number,
  skills: SkillBlock,
  magic: MagicCapability,
  hasWeapon: boolean,
  hasArmor: boolean,
): number {
  let cr = level * 0.5
  // Combat skill contribution
  cr += Math.max(skills.athletics, skills.acrobatics) * 0.2
  // Magic contribution
  if (magic.isCaster) cr += magic.maxSpellLevel * 0.5
  // Equipment
  if (hasWeapon) cr += 1
  if (hasArmor) cr += 1
  return Math.round(cr * 10) / 10
}

// ============================================================
// NEEDS HIERARCHY — What drives them
// ============================================================

export const NeedTypeSchema = z.enum([
  'survival',    // Food, water, shelter — dying if unmet
  'safety',      // Protection from threats — anxious if unmet
  'belonging',   // Social connection, faction, family — lonely if unmet
  'esteem',      // Respect, recognition, wealth — frustrated if unmet
  'purpose',     // Meaning, legacy, mastery — restless if unmet
])
export type NeedType = z.infer<typeof NeedTypeSchema>

export const NeedSchema = z.object({
  type: NeedTypeSchema,
  /** 0 = desperate, 100 = fully met */
  fulfillment: z.number().min(0).max(100).default(50),
  /** What's driving this need right now */
  driver: z.string().default(''),
})
export type Need = z.infer<typeof NeedSchema>

/** Priority order: lowest fulfillment of lowest-tier need dominates */
export function getMostPressingNeed(needs: Need[]): Need {
  const priority: NeedType[] = ['survival', 'safety', 'belonging', 'esteem', 'purpose']

  for (const tier of priority) {
    const need = needs.find(n => n.type === tier)
    if (need && need.fulfillment < 50) return need
  }

  // All needs above 50? Return lowest overall
  return needs.reduce((lowest, n) =>
    n.fulfillment < lowest.fulfillment ? n : lowest
  )
}

// ============================================================
// SECRETS — Gated knowledge
// ============================================================

export const SecretSchema = z.object({
  id: z.string(),
  /** What they know */
  content: z.string(),
  /** Category for conversation matching */
  topic: z.string(),
  /** Minimum disposition to share freely */
  dispositionGate: z.enum(['hostile', 'unfriendly', 'indifferent', 'friendly', 'loyal']).default('friendly'),
  /** DC to extract via persuasion/intimidation */
  extractionDC: z.number().int().default(15),
  /** Has this been revealed to players? */
  revealed: z.boolean().default(false),
  /** How important is this secret? */
  significance: z.enum(['trivial', 'minor', 'major', 'critical']).default('minor'),
})
export type Secret = z.infer<typeof SecretSchema>

// ============================================================
// MEMORY — Append-only interaction history (.tpb)
// ============================================================

export const MemoryEntrySchema = z.object({
  worldDay: z.number().int(),
  /** Who did this involve? */
  entityId: z.string(),
  entityName: z.string(),
  /** What happened */
  event: z.enum([
    'conversation', 'trade', 'threat', 'gift', 'betrayal',
    'help', 'attack', 'hired', 'fired', 'quest_given',
    'quest_completed', 'faction_event', 'witnessed_crime',
  ]),
  /** Short description */
  description: z.string(),
  /** How did this make them feel? (-10 to +10) */
  sentiment: z.number().int().min(-10).max(10),
  /** Did this change disposition? */
  dispositionDelta: z.number().int().default(0),
})
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>

// ============================================================
// NPC DISPOSITION — How they feel about the player
// ============================================================

export const DispositionSchema = z.enum([
  'hostile',     // Will attack or sabotage
  'unfriendly',  // Won't help, may deceive
  'indifferent', // Transactional only
  'friendly',    // Helpful, shares information
  'loyal',       // Will take risks for you
])
export type Disposition = z.infer<typeof DispositionSchema>

const DISPOSITION_THRESHOLDS: Record<Disposition, number> = {
  hostile:     -60,
  unfriendly:  -20,
  indifferent:   0,
  friendly:     30,
  loyal:        60,
}

export function dispositionFromScore(score: number): Disposition {
  if (score >= 60)  return 'loyal'
  if (score >= 30)  return 'friendly'
  if (score >= -20) return 'indifferent'
  if (score >= -60) return 'unfriendly'
  return 'hostile'
}

// ============================================================
// ECONOMIC CONTRIBUTION — How NPCs affect the hub
// ============================================================

/**
 * NPC occupational skill that gives economic bonuses.
 * This is the bridge between "person" and "economic actor".
 */
export const EconomicRoleSchema = z.object({
  /** What they produce */
  outputCommodity: z.string().optional(),
  /** Production quality bonus (from skill modifier) */
  qualityBonus: z.number().int().default(0),
  /** Production quantity bonus (% increase) */
  quantityBonus: z.number().int().default(0),
  /** Market skill: affects buy/sell prices in their hub */
  priceInfluence: z.number().default(0),
  /** How many units of labor they represent */
  laborUnits: z.number().int().default(1),
  /** Training others: can they mentor? (skill mod >= 5) */
  canMentor: z.boolean().default(false),
})
export type EconomicRole = z.infer<typeof EconomicRoleSchema>

/**
 * Calculate economic role from NPC skills and occupation.
 */
export function deriveEconomicRole(
  occupation: string,
  skills: SkillBlock,
): EconomicRole {
  const role: EconomicRole = {
    qualityBonus: 0,
    quantityBonus: 0,
    priceInfluence: 0,
    laborUnits: 1,
    canMentor: false,
  }

  // Map occupation to commodity + relevant skill
  const occupationMap: Record<string, { commodity: string; skill: keyof SkillBlock }> = {
    blacksmith:  { commodity: 'weapons',  skill: 'athletics' },
    weaponsmith: { commodity: 'weapons',  skill: 'athletics' },
    armorer:     { commodity: 'armor',    skill: 'athletics' },
    farmer:      { commodity: 'grain',    skill: 'nature' },
    fisher:      { commodity: 'fish',     skill: 'survival' },
    miner:       { commodity: 'iron_ore', skill: 'athletics' },
    hunter:      { commodity: 'leather',  skill: 'survival' },
    lumberjack:  { commodity: 'timber',   skill: 'athletics' },
    brewer:      { commodity: 'ale',      skill: 'nature' },
    baker:       { commodity: 'bread',    skill: 'survival' },
    tailor:      { commodity: 'cloth',    skill: 'sleight_of_hand' },
    alchemist:   { commodity: 'potions',  skill: 'arcana' },
    enchanter:   { commodity: 'scrolls',  skill: 'arcana' },
    herbalist:   { commodity: 'herbs',    skill: 'nature' },
    jeweler:     { commodity: 'jewelry',  skill: 'sleight_of_hand' },
    merchant:    { commodity: 'general',  skill: 'persuasion' },
  }

  const mapping = occupationMap[occupation.toLowerCase()]
  if (mapping) {
    role.outputCommodity = mapping.commodity
    const skillMod = skills[mapping.skill]

    // Skill → quality bonus: each point above 0 = +2% quality
    role.qualityBonus = Math.max(0, skillMod * 2)

    // High skill → quantity bonus: expertise means efficiency
    role.quantityBonus = Math.max(0, Math.floor(skillMod * 1.5))

    // Merchants affect prices directly
    if (occupation.toLowerCase() === 'merchant') {
      role.priceInfluence = skillMod * 0.5 // +0.5% per skill point
    }

    // Expert workers produce more
    if (skillMod >= 3) role.laborUnits = 2
    if (skillMod >= 6) role.laborUnits = 3

    // Can mentor others if very skilled
    role.canMentor = skillMod >= 5
  }

  return role
}

// ============================================================
// NPC AGENDA — The complete inner state
// ============================================================

export const NPCAgendaSchema = z.object({
  /** NPC identity */
  entityId: z.string(),
  name: z.string(),
  /** Level (1-20) */
  level: z.number().int().min(1).max(20).default(1),

  /** Current hub node they're in */
  currentNodeId: z.string(),
  /** Current occupation */
  occupation: z.string(),

  /** Skills */
  skills: SkillBlockSchema,
  /** Magic capability */
  magic: MagicCapabilitySchema,
  /** Combat rating (derived) */
  combatRating: z.number().default(0),

  /** Needs hierarchy */
  needs: z.array(NeedSchema),

  /** Current primary goal */
  currentGoal: z.string().default(''),
  /** Why they're doing what they're doing */
  motivation: z.string().default(''),

  /** Secrets they hold */
  secrets: z.array(SecretSchema).default([]),

  /** Opinions on topics/factions (-100 to +100) */
  opinions: z.record(z.string(), z.number().int().min(-100).max(100)).default({}),

  /** Faction loyalties (-100 to +100) */
  loyalties: z.record(z.string(), z.number().int().min(-100).max(100)).default({}),

  /** Interaction memory (.tpb) */
  memory: z.array(MemoryEntrySchema).default([]),

  /** Current disposition toward each known entity */
  dispositions: z.record(z.string(), z.number().int().min(-100).max(100)).default({}),

  /** Economic contribution */
  economicRole: EconomicRoleSchema.optional(),
})
export type NPCAgenda = z.infer<typeof NPCAgendaSchema>

// ============================================================
// CONVERSATION RESOLUTION — The AI bridge
// ============================================================

export type ConversationApproach = 'persuade' | 'intimidate' | 'deceive' | 'befriend' | 'bribe' | 'ask'

export interface ConversationResult {
  /** Did the approach succeed? */
  success: boolean
  /** Disposition change */
  dispositionDelta: number
  /** Secrets revealed (if any) */
  secretsRevealed: Secret[]
  /** NPC's response flavor */
  responseTone: 'warm' | 'neutral' | 'cold' | 'hostile' | 'fearful'
  /** What need this touched */
  needTouched?: NeedType
  /** Memory entry created */
  memoryCreated: MemoryEntry
}

/**
 * Resolve a conversation interaction.
 * d20Seed provides determinism for the skill check.
 */
export function resolveConversation(
  npc: NPCAgenda,
  playerId: string,
  playerName: string,
  approach: ConversationApproach,
  playerSkillMod: number,
  d20Seed: number,
  worldDay: number,
  bribeAmount?: number,
): ConversationResult {
  const currentDisp = npc.dispositions[playerId] ?? 0
  const disposition = dispositionFromScore(currentDisp)

  // Calculate DC based on NPC's relevant defense
  let dc: number
  let npcDefense: number
  switch (approach) {
    case 'persuade':
      dc = 10 + Math.abs(Math.min(0, currentDisp / 10)) // harder if they dislike you
      npcDefense = npc.skills.insight
      break
    case 'intimidate':
      dc = 10 + npc.skills.insight
      npcDefense = npc.skills.intimidation // brave NPCs resist intimidation
      break
    case 'deceive':
      dc = 10 + npc.skills.insight
      npcDefense = npc.skills.deception    // liars spot liars
      break
    case 'befriend':
      dc = 15 - currentDisp / 10           // easier if they already like you
      npcDefense = 0
      break
    case 'bribe':
      dc = 15
      if (bribeAmount && bribeAmount >= 50) dc -= 5
      if (bribeAmount && bribeAmount >= 200) dc -= 5
      npcDefense = 0
      break
    case 'ask':
    default:
      dc = 10
      npcDefense = 0
  }

  // Roll: d20 + player skill mod vs DC + NPC defense
  const roll = d20Seed + playerSkillMod
  const target = dc + npcDefense
  const success = roll >= target

  // Disposition change based on approach
  let dispDelta = 0
  if (approach === 'befriend') dispDelta = success ? 5 : 1
  else if (approach === 'persuade') dispDelta = success ? 2 : -1
  else if (approach === 'intimidate') dispDelta = success ? -3 : -5 // always negative
  else if (approach === 'deceive') dispDelta = success ? 0 : -10 // caught lying = bad
  else if (approach === 'bribe') dispDelta = success ? 3 : -5
  else if (approach === 'ask') dispDelta = 0

  // Update disposition
  npc.dispositions[playerId] = Math.max(-100, Math.min(100, currentDisp + dispDelta))

  // Check for secret reveals
  const secretsRevealed: Secret[] = []
  if (success) {
    for (const secret of npc.secrets) {
      if (secret.revealed) continue
      const dispLevel = dispositionFromScore(npc.dispositions[playerId])
      const gateOrder: Disposition[] = ['hostile', 'unfriendly', 'indifferent', 'friendly', 'loyal']
      const dispIdx = gateOrder.indexOf(dispLevel)
      const gateIdx = gateOrder.indexOf(secret.dispositionGate)

      if (dispIdx >= gateIdx || roll >= secret.extractionDC + npcDefense) {
        secret.revealed = true
        secretsRevealed.push(secret)
      }
    }
  }

  // Determine response tone
  const newDisp = npc.dispositions[playerId]
  let responseTone: ConversationResult['responseTone']
  if (approach === 'intimidate' && success) responseTone = 'fearful'
  else if (newDisp >= 30) responseTone = 'warm'
  else if (newDisp >= -20) responseTone = 'neutral'
  else if (newDisp >= -60) responseTone = 'cold'
  else responseTone = 'hostile'

  // Create memory
  const memoryCreated: MemoryEntry = {
    worldDay,
    entityId: playerId,
    entityName: playerName,
    event: 'conversation',
    description: `${playerName} tried to ${approach}`,
    sentiment: dispDelta,
    dispositionDelta: dispDelta,
  }
  npc.memory.push(memoryCreated)

  return {
    success,
    dispositionDelta: dispDelta,
    secretsRevealed,
    responseTone,
    memoryCreated,
  }
}

// ============================================================
// AGENDA TICK — Daily NPC life
// ============================================================

export interface AgendaTickResult {
  needsChanged: boolean
  goalChanged: boolean
  economicOutput: EconomicRole
}

/**
 * Tick an NPC's agenda forward by one day.
 * Updates needs, pursues goals, generates economic output.
 */
export function tickAgenda(npc: NPCAgenda): AgendaTickResult {
  let needsChanged = false
  let goalChanged = false

  // Needs decay naturally (hunger, etc.)
  for (const need of npc.needs) {
    const decayRate = need.type === 'survival' ? 5 : need.type === 'safety' ? 2 : 1
    const prev = need.fulfillment
    need.fulfillment = Math.max(0, need.fulfillment - decayRate)
    if (need.fulfillment !== prev) needsChanged = true
  }

  // If they're at work → survival need partially met
  const survival = npc.needs.find(n => n.type === 'survival')
  if (survival && npc.occupation) {
    survival.fulfillment = Math.min(100, survival.fulfillment + 8) // work = food money
    survival.driver = `Working as ${npc.occupation}`
  }

  // If they belong to a faction → belonging need partially met
  const belonging = npc.needs.find(n => n.type === 'belonging')
  if (belonging) {
    const hasFaction = Object.keys(npc.loyalties).length > 0
    if (hasFaction) {
      belonging.fulfillment = Math.min(100, belonging.fulfillment + 3)
    }
  }

  // Update current goal from most pressing need
  const pressing = getMostPressingNeed(npc.needs)
  const prevGoal = npc.currentGoal
  switch (pressing.type) {
    case 'survival':
      npc.currentGoal = 'Find food and shelter'
      npc.motivation = 'I need to survive'
      break
    case 'safety':
      npc.currentGoal = 'Stay safe from threats'
      npc.motivation = pressing.driver || 'The roads are dangerous'
      break
    case 'belonging':
      npc.currentGoal = 'Connect with my community'
      npc.motivation = 'I feel isolated'
      break
    case 'esteem':
      npc.currentGoal = 'Earn respect and recognition'
      npc.motivation = 'I want to be valued'
      break
    case 'purpose':
      npc.currentGoal = 'Find deeper meaning in my work'
      npc.motivation = 'There must be more to life'
      break
  }
  if (npc.currentGoal !== prevGoal) goalChanged = true

  // Calculate economic output
  const economicOutput = npc.economicRole ?? deriveEconomicRole(npc.occupation, npc.skills)
  npc.economicRole = economicOutput

  return { needsChanged, goalChanged, economicOutput }
}

// ============================================================
// NPC FACTORY
// ============================================================

let _agendaId = 0
export function resetAgendaIdCounter(): void { _agendaId = 0 }

export function createNPCAgenda(
  name: string,
  occupation: string,
  currentNodeId: string,
  level: number = 1,
  skills?: Partial<SkillBlock>,
  magic?: Partial<MagicCapability>,
): NPCAgenda {
  const fullSkills: SkillBlock = {
    acrobatics: 0, athletics: 0, arcana: 0, history: 0,
    investigation: 0, nature: 0, religion: 0, deception: 0,
    insight: 0, intimidation: 0, performance: 0, persuasion: 0,
    animal_handling: 0, medicine: 0, perception: 0,
    sleight_of_hand: 0, stealth: 0, survival: 0,
    ...skills,
  }

  const fullMagic: MagicCapability = {
    isCaster: false, maxSpellLevel: 0, spellModifier: 0, loreTopics: [],
    ...magic,
  }

  const agenda: NPCAgenda = {
    entityId: `npc_${++_agendaId}`,
    name,
    level,
    currentNodeId,
    occupation,
    skills: fullSkills,
    magic: fullMagic,
    combatRating: calculateCombatRating(level, fullSkills, fullMagic, false, false),
    needs: [
      { type: 'survival',  fulfillment: 70, driver: '' },
      { type: 'safety',    fulfillment: 60, driver: '' },
      { type: 'belonging', fulfillment: 50, driver: '' },
      { type: 'esteem',    fulfillment: 40, driver: '' },
      { type: 'purpose',   fulfillment: 30, driver: '' },
    ],
    currentGoal: '',
    motivation: '',
    secrets: [],
    opinions: {},
    loyalties: {},
    memory: [],
    dispositions: {},
  }

  // Derive economic role from occupation + skills
  agenda.economicRole = deriveEconomicRole(occupation, fullSkills)

  return agenda
}
