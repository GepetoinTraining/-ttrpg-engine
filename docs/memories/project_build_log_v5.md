---
name: Build log v5 — Δ.2 Phase 1 + Phase 2 wiring (autonomous MMs + player wrappers + κ persistence)
description: 2026-05-01 evening session. Δ.2 Phase 1 (fauna predation/domestication player MFs), Phase 2 wiring (mm-wild-fauna / mm-mining-layers / mm-ecology-interactables / mm-technology-web), engine-actions player wrappers (one writeKappa per delta), system-edges wire (monster-actor.hunt → mfHerdPredation), writeKappa.value extension + tpb_entries replay = κ persistence. 112 test files / 2212 tests passing.
type: project
---

**End-of-sprint snapshot.** Read AFTER `feedback_dont_second_guess_past_self.md`, `feedback_one_timeline.md`, `feedback_dm_is_the_state.md` (still load-bearing) AND the four NEW feedback memos this session — those are the architectural rules I learned the hard way.

## Headline

- **112 test files, 2212 tests passing**, `npx tsc --noEmit` clean. Deterministic throughout (audited — no `Math.random` / `Date.now` in any new code).
- **Δ.2 Phase 1 shipped** as pure engine: `mfHunt` / `mfTrap` / `mfTame` / `mfDomesticate` (no new TPB variants — intents flow via writeKappa with `system='client-intent:<intent>:<certId>'`).
- **Phase 2 wiring shipped** for Δ.0.5 / Δ.1 / Δ.4 / Δ.6: the autonomous-side MMs are written, tested, and registered in the live clockwork via `world-state.ts`.
- **κ persistence wire is live**: `writeKappa` actions now carry an optional `value` payload; drain logs them into `tpb_entries`; `getWorldState` rebuilds TP each request and replays the audit log into κ. Round-trip works: client `actHunt` → drain → next request's TP shows the herd's reduced population. Per `feedback_observation_writes.md` "regenerable from log" rule made literal.
- **`system-edges.applyMonsterHunt` wired** into `mm-monster-actor.onResolve` — the abstract `+0.1 foodSecurity` placeholder now stacks REAL kill bumps from `mfHerdPredation` against nearby wild herds when herds exist at the camp's region. Δ.0.5 ↔ Δ.2 cross-system edge live.

## What you should read FIRST when you come back

1. **`docs/memories/MEMORY.md`** — index. Pointers to everything below.
2. **`feedback_test_via_serialize.md`** (auto-memory) — never reach into `protected getDomainState()` from tests with `ReturnType<keyof>` gymnastics; `mm.serialize().domain` is the public path. I tried the broken pattern in `mm-mining-layers.test.ts`, Pedro caught it.
3. **`feedback_no_time_skip.md`** (auto-memory) — tick-gated mechanics (trap, tame, domesticate, multi-day mining) wait REAL ticks. Surface holds the wait. The MFs are one-shot once the tick clock has advanced past the wait.
4. **`feedback_dont_invent_new_tables.md`** (auto-memory if I save it; else this section captures it) — defaulting to "create a new SQL table for the new persistence concern" is the wrong instinct. The architecture is "each region is a new TABLE" with prime-composed identity (137 variables — see "Region architecture (future)" below). Until that lands, the audit log (`tpb_entries`) IS the κ persistence.
5. **This file (`project_build_log_v5.md`)** — what's done, what's next.
6. **`project_build_log_v4.md`** — the prior pass (hub-runtime restore + Δ-phase Phase 1 foundations). Still relevant for engine context.

## Architectural rules locked in THIS session

### Region architecture (future, NOT live — don't roll with it yet)

Pedro's full description 2026-05-01:
- **Each region is a new table.** Not a row in a generic `worldRegions` table — a literal per-region SQL table.
- **The region's identity is a CHAIN OF PRIMES.** Each prime corresponds to one of 137 concept variables (`capital=773 → ... → activity=2`). The product/composition of those primes IS the region's seed/identity.
- **Big variables get explicit columns.** `cormyr=region`, `773=suzail-as-capital`, etc. — the identity-defining variables each get a table column.
- **Small variables pack into a blob.** The blob carries its OWN seed (anchored on the region's base prime). Everything in the blob is DERIVED from that seed deterministically — not stored.
- **Same pattern as `engine/magic.ts`** (which already does prime-composition for spells), scaled up to world generation.
- **NOT LIVE YET. DON'T BUILD IT.** Pedro will land it later. When it does, current `worldRegions` + `tpb_entries` map 1:1 to the new structure (probably via a one-time db nuke + reseed).

What this means for you NOW: don't add generic kv tables for κ persistence (e.g. a `tp_kappa_writes` table), don't anticipate the per-region-table shape with "subNodes" maps inside `worldRegions.kappaJson`, don't pre-build prime composition. Use what exists.

### κ persistence works via `tpb_entries` replay (the existing principle, made literal)

- Client computes locally → emits `writeKappa{nodeId, domain, value, system}` action.
- Drain (`/api/cron/drain-slots`) copies the action to `tpb_entries.deltaJson` — value included.
- `getWorldState` on every request: `buildDefaultTp()` (sync, static nodes) + `applyKappaLog(tp, deltaJsons)` (replays all writeKappa entries with values via `tp.writeDomain`). NO module cache for the TP; rebuild every request keeps "regenerable from log" literally true.
- MM resolves write to `tp.writeDomain` directly (existing pattern via `attachWriteLog`); those writes are captured into `tpb_entries` and survive across server restarts via the same replay.

### Determinism is non-negotiable

Pedro 2026-05-01: "everything here is pretty complex because I cannot accept anything that isnt deterministic, if I do, we can't port later." Audited every new file — zero `Math.random` / `Date.now` / non-deterministic calls. All RNG goes through `SeededRNG` from `engine/hub-topology.ts`.

### Goal for next pass: testable playing surface

Pedro: "we want a testable playing surface where we can at least enter a town, talk to ai npc with scoped memories, try a gate and a random dungeon... the basic things". That's the next target — the engine plumbing this session built is in service of that.

## What landed this session (file by file)

### Δ.2 Phase 1 — Player predation/domestication MFs

**New:**
- `engine/fauna-predation.ts` — Per-species per-intent templates (hunt/trap/tame/domesticate) for the 6 wild-fauna species. `PREDATION_CATALOG` has all 6 with all 4 intent templates each.
- `engine/mf-fauna-predation.ts` — 4 MFs:
  - `mfHunt(herd, species, ctx)` — peer of `mfHerdPredation`. d20+skill kills `min(maxKill, ceil(margin/3)+1)` heads. 2+ kills flips herd to fleeing/scattered. Predator fail = hazard. Prey fail = flees.
  - `mfTrap(herd, species, ctx)` — population -1 on success, emits `TrappedCreature`. `bait` knocks -2 DC. Doesn't bump knowledge tier.
  - `mfTame(captured, species, ctx)` — operates on TrappedCreature. Bond level 1-5 from margin. Emits `FollowerAttachSpec` (caller wires into mm-followers).
  - `mfDomesticate(captured, species, ctx)` — multi-day fold. Success +days, fail +days/2. Facility-required species gated. Completion emits `LivestockSpec` (caller wires into husbandry.Herd).
- `engine/__tests__/fauna-predation.test.ts` (11 tests)
- `engine/__tests__/mf-fauna-predation.test.ts` (33 tests)

**Decision:** mfHunt is a PEER of mfHerdPredation, not a wrapper. The build log v4 suggested wrapping — Pedro confirmed peer is right. Player single-hunter d20 mechanic vs environmental whole-herd 0..1 pressure are different things.

### Phase 2 — Autonomous MMs (Layer 5 / Layer 1 / Layer 5 / Layer 6)

**New MMs (all hydrate from κ on resolve, project κ writes back):**
- `engine/mm-wild-fauna.ts` — Layer 5 ECOLOGY, daily. Per-region. Lazy-spawns herds from `biome.fauna` pool deterministically (worldSeed + nodeId). Folds `mfHerdGraze` + `mfHerdMigrate` per herd. Owns `κ.ecology.herds`.
- `engine/mm-mining-layers.ts` — Layer 1 EXTRACTION, daily. Per mine node. Lazy-init surface layer. Folds `applyDailyDepletion`. Owns `κ.infrastructure.mineLayers`.
- `engine/mm-ecology-interactables.ts` — Layer 5 ECOLOGY, weekly. Per region. Density regen toward biome baseline (rarity-scaled rate). Owns `κ.ecology.interactableDensity`.
- `engine/mm-technology-web.ts` — Layer 6 HUB SERVICES, weekly. Per settlement. Lazy-init F-tier seeds. Optional autonomous NPC craftsman attempts (`mfStudyTech` with mock NPC stats). Owns `κ.knowledge.unlockedTech`.

Tests: `mm-wild-fauna.test.ts` (16), `mm-mining-layers.test.ts` (10), `mm-ecology-interactables.test.ts` (11), `mm-technology-web.test.ts` (11).

### κ schema extensions (additive)

`engine/tp.ts`:
- `EcologyRulesSchema.herds: Record<herdId, WildHerdShape>` — mirrors `WildHerd` shape from wild-fauna.ts (inline structural, follows existing `adaptations` pattern)
- `EcologyRulesSchema.interactableDensity: Record<speciesId, number>`
- `InfrastructureRulesSchema.mineLayers: MineLayer[]`
- `KnowledgeRulesSchema.unlockedTech: Record<purpose, Tier>`

All optional, all backward-compatible.

### writeKappa.value extension (Phase 2.9 partial)

`engine/tpb-world.ts`:
- `writeKappa` variant gained optional `value: z.unknown()` field — carries the κ delta payload.

`engine/tp-write-capture.ts`:
- `attachWriteLog` now captures `value` on both `writeDomain` and `writeKappa` calls.
- For `writeKappa` (path-based), values are grouped by domain into a single entry per domain.

### Player-side wrappers + persistence wire

**New:**
- `src/lib/engine-actions.ts` — pure helpers wrapping the player MFs:
  - `actHunt`, `actTrap`, `actTame`, `actDomesticate` (Δ.2)
  - `actMineDig`, `actMineReveal` (Δ.4)
  - `actStudyEcology`, `actHarvestEcology` (Δ.1)
  - `actCraftBasic`, `actCraftDiscover` (Δ.5)
  - `actStudyTech` (Δ.6)
  - Each returns `{ result, receipt, actions: WorldTPBAction[] }`. κ-emitting actions carry the delta as the `value` field.
- `src/lib/engine-actions.test.ts` (17 tests)
- `src/lib/kappa-log.ts` — pure `applyKappaLog(tp, deltaJsons)` replay helper. No DB import (so it's testable in isolation).
- `src/lib/kappa-log.test.ts` (8 tests including round-trip: capture → JSON → replay → resolve sees κ)

**Modified:**
- `src/lib/world-state.ts`:
  - DROPPED the `_tpCache` module cache. TP rebuilds every request.
  - Added `hydrateKappaFromLog(tp)` — reads `tpb_entries`, calls `applyKappaLog`.
  - Added `registerHubServiceMMs(clockwork, worldDay)` — registers `MMTechnologyWeb` at `suzail`/`wheloon`/`marsember`.
  - `getWorldState`: `buildDefaultTp` → `hydrateKappaFromLog` → `new Clockwork` → `registerHubServiceMMs` → return.

### system-edges Δ.0.5 wire (touched past-Claude code, additive)

`engine/system-edges.ts`:
- Added `applyMonsterHunt(actor, herds, worldDay)` — runs `mfHerdPredation` for each nearby herd with pressure scaled by `actor.troops` + `actor.leaderCR`. Returns `{herdsAfter, totalKilled, pressure, foodSecurityBoost}`.

`engine/mm-monster-actor.ts` (additive — no past behavior changed):
- Imports `applyMonsterHunt`.
- After `tickMonsterAdvancement` returns inside the per-month loop, if `advancement.action === 'hunt'`: read `κ.ecology.herds` at the camp's region, call `applyMonsterHunt`, write updated herds back to κ, stack the foodSecurityBoost on top of the existing abstract `+0.1` placeholder.
- Added `cumulative.huntsApplied` + `cumulative.herdKills` counters (additive on existing domain state).

`engine/__tests__/system-edges.test.ts` extended with 5 tests for `applyMonsterHunt`.
`engine/__tests__/mm-monster-actor.test.ts` extended with 2 integration tests for the wire.

## Test count delta this session

| Layer | Before | After |
|---|---|---|
| Engine `__tests__` | 87 files / ~1985 | 95 files / ~2127 |
| `src/lib` | 7 / ~38 | 9 / ~63 |
| **Total** | **104 / 2087** | **112 / 2212** |

(+8 test files, +125 tests, 0 regressions)

## Things you'll want to do BEFORE coding

1. `npm run db:push` — schema is unchanged this session, but if your local DB is from before the v4 sprint, push to pick up `hub_runtime_state` + `spells.compositionSeed`.
2. Re-read `feedback_test_via_serialize.md` and `feedback_no_time_skip.md` — these are the lessons from THIS session, both saved as auto-memory.
3. Skim `engine/mm-wild-fauna.ts` — its lazy-spawn-from-biome pattern is the template for the future ecology / faunal substrate.

## Build order suggestion if you continue (toward Pedro's playable target)

Pedro's target: enter a town, talk to AI NPC with scoped memories, try a gate, random dungeon.

1. **Register existing MMs in clockwork** — `mm-npc` / `mm-intelligence` / `mm-monster-actor` / `mm-dungeon-gate` / `mm-guild` already exist as past-Claude work but aren't wired into the live clockwork via `world-state.ts`. Adding them mirrors the `registerHubServiceMMs` pattern. Suzail-bound NPCs first (the player starts there).
2. **Settlement.tsx wiring** — surface needs to consume `useWorld()`, render NPCs from `κ.knowledge.unlockedTech` + nearbyNpcs (already on `useWorld` state), have a "Talk" action that produces a writeKappa intent for NPC interaction.
3. **Gate flow** — wire one of the existing nodes (`cormanthor_portal` or `sunset_vault`) to a `mm-dungeon-gate` instance; UI for "approach gate → dungeon" via the existing `engine/dungeon-gate.ts` mechanics.
4. **Random-dungeon flow** — wire `engine/dungeon-mf.ts` + `engine/mm-dungeon-gate.ts` to a player intent in `engine-actions.ts` (e.g. `actEnterGate`); persist via writeKappa.
5. **Δ.3 Phase 1** (aquatic wildlife) — pure engine, mirror Δ.0.5 pattern. Lower priority than the playable surface.

## Don't

- Add new SQL tables for κ persistence. Use `tpb_entries` until per-region-tables (137-prime-composition) lands. Pedro will nuke + reseed when it does.
- Reach into `protected getDomainState()` from tests. Use `mm.serialize().domain`.
- Add `Math.random` / `Date.now` anywhere. Determinism is non-negotiable.
- Add new TPB action variants for player intents. They flow through `writeKappa` with `system='client-intent:<intent>:<certId>'`.
- Try to "skip time" for tick-gated mechanics. The wait is real.
- Refactor on instinct — read `feedback_dont_second_guess_past_self.md` if tempted.
