---
name: Dungeon primitives shipped (foundation for the encounter builder)
description: Type system + texture catalog + React primitive components for the dungeon editor / runner. Image hooks ready for Gemini and SVG-skill.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
Shipped the dungeon primitives module on 2026-04-29 so the encounter builder can be authored in parallel with the actual surface design.

**Files:**
- `src/lib/dungeon/types.ts` — full schema: `Tile`, `Edge`, `Door`, `DungeonObject`, `Hazard`, `Spawn`, `LightSource`, `Annotation`, `DungeonLevel`, `Dungeon`. CellCoord uses {q,r}; CELL_FT=5; CELL_PX_DEFAULT=56.
- `src/lib/dungeon/textures.ts` — 19 named textures (stone-smooth/rough/mossy/cracked, wood-plank/charred, earth, mud, water still/flowing/deep, grass, sand, metal-grate/plate, lava, void, cloth-rug, tile-mosaic). Each entry has CSS pattern + baseColor + tags + a `promptSeed` for image generation later.
- `src/components/design/dungeon/primitives.tsx` — `<Texture>`, `<Tile>`, `<Edge>`, `<Door>`, `<DungeonObjectGlyph>`, `<HazardMark>`, `<SpawnMark>`, `<LightHalo>`, `<TexturePicker>`. All SVG-friendly (Tile uses foreignObject for the CSS texture).
- `src/components/design/dungeon/DungeonGrid.tsx` — composes everything into a single SVG board; `exampleDungeonLevel()` is a tiny 4×3 fixture with a chest, pit, goblin ambush spawn, torch.
- A live preview strip is embedded in `surfaces/Dungeon.tsx` so the existing wireframe demoes the primitives; the rest of the surface stays static (encounter builder UI deferred per user).

**Image hook contract (for Gemini Nano Banana / SVG-skill):**
- Texture has optional `imageUrl`. When set, `<Texture>` renders `center/cover url(imageUrl)` over the baseColor instead of the CSS pattern. Generation pipeline: pick a `TextureKind` → grab `promptSeed` from `TEXTURES[kind]` → call Gemini → write the resulting URL into `texture.imageUrl`.
- DungeonObjectGlyph could be extended to take `iconUrl?` and use it instead of the unicode glyph — small follow-up when SVG-skill is wired.
- Spawn has `templateRef` pointing at monster_catalog; the *portrait* could come from Gemini per template.

**Why:** User asked for the primitives in parallel with the encounter-builder design conversation: "give me the primitive for building the environment and creating the encounters you need from claude code, we can also make an API call to gemini with nano banana (for actual portrait and images) and svg can be done via a skill, but the basic textures and the basic primitives we'll need now."

**How to apply:**
- Build the editor surface ON TOP of these primitives — never duplicate the geometry / texture math.
- New textures: append to `TEXTURES` in `textures.ts`, add the kind to the `TextureKind` union in `types.ts`. Pickers update automatically.
- New hazard / object kinds: extend the corresponding type union AND the glyph map in primitives.tsx.
- The editor UI should be a small wrapper around `<DungeonGrid>` that catches `onTile` and lets the DM swap the tile's texture / drop hazards / paint walls. Editor state can shape-match `DungeonLevel` exactly so save/load is a single JSON write.
- Persistence is NOT yet schema-bound. `dungeon_rooms` exists but is too thin. Adding `dungeon_levels` (JSON blob of the level shape) is the lightest first move; richer normalization can come later. Don't normalize until the editor proves out the shape.
- Image generation is plug-in. Don't bind the editor to a specific provider — accept `imageUrl` from anywhere.
