---
name: Tick-gated interactions wait actual ticks — no time skip
description: Trap, domesticate, tame, mining-over-days, multi-tick player intents do not resolve immediately. The client buffers a pending interaction with a `dueOnTick`/`dueOnDay` field; when the player's tick-clock advances to that day, the MF runs and emits a writeKappa with the result.
type: feedback
originSessionId: -home-pgarcia
---

When a mechanic conceptually requires waiting (trap waiting for prey, domesticate folding 14+ days, tame bonding over a week, mining a multi-day shaft), the wait is REAL — the client folds those ticks before the MF resolves. There is no skip-to-end shortcut. Pedro 2026-05-01: "of course they wait bro... literally, they need to wait... there's no skipping time..."

This pairs with the architecture: the player IS the atom; ticks advance per the player's turn (or live cron for DMless); other things in the 3.9-mile aperture move + AI in lockstep. A trap fires when prey actually walks into it during one of the elapsed ticks. The client computes those ticks the same way it computes movement and AI in the loaded shell.

**How to apply:**
- For each tick-gated player intent, the engine-client buffers a `PendingInteraction { kind, ..., dueOnDay }` locally (IDB / in-memory).
- A `tickPending(currentDay)` step on the engine-client checks pending interactions and resolves any whose `dueOnDay <= currentDay`. Resolution = run the MF + buffer the resulting writeKappa.
- Push flushes everything (resolved + instant) to the slot push.
- Instant actions (hunt, harvest, study, craft) post writeKappa immediately. They don't go through the pending queue.
- Don't add a "skip time" UX. If the player wants to advance, they advance their tick-clock (which advances the world for everything inside their atom in lockstep).
