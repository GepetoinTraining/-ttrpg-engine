---
name: Reputation model — party damps PC rep changes
description: Per-PC and per-party per-faction reputation; party rep modifies (dampens) individual PC rep deltas.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
When wiring **surface 21 Reputation** (and the underlying engine bridge), the user has decided the model:

> party modifies the overall bonus you gain for reputation, harder to be liked or disliked depending on the party rep

**Implications:**
- Both **per-character per-faction** AND **per-party per-faction** reputation must be stored. The party rep is independent state that the engine tracks.
- When a faction event triggers a rep change for a PC, the *delta* is dampened by the party's standing with that faction. Conceptually: a party that's already deeply liked or deeply disliked makes individual swings harder.
- Likely formula shape: `pc_delta = base_delta * dampen(party_rep)` where `dampen(party_rep)` decreases as `|party_rep|` grows. Exact curve is engine territory — flag it for the engine pass.

**Why:** Stated by the user 2026-04-29 while I was wiring Phase 1. Closes the schema decision I had flagged.

**How to apply:**
- Schema: prefer one polymorphic `reputations` table with `subjectType: 'character' | 'party'`, `subjectId`, `factionId`, `score`, plus an audit log table for deltas. Avoid duplicate columns or two near-identical tables.
- The Reputation surface (21) needs to render BOTH layers — per-PC matrix on top, party row underneath as the modifier band.
- Any rep-change endpoint must compute pc_delta from base_delta * party_dampen at write time, and record both values (base + applied) in the audit log so the math is auditable from the TPB.
- This decision is live — no further Reputation schema discussion needed before wiring 21.
