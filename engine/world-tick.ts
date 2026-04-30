/**
 * WORLD TICK — The Unified Heartbeat
 * =====================================
 * 
 * BASE TICK: Daily. Runs server-side. Non-negotiable.
 * 
 * Bigger ticks count DOWN a delta from the daily tick:
 *   Day 1: daily ✓  weekly: 6 remaining  monthly: 29 remaining
 *   Day 2: daily ✓  weekly: 5 remaining  monthly: 28 remaining
 *   ...
 *   Day 7: daily ✓  weekly: FIRE! ✓     monthly: 23 remaining
 *   ...
 *   Day 30: daily ✓  weekly: FIRE! ✓    monthly: FIRE! ✓
 * 
 * Smaller ticks only fire when OBSERVED (player at location):
 *   Player enters hub → hourly ticks fire for that hub
 *   Player enters combat → round-level ticks fire
 *   Player enters dungeon → slot-level ticks fire
 * 
 * Player ticks ADD to the global pool:
 *   When a player does a math tick (rolls, checks, actions),
 *   their tick contributes to the settlement's daily tick
 *   (economy, NPC schedules, danger accumulation).
 * 
 * The world runs WITHOUT players. Players ACCELERATE it.
 * 
 *            ┌─────────────────────────────────┐
 *            │         WORLD CLOCK             │
 *            │   (server-side, autonomous)     │
 *            ├─────────────────────────────────┤
 *            │                                 │
 *  DAILY ──────→ weather, NPC schedules,       │
 *            │   danger accumulation,          │
 *            │   MF pool refills               │
 *            │                                 │
 *  WEEKLY ─────→ economy (prices, trade),      │
 *            │   logistics (shipments),        │
 *            │   production (workshops),       │
 *            │   settlement events             │
 *            │                                 │
 *  MONTHLY ────→ faction schemes,              │
 *            │   infrastructure evolution,     │
 *            │   knowledge pool tick,          │
 *            │   guild formation,              │
 *            │   ecology (spawner drift),      │
 *            │   population growth             │
 *            │                                 │
 *  YEARLY ─────→ seasons, great events,        │
 *            │   kingdom-level politics,       │
 *            │   tier advancement              │
 *            │                                 │
 *            └─────────────────────────────────┘
 *            ┌─────────────────────────────────┐
 *            │       OBSERVATION TICKS         │
 *            │  (fire when player is present)  │
 *            ├─────────────────────────────────┤
 *            │                                 │
 *  HOURLY ─────→ NPC movement, market prices,  │
 *            │   encounter checks              │
 *            │                                 │
 *  SLOT ───────→ exploration, dungeon state,   │
 *  (5 min)   │   trap resets, lair actions     │
 *            │                                 │
 *  ROUND ──────→ combat, conditions, spells    │
 *  (6 sec)   │                                 │
 *            └─────────────────────────────────┘
 */

// ============================================================
// TICK CADENCES
// ============================================================

export type TickCadence = 'round' | 'slot' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

/** How many daily ticks between each cadence firing */
export const CADENCE_DAYS: Record<TickCadence, number> = {
  round:   0,     // Only on observation
  slot:    0,     // Only on observation
  hourly:  0,     // Only on observation
  daily:   1,
  weekly:  7,
  monthly: 30,
  yearly:  360,   // Fantasy calendar
}

// ============================================================
// SYSTEM REGISTRATION — What fires at each cadence
// ============================================================

export interface TickSystem {
  id: string
  name: string
  cadence: TickCadence
  /** 0 = first, higher = later (dependency ordering within cadence) */
  priority: number
  /** Does this system require player observation to fire? */
  observationOnly: boolean
  /**
   * The tick function. Receives world day and delta (how many days of
   * this cadence have accumulated). Returns a summary string.
   */
  tick: (worldDay: number, delta: number) => string
}

// ============================================================
// DELTA TRACKER — Counting down to next fire
// ============================================================

export interface DeltaState {
  /** Days accumulated since last fire for each cadence */
  weeklyDelta: number
  monthlyDelta: number
  yearlyDelta: number
}

// ============================================================
// WORLD CLOCK — The master state
// ============================================================

export interface WorldClockState {
  /** Current world day (0 = campaign start) */
  worldDay: number
  /** Delta counters */
  deltas: DeltaState
  /** Total daily ticks ever run */
  totalDailyTicks: number
  /** Total weekly ticks ever fired */
  totalWeeklyTicks: number
  /** Total monthly ticks ever fired */
  totalMonthlyTicks: number
  /** Total yearly ticks ever fired */
  totalYearlyTicks: number
  /** Player math ticks contributed this day */
  playerTicksToday: number
  /** Total player ticks contributed all-time */
  totalPlayerTicks: number
}

export function createWorldClock(startDay: number = 0): WorldClockState {
  return {
    worldDay: startDay,
    deltas: { weeklyDelta: 0, monthlyDelta: 0, yearlyDelta: 0 },
    totalDailyTicks: 0,
    totalWeeklyTicks: 0,
    totalMonthlyTicks: 0,
    totalYearlyTicks: 0,
    playerTicksToday: 0,
    totalPlayerTicks: 0,
  }
}

// ============================================================
// WORLD TICK ENGINE
// ============================================================

export interface DailyTickResult {
  worldDay: number
  dailySystems: string[]
  weeklySystems: string[]
  monthlySystems: string[]
  yearlySystems: string[]
  firedWeekly: boolean
  firedMonthly: boolean
  firedYearly: boolean
  playerTicksConsumed: number
  narratives: string[]
}

export interface ObservationTickResult {
  nodeId: string
  worldDay: number
  hourlyFired: string[]
  slotFired: string[]
  roundFired: string[]
  narratives: string[]
}

export class WorldTickEngine {
  private systems: TickSystem[] = []
  state: WorldClockState

  constructor(startDay: number = 0) {
    this.state = createWorldClock(startDay)
  }

  // ── Registration ──

  register(system: TickSystem): void {
    this.systems.push(system)
    // Sort by cadence weight then priority
    this.systems.sort((a, b) => {
      const cadenceOrder: TickCadence[] = ['daily', 'weekly', 'monthly', 'yearly', 'hourly', 'slot', 'round']
      const ai = cadenceOrder.indexOf(a.cadence)
      const bi = cadenceOrder.indexOf(b.cadence)
      if (ai !== bi) return ai - bi
      return a.priority - b.priority
    })
  }

  registerAll(systems: TickSystem[]): void {
    for (const s of systems) this.register(s)
  }

  getSystem(id: string): TickSystem | undefined {
    return this.systems.find(s => s.id === id)
  }

  // ── Daily Tick (server-side) ──

  /**
   * Execute one daily tick. This is the base heartbeat.
   * 
   * 1. Fire all DAILY systems
   * 2. Increment deltas for weekly/monthly/yearly
   * 3. If a delta threshold is reached, fire those systems
   * 4. Consume player ticks accumulated today → add bonus
   * 5. Reset daily player tick counter
   */
  dailyTick(): DailyTickResult {
    this.state.worldDay++
    this.state.totalDailyTicks++

    const result: DailyTickResult = {
      worldDay: this.state.worldDay,
      dailySystems: [],
      weeklySystems: [],
      monthlySystems: [],
      yearlySystems: [],
      firedWeekly: false,
      firedMonthly: false,
      firedYearly: false,
      playerTicksConsumed: this.state.playerTicksToday,
      narratives: [],
    }

    // ── Phase 1: Fire DAILY systems ──
    for (const sys of this.systems) {
      if (sys.cadence !== 'daily' || sys.observationOnly) continue
      const narrative = sys.tick(this.state.worldDay, 1)
      result.dailySystems.push(sys.id)
      if (narrative) result.narratives.push(narrative)
    }

    // ── Phase 2: Increment deltas ──
    this.state.deltas.weeklyDelta++
    this.state.deltas.monthlyDelta++
    this.state.deltas.yearlyDelta++

    // ── Phase 3: Check & fire bigger cadences ──

    // Weekly
    if (this.state.deltas.weeklyDelta >= CADENCE_DAYS.weekly) {
      const delta = this.state.deltas.weeklyDelta
      this.state.deltas.weeklyDelta = 0
      this.state.totalWeeklyTicks++
      result.firedWeekly = true

      for (const sys of this.systems) {
        if (sys.cadence !== 'weekly' || sys.observationOnly) continue
        const narrative = sys.tick(this.state.worldDay, delta)
        result.weeklySystems.push(sys.id)
        if (narrative) result.narratives.push(narrative)
      }
    }

    // Monthly
    if (this.state.deltas.monthlyDelta >= CADENCE_DAYS.monthly) {
      const delta = this.state.deltas.monthlyDelta
      this.state.deltas.monthlyDelta = 0
      this.state.totalMonthlyTicks++
      result.firedMonthly = true

      for (const sys of this.systems) {
        if (sys.cadence !== 'monthly' || sys.observationOnly) continue
        const narrative = sys.tick(this.state.worldDay, delta)
        result.monthlySystems.push(sys.id)
        if (narrative) result.narratives.push(narrative)
      }
    }

    // Yearly
    if (this.state.deltas.yearlyDelta >= CADENCE_DAYS.yearly) {
      const delta = this.state.deltas.yearlyDelta
      this.state.deltas.yearlyDelta = 0
      this.state.totalYearlyTicks++
      result.firedYearly = true

      for (const sys of this.systems) {
        if (sys.cadence !== 'yearly' || sys.observationOnly) continue
        const narrative = sys.tick(this.state.worldDay, delta)
        result.yearlySystems.push(sys.id)
        if (narrative) result.narratives.push(narrative)
      }
    }

    // ── Phase 4: Consume player ticks ──
    // Player ticks add bonus to daily systems (future: affects accumulation speed)
    this.state.totalPlayerTicks += this.state.playerTicksToday
    this.state.playerTicksToday = 0

    return result
  }

  // ── Crank — Catch up multiple days ──

  /**
   * Advance the world clock to a target day.
   * Runs daily ticks sequentially, firing weekly/monthly as deltas fill.
   */
  crankTo(targetDay: number): DailyTickResult[] {
    const results: DailyTickResult[] = []
    const maxTicks = 365 * 2  // Safety: max 2 years catch-up

    let ticks = 0
    while (this.state.worldDay < targetDay && ticks < maxTicks) {
      results.push(this.dailyTick())
      ticks++
    }

    return results
  }

  // ── Observation Ticks (player-triggered) ──

  /**
   * Fire observation-level ticks for a specific node.
   * Called when a player enters or acts in a location.
   * 
   * These are the SMALL ticks: hourly, slot, round.
   * They only fire when someone is watching.
   */
  observeTick(
    nodeId: string,
    cadence: 'hourly' | 'slot' | 'round',
    delta: number = 1,
  ): ObservationTickResult {
    const result: ObservationTickResult = {
      nodeId,
      worldDay: this.state.worldDay,
      hourlyFired: [],
      slotFired: [],
      roundFired: [],
      narratives: [],
    }

    const targetList = cadence === 'hourly' ? result.hourlyFired
      : cadence === 'slot' ? result.slotFired
      : result.roundFired

    for (const sys of this.systems) {
      if (sys.cadence !== cadence || !sys.observationOnly) continue
      const narrative = sys.tick(this.state.worldDay, delta)
      targetList.push(sys.id)
      if (narrative) result.narratives.push(narrative)
    }

    return result
  }

  // ── Player Math Tick (contributes to global pool) ──

  /**
   * A player performed a math tick (roll, check, action).
   * This contributes to the settlement's daily tick pool.
   * 
   * The more players play, the faster the world advances.
   * Solo player? World still ticks daily.
   * 20 players active? World gets richer detail.
   */
  addPlayerTick(count: number = 1): void {
    this.state.playerTicksToday += count
  }

  // ── Snapshot ──

  snapshot(): WorldClockSnapshot {
    return {
      worldDay: this.state.worldDay,
      weeklyDelta: this.state.deltas.weeklyDelta,
      monthlyDelta: this.state.deltas.monthlyDelta,
      yearlyDelta: this.state.deltas.yearlyDelta,
      daysUntilWeekly: CADENCE_DAYS.weekly - this.state.deltas.weeklyDelta,
      daysUntilMonthly: CADENCE_DAYS.monthly - this.state.deltas.monthlyDelta,
      daysUntilYearly: CADENCE_DAYS.yearly - this.state.deltas.yearlyDelta,
      totalDailyTicks: this.state.totalDailyTicks,
      totalWeeklyTicks: this.state.totalWeeklyTicks,
      totalMonthlyTicks: this.state.totalMonthlyTicks,
      totalYearlyTicks: this.state.totalYearlyTicks,
      totalPlayerTicks: this.state.totalPlayerTicks,
      registeredSystems: this.systems.length,
      systemsByCadence: {
        daily: this.systems.filter(s => s.cadence === 'daily' && !s.observationOnly).length,
        weekly: this.systems.filter(s => s.cadence === 'weekly').length,
        monthly: this.systems.filter(s => s.cadence === 'monthly').length,
        yearly: this.systems.filter(s => s.cadence === 'yearly').length,
        hourly: this.systems.filter(s => s.cadence === 'hourly').length,
        slot: this.systems.filter(s => s.cadence === 'slot').length,
        round: this.systems.filter(s => s.cadence === 'round').length,
      },
    }
  }
}

export interface WorldClockSnapshot {
  worldDay: number
  weeklyDelta: number
  monthlyDelta: number
  yearlyDelta: number
  daysUntilWeekly: number
  daysUntilMonthly: number
  daysUntilYearly: number
  totalDailyTicks: number
  totalWeeklyTicks: number
  totalMonthlyTicks: number
  totalYearlyTicks: number
  totalPlayerTicks: number
  registeredSystems: number
  systemsByCadence: Record<TickCadence, number>
}

// ============================================================
// STANDARD SYSTEMS — What the world actually does each tick
// ============================================================

/**
 * Standard tick systems for a fully-wired world.
 * Each system represents a different engine module firing.
 * 
 * In production, these would call into the actual module's tick functions.
 * Here we define the registration entries with placeholder tick functions
 * that can be replaced with real implementations.
 */
export function createStandardSystems(): TickSystem[] {
  return [
    // ── DAILY ──
    {
      id: 'weather', name: 'Weather', cadence: 'daily', priority: 0,
      observationOnly: false,
      tick: (day) => `Day ${day}: weather updated`,
    },
    {
      id: 'npc_schedules', name: 'NPC Schedules', cadence: 'daily', priority: 1,
      observationOnly: false,
      tick: (day) => `Day ${day}: NPC schedules advanced`,
    },
    {
      id: 'danger_accumulation', name: 'Danger Accumulation', cadence: 'daily', priority: 2,
      observationOnly: false,
      tick: (day) => `Day ${day}: danger levels adjusted`,
    },
    {
      id: 'mf_pool_refill', name: 'MF Pool Refill', cadence: 'daily', priority: 3,
      observationOnly: false,
      tick: (day) => `Day ${day}: MF pools refilled`,
    },
    {
      id: 'rest_resolution', name: 'Rest Resolution', cadence: 'daily', priority: 4,
      observationOnly: false,
      tick: (day) => `Day ${day}: resting characters healed`,
    },
    {
      id: 'water_level_tick', name: 'Water: Level Update', cadence: 'daily', priority: 5,
      observationOnly: false,
      tick: (day) => `Day ${day}: water levels updated from weather, flood stages checked`,
    },

    // ── WEEKLY ──
    {
      id: 'economy_prices', name: 'Economy: Prices', cadence: 'weekly', priority: 0,
      observationOnly: false,
      tick: (day, delta) => `Day ${day}: prices updated (${delta}d accumulation)`,
    },
    {
      id: 'economy_trade', name: 'Economy: Trade Routes', cadence: 'weekly', priority: 1,
      observationOnly: false,
      tick: (day) => `Day ${day}: trade routes processed`,
    },
    {
      id: 'logistics', name: 'Logistics: Shipments', cadence: 'weekly', priority: 2,
      observationOnly: false,
      tick: (day) => `Day ${day}: shipments advanced`,
    },
    {
      id: 'production', name: 'Production: Workshops', cadence: 'weekly', priority: 3,
      observationOnly: false,
      tick: (day) => `Day ${day}: workshop production queues processed`,
    },
    {
      id: 'settlement_events', name: 'Settlement Events', cadence: 'weekly', priority: 4,
      observationOnly: false,
      tick: (day) => `Day ${day}: settlement events rolled`,
    },
    {
      id: 'npc_actor_schemes', name: 'NPC Actor Schemes', cadence: 'weekly', priority: 5,
      observationOnly: false,
      tick: (day) => `Day ${day}: NPC actors advance schemes`,
    },
    {
      id: 'exchange_rates', name: 'Currency: Exchange Rates', cadence: 'weekly', priority: 6,
      observationOnly: false,
      tick: (day) => `Day ${day}: exchange rates shifted by trade volume + trust`,
    },
    {
      id: 'banking_interest', name: 'Banking: Interest & Fees', cadence: 'weekly', priority: 7,
      observationOnly: false,
      tick: (day) => `Day ${day}: savings interest accrued, custody fees charged`,
    },
    {
      id: 'loan_payments', name: 'Banking: Loan Payments', cadence: 'weekly', priority: 8,
      observationOnly: false,
      tick: (day) => `Day ${day}: loan payments processed, defaults checked`,
    },
    {
      id: 'entertainment_revenue', name: 'Entertainment: Revenue', cadence: 'weekly', priority: 9,
      observationOnly: false,
      tick: (day) => `Day ${day}: performer revenue + reputation updated`,
    },
    {
      id: 'cultural_influence', name: 'Entertainment: Cultural Influence', cadence: 'weekly', priority: 10,
      observationOnly: false,
      tick: (day) => `Day ${day}: settlement morale κ from entertainment recalculated`,
    },
    {
      id: 'rumor_decay', name: 'Lore: Rumor Decay', cadence: 'weekly', priority: 11,
      observationOnly: false,
      tick: (day) => `Day ${day}: rumor fidelity decayed, forgotten rumors pruned`,
    },
    {
      id: 'knowledge_flow', name: 'Lore: Knowledge Flow', cadence: 'weekly', priority: 12,
      observationOnly: false,
      tick: (day) => `Day ${day}: books + rumors propagated along trade routes`,
    },
    {
      id: 'fishing_yield', name: 'Water: Fishing', cadence: 'weekly', priority: 13,
      observationOnly: false,
      tick: (day) => `Day ${day}: fishing yields harvested from water bodies`,
    },
    {
      id: 'services_contracts', name: 'Services: Contract Renewal', cadence: 'weekly', priority: 14,
      observationOnly: false,
      tick: (day) => `Day ${day}: service contracts renewed, expired contracts closed`,
    },
    {
      id: 'caravan_progress', name: 'Caravans: Progress & Encounters', cadence: 'weekly', priority: 15,
      observationOnly: false,
      tick: (day) => `Day ${day}: caravans advanced, encounters rolled`,
    },
    {
      id: 'harvest_tick', name: 'Agriculture: Harvest', cadence: 'weekly', priority: 16,
      observationOnly: false,
      tick: (day) => `Day ${day}: farm plots checked for harvest readiness`,
    },
    {
      id: 'gathering_tick', name: 'Agriculture: Gathering', cadence: 'weekly', priority: 17,
      observationOnly: false,
      tick: (day) => `Day ${day}: wild ingredients gathered by foragers`,
    },
    {
      id: 'extraction_output', name: 'Extraction: Industry Output', cadence: 'weekly', priority: 18,
      observationOnly: false,
      tick: (day) => `Day ${day}: logging, quarry, sand, potash sites produce`,
    },

    // ── MONTHLY ──
    {
      id: 'faction_schemes', name: 'Faction Schemes', cadence: 'monthly', priority: 0,
      observationOnly: false,
      tick: (day) => `Day ${day}: faction schemes advance`,
    },
    {
      id: 'infrastructure', name: 'Infrastructure Evolution', cadence: 'monthly', priority: 1,
      observationOnly: false,
      tick: (day) => `Day ${day}: infrastructure tick (knowledge→professions→guilds)`,
    },
    {
      id: 'ecology', name: 'Ecology: Spawner Drift', cadence: 'monthly', priority: 2,
      observationOnly: false,
      tick: (day) => `Day ${day}: monster populations adjusted`,
    },
    {
      id: 'population_growth', name: 'Population Growth', cadence: 'monthly', priority: 3,
      observationOnly: false,
      tick: (day) => `Day ${day}: settlement populations adjusted`,
    },
    {
      id: 'guild_operations', name: 'Guild Operations', cadence: 'monthly', priority: 4,
      observationOnly: false,
      tick: (day) => `Day ${day}: guild bulk orders, apprentice progress`,
    },
    {
      id: 'npc_needs', name: 'NPC Needs & Agendas', cadence: 'monthly', priority: 5,
      observationOnly: false,
      tick: (day) => `Day ${day}: NPC Maslow needs evaluated`,
    },
    {
      id: 'army_readiness', name: 'Warfare: Army Readiness', cadence: 'monthly', priority: 6,
      observationOnly: false,
      tick: (day) => `Day ${day}: army readiness decayed (-3%), morale adjusted`,
    },
    {
      id: 'influence_overlay', name: 'Warfare: Factional Influence', cadence: 'monthly', priority: 7,
      observationOnly: false,
      tick: (day) => `Day ${day}: factional influence overlay updated (decay + army projection)`,
    },
    {
      id: 'army_upkeep', name: 'Warfare: Army Upkeep', cadence: 'monthly', priority: 8,
      observationOnly: false,
      tick: (day) => `Day ${day}: army upkeep gold drain, underfunded penalties applied`,
    },
    {
      id: 'spy_reports', name: 'Espionage: Spy Reports', cadence: 'monthly', priority: 9,
      observationOnly: false,
      tick: (day) => `Day ${day}: active spy missions resolved`,
    },
    {
      id: 'diplomatic_drift', name: 'Diplomacy: Standing Drift', cadence: 'monthly', priority: 10,
      observationOnly: false,
      tick: (day) => `Day ${day}: diplomatic standings shifted (war/rivalry/alliance drift)`,
    },
    {
      id: 'research_progress', name: 'Lore: Research Progress', cadence: 'monthly', priority: 11,
      observationOnly: false,
      tick: (day) => `Day ${day}: NPC scholars make research attempts at libraries`,
    },
    {
      id: 'tax_in_kind', name: 'Agriculture: Tax-in-Kind', cadence: 'monthly', priority: 12,
      observationOnly: false,
      tick: (day) => `Day ${day}: grain tax collected → granary/army/market`,
    },
    {
      id: 'food_variety', name: 'Cooking: Food Variety', cadence: 'monthly', priority: 13,
      observationOnly: false,
      tick: (day) => `Day ${day}: settlement food variety + morale recalculated`,
    },

    // ── YEARLY ──
    {
      id: 'seasons', name: 'Season Change', cadence: 'yearly', priority: 0,
      observationOnly: false,
      tick: (day) => `Day ${day}: season changes, annual events`,
    },
    {
      id: 'kingdom_politics', name: 'Kingdom Politics', cadence: 'yearly', priority: 1,
      observationOnly: false,
      tick: (day) => `Day ${day}: kingdom-level political shifts`,
    },
    {
      id: 'great_events', name: 'Great Events', cadence: 'yearly', priority: 2,
      observationOnly: false,
      tick: (day) => `Day ${day}: great event check (wars, plagues, discoveries)`,
    },
    {
      id: 'faith_accrual', name: 'Religion: Faith Accrual', cadence: 'yearly', priority: 3,
      observationOnly: false,
      tick: (day) => `Day ${day}: clergy + temples → faith pool for each deity`,
    },
    {
      id: 'pantheon_tick', name: 'Religion: Pantheon Tick', cadence: 'yearly', priority: 4,
      observationOnly: false,
      tick: (day) => `Day ${day}: deity power tiers recalculated, dead god decay`,
    },

    // ── OBSERVATION: HOURLY ──
    {
      id: 'obs_npc_movement', name: 'NPC Movement', cadence: 'hourly', priority: 0,
      observationOnly: true,
      tick: () => 'NPCs moved to hourly positions',
    },
    {
      id: 'obs_market_update', name: 'Market Update', cadence: 'hourly', priority: 1,
      observationOnly: true,
      tick: () => 'Local market prices refreshed',
    },
    {
      id: 'obs_encounter_check', name: 'Encounter Check', cadence: 'hourly', priority: 2,
      observationOnly: true,
      tick: () => 'Random encounter check performed',
    },

    // ── OBSERVATION: SLOT (5 min) ──
    {
      id: 'obs_dungeon_state', name: 'Dungeon State', cadence: 'slot', priority: 0,
      observationOnly: true,
      tick: () => 'Dungeon state updated (traps, patrols)',
    },
    {
      id: 'obs_exploration', name: 'Exploration Tick', cadence: 'slot', priority: 1,
      observationOnly: true,
      tick: () => 'Exploration environment tick',
    },
    {
      id: 'obs_lair_actions', name: 'Lair Actions', cadence: 'slot', priority: 2,
      observationOnly: true,
      tick: () => 'Lair action recharge checked',
    },

    // ── OBSERVATION: ROUND (6 sec) ──
    {
      id: 'obs_combat', name: 'Combat Round', cadence: 'round', priority: 0,
      observationOnly: true,
      tick: () => 'Combat round processed',
    },
    {
      id: 'obs_conditions', name: 'Condition Tick', cadence: 'round', priority: 1,
      observationOnly: true,
      tick: () => 'Condition durations decremented',
    },
    {
      id: 'obs_concentration', name: 'Concentration Check', cadence: 'round', priority: 2,
      observationOnly: true,
      tick: () => 'Concentration spells checked',
    },
  ]
}
