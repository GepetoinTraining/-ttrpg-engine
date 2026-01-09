// ============================================
// LOGISTICS SYSTEM
// ============================================
//
// The blood flow of the economy.
//
// Two types of traders:
//   STOCKERS - Buy low, sell high (arbitrage)
//   MOVERS   - Get paid to transport (freight)
//
// Transport modes:
//   LAND - Porters, pack animals, carts, wagons, caravans
//   SEA  - Rowboats, sailing boats, cogs, galleons, barges
//
// Routes are PROGRAMS. Caravans execute them.
//
// Gems come from dungeons, not mines.
// Exchange houses convert gems → currency.
//

// ─────────────────────────────────────────
// COINING (Gem-based monetary system)
// ─────────────────────────────────────────

export {
  // Schemas
  GemTypeSchema,
  GemTierSchema,
  GemInstanceSchema,
  ExchangeHouseSchema,
  ExchangeTransactionSchema,
  MonetarySupplySchema,

  // Types
  type GemType,
  type GemTier,
  type GemInstance,
  type ExchangeHouse,
  type ExchangeTransaction,
  type MonetarySupply,

  // Constants
  GEM_DATA,
  GEM_TIER_VALUES,
  QUALITY_MULTIPLIERS,
  SIZE_MULTIPLIERS,

  // Functions
  generateGemLoot,
  calculateGemPayout,
  executeGemExchange,
} from "./coining";

// ─────────────────────────────────────────
// TRANSPORT & TRADING
// ─────────────────────────────────────────

export {
  // Schemas
  TransportModeSchema,
  TraderTypeSchema,
  TradingCompanySchema,
  TradeRouteProgramSchema,
  CaravanSchema,
  FreightContractSchema,
  ArbitrageOpportunitySchema,
  LogisticsHubSchema,

  // Types
  type TransportMode,
  type TraderType,
  type TradingCompany,
  type TradeRouteProgram,
  type Caravan,
  type FreightContract,
  type ArbitrageOpportunity,
  type LogisticsHub,

  // Constants
  TRANSPORT_SPECS,
} from "./schema";

// ─────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────

export {
  LogisticsEngine,
  CaravanTickResultSchema,
  type CaravanTickResult,

  // Constants
  SLOTS_PER_DAY,

  // Utilities
  applyCaravanTickResult,
  createCaravan,
} from "./engine";

// ============================================
// QUICK START EXAMPLE
// ============================================
/*

// ─────────────────────────────────────────
// GEM EXCHANGE FLOW
// ─────────────────────────────────────────

import {
  generateGemLoot,
  calculateGemPayout,
  executeGemExchange
} from './logistics';

// 1. Party defeats dungeon boss
const gemLoot = generateGemLoot({
  cr: 10,
  treasureType: 'hoard',
  dungeonTier: 'mid',
}, 'boss-encounter-id', 'Dragon Hoard');

console.log('Found gems:', gemLoot.map(g => `${g.type} (${g.currentValue}gp)`));
// ['emerald (1500gp)', 'ruby (5000gp)', 'amethyst (100gp)', ...]

// 2. Visit exchange house
const payout = calculateGemPayout(gemLoot, exchangeHouse);
console.log('Net payout:', payout.netPayout, 'gp');
// After fees and taxes

// 3. Execute exchange
const { transaction, currencyPayout } = executeGemExchange(
  gemLoot,
  exchangeHouse,
  'player-id',
  'character',
  'Gandalf the Wealthy'
);
console.log('Received:', currencyPayout);
// { platinum: 650, gold: 3, silver: 2, copper: 0 }


// ─────────────────────────────────────────
// TRADE ROUTE FLOW
// ─────────────────────────────────────────

import {
  createCaravan,
  LogisticsEngine,
  applyCaravanTickResult
} from './logistics';

// 1. Define a route
const ironRoad: TradeRouteProgram = {
  id: 'iron-road-id',
  name: 'The Iron Road',
  routeType: 'shuttle',
  nodes: [
    {
      settlementId: 'mirabar-id',
      settlementName: 'Mirabar',
      order: 0,
      actions: [
        { type: 'buy', commodityId: 'iron_ore', priceThreshold: 1 },
        { type: 'resupply' },
      ],
      minStaySlots: 4,
      maxStaySlots: 8,
    },
    {
      settlementId: 'waterdeep-id',
      settlementName: 'Waterdeep',
      order: 1,
      actions: [
        { type: 'sell', commodityId: 'iron_ore', priceThreshold: 3 },
        { type: 'resupply' },
      ],
      minStaySlots: 4,
      maxStaySlots: 8,
    },
  ],
  edges: [{
    fromOrder: 0,
    toOrder: 1,
    distance: 300,
    terrain: ['road', 'mountain'],
    dangerLevel: 'patrolled',
    tolls: 10,
  }],
  preferredMode: 'caravan',
  allowedModes: ['wagon', 'caravan'],
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 2. Create caravan
const caravan = createCaravan(ironRoad, tradingCompany, ['wagon-1', 'wagon-2']);

// 3. Tick the caravan (every slot)
const result = LogisticsEngine.tickCaravan(
  caravan,
  ironRoad,
  48,  // 1 day of travel
  marketPrices
);

console.log('Events:', result.events);
// [{ type: 'bought_commodity', ... }, { type: 'departed', ... }]

// 4. Apply result
const updatedCaravan = applyCaravanTickResult(caravan, result);


// ─────────────────────────────────────────
// ARBITRAGE DISCOVERY
// ─────────────────────────────────────────

const opportunities = LogisticsEngine.findArbitrageOpportunities(
  { settlementId: 'mirabar', settlementName: 'Mirabar', prices: mirabarPrices },
  { settlementId: 'waterdeep', settlementName: 'Waterdeep', prices: waterdeepPrices },
  { distance: 300, dangerLevel: 'patrolled', travelDays: 10 },
  'wagon'
);

console.log('Best opportunity:', opportunities[0]);
// { commodityId: 'iron_ore', netProfitPerUnit: 1.5, roi: 150, ... }

*/
