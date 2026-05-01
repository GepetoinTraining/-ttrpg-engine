import { describe, it, expect } from 'vitest'
import { checkActionAllowed, assertActionAllowed } from './action-authz'
import type { WorldTPBAction } from '../../engine/tpb-world'

const writeKappa: WorldTPBAction = {
  type: 'writeKappa',
  nodeId: 'suzail',
  domain: 'economy',
  paths: ['economy.tradeModifier'],
  system: 'test',
}
const entityMove: WorldTPBAction = {
  type: 'entityMove',
  entityId: 'party',
  from: { type: 'at_node', nodeId: 'suzail' },
  to: { type: 'at_node', nodeId: 'wheloon' },
}
const observe: WorldTPBAction = { type: 'observe', nodeId: 'suzail', partyId: 'party' }
const tick: WorldTPBAction = { type: 'tick', worldDay: 1, cadence: 'daily', mmsTicked: 0 }
const characterTransfer: WorldTPBAction = {
  type: 'characterTransfer',
  characterId: 'cert-x',
  fromAccountId: 'a1',
  toAccountId: 'a2',
  initiateSig: 's1',
  acceptSig: 's2',
}
const entitySpawn: WorldTPBAction = {
  type: 'entitySpawn',
  entityType: 'monster',
  entityId: 'wolf-1',
  position: { type: 'at_node', nodeId: 'forest' },
}
const entityDespawn: WorldTPBAction = { type: 'entityDespawn', entityId: 'wolf-1', reason: 'killed' }
const writeEdge: WorldTPBAction = {
  type: 'writeEdge',
  edgeId: 'high_road_25',
  field: 'dangerLevel',
  system: 'test',
}
const session: WorldTPBAction = { type: 'session', sessionId: 's1', event: 'start' }

describe('checkActionAllowed — open-to-everyone actions', () => {
  it('allows writeKappa for any persona', () => {
    expect(checkActionAllowed(writeKappa, 'player')).toBeNull()
    expect(checkActionAllowed(writeKappa, 'dm')).toBeNull()
    expect(checkActionAllowed(writeKappa, 'gm-ai')).toBeNull()
    expect(checkActionAllowed(writeKappa, 'dmless')).toBeNull()
  })

  it('allows entityMove for any persona', () => {
    expect(checkActionAllowed(entityMove, 'player')).toBeNull()
    expect(checkActionAllowed(entityMove, 'dmless')).toBeNull()
  })

  it('allows observe for any persona', () => {
    expect(checkActionAllowed(observe, 'player')).toBeNull()
    expect(checkActionAllowed(observe, 'dmless')).toBeNull()
  })
})

describe('checkActionAllowed — server-only actions', () => {
  it('rejects tick from any persona — cron-only', () => {
    expect(checkActionAllowed(tick, 'player')).toMatch(/tick is cron-only/)
    expect(checkActionAllowed(tick, 'dm')).toMatch(/tick is cron-only/)
    expect(checkActionAllowed(tick, 'gm-ai')).toMatch(/tick is cron-only/)
    expect(checkActionAllowed(tick, 'dmless')).toMatch(/tick is cron-only/)
  })

  it('rejects characterTransfer from any persona — trade flow only', () => {
    expect(checkActionAllowed(characterTransfer, 'player')).toMatch(/characterTransfer flows through/)
    expect(checkActionAllowed(characterTransfer, 'dm')).toMatch(/characterTransfer flows through/)
  })
})

describe('checkActionAllowed — GM-authority gated actions', () => {
  it('allows entitySpawn for dm and gm-ai', () => {
    expect(checkActionAllowed(entitySpawn, 'dm')).toBeNull()
    expect(checkActionAllowed(entitySpawn, 'gm-ai')).toBeNull()
  })

  it('rejects entitySpawn for player and dmless', () => {
    expect(checkActionAllowed(entitySpawn, 'player')).toMatch(/requires GM authority/)
    expect(checkActionAllowed(entitySpawn, 'dmless')).toMatch(/requires GM authority/)
  })

  it('gates entityDespawn, writeEdge, session the same way', () => {
    expect(checkActionAllowed(entityDespawn, 'dm')).toBeNull()
    expect(checkActionAllowed(entityDespawn, 'player')).toMatch(/GM authority/)
    expect(checkActionAllowed(writeEdge, 'gm-ai')).toBeNull()
    expect(checkActionAllowed(writeEdge, 'dmless')).toMatch(/GM authority/)
    expect(checkActionAllowed(session, 'dm')).toBeNull()
    expect(checkActionAllowed(session, 'player')).toMatch(/GM authority/)
  })
})

describe('assertActionAllowed', () => {
  it('returns silently when allowed', () => {
    expect(() => assertActionAllowed(writeKappa, 'player')).not.toThrow()
  })
  it('throws with the denial reason when not allowed', () => {
    expect(() => assertActionAllowed(tick, 'player')).toThrow(/tick is cron-only/)
    expect(() => assertActionAllowed(entitySpawn, 'player')).toThrow(/GM authority/)
  })
})
