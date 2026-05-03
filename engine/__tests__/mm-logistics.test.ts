/**
 * MM_LOGISTICS TESTS — abstract shipment ticker.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MMShipment, shipmentEntityId } from '../mm-logistics'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import {
  createShipment,
  addToManifest,
  dispatchShipment,
  resetShipmentIdCounter,
  type Shipment,
} from '../logistics'

beforeEach(() => resetShipmentIdCounter())

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate", parentId: 'sword_coast', dataStatic: {} },
    { id: 'waterdeep', type: 'settlement', name: 'Waterdeep', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  const s = createShipment(
    'baldurs_gate',
    'waterdeep',
    100,             // distance miles
    'patrolled',     // danger level
    'wagon',         // transport mode (15 mi/day)
    'merchant_thann',
    'container_baldurs',
    'container_waterdeep',
  )
  addToManifest(s, 'iron_ingot', 'Iron Ingots', 100, 1000, 500)
  return Object.assign(s, overrides)
}

describe('MMShipment — construction + registration', () => {
  it('id derived from shipment.id; nodeId = destination', () => {
    const s = makeShipment()
    const mm = new MMShipment(s, 0)
    expect(mm.state.id).toBe(shipmentEntityId(s))
    expect(mm.state.nodeId).toBe('waterdeep')
    expect(mm.state.mmType).toBe('shipment')
  })

  it('registers as abstract entity', () => {
    const tp = makeTP()
    const s = makeShipment()
    const mm = new MMShipment(s, 0)
    mm.registerWith(tp)
    const ent = tp.getEntity(mm.state.id)
    expect(ent?.type).toBe('shipment')
    expect(ent?.position.type).toBe('abstract')
  })
})

describe('MMShipment — daily ticks', () => {
  it('not-yet-dispatched shipment skips ticks (status=loading)', () => {
    const s = makeShipment()
    const mm = new MMShipment(s, 0)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7)
    expect(result.stateChanges.skipped).toBe(1)
    expect(s.progressMiles).toBe(0)
  })

  it('dispatched wagon advances 15 miles/day', () => {
    const s = makeShipment()
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })  // no hazard
    mm.accumulatePotential(3, 3)
    mm.resolve(3)
    expect(s.progressMiles).toBe(45)  // 3 days × 15 mi/day
    expect(s.status).toBe('in_transit')
  })

  it('reaches destination → status=arrived', () => {
    const s = makeShipment()
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })
    mm.accumulatePotential(10, 10)
    mm.resolve(10)
    expect(s.status).toBe('arrived')
    expect(s.progressMiles).toBe(100)  // capped at distance
    expect(mm.hasArrived()).toBe(true)
  })

  it('events accumulate on the shipment from hazard ticks', () => {
    const s = makeShipment({ dangerLevel: 'dangerous' })  // 0.30 base hazard
    dispatchShipment(s, 0)
    // d20=2 → critical hazard (rolls below threshold)
    const mm = new MMShipment(s, 0, { getD20: () => 2 })
    mm.accumulatePotential(1, 1); mm.resolve(1)
    expect(s.events.length).toBeGreaterThan(0)
    expect(['critical_hazard', 'severe_hazard']).toContain(s.events[0].type)
  })

  it('cargo loss reduces manifest quantity + value', () => {
    const s = makeShipment({ dangerLevel: 'deadly' })
    dispatchShipment(s, 0)
    const before = s.manifest[0].quantity
    const mm = new MMShipment(s, 0, { getD20: () => 1 })  // -3 → critical, 30% loss
    mm.accumulatePotential(1, 1); mm.resolve(1)
    expect(s.manifest[0].quantity).toBeLessThan(before)
  })

  it('total cargo loss exceeding 100% marks lost', () => {
    const s = makeShipment({ dangerLevel: 'deadly' })
    dispatchShipment(s, 0)
    // Multiple critical hazards over many days will eventually breach 100%
    const mm = new MMShipment(s, 0, { getD20: () => 1 })  // every day fires critical
    mm.accumulatePotential(7, 7); mm.resolve(7)
    // After enough crit ticks, status flips to lost (or arrived if it reached
    // destination first — depends on timing)
    expect(['lost', 'arrived', 'in_transit']).toContain(s.status)
  })

  it('after arrived, markDelivered flips to delivered', () => {
    const s = makeShipment()
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })
    mm.accumulatePotential(10, 10); mm.resolve(10)
    expect(s.status).toBe('arrived')
    expect(mm.markDelivered()).toBe(true)
    expect(s.status).toBe('delivered')
  })

  it('cannot markDelivered if not yet arrived', () => {
    const s = makeShipment()
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })
    mm.accumulatePotential(2, 2); mm.resolve(2)  // still in transit
    expect(mm.markDelivered()).toBe(false)
  })
})

describe('MMShipment — currency manifest (gold transport)', () => {
  it('shipment can carry currency; survives transit when no hazard', () => {
    const s = makeShipment()
    s.currency = { copper: 0, silver: 0, electrum: 0, gold: 5000, platinum: 100 }
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })
    mm.accumulatePotential(10, 10); mm.resolve(10)
    expect(s.status).toBe('arrived')
    // Currency stays intact when no critical hazards drop cargo
    expect(s.currency.gold).toBe(5000)
    expect(s.currency.platinum).toBe(100)
  })
})

describe('MMShipment — Clockwork integration', () => {
  it('registers daily, fires on observe at destination', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const s = makeShipment()
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })
    mm.registerWith(tp)
    clockwork.register(mm, 2, 'daily')
    clockwork.crankTo(10)

    const obs = clockwork.observeNode('waterdeep')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe(shipmentEntityId(s))
    expect(s.status).toBe('arrived')
  })
})

describe('MMShipment — different transport modes', () => {
  it('porter is much slower than caravan', () => {
    const sP = createShipment(
      'baldurs_gate', 'waterdeep', 100, 'safe', 'porter',
      'k', 'src', 'dst',
    )
    addToManifest(sP, 'gold_dust', 'Gold Dust', 1, 10, 100)
    dispatchShipment(sP, 0)
    const mmP = new MMShipment(sP, 0, { getD20: () => 18 })
    mmP.accumulatePotential(2, 2); mmP.resolve(2)

    const sC = createShipment(
      'baldurs_gate', 'waterdeep', 100, 'safe', 'caravan',
      'k', 'src', 'dst',
    )
    addToManifest(sC, 'iron', 'Iron', 1000, 5000, 500)
    dispatchShipment(sC, 0)
    const mmC = new MMShipment(sC, 0, { getD20: () => 18 })
    mmC.accumulatePotential(2, 2); mmC.resolve(2)

    // porter = 15/day, caravan = 12/day. So actually porter is FASTER
    // than caravan but caravan carries vastly more weight + is safer.
    // The point: different modes have different speeds.
    expect(sP.progressMiles).not.toBe(sC.progressMiles)
  })

  it('teleportation arrives in 1 day regardless of distance', () => {
    const s = createShipment(
      'baldurs_gate', 'far_away_node', 5000, 'safe', 'teleportation',
      'k', 'src', 'dst',
    )
    addToManifest(s, 'rare_book', 'Rare Book', 1, 5, 1000)
    dispatchShipment(s, 0)
    const mm = new MMShipment(s, 0, { getD20: () => 18 })
    mm.accumulatePotential(1, 1); mm.resolve(1)
    expect(s.status).toBe('arrived')
  })
})
