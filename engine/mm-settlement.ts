/**
 * MM_SETTLEMENT — The First World-Tree MM
 * ==========================================
 * 
 * A settlement (city, town, village) sitting at a .tp node.
 * Ticks weekly. Accumulates potential for:
 *   - population growth/decline
 *   - stability/unrest
 *   - prosperity (trade income)
 *   - events (fires, festivals, plagues, coups)
 * 
 * On tick: accumulatePotential adds linear deltas — O(1)
 * On observation: resolve() collapses days into state + events
 * 
 * Uses pools for pre-computed event rolls.
 */

import { z } from 'zod'
import {
  SimulatedMMBase,
  type PendingDelta,
  type ResolveResult,
} from './mm-simulated.js'
import { MFPool, type PoolConfig } from './mf-pool.js'

// ============================================================
// SETTLEMENT DOMAIN STATE
// ============================================================

export const SettlementSizeSchema = z.enum([
  'hamlet',     // < 100
  'village',    // 100-999
  'town',       // 1,000-9,999
  'city',       // 10,000-99,999
  'metropolis', // 100,000+
])
export type SettlementSize = z.infer<typeof SettlementSizeSchema>

export const SettlementStateSchema = z.object({
  population: z.number().int().nonnegative(),
  stability: z.number().min(0).max(100),    // 0 = anarchy, 100 = total order
  prosperity: z.number().min(0).max(100),   // 0 = destitute, 100 = thriving
  unrest: z.number().min(0).max(100),        // 0 = peaceful, 100 = revolution
  defenseLevel: z.number().int().min(0),     // military readiness
  tradeModifier: z.number(),                 // multiplier on commerce
  size: SettlementSizeSchema,
  // ── New system fields ──
  foodSecurity: z.number().min(0).max(100).default(50),   // agriculture + fishing + granary
  foodVariety: z.number().min(0).max(10).default(3),      // diet diversity → morale/health
  waterLevel: z.number().min(0).max(250).default(100),    // water body level (100 = normal)
  culturalScore: z.number().min(0).max(100).default(20),  // entertainment + gallery + festivals
  faithLevel: z.number().min(0).max(100).default(30),     // religious devotion
  loreAccess: z.number().min(0).max(10).default(0),       // library/knowledge modifier
  bankingActivity: z.number().min(0).max(100).default(0), // deposits, loans, financial
})
export type SettlementState = z.infer<typeof SettlementStateSchema>

// ============================================================
// SETTLEMENT RATES — κ (constants per settlement size)
// ============================================================

const RATES: Record<SettlementSize, {
  popGrowthPerWeek: number
  stabilityDrift: number
  prosperityDrift: number
  eventChancePerWeek: number
}> = {
  hamlet:     { popGrowthPerWeek: 0.002, stabilityDrift: 0.1,  prosperityDrift: 0.05, eventChancePerWeek: 0.05 },
  village:    { popGrowthPerWeek: 0.003, stabilityDrift: 0.05, prosperityDrift: 0.1,  eventChancePerWeek: 0.1 },
  town:       { popGrowthPerWeek: 0.002, stabilityDrift: 0.0,  prosperityDrift: 0.15, eventChancePerWeek: 0.15 },
  city:       { popGrowthPerWeek: 0.001, stabilityDrift: -0.05, prosperityDrift: 0.2,  eventChancePerWeek: 0.2 },
  metropolis: { popGrowthPerWeek: 0.0005, stabilityDrift: -0.1, prosperityDrift: 0.25, eventChancePerWeek: 0.3 },
}

function classifySize(pop: number): SettlementSize {
  if (pop >= 100_000) return 'metropolis'
  if (pop >= 10_000) return 'city'
  if (pop >= 1_000) return 'town'
  if (pop >= 100) return 'village'
  return 'hamlet'
}

// ============================================================
// SETTLEMENT EVENTS — Pre-computed potential events
// ============================================================

interface SettlementEvent {
  type: string
  magnitude: number
  description: string
  effects: Record<string, number>
}

// Simple seeded PRNG (same as mf-dice mulberry32)
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Simple string hash for deterministic seed from id */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

const EVENT_TEMPLATES: SettlementEvent[] = [
  { type: 'festival',          magnitude: 1, description: 'A festival draws visitors',                effects: { prosperity: 3, stability: 2, unrest: -2 } },
  { type: 'fire',              magnitude: 2, description: 'Fire breaks out in the district',          effects: { prosperity: -5, stability: -3, unrest: 5, population: -0.01 } },
  { type: 'plague',            magnitude: 3, description: 'Sickness spreads through the settlement',  effects: { prosperity: -8, stability: -5, unrest: 10, population: -0.03 } },
  { type: 'trade_boom',        magnitude: 1, description: 'A trade caravan brings rare goods',        effects: { prosperity: 5, tradeModifier: 0.05 } },
  { type: 'crime_wave',        magnitude: 2, description: 'Thieves guild activity surges',           effects: { stability: -8, unrest: 8, prosperity: -3 } },
  { type: 'harvest',           magnitude: 1, description: 'Bountiful harvest this season',           effects: { prosperity: 4, stability: 2, population: 0.005 } },
  { type: 'refugee',           magnitude: 2, description: 'Refugees arrive seeking shelter',         effects: { population: 0.02, stability: -4, unrest: 5, prosperity: -2 } },
  { type: 'expansion',         magnitude: 1, description: 'New construction expands the settlement', effects: { population: 0.01, prosperity: 3 } },
  { type: 'riot',              magnitude: 3, description: 'Civil unrest erupts into riots',          effects: { stability: -15, unrest: 20, prosperity: -10 } },
  { type: 'miracle',           magnitude: 1, description: 'A divine blessing aids the people',       effects: { stability: 10, unrest: -10, prosperity: 5 } },
  // New system events
  { type: 'flood',             magnitude: 3, description: 'Floodwaters surge through low districts',  effects: { prosperity: -10, stability: -5, unrest: 8, population: -0.02 } },
  { type: 'famine',            magnitude: 3, description: 'Stored grain runs out, hunger spreads',    effects: { prosperity: -12, stability: -8, unrest: 15, population: -0.04 } },
  { type: 'cultural_festival', magnitude: 1, description: 'A grand performance captivates the city',  effects: { prosperity: 2, stability: 5, unrest: -5 } },
  { type: 'religious_schism',  magnitude: 2, description: 'Rival temples clash over doctrine',        effects: { stability: -6, unrest: 10 } },
  { type: 'bank_run',          magnitude: 2, description: 'Depositors panic and demand withdrawals',  effects: { prosperity: -8, stability: -4, unrest: 12 } },
]

// ============================================================
// MM_SETTLEMENT — The concrete implementation
// ============================================================

export class MMSettlement extends SimulatedMMBase {
  domain: SettlementState
  private eventPool: MFPool<number>  // pool of seeded random event rolls [0-1)
  private seedBase: number

  constructor(
    id: string,
    name: string,
    nodeId: string,
    initialState: SettlementState,
    worldDay: number = 0,
  ) {
    super(id, name, nodeId, 'settlement', worldDay)
    this.domain = { ...initialState }

    // Deterministic seed from settlement id + world day
    this.seedBase = hashString(id)

    // Create event roll pool — 200 seeded random numbers
    const eventConfig: PoolConfig = {
      id: `events_${id}`,
      type: 'event_roll',
      capacity: 200,
      ownerId: id,
    }
    this.eventPool = new MFPool<number>(eventConfig, worldDay)
    const rng = mulberry32(this.seedBase + worldDay)
    this.eventPool.grind(
      (count) => Array.from({ length: count }, () => rng()),
      200,
      worldDay,
    )
  }

  // ──────────────────────────────
  // ACCUMULATE — O(1), runs every tick
  // ──────────────────────────────

  protected onAccumulate(days: number, worldDay: number, _tp?: import('./tp.js').TP): void {
    const rates = RATES[this.domain.size]
    const weeks = days / 7

    // Linear delta accumulation — just rates × time
    const deltas = this.state.pendingPotential.deltas
    deltas.population = (deltas.population ?? 0) + rates.popGrowthPerWeek * weeks
    deltas.stability = (deltas.stability ?? 0) + rates.stabilityDrift * weeks
    deltas.prosperity = (deltas.prosperity ?? 0) + rates.prosperityDrift * weeks

    // Food security drifts toward 50 (natural balance)
    const foodDrift = (50 - this.domain.foodSecurity) * 0.01 * weeks
    deltas.foodSecurity = (deltas.foodSecurity ?? 0) + foodDrift

    // Cultural score drifts down without investment
    deltas.culturalScore = (deltas.culturalScore ?? 0) - 0.5 * weeks

    // Faith drifts slowly based on size (bigger = more diverse = less drift)
    const faithDrift = this.domain.size === 'hamlet' ? 0.2 : this.domain.size === 'village' ? 0.1 : 0
    deltas.faithLevel = (deltas.faithLevel ?? 0) + faithDrift * weeks

    // Pre-roll events into pending (using pool)
    const eventWeeks = Math.floor(weeks)
    for (let w = 0; w < eventWeeks; w++) {
      if (this.eventPool.isEmpty()) break
      const roll = this.eventPool.select()
      if (roll < rates.eventChancePerWeek) {
        // An event occurred — pick which one
        const eventIndex = Math.floor(roll * EVENT_TEMPLATES.length * (1 / rates.eventChancePerWeek)) % EVENT_TEMPLATES.length
        const template = EVENT_TEMPLATES[eventIndex]
        this.state.pendingPotential.pendingEvents.push({
          day: this.state.lastResolved + Math.floor((w + 1) * 7),
          type: template.type,
          magnitude: template.magnitude,
          description: template.description,
        })
      }
    }
  }

  // ──────────────────────────────
  // RESOLVE — O(n), runs ONLY on observation
  // ──────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, _tp?: import('./tp.js').TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const deltas = this.state.pendingPotential.deltas
    const events = this.state.pendingPotential.pendingEvents

    // Apply population change (percentage-based)
    const popDelta = deltas.population ?? 0
    const oldPop = this.domain.population
    let popChange = Math.round(this.domain.population * popDelta)

    // Apply event effects to domain
    for (const event of events) {
      const template = EVENT_TEMPLATES.find(t => t.type === event.type)
      if (template) {
        for (const [key, value] of Object.entries(template.effects)) {
          if (key === 'population') {
            popChange += Math.round(this.domain.population * value)
          } else if (key === 'tradeModifier') {
            this.domain.tradeModifier += value
          } else {
            (this.domain as any)[key] = Math.max(0, Math.min(100, ((this.domain as any)[key] ?? 0) + value))
          }
        }
      }
    }

    // Apply accumulated deltas
    this.domain.population = Math.max(1, this.domain.population + popChange)
    this.domain.stability = Math.max(0, Math.min(100, this.domain.stability + (deltas.stability ?? 0)))
    this.domain.prosperity = Math.max(0, Math.min(100, this.domain.prosperity + (deltas.prosperity ?? 0)))

    // Unrest rises with low stability
    if (this.domain.stability < 30) {
      this.domain.unrest = Math.min(100, this.domain.unrest + daysResolved * 0.5)
    } else if (this.domain.stability > 70) {
      this.domain.unrest = Math.max(0, this.domain.unrest - daysResolved * 0.2)
    }

    // Food insecurity drives unrest
    if (this.domain.foodSecurity < 20) {
      this.domain.unrest = Math.min(100, this.domain.unrest + daysResolved * 0.3)
    }

    // Cultural score suppresses unrest
    if (this.domain.culturalScore > 60) {
      this.domain.unrest = Math.max(0, this.domain.unrest - daysResolved * 0.1)
    }

    // Faith level contributes to stability
    if (this.domain.faithLevel > 50) {
      this.domain.stability = Math.min(100, this.domain.stability + daysResolved * 0.05)
    }

    // Apply accumulated system deltas
    this.domain.foodSecurity = Math.max(0, Math.min(100, this.domain.foodSecurity + (deltas.foodSecurity ?? 0)))
    this.domain.culturalScore = Math.max(0, Math.min(100, this.domain.culturalScore + (deltas.culturalScore ?? 0)))
    this.domain.faithLevel = Math.max(0, Math.min(100, this.domain.faithLevel + (deltas.faithLevel ?? 0)))

    // Reclassify size
    this.domain.size = classifySize(this.domain.population)

    // Build narrative
    const parts: string[] = []
    if (popChange > 0) parts.push(`Population grew by ${popChange} to ${this.domain.population}`)
    if (popChange < 0) parts.push(`Population declined by ${Math.abs(popChange)} to ${this.domain.population}`)
    if (events.length > 0) parts.push(`${events.length} event(s) occurred: ${events.map(e => e.type).join(', ')}`)
    if (this.domain.unrest > 50) parts.push(`Unrest is dangerously high at ${Math.round(this.domain.unrest)}%`)
    const narrative = parts.length > 0
      ? `${this.state.name} (${daysResolved} days): ${parts.join('. ')}.`
      : `${this.state.name} (${daysResolved} days): All quiet.`

    return {
      stateChanges: {
        population: this.domain.population - oldPop,
        stability: deltas.stability ?? 0,
        prosperity: deltas.prosperity ?? 0,
        unrest: this.domain.unrest,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): SettlementState {
    return { ...this.domain }
  }

  // ──────────────────────────────
  // CONVENIENCE
  // ──────────────────────────────

  /** Refill the event pool on clockwork tick (seeded) */
  refillEventPool(worldDay: number): void {
    const rng = mulberry32(this.seedBase + worldDay)
    this.eventPool.refill(
      (count) => Array.from({ length: count }, () => rng()),
      worldDay,
    )
  }

  /** Get domain state */
  getDomain(): SettlementState {
    return { ...this.domain }
  }
}
