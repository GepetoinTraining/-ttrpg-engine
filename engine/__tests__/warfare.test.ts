import { describe, it, expect } from 'vitest'
import {
  unitCombatStrength,
  calculateUpkeep,
  resolveBattle,
  applyCasualties,
  statusFromStanding,
  executeSpyMission,
  setInfluence,
  normalizeInfluence,
  dominantFaction,
  monthlyInfluenceTick,
  monthlyReadinessTick,
  ARMY_TIER_SIZE,
  ARMY_TIER_ORDER,
  SIEGE_WEAPON_STATS,
  UNIT_EFFECTIVENESS,
  type ArmyUnit,
  type BattleForce,
  type SpyAgent,
  type RegionInfluence,
} from '../warfare'

function makeUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: 'unit_1', factionId: 'faction_1', name: 'Iron Guard',
    tier: 'company', unitType: 'infantry',
    currentStrength: 125, readiness: 80, morale: 70,
    equipmentTier: 3, regionId: 'region_1', weeklyUpkeepGP: 75,
    ...overrides,
  }
}

function makeSpy(overrides: Partial<SpyAgent> = {}): SpyAgent {
  return {
    id: 'spy_1', npcId: 'npc_spy', factionId: 'faction_1',
    coverSettlementId: 'settlement_1', skillMod: 5,
    detected: false, missionsCompleted: 0,
    ...overrides,
  }
}

describe('Warfare Engine', () => {

  describe('Army Hierarchy', () => {
    it('has 5 tiers', () => {
      expect(ARMY_TIER_ORDER).toHaveLength(5)
    })

    it('each tier is 5× the previous', () => {
      expect(ARMY_TIER_SIZE.platoon / ARMY_TIER_SIZE.squad).toBe(5)
      expect(ARMY_TIER_SIZE.company / ARMY_TIER_SIZE.platoon).toBe(5)
      expect(ARMY_TIER_SIZE.battalion / ARMY_TIER_SIZE.company).toBe(5)
      expect(ARMY_TIER_SIZE.legion / ARMY_TIER_SIZE.battalion).toBe(5)
    })

    it('legion = 3125', () => {
      expect(ARMY_TIER_SIZE.legion).toBe(3125)
    })
  })

  describe('Unit Combat Strength', () => {
    it('calculates from strength × readiness × morale × equipment × type', () => {
      const u = makeUnit({ currentStrength: 100, readiness: 100, morale: 100, equipmentTier: 3 })
      const str = unitCombatStrength(u, 'attack')
      expect(str).toBeGreaterThan(0)
    })

    it('zero readiness = zero strength', () => {
      const u = makeUnit({ readiness: 0 })
      expect(unitCombatStrength(u, 'attack')).toBe(0)
    })

    it('cavalry stronger in attack, infantry stronger in defense', () => {
      const base = { currentStrength: 100, readiness: 100, morale: 100, equipmentTier: 3 }
      const cav = makeUnit({ ...base, unitType: 'cavalry' })
      const inf = makeUnit({ ...base, unitType: 'infantry' })
      expect(unitCombatStrength(cav, 'attack')).toBeGreaterThan(unitCombatStrength(inf, 'attack'))
      expect(unitCombatStrength(inf, 'defense')).toBeGreaterThan(unitCombatStrength(cav, 'defense'))
    })

    it('has 8 unit types', () => {
      expect(Object.keys(UNIT_EFFECTIVENESS)).toHaveLength(8)
    })
  })

  describe('Siege Weapons', () => {
    it('has 6 types', () => {
      expect(Object.keys(SIEGE_WEAPON_STATS)).toHaveLength(6)
    })

    it('trebuchet has highest wall damage', () => {
      const stats = Object.values(SIEGE_WEAPON_STATS)
      const maxWall = Math.max(...stats.map(s => s.wallDamage))
      expect(SIEGE_WEAPON_STATS.trebuchet.wallDamage).toBe(maxWall)
    })

    it('ballista has highest troop damage', () => {
      const stats = Object.values(SIEGE_WEAPON_STATS)
      const maxTroop = Math.max(...stats.map(s => s.troopDamage))
      expect(SIEGE_WEAPON_STATS.ballista.troopDamage).toBe(maxTroop)
    })
  })

  describe('Battle Resolution', () => {
    it('stronger force wins', () => {
      const attacker: BattleForce = {
        units: [makeUnit({ currentStrength: 500, readiness: 90, morale: 90 })],
        siegeWeapons: [], terrainModifier: 1.0, weatherModifier: 1.0, fortificationLevel: 0,
      }
      const defender: BattleForce = {
        units: [makeUnit({ currentStrength: 50, readiness: 50, morale: 50 })],
        siegeWeapons: [], terrainModifier: 1.0, weatherModifier: 1.0, fortificationLevel: 0,
      }
      const result = resolveBattle(attacker, defender, 10)
      expect(result.victor).toBe('attacker')
    })

    it('fortifications help defenders', () => {
      const baseUnit = makeUnit({ currentStrength: 100, readiness: 80, morale: 80 })
      const attacker: BattleForce = {
        units: [{ ...baseUnit }], siegeWeapons: [],
        terrainModifier: 1.0, weatherModifier: 1.0, fortificationLevel: 0,
      }
      const noFort: BattleForce = {
        units: [{ ...baseUnit }], siegeWeapons: [],
        terrainModifier: 1.0, weatherModifier: 1.0, fortificationLevel: 0,
      }
      const withFort: BattleForce = {
        units: [{ ...baseUnit }], siegeWeapons: [],
        terrainModifier: 1.0, weatherModifier: 1.0, fortificationLevel: 5,
      }
      const r1 = resolveBattle(attacker, noFort, 10)
      const r2 = resolveBattle(attacker, withFort, 10)
      expect(r2.defenderStrength).toBeGreaterThan(r1.defenderStrength)
    })

    it('casualties applied correctly', () => {
      const units = [makeUnit({ currentStrength: 100, morale: 80 })]
      applyCasualties(units, 0.5)
      expect(units[0].currentStrength).toBe(50)
      expect(units[0].morale).toBeLessThan(80)
    })
  })

  describe('Diplomacy', () => {
    it('high standing = alliance', () => {
      expect(statusFromStanding(85)).toBe('alliance')
    })
    it('low standing = war', () => {
      expect(statusFromStanding(-90)).toBe('war')
    })
    it('zero standing = neutral', () => {
      expect(statusFromStanding(0)).toBe('neutral')
    })
    it('maps all ranges correctly', () => {
      expect(statusFromStanding(60)).toBe('trade_pact')
      expect(statusFromStanding(30)).toBe('non_aggression')
      expect(statusFromStanding(-30)).toBe('rivalry')
      expect(statusFromStanding(-60)).toBe('cold_war')
    })
  })

  describe('Espionage', () => {
    it('succeeds on high roll', () => {
      const spy = makeSpy({ skillMod: 8 })
      const r = executeSpyMission(spy, 'intelligence', 18)
      expect(r.success).toBe(true)
      expect(r.intelGathered).toBeDefined()
      expect(spy.missionsCompleted).toBe(1)
    })

    it('fails and detects on very low roll', () => {
      const spy = makeSpy({ skillMod: 0 })
      const r = executeSpyMission(spy, 'sabotage', 1) // nat 1
      expect(r.success).toBe(false)
      expect(r.detected).toBe(true)
      expect(spy.detected).toBe(true)
    })

    it('counterintelligence raises DC', () => {
      const spy = makeSpy({ skillMod: 5 })
      const easy = executeSpyMission(spy, 'intelligence', 10, 0)
      spy.detected = false
      const hard = executeSpyMission(spy, 'intelligence', 10, 10)
      expect(easy.success).toBe(true)
      expect(hard.success).toBe(false)
    })

    it('assassination has highest DC', () => {
      const spy = makeSpy({ skillMod: 5 })
      const r = executeSpyMission(spy, 'assassination', 10) // DC 20
      expect(r.success).toBe(false)
    })
  })

  describe('Factional Influence', () => {
    it('sets and normalizes influence', () => {
      const region: RegionInfluence = { regionId: 'r1', influences: new Map() }
      setInfluence(region, 'f1', 70)
      setInfluence(region, 'f2', 50)
      // Total was 120, should normalize to 100
      const total = Array.from(region.influences.values()).reduce((s, v) => s + v, 0)
      expect(total).toBeCloseTo(100)
    })

    it('finds dominant faction', () => {
      const region: RegionInfluence = { regionId: 'r1', influences: new Map([['f1', 60], ['f2', 30]]) }
      const dom = dominantFaction(region)
      expect(dom!.factionId).toBe('f1')
    })

    it('returns null for empty region', () => {
      const region: RegionInfluence = { regionId: 'r1', influences: new Map() }
      expect(dominantFaction(region)).toBeNull()
    })

    it('monthly tick decays influence', () => {
      const region: RegionInfluence = { regionId: 'r1', influences: new Map([['f1', 50]]) }
      monthlyInfluenceTick([region], [])
      expect(region.influences.get('f1')!).toBeLessThan(50)
    })

    it('army presence projects influence', () => {
      const region: RegionInfluence = { regionId: 'r1', influences: new Map([['f1', 10]]) }
      const army = makeUnit({ factionId: 'f1', regionId: 'r1' })
      monthlyInfluenceTick([region], [army])
      expect(region.influences.get('f1')!).toBeGreaterThan(9) // decay + projection
    })

    it('readiness decays monthly without training', () => {
      const unit = makeUnit({ readiness: 80 })
      monthlyReadinessTick([unit])
      expect(unit.readiness).toBe(77) // -3
      expect(unit.morale).toBe(69)    // -1
    })
  })
})
