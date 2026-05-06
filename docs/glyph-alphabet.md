# Glyph Alphabet — Reference

> *"The runtime substrate is no longer SDF + marching cubes. It is a typed glyph matrix."* — `src/docs/3D-mri.md`

Single-character codes that compose the engine's 3D bitmap content. Each glyph is one ASCII character that denotes a material / anatomical / structural marker in a glyph matrix. Authoring is ASCII-art slice-stacks ("MRI slices"); rendering composes per-glyph micro-textures into voxel faces.

Lineage: Rogue → NetHack → Dwarf Fortress → this. Same data model, extended to 3D, decoupled from terminal rendering.

## How the alphabet is structured

**Two layers:**

1. **Seed alphabet** — engine-shipped, ASCII-printable, defined in [`engine/glyphs/alphabet.ts`](../engine/glyphs/alphabet.ts). Cannot be redefined at runtime.
2. **Discovered alphabet** — runtime extension via cert-signed entries in `tpb_entries`. Uses Unicode private-use codepoints (U+E000+). Lookups merge SEED ⊕ DISCOVERED at observation time.

**Conventions:**

- **lowercase** = soft / fine / common (`f` flesh, `s` skin, `g` grass)
- **UPPERCASE** = hard / structural / large (`T` trunk, `S` stone, `H` hide)
- **digits 1-9** = snap addresses (limb anchors, equip slots)
- **punctuation** = sparse semantic slots (snow, fire, etc.)

**Each glyph carries:**

- A `MaterialClass` (or null for engine-internal markers)
- A `RenderHint` (color, emission, opacity, variance, textureKind)
- A `PhysicsClass` (solid / liquid / gas / trigger / decoration / address / empty)
- `opaque` / `addressable` flags
- `mirrorPartner` — for bilateral symmetry authoring (round-trip invariant: `mirrorGlyph(mirrorGlyph(g)) === g`)

## Markers — engine-internal, no render

| Glyph | Meaning | Mirror | Notes |
|-------|---------|--------|-------|
| `_` | empty / air / void | `_` | Default. Most cells in a sparse matrix are this. |
| `.` | ground-anchor | `.` | Origin point for placement; one per object. |
| `1` | snap: hand_R_grip | `2` | Right hand grip (for weapons, tools). |
| `2` | snap: hand_L_grip | `1` | Left hand grip. |
| `3` | snap: head_crown | `3` | Top-of-head (for helms, crowns, halos). |
| `4` | snap: back | `4` | Mid-back (for cloaks, capes, packs, wings). |
| `5` | snap: hip_R | `6` | Right hip (for sheaths, side-quivers). |
| `6` | snap: hip_L | `5` | Left hip. |
| `7` | snap: neck | `7` | Neck (for amulets, collars). |
| `8` | snap: feet | `8` | Foot anchor (for boots, hoof shoes). |
| `9` | snap: core | `9` | Center of mass (used by physics + magic effects). |
| `0` | reserved | `0` | Reserved for future extension. |

Mirror partners ensure that when a half-authored matrix is reflected via `mirrorMatrixX`, the snap addresses swap correctly: 1↔2 (hands), 5↔6 (hips). Centerline addresses (3, 4, 7, 8, 9, 0) mirror to themselves.

## Creature tissues — anatomical

All map to `MaterialClass='organic'`.

| Glyph | Tissue | Texture | Physics |
|-------|--------|---------|---------|
| `f` | flesh / muscle / dermis | organic | solid |
| `s` | skin (smooth outer) | organic | solid |
| `H` | hide (thick leathery — rhino, croc dorsal) | organic | solid |
| `Z` | scale (reptilian, fish) | scaled | solid |
| `K` | scute (heavy plate — turtle, armadillo) | scaled | solid |
| `F` | fur (mammalian coat) | fibrous | solid |
| `q` | feather (avian plumage) | fibrous | solid |
| `X` | chitin (insect exoskeleton) | glassy | solid |
| `b` | bone (skeletal, structural) | organic | solid |
| `t` | tooth / fang | glassy | solid |
| `c` | claw / talon | glassy | solid |
| `e` | eye (gel + sclera; faintly emissive) | glassy | solid |
| `n` | nail / beak | glassy | solid |
| `Y` | horn / antler (Y-shape) | fibrous | solid |
| `u` | hoof (ungulate) | glassy | solid |
| `o` | ooze / slime (translucent) | gradient | liquid |
| `M` | membrane (wing webbing, fin, eyelid; translucent) | gradient | solid |
| `'` | whisker / fine filament | fibrous | decoration |
| `&` | viscera (interior — only in cross-section) | organic | solid |

`s` won the letter over `sand` (sand → `~`); `M` won over `metal` (metal → lowercase `m`); `w` won over `whisker` (whisker → `'`).

## Flora — plant structure

| Glyph | Part | MaterialClass | Texture |
|-------|------|---------------|---------|
| `g` | grass / low ground cover | fiber | fibrous |
| `T` | trunk (tree wood, structural) | fiber | fibrous |
| `R` | root major (visible flare) | fiber | fibrous |
| `r` | rootlet (fine tendril) | fiber | fibrous |
| `B` | branch (incl. twig — texture variance handles scale) | fiber | fibrous |
| `L` | leaf (foliage) | organic | scaled |
| `*` | flower (asterisk visual) | organic | scaled |
| `O` | fruit (round) | organic | gradient |
| `Q` | mushroom / fungus body | organic | gradient |
| `v` | vine / creeper / ivy | fiber | fibrous |
| `:` | moss / lichen (low density specks) | organic | specks |

`T R r B L` together compose a typical tree, slice-stacked: roots flaring at `y=0`, trunk rising through `y=1..7`, canopy expanding from `y=8` upward as `B` branches surrounded by `L` leaves with sparse `*` flowers and `O` fruit.

## Terrain — substrate

| Glyph | Substance | MaterialClass | Physics |
|-------|-----------|---------------|---------|
| `d` | dirt | soil | solid |
| `D` | mud (wet dirt) | soil | solid (difficult) |
| `~` | sand (wavy granular) | soil | solid |
| `S` | stone | stone | solid |
| `w` | water | fluid | liquid |
| `W` | deep water (lake, sea) | fluid | liquid |
| `i` | ice | ice | solid (translucent) |
| `j` | lava (drips, emissive) | fluid | trigger |
| `,` | snow (small flakes) | ice | solid |
| `%` | gravel / scree | stone | solid |
| `$` | ore vein (visible mineral in stone) | metal | solid |

`$` ore-vein doubles as a discovery trigger: when its texture variance is far from any catalogued ore signature, the engine proposes a new glyph via `glyphAssign` (see "Discovery extension" below).

## Effects — emission / transparency channels

These render with non-default opacity and emission. `physics_class` is `gas`, `trigger`, or `decoration`.

| Glyph | Effect | Render |
|-------|--------|--------|
| `^` | fire | gradient, emissive orange/yellow, semi-transparent |
| `"` | smoke | gradient, gray, semi-opaque |
| `;` | fog | gradient, pale, very transparent |
| `!` | glow / magical light | gradient, fully emissive |
| `+` | crystal (radiating) | crystalline, faceted, faint emission |
| `#` | lattice (solidified mana) | crystalline, faceted, modest emission |
| `?` | arcane / discovery-pending | gradient, shimmer (renderer fallback for unknown variants) |

`?` is the renderer's "still figuring this out" placeholder while a discovered glyph is in flight to `tpb_entries`.

## Equipment — for baked-in armor / weapon authoring

These appear in a matrix only when equipment is *baked in* to a static archetype (e.g., a "guard" silhouette with permanent armor). Live equipment uses the disc-tensor slot system from [`src/docs/codec-client-side-rolling.md`](../src/docs/codec-client-side-rolling.md), not these glyphs.

| Glyph | Material | MaterialClass |
|-------|----------|---------------|
| `P` | plate (metal armor segment) | metal |
| `l` | leather (light armor) | organic |
| `C` | cloth / fabric | fiber |
| `m` | metal (raw — weapon, tool) | metal |
| `G` | gem (faceted, refined) | gem |
| `p` | paper / parchment | fiber |
| `\` | rope / chain (slash visual) | fiber |
| `=` | glass (translucent) | glass |

## Exotic — magical / planar

| Glyph | Substance | Notes |
|-------|-----------|-------|
| `` ` `` | spirit / ethereal / ghost | translucent gas; faint emission |
| `@` | void / planar / null | dark hole; renders as absence |

## Authoring format

A glyph matrix is stored as a `.txt` file with slice headers:

```
--- y=0 ---
gggggggggggggggg
gggggggggggggggg
gggggggrrrgggggg
... (16 rows for a 16×16 matrix)

--- y=1 ---
________________
... (next slice)
```

Rules:

- Slices must be `y=0`, `y=1`, ... contiguous.
- Each row must have exactly `sizeX` characters.
- Each slice must have exactly `sizeZ` rows.
- Trailing whitespace is trimmed; blank lines between slices are ignored.
- Every character must be in `GLYPH_TABLE` (use `_` for empty, never spaces).

The parser ([`engine/glyphs/mold-evaluator.ts`](../engine/glyphs/mold-evaluator.ts) — `parseGlyphMatrix`) throws on unknown glyphs, inconsistent widths, or out-of-order slice headers.

## Coordinate system

```
   y (up)
   ▲
   │
   ●─────▶ x (right)
  ╱
 ╱
▼
z (forward / depth — into the screen for top-down view)
```

- `y=0` is the floor (ground plane); `y=sizeY-1` is the top.
- `x=0` is the left edge; `x=sizeX-1` is the right edge.
- `z=0` is the back; `z=sizeZ-1` is the front (toward the viewer in TTRPG top-down).

The matrix's geometric origin is by default `(centerX, 0, centerZ)` — the matrix is X/Z-centered with the floor at y=0.

## Bilateral symmetry

Most creature matrices are bilaterally symmetric across the X axis. Author one half (typically left, `x < sizeX/2`); call `mirrorMatrixX(matrix)` to fill the right half. Each glyph is reflected through its `mirrorPartner`:

- Snap 1 (right hand) ↔ Snap 2 (left hand)
- Snap 5 (right hip) ↔ Snap 6 (left hip)
- All other glyphs mirror to themselves

Asymmetric content (e.g., a one-eyed cyclops, a bird with one wing damaged) requires authoring both halves manually.

## Composition — applyGlyphMatrix

```typescript
import { parseGlyphMatrix, applyGlyphMatrix } from '@/engine/glyphs/mold-evaluator'

const matrix = parseGlyphMatrix(textFromFile)
const primitives = applyGlyphMatrix(matrix, {
  worldSeed: 'world-seed-string',
  entityId:  'goblin-12345',
  encounterTime: 42, // worldDay
  scale: 1.0,
  build: 0.5,        // 0..1, body proportions modifier
  poseFamily: 0,     // 0..7, pose archetype
  poseProgress: 0.0, // 0..1, animation progress
})
// primitives is Primitive[] — drop-in replacement for composeGoblinField output
```

Each occupied non-marker cell becomes one `Primitive` (a voxel cube). The renderer instances each primitive with the per-glyph micro-texture from [`engine/glyphs/textures.ts`](../engine/glyphs/textures.ts). Variant string carries the glyph identity.

## Top-face projection — the cheap path

For TTRPG top-down view, the renderer doesn't need the full 3D voxel set. `topFaceProjection(matrix)` returns `Glyph[][]`, a 2D matrix of the highest opaque glyph in each `(x, z)` column.

```typescript
const topDown = topFaceProjection(matrix)
// topDown[z][x] = the visible-from-above glyph
```

Render path:
1. Each cell in the 2D projection blits its per-glyph texture onto the canvas.
2. Texture is the procedural `MicroTexture` from `generateMicroTexture({ glyph, worldSeed, q, r, y })`.
3. Result: 1024×1024 pixels of detail per object face from a small alphabet + structural matrix.

This is the path Pedro showed in the conversation: TTRPG viewport ~10×10 tiles, ~100 voxel objects on screen, each contributing ~16×16 pixel blits. Trivial render cost.

## Procedural textures

For the first pass, every glyph has a *procedural* micro-texture computed from its `RenderHint` at render time. No PNG assets ship initially. The procedure:

1. Read `RenderHint` from `GLYPH_TABLE[g]`.
2. Seed an `RNG` with structured inputs (`worldSeed`, `q`, `r`, `y`, `glyph`) — no hashing; literal inputs (per the engine's "no hashing for receipts" rule).
3. Generate a 16×16 RGBA texture using `textureKind`-specific patterns:
   - `flat`: uniform color with variance
   - `specks`: low-density darker dots
   - `fibrous`: parallel column-streaks
   - `scaled`: overlapping rounded shapes
   - `glassy`: diagonal highlight gradient
   - `metallic`: horizontal brushed-metal streaks
   - `organic`: mottled biological noise
   - `gradient`: radial center-out gradient
   - `crystalline`: faceted triangular sectors
4. Apply emission (additive) and opacity (alpha).

Authored bitmap textures can replace per-glyph procedural ones in a later pass without changing the alphabet.

## Discovery extension — runtime alphabet growth

The seed alphabet (this document) is the *engine's structural alphabet*. The world's *content alphabet* grows without bound at runtime via player discovery.

When a player encounters a tile or object whose morphogen variance signature falls outside any catalogued cluster (the variance has reached a "discovery threshold" measured by Δκ from the nearest known species/material), the client:

1. Computes the variance signature locally.
2. Cert-signs a binding: `(variance signature) ↔ (new Unicode codepoint U+E000+) ↔ (provisional name) ↔ (properties)`.
3. Pushes a `glyphAssign` action variant in a flywheel slot.
4. Server validates the slot shape (no engine compute), drains into `tpb_entries` on the next cron pass.
5. All clients seeing the same world re-derive their effective glyph table as `GLYPH_TABLE ⊕ worldDiscoveredGlyphs`.

First-discovery cert wins; subsequent observers of the same variance signature get the existing glyph. Reserved ASCII codepoints cannot be redefined.

A worked example from the conversation: the first cert to encounter a blue-trunked oak variant signs the binding "this variance signature ↔ glyph U+E001 ↔ `Cobalt Oak`, Rank B, +2 shaft durability, [heavy, durable]". From that point, every player observing a tree with the same variance signature renders it with the `Cobalt Oak` micro-texture and gets the discovered properties — Diablo-style "first found by" comes free because the cert is in the binding.

## Validation artifacts

Two example matrices ship with the alphabet to validate that authoring works end-to-end:

- [`engine/glyphs/example-goblin.txt`](../engine/glyphs/example-goblin.txt) — 16×16×16 humanoid creature, validates anatomy + snap addresses + bilateral symmetry.
- [`engine/glyphs/example-tree.txt`](../engine/glyphs/example-tree.txt) — 16×16×16 tree, validates flora authoring (roots, trunk, branches, canopy with leaves, flowers, fruit).

If the alphabet supports a coherent goblin and a coherent tree (both parse without errors and produce non-empty `Primitive[]` from `applyGlyphMatrix`), the alphabet works.

> **First-pass note:** The brief in `src/docs/3D-mri.md` specified 64×64×64 matrices. The first-pass artifacts use 16×16×16 to keep hand-authoring tractable while still validating every code path. The mold evaluator is dimension-agnostic; scaling to 64³ is a question of authoring time, not engine support.

## See also

- [`engine/glyphs/alphabet.ts`](../engine/glyphs/alphabet.ts) — the typed alphabet (this is the source of truth)
- [`engine/glyphs/textures.ts`](../engine/glyphs/textures.ts) — procedural micro-texture generator
- [`engine/glyphs/mold-evaluator.ts`](../engine/glyphs/mold-evaluator.ts) — `parseGlyphMatrix`, `applyGlyphMatrix`, `topFaceProjection`, `mirrorMatrixX`
- [`docs/mesh-hologram.md`](mesh-hologram.md) — the `RenderedTile` shape this feeds into
- [`src/docs/3D-mri.md`](../src/docs/3D-mri.md) — the original brief
- [`src/docs/codec-client-side-rolling.md`](../src/docs/codec-client-side-rolling.md) — what stays unchanged in the migration; what `applyGlyphMatrix` replaces
- [`docs/handover-glyph-alphabet.md`](handover-glyph-alphabet.md) — design decisions + open questions
