---
name: Build log v3 — cert hierarchy, IDB, grid, chargen, dice, dashboard
description: Snapshot of the long sprint that landed the account/character cert flow, the IDB layer, the square voxel grid (replacing hex), the polyhedral 3D dice, the world dashboard, the chargen rewrite (every step data-driven + DMless spell composer), and the equipment catalog. End-state captured at end of sprint 3.
type: project
---

**End-of-sprint snapshot.** This is what the codebase looks like after the third major sprint — pick up here in the next conversation. Read this BEFORE the older `project_build_log_v1.md` / `_v2.md` (they're historical now).

## Headline

- **91 test files, 1926 tests passing**, tsc clean.
- **Full DMless onboarding loop works end-to-end** — Pedro click-tested it: Auth → CreateAccount (geo+datetime) → CharacterSelect (persona picker) → Chargen (all 9 steps) → "log into world" → WorldDashboard with grid viewport.
- **Cert hierarchy is live**: account cert + character cert, both from `createSeedData(serverNow, geo)` topology math. Persona is fixed at character creation. Dual signatures attached but forensic-only (math is the gate).
- **Square voxel grid replaces hex**: `src/game/grid.ts` is the new source of truth (5ft × 8ⁿ scale). `src/game/hex.ts` is deleted; `biome.ts`, `edges.ts`, `world.ts` migrated; DB columns renamed `q/r → tile_x/tile_y` and `hex_occupancy → tile_occupancy`.
- **Polyhedral 3D dice**: `src/components/design/surfaces/Die.tsx` (Three.js, Roman numerals, Crag & Coin port) wraps with `DiceRoller.tsx` for 4d6-drop-one + standard-d20. Includes a static-face fallback after rolls land to keep WebGL context count under the browser cap.

## Architecture decisions that became load-bearing this sprint

1. **Account ↔ Character cert split** (`project_cert_hierarchy.md`) — one account, many characters, persona FIXED per cert at chargen.
2. **Dual signatures forensic, not gating** — math is the gate (Theorem 1 from `docs/MM-MF-TP-TPB.md`). Pedro: *"only when the math diverges, never when it agrees."*
3. **Client computes, server appends** — flywheel slot push pattern. The server's role is logging, the cron drains slots into `tpb_entries`. DM-led parties push bundles at session-end (worldline reconciliation per Pratchett).
4. **Observation-driven persistence** — world content from seed isn't stored; only deltas from interaction get registered.
5. **Persona is a character property, not a runtime toggle** — `personaType: 'player' | 'dm' | 'gm-ai' | 'dmless'` lives on the character cert, locked at chargen. DMless can't party with DM-led (time-flow incompatibility).

## What landed in this sprint

### Cert + auth (Slices 1-2)
- `engine/tp-write-capture.ts` — pulled `attachWriteLog` out of `src/lib/world-tpb.ts` so client + server share one impl. Pure compute (no DB).
- `src/lib/idb.ts` — native IndexedDB wrapper. Database `claudedm`, 7 stores (`accounts`, `characterCerts`, `characterTpb`, `flywheelSlot`, `partyMembers`, `sessionState`, `tradeLog`).
- `src/lib/account-cert.ts` — `createAccount(geo) | loadAccount() | clearAccount() | requestGeolocation() | checkGeoPermission() | createAccountManual(lat, lon)`.
- `src/lib/character-cert.ts` — `createCharacterCert | listCharacterCerts | attachCharacterData | setActiveCharacter | getActiveCharacterCert | clearActiveCharacter | deleteCharacterCert`.
- `src/db/schema.ts` — added `accounts`, `character_certs`, `character_trades`, `flywheel_slots` tables. Extended `parties` with `memberCertIdsJson` + `founderCertId` + `disbandedAt`. Renamed `worldRegions.q/r → tile_x/tile_y`, `creatures.hex_occupancy → tile_occupancy`.
- API routes:
  - `POST /api/account/create`
  - `POST /api/character-cert/create`
  - `POST /api/character/trade/initiate` + `accept`
- `Auth.tsx` — added `AuthAccountReady` view; the uninvited state has the new "create my account" flow with permission probe + manual coord fallback.
- New surface `CharacterSelect.tsx` (#character-select, slot 46) — persona picker, character cards, "complete chargen" + "log into world".

### Routing pass (Slice 3 — partial)
- `engine/tpb-world.ts` — added `characterTransfer` action variant.
- `src/lib/engine-client.ts` — browser engine adapter (`transport`, `observe`, `roll`, `applyIntent`, `push`, `hydrate`, `discardPending`). Buffers actions locally, posts solo bundles to `/api/world/slot/push`.
- `src/lib/use-world.ts` — React hook holding the engine-client instance + 5s log polling. Surfaces consume `useWorld()` instead of fetching directly.
- API routes:
  - `POST /api/world/slot/push` (Zod-validated discriminated union: solo OR dm-session)
  - `POST /api/cron/drain-slots` (hourly cron drains slots → tpb_entries in arrival order)
  - `GET /api/world/replay` (paginated log slice for hydration)
  - `GET /api/world/audit` (forensic verification — replays math + flags divergences; signatures only checked on divergence)
- `src/lib/audit.ts` — pure-function audit logic + 13 tests covering shape / ordering / party-position / characterTransfer invariants.
- `Play.tsx` refactored — uses `useWorld()` for transport when an IDB character is active; falls back to legacy `/api/world/transport` otherwise.
- `Actions.tsx` wired — slow-life intent chips fire `engineClient.applyIntent()` → push.
- `vercel.json` — added `/api/cron/drain-slots` schedule (hourly).

### Hex → square voxel migration (Slice 5)
- `src/game/grid.ts` — new module. 6 levels (combat 5ft → tactical 40ft → city 320ft → mapL1 → mapL2 → mapL3, each 8× the previous), 4/8 neighbors, Chebyshev/Manhattan/Euclidean/D&D-5e-diagonal distance, A* with configurable diagonal cost, Bresenham line, ring/spiral/block, Minecraft-style chunk keys.
- `src/game/__tests__/grid.test.ts` — 52 tests on the math.
- `biome.ts` rewritten: dropped `triangleHeights[6]` → `cornerHeights[4]` (TL/TR/BR/BL), square viewport iteration.
- `edges.ts` rewritten: `gridAStar` + 8-direction gates + grid coords throughout.
- `world.ts` rewritten: `getTileViewport`, `materializeTile`, `tileX/tileY` columns. Legacy aliases (`getHexViewport`, etc.) kept as trampolines.
- `src/game/hex.ts` **deleted** (orphan after migration).

### Grid renderer + Map surface
- `src/components/grid/GridViewport.tsx` — pure SVG renderer. Tiles colored by biome with elevation shading, rivers (blue polylines), roads (dashed beige), settlements (yellow circles + labels), party markers (red dots), tile-highlight outline. Compass legend in corner.
- `src/components/design/surfaces/Map.tsx` (#map, slot 47) — surface wrapping the renderer with zoom controls (6 levels), pan pad + WASD/arrows, layer toggles, render-quality sliders, tile inspector.
- `WorldStatus` API extended with `seed` so client computes biomes locally — zero round-trips per pan/zoom.

### World dashboard (Slice 4)
- `src/components/design/surfaces/WorldDashboard.tsx` (#world, slot 48) — full layout shell:
  - Left rail: character + persona + quick nav + sign-out
  - Center: GridViewport + zoom buttons
  - Right rail: tabbed drawers (Party / Quests / Log / Inventory / Cert sync)
  - Bottom: action bar (common + slow-life + DM-only chips) + pending count + push button
- `CharacterSelect`'s "log into world" now routes to `#world` (was `#play`).

### Chargen rewrite — every step data-driven
- `src/game/chargen.ts` rewrite — full SRD data:
  - **9 races** with description + traits + dynamic subraces (dragonborn has 10 ancestries; half-elf has standard/wood-descent/drow-descent; etc.)
  - **12 classes** with subclasses (8 wizard schools, 7 cleric domains, fighter Champion/Battle Master/Eldritch Knight, etc.) + skill choice pools
  - **13 backgrounds** with skills + tools + languages + equipment + feature
  - `findSubrace(raceKey, subraceName)` helper used by `/api/character/create` to combine race + subrace bonuses correctly.
- `Chargen.tsx` — every step rebound:
  - **StepRace**: iterates `RACES`, dynamic subrace section per chosen race, click-to-toggle, auto-pick first valid on race change.
  - **StepClass**: iterates `CLASSES`, dynamic subclass section showing unlock level (L1 cleric/sorcerer/warlock; L2 wizard/druid; L3 most others).
  - **StepAbilities**: 4 methods — point-buy with running 27/27, standard array with swap-on-pick dropdowns, **4d6-drop-one with the 3D dice**, Heroic 4d6 (reroll 1s + keep better). Per-slot reroll counts (max 2), per-slot **lock button**, **modal confirmation** before committing to rolling. Pool consumption — assigning a rolled value removes it from other ability dropdowns.
  - **StepSkills**: reads `CLASSES[k].skillChoices`, enforces the class's pick count, auto-applies background skill grants, shows live mods.
  - **StepBackground**: iterates BACKGROUND_LIST, full feature display, hook textarea + alignment dropdown.
  - **StepSpells (NEW)**: prime-element composer for DMless casters. Two `<SpellComposer>` panels (cantrip = Minor / first spell = Lesser). Element chips by category (damage / delivery / school / duration), live preview of seed/school/level via `engine/magic.ts` `composeSpell`/`getSpellSchool`/`calculateSpellLevel`. Spell name auto-generates ("Lesser Fire Bolt"), player can edit. Validates: needs delivery + effect (damage or school).
  - **StepEquipment**: class kit + background kit dynamic + new `<EquipmentCatalogBrowser />` (~95 SRD items, searchable, category-filtered, weapon/armor/pack details inline). V1 (sets) is the active path; V2 (roll gold + spend) hooks onto the same data.
  - **StepReview**: primary button now reads "log into world →" and routes to `#world`.

### Dice
- `src/components/dice/DiceRoller.tsx` — `<FourDSixDropOne>` and `<StandardD20>`, both backed by `mfDice` (so the receipt is correct per Theorem 1). Live 3D `<Die>` only while rolling; settled dice swap to a tan/Roman-numeral `<StaticDieFace>` to keep WebGL context count under the browser cap.
- `engine/__tests__/dice-distribution.test.ts` — empirical distribution sanity tests (chi-square uniformity on 60k d6, mean of 4d6-drop-lowest matches 12.244, P(>=16) matches 12.95%, seeded determinism). Locked into the suite so any future tampering with `mfDice` trips it.

### Pre-prod schema reshape pipeline (Slice 7)
- `scripts/db-nuke.ts` — drops every table (refuses non-local URLs without `ALLOW_DESTRUCTIVE_DB=1`).
- `src/db/seeds/bootstrap.ts` — minimal post-nuke seed (just the singleton `worlds` row).
- `scripts/db-seed.ts` — runs bootstrap.
- `package.json` — `db:nuke`, `db:seed`, `db:reset` scripts. `tsx` added as devDep.
- Pedro confirmed: NO migrations. Drop tables, push fresh, seed. We're pre-prod.

### CLAUDE.md rewrite
- Replaced the legacy Genesis/Vue content with the actual Next.js + cert + flywheel + DM-as-shard-host architecture. The old version had pointers at deleted `bend/` + `fend/` directories.

## Files added this sprint

```
engine/tp-write-capture.ts                            (Slice 1 prep)
engine/__tests__/dice-distribution.test.ts            (5 distribution tests)
src/lib/idb.ts                                        (IDB wrapper)
src/lib/account-cert.ts                               (account cert helpers)
src/lib/character-cert.ts                             (character cert + active session)
src/lib/audit.ts                                      (forensic audit)
src/lib/audit.test.ts                                 (13 tests)
src/lib/engine-client.ts                              (browser engine adapter)
src/lib/use-world.ts                                  (React hook)
src/lib/trade.ts                                      (browser trade helpers)
src/lib/party.ts                                      (cert-hash party helpers)
src/app/api/account/create/route.ts
src/app/api/character-cert/create/route.ts
src/app/api/world/slot/push/route.ts
src/app/api/world/replay/route.ts
src/app/api/world/audit/route.ts
src/app/api/cron/drain-slots/route.ts
src/app/api/character/trade/initiate/route.ts
src/app/api/character/trade/accept/route.ts
src/components/dice/DiceRoller.tsx                    (FourDSixDropOne + StandardD20 + StaticDieFace)
src/components/grid/GridViewport.tsx                  (square voxel SVG renderer)
src/components/design/surfaces/CharacterSelect.tsx    (#character-select, slot 46)
src/components/design/surfaces/Map.tsx                (#map, slot 47)
src/components/design/surfaces/WorldDashboard.tsx     (#world, slot 48)
src/game/grid.ts                                      (square voxel math)
src/game/__tests__/grid.test.ts                       (52 tests)
src/game/equipment.ts                                 (~95-item SRD catalog)
src/db/seeds/bootstrap.ts                             (post-nuke seed)
scripts/db-nuke.ts                                    (drop-everything script)
scripts/db-seed.ts                                    (seed runner)
docs/ui_elements_for_design.md                        (UI deliverable list — updated this sprint)
docs/memories/                                        (this folder — repo-local memory mirror)
```

## Files removed

```
src/game/hex.ts            (orphan after square migration)
```

## Sprint stats

- 90+ files touched
- ~3500 lines of new TS/TSX
- 70+ new tests (all green)
- 0 tsc errors maintained throughout
- Pedro click-tested the full flow Auth → CharacterSelect → Chargen → World end-to-end and confirmed it "feels good, legit good to use"

## What's NOT done (for next sprint)

| Slice | Remaining piece | Notes |
|---|---|---|
| 3 | Railgun spectrum bridge | Currently using 5s polling on `/api/world/log`. Real-time bridge per `docs/railgun-bridge.md` is the v2 transport. |
| 3 | Retire `/api/world/transport` | Legacy fallback path in Play.tsx; keep until all flows verified through new cert flow. |
| 4 | WorldDashboard polish | Dropdowns + drawers are functional but stub-ish. Specific items in `ui_elements_for_design.md`. |
| 5 | Renderer perf tuning | SVG handles ~441 tiles fine; canvas/WebGL renderer for very large views. |
| 6 | Trade UI modals | Endpoints + lib in place, surfaces (M04-M07 from UI list) need design. |
| 6 | Party invite UX | `partyMembers` IDB store + cert-hash parser ready; just needs M08-M11 modals. |
| 7 | Audit surface | `/api/world/audit` works; needs a UI to display divergences. |
| Chargen | Equipment V2 (gold + buy) | Catalog data is ready; just need cart UI + gold-balance state. |
| Chargen | AI homebrew composer | New races/classes/backgrounds via Sonnet conversation. Pedro deferred until base chargen feels right. |
| Persistence | Extend SessionContext to expose IDB account/character | Currently surfaces use `useWorld()` directly. SessionContext still localStorage-only. |
| DB | Run the nuke + seed pipeline against prod-ready schema | Drafted but not executed. |

## State of mind for the next pass

The flow Pedro keeps testing — Auth → CharacterSelect → Chargen → World — works clean. The dice are honest (Pedro tested with paranoid statistics, mfDice passed empirical chi-square + P(>=16) verification within textbook variance). The grid renders square voxels with elevation shading, panning, zoom across 6 levels.

Next priorities Pedro called out:
1. **Equipment V2** — gold roll + spend from catalog
2. **AI homebrew composer** for chargen (races/classes/backgrounds via Sonnet, candidates pinned to server as canon for future players)
3. **Equipment / spells DB seed** — feed `EQUIPMENT_CATALOG` into the database so server-side search works

Pedro is moving to a different machine for school — this build log + the `docs/memories/` mirror travel with the repo so the next session anywhere can pick up cleanly.
