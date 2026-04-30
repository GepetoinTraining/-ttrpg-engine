---
name: Frontend integration + Wave-4 persistence — landed
description: After this push the engine is L0–L6 complete, the frontend is workspace+persona-driven, and persistence flows through tpb_entries + mm_states. Read FIRST in the next conversation along with project_next_routing_pass.md.
type: project
originSessionId: 52de7968-e736-4f04-8243-4b79fbcaf509
---
**Read THIS first** along with `project_next_routing_pass.md` (the handover for the next pass). This memory is the snapshot of what's already built so the next chat doesn't redo work.

## Headline numbers
- **88 test files, 1856 tests passing**, TS clean across all new code.
- L0–L6 engine complete (per `project_ecology_substrate.md` + this push).
- 47 frontend surfaces wired into workspace-grouped sidebar.
- DB-backed world state. Transport + cron + tpb-bridge all live end-to-end.

## What's built this session

### Frontend integration (Tier 1 + Tier 2 from Claude Design handoff)

- 12 surfaces ported from `/tmp/dm-helper-wireframes/claude-dm-helper/project/surfaces/*.jsx` → `src/components/design/surfaces/*.tsx`:
  `_adaptations`, `Sprites`, `Guild`, `Gate`, `MonsterCamp`, `Ecology`, `Bestiary`, `Farms`, `Herds`, `Deposits`, `Materials`, `Actions`
- All ported with `// @ts-nocheck` + `'use client'` + default export. Mock fixtures inside; **strip-only fidelity** per `feedback_wired_means_wired`.
- Sprite styles appended to `globals.css` (~100 lines for sprite-grid / sprite-card).
- Handover doc: `docs/views_handoff_to_design.md` (5 tiers of remaining views).

### Workspace-grouped shell

`src/components/design/DMHelperApp.tsx` — replaced flat 45-surface nav with **workspaces × categories**:
- `Home` (always) · `Player` · `DM` · `Table` — segmented tabs at top of sidebar
- Each workspace has 1–6 categories with surface members
- Active workspace driven by persona type via `PERSONA_TO_WORKSPACE`
- Hash routing still works (`#guild` → auto-switches to DM workspace if needed)
- Tweaks panel reduced (density + hand annotations + "Quick jump" full surface list)

### Persona + per-cert view config

The cert is identity. The persona is what you're playing as. View configs are keyed by persona.

- `src/lib/persona.ts` — 4 types: `dm | player | gm-ai | dmless`. `Persona = { type, characterId }` (characterId required for player+gm-ai). `personaKey()` for storage. localStorage per cert id.
- `src/lib/view-config.ts` — `{ ownerId, hidden[], pinned[], updatedAt }` keyed by `personaKey(persona)`. Pinned surfaces float to a `★ Pinned` group at top of sidebar; hidden ones are filtered out of categories.
- `src/components/design/ConfigMenu.tsx` — modal with persona picker (4 cards) + character dropdown (loads via `listCharacters()`) + per-surface pin/hide table.
- All 4 personas drive workspace switching.

Tests: `view-config.test.ts` (6) + `persona.test.ts` (7) — pure helpers.

### Singular Play surface (Option B HUD-driven)

`src/components/design/surfaces/Play.tsx` (#45) — landing page for Player + Table workspaces. DM workspace has it under Console.

Layout:
- Hero strip (HP/gold + world pulse + live worldDay)
- Location strip (live `partyNodeLabel`)
- Scene + log tabs (live event log via `/api/world/log`)
- Right rail: Party / Quest board / Nearby NPCs (mock)
- Sticky bottom action chip panel
- **DM-only red panel** (visible if `persona.type === 'dm' | 'gm-ai'`):
  - Transport-party widget (dropdown × time mode × days input × execute)
  - Force scene change · inject NPC · random encounter · skip-to-dawn
  - **tick +1d** / **tick +1w** buttons (call `/api/cron/tick?days=N`)

### Wave-4 persistence (DB-backed world state)

Per `feedback_observation_writes.md` + `project_build_log_v2.md` wave-4 spec.

**Schema (additive only, no deletions):**
- `worlds` table: added `lastCronAt: text` and `partyNodeId: text` columns. Run via `npm run db:push`.
- `tpb_entries` table — already existed at line 2267 of schema. Reused as the canonical observation log.
  - Columns: `id · worldDay · actionType · targetId · deltaJson · timestamp`
  - `actionType` = WorldTPBAction discriminator (`'tick' | 'writeKappa' | 'observe' | 'entityMove' | …`)
  - `targetId` = primary subject (nodeId / entityId / sessionId / null) for indexed lookups
  - `deltaJson` = full action payload, replayable
- `mm_states` table — already existed at line 2248. Reused as the MM domain snapshot cache.
  - Columns: `id · mmType · nodeId · layer · cadence · pendingPotential · domainStateJson`
  - UPSERT on resolve only (cache, regenerable from log replay)

**Server bridge (`src/lib/world-tpb.ts`):**
- `attachWriteLog(tp, system)` — monkey-patches per-request TP's `writeKappa` / `writeDomain` to capture every successful write into a buffer. Returns `{ entries, detach }`.
- `appendAction(worldDay, action)` — single insert.
- `flushWriteLog(worldDay, capture)` — bulk insert.
- `snapshotMm(mm, layer, cadence)` — UPSERT to `mm_states`.
- `readTpbEntries(opts)` / `readRecentTpbEntries(limit)` — replay reads.

**World state (`src/lib/world-state.ts`):**
- DB-backed singleton. `worlds[default]` row holds `currentDay`, `lastCronAt`, `partyNodeId`. Lazy-bootstrapped on first request.
- TP graph cached in module memory (constant nodes). Clockwork rebuilt per request at the DB's currentDay.
- `transportParty()` — attaches log → cranks clockwork → observes destination → updates `worlds` → appends `entityMove` + `observe` + every captured `writeKappa` to `tpb_entries` → snapshots resolved MMs.
- `cronTick(days)` — cranks clockwork → updates `worlds` → appends a single `tick` action.

**API endpoints live:**
- `GET /api/world/state` — current snapshot
- `POST /api/world/transport` — DM transport (server runs the math today; routing pass moves this to client)
- `POST /api/cron/tick?days=N` — heartbeat (no observation)
- `GET /api/world/log?limit=N` — recent TPB entries
- `vercel.json` cron: `*/15 * * * *` calls `/api/cron/tick`

**Browser client (`src/lib/world-client.ts`):**
- `fetchWorldState()`, `transportParty(...)`, `cronTick(days)`, `fetchWorldLog(limit)`
- All async, typed return shapes
- `TimeMode` redeclared client-side so the bundle doesn't pull `world-state.ts` (server-only)

**Tests:**
- `src/lib/persona.test.ts` (7)
- `src/lib/view-config.test.ts` (6)
- `src/lib/world-tpb.test.ts` (5) — in-memory write capture only; DB integration tested by hand via API
- (No test for world-state.ts because it's pure DB I/O.)

### What's deliberately deferred (not blocking next pass)

- TP hydration from `world_regions` — TP graph is still constant in module scope. Wave 4 wave-2 piece.
- κ snapshot projection to `world_regions.kappaJson` — purely a read-cache; observation log is canonical.
- Frontend Tier 3+ surfaces — `Banking.tsx`, `Caravans.tsx`, etc. The handoff doc lives in `docs/views_handoff_to_design.md`.
- L6 wraps — done; covered in `project_ecology_substrate.md`.
- mob-ai integration into `mm-scene.ts` — mob-ai is standalone tested; production hookup deferred until combat UI lands.

## Key files (paths to remember)

| Concern | Path |
|---|---|
| Engine TP | `engine/tp.ts` |
| Engine clockwork | `engine/clockwork.ts` |
| TPB action union | `engine/tpb-world.ts` (existing — has `WorldTPBAction` Zod schema) |
| Server world state | `src/lib/world-state.ts` |
| Server tpb bridge | `src/lib/world-tpb.ts` |
| Browser world client | `src/lib/world-client.ts` |
| Persona | `src/lib/persona.ts` |
| View config | `src/lib/view-config.ts` |
| Shell | `src/components/design/DMHelperApp.tsx` |
| Config menu | `src/components/design/ConfigMenu.tsx` |
| Play surface | `src/components/design/surfaces/Play.tsx` |
| DB schema | `src/db/schema.ts` (`worlds`, `tpb_entries` line 2267, `mm_states` line 2248) |
| API routes | `src/app/api/world/{state,transport,log}/route.ts` + `src/app/api/cron/tick/route.ts` |
| Cron config | `vercel.json` |

## Pedro's principles (carry forward)

1. **Observation-driven persistence** — ticks DO NOT write. κ writes only fire from inside `MM.onResolve()`, which only runs on `clockwork.observe()`/`observeNode()`. Volume bounded by observations, not by ticks. Per `feedback_observation_writes.md`.
2. **Append-only log is the source of truth** — `tpb_entries` is the canonical record. `mm_states` and `world_regions.kappaJson` are caches, regenerable from log replay.
3. **The cert is identity. The persona is what you're playing as.** View configs key off persona.
4. **Singular world** — all personas see the same live world; persona-tinted controls (DM gets transport superpower; player sees only character-scoped actions).
5. **Don't trim the schema** — 168 tables intentional. Per `feedback_dont_trim_schema.md`.
6. **"Wired" must mean wired** — distinguish strip-only / partial / fully-bound. Most surfaces today are strip-only. Per `feedback_wired_means_wired.md`.
7. **Pedro architects, Claude codes** — explicit permission to make engineering calls when confident; ask when unsure.
8. **Server is mostly a logger** — "client computes, server writes." Compute lives client-side; server validates + appends. THIS is the next pass's premise — see `project_next_routing_pass.md`.
