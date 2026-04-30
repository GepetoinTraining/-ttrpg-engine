/**
 * MM_WEATHER — Layer 0 ISimulatedMM adapter for weather.ts
 * ==========================================================
 *
 * Wraps the existing weeklyWeatherTick() function as an ISimulatedMM so
 * Clockwork can drive it. Lives at a region or settlement .tp node.
 *
 * Cadence: weekly. Layer: 0 (PHYSICAL — no upstream dependencies).
 *
 * - onAccumulate: O(1) — just track daysPending. Weather is regenerated
 *   wholesale on resolve, not deltas.
 * - onResolve: generate fresh WeatherState for the current world day,
 *   write the resulting κ to the .tp node, return narrative.
 *
 * The weather κ at a node represents "what the weather IS right now."
 * Because it's regenerated on each observation, players see the current
 * weather, not an integration of every week since they last visited.
 * (If we wanted historical weather, we'd append to a tpb instead.)
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  weeklyWeatherTick,
  type Climate,
  type WeatherState,
  type WeatherModifiers,
} from './weather.js'
import type { TP, WeatherRules } from './tp.js'

export interface MMWeatherDomainState {
  climate: Climate
  /** Latest generated weather state — null until first resolve */
  lastWeather: WeatherState | null
  /** Latest computed modifiers — null until first resolve */
  lastModifiers: WeatherModifiers | null
  /** World day of latest resolve */
  lastResolvedDay: number
}

export class MMWeather extends SimulatedMMBase {
  domain: MMWeatherDomainState

  constructor(
    nodeId: string,
    climate: Climate,
    worldDay: number = 0,
    name?: string,
  ) {
    super(`weather:${nodeId}`, name ?? `Weather:${nodeId}`, nodeId, 'weather', worldDay)
    this.domain = {
      climate,
      lastWeather: null,
      lastModifiers: null,
      lastResolvedDay: worldDay,
    }
  }

  // O(1) — weather just counts days. The actual generation happens on resolve.
  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Intentionally empty. Base class already incremented daysPending.
    // Weather doesn't have a meaningful "delta" — each observation is a
    // fresh generation. If we wanted seasonal drift, we'd add it here.
  }

  // Expensive — generates fresh weather, writes κ, returns narrative.
  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const result = weeklyWeatherTick(this.domain.climate, worldDay)
    this.domain.lastWeather = result.weather
    this.domain.lastModifiers = result.modifiers
    this.domain.lastResolvedDay = worldDay

    // Write κ to the .tp node — typed via writeDomain when tp is available.
    if (tp) {
      const weatherKappa: WeatherRules = {
        climate: this.domain.climate,
        season: result.weather.season,
        temperature: result.weather.temperature,
        precipitation: result.weather.precipitation,
        wind: result.weather.wind,
        visibility: result.weather.visibility,
        severity: result.weather.severity,
        modifiers: {
          yieldModifier: result.modifiers.yieldMultiplier,
          travelSpeed: result.modifiers.travelSpeedMultiplier,
          monsterActivity: result.modifiers.monsterActivityMultiplier,
          spoilageRate: result.modifiers.spoilageMultiplier,
          starvationModifier: result.modifiers.starvationModifier,
          combatEffects: result.modifiers.combatEffects,
        },
      }
      tp.writeDomain(this.state.nodeId, 'weather', weatherKappa)
    }

    const w = result.weather
    const narrative =
      `${this.state.name} (${daysResolved}d): ${w.season}, ${w.temperature}°F, ` +
      `${w.precipitation}, ${w.wind} wind, severity ${w.severity.toFixed(2)}.`

    return {
      stateChanges: {
        temperature: w.temperature,
        severity: w.severity,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMWeatherDomainState {
    return {
      climate: this.domain.climate,
      lastWeather: this.domain.lastWeather,
      lastModifiers: this.domain.lastModifiers,
      lastResolvedDay: this.domain.lastResolvedDay,
    }
  }

  /** Convenience: peek the last generated weather without resolving again. */
  getLastWeather(): WeatherState | null {
    return this.domain.lastWeather
  }
}
