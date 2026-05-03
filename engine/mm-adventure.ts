/**
 * MM_ADVENTURE — Campaign-Level Container
 * ==========================================
 * 
 * The outermost game container. An adventure (campaign) spans
 * multiple sessions and downtime periods. It owns the .tp world
 * and the party.
 * 
 * HIERARCHY:
 *   MM_adventure (campaign)
 *   ├── MM_session (play session — scene cards, hooks, combat)
 *   │   └── pocket manifolds (combat at 6s ticks)
 *   ├── MM_downtime (between sessions — crafting, training, etc.)
 *   ├── MM_party
 *   │   └── MM_character[]
 *   └── .tp (world state — persists across all sessions & downtimes)
 * 
 * The adventure manages:
 *   - World state (.tp) across all sessions
 *   - Party persistence across sessions
 *   - Session history (.tpb per session)
 *   - Downtime periods between sessions
 *   - Campaign-level hooks (multi-session plot threads)
 *   - World time (daily tick — sessions/downtime advance world time)
 * 
 * TIME MODEL:
 *   - World tick = 1 day (the default, narrative time)
 *   - Session tick = scene card advancement
 *   - Combat tick = 6 seconds (pocket manifold)
 *   - Downtime tick = 1 day (activity resolution)
 * 
 * Each played session mutates the .tp. Each downtime mutates
 * character state. The adventure aggregates all of this.
 */

import { z } from 'zod'
import { MMSession, type SceneCard, type HookThread, type WorldMutation } from './mm-session'
import { MMParty } from './mm-party'
import { MMFollowers } from './mm-followers'
import { type CharacterDataInput } from './mm-character'
import { type NPCDataInput } from './mm-npc'
import { TP, type WorldNode, type WorldEdge } from './tp'
import { TPB } from './tpb'
import { type CycleDelta, ZERO_DELTA, addDeltas } from './types'
import { Clockwork, type ObservationResult } from './clockwork'

// ============================================================
// DOWNTIME ACTIVITY — What characters do between sessions
// ============================================================

export const DowntimeActivitySchema = z.object({
  id: z.string(),
  characterId: z.string(),
  type: z.enum([
    'crafting',     // Create items
    'training',     // Learn skills or proficiencies
    'research',     // Study lore or magic
    'working',      // Earn gold
    'socializing',  // Build NPC relationships
    'recuperating', // Recover from lingering injuries
    'carousing',    // Party lifestyle
    'crime',        // Illegal activities
    'religious',    // Service at a temple
  ]),
  description: z.string(),
  daysRequired: z.number().int(),
  daysCompleted: z.number().int().default(0),
  goldCost: z.number().int().default(0),
  result: z.string().optional(),
  completed: z.boolean().default(false),
})
export type DowntimeActivity = z.infer<typeof DowntimeActivitySchema>
export type DowntimeActivityInput = z.input<typeof DowntimeActivitySchema>

// ============================================================
// DOWNTIME PERIOD — The time between sessions
// ============================================================

export interface DowntimePeriod {
  id: string
  /** How many in-world days this downtime spans */
  days: number
  /** Activities each character is doing */
  activities: DowntimeActivity[]
  /** Gold earned/spent during downtime */
  goldDelta: number
  /** Completed? */
  resolved: boolean
}

// ============================================================
// SESSION RECORD — Completed session summary
// ============================================================

export interface SessionRecord {
  id: string
  sessionNumber: number
  /** The MMSession (contains scene cards, hooks, combat results) */
  session: MMSession
  /** World mutations this session produced */
  mutations: WorldMutation[]
  /** When in world time this session took place */
  worldDay: number
  /** Duration in world-days */
  worldDaysDuration: number
}

// ============================================================
// MM_ADVENTURE — The campaign container
// ============================================================

export class MMAdventure {
  private id: string
  private name: string
  private party: MMParty
  private followers: MMFollowers
  private tp: TP
  private tpb: TPB

  /** The unified world simulation engine (optional for backward compat) */
  private clockwork: Clockwork | null = null

  /** Party's local time — always <= worldDay. When no Clockwork, this IS worldDay. */
  private partyDay = 1
  
  /** Session history */
  private sessions: SessionRecord[] = []
  private activeSession: MMSession | null = null

  /** Downtime periods */
  private downtimes: DowntimePeriod[] = []
  private activeDowntime: DowntimePeriod | null = null

  /** Campaign-level hooks (span multiple sessions) */
  private campaignHooks: Map<string, HookThread> = new Map()

  constructor(id: string, name: string, partyName: string, clockwork?: Clockwork) {
    this.id = id
    this.name = name
    this.party = new MMParty(id + ':party', partyName)
    this.followers = new MMFollowers()
    if (clockwork) {
      this.clockwork = clockwork
      this.tp = clockwork.getTP()
    } else {
      this.tp = new TP()
    }
    this.tpb = TPB.create({ adventureId: id, name }, id)
  }

  // ============================================================
  // PARTY MANAGEMENT
  // ============================================================

  /** Get the party. */
  getParty(): MMParty { return this.party }

  /** Add a character to the party. */
  addCharacter(data: CharacterDataInput) {
    return this.party.addMember(data)
  }

  // ============================================================
  // FOLLOWER MANAGEMENT
  // ============================================================

  /** Get the followers container. */
  getFollowers(): MMFollowers { return this.followers }

  /** Add a local follower (travels with party). */
  addLocalFollower(data: NPCDataInput) {
    return this.followers.addLocal(data)
  }

  /** Add a global follower (at their own .tp node). */
  addGlobalFollower(data: NPCDataInput) {
    return this.followers.addGlobal(data)
  }

  // ============================================================
  // WORLD (.tp) MANAGEMENT
  // ============================================================

  /** Get the world topology. */
  getWorld(): TP { return this.tp }

  /** Load world data. */
  loadWorld(nodes: WorldNode[], edges?: WorldEdge[]): void {
    this.tp.loadNodes(nodes)
    if (edges) this.tp.loadEdges(edges)
  }

  // ============================================================
  // SESSION LIFECYCLE
  // ============================================================

  /**
   * Start a new play session.
   * Opens a session-level container within the adventure.
   */
  startSession(): MMSession {
    if (this.activeSession) throw new Error('A session is already active. End it first.')
    if (this.activeDowntime) throw new Error('Downtime is active. Resolve it first.')

    const sessionId = `${this.id}:session:${this.sessions.length + 1}`
    this.activeSession = new MMSession(sessionId)

    this.tpb.append(
      `session:start:${this.sessions.length + 1}`,
      { sessionNumber: this.sessions.length + 1, worldDay: this.partyDay },
      { sessionId: this.id },
    )

    return this.activeSession
  }

  /**
   * End the current session.
   * Captures all mutations, records history, advances world time.
   */
  endSession(worldDaysDuration = 1): SessionRecord {
    if (!this.activeSession) throw new Error('No active session to end')

    const sessionNumber = this.sessions.length + 1
    const mutations = this.activeSession.getMutations()

    const record: SessionRecord = {
      id: this.activeSession.getSessionId(),
      sessionNumber,
      session: this.activeSession,
      mutations,
      worldDay: this.partyDay,
      worldDaysDuration,
    }

    this.sessions.push(record)

    // Transfer session hooks to campaign hooks
    for (const hook of this.activeSession.getHooks()) {
      if (!hook.resolved) {
        this.campaignHooks.set(hook.id, hook)
      }
    }

    // Advance party time
    this.partyDay += worldDaysDuration

    this.tpb.append(
      `session:end:${sessionNumber}`,
      {
        sessionNumber,
        mutations: mutations.length,
        worldDayAfter: this.partyDay,
      },
      { sessionId: this.id },
    )

    this.activeSession = null
    return record
  }

  /** Get the active session, if any. */
  getActiveSession(): MMSession | null { return this.activeSession }

  /** Get session history. */
  getSessionHistory(): SessionRecord[] { return [...this.sessions] }

  // ============================================================
  // DOWNTIME LIFECYCLE
  // ============================================================

  /**
   * Start a downtime period (between sessions).
   * Characters can train, craft, work, research, etc.
   */
  startDowntime(days: number): DowntimePeriod {
    if (this.activeSession) throw new Error('A session is active. End it first.')
    if (this.activeDowntime) throw new Error('Downtime already active. Resolve it first.')

    const downtime: DowntimePeriod = {
      id: `${this.id}:downtime:${this.downtimes.length + 1}`,
      days,
      activities: [],
      goldDelta: 0,
      resolved: false,
    }

    this.activeDowntime = downtime

    this.tpb.append(
      `downtime:start:${this.downtimes.length + 1}`,
      { days, worldDay: this.partyDay },
      { sessionId: this.id },
    )

    return downtime
  }

  /**
   * Add a downtime activity for a character.
   */
  addDowntimeActivity(activity: DowntimeActivityInput): void {
    if (!this.activeDowntime) throw new Error('No active downtime period')
    const validated = DowntimeActivitySchema.parse(activity)
    if (validated.daysRequired > this.activeDowntime.days) {
      throw new Error(`Activity requires ${validated.daysRequired} days but downtime is only ${this.activeDowntime.days} days`)
    }
    this.activeDowntime.activities.push(validated)
  }

  /**
   * Resolve the downtime period.
   * Completes all activities, advances world time.
   */
  resolveDowntime(): {
    period: DowntimePeriod
    goldEarned: number
    goldSpent: number
    activitiesCompleted: number
  } {
    if (!this.activeDowntime) throw new Error('No active downtime to resolve')

    let goldEarned = 0
    let goldSpent = 0
    let activitiesCompleted = 0

    for (const activity of this.activeDowntime.activities) {
      activity.daysCompleted = Math.min(activity.daysRequired, this.activeDowntime.days)
      activity.completed = activity.daysCompleted >= activity.daysRequired

      if (activity.completed) {
        activitiesCompleted++

        // Handle gold effects
        if (activity.type === 'working') {
          const earned = activity.daysCompleted * 2 // 2gp/day base
          goldEarned += earned
          this.party.addGold(earned)
        }
        if (activity.goldCost > 0) {
          goldSpent += activity.goldCost
          this.party.spendGold(activity.goldCost)
        }

        // Auto-generate result if none set
        if (!activity.result) {
          activity.result = `Completed ${activity.type} over ${activity.daysCompleted} days`
        }
      }
    }

    this.activeDowntime.goldDelta = goldEarned - goldSpent
    this.activeDowntime.resolved = true
    this.downtimes.push(this.activeDowntime)

    // Advance party time
    this.partyDay += this.activeDowntime.days

    this.tpb.append(
      `downtime:end:${this.downtimes.length}`,
      {
        days: this.activeDowntime.days,
        activitiesCompleted,
        goldDelta: this.activeDowntime.goldDelta,
        worldDayAfter: this.partyDay,
      },
      { sessionId: this.id },
    )

    const resolved = this.activeDowntime
    this.activeDowntime = null
    return { period: resolved, goldEarned, goldSpent, activitiesCompleted }
  }

  /** Get the active downtime, if any. */
  getActiveDowntime(): DowntimePeriod | null { return this.activeDowntime }

  // ============================================================
  // CAMPAIGN-LEVEL HOOKS
  // ============================================================

  /** Get all unresolved campaign hooks. */
  getCampaignHooks(): HookThread[] {
    return Array.from(this.campaignHooks.values()).filter(h => !h.resolved)
  }

  /** Resolve a campaign hook. */
  resolveCampaignHook(hookId: string): void {
    const hook = this.campaignHooks.get(hookId)
    if (hook) hook.resolved = true
  }

  // ============================================================
  // STATE ACCESS
  // ============================================================

  getId(): string { return this.id }
  getName(): string { return this.name }
  getHistory(): TPB { return this.tpb }
  getSessionCount(): number { return this.sessions.length }
  getDowntimeCount(): number { return this.downtimes.length }

  /** Get the canonical world day — from Clockwork if wired, else same as partyDay. */
  getWorldDay(): number {
    return this.clockwork ? this.clockwork.worldDay : this.partyDay
  }

  /** Get the party's local time (always <= worldDay when Clockwork is wired). */
  getPartyDay(): number { return this.partyDay }

  /** Gap between world time and party time. */
  getGap(): number {
    return this.getWorldDay() - this.partyDay
  }

  /** Get the Clockwork engine, if wired. */
  getEngine(): Clockwork | null { return this.clockwork }

  /**
   * Observe the party's current .tp node.
   * Collapses all accumulated potential at that location.
   * Call this on session start to see what changed while party was away.
   */
  observePartyNode(nodeId: string): ObservationResult | null {
    if (!this.clockwork) return null
    return this.clockwork.observeNode(nodeId)
  }

  /** Feed a player action tick into the world simulation. */
  addPlayerTick(count: number = 1): void {
    if (this.clockwork) this.clockwork.addPlayerTick(count)
  }

  /** Full campaign summary. */
  summary(): {
    name: string
    worldDay: number
    partyDay: number
    gap: number
    sessions: number
    downtimes: number
    partySize: number
    partyLevel: number
    partyGold: number
    worldNodes: number
    unresolvedHooks: number
    localFollowers: number
    globalFollowers: number
    engineConnected: boolean
  } {
    const fSummary = this.followers.size()
    return {
      name: this.name,
      worldDay: this.getWorldDay(),
      partyDay: this.partyDay,
      gap: this.getGap(),
      sessions: this.sessions.length,
      downtimes: this.downtimes.length,
      partySize: this.party.size(),
      partyLevel: this.party.getPartyLevel(),
      partyGold: this.party.getGold(),
      worldNodes: this.tp.getAllNodes().length,
      unresolvedHooks: this.getCampaignHooks().length,
      localFollowers: fSummary.local,
      globalFollowers: fSummary.global,
      engineConnected: this.clockwork !== null,
    }
  }
}
