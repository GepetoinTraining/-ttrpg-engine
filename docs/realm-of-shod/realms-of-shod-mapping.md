# Realms of Shod ↔ TTRPG-Engine Schema Mapping

> *"Their schema reveals holes ours had been quietly skipping. Use the alignment to enrich us, then downgrade for them."*

This document is the plan for cross-referencing [realmsofshod.com](https://realmsofshod.com/docs/world-building/import-export#entity-types)'s entity schema against our engine, **extending our model where the alignment shows we were missing depth**, and producing downgrade adapters that emit their flat-tagged-record format from our richer hierarchical state. The end goal is a renderer (extracted from `docs/mesh-hologram.md`) that consumes their entity shape and produces rendered tiles, which their friend can build around.

---

## Two schema philosophies

| Realms of Shod | TTRPG-Engine |
|---|---|
| **Flat tagged records** | **Hierarchical κ-domain inheritance + MM/MF math** |
| Every entity = `{ id, type, name, description, notes, accessIds }` | Entities have positions on a `.tp` graph; state lives in `mm_states` + κ; potential accumulates over time |
| 58 entity types, 1 relationship table (V2 `from→to`) | ~140 entities across 17 tiers; many are simulation-active |
| Worldbuilding-CMS shape (writers + DMs author records) | Simulation-engine shape (the world ticks autonomously) |
| No tick — entities are static records | Most entities tick at some cadence (D/W/M/Q/Y) and resolve on observation |

These aren't competing models. **Theirs is the wire format; ours is the runtime.** Their schema defines what an export/import payload looks like; ours defines what's actually being computed. Their friend's renderer consumes the wire format; our adapters emit it from our richer state. Fully compatible — they get the renderer, we get richer entities.

---

## Full 58-entity mapping (compact)

| Their type | Our equivalent | Status |
|---|---|---|
| **CHARACTERS** ||
| `character` | MMCharacter + MMNPC | ✓ |
| `creature` | MMNPC + biome-fauna SPECIES_TABLE + MMMonsterActor | ✓ |
| `species` | SPECIES_TABLE + WILD_FAUNA_CATALOG + ECOLOGY_INTERACTABLES + husbandry SPECIES | ✓ |
| `race` | string field only — **no entity** | ✗ enrich |
| **LOCATIONS** ||
| `city` / `town` / `village` / `settlement` | MMSettlement (HubScale 6 sizes) | ✓ |
| `region` | region `.tp` node | ✓ |
| `territory` | Faction.controlledNodes/Edges | ◐ adapter |
| `landmark` / `ruin` | DiscoveredSite + DungeonGate | ✓ |
| `natural_feature` | biome system (unnamed) | ◐ adapter for named features |
| **ORGANIZATIONS** ||
| `faction` / `guild` / `religion` / `merchant` / `army` / `military` / `residence` | direct (Faction, Guild, Pantheon+Deity, Merchant, ArmyUnit, Faction.type='military', Household type='noble_house') | ✓ |
| `political_body` / `clan` / `dynasty` | derivable from Faction + Household + Title | ◐ adapters |
| `cult` | Faction type='religious' (no secrecy distinction) | ✗ enrich |
| `sanctuary` | none | ✗ enrich |
| **ITEMS** ||
| `weapon` / `tool` / `item` | COMMODITIES + ItemV2 + tool-archetypes | ✓ |
| `consumable` | COMMODITIES (no tag) | ◐ adapter (commodity tag) |
| `magic` (spell) | spell slots only — **no spell catalog** | ✗ enrich |
| `heirloom` / `relic` / `artifact` | ItemV2 has no lineage / religious / unique fields | ✗ enrich (extensions) |
| **EVENTS** ||
| `battle` / `disaster` / `upheaval` / `festival` / `meeting` / `treaty` / `event` | math outputs only — **no durable history records** | ✗ enrich (Phase 2, deferred) |
| **MISC** ||
| `vehicle` | Caravan (richer: 7 vehicle types incl. airship/teleport_circle) | ✓ |
| `currency` | CurrencySystem (richer: trust + exchange rates) | ✓ |
| `resource` / `technology` | COMMODITIES + Deposit + MMTechnologyWeb (richer: F→EX tier ladder) | ✓ |
| `law` | κ.law inheritance (no durable record of decrees) | ✗ enrich |
| `map` / `letter` / `document` | none | ✗ enrich (Document family) |
| `unknown` | meta-tag | — |
| **ESTABLISHMENTS** ||
| `shop` / `marketplace` / `temple` / `business` / `treasury` | Venue + SettlementMarket + Temple + Container | ✓ |
| `archive` / `healing_center` / `political_center` / `academy` | Library + Venue subtypes + administrative district + Workshop | ◐ adapters |

**Tally:** 30 direct (✓), 14 adapter-only (◐), 14 require entity additions (✗). Of the 14 additions, **8 are genuine enrichments** (Phase 1) and **6 are durable-history records** (Phase 2, deferred until their friend explicitly asks).

---

## Phase 1: genuine enrichments to write into our engine

Each of these adds depth our engine was missing. They live in our existing engine files (so MMs can interact with them naturally) and carry a comment marker so we can grep them when writing the downgrade adapters.

### Comment convention

Every type or field added because of the alignment carries a tagged comment block:

```typescript
// === REALMS-OF-SHOD ALIGNMENT: <their_type> ===
// See: docs/realms-of-shod-mapping.md
// Downgrade: src/lib/realms-of-shod-export.ts toRealms<Type>()
```

Grep `REALMS-OF-SHOD ALIGNMENT` to find every aligned type/field. The first line names their entity type. The second points to this doc. The third names the downgrade function.

### Phase 1 additions

| New type / extension | Lives in (engine file) | Tier | Notes |
|---|---|---|---|
| `Race` (new entity) | `engine/race.ts` *(new)* | T0 | Catalog: human/elf/dwarf/halfling/orc/etc. with size + traits[] + abilityModifiers + culturalGroup (links to NamePool). Re-export from `mesh-potential.ts` T0 section. |
| `Spell` (new entity) | `engine/magic.ts` *(extend)* | T1 | Catalog: spell name + school (8 D&D) + level + components (V/S/M) + range + duration + effect. Re-export from `mesh-potential.ts` T1 section. Genuinely missing — we've been pretending casters had spells. |
| `Heirloom/Relic/Artifact` (ItemV2 extensions) | `engine/material-affixes.ts` *(extend ItemV2)* | T1 | Add optional fields: `lineageChain?: { holderId, fromDay, toDay }[]`, `religiousSignificance?: { deityId, originEvent }`, `uniqueness?: { loreText, magicalProperties[] }`. ItemV2 stays one type; the three "subtypes" are just which optional bag is populated. |
| `Cult` (Faction subtype) | `engine/faction.ts` *(extend)* | T14 | Add to `FactionTypeSchema`: `cult`. Add `secrecyLevel: 'open' \| 'discreet' \| 'hidden' \| 'forbidden'` field. Cult-vs-religion distinction is real — secret rites change loyalty math. |
| `Sanctuary` (Faction subtype) | `engine/faction.ts` *(extend)* | T14 | Add to `FactionTypeSchema`: `sanctuary`. Add `refugeProtections: string[]` and `accessRules: string` fields. Refuge orgs (temples-as-asylum, monasteries) have distinct mechanics. |
| `Treaty` (extracted entity) | `engine/warfare.ts` *(promote from string array)* | T14 | Currently `DiplomaticRelation.treaties: string[]`. Promote to `Treaty[]` where Treaty has `id, factionA, factionB, terms[], signedDay, status, sponsorId`. Lets us track when treaties dissolve, who signed, what specifically was agreed. |
| `Law` (extracted entity) | `engine/social.ts` *(extend)* | T14 | Currently law is just κ.law overrides. Add `Law` entity: `id, jurisdictionNodeId, decree (text), effectiveDay, repealDay?, sponsorId, status`. The κ override stays as the runtime read; the Law record is the history. |
| `Document` family (new entity) | `engine/document.ts` *(new)* | T1 | Wraps `map`, `letter`, `document` into one entity with `kind: 'map' \| 'letter' \| 'manuscript' \| 'contract' \| 'record' \| 'tome'`. Fields: author, recipient (for letters), depictedNodes (for maps), contentRef (where the actual text lives), createdDay. |

**Total new files:** 2 (`race.ts`, `document.ts`). **Existing-file extensions:** 4 (`magic.ts`, `material-affixes.ts`, `faction.ts`, `warfare.ts` for Treaty, `social.ts` for Law). Estimated ~600 lines of TypeScript total. Zero new MMs — these are tagged records / catalog rows / item extensions. They feed existing simulation; they don't tick on their own.

### Why these are genuine enrichments (not just compatibility theater)

- **Race-as-entity**: NPCs and PCs currently carry `race: string` with no behavior. Promoting it lets us couple race ↔ NamePool culture, race ↔ baseline ability modifiers, race ↔ size category for combat range. This is a real upgrade.
- **Spell-as-catalog**: We had spell slots and spellcasting ability on MMCharacter, but NO catalog of what spells exist. Casters were vague. A spell catalog grounds magic mechanically.
- **Heirloom/Relic/Artifact via ItemV2 extension**: Items currently have no history. A sword has no story of who held it before. Adding lineage + religious significance + uniqueness gives items depth; quest hooks become trivial ("retrieve the heirloom of House Crownsilver").
- **Cult vs Religion distinction**: Open religion (Pantheon temple) vs secretive cult (hidden gathering) have different κ propagation — cults don't broadcast their faction influence, can be hunted by inquisitions, recruit secretly.
- **Treaty as durable record**: When two factions sign an alliance, "a string in `relation.treaties`" loses *what was agreed*. A first-class Treaty preserves terms and tracks dissolution. Diplomatic intrigue gets specific.
- **Law as durable record**: Currently if Cormyr passes a tax law, it's a κ override with no provenance. With Law records we know it was sponsored by Duke X on day Y, repealed on day Z. Political history accumulates.
- **Document family**: The "stuff written down" layer is genuinely missing. Letters carry forward plot hooks across distances; maps gate exploration; tomes carry knowledge seeds. Letters + maps + manuscripts make the world feel literate.

---

## Phase 2: durable-history records (defer until requested)

These six wrap existing math outputs into durable historical records. Useful for "the chronicle of the world" features, but premature unless the friend asks. Listed in case they ask.

| Deferred entity | Wraps what we have | Where it would live |
|---|---|---|
| `Battle` | BattleResult + worldDay + locationNodeId + participants | `engine/warfare.ts` |
| `Disaster` | settlement events ('plague'/'fire') + market events | `engine/disaster.ts` *(new)* |
| `Upheaval` | political revolution event | `engine/disaster.ts` |
| `Festival` | MarketEvent type='festival_demand' as recurring record | `engine/entertainment.ts` |
| `Meeting` | new — significant gathering record | `engine/social.ts` |
| `Event` (generic) | catch-all historical event | `engine/event-record.ts` *(new)* |

If their friend's renderer doesn't consume these, skip them. If they do, ~200 more lines of TypeScript when needed.

---

## Phase 3: downgrade adapters

The renderer (theirs) consumes their flat schema. Our engine produces our richer state. Adapters bridge — one function per their-type that takes our object and emits theirs.

**Location:** `src/lib/realms-of-shod-export.ts` (lives in `src/`, not `engine/`, because exports are a wire-format concern, not engine math)

**Functions** (one per row, ~10-30 lines each):

```typescript
toRealmsCharacter(char: MMCharacter | MMNPC): RealmsEntity
toRealmsCreature(npc: MMNPC | MonsterActor): RealmsEntity
toRealmsSpecies(speciesId: string): RealmsEntity
toRealmsRace(raceId: string): RealmsEntity                         // Phase 1 new
toRealmsCity(settlement: SettlementState): RealmsEntity
toRealmsTown(settlement: SettlementState): RealmsEntity
toRealmsVillage(settlement: SettlementState): RealmsEntity
toRealmsRegion(node: WorldNode): RealmsEntity
toRealmsTerritory(faction: Faction): RealmsEntity[]                // adapter (multiple from controlledNodes)
toRealmsLandmark(site: DiscoveredSite): RealmsEntity
toRealmsNaturalFeature(node: WorldNode): RealmsEntity              // adapter (named POIs)
toRealmsRuin(site: DiscoveredSite | DungeonGate): RealmsEntity
toRealmsFaction(faction: Faction): RealmsEntity
toRealmsGuild(guild: Guild): RealmsEntity
toRealmsPoliticalBody(faction: Faction): RealmsEntity              // adapter (faction.type='government')
toRealmsCult(faction: Faction): RealmsEntity                       // Phase 1 new
toRealmsReligion(pantheon: Pantheon, deity: Deity): RealmsEntity
toRealmsMerchant(merchant: Merchant): RealmsEntity
toRealmsArmy(unit: ArmyUnit): RealmsEntity
toRealmsClan(household: Household): RealmsEntity                   // adapter
toRealmsDynasty(title: Title, kinship: KinshipLink[]): RealmsEntity // adapter
toRealmsSanctuary(faction: Faction): RealmsEntity                  // Phase 1 new
toRealmsMilitary(faction: Faction): RealmsEntity
toRealmsResidence(household: Household): RealmsEntity
toRealmsWeapon(item: ItemV2): RealmsEntity
toRealmsMagic(spell: Spell): RealmsEntity                          // Phase 1 new
toRealmsHeirloom(item: ItemV2): RealmsEntity                       // Phase 1 new (when lineage populated)
toRealmsRelic(item: ItemV2): RealmsEntity                          // Phase 1 new (when religious populated)
toRealmsTool(item: ItemV2): RealmsEntity
toRealmsArtifact(item: ItemV2): RealmsEntity                       // Phase 1 new (when uniqueness populated)
toRealmsConsumable(commodity: Commodity): RealmsEntity             // adapter
toRealmsItem(item: ItemV2): RealmsEntity
toRealmsTreaty(treaty: Treaty): RealmsEntity                       // Phase 1 new
toRealmsVehicle(caravan: Caravan): RealmsEntity
toRealmsCurrency(currency: CurrencySystem): RealmsEntity
toRealmsLaw(law: Law): RealmsEntity                                // Phase 1 new
toRealmsResource(commodity: Commodity, deposit?: Deposit): RealmsEntity
toRealmsTechnology(tech: TechBlob): RealmsEntity
toRealmsMap(doc: Document): RealmsEntity                           // Phase 1 new
toRealmsLetter(doc: Document): RealmsEntity                        // Phase 1 new
toRealmsDocument(doc: Document): RealmsEntity                      // Phase 1 new
toRealmsShop(venue: Venue): RealmsEntity
toRealmsMarketplace(market: SettlementMarket): RealmsEntity
toRealmsTemple(temple: Temple): RealmsEntity
toRealmsBusiness(venue: Venue): RealmsEntity
toRealmsArchive(library: Library): RealmsEntity                    // adapter
toRealmsTreasury(container: Container): RealmsEntity
toRealmsHealingCenter(venue: Venue): RealmsEntity                  // adapter
toRealmsPoliticalCenter(district: HubDistrict): RealmsEntity       // adapter
toRealmsAcademy(library: Library, workshop: Workshop): RealmsEntity // adapter
```

Plus relationship emitters for V2:

```typescript
toRealmsRelationships(world: TP): RealmsRelationship[]
// emits: resides_in, member_of, controlled_by, allied_with, married_to,
//        descendant_of, sponsored_by, located_at, …
```

**Total adapters:** 47 entity exporters + 1 relationship aggregator. Each is one well-scoped function. ~800-1000 lines combined. No engine state changes — pure read-and-translate.

---

## Build order

| Phase | What | Estimated lift | Output |
|---|---|---|---|
| 1 | Phase 1 entity additions (Race, Spell, Document family + ItemV2 extensions + Faction.cult/sanctuary + Treaty + Law) | ~600 lines TS | Engine compiles, our richness lands |
| 2 | Tests for new entities (catalog round-trips, ItemV2 with lineage, etc.) | ~200 lines tests | New types covered |
| 3 | Re-export new types from `engine/mesh-potential.ts` (T0/T1/T14 sections) | ~30 lines | Single-import surface stays current |
| 4 | Read their codebase (next conversation segment) — extract patterns, find their renderer surface | n/a | Their renderer's call shape understood |
| 5 | `src/lib/realms-of-shod-export.ts` with all 47 adapters + 1 relationship aggregator | ~900 lines TS | Wire format produced from our state |
| 6 | Sample export — produce a V2 JSON for our seeded world (Suzail) | n/a + small script | End-to-end verified |
| 7 | Renderer extraction — based on `docs/mesh-hologram.md`, scoped to consume `RealmsEntity[]` as input | the bigger lift, ~1500 lines | Their friend has the renderer |
| 8 | Phase 2 deferred entities (Battle/Disaster/Upheaval/Festival/Meeting/Event) | only if requested | n/a |

Phases 1-3 are roughly one focused session of writing. Phase 4 (analyzing their codebase) is what Pedro is reserving the rest of the context window for. Phases 5-7 follow once we know their renderer's call shape.

---

## What we surface vs hide in the export

Our engine has properties their CMS-flat schema can't represent. The export adapter must decide what to include and what to drop:

**Surface (these are richer than their schema and their friend's renderer benefits):**
- Caravan transit detail (cargo + bullion + rumors + books, 7 vehicle types)
- WildHerd lifecycle (population + migration + decimation)
- DungeonGate overflow → leader emergence → migration
- Adaptation pools (gates evolve via fitness)
- Affixes / material mastery on items
- MMTechnologyWeb tier ladder
- HubChunk topology (6 procedural city layouts)

**Hide (engine-internal, would confuse a CMS user):**
- κ inheritance chain (auto-applied; not a user concept)
- pendingPotential accumulation (invisible)
- MM cadence (tick mechanics)
- Receipts (forensic-only)
- TPB diff layer (surface as "modifications" only)
- Coupling check / apoptosis (surface as "wilderness gaps")
- The hologram math (surface as "rendered tile")

The adapter's job is to be the contract: in our state's richness goes in, their schema's flatness comes out, with the engine-internals filtered. Round-trip back (their JSON → our state) is the harder direction and out of scope for now.

---

## Why this alignment is worth doing

Three benefits stack:

1. **Our engine gets richer.** Race, Spell, Heirloom-lineage, Treaty, Law, Document — all genuinely missing from our model. The friend's schema acted as a checklist that surfaced our holes.

2. **Our engine becomes interoperable.** Once the export adapter emits their schema, anyone using their import format can ingest a world we generated. The TTRPG ecosystem benefits from compatible exchange formats.

3. **The renderer gets delivered.** Once Phase 5 lands, the renderer extraction (Phase 7) consumes a wire format both worlds use. Their friend builds atop a renderer that accepts inputs they already have. Our engine's hologram math reaches an audience.

The order matters: enrich first, emit second, render last. Don't write the renderer against our internal types, then have to retrofit it for their schema. Write it against their schema from the start. That's why the alignment work is upstream of the renderer work.

---

## Next step

Pedro to share their base TTRPG folder. The next analysis pass extracts:

1. Their renderer's input shape (what data it expects beyond the entity types)
2. Their renderer's output shape (mesh / DOM / canvas / something else?)
3. Their tile / coordinate convention (do they have one, or is rendering tile-less?)
4. Patterns worth borrowing (since "their functions aren't us-shaped, but they have gold in there")
5. Constraints they've already solved (LOD, occlusion, animation, anything we can adopt)

That analysis informs Phase 5+ exactly. Once we know what their renderer needs, the adapter contract is concrete and the renderer extraction has a target shape.
