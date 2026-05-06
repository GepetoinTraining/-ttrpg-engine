/**
 * SKELETON — stick-figure armature primitive
 * ==================================================================
 *
 * Blender-style armature for every creature primitive (humanoid, beast,
 * dragon, ooze-with-tentacles, ...). The skeleton is a tree of NODES
 * connected by EDGES:
 *
 *   - **Node** = a rigid body part (foot, lower_leg, thigh, chest, ...).
 *     Has volume, will get fleshed with skin/flesh/bone glyphs in a later
 *     pass. In rest pose, defined by `head` (proximal end, attaches to
 *     parent) and `tail` (distal end).
 *
 *   - **Edge** = a joint where two nodes connect (ankle, knee, hip, ...).
 *     Edges are *implicit* — they live at the boundary where one node's
 *     tail meets the next node's head. No separate object needed; the
 *     joint is the shared point.
 *
 * Coordinate system: 1 world unit = 1 tile = 64 voxels. A humanoid is
 * 1×2×1 tiles → skeleton fits in `x ∈ [-0.5, 0.5], y ∈ [0, 2], z ∈
 * [-0.5, 0.5]`. The pelvis sits at world origin's y-center (y=1.0); the
 * head crown reaches y=2.0; feet rest at y=0.
 *
 * The hierarchy (`parent: string | null`) is used for posing — moving the
 * pelvis carries every child along, rotating a thigh swings the lower
 * leg + foot. In rest pose, world-space head/tail are pre-computed and
 * stored directly so consumers don't need to walk the tree to render.
 */

export interface SkeletonNode {
  /** Stable id; convention `<part>_<L|R|M>` for paired/medial parts. */
  id: string
  /** Hierarchical parent for posing. `null` for the root (pelvis). */
  parent: string | null
  /** Rest-pose proximal end (where this node joins its parent). */
  head: [number, number, number]
  /** Rest-pose distal end. */
  tail: [number, number, number]
  /** Optional: rough cross-section diameter, used by future fleshing. */
  thickness?: number
  /** Optional: human-readable name for HUDs. */
  name?: string
  /**
   * Optional MF (manifold function) — the parametric voxel generator
   * for this node. Skeleton + node MFs together = the full MM. Walking
   * the skeleton with `flesh()` invokes each node's MF with its head/tail
   * from the skeleton, plus instance params from the caller, and stamps
   * the resulting patch into the creature's composed glyph matrix.
   */
  mf?: NodeMf
}

export interface Skeleton {
  /** Root node id (the pivot for full-body movement). */
  rootId: string
  nodes: SkeletonNode[]
}

// ============================================================
// MF — the parametric voxel generator a node owns
// ============================================================

/**
 * Per-instance fleshing parameters threaded into every node MF.
 * Species selects the formula set (humanoid vs beast vs drake).
 * Height + constitution scale ratios. Instance seed drives per-character
 * jitter (one goblin's foot is slightly shaped differently from another's).
 */
export interface FleshParams {
  species: string
  /** Total body height in world units (e.g. 2.0 for a 1×2×1 humanoid). */
  height: number
  /**
   * Constitution stat as a normalized scale around 1.0. 1.0 = canonical
   * Vitruvian; 1.1 = stout +10%; 0.9 = slim −10%.
   */
  constitution: number
  /** Per-instance seed; same seed → same body. */
  instanceSeed: string
}

/**
 * What an MF returns. The patch is a local matrix anchored at `localOrigin`
 * in world coords; the MM (flesh walker) converts that to global-matrix
 * coords and stamps the patch in.
 */
export interface MfPatch {
  /** The voxel patch (small; just covers the body part's bounding box). */
  matrix: import('./mold-evaluator').GlyphMatrix
  /**
   * World position of the patch's local-(0,0,0) corner. The MM uses this
   * to compute where to stamp the patch in the global creature matrix.
   */
  localOrigin: [number, number, number]
  /** Forensic receipt — the inputs that produced this patch. */
  receipt: {
    mfId: string
    nodeId: string
    inputs: Record<string, unknown>
  }
}

export type NodeMf = (node: SkeletonNode, params: FleshParams) => MfPatch

// ============================================================
// HUMANOID — 21-node skeleton in A-pose
// ============================================================
//
//   y=2.00 ──  head_top
//   y=1.78 ──  head/neck joint (atlas)
//   y=1.65 ──  neck/chest joint (cervical)
//   y=1.60 ──  shoulder horizontal ring (chest → shoulder_L/R → upper_arm_L/R)
//   y=1.45 ──  chest/spine joint (thoracic)
//   y=1.20 ──  spine/pelvis joint (lumbar)
//   y=1.00 ──  pelvis horizontal ring (pelvis → hip_L/R → thigh_L/R)
//   y=0.55 ──  knee
//   y=0.00 ──  floor (lower_leg/foot ankle, foot heel + toe both at y=0)
//
// Anatomical hip+shoulder nodes form a `node–edge–node–edge–node` chain:
//   pelvis ──sacroiliac──> hip ──acetabulum──> thigh
//   chest  ──sternoclav──> shoulder ──glenohumeral──> upper_arm

const SHOULDER_X = 0.18  // shoulder-blade tail x (where arm attaches)
const HIP_X      = 0.13  // hip tail x (where leg attaches)
const ELBOW_X    = 0.30
const WRIST_X    = 0.40
const HAND_TIP_X = 0.45

export const HUMANOID_SKELETON: Skeleton = {
  rootId: 'pelvis',
  nodes: [
    // ─── Spine + head (5 nodes) ───────────────────────────────
    { id: 'pelvis', name: 'Pelvis',  parent: null,    head: [0, 1.00, 0],  tail: [0, 1.20, 0],  thickness: 0.30 },
    { id: 'spine',  name: 'Spine',   parent: 'pelvis',head: [0, 1.20, 0],  tail: [0, 1.45, 0],  thickness: 0.26 },
    { id: 'chest',  name: 'Chest',   parent: 'spine', head: [0, 1.45, 0],  tail: [0, 1.65, 0],  thickness: 0.34 },
    { id: 'neck',   name: 'Neck',    parent: 'chest', head: [0, 1.65, 0],  tail: [0, 1.78, 0],  thickness: 0.10 },
    { id: 'head',   name: 'Head',    parent: 'neck',  head: [0, 1.78, 0],  tail: [0, 2.00, 0],  thickness: 0.22 },

    // ─── Hip ring (2 nodes — pelvis horizontals out to leg sockets) ────────
    { id: 'hip_L',  name: 'Hip L',   parent: 'pelvis', head: [0, 1.00, 0], tail: [-HIP_X, 1.00, 0], thickness: 0.18 },
    { id: 'hip_R',  name: 'Hip R',   parent: 'pelvis', head: [0, 1.00, 0], tail: [ HIP_X, 1.00, 0], thickness: 0.18 },

    // ─── Shoulder ring (2 nodes — chest horizontals out to arm sockets) ────
    { id: 'shoulder_L', name: 'Shoulder L', parent: 'chest', head: [0, 1.60, 0], tail: [-SHOULDER_X, 1.60, 0], thickness: 0.14 },
    { id: 'shoulder_R', name: 'Shoulder R', parent: 'chest', head: [0, 1.60, 0], tail: [ SHOULDER_X, 1.60, 0], thickness: 0.14 },

    // ─── Left arm (3 nodes; parented through shoulder) ─────────────────────
    { id: 'upper_arm_L', name: 'Upper arm L', parent: 'shoulder_L',  head: [-SHOULDER_X, 1.60, 0], tail: [-ELBOW_X, 1.30, 0], thickness: 0.10 },
    { id: 'forearm_L',   name: 'Forearm L',   parent: 'upper_arm_L', head: [-ELBOW_X,    1.30, 0], tail: [-WRIST_X, 1.05, 0], thickness: 0.08 },
    { id: 'hand_L',      name: 'Hand L',      parent: 'forearm_L',   head: [-WRIST_X,    1.05, 0], tail: [-HAND_TIP_X, 0.95, 0], thickness: 0.07 },

    // ─── Right arm (3 nodes; mirror) ───────────────────────────────────────
    { id: 'upper_arm_R', name: 'Upper arm R', parent: 'shoulder_R',  head: [ SHOULDER_X, 1.60, 0], tail: [ ELBOW_X, 1.30, 0], thickness: 0.10 },
    { id: 'forearm_R',   name: 'Forearm R',   parent: 'upper_arm_R', head: [ ELBOW_X,    1.30, 0], tail: [ WRIST_X, 1.05, 0], thickness: 0.08 },
    { id: 'hand_R',      name: 'Hand R',      parent: 'forearm_R',   head: [ WRIST_X,    1.05, 0], tail: [ HAND_TIP_X, 0.95, 0], thickness: 0.07 },

    // ─── Left leg (3 nodes; parented through hip; foot flat on ground) ─────
    { id: 'thigh_L',     name: 'Thigh L',     parent: 'hip_L',       head: [-HIP_X, 1.00, 0], tail: [-HIP_X, 0.55, 0], thickness: 0.14 },
    { id: 'lower_leg_L', name: 'Lower leg L', parent: 'thigh_L',     head: [-HIP_X, 0.55, 0], tail: [-HIP_X, 0.00, 0],  thickness: 0.10 },
    { id: 'foot_L',      name: 'Foot L',      parent: 'lower_leg_L', head: [-HIP_X, 0.00, 0], tail: [-HIP_X, 0.00, 0.18], thickness: 0.10 },

    // ─── Right leg (3 nodes; mirror) ───────────────────────────────────────
    { id: 'thigh_R',     name: 'Thigh R',     parent: 'hip_R',       head: [ HIP_X, 1.00, 0], tail: [ HIP_X, 0.55, 0], thickness: 0.14 },
    { id: 'lower_leg_R', name: 'Lower leg R', parent: 'thigh_R',     head: [ HIP_X, 0.55, 0], tail: [ HIP_X, 0.00, 0],  thickness: 0.10 },
    { id: 'foot_R',      name: 'Foot R',      parent: 'lower_leg_R', head: [ HIP_X, 0.00, 0], tail: [ HIP_X, 0.00, 0.18], thickness: 0.10 },
  ],
}

// ============================================================
// EDGE LIST — joints, derived from node hierarchy
// ============================================================

export interface SkeletonEdge {
  /** From node id (parent). */
  fromId: string
  /** To node id (child). */
  toId: string
  /** Joint world position — at the parent's tail = child's head. */
  position: [number, number, number]
  /** Human-readable joint name. */
  name: string
}

const EDGE_NAMES: Record<string, string> = {
  'pelvis>spine':            'lumbar',
  'spine>chest':              'thoracic',
  'chest>neck':               'cervical',
  'neck>head':                'atlas',
  // Hip ring: pelvis → hip_L/R → thigh_L/R
  'pelvis>hip_L':             'sacroiliac L',
  'pelvis>hip_R':             'sacroiliac R',
  'hip_L>thigh_L':            'hip L',
  'hip_R>thigh_R':            'hip R',
  // Shoulder ring: chest → shoulder_L/R → upper_arm_L/R
  'chest>shoulder_L':         'sternoclavicular L',
  'chest>shoulder_R':         'sternoclavicular R',
  'shoulder_L>upper_arm_L':   'shoulder L',
  'shoulder_R>upper_arm_R':   'shoulder R',
  // Arm chain
  'upper_arm_L>forearm_L':    'elbow L',
  'forearm_L>hand_L':         'wrist L',
  'upper_arm_R>forearm_R':    'elbow R',
  'forearm_R>hand_R':         'wrist R',
  // Leg chain
  'thigh_L>lower_leg_L':      'knee L',
  'lower_leg_L>foot_L':       'ankle L',
  'thigh_R>lower_leg_R':      'knee R',
  'lower_leg_R>foot_R':       'ankle R',
}

/** Derive the edge list (joints) from a skeleton's node hierarchy. */
export function getSkeletonEdges(skeleton: Skeleton): SkeletonEdge[] {
  const out: SkeletonEdge[] = []
  for (const child of skeleton.nodes) {
    if (!child.parent) continue
    const key = `${child.parent}>${child.id}`
    out.push({
      fromId: child.parent,
      toId: child.id,
      position: child.head,
      name: EDGE_NAMES[key] ?? key,
    })
  }
  return out
}

/** Lookup helper — finds a node by id. */
export function findNode(skeleton: Skeleton, id: string): SkeletonNode | undefined {
  return skeleton.nodes.find((n) => n.id === id)
}

/** Total y-extent of the skeleton (for footprint calculations). */
export function skeletonHeight(skeleton: Skeleton): number {
  let lo = Infinity
  let hi = -Infinity
  for (const n of skeleton.nodes) {
    lo = Math.min(lo, n.head[1], n.tail[1])
    hi = Math.max(hi, n.head[1], n.tail[1])
  }
  return hi - lo
}
