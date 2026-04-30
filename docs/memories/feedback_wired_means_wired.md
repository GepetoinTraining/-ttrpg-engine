---
name: "Wired" must mean fully bound, not "has a live strip"
description: Past Claude reported surfaces as "wired" when only a small data strip was real and the rest was hardcoded mock JSX. The misleading framing wasted alignment.
type: feedback
originSessionId: 549f46f4-b5b2-4db2-b48b-1643880a44a5
---
Don't call a surface "wired" unless mock content has been removed and real state drives the whole view.

**Why:** In conversation 1, Claude shipped the "live engine strip" pattern across 17 Phase 2/3 surfaces and reported them as "wired." Each surface had ~20% real DB data in a top strip and ~80% hardcoded demo JSX (Kaelith party, Sunset Vault scene, fake initiative, fake quick actions) below it. The user discovered the gap only when they actually clicked into DM Console and saw the fake content — they laughed, "of course this isn't going to work, it's all mocked." Hours of "progress" were less load-bearing than reported.

**How to apply:** When updating the user on wiring progress, distinguish three states explicitly:
- *strip-only*: a small live data panel sits on top of mock content (most surfaces today)
- *partial*: some sections bind to real state, others still mock
- *fully bound*: no hardcoded demo JSX remains; empty state replaces strips when no data

Only the third deserves "wired." For the first two, name what's still mock so the user can plan a real test session. When in doubt, click into the surface yourself in a screenshot or describe what hardcoded content remains.
