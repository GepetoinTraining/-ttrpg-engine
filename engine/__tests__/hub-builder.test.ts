/**
 * HUB BUILDER TESTS — Settlement Node Factory
 * ===============================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildHub, SCALE_PARAMS, DEFAULT_DISTRICTS,
  resetContainerIdCounter,
  type HubScale, type DistrictTemplate,
} from '../hub-builder.js'
import { resetDepositIdCounter, resetExtractionIdCounter } from '../production-chain.js'

beforeEach(() => {
  resetContainerIdCounter()
  resetDepositIdCounter()
  resetExtractionIdCounter()
})

// ============================================================
// SCALE-DRIVEN GENERATION
// ============================================================

describe('Scale Parameters', () => {
  it('regional capital has highest everything', () => {
    const p = SCALE_PARAMS.regional_capital
    expect(p.popMin).toBe(25000)
    expect(p.mmActors).toBe(3)
    expect(p.localActors).toBe(30)
    expect(p.militaryPresence).toBe(500)
    expect(p.infrastructureLevel).toBe('paved')
  })

  it('hamlet has minimal infrastructure', () => {
    const p = SCALE_PARAMS.hamlet
    expect(p.popMax).toBe(200)
    expect(p.mmActors).toBe(0)
    expect(p.localActors).toBe(2)
    expect(p.infrastructureLevel).toBe('trail')
    expect(p.hasGuild).toBe(false)
  })

  it('outpost is smallest', () => {
    const p = SCALE_PARAMS.outpost
    expect(p.popMin).toBe(5)
    expect(p.tradeRoutes).toBe(1)
    expect(p.marketCommodities).toBe(2)
  })
})

// ============================================================
// HUB CREATION
// ============================================================

describe('buildHub — Regional Capital', () => {
  it('creates a fully wired hub', () => {
    const hub = buildHub({
      nodeId: 'suzail',
      name: 'Suzail',
      parentId: 'cormyr',
      scale: 'regional_capital',
      population: 50000,
      naturalResources: [
        { name: 'Iron Vein', type: 'shallow', commodity: 'iron_ore', quality: 'rich' },
        { name: 'Wheat Fields', type: 'arable', commodity: 'grain' },
      ],
    })

    // Node
    expect(hub.node.id).toBe('suzail')
    expect(hub.node.name).toBe('Suzail')
    expect(hub.node.parentId).toBe('cormyr')
    expect(hub.node.type).toBe('settlement')

    // Population
    expect(hub.population).toBe(50000)

    // Scale
    expect(hub.scale).toBe('regional_capital')

    // Actor slots (local actors summed from 8 default districts)
    expect(hub.actorSlots).toBe(3)
    expect(hub.localActorSlots).toBe(34) // 3+3+8+6+5+3+4+2

    // Military
    expect(hub.garrison).toBe(500)

    // Infrastructure
    expect(hub.infrastructure).toBe('paved')

    // Guild
    expect(hub.hasGuild).toBe(true)
  })
})

describe('buildHub — Containers', () => {
  it('regional capital has treasury, vault, 2 warehouses, 2 granaries', () => {
    const hub = buildHub({
      nodeId: 'capital_1',
      name: 'Grand City',
      parentId: 'region_1',
      scale: 'regional_capital',
      population: 30000,
    })
    expect(hub.containers).toHaveLength(10) // treasury, vault, 2×warehouse, 2×granary, library, gallery, armory, scroll_rack
    expect(hub.containers.filter(c => c.type === 'treasury')).toHaveLength(1)
    expect(hub.containers.filter(c => c.type === 'vault')).toHaveLength(1)
    expect(hub.containers.filter(c => c.type === 'warehouse')).toHaveLength(2)
    expect(hub.containers.filter(c => c.type === 'granary')).toHaveLength(2)
    expect(hub.containers.filter(c => c.type === 'library' as any)).toHaveLength(1)
    expect(hub.containers.filter(c => c.type === 'gallery' as any)).toHaveLength(1)
  })

  it('hamlet only has a chest', () => {
    const hub = buildHub({
      nodeId: 'hamlet_1',
      name: 'Thornhallow',
      parentId: 'region_1',
      scale: 'hamlet',
      population: 50,
    })
    expect(hub.containers).toHaveLength(1)
    expect(hub.containers[0].type).toBe('chest')
  })

  it('containers are owned by settlement', () => {
    const hub = buildHub({
      nodeId: 'town_1',
      name: 'Daggerford',
      parentId: 'region_1',
      scale: 'town',
      population: 2000,
    })
    for (const c of hub.containers) {
      expect(c.ownerId).toBe('town_1')
      expect(c.locationNodeId).toBe('town_1')
    }
  })

  it('vaults are locked with high DC', () => {
    const hub = buildHub({
      nodeId: 'city_1',
      name: 'Waterdeep',
      parentId: 'region_1',
      scale: 'city',
      population: 10000,
    })
    const vault = hub.containers.find(c => c.type === 'vault')!
    expect(vault.locked).toBe(true)
    expect(vault.lockDC).toBe(20)
    const treasury = hub.containers.find(c => c.type === 'treasury')!
    expect(treasury.locked).toBe(true)
    expect(treasury.lockDC).toBe(25)
  })

  it('warehouses have massive capacity', () => {
    const hub = buildHub({
      nodeId: 'city_1',
      name: 'Waterdeep',
      parentId: 'region_1',
      scale: 'city',
      population: 15000,
    })
    const warehouse = hub.containers.find(c => c.type === 'warehouse')!
    expect(warehouse.weightCapacity).toBe(100000) // 50 tons
    expect(warehouse.volumeCapacity).toBe(5000)
  })
})

// ============================================================
// DEPOSITS & EXTRACTION
// ============================================================

describe('buildHub — Deposits', () => {
  it('creates deposits from natural resources', () => {
    const hub = buildHub({
      nodeId: 'mining_town',
      name: 'Ironforge',
      parentId: 'region_1',
      scale: 'town',
      population: 3000,
      naturalResources: [
        { name: 'Deep Iron', type: 'deep', commodity: 'iron_ore', quality: 'rich' },
        { name: 'Copper Seam', type: 'shallow', commodity: 'copper_ore' },
      ],
    })
    expect(hub.deposits).toHaveLength(2)
    expect(hub.deposits[0].name).toBe('Deep Iron')
    expect(hub.deposits[0].quality).toBe('rich')
    expect(hub.deposits[1].primaryCommodityId).toBe('copper_ore')
  })

  it('auto-creates extraction operations', () => {
    const hub = buildHub({
      nodeId: 'farming_village',
      name: 'Greenfields',
      parentId: 'region_1',
      scale: 'village',
      population: 500,
      naturalResources: [
        { name: 'Fertile Plains', type: 'arable', commodity: 'grain' },
      ],
    })
    expect(hub.extractions).toHaveLength(1)
    expect(hub.extractions[0].status).toBe('operating')
    // 3% of 500 = 15 workers
    expect(hub.extractions[0].assignedWorkers).toBe(15)
  })

  it('extraction output goes to warehouse', () => {
    const hub = buildHub({
      nodeId: 'town_1',
      name: 'Millton',
      parentId: 'region_1',
      scale: 'town',
      population: 2000,
      naturalResources: [
        { name: 'Sawmill Forest', type: 'forest', commodity: 'timber' },
      ],
    })
    const warehouse = hub.containers.find(c => c.type === 'warehouse')!
    expect(hub.extractions[0].outputContainerId).toBe(warehouse.id)
  })

  it('labor scales with population', () => {
    const hub = buildHub({
      nodeId: 'big_city',
      name: 'Metropolis',
      parentId: 'region_1',
      scale: 'regional_capital',
      population: 50000,
      naturalResources: [
        { name: 'City Quarry', type: 'surface', commodity: 'stone' },
      ],
    })
    // 5% of 50000 = 2500 optimal labor
    expect(hub.deposits[0].optimalLabor).toBe(2500)
    // 3% of 50000 = 1500 extraction workers
    expect(hub.extractions[0].assignedWorkers).toBe(1500)
  })
})

// ============================================================
// MARKET
// ============================================================

describe('buildHub — Market', () => {
  it('every hub has essential commodities', () => {
    const hub = buildHub({
      nodeId: 'any_town',
      name: 'Anytown',
      parentId: 'region_1',
      scale: 'town',
      population: 2000,
    })
    const ids = hub.market.map(m => m.commodityId)
    expect(ids).toContain('grain')
    expect(ids).toContain('water')
    expect(ids).toContain('timber')
    expect(ids).toContain('tools')
  })

  it('locally produced commodities are cheaper', () => {
    const hub = buildHub({
      nodeId: 'grain_town',
      name: 'Grainville',
      parentId: 'region_1',
      scale: 'town',
      population: 2000,
      naturalResources: [
        { name: 'Wheat Fields', type: 'arable', commodity: 'grain' },
      ],
    })
    const grain = hub.market.find(m => m.commodityId === 'grain')!
    expect(grain.currentPrice).toBeLessThan(grain.basePrice) // local production
    expect(grain.supply).toBe(200) // well-stocked
  })

  it('imported commodities are more expensive', () => {
    const hub = buildHub({
      nodeId: 'desert_town',
      name: 'Sandpoint',
      parentId: 'region_1',
      scale: 'town',
      population: 1500,
      // No timber deposits = must import
    })
    const timber = hub.market.find(m => m.commodityId === 'timber')!
    expect(timber.currentPrice).toBeGreaterThan(timber.basePrice)
    expect(timber.supply).toBe(50) // imported, low supply
  })

  it('regional capitals have luxury goods', () => {
    const hub = buildHub({
      nodeId: 'capital',
      name: 'Imperial City',
      parentId: 'region_1',
      scale: 'regional_capital',
      population: 40000,
    })
    const ids = hub.market.map(m => m.commodityId)
    expect(ids).toContain('wine')
    expect(ids).toContain('spices')
    expect(ids).toContain('horses')
  })

  it('hamlets have very few commodities', () => {
    const hub = buildHub({
      nodeId: 'hamlet_1',
      name: 'Tinyhaven',
      parentId: 'region_1',
      scale: 'hamlet',
      population: 50,
    })
    // Essentials (4) are always included; hamlet won't get luxuries beyond that
    expect(hub.market.length).toBeLessThanOrEqual(SCALE_PARAMS.hamlet.marketCommodities + 4)
  })

  it('demand scales with hub size', () => {
    const village = buildHub({
      nodeId: 'v', name: 'V', parentId: 'r', scale: 'village', population: 500
    })
    const city = buildHub({
      nodeId: 'c', name: 'C', parentId: 'r', scale: 'city', population: 10000
    })
    const villageGrain = village.market.find(m => m.commodityId === 'grain')!
    const cityGrain = city.market.find(m => m.commodityId === 'grain')!
    expect(cityGrain.demand).toBeGreaterThan(villageGrain.demand)
  })
})

// ============================================================
// κ RULES — WorldNode data
// ============================================================

describe('buildHub — κ Rules', () => {
  it('sets economy type based on scale', () => {
    const hub = buildHub({
      nodeId: 'cap_1',
      name: 'Imperial Capital',
      parentId: 'region_1',
      scale: 'regional_capital',
      population: 50000,
    })
    const data = hub.node.dataStatic as any
    expect(data.economy.type).toBe('imperial_capital')
    expect(data.economy.tradeModifier).toBe(1.2)
  })

  it('sets law enforcement based on scale', () => {
    const hub = buildHub({
      nodeId: 'outpost_1',
      name: 'Border Watch',
      parentId: 'region_1',
      scale: 'outpost',
      population: 10,
    })
    const data = hub.node.dataStatic as any
    expect(data.law.enforcement).toBe('none')
  })

  it('custom κ overrides defaults', () => {
    const hub = buildHub({
      nodeId: 'magic_town',
      name: 'Mythra',
      parentId: 'region_1',
      scale: 'town',
      population: 3000,
      kappa: { magic: { level: 'wild', source: 'Raw Chaos' } },
    })
    const data = hub.node.dataStatic as any
    expect(data.magic.level).toBe('wild')
    expect(data.magic.source).toBe('Raw Chaos')
  })
})

// ============================================================
// DETERMINISM
// ============================================================

describe('buildHub — Determinism', () => {
  it('same seed produces same population', () => {
    const h1 = buildHub({
      nodeId: 'a', name: 'A', parentId: 'r', scale: 'town', seed: 42
    })
    const h2 = buildHub({
      nodeId: 'a', name: 'A', parentId: 'r', scale: 'town', seed: 42
    })
    expect(h1.population).toBe(h2.population)
  })

  it('different seed produces different population', () => {
    const h1 = buildHub({
      nodeId: 'a', name: 'A', parentId: 'r', scale: 'city', seed: 1
    })
    const h2 = buildHub({
      nodeId: 'a', name: 'A', parentId: 'r', scale: 'city', seed: 99
    })
    expect(h1.population).not.toBe(h2.population)
  })

  it('explicit population overrides seed', () => {
    const hub = buildHub({
      nodeId: 'a', name: 'A', parentId: 'r', scale: 'city', population: 12345, seed: 1
    })
    expect(hub.population).toBe(12345)
  })
})

// ============================================================
// DISTRICTS — Sub-hub expansion for large cities
// ============================================================

describe('buildHub — Districts', () => {
  it('regional capital auto-generates 8 default districts', () => {
    const hub = buildHub({
      nodeId: 'waterdeep',
      name: 'Waterdeep',
      parentId: 'sword_coast',
      scale: 'regional_capital',
      population: 130000,
    })
    expect(hub.districts).toHaveLength(8)
  })

  it('city auto-generates 4 districts', () => {
    const hub = buildHub({
      nodeId: 'baldurs_gate',
      name: 'Baldurs Gate',
      parentId: 'western_heartlands',
      scale: 'city',
      population: 20000,
    })
    expect(hub.districts).toHaveLength(4)
    // Cities get first 4: governance, noble, trade, market
    expect(hub.districts.map(d => d.type)).toEqual(['governance', 'noble', 'trade', 'market'])
  })

  it('towns/villages/hamlets have no districts', () => {
    const town = buildHub({
      nodeId: 't', name: 'T', parentId: 'r', scale: 'town', population: 2000,
    })
    expect(town.districts).toHaveLength(0)

    const hamlet = buildHub({
      nodeId: 'h', name: 'H', parentId: 'r', scale: 'hamlet', population: 50,
    })
    expect(hamlet.districts).toHaveLength(0)
  })

  it('districts are child .tp nodes of the settlement', () => {
    const hub = buildHub({
      nodeId: 'waterdeep',
      name: 'Waterdeep',
      parentId: 'sword_coast',
      scale: 'regional_capital',
      population: 100000,
    })
    for (const d of hub.districts) {
      expect(d.node.parentId).toBe('waterdeep')
      expect(d.node.type).toBe('district')
    }
  })

  it('district populations sum to approximate total (pop fractions)', () => {
    const hub = buildHub({
      nodeId: 'waterdeep',
      name: 'Waterdeep',
      parentId: 'sword_coast',
      scale: 'regional_capital',
      population: 100000,
    })
    const districtPop = hub.districts.reduce((sum, d) => sum + d.population, 0)
    // 0.05+0.08+0.15+0.12+0.15+0.20+0.15+0.10 = 1.00 of 100K
    expect(districtPop).toBe(100000)
  })

  it('each district type has correct κ law override', () => {
    const hub = buildHub({
      nodeId: 'capital',
      name: 'Capital',
      parentId: 'r',
      scale: 'regional_capital',
      population: 50000,
    })
    const governance = hub.districts.find(d => d.type === 'governance')!
    const slum = hub.districts.find(d => d.type === 'slum')!
    const dock = hub.districts.find(d => d.type === 'dock')!

    expect((governance.node.dataStatic as any).law.enforcement).toBe('strict')
    expect((slum.node.dataStatic as any).law.enforcement).toBe('none')
    expect((dock.node.dataStatic as any).law.enforcement).toBe('lax')
  })

  it('trade district has weapons/armor/tools specialization', () => {
    const hub = buildHub({
      nodeId: 'capital', name: 'Capital', parentId: 'r',
      scale: 'regional_capital', population: 50000,
    })
    const trades = hub.districts.find(d => d.type === 'trade')!
    expect(trades.marketSpecialization).toContain('weapons')
    expect(trades.marketSpecialization).toContain('armor')
    expect(trades.marketSpecialization).toContain('tools')
    // Market entries exist for specialization
    expect(trades.market.find(m => m.commodityId === 'weapons')).toBeDefined()
  })

  it('dock district has warehouse containers', () => {
    const hub = buildHub({
      nodeId: 'capital', name: 'Capital', parentId: 'r',
      scale: 'regional_capital', population: 80000,
    })
    const dock = hub.districts.find(d => d.type === 'dock')!
    expect(dock.containers.filter(c => c.type === 'warehouse').length).toBeGreaterThanOrEqual(2)
    expect(dock.containers.some(c => c.type === 'granary')).toBe(true)
  })

  it('local actors are summed from districts', () => {
    const hub = buildHub({
      nodeId: 'capital', name: 'Capital', parentId: 'r',
      scale: 'regional_capital', population: 50000,
    })
    const districtSum = hub.districts.reduce((s, d) => s + d.localActorSlots, 0)
    expect(hub.localActorSlots).toBe(districtSum)
  })

  it('custom districts override defaults', () => {
    const customDistricts: DistrictTemplate[] = [
      { type: 'arcane', name: 'Mage Quarter', popFraction: 0.3, localActors: 10, containers: ['vault', 'vault'], marketSpecialization: ['magic_components'], lawOverride: 'strict' },
      { type: 'military', name: 'War District', popFraction: 0.7, localActors: 20, containers: ['warehouse', 'warehouse', 'warehouse'], marketSpecialization: ['weapons', 'armor', 'horses'], lawOverride: 'strict' },
    ]
    const hub = buildHub({
      nodeId: 'war_capital', name: 'Fortress City', parentId: 'r',
      scale: 'regional_capital', population: 60000,
      districts: customDistricts,
    })
    expect(hub.districts).toHaveLength(2)
    expect(hub.districts[0].type).toBe('arcane')
    expect(hub.districts[1].type).toBe('military')
    expect(hub.localActorSlots).toBe(30) // 10 + 20
    // Mage quarter has magic components market
    expect(hub.districts[0].market[0].commodityId).toBe('magic_components')
  })

  it('Waterdeep CAN be modelled now', () => {
    const waterdeep = buildHub({
      nodeId: 'waterdeep',
      name: 'Waterdeep',
      parentId: 'sword_coast',
      scale: 'regional_capital',
      population: 130000,
      naturalResources: [
        { name: 'Deepwater Harbor Fishery', type: 'fishery', commodity: 'fish', quality: 'rich' },
        { name: 'Ardeep Forest Edge', type: 'managed', commodity: 'timber' },
      ],
    })

    // It's massive
    expect(waterdeep.population).toBe(130000)
    expect(waterdeep.districts).toHaveLength(8)
    expect(waterdeep.actorSlots).toBe(3) // Masked Lords
    expect(waterdeep.localActorSlots).toBe(34) // across all wards
    expect(waterdeep.garrison).toBe(500)

    // Each ward has its own identity
    const castleWard = waterdeep.districts.find(d => d.type === 'governance')!
    expect(castleWard.population).toBe(6500) // 5% of 130K

    const dockWard = waterdeep.districts.find(d => d.type === 'dock')!
    expect(dockWard.population).toBe(19500) // 15% of 130K
    expect(dockWard.marketSpecialization).toContain('fish')

    const tradesWard = waterdeep.districts.find(d => d.type === 'trade')!
    expect(tradesWard.localActorSlots).toBe(8) // most artisans

    // Deposits exist at city level
    expect(waterdeep.deposits).toHaveLength(2)
    expect(waterdeep.extractions).toHaveLength(2)
  })
})
