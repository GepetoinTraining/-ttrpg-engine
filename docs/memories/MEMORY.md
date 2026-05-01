## ⭐ READ THESE FIRST in any new conversation (live handover at the top)

- **[Build log v5 — 2026-05-01 evening](project_build_log_v5.md)** — **MOST RECENT.** Δ.2 Phase 1 (player predation/domestication MFs) + Phase 2 wiring (mm-wild-fauna / mm-mining-layers / mm-ecology-interactables / mm-technology-web registered in clockwork) + κ persistence via writeKappa.value + tpb_entries replay + system-edges hunt wire. 112 test files / 2212 tests. Read FIRST.
- **[Test MMs via serialize().domain](feedback_test_via_serialize.md)** — never reach into `protected getDomainState()` from tests. Lesson from THIS session.
- **[Tick-gated interactions wait actual ticks](feedback_no_time_skip.md)** — trap/tame/domesticate fold real ticks; surface owns the wait. Lesson from THIS session.
- **[Build log v4 — 2026-05-01 morning](project_build_log_v4.md)** — prior pass. Hub-runtime restored + 5 Δ-phase pure-engine foundations landed (Δ.0.5 wild-fauna, Δ.1 ecology, Δ.4 mining, Δ.5 tools, Δ.6 tech-web). Read SECOND for engine context.
- **[Don't second-guess past-Claude](feedback_dont_second_guess_past_self.md)** — the meta-rule. Read before touching code.
- **[One canonical timeline](feedback_one_timeline.md)** — fast-travel computes road forward through canon. NOT Pratchett many-worlds. Past-writes void the timeline. Stale Pratchett language in `project_cert_hierarchy.md` is overruled.
- **[DM is the state — server doesn't compute](feedback_dm_is_the_state.md)** — read engine before designing multi-party features.
- **[Frontend + Wave-4 state](project_frontend_and_wave4.md)** — older snapshot but useful for the Wave-4 layer.
- **[Next pass — routing audit](project_next_routing_pass.md)** — Pedro's 4 answers landed 2026-04-30: client subset = player-observable only, log = railgun flywheel, no merge (.tpb append-only + receipt verify), client owns everything except `tick`.
- **[Ecology substrate landed](project_ecology_substrate.md)** — L5 substrate (biome→fauna→adaptation→monster→sprite + mob-ai). Pre-frontend snapshot.
- **[Build log v2](project_build_log_v2.md)** — older layer-by-layer engine snapshot. Skim only if needed for engine internals.
- **[Observation writes, not ticks](feedback_observation_writes.md)** — non-obvious architectural rule. Persistence is observation-driven. Append-only log is canonical.
- **[Don't trim the schema](feedback_dont_trim_schema.md)** — 168 tables intentional. Propose additions, never deletions.
- **["Wired" must mean wired](feedback_wired_means_wired.md)** — strip-only / partial / fully-bound. Most surfaces today are strip-only.
- **[Read docs/ before guessing protocol design](feedback_read_docs_first.md)** — railgun, .mf/.tpb, merge/diff are already specified. Grep `docs/` before drafting "open questions."
- **[Cert hierarchy + dual-signed receipts](project_cert_hierarchy.md)** — confirmed 2026-04-30: account cert + character cert both from `createSeedData(serverNow, playerGeo)`. Receipts signed by both. One active character at a time. 2-step trade. No migration — wipe + reseed.
- **[Don't second-guess past-Claude](feedback_dont_second_guess_past_self.md)** — past-Claude's work is canon. New session's first move is read, not refactor. Mirrors the engine's "you can't write into a past timeline you weren't part of" rule.
- **[One canonical timeline](feedback_one_timeline.md)** — single-timeline first-observed-wins. Fast-travel computes road forward through canon. NOT Pratchett many-worlds reconciliation. Past-writes void the timeline; no merge. Stale Pratchett language in `project_cert_hierarchy.md` is misleading; treat this memo as authoritative.
- **[DM is the state — server doesn't compute](feedback_dm_is_the_state.md)** — DMs run engine math on their machines. Hub-runtime is a coordination/ordering primitive, not server-side state. Read engine before designing multi-party features.

## Background memories (older context, read as needed)

- [Build log v1 — state at end of conversation 1](project_build_log_v1.md) — pre-Wave-2 snapshot of stack/surfaces/endpoints/schema/primitives.
- [Frontend collab with Claude Design](project_frontend_collab.md) — Pedro is co-building a new frontend alongside Claude Design; I'm the engine-side partner.
- ~~[CLAUDE.md drift](project_claudemd_drift.md)~~ — RESOLVED 2026-04-30: CLAUDE.md fully rewritten. Now reflects Next.js structure, cert hierarchy, client-computes/server-appends flow, and all current architectural decisions. Memory entry kept as historical pointer; no longer applies.
- [Engine ↔ DB persistence gap](project_persistence_gap.md) — engine/ classes are pure in-memory; only auth + world hex touch the DB. No MM↔row bridge exists yet.
- [Claude Design DM Helper handoff](project_design_handoff.md) — frontend ported into Next.js on 2026-04-29; static design, engine wiring underway.
- [Auth wiring](project_auth_wiring.md) — first wired Tier-1 surface; /api/auth/* + browser cert client + Auth.tsx lifecycle.
- [Tier 1 wiring complete](project_tier1_wiring.md) — Auth + Onboarding + Chargen + Sheet + Combat all wired; pattern is route handler → browser lib → surface.
- [Reputation model — party damps PC rep](project_reputation_model.md) — both per-PC and per-party per-faction rep; party score dampens PC delta.
- [Phase 2 wiring complete](project_phase2_wiring.md) — Settlement, Roster, Markets, Spells, TPEditor (read-only), Reputation (party-dampen verified live).
- [Warfare model — siege resolver spec](project_warfare_model.md) — full spec for armies/sieges (d20 modifiers, health portions, front/back line, freshness, real-time when PCs present). Now partially implemented in mm-warfare.
- [Phase 3 wiring complete](project_phase3_wiring.md) — Lore + Quests + SceneEditor (RO) + Diplomacy + Warfare (RO) wired. Dungeon deferred.
- [Dungeon primitives shipped](project_dungeon_primitives.md) — frontend types + textures + React primitives + DungeonGrid (UI side; engine side is dungeon-gate.ts / dungeon-mf.ts / dungeon-interior.ts).
- [D&D Beyond importer + 53-texture catalog](project_importer_and_textures.md) — PDF importer wired end-to-end; textures expanded.
- [Sprite spec for Claude Design](project_sprite_spec.md) — chip+portrait architecture; ~70 SVGs across folders. Tokens are NOT sprites.
- [Testability audit · pre-test punchlist](project_testability_audit.md) — inert buttons by surface, missing modal triggers, cross-nav gaps; partially addressed early in conv 2 (SessionContext + auth gating shipped before pivot).
