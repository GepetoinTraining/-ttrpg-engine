---
name: Build log v1 — state at end of conversation 1
description: Comprehensive snapshot of what's built, what's wired live, and what's still wireframe. Read this first in a new conversation.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
This is the state of the ttrpg-engine project as of 2026-04-29, end of the first long collaboration session. Built across multiple Claude Design handoffs (#1 through #4) plus engine bridges. Read this first.

## Stack

- **Next.js 16.1.6** (App Router, React 19, Turbopack), TypeScript strict.
- **Drizzle + libsql** (`local.db`), 131-table schema at `src/db/schema.ts`.
- **Engine** at `engine/*.ts` — ~50 plain-TS classes (MM/MF/TP/TPB), in-memory only.
- **Auth** at `src/auth/*` — topology auth (φ/ζ/M^n math), browser-safe pure math, server functions for enroll/verify.
- **Game helpers** at `src/game/*` — biome/hex/world/chargen.

CLAUDE.md is partially stale (still references deleted bend/ + fend/ trees). Live structure is `src/app/` (Next.js) + `engine/` + `src/{auth,db,game}` + `src/lib/` + `src/components/`.

## What's in the app

- **34 design surfaces** (00–33) ported from 4 successive Claude Design handoffs into `src/components/design/surfaces/*.tsx`. Sidebar lists all 34.
- **30 API route handlers** under `src/app/api/`.
- **Browser libs** under `src/lib/` — auth, campaign, character, companion, dice, narrative, reputation, world, world-detail, character-import.
- **Dungeon primitives module** at `src/lib/dungeon/` + `src/components/design/dungeon/` — tile/edge/door/object/hazard/spawn/light/token types, 53-texture catalog (CSS gradients, no asset files), `<DungeonGrid>`, `<Chip>` (token + portrait slot).

## Surfaces — wired vs wireframe

### Wired with live engine reach (write or read against DB)
- 01 **Auth** — full lifecycle: invite token redeem → cert in localStorage → challenge → trajectory verify. Writes `users`, `auth_enrollments`, `auth_challenges`. End-to-end smoke-tested.
- 12 **Onboarding (DM)** — captures geo, creates campaign (writes `parties` + `adventures` + `campaigns` + `play_mode_configs` + `simulation_depth` + `gm_profile_overrides`), invites players via `/api/campaign/[id]/invite`.
- 12 **Onboarding (Player)** — reads campaign id from URL, saves prefs to localStorage `claudedm:player-prefs:<cid>`.
- 13 **Chargen** — 9-step stepper. Step `00 · Import` accepts D&D Beyond PDF and pre-fills draft (smoke-tested with Aiji Kazuya). Race / class / abilities click-to-update. Review commits to `characters` + `character_classes` + `character_abilities` + `character_saves` + `character_skills` + `character_persona` (+ optional `players` row). `skipRacialBonus` flag for imports.
- 14 **Sheet** — loads `/api/character/[id]`, renders abilities / saves / skills / combat block from server-derived data (proficiency by level, AC = 10 + DEX, init = DEX, all 18 skill bonuses computed). Empty state shows character picker.
- 15 **Combat** — `LiveRollWidget` strip at top: clickable buttons fire d20 / attack vs DC / DEX save / damage / sneak attack via `/api/sim/roll` → `engine/mf-dice.ts` → `dice_receipts` (includes natural20/1, verified flag).
- 16–32 **Phase 2 + 3 surfaces** (Settlement, Roster, SceneEditor, Recap, Markets, Reputation, Calendar, TPEditor, Lore, Spells, Weather, Quests, Companions, Diplomacy, Warfare, Attunement) — all have a "live engine strip" at top showing real DB state from their endpoint. Most are read-only; Reputation has a working POST that applies the party-dampening math.

### Live API endpoints (30)
auth/{enroll/{request,approve},challenge,verify} ·
campaign/{create, [id]/invite} ·
character/{create, list, [id], [id]/spells, [id]/attunement, import} ·
companion/list ·
settlement/{list, [id]} ·
npc/{list, [id]} ·
market/[settlementId] ·
reputation/{character/[id], delta} ·
tp/tree ·
tpb/list ·
wiki/list ·
quest/list ·
scene/list ·
diplomacy/list ·
army/list ·
world/{calendar, weather} ·
sim/roll

### Wireframe-only (no live state — visual catalogs)
- 00 Sitemap, 02 DMConsole (most of it; AI panel not wired), 03 Player (most of it), 04 Cards, 05 Group, 06 Villain, 07 Table, 08 Locations, 09 Rumors, 10 Oneshot, 11 InlineCards (interactive in component state but not persisted), 26 Dungeon (deferred per user — encounter builder needs design), 33 Modals (catalog only — the 22 modal variants are NOT triggered from the parent surfaces yet).

## Schema additions made
- `character_persona(id, characterId, field, value, ord)` — backstory/ideals/bonds/flaws/allies/notes/appearance/faith. Persona is a polymorphic field-value table.
- `reputations(id, subjectType, subjectId, factionId, score)` — polymorphic per-subject (character | party) per-faction score.
- `reputation_deltas(id, subjectType, subjectId, factionId, baseDelta, appliedDelta, reason, worldDay, appliedAt)` — audit log including base + applied (party-dampened).

Pushed to `local.db` via drizzle-kit push.

## Reputation math (live)

`dampen(p) = 1 - |p|/200`. Range [0.5, 1.0] across party rep -100..+100. PC delta = base × dampen(party.score). Smoke-tested: party at +60, PC base +30 → applied +21, new=21.

## Texture catalog

53 kinds × 11 categories — `dungeon · earth · water · outdoor · urban · interior · metal · ruin · underdark · planar · special`. Each entry has CSS gradient pattern + baseColor + tags + `promptSeed` for future image gen. Renders 100% client-side. `Texture.imageUrl` is optional override slot for Gemini Nano Banana output later.

## Dungeon primitives

`src/lib/dungeon/types.ts` — `Tile · Edge · Door · DungeonObject · Hazard · Spawn · LightSource · Annotation · Token · DungeonLevel · Dungeon`. CellCoord `{q,r}`, 5ft cells, CELL_PX_DEFAULT=56.

`src/components/design/dungeon/primitives.tsx` — `<Texture> <Tile> <Edge> <Door> <DungeonObjectGlyph> <HazardMark> <SpawnMark> <LightHalo> <TexturePicker>`. Unicode glyph fallback for objects/hazards; sprite override slot ready (`iconUrl?` to add when SVGs land).

`src/components/design/dungeon/Chip.tsx` — token primitive: ring frame (4 styles: plain/iron/magical/laurel) + tone color + portrait slot + radial HP arc + status markers. **Tokens are chip + portrait, NOT sprites** (per-user decision). Portrait fills via `token.portraitUrl` (Gemini-generated at runtime); fallback shows initial letter.

`src/components/design/dungeon/DungeonGrid.tsx` — composes everything; `exampleDungeonLevel()` fixture has 5 demo tokens (Kaelith, Doruk concentrating, two goblins one bloodied, Selvys boss).

## D&D Beyond importer

`src/lib/character-import.ts` — form-field parser via `pdfjs-dist@5.7.284` legacy build. Anchors on AcroForm field names (`CharacterName`, `CLASS  LEVEL` (note double-space), `RACE`, etc.). Spell levels assigned by Y-rect ordering (PDF coords are bottom-up). `next.config.ts` adds `serverExternalPackages: ['pdfjs-dist']` so Turbopack doesn't break the worker.

Tested against Aiji Kazuya (Wizard 12 High Elf): all extracted including 23 spells across 5 levels, 5 skill profs incl. expertise, weapons/tools/languages, 11 equipment items, 24 persona entries.

## Memory files (read in this order in a new conversation)

1. **MEMORY.md** — index
2. **project_build_log_v1.md** — this file (read first)
3. **project_persistence_gap.md** — the engine↔DB bridge reality (now mostly closed but informative)
4. **project_claudemd_drift.md** — CLAUDE.md is stale; here's what's actually live
5. **project_tier1_wiring.md** + **project_phase2_wiring.md** + **project_phase3_wiring.md** — chronology of wiring waves
6. **project_reputation_model.md** — party-damps-PC rule, decision is live
7. **project_warfare_model.md** — siege resolver spec, parked for later
8. **project_dungeon_primitives.md** + **project_importer_and_textures.md** + **project_sprite_spec.md** — dungeon module + sprite spec
9. **project_design_handoff.md** + **project_frontend_collab.md** — collaboration context
