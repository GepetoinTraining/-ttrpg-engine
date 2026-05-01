/**
 * TTRPG ENGINE — Complete Database Schema (Drizzle + Turso/libSQL)
 * =================================================================
 *
 * 131 tables across 12 layers.
 * TP = Tables (the schema), TPB = Rows (the history).
 * Every table IS a .tp node type. Every row IS a .tpb entry.
 *
 * Layers:
 *   L0  Foundation       (6)   worlds, regions, edges, climate, commodities, dice
 *   L1  Geography        (4)   settlements, buildings, dungeons
 *   L2  Economy         (22)   inventory, items, weapons, armor, enchantments, merchants, banking, trade
 *   L3  Social          (13)   factions, contracts, kinship, titles, guilds, craftsmen
 *   L4  Ecology+Warfare (20)   monsters, herds, weather, water, magic, religion, armies, spies, diplomacy
 *   L5  Characters      (22)   PCs, abilities, skills, feats, equipment, attunement, spells, dice pools, NPCs
 *   L6  Sessions+Modes  (17)   campaigns, play modes, simulation, sessions, corridors, clockwork events
 *   L7  Narrative        (7)   arcs, quests, beats, villains, patrons, conflicts
 *   L8  Intelligence    (10)   agents, knowledge, memories, intent, drives, goals, schemes
 *   H   Hub+Culture      (7)   districts, food, performers, libraries, books, rumors, travel
 *   W   Wiki+Vector      (4)   articles, tags, links, embeddings
 *   Ω   Clockwork        (3)   mm states, tick log, tpb entries
 */

import { sqliteTable, text, integer, real, blob, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ============================================================
// USERS & AUTH (Topology-First: φ + ζ = π)
// ============================================================

/**
 * Users — identity is a spacetime coordinate.
 * No passwords, no tokens, no sessions.
 * Seed = datetime + geolocation → prime factorization → seeded Fibonacci → ζ
 * Auth = M^n trajectory matching where M = [[φ, ζ], [ζ, φ]]
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  // Topology auth seed
  seed: text('seed').notNull(),          // bigint as string — spacetime coordinate
  primesJson: text('primes_json').notNull(), // prime factorization of seed
  zeta: real('zeta').notNull(),           // ζ — seeded Fibonacci convergence
  // Enrollment moment (the unreproducible anchor)
  enrolledAt: text('enrolled_at').notNull(),
  enrollGeoLat: real('enroll_geo_lat').notNull(),
  enrollGeoLon: real('enroll_geo_lon').notNull(),
  // Status
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastAuthAt: text('last_auth_at'),
})

/** Pending enrollments awaiting human/admin verification */
export const authEnrollments = sqliteTable('auth_enrollments', {
  token: text('token').primaryKey(),
  requestedId: text('requested_id').notNull(),
  geoLat: real('geo_lat').notNull(),
  geoLon: real('geo_lon').notNull(),
  requestedAt: text('requested_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
})

/** Active challenges — short-lived (30s TTL) */
export const authChallenges = sqliteTable('auth_challenges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  n: integer('n').notNull(),             // random exponent 10-1000
  expectedTrajectory: text('expected_trajectory').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
})

/**
 * Accounts — top-level player identity.
 * Same topology math as `users` (geo + datetime → seed → primes → ζ),
 * but minted self-serve at landing with no email/password/invite.
 * Owns N character certs over its lifetime.
 *
 * Per `project_cert_hierarchy.md`: the eventual reshape renames `users` →
 * `accounts` after wipe+reseed. For now we add the new table alongside
 * the legacy one so the new flow can land without disrupting existing
 * invite-based auth surfaces.
 */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  seed: text('seed').notNull(),
  primesJson: text('primes_json').notNull(),
  zeta: real('zeta').notNull(),
  geoLat: real('geo_lat').notNull(),
  geoLon: real('geo_lon').notNull(),
  createdAt: text('created_at').notNull(),
  /** Append-only origin record: every character ever minted by this account */
  characterCreatedLog: text('character_created_log').notNull().default('[]'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

/**
 * Character trades — 2-step transfer of a character cert between accounts.
 *
 * Per `project_cert_hierarchy.md`:
 *   - `initiate`: current owner signs handoff intent. status='pending'.
 *   - `accept`:   receiver signs claim. ownerChain on character_certs gets
 *                 a new entry; accountId updates to receiver. status='accepted'.
 *   - The dual signatures are stored but NOT verified on the happy path
 *     ("math is the gate; signatures are forensic"). On dispute or audit,
 *     they're checked against (fromAccount.zeta × toAccount.zeta).
 *
 * Cancelled trades stay in the table for audit; they don't update the cert.
 */
export const characterTrades = sqliteTable('character_trades', {
  id: text('id').primaryKey(),
  characterCertId: text('character_cert_id').notNull(),
  fromAccountId: text('from_account_id').notNull(),
  toAccountId: text('to_account_id').notNull(),
  initiatedAt: text('initiated_at').notNull(),
  acceptedAt: text('accepted_at'),
  cancelledAt: text('cancelled_at'),
  /** Forensic signature from the initiator's account cert. */
  initiateSig: text('initiate_sig').notNull(),
  /** Forensic signature from the receiver's account cert. Null until accepted. */
  acceptSig: text('accept_sig'),
  status: text('status', { enum: ['pending', 'accepted', 'cancelled'] }).notNull().default('pending'),
})

/**
 * Flywheel slots — pending world-state pushes from clients.
 *
 * Per `project_cert_hierarchy.md` "Client-side TPB + flywheel slot pattern":
 *   - Clients batch `WorldTPBAction[]` locally and push to this table
 *     periodically (solo/dmless: hourly-ish; DM-hosted parties: at session
 *     end/pause).
 *   - An hourly drain job sweeps `flywheel_slots` ordered by `queued_at ASC`,
 *     copies into `tpb_entries` in arrival order (canonical sequence),
 *     marks `processed_at`, emits to the railgun spectrum.
 *   - The arrival order at the server IS the canonical sequence — no clock
 *     arbitration, no merge logic. Out-of-order timestamps inside the
 *     bundle are fine; the .tpb is append-only and absorbs naturally.
 *
 * Two push shapes coexist:
 *   - solo: `{ characterCertId, atDay, actions[], receipts[] }`
 *   - DM session bundle: `{ dmCertId, sessionId, atDay, endDay, actions[],
 *     receipts[], dmSignature }` (the entire session signed by DM cert as
 *     shard authority)
 *
 * The `payload_json` column carries the full push payload so the drain
 * job can reconstruct + replay without losing context.
 */
export const flywheelSlots = sqliteTable('flywheel_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Source cert: characterCertId for solo, dmCertId for session bundles */
  sourceCertId: text('source_cert_id').notNull(),
  /** 'solo' | 'dm-session' — tells the drain job which shape to read */
  pushKind: text('push_kind', { enum: ['solo', 'dm-session'] }).notNull(),
  /** Optional session id for DM-hosted bundles */
  sessionId: text('session_id'),
  /** atDay claimed by the client at push time (the .tpb head it computed against) */
  atDay: integer('at_day').notNull(),
  /** End day for DM session bundles (null for solo) */
  endDay: integer('end_day'),
  /** Full push payload as JSON: actions[] + receipts[] + (dmSignature if dm-session) */
  payloadJson: text('payload_json').notNull(),
  /** When the client posted this slot */
  queuedAt: text('queued_at').notNull(),
  /** Set by the drain job when copied to tpb_entries; null = pending */
  processedAt: text('processed_at'),
})

/**
 * Character certs — per-character identity, owned by an account.
 *
 * Same topology math as `accounts` (geo + datetime → seed → primes → ζ),
 * minted at chargen time. The persona type is FIXED at creation:
 *   player  — has a human DM, lives in session time
 *   dm      — runs a table for player characters (god lens)
 *   gm-ai   — solo player with AI as DM, session time
 *   dmless  — pure clockwork solo, server time, can't fast-travel
 *
 * `account_id` is the CURRENT commander; `owner_chain_json` is the full
 * history (last entry is the current owner). Trades append a new account
 * id to the chain.
 *
 * `character_data_id` points at the existing `characters` table row that
 * holds the sheet (HP, abilities, classes, etc.). Cert is identity, the
 * sheet is data.
 */
export const characterCerts = sqliteTable('character_certs', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),  // current commander (last in ownerChain)
  seed: text('seed').notNull(),
  primesJson: text('primes_json').notNull(),
  zeta: real('zeta').notNull(),
  geoLat: real('geo_lat').notNull(),
  geoLon: real('geo_lon').notNull(),
  createdAt: text('created_at').notNull(),
  /** JSON array of accountIds — append-only, last entry is current commander */
  ownerChainJson: text('owner_chain_json').notNull(),
  /** FK to characters.id — the actual character sheet. Nullable until chargen completes. */
  characterDataId: text('character_data_id'),
  /** Fixed at creation. Drives time-flow + party compatibility rules. */
  personaType: text('persona_type', { enum: ['player', 'dm', 'gm-ai', 'dmless'] }).notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

// ============================================================
// L0 — FOUNDATION
// ============================================================

export const worlds = sqliteTable('worlds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('custom'),
  seed: integer('seed').notNull().default(0),
  currentDay: integer('current_day').notNull().default(1),
  createdAt: text('created_at'),
  // ── Wave 4 runtime state ──
  /** ISO timestamp of last cron tick. Used by /api/cron/tick to compute elapsed days. */
  lastCronAt: text('last_cron_at'),
  /** Where the canonical party is — drives Play.tsx location strip + transport. */
  partyNodeId: text('party_node_id'),
})

// Note: `tpbEntries` and `mmStates` tables are defined further below in the
// "Ω — CLOCKWORK STATE" section. Wave-4 persistence reuses them through the
// bridge in src/lib/world-tpb.ts (one row per WorldTPBAction).

export const worldRegions = sqliteTable('world_regions', {
  id: text('id').primaryKey(),
  worldId: text('world_id').notNull().references(() => worlds.id),
  parentId: text('parent_id'),  // self-ref
  name: text('name').notNull(),
  terrain: text('terrain').notNull(),
  depth: integer('depth').notNull().default(0),
  // Square voxel tile coordinates (formerly hex axial q/r — migrated 2026-04-30)
  tileX: integer('tile_x').notNull().default(0),
  tileY: integer('tile_y').notNull().default(0),
  explored: integer('explored', { mode: 'boolean' }).notNull().default(false),
  hasSettlement: integer('has_settlement', { mode: 'boolean' }).notNull().default(false),
  settlementName: text('settlement_name'),
  // Biome data (from noise)
  biome: text('biome'),
  elevation: real('elevation'),
  moisture: real('moisture'),
  temperature: real('temperature'),
  kappaJson: text('kappa_json'),  // κ inheritance data
  // Visual rendering data
  colorGround: text('color_ground'),
  colorAccent: text('color_accent'),
  colorSky: text('color_sky'),
  vegetationDensity: real('vegetation_density').notNull().default(0.5),
  moistureLevel: real('moisture_level').notNull().default(0.5),
  temperatureAvg: real('temperature_avg'),
  temperatureVariance: real('temperature_variance'),
  windExposure: real('wind_exposure').notNull().default(0.3),
  // Scale
  areaSqMiles: real('area_sq_miles'),
  chunkCountX: integer('chunk_count_x'),
  chunkCountY: integer('chunk_count_y'),
})

export const worldEdges = sqliteTable('world_edges', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => worldRegions.id),
  targetId: text('target_id').notNull().references(() => worldRegions.id),
  edgeType: text('edge_type').notNull(),
  distanceMiles: real('distance_miles').notNull(),
  terrain: text('terrain').notNull(),
  bidirectional: integer('bidirectional', { mode: 'boolean' }).notNull().default(true),
  segmentsJson: text('segments_json'),  // patrol/encounter segments
})

export const climateZones = sqliteTable('climate_zones', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  climate: text('climate').notNull(),  // tropical, arid, temperate, continental, polar, mediterranean, oceanic, subarctic
  seasonModifiersJson: text('season_modifiers_json'),
  // Precipitation
  annualRainfallMm: real('annual_rainfall_mm'),
  rainySeasons: text('rainy_seasons'),  // 'spring,autumn' or 'monsoon'
  snowfall: integer('snowfall', { mode: 'boolean' }).notNull().default(false),
  snowMonths: text('snow_months'),  // 'winter' or '11,12,1,2'
  // Temperature range (celsius)
  tempSummerHigh: real('temp_summer_high'),
  tempWinterLow: real('temp_winter_low'),
  // Wind
  prevailingWind: text('prevailing_wind'),  // N, NE, E, SE, S, SW, W, NW
  avgWindSpeed: real('avg_wind_speed'),  // km/h — affects sailing, flight, sound
  stormFrequency: text('storm_frequency'),  // rare, occasional, frequent, constant
  // Humidity
  humidityAvg: real('humidity_avg'),  // 0-100%  affects fog, mist rendering
})

// -- Infrastructure Catalog + Regional Instances --

/**
 * Infrastructure catalog — what CAN be built / what EXISTS as structure types.
 * Reference table. Rendering reads shape, material, scale.
 */
export const infrastructureCatalog = sqliteTable('infrastructure_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),  // 'Stone Bridge', 'Watchtower', 'Iron Mine', 'Grain Farm', 'Palisade Wall'
  category: text('category').notNull(),  // road, bridge, wall, gate, tower, mine, quarry, farm, mill, dam, aqueduct, canal, dock, lighthouse, shrine, ruin, camp, outpost, fort, monument
  subcategory: text('subcategory'),  // cobblestone_road, dirt_road, suspension_bridge, guard_tower, windmill, watermill
  // Visual (drives rendering)
  shape: text('shape').notNull(),  // linear, point, area, arc, ring
  materialPrimary: text('material_primary').notNull(),  // stone, wood, iron, brick, earth, thatch, marble
  materialSecondary: text('material_secondary'),
  colorPrimary: text('color_primary'),  // '#8B7355'
  colorSecondary: text('color_secondary'),
  scaleWidth: real('scale_width'),  // meters
  scaleHeight: real('scale_height'),
  scaleLength: real('scale_length'),  // for linear structures (roads, walls)
  architecturalStyle: text('architectural_style'),  // dwarven, elven, human_medieval, human_imperial, orcish, gnomish, ancient
  // Construction
  buildRequirementsJson: text('build_requirements_json'),  // {stone: 50, lumber: 20, iron: 10, labor_days: 30, skill: 'masonry'}
  maintenanceCostJson: text('maintenance_cost_json'),  // {gold_per_month: 5, labor_days_per_year: 10}
  buildDifficulty: text('build_difficulty'),  // simple, moderate, complex, masterwork, legendary
  // Function
  capacityJson: text('capacity_json'),  // {garrison: 20, storage: 100, throughput: '50 tons/day'}
  defenseBonus: integer('defense_bonus'),
  productionJson: text('production_json'),  // {output: 'grain', yield: '100 bushels/season'}
})

/**
 * Actual infrastructure placed in regions/edges.
 * Man-made structures outside settlements: roads, bridges, mines, farms, walls, towers.
 */
export const regionalInfrastructure = sqliteTable('regional_infrastructure', {
  id: text('id').primaryKey(),
  catalogId: text('catalog_id').notNull().references(() => infrastructureCatalog.id),
  // Location
  regionId: text('region_id').references(() => worldRegions.id),
  edgeId: text('edge_id').references(() => worldEdges.id),  // for roads, bridges along edges
  chunkId: text('chunk_id'),  // specific chunk for rendering
  localX: real('local_x'),
  localY: real('local_y'),
  // For linear structures (roads, walls, aqueducts)
  startX: real('start_x'),
  startY: real('start_y'),
  endX: real('end_x'),
  endY: real('end_y'),
  // State
  name: text('name'),  // 'The Old North Bridge', 'Crimson Watchtower'
  condition: text('condition').notNull().default('good'),  // pristine, good, worn, damaged, ruined, destroyed
  conditionPercent: real('condition_percent').notNull().default(100),  // 0-100
  operational: integer('operational', { mode: 'boolean' }).notNull().default(true),
  // Ownership
  ownerId: text('owner_id'),  // faction, settlement, player
  ownerType: text('owner_type'),  // faction, settlement, player, abandoned
  // Builder (who built this — can be enshrined in discoveries)
  builtByType: text('built_by_type'),  // player, npc, faction, ancient
  builtById: text('built_by_id'),
  builtByName: text('built_by_name'),
  // Temporal
  builtAtTick: integer('built_at_tick'),
  lastMaintainedTick: integer('last_maintained_tick'),
  decayRate: real('decay_rate').notNull().default(0.01),  // condition loss per tick without maintenance
})

// -- Structure Catalog (building types — for settlement/hub procgen) --

/**
 * Every type of building, shop, house, temple, warehouse.
 * Visual properties drive R3F rendering inside hubs/settlements.
 */
export const structureCatalog = sqliteTable('structure_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),  // 'Blacksmith', 'Tavern', 'Stone House', 'Wizard Tower', 'Market Stall'
  category: text('category').notNull(),  // residential, commercial, industrial, religious, military, civic, agricultural, arcane, storage, entertainment
  subcategory: text('subcategory'),  // inn, smithy, tannery, herbalist, jeweler, stable, barracks, chapel, granary, brewery, theater
  // Visual (drives rendering)
  materialPrimary: text('material_primary').notNull(),  // stone, wood, brick, thatch, adobe, marble, crystal, ironwood
  materialSecondary: text('material_secondary'),  // timber_frame, slate_roof, thatched_roof, copper_trim
  roofStyle: text('roof_style').notNull().default('pitched'),  // pitched, flat, domed, spired, thatched, tiled, crenellated
  stories: integer('stories').notNull().default(1),  // 1-5+ stories
  footprintType: text('footprint_type').notNull().default('rectangular'),  // rectangular, square, circular, l_shaped, u_shaped, irregular
  footprintWidth: real('footprint_width'),  // meters
  footprintDepth: real('footprint_depth'),
  heightMeters: real('height_meters'),
  architecturalStyle: text('architectural_style'),  // dwarven, elven, human_medieval, human_tudor, human_imperial, gnomish, halfling, orcish, ancient, exotic
  colorWalls: text('color_walls'),  // '#F5DEB3' wheat, '#8B7355' dark wood
  colorRoof: text('color_roof'),  // '#8B4513' brown, '#708090' slate grey
  colorTrim: text('color_trim'),  // '#2F1B0E' dark timber
  // Features (visual details)
  hasChimney: integer('has_chimney', { mode: 'boolean' }).notNull().default(false),
  hasBalcony: integer('has_balcony', { mode: 'boolean' }).notNull().default(false),
  hasSign: integer('has_sign', { mode: 'boolean' }).notNull().default(false),
  signType: text('sign_type'),  // hanging, painted, carved, illuminated
  windowStyle: text('window_style'),  // shuttered, arched, stained_glass, slitted, bay, none
  doorStyle: text('door_style'),  // wooden, iron_bound, double, archway, portcullis
  decorationsJson: text('decorations_json'),  // ['flower_boxes', 'gargoyle', 'banner', 'lantern', 'ivy']
  // Function
  capacity: integer('capacity'),  // occupants/customers
  storageUnits: integer('storage_units'),
  // Economy
  buildCostGp: real('build_cost_gp'),
  monthlyUpkeepGp: real('monthly_upkeep_gp'),
})

// -- Vehicle Catalog (carts, ships, mounts, siege — for travel/combat procgen) --

/**
 * Every vehicle type that moves through the world.
 * Visual properties for rendering on roads, seas, air.
 */
export const vehicleCatalog = sqliteTable('vehicle_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),  // 'Covered Wagon', 'War Galley', 'Riding Horse', 'Airship', 'Siege Tower'
  category: text('category').notNull(),  // land, water, air, mount, siege
  subcategory: text('subcategory'),  // cart, wagon, carriage, chariot | rowboat, sailboat, galley, longship, galleon | griffon, pegasus, carpet | battering_ram, catapult, trebuchet
  // Visual
  materialPrimary: text('material_primary').notNull(),  // wood, iron, leather, canvas, bone, crystal
  materialSecondary: text('material_secondary'),
  colorPrimary: text('color_primary'),  // '#8B4513' brown wood
  colorSecondary: text('color_secondary'),  // '#F5F5DC' canvas
  scaleLength: real('scale_length'),  // meters
  scaleWidth: real('scale_width'),
  scaleHeight: real('scale_height'),
  // Propulsion
  propulsion: text('propulsion').notNull(),  // pulled, sailed, rowed, ridden, magical, mechanical, self_powered
  crewRequired: integer('crew_required').notNull().default(0),
  crewMax: integer('crew_max'),
  // Movement
  speedMph: real('speed_mph').notNull(),
  terrainCompatJson: text('terrain_compat_json').notNull(),  // ['road', 'trail', 'grassland'] or ['river', 'coast', 'ocean']
  canTraverseRough: integer('can_traverse_rough', { mode: 'boolean' }).notNull().default(false),
  // Capacity
  passengerCapacity: integer('passenger_capacity').notNull().default(0),
  cargoCapacityLbs: real('cargo_capacity_lbs').notNull().default(0),
  // Combat
  hp: integer('hp'),
  ac: integer('ac'),
  weaponsJson: text('weapons_json'),  // [{name: 'ballista', damage: '3d10', range: 120}]
  // Size (tile occupancy on the square voxel grid — formerly hex_occupancy)
  size: text('size').notNull().default('large'),  // medium, large, huge, gargantuan
  tileOccupancy: integer('tile_occupancy').notNull().default(1),
  // Cost
  purchasePriceGp: real('purchase_price_gp'),
  dailyMaintenanceGp: real('daily_maintenance_gp'),
})

// -- Companion Catalog (pets, mounts, familiars, livestock, tamed monsters) --

/**
 * Reference of every tameable/ownable creature.
 * Visual properties for procgen sprite/model rendering.
 */
export const companionCatalog = sqliteTable('companion_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),  // 'Riding Horse', 'War Dog', 'Hawk', 'Pseudodragon', 'Dairy Cow'
  category: text('category').notNull(),  // pet, mount, familiar, beast_companion, livestock, war_beast, exotic, tamed_monster
  species: text('species').notNull(),  // horse, dog, cat, hawk, owl, wolf, bear, boar, chicken, cow, goat, pig, pseudodragon, blink_dog, displacer_beast
  // Visual (drives procgen rendering)
  bodyType: text('body_type').notNull(),  // quadruped, biped, avian, serpentine, insectoid, aquatic, amorphous
  size: text('size').notNull(),  // tiny, small, medium, large, huge
  colorPrimary: text('color_primary').notNull(),  // '#8B4513' brown
  colorSecondary: text('color_secondary'),  // '#F5DEB3' tan underbelly
  colorVariance: text('color_variance').notNull().default('medium'),  // low (uniform breed), medium, high (wild coloring)
  furType: text('fur_type'),  // short, long, shaggy, smooth, feathered, scaled, plated, none
  markingsJson: text('markings_json'),  // ['spotted', 'striped', 'socks', 'blaze', 'dappled', 'tabby']
  tailType: text('tail_type'),  // long, short, bushy, whip, prehensile, none
  // Stats
  hp: integer('hp').notNull(),
  ac: integer('ac').notNull(),
  speed: integer('speed').notNull(),
  speedSpecialJson: text('speed_special_json'),  // {fly: 60, swim: 30, burrow: 15, climb: 30}
  abilityScoresJson: text('ability_scores_json'),  // {str, dex, con, int, wis, cha}
  attacksJson: text('attacks_json'),  // [{name: 'bite', toHit: 4, damage: '1d6+2'}]
  // Tamability
  tameDC: integer('tame_dc').notNull(),  // animal handling DC
  tameTime: text('tame_time'),  // '1 week', '1 month', '1 year'
  domesticated: integer('domesticated', { mode: 'boolean' }).notNull().default(false),  // already domesticated breed vs wild
  // Utility
  rideable: integer('rideable', { mode: 'boolean' }).notNull().default(false),
  carryCapacityLbs: real('carry_capacity_lbs'),
  specialAbility: text('special_ability'),  // 'keen scent', 'darkvision 60ft', 'teleport 40ft'
  // Husbandry
  breedable: integer('breedable', { mode: 'boolean' }).notNull().default(false),
  gestationDays: integer('gestation_days'),
  offspringCount: text('offspring_count'),  // '1', '1d4', '2d6'
  produceJson: text('produce_json'),  // {milk: '1 gallon/day', eggs: '1/day', wool: '5 lbs/season'}
  lifespanYears: integer('lifespan_years'),
  // Linked bestiary
  monsterCatalogId: text('monster_catalog_id').references(() => monsterCatalog.id),
})

/**
 * Live companion instances — owned by characters.
 * A character's pet, mount, familiar, or livestock.
 */
export const companions = sqliteTable('companions', {
  id: text('id').primaryKey(),
  catalogId: text('catalog_id').notNull().references(() => companionCatalog.id),
  ownerId: text('owner_id').notNull().references(() => characters.id),
  name: text('name').notNull(),  // 'Shadowmere', 'Mr. Whiskers', 'Bessie'
  // Visual overrides (individual variation from catalog defaults)
  colorOverride: text('color_override'),  // this specific animal's color
  markingsOverride: text('markings_override'),
  // State
  hpCurrent: integer('hp_current').notNull(),
  hpMax: integer('hp_max').notNull(),
  conditionsJson: text('conditions_json'),  // ['poisoned', 'frightened']
  mood: text('mood').notNull().default('content'),  // happy, content, nervous, aggressive, sick, starving
  // Bond
  bondLevel: integer('bond_level').notNull().default(0),  // 0-100, affects loyalty and abilities
  trained: integer('trained', { mode: 'boolean' }).notNull().default(false),
  trainedCommandsJson: text('trained_commands_json'),  // ['stay', 'attack', 'fetch', 'guard', 'heel']
  // Breeding
  pregnant: integer('pregnant', { mode: 'boolean' }).notNull().default(false),
  dueAtTick: integer('due_at_tick'),
  parentIds: text('parent_ids'),  // 'sireId,damId' for lineage tracking
  generation: integer('generation').notNull().default(0),
  // Location (follows owner or stabled)
  stabled: integer('stabled', { mode: 'boolean' }).notNull().default(false),
  stableLocationId: text('stable_location_id'),
  // Age
  bornAtTick: integer('born_at_tick'),
})

export const commodityCatalog = sqliteTable('commodity_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  basePrice: real('base_price').notNull(),
  unit: text('unit').notNull().default('unit'),
})

export const diceReceipts = sqliteTable('dice_receipts', {
  id: text('id').primaryKey(),
  worldDay: integer('world_day').notNull(),
  rollerId: text('roller_id').notNull(),
  rollType: text('roll_type').notNull(),
  resultJson: text('result_json').notNull(),
})

// ============================================================
// L1 — GEOGRAPHY
// ============================================================

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  name: text('name').notNull(),
  population: integer('population').notNull().default(0),
  stability: real('stability').notNull().default(50),
  hubSeed: text('hub_seed'),
  hubSize: text('hub_size'),
  hubTopology: text('hub_topology'),
  era: text('era').notNull().default('medieval'),
})

export const buildings = sqliteTable('buildings', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  condition: text('condition').notNull().default('good'),
  ownerId: text('owner_id'),
  interiorSeed: text('interior_seed'),
})

export const dungeonGates = sqliteTable('dungeon_gates', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  overflowLevel: real('overflow_level').notNull().default(0),
  gateType: text('gate_type').notNull().default('natural'),
  cleared: integer('cleared', { mode: 'boolean' }).notNull().default(false),
})

export const dungeonRooms = sqliteTable('dungeon_rooms', {
  id: text('id').primaryKey(),
  gateId: text('gate_id').notNull().references(() => dungeonGates.id),
  depth: integer('depth').notNull(),
  roomType: text('room_type').notNull(),
  encounterJson: text('encounter_json'),
  trapJson: text('trap_json'),
  puzzleJson: text('puzzle_json'),
  lootJson: text('loot_json'),
  cleared: integer('cleared', { mode: 'boolean' }).notNull().default(false),
})

// ============================================================
// L2 — ECONOMY
// ============================================================

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  outputId: text('output_id').notNull().references(() => commodityCatalog.id),
  inputsJson: text('inputs_json').notNull(),
  qualityDC: integer('quality_dc').notNull().default(10),
  toolRequirements: text('tool_requirements'),
  baseSlotsPerBatch: integer('base_slots_per_batch').notNull().default(1),
})

export const inventories = sqliteTable('inventories', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  ownerType: text('owner_type').notNull(),  // character, npc, party, settlement, building, caravan
  locationNodeId: text('location_node_id').notNull(),
})

export const containers = sqliteTable('containers', {
  id: text('id').primaryKey(),
  inventoryId: text('inventory_id').notNull().references(() => inventories.id),
  name: text('name').notNull(),
  type: text('type').notNull(),  // 22 container types
  weightCapacity: real('weight_capacity').notNull(),
  volumeCapacity: real('volume_capacity').notNull(),
  spatialMagic: text('spatial_magic').notNull().default('none'),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  lockDC: integer('lock_dc').notNull().default(0),
  currencyJson: text('currency_json'),
})

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  containerId: text('container_id').notNull().references(() => containers.id),
  name: text('name').notNull(),
  category: text('category').notNull(),  // 20 categories
  rarity: text('rarity').notNull().default('common'),
  weight: real('weight').notNull(),
  volume: real('volume').notNull(),
  valueGP: real('value_gp').notNull().default(0),
  stackable: integer('stackable', { mode: 'boolean' }).notNull().default(false),
  quantity: integer('quantity').notNull().default(1),
  magical: integer('magical', { mode: 'boolean' }).notNull().default(false),
  requiresAttunement: integer('requires_attunement', { mode: 'boolean' }).notNull().default(false),
  sourceType: text('source_type').notNull().default('crafted'),
  propertiesJson: text('properties_json'),
})

export const weaponStats = sqliteTable('weapon_stats', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id),
  damageDice: text('damage_dice').notNull(),       // e.g. '1d8', '2d6'
  damageType: text('damage_type').notNull(),        // slashing, piercing, bludgeoning, etc.
  weaponType: text('weapon_type').notNull(),         // simple, martial
  propertiesJson: text('properties_json'),           // finesse, heavy, light, reach, thrown, etc.
  rangeNormal: integer('range_normal'),
  rangeLong: integer('range_long'),
})

export const armorStats = sqliteTable('armor_stats', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id),
  acBonus: integer('ac_bonus').notNull(),
  armorType: text('armor_type').notNull(),           // light, medium, heavy, shield
  stealthDisadvantage: integer('stealth_disadvantage', { mode: 'boolean' }).notNull().default(false),
  strengthRequirement: integer('strength_requirement'),
  donTimeMinutes: integer('don_time_minutes'),
  doffTimeMinutes: integer('doff_time_minutes'),
})

export const itemEnchantments = sqliteTable('item_enchantments', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id),
  enchantmentBonus: integer('enchantment_bonus').notNull().default(0),
  effectDescription: text('effect_description'),
  chargesMax: integer('charges_max'),
  chargesCurrent: integer('charges_current'),
  rechargeCondition: text('recharge_condition'),
  cursed: integer('cursed', { mode: 'boolean' }).notNull().default(false),
  curseDescription: text('curse_description'),
})

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  inventoryId: text('inventory_id').notNull().references(() => inventories.id),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  specialization: text('specialization'),
  reputation: real('reputation').notNull().default(50),
  capital: real('capital').notNull().default(100),
})

export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  prestige: real('prestige').notNull().default(0),
})

export const commodityPrices = sqliteTable('commodity_prices', {
  id: text('id').primaryKey(),
  commodityId: text('commodity_id').notNull().references(() => commodityCatalog.id),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  price: real('price').notNull(),
  supply: real('supply').notNull(),
  demand: real('demand').notNull(),
})

export const serviceProviders = sqliteTable('service_providers', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  type: text('type').notNull(),  // bank, PMC, legal, courier, info, healing, magical
  name: text('name').notNull(),
  tier: text('tier').notNull().default('basic'),
})

export const serviceContracts = sqliteTable('service_contracts', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => serviceProviders.id),
  clientId: text('client_id').notNull(),
  status: text('status').notNull().default('active'),
  riskLevel: text('risk_level').notNull().default('routine'),
  slotsEstimated: integer('slots_estimated').notNull().default(4),
  slotsConsumed: integer('slots_consumed').notNull().default(0),
  createdDay: integer('created_day').notNull(),
})

export const caravans = sqliteTable('caravans', {
  id: text('id').primaryKey(),
  edgeId: text('edge_id').notNull().references(() => worldEdges.id),
  inventoryId: text('inventory_id').notNull().references(() => inventories.id),
  transportType: text('transport_type').notNull(),
  mile: real('mile').notNull().default(0),
  status: text('status').notNull().default('en_route'),
})

export const bankAccounts = sqliteTable('bank_accounts', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => serviceProviders.id),
  ownerId: text('owner_id').notNull(),
  accountType: text('account_type').notNull(),  // custody, savings, trade
  balance: real('balance').notNull().default(0),
  interestRate: real('interest_rate').notNull().default(0),
})

export const loans = sqliteTable('loans', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => bankAccounts.id),
  principal: real('principal').notNull(),
  interestRate: real('interest_rate').notNull(),
  termWeeks: integer('term_weeks').notNull(),
  collateralType: text('collateral_type'),
  collateralId: text('collateral_id'),
  status: text('status').notNull().default('active'),
})

export const propertyDeeds = sqliteTable('property_deeds', {
  id: text('id').primaryKey(),
  buildingId: text('building_id').references(() => buildings.id),
  nodeId: text('node_id'),
  ownerId: text('owner_id').notNull(),
  deedType: text('deed_type').notNull().default('building'),
})

export const ledgerEntries = sqliteTable('ledger_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => bankAccounts.id),
  entryType: text('entry_type').notNull(),
  amount: real('amount').notNull(),
  worldDay: integer('world_day').notNull(),
  description: text('description'),
})

export const tradingCompanies = sqliteTable('trading_companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  hqId: text('hq_id').notNull().references(() => settlements.id),
  founderId: text('founder_id').notNull(),
  capital: real('capital').notNull().default(0),
  status: text('status').notNull().default('active'),
  bankingCharter: integer('banking_charter', { mode: 'boolean' }).notNull().default(false),
})

export const auctionHouses = sqliteTable('auction_houses', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => tradingCompanies.id),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  name: text('name').notNull(),
})

export const shipments = sqliteTable('shipments', {
  id: text('id').primaryKey(),
  edgeId: text('edge_id').notNull().references(() => worldEdges.id),
  companyId: text('company_id').notNull().references(() => tradingCompanies.id),
  mile: real('mile').notNull().default(0),
  deadline: integer('deadline'),
  cargoManifestJson: text('cargo_manifest_json'),
})

export const commodityRoutes = sqliteTable('commodity_routes', {
  id: text('id').primaryKey(),
  edgeId: text('edge_id').notNull().references(() => worldEdges.id),
  commodityId: text('commodity_id').notNull().references(() => commodityCatalog.id),
  profitMargin: real('profit_margin').notNull(),
  activeCaravans: integer('active_caravans').notNull().default(0),
})

export const currencyExchanges = sqliteTable('currency_exchanges', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  ratesJson: text('rates_json').notNull(),
  spread: real('spread').notNull().default(0.05),
  lastTickDay: integer('last_tick_day'),
})

// ============================================================
// L3 — SOCIAL
// ============================================================

export const factions = sqliteTable('factions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  treasury: real('treasury').notNull().default(0),
  description: text('description'),
})

export const factionRelations = sqliteTable('faction_relations', {
  id: text('id').primaryKey(),
  factionA: text('faction_a').notNull().references(() => factions.id),
  factionB: text('faction_b').notNull().references(() => factions.id),
  stance: text('stance').notNull().default('neutral'),
  trust: real('trust').notNull().default(0),
})

export const socialContracts = sqliteTable('social_contracts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  partyA: text('party_a').notNull(),
  partyB: text('party_b').notNull(),
  status: text('status').notNull().default('active'),
  termsJson: text('terms_json'),
  worldDay: integer('world_day').notNull(),
})

export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  familyName: text('family_name').notNull(),
  headId: text('head_id'),
})

export const kinshipLinks = sqliteTable('kinship_links', {
  id: text('id').primaryKey(),
  householdA: text('household_a').notNull().references(() => households.id),
  householdB: text('household_b').notNull().references(() => households.id),
  kinshipType: text('kinship_type').notNull(),  // parent-child, sibling, marriage
  legitimacy: text('legitimacy').notNull().default('legitimate'),
})

export const titles = sqliteTable('titles', {
  id: text('id').primaryKey(),
  factionId: text('faction_id').notNull().references(() => factions.id),
  rank: text('rank').notNull(),
  holderId: text('holder_id'),
  successionRules: text('succession_rules'),
})

export const jurisdictions = sqliteTable('jurisdictions', {
  id: text('id').primaryKey(),
  titleId: text('title_id').notNull().references(() => titles.id),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  jurisdictionType: text('jurisdiction_type').notNull(),
})

export const guilds = sqliteTable('guilds', {
  id: text('id').primaryKey(),
  factionId: text('faction_id').references(() => factions.id),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  guildType: text('guild_type').notNull(),
  name: text('name').notNull(),
  members: integer('members').notNull().default(0),
  treasury: real('treasury').notNull().default(0),
  intelJson: text('intel_json'),
})

export const knowledgeSeeds = sqliteTable('knowledge_seeds', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull().references(() => guilds.id),
  category: text('category').notNull(),
  activatedDay: integer('activated_day'),
  seedDataJson: text('seed_data_json'),
})

export const craftsmen = sqliteTable('craftsmen', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  guildId: text('guild_id').references(() => guilds.id),
  trade: text('trade').notNull(),
  rank: text('rank').notNull().default('apprentice'),
  npcId: text('npc_id'),
  recipesJson: text('recipes_json'),
})

export const apprenticeships = sqliteTable('apprenticeships', {
  id: text('id').primaryKey(),
  masterId: text('master_id').notNull().references(() => craftsmen.id),
  apprenticeId: text('apprentice_id').notNull().references(() => craftsmen.id),
  progress: real('progress').notNull().default(0),
  startedDay: integer('started_day').notNull(),
})

export const childPool = sqliteTable('child_pool', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  childDataJson: text('child_data_json').notNull(),
  generatedDay: integer('generated_day').notNull(),
})

export const namePools = sqliteTable('name_pools', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  culture: text('culture').notNull(),
  namesJson: text('names_json').notNull(),
})

// ============================================================
// L4 — ECOLOGY + WARFARE
// ============================================================

// -- Monster Catalog (bestiary stat blocks) --

export const monsterCatalog = sqliteTable('monster_catalog', {
  id: text('id').primaryKey(),
  species: text('species').notNull(),
  name: text('name').notNull(),
  cr: real('cr').notNull(),
  type: text('type').notNull(),  // beast, humanoid, undead, fiend, dragon, etc.
  size: text('size').notNull().default('medium'),
  alignment: text('alignment'),
  hpFormula: text('hp_formula').notNull(),  // e.g. '4d10+12'
  hpAverage: integer('hp_average').notNull(),
  ac: integer('ac').notNull(),
  acSource: text('ac_source'),  // 'natural armor', 'chain mail', etc.
  speed: integer('speed').notNull().default(30),
  speedSpecialJson: text('speed_special_json'),  // {fly: 60, swim: 30, burrow: 15}
  abilityScoresJson: text('ability_scores_json').notNull(),  // {str, dex, con, int, wis, cha}
  savesJson: text('saves_json'),  // proficient saves
  skillsJson: text('skills_json'),
  resistancesJson: text('resistances_json'),
  vulnerabilitiesJson: text('vulnerabilities_json'),
  immunitiesJson: text('immunities_json'),
  conditionImmunitiesJson: text('condition_immunities_json'),
  sensesJson: text('senses_json'),  // {darkvision: 60, passive_perception: 14}
  languages: text('languages'),
  actionsJson: text('actions_json'),  // [{name, desc, toHit, damage, damageType}]
  traitJson: text('trait_json'),  // special abilities
  legendaryActionsJson: text('legendary_actions_json'),
  lairActionsJson: text('lair_actions_json'),
  environment: text('environment'),  // forest, underdark, etc.
  xpReward: integer('xp_reward').notNull().default(0),
})

// -- Wildlife (non-combat fauna/flora) --

export const wildlife = sqliteTable('wildlife', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  species: text('species').notNull(),
  catalogId: text('catalog_id').references(() => monsterCatalog.id),  // optional — links to bestiary if tameable/huntable
  population: integer('population').notNull(),
  breedingSeason: text('breeding_season'),
  migratory: integer('migratory', { mode: 'boolean' }).notNull().default(false),
  tameable: integer('tameable', { mode: 'boolean' }).notNull().default(false),
  harvestableJson: text('harvestable_json'),  // {leather: 2, meat: 5, horn: 1}
})

// -- Natural Entities Catalog (field guide — front-end facing) --

/**
 * Every plant, animal, fungus, mineral in the world.
 * Detailed reference table for world-building and player interaction.
 * Region mapping is in region_ecology below.
 */
export const naturalEntities = sqliteTable('natural_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Classification
  kingdom: text('kingdom').notNull(),  // fauna, flora, fungi, mineral, ooze
  category: text('category').notNull(),  // tree, shrub, herb, grass, flower, vine, moss, fern | mammal, bird, reptile, amphibian, fish, insect, arachnid | mushroom, mold, lichen | ore, gem, crystal
  subcategory: text('subcategory'),  // deciduous, conifer, flowering | predator, prey, scavenger, herbivore | edible, toxic, magical
  species: text('species'),  // specific species name
  // Description (for frontend display)
  description: text('description').notNull(),
  appearance: text('appearance'),  // what it looks like
  size: text('size').notNull().default('small'),  // tiny, small, medium, large, huge
  // Properties
  rarity: text('rarity').notNull().default('common'),  // common, uncommon, rare, very_rare, legendary
  magical: integer('magical', { mode: 'boolean' }).notNull().default(false),
  sentient: integer('sentient', { mode: 'boolean' }).notNull().default(false),
  dangerous: integer('dangerous', { mode: 'boolean' }).notNull().default(false),
  dangerLevel: text('danger_level'),  // harmless, mild, moderate, deadly
  // Uses
  edible: integer('edible', { mode: 'boolean' }).notNull().default(false),
  medicinal: integer('medicinal', { mode: 'boolean' }).notNull().default(false),
  alchemical: integer('alchemical', { mode: 'boolean' }).notNull().default(false),
  craftMaterial: integer('craft_material', { mode: 'boolean' }).notNull().default(false),
  // Detail JSON
  usesJson: text('uses_json'),  // [{use: 'potion_ingredient', component: 'root', value: 5}]
  alchemyJson: text('alchemy_json'),  // {effects: ['healing', 'poison_resistance'], dc: 15}
  craftingJson: text('crafting_json'),  // {material: 'ironwood', hardness: 8, components: [{part: 'bark', yield: 3}]}
  // Ecology
  habitat: text('habitat'),  // forest, grassland, mountain, desert, swamp, coast, underdark, arctic, tropical
  dietType: text('diet_type'),  // herbivore, carnivore, omnivore, photosynthetic, parasitic, decomposer
  lifespan: text('lifespan'),  // days, months, years, decades, centuries
  // Linked bestiary entry (for animals that can fight)
  monsterCatalogId: text('monster_catalog_id').references(() => monsterCatalog.id),
})

/**
 * Region ↔ Entity mapping — what grows/lives where.
 * One entity can appear in many regions with different abundance.
 * Drives: foraging, hunting, alchemy ingredients, lumber, mining.
 */
export const regionEcology = sqliteTable('region_ecology', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  entityId: text('entity_id').notNull().references(() => naturalEntities.id),
  // Abundance
  abundance: text('abundance').notNull().default('moderate'),  // extinct, rare, scarce, moderate, abundant, dominant
  population: integer('population'),  // null = uncountable (e.g. grass)
  // Seasonality
  seasonalAvailability: text('seasonal_availability').notNull().default('year_round'),  // year_round, spring, summer, autumn, winter, wet_season, dry_season
  peakSeason: text('peak_season'),
  dormantSeason: text('dormant_season'),
  // Environment within region
  biomePreference: text('biome_preference'),  // riverbank, hilltop, cave_entrance, deep_forest, field_edge, cliff_face
  altitudeRange: text('altitude_range'),  // lowland, midland, highland, alpine
  // Harvestability
  forageDC: integer('forage_dc'),  // survival check DC to find/harvest
  harvestYield: text('harvest_yield'),  // '1d4 roots', '2d6 berries', '1 pelt'
  harvestToolRequired: text('harvest_tool_required'),  // herbalism_kit, pickaxe, skinning_knife, none
  // Local flavor
  localName: text('local_name'),  // what locals call it in this region
  notes: text('notes'),  // 'grows only near the Misty Forest elven ruins'
})

// -- Geological Entities Catalog (terrain + mineral field guide) --

/**
 * Every rock, stone, ore, mineral, soil, terrain formation in the world.
 * Detailed reference for procedural rendering and resource extraction.
 */
export const geologicalEntities = sqliteTable('geological_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Classification
  geoType: text('geo_type').notNull(),  // ore, gem, crystal, stone, rock, soil, sand, clay, terrain_formation, water_feature
  category: text('category').notNull(),  // igneous, sedimentary, metamorphic | precious_metal, base_metal, alloy_component | precious_gem, semi_precious, arcane_crystal | loam, peat, volcanic_ash | mound, cliff, cave, ravine, sinkhole, geyser, hot_spring, waterfall, rapids, tide_pool
  subcategory: text('subcategory'),  // granite, basalt, marble, slate, limestone, sandstone | iron, copper, tin, silver, gold, mithral, adamantine | diamond, ruby, emerald, sapphire, moonstone
  // Description (for frontend display)
  description: text('description').notNull(),
  // Visual properties (for rendering)
  colorPrimary: text('color_primary').notNull(),  // hex or named: '#8B7355', 'rust_red', 'obsidian_black'
  colorSecondary: text('color_secondary'),  // veins, streaks, highlights
  colorVariance: text('color_variance'),  // low, medium, high — how much color varies per instance
  texture: text('texture').notNull(),  // smooth, rough, jagged, crystalline, porous, layered, granular, glassy, fibrous, crumbly
  luster: text('luster'),  // metallic, vitreous, waxy, pearly, silky, dull, earite, adamantine, resinous
  opacity: text('opacity'),  // opaque, translucent, transparent
  pattern: text('pattern'),  // solid, veined, banded, spotted, swirled, fractured, layered, dendritic
  weathering: text('weathering'),  // how it looks when aged: 'moss-covered', 'wind-eroded', 'water-polished', 'cracked'
  // Physical properties
  hardness: real('hardness'),  // Mohs scale 1-10 (talc=1, diamond=10, adamantine=11)
  density: text('density'),  // light, medium, heavy, very_heavy
  brittleness: text('brittleness'),  // brittle, moderate, tough, malleable
  magnetism: integer('magnetism', { mode: 'boolean' }).notNull().default(false),
  // Size/scale (for terrain formations)
  typicalScale: text('typical_scale'),  // pebble, boulder, outcrop, cliff_face, mountain_feature, cavern_system
  heightRange: text('height_range'),  // '1-3m', '10-100m', 'varies'
  // Usage
  rarity: text('rarity').notNull().default('common'),  // common, uncommon, rare, very_rare, legendary
  magical: integer('magical', { mode: 'boolean' }).notNull().default(false),
  magicProperties: text('magic_properties'),  // 'absorbs necromantic energy', 'resonates with divination'
  smeltable: integer('smeltable', { mode: 'boolean' }).notNull().default(false),
  smeltProduct: text('smelt_product'),  // 'iron_ingot', 'gold_bar', 'mithral_ingot'
  smeltRatio: text('smelt_ratio'),  // '5:1' (5 ore → 1 ingot)
  carvable: integer('carvable', { mode: 'boolean' }).notNull().default(false),
  buildingMaterial: integer('building_material', { mode: 'boolean' }).notNull().default(false),
  gemCuttable: integer('gem_cuttable', { mode: 'boolean' }).notNull().default(false),
  // Value
  baseValueGp: real('base_value_gp'),  // per unit (pound, stone, gem)
  valueUnit: text('value_unit'),  // per_pound, per_stone, per_gem, per_ingot
  // Crafting
  craftingJson: text('crafting_json'),  // {uses: ['weapon_material', 'armor_material', 'jewelry', 'construction'], quality: 'fine'}
})

/**
 * Region ↔ Geology mapping — what's in the ground where.
 * Drives: mining, quarrying, prospecting, terrain rendering.
 */
export const regionGeology = sqliteTable('region_geology', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  entityId: text('entity_id').notNull().references(() => geologicalEntities.id),
  // Deposit info
  depositType: text('deposit_type').notNull(),  // vein, seam, placer, outcrop, scattered, bedrock, surface, deep, geode_cluster
  depositSize: text('deposit_size').notNull().default('moderate'),  // trace, small, moderate, large, massive, inexhaustible
  depth: text('depth').notNull().default('surface'),  // surface, shallow, moderate, deep, very_deep
  // Accessibility
  accessibility: text('accessibility').notNull().default('accessible'),  // exposed, accessible, hidden, buried, submerged, warded
  discoveryDC: integer('discovery_dc'),  // perception/investigation DC to find
  extractionDC: integer('extraction_dc'),  // mining/quarrying skill DC
  extractionTool: text('extraction_tool'),  // pickaxe, hammer_chisel, pan, drill, magic
  extractionTime: text('extraction_time'),  // '1 hour', '1 day', '1 week'
  yieldPerExtraction: text('yield_per_extraction'),  // '1d6 pounds', '2d4 gems', '1 block'
  // Visual prominence (for rendering)
  surfaceVisible: integer('surface_visible', { mode: 'boolean' }).notNull().default(false),  // can you see it walking by?
  visualProminence: text('visual_prominence'),  // hidden, subtle, noticeable, landmark, dominant
  landscapeEffect: text('landscape_effect'),  // how it shapes the terrain: 'rocky_outcrops', 'crystal_caves', 'iron_stained_soil', 'white_cliffs', 'obsidian_flows'
  // State
  depleted: integer('depleted', { mode: 'boolean' }).notNull().default(false),
  remainingEstimate: text('remaining_estimate'),  // 'abundant', '~500 tons', 'nearly_exhausted'
  // Notes
  localName: text('local_name'),  // 'The Silvervein', 'Ironteeth Ridge'
  notes: text('notes'),  // 'Guarded by a young red dragon', 'Sacred to the dwarves of Citadel Adbar'
})

// -- World Chunks + Delta System (sparse world mutations) --

/**
 * Spatial chunks within regions — subdivide the infinite world.
 * A chunk is the minimum render/interaction scope.
 * Base state is procedural (from ecology + geology tables).
 * Only store what CHANGED via world_deltas below.
 */
export const worldChunks = sqliteTable('world_chunks', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  edgeId: text('edge_id').references(() => worldEdges.id),  // if chunk is along an edge
  // Coordinates (chunk grid within the region)
  chunkX: integer('chunk_x').notNull(),
  chunkY: integer('chunk_y').notNull(),
  // Deterministic procgen seed (CRITICAL — same seed = same trees in same places for all players)
  procgenSeed: integer('procgen_seed').notNull(),  // hash of regionId+chunkX+chunkY
  // Terrain noise parameters (for heightmap generation)
  noiseOctaves: integer('noise_octaves').notNull().default(4),
  noiseAmplitude: real('noise_amplitude').notNull().default(1.0),
  noiseFrequency: real('noise_frequency').notNull().default(0.02),
  noiseLacunarity: real('noise_lacunarity').notNull().default(2.0),
  // Biome (inherited from region but can vary per chunk)
  biome: text('biome').notNull(),  // forest, grassland, mountain, desert, swamp, coast, tundra, jungle, hills, plains
  elevation: real('elevation').notNull().default(0),  // relative elevation
  elevationVariance: real('elevation_variance').notNull().default(0.1),  // how hilly within chunk
  // Water
  hasWater: integer('has_water', { mode: 'boolean' }).notNull().default(false),
  waterCoverage: real('water_coverage'),  // 0.0-1.0 fraction of chunk with water
  // State
  hasDelta: integer('has_delta', { mode: 'boolean' }).notNull().default(false),  // fast check: any mutations here?
  deltaCount: integer('delta_count').notNull().default(0),
})

/**
 * World deltas — sparse event log of world mutations.
 * The world is procedurally infinite. We only log what CHANGED.
 * tree cut = delta: {type: 'remove', entity: 'oak_tree', result: 'oak_logs'}
 * Rendering: generate base state from ecology/geology → apply deltas → current state.
 */
export const worldDeltas = sqliteTable('world_deltas', {
  id: text('id').primaryKey(),
  chunkId: text('chunk_id').notNull().references(() => worldChunks.id),
  // Position within chunk (fine-grained coordinates)
  localX: real('local_x').notNull(),
  localY: real('local_y').notNull(),
  localZ: real('local_z'),  // height/depth if relevant
  // What happened
  deltaType: text('delta_type').notNull(),  // remove, transform, place, damage, grow, decay, burn, flood, excavate, build
  // Source entity (what was there before)
  sourceEntityType: text('source_entity_type'),  // natural_entity, geological_entity, structure, none
  sourceEntityId: text('source_entity_id'),  // FK to the entity that was affected
  sourceDescription: text('source_description'),  // 'mature oak tree', 'iron ore vein'
  // Result entity (what it became)
  resultEntityType: text('result_entity_type'),  // item, natural_entity, geological_entity, debris, none
  resultEntityId: text('result_entity_id'),
  resultDescription: text('result_description'),  // 'oak logs (3)', 'tree stump', 'charred remains'
  resultQuantity: integer('result_quantity'),
  // State flags
  persistent: integer('persistent', { mode: 'boolean' }).notNull().default(true),  // does it stay forever or regenerate?
  regenerateAfterTicks: integer('regenerate_after_ticks'),  // null = permanent, 30 = regrows in 30 ticks
  // Causality
  causedById: text('caused_by_id'),  // player/party/npc who did it
  causedByType: text('caused_by_type'),  // player, party, npc, monster, weather, tick, natural
  causeAction: text('cause_action'),  // chop, mine, burn, build, forage, dig, demolish
  // Temporal
  tick: integer('tick').notNull(),  // server tick when this happened
  worldDay: integer('world_day').notNull(),
})

/**
 * Party positions — precise geographic tracking.
 * Which chunk, where within it.
 */
export const partyPositions = sqliteTable('party_positions', {
  id: text('id').primaryKey(),
  partyId: text('party_id').notNull().references(() => parties.id),
  // Where in the world
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  chunkId: text('chunk_id').references(() => worldChunks.id),
  edgeId: text('edge_id').references(() => worldEdges.id),  // if traveling on edge
  settlementId: text('settlement_id').references(() => settlements.id),
  hubNodeId: text('hub_node_id'),  // if inside a settlement
  dungeonRoomId: text('dungeon_room_id'),  // if in a dungeon
  // Fine-grained position within chunk
  localX: real('local_x').notNull().default(0),
  localY: real('local_y').notNull().default(0),
  // State
  positionType: text('position_type').notNull(),  // overworld, settlement, dungeon, edge_travel, hub
  lastUpdatedTick: integer('last_updated_tick').notNull(),
})

// -- Water Bodies --

/**
 * Rivers, lakes, seas, springs, wells, aqueducts.
 * Can span multiple regions/chunks. Visual properties for rendering.
 */
export const waterBodies = sqliteTable('water_bodies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),  // 'River Delimbiyr', 'Mere of Dead Men', 'Sword Coast'
  waterType: text('water_type').notNull(),  // river, lake, sea, ocean, pond, spring, well, waterfall, swamp_water, underground_river, aqueduct
  // Visual
  colorWater: text('color_water').notNull().default('#2E5B88'),  // hex — clear blue, dark green, murky brown, glacial teal
  clarity: text('clarity').notNull().default('clear'),  // crystal, clear, murky, opaque, bioluminescent
  flowSpeed: text('flow_speed'),  // still, gentle, moderate, rapid, torrential
  flowDirection: text('flow_direction'),  // N, NE, E, SE, S, SW, W, NW
  surfaceEffect: text('surface_effect'),  // calm, rippled, choppy, misty, frozen, steaming
  // Properties
  depth: text('depth'),  // shallow, wading, swimming, deep, abyssal
  salinity: text('salinity').notNull().default('fresh'),  // fresh, brackish, salt
  temperature: text('temperature'),  // frigid, cold, cool, temperate, warm, hot, boiling
  drinkable: integer('drinkable', { mode: 'boolean' }).notNull().default(true),
  magical: integer('magical', { mode: 'boolean' }).notNull().default(false),
  magicEffect: text('magic_effect'),  // 'heals 1d4', 'reveals hidden', 'curses drinker'
  // Fish/resources
  fishable: integer('fishable', { mode: 'boolean' }).notNull().default(false),
  fishSpeciesJson: text('fish_species_json'),  // ['trout', 'salmon', 'pike']
  // Regions this water body touches
  regionsJson: text('regions_json'),  // list of region IDs this flows through
})

// -- World Discoveries (firsts — the living wiki) --

/**
 * When something is discovered for the first time in the world,
 * it gets logged HERE. One entry per discovery, forever.
 * If a player made it — they're a legend, enshrined.
 * This IS the world wiki. Drives: recipe book, skill tree, industry list, bestiary unlocks.
 */
export const worldDiscoveries = sqliteTable('world_discoveries', {
  id: text('id').primaryKey(),
  // What was discovered
  discoveryType: text('discovery_type').notNull(),  // recipe, skill, industry, species, location, material, spell, technique, trade_route, disease_cure, artifact
  name: text('name').notNull(),  // 'Elven Ironbark Bow', 'Silversmithing', 'Moonpetal Salve'
  description: text('description').notNull(),
  category: text('category'),  // alchemy, smithing, cooking, herbalism, mining, carpentry, enchanting, cartography, medicine, agriculture
  // The discoverer — ENSHRINED
  discoveredByType: text('discovered_by_type').notNull(),  // player, npc, party, system
  discoveredById: text('discovered_by_id'),  // FK to player/character/npc
  discoveredByName: text('discovered_by_name').notNull(),  // 'Kaelen Stormwright' — immortalized
  // Where and when
  discoveredAtRegionId: text('discovered_at_region_id').references(() => worldRegions.id),
  discoveredAtSettlement: text('discovered_at_settlement'),
  discoveredAtTick: integer('discovered_at_tick').notNull(),
  discoveredAtWorldDay: integer('discovered_at_world_day').notNull(),
  // The discovery data
  dataJson: text('data_json').notNull(),  // recipe ingredients, skill requirements, industry inputs/outputs — the actual discovery content
  prerequisitesJson: text('prerequisites_json'),  // what you need to know/have before this becomes available
  // Wiki
  lore: text('lore'),  // flavor text, story of the discovery
  wikiVisible: integer('wiki_visible', { mode: 'boolean' }).notNull().default(true),  // shown in world wiki
  // Replication
  replicable: integer('replicable', { mode: 'boolean' }).notNull().default(true),  // can others learn this?
  replicationRequirements: text('replication_requirements'),  // 'Must visit discoverer or find written instructions'
})

// -- Monster Actors (live instances with full state) --

export const monsterActors = sqliteTable('monster_actors', {
  id: text('id').primaryKey(),
  catalogId: text('catalog_id').notNull().references(() => monsterCatalog.id),
  speciesId: text('species_id').notNull(),
  // Leader
  leaderId: text('leader_id').notNull(),
  leaderName: text('leader_name').notNull(),
  leaderCR: real('leader_cr').notNull(),
  // Camp location (polymorphic)
  campNodeId: text('camp_node_id').notNull(),  // settlement, POI, hub_node, etc.
  campEdgeId: text('camp_edge_id'),
  campMileMarker: real('camp_mile_marker'),
  // Population
  population: integer('population').notNull(),
  carryingCapacity: integer('carrying_capacity').notNull(),
  troops: integer('troops').notNull(),
  // Economy
  foodSecurity: real('food_security').notNull().default(0.7),
  gold: real('gold').notNull().default(0),
  // Monthly tick state
  lastAdvancementGrade: text('last_advancement_grade').notNull().default('partial'),
  lastAction: text('last_action').notNull().default('fortify_camp'),
  monthsEstablished: integer('months_established').notNull().default(0),
  tenure: integer('tenure').notNull().default(0),
  // Spawner link
  gateId: text('gate_id').references(() => dungeonGates.id),
  // Territory
  claimedEdgeSegmentsJson: text('claimed_edge_segments_json'),
  dangerRadius: real('danger_radius').notNull().default(1),
  // History
  challengesSurvived: integer('challenges_survived').notNull().default(0),
  raidsConducted: integer('raids_conducted').notNull().default(0),
  settlementsRaidedJson: text('settlements_raided_json'),
  // Director adaptations
  adaptationsJson: text('adaptations_json'),
})

export const herds = sqliteTable('herds', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  species: text('species').notNull(),
  count: integer('count').notNull(),
  breedingRate: real('breeding_rate').notNull().default(0.1),
  yieldJson: text('yield_json'),
})

export const weatherState = sqliteTable('weather_state', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  climate: text('climate').notNull(),
  season: text('season').notNull(),
  temperature: real('temperature').notNull(),
  severity: real('severity').notNull().default(0),
  modifiersJson: text('modifiers_json'),
})

// -- Magic --

export const magicConfig = sqliteTable('magic_config', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  magicLevel: text('magic_level').notNull(),  // dead, low, normal, high, wild
  source: text('source'),
  schoolModifiersJson: text('school_modifiers_json'),
})

export const spells = sqliteTable('spells', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  school: text('school').notNull(),
  level: integer('level').notNull(),
  range: text('range').notNull(),
  componentsJson: text('components_json'),
  duration: text('duration'),
  description: text('description'),
  ritual: integer('ritual', { mode: 'boolean' }).notNull().default(false),
  concentration: integer('concentration', { mode: 'boolean' }).notNull().default(false),
  // Per `project_cert_hierarchy.md` chargen carryover (2026-04-30):
  // The spells table doubles as the canonical global namespace — first
  // creator of a unique prime composition gets to name it; subsequent
  // creations of the same composition link to the existing row.
  /** BigInt prime composition stringified — unique constraint = one row per composition. */
  compositionSeed: text('composition_seed').unique(),
  /** The character cert that first composed this spell (the "creator"). */
  creatorCertId: text('creator_cert_id'),
  /** Original element list passed to composeSpell — for replay / re-derivation. */
  elementsJson: text('elements_json'),
})

export const spellElements = sqliteTable('spell_elements', {
  id: text('id').primaryKey(),
  spellId: text('spell_id').notNull().references(() => spells.id),
  damageType: text('damage_type'),
  damageDice: text('damage_dice'),
  saveType: text('save_type'),
  scalingJson: text('scaling_json'),
})

// -- Religion --

export const deities = sqliteTable('deities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  alignment: text('alignment').notNull(),
  status: text('status').notNull().default('active'),
  domainsJson: text('domains_json'),
  portfolio: text('portfolio'),
  holySymbol: text('holy_symbol'),
})

export const pantheons = sqliteTable('pantheons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  regionId: text('region_id').references(() => worldRegions.id),
  dominantId: text('dominant_id').references(() => deities.id),
  memberDeityIds: text('member_deity_ids'),  // JSON array
})

export const temples = sqliteTable('temples', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  deityId: text('deity_id').notNull().references(() => deities.id),
  size: text('size').notNull(),  // shrine, chapel, temple, cathedral, grand_cathedral
  clergyCount: integer('clergy_count').notNull().default(1),
  faithOutput: real('faith_output').notNull().default(1),
})

export const clergy = sqliteTable('clergy', {
  id: text('id').primaryKey(),
  templeId: text('temple_id').notNull().references(() => temples.id),
  npcId: text('npc_id'),
  rank: text('rank').notNull(),     // acolyte, priest, bishop, archbishop, pontiff
  deityId: text('deity_id').notNull().references(() => deities.id),
  healingAbility: integer('healing_ability').notNull().default(0),
})

export const divineInterventions = sqliteTable('divine_interventions', {
  id: text('id').primaryKey(),
  deityId: text('deity_id').notNull().references(() => deities.id),
  sessionId: text('session_id'),
  type: text('type').notNull(),
  trigger: text('trigger'),
  magnitude: real('magnitude').notNull(),
  worldDay: integer('world_day').notNull(),
})

// -- Warfare --

export const armies = sqliteTable('armies', {
  id: text('id').primaryKey(),
  factionId: text('faction_id').notNull().references(() => factions.id),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  morale: real('morale').notNull().default(50),
  supplies: real('supplies').notNull().default(100),
  readiness: real('readiness').notNull().default(50),
  regionId: text('region_id').references(() => worldRegions.id),
})

export const armyUnits = sqliteTable('army_units', {
  id: text('id').primaryKey(),
  armyId: text('army_id').notNull().references(() => armies.id),
  unitType: text('unit_type').notNull(),
  count: integer('count').notNull(),
  veterancy: text('veterancy').notNull().default('green'),
  equipmentTier: integer('equipment_tier').notNull().default(1),
  commanderId: text('commander_id'),
})

export const siegeWeapons = sqliteTable('siege_weapons', {
  id: text('id').primaryKey(),
  armyId: text('army_id').notNull().references(() => armies.id),
  type: text('type').notNull(),
  condition: real('condition').notNull().default(100),
  crewRequired: integer('crew_required').notNull(),
})

export const spyAgents = sqliteTable('spy_agents', {
  id: text('id').primaryKey(),
  factionId: text('faction_id').notNull().references(() => factions.id),
  npcId: text('npc_id'),
  coverIdentity: text('cover_identity'),
  coverSettlementId: text('cover_settlement_id').references(() => settlements.id),
  skillMod: integer('skill_mod').notNull().default(0),
  detected: integer('detected', { mode: 'boolean' }).notNull().default(false),
  missionsCompleted: integer('missions_completed').notNull().default(0),
})

export const spyMissions = sqliteTable('spy_missions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => spyAgents.id),
  missionType: text('mission_type').notNull(),
  targetId: text('target_id'),
  status: text('status').notNull().default('active'),
  intelGathered: text('intel_gathered'),
  worldDay: integer('world_day').notNull(),
})

export const diplomaticRelations = sqliteTable('diplomatic_relations', {
  id: text('id').primaryKey(),
  factionA: text('faction_a').notNull().references(() => factions.id),
  factionB: text('faction_b').notNull().references(() => factions.id),
  status: text('status').notNull().default('neutral'),
  standing: real('standing').notNull().default(0),
  treatiesJson: text('treaties_json'),
  lastChangedDay: integer('last_changed_day'),
})

export const regionInfluence = sqliteTable('region_influence', {
  id: text('id').primaryKey(),
  factionId: text('faction_id').notNull().references(() => factions.id),
  regionId: text('region_id').notNull().references(() => worldRegions.id),
  influence: real('influence').notNull().default(0),
  contested: integer('contested', { mode: 'boolean' }).notNull().default(false),
})

// ============================================================
// L5 — CHARACTERS + SKILLS
// ============================================================

// -- Players (user → character bridge) --

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  adventureId: text('adventure_id'),  // which adventure they're playing in
  activateCharacterId: text('active_character_id'),  // currently controlled character
  isDM: integer('is_dm', { mode: 'boolean' }).notNull().default(false),
})

// -- Character Transfers (cert-signed ownership transfer) --

/**
 * Character transfers between players.
 * Both parties sign with topology-auth trajectory = cryptographic receipt.
 * Flow: sender initiates → receiver accepts (both prove identity) → ownership changes.
 */
export const characterTransfers = sqliteTable('character_transfers', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull(),  // no FK — character may change hands
  // Parties
  fromPlayerId: text('from_player_id').notNull().references(() => players.id),
  toPlayerId: text('to_player_id').notNull().references(() => players.id),
  // Sender signature (trajectory proof)
  senderChallengeN: integer('sender_challenge_n').notNull(),
  senderTrajectory: text('sender_trajectory').notNull(),
  // Receiver signature (trajectory proof — filled on accept)
  receiverChallengeN: integer('receiver_challenge_n'),
  receiverTrajectory: text('receiver_trajectory'),
  // Status
  status: text('status').notNull().default('pending'),  // pending, accepted, completed, rejected, cancelled
  initiatedAt: text('initiated_at').notNull(),
  completedAt: text('completed_at'),
  // World state at transfer
  worldDay: integer('world_day').notNull(),
})

// -- Character Sheet (full D&D 5e from CharacterDataSchema) --

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  playerId: text('player_id').references(() => players.id),  // human owner (null = NPC-generated)
  name: text('name').notNull(),
  race: text('race').notNull(),
  subrace: text('subrace'),
  size: text('size').notNull().default('medium'),  // tiny, small, medium, large, huge, gargantuan — hex occupancy
  reach: integer('reach').notNull().default(5),  // feet — determines attack range in tiles
  background: text('background'),
  // HP state
  hpCurrent: integer('hp_current').notNull(),
  hpMax: integer('hp_max').notNull(),
  tempHp: integer('temp_hp').notNull().default(0),
  hitDiceUsed: integer('hit_dice_used').notNull().default(0),
  // AC components
  baseAC: integer('base_ac').notNull().default(10),
  armorType: text('armor_type').notNull().default('none'),  // none, light, medium, heavy
  shieldEquipped: integer('shield_equipped', { mode: 'boolean' }).notNull().default(false),
  acBonusesJson: text('ac_bonuses_json'),  // [{source, value}]
  // Combat
  speed: integer('speed').notNull().default(30),
  damageType: text('damage_type').notNull().default('slashing'),
  resistancesJson: text('resistances_json'),
  vulnerabilitiesJson: text('vulnerabilities_json'),
  immunitiesJson: text('immunities_json'),
  // Status
  status: text('status').notNull().default('active'),  // active, unconscious, dead, petrified
  conditionsJson: text('conditions_json'),  // ['poisoned','exhaustion_2','blinded']
  deathSaveSuccesses: integer('death_save_successes').notNull().default(0),
  deathSaveFailures: integer('death_save_failures').notNull().default(0),
  // Progression
  xp: integer('xp').notNull().default(0),
  // Spellcasting
  spellcastingAbility: text('spellcasting_ability'),  // strength, dexterity, etc.
  // Location (polymorphic — node in ANY manifold)
  locationType: text('location_type').notNull().default('settlement'),  // settlement, building, dungeon_room, edge, hub_node, poi
  locationId: text('location_id').notNull(),
})

// -- Multiclass support --

export const characterClasses = sqliteTable('character_classes', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  className: text('class_name').notNull(),
  level: integer('level').notNull().default(1),
  subclass: text('subclass'),
  hitDie: text('hit_die').notNull(),  // d6, d8, d10, d12
  isStartingClass: integer('is_starting_class', { mode: 'boolean' }).notNull().default(false),
})

export const characterAbilities = sqliteTable('character_abilities', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  ability: text('ability').notNull(),  // strength, dexterity, constitution, intelligence, wisdom, charisma
  score: integer('score').notNull(),
})

export const characterSkills = sqliteTable('character_skills', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  skill: text('skill').notNull(),  // 18 skills
  proficiency: text('proficiency').notNull().default('none'),  // none, half, proficient, expertise
})

export const characterSaves = sqliteTable('character_saves', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  ability: text('ability').notNull(),  // saving throw proficiency
})

export const characterFeats = sqliteTable('character_feats', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  featName: text('feat_name').notNull(),
  source: text('source'),
  description: text('description'),
})

export const characterProficiencies = sqliteTable('character_proficiencies', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  category: text('category').notNull(),  // armor, weapon, tool, language, vehicle
  name: text('name').notNull(),
})

// -- Persistent Conditions (survive across combat) --

export const characterConditions = sqliteTable('character_conditions', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  condition: text('condition').notNull(),  // poisoned, exhaustion, blinded, charmed, cursed, diseased, etc.
  severity: integer('severity').notNull().default(1),  // e.g. exhaustion 1-6
  source: text('source'),  // what caused it
  durationType: text('duration_type').notNull().default('indefinite'),  // rounds, hours, days, indefinite, until_rest
  durationRemaining: integer('duration_remaining'),
  appliedDay: integer('applied_day').notNull(),
})

// -- Equipment --

export const characterEquipment = sqliteTable('character_equipment', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  bodySlot: text('body_slot').notNull(),  // 14 slots: head, face, neck, shoulders, chest, arms, hands, ring_left, ring_right, waist, legs, feet, main_hand, off_hand
  itemId: text('item_id').notNull().references(() => items.id),
})

export const characterCarried = sqliteTable('character_carried', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  containerId: text('container_id').notNull().references(() => containers.id),
  carryType: text('carry_type').notNull(),  // on_person, bag
})

export const characterAttunements = sqliteTable('character_attunements', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  itemId: text('item_id').notNull().references(() => items.id),
  slotIndex: integer('slot_index').notNull(),  // 0, 1, 2
  attunedDay: integer('attuned_day').notNull(),
})

/**
 * Per-character material mastery — what this character knows about a
 * given resource (commodity / item base / monster part / etc).
 *
 * Knowledge level (0–3):
 *   0 = unknown ("Unknown Substance")
 *   1 = name revealed ("Iron Ore")
 *   2 = base properties revealed (density, hardness, etc)
 *   3 = affixes revealed (hidden modifiers visible)
 *
 * `discoveredAffixesJson` is a JSON array of affix IDs this character
 * has learned to recognize on items made from this material.
 *
 * Each row scoped to (characterId, resourceId). Studying / using /
 * crafting with a resource increments knowledgeLevel (capped at 3).
 */
export const characterMaterialMastery = sqliteTable('character_material_mastery', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  resourceId: text('resource_id').notNull(),  // commodity id (e.g. 'iron_ore') or item base id
  knowledgeLevel: integer('knowledge_level').notNull().default(0),
  discoveredAffixesJson: text('discovered_affixes_json').notNull().default('[]'),
  /** World day of last study/observation — used for decay or refresh later */
  lastStudiedDay: integer('last_studied_day'),
})

// -- Magic on Characters --

export const spellsKnown = sqliteTable('spells_known', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  spellId: text('spell_id').notNull().references(() => spells.id),
})

export const spellSlots = sqliteTable('spell_slots', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  spellLevel: integer('spell_level').notNull(),
  total: integer('total').notNull(),
  used: integer('used').notNull().default(0),
})

export const casterState = sqliteTable('caster_state', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  spellcastingAbility: text('spellcasting_ability').notNull(),
  dc: integer('dc').notNull(),
  attackBonus: integer('attack_bonus').notNull(),
  paradoxLevel: real('paradox_level').notNull().default(0),
})

// -- Dice Pipeline --

export const dicePools = sqliteTable('dice_pools', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  configJson: text('config_json').notNull(),
  stateJson: text('state_json').notNull(),
  lastRefreshDay: integer('last_refresh_day'),
})

export const checkReceipts = sqliteTable('check_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: text('character_id').notNull().references(() => characters.id),
  checkType: text('check_type').notNull(),
  dc: integer('dc').notNull(),
  result: text('result').notNull(),
  advantageState: text('advantage_state'),
  worldDay: integer('world_day').notNull(),
})

export const damageReceipts = sqliteTable('damage_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: text('character_id').notNull().references(() => characters.id),
  damageType: text('damage_type').notNull(),
  amount: integer('amount').notNull(),
  targetStateJson: text('target_state_json'),
  worldDay: integer('world_day').notNull(),
})

export const paradoxLog = sqliteTable('paradox_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: text('character_id').notNull().references(() => characters.id),
  severity: text('severity').notNull(),
  triggerSpell: text('trigger_spell'),
  consequencesJson: text('consequences_json'),
  worldDay: integer('world_day').notNull(),
})

// -- Party & NPCs --

export const parties = sqliteTable('parties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  adventureId: text('adventure_id'),
  gold: real('gold').notNull().default(0),
  level: integer('level').notNull().default(1),
  formation: text('formation'),
  // Temporal clock
  birthTick: integer('birth_tick').notNull(),   // server tick at party creation — floor, can't go before
  currentTick: integer('current_tick').notNull(), // party's local clock cursor — always ≤ server tick
  // Starting location & XP
  startingLocation: text('starting_location'),  // settlement id where party spawned
  startingType: text('starting_type').notNull().default('safe'),  // safe (Daggerford), chosen, random
  xpMultiplier: real('xp_multiplier').notNull().default(1.0),  // 1.3 for random start
  // ── Cert-group identity (Slice 6, 2026-04-30) ──
  // Per `project_cert_hierarchy.md` "Parties via cert hash": a party is
  // also a set of character cert ids that synchronize state. The server
  // uses this for spectrum fan-out (when railgun bridge ships).
  /** JSON array of character cert ids. Ordered, last entry is most recently joined. */
  memberCertIdsJson: text('member_cert_ids_json').notNull().default('[]'),
  /** The cert id that founded the party (typically a DM cert for DM-led parties). */
  founderCertId: text('founder_cert_id'),
  /** Set when the party disbands; soft-delete for audit. */
  disbandedAt: text('disbanded_at'),
})

export const partyMembers = sqliteTable('party_members', {
  id: text('id').primaryKey(),
  partyId: text('party_id').notNull().references(() => parties.id),
  characterId: text('character_id').notNull().references(() => characters.id),
  role: text('role'),
  joinedDay: integer('joined_day'),
})

export const npcs = sqliteTable('npcs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  settlementId: text('settlement_id').references(() => settlements.id),
  role: text('role'),
  disposition: text('disposition').notNull().default('neutral'),
  personalityJson: text('personality_json'),
  servicesJson: text('services_json'),
  agendaJson: text('agenda_json'),
  craft: text('craft'),
})

export const npcMemories = sqliteTable('npc_memories', {
  id: text('id').primaryKey(),
  npcId: text('npc_id').notNull().references(() => npcs.id),
  memoryType: text('memory_type').notNull(),  // episodic, semantic, emotional
  content: text('content').notNull(),
  sentiment: real('sentiment').notNull().default(0),
  decay: real('decay').notNull().default(0.1),
  worldDay: integer('world_day').notNull(),
})

export const npcSecrets = sqliteTable('npc_secrets', {
  id: text('id').primaryKey(),
  npcId: text('npc_id').notNull().references(() => npcs.id),
  secret: text('secret').notNull(),
  revealTrigger: text('reveal_trigger'),
  revealed: integer('revealed', { mode: 'boolean' }).notNull().default(false),
})

export const followers = sqliteTable('followers', {
  id: text('id').primaryKey(),
  partyId: text('party_id').notNull().references(() => parties.id),
  npcId: text('npc_id').notNull().references(() => npcs.id),
  scope: text('scope').notNull().default('local'),
  loyalty: real('loyalty').notNull().default(50),
  combatParticipation: integer('combat_participation', { mode: 'boolean' }).notNull().default(true),
})

export const loyaltyEvents = sqliteTable('loyalty_events', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => followers.id),
  eventType: text('event_type').notNull(),
  loyaltyDelta: real('loyalty_delta').notNull(),
  worldDay: integer('world_day').notNull(),
})

// -- Entourage (linked parties for travel, caravan, war) --

export const entourages = sqliteTable('entourages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  purpose: text('purpose').notNull(),  // travel, caravan_escort, war_column, pilgrimage, expedition
  leadPartyId: text('lead_party_id').notNull().references(() => parties.id),
  formationType: text('formation_type').notNull().default('column'),  // column, wedge, spread, defensive_box
  status: text('status').notNull().default('assembling'),  // assembling, moving, camped, engaged, disbanded
  speedOverride: real('speed_override'),  // slowest member dictates, or forced march
  worldDay: integer('world_day').notNull(),
})

export const entourageMembers = sqliteTable('entourage_members', {
  id: text('id').primaryKey(),
  entourageId: text('entourage_id').notNull().references(() => entourages.id),
  partyId: text('party_id').references(() => parties.id),
  caravanId: text('caravan_id').references(() => caravans.id),
  armyId: text('army_id').references(() => armies.id),
  memberType: text('member_type').notNull(),  // party, caravan, army_unit, npc_group
  position: text('position').notNull().default('center'),  // vanguard, center, rear, flank_left, flank_right, scout
  joinedDay: integer('joined_day').notNull(),
})

export const entourageConditions = sqliteTable('entourage_conditions', {
  id: text('id').primaryKey(),
  entourageId: text('entourage_id').notNull().references(() => entourages.id),
  condition: text('condition').notNull(),  // fatigued, injured, demoralized, well_rested, forced_march, encumbered
  affectsSpeed: integer('affects_speed', { mode: 'boolean' }).notNull().default(false),
  speedModifier: real('speed_modifier').notNull().default(1.0),
  source: text('source'),
  appliedDay: integer('applied_day').notNull(),
})

// -- Traversals (persist mid-journey travel state) --

export const traversals = sqliteTable('traversals', {
  id: text('id').primaryKey(),
  entourageId: text('entourage_id').references(() => entourages.id),
  partyId: text('party_id').references(() => parties.id),  // if solo party travel
  edgeId: text('edge_id').notNull().references(() => worldEdges.id),
  currentMile: real('current_mile').notNull().default(0),
  direction: text('direction').notNull().default('forward'),  // forward, reverse
  startDay: integer('start_day').notNull(),
  currentDay: integer('current_day').notNull(),
  effectiveSpeed: real('effective_speed').notNull(),
  currentSegmentIndex: integer('current_segment_index').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  sitesFoundJson: text('sites_found_json'),
})

// -- Hub Topology (internal settlement nodes + edges) --

/**
 * Hub nodes: locations INSIDE a settlement.
 * A shop is a node. A temple is a node. A tavern is a node.
 * The settlement IS the world-level node; hub_nodes are the manifold INSIDE it.
 */
export const hubNodes = sqliteTable('hub_nodes', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  districtId: text('district_id').references(() => districtHubs.id),
  nodeType: text('node_type').notNull(),  // shop, tavern, temple, guild_hall, market_square, residence, gate, warehouse, dock, arena, well, fountain
  name: text('name').notNull(),
  buildingId: text('building_id').references(() => buildings.id),  // optional — if this node IS a building
  ownerId: text('owner_id'),  // NPC or faction that controls this node
  publicAccess: integer('public_access', { mode: 'boolean' }).notNull().default(true),
  operatingHours: text('operating_hours'),  // 'dawn-dusk', 'always', 'night'
  propertiesJson: text('properties_json'),
})

/**
 * Hub edges: streets, alleys, passages between hub nodes.
 * Vendors and stalls can sit on edges (like market street stalls).
 */
export const hubEdges = sqliteTable('hub_edges', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  sourceNodeId: text('source_node_id').notNull().references(() => hubNodes.id),
  targetNodeId: text('target_node_id').notNull().references(() => hubNodes.id),
  edgeType: text('edge_type').notNull(),  // main_road, alley, passage, bridge, stairs, tunnel, dock_ramp
  name: text('name'),
  traverseMinutes: integer('traverse_minutes').notNull().default(5),
  dangerLevel: text('danger_level').notNull().default('safe'),  // safe, sketchy, dangerous
  bidirectional: integer('bidirectional', { mode: 'boolean' }).notNull().default(true),
})

/**
 * Hub vendors: stalls and vendors that sit ON edges (market streets).
 * Different from shops (which are nodes).
 */
export const hubVendors = sqliteTable('hub_vendors', {
  id: text('id').primaryKey(),
  hubEdgeId: text('hub_edge_id').notNull().references(() => hubEdges.id),
  npcId: text('npc_id').references(() => npcs.id),
  vendorType: text('vendor_type').notNull(),  // food_stall, trinket_cart, fortune_teller, street_performer, black_market
  inventoryId: text('inventory_id').references(() => inventories.id),
  operatingHours: text('operating_hours'),
  reputation: real('reputation').notNull().default(50),
})

// ============================================================
// L6 — SESSIONS + GAME MODES
// ============================================================

// -- Campaign & Mode Config --

export const adventures = sqliteTable('adventures', {
  id: text('id').primaryKey(),
  partyId: text('party_id').notNull().references(() => parties.id),
  name: text('name').notNull(),
  worldStateJson: text('world_state_json'),
})

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  adventureId: text('adventure_id').notNull().references(() => adventures.id),
  playMode: text('play_mode').notNull(),  // GROUP_DM_AI, GROUP_AI, SOLO_AI, TRUE_SOLO
})

export const playModeConfigs = sqliteTable('play_mode_configs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id),
  mode: text('mode').notNull(),
  gmProfile: text('gm_profile').notNull(),
  pacingBias: text('pacing_bias').notNull().default('balanced'),
  corridorMode: integer('corridor_mode', { mode: 'boolean' }).notNull().default(false),
  autoAdvance: integer('auto_advance', { mode: 'boolean' }).notNull().default(false),
  maxScenesPerSession: integer('max_scenes_per_session').notNull().default(10),
})

export const simulationDepth = sqliteTable('simulation_depth', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id),
  agriculture: integer('agriculture', { mode: 'boolean' }).notNull().default(true),
  cooking: integer('cooking', { mode: 'boolean' }).notNull().default(true),
  banking: integer('banking', { mode: 'boolean' }).notNull().default(true),
  religion: integer('religion', { mode: 'boolean' }).notNull().default(true),
  entertainment: integer('entertainment', { mode: 'boolean' }).notNull().default(true),
  lore: integer('lore', { mode: 'boolean' }).notNull().default(true),
  warfare: integer('warfare', { mode: 'boolean' }).notNull().default(true),
  waterSystems: integer('water_systems', { mode: 'boolean' }).notNull().default(true),
  extraction: integer('extraction', { mode: 'boolean' }).notNull().default(true),
  trading: integer('trading', { mode: 'boolean' }).notNull().default(true),
})

export const gmProfileOverrides = sqliteTable('gm_profile_overrides', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id),
  tone: text('tone'),
  pacing: text('pacing'),
  combatFrequency: text('combat_frequency'),
  socialFrequency: text('social_frequency'),
  mercyLevel: text('mercy_level'),
  narrationStyle: text('narration_style'),
  rulesStrictness: text('rules_strictness'),
})

// -- Session Tables --

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  adventureId: text('adventure_id').notNull().references(() => adventures.id),
  worldDay: integer('world_day').notNull(),
  timestamp: text('timestamp'),
  worldMutationsJson: text('world_mutations_json'),
})

export const sceneCards = sqliteTable('scene_cards', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  cardType: text('card_type').notNull(),
  title: text('title'),
  readAloud: text('read_aloud'),
  choicesJson: text('choices_json'),
})

export const hookThreads = sqliteTable('hook_threads', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  hook: text('hook').notNull(),
  staleness: real('staleness').notNull().default(0),
  priority: integer('priority').notNull().default(1),
})

export const hookEscalations = sqliteTable('hook_escalations', {
  id: text('id').primaryKey(),
  hookId: text('hook_id').notNull().references(() => hookThreads.id),
  urgency: text('urgency').notNull(),  // gentle, moderate, urgent, critical
  reminderType: text('reminder_type').notNull(),
  reminderDescription: text('reminder_description'),
  worldDay: integer('world_day').notNull(),
})

export const combatants = sqliteTable('combatants', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id').notNull().references(() => sceneCards.id),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),  // character, npc, monster
  initiative: integer('initiative').notNull(),
  hp: integer('hp').notNull(),
  hpMax: integer('hp_max').notNull(),
  ac: integer('ac').notNull(),
  conditionsJson: text('conditions_json'),
})

export const combatRounds = sqliteTable('combat_rounds', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id').notNull().references(() => sceneCards.id),
  roundNumber: integer('round_number').notNull(),
  turnsJson: text('turns_json'),
})

export const downtimeActivities = sqliteTable('downtime_activities', {
  id: text('id').primaryKey(),
  adventureId: text('adventure_id').notNull().references(() => adventures.id),
  characterId: text('character_id').notNull().references(() => characters.id),
  activityType: text('activity_type').notNull(),
  daysSpent: integer('days_spent').notNull().default(0),
  progress: real('progress').notNull().default(0),
})

// -- Solo Mode Tables --

export const soloCorridors = sqliteTable('solo_corridors', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  currentSegment: integer('current_segment').notNull().default(0),
  forkHistoryJson: text('fork_history_json'),
})

export const corridorSegments = sqliteTable('corridor_segments', {
  id: text('id').primaryKey(),
  corridorId: text('corridor_id').notNull().references(() => soloCorridors.id),
  segOrder: integer('seg_order').notNull(),
  sceneType: text('scene_type').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  choicesJson: text('choices_json'),
  chosenPath: text('chosen_path'),
})

export const clockworkEvents = sqliteTable('clockwork_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  sceneType: text('scene_type').notNull(),
  difficulty: text('difficulty'),
  worldDay: integer('world_day').notNull(),
})

export const contextSnapshots = sqliteTable('context_snapshots', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  packetJson: text('packet_json').notNull(),
  worldDay: integer('world_day').notNull(),
})

// ============================================================
// L7 — NARRATIVE
// ============================================================

export const arcs = sqliteTable('arcs', {
  id: text('id').primaryKey(),
  adventureId: text('adventure_id').notNull().references(() => adventures.id),
  arcType: text('arc_type').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
})

export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  arcId: text('arc_id').notNull().references(() => arcs.id),
  objective: text('objective').notNull(),
  status: text('status').notNull().default('active'),
  rewardJson: text('reward_json'),
})

export const beats = sqliteTable('beats', {
  id: text('id').primaryKey(),
  questId: text('quest_id').notNull().references(() => quests.id),
  beatType: text('beat_type').notNull(),
  trigger: text('trigger'),
  consequencesJson: text('consequences_json'),
})

export const rabbitHoles = sqliteTable('rabbit_holes', {
  id: text('id').primaryKey(),
  arcId: text('arc_id').notNull().references(() => arcs.id),
  depth: integer('depth').notNull().default(1),
  connectionPoints: text('connection_points'),
})

export const villains = sqliteTable('villains', {
  id: text('id').primaryKey(),
  adventureId: text('adventure_id').notNull().references(() => adventures.id),
  name: text('name').notNull(),
  tier: integer('tier').notNull().default(1),
  plan: text('plan'),
  weaknesses: text('weaknesses'),
  minionsJson: text('minions_json'),
})

export const patrons = sqliteTable('patrons', {
  id: text('id').primaryKey(),
  adventureId: text('adventure_id').notNull().references(() => adventures.id),
  name: text('name').notNull(),
  standing: real('standing').notNull().default(0),
  blessings: text('blessings'),
  favorsOwed: integer('favors_owed').notNull().default(0),
})

export const conflicts = sqliteTable('conflicts', {
  id: text('id').primaryKey(),
  villainId: text('villain_id').notNull().references(() => villains.id),
  patronId: text('patron_id').references(() => patrons.id),
  balance: real('balance').notNull().default(0),
  escalation: real('escalation').notNull().default(0),
})

// ============================================================
// L8 — INTELLIGENCE + STRATEGIC AI
// ============================================================

export const agentIdentities = sqliteTable('agent_identities', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),  // npc, character
  agentType: text('agent_type').notNull(),
  personality: text('personality'),
  speechPatterns: text('speech_patterns'),
})

export const knowledgeEntries = sqliteTable('knowledge_entries', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentIdentities.id),
  scope: text('scope').notNull(),
  boundary: text('boundary'),
  confidence: real('confidence').notNull().default(1),
  content: text('content').notNull(),
})

export const agentMemories = sqliteTable('agent_memories', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentIdentities.id),
  memoryType: text('memory_type').notNull(),
  content: text('content').notNull(),
  decayRate: real('decay_rate').notNull().default(0.1),
  worldDay: integer('world_day').notNull(),
})

// -- Strategic AI (Intent Engine) --

export const actorDrives = sqliteTable('actor_drives', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentIdentities.id),
  driveType: text('drive_type').notNull(),
  intensity: real('intensity').notNull(),
  satisfaction: real('satisfaction').notNull().default(0),
})

export const actorGoals = sqliteTable('actor_goals', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentIdentities.id),
  description: text('description').notNull(),
  horizon: text('horizon').notNull(),
  status: text('status').notNull().default('active'),
  priority: integer('priority').notNull().default(1),
})

export const actorAdvisors = sqliteTable('actor_advisors', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentIdentities.id),
  domain: text('domain').notNull(),
  counselStyle: text('counsel_style'),
  weight: real('weight').notNull().default(1),
})

export const actorActions = sqliteTable('actor_actions', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => actorGoals.id),
  actionType: text('action_type').notNull(),
  outcomeGrade: text('outcome_grade'),
  demerits: integer('demerits').notNull().default(0),
  worldDay: integer('world_day').notNull(),
})

export const schemes = sqliteTable('schemes', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentIdentities.id),
  plan: text('plan').notNull(),
  progress: real('progress').notNull().default(0),
  resourcesJson: text('resources_json'),
  quarterlyTick: integer('quarterly_tick').notNull().default(0),
})

// ============================================================
// H — HUB + CULTURE
// ============================================================

export const districtHubs = sqliteTable('district_hubs', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  districtType: text('district_type').notNull(),
  template: text('template'),
  seed: text('seed'),
  adjacencyJson: text('adjacency_json'),
})

export const hubFoodState = sqliteTable('hub_food_state', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  cuisineRegion: text('cuisine_region').notNull(),
  variety: real('variety').notNull().default(0),
  moraleModifier: real('morale_modifier').notNull().default(0),
  fuelType: text('fuel_type'),
})

export const performers = sqliteTable('performers', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  performanceType: text('performance_type').notNull(),
  venueId: text('venue_id').references(() => venues.id),
  patronage: real('patronage').notNull().default(0),
  culturalScore: real('cultural_score').notNull().default(0),
})

export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  tier: text('tier').notNull(),  // private_shelf, collection, library, grand_archive
  bookCount: integer('book_count').notNull().default(0),
  researchSpeed: real('research_speed').notNull().default(1),
})

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  libraryId: text('library_id').notNull().references(() => libraries.id),
  title: text('title').notNull(),
  category: text('category').notNull(),
  form: text('form').notNull().default('codex'),
  knowledgeEntriesJson: text('knowledge_entries_json'),
})

export const rumors = sqliteTable('rumors', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  source: text('source'),
  reliability: real('reliability').notNull().default(0.5),
  content: text('content').notNull(),
  expiryDay: integer('expiry_day'),
})

export const travelLog = sqliteTable('travel_log', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull().references(() => guilds.id),
  route: text('route').notNull(),
  worldDay: integer('world_day').notNull(),
  notesJson: text('notes_json'),
})

// ============================================================
// W — WIKI + VECTOR (Observation Pipeline)
// ============================================================

export const wikiArticles = sqliteTable('wiki_articles', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  worldDay: integer('world_day').notNull(),
  articleType: text('article_type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  depthOfKnowledge: text('depth_of_knowledge').notNull().default('rumor'),
  supersedesId: text('supersedes_id'),    // chain of supersession
  observerId: text('observer_id'),
})

export const wikiTags = sqliteTable('wiki_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: text('article_id').notNull().references(() => wikiArticles.id),
  tag: text('tag').notNull(),
})

export const wikiLinks = sqliteTable('wiki_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: text('source_id').notNull().references(() => wikiArticles.id),
  targetId: text('target_id').notNull().references(() => wikiArticles.id),
  linkType: text('link_type').notNull(),  // mentions, continues, contradicts, supersedes
})

export const wikiEmbeddings = sqliteTable('wiki_embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: text('article_id').notNull().references(() => wikiArticles.id),
  chunkIdx: integer('chunk_idx').notNull(),
  chunkText: text('chunk_text').notNull(),
  embedding: blob('embedding'),   // 768 or 1536-dim float vector
})

// ============================================================
// Ω — CLOCKWORK STATE
// ============================================================

export const mmStates = sqliteTable('mm_states', {
  id: text('id').primaryKey(),
  mmType: text('mm_type').notNull(),
  nodeId: text('node_id').notNull(),
  layer: integer('layer').notNull(),
  cadence: text('cadence').notNull(),
  pendingPotential: real('pending_potential').notNull().default(0),
  domainStateJson: text('domain_state_json'),
})

export const tickLog = sqliteTable('tick_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  worldDay: integer('world_day').notNull(),
  cadence: text('cadence').notNull(),
  mmsTicked: integer('mms_ticked').notNull().default(0),
  playerTicks: integer('player_ticks').notNull().default(0),
  timestamp: text('timestamp'),
})

export const tpbEntries = sqliteTable('tpb_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  worldDay: integer('world_day').notNull(),
  actionType: text('action_type').notNull(),
  targetId: text('target_id'),
  deltaJson: text('delta_json'),
  timestamp: text('timestamp'),
})

/**
 * Reputation — per-PC and per-party score with each faction.
 *
 * Polymorphic: subjectType is 'character' | 'party'. Stored as a single table
 * because the math is identical and they share the same range (-100..+100).
 *
 * The party row acts as a damper: when a delta would change a PC's reputation,
 * the engine multiplies by a function of the PARTY's standing — large absolute
 * party rep makes individual swings smaller. See reputationDeltas for the
 * audit trail of base vs applied delta.
 */
export const reputations = sqliteTable('reputations', {
  id: text('id').primaryKey(),
  subjectType: text('subject_type').notNull(),   // 'character' | 'party'
  subjectId: text('subject_id').notNull(),
  factionId: text('faction_id').notNull().references(() => factions.id),
  score: real('score').notNull().default(0),     // -100..+100
})

/**
 * Character persona — the soft-narrative bits that don't fit the mechanical
 * tables. Backstory, ideals, bonds, flaws, allies, miscellaneous notes.
 *
 * `field` enum: 'backstory' | 'personality' | 'ideal' | 'bond' | 'flaw' |
 *               'ally' | 'note' | 'appearance' | 'faith' | 'alignment'
 *
 * Stored as a child table (one row per fact, ord for in-field order)
 * rather than JSON columns so it stays queryable and indexable later.
 */
export const characterPersona = sqliteTable('character_persona', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  field: text('field').notNull(),
  value: text('value').notNull(),
  ord: integer('ord').notNull().default(0),
})

export const reputationDeltas = sqliteTable('reputation_deltas', {
  id: text('id').primaryKey(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  factionId: text('faction_id').notNull().references(() => factions.id),
  baseDelta: real('base_delta').notNull(),
  appliedDelta: real('applied_delta').notNull(),  // base * dampen(party_rep)
  reason: text('reason'),
  worldDay: integer('world_day').notNull(),
  appliedAt: text('applied_at').notNull(),
})

// ============================================================
// Ω — CALENDARS + TICK COUNTER
// ============================================================

/**
 * Calendar definitions — each culture/region can have its own calendar.
 * monthNames, dayNames, festivals stored as JSON arrays.
 * daysPerYear allows non-standard (e.g. 360-day elven, 400-day dwarven).
 */
export const calendars = sqliteTable('calendars', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),              // "Harptos" (Forgotten Realms), "Imperial Calendar", etc.
  culture: text('culture').notNull(),
  daysPerYear: integer('days_per_year').notNull().default(365),
  monthsJson: text('months_json').notNull(),  // [{name, days}] — defines month names + lengths
  dayNamesJson: text('day_names_json'),       // e.g. ["Moonday","Towerday",…] — weekly cycle
  festivalsJson: text('festivals_json'),      // [{name, monthIndex, day, duration}]
  epochName: text('epoch_name'),              // "Year of the Ageless One", "DR" (Dale Reckoning)
  epochYear: integer('epoch_year').notNull().default(1), // what year world_day=0 maps to
})

/**
 * Maps settlements (or regions) to a calendar.
 * dateOffset allows local time zones / era shifts.
 * currentYear/currentMonth/currentDay are computed from world_day + calendar rules.
 */
export const settlementCalendars = sqliteTable('settlement_calendars', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').references(() => settlements.id),
  regionId: text('region_id').references(() => worldRegions.id),
  calendarId: text('calendar_id').notNull().references(() => calendars.id),
  dateOffset: integer('date_offset').notNull().default(0),  // days offset from world_day (timezone/era)
})

// ── Hub Runtime (shared compute lease over canonical hub geometry) ──
// Per `docs/to-be implemented/hub-runtime-proposal.md` — pruned per Pedro
// 2026-04-30: dropped α/Ω hash machinery. Determinism is the integrity:
// any cheater forks themselves out of consensus by definition. Math is the
// gate. The lease layer is pure coordination; receipts are append-only deltas.
export const hubRuntimes = sqliteTable('hub_runtimes', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  /** Optional JSON array of districtHubs.id for partial-runtime scoping. */
  districtIdsJson: text('district_ids_json'),
  /** Per-proposal: identifier within the settlement. Today: same as settlementId. */
  hubId: text('hub_id').notNull(),
  /** Aperture tag — currently only 'A4_HUB' (3.9-mile L4 shared space). */
  aperture: text('aperture').notNull().default('A4_HUB'),
  /** TPB head id at runtime start — audit anchor for replay-from-here. */
  canonicalHeadId: text('canonical_head_id').notNull(),
  /** Number of currently-joined observers. Lease releases when 0. */
  activeN: integer('active_n').notNull().default(0),
  /** JSON array of session ids that have joined this runtime. */
  joinedSessionIdsJson: text('joined_session_ids_json').notNull().default('[]'),
  status: text('status', {
    enum: ['open', 'closing', 'committed', 'failed', 'abandoned'],
  }).notNull().default('open'),
  openedAt: text('opened_at').notNull(),
  /** Last activity heartbeat — used to detect abandoned leases. */
  lastSeenAt: text('last_seen_at').notNull(),
  /** Hard expiry — even with activity, a runtime closes by this time. */
  leaseExpiresAt: text('lease_expires_at').notNull(),
})

// Sequenced audit log of receipts the shards posted during a lease. This is
// HOW WE CHECK what shards sent: drain reads in seq order, deterministic
// replay verifies. Not a chain hash — math is the gate.
export const hubRuntimeReceipts = sqliteTable('hub_runtime_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubRuntimeId: text('hub_runtime_id').notNull().references(() => hubRuntimes.id),
  /** Order within the runtime — server assigns sequentially. */
  sequence: integer('sequence').notNull(),
  /** Cert that signed this receipt (character cert id). */
  actorCertId: text('actor_cert_id').notNull(),
  /** Serialized WorldTPBAction (intent + params). */
  actionJson: text('action_json').notNull(),
  /** Serialized MF receipt (forward-pass artifact, audit-only). */
  receiptJson: text('receipt_json').notNull(),
  createdAt: text('created_at').notNull(),
})

// Tensor row — additive to receipts. Per Pedro 2026-05-01: "create a table
// that acts like a tensor, every possible action type is a column and the
// DMs shards both share it, any alteration gets posted there."
//
// One row per active hub_runtime; one column per WorldTPBAction variant.
// Each column holds a JSON array of entries shaped:
//   { seq, actorCertId, at, action, receipt }
// Same data as hub_runtime_receipts, denormalized for fast live shared-view
// reads ("show me writeKappas in this hub right now"). Receipts table is
// the authoritative time-axis; this row is the dimension-axis. Drain uses
// receipts (sequenced); shards reading the live state use this row.
export const hubRuntimeState = sqliteTable('hub_runtime_state', {
  hubRuntimeId: text('hub_runtime_id').primaryKey().references(() => hubRuntimes.id),
  tickJson: text('tick_json').notNull().default('[]'),
  writeKappaJson: text('write_kappa_json').notNull().default('[]'),
  writeEdgeJson: text('write_edge_json').notNull().default('[]'),
  entitySpawnJson: text('entity_spawn_json').notNull().default('[]'),
  entityMoveJson: text('entity_move_json').notNull().default('[]'),
  entityDespawnJson: text('entity_despawn_json').notNull().default('[]'),
  observeJson: text('observe_json').notNull().default('[]'),
  sessionJson: text('session_json').notNull().default('[]'),
  characterTransferJson: text('character_transfer_json').notNull().default('[]'),
})

/**
 * Global tick counter — singleton row (or one per world).
 * Tracks the current world_day and tick state.
 */
export const tickCounter = sqliteTable('tick_counter', {
  id: text('id').primaryKey(),                // world_id
  currentWorldDay: integer('current_world_day').notNull().default(0),
  campaignStartDay: integer('campaign_start_day').notNull().default(0),
  lastHourlyTick: integer('last_hourly_tick').notNull().default(0),
  lastDailyTick: integer('last_daily_tick').notNull().default(0),
  lastWeeklyTick: integer('last_weekly_tick').notNull().default(0),
  lastMonthlyTick: integer('last_monthly_tick').notNull().default(0),
  lastYearlyTick: integer('last_yearly_tick').notNull().default(0),
  totalTicksFired: integer('total_ticks_fired').notNull().default(0),
})
