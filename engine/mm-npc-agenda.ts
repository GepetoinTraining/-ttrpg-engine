/**
 * MM_NPC_AGENDA — Layer 6 ISimulatedMM adapter for npc-agenda.ts
 * ===================================================================
 *
 * One MMNpcAgenda per NPC (entity-on-node). Lives at the NPC's current
 * node. Daily cadence. Each resolve folds N days of `tickAgenda`:
 *
 *   - Needs decay (survival fastest, safety next, others slower)
 *   - Work fulfills survival; faction membership fulfills belonging
 *   - Most pressing need drives currentGoal + motivation
 *   - Economic output is derived from occupation + skills
 *
 * No κ writes — NPC state is the agent's own. Surfaces read via
 * `serialize().domain`. (NPCs contribute to economy via mm-extraction
 * etc., not directly via this MM.)
 *
 * Cadence: daily. Layer: 6 (HUB SERVICES — finest grain).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  tickAgenda,
  type NPCAgenda,
  type AgendaTickResult,
} from './npc-agenda.js'
import type { TP } from './tp.js'

export interface MMNpcAgendaDomainState {
  npc: NPCAgenda
  cumulative: {
    daysTicked: number
    needsChanges: number
    goalChanges: number
  }
  lastTickResult: AgendaTickResult | null
}

export interface MMNpcAgendaOptions {
  name?: string
}

export class MMNpcAgenda extends SimulatedMMBase {
  domain: MMNpcAgendaDomainState

  constructor(npc: NPCAgenda, worldDay: number = 0, opts: MMNpcAgendaOptions = {}) {
    const id = `npc_agenda:${npc.entityId}`
    const name = opts.name ?? `Agenda:${npc.name}`
    super(id, name, npc.currentNodeId, 'npc_agenda', worldDay)

    this.domain = {
      npc,
      cumulative: { daysTicked: 0, needsChanges: 0, goalChanges: 0 },
      lastTickResult: null,
    }
  }

  /**
   * Register the NPC as an entity at its current node.
   */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'npc',
      position: { type: 'at_node', nodeId: this.domain.npc.currentNodeId },
    })
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Need decay accumulates inside resolve.
  }

  protected onResolve(daysResolved: number, _worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const days = Math.floor(daysResolved)
    if (days === 0) {
      return {
        stateChanges: { daysTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): no days to advance.`,
        additionalEvents: [],
      }
    }

    let needsChanges = 0
    let goalChanges = 0
    let lastResult: AgendaTickResult | null = null

    for (let d = 0; d < days; d++) {
      const result = tickAgenda(this.domain.npc)
      if (result.needsChanged) needsChanges++
      if (result.goalChanged) goalChanges++
      lastResult = result
    }

    this.domain.cumulative.daysTicked += days
    this.domain.cumulative.needsChanges += needsChanges
    this.domain.cumulative.goalChanges += goalChanges
    this.domain.lastTickResult = lastResult

    const npc = this.domain.npc
    const survival = npc.needs.find(n => n.type === 'survival')?.fulfillment ?? 0
    const purpose  = npc.needs.find(n => n.type === 'purpose')?.fulfillment ?? 0

    const narrative =
      `${this.state.name} (${daysResolved}d): goal "${npc.currentGoal}", motivation "${npc.motivation}". ` +
      `survival ${survival.toFixed(0)}, purpose ${purpose.toFixed(0)}. ` +
      `${needsChanges} need changes, ${goalChanges} goal changes.`

    return {
      stateChanges: {
        daysTicked: days,
        needsChanges,
        goalChanges,
        survivalLevel: survival,
        purposeLevel: purpose,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMNpcAgendaDomainState {
    return {
      npc: { ...this.domain.npc, needs: this.domain.npc.needs.map(n => ({ ...n })) },
      cumulative: { ...this.domain.cumulative },
      lastTickResult: this.domain.lastTickResult ? { ...this.domain.lastTickResult } : null,
    }
  }

  // ── Convenience ──

  getNpc(): NPCAgenda { return this.domain.npc }
  getMostPressingNeedType(): string {
    const sorted = [...this.domain.npc.needs].sort((a, b) => a.fulfillment - b.fulfillment)
    return sorted[0]?.type ?? 'survival'
  }
}
