---
name: Observation writes, not ticks — the world is a function of (seed, time, observations)
description: Persistence in this engine is observation-driven. Ticks accumulate potential in memory only. Don't propose write-through-on-tick designs.
type: feedback
originSessionId: 549f46f4-b5b2-4db2-b48b-1643880a44a5
---
The world is computed, not stored. State doesn't pre-exist; it precipitates on observation.

**Why:** Claude proposed a "write every κ change to DB" persistence layer for Wave 4 of the engine wiring. The user pushed back: *"that's pesky coder thinking — this is elegance, old school coding, we use math and logic, not server and compute. The tree doesn't fall until you look at it. Actually there's no tree — once you see it, it's either fallen or not."* The architecture's whole point is the GRIND/POOL/SELECT pattern: ticks pre-compute in memory (cheap), observations collapse potential into concrete state (write-once). If no party ever observes Westgate, Westgate's economy never persists. Ever. Most of Faerûn stays in superposition forever.

**How to apply:** When designing persistence or storage layers in this engine:
- Ticks DO NOT write. They accumulate `pendingPotential` in memory.
- `tp.writeKappa()` only fires inside `MM.onResolve()`, which only runs on `clockwork.observe()` / `observeNode()`.
- Persistence is bounded by *observations*, not by world activity. A non-observed Faerûn ticks for 100 years and writes only the worldDay counter.
- The world is regenerable from `(seed, currentWorldDay, observed_kappa_log, player_actions_log)`. Anything else is optional cache.
- Fast travel works because the world already ran those days *in math*, not in storage.

The bias to watch for: thinking "if it ticks, it must write." It doesn't. Ticks are free. Observations cost.
