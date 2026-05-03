# TTRPG Engine — `docs/`

A solo-and-table TTRPG engine — D&D 5e-shaped, but engineered as a **persistent shared world** with multi-tenant accounts, deterministic worldline reconciliation, and append-only history. Architecture is closer to EVE Online's economy than to a chat-bot DM, dressed in the UX of a tabletop helper.

> **Start here:** [`CLAUDE.md`](../CLAUDE.md) at the repo root is the canonical orientation doc — full project structure, cert hierarchy, world-state flow, common tasks. This README is a brief overview + a map into `docs/`.

## Four play modes

- **player** — at a table with a human DM
- **dm** — running someone's table (the "god lens")
- **gm-ai** — solo with AI as DM
- **dmless** — pure clockwork solo, no AI, world ticks autonomously

## Core principles (non-negotiable)

1. **No topology = no existence.** Every entity has a numeric seed; the seed's prime factorization is its identity. The same math (φ, ζ, M^n trajectory) authenticates accounts, characters, and signs in-world receipts.
2. **Observation is the only writer.** World content derived from the seed needs no row. Persistence happens *only* when interaction changes state. The append-only `.tpb` is canonical; `.tp` and `mm_states` are caches regenerable from the log.
3. **Client computes, server appends.** Browser runs the engine math, produces `WorldTPBAction[]` + receipts, pushes a flywheel slot. Server validates shape (no engine compute), inserts. Hourly cron drains slots into the canonical ledger.
4. **Math is the gate; signatures are forensic.** Receipts are dual-signed (account × character) but the validator does NOT verify them on the happy path — only on detected divergence, dispute, or audit.
5. **DM is a viewing mode, not a permission.** Persona (`player | dm | gm-ai | dmless`) is baked into the character cert at chargen and never user-toggled afterward.

## Status

Live snapshot:

| Metric | Count |
|---|---|
| Engine source files | ~117 (.ts, in `engine/`) |
| Engine tests | 101 files (~1856+ tests) |
| Other tests | 11 files (`src/lib/*.test.ts`) |
| DB tables | 131 across 12 layers |
| UI surfaces | 52 (in `src/components/design/surfaces/`) |
| API routes | 47 (under `src/app/api/`) |

Engine **L0–L6 complete** (Physical → Hub Services). Frontend is workspace-grouped (Home / Player / DM / Table) with persona-driven view configs. Wave-4 persistence (`tpb_entries` log + `mm_states` cache + cron) is live. Routing pass landed: client-side `engine-client.ts` produces actions, `POST /api/world/slot/push` queues them, hourly drain copies into `tpb_entries`.

**Pending:** railgun spectrum subscription (currently 5 s polling on `/api/world/log`); Tier 3+ surface design; mm-scene combat integration with mob-ai; DM-as-shard-host V2 (full local Clockwork during sessions).

## Architecture at a glance

```
src/                       — Next 16 app router
├── app/api/               — route handlers (server-only; no engine compute except cron)
├── components/design/     — workspace shell (DMHelperApp.tsx) + 52 surfaces
├── lib/                   — engine-client.ts, useWorld hook, IDB helpers, world-tpb bridge
├── auth/                  — topology auth math (browser-safe: φ, ζ, M^n)
├── db/                    — Drizzle schema (131 tables) + Turso client
└── game/                  — worldgen + spatial layer (hex, being migrated to square)

engine/                    — pure-compute engine, ZERO DB imports anywhere
├── tp.ts, tpb.ts          — topology pointer + append-only history
├── tpb-world.ts           — WorldTPBAction Zod union (canonical wire format)
├── clockwork.ts           — 7-layer dependency-ordered tick crank
├── mf-{dice,check,damage} — atomic 2×2 matrix functions, return {output, receipt}
└── mm-*.ts                — ~40 per-domain MM adapters (weather → narrative)

archive/                   — pre-Next.js bend/ + fend/ (DO NOT REFERENCE)
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19.2 |
| Backend | Next.js route handlers (no separate server) |
| Database | Turso (libSQL/SQLite) via Drizzle 0.45 |
| Validation | Zod 4 (schemas shared client + server) |
| Test | Vitest 4 |
| 3D | three.js / `@react-three/fiber` / drei |
| PDF import | `pdfjs-dist` (D&D Beyond importer) |

No tRPC, no Clerk, no separate Bun server, no email/password. Auth = geolocation + server datetime → seed → primes → ζ; account certs live in IndexedDB.

## Running locally

```bash
npm install
npm run dev            # Next dev server with turbopack
npm run test           # vitest one-shot
npm run test:watch     # vitest watch mode
npm run db:push        # apply schema to local DB
npm run db:studio      # drizzle-kit studio
```

`CRON_SECRET` env var gates `/api/cron/*` in production (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`).

## Key docs

Read in this order when first picking up the engine:

1. **[`mm_topology.md`](mm_topology.md)** — 6 mermaid diagrams of MM ↔ TP topology. Read FIRST for engine work.
2. **[`MM-MF-TP-TPB.md`](MM-MF-TP-TPB.md)** — File-system spec. Receipts as side-effects of the .mf matrix forward pass; branch/diff for .tpb; theorem 1 (every computation is its own proof).
3. **[`mm_nesting.md`](mm_nesting.md)** — Two-tree (world + player) hierarchy, tick cadences.
4. **[`tp_schema.md`](tp_schema.md)** — TP node types + 16 κ domains.
5. **[`db-schema.md`](db-schema.md)** — Table reference for the 131-table schema.
6. **[`clockwork_api.md`](clockwork_api.md)** + [`clockwork_wiring.md`](clockwork_wiring.md) — Clockwork registration + cadence.
7. **[`railgun-bridge.md`](railgun-bridge.md)** — Flywheel / cert / envelope / orbit primitives (subscription transport, not yet built).
8. **[`views_handoff_to_design.md`](views_handoff_to_design.md)** — Tier-by-tier surface roadmap.

Reference / archival:

- [`mm_cycles.md`](mm_cycles.md), [`mf_simulation.md`](mf_simulation.md), [`tp_mapping.md`](tp_mapping.md) — older spec material.
- [`gm-orchestrator-audit.md`](gm-orchestrator-audit.md) — GM mode audit.
- [`PROGRESS.md`](PROGRESS.md), [`MEMORY_TOPOLOGY_PLAN.md`](MEMORY_TOPOLOGY_PLAN.md) — historical roadmap notes.
- [`ui_elements_for_design.md`](ui_elements_for_design.md) — design handoff UI inventory.

## License

Private — All rights reserved.
