/**
 * NPC AGENDA TESTS — Skills, Needs, Economy, Conversations
 * ===========================================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createNPCAgenda, resetAgendaIdCounter,
  getMostPressingNeed, dispositionFromScore,
  calculateCombatRating, deriveEconomicRole,
  resolveConversation, tickAgenda,
  type NPCAgenda, type Disposition, type Need,
} from '../npc-agenda.js'

beforeEach(() => {
  resetAgendaIdCounter()
})

// ============================================================
// NPC CREATION
// ============================================================

describe('NPC Agenda — Creation', () => {
  it('creates an NPC with skills and needs', () => {
    const npc = createNPCAgenda('Thorin', 'blacksmith', 'ironforge', 5, {
      athletics: 7, perception: 3,
    })
    expect(npc.name).toBe('Thorin')
    expect(npc.occupation).toBe('blacksmith')
    expect(npc.level).toBe(5)
    expect(npc.skills.athletics).toBe(7)
    expect(npc.skills.perception).toBe(3)
    expect(npc.skills.arcana).toBe(0) // default
    expect(npc.needs).toHaveLength(5)
  })

  it('creates a caster NPC', () => {
    const mage = createNPCAgenda('Elminster', 'mage', 'shadowdale', 20, {
      arcana: 10, history: 8,
    }, {
      isCaster: true, schoolFocus: 'evocation', maxSpellLevel: 9, spellModifier: 11,
    })
    expect(mage.magic.isCaster).toBe(true)
    expect(mage.magic.maxSpellLevel).toBe(9)
    expect(mage.combatRating).toBeGreaterThan(10)
  })
})

// ============================================================
// SKILL BLOCK — Economic bonuses
// ============================================================

describe('NPC Agenda — Economic Role', () => {
  it('blacksmith skills → weapon quality bonus', () => {
    const role = deriveEconomicRole('blacksmith', {
      acrobatics: 0, athletics: 7, arcana: 0, history: 0,
      investigation: 0, nature: 0, religion: 0, deception: 0,
      insight: 0, intimidation: 0, performance: 0, persuasion: 0,
      animal_handling: 0, medicine: 0, perception: 0,
      sleight_of_hand: 0, stealth: 0, survival: 0,
    })
    expect(role.outputCommodity).toBe('weapons')
    expect(role.qualityBonus).toBe(14) // 7 × 2
    expect(role.quantityBonus).toBe(10) // floor(7 × 1.5)
    expect(role.laborUnits).toBe(3)     // skill >= 6
    expect(role.canMentor).toBe(true)   // skill >= 5
  })

  it('merchant skills → price influence', () => {
    const role = deriveEconomicRole('merchant', {
      acrobatics: 0, athletics: 0, arcana: 0, history: 0,
      investigation: 0, nature: 0, religion: 0, deception: 0,
      insight: 0, intimidation: 0, performance: 0, persuasion: 5,
      animal_handling: 0, medicine: 0, perception: 0,
      sleight_of_hand: 0, stealth: 0, survival: 0,
    })
    expect(role.priceInfluence).toBe(2.5) // 5 × 0.5
  })

  it('low-skill worker still provides labor', () => {
    const role = deriveEconomicRole('farmer', {
      acrobatics: 0, athletics: 0, arcana: 0, history: 0,
      investigation: 0, nature: 1, religion: 0, deception: 0,
      insight: 0, intimidation: 0, performance: 0, persuasion: 0,
      animal_handling: 0, medicine: 0, perception: 0,
      sleight_of_hand: 0, stealth: 0, survival: 0,
    })
    expect(role.outputCommodity).toBe('grain')
    expect(role.qualityBonus).toBe(2)
    expect(role.laborUnits).toBe(1)
    expect(role.canMentor).toBe(false)
  })

  it('unknown occupation = no role', () => {
    const role = deriveEconomicRole('philosopher', {
      acrobatics: 0, athletics: 0, arcana: 0, history: 10,
      investigation: 0, nature: 0, religion: 0, deception: 0,
      insight: 0, intimidation: 0, performance: 0, persuasion: 0,
      animal_handling: 0, medicine: 0, perception: 0,
      sleight_of_hand: 0, stealth: 0, survival: 0,
    })
    expect(role.outputCommodity).toBeUndefined()
    expect(role.qualityBonus).toBe(0)
  })
})

// ============================================================
// NEEDS HIERARCHY
// ============================================================

describe('NPC Agenda — Needs', () => {
  it('survival is most pressing when low', () => {
    const needs: Need[] = [
      { type: 'survival', fulfillment: 10, driver: 'hungry' },
      { type: 'safety', fulfillment: 80, driver: '' },
      { type: 'belonging', fulfillment: 90, driver: '' },
      { type: 'esteem', fulfillment: 90, driver: '' },
      { type: 'purpose', fulfillment: 90, driver: '' },
    ]
    expect(getMostPressingNeed(needs).type).toBe('survival')
  })

  it('higher needs only matter when lower are met', () => {
    const needs: Need[] = [
      { type: 'survival', fulfillment: 80, driver: '' },
      { type: 'safety', fulfillment: 80, driver: '' },
      { type: 'belonging', fulfillment: 20, driver: '' },
      { type: 'esteem', fulfillment: 90, driver: '' },
      { type: 'purpose', fulfillment: 90, driver: '' },
    ]
    expect(getMostPressingNeed(needs).type).toBe('belonging')
  })

  it('all needs satisfied → returns lowest', () => {
    const needs: Need[] = [
      { type: 'survival', fulfillment: 90, driver: '' },
      { type: 'safety', fulfillment: 80, driver: '' },
      { type: 'belonging', fulfillment: 70, driver: '' },
      { type: 'esteem', fulfillment: 60, driver: '' },
      { type: 'purpose', fulfillment: 55, driver: '' },
    ]
    expect(getMostPressingNeed(needs).type).toBe('purpose')
  })
})

// ============================================================
// DISPOSITION
// ============================================================

describe('NPC Agenda — Disposition', () => {
  it('maps scores to dispositions', () => {
    expect(dispositionFromScore(80)).toBe('loyal')
    expect(dispositionFromScore(40)).toBe('friendly')
    expect(dispositionFromScore(0)).toBe('indifferent')
    expect(dispositionFromScore(-30)).toBe('unfriendly')
    expect(dispositionFromScore(-80)).toBe('hostile')
  })
})

// ============================================================
// COMBAT RATING
// ============================================================

describe('NPC Agenda — Combat Rating', () => {
  it('level + skills + magic = CR', () => {
    const cr = calculateCombatRating(10, {
      acrobatics: 5, athletics: 7, arcana: 0, history: 0,
      investigation: 0, nature: 0, religion: 0, deception: 0,
      insight: 0, intimidation: 0, performance: 0, persuasion: 0,
      animal_handling: 0, medicine: 0, perception: 0,
      sleight_of_hand: 0, stealth: 0, survival: 0,
    }, { isCaster: true, maxSpellLevel: 5, spellModifier: 4, loreTopics: [] }, true, true)
    // 10*0.5 + 7*0.2 + 5*0.5 + 1 + 1 = 5 + 1.4 + 2.5 + 2 = 10.9
    expect(cr).toBeGreaterThan(10)
  })

  it('commoner has low CR', () => {
    const cr = calculateCombatRating(1, {
      acrobatics: 0, athletics: 0, arcana: 0, history: 0,
      investigation: 0, nature: 0, religion: 0, deception: 0,
      insight: 0, intimidation: 0, performance: 0, persuasion: 0,
      animal_handling: 0, medicine: 0, perception: 0,
      sleight_of_hand: 0, stealth: 0, survival: 0,
    }, { isCaster: false, maxSpellLevel: 0, spellModifier: 0, loreTopics: [] }, false, false)
    expect(cr).toBeLessThanOrEqual(1)
  })
})

// ============================================================
// CONVERSATION RESOLUTION
// ============================================================

describe('NPC Agenda — Conversation', () => {
  it('persuasion success improves disposition', () => {
    const npc = createNPCAgenda('Innkeeper', 'innkeeper', 'hub', 3, { insight: 2 })

    const result = resolveConversation(npc, 'player_1', 'Hero', 'persuade', 5, 15, 1)
    // Roll 15 + 5 = 20 vs DC ~10 + 2 = 12 → success
    expect(result.success).toBe(true)
    expect(result.dispositionDelta).toBe(2)
    expect(npc.dispositions['player_1']).toBe(2)
  })

  it('failed deception tanks disposition', () => {
    const npc = createNPCAgenda('Guard', 'guard', 'hub', 5, { insight: 7 })

    const result = resolveConversation(npc, 'player_1', 'Rogue', 'deceive', 3, 5, 1)
    // Roll 5 + 3 = 8 vs DC 10 + 7 = 17 → fail
    expect(result.success).toBe(false)
    expect(result.dispositionDelta).toBe(-10) // caught lying
  })

  it('befriending always improves disposition', () => {
    const npc = createNPCAgenda('Farmer', 'farmer', 'hub', 1)

    resolveConversation(npc, 'p1', 'Friend', 'befriend', 5, 18, 1)
    resolveConversation(npc, 'p1', 'Friend', 'befriend', 5, 18, 2)
    resolveConversation(npc, 'p1', 'Friend', 'befriend', 5, 18, 3)

    expect(npc.dispositions['p1']).toBeGreaterThanOrEqual(10)
    expect(npc.memory).toHaveLength(3)
  })

  it('reveals secrets when disposition is high enough', () => {
    const npc = createNPCAgenda('spy', 'merchant', 'hub', 5, { insight: 2 })
    npc.secrets.push({
      id: 'secret_1', content: 'The mayor is corrupt',
      topic: 'politics', dispositionGate: 'friendly',
      extractionDC: 12, revealed: false, significance: 'major',
    })

    // Set friendly disposition
    npc.dispositions['player_1'] = 35

    const result = resolveConversation(npc, 'player_1', 'Hero', 'persuade', 5, 15, 1)
    if (result.success) {
      expect(result.secretsRevealed.length).toBeGreaterThanOrEqual(1)
      expect(result.secretsRevealed[0].content).toBe('The mayor is corrupt')
    }
  })

  it('intimidation success gives fearful response', () => {
    const npc = createNPCAgenda('Peasant', 'farmer', 'hub', 1, { insight: 0, intimidation: 0 })

    const result = resolveConversation(npc, 'p1', 'Warlord', 'intimidate', 8, 15, 1)
    expect(result.success).toBe(true)
    expect(result.responseTone).toBe('fearful')
    expect(result.dispositionDelta).toBeLessThan(0) // intimidation always negative
  })

  it('bribe with gold lowers DC', () => {
    const npc = createNPCAgenda('Official', 'official', 'hub', 3, { insight: 4 })

    // Big bribe = lower DC
    const result = resolveConversation(npc, 'p1', 'Merchant', 'bribe', 3, 10, 1, 200)
    // DC 15 - 5 (>=50) - 5 (>=200) = 5, Roll 10+3 = 13 > 5 → success
    expect(result.success).toBe(true)
  })
})

// ============================================================
// AGENDA TICK — Daily life
// ============================================================

describe('NPC Agenda — Daily Tick', () => {
  it('needs decay each day', () => {
    const npc = createNPCAgenda('Worker', 'farmer', 'hub', 1, { nature: 2 })
    const initialSurvival = npc.needs.find(n => n.type === 'survival')!.fulfillment

    tickAgenda(npc)

    // Survival decayed by 5, but gained 8 from working = +3
    const afterSurvival = npc.needs.find(n => n.type === 'survival')!.fulfillment
    expect(afterSurvival).toBeGreaterThan(initialSurvival)
  })

  it('sets current goal from needs', () => {
    const npc = createNPCAgenda('Hungry', 'beggar', 'hub', 1)
    npc.needs.find(n => n.type === 'survival')!.fulfillment = 10 // starving

    tickAgenda(npc)

    expect(npc.currentGoal).toBe('Find food and shelter')
  })

  it('derives economic role on tick', () => {
    const npc = createNPCAgenda('Smith', 'blacksmith', 'hub', 5, { athletics: 6 })

    const result = tickAgenda(npc)

    expect(result.economicOutput.outputCommodity).toBe('weapons')
    expect(result.economicOutput.qualityBonus).toBe(12)
    expect(result.economicOutput.laborUnits).toBe(3)
  })

  it('faction membership fulfills belonging', () => {
    const npc = createNPCAgenda('Member', 'guard', 'hub', 3)
    npc.needs.find(n => n.type === 'belonging')!.fulfillment = 30
    npc.loyalties['city_guard_faction'] = 50

    tickAgenda(npc)

    const belonging = npc.needs.find(n => n.type === 'belonging')!
    expect(belonging.fulfillment).toBeGreaterThan(30)
  })
})

// ============================================================
// MEMORY (.tpb)
// ============================================================

describe('NPC Agenda — Memory', () => {
  it('conversations create memory entries', () => {
    const npc = createNPCAgenda('Barkeep', 'innkeeper', 'hub', 3)

    resolveConversation(npc, 'p1', 'Traveler', 'ask', 0, 10, 1)
    resolveConversation(npc, 'p1', 'Traveler', 'befriend', 3, 12, 2)

    expect(npc.memory).toHaveLength(2)
    expect(npc.memory[0].event).toBe('conversation')
    expect(npc.memory[1].worldDay).toBe(2)
  })
})
