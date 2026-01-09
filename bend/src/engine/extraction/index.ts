// ============================================
// EXTRACTION SYSTEM - PRIMARY SECTOR
// ============================================
//
// The foundation of all economic activity.
// Resources come from geography, not thin air.
//
// Flow:
//   Geography (deposits)
//     → Extraction (operations)
//       → Commodities (economy)
//         → Trade routes
//           → Markets
//
// This is where it all begins.
//

export {
  // Schemas
  DepositTypeSchema,
  DepositQualitySchema,
  TechLevelSchema,
  ResourceDepositSchema,
  ExtractionOperationSchema,
  DepositDiscoverySchema,
  RegionResourceSummarySchema,

  // Types
  type DepositType,
  type DepositQuality,
  type TechLevel,
  type ResourceDeposit,
  type ExtractionOperation,
  type DepositDiscovery,
  type RegionResourceSummary,

  // Constants
  QUALITY_MULTIPLIERS,
  TECH_LEVEL_ORDER,
  DEPOSIT_TEMPLATES,
  COMMODITY_SOURCES,
} from "./schema";

export {
  // Engine
  ExtractionEngine,
  ExtractionTickResultSchema,
  type ExtractionTickResult,

  // Constants
  TURNS_PER_SLOT,
  SLOTS_PER_DAY,
  TURNS_PER_DAY,

  // Utilities
  calculateLaborEfficiency,
  createExtractionOperation,
  applyExtractionResult,
} from "./engine";

// ============================================
// QUICK START EXAMPLE
// ============================================
/*

import {
  ResourceDeposit,
  ExtractionEngine,
  createExtractionOperation,
  applyExtractionResult,
  DEPOSIT_TEMPLATES
} from './extraction';

// 1. Create a deposit from template
const ironMine: ResourceDeposit = {
  id: crypto.randomUUID(),
  locationId: 'some-world-node-id',
  locationName: 'Ironhold Mountains',
  ...DEPOSIT_TEMPLATES.iron_mine,
  totalReserves: 10000,
  remainingReserves: 10000,
  quality: 'rich',
  discovered: true,
  exploited: true,
  controlledBy: 'dwarf-faction-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 2. Create an extraction operation
const operation = createExtractionOperation(
  ironMine,
  'dwarf-faction-id',
  'faction',
  'Ironforge Mining Company',
  25 // workers
);

// 3. Add workers with skills
operation.workers = [
  { role: 'foreman', skill: 4, wage: 5 },
  ...Array(24).fill({ role: 'miner', skill: 2, wage: 1 }),
];
operation.totalWorkers = 25;
operation.status = 'operating';

// 4. Run extraction tick (1 slot = 30 minutes)
const result = ExtractionEngine.tick(
  ironMine,
  operation,
  1, // slots
  'medieval' // tech level
);

console.log('Output:', result.output);
// { iron_ore: 2.5, stone: 0.3 }

console.log('Events:', result.events);
// [{ type: 'normal_operation', ... }]

// 5. Apply result to update state
const { deposit, operation: updatedOp } = applyExtractionResult(
  ironMine,
  operation,
  result
);

console.log('Remaining reserves:', deposit.remainingReserves);
// 9997.5

// 6. Estimate depletion
const depletion = ExtractionEngine.estimateDepletion(
  deposit,
  result.output.iron_ore * 48 // per day
);
console.log(`Days until depleted: ${depletion.daysRemaining}`);
// ~83 days at current rate

*/
