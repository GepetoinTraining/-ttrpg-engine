/**
 * src/db/seeds/bootstrap.ts — minimal post-nuke seed.
 *
 * Per Pedro's 2026-04-30 nuke-and-seed directive:
 *   - World content is deterministic from seeds; the database starts mostly
 *     empty except for canonical baseline rows. Players mint their own
 *     accounts/characters via the create-account flow.
 *   - The TP graph is built in-memory by `src/lib/world-state.ts` from
 *     hardcoded node data; this seed mirrors those IDs so downstream FKs
 *     (NPCs at settlement, market prices, factions) resolve.
 *   - Kept tight on purpose — anything extra goes in dedicated seed files.
 *
 * Run via `npm run db:seed` after `db:nuke && db:push`.
 *
 * IDs match `src/lib/world-state.ts` `buildDefaultTp()`.
 */

import { db } from '../connection'
import {
  worlds,
  worldRegions,
  settlements,
  npcs,
  factions,
  climateZones,
  weatherState,
  commodityCatalog,
  commodityPrices,
} from '../schema'

const DEFAULT_WORLD_ID = 'default'

export async function bootstrap(): Promise<void> {
  const seed = Math.floor(Math.random() * 2147483647)
  const now = new Date().toISOString()

  // ── L0 · World ────────────────────────────────────────────────
  // Singleton `worlds` row. Day 0, party staged at Suzail.
  await db.insert(worlds).values({
    id: DEFAULT_WORLD_ID,
    name: 'Toril (default)',
    type: 'custom',
    seed,
    currentDay: 0,
    createdAt: now,
    lastCronAt: null,
    partyNodeId: 'suzail',
  }).onConflictDoNothing()

  // ── L0 · Regions ──────────────────────────────────────────────
  // Mirror the in-memory TP node hierarchy for FK targets.
  // (worldRegions has self-ref parentId; we seed Cormyr as the kingdom.)
  await db.insert(worldRegions).values([
    {
      id: 'cormyr',
      worldId: DEFAULT_WORLD_ID,
      parentId: null,
      name: 'Cormyr',
      terrain: 'kingdom',
      depth: 0,
      tileX: 0,
      tileY: 0,
      explored: true,
      hasSettlement: false,
      biome: 'temperate-mixed',
    },
  ]).onConflictDoNothing()

  // ── L1 · Settlements ──────────────────────────────────────────
  // Suzail (city), Wheloon (town), Marsember (town). hubSeed used by the
  // hub-runtime proposal layer (docs/hub-runtime-proposal.md) when the
  // runtime lease lands.
  await db.insert(settlements).values([
    {
      id: 'suzail',
      regionId: 'cormyr',
      name: 'Suzail',
      population: 53000,
      stability: 72,
      hubSeed: String(seed * 7 % 2147483647),
      hubSize: 'city',
      hubTopology: 'capital',
      era: 'medieval',
    },
    {
      id: 'wheloon',
      regionId: 'cormyr',
      name: 'Wheloon',
      population: 4500,
      stability: 58,
      hubSeed: String(seed * 11 % 2147483647),
      hubSize: 'town',
      hubTopology: 'border',
      era: 'medieval',
    },
    {
      id: 'marsember',
      regionId: 'cormyr',
      name: 'Marsember',
      population: 8000,
      stability: 64,
      hubSeed: String(seed * 13 % 2147483647),
      hubSize: 'town',
      hubTopology: 'port',
      era: 'medieval',
    },
  ]).onConflictDoNothing()

  // ── L3 · Factions (Forgotten Realms canonical) ────────────────
  // Minimal rows so Reputation matrix + Diplomacy + Roster filters render.
  // Treasury / detail come later as factions tick.
  await db.insert(factions).values([
    { id: 'zhentarim',          name: 'Zhentarim',           type: 'mercantile-conspiracy', treasury: 0,  description: 'Black Network of mercenaries, spies, and merchants.' },
    { id: 'cormyrean-crown',    name: 'Cormyrean Crown',     type: 'kingdom',               treasury: 0,  description: 'Royal house of Cormyr; War Wizards + Purple Dragons.' },
    { id: 'harpers',            name: 'Harpers',             type: 'secret-society',        treasury: 0,  description: 'Decentralized network protecting balance against tyranny.' },
    { id: 'tymora',             name: 'Church of Tymora',    type: 'religion',              treasury: 0,  description: "Goddess of Good Fortune; clergy + adventurers' patron." },
    { id: 'bane',               name: 'Church of Bane',      type: 'religion',              treasury: 0,  description: 'Black Hand; tyranny and dominion.' },
    { id: 'lords-alliance',     name: "Lords' Alliance",     type: 'coalition',             treasury: 0,  description: 'Coalition of Sword Coast cities; mutual defense.' },
    { id: 'cult-of-the-dragon', name: 'Cult of the Dragon',  type: 'cult',                  treasury: 0,  description: 'Dracoliches; the dead reign over the living.' },
    { id: 'house-crownsilver',  name: 'House Crownsilver',   type: 'noble-house',           treasury: 0,  description: 'Cormyrean noble house; political court intrigue.' },
  ]).onConflictDoNothing()

  // ── L5 · Starter NPCs at Suzail ───────────────────────────────
  // Canonical Trades Ward fixtures. Names are generic-Cormyrean rather
  // than borrowed from prior session arcs — these are the world, not the
  // story. Personality JSON kept minimal; expanded by intelligence.ts on
  // first observation.
  await db.insert(npcs).values([
    {
      id: 'npc-suzail-innkeeper',
      name: 'Maren Halloran',
      settlementId: 'suzail',
      role: 'innkeeper',
      disposition: 'friendly',
      craft: 'innkeeping',
      personalityJson: JSON.stringify({ tone: 'welcoming', traits: ['observant', 'practical'] }),
      agendaJson: null,
      servicesJson: JSON.stringify({ rooms: 'common 5gp/wk · private 12gp/wk', meals: '2gp', stables: 'yes' }),
    },
    {
      id: 'npc-suzail-smith',
      name: 'Thane Brightforge',
      settlementId: 'suzail',
      role: 'smith',
      disposition: 'neutral',
      craft: 'smithing',
      personalityJson: JSON.stringify({ tone: 'gruff', traits: ['proud', 'craftsman'] }),
      agendaJson: null,
      servicesJson: JSON.stringify({ repair: 'standard rates', commission: 'masterwork available' }),
    },
    {
      id: 'npc-suzail-guard-captain',
      name: 'Captain Rilas Veir',
      settlementId: 'suzail',
      role: 'guard captain',
      disposition: 'neutral',
      craft: null,
      personalityJson: JSON.stringify({ tone: 'formal', traits: ['lawful', 'duty-bound'] }),
      agendaJson: JSON.stringify({ drives: ['enforce Code of Cormyr', 'protect Trades Ward'] }),
      servicesJson: null,
    },
    {
      id: 'npc-suzail-town-crier',
      name: 'Pip Ellesarn',
      settlementId: 'suzail',
      role: 'town crier',
      disposition: 'friendly',
      craft: 'broadcasting',
      personalityJson: JSON.stringify({ tone: 'theatrical', traits: ['talkative', 'well-informed'] }),
      agendaJson: null,
      servicesJson: JSON.stringify({ news: 'daily proclamations', rumors: 'whispers for 2sp' }),
    },
    {
      id: 'npc-suzail-merchant',
      name: 'Aldra Vassen',
      settlementId: 'suzail',
      role: 'merchant',
      disposition: 'neutral',
      craft: 'general goods',
      personalityJson: JSON.stringify({ tone: 'shrewd', traits: ['mercantile', 'connected'] }),
      agendaJson: null,
      servicesJson: JSON.stringify({ goods: 'general supplies', haggle: 'always' }),
    },
    {
      id: 'npc-suzail-priest',
      name: 'Brother Olen',
      settlementId: 'suzail',
      role: 'priest',
      disposition: 'friendly',
      craft: 'tymora-clergy',
      personalityJson: JSON.stringify({ tone: 'kind', traits: ['hopeful', 'patient'] }),
      agendaJson: JSON.stringify({ drives: ['spread Tymora\'s favor', 'aid travelers'] }),
      servicesJson: JSON.stringify({ blessings: 'free for the faithful', healing: '50gp · cure wounds' }),
    },
  ]).onConflictDoNothing()

  // ── L0 · Climate + Weather ────────────────────────────────────
  // Cormyr is temperate-continental. Spring/autumn rainy. Snow possible.
  await db.insert(climateZones).values([
    {
      id: 'climate-cormyr',
      regionId: 'cormyr',
      climate: 'temperate',
      seasonModifiersJson: JSON.stringify({
        spring: { yieldMod: 1.05, travelMod: 0.95 },
        summer: { yieldMod: 1.10, travelMod: 1.00 },
        autumn: { yieldMod: 1.00, travelMod: 0.90 },
        winter: { yieldMod: 0.40, travelMod: 0.70 },
      }),
      annualRainfallMm: 720,
      rainySeasons: 'spring,autumn',
      snowfall: true,
    },
  ]).onConflictDoNothing()

  // Current weather: Eleasis is late summer in Faerûnian calendar.
  await db.insert(weatherState).values([
    {
      id: 'weather-cormyr',
      regionId: 'cormyr',
      climate: 'temperate',
      season: 'summer',
      temperature: 22, // celsius, late summer mild
      severity: 0.1,
      modifiersJson: JSON.stringify({
        yieldMod: 1.05,
        travelMod: 1.00,
        spoilageMult: 1.10,
      }),
    },
  ]).onConflictDoNothing()

  // ── L0 · Commodity catalog (canonical staples) ────────────────
  // Base prices in gp per unit. mm-market re-prices weekly per settlement
  // based on κ.economy.commodities supply/demand; these are the catalog
  // entries downstream tables FK to.
  await db.insert(commodityCatalog).values([
    { id: 'grain',  name: 'Grain',         category: 'food',     basePrice: 0.5,  unit: 'lb' },
    { id: 'meat',   name: 'Meat',          category: 'food',     basePrice: 2.0,  unit: 'lb' },
    { id: 'fish',   name: 'Fish',          category: 'food',     basePrice: 1.0,  unit: 'lb' },
    { id: 'salt',   name: 'Salt',          category: 'food',     basePrice: 4.0,  unit: 'lb' },
    { id: 'ale',    name: 'Ale',           category: 'food',     basePrice: 0.4,  unit: 'pint' },
    { id: 'wool',   name: 'Wool',          category: 'cloth',    basePrice: 1.5,  unit: 'lb' },
    { id: 'flax',   name: 'Flax',          category: 'cloth',    basePrice: 1.0,  unit: 'lb' },
    { id: 'cloth',  name: 'Linen cloth',   category: 'cloth',    basePrice: 5.0,  unit: 'yd' },
    { id: 'iron',   name: 'Iron ore',      category: 'metal',    basePrice: 3.0,  unit: 'lb' },
    { id: 'silver', name: 'Silver bar',    category: 'metal',    basePrice: 25,   unit: 'oz' },
    { id: 'stone',  name: 'Building stone',category: 'material', basePrice: 0.8,  unit: 'lb' },
    { id: 'wood',   name: 'Lumber',        category: 'material', basePrice: 1.0,  unit: 'lb' },
  ]).onConflictDoNothing()

  // ── L2 · Suzail commodity prices ──────────────────────────────
  // Tier-A capital — modest premium on staples, well-stocked. Base supply
  // 100, demand 100 means prices ~ basePrice. mm-market drift adjusts these
  // weekly once observed.
  await db.insert(commodityPrices).values([
    { id: 'price-suzail-grain',  commodityId: 'grain',  settlementId: 'suzail', price: 0.55, supply: 120, demand: 100 },
    { id: 'price-suzail-meat',   commodityId: 'meat',   settlementId: 'suzail', price: 2.20, supply: 110, demand: 105 },
    { id: 'price-suzail-fish',   commodityId: 'fish',   settlementId: 'suzail', price: 1.10, supply: 100, demand: 100 },
    { id: 'price-suzail-salt',   commodityId: 'salt',   settlementId: 'suzail', price: 4.40, supply: 80,  demand: 100 },
    { id: 'price-suzail-ale',    commodityId: 'ale',    settlementId: 'suzail', price: 0.42, supply: 150, demand: 130 },
    { id: 'price-suzail-wool',   commodityId: 'wool',   settlementId: 'suzail', price: 1.65, supply: 100, demand: 110 },
    { id: 'price-suzail-flax',   commodityId: 'flax',   settlementId: 'suzail', price: 1.10, supply: 90,  demand: 100 },
    { id: 'price-suzail-cloth',  commodityId: 'cloth',  settlementId: 'suzail', price: 5.50, supply: 80,  demand: 110 },
    { id: 'price-suzail-iron',   commodityId: 'iron',   settlementId: 'suzail', price: 3.30, supply: 95,  demand: 100 },
    { id: 'price-suzail-silver', commodityId: 'silver', settlementId: 'suzail', price: 26,   supply: 50,  demand: 60  },
    { id: 'price-suzail-stone',  commodityId: 'stone',  settlementId: 'suzail', price: 0.85, supply: 120, demand: 100 },
    { id: 'price-suzail-wood',   commodityId: 'wood',   settlementId: 'suzail', price: 1.05, supply: 110, demand: 105 },
  ]).onConflictDoNothing()

  // NOTE: starter quests deferred. arcs.adventureId FKs to adventures.id which
  // FKs to parties.id — so quests are inherently campaign-scoped, not world-
  // canonical. They'll be created per-campaign by chargen + onboarding flows
  // (or by `loadQuests(adventureId)` once the cert hierarchy links a campaign
  // to the active character cert). Seeding them in bootstrap would require a
  // sentinel "world" party which would muddy the campaign-scoping semantics.

  console.log(
    `bootstrap: world "${DEFAULT_WORLD_ID}" + 1 region + 3 settlements + 8 factions + 6 NPCs ` +
    `+ 1 climate + 1 weather + 12 commodities + 12 prices (seed=${seed})`,
  )
}
