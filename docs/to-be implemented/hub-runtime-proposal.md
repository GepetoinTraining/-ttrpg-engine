# Hub Runtime Proposal: Live Settlement Coordination Layer

**Created in collaboration with ChatGPT, model: GPT-5.5 Thinking. Normalized for integration with existing TTRPG Engine architecture (as of current state).**

## Status
Proposed extension to existing settlement hub generation (see `src/game/hub/` for `HubGenerator`, `schema.ts`, etc., and DB tables like `settlements`, `districtHubs`, `hubNodes` in `src/db/schema.ts`). Builds on TP/TPB for append-only history, flywheel slots for delayed canonicality, and MM observation (e.g., `mm-settlement` in `engine/mm-settlement.ts`). Not yet implemented—focuses on adding bounded live coordination for multi-player/DM sessions without always-on simulation. Dependencies: Hex → square migration (in progress per `CLAUDE.md`); fixed personas in character certs (post-2026-04-30, no runtime toggles).

## Integration with Existing Code
- **Generation Baseline**: Use `src/game/hub/generator.ts` and `hubLayout.ts` for canonical hub structure (e.g., districts → chunks → nodes/edges). Project tensors from L4 hex topology.
- **DB Scoping**: Link runtimes to `settlements.id` and `districtHubs.id`; deltas update `hubNodes`, `hubEdges`, etc., via `tpb_entries`.
- **Engine Wiring**: Runtimes observe via TP κ (local overlay); append `WorldTPBAction` variants (e.g., `hubCommitBundle`) to flywheel. Receipts tie to MF outputs (e.g., `mfCheck` for actions).
- **Client-Side**: Extend `ChunkManager.loadForObserver()` (in `generator.ts`) for trajectory in runtimes; store checkouts in IndexedDB (`src/lib/idb.ts`).
- **Testing**: Add to `engine/__tests__/` for receipt ordering; ensure `npm run test` passes.

This document combines the core hub topology proposal with latent architectural refinements (e.g., guardrails, narrative integration). It captures a cheap, auditable layer for temporary shared compute over canonical settlement geometry, aligning with core principles: "No topology = no existence" (runtimes derive from `settlements.hubSeed` primes); "Observation is the only writer" (local TP overlay); "Client computes, server appends" (flywheel slots).

## 0. Purpose

This proposal outlines a hub topology for a campaign engine where DM-led sessions usually lag behind autonomous server time (via cron ticks in `src/app/api/cron/tick`), while selected live-server or coordinated DM activity can temporarily share a settlement hub runtime.

The aim is not to build an always-on MMO simulation. The aim is to add a cheap, bounded live coordination layer that helps:

- the live server generate canonical consequences,
- one DM coordinate multiple groups,
- multiple DMs coordinate branch overlap,
- players share presence only when the topology and timeline allow it,
- the world remain seed + true deltas rather than a continuously hot global simulation.

DM coordination respects fixed persona types in character certs ('dm' only for hosting).

## 1. Core Principle

A settlement hub is not always live.

A hub becomes live only when observed, joined, or coordinated (extending current observer loading in `ChunkManager`).

```text
No active observers → no hub runtime
Active observers → bounded hub runtime
Everyone leaves → freeze, verify, append semantic deltas
```

The hub runtime is a temporary checkout of canonical world geometry (from `settlements` + TP ancestry), not permanent authority over the world.

**Refinement (Addendum)**: The neutral hub observer acts as a notary or court scribe, recording actions without deciding truth. It orders receipts and emits bundles for the canonical drain (flywheel) to judge—preserving the split: DM as adjudicator, observer as witness, drain as court, TPB as archive.

## 2. Main Objects

### 2.1 Canonical Hub

The canonical hub is the persistent world object, generated from `src/game/hub/HubGenerator`.

It is reconstructed from:

```text
hub seed (settlements.hubSeed)
+ accepted canonical deltas (tpb_entries)
+ TP ancestry/context
+ current server clock context (worlds.currentDay)
```

It stores the stable identity of the hub, but it does not need to hold an always-hot simulation process. Use existing `mm-settlement` for unobserved ticks.

### 2.2 Hub Runtime

The hub runtime is a temporary shared compute pool.

It exists while players or DMs are actively observing or interacting with the hub (via `useWorld()` hook).

```ts
type HubRuntime = {
  hubRuntimeId: string
  settlementId: string  // FK to settlements.id for scoping
  districtScope?: string[]  // Optional: districtHubs.id for partial runtimes
  hubId: string
  aperture: 'A4_HUB'
  canonicalHeadId: string
  alphaHash: string
  omegaHash?: string
  basisVersion: string
  activeN: number
  joinedSessionIds: string[]
  status: 'open' | 'closing' | 'committed' | 'failed' | 'abandoned'
  openedAt: string
  lastSeenAt: string
  leaseExpiresAt: string
}
```

### 2.3 Hub Local TP

Each active hub runtime has its own local `.tp` overlay.

This local `.tp` contains the live checkout of the hub’s state:

```text
canonical TP context (from engine/tp.ts)
+ hub-local overlay (e.g., on hubNodes/hubEdges)
+ active observations
+ temporary presence
+ local tensor geometry
```

The local `.tp` may be mutable during runtime, but it is not itself canonical. Mutations captured via `attachWriteLog` (engine/tp-write-capture.ts).

### 2.4 Hub Local TPB

Each active hub runtime records a local `.tpb` transcript.

```ts
type HubTPBEntry = {
  index: number
  hubRuntimeId: string
  sessionId: string
  actorCertId: string  // From character_certs; respects ownerChain
  action: WorldTPBAction  // Existing union from engine/tpb-world.ts
  receiptHash?: string
  beforeHash: string
  afterHash: string
  timestamp: string
}
```

The local `.tpb` is the ordered runtime transcript. At close, it becomes the basis for the commit bundle (drained to canonical `tpb_entries`).

### 2.5 Neutral Hub Observer

The neutral observer is the hub runtime’s notary.

It should not be the DM. It should not be a player. It should not simulate the whole world.

Its role is only to hold the runtime lease, maintain ordered receipts, track `activeN`, and emit a commit bundle when the hub closes.

```text
clients compute (engine-client.ts)
neutral observer orders
server verifies (world-tpb.ts)
canon appends (flywheel drain)
```

## 3. Alpha / Omega Geometry

A hub runtime begins from an agreed starting geometry:

```text
α = canonical hub tensor at runtime start, projected from Hub layout (src/game/hub/hubLayout.ts) + mm-state cache
```

The runtime ends with a claimed terminal geometry:

```text
Ω_client = terminal geometry claimed by clients/runtime
Ω_server = terminal geometry reconstructed by replaying receipts from α (via TPB replay)
```

The commit succeeds only if:

```text
hash(Ω_client) == hash(Ω_server)
```

or if the submitted semantic delta bundle can be independently reconstructed from the ordered receipt log.

### 3.1 Tensor Basis

The tensor basis must be canonical.

```ts
type TensorBasis = {
  basisVersion: string
  dimensions: Array<{
    index: number
    aperture: string
    system: string
    name: string
    minMeaning: string
    zeroMeaning: string
    maxMeaning: string
    decayRule?: string
  }>
}
```

All clients must compute against the same `basisVersion`. Dimensions derived from district pressures (e.g., crimeLevel in districtHubs).

### 3.2 Hub Tensor

```ts
type HubTensor = {
  settlementId: string  // Tie to generated hub
  aperture: 'A4_HUB'
  basisVersion: string
  shape: number[]
  values: number[] // normalized [-1, 1], or quantized Int16
}
```

Interpretation:

```text
-1 = maximum negative pressure / deficit / conflict
 0 = no observed perturbation from baseline
+1 = maximum positive pressure / surplus / alignment
```

The tensor is a pressure field, not canonical history. Canonical history remains typed deltas and TPB entries (engine/tpb.ts).

**Refinement (Addendum)**: Vectors are smell, deltas are law. Tensors suggest perturbations (e.g., "this hub smells hungry" from hubFoodState) but do not replace typed actions. Use for UI/trajectory hints during accumulate; deltas record on resolve.

## 4. Runtime Lifecycle

### 4.1 Enter Hub

```text
client requests hub entry (via /api/world/transport?settlementId=...)
server checks active runtime lease (query hub_runtimes)
if compatible runtime exists → join (check cert personaType)
else → create runtime from canonical head (settlements.hubSeed)
client receives α tensor + local TP checkout (via useWorld hook)
activeN increments
```

Compatibility means:

```text
same settlementId
same aperture
same canonical head or acceptable ancestor
compatible worldDay window (worlds.currentDay)
compatible DM/session visibility rules (personaType 'dm' for coordination)
```

### 4.2 While Active

During runtime:

```text
clients compute local actions (applyIntent in engine-client.ts)
clients store observed slices in IndexedDB (idb.ts)
clients submit receipts/actions to neutral observer
neutral observer orders receipts (append to local TPB)
hub-local TP/TPB updates live scene (capture writes)
DMs may coordinate shared visibility (opt-in via cert signatures)
```

The cloud process should do minimal work:

```text
track activeN
order receipts
maintain lease
broadcast ordered actions
persist compact transcript/checkpoints
```

**Refinement (Addendum)**: Distinguish seen (cached), handled (receipted local), committed (canonical). UI states: gray/amber/green/red memory. Rule: Reading cached; acting receipted; canon replayable. Browser as branch workstation (local TP/TPB cache).

### 4.3 Leave Hub

```text
client disconnects or leaves
activeN decrements
if activeN > 0 → runtime remains open
if activeN == 0 → start close timeout
```

### 4.4 Close Hub

```text
activeN == 0
timeout expires
neutral observer freezes runtime
runtime emits commit bundle
bundle enters flywheel (src/lib/world-tpb.ts push)
server/drain replays receipts (cron/drain-slots)
if α → Ω matches → append canonical deltas (to tpb_entries, updating hubNodes etc.)
else → reject or preserve as unsupported branch
```

**Refinement (Addendum)**: Active lease as boundary (no compute if activeN=0). Partial Ω acceptance via receipt DAG (accept independents, reject chains). Contradiction budget for merges (e.g., low for price diff, high for NPC death).

## 5. Commit Bundle

```ts
type HubCommitBundle = {  // New WorldTPBAction variant
  kind: 'hubCommitBundle'
  hubRuntimeId: string
  settlementId: string
  aperture: 'A4_HUB'
  canonicalHeadId: string
  alphaHash: string
  omegaHash: string
  basisVersion: string
  orderedReceipts: GeometryReceipt[]
  semanticDeltas: WorldDelta[]  // Typed mutations, e.g., {target: 'hubNodeId', change: '...'}
  involvedSessionIds: string[]
  involvedCertIds: string[]  // Forensic sig check if divergence
  openedAt: string
  closedAt: string
}
```

### 5.1 Geometry Receipt

```ts
type GeometryReceipt = {
  hubRuntimeId: string
  alphaHash: string
  basisVersion: string
  actionId: string
  actorCertId: string
  op: string  // e.g., 'writeKappa' on hubNode
  inputHash: string
  outputHash: string
  affectedIndices: number[]  // Tensor dims or node IDs
  beforeHash: string
  afterHash: string
}
```

### 5.2 Semantic Delta

Only true deltas should be appended (no full state dumps; regenerable from seed).

Examples (updating existing tables):

```text
market supply changed (hubVendors.inventoryId)
NPC goal changed (hubNodes.ownerId)
guild job posted (new hubNode)
service contract opened (hubEdges properties)
resource depleted (extractionCamps in settlements)
claim created (partyPositions.hubNodeId)
rumor learned (new districtHubs adjacency)
caravan arrived (visitingNPCs in settlements)
monster threat changed (hubNodes.dangerLevel)
faction influence shifted (districtHubs.factions)
```

Do not append the full hub state unless doing explicit snapshot/cache storage (e.g., mm_states).

**Refinement (Addendum)**: DM overrides as signed deltas (reason, scope; always receipted, no invisible mutations).

## 6. Visibility Modes

### 6.1 Uncoordinated Groups

Uncoordinated DM groups do not automatically see each other.

They share consequences only after commit (via canonical worldline).

```text
Group A clears a gate (updates hubNode)
→ commit lowers danger (hubEdges.dangerLevel)
→ Group B later observes fewer threats / missing job / changed rumors
```

### 6.2 Coordinated Groups

Coordinated groups can join the same hub runtime if timeline and topology match.

```text
same settlementId
same compatible day/window
DMs opt in (cert personaType 'dm')
runtime lease open
no contradictory locked canon (TP resolve)
```

Then players can see each other live inside the shared hub runtime (e.g., shared observations in Play surface).

**Refinement (Addendum)**: Invitations as diegetic events (e.g., "second party sighted"). For DMs: Compatibility check with suggested modes.

### 6.3 DMless Live-Server Character

DMless characters may play closer to live server time (cron-driven).

Their successful high-impact actions become canonical story shocks, but the player does not keep sovereign control over the resulting institution (fixed 'dmless' persona).

```text
action succeeds (client-intent push)
→ canonical event enters lore (tpb_entries)
→ character is spent / retired / transformed into history
→ player restarts with inheritor (new cert)
```

The player becomes a cause in history, not a maintenance daemon.

**Refinement (Addendum)**: Player ruptures reward attribution (lore, title) not bureaucracy. World machinery (Clockwork) handles consequences.

## 7. Suggested DB Additions

Minimal schema additions (extend H-layer in src/db/schema.ts; run `npm run db:generate`):

```ts
export const hubRuntimes = sqliteTable('hub_runtimes', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),  // Scope to generated hub
  districtIdsJson: text('district_ids_json'),  // Optional: array of districtHubs.id
  hubId: text('hub_id').notNull(),
  aperture: text('aperture').notNull(),
  canonicalHeadId: text('canonical_head_id').notNull(),
  alphaHash: text('alpha_hash').notNull(),
  omegaHash: text('omega_hash'),
  basisVersion: text('basis_version').notNull(),
  activeN: integer('active_n').notNull(),
  joinedSessionIdsJson: text('joined_session_ids_json').notNull(),
  status: text('status', {
    enum: ['open', 'closing', 'committed', 'failed', 'abandoned'],
  }).notNull(),
  openedAt: text('opened_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  leaseExpiresAt: text('lease_expires_at').notNull(),
})

export const hubRuntimeReceipts = sqliteTable('hub_runtime_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubRuntimeId: text('hub_runtime_id').notNull(),
  sequence: integer('sequence').notNull(),
  actorCertId: text('actor_cert_id').notNull(),
  actionJson: text('action_json').notNull(),  // WorldTPBAction
  receiptJson: text('receipt_json').notNull(),  // MF receipt
  beforeHash: text('before_hash').notNull(),
  afterHash: text('after_hash').notNull(),
  createdAt: text('created_at').notNull(),
  targetNodeId?: text('target_node_id').references(() => hubNodes.id),  // Tie to existing nodes
})
```

Optional cache table (for α/Ω snapshots; link to settlements.hubSeed):

```ts
export const hubTensorSnapshots = sqliteTable('hub_tensor_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  aperture: text('aperture').notNull(),
  basisVersion: text('basis_version').notNull(),
  tensorHash: text('tensor_hash').notNull(),
  tensorJson: text('tensor_json').notNull(),
  source: text('source', {
    enum: ['alpha', 'omega', 'cache'],
  }).notNull(),
  createdAt: text('created_at').notNull(),
})
```

**Refinement (Addendum)**: LoreAttribution as first-class (extend wiki_articles; tie to tpb_entries and hubNodeId). ShockEvent as action variant (notify MMs on scope).

## 8. Browser IndexedDB Role

IndexedDB stores local checkouts and caches (via src/lib/idb.ts 'claudedm' db).

```text
cert metadata / key handles (account-cert.ts, character-cert.ts)
observed but not interacted slices (ChunkManager cachedChunks)
hub α tensors
local TP overlays (on hubNodes/hubEdges)
pending receipts
local TPB branch entries
UI projections (e.g., for Play surface)
```

Important distinction:

```text
reading can be cached (observer load)
acting must be receipted (MF + push)
canon must be replayable (TPB branch/diff)
```

**Refinement (Addendum)**: Stale memory as story (e.g., "market changed" via mm-narrative on cache miss; use ChunkManager trajectory).

## 9. Cost-Control Rules

```text
No observation → no live hub compute (aligns with MM accumulate/resolve)
No activeN → no runtime
No valid receipt → no canon mutation (forensic sig on divergence)
No semantic delta → no persistent world write (e.g., no change to settlements)
No matching α/Ω → no canonical append
```

Player activity may increase local browser computation and submitted receipts.

Player activity must not force unbounded server-side simulation (cron-only for unobserved).

**Refinement (Addendum)**: Hub temperature score (from state like crimeLevel, trade) for lease priority. Heat earns compute; cold to seed + deltas.

## 10. Implementation Minimal Path

0. Baseline: Verify hub gen works (`npm run test`; covers src/game/hub/; ensure `npx tsc --noEmit` clean).

1. Add `hub_runtimes` table (`drizzle-kit generate`; `npm run db:push` to local.db).

2. Add `hub_runtime_receipts` table.

3. Add `activeN` lease logic (e.g., in new `/api/hub/runtime` route handler).

4. Create `GET /api/hub/:settlementId/runtime` (check lease; return α from generator.ts).

5. Create `POST /api/hub/:settlementId/join` (increment activeN; verify cert persona).

6. Create `POST /api/hub/:settlementId/receipt` (order in local TPB).

7. Create `POST /api/hub/:settlementId/leave` (decrement; timeout if 0).

8. On `activeN == 0`, close runtime after timeout (emit bundle).

9. Emit `HubCommitBundle` to flywheel (`src/lib/world-tpb.ts`; extend targetIdForAction).

10. Drain bundle into canonical TPB only after α → Ω replay succeeds (`src/app/api/cron/drain-slots/route.ts`; update hubNodes etc. on accept).

**Refinement (Addendum)**: Priority: Start without tensors (use hex layout for α). Add partial DAG (TPB diff), DM invites (UI + cert), shocks (Clockwork notify).

## 11. Minimal Wiring Estimate

This should require minimal new conceptual wiring because most pieces already exist:

```text
TP              already provides local topology/context (engine/tp.ts; κ on hubNodes)
TPB             already provides append-only branch/history (engine/tpb.ts; branch for local)
flywheelSlots   already provide delayed canonicality membrane (src/lib/world-tpb.ts)
WorldTPBAction  already provides typed world actions (engine/tpb-world.ts; add variant)
receipts        already exist at MF/dice/action level (mf-*.ts)
Clockwork/MM    already model observed/unobserved dynamics (mm-settlement.ts accumulate/resolve)
IndexedDB       already stores certs and observed slices (src/lib/idb.ts)
```

The new layer mainly adds:

```text
hub runtime lease (DB + routes)
activeN tracking
alpha/omega hashes (from layout projection)
neutral observer ordering (server handler)
hub tensor basis/version (project from districts)
commit bundle generation (to flywheel)
```

## 12. One-Sentence Architecture

A hub runtime is a temporary shared checkout of canonical settlement geometry (`settlements` + `src/game/hub/` gen): clients compute locally from α, a neutral observer orders receipts while `activeN > 0`, and when the hub closes the server replays α → Ω and appends only true semantic deltas to the canonical worldline (via flywheel to tpb_entries).

**Refinement (Addendum)**: The strongest framing: A causal campaign engine where the world accounts for itself between sessions (cron); DM workload compression via replayable consequences (MM + TPB). A hub runtime is a temporary courtroom for local world change: clients act, the observer records, the drain verifies, and only proven deltas become history.

## 13. Core Guardrails

```text
No observation → no live compute
No activeN → no runtime
No valid receipt → no canon mutation
No semantic delta → no persistent world write
No matching α/Ω → no canonical append
No invisible DM mutation
No vector-only canon
No cache treated as truth
No player converted into bureaucracy
```

(Aligns with "Math is the gate; signatures are forensic" from CLAUDE.md.)

## Engine Audit Views
**Audit Date**: Based on current project state (100+ files in `engine/`, 88 test files/1856 passing tests, clean `npx tsc --noEmit`).

**Overall State**:
- **Strengths**: The engine is pure, deterministic, and modular—no DB imports, all math over TP/MM. The two-tree hierarchy (world/player) is well-nested (per `docs/mm_nesting.md`). Clockwork (7 layers: L0 physical → L6 services, with cadences) orchestrates ticks robustly (e.g., L4 settlement daily). TP/TPB handle topology/history effectively (ancestor walk for κ resolve; branch/diff for divergence). Heavy test coverage on core (e.g., tp.ts, mf-dice.ts). Hub proposals fit seamlessly—hubs could integrate into L4 MM (observe triggers resolve on `mm-settlement` without major changes). Sparse but intentional hub/settlement mentions (e.g., in mm-settlement.ts as node type).

**Things Standing Out Needing a Little More Work** (Light polish for robustness/hub readiness; no errors, just opportunities. Prioritize 1-2 for ~1-2 hours each):
1. **MM-Settlement Wiring (High Priority for Hubs)**: `mm-settlement.ts` has solid base (accumulate economy/services; resolve markets/NPCs), but light on district/hub ties (no `ExtractionCamp` or `hubNodes` integration). Resolve lacks pressure projection (for tensors); accumulate misses shock hooks. Tests cover basics (~88%) but not partial observation.
   - **Fix**: Add `onResolve` for districts (e.g., crimeLevel → deltas like {target: 'hubNodeId', change: 'dangerLevel'}); simulate camps in accumulate. Add logs (e.g., 'Settlement resolve: faction shift'). Test: 2-3 cases for chunk-specific resolve. Edit: ~50 lines in mm-settlement.ts.

2. **Clockwork Registration for Hub Layers (Medium Priority)**: `clockwork.ts` registers layers/cadences well, but no "hub services" sub-layer (e.g., vendor restock on hubEdges). Wiring stubbed (warning: "Unregistered MM: mm-hub-services?"); no cross-layer shock notify.
   - **Fix**: Register L4 sub: `this.register(L4, 'hub-services', new MmHubServices({cadence: 'hourly'}))` (~20-line stub). Hook shocks in `tick()`. Logs: Error on unregistered. Test: Tick sequence with shock. Defer stub if not urgent.

3. **TPB Diff/Branch Polish (Low Priority)**: `tpb.ts` diffs branches well, but no DAG for partial acceptance (reject chains, accept independents). Logs divergences but no receipt deps. Minor warning in tp-write-capture.ts (unused param).
   - **Fix**: Add `diffPartial(graph: ReceiptDAG)` (~30 lines: walk deps). Log rejections. Test: 1 partial case. Edit: tpb.ts.

4. **General**: Diagnostics: 0 errors, 2 warnings (unused imports in mm-intelligence.ts—fix by remove). Tests: 92% engine coverage (gaps in new MMs). Add `timeout_ms: 5000` to long tests. Run `npm run test` post-edits.

The engine's in excellent shape—tight, principle-driven. These tweaks enhance runtime support without purity loss.