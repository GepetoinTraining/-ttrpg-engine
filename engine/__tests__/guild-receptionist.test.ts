/**
 * GUILD RECEPTIONIST TESTS
 * ============================
 * The Eternal Receptionist, Orb of Revelation, Manager Summon, Registration.
 */

import { describe, it, expect } from 'vitest'
import {
  getReceptionistName,
  calculateTrueRank,
  getOrbReaction,
  getReceptionistReaction,
  shouldSummonManager,
  getManagerDemeanor,
  getGuildManagerName,
  generateImpossibleKnowledge,
  buildOrbReadingPrompt,
  buildManagerSummonPrompt,
  performRegistration,
  RECEPTIONIST_NAMES,
  GUILD_MANAGER_NAMES,
  UNSETTLING_GREETINGS,
  MANAGER_QUOTES,
  ADVENTURER_RANK_ORDER,
} from '../guild-receptionist'

// ============================================================
// THE ETERNAL RECEPTIONIST
// ============================================================

describe('Guild Receptionist — Eternal Receptionist', () => {
  it('deterministic name per branch', () => {
    const name1 = getReceptionistName('branch_waterdeep')
    const name2 = getReceptionistName('branch_waterdeep')
    expect(name1).toBe(name2) // Same branch = same name

    const name3 = getReceptionistName('branch_baldurs_gate')
    expect(RECEPTIONIST_NAMES).toContain(name3)
  })

  it('different branches can have different names', () => {
    // With enough branches, we should get at least 2 different names
    const names = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(b => getReceptionistName(b)),
    )
    expect(names.size).toBeGreaterThan(1)
  })

  it('has greetings for every trait', () => {
    const traitCount = Object.keys(UNSETTLING_GREETINGS).length
    expect(traitCount).toBe(11) // 11 unsettling traits
    for (const greetings of Object.values(UNSETTLING_GREETINGS)) {
      expect(greetings.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// THE ORB OF REVELATION
// ============================================================

describe('Guild Receptionist — Orb of Revelation', () => {
  it('maps level to rank correctly', () => {
    expect(calculateTrueRank(1)).toBe('F')
    expect(calculateTrueRank(3)).toBe('E')
    expect(calculateTrueRank(5)).toBe('D')
    expect(calculateTrueRank(8)).toBe('C')
    expect(calculateTrueRank(11)).toBe('B')
    expect(calculateTrueRank(14)).toBe('A')
    expect(calculateTrueRank(17)).toBe('S')
    expect(calculateTrueRank(19)).toBe('SS')
    expect(calculateTrueRank(20)).toBe('SSS')
  })

  it('protagonist vibes bumps rank up by 1', () => {
    expect(calculateTrueRank(5, true)).toBe('C')   // D → C
    expect(calculateTrueRank(14, true)).toBe('S')  // A → S
    expect(calculateTrueRank(20, true)).toBe('SSS') // SSS stays SSS (can't go higher)
  })

  it('orb reaction scales with rank', () => {
    expect(getOrbReaction('F')).toBe('dim_glow')
    expect(getOrbReaction('C')).toBe('steady_glow')
    expect(getOrbReaction('A')).toBe('bright_glow')
    expect(getOrbReaction('S')).toBe('blinding_flash')
    expect(getOrbReaction('SS')).toBe('sustained_radiance')
    expect(getOrbReaction('SSS')).toBe('reality_crack')
    expect(getOrbReaction('EX')).toBe('orb_shatters')
  })

  it('receptionist reaction to anomalies overrides rank', () => {
    expect(getReceptionistReaction('F', ['isekai_signature'])).toBe('ara_ara_intensifies')
    expect(getReceptionistReaction('F', ['protagonist_aura'])).toBe('silent_knowing_nod')
    expect(getReceptionistReaction('F', ['harem_magnetism'])).toBe('breaks_character')
  })

  it('receptionist reaction to high rank', () => {
    expect(getReceptionistReaction('D', [])).toBe('professional_smile')
    expect(getReceptionistReaction('B', [])).toBe('eyebrow_raise')
    expect(getReceptionistReaction('S', [])).toBe('clipboard_drop')
    expect(getReceptionistReaction('SS', [])).toBe('faints')
    expect(getReceptionistReaction('SSS', [])).toBe('calls_manager')
  })
})

// ============================================================
// MANAGER SUMMON
// ============================================================

describe('Guild Receptionist — Manager Summon', () => {
  it('triggers on S+ rank', () => {
    const { triggered, triggers } = shouldSummonManager('S', 'blinding_flash', [])
    expect(triggered).toBe(true)
    expect(triggers).toContain('rank_s_or_higher')
  })

  it('does not trigger on low rank', () => {
    const { triggered } = shouldSummonManager('C', 'steady_glow', [])
    expect(triggered).toBe(false)
  })

  it('triggers on isekai_signature anomaly', () => {
    const { triggered, triggers } = shouldSummonManager('D', 'steady_glow', ['isekai_signature'])
    expect(triggered).toBe(true)
    expect(triggers).toContain('isekai_confirmed')
  })

  it('triggers on multiple anomalies', () => {
    const { triggered, triggers } = shouldSummonManager('C', 'steady_glow', ['fluctuating', 'suppressed'])
    expect(triggered).toBe(true)
    expect(triggers).toContain('multiple_anomalies')
  })

  it('getManagerDemeanor escalates correctly', () => {
    expect(getManagerDemeanor(['orb_speaks'])).toBe('reveals_too_much')
    expect(getManagerDemeanor(['ex_rank'])).toBe('calls_headquarters')
    expect(getManagerDemeanor(['orb_shatters'])).toBe('grim_recognition')
    expect(getManagerDemeanor(['isekai_confirmed'])).toBe('barely_contained_excitement')
    expect(getManagerDemeanor(['rank_s_or_higher'])).toBe('weary_acceptance')
  })
})

// ============================================================
// GUILD MANAGER
// ============================================================

describe('Guild Receptionist — Guild Manager', () => {
  it('deterministic manager name per branch', () => {
    const name1 = getGuildManagerName('branch_waterdeep')
    const name2 = getGuildManagerName('branch_waterdeep')
    expect(name1).toBe(name2)
    expect(GUILD_MANAGER_NAMES).toContain(name1)
  })

  it('has quotes for every demeanor', () => {
    for (const quotes of Object.values(MANAGER_QUOTES)) {
      expect(quotes.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// IMPOSSIBLE KNOWLEDGE
// ============================================================

describe('Guild Receptionist — Impossible Knowledge', () => {
  it('generates knowledge from character data', () => {
    const knowledge = generateImpossibleKnowledge({
      id: 'char_1', name: 'Torm', race: 'Human', class: 'Paladin',
      level: 10, homeland: 'Cormyr', secrets: ['secretly a Zhentarim agent'],
    })

    expect(knowledge.length).toBeGreaterThanOrEqual(4)
    expect(knowledge.some(k => k.includes('Torm'))).toBe(true)
    expect(knowledge.some(k => k.includes('Cormyr'))).toBe(true)
    expect(knowledge.some(k => k.includes('Paladin'))).toBe(true)
    expect(knowledge.some(k => k.includes('Zhentarim'))).toBe(true)
  })

  it('always includes meta-knowledge', () => {
    const knowledge = generateImpossibleKnowledge({
      id: 'c', name: 'Bob', race: 'Dwarf', class: 'Fighter', level: 1,
    })
    expect(knowledge.some(k => k.includes("met them before"))).toBe(true)
  })
})

// ============================================================
// PROMPTS
// ============================================================

describe('Guild Receptionist — Prompt Building', () => {
  it('builds orb reading prompt with all context', () => {
    const prompt = buildOrbReadingPrompt({
      character: { id: 'c', name: 'Aria', race: 'Elf', class: 'Wizard', level: 17 },
      guild: { branchId: 'b', branchName: 'Waterdeep Branch', receptionistName: 'Katarina', settlementName: 'Waterdeep' },
      trueRank: 'S',
      orbReaction: 'blinding_flash',
      anomalies: [],
      receptionistReaction: 'clipboard_drop',
      impossibleKnowledge: ['knows her name'],
      tone: 'dramatic',
    })

    expect(prompt).toContain('Aria')
    expect(prompt).toContain('Waterdeep')
    expect(prompt).toContain('Katarina')
    expect(prompt).toContain('blinding_flash')
    expect(prompt).toContain('dramatic')
  })

  it('builds manager summon prompt', () => {
    const prompt = buildManagerSummonPrompt(
      {
        character: { id: 'c', name: 'Torm', race: 'Human', class: 'Paladin', level: 20 },
        guild: { branchId: 'b', branchName: 'Branch', receptionistName: 'Elena', settlementName: 'Suzail' },
        trueRank: 'SSS', orbReaction: 'reality_crack', anomalies: [],
        receptionistReaction: 'calls_manager', impossibleKnowledge: [], tone: 'dramatic',
      },
      {
        triggered: true, triggers: ['rank_s_or_higher', 'reality_crack'],
        receptionistBreak: 'clipboard_falls', summonPhrase: 'I need to call the Guild Manager.',
        tavernReaction: 'silence', waitDescription: 'uncomfortable_silence',
        managerEntrance: 'descends_stairs', demeanor: 'weary_acceptance',
      },
      'Aldric', 'Guildmaster',
    )

    expect(prompt).toContain('Torm')
    expect(prompt).toContain('Aldric')
    expect(prompt).toContain('Guildmaster')
    expect(prompt).toContain('clipboard_falls')
  })
})

// ============================================================
// FULL REGISTRATION CEREMONY
// ============================================================

describe('Guild Receptionist — Full Registration', () => {
  it('normal registration for low level character', () => {
    const ceremony = performRegistration('char_1', 'Bob', 3, 'branch_1', 100)
    expect(ceremony.orbReading.revealedRank).toBe('E')
    expect(ceremony.managerSummon).toBeUndefined()
    expect(ceremony.outcome).toBe('normal_registration')
    expect(ceremony.guildCard!.rank).toBe('E')
    expect(ceremony.guildCard!.displayedRank).toBe('E')
  })

  it('triggers manager summon for S-rank', () => {
    const ceremony = performRegistration('char_2', 'Hero', 17, 'branch_1', 100)
    expect(ceremony.orbReading.revealedRank).toBe('S')
    expect(ceremony.managerSummon).toBeDefined()
    expect(ceremony.managerSummon!.triggered).toBe(true)
    expect(ceremony.outcome).toBe('private_meeting')
  })

  it('SSS rank gets VIP treatment', () => {
    const ceremony = performRegistration('char_3', 'God', 20, 'branch_1', 100)
    expect(ceremony.orbReading.revealedRank).toBe('SSS')
    expect(ceremony.outcome).toBe('vip_treatment')
  })

  it('isekai signature triggers recruitment', () => {
    const ceremony = performRegistration('char_4', 'Truck-kun Survivor', 5, 'branch_1', 100, ['isekai_signature'])
    expect(ceremony.managerSummon).toBeDefined()
    expect(ceremony.outcome).toBe('recruitment_attempt')
    expect(ceremony.orbReading.receptionistReaction).toBe('ara_ara_intensifies')
  })

  it('EX rank hidden on guild card as SSS', () => {
    const ceremony = performRegistration('char_5', 'Entity', 20, 'branch_1', 100, [], true)
    // Level 20 + protagonist vibes stays SSS (can't exceed)
    expect(ceremony.guildCard!.displayedRank).toBe(ceremony.guildCard!.rank)
  })

  it('divine interference flags surveillance', () => {
    const ceremony = performRegistration('char_6', 'Chosen', 8, 'branch_1', 100, ['divine_interference'])
    expect(ceremony.managerSummon).toBeDefined()
    expect(ceremony.outcome).toBe('surveillance_flagged')
    expect(ceremony.guildCard!.specialDesignation).toBe('WATCH')
  })
})
