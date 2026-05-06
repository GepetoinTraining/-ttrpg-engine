/**
 * DOCUMENT — Written artifacts that carry information
 * =====================================================
 *
 * === REALMS-OF-SHOD ALIGNMENT: map / letter / document ===
 * See: docs/realms-of-shod-mapping.md
 * Downgrade: src/lib/realms-of-shod-export.ts toRealmsMap / toRealmsLetter / toRealmsDocument
 *
 * The "stuff written down" layer was genuinely missing. Documents
 * carry forward three things the engine had no container for:
 *   - Letters: plot hooks across spatial distances
 *   - Maps: gate exploration (can't fast-travel unknown roads)
 *   - Tomes / manuscripts: carry knowledge seeds to new hubs
 *
 * The content itself (the actual text of a letter, the visual of
 * a map) lives outside the engine — in `contentRef`, which is an
 * opaque pointer to wherever the content is stored (IDB key, URL,
 * TPB action id). The engine tracks existence and metadata only.
 */

import { z } from 'zod'

// ============================================================
// DOCUMENT KIND
// ============================================================

export const DocumentKindSchema = z.enum([
  'map',         // Depicts geographic nodes / edges; gates fast-travel unlock
  'letter',      // Addressed from author to recipient; carries a message
  'manuscript',  // Academic or creative writing; may hold knowledge seeds
  'contract',    // Legal agreement copy (separate from the Contract entity itself)
  'record',      // Administrative record (census, tax roll, deed transcript)
  'tome',        // Reference book; explicitly carries KnowledgeSeed ids
])
export type DocumentKind = z.infer<typeof DocumentKindSchema>

// ============================================================
// DOCUMENT ENTITY
// ============================================================

export const DocumentSchema = z.object({
  id: z.string(),
  kind: DocumentKindSchema,

  /** Who created this document */
  authorId: z.string(),
  /** Intended recipient (for letters and contracts) */
  recipientId: z.string().optional(),

  /** Display title / subject */
  title: z.string().default('Untitled'),

  /** World day of creation */
  createdDay: z.number().int(),
  /** World day the document was delivered / received */
  deliveredDay: z.number().int().optional(),

  /**
   * Opaque content pointer — could be an IDB key, a URL, or a
   * tpb_entries action id. Engine never reads the content itself.
   */
  contentRef: z.string(),

  /**
   * For maps: the .tp node ids this document depicts.
   * Possessing a map with a node listed allows the character to
   * attempt fast-travel to that node (subject to WorldEdge.fastTravelUnlocked).
   */
  depictedNodes: z.array(z.string()).optional(),

  /**
   * For tomes and manuscripts: knowledge seed ids embedded in
   * this document. Reading the document (study intent) can inject
   * these seeds into the local KnowledgePool.
   */
  knowledgeSeedIds: z.array(z.string()).optional(),

  /** The node where this document currently resides */
  currentNodeId: z.string().optional(),

  /** Language / script — affects literacy check DC to read */
  language: z.string().default('common'),

  /** Condition: affects readability and trade value */
  condition: z.enum(['pristine', 'good', 'worn', 'damaged', 'ruined']).default('good'),
})
export type Document = z.infer<typeof DocumentSchema>

// ============================================================
// HELPERS
// ============================================================

let _docCounter = 0
export function resetDocumentIdCounter(): void { _docCounter = 0 }

export function createDocument(
  params: {
    kind: DocumentKind
    authorId: string
    contentRef: string
    createdDay: number
    title?: string
    recipientId?: string
    depictedNodes?: string[]
    knowledgeSeedIds?: string[]
    language?: string
    currentNodeId?: string
  },
): Document {
  return {
    id: `doc_${++_docCounter}`,
    kind: params.kind,
    authorId: params.authorId,
    contentRef: params.contentRef,
    createdDay: params.createdDay,
    title: params.title ?? 'Untitled',
    recipientId: params.recipientId,
    depictedNodes: params.depictedNodes,
    knowledgeSeedIds: params.knowledgeSeedIds,
    language: params.language ?? 'common',
    currentNodeId: params.currentNodeId,
    condition: 'good',
  }
}

/** True if this document can grant fast-travel access to the given node. */
export function documentGrantsAccess(doc: Document, nodeId: string): boolean {
  return doc.kind === 'map' && (doc.depictedNodes?.includes(nodeId) ?? false)
}

/** All knowledge seed ids this document can inject on study. */
export function documentKnowledgeSeeds(doc: Document): string[] {
  if (doc.kind !== 'tome' && doc.kind !== 'manuscript') return []
  return doc.knowledgeSeedIds ?? []
}
