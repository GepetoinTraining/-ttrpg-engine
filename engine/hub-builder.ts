/**
 * HUB BUILDER — Create Fully Populated Settlement Nodes
 * ========================================================
 * 
 * A hub builder takes a SCALE and wires together:
 *   - .tp node (WorldNode with κ rules)
 *   - MM_actors (territory-spanning rulers)
 *   - MM_local_actors (intra-hub occupations)
 *   - Inventory containers (vaults, warehouses, shops)
 *   - Deposits (natural resources near the settlement)
 *   - Extraction operations (active mining/farming)
 *   - Market state (commodities with supply/demand)
 *   - Logistics connections (trade routes)
 * 
 * SCALE TABLE:
 *   regional_capital  — pop 25000+, Duke-level actor, full market
 *   city              — pop 5000-25000, Lord, large market
 *   town              — pop 1000-5000, Mayor, town market
 *   village           — pop 200-1000, Elder, village market
 *   hamlet            — pop 20-200, no formal market
 *   outpost           — pop 5-20, military or trade post
 */

import { z } from 'zod'
import type { WorldNode } from './tp.js'
import type { Container } from './inventory.js'
import type { Deposit, Extraction, MarketPrice } from './production-chain.js'
import { COMMODITIES, createDeposit, createExtraction } from './production-chain.js'

// ============================================================
// HUB SCALE
// ============================================================

export const HubScaleSchema = z.enum([
  'regional_capital', // Pop 25000+, Duke, full economy
  'city',             // Pop 5000-25000, Lord, large market
  'town',             // Pop 1000-5000, Mayor, guilds
  'village',          // Pop 200-1000, Elder, basic market
  'hamlet',           // Pop 20-200, no formal market
  'outpost',          // Pop 5-20, military or trade
])
export type HubScale = z.infer<typeof HubScaleSchema>

// ============================================================
// SCALE PARAMETERS — What each scale provides
// ============================================================

export interface HubScaleParams {
  popMin: number
  popMax: number
  mmActors: number             // territory-level decision-makers
  localActors: number          // intra-hub occupations
  containers: string[]         // container types present
  depositSlots: number         // natural resource attachments
  marketCommodities: number    // how many commodities traded
  tradeRoutes: number          // logistics connections
  hasGuild: boolean
  hasTreasury: boolean
  hasVault: boolean
  hasBanking: boolean
  militaryPresence: number     // guards/soldiers
  infrastructureLevel: 'none' | 'trail' | 'road' | 'paved'
  farmPlots: number            // agricultural capacity
  fisheryAccess: boolean
}

export const SCALE_PARAMS: Record<HubScale, HubScaleParams> = {
  regional_capital: {
    popMin: 25000, popMax: 100000,
    mmActors: 3, localActors: 30,
    containers: ['treasury', 'vault', 'warehouse', 'warehouse', 'granary', 'granary', 'library', 'gallery', 'armory', 'scroll_rack'],
    depositSlots: 6, marketCommodities: 20, tradeRoutes: 5,
    hasGuild: true, hasTreasury: true, hasVault: true, hasBanking: true,
    militaryPresence: 500, infrastructureLevel: 'paved',
    farmPlots: 12, fisheryAccess: true,
  },
  city: {
    popMin: 5000, popMax: 25000,
    mmActors: 2, localActors: 15,
    containers: ['treasury', 'vault', 'warehouse', 'granary', 'library', 'armory', 'gallery'],
    depositSlots: 4, marketCommodities: 15, tradeRoutes: 3,
    hasGuild: true, hasTreasury: true, hasVault: true, hasBanking: true,
    militaryPresence: 200, infrastructureLevel: 'paved',
    farmPlots: 8, fisheryAccess: true,
  },
  town: {
    popMin: 1000, popMax: 5000,
    mmActors: 1, localActors: 8,
    containers: ['vault', 'warehouse', 'granary', 'library', 'armory'],
    depositSlots: 3, marketCommodities: 10, tradeRoutes: 2,
    hasGuild: true, hasTreasury: false, hasVault: true, hasBanking: false,
    militaryPresence: 50, infrastructureLevel: 'road',
    farmPlots: 5, fisheryAccess: true,
  },
  village: {
    popMin: 200, popMax: 1000,
    mmActors: 0, localActors: 4,
    containers: ['warehouse', 'granary', 'scroll_rack'],
    depositSlots: 2, marketCommodities: 5, tradeRoutes: 1,
    hasGuild: false, hasTreasury: false, hasVault: false, hasBanking: false,
    militaryPresence: 10, infrastructureLevel: 'road',
    farmPlots: 3, fisheryAccess: false,
  },
  hamlet: {
    popMin: 20, popMax: 200,
    mmActors: 0, localActors: 2,
    containers: ['chest'],
    depositSlots: 1, marketCommodities: 3, tradeRoutes: 1,
    hasGuild: false, hasTreasury: false, hasVault: false, hasBanking: false,
    militaryPresence: 2, infrastructureLevel: 'trail',
    farmPlots: 2, fisheryAccess: false,
  },
  outpost: {
    popMin: 5, popMax: 20,
    mmActors: 0, localActors: 1,
    containers: ['chest'],
    depositSlots: 1, marketCommodities: 2, tradeRoutes: 1,
    hasGuild: false, hasTreasury: false, hasVault: false, hasBanking: false,
    militaryPresence: 5, infrastructureLevel: 'trail',
    farmPlots: 0, fisheryAccess: false,
  },
}

// ============================================================
// DISTRICT TEMPLATES — What kind of ward/quarter is this?
// ============================================================

export const DistrictTypeSchema = z.enum([
  'governance',     // Castle Ward — rulers, courts, palace
  'noble',          // Sea Ward — aristocrats, temples, estates
  'trade',          // Trades Ward — guilds, workshops, artisans
  'market',         // Market District — bazaars, shops, commerce
  'dock',           // Dock Ward — port, warehouses, sailors
  'residential',    // North Ward — middle/upper housing
  'common',         // Southern Ward — working class, inns
  'slum',           // Field Ward — poverty, crime, sprawl
  'military',       // Garrison Quarter — barracks, walls, training
  'temple',         // Temple District — clergy, healing, faith
  'arcane',         // Mage Quarter — towers, libraries, components
  'foreign',        // Foreign Quarter — embassies, exotic goods
  'academic',       // University Ward — libraries, sages, schools
  'agricultural',   // Farm Ward — granaries, stockyards, mills
  'entertainment',  // Theater District — arenas, galleries, stages
])
export type DistrictType = z.infer<typeof DistrictTypeSchema>

export interface DistrictTemplate {
  type: DistrictType
  name: string
  /** What fraction of the city's population lives here */
  popFraction: number
  /** Local actor slots for this district */
  localActors: number
  /** Container types this district provides */
  containers: string[]
  /** Market specialization — commodity IDs with extra supply */
  marketSpecialization: string[]
  /** κ law override for this district */
  lawOverride?: string
  /** Extra κ data */
  kappa?: Record<string, unknown>
}

/** Default district layout for a regional capital */
export const DEFAULT_DISTRICTS: DistrictTemplate[] = [
  { type: 'governance', name: 'Castle Ward',     popFraction: 0.05, localActors: 3,  containers: ['treasury', 'vault'], marketSpecialization: [], lawOverride: 'strict', kappa: { governance: true } },
  { type: 'noble',      name: 'Noble Quarter',   popFraction: 0.08, localActors: 3,  containers: ['vault'], marketSpecialization: ['wine', 'art', 'jewelry'], lawOverride: 'strict' },
  { type: 'trade',      name: 'Trades Ward',     popFraction: 0.15, localActors: 8,  containers: ['warehouse', 'warehouse'], marketSpecialization: ['weapons', 'armor', 'tools'], lawOverride: 'moderate' },
  { type: 'market',     name: 'Market District',  popFraction: 0.12, localActors: 6,  containers: ['warehouse'], marketSpecialization: ['spices', 'cloth', 'leather'], lawOverride: 'moderate' },
  { type: 'dock',       name: 'Dock Ward',       popFraction: 0.15, localActors: 5,  containers: ['warehouse', 'warehouse', 'granary'], marketSpecialization: ['fish', 'timber', 'salt'], lawOverride: 'lax' },
  { type: 'residential', name: 'Residential Ward', popFraction: 0.20, localActors: 3, containers: ['granary'], marketSpecialization: ['grain', 'bread'], lawOverride: 'moderate' },
  { type: 'common',     name: 'Common Quarter',  popFraction: 0.15, localActors: 4,  containers: ['warehouse'], marketSpecialization: ['ale', 'meat'], lawOverride: 'lax' },
  { type: 'slum',       name: 'Lower Ward',      popFraction: 0.10, localActors: 2,  containers: ['chest'], marketSpecialization: [], lawOverride: 'none' },
]

// ============================================================
// DISTRICT HUB — A sub-hub within a city
// ============================================================

export interface DistrictHub {
  /** The .tp district node (child of settlement) */
  node: WorldNode
  /** District type */
  type: DistrictType
  /** Population within this district */
  population: number
  /** District's own containers */
  containers: Container[]
  /** District's own local actor slots */
  localActorSlots: number
  /** District market specialization (extra supply for these commodities) */
  marketSpecialization: string[]
  /** District market state */
  market: MarketPrice[]
}

// ============================================================
// HUB — Fully populated settlement node
// ============================================================

export interface Hub {
  /** The .tp world node */
  node: WorldNode

  /** Scale of this hub */
  scale: HubScale

  /** Population */
  population: number

  /** Settlement containers (physical storage) */
  containers: Container[]

  /** Deposits attached to this hub (natural resources nearby) */
  deposits: Deposit[]

  /** Active extraction operations */
  extractions: Extraction[]

  /** Market state (commodity prices) */
  market: MarketPrice[]

  /** MM actor slots (territory decision-makers) */
  actorSlots: number

  /** Local actor slots (intra-hub occupations, across all districts) */
  localActorSlots: number

  /** Military garrison */
  garrison: number

  /** Infrastructure level (affects logistics) */
  infrastructure: 'none' | 'trail' | 'road' | 'paved'

  /** Number of trade route connections */
  tradeRouteSlots: number

  /** Has formal guild presence */
  hasGuild: boolean

  /** Districts (only for regional_capital and city scale) */
  districts: DistrictHub[]

  // ── New system fields ──

  /** Agricultural plot capacity */
  farmPlots: number

  /** Has access to fisheries */
  fisheryAccess: boolean

  /** Adjacent water body IDs */
  waterBodies: string[]

  /** Has banking infrastructure */
  hasBanking: boolean

  /** Regional cuisine type */
  cuisine: string
}

// ============================================================
// BUILDER — Create a Hub at a given scale
// ============================================================

export interface HubBuilderOptions {
  nodeId: string
  name: string
  parentId: string
  scale: HubScale
  /** Specific population (otherwise random within range) */
  population?: number
  /** Natural resources near this settlement */
  naturalResources?: Array<{
    name: string
    type: string
    commodity: string
    quality?: 'depleted' | 'poor' | 'standard' | 'rich' | 'legendary'
  }>
  /** Override κ rules */
  kappa?: Record<string, unknown>
  /** Seed for deterministic generation */
  seed?: number
  /** Custom district layout (only for regional_capital/city) */
  districts?: DistrictTemplate[]
}

/**
 * Build a fully populated hub.
 * 
 * This is the main factory that connects all the systems:
 *   TP node + containers + deposits + extractions + market
 */
export function buildHub(opts: HubBuilderOptions): Hub {
  const params = SCALE_PARAMS[opts.scale]

  // Population
  const population = opts.population ??
    Math.floor(params.popMin + (params.popMax - params.popMin) * seededRandom(opts.seed ?? 0))

  // Create the .tp WorldNode
  const node: WorldNode = {
    id: opts.nodeId,
    type: 'settlement',
    name: opts.name,
    parentId: opts.parentId,
    dataStatic: {
      // Backward-compat top-level fields (some legacy callers read these directly)
      scale: opts.scale,
      population,
      // Inheritable κ — settlement-level overrides on parent rules
      economy: {
        type: opts.scale === 'regional_capital' ? 'imperial_capital' : opts.scale,
        tradeModifier: tradeModForScale(opts.scale),
      },
      law: {
        enforcement: lawForScale(opts.scale),
      },
      military: {
        garrison: params.militaryPresence,
        readiness: 0.5,
        morale: 0.7,
        upkeep: militaryUpkeepForScale(opts.scale),
        fortification: fortificationForScale(opts.scale),
      },
      // Leaf-only κ — seeded with scale-appropriate defaults
      settlement: {
        scale: opts.scale,
        population,
        stability: stabilityForScale(opts.scale),
        unrest: 0,
        morale: 0.7,
        growthRate: growthRateForScale(opts.scale),
        guards: params.militaryPresence,
      },
      market: {
        tier: marketTierForScale(opts.scale),
        venues: {},
        events: [],
        lastTick: 0,
      },
      infrastructure: {
        professions: {},
        buildings: {},
        knowledgeTier: 0,
        workshops: [],
        recipes: [],
      },
      knowledge: {
        seeds: {},
        potentials: [],
        tier: 0,
        library: {
          books: 0,
          scrolls: 0,
          researchSpeed: 1.0,
        },
      },
      ...(params.hasGuild ? {
        guild: {
          chapters: {},
          intel: { sightings: [], rumors: [] },
        },
      } : {}),
      // User-supplied κ overrides ALWAYS win
      ...opts.kappa,
    },
  }

  // Create containers
  const containers = buildContainers(opts.nodeId, opts.name, params)

  // Create deposits from natural resources
  const deposits: Deposit[] = []
  const extractions: Extraction[] = []

  if (opts.naturalResources) {
    for (const res of opts.naturalResources) {
      const deposit = createDeposit(
        res.name,
        opts.nodeId,
        res.type as any,
        res.commodity,
        (res.quality ?? 'standard') as any,
        {
          laborRequired: Math.ceil(population * 0.01),  // 1% of pop
          optimalLabor: Math.ceil(population * 0.05),    // 5% of pop
          baseOutputPerDay: baseOutputForScale(opts.scale),
          discovered: true,
          exploited: true,
          controlledBy: opts.nodeId,
        },
      )
      deposits.push(deposit)

      // Auto-create extraction for exploited deposits
      const warehouseId = containers.find(c => c.type === 'warehouse')?.id ?? containers[0]?.id ?? ''
      if (warehouseId) {
        const extraction = createExtraction(
          deposit.id,
          opts.nodeId,
          opts.nodeId, // settlement owns it
          warehouseId,
          Math.ceil(population * 0.03), // 3% of pop works extraction
        )
        extractions.push(extraction)
      }
    }
  }

  // Build initial market
  const market = buildMarket(opts.scale, params, deposits)

  // Build districts for regional capitals and cities
  const districts: DistrictHub[] = []
  if (opts.scale === 'regional_capital' || opts.scale === 'city') {
    const templates = opts.districts ?? (opts.scale === 'regional_capital' ? DEFAULT_DISTRICTS : DEFAULT_DISTRICTS.slice(0, 4))
    for (let i = 0; i < templates.length; i++) {
      districts.push(buildDistrict(
        opts.nodeId,
        opts.name,
        templates[i],
        population,
        i,
      ))
    }
  }

  // Sum local actors across districts (districts expand the base)
  const totalLocalActors = districts.length > 0
    ? districts.reduce((sum, d) => sum + d.localActorSlots, 0)
    : params.localActors

  return {
    node,
    scale: opts.scale,
    population,
    containers,
    deposits,
    extractions,
    market,
    actorSlots: params.mmActors,
    localActorSlots: totalLocalActors,
    garrison: params.militaryPresence,
    infrastructure: params.infrastructureLevel,
    tradeRouteSlots: params.tradeRoutes,
    hasGuild: params.hasGuild,
    districts,
    farmPlots: params.farmPlots,
    fisheryAccess: params.fisheryAccess,
    waterBodies: [],  // filled by world graph wiring
    hasBanking: params.hasBanking,
    cuisine: 'temperate',  // default, overridden by region
  }
}

// ============================================================
// CONTAINER BUILDER — Physical storage for the settlement
// ============================================================

let _containerId = 0
export function resetContainerIdCounter(): void { _containerId = 0 }

/** Capacity specs per container type */
const CONTAINER_SPECS: Record<string, { weightCapacity: number; volumeCapacity: number }> = {
  treasury:    { weightCapacity: 50000, volumeCapacity: 100 },
  vault:       { weightCapacity: 10000, volumeCapacity: 50 },
  warehouse:   { weightCapacity: 100000, volumeCapacity: 5000 },
  granary:     { weightCapacity: 200000, volumeCapacity: 10000 },
  chest:       { weightCapacity: 300, volumeCapacity: 12 },
  library:     { weightCapacity: 10000, volumeCapacity: 500 },
  scroll_rack: { weightCapacity: 2000, volumeCapacity: 100 },
  gallery:     { weightCapacity: 50000, volumeCapacity: 2000 },
  armory:      { weightCapacity: 20000, volumeCapacity: 1000 },
}

function buildContainers(nodeId: string, name: string, params: HubScaleParams): Container[] {
  const containers: Container[] = []

  for (const type of params.containers) {
    const spec = CONTAINER_SPECS[type] ?? { weightCapacity: 300, volumeCapacity: 12 }
    containers.push({
      id: `container_${++_containerId}`,
      name: `${name} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: type as Container['type'],
      locationNodeId: nodeId,
      ownerId: nodeId,
      weightCapacity: spec.weightCapacity,
      volumeCapacity: spec.volumeCapacity,
      spatialMagic: 'none',
      items: [],
      currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      locked: type === 'vault' || type === 'treasury',
      lockDC: type === 'vault' ? 20 : type === 'treasury' ? 25 : 0,
    })
  }

  return containers
}


// ============================================================
// MARKET BUILDER — Initial commodity prices
// ============================================================

function buildMarket(scale: HubScale, params: HubScaleParams, deposits: Deposit[]): MarketPrice[] {
  const market: MarketPrice[] = []

  // Essential commodities every settlement trades
  const essentials = ['grain', 'water', 'timber', 'tools']
  const produced = deposits.map(d => d.primaryCommodityId)

  // Start with essentials
  for (const id of essentials) {
    const commodity = COMMODITIES[id]
    if (!commodity) continue
    const isLocal = produced.includes(id)
    market.push({
      commodityId: id,
      currentPrice: commodity.basePrice * (isLocal ? 0.8 : 1.2), // local = cheaper, imported = more expensive
      basePrice: commodity.basePrice,
      supply: isLocal ? 200 : 50,
      demand: demandForScale(scale),
      trend: 'stable',
      available: true,
      blackMarketOnly: false,
    })
  }

  // Add locally produced commodities
  for (const id of produced) {
    if (essentials.includes(id)) continue
    const commodity = COMMODITIES[id]
    if (!commodity) continue
    market.push({
      commodityId: id,
      currentPrice: commodity.basePrice * 0.8, // surplus
      basePrice: commodity.basePrice,
      supply: 150,
      demand: Math.ceil(demandForScale(scale) * 0.5),
      trend: 'stable',
      available: true,
      blackMarketOnly: false,
    })
  }

  // Larger settlements trade more diverse goods
  const luxuries = ['wine', 'spices', 'horses', 'weapons', 'armor', 'magic_components']
  const additionalSlots = params.marketCommodities - market.length
  for (let i = 0; i < Math.min(additionalSlots, luxuries.length); i++) {
    const id = luxuries[i]
    const commodity = COMMODITIES[id]
    if (!commodity) continue
    market.push({
      commodityId: id,
      currentPrice: commodity.basePrice * 1.3, // imported luxury premium
      basePrice: commodity.basePrice,
      supply: Math.ceil(30 / (i + 1)), // rarer items have less supply
      demand: Math.ceil(demandForScale(scale) * 0.3),
      trend: 'stable',
      available: true,
      blackMarketOnly: false,
    })
  }

  return market
}

// ============================================================
// DISTRICT BUILDER
// ============================================================

function buildDistrict(
  parentNodeId: string,
  parentName: string,
  template: DistrictTemplate,
  cityPopulation: number,
  index: number,
): DistrictHub {
  const districtPop = Math.floor(cityPopulation * template.popFraction)
  const districtNodeId = `${parentNodeId}_district_${index}`

  // Create district .tp node (child of settlement)
  const node: WorldNode = {
    id: districtNodeId,
    type: 'district',
    name: template.name,
    parentId: parentNodeId,
    dataStatic: {
      districtType: template.type,
      population: districtPop,
      law: template.lawOverride ? { enforcement: template.lawOverride } : {},
      ...template.kappa,
    },
  }

  // Build containers for the district
  const containers = buildContainers(
    districtNodeId,
    template.name,
    { ...SCALE_PARAMS.town, containers: template.containers },
  )

  // Build market with specialization
  const market: MarketPrice[] = []
  for (const commodityId of template.marketSpecialization) {
    const commodity = COMMODITIES[commodityId]
    if (!commodity) continue
    market.push({
      commodityId,
      currentPrice: commodity.basePrice * 0.7, // specialist discount
      basePrice: commodity.basePrice,
      supply: Math.ceil(districtPop * 0.3),     // specialists stock more
      demand: Math.ceil(districtPop * 0.1),
      trend: 'stable',
      available: true,
      blackMarketOnly: template.type === 'slum',
    })
  }

  return {
    node,
    type: template.type,
    population: districtPop,
    containers,
    localActorSlots: template.localActors,
    marketSpecialization: template.marketSpecialization,
    market,
  }
}

// ============================================================
// HELPERS
// ============================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function tradeModForScale(scale: HubScale): number {
  const mods: Record<HubScale, number> = {
    regional_capital: 1.2,
    city: 1.1,
    town: 1.0,
    village: 0.9,
    hamlet: 0.8,
    outpost: 0.7,
  }
  return mods[scale]
}

function lawForScale(scale: HubScale): string {
  const law: Record<HubScale, string> = {
    regional_capital: 'strict',
    city: 'moderate',
    town: 'moderate',
    village: 'lax',
    hamlet: 'lax',
    outpost: 'none',
  }
  return law[scale]
}

function baseOutputForScale(scale: HubScale): number {
  const output: Record<HubScale, number> = {
    regional_capital: 20,
    city: 10,
    town: 5,
    village: 3,
    hamlet: 1,
    outpost: 1,
  }
  return output[scale]
}

function demandForScale(scale: HubScale): number {
  const demand: Record<HubScale, number> = {
    regional_capital: 500,
    city: 200,
    town: 80,
    village: 30,
    hamlet: 10,
    outpost: 5,
  }
  return demand[scale]
}

// ── Scale → κ defaults helpers (used in seedHubKappa) ──

function stabilityForScale(scale: HubScale): number {
  const map: Record<HubScale, number> = {
    regional_capital: 0.85, city: 0.75, town: 0.65,
    village: 0.7, hamlet: 0.6, outpost: 0.5,
  }
  return map[scale]
}

function growthRateForScale(scale: HubScale): number {
  // Per-day growth rate. Bigger settlements grow slower (already saturated).
  const map: Record<HubScale, number> = {
    regional_capital: 0.0001, city: 0.0003, town: 0.0005,
    village: 0.0008, hamlet: 0.0012, outpost: 0.002,
  }
  return map[scale]
}

function marketTierForScale(scale: HubScale): 'metropolis' | 'city' | 'town' | 'village' | 'none' {
  const map: Record<HubScale, 'metropolis' | 'city' | 'town' | 'village' | 'none'> = {
    regional_capital: 'metropolis', city: 'city', town: 'town',
    village: 'village', hamlet: 'none', outpost: 'none',
  }
  return map[scale]
}

function militaryUpkeepForScale(scale: HubScale): number {
  // Daily GP cost to maintain garrison
  const map: Record<HubScale, number> = {
    regional_capital: 250, city: 100, town: 25,
    village: 5, hamlet: 1, outpost: 2,
  }
  return map[scale]
}

function fortificationForScale(scale: HubScale): 'none' | 'palisade' | 'stone_wall' | 'castle' | 'fortress' {
  const map: Record<HubScale, 'none' | 'palisade' | 'stone_wall' | 'castle' | 'fortress'> = {
    regional_capital: 'castle', city: 'stone_wall', town: 'stone_wall',
    village: 'palisade', hamlet: 'none', outpost: 'palisade',
  }
  return map[scale]
}
