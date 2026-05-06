# Mesh Hologram — The Observer Tensor

> *"The tile doesn't exist until you look. Looking is a tensor contraction."*

This document is the blueprint for `engine/hologram.ts` — the function that takes the engine's κ-field and produces the rendered tile when an observer looks at it. It is the **top half of the octahedron**: where `mesh-potential.ts` is the white-light source, the hologram is the filter + the equatorial square together. It is the engine's tensor.

The hologram doesn't exist in the engine yet. This doc explains how to build it once the implementor has context. It also explains why building it changes the shape of every MM/MF interaction that follows — because the hologram becomes the **single call site** through which observation, resolution, and rendering all flow.

---

## Why this matters

Today the engine works like this:

```
external code calls clockwork.observeNode(nodeId)
  └→ MMs at nodeId resolve() — pendingPotential collapses to κ via writeKappa
external code calls tp.resolve(nodeId)
  └→ inheritance walk produces LocalContext (the κ vector at that node)
external code (renderer/UI/physics) reads LocalContext and decides what to draw
```

Three separate calls. Three separate concerns. The renderer has to know it must call `observeNode` first, then `resolve`, then interpret. The MM has to know it might be observed (currently it just trusts the caller). The κ inheritance walk happens regardless of whether anyone's filter would even let those domains pass.

**Once the hologram exists, all three collapse into one:**

```
renderer (or any consumer) calls hologramAt(tp, worldSeed, q, r, observer)
  └→ resolves any pending MMs at the containing node (only those visible to observer)
  └→ walks κ inheritance
  └→ applies seed variation H(worldSeed, q, r)
  └→ runs coupling check against neighbors (apoptosis filter)
  └→ applies observer filter (perception × LOS × time × knowledge × skill)
  └→ projects to material composition + entities + primitives + surface properties
  └→ returns RenderedTile
```

One call. One tensor contraction. The κ vector contracted against the observer vector produces the visible tile. Everything else is implementation detail. This is the **engine's actual rendering primitive** — and the moment it exists, the engine's pattern of use shifts: nothing reads κ directly anymore, everything reads holograms.

---

## The projection operator

The hologram is a tensor contraction. In bra-ket notation:

```
|rendered⟩ = Ô|ψ⟩
```

Where:

- `|ψ⟩` is the **κ-potential vector** at tile (q, r) — the white light from `mesh-potential.ts`. It lives in a high-dimensional space spanning the substrate (inherited κ + morphogen field) and the seed variation (`H(worldSeed, q, r)` quantized through morphogen probabilities). All possibilities at this tile.

- `Ô` is the **observer operator** — perception modifier, line-of-sight occlusion, time-of-day lighting gate, knowledge filter (you don't see what you don't know to look for), skill check thresholds, distance-LOD cutoff. A multilinear map from possibility-space to visible-space.

- `|rendered⟩` is the **collapsed tile** — material composition, entity placements, geometric primitives, surface properties (walkable, blocksLOS, color, elevation).

Conceptually, |ψ⟩ has these axes:

| Axis | Cardinality | Source |
|---|---|---|
| `material_class` | ~13 (T0 floor) | substrate.morphogen + seed hash |
| `entity_slot` | ~10 (visible entities per tile cap) | T3–T5 entities at this tile |
| `primitive_type` | ~50 (per material class × variants) | T1 primitive registry |
| `kappa_domain` | 16 (10 inheritable + 6 leaf) | tp.resolve at containing node |
| `time_phase` | continuous (0..1) | worldDay mod season + diurnal |

Ô has these axes:

| Axis | Mapping |
|---|---|
| `perception` | scalar, gates which entities pass |
| `LOS` | binary per (origin tile, target tile) |
| `time_of_day` | scalar, modulates lighting / activity |
| `knowledge` | per-species/fact bitmask, gates "do you know what this is?" |
| `skill_check` | DC threshold per skill, gates active observation |
| `distance` | LOD selector, picks entity-density tier (T0 atoms close, T15 silhouettes far) |

The contraction reduces |ψ⟩'s ~5 axes against Ô's 6 axes and produces |rendered⟩'s 4 (material composition vector + entity list + primitives + surface scalars).

This is genuinely the same shape as quantum measurement: a state vector contracted against an observable produces a definite outcome. The κ field IS the wavefunction; the observer IS the measurement operator; the rendered tile IS the eigenvalue + state collapse.

---

## Data shapes

Concrete TypeScript signatures the implementor writes first.

```typescript
// engine/hologram.ts

import type { TP, EntityPosition } from './tp'
import type { Tier } from './tier'
// ... and whatever else is needed from mesh-potential

// ====================================================================
// MATERIAL CLASS — the T0 floor (per the entity ladder)
// ====================================================================

export type MaterialClass =
  | 'metal'        // iron, copper, gold, silver, mithril, …
  | 'stone'        // granite, basalt, sandstone, limestone, …
  | 'fiber'        // wood, hemp, cotton, sinew, …
  | 'ceramic'      // clay, brick, porcelain, …
  | 'glass'        // quartz, obsidian, magical glass, …
  | 'gem'          // ruby, emerald, diamond, …
  | 'soil'         // dirt, loam, sand, mud, peat, …
  | 'fluid'        // water, oil, blood, mercury, …
  | 'gas'          // air, fog, miasma, smoke, …
  | 'organic'      // flesh, leaf, bark, hide, fungal mass, …
  | 'ice'          // ice, permafrost, glacial ice, …
  | 'crystal'      // ley-line lattice, solidified mana, …
  | 'exotic'       // planar matter, void, raw chaos, …

// Density per class at a tile, summing roughly to 1.0
export type MaterialComposition = Partial<Record<MaterialClass, number>>

// ====================================================================
// PRIMITIVE — geometric atom for a material class (T1)
// ====================================================================

export interface Primitive {
  /** Which material class this primitive belongs to (drives color, physics, fragility) */
  materialClass: MaterialClass
  /** Geometric kind — drives mesh selection */
  geometry: 'polyhedron' | 'cylinder' | 'plane' | 'card' | 'particles' | 'volumetric' | 'lattice'
  /** Local-to-tile position (in tile-fractional units 0..1) */
  position: { x: number; y: number; z: number }
  /** Scale relative to tile size */
  scale: number
  /** Rotation around radial (z) axis in radians */
  rotation: number
  /** Color hint derived from material × variant — renderer interprets */
  color: { r: number; g: number; b: number }
  /** Variant key (drives which mesh from the per-class registry) */
  variant: string
  /** Affixes that survived seed hash + observer filter */
  affixes: string[]
}

// ====================================================================
// SURFACE PROPERTIES — what physics, pathing, and renderer shaders read
// ====================================================================

export interface SurfaceProperties {
  walkable: boolean
  blocksLineOfSight: boolean
  blocksMovement: boolean
  /** Elevation above tile baseline in feet — drives mesh y-offset */
  elevation: number
  /** Cover level for tactical scenes (0 = open, 1 = full cover) */
  cover: number
  /** Lighting at this tile — emergent from time + materials + magic */
  lightLevel: number
  /** Movement cost multiplier (1 = normal, 2 = difficult terrain, ∞ = impassable) */
  movementCost: number
  /** Combined color hint for distant LOD when individual primitives drop out */
  averagedColor: { r: number; g: number; b: number }
}

// ====================================================================
// OBSERVER FILTER — the top of the octahedron
// ====================================================================

export interface ObserverFilter {
  /** Cert id of the observer (character cert hash) */
  observerId: string
  /** Observer's tile coords (origin for LOS + distance) */
  position: { q: number; r: number }
  /** Passive perception modifier (highest in party for group filter) */
  passivePerception: number
  /**
   * Per-species/fact knowledge level (T0 EcologyKnowledgeLevel mapping).
   * Tiles try to render entities the observer doesn't know — but unknowns
   * pass only as silhouettes ("a strange creature") instead of named entities.
   */
  knowledge: Map<string, 0 | 1 | 2 | 3>
  /** World day fraction 0..1 — drives lighting + diurnal entity visibility */
  timeOfDay: number
  /** Active skill checks (for searching, tracking, etc.) */
  activeChecks: { skill: string; dc: number; modifier: number; d20?: number }[]
  /** Tiles that block LOS from observer.position to other tiles */
  losBlockers: Set<string> // serialized "q,r" keys
  /** Distance from observer in tiles — drives LOD entity-tier cutoff */
  distance: number
  /** Maximum entity tier to render at this distance (lower = coarser LOD) */
  lodMaxTier: number
}

// ====================================================================
// RENDERED TILE — the equatorial square contents
// ====================================================================

export interface RenderedTile {
  /** Tile coords on the torus (q, r) */
  position: { q: number; r: number }
  /** Material class composition (densities sum ~1) */
  materialComposition: MaterialComposition
  /** Entities present at this tile, filtered by observer */
  entities: { id: string; type: string; position: EntityPosition; visible: boolean; visibleAs: string }[]
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
    /** Was any TPB diff applied (player modifications)? */
    hasPlayerDiff: boolean
    /** Master seed used for variation hash (for receipt audit) */
    worldSeed: string
    /** Receipt: hash of substrate × variation × filter, deterministic */
    holographReceipt: string
  }
}

// ====================================================================
// THE PROJECTION FUNCTION — the tensor contraction itself
// ====================================================================

export interface HologramInputs {
  tp: TP
  worldSeed: string
  q: number
  r: number
  observer: ObserverFilter
  /** Optional: TPB diff source for player modifications */
  diffLookup?: (q: number, r: number) => TileDiff | null
}

export interface TileDiff {
  /** Per-tile modifications since seed-derivation */
  removedPrimitives: string[]    // primitive variant keys to remove
  addedPrimitives: Primitive[]   // primitive instances to add (e.g. stump, harvested loot)
  surfaceOverrides: Partial<SurfaceProperties>
  /** When this diff was applied (worldDay) */
  appliedDay: number
  /** Who modified it (character cert id) */
  modifiedBy: string
}

/**
 * The hologram. The engine's tensor.
 *
 * Given a tile coordinate and an observer filter, projects the κ-potential
 * through the observer's filter and returns the rendered tile.
 *
 * This is the function every renderer calls. It is the only call site
 * for tile observation in the engine. MM resolution, κ inheritance,
 * coupling check, observer filter, primitive composition — all funnel
 * through here.
 */
export function hologramAt(input: HologramInputs): RenderedTile {
  // ... see "The algorithm" below
}
```

---

## The algorithm

Eight steps. The implementation should match this order exactly so the tensor contraction stays correct.

### 1. Locate the containing .tp node

The torus tile coordinates `(q, r)` map to a `.tp` node through the world graph. Most tiles fall into a region; some fall into a settlement (when a hub overlaps the tile); a few are at edge_sites.

```typescript
const node = locateNodeForTile(tp, q, r)
const ctx = tp.resolve(node.id) // the LocalContext (substrate κ)
```

`locateNodeForTile` walks the .tp tree — settlement bounding boxes if the tile is in a hub, otherwise the region containing the hex at (q, r). This is `O(log n)` over the tree.

### 2. Trigger lazy MM resolution for this observer

Before we can read κ, any MMs at this node with pending potential need to resolve. The hologram does this lazily — only when *this* observer would actually see the affected domains.

```typescript
const mmsAtNode = getMMsForNode(tp, node.id)
for (const mm of mmsAtNode) {
  if (mm.pendingDays() > 0 && filterAllowsDomain(observer, mm.domainAffected)) {
    mm.resolve(tp.worldDay, tp)
  }
}
```

`filterAllowsDomain` is the observer's per-domain gate. If the observer can't see economic activity (their knowledge of the local market is zero), don't resolve `MMMarket` for them — its κ stays pending. Saves compute. Other observers with higher knowledge might trigger it later.

After this step, κ at the node is up-to-date for the domains this observer could perceive.

### 3. Compute the substrate (the 99.98%)

Walk inheritance, fold in morphogen field for this exact tile.

```typescript
const substrate = {
  inheritedKappa: ctx, // already-walked LocalContext from step 1
  morphogen: computeMorphogenField(ctx, q, r), // continuous field at (q, r)
  catalogs: getActiveCatalogs(ctx), // species, commodities, recipes that apply here
}
```

The morphogen field interpolates between the node's κ and its neighbors' κ — smooth gradients of biome, faction influence, climate. This is what the stem-cell layer (in the previous Claude conversation Pedro pasted) consumes.

### 4. Compute the seed variation (the 0.02%)

```typescript
const rng = new SeededRNG(`${worldSeed}:${q}:${r}`)
const variation = {
  biomeVariant: pickBiomeVariant(substrate.morphogen, rng),
  materialClasses: pickMaterialComposition(substrate, rng),
  entityRolls: rollEntityPresence(substrate, rng), // per entity-slot, do we spawn?
  decorationVariants: pickDecorationVariants(substrate, rng),
  affixRolls: rollAffixes(substrate, rng), // for any items the tile generates
}
```

Each pick consumes bits from the hash. Variation magnitude is parameterized by the master seed (per-axis variation rates — see entity_ladder.md and the DNA discussion).

### 5. Apply the TPB diff (player modifications)

If anyone has interacted with this tile, those modifications layer on top of the seed-derived state.

```typescript
const diff = input.diffLookup?.(q, r) ?? null
const tile_DNA = applyDiff(substrate, variation, diff)
```

The diff is a small TPB row — "tree at this tile chopped on day N by character C." Apply it: remove the tree primitive, add a stump + harvested loot. Server-canonical .tpb has this; client gets it via flywheel sync. **Storage scales with interactions, not tiles.**

### 6. Coupling check (the apoptosis filter)

Before declaring the tile differentiated, check that its κ is gradient-continuous with its 4 (or 6, on hex grid) neighbors.

```typescript
const neighbors = getNeighborTiles(tp, q, r) // their tile_DNA, recursively if needed
const couplingScore = computeCoupling(tile_DNA, neighbors)

if (couplingScore < COUPLING_THRESHOLD) {
  // Apoptosis: the seed picked an incoherent variant. Tile registers as
  // undifferentiated — wilderness, gap, "place between places."
  return apoptotic_tile(q, r, substrate)
}
```

`computeCoupling` is the math from the stem-cell architecture — Δκ across the relevant property dimensions, weighted by which properties matter for coherence. Most tiles pass; the rare incoherent ones don't materialize entities. Their absence is the world's negative space.

**Recursion concern:** computing neighbors' tile_DNA requires *their* coupling check, which requires *their* neighbors, etc. Solution — coupling check uses substrate + variation only (steps 3-4), not the full hologram. It's a pre-render gate that stays bounded at O(neighborhood size), typically 4-6 lookups.

### 7. Apply the observer filter (the top of the octahedron)

This is where Ô contracts against |ψ⟩.

```typescript
const visible = applyObserverFilter(tile_DNA, observer)
```

What `applyObserverFilter` does, in order:

1. **LOD cutoff** by distance: drop entities whose tier > `observer.lodMaxTier`. At 100 tiles distance, only T11+ (settlements, kingdoms) render; close tiles render down to T3 (individual NPCs).

2. **LOS occlusion**: if `observer.losBlockers` includes this tile or anything between observer and it, drop the entities and primitives that LOS would block (still render terrain, but no NPCs visible).

3. **Time-of-day**: modulate `lightLevel`; gate diurnal/nocturnal entity visibility (a basilisk doesn't render at night unless infrared-perception is set).

4. **Knowledge filter**: for each entity, look up `observer.knowledge[entityType]`. Tier 0 = render as silhouette ("a strange creature"). Tier 1+ = render with name and knowable properties.

5. **Active skill checks**: for hidden things (chests, traps, doors, sneaking creatures), roll the active checks. If `d20 + modifier ≥ dc`, reveal; otherwise, don't include.

6. **Perception passive**: as a final pass, drop entities whose stealth > observer.passivePerception (unless an active check passed).

The result is a filtered subset of `tile_DNA` — only what this observer would actually see.

### 8. Compose primitives + surface properties

Convert the visible material composition + visible entities into renderable primitives and surface scalars.

```typescript
const primitives = composePrimitives(visible.materialClasses, visible.entities)
const surface = deriveSurfaceProperties(visible)

return {
  position: { q, r },
  materialComposition: visible.materialClasses,
  entities: visible.entityList,
  primitives,
  surface,
  kappa: extractKappaSnapshot(ctx),
  metadata: {
    coupled: true,
    couplingScore,
    observationDay: tp.worldDay,
    hasPlayerDiff: diff !== null,
    worldSeed,
    holographReceipt: hashReceipt(substrate, variation, observer, diff),
  },
}
```

`composePrimitives` reads the per-class primitive registry (a small static catalog: `stone → polyhedra`, `fiber → cylinders`, `gas → particles`, etc.) and instances them at positions derived from the seed variation. This is what fills the equatorial square with mesh content.

`deriveSurfaceProperties` reads the dominant material class and the entity overlay to compute `walkable`, `blocksLOS`, `cover`, `movementCost`, etc. Physics + pathing read this; renderer reads this; one source.

`hashReceipt` produces a deterministic receipt — same inputs always produce the same receipt, so server and client can verify they rendered the same tile.

---

## Where it sits in the engine

```
engine/
├── hologram.ts               ← NEW: this file. The tensor.
├── mesh-potential.ts         ← Re-exports hologramAt + types from hologram.ts
├── tp.ts                     ← unchanged (provides .tp + κ inheritance)
├── mm-simulated.ts           ← unchanged (MMs still resolve when called)
├── clockwork.ts              ← unchanged (cron heartbeat still ticks)
└── ...
```

The hologram has dependencies on:
- `tp.ts` for κ inheritance
- `mm-simulated.ts` for MM resolution (lazy trigger in step 2)
- `tier.ts` for LOD cutoff
- `hub-topology.ts` for `SeededRNG` (the variation hash)
- The species + commodity + adaptation catalogs from T0
- The morphogen field computation (will need a new helper, probably in `engine/morphogen.ts` — derives smooth field from κ + neighbors)
- The primitive registry (a new static catalog, probably in `engine/primitives.ts`)

The hologram is the highest-level engine module. Everything else feeds it. Nothing else should call MMs directly once the hologram exists — go through the hologram.

---

## The inversion: how MM/MF interaction changes

This is the load-bearing architectural shift.

### Before (today)

```
[external: cron tick]    [external: player UI / renderer]
        │                          │
        │                          ↓
        │                  observeNode(nodeId)
        │                          │
        │                          ↓
        │                  for each MM: mm.resolve()
        │                          │
        │                          ↓
        │                  κ written via writeDomain
        │                          │
        ↓                          ↓
clockwork.dailyTick()      tp.resolve(nodeId) → LocalContext
        │                          │
        ↓                          ↓
mm.accumulatePotential()   external code interprets κ
        │                          │
        ↓                          ↓
pendingPotential builds    UI / renderer / physics each
                           reimplements interpretation
```

Three call sites that each have to know about each other. The renderer knows MMs exist. The MM knows it might be observed. The κ is read by N consumers each interpreting differently.

### After (with hologram)

```
[external: cron tick]    [external: anything that wants a tile]
        │                          │
        ↓                          ↓
clockwork.dailyTick()       hologramAt(tp, seed, q, r, observer)
        │                          │
        ↓                          │
mm.accumulatePotential()    ┌─────┘
        │                   │
        ↓                   ↓
pendingPotential builds     1. locate node
                            2. lazy resolve MMs (filter-gated)
                            3. compute substrate
                            4. compute variation
                            5. apply diff
                            6. coupling check
                            7. observer filter
                            8. compose primitives + surface
                                   │
                                   ↓
                            RenderedTile returned
```

One call site. The MM doesn't know about observation; it just exposes `pendingDays()` and `resolve()`. The hologram handles whether to call them. The renderer doesn't know about MMs; it asks for tiles. The interpretation of κ happens once, in the hologram, and the RenderedTile shape is what every consumer reads.

### What this enables for new MMs/MFs

When you write a new MM after this exists:

- You don't think about "when am I observed?" — the hologram handles that. You only think about cadence and pendingPotential.

- You don't write a κ-interpretation layer for the renderer. You write `writeDomain(...)` and the hologram picks it up automatically.

- You don't define LOD logic. The hologram's filter handles LOD by entity tier.

- You don't define stealth/visibility rules. The observer filter does.

- You write less code. The MM is purely "math over time," and the hologram is purely "math over space + observation."

When you write a new MF (a manifold function):

- It's pure compute, returns `{ output, receipt }`, doesn't render anything. (Same as today.)
- The hologram calls it at composition time when a primitive needs to be generated (e.g., `mfForge(ingot, recipe) → ItemV2 → primitive`).
- Receipts chain naturally through the hologram into the audit log.

### What this enables for clients

The client runs the hologram locally:

```typescript
// On the client (browser):
const tile = hologramAt({
  tp: clientLocalTp,
  worldSeed: account.worldSeed,
  q, r,
  observer: { ...myCharacterFilter },
  diffLookup: localDiffStore.get,
})

renderTileToCanvas(tile)
```

Same function, same inputs (modulo the diff lookup which uses the local TPB), same output as the server would produce. **Math symmetry** — server and client render identically because they call the same function. The receipt embedded in the RenderedTile metadata can be cross-verified.

This means: when the player chops a tree and pushes a flywheel slot to the server, the server doesn't need to recompute the visual; it canonicalizes the diff. Every other client re-runs the hologram with the new diff and sees the same result.

---

## Implications cascade

Listed in order of how they fall out of the hologram existing:

1. **Lazy resolution becomes free.** No MM resolves until a hologram looks at it. Vast unobserved continents tick `pendingPotential` forever and cost nothing because no one has run the hologram on those tiles. This is the active-hub gate, generalized.

2. **Observer-specific rendering for free.** Two players in the same room see different RenderedTiles because their `ObserverFilter` differs. Fog of war, stealth, knowledge gating, selective info reveal — all built-in. The DM lens is just `ObserverFilter(omniscient: true)` skipping all gates.

3. **The diff layer is the modification API.** Every player interaction produces a `TileDiff` row. The hologram applies diffs on top of seed-derivation. Clients sync diffs via flywheel; canonicalization is just append-to-canonical-.tpb on cron drain. **No mesh storage. No mesh transfer.** Just diffs.

4. **Coupling produces wilderness automatically.** Apoptotic tiles return a minimal hologram (just the substrate, no entities, no decorations). Players read this as "wilderness, edge of the map, place that doesn't make sense." The world's negative space comes from the hash+threshold, not from authoring.

5. **LOD is one parameter.** `observer.lodMaxTier` controls entity-tier cutoff. The same hologram function renders close-up material primitives (T0-T3) AND continent-scale silhouettes (T11-T15). Zoom = traversal up the entity ladder. Authoring multiple LOD meshes goes away.

6. **Math symmetry between client and server is a property, not a goal.** Both run `hologramAt()`. Same inputs, same outputs, same receipts. Divergence only happens if a client tampers with their inputs — and the receipt audit catches that on flywheel drain.

7. **The renderer becomes thin.** It loops over visible tiles, calls `hologramAt()`, and rasterizes the returned primitives. No knowledge of κ, MMs, factions, weather, ecology — all of that is internal to the hologram.

8. **Physics + pathing become thin.** They read `RenderedTile.surface`. Want to know if the player can walk here? `tile.surface.walkable`. Want pathing weights? `tile.surface.movementCost`. Same source.

9. **Multi-observer reconciliation is trivial.** Each observer gets their own hologram. The world-state is the κ field; observer-states are filter-applied projections. Different views of one truth — exactly what worldline reconciliation requires.

10. **The hologram receipt is the audit anchor.** If a player claims "I saw a dragon at this tile," the receipt embedded in their RenderedTile is checkable against `H(substrate × variation × filter × diff)`. If the receipt verifies, the dragon was there; if not, the client tampered. This is the forensic layer made automatic.

---

## Implementation plan

Build order, roughly two weeks if the implementor has the engine context already loaded (e.g. read `mesh-potential.ts` first):

### Phase 1 — Skeleton (1-2 days)

1. Create `engine/hologram.ts` with the type definitions from "Data shapes" above.
2. Create `engine/morphogen.ts` with stub functions (`computeMorphogenField` returns substrate κ unchanged for now).
3. Create `engine/primitives.ts` with stub catalog (one primitive per material class).
4. Implement `hologramAt()` with all 8 steps but stubbed components (each step calls a placeholder that returns reasonable defaults).
5. Wire the result into a single test surface that calls `hologramAt({ ... })` and prints the RenderedTile.
6. Re-export from `mesh-potential.ts`.

At the end of Phase 1, the function exists and runs. Output is uninteresting (every tile looks the same) but the call shape is correct.

### Phase 2 — Substrate + variation (3-4 days)

1. Implement `locateNodeForTile` properly, walking the .tp tree.
2. Implement `computeMorphogenField` for real — interpolate κ across hex neighborhood at (q, r).
3. Implement `pickMaterialComposition` and `pickBiomeVariant` and `rollEntityPresence` against the substrate's morphogen field. Use the existing `SeededRNG`.
4. Implement `composePrimitives` against the primitive registry (start with ~30 primitives covering the 13 material classes × 2-3 variants each).
5. Implement `deriveSurfaceProperties` — read material composition, derive walkable/cover/lightLevel.

At the end of Phase 2, distinct tiles look distinct. Every tile renders consistently from `(worldSeed, q, r)`.

### Phase 3 — MM resolution + diff layer (2-3 days)

1. Implement `getMMsForNode` (queries Clockwork's per-node MM index — may need to add this to Clockwork if not present).
2. Implement `filterAllowsDomain` — the observer's per-domain gate.
3. Wire lazy `mm.resolve()` calls into step 2 of the algorithm.
4. Implement `TileDiff` storage + `diffLookup` against the .tpb (server-side) and IDB (client-side).
5. Implement `applyDiff` — overlay diffs on top of substrate+variation.

At the end of Phase 3, modifications stick. Player chops a tree → diff appended → next hologram call returns stump + harvested wood.

### Phase 4 — Observer filter (3-4 days)

1. Implement LOS occlusion (line-of-sight raycast across tile grid).
2. Implement knowledge filter (per-species visibility tier).
3. Implement skill check application (active perception roll for hidden things).
4. Implement LOD tier cutoff (drop entities above `observer.lodMaxTier`).
5. Implement time-of-day lighting modulation.

At the end of Phase 4, two observers in the same room see different tiles based on their filters. Stealth, fog of war, and knowledge gating all work.

### Phase 5 — Coupling check + apoptosis (1-2 days)

1. Implement `computeCoupling` — Δκ across substrate properties between this tile and its neighbors.
2. Apply the threshold gate.
3. Implement `apoptotic_tile` — returns a minimal RenderedTile with substrate-only content.

At the end of Phase 5, the world has texture: most tiles are coherent, some are wilderness gaps where the seed picked an incoherent variant.

### Phase 6 — Receipts + audit (1 day)

1. Implement `hashReceipt` deterministically (same shape as existing engine receipts).
2. Embed receipt in RenderedTile.metadata.
3. Add a verification function: `verifyHologram(receipt, inputs) → boolean` for forensic audit.

At the end of Phase 6, the hologram is auditable end-to-end.

### Phase 7 — Migration (ongoing)

1. Update existing renderers / surfaces to call `hologramAt()` instead of reading κ directly.
2. Update existing tests to assert against RenderedTile shape.
3. Deprecate the direct-κ-read pattern in code review.

---

## Beyond this layer

Things this doc explicitly does not solve, but that fall out cleanly once the hologram exists:

- **Multi-tile rendering.** A render call asks for an 8×8 chunk grid by calling `hologramAt` for each tile. Caching: if any tile's inputs haven't changed (no diff, no MM resolution since last call, same observer), reuse the previous RenderedTile. The receipt is the cache key.

- **Distance LOD with primitive aggregation.** When the observer is far, multiple tiles' primitives composite up into a single coarse mesh ("the forest" instead of 64 trees). This is a post-processing pass after the per-tile hologram — the hologram itself stays per-tile.

- **Animation.** Static tile content is the hologram. Dynamic animation (a tree swaying, a campfire flickering) is a small per-frame perturbation on top of the hologram's primitives. The hologram doesn't do animation; the renderer does, layered on top.

- **The Underdark surface.** The hologram has a `radial_offset` parameter (currently 0 = surface). Set it to torus-thickness = inner ring, and you render the Underdark side using the same function. Inverted morphogen field, different species pool, no sun. One function, two surfaces.

- **DM-shard hologram.** The DM's local hologram during a session can be more permissive (omniscient filter) and the rendered tile state pushed to player clients via spectrum. The DM's shard runs the math; players receive RenderedTiles as cards. Same function, different observer at the top of the octahedron.

- **Seed perturbation tools.** A DM can ask "what if I bumped this tile's variation hash by N?" and the hologram re-runs with the perturbation. Letting DMs tune individual tiles without rewriting code becomes a UI surface over the variation rate parameters.

---

## Closing

The hologram is the engine's tensor. It is the function that contracts the κ-field against the observer to produce the rendered tile. It is the only function the renderer needs to call. It is the call site where MM resolution, κ inheritance, seed variation, coupling, observer filtering, and primitive composition all meet.

Building it changes the shape of every MM/MF interaction that comes after — because nothing reads κ directly anymore. Everything reads holograms. The engine becomes one tensor with one entry point.

Once it exists, the implementor of any future feature has one question to answer about their work: *what does this look like in a RenderedTile?* If they can answer that, they've designed the feature correctly. If they can't, the feature isn't a tile-affecting feature and probably belongs at a higher tier in the entity ladder.

That's the discipline. That's the shape. That's the math.

The hologram is the white light's collapse into color. Pedro called it correctly: it's the engine's tensor.
