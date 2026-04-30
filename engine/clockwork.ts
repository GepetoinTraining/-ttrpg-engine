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

import { type ISimulatedMM, type ResolveResult } from './mm-simulated.js'
import { type TP } from './tp.js'

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

  /** Number of dependency layers. Treat as architectural constant. */
  static readonly NUM_LAYERS = 7

  constructor(tp: TP, worldDay: number = 0, config?: Partial<ClockworkConfig>) {
    this.tp = tp
    this.currentWorldDay = worldDay
    this.config = { ...DEFAULT_CONFIG, ...config }
    for (let i = 0; i < Clockwork.NUM_LAYERS; i++) {
      this.layers.push(new Map())
    }
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
   */
  private tickMMs(cadence: TickCadence, days: number, results: string[]): void {
    for (const layer of this.layers) {
      for (const [id, reg] of layer) {
        if (reg.cadence !== cadence || reg.observationOnly) continue
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
   * Triggered when the party arrives at a location.
   */
  observeNode(nodeId: string): ObservationResult {
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
