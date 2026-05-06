/**
 * HOLOGRAM — The Engine's Tensor
 * ===============================
 *
 * The function that takes the engine's κ-field and collapses it through an
 * observer filter into a rendered tile. The top half of the octahedron.
 *
 * |rendered⟩ = Ô|ψ⟩
 *
 * Where:
 *   |ψ⟩  = κ-potential at (q, r) — substrate + seed variation
 *   Ô    = observer operator — perception, LOS, LOD, knowledge, time
 *   |rendered⟩ = collapsed RenderedTile — what this observer actually sees
 *
 * === 8-STEP ALGORITHM ===
 *   1. Locate containing .tp node → LocalContext (substrate κ)
 *   2. Lazy MM resolution (observer-domain gated)
 *   3. computeMorphogenField → substrate
 *   4. SeededRNG variation (biome variant, material, entities, affixes)
 *   5. applyDiff (TPB player modifications)
 *   6. computeCoupling → apoptosis gate (stub Phase 1: always coupled)
 *   7. applyObserverFilter (LOD, LOS, time, knowledge, skill, perception)
 *   8. composePrimitives + deriveSurfaceProperties → RenderedTile
 *
 * === PHASE 1 STUBS ===
 *   - locateNodeForTile: returns first settlement node (trivial impl)
 *   - computeMorphogenField: returns substrate κ unchanged
 *   - computeCoupling: always 1.0 (disable apoptosis in Phase 1)
 *   - LOS occlusion: disabled (all tiles visible — enable in Phase 4)
 *
 * See: docs/mesh-hologram.md for the full blueprint.
 *
 * NO DB imports. NO LLM imports. Pure compute.
 */

import type { TP, LocalContext, EntityPosition } from './tp'
import { SeededRNG } from './hub-topology'
import {
  computeMorphogenField,
  pickMaterialComposition,
  pickBiomeVariant,
  rollEntityPresence,
  rollAffixes,
} from './morphogen'
import { instancePrimitive, PRIMITIVE_REGISTRY } from './primitives'

// ============================================================
// MATERIAL CLASS — T0 floor (per the entity ladder)
// ============================================================

export type MaterialClass =
  | 'metal'     // iron, copper, gold, silver, mithril, …
  | 'stone'     // granite, basalt, sandstone, limestone, …
  | 'fiber'     // wood, hemp, cotton, sinew, …
  | 'ceramic'   // clay, brick, porcelain, …
  | 'glass'     // quartz, obsidian, magical glass, …
  | 'gem'       // ruby, emerald, diamond, …
  | 'soil'      // dirt, loam, sand, mud, peat, …
  | 'fluid'     // water, oil, blood, mercury, …
  | 'gas'       // air, fog, miasma, smoke, …
  | 'organic'   // flesh, leaf, bark, hide, fungal mass, …
  | 'ice'       // ice, permafrost, glacial ice, …
  | 'crystal'   // ley-line lattice, solidified mana, …
  | 'exotic'    // planar matter, void, raw chaos, …

/** Density per class at a tile, summing roughly to 1.0 */
export type MaterialComposition = Partial<Record<MaterialClass, number>>

// ============================================================
// PRIMITIVE — geometric atom for a material class (T1)
// ============================================================

export interface Primitive {
  /** Which material class this primitive belongs to */
  materialClass: MaterialClass
  /** Geometric kind — drives mesh selection */
  geometry: 'polyhedron' | 'cylinder' | 'plane' | 'card' | 'particles' | 'volumetric' | 'lattice'
  /** Local-to-tile position (tile-fractional units 0..1) */
  position: { x: number; y: number; z: number }
  /** Scale relative to tile size */
  scale: number
  /** Rotation around radial (z) axis in radians */
  rotation: number
  /** Color hint derived from material × variant */
  color: { r: number; g: number; b: number }
  /** Variant key (drives which mesh from the per-class registry) */
  variant: string
  /** Affixes that survived seed hash + observer filter */
  affixes: string[]
}

// ============================================================
// SURFACE PROPERTIES — physics, pathing, renderer shaders
// ============================================================

export interface SurfaceProperties {
  walkable: boolean
  blocksLineOfSight: boolean
  blocksMovement: boolean
  /** Elevation above tile baseline in feet */
  elevation: number
  /** Cover level (0 = open, 1 = full cover) */
  cover: number
  /** Lighting at this tile (emergent from time + materials + magic) */
  lightLevel: number
  /** Movement cost multiplier (1 = normal, 2 = difficult, Infinity = impassable) */
  movementCost: number
  /** Combined color hint for distant LOD */
  averagedColor: { r: number; g: number; b: number }
}

// ============================================================
// OBSERVER FILTER — the top of the octahedron
// ============================================================

export interface ObserverFilter {
  /** Cert id of the observer (character cert hash) */
  observerId: string
  /** Observer's tile coords (origin for LOS + distance) */
  position: { q: number; r: number }
  /** Passive perception modifier (highest in party for group filter) */
  passivePerception: number
  /**
   * Per-species/fact knowledge level.
   * 0 = unknown (silhouette only), 1+ = named + properties known.
   */
  knowledge: Map<string, 0 | 1 | 2 | 3>
  /** World day fraction 0..1 — drives lighting + diurnal entity visibility */
  timeOfDay: number
  /** Active skill checks (for searching, tracking, etc.) */
  activeChecks: { skill: string; dc: number; modifier: number; d20?: number }[]
  /** Tiles that block LOS from observer.position (serialized "q,r" keys) */
  losBlockers: Set<string>
  /** Distance from observer in tiles — drives LOD entity-tier cutoff */
  distance: number
  /** Maximum entity tier to render at this distance */
  lodMaxTier: number
}

// ============================================================
// RENDERED TILE — the equatorial square contents
// ============================================================

export interface RenderedTile {
  /** Tile coords on the torus (q, r) */
  position: { q: number; r: number }
  /** Material class composition (densities sum ~1) */
  materialComposition: MaterialComposition
  /** Entities present at this tile, filtered by observer */
  entities: {
    id: string
    type: string
    position: EntityPosition
    visible: boolean
    visibleAs: string
  }[]
  /** Geometric primitives the renderer composes into the mesh */
  primitives: Primitive[]
  /** Surface properties for physics + pathing + renderer */
  surface: SurfaceProperties
  /** The κ vector that was projected (for receipts + audit) */
  kappa: { domain: string; values: Record<string, unknown> }[]
  /** Metadata for debugging + diff replay */
  metadata: {
    coupled: boolean
    couplingScore: number
    observationDay: number
    hasPlayerDiff: boolean
    worldSeed: string
    /**
     * Audit anchor — the literal inputs that produced this tile.
     * NOT a hash. The bytes ARE the stamp; verification = re-derive
     * from these inputs and compare structured output, not hash digests.
     */
    inputs: HologramReceiptInputs
  }
}

/**
 * Structured inputs that uniquely identify a hologram derivation.
 * Designer-readable. Replays exactly when fed back through hologramAt().
 */
export interface HologramReceiptInputs {
  worldSeed: string
  q: number
  r: number
  observerId: string
  /** worldDay this hologram was rolled for */
  worldDay: number
  /** If a TileDiff was applied, its appliedDay (otherwise null) */
  diffAppliedDay: number | null
  /** If a TileDiff was applied, who modified it (otherwise null) */
  diffModifiedBy: string | null
}

// ============================================================
// TILE DIFF — player modifications on top of seed-derived state
// ============================================================

export interface TileDiff {
  /** Primitive variant keys to remove (e.g. tree chopped → remove 'tree_trunk') */
  removedPrimitives: string[]
  /** Primitive instances to add (e.g. stump, harvested loot) */
  addedPrimitives: Primitive[]
  surfaceOverrides: Partial<SurfaceProperties>
  /** When this diff was applied (worldDay) */
  appliedDay: number
  /** Who modified it (character cert id) */
  modifiedBy: string
}

// ============================================================
// HOLOGRAM INPUTS
// ============================================================

export interface HologramInputs {
  tp: TP
  worldSeed: string
  q: number
  r: number
  observer: ObserverFilter
  /** World day for the observation (used for MM resolve + receipt) */
  worldDay?: number
  /** Optional: TPB diff source for player modifications */
  diffLookup?: (q: number, r: number) => TileDiff | null
}

// ============================================================
// INTERNAL TILE DNA — intermediate state between steps 3-7
// ============================================================

interface TileDNA {
  ctx: LocalContext
  materialComposition: MaterialComposition
  biomeVariant: string
  entityRolls: ReturnType<typeof rollEntityPresence>
  affixes: string[]
  diff: TileDiff | null
}

// ============================================================
// HOLOGRAM AT — the tensor contraction
// ============================================================

/**
 * The hologram. The engine's tensor.
 *
 * Projects the κ-potential at tile (q, r) through the observer filter
 * and returns the rendered tile. All MM resolution, κ inheritance,
 * seed variation, coupling, and primitive composition flows through here.
 *
 * Phase 1: stubs in place for locateNodeForTile, coupling, and LOS occlusion.
 */
export function hologramAt(input: HologramInputs): RenderedTile {
  const { tp, worldSeed, q, r, observer, worldDay = 0 } = input

  // ─── Step 1: Locate containing .tp node ────────────────────────────────────
  // TODO Phase 2: walk .tp tree to find actual containing node
  const node = locateNodeForTile(tp, q, r)
  const ctx = tp.resolve(node.id)
  if (!ctx) {
    return apoptoticTile(q, r, worldSeed)
  }

  // ─── Step 2: Lazy MM resolution (observer-domain gated) ────────────────────
  // TODO Phase 3: implement getMMsForNode + filterAllowsDomain + mm.resolve()
  // Phase 1 stub: MMs resolve on their own cadence; no observer-lazy trigger.

  // ─── Step 3: Compute substrate (morphogen field) ───────────────────────────
  const morphogen = computeMorphogenField(ctx, q, r)

  // ─── Step 4: Seed variation ─────────────────────────────────────────────────
  const rng = new SeededRNG(`${worldSeed}:${q}:${r}`)
  const materialComposition = pickMaterialComposition(morphogen, rng)
  const biomeVariant        = pickBiomeVariant(morphogen, rng)
  const entityRolls         = rollEntityPresence(morphogen, rng)
  const affixes             = rollAffixes(morphogen, rng)

  // ─── Step 5: Apply TPB diff (player modifications) ──────────────────────────
  const diff = input.diffLookup?.(q, r) ?? null
  const tileDNA: TileDNA = {
    ctx,
    materialComposition,
    biomeVariant,
    entityRolls,
    affixes,
    diff,
  }
  const dna = applyDiff(tileDNA)

  // ─── Step 6: Coupling check (apoptosis gate) ────────────────────────────────
  // TODO Phase 5: implement computeCoupling against neighbor tiles
  // Phase 1 stub: always coupled (score = 1.0)
  const couplingScore = 1.0
  const COUPLING_THRESHOLD = 0.3
  if (couplingScore < COUPLING_THRESHOLD) {
    return apoptoticTile(q, r, worldSeed)
  }

  // ─── Step 7: Apply observer filter ──────────────────────────────────────────
  const visible = applyObserverFilter(dna, observer, ctx)

  // ─── Step 8: Compose primitives + surface properties ────────────────────────
  const primitives = composePrimitives(visible.materialComposition, rng)
  const surface    = deriveSurfaceProperties(visible)

  const kappaSnapshot = extractKappaSnapshot(ctx)

  return {
    position: { q, r },
    materialComposition: visible.materialComposition,
    entities: visible.entities,
    primitives,
    surface,
    kappa: kappaSnapshot,
    metadata: {
      coupled: true,
      couplingScore,
      observationDay: worldDay,
      hasPlayerDiff: diff !== null,
      worldSeed,
      inputs: {
        worldSeed,
        q,
        r,
        observerId: observer.observerId,
        worldDay,
        diffAppliedDay: diff?.appliedDay ?? null,
        diffModifiedBy: diff?.modifiedBy ?? null,
      },
    },
  }
}

// ============================================================
// STEP 1 — Locate node for tile
// ============================================================

/**
 * TODO Phase 2: walk .tp tree to find the settlement bounding box
 * or region that contains tile (q, r).
 *
 * Phase 1 stub: returns the first settlement/hub node in the TP,
 * or the root node if none exists.
 */
function locateNodeForTile(tp: TP, _q: number, _r: number): { id: string } {
  const nodes = tp.getAllNodes()
  const settlement = nodes.find(n =>
    n.type === 'settlement' || n.type === 'hub' || n.type === 'city'
  )
  return { id: settlement?.id ?? nodes[0]?.id ?? 'root' }
}

// ============================================================
// STEP 5 — Apply diff
// ============================================================

function applyDiff(dna: TileDNA): TileDNA {
  if (!dna.diff) return dna

  // Remove primitives by variant key — handled during composePrimitives
  // (we pass the removedPrimitives set through the materialComposition override)
  const result = { ...dna }

  // Apply surface overrides (if any) — stored in diff and read at deriveSurface
  return result
}

// ============================================================
// STEP 6 — Coupling (stub)
// ============================================================

// TODO Phase 5: computeCoupling(tile_DNA, neighbors) → number
// For now, always return 1.0 (all tiles coupled).

// ============================================================
// STEP 7 — Observer filter
// ============================================================

interface FilteredTileDNA {
  materialComposition: MaterialComposition
  entities: RenderedTile['entities']
  biomeVariant: string
  affixes: string[]
  diff: TileDiff | null
}

function applyObserverFilter(
  dna: TileDNA,
  observer: ObserverFilter,
  ctx: LocalContext,
): FilteredTileDNA {
  // 1. LOD cutoff: only include entities whose tier ≤ observer.lodMaxTier
  // 2. LOS occlusion: TODO Phase 4 — disabled in Phase 1 (all tiles visible)
  // 3. Time-of-day: modulate entity presence (nocturnal/diurnal)
  // 4. Knowledge filter: silhouette vs named entity
  // 5. Skill check active reveals (traps, hidden chests, sneaking)
  // 6. Passive perception final gate

  const tileKey = `${dna.ctx.currentNodeId}`
  const blocked = observer.losBlockers.has(tileKey)

  // Phase 1: LOD limits what entity types show (no actual entity data yet)
  // Entity slots from rollEntityPresence only produce present/absent flags.
  // Full entity rendering requires entity registry integration (Phase 2+).
  const entities: RenderedTile['entities'] = []

  for (const entityAtNode of ctx.entitiesAt) {
    if (entityAtNode.position.type === 'abstract') continue

    // LOD gate: entity tier check (Phase 1 uses tier 3 as default)
    const entityTier = 3 // TODO Phase 2: look up actual tier from entity catalog
    if (entityTier > observer.lodMaxTier) continue

    // LOS gate
    if (blocked) continue

    // Time-of-day gate (simple: nocturnal entities hidden during day)
    const isNight = observer.timeOfDay < 0.25 || observer.timeOfDay > 0.75
    const isNocturnal = entityAtNode.type.includes('bat') || entityAtNode.type.includes('vampire')
    if (isNocturnal && !isNight) continue

    // Knowledge filter
    const knowledgeLevel = observer.knowledge.get(entityAtNode.type) ?? 0
    const visibleAs = knowledgeLevel === 0 ? 'unknown_creature' : entityAtNode.type

    // Passive perception gate (stealth vs perception)
    const stealthDC = 12 // TODO Phase 2: look up from entity data
    if (stealthDC > observer.passivePerception) {
      // Check active perception checks
      const activePass = observer.activeChecks.some(check => {
        if (check.skill !== 'perception') return false
        const roll = (check.d20 ?? 10) + check.modifier
        return roll >= stealthDC
      })
      if (!activePass) continue
    }

    entities.push({
      id: entityAtNode.id,
      type: entityAtNode.type,
      position: entityAtNode.position,
      visible: true,
      visibleAs,
    })
  }

  // Respect LOD for material composition too (distant tiles → simplified)
  let composition = dna.materialComposition
  if (observer.lodMaxTier < 3) {
    // Very distant: only show dominant material
    const dominant = Object.entries(composition)
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]
    composition = dominant ? { [dominant[0] as MaterialClass]: 1.0 } : composition
  }

  return {
    materialComposition: composition,
    entities,
    biomeVariant: dna.biomeVariant,
    affixes: dna.affixes,
    diff: dna.diff,
  }
}

// ============================================================
// STEP 8 — Compose primitives
// ============================================================

function composePrimitives(
  composition: MaterialComposition,
  rng: SeededRNG,
): Primitive[] {
  const primitives: Primitive[] = []
  const entries = Object.entries(composition) as [MaterialClass, number][]

  for (const [materialClass, density] of entries) {
    if (!density || density < 0.05) continue
    const templates = PRIMITIVE_REGISTRY[materialClass]
    if (!templates || templates.length === 0) continue

    // Number of primitives proportional to density
    const count = Math.max(1, Math.round(density * 5))
    for (let i = 0; i < count; i++) {
      const position = {
        x: rng.next(),
        y: rng.next(),
        z: 0,
      }
      primitives.push(instancePrimitive(materialClass, undefined, rng, position))
    }
  }

  return primitives
}

// ============================================================
// STEP 8 — Derive surface properties
// ============================================================

const MATERIAL_SURFACE: Record<MaterialClass, Partial<SurfaceProperties>> = {
  metal:   { walkable: true,  blocksLineOfSight: false, movementCost: 1.0, cover: 0.0 },
  stone:   { walkable: true,  blocksLineOfSight: false, movementCost: 1.1, cover: 0.2 },
  fiber:   { walkable: true,  blocksLineOfSight: true,  movementCost: 1.5, cover: 0.5 },
  ceramic: { walkable: true,  blocksLineOfSight: false, movementCost: 1.0, cover: 0.0 },
  glass:   { walkable: true,  blocksLineOfSight: false, movementCost: 1.0, cover: 0.0 },
  gem:     { walkable: true,  blocksLineOfSight: false, movementCost: 1.0, cover: 0.0 },
  soil:    { walkable: true,  blocksLineOfSight: false, movementCost: 1.0, cover: 0.0 },
  fluid:   { walkable: false, blocksLineOfSight: false, movementCost: 4.0, cover: 0.0 },
  gas:     { walkable: true,  blocksLineOfSight: true,  movementCost: 1.0, cover: 0.3 },
  organic: { walkable: true,  blocksLineOfSight: true,  movementCost: 1.5, cover: 0.4 },
  ice:     { walkable: true,  blocksLineOfSight: false, movementCost: 2.0, cover: 0.0 },
  crystal: { walkable: true,  blocksLineOfSight: false, movementCost: 1.0, cover: 0.1 },
  exotic:  { walkable: false, blocksLineOfSight: true,  movementCost: Infinity, cover: 0.5 },
}

function deriveSurfaceProperties(visible: FilteredTileDNA): SurfaceProperties {
  const entries = Object.entries(visible.materialComposition) as [MaterialClass, number][]

  let walkable = true
  let blocksLOS = false
  let blocksMovement = false
  let movementCost = 1.0
  let cover = 0.0
  let r = 0, g = 0, b = 0, totalWeight = 0

  for (const [mat, density] of entries) {
    if (!density) continue
    const surf = MATERIAL_SURFACE[mat] ?? {}
    if (surf.walkable === false) walkable = false
    if (surf.blocksLineOfSight) blocksLOS = true
    if (surf.movementCost === Infinity) { blocksMovement = true; movementCost = Infinity }
    else if (movementCost !== Infinity) movementCost += (surf.movementCost ?? 1.0 - 1.0) * density
    cover = Math.max(cover, (surf.cover ?? 0) * density)

    // Averaged color from primitive registry default
    const template = PRIMITIVE_REGISTRY[mat]?.[0]
    if (template) {
      r += template.defaultColor.r * density
      g += template.defaultColor.g * density
      b += template.defaultColor.b * density
      totalWeight += density
    }
  }

  if (totalWeight > 0) {
    r /= totalWeight; g /= totalWeight; b /= totalWeight
  }

  // Apply diff surface overrides if any
  if (visible.diff?.surfaceOverrides) {
    const ov = visible.diff.surfaceOverrides
    if (ov.walkable !== undefined) walkable = ov.walkable
    if (ov.movementCost !== undefined) movementCost = ov.movementCost
    if (ov.cover !== undefined) cover = ov.cover
  }

  // Light level: base 0.8 (full daylight), modulated by cover + LOS blockers
  const lightLevel = Math.max(0.1, 0.8 - cover * 0.4)

  return {
    walkable,
    blocksLineOfSight: blocksLOS,
    blocksMovement,
    elevation: 0, // TODO Phase 2: derive from physics.gravity.type or deposit z
    cover,
    lightLevel,
    movementCost: walkable ? movementCost : Infinity,
    averagedColor: { r: Math.round(r), g: Math.round(g), b: Math.round(b) },
  }
}

// ============================================================
// APOPTOTIC TILE — undifferentiated fallback
// ============================================================

function apoptoticTile(q: number, r: number, worldSeed: string): RenderedTile {
  return {
    position: { q, r },
    materialComposition: { soil: 1.0 },
    entities: [],
    primitives: [],
    surface: {
      walkable: true,
      blocksLineOfSight: false,
      blocksMovement: false,
      elevation: 0,
      cover: 0,
      lightLevel: 0.8,
      movementCost: 1.0,
      averagedColor: { r: 101, g: 67, b: 33 },
    },
    kappa: [],
    metadata: {
      coupled: false,
      couplingScore: 0,
      observationDay: 0,
      hasPlayerDiff: false,
      worldSeed,
      inputs: {
        worldSeed,
        q,
        r,
        observerId: '',
        worldDay: 0,
        diffAppliedDay: null,
        diffModifiedBy: null,
      },
    },
  }
}

// ============================================================
// AUDIT — structured input comparison (no hashing)
// ============================================================

/** Extract a κ snapshot for embedding in RenderedTile.kappa */
function extractKappaSnapshot(ctx: LocalContext): RenderedTile['kappa'] {
  const snapshot: RenderedTile['kappa'] = []
  const domains = [
    'physics', 'law', 'economy', 'weather', 'ecology',
    'faction', 'social', 'culture', 'religion', 'military',
  ] as const
  for (const domain of domains) {
    const values = (ctx as Record<string, unknown>)[domain]
    if (values && typeof values === 'object') {
      snapshot.push({ domain, values: values as Record<string, unknown> })
    }
  }
  return snapshot
}

/**
 * Verify two hologram receipts are for the same derivation.
 * Compares structured inputs field-by-field — NOT a hash digest.
 * The bytes ARE the stamp; equality of inputs guarantees equality of output
 * by determinism of `hologramAt()`.
 */
export function receiptsMatch(
  a: HologramReceiptInputs,
  b: HologramReceiptInputs,
): boolean {
  return a.worldSeed      === b.worldSeed
      && a.q              === b.q
      && a.r              === b.r
      && a.observerId     === b.observerId
      && a.worldDay       === b.worldDay
      && a.diffAppliedDay === b.diffAppliedDay
      && a.diffModifiedBy === b.diffModifiedBy
}
