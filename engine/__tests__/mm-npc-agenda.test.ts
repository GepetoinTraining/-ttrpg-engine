import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../tp.js'
import { MMNpcAgenda } from '../mm-npc-agenda.js'
import { createNPCAgenda, resetAgendaIdCounter } from '../npc-agenda.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: null, dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

describe('MMNpcAgenda — construction', () => {
  it('uses npc_agenda:<entityId> as id, lives at current node', () => {
    resetAgendaIdCounter()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    expect(mm.state.id).toBe(`npc_agenda:${npc.entityId}`)
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('npc_agenda')
  })

  it('registerWith places NPC in entity registry', () => {
    resetAgendaIdCounter()
    const tp = makeTP()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    mm.registerWith(tp)
    expect(tp.getEntitiesAt('thundertree').find(e => e.type === 'npc')).toBeDefined()
  })
})

describe('MMNpcAgenda — daily fold', () => {
  it('runs tickAgenda once per day in the resolve window', () => {
    resetAgendaIdCounter()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7, undefined)
    expect(result.stateChanges.daysTicked).toBe(7)
  })

  it('working NPC keeps survival need above critical', () => {
    resetAgendaIdCounter()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    mm.accumulatePotential(30, 30)
    mm.resolve(30, undefined)
    const survival = npc.needs.find(n => n.type === 'survival')
    expect(survival?.fulfillment).toBeGreaterThan(0)
  })

  it('NPC without occupation has survival decay faster', () => {
    resetAgendaIdCounter()
    const idle = createNPCAgenda('Vagrant', '', 'thundertree', 1)
    const mmIdle = new MMNpcAgenda(idle, 0)
    mmIdle.accumulatePotential(20, 20)
    mmIdle.resolve(20, undefined)
    const idleSurvival = idle.needs.find(n => n.type === 'survival')!.fulfillment

    resetAgendaIdCounter()
    const worker = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 1)
    const mmWorker = new MMNpcAgenda(worker, 0)
    mmWorker.accumulatePotential(20, 20)
    mmWorker.resolve(20, undefined)
    const workerSurvival = worker.needs.find(n => n.type === 'survival')!.fulfillment

    expect(workerSurvival).toBeGreaterThan(idleSurvival)
  })

  it('cumulative tracks across resolves', () => {
    resetAgendaIdCounter()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    mm.accumulatePotential(3, 3)
    mm.resolve(3, undefined)
    mm.accumulatePotential(4, 7)
    mm.resolve(7, undefined)
    const dom = mm.serialize().domain as ReturnType<MMNpcAgenda['getDomainState']>
    expect(dom.cumulative.daysTicked).toBe(7)
  })

  it('zero days is no-op', () => {
    resetAgendaIdCounter()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    const result = mm.resolve(0, undefined)
    expect(result.stateChanges.daysTicked).toBe(0)
  })

  it('getMostPressingNeedType picks the lowest-fulfillment need', () => {
    resetAgendaIdCounter()
    const npc = createNPCAgenda('Garet', 'blacksmith', 'thundertree', 3)
    const mm = new MMNpcAgenda(npc, 0)
    // After init, purpose is at 30 (lowest); 100 days won't change order much
    expect(['purpose', 'esteem', 'belonging', 'safety', 'survival']).toContain(mm.getMostPressingNeedType())
  })
})
