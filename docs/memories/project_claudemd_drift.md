---
name: CLAUDE.md drift from current code
description: Project CLAUDE.md references deleted bend/ and fend/ trees; current code is Next.js src/app + engine/.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
The project's CLAUDE.md describes a `bend/` (Bun + tRPC backend) and `fend/` (Vue 3 frontend) layout. Both directories are deleted in the current branch (visible in `git status` on 2026-04-29 — large block of `D bend/...` and `D fend/...`).

**Live structure:**
- `engine/` — MM/MF/TP/TPB game engine (~50 files, plain TypeScript classes)
- `src/app/` — Next.js 16 App Router (React 19, CSS Modules)
- `src/db/schema.ts` — Drizzle schema, 2222 lines, single file
- `src/auth/` — topology auth (φ/ζ/M^n math), no tRPC
- `docs/` — engine docs (mm_topology.md, MM-MF-TP-TPB.md, etc.)
- `package.json` — has `@react-three/fiber`, `@react-three/drei`, `three` installed but the world page uses canvas 2D

**Why:** Project pivoted away from the Bun/tRPC/Vue stack to a single Next.js app. CLAUDE.md hasn't been updated to match.

**How to apply:**
- Don't suggest paths under `bend/` or `fend/`. They don't exist.
- Don't suggest tRPC routers — auth and APIs are Next.js route handlers under `src/app/api/`.
- The genesis/precipitation system documented in CLAUDE.md (atoms/molecules/Φ tensor) was part of the deleted `bend/src/genesis/` tree; check whether it has been ported into `engine/` or `src/` before referencing it as live.
- The MM/MF/TP/TPB engine concepts ARE current — those live in `engine/`.
