/**
 * PHASE 1 ENRICHMENTS — Schema depth tests
 * ==========================================
 * Race catalog · Spell catalog · ItemV2 heirloom/relic/artifact
 * Faction cult/sanctuary · Treaty promotion · Law entity · Document family
 */

import { describe, it, expect, beforeEach } from 'vitest'

// ─── Race ───────────────────────────────────────────────────────────────────
import {
  getRace, racialTraitsFor, racesByCulture,
  RACE_CATALOG, RaceSchema,
} from '../race'

// ─── Spell catalog (magic.ts additions) ─────────────────────────────────────
import {
  getSpell, spellsByLevel, spellsBySchool, spellsByClass,
  SPELL_CATALOG,
  type Spell,
} from '../magic'

// ─── ItemV2 heirloom / relic / artifact (mf-smelt.ts additions) ─────────────
import {
  isHeirloom, isRelic, isArtifact,
  ItemV2Schema, type ItemV2,
} from '../mf-smelt'

// ─── Faction cult / sanctuary (faction.ts additions) ────────────────────────
import {
  createFaction, resetFactionIdCounter, FactionSchema,
} from '../faction'

// ─── Treaty promotion (warfare.ts additions) ─────────────────────────────────
import {
  createTreaty, dissolveTreaty, resetTreatyIdCounter,
  type Treaty, type DiplomaticRelation,
} from '../warfare'

// ─── Law entity (social.ts additions) ───────────────────────────────────────
import {
  createLaw, repealLaw, suspendLaw, getLawsAt,
  resetLawIdCounter,
  type Law,
} from '../social'

// ─── Document family (document.ts — new file) ────────────────────────────────
import {
  createDocument, documentGrantsAccess, documentKnowledgeSeeds,
  resetDocumentIdCounter, DocumentSchema,
  type DocumentKind,
} from '../document'

// ============================================================
// RACE CATALOG
// ============================================================

describe('Race catalog', () => {
  it('has at least 16 entries', () => {
    expect(RACE_CATALOG.length).toBeGreaterThanOrEqual(16)
  })

  it('getRace("human") returns expected fields', () => {
    const human = getRace('human')
    expect(human).toBeDefined()
    expect(human!.name).toBe('Human')
    expect(human!.size).toBe('medium')
    expect(human!.speed).toBe(30)
  })

  it('getRace on unknown id returns undefined', () => {
    expect(getRace('not_a_race')).toBeUndefined()
  })

  it('all catalog entries pass RaceSchema', () => {
    for (const race of RACE_CATALOG) {
      expect(() => RaceSchema.parse(race)).not.toThrow()
    }
  })

  it('racialTraitsFor("elf_high") returns non-empty array', () => {
    const traits = racialTraitsFor('elf_high')
    expect(Array.isArray(traits)).toBe(true)
    expect(traits.length).toBeGreaterThan(0)
  })

  it('racialTraitsFor unknown race returns empty array', () => {
    expect(racialTraitsFor('ghost')).toEqual([])
  })

  it('racesByCulture groups entries', () => {
    const group = racesByCulture('dwarven')
    expect(group.length).toBeGreaterThanOrEqual(2)
    expect(group.every(r => r.culturalGroup === 'dwarven')).toBe(true)
  })

  it('dwarf races have darkvision in traits', () => {
    const dwarfHill = getRace('dwarf_hill')
    expect(dwarfHill).toBeDefined()
    const traits = racialTraitsFor('dwarf_hill')
    expect(traits.some(t => t.toLowerCase().includes('darkvision'))).toBe(true)
  })

  it('elf has +2 dex modifier', () => {
    const elf = getRace('elf_high')
    expect(elf).toBeDefined()
    expect(elf!.abilityModifiers['dex']).toBe(2)
  })
})

// ============================================================
// SPELL CATALOG
// ============================================================

describe('Spell catalog', () => {
  it('has at least 30 entries', () => {
    expect(SPELL_CATALOG.length).toBeGreaterThanOrEqual(30)
  })

  it('getSpell("fireball") returns evocation school', () => {
    const spell = getSpell('fireball')
    expect(spell).toBeDefined()
    expect(spell!.school).toBe('evocation')
  })

  it('getSpell("cure_wounds") returns healing-flavored spell', () => {
    const spell = getSpell('cure_wounds')
    expect(spell).toBeDefined()
    expect(spell!.level).toBe(1)
  })

  it('getSpell on unknown id returns undefined', () => {
    expect(getSpell('summon_cheeseburger')).toBeUndefined()
  })

  it('spellsByLevel(1) returns multiple spells', () => {
    const lvl1 = spellsByLevel(1)
    expect(lvl1.length).toBeGreaterThan(0)
    for (const s of lvl1) {
      expect(s.level).toBe(1)
    }
  })

  it('spellsByLevel(0) returns cantrips', () => {
    const cantrips = spellsByLevel(0)
    expect(cantrips.length).toBeGreaterThan(0)
  })

  it('spellsBySchool("evocation") includes fireball', () => {
    const evocation = spellsBySchool('evocation')
    expect(evocation.some(s => s.id === 'fireball')).toBe(true)
  })

  it('each spell has a name and valid level 0-9', () => {
    for (const spell of SPELL_CATALOG) {
      expect(typeof spell.name).toBe('string')
      expect(spell.name.length).toBeGreaterThan(0)
      expect(spell.level).toBeGreaterThanOrEqual(0)
      expect(spell.level).toBeLessThanOrEqual(9)
    }
  })

  it('spellsByClass returns spells for wizard', () => {
    const wizardSpells = spellsByClass('wizard')
    expect(wizardSpells.length).toBeGreaterThan(0)
  })
})

// ============================================================
// ITEMV2 — HEIRLOOM / RELIC / ARTIFACT
// ============================================================

function makeBaseItem(overrides: Partial<ItemV2> = {}): ItemV2 {
  return {
    id: 'item_test_1',
    resourceId: 'ingot:iron',
    baseName: 'Iron Ingot',
    quantity: 5,
    quality: 'good',
    tier: 2,
    affixes: [],
    provenance: {
      method: 'smelted',
      parentLotId: 'ore_lot_1',
      makerCertId: 'cert_1',
      worldDay: 10,
    },
    ...overrides,
  }
}

describe('ItemV2 — heirloom / relic / artifact predicates', () => {
  it('isHeirloom returns false for plain item', () => {
    expect(isHeirloom(makeBaseItem())).toBe(false)
  })

  it('isHeirloom returns false for empty lineageChain', () => {
    const item = makeBaseItem({ lineageChain: [] })
    expect(isHeirloom(item)).toBe(false)
  })

  it('isHeirloom returns true for item with at least one owner', () => {
    const item = makeBaseItem({
      lineageChain: [{ holderId: 'npc_elara', fromDay: 1, toDay: 100 }],
    })
    expect(isHeirloom(item)).toBe(true)
  })

  it('isRelic returns false for plain item', () => {
    expect(isRelic(makeBaseItem())).toBe(false)
  })

  it('isRelic returns true when religiousSignificance set', () => {
    const item = makeBaseItem({
      religiousSignificance: { deityId: 'tyr', originEvent: 'The Judgment War' },
    })
    expect(isRelic(item)).toBe(true)
  })

  it('isArtifact returns false for plain item', () => {
    expect(isArtifact(makeBaseItem())).toBe(false)
  })

  it('isArtifact returns true when uniqueness set', () => {
    const item = makeBaseItem({
      uniqueness: { loreText: 'Forged in the heart of a dying star.', magicalProperties: ['eternal_flame'] },
    })
    expect(isArtifact(item)).toBe(true)
  })

  it('an item can be all three simultaneously', () => {
    const item = makeBaseItem({
      lineageChain: [{ holderId: 'hero_1', fromDay: 0 }],
      religiousSignificance: { deityId: 'helm' },
      uniqueness: { loreText: 'The Shard of Helm', magicalProperties: ['protection_aura'] },
    })
    expect(isHeirloom(item)).toBe(true)
    expect(isRelic(item)).toBe(true)
    expect(isArtifact(item)).toBe(true)
  })

  it('ItemV2Schema parses item with all three bags', () => {
    const raw = makeBaseItem({
      lineageChain: [{ holderId: 'king_1', fromDay: 5, toDay: 200 }],
      religiousSignificance: { deityId: 'mystra', originEvent: 'Weave-Mending' },
      uniqueness: { loreText: 'The Orb of Mystra', magicalProperties: ['spell_absorption', 'scrying'] },
    })
    expect(() => ItemV2Schema.parse(raw)).not.toThrow()
  })
})

// ============================================================
// FACTION — CULT / SANCTUARY
// ============================================================

describe('Faction — cult and sanctuary types', () => {
  beforeEach(() => resetFactionIdCounter())

  it('creates a cult faction with secrecyLevel', () => {
    const f = createFaction('Brotherhood of the Veil', 'cult', 'darkshire')
    expect(f.type).toBe('cult')
    expect(() => FactionSchema.parse({ ...f, secrecyLevel: 'hidden' })).not.toThrow()
  })

  it('FactionSchema accepts all secrecyLevel values', () => {
    const base = createFaction('Shadow Cult', 'cult', 'node_1')
    for (const level of ['open', 'discreet', 'hidden', 'forbidden'] as const) {
      expect(() => FactionSchema.parse({ ...base, secrecyLevel: level })).not.toThrow()
    }
  })

  it('creates a sanctuary faction', () => {
    const f = createFaction('Temple of Ilmater', 'sanctuary', 'candlekeep')
    expect(f.type).toBe('sanctuary')
    expect(() => FactionSchema.parse({
      ...f,
      refugeProtections: ['no_violence', 'asylum_guaranteed'],
      accessRules: 'All who seek shelter may enter without arms.',
    })).not.toThrow()
  })

  it('FactionSchema rejects unknown type', () => {
    const f = createFaction('Test', 'guild', 'node_1')
    expect(() => FactionSchema.parse({ ...f, type: 'pirate_crew' })).toThrow()
  })

  it('secrecyLevel is optional (omitted for non-cult factions)', () => {
    const f = createFaction('Harpers', 'guild', 'waterdeep')
    expect(() => FactionSchema.parse(f)).not.toThrow()
    expect(f.secrecyLevel).toBeUndefined()
  })
})

// ============================================================
// TREATY — Promoted from string[] to Treaty[]
// ============================================================

describe('Treaty promotion', () => {
  beforeEach(() => resetTreatyIdCounter())

  it('createTreaty returns a Treaty object', () => {
    const t = createTreaty('faction_1', 'faction_2', ['no_raiding', 'open_trade'], 42)
    expect(t.id).toBeDefined()
    expect(t.factionA).toBe('faction_1')
    expect(t.factionB).toBe('faction_2')
    expect(t.terms).toContain('no_raiding')
    expect(t.signedDay).toBe(42)
    expect(t.status).toBe('active')
  })

  it('createTreaty with optional sponsor', () => {
    const t = createTreaty('f_a', 'f_b', ['peace'], 10, 'npc_mediator')
    expect(t.sponsorId).toBe('npc_mediator')
  })

  it('dissolveTreaty sets status to dissolved', () => {
    const t = createTreaty('f_a', 'f_b', ['peace'], 1)
    dissolveTreaty(t)
    expect(t.status).toBe('dissolved')
  })

  it('dissolveTreaty with "violated" reason', () => {
    const t = createTreaty('f_a', 'f_b', ['peace'], 1)
    dissolveTreaty(t, 'violated')
    expect(t.status).toBe('violated')
  })

  it('DiplomaticRelation.treaties holds Treaty objects (not strings)', () => {
    const t = createTreaty('f_a', 'f_b', ['terms'], 5)
    const relation: DiplomaticRelation = {
      id: 'rel_1',
      factionA: 'f_a',
      factionB: 'f_b',
      status: 'trade_pact',
      standing: 55,
      treaties: [t],
      lastChangedDay: 5,
    }
    expect(relation.treaties[0]).toHaveProperty('terms')
    expect(typeof relation.treaties[0]).toBe('object')
  })

  it('sequential ids are unique', () => {
    const t1 = createTreaty('f_a', 'f_b', [], 1)
    const t2 = createTreaty('f_a', 'f_c', [], 2)
    expect(t1.id).not.toBe(t2.id)
  })
})

// ============================================================
// LAW ENTITY
// ============================================================

describe('Law entity', () => {
  beforeEach(() => resetLawIdCounter())

  it('createLaw returns active law', () => {
    const law = createLaw('waterdeep', 'No open carry of arcane weapons in market district', 10, 'lord_piergeiron')
    expect(law.id).toBeDefined()
    expect(law.jurisdictionNodeId).toBe('waterdeep')
    expect(law.status).toBe('active')
    expect(law.sponsorId).toBe('lord_piergeiron')
    expect(law.repealDay).toBeUndefined()
  })

  it('repealLaw changes status to repealed and sets repealDay', () => {
    const law = createLaw('baldurs_gate', 'Mandatory guild registration for all craftsmen', 5, 'duke_eltan')
    repealLaw(law, 100)
    expect(law.status).toBe('repealed')
    expect(law.repealDay).toBe(100)
  })

  it('suspendLaw changes status to suspended', () => {
    const law = createLaw('waterdeep', 'Curfew after midnight', 20, 'magistrate_1')
    suspendLaw(law)
    expect(law.status).toBe('suspended')
  })

  it('getLawsAt filters by jurisdiction', () => {
    const law1 = createLaw('waterdeep', 'Tax on fish', 1, 'lord_1')
    const law2 = createLaw('baldurs_gate', 'Tax on iron', 2, 'lord_2')
    const law3 = createLaw('waterdeep', 'Curfew', 3, 'lord_1')
    const all = [law1, law2, law3]
    const waterdeep = getLawsAt('waterdeep', all)
    expect(waterdeep).toHaveLength(2)
    expect(waterdeep.every(l => l.jurisdictionNodeId === 'waterdeep')).toBe(true)
  })

  it('getLawsAt returns empty for unknown jurisdiction', () => {
    const law = createLaw('waterdeep', 'Some decree', 1, 'lord_1')
    expect(getLawsAt('neverwinter', [law])).toHaveLength(0)
  })

  it('law ids are sequential and unique', () => {
    const l1 = createLaw('node_1', 'First law', 1, 'sponsor_1')
    const l2 = createLaw('node_1', 'Second law', 2, 'sponsor_1')
    expect(l1.id).not.toBe(l2.id)
  })
})

// ============================================================
// DOCUMENT FAMILY
// ============================================================

describe('Document family', () => {
  beforeEach(() => resetDocumentIdCounter())

  it('createDocument(map) round-trips through DocumentSchema', () => {
    const doc = createDocument({
      kind: 'map',
      authorId: 'npc_cartographer',
      contentRef: 'idb://maps/suzail-region',
      createdDay: 15,
      depictedNodes: ['suzail', 'arabel', 'tilverton'],
    })
    expect(doc.id).toBeDefined()
    expect(doc.kind).toBe('map')
    expect(doc.depictedNodes).toContain('suzail')
    expect(() => DocumentSchema.parse(doc)).not.toThrow()
  })

  it('createDocument(letter) sets recipientId', () => {
    const doc = createDocument({
      kind: 'letter',
      authorId: 'npc_merchant',
      contentRef: 'idb://letters/letter_42',
      createdDay: 5,
      recipientId: 'player_char_1',
      title: 'A Plea for Help',
    })
    expect(doc.kind).toBe('letter')
    expect(doc.recipientId).toBe('player_char_1')
    expect(doc.title).toBe('A Plea for Help')
  })

  it('createDocument(tome) includes knowledgeSeedIds', () => {
    const doc = createDocument({
      kind: 'tome',
      authorId: 'archmage_elminster',
      contentRef: 'idb://tomes/spell-theory-vol1',
      createdDay: 200,
      knowledgeSeedIds: ['seed_arcane_theory', 'seed_planar_gates'],
      title: 'A Treatise on Planar Magic',
    })
    expect(doc.kind).toBe('tome')
    expect(doc.knowledgeSeedIds).toContain('seed_arcane_theory')
  })

  it('documentGrantsAccess returns true for map with the node', () => {
    const doc = createDocument({
      kind: 'map',
      authorId: 'npc_1',
      contentRef: 'ref_1',
      createdDay: 1,
      depictedNodes: ['suzail', 'arabel'],
    })
    expect(documentGrantsAccess(doc, 'suzail')).toBe(true)
    expect(documentGrantsAccess(doc, 'tilverton')).toBe(false)
  })

  it('documentGrantsAccess returns false for non-map documents', () => {
    const doc = createDocument({
      kind: 'letter',
      authorId: 'npc_1',
      contentRef: 'ref_2',
      createdDay: 2,
    })
    expect(documentGrantsAccess(doc, 'suzail')).toBe(false)
  })

  it('documentKnowledgeSeeds returns seeds for tomes', () => {
    const doc = createDocument({
      kind: 'tome',
      authorId: 'scholar_1',
      contentRef: 'ref_3',
      createdDay: 10,
      knowledgeSeedIds: ['seed_1', 'seed_2'],
    })
    expect(documentKnowledgeSeeds(doc)).toEqual(['seed_1', 'seed_2'])
  })

  it('documentKnowledgeSeeds returns seeds for manuscripts', () => {
    const doc = createDocument({
      kind: 'manuscript',
      authorId: 'scholar_2',
      contentRef: 'ref_4',
      createdDay: 11,
      knowledgeSeedIds: ['seed_flora'],
    })
    expect(documentKnowledgeSeeds(doc)).toContain('seed_flora')
  })

  it('documentKnowledgeSeeds returns [] for non-tome/manuscript', () => {
    const doc = createDocument({
      kind: 'letter',
      authorId: 'npc_1',
      contentRef: 'ref_5',
      createdDay: 3,
    })
    expect(documentKnowledgeSeeds(doc)).toEqual([])
  })

  it('defaults: language is "common", condition is "good", title is "Untitled"', () => {
    const doc = createDocument({
      kind: 'record',
      authorId: 'scribe_1',
      contentRef: 'ref_6',
      createdDay: 1,
    })
    expect(doc.language).toBe('common')
    expect(doc.condition).toBe('good')
    expect(doc.title).toBe('Untitled')
  })

  it('all six kinds pass DocumentSchema', () => {
    const kinds: DocumentKind[] = ['map', 'letter', 'manuscript', 'contract', 'record', 'tome']
    for (const kind of kinds) {
      const doc = createDocument({ kind, authorId: 'a', contentRef: 'r', createdDay: 1 })
      expect(() => DocumentSchema.parse(doc)).not.toThrow()
    }
  })

  it('doc ids are sequential', () => {
    const d1 = createDocument({ kind: 'letter', authorId: 'a', contentRef: 'r', createdDay: 1 })
    const d2 = createDocument({ kind: 'letter', authorId: 'b', contentRef: 'r', createdDay: 2 })
    expect(d1.id).not.toBe(d2.id)
  })
})
