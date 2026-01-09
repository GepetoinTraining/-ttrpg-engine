/**
 * HUSBANDRY SYSTEM - Ranch Operations
 *
 * CRUD operations for ranches (husbandry sites).
 */

import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import type {
  Ranch,
  RanchWorker,
  Infrastructure,
  PastureQuality,
  SecurityLevel,
  ShelterQuality,
  RanchStatus,
} from './schema';

// ============================================
// RANCH CREATION
// ============================================

export interface CreateRanchInput {
  campaignId: string;

  hubId?: string;
  worldNodeId?: string;
  districtId?: string;
  buildingId?: string;

  name: string;

  ownerId?: string;
  ownerType?: string;
  ownerName?: string;

  totalCapacity?: number;
  infrastructure?: Partial<Infrastructure>;

  pastureQuality?: PastureQuality;
  securityLevel?: SecurityLevel;
  shelterQuality?: ShelterQuality;

  workers?: RanchWorker[];

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a new ranch.
 */
export async function createRanch(input: CreateRanchInput): Promise<Ranch> {
  const now = new Date().toISOString();
  const ranchId = crypto.randomUUID();

  const ranch: Ranch = {
    id: ranchId,
    campaignId: input.campaignId,
    hubId: input.hubId,
    worldNodeId: input.worldNodeId,
    districtId: input.districtId,
    buildingId: input.buildingId,
    name: input.name,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    ownerName: input.ownerName,
    totalCapacity: input.totalCapacity ?? 50,
    currentOccupancy: 0,
    infrastructure: {
      barns: input.infrastructure?.barns ?? 0,
      pastures: input.infrastructure?.pastures ?? 1,
      fencing: input.infrastructure?.fencing,
      waterAccess: input.infrastructure?.waterAccess ?? false,
      feedStorage: input.infrastructure?.feedStorage ?? 0,
    },
    pastureQuality: input.pastureQuality ?? 'standard',
    securityLevel: input.securityLevel ?? 'basic',
    shelterQuality: input.shelterQuality ?? 'basic',
    workers: input.workers ?? [],
    totalWorkers: input.workers?.length ?? 0,
    operatingCostPerDay: 0,
    taxRate: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Calculate operating cost
  ranch.operatingCostPerDay = calculateOperatingCost(ranch);

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'ranch',
    entityId: ranchId,
    operation: 'create',
    delta: { ranch },
    actorId: input.ownerId,
    actorType: input.ownerType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return ranch;
}

// ============================================
// RANCH UPDATE
// ============================================

export interface UpdateRanchInput {
  ranchId: string;
  campaignId: string;

  name?: string;
  totalCapacity?: number;
  infrastructure?: Partial<Infrastructure>;
  pastureQuality?: PastureQuality;
  securityLevel?: SecurityLevel;
  shelterQuality?: ShelterQuality;
  status?: RanchStatus;
  taxRate?: number;
  taxCollector?: string;

  worldTimestamp: WorldTimestamp;
  actorId?: string;
  actorType?: string;
}

/**
 * Update a ranch.
 */
export async function updateRanch(
  ranch: Ranch,
  input: UpdateRanchInput
): Promise<Ranch> {
  const now = new Date().toISOString();

  const updated: Ranch = {
    ...ranch,
    name: input.name ?? ranch.name,
    totalCapacity: input.totalCapacity ?? ranch.totalCapacity,
    infrastructure: input.infrastructure
      ? { ...ranch.infrastructure, ...input.infrastructure }
      : ranch.infrastructure,
    pastureQuality: input.pastureQuality ?? ranch.pastureQuality,
    securityLevel: input.securityLevel ?? ranch.securityLevel,
    shelterQuality: input.shelterQuality ?? ranch.shelterQuality,
    status: input.status ?? ranch.status,
    taxRate: input.taxRate ?? ranch.taxRate,
    taxCollector: input.taxCollector ?? ranch.taxCollector,
    updatedAt: now,
    version: ranch.version + 1,
  };

  // Recalculate operating cost
  updated.operatingCostPerDay = calculateOperatingCost(updated);

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'ranch',
    entityId: ranch.id,
    operation: 'update',
    delta: {
      name: updated.name,
      totalCapacity: updated.totalCapacity,
      infrastructure: updated.infrastructure,
      pastureQuality: updated.pastureQuality,
      securityLevel: updated.securityLevel,
      shelterQuality: updated.shelterQuality,
      status: updated.status,
    },
    actorId: input.actorId,
    actorType: input.actorType as any,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// WORKER MANAGEMENT
// ============================================

export interface AddWorkerInput {
  ranchId: string;
  campaignId: string;
  worker: RanchWorker;
  worldTimestamp: WorldTimestamp;
}

/**
 * Add a worker to a ranch.
 */
export async function addWorker(
  ranch: Ranch,
  input: AddWorkerInput
): Promise<Ranch> {
  const now = new Date().toISOString();

  const updated: Ranch = {
    ...ranch,
    workers: [...ranch.workers, input.worker],
    totalWorkers: ranch.totalWorkers + 1,
    updatedAt: now,
    version: ranch.version + 1,
  };

  // Recalculate operating cost
  updated.operatingCostPerDay = calculateOperatingCost(updated);

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'ranch',
    entityId: ranch.id,
    operation: 'update',
    delta: {
      workerAdded: input.worker,
      totalWorkers: updated.totalWorkers,
    },
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface RemoveWorkerInput {
  ranchId: string;
  campaignId: string;
  workerIndex: number;
  worldTimestamp: WorldTimestamp;
}

/**
 * Remove a worker from a ranch.
 */
export async function removeWorker(
  ranch: Ranch,
  input: RemoveWorkerInput
): Promise<Ranch> {
  const now = new Date().toISOString();

  const workers = [...ranch.workers];
  const removed = workers.splice(input.workerIndex, 1)[0];

  const updated: Ranch = {
    ...ranch,
    workers,
    totalWorkers: ranch.totalWorkers - 1,
    updatedAt: now,
    version: ranch.version + 1,
  };

  updated.operatingCostPerDay = calculateOperatingCost(updated);

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'ranch',
    entityId: ranch.id,
    operation: 'update',
    delta: {
      workerRemoved: removed,
      totalWorkers: updated.totalWorkers,
    },
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// OCCUPANCY UPDATE
// ============================================

/**
 * Update ranch occupancy (called when herds change).
 */
export async function updateOccupancy(
  ranch: Ranch,
  campaignId: string,
  newOccupancy: number,
  worldTimestamp: WorldTimestamp
): Promise<Ranch> {
  const now = new Date().toISOString();

  const updated: Ranch = {
    ...ranch,
    currentOccupancy: newOccupancy,
    updatedAt: now,
    version: ranch.version + 1,
  };

  await writeDelta({
    campaignId,
    sessionId: undefined,
    entityType: 'ranch',
    entityId: ranch.id,
    operation: 'update',
    delta: {
      currentOccupancy: newOccupancy,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp,
  });

  return updated;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate daily operating cost for a ranch.
 */
export function calculateOperatingCost(ranch: Ranch): number {
  let cost = 0;

  // Worker wages
  for (const worker of ranch.workers) {
    cost += worker.wage;
  }

  // Infrastructure maintenance
  cost += (ranch.infrastructure.barns ?? 0) * 1;
  cost += (ranch.infrastructure.pastures ?? 0) * 0.5;

  return Math.ceil(cost);
}

/**
 * Calculate ranch capacity utilization.
 */
export function getCapacityUtilization(ranch: Ranch): number {
  if (ranch.totalCapacity === 0) return 0;
  return ranch.currentOccupancy / ranch.totalCapacity;
}

/**
 * Check if ranch has capacity for more animals.
 */
export function hasCapacity(ranch: Ranch, count: number): boolean {
  return ranch.currentOccupancy + count <= ranch.totalCapacity;
}

/**
 * Calculate average worker skill.
 */
export function getAverageWorkerSkill(ranch: Ranch): number {
  if (ranch.workers.length === 0) return 0;
  const totalSkill = ranch.workers.reduce((sum, w) => sum + w.skill, 0);
  return totalSkill / ranch.workers.length;
}

/**
 * Get workers by role.
 */
export function getWorkersByRole(ranch: Ranch, role: string): RanchWorker[] {
  return ranch.workers.filter(w => w.role === role);
}

/**
 * Check if ranch is operational.
 */
export function isOperational(ranch: Ranch): boolean {
  return ranch.status === 'active';
}

// ============================================
// QUERIES
// ============================================

/**
 * Filter ranches by owner.
 */
export function getRanchesByOwner(
  ranches: Ranch[],
  ownerId: string
): Ranch[] {
  return ranches.filter(r => r.ownerId === ownerId);
}

/**
 * Filter ranches by hub.
 */
export function getRanchesByHub(
  ranches: Ranch[],
  hubId: string
): Ranch[] {
  return ranches.filter(r => r.hubId === hubId);
}

/**
 * Filter ranches by world node.
 */
export function getRanchesByWorldNode(
  ranches: Ranch[],
  worldNodeId: string
): Ranch[] {
  return ranches.filter(r => r.worldNodeId === worldNodeId);
}

/**
 * Get active ranches only.
 */
export function getActiveRanches(ranches: Ranch[]): Ranch[] {
  return ranches.filter(r => r.status === 'active');
}
