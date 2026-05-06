# Glyph Mapping — First Implementation

You're picking up a 3D engine architecture decision made in conversation
last night. Walk these files in order before touching any code:

1. `docs/mesh-content-pipeline.md` — the canonical Mesh architecture.
   Read all 18 layers. Note especially: addressed perturbations,
   wedge tensor, catalog/mold pattern, TPB chain, IndexedDB cache.
2. `engine/mesh-potential.ts` — the engine surface. Don't modify yet.
3. `docs/entity_ladder.md` — the 18-tier ladder rationale.

## What changed since the Mesh doc was written

The runtime substrate is no longer SDF + marching cubes. It is a
**typed glyph matrix**: a 3D grid of single-character cells, each
character denoting a material or structural marker. Authoring is
ASCII-art slice-stacks, like an MRI of imaginary anatomy.

Reasoning, briefly:
- 64×64×64 per object = 32 KB uncompressed, ~5 KB RLE
- Operations are matrix ops (Boolean, mirror, translate) — cheap, exact
- Authoring is human-readable: each y-slice is a 64×64 ASCII grid
- Server pre-renders the matrix to a bitmap; client receives PNG/WebP
- IndexedDB caches bitmaps client-side, keyed by (matrix_hash, view, version)
- Lineage: Rogue → NetHack → Dwarf Fortress → this. Same data model,
  extended to 3D, decoupled from terminal rendering.

The Mesh's architectural claims still hold (one primitive, addressed
perturbations, catalog pattern, deterministic regeneration). The
substrate is now glyphs instead of SDFs.

## Your task

Produce **the glyph alphabet** as a typed, documented, expandable
specification. This is the dictionary the engine will use forever.
Get it right; it constrains everything downstream.

### Deliverables

1. `engine/glyphs/alphabet.ts` — TypeScript module exporting:
   - `Glyph` type: single-character string literal union of all
     reserved glyphs
   - `GlyphMaterial` interface: `{ glyph, name, category, render_hint,
     physics_class, opaque, addressable }`
   - `GLYPH_TABLE`: const record mapping each glyph to its material
   - Helper functions: `isOccupied(g)`, `isAddress(g)`, `isLateral(g)`,
     `mirrorGlyph(g)` (for symmetric authoring)

2. `docs/glyph-alphabet.md` — human-readable reference:
   - The full alphabet, organized by category
   - One paragraph per glyph: what it represents, when to use,
     visual rendering plan, physics behavior
   - The expansion mechanism: how a campaign declares custom glyphs
     in a header without conflicting with reserved ones
   - Conflict resolution rules (e.g., `s` was both "scale" and "stone";
     pick one, document why, map the other)

3. `engine/glyphs/example-creature.txt` — a 64×64×64 goblin authored
   as 64 ASCII slices, separated by `--- y=N ---` headers. This is
   the validation artifact: if you can author a coherent goblin with
   this alphabet, the alphabet works. If you can't, the alphabet has
   gaps and you must document them in a `docs/glyph-gaps.md` file
   for human review.

### Categories to cover

- **Surface materials** (creatures): flesh, fur, scale, scute, hoof,
  claw, bone, tooth, eye, membrane, ooze
- **Equipment materials**: plate, leather, cloth, wood, metal, gem
- **Terrain materials**: grass, dirt, stone, water, snow, sand, ice,
  lava, brush, mud, road
- **Structural materials**: wall-stone, wall-wood, floor-tile, glass,
  thatch
- **Effects/magic**: glow-emissive, smoke, fire, frost (these may
  need a render-time channel rather than a glyph; document the
  decision either way)
- **Structural markers** (don't render, engine reads):
  - `_` empty
  - `.` ground-anchor
  - `1`–`9` snap addresses (1=hand_R_grip, 2=hand_L_grip, 3=head_crown,
    4=back, 5=hip_R, 6=hip_L, 7=neck, 8=feet, 9=core)
  - lateral-symmetry markers (decide whether these are needed)

### Constraints

- Total reserved glyphs ≤ 50. Discipline matters; the alphabet must
  fit in a developer's working memory.
- Case-sensitive: `s` and `S` are different glyphs. Use this to extend
  capacity without bloating the visual character set.
- ASCII only for reserved glyphs. Unicode is reserved for campaign
  extensions via header declaration.
- Every glyph in `GLYPH_TABLE` must have a defined `render_hint`
  (color, shading style, transparency) and `physics_class` (solid,
  liquid, gas, trigger, decoration).
- The alphabet must round-trip: `mirrorGlyph(mirrorGlyph(g)) === g`
  for all `g`.

### Done means

- `npx tsc --noEmit` passes on the new module
- `engine/glyphs/example-creature.txt` exists and is internally
  consistent (no glyphs used that aren't in the table)
- `docs/glyph-alphabet.md` is publishable as the canonical reference
- A human can read your alphabet doc and author a new creature
  without further questions

### Out of scope (do not touch)

- The renderer (separate task)
- IndexedDB caching (separate task)
- The wedge tensor or TPB chain (already designed)
- Modifying `bend/src/` or the existing 2D engine
- Bitmap pre-rendering pipeline

When you finish, write a short `docs/handover-glyph-alphabet.md`
summarizing what you decided and why, including any open questions
flagged for Pedro to resolve.

Pedro and Claude (the conversation Claude) are working on a paper
in parallel. Don't ping for clarification on judgment calls; make
the call, document it, flag it in handover. The alphabet is yours
to design within these constraints.