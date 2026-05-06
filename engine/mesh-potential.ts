/**
 * MESH-POTENTIAL — The White Light
 * ==================================================================
 *
 * This file is two things at once:
 *
 *   ARCHITECTURALLY — the bottom point of the per-tile octahedron.
 *     The κ-potential vector that projects upward through the
 *     equatorial tile and becomes the rendered mesh once the
 *     observer's filter (perception × line-of-sight × time-of-day ×
 *     skill checks) selects which frequencies pass through.
 *
 *     Every consumer that needs to render a tile, resolve an MM,
 *     spawn an entity, or replay a TPB action can — should — import
 *     from this file. Nothing in `engine/` produces κ that doesn't
 *     funnel through one of the surfaces re-exported below.
 *
 *   PRAGMATICALLY — the orientation surface for the engine. Reading
 *     this single file gives a fresh consumer (human or AI) the full
 *     surface of what the engine computes potential for, organized
 *     into the 17-tier ladder from atomic substance (Tier 0) to
 *     planetary weather (Tier 17).
 *
 *     Without this file, anyone trying to understand the engine has
 *     to glob and read all 125+ files. With it, one read suffices.
 *
 * THE LADDER (in re-export order — smallest → largest):
 *
 *   T0   ATOMIC SUBSTANCE      commodity · affix · seed · rumor · adaptation · tier
 *   T1   ITEMS                 ItemV2 · LootItem · CargoItem · GemType · Recipe · …
 *   T2   CONTAINERS            Container · BankAccount · Vault · Loan · BullionShipment
 *   T3   LIVING UNIT           MMCharacter · MMNPC · ClergyMember · Performer · Merchant
 *   T4   ACTOR                 MMActor · MMLocalActor · MMIntelligence · Scheme · Drives
 *   T5   SMALL COLLECTIVE      Herd · WildHerd · MonsterActor · Party · Household · ArmyUnit
 *   T6   SCENE                 MMScene · MMSession · SceneCard · DowntimePeriod
 *   T7   ROOM / BUILDING       RoomLayout · DungeonRoom · Corridor · HubBuilding
 *   T8   OPERATION             FarmPlot · Deposit · Extraction · Workshop · Title · Contract
 *   T9   CHUNK                 HubChunk · ChunkManager
 *   T10  DISTRICT              HubDistrict · DistrictHub
 *   T11  SETTLEMENT            Hub · MMSettlement · MMMarket · MMCooking · MMTechnologyWeb
 *   T12  EDGE / ROUTE          WorldEdge · DungeonGate · MMCaravan · MMShipment
 *   T13  REGION                Biome · MMWildFauna · MMEcologyInteractables · MMWater · AdaptationPool
 *   T14  KINGDOM               CurrencySystem · MMFaction · MMWarfare · DiplomaticRelation
 *   T15  CONTINENT             Pantheon · MMReligion · MMNarrative · NamePool culture
 *   T16  PLANET                BASE_NODES · buildBaseTp · Climate
 *   T17  WORLD STATE           WorldClock · MMWeather · TP · TPB · WorldTPBAction
 *
 *   INFRASTRUCTURE (outside the ladder — the medium, not entities):
 *     MFs (mfDice, mfCheck, mfDamage, mfSmelt, mfForge, …)
 *     MM/MF/TP/TPB base types (CycleDelta, Receipt, ISimulatedMM, …)
 *     Clockwork (the unified tick engine)
 *     SeededRNG (FNV-1a + LCG determinism)
 *     attachWriteLog / applyTpbAction (TPB ↔ TP bridge)
 *
 * THE WHITE LIGHT METAPHOR:
 *
 *   Every tile has an octahedron above it. The bottom vertex is κ —
 *   the seed-derived possibility. The top vertex is the observer's
 *   filter. The equatorial square is the rendered tile.
 *
 *   The white light at the bottom is structured, not chaotic:
 *
 *     substrate(q, r) = .tp ancestry-inherited κ + morphogen field
 *                       (the 99.98% — perfect DNA, shared across tiles)
 *
 *     variation(q, r) = H(worldSeed, q, r) → quantized choices
 *                       through substrate-permitted variants
 *                       (the 0.02% — seed signature, per-tile unique)
 *
 *     tile_DNA(q, r) = substrate(q, r) ⊕ variation(q, r)
 *
 *   The observer's filter at the top selects which material classes
 *   appear, in what density, with what visual primitive. The mesh
 *   is the projection of κ at any zoom level. Coupling guarantees
 *   neighbor continuity (smooth Δκ). Apoptosis registers as
 *   undifferentiated tiles — wilderness, gaps, places between places.
 *
 * THE ENGINE IS SILENT:
 *
 *   No LLM imports anywhere in `engine/`. Even when the engine
 *   produces conversation cards (assembleAgentContext), the card
 *   is structured data; the phrasing happens in `src/` if at all.
 *   This file inherits that rule — nothing here speaks.
 *
 * THE ENGINE OWNS NO ROWS:
 *
 *   No DB imports anywhere in `engine/`. State lives in TPB
 *   (append-only log) + mm_states (cache, regenerable from log).
 *   The DB boundary is `src/lib/world-tpb.ts` and `src/lib/world-state.ts`.
 *
 * SEE ALSO:
 *   - docs/entity_ladder.md       — the design rationale for these 17 tiers
 *   - docs/MM-MF-TP-TPB.md        — the manifold math (Theorem 1: receipts as side effects)
 *   - docs/mm_topology.md         — the engine topology overview (6 mermaid diagrams)
 *   - docs/mm_nesting.md          — the two-tree (world + player) hierarchy
 *   - docs/clockwork_wiring.md    — MM cadence + layer registration
 *   - docs/railgun-bridge.md      — the flywheel/cert/envelope/orbit primitives
 *   - docs/db-schema.md           — table reference for mm_states + tpb_entries
 *
 * @author the engine
 * @license MIT-0 (the math is the gate; the receipts are forensic)
 */

// ====================================================================
// TIER 0 — ATOMIC SUBSTANCE
// ====================================================================
//
// The bedrock the engine references. Most are CATALOG (immutable
// schema rows) — they have zero compute but everything composes
// from them. The few stateful ones (rumors decay, adaptations
// evolve) are tracked as event-driven scalars.
//
// Spatial signature: ABSTRACT. Compute: catalog / pure-fn / event.
// Storage: catalog rows + κ-domain slots when stateful.

// — Universal tier scale (F → EX, 10 steps) —
export {
  type Tier,
  TierSchema,
  TIER_ORDER,
  TIER_MULTIPLIERS,
  compareTier,
  tierAtLeast,
  tierUp,
  tierDown,
  tierFromCR,
  tierFromLevel,
} from './tier'

// — Adaptations (10 traits: ARMORED/SWIFT/PACK/REGEN/STEALTH/REFLECT/DRAIN/SPLIT/ADAPT/CUNNING) —
export {
  type Adaptation,
  type AdaptationPool,
  createAdaptationPool,
  evolvePool,
  selectAdaptations,
  combineModifiers,
  adaptationCountForGate,
} from './adaptation'

// — Knowledge seeds (5 categories: material/creature/botanical/technique/lore) —
export {
  type KnowledgePool,
  type KnowledgeSeed,
  type HubContext,
  type InfrastructurePotential,
  type KnowledgeTickResult,
  STANDARD_POTENTIALS,
  createKnowledgePool,
  addSeed,
  tickKnowledgePool,
  ascendCharacterKnowledge,
  scanPotentials,
} from './knowledge-pool'

// — Rumors (5 categories: monster/geography/history/religion/politics) + lore + library —
export {
  type Rumor,
  type KnowledgeEntry,
  type Library,
  type KnowledgeFlowResult,
  decayRumor,
  spreadRumor,
  knowledgeFlowTick,
} from './lore'

// — Material affixes (11: SHARP/HEAVY/SWIFT/LIGHT/RESILIENT/BRITTLE/CONDUCTIVE/INERT/LUMINOUS/CURSED/LEGENDARY) —
// Affixes are derived from (lotId, day, makerCert, skillBonus, tierBonus) via mintAffixes
export * from './material-affixes'

// — Material mastery (per-character per-material knowledge tier 0-3: UNKNOWN/NAMED/STUDIED/EXPERT) —
export * from './material-mastery'

// — Tool archetypes (per-purpose tier scale: fishing-tool, mining-tool, harvesting-tool, etc.) —
// Note: tool-archetypes defines its own Affix (slot modifier) distinct from material-affixes' Affix
// (item quality tag). We alias the tool version to avoid the wildcard ambiguity.
export {
  type MaterialDomain,
  MaterialDomainSchema,
  type Slot,
  SlotSchema,
  AffixSchema as ToolAffixSchema,
  type Affix as ToolAffix,
  type ToolSkill,
  ToolSkillSchema,
  type ArchetypePurpose,
  ArchetypePurposeSchema,
  type ToolArchetype,
  ToolArchetypeSchema,
  type DerivedTool,
  DerivedToolSchema,
  TOOL_ARCHETYPES,
  getArchetype,
  type DerivationSeed,
  deriveSlots,
} from './tool-archetypes'

// — Race catalog (22 playable ancestries; size, speed, traits, ability modifiers, culturalGroup) —
export {
  type CreatureSize,
  CreatureSizeSchema,
  type Race,
  RaceSchema,
  RACE_CATALOG,
  getRace,
  racialTraitsFor,
  racesByCulture,
} from './race'

// ====================================================================
// TIER 1 — ITEMS
// ====================================================================
//
// Discrete physical things made of substance. Items carry affixes,
// accumulate quality, and end up in containers or on bodies.
//
// Spatial: ABSTRACT (live inside containers / inventories).
// Compute: pure-fn (mfForge / mfSmelt / mfIdentify on creation).
// Storage: mm_states (character / container / dungeon).

// — Recipes + Commodities + Deposits + Extractions (the production chain) —
export {
  type Commodity,
  type CommodityCategory,
  CommodityCategorySchema,
  CommoditySchema,
  COMMODITIES,
  type Deposit,
  DepositSchema,
  type DepositType,
  DepositTypeSchema,
  type DepositQuality,
  DepositQualitySchema,
  QUALITY_MULTIPLIERS,
  type Extraction,
  ExtractionSchema,
  type Recipe,
  RecipeSchema,
  RECIPES,
  type QualityLevel,
  QUALITY_LEVELS,
  rollQuality,
  type MarketPrice,
  MarketPriceSchema,
  calculatePrice,
  determineTrend,
  tickExtraction,
  tickMarket,
  createDeposit,
  createExtraction,
  resetDepositIdCounter,
  resetExtractionIdCounter,
} from './production-chain'

// — Item factory v2: smelt + forge + identify (the .mf chain that produces ItemV2) —
// isHeirloom / isRelic / isArtifact predicates exported via this wildcard (see mf-smelt.ts)
export * from './mf-smelt'
export * from './mf-forge'
export * from './mf-identify'
export * from './mf-craft'

// — Document family (map / letter / manuscript / contract / record / tome) —
export {
  type DocumentKind,
  DocumentKindSchema,
  type Document,
  DocumentSchema,
  resetDocumentIdCounter,
  createDocument,
  documentGrantsAccess,
  documentKnowledgeSeeds,
} from './document'

// — Loot items (8 types: weapon/armor/potion/scroll/gem/art_object/coin/reagent/key; 5 rarities) —
// see Tier 7 for RoomLoot / generateLoot — rarities + types live with dungeon-interior
// — Cargo items (commodity in transit packet) — see Tier 12 caravan exports
// — Gem types (~20 catalog × 5 tiers ornamental→jewel) — see Tier 14 currency exports
// — Property deeds (3 types: building/land/edge_segment) — see Tier 2 banking exports
// — Siege weapons (6 types) — see Tier 14 warfare exports

// ====================================================================
// TIER 2 — CONTAINERS
// ====================================================================
//
// Bounded storage. Substances and items live inside; transfers
// are the verbs. Banking infrastructure lives here too — accounts
// hold currency, vaults hold gold, loans hold debt.
//
// Spatial: NODE (containers belong to a hub) or ABSTRACT (accounts).
// Compute: MMBanking weekly + event-driven transactions.
// Storage: mm_states (banking, inventory).

// — Inventory + Container types (treasury/vault/warehouse/granary/chest/library/scroll_rack/gallery/armory) —
export * from './inventory'

// — Banking (FULL RESERVE — vault gold backs all loans; never fractional) —
export {
  type AccountType,
  ANNUAL_INTEREST_RATES,
  ANNUAL_FEES,
  type BankVault,
  createVault,
  canLend,
  type BankAccount,
  createAccount,
  type LoanStatus,
  type CollateralType,
  type Loan,
  calculateWeeklyPayment,
  issueLoan,
  type PropertyType,
  type PropertyDeed,
  transferDeed,
  type LedgerEntryType,
  type LedgerEntry,
  resetLedgerSeq,
  type TransactionResult,
  deposit,
  withdraw,
  makeLoanPayment,
  type BankingTickResult,
  weeklyBankingTick,
} from './banking'

// — Bullion shipment (vault → vault transfer via caravan) —
export {
  type BullionShipment,
  type BullionShipmentStatus,
  bankEntityId,
  resetShipmentIdCounter,
  MMBanking,
  type MMBankingDomainState,
  type MMBankingOptions,
} from './mm-banking'

// ====================================================================
// TIER 3 — LIVING UNIT (single agent)
// ====================================================================
//
// One body, one will. Stat block + position + status. PCs, NPCs,
// clergy, performers, spies, merchants, providers — the engine's
// "people."
//
// Spatial: NODE (homeNodeId / currentNodeId).
// Compute: MMxxx daily-or-event depending on role.
// Storage: mm_states + IDB (for PCs/followers).

// — MMCharacter (D&D 5e PC) —
export {
  MMCharacter,
  type CharacterData,
  CharacterDataSchema,
  type CharacterDataInput,
  type Ability,
  AbilitySchema,
  type Skill,
  SkillSchema,
  SKILL_ABILITIES,
  type DerivedStats,
} from './mm-character'

// — MMNPC (full-spec NPC: 10 roles, 5 dispositions, loyalty, knowledge, services) —
export {
  MMNPC,
  type NPCData,
  NPCDataSchema,
  type NPCDataInput,
  type NPCRole,
  NPCRoleSchema,
  type Disposition,
  DispositionSchema,
  type NPCService,
  NPCServiceSchema,
  type Personality,
  PersonalitySchema,
  type NPCDerivedStats,
} from './mm-npc'

// — NPC agenda (Maslow stack: 5 needs) —
export {
  type NPCAgenda,
  type AgendaTickResult,
  tickAgenda,
} from './npc-agenda'

export {
  MMNpcAgenda,
  type MMNpcAgendaDomainState,
  type MMNpcAgendaOptions,
} from './mm-npc-agenda'

// — Intelligence (memories with vividness decay; identity; knowledge boundaries) —
export * from './intelligence'

export {
  MMIntelligence,
  type MMIntelligenceDomainState,
  type MMIntelligenceOptions,
  agentEntityId,
} from './mm-intelligence'

// ====================================================================
// TIER 4 — ACTOR (agent with intent and a TPB)
// ====================================================================
//
// A living unit that *decides*. Has drives, goals, schemes, and a
// life-history TPB. Two scales: territory actors (multi-node, like
// a Duke) and local actors (intra-hub, like a tavern owner).
//
// Spatial: HIER (territory subtree) or NODE (single hub).
// Compute: MMActor weekly + monthly + quarterly + … (horizon-graded).
// Storage: mm_states (actor / local_actor).

// — Intent system (drives, goals, actions, horizons, action templates) —
export * from './intent'

// — MMActor (territory-spanning, multi-node decision-maker) —
export {
  MMActor,
  type ActorDomainState,
  type Scheme,
  SchemeSchema,
  type ActorTPBEntry,
  ActorTPBEntrySchema,
} from './mm-actor'

// — MMLocalActor (intra-hub actor — 17 occupations: merchant/innkeeper/artisan/guard/…) —
export {
  MMLocalActor,
  type LocalActorDomainState,
  type LocalResources,
  LocalResourcesSchema,
  type Occupation,
  OccupationSchema,
  type LocalTPBEntry,
  LocalTPBEntrySchema,
} from './mm-local-actor'

// — GM orchestration (4 play modes: player/dm/gm-ai/dmless) —
export * from './gm'

// ====================================================================
// TIER 5 — SMALL COLLECTIVE (multiple agents bound)
// ====================================================================
//
// Groups of agents that move/act/produce together. The middle layer
// between the individual and the institution: herds, parties,
// monster camps, households, families, armies.
//
// Spatial: NODE or EDGE (when migrating / traveling).
// Compute: MMxxx weekly or monthly.
// Storage: mm_states + κ.ecology.herds[id] for wild ones.

// — Domesticated herds (12 species × 3 age tiers) —
export {
  type LivestockCategory,
  type BreedingSeason,
  type YieldProfile,
  type CareProfile,
  type ReproProfile,
  type MortalityProfile,
  type Species,
  SPECIES,
  type Herd,
  type WeeklyYield,
  type MonthlyTickResult as HusbandryMonthlyTickResult,
  type SlaughterResult,
  type FoodSufficiency,
  createHerd,
  totalHead,
  weeklyYieldTick,
  slaughter,
  monthlyHerdTick,
  calculateFoodSufficiency,
  getSpecies,
  getSpeciesByCategory,
  getSpeciesForClimate,
  getSpeciesForTerrain,
  dailyFeedCost,
  spaceRequired,
} from './husbandry'

export {
  MMHusbandry,
  type MMHusbandryDomainState,
  type MMHusbandryOptions,
  herdEntityId,
} from './mm-husbandry'

// — Wild herds (6 starter species: deer/rabbit/boar/mountain-goat/fox/owl; 4 trophic roles) —
export {
  type TrophicRole,
  TrophicRoleSchema,
  type Formation,
  FormationSchema,
  FORMATION_SPEED_MOD,
  FORMATION_DEFENSE_MOD,
  FORMATION_FORAGE_MOD,
  type HerdStatus,
  HerdStatusSchema,
  type WildFaunaSpecies,
  WildFaunaSpeciesSchema,
  type WildHerd,
  WildHerdSchema,
  WILD_FAUNA_CATALOG,
  speciesByBiome,
  speciesByTrophic,
  defaultFormationFor,
  isViable,
  getSpecies as getWildFaunaSpecies,
} from './wild-fauna'

export {
  MMWildFauna,
  type MMWildFaunaDomainState,
  type MMWildFaunaOptions,
} from './mm-wild-fauna'

// — Herd life MFs (graze / migrate / predation) —
export * from './mf-herd-life'

// — Fauna predation (cross-species, used by mm-monster-actor hunt action) —
export * from './fauna-predation'
export * from './mf-fauna-predation'

// — Monster actor (an intelligent monster's camp + leader + claimed territory) —
export {
  type ExpansionAction,
  ExpansionActionSchema,
  type AdvancementGrade,
  AdvancementGradeSchema,
  type ChallengeOutcome,
  ChallengeOutcomeSchema,
  type MonsterActorState,
  type AdvancementResult,
  type ChallengeResult,
  type MonsterActorFromEcologyInput,
  type MonsterActorFromEcologyResult,
  resetMonsterActorIdCounter,
  createMonsterActor,
  tickMonsterAdvancement,
  shouldChallenge,
  generateChallengerCR,
  resolveLeadershipChallenge,
  applyAdaptationsToActor,
  createMonsterActorFromEcology,
} from './monster-actor'

export {
  MMMonsterActor,
  type MMMonsterActorDomainState,
  type MMMonsterActorOptions,
  type PendingMigration,
  computeMonsterDanger,
  contributeDanger,
} from './mm-monster-actor'

// — Mob AI (combat-time per-mob decision: 7 temperaments × 7 objectives) —
export * from './mob-ai'

// — MMParty (PC party: characters + marching order + shared gold) —
export {
  MMParty,
  type PartyState,
} from './mm-party'

// — MMFollowers (party-attached NPCs, dual-pool: local with party + global at home) —
export {
  MMFollowers,
  type LoyaltyEvent,
} from './mm-followers'

// — Warfare units (5 tiers × 8 unit types) — armies live here, faction-level orchestration in T14
export {
  type ArmyTier,
  ARMY_TIER_SIZE,
  ARMY_TIER_ORDER,
  type UnitType,
  UNIT_EFFECTIVENESS,
  type ArmyUnit,
  unitCombatStrength,
  calculateUpkeep,
  type SiegeWeaponType,
  type SiegeWeapon,
  SIEGE_WEAPON_STATS,
  type BattleForce,
  type BattleResult,
  resolveBattle,
  applyCasualties,
  type DiplomaticStatus,
  type DiplomaticRelation,
  statusFromStanding,
  type SpyMission,
  type SpyAgent,
  type SpyMissionResult,
  executeSpyMission,
  type RegionInfluence,
  setInfluence,
  normalizeInfluence,
  dominantFaction,
  monthlyInfluenceTick,
  monthlyReadinessTick,
  type ArmyUpkeepResult,
  monthlyArmyUpkeep,
  type DiplomaticDriftResult,
  monthlyDiplomaticDrift,
  type TreatyStatus,
  type Treaty,
  resetTreatyIdCounter,
  createTreaty,
  dissolveTreaty,
} from './warfare'

// — Households + kinship + family registries + child pool (the social fabric) —
export {
  type ContractCategory,
  type ContractType,
  type ContractVisibility,
  type ContractStatus as SocialContractStatus,
  type ContractParty,
  type Contract,
  createContract,
  acceptContract,
  ratifyContract,
  activateContract,
  breachContract,
  terminateContract,
  fulfillContract,
  expireContract,
  getActiveContracts,
  getContractsBetween,
  hasActiveContract,
  type HouseholdType,
  type SocialStanding,
  type HouseholdRole,
  type HouseholdMember,
  type Household,
  createHousehold,
  addMember as addHouseholdMember,
  removeMember as removeHouseholdMember,
  getActiveMembers,
  getHead,
  getHeirs,
  succeedHead,
  calculateStanding,
  type KinshipType,
  type Legitimacy,
  type KinshipLink,
  createKinshipLink,
  getRelatives,
  getParents,
  getChildren,
  getSpouse,
  areRelated,
  canInherit,
  type TitleRank,
  type SuccessionType,
  type Title,
  createTitle,
  transferTitle,
  vacateTitle,
  compareRank,
  getHighestTitle,
  type JurisdictionType,
  type Jurisdiction,
  createJurisdiction,
  isEnforceable,
  findJurisdiction,
  type SocialTickResult,
  monthlySocialTick,
  ascendCharacterSocial,
  type RegistryEntryType,
  type RegistryExitReason,
  type FamilyRegistryEntry,
  type FamilyRegistry,
  createFamilyRegistry,
  type MarriageResult,
  registerMarriage,
  type SpareChild,
  type ChildPool,
  createChildPool,
  drawFromChildPool,
  type BirthResult,
  registerBirth,
  registerDeath,
  registerAdoption,
  type DivorceResult,
  registerDivorce,
  getRegistryAt,
  getEntityRegistry,
  getActiveRegistryMembers,
  type LineageNode,
  getRegistryLineage,
  type NamePool,
  NAME_POOLS,
  generateName,
  getNamePool,
  type LawStatus,
  type Law,
  resetLawIdCounter,
  createLaw,
  repealLaw,
  suspendLaw,
  getLawsAt,
} from './social'

// — Social MM (jurisdiction-scope orchestrator) —
export {
  MMSocial,
  type MMSocialDomainState,
  type MMSocialOptions,
} from './mm-social'

// ====================================================================
// TIER 6 — SCENE (bounded interaction in a window)
// ====================================================================
//
// A single bounded interactive moment. Combat round / play session
// / downtime / encounter card. The pocket manifold for combat;
// the GM's session orchestrator for everything else.
//
// Spatial: NODE (where the scene happens).
// Compute: per-round (combat) or event-driven (session).
// Storage: mm_states (scene / session / adventure) + tpb_entries.

// — MMScene (combat encounter — 6s tick pocket manifold) —
export {
  MMScene,
  type Combatant,
  CombatantSchema,
  type InitiativeEntry,
  type TurnResult,
  type RoundResult,
  type CombatState,
} from './mm-scene'

// — MMCombat (the .mf chain: dice → check → damage with ? slot resolution) —
export {
  mmCombatAttack,
  type AttackAction,
  AttackActionSchema,
  type AttackResult,
  AttackResultSchema,
  type AttackReceiptChain,
} from './mm-combat'

// — Combat helpers (interactions, etc.) —
export * from './interactions'

// — MMSession (one play session with 12 card types + hook-back system) —
export {
  MMSession,
  CardType,
  type SceneCard,
  SceneCardSchema,
  type HookThread,
  type WorldMutation,
} from './mm-session'

// — MMAdventure (campaign container — sessions + downtime + party + .tp + .tpb) —
export {
  MMAdventure,
  type DowntimeActivity,
  DowntimeActivitySchema,
  type DowntimeActivityInput,
  type DowntimePeriod,
  type SessionRecord,
} from './mm-adventure'

// ====================================================================
// TIER 7 — ROOM / BUILDING (bounded interior)
// ====================================================================
//
// A single navigable interior. Either a dungeon room with a tile
// grid, or a hub building with floors. The grain at which a player
// sees specific tile content (a chest, a trap, a chair, a wall).
//
// Spatial: TILE (dungeon room) or BUILDING (hub building).
// Compute: deterministic from seed (dungeon-stamp / hub-chunks).
// Storage: mm_states (dungeon) or derived (hub).

// — Dungeon interior (10 room types: entrance/corridor/chamber/trap_room/treasure_room/shrine/lair/boss_chamber/dead_end/junction) —
export {
  type RoomType,
  RoomTypeSchema,
  type EncounterDifficulty,
  EncounterDifficultySchema,
  type RoomEncounter,
  type TrapType,
  TrapTypeSchema,
  type RoomTrap,
  type PuzzleCategory,
  PuzzleCategorySchema,
  type RoomPuzzle,
  type LootRarity,
  LootRaritySchema,
  type LootItem,
  type RoomLoot,
  type DungeonRoom,
  type DungeonInterior,
  type RoomResolutionResult,
  type DungeonResolutionResult,
  resetInteriorIdCounter,
  generateDungeonInterior,
  resolveRoom,
  resolveDungeon,
} from './dungeon-interior'

// — Dungeon stamp (concrete tile grids 4×4 → 24×24, 12 tile types, positioned content) —
export {
  type TileType,
  TileTypeSchema,
  type TilePosition,
  type CardinalDirection,
  ROOM_TILE_DIMS,
  BOSS_DIMS,
  type PositionedEncounter,
  type PositionedTrap,
  type PositionedLoot,
  type PositionedFeature,
  type DoorAnchor,
  type RoomLayout,
  type DungeonCorridor,
  type StampRoomInput,
  type StampCorridorInput,
  type StampedDungeon,
  stampRoomLayout,
  stampCorridor,
  stampDungeonLayouts,
} from './dungeon-stamp'

// — Dungeon MF (the .mf chain for room generation seeds) —
export * from './dungeon-mf'

// — Hub buildings + streets + POIs live at this tier; full chunk in Tier 9 —
// (re-exported from hub-schema in Tier 9 / 10 below)

// ====================================================================
// TIER 8 — OPERATION / WORKSHOP / CONTRACT
// ====================================================================
//
// A bounded ongoing endeavor. A farm produces; a forge crafts;
// a guild posts jobs; a temple hosts services; a contract is in
// force; a study runs to completion.
//
// Spatial: NODE (most operations) or ABSTRACT (contracts, studies).
// Compute: MMxxx weekly or monthly.
// Storage: mm_states + κ writes.

// — Agriculture (22 crop types × 4 plot sizes × 5 tenures × 2 cultivations) —
export {
  type CropType,
  CROP_DATA,
  type PlotSize,
  PLOT_ACRES,
  type TenureType,
  TENURE_MODIFIERS,
  type CultivationMode,
  CULTIVATION_MODIFIERS,
  type FarmPlot,
  type HarvestResult,
  calculateHarvest,
  type FisheryType,
  FISHERY_YIELD,
  type FisheryOperation,
  weeklyFisheryYield,
  type GatheringType,
  GATHERING_DATA,
  weeklyGathering,
  type TaxInKindResult,
  collectTaxInKind,
  type FoodVarietyScore,
  calculateFoodVariety,
  type ExtractionIndustry,
  EXTRACTION_INDUSTRY_DATA,
  createFarmPlot,
} from './agriculture'

export {
  MMAgriculture,
  type MMAgricultureDomainState,
  type MMAgricultureOptions,
} from './mm-agriculture'

// — Mining layers (10-layer F→EX deep stack per mine node) —
export {
  type MineLayer,
  applyDailyDepletion,
  createSurfaceLayer,
} from './mining-layers'

export {
  MMMineNode,
  type MMMineNodeDomainState,
  type MMMineNodeOptions,
} from './mm-mining-layers'

// — Mining MFs (dig + reveal) —
export * from './mf-mine-dig'

// — Extraction MM (operation on a deposit — works through production-chain) —
export {
  MMExtraction,
  type MMExtractionDomainState,
} from './mm-extraction'

// — Craftsman (the production-chain consumer) —
export * from './craftsman'

// — Cooking (HubFoodState — 6 cuisine regions × 5 meal qualities) —
export {
  type CookingFuel,
  type CuisineRegion,
  CUISINE_DATA,
  type MealQuality,
  type MealIngredients,
  type CookResult,
  type HubFoodState,
  cookMeal,
  calculateFoodMorale,
} from './cooking'

export {
  MMCooking,
  type MMCookingDomainState,
  type MMCookingOptions,
} from './mm-cooking'

// — Services (8 provider types × 21 service types × 3 urgencies) —
export {
  type ServiceType,
  type ProviderType,
  PROVIDER_CATALOG,
  SERVICE_TIER_GATES,
  type Urgency,
  URGENCY_MULTIPLIERS,
  type ServiceProvider,
  createProvider,
  canOfferService,
  type ContractStatus as ServiceContractStatus,
  type ServiceContract,
  quoteService,
  createServiceContract,
  acceptServiceContract,
  progressServiceContract,
  failServiceContract,
  cancelServiceContract,
  type CoveredEvent,
  type RiskContract,
  createRiskContract,
  fileClaim,
  expireRiskContract,
  type ServicesTickResult,
  weeklyServicesTick,
} from './services'

export {
  MMServices,
  type MMServicesDomainState,
  type MMServicesOptions,
} from './mm-services'

// — Entertainment (8 performance types × 6 venue categories; performers + patronage) —
export {
  type PerformanceType,
  type VenueCategory,
  VENUE_CAPACITY,
  VENUE_PRESTIGE,
  type Performer,
  type PerformanceResult,
  resolvePerformance,
  type Patronage,
  patronBenefit,
  type CulturalScore,
  calculateCulturalScore,
} from './entertainment'

export {
  MMEntertainment,
  type MMEntertainmentDomainState,
  type MMEntertainmentOptions,
} from './mm-entertainment'

// — Lore / library / rumors (handles already in T0 + library here) —
export {
  MMLore,
  type MMLoreDomainState,
  type MMLoreOptions,
} from './mm-lore'

// — Magic (lore-gate DC modifiers etc.) —
export * from './magic'

// — Religion (Temple is the operation here; pantheon + deity are kingdom/continent scope) —
// see Tier 15 for MMReligion / Pantheon / Deity exports

// — Guild jobs + chapters + parties + intel (operation level + chapter level) —
export {
  type GuildType,
  GuildTypeSchema,
  type GuildRank,
  GuildRankSchema,
  ADVENTURER_RANKS,
  type JobType,
  JobTypeSchema,
  type JobStatus,
  JobStatusSchema,
  type GuildJob,
  type PartyRole,
  PartyRoleSchema,
  type NPCPartyMember,
  type MonsterSighting,
  type TravelLogEntry,
  type NPCAdventurerParty,
  type GuildIntelligence,
  type GuildChapter,
  type Guild,
  resetGuildIdCounter,
  resetPartyIdCounter,
  resetJobIdCounter,
  createGuild,
  addGuildChapter,
  createNPCParty,
  postJob,
  type JobMatchResult,
  matchJobsToParties,
  dispatchParty,
  type JobResolutionResult,
  resolveJob,
  fileIntelReport,
  type IntelPropagation,
  propagateIntel,
  type GuildTickResult,
  tickGuildChapter,
  type CaravanRumor,
  type CaravanArrivalDigest,
  type DigestResult,
  digestCaravanArrival,
} from './guild'

// — Guild quest generator (auto-quest from town κ) —
export * from './guild-quest-generator'
export * from './guild-receptionist'

export {
  MMGuild,
  type MMGuildDomainState,
  type MMGuildOptions,
} from './mm-guild'

// — Study (per-character × resource × hub; F→EX completion days; LLM-supervised discovery in src/) —
export * from './study'
export * from './mf-study-tech'

// — Knowledge pool MM (per-hub or institution; 5 seed categories) —
export {
  MMKnowledgePool,
  type MMKnowledgePoolDomainState,
  type MMKnowledgePoolOptions,
} from './mm-knowledge-pool'

// — Infrastructure MM (settlement evolution: knowledge → professions → guilds → workshops) —
export {
  type ProfessionTier,
  type Profession,
  STANDARD_PROFESSIONS,
  type GuildFormationRule,
  GUILD_FORMATION_RULES,
  type InfrastructureState,
  createInfrastructure,
  evaluateProfessions,
  type GuildFormationEvent,
  checkGuildFormation,
  type InfrastructureTickResult,
  tickInfrastructure,
  injectExplorationSeeds,
  injectTradeSeeds,
  injectPlayerDiscovery,
  injectResearchSeed,
  ascendCharacter,
  type InfrastructureSnapshot,
  snapshotInfrastructure,
} from './infrastructure-mm'

export {
  MMInfrastructure,
  type MMInfrastructureDomainState,
  type MMInfrastructureOptions,
} from './mm-infrastructure'

// — Ecology interactables (8 starter species across 4 kinds: flora/fauna/fungi/moss) —
export {
  type InteractableKind,
  InteractableKindSchema,
  type EcologySkill,
  EcologySkillSchema,
  type Rarity,
  RaritySchema,
  type InteractionTemplate,
  InteractionTemplateSchema,
  type InteractableLore,
  InteractableLoreSchema,
  type InteractableSpecies,
  InteractableSpeciesSchema,
  type EcologyKnowledgeLevel,
  EcologyKnowledgeLevelSchema,
  KNOWLEDGE_DC_DISCOUNT,
  ECOLOGY_INTERACTABLES,
  getInteractable,
  interactablesByKind,
  interactablesByBiome,
} from './ecology-interactables'

export {
  MMEcologyInteractables,
  type MMEcologyInteractablesDomainState,
  type MMEcologyInteractablesOptions,
  RARITY_REGEN_RATE,
} from './mm-ecology-interactables'

// — Ecology MFs (study, harvest) —
export * from './mf-ecological-study'

// — Ecology pool accessor (combined biome + fauna + adaptation) —
export {
  type EcologyAt,
  ecologyAt,
  getAdaptationPool,
  writeAdaptationPool,
  regionForNode,
} from './ecology-pool'

// ====================================================================
// TIER 9 — CHUNK
// ====================================================================
//
// A 100×100 unit area inside a hub. Generated on demand from seed,
// LRU-cached. Buildings + streets + POIs live here. The chunk is
// the streaming unit for hub interiors.
//
// Spatial: BUILDING (chunk-local x,y).
// Compute: deterministic regenerate (HubChunkManager).
// Storage: derived (cache only, not persisted).

// — Hub topology generators (6 topologies: natural/planned/hybrid/radial/linear/clustered) —
export {
  SeededRNG,
  type Point,
  type Street,
  type Lot,
  type ChunkLayout,
  NaturalTopology,
  PlannedTopology,
  RadialTopology,
  LinearTopology,
  HybridTopology,
  generateChunkLayout,
  generateDistrictLayout,
} from './hub-topology'

// — Hub chunks (the manager + observer state + chunk generation) —
export {
  ChunkManager,
  HubGenerator,
} from './hub-chunks'

// ====================================================================
// TIER 10 — DISTRICT
// ====================================================================
//
// A thematic group of chunks within a hub. The district is where
// κ-overrides for law/wealth/crime apply. 16 district types from
// center to necropolis.
//
// Spatial: NODE (district .tp node, child of settlement).
// Compute: HubGenerator pure-fn (deterministic).
// Storage: catalog-derived + κ override slots.

// — Hub schema (the canonical hub structure: building/street/POI/chunk/district types) —
export {
  type HubSize,
  HUB_SIZE_CONFIG,
  type TopologyType,
  type DistrictType,
  DISTRICT_ADJACENCY,
  type BuildingType,
  type HubBuilding,
  type HubStreet,
  type HubPOI,
  type HubChunk,
  type HubDistrict,
  type Hub,
  type HubSeed,
  type HubObserverState,
  CHUNK_LOAD_RADIUS,
  MAX_CACHED_CHUNKS,
} from './hub-schema'

// ====================================================================
// TIER 11 — SETTLEMENT (the hub)
// ====================================================================
//
// The unit that civilization measures. 6 sizes (outpost → metropolis).
// The leaf of the .tp tree where the 6 leaf-only κ domains attach
// (settlement, market, infrastructure, knowledge, guild, water).
//
// Spatial: NODE (hub .tp node).
// Compute: every layered MM anchored here ticks at its cadence.
// Storage: mm_states + κ.settlement / .market / .infrastructure / .knowledge / .guild / .water.

// — Hub builder (constructs a full hub from a scale + district templates) —
export {
  type HubScale,
  HubScaleSchema,
  type HubScaleParams,
  SCALE_PARAMS,
  type DistrictTemplate,
  DEFAULT_DISTRICTS,
  type DistrictHub,
  type HubBuilderOptions,
  buildHub,
  resetContainerIdCounter,
} from './hub-builder'

// — Settlement state MM (population, stability, prosperity, unrest, foodSecurity, …) —
export {
  type SettlementSize,
  SettlementSizeSchema,
  type SettlementState,
  SettlementStateSchema,
  MMSettlement,
} from './mm-settlement'

// — Settlement market (price discovery + merchant decisions + market events) —
export {
  type MerchantTier,
  type TierRequirements,
  TIER_REQUIREMENTS,
  type MerchantSpecialization,
  SPECIALIZATION_GOODS,
  type VenueType,
  type Venue,
  createVenue,
  type InventorySlot,
  type Merchant,
  createMerchant,
  type CommodityPrice,
  type PriceDiscoveryResult,
  discoverPrice,
  calculateSellerResistance,
  type HaggleResult,
  resolveHaggle,
  type MerchantDecisionType,
  type MerchantDecision,
  simulateMerchantDecision,
  canUpgradeTier,
  type MarketEventType,
  type MarketEvent,
  createMarketEvent,
  type SettlementMarket,
  createSettlementMarket,
  type MarketTickResult,
  weeklyMarketTick,
} from './market'

export {
  MMMarket,
  type MMMarketDomainState,
  type MMMarketOptions,
} from './mm-market'

// — Technology web (per-settlement tier map for tools/crafts; F→EX progression) —
export {
  MMTechnologyWeb,
  type MMTechnologyWebDomainState,
  type MMTechnologyWebOptions,
} from './mm-technology-web'

export * from './technology-web'

// — Trading company (cross-settlement merchant org) —
export * from './trading-company'

// ====================================================================
// TIER 12 — EDGE / ROUTE
// ====================================================================
//
// The corridors between settlements. Where transit happens. Where
// dungeon gates spawn. Where road infrastructure is claimed and
// maintained. Where caravans and shipments live during travel.
//
// Spatial: LINE (1D mile-marker on edge) or EDGE (mode-agnostic).
// Compute: MMxxx daily for in-transit; weekly for gates.
// Storage: mm_states + κ.ecology (gates contribute danger).

// — World edge (terrain + segments + sites + traversal + fast travel) —
export {
  type TerrainType,
  TerrainTypeSchema,
  TERRAIN_SPEED_MOD,
  TERRAIN_RESOURCE_TABLE,
  type RoadCondition,
  RoadConditionSchema,
  ROAD_SPEED_MOD,
  ROAD_REQUIREMENTS,
  ROAD_UPGRADE_COST,
  type OwnershipSegment,
  OwnershipSegmentSchema,
  type DiscoveredSite,
  DiscoveredSiteSchema,
  type WorldEdge,
  WorldEdgeSchema,
  type TraversalState,
  type TraversalTickResult,
  calculateTravelSpeed,
  estimateTravelDays,
  getSegmentAtMile,
  beginTraversal,
  tickTraversal,
  resetSiteIdCounter,
  resetEdgeIdCounter,
  claimSegment,
  upgradeRoad,
  setPatrol,
  unlockFastTravel,
  createWorldEdge,
} from './world-edge'

// — Dungeon gate (Solo Leveling-style spawner with overflow → leader emerges → migration loop) —
export {
  type GateType,
  GateTypeSchema,
  type GateState,
  GateStateSchema,
  GATE_TIER_CONFIG,
  GATE_SPECIES_TABLE,
  type DungeonGate,
  type DungeonGateFromEcologyInput,
  type DungeonGateFromEcologyResult,
  resetGateIdCounter,
  createDungeonGate,
  createDungeonGateFromEcology,
  type GateTickResult,
  tickDungeonGate,
  type ClearAttemptResult,
  attemptClearGate,
  activateGate,
} from './dungeon-gate'

export {
  MMDungeonGate,
  type MMDungeonGateDomainState,
  type MMDungeonGateOptions,
  computeDangerLevel,
  computeDominantThreats,
} from './mm-dungeon-gate'

// — Gate lifecycle (orchestrates dungeon-gate ticks with ecology pool feedback) —
export {
  tickGateWithEcology,
} from './gate-lifecycle'

// — Caravan (7 vehicle types × 7 statuses; cargo + bullion + rumors + books) —
export {
  type CaravanType,
  type CaravanProfile,
  CARAVAN_PROFILES,
  type CargoItem,
  type CaravanStatus,
  type Caravan,
  createCaravan,
  loadCargo,
  departCaravan,
  type CaravanDayResult,
  type CaravanEncounter,
  advanceCaravanDay,
  type UnloadResult,
  unloadCaravan,
} from './caravan'

export {
  MMCaravan,
  type MMCaravanDomainState,
  type MMCaravanOptions,
  type SegmentInfo,
  type CaravanArrivalResult,
  caravanEntityId,
} from './mm-caravan'

// — Shipment (logistics-layer abstract delivery, mode-agnostic) —
export * from './logistics'

export {
  MMShipment,
  type MMShipmentDomainState,
  type MMShipmentOptions,
  shipmentEntityId,
} from './mm-logistics'

// ====================================================================
// TIER 13 — REGION (group of hubs sharing biome)
// ====================================================================
//
// A region is the smallest scope where ecology lives. Adaptation
// pools, wild herds, water bodies, biome — all attach here.
// Inheritable κ flows from region down into its settlements.
//
// Spatial: NODE (region .tp node, type='region') + HEX (worldgen).
// Compute: MMxxx daily (wild fauna, water) or weekly (interactables).
// Storage: κ.ecology + κ.water at region; mm_states for the MMs.

// — Biome substrate (11 biome types from src/game/biome.ts; MOB taxonomy here) —
export {
  type BiomeType,
  type MobSize,
  MOB_SIZE_PX,
  crToMobSize,
  type Temperament,
  type MobObjective,
  type SpeciesInfo,
  SPECIES_TABLE,
  speciesInfo,
  type GateType as BiomeFaunaGateType,
  biomeAt,
  faunaAt,
  selectMonsterSpecies,
  candidateSpeciesFor,
  deriveBaseCR,
} from './biome-fauna'

// — Water bodies (9 types: stream/river/lake/bay/sea/ocean/delta/swamp + spring/well) —
export {
  MMWater,
  type MMWaterDomainState,
  type WaterBody,
  type WaterLevelState,
  type WaterBodyType,
} from './mm-water'

export * from './water'

// ====================================================================
// TIER 14 — KINGDOM (group of regions, single sovereignty)
// ====================================================================
//
// Faction control + currency issuance + diplomatic standing live
// at the kingdom layer. Royal titles inherit down. Armies are
// raised here even if they fight elsewhere.
//
// Spatial: NODE (kingdom .tp node) + HIER (faction control set).
// Compute: MMxxx monthly (factions, warfare, currencies weekly).
// Storage: mm_states + κ.faction.control + κ.economy.exchangeRates + κ.military.

// — Currency systems (per-kingdom coinage; gem catalog as universal credit) —
export {
  type CurrencySystem,
  BASE_DENOMINATION_RATES,
  type ExchangeRate,
  effectiveExchangeRate,
  convertCurrency,
  type GemTier,
  GEM_BASE_VALUES,
  type GemType,
  GEM_CATALOG,
  appraiseGem,
  type ExchangeTickResult,
  weeklyExchangeTick,
  recordTrade,
  createCurrencySystem,
} from './currency'

export {
  MMCurrency,
  type MMCurrencyDomainState,
  type MMCurrencyOptions,
} from './mm-currency'

// — Factions (10 types: guild/noble_house/criminal/religious/military/merchant/arcane/government/tribal/revolutionary) —
export {
  type FactionType,
  FactionTypeSchema,
  type FactionGoalType,
  FactionGoalTypeSchema,
  type FactionGoal,
  FactionGoalSchema,
  type FactionRank,
  FactionRankSchema,
  RANK_AUTHORITY,
  type FactionMember,
  FactionMemberSchema,
  type Faction,
  FactionSchema,
  getLoyalty,
  shiftLoyalty,
  getLoyaltyStance,
  areAtWar,
  calculateProductionBonus,
  calculateFactionPriceModifier,
  type FactionTickResult,
  tickFaction,
  resetFactionIdCounter,
  createFaction,
  addMember as addFactionMember,
  addGoal as addFactionGoal,
} from './faction'

export {
  MMFaction,
  type MMFactionDomainState,
  type MMFactionOptions,
  GOAL_DRIVE_ALIGNMENT,
  leaderProgressMultiplier,
} from './mm-faction'

// — Warfare MM (army readiness + upkeep + diplomatic drift) —
export {
  MMWarfare,
  type MMWarfareDomainState,
  type MMWarfareOptions,
} from './mm-warfare'

// — Cross-system edges (faction ↔ ecology, social ↔ faction, knowledge ↔ magic, etc.) —
export {
  type PredationResult,
  resolvePredation,
  type ContractFactionEffect,
  type ContractFactionImpact,
  computeContractFactionImpact,
  calculateKnowledgeMagicModifier,
  type IntelType,
  type IntelReport,
  type FactionReaction,
  computeFactionReaction,
  type DungeonKnowledgeYield,
  calculateDungeonKnowledgeYield,
  type FollowerCombatProfile,
  generateFollowerCombatProfile,
  type MonsterHuntInput,
  type MonsterHuntResult,
  applyMonsterHunt,
} from './system-edges'

// ====================================================================
// TIER 15 — CONTINENT (multi-kingdom)
// ====================================================================
//
// Pantheons, cultures, and the long-form metaplot live at continent
// scope. Religion ticks yearly because gods change tier on millennial
// scales. Narrative is the campaign's metaplot orchestrator.
//
// Spatial: NODE (continent .tp node).
// Compute: MMReligion yearly, MMNarrative weekly.
// Storage: κ.religion + mm_states (narrative).

// — Religion (15 domains × 5 statuses × 9 alignments × 6 power tiers) —
export {
  type DomainType,
  type DivineDomain,
  type DeityStatus,
  type DeityAlignment,
  type Deity,
  FAITH_TIER_THRESHOLDS,
  calculatePowerTier,
  type ClergyRank,
  RANK_FAITH_MULTIPLIER,
  type ClergyMember,
  clergyFaithOutput,
  type TempleSize,
  TEMPLE_BASE_FAITH,
  type Temple,
  templeFaithOutput,
  type InterventionType,
  INTERVENTION_COST,
  type DivineIntervention,
  requestIntervention,
  type FaithTickResult,
  yearlyFaithTick,
  type Pantheon,
  yearlyPantheonTick,
  dominantDeity,
} from './religion'

export {
  MMReligion,
  type MMReligionDomainState,
  type MMReligionOptions,
} from './mm-religion'

// — Narrative (campaign metaplot: arcs, quests, beats, rabbit-holes; pacing biases) —
export * from './narrative'

export {
  MMNarrative,
  type MMNarrativeDomainState,
  type MMNarrativeOptions,
} from './mm-narrative'

// ====================================================================
// TIER 16 — PLANET
// ====================================================================
//
// The world tree's top inheritable node. κ flows down from here
// through continents → kingdoms → regions → settlements → districts
// → buildings. The base node set; the canonical world bootstrap.
//
// Spatial: NODE (planet .tp node, type='planet').
// Compute: passive (host for planetary-scope MMs).
// Storage: TP graph.

// — Planet bootstrap (TP construction + canonical MM registration) —
export {
  SETTLEMENT_NODE_IDS,
  BASE_NODES,
  buildBaseTp,
  registerCanonicalMMs,
} from './world-bootstrap'

// — Hub (the settlement schema lives at T11 but the planet's hub graph is here) —
// already exported in T10/T11

// ====================================================================
// TIER 17 — WORLD STATE (the capoff)
// ====================================================================
//
// The cosmic / temporal scalars. The clock that ticks for everyone,
// the weather that crowns each region, the canonical record that
// survives forever. The TP topology + the TPB log.
//
// Spatial: ABSTRACT (world clock, TPB log) or NODE (weather per region).
// Compute: Clockwork daily heartbeat; MMWeather weekly.
// Storage: tpb_entries (canonical) + worlds.currentDay.

// — Weather (4 seasons × 10 precipitation × 5 wind × 4 visibility × severity; 5 sea states) —
export * from './weather'

export {
  MMWeather,
  type MMWeatherDomainState,
} from './mm-weather'

// — Clockwork (the unified tick engine — 7 dependency layers, cadence counters, active-hub gate) —
export {
  Clockwork,
  type TickCadence,
  CADENCE_DAYS,
  type ClockworkConfig,
  type MMRegistration,
  type DailyTickResult,
  type CrankResult,
  type ObservationResult,
  type DeltaState,
  type ClockworkSnapshot,
} from './clockwork'

// — World tick (the older standalone heartbeat — kept for backward compat with non-Clockwork systems) —
export {
  WorldTickEngine,
  type WorldClockState,
  createWorldClock,
  type TickSystem,
  type DailyTickResult as WorldTickDailyResult,
  type ObservationTickResult,
  type WorldClockSnapshot,
  createStandardSystems,
} from './world-tick'

// — TP (topology pointer — the world graph + κ resolution + entity position registry) —
export {
  TP,
  type WorldNode,
  WorldNodeSchema,
  type WorldEdge as WorldEdgeRef,
  type PhysicsRules,
  PhysicsRulesSchema,
  type LawRules,
  LawRulesSchema,
  type EconomyRules,
  EconomyRulesSchema,
  type WeatherRules,
  WeatherRulesSchema,
  type EcologyRules,
  EcologyRulesSchema,
  type FactionRules,
  FactionRulesSchema,
  type SocialRules,
  SocialRulesSchema,
  type CultureRules,
  CultureRulesSchema,
  type ReligionRules,
  ReligionRulesSchema,
  type MilitaryRules,
  MilitaryRulesSchema,
  type SettlementRules,
  SettlementRulesSchema,
  type MarketRules,
  MarketRulesSchema,
  type InfrastructureRules,
  InfrastructureRulesSchema,
  type KnowledgeRules,
  KnowledgeRulesSchema,
  type GuildRules,
  GuildRulesSchema,
  type WaterRules,
  WaterRulesSchema,
  INHERITABLE_DOMAINS,
  LEAF_DOMAINS,
  type KappaDomain,
  type InheritableDomain,
  type LeafDomain,
  type DomainValueMap,
  DOMAIN_SCHEMAS,
  type LocalContext,
  LocalContextSchema,
  type EntityPosition,
  EntityPositionSchema,
  type Entity,
  EntitySchema,
} from './tp'

// — TPB (append-only history primitive — the canonical worldline log) —
export {
  TPB,
} from './tpb'

// — World TPB action union (the wire format — 10 variants: tick/writeKappa/writeEdge/entitySpawn/Move/Despawn/observe/session/characterTransfer) —
export {
  WorldTPBActionSchema,
  type WorldTPBAction,
  type WorldTPB,
} from './tpb-world'

// — TPB replay (apply actions to a TP — used by both server hydrate and client hydrate) —
export {
  applyTpbAction,
  applyTpbActions,
} from './tpb-replay'

// — TP write capture (monkey-patches κ writes into a buffer; produces WorldTPBAction[]) —
export {
  attachWriteLog,
} from './tp-write-capture'

// ====================================================================
// INFRASTRUCTURE — outside the ladder, the medium not the entities
// ====================================================================
//
// MFs (manifold functions — the atomic transformations [x, K; K, x]),
// the MM/MF/TP/TPB base types, the Clockwork engine and helpers,
// the seeded RNG, and the system-edges integration wires.
// These are the *medium* in which entities exist — they do not appear
// on the entity ladder.

// — Core MM/MF type system (CycleDelta, Receipt, MFState, MMState, FlowBreakSignal) —
export {
  type CycleDelta,
  CycleDeltaSchema,
  ZERO_DELTA,
  type MFState,
  MFStateSchema,
  type MFTickOutput,
  MFTickOutputSchema,
  type MMState,
  MMStateSchema,
  type FlowBreakSignal,
  FlowBreakSignalSchema,
  type Receipt,
  ReceiptSchema,
  type TPBEntry,
  TPBEntrySchema,
  addDeltas,
  createMF,
  createMM,
} from './types'

// — ISimulatedMM (the world-tree MM interface; SimulatedMMBase is the base class) —
export {
  type ISimulatedMM,
  type SimulatedMMState,
  SimulatedMMStateSchema,
  type PendingDelta,
  PendingDeltaSchema,
  EMPTY_PENDING,
  type ResolveResult,
  ResolveResultSchema,
  SimulatedMMBase,
} from './mm-simulated'

// — MF transformations (atomic forward passes — each produces { output, receipt }) —
export {
  mfDice,
  type DiceFormula,
  type DiceResult,
  type DiceReceipt,
} from './mf-dice'

export {
  mfCheck,
  type CheckParams,
  type CheckResult,
  type CheckReceipt,
} from './mf-check'

export {
  mfDamage,
  type DamageInput,
  type TargetState,
  type DamageResult,
  type DamageReceipt,
} from './mf-damage'

// — MF pools (pre-grind pattern — generate ahead-of-tick, peel one per call) —
export {
  MFPool,
  type PoolConfig,
} from './mf-pool'

export {
  DicePool,
} from './mf-pool-dice'

// — Hologram (the engine tensor — tile observer projection + renderer primitive) —
export {
  hologramAt,
  receiptsMatch,
  type MaterialClass,
  type MaterialComposition,
  type Primitive,
  type SurfaceProperties,
  type ObserverFilter,
  type RenderedTile,
  type HologramInputs,
  type HologramReceiptInputs,
  type TileDiff,
} from './hologram'

// — Morphogen field (substrate quantizer — step 3+4 of the hologram) —
export {
  computeMorphogenField,
  pickMaterialComposition,
  pickBiomeVariant,
  rollEntityPresence,
  rollAffixes,
  type MorphogenField,
  type EntityRoll,
} from './morphogen'

// — Primitives registry (static per-MaterialClass geometry catalog) —
export {
  PRIMITIVE_REGISTRY,
  MATERIAL_CLASSES,
  instancePrimitive,
  type PrimitiveTemplate,
} from './primitives'

// — CommonGenerator HOF (entity generator pattern from sectors-without-number) —
export {
  commonGenerator,
  type BaseEntity,
  type BaseEntityConfig,
  type EntityGenerator,
} from './common-generator'

// — Note on no-LLM rule —
//
// No LLM imports anywhere in `engine/`. The closest the engine comes
// to "speaking" is `assembleAgentContext` from `intelligence.ts`,
// which produces a STRUCTURED data card, not prose. Any LLM call
// (NPC dialogue, gm-ai narration, study/discovery completion) lives
// in `src/`, never here.

// ====================================================================
// END OF MESH-POTENTIAL
// ====================================================================
//
// What you now have access to with one import:
//
//   import * as Engine from '@/engine/mesh-potential'
//
//   — All 47 MM classes (T3 through T17)
//   — All 50+ commodities, ~20 gems, 12 herd species, 6 wild fauna,
//     8 ecology interactables, 30 building types, 16 district types,
//     11 biomes, 13 trap types, 10 dungeon room types, 12 tile types,
//     17 occupations, ~25 professions, 16 culture/title/contract sets,
//     10 deities domains, 10 adaptations, 11 affixes, 10 tier steps.
//   — The full TP graph + κ resolution + entity registry + 16 κ domains.
//   — The Clockwork heartbeat + 7 dependency layers + cadence math.
//   — The TPB append-only log + 10 action variants + replay machinery.
//   — Every MF transformation (dice, check, damage, smelt, forge, identify,
//     mine-dig, study-tech, herd-life, ecological-study, fauna-predation, craft).
//   — The seeded RNG (FNV-1a + LCG) for determinism.
//   — The cross-system integration wires (predation, contract→faction,
//     intel→faction, dungeon→knowledge, follower→combat, monster→fauna).
//
// This file IS the white light. Every consumer projects from it.
// Every fresh reader (human or AI) orients here first.
