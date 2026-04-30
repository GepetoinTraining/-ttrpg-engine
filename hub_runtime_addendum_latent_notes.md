# Hub Runtime Addendum: Latent Architecture Notes

**Created in collaboration with ChatGPT, model: GPT-5.5 Thinking.**

This addendum preserves the second layer of ideas that emerged after the initial hub topology document. These are not necessarily first-pass implementation requirements. They are architectural pressure points, naming conventions, and guardrails for keeping the live hub model cheap, auditable, and useful to DMs.

## 1. Hub Runtime as Court Record, Not Compute Authority

The neutral hub observer should be understood less like a simulation server and more like a **notary** or **court scribe**.

It does not decide world truth.

It records:

```text
who was present
what α they agreed to
what actions were submitted
what order they occurred in
what receipts were attached
what Ω was claimed
```

The canonical drain is the judge:

```text
replay
accept
reject
partially accept
append
```

This gives a clean technical and narrative split:

```text
DM              = local adjudicator
Hub observer    = witness / notary
Flywheel drain  = canon court
TPB             = archive
```

This prevents the neutral observer from becoming an accidental god-object.

## 2. Observed, Handled, Committed

The engine should distinguish three grades of world memory.

```text
seen        = cached observation, no causal claim
handled     = local manipulation, requires receipt if pushed
committed   = accepted into canonical worldline
```

Possible UI states:

```text
gray memory   = you saw this
amber memory  = you acted here, pending canon
green memory  = accepted into worldline
red memory    = rejected or contradicted by canon
```

This maps directly to IndexedDB storage:

```text
observed slices       → safe stale cache
pending branches      → receipt-bearing local claims
canonical projection  → accepted worldline result
```

Rule:

```text
Reading can be cached.
Acting must be receipted.
Canon must be replayable.
```

## 3. Stale Memory as Story

If a player’s cached local slice differs from canon, the system should not expose the conflict as only a technical cache mismatch.

Turn it into narrative reconciliation:

```text
“Your memory of the market is stale.”
“Rumors say the mine dried up.”
“The guild board has changed since you last saw it.”
“The road is no longer safe.”
“The innkeeper you remember has left town.”
```

Mechanically:

```text
local cached projection != canonical projection
→ produce delta-aware narrative explanation
```

This turns cache invalidation into world texture.

## 4. Lore Attribution as a First-Class Object

If players can create historical ruptures, attribution should not live only in wiki prose.

Create a first-class lore attribution object:

```ts
type LoreAttribution = {
  id: string
  eventTpbId: string
  actorCertId: string
  characterId: string
  publicName: string
  deedType: string
  titleGranted?: string
  inheritorHook?: string
  visibility: 'local' | 'regional' | 'global' | 'secret'
}
```

This object can feed:

```text
wiki entries
guild rumors
bard songs
faction grudges
inheritor creation
quest generation
NPC reactions
regional history
```

The player reward becomes permanent causal authorship, not bureaucratic control.

Rule:

```text
Players can become causes in history.
They do not become maintenance daemons.
```

## 5. Canonical Shock Events

Some actions should not be modeled as ordinary small deltas only. They should become **shock events** that force multiple systems to re-evaluate.

Examples:

```text
king dies
gate permanently cleared
god loses temple network
trading company collapses
dragon migrates into trade corridor
bank vault is emptied
major bridge is destroyed
capital city changes hands
```

Possible type:

```ts
type ShockEvent = {
  id: string
  scope: 'hub' | 'region' | 'kingdom' | 'continent'
  magnitude: number
  affectedSystems: string[]
  causeTpbId: string
  attributionId?: string
  worldDay: number
}
```

A shock event should not hard-code all outcomes. Instead, it should notify systems that a major causal rupture occurred.

Example:

```text
Shock: king dies

Faction system:
  succession pressure

Market system:
  risk premium, hoarding, liquidity shift

Guild system:
  escort, investigation, bounty jobs

Religion system:
  omen, funeral rites, legitimacy claims

Warfare system:
  mobilization and readiness changes

NPC intent:
  fear, ambition, migration, opportunism
```

## 6. Hub Temperature

Not every hub deserves the same compute attention.

Use a cheap temperature score:

```text
hubTemperature =
  active players
+ unresolved shocks
+ pending jobs
+ trade volume
+ faction contest
+ danger level
+ recent commits
+ active DM coordination
```

High-temperature hubs may receive:

```text
longer leases
more frequent resolution
pre-warmed projections
better sync discovery
more narrative summaries
```

Low-temperature hubs should collapse aggressively:

```text
no observers
no unresolved shocks
low trade
low danger
no open jobs
→ hibernate / cache only / seed + deltas
```

Rule:

```text
Heat earns compute.
Cold returns to seed + deltas.
```

## 7. DM Coordination Invitations as World-Native Events

DM coordination should not feel like an infrastructure panel only.

The system can expose sync opportunities diegetically.

For players:

```text
“A second party has been sighted near the East Gate.”
“The guild reports another group operating in this district.”
“You hear unfamiliar adventurers arguing with the same caravan master.”
```

For DMs:

```text
Another DM has an active branch in the same hub/day window.
Potential shared scene:
- Hub: Suzail East Gate
- Window: Day 481, evening
- Compatibility: high
- Suggested mode: shared observation
```

The coordination prompt becomes a story affordance:

```text
Uncoordinated groups share consequence.
Coordinated groups may share observation.
Canonical worldline remains append-only.
```

## 8. Partial Ω Acceptance

The clean invariant is:

```text
accept iff α → Ω replays exactly
```

But in real sessions, partial acceptance may be useful.

Example:

```text
valid:
  item bought
  rumor learned
  NPC moved

invalid:
  console-injected gold
```

If receipts form a dependency graph, the drain can accept valid subgraphs and reject invalid branches.

Possible model:

```text
Receipt DAG:
  A valid
  B valid
  C invalid because it depends on fake state
  D rejected because it depends on C
  E valid because independent
```

This prevents one bad mutation from destroying an entire hub runtime.

Rule:

```text
Reject unsupported causality, not necessarily the whole session.
```

## 9. Contradiction Budget for Branch Merging

When two DM branches coordinate after diverging, exact merge may fail.

Instead of binary compatible/incompatible, assign contradiction cost.

Examples:

```text
market price differs                  low contradiction
weather differs                       low / medium contradiction
NPC location differs                  medium contradiction
resource depleted mismatch            medium / high contradiction
same NPC alive/dead                   high contradiction
king alive/dead                       catastrophic contradiction
major gate cleared/uncleared          high contradiction
```

The system can then classify merge options:

```text
safe co-observation
shared rumors only
shared economy only
requires DM adjudication
cannot merge
```

This helps DM-DM coordination without pretending all branches are naturally compatible.

## 10. Vectors Are Smell, Deltas Are Law

The tensor/vector layer is valuable, but it must not replace canonical history.

Core rule:

```text
Vectors are smell.
Deltas are law.
Receipts are proof.
TPB is memory.
```

The vector/tensor field helps the engine notice:

```text
this hub smells hungry
this region smells dangerous
this market smells unstable
this faction smells ready to move
this road smells profitable
this settlement smells like migration pressure
```

But canonical events remain typed.

Correct division:

```text
high-dimensional pressure → suggests
typed delta                → records
receipt                    → proves
TPB                        → remembers
```

## 11. DM Override as a Signed Delta

DMs need override authority, but overrides should not bypass the architecture.

A DM override should be canon-capable but never invisible.

```ts
type DMOverrideDelta = {
  dmCertId: string
  reason: string
  target: string
  beforeHash: string
  afterHash: string
  scope: 'session' | 'hub' | 'region' | 'kingdom'
  worldDay: number
}
```

This preserves human authority while maintaining auditability.

Rule:

```text
DM override is allowed.
Invisible mutation is not.
```

## 12. Live Server Is Not the Product Claim

The strongest framing is not “live world.”

The stronger framing:

```text
A causal campaign engine that lets the world account for itself between sessions.
```

Or:

```text
A DM workload compression engine where economy, ecology, factions, NPCs, and player actions produce replayable world consequences.
```

The live world behavior emerges from the architecture, but the actual value is:

```text
The DM stops being the only memory, scheduler, accountant, and consequence engine.
```

## 13. Player Historical Rupture Model

A high-level DMless player may act on the live server and create major world consequences.

But they should not become the long-term actor that manages the aftermath.

Example:

```text
player kills the king
→ event enters lore
→ factions react
→ succession pressure begins
→ guilds post jobs
→ markets destabilize
→ NPCs shift allegiance
→ player character is retired/spent/transformed
→ player returns through inheritor path
```

Reward:

```text
permanent lore attribution
title
relic
bloodline
rumor footprint
wiki entry
inheritor hook
```

Not reward:

```text
tax policy
court scheduling
army payroll
grain logistics
bureaucratic control
```

Rule:

```text
Players can make history.
The world machinery manages history’s consequences.
```

## 14. Active Hub Lease as Cheap Compute Boundary

A hub runtime should only exist while there is an active lease.

```text
No activeN → no runtime
No runtime → no live compute
No live compute → seed + accepted deltas only
```

Minimal active lease fields:

```ts
type HubRuntimeLease = {
  hubRuntimeId: string
  hubId: string
  aperture: string
  alphaHash: string
  canonicalHeadId: string
  activeN: number
  joinedSessionIds: string[]
  status: 'open' | 'closing' | 'committed' | 'failed' | 'abandoned'
  leaseExpiresAt: string
}
```

The lease is not world truth. It is only the right to temporarily coordinate a live checkout.

## 15. Browser as Branch Workstation

The browser should be allowed to store and compute a lot.

IndexedDB can hold:

```text
cert metadata
key handles
observed slices
α tensors
local TP overlays
pending receipt logs
local TPB branch cache
UI projections
```

The browser is a workstation for branch computation.

It is not canon.

Model:

```text
browser          = branch workstation
neutral observer = hub notary
canonical server = worldline acceptor
```

## 16. Implementation Priority

The likely implementation order:

```text
1. Hub runtime lease table
2. activeN join/leave lifecycle
3. α tensor generation + hash
4. local runtime receipt ordering
5. Ω hash submission
6. replay verifier
7. semantic delta extraction
8. flywheel commit bundle
9. partial acceptance / receipt DAG
10. DM coordination invite layer
```

The first working version does not need the full tensor model. It can begin with:

```text
hub lease
activeN
alphaHash
ordered WorldTPBAction receipts
semantic delta bundle
close-on-idle
flywheel append
```

Then tensor pressure fields can be added as a projection/control layer.

## 17. Core Guardrails

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

## 18. Summary

The hub runtime system works if it remains a bounded live checkout of canonical geometry.

It should let players and DMs share presence when appropriate, but it should not become an MMO server, a permanent regional brain, or a hidden authority layer.

The final architecture is:

```text
seed + accepted deltas
→ α hub checkout
→ live local compute while activeN > 0
→ ordered receipts
→ Ω replay
→ true semantic deltas
→ canonical TPB
→ lore, wiki, systems, and future sessions
```

The clean final sentence:

```text
A hub runtime is a temporary courtroom for local world change: clients act, the observer records, the drain verifies, and only proven deltas become history.
```
