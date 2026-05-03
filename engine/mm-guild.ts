/**
 * MM_GUILD — Layer 5 ISimulatedMM adapter for guild.ts (one per chapter)
 * =========================================================================
 *
 * The Adventurer's Guild is the world's PROBLEM-SOLVER and DM-SUBSTITUTE.
 * Per Pedro: "the main quest giver and DM for players without a DM."
 *
 * One MMGuild per `GuildChapter`. Lives at the chapter's hub. Weekly
 * cadence. Each resolve folds N weeks of:
 *
 *   1. Auto-generate quests from town κ — if the board is thin, read
 *      `κ.economy / .ecology / .infrastructure / .knowledge / .faction /
 *      .weather` at the hub and synthesize a quest from the most pressing
 *      need. Smithy stuck at master tier needing mythril → "retrieve mythril"
 *      goes on the board. High danger level → "bounty on gnoll pack."
 *
 *   2. tickGuildChapter — existing weekly logic: expire stale jobs, match
 *      idle parties to open jobs, file intel from returned parties,
 *      propagate intel between chapters, collect dues.
 *
 *   3. (optional) digest caravan-borne rumors as additional intel —
 *      caller pushes arrivals via `enqueueCaravanArrival()`.
 *
 * Writes:
 *   κ.guild.chapters[hubId] — the canonical projection of guild presence
 *   at the hub: type, member count, treasury, reputation, job counters.
 *   κ.guild.intel — recent threats / rumors (subset, capped).
 *
 * Reads (transitively via guild-quest-generator):
 *   κ.economy.commodities, κ.economy.tradeModifier
 *   κ.ecology.dangerLevel, κ.ecology.dominantThreats
 *   κ.faction.contested
 *   κ.weather.modifiers.starvationModifier
 *   κ.knowledge.potentials
 *   κ.infrastructure.professions
 *
 * Cadence: weekly. Layer: 5 (ECOLOGY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  type Guild,
  type GuildChapter,
  type GuildType,
  type NPCAdventurerParty,
  type GuildJob,
  digestCaravanArrival,
  type CaravanArrivalDigest,
  type DigestResult,
  tickGuildChapter,
} from './guild'
import {
  generateQuestForChapter,
  isJobBoardThin,
  type TownNeed,
} from './guild-quest-generator'
import type { TP, GuildRules } from './tp'

// ============================================================
// HELPERS
// ============================================================

/** Map our internal GuildType union → the κ.guild.chapters.type enum. */
function mapTypeToKappa(t: GuildType): 'adventurer' | 'merchant' | 'thieves' | 'mage' | 'craft' {
  switch (t) {
    case 'adventurers': return 'adventurer'
    case 'merchant':    return 'merchant'
    case 'mage':        return 'mage'
    case 'thieves':     return 'thieves'
    case 'artisan':     return 'craft'
    case 'religious':   return 'craft'   // closest fit; refine when religion guilds get distinct κ
  }
}

// ============================================================
// MM_GUILD STATE
// ============================================================

export interface MMGuildDomainState {
  guild: Guild
  /** This MM is bound to ONE chapter. The chapter's hub is state.nodeId. */
  chapterNodeId: string
  /** NPC parties registered to this chapter. */
  parties: NPCAdventurerParty[]
  /** Caravan arrivals awaiting digestion at the next resolve. */
  pendingArrivals: CaravanArrivalDigest[]
  /** Cumulative stats across all resolves. */
  cumulative: {
    weeksTicked: number
    questsGenerated: number
    jobsExpired: number
    jobsMatched: number
    intelFiled: number
    duesCollected: number
    rumorsDigested: number
  }
  /** Most recent quest synthesis result (for narrative). */
  lastNeed: TownNeed | null
  lastJob: GuildJob | null
}

export interface MMGuildOptions {
  /** Pre-existing parties registered to this chapter. */
  parties?: NPCAdventurerParty[]
  /** Override the default name. */
  name?: string
  /** d20 supplier — defaults to a deterministic pool keyed off worldDay. */
  getD20?: (worldDay: number, salt: number) => number
}

// ============================================================
// MM_GUILD
// ============================================================

export class MMGuild extends SimulatedMMBase {
  domain: MMGuildDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(
    guild: Guild,
    chapterNodeId: string,
    worldDay: number = 0,
    opts: MMGuildOptions = {},
  ) {
    const id = `guild_chapter:${guild.id}:${chapterNodeId}`
    const name = opts.name ?? `${guild.name}@${chapterNodeId}`
    super(id, name, chapterNodeId, 'guild', worldDay)

    this.domain = {
      guild,
      chapterNodeId,
      parties: opts.parties ?? [],
      pendingArrivals: [],
      cumulative: {
        weeksTicked: 0, questsGenerated: 0, jobsExpired: 0, jobsMatched: 0,
        intelFiled: 0, duesCollected: 0, rumorsDigested: 0,
      },
      lastNeed: null,
      lastJob: null,
    }

    this.getD20 = opts.getD20
      ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  /**
   * Register this chapter as an entity in the TP entity registry. Call
   * once after construction so `tp.getEntitiesAt(hubId)` returns the
   * chapter (mirrors the pattern from mm-banking / mm-husbandry).
   */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'guild_chapter',
      position: { type: 'at_node', nodeId: this.state.nodeId },
    })
  }

  /** Attach (or replace) the parties registered to this chapter. */
  setParties(parties: NPCAdventurerParty[]): void {
    this.domain.parties = parties
  }

  /** Add a party to the registered set. */
  addParty(party: NPCAdventurerParty): void {
    this.domain.parties.push(party)
  }

  /**
   * Queue a caravan arrival to be digested into intel at the next resolve.
   * Called by `mm-caravan` (or surfaces) when a caravan unloads at this
   * chapter's hub.
   */
  enqueueCaravanArrival(arrival: CaravanArrivalDigest): void {
    this.domain.pendingArrivals.push(arrival)
  }

  /** Convenience: read access for surfaces. */
  getChapter(): GuildChapter | undefined {
    return this.domain.guild.chapters.find(c => c.nodeId === this.domain.chapterNodeId)
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // The guild does no work between observations. Ticks are free.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N weeks
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const chapter = this.getChapter()
    const weeks = Math.floor(daysResolved / 7)

    if (!chapter || weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): ${chapter ? 'no full week elapsed' : 'chapter not found'}.`,
        additionalEvents: [],
      }
    }

    let questsGenerated = 0
    let jobsExpired = 0
    let jobsMatched = 0
    let intelFiled = 0
    let duesCollected = 0
    let rumorsDigested = 0
    let lastNeed: TownNeed | null = null
    let lastJob: GuildJob | null = null

    for (let w = 0; w < weeks; w++) {
      const weekDay = worldDay - daysResolved + (w + 1) * 7

      // 1. Auto-generate quest from town κ if board is thin
      if (tp && isJobBoardThin(this.domain.guild, this.domain.chapterNodeId)) {
        const result = generateQuestForChapter({
          tp,
          guild: this.domain.guild,
          chapter,
          hubNodeId: this.state.nodeId,
          worldDay: weekDay,
          d20: this.getD20(weekDay, 1),
        })
        if (result.job) {
          questsGenerated++
          lastJob = result.job
          lastNeed = result.pickedNeed
        }
      }

      // 2. Tick the chapter (jobs lifecycle + intel + dues)
      const tickResult = tickGuildChapter(
        this.domain.guild,
        this.domain.chapterNodeId,
        this.domain.parties,
        weekDay,
      )
      jobsExpired += tickResult.jobsExpired
      jobsMatched += tickResult.jobsMatched
      intelFiled += tickResult.intelFiled
      duesCollected += tickResult.duesCollected
    }

    // 3. Digest pending caravan arrivals (run once per resolve, not per week)
    if (this.domain.pendingArrivals.length > 0) {
      for (const arrival of this.domain.pendingArrivals) {
        const digest: DigestResult = digestCaravanArrival(arrival, chapter, worldDay)
        rumorsDigested += digest.rumorsConsumed
      }
      this.domain.pendingArrivals = []
    }

    // 4. Update cumulative + last-* state
    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.questsGenerated += questsGenerated
    this.domain.cumulative.jobsExpired += jobsExpired
    this.domain.cumulative.jobsMatched += jobsMatched
    this.domain.cumulative.intelFiled += intelFiled
    this.domain.cumulative.duesCollected += duesCollected
    this.domain.cumulative.rumorsDigested += rumorsDigested
    if (lastNeed) this.domain.lastNeed = lastNeed
    if (lastJob) this.domain.lastJob = lastJob

    // 5. Write κ.guild.chapters[hubId]
    if (tp) {
      const openJobs = this.domain.guild.jobBoard.filter(
        j => j.status === 'open' && j.chapterNodeId === this.domain.chapterNodeId,
      ).length
      const activeJobs = this.domain.guild.jobBoard.filter(
        j => (j.status === 'claimed' || j.status === 'in_progress') && j.chapterNodeId === this.domain.chapterNodeId,
      ).length
      const completedJobs = this.domain.guild.jobBoard.filter(
        j => j.status === 'completed' && j.chapterNodeId === this.domain.chapterNodeId,
      ).length

      // Cap intel arrays so κ doesn't bloat over time
      const recentSightings = chapter.intelligence.threatReports
        .slice(-20)
        .map(t => `${t.sighting.speciesId}@${t.edgeId}`)
      const recentRumors = chapter.intelligence.knownSites
        .slice(-20)
        .map(s => `${s.siteName}@${s.edgeId}`)

      const kappa: GuildRules = {
        chapters: {
          [this.domain.chapterNodeId]: {
            type: mapTypeToKappa(this.domain.guild.type),
            members: this.domain.parties.length,
            treasury: this.domain.guild.treasury,
            reputation: chapter.reputation,
            jobs: {
              posted: openJobs,
              active: activeJobs,
              completed: completedJobs,
            },
          },
        },
        intel: {
          sightings: recentSightings,
          rumors: recentRumors,
        },
      }
      tp.writeDomain(this.state.nodeId, 'guild', kappa)
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} wks): ` +
      `${questsGenerated} quests posted, ${jobsMatched} matched, ${jobsExpired} expired, ` +
      `${intelFiled} intel filed, ${duesCollected}gp dues, ${rumorsDigested} rumors digested.` +
      (lastNeed ? ` Latest concern: ${lastNeed.description}.` : '')

    return {
      stateChanges: {
        weeksTicked: weeks,
        questsGenerated,
        jobsExpired,
        jobsMatched,
        intelFiled,
        duesCollected,
        rumorsDigested,
        openJobs: this.domain.guild.jobBoard.filter(j => j.status === 'open').length,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMGuildDomainState {
    return {
      guild: { ...this.domain.guild },
      chapterNodeId: this.domain.chapterNodeId,
      parties: this.domain.parties.map(p => ({ ...p })),
      pendingArrivals: this.domain.pendingArrivals.map(a => ({ ...a })),
      cumulative: { ...this.domain.cumulative },
      lastNeed: this.domain.lastNeed,
      lastJob: this.domain.lastJob,
    }
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  /** Total open jobs at this chapter — useful for surface displays. */
  openJobCount(): number {
    return this.domain.guild.jobBoard.filter(
      j => j.status === 'open' && j.chapterNodeId === this.domain.chapterNodeId,
    ).length
  }
}
