# Complete Database Schema — TTRPG Engine

> **TP = Tables (the schema), TPB = Rows (the history)**
> Every table IS a .tp node type. Every row IS a .tpb entry. The schema literally IS the world graph.

---

## Layer Summary

| Layer | Name | Tables | Purpose |
|-------|------|--------|---------|
| L0 | Foundation | 6 | Worlds, regions, edges, climate, commodities, dice |
| L1 | Geography | 4 | Settlements, buildings, dungeons |
| L2 | Economy | 22 | Inventory, items, weapon/armor stats, enchantments, merchants, prices, banking, trading companies, caravans |
| L3 | Social | 13 | Factions, contracts, households, kinship, titles, guilds, knowledge, craftsmen |
| L4 | Ecology + Warfare | 20 | Monsters, herds, weather, water, magic, spells, religion, armies, spies, diplomacy |
| L5 | Characters + Skills | 22 | PCs, parties, NPCs, abilities, skills, feats, spells, equipment, attunement, dice pools, memories |
| L6 | Sessions + Game Modes | 13 | Adventures, play modes, simulation depth, sessions, scene cards, corridors, combat |
| L7 | Narrative | 7 | Arcs, quests, beats, rabbit holes, villains, patrons, conflicts |
| L8 | Intelligence + AI | 10 | Agent identity, knowledge, memories, GM profiles, intent, drives, goals, schemes |
| H | Hub + Culture | 7 | Districts, food state, performers, libraries, books, rumors, travel log |
| W | Wiki + Vector | 4 | Knowledge wiki, tags, links, embeddings |
| Ω | Clockwork | 6 | MM states, tick log, TPB entries, calendars, tick counter |
| **Total** | | **134** | |

---

## L0 — Foundation (no dependencies)

| Table | Source | PK | Notes |
|-------|--------|-----|-------|
| `worlds` | tp.ts | `id` | Root node. Toril (pre-seeded) or DM-created |
| `world_regions` | tp.ts | `id` → worlds | Terrain, κ inheritance anchor, depth, parent_id |
| `world_edges` | world-edge.ts | `id` (from→to) | Terrain, segments, patrols, distance, bidirectional |
| `climate_zones` | weather.ts | `region_id` | Seasons, weather generation params |
| `commodity_catalog` | production-chain.ts | `id` | Base commodity definitions, categories, base_price |
| `dice_receipts` | mf-dice.ts | `id` | MF dice receipts (append-only) |

---

## L1 — Geography (depends on L0)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `settlements` | settlement.ts | → world_regions | Population, stability, hub_seed, hub_size, hub_topology, era |
| `buildings` | infrastructure-mm.ts | → settlements | Building type, condition, owner, interior_seed |
| `dungeon_gates` | dungeon-gate.ts | → world_regions | Gate spawning, clearing, overflow |
| `dungeon_rooms` | dungeon-interior.ts | → dungeon_gates | Room gen, type, encounters, traps, puzzles, loot |

---

## L2 — Economy (depends on L0, L1)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `recipes` | production-chain.ts | → commodity_catalog | Inputs/outputs, quality rolls, tool requirements |
| `inventories` | inventory.ts | owner_id + owner_type (polymorphic) | owner_type = character, npc, party, settlement, building, caravan |
| `containers` | inventory.ts | → inventories | 18 types (backpack→vault→treasury→granary). Spatial magic tiers |
| `items` | inventory.ts | → containers | 20 categories, 6 rarities, weight, volume, valueGP, stackable, magical, requiresAttunement, sourceType (crafted/purchased/looted/dungeon/quest/natural) |
| `weapon_stats` | inventory.ts | → items | damage_dice, damage_type, weapon_type (simple/martial), properties[] (finesse, heavy, light, reach, thrown, two-handed, versatile, loading, ammunition), range_normal, range_long |
| `armor_stats` | inventory.ts | → items | ac_bonus, armor_type (light/medium/heavy/shield), stealth_disadvantage, strength_requirement, don_time, doff_time |
| `item_enchantments` | inventory.ts | → items | enchantment_bonus (+1/+2/+3), effect_description, charges_max, charges_current, recharge_condition, curse flag, curse_description |
| `merchants` | market.ts | → settlements, → inventories | Tiers, specialization, reputation, capital |
| `venues` | market.ts | → settlements | 6 venue types, capacity, prestige |
| `commodity_prices` | market.ts | → commodity_catalog, → settlements | Supply/demand curves, price discovery |
| `service_providers` | services.ts | → settlements | 7 provider types (bank, PMC, legal, courier, info, healing, magical) |
| `service_contracts` | services.ts | → service_providers | Contracts, risk assessment, weekly tick |
| `caravans` | caravan.ts | → world_edges, → inventories | 7 transport types, cargo, encounters |
| `bank_accounts` | banking.ts | → service_providers (bank), owner_id | Deposits, interest accrual, account type (custody/savings/trade) |
| `loans` | banking.ts | → bank_accounts, → service_contracts | Principal, interest, collateral, term |
| `property_deeds` | social.ts | → buildings or .tp node, owner_id | Building/land ownership, transfer, loan collateral |
| `ledger_entries` | banking.ts | → bank_accounts | Append-only financial .tpb |
| `trading_companies` | trading-company.ts | → settlements (HQ), founder_id | Tiers, branches, road assets, banking charter, auctions |
| `auction_houses` | trading-company.ts | → trading_companies, → settlements | Lot listings, bids, settlement dates |
| `shipments` | logistics.ts | → world_edges, → trading_companies | Mile tracking, deadline, cargo manifest |
| `commodity_routes` | logistics.ts | → world_edges, → commodity_catalog | Profitable routes, profit margin, active caravans |
| `currency_exchanges` | currency.ts | → settlements | Exchange rates, spread, last tick |

---

## L3 — Social (depends on L1, L2)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `factions` | faction.ts | — | Relations, alliances, treasury, type |
| `faction_relations` | faction.ts | → factions × 2 | Treaties, conflicts, stance, trust |
| `social_contracts` | social.ts | → factions | Contracts, marriage, vassalage, apprenticeship |
| `households` | social.ts | → settlements | Koseki family registry, kinship tree |
| `kinship_links` | social.ts | → households × 2 | Parent-child, sibling, marriage links. Legitimacy tracking |
| `titles` | social.ts | → factions | Noble titles, jurisdiction, succession rules |
| `jurisdictions` | social.ts | → titles, → world_regions | Territory control per title, jurisdiction type |
| `guilds` | guild.ts | → factions, → settlements | Guild ranks, intel, treasury, membership |
| `knowledge_seeds` | knowledge-pool.ts | → guilds | Knowledge pool, learning flow, activation |
| `craftsmen` | craftsman.ts | → settlements, → guilds | Trade, rank, recipes, apprenticeship status |
| `apprenticeships` | craftsman.ts | → craftsmen × 2 (master + apprentice) | Progress, graduation, migration choice |
| `child_pool` | social.ts | → settlements | Spare children from .mf twin generation, awaiting placement |
| `name_pools` | social.ts | → world_regions | Cultural name generation seeds per region |

---

## L4 — Ecology + Warfare (depends on L1, L3)

### Ecology

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `monster_actors` | monster-actor.ts | → world_regions | Expansion, raid, migration, territory radius |
| `herds` | husbandry.ts | → settlements | Herds, breeding, slaughter, yield |
| `weather_state` | weather.ts | → world_regions | Climate, season, temperature, severity, modifiers |
| `water_bodies` | water.ts | → settlements | Wells, springs, ports, fish stock, flood stage |

### Magic

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `magic_config` | magic.ts | → world_regions | Magic level (dead→wild), source, school modifiers per region |
| `spells` | magic.ts | `id` | Catalog: name, school, level, range, components, duration, description |
| `spell_elements` | magic.ts | → spells | Damage types, save types, scaling per spell |

### Religion

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `deities` | religion.ts | `id` | Name, alignment, status, domains[], portfolio, holy_symbol |
| `pantheons` | religion.ts | `id` | Name, region, member deities, dominant deity |
| `temples` | religion.ts | → settlements, → deities | Size (shrine→grand_cathedral), clergy count, faith output |
| `clergy` | religion.ts | → temples | Rank (acolyte→pontiff), deity, healing ability |
| `divine_interventions` | religion.ts | → deities, → sessions | Intervention type, trigger, magnitude, world_day |

### Warfare

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `armies` | warfare.ts | → factions | Tier (squad→legion), units[], morale, supplies, readiness |
| `army_units` | warfare.ts | → armies | Unit type, count, veterancy, equipment |
| `siege_weapons` | warfare.ts | → armies | Type (ram→trebuchet), condition, crew |
| `spy_agents` | warfare.ts | → factions | Cover identity, skill, mission, location |
| `spy_missions` | warfare.ts | → spy_agents | Mission type, target, status, intel gathered |
| `diplomatic_relations` | warfare.ts | → factions × 2 | Status (war→alliance), treaty terms, expiry |
| `region_influence` | warfare.ts | → factions, → world_regions | Influence score, loyalty, contested flag |

---

## L5 — Characters + Skills (depends on L1, L3, L4)

### Character Sheet

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `characters` | mm-character.ts | → settlements (location) | Name, race, class, level, HP, AC, background |
| `character_abilities` | mm-character.ts | → characters | STR, DEX, CON, INT, WIS, CHA — scores + modifiers |
| `character_skills` | mm-character.ts | → characters | 18 skills, proficiency flag, expertise flag, bonus |
| `character_feats` | mm-character.ts | → characters | Feat name, source, description |
| `character_proficiencies` | mm-character.ts | → characters | Armor, weapon, tool, language proficiencies |
| `spells_known` | magic.ts | → characters, → spells | Per-caster spell repertoire |
| `spell_slots` | magic.ts | → characters | Per-level slot count, slots used, recovery |
| `caster_state` | magic.ts | → characters | Spellcasting ability, DC, attack bonus, paradox level |

### Equipment (Worn)

14 body slots. Each slot holds one item FK. Armor/shield affect AC.

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `character_equipment` | inventory.ts | → characters, → items | body_slot, item_id. One row per equipped slot |

**Body Slots:**
| Slot | Accepts | Notes |
|------|---------|-------|
| `head` | Helms, circlets, hats | |
| `face` | Masks, goggles | |
| `neck` | Amulets, necklaces, holy symbols | Attunement candidate |
| `shoulders` | Cloaks, mantles, capes | |
| `chest` | Armor, robes, vestments | Drives AC |
| `arms` | Bracers, armbands | |
| `hands` | Gloves, gauntlets | |
| `ring_left` | Rings | Attunement candidate |
| `ring_right` | Rings | Attunement candidate |
| `waist` | Belts, sashes | |
| `legs` | Greaves, leggings | |
| `feet` | Boots, sandals | |
| `main_hand` | Weapons, staves, foci | |
| `off_hand` | Shield, weapon (dual-wield), torch, focus | |

### Carried (On-Body + Bags)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `character_carried` | inventory.ts | → characters, → containers | carry_type: `on_person` (belt pouch, pockets) or `bag` (backpack, satchel). Links to existing container system |

> This bridges into the polymorphic inventory system. A character has: worn equipment (body slots), on-person items (belt pouch, coin purse), and bag inventory (backpack, bag of holding). All three reference the same `items` table.

### Attunement (3 Slots Max)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `character_attunements` | magic.ts | → characters, → items | slot_index (0, 1, 2), item_id, attuned_day. Max 3 per character. Item must require attunement |

> **Rule**: Only items with `requires_attunement = true` in the `items` table can occupy these slots. Breaking attunement frees the slot. Some class features may grant extra attunement slots (stored as character_feat override).


### Dice Pipeline

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `dice_pools` | mf-pool.ts | → characters | Pool config, current state, weekly refresh tracking |
| `check_receipts` | mf-check.ts | → characters | Append-only: check type, DC, result, advantage state |
| `damage_receipts` | mf-damage.ts | → characters | Append-only: damage type, amount, target state changes |
| `paradox_log` | magic.ts | → characters | Append-only: paradox severity, trigger spell, consequences |

### Party & NPCs

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `parties` | mm-party.ts | — | Party gold, level, formation |
| `party_members` | mm-party.ts | → parties, → characters | Join/leave, role |
| `npcs` | mm-npc.ts + npc-agenda.ts | → settlements | Role, disposition, personality, services[], agenda, craft |
| `npc_memories` | npc-agenda.ts | → npcs | Type (episodic/semantic/emotional), content, sentiment, decay |
| `npc_secrets` | npc-agenda.ts | → npcs | Secret content, reveal trigger, revealed flag |
| `followers` | mm-followers.ts | → parties, → npcs | Scope (local/global), loyalty, combat participation |
| `loyalty_events` | mm-followers.ts | → followers | Event type, loyalty delta, world_day |

---

## L6 — Sessions + Game Modes (depends on L5)

### 4 Play Modes

| Mode | Code | Who Runs It | AI Role | Simulation |
|------|------|-------------|---------|------------|
| DM + AI | `GROUP_DM_AI` | Human DM creates scenes | Assists + voices NPCs | DM discretion |
| AI GM | `GROUP_AI` | AI generates scenes | Full GM, party plays | adventure_focused |
| Solo + AI GM | `SOLO_AI` | AI is full GM | Full GM for 1 player, corridor mode | narrative_lite |
| True Solo | `TRUE_SOLO` | No AI — pure clockwork | None — world state generates events | full_simulation |

### Campaign & Mode Config

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `campaigns` | gm.ts | → adventures | Links adventure to play mode — stores PlayModeConfig |
| `play_mode_configs` | gm.ts | → campaigns | mode (4 types), gmProfile, pacingBias, corridorMode, autoAdvance, maxScenesPerSession |
| `simulation_depth` | gm.ts | → campaigns | 10 boolean toggles: agriculture, cooking, banking, religion, entertainment, lore, warfare, waterSystems, extraction, trading |
| `gm_profile_overrides` | gm.ts | → campaigns | Custom GM personality overrides: tone, pacing, combatFrequency, socialFrequency, mercyLevel, narrationStyle, rulesStrictness |

### Session Tables

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `adventures` | mm-adventure.ts | → parties | Campaign persistence, world state snapshot |
| `sessions` | mm-session.ts | → adventures | World day, timestamp, world mutations applied |
| `scene_cards` | mm-session.ts | → sessions | 12 card types, choices, combat setup |
| `hook_threads` | mm-session.ts | → sessions | Hook-back, staleness tracking |
| `hook_escalations` | gm.ts | → hook_threads | Urgency (gentle→critical), reminder type (npc_mention→consequence), stale count |
| `combatants` | mm-scene.ts | → scene_cards | Initiative, HP, AC, conditions |
| `combat_rounds` | mm-scene.ts | → scene_cards | Round number, turns, attacks, damage |
| `downtime_activities` | mm-adventure.ts | → adventures, → characters | Activity type, days spent, progress |

### Solo Mode Tables

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `solo_corridors` | gm.ts | → sessions | Current segment, fork history (SOLO_AI only) |
| `corridor_segments` | gm.ts | → solo_corridors | Order, scene type, completed, choices, chosen path |
| `clockwork_events` | gm.ts | → sessions | 12 event types for TRUE_SOLO: monster, merchant, weather, faction, NPC, discovery, resource, ruin, traveler, ambush, omen |
| `context_snapshots` | gm.ts | → sessions | Serialized ContextPacket — party, NPCs, weather, quests, tensions, villains |

---

## L7 — Narrative (depends on L6)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `arcs` | narrative.ts | → adventures | Type (main/side/character/faction/world), status |
| `quests` | narrative.ts | → arcs | Objectives, rewards, completion state |
| `beats` | narrative.ts | → quests | 15 beat types, triggers, consequences |
| `rabbit_holes` | narrative.ts | → arcs | Depth escalation, connection points |
| `villains` | narrative.ts | → adventures | Tiers, plans, weaknesses, minions |
| `patrons` | narrative.ts | → adventures | Blessings, standing, favors owed |
| `conflicts` | narrative.ts | → villains, → patrons | Good vs evil balance, escalation |

---

## L8 — Intelligence + Strategic AI (depends on L5, L7)

### Agent System

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `agent_identities` | intelligence.ts | → npcs or → characters | 8 types, personality, speech patterns |
| `knowledge_entries` | intelligence.ts | → agent_identities | 6 scopes, boundary, confidence |
| `agent_memories` | intelligence.ts | → agent_identities | Episodic/semantic/emotional, decay rate |

### Strategic AI (Intent Engine)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `actor_drives` | intent.ts | → agent_identities | Drive type, intensity, satisfaction level |
| `actor_goals` | intent.ts | → agent_identities | Goal description, horizon, status, priority |
| `actor_advisors` | intent.ts | → agent_identities | Domain, counsel style, weight |
| `actor_actions` | intent.ts | → actor_goals | Action type, outcome grade, demerits, world_day |
| `schemes` | mm-actor.ts | → agent_identities | Strategic plans, quarterly tick, progress, resources |

---

## H — Hub + Culture (depends on L1, L2)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `district_hubs` | hub-builder.ts | → settlements | District type, template, seed, adjacency |
| `hub_food_state` | cooking.ts | → settlements | Cuisine region, variety, morale modifier, fuel type |
| `performers` | entertainment.ts | → settlements | Performance type, venue, patronage, cultural score |
| `libraries` | lore.ts | → settlements | Tier (private_shelf→grand_archive), books count, research speed |
| `books` | lore.ts | → libraries | Title, category, form, knowledge entries linked |
| `rumors` | lore.ts | → settlements | Source, reliability, content, expiry_day |
| `travel_log` | guild.ts | → guilds | Entries from adventurer guild travel records |

---

## W — Wiki + Vector (observation pipeline)

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `wiki_articles` | observation pipeline | → graph nodes | Article types, depth_of_knowledge, supersession chain |
| `wiki_tags` | observation pipeline | → wiki_articles | Faceted: npc:durnan, faction:zhentarim, event:plague |
| `wiki_links` | observation pipeline | → wiki_articles × 2 | mentions, continues, contradicts, supersedes |
| `wiki_embeddings` | batch embedding | → wiki_articles | Chunk text + vector (768/1536-dim) |

---

## Ω — Clockwork State

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `mm_states` | clockwork.ts | → graph nodes | Layer, cadence, pending_potential, domain_state |
| `tick_log` | clockwork.ts | — | World day, cadence, MMs ticked, player ticks |
| `tpb_entries` | tpb.ts | — | Append-only world history: tick/kappa/entity/observe/session |

### Calendars + Tick Counter

| Table | Source | FK | Notes |
|-------|--------|-----|-------|
| `calendars` | world-tick.ts | — | Calendar definitions: name, culture, days_per_year, months[] with names+lengths, day names, festivals, epoch |
| `settlement_calendars` | world-tick.ts | → settlements or → regions, → calendars | Maps settlements/regions to a calendar system. date_offset for era/timezone shifts |
| `tick_counter` | world-tick.ts | — | Global singleton: current_world_day, campaign_start_day, last tick watermarks (hourly→yearly), total ticks fired |

---

## Cross-System Edges

| Wire | From | To |
|------|------|----|
| Monster predation | `monster_actors` | `herds` |
| Contract → Faction | `social_contracts` | `faction_relations` |
| Knowledge → Magic | `knowledge_seeds` | `magic_config` |
| Guild intel → Faction | `guilds` | `faction_relations` |
| Dungeon → Knowledge | `dungeon_rooms` | `knowledge_seeds` |
| Follower → Combat | `followers` | `combatants` |
| Trading company → Merchant | `trading_companies` | `merchants` |
| Craftsman → Guild | `craftsmen` | `guilds` |
| Wiki → Agent memory | `wiki_articles` | `agent_memories` |
| Paradox → Deity | `paradox_log` | `divine_interventions` |
| Spy → Faction | `spy_missions` | `faction_relations` |
| Army → Region | `armies` | `region_influence` |

---

## Polymorphic Inventory Model

```
character → inventories (owner_type: 'character')
  └── containers: worn, backpack, belt_pouch, bag_of_holding
      └── items: weapons, potions, scrolls, coins

party → inventories (owner_type: 'party')
  └── containers: shared chest, party wagon
      └── items: shared loot, communal supplies

npc → inventories (owner_type: 'npc')
  └── containers: worn, shop shelf
      └── items: trade goods, personal effects

settlement → inventories (owner_type: 'settlement')
  └── containers: treasury, granary, armory, warehouse, stockpile
      └── items: food stores, raw materials, weapons cache

building → inventories (owner_type: 'building')
  └── containers: chest, shelf, vault, cellar
      └── items: building-specific inventory

caravan → inventories (owner_type: 'caravan')
  └── containers: cargo hold
      └── items: trade goods in transit
```

## Banking System

```
Bank Provider (services.ts)
  └── bank_accounts (per depositor)
      ├── custody: safe storage, small fee
      ├── savings: interest accrual (weekly tick)
      └── trade: letters of credit, merchant deposits
          ├── loans (issued against accounts)
          │   ├── principal, interest_rate, term_weeks
          │   ├── collateral_type (property_deed, inventory, none)
          │   └── status: active → paid | defaulted
          └── ledger_entries (.tpb — append-only)
              ├── deposit, withdrawal, interest, loan_payment
              └── weekly tick: interest accrual + loan payment due
```
