---
name: Build log v2 — state at end of conversation 2
description: Comprehensive snapshot. Read FIRST in the next conversation. Covers what landed, where in the engine layer plan we are, and what L5 needs.
type: project
originSessionId: 549f46f4-b5b2-4db2-b48b-1643880a44a5
---
**Read THIS first** in any new conversation, then the three feedback memories at the bottom of this file. Conversation 2 wrapped at this state.

## Headline numbers

- **67 test files**, **1569 tests passing**, TS clean across `src/` and the touched engine files.
- Engine adapters complete for **L0 / L1 / L2 / L3 / L4** plus L6 cooking. **L5 is next** (monster-actor, dungeon-gate, **guild**) — guild is the load-bearing piece per Pedro: "the connector for half the engine."
- Slow-life player interaction layer (v1) shipped — examine, extract, study, claim, tend, slaughter, plant, sell — but **deliberately undocumented in surfaces** ("don't advertise, let them figure it out").
- Vitest is installed and `npm test` runs the suite.

## Layer status at end-of-conversation

```
L0 ✅ weather, water
L1 ✅ production-chain ✅ agriculture ✅ husbandry
L2 ✅ market ✅ currency ✅ banking ✅ caravan ✅ logistics
L3 ✅ faction ✅ warfare ✅ intelligence
L4 ✅ infrastructure ✅ knowledge-pool ✅ social  (mm-settlement done in conv 1)
L5 ⏳ monster-actor, dungeon-gate, guild           ← next
L6 ✅ cooking │ ⏳ npc-agenda, entertainment, lore, services, religion, narrative
```

## What conversation 2 actually built

### Plumbing
- `engine/tp.ts` — added 13 missing κ Zod schemas (weather, ecology, faction, social, culture, religion, military, settlement, market, infrastructure, knowledge, guild, water). `LocalContext` carries all 16 domains. `resolve()` merge walk handles 10 inheritable. Typed `writeDomain<D>(nodeId, domain, value)` with deep-merge semantics. Entity registry (`registerEntity`, `getEntitiesAt`, `getEntitiesOnEdge`, `moveEntity`, `getAllEntities`) with `EntityPosition` discriminated union (`at_node` | `on_edge` | `abstract`).
- `engine/clockwork.ts` — expanded from 5 to 7 layers per `tp_schema.md` ordering.
- `engine/tpb-world.ts` (NEW) — `WorldTPBAction` discriminated union (tick/writeKappa/writeEdge/entitySpawn/entityMove/entityDespawn/observe/session) + `WorldTPB` typed alias.
- `engine/tier.ts` (NEW) — universal `F → EX` tier scale lifted from AdventurerRank, with `compareTier`/`tierAtLeast`/`tierUp/Down`/`tierFromCR`/`tierFromLevel`. `Deposit.tier` field added.
- `engine/hub-builder.ts` — `buildHub` now seeds all 16 leaf-only κ domains with scale-appropriate defaults; new helpers `stabilityForScale`, `growthRateForScale`, `marketTierForScale`, `militaryUpkeepForScale`, `fortificationForScale`.

### Slow-life player interaction layer (v1)
- `engine/material-mastery.ts` (NEW) — per-character `MaterialMasteryStore` keyed by (characterId, resourceId). Knowledge levels 0–3 (unknown / named / base props / affixes). `studyMaterial`/`imprint`/`discoverAffix`. `depositVisibilityFor(level)` returns what fields are visible.
- `engine/claims.ts` (NEW) — `ClaimRegistry` with 7 target types (`node | deposit | farm_plot | building | edge_segment | herd | workshop`), 6 statuses (`pending/active/contested/lapsed/forfeit/inherited`). Auto-promotes `pending → active` on register or flips both to `contested` if active competitor exists. `tend`/`forfeit`/`sweepLapses`/`resolveContest` lifecycle.
- `engine/interactions.ts` (NEW) — `PlayerIntent` discriminated union with 8 variants and matching resolvers:
  - `examine_deposit` — perception check, mastery-gated visibility
  - `extract` — N days at deposit, rollQuality + d20, drains reserves, mastery drift
  - `study_material` — increments mastery 0→1→2→3
  - `claim_plot` — files claim with the registry; flips to contested if competing
  - `tend_herd` — feeds + heals + refreshes claim's lastTendedDay
  - `slaughter` — calls `husbandry.slaughter`, returns meat/leather/tallow GeneratedItems
  - `plant_crops` — sets crops on a fallow plot, validates capacity
  - `sell_item` — looks up market price, computes gold (with tax), increments market supply
- DB schema additions: `character_material_mastery` table (engine-side persisted shape).

### Wave 2 adapters (the big push) — all in `engine/mm-*.ts` with parallel test files

| Layer | File | What it does |
|---|---|---|
| L0 | `mm-weather.ts` | Per-region/settlement, weekly. Folds `weeklyWeatherTick`, writes `κ.weather`. Empty `onAccumulate` (regenerative). |
| L0 | `mm-water.ts` | Per-WaterBody, daily. Day-by-day `updateWaterLevel` fold inside resolve. Reads weather κ for inputs. Writes `κ.water` (per source). |
| L1 | `mm-extraction.ts` | Per-Extraction operation, weekly. Folds `tickExtraction`. Drains deposit reserves. Writes `κ.economy.commodities` supply. **Shares Deposit state with player extract** — slow-life loop. |
| L1 | `mm-agriculture.ts` | Per-FarmPlot, weekly. Advances `growthDays`, harvests when crops mature in-season via `calculateHarvest`. Reads `weather.modifiers.yieldModifier`. Writes commodity supply. |
| L1 | `mm-husbandry.ts` | Per-Herd, weekly fold + monthly inside (births/deaths/aging). Entity-on-node (`type='herd'`). Writes meat (milk+eggs as protein) + cloth (wool) supply. Reads weather + season. |
| L2 | `mm-market.ts` | Per-SettlementMarket, weekly. **Syncs supply from κ before each tick**, runs `weeklyMarketTick`, writes price + trend back to κ. The economy round-trip closer. |
| L2 | `mm-currency.ts` | Per-planet/continent, weekly. Folds `weeklyExchangeTick` for every rate. Writes flat `κ.economy.exchangeRates` map; settlements inherit via ancestry walk. |
| L2 | `mm-banking.ts` | Per-BankVault, weekly. Entity-on-node (`type='bank'`). Tracks `factionOwnerId` and `currencyId`. Folds `weeklyBankingTick` over accounts (interest/fees/loans). **Bullion shipment lifecycle**: `shipBullion` → staged → caravan picks up (`markShipmentInTransit`) → destination credits (`receiveBullion`) → marked delivered/lost. Multi-kingdom faction networks supported (cross-currency conversion at receipt). |
| L2 | `mm-caravan.ts` | **THE LIFEBLOOD.** Per-Caravan, daily, entity-on-edge (mile updated each day, flips to at_node on arrival). Folds `advanceCaravanDay`. Reads weather κ for speedMod + spoilageMult. **Carries 4 channels**: cargo (commodities) + bullion (banking) + rumors + books. **On arrival fires `CaravanArrivalResult`**: `unloadCaravan` for cargo, `bullionDelivered[]` for banks, `rumorsSpread[]` (each via `lore.spreadRumor` with d20 fidelity drift, sourceChain extended with destination), `knowledgeFlow` aggregate via `lore.knowledgeFlowTick` with library tier bonus. Destruction → all bullion `'lost'`, no rumors arrive. |
| L2 | `mm-logistics.ts` | Sister to caravan but at the abstract delivery layer. Per-Shipment, daily, entity-abstract. Folds `tickShipment` (mile progress + d20 hazard rolls). Manifest-based cargo loss on hazards. Carries currency too. The "I want to ship 500 lb iron BG → Waterdeep" surface. |
| L3 | `mm-faction.ts` | Per-Faction, monthly. Folds `tickFaction` 4× per month-resolved. **Leader→intelligence link**: `setLeaderDrives(drives)` from `intent.ts`. `GOAL_DRIVE_ALIGNMENT` map biases progress (wealth-driven leader pushes accumulate_wealth 1.9× faster). Writes `κ.faction.control` per controlled node. Multi-faction coexistence at same node verified. |
| L3 | `mm-warfare.ts` | Per-faction's military arm, monthly. Folds `monthlyReadinessTick` + `monthlyArmyUpkeep` (with `getTreasuryFn` callback) + `monthlyDiplomaticDrift`. Writes `κ.military` per region (settlements inherit). Commander-drives hook present but not yet biased. |
| L3 | `mm-intelligence.ts` | Per-Agent (NPC/faction-as-agent/world), monthly. Folds `decayMemories`. Prunes below `forgetThreshold`. **Slow-life test**: Duke Alric remembers Kaelith saving his daughter (importance 10, emotional, vividness 1.0); after 720 days vividness still > 0.75 — meaningful memory persists. |
| L4 | `mm-knowledge-pool.ts` | Per-pool, monthly. Folds `tickKnowledgePool` (scan, activate, cascade). Writes `κ.knowledge` (seeds map, potentials list, tier 0–5 from total activations). |
| L4 | `mm-infrastructure.ts` | Per-settlement, monthly. **OWNS the KnowledgePool** (don't double-register). Folds `tickInfrastructure`. Profession evaluation, guild-formation rules, tier advancement. Writes `κ.infrastructure`. |
| L4 | `mm-social.ts` | Per-jurisdiction, monthly. Folds `monthlySocialTick` (contracts expire, household standing recomputed, vacant titles → succession). Writes `κ.social` (titles map with rank/succession mapping, standingAvg, contracts.{active,breached,enforceability}). |
| L6 | `mm-cooking.ts` | Per-settlement, monthly. Reads `κ.economy.commodities` for available foods (filtered to grain/meat/fish/bread/ale/herbs/salt/wine/spices/water), cooks representative meal via `cookMeal`, writes `κ.culture.food` ({variety, morale}). |

### Slow-life loops verified end-to-end in tests

```
DAY 1   claim_plot {target:'farm_plot', id:'plot_north'}     → kaelith owns
DAY 1   plant_crops {wheat 5ac, season:'spring'}             → planted
DAY 1   claim_plot {target:'herd', id:'herd:thundertree:cattle'}
DAY 8   tend_herd days:1                                      → claim refreshed
DAY 122 [clockwork ticks weekly]
        observeNode('thundertree') → harvest fires, +1071 grain in κ.economy
                                    → mm-husbandry: milk/wool yields
                                    → mm-extraction: ore drains shared deposit
                                    → mm-market: re-prices from new supply
                                    → mm-cooking: reads commodities → 'good' meals
DAY 123 sell_item {qty:500, resourceId:'grain'}              → goldEarned
DAY 130 slaughter count:5                                    → meat+hide+tallow

Banking + caravan loop:
  House Thann (Baldur's Gate, currency_baldurs)
    .shipBullion('bank:waterdeep', 2000, day) → staged
  caravan picks up:
    sourceBank.markShipmentInTransit(shipId, edge, caravanId)
    mm-caravan.loadBullion(shipment) + loadRumor(...) + loadCargo(...)
  caravan arrives at Waterdeep:
    arrival.bullionDelivered[].status = 'delivered'
    arrival.rumorsSpread[] — fidelity dropped per retelling
    sourceBank.markShipmentDelivered(id, day)
    destBank.receiveBullion(id, ...) → vault credited (currency-converted)
```

## Three feedback memories — re-read before designing

These are non-obvious lessons the user explicitly corrected. Re-read each before making design choices:

1. **`feedback_observation_writes.md`** — "the tree doesn't fall until you look at it." Persistence is observation-driven, not tick-driven. Ticks accumulate `pendingPotential` in memory; only `mm.resolve()` writes κ. Non-observed Faerûn ticks for 100 years and writes only the worldDay counter. Don't propose write-through-on-tick designs.
2. **`feedback_dont_trim_schema.md`** — 168 tables and 63 engine files are intentional. The breadth reflects long-horizon design. Propose ADDITIONS (validation, bridge, contract types), never DELETIONS. When something looks unused, default to "this exists for a reason I haven't learned yet."
3. **`feedback_wired_means_wired.md`** — Don't call a surface "wired" when it has only a live data strip on top of mock JSX. Distinguish *strip-only* / *partial* / *fully bound*. Surfaces in `src/components/design/surfaces/*.tsx` are mostly strip-only — name what's still hardcoded.

## Architecture overview (link this to the docs)

The engine is organized around four file types: **.mf** (atomic 2×2 matrix function), **.mm** (N-dim container of .mf), **.tp** (topology pointer / possibility space), **.tpb** (backward / append-only history). The DB schema literally IS the .tp graph — every table is a node type, every row a TPB entry.

Two intersecting trees:
- **World tree**: cosmos → sphere → world → economy/faction/region → settlement → ecology/hub → npc. Runs whether players exist or not.
- **Player tree**: adventure → session/downtime → party → character/followers → narrative. Observes the world tree at .tp nodes.

Time dilates per layer: world ticks year, faction ticks month, economy ticks week, hub ticks day, slot ticks 30 min, combat ticks 6 sec. **Players are always behind**; fast travel is free because the world already ran those days *in math*.

Simulation pattern is **GRIND / POOL / SELECT**: ticks pre-compute outcomes (cheap), pool them, observation collapses the pool into κ in O(1). Quote: "the world was already alive before you looked."

## L5 — what's coming next (the hard one)

L5 ECOLOGY is **monster-actor + dungeon-gate + guild**. Per Pedro: guild is the connector for half the engine.

**Files to read in order:**
1. `engine/dungeon-gate.ts` — gate lifecycle: spawn rate, overflow, leader emergence (4+ weeks overflow), Solo Leveling respawn (gen+1 at 1.2× budgets), cap mechanics.
2. `engine/dungeon-mf.ts` — MF seeder loop: `[{layout, loot, challenge, potentialCost}, ...]` φ-distributed DNA. `stampRoom`/`evaluateSeeder`/`respawnSeeder`. **Already an MF, not an MM** — MM-Dungeon-Gate consumes it.
3. `engine/dungeon-interior.ts` — room generation: encounters, traps, puzzles, loot. Auto-resolve d20 for NPC parties.
4. `engine/monster-actor.ts` — monthly `d20+CR+tenure` expansion logic. Leadership challenges. Migration → seeds new lairs on edges.
5. `engine/guild.ts` — chapters, NPC parties, jobs, intel network. **The connector**.
6. `engine/guild-receptionist.ts` — orb of revelation, AdventurerRank reveal, tropes.
7. `engine/craftsman.ts` — apprenticeship → journeyman → master → guild formation when ≥3 masters of a trade. (Connects to L4 `mm-infrastructure`.)

**Guild integrations to wire (per Pedro's hint "the connector for half the engine"):**
- `factionOwnerId` like `mm-banking` — guilds belong to factions, share resources across chapters.
- **Inter-chapter messaging** via `mm-caravan` — guild bulletins travel as rumors + books.
- **Bullion shipments** hook (already in mm-banking) — adventurer guild contracts include bounty escorts ("transport this gold from chapter A to chapter B"). The user explicitly asked NOT to advertise quest hooks yet — defer wiring to a future surface.
- **Rumor spreading** (already in mm-caravan) — guild intel network reads rumors carried by caravans.
- **Knowledge-pool** (already in mm-infrastructure) — `craftsman.ts` masters trigger guild formation rules in `tickInfrastructure`.
- **Intelligence** (already in mm-intelligence) — guild members have agendas, leaders have drives.
- **Travel logs** (`engine/guild.ts`) — adventurer guild caravans collect intel as they traverse.
- **Job board** — chapters post jobs that guild NPC parties OR players can take.

**Likely shape of MMGuild:**
- Per-chapter (one MMGuild per `GuildChapter` in a settlement), weekly cadence, layer 5.
- Holds: chapter, factionOwnerId, members, jobBoard, intelEntries, treasury.
- Reads: κ.faction (parent faction's standing), κ.economy.commodities (job demand signals).
- Writes: κ.guild (chapters map, intel sightings, intel rumors per the schema in `tp.ts`).
- Hook for caravan-borne rumors: a method like `digestCaravanArrival(arrival: CaravanArrivalResult)` so when a caravan unloads at the chapter's hub, the rumor stream gets ingested into intel.

**Likely shape of MMMonsterActor:**
- Per-MonsterActor (lair), monthly cadence, layer 5.
- Folds the existing monthly logic (d20+CR+tenure → expansion/raid/migration).
- Entity-on-node at the lair. Migration moves the entity to a new node + seeds new gates.

**Likely shape of MMDungeonGate:**
- Per-DungeonGate, weekly cadence, layer 5.
- Spawn → overflow → leader emergence → cap → respawn lifecycle.
- Writes `κ.ecology.dangerLevel` on the region (overflow grows danger radius).

## What's still pending (post-L5 / future waves)

- **L6 remaining**: npc-agenda (entity at node, daily), entertainment, lore (note: `lore.spreadRumor` is already used by mm-caravan; needs proper monthly tick MM), services, religion (yearly), narrative (per-session).
- **Wave 3 — player tree bridge**: `mm-adventure.ts` doesn't take a Clockwork reference yet. Should: replace internal `worldDay` with `partyDay`, `startSession()` → `clockwork.observeNode(partyNodeId)`, fast travel → observe destination, no compute.
- **Wave 4 — persistence bridge**: observation-driven (per `feedback_observation_writes.md`). TP hydration on boot from `world_nodes` + `world_regions` + `world_edges`. `mm.resolve()` is the only place that writes κ to DB (write-through inside `tp.writeKappa`/`writeDomain`). `mm_states` for MM serialization. `tpb_entries` for the typed action union from `tpb-world.ts`. `tick_counter` for worldDay across restarts. Volume bounded by observations, not by ticks.
- **Wave 5 — driver + observation API**: `POST /api/world/tick {days}`, `POST /api/world/observe {nodeId}`, `GET /api/world/status`, `POST /api/sim/player-tick {count}`, `GET /api/world/node/:id`. Existing 30 routes can keep direct DB reads or migrate.
- **Frontend**: still wireframe with strips. Per `feedback_wired_means_wired.md`, surfaces need mock JSX gutted and replaced with real binding or empty states. Auth gating + SessionContext landed early in conv 2 but the broader binding work was deferred indefinitely.
- **Item factory + affixes** (slow-life v2 promise): `MATERIAL_AFFIXES`, `ItemFactory.createItem` with affix mint, prefix/suffix names. Items in v1 are `{resourceId, quantity, quality, tier, rolledOn}` — stub. v2 wraps these with affix system.
- **Transformation engine** (slow-life v2): smelt ore → ingot, forge ingot → weapon. Recipe-driven with facility + skill gates.
- **Inspect_item / identify_item** (slow-life v2): apply `MaterialScience.inspectMaterial` to forged items.
- **WorldEdge unification**: parked since Wave 1. `tp.ts` keeps a minimal local `WorldEdge` for non-traversable edges (faction_presence, divine_connection); `world-edge.ts` has the rich routable type. Bundle the unification when entity infrastructure for routes lands.
- **TP-required in ISimulatedMM**: still optional. Tests rely on the optional `tp?` parameter. Bulk-update tests when the architecture demands.

## Read order for the next conversation

1. **THIS FILE** (you're here).
2. **`MEMORY.md`** — index.
3. **The three feedback memories** linked at top: observation-writes, dont-trim-schema, wired-means-wired. **Read each fully** before proposing design changes.
4. **`docs/MM-MF-TP-TPB.md`** — foundational architecture. Skim if previously read.
5. **`docs/tp_schema.md`** — 16 κ domains, complete mapping. Frequently reference this when wiring κ writes.
6. **For L5 specifically**: read `engine/dungeon-gate.ts`, `engine/monster-actor.ts`, `engine/guild.ts`, `engine/craftsman.ts`, `engine/guild-receptionist.ts` in that order. Plus `docs/mm_nesting.md` for the dungeon pipeline diagram.
7. **`docs/clockwork_wiring.md`** for the canonical phased plan if reorienting on the bigger picture.

## Concrete starting point

When ready to start L5:

```bash
npm test                          # verify 1569 tests still green
npx tsc --noEmit -p tsconfig.json # verify TS clean
ls engine/mm-*.ts                 # see all wrapped modules so far
```

Then read `engine/guild.ts` first to see what surfaces need wrapping. Work outward: probably **MMDungeonGate first** (simpler, weekly tick, well-defined lifecycle), then **MMMonsterActor** (entity, monthly), then **MMGuild last** (the connector — best done after the dungeon pieces are in place since guild jobs reference dungeons).

Each push: read source → design adapter → write `engine/mm-X.ts` → write `engine/__tests__/mm-X.test.ts` → run `npm test -- mm-X` → fix → full suite → TS check. The pattern is solid; copy from `mm-faction.ts` (per-domain, leader hook, κ writes) for guild and from `mm-husbandry.ts` (entity at node, weekly fold + monthly inside) for monster-actor.

Have a clean handoff. The engine is in great shape.
