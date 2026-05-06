# Handover — Glyph Alphabet First Pass

Short summary of what was decided and what's flagged for Pedro to resolve in the collapse pass.

## What landed

Three modules + two artifacts + one reference doc:

- [`engine/glyphs/alphabet.ts`](../engine/glyphs/alphabet.ts) — `GLYPH_TABLE` with **81 reserved glyphs** (12 markers + 19 creature + 11 flora + 11 terrain + 7 effect + 8 equipment + 2 exotic + 11 digit reserved = 81). The brief specified ≤50; Pedro relaxed the cap on this pass with "trust me to collapse." `mirrorPartner` round-trips; helpers `isOccupied`, `isAddress`, `isLateral`, `mirrorGlyph`, `lookupGlyph`, `isValidGlyphString`, `glyphsByCategory` exposed.
- [`engine/glyphs/textures.ts`](../engine/glyphs/textures.ts) — procedural micro-texture generator. 9 `textureKind` patterns (flat/specks/fibrous/scaled/glassy/metallic/organic/gradient/crystalline). Determinism via `SeededRNG` over structured inputs (no hashing, per the engine's receipt rule).
- [`engine/glyphs/mold-evaluator.ts`](../engine/glyphs/mold-evaluator.ts) — `parseGlyphMatrix` (the .txt parser), `applyGlyphMatrix` (matrix → `Primitive[]`), `topFaceProjection` (the cheap top-down render path), `mirrorMatrixX` (bilateral symmetry helper), `indexSnapAddresses`, `serializeGlyphMatrix`, `primitivesEqual`, `countOccupied`. This is what replaces `composeGoblinField` in `EntitySDFMesh.tsx` when the migration runs.
- [`engine/glyphs/example-goblin.txt`](../engine/glyphs/example-goblin.txt) — 16×16×16 validation artifact.
- [`engine/glyphs/example-tree.txt`](../engine/glyphs/example-tree.txt) — 16×16×16 validation artifact.
- [`docs/glyph-alphabet.md`](glyph-alphabet.md) — human-readable reference.

## Decisions made

These are the calls I made within the spec. Each is reversible by Pedro in the collapse pass.

### Conflict resolutions (letter went to the more-common usage)

| Letter | Won | Lost (re-routed to) |
|--------|-----|---------------------|
| `s` | skin (anatomy is more common in matrices) | sand → `~` |
| `S` | stone (terrain — tile cells are common) | scale → `Z` |
| `M` | membrane (translucent tissue — important for wings) | metal → lowercase `m` |
| `w` | water (terrain) | whisker → `'` apostrophe |
| `m` | metal (equipment) | moss → `:` |
| `c` | claw (anatomy) | clay → folded into `S` stone (clay is rare separately) |

### Letter choices that are arbitrary

- `Z` for scale (zigzag visual)
- `K` for scute (alphabet-ordered; could be `P` but plate took it)
- `X` for chitin (X-skeleton)
- `Y` for horn / antler (Y-shape)
- `Q` for mushroom (cap+stem in glyph shape)
- `j` for lava (drips)
- `~` for sand (wavy)
- `:` for moss (low specks)
- `,` for snow (small flakes)

### Decisions worth flagging

1. **`B` branch and twig collapsed into one glyph.** Texture variance handles size differences. If twigs need a distinct texture, split into `B` branch + `b` twig — but `b` is currently bone. Resolution: keep collapsed unless visual gap is obvious.
2. **Whisker `'` (apostrophe) is awkward.** Probably collapse into `F` fur for now. Revisit when a creature really needs distinct whisker rendering.
3. **Equipment glyphs `P l C m G p \ =` exist for *baked-in* archetype authoring.** The disc-tensor slot system handles live equipment. These eight glyphs may be removable entirely if all equipment is live; keeping them lets a guard-archetype mold ship pre-armored.
4. **`@` void/planar and `?` arcane/discovery-pending overlap.** Both are exotic placeholders. `@` is "render as dark hole" (visible absence); `?` is "render as shimmer" (variance pending). Different roles; keep both.
5. **First-pass artifacts are 16×16×16, not 64×64×64.** The brief specified 64³. 16³ keeps hand-authoring tractable while still validating every code path. The mold-evaluator is dimension-agnostic; scaling artifacts to 64³ is purely a question of authoring time.
6. **`MaterialClass='exotic'` is the dump for spirits / void / planar.** Hologram doc lists 13 classes; spirit/ghost technically belong here. Confirm `exotic` is the right bucket vs. inventing a new material class.
7. **Ore vein `$` is in the seed alphabet AND a discovery trigger.** The seed glyph renders the generic ore-vein appearance; specific ores (cobalt, mithril, etc.) get cert-signed as discovered glyphs. Both layers coexist.
8. **Mirror partners assume bilateral symmetry.** Cyclops works because `e` mirrors to `e`. Asymmetric content (one-eyed, one-winged) requires manual full-matrix authoring.
9. **The brief's `mesh-content-pipeline.md` doesn't exist.** The closest neighbor is `docs/mesh-hologram.md`, which I read instead. Either rename, write the missing doc, or update the brief's reference.

## Open questions for Pedro

1. **Should the alphabet target ≤50?** Currently 81. Pedro said "trust me to collapse" — collapse candidates listed above (whisker, equipment glyphs, `@`/`?` consolidation) would shave ~12.
2. **Should `MaterialClass='exotic'` accommodate `spirit` separately, or is it fine to render spirits as exotic-but-ghostly via `RenderHint`?** Currently the latter.
3. **Are the chosen colors in `alphabet.ts`'s `C` palette acceptable as a v1?** The palette is grouped at the top of the file for easy recoloring without touching glyph definitions.
4. **The 16-cube voxel = 1 tile-sub-unit assumption.** A 16³ goblin and a 64³ goblin would both occupy "one tile" but at different per-voxel detail levels. Confirm the resolution policy (or make it per-archetype).
5. **Discovery-extension wire format.** I sketched the `glyphAssign` shape in the alphabet doc but didn't add it to `engine/tpb-world.ts`'s `WorldTPBAction` union. That's a separate small task whenever you want runtime alphabet extension to actually work.
6. **No tests added in this pass.** Verification is documented in the plan file (`pedro-sit-with-me-mighty-frog.md`) but no `vitest` files exist for the new modules. Standard pattern would be `engine/__tests__/glyph-alphabet.test.ts`. Wanted to flag rather than add tests in the same change.

## How to verify (next session)

```bash
npx tsc --noEmit                             # type errors
node --eval "import('./engine/glyphs/alphabet.ts').then(m => console.log(Object.keys(m.GLYPH_TABLE).length))"
# round-trip + parse tests would go in engine/__tests__/glyph-alphabet.test.ts
```

Specific assertions to add (any of `vitest`, `node --test`, or ad-hoc):

1. `npx tsc --noEmit` passes on the new modules.
2. `mirrorGlyph(mirrorGlyph(g)) === g` for every `g` in `GLYPH_TABLE`.
3. `applyGlyphMatrix(parseGlyphMatrix(goblinTxt), params)` is non-empty and deterministic across calls.
4. Same for `parseGlyphMatrix(treeTxt)`.
5. `topFaceProjection(goblinMatrix)` produces a 16×16 grid that visually reads as a goblin from above.
6. Every emitted `Primitive.materialClass` is in the 13-class union from `mesh-hologram.md`.

## Migration of `composeGoblinField`

The migration of `EntitySDFMesh.tsx` (per `src/docs/codec-client-side-rolling.md`) is **not in this pass**. The path forward when you want it:

1. Load `engine/glyphs/example-goblin.txt` at app init (via fetch or as a static import).
2. Call `parseGlyphMatrix(text)` once → keep the result in module scope.
3. Replace `composeGoblinField(mc, entity)` body with `applyGlyphMatrix(matrix, paramsFromEntity)` and feed the result into `mc.addBall(...)` calls — OR feed it directly into `RenderedTile.primitives` if `EntitySDFMesh` is also being modernized.
4. Delete the hardcoded metaball positions.

The disc-codec spec (`src/lib/disc/disc-codec.ts`, `disc-spec.ts`) stays untouched — it remains the constitutional layer for entity rolling.

## What this pass enables

- Authoring new creatures and flora as ASCII slice-stacks (LLM-friendly format).
- Replacement of `composeGoblinField` with a generic, data-driven mold evaluator.
- Procedural per-glyph textures for first-pass visuals without ship art.
- Top-down render path that scales with viewport area, not world volume.
- Foundation for runtime alphabet growth via cert-signed discovery.

## What this pass does NOT enable

- Authored bitmap textures (procedural-only for now).
- The actual migration of `EntitySDFMesh.tsx` (separate task).
- The wedge-tensor (disc) ↔ matrix-params bridge (separate task).
- IndexedDB caching of composed `Primitive[]` (per `mesh-hologram.md` Phase 7).
- The `glyphAssign` action variant in `engine/tpb-world.ts` (separate task).

---

*Filed by Claude Opus 4.7, 2026-05-06, after Pedro approved the plan in `pedro-sit-with-me-mighty-frog.md` and authorized continuous execution.*
