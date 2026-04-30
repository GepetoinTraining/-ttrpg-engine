/**
 * MM/MF TYPE SYSTEM — TTRPG Engine
 * =================================
 * 
 * Ported from ManifoldSystems/src/engine/types/mf.ts
 * Adapted for D&D 5e RPG computation.
 * 
 * MFₙˣ = [x, κ; κ, x]   — the function (runs)
 * MMₙˣ = [MF₁, MF₂/κ; MF₂/κ, MF₁⁺]  — the container (holds)
 * 
 * Three deltas: Δᵖ (potential), Δᴬ (archival), Δω (intermediate)
 * Container pays for time. Contained pays for construction.
 */

import { z } from 'zod'

// ============================================================
// CYCLE DELTA
// ============================================================

/**
 * The three delta types produced by every cycle.
 *
 * Δᵖ  = potential change (propagates to container)
 * Δᴬ  = archival change (crystallized or eroded — permanent)
 * Δω  = intermediate work (local to the MF, managed by container)
 */
export const CycleDeltaSchema = z.object({
  potential: z.number(),   // Δᵖ
  archival: z.number(),    // Δᴬ
  omega: z.number(),       // Δω
})
export type CycleDelta = z.infer<typeof CycleDeltaSchema>

export const ZERO_DELTA: CycleDelta = { potential: 0, archival: 0, omega: 0 }

// ============================================================
// MF STATE — The atomic function [x, κ; κ, x]
// ============================================================

/**
 * MF — Simple Manifold (the function).
 *
 * MFₙˣ = [x, κ; κ, x]
 *
 * n = prime address (id)
 * x = undetermined coordinate (current state)
 * κ = crystallized constant (the rules that don't change)
 *
 * An MF cycles at its own temporal scale.
 * It produces Δω locally. Its container aggregates.
 */
export const MFStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  kappa: z.number(),          // κ — crystallized constant
  x: z.number(),              // undetermined coordinate
  tickIndex: z.number().int().nonnegative(),
  accumulatedDelta: CycleDeltaSchema,
  residual: z.number(),       // accumulated potential from flow ticks
})
export type MFState = z.infer<typeof MFStateSchema>

// ============================================================
// MF TICK OUTPUT
// ============================================================

/**
 * What an MF produces when it ticks.
 *
 * output matrix: [1, t₀; t₁, 0]
 * - [1, t₀]: unity at current time (EXISTS now)
 * - [t₁, 0]: next time, zero potential remaining
 */
export const MFTickOutputSchema = z.object({
  mfId: z.string(),
  tickIndex: z.number(),
  delta: CycleDeltaSchema,
  output: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  residual: z.number(),
})
export type MFTickOutput = z.infer<typeof MFTickOutputSchema>

// ============================================================
// MM STATE — The container [MF₁, MF₂/κ; MF₂/κ, MF₁⁺]
// ============================================================

/**
 * MM — Manifold Matrix (the container).
 *
 * Contains MFs or other MMs. Settles at its own scale.
 * The container provides time to its children.
 * The container manages Δω cost.
 * The container decides when mass injection is needed.
 */
export const MMStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  childIds: z.array(z.string()),   // ordered children (MF or MM ids)
  childDeltas: z.array(CycleDeltaSchema),
  flowIntact: z.boolean(),
  potential: z.number(),           // available potential for injection
  settleIndex: z.number().int().nonnegative(),
  lastDeltaP: z.number(),          // most recent aggregate Δᵖ
})
export type MMState = z.infer<typeof MMStateSchema>

// ============================================================
// FLOW BREAK SIGNAL
// ============================================================

/**
 * Signal emitted when an MM detects its flow is breaking.
 * The container sees Δᵖ drifting negative and decides to act.
 */
export const FlowBreakSignalSchema = z.object({
  mmId: z.string(),
  drift: z.number(),
  consecutiveNegative: z.number().int(),
  requiredInjection: z.number(),
})
export type FlowBreakSignal = z.infer<typeof FlowBreakSignalSchema>

// ============================================================
// HELPERS
// ============================================================

export function addDeltas(a: CycleDelta, b: CycleDelta): CycleDelta {
  return {
    potential: a.potential + b.potential,
    archival: a.archival + b.archival,
    omega: a.omega + b.omega,
  }
}

export function createMF(id: string, name: string): MFState {
  return {
    id,
    name,
    kappa: 0,
    x: 0,
    tickIndex: 0,
    accumulatedDelta: { ...ZERO_DELTA },
    residual: 0,
  }
}

export function createMM(id: string, name: string, childIds: string[]): MMState {
  return {
    id,
    name,
    childIds,
    childDeltas: [],
    flowIntact: true,
    potential: 0,
    settleIndex: 0,
    lastDeltaP: 0,
  }
}

// ============================================================
// RPG-SPECIFIC TYPES
// ============================================================

/**
 * Receipt — the proof that falls out of the forward computation.
 * Every MF produces an output O AND a receipt R.
 * R is not computed separately — it's a structural consequence
 * of the anti-diagonal symmetric matrix [x, K; K, x].
 */
export const ReceiptSchema = z.object({
  mfId: z.string(),
  tick: z.number().int(),
  input: z.unknown(),        // I — what went in
  output: z.unknown(),       // O — what came out
  verification: z.unknown(), // R — proof that O was correctly derived from I
  timestamp: z.number(),
})
export type Receipt = z.infer<typeof ReceiptSchema>

/**
 * TPB Entry — a single entry in the backward topology.
 * Every transformation is recorded. Every state is a checkpoint.
 * The .tpb only grows. Entries are never modified or deleted.
 */
export const TPBEntrySchema = z.object({
  delta: z.unknown().nullable(),  // Δ — the transformation applied (null for initial)
  state: z.unknown(),              // complete state at this point
  tick: z.number().int(),
  receipt: ReceiptSchema.optional(),
  timestamp: z.number(),
})
export type TPBEntry = z.infer<typeof TPBEntrySchema>
