/**
 * GUILD TESTS
 * ============
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGuild, addGuildChapter, createNPCParty,
  postJob, matchJobsToParties, dispatchParty,
  resolveJob, fileIntelReport, propagateIntel,
  tickGuildChapter,
  resetGuildIdCounter, resetPartyIdCounter, resetJobIdCounter,
  ADVENTURER_RANKS,
  type NPCAdventurerParty, type NPCPartyMember, type Guild,
} from '../guild.js'

beforeEach(() => {
  resetGuildIdCounter()
  resetPartyIdCounter()
  resetJobIdCounter()
})

// ============================================================
// HELPERS
// ============================================================

function makePartyMembers(level: number, count: number = 4): NPCPartyMember[] {
  const roles: Array<'tank' | 'healer' | 'damage' | 'caster'> = ['tank', 'healer', 'damage', 'caster']
  return Array.from({ length: count }, (_, i) => ({
    entityId: `npc_${i + 1}`,
    name: `Adventurer ${i + 1}`,
    level,
    role: roles[i % 4],
    combatRating: level * 2,
    alive: true,
  }))
}

// ============================================================
// GUILD CREATION
// ============================================================

describe('Guild Creation', () => {
  it('creates adventurers guild with HQ chapter', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    expect(guild.id).toBe('guild_1')
    expect(guild.type).toBe('adventurers')
    expect(guild.chapters).toHaveLength(1)
    expect(guild.chapters[0].nodeId).toBe('waterdeep')
    expect(guild.chapters[0].facilities).toContain('job_board')
    expect(guild.treasury).toBe(500)
    expect(guild.ranks).toHaveLength(5) // Copper to Platinum
  })

  it('adventurer ranks progress from Copper to Platinum', () => {
    expect(ADVENTURER_RANKS[0].name).toBe('Copper')
    expect(ADVENTURER_RANKS[4].name).toBe('Platinum')
    expect(ADVENTURER_RANKS[4].minReputation).toBe(80)
  })

  it('non-adventurer guilds get generic ranks', () => {
    const guild = createGuild('Merchant Guild', 'merchant', 'baldurs_gate', "Baldur's Gate")
    expect(guild.ranks).toHaveLength(3)
    expect(guild.ranks[0].name).toBe('Apprentice')
  })
})

// ============================================================
// CHAPTERS
// ============================================================

describe('Guild Chapters', () => {
  it('adds chapter to existing guild', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const chapter = addGuildChapter(guild, 'neverwinter', 'Neverwinter')

    expect(guild.chapters).toHaveLength(2)
    expect(chapter.nodeId).toBe('neverwinter')
    expect(chapter.reputation).toBe(30) // lower than HQ
    expect(guild.networkReach).toContain('neverwinter')
  })

  it('chapter has empty intelligence on creation', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const chapter = addGuildChapter(guild, 'neverwinter', 'Neverwinter')

    expect(chapter.intelligence.knownSites).toHaveLength(0)
    expect(chapter.intelligence.threatReports).toHaveLength(0)
  })
})

// ============================================================
// NPC PARTIES
// ============================================================

describe('NPC Party Creation', () => {
  it('creates party with computed stats', () => {
    const members = makePartyMembers(5)
    const party = createNPCParty('Silver Swords', members, 'waterdeep')

    expect(party.id).toBe('party_1')
    expect(party.name).toBe('Silver Swords')
    expect(party.partyLevel).toBe(5)
    expect(party.combatRating).toBe(40) // 4 × 5 × 2
    expect(party.status).toBe('idle')
    expect(party.gold).toBe(50)
    expect(party.weeklyExpenses).toBe(20) // 4 × 5
  })
})

// ============================================================
// JOB POSTING
// ============================================================

describe('Job Posting', () => {
  it('posts job to guild board and chapter', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'clear_gate', 'gate_1', 'Goblin Warren', 'waterdeep', 200, 2, 100)

    expect(job.status).toBe('open')
    expect(job.reward).toBe(200)
    expect(job.dangerTier).toBe(2)
    expect(guild.jobBoard).toHaveLength(1)
    expect(guild.chapters[0].localJobIds).toContain(job.id)
  })

  it('jobs expire after 30 days', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'patrol', 'edge_1', 'Sword Coast Road', 'waterdeep', 50, 1, 100)

    expect(job.expiresDay).toBe(130)
  })
})

// ============================================================
// JOB MATCHING
// ============================================================

describe('Job Matching', () => {
  it('matches strongest party to highest-reward job', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    postJob(guild, 'clear_gate', 'gate_1', 'Goblin Cave', 'waterdeep', 200, 2, 100)
    postJob(guild, 'patrol', 'edge_1', 'Road', 'waterdeep', 50, 1, 100)

    const party = createNPCParty('Silver Swords', makePartyMembers(5), 'waterdeep')
    const matches = matchJobsToParties(guild, [party], 'waterdeep')

    expect(matches).toHaveLength(1)
    expect(matches[0].jobId).toBe(guild.jobBoard[0].id) // highest reward
  })

  it('does not match underleveled party to dangerous job', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    postJob(guild, 'clear_gate', 'gate_1', 'Dragon Lair', 'waterdeep', 5000, 5, 100)

    const party = createNPCParty('Newbies', makePartyMembers(1), 'waterdeep')
    const matches = matchJobsToParties(guild, [party], 'waterdeep')

    // Party CR = 8, minCR for tier 5 = 15 × 0.7 = 10.5 → party too weak
    expect(matches).toHaveLength(0)
  })

  it('matches multiple parties to multiple jobs', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    postJob(guild, 'clear_gate', 'gate_1', 'Crypt', 'waterdeep', 200, 2, 100)
    postJob(guild, 'patrol', 'edge_1', 'Road', 'waterdeep', 50, 1, 100)

    const party1 = createNPCParty('Silver Swords', makePartyMembers(5), 'waterdeep')
    const party2 = createNPCParty('Iron Guard', makePartyMembers(3), 'waterdeep')

    const matches = matchJobsToParties(guild, [party1, party2], 'waterdeep')
    expect(matches).toHaveLength(2)
    // Each party matched to different job
    expect(new Set(matches.map(m => m.partyId)).size).toBe(2)
  })
})

// ============================================================
// DISPATCH & RESOLUTION
// ============================================================

describe('Job Dispatch & Resolution', () => {
  it('dispatches party and updates statuses', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'clear_gate', 'gate_1', 'Crypt', 'waterdeep', 200, 2, 100)
    const party = createNPCParty('Silver Swords', makePartyMembers(5), 'waterdeep')

    dispatchParty(party, job)
    expect(party.status).toBe('on_job')
    expect(party.currentJobId).toBe(job.id)
    expect(job.status).toBe('claimed')
  })

  it('successful resolution pays party and guild', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'clear_gate', 'gate_1', 'Goblin Cave', 'waterdeep', 200, 1, 100)
    const party = createNPCParty('Silver Swords', makePartyMembers(5), 'waterdeep')
    dispatchParty(party, job)

    const startGold = party.gold
    const startTreasury = guild.treasury

    const result = resolveJob(party, job, guild, 18) // strong roll
    expect(result.success).toBe(true)
    expect(party.gold).toBeGreaterThan(startGold)
    expect(guild.treasury).toBeGreaterThan(startTreasury)
    expect(job.status).toBe('completed')
    expect(party.jobsCompleted).toBe(1)
  })

  it('failed resolution causes casualties', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'clear_gate', 'gate_1', 'Dragon Lair', 'waterdeep', 5000, 5, 100)
    const party = createNPCParty('Doomed Ones', makePartyMembers(2), 'waterdeep')
    dispatchParty(party, job)

    const result = resolveJob(party, job, guild, 1) // terrible roll
    expect(result.success).toBe(false)
    expect(result.casualties).toBeGreaterThan(0)
    expect(party.membersLost).toBeGreaterThan(0)
    expect(job.status).toBe('failed')
  })

  it('party disbands if too few survive', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'clear_gate', 'gate_1', 'Death Trap', 'waterdeep', 5000, 5, 100)
    // Only 2 members — losing even 1 leaves < 2
    const party = createNPCParty('Duo', makePartyMembers(1, 2), 'waterdeep')
    dispatchParty(party, job)

    resolveJob(party, job, guild, 1)
    expect(party.status).toBe('disbanded')
  })
})

// ============================================================
// INTELLIGENCE
// ============================================================

describe('Guild Intelligence', () => {
  it('files travel log into chapter intelligence', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const party = createNPCParty('Scouts', makePartyMembers(3), 'waterdeep')

    party.travelLog = [{
      edgeId: 'edge_1',
      day: 100,
      sitesFound: ['site_1', 'site_2'],
      monsterSightings: [{
        speciesId: 'goblin', estimatedCount: 8,
        behaviorState: 'hunting', mileMarker: 15, threatLevel: 4,
      }],
      roadConditions: [{ segmentIndex: 0, condition: 'trail' }],
      dangerAssessment: 'moderate',
    }]

    const count = fileIntelReport(party, guild.chapters[0])
    expect(count).toBe(4) // 2 sites + 1 sighting + 1 road
    expect(guild.chapters[0].intelligence.knownSites).toHaveLength(2)
    expect(guild.chapters[0].intelligence.threatReports).toHaveLength(1)
    expect(party.travelLog).toHaveLength(0) // cleared after filing
  })

  it('does not duplicate known sites', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const party = createNPCParty('Scouts', makePartyMembers(3), 'waterdeep')

    // File same site twice
    party.travelLog = [
      { edgeId: 'e1', day: 100, sitesFound: ['site_1'], monsterSightings: [], roadConditions: [], dangerAssessment: 'safe' },
    ]
    fileIntelReport(party, guild.chapters[0])

    party.travelLog = [
      { edgeId: 'e1', day: 101, sitesFound: ['site_1'], monsterSightings: [], roadConditions: [], dangerAssessment: 'safe' },
    ]
    fileIntelReport(party, guild.chapters[0])

    expect(guild.chapters[0].intelligence.knownSites).toHaveLength(1)
  })
})

// ============================================================
// INTEL PROPAGATION
// ============================================================

describe('Intel Propagation', () => {
  it('shares sites between chapters', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    addGuildChapter(guild, 'neverwinter', 'Neverwinter')

    // Add intel to waterdeep chapter
    guild.chapters[0].intelligence.knownSites.push({
      edgeId: 'e1', siteId: 'site_1', siteName: 'Old Ruin',
      siteType: 'ruin', reportedDay: 100,
    })

    const results = propagateIntel(guild, 'waterdeep', 105)
    expect(results).toHaveLength(1)
    expect(results[0].reportsShared).toBeGreaterThanOrEqual(1)

    // Neverwinter chapter should now know about the site
    const nwIntel = guild.chapters[1].intelligence.knownSites
    expect(nwIntel.some(s => s.siteId === 'site_1')).toBe(true)
    expect(nwIntel[0].reportedDay).toBe(108) // 105 + messageSpeed(3)
  })
})

// ============================================================
// WEEKLY TICK
// ============================================================

describe('Weekly Guild Tick', () => {
  it('processes a full weekly cycle', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    postJob(guild, 'patrol', 'edge_1', 'Coast Road', 'waterdeep', 50, 1, 100)

    const party = createNPCParty('Rangers', makePartyMembers(3), 'waterdeep')
    guild.chapters[0].partyIds.push(party.id)

    const result = tickGuildChapter(guild, 'waterdeep', [party], 107)

    expect(result.chapterNodeId).toBe('waterdeep')
    expect(result.duesCollected).toBe(2) // 1 party × 2gp dues
    // Job matching attempted
    expect(result.jobsMatched).toBeGreaterThanOrEqual(0)
  })

  it('expires old jobs', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const job = postJob(guild, 'patrol', 'edge_1', 'Old Road', 'waterdeep', 50, 1, 100)
    job.expiresDay = 105

    tickGuildChapter(guild, 'waterdeep', [], 110)

    expect(job.status).toBe('expired')
  })

  it('recovers resting parties', () => {
    const guild = createGuild("Adventurers' Guild", 'adventurers', 'waterdeep', 'Waterdeep')
    const party = createNPCParty('Resting', makePartyMembers(3), 'waterdeep')
    party.status = 'recovering'

    tickGuildChapter(guild, 'waterdeep', [party], 110)
    expect(party.status).toBe('idle')
  })
})
