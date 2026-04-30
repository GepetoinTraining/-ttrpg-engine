/**
 * MM_WATER — Layer 0 ISimulatedMM adapter for water.ts
 * =======================================================
 *
 * Wraps updateWaterLevel() as an ISimulatedMM. One MMWater per WaterBody.
 * Lives at the .tp node containing the body (typically a region or
 * settlement). Reads weather κ from that node to drive its inputs.
 *
 * Cadence: daily. Layer: 0 (PHYSICAL — alongside weather).
 *
 * - onAccumulate: O(1) — just bumps daysPending.
 * - onResolve: walks daysResolved daily steps, applying updateWaterLevel
 *   each step using the latest weather κ at the node. Writes summary κ.
 *
 * Design note: water level evolves day-by-day, but to keep accumulate cheap
 * we collapse the steps inside resolve. This is correct under the
 * "observation writes" rule — the level only matters when someone looks at
 * it, and we replay the days at observation time.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  updateWaterLevel,
  type WaterBody,
  type WaterLevelState,
  type WaterInputs,
  type WaterBodyType,
} from './water.js'
import type { TP, WaterRules, WeatherRules } from './tp.js'

export interface MMWaterDomainState {
  waterBody: WaterBody
  levelState: WaterLevelState
}

export class MMWater extends SimulatedMMBase {
  domain: MMWaterDomainState

  constructor(
    nodeId: string,
    waterBody: WaterBody,
    initialLevelState: WaterLevelState,
    worldDay: number = 0,
    name?: string,
  ) {
    super(`water:${waterBody.id}`, name ?? `Water:${waterBody.name}`, nodeId, 'water', worldDay)
    this.domain = {
      waterBody,
      levelState: { ...initialLevelState },
    }
  }

  // O(1) — base class handles daysPending.
  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Intentionally empty. Level integration runs in onResolve so that
    // (a) we can read the latest weather κ at observation time, and
    // (b) accumulate stays cheap regardless of cadence frequency.
  }

  protected onResolve(daysResolved: number, _worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const inputs = this.deriveInputsFromKappa(tp)
    const startLevel = this.domain.levelState.level

    // Step the level forward day-by-day. The integration is deterministic
    // given fixed inputs, so collapsing matches per-day evolution exactly.
    let state = this.domain.levelState
    for (let i = 0; i < Math.max(1, daysResolved); i++) {
      state = updateWaterLevel(state, inputs, this.domain.waterBody.type)
    }
    this.domain.levelState = state

    // Write κ — summary keyed by waterBodyId so multiple bodies share the slot.
    if (tp) {
      const water: WaterRules = {
        sources: {
          [this.domain.waterBody.id]: {
            type: this.domain.waterBody.type,
            level: state.level,
            floodStage: state.floodStage,
            fishStock: this.domain.waterBody.fishingYield,
            salinity: this.domain.waterBody.salinity,
            navigable: this.domain.waterBody.navigable,
          },
        },
      }
      tp.writeDomain(this.state.nodeId, 'water', water)
    }

    const delta = state.level - startLevel
    const narrative =
      `${this.state.name} (${daysResolved}d): level ${state.level.toFixed(1)}% ` +
      `(${state.floodStage}), Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}.`

    return {
      stateChanges: {
        level: state.level,
        levelDelta: delta,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMWaterDomainState {
    return {
      waterBody: { ...this.domain.waterBody },
      levelState: { ...this.domain.levelState },
    }
  }

  // ── Helpers ──

  /** Convenience: peek the current level state without resolving. */
  getLevelState(): WaterLevelState {
    return { ...this.domain.levelState }
  }

  /**
   * Translate weather κ at this node into WaterInputs.
   * Defaults to "average day" inputs if no weather κ is set.
   */
  private deriveInputsFromKappa(tp?: TP): WaterInputs {
    const ctx = tp?.resolve(this.state.nodeId)
    const weather: WeatherRules = (ctx?.weather as WeatherRules) ?? {}

    return {
      rainfall: precipitationToRainfall(weather.precipitation),
      snowmelt: snowmeltFor(weather.season, weather.temperature),
      evaporation: evaporationFor(weather.temperature),
      // Upstream inflow not modeled yet — would require a water-graph.
      upstreamInflow: 0,
    }
  }
}

// ── Weather → WaterInputs translation ──

function precipitationToRainfall(p: WeatherRules['precipitation']): number {
  switch (p) {
    case 'none':        return 0
    case 'light_rain':
    case 'light_snow':  return 0.5
    case 'rain':
    case 'snow':        return 1.0
    case 'heavy_rain':  return 2.0
    case 'storm':
    case 'blizzard':    return 3.0
    case 'fog':
    case 'hail':        return 0.3
    // No weather κ set → no rainfall. Evaporation + drainage dominate,
    // matching the "dry default" intuition.
    default:            return 0
  }
}

function snowmeltFor(season: WeatherRules['season'], temperatureF: number | undefined): number {
  if (season === 'spring' && (temperatureF ?? 50) > 40) return 1.5
  if (season === 'summer') return 0.2  // residual high-altitude melt
  return 0
}

function evaporationFor(temperatureF: number | undefined): number {
  const t = temperatureF ?? 60
  if (t > 80) return 2.0
  if (t > 60) return 1.0
  if (t > 40) return 0.7
  return 0.5
}

// ── Re-exports for callers ──
export type { WaterBody, WaterLevelState, WaterBodyType } from './water.js'
