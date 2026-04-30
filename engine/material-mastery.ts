/**
 * MATERIAL MASTERY — Per-character resource knowledge
 * ======================================================
 *
 * Each character carries a personal map: `resourceId → MaterialKnowledge`.
 * Knowledge level governs what they can SEE about an item or deposit:
 *
 *   0 — UNKNOWN     "Unknown Substance" — no name, no props
 *   1 — NAMED       Resource name only — "Iron Ore"
 *   2 — BASE_PROPS  Density / hardness / etc visible
 *   3 — AFFIX       Hidden affixes recognized (per discoveryThreshold)
 *
 * Why per-character? Because a master blacksmith and a peasant farmer
 * standing at the same iron vein see different things. The world κ for
 * the deposit is identical; the *perceived* κ is character-local.
 *
 * Mastery increments via:
 *   - studyMaterial()   — explicit study action (1 level / day)
 *   - useMaterial()     — using it in extract/craft (slow drift)
 *   - imprint()         — set by Level Up, mentor, masterwork ascension
 *
 * The store is in-memory; `src/db/schema.character_material_mastery`
 * mirrors the shape for future persistence. Wave-N will add load/save.
 */

import { z } from 'zod'

// ============================================================
// SCHEMA
// ============================================================

export const KnowledgeLevelSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
])
export type KnowledgeLevel = z.infer<typeof KnowledgeLevelSchema>

export const MaterialKnowledgeSchema = z.object({
  /** The resource this entry is about — commodity id or item base id */
  resourceId: z.string(),
  knowledgeLevel: KnowledgeLevelSchema.default(0),
  /** Affix ids this character recognizes on items made from this resource */
  discoveredAffixes: z.array(z.string()).default([]),
  /** World day of last study/observation, for decay or refresh later */
  lastStudiedDay: z.number().int().nonnegative().optional(),
})
export type MaterialKnowledge = z.infer<typeof MaterialKnowledgeSchema>

export const EMPTY_KNOWLEDGE: MaterialKnowledge = {
  resourceId: '',
  knowledgeLevel: 0,
  discoveredAffixes: [],
}

export const MAX_KNOWLEDGE_LEVEL = 3

// ============================================================
// STORE — in-memory, keyed by (characterId, resourceId)
// ============================================================

export class MaterialMasteryStore {
  // characterId → resourceId → MaterialKnowledge
  private map = new Map<string, Map<string, MaterialKnowledge>>()

  /**
   * Read mastery for a (character, resource) pair.
   * Returns a fresh EMPTY_KNOWLEDGE entry if none exists.
   */
  get(characterId: string, resourceId: string): MaterialKnowledge {
    const entry = this.map.get(characterId)?.get(resourceId)
    if (entry) return { ...entry }
    return { ...EMPTY_KNOWLEDGE, resourceId }
  }

  /**
   * Get every mastery entry for a character (for UI listing).
   */
  listForCharacter(characterId: string): MaterialKnowledge[] {
    const inner = this.map.get(characterId)
    if (!inner) return []
    return Array.from(inner.values()).map(v => ({ ...v }))
  }

  /**
   * Increment mastery by one level (capped at 3). Returns the new level.
   * If the character has never studied this resource, it goes 0→1.
   */
  study(
    characterId: string,
    resourceId: string,
    worldDay: number,
  ): KnowledgeLevel {
    const current = this.get(characterId, resourceId)
    const next = Math.min(MAX_KNOWLEDGE_LEVEL, current.knowledgeLevel + 1) as KnowledgeLevel
    this.put(characterId, {
      ...current,
      knowledgeLevel: next,
      lastStudiedDay: worldDay,
    })
    return next
  }

  /**
   * Mark an affix as discovered for this (character, resource).
   * Idempotent — re-discovering doesn't duplicate.
   */
  discoverAffix(
    characterId: string,
    resourceId: string,
    affixId: string,
  ): void {
    const current = this.get(characterId, resourceId)
    if (current.discoveredAffixes.includes(affixId)) return
    this.put(characterId, {
      ...current,
      discoveredAffixes: [...current.discoveredAffixes, affixId],
    })
  }

  /**
   * Bulk-set knowledge level (e.g. on level-up, mentor imprint).
   * Does not modify discoveredAffixes.
   */
  imprint(
    characterId: string,
    resourceId: string,
    level: KnowledgeLevel,
    worldDay?: number,
  ): void {
    const current = this.get(characterId, resourceId)
    this.put(characterId, {
      ...current,
      knowledgeLevel: level,
      lastStudiedDay: worldDay ?? current.lastStudiedDay,
    })
  }

  /**
   * Wipe all mastery for a character (for testing / character deletion).
   */
  clearCharacter(characterId: string): void {
    this.map.delete(characterId)
  }

  /** For serialization / debugging. */
  serialize(): Array<{ characterId: string; entries: MaterialKnowledge[] }> {
    return Array.from(this.map.entries()).map(([characterId, inner]) => ({
      characterId,
      entries: Array.from(inner.values()).map(v => ({ ...v })),
    }))
  }

  /** Hydrate from serialized form. */
  static fromSerialized(
    data: Array<{ characterId: string; entries: MaterialKnowledge[] }>,
  ): MaterialMasteryStore {
    const store = new MaterialMasteryStore()
    for (const { characterId, entries } of data) {
      for (const entry of entries) {
        store.put(characterId, entry)
      }
    }
    return store
  }

  // ── Internal ──

  private put(characterId: string, knowledge: MaterialKnowledge): void {
    let inner = this.map.get(characterId)
    if (!inner) {
      inner = new Map()
      this.map.set(characterId, inner)
    }
    inner.set(knowledge.resourceId, { ...knowledge })
  }
}

// ============================================================
// VIEW HELPERS — what the player sees, given their mastery
// ============================================================

/**
 * Apply mastery level to a resource label. Used when rendering a deposit
 * or item the character has discovered but not fully understood.
 */
export function maskedResourceName(
  resourceId: string,
  trueName: string,
  level: KnowledgeLevel,
): string {
  if (level <= 0) return 'Unknown Substance'
  return trueName
}

/**
 * What can the character actually see on a deposit at this knowledge level?
 * Returns a typed visibility report — surfaces use this to render.
 */
export interface DepositVisibility {
  /** Full deposit name visible? (else "Unknown") */
  nameVisible: boolean
  /** Resource type visible? (else hidden) */
  resourceVisible: boolean
  /** Quality (depleted→legendary) visible? */
  qualityVisible: boolean
  /** Tier (F→EX) visible? */
  tierVisible: boolean
  /** Reserves count visible? */
  reservesVisible: boolean
  /** Secondary commodities visible? */
  secondariesVisible: boolean
}

export function depositVisibilityFor(level: KnowledgeLevel): DepositVisibility {
  return {
    nameVisible:        level >= 1,
    resourceVisible:    level >= 1,
    qualityVisible:     level >= 2,
    tierVisible:        level >= 2,
    reservesVisible:    level >= 2,
    secondariesVisible: level >= 3,
  }
}
