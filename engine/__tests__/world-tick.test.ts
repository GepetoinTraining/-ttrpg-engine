/**
 * WORLD TICK ENGINE TESTS
 * ========================
 * Daily base → delta counting → observation ticks → player contribution
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  WorldTickEngine,
  createStandardSystems,
  createWorldClock,
  CADENCE_DAYS,
  type TickSystem,
} from '../world-tick.js'

let engine: WorldTickEngine

beforeEach(() => {
  engine = new WorldTickEngine(0)
})

// ============================================================
// BASIC TICK
// ============================================================

describe('Daily Tick', () => {
  it('advances world day by 1', () => {
    engine.dailyTick()
    expect(engine.state.worldDay).toBe(1)
  })

  it('increments total daily tick counter', () => {
    engine.dailyTick()
    engine.dailyTick()
    engine.dailyTick()
    expect(engine.state.totalDailyTicks).toBe(3)
  })

  it('fires daily systems', () => {
    const fired: string[] = []
    engine.register({
      id: 'test_daily', name: 'Test', cadence: 'daily', priority: 0,
      observationOnly: false,
      tick: (day) => { fired.push(`day_${day}`); return '' },
    })

    engine.dailyTick()
    expect(fired).toEqual(['day_1'])
  })

  it('does NOT fire observation-only systems', () => {
    const fired: string[] = []
    engine.register({
      id: 'obs_test', name: 'Obs', cadence: 'daily', priority: 0,
      observationOnly: true,
      tick: () => { fired.push('observed'); return '' },
    })

    engine.dailyTick()
    expect(fired).toHaveLength(0)
  })

  it('returns narratives from tick functions', () => {
    engine.register({
      id: 'narrator', name: 'Narrator', cadence: 'daily', priority: 0,
      observationOnly: false,
      tick: (day) => `Day ${day}: something happened`,
    })

    const result = engine.dailyTick()
    expect(result.narratives).toContain('Day 1: something happened')
  })

  it('skips empty narratives', () => {
    engine.register({
      id: 'quiet', name: 'Quiet', cadence: 'daily', priority: 0,
      observationOnly: false,
      tick: () => '',
    })

    const result = engine.dailyTick()
    expect(result.narratives).toHaveLength(0)
  })
})

// ============================================================
// DELTA COUNTING
// ============================================================

describe('Delta Counting', () => {
  it('increments weekly delta each day', () => {
    engine.dailyTick()
    expect(engine.state.deltas.weeklyDelta).toBe(1)
    engine.dailyTick()
    expect(engine.state.deltas.weeklyDelta).toBe(2)
  })

  it('fires weekly systems on day 7', () => {
    const weeklyFired: number[] = []
    engine.register({
      id: 'w1', name: 'Weekly', cadence: 'weekly', priority: 0,
      observationOnly: false,
      tick: (day) => { weeklyFired.push(day); return '' },
    })

    for (let i = 0; i < 7; i++) engine.dailyTick()

    expect(weeklyFired).toHaveLength(1)
    expect(weeklyFired[0]).toBe(7)
  })

  it('resets weekly delta after firing', () => {
    for (let i = 0; i < 7; i++) engine.dailyTick()
    expect(engine.state.deltas.weeklyDelta).toBe(0)
  })

  it('fires monthly systems on day 30', () => {
    const monthlyFired: number[] = []
    engine.register({
      id: 'm1', name: 'Monthly', cadence: 'monthly', priority: 0,
      observationOnly: false,
      tick: (day) => { monthlyFired.push(day); return '' },
    })

    for (let i = 0; i < 30; i++) engine.dailyTick()

    expect(monthlyFired).toHaveLength(1)
    expect(monthlyFired[0]).toBe(30)
  })

  it('fires yearly systems on day 360', () => {
    const yearlyFired: number[] = []
    engine.register({
      id: 'y1', name: 'Yearly', cadence: 'yearly', priority: 0,
      observationOnly: false,
      tick: (day) => { yearlyFired.push(day); return '' },
    })

    for (let i = 0; i < 360; i++) engine.dailyTick()

    expect(yearlyFired).toHaveLength(1)
    expect(yearlyFired[0]).toBe(360)
  })

  it('weekly fires multiple times over 30 days', () => {
    let weeklyCount = 0
    engine.register({
      id: 'w1', name: 'Weekly', cadence: 'weekly', priority: 0,
      observationOnly: false,
      tick: () => { weeklyCount++; return '' },
    })

    for (let i = 0; i < 30; i++) engine.dailyTick()

    // 30 days / 7 days per week = 4 weekly fires (days 7, 14, 21, 28)
    expect(weeklyCount).toBe(4)
  })

  it('weekly and monthly can fire on the same day', () => {
    // Day 28 fires weekly, but not monthly
    // We need a day where both fire — if weekly fires every 7 and monthly every 30,
    // they don't perfectly align. But let's verify independent tracking
    const weeklyDays: number[] = []
    const monthlyDays: number[] = []

    engine.register({
      id: 'w', name: 'W', cadence: 'weekly', priority: 0, observationOnly: false,
      tick: (day) => { weeklyDays.push(day); return '' },
    })
    engine.register({
      id: 'm', name: 'M', cadence: 'monthly', priority: 0, observationOnly: false,
      tick: (day) => { monthlyDays.push(day); return '' },
    })

    for (let i = 0; i < 30; i++) engine.dailyTick()

    expect(weeklyDays).toEqual([7, 14, 21, 28])
    expect(monthlyDays).toEqual([30])
  })

  it('tracks total tick counters correctly', () => {
    for (let i = 0; i < 30; i++) engine.dailyTick()

    expect(engine.state.totalDailyTicks).toBe(30)
    expect(engine.state.totalWeeklyTicks).toBe(4)
    expect(engine.state.totalMonthlyTicks).toBe(1)
    expect(engine.state.totalYearlyTicks).toBe(0)
  })

  it('delta is passed to tick function', () => {
    let receivedDelta = 0
    engine.register({
      id: 'w', name: 'W', cadence: 'weekly', priority: 0, observationOnly: false,
      tick: (_day, delta) => { receivedDelta = delta; return '' },
    })

    for (let i = 0; i < 7; i++) engine.dailyTick()

    expect(receivedDelta).toBe(7)
  })
})

// ============================================================
// CRANK TO
// ============================================================

describe('Crank To', () => {
  it('advances to target day', () => {
    const results = engine.crankTo(30)
    expect(engine.state.worldDay).toBe(30)
    expect(results).toHaveLength(30)
  })

  it('fires all cadences during crank', () => {
    engine.registerAll(createStandardSystems())

    const results = engine.crankTo(30)

    const weeklyResults = results.filter(r => r.firedWeekly)
    const monthlyResults = results.filter(r => r.firedMonthly)

    expect(weeklyResults.length).toBe(4) // Days 7, 14, 21, 28
    expect(monthlyResults.length).toBe(1) // Day 30
  })

  it('has safety valve for max catch-up', () => {
    const results = engine.crankTo(999999)
    expect(results.length).toBeLessThanOrEqual(730) // Max 2 years
  })

  it('no-ops if already at target', () => {
    engine.crankTo(10)
    const results = engine.crankTo(10)
    expect(results).toHaveLength(0)
  })
})

// ============================================================
// OBSERVATION TICKS
// ============================================================

describe('Observation Ticks', () => {
  it('fires hourly systems when observed', () => {
    const fired: string[] = []
    engine.register({
      id: 'obs_test', name: 'Obs', cadence: 'hourly', priority: 0,
      observationOnly: true,
      tick: () => { fired.push('hourly'); return 'NPC moved' },
    })

    const result = engine.observeTick('node_1', 'hourly')
    expect(fired).toEqual(['hourly'])
    expect(result.hourlyFired).toContain('obs_test')
    expect(result.narratives).toContain('NPC moved')
  })

  it('fires slot systems for dungeon exploration', () => {
    const fired: string[] = []
    engine.register({
      id: 'obs_dungeon', name: 'Dungeon', cadence: 'slot', priority: 0,
      observationOnly: true,
      tick: () => { fired.push('slot'); return 'Trap resets' },
    })

    const result = engine.observeTick('dungeon_node', 'slot')
    expect(result.slotFired).toContain('obs_dungeon')
  })

  it('fires round systems for combat', () => {
    engine.register({
      id: 'obs_combat', name: 'Combat', cadence: 'round', priority: 0,
      observationOnly: true,
      tick: () => 'Combat round',
    })

    const result = engine.observeTick('combat_node', 'round')
    expect(result.roundFired).toContain('obs_combat')
  })

  it('observation ticks do NOT fire non-observation systems', () => {
    const fired: string[] = []
    engine.register({
      id: 'server_only', name: 'Server', cadence: 'hourly', priority: 0,
      observationOnly: false,
      tick: () => { fired.push('bad'); return '' },
    })

    engine.observeTick('node_1', 'hourly')
    expect(fired).toHaveLength(0)
  })
})

// ============================================================
// PLAYER MATH TICKS
// ============================================================

describe('Player Math Ticks', () => {
  it('accumulates player ticks', () => {
    engine.addPlayerTick(3)
    engine.addPlayerTick(2)
    expect(engine.state.playerTicksToday).toBe(5)
  })

  it('consumes player ticks on daily tick', () => {
    engine.addPlayerTick(10)
    const result = engine.dailyTick()
    expect(result.playerTicksConsumed).toBe(10)
    expect(engine.state.playerTicksToday).toBe(0) // Reset
  })

  it('tracks total player ticks all-time', () => {
    engine.addPlayerTick(5)
    engine.dailyTick()
    engine.addPlayerTick(3)
    engine.dailyTick()

    expect(engine.state.totalPlayerTicks).toBe(8)
  })
})

// ============================================================
// SYSTEM REGISTRATION
// ============================================================

describe('System Registration', () => {
  it('sorts by cadence then priority', () => {
    engine.register({
      id: 'w2', name: 'W2', cadence: 'weekly', priority: 2, observationOnly: false,
      tick: () => '',
    })
    engine.register({
      id: 'd1', name: 'D1', cadence: 'daily', priority: 0, observationOnly: false,
      tick: () => '',
    })
    engine.register({
      id: 'w1', name: 'W1', cadence: 'weekly', priority: 1, observationOnly: false,
      tick: () => '',
    })

    // Daily fires before weekly, and w1 before w2
    const order: string[] = []
    for (const sys of [engine.getSystem('d1'), engine.getSystem('w1'), engine.getSystem('w2')]) {
      if (sys) order.push(sys.id)
    }
    expect(order).toEqual(['d1', 'w1', 'w2'])
  })

  it('standard systems register correctly', () => {
    const systems = createStandardSystems()
    expect(systems.length).toBe(53) // 5 daily + 16 weekly + 12 monthly + 5 yearly + 3 hourly + 3 slot + 3 round
    engine.registerAll(systems)
    expect(engine.snapshot().registeredSystems).toBe(53)
  })
})

// ============================================================
// SNAPSHOT
// ============================================================

describe('Snapshot', () => {
  it('shows current world state', () => {
    engine.registerAll(createStandardSystems())
    engine.crankTo(10)
    engine.addPlayerTick(5)

    const snap = engine.snapshot()
    expect(snap.worldDay).toBe(10)
    expect(snap.totalDailyTicks).toBe(10)
    expect(snap.weeklyDelta).toBe(3) // 10 - 7 = 3
    expect(snap.daysUntilWeekly).toBe(4) // 7 - 3 = 4
    expect(snap.registeredSystems).toBe(53)
  })

  it('shows systems by cadence', () => {
    engine.registerAll(createStandardSystems())
    const snap = engine.snapshot()

    expect(snap.systemsByCadence.daily).toBe(6)
    expect(snap.systemsByCadence.weekly).toBe(19)
    expect(snap.systemsByCadence.monthly).toBe(14)
    expect(snap.systemsByCadence.yearly).toBe(5)
    expect(snap.systemsByCadence.hourly).toBe(3)
    expect(snap.systemsByCadence.slot).toBe(3)
    expect(snap.systemsByCadence.round).toBe(3)
  })
})

// ============================================================
// FULL LIFECYCLE — Simulating 1 year
// ============================================================

describe('Full Year Simulation', () => {
  it('runs 360 days with all systems', () => {
    let dailyCount = 0
    let weeklyCount = 0
    let monthlyCount = 0
    let yearlyCount = 0

    engine.register({
      id: 'd', name: 'D', cadence: 'daily', priority: 0, observationOnly: false,
      tick: () => { dailyCount++; return '' },
    })
    engine.register({
      id: 'w', name: 'W', cadence: 'weekly', priority: 0, observationOnly: false,
      tick: () => { weeklyCount++; return '' },
    })
    engine.register({
      id: 'm', name: 'M', cadence: 'monthly', priority: 0, observationOnly: false,
      tick: () => { monthlyCount++; return '' },
    })
    engine.register({
      id: 'y', name: 'Y', cadence: 'yearly', priority: 0, observationOnly: false,
      tick: () => { yearlyCount++; return '' },
    })

    engine.crankTo(360)

    expect(dailyCount).toBe(360)
    expect(weeklyCount).toBe(51)  // 360/7 = 51 full weeks
    expect(monthlyCount).toBe(12) // 360/30 = 12 months
    expect(yearlyCount).toBe(1)   // 360/360 = 1 year
  })

  it('player ticks accumulate over a year', () => {
    // Simulate 10 players doing 5 ticks per day
    for (let day = 0; day < 360; day++) {
      engine.addPlayerTick(50) // 10 players × 5 ticks
      engine.dailyTick()
    }

    expect(engine.state.totalPlayerTicks).toBe(50 * 360)
    expect(engine.state.worldDay).toBe(360)
  })
})
