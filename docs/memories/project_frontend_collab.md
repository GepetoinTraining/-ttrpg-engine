---
name: Frontend collab with Claude Design
description: User is building a new frontend for ttrpg-engine in collaboration with Claude Design; my role is engine-side partner.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
User is collaborating with **Claude Design** on a new frontend for the ttrpg-engine project. I am the engine-side partner — expected to be fluent in the MM/MF/TP/TPB architecture (see CLAUDE.md, docs/mm_topology.md) so I can serve engine surface to whatever the design side asks for.

**Why:** Mentioned at conversation start on 2026-04-29 ("I'm working with claude design to create a front end for this project"). The design work is happening elsewhere; my job is to know the engine well enough to translate design intent into wiring.

**How to apply:**
- When asked engine questions, answer from architecture not vibes — primes, .tp ancestor walk, MM/MF distinction, time dilation tiers all matter.
- Existing frontend is Next.js App Router at src/app/ (CSS Modules, R3F deps installed but world page uses canvas 2D). Treat it as the starting state, not the final one.
- The bend/ and fend/ structure in CLAUDE.md is stale (deleted in current branch). Don't recommend paths from there.
- Engine lives at engine/ (~50 MM/MF files). DB schema is single 2222-line file at src/db/schema.ts with L0–L8 layered tables.
- Don't start writing frontend code until the user clarifies whether design is sending me specs or whether I'm the implementer.
