// @ts-nocheck
'use client'

import React from 'react'
import { RACES, CLASSES, BACKGROUNDS, BACKGROUND_LIST, ABILITIES, STANDARD_ARRAY, abilityModifier, calculateStartingHp, findSubrace, rollStartingGold, STARTING_GOLD_DICE } from '@/game/chargen'
import { createCharacter, setActiveCharacter, importPdf } from '@/lib/character'
import { loadCert } from '@/lib/auth'
import { attachCharacterData, setActiveCharacter as setActiveCharacterCert } from '@/lib/character-cert'
import { loadAccount } from '@/lib/account-cert'
import { FourDSixDropOne, type FourDSixResult } from '@/components/dice/DiceRoller'
import { SPELL_ELEMENTS, composeSpell, calculateSpellLevel, getSpellSchool } from '../../../../engine/magic'
import { EQUIPMENT_CATALOG, searchEquipment, type CatalogItem, type EquipmentCategory } from '@/game/equipment'

// surfaces/Chargen.tsx — wired stepper. Draft state lifted to top. Race / class /
// ability score inputs feed `draft`. Other steps remain mostly visual; their
// hardcoded selections still get saved when the Review step commits.
//
// Step 00 · Import: optional D&D Beyond PDF upload that pre-fills the draft.

const CHARGEN_STEPS = [
  {k:'import',   n:'00', l:'Import'},
  {k:'race',     n:'01', l:'Race'},
  {k:'class',    n:'02', l:'Class'},
  {k:'abilities',n:'03', l:'Abilities'},
  {k:'skills',   n:'04', l:'Skills'},
  {k:'background',n:'05',l:'Background'},
  {k:'spells',   n:'06', l:'Spells'},
  {k:'equipment',n:'07', l:'Equipment'},
  {k:'review',   n:'08', l:'Review'},
];

const DEFAULT_DRAFT = {
  name: '',
  raceKey: 'half-elf',
  subrace: '',
  classKey: 'rogue',
  /** Subclass key — fixed at L3 for most classes, L1/L2 for some (cleric, sorcerer, warlock, wizard, druid). */
  subclass: '',
  /** How were ability scores generated? Affects which UI is active. */
  abilityMethod: 'point-buy' as 'point-buy' | 'standard-array' | '4d6-drop' | 'heroic',
  abilityScores: {
    strength: STANDARD_ARRAY[5],     // 8
    dexterity: STANDARD_ARRAY[0],    // 15
    constitution: STANDARD_ARRAY[2], // 13
    intelligence: STANDARD_ARRAY[3], // 12
    wisdom: STANDARD_ARRAY[1],       // 14
    charisma: STANDARD_ARRAY[4],     // 10
  },
  /** Rolled values pool when using 4d6-drop / heroic. Each entry pairs with one ability. */
  rolledScores: [] as number[],
  /** Per-slot roll count (0-2). Used to gate the single reroll allowance. */
  rolledRollCounts: [0, 0, 0, 0, 0, 0] as number[],
  /**
   * Map ability → rolledScores index. Drives both the score AND the
   * assignment pool (an index already in this map is consumed).
   */
  abilityAssignments: {} as Record<string, number>,
  /**
   * Once the player commits to a rolling method, the method is locked —
   * the other method options disappear so they can't escape bad rolls
   * by switching to point-buy / standard-array.
   */
  methodLocked: false,
  /** Skill proficiencies (selected by player from class.skillChoices.from). */
  skillProficiencies: [] as string[],
  /**
   * Starting spells composed by the player from the prime-element system
   * (engine/magic.ts). Cantrip is L0 (Minor intensity), spell1 is L1 (Lesser).
   * Only relevant for casters — non-casters leave these empty.
   */
  startingSpells: {
    cantrip: { elements: {} as Record<string, number>, name: '' },
    spell1: { elements: {} as Record<string, number>, name: '' },
  },
  background: 'acolyte',
  alignment: 'Chaotic Good',
  hook: '',
  // Equipment V2: 'kit' uses class+background defaults (V1), 'roll' lets the player
  // roll starting gold and shop the catalog.
  equipmentMode: 'kit' as 'kit' | 'roll',
  startingGold: 0,
  /** Cart for 'roll' mode — itemKey → quantity. */
  cart: {} as Record<string, number>,
}

/**
 * Read the campaign id from the URL hash OR the URL search string.
 * Hash form (`#chargen?campaign=X`) is set when chargen is mounted inside
 * the workspace shell. Search form (`/chargen?campaign=X`) is set by the
 * `/onboarding/[token]` invite redemption flow. Without this fallback,
 * invited players land on `/chargen?campaign=X` and the campaignId is
 * silently dropped — character gets created with no party / no spawn.
 */
function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q !== -1) {
    const fromHash = new URLSearchParams(h.slice(q + 1)).get('campaign')
    if (fromHash) return fromHash
  }
  return new URLSearchParams(window.location.search).get('campaign')
}

/**
 * Read the certId param from the URL hash OR the URL search string.
 * Hash form is set by CharacterSelect (`#chargen?certId=X`) when chargen
 * is mounted inside the workspace shell. Search form is set by the
 * `/onboarding/[token]` invite redemption flow when it lands the player
 * on the standalone `/chargen?certId=X` route. Either way, chargen
 * attaches the new character row to this cert on commit.
 */
function readCertIdFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q !== -1) {
    const fromHash = new URLSearchParams(h.slice(q + 1)).get('certId')
    if (fromHash) return fromHash
  }
  const fromSearch = new URLSearchParams(window.location.search).get('certId')
  return fromSearch
}

export default function Chargen() {
  const [step, setStep] = React.useState('import');
  const [draft, setDraft] = React.useState({...DEFAULT_DRAFT})
  const [campaignId, setCampaignId] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [committing, setCommitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<{ id: string; name: string } | null>(null)
  const [imported, setImported] = React.useState<any | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setCampaignId(readCampaignFromHash())
    const cert = loadCert()
    setUserId(cert?.id ?? null)
    // Pull preferred name + hook from player prefs if available.
    if (typeof window !== 'undefined') {
      const cid = readCampaignFromHash()
      if (cid) {
        try {
          const stored = window.localStorage.getItem(`claudedm:player-prefs:${cid}`)
          if (stored) {
            const prefs = JSON.parse(stored)
            setDraft((d) => ({
              ...d,
              hook: prefs.hook ?? d.hook,
              // handle = player handle, NOT pc name; left as-is
            }))
          }
        } catch {}
      }
    }
  }, [])

  const update = (patch: any) => setDraft((d) => ({ ...d, ...patch }))
  const updateAbility = (ability: string, delta: number) =>
    setDraft((d) => ({
      ...d,
      abilityScores: {
        ...d.abilityScores,
        [ability]: Math.max(8, Math.min(15, d.abilityScores[ability] + delta)),
      },
    }))

  const handleImportFile = async (file: File) => {
    setImportError(null)
    setImporting(true)
    try {
      const { imported: parsed } = await importPdf(file)
      setImported(parsed)
      // Pre-fill the draft with what we got from the PDF.
      setDraft((d) => ({
        ...d,
        name: parsed.draft.name || d.name,
        raceKey: parsed.draft.raceKey || d.raceKey,
        subrace: parsed.draft.subrace || d.subrace,
        classKey: parsed.draft.classKey || d.classKey,
        abilityScores: parsed.draft.abilityScores ?? d.abilityScores,
        background: parsed.draft.background || d.background,
        alignment: parsed.draft.alignment || d.alignment,
        hook: parsed.persona?.find((p: any) => p.field === 'personality')?.value ?? d.hook,
      }))
    } catch (e: any) {
      setImportError(e?.message ?? 'import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleCommit = async () => {
    setError(null)
    setCommitting(true)
    try {
      const skillsForCommit = imported?.skills
        ? Object.fromEntries(
            Object.entries(imported.skills).map(([k, v]: any) => [k, { proficient: v.proficient, expertise: v.expertise }])
          )
        : undefined

      // Compose starter inventory.
      // V1 'kit' mode: class kit + background kit (+ imported equipment if any).
      // V2 'roll' mode: expand cart entries → array of names (one per quantity unit).
      const classKit = CLASS_STARTING_KITS[draft.classKey]?.items ?? []
      const bgKit = BACKGROUNDS[draft.background]?.equipment ?? []
      const importedEquipment: string[] = (imported?.equipment ?? []).map((e: any) =>
        typeof e === 'string' ? e : (e?.name ?? '')
      ).filter(Boolean)
      let kitItems: string[]
      if (draft.equipmentMode === 'roll' && draft.cart && Object.keys(draft.cart).length > 0) {
        // Resolve cart entries against EQUIPMENT_CATALOG to get canonical names.
        const expanded: string[] = []
        for (const [itemKey, qty] of Object.entries(draft.cart)) {
          const item = EQUIPMENT_CATALOG.find((c) => c.key === itemKey)
          if (!item) continue
          for (let i = 0; i < qty; i++) expanded.push(item.name)
        }
        // Imported equipment is additive even in roll mode (carries D&D Beyond gear).
        kitItems = [...expanded, ...importedEquipment]
      } else {
        kitItems = [...classKit, ...bgKit, ...importedEquipment]
      }

      // Composed spells from prime-element steps (DMless caster path).
      // Only send slots that have at least one element selected.
      const startingSpells: { cantrip?: { name?: string; elements: Record<string, number> }; spell1?: { name?: string; elements: Record<string, number> } } = {}
      if (draft.startingSpells?.cantrip?.elements && Object.keys(draft.startingSpells.cantrip.elements).length > 0) {
        startingSpells.cantrip = {
          name: draft.startingSpells.cantrip.name,
          elements: draft.startingSpells.cantrip.elements,
        }
      }
      if (draft.startingSpells?.spell1?.elements && Object.keys(draft.startingSpells.spell1.elements).length > 0) {
        startingSpells.spell1 = {
          name: draft.startingSpells.spell1.name,
          elements: draft.startingSpells.spell1.elements,
        }
      }

      // Cert id from hash — needed for first-creator attribution on the spell ledger.
      const certIdForCommit = readCertIdFromHash() ?? undefined

      const result = await createCharacter({
        userId: userId ?? undefined,
        campaignId: campaignId ?? undefined,
        name: draft.name.trim() || 'Unnamed adventurer',
        raceKey: draft.raceKey,
        subrace: draft.subrace || undefined,
        classKey: draft.classKey,
        abilityScores: draft.abilityScores,
        background: draft.background || undefined,
        alignment: draft.alignment || undefined,
        hook: draft.hook || undefined,
        // import-only extensions
        level: imported?.draft?.level,
        saveProficiencies: imported?.saveProficiencies,
        skills: skillsForCommit,
        persona: imported?.persona,
        // imported scores already have racial bonus baked in; HP from sheet.
        skipRacialBonus: !!imported,
        hpMax: imported?.combat?.hpMax,
        hpCurrent: imported?.combat?.hpCurrent ?? imported?.combat?.hpMax,
        // chargen carryover (Pedro 2026-04-30): persist inventory + spell ledger
        kitItems: kitItems.length > 0 ? kitItems : undefined,
        startingSpells: Object.keys(startingSpells).length > 0 ? startingSpells : undefined,
        certId: certIdForCommit,
      } as any)
      setCreated({ id: result.characterId, name: result.summary.name })
      setActiveCharacter(campaignId, result.characterId)

      // New-flow: if launched with ?certId=X, attach this character row to
      // the previously-minted character cert so the cert points at real data.
      // Also set the IDB sessionState so the world dashboard + useWorld()
      // hook see this character as active immediately on the next route.
      const certId = readCertIdFromHash()
      if (certId) {
        try {
          await attachCharacterData(certId, result.characterId)
          const account = await loadAccount()
          if (account) {
            await setActiveCharacterCert(account.id, certId)
          }
        } catch {
          // non-fatal — character row exists, attachment can be retried later
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'character create failed')
    } finally {
      setCommitting(false)
    }
  }

  const stepProps = { draft, update, updateAbility, campaignId, userId }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">13 · Character Creation — D&amp;D 5e</div>
          <h2>Build a character</h2>
        </div>
        <span className="who">
          {campaignId ? `campaign ${campaignId.slice(0, 8)}…` : 'no campaign in url'}
          {userId ? ` · cert ✓` : ' · no cert'}
        </span>
      </div>

      <p style={{maxWidth: 740, color:'var(--ink-2)', marginTop: 0}}>
        Engine map: <span className="kbd">src/game/chargen.ts</span> drives race / class / abilities /
        proficiencies. This UI is a thin shell over it. AI co-pilot suggests fits as you go but never
        chooses for you. Saves on every step — you can stop and come back.
      </p>

      {/* progress rail */}
      <div className="box filled" style={{padding:'10px 12px', marginTop: 18, marginBottom: 18}}>
        <div className="row" style={{gap: 4, alignItems:'stretch'}}>
          {CHARGEN_STEPS.map((s, i) => {
            const idx = CHARGEN_STEPS.findIndex(x => x.k === step);
            const done = i < idx;
            const cur  = i === idx;
            return (
              <div key={s.k} onClick={() => setStep(s.k)}
                   style={{flex: 1, padding: '6px 8px', cursor: 'pointer',
                           border: '1px solid var(--rule)',
                           borderStyle: cur ? 'solid' : (done ? 'solid' : 'dashed'),
                           background: cur ? 'var(--ink)' : (done ? 'var(--paper-3)' : 'var(--paper)'),
                           color: cur ? 'var(--paper)' : 'var(--ink)'}}>
                <div className="tiny" style={{color: cur ? 'var(--paper-3)' : 'var(--ink-3)'}}>{s.n} {done ? '✓' : ''}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: cur ? 600 : 400}}>{s.l}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* current step body + persistent character preview */}
      <div className="grid-3" style={{gap: 18}}>
        <div style={{gridColumn:'span 2'}}>
          {step === 'import' && (
            <StepImport
              imported={imported}
              importing={importing}
              importError={importError}
              onFile={handleImportFile}
              onClear={() => { setImported(null); setImportError(null); setDraft({...DEFAULT_DRAFT}) }}
              onContinue={() => setStep('race')}
              draft={draft}
            />
          )}
          {step === 'race' && <StepRace {...stepProps} />}
          {step === 'class' && <StepClass {...stepProps} />}
          {step === 'abilities' && <StepAbilities {...stepProps} />}
          {step === 'skills' && <StepSkills {...stepProps} />}
          {step === 'background' && <StepBackground {...stepProps} />}
          {step === 'spells' && <StepSpells {...stepProps} />}
          {step === 'equipment' && <StepEquipment {...stepProps} />}
          {step === 'review' && (
            <StepReview
              {...stepProps}
              committing={committing}
              created={created}
              error={error}
              onCommit={handleCommit}
            />
          )}

          {/* nav */}
          <div className="row" style={{justifyContent:'space-between', marginTop: 18}}>
            <button className="btn" onClick={() => {
              const i = CHARGEN_STEPS.findIndex(x => x.k === step);
              if (i > 0) setStep(CHARGEN_STEPS[i-1].k);
            }}>← back</button>
            <div className="tiny muted" style={{alignSelf:'center'}}>
              draft · {step} · {draft.name || 'unnamed'} · {RACES[draft.raceKey]?.name} {CLASSES[draft.classKey]?.name}
            </div>
            <button className="btn primary" onClick={() => {
              const i = CHARGEN_STEPS.findIndex(x => x.k === step);
              if (i < CHARGEN_STEPS.length - 1) setStep(CHARGEN_STEPS[i+1].k);
            }}>continue →</button>
          </div>
        </div>

        <CharPreview step={step} draft={draft} update={update} />
      </div>
    </div>
  );
}

// ---- persistent right-rail preview ----

function CharPreview({step, draft, update}) {
  const race = RACES[draft.raceKey]
  const klass = CLASSES[draft.classKey]
  const finalScores: any = { ...draft.abilityScores }
  if (race) {
    for (const a of ABILITIES) {
      finalScores[a] = (draft.abilityScores[a] ?? 10) + (race.abilityBonuses[a] ?? 0)
    }
  }
  const dexMod = abilityModifier(finalScores.dexterity ?? 10)
  const conMod = abilityModifier(finalScores.constitution ?? 10)
  const hp = klass ? calculateStartingHp(klass, finalScores.constitution ?? 10) : 0
  const baseAc = 10 + dexMod
  const initBonus = dexMod
  const proficiency = 2

  const labelMap: Record<string, string> = {
    strength: 'STR', dexterity: 'DEX', constitution: 'CON',
    intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
  }

  return (
    <div className="col">
      <div className="box">
        <div className="box-title">
          <h3>{draft.name || <span className="muted">name your character</span>}</h3>
          <span className="meta">draft</span>
        </div>
        <input
          className="placeholder"
          style={{
            width: '100%', minHeight: 0, padding: '6px 10px',
            fontFamily: 'var(--serif)', fontSize: 14,
            background: 'var(--paper)', marginBottom: 8,
          }}
          placeholder="character name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <div className="tiny" style={{marginBottom: 10}}>
          {race?.name ?? '?'} · {klass?.name ?? '?'} 1
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 6, fontFamily:'var(--mono)', fontSize: 11}}>
          {ABILITIES.map((a) => {
            const v = finalScores[a] ?? 10
            const m = abilityModifier(v)
            return (
              <div key={a} style={{border:'1px solid var(--rule-soft)', padding: 6, textAlign:'center'}}>
                <div className="muted" style={{fontSize: 9}}>{labelMap[a]}</div>
                <div style={{fontSize: 18, fontFamily:'var(--serif)', fontWeight: 600}}>{v}</div>
                <div style={{fontSize: 11}}>{m >= 0 ? '+' : ''}{m}</div>
              </div>
            )
          })}
        </div>

        <hr className="rule dashed" />

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 4, fontSize: 12, fontFamily:'var(--mono)'}}>
          <span><span className="muted">HP</span> <b>{hp}</b></span>
          <span><span className="muted">AC</span> <b>{baseAc}</b></span>
          <span><span className="muted">Init</span> <b>{initBonus >= 0 ? '+' : ''}{initBonus}</b></span>
          <span><span className="muted">Speed</span> <b>{race?.speed ?? 30}</b></span>
          <span><span className="muted">Prof</span> <b>+{proficiency}</b></span>
          <span><span className="muted">CON</span> <b>{conMod >= 0 ? '+' : ''}{conMod}</b></span>
        </div>

        <div className="aside blue" style={{marginTop: 10, fontSize: 16}}>
          ↳ updates live as you pick. derived from <span className="kbd">mm-character.ts</span>
        </div>
      </div>

      <div className="box dashed">
        <div className="box-title"><h3>AI co-pilot</h3><span className="meta">advisory</span></div>
        <div className="tiny" style={{lineHeight: 1.7}}>
          Step <b>{step}</b> — based on your hook (<i>"owe someone in Mulmaster"</i>),
          AI suggests Half-elf Rogue (Soulknife) and a Charlatan background.
          Tap any suggestion to apply.
        </div>
        <div className="row" style={{gap: 6, marginTop: 8, flexWrap:'wrap'}}>
          <span className="chip blue sm">apply suggestion</span>
          <span className="chip sm">show alts</span>
          <span className="chip sm">explain</span>
        </div>
      </div>

      <div className="box filled">
        <div className="box-title"><h3>Validation</h3><span className="meta">5e rules</span></div>
        <ul style={{margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7}}>
          <li><span className="dot green" /> race chosen</li>
          <li><span className="dot green" /> class chosen</li>
          <li><span className="dot gold" /> ability scores assigned</li>
          <li><span className="dot" /> skills · 4 of 4 picked</li>
          <li><span className="dot" /> background incomplete</li>
          <li><span className="dot" /> spells N/A · rogue</li>
          <li><span className="dot" /> equipment pending</li>
        </ul>
      </div>
    </div>
  );
}

// ---- step bodies ----

function StepImport({imported, importing, importError, onFile, onClear, onContinue, draft}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }
  return (
    <div className="box">
      <div className="box-title">
        <h3>Import from D&amp;D Beyond</h3>
        <span className="meta">optional · pre-fills the rest</span>
      </div>
      <p style={{maxWidth: 720, color:'var(--ink-2)', marginTop: 0}}>
        Drop the multi-page character PDF you exported from D&amp;D Beyond and we'll
        pre-fill name, class, level, race, ability scores, save / skill proficiencies,
        equipment, currency, spells, and persona (backstory · ideals · bonds · flaws · allies).
        Every field stays editable in the steps that follow.
      </p>

      {!imported && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="placeholder"
          style={{
            minHeight: 160, marginTop: 12, padding: 30, textAlign: 'center',
            borderStyle: 'dashed', cursor: 'pointer', background: 'var(--paper-2)',
          }}
        >
          <div style={{fontFamily:'var(--serif)', fontSize: 18}}>
            {importing ? 'Parsing PDF…' : 'Drop a D&D Beyond PDF here, or click to browse'}
          </div>
          <div className="tiny muted" style={{marginTop: 6}}>
            up to 8MB · only the multi-page export works (single-page printable lacks form fields)
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{display:'none'}}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
        </div>
      )}

      {importError && (
        <div className="aside" style={{color:'var(--accent-red)', marginTop: 10}}>
          ↳ {importError}
        </div>
      )}

      {imported && (
        <div className="col" style={{gap: 12, marginTop: 12}}>
          <div className="aside blue" style={{fontSize: 16}}>
            ↳ parsed. <b>{imported.draft.name || 'Unnamed'}</b> · {imported.draft.raceLabel ?? imported.draft.raceKey} · {imported.draft.classLabel ?? imported.draft.classKey} {imported.draft.level}
          </div>

          <div className="grid-3" style={{gap: 12}}>
            <div className="box soft">
              <div className="box-title"><h3>Cover</h3><span className="meta">draft</span></div>
              <ul style={{margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7}}>
                <li><b>Name</b> · {imported.draft.name || <span className="muted">(none)</span>}</li>
                <li><b>Class</b> · {imported.draft.classLabel} {imported.draft.level}</li>
                <li><b>Race</b> · {imported.draft.raceLabel}</li>
                <li><b>Background</b> · {imported.draft.background || <span className="muted">—</span>}</li>
                <li><b>Alignment</b> · {imported.draft.alignment || <span className="muted">—</span>}</li>
              </ul>
            </div>

            <div className="box soft">
              <div className="box-title"><h3>Abilities</h3><span className="meta">final scores</span></div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 6, fontFamily:'var(--mono)', fontSize: 12}}>
                {Object.entries(imported.draft.abilityScores).map(([a, v]: any) => (
                  <div key={a} style={{textAlign:'center', padding: 6, border:'1px solid var(--rule-soft)'}}>
                    <div className="muted" style={{fontSize: 9}}>{a.slice(0,3).toUpperCase()}</div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600}}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="tiny muted" style={{marginTop: 6}}>
                Save profs: {imported.saveProficiencies?.length > 0
                  ? imported.saveProficiencies.map((s: string) => s.slice(0,3).toUpperCase()).join(' · ')
                  : '—'}
              </div>
            </div>

            <div className="box soft">
              <div className="box-title"><h3>Skills · profs</h3><span className="meta">expertise ★</span></div>
              <div style={{fontSize: 12, fontFamily:'var(--mono)', columnCount: 2}}>
                {Object.entries(imported.skills ?? {})
                  .filter(([_, s]: any) => s.proficient || s.expertise)
                  .map(([name, s]: any) => (
                    <div key={name}>
                      {name} {s.expertise ? '★' : '●'}
                    </div>
                  ))}
                {Object.values(imported.skills ?? {}).filter((s: any) => s.proficient || s.expertise).length === 0 && (
                  <span className="muted">—</span>
                )}
              </div>
            </div>

            <div className="box soft">
              <div className="box-title"><h3>Equipment</h3><span className="meta">{imported.equipment?.length ?? 0} items</span></div>
              <div style={{fontSize: 12, lineHeight: 1.6, maxHeight: 130, overflowY: 'auto'}}>
                {imported.equipment?.slice(0, 16).map((e: any, i: number) => (
                  <div key={i}>
                    {e.attuned ? '★ ' : ''}{e.name} <span className="muted">×{e.qty}{e.weight ? ` · ${e.weight}lb` : ''}</span>
                  </div>
                ))}
                {imported.equipment?.length > 16 && <div className="muted">… +{imported.equipment.length - 16} more</div>}
              </div>
            </div>

            <div className="box soft">
              <div className="box-title"><h3>Spells</h3><span className="meta">{imported.spells?.length ?? 0} known</span></div>
              <div style={{fontSize: 12, lineHeight: 1.6, maxHeight: 130, overflowY: 'auto'}}>
                {[0,1,2,3,4,5,6,7,8,9].map((lvl) => {
                  const at = (imported.spells ?? []).filter((s: any) => s.level === lvl)
                  if (at.length === 0) return null
                  return (
                    <div key={lvl}>
                      <b>{lvl === 0 ? 'cantrips' : `L${lvl}`}</b>: {at.map((s: any) => s.name).join(', ')}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="box soft">
              <div className="box-title"><h3>Persona</h3><span className="meta">{imported.persona?.length ?? 0} entries</span></div>
              <div style={{fontSize: 12, lineHeight: 1.6, maxHeight: 130, overflowY: 'auto'}}>
                {['personality', 'ideal', 'bond', 'flaw', 'ally'].map((f) => {
                  const at = (imported.persona ?? []).filter((p: any) => p.field === f)
                  if (at.length === 0) return null
                  return (
                    <div key={f}>
                      <b>{f}</b>: {at[0].value.slice(0, 80)}{at[0].value.length > 80 ? '…' : ''}
                    </div>
                  )
                })}
                {imported.persona?.find((p: any) => p.field === 'backstory') && (
                  <div className="muted" style={{marginTop: 4}}>
                    backstory: {imported.persona.find((p: any) => p.field === 'backstory').value.slice(0, 100)}…
                  </div>
                )}
              </div>
            </div>
          </div>

          {imported.warnings?.length > 0 && (
            <div className="aside" style={{color:'var(--accent-gold)', fontSize: 14}}>
              ↳ {imported.warnings.length} warning(s) during parse — review the steps before committing.
            </div>
          )}

          <div className="row" style={{justifyContent:'flex-end', gap: 8}}>
            <button className="btn" onClick={onClear}>start over</button>
            <button className="btn primary" onClick={onContinue}>
              continue with imported draft →
            </button>
          </div>
        </div>
      )}

      {!imported && !importing && (
        <div className="row" style={{justifyContent:'flex-end', marginTop: 12}}>
          <button className="btn" onClick={() => onContinue()}>skip · build manually →</button>
        </div>
      )}
    </div>
  )
}

function StepRace({draft, update}) {
  // Build a one-line "+X STAT, +Y ..." summary from a Partial<Record<Ability, number>>.
  const fmtBonuses = (bonuses) => {
    const entries = Object.entries(bonuses ?? {})
      .filter(([, v]) => typeof v === 'number' && v !== 0)
      .map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${k.slice(0, 3).toUpperCase()}`)
    return entries.length > 0 ? entries.join(', ') : '—'
  }

  const aiPick = 'half-elf'
  const allRaces = Object.values(RACES) as Array<{
    key: string
    name: string
    description: string
    abilityBonuses: Record<string, number>
    speed: number
    subraces: Array<{ key: string; name: string; description: string; abilityBonuses: Record<string, number> }>
  }>

  const currentRace = RACES[draft.raceKey]
  const subraces = currentRace?.subraces ?? []

  // Auto-select the first subrace when race changes (or clear if the race
  // has no subraces). Without this, the draft.subrace string would stay
  // pinned to whatever the previous race had, which then mismatches at
  // commit time.
  React.useEffect(() => {
    if (subraces.length === 0) {
      if (draft.subrace !== '') update({ subrace: '' })
      return
    }
    const stillValid = subraces.some((s) => s.name === draft.subrace || s.key === draft.subrace)
    if (!stillValid) {
      update({ subrace: subraces[0].name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.raceKey])

  return (
    <div className="box">
      <div className="box-title">
        <h3>Choose race</h3>
        <span className="meta">SRD · 5e · {allRaces.length} options</span>
      </div>

      <div className="row" style={{gap: 6, flexWrap:'wrap', marginBottom: 14}}>
        {['All','Common','Exotic','Faerûn-only'].map((t, i) => (
          <span key={t} className={`chip ${i===0?'solid':''}`}>{t}</span>
        ))}
        <span style={{flex:1}} />
        <input className="placeholder" style={{padding:'4px 10px', minHeight: 0, fontFamily:'var(--mono)', fontSize: 12, width: 200, background:'var(--paper)'}} placeholder="🔍  search races…" />
      </div>

      <div className="grid-3" style={{gap: 10}}>
        {allRaces.map((r) => {
          const sel = draft.raceKey === r.key
          return (
            <div
              key={r.key}
              className={`box ${sel?'filled':'soft'}`}
              style={{padding: 12, position:'relative', cursor:'pointer'}}
              onClick={() => update({ raceKey: r.key })}
            >
              {r.key === aiPick && !sel && <span className="hand" style={{position:'absolute', top:-12, right: -8, fontSize: 16, transform:'rotate(6deg)'}}>← AI pick</span>}
              <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600, display:'flex', justifyContent:'space-between'}}>
                {r.name} {sel && <span className="chip green sm" style={{fontSize: 9}}>chosen</span>}
              </div>
              <div className="tiny" style={{marginTop: 4, color:'var(--ink-2)'}}>{fmtBonuses(r.abilityBonuses)} · {r.speed}ft</div>
              <div className="tiny muted" style={{marginTop: 4}}>{r.description}</div>
            </div>
          )
        })}
      </div>

      {/* ── Subrace section ── dynamic based on selected race */}
      {currentRace && (
        <>
          <div className="section-title">
            {subraces.length > 0
              ? `Subrace · ${currentRace.name} variants`
              : `${currentRace.name} · no subraces`}
          </div>
          {subraces.length === 0 ? (
            <div className="aside" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              ↳ {currentRace.name} has no subrace variants in SRD 5e — proceed to next step.
            </div>
          ) : (
            <div className="grid-3" style={{gap: 10}}>
              {subraces.map((s) => {
                const sel = draft.subrace === s.name || draft.subrace === s.key
                return (
                  <div
                    key={s.key}
                    className={`box ${sel?'filled':'soft'}`}
                    style={{padding: 12, cursor: 'pointer', position: 'relative'}}
                    onClick={() => update({ subrace: s.name })}
                  >
                    <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 600, display:'flex', justifyContent:'space-between'}}>
                      {s.name}
                      {sel && <span className="chip green sm" style={{fontSize: 9}}>chosen</span>}
                    </div>
                    <div className="tiny" style={{ marginTop: 4, color: 'var(--ink-2)' }}>
                      {fmtBonuses(s.abilityBonuses)}
                    </div>
                    <div className="tiny muted" style={{marginTop: 4}}>{s.description}</div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StepClass({draft, update}) {
  const allClasses = Object.values(CLASSES)
  const currentClass = CLASSES[draft.classKey]
  const subclasses = currentClass?.subclasses ?? []

  // Auto-pick first subclass when class changes (or clear if none)
  React.useEffect(() => {
    if (!subclasses.length) {
      if (draft.subclass) update({ subclass: '' })
      return
    }
    const stillValid = subclasses.some((s) => s.key === draft.subclass)
    if (!stillValid) update({ subclass: subclasses[0].key })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.classKey])

  const aiPick = 'rogue'

  return (
    <div className="box">
      <div className="box-title">
        <h3>Choose class</h3>
        <span className="meta">SRD · {allClasses.length} options</span>
      </div>

      <div className="grid-4" style={{gap: 10}}>
        {allClasses.map((c) => {
          const sel = draft.classKey === c.key
          return (
            <div
              key={c.key}
              className={`box ${sel?'filled':'soft'}`}
              style={{padding: 12, position:'relative', cursor:'pointer'}}
              onClick={() => update({ classKey: c.key })}
            >
              {c.key === aiPick && !sel && <span className="hand" style={{position:'absolute', top:-12, right: -4, fontSize: 14, transform:'rotate(6deg)'}}>← AI pick</span>}
              <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600, display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                {c.name}
                {sel && <span className="chip green sm" style={{fontSize: 9}}>chosen</span>}
              </div>
              <div className="tiny" style={{marginTop: 4, color:'var(--ink-2)'}}>
                {c.hitDie} · {c.primaryAbility.slice(0,3).toUpperCase()} primary
                {c.spellcasting && <> · {c.spellcasting.slice(0,3).toUpperCase()} casting</>}
              </div>
              <div className="tiny muted" style={{marginTop: 4, lineHeight: 1.45}}>{c.description}</div>
            </div>
          )
        })}
      </div>

      {/* ── Subclass section ── dynamic based on selected class */}
      {currentClass && subclasses.length > 0 && (
        <>
          <div className="section-title">
            Subclass · {currentClass.name} at level {subclasses[0].unlockLevel}
          </div>
          <div className="grid-3" style={{gap: 10}}>
            {subclasses.map((s) => {
              const sel = draft.subclass === s.key
              return (
                <div
                  key={s.key}
                  className={`box ${sel?'filled':'soft'}`}
                  style={{padding: 12, cursor:'pointer', position: 'relative'}}
                  onClick={() => update({ subclass: s.key })}
                >
                  <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 600, display:'flex', justifyContent:'space-between'}}>
                    {s.name}
                    {sel && <span className="chip green sm" style={{fontSize: 9}}>chosen</span>}
                  </div>
                  <div className="tiny muted" style={{marginTop: 4}}>{s.description}</div>
                  <div className="tiny" style={{marginTop: 4, color: 'var(--ink-3)'}}>unlocks at level {s.unlockLevel}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="aside blue" style={{marginTop: 14, fontSize: 14}}>
        ↳ multiclass + homebrew arrive in Slice 6+ once the AI character builder lands. For now, single-class SRD.
      </div>
    </div>
  );
}

function StepAbilities({draft, update, updateAbility}) {
  const labelMap: Record<string, string> = {
    strength: 'STR', dexterity: 'DEX', constitution: 'CON',
    intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
  }

  const method = draft.abilityMethod ?? 'point-buy'
  const methodLocked = !!draft.methodLocked
  const isRollingMethod = method === '4d6-drop' || method === 'heroic'

  // Modal state for confirming the lock-in to a rolling method
  const [pendingLockMethod, setPendingLockMethod] = React.useState<null | '4d6-drop' | 'heroic'>(null)

  // Point-buy cost table
  const pointBuyCost = (v: number) => [0, 1, 2, 3, 4, 5, 7, 9][v - 8] ?? 0
  const pointBuyTotal = ABILITIES.reduce((sum, a) => sum + pointBuyCost(draft.abilityScores[a]), 0)

  const applyMethodSwitch = (m: typeof method, lock: boolean) => {
    if (m === 'standard-array') {
      update({
        abilityMethod: m,
        abilityScores: {
          strength: 8, dexterity: 15, constitution: 14,
          intelligence: 13, wisdom: 12, charisma: 10,
        },
        rolledScores: [],
        rolledRollCounts: [0, 0, 0, 0, 0, 0],
        abilityAssignments: {},
        methodLocked: lock,
      })
    } else if (m === 'point-buy') {
      update({
        abilityMethod: m,
        abilityScores: {
          strength: 8, dexterity: 15, constitution: 13,
          intelligence: 12, wisdom: 14, charisma: 10,
        },
        rolledScores: [],
        rolledRollCounts: [0, 0, 0, 0, 0, 0],
        abilityAssignments: {},
        methodLocked: lock,
      })
    } else {
      // Rolling methods: reset everything for a fresh start
      update({
        abilityMethod: m,
        abilityScores: { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 },
        rolledScores: [],
        rolledRollCounts: [0, 0, 0, 0, 0, 0],
        abilityAssignments: {},
        methodLocked: lock,
      })
    }
  }

  const switchMethod = (m: typeof method) => {
    if (methodLocked) return  // can't switch — already committed to current method
    if (m === '4d6-drop' || m === 'heroic') {
      // Show confirmation modal — committing to dice means accepting the rolls
      setPendingLockMethod(m)
      return
    }
    // Non-rolling methods can be switched freely (until a rolling method locks them out)
    applyMethodSwitch(m, false)
  }

  const confirmRollingLock = () => {
    if (!pendingLockMethod) return
    applyMethodSwitch(pendingLockMethod, true)
    setPendingLockMethod(null)
  }

  // Available rolled indices for a given ability — exclude values
  // assigned to OTHER abilities. The currently-assigned index for
  // this ability (if any) stays in the list so the dropdown can show it.
  const availableForAbility = (ability: string): number[] => {
    const usedByOthers = new Set<number>()
    for (const [a, idx] of Object.entries(draft.abilityAssignments ?? {})) {
      if (a !== ability && typeof idx === 'number') usedByOthers.add(idx)
    }
    return draft.rolledScores
      .map((_v: number, i: number) => i)
      .filter((i: number) => !usedByOthers.has(i))
  }

  const assignRolledTo = (rolledIdx: number, ability: string) => {
    const value = draft.rolledScores[rolledIdx]
    if (typeof value !== 'number') return
    update({
      abilityScores: { ...draft.abilityScores, [ability]: value },
      abilityAssignments: { ...(draft.abilityAssignments ?? {}), [ability]: rolledIdx },
    })
  }

  const clearAssignment = (ability: string) => {
    const next = { ...(draft.abilityAssignments ?? {}) }
    delete next[ability]
    update({
      abilityScores: { ...draft.abilityScores, [ability]: 8 },
      abilityAssignments: next,
    })
  }

  // Method tiles list — when locked, hide the other options
  const allMethods = [
    {key: 'standard-array', n: 'Standard array', d: '15·14·13·12·10·8'},
    {key: 'point-buy',      n: 'Point buy',      d: '27 pts'},
    {key: '4d6-drop',       n: '4d6 drop one',   d: 'roll 6 sets · 1 reroll/set'},
    {key: 'heroic',         n: 'Heroic 4d6',     d: 'reroll 1s (keep better) · 1 reroll/set'},
  ] as const
  const visibleMethods = methodLocked ? allMethods.filter((m) => m.key === method) : allMethods

  return (
    <div className="box">
      <div className="box-title">
        <h3>Assign abilities</h3>
        <span className="meta">
          {method}{methodLocked && ' · locked'}
        </span>
      </div>

      {/* ── Method picker ── */}
      <div className="row" style={{gap: 8, marginBottom: 14, flexWrap: 'wrap'}}>
        {visibleMethods.map(m => {
          const sel = method === m.key
          return (
            <div
              key={m.key}
              className={`box ${sel ? 'filled' : 'soft'}`}
              style={{
                padding: '8px 10px',
                cursor: methodLocked && !sel ? 'not-allowed' : 'pointer',
                flex: 1,
                minWidth: 140,
                opacity: methodLocked && !sel ? 0.4 : 1,
              }}
              onClick={() => switchMethod(m.key)}
            >
              <div style={{fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600}}>{m.n}</div>
              <div className="tiny muted">{m.d}</div>
            </div>
          )
        })}
      </div>
      {methodLocked && (
        <div className="aside" style={{ fontSize: 13, marginBottom: 10, color: 'var(--ink-2)' }}>
          ↳ method locked — your committed method stays. The other options are hidden so you can't escape bad rolls.
        </div>
      )}

      {/* ── Confirmation modal: committing to rolling method ── */}
      {pendingLockMethod && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,16,10,0.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setPendingLockMethod(null)}
        >
          <div
            className="box"
            style={{ width: 480, background: 'var(--paper)', padding: 22, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="box-title">
              <h3>Commit to {pendingLockMethod === '4d6-drop' ? '4d6 drop one' : 'Heroic 4d6'}?</h3>
              <span className="meta">no take-backs</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>
              If you choose rolling, <b>there's no going back</b>. The other ability methods (point-buy / standard array) will be locked out — you can't escape unlucky rolls by swapping methods later.
            </p>
            <ul style={{ margin: '8px 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)' }}>
              <li>You'll roll <b>6 sets</b> (one per ability slot)</li>
              <li>Each set allows <b>1 reroll</b> (so 2 rolls max per slot)</li>
              {pendingLockMethod === 'heroic' && (
                <li>Heroic: 1s on individual dice are auto-rerolled once, keeping whichever value is better</li>
              )}
              <li>After all 6 are rolled, you assign each total to one ability</li>
              <li className="muted">no advantage, no double-rolls — just honest 4d6 drop lowest. Expected average per slot ≈ 12.24.</li>
            </ul>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn" onClick={() => setPendingLockMethod(null)}>cancel</button>
              <button className="btn primary" onClick={confirmRollingLock}>
                yes, commit to {pendingLockMethod === '4d6-drop' ? '4d6 drop' : 'Heroic 4d6'} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Point buy: existing UI with running total ── */}
      {method === 'point-buy' && (
        <>
          <div className="grid-3" style={{gap: 10}}>
            {ABILITIES.map(a => {
              const v = draft.abilityScores[a]
              const cost = pointBuyCost(v)
              return (
                <div key={a} className="box" style={{padding: 10}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                    <div>
                      <div className="tiny">{labelMap[a]}</div>
                      <div style={{fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1}}>{v}</div>
                    </div>
                    <div className="col" style={{gap: 2}}>
                      <button className="btn sm" style={{padding: '2px 8px'}} onClick={() => updateAbility(a, +1)} disabled={v >= 15 || pointBuyTotal + (pointBuyCost(v + 1) - cost) > 27}>+</button>
                      <button className="btn sm" style={{padding: '2px 8px'}} onClick={() => updateAbility(a, -1)} disabled={v <= 8}>−</button>
                    </div>
                  </div>
                  <div className="bar" style={{marginTop: 8}}>
                    <span style={{width: `${(v - 8) / 7 * 100}%`}} />
                  </div>
                  <div className="tiny muted" style={{marginTop: 4}}>
                    mod {v >= 10 ? '+' : ''}{Math.floor((v - 10) / 2)} · cost {cost}
                  </div>
                </div>
              )
            })}
          </div>
          <hr className="rule dashed" />
          <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
            <div className="stat">
              points used{' '}
              <b style={{color: pointBuyTotal > 27 ? 'var(--accent-red)' : pointBuyTotal === 27 ? 'var(--accent-green)' : 'var(--ink)'}}>
                {pointBuyTotal} / 27
              </b>
            </div>
            <div className="row" style={{gap: 6}}>
              <button className="btn sm" onClick={() => switchMethod('point-buy')}>reset</button>
            </div>
          </div>
        </>
      )}

      {/* ── Standard array: same grid, drag-or-click between abilities ── */}
      {method === 'standard-array' && (
        <>
          <div className="aside" style={{fontSize: 13, marginBottom: 10}}>
            ↳ drag-friendly: each ability has up/down buttons that swap with the next-higher / next-lower assigned value.
            All 6 numbers (15, 14, 13, 12, 10, 8) must end up assigned.
          </div>
          <div className="grid-3" style={{gap: 10}}>
            {ABILITIES.map(a => {
              const v = draft.abilityScores[a]
              return (
                <div key={a} className="box" style={{padding: 10}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                    <div>
                      <div className="tiny">{labelMap[a]}</div>
                      <div style={{fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1}}>{v}</div>
                    </div>
                    <select
                      value={v}
                      onChange={(e) => {
                        const newVal = parseInt(e.target.value, 10)
                        // Find which ability currently has newVal — swap with this one
                        const swapWith = ABILITIES.find((ax) => ax !== a && draft.abilityScores[ax] === newVal)
                        const newScores = { ...draft.abilityScores, [a]: newVal }
                        if (swapWith) newScores[swapWith] = v
                        update({ abilityScores: newScores })
                      }}
                      style={{padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 14}}
                    >
                      {[15, 14, 13, 12, 10, 8].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="tiny muted" style={{marginTop: 4}}>
                    mod {v >= 10 ? '+' : ''}{Math.floor((v - 10) / 2)}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── 4d6 drop one + Heroic: roll 6 sets, then assign ── */}
      {(method === '4d6-drop' || method === 'heroic') && (
        <>
          <div className="aside" style={{fontSize: 13, marginBottom: 10}}>
            ↳ roll 6 times.{' '}
            {method === 'heroic' && <span>Any die under 8 is auto-rerolled once. </span>}
            One reroll per slot — after that the value locks. Then assign each total to one ability.
          </div>
          <div className="col" style={{gap: 10, marginBottom: 14}}>
            {[0, 1, 2, 3, 4, 5].map((slot) => {
              const existing = draft.rolledScores[slot]
              const counts = draft.rolledRollCounts ?? [0, 0, 0, 0, 0, 0]
              const rolls = counts[slot] ?? 0
              const locked = rolls >= 2
              const canLock = rolls === 1 && !locked
              const label =
                rolls === 0 ? 'roll' :
                rolls === 1 ? `${existing} — reroll (1 left)` :
                `${existing} — locked`

              const lockSlot = () => {
                // Burn the reroll allowance to lock the current value.
                // Setting count = 2 makes both `locked` and the disabled
                // gate true without changing rolledScores[slot].
                const nextCounts = [...counts]
                nextCounts[slot] = 2
                update({ rolledRollCounts: nextCounts })
              }

              return (
                <div
                  key={slot}
                  className="box soft"
                  style={{padding: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}
                >
                  <span className="tiny muted" style={{minWidth: 30}}>#{slot + 1}</span>
                  <FourDSixDropOne
                    /* Heroic = reroll 1s, keep the better of the two. */
                    rerollUnder={method === 'heroic' ? 2 : undefined}
                    onResult={(r: FourDSixResult) => {
                      const nextScores = [...draft.rolledScores]
                      nextScores[slot] = r.total
                      const nextCounts = [...counts]
                      nextCounts[slot] = (nextCounts[slot] ?? 0) + 1
                      update({ rolledScores: nextScores, rolledRollCounts: nextCounts })
                    }}
                    /* No seed — let mfDice use Math.random() so each roll is
                       independent. Passing clustered Date.now()+offset seeds
                       through mulberry32 doesn't fully avalanche on the first
                       output and can subtly bias short streaks. */
                    buttonLabel={label}
                    disabled={locked}
                  />
                  {canLock && (
                    <button
                      className="btn sm primary"
                      onClick={lockSlot}
                      title="lock this roll — keeps the value, burns the reroll allowance"
                    >
                      🔒 lock at {existing}
                    </button>
                  )}
                  <span className="tiny muted" style={{marginLeft: 'auto'}}>
                    {rolls === 0
                      ? 'fresh roll'
                      : rolls === 1
                        ? '1 reroll left · or lock to keep'
                        : 'locked'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Assignment grid: each ability gets a dropdown of UNUSED rolled values */}
          <div className="section-title">Assign rolled values</div>
          <div className="grid-3" style={{gap: 10}}>
            {ABILITIES.map(a => {
              const v = draft.abilityScores[a]
              const assignedIdx = draft.abilityAssignments?.[a]
              const available = availableForAbility(a)
              const hasAssignment = typeof assignedIdx === 'number'
              return (
                <div key={a} className="box" style={{padding: 10}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                    <div>
                      <div className="tiny">{labelMap[a]}</div>
                      <div style={{fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1}}>
                        {hasAssignment ? v : <span className="muted" style={{fontSize: 14}}>—</span>}
                      </div>
                    </div>
                    {hasAssignment && (
                      <button
                        className="btn sm"
                        style={{padding: '2px 6px', fontSize: 11}}
                        onClick={() => clearAssignment(a)}
                        title="unassign"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <select
                    value={hasAssignment ? assignedIdx : ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') {
                        clearAssignment(a)
                        return
                      }
                      const idx = parseInt(raw, 10)
                      if (!Number.isNaN(idx) && draft.rolledScores[idx] !== undefined) {
                        assignRolledTo(idx, a)
                      }
                    }}
                    style={{marginTop: 6, padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 13, width: '100%'}}
                  >
                    <option value="">— pick a rolled value —</option>
                    {available.map((i: number) => (
                      <option key={i} value={i}>
                        roll #{i + 1} = {draft.rolledScores[i]}
                      </option>
                    ))}
                  </select>
                  <div className="tiny muted" style={{marginTop: 4}}>
                    {hasAssignment ? (
                      <>mod {v >= 10 ? '+' : ''}{Math.floor((v - 10) / 2)}</>
                    ) : (
                      <span style={{ color: 'var(--ink-3)' }}>unassigned</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Unassigned remaining */}
          {(() => {
            const used = new Set(Object.values(draft.abilityAssignments ?? {}))
            const remaining = draft.rolledScores
              .map((v: number, i: number) => ({ v, i }))
              .filter(({ i }: { i: number }) => !used.has(i))
            if (draft.rolledScores.length === 0) return null
            if (remaining.length === 0) {
              return (
                <div className="aside" style={{ fontSize: 13, marginTop: 10, color: 'var(--accent-green)' }}>
                  ✓ all 6 values assigned
                </div>
              )
            }
            return (
              <div className="aside" style={{ fontSize: 13, marginTop: 10 }}>
                ↳ {remaining.length} unassigned: {remaining.map((r: any) => `#${r.i + 1}=${r.v}`).join(', ')}
              </div>
            )
          })()}
        </>
      )}

      {/* Racial bonus preview */}
      <div className="aside blue" style={{marginTop: 14, fontSize: 13}}>
        ↳ Racial + subrace bonuses combine on commit. Preview at the Review step.
      </div>
    </div>
  );
}

// Map skill name → ability key
const SKILL_ABILITY: Record<string, string> = {
  'Acrobatics': 'dexterity', 'Animal Handling': 'wisdom', 'Arcana': 'intelligence',
  'Athletics': 'strength', 'Deception': 'charisma', 'History': 'intelligence',
  'Insight': 'wisdom', 'Intimidation': 'charisma', 'Investigation': 'intelligence',
  'Medicine': 'wisdom', 'Nature': 'intelligence', 'Perception': 'wisdom',
  'Performance': 'charisma', 'Persuasion': 'charisma', 'Religion': 'intelligence',
  'Sleight of Hand': 'dexterity', 'Stealth': 'dexterity', 'Survival': 'wisdom',
}

function StepSkills({draft, update}) {
  const klass = CLASSES[draft.classKey]
  const bg = BACKGROUNDS[draft.background]
  const choices = klass?.skillChoices?.from ?? []
  const choiceCount = klass?.skillChoices?.count ?? 0
  const bgSkills = bg?.skillProfs ?? []

  const selected = draft.skillProficiencies ?? []
  const fromClass = selected.filter((s) => choices.includes(s))
  const overLimit = fromClass.length > choiceCount

  // Toggle a class-skill choice
  const toggle = (skill: string) => {
    const exists = selected.includes(skill)
    if (exists) {
      update({ skillProficiencies: selected.filter((s) => s !== skill) })
      return
    }
    // Adding — only allow if room remains in class choices
    const isClassChoice = choices.includes(skill)
    if (isClassChoice && fromClass.length >= choiceCount) {
      return  // capped
    }
    update({ skillProficiencies: [...selected, skill] })
  }

  // Compute mod for a skill (using current draft scores; doesn't include racial bonuses yet)
  const skillMod = (skill: string) => {
    const ability = SKILL_ABILITY[skill] ?? 'strength'
    const score = draft.abilityScores[ability] ?? 10
    const base = abilityModifier(score)
    const profBonus = 2  // L1 proficiency bonus
    const isProf = selected.includes(skill) || bgSkills.includes(skill)
    return base + (isProf ? profBonus : 0)
  }

  return (
    <div className="box">
      <div className="box-title">
        <h3>Skills · proficiencies</h3>
        <span className="meta">{klass?.name ?? '—'}: pick {choiceCount} of {choices.length}</span>
      </div>

      <div className="row" style={{gap: 14, marginBottom: 12, flexWrap: 'wrap'}}>
        <span className="stat">
          class proficiencies{' '}
          <b style={{color: overLimit ? 'var(--accent-red)' : fromClass.length === choiceCount ? 'var(--accent-green)' : 'var(--ink)'}}>
            {fromClass.length}/{choiceCount}
          </b>
        </span>
        <span className="stat">
          background grants <b>{bgSkills.length}</b> auto
          {bgSkills.length > 0 && <span className="muted"> ({bgSkills.join(', ')})</span>}
        </span>
        <span style={{flex: 1}} />
        <span className="hand blue" style={{fontSize: 14}}>click to toggle proficiency</span>
      </div>

      <table className="inv">
        <thead>
          <tr><th>skill</th><th>ability</th><th>source</th><th>mod</th></tr>
        </thead>
        <tbody>
          {Object.keys(SKILL_ABILITY).map((s) => {
            const isClass = choices.includes(s)
            const isBg = bgSkills.includes(s)
            const isSelected = selected.includes(s)
            const ability = SKILL_ABILITY[s]
            const mod = skillMod(s)
            return (
              <tr key={s}>
                <td>
                  {isClass ? (
                    <a
                      onClick={() => toggle(s)}
                      style={{cursor: 'pointer', fontWeight: isSelected ? 700 : 500}}
                    >
                      {s}
                    </a>
                  ) : (
                    <span style={{opacity: 0.7}}>{s}</span>
                  )}
                </td>
                <td className="muted">{ability.slice(0, 3).toUpperCase()}</td>
                <td>
                  {isBg && <span className="chip sm gold" style={{fontSize: 9, marginRight: 4}}>background</span>}
                  {isSelected && isClass && <span className="chip sm blue" style={{fontSize: 9}}>class pick</span>}
                  {!isBg && !isSelected && isClass && <span className="muted tiny">click to pick</span>}
                  {!isBg && !isClass && !isSelected && <span className="muted tiny">unavailable</span>}
                </td>
                <td className="stat">{mod >= 0 ? '+' : ''}{mod}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {overLimit && (
        <div className="aside" style={{color: 'var(--accent-red)', marginTop: 12}}>
          ↳ over class limit — un-select {fromClass.length - choiceCount} skill{fromClass.length - choiceCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function StepBackground({draft, update}) {
  const current = BACKGROUNDS[draft.background]

  return (
    <div className="box">
      <div className="box-title">
        <h3>Background</h3>
        <span className="meta">SRD · {BACKGROUND_LIST.length} options</span>
      </div>

      <div className="grid-4" style={{gap: 10}}>
        {BACKGROUND_LIST.map((b) => {
          const sel = draft.background === b.key
          return (
            <div
              key={b.key}
              className={`box ${sel ? 'filled' : 'soft'}`}
              style={{padding: 12, cursor: 'pointer', position: 'relative'}}
              onClick={() => update({ background: b.key })}
            >
              <div style={{fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, display: 'flex', justifyContent: 'space-between'}}>
                {b.name}
                {sel && <span className="chip green sm" style={{fontSize: 9}}>chosen</span>}
              </div>
              <div className="tiny" style={{marginTop: 4, color: 'var(--ink-2)'}}>
                {b.skillProfs.join(' · ')}
              </div>
              <div className="tiny muted" style={{marginTop: 4}}>{b.description}</div>
            </div>
          )
        })}
      </div>

      {current && (
        <div className="grid-2" style={{gap: 14, marginTop: 18}}>
          <div className="box">
            <div className="box-title">
              <h3>{current.name} · grants</h3>
              <span className="meta">applied at L1</span>
            </div>
            <div className="col" style={{gap: 6, fontSize: 13, marginTop: 6}}>
              <div>
                <span className="muted">skills:</span>{' '}
                {current.skillProfs.map((s) => (
                  <span key={s} className="chip sm gold" style={{marginRight: 4}}>{s}</span>
                ))}
              </div>
              {current.toolProfs.length > 0 && (
                <div>
                  <span className="muted">tools:</span>{' '}
                  {current.toolProfs.map((t) => (
                    <span key={t} className="chip sm blue" style={{marginRight: 4}}>{t}</span>
                  ))}
                </div>
              )}
              {current.languages > 0 && (
                <div>
                  <span className="muted">languages:</span>{' '}
                  <span>+{current.languages} of choice</span>
                </div>
              )}
              <div>
                <span className="muted">equipment:</span>{' '}
                <span style={{fontFamily: 'var(--mono)', fontSize: 12}}>{current.equipment.join(', ')}</span>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-title">
              <h3>Feature: {current.feature.name}</h3>
              <span className="meta">always-on</span>
            </div>
            <p style={{fontSize: 13, lineHeight: 1.6, marginTop: 8, color: 'var(--ink-2)'}}>
              {current.feature.description}
            </p>
          </div>
        </div>
      )}

      <div className="section-title">Personality (your flavor)</div>
      <div className="grid-2" style={{gap: 14}}>
        <div className="box soft">
          <div className="box-title"><h3>Hook</h3><span className="meta">from onboarding</span></div>
          <textarea
            value={draft.hook ?? ''}
            onChange={(e) => update({ hook: e.target.value })}
            placeholder="One sentence — what pulled this character into the campaign?"
            style={{width: '100%', minHeight: 60, padding: 8, fontFamily: 'var(--serif)', fontSize: 13, marginTop: 6, border: '1px solid var(--rule)', background: 'var(--paper-2)'}}
          />
          <div className="tiny muted" style={{marginTop: 6}}>
            ↳ AI will weave this into the campaign arc when chargen completes.
          </div>
        </div>

        <div className="box soft">
          <div className="box-title"><h3>Alignment</h3><span className="meta">9 axis</span></div>
          <select
            value={draft.alignment ?? ''}
            onChange={(e) => update({ alignment: e.target.value })}
            style={{width: '100%', padding: '6px 8px', fontFamily: 'var(--serif)', fontSize: 14, marginTop: 6}}
          >
            <option value="">— pick —</option>
            {[
              'Lawful Good', 'Neutral Good', 'Chaotic Good',
              'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
              'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
            ].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="tiny muted" style={{marginTop: 8, lineHeight: 1.5}}>
            Influences NPC reactions + which gods will accept you. Drift over play is allowed.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spell composer (prime-element system from engine/magic.ts) ──
// For DMless players, starting spells aren't picked from a SRD list — they're
// COMPOSED from prime elements. Each element is a prime number; the spell
// "seed" is the product. Same math anywhere on Toril.

const ELEMENTS_BY_CATEGORY: Record<string, string[]> = (() => {
  const acc: Record<string, string[]> = {
    damage: [], delivery: [], school: [], duration: [], intensity: [],
  }
  for (const [name, el] of Object.entries(SPELL_ELEMENTS)) {
    acc[el.category].push(name)
  }
  return acc
})()

interface SpellComposerProps {
  /** L0 (Minor) for cantrip, L1 (Lesser) for first spell. */
  requiredIntensity: 'Minor' | 'Lesser'
  /** Display label for this composition slot. */
  label: string
  value: { elements: Record<string, number>; name: string }
  onChange: (next: { elements: Record<string, number>; name: string }) => void
}

function SpellComposer({ requiredIntensity, label, value, onChange }: SpellComposerProps) {
  // The required intensity is always present; player picks the rest.
  const elements = { ...(value.elements ?? {}), [requiredIntensity]: 1 }

  const toggle = (name: string) => {
    if (name === requiredIntensity) return  // can't toggle required intensity
    const next = { ...elements }
    if (next[name]) {
      delete next[name]
    } else {
      next[name] = 1
    }
    // Keep the required intensity present
    next[requiredIntensity] = 1
    onChange({ elements: next, name: value.name })
  }

  const setQuantity = (name: string, qty: number) => {
    const next = { ...elements }
    if (qty <= 0) {
      if (name !== requiredIntensity) delete next[name]
    } else {
      next[name] = Math.min(3, qty)  // cap at ³ for sane intensity
    }
    next[requiredIntensity] = 1
    onChange({ elements: next, name: value.name })
  }

  // Live preview from engine/magic.ts
  let seed: bigint = 1n
  let school: string | null = null
  let level: number = 0
  try {
    seed = composeSpell(elements)
    school = getSpellSchool(elements)
    level = calculateSpellLevel(elements)
  } catch {
    /* incomplete composition */
  }

  // Suggest a default name based on dominant elements (player can edit)
  const generatedName = (() => {
    const damage = ELEMENTS_BY_CATEGORY.damage.find((d) => elements[d])
    const delivery = ELEMENTS_BY_CATEGORY.delivery.find((d) => elements[d])
    const schoolEl = ELEMENTS_BY_CATEGORY.school.find((s) => elements[s])
    const intensity = requiredIntensity
    if (damage && delivery) {
      return `${intensity} ${damage} ${delivery === 'Cone' ? 'Cone' : delivery === 'Touch' ? 'Touch' : delivery === 'Self' ? 'Aura' : delivery === 'Ranged' ? 'Bolt' : delivery === 'Area' ? 'Blast' : delivery === 'Line' ? 'Line' : 'Chain'}`
    }
    if (schoolEl && delivery) {
      return `${intensity} ${schoolEl}`
    }
    if (damage) return `${intensity} ${damage}`
    if (schoolEl) return `${intensity} ${schoolEl}`
    return `${intensity} ${requiredIntensity === 'Minor' ? 'Cantrip' : 'Spell'}`
  })()

  const name = value.name || generatedName

  // Validation: needs at least one delivery + (damage OR school)
  const hasDelivery = ELEMENTS_BY_CATEGORY.delivery.some((d) => elements[d])
  const hasEffect = ELEMENTS_BY_CATEGORY.damage.some((d) => elements[d])
    || ELEMENTS_BY_CATEGORY.school.some((s) => elements[s])
  const valid = hasDelivery && hasEffect

  return (
    <div className="box">
      <div className="box-title">
        <h3>{label}</h3>
        <span className="meta">L{level} · {school ?? '—'}</span>
      </div>

      {/* Name field */}
      <div style={{ marginTop: 8 }}>
        <label className="tiny" style={{ display: 'block' }}>spell name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ elements, name: e.target.value })}
          placeholder={generatedName}
          style={{
            width: '100%', padding: '6px 8px', fontFamily: 'var(--serif)',
            fontSize: 14, background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}
        />
      </div>

      {/* Element pickers — one row per category */}
      {(['damage', 'delivery', 'school', 'duration'] as const).map((cat) => (
        <div key={cat} style={{ marginTop: 10 }}>
          <div className="tiny muted" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {cat}{cat === 'damage' || cat === 'delivery' ? ' · pick 1+' : ' · optional'}
          </div>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {ELEMENTS_BY_CATEGORY[cat].map((name) => {
              const sel = !!elements[name]
              const count = elements[name] ?? 0
              return (
                <span
                  key={name}
                  className={`chip sm ${sel ? 'solid' : ''}`}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggle(name)}
                  title={`prime ${SPELL_ELEMENTS[name].prime}`}
                >
                  {name}
                  {sel && count > 1 && <sup>{count}</sup>}
                  {sel && cat === 'damage' && (
                    <span style={{ marginLeft: 4 }}>
                      <a
                        onClick={(e) => { e.stopPropagation(); setQuantity(name, count + 1) }}
                        style={{ cursor: 'pointer' }}
                      >＋</a>{' '}
                      <a
                        onClick={(e) => { e.stopPropagation(); setQuantity(name, count - 1) }}
                        style={{ cursor: 'pointer' }}
                      >−</a>
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ))}

      {/* Intensity is fixed for the slot — show it as a locked badge */}
      <div style={{ marginTop: 10 }}>
        <div className="tiny muted" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          intensity · locked
        </div>
        <span className="chip solid blue">{requiredIntensity}</span>
      </div>

      {/* Composition preview */}
      <hr className="rule dashed" style={{ marginTop: 12 }} />
      <div className="tiny" style={{ fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
        seed: <b>{seed.toString()}</b><br />
        school: <b>{school ?? '—'}</b> · level: <b>{level}</b>
      </div>
      {!valid && (
        <div className="aside" style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8 }}>
          ↳ a complete spell needs at least one <b>delivery</b> and one <b>damage or school effect</b>
        </div>
      )}
    </div>
  )
}

function StepSpells({draft, update}) {
  const klass = CLASSES[draft.classKey]
  const isCaster = !!klass?.spellcasting

  if (!isCaster) {
    return (
      <div className="box">
        <div className="box-title">
          <h3>Spells</h3>
          <span className="meta">{klass?.name ?? '—'} · non-caster</span>
        </div>
        <div className="aside" style={{ fontSize: 14 }}>
          ↳ {klass?.name ?? 'this class'} doesn't have spellcasting at level 1. Skip ahead to equipment.
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
          Some classes pick up spells later (Eldritch Knight Fighter at L3, Arcane Trickster Rogue at L3,
          Ranger at L2, Paladin at L2). When that subclass / level unlocks, the spell composer will
          appear in level-up.
        </div>
      </div>
    )
  }

  const startingSpells = draft.startingSpells ?? {
    cantrip: { elements: {}, name: '' },
    spell1: { elements: {}, name: '' },
  }

  return (
    <div className="box">
      <div className="box-title">
        <h3>Compose your starting spells</h3>
        <span className="meta">{klass.name} · {klass.spellcasting?.toUpperCase()} casting</span>
      </div>

      <div className="aside blue" style={{ fontSize: 13, marginBottom: 14 }}>
        ↳ DMless characters compose their own spells from <b>prime elements</b> (
        <span className="kbd">engine/magic.ts</span>). Each element is a prime number; the spell's
        identity is the product. Same math anywhere on Toril — your <i>Minor Fire Bolt</i> is the
        same seed as everyone else who composed it the same way.
      </div>

      <div className="grid-2" style={{ gap: 14 }}>
        <SpellComposer
          requiredIntensity="Minor"
          label="Cantrip · L0"
          value={startingSpells.cantrip}
          onChange={(next) => update({
            startingSpells: { ...startingSpells, cantrip: next },
          })}
        />
        <SpellComposer
          requiredIntensity="Lesser"
          label="First spell · L1"
          value={startingSpells.spell1}
          onChange={(next) => update({
            startingSpells: { ...startingSpells, spell1: next },
          })}
        />
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
        ↳ Higher-level spells unlock at level-up. The composer surfaces in the Sheet when you reach
        the slot threshold. <b>Greater</b> intensity needs lore gates the world hasn't built yet —
        you'll know when you find one.
      </div>
    </div>
  );
}

// Generic class starting kits — keyed by class. v1: simplified single kit per class
// (the SRD has A/B options for most; for now we pick the most generic option).
const CLASS_STARTING_KITS: Record<string, { items: string[]; gp?: number }> = {
  barbarian:  { items: ['Greataxe', 'Two handaxes', 'Explorer\'s pack', '4 javelins'] },
  bard:       { items: ['Rapier', 'Diplomat\'s pack', 'Lute', 'Leather armor', 'Dagger'] },
  cleric:     { items: ['Mace', 'Scale mail', 'Light crossbow + 20 bolts', 'Priest\'s pack', 'Shield', 'Holy symbol'] },
  druid:      { items: ['Wooden shield', 'Scimitar', 'Leather armor', 'Explorer\'s pack', 'Druidic focus'] },
  fighter:    { items: ['Chain mail', 'Longsword', 'Shield', 'Light crossbow + 20 bolts', 'Dungeoneer\'s pack'] },
  monk:       { items: ['Shortsword', 'Dungeoneer\'s pack', '10 darts'] },
  paladin:    { items: ['Chain mail', 'Longsword', 'Shield', 'Priest\'s pack', '5 javelins', 'Holy symbol'] },
  ranger:     { items: ['Scale mail', 'Two shortswords', 'Dungeoneer\'s pack', 'Longbow + quiver of 20 arrows'] },
  rogue:      { items: ['Rapier', 'Shortbow + 20 arrows', 'Burglar\'s pack', 'Leather armor', 'Two daggers', 'Thieves\' tools'] },
  sorcerer:   { items: ['Light crossbow + 20 bolts', 'Component pouch', 'Dungeoneer\'s pack', 'Two daggers'] },
  warlock:    { items: ['Light crossbow + 20 bolts', 'Component pouch', 'Scholar\'s pack', 'Leather armor', 'Simple weapon', 'Two daggers'] },
  wizard:     { items: ['Quarterstaff', 'Component pouch', 'Scholar\'s pack', 'Spellbook'] },
}

function StepEquipment({draft, update}) {
  const klass = CLASSES[draft.classKey]
  const bg = BACKGROUNDS[draft.background]
  const classKit = CLASS_STARTING_KITS[draft.classKey]?.items ?? []
  const bgKit = bg?.equipment ?? []
  const mode = (draft.equipmentMode ?? 'kit') as 'kit' | 'roll'

  // Cart math (V2 only).
  const cart: Record<string, number> = draft.cart ?? {}
  const cartTotal = Object.entries(cart).reduce((sum, [key, qty]) => {
    const it = EQUIPMENT_CATALOG.find((c) => c.key === key)
    return sum + (it ? it.valueGP * (qty as number) : 0)
  }, 0)
  const goldRemaining = (draft.startingGold ?? 0) - cartTotal
  const overBudget = goldRemaining < 0

  const formula = STARTING_GOLD_DICE[draft.classKey]
  const formulaLabel = formula
    ? `${formula.count}d4${formula.multiplier === 10 ? '×10' : ''}`
    : '4d4×10 (default)'

  const setQty = (itemKey: string, nextQty: number) => {
    const q = Math.max(0, Math.floor(nextQty))
    const newCart = { ...cart }
    if (q === 0) delete newCart[itemKey]
    else newCart[itemKey] = q
    update({ cart: newCart })
  }

  const handleRollGold = () => {
    update({ startingGold: rollStartingGold(draft.classKey) })
  }

  const handleClearCart = () => {
    update({ cart: {} })
  }

  return (
    <div className="box">
      <div className="box-title">
        <h3>Starting equipment</h3>
        <span className="meta">{mode === 'kit' ? 'V1 · class + background kit' : 'V2 · roll gold + buy'}</span>
      </div>

      {/* Mode toggle */}
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        <button
          className={'btn sm' + (mode === 'kit' ? ' primary' : '')}
          onClick={() => update({ equipmentMode: 'kit' })}
        >
          📜 Use class kit
        </button>
        <button
          className={'btn sm' + (mode === 'roll' ? ' primary' : '')}
          onClick={() => update({ equipmentMode: 'roll' })}
        >
          🎲 Roll gold + buy
        </button>
        <span className="tiny muted" style={{ alignSelf: 'center', marginLeft: 8 }}>
          {mode === 'kit'
            ? 'fastest path · take what your class + background ship with'
            : `roll ${formulaLabel} starting gold and spend it on the SRD catalog (${EQUIPMENT_CATALOG.length} items)`}
        </span>
      </div>

      {mode === 'kit' && (
        <>
          <div className="grid-2" style={{gap: 14}}>
            <div className="box soft">
              <div className="box-title">
                <h3>Class kit · {klass?.name ?? '—'}</h3>
                <span className="meta">{classKit.length} items</span>
              </div>
              <ul style={{margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7}}>
                {classKit.map((item, i) => <li key={i}>{item}</li>)}
                {classKit.length === 0 && <li className="muted">no kit defined for this class yet</li>}
              </ul>
            </div>

            <div className="box soft">
              <div className="box-title">
                <h3>Background kit · {bg?.name ?? '—'}</h3>
                <span className="meta">{bgKit.length} items</span>
              </div>
              <ul style={{margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7}}>
                {bgKit.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="section-title">Final inventory · what you walk in with</div>
          <div className="box" style={{padding: 0}}>
            <table className="inv">
              <thead>
                <tr><th>item</th><th>source</th></tr>
              </thead>
              <tbody>
                {classKit.map((item, i) => (
                  <tr key={`c-${i}`}>
                    <td><b>{item}</b></td>
                    <td className="muted">class kit</td>
                  </tr>
                ))}
                {bgKit.map((item, i) => (
                  <tr key={`b-${i}`}>
                    <td><b>{item}</b></td>
                    <td className="muted">{bg?.name} background</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <EquipmentCatalogBrowser />

          <div className="aside" style={{fontSize: 13, marginTop: 12}}>
            ↳ this V1 path takes the class + background sets above. Switch to{' '}
            <b>roll</b> mode if you'd rather buy from the catalog with starting gold.
          </div>
        </>
      )}

      {mode === 'roll' && (
        <>
          {/* Gold strip */}
          <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
            <div className="box">
              <div className="tiny">STARTING GOLD ({formulaLabel})</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, marginTop: 4 }}>
                {draft.startingGold > 0 ? `${draft.startingGold} gp` : <span className="muted">— not yet rolled —</span>}
              </div>
              <button
                className="btn sm"
                onClick={handleRollGold}
                style={{ marginTop: 8 }}
              >
                {draft.startingGold > 0 ? 'reroll' : '🎲 roll'}
              </button>
            </div>
            <div className="box">
              <div className="tiny">SPENT</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, marginTop: 4 }}>
                {cartTotal.toFixed(1)} gp
              </div>
              <div className="tiny muted" style={{ marginTop: 8 }}>
                {Object.values(cart).reduce((s, q) => s + (q as number), 0)} item{Object.values(cart).length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="box" style={{ borderColor: overBudget ? 'var(--accent-red)' : 'var(--rule)' }}>
              <div className="tiny">REMAINING</div>
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, marginTop: 4,
                color: overBudget ? 'var(--accent-red)' : 'var(--accent-green)',
              }}>
                {goldRemaining.toFixed(1)} gp
              </div>
              {overBudget && (
                <div className="tiny" style={{ color: 'var(--accent-red)', marginTop: 8 }}>
                  ⚠ over budget — drop something
                </div>
              )}
            </div>
          </div>

          {/* Cart contents */}
          {Object.keys(cart).length > 0 && (
            <div className="box" style={{ marginBottom: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="section-title" style={{ margin: 0 }}>Cart · {Object.keys(cart).length} types</div>
                <button className="btn sm" onClick={handleClearCart}>clear cart</button>
              </div>
              <table className="inv">
                <thead>
                  <tr><th>item</th><th style={{ textAlign: 'right' }}>qty</th><th style={{ textAlign: 'right' }}>unit</th><th style={{ textAlign: 'right' }}>subtotal</th></tr>
                </thead>
                <tbody>
                  {Object.entries(cart).map(([key, qty]) => {
                    const it = EQUIPMENT_CATALOG.find((c) => c.key === key)
                    if (!it) return null
                    return (
                      <tr key={key}>
                        <td><b>{it.name}</b> <span className="muted tiny">· {it.category}</span></td>
                        <td className="stat" style={{ textAlign: 'right' }}>{qty}</td>
                        <td className="stat" style={{ textAlign: 'right' }}>
                          {it.valueGP < 1 ? `${(it.valueGP * 10).toFixed(0)}sp` : `${it.valueGP}gp`}
                        </td>
                        <td className="stat" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {(it.valueGP * (qty as number)).toFixed(1)} gp
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Browser with cart controls */}
          <EquipmentCatalogBrowser cart={cart} setQty={setQty} />

          <div className="aside" style={{ fontSize: 13, marginTop: 12 }}>
            ↳ V2: starting gold rolls per class formula. Cart total stays under budget; the{' '}
            <span className="kbd">cart</span> resolves to <span className="kbd">kitItems</span>{' '}
            on commit and persists into the character's inventory + items tables.
          </div>
        </>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  'weapon-simple-melee':    'Simple weapons · melee',
  'weapon-simple-ranged':   'Simple weapons · ranged',
  'weapon-martial-melee':   'Martial weapons · melee',
  'weapon-martial-ranged':  'Martial weapons · ranged',
  'armor-light':            'Armor · light',
  'armor-medium':           'Armor · medium',
  'armor-heavy':            'Armor · heavy',
  'shield':                 'Shields',
  'gear':                   'Adventuring gear',
  'tool':                   'Tools',
  'pack':                   'Equipment packs',
}

const CATEGORY_ORDER: EquipmentCategory[] = [
  'weapon-simple-melee', 'weapon-simple-ranged',
  'weapon-martial-melee', 'weapon-martial-ranged',
  'armor-light', 'armor-medium', 'armor-heavy', 'shield',
  'pack', 'tool', 'gear',
]

function EquipmentCatalogBrowser({
  cart,
  setQty,
}: {
  cart?: Record<string, number>
  setQty?: (key: string, qty: number) => void
}) {
  const showCart = !!cart && !!setQty
  const [query, setQuery] = React.useState('')
  const [activeCat, setActiveCat] = React.useState<EquipmentCategory | 'all'>('weapon-simple-melee')

  const filtered = React.useMemo(() => {
    const base = activeCat === 'all'
      ? EQUIPMENT_CATALOG
      : EQUIPMENT_CATALOG.filter((it) => it.category === activeCat)
    if (!query.trim()) return base
    return searchEquipment(query).filter((it) => activeCat === 'all' || it.category === activeCat)
  }, [query, activeCat])

  const totalGp = filtered.reduce((sum, it) => sum + it.valueGP, 0)

  return (
    <>
      <div className="section-title">Browse equipment catalog · {EQUIPMENT_CATALOG.length} SRD items</div>

      {/* Category tabs */}
      <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        <span
          className={`chip sm ${activeCat === 'all' ? 'solid' : ''}`}
          onClick={() => setActiveCat('all')}
          style={{ cursor: 'pointer' }}
        >
          all
        </span>
        {CATEGORY_ORDER.map((cat) => (
          <span
            key={cat}
            className={`chip sm ${activeCat === cat ? 'solid' : ''}`}
            onClick={() => setActiveCat(cat)}
            style={{ cursor: 'pointer' }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 search by name (e.g. rapier, leather, lantern)…"
        style={{
          width: '100%', padding: '6px 10px', fontFamily: 'var(--mono)',
          fontSize: 13, marginBottom: 10, background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
        }}
      />

      {/* Results table */}
      <div className="box" style={{ padding: 0, maxHeight: 360, overflowY: 'auto' }}>
        <table className="inv">
          <thead>
            <tr>
              <th>item</th>
              <th>category</th>
              <th>cost</th>
              <th>weight</th>
              <th>notes</th>
              {showCart && <th style={{ textAlign: 'right' }}>qty</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const qty = showCart ? (cart![item.key] ?? 0) : 0
              const inCart = qty > 0
              return (
              <tr key={item.key} style={inCart ? { background: 'rgba(91, 138, 90, 0.08)' } : undefined}>
                <td><b>{item.name}</b></td>
                <td className="muted tiny">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                <td className="stat">
                  {item.valueGP < 1
                    ? `${(item.valueGP * 10).toFixed(0)} sp`
                    : `${item.valueGP} gp`}
                </td>
                <td className="muted">{item.weight} lb</td>
                <td className="tiny">
                  {item.weapon && (
                    <>
                      {item.weapon.damage} {item.weapon.damageType}
                      {item.weapon.properties.length > 0 && (
                        <span className="muted"> · {item.weapon.properties.join(', ')}</span>
                      )}
                      {item.weapon.rangeNormal && (
                        <span className="muted"> · {item.weapon.rangeNormal}/{item.weapon.rangeLong}</span>
                      )}
                    </>
                  )}
                  {item.armor && (
                    <>
                      AC {item.armor.armorClass === 'shield' ? '+' : ''}{item.armor.acBonus}
                      {item.armor.armorClass !== 'shield' && (
                        <span className="muted">
                          {' '}·{' '}{item.armor.armorClass}
                          {item.armor.stealthDisadvantage && ' · stealth disadv'}
                          {item.armor.strengthRequired && ` · STR ${item.armor.strengthRequired}+`}
                        </span>
                      )}
                    </>
                  )}
                  {item.pack && (
                    <span className="muted">
                      {item.pack.items.length} items bundled
                    </span>
                  )}
                  {item.description && !item.weapon && !item.armor && !item.pack && (
                    <span className="muted">{item.description}</span>
                  )}
                </td>
                {showCart && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn sm"
                      onClick={() => setQty!(item.key, qty - 1)}
                      disabled={qty === 0}
                      style={{ minWidth: 24 }}
                    >−</button>
                    <span className="stat" style={{ display: 'inline-block', minWidth: 28, textAlign: 'center', fontWeight: qty > 0 ? 600 : 400 }}>
                      {qty}
                    </span>
                    <button
                      className="btn sm"
                      onClick={() => setQty!(item.key, qty + 1)}
                      style={{ minWidth: 24 }}
                    >＋</button>
                  </td>
                )}
              </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showCart ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 14 }}>
                  no items match "{query}" in {CATEGORY_LABELS[activeCat] ?? activeCat}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <span className="tiny muted">{filtered.length} items shown</span>
        <span className="tiny muted">total catalog value: {totalGp.toFixed(2)} gp</span>
      </div>
    </>
  )
}

function StepReview({draft, committing, created, error, onCommit, campaignId}) {
  const race = RACES[draft.raceKey]
  const klass = CLASSES[draft.classKey]
  const finalScores: any = { ...draft.abilityScores }
  if (race) {
    for (const a of ABILITIES) {
      finalScores[a] = (draft.abilityScores[a] ?? 10) + (race.abilityBonuses[a] ?? 0)
    }
  }
  const dexMod = abilityModifier(finalScores.dexterity ?? 10)
  const conMod = abilityModifier(finalScores.constitution ?? 10)
  const hp = klass ? calculateStartingHp(klass, finalScores.constitution ?? 10) : 0
  const baseAc = 10 + dexMod
  const saves = klass?.savingThrows?.map((s) => s.slice(0, 3).toUpperCase()).join(' · ') ?? '—'

  return (
    <div className="box">
      <div className="box-title"><h3>Review · ready to play</h3><span className="meta">last look</span></div>

      <div className="grid-2" style={{gap: 14}}>
        <div className="col">
          <div className="box soft">
            <div className="box-title"><h3>Identity</h3><span className="meta"></span></div>
            <ul style={{margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7}}>
              <li><b>{draft.name || 'Unnamed adventurer'}</b> · {race?.name ?? '?'} · {klass?.name ?? '?'} 1</li>
              <li>{draft.background || '—'} · {draft.alignment || '—'}</li>
              <li>Hook · {draft.hook ? `"${draft.hook}"` : <span className="muted">none set</span>}</li>
            </ul>
          </div>
          <div className="box soft">
            <div className="box-title"><h3>Combat at a glance</h3><span className="meta">derived</span></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 4, fontSize: 13, fontFamily:'var(--mono)'}}>
              <span>HP <b>{hp}</b></span><span>AC <b>{baseAc}</b></span>
              <span>Init <b>{dexMod >= 0 ? '+' : ''}{dexMod}</b></span><span>Speed <b>{race?.speed ?? 30}</b></span>
              <span>Prof <b>+2</b></span><span>CON <b>{conMod >= 0 ? '+' : ''}{conMod}</b></span>
              <span style={{gridColumn:'span 2'}}>Saves <b>{saves}</b></span>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="box soft">
            <div className="box-title"><h3>Final ability scores</h3><span className="meta">racial bonus applied</span></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 4, fontSize: 13, fontFamily:'var(--mono)'}}>
              {ABILITIES.map((a) => (
                <span key={a}>
                  <span className="muted">{a.slice(0, 3).toUpperCase()}</span> <b>{finalScores[a]}</b>{' '}
                  ({abilityModifier(finalScores[a]) >= 0 ? '+' : ''}{abilityModifier(finalScores[a])})
                </span>
              ))}
            </div>
          </div>

          <div className="box soft">
            <div className="box-title"><h3>What happens next</h3><span className="meta">commit</span></div>
            <ol style={{margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.8}}>
              <li>characters / character_classes / character_abilities / character_saves rows written</li>
              <li>Active character set in localStorage{campaignId ? ` (campaign ${campaignId.slice(0,8)}…)` : ''}</li>
              <li>You can open the Sheet next ↘</li>
            </ol>
          </div>
        </div>
      </div>

      {error && (
        <div className="tiny" style={{color:'var(--accent-red)', marginTop: 12}}>{error}</div>
      )}
      {created && (
        <div className="aside blue" style={{marginTop: 12, fontSize: 16}}>
          ↳ <b>{created.name}</b> committed · id <span className="kbd">{created.id.slice(0,8)}…</span>
        </div>
      )}

      <div className="row" style={{justifyContent:'flex-end', gap: 8, marginTop: 18}}>
        {created ? (
          <>
            <button className="btn" onClick={() => { window.location.hash = 'sheet' }}>open sheet →</button>
            <button className="btn primary" onClick={() => { window.location.hash = 'world' }}>
              log into world →
            </button>
          </>
        ) : (
          <>
            <button className="btn" disabled>save draft</button>
            <button className="btn" disabled>export PDF</button>
            <button className="btn primary" disabled={committing} onClick={onCommit}>
              {committing ? 'committing…' : 'commit character →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

