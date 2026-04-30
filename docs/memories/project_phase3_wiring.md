---
name: Phase 3 wiring complete (Lore · Quests · SceneEditor · Diplomacy · Warfare; Dungeon deferred)
description: Five Phase-3 surfaces wired read-only. Lore + Diplomacy briefings reuse wiki_articles. Warfare resolver parked with full spec.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
Phase 3 wired on 2026-04-29.

**Decisions captured & applied:**
- **SceneEditor** — read-only this pass; child tables `scene_contingencies` + `scene_mutations` flagged as the next schema move ("most stable, won't make us regret later" per user). Surface shows the callout in its live strip.
- **Lore** — reuses `wiki_articles` with `articleType='lore'` (per user direction). No new schema.
- **Quests** — `quests` + `beats` already in schema. Wired directly.
- **Dungeon** — deferred (user wants to understand the encounter builder first).
- **Diplomacy** — three tabs share data (per user: "all three on tabs"). Briefings *also* reuse `wiki_articles` with `articleType='intel_brief'` — same lean-schema move as Lore.
- **Warfare** — read-only army roster; full siege resolver spec saved to [project_warfare_model.md](project_warfare_model.md) for later Phase 4+ work.

**New endpoints:**
- `/api/wiki/list?type=lore|intel_brief` — flexible wiki reader
- `/api/quest/list?adventureId=X` — arcs → quests → beats nested
- `/api/scene/list?sessionId=X|adventureId=X` — scene_cards + hook_threads
- `/api/diplomacy/list` — factions + factionRelations + socialContracts (active) + briefings bundle
- `/api/army/list` — armies + army_units + faction join

**New lib:** `src/lib/narrative.ts` (loadWiki, loadQuests, loadScenes, loadDiplomacy, loadArmies).

**Coverage in DB right now (smoke results):** 0 lore articles, 0 arcs/quests/beats, 0 sessions/scene_cards, 1 faction, 0 relations/contracts/briefings, 0 armies. The wiring is correct; the tables are unpopulated. Live strips will fill once engine ticks / authored data exists.

**Why:** Closes Phase 3 from the gap-analysis plan with 5 of 6 wired. Dungeon deferred per user. All decisions baked in or saved as memory for future-me.

**How to apply / gotchas:**
- Lore + Diplomacy-briefings sharing `wiki_articles` is intentional. The article type is the partition key — never collapse one into the other.
- The party-damp model (memory:project_reputation_model.md) is already live in `/api/reputation/delta`. Diplomacy briefings should drive reputation changes via that endpoint when authored.
- `/api/quest/list` with no `adventureId` returns the whole DB. Once campaigns proliferate, always pass `adventureId`.
- Warfare spec is the single most important memory to read before touching surface 31 again. Full spec is in `memory:project_warfare_model.md`.
- SceneEditor authoring needs schema work AND a contingency DSL. Don't try to wire write capability without a real DSL design pass — the JSON-blob temptation will hurt later.
