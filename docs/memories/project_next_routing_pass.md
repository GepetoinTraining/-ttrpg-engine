---
name: Next pass — frontend routing audit (client computes, server writes)
description: Handover doc for the routing pass. Pedro's principle: server is mostly an append-only logger; the client runs the engine math, sends pre-computed WorldTPBActions, server validates + appends. 4 open questions ANSWERED 2026-04-30. Read AFTER project_frontend_and_wave4.md.
type: project
originSessionId: 52de7968-e736-4f04-8243-4b79fbcaf509
---
**Read THIS as the second memory in the next conversation** (after `project_frontend_and_wave4.md` for state, this for the plan).

Pedro's exact framing:
> "we'll look at the frontend routing and logic to see if we're passing the math to the clientside so it can calculate for the backend and simply register it, we do very little calculation on the server, we simply write and append that which the client calculated for us, compute isn't something we splurge on"

## ⭐ Pedro's confirmed answers (2026-04-30)

The 4 open questions from the prior memo are RESOLVED. Build with these:

1. **Engine bundle** → **player-observable subset only**, not full engine.
   The client gets exactly what a single player can observe alone (TRUE_SOLO) or with DM-AI (SOLO_AI). DM+AI (GROUP_DM_AI) and DM-pure (GROUP_AI) stay server-side because multi-actor coherence needs server authority. See "Player-observable subset" below.

2. **Log subscription** → **railgun protocol** (the flywheel). NOT polling, NOT SSE.
   Read [`docs/railgun-bridge.md`](file:///D:/-ttrpg-engine/docs/railgun-bridge.md) — it spec's the cert/envelope/orbit/rotation primitives. Pedro's tease: "once you see the way the flywheel idea works, you'll laugh, greedily." Each connected client is an orbit consuming envelopes addressed to its cert; the server spins the wheel; the append-only `tpb_entries` IS the spectrum (additive, hash-chained audit). The bridge files (`bridge.ts`/`orchestrator.ts`/`test-ttrpg.ts`) were originally built in `D:/Railgun/` to prove the mapping — they need to be re-imported / rebuilt here per the doc's "to rebuild" section.

3. **Conflict strategy** → **NO MERGE/CONFLICT RESOLUTION NEEDED.**
   Pedro: "what conflict? we already resolved the merge and diff protocol... read the docs, please read the docs don't guess while coding." The .tpb is append-only and branching uses **diff-from-first-divergence** — see [`docs/MM-MF-TP-TPB.md`](file:///D:/-ttrpg-engine/docs/MM-MF-TP-TPB.md) §4.
   Operational rule: client computes Δ + receipt R from the .mf matrix (R is a side effect of the forward pass — Theorem 1: every computation is its own proof). Server validates R against the current .tp + .tpb head. If R verifies → append. If R diverges → return the missing tail; client replays tail, recomputes from new head, retries. There is no merge. The .tpb only grows.

4. **Per-action client ownership** → **everything except `tick`.**
   Client computes `entityMove`, `observe`, `writeKappa`, `entitySpawn`, `entityDespawn`, `session` start/end, `writeEdge`. Server only owns `tick` (autonomous heartbeat — client doesn't control time). Zod schemas in [`engine/tpb-world.ts`](file:///D:/-ttrpg-engine/engine/tpb-world.ts) enforce shape parity — frontend and backend run the same validators on the same payload, so the math has to be identical to round-trip.

## The premise

The Wave-4 persistence layer (tpb_entries log + mm_states cache + cron) is built. But several API endpoints still **run the engine server-side** — that's the bug. The routing pass moves compute to the client.

## Audit — where compute currently lives

| Endpoint | Today | Should it stay server-side? |
|---|---|---|
| `GET /api/world/state` | DB read + builds destinations from in-memory TP | **YES** — pure read |
| `GET /api/world/log` | DB read of `tpb_entries` | **YES** — pure read (replaced by railgun spectrum stream) |
| `POST /api/cron/tick` | Cranks clockwork + UPDATE worlds + appends `tick` action | **YES** — autonomous heartbeat, no client involved |
| `POST /api/world/transport` | Cranks clockwork + observeNode + writes log + snapshots MMs | **NO** — client computes Δ + receipt, server validates + appends |

Plus: **interactions / actions / combat** are not yet wired. Those should also be client-computed → server-appended from day one.

## Bundle is determined by invocation, not by allowlist

**Verified by reading the actual code (2026-04-30):** the entire `engine/` directory has ZERO database imports. No `@/db`, no `drizzle`, nothing. All 100 files are pure in-memory compute over TP + MM state. The DB boundary lives entirely in `src/lib/world-tpb.ts` (`attachWriteLog`, `appendAction`, `flushWriteLog`, `snapshotMm`) and `src/lib/world-state.ts` (the `worlds` row, `getWorldStatus`, `transportParty`, `cronTick`). So:

- The engine code itself has no client/server distinction — it'll bundle anywhere.
- The "player-observable subset" Pedro asked for is a SCOPING of operations the client INVOKES, not a list of files to ship.
- Tree-shaking determines the actual bundle from `engine-client.ts`'s import graph.

**What the client INVOKES (player-observable operations):**
| Operation | Engine API |
|---|---|
| Read TP κ at a node | `tp.resolve(nodeId)` → LocalContext (already pure read) |
| Crank own observation | `clockwork.observeNode(nodeId)` → ResolveResult[] (calls each MM's `.resolve(worldDay, tp)`) |
| Roll dice | `mfDice(formula, seed)` → `{ output, receipt }` |
| Skill check / attack | `mfCheck(...)` (chains from mfDice) |
| Damage roll | `mfDamage(...)` |
| Character state transition | mm-character methods (damage, healing, level-up, condition track) |
| Combat round | mm-scene methods (initiative, turn order, action resolution) |
| Capture κ writes during observe | re-use `attachWriteLog(tp, system)` from `src/lib/world-tpb.ts` — pattern is reusable; monkey-patches `tp.writeKappa`/`tp.writeDomain`. The captured `WorldTPBAction[]` becomes the append payload. |

**What the client NEVER invokes (server-only authority):**
| Operation | Why server-only |
|---|---|
| `clockwork.dailyTick()` / `clockwork.crankTo(targetDay)` | Time = `tick` action; cron-only |
| `clockwork.addPlayerTick()` | Only relevant to autonomous player-tick contribution counting |
| Autonomous accumulation across all MMs (`tickMMs`) | This IS the world tick |
| GM orchestration (`engine/gm.ts` 4 play modes) | Multi-actor coordination |
| NPC voicing (`engine/intelligence.ts` for non-party NPCs) | DM+AI authority |
| Narrative authoring (`engine/narrative.ts` arc/quest/beat orchestration) | DM-side scene gen |

**Crucial observation:** `Clockwork` already has the right separation. `dailyTick`/`crankTo` are tick-side (server). `observe(mmId)` and `observeNode(nodeId)` are observation-side (client). Clockwork ships fine — the client just doesn't call `dailyTick`. Same Clockwork class, different invocation set.

**DUAL (used identically on both sides):**
- `engine/tpb-world.ts` Zod schemas — wire format, validates same way both sides
- `engine/types.ts` — `Receipt`, `CycleDelta`, `ZERO_DELTA`
- `engine/tp.ts` — TP class instance; client gets read access + observation-time `writeKappa`/`writeDomain` (captured into the action buffer)
- `engine/tpb.ts` — `TPB.diff(a, b)` returns `divergenceIndex` ← this IS the merge/diff protocol (line 159)

## What "client computes, server writes" looks like

The canonical example today is [`src/lib/world-state.ts:139-208 transportParty()`](file:///D:/-ttrpg-engine/src/lib/world-state.ts). The split is already legible in that function — engine math vs DB writes are sequential within one function. Routing pass = move the engine half to the client, keep the DB half on the server.

**Today (server runs everything):**
```
POST /api/world/transport
  → transportParty()
      ├── state.clockwork.crankTo(...)       ┐
      ├── attachWriteLog(state.tp, ...)      ├── ENGINE MATH (lines 140-167)
      ├── state.clockwork.observeNode(...)   │
      ├── capture.detach()                   ┘
      ├── db.update(worlds)                  ┐
      ├── appendAction('entityMove', ...)    ├── DB WRITES (lines 173-198)
      ├── appendAction('observe', ...)       │
      ├── flushWriteLog(...)                 │
      └── for each resolved MM: snapshotMm() ┘
```

**After routing pass:**
```
[BROWSER engine-client.transport()]              [SERVER POST /api/world/append]
  1. const tp = clientTpFromState                  1. parse WorldTPBActionSchema.parse(actions)
  2. const cw = new Clockwork(tp, currentDay)      2. fetch current worlds row
  3. cw.crankTo(currentDay + days)                 3. verify atDay matches worlds.currentDay
  4. const cap = attachWriteLog(tp, 'transport')   4. verify partyMustBeAt matches worlds.partyNodeId
  5. const obs = cw.observeNode(destNodeId)        5. atomic transaction:
  6. cap.detach()                                       db.update(worlds) currentDay + partyNodeId
  7. produce actions:                                   bulk insert tpb_entries (entityMove, observe, captured writeKappas)
       { type: 'entityMove', from, to }                 for resolved MMs: snapshotMm
       { type: 'observe', nodeId, partyId }       6. emit envelope to railgun spectrum
       ...cap.entries (writeKappa[])              7. return { ok, persistedDay, ids[] }
  8. POST /api/world/append { atDay, actions[] } ──▶
                                                   IF mismatch (atDay differs from worlds.currentDay):
                                                     return 409 + tpb tail [fromDay, currentDay]
  9. on 409: client replays tail via TPB.diff →
     finds divergenceIndex → re-runs steps 3-7 from new head
```

The server's job is **shape-validation + state-coherence-check + atomic DB write + spectrum emit**. No engine compute. No receipt verification math (the receipt is a property of the dice/check action — server stores it as audit evidence, doesn't recompute it).

**On "receipt verification":** the .mf matrix produces R as a side-effect of the forward pass (`mf-dice.ts:117 mfDice()` returns `{ output, receipt }` with `verified: sum + mod === total`). The receipt's role server-side is *audit*, not *compute* — server stores `receipts[]` in the `tpb_entries.receipts` column (already in the schema per [`tpb.ts:35`](file:///D:/-ttrpg-engine/engine/tpb.ts)) so the chain is reproducible. Adversarial-client checks (e.g. did the client cheat the dice?) are a future concern — for v1, trust the client + log everything for forensic replay.

## Proposed routing

| Method | Path | Role | Compute? |
|---|---|---|---|
| GET | `/api/world/state` | Single-row snapshot | Read only |
| GET | `/api/world/log?limit=N&fromDay=X` | TPB entries for replay | Read only |
| GET | `/api/world/replay?fromDay=X&toDay=Y` | **NEW** — log slice for client hydration | Read only |
| ? | `/api/world/spectrum` | **NEW** — railgun orbit subscription (transport TBD per railgun-bridge.md rebuild) | Stream |
| POST | `/api/world/append` | **NEW** — "I computed these actions, here's the receipt" | Validate R + INSERT |
| POST | `/api/cron/tick` | Autonomous heartbeat | Server-only (no client involved) |
| POST | `/api/character/[id]/intent` | **NEW (later)** — player intent → client computes outcome → append | Validate + INSERT |

`POST /api/world/transport` becomes a thin wrapper or gets removed — its math moves to `engine-client.transport()` → `/api/world/append`.

## Browser-side engine adapter

New module: `src/lib/engine-client.ts`

Responsibilities:
- Bundles ONLY the player-observable subset (see list above)
- Hydrates from `/api/world/state` + `/api/world/log` (replay applies past Δs to local TP/MMs)
- Provides high-level methods: `transport(dest, mode, days)`, `observe(nodeId)`, `applyIntent(intent)`, `combatAction(...)`
- Each method: runs the .mf matrix locally → produces WorldTPBAction[] + receipt R → caller posts to `/api/world/append`
- Subscribes to railgun spectrum (replaces polling) — see `docs/railgun-bridge.md` for protocol primitives

Bundle implication: player-observable subset (~maybe 15-25 of the 33 engine files), not the full engine. World-tree MMs are tree-shaken out. Likely well under 200KB gzipped.

## React hook layer

`src/lib/use-world.ts`:
```ts
const { worldDay, partyNodeId, transport, observe, log } = useWorld()
```

Internally:
- Holds the `engine-client` instance
- Subscribes to railgun spectrum (each surface that mounts is an orbit on its cert)
- Re-renders when an envelope addressed to the player's cert lands
- Provides imperative methods (transport, observe, applyIntent) that POST to `/api/world/append`

`Play.tsx` and other surfaces consume `useWorld()` instead of calling fetch helpers directly.

## Validation pattern (server side) — coherence check, not receipt math

For each incoming `{ atDay, partyMustBeAt?, actions[] }`:
1. Parse via `WorldTPBActionSchema.parse(actions)` — Zod throws on shape violations. Same schema both sides → same math both sides.
2. **State coherence check** (envelope-level, not action-level):
   - `atDay` must equal current `worlds.currentDay`. If not → 409 + tail.
   - `partyMustBeAt` (if provided) must equal `worlds.partyNodeId`. If not → 409 + state.
3. **Per-action sanity check**:
   - `entityMove`: `from.nodeId` must equal `worlds.partyNodeId` for the party entity (other entities = no check, DM-spawned).
   - `observe`: `nodeId` must exist in TP.
   - `writeKappa`: `nodeId` must exist; `domain` must be a known `KappaDomain`.
   - `tick`: REJECT (only the cron path is allowed to send tick actions; carries `CRON_SECRET`).
   - `session`/`entitySpawn`/`entityDespawn`/`writeEdge`: shape-check only.
4. Atomic transaction:
   - bulk INSERT all actions into `tpb_entries`
   - UPDATE `worlds.partyNodeId` if `entityMove` changed party position
   - UPSERT `mm_states` for each MM the client snapshotted
5. Emit envelope to railgun spectrum
6. Return `{ ok: true, persistedDay, ids[] }`

**On 409:** client uses `TPB.diff()` against the returned tail to find `divergenceIndex`, replays missing entries through its local engine state, then re-derives its actions and retries. No merge — the engine is deterministic, so re-running from the new head produces a fresh, valid action set.

**No row locks. No receipt-recomputation. The .tpb is append-only, the engine is deterministic, the divergence-and-replay loop closes naturally.**

## Cron stays special

`/api/cron/tick` is the ONE endpoint the server still computes locally — by design. It runs without a client (Vercel Cron, scheduled). It's:
1. Read `worlds.currentDay`
2. Crank clockwork by N days (in-process)
3. UPDATE `worlds.currentDay` + `worlds.lastCronAt`
4. Append one `tick` action to `tpb_entries`
5. Emit `tick` envelope to railgun spectrum (every connected orbit sees the world clock advance)

No observation, no κ writes. Just the heartbeat. The client never produces a `tick` action.

## Implementation order (ready to build)

The 4 questions are resolved — can proceed.

**Engine surface to import on client:**
```ts
import { TP, type WorldNode } from '@/engine/tp'
import { Clockwork } from '@/engine/clockwork'
import { mfDice, mfDiceInverse } from '@/engine/mf-dice'
// ...mfCheck, mfDamage, mm-character, mm-scene, mm-followers as needed
import { WorldTPBActionSchema, type WorldTPBAction } from '@/engine/tpb-world'
import { TPB } from '@/engine/tpb'
import { type Receipt } from '@/engine/types'
```

**Server lib reuse:** `attachWriteLog` from [`src/lib/world-tpb.ts:57`](file:///D:/-ttrpg-engine/src/lib/world-tpb.ts) is generic — it just monkey-patches a TP. Either move it to `engine/` for client+server use, OR copy the same pattern into `src/lib/engine-client.ts`. (Move is cleaner; it's pure compute on a TP instance, no DB.)

**Push timing has two regimes** (see `project_cert_hierarchy.md` "DM-as-shard-host"):
- **Solo / dmless**: client posts `/api/world/slot/push` periodically; hourly cron drains
- **DM-hosted party session**: DM's computer acts as shard host during play; the entire session bundle is signed by DM cert and pushed at session end/pause; lands "in the past" of server time (expected — append-only .tpb absorbs out-of-order timestamps via worldline reconciliation)

**Build sequence:**

1. **Move/rename `attachWriteLog`** to `engine/tp-write-capture.ts` (or similar) so client + server share one impl. ✅ DONE
2. **Stand up the railgun bridge** — port/rebuild `bridge.ts` + `orchestrator.ts` per [`docs/railgun-bridge.md`](file:///D:/-ttrpg-engine/docs/railgun-bridge.md). Decide transport (SSE under the hood for v1, public API is "subscribe orbit / consume envelope" — transport is swappable).
3. **`GET /api/world/replay?fromDay=X&toDay=Y`** — paginated log slice; reuses `readTpbEntries` from `src/lib/world-tpb.ts`.
4. **`POST /api/world/append`** — Zod-validate `{ atDay, partyMustBeAt?, actions[] }`, do coherence checks, atomic insert, spectrum emit. New file `src/app/api/world/append/route.ts`.
5. **`src/lib/engine-client.ts`** — browser engine adapter:
   - `hydrate(state: WorldStatusClient, log: WorldTPBAction[])` → builds local TP + Clockwork at `state.worldDay`, replays log entries (applies past κ writes back into local TP)
   - `transport(destNodeId, timeMode, days)` → mirrors lines 140-167 of `transportParty`, returns `{ atDay, actions: WorldTPBAction[] }`
   - `observe(nodeId)` → captures κ during `clockwork.observeNode(nodeId)`, returns the action set
   - `roll(formula, seed?)` → returns `{ output, receipt }` from mfDice
6. **`src/lib/use-world.ts`** — React hook holding the engine-client instance + railgun spectrum subscription. Re-renders on envelope.
7. **Refactor [`Play.tsx`](file:///D:/-ttrpg-engine/src/components/design/surfaces/Play.tsx)** — replace `apiTransportParty()` (line 108) with `engineClient.transport() → /api/world/append`. The cron buttons (lines 491, 508) stay as-is. The mock `RECENT_LOG` and the manual `setEventLog` stitching come from the spectrum subscription.
8. **Delete or thin `/api/world/transport`** — once `Play.tsx` uses append. Keep route returning 410 Gone for any old client.
9. **Wire `Actions.tsx` slow-life intents** — chips fire `engineClient.applyIntent(...)` → POST append.

## Test approach

- **engine-client unit tests**: hydrate(state, log) + transport() → assert action shape + receipt verifies
- **/api/world/append integration tests**: post valid {actions, R} → expect INSERT + state update; post diverging R → expect 409 + tail returned
- **railgun spectrum tests**: cert subscribes, append fires envelope, orbit consumes — see `docs/railgun-bridge.md` test results section for prior proven scenarios
- **No "conflict resolution" tests** — there are no conflicts; only divergence-and-retry, which is just the receipt loop

## Acceptance criteria

After the routing pass:
- Server has zero engine compute except cron
- All player+DM actions go: client engine (player-observable subset) → POST /api/world/append → DB → spectrum broadcast
- Play.tsx state comes from `useWorld()` hook
- Existing surfaces still work (Auth, Chargen, Sheet, etc.)
- Bundle size: track but don't optimize aggressively
- No polling — railgun spectrum is the subscription primitive

## Things to DEFER past this pass

- TP hydration from `world_regions` table (TP nodes still constant in client + server module scope)
- κ snapshot projection to `world_regions.kappaJson` (read cache, not source-of-truth)
- mm-scene combat integration with mob-ai
- Tier 3+ surfaces (Banking, Caravans, Shipments, etc.)
- AI narrative generation for `gm-ai` persona

## Memory pointers for next chat

Read these in this order:
1. **`project_frontend_and_wave4.md`** ← current state (what's done)
2. **`project_next_routing_pass.md`** ← THIS file (the plan + Pedro's confirmed answers)
3. **`feedback_observation_writes.md`** ← the rule that's already shaped Wave-4 (and the routing pass continues it)
4. **`feedback_dont_trim_schema.md`** ← when in doubt, ADD; never DELETE
5. **`feedback_wired_means_wired.md`** ← surface fidelity discipline
6. **`feedback_read_docs_first.md`** ← READ docs/ before guessing protocol design
7. **`docs/railgun-bridge.md`** ← the flywheel protocol (mandatory before touching subscription/log code)
8. **`docs/MM-MF-TP-TPB.md`** ← .mf matrix, .tpb append-only, receipt theorems (mandatory before touching append/validate code)
9. **`project_ecology_substrate.md`** ← engine state pre-frontend (L0–L6 wraps)

## What Pedro wants to see when next chat finishes

1. Railgun bridge rebuilt (`bridge.ts` + `orchestrator.ts`) — spectrum stream live.
2. `/api/world/append` working end-to-end with receipt verification (transport via client engine).
3. `useWorld()` hook driving Play.tsx, subscribed via railgun spectrum (no polling).
4. Server compute gone except cron.
5. Tests green.

Then Pedro will pick the next pass — likely the slow-life intent wiring (`Actions.tsx` → engine-client → /api/world/append) or Tier 3 surface design.
