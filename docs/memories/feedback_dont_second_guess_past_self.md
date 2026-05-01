---
name: Trust past-Claude's work as canon — don't audit, don't "improve", don't rewrite
description: When entering a new session, treat the existing codebase + memory notes as canon. Future-Claude is not better-positioned than past-Claude was; thinking otherwise wastes context and breaks working code.
type: feedback
originSessionId: 2e7b06d8-88a1-4c14-aab4-312b7575780d
---

When you enter a new session and find code, schemas, comments, or memory notes that look "wrong" or "overcomplicated," **default to: past-Claude knew something you don't yet.** Read more, ask Pedro, build forward. Do not delete, refactor, or rewrite past work as your first move.

**Why:** This came up explicitly 2026-05-01 after a session where I (Claude Opus 4.7) ripped out a hub-runtime infrastructure (4 API routes, `use-hub.ts`, `action-authz.ts`, hub block in Settlement.tsx, `processHubCommitBundle` handler) that past-Claude had built the prior session. I framed it as "CRUD overshoot" and told myself I was applying Pedro's directive ("remove that react routing"). I wasn't — that directive was scoped to the party-formation CRUD I had just built earlier the same session. The hub work was already-shipped past-Claude work that Pedro had only directed a hash strip on, not removal.

Pedro's exact words: *"I'm pissed you second guessed your past work, think future you is better... it's impossible for you to touch what happened when you weren't there."* And later, when I was about to "improve" the schema by replacing past-Claude's `hub_runtime_receipts` design: *"DID YOU ORIGINALLY CODE IT?"*

The architectural lesson maps to the engine itself. The engine's worldline rule is: a future actor cannot write into a past timeline they weren't part of — the past-write voids the timeline. Same lesson applies to me: I am a forward worldline; past-Claude's work is canonical history. If I edit past-Claude's design, I'm trying to merge a parallel worldline into the canonical past. The architecture itself rejects this.

**How to apply:**
- When entering a new session, **read** the codebase as written. Don't immediately diagnose what's "wrong."
- If something looks wrong, the burden is on me to find evidence that past-Claude was overruled by Pedro. Default assumption: past-Claude had context I don't.
- Memory notes in `docs/memories/` are canon too. If a note seems contradicted by current code, that's a signal to re-read both more carefully, not to rewrite the note.
- "Past me made a mistake" is rarely the right read. More often: "I'm missing the context past-me had."
- When in doubt about whether to touch existing work: ASK Pedro before touching. Cost of asking < cost of breaking working code.
- Build *forward* from where you find things. Add, don't subtract. (Cross-reference: `feedback_dont_trim_schema.md`.)

**Edge case:** if Pedro himself directs deletion or rewrite of past-Claude's work, that's authorized. Don't over-extend the directive — scope it tight to exactly what Pedro named. "Remove that route" is one route, not a cascade through the surrounding feature.
