/**
 * MM_CARAVAN TESTS — the lifeblood of Faerûn.
 *
 * Caravans move:
 *   - cargo (commodities)         → delivered + traded for gold
 *   - bullion (uncoined gold)     → bank vaults (mm-banking)
 *   - rumors                      → fidelity drops per retelling
 *   - books                       → knowledge flow at destination
 *
 * Tests cover departure → daily transit → arrival → unload + bullion
 * delivery + rumor spread, destruction → bullion lost, weather/danger
 * effects from κ, edge segment lookups via callback.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MMCaravan, caravanEntityId, type SegmentInfo } from '../mm-caravan.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode } from '../tp.js'
import { createCaravan, loadCargo, departCaravan, type CargoItem } from '../caravan.js'
import { createRumor, type Library } from '../lore.js'
import { createVault } from '../banking.js'
import { MMBanking, resetShipmentIdCounter } from '../mm-banking.js'

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

function makeWagonCaravan() {
  const c = createCaravan('wagon', 'merchant_thann', 'merchant',
    'baldurs_gate', 'waterdeep', 'edge:trade_route', 5)
  loadCargo(c, {
    commodityId: 'iron', quantity: 100,
    weightLbs: 1000, valueTotalGp: 500,
    perishable: false, daysSinceLoaded: 0,
  } satisfies CargoItem)
  departCaravan(c)
  return c
}

describe('MMCaravan — construction + registration', () => {
  it('id derived from caravan; nodeId = destination', () => {
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0)
    expect(mm.state.id).toBe(caravanEntityId(c))
    expect(mm.state.nodeId).toBe('waterdeep')
    expect(mm.state.mmType).toBe('caravan')
  })

  it('registerWith puts the caravan as on_edge entity', () => {
    const tp = makeTP()
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0)
    mm.registerWith(tp)
    const found = tp.getEntity(caravanEntityId(c))
    expect(found?.type).toBe('caravan')
    expect(found?.position.type).toBe('on_edge')
    if (found?.position.type === 'on_edge') {
      expect(found.position.edgeId).toBe('edge:trade_route')
    }
  })
})

describe('MMCaravan — daily advance', () => {
  it('en_route caravan advances segments per day', () => {
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,  // no encounter (above any reasonable danger)
    })
    mm.accumulatePotential(2, 2)
    mm.resolve(2)
    // wagon = 1 segment/day baseline; over 2 days → segments 2
    expect(c.currentSegment).toBeGreaterThan(0)
    expect(c.daysTraveled).toBe(2)
  })

  it('reaches destination → status = arrived → arrival package fired', () => {
    const c = makeWagonCaravan()  // 5 segments, wagon = 1/day → ~5 days
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
    })
    mm.accumulatePotential(10, 10)
    mm.resolve(10)
    expect(c.status).toBe('arrived')
    const arrival = mm.getArrival()
    expect(arrival).not.toBeNull()
    expect(arrival!.unload.deliveredItems.length).toBe(1)  // one cargo item
    expect(arrival!.unload.totalValueGp).toBe(500)
  })

  it('updates entity position on edge as it advances', () => {
    const tp = makeTP()
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
    })
    mm.registerWith(tp)
    mm.accumulatePotential(2, 2); mm.resolve(2, tp)
    const ent = tp.getEntity(mm.state.id)!
    if (ent.position.type === 'on_edge') {
      expect(ent.position.mile).toBeGreaterThan(0)
    } else {
      throw new Error('caravan should still be on_edge after 2 days')
    }
  })

  it('arrival flips entity position to at_node', () => {
    const tp = makeTP()
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
    })
    mm.registerWith(tp)
    mm.accumulatePotential(10, 10); mm.resolve(10, tp)
    const ent = tp.getEntity(mm.state.id)!
    expect(ent.position.type).toBe('at_node')
    if (ent.position.type === 'at_node') {
      expect(ent.position.nodeId).toBe('waterdeep')
    }
  })

  it('high-danger segment with low d20 triggers encounter', () => {
    const c = makeWagonCaravan()
    c.guards = 5  // some defense
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 8, toll: 0 }),
      getD20: () => 2,  // d20 ≤ 8 (danger) → encounter; d20 ≤ 2 → monster_attack
    })
    mm.accumulatePotential(1, 1); mm.resolve(1)
    expect(mm.serialize().domain).toBeTruthy()
    const dr = (mm.serialize().domain as any).dayResults
    expect(dr[0].encounter).not.toBeNull()
    expect(dr[0].encounter.type).toBe('monster_attack')
  })
})

describe('MMCaravan — bullion shipment integration', () => {
  it('aboard bullion is marked delivered on arrival', () => {
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
    })

    // Source bank ships bullion; caravan picks it up
    const sourceVault = createVault('bank_baldurs', 10_000)
    const sourceBank = new MMBanking('baldurs_gate', sourceVault, 'house_thann', 'curr_baldurs', [], [], 0)
    const ship = sourceBank.shipBullion('bank:bank_waterdeep', 2000, 0)!
    sourceBank.markShipmentInTransit(ship.id, c.edgeId, mm.state.id)
    mm.loadBullion(ship)

    // Resolve until arrival
    mm.accumulatePotential(10, 10); mm.resolve(10)

    expect(c.status).toBe('arrived')
    const arrival = mm.getArrival()!
    expect(arrival.bullionDelivered.length).toBe(1)
    expect(arrival.bullionDelivered[0].status).toBe('delivered')
    expect(arrival.bullionDelivered[0].amount).toBe(2000)
  })

  it('destruction marks all aboard bullion as lost', () => {
    const c = makeWagonCaravan()
    c.guards = 0  // no defense
    const mm = new MMCaravan(c, 0, {
      // High danger ensures encounter; defense roll low → destruction.
      getSegmentInfo: () => ({ dangerLevel: 10, toll: 0 }),
      getD20: () => 1,  // monster_attack vs no guards = destroyed
    })

    const sourceVault = createVault('bank_baldurs', 10_000)
    const sourceBank = new MMBanking('baldurs_gate', sourceVault, 'house_thann', 'curr', [], [], 0)
    const ship = sourceBank.shipBullion('bank:bank_waterdeep', 2000, 0)!
    sourceBank.markShipmentInTransit(ship.id, c.edgeId, mm.state.id)
    mm.loadBullion(ship)

    mm.accumulatePotential(5, 5); mm.resolve(5)

    expect(c.status).toBe('destroyed')
    const arrival = mm.getArrival()!
    const lost = arrival.bullionDelivered[0]
    expect(lost.status).toBe('lost')
    expect(lost.lossReason).toMatch(/destroyed/)
  })
})

describe('MMCaravan — rumor spreading (the lifeblood of news)', () => {
  it('carried rumors spread on arrival with fidelity drift', () => {
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 8,  // → fidelityLoss 0.05 per spread
    })

    const rumor = createRumor(
      'A red dragon nests in the Sword Mountains',
      'monster',
      0.9,
      'innkeeper_kent',
      'traveler_alric',
      0,
      60,
    )
    expect(rumor.fidelity).toBe(1.0)
    mm.loadRumor(rumor)

    mm.accumulatePotential(10, 10); mm.resolve(10)
    expect(c.status).toBe('arrived')

    const arrival = mm.getArrival()!
    expect(arrival.rumorsSpread.length).toBe(1)
    const spread = arrival.rumorsSpread[0]
    // Each retelling drops fidelity (d20=8 → -0.1, d20=10-14 → -0.05, d20≥15 → 0)
    expect(spread.fidelity).toBeLessThan(rumor.fidelity)
    // Source chain extended with destination hub
    expect(spread.sourceChain).toContain('waterdeep')
  })

  it('multiple rumors all spread on arrival', () => {
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
    })

    for (let i = 0; i < 4; i++) {
      mm.loadRumor(createRumor(`rumor_${i}`, 'history', 0.8,
        'h', 's', 0, 60))
    }
    mm.accumulatePotential(10, 10); mm.resolve(10)
    expect(mm.getArrival()!.rumorsSpread.length).toBe(4)
  })

  it('books boost knowledge flow at destination via library tier', () => {
    const c = makeWagonCaravan()
    const lib: Library = {
      id: 'lib_waterdeep', name: 'Waterdeep Civic', nodeId: 'waterdeep',
      settlementId: 'waterdeep', tier: 'civic_library', bookCount: 500,
      knowledgeIds: [], entryRequirement: 'free',
    }
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
      getDestinationLibrary: () => lib,
    })

    mm.loadRumor(createRumor('test', 'arcana', 0.9, 'h', 's', 0, 60))
    mm.loadBooks(2)

    mm.accumulatePotential(10, 10); mm.resolve(10)
    const arrival = mm.getArrival()!
    expect(arrival.knowledgeFlow).toBeDefined()
    expect(arrival.knowledgeFlow!.booksTraded).toBe(2)
    expect(arrival.knowledgeFlow!.newRumors).toBe(1)
    expect(arrival.knowledgeFlow!.knowledgeDisseminated).toBeGreaterThan(0)
  })

  it('destroyed caravan does NOT spread rumors (they died with it)', () => {
    const c = makeWagonCaravan()
    c.guards = 0
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 10, toll: 0 }),
      getD20: () => 1,
    })
    mm.loadRumor(createRumor('the king is dying', 'politics', 0.95, 'h', 's', 0, 30))
    mm.accumulatePotential(5, 5); mm.resolve(5)
    expect(c.status).toBe('destroyed')
    expect(mm.getArrival()!.rumorsSpread).toEqual([])
  })
})

describe('MMCaravan — weather κ effects', () => {
  it('travelSpeed modifier scales daily segment advance', () => {
    const tp1 = makeTP()
    const tp2 = makeTP()
    // Bad weather at destination cuts speed in half
    tp2.writeDomain('waterdeep', 'weather', {
      season: 'winter', precipitation: 'blizzard',
      modifiers: {
        yieldModifier: 1, travelSpeed: 0.5, monsterActivity: 1,
        spoilageRate: 1, combatEffects: [],
      },
    })
    const cA = makeWagonCaravan()
    const cB = makeWagonCaravan()
    const mmA = new MMCaravan(cA, 0, { getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }), getD20: () => 15 })
    const mmB = new MMCaravan(cB, 0, { getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }), getD20: () => 15 })
    mmA.accumulatePotential(2, 2); mmA.resolve(2, tp1)
    mmB.accumulatePotential(2, 2); mmB.resolve(2, tp2)
    expect(cB.currentSegment).toBeLessThanOrEqual(cA.currentSegment)
  })
})

describe('MMCaravan — Clockwork integration', () => {
  it('registers daily, fires on observe at destination', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const c = makeWagonCaravan()
    const mm = new MMCaravan(c, 0, {
      getSegmentInfo: () => ({ dangerLevel: 0, toll: 0 }),
      getD20: () => 15,
    })
    mm.registerWith(tp)
    clockwork.register(mm, 2, 'daily')
    clockwork.crankTo(8)

    // Caravan should have arrived; observation at the destination fires resolve.
    const obs = clockwork.observeNode('waterdeep')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe(caravanEntityId(c))
    expect(c.status).toBe('arrived')
  })
})
