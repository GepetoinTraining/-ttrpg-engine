# Hub Topology: Live Hub Runtime + DM Coordination Layer

**Created in collaboration with ChatGPT, model: GPT-5.5 Thinking.**

## 0. Purpose

This document captures the proposed hub topology for a campaign engine where DM-led sessions usually lag behind autonomous server time, while selected live-server or coordinated DM activity can temporarily share a hub runtime.

The aim is not to build an always-on MMO simulation. The aim is to add a cheap, bounded live coordination layer that helps:

- the live server generate canonical consequences,
- one DM coordinate multiple groups,
- multiple DMs coordinate branch overlap,
- players share presence only when the topology and timeline allow it,
- the world remain seed + true deltas rather than a continuously hot global simulation.

## 1. Core Principle

A hub is not always live.

A hub becomes live only when observed, joined, or coordinated.

```text
No active observers → no hub runtime
Active observers → bounded hub runtime
Everyone leaves → freeze, verify, append semantic deltas
```

The hub runtime is a temporary checkout of canonical world geometry, not permanent authority over the world.

## 2. Main Objects

### 2.1 Canonical Hub

The canonical hub is the persistent world object.

It is reconstructed from:

```text
hub seed
+ accepted canonical deltas
+ TP ancestry/context
+ current server clock context
```

It stores the stable identity of the hub, but it does not need to hold an always-hot simulation process.

### 2.2 Hub Runtime

The hub runtime is a temporary shared compute pool.

It exists while players or DMs are actively observing or interacting with the hub.

```ts
type HubRuntime = {
  hubRuntimeId: string
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
canonical TP context
+ hub-local overlay
+ active observations
+ temporary presence
+ local tensor geometry
```

The local `.tp` may be mutable during runtime, but it is not itself canonical.

### 2.4 Hub Local TPB

Each active hub runtime records a local `.tpb` transcript.

```ts
type HubTPBEntry = {
  index: number
  hubRuntimeId: string
  sessionId: string
  actorCertId: string
  action: unknown
  receiptHash?: string
  beforeHash: string
  afterHash: string
  timestamp: string
}
```

The local `.tpb` is the ordered runtime transcript. At close, it becomes the basis for the commit bundle.

### 2.5 Neutral Hub Observer

The neutral observer is the hub runtime’s notary.

It should not be the DM.

It should not be a player.

It should not simulate the whole world.

Its role is only to hold the runtime lease, maintain ordered receipts, track `activeN`, and emit a commit bundle when the hub closes.

```text
clients compute
neutral observer orders
server verifies
canon appends
```

## 3. Alpha / Omega Geometry

A hub runtime begins from an agreed starting geometry:

```text
α = canonical hub tensor at runtime start
```

The runtime ends with a claimed terminal geometry:

```text
Ω_client = terminal geometry claimed by clients/runtime
Ω_server = terminal geometry reconstructed by replaying receipts from α
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

All clients must compute against the same `basisVersion`.

### 3.2 Hub Tensor

```ts
type HubTensor = {
  hubId: string
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

The tensor is a pressure field, not canonical history.

Canonical history remains typed deltas and TPB entries.

## 4. Runtime Lifecycle

### 4.1 Enter Hub

```text
client requests hub entry
server checks active runtime lease
if compatible runtime exists → join
else → create runtime from canonical head
client receives α tensor + local TP checkout
activeN increments
```

Compatibility means:

```text
same hub
same aperture
same canonical head or acceptable ancestor
compatible worldDay window
compatible DM/session visibility rules
```

### 4.2 While Active

During runtime:

```text
clients compute local actions
clients store observed slices in IndexedDB
clients submit receipts/actions to neutral observer
neutral observer orders receipts
hub-local TP/TPB updates live scene
DMs may coordinate shared visibility
```

The cloud process should do minimal work:

```text
track activeN
order receipts
maintain lease
broadcast ordered actions
persist compact transcript/checkpoints
```

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
bundle enters flywheel
server/drain replays receipts
if α → Ω matches → append canonical deltas
else → reject or preserve as unsupported branch
```

## 5. Commit Bundle

```ts
type HubCommitBundle = {
  hubRuntimeId: string
  hubId: string
  aperture: 'A4_HUB'
  canonicalHeadId: string
  alphaHash: string
  omegaHash: string
  basisVersion: string
  orderedReceipts: GeometryReceipt[]
  semanticDeltas: WorldDelta[]
  involvedSessionIds: string[]
  involvedCertIds: string[]
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
  op: string
  inputHash: string
  outputHash: string
  affectedIndices: number[]
  beforeHash: string
  afterHash: string
}
```

### 5.2 Semantic Delta

Only true deltas should be appended.

Examples:

```text
market supply changed
NPC goal changed
guild job posted
service contract opened
resource depleted
claim created
rumor learned
caravan arrived
monster threat changed
faction influence shifted
```

Do not append the full hub state unless doing explicit snapshot/cache storage.

## 6. Visibility Modes

### 6.1 Uncoordinated Groups

Uncoordinated DM groups do not automatically see each other.

They share consequences only after commit.

```text
Group A clears a gate
→ commit lowers danger
→ Group B later observes fewer threats / missing job / changed rumors
```

### 6.2 Coordinated Groups

Coordinated groups can join the same hub runtime if timeline and topology match.

```text
same hub
same compatible day/window
DMs opt in
runtime lease open
no contradictory locked canon
```

Then players can see each other live inside the shared hub runtime.

### 6.3 DMless Live-Server Character

DMless characters may play closer to live server time.

Their successful high-impact actions become canonical story shocks, but the player does not keep sovereign control over the resulting institution.

```text
action succeeds
→ canonical event enters lore
→ character is spent / retired / transformed into history
→ player restarts with inheritor
```

The player becomes a cause in history, not a maintenance daemon.

## 7. Suggested DB Additions

Minimal schema additions:

```ts
export const hubRuntimes = sqliteTable('hub_runtimes', {
  id: text('id').primaryKey(),
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
  actionJson: text('action_json').notNull(),
  receiptJson: text('receipt_json').notNull(),
  beforeHash: text('before_hash').notNull(),
  afterHash: text('after_hash').notNull(),
  createdAt: text('created_at').notNull(),
})
```

Optional cache table:

```ts
export const hubTensorSnapshots = sqliteTable('hub_tensor_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubId: text('hub_id').notNull(),
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

## 8. Browser IndexedDB Role

IndexedDB stores local checkouts and caches.

```text
cert metadata / key handles
observed but not interacted slices
hub α tensors
local TP overlays
pending receipts
local TPB branch entries
UI projections
```

Important distinction:

```text
reading can be cached
acting must be receipted
canon must be replayable
```

## 9. Cost-Control Rules

```text
No observation → no live hub compute
No activeN → no runtime
No valid receipt → no canon mutation
No semantic delta → no persistent world write
No matching α/Ω → no canonical append
```

Player activity may increase local browser computation and submitted receipts.

Player activity must not force unbounded server-side simulation.

## 10. Implementation Minimal Path

1. Add `hub_runtimes` table.
2. Add `hub_runtime_receipts` table.
3. Add `activeN` lease logic.
4. Create `GET /api/hub/:hubId/runtime`.
5. Create `POST /api/hub/:hubId/join`.
6. Create `POST /api/hub/:hubId/receipt`.
7. Create `POST /api/hub/:hubId/leave`.
8. On `activeN == 0`, close runtime after timeout.
9. Emit `HubCommitBundle` to flywheel.
10. Drain bundle into canonical TPB only after α → Ω replay succeeds.

## 11. Minimal Wiring Estimate

This should require minimal new conceptual wiring because most pieces already exist:

```text
TP              already provides local topology/context
TPB             already provides append-only branch/history
flywheelSlots   already provide delayed canonicality membrane
WorldTPBAction  already provides typed world actions
receipts        already exist at MF/dice/action level
Clockwork/MM    already model observed/unobserved dynamics
IndexedDB       already stores certs and observed slices
```

The new layer mainly adds:

```text
hub runtime lease
activeN tracking
alpha/omega hashes
neutral observer ordering
hub tensor basis/version
commit bundle generation
```

## 12. One-Sentence Architecture

A hub runtime is a temporary shared checkout of canonical hub geometry: clients compute locally from α, a neutral observer orders receipts while `activeN > 0`, and when the hub closes the server replays α → Ω and appends only true semantic deltas to the canonical worldline.
