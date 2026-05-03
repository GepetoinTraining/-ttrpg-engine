/**
 * CLOCKWORK — The Unified World Simulation Engine
 * ==================================================
 * 
 * The server-side tick engine. Turns the gears of the world.
 * 
 * UNIFIED from two former engines:
 *   - Clockwork (5-layer dependency ordering, ISimulatedMM)
 *   - WorldTickEngine (cadence counting, observation ticks, player ticks)
 * 
 * DAILY BASE HEARTBEAT:
 *   Every day, ALL daily MMs accumulate.
 *   Deltas count up toward weekly/monthly/yearly thresholds.
 *   When a threshold fires, all MMs at that cadence accumulate.
 * 
 * DEPENDENCY LAYERS (inner feeds outer, per docs/tp_schema.md):
 *   Layer 0: PHYSICAL      — weather, water (zero deps, pure generation)
 *   Layer 1: EXTRACTION    — production-chain, agriculture, husbandry (read weather κ)
 *   Layer 2: ECONOMY       — market, banking, currency, caravan, logistics (read extraction)
 *   Layer 3: FACTION       — faction, warfare, intelligence (read economy κ)
 *   Layer 4: SETTLEMENT    — mm-settlement, infrastructure-mm, knowledge-pool, social
 *   Layer 5: ECOLOGY       — monster-actor, dungeon-gate, guild (read settlement κ)
 *   Layer 6: HUB SERVICES  — npc-agenda, cooking, entertainment, lore, services, religion, narrative
 * 
 * OBSERVATION:
 *   When players arrive at a location, all MMs at that node RESOLVE.
 *   Accumulated potential collapses into state changes + narrative.
 * 
 * PLAYER TICKS:
 *   Player actions (rolls, checks, combat) feed addPlayerTick().
 *   More players = richer world detail.
 */

import { type ISimulatedMM, type ResolveResult } from './mm-simulated'
import { type TP } from './tp'

// ============================================================
// CADENCES
// ============================================================

export type TickCadence = 'round' | 'slot' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semesterly' | 'yearly'

export const CADENCE_DAYS: Record<TickCadence, number> = {
  round:      0,
  slot:       0,
  hourly:     0,
  daily:      1,
  weekly:     7,
  monthly:    30,
  quarterly:  90,
  semesterly: 180,
  yearly:     360,
}

// ============================================================
// CONFIGURATION
// ============================================================

export interface ClockworkConfig {
  /** Safety: max ticks per crank */
  maxTicksPerCrank?: number
}

const DEFAULT_CONFIG: ClockworkConfig = {
  maxTicksPerCrank: 365 * 2,
}

// ============================================================
// REGISTRATION — MM with cadence + layer
// ============================================================

export interface MMRegistration {
  mm: ISimulatedMM
  layer: number
  cadence: TickCadence
  observationOnly: boolean
}

// ============================================================
// RESULTS
// ============================================================

export interface DailyTickResult {
  worldDay: number
  dailyMMs: string[]
  weeklyMMs: string[]
  monthlyMMs: string[]
  quarterlyMMs: string[]
  semesterlyMMs: string[]
  yearlyMMs: string[]
  firedWeekly: boolean
  firedMonthly: boolean
  firedQuarterly: boolean
  firedSemesterly: boolean
  firedYearly: boolean
  playerTicksConsumed: number
}

export interface CrankResult {
  fromDay: number
  toDay: number
  ticksExecuted: number
  tickResults: DailyTickResult[]
  totalMMsTicked: number
}

export interface ObservationResult {
  nodeId: string
  worldDay: number
  resolved: ResolveResult[]
}

// ============================================================
// DELTA STATE
// ============================================================

export interface DeltaState {
  weeklyDelta: number
  monthlyDelta: number
  quarterlyDelta: number
  semesterlyDelta: number
  yearlyDelta: number
}

// ============================================================
// CLOCKWORK — The unified engine
// ============================================================

export class Clockwork {
  private config: ClockworkConfig
  private currentWorldDay: number
  private deltas: DeltaState = { weeklyDelta: 0, monthlyDelta: 0, quarterlyDelta: 0, semesterlyDelta: 0, yearlyDelta: 0 }

  /** Player math ticks contributed today */
  private playerTicksToday = 0
  /** Total player ticks all-time */
  private totalPlayerTicks = 0

  /** The world topology — passed to all tick functions for κ read/write */
  private tp: TP

  /**
   * Layers of MMs, each with cadence + observation flags.
   * 7 layers in dependency order (0 = physical, 6 = hub services).
   * See class docblock for the canonical layer mapping.
   */
  private layers: Map<string, MMRegistration>[] = []

  /**
   * Hub activity tracking — per Pedro 2026-05-02:
   *   "this only happens where a player has spent time in"
   *   "16 days out of 30 played to use the server compute, because believe
   *    me this is a heavier load"
   *
   * Maps `hubId → Set<dayNumber>` of distinct world days the player was
   * observed at the hub. The set is opportunistically pruned on each
   * `markHubActive` to bound memory at the active window. A hub is "active"
   * (server-compute-enabled) when cumulative presence within the window
   * meets `ACTIVE_HUB_THRESHOLD_DAYS`. Player IDB carries hubs with lighter
   * presence; the server only spends ticks where the player has invested
   * enough to justify the heavier load.
   *
   * **Default OFF.** When the gate is disabled (the default) all hub-bound
   * MMs tick regardless. Enable via `setActiveHubGate(true)` for the
   * production behavior. Tests that register MMs without seeding visits
   * rely on the gate being off, OR on `setActiveHubThreshold(1)` to make a
   * single observation count.
   */
  private hubVisitDays = new Map<string, Set<number>>()
  private activeHubGateEnabled = false
  /** Instance threshold — defaults from the static constant; settable per-instance for tests + per-campaign tuning. */
  private activeHubThresholdDays: number = Clockwork.ACTIVE_HUB_THRESHOLD_DAYS
  /** Instance window — defaults from the static constant; settable per-instance. */
  private activeHubWindowDays: number = Clockwork.ACTIVE_HUB_WINDOW_DAYS

  /** Number of dependency layers. Treat as architectural constant. */
  static readonly NUM_LAYERS = 7

  /** Default lookback window for hub-active filter (in days). */
  static readonly ACTIVE_HUB_WINDOW_DAYS = 30

  /** Default cumulative-presence threshold within the window (in days). */
  static readonly ACTIVE_HUB_THRESHOLD_DAYS = 16

  constructor(tp: TP, worldDay: number = 0, config?: Partial<ClockworkConfig>) {
    this.tp = tp
    this.currentWorldDay = worldDay
    this.config = { ...DEFAULT_CONFIG, ...config }
    for (let i = 0; i < Clockwork.NUM_LAYERS; i++) {
      this.layers.push(new Map())
    }
  }

  // ── Hub activity tracking ──

  /**
   * Toggle the active-hub gate. Default off. When enabled, hub-bound MMs
   * (those with `state.nodeId`) only tick if their hub has been observed
   * within the activity window.
   */
  setActiveHubGate(enabled: boolean): void {
    this.activeHubGateEnabled = enabled
  }

  /** Returns whether the gate is currently enforcing the active-hub filter. */
  isActiveHubGateEnabled(): boolean {
    return this.activeHubGateEnabled
  }

  /**
   * Override the cumulative-presence threshold. Defaults to
   * `ACTIVE_HUB_THRESHOLD_DAYS` (16). Tests typically set this to 1 to make
   * a single observation count; long-running campaigns may tune it down.
   */
  setActiveHubThreshold(days: number): void {
    this.activeHubThresholdDays = Math.max(0, Math.floor(days))
  }

  /**
   * Override the activity window. Defaults to `ACTIVE_HUB_WINDOW_DAYS` (30).
   */
  setActiveHubWindow(days: number): void {
    this.activeHubWindowDays = Math.max(1, Math.floor(days))
  }

  /**
   * Record that a hub has been observed by a player on a given world day.
   * Adds the day to the hub's visit set, then prunes any visit days that
   * have aged out of the active window. Idempotent on the same day.
   */
  markHubActive(hubId: string, day?: number): void {
    const d = day ?? this.currentWorldDay
    let set = this.hubVisitDays.get(hubId)
    if (!set) {
      set = new Set<number>()
      this.hubVisitDays.set(hubId, set)
    }
    set.add(d)
    this.pruneVisitDaysFor(hubId)
  }

  /**
   * Is this hub currently active — i.e. has the player accumulated enough
   * presence inside the window to justify server-side compute? Counts the
   * visit days within `windowDays` and returns true when the count meets
   * `thresholdDays`. Both default to the instance's configured values.
   */
  isHubActive(
    hubId: string,
    windowDays: number = this.activeHubWindowDays,
    thresholdDays: number = this.activeHubThresholdDays,
  ): boolean {
    const set = this.hubVisitDays.get(hubId)
    if (!set) return false
    let count = 0
    for (const d of set) {
      if (this.currentWorldDay - d <= windowDays) count++
    }
    return count >= thresholdDays
  }

  /**
   * List all hubs currently considered active by the cumulative-presence
   * rule. Useful for debugging + monthly tick filter sanity checks.
   */
  getActiveHubs(
    windowDays: number = this.activeHubWindowDays,
    thresholdDays: number = this.activeHubThresholdDays,
  ): string[] {
    const out: string[] = []
    for (const [hubId, set] of this.hubVisitDays) {
      let count = 0
      for (const d of set) {
        if (this.currentWorldDay - d <= windowDays) count++
      }
      if (count >= thresholdDays) out.push(hubId)
    }
    return out
  }

  /**
   * Manual purge of stale hubs — drops any hub whose entire visit set is
   * older than `staleAfterDays`. Optional cleanup for long-running campaigns;
   * `markHubActive` keeps the per-hub set bounded automatically.
   */
  pruneStaleHubs(staleAfterDays: number = 365): number {
    let removed = 0
    for (const [hubId, set] of this.hubVisitDays) {
      let hasRecent = false
      for (const d of set) {
        if (this.currentWorldDay - d <= staleAfterDays) {
          hasRecent = true
          break
        }
      }
      if (!hasRecent) {
        this.hubVisitDays.delete(hubId)
        removed++
      }
    }
    return removed
  }

  /**
   * Drop visit days outside the active window from a single hub's set.
   * Called by `markHubActive` after each addition to keep memory bounded.
   * If the set empties, the hub is removed from the map entirely.
   */
  private pruneVisitDaysFor(hubId: string): void {
    const set = this.hubVisitDays.get(hubId)
    if (!set) return
    for (const d of set) {
      if (this.currentWorldDay - d > this.activeHubWindowDays) set.delete(d)
    }
    if (set.size === 0) this.hubVisitDays.delete(hubId)
  }

  // ── Registration ──

  /**
   * Register an MM with its cadence and layer.
   */
  register(mm: ISimulatedMM, layer: number = 2, cadence: TickCadence = 'weekly', observationOnly: boolean = false): void {
    if (layer < 0 || layer >= this.layers.length) {
      throw new Error(`Invalid layer ${layer}. Must be 0-${this.layers.length - 1}`)
    }
    this.layers[layer].set(mm.state.id, { mm, layer, cadence, observationOnly })
  }

  unregister(mmId: string): boolean {
    for (const layer of this.layers) {
      if (layer.delete(mmId)) return true
    }
    return false
  }

  getMM(mmId: string): ISimulatedMM | undefined {
    for (const layer of this.layers) {
      const reg = layer.get(mmId)
      if (reg) return reg.mm
    }
    return undefined
  }

  // ── Daily Tick (server-side heartbeat) ──

  /**
   * Execute one daily tick.
   * 
   * 1. Fire ALL daily MMs (accumulate)
   * 2. Increment weekly/monthly/yearly deltas
   * 3. If delta threshold reached, fire those MMs
   * 4. Consume player ticks
   */
  dailyTick(): DailyTickResult {
    this.currentWorldDay++

    const result: DailyTickResult = {
      worldDay: this.currentWorldDay,
      dailyMMs: [],
      weeklyMMs: [],
      monthlyMMs: [],
      quarterlyMMs: [],
      semesterlyMMs: [],
      yearlyMMs: [],
      firedWeekly: false,
      firedMonthly: false,
      firedQuarterly: false,
      firedSemesterly: false,
      firedYearly: false,
      playerTicksConsumed: this.playerTicksToday,
    }

    // Phase 1: Fire DAILY MMs (all layers, dependency order)
    this.tickMMs('daily', 1, result.dailyMMs)

    // Phase 2: Increment deltas
    this.deltas.weeklyDelta++
    this.deltas.monthlyDelta++
    this.deltas.quarterlyDelta++
    this.deltas.semesterlyDelta++
    this.deltas.yearlyDelta++

    // Phase 3: Fire bigger cadences if threshold reached
    if (this.deltas.weeklyDelta >= CADENCE_DAYS.weekly) {
      const delta = this.deltas.weeklyDelta
      this.deltas.weeklyDelta = 0
      result.firedWeekly = true
      this.tickMMs('weekly', delta, result.weeklyMMs)
    }

    if (this.deltas.monthlyDelta >= CADENCE_DAYS.monthly) {
      const delta = this.deltas.monthlyDelta
      this.deltas.monthlyDelta = 0
      result.firedMonthly = true
      this.tickMMs('monthly', delta, result.monthlyMMs)
    }

    if (this.deltas.quarterlyDelta >= CADENCE_DAYS.quarterly) {
      const delta = this.deltas.quarterlyDelta
      this.deltas.quarterlyDelta = 0
      result.firedQuarterly = true
      this.tickMMs('quarterly', delta, result.quarterlyMMs)
    }

    if (this.deltas.semesterlyDelta >= CADENCE_DAYS.semesterly) {
      const delta = this.deltas.semesterlyDelta
      this.deltas.semesterlyDelta = 0
      result.firedSemesterly = true
      this.tickMMs('semesterly', delta, result.semesterlyMMs)
    }

    if (this.deltas.yearlyDelta >= CADENCE_DAYS.yearly) {
      const delta = this.deltas.yearlyDelta
      this.deltas.yearlyDelta = 0
      result.firedYearly = true
      this.tickMMs('yearly', delta, result.yearlyMMs)
    }

    // Phase 4: Consume player ticks
    this.totalPlayerTicks += this.playerTicksToday
    this.playerTicksToday = 0

    return result
  }

  /**
   * Fire all MMs at a given cadence across all layers (dependency order).
   * Non-observation-only MMs only.
   *
   * Hub-active filter (per Pedro 2026-05-02):
   *   When `activeHubGateEnabled`, an MM declaring `state.nodeId` is
   *   hub-bound and ticks only if that hub is active. World-tree MMs (no
   *   `state.nodeId`) always tick. When the gate is disabled (default),
   *   all MMs tick regardless — preserves backward compat with tests
   *   that register MMs without calling `observeNode`.
   */
  private tickMMs(cadence: TickCadence, days: number, results: string[]): void {
    for (const layer of this.layers) {
      for (const [id, reg] of layer) {
        if (reg.cadence !== cadence || reg.observationOnly) continue
        if (this.activeHubGateEnabled) {
          const hubId = (reg.mm.state as { nodeId?: string }).nodeId
          if (hubId && !this.isHubActive(hubId)) continue
        }
        reg.mm.accumulatePotential(days, this.currentWorldDay, this.tp)
        results.push(id)
      }
    }
  }

  // ── Crank — Catch up multiple days ──

  crankTo(targetDay: number): CrankResult {
    const fromDay = this.currentWorldDay
    const tickResults: DailyTickResult[] = []
    let totalMMsTicked = 0
    const maxTicks = this.config.maxTicksPerCrank ?? 365 * 2

    let ticks = 0
    while (this.currentWorldDay < targetDay && ticks < maxTicks) {
      const result = this.dailyTick()
      tickResults.push(result)
      totalMMsTicked += result.dailyMMs.length + result.weeklyMMs.length +
        result.monthlyMMs.length + result.quarterlyMMs.length +
        result.semesterlyMMs.length + result.yearlyMMs.length
      ticks++
    }

    return { fromDay, toDay: this.currentWorldDay, ticksExecuted: ticks, tickResults, totalMMsTicked }
  }

  // ── Observation — Resolve specific MMs ──

  /**
   * Resolve a specific MM (triggered by player observation).
   */
  observe(mmId: string): ResolveResult | null {
    const mm = this.getMM(mmId)
    if (!mm) return null
    if (mm.pendingDays() === 0) return null
    return mm.resolve(this.currentWorldDay, this.tp)
  }

  /**
   * Resolve all MMs at a specific .tp node.
   * Triggered when the party arrives at a location. Also marks the hub as
   * active so subsequent monthly ticks fire for it (per Pedro 2026-05-02).
   */
  observeNode(nodeId: string): ObservationResult {
    this.markHubActive(nodeId)
    const resolved: ResolveResult[] = []
    for (const layer of this.layers) {
      for (const [, reg] of layer) {
        if (reg.mm.state.nodeId === nodeId && reg.mm.pendingDays() > 0) {
          resolved.push(reg.mm.resolve(this.currentWorldDay, this.tp))
        }
      }
    }
    return { nodeId, worldDay: this.currentWorldDay, resolved }
  }

  // ── Player Ticks ──

  addPlayerTick(count: number = 1): void {
    this.playerTicksToday += count
  }

  // ── State Access ──

  get worldDay(): number { return this.currentWorldDay }
  getTP(): TP { return this.tp }

  totalMMs(): number {
    return this.layers.reduce((sum, layer) => sum + layer.size, 0)
  }

  pendingMMs(): { id: string; daysPending: number }[] {
    const pending: { id: string; daysPending: number }[] = []
    for (const layer of this.layers) {
      for (const [id, reg] of layer) {
        const days = reg.mm.pendingDays()
        if (days > 0) pending.push({ id, daysPending: days })
      }
    }
    return pending
  }

  getLayer(layer: number): ISimulatedMM[] {
    if (layer < 0 || layer >= this.layers.length) return []
    return Array.from(this.layers[layer].values()).map(r => r.mm)
  }

  snapshot(): ClockworkSnapshot {
    const mmsByCadence: Record<TickCadence, number> = {
      daily: 0, weekly: 0, monthly: 0, quarterly: 0, semesterly: 0, yearly: 0,
      hourly: 0, slot: 0, round: 0,
    }
    for (const layer of this.layers) {
      for (const [, reg] of layer) {
        mmsByCadence[reg.cadence]++
      }
    }
    return {
      worldDay: this.currentWorldDay,
      deltas: { ...this.deltas },
      daysUntilWeekly: CADENCE_DAYS.weekly - this.deltas.weeklyDelta,
      daysUntilMonthly: CADENCE_DAYS.monthly - this.deltas.monthlyDelta,
      daysUntilQuarterly: CADENCE_DAYS.quarterly - this.deltas.quarterlyDelta,
      daysUntilSemesterly: CADENCE_DAYS.semesterly - this.deltas.semesterlyDelta,
      daysUntilYearly: CADENCE_DAYS.yearly - this.deltas.yearlyDelta,
      totalMMs: this.totalMMs(),
      mmsByCadence,
      totalPlayerTicks: this.totalPlayerTicks,
    }
  }
}

export interface ClockworkSnapshot {
  worldDay: number
  deltas: DeltaState
  daysUntilWeekly: number
  daysUntilMonthly: number
  daysUntilQuarterly: number
  daysUntilSemesterly: number
  daysUntilYearly: number
  totalMMs: number
  mmsByCadence: Record<TickCadence, number>
  totalPlayerTicks: number
}
