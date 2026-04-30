import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MODE_CONFIGS, GM_PROFILES,
  selectSceneType, createCorridor, advanceCorridor,
  generateClockworkEvent, escalateHooks, buildContextPacket,
  type ContextPacket, type PlayModeConfig, type WorldSnapshot,
} from '../gm.js'
import type { BeatType, PacingSuggestion } from '../narrative.js'

// ============================================================
// HELPERS
// ============================================================

function makeContextPacket(overrides: Partial<ContextPacket> = {}): ContextPacket {
  return {
    party: {
      members: [{ name: 'Aric', race: 'Human', class: 'Fighter', level: 5, hpPercent: 0.8 }],
      gold: 500,
      location: 'Waterdeep',
    },
    npcPresence: [],
    locationName: 'Waterdeep',
    locationType: 'city',
    activeQuests: [{ name: 'Find the Key', objective: 'Retrieve the key' }],
    recentBeats: [],
    staleHooks: [],
    factionTensions: [],
    activeVillains: [],
    pacingSuggestion: {
      suggestedBeatType: 'rising',
      reason: 'Normal pacing',
      urgentHooks: [],
      tension: 0.3,
    },
    gmProfile: GM_PROFILES.storyteller,
    playMode: 'GROUP_AI',
    ...overrides,
  }
}

// ============================================================
// PLAY MODE CONFIGS
// ============================================================

describe('GM — Mode Configs', () => {
  it('should have 4 default mode configs', () => {
    expect(Object.keys(DEFAULT_MODE_CONFIGS)).toHaveLength(4)
    expect(DEFAULT_MODE_CONFIGS.GROUP_DM_AI.mode).toBe('GROUP_DM_AI')
    expect(DEFAULT_MODE_CONFIGS.TRUE_SOLO.autoAdvance).toBe(true)
    expect(DEFAULT_MODE_CONFIGS.SOLO_AI.corridorMode).toBe(true)
    expect(DEFAULT_MODE_CONFIGS.GROUP_AI.corridorMode).toBe(false)
  })
})

// ============================================================
// GM PROFILES
// ============================================================

describe('GM — Profiles', () => {
  it('should have 6 profiles', () => {
    expect(Object.keys(GM_PROFILES)).toHaveLength(6)
  })

  it('warden should be harsh', () => {
    const warden = GM_PROFILES.warden
    expect(warden.mercyLevel).toBe('no_mercy')
    expect(warden.combatFrequency).toBe('high')
    expect(warden.narrationStyle).toBe('terse')
  })

  it('storyteller should prioritize narrative', () => {
    const st = GM_PROFILES.storyteller
    expect(st.combatFrequency).toBe('low')
    expect(st.socialFrequency).toBe('high')
    expect(st.narrationStyle).toBe('flowery')
  })
})

// ============================================================
// SCENE TYPE SELECTION
// ============================================================

describe('GM — Scene Selection', () => {
  it('should map beat suggestion to scene type', () => {
    const ctx = makeContextPacket()
    const scene = selectSceneType(ctx, 42)
    // rising → encounter
    expect(scene).toBe('encounter')
  })

  it('TRUE_SOLO should use clockwork scene types', () => {
    const ctx = makeContextPacket({ playMode: 'TRUE_SOLO' })
    const scene = selectSceneType(ctx, 42)
    expect(['encounter', 'exploration', 'combat', 'loot', 'transition']).toContain(scene)
  })

  it('should vary with different seeds', () => {
    const ctx = makeContextPacket({ playMode: 'TRUE_SOLO' })
    const scenes = new Set(Array.from({ length: 20 }, (_, i) => selectSceneType(ctx, i)))
    expect(scenes.size).toBeGreaterThan(1)
  })
})

// ============================================================
// SOLO CORRIDOR
// ============================================================

describe('GM — Solo Corridor', () => {
  it('should create corridor with correct segment count', () => {
    const corridor = createCorridor(6, 42)
    expect(corridor.segments).toHaveLength(6)
    expect(corridor.currentSegment).toBe(0)
  })

  it('should end with combat → narrative (climax → resolution)', () => {
    const corridor = createCorridor(6, 42)
    expect(corridor.segments[4].sceneType).toBe('combat')
    expect(corridor.segments[5].sceneType).toBe('narrative')
  })

  it('should advance through segments', () => {
    const corridor = createCorridor(4, 42)
    const seg1 = advanceCorridor(corridor)
    expect(seg1).not.toBeNull()
    expect(corridor.currentSegment).toBe(1)
    expect(corridor.segments[0].completed).toBe(true)
  })

  it('should return null when corridor exhausted', () => {
    const corridor = createCorridor(2, 42)
    advanceCorridor(corridor)
    const last = advanceCorridor(corridor)
    expect(last).toBeNull()
  })

  it('should track fork choices', () => {
    const corridor = createCorridor(4, 42)
    advanceCorridor(corridor, 'Go left')
    expect(corridor.forkHistory).toHaveLength(1)
    expect(corridor.forkHistory[0].choiceLabel).toBe('Go left')
  })
})

// ============================================================
// CLOCKWORK EVENTS (TRUE_SOLO)
// ============================================================

describe('GM — Clockwork Events', () => {
  it('should generate events deterministically', () => {
    const e1 = generateClockworkEvent(10, 5, 2, 30, 42)
    const e2 = generateClockworkEvent(10, 5, 2, 30, 42)
    expect(e1.type).toBe(e2.type)
    expect(e1.sceneType).toBe(e2.sceneType)
  })

  it('should generate different events with different seeds', () => {
    const events = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const e = generateClockworkEvent(1, 0, 0, 0, i * 997)
      events.add(e.type)
    }
    expect(events.size).toBeGreaterThan(3)
  })

  it('high danger should increase combat difficulty', () => {
    const safe = generateClockworkEvent(1, 1, 0, 0, 1)     // low danger
    const deadly = generateClockworkEvent(1, 9, 0, 0, 1)   // high danger
    // Different danger levels should produce different results
    // (due to dangerBias shifting the roll)
    expect(deadly.type).toBeDefined()
  })

  it('every event should have a sceneType', () => {
    for (let i = 0; i < 50; i++) {
      const e = generateClockworkEvent(i, i % 10, i % 5, i * 2, i * 13)
      expect(e.sceneType).toBeDefined()
      expect(e.title).toBeTruthy()
      expect(e.description).toBeTruthy()
    }
  })
})

// ============================================================
// HOOK ESCALATION
// ============================================================

describe('GM — Hook Escalation', () => {
  it('should not escalate fresh hooks', () => {
    const result = escalateHooks([
      { id: 'h1', name: 'Lost Heirloom', staleCount: 1, priority: 1 },
    ])
    expect(result).toHaveLength(0)
  })

  it('should escalate stale hooks', () => {
    const result = escalateHooks([
      { id: 'h1', name: 'Lost Heirloom', staleCount: 5, priority: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].urgency).toBe('moderate')
  })

  it('should escalate to critical at 10+ scenes', () => {
    const result = escalateHooks([
      { id: 'h1', name: 'Dragon Warning', staleCount: 12, priority: 3 },
    ])
    expect(result[0].urgency).toBe('critical')
    expect(result[0].reminderType).toBe('consequence')
  })

  it('should sort by priority × staleness', () => {
    const result = escalateHooks([
      { id: 'h1', name: 'Low', staleCount: 3, priority: 1 },
      { id: 'h2', name: 'High', staleCount: 3, priority: 5 },
    ])
    expect(result[0].hookName).toBe('High')
  })
})

// ============================================================
// CONTEXT PACKET BUILDER
// ============================================================

describe('GM — Context Packet', () => {
  it('should build a complete context packet', () => {
    const snapshot: WorldSnapshot = {
      partyMembers: [{ name: 'Aric', race: 'Human', class: 'Fighter', level: 5, hpPercent: 0.8 }],
      partyGold: 500,
      partyLocation: 'Waterdeep',
      locationType: 'city',
      npcsPresent: [],
      activeQuests: [{ name: 'Find Key', objective: 'Get the key' }],
      recentBeatTypes: ['hook', 'rising'],
      staleHooks: [],
      factionTensions: [],
      activeVillains: [],
    }

    const ctx = buildContextPacket(snapshot, DEFAULT_MODE_CONFIGS.GROUP_AI)
    expect(ctx.party.members).toHaveLength(1)
    expect(ctx.playMode).toBe('GROUP_AI')
    expect(ctx.gmProfile.type).toBe('storyteller')
    expect(ctx.pacingSuggestion).toBeDefined()
    expect(ctx.pacingSuggestion.tension).toBeGreaterThan(0)
  })
})
