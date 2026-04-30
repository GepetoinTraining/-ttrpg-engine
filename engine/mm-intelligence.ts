/**
 * MM_INTELLIGENCE — Layer 3 ISimulatedMM adapter for intelligence.ts
 * ====================================================================
 *
 * One MMIntelligence per AGENT (an NPC, a faction-as-agent, the world,
 * etc — see AgentType enum in intelligence.ts). Lives at the agent's
 * current location node and registers in TP as `type='agent'`. Ticks
 * monthly. Each resolve folds N months of:
 *
 *   - decayMemories(memories, currentDay) — reduces vividness over time.
 *     Episodic memories fade fastest (2%/day), important slower
 *     (×0.5 if importance ≥7), emotional slowest (×0.25), legendary
 *     nearly permanent (×0.1 if importance ≥9).
 *   - Drops fully-forgotten memories (vividness < threshold) to keep
 *     the array bounded.
 *
 * The HOLE this MM fills:
 *   Faction leaders are NPCs. NPCs hold memories. Memories shape what
 *   the leader knows, who they hold grudges against, what trade
 *   partners they remember favorably. MMFaction reads the leader's
 *   *drives* (from intent.ts) for goal bias; MMIntelligence is where
 *   the *memory state* lives so those drives can be informed by
 *   recent events. (Surface pulls a leader's relevant memories at
 *   conversation time via `retrieveMemories`.)
 *
 * Cadence: monthly. Layer: 3 (FACTION) — alongside MMFaction + MMWarfare.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  decayMemories,
  type IdentityAnchor,
  type KnowledgeBoundary,
  type AgentMemory,
} from './intelligence.js'
import type { TP } from './tp.js'

export interface MMIntelligenceDomainState {
  agentId: string
  identity: IdentityAnchor
  /** What this agent knows. Knowledge boundary enforced via filterKnowledge at query time. */
  knowledge: KnowledgeBoundary
  /** Memories. Decayed monthly. Faded ones (vividness < threshold) pruned. */
  memories: AgentMemory[]
  /** Threshold below which a memory is treated as forgotten and pruned. */
  forgetThreshold: number
  cumulative: {
    monthsTicked: number
    memoriesForgotten: number
  }
}

export interface MMIntelligenceOptions {
  /** Memories with vividness below this are pruned each tick. Default 0.05. */
  forgetThreshold?: number
  name?: string
}

/** Stable entity id used in the TP entity registry. */
export function agentEntityId(identity: IdentityAnchor): string {
  return `agent:${identity.agentId}`
}

export class MMIntelligence extends SimulatedMMBase {
  domain: MMIntelligenceDomainState

  constructor(
    identity: IdentityAnchor,
    knowledge: KnowledgeBoundary,
    memories: AgentMemory[],
    nodeId: string,
    worldDay: number = 0,
    opts: MMIntelligenceOptions = {},
  ) {
    super(
      agentEntityId(identity),
      opts.name ?? `Mind:${identity.name}`,
      nodeId,
      'intelligence',
      worldDay,
    )
    this.domain = {
      agentId: identity.agentId,
      identity,
      knowledge,
      memories,
      forgetThreshold: opts.forgetThreshold ?? 0.05,
      cumulative: { monthsTicked: 0, memoriesForgotten: 0 },
    }
  }

  /** Register the agent in TP for spatial queries. */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'agent',
      position: { type: 'at_node', nodeId: this.state.nodeId },
    })
  }

  /** Add a fresh memory (called when something happens to the agent). */
  recordMemory(memory: AgentMemory): void {
    this.domain.memories.push(memory)
  }

  /** Add a knowledge entry (e.g. learned a fact or rumor). */
  recordKnowledge(scope: KnowledgeBoundary['entries'][number]): void {
    this.domain.knowledge.entries.push(scope)
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Memory decay folds inside resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const months = Math.floor(daysResolved / 30)
    if (months === 0) {
      return {
        stateChanges: { monthsTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no decay.`,
        additionalEvents: [],
      }
    }

    const before = this.domain.memories.length

    // Decay vividness based on time elapsed since each memory's worldDay.
    // decayMemories reads daysSince = currentDay - memory.worldDay; worldDay
    // here is already the current resolve-time day, so pass it directly.
    const decayed = decayMemories(this.domain.memories, worldDay)

    // Prune fully forgotten memories (below threshold).
    const surviving = decayed.filter(m => m.vividness >= this.domain.forgetThreshold)
    const forgotten = before - surviving.length

    this.domain.memories = surviving
    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.memoriesForgotten += forgotten

    const remainingByType = countByType(this.domain.memories)
    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo): ` +
      `${this.domain.memories.length} memories ` +
      `(${remainingByType.episodic} episodic, ` +
      `${remainingByType.semantic} semantic, ` +
      `${remainingByType.emotional} emotional)` +
      (forgotten > 0 ? ` — ${forgotten} forgotten` : '') +
      `.`

    return {
      stateChanges: {
        monthsTicked: months,
        memoryCount: this.domain.memories.length,
        forgottenThisResolve: forgotten,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMIntelligenceDomainState {
    return {
      agentId: this.domain.agentId,
      identity: { ...this.domain.identity },
      knowledge: {
        entries: this.domain.knowledge.entries.map(e => ({ ...e })),
        exclusions: [...this.domain.knowledge.exclusions],
        allowedScopes: [...this.domain.knowledge.allowedScopes],
      },
      memories: this.domain.memories.map(m => ({ ...m })),
      forgetThreshold: this.domain.forgetThreshold,
      cumulative: { ...this.domain.cumulative },
    }
  }

  /** Convenience: count of remaining memories. */
  memoryCount(): number {
    return this.domain.memories.length
  }

  /** Convenience: peek the identity. */
  getIdentity(): IdentityAnchor {
    return { ...this.domain.identity }
  }
}

// ============================================================
// HELPERS
// ============================================================

function countByType(memories: AgentMemory[]): { episodic: number; semantic: number; emotional: number } {
  const out = { episodic: 0, semantic: 0, emotional: 0 }
  for (const m of memories) out[m.memoryType]++
  return out
}
