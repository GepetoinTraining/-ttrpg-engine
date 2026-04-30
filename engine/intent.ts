/**
 * INTENT — The Decision Engine
 * ==============================
 * 
 * Pure functions for actor decision-making. No state.
 * 
 * The flow:
 *   1. modelOptions()    → generate N possible actions (N from INT)
 *   2. scoreOption()     → rank each by alignment with drives + personality
 *   3. rollInitiative()  → WIS mod (active) or INT mod (reactive)
 *   4. resolveAction()   → d20 + modifiers → outcome magnitude + seed
 * 
 * The d20 IS the seed. Same roll → same effects, forever.
 */

import { z } from 'zod'

// ============================================================
// DRIVES — What motivates an actor (permanent κ)
// ============================================================

export const DrivesSchema = z.object({
  power:     z.number().int().min(0).max(100).default(50),
  wealth:    z.number().int().min(0).max(100).default(50),
  safety:    z.number().int().min(0).max(100).default(50),
  knowledge: z.number().int().min(0).max(100).default(50),
  faith:     z.number().int().min(0).max(100).default(50),
  revenge:   z.number().int().min(0).max(100).default(0),
  legacy:    z.number().int().min(0).max(100).default(30),
  art:       z.number().int().min(0).max(100).default(20),  // creative expression
  duty:      z.number().int().min(0).max(100).default(30),  // service, loyalty, obligation
})
export type Drives = z.infer<typeof DrivesSchema>

// ============================================================
// GOALS — What they're trying to achieve (mutable x)
// ============================================================

export const GoalStatusSchema = z.enum(['active', 'achieved', 'abandoned', 'failed'])
export type GoalStatus = z.infer<typeof GoalStatusSchema>

export const GoalSchema = z.object({
  id: z.string(),
  description: z.string(),
  /** Which drive this goal serves */
  drive: z.enum(['power', 'wealth', 'safety', 'knowledge', 'faith', 'revenge', 'legacy', 'art', 'duty']),
  /** Target .tp node (if location-specific) */
  targetNodeId: z.string().optional(),
  /** 0.0 → 1.0 */
  progress: z.number().min(0).max(1).default(0),
  status: GoalStatusSchema.default('active'),
  /** When was this goal set? (world day) */
  setAt: z.number().int(),
})
export type Goal = z.infer<typeof GoalSchema>

// ============================================================
// RESOURCES — What they can spend
// ============================================================

export const ResourcesSchema = z.object({
  gold:      z.number().nonnegative().default(0),
  troops:    z.number().int().nonnegative().default(0),
  agents:    z.number().int().nonnegative().default(0),
  influence: z.number().int().nonnegative().default(0),
  arcane:    z.number().int().nonnegative().default(0),
  divine:    z.number().int().nonnegative().default(0),
  intel:     z.number().int().nonnegative().default(0),
  faith:     z.number().int().nonnegative().default(0),   // deity faith pool access
  lore:      z.number().int().nonnegative().default(0),   // books, research capacity
  ships:     z.number().int().nonnegative().default(0),   // naval capacity
})
export type Resources = z.infer<typeof ResourcesSchema>

// ============================================================
// ADVISORS — Domain bonuses (gated by loyalty)
// ============================================================

export const AdvisorDomainSchema = z.enum([
  'military', 'economic', 'political', 'arcane', 'espionage', 'religious',
  'cultural',  // entertainment, arts, patronage
  'naval',     // water, ships, fishing, sea trade
])
export type AdvisorDomain = z.infer<typeof AdvisorDomainSchema>

export const AdvisorSchema = z.object({
  name: z.string(),
  domain: AdvisorDomainSchema,
  /** +1 to +5 bonus in their domain (becomes penalty if disloyal) */
  bonus: z.number().int().min(1).max(5),
  /** 0-100. Below 40 = disloyal (bonus becomes penalty) */
  loyalty: z.number().int().min(0).max(100).default(70),
})
export type Advisor = z.infer<typeof AdvisorSchema>

/** Loyalty threshold: below this, advisor gives bad advice */
const LOYALTY_THRESHOLD = 40

/**
 * Get effective advisor bonus. Disloyal advisors give penalties.
 */
export function advisorBonus(advisor: Advisor): number {
  return advisor.loyalty >= LOYALTY_THRESHOLD ? advisor.bonus : -advisor.bonus
}

// ============================================================
// DEMERITS — Things working against the actor
// ============================================================

export const DemeritsSchema = z.object({
  debts:    z.number().nonnegative().default(0),
  enemies:  z.array(z.string()).default([]),
  scandals: z.number().int().nonnegative().default(0),
  wounds:   z.number().int().nonnegative().default(0),
  curses:   z.number().int().nonnegative().default(0),
})
export type Demerits = z.infer<typeof DemeritsSchema>

// ============================================================
// ACTION TYPES — What an actor can do
// ============================================================

export const ActionTypeSchema = z.enum([
  'economic',       // modify prosperity, trade
  'military',       // modify defense, stability via force
  'political',      // modify faction power, territory
  'criminal',       // modify unrest, crime (covert)
  'religious',      // modify stability via faith
  'diplomatic',     // modify faction relations
  'personal',       // modify NPC loyalty, disposition
  'espionage',      // gather intel, sabotage (covert)
  'entertainment',  // perform, patronize, cultural influence
  'scholarly',      // research, teach, copy books, discover lore
  'naval',          // fish, navigate, sea trade, exploration
  'financial',      // deposit, loan, invest, mint, appraise
])
export type ActionType = z.infer<typeof ActionTypeSchema>

// ============================================================
// DECISION HORIZON — How far ahead this action plans
// ============================================================

export const HorizonSchema = z.enum([
  'weekly', 'monthly', 'quarterly', 'semesterly', 'annually', 'life',
])
export type Horizon = z.infer<typeof HorizonSchema>

export const HORIZON_CONFIG: Record<Horizon, {
  days: number
  costMultiplier: number
  minInt: number
  progressPerWeek: number
}> = {
  weekly:     { days: 7,   costMultiplier: 1,  minInt: 0,  progressPerWeek: 1.0 },
  monthly:    { days: 30,  costMultiplier: 4,  minInt: 8,  progressPerWeek: 0.25 },
  quarterly:  { days: 90,  costMultiplier: 12, minInt: 10, progressPerWeek: 1/13 },
  semesterly: { days: 180, costMultiplier: 30, minInt: 12, progressPerWeek: 1/26 },
  annually:   { days: 365, costMultiplier: 60, minInt: 14, progressPerWeek: 1/52 },
  life:       { days: Infinity, costMultiplier: 100, minInt: 16, progressPerWeek: 0 },
}

// ============================================================
// ACTION — A decision the actor has made
// ============================================================

export const ActionSchema = z.object({
  id: z.string(),
  type: ActionTypeSchema,
  horizon: HorizonSchema,
  /** Which goal this action serves */
  goalId: z.string(),
  /** Target .tp node or MM id */
  targetId: z.string(),
  /** Human-readable description */
  description: z.string(),
  /** Is this active (actor-initiated) or reactive? */
  isReactive: z.boolean().default(false),
})
export type Action = z.infer<typeof ActionSchema>

// ============================================================
// ACTION OUTCOME — Result of the d20 roll
// ============================================================

export const OutcomeGradeSchema = z.enum([
  'backfire', 'failure', 'partial', 'success', 'great', 'critical',
])
export type OutcomeGrade = z.infer<typeof OutcomeGradeSchema>

export const ActionOutcomeSchema = z.object({
  action: ActionSchema,
  /** The raw d20 roll */
  d20: z.number().int().min(1).max(20),
  /** Sum of all modifiers */
  totalModifier: z.number(),
  /** d20 + modifiers */
  total: z.number(),
  /** Result grade */
  grade: OutcomeGradeSchema,
  /** Effect magnitude multiplier (0 for failure, 2.0 for critical) */
  magnitude: z.number(),
  /** The d20 value IS the seed for deterministic effects */
  seed: z.number().int(),
  /** World day this was rolled */
  worldDay: z.number().int(),
})
export type ActionOutcome = z.infer<typeof ActionOutcomeSchema>

// ============================================================
// GRADE THRESHOLDS
// ============================================================

const GRADE_TABLE: { max: number; grade: OutcomeGrade; magnitude: number }[] = [
  { max: 5,  grade: 'backfire', magnitude: -0.5 },
  { max: 10, grade: 'failure',  magnitude: 0 },
  { max: 15, grade: 'partial',  magnitude: 0.25 },
  { max: 20, grade: 'success',  magnitude: 1.0 },
  { max: 25, grade: 'great',    magnitude: 1.5 },
  { max: Infinity, grade: 'critical', magnitude: 2.0 },
]

function gradeFromTotal(total: number): { grade: OutcomeGrade; magnitude: number } {
  for (const row of GRADE_TABLE) {
    if (total <= row.max) return { grade: row.grade, magnitude: row.magnitude }
  }
  return { grade: 'critical', magnitude: 2.0 }
}

// ============================================================
// INTELLIGENCE → OPTIONS COUNT
// ============================================================

/**
 * How many options an actor can model before deciding.
 * Higher INT → more futures modeled → better decisions.
 */
export function optionsFromInt(intScore: number): number {
  if (intScore <= 5) return 1
  if (intScore <= 7) return 2
  if (intScore <= 9) return 3
  if (intScore <= 11) return 4
  if (intScore <= 13) return 5
  if (intScore <= 15) return 6
  if (intScore <= 17) return 7
  if (intScore <= 19) return 8
  return 9
}

/**
 * Max decision horizon an actor can plan at.
 */
export function maxHorizon(intScore: number): Horizon {
  if (intScore >= 16) return 'life'
  if (intScore >= 14) return 'annually'
  if (intScore >= 12) return 'semesterly'
  if (intScore >= 10) return 'quarterly'
  if (intScore >= 8) return 'monthly'
  return 'weekly'
}

// ============================================================
// MODIFIER COMPUTATION
// ============================================================

/** Ability score → modifier (D&D 5e formula) */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * Domain → action type mapping for advisor lookup.
 */
const DOMAIN_FOR_ACTION: Record<ActionType, AdvisorDomain> = {
  economic:      'economic',
  military:      'military',
  political:     'political',
  criminal:      'espionage',
  religious:     'religious',
  diplomatic:    'political',
  personal:      'political',
  espionage:     'espionage',
  entertainment: 'cultural',
  scholarly:     'arcane',     // arcane covers learned knowledge
  naval:         'naval',
  financial:     'economic',   // banking falls under economic domain
}

/**
 * Compute total modifier for an action roll.
 */
export function computeModifiers(
  action: Action,
  advisors: Advisor[],
  resources: Resources,
  demerits: Demerits,
  intScore: number,
  targetDifficulty: number = 0,
): number {
  let mod = 0

  // Advisor bonus for the relevant domain
  const domain = DOMAIN_FOR_ACTION[action.type]
  const advisor = advisors.find(a => a.domain === domain)
  if (advisor) mod += advisorBonus(advisor)

  // Resource bonus (relevant resource / 10, capped at +5)
  const resourceMap: Record<ActionType, keyof Resources> = {
    economic: 'gold', military: 'troops', political: 'influence',
    criminal: 'agents', religious: 'divine', diplomatic: 'influence',
    personal: 'influence', espionage: 'agents',
    entertainment: 'gold', scholarly: 'lore', naval: 'ships',
    financial: 'gold',
  }
  const resourceKey = resourceMap[action.type]
  const resourceValue = resources[resourceKey] as number
  mod += Math.min(5, Math.floor(resourceValue / 10))

  // INT modifier (planning quality)
  mod += abilityMod(intScore)

  // Demerit penalties
  if (action.type === 'economic') mod -= Math.floor(demerits.debts / 100)
  if (action.type === 'political') mod -= demerits.scandals
  if (action.type === 'military') mod -= demerits.wounds
  if (action.type === 'espionage' || action.type === 'criminal') {
    mod -= demerits.enemies.length
  }
  mod -= demerits.curses

  // Target difficulty
  mod -= targetDifficulty

  return mod
}

// ============================================================
// INITIATIVE
// ============================================================

/**
 * Roll active initiative: d20 + WIS mod + best advisor bonus.
 * Wisdom = judgement, timing, knowing when to act.
 */
export function activeInitiative(d20: number, wisScore: number, advisors: Advisor[]): number {
  const bestAdvisor = advisors.reduce((best, a) => {
    const eff = advisorBonus(a)
    return eff > best ? eff : best
  }, 0)
  return d20 + abilityMod(wisScore) + bestAdvisor
}

/**
 * Roll reactive initiative: d20 + INT mod + best advisor bonus.
 * Intelligence = quick thinking, adapting on the fly.
 */
export function reactiveInitiative(d20: number, intScore: number, advisors: Advisor[]): number {
  const bestAdvisor = advisors.reduce((best, a) => {
    const eff = advisorBonus(a)
    return eff > best ? eff : best
  }, 0)
  return d20 + abilityMod(intScore) + bestAdvisor
}

// ============================================================
// RESOLVE ACTION — d20 + mods → outcome
// ============================================================

/**
 * Resolve an action: d20 + modifiers → graded outcome.
 * The d20 value IS the seed for all deterministic downstream effects.
 */
export function resolveAction(
  action: Action,
  d20: number,
  modifier: number,
  worldDay: number,
): ActionOutcome {
  const total = d20 + modifier
  const { grade, magnitude } = gradeFromTotal(total)

  return {
    action,
    d20,
    totalModifier: modifier,
    total,
    grade,
    magnitude,
    seed: d20,
    worldDay,
  }
}

// ============================================================
// OPTION SCORING — Which action aligns best with drives?
// ============================================================

/** Drive weights per action type */
const DRIVE_WEIGHTS: Record<ActionType, Partial<Record<keyof Drives, number>>> = {
  economic:      { wealth: 3, safety: 1 },
  military:      { power: 3, safety: 2 },
  political:     { power: 2, legacy: 2 },
  criminal:      { wealth: 2, revenge: 2 },
  religious:     { faith: 3, legacy: 1 },
  diplomatic:    { safety: 2, legacy: 1 },
  personal:      { safety: 1, revenge: 1 },
  espionage:     { knowledge: 3, power: 1 },
  entertainment: { art: 3, wealth: 1, legacy: 1 },
  scholarly:     { knowledge: 3, legacy: 1 },
  naval:         { wealth: 2, duty: 1, safety: 1 },
  financial:     { wealth: 3, power: 1 },
}

/**
 * Score how well an action aligns with an actor's drives.
 * Higher score = better fit for this actor's personality.
 */
export function scoreOption(action: Action, drives: Drives): number {
  const weights = DRIVE_WEIGHTS[action.type]
  let score = 0
  for (const [drive, weight] of Object.entries(weights)) {
    score += (drives[drive as keyof Drives] ?? 0) * (weight ?? 0)
  }
  return score
}
