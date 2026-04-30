# CLAUDE.md — TTRPG Engine

This file orients Claude in the codebase. **Memories take precedence over this doc** — see `~/.claude/projects/D---ttrpg-engine/memory/MEMORY.md` for live state. This doc covers the stable architecture that doesn't change conversation-to-conversation.

## What this is

A solo-and-table TTRPG engine — D&D 5e-shaped, but engineered as a **persistent shared world** with multi-tenant accounts, deterministic worldline reconciliation, and append-only history. The architecture is closer to EVE Online's economy than to a typical chat-bot DM, dressed in the UX of a tabletop helper.

Four play modes:
- **player** — at a table with a human DM
- **dm** — running someone's table (the "god lens")
- **gm-ai** — solo with AI as DM
- **dmless** — pure clockwork solo, no AI, world ticks autonomously

## Core principles (non-negotiable)

1. **No topology = no existence.** Everything has a numeric seed; the seed's prime factorization is its identity. The same math (φ, ζ, M^n trajectory) authenticates accounts, characters, and signs in-world receipts.
2. **Observation is the only writer.** World content derived deterministically from the seed needs no row. Persistence happens *only* when interaction changes state. The append-only `.tpb` is the canonical record; `.tp` and `mm_states` are caches regenerable from the log.
3. **Client computes, server appends.** The browser runs the engine math, produces `WorldTPBAction[]` + receipts, and pushes a *flywheel slot* to the server. The server validates shape (no engine compute), inserts. An hourly cron drains slots into the canonical ledger in arrival order.
4. **Math is the gate; signatures are forensic.** Receipts are dual-signed (account cert × character cert) but the validator does NOT verify them on the happy path — only on detected divergence, trade dispute, or audit. "Compute isn't something we splurge on."
5. **DM is a viewing mode, not a permission.** Personas (`player | dm | gm-ai | dmless`) are baked into a character cert at chargen and never user-toggled afterward. Switching personas = switching characters.

## Project structure

```
ttrpg-engine/
├── src/                          # Next.js app (browser-shipped + route handlers)
│   ├── app/                      # Next 14 app router
│   │   ├── api/                  # Route handlers (server-only)
│   │   │   ├── account/create/        — mint account cert from (geo, serverNow)
│   │   │   ├── character-cert/create/ — mint character cert (chargen-time)
│   │   │   ├── auth/{enroll,challenge,verify}/  — legacy invite-flow auth
│   │   │   ├── world/{state,log,replay,transport,slot/push}/
│   │   │   ├── cron/{tick,drain-slots}/         — autonomous server jobs
│   │   │   └── …                                — character, campaign, etc.
│   │   └── page.tsx              — entrypoint, mounts DMHelperApp
│   ├── components/design/        # All UI surfaces + shell
│   │   ├── DMHelperApp.tsx       — workspace shell (Home/Player/DM/Table tabs)
│   │   ├── ConfigMenu.tsx        — persona + character picker (legacy UI)
│   │   ├── TweaksPanel.tsx       — dev controls
│   │   └── surfaces/             — 47 surfaces (Auth, Chargen, Play, etc.)
│   ├── lib/                      # Browser + shared logic
│   │   ├── idb.ts                — IndexedDB wrapper (`claudedm` db, 7 stores)
│   │   ├── account-cert.ts       — account cert IDB helpers
│   │   ├── character-cert.ts     — character cert + active session helpers
│   │   ├── engine-client.ts      — browser engine adapter (transport, observe, roll, applyIntent, push)
│   │   ├── use-world.ts          — React hook: engine-client + log poll
│   │   ├── world-state.ts        — server: world row hydration + transport (legacy path)
│   │   ├── world-tpb.ts          — server: tpb_entries DB writes + read helpers
│   │   ├── world-client.ts       — browser fetch wrappers (state/log/transport/cron)
│   │   ├── auth.ts               — legacy invite-flow cert client (localStorage)
│   │   ├── persona.ts            — legacy persona toggle (being deprecated)
│   │   ├── session-context.tsx   — React context (legacy session)
│   │   └── …                     — character, campaign, dungeon, sprite, etc.
│   ├── auth/                     # Topology auth math (browser-safe)
│   │   ├── seed.ts               — createSeedData(datetime, geo) → {seed, primes, zeta}
│   │   ├── enroll.ts             — server: legacy invite enrollment
│   │   ├── verify.ts             — server: challenge/verify
│   │   └── math/{prime,phi,matrix}.ts — pure math (φ, ζ, M^n)
│   ├── db/                       # Drizzle ORM schema + connection
│   │   ├── schema.ts             — 130+ tables, 12 layers (see file header)
│   │   └── connection.ts         — Turso/libSQL client
│   └── game/                     # Worldgen + spatial layer (HEX, being migrated to square)
│       ├── hex.ts                — axial coords, A*, scale levels (1m → 16.8km)
│       ├── biome.ts, edges.ts, world.ts, regionFeatures.ts, flora-tree.ts, noise.ts
│       └── hub/{generator,schema,topology,hubLayout}.ts
│
├── engine/                       # Pure-compute engine (no DB imports anywhere)
│   ├── tp.ts                     — TP class: world graph + κ resolve via ancestor walk
│   ├── tpb.ts                    — TPB class: append-only history with branch/diff
│   ├── tpb-world.ts              — WorldTPBAction Zod union (canonical wire format)
│   ├── tp-write-capture.ts       — attachWriteLog: monkey-patches TP κ writes into a buffer
│   ├── clockwork.ts              — Clockwork class: 7-layer dependency-ordered MM tick crank
│   ├── mm-simulated.ts           — ISimulatedMM interface + base class (accumulate / resolve)
│   ├── mf-{dice,check,damage}.ts — pure MFs (each returns {output, receipt})
│   ├── mm-{character,scene,party,session,adventure,…}.ts — Player tree MMs
│   ├── mm-{settlement,faction,economy,market,services,…}.ts — World tree MMs
│   ├── world-tick.ts             — Multi-cadence world tick orchestrator
│   ├── system-edges.ts           — Cross-system reactive wires
│   └── …                         — 100 files total; see docs/mm_nesting.md
│
├── docs/
│   ├── mm_topology.md            — 6-mermaid topology diagram (READ FIRST for engine work)
│   ├── mm_nesting.md             — Two-tree (world + player) hierarchy + tick rates
│   ├── MM-MF-TP-TPB.md           — File-system spec: receipts as side effects, branch/diff
│   ├── railgun-bridge.md         — Flywheel/cert/envelope/orbit primitives (subscription transport)
│   ├── tp_schema.md              — TP node types + κ domains
│   ├── db-schema.md              — Table reference
│   ├── clockwork_{api,wiring}.md — Clockwork registration + cadence
│   └── views_handoff_to_design.md — Tier-by-tier surface roadmap
│
└── archive/                      — pre-Next.js bend/ + fend/ + old genesis stuff (DO NOT REFERENCE)
```

## The cert hierarchy (current, post-2026-04-30)

Two cert types, both produced by the **same** `createSeedData(datetime, geo)` math. Browser stores them in IndexedDB; server stores them in `accounts` + `character_certs` tables.

```
Account cert  ← top identity, one per browser
  ├── seed: bigint (string — from geo + serverNow)
  ├── primes: number[]
  ├── zeta: number
  ├── geoLat, geoLon, createdAt
  └── characterCreatedLog: [{ characterId, seed, createdAt }]  ← append-only origin record

Character cert  ← per-character identity, owned by account
  ├── seed, primes, zeta, geoLat, geoLon, createdAt  (same shape, different moment)
  ├── ownerChain: [accountId₁, accountId₂, …]  ← last is current commander
  ├── characterDataId: FK to characters table (sheet)
  └── personaType: 'player' | 'dm' | 'gm-ai' | 'dmless'  ← FIXED at creation
```

**Trade** is 2-step (initiate + accept), both signatures recorded as a `characterTransfer` action variant in `tpb_entries`. Original creator stays in the account log forever, but the current commander signs going forward.

**Persona drives time-flow:** session-time personas (player/dm/gm-ai) can fast-travel via DM authority; `dmless` lives at server-cron time and can't fast-travel. **DMless cannot party with DM-led characters** — different timelines.

**One active character at a time** per browser, tracked in IDB `sessionState`.

## World-state flow (the "client computes, server appends" loop)

```
[Browser]                                                       [Server]
1. useWorld() hook hydrates from /api/world/state ────────▶  GET /api/world/state    → returns {worldDay, partyNodeId, destinations}
2. Polls /api/world/log every 5s ─────────────────────────▶  GET /api/world/log      → returns recent tpb_entries
3. EngineClient buffers actions locally:
   transport(dest, days) → entityMove + observe
   observe(node)         → observe action
   roll(formula)         → mfDice + receipt
   applyIntent(intent)   → writeKappa with system="client-intent:<certId>"
4. push() ───────────────────────────────────────────────▶  POST /api/world/slot/push
                                                              { kind: 'solo' | 'dm-session', actions[], receipts[], ... }
                                                              → INSERT flywheel_slots, return slotId

[Server cron — independent of any client]
5. Every 15min:  /api/cron/tick           → cron-only `tick` action; UPDATE worlds.currentDay
6. Every  1hr:   /api/cron/drain-slots    → drain pending flywheel_slots in arrival order
                                            → bulk INSERT into tpb_entries
                                            → mark processed_at
```

**DM-hosted parties:** during a session, the DM's browser hosts the engine math for the whole party (peer-to-peer with player clients). The entire session bundle is signed by the DM cert and pushed at session **end** or **pause** — NOT hourly. The bundle lands "in the past" of server-cron time, which is fine — the .tpb is append-only and absorbs out-of-order timestamps via worldline reconciliation (Pratchett's *Long Earth* style: parallel consistent timelines converging into one canonical ledger).

## Engine architecture (engine/ — pure compute)

**Zero DB imports anywhere in `engine/`.** All 100 files are pure in-memory math over `TP` + MM state. The DB boundary lives entirely in `src/lib/world-tpb.ts` and `src/lib/world-state.ts`.

### MM/MF/TP/TPB primitives

- **MF (manifold function)** — atomic transformation. `[x, K; K, x]` matrix. Forward pass produces `O + R` (output + receipt); receipt R is a side-effect of the matrix structure (Theorem 1 from `docs/MM-MF-TP-TPB.md`). Examples: `mfDice`, `mfCheck`, `mfDamage`. Pure, deterministic, invertible.
- **MM (manifold matrix)** — container of MFs (or nested MMs). Provides time + aggregates Δω. Examples: `mm-character`, `mm-scene`, `mm-settlement`. Has `accumulatePotential(days)` (cheap, every tick) + `resolve(worldDay)` (expensive, on observation only).
- **TP (topology pointer)** — world graph. `tp.resolve(nodeId)` walks ancestors and merges κ rules (child overrides parent). Read-mostly; mutation via `writeKappa`/`writeDomain` captured by `attachWriteLog`.
- **TPB (backward topology)** — append-only history. `branch(fromIndex)` forks; `static diff(a, b)` finds divergence index. **No merge protocol.** Divergence triggers replay-from-divergence-point.

### Two-tree hierarchy

**World tree** (autonomous, server-side, cron-driven):
```
MM_world
├── MM_economy, MM_faction, MM_magic, MM_social, MM_weather
├── MM_region → MM_settlement → MM_ecology + MM_hub (districts, NPCs, market, services, ...)
└── MM_caravan, MM_edge (trade routes)
```

**Player tree** (observable, client-side-runnable):
```
MM_adventure (campaign)
├── MM_session → MM_scene (combat, 6s tick)
├── MM_downtime
├── MM_party → MM_character[]
├── MM_followers (local NPC companions + global remote ones)
├── MM_narrative (arcs / quests / beats / rabbit holes)
└── MM_intelligence (per-agent identity, knowledge, memory)
```

The two trees intersect at **.tp nodes** — wherever the party currently is.

### 7-layer Clockwork

`engine/clockwork.ts` runs the world tick in dependency order:
- L0 PHYSICAL → L1 EXTRACTION → L2 ECONOMY → L3 FACTION → L4 SETTLEMENT → L5 ECOLOGY → L6 HUB SERVICES

Daily tick is the heartbeat; weekly/monthly/quarterly/semesterly/yearly fire when their counter thresholds hit. Observation triggers MM resolves regardless of cadence.

## Surface architecture (UI)

47 surfaces in `src/components/design/surfaces/`. Workspace shell (`DMHelperApp.tsx`) groups them into Home/Player/DM/Table tabs. Active workspace driven by current persona type.

### Critical surfaces (Tier 1 — wired)

- **Auth** (#auth) — landing, account-cert mint OR legacy invite redeem
- **CharacterSelect** (#character-select) — persona picker, character list, "log into world"
- **Chargen** (#chargen) — character sheet creation; reads `?certId=X` to bind a pre-minted cert
- **Sheet** (#sheet) — character sheet view
- **Combat** (#combat) — combat runner
- **Play** (#play) — singular HUD-driven play surface (uses `useWorld()`)
- **Onboarding** (#onboarding) — DM campaign setup

### Tier 2/3 (mostly strip-only — see views_handoff_to_design.md)

DMConsole, Settlement, Roster, Markets, Spells, TPEditor, Lore, Quests, SceneEditor, Diplomacy, Warfare, Dungeon, plus ~20 more.

## Where state lives

```
LOCATION              | WHAT'S THERE                                | LIFETIME
──────────────────────┼─────────────────────────────────────────────┼──────────
IndexedDB (claudedm)  | account cert, character certs, characterTpb,| browser-local
                      | flywheelSlot (pending), partyMembers,       | (per device)
                      | sessionState (active char), tradeLog        |
──────────────────────┼─────────────────────────────────────────────┼──────────
localStorage          | legacy invite-flow cert (claudedm:cert)     | being deprecated
──────────────────────┼─────────────────────────────────────────────┼──────────
Server SQLite (Turso) | accounts, character_certs, character_trades,| canonical
                      | flywheel_slots (pending), tpb_entries (log),| (per world)
                      | mm_states (cache), worlds (singleton),      |
                      | + 130+ tables for game content              |
──────────────────────┼─────────────────────────────────────────────┼──────────
Engine RAM (request)  | TP graph + Clockwork + MMs                  | per request
                      | (rebuilt from worlds.currentDay each call)  |
```

## Common tasks

**Add a new in-world action type:**
1. Add a Zod variant to `engine/tpb-world.ts` `WorldTPBActionSchema`
2. Update `targetIdForAction` in `src/lib/world-tpb.ts` (exhaustiveness check)
3. Update `targetIdForAction` in `src/app/api/cron/drain-slots/route.ts`
4. Producer code in engine-client / a server route appends actions of this type

**Add a new MM:**
1. Extend `SimulatedMMBase` (in `engine/mm-simulated.ts`) — implement `onAccumulate` + `onResolve`
2. Register with Clockwork at appropriate layer + cadence (`docs/clockwork_wiring.md`)
3. Append `mm_states` rows on resolve via `snapshotMm` (server-side bridge)

**Add a new surface:**
1. Create `src/components/design/surfaces/MySurface.tsx` (mark `// @ts-nocheck` + `'use client'` if matching existing pattern)
2. Register in `src/components/design/DMHelperApp.tsx` `SURFACES` array (give it a slot number)
3. Add to a workspace category if it should appear in the sidebar

**Mint a new cert (account or character):**
- Account: client calls `createAccount({ lat, lon })` from `@/lib/account-cert`; server runs `createSeedData(now, geo)` and inserts into `accounts`
- Character: client calls `createCharacterCert({ accountId, geo, personaType })`; server inserts into `character_certs` and appends to `accounts.characterCreatedLog`

**Wire a player intent into the slot push:**
- Client surface calls `useWorld().applyIntent(name, params)` then `useWorld().push()`
- The action lands in `flywheel_slots` as a `writeKappa` with system=`client-intent:<certId>`
- Hourly cron drains it into `tpb_entries`

## Running locally

```bash
npm run dev            # Next dev server with turbopack
npm run test           # vitest one-shot (88 files, 1856 tests target)
npm run test:watch     # vitest watch mode
npm run db:generate    # drizzle-kit migrations from schema
npm run db:push        # apply schema to local DB
npm run db:studio      # drizzle-kit studio
```

CRON_SECRET env var gates `/api/cron/*` endpoints in production (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`).

## Testing discipline

- `npm run test` must show 88 files / 1856 tests passing (the target keeps growing as features land)
- `npx tsc --noEmit` must be clean — type drift between source schemas and test fixtures is a known historical issue and gets fixed eagerly
- Engine modules have heavy coverage in `engine/__tests__/`; UI surfaces have lighter coverage (test pure helpers, mock IDB/fetch)

## Things this doc doesn't cover (look in memories)

- Current build slice + open questions → `~/.claude/projects/D---ttrpg-engine/memory/MEMORY.md` is the live handover
- Pedro-specific architectural decisions (cert hierarchy, dual-sig forensic rule, DM-as-shard-host, hex→square migration, etc.) → individual project memos
- Pedro's collaboration style + feedback rules → `feedback_*.md` memos

## Things to NEVER do

- Don't reference `bend/` or `fend/` — those directories are deleted (lived in `archive/` only). The live code is `src/` + `engine/`.
- Don't write to `tpb_entries` directly from in-world action paths — go through `flywheel_slots` + cron drain.
- Don't add per-receipt signature verification to `/api/world/append` or `/api/world/slot/push` — signatures are forensic-only.
- Don't add `isDM` flag to accounts or runtime persona toggles — persona is per-character cert and FIXED at creation.
- Don't propose email/password account creation — accounts are minted from geolocation + server datetime, full stop.
- Don't run `db:push` against the production DB unless we're doing the planned wipe-and-reseed.
- Don't trim the schema — 130+ tables are intentional. Propose additions, never deletions, until a coordinated wipe.

---

*"clockwork isn't a metaphor — one breaking test literally breaks everything else."* — Pedro
