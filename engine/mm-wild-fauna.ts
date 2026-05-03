/**
 * MM_WILD_FAUNA — Layer 5 ECOLOGY adapter for engine/wild-fauna.ts
 * ====================================================================
 *
 * One MMWildFauna per region node. Owns ALL wild herds at that region.
 * Daily cadence. Each resolve folds N days of:
 *
 *   1. Lazy-spawn herds from biome.fauna pool on first resolve
 *      (deterministic from worldSeed + regionNodeId — observation creates state)
 *   2. mfHerdGraze for each at-node herd (with floraSupply derived from biome)
 *   3. mfHerdMigrate for each migrating herd (driven by edge state on the herd)
 *   4. Drop decimated herds (population < minViable) on resolve
 *
 * Reads:
 *   κ.ecology.herds at the region — used to hydrate herd state across resolves
 *
 * Writes:
 *   κ.ecology.herds at the region — projects current herd map for cross-system
 *   reads (predator MMs, hub UIs, player observation). Audited via attachWriteLog.
 *
 * Cadence: daily. Layer: 5 (ECOLOGY).
 *
 * Phase 2 wiring of Δ.0.5. The autonomous side. Player intents (hunt / trap /
 * tame / domesticate) flow through engine-client wrappers and writeKappa
 * actions — not handled here.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  type WildHerd,
  type Formation,
  type HerdStatus,
  speciesByBiome,
  getSpecies,
} from './wild-fauna'
import { mfHerdGraze, mfHerdMigrate } from './mf-herd-life'
import type { TP, EcologyRules } from './tp'
import { SeededRNG } from './hub-topology'

// ============================================================
// MM_WILD_FAUNA STATE
// ============================================================

export interface MMWildFaunaDomainState {
  regionNodeId: string
  biome: string
  worldSeed: string
  /** Local mirror of κ.ecology.herds for this region. */
  herds: WildHerd[]
  /** Daily flora supply available across the region (units / day). */
  floraPerDay: number
  cumulative: {
    resolveCount: number
    births: number
    deaths: number
    migrations: number
    decimations: number
  }
  lastResolvedDay: number
}

export interface MMWildFaunaOptions {
  regionNodeId: string
  /** BiomeType string (e.g. 'forest', 'plains') — determines eligible species. */
  biome: string
  /** Stable seed for deterministic spawning. */
  worldSeed: string
  /** Initial world day. */
  worldDay?: number
  /**
   * Daily flora supply for the whole region (units / day). Defaults to 100.
   * Future Phase 3: derive from biome density × region size × season.
   */
  floraPerDay?: number
  /** Maximum number of distinct herd species to spawn at this region. Default 3. */
  maxSpecies?: number
  /** Baseline miles per day for migrating herds. Default 5. */
  baseMilesPerDay?: number
}

// ============================================================
// MM_WILD_FAUNA
// ============================================================

export class MMWildFauna extends SimulatedMMBase {
  domain: MMWildFaunaDomainState
  private maxSpecies: number
  private baseMilesPerDay: number

  constructor(opts: MMWildFaunaOptions) {
    const id = `wild_fauna:${opts.regionNodeId}`
    const name = `Wild Fauna @ ${opts.regionNodeId}`
    const worldDay = opts.worldDay ?? 0
    super(id, name, opts.regionNodeId, 'wild_fauna', worldDay)

    this.domain = {
      regionNodeId: opts.regionNodeId,
      biome: opts.biome,
      worldSeed: opts.worldSeed,
      herds: [],
      floraPerDay: opts.floraPerDay ?? 100,
      cumulative: {
        resolveCount: 0, births: 0, deaths: 0, migrations: 0, decimations: 0,
      },
      lastResolvedDay: worldDay,
    }
    this.maxSpecies = opts.maxSpecies ?? 3
    this.baseMilesPerDay = opts.baseMilesPerDay ?? 5
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Cheap — just track days. Real folding happens on resolve.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N days of grazing / migration
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // Hydrate from κ if available — κ is the cross-request canonical view.
    if (tp) {
      const ctx = tp.resolve(this.domain.regionNodeId)
      const eco = ctx?.ecology as EcologyRules | undefined
      if (eco?.herds) {
        const fromKappa: WildHerd[] = []
        for (const id in eco.herds) {
          fromKappa.push(eco.herds[id] as WildHerd)
        }
        if (fromKappa.length > 0) {
          this.domain.herds = fromKappa
        }
      }
    }

    // Lazy-spawn on first resolve if still empty.
    if (this.domain.herds.length === 0) {
      this.domain.herds = this.lazySpawnHerds(worldDay)
    }

    if (daysResolved === 0 || this.domain.herds.length === 0) {
      this.domain.cumulative.resolveCount += 1
      this.domain.lastResolvedDay = worldDay
      return {
        stateChanges: {
          resolveCount: 1, herds: this.domain.herds.length,
          births: 0, deaths: 0, migrations: 0, decimations: 0,
        },
        narrative: `${this.state.name}: no fold (days=${daysResolved}, herds=${this.domain.herds.length}).`,
        additionalEvents: [],
      }
    }

    // Per-herd flora share — split evenly across at-node herds for the fold.
    const atNodeHerds = this.domain.herds.filter((h) => h.edgeId === null)
    const sharePerHerd =
      atNodeHerds.length > 0
        ? (this.domain.floraPerDay * daysResolved) / atNodeHerds.length
        : 0

    const updatedHerds: WildHerd[] = []
    let totalBirths = 0
    let totalDeaths = 0
    let migrationsArrived = 0
    let decimations = 0

    for (const herd of this.domain.herds) {
      const species = getSpecies(herd.speciesId)
      let current = herd

      // GRAZE — at-node herds only (migrating/fleeing herds eat on the move
      // via formation forage modifier, but flora supply is regional, so we
      // keep mfHerdGraze focused on grazing/starving herds at the node).
      if (current.edgeId === null) {
        const grazeRes = mfHerdGraze(current, species, {
          days: daysResolved,
          worldDay,
          floraAvailable: sharePerHerd,
        })
        current = grazeRes.output.herdAfter
        if (grazeRes.output.populationDelta > 0) {
          totalBirths += grazeRes.output.populationDelta
        } else if (grazeRes.output.populationDelta < 0) {
          totalDeaths += -grazeRes.output.populationDelta
        }
      }

      // MIGRATE — only if currently on an edge with viable population.
      if (current.edgeId !== null && current.population >= species.minViable) {
        const dest = current.destinationNodeId ?? current.currentNodeId
        const migRes = mfHerdMigrate(current, species, {
          days: daysResolved,
          worldDay,
          edgeId: current.edgeId,
          edgeTotalMiles: current.edgeTotalMiles,
          destinationNodeId: dest,
          baseMilesPerDay: this.baseMilesPerDay,
        })
        current = migRes.output.herdAfter
        if (migRes.output.arrived) migrationsArrived += 1
      }

      if (current.status === 'decimated') {
        decimations += 1
      }
      // Keep the herd row even when decimated — UI may want to surface the
      // collapse for one resolve cycle. The next observation will see
      // status=decimated and the surface drops it.
      updatedHerds.push(current)
    }

    this.domain.herds = updatedHerds
    this.domain.cumulative.resolveCount += 1
    this.domain.cumulative.births += totalBirths
    this.domain.cumulative.deaths += totalDeaths
    this.domain.cumulative.migrations += migrationsArrived
    this.domain.cumulative.decimations += decimations
    this.domain.lastResolvedDay = worldDay

    // Project to κ.ecology.herds for cross-system reads.
    if (tp) {
      const herdMap: Record<string, WildHerd> = {}
      for (const h of updatedHerds) herdMap[h.id] = h
      tp.writeDomain(this.domain.regionNodeId, 'ecology', {
        herds: herdMap,
      } as EcologyRules)
    }

    return {
      stateChanges: {
        resolveCount: 1,
        herds: updatedHerds.length,
        births: totalBirths,
        deaths: totalDeaths,
        migrations: migrationsArrived,
        decimations,
      },
      narrative:
        `${this.state.name} (${daysResolved}d): ${updatedHerds.length} herds — ` +
        `+${totalBirths} births, -${totalDeaths} deaths, ` +
        `${migrationsArrived} migrations, ${decimations} decimated.`,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMWildFaunaDomainState {
    return {
      ...this.domain,
      herds: this.domain.herds.map((h) => ({ ...h })),
      cumulative: { ...this.domain.cumulative },
    }
  }

  // ────────────────────────────────────────────
  // LAZY SPAWN — observation creates state
  // ────────────────────────────────────────────

  /**
   * Pick 1..maxSpecies eligible species for this biome and spawn a herd of
   * each at species.baseHerdSize ± jitter. Deterministic from
   * (worldSeed, regionNodeId).
   */
  private lazySpawnHerds(worldDay: number): WildHerd[] {
    const eligible = speciesByBiome(this.domain.biome)
    if (eligible.length === 0) return []

    const rng = new SeededRNG(
      `wild-fauna:lazy:${this.domain.worldSeed}:${this.domain.regionNodeId}`,
    )
    const n = Math.max(1, Math.min(this.maxSpecies, 1 + Math.floor(rng.next() * this.maxSpecies)))
    const shuffled = rng.shuffle([...eligible])
    const picked = shuffled.slice(0, Math.min(n, shuffled.length))

    return picked.map((sp) => {
      const popJitter = 0.85 + rng.next() * 0.3 // ±15%
      const population = Math.max(sp.minViable, Math.floor(sp.baseHerdSize * popJitter))
      const formation: Formation = 'spread'
      const status: HerdStatus = 'grazing'
      return {
        id: `${this.domain.regionNodeId}:${sp.id}`,
        speciesId: sp.id,
        currentNodeId: this.domain.regionNodeId,
        destinationNodeId: null,
        edgeId: null,
        edgeMile: 0,
        edgeTotalMiles: 0,
        population,
        daysHungry: 0,
        foodSecurity: 1.0,
        formation,
        status,
        bornDay: worldDay,
        lastTransitionDay: worldDay,
      }
    })
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  getHerds(): WildHerd[] {
    return this.domain.herds
  }

  getHerd(speciesId: string): WildHerd | undefined {
    return this.domain.herds.find((h) => h.speciesId === speciesId)
  }

  /**
   * Inject or replace a herd directly — used by callers that want to set up
   * a specific scenario (e.g. test fixtures, a player-side trap reducing
   * herd by 1, an explicit migration trigger from another MM).
   */
  setHerd(herd: WildHerd): void {
    const idx = this.domain.herds.findIndex((h) => h.id === herd.id)
    if (idx >= 0) {
      this.domain.herds[idx] = herd
    } else {
      this.domain.herds.push(herd)
    }
  }

  removeHerd(herdId: string): boolean {
    const before = this.domain.herds.length
    this.domain.herds = this.domain.herds.filter((h) => h.id !== herdId)
    return this.domain.herds.length < before
  }
}
