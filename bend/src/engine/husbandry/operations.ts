/**
 * HUSBANDRY SYSTEM - Operation Management
 *
 * CRUD and yield operations for husbandry operations.
 */

import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import type {
  HusbandryOperation,
  OperationMode,
  OperationStatus,
  OutputDestination,
  LivestockSpecies,
  Herd,
} from './schema';

// ============================================
// OPERATION CREATION
// ============================================

export interface CreateOperationInput {
  campaignId: string;
  ranchId: string;
  herdId: string;

  mode: OperationMode;

  laborAllocated?: number;
  feedAllocated?: number;
  feedSource?: 'pasture' | 'stockpile' | 'market';

  outputDestination?: OutputDestination;
  stockpileCapacity?: number;

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a new husbandry operation.
 */
export async function createOperation(
  input: CreateOperationInput
): Promise<HusbandryOperation> {
  const now = new Date().toISOString();
  const operationId = crypto.randomUUID();

  const operation: HusbandryOperation = {
    id: operationId,
    ranchId: input.ranchId,
    herdId: input.herdId,
    mode: input.mode,
    laborAllocated: input.laborAllocated ?? 0,
    feedAllocated: input.feedAllocated ?? 0,
    feedSource: input.feedSource ?? 'stockpile',
    careQuality: 1.0,
    feedQuality: 1.0,
    status: 'active',
    outputThisCycle: {},
    outputTotal: {},
    outputDestination: input.outputDestination,
    stockpile: {},
    stockpileCapacity: input.stockpileCapacity ?? 500,
    operatingCosts: 0,
    revenue: 0,
    startedAt: now,
    version: 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: operationId,
    operation: 'create',
    delta: { operation },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return operation;
}

// ============================================
// OPERATION UPDATE
// ============================================

export interface UpdateOperationInput {
  operationId: string;
  campaignId: string;

  mode?: OperationMode;
  laborAllocated?: number;
  feedAllocated?: number;
  feedSource?: 'pasture' | 'stockpile' | 'market';
  status?: OperationStatus;
  disruptionReason?: string;
  resumesAt?: string;
  outputDestination?: OutputDestination;

  worldTimestamp: WorldTimestamp;
}

/**
 * Update a husbandry operation.
 */
export async function updateOperation(
  operation: HusbandryOperation,
  input: UpdateOperationInput
): Promise<HusbandryOperation> {
  const now = new Date().toISOString();

  const updated: HusbandryOperation = {
    ...operation,
    mode: input.mode ?? operation.mode,
    laborAllocated: input.laborAllocated ?? operation.laborAllocated,
    feedAllocated: input.feedAllocated ?? operation.feedAllocated,
    feedSource: input.feedSource ?? operation.feedSource,
    status: input.status ?? operation.status,
    disruptionReason: input.disruptionReason ?? operation.disruptionReason,
    resumesAt: input.resumesAt ?? operation.resumesAt,
    outputDestination: input.outputDestination ?? operation.outputDestination,
    version: operation.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: operation.id,
    operation: 'update',
    delta: {
      mode: updated.mode,
      laborAllocated: updated.laborAllocated,
      feedAllocated: updated.feedAllocated,
      status: updated.status,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// OUTPUT TRACKING
// ============================================

export interface RecordOutputInput {
  operationId: string;
  campaignId: string;
  output: Record<string, number>;
  worldTimestamp: WorldTimestamp;
}

/**
 * Record output from an operation.
 */
export async function recordOutput(
  operation: HusbandryOperation,
  input: RecordOutputInput
): Promise<HusbandryOperation> {
  const now = new Date().toISOString();

  // Merge new output with existing
  const newOutputThisCycle = { ...operation.outputThisCycle };
  const newOutputTotal = { ...operation.outputTotal };

  for (const [commodity, amount] of Object.entries(input.output)) {
    newOutputThisCycle[commodity] = (newOutputThisCycle[commodity] ?? 0) + amount;
    newOutputTotal[commodity] = (newOutputTotal[commodity] ?? 0) + amount;
  }

  const updated: HusbandryOperation = {
    ...operation,
    outputThisCycle: newOutputThisCycle,
    outputTotal: newOutputTotal,
    lastTickAt: now,
    version: operation.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: operation.id,
    operation: 'update',
    delta: {
      output: input.output,
      outputThisCycle: newOutputThisCycle,
      outputTotal: newOutputTotal,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// STOCKPILE MANAGEMENT
// ============================================

export interface AddToStockpileInput {
  operationId: string;
  campaignId: string;
  commodities: Record<string, number>;
  worldTimestamp: WorldTimestamp;
}

/**
 * Add commodities to operation stockpile.
 */
export async function addToStockpile(
  operation: HusbandryOperation,
  input: AddToStockpileInput
): Promise<HusbandryOperation> {
  const now = new Date().toISOString();

  const newStockpile = { ...operation.stockpile };
  for (const [commodity, amount] of Object.entries(input.commodities)) {
    newStockpile[commodity] = (newStockpile[commodity] ?? 0) + amount;
  }

  const updated: HusbandryOperation = {
    ...operation,
    stockpile: newStockpile,
    version: operation.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: operation.id,
    operation: 'update',
    delta: {
      stockpileAdded: input.commodities,
      stockpile: newStockpile,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface RemoveFromStockpileInput {
  operationId: string;
  campaignId: string;
  commodities: Record<string, number>;
  worldTimestamp: WorldTimestamp;
}

/**
 * Remove commodities from operation stockpile.
 */
export async function removeFromStockpile(
  operation: HusbandryOperation,
  input: RemoveFromStockpileInput
): Promise<HusbandryOperation> {
  const now = new Date().toISOString();

  const newStockpile = { ...operation.stockpile };
  for (const [commodity, amount] of Object.entries(input.commodities)) {
    newStockpile[commodity] = Math.max(0, (newStockpile[commodity] ?? 0) - amount);
  }

  const updated: HusbandryOperation = {
    ...operation,
    stockpile: newStockpile,
    version: operation.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: operation.id,
    operation: 'update',
    delta: {
      stockpileRemoved: input.commodities,
      stockpile: newStockpile,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// ECONOMICS
// ============================================

export interface RecordCostsInput {
  operationId: string;
  campaignId: string;
  costs: number;
  revenue: number;
  worldTimestamp: WorldTimestamp;
}

/**
 * Record costs and revenue for an operation.
 */
export async function recordCosts(
  operation: HusbandryOperation,
  input: RecordCostsInput
): Promise<HusbandryOperation> {
  const now = new Date().toISOString();

  const updated: HusbandryOperation = {
    ...operation,
    operatingCosts: operation.operatingCosts + input.costs,
    revenue: operation.revenue + input.revenue,
    version: operation.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'husbandry_operation',
    entityId: operation.id,
    operation: 'update',
    delta: {
      costsAdded: input.costs,
      revenueAdded: input.revenue,
      operatingCosts: updated.operatingCosts,
      revenue: updated.revenue,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// QUALITY CALCULATION
// ============================================

/**
 * Calculate care quality based on labor allocation.
 */
export function calculateCareQuality(
  operation: HusbandryOperation,
  herd: Herd,
  species: LivestockSpecies
): number {
  const requiredLabor = species.careRequirements.careHoursPerDay * (herd.count / 10);

  if (requiredLabor === 0) return 1.0;

  const laborRatio = operation.laborAllocated / requiredLabor;

  // 0 labor = 0.3x quality (bare minimum survival)
  // 50% labor = 0.7x quality
  // 100% labor = 1.0x quality
  // 150%+ labor = up to 1.5x quality (extra care)
  if (laborRatio <= 0) return 0.3;
  if (laborRatio < 0.5) return 0.3 + (laborRatio * 0.8);
  if (laborRatio < 1.0) return 0.7 + ((laborRatio - 0.5) * 0.6);
  if (laborRatio < 1.5) return 1.0 + ((laborRatio - 1.0) * 1.0);
  return 1.5;
}

/**
 * Calculate feed quality based on feed allocation.
 */
export function calculateFeedQuality(
  operation: HusbandryOperation,
  herd: Herd,
  species: LivestockSpecies
): number {
  const requiredFeed = species.careRequirements.feedPerDay * herd.count;

  if (requiredFeed === 0) return 1.0;

  const feedRatio = operation.feedAllocated / requiredFeed;

  // 0 feed = 0x quality (starvation)
  // 50% feed = 0.5x quality
  // 100% feed = 1.0x quality
  // 120%+ feed = up to 1.2x quality (premium diet)
  if (feedRatio <= 0) return 0;
  if (feedRatio < 0.5) return feedRatio;
  if (feedRatio < 1.0) return 0.5 + ((feedRatio - 0.5) * 1.0);
  if (feedRatio < 1.2) return 1.0 + ((feedRatio - 1.0) * 1.0);
  return 1.2;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if operation is active.
 */
export function isActive(operation: HusbandryOperation): boolean {
  return operation.status === 'active';
}

/**
 * Get stockpile total weight.
 */
export function getStockpileWeight(operation: HusbandryOperation): number {
  return Object.values(operation.stockpile).reduce((sum, amt) => sum + amt, 0);
}

/**
 * Check if stockpile has capacity.
 */
export function hasStockpileCapacity(
  operation: HusbandryOperation,
  additionalWeight: number
): boolean {
  const currentWeight = getStockpileWeight(operation);
  return currentWeight + additionalWeight <= operation.stockpileCapacity;
}

/**
 * Get profit margin.
 */
export function getProfitMargin(operation: HusbandryOperation): number {
  if (operation.revenue === 0) return 0;
  return (operation.revenue - operation.operatingCosts) / operation.revenue;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get operations by ranch.
 */
export function getOperationsByRanch(
  operations: HusbandryOperation[],
  ranchId: string
): HusbandryOperation[] {
  return operations.filter(o => o.ranchId === ranchId);
}

/**
 * Get operations by herd.
 */
export function getOperationsByHerd(
  operations: HusbandryOperation[],
  herdId: string
): HusbandryOperation[] {
  return operations.filter(o => o.herdId === herdId);
}

/**
 * Get operations by mode.
 */
export function getOperationsByMode(
  operations: HusbandryOperation[],
  mode: OperationMode
): HusbandryOperation[] {
  return operations.filter(o => o.mode === mode);
}

/**
 * Get active operations only.
 */
export function getActiveOperations(
  operations: HusbandryOperation[]
): HusbandryOperation[] {
  return operations.filter(o => o.status === 'active');
}

// ============================================
// COMMODITY MAPPING
// ============================================

/**
 * Map husbandry outputs to economy commodities.
 */
export function mapToEconomyCommodities(
  output: Record<string, number>
): Record<string, number> {
  const mapping: Record<string, string> = {
    meat: 'meat',
    milk: 'milk',
    eggs: 'eggs',
    wool: 'wool',
    hides: 'hides',
    tallow: 'tallow',
    manure: 'manure',
    honey: 'honey',
    wax: 'wax',
  };

  const result: Record<string, number> = {};
  for (const [key, amount] of Object.entries(output)) {
    const commodityId = mapping[key] ?? key;
    result[commodityId] = amount;
  }
  return result;
}
