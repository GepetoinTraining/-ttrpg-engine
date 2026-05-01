---
name: DM is the state — server doesn't compute, only orders and appends
description: A DM-as-shard-host runs the engine on their machine. The server never holds compute state on a DM's behalf. The hub-runtime is a coordination/ordering primitive, not a server-side compute layer.
type: feedback
originSessionId: 2e7b06d8-88a1-4c14-aab4-312b7575780d
---

When designing anything that touches multi-party play (parties at the same place, hub-runtimes, multi-DM coordination, live observers, etc.), the rule is: **the DM IS the state for their party. The server never computes for a DM.**

**Why:** I (Claude Opus 4.7) tried to design a hub-runtime "shared state" table that the server would maintain on behalf of two DM-led shards — a tensor of per-action-type alterations the server would track as "the live shared view." Pedro shut it down 2026-05-01: *"if they're a DM led party the DM is the state... that's why the shard claude... why don't you read the engine that's already there and actually figure out why you're trying to make something compute heavy when it's been solved to not have a compute heavy backend?"*

The architectural point — already in `engine/mm-session.ts`, `engine/mm-party.ts`, etc.:

- A DM-led party's session has its own `MMSession` instance (and its own internal `TPB`) running on the DM's machine
- The DM's machine holds the working TP graph, the active scene cards, the combat pocket manifold, the local TPB
- World mutations (κ writes, edge changes, entity moves) are computed locally by the DM's engine
- The session's bundle is signed by the DM cert and pushed to `/api/world/slot/push` at session-end as `kind: 'dm-session'`
- The server then appends; it does not compute
- Cross-reference `project_cert_hierarchy.md` "DM-as-shard-host" + `project_next_routing_pass.md`

**For multi-party live coordination (the hub-runtime):**

- The hub-runtime is a **server-side coordination primitive**, not a state-holder.
- It exists to: (a) hold the lease while 2+ certs are observing/altering the same canonical .tp node at the same canonical moment, (b) order the receipts they post in arrival sequence, (c) drain into canonical .tpb on close.
- The server **never runs engine math** for a hub-runtime. Each shard (DM or live cert) runs its own engine locally and posts pre-computed alterations + receipts.
- "Shared state" between shards is achieved by each shard reading the others' posted receipts and applying them to its OWN engine. There's no server-held synchronized state — there's an ordered append-only buffer of posts that each shard digests.
- DMless live players also use the hub-runtime when ≥2 of them are at the same place: not because they need a shard host (they don't have one — their cert IS them), but because their concurrent posts on the same canonical present need to be serialized.

**How to apply:**
- Before proposing any "server-side state" structure for multi-party play, **read the engine first.** `engine/mm-session.ts`, `engine/mm-party.ts`, `engine/mm-adventure.ts`, `engine/clockwork.ts`, `engine/mm-simulated.ts`, `engine/tp.ts`, `engine/tpb.ts`. The engine has solved most of these problems already in pure-compute, no-DB form.
- If you find yourself wanting to write `processX()` or `computeY()` in a server route handler, stop. Server routes do: parse → validate shape → insert → return. They do not compute.
- The receipts table (`hub_runtime_receipts`) is the **ordered audit of what shards posted**. It's what gets "checked" — not via crypto/signatures, but via deterministic replay: drain reads receipts in sequence, applies them to canonical .tpb, and each shard can independently re-derive the same canonical state from those receipts. That's "checking."
- Math is the gate: deterministic engines + ordered receipts = no need for server-side state arbitration. (Cross-reference `feedback_no_crypto_abstractions.md` if it exists in this directory; otherwise the rule is the same — math is the integrity, not crypto layered on top.)

**Edge case — what the hub-runtime IS for:** ordering. When DM-A and DM-B both have shards posting receipts in the same canonical second, the server is the neutral observer that stamps `sequence = N+1` so both shards (and the canonical drain) agree on order. That's the only thing the server is doing. Everything else is on the shards.
