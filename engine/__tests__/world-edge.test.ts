/**
 * WORLD EDGE TESTS — Routes Between Hubs
 * ==========================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TERRAIN_SPEED_MOD, TERRAIN_RESOURCE_TABLE,
  ROAD_SPEED_MOD, ROAD_UPGRADE_COST, ROAD_REQUIREMENTS,
  calculateTravelSpeed, estimateTravelDays,
  getSegmentAtMile, beginTraversal, tickTraversal,
  claimSegment, upgradeRoad, setPatrol, unlockFastTravel,
  createWorldEdge, resetEdgeIdCounter, resetSiteIdCounter,
  type WorldEdge, type OwnershipSegment, type TraversalState,
} from '../world-edge.js'

beforeEach(() => {
  resetEdgeIdCounter()
  resetSiteIdCounter()
})

// ============================================================
// TERRAIN & ROAD LOOKUPS
// ============================================================

describe('Terrain', () => {
  it('plains are fastest', () => {
    expect(TERRAIN_SPEED_MOD.plains).toBe(1.0)
  })

  it('jungle is slowest', () => {
    expect(TERRAIN_SPEED_MOD.jungle).toBe(0.25)
  })

  it('mountains have mining resources', () => {
    expect(TERRAIN_RESOURCE_TABLE.mountains).toContain('iron_ore')
    expect(TERRAIN_RESOURCE_TABLE.mountains).toContain('gold_ore')
  })

  it('forest has timber', () => {
    expect(TERRAIN_RESOURCE_TABLE.forest).toContain('timber')
  })
})

describe('Road Conditions', () => {
  it('paved roads are fastest', () => {
    expect(ROAD_SPEED_MOD.paved).toBe(1.2)
  })

  it('no road halves speed', () => {
    expect(ROAD_SPEED_MOD.none).toBe(0.5)
  })

  it('paved roads cost 500gp/mile', () => {
    expect(ROAD_UPGRADE_COST.paved).toBe(500)
  })

  it('wagons require actual roads', () => {
    expect(ROAD_REQUIREMENTS.wagon).toBe('road')
  })

  it('porters need no road', () => {
    expect(ROAD_REQUIREMENTS.porter).toBe('none')
  })
})

// ============================================================
// TRAVEL SPEED & TIME
// ============================================================

describe('Travel Calculations', () => {
  it('plains + paved road = max speed', () => {
    const speed = calculateTravelSpeed(24, 'plains', 'paved') // 24 × 1.0 × 1.2
    expect(speed).toBe(28)
  })

  it('mountains + no road = very slow', () => {
    const speed = calculateTravelSpeed(24, 'mountains', 'none') // 24 × 0.4 × 0.5
    expect(speed).toBe(4)
  })

  it('100 miles on plains road at 24mph = 5 days', () => {
    const days = estimateTravelDays(100, 24, 'plains', 'road')
    expect(days).toBe(5) // 100 / (24 × 1.0 × 1.0) = 4.16 → ceil = 5
  })

  it('100 miles through mountains no road = 25 days', () => {
    const days = estimateTravelDays(100, 24, 'mountains', 'none')
    expect(days).toBe(25) // 100 / 4 = 25
  })
})

// ============================================================
// EDGE FACTORY
// ============================================================

describe('Edge Creation', () => {
  it('creates a basic edge with one segment', () => {
    const edge = createWorldEdge(
      'suzail', 'Suzail',
      'arabel', 'Arabel',
      150, 'plains', 'road', 'cormyr', 'Kingdom of Cormyr',
    )
    expect(edge.sourceNodeId).toBe('suzail')
    expect(edge.targetNodeId).toBe('arabel')
    expect(edge.distanceMiles).toBe(150)
    expect(edge.terrain).toBe('plains')
    expect(edge.segments).toHaveLength(1)
    expect(edge.segments[0].roadCondition).toBe('road')
    expect(edge.segments[0].controllerId).toBe('cormyr')
    expect(edge.traversed).toBe(false)
    expect(edge.bidirectional).toBe(true)
  })

  it('unclaimed edges default to risky', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'forest')
    expect(edge.segments[0].dangerLevel).toBe('risky')
  })

  it('claimed edges default to patrolled', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'forest', 'trail', 'faction_1', 'Zhentarim')
    expect(edge.segments[0].dangerLevel).toBe('patrolled')
  })
})

// ============================================================
// SEGMENT OPERATIONS
// ============================================================

describe('Segment at Mile', () => {
  it('finds the right segment', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    const seg = getSegmentAtMile(edge, 50)
    expect(seg).toBeDefined()
    expect(seg!.startMile).toBe(0)
    expect(seg!.endMile).toBe(100)
  })
})

describe('Land Acquisition', () => {
  it('claiming middle of unclaimed splits into 3 segments', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    claimSegment(edge, 30, 60, 'player_faction', 'The Silver Blades')

    expect(edge.segments).toHaveLength(3)
    // Before claim
    expect(edge.segments[0].startMile).toBe(0)
    expect(edge.segments[0].endMile).toBe(30)
    expect(edge.segments[0].controllerId).toBeNull()
    // Claimed
    expect(edge.segments[1].startMile).toBe(30)
    expect(edge.segments[1].endMile).toBe(60)
    expect(edge.segments[1].controllerId).toBe('player_faction')
    expect(edge.segments[1].controllerName).toBe('The Silver Blades')
    // After claim
    expect(edge.segments[2].startMile).toBe(60)
    expect(edge.segments[2].endMile).toBe(100)
  })

  it('claiming from start only splits into 2 segments', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    claimSegment(edge, 0, 40, 'duke', 'Duke Volkov')

    expect(edge.segments).toHaveLength(2)
    expect(edge.segments[0].controllerId).toBe('duke')
    expect(edge.segments[1].controllerId).toBeNull()
  })

  it('claiming entire edge = 1 segment', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    claimSegment(edge, 0, 100, 'empire', 'The Empire')

    expect(edge.segments).toHaveLength(1)
    expect(edge.segments[0].controllerId).toBe('empire')
  })

  it('adjacent segments with same owner merge', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    claimSegment(edge, 0, 50, 'faction_1', 'Faction')
    claimSegment(edge, 50, 100, 'faction_1', 'Faction')

    // Should merge into 1 segment
    expect(edge.segments).toHaveLength(1)
    expect(edge.segments[0].controllerId).toBe('faction_1')
    expect(edge.segments[0].startMile).toBe(0)
    expect(edge.segments[0].endMile).toBe(100)
  })
})

// ============================================================
// ROAD UPGRADES
// ============================================================

describe('Road Upgrades', () => {
  it('upgrades road and returns cost', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 10, 'plains', 'none')
    const cost = upgradeRoad(edge, 0, 'road')
    // none→trail(5) + trail→dirt(20) + dirt→road(100) = 125 per mile × 10 miles
    expect(cost).toBe(1250)
    expect(edge.segments[0].roadCondition).toBe('road')
  })

  it('no cost if already at target', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 10, 'plains', 'paved')
    const cost = upgradeRoad(edge, 0, 'road')
    expect(cost).toBe(0)
  })
})

// ============================================================
// PATROL & DANGER
// ============================================================

describe('Patrol System', () => {
  it('high patrol density = safe', () => {
    const seg: OwnershipSegment = {
      startMile: 0, endMile: 10, controllerId: 'a', controllerName: 'A',
      roadCondition: 'road', dangerLevel: 'risky', toll: 0, patrolStrength: 0,
    }
    setPatrol(seg, 20, 10) // 2 per mile
    expect(seg.dangerLevel).toBe('safe')
  })

  it('no patrol = deadly', () => {
    const seg: OwnershipSegment = {
      startMile: 0, endMile: 100, controllerId: 'a', controllerName: 'A',
      roadCondition: 'road', dangerLevel: 'safe', toll: 0, patrolStrength: 0,
    }
    setPatrol(seg, 0, 100)
    expect(seg.dangerLevel).toBe('deadly')
  })
})

// ============================================================
// TRAVERSAL
// ============================================================

describe('Edge Traversal', () => {
  it('begins at mile 0 going forward', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains', 'road')
    const state = beginTraversal(edge, 24, 1)
    expect(state.currentMile).toBe(0)
    expect(state.direction).toBe('forward')
    expect(state.completed).toBe(false)
  })

  it('arrives after correct number of ticks', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 48, 'plains', 'road')
    const state = beginTraversal(edge, 24, 1)

    // 48 miles at 24mph over plains+road = 24 × 1.0 × 1.0 = 24/day → 2 days
    const day1 = tickTraversal(state, edge, 20) // d20=20 → no discovery (20/20=1.0 > 0.15)
    expect(day1.arrived).toBe(false)
    expect(day1.newMile).toBe(24)

    const day2 = tickTraversal(state, edge, 20)
    expect(day2.arrived).toBe(true)
    expect(edge.traversed).toBe(true)
    expect(edge.exploredFraction).toBe(1.0)
  })

  it('pays toll when entering controlled segment', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 60, 'plains', 'road')
    // Split: 0-30 unclaimed, 30-60 controlled with toll
    claimSegment(edge, 30, 60, 'baron', 'Baron')
    edge.segments[1].toll = 5

    const state = beginTraversal(edge, 24, 1)
    state.effectiveSpeed = 24

    // Day 1: move 24 miles (still in first segment)
    const day1 = tickTraversal(state, edge, 20)
    expect(day1.tollPaid).toBe(0)

    // Day 2: cross into baron's territory (mile 24→48)
    const day2 = tickTraversal(state, edge, 20)
    expect(day2.segmentChanged).toBe(true)
    expect(day2.tollPaid).toBe(5)
  })

  it('procedural discovery works with low d20', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 200, 'forest', 'trail')
    const state = beginTraversal(edge, 24, 1)

    // d20Seed = 2 → gate passes (2/20 = 0.1 < 0.15), typeD20 = 3 → rich resource
    const result = tickTraversal(state, edge, 2, 3)
    expect(result.discoveries.length).toBeGreaterThanOrEqual(1)
    expect(edge.discoveredSites.length).toBeGreaterThanOrEqual(1)
  })

  it('no discovery with high d20', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 200, 'plains', 'road')
    const state = beginTraversal(edge, 24, 1)

    // d20 = 18 → 18/20 = 0.9 > 0.15 → no discovery
    const result = tickTraversal(state, edge, 18)
    expect(result.discoveries).toHaveLength(0)
  })
})

// ============================================================
// FAST TRAVEL
// ============================================================

describe('Fast Travel', () => {
  it('cannot unlock before traversal', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    expect(unlockFastTravel(edge, 'known_route', 10)).toBe(false)
    expect(edge.fastTravelUnlocked).toBe(false)
  })

  it('unlocks after full traversal', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 100, 'plains')
    edge.traversed = true

    expect(unlockFastTravel(edge, 'teleportation_circle', 100)).toBe(true)
    expect(edge.fastTravelUnlocked).toBe(true)
    expect(edge.fastTravelType).toBe('teleportation_circle')
    expect(edge.fastTravelCost).toBe(100)
  })
})

// ============================================================
// DISCOVERY QUALITY & TERRAIN
// ============================================================

describe('Procedural Discovery', () => {
  it('resource deposits match terrain type', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 500, 'mountains', 'trail')
    const state = beginTraversal(edge, 24, 1)

    // d20Seed = 1 → gate passes, typeD20 = 1 → rich resource deposit
    tickTraversal(state, edge, 1, 1)

    if (edge.discoveredSites.length > 0) {
      const site = edge.discoveredSites[0]
      expect(site.siteType).toBe('resource_deposit')
      // Mountains should find mining resources
      expect(TERRAIN_RESOURCE_TABLE.mountains).toContain(site.depositCommodity)
    }
  })

  it('sites are not placed too close together', () => {
    const edge = createWorldEdge('a', 'A', 'b', 'B', 500, 'plains', 'road')
    const state = beginTraversal(edge, 24, 1)

    // Tick many days with low d20
    for (let i = 0; i < 20; i++) {
      tickTraversal(state, edge, 2, 2)
    }

    // Check no two sites within 5 miles of each other
    for (let i = 0; i < edge.discoveredSites.length; i++) {
      for (let j = i + 1; j < edge.discoveredSites.length; j++) {
        const dist = Math.abs(edge.discoveredSites[i].mileMarker - edge.discoveredSites[j].mileMarker)
        expect(dist).toBeGreaterThanOrEqual(5)
      }
    }
  })
})
