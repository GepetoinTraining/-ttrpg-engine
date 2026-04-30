/**
 * Edge System — deterministic road generation from seed (square edition).
 *
 * Roads are continuous paths from settlement to settlement. Each road is
 * a `RoadPath`: an ordered list of grid coords the road passes through.
 * Rendering draws the road as a continuous polyline along tile centers
 * or edge midpoints.
 *
 * Migration note (2026-04-30): hex (q,r) → grid (x,y); 6-direction gates
 * become 8-direction (cardinals + diagonals); A* + distance use Chebyshev
 * (D&D 5e basic — diagonal counts as 1).
 */

import { gridAStar, gridDistance, gridNeighbors8, GRID_NEIGHBOR_DIRS_8, type GridCoord } from './grid'
import { createBiomeResolver } from './biome'

// ─── Types ───

/** A complete road from one settlement to another */
export interface RoadPath {
  /** Ordered grid coords the road passes through (first = settlement A, last = settlement B) */
  path: GridCoord[]
  type: 'road' | 'trail' | 'river'
}

export interface SettlementInfo {
  x: number
  y: number
  name: string
  /** Which 8-way directions roads enter from (0-7, see GRID_NEIGHBOR_DIRS_8) */
  gates: number[]
}

// ─── Settlement Discovery ───

/**
 * Deterministically find settlements that generate roads.
 * Lower threshold than world.ts — only major settlements get roads.
 */
export function findSettlements(
  biomeResolver: ReturnType<typeof createBiomeResolver>,
  centerX: number,
  centerY: number,
  searchRadius: number,
): SettlementInfo[] {
  const settlements: SettlementInfo[] = []

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      const biome = biomeResolver.getBiome(x, y)

      if (biome.type === 'ocean') continue

      // Deterministic per-tile RNG for settlement placement
      const rng = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
      const hasSettlement =
        (biome.type === 'plains' && rng < 0.02) ||
        (biome.type === 'forest' && rng < 0.01) ||
        (biome.type === 'coast' && rng < 0.03)

      if (hasSettlement || (x === 0 && y === 0)) {
        settlements.push({
          x,
          y,
          name: generateSettlementName(x, y),
          gates: [],
        })
      }
    }
  }

  return settlements
}

// ─── Road Generation ───

/**
 * Generate complete road paths between settlements.
 * Each road is a continuous chain of tiles from settlement A to settlement B.
 */
export function generateRoads(
  biomeResolver: ReturnType<typeof createBiomeResolver>,
  centerX: number,
  centerY: number,
  viewRadius: number,
): { roads: RoadPath[]; settlements: SettlementInfo[] } {
  const settlements = findSettlements(biomeResolver, centerX, centerY, viewRadius)

  if (settlements.length < 2) return { roads: [], settlements }

  const costFn = (x: number, y: number): number => {
    const biome = biomeResolver.getBiome(x, y)
    if (biome.type === 'ocean') return Infinity
    if (biome.type === 'coast') return 15  // bridge cost
    return biome.moveCost
  }

  const roads: RoadPath[] = []
  const connectedPairs = new Set<string>()

  for (const settler of settlements) {
    const others = settlements
      .filter((s) => s.x !== settler.x || s.y !== settler.y)
      .map((s) => ({ ...s, dist: gridDistance(settler, s) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2)

    for (const target of others) {
      // Canonical pair key (order-independent)
      const pairKey = [
        `${Math.min(settler.x, target.x)},${Math.min(settler.y, target.y)}`,
        `${Math.max(settler.x, target.x)},${Math.max(settler.y, target.y)}`,
      ].join('→')

      if (connectedPairs.has(pairKey)) continue
      connectedPairs.add(pairKey)

      if (target.dist > 10) continue

      const path = gridAStar(
        { x: settler.x, y: settler.y },
        { x: target.x, y: target.y },
        costFn,
        { maxSteps: target.dist * 3 },
      )
      if (!path || path.length < 2) continue

      roads.push({ path, type: 'road' })

      // Calculate gate directions
      const firstHop = path[1]
      const gateDir = getGridDirection(settler, firstHop)
      if (gateDir >= 0 && !settler.gates.includes(gateDir)) {
        settler.gates.push(gateDir)
      }

      const lastHop = path[path.length - 2]
      const targetGateDir = getGridDirection(target, lastHop)
      if (targetGateDir >= 0 && !target.gates.includes(targetGateDir)) {
        target.gates.push(targetGateDir)
      }
    }
  }

  return { roads, settlements }
}

// ─── River Generation ───

/**
 * Generate rivers that flow downhill from high-elevation sources.
 * Rivers greedily follow the lowest neighboring tile until reaching ocean/coast.
 */
export function generateRivers(
  biomeResolver: ReturnType<typeof createBiomeResolver>,
  centerX: number,
  centerY: number,
  viewRadius: number,
): RoadPath[] {
  const rivers: RoadPath[] = []

  // Find high-elevation tiles as potential river sources
  const sources: { x: number; y: number; elev: number }[] = []

  for (let dy = -viewRadius; dy <= viewRadius; dy++) {
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      const biome = biomeResolver.getBiome(x, y)
      if (biome.elevation > 0.65 && biome.type !== 'ocean') {
        const rng = Math.abs(Math.sin(x * 37.1681 + y * 91.4253) * 29174.8127) % 1
        if (rng < 0.08) {
          sources.push({ x, y, elev: biome.elevation })
        }
      }
    }
  }

  // Sort by elevation (highest first) and take top sources
  sources.sort((a, b) => b.elev - a.elev)
  const selectedSources = sources.slice(0, 6)

  const usedTiles = new Set<string>()

  for (const source of selectedSources) {
    const path: GridCoord[] = [{ x: source.x, y: source.y }]
    const visited = new Set<string>([`${source.x},${source.y}`])
    let currentX = source.x
    let currentY = source.y
    let currentElev = source.elev
    let reachedWater = false

    // Flow downhill — max 60 steps
    for (let step = 0; step < 60; step++) {
      const neighbors = gridNeighbors8(currentX, currentY)

      let bestNeighbor: GridCoord | null = null
      let bestElev = currentElev + 0.01

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`
        if (visited.has(key)) continue
        const nBiome = biomeResolver.getBiome(n.x, n.y)

        // Reached ocean — river mouth!
        if (nBiome.type === 'ocean' || nBiome.type === 'coast') {
          path.push(n)
          reachedWater = true
          bestNeighbor = null
          break
        }

        if (nBiome.elevation < bestElev) {
          bestElev = nBiome.elevation
          bestNeighbor = n
        }
      }

      if (reachedWater) break

      if (!bestNeighbor) break // dead end — discard

      const nKey = `${bestNeighbor.x},${bestNeighbor.y}`
      path.push(bestNeighbor)
      visited.add(nKey)

      // Merge with existing river = also valid termination
      if (usedTiles.has(nKey)) {
        reachedWater = true
        break
      }

      currentX = bestNeighbor.x
      currentY = bestNeighbor.y
      currentElev = bestElev
    }

    if (reachedWater && path.length >= 3) {
      for (const p of path) usedTiles.add(`${p.x},${p.y}`)
      rivers.push({ path, type: 'river' })
    }
  }

  return rivers
}

// ─── Helpers ───

/**
 * Get the direction index from `from` → `to` based on `GRID_NEIGHBOR_DIRS_8`.
 * Returns 0-7 (E, NE, N, NW, W, SW, S, SE) or -1 if not adjacent.
 */
function getGridDirection(from: GridCoord, to: GridCoord): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return GRID_NEIGHBOR_DIRS_8.findIndex(([ddx, ddy]) => ddx === dx && ddy === dy)
}

function generateSettlementName(x: number, y: number): string {
  if (x === 0 && y === 0) return 'Starter Town'
  const prefixes = ['Green', 'Iron', 'Silver', 'Dark', 'White', 'Stone', 'River', 'Shade', 'Storm', 'Gold', 'Amber', 'Hollow', 'Frost', 'Ember', 'Oak']
  const suffixes = ['haven', 'ford', 'vale', 'keep', 'reach', 'hollow', 'burg', 'port', 'wood', 'gate', 'fall', 'watch', 'dale', 'shire', 'cross']
  const hash = Math.abs(x * 73856093 ^ y * 19349663)
  return `${prefixes[hash % prefixes.length]}${suffixes[(hash >> 4) % suffixes.length]}`
}
