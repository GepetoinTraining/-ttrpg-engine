---
name: Phase 2 wiring complete (Settlement · Roster · Markets · Spells · TPEditor · Reputation)
description: Six Tier 2 surfaces wired. New reputations + reputation_deltas tables added; party-dampens-PC math live and verified.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
Phase 2 wired on 2026-04-29.

**New endpoints:**
- `/api/settlement/list`, `/api/settlement/[id]`
- `/api/npc/list`, `/api/npc/[id]`
- `/api/market/[settlementId]`
- `/api/character/[id]/spells`
- `/api/tp/tree` — read-only topology snapshot (worlds/regions/settlements/buildings counts)
- `/api/reputation/character/[id]` (read), `/api/reputation/delta` (write with party-dampen)

**New libs:**
- `src/lib/world-detail.ts` (settlement/npc/market/spells)
- `src/lib/reputation.ts`

**Schema additions** (db:push'd to local.db):
- `reputations(id, subjectType, subjectId, factionId, score)`
- `reputation_deltas(id, subjectType, subjectId, factionId, baseDelta, appliedDelta, reason, worldDay, appliedAt)`

**Reputation math (verified live):** `dampen(p) = 1 - |p|/200`. Smoke test: party at +60 vs faction, character +30 base → dampen=0.7, applied=21, new=21. Auditable via reputation_deltas rows.

**TPEditor caveat:** read-only because `world_regions` / `settlements` have no `data_static` JSON column for arbitrary κ. Adding one + a tpb_entries write hook is the next schema move.

**Coverage in DB right now:** 14 worlds, 266 regions, 13 settlements, 1438 buildings (Faerûn seed). Zero NPCs (engine tick hasn't populated). Several "Starter Town" duplicates from earlier tests.

**Why:** Closes Phase 2 from the gap-analysis plan. Pattern is the same route handler → browser lib → "live engine strip" injected into wireframe surface.

**How to apply:**
- The party-damp model is core engine semantics. Anywhere reputation deltas are computed (NPC interactions, scene outcomes, downtime, etc.), they must go through `/api/reputation/delta` so the dampening + audit log are consistent.
- TPEditor wire is a stub. To make it write-capable: (a) add `data_static text` (JSON) column to `world_regions` and `settlements`, (b) build POST endpoints that mutate those columns and append a tpb_entries row, (c) hot-path the `engine/tp.ts` instance to read from the same columns when materialized.
- `npc/list` returns 0 today because seed data isn't populating npcs. Faerûn seed uses `worldRegions` rich, but `npcs` table is bare. Fix-up is independent of UI.
- Markets surface only renders prices when `commodity_prices` has rows for the selected settlement — currently zero. Wire weekly market tick to populate.
