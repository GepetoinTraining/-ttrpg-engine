import { describe, it, expect } from 'vitest'
import {
  APERTURE,
  BASE_FT,
  SCALE_LEVELS_FT,
  SCALE_LABELS,
  MAX_LEVEL,
  TILE_SIZE_PX,
  GRID_NEIGHBOR_DIRS_4,
  GRID_NEIGHBOR_DIRS_8,
  levelOf,
  feetPerTile,
  levelToBase,
  baseToLevel,
  chunkOf,
  localInChunk,
  gridToPixel,
  pixelToGrid,
  gridRound,
  gridNeighbors4,
  gridNeighbors8,
  gridAdjacent,
  chebyshev,
  manhattan,
  euclidean,
  dnd5eDiagonal,
  gridDistance,
  gridRing,
  gridSpiral,
  gridBlock,
  gridLine,
  gridAStar,
  zoomToLevel,
  chunkKey,
  parseChunkKey,
} from '../grid'

describe('grid: scale system', () => {
  it('aperture is 8 (power-of-2 friendly)', () => {
    expect(APERTURE).toBe(8)
  })

  it('base unit is 5ft (D&D combat tile)', () => {
    expect(BASE_FT).toBe(5)
  })

  it('SCALE_LEVELS_FT is 5 × 8^n', () => {
    for (let i = 0; i <= MAX_LEVEL; i++) {
      expect(SCALE_LEVELS_FT[i]).toBe(BASE_FT * APERTURE ** i)
    }
  })

  it('matches Pedro spec values', () => {
    expect(SCALE_LEVELS_FT[0]).toBe(5)        // combat
    expect(SCALE_LEVELS_FT[1]).toBe(40)       // tactical
    expect(SCALE_LEVELS_FT[2]).toBe(320)      // city
    expect(SCALE_LEVELS_FT[3]).toBe(2560)     // L1 map
    expect(SCALE_LEVELS_FT[4]).toBe(20480)    // L2 map
    expect(SCALE_LEVELS_FT[5]).toBe(163840)   // L3 continent (~31mi)
  })

  it('feetPerTile matches the table', () => {
    for (let i = 0; i <= MAX_LEVEL; i++) {
      expect(feetPerTile(i)).toBe(SCALE_LEVELS_FT[i])
    }
  })

  it('feetPerTile throws out of range', () => {
    expect(() => feetPerTile(-1)).toThrow()
    expect(() => feetPerTile(6)).toThrow()
  })

  it('levelOf maps labels back to indices', () => {
    expect(levelOf('combat')).toBe(0)
    expect(levelOf('tactical')).toBe(1)
    expect(levelOf('city')).toBe(2)
    expect(levelOf('mapL1')).toBe(3)
    expect(levelOf('mapL2')).toBe(4)
    expect(levelOf('mapL3')).toBe(5)
  })

  it('SCALE_LABELS has 6 entries matching levels', () => {
    expect(SCALE_LABELS).toHaveLength(6)
    expect(SCALE_LABELS[0]).toBe('combat')
    expect(SCALE_LABELS[5]).toBe('mapL3')
  })
})

describe('grid: level conversions', () => {
  it('levelToBase multiplies by APERTURE^level', () => {
    expect(levelToBase(3, 5, 1)).toEqual({ x: 24, y: 40 })       // ×8
    expect(levelToBase(3, 5, 2)).toEqual({ x: 192, y: 320 })     // ×64
    expect(levelToBase(0, 0, 5)).toEqual({ x: 0, y: 0 })
  })

  it('baseToLevel floor-divides by APERTURE^level', () => {
    expect(baseToLevel(24, 40, 1)).toEqual({ x: 3, y: 5 })
    expect(baseToLevel(25, 41, 1)).toEqual({ x: 3, y: 5 })       // still in same L1 tile
    expect(baseToLevel(31, 47, 1)).toEqual({ x: 3, y: 5 })       // last in same L1 tile
    expect(baseToLevel(32, 48, 1)).toEqual({ x: 4, y: 6 })       // next L1 tile
  })

  it('levelToBase ↔ baseToLevel round-trip on aligned coords', () => {
    for (const [x, y, level] of [
      [3, 5, 1],
      [10, 20, 2],
      [0, 0, 3],
      [1, 1, 5],
    ] as const) {
      const base = levelToBase(x, y, level)
      expect(baseToLevel(base.x, base.y, level)).toEqual({ x, y })
    }
  })

  it('chunkOf finds parent-level chunk', () => {
    // L2 tile (80, 130) → L4 chunk
    // 80 / 8^2 = 80/64 = 1
    // 130 / 64 = 2
    expect(chunkOf(80, 130, 2, 4)).toEqual({ x: 1, y: 2 })
  })

  it('chunkOf throws if parentLevel ≤ level', () => {
    expect(() => chunkOf(0, 0, 3, 3)).toThrow()
    expect(() => chunkOf(0, 0, 3, 2)).toThrow()
  })

  it('localInChunk gives offset within parent chunk', () => {
    // L2 tile (80, 130) inside L4 chunk
    // 80 mod 64 = 16, 130 mod 64 = 2
    expect(localInChunk(80, 130, 2, 4)).toEqual({ x: 16, y: 2 })
  })

  it('localInChunk handles negative coords correctly', () => {
    // -1 mod 8 must be 7, not -1
    expect(localInChunk(-1, -1, 0, 1)).toEqual({ x: 7, y: 7 })
    expect(localInChunk(-9, -9, 0, 1)).toEqual({ x: 7, y: 7 })
  })
})

describe('grid: pixel ↔ grid', () => {
  it('gridToPixel returns tile center', () => {
    expect(gridToPixel(0, 0)).toEqual({ x: TILE_SIZE_PX / 2, y: TILE_SIZE_PX / 2 })
    expect(gridToPixel(2, 3)).toEqual({
      x: 2 * TILE_SIZE_PX + TILE_SIZE_PX / 2,
      y: 3 * TILE_SIZE_PX + TILE_SIZE_PX / 2,
    })
  })

  it('gridToPixel respects custom tileSize', () => {
    expect(gridToPixel(1, 1, 64)).toEqual({ x: 96, y: 96 })  // 64 + 32
  })

  it('pixelToGrid floors to containing tile', () => {
    expect(pixelToGrid(0, 0)).toEqual({ x: 0, y: 0 })
    expect(pixelToGrid(TILE_SIZE_PX - 1, TILE_SIZE_PX - 1)).toEqual({ x: 0, y: 0 })
    expect(pixelToGrid(TILE_SIZE_PX, TILE_SIZE_PX)).toEqual({ x: 1, y: 1 })
  })

  it('pixelToGrid round-trips with gridToPixel center', () => {
    for (const [x, y] of [[0, 0], [3, 5], [-2, 7]] as const) {
      const px = gridToPixel(x, y)
      expect(pixelToGrid(px.x, px.y)).toEqual({ x, y })
    }
  })

  it('gridRound rounds fractional coords', () => {
    expect(gridRound(2.4, 3.6)).toEqual({ x: 2, y: 4 })
    expect(gridRound(-1.5, -1.4)).toEqual({ x: -1, y: -1 })  // -1.5 rounds to -1 in JS
  })
})

describe('grid: neighbors', () => {
  it('GRID_NEIGHBOR_DIRS_4 has 4 cardinal directions', () => {
    expect(GRID_NEIGHBOR_DIRS_4).toHaveLength(4)
    expect(GRID_NEIGHBOR_DIRS_4).toContainEqual([+1, 0])
    expect(GRID_NEIGHBOR_DIRS_4).toContainEqual([0, -1])
    expect(GRID_NEIGHBOR_DIRS_4).toContainEqual([-1, 0])
    expect(GRID_NEIGHBOR_DIRS_4).toContainEqual([0, +1])
  })

  it('GRID_NEIGHBOR_DIRS_8 has 8 directions', () => {
    expect(GRID_NEIGHBOR_DIRS_8).toHaveLength(8)
  })

  it('gridNeighbors4 returns 4 cardinal neighbors of (5, 5)', () => {
    const neighbors = gridNeighbors4(5, 5)
    expect(neighbors).toHaveLength(4)
    expect(neighbors).toContainEqual({ x: 6, y: 5 })
    expect(neighbors).toContainEqual({ x: 4, y: 5 })
    expect(neighbors).toContainEqual({ x: 5, y: 6 })
    expect(neighbors).toContainEqual({ x: 5, y: 4 })
  })

  it('gridNeighbors8 returns all 8 surrounding tiles', () => {
    const neighbors = gridNeighbors8(0, 0)
    expect(neighbors).toHaveLength(8)
    // Diagonals included
    expect(neighbors).toContainEqual({ x: 1, y: 1 })
    expect(neighbors).toContainEqual({ x: -1, y: -1 })
  })

  it('gridAdjacent: 8-way includes diagonals', () => {
    expect(gridAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 }, true)).toBe(true)
    expect(gridAdjacent({ x: 0, y: 0 }, { x: 1, y: 0 }, true)).toBe(true)
    expect(gridAdjacent({ x: 0, y: 0 }, { x: 2, y: 1 }, true)).toBe(false)
  })

  it('gridAdjacent: 4-way excludes diagonals', () => {
    expect(gridAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 }, false)).toBe(false)
    expect(gridAdjacent({ x: 0, y: 0 }, { x: 1, y: 0 }, false)).toBe(true)
  })
})

describe('grid: distance metrics', () => {
  it('chebyshev: max axis-aligned step', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4)
    expect(chebyshev({ x: 0, y: 0 }, { x: -5, y: 2 })).toBe(5)
    expect(chebyshev({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })

  it('manhattan: cardinal step sum', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
    expect(manhattan({ x: 0, y: 0 }, { x: -5, y: 2 })).toBe(7)
  })

  it('euclidean: straight-line distance', () => {
    expect(euclidean({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(euclidean({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0)
  })

  it('dnd5eDiagonal: every other diagonal counts as 2', () => {
    // Pure horizontal: no diagonals
    expect(dnd5eDiagonal({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(5)
    // Pure diagonal of 4 → 4 + floor(4/2) = 4 + 2 = 6
    expect(dnd5eDiagonal({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(6)
    // Mixed: 5 horizontal + 3 diagonal = (5-3) + 3 + floor(3/2) = 2+3+1 = 6
    expect(dnd5eDiagonal({ x: 0, y: 0 }, { x: 5, y: 3 })).toBe(6)
  })

  it('gridDistance defaults to Chebyshev', () => {
    expect(gridDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(
      chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 }),
    )
  })
})

describe('grid: rings & spirals', () => {
  it('ring of radius 0 is just center', () => {
    expect(gridRing({ x: 5, y: 5 }, 0)).toEqual([{ x: 5, y: 5 }])
  })

  it('ring of radius 1 has 8 tiles', () => {
    const ring = gridRing({ x: 0, y: 0 }, 1)
    expect(ring).toHaveLength(8)
    // All at chebyshev distance 1
    for (const t of ring) {
      expect(chebyshev({ x: 0, y: 0 }, t)).toBe(1)
    }
  })

  it('ring of radius 2 has 16 tiles', () => {
    const ring = gridRing({ x: 0, y: 0 }, 2)
    expect(ring).toHaveLength(16)
    for (const t of ring) {
      expect(chebyshev({ x: 0, y: 0 }, t)).toBe(2)
    }
  })

  it('ring of negative radius is empty', () => {
    expect(gridRing({ x: 0, y: 0 }, -1)).toEqual([])
  })

  it('spiral of radius N has 1 + 8 + 16 + ... + 8N tiles', () => {
    expect(gridSpiral({ x: 0, y: 0 }, 0)).toHaveLength(1)
    expect(gridSpiral({ x: 0, y: 0 }, 1)).toHaveLength(9)    // 1 + 8
    expect(gridSpiral({ x: 0, y: 0 }, 2)).toHaveLength(25)   // 1 + 8 + 16
    expect(gridSpiral({ x: 0, y: 0 }, 3)).toHaveLength(49)   // 1 + 8 + 16 + 24
  })

  it('block of halfSide N has (2N+1)^2 tiles', () => {
    expect(gridBlock({ x: 0, y: 0 }, 0)).toHaveLength(1)
    expect(gridBlock({ x: 0, y: 0 }, 1)).toHaveLength(9)
    expect(gridBlock({ x: 0, y: 0 }, 2)).toHaveLength(25)
  })
})

describe('grid: line of sight (Bresenham)', () => {
  it('line from a tile to itself is just that tile', () => {
    expect(gridLine({ x: 3, y: 5 }, { x: 3, y: 5 })).toEqual([{ x: 3, y: 5 }])
  })

  it('horizontal line includes both endpoints', () => {
    const line = gridLine({ x: 0, y: 0 }, { x: 3, y: 0 })
    expect(line[0]).toEqual({ x: 0, y: 0 })
    expect(line[line.length - 1]).toEqual({ x: 3, y: 0 })
    expect(line).toHaveLength(4)
  })

  it('diagonal line is monotonic', () => {
    const line = gridLine({ x: 0, y: 0 }, { x: 5, y: 5 })
    expect(line[0]).toEqual({ x: 0, y: 0 })
    expect(line[line.length - 1]).toEqual({ x: 5, y: 5 })
    // Each step moves along the line (no backtracking)
    for (let i = 1; i < line.length; i++) {
      expect(line[i].x).toBeGreaterThanOrEqual(line[i - 1].x)
      expect(line[i].y).toBeGreaterThanOrEqual(line[i - 1].y)
    }
  })

  it('reverse line works', () => {
    const line = gridLine({ x: 5, y: 5 }, { x: 0, y: 0 })
    expect(line[0]).toEqual({ x: 5, y: 5 })
    expect(line[line.length - 1]).toEqual({ x: 0, y: 0 })
  })
})

describe('grid: A* pathfinding', () => {
  it('start === end returns single-tile path', () => {
    const path = gridAStar({ x: 0, y: 0 }, { x: 0, y: 0 }, () => 1)
    expect(path).toEqual([{ x: 0, y: 0 }])
  })

  it('finds straight path on open grid', () => {
    const path = gridAStar({ x: 0, y: 0 }, { x: 3, y: 0 }, () => 1)
    expect(path).not.toBeNull()
    expect(path![0]).toEqual({ x: 0, y: 0 })
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 })
    expect(path!.length).toBe(4)
  })

  it('respects impassable tiles', () => {
    // Wall at x=2 from y=-1 to y=1; must go around
    const path = gridAStar(
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      (x, y) => (x === 2 && Math.abs(y) <= 1 ? Infinity : 1),
    )
    expect(path).not.toBeNull()
    // Must not pass through any impassable tile
    for (const tile of path!) {
      expect(tile.x === 2 && Math.abs(tile.y) <= 1).toBe(false)
    }
  })

  it('returns null when no path exists', () => {
    // Surround the destination with walls
    const path = gridAStar(
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      (x, y) => {
        if (x === 0 && y === 0) return 1
        if (x === 5 && y === 5) return 1
        // Block everything except the start tile
        if (Math.abs(x - 5) <= 1 && Math.abs(y - 5) <= 1) return Infinity
        return 1
      },
      { maxIter: 1000 },
    )
    expect(path).toBeNull()
  })

  it('8-way pathfinding uses diagonals (shorter path)', () => {
    const path = gridAStar({ x: 0, y: 0 }, { x: 4, y: 4 }, () => 1, { eightWay: true })
    expect(path).not.toBeNull()
    expect(path!.length).toBe(5)  // 4 diagonal steps + start
  })

  it('4-way pathfinding takes Manhattan path', () => {
    const path = gridAStar({ x: 0, y: 0 }, { x: 3, y: 3 }, () => 1, { eightWay: false })
    expect(path).not.toBeNull()
    expect(path!.length).toBe(7)  // 6 cardinal steps + start
  })
})

describe('grid: zoom mapping', () => {
  it('zoomToLevel maps low zoom to high level (continent)', () => {
    expect(zoomToLevel(1)).toBe(5)
    expect(zoomToLevel(2.99)).toBe(5)
  })

  it('zoomToLevel maps high zoom to L0 combat', () => {
    expect(zoomToLevel(700)).toBe(0)
    expect(zoomToLevel(10000)).toBe(0)
  })

  it('zoomToLevel covers all 6 levels across breakpoints', () => {
    expect(zoomToLevel(2)).toBe(5)
    expect(zoomToLevel(5)).toBe(4)
    expect(zoomToLevel(20)).toBe(3)
    expect(zoomToLevel(100)).toBe(2)
    expect(zoomToLevel(300)).toBe(1)
    expect(zoomToLevel(1000)).toBe(0)
  })
})

describe('grid: chunk keys', () => {
  it('chunkKey + parseChunkKey round-trip', () => {
    for (const [x, y] of [[0, 0], [3, 5], [-2, 7], [100, -42]] as const) {
      expect(parseChunkKey(chunkKey(x, y))).toEqual({ x, y })
    }
  })

  it('parseChunkKey returns null on invalid input', () => {
    expect(parseChunkKey('not,a,chunk')).toBeNull()
    expect(parseChunkKey('a,b')).toBeNull()
    expect(parseChunkKey('')).toBeNull()
  })
})
