/**
 * HUB SCHEMA — Settlement Structure
 * ====================================
 *
 * PHILOSOPHY:
 * A hub is a settlement — from hamlet to metropolis.
 * It exists as a WorldNode in the graph, but internally
 * it has structure: districts, streets, buildings, lots.
 *
 * The key insight: render only what the observer sees.
 * A city is locally flat (the neighborhood you're in)
 * but globally curved (the full layout emerges from
 * stitching neighborhoods together).
 *
 * The server stores ONLY seeds + state mutations.
 * The client derives all geometry deterministically.
 */

// ============================================
// HUB SIZE TIERS
// ============================================

export type HubSize = 'outpost' | 'hamlet' | 'village' | 'town' | 'city' | 'metropolis'

export const HUB_SIZE_CONFIG: Record<HubSize, {
  minPop: number
  maxPop: number
  minChunks: number
  maxChunks: number
  districtCount: { min: number; max: number }
  hasWalls: boolean
  hasCastle: boolean
}> = {
  outpost:    { minPop: 10,    maxPop: 50,     minChunks: 1,  maxChunks: 1,  districtCount: { min: 1, max: 1 },  hasWalls: false, hasCastle: false },
  hamlet:     { minPop: 50,    maxPop: 200,    minChunks: 1,  maxChunks: 2,  districtCount: { min: 1, max: 2 },  hasWalls: false, hasCastle: false },
  village:    { minPop: 200,   maxPop: 1000,   minChunks: 2,  maxChunks: 4,  districtCount: { min: 1, max: 3 },  hasWalls: false, hasCastle: false },
  town:       { minPop: 1000,  maxPop: 5000,   minChunks: 4,  maxChunks: 9,  districtCount: { min: 2, max: 5 },  hasWalls: true,  hasCastle: false },
  city:       { minPop: 5000,  maxPop: 25000,  minChunks: 9,  maxChunks: 25, districtCount: { min: 4, max: 8 },  hasWalls: true,  hasCastle: true },
  metropolis: { minPop: 25000, maxPop: 100000, minChunks: 25, maxChunks: 64, districtCount: { min: 6, max: 12 }, hasWalls: true,  hasCastle: true },
}

// ============================================
// TOPOLOGY
// ============================================

export type TopologyType = 'natural' | 'planned' | 'hybrid' | 'radial' | 'linear' | 'clustered'

// ============================================
// DISTRICT TYPES
// ============================================

export type DistrictType =
  | 'center'          // Town square, market, civic buildings
  | 'residential'     // Housing
  | 'commercial'      // Shops, markets
  | 'industrial'      // Smiths, tanneries, workshops
  | 'religious'       // Temple district
  | 'administrative'  // Government, courts
  | 'noble'           // Wealthy residences, manors
  | 'slums'           // Poor housing, crime
  | 'docks'           // Harbor, warehouses
  | 'military'        // Barracks, armory, walls
  | 'academic'        // University, libraries
  | 'entertainment'   // Taverns, theaters, arenas
  | 'magical'         // Wizard towers, arcane shops
  | 'foreign'         // Immigrant quarter, exotic goods
  | 'garden'          // Parks, noble estates
  | 'necropolis'      // Cemetery, catacombs

export const DISTRICT_ADJACENCY: Record<DistrictType, DistrictType[]> = {
  center:         ['commercial', 'residential', 'administrative', 'religious', 'noble'],
  residential:    ['center', 'commercial', 'religious', 'garden', 'slums', 'noble'],
  commercial:     ['center', 'residential', 'docks', 'industrial', 'entertainment', 'foreign'],
  industrial:     ['commercial', 'docks', 'slums', 'military'],
  religious:      ['center', 'residential', 'academic', 'necropolis', 'noble'],
  administrative: ['center', 'noble', 'military', 'religious'],
  noble:          ['center', 'residential', 'garden', 'administrative', 'religious'],
  slums:          ['residential', 'industrial', 'docks', 'entertainment'],
  docks:          ['commercial', 'industrial', 'slums', 'foreign'],
  military:       ['administrative', 'industrial', 'center'],
  academic:       ['religious', 'magical', 'noble', 'center'],
  entertainment:  ['commercial', 'slums', 'docks', 'residential'],
  magical:        ['academic', 'noble', 'center'],
  foreign:        ['commercial', 'docks', 'entertainment'],
  garden:         ['noble', 'residential', 'religious'],
  necropolis:     ['religious', 'slums'],
}

// ============================================
// BUILDING TYPES
// ============================================

export type BuildingType =
  // Residential
  | 'hovel' | 'house' | 'townhouse' | 'manor' | 'apartment'
  // Commercial
  | 'shop' | 'market_stall' | 'warehouse' | 'inn' | 'tavern' | 'restaurant' | 'bank' | 'guildhall'
  // Industrial
  | 'smithy' | 'tannery' | 'mill' | 'workshop' | 'brewery'
  // Religious
  | 'temple' | 'shrine' | 'monastery'
  // Civic
  | 'town_hall' | 'courthouse' | 'prison' | 'barracks' | 'guardhouse' | 'gatehouse' | 'tower'
  // Special
  | 'library' | 'school' | 'hospital' | 'theater' | 'arena' | 'bathhouse' | 'stable' | 'dock'
  // Infrastructure
  | 'well' | 'fountain' | 'bridge' | 'wall_section'

// ============================================
// CHUNK SCHEMA — The Rendering Unit
// ============================================
// A chunk is a 100x100 unit area of the hub.
// Generated on-demand from seed. Cached via LRU.

export interface HubBuilding {
  id: string
  type: BuildingType
  name?: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number
  ownerId?: string
  factionId?: string
  isOpen: boolean
  isAbandoned: boolean
  floors: number
  hasInterior: boolean
  interiorSeed?: string
}

export interface HubStreet {
  id: string
  name?: string
  points: { x: number; y: number }[]
  width: number
  type: 'main' | 'side' | 'alley' | 'path'
  material: 'cobblestone' | 'dirt' | 'gravel' | 'wooden'
}

export interface HubPOI {
  id: string
  type: string
  name?: string
  position: { x: number; y: number }
  interactable: boolean
}

export interface HubChunk {
  x: number
  y: number
  hubId: string
  districtId: string
  districtType: DistrictType
  topology: TopologyType
  buildings: HubBuilding[]
  streets: HubStreet[]
  pois: HubPOI[]
  edges: {
    north?: string
    south?: string
    east?: string
    west?: string
  }
  seed: string
}

// ============================================
// DISTRICT SCHEMA
// ============================================

export interface HubDistrict {
  id: string
  hubId: string
  name: string
  type: DistrictType
  chunkCoords: { x: number; y: number }[]
  topology: TopologyType
  population: number
  wealthLevel: 'destitute' | 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic'
  crimeLevel: 'lawless' | 'dangerous' | 'rough' | 'average' | 'safe' | 'patrolled'
  factions: { factionId: string; influence: number; visibility: string }[]
  notableLocations: string[]
  description?: string
  atmosphere?: string
  seed: string
}

// ============================================
// HUB SCHEMA — The Settlement
// ============================================

export interface Hub {
  worldNodeId: string
  name: string
  size: HubSize
  seed: string
  population: number
  demographics?: Record<string, number>

  topology: TopologyType
  chunkGrid: { width: number; height: number }
  districts: HubDistrict[]

  keyLocations: {
    entrance: string[]
    center?: string
    government?: string
    temple?: string
    market?: string
    inn?: string
    tavern?: string
  }

  defenses: {
    hasWalls: boolean
    wallCondition?: 'ruined' | 'poor' | 'fair' | 'good' | 'excellent'
    gateCount: number
    hasCastle: boolean
    hasMoat: boolean
    militia: number
    guards: number
  }

  economy: {
    type: 'agricultural' | 'trade' | 'craft' | 'mining' | 'fishing' | 'military' | 'religious' | 'academic'
    wealthLevel: 'impoverished' | 'poor' | 'modest' | 'prosperous' | 'wealthy' | 'opulent'
    exports: string[]
    imports: string[]
    hasMarket: boolean
    marketDays: string[]
  }

  governance: {
    type: 'none' | 'elder' | 'council' | 'mayor' | 'lord' | 'guild' | 'theocratic' | 'military'
    ruler?: { npcId?: string; name: string; title: string }
    lawLevel: 'lawless' | 'corrupt' | 'weak' | 'fair' | 'strict' | 'tyrannical'
  }

  services: {
    hasTemple: boolean
    hasInn: boolean
    hasTavern: boolean
    hasSmith: boolean
    hasMarket: boolean
    hasStables: boolean
    hasBank: boolean
    hasMageGuild: boolean
    hasThievesGuild: boolean
    hasHospital: boolean
  }

  residentNPCs: string[]
  visitingNPCs: string[]

  state: {
    isUnderAttack: boolean
    isPlagued: boolean
    isFamine: boolean
    isOccupied: boolean
    mood: 'fearful' | 'tense' | 'neutral' | 'content' | 'festive'
    currentEvent?: string
  }

  cachedChunks: Record<string, boolean>
}

// ============================================
// HUB SEED COMPOSITION
// ============================================
// seed = worldNodeId + size + topology + era
// Same seed always generates the same layout.
// Increment era to "evolve" the city.

export interface HubSeed {
  worldNodeId: string
  size: HubSize
  topology: TopologyType
  era: number
  cultureSeed?: string
}

// ============================================
// OBSERVER STATE — Locally-flat view
// ============================================

export interface HubObserverState {
  characterId: string
  position: { x: number; y: number }
  currentChunk: { x: number; y: number }
  loadedChunks: { x: number; y: number }[]
  trajectory: { x: number; y: number; probability: number }[]
  discoveredBuildings: string[]
  discoveredDistricts: string[]
  knownNPCs: string[]
}

// ============================================
// CHUNK LOADING STRATEGY
// ============================================

export const CHUNK_LOAD_RADIUS = {
  immediate: 0,   // Current chunk
  adjacent: 1,    // 8 neighbors
  trajectory: 2,  // 24 chunks in prediction zone
  cached: 3,      // Keep last N visited chunks
}

export const MAX_CACHED_CHUNKS = 16
