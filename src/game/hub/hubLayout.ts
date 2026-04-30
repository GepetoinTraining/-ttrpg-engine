/**
 * HUB LAYOUT — Edge-first settlement generation at L4 hex level
 * ==============================================================
 *
 * Philosophy: Roads first, buildings grow from nodes.
 *   1. Main roads from gate → center with noise (wobble)
 *   2. Hub nodes at road endpoints and intersections
 *   3. Buildings spawn at nodes, radiate outward
 *   4. Side alleys generated between close buildings
 *   5. Bigger buildings get more space, smaller ones pack tighter
 *
 * Everything is deterministic from seed.
 * Works directly in L4 hex coordinates (not the 100×100 chunk space).
 */

import { SeededRNG } from './topology'
import type { DistrictType, HubSize, BuildingType } from './schema'

// ─── Types ───

export interface HubRoad {
  id: string
  hexPath: { q: number; r: number }[]  // L4 hex coordinates
  type: 'main' | 'side' | 'alley'
  width: number  // visual width for rendering
}

export interface HubNode {
  id: string
  position: { q: number; r: number }  // L4 hex center
  type: 'center' | 'gate' | 'intersection' | 'plaza'
  district: DistrictType
  radius: number  // node influence radius in L4 hexes
}

export interface LayoutBuilding {
  id: string
  type: BuildingType
  name?: string
  q: number        // L4 hex coord
  r: number
  size: number     // 1 = small (hovel), 2 = medium (house), 3 = large (temple)
  rotation: number
  floors: number
  isOpen: boolean
  isAbandoned: boolean
}

export interface HubLayout {
  roads: HubRoad[]
  nodes: HubNode[]
  buildings: LayoutBuilding[]
  alleys: HubRoad[]
}

// ─── Hex math helpers ───

const HEX_DIRS = [
  { q: 1, r: 0 },   // 0: E
  { q: 1, r: -1 },  // 1: NE
  { q: 0, r: -1 },  // 2: NW
  { q: -1, r: 0 },  // 3: W
  { q: -1, r: 1 },  // 4: SW
  { q: 0, r: 1 },   // 5: SE
]

function hexDist(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

function hexNeighbor(hex: { q: number; r: number }, dir: number): { q: number; r: number } {
  const d = HEX_DIRS[((dir % 6) + 6) % 6]
  return { q: hex.q + d.q, r: hex.r + d.r }
}

/** Walk from origin toward a target direction with wobble noise. */
function noisyHexWalk(
  rng: SeededRNG,
  start: { q: number; r: number },
  primaryDir: number,
  length: number,
  wobble: number = 0.25,
): { q: number; r: number }[] {
  const path: { q: number; r: number }[] = [{ ...start }]
  let current = { ...start }

  for (let i = 0; i < length; i++) {
    // Primary direction with random wobble to adjacent directions
    const roll = rng.next()
    let dir = primaryDir
    if (roll < wobble) {
      dir = (primaryDir + 1) % 6       // drift one way
    } else if (roll < wobble * 2) {
      dir = (primaryDir + 5) % 6       // drift other way
    }
    current = hexNeighbor(current, dir)
    path.push({ ...current })
  }
  return path
}

// ─── Building size rules ───

const BUILDING_SIZES: Record<BuildingType, number> = {
  // Size 1: small
  hovel: 1, house: 1, market_stall: 1, well: 1, fountain: 1, shrine: 1,
  // Size 2: medium
  townhouse: 2, shop: 2, tavern: 2, inn: 2, restaurant: 2, smithy: 2,
  workshop: 2, brewery: 2, tannery: 2, stable: 2, guardhouse: 2,
  dock: 2, bridge: 2, wall_section: 2, school: 2, bathhouse: 2,
  // Size 3: large
  manor: 3, apartment: 3, warehouse: 3, bank: 3, guildhall: 3,
  temple: 3, monastery: 3, town_hall: 3, courthouse: 3, prison: 3,
  barracks: 3, tower: 3, library: 3, hospital: 3, theater: 3,
  arena: 3, mill: 3, gatehouse: 3,
}

/** Building spacing: bigger buildings need more hexes between them */
function buildingSpacing(size: number): number {
  return size + 1  // size 1→2 hexes, size 2→3, size 3→4
}

// ─── Building types by district ───

const DISTRICT_BUILDINGS: Record<DistrictType, { type: BuildingType; weight: number }[]> = {
  center:         [{ type: 'town_hall', weight: 3 }, { type: 'shop', weight: 20 }, { type: 'tavern', weight: 10 }, { type: 'inn', weight: 8 }, { type: 'fountain', weight: 5 }, { type: 'well', weight: 3 }],
  residential:    [{ type: 'house', weight: 40 }, { type: 'townhouse', weight: 15 }, { type: 'hovel', weight: 10 }, { type: 'well', weight: 3 }, { type: 'shrine', weight: 2 }],
  commercial:     [{ type: 'shop', weight: 30 }, { type: 'warehouse', weight: 10 }, { type: 'inn', weight: 8 }, { type: 'market_stall', weight: 20 }, { type: 'bank', weight: 3 }],
  industrial:     [{ type: 'workshop', weight: 20 }, { type: 'smithy', weight: 15 }, { type: 'tannery', weight: 10 }, { type: 'warehouse', weight: 15 }, { type: 'mill', weight: 10 }],
  religious:      [{ type: 'temple', weight: 15 }, { type: 'shrine', weight: 15 }, { type: 'monastery', weight: 5 }, { type: 'house', weight: 10 }],
  administrative: [{ type: 'town_hall', weight: 10 }, { type: 'courthouse', weight: 10 }, { type: 'prison', weight: 5 }, { type: 'guardhouse', weight: 10 }, { type: 'barracks', weight: 5 }],
  noble:          [{ type: 'manor', weight: 25 }, { type: 'townhouse', weight: 20 }, { type: 'fountain', weight: 5 }, { type: 'stable', weight: 5 }],
  slums:          [{ type: 'hovel', weight: 50 }, { type: 'house', weight: 15 }, { type: 'tavern', weight: 10 }],
  docks:          [{ type: 'warehouse', weight: 25 }, { type: 'dock', weight: 15 }, { type: 'tavern', weight: 10 }, { type: 'inn', weight: 8 }],
  military:       [{ type: 'barracks', weight: 25 }, { type: 'guardhouse', weight: 15 }, { type: 'tower', weight: 10 }, { type: 'stable', weight: 8 }, { type: 'smithy', weight: 8 }],
  academic:       [{ type: 'library', weight: 20 }, { type: 'school', weight: 15 }, { type: 'tower', weight: 8 }, { type: 'townhouse', weight: 10 }],
  entertainment:  [{ type: 'tavern', weight: 20 }, { type: 'theater', weight: 10 }, { type: 'inn', weight: 10 }, { type: 'restaurant', weight: 10 }],
  magical:        [{ type: 'tower', weight: 25 }, { type: 'shop', weight: 15 }, { type: 'library', weight: 10 }],
  foreign:        [{ type: 'shop', weight: 20 }, { type: 'inn', weight: 15 }, { type: 'restaurant', weight: 10 }, { type: 'warehouse', weight: 10 }],
  garden:         [{ type: 'manor', weight: 15 }, { type: 'fountain', weight: 20 }, { type: 'shrine', weight: 10 }],
  necropolis:     [{ type: 'shrine', weight: 25 }, { type: 'temple', weight: 15 }, { type: 'wall_section', weight: 10 }],
}

// ─── Name generators ───

function generateBuildingName(type: BuildingType, rng: SeededRNG): string | undefined {
  if (rng.next() < 0.4) return undefined
  if (type === 'inn' || type === 'tavern') {
    const adj = ['Prancing', 'Dancing', 'Sleeping', 'Golden', 'Silver', 'Red', 'Rusty', 'Broken']
    const noun = ['Pony', 'Dragon', 'Lion', 'Bear', 'Stag', 'Raven', 'Sword', 'Crown', 'Barrel']
    return `The ${rng.pick(adj)} ${rng.pick(noun)}`
  }
  if (type === 'shop') {
    const owners = ['Grimble', 'Thornwick', 'Ashford', 'Ironhand', 'Goldleaf', 'Stoneheart']
    return `${rng.pick(owners)}'s Goods`
  }
  return undefined
}

// ─── Main generator ───

export function generateHubLayout(
  seed: string,
  gateDirs: number[],
  coreRadius: number,
  hubSize: HubSize,
): HubLayout {
  const rng = new SeededRNG(`${seed}_layout`)
  const roads: HubRoad[] = []
  const nodes: HubNode[] = []
  const buildings: LayoutBuilding[] = []
  const alleys: HubRoad[] = []
  const occupied = new Set<string>()  // "q,r" → occupied by building

  // ─── Step 1: Center node ───
  nodes.push({
    id: 'node_center',
    position: { q: 0, r: 0 },
    type: 'center',
    district: 'center',
    radius: 3,
  })

  // ─── Step 2: Main roads from gates to center with noise ───
  const gates = gateDirs.length > 0 ? gateDirs : [0]

  for (let gi = 0; gi < gates.length; gi++) {
    const gateDir = gates[gi]
    const roadLength = coreRadius - 1

    // Noisy road from center outward to gate
    const path = noisyHexWalk(rng, { q: 0, r: 0 }, gateDir, roadLength, 0.2)

    roads.push({
      id: `main_road_${gi}`,
      hexPath: path,
      type: 'main',
      width: 4,
    })

    // Gate node at road end
    const gatePos = path[path.length - 1]
    nodes.push({
      id: `node_gate_${gi}`,
      position: gatePos,
      type: 'gate',
      district: 'commercial',  // gates typically have commerce
      radius: 2,
    })

    // Intersection nodes along the road (every ~4-6 hexes)
    const districtTypes: DistrictType[] = ['residential', 'commercial', 'residential']
    let nextNodeDist = rng.rangeInt(3, 5)
    let nodeIdx = 0

    for (let i = nextNodeDist; i < path.length - 2; i += nextNodeDist) {
      const pos = path[i]
      const district = districtTypes[nodeIdx % districtTypes.length]

      nodes.push({
        id: `node_road${gi}_${nodeIdx}`,
        position: pos,
        type: 'intersection',
        district,
        radius: rng.rangeInt(2, 3),
      })
      nodeIdx++
      nextNodeDist = rng.rangeInt(3, 5)

      // Side road branching from this intersection
      const sideDir = (gateDir + (rng.next() < 0.5 ? 2 : 4)) % 6  // perpendicular-ish
      const sideLength = rng.rangeInt(3, 6)
      const sidePath = noisyHexWalk(rng, pos, sideDir, sideLength, 0.3)

      roads.push({
        id: `side_road_${gi}_${nodeIdx}`,
        hexPath: sidePath,
        type: 'side',
        width: 2,
      })

      // Node at side road end
      const sideEnd = sidePath[sidePath.length - 1]
      const sideDistrict: DistrictType = rng.pick(['residential', 'industrial', 'religious', 'slums'])
      nodes.push({
        id: `node_side_${gi}_${nodeIdx}`,
        position: sideEnd,
        type: 'intersection',
        district: sideDistrict,
        radius: 2,
      })
    }
  }

  // Mark road hexes as occupied
  for (const road of roads) {
    for (const hex of road.hexPath) {
      occupied.add(`${hex.q},${hex.r}`)
    }
  }

  // ─── Step 3: Spawn buildings around each node ───
  const buildingCapacity: Record<string, number> = {
    outpost: 8, hamlet: 15, village: 30, town: 60, city: 120, metropolis: 250,
  }
  const maxBuildings = buildingCapacity[hubSize] || 60
  let buildingCount = 0

  // Sort nodes: center first, then gates, then intersections
  const sortedNodes = [...nodes].sort((a, b) => {
    const order = { center: 0, gate: 1, plaza: 2, intersection: 3 }
    return (order[a.type] || 3) - (order[b.type] || 3)
  })

  for (const node of sortedNodes) {
    if (buildingCount >= maxBuildings) break

    const districtBuildings = DISTRICT_BUILDINGS[node.district] || DISTRICT_BUILDINGS['residential']
    const buildingsForNode = rng.rangeInt(
      Math.max(2, node.radius * 2),
      Math.min(node.radius * 4, maxBuildings - buildingCount)
    )

    for (let bi = 0; bi < buildingsForNode; bi++) {
      if (buildingCount >= maxBuildings) break

      // Pick building type
      const bType = rng.weightedPick(
        districtBuildings.map(b => b.type),
        districtBuildings.map(b => b.weight),
      )
      const bSize = BUILDING_SIZES[bType] || 1
      const spacing = buildingSpacing(bSize)

      // Find a free hex near the node
      let placed = false
      for (let attempt = 0; attempt < 20; attempt++) {
        // Random hex within node radius + some spread
        const range = node.radius + bi * 0.3 + 1
        const dq = rng.rangeInt(-Math.ceil(range), Math.ceil(range))
        const dr = rng.rangeInt(-Math.ceil(range), Math.ceil(range))
        const bq = node.position.q + dq
        const br = node.position.r + dr

        // Check hex distance from node
        if (hexDist({ q: bq, r: br }, node.position) > range + 1) continue

        // Check not too far from core
        if (hexDist({ q: bq, r: br }, { q: 0, r: 0 }) > coreRadius) continue

        // Check spacing from other buildings
        const key = `${bq},${br}`
        if (occupied.has(key)) continue

        let tooClose = false
        for (let d = 1; d < spacing; d++) {
          for (let di = 0; di < 6; di++) {
            const nb = hexNeighbor({ q: bq, r: br }, di)
            if (d === 1 && occupied.has(`${nb.q},${nb.r}`)) {
              // Size 1 buildings can be 1 hex apart
              if (bSize > 1) { tooClose = true; break }
            }
          }
          if (tooClose) break
        }
        if (tooClose) continue

        // Place building
        buildings.push({
          id: `bld_${buildingCount}`,
          type: bType,
          name: generateBuildingName(bType, rng),
          q: bq,
          r: br,
          size: bSize,
          rotation: rng.range(-15, 15),
          floors: Math.max(1, bSize + (node.district === 'center' ? 1 : 0) + (rng.next() < 0.2 ? 1 : 0)),
          isOpen: rng.next() > 0.08,
          isAbandoned: rng.next() < 0.03,
        })

        // Mark occupied
        occupied.add(key)
        if (bSize >= 2) {
          // Large buildings also occupy a neighbor hex
          for (let d = 0; d < 6; d++) {
            const nb = hexNeighbor({ q: bq, r: br }, d)
            if (bSize >= 3 || rng.next() < 0.3) {
              occupied.add(`${nb.q},${nb.r}`)
            }
          }
        }

        buildingCount++
        placed = true
        break
      }
    }
  }

  // ─── Step 4: Generate alleys between close buildings ───
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i]
      const b = buildings[j]
      const dist = hexDist({ q: a.q, r: a.r }, { q: b.q, r: b.r })

      if (dist <= 3 && dist >= 2 && rng.next() < 0.3) {
        alleys.push({
          id: `alley_${i}_${j}`,
          hexPath: [{ q: a.q, r: a.r }, { q: b.q, r: b.r }],
          type: 'alley',
          width: 1,
        })
      }
    }
  }

  return { roads, nodes, buildings, alleys }
}
