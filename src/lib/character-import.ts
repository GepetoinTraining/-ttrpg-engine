/**
 * D&D Beyond PDF importer (form-field based).
 *
 * D&D Beyond exports the multi-page character sheet as a PDF with AcroForm
 * fields holding every value (text content rendering is mostly labels). We
 * read all annotations across all pages, build a `fieldName → fieldValue`
 * map, and extract by name.
 *
 * Field names observed in the sample (Aiji Kazuya · Wizard 12 High Elf):
 *   CharacterName, "CLASS  LEVEL" (note double-space), "PLAYER NAME",
 *   RACE, BACKGROUND, "EXPERIENCE POINTS", STR/DEX/CON/INT/WIS/CHA + Mod,
 *   AC, MaxHP, "Current HP", TempHP, HitDice, Initiative,
 *   StrProf/DexProf/.../ChaProf ("•" when proficient save),
 *   <Skill>, <Skill>Mod, <Skill>Prof ("P" / "E"),
 *   ProficienciesLang ("=== WEAPONS === \n... === TOOLS === \n... === LANGUAGES === \n..."),
 *   FeaturesTraits1, FeaturesTraits2, FeaturesTraits3, FeaturesTraits4,
 *   PersonalityTraits, Ideals, Bonds, Flaws, Backstory, AlliesOrganizations,
 *   CharacterAppearance, AdditionalNotes1,
 *   "Eq Name0..N", "Eq Qty0..N", "Eq Weight0..N",
 *   "Attuned Name1..N", "Attuned Qty1..N", "Attuned Weight1..N",
 *   CP/SP/EP/GP/PP (currency, despite names — D&D Beyond's fields don't
 *     map cleanly to coin types; we expose all five and let the review UI
 *     fix labels),
 *   "Wpn Name", "Wpn Name 2..6", "Wpn1..6 AtkBonus", "Wpn1..6 Damage",
 *   "Wpn Notes 1..6",
 *   spellCastingClass0, spellCastingAbility0, spellSaveDC0, spellAtkBonus0,
 *   spellHeader0..N (== CANTRIPS / 1st LEVEL / ...),
 *   spellSlotHeader0..N, spellName0..M, spellPrepared0..M, spellSaveAtk0..M,
 *   spellCastingTime0..M, spellRange0..M, spellComponents0..M, spellDuration0..M,
 *   spellPageRef0..M, spellNotes0..M.
 *
 * Spell level assignment uses the rect Y-coordinate of each spell name
 * vs each header to walk visual order top-down.
 */

import { ABILITIES, type Ability } from '@/game/chargen'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ImportedCharacter {
  draft: {
    name: string
    raceKey: string
    raceLabel: string
    subrace?: string
    classKey: string
    classLabel: string
    level: number
    abilityScores: Record<Ability, number>
    background?: string
    alignment?: string
  }
  persona: {
    field: 'backstory' | 'personality' | 'ideal' | 'bond' | 'flaw' | 'ally' | 'note' | 'appearance' | 'faith' | 'alignment'
    value: string
    ord: number
  }[]
  spells: { name: string; level: number; ritual: boolean; concentration: boolean; prepared: boolean; range?: string; duration?: string; components?: string }[]
  equipment: { name: string; qty: number; weight?: number; attuned?: boolean }[]
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number }
  skills: Record<string, { proficient: boolean; expertise: boolean; modifier?: number }>
  saveProficiencies: Ability[]
  proficiencies: { weapons: string[]; tools: string[]; languages: string[] }
  features: { source: string; text: string }[]
  weapons: { name: string; atkBonus: string; damage: string; notes?: string }[]
  /** Combat numbers from the PDF (post-racial, post-armor — already-final). */
  combat: {
    ac?: number
    initiative?: number
    speed?: string
    hpMax?: number
    hpCurrent?: number
    proficiencyBonus?: number
  }
  warnings: string[]
}

// ─── Race / class key maps ─────────────────────────────────────────────────

const RACE_KEY_MAP: Record<string, string> = {
  human: 'human', 'variant human': 'human',
  elf: 'elf', 'high elf': 'elf', 'wood elf': 'elf', 'dark elf': 'elf', drow: 'elf',
  dwarf: 'dwarf', 'hill dwarf': 'dwarf', 'mountain dwarf': 'dwarf',
  halfling: 'halfling', 'lightfoot halfling': 'halfling', 'stout halfling': 'halfling',
  gnome: 'gnome', 'forest gnome': 'gnome', 'rock gnome': 'gnome',
  'half-elf': 'half-elf', 'half elf': 'half-elf',
  'half-orc': 'half-orc', 'half orc': 'half-orc',
  tiefling: 'tiefling', dragonborn: 'dragonborn',
}

const CLASS_KEY_MAP: Record<string, string> = {
  barbarian: 'barbarian', bard: 'bard', cleric: 'cleric', druid: 'druid',
  fighter: 'fighter', monk: 'monk', paladin: 'paladin', ranger: 'ranger',
  rogue: 'rogue', sorcerer: 'sorcerer', warlock: 'warlock', wizard: 'wizard',
}

// ─── Field extraction ──────────────────────────────────────────────────────

interface RawField {
  name: string
  value: string
  type: string  // 'Tx' (text) | 'Btn' | etc.
  page: number
  /** PDF rect [x1, y1, x2, y2] (bottom-up Y). */
  rect?: [number, number, number, number]
}

async function loadFields(pdfBytes: Uint8Array): Promise<{ fields: RawField[]; numPages: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableWorker: true,
  } as any).promise

  const out: RawField[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const annots = await page.getAnnotations()
    for (const a of annots as any[]) {
      if (!a.fieldName) continue
      const v = a.fieldValue
      if (v === undefined || v === null) continue
      out.push({
        name: a.fieldName,
        value: typeof v === 'string' ? v : String(v),
        type: a.fieldType ?? '?',
        page: p,
        rect: Array.isArray(a.rect) && a.rect.length === 4 ? (a.rect as [number, number, number, number]) : undefined,
      })
    }
  }
  return { fields: out, numPages: doc.numPages }
}

function fieldMap(fields: RawField[]): Map<string, RawField> {
  // Use the first occurrence (page 1 wins over the per-page duplicates like
  // CharacterName2 / CharacterName3 that sit on subsequent pages' headers).
  const m = new Map<string, RawField>()
  for (const f of fields) {
    if (!m.has(f.name)) m.set(f.name, f)
  }
  return m
}

function getStr(map: Map<string, RawField>, name: string): string {
  return (map.get(name)?.value ?? '').trim()
}

function getInt(map: Map<string, RawField>, name: string): number | null {
  const s = getStr(map, name)
  if (!s) return null
  const m = s.match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function parseModifier(s: string): number | undefined {
  if (!s) return undefined
  const m = s.match(/(-|\+)?(\d+)/)
  if (!m) return undefined
  const sign = m[1] === '-' ? -1 : 1
  return sign * parseInt(m[2], 10)
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function importDnDBeyondPdf(pdfBytes: Uint8Array): Promise<ImportedCharacter> {
  const { fields } = await loadFields(pdfBytes)
  const map = fieldMap(fields)
  const warnings: string[] = []

  // Cover block
  const name = getStr(map, 'CharacterName')
  const classLevel = getStr(map, 'CLASS  LEVEL') || getStr(map, 'CLASS LEVEL') || getStr(map, 'CLASS & LEVEL')
  const raceLabel = getStr(map, 'RACE')
  const background = getStr(map, 'BACKGROUND') || undefined
  const xp = getStr(map, 'EXPERIENCE POINTS') || undefined

  let classLabel = '', classKey = '', level = 1
  const m = classLevel.match(/^([A-Za-z][A-Za-z\- ]*?)\s+(\d{1,2})$/)
  if (m) {
    classLabel = m[1].trim()
    classKey = CLASS_KEY_MAP[classLabel.toLowerCase()] ?? classLabel.toLowerCase()
    level = Math.max(1, Math.min(20, parseInt(m[2], 10)))
  } else if (classLevel) {
    warnings.push(`Could not parse class & level: "${classLevel}"`)
    classLabel = classLevel
  }

  let raceKey = ''
  let subrace: string | undefined
  const lowerRace = raceLabel.toLowerCase()
  if (RACE_KEY_MAP[lowerRace]) {
    raceKey = RACE_KEY_MAP[lowerRace]
    if (lowerRace !== raceKey) subrace = raceLabel
  } else {
    const first = lowerRace.split(' ')[0]
    raceKey = RACE_KEY_MAP[first] ?? first
    if (lowerRace !== raceKey) subrace = raceLabel
  }

  // Ability scores
  const abilityScores: Record<Ability, number> = {
    strength: getInt(map, 'STR') ?? 10,
    dexterity: getInt(map, 'DEX') ?? 10,
    constitution: getInt(map, 'CON') ?? 10,
    intelligence: getInt(map, 'INT') ?? 10,
    wisdom: getInt(map, 'WIS') ?? 10,
    charisma: getInt(map, 'CHA') ?? 10,
  }

  // Save proficiencies — look at <Ability>Prof fields ("•" when set).
  const saveProficiencies: Ability[] = []
  const profMap: { ability: Ability; field: string }[] = [
    { ability: 'strength', field: 'StrProf' },
    { ability: 'dexterity', field: 'DexProf' },
    { ability: 'constitution', field: 'ConProf' },
    { ability: 'intelligence', field: 'IntProf' },
    { ability: 'wisdom', field: 'WisProf' },
    { ability: 'charisma', field: 'ChaProf' },
  ]
  for (const { ability, field } of profMap) {
    const v = getStr(map, field)
    if (v) saveProficiencies.push(ability)
  }

  // Skills — D&D Beyond uses a mix of full and shortened field names:
  //   "Acrobatics" / "AcrobaticsMod"
  //   "Animal" / "AnimalMod" / "AnimalHandlingProf"
  //   "Arcana" / "ArcanaMod" / "ArcanaProf"
  //   ... and so on. Build a per-skill dispatch.
  const skillSpec: { label: string; valueField: string; profField: string }[] = [
    { label: 'Acrobatics', valueField: 'Acrobatics', profField: 'AcrobaticsProf' },
    { label: 'Animal Handling', valueField: 'Animal', profField: 'AnimalHandlingProf' },
    { label: 'Arcana', valueField: 'Arcana', profField: 'ArcanaProf' },
    { label: 'Athletics', valueField: 'Athletics', profField: 'AthleticsProf' },
    { label: 'Deception', valueField: 'Deception', profField: 'DeceptionProf' },
    { label: 'History', valueField: 'History', profField: 'HistoryProf' },
    { label: 'Insight', valueField: 'Insight', profField: 'InsightProf' },
    { label: 'Intimidation', valueField: 'Intimidation', profField: 'IntimidationProf' },
    { label: 'Investigation', valueField: 'Investigation', profField: 'InvestigationProf' },
    { label: 'Medicine', valueField: 'Medicine', profField: 'MedicineProf' },
    { label: 'Nature', valueField: 'Nature', profField: 'NatureProf' },
    { label: 'Perception', valueField: 'Perception', profField: 'PerceptionProf' },
    { label: 'Performance', valueField: 'Performance', profField: 'PerformanceProf' },
    { label: 'Persuasion', valueField: 'Persuasion', profField: 'PersuasionProf' },
    { label: 'Religion', valueField: 'Religion', profField: 'ReligionProf' },
    { label: 'Sleight of Hand', valueField: 'Sleight', profField: 'SleightOfHandProf' },
    { label: 'Stealth', valueField: 'Stealth', profField: 'StealthProf' },
    { label: 'Survival', valueField: 'Survival', profField: 'SurvivalProf' },
  ]
  const skills: ImportedCharacter['skills'] = {}
  for (const s of skillSpec) {
    const profCode = getStr(map, s.profField)
    skills[s.label] = {
      proficient: profCode === 'P' || profCode === 'E' || profCode === '•',
      expertise: profCode === 'E',
      modifier: parseModifier(getStr(map, s.valueField)),
    }
  }

  // Proficiencies block lives in ProficienciesLang as one big string.
  const profsBlock = getStr(map, 'ProficienciesLang')
  const proficiencies = parseProficienciesBlock(profsBlock)

  // Equipment
  const equipment: ImportedCharacter['equipment'] = []
  for (let i = 0; i < 50; i++) {
    const name = getStr(map, `Eq Name${i}`)
    if (!name) continue
    const qty = getInt(map, `Eq Qty${i}`) ?? 1
    const weight = parseWeight(getStr(map, `Eq Weight${i}`))
    equipment.push({ name, qty, weight })
  }
  for (let i = 1; i <= 20; i++) {
    const name = getStr(map, `Attuned Name${i}`)
    if (!name) continue
    const qty = getInt(map, `Attuned Qty${i}`) ?? 1
    const weight = parseWeight(getStr(map, `Attuned Weight${i}`))
    equipment.push({ name, qty, weight, attuned: true })
  }

  // Currency
  const currency = {
    cp: getInt(map, 'CP') ?? 0,
    sp: getInt(map, 'SP') ?? 0,
    ep: getInt(map, 'EP') ?? 0,
    gp: getInt(map, 'GP') ?? 0,
    pp: getInt(map, 'PP') ?? 0,
  }

  // Persona (page 4)
  const persona: ImportedCharacter['persona'] = []
  pushPersona(persona, 'personality', getStr(map, 'PersonalityTraits') || getStr(map, 'PersonalityTraits '))
  pushPersona(persona, 'ideal', getStr(map, 'Ideals'))
  pushPersona(persona, 'bond', getStr(map, 'Bonds'))
  pushPersona(persona, 'flaw', getStr(map, 'Flaws'))
  pushPersona(persona, 'backstory', getStr(map, 'Backstory'))
  pushPersona(persona, 'appearance', getStr(map, 'CharacterAppearance'))
  pushPersona(persona, 'ally', getStr(map, 'AlliesOrganizations'))
  pushPersona(persona, 'note', getStr(map, 'AdditionalNotes1'))
  pushPersona(persona, 'note', getStr(map, 'AdditionalNotes2'))
  pushPersona(persona, 'faith', getStr(map, 'FAITH'))
  // Alignment goes in the draft.alignment if present
  const alignment = getStr(map, 'ALIGNMENT') || undefined

  // Features (5 columns of feature blocks)
  const features: ImportedCharacter['features'] = []
  for (let i = 1; i <= 6; i++) {
    const text = getStr(map, `FeaturesTraits${i}`)
    if (text) features.push({ source: `FeaturesTraits${i}`, text })
  }

  // Weapons table
  const weapons: ImportedCharacter['weapons'] = []
  const wpnNames = [
    getStr(map, 'Wpn Name'),
    getStr(map, 'Wpn Name 2'),
    getStr(map, 'Wpn Name 3'),
    getStr(map, 'Wpn Name 4'),
    getStr(map, 'Wpn Name 5'),
    getStr(map, 'Wpn Name 6'),
  ]
  for (let i = 0; i < wpnNames.length; i++) {
    const name = wpnNames[i]
    if (!name) continue
    const idx = i + 1
    weapons.push({
      name,
      atkBonus: getStr(map, `Wpn${idx} AtkBonus`),
      damage: getStr(map, `Wpn${idx} Damage`),
      notes: getStr(map, `Wpn Notes ${idx}`) || undefined,
    })
  }

  // Spells — assign each spellNameN to its level by Y-rect ordering.
  const spells = parseSpells(fields)

  // Combat numbers (from the PDF — already-final after armor / race / etc).
  const combat = {
    ac: getInt(map, 'AC') ?? undefined,
    initiative: parseModifier(getStr(map, 'Initiative')),
    speed: getStr(map, 'Speed') || undefined,
    hpMax: getInt(map, 'Max HP') ?? getInt(map, 'MaxHP') ?? undefined,
    hpCurrent: getInt(map, 'Current HP') ?? getInt(map, 'CurrentHP') ?? undefined,
    proficiencyBonus: parseModifier(getStr(map, 'ProfBonus')),
  }

  return {
    draft: { name, raceKey, raceLabel, subrace, classKey, classLabel, level, abilityScores, background, alignment },
    persona,
    spells,
    equipment,
    currency,
    skills,
    saveProficiencies,
    proficiencies,
    features,
    weapons,
    combat,
    warnings,
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseWeight(s: string): number | undefined {
  if (!s || s === '--') return undefined
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : undefined
}

function pushPersona(
  list: ImportedCharacter['persona'],
  field: ImportedCharacter['persona'][number]['field'],
  raw: string,
) {
  if (!raw) return
  // Split on multiple newlines; each line is its own entry.
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^={3,}/.test(l) && !/^={3,}.*={3,}$/.test(l))
  lines.forEach((value, ord) => list.push({ field, value, ord }))
}

function parseProficienciesBlock(s: string): { weapons: string[]; tools: string[]; languages: string[] } {
  const out = { weapons: [] as string[], tools: [] as string[], languages: [] as string[] }
  if (!s) return out
  // The block uses === HEADER === markers.
  const sections = s.split(/={3,}\s*([A-Z &]+?)\s*={3,}/i).map((p) => p.trim()).filter(Boolean)
  // After splitting on the regex with capture, sections alternate: [text], header, content, header, content, ...
  for (let i = 0; i < sections.length - 1; i += 2) {
    const header = sections[i].toUpperCase()
    const content = sections[i + 1]
    const items = content.split(',').map((x) => x.trim()).filter(Boolean)
    if (/WEAPON/.test(header)) out.weapons.push(...items)
    else if (/TOOL/.test(header)) out.tools.push(...items)
    else if (/LANGUAGE/.test(header)) out.languages.push(...items)
  }
  return out
}

function parseSpells(fields: RawField[]): ImportedCharacter['spells'] {
  const headers = fields.filter((f) => /^spellHeader\d+$/.test(f.name) && f.value)
  const names = fields.filter((f) => /^spellName\d+$/.test(f.name) && f.value)
  const prepared = new Map<string, string>()
  const range = new Map<string, string>()
  const duration = new Map<string, string>()
  const components = new Map<string, string>()
  for (const f of fields) {
    const m = f.name.match(/^spell(Prepared|Range|Duration|Components)(\d+)$/)
    if (!m) continue
    const idx = m[2]
    if (m[1] === 'Prepared') prepared.set(idx, f.value)
    else if (m[1] === 'Range') range.set(idx, f.value)
    else if (m[1] === 'Duration') duration.set(idx, f.value)
    else if (m[1] === 'Components') components.set(idx, f.value)
  }

  // PDF coords are bottom-up, so a header is visually ABOVE a spell when
  // header.y > spell.y. For each spell, the relevant header is the one with
  // the SMALLEST Y that is still ≥ the spell's Y (i.e., the immediate header
  // preceding the spell visually). Sort ascending and pick the first match.
  const headersByY = headers
    .map((h) => ({ ...h, y: h.rect ? h.rect[3] : 0, idx: parseInt(h.name.replace('spellHeader', ''), 10) }))
    .sort((a, b) => a.y - b.y)

  function levelFromHeaderText(t: string): number {
    if (/CANTRIP/i.test(t)) return 0
    const m = t.match(/(\d+)/)
    return m ? parseInt(m[1], 10) : 0
  }

  const out: ImportedCharacter['spells'] = []
  for (const n of names) {
    const idx = n.name.replace('spellName', '')
    const ny = n.rect ? n.rect[3] : 0
    const header = headersByY.find((h) => h.y >= ny) ?? headersByY[0]
    const level = header ? levelFromHeaderText(header.value) : 0
    const ritual = /\[R\]/.test(n.value)
    const cleanName = n.value.replace(/\s*\[R\]\s*$/, '').trim()
    const dur = duration.get(idx) ?? ''
    const concentration = /Concentration/i.test(dur)
    out.push({
      name: cleanName,
      level,
      ritual,
      concentration,
      prepared: (prepared.get(idx) ?? '').trim().toUpperCase() === 'X',
      range: range.get(idx),
      duration: dur || undefined,
      components: components.get(idx),
    })
  }
  return out
}
