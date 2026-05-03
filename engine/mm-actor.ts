/**
 * MM_ACTOR — Intent-Driven Marble Machine
 * ==========================================
 * 
 * An actor is:
 *   .tp  = WHO THEY ARE       (topological — warps κ around them)
 *   .tpb = WHAT THEY'VE DONE  (append-only life history = memory)
 *   MM   = HOW THEY DECIDE    (drives, goals, resources, initiative)
 *   MF   = WHAT THEY'RE DOING (active scheme loops)
 * 
 * On tick: models futures (count = INT), picks best action, rolls d20.
 * On observe: IOPUS loads the .tpb → the actor REMEMBERS its whole life.
 * 
 * Initiative: WIS for active, INT for reactive.
 * Territory: decisions constrained by .tp subtree.
 */

import { z } from 'zod'
import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  type Drives, DrivesSchema,
  type Goal, GoalSchema,
  type Resources, ResourcesSchema,
  type Advisor, AdvisorSchema,
  type Demerits, DemeritsSchema,
  type Action, ActionSchema, type ActionType,
  type ActionOutcome,
  type Horizon, HorizonSchema, HORIZON_CONFIG,
  optionsFromInt, maxHorizon, abilityMod,
  computeModifiers, resolveAction, scoreOption,
  activeInitiative, reactiveInitiative,
} from './intent'
import { MFPool, type PoolConfig } from './mf-pool'
import type { DiceResult } from './mf-dice'
import { DicePool } from './mf-pool-dice'

// ============================================================
// SCHEME — An active MF loop (in-progress action)
// ============================================================

export const SchemeSchema = z.object({
  id: z.string(),
  action: ActionSchema,
  /** When this scheme started (world day) */
  startedAt: z.number().int(),
  /** When this scheme resolves (world day) */
  resolvesAt: z.number().int(),
  /** 0.0 → 1.0 */
  progress: z.number().min(0).max(1).default(0),
  /** Resources committed (locked until resolve) */
  committedResources: ResourcesSchema.partial().default({}),
  /** Was the roll already made? */
  rolled: z.boolean().default(false),
  /** The outcome if rolled */
  outcome: z.any().optional(),
})
export type Scheme = z.infer<typeof SchemeSchema>

// ============================================================
// TPB ENTRY — Life history record
// ============================================================

export const ActorTPBEntrySchema = z.object({
  worldDay: z.number().int(),
  decision: z.string(),
  actionType: z.string(),
  horizon: HorizonSchema,
  targetId: z.string(),
  d20: z.number().int().min(1).max(20),
  total: z.number(),
  grade: z.string(),
  magnitude: z.number(),
  effects: z.record(z.string(), z.number()).default({}),
  isReactive: z.boolean().default(false),
})
export type ActorTPBEntry = z.infer<typeof ActorTPBEntrySchema>

// ============================================================
// ACTOR DOMAIN STATE
// ============================================================

export interface ActorDomainState {
  drives: Drives
  goals: Goal[]
  resources: Resources
  advisors: Advisor[]
  demerits: Demerits
  /** Ability scores (INT, WIS matter most) */
  abilityScores: { intelligence: number; wisdom: number; charisma: number }
  /** Active schemes (MF loops) */
  schemes: Scheme[]
  /** .tp node IDs that define this actor's territory */
  territoryNodeIds: string[]
  /** Append-only life history (the .tpb) */
  tpb: ActorTPBEntry[]
}

// ============================================================
// ACTION TEMPLATES — What the actor CAN do
// ============================================================

const ACTION_TEMPLATES: { type: ActionType; description: string; horizon: Horizon }[] = [
  // Weekly
  { type: 'economic',   description: 'adjust local trade policy',    horizon: 'weekly' },
  { type: 'military',   description: 'deploy guards to key points',  horizon: 'weekly' },
  { type: 'espionage',  description: 'gather local intelligence',    horizon: 'weekly' },
  { type: 'personal',   description: 'meet with key NPCs',           horizon: 'weekly' },
  // Monthly
  { type: 'economic',   description: 'launch commercial venture',    horizon: 'monthly' },
  { type: 'military',   description: 'recruit and train soldiers',   horizon: 'monthly' },
  { type: 'political',  description: 'forge local alliance',         horizon: 'monthly' },
  { type: 'criminal',   description: 'run covert operation',         horizon: 'monthly' },
  { type: 'diplomatic', description: 'negotiate with rival faction',  horizon: 'monthly' },
  // Quarterly
  { type: 'military',   description: 'fortify territorial holdings',  horizon: 'quarterly' },
  { type: 'economic',   description: 'establish trade route',         horizon: 'quarterly' },
  { type: 'political',  description: 'sponsor political movement',    horizon: 'quarterly' },
  { type: 'religious',  description: 'build temple or shrine',        horizon: 'quarterly' },
  // Semesterly
  { type: 'military',   description: 'launch territorial campaign',   horizon: 'semesterly' },
  { type: 'political',  description: 'restructure governance',        horizon: 'semesterly' },
  // Annually
  { type: 'political',  description: 'claim throne or title',         horizon: 'annually' },
  { type: 'religious',  description: 'declare holy crusade',           horizon: 'annually' },
  // Life
  { type: 'personal',   description: 'fundamental transformation',    horizon: 'life' },
]

// ============================================================
// MM_ACTOR — The concrete implementation
// ============================================================

export class MMActor extends SimulatedMMBase {
  domain: ActorDomainState
  private dicePool: DicePool

  constructor(
    id: string,
    name: string,
    nodeId: string,
    domain: ActorDomainState,
    worldDay: number = 0,
  ) {
    super(id, name, nodeId, 'actor', worldDay)
    this.domain = {
      ...domain,
      schemes: domain.schemes ? [...domain.schemes] : [],
      tpb: domain.tpb ? [...domain.tpb] : [],
      goals: domain.goals ? [...domain.goals] : [],
      advisors: domain.advisors ? [...domain.advisors] : [],
    }

    // Each actor gets its own d20 pool (smaller than session pool)
    this.dicePool = new DicePool(20, id, 100, worldDay)
  }

  // ──────────────────────────────
  // ACCUMULATE — O(1) per actor per tick
  // ──────────────────────────────

  protected onAccumulate(days: number, worldDay: number, _tp?: import('./tp.js').TP): void {
    const intScore = this.domain.abilityScores.intelligence
    const nOptions = optionsFromInt(intScore)
    const maxH = maxHorizon(intScore)

    // 1. Progress existing schemes
    const weeks = days / 7
    for (const scheme of this.domain.schemes) {
      if (scheme.progress < 1.0) {
        const rate = HORIZON_CONFIG[scheme.action.horizon].progressPerWeek
        scheme.progress = Math.min(1.0, scheme.progress + rate * weeks)
      }
    }

    // 2. Check for completed schemes that need rolling
    const completedSchemes = this.domain.schemes.filter(
      s => s.progress >= 1.0 && !s.rolled && s.resolvesAt <= worldDay
    )
    for (const scheme of completedSchemes) {
      this.rollScheme(scheme, worldDay)
    }

    // 3. If no active weekly scheme, decide a new one
    const hasActiveWeekly = this.domain.schemes.some(
      s => s.action.horizon === 'weekly' && s.progress < 1.0
    )
    if (!hasActiveWeekly) {
      const activeGoals = this.domain.goals.filter(g => g.status === 'active')
      if (activeGoals.length > 0) {
        const newAction = this.decideAction(activeGoals, nOptions, maxH, worldDay)
        if (newAction) {
          this.startScheme(newAction, worldDay)
        }
      }
    }
  }

  // ──────────────────────────────
  // DECIDE — Model futures, pick best
  // ──────────────────────────────

  private decideAction(
    goals: Goal[],
    nOptions: number,
    maxH: Horizon,
    worldDay: number,
  ): Action | null {
    // Filter templates by max horizon
    const horizonOrder: Horizon[] = ['weekly', 'monthly', 'quarterly', 'semesterly', 'annually', 'life']
    const maxIndex = horizonOrder.indexOf(maxH)
    const availableTemplates = ACTION_TEMPLATES.filter(t => {
      const idx = horizonOrder.indexOf(t.horizon)
      return idx <= maxIndex
    })

    // Filter by territory (actor can only act in territory or via agents)
    // For now, all actions are valid (territory check comes via target selection)

    if (availableTemplates.length === 0) return null

    // Model N options (limited by INT)
    const options: Action[] = []
    const primaryGoal = goals.sort((a, b) => {
      // Prioritize by drive strength
      return (this.domain.drives[b.drive] ?? 0) - (this.domain.drives[a.drive] ?? 0)
    })[0]

    for (let i = 0; i < Math.min(nOptions, availableTemplates.length); i++) {
      const template = availableTemplates[i % availableTemplates.length]
      options.push({
        id: `${this.state.id}_action_${worldDay}_${i}`,
        type: template.type,
        horizon: template.horizon,
        goalId: primaryGoal.id,
        targetId: primaryGoal.targetNodeId ?? this.state.nodeId,
        description: template.description,
        isReactive: false,
      })
    }

    // Score each option against drives
    const scored = options.map(o => ({
      action: o,
      score: scoreOption(o, this.domain.drives),
    }))

    // Pick highest score
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.action ?? null
  }

  // ──────────────────────────────
  // SCHEMES — MF loops
  // ──────────────────────────────

  private startScheme(action: Action, worldDay: number): void {
    const horizonDays = HORIZON_CONFIG[action.horizon].days
    const resolvesAt = horizonDays === Infinity ? worldDay + 365 : worldDay + horizonDays

    const scheme: Scheme = {
      id: `scheme_${action.id}`,
      action,
      startedAt: worldDay,
      resolvesAt,
      progress: 0,
      committedResources: {},
      rolled: false,
    }

    this.domain.schemes.push(scheme)
  }

  private rollScheme(scheme: Scheme, worldDay: number): void {
    // Pop a d20 from the pool
    const diceResult = this.dicePool.roll()
    const d20 = diceResult.rolls[0]

    // Compute modifiers
    const modifier = computeModifiers(
      scheme.action,
      this.domain.advisors,
      this.domain.resources,
      this.domain.demerits,
      this.domain.abilityScores.intelligence,
      0, // target difficulty — will be set by clockwork
    )

    // Resolve
    const outcome = resolveAction(scheme.action, d20, modifier, worldDay)
    scheme.rolled = true
    scheme.outcome = outcome

    // Record in TPB (life history)
    this.domain.tpb.push({
      worldDay,
      decision: scheme.action.description,
      actionType: scheme.action.type,
      horizon: scheme.action.horizon,
      targetId: scheme.action.targetId,
      d20: outcome.d20,
      total: outcome.total,
      grade: outcome.grade,
      magnitude: outcome.magnitude,
      effects: {},
      isReactive: scheme.action.isReactive,
    })
  }

  // ──────────────────────────────
  // REACT — Response to another actor's effect
  // ──────────────────────────────

  /**
   * React to an external event hitting this actor's interests.
   * Reactive decisions are FREE (no slot cost) but still use resources + d20.
   */
  react(trigger: string, triggerType: ActionType, worldDay: number): ActionOutcome | null {
    // Pop d20 for reactive initiative
    const initDice = this.dicePool.roll()
    const initiative = reactiveInitiative(
      initDice.rolls[0],
      this.domain.abilityScores.intelligence,
      this.domain.advisors,
    )

    // Create reactive action
    const action: Action = {
      id: `${this.state.id}_react_${worldDay}`,
      type: triggerType,
      horizon: 'weekly', // reactions are always immediate
      goalId: 'reactive',
      targetId: trigger,
      description: `react to ${trigger}`,
      isReactive: true,
    }

    // Roll and resolve
    const diceResult = this.dicePool.roll()
    const d20 = diceResult.rolls[0]
    const modifier = computeModifiers(
      action,
      this.domain.advisors,
      this.domain.resources,
      this.domain.demerits,
      this.domain.abilityScores.intelligence,
      0,
    )
    const outcome = resolveAction(action, d20, modifier, worldDay)

    // Record in TPB
    this.domain.tpb.push({
      worldDay,
      decision: action.description,
      actionType: action.type,
      horizon: action.horizon,
      targetId: action.targetId,
      d20: outcome.d20,
      total: outcome.total,
      grade: outcome.grade,
      magnitude: outcome.magnitude,
      effects: {},
      isReactive: true,
    })

    return outcome
  }

  // ──────────────────────────────
  // RESOLVE — Collapse pending into state
  // ──────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, _tp?: import('./tp.js').TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // Collect completed scheme outcomes
    const completedOutcomes = this.domain.schemes
      .filter(s => s.rolled && s.outcome)
      .map(s => s.outcome as ActionOutcome)

    // Remove completed schemes
    this.domain.schemes = this.domain.schemes.filter(
      s => !(s.rolled && s.progress >= 1.0)
    )

    // Build narrative from TPB entries in this period
    const recentEntries = this.domain.tpb.filter(
      e => e.worldDay > worldDay - daysResolved
    )

    const parts = recentEntries.map(e =>
      `Day ${e.worldDay}: ${e.decision} → ${e.grade}` +
      (e.isReactive ? ' (reaction)' : '')
    )

    return {
      stateChanges: {
        schemesCompleted: completedOutcomes.length,
        schemesActive: this.domain.schemes.length,
        tpbEntries: this.domain.tpb.length,
      },
      narrative: parts.length > 0
        ? `${this.state.name} (${daysResolved} days): ${parts.join('. ')}.`
        : `${this.state.name} (${daysResolved} days): Biding time.`,
      additionalEvents: [],
    }
  }

  // ──────────────────────────────
  // INITIATIVE — For clockwork ordering
  // ──────────────────────────────

  /** Roll active initiative (WIS-based) */
  rollActiveInitiative(): number {
    const d20Result = this.dicePool.roll()
    return activeInitiative(
      d20Result.rolls[0],
      this.domain.abilityScores.wisdom,
      this.domain.advisors,
    )
  }

  /** Roll reactive initiative (INT-based) */
  rollReactiveInitiative(): number {
    const d20Result = this.dicePool.roll()
    return reactiveInitiative(
      d20Result.rolls[0],
      this.domain.abilityScores.intelligence,
      this.domain.advisors,
    )
  }

  // ──────────────────────────────
  // ACCESSORS
  // ──────────────────────────────

  /** Get the actor's life history (for IOPUS context) */
  getTPB(): ActorTPBEntry[] { return [...this.domain.tpb] }

  /** Get active schemes */
  getSchemes(): Scheme[] { return [...this.domain.schemes] }

  /** Get completed outcomes waiting for propagation */
  getCompletedOutcomes(): ActionOutcome[] {
    return this.domain.schemes
      .filter(s => s.rolled && s.outcome)
      .map(s => s.outcome as ActionOutcome)
  }

  /** Get the actor's drives */
  getDrives(): Drives { return { ...this.domain.drives } }

  /** Get active goals */
  getGoals(): Goal[] { return this.domain.goals.filter(g => g.status === 'active') }

  /** Get resources */
  getResources(): Resources { return { ...this.domain.resources } }

  /** Tick the dice pool */
  tickDicePool(worldDay: number): void { this.dicePool.tick(worldDay) }

  protected getDomainState(): ActorDomainState {
    return { ...this.domain }
  }
}
