import { describe, it, expect } from 'vitest'
import {
  tensorColumnFor,
  appendTensorEntry,
  snapshotFromRow,
  flattenSnapshot,
  type TensorEntry,
} from './hub-tensor'
import type { WorldTPBAction } from '../../engine/tpb-world'

const writeKappa: WorldTPBAction = {
  type: 'writeKappa',
  nodeId: 'suzail',
  domain: 'economy',
  paths: ['economy.tradeModifier'],
  system: 'test',
}
const observe: WorldTPBAction = { type: 'observe', nodeId: 'suzail', partyId: 'party' }
const entityMove: WorldTPBAction = {
  type: 'entityMove',
  entityId: 'party',
  from: { type: 'at_node', nodeId: 'suzail' },
  to: { type: 'at_node', nodeId: 'wheloon' },
}

function entry(seq: number, action: WorldTPBAction, actor = 'cert-a'): TensorEntry {
  return { seq, actorCertId: actor, at: '2026-05-01T00:00:00Z', action, receipt: { ok: true } }
}

describe('tensorColumnFor', () => {
  it('maps every variant to its JSON column', () => {
    expect(tensorColumnFor('tick')).toBe('tickJson')
    expect(tensorColumnFor('writeKappa')).toBe('writeKappaJson')
    expect(tensorColumnFor('writeEdge')).toBe('writeEdgeJson')
    expect(tensorColumnFor('entitySpawn')).toBe('entitySpawnJson')
    expect(tensorColumnFor('entityMove')).toBe('entityMoveJson')
    expect(tensorColumnFor('entityDespawn')).toBe('entityDespawnJson')
    expect(tensorColumnFor('observe')).toBe('observeJson')
    expect(tensorColumnFor('session')).toBe('sessionJson')
    expect(tensorColumnFor('characterTransfer')).toBe('characterTransferJson')
  })
})

describe('appendTensorEntry', () => {
  it('appends to an empty array', () => {
    const out = appendTensorEntry('[]', entry(1, writeKappa))
    expect(JSON.parse(out)).toHaveLength(1)
  })

  it('preserves arrival order', () => {
    let s = '[]'
    s = appendTensorEntry(s, entry(1, writeKappa))
    s = appendTensorEntry(s, entry(2, writeKappa))
    s = appendTensorEntry(s, entry(3, writeKappa))
    const arr = JSON.parse(s) as TensorEntry[]
    expect(arr.map((e) => e.seq)).toEqual([1, 2, 3])
  })

  it('treats malformed JSON as empty (receipts table is canonical)', () => {
    const out = appendTensorEntry('not-json', entry(7, writeKappa))
    const arr = JSON.parse(out) as TensorEntry[]
    expect(arr).toHaveLength(1)
    expect(arr[0].seq).toBe(7)
  })

  it('treats non-array JSON as empty', () => {
    const out = appendTensorEntry('{"oops": true}', entry(2, writeKappa))
    const arr = JSON.parse(out) as TensorEntry[]
    expect(arr).toHaveLength(1)
  })
})

describe('snapshotFromRow + flattenSnapshot', () => {
  it('groups entries by type when projecting from row', () => {
    const row = {
      tickJson: '[]',
      writeKappaJson: JSON.stringify([entry(1, writeKappa), entry(3, writeKappa)]),
      writeEdgeJson: '[]',
      entitySpawnJson: '[]',
      entityMoveJson: JSON.stringify([entry(2, entityMove)]),
      entityDespawnJson: '[]',
      observeJson: JSON.stringify([entry(4, observe)]),
      sessionJson: '[]',
      characterTransferJson: '[]',
    }
    const snap = snapshotFromRow(row)
    expect(snap.writeKappa).toHaveLength(2)
    expect(snap.entityMove).toHaveLength(1)
    expect(snap.observe).toHaveLength(1)
    expect(snap.tick).toHaveLength(0)
  })

  it('flattens to global seq order regardless of column', () => {
    const row = {
      tickJson: '[]',
      writeKappaJson: JSON.stringify([entry(1, writeKappa), entry(4, writeKappa)]),
      writeEdgeJson: '[]',
      entitySpawnJson: '[]',
      entityMoveJson: JSON.stringify([entry(2, entityMove)]),
      entityDespawnJson: '[]',
      observeJson: JSON.stringify([entry(3, observe)]),
      sessionJson: '[]',
      characterTransferJson: '[]',
    }
    const flat = flattenSnapshot(snapshotFromRow(row))
    expect(flat.map((e) => e.seq)).toEqual([1, 2, 3, 4])
  })

  it('handles malformed columns by treating them as empty', () => {
    const row = {
      tickJson: 'garbage',
      writeKappaJson: JSON.stringify([entry(1, writeKappa)]),
      writeEdgeJson: '{}',
      entitySpawnJson: '[]',
      entityMoveJson: '[]',
      entityDespawnJson: '[]',
      observeJson: '[]',
      sessionJson: '[]',
      characterTransferJson: '[]',
    }
    const snap = snapshotFromRow(row)
    expect(snap.tick).toEqual([])
    expect(snap.writeEdge).toEqual([])
    expect(snap.writeKappa).toHaveLength(1)
  })
})
