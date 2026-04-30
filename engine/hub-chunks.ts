/**
 * HUB CHUNKS — On-demand Generation & Observer-local Rendering
 * ================================================================
 *
 * The manifold philosophy:
 * Each observer sees a locally flat neighborhood.
 * The global curvature emerges from stitching.
 *
 * ChunkManager:
 *   1. IMMEDIATE → current chunk (always loaded)
 *   2. ADJACENT  → 8 surrounding chunks (loaded)
 *   3. TRAJECTORY → predicted path (pre-loaded)
 *   4. CACHED    → recently visited (LRU, max 16)
 *   5. COLD      → regenerate from seed (FREE!)
 *
 * HubGenerator:
 *   Produces a full Hub from a HubSeed.
 *   Districts, services, defenses, governance — all deterministic.
 */

import {
  Hub,
  HubChunk,
  HubBuilding,
  HubDistrict,
  HubObserverState,
  HubSeed,
  BuildingType,
  DistrictType,
  CHUNK_LOAD_RADIUS,
  MAX_CACHED_CHUNKS,
  HUB_SIZE_CONFIG,
} from './hub-schema.js'

import {
  SeededRNG,
  generateChunkLayout,
  generateDistrictLayout,
  Lot,
} from './hub-topology.js'

// ============================================
// CHUNK MANAGER
// ============================================

export class ChunkManager {
  private hub: Hub
  private chunkCache: Map<string, HubChunk> = new Map()
  private accessOrder: string[] = []
  private districtLayout: Map<string, DistrictType>

  constructor(hub: Hub) {
    this.hub = hub
    this.districtLayout = generateDistrictLayout(hub.size, hub.topology, hub.seed)
  }

  /** Get chunk at position, generating if needed. */
  getChunk(x: number, y: number): HubChunk {
    const key = `${x},${y}`
    if (this.chunkCache.has(key)) {
      this.touchCache(key)
      return this.chunkCache.get(key)!
    }
    const chunk = this.generateChunk(x, y)
    this.cacheChunk(key, chunk)
    return chunk
  }

  /** Load chunks for an observer. Returns chunks to render. */
  loadForObserver(observer: HubObserverState): HubChunk[] {
    const loaded: HubChunk[] = []
    const { currentChunk, trajectory } = observer

    // 1. Current chunk (always)
    loaded.push(this.getChunk(currentChunk.x, currentChunk.y))

    // 2. Adjacent chunks (8 neighbors)
    for (let dx = -CHUNK_LOAD_RADIUS.adjacent; dx <= CHUNK_LOAD_RADIUS.adjacent; dx++) {
      for (let dy = -CHUNK_LOAD_RADIUS.adjacent; dy <= CHUNK_LOAD_RADIUS.adjacent; dy++) {
        if (dx === 0 && dy === 0) continue
        const nx = currentChunk.x + dx
        const ny = currentChunk.y + dy
        if (this.isValidChunk(nx, ny)) loaded.push(this.getChunk(nx, ny))
      }
    }

    // 3. Trajectory chunks (pre-load predicted path)
    for (const predicted of trajectory) {
      if (predicted.probability > 0.3 && this.isValidChunk(predicted.x, predicted.y)) {
        loaded.push(this.getChunk(predicted.x, predicted.y))
      }
    }

    return loaded
  }

  /** Update observer's trajectory prediction. */
  updateTrajectory(
    observer: HubObserverState,
    velocity: { dx: number; dy: number },
    destination?: { x: number; y: number },
  ): HubObserverState {
    const trajectory: { x: number; y: number; probability: number }[] = []
    const { currentChunk } = observer

    if (velocity.dx !== 0 || velocity.dy !== 0) {
      const ndx = Math.sign(velocity.dx)
      const ndy = Math.sign(velocity.dy)
      for (let i = 1; i <= 3; i++) {
        trajectory.push({
          x: currentChunk.x + ndx * i,
          y: currentChunk.y + ndy * i,
          probability: 1 - (i * 0.25),
        })
      }
    }

    if (destination) {
      const dx = Math.sign(destination.x - currentChunk.x)
      const dy = Math.sign(destination.y - currentChunk.y)
      let x = currentChunk.x
      let y = currentChunk.y
      let prob = 0.8

      while ((x !== destination.x || y !== destination.y) && prob > 0.1) {
        if (x !== destination.x) x += dx
        if (y !== destination.y) y += dy
        trajectory.push({ x, y, probability: prob })
        prob *= 0.9
      }
    }

    return { ...observer, trajectory }
  }

  /** Generate a chunk deterministically from seed. */
  private generateChunk(x: number, y: number): HubChunk {
    const chunkSeed = `${this.hub.seed}_chunk_${x}_${y}`
    const rng = new SeededRNG(chunkSeed)

    const districtType = this.districtLayout.get(`${x},${y}`) ?? 'residential'
    const district = this.hub.districts.find(d => d.type === districtType)
    const topology = district?.topology ?? this.hub.topology

    const density = getDensityForDistrict(districtType)
    const layout = generateChunkLayout(topology, chunkSeed, density)

    const buildings = generateBuildings(layout.lots, districtType, rng)
    const streets = layout.streets.map(s => ({
      id: s.id,
      name: generateStreetName(s.type, rng),
      points: s.points,
      width: s.width,
      type: s.type,
      material: getStreetMaterial(districtType, s.type, rng),
    }))

    const pois = layout.pois.map(p => ({
      id: `poi_${rng.rangeInt(1000, 9999)}`,
      type: getPOIType(districtType, rng),
      position: p,
      interactable: rng.next() < 0.5,
    }))

    return {
      x, y,
      hubId: this.hub.worldNodeId,
      districtId: district?.id ?? `district_${districtType}`,
      districtType,
      topology,
      buildings,
      streets,
      pois,
      edges: {
        north: this.isValidChunk(x, y - 1) ? `${x},${y - 1}` : undefined,
        south: this.isValidChunk(x, y + 1) ? `${x},${y + 1}` : undefined,
        east: this.isValidChunk(x + 1, y) ? `${x + 1},${y}` : undefined,
        west: this.isValidChunk(x - 1, y) ? `${x - 1},${y}` : undefined,
      },
      seed: chunkSeed,
    }
  }

  private isValidChunk(x: number, y: number): boolean {
    return x >= 0 && x < this.hub.chunkGrid.width && y >= 0 && y < this.hub.chunkGrid.height
  }

  private cacheChunk(key: string, chunk: HubChunk): void {
    this.chunkCache.set(key, chunk)
    this.accessOrder.push(key)
    while (this.chunkCache.size > MAX_CACHED_CHUNKS) {
      const oldest = this.accessOrder.shift()!
      this.chunkCache.delete(oldest)
    }
  }

  private touchCache(key: string): void {
    const idx = this.accessOrder.indexOf(key)
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1)
      this.accessOrder.push(key)
    }
  }

  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return { size: this.chunkCache.size, maxSize: MAX_CACHED_CHUNKS, keys: [...this.chunkCache.keys()] }
  }

  clearCache(): void {
    this.chunkCache.clear()
    this.accessOrder = []
  }
}

// ============================================
// BUILDING/STREET/POI GENERATION HELPERS
// ============================================

function generateBuildings(lots: Lot[], districtType: DistrictType, rng: SeededRNG): HubBuilding[] {
  const buildingTypes = getBuildingTypesForDistrict(districtType)

  return lots.map(lot => {
    const type = rng.weightedPick(
      buildingTypes.map(b => b.type),
      buildingTypes.map(b => b.weight),
    )

    const minX = Math.min(...lot.vertices.map(v => v.x))
    const maxX = Math.max(...lot.vertices.map(v => v.x))
    const minY = Math.min(...lot.vertices.map(v => v.y))
    const maxY = Math.max(...lot.vertices.map(v => v.y))
    const width = (maxX - minX) * (0.6 + rng.next() * 0.3)
    const height = (maxY - minY) * (0.6 + rng.next() * 0.3)

    return {
      id: `bld_${rng.rangeInt(10000, 99999)}`,
      type,
      name: generateBuildingName(type, rng),
      position: { x: lot.center.x - width / 2, y: lot.center.y - height / 2 },
      size: { width, height },
      rotation: rng.gaussian(0, 5),
      isOpen: rng.next() > 0.1,
      isAbandoned: rng.next() < 0.05,
      floors: getBuildingFloors(type, districtType, rng),
      hasInterior: true,
      interiorSeed: rng.next().toString(),
    }
  })
}

const BUILDING_TYPES_BY_DISTRICT: Record<DistrictType, { type: BuildingType; weight: number }[]> = {
  center:         [{ type: 'town_hall', weight: 5 }, { type: 'shop', weight: 20 }, { type: 'tavern', weight: 10 }, { type: 'inn', weight: 8 }, { type: 'temple', weight: 5 }, { type: 'house', weight: 10 }],
  residential:    [{ type: 'house', weight: 40 }, { type: 'townhouse', weight: 20 }, { type: 'apartment', weight: 10 }, { type: 'hovel', weight: 10 }, { type: 'shop', weight: 5 }, { type: 'shrine', weight: 3 }, { type: 'well', weight: 2 }],
  commercial:     [{ type: 'shop', weight: 30 }, { type: 'warehouse', weight: 15 }, { type: 'inn', weight: 10 }, { type: 'restaurant', weight: 10 }, { type: 'bank', weight: 5 }, { type: 'guildhall', weight: 5 }, { type: 'market_stall', weight: 20 }],
  industrial:     [{ type: 'workshop', weight: 25 }, { type: 'smithy', weight: 15 }, { type: 'tannery', weight: 10 }, { type: 'mill', weight: 10 }, { type: 'brewery', weight: 10 }, { type: 'warehouse', weight: 15 }, { type: 'hovel', weight: 10 }],
  religious:      [{ type: 'temple', weight: 20 }, { type: 'shrine', weight: 15 }, { type: 'monastery', weight: 10 }, { type: 'house', weight: 20 }, { type: 'library', weight: 5 }, { type: 'hospital', weight: 5 }],
  administrative: [{ type: 'town_hall', weight: 15 }, { type: 'courthouse', weight: 15 }, { type: 'prison', weight: 10 }, { type: 'guardhouse', weight: 10 }, { type: 'barracks', weight: 10 }, { type: 'townhouse', weight: 15 }],
  noble:          [{ type: 'manor', weight: 30 }, { type: 'townhouse', weight: 25 }, { type: 'house', weight: 15 }, { type: 'stable', weight: 10 }, { type: 'fountain', weight: 5 }],
  slums:          [{ type: 'hovel', weight: 50 }, { type: 'house', weight: 20 }, { type: 'tavern', weight: 10 }, { type: 'shop', weight: 5 }, { type: 'well', weight: 5 }],
  docks:          [{ type: 'warehouse', weight: 30 }, { type: 'dock', weight: 20 }, { type: 'tavern', weight: 15 }, { type: 'shop', weight: 10 }, { type: 'inn', weight: 10 }, { type: 'hovel', weight: 10 }],
  military:       [{ type: 'barracks', weight: 30 }, { type: 'guardhouse', weight: 15 }, { type: 'tower', weight: 15 }, { type: 'stable', weight: 10 }, { type: 'smithy', weight: 10 }, { type: 'wall_section', weight: 10 }],
  academic:       [{ type: 'library', weight: 25 }, { type: 'school', weight: 20 }, { type: 'tower', weight: 10 }, { type: 'townhouse', weight: 20 }, { type: 'shop', weight: 10 }],
  entertainment:  [{ type: 'tavern', weight: 25 }, { type: 'theater', weight: 15 }, { type: 'arena', weight: 10 }, { type: 'bathhouse', weight: 10 }, { type: 'inn', weight: 15 }, { type: 'restaurant', weight: 10 }],
  magical:        [{ type: 'tower', weight: 30 }, { type: 'shop', weight: 20 }, { type: 'library', weight: 15 }, { type: 'townhouse', weight: 15 }, { type: 'shrine', weight: 10 }],
  foreign:        [{ type: 'shop', weight: 25 }, { type: 'inn', weight: 20 }, { type: 'restaurant', weight: 15 }, { type: 'warehouse', weight: 15 }, { type: 'house', weight: 15 }, { type: 'temple', weight: 5 }],
  garden:         [{ type: 'manor', weight: 20 }, { type: 'fountain', weight: 20 }, { type: 'shrine', weight: 15 }, { type: 'stable', weight: 10 }, { type: 'house', weight: 20 }],
  necropolis:     [{ type: 'shrine', weight: 30 }, { type: 'temple', weight: 20 }, { type: 'tower', weight: 15 }, { type: 'hovel', weight: 10 }, { type: 'wall_section', weight: 15 }],
}

function getBuildingTypesForDistrict(district: DistrictType): { type: BuildingType; weight: number }[] {
  return BUILDING_TYPES_BY_DISTRICT[district]
}

function getDensityForDistrict(district: DistrictType): number {
  const d: Record<DistrictType, number> = {
    center: 0.8, residential: 0.6, commercial: 0.9, industrial: 0.5,
    religious: 0.4, administrative: 0.5, noble: 0.3, slums: 0.9,
    docks: 0.7, military: 0.6, academic: 0.5, entertainment: 0.7,
    magical: 0.4, foreign: 0.7, garden: 0.2, necropolis: 0.3,
  }
  return d[district]
}

function getBuildingFloors(type: BuildingType, district: DistrictType, rng: SeededRNG): number {
  const base: Record<BuildingType, number> = {
    hovel: 1, house: 1, townhouse: 2, manor: 2, apartment: 3,
    shop: 1, market_stall: 1, warehouse: 1, inn: 2, tavern: 1, restaurant: 1, bank: 2, guildhall: 2,
    smithy: 1, tannery: 1, mill: 2, workshop: 1, brewery: 1,
    temple: 1, shrine: 1, monastery: 2,
    town_hall: 2, courthouse: 2, prison: 2, barracks: 2, guardhouse: 1, gatehouse: 2, tower: 4,
    library: 2, school: 2, hospital: 2, theater: 2, arena: 1, bathhouse: 1, stable: 1, dock: 1,
    well: 1, fountain: 1, bridge: 1, wall_section: 2,
  }
  const modifier = (district === 'noble' || district === 'center') ? 1 : 0
  const variance = rng.next() < 0.3 ? 1 : 0
  return (base[type] ?? 1) + modifier + variance
}

function generateStreetName(type: 'main' | 'side' | 'alley' | 'path', rng: SeededRNG): string | undefined {
  if (type === 'alley' || type === 'path') return rng.next() < 0.2 ? 'Back Alley' : undefined

  const prefixes = [
    'High', 'Low', 'Old', 'New', 'North', 'South', 'East', 'West',
    "King's", "Queen's", 'Market', 'Temple', 'Guild', 'Harbor',
    'Castle', 'Mill', 'Copper', 'Silver', 'Gold', 'Iron',
  ]
  const suffixes = ['Street', 'Road', 'Way', 'Lane', 'Row', 'Walk', 'Path', 'Avenue', 'Boulevard', 'Passage']

  return rng.next() < 0.7 ? `${rng.pick(prefixes)} ${rng.pick(suffixes)}` : undefined
}

function getStreetMaterial(
  district: DistrictType,
  type: 'main' | 'side' | 'alley' | 'path',
  rng: SeededRNG,
): 'cobblestone' | 'dirt' | 'gravel' | 'wooden' {
  const wealthy = ['center', 'noble', 'commercial', 'administrative']
  const poor = ['slums', 'industrial']

  if (type === 'main') return wealthy.includes(district) ? 'cobblestone' : poor.includes(district) ? 'gravel' : 'cobblestone'
  if (type === 'side') return wealthy.includes(district) ? 'cobblestone' : poor.includes(district) ? 'dirt' : 'gravel'
  return rng.next() < 0.5 ? 'dirt' : 'gravel'
}

function getPOIType(district: DistrictType, rng: SeededRNG): string {
  const types: Record<DistrictType, string[]> = {
    center: ['fountain', 'statue', 'market_square', 'bulletin_board'],
    residential: ['well', 'garden', 'bench'],
    commercial: ['market_stall', 'fountain', 'sign'],
    industrial: ['water_pump', 'cart', 'stockpile'],
    religious: ['shrine', 'statue', 'garden'],
    administrative: ['statue', 'fountain', 'pillory'],
    noble: ['fountain', 'statue', 'garden'],
    slums: ['well', 'cart', 'debris'],
    docks: ['crane', 'bollard', 'crate'],
    military: ['weapon_rack', 'training_dummy', 'watchtower'],
    academic: ['statue', 'garden', 'bench'],
    entertainment: ['stage', 'fountain', 'bench'],
    magical: ['obelisk', 'circle', 'statue'],
    foreign: ['shrine', 'market_stall', 'statue'],
    garden: ['fountain', 'bench', 'statue'],
    necropolis: ['grave', 'mausoleum', 'memorial'],
  }
  return rng.pick(types[district])
}

function generateBuildingName(type: BuildingType, rng: SeededRNG): string | undefined {
  const namedTypes: BuildingType[] = [
    'inn', 'tavern', 'shop', 'guildhall', 'temple', 'theater', 'arena',
    'town_hall', 'tower', 'manor', 'monastery', 'library', 'bank',
  ]
  if (!namedTypes.includes(type) || rng.next() < 0.3) return undefined

  if (type === 'inn' || type === 'tavern') {
    const adj = ['Prancing', 'Dancing', 'Sleeping', 'Laughing', 'Weeping', 'Golden', 'Silver', 'Red', 'Blue', 'Black', 'White', 'Rusty', 'Broken']
    const noun = ['Pony', 'Dragon', 'Griffin', 'Lion', 'Bear', 'Stag', 'Boar', 'Raven', 'Owl', 'Sword', 'Shield', 'Crown', 'Mug', 'Barrel']
    return `The ${rng.pick(adj)} ${rng.pick(noun)}`
  }

  if (type === 'shop') {
    const owners = ['Grimble', 'Thornwick', 'Ashford', 'Brightwater', 'Ironhand', 'Silverbell', 'Darkwood', 'Goldleaf', 'Stoneheart', 'Quickfoot']
    const suffixes = ['& Sons', '& Co.', "'s Goods", "'s Wares", "'s Emporium"]
    return `${rng.pick(owners)}${rng.pick(suffixes)}`
  }

  return undefined
}

// ============================================
// HUB GENERATOR — Full hub from seed
// ============================================

export class HubGenerator {
  static generate(seed: HubSeed, worldNodeId: string): Hub {
    const rng = new SeededRNG(`${seed.worldNodeId}_${seed.size}_${seed.topology}_${seed.era}`)
    const config = HUB_SIZE_CONFIG[seed.size]

    const population = rng.rangeInt(config.minPop, config.maxPop)
    const chunkCount = rng.rangeInt(config.minChunks, config.maxChunks)
    const gridSize = Math.ceil(Math.sqrt(chunkCount))

    // Districts
    const districtLayout = generateDistrictLayout(seed.size, seed.topology, seed.worldNodeId)
    const districtsByType = new Map<DistrictType, { x: number; y: number }[]>()
    for (const [coord, type] of districtLayout.entries()) {
      const [x, y] = coord.split(',').map(Number)
      if (!districtsByType.has(type)) districtsByType.set(type, [])
      districtsByType.get(type)!.push({ x, y })
    }

    const districts: HubDistrict[] = []
    for (const [type, coords] of districtsByType.entries()) {
      districts.push({
        id: `district_${type}_${rng.rangeInt(100, 999)}`,
        hubId: worldNodeId,
        name: generateDistrictName(type, rng),
        type,
        chunkCoords: coords,
        topology: seed.topology,
        population: Math.floor(population * (coords.length / chunkCount)),
        wealthLevel: getDistrictWealth(type),
        crimeLevel: getDistrictCrime(type),
        factions: [],
        notableLocations: [],
        atmosphere: getDistrictAtmosphere(type),
        seed: `${seed.worldNodeId}_district_${type}`,
      })
    }

    // Services
    const services = {
      hasTemple: config.minPop >= 200 || rng.next() < 0.3,
      hasInn: true,
      hasTavern: true,
      hasSmith: config.minPop >= 100,
      hasMarket: config.minPop >= 500,
      hasStables: config.minPop >= 200,
      hasBank: config.minPop >= 5000,
      hasMageGuild: config.minPop >= 10000 && rng.next() < 0.5,
      hasThievesGuild: config.minPop >= 2000 && rng.next() < 0.3,
      hasHospital: config.minPop >= 5000,
    }

    // Economy
    const economyTypes: Hub['economy']['type'][] = [
      'agricultural', 'trade', 'craft', 'mining', 'fishing', 'military', 'religious', 'academic',
    ]

    // Governance
    const governanceTypes: Hub['governance']['type'][] =
      (seed.size === 'outpost' || seed.size === 'hamlet') ? ['elder', 'none'] :
      seed.size === 'village' ? ['elder', 'council'] :
      seed.size === 'town' ? ['council', 'mayor', 'lord'] :
      ['lord', 'council', 'mayor', 'guild', 'theocratic']

    return {
      worldNodeId,
      name: '',
      size: seed.size,
      seed: seed.worldNodeId,
      population,
      demographics: { human: 60, dwarf: 15, elf: 10, halfling: 8, other: 7 },
      topology: seed.topology,
      chunkGrid: { width: gridSize, height: gridSize },
      districts,
      keyLocations: { entrance: [] },
      defenses: {
        hasWalls: config.hasWalls,
        wallCondition: config.hasWalls ? 'fair' : undefined,
        gateCount: config.hasWalls ? rng.rangeInt(2, 4) : 0,
        hasCastle: config.hasCastle,
        hasMoat: config.hasWalls && rng.next() < 0.3,
        militia: Math.floor(population * 0.05),
        guards: Math.floor(population * 0.02),
      },
      economy: {
        type: rng.pick(economyTypes),
        wealthLevel: 'modest',
        exports: [],
        imports: [],
        hasMarket: services.hasMarket,
        marketDays: services.hasMarket ? ['Godsday'] : [],
      },
      governance: {
        type: rng.pick(governanceTypes),
        lawLevel: 'fair',
      },
      services,
      residentNPCs: [],
      visitingNPCs: [],
      state: {
        isUnderAttack: false,
        isPlagued: false,
        isFamine: false,
        isOccupied: false,
        mood: 'neutral',
      },
      cachedChunks: {},
    }
  }
}

// ============================================
// NAME & ATTRIBUTE GENERATORS
// ============================================

function generateDistrictName(type: DistrictType, rng: SeededRNG): string {
  const prefixes: Record<DistrictType, string[]> = {
    center: ['Market', 'Town', 'Central', 'Main'],
    residential: ['Hearth', 'Home', 'Gate', 'Hill'],
    commercial: ['Trade', 'Merchant', 'Gold', 'Coin'],
    industrial: ['Forge', 'Hammer', 'Smoke', 'Iron'],
    religious: ['Temple', 'Holy', 'Sacred', 'Divine'],
    administrative: ['Crown', 'Law', "King's", 'Council'],
    noble: ['High', 'Noble', 'Royal', 'Grand'],
    slums: ['Low', 'Shadow', 'Rat', 'Mud'],
    docks: ['Harbor', 'Dock', 'Tide', 'Salt'],
    military: ['Sword', 'Shield', 'Guard', 'Watch'],
    academic: ['Scholar', 'Sage', 'Book', 'Quill'],
    entertainment: ['Revel', 'Merry', 'Song', 'Dance'],
    magical: ['Arcane', 'Mystic', 'Star', 'Moon'],
    foreign: ['Stranger', 'Exotic', 'Far', 'Trade'],
    garden: ['Green', 'Rose', 'Oak', 'Meadow'],
    necropolis: ['Silent', 'Gray', 'Memorial', 'Rest'],
  }
  const suffixes = ['Quarter', 'Ward', 'District', 'Row', 'Square']
  return `${rng.pick(prefixes[type])} ${rng.pick(suffixes)}`
}

function getDistrictWealth(type: DistrictType): HubDistrict['wealthLevel'] {
  const w: Record<DistrictType, HubDistrict['wealthLevel']> = {
    center: 'comfortable', residential: 'modest', commercial: 'comfortable',
    industrial: 'poor', religious: 'modest', administrative: 'comfortable',
    noble: 'wealthy', slums: 'destitute', docks: 'poor',
    military: 'modest', academic: 'modest', entertainment: 'modest',
    magical: 'comfortable', foreign: 'modest', garden: 'wealthy', necropolis: 'poor',
  }
  return w[type]
}

function getDistrictCrime(type: DistrictType): HubDistrict['crimeLevel'] {
  const c: Record<DistrictType, HubDistrict['crimeLevel']> = {
    center: 'safe', residential: 'average', commercial: 'average',
    industrial: 'rough', religious: 'safe', administrative: 'patrolled',
    noble: 'patrolled', slums: 'dangerous', docks: 'rough',
    military: 'patrolled', academic: 'safe', entertainment: 'rough',
    magical: 'average', foreign: 'rough', garden: 'safe', necropolis: 'dangerous',
  }
  return c[type]
}

function getDistrictAtmosphere(type: DistrictType): string {
  const a: Record<DistrictType, string> = {
    center: 'Bustling with activity, merchants calling their wares',
    residential: 'Quiet streets, children playing, neighbors chatting',
    commercial: 'Crowded markets, haggling voices, clinking coins',
    industrial: 'Smoke and clanging metal, workers covered in soot',
    religious: 'Incense and chanting, pilgrims seeking blessings',
    administrative: 'Stern officials, long queues, rustling parchment',
    noble: 'Manicured gardens, liveried servants, hushed conversations',
    slums: 'Narrow alleys, suspicious eyes, the smell of refuse',
    docks: 'Salt air, creaking ships, rough sailors',
    military: 'Marching boots, clashing steel, shouted orders',
    academic: 'Hushed libraries, debating scholars, ink-stained fingers',
    entertainment: 'Music and laughter, cheap wine, games of chance',
    magical: 'Strange lights, arcane symbols, the crackle of energy',
    foreign: 'Exotic spices, unfamiliar languages, curious wares',
    garden: 'Birdsong, flowing water, the scent of flowers',
    necropolis: 'Silent stone, weeping mourners, the whisper of wind',
  }
  return a[type]
}
