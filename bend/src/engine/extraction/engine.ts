import { z } from "zod";
import type {
  ResourceDeposit,
  ExtractionOperation,
  TechLevel,
} from "./schema";
import {
  QUALITY_MULTIPLIERS,
  TECH_LEVEL_ORDER,
} from "./schema";

// ============================================
// EXTRACTION ENGINE
// ============================================
//
// This is the tick function for the PRIMARY sector.
// Every extraction operation processes here.
//
// Turn substrate:
//   1 turn = 6 seconds
//   1 slot = 600 turns = 30 minutes
//   1 day  = 14400 turns = 48 slots
//
// Extraction ticks per SLOT, not per turn.
// A miner doesn't produce iron every 6 seconds.
//

// ============================================
// CONSTANTS
// ============================================

export const TURNS_PER_SLOT = 600;
export const SLOTS_PER_DAY = 48;
export const TURNS_PER_DAY = 14400;

// Worker efficiency curve (diminishing returns)
// efficiency = 1 - e^(-workers/optimal) for workers <= optimal
// efficiency = 1 + log(workers/optimal) * 0.1 for workers > optimal (slower gains)
export function calculateLaborEfficiency(
  workers: number,
  optimalLabor: number,
  maxLabor: number
): number {
  if (workers <= 0) return 0;
  if (workers >= maxLabor) workers = maxLabor; // Cap at max

  if (workers <= optimalLabor) {
    // Ramp up to 100% at optimal
    return 1 - Math.exp(-2 * workers / optimalLabor);
  } else {
    // Diminishing returns beyond optimal
    const overOptimal = workers / optimalLabor;
    return 1 + Math.log(overOptimal) * 0.1;
  }
}

// ============================================
// EXTRACTION TICK RESULT
// ============================================

export const ExtractionTickResultSchema = z.object({
  depositId: z.string().uuid(),
  operationId: z.string().uuid(),

  // What was produced
  output: z.record(z.string(), z.number()), // commodityId -> amount

  // What was consumed
  reservesConsumed: z.number(),
  newRemainingReserves: z.number().optional(),

  // Costs incurred
  laborCost: z.number(),
  operatingCost: z.number(),
  totalCost: z.number(),

  // Events that occurred
  events: z.array(z.object({
    type: z.enum([
      "normal_operation",
      "bonus_yield",
      "secondary_discovery",
      "hazard_triggered",
      "deposit_depleted",
      "capacity_reached",
      "worker_shortage",
      "equipment_failure",
    ]),
    description: z.string(),
    severity: z.enum(["info", "warning", "danger", "critical"]).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })).default([]),

  // Updated operation state
  newStatus: z.string().optional(),

  // Timestamp
  processedAt: z.string(),
  slotsProcessed: z.number().int(),
});
export type ExtractionTickResult = z.infer<typeof ExtractionTickResultSchema>;

// ============================================
// EXTRACTION ENGINE CLASS
// ============================================

export class ExtractionEngine {

  /**
   * Process extraction for a single operation over N slots.
   * This is the core tick function.
   */
  static tick(
    deposit: ResourceDeposit,
    operation: ExtractionOperation,
    slotsElapsed: number = 1,
    currentTechLevel: TechLevel = "medieval",
    randomSeed?: number
  ): ExtractionTickResult {
    const events: ExtractionTickResult["events"] = [];
    const output: Record<string, number> = {};

    // Initialize RNG (deterministic if seed provided)
    const random = randomSeed !== undefined
      ? () => seededRandom(randomSeed)
      : Math.random;

    // ─────────────────────────────────────────
    // PRE-CHECKS
    // ─────────────────────────────────────────

    // Check tech level
    if (TECH_LEVEL_ORDER[currentTechLevel] < TECH_LEVEL_ORDER[deposit.minimumTechLevel]) {
      return {
        depositId: deposit.id,
        operationId: operation.id,
        output: {},
        reservesConsumed: 0,
        laborCost: 0,
        operatingCost: 0,
        totalCost: 0,
        events: [{
          type: "normal_operation",
          description: `Insufficient technology to exploit ${deposit.name}. Requires ${deposit.minimumTechLevel}.`,
          severity: "warning",
        }],
        newStatus: "idle",
        processedAt: new Date().toISOString(),
        slotsProcessed: 0,
      };
    }

    // Check workers
    if (operation.totalWorkers < deposit.laborRequirement) {
      events.push({
        type: "worker_shortage",
        description: `Need ${deposit.laborRequirement} workers, have ${operation.totalWorkers}`,
        severity: "warning",
      });
      return {
        depositId: deposit.id,
        operationId: operation.id,
        output: {},
        reservesConsumed: 0,
        laborCost: this.calculateLaborCost(operation, slotsElapsed),
        operatingCost: 0,
        totalCost: this.calculateLaborCost(operation, slotsElapsed),
        events,
        newStatus: "idle",
        processedAt: new Date().toISOString(),
        slotsProcessed: 0,
      };
    }

    // Check if depleted (non-renewable)
    if (!deposit.renewable && deposit.remainingReserves !== undefined && deposit.remainingReserves <= 0) {
      return {
        depositId: deposit.id,
        operationId: operation.id,
        output: {},
        reservesConsumed: 0,
        laborCost: 0,
        operatingCost: 0,
        totalCost: 0,
        events: [{
          type: "deposit_depleted",
          description: `${deposit.name} is completely depleted.`,
          severity: "critical",
        }],
        newStatus: "exhausted",
        processedAt: new Date().toISOString(),
        slotsProcessed: 0,
      };
    }

    // ─────────────────────────────────────────
    // CALCULATE OUTPUT
    // ─────────────────────────────────────────

    // Base output per slot
    let baseOutput = deposit.baseOutputPerSlot * slotsElapsed;

    // Quality multiplier
    const qualityMult = QUALITY_MULTIPLIERS[deposit.quality];

    // Labor efficiency
    const laborEff = calculateLaborEfficiency(
      operation.totalWorkers,
      deposit.optimalLabor,
      deposit.maxLabor
    );

    // Worker skill bonus (average skill level / 3)
    const avgSkill = operation.workers.length > 0
      ? operation.workers.reduce((sum, w) => sum + w.skill, 0) / operation.workers.length
      : 1;
    const skillMult = 0.8 + (avgSkill / 5) * 0.4; // 0.8 to 1.2

    // Tool bonus
    const toolBonus = operation.tools.reduce((sum, t) => sum + t.outputBonus, 0);
    const toolMult = 1 + toolBonus;

    // Building bonus
    const buildingMult = deposit.buildings.reduce(
      (mult, b) => mult * b.outputModifier * (b.condition / 100),
      1
    );

    // Worker efficiency modifier (morale, health, etc.)
    const workerEffMult = operation.workerEfficiency;

    // Final output calculation
    const totalMult = qualityMult * laborEff * skillMult * toolMult * buildingMult * workerEffMult;
    let primaryOutput = baseOutput * totalMult;

    // ─────────────────────────────────────────
    // HANDLE RESERVES (non-renewable)
    // ─────────────────────────────────────────

    let reservesConsumed = 0;
    let newRemainingReserves: number | undefined;

    if (!deposit.renewable && deposit.remainingReserves !== undefined) {
      // Can't extract more than remaining
      const maxExtractable = deposit.remainingReserves / deposit.depletionPerUnit;
      if (primaryOutput > maxExtractable) {
        primaryOutput = maxExtractable;
        events.push({
          type: "deposit_depleted",
          description: `${deposit.name} is running dry. Final extraction.`,
          severity: "warning",
        });
      }

      reservesConsumed = primaryOutput * deposit.depletionPerUnit;
      newRemainingReserves = Math.max(0, deposit.remainingReserves - reservesConsumed);

      // Check for depletion warning
      if (deposit.totalReserves && newRemainingReserves < deposit.totalReserves * 0.1) {
        events.push({
          type: "normal_operation",
          description: `${deposit.name} is below 10% reserves.`,
          severity: "warning",
        });
      }
    }

    // ─────────────────────────────────────────
    // HANDLE CAPACITY (renewable)
    // ─────────────────────────────────────────

    if (deposit.renewable && deposit.currentCapacity !== undefined) {
      // Can't extract more than current capacity
      if (primaryOutput > deposit.currentCapacity) {
        primaryOutput = deposit.currentCapacity;
        events.push({
          type: "capacity_reached",
          description: `${deposit.name} at sustainable limit.`,
          severity: "info",
        });
      }

      // Regeneration happens separately in daily tick
    }

    // ─────────────────────────────────────────
    // PRIMARY OUTPUT
    // ─────────────────────────────────────────

    output[deposit.primaryCommodityId] = Math.floor(primaryOutput * 100) / 100;

    // ─────────────────────────────────────────
    // SECONDARY COMMODITIES
    // ─────────────────────────────────────────

    for (const secondary of deposit.secondaryCommodities) {
      if (random() < secondary.chance) {
        const secondaryAmount = primaryOutput * secondary.ratio;
        output[secondary.commodityId] = (output[secondary.commodityId] || 0) +
          Math.floor(secondaryAmount * 100) / 100;

        if (secondaryAmount > 0) {
          events.push({
            type: "secondary_discovery",
            description: `Found ${secondaryAmount.toFixed(2)} ${secondary.commodityId} alongside primary extraction.`,
            severity: "info",
          });
        }
      }
    }

    // ─────────────────────────────────────────
    // BONUS YIELD (critical success)
    // ─────────────────────────────────────────

    if (random() < 0.05) { // 5% chance
      const bonusMult = 1.5 + random() * 0.5; // 1.5x to 2x
      for (const commodityId of Object.keys(output)) {
        output[commodityId] *= bonusMult;
        output[commodityId] = Math.floor(output[commodityId] * 100) / 100;
      }
      events.push({
        type: "bonus_yield",
        description: `Exceptional yield! ${Math.floor((bonusMult - 1) * 100)}% bonus.`,
        severity: "info",
      });
    }

    // ─────────────────────────────────────────
    // HAZARDS
    // ─────────────────────────────────────────

    for (const hazard of deposit.hazards) {
      // Check per slot, not per tick
      for (let slot = 0; slot < slotsElapsed; slot++) {
        if (random() < hazard.probability) {
          events.push({
            type: "hazard_triggered",
            description: `${hazard.type}: ${hazard.description || 'Hazard occurred!'}`,
            severity: hazard.severity === "deadly" ? "critical" :
                     hazard.severity === "severe" ? "danger" : "warning",
            data: {
              hazardType: hazard.type,
              severity: hazard.severity,
            },
          });

          // Hazards can reduce output
          const hazardPenalty = {
            minor: 0.9,
            moderate: 0.7,
            severe: 0.4,
            deadly: 0, // Complete loss
          }[hazard.severity];

          for (const commodityId of Object.keys(output)) {
            output[commodityId] *= hazardPenalty;
            output[commodityId] = Math.floor(output[commodityId] * 100) / 100;
          }

          // Only one hazard per tick
          break;
        }
      }
    }

    // ─────────────────────────────────────────
    // COSTS
    // ─────────────────────────────────────────

    const laborCost = this.calculateLaborCost(operation, slotsElapsed);
    const operatingCost = deposit.operatingCostPerDay * (slotsElapsed / SLOTS_PER_DAY);
    const totalCost = laborCost + operatingCost;

    // ─────────────────────────────────────────
    // RESULT
    // ─────────────────────────────────────────

    if (events.length === 0) {
      events.push({
        type: "normal_operation",
        description: `Extracted ${Object.entries(output).map(([k, v]) => `${v} ${k}`).join(', ')}`,
        severity: "info",
      });
    }

    return {
      depositId: deposit.id,
      operationId: operation.id,
      output,
      reservesConsumed,
      newRemainingReserves,
      laborCost,
      operatingCost,
      totalCost,
      events,
      newStatus: "operating",
      processedAt: new Date().toISOString(),
      slotsProcessed: slotsElapsed,
    };
  }

  /**
   * Calculate labor costs for a period.
   */
  static calculateLaborCost(operation: ExtractionOperation, slots: number): number {
    const daysWorked = slots / SLOTS_PER_DAY;
    return operation.workers.reduce((sum, w) => sum + w.wage * daysWorked, 0);
  }

  /**
   * Process regeneration for renewable deposits (called daily).
   */
  static regenerate(deposit: ResourceDeposit, daysElapsed: number = 1): {
    newCapacity: number;
    regenerated: number;
    overexploited: boolean;
  } {
    if (!deposit.renewable || deposit.currentCapacity === undefined || deposit.maxCapacity === undefined) {
      return { newCapacity: 0, regenerated: 0, overexploited: false };
    }

    let regenerated = deposit.regenerationRate * daysElapsed;
    let newCapacity = Math.min(deposit.maxCapacity, deposit.currentCapacity + regenerated);

    // Overexploitation penalty
    if (deposit.overexploited) {
      regenerated *= 0.5; // Slower recovery
      newCapacity = Math.min(deposit.maxCapacity * 0.8, newCapacity); // Reduced max
    }

    // Check for recovery from overexploitation
    const overexploited = newCapacity < deposit.maxCapacity * 0.3;

    return {
      newCapacity,
      regenerated,
      overexploited,
    };
  }

  /**
   * Calculate estimated depletion date for non-renewable deposits.
   */
  static estimateDepletion(
    deposit: ResourceDeposit,
    currentOutputPerDay: number
  ): {
    daysRemaining: number | null;
    percentRemaining: number;
  } {
    if (deposit.renewable || deposit.remainingReserves === undefined || deposit.totalReserves === undefined) {
      return { daysRemaining: null, percentRemaining: 100 };
    }

    const percentRemaining = (deposit.remainingReserves / deposit.totalReserves) * 100;

    if (currentOutputPerDay <= 0) {
      return { daysRemaining: null, percentRemaining };
    }

    const unitsPerDay = currentOutputPerDay;
    const reservesPerUnit = deposit.depletionPerUnit;
    const daysRemaining = deposit.remainingReserves / (unitsPerDay * reservesPerUnit);

    return {
      daysRemaining: Math.floor(daysRemaining),
      percentRemaining: Math.floor(percentRemaining * 10) / 10,
    };
  }

  /**
   * Calculate potential output for planning purposes.
   */
  static estimatePotentialOutput(
    deposit: ResourceDeposit,
    workers: number,
    techLevel: TechLevel
  ): {
    outputPerSlot: number;
    outputPerDay: number;
    efficiency: number;
    canOperate: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Tech check
    if (TECH_LEVEL_ORDER[techLevel] < TECH_LEVEL_ORDER[deposit.minimumTechLevel]) {
      issues.push(`Requires ${deposit.minimumTechLevel} technology`);
      return { outputPerSlot: 0, outputPerDay: 0, efficiency: 0, canOperate: false, issues };
    }

    // Worker check
    if (workers < deposit.laborRequirement) {
      issues.push(`Requires minimum ${deposit.laborRequirement} workers`);
      return { outputPerSlot: 0, outputPerDay: 0, efficiency: 0, canOperate: false, issues };
    }

    // Calculate
    const qualityMult = QUALITY_MULTIPLIERS[deposit.quality];
    const laborEff = calculateLaborEfficiency(workers, deposit.optimalLabor, deposit.maxLabor);
    const efficiency = qualityMult * laborEff;

    const outputPerSlot = deposit.baseOutputPerSlot * efficiency;
    const outputPerDay = outputPerSlot * SLOTS_PER_DAY;

    // Warnings
    if (workers < deposit.optimalLabor) {
      issues.push(`Below optimal workforce (${deposit.optimalLabor})`);
    }
    if (workers > deposit.maxLabor) {
      issues.push(`Exceeds maximum useful workforce (${deposit.maxLabor})`);
    }

    return {
      outputPerSlot,
      outputPerDay,
      efficiency,
      canOperate: true,
      issues,
    };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Simple seeded random for deterministic simulation.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Create a new extraction operation from a deposit.
 */
export function createExtractionOperation(
  deposit: ResourceDeposit,
  operatorId: string,
  operatorType: ExtractionOperation["operatorType"],
  operatorName: string,
  initialWorkers: number = 0
): ExtractionOperation {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    depositId: deposit.id,
    operatorId,
    operatorType,
    operatorName,
    workers: [],
    totalWorkers: initialWorkers,
    workerEfficiency: 1,
    tools: [],
    status: "idle",
    outputThisCycle: 0,
    outputTotal: 0,
    outputDestination: { type: "stockpile" },
    stockpile: {},
    stockpileCapacity: 1000,
    operatingCosts: 0,
    revenue: 0,
    profitMargin: 0,
    startedAt: now,
    lastTickAt: now,
  };
}

/**
 * Apply extraction result to deposit and operation state.
 */
export function applyExtractionResult(
  deposit: ResourceDeposit,
  operation: ExtractionOperation,
  result: ExtractionTickResult
): { deposit: ResourceDeposit; operation: ExtractionOperation } {
  // Update deposit
  const updatedDeposit = { ...deposit };

  if (result.newRemainingReserves !== undefined) {
    updatedDeposit.remainingReserves = result.newRemainingReserves;
  }

  updatedDeposit.totalExtracted = (deposit.totalExtracted || 0) +
    Object.values(result.output).reduce((sum, v) => sum + v, 0);
  updatedDeposit.lastExtractionAt = result.processedAt;
  updatedDeposit.currentOutputPerSlot = Object.values(result.output).reduce((sum, v) => sum + v, 0) / result.slotsProcessed || 0;

  // Update operation
  const updatedOperation = { ...operation };

  updatedOperation.outputThisCycle += Object.values(result.output).reduce((sum, v) => sum + v, 0);
  updatedOperation.outputTotal += Object.values(result.output).reduce((sum, v) => sum + v, 0);
  updatedOperation.operatingCosts += result.totalCost;
  updatedOperation.lastTickAt = result.processedAt;

  if (result.newStatus) {
    updatedOperation.status = result.newStatus as ExtractionOperation["status"];
  }

  // Add to stockpile
  for (const [commodityId, amount] of Object.entries(result.output)) {
    updatedOperation.stockpile[commodityId] = (updatedOperation.stockpile[commodityId] || 0) + amount;
  }

  return { deposit: updatedDeposit, operation: updatedOperation };
}
