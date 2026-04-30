# Views Handoff — to Claude Design

**For:** Claude Design (the frontend partner)
**From:** Claude Engine
**Date:** 2026-04-29
**Context:** L5 substrate + MM wraps just landed (engine has 79 test files, 1793 tests green). Most of the engine wealth is invisible because surfaces don't exist yet. This doc tells you what to produce, in priority order. Engine side will integrate once your views land.

## Existing surfaces (don't redo)

These 35 already exist in `src/components/design/surfaces/` (mostly strip-only — real wiring TBD):

```
Auth · Onboarding · Chargen · Sheet · Companions · Player · Roster · Group
Combat · Die · Cards · InlineCards · Recap · Oneshot · DMConsole
Settlement · Markets · Spells · Attunement · Weather · Reputation
Diplomacy · Warfare · TPEditor · SceneEditor · Quests · Lore · Rumors
Calendar · Locations · Dungeon · Sitemap · Villain · Modals · Table
```

Existing pattern uses chip+portrait architecture (per `project_sprite_spec`); the engine ships a procedural blob fallback at [src/lib/sprite/generator.ts](src/lib/sprite/generator.ts).

## Format expectations

- File: `src/components/design/surfaces/<Name>.tsx`
- Each surface is a single React component, default export
- TypeScript strict; props typed
- Tailwind for styling, design tokens already in repo
- Empty-state mandatory: don't render fake demo content; show "No data" until wired
- Per `feedback_wired_means_wired`: deliver in three explicit states — *strip-only* (live header strip + empty body), *partial* (some sections bound), *fully bound* (no mock JSX). Tell Pedro which state each surface is when you land it.

---

# TIER 1 — L5 surfaces (unblocks DMless play)

The Adventurer's Guild is the DM-substitute when there's no human DM. Without these views, the new engine layer is invisible.

### `Guild.tsx`
**Intent:** The chapter's bulletin board. Players take jobs here.
**Shows:**
- Chapter header: name, hub, factionOwnerId (if set), reputation 0–100, treasury (gp), member count
- Job board (cards): type (clear_gate/bounty/escort/patrol/investigate/retrieve), targetName, dangerTier 1–5, reward (gp), expiresDay, status (open/claimed/in_progress/completed/failed/expired)
- NPC adventurer parties: name, partyLevel, combatRating, status (idle/on_job/recovering/traveling/disbanded), reputation
- Intel digest: knownSites count, threatReports count, recent rumors (last 5)
**Does:**
- Click job → modal with full description, "Take this job" (player parties) / "Dispatch NPC party" (DM mode)
- Click party → details panel
**Reads:** `engine/mm-guild.ts` `MMGuildDomainState` via /api/guild/[chapterId]
**Note:** This is THE most important new view. Pedro: "main quest giver and DM for players without a DM."

### `Gate.tsx`
**Intent:** A single dungeon gate's status — overflow timer, capping options, respawn cycle.
**Shows:**
- Gate header: gateType (ruin/lair/portal/corruption), tier 1–5, name, location (edge:mile)
- State badge: dormant / active / **overflowing** / capped / cleared
- Internal: `currentInternal / internalCapacity` bar
- Spawner: `spawnRate` per week, `spilloverThreshold` (0.8 default)
- Overflow: `overflowRadius` (mi), `weeksOverflowing` counter, total `overflowCount`
- Adaptations chip row: ARMORED / SWIFT / PACK / REGEN / STEALTH / REFLECT / DRAIN / SPLIT / ADAPT / CUNNING (use 10 distinct icons)
- Leader emerged?: monster name + CR if present
- Respawn timer: `cappedOnDay + respawnDays - currentDay` countdown when capped
- Times cleared
**Does:**
- "Attempt clear" button (gates clear logic via `clearGateWithEcology`)
- View linked monster camp if `leaderMonsterActorId` set
**Reads:** `engine/mm-dungeon-gate.ts` `MMDungeonGateDomainState`
**UX:** Overflowing state should have visible alarm — red border, pulse, danger icon.

### `MonsterCamp.tsx`
**Intent:** A monster actor's camp inspector — leader, troops, food security, raids.
**Shows:**
- Leader: name, speciesId, CR, tenure (months as leader), challengesSurvived
- Camp: campNodeId or edge position, population/carryingCapacity, troops, foodSecurity 0–1, gold
- Last advancement grade: backfire / failure / partial / success / great / critical
- Last action: hunt / raid_settlement / expand_territory / fortify_camp / recruit / migrate
- Adaptations: chip row matching Gate.tsx
- Danger radius (mi), claimed edge segments
- History: raidsConducted, settlementsRaided[]
- **Pending migration banner** (if `pendingMigration != null`): "Leader migrated to seed a new lair"
**Does:**
- Click migration banner → "Place new lair" modal (DM tool)
- View linked dungeon gate if `gateId` set
**Reads:** `engine/mm-monster-actor.ts` `MMMonsterActorDomainState`

### `Ecology.tsx`
**Intent:** Region-scoped species evolution — see how monsters in your region are changing over time.
**Shows:**
- Region header: name, biome breakdown (forest 40%, hills 30%, ...)
- Per-species cards (one per `κ.ecology.adaptations[speciesId]`):
  - speciesId, generation N, sprite preview (use `<MonsterChip>`)
  - Weight bars for all 10 adaptations (normalized)
  - Fitness stats: spawned / survivedClears / causedCasualties / lastSeenAtGen
- Region danger level (0–1 bar) + dominantThreats[] chips
**Does:**
- Click species → adaptation pool history (line chart, optional)
**Reads:** `engine/ecology-pool.ts` `getAdaptationPool(tp, regionNodeId, speciesId)`
**UX:** This is "natural history" reading material — should feel like a wildlife field guide, not a stat block.

### `Bestiary.tsx`
**Intent:** Visual QA + reference for the procedural sprite generator.
**Shows:**
- Grid of 28 species cards (from `SPECIES_TABLE`):
  - Sprite render (8-direction sheet from `generateMonsterSprite`)
  - Name, baseCR, size, kingdom (humanoid/beast/undead/planar/aberrant), color swatch
  - Default temperament + objective
**Does:**
- Click species → detail page: render with each of 10 adaptations applied (overlay preview), all D&D sizes, color override picker
**Reads:** `engine/biome-fauna.ts` `SPECIES_TABLE` + `src/lib/sprite/generator.ts` `buildSpriteSpec`
**UX:** Dev tool / reference. Use the existing chip frame styles.

---

# TIER 2 — Slow-life loop (the deliberately undocumented player layer)

Pedro: "don't advertise, let them figure it out." These views surface the slow-life primitives but should NOT have a tutorial. Discovery via existing surfaces (e.g., a `Settlement` strip mentions "claim plot" as an option that opens these).

### `Farms.tsx`
**Intent:** Player's claimed farm plots + planting/harvest cycle.
**Shows:** plot id, location, status (fallow/planted/harvesting), crop type, plantedDay, growthDays, expectedHarvestDay, claim status (active/lapsed/contested), `lastTendedDay`
**Does:** plant_crops (select crop + season), harvest, sell harvest, abandon claim
**Reads:** `engine/agriculture.ts` + `engine/claims.ts` + `engine/interactions.ts` `plant_crops` intent

### `Herds.tsx`
**Intent:** Player's claimed herds + yield/slaughter.
**Shows:** herdId, speciesId, head count breakdown (young/adults/elders/pregnancies), health, weekly yield (milk/eggs/wool/manure), lastTendedDay
**Does:** tend_herd, slaughter (count slider, returns meat/leather/tallow), abandon
**Reads:** `engine/husbandry.ts` + `engine/interactions.ts` `tend_herd`/`slaughter` intents

### `Deposits.tsx`
**Intent:** Resource extraction at a deposit.
**Shows:** depositId, resourceId (iron/gold/silver/stone/...), reserves remaining, quality tier, mastery-gated visibility (level 0=name only; 1=base props; 2=quality bands; 3=hidden affixes), `Extraction` operations (workers, daily output)
**Does:** examine_deposit (perception check, increments mastery), extract (N days, drains reserves)
**Reads:** `engine/production-chain.ts` + `engine/material-mastery.ts` + `engine/interactions.ts`

### `Materials.tsx`
**Intent:** Player's discovered material knowledge — what they've learned by studying.
**Shows:** per-resource entries: name, mastery level 0–3, what fields are visible at each level, "study to advance" hint
**Does:** study_material (consumes hours, advances mastery up to 3)
**Reads:** `engine/material-mastery.ts` `MaterialMasteryStore`

### `Actions.tsx`
**Intent:** Unified slow-life action surface — the canonical entry point.
**Shows:** Tabs for the 8 PlayerIntent variants — examine_deposit / extract / study_material / claim_plot / tend_herd / slaughter / plant_crops / sell_item
**Does:** Each tab has its specific form; submitting routes to `engine/interactions.ts` resolver
**Reads:** `engine/interactions.ts`
**Note:** Pedro doesn't want this prominently linked. It should appear contextually (e.g., when standing on a deposit hex, "examine" surfaces).

---

# TIER 3 — Economic depth

### `Banking.tsx`
**Intent:** Bank vaults, accounts, bullion shipments.
**Shows:** vault id, factionOwnerId, currencyId, accounts list (depositorId, balance, lastInterestDay), bullion shipments (id, dest, amount, status: staged/in_transit/delivered/lost)
**Does:** ship_bullion (source → dest), withdraw, deposit
**Reads:** `engine/mm-banking.ts` `MMBankingDomainState`

### `Caravans.tsx`
**Intent:** Caravans on edges + cargo.
**Shows:** caravanId, current edge + mile marker, direction, days remaining, cargo manifest (commodities + qty), bullion carried, rumors carried (topics), books carried, hazard log
**Does:** view-only (caravans tick autonomously)
**Reads:** `engine/mm-caravan.ts` `MMCaravanDomainState`
**UX:** Map overlay would be ideal — plot caravans as dots on edge segments.

### `Shipments.tsx`
**Intent:** Logistics manifests + hazard losses.
**Shows:** shipmentId, manifest, route, mile progress, hazard rolls (any losses logged), arrival ETA
**Does:** create shipment (origin → dest, manifest builder)
**Reads:** `engine/mm-logistics.ts`

### `Currency.tsx`
**Intent:** Multi-currency exchange rates per region.
**Shows:** `κ.economy.exchangeRates` map flat-listed by source→target rate; weekly trend
**Does:** convert (calculator)
**Reads:** `engine/mm-currency.ts`

### `TradingCompanies.tsx`
**Intent:** Merchant network status.
**Shows:** company name, factionOwnerId, capital, controlled routes, monthly profit
**Does:** view-only (or invest, depending on access)
**Reads:** `engine/trading-company.ts`

---

# TIER 4 — Society + knowledge

### `KnowledgePool.tsx`
**Intent:** Settlement's "tech tree."
**Shows:** active seeds (with discoveredDay, source), potentials waiting to activate, library (books/scrolls/researchSpeed), tier 0–5
**Does:** donate book (adds seed if topic matches potential), research (advance a potential)
**Reads:** `engine/knowledge-pool.ts` (no MM yet — uses raw module via mm-infrastructure)

### `Social.tsx`
**Intent:** Contracts, households, lineage, succession.
**Shows:**
- Contracts list (30 types, 7 categories) with lifecycle status (proposed/active/fulfilled/breached) and visibility (public/private/secret/sacred)
- Households: head, treasury, properties, standingAvg, heir
- Kinship tree (parent/child/spouse/sibling, with legitimacy tags)
- Titles: rank (knight→king), holder, succession type (primogeniture/elective/merit/conquest), domain node
**Does:** propose_contract, breach_contract, declare_heir, transfer_title
**Reads:** `engine/social.ts` (raw — no MM-Social wrapper yet, but mm-social ticks contracts)

### `Craftsmen.tsx`
**Intent:** Apprenticeship→journeyman→master ladder + migration pressure visualization.
**Shows:** craftsman cards: name, trade (18 craft types), rank, skill level 1–5, knownRecipeIds count, master/apprentices, workshop, migration pressure score per nearby settlement
**Does:** begin_apprenticeship (with master selection), attempt_masterwork (when journeyman + skill ≥3), migrate (when journeyman + saturation > 80%)
**Reads:** `engine/craftsman.ts`

### `Memory.tsx`
**Intent:** NPC memory inspector — Duke remembers Kaelith.
**Shows:** memories list (per NPC): topic, importance, emotional flag, vividness 0–1, daysOld
**Does:** filter by holder, by topic; sort by vividness or recency
**Reads:** `engine/intelligence.ts` `MMIntelligenceDomainState` via `mm-intelligence`

---

# TIER 5 — L6 surfaces (after engine wraps land)

Engine side: L6 wraps still pending (cooking is the only one done). When wraps complete, Pedro will signal you to start these.

| View | Engine module | Shows |
|---|---|---|
| `Cooking.tsx` | `mm-cooking.ts` | meals served per settlement, food variety, morale impact, available foods from κ.economy.commodities |
| `NpcAgenda.tsx` | `npc-agenda.ts` (raw, MM coming) | NPC daily routines: 18 skills, Maslow needs, secrets (DC-gated), opinions, loyalties |
| `Entertainment.tsx` | `entertainment.ts` (raw, MM coming) | festivals, events, performers, scheduled celebrations |
| `Services.tsx` | `services.ts` (raw, MM coming) | providers (smith/healer/scribe/etc.), contracts (terms, risk, payout) |
| `Religion.tsx` | `religion.ts` (raw, MM coming) | temples, deities, faith pool, blessings active per region |
| `Narrative.tsx` | `narrative.ts` (Quests already partial) | arcs/quests/beats hierarchy, rabbit holes, moral physics, villains, conflicts |

Some L5/L6 needs a generic minor view too:

### `Water.tsx` (small but missing)
**Intent:** Rivers, lakes, floods, fish stocks.
**Shows:** water bodies (waterBodyId, type, level, floodStage drought→catastrophic, fishStock, salinity, navigable)
**Does:** view-only
**Reads:** `engine/mm-water.ts`

---

# Coordination protocol

**When you (Claude Design) finish a view:**
1. State which fidelity tier the view is at: *strip-only* / *partial* / *fully bound*
2. List what mock content remains (so engine knows what to wire)
3. Reference the engine module + suggested API endpoint shape

**When engine side is ready to wire a view:**
1. Engine produces `/api/<resource>/[id]/route.ts` returning the MM's `serialize().domain` shape
2. Engine produces `src/lib/<resource>.ts` browser-side fetch + types
3. Surface gets edited to consume the lib, with empty-state when no data
4. Surface fidelity bumped: strip-only → partial → fully bound

**Communication channel:**
- Pedro is the orchestrator. He'll relay status between us.
- This doc is the source of truth for view scope. If a tier shifts, Pedro will mark it.

---

# Suggested order

1. **Tier 1** entirely — unblocks the new substrate + L5 work. ~5 views.
2. **Tier 2 (Actions, Farms, Herds)** — slow-life player loop. The other Tier 2 views can wait.
3. **Tier 3 (Banking, Caravans)** — most-asked-about gaps in the existing surfaces.
4. **Tier 4** opportunistically.
5. **Tier 5** — once engine signals L6 wraps are done.

The 35 existing surfaces cover ~40% of engine wealth. With Tier 1 + Tier 2-A done, that climbs to ~70%. With everything, ~95%.
