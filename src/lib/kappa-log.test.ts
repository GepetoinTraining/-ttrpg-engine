import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../../engine/tp'
import { attachWriteLog } from '../../engine/tp-write-capture'
import { applyKappaLog } from './kappa-log'
import type { WorldTPBAction } from '../../engine/tpb-world'

function freshTp(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region',     name: 'Sword Coast', parentId: null,         dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

// ============================================================
// attachWriteLog now captures `value` on writeKappa actions
// ============================================================

describe('attachWriteLog — captures values (Phase 2.9 wire)', () => {
  it('writeDomain captures the value passed in', () => {
    const tp = freshTp()
    const cap = attachWriteLog(tp, 'test')
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.4, dominantThreats: ['orc'] })
    cap.detach()
    expect(cap.entries).toHaveLength(1)
    const a = cap.entries[0]
    expect(a.type).toBe('writeKappa')
    if (a.type === 'writeKappa') {
      expect(a.value).toEqual({ dangerLevel: 0.4, dominantThreats: ['orc'] })
    }
  })

  it('writeKappa (path-based) captures values grouped by domain', () => {
    const tp = freshTp()
    const cap = attachWriteLog(tp, 'test')
    tp.writeKappa('thundertree', { 'ecology.dangerLevel': 0.5 })
    cap.detach()
    expect(cap.entries).toHaveLength(1)
    const a = cap.entries[0]
    if (a.type === 'writeKappa') {
      expect(a.value).toEqual({ 'ecology.dangerLevel': 0.5 })
    }
  })
})

// ============================================================
// applyKappaLog — replay deltas into a fresh TP
// ============================================================

describe('applyKappaLog — log replay (κ persistence)', () => {
  it('replays a single writeKappa with value into the TP', () => {
    const tp = freshTp()
    const action: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: 'thundertree',
      domain: 'ecology',
      paths: ['ecology.dangerLevel'],
      system: 'test',
      value: { dangerLevel: 0.7, dominantThreats: ['orc'] },
    }
    applyKappaLog(tp, [JSON.stringify(action)])
    const ctx = tp.resolve('thundertree')
    expect(ctx?.ecology?.dangerLevel).toBe(0.7)
    expect(ctx?.ecology?.dominantThreats).toContain('orc')
  })

  it('multiple deltas applied in order — last write wins per domain', () => {
    const tp = freshTp()
    const a1: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: 'thundertree',
      domain: 'ecology',
      paths: ['ecology.dangerLevel'],
      system: 'test',
      value: { dangerLevel: 0.3 },
    }
    const a2: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: 'thundertree',
      domain: 'ecology',
      paths: ['ecology.dangerLevel'],
      system: 'test',
      value: { dangerLevel: 0.8 },
    }
    applyKappaLog(tp, [JSON.stringify(a1), JSON.stringify(a2)])
    const ctx = tp.resolve('thundertree')
    expect(ctx?.ecology?.dangerLevel).toBe(0.8)
  })

  it('skips writeKappa entries without a value (legacy / pre-Phase-2.9)', () => {
    const tp = freshTp()
    const action: WorldTPBAction = {
      type: 'writeKappa',
      nodeId: 'thundertree',
      domain: 'ecology',
      paths: ['ecology.dangerLevel'],
      system: 'test',
      // value omitted
    }
    applyKappaLog(tp, [JSON.stringify(action)])
    const ctx = tp.resolve('thundertree')
    expect(ctx?.ecology?.dangerLevel).toBeUndefined()
  })

  it('skips non-writeKappa entries', () => {
    const tp = freshTp()
    const obs: WorldTPBAction = {
      type: 'observe',
      nodeId: 'thundertree',
      partyId: 'party',
    }
    applyKappaLog(tp, [JSON.stringify(obs)])
    // No κ writes were made; nothing to assert except no throw.
    expect(true).toBe(true)
  })

  it('skips malformed JSON without throwing', () => {
    const tp = freshTp()
    expect(() => applyKappaLog(tp, ['not json {{{', null])).not.toThrow()
  })

  it('round-trip: capture → JSON → replay → tp.resolve sees the κ', () => {
    const sourceTp = freshTp()
    const cap = attachWriteLog(sourceTp, 'capture-test')
    sourceTp.writeDomain('thundertree', 'ecology', {
      dangerLevel: 0.6,
      dominantThreats: ['wolf', 'orc'],
    })
    cap.detach()

    // Serialize captured entries (mimics tpb_entries.deltaJson)
    const deltaJsons = cap.entries.map((a) => JSON.stringify(a))

    // Replay into a fresh TP
    const targetTp = freshTp()
    applyKappaLog(targetTp, deltaJsons)

    const ctx = targetTp.resolve('thundertree')
    expect(ctx?.ecology?.dangerLevel).toBe(0.6)
    expect(ctx?.ecology?.dominantThreats).toEqual(['wolf', 'orc'])
  })
})
