import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../../engine/tp'
import { attachWriteLog } from './world-tpb'

function makeTp(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region',     name: 'Sword Coast', parentId: null,         dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

describe('attachWriteLog', () => {
  it('captures writeDomain calls as writeKappa actions', () => {
    const tp = makeTp()
    const cap = attachWriteLog(tp, 'test')
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.5, dominantThreats: ['orc'] })
    cap.detach()

    expect(cap.entries).toHaveLength(1)
    const e = cap.entries[0]
    expect(e.type).toBe('writeKappa')
    if (e.type === 'writeKappa') {
      expect(e.nodeId).toBe('thundertree')
      expect(e.domain).toBe('ecology')
      expect(e.paths).toEqual(expect.arrayContaining(['ecology.dangerLevel', 'ecology.dominantThreats']))
      expect(e.system).toBe('test')
    }
  })

  it('captures writeKappa calls grouped by domain', () => {
    const tp = makeTp()
    const cap = attachWriteLog(tp, 'test')
    tp.writeKappa('thundertree', {
      'ecology.dangerLevel': 0.4,
      'ecology.dominantThreats': ['goblin'],
      'weather.severity': 0.2,
    })
    cap.detach()

    // Two entries — one per top-level domain.
    expect(cap.entries).toHaveLength(2)
    const ecology = cap.entries.find((e) => e.type === 'writeKappa' && e.domain === 'ecology')
    const weather = cap.entries.find((e) => e.type === 'writeKappa' && e.domain === 'weather')
    expect(ecology).toBeDefined()
    expect(weather).toBeDefined()
  })

  it('does not capture writes that fail (invalid Zod or missing node)', () => {
    const tp = makeTp()
    const cap = attachWriteLog(tp, 'test')
    // unknown node — writeDomain returns false
    tp.writeDomain('nonexistent', 'ecology', { dangerLevel: 0.5 })
    cap.detach()
    expect(cap.entries).toHaveLength(0)
  })

  it('detach restores original methods', () => {
    const tp = makeTp()
    const cap = attachWriteLog(tp, 'test')
    cap.detach()
    // Subsequent writes should not be captured
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.5 })
    expect(cap.entries).toHaveLength(0)
  })

  it('multiple writes accumulate in order', () => {
    const tp = makeTp()
    const cap = attachWriteLog(tp, 'test')
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.3 })
    tp.writeDomain('sword_coast', 'ecology', { dangerLevel: 0.6 })
    tp.writeDomain('thundertree', 'weather', { severity: 0.1 })
    cap.detach()
    expect(cap.entries).toHaveLength(3)
    expect(cap.entries.map((e) => e.type === 'writeKappa' && e.nodeId)).toEqual([
      'thundertree',
      'sword_coast',
      'thundertree',
    ])
  })
})
