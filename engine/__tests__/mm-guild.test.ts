/**
 * MM_GUILD — Adapter tests
 * ==========================
 * Verifies one MMGuild per chapter, weekly fold, quest auto-generation
 * from town κ, intel digestion from caravan arrivals, and κ.guild writes.
 */

import { describe, it, expect } from 'vitest'
import { TP, type WorldNode, type GuildRules } from '../tp'
import { MMGuild } from '../mm-guild'
import {
  createGuild,
  createNPCParty,
  resetGuildIdCounter,
  resetPartyIdCounter,
  resetJobIdCounter,
  type CaravanArrivalDigest,
} from '../guild'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region',     name: 'Sword Coast', parentId: null,         dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
    { id: 'phandalin',   type: 'settlement', name: 'Phandalin',   parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function fresh() {
  resetGuildIdCounter()
  resetPartyIdCounter()
  resetJobIdCounter()
}

describe('MMGuild — construction', () => {
  it('uses chapter:hubId for stable identity', () => {
    fresh()
    const guild = createGuild('Adventurers Guild — Thundertree', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)
    expect(mm.state.id).toBe('guild_chapter:guild_1:thundertree')
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('guild')
  })

  it('registerWith places the chapter in the entity registry', () => {
    fresh()
    const tp = makeTP()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)
    mm.registerWith(tp)
    const entities = tp.getEntitiesAt('thundertree')
    expect(entities.length).toBe(1)
    expect(entities[0].type).toBe('guild_chapter')
  })
})

describe('MMGuild — quest auto-generation from town κ', () => {
  it('on resolve, posts a quest matching the top town need', () => {
    fresh()
    const tp = makeTP()
    // Set up a master weaponsmith with no mythril — Pedro's example
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { weaponsmith: { count: 1, tier: 'master' } },
    })
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)

    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7, tp)

    expect(result.stateChanges.questsGenerated).toBe(1)
    // Quest should be on the board
    expect(guild.jobBoard.length).toBe(1)
    expect(guild.jobBoard[0].targetId).toBe('mythril')
    expect(guild.jobBoard[0].type).toBe('retrieve')
  })

  it('multi-week resolves only post quests until the board is healthy', () => {
    fresh()
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', {
      dangerLevel: 0.7,
      dominantThreats: ['gnoll_pack'],
    })
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)

    // 6 weeks → enough to fill the board past threshold
    mm.accumulatePotential(42, 42)
    const result = mm.resolve(42, tp)

    // The threshold is 3 open jobs — after 3 the loop stops generating
    expect(result.stateChanges.questsGenerated).toBeLessThanOrEqual(3)
    expect(result.stateChanges.questsGenerated).toBeGreaterThan(0)
  })

  it('does NOT generate a quest when town has no κ signal', () => {
    fresh()
    const tp = makeTP()  // empty κ
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)

    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7, tp)
    expect(result.stateChanges.questsGenerated).toBe(0)
    expect(guild.jobBoard.length).toBe(0)
  })

  it('Pedro\'s example: smithy at master needs mythril → posts retrieve quest', () => {
    fresh()
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { weaponsmith: { count: 1, tier: 'master' } },
    })
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const dom = mm.serialize().domain as ReturnType<MMGuild['getDomainState']>
    expect(dom.lastNeed?.kind).toBe('profession_bottleneck')
    expect(dom.lastJob?.targetId).toBe('mythril')
  })
})

describe('MMGuild — κ writes', () => {
  it('writes κ.guild.chapters[hubId] with current chapter state', () => {
    fresh()
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.7, dominantThreats: ['orc_warband'] })
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)

    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('thundertree')
    const guildKappa = ctx?.guild as GuildRules | undefined
    expect(guildKappa).toBeDefined()
    expect(guildKappa!.chapters?.thundertree).toBeDefined()
    expect(guildKappa!.chapters!.thundertree!.type).toBe('adventurer')
    expect(guildKappa!.chapters!.thundertree!.jobs?.posted).toBeGreaterThan(0)
  })

  it('intel sightings ride into κ.guild.intel.sightings', () => {
    fresh()
    const tp = makeTP()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const chapter = guild.chapters[0]
    chapter.intelligence.threatReports.push({
      edgeId: 'high_road',
      sighting: { speciesId: 'goblin', estimatedCount: 10, behaviorState: 'patrol', mileMarker: 5, threatLevel: 4 },
      reportedDay: 1,
    })
    const mm = new MMGuild(guild, 'thundertree', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)
    const ctx = tp.resolve('thundertree')
    const intel = (ctx?.guild as GuildRules | undefined)?.intel
    expect(intel?.sightings).toContain('goblin@high_road')
  })
})

describe('MMGuild — caravan arrival ingestion', () => {
  it('digests rumors into chapter intel on resolve', () => {
    fresh()
    const tp = makeTP()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)

    const arrival: CaravanArrivalDigest = {
      edgeId: 'high_road',
      rumorsSpread: [
        { topic: 'orc_raiders', category: 'monster', accuracy: 0.8, fidelity: 0.9 },
        { topic: 'lost_temple', category: 'geography', accuracy: 0.6, fidelity: 0.7 },
        { topic: 'royal_decree', category: 'politics', accuracy: 1.0, fidelity: 1.0 },
      ],
    }
    mm.enqueueCaravanArrival(arrival)
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7, tp)

    expect(result.stateChanges.rumorsDigested).toBe(3)
    const chapter = mm.getChapter()!
    expect(chapter.intelligence.threatReports.some(t => t.sighting.speciesId === 'orc_raiders')).toBe(true)
    expect(chapter.intelligence.knownSites.some(s => s.siteName === 'lost_temple')).toBe(true)
  })

  it('consecutive resolves clear the pending arrival queue', () => {
    fresh()
    const tp = makeTP()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)

    mm.enqueueCaravanArrival({
      rumorsSpread: [{ topic: 'kobold_lair', category: 'monster', accuracy: 0.5, fidelity: 0.5 }],
    })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    // Second resolve — no new arrivals
    mm.accumulatePotential(7, 14)
    const r2 = mm.resolve(14, tp)
    expect(r2.stateChanges.rumorsDigested).toBe(0)
  })
})

describe('MMGuild — full week tick', () => {
  it('runs tickGuildChapter (parties, dues, intel) every week', () => {
    fresh()
    const tp = makeTP()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const party = createNPCParty(
      'Silver Foxes',
      [
        { entityId: 'p1', name: 'Ari',   level: 2, role: 'tank',    combatRating: 4, alive: true },
        { entityId: 'p2', name: 'Bren',  level: 2, role: 'healer',  combatRating: 3, alive: true },
        { entityId: 'p3', name: 'Cair',  level: 2, role: 'damage',  combatRating: 4, alive: true },
      ],
      'thundertree',
    )
    const mm = new MMGuild(guild, 'thundertree', 0, { parties: [party] })

    // 2 weeks
    mm.accumulatePotential(14, 14)
    const result = mm.resolve(14, tp)

    expect(result.stateChanges.weeksTicked).toBe(2)
    // Dues: 1 active party × 2gp memberDues × 2 weeks = 4
    expect(result.stateChanges.duesCollected).toBe(4)
    expect(guild.treasury).toBeGreaterThan(500)  // initial 500 + dues
  })

  it('serialize returns the full domain state snapshot', () => {
    fresh()
    const tp = makeTP()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const mm = new MMGuild(guild, 'thundertree', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)
    const ser = mm.serialize()
    expect(ser.state.id).toBe(mm.state.id)
    expect(ser.domain).toBeDefined()
    const dom = ser.domain as ReturnType<MMGuild['getDomainState']>
    expect(dom.cumulative.weeksTicked).toBe(1)
  })
})

describe('MMGuild — factionOwnerId', () => {
  it('createGuild accepts factionOwnerId and the field flows through', () => {
    fresh()
    const guild = createGuild(
      'AG', 'adventurers', 'thundertree', 'Thundertree',
      { factionOwnerId: 'faction_lords_alliance' },
    )
    expect(guild.factionOwnerId).toBe('faction_lords_alliance')

    const mm = new MMGuild(guild, 'thundertree', 0)
    const dom = mm.serialize().domain as ReturnType<MMGuild['getDomainState']>
    expect(dom.guild.factionOwnerId).toBe('faction_lords_alliance')
  })

  it('defaults to null when not provided', () => {
    fresh()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    expect(guild.factionOwnerId).toBeNull()
  })
})
