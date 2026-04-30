---
name: Sprite spec for Claude Design (chip + portrait, props, frames)
description: SVG asset spec — chip frames + scene props. Monster/PC tokens are chip+portrait at runtime, not sprites.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
The sprite library Claude Design produces fits into the dungeon primitives system. Three layers:

1. **Chips** (the moveable token frame) — SVG ornament around a portrait slot.
2. **Portraits** (the face inside a chip) — generated at runtime by Gemini Nano Banana, NOT sprites.
3. **Scene props** (everything else on the floor) — SVG sprites: furniture, hazards, doors, lighting, decoration.

User decision (2026-04-29): "for player and monster Chip + portrait, let's not mess around with the thing that actually moves around right." → chip is structural, portrait is identity. Drop monsters/ and party/ from the sprite ask.

## Format spec

- **SVG**, viewBox `0 0 100 100`, square, top-down view.
- **Transparent background** (no rect fill).
- **Style**: ink-line art on paper, 2-unit stroke, hatch shading optional. Limit each sprite to 2–3 colors from the palette.
- **Palette**: ink `#1f1b16`, ink-2 `#4a4338`, paper `#f4efe4`, accent-red `#a8442a`, accent-blue `#3a5d7a`, accent-gold `#b08838`, accent-green `#4d6a3a`. Use `stroke="currentColor"` on tintable lines.
- **Naming**: lowercase kebab matching the type-system kind. Variants get `-N` suffix.
- **Folder**: `public/sprites/<group>/<kind>.svg` — `objects · hazards · doors · lighting · decoration · chip-frames`.
- **Variants**: 2–3 visual variations where it makes sense (chest carvings, statue poses, glyph styles).

## Chip frames (NEW — replaces monsters/ and party/)

The chip is rendered in code (`src/components/design/dungeon/Chip.tsx`) as inline SVG: a ring + tone color + portrait slot + HP arc + status markers. Frame ornament variants are loaded from this folder:

| Path | Variants | Notes |
|---|---|---|
| `chip-frames/plain.svg` | 1 | clean ring (default; the code already draws this inline if missing) |
| `chip-frames/iron.svg` | 1 | rivets at 6 positions (warriors, military) |
| `chip-frames/magical.svg` | 1 | runes around outer ring (casters, magical creatures) |
| `chip-frames/laurel.svg` | 1 | wreath / crown notch (bosses, nobility) |
| `chip-frames/wild.svg` | 1 (NEW suggestion) | thorny / branchy (beasts, druids) |
| `chip-frames/divine.svg` | 1 (NEW suggestion) | radiating sunburst (clerics, paladins, holy enemies) |
| `chip-frames/shadow.svg` | 1 (NEW suggestion) | smoke wisps (rogues, undead, shadow creatures) |

Each frame is a plain SVG ring at the perimeter (outer ~5% of the viewBox); the inner 90% is empty (portrait slot, drawn by the renderer). Code falls back to inline-drawn versions if the SVGs are missing — files are an upgrade, not a requirement.

## Portrait fallback (also NEW — single sprite)

`chip-frames/portrait-fallback.svg` — a generic anonymous-figure silhouette that sits inside a chip when no Gemini portrait is available yet. Shows a head-and-shoulders ink-line outline. Used while images load or when generation fails.

## Scene props — `objects/` (highest priority)

Static, top-down. Sit on a tile.

| Kind | Variants | Notes |
|---|---|---|
| `chest-closed` | 3 | small / medium / large |
| `chest-open` | 2 | mirrors chest-closed shape, lid up |
| `altar` | 2 | stone block + carved temple altar |
| `statue` | 3 | warrior / robed figure / animal |
| `pillar` | 2 | round + square |
| `table` | 3 | round / long / small square |
| `chair` | 2 | wooden + throne |
| `bed` | 2 | cot + four-poster |
| `bookshelf` | 2 | full + ransacked |
| `brazier-lit` | 2 | flame layer in red/gold |
| `brazier-cold` | 1 | unlit |
| `fountain` | 2 | round basin + tiered |
| `lever-up` | 1 | |
| `lever-down` | 1 | |
| `button` | 1 | |
| `rune` | 3 | three glyph styles, blue-tinted |
| `rubble` | 2 | stone pile + collapsed beam |
| `corpse` | 2 | humanoid + skeletal |
| `cage` | 1 | |
| `crate` | 2 | crate + barrel |

## `hazards/`

| Kind | Variants | Notes |
|---|---|---|
| `pressure-plate` | 1 | square outline + pressure-X |
| `tripwire` | 1 | thin diagonal line + pin |
| `dart-trap` | 1 | wall slit + small darts |
| `falling-block` | 1 | shadow under hanging stone |
| `pit-open` | 1 | dark hole, jagged edge |
| `spike-pit` | 1 | hole with red spikes |
| `arrow-slit` | 1 | wall opening |
| `glyph` | 3 | magical circle styles, red-tinted |
| `symbol` | 2 | runic symbols, gold-tinted |
| `gas` | 1 | greenish cloud |
| `fire-jet` | 1 | flame burst, red/gold |
| `ice-floor` | 1 | crystal pattern, blue-tinted |
| `web` | 1 | spiderweb |
| `illusion-floor` | 1 | dashed outline (faint) |

## `doors/`

| Kind | Variants | Notes |
|---|---|---|
| `door-wood` | 2 | closed + open |
| `door-iron` | 2 | closed + open |
| `door-secret` | 1 | dashed outline |
| `portcullis` | 1 | bars |
| `door-magical` | 1 | runed |

## `lighting/`

| Kind | Variants | Notes |
|---|---|---|
| `torch` | 2 | wall sconce + handheld |
| `candle` | 1 | |
| `lantern` | 1 | |
| `magical-orb` | 1 | floating sphere, blue glow |
| `sunshaft` | 1 | beam from above (cone) |

## `decoration/` (low priority)

| Kind | Variants | Notes |
|---|---|---|
| `mushroom` | 2 | edible + glowing |
| `crystal-cluster` | 2 | blue + purple |
| `bones` | 1 | scattered |
| `rug-pattern` | 2 | small ornaments |
| `flower-patch` | 2 | wildflowers (outdoor) |
| `tree-stump` | 1 | |
| `sign-post` | 1 | |
| `cobweb` | 1 | corner web |

## Total ask: ~70 SVGs across 6 folders

(Down from the original ~110 because monsters/ + party/ moved to chip+portrait.)

**Highest-leverage subset (~36 SVGs unblocks 90% of dungeon scenes):**
- Chip frames (4 core: plain/iron/magical/laurel) + portrait-fallback = 5
- Objects: chest, table, bookshelf, brazier, statue, pillar, altar, cage, crate, corpse = ~22
- Hazards: pit, spike-pit, glyph, pressure-plate = 6
- Doors: wood, iron, secret = 3

## What I'll wire on receipt

1. `src/lib/dungeon/sprites.ts` — registry mapping `ObjectKind`/`HazardKind`/`DoorState`/etc. → sprite paths with variant rotation.
2. Extend `<DungeonObjectGlyph>`, `<HazardMark>`, `<Door>` with `iconUrl?` props; when set, render `<image>` instead of unicode glyph.
3. Extend `<Chip>` to load frame ornaments from `public/sprites/chip-frames/<frame>.svg` when available; fall back to inline frame draws.
4. The portrait pipeline (Gemini Nano Banana) is separate — it writes to `token.portraitUrl` at runtime, no sprite required.
