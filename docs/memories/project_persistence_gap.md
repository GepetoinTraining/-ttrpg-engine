---
name: Engine ↔ DB persistence gap
description: The engine/ MM/MF classes are pure in-memory; only auth and world-hex code touches the DB. No bridge exists between MM classes and Drizzle tables.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
As of 2026-04-29, only **6 files** import from `src/db/schema` or `drizzle-orm`:
- `src/db/{schema,connection}.ts` — the DB itself
- `src/auth/{enroll,verify,seed}.ts` — auth flow (DB-backed)
- `src/game/world.ts` — hex world (worlds + worldRegions tables)

**Nothing in `engine/` touches the DB.** The 131-table schema is a waiting room. MMCharacter, MMSession, MMAdventure, MMSettlement, MMFaction, etc. all instantiate from inline test fixtures — no `loadFromDb()`, no `save()`, no row-to-class hydrators.

**Why:** The engine was built as a pure simulation sandbox first. The schema was designed in parallel but never wired. The previous Next.js frontend had `src/app/api/{character,world}` route handlers that called `src/game/` helpers, not the engine's MM classes directly.

**How to apply:**
- Don't promise frontend features that require persisted MM state without first scoping the bridge work.
- Auth and hex-world rendering are the only surfaces close to ready (~90% and ~50% respectively).
- Anything character/session/NPC/faction/settlement-shaped needs either (a) a hydration layer built first, or (b) a frontend-first in-memory sandbox approach with persistence deferred.
- `src/game/hub/` generates settlements/districts/buildings procedurally but doesn't persist — same gap.
- Old seed data lived in `archive/bend/src/db/seeds/` (deleted bend tree). Nothing seeds the live `local.db` today.
