/**
 * HUB TOPOLOGY GENERATORS
 * ==========================
 *
 * 6 topology generators that produce deterministic city geometry
 * from seed strings. Same seed → same streets/lots/POIs every time.
 *
 * Generators:
 *   Natural   — Organic growth (medieval towns, villages)
 *   Planned   — Grid-based (Roman cities, forts, new districts)
 *   Radial    — Concentric rings (ancient/religious cities)
 *   Linear    — Along a road/river (trading posts)
 *   Hybrid    — Natural core + planned expansions
 *   Clustered — Multiple organic nuclei
 *
 * This is the core of the rendering-free architecture:
 * The server stores ONLY the seed string.
 * Any client can regenerate the full geometry from it.
 */

import {
  TopologyType,
  DistrictType,
  HubSize,
  HUB_SIZE_CONFIG,
  DISTRICT_ADJACENCY,
} from './hub-schema'

// ============================================
// SEEDED RNG (FNV-1a + LCG)
// ============================================

export class SeededRNG {
  private seed: number

  constructor(seedStr: string) {
    // FNV-1a hash
    let h = 0x811c9dc5
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    this.seed = h >>> 0
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }

  range(min: number, max: number): number {
    return min + (this.next() * (max - min))
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }

  gaussian(mean: number = 0, stddev: number = 1): number {
    // Box-Muller transform
    const u1 = this.next()
    const u2 = this.next()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * stddev
  }
}

// ============================================
// SHARED GEOMETRY TYPES
// ============================================

export interface Point {
  x: number
  y: number
}

export interface Street {
  id: string
  points: Point[]
  width: number
  type: 'main' | 'side' | 'alley' | 'path'
}

export interface Lot {
  id: string
  center: Point
  vertices: Point[]
  area: number
}

export interface ChunkLayout {
  streets: Street[]
  lots: Lot[]
  pois: Point[]
}

// ============================================
// NATURAL TOPOLOGY — Organic growth
// ============================================

export class NaturalTopology {
  private rng: SeededRNG
  private chunkSize: number = 100

  constructor(seed: string) {
    this.rng = new SeededRNG(seed)
  }

  generateStreets(density: number = 0.5): Street[] {
    const streets: Street[] = []
    const mainCount = Math.floor(2 + density * 3)
    const sideCount = Math.floor(3 + density * 6)

    for (let i = 0; i < mainCount; i++) {
      streets.push(this.generateOrganicStreet(`main_${i}`, 'main', 6, 0.7))
    }

    for (let i = 0; i < sideCount; i++) {
      const parent = this.rng.pick(streets)
      const branchPoint = this.rng.pick(parent.points)
      streets.push(this.generateOrganicStreet(`side_${i}`, 'side', 4, 0.5, branchPoint))
    }

    const alleyCount = Math.floor(density * 4)
    for (let i = 0; i < alleyCount; i++) {
      streets.push(this.generateOrganicStreet(`alley_${i}`, 'alley', 2, 0.3))
    }

    return streets
  }

  private generateOrganicStreet(
    id: string,
    type: 'main' | 'side' | 'alley' | 'path',
    width: number,
    lengthFactor: number,
    startPoint?: Point,
  ): Street {
    const points: Point[] = []
    const length = Math.floor(this.chunkSize * lengthFactor * (0.5 + this.rng.next() * 0.5))
    const stepSize = 5 + this.rng.next() * 10

    let current: Point = startPoint ?? {
      x: this.rng.range(10, 90),
      y: this.rng.range(10, 90),
    }
    points.push({ ...current })

    let angle = this.rng.next() * Math.PI * 2
    const steps = Math.floor(length / stepSize)

    for (let i = 0; i < steps; i++) {
      angle += this.rng.gaussian(0, 0.3)
      current = {
        x: Math.max(0, Math.min(this.chunkSize, current.x + Math.cos(angle) * stepSize)),
        y: Math.max(0, Math.min(this.chunkSize, current.y + Math.sin(angle) * stepSize)),
      }
      points.push({ ...current })
    }

    return { id, points, width, type }
  }

  generateLots(streets: Street[], count: number): Lot[] {
    const lots: Lot[] = []
    const centers: Point[] = []
    const streetBuffer = 4
    let attempts = 0
    const maxAttempts = count * 10

    while (centers.length < count && attempts < maxAttempts) {
      attempts++
      const candidate: Point = { x: this.rng.range(5, 95), y: this.rng.range(5, 95) }

      let tooClose = false
      for (const street of streets) {
        for (const point of street.points) {
          if (Math.hypot(candidate.x - point.x, candidate.y - point.y) < streetBuffer + street.width) {
            tooClose = true
            break
          }
        }
        if (tooClose) break
      }

      if (!tooClose) {
        for (const other of centers) {
          if (Math.hypot(candidate.x - other.x, candidate.y - other.y) < 8) {
            tooClose = true
            break
          }
        }
      }

      if (!tooClose) centers.push(candidate)
    }

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i]
      const size = this.rng.range(6, 14)
      const vertices = this.generateIrregularPolygon(center, size, this.rng.rangeInt(4, 7))
      lots.push({ id: `lot_${i}`, center, vertices, area: this.calculatePolygonArea(vertices) })
    }

    return lots
  }

  private generateIrregularPolygon(center: Point, avgRadius: number, sides: number): Point[] {
    const vertices: Point[] = []
    const angleStep = (Math.PI * 2) / sides
    for (let i = 0; i < sides; i++) {
      const angle = i * angleStep + this.rng.gaussian(0, 0.2)
      const radius = avgRadius * (0.7 + this.rng.next() * 0.6)
      vertices.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      })
    }
    return vertices
  }

  private calculatePolygonArea(vertices: Point[]): number {
    let area = 0
    const n = vertices.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += vertices[i].x * vertices[j].y
      area -= vertices[j].x * vertices[i].y
    }
    return Math.abs(area / 2)
  }

  generate(density: number = 0.5): ChunkLayout {
    const streets = this.generateStreets(density)
    const lotCount = Math.floor(8 + density * 12)
    const lots = this.generateLots(streets, lotCount)
    const pois: Point[] = []
    for (const street of streets) {
      if (this.rng.next() < 0.3) pois.push(this.rng.pick(street.points))
    }
    return { streets, lots, pois }
  }
}

// ============================================
// PLANNED TOPOLOGY — Grid-based
// ============================================

export class PlannedTopology {
  private rng: SeededRNG
  private chunkSize: number = 100

  constructor(seed: string) {
    this.rng = new SeededRNG(seed)
  }

  generateStreets(gridSize: number = 20): Street[] {
    const streets: Street[] = []
    const imperfection = 0.1

    const hCount = Math.floor(this.chunkSize / gridSize)
    for (let i = 0; i <= hCount; i++) {
      const y = i * gridSize + this.rng.gaussian(0, imperfection * gridSize)
      const isMain = i === Math.floor(hCount / 2)
      streets.push({
        id: `h_${i}`,
        points: [
          { x: 0, y: Math.max(0, Math.min(this.chunkSize, y)) },
          { x: this.chunkSize, y: Math.max(0, Math.min(this.chunkSize, y + this.rng.gaussian(0, 2))) },
        ],
        width: isMain ? 8 : 5,
        type: isMain ? 'main' : 'side',
      })
    }

    const vCount = Math.floor(this.chunkSize / gridSize)
    for (let i = 0; i <= vCount; i++) {
      const x = i * gridSize + this.rng.gaussian(0, imperfection * gridSize)
      const isMain = i === Math.floor(vCount / 2)
      streets.push({
        id: `v_${i}`,
        points: [
          { x: Math.max(0, Math.min(this.chunkSize, x)), y: 0 },
          { x: Math.max(0, Math.min(this.chunkSize, x + this.rng.gaussian(0, 2))), y: this.chunkSize },
        ],
        width: isMain ? 8 : 5,
        type: isMain ? 'main' : 'side',
      })
    }

    return streets
  }

  generateLots(gridSize: number = 20): Lot[] {
    const lots: Lot[] = []
    const lotMargin = 2
    const blocksX = Math.floor(this.chunkSize / gridSize)
    const blocksY = Math.floor(this.chunkSize / gridSize)
    let lotId = 0

    for (let bx = 0; bx < blocksX; bx++) {
      for (let by = 0; by < blocksY; by++) {
        const blockX = bx * gridSize + lotMargin
        const blockY = by * gridSize + lotMargin
        const blockW = gridSize - lotMargin * 2
        const blockH = gridSize - lotMargin * 2
        const subdiv = this.rng.rangeInt(1, 3)
        const lotW = blockW / subdiv

        for (let lx = 0; lx < subdiv; lx++) {
          for (let ly = 0; ly < subdiv; ly++) {
            const x = blockX + lx * lotW
            const y = blockY + ly * (blockH / subdiv)
            const w = lotW - 1
            const h = blockH / subdiv - 1
            const center = { x: x + w / 2, y: y + h / 2 }
            const vertices = [
              { x, y }, { x: x + w, y },
              { x: x + w, y: y + h }, { x, y: y + h },
            ]
            lots.push({ id: `lot_${lotId++}`, center, vertices, area: w * h })
          }
        }
      }
    }

    return lots
  }

  generate(gridSize: number = 20): ChunkLayout {
    const streets = this.generateStreets(gridSize)
    const lots = this.generateLots(gridSize)
    const pois: Point[] = []
    for (let i = 0; i < this.chunkSize; i += gridSize) {
      for (let j = 0; j < this.chunkSize; j += gridSize) {
        if (this.rng.next() < 0.2) pois.push({ x: i, y: j })
      }
    }
    return { streets, lots, pois }
  }
}

// ============================================
// RADIAL TOPOLOGY — Concentric rings
// ============================================

export class RadialTopology {
  private rng: SeededRNG
  private chunkSize: number = 100

  constructor(seed: string) {
    this.rng = new SeededRNG(seed)
  }

  generateStreets(ringCount: number = 3, radialCount: number = 8): Street[] {
    const streets: Street[] = []
    const center = { x: this.chunkSize / 2, y: this.chunkSize / 2 }
    const maxRadius = this.chunkSize / 2 - 5

    for (let r = 1; r <= ringCount; r++) {
      const radius = (r / ringCount) * maxRadius
      const points: Point[] = []
      const segments = 24
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2
        points.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        })
      }
      streets.push({
        id: `ring_${r}`, points, width: r === ringCount ? 6 : 4,
        type: r === ringCount ? 'main' : 'side',
      })
    }

    for (let i = 0; i < radialCount; i++) {
      const angle = (i / radialCount) * Math.PI * 2 + this.rng.gaussian(0, 0.1)
      streets.push({
        id: `radial_${i}`,
        points: [{ x: center.x, y: center.y }, {
          x: center.x + Math.cos(angle) * maxRadius,
          y: center.y + Math.sin(angle) * maxRadius,
        }],
        width: 5, type: 'main',
      })
    }

    return streets
  }

  generateLots(ringCount: number = 3, radialCount: number = 8): Lot[] {
    const lots: Lot[] = []
    const center = { x: this.chunkSize / 2, y: this.chunkSize / 2 }
    const maxRadius = this.chunkSize / 2 - 5
    let lotId = 0

    for (let r = 0; r < ringCount; r++) {
      const innerRadius = (r / ringCount) * maxRadius + 3
      const outerRadius = ((r + 1) / ringCount) * maxRadius - 3

      for (let i = 0; i < radialCount; i++) {
        const startAngle = (i / radialCount) * Math.PI * 2 + 0.05
        const endAngle = ((i + 1) / radialCount) * Math.PI * 2 - 0.05
        const midAngle = (startAngle + endAngle) / 2
        const midRadius = (innerRadius + outerRadius) / 2

        const lotCenter = {
          x: center.x + Math.cos(midAngle) * midRadius,
          y: center.y + Math.sin(midAngle) * midRadius,
        }

        const vertices = [
          { x: center.x + Math.cos(startAngle) * innerRadius, y: center.y + Math.sin(startAngle) * innerRadius },
          { x: center.x + Math.cos(endAngle) * innerRadius, y: center.y + Math.sin(endAngle) * innerRadius },
          { x: center.x + Math.cos(endAngle) * outerRadius, y: center.y + Math.sin(endAngle) * outerRadius },
          { x: center.x + Math.cos(startAngle) * outerRadius, y: center.y + Math.sin(startAngle) * outerRadius },
        ]

        const area = ((endAngle - startAngle) / 2) * (outerRadius * outerRadius - innerRadius * innerRadius)
        lots.push({ id: `lot_${lotId++}`, center: lotCenter, vertices, area })
      }
    }

    return lots
  }

  generate(): ChunkLayout {
    const ringCount = this.rng.rangeInt(2, 4)
    const radialCount = this.rng.rangeInt(6, 10)
    const streets = this.generateStreets(ringCount, radialCount)
    const lots = this.generateLots(ringCount, radialCount)
    const pois: Point[] = [{ x: this.chunkSize / 2, y: this.chunkSize / 2 }]
    return { streets, lots, pois }
  }
}

// ============================================
// LINEAR TOPOLOGY — Along road/river
// ============================================

export class LinearTopology {
  private rng: SeededRNG
  private chunkSize: number = 100

  constructor(seed: string) {
    this.rng = new SeededRNG(seed)
  }

  generateStreets(isRiver: boolean = false): Street[] {
    const streets: Street[] = []

    const mainPoints: Point[] = []
    const steps = 10
    let y = this.chunkSize / 2

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * this.chunkSize
      y += this.rng.gaussian(0, 3)
      y = Math.max(30, Math.min(70, y))
      mainPoints.push({ x, y })
    }

    streets.push({ id: 'main', points: mainPoints, width: isRiver ? 12 : 8, type: 'main' })

    const crossCount = this.rng.rangeInt(3, 6)
    for (let i = 0; i < crossCount; i++) {
      const x = this.rng.range(15, 85)
      const mainY = this.interpolateY(mainPoints, x)
      streets.push({
        id: `cross_${i}`,
        points: [
          { x, y: mainY - 25 },
          { x: x + this.rng.gaussian(0, 3), y: mainY + 25 },
        ],
        width: 4, type: 'side',
      })
    }

    return streets
  }

  private interpolateY(points: Point[], x: number): number {
    for (let i = 0; i < points.length - 1; i++) {
      if (x >= points[i].x && x <= points[i + 1].x) {
        const t = (x - points[i].x) / (points[i + 1].x - points[i].x)
        return points[i].y + t * (points[i + 1].y - points[i].y)
      }
    }
    return this.chunkSize / 2
  }

  generateLots(mainPoints: Point[]): Lot[] {
    const lots: Lot[] = []
    const lotDepth = 15
    const lotWidth = 10
    let lotId = 0

    for (let x = 10; x < this.chunkSize - 10; x += lotWidth + 2) {
      const mainY = this.interpolateY(mainPoints, x)

      // North side
      lots.push({
        id: `lot_${lotId++}`,
        center: { x: x + lotWidth / 2, y: mainY - 8 - lotDepth / 2 },
        vertices: [
          { x, y: mainY - 8 }, { x: x + lotWidth, y: mainY - 8 },
          { x: x + lotWidth, y: mainY - 8 - lotDepth }, { x, y: mainY - 8 - lotDepth },
        ],
        area: lotWidth * lotDepth,
      })

      // South side
      lots.push({
        id: `lot_${lotId++}`,
        center: { x: x + lotWidth / 2, y: mainY + 8 + lotDepth / 2 },
        vertices: [
          { x, y: mainY + 8 }, { x: x + lotWidth, y: mainY + 8 },
          { x: x + lotWidth, y: mainY + 8 + lotDepth }, { x, y: mainY + 8 + lotDepth },
        ],
        area: lotWidth * lotDepth,
      })
    }

    return lots
  }

  generate(isRiver: boolean = false): ChunkLayout {
    const streets = this.generateStreets(isRiver)
    const mainStreet = streets.find(s => s.id === 'main')!
    const lots = this.generateLots(mainStreet.points)
    const pois: Point[] = []
    for (let i = 0; i < 3; i++) pois.push(this.rng.pick(mainStreet.points))
    return { streets, lots, pois }
  }
}

// ============================================
// HYBRID TOPOLOGY — Natural core + planned outer
// ============================================

export class HybridTopology {
  private rng: SeededRNG
  private chunkSize: number = 100

  constructor(seed: string) {
    this.rng = new SeededRNG(seed)
  }

  generate(coreRadius: number = 40): ChunkLayout {
    const center = { x: this.chunkSize / 2, y: this.chunkSize / 2 }

    const natural = new NaturalTopology(this.rng.next().toString())
    const core = natural.generate(0.7)

    const planned = new PlannedTopology(this.rng.next().toString())
    const outer = planned.generate(25)

    const streets: Street[] = []
    const lots: Lot[] = []

    for (const street of core.streets) {
      const avgX = street.points.reduce((s, p) => s + p.x, 0) / street.points.length
      const avgY = street.points.reduce((s, p) => s + p.y, 0) / street.points.length
      if (Math.hypot(avgX - center.x, avgY - center.y) < coreRadius) streets.push(street)
    }

    for (const street of outer.streets) {
      const avgX = street.points.reduce((s, p) => s + p.x, 0) / street.points.length
      const avgY = street.points.reduce((s, p) => s + p.y, 0) / street.points.length
      if (Math.hypot(avgX - center.x, avgY - center.y) >= coreRadius - 5) {
        streets.push({ ...street, id: `outer_${street.id}` })
      }
    }

    for (const lot of core.lots) {
      if (Math.hypot(lot.center.x - center.x, lot.center.y - center.y) < coreRadius) lots.push(lot)
    }

    for (const lot of outer.lots) {
      if (Math.hypot(lot.center.x - center.x, lot.center.y - center.y) >= coreRadius - 5) {
        lots.push({ ...lot, id: `outer_${lot.id}` })
      }
    }

    return { streets, lots, pois: [...core.pois, ...outer.pois] }
  }
}

// ============================================
// TOPOLOGY FACTORY
// ============================================

export function generateChunkLayout(
  topology: TopologyType,
  seed: string,
  density: number = 0.5,
): ChunkLayout {
  switch (topology) {
    case 'natural':
      return new NaturalTopology(seed).generate(density)
    case 'planned':
      return new PlannedTopology(seed).generate(Math.floor(15 + density * 10))
    case 'radial':
      return new RadialTopology(seed).generate()
    case 'linear':
      return new LinearTopology(seed).generate(false)
    case 'hybrid':
      return new HybridTopology(seed).generate(35 + density * 15)
    case 'clustered': {
      const rng = new SeededRNG(seed)
      const base = new NaturalTopology(seed).generate(density * 0.7)
      const offset = { x: rng.range(-30, 30), y: rng.range(-30, 30) }
      const secondary = new NaturalTopology(seed + '_2').generate(density * 0.5)
      return {
        streets: [
          ...base.streets,
          ...secondary.streets.map(s => ({
            ...s,
            id: `cluster2_${s.id}`,
            points: s.points.map(p => ({
              x: Math.max(0, Math.min(100, p.x + offset.x)),
              y: Math.max(0, Math.min(100, p.y + offset.y)),
            })),
          })),
        ],
        lots: [
          ...base.lots,
          ...secondary.lots.map(l => ({
            ...l,
            id: `cluster2_${l.id}`,
            center: {
              x: Math.max(0, Math.min(100, l.center.x + offset.x)),
              y: Math.max(0, Math.min(100, l.center.y + offset.y)),
            },
            vertices: l.vertices.map(v => ({
              x: Math.max(0, Math.min(100, v.x + offset.x)),
              y: Math.max(0, Math.min(100, v.y + offset.y)),
            })),
          })),
        ],
        pois: [...base.pois, ...secondary.pois.map(p => ({
          x: Math.max(0, Math.min(100, p.x + offset.x)),
          y: Math.max(0, Math.min(100, p.y + offset.y)),
        }))],
      }
    }
    default:
      return new NaturalTopology(seed).generate(density)
  }
}

// ============================================
// DISTRICT PLACEMENT — Flood-fill from center
// ============================================

export function generateDistrictLayout(
  size: HubSize,
  _topology: TopologyType,
  seed: string,
): Map<string, DistrictType> {
  const rng = new SeededRNG(seed)
  const config = HUB_SIZE_CONFIG[size]
  const chunkCount = rng.rangeInt(config.minChunks, config.maxChunks)
  rng.rangeInt(config.districtCount.min, config.districtCount.max) // consume for consistency

  const gridSize = Math.ceil(Math.sqrt(chunkCount))
  const layout = new Map<string, DistrictType>()

  // Always have a center
  const centerX = Math.floor(gridSize / 2)
  const centerY = Math.floor(gridSize / 2)
  layout.set(`${centerX},${centerY}`, 'center')

  const availableTypes: DistrictType[] = [
    'residential', 'commercial', 'industrial', 'religious',
  ]
  if (size === 'city' || size === 'metropolis') {
    availableTypes.push('noble', 'academic', 'entertainment', 'magical')
  }
  if (config.hasCastle) {
    availableTypes.push('administrative', 'military')
  }

  // Flood fill from center
  const assigned = new Set<string>([`${centerX},${centerY}`])
  const frontier: { x: number; y: number; type: DistrictType }[] = []
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]]

  for (const [dx, dy] of neighbors) {
    const nx = centerX + dx
    const ny = centerY + dy
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      const adjacentTo = DISTRICT_ADJACENCY['center']
      const validTypes = availableTypes.filter(t => adjacentTo.includes(t))
      const type = rng.pick(validTypes.length > 0 ? validTypes : availableTypes)
      frontier.push({ x: nx, y: ny, type })
    }
  }

  while (frontier.length > 0 && assigned.size < chunkCount) {
    const { x, y, type } = frontier.shift()!
    const key = `${x},${y}`
    if (assigned.has(key)) continue

    layout.set(key, type)
    assigned.add(key)

    for (const [dx, dy] of neighbors) {
      const nx = x + dx
      const ny = y + dy
      const nkey = `${nx},${ny}`

      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !assigned.has(nkey)) {
        if (rng.next() < 0.6) {
          frontier.push({ x: nx, y: ny, type })
        } else {
          const adjacentTo = DISTRICT_ADJACENCY[type]
          const validTypes = availableTypes.filter(t => adjacentTo.includes(t))
          const newType = rng.pick(validTypes.length > 0 ? validTypes : availableTypes)
          frontier.push({ x: nx, y: ny, type: newType })
        }
      }
    }
  }

  return layout
}
