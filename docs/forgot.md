Database Schema — TP = Tables, TPB = Rows
IMPORTANT
Every table IS a .tp node type. Every row IS a .tpb entry. The schema literally IS the world graph.
Entity Map (from 33 test files → natural order)
Layer 0 — Foundation (no dependencies)
TableSource FileFrom TestsPKworlds
tp.tsRoot node. Toril (pre-seeded) or DM-created (empty wasteland). Dark Sun, homebrew, etc.
idworld_regions
tp.tsTerrain, Edge Creation
id, → worlds.idworld_edges
world-edge.tsTerrain, Roads, Segments, Patrols
id (from→to)climate_zones
weather.tsSeasons, Weather Generationregion_idcommodity_catalog
production-chain.tsCommodity Catalog, Recipes
iddice_receipts
mf-dice.tsMF_dice receipts
id
Layer 1 — Geography (depends on L0)
TableSource FileFrom TestsFKsettlements
settlement.tsMMSettlement, SimulatedMMBase→ world_regions.idbuildings
infrastructure-mm.tsBuilding, Infrastructure→ settlements.iddungeon_gates
dungeon-gate.tsGate spawning, clearing→ world_regions.iddungeon_rooms
dungeon-interior.tsRoom gen, MF rolls→ dungeon_gates.id
Layer 2 — Economy (depends on L0, L1)
TableSource FileFrom TestsFKrecipes
production-chain.tsRecipes, Quality Rolls→ commodity_catalog.idinventories
inventory.tsPer-entity inventory. owner_type = character | npc | party | settlement | buildingowner_id + owner_type (polymorphic)containers
inventory.ts18 types (backpack→vault→treasury→granary). Spatial magic tiers.→ inventories.id, .tp node via location_node_iditems
inventory.ts16 categories, 6 rarities, weight+vol, source tracking→ containers.idmerchants
market.tsTiers, Specialization, reputation, gold→ settlements.id, → inventories.idvenues
market.ts6 venue types, capacity, prestige→ settlements.idcommodity_prices
market.tsPrice discovery, supply/demand curves→ commodity_catalog.id, → settlements.idservice_providers
services.ts7 provider types (bank, PMC, legal...)→ settlements.idservice_contracts
services.tsContracts, Risk, weekly tick→ service_providers.idcaravans
caravan.ts7 transports, cargo, encounters→ world_edges.id, → inventories.idbank_accountsservices.ts (NEW)Deposits, interest accrual, account type→ service_providers.id (bank), owner_id (polymorphic)loansservices.ts (NEW)Principal, interest, collateral, term→ bank_accounts.id, → service_contracts.idproperty_deedssocial.ts (NEW)Building/land ownership, transfer→ buildings.id or .tp node, owner_idledger_entriesservices.ts (NEW)Append-only financial history (.tpb)→ bank_accounts.id
Layer 3 — Social (depends on L1, L2)
TableSource FileFrom TestsFKfactions
faction.tsRelations, Guild alliances—faction_relations
faction.tsTreaties, Conflicts→ factions.id × 2social_contracts
social.tsContracts, Marriage, Vassalage→ factions.idhouseholds
social.tsHouseholds, Kinship→ settlements.idtitles
social.tsTitles, Jurisdiction→ factions.idguilds
guild.tsGuild ranks, Intel→ factions.id, → settlements.idknowledge_seeds
knowledge-pool.tsPool, Learning flow→ guilds.id
Layer 4 — Ecology (depends on L1, L3)
TableSource FileFrom TestsFKmonster_actors
monster-actor.tsExpansion, Raid, Migration→ world_regions.idlocal_actors
local-actor.tsGuard spawning, Patrol→ settlements.idherds
husbandry.tsHerds, Breeding, Slaughter→ settlements.idmagic_tiers
magic.tsSpell tiers, DC, Slots—weather_state
weather.tsκ modifiers per region→ world_regions.id
Layer 5 — Characters (depends on L1, L3, L4)
TableSource FileFrom TestsFKcharacters
mm-character.tsAbilities, Skills, Derive→ settlements.id (location)parties
mm-party.tsParty, Gold, Level—party_members
mm-party.tsJoin/Leave→ parties.id, → characters.idnpcs
mm-npc.ts,
npc-agenda.tsSkills, Needs, Secrets, Memory, Disposition→ settlements.idnpc_memories
npc-agenda.tsMemory (.tpb), Sentiment→ npcs.idnpc_secrets
npc-agenda.tsGated knowledge→ npcs.idfollowers
mm-followers.tsLocal/Global, Loyalty→ parties.id, → npcs.id
Layer 6 — Sessions (depends on L5)
TableSource FileFrom TestsFKadventures
mm-adventure.tsCampaign, World persistence→ parties.idsessions
mm-session.tsScene cards, Hooks→ adventures.idscene_cards
mm-session.ts12 card types, Choices, Combat setup→ sessions.idhook_threads
mm-session.tsHook-back, Staleness→ sessions.idcombatants
mm-scene.tsInitiative, HP, AC→ scene_cards.idcombat_rounds
mm-scene.tsTurns, Attacks→ scene_cards.iddowntime_activities
mm-adventure.tsCrafting, Training→ adventures.id, → characters.id
Layer 7 — Narrative (depends on L6)
TableSource FileFrom TestsFKarcs
narrative.tsMain/Side/Character/Faction/World→ adventures.idquests
narrative.tsObjectives, Rewards→ arcs.idbeats
narrative.ts15 beat types, Triggers→ quests.idrabbit_holes
narrative.tsDepth escalation, Connection→ arcs.idvillains
narrative.tsTiers, Plans, Weaknesses→ adventures.idpatrons
narrative.tsBlessings, Standing→ adventures.idconflicts
narrative.tsGood vs Evil balance→ villains.id, → patrons.id
Layer 8 — Intelligence (depends on L5, L7)
TableSource FileFrom TestsFKagent_identities
intelligence.ts8 types, Personality, Speech→ npcs.id or characters.idknowledge_entries
intelligence.ts6 scopes, Boundary→ agent_identities.idagent_memories
intelligence.tsEpisodic/Semantic/Emotional, Decay→ agent_identities.idgm_configs
gm.ts4 play modes, 6 profiles→ adventures.idcorridors
gm.tsSolo segments, Forks→ sessions.id
Cross-System Edges (from
system-edges.ts)
WireFromToMonster predationmonster_actorsherdsContract → Factionsocial_contractsfaction_relationsKnowledge → Magicknowledge_seedsmagic_tiersGuild intel → Factionguildsfaction_relationsDungeon → Knowledgedungeon_roomsknowledge_seedsFollower → Combatfollowerscombatants
Mermaid ER Diagram

```
```

Table Count Summary
LayerTablesDescriptionL0 Foundation6Worlds (Toril/custom), regions, edges, climate, commodities, diceL1 Geography4Settlements, buildings, dungeonsL2 Economy15Inventories (polymorphic), containers (18 types), items, merchants, venues, prices, services, caravans, bank accounts, loans, deeds, ledgerL3 Social7Factions, contracts, households, titles, guilds, knowledgeL4 Ecology5Monsters, guards, herds, magic, weatherL5 Characters7PCs, parties, NPCs, memories, secrets, followersL6 Sessions7Adventures, sessions, cards, hooks, combat, downtimeL7 Narrative7Arcs, quests, beats, rabbit holes, villains, patrons, conflictsL8 Intelligence5Agents, knowledge, memories, GM config, corridorsTotal63 tables+ 6 cross-system edges
Inventory Ownership Model
IMPORTANT
Inventory is polymorphic — the same inventories table serves every entity type. Monthly tick affects ALL non-observed inventories via potential compute.

```
character → inventories (owner_type: 'character')
```

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
caravan → inventories (owner_type tied via FK)
  └── containers: cargo hold
      └── items: trade goods in transit
Banking System
NOTE
Banking services already exist in
services.ts (custody, loan, escrow, guarantee, insurance). Below are the financial instrument tables that track actual money over time.
 

```
Bank Provider (services.ts)
```

  └── bank_accounts (per depositor)
      ├── custody: safe storage, small fee
      ├── savings: interest accrual (weekly tick)
      └── trade: letters of credit, merchant deposits
          ├── loans (issued against accounts)
          │ ├── principal, interest_rate, term_weeks
          │ ├── collateral_type (property_deed, inventory, none)
          │ └── status: active → paid | defaulted
          └── ledger_entries (.tpb — append-only)
              ├── deposit, withdrawal, interest, loan_payment
              └── weekly tick: interest accrual on savings + loan payment due
Property Deeds
  ├── building ownership (player-built structures)
  ├── land claims (edge segments, settlement plots)
  └── used as loan collateral