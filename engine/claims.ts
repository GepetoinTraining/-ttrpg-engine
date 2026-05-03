/**
 * CLAIMS — Player-side land + plot ownership
 * ==============================================
 *
 * The slow-life "I claim this!" trope, deliberately undocumented in the
 * brochure but real in the engine. A character (or faction, but the
 * primary user is a PC) can stake a claim on:
 *
 *   - a `node`           — a whole settlement / district / building lot
 *   - a `deposit`        — an iron vein, a forest tract, a fishery
 *   - a `farm_plot`      — a specific FarmPlot
 *   - a `building`       — a forge, an inn, a workshop
 *   - an `edge_segment`  — a stretch of road or river (toll rights)
 *
 * Claims have lifecycle:
 *   pending → active → (contested | lapsed | forfeit | inherited)
 *
 * - Filing on an unclaimed target → status = 'active'
 * - Filing on an already-active target → both flip to 'contested'
 *   (resolution happens via siege/court/duel — not modeled here, just
 *   the bookkeeping)
 * - Failing to tend (lastTendedDay older than lapseAfterDays) → 'lapsed'
 *
 * `legitimacy` records the source of right: 'self' (squatter), a faction
 * id (chartered), 'crown' (royal grant), 'church' (ecclesiastical),
 * 'inheritance' (passed down). The engine doesn't enforce legitimacy
 * politics — surfaces and faction systems can act on the field later.
 *
 * Yield routing (PC's claimed iron vein puts ore in PC's stockpile, not
 * the settlement's) is wired in a later wave when per-character containers
 * land. v1 just records the ownership relationship.
 */

import { z } from 'zod'

// ============================================================
// SCHEMA
// ============================================================

export const ClaimTargetTypeSchema = z.enum([
  'node', 'deposit', 'farm_plot', 'building', 'edge_segment', 'herd', 'workshop',
])
export type ClaimTargetType = z.infer<typeof ClaimTargetTypeSchema>

export const ClaimStatusSchema = z.enum([
  'pending',     // filed but not yet acknowledged
  'active',      // recognized, in good standing
  'contested',   // another claim on same target — resolution pending
  'lapsed',      // claimant failed to tend
  'forfeit',     // lost (lost trial, conquered, etc)
  'inherited',   // transferred to heir
])
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>

export const ClaimSchema = z.object({
  id: z.string(),
  /** Character or faction holding the claim. */
  claimantId: z.string(),
  targetType: ClaimTargetTypeSchema,
  /** Specific target id (deposit id, farm_plot id, building id, etc). */
  targetId: z.string(),
  /** The .tp node where the target physically sits — for spatial queries. */
  nodeId: z.string(),
  claimedDay: z.number().int().nonnegative(),
  status: ClaimStatusSchema.default('pending'),
  /**
   * Yield share routed to the claimant (0–1). 1 = all output goes to
   * claimant; 0 = symbolic ownership only (e.g. titular).
   */
  yieldShare: z.number().min(0).max(1).default(1),
  /** Tax owed to the local sovereign as a fraction of yield (0–1). */
  taxRate: z.number().min(0).max(1).default(0),
  /**
   * Days of inactivity after which the claim auto-lapses. Undefined =
   * never lapses (royal grant, freehold). Most squatter claims do lapse.
   */
  lapseAfterDays: z.number().int().nonnegative().optional(),
  /** Last world day the claimant worked / paid taxes / showed up. */
  lastTendedDay: z.number().int().nonnegative().optional(),
  /** Source of right: 'self' / faction id / 'crown' / 'church' / 'inheritance'. */
  legitimacy: z.string().default('self'),
  /** Free-form note (deed reference, witness names, court ruling). */
  note: z.string().optional(),
})
export type Claim = z.infer<typeof ClaimSchema>

/**
 * Claim target types that count as "I have a place to study here." A study
 * needs a fixed bench/forge/plot — building, workshop, deposit, farm_plot,
 * or a whole settlement (rare; royal grant). `edge_segment` (toll road) and
 * `herd` (cattle) don't qualify.
 */
export const STUDY_ELIGIBLE_TARGET_TYPES: readonly ClaimTargetType[] = [
  'building', 'workshop', 'deposit', 'farm_plot', 'node',
] as const

// ============================================================
// REGISTRY — fast lookup by target / claimant / node
// ============================================================

function targetKey(targetType: ClaimTargetType, targetId: string): string {
  return `${targetType}:${targetId}`
}

export class ClaimRegistry {
  private claims = new Map<string, Claim>()
  // (targetType:targetId) → Set<claimId>
  private byTarget = new Map<string, Set<string>>()
  // claimantId → Set<claimId>
  private byClaimant = new Map<string, Set<string>>()
  // nodeId → Set<claimId>
  private byNode = new Map<string, Set<string>>()

  /**
   * Register a claim. If another active claim already exists on the same
   * target, both flip to 'contested' — caller is told via the result.
   *
   * Returns the registered claim (with status possibly mutated to
   * 'contested') plus the list of pre-existing claims that were also
   * marked contested.
   */
  register(claim: Claim): { claim: Claim; contestedExisting: Claim[] } {
    const tk = targetKey(claim.targetType, claim.targetId)
    const existingIds = this.byTarget.get(tk) ?? new Set()
    const activeExisting = Array.from(existingIds)
      .map(id => this.claims.get(id)!)
      .filter(c => c.status === 'active')

    let registered: Claim
    if (activeExisting.length > 0) {
      // Contested! Flip both new and existing to 'contested'.
      registered = { ...claim, status: 'contested' }
      for (const e of activeExisting) {
        e.status = 'contested'
      }
    } else {
      // No active competition — promote pending → active immediately.
      registered = { ...claim, status: claim.status === 'pending' ? 'active' : claim.status }
    }

    this.claims.set(registered.id, registered)
    this.indexAdd(registered)

    return { claim: registered, contestedExisting: activeExisting }
  }

  /** Remove a claim (forfeit, abandonment, registry cleanup). */
  unregister(claimId: string): boolean {
    const c = this.claims.get(claimId)
    if (!c) return false
    this.indexRemove(c)
    this.claims.delete(claimId)
    return true
  }

  getClaim(claimId: string): Claim | undefined {
    return this.claims.get(claimId)
  }

  /** All claims (any status) on a given target. */
  findOnTarget(targetType: ClaimTargetType, targetId: string): Claim[] {
    const ids = this.byTarget.get(targetKey(targetType, targetId)) ?? new Set()
    return Array.from(ids).map(id => this.claims.get(id)!).filter(Boolean)
  }

  /** All claims held by a claimant. */
  findByClaimant(claimantId: string): Claim[] {
    const ids = this.byClaimant.get(claimantId) ?? new Set()
    return Array.from(ids).map(id => this.claims.get(id)!).filter(Boolean)
  }

  /** All claims attached to a .tp node (any target type). */
  findAtNode(nodeId: string): Claim[] {
    const ids = this.byNode.get(nodeId) ?? new Set()
    return Array.from(ids).map(id => this.claims.get(id)!).filter(Boolean)
  }

  /**
   * Active claims held by `claimantId` located at `nodeId`. Intersects the
   * `byClaimant` and `byNode` indexes, filtered to status === 'active'.
   * Useful for "what does this character own here right now."
   */
  findActiveByClaimantAtNode(claimantId: string, nodeId: string): Claim[] {
    const claimantIds = this.byClaimant.get(claimantId)
    const nodeIds = this.byNode.get(nodeId)
    if (!claimantIds || !nodeIds) return []
    const out: Claim[] = []
    for (const id of claimantIds) {
      if (!nodeIds.has(id)) continue
      const c = this.claims.get(id)
      if (c && c.status === 'active') out.push(c)
    }
    return out
  }

  /**
   * Active claims held by `claimantId` at `nodeId` whose target type is
   * eligible for hosting a study (see `STUDY_ELIGIBLE_TARGET_TYPES`).
   * The Studies surface uses this to gate the start-study form — the player
   * must own a building / workshop / deposit / farm_plot / node here to
   * begin a new study (rest-inn-area eligibility is a separate path).
   */
  findStudyEligible(claimantId: string, nodeId: string): Claim[] {
    return this.findActiveByClaimantAtNode(claimantId, nodeId)
      .filter(c => STUDY_ELIGIBLE_TARGET_TYPES.includes(c.targetType))
  }

  /**
   * Returns the current active claimant of a target, or undefined if
   * no claim is active. Contested + lapsed targets return undefined
   * (nobody owns them right now).
   */
  getActiveOwner(targetType: ClaimTargetType, targetId: string): string | undefined {
    const claims = this.findOnTarget(targetType, targetId)
    const active = claims.find(c => c.status === 'active')
    return active?.claimantId
  }

  /** Update lastTendedDay — call when claimant works the plot. */
  tend(claimId: string, worldDay: number): boolean {
    const c = this.claims.get(claimId)
    if (!c) return false
    c.lastTendedDay = worldDay
    // Tending also rescues a lapsed claim back to active.
    if (c.status === 'lapsed') c.status = 'active'
    return true
  }

  /**
   * Mark a claim as forfeited. Used when the claimant loses a contest,
   * fails to defend in court/combat, or formally abandons.
   */
  forfeit(claimId: string): boolean {
    const c = this.claims.get(claimId)
    if (!c) return false
    c.status = 'forfeit'
    return true
  }

  /**
   * Sweep all claims at the given worldDay. Any with `lapseAfterDays`
   * exceeded since `lastTendedDay` (or `claimedDay` if never tended)
   * flip to 'lapsed'. Returns the list of newly-lapsed claim ids.
   */
  sweepLapses(worldDay: number): string[] {
    const lapsed: string[] = []
    for (const c of this.claims.values()) {
      if (c.status !== 'active') continue
      if (c.lapseAfterDays === undefined) continue
      const last = c.lastTendedDay ?? c.claimedDay
      if (worldDay - last > c.lapseAfterDays) {
        c.status = 'lapsed'
        lapsed.push(c.id)
      }
    }
    return lapsed
  }

  /**
   * Resolve a contest in favor of `winnerClaimId`. The winner becomes
   * 'active'; all other contested claims on the same target become
   * 'forfeit'. Returns the list of forfeited claim ids.
   */
  resolveContest(winnerClaimId: string): string[] {
    const winner = this.claims.get(winnerClaimId)
    if (!winner) return []
    const losers: string[] = []
    const competing = this.findOnTarget(winner.targetType, winner.targetId)
    for (const c of competing) {
      if (c.id === winnerClaimId) {
        c.status = 'active'
      } else if (c.status === 'contested') {
        c.status = 'forfeit'
        losers.push(c.id)
      }
    }
    return losers
  }

  /** Total count (of all statuses). */
  size(): number {
    return this.claims.size
  }

  /** Snapshot for serialization. */
  serialize(): Claim[] {
    return Array.from(this.claims.values()).map(c => ({ ...c }))
  }

  static fromSerialized(data: Claim[]): ClaimRegistry {
    const reg = new ClaimRegistry()
    for (const c of data) {
      reg.claims.set(c.id, { ...c })
      reg.indexAdd(c)
    }
    return reg
  }

  // ── Internal index management ──

  private indexAdd(c: Claim): void {
    const tk = targetKey(c.targetType, c.targetId)
    let setT = this.byTarget.get(tk)
    if (!setT) { setT = new Set(); this.byTarget.set(tk, setT) }
    setT.add(c.id)

    let setC = this.byClaimant.get(c.claimantId)
    if (!setC) { setC = new Set(); this.byClaimant.set(c.claimantId, setC) }
    setC.add(c.id)

    let setN = this.byNode.get(c.nodeId)
    if (!setN) { setN = new Set(); this.byNode.set(c.nodeId, setN) }
    setN.add(c.id)
  }

  private indexRemove(c: Claim): void {
    const tk = targetKey(c.targetType, c.targetId)
    const setT = this.byTarget.get(tk)
    if (setT) {
      setT.delete(c.id)
      if (setT.size === 0) this.byTarget.delete(tk)
    }
    const setC = this.byClaimant.get(c.claimantId)
    if (setC) {
      setC.delete(c.id)
      if (setC.size === 0) this.byClaimant.delete(c.claimantId)
    }
    const setN = this.byNode.get(c.nodeId)
    if (setN) {
      setN.delete(c.id)
      if (setN.size === 0) this.byNode.delete(c.nodeId)
    }
  }
}

// ============================================================
// FACTORY HELPERS
// ============================================================

let _claimSeq = 0
export function resetClaimIdCounter(): void { _claimSeq = 0 }

/**
 * Create a Claim with sensible defaults — caller specifies the essentials.
 */
export function createClaim(opts: {
  claimantId: string
  targetType: ClaimTargetType
  targetId: string
  nodeId: string
  claimedDay: number
  yieldShare?: number
  taxRate?: number
  lapseAfterDays?: number
  legitimacy?: string
  note?: string
}): Claim {
  return ClaimSchema.parse({
    id: `claim_${++_claimSeq}`,
    claimantId: opts.claimantId,
    targetType: opts.targetType,
    targetId: opts.targetId,
    nodeId: opts.nodeId,
    claimedDay: opts.claimedDay,
    status: 'pending',  // registry will promote to active or contested
    yieldShare: opts.yieldShare ?? 1,
    taxRate: opts.taxRate ?? 0,
    lapseAfterDays: opts.lapseAfterDays,
    legitimacy: opts.legitimacy ?? 'self',
    note: opts.note,
  })
}
