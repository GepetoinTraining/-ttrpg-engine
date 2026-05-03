import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../tp'
import {
  createGuild,
  resetGuildIdCounter,
  resetJobIdCounter,
} from '../guild'
import {
  detectTownNeeds,
  generateQuestForChapter,
  isJobBoardThin,
  OPEN_JOB_THRESHOLD,
  PROFESSION_ADVANCEMENT_MATERIAL,
} from '../guild-quest-generator'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region',     name: 'Sword Coast', parentId: null,         dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function freshGuild(headquartersNodeId = 'thundertree') {
  resetGuildIdCounter()
  resetJobIdCounter()
  return createGuild('Adventurers Guild — Thundertree', 'adventurers', headquartersNodeId, 'Thundertree')
}

describe('detectTownNeeds — commodity shortage', () => {
  it('flags low supply / high demand', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { iron: { supply: 10, demand: 100 } },
    })
    const guild = freshGuild()
    const needs = detectTownNeeds(tp, 'thundertree', guild.chapters[0], 0)
    const shortage = needs.find(n => n.kind === 'commodity_shortage')
    expect(shortage).toBeDefined()
    expect(shortage!.questSuggestion.targetId).toBe('iron')
    expect(shortage!.severity).toBeGreaterThan(0.5)
  })

  it('does not flag balanced or oversupplied commodities', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { iron: { supply: 100, demand: 100 }, grain: { supply: 200, demand: 100 } },
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    expect(needs.find(n => n.kind === 'commodity_shortage')).toBeUndefined()
  })
})

describe('detectTownNeeds — profession bottleneck', () => {
  it('a journeyman blacksmith with no iron generates a need for iron', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { blacksmith: { count: 2, tier: 'journeyman' } },
    })
    // No iron in commodities
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    const bottleneck = needs.find(n => n.kind === 'profession_bottleneck')
    expect(bottleneck).toBeDefined()
    expect(bottleneck!.questSuggestion.targetId).toBe(PROFESSION_ADVANCEMENT_MATERIAL.blacksmith)
    expect(bottleneck!.questSuggestion.targetId).toBe('iron')
  })

  it('the master smith → expert advancement requires mythril/mithril', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { weaponsmith: { count: 1, tier: 'master' } },
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    const bottleneck = needs.find(n => n.kind === 'profession_bottleneck')
    expect(bottleneck).toBeDefined()
    expect(bottleneck!.questSuggestion.targetId).toBe('mythril')
    expect(bottleneck!.severity).toBeGreaterThan(0.7)   // master needs are urgent
  })

  it('does not bottleneck a basic-tier profession', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { hunter: { count: 5, tier: 'basic' } },
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    expect(needs.find(n => n.kind === 'profession_bottleneck')).toBeUndefined()
  })

  it('does not bottleneck if material is already in supply', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { blacksmith: { count: 1, tier: 'journeyman' } },
    })
    tp.writeDomain('thundertree', 'economy', {
      commodities: { iron: { supply: 50, demand: 30 } },
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    expect(needs.find(n => n.kind === 'profession_bottleneck')).toBeUndefined()
  })
})

describe('detectTownNeeds — monster threat', () => {
  it('generates a bounty quest at high danger level', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', {
      dangerLevel: 0.7,
      dominantThreats: ['orc_raiders'],
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    const threat = needs.find(n => n.kind === 'monster_threat')
    expect(threat).toBeDefined()
    expect(threat!.questSuggestion.jobType).toBe('bounty')
    expect(threat!.questSuggestion.targetId).toBe('orc_raiders')
    expect(threat!.questSuggestion.dangerTier).toBeGreaterThanOrEqual(3)
  })

  it('does not fire below the threshold', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.2, dominantThreats: ['vermin'] })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    expect(needs.find(n => n.kind === 'monster_threat')).toBeUndefined()
  })
})

describe('detectTownNeeds — recent edge threats (route_danger)', () => {
  it('flags an edge with accumulated threat reports', () => {
    const tp = makeTP()
    const guild = freshGuild()
    const chapter = guild.chapters[0]

    chapter.intelligence.threatReports.push(
      { edgeId: 'high_road', sighting: { speciesId: 'goblin', estimatedCount: 8, behaviorState: 'patrol', mileMarker: 12, threatLevel: 6 }, reportedDay: 95 },
      { edgeId: 'high_road', sighting: { speciesId: 'wolf',   estimatedCount: 4, behaviorState: 'hunting', mileMarker: 30, threatLevel: 4 }, reportedDay: 100 },
      { edgeId: 'low_road',  sighting: { speciesId: 'bandit', estimatedCount: 2, behaviorState: 'lurking', mileMarker: 5,  threatLevel: 2 }, reportedDay: 90 },
    )

    const needs = detectTownNeeds(tp, 'thundertree', chapter, 100)
    const route = needs.find(n => n.kind === 'route_danger')
    expect(route).toBeDefined()
    expect(route!.questSuggestion.targetId).toBe('high_road')
  })

  it('ignores stale threat reports outside the recent window', () => {
    const tp = makeTP()
    const guild = freshGuild()
    const chapter = guild.chapters[0]
    chapter.intelligence.threatReports.push(
      { edgeId: 'high_road', sighting: { speciesId: 'goblin', estimatedCount: 8, behaviorState: 'patrol', mileMarker: 12, threatLevel: 6 }, reportedDay: 0 },
    )
    const needs = detectTownNeeds(tp, 'thundertree', chapter, 200)
    expect(needs.find(n => n.kind === 'route_danger')).toBeUndefined()
  })
})

describe('detectTownNeeds — food crisis', () => {
  it('fires when starvationModifier is elevated', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'weather', {
      modifiers: { starvationModifier: 0.5, combatEffects: [] },
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    const crisis = needs.find(n => n.kind === 'food_crisis')
    expect(crisis).toBeDefined()
    expect(crisis!.questSuggestion.targetId).toBe('meat')
  })

  it('fires when both meat AND grain are very low', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { meat: { supply: 10, demand: 100 }, grain: { supply: 20, demand: 100 } },
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    const crisis = needs.find(n => n.kind === 'food_crisis')
    expect(crisis).toBeDefined()
  })
})

describe('detectTownNeeds — knowledge gap', () => {
  it('fires when potentials list is non-empty', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'knowledge', {
      potentials: ['fermentation', 'metallurgy'],
    })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    const gap = needs.find(n => n.kind === 'knowledge_gap')
    expect(gap).toBeDefined()
    expect(gap!.questSuggestion.targetId).toBe('fermentation')
  })
})

describe('detectTownNeeds — faction pressure', () => {
  it('fires when contested is true', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'faction', { contested: true })
    const needs = detectTownNeeds(tp, 'thundertree', undefined, 0)
    expect(needs.find(n => n.kind === 'faction_pressure')).toBeDefined()
  })
})

describe('generateQuestForChapter — picks the top severity', () => {
  it('picks monster_threat over knowledge_gap when danger is high', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.8, dominantThreats: ['gnoll_pack'] })
    tp.writeDomain('thundertree', 'knowledge', { potentials: ['arcane_theory'] })
    const guild = freshGuild()
    const out = generateQuestForChapter({
      tp, guild, chapter: guild.chapters[0],
      hubNodeId: 'thundertree', worldDay: 0, d20: 10,
    })
    expect(out.job).toBeTruthy()
    expect(out.pickedNeed?.kind).toBe('monster_threat')
    expect(out.job!.targetId).toBe('gnoll_pack')
  })

  it('returns null job when no needs are detectable', () => {
    const tp = makeTP()
    const guild = freshGuild()
    const out = generateQuestForChapter({
      tp, guild, chapter: guild.chapters[0],
      hubNodeId: 'thundertree', worldDay: 0, d20: 10,
    })
    expect(out.job).toBeNull()
    expect(out.pickedNeed).toBeNull()
  })

  it('posts the job onto the guild job board', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { weaponsmith: { count: 1, tier: 'master' } },
    })
    const guild = freshGuild()
    expect(guild.jobBoard.length).toBe(0)
    const out = generateQuestForChapter({
      tp, guild, chapter: guild.chapters[0],
      hubNodeId: 'thundertree', worldDay: 0, d20: 10,
    })
    expect(out.job).toBeTruthy()
    expect(guild.jobBoard.length).toBe(1)
    expect(guild.jobBoard[0].targetId).toBe('mythril')
  })

  it('Pedro\'s example: smithy at master needs mythril → quest is "retrieve mythril"', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'infrastructure', {
      professions: { weaponsmith: { count: 1, tier: 'master' } },
    })
    const guild = freshGuild()
    const out = generateQuestForChapter({
      tp, guild, chapter: guild.chapters[0],
      hubNodeId: 'thundertree', worldDay: 0, d20: 5,
    })
    expect(out.job!.type).toBe('retrieve')
    expect(out.job!.targetId).toBe('mythril')
    expect(out.pickedNeed!.description).toContain('mythril')
  })
})

describe('isJobBoardThin', () => {
  it('returns true when below threshold', () => {
    const guild = freshGuild()
    expect(isJobBoardThin(guild, 'thundertree')).toBe(true)
  })

  it('returns false when at or above threshold', () => {
    const guild = freshGuild()
    // Add OPEN_JOB_THRESHOLD jobs
    for (let i = 0; i < OPEN_JOB_THRESHOLD; i++) {
      guild.jobBoard.push({
        id: `job_${i}`,
        type: 'patrol',
        targetId: 'edge', targetName: 'edge',
        chapterNodeId: 'thundertree',
        reward: 50, dangerTier: 1, postedDay: 0,
        status: 'open',
      })
    }
    expect(isJobBoardThin(guild, 'thundertree')).toBe(false)
  })

  it('does not count completed/expired jobs', () => {
    const guild = freshGuild()
    for (let i = 0; i < 10; i++) {
      guild.jobBoard.push({
        id: `job_${i}`,
        type: 'patrol',
        targetId: 'edge', targetName: 'edge',
        chapterNodeId: 'thundertree',
        reward: 50, dangerTier: 1, postedDay: 0,
        status: i % 2 === 0 ? 'completed' : 'expired',
      })
    }
    expect(isJobBoardThin(guild, 'thundertree')).toBe(true)
  })
})
