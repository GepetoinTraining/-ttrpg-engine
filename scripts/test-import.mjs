import fs from 'node:fs/promises'

async function main() {
  const path = process.argv[2] ?? 'C:/Users/CLIENTE/Downloads/Nihonjin_144281469.pdf'
  const bytes = await fs.readFile(path)

  // Dynamic import of the parser via tsx-equivalent — for the smoke test we
  // duplicate the import logic inline so we don't need a TS runner.
  // (The real endpoint will import character-import.ts directly.)

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableWorker: true,
  }).promise

  const fields = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const annots = await page.getAnnotations()
    for (const a of annots) {
      if (!a.fieldName) continue
      const v = a.fieldValue
      if (v === undefined || v === null) continue
      fields.push({
        name: a.fieldName,
        value: typeof v === 'string' ? v : String(v),
        rect: a.rect,
      })
    }
  }

  // Quick verification — extract just the headlines.
  const map = new Map()
  for (const f of fields) if (!map.has(f.name)) map.set(f.name, f)
  const get = (k) => (map.get(k)?.value ?? '').trim()

  console.log('=== DRAFT ===')
  console.log('Name:        ', get('CharacterName'))
  console.log('Class&Level: ', get('CLASS  LEVEL'))
  console.log('Race:        ', get('RACE'))
  console.log('Background:  ', get('BACKGROUND'))
  console.log('XP:          ', get('EXPERIENCE POINTS'))
  console.log('Alignment:   ', get('ALIGNMENT'))
  console.log('Abilities:   ', `STR ${get('STR')} DEX ${get('DEX')} CON ${get('CON')} INT ${get('INT')} WIS ${get('WIS')} CHA ${get('CHA')}`)
  console.log('Save Profs:  ', ['Str','Dex','Con','Int','Wis','Cha'].filter(a => get(a + 'Prof')).join(' · '))
  console.log('AC:          ', get('AC'))
  console.log('HP:          ', `${get('Current HP')||get('CurrentHP')||get('Max HP')||get('MaxHP')||'?'} / ${get('Max HP')||get('MaxHP')||'?'}`)
  console.log('Currency:    ', `CP ${get('CP')} SP ${get('SP')} EP ${get('EP')} GP ${get('GP')} PP ${get('PP')}`)
  console.log('')

  // Skills sample
  console.log('=== SKILLS (proficient/expertise) ===')
  const skillProfMap = {
    Acrobatics: 'AcrobaticsProf', 'Animal Handling': 'AnimalHandlingProf', Arcana: 'ArcanaProf',
    Athletics: 'AthleticsProf', Deception: 'DeceptionProf', History: 'HistoryProf',
    Insight: 'InsightProf', Intimidation: 'IntimidationProf', Investigation: 'InvestigationProf',
    Medicine: 'MedicineProf', Nature: 'NatureProf', Perception: 'PerceptionProf',
    Performance: 'PerformanceProf', Persuasion: 'PersuasionProf', Religion: 'ReligionProf',
    'Sleight of Hand': 'SleightOfHandProf', Stealth: 'StealthProf', Survival: 'SurvivalProf',
  }
  for (const [skill, profField] of Object.entries(skillProfMap)) {
    const prof = get(profField)
    if (prof) console.log(`  ${skill.padEnd(18)} → ${prof === 'E' ? 'EXPERTISE' : 'proficient'}`)
  }

  console.log('\n=== EQUIPMENT (first 12) ===')
  for (let i = 0; i < 12; i++) {
    const n = get(`Eq Name${i}`)
    if (!n) continue
    console.log(`  ${n.padEnd(28)} qty=${get(`Eq Qty${i}`)} weight=${get(`Eq Weight${i}`)}`)
  }
  for (let i = 1; i <= 5; i++) {
    const n = get(`Attuned Name${i}`)
    if (!n) continue
    console.log(`  ★ attuned: ${n}`)
  }

  console.log('\n=== PERSONA snippets ===')
  for (const [k, lbl] of [['PersonalityTraits','personality'],['Ideals','ideal'],['Bonds','bond'],['Flaws','flaw'],['AlliesOrganizations','allies']]) {
    const v = get(k)
    if (v) console.log(`  ${lbl}:`, v.replace(/\s+/g, ' ').slice(0, 100))
  }
  const bs = get('Backstory')
  if (bs) console.log(`  backstory (first 150): ${bs.replace(/\s+/g, ' ').slice(0, 150)}…`)

  console.log('\n=== SPELLS ===')
  const headers = fields.filter(f => /^spellHeader\d+$/.test(f.name) && f.value)
    .map(f => ({ name: f.name, value: f.value, y: f.rect?.[3] ?? 0 }))
    .sort((a, b) => a.y - b.y)  // ascending — closest header above spell has smallest y >= spell.y
  const names = fields.filter(f => /^spellName\d+$/.test(f.name) && f.value)
    .map(f => ({ name: f.name, value: f.value, y: f.rect?.[3] ?? 0 }))
  function levelOf(t) {
    if (/CANTRIP/i.test(t)) return 0
    const m = t.match(/(\d+)/); return m ? +m[1] : 0
  }
  const counts = {}
  const byLevel = {}
  for (const n of names) {
    const h = headers.find(h => h.y >= n.y) ?? headers[0]
    const lvl = h ? levelOf(h.value) : 0
    counts[lvl] = (counts[lvl] || 0) + 1
    if (!byLevel[lvl]) byLevel[lvl] = []
    byLevel[lvl].push(n.value)
  }
  console.log(`  total spells: ${names.length}`)
  console.log(`  by level: ${JSON.stringify(counts)}`)
  for (const lvl of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    if (byLevel[lvl]) console.log(`  L${lvl}: ${byLevel[lvl].join(', ')}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
