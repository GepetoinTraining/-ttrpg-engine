import { describe, it, expect } from 'vitest'
import {
  waterTravelDays,
  calculateWaterBonus,
  weeklyFishing,
  createWaterBody,
  createWaterLevel,
  getFloodStage,
  updateWaterLevel,
  floodDamageToSettlement,
  BOAT_STATS,
  WATER_BODY_SIZE,
  type WaterBody,
  type WaterEdge,
  type WaterInputs,
} from '../water'

function makeWater(overrides: Partial<WaterBody> = {}): WaterBody {
  return createWaterBody('Test River', 'river', 'region_1', overrides)
}

function makeEdge(overrides: Partial<WaterEdge> = {}): WaterEdge {
  return {
    id: 'edge_1', fromId: 'w1', toId: 'w2',
    edgeType: 'river_segment', flowDirection: 'bidirectional',
    distanceMiles: 50, navigable: true, danger: 2, width: 'moderate',
    ...overrides,
  }
}

describe('Water Engine', () => {

  describe('Water Bodies', () => {
    it('has 8 types', () => {
      expect(Object.keys(WATER_BODY_SIZE)).toHaveLength(8)
    })

    it('creates river with correct defaults', () => {
      const w = createWaterBody('Snake River', 'river', 'r1')
      expect(w.salinity).toBe('fresh')
      expect(w.navigable).toBe(true)
      expect(w.drinkable).toBe(true)
    })

    it('creates ocean with salt water', () => {
      const w = createWaterBody('The Trackless Sea', 'ocean', 'r1')
      expect(w.salinity).toBe('salt')
      expect(w.drinkable).toBe(false)
      expect(w.depth).toBe('abyssal')
    })

    it('creates swamp as non-navigable', () => {
      const w = createWaterBody('Mere of Dead Men', 'swamp', 'r1')
      expect(w.navigable).toBe(false)
      expect(w.drinkable).toBe(false)
    })

    it('overrides work', () => {
      const w = createWaterBody('Magic Lake', 'lake', 'r1', { drinkable: false, fishingYield: 50 })
      expect(w.drinkable).toBe(false)
      expect(w.fishingYield).toBe(50)
    })
  })

  describe('Boats', () => {
    it('has 8 boat types', () => {
      expect(Object.keys(BOAT_STATS)).toHaveLength(8)
    })

    it('warship is most expensive', () => {
      const costs = Object.values(BOAT_STATS).map(b => b.cost)
      expect(BOAT_STATS.warship.cost).toBe(Math.max(...costs))
    })

    it('raft is not seaworthy', () => {
      expect(BOAT_STATS.raft.seaWorthy).toBe(false)
    })

    it('longship is seaworthy', () => {
      expect(BOAT_STATS.longship.seaWorthy).toBe(true)
    })
  })

  describe('Navigation', () => {
    it('calculates travel days', () => {
      const edge = makeEdge({ distanceMiles: 100 })
      const days = waterTravelDays(edge, 'sailboat') // 24 mph
      expect(days).toBe(Math.ceil(100 / 24))
    })

    it('downstream is faster', () => {
      const edge = makeEdge({ distanceMiles: 100, flowDirection: 'downstream' })
      const down = waterTravelDays(edge, 'sailboat')
      const up = waterTravelDays({ ...edge, flowDirection: 'upstream' }, 'sailboat')
      expect(down).toBeLessThan(up)
    })

    it('upstream is much slower than downstream', () => {
      const edge = makeEdge({ distanceMiles: 150, flowDirection: 'downstream' })
      const down = waterTravelDays(edge, 'keelboat')
      const up = waterTravelDays({ ...edge, flowDirection: 'upstream' }, 'keelboat')
      expect(up).toBeGreaterThan(down * 2) // at least 2× slower
    })

    it('non-seaworthy boat cannot use sea lane', () => {
      const edge = makeEdge({ edgeType: 'sea_lane' })
      expect(waterTravelDays(edge, 'raft')).toBe(Infinity)
      expect(waterTravelDays(edge, 'sailboat')).not.toBe(Infinity)
    })

    it('non-navigable edge = Infinity', () => {
      const edge = makeEdge({ navigable: false })
      expect(waterTravelDays(edge, 'sailboat')).toBe(Infinity)
    })
  })

  describe('Settlement Water Bonuses', () => {
    it('fresh water provides supply', () => {
      const water = [makeWater({ drinkable: true })]
      const bonus = calculateWaterBonus('s1', water, [])
      expect(bonus.waterSupply).toBe(true)
    })

    it('river provides irrigation', () => {
      const water = [makeWater()]
      const bonus = calculateWaterBonus('s1', water, [])
      expect(bonus.irrigation).toBe(true)
    })

    it('sea access provides port', () => {
      const water = [createWaterBody('Sea', 'sea', 'r1')]
      const bonus = calculateWaterBonus('s1', water, [])
      expect(bonus.hasPort).toBe(true)
    })

    it('river crossing is strategic', () => {
      const edges: WaterEdge[] = [makeEdge({ edgeType: 'river_crossing' })]
      const bonus = calculateWaterBonus('s1', [], edges)
      expect(bonus.strategicCrossing).toBe(true)
    })

    it('fishing income from water bodies', () => {
      const water = [makeWater({ fishingYield: 10 }), makeWater({ fishingYield: 5 })]
      const bonus = calculateWaterBonus('s1', water, [])
      expect(bonus.fishingIncome).toBe(15)
    })

    it('no water = no bonuses', () => {
      const bonus = calculateWaterBonus('s1', [], [])
      expect(bonus.waterSupply).toBe(false)
      expect(bonus.irrigation).toBe(false)
      expect(bonus.hasPort).toBe(false)
      expect(bonus.fishingIncome).toBe(0)
    })
  })

  describe('Fishing', () => {
    it('yields food based on d20', () => {
      const w = makeWater({ fishingYield: 10 })
      const good = weeklyFishing(w, 18)
      const poor = weeklyFishing(w, 2)
      expect(good.foodUnits).toBeGreaterThan(poor.foodUnits)
    })

    it('deep water gives bonus', () => {
      const shallow = createWaterBody('Pond', 'stream', 'r1', { depth: 'shallow', fishingYield: 10 })
      const deep = createWaterBody('Lake', 'lake', 'r1', { depth: 'deep', fishingYield: 10 })
      const sResult = weeklyFishing(shallow, 10)
      const dResult = weeklyFishing(deep, 10)
      expect(dResult.foodUnits).toBeGreaterThan(sResult.foodUnits)
    })

    it('nat 20 = abundant', () => {
      const w = makeWater({ fishingYield: 10 })
      const r = weeklyFishing(w, 20)
      expect(r.quality).toBe('abundant')
    })

    it('abyssal depth is harder to fish', () => {
      const deep = createWaterBody('Abyss', 'ocean', 'r1', { depth: 'abyssal', fishingYield: 20 })
      const mod = createWaterBody('Bay', 'bay', 'r1', { depth: 'moderate', fishingYield: 20 })
      expect(weeklyFishing(deep, 10).foodUnits).toBeLessThan(weeklyFishing(mod, 10).foodUnits)
    })
  })

  describe('Water Level & Flooding', () => {
    it('creates water level at 100% normal', () => {
      const state = createWaterLevel('river_1', 'river')
      expect(state.level).toBe(100)
      expect(state.floodStage).toBe('normal')
    })

    it('maps levels to flood stages', () => {
      expect(getFloodStage(20)).toBe('drought')
      expect(getFloodStage(50)).toBe('low')
      expect(getFloodStage(100)).toBe('normal')
      expect(getFloodStage(130)).toBe('watch')
      expect(getFloodStage(160)).toBe('warning')
      expect(getFloodStage(190)).toBe('flood')
      expect(getFloodStage(220)).toBe('catastrophic')
    })

    it('rain raises water level', () => {
      const state = createWaterLevel('river_1', 'river')
      const inputs: WaterInputs = { rainfall: 2, snowmelt: 0, evaporation: 1, upstreamInflow: 0 }
      const updated = updateWaterLevel(state, inputs, 'river')
      expect(updated.level).toBeGreaterThan(100)
    })

    it('evaporation lowers water level', () => {
      const state = createWaterLevel('lake_1', 'lake')
      const inputs: WaterInputs = { rainfall: 0, snowmelt: 0, evaporation: 3, upstreamInflow: 0 }
      const updated = updateWaterLevel(state, inputs, 'lake')
      expect(updated.level).toBeLessThan(100)
    })

    it('heavy rain + snowmelt causes flooding', () => {
      let state = createWaterLevel('river_1', 'river')
      const monsoon: WaterInputs = { rainfall: 3, snowmelt: 2, evaporation: 0.5, upstreamInflow: 10 }
      // Simulate several days of heavy rain
      for (let i = 0; i < 5; i++) {
        state = updateWaterLevel(state, monsoon, 'river')
      }
      expect(state.level).toBeGreaterThan(170)
      expect(['warning', 'flood', 'catastrophic']).toContain(state.floodStage)
    })

    it('rivers drain faster when above normal', () => {
      const state = { ...createWaterLevel('river_1', 'river'), level: 180 }
      const calm: WaterInputs = { rainfall: 0, snowmelt: 0, evaporation: 1, upstreamInflow: 0 }
      const updated = updateWaterLevel(state, calm, 'river')
      // Should lose more than just normal drainage
      expect(180 - updated.level).toBeGreaterThan(state.drainageRate)
    })

    it('tracks season peak', () => {
      let state = createWaterLevel('river_1', 'river')
      const rain: WaterInputs = { rainfall: 2, snowmelt: 0, evaporation: 1, upstreamInflow: 0 }
      state = updateWaterLevel(state, rain, 'river')
      expect(state.seasonPeak).toBeGreaterThanOrEqual(state.level)
    })

    it('level is clamped to 0-250', () => {
      const state = { ...createWaterLevel('river_1', 'river'), level: 0 }
      const drought: WaterInputs = { rainfall: 0, snowmelt: 0, evaporation: 5, upstreamInflow: 0 }
      const updated = updateWaterLevel(state, drought, 'river')
      expect(updated.level).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Flood Damage', () => {
    it('normal = no damage', () => {
      const damage = floodDamageToSettlement('normal')
      expect(damage.moralePenalty).toBe(0)
      expect(damage.cropDamage).toBe(0)
      expect(damage.tradeDisrupted).toBe(false)
    })

    it('flood = major damage', () => {
      const damage = floodDamageToSettlement('flood')
      expect(damage.moralePenalty).toBeLessThan(-3)
      expect(damage.cropDamage).toBeGreaterThan(0.3)
      expect(damage.tradeDisrupted).toBe(true)
      expect(damage.navigationBlocked).toBe(true)
    })

    it('catastrophic = worst damage', () => {
      const damage = floodDamageToSettlement('catastrophic')
      expect(damage.cropDamage).toBeGreaterThan(0.5)
      expect(damage.displacedPopulation).toBeGreaterThan(0.3)
      expect(damage.buildingDamage).toBeGreaterThan(0.2)
    })

    it('drought blocks navigation', () => {
      const damage = floodDamageToSettlement('drought')
      expect(damage.navigationBlocked).toBe(true)
      expect(damage.cropDamage).toBeGreaterThan(0)
    })

    it('damage escalates with stage severity', () => {
      const stages = ['normal', 'watch', 'warning', 'flood', 'catastrophic'] as const
      const damages = stages.map(s => floodDamageToSettlement(s))
      for (let i = 1; i < damages.length; i++) {
        expect(damages[i].moralePenalty).toBeLessThanOrEqual(damages[i - 1].moralePenalty)
      }
    })
  })
})
