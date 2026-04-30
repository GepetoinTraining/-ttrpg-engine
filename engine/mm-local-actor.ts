/**
 * MM_LOCAL_ACTOR — Intra-Hub Decision Maker
 * ============================================
 * 
 * The tavern owner. The merchant. The guard captain.
 * The priest who feeds the poor. The thief who picks pockets.
 * 
 * These are actors who operate WITHIN a single hub/settlement.
 * Their decisions don't span territory — they affect the
 * settlement they're in, directly and immediately.
 * 
 * vs MMActor (territory actor):
 *   MMActor:       Duke → operates across Cormyr (multi-node)
 *   MMLocalActor:  Tavern owner → operates inside Suzail (single node)
 * 
 * Simplified from MMActor:
 *   - No territory (single nodeId)
 *   - Fewer resources (gold, staff, goods, reputation)
 *   - Max horizon: monthly (INT 14+: quarterly)
 *   - Decisions always affect parent settlement
 *   - Smaller dice pool (50 d20s)
 *   - Still has TPB → still remembers when observed via IOPUS
 * 
 * Four layers:
 *   .tp  = the shop, the tavern, the temple (a sub-node of the settlement)
 *   .tpb = what they've done (append-only life history)
 *   MM   = how they decide (drives, goals, local resources)
 *   MF   = what they're doing (daily/weekly routines)
 */

import { z } from 'zod'
import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  type Drives, DrivesSchema,
  type Goal, GoalSchema,
  type Action, type ActionType,
  type ActionOutcome,
  type Horizon, HORIZON_CONFIG,
  optionsFromInt, abilityMod,
  resolveAction, scoreOption,
} from './intent.js'
import { DicePool } from './mf-pool-dice.js'

// ============================================================
// LOCAL RESOURCES — Smaller scale than territory actors
// ============================================================

export const LocalResourcesSchema = z.object({
  gold:       z.number().nonnegative().default(0),
  staff:      z.number().int().nonnegative().default(0),  // employees, helpers
  goods:      z.number().int().nonnegative().default(0),  // inventory, supplies
  reputation: z.number().int().min(-100).max(100).default(0), // local standing
  contacts:   z.number().int().nonnegative().default(0),  // who they know
})
export type LocalResources = z.infer<typeof LocalResourcesSchema>

// ============================================================
// LOCAL OCCUPATION — What they do in the hub
// ============================================================

export const OccupationSchema = z.enum([
  'merchant',     // buys and sells
  'innkeeper',    // runs a tavern/inn
  'artisan',      // smiths, weavers, potters
  'guard',        // law enforcement
  'priest',       // religious leader
  'criminal',     // thief, smuggler, fence
  'noble',        // local aristocrat
  'healer',       // doctor, herbalist
  'entertainer',  // bard, performer
  'scholar',      // sage, librarian
  'farmer',       // agriculture
  'sailor',       // docks, fishing, trade
  'banker',       // deposits, loans, appraisals
  'spy',          // espionage agent, information broker
  'soldier',      // standing army, garrison
  'fisherman',    // water resource extraction
  'librarian',    // Candlekeep-type knowledge keeper
])
export type Occupation = z.infer<typeof OccupationSchema>

// ============================================================
// OCCUPATION → ACTION TYPE AFFINITY
// ============================================================

/** Each occupation has preferred action types */
const OCCUPATION_ACTIONS: Record<Occupation, ActionType[]> = {
  merchant:    ['economic', 'diplomatic'],
  innkeeper:   ['economic', 'personal', 'entertainment'],
  artisan:     ['economic', 'personal'],
  guard:       ['military', 'criminal'],    // enforces OR abuses
  priest:      ['religious', 'diplomatic'],
  criminal:    ['criminal', 'espionage'],
  noble:       ['political', 'economic', 'financial'],
  healer:      ['personal', 'religious'],
  entertainer: ['entertainment', 'diplomatic', 'personal'],
  scholar:     ['scholarly', 'diplomatic'],
  farmer:      ['economic', 'personal'],
  sailor:      ['naval', 'economic'],
  banker:      ['financial', 'economic'],
  spy:         ['espionage', 'criminal', 'diplomatic'],
  soldier:     ['military', 'diplomatic'],
  fisherman:   ['naval', 'economic'],
  librarian:   ['scholarly', 'personal'],
}

// ============================================================
// LOCAL ACTION TEMPLATES — What a local actor CAN do
// ============================================================

const LOCAL_ACTIONS: { type: ActionType; description: string; horizon: Horizon }[] = [
  // Weekly (daily operations)
  { type: 'economic',      description: 'adjust prices or inventory',      horizon: 'weekly' },
  { type: 'personal',      description: 'build relationship with someone', horizon: 'weekly' },
  { type: 'criminal',      description: 'run a small hustle',              horizon: 'weekly' },
  { type: 'espionage',     description: 'gather local gossip',             horizon: 'weekly' },
  { type: 'religious',     description: 'hold service or ceremony',        horizon: 'weekly' },
  { type: 'military',      description: 'patrol or enforce order',         horizon: 'weekly' },
  { type: 'diplomatic',    description: 'mediate local dispute',           horizon: 'weekly' },
  { type: 'entertainment', description: 'perform at a venue',              horizon: 'weekly' },
  { type: 'scholarly',     description: 'study or copy a text',            horizon: 'weekly' },
  { type: 'naval',         description: 'go fishing or run a ferry',       horizon: 'weekly' },
  { type: 'financial',     description: 'process deposits and loans',      horizon: 'weekly' },
  // Monthly (bigger moves)
  { type: 'economic',      description: 'expand business operations',      horizon: 'monthly' },
  { type: 'political',     description: 'petition settlement leadership',  horizon: 'monthly' },
  { type: 'criminal',      description: 'organize a larger scheme',        horizon: 'monthly' },
  { type: 'personal',      description: 'recruit new staff or ally',       horizon: 'monthly' },
  { type: 'religious',     description: 'organize community initiative',   horizon: 'monthly' },
  { type: 'entertainment', description: 'organize a festival or tournament', horizon: 'monthly' },
  { type: 'scholarly',     description: 'conduct extended research',       horizon: 'monthly' },
  { type: 'naval',         description: 'chart new water route',           horizon: 'monthly' },
  { type: 'financial',     description: 'negotiate major loan or investment', horizon: 'monthly' },
  { type: 'espionage',     description: 'run an intelligence operation',   horizon: 'monthly' },
  { type: 'military',      description: 'train militia or fortify position', horizon: 'monthly' },
  // Quarterly (rare, needs high INT)
  { type: 'economic',      description: 'establish new trade partnership',  horizon: 'quarterly' },
  { type: 'political',     description: 'run for local office',            horizon: 'quarterly' },
  { type: 'scholarly',     description: 'author a book or treatise',       horizon: 'quarterly' },
  { type: 'financial',     description: 'establish a new currency trust',  horizon: 'quarterly' },
]

// ============================================================
// TPB ENTRY — Local actor's life history
// ============================================================

export const LocalTPBEntrySchema = z.object({
  worldDay: z.number().int(),
  decision: z.string(),
  actionType: z.string(),
  horizon: z.string(),
  d20: z.number().int().min(1).max(20),
  total: z.number(),
  grade: z.string(),
  magnitude: z.number(),
  isReactive: z.boolean().default(false),
})
export type LocalTPBEntry = z.infer<typeof LocalTPBEntrySchema>

// ============================================================
// LOCAL ACTOR DOMAIN STATE
// ============================================================

export interface LocalActorDomainState {
  drives: Drives
  goals: Goal[]
  resources: LocalResources
  occupation: Occupation
  abilityScores: { intelligence: number; wisdom: number; charisma: number }
  /** Active routines/schemes */
  activeAction: Action | null
  activeActionProgress: number
  activeActionStartedAt: number
  /** Append-only life history */
  tpb: LocalTPBEntry[]
}

// ============================================================
// MM_LOCAL_ACTOR — The implementation
// ============================================================

export class MMLocalActor extends SimulatedMMBase {
  domain: LocalActorDomainState
  private dicePool: DicePool

  constructor(
    id: string,
    name: string,
    nodeId: string,
    domain: LocalActorDomainState,
    worldDay: number = 0,
  ) {
    super(id, name, nodeId, 'local_actor', worldDay)
    this.domain = {
      ...domain,
      goals: [...(domain.goals ?? [])],
      tpb: [...(domain.tpb ?? [])],
    }
    // Smaller pool — local actors roll less
    this.dicePool = new DicePool(20, id, 50, worldDay)
  }

  // ──────────────────────────────
  // ACCUMULATE — O(1) per actor per tick
  // ──────────────────────────────

  protected onAccumulate(days: number, worldDay: number, _tp?: import('./tp.js').TP): void {
    const weeks = days / 7

    // 1. Progress active action
    if (this.domain.activeAction) {
      const horizon = this.domain.activeAction.horizon as Horizon
      const rate = HORIZON_CONFIG[horizon].progressPerWeek
      this.domain.activeActionProgress = Math.min(
        1.0,
        this.domain.activeActionProgress + rate * weeks,
      )

      // 2. If complete, roll it
      if (this.domain.activeActionProgress >= 1.0) {
        this.rollAction(worldDay)
        this.domain.activeAction = null
        this.domain.activeActionProgress = 0
      }
    }

    // 3. If no active action, decide a new one
    if (!this.domain.activeAction) {
      const activeGoals = this.domain.goals.filter(g => g.status === 'active')
      if (activeGoals.length > 0) {
        this.domain.activeAction = this.decideAction(activeGoals, worldDay)
        this.domain.activeActionStartedAt = worldDay

        // Apply this tick's progress immediately to the new action
        if (this.domain.activeAction) {
          const newHorizon = this.domain.activeAction.horizon as Horizon
          const newRate = HORIZON_CONFIG[newHorizon].progressPerWeek
          this.domain.activeActionProgress = Math.min(1.0, newRate * weeks)

          // If already complete (e.g. weekly action in a full week), roll it
          if (this.domain.activeActionProgress >= 1.0) {
            this.rollAction(worldDay)
            this.domain.activeAction = null
            this.domain.activeActionProgress = 0
          }
        }
      }
    }

    // 4. Passive resource effects (occupation-based income)
    this.domain.resources.gold += this.passiveIncome() * weeks
  }

  // ──────────────────────────────
  // DECIDE — Pick from occupation-relevant actions
  // ──────────────────────────────

  private decideAction(goals: Goal[], worldDay: number): Action | null {
    const intScore = this.domain.abilityScores.intelligence
    const nOptions = optionsFromInt(intScore)

    // Filter actions by occupation affinity + INT horizon cap
    const affinityTypes = OCCUPATION_ACTIONS[this.domain.occupation]
    const maxH = intScore >= 14 ? 'quarterly' : intScore >= 8 ? 'monthly' : 'weekly'
    const horizonOrder: Horizon[] = ['weekly', 'monthly', 'quarterly', 'semesterly', 'annually', 'life']
    const maxIdx = horizonOrder.indexOf(maxH as Horizon)

    const available = LOCAL_ACTIONS.filter(a => {
      const hIdx = horizonOrder.indexOf(a.horizon)
      const typeMatch = affinityTypes.includes(a.type)
      return typeMatch && hIdx <= maxIdx
    })

    if (available.length === 0) return null

    // Model N options
    const primaryGoal = goals[0]
    const options: Action[] = available
      .slice(0, nOptions)
      .map((template, i) => ({
        id: `${this.state.id}_local_${worldDay}_${i}`,
        type: template.type,
        horizon: template.horizon,
        goalId: primaryGoal.id,
        targetId: this.state.nodeId, // always intra-hub
        description: template.description,
        isReactive: false,
      }))

    // Score by drives
    const scored = options.map(o => ({
      action: o,
      score: scoreOption(o, this.domain.drives),
    }))
    scored.sort((a, b) => b.score - a.score)

    return scored[0]?.action ?? null
  }

  // ──────────────────────────────
  // ROLL — d20 from pool, compute outcome
  // ──────────────────────────────

  private rollAction(worldDay: number): void {
    if (!this.domain.activeAction) return

    const diceResult = this.dicePool.roll()
    const d20 = diceResult.rolls[0]

    // Local modifier: reputation + contacts + INT
    let modifier = 0
    modifier += Math.min(5, Math.floor(this.domain.resources.reputation / 20))
    modifier += Math.min(3, Math.floor(this.domain.resources.contacts / 5))
    modifier += abilityMod(this.domain.abilityScores.intelligence)

    // CHA bonus for personal/diplomatic actions
    if (['personal', 'diplomatic'].includes(this.domain.activeAction.type)) {
      modifier += abilityMod(this.domain.abilityScores.charisma)
    }

    const outcome = resolveAction(this.domain.activeAction, d20, modifier, worldDay)

    // Record in TPB
    this.domain.tpb.push({
      worldDay,
      decision: this.domain.activeAction.description,
      actionType: this.domain.activeAction.type,
      horizon: this.domain.activeAction.horizon,
      d20: outcome.d20,
      total: outcome.total,
      grade: outcome.grade,
      magnitude: outcome.magnitude,
      isReactive: false,
    })

    // Apply reputation effects based on result
    if (outcome.grade === 'critical' || outcome.grade === 'great') {
      this.domain.resources.reputation = Math.min(
        100, this.domain.resources.reputation + 5,
      )
    } else if (outcome.grade === 'backfire') {
      this.domain.resources.reputation = Math.max(
        -100, this.domain.resources.reputation - 10,
      )
    }
  }

  // ──────────────────────────────
  // REACT — Response to external event
  // ──────────────────────────────

  react(trigger: string, triggerType: ActionType, worldDay: number): ActionOutcome | null {
    const diceResult = this.dicePool.roll()
    const d20 = diceResult.rolls[0]

    const action: Action = {
      id: `${this.state.id}_react_${worldDay}`,
      type: triggerType,
      horizon: 'weekly',
      goalId: 'reactive',
      targetId: this.state.nodeId,
      description: `react to ${trigger}`,
      isReactive: true,
    }

    let modifier = abilityMod(this.domain.abilityScores.intelligence)
    modifier += Math.min(3, Math.floor(this.domain.resources.contacts / 5))

    const outcome = resolveAction(action, d20, modifier, worldDay)

    this.domain.tpb.push({
      worldDay,
      decision: action.description,
      actionType: action.type,
      horizon: action.horizon,
      d20: outcome.d20,
      total: outcome.total,
      grade: outcome.grade,
      magnitude: outcome.magnitude,
      isReactive: true,
    })

    return outcome
  }

  // ──────────────────────────────
  // PASSIVE INCOME — occupation-based
  // ──────────────────────────────

  private passiveIncome(): number {
    const base: Record<Occupation, number> = {
      merchant: 10, innkeeper: 7, artisan: 5, guard: 3,
      priest: 2, criminal: 8, noble: 15, healer: 4,
      entertainer: 6, scholar: 2, farmer: 3, sailor: 5,
      banker: 12, spy: 9, soldier: 3, fisherman: 4, librarian: 2,
    }
    const rep = this.domain.resources.reputation
    const repMultiplier = rep > 0 ? 1 + rep / 200 : 1 + rep / 400
    return (base[this.domain.occupation] ?? 3) * repMultiplier
  }

  // ──────────────────────────────
  // RESOLVE
  // ──────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, _tp?: import('./tp.js').TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const recentEntries = this.domain.tpb.filter(
      e => e.worldDay > worldDay - daysResolved,
    )
    const parts = recentEntries.map(e =>
      `Day ${e.worldDay}: ${e.decision} → ${e.grade}` +
      (e.isReactive ? ' (reaction)' : ''),
    )

    return {
      stateChanges: {
        reputation: this.domain.resources.reputation,
        gold: this.domain.resources.gold,
        tpbEntries: this.domain.tpb.length,
      },
      narrative: parts.length > 0
        ? `${this.state.name} the ${this.domain.occupation} (${daysResolved} days): ${parts.join('. ')}.`
        : `${this.state.name} the ${this.domain.occupation} (${daysResolved} days): Business as usual.`,
      additionalEvents: [],
    }
  }

  // ──────────────────────────────
  // ACCESSORS
  // ──────────────────────────────

  getTPB(): LocalTPBEntry[] { return [...this.domain.tpb] }
  getResources(): LocalResources { return { ...this.domain.resources } }
  getOccupation(): Occupation { return this.domain.occupation }
  getDrives(): Drives { return { ...this.domain.drives } }
  tickDicePool(worldDay: number): void { this.dicePool.tick(worldDay) }

  protected getDomainState(): LocalActorDomainState {
    return { ...this.domain }
  }
}
