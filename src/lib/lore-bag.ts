// (no 'use client' — pure data utility, callable from both server routes
//  and client surfaces. Module-scoped Map is per-process; a future
//  `lore_bag_entries` DB table + cron populator will mirror it for
//  cross-request persistence.)
/**
 * lore-bag.ts — shared keyword/description store for Phase-Δ resource systems.
 *
 * The lore bag is the single source-of-truth for "what's known about X" across
 * fauna-flora, fauna-predation, aquatic-wildlife, mining-layers, tool-production,
 * and tech-web. Each proposal appends entries here rather than maintaining its
 * own keyword list.
 *
 * **Why one bag:**
 *   - Vectorizable surface for ML/NPC AI (one place to embed)
 *   - DM/GM-AI orchestrator can query "what plants grow here?" or "what tools
 *     for this material?" against a unified store
 *   - Avoids the trap the fork flagged: 5 proposals each defining redundant
 *     keyword lists.
 *
 * **Storage shape:**
 *   For v1 the bag is in-memory + IDB-cacheable. A future `lore_bag_entries`
 *   DB table + `/api/cron/populate-lore` ML pipeline will mirror it server-side
 *   when vectorization is ready (per fauna-flora-mapping.md).
 *
 * ============================================================================
 * Phase Δ conventions (read by Grok before touching engine MMs)
 * ============================================================================
 *
 * **(1) κ residency convention.** Settlement residents (NPCs, craftsmen,
 * follower targets) attach state under a single residents map:
 *
 *     κ.settlement.residents[id] = {
 *       knownRecipes?: ToolArchetypeId[],   // tech-web · craftsman hints
 *       followerOf?:   characterCertId,     // fauna-predation · domesticated
 *       agendaJson?:   any,                 // npc-agenda
 *       ...                                 // other per-resident state
 *     }
 *
 * Don't fork separate top-level κ paths per concern. Fauna-predation's tamed
 * companions live alongside tech-web's craftsman hints and any future per-
 * resident state.
 *
 * **(2) mm-ecology orchestrator split.** Don't pile fauna/flora/aquatic into
 * one mm-ecology.ts. Pattern:
 *
 *     mm-ecology         (orchestrator, registers sub-MMs at L4)
 *       ├── mm-ecology-flora    (terrestrial plants, fungi, moss · daily)
 *       ├── mm-ecology-fauna    (terrestrial animals · daily)
 *       └── mm-ecology-aquatic  (water-column life · daily, depth-aware)
 *
 * Each sub-MM has its own accumulate/resolve. The orchestrator merges deltas
 * into κ.ecology[regionId]. Fauna-predation extends mm-ecology-fauna, not the
 * orchestrator.
 *
 * **(3) WorldTPBAction batching.** Each Phase-Δ proposal adds 2-4 new variants.
 * Always batch the addition with `targetIdForAction` exhaustiveness updates in
 * BOTH `src/lib/world-tpb.ts` AND `src/app/api/cron/drain-slots/route.ts`. Never
 * land a variant without those.
 *
 * **(4) Lore-bag append pattern.** When a Phase-Δ MM fires (mfEcologicalStudy,
 * mfHunt, mfCraft, mfStudyTech…), the resolve step appends to the lore bag
 * via `appendLoreEntry()`. The MF receipt records what was added (for replay).
 * Bag entries are deltas; the in-memory view is a fold.
 * ============================================================================
 */

export type LoreSource =
  | 'ecology-study'      // fauna-flora · mfEcologicalStudy
  | 'hunt'               // fauna-predation · mfHunt
  | 'tame'               // fauna-predation · mfAnimalHandling
  | 'fish'               // aquatic · mfFish
  | 'dive'               // aquatic · mfDive
  | 'mine-reveal'        // mining · digLayer revealing strata
  | 'craft-discover'     // tool-production · mfCraft → discoverRecipe
  | 'tech-study'         // tech-web · mfStudyTech
  | 'narrative'          // DM-injected lore
  | 'observed'           // passive observation (not receipted)
  | 'seed'               // canonical bootstrap

export interface LoreEntry {
  /** Stable id — `lore-{source}-{slug}-{worldDay}` */
  id: string
  /** Human-readable name (display + keyword anchor). */
  name: string
  /** One-paragraph description; what's known. */
  description: string
  /** Tag bag — biome / domain / material / discipline keywords. */
  tags: string[]
  /** What writes added this entry. */
  source: LoreSource
  /** Optional: world day this was learned. */
  worldDay?: number
  /** Optional: cert id of the discoverer (if player-driven). */
  discoveredBy?: string
  /** Optional: TP node id this is anchored to (region/settlement/edge). */
  anchorNodeId?: string
  /** Optional: ML-friendly embedding once /api/cron/populate-lore lands. */
  embedding?: Float32Array
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store (v1)
// Future: mirror to `lore_bag_entries` table + IDB cache.
// ─────────────────────────────────────────────────────────────────────────────

const STORE = new Map<string, LoreEntry>()

/**
 * Append a single entry. Idempotent on id collision (newer overwrites — caller
 * controls id stability via the source/slug/day pattern).
 */
export function appendLoreEntry(entry: LoreEntry): void {
  STORE.set(entry.id, entry)
}

/** Bulk append — used by the future cron populator. */
export function appendLoreEntries(entries: LoreEntry[]): void {
  for (const e of entries) STORE.set(e.id, e)
}

/** Read all entries (defensive copy). */
export function listLoreEntries(): LoreEntry[] {
  return Array.from(STORE.values())
}

/** Read by exact id. */
export function getLoreEntry(id: string): LoreEntry | undefined {
  return STORE.get(id)
}

/**
 * Naive keyword search. Pre-vectorization — case-insensitive substring across
 * name + description + tags. Replaced by cosine-similarity once embeddings
 * land.
 */
export function searchLoreEntries(
  query: string,
  opts: { source?: LoreSource; anchorNodeId?: string; limit?: number } = {},
): LoreEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: LoreEntry[] = []
  for (const e of STORE.values()) {
    if (opts.source && e.source !== opts.source) continue
    if (opts.anchorNodeId && e.anchorNodeId !== opts.anchorNodeId) continue
    const hay = `${e.name} ${e.description} ${e.tags.join(' ')}`.toLowerCase()
    if (hay.includes(q)) out.push(e)
    if (opts.limit && out.length >= opts.limit) break
  }
  return out
}

/** Read entries scoped to a TP node (region/settlement/edge). */
export function loreEntriesAtNode(nodeId: string): LoreEntry[] {
  const out: LoreEntry[] = []
  for (const e of STORE.values()) {
    if (e.anchorNodeId === nodeId) out.push(e)
  }
  return out
}

/** Clear the bag — test harness only. */
export function clearLoreBag(): void {
  STORE.clear()
}

/** Serialize to JSON for IDB cache or `lore_bag_entries` mirror. */
export function serializeLoreBag(): string {
  return JSON.stringify(
    Array.from(STORE.values()).map((e) => ({
      ...e,
      embedding: undefined, // strip Float32Array; vectorizer rebuilds
    })),
  )
}

/** Hydrate from JSON (server snapshot or IDB cache). */
export function hydrateLoreBag(json: string): void {
  try {
    const parsed = JSON.parse(json) as LoreEntry[]
    STORE.clear()
    for (const e of parsed) STORE.set(e.id, e)
  } catch {
    // best-effort hydrate; corrupt cache → empty bag
  }
}

/** Stats — surfaces can show "N entries · M sources". */
export function loreBagStats(): { total: number; bySource: Record<LoreSource, number> } {
  const bySource = {} as Record<LoreSource, number>
  for (const e of STORE.values()) {
    bySource[e.source] = (bySource[e.source] ?? 0) + 1
  }
  return { total: STORE.size, bySource }
}
