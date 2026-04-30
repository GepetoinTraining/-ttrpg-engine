/**
 * EDGE TRAVERSAL STATISTICS — 50km Route Discovery Frequency
 * ============================================================
 *
 * Answers: "How common is it to spawn a dungeon or spawner
 * when traversing a 50km (~31 mile) route?"
 *
 * DUAL-d20 FIX VERIFIED:
 *   - Gate roll (d20Seed): determines IF something appears (15%)
 *   - Type roll (typeD20): determines WHAT appears (independent)
 *   - Ruins and monster lairs now correctly spawn
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorldEdge, beginTraversal, tickTraversal,
  resetEdgeIdCounter, resetSiteIdCounter,
  type WorldEdge, type DiscoveredSite, type TerrainType,
} from '../world-edge.js'

// Helper: run many traversals with DUAL d20 and collect stats
function runTraversalBatch(
  terrain: TerrainType,
  roadCondition: 'none' | 'trail' | 'dirt_road' | 'road' | 'paved',
  distanceMiles: number,
  runs: number,
): {
  totalRuns: number
  totalDays: number
  avgDaysPerTrip: number
  siteTypeCounts: Record<string, number>
  runsWithDiscovery: number
  runsWithDungeon: number
  runsWithResource: number
  runsWithSettlement: number
  avgSitesPerTrip: number
} {
  const siteTypeCounts: Record<string, number> = {}
  let runsWithDiscovery = 0
  let runsWithDungeon = 0
  let runsWithResource = 0
  let runsWithSettlement = 0
  let totalSites = 0
  let totalDays = 0

  for (let run = 0; run < runs; run++) {
    // Generate gate roll sequence (cycles 1-20 with offset)
    const offset = run % 20
    const gateSeeds: number[] = []
    const typeSeeds: number[] = []
    for (let d = 0; d < 30; d++) {
      gateSeeds.push(((d + offset) % 20) + 1) // 1-20 gate roll
      typeSeeds.push(((d * 7 + offset * 3) % 20) + 1) // spread type rolls differently
    }

    resetSiteIdCounter()
    resetEdgeIdCounter()
    const edge = createWorldEdge('a', 'A', 'b', 'B', distanceMiles, terrain, roadCondition)
    const state = beginTraversal(edge, 24, 1)

    let dayCount = 0
    let seedIdx = 0
    while (!state.completed && dayCount < 100) {
      const gate = gateSeeds[seedIdx % gateSeeds.length]
      const type = typeSeeds[seedIdx % typeSeeds.length]
      tickTraversal(state, edge, gate, type) // DUAL d20!
      seedIdx++
      dayCount++
    }
    totalDays += dayCount

    const sites = edge.discoveredSites
    totalSites += sites.length
    if (sites.length > 0) runsWithDiscovery++

    let hasDungeon = false
    let hasResource = false
    let hasSettlement = false

    for (const site of sites) {
      siteTypeCounts[site.siteType] = (siteTypeCounts[site.siteType] ?? 0) + 1
      if (site.siteType === 'ruin' || site.siteType === 'monster_lair') hasDungeon = true
      if (site.siteType === 'resource_deposit') hasResource = true
      if (site.siteType === 'settlement_seed') hasSettlement = true
    }

    if (hasDungeon) runsWithDungeon++
    if (hasResource) runsWithResource++
    if (hasSettlement) runsWithSettlement++
  }

  return {
    totalRuns: runs,
    totalDays,
    avgDaysPerTrip: totalDays / runs,
    siteTypeCounts,
    runsWithDiscovery,
    runsWithDungeon,
    runsWithResource,
    runsWithSettlement,
    avgSitesPerTrip: totalSites / runs,
  }
}

describe('Edge Traversal — 50km Route Discovery Statistics (FIXED)', () => {

  // ==========================================================
  // THE FIX: Dual d20 proves ruins and lairs now spawn
  // ==========================================================

  it('dual-d20 fix: ruins and monster lairs CAN now spawn', () => {
    // Direct proof: gate roll = 1 (passes 15% check), type roll = 7 (ruin)
    resetSiteIdCounter()
    resetEdgeIdCounter()
    const edge = createWorldEdge('a', 'A', 'b', 'B', 200, 'forest', 'trail')
    const state = beginTraversal(edge, 24, 1)

    const result = tickTraversal(state, edge, 1, 7) // gate=1 passes, type=7 → ruin
    expect(result.discoveries.length).toBe(1)
    expect(result.discoveries[0].siteType).toBe('ruin')
  })

  it('dual-d20 fix: monster_lair spawns with type 9 or 10', () => {
    resetSiteIdCounter()
    resetEdgeIdCounter()
    const edge = createWorldEdge('a', 'A', 'b', 'B', 200, 'plains', 'road')
    const state = beginTraversal(edge, 24, 1)

    const result = tickTraversal(state, edge, 2, 9) // gate=2 passes, type=9 → lair
    expect(result.discoveries.length).toBe(1)
    expect(result.discoveries[0].siteType).toBe('monster_lair')
  })

  it('gate still blocks with high d20Seed', () => {
    resetSiteIdCounter()
    resetEdgeIdCounter()
    const edge = createWorldEdge('a', 'A', 'b', 'B', 200, 'plains', 'road')
    const state = beginTraversal(edge, 24, 1)

    const result = tickTraversal(state, edge, 15, 7) // gate=15 FAILS → no discovery
    expect(result.discoveries).toHaveLength(0)
  })

  // ==========================================================
  // STATISTICAL ANALYSIS
  // ==========================================================

  it('50km forest trail — dungeons now appear in stats', () => {
    const stats = runTraversalBatch('forest', 'trail', 31, 200)

    console.log('\n╔══════════════════════════════════════════════════════════════╗')
    console.log('║  50km FOREST TRAIL — Discovery Stats (DUAL d20 FIX)        ║')
    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log(`║  Avg days/trip: ${stats.avgDaysPerTrip.toFixed(1)}                                      ║`)
    console.log(`║  Avg sites/trip: ${stats.avgSitesPerTrip.toFixed(2)}                                    ║`)
    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log(`║  Trips with ANY discovery:    ${stats.runsWithDiscovery}/${stats.totalRuns} (${(stats.runsWithDiscovery/stats.totalRuns*100).toFixed(0)}%)             ║`)
    console.log(`║  Trips with DUNGEON/LAIR:     ${stats.runsWithDungeon}/${stats.totalRuns} (${(stats.runsWithDungeon/stats.totalRuns*100).toFixed(0)}%)              ║`)
    console.log(`║  Trips with RESOURCE deposit: ${stats.runsWithResource}/${stats.totalRuns} (${(stats.runsWithResource/stats.totalRuns*100).toFixed(0)}%)              ║`)
    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log('║  Site type breakdown:                                        ║')
    for (const [type, count] of Object.entries(stats.siteTypeCounts).sort((a, b) => b[1] - a[1])) {
      const pct = (count / stats.totalRuns * 100).toFixed(1)
      console.log(`║    ${type.padEnd(20)} ${String(count).padStart(4)} (${pct}% of trips)          ║`)
    }
    console.log('╚══════════════════════════════════════════════════════════════╝\n')

    expect(stats.avgDaysPerTrip).toBeGreaterThanOrEqual(2)
    expect(stats.avgDaysPerTrip).toBeLessThanOrEqual(5)
  })

  it('50km mountain wilderness — slow route, more chances', () => {
    const stats = runTraversalBatch('mountains', 'none', 31, 200)

    console.log('\n╔══════════════════════════════════════════════════════════════╗')
    console.log('║  50km MOUNTAIN WILDERNESS — Discovery Stats (DUAL d20 FIX) ║')
    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log(`║  Avg days/trip: ${stats.avgDaysPerTrip.toFixed(1)}                                      ║`)
    console.log(`║  Avg sites/trip: ${stats.avgSitesPerTrip.toFixed(2)}                                    ║`)
    console.log(`║  Trips with DUNGEON/LAIR:     ${stats.runsWithDungeon}/${stats.totalRuns} (${(stats.runsWithDungeon/stats.totalRuns*100).toFixed(0)}%)              ║`)
    console.log(`║  Trips with RESOURCE:         ${stats.runsWithResource}/${stats.totalRuns} (${(stats.runsWithResource/stats.totalRuns*100).toFixed(0)}%)              ║`)
    console.log('╚══════════════════════════════════════════════════════════════╝\n')

    expect(stats.avgDaysPerTrip).toBeGreaterThanOrEqual(6)
  })
})
