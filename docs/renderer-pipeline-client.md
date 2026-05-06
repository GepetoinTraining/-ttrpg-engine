# The Mesh — Content Pipeline

> *Architectural reference. Derived in conversation 2026-05-05.
> Companion to `engine/mesh-potential.ts` (the white light file).*

## Premise

The Mesh is a TTRPG engine where every layer follows the same compression
principle: **small parametric carrier → deterministic expansion → lazy
evaluation → sparse persistence**. The engine is silent (no LLM imports),
owns no rows (state lives in TPB log), and runs almost entirely client-side.
The server is a math witness, not a state authority.

This document specifies the **content pipeline** — how 3D geometry, entity
state, and visual quality flow from server-side authoring to client-side
rendering, including the inverted-bandwidth model that makes a richly
populated procedural world fit comfortably in browser storage and Discord
bandwidth.

---

## The architectural inversion

Conventional client-server games:

- Server holds canonical world state.
- Server transmits authored 3D meshes (megabytes per asset).
- Client renders what server sends.
- Bandwidth scales with world richness.

The Mesh inverts this:

- Client holds the runtime engine + the asset library (loaded on install
  or progressively per biome).
- Server holds the seed + the TPB chain (cryptographic referee).
- Client computes everything — terrain, entities, meshes, behavior —
  locally from seed + TPB.
- Bandwidth scales with **player interaction frequency**, not world richness.
- The asset "library" is a catalog of **molds** (SDF + CSG descriptions),
  not meshes. Meshes are cast client-side from molds, on demand, and
  cached in IndexedDB.

The result: a 32×32 mile region with thousands of entities ships as a few
megabytes of mold catalog plus a multi-kilobyte TPB chain. The world is a
function the server hosts a description of.

---

## The five-layer pipeline

```
LAYER 1   Server-side mold authoring          (dev-time / CRON)
LAYER 2   Catalog distribution                 (game install / biome prefetch)
LAYER 3   Entity instantiation                 (client-side, on PC proximity)
LAYER 4   Mesh casting + progressive refinement (client-side, attention-driven)
LAYER 5   Persistence + replay                 (TPB log + IndexedDB cache)
```

Each layer has a clean interface to the layer below. Each layer is
deterministic. Each layer can be tested independently. None of them
require special infrastructure beyond what's already standard
(Vercel, IndexedDB, Three.js, Discord).

---

## Layer 1 — Mold authoring (server-side, dev-time)

### What gets authored

For every entity-class in the engine ladder (T0–T17), an authored mold
exists in the catalog. A mold consists of:

1. **A CSG description** — boundary-respecting form (Boolean ops on
   primitives, sharp edges, exact intersections). Used for cuts,
   collisions, intersections.
2. **A signed distance function (SDF)** — the same shape expressed as
   a continuous distance field. Used for marching cubes evaluation,
   soft blending, falloff effects, and per-instance noise perturbation.
3. **A wedge schema** — declares which of the entity's 64 wedge channels
   parameterize which aspects of the mold (size, proportions, equipment
   slots, color palette, pose, archetype variants).
4. **An archetype tag** — links the mold to its entity-class in the
   tier ladder.

### Authoring workflow

The mold is **not authored manually for every entity**. It's authored once
per archetype (humanoid, beast, dragon, ooze, construct, building-style,
tree-species, terrain-feature, etc.) — maybe 30–50 archetypes total.
Per-instance variation comes from wedge parameters + per-instance noise,
not from per-instance authoring.

For the first mesh-generation pass, use the open-source TTR/SDF library
ecosystem:

- `three-bvh-csg` for CSG operations
- `three-mesh-bvh` for spatial queries on the resulting meshes
- `marching-cubes` (or Three.js's `MarchingCubes` helper) for SDF→mesh
- A noise library (simplex-noise.js, the same one the world uses)

These are heavy NPM packages, but they only run **server-side, dev-time**,
on a Vercel CRON loop. They never ship to the client. Client-side
rendering uses Three.js and a lightweight runtime SDF evaluator.

### Vercel CRON scheduling

The mold-authoring pipeline runs on a **daily Vercel CRON job**:

- Pulls any new authored archetypes from a Git-tracked source folder.
- Validates each archetype's SDF + CSG against the wedge schema.
- Renders preview screenshots of each archetype at canonical poses.
- Bumps the catalog version.
- Publishes the catalog to a CDN-fronted endpoint.

This is light compute — well within Vercel's free CRON allowances.
**No real-time server compute is needed for the engine itself.** Vercel
hosts the catalog and the TPB referee endpoint; everything else is the
client's job.

---

## Layer 2 — Catalog distribution

### Initial install

On first launch, the client downloads the **base catalog** — global
archetypes that exist in every biome (player characters, common items,
universal infrastructure props). A few megabytes total.

### Biome-scoped prefetch

As the player approaches a biome boundary, the client prefetches the
**biome-specific catalog** — archetypes that exist only in that biome
(polar bear in tundra, sahuagin in coastal, derro in underdark). This is
biome-locality applied to the asset catalog.

The prefetcher uses the player's movement vector to predict which biomes
are coming and starts loading their catalogs ahead of arrival. By the
time the player crosses the boundary, the new archetypes are already in
IndexedDB.

### Catalog storage

Catalogs are stored in IndexedDB, keyed by `(catalog_version, biome_id)`.
Old versions are kept until garbage-collected by quota pressure. New
versions arrive as deltas (only changed archetypes) when possible.

---

## Layer 3 — Entity instantiation (client-side)

### The proximity trigger

Entities don't exist until the PC is within chunk-radius of them. Until
then, they're just a deterministic potential — `(seed, chunk_pos,
entity_id) → exists?`. The bitmap of "where entities exist in this
chunk" is itself a deterministic function of the seed; the client
computes it locally without a server query.

### The roll

When the PC enters chunk-radius of an entity:

1. Client looks up the entity's archetype from the canonical
   per-biome lookup tables (deterministic from seed + position).
2. Client rolls the entity's **64-wedge tensor** — a deterministic
   pseudo-random function of `(worldSeed, entity_id, encounter_time)`.
   The tensor encodes:
   - Which mold to use (one wedge column = "archetype/mold ID").
   - Mold parameters (size, proportions, equipment, color palette,
     pose, etc. — distributed across multiple wedge columns).
   - Per-instance variation seed (used to perturb the SDF for
     unique-but-coherent geometry).
   - Behavioral state (HP, morale, intent, faction allegiance, etc.).
3. The wedge tensor lives in **vertex attributes on a hidden 64-wedge
   disc geometry**. The disc is never rendered visually — it's a
   structured tensor that piggybacks on geometry the GPU is going to
   process anyway. The plastic-mini render uses a different shader
   path that masks the disc entirely.

### TPB-fixed vs. ephemeral

Before rolling, the client checks the TPB log for any prior interaction
with this entity:

- **No TPB record** → roll fresh from seed. The roll lives in RAM only.
  If the PC walks past without interacting, the rolled entity evaporates.
- **TPB record exists** → reconstruct the entity from `(fresh_roll +
  TPB_diffs)`. The TPB log is the only persistent state; the rest is
  recomputed.

This is the core lazy-evaluation discipline. **Most entities the player
encounters are never written to disk.** They exist for as long as
proximity holds, then vanish.

---

## Layer 4 — Mesh casting + progressive refinement

### First-encounter rendering

When the entity needs to render visually, the client:

1. Reads the wedge tensor.
2. Looks up the mold from the catalog.
3. Parameterizes the mold (proportions from wedge values, equipment
   from equipment-wedge values, color palette from color-wedge values).
4. **Perturbs the SDF with per-instance noise** — `instance_sdf(p) =
   base_sdf(p) + noise(p, instance_seed) * variation_amplitude`. This
   makes every brown bear slightly unique without authoring per-instance
   meshes.
5. Casts the perturbed SDF into a triangle mesh using marching cubes,
   at a **low initial resolution** (e.g., 8³ or 16³ grid).
6. Hands the cast mesh to Three.js for rendering with the plastic shader.

The first render is **good enough for the moment**. The bear looks
slightly blocky, but the player is reacting to "a bear is here," not to
fur details. The render is delivered fast (sub-100ms typical).

### The progressive refinement loop

A background scheduler (the **evaluator**) runs during idle time and
re-meshes entities at higher resolution:

1. Pick the entity that scored highest on the *attention metric*
   (proximity + time-in-view + interaction-recency).
2. Re-cast its SDF at the next resolution tier (16³ → 32³ → 64³ → 128³).
3. Cache the higher-res mesh in IndexedDB, keyed by
   `(mold_id, params_hash, resolution_tier)`.
4. Swap the rendered mesh for the higher-res one on the next frame.

Quality grows with attention. Bears the player ignores stay blocky.
Bears the player engages with become progressively beautiful. **The
game looks better the more you play it.**

This is the same architectural principle as Path of Exile's predictive
asset caching — *clever caching makes the game look better than its
bandwidth budget should allow*. Bandwidth is not the limit; client
compute + storage is the substrate.

### Cache eviction

The cache is keyed by `(mold_id, params_hash, resolution_tier)`. When
quota pressure hits, evict in this order:

1. Lowest-resolution tiers (always re-derivable from mold + params).
2. Least-recently-used instances of common archetypes.
3. Instances from biomes the player hasn't visited in N sessions.

Critical to never evict: anything referenced by a TPB record. Those are
*canonical persistent entities* and their meshes need to be reproducible
exactly.

---

## Layer 4.5 — Time-extended perturbation (animation)

The mold is not a static SDF. It is a function over `(space × parameters × time)`.
Static rendering is what you get when you fix `t = 0`. Animation is what you
get when you let `t` vary.

### Animation as perturbation

Animation is **not** a sequence of authored keyframe meshes. It is a small
periodic or progress-driven perturbation function applied to the base mold
at evaluation time:

```
animated_sdf(p, t) = base_sdf(p) + animation_perturbation(p, t, params)
```

Examples:

- **Idle breathing.** Subtle sinusoidal chest deformation with period T.
- **Walking.** Phased leg-displacement function of `t`.
- **Attack swing.** Arm trajectory parameterized by `attack_progress` (0→1
  over the strike's duration), where `attack_progress` is read from the
  entity's wedge tensor.
- **Death collapse.** One-shot non-periodic perturbation parameterized by
  `time_since_death`.

Each perturbation is a few lines of math, not a sequence of meshes.

### Composition

Perturbations sum. The bear can be walking, breathing, and turning its head
simultaneously — three perturbations, summed onto the same mold. Summation
is associative and cheap. **No animation-blending state machine needed.**
No transition-between-states problem. Each perturbation is its own additive
contribution; they layer naturally.

### Aesthetic policy

The frozen-tableau aesthetic is preserved by simply *not* reading the `t`
parameter — the renderer evaluates the mold at fixed `t = 0` and the
diorama stays static. Animation is a **rendering policy**, not a
capability constraint. You can choose:

- **Strict frozen tableau** — `t` ignored everywhere. Combat is chess.
- **Idle animation only** — `t` advances during downtime, freezes during
  combat turns. Diorama feel preserved during decisive moments.
- **Full animation** — `t` advances continuously. Tabletop minis become
  living dolls.

The architecture is neutral about the choice. The aesthetic can shift
per-archetype, per-scene, or per-game-mode without infrastructure changes.

### Cost scaling

Animation cost scales with attention, like geometry. Bears far from the
player don't need their breathing animated. The progressive refinement
scheduler handles this naturally — distant entities render statically,
mid-distance entities get idle animation, combat-engaged entities get
full per-limb articulation.

### Multiplayer sync

Animation state is **not** transmitted as motion data. Both clients
evaluate the same mold + same perturbation + same `t`-value, and produce
the same geometry. The shared TPB chain plus client-local clocks is
sufficient. **No animation network packets.**

---

## Layer 4.6 — Equipment as targeted perturbation

The character's full appearance is the base mold + a sum of equipment SDFs
at **fixed slot addresses** on the base mold's surface.

### The slot system

A humanoid base mold defines fixed radial+vertical addresses corresponding
to gear slots:

- Head (helms, hats, hoods, hair)
- Torso (shirts, breastplates, robes, tabards)
- Shoulders (pauldrons, mantles, capes-attached)
- Arms (sleeves, bracers, gauntlets)
- Hands (gloves, rings — visible if zoom permits)
- Waist (belts, sashes, girdle accessories)
- Legs (pants, greaves, skirts)
- Feet (boots, shoes, sandals)
- Back (cloaks, capes, backpacks, wings)
- Main-hand (weapon, tool, focus, instrument)
- Off-hand (shield, secondary weapon, focus, lantern)

Each slot has a known address on the base SDF. **Equipment is its own
small SDF that the engine adds to the base SDF at the slot's address**.

### Composition

A goblin warrior in iron armor:

```
final_sdf(p) =
    base_goblin_sdf(p)
  + per_instance_noise(p, instance_seed)        // unique goblin
  + iron_helm_sdf(p - head_slot_address)
  + chainmail_sdf(p - torso_slot_address)
  + leather_boots_sdf(p - feet_slot_address)
  + iron_sword_sdf(p - main_hand_address, t)    // animated swing
  + wooden_shield_sdf(p - off_hand_address)
```

Marching cubes evaluates the sum. The result is a unique-looking goblin
in specific gear, mid-attack-swing if `t` is read.

### The catalog

A few hundred equipment SDFs covers an entire game's worth of outfitting.
Each entry carries:

- The SDF (visual perturbation)
- The slot it occupies
- The property profile (armor class, weight, durability, magic effects)

**One catalog entry, two readings (visual + mechanical), can't disagree.**

### Equipment as wedge channels

Allocate wedge channels to equipment slots. Each slot's wedge value is
an index into the gear catalog. Swapping gear = changing a wedge value.
The next mesh evaluation pulls the new equipment SDF and casts. **No
transition — just the next frozen frame shows the new gear.**

### Per-character fit variation

The slot's address is a *region*, not a point. Within that region, the
equipment SDF can be perturbed slightly per-character. Two characters
wearing the same breastplate look slightly different because the
breastplate occupies its slot slightly differently on each. **Same
equipment, different fits, deterministic from character ID.**

### Decoupling cosmetic from functional

The wedge channels for "appearance gear" and "stats gear" can point at
different catalog entries. The character *looks* like they're wearing
leather armor while *mechanically* wearing magic robes. **Transmog is
free** — emergent from the architecture, not bolted on.

### Crafting

A custom-forged item isn't a catalog entry. It's a *base item SDF* +
*crafting parameters* (length, curve, material, runes) that perturb the
SDF at evaluation time. **The smith crafts the SDF parameters.** The
result is unique, persisted by parameter values in the TPB chain,
regeneratable on any client.

---

## The unified perturbation primitive

Animation, equipment, per-instance variation, damage states, and magic
effects are all **the same architectural operation**: parameterized SDF
perturbation at addressed positions on a base mold.

| Phenomenon                | Perturbation type           | Address scope          |
|---------------------------|-----------------------------|------------------------|
| Per-instance variation    | Continuous noise            | Whole surface          |
| Equipment                 | Catalog SDF additive        | Fixed slots            |
| Animation                 | Time-parameterized function | Whole surface or slot  |
| Damage / wounds           | Subtractive perturbation    | Hit-location address   |
| Magic auras / glows       | Colored perturbation        | Whole surface or slot  |
| Disguise / illusion       | Replacement perturbation    | Whole mold             |

Every visual phenomenon in the engine flows through one primitive:

```
final_geometry = marching_cubes(
    base_mold(p)
    + Σ perturbation_i(p, t, params_i, address_i)
)
```

The renderer reads the wedge tensor, looks up molds and perturbations
from the catalog, sums them, casts, paints with the plastic shader.
**That is the whole renderer.** Everything visual is a parameter to
that one operation.

---

## Layer 5 — Persistence + replay

### What persists

- **The seed.** One number. The world is deterministic from it.
- **The TPB chain.** Append-only log of player interactions. Each entry
  is small (action_id, target_entity_id, dice_rolls, timestamps).
- **The mesh cache.** Derived data, regeneratable. Persisted only as
  a performance optimization.

### What does NOT persist

- Entity rolls that were never TPB'd. Ephemeral.
- World tiles the player has visited but not interacted with. The biome
  resolver regenerates them on revisit.
- Mesh geometry beyond the cache. Re-cast from molds on demand.

### Replay semantics

A save state is `(seed, TPB_chain)`. Restoration replays the TPB chain
against the seed, deterministically reproducing the world. The player's
"history" is the chain. Loading an old save means choosing to abandon
the chain after that point.

### Multiplayer cross-check

Each client runs the deterministic engine independently. TPB chains are
exchanged between peers (via Discord, via a relay server, via direct
WebRTC — the transport doesn't matter). Chains are signed; signature
verification catches tampering. **Disagreement between peers is a
synchronization bug, not a state-of-truth question** — both clients
should be deriving the same world from the same inputs.

The server (Vercel endpoint) hosts the canonical TPB chain as a referee.
Peers can sync to the canonical chain to recover from disconnects, but
peer-to-peer is the primary path.

---

## Vercel's role, summarized

Vercel does **light, sparse, scheduled work**:

1. **CRON daily** — runs the mold authoring pipeline (Layer 1).
   Uses heavy dev-deps (CSG libs, marching cubes, noise libs) but only
   in the build step, not at runtime.
2. **CDN serves the catalog** — biome-scoped mold descriptions.
3. **TPB referee endpoint** — receives signed TPB packets, validates,
   stores. Sub-millisecond per packet, trivial throughput.

Vercel is **not** running per-frame simulation, per-entity AI, mesh
generation, or any other compute that scales with world richness. Its
load is a function of **player count and player action frequency**, not
**world size**.

Free tier comfortably handles a few hundred concurrent players. Paid
tier scales further trivially because the per-player load is so low.

---

## Implementation order (suggested)

A reasonable sequence for first-time implementation:

1. **Catalog scaffolding.** One archetype (humanoid). One mold. Wedge
   schema. Validate on Vercel CRON. Publish to CDN.
2. **Client catalog loader.** Fetch + IndexedDB cache. No biome scoping
   yet; load everything.
3. **Wedge tensor disc.** Hidden 64-wedge geometry on every entity.
   Rolled deterministically from seed.
4. **First mesh casting.** Low-res marching cubes. Plastic shader.
   Render one humanoid at a fixed pose. Verify visual.
5. **TPB log writer.** IndexedDB append-only. Serialize wedge changes
   on player interaction.
6. **Progressive refinement scheduler.** Background re-meshing. Cache
   higher-res versions.
7. **Biome-scoped catalogs.** Add biome boundaries. Prefetch on
   approach.
8. **Multiplayer cross-check.** TPB chain exchange. Signature
   verification.

Each step is testable in isolation. Each step is implementable in days,
not weeks. The full pipeline ships in months, not years.

---

## What this enables

- **A 32×32 mile world that ships as a few MB** of mold catalog.
- **Thousands of unique entities per biome**, none individually authored.
- **Visual quality that grows with player attention**, capped only by
  client compute and IndexedDB quota.
- **Full multiplayer with no server-side simulation**, using Discord or
  any other relay as transport.
- **Save scumming as cryptographic operation**, not memory snapshot.
- **Cheating that's automatically detected** by signature mismatch on
  TPB chain merge.
- **Offline play that just works** until network resumes for sync.
- **Equipment systems with hundreds of items**, deterministically
  composable at runtime. RuneScape-tier visible-gear progression from a
  small catalog.
- **Animation as a rendering policy**, not a capability question.
  Frozen tableau, idle-only, or full motion — selectable per-scene.
- **Crafting as parameter-perturbation**, producing unique artifacts
  whose visual and mechanical properties co-derive from the same data.
- **Damage states, magic effects, disguises, illusions** — all from the
  same single perturbation primitive. No special-case rendering paths.

---

## What this does NOT enable

Worth being honest about the tradeoffs:

- **Real-time animation.** The architecture deliberately excludes
  per-frame motion. Frozen tableau aesthetic. If you need animation,
  this isn't the pipeline.
- **Photorealistic rendering.** Plastic shader, fixed camera, no
  global illumination. The aesthetic is diorama, not film.
- **Latency-sensitive multiplayer.** TPB cross-check has acknowledgment
  delays. Fine for turn-based or downtime-paced play. Not for FPS.
- **Player-authored content beyond TPB events.** The world's shape is
  the seed; players modify it through TPB, but they don't author molds.
  If that's needed, it's a separate (mold authoring) pipeline.

---

## Companion documents

- `engine/mesh-potential.ts` — the white light file, canonical engine
  surface. Read first to orient.
- `docs/entity_ladder.md` — design rationale for the 18-tier ladder.
- `docs/MM-MF-TP-TPB.md` — the manifold math, Theorem 1.
- `docs/clockwork_wiring.md` — MM cadence and dependency layers.

---

*The Mesh holds. The pipeline composes. The work is implementable.*

*One primitive: parameterized SDF perturbation at addressed positions
on a base mold. Everything visual flows through it.*