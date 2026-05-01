---
name: One canonical timeline — fast-travel computes the road, no parallel-worldline merge
description: The architecture is single-timeline first-observed-wins, NOT Pratchett many-worlds reconciliation. Fast-travel spends canonical days on the road; past-writes void the timeline.
type: feedback
originSessionId: 2e7b06d8-88a1-4c14-aab4-312b7575780d
---

There is exactly **one** canonical timeline: `worlds.currentDay` + the append-only `tpb_entries` log. Reject any framing that treats DM-led parties as "parallel worldlines that converge."

**Why:** I (Claude Opus 4.7) spent most of a session 2026-04-30/05-01 modeling DM-led play as parallel timelines that branch from canon, advance independently in DM-local worldDay, then absorb back into a canonical .tpb at session-end via "Pratchett worldline reconciliation." I quoted that framing repeatedly — and `project_cert_hierarchy.md` even has language that supports it. **Pedro corrected me hard.** That language is wrong. The actual architecture:

- **There is no time forward of `worlds.currentDay`.** Canon is the present.
- **Fast-travel is road computation, not time-skipping.** A party fast-travelling from Suzail to Daggerford doesn't idle in a private future. They spend the days *traveling*. The engine cranks Clockwork forward `roadDays`, resolves MMs along the way, the party arrives at canon-day-of-departure + road-days. Their arrival worldDay IS canon. They never run "ahead of canon"; they spent canonical time on the road.
- **Live play locks fast-travel.** Pedro's exact words: *"if a party is playing at or close to live, they cannot fast travel, it's impossible, because the event hasn't ticked yet."* The road needs future canonical days to exist before it can be traversed. DMless plays at live, period — they never compute forward roads; they observe canon as it ticks.
- **Past-writing voids the timeline. No merge.** If during a DM's session, cron ticks and another observer observes forward of where the DM's bundle is trying to write, the bundle's overlapping-with-already-canon actions are rejected wholesale. Pedro: *"your timeline is GONE, we don't merge it."* The .tpb absorbs the union of UNCONTESTED observations in arrival order. Contested past-writes are dropped.

This is the opposite of Pratchett worldline reconciliation. It's single-timeline first-observed-wins. Math is the gate AND the ordering: whoever's bundle lands first at a given canon-day at a given node owns that observation. Late arrivals into already-observed canon get dropped.

**How to apply:**
- When designing anything that involves multiple parties / shards / clients / sessions: assume ONE timeline. Don't propose merge protocols. Don't propose worldline reconciliation. Don't propose "branch and absorb."
- "Out of order timestamps" in `flywheel_slots` payload don't mean "we accept past-writes from DMs whose sessions ran long" — they mean the DM's bundle was *internally* out-of-order during their session (combat at hour 2, downtime at hour 4 game-time but pushed all together). The bundle as a whole still has to land in canon-time without conflict.
- If past-Claude's code or memory notes contain Pratchett / many-worlds framing, treat that as stale language not yet rewritten. Don't propagate it. Don't act on it.
- The hub-runtime is NOT a worldline merger. It's a sequencing primitive at one canonical .tp node when 2+ certs (DM-led shards OR live players) are observing the same place at the same canonical moment. Receipts get serialized in arrival order; that's it.
- DMless characters cannot fast-travel for this exact reason: server-cron is their clock, and they cannot compute a road into days that haven't ticked.

**Cross-reference:** `feedback_observation_writes.md` (observation collapses potential — lazy projection from seed). The engine is lazy and single-timeline; both properties together are why fast-travel is "free" road-computation rather than parallel-time skipping.
