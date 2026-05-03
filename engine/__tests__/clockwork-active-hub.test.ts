/**
 * Clockwork active-hub gate tests (Pedro 2026-05-02).
 *
 * Verifies:
 *   - Default: gate disabled, all MMs tick (existing behavior preserved).
 *   - Gate enabled: hub-bound MMs (state.nodeId) tick only when their hub
 *     was observed within the activity window.
 *   - World-tree MMs (no nodeId) always tick.
 *   - observeNode auto-marks the hub as active.
 *   - Stale hubs prune correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Clockwork } from '../clockwork'
import { TP } from '../tp'
import { SimulatedMMBase } from '../mm-simulated'

function buildEmptyTp(): TP {
  return new TP()
}

class StubMM extends SimulatedMMBase {
  public ticks = 0
  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    this.ticks++
  }
  protected onResolve(_daysResolved: number, _worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: never[]
  } {
    return { stateChanges: {}, narrative: '', additionalEvents: [] }
  }
  protected getDomainState(): unknown {
    return {}
  }
}

function makeMM(id: string, nodeId: string = ''): StubMM {
  // SimulatedMMBase ctor: (id, name, nodeId, mmType, worldDay)
  // Use empty string for "world-tree" (no specific hub) MMs.
  return new StubMM(id, id, nodeId, 'stub', 0)
}

describe('Clockwork active-hub gate', () => {
  let cw: Clockwork
  let tp: TP

  beforeEach(() => {
    tp = buildEmptyTp()
    cw = new Clockwork(tp, 0)
  })

  it('default: gate disabled — all hub-bound MMs tick', () => {
    const mm = makeMM('mm-suzail', 'suzail')
    cw.register(mm, 6, 'daily')
    cw.dailyTick()
    expect(mm.ticks).toBe(1)
    expect(cw.isActiveHubGateEnabled()).toBe(false)
  })

  it('gate enabled: hub-bound MMs do NOT tick when hub never observed', () => {
    cw.setActiveHubGate(true)
    const mm = makeMM('mm-suzail', 'suzail')
    cw.register(mm, 6, 'daily')
    cw.dailyTick()
    expect(mm.ticks).toBe(0)
  })

  it('gate enabled: hub-bound MMs tick after hub is observed', () => {
    cw.setActiveHubGate(true)
    cw.setActiveHubThreshold(1) // production default is 16 cumulative days; tests just want "any visit"
    const mm = makeMM('mm-suzail', 'suzail')
    cw.register(mm, 6, 'daily')
    cw.markHubActive('suzail')
    cw.dailyTick()
    expect(mm.ticks).toBe(1)
  })

  it('gate enabled: world-tree MMs (no nodeId) always tick', () => {
    cw.setActiveHubGate(true)
    const mm = makeMM('world-economy') // no nodeId
    cw.register(mm, 2, 'daily')
    cw.dailyTick()
    expect(mm.ticks).toBe(1)
  })

  it('observeNode auto-marks the hub active', () => {
    cw.setActiveHubGate(true)
    cw.setActiveHubThreshold(1)
    const mm = makeMM('mm-suzail', 'suzail')
    cw.register(mm, 6, 'daily')
    cw.observeNode('suzail')
    expect(cw.isHubActive('suzail')).toBe(true)
    cw.dailyTick()
    expect(mm.ticks).toBe(1)
  })

  it('hub becomes inactive after window expires', () => {
    cw.setActiveHubGate(true)
    cw.markHubActive('suzail', 0)
    // Crank past the 30-day window
    cw.crankTo(35)
    expect(cw.isHubActive('suzail', 30)).toBe(false)
  })

  it('getActiveHubs lists hubs within window', () => {
    cw.setActiveHubGate(true)
    cw.setActiveHubThreshold(1)
    cw.markHubActive('suzail', 0)
    cw.markHubActive('marsember', 25)
    cw.crankTo(30)
    const active = cw.getActiveHubs(30)
    expect(active).toContain('suzail') // observed day 0, current 30 → within window
    expect(active).toContain('marsember') // observed day 25, current 30 → within window
  })

  it('production threshold of 16 requires cumulative presence', () => {
    cw.setActiveHubGate(true)
    // Default threshold is 16. Single observation should NOT activate the hub.
    cw.markHubActive('suzail', 0)
    expect(cw.isHubActive('suzail')).toBe(false)
    // Seed 16 distinct visit days within the window.
    for (let d = 1; d <= 16; d++) cw.markHubActive('suzail', d)
    expect(cw.isHubActive('suzail')).toBe(true)
  })

  it('pruneStaleHubs removes hubs older than threshold', () => {
    cw.markHubActive('suzail', 0)
    cw.markHubActive('marsember', 100)
    cw.crankTo(500) // way past
    const removed = cw.pruneStaleHubs(365)
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(cw.isHubActive('suzail', 1000)).toBe(false) // pruned
  })
})
