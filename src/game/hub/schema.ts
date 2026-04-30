/**
 * HUB SCHEMA — Settlement Structure (client-compatible copy)
 * Re-exported from engine/hub-schema.ts with fixed imports for Next.js
 */

// Re-export everything from the engine hub-schema
// This file adapts the engine types for use in src/game/

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
  | 'center'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'religious'
  | 'administrative'
  | 'noble'
  | 'slums'
  | 'docks'
  | 'military'
  | 'academic'
  | 'entertainment'
  | 'magical'
  | 'foreign'
  | 'garden'
  | 'necropolis'

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
// EXTRACTION CAMPS
// ============================================

export type CampType = 'logging' | 'mining' | 'quarry' | 'farm' | 'fishing' | 'hunting' | 'herbalism'

export interface ExtractionCamp {
  id: string
  type: CampType
  position: { q: number; r: number }  // L4 hex coords
  resource: string                     // from regionFeatures entity e.g. 'oak_tree'
  workers: number
  output: string[]                     // produced materials e.g. ['oak_logs', 'firewood']
  seed: string
}

// ============================================
// BUILDING TYPES
// ============================================

export type BuildingType =
  | 'hovel' | 'house' | 'townhouse' | 'manor' | 'apartment'
  | 'shop' | 'market_stall' | 'warehouse' | 'inn' | 'tavern' | 'restaurant' | 'bank' | 'guildhall'
  | 'smithy' | 'tannery' | 'mill' | 'workshop' | 'brewery'
  | 'temple' | 'shrine' | 'monastery'
  | 'town_hall' | 'courthouse' | 'prison' | 'barracks' | 'guardhouse' | 'gatehouse' | 'tower'
  | 'library' | 'school' | 'hospital' | 'theater' | 'arena' | 'bathhouse' | 'stable' | 'dock'
  | 'well' | 'fountain' | 'bridge' | 'wall_section'

// ============================================
// CHUNK SCHEMA
// ============================================

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
// HUB SCHEMA
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
  // Layout-aware generation
  territory: {
    coreRadiusL4: number       // hub building area radius
    territoryRadiusL4: number   // city-owned land (farms, orchards)
    influenceRadiusL4: number   // patrol zone (camps, logging)
  }
  hubRoads: { q: number; r: number }[][]  // internal main road paths (L4 coords)
  gateDirs: number[]                       // gate direction indices (same as HubSeed)
  extractionCamps: ExtractionCamp[]
}

// ============================================
// HUB SEED
// ============================================

export interface HubSeed {
  worldNodeId: string
  size: HubSize
  topology: TopologyType
  era: number
  cultureSeed?: string
  gateDirs: number[]          // hex direction indices (0=E, 1=NE, ...) from L0 road gen
  biomeType: string           // for extraction camp generation
}

// ============================================
// OBSERVER STATE
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

export const CHUNK_LOAD_RADIUS = {
  immediate: 0,
  adjacent: 1,
  trajectory: 2,
  cached: 3,
}

export const MAX_CACHED_CHUNKS = 16
