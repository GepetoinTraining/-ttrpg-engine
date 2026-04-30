---
name: D&D Beyond importer + expanded texture catalog
description: PDF importer wired end-to-end (Chargen tab + endpoint + parser). Texture catalog expanded from 19 to 53 with categories.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
Both pieces shipped on 2026-04-29.

## Importer

**Files:**
- `src/lib/character-import.ts` — form-field parser using `pdfjs-dist@5.7.284` legacy build. D&D Beyond exports values via AcroForm fields (`CharacterName`, `CLASS  LEVEL` (note double-space), `RACE`, etc.) — text extraction returns mostly labels.
- `src/app/api/character/import/route.ts` — POST multipart, returns ImportedCharacter JSON. `runtime = 'nodejs'`.
- `next.config.ts` — added `serverExternalPackages: ['pdfjs-dist']` so Turbopack doesn't bundle/break the worker.
- `src/db/schema.ts` — new `character_persona` table (polymorphic field/value with ord). Pushed to local.db.
- Extended `/api/character/create` with: `level`, `hpMax`, `hpCurrent`, `saveProficiencies`, `skills` (label-keyed), `persona`, `skipRacialBonus`. The flag matters: imported scores are POST-racial, so we MUST skip applying racial bonuses again.
- `src/components/design/surfaces/Chargen.tsx` — new step `00 · Import` with drag-drop file upload. Pre-fills draft. Imported characters commit with `skipRacialBonus: true` and the PDF's HP.

**Smoke-test result against Aiji Kazuya (Wizard 12 High Elf):** all extracted: name, class+level, race+subrace, background, ability scores (post-racial), save profs (INT, WIS), 5 skill profs incl. Arcana/Investigation expertise, weapons/tools/languages, 11 equipment items + 1 attuned, 23 spells across 5 levels, 24 persona entries (personality/ideal/bond/flaw/ally/backstory/note). Final commit: HP=34 (from PDF), DEX=10 (no double racial), all rows persisted to characters/character_classes/character_abilities/character_saves/character_skills/character_persona.

**Why:** First Tier-1 surface that wasn't in the original handoff and unlocks "play with my real D&D Beyond character" — no manual re-entry.

**Gotchas:**
- pdfjs-dist v5 needs `serverExternalPackages` in next.config.ts. Without it, Turbopack relocates pdf.worker.mjs and the legacy build can't find it. The `disableWorker` option (which used to work) is gone.
- D&D Beyond's field name `CLASS  LEVEL` has a DOUBLE SPACE. The parser checks both `CLASS  LEVEL` and `CLASS LEVEL`.
- D&D Beyond's currency field labels (`CP`, `SP`, `EP`, `GP`, `PP`) don't actually map cleanly to coin types — Aiji's CP=600 is gp, GP=132 is cp visually. Importer preserves the field-name mapping; the review UI lets users fix labels.
- Form fields are duplicated across pages (CharacterName2/3/4) for the page header — `fieldMap()` keeps only the first occurrence.
- Spell levels assigned by Y-rect comparison (PDF coords are bottom-up; nearest header *above* a spell name = its level).

## Texture catalog (53 kinds, 11 categories)

`src/lib/dungeon/textures.ts` — went from 19 to 53 kinds. Categories with picker grouping:

- **dungeon** (6): stone-smooth/rough/mossy/cracked, wood-plank/charred
- **earth** (5): earth-packed, mud, gravel, scree, ash
- **water** (5): water-still/flowing/deep, sea-foam, wet-sand
- **outdoor** (9): grass, forest-leaf, pine-needle, jungle-floor, marsh, snow, ice, sand, dunes
- **urban** (8): cobblestone, brick-red, brick-tan, paved-road, sewer-tile, slate-roof, tile-clay-roof, market-canvas
- **interior** (6): marble-white, marble-black, parquet, cloth-rug, tile-mosaic, hearth-stone
- **metal** (2): metal-grate, metal-plate
- **ruin** (2): overgrown-stone, collapsed-floor
- **underdark** (2): glowing-fungus, drow-tile
- **planar** (8): arcane-circle, glyph-floor, ley-line, ethereal-mist, fire-plane, lava, void, star-field
- **special** (2): blood-pool, frost-cracked

Each entry has `category`, `tags`, `promptSeed` (for image gen). `<TexturePicker>` now groups by category. `texturesByCategory(cat)` helper filters.

**Why:** User: "we need the encounter textures to have outdoors, city.... all of those!" — opens the door for AI-spec'd environments (Claude DMing alone) where the JSON output picks from any of these.

**How to apply:**
- Add a texture: append to `TEXTURES`, add the kind to `TextureKind` union, pickers update automatically.
- Image override is per-Texture (`imageUrl`); when Gemini lands, generate per-kind via `promptSeed` and write the URL into the level data.
- The encounter builder will lean on this catalog when AI emits scene JSON — the AI picks a `TextureKind` per cell, the renderer fills in.
