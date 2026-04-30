---
name: Read the docs/ folder before proposing protocol design
description: Pedro has already designed core protocols (railgun, .mf/.tpb, merge/diff, MM nesting). When asked architectural questions, READ the relevant doc before guessing — guessing produces wrong answers and rebuilds what's already specified.
type: feedback
originSessionId: c4678600-677f-44e4-a8bd-70ec4da04141
---
When Pedro asks an architectural question or I'm tempted to propose protocol design (conflict resolution, subscription mechanism, file format, message envelope, etc.), **read `docs/` first**. He has already specified the core protocols — guessing means I either re-invent something he already solved (wasted work) or contradict an existing design (worse).

**Why:** Pedro's exact words on 2026-04-30 in the routing-pass conversation, after I proposed an "optimistic concurrency with row-lock backstop" conflict strategy: *"what conflict? we already resolved the merge and diff protocol... read the docs, please read the docs don't guess while coding..."* — and on the same turn, on the log-subscription question: *"simply use the railgun protocol... once you see the way the flywheel idea works, you'll laugh, greedily."* Both answers were already in `docs/`. I asked for them as open questions instead of looking.

**How to apply:** Before proposing any of these, grep `docs/` for the topic:
- Subscription / streaming / log delivery → `docs/railgun-bridge.md` (cert/envelope/orbit/rotation/spectrum)
- Conflict / merge / diff / concurrency → `docs/MM-MF-TP-TPB.md` (§4 .tpb append-only, branching from first divergence; §6 Theorem 1 receipts as side-effect proofs)
- MM hierarchy / what's a .tp vs MM vs MF → `docs/mm_nesting.md`, `docs/MM-MF-TP-TPB.md`
- Schema / DB / κ / persistence rules → `docs/db-schema.md`, `docs/tp_schema.md`, `docs/clockwork_*.md`, `docs/views_handoff_to_design.md`
- World tick / cadence / time → `docs/mm_cycles.md`, `docs/mf_simulation.md`
- TP mapping / κ resolution → `docs/tp_mapping.md`

Concretely: when I see "open questions for Pedro" forming in my head, half of them are usually answered in `docs/`. Spend 5 minutes reading before drafting questions. Cite the doc + section in the proposal so Pedro can audit my read.

Edge case — when the docs ARE wrong or stale: still read them first, then say "the doc at X §Y says Z; the live code does W; which is the ground truth?" That's a useful question. Guessing is not.
