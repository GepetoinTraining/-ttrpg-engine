// @ts-nocheck
'use client'

import React from 'react'
import {
  loadCharacterSheet,
  listCharacters,
  type SheetData,
  type CharacterListItem,
} from '@/lib/character'
import { useSession } from '@/lib/session-context'
// surfaces/Sheet.tsx — Character sheet wired to /api/character/:id.

const ABILITY_LABEL: Record<string, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
}
const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const fmtMod = (m: number) => `${m >= 0 ? '+' : ''}${m}`

export default function Sheet() {
  const { campaignId, activeCharacterId, setActiveCharacterId, hydrated } = useSession()
  const [tab, setTab] = React.useState('actions')
  const [sheet, setSheet] = React.useState<SheetData | null>(null)
  const [list, setList] = React.useState<CharacterListItem[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  // When there's no active character, fetch the list so the user can pick.
  React.useEffect(() => {
    if (!hydrated) return
    if (activeCharacterId) return
    setLoading(false)
    listCharacters()
      .then((r) => setList(r.characters))
      .catch((e) => setError(e?.message ?? 'list failed'))
  }, [hydrated, activeCharacterId])

  // Load the sheet for the active character (re-runs when context changes it).
  React.useEffect(() => {
    if (!activeCharacterId) return
    setLoading(true)
    setError(null)
    loadCharacterSheet(activeCharacterId)
      .then((s) => setSheet(s))
      .catch((e) => setError(e?.message ?? 'load failed'))
      .finally(() => setLoading(false))
  }, [activeCharacterId])

  const pickCharacter = (id: string) => {
    setActiveCharacterId(id)
    setList(null)
  }

  if (!activeCharacterId) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">14 · Character Sheet</div>
            <h2>Pick a character</h2>
          </div>
          <span className="who">no active character set</span>
        </div>
        <p style={{ maxWidth: 740, color: 'var(--ink-2)' }}>
          Pick a character below, or jump to <a onClick={() => { window.location.hash = 'chargen' + (campaignId ? `?campaign=${campaignId}` : '') }} style={{ cursor: 'pointer' }}>character creation</a>.
        </p>
        {error && (
          <div className="tiny" style={{ color: 'var(--accent-red)', marginBottom: 8 }}>{error}</div>
        )}
        {list === null && <div className="tiny muted">loading…</div>}
        {list && list.length === 0 && (
          <div className="aside" style={{ fontSize: 16 }}>
            ↳ no characters yet. <a onClick={() => { window.location.hash = 'chargen' }} style={{ cursor: 'pointer' }}>build one</a>.
          </div>
        )}
        {list && list.length > 0 && (
          <div className="grid-3" style={{ gap: 10 }}>
            {list.map((c) => (
              <div key={c.id} className="box soft" style={{ cursor: 'pointer', padding: 14 }} onClick={() => pickCharacter(c.id)}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{c.name}</div>
                <div className="tiny" style={{ marginTop: 4 }}>
                  {c.race}
                  {c.subrace ? ` · ${c.subrace}` : ''} ·{' '}
                  {c.classes.map((cl) => `${cl.className} ${cl.level}`).join(', ') || '—'}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  HP {c.hpCurrent}/{c.hpMax} · {c.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading || !sheet) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">14 · Character Sheet</div>
            <h2>Loading…</h2>
          </div>
        </div>
        {error && <div className="tiny" style={{ color: 'var(--accent-red)' }}>{error}</div>}
      </div>
    )
  }

  const { character, classes, level, proficiencyBonus, abilityScores, modifiers, savingThrows, skills, ac, initBonus } = sheet
  const classLine = classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ''}`).join(' / ') || '—'
  const hpPct = character.hp.max > 0 ? Math.round((character.hp.current / character.hp.max) * 100) : 0
  const primaryHitDie = classes[0]?.hitDie ?? 'd8'

  // 5e skill abbreviations to fit the cell width
  const SKILL_SHORT: Record<string, string> = {
    'Animal Handling': 'Animal H.',
    'Sleight of Hand': 'Sleight',
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">14 · Character Sheet — hybrid</div>
          <h2>{character.name} · sheet</h2>
        </div>
        <span className="who">
          {classLine} · derived live ·{' '}
          <a onClick={() => { setActiveIdState(null); setSheet(null) }} style={{ cursor: 'pointer' }}>switch character</a>
        </span>
      </div>

      <p style={{maxWidth: 740, color:'var(--ink-2)', marginTop: 0}}>
        Top half is the <b>paper stat block</b> — abilities, saves, skills, combat numbers — derived
        from <span className="kbd">engine/mm-character.ts</span>. Bottom half flips to <b>modern action panels</b>:
        what you can <i>do</i> right now. Player full view; DM gets a read-only mirror in the Console.
      </p>

      {/* ===== TOP: paper stat block ===== */}
      <div className="grid-3" style={{gap: 14, marginTop: 18}}>
        {/* col 1 — identity + abilities */}
        <div className="col">
          <div className="box">
            <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, lineHeight: 1.1}}>{character.name}</div>
            <div className="tiny" style={{marginTop: 4}}>
              {character.race}
              {character.subrace ? ` · ${character.subrace}` : ''} · {classLine}
              {character.background ? ` · ${character.background}` : ''}
            </div>
            <div className="tiny muted" style={{marginTop: 2}}>
              {character.xp.toLocaleString()} XP · status: {character.status}
            </div>
            <div className="row" style={{gap: 6, marginTop: 8, flexWrap:'wrap'}}>
              <span className="chip sm">id {character.id.slice(0, 8)}…</span>
              <span className="chip sm">level {level}</span>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Abilities</h3><span className="meta">prof {fmtMod(proficiencyBonus)}</span></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6}}>
              {ABILITY_KEYS.map((a) => {
                const v = abilityScores[a]
                const m = modifiers[a]
                const save = savingThrows[a]
                return (
                  <div key={a} style={{border:'1px solid var(--rule)', padding: 8, position:'relative'}}>
                    <div className="tiny" style={{letterSpacing:'0.1em'}}>{ABILITY_LABEL[a]}</div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 24, fontWeight: 600, lineHeight: 1, marginTop: 2}}>{v}</div>
                    <div style={{fontFamily:'var(--mono)', fontSize: 11, marginTop: 2}}>mod <b>{fmtMod(m)}</b></div>
                    <div className="tiny muted" style={{marginTop: 2}}>save {fmtMod(save.bonus)}{save.proficient ? ' prof' : ''}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="box">
            <div className="box-title">
              <h3>Saving throws</h3>
              <span className="meta">
                {ABILITY_KEYS.filter((a) => savingThrows[a].proficient).map((a) => ABILITY_LABEL[a]).join(' · ') || 'no profs'}
              </span>
            </div>
            <div className="col" style={{gap: 4, fontFamily:'var(--mono)', fontSize: 12}}>
              {ABILITY_KEYS.map((a) => {
                const s = savingThrows[a]
                return (
                  <div key={a} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', padding:'3px 0'}}>
                    <span>{ABILITY_LABEL[a]}</span>
                    <span><b>{fmtMod(s.bonus)}{s.proficient ? ' ✓' : ''}</b></span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* col 2 — combat block + skills */}
        <div className="col">
          <div className="box">
            <div className="box-title"><h3>Combat block</h3><span className="meta">derived</span></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8}}>
              {[
                ['AC', String(ac), 'base + DEX'],
                ['HP', `${character.hp.current}/${character.hp.max}`, `temp ${character.hp.temp}`],
                ['Init', fmtMod(initBonus), 'DEX mod'],
                ['Speed', String(character.speed), 'walk'],
                ['Hit Die', primaryHitDie, `${classes.length} class${classes.length === 1 ? '' : 'es'}`],
                ['Prof', fmtMod(proficiencyBonus), `level ${level}`],
              ].map(([n, v, sub]) => (
                <div key={n} style={{border:'1px solid var(--rule)', padding: 8}}>
                  <div className="tiny">{n}</div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, lineHeight: 1, marginTop: 2}}>{v}</div>
                  <div className="tiny muted" style={{marginTop: 2}}>{sub}</div>
                </div>
              ))}
            </div>

            {/* HP bar */}
            <div style={{marginTop: 12}}>
              <div className="row" style={{justifyContent:'space-between', fontSize: 12}}>
                <span className="muted">hp</span>
                <span className="stat">
                  {character.hp.current} / {character.hp.max}
                  {character.hp.current < character.hp.max && (
                    <> · <b style={{color:'var(--accent-red)'}}>−{character.hp.max - character.hp.current}</b></>
                  )}
                </span>
              </div>
              <div className="bar blue"><span style={{width: `${hpPct}%`}} /></div>
              <div className="row" style={{gap: 6, marginTop: 8}}>
                <button className="btn sm" disabled>−dmg</button>
                <button className="btn sm" disabled>+heal</button>
                <button className="btn sm" disabled>temp HP</button>
                <span style={{flex:1}} />
                <span className="tiny muted">
                  death saves: {character.deathSaves.successes}/3 · {character.deathSaves.failures}/3
                </span>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Skills</h3><span className="meta">expertise · ★</span></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: '4px 14px', fontFamily:'var(--mono)', fontSize: 12}}>
              {Object.entries(skills).map(([name, s]) => {
                const ex = s.proficiency === 'expertise'
                const pr = s.proficiency === 'proficient'
                const half = s.proficiency === 'half'
                const marker = ex ? ' ★' : (pr ? ' ●' : (half ? ' ½' : ''))
                return (
                  <div key={name} style={{display:'flex', justifyContent:'space-between',
                                       borderBottom:'1px dashed var(--rule-soft)', padding:'2px 0',
                                       color: ex ? 'var(--accent-gold)' : (pr || half ? 'var(--ink)' : 'var(--ink-3)')}}>
                    <span>
                      {SKILL_SHORT[name] ?? name}{' '}
                      <span className="muted" style={{fontSize: 9}}>{ABILITY_LABEL[s.ability]}</span>
                    </span>
                    <span><b>{fmtMod(s.bonus)}{marker}</b></span>
                  </div>
                )
              })}
            </div>
            <div className="tiny muted" style={{marginTop: 8}}>★ expertise · ● proficient · ½ half-prof</div>
          </div>
        </div>

        {/* col 3 — conditions / resources / proficiencies */}
        <div className="col">
          <div className="box">
            <div className="box-title"><h3>Conditions</h3><span className="meta">live</span></div>
            <div className="row" style={{gap: 6, flexWrap:'wrap'}}>
              {['concentrating','frightened','grappled','prone','restrained','poisoned','blinded','charmed','paralyzed','stunned','unconscious','exhaustion 0/6'].map((c) => (
                <span key={c} className="chip sm" style={{fontSize: 9, opacity: 0.45}}>{c}</span>
              ))}
            </div>
            <div className="aside" style={{marginTop: 10, fontSize: 16}}>
              ↳ active right now: nothing. concentrate/exhaustion track here.
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Resources</h3><span className="meta">short / long rest</span></div>
            <div className="col" style={{gap: 8}}>
              <div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="stat">Hit dice ({primaryHitDie})</span>
                  <span className="stat"><b>{level - 0}/{level}</b></span>
                </div>
                <div className="bar"><span style={{width: '100%'}} /></div>
                <div className="tiny muted">spend during short rest</div>
              </div>
              <div className="tiny muted">
                ↳ class resources (psi-dice, slots, ki) wired in a future pass
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Proficiencies</h3><span className="meta">tools · weapons · armor</span></div>
            <div className="tiny muted" style={{lineHeight: 1.7}}>
              <div>not yet wired — character_proficiencies table writes are a future pass.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM: modern panels ===== */}
      <div className="section-title">In play · what you can do right now</div>
      <div className="tabs">
        {[
          ['actions', 'Actions'],
          ['spells', 'Spells / psionics'],
          ['inventory', 'Inventory'],
          ['features', 'Features'],
          ['notes', 'Notes'],
        ].map(([k, lbl]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>

      <div className="box" style={{borderTop:'none', borderTopLeftRadius: 0, borderTopRightRadius: 0}}>
        {tab === 'actions' && <SheetActions />}
        {tab === 'spells' && <SheetSpells />}
        {tab === 'inventory' && <SheetInventory />}
        {tab === 'features' && <SheetFeatures />}
        {tab === 'notes' && <SheetNotes />}
      </div>
    </div>
  );
}

function SheetActions() {
  const Row = ({type, n, dmg, range, notes, color}) => (
    <tr>
      <td><span className={`chip ${color||''} sm`} style={{fontSize: 9}}>{type}</span></td>
      <td><b>{n}</b></td>
      <td className="stat">{dmg}</td>
      <td className="stat">{range}</td>
      <td className="muted" style={{fontSize: 13}}>{notes}</td>
      <td><button className="btn sm">→ use</button></td>
    </tr>
  );
  return (
    <div>
      <div className="row" style={{gap: 8, marginBottom: 8, flexWrap:'wrap'}}>
        <span className="tiny" style={{alignSelf:'center', marginRight: 4}}>BUDGET ·</span>
        <span className="chip green sm">action ✓</span>
        <span className="chip green sm">bonus ✓</span>
        <span className="chip green sm">reaction ✓</span>
        <span className="chip sm">movement 30 / 30</span>
        <span style={{flex: 1}} />
        <button className="btn sm">end turn</button>
      </div>
      <table className="inv">
        <thead><tr><th></th><th>name</th><th>roll</th><th>range</th><th>notes</th><th></th></tr></thead>
        <tbody>
          <tr className="group"><td colSpan="6">attacks</td></tr>
          <Row type="action" n="Shortsword +1" dmg="d20+9 · 1d6+4 pierce" range="melee · 5ft" notes="finesse · sneak applies" color="blue" />
          <Row type="action" n="Hand crossbow" dmg="d20+8 · 1d6+3 pierce" range="30 / 120" notes="loading: bonus to reload" />
          <Row type="action" n="Psychic blade · throw" dmg="d20+8 · 1d6+3 psychic" range="60ft" notes="sneak applies · summons free" color="gold" />
          <Row type="bonus"  n="Off-hand psychic blade" dmg="d20+8 · 1d6 psychic" range="melee" notes="no DEX to dmg · sneak chains" color="gold" />

          <tr className="group"><td colSpan="6">cunning action · bonus</td></tr>
          <Row type="bonus" n="Dash" dmg="—" range="—" notes="+30ft this turn" />
          <Row type="bonus" n="Disengage" dmg="—" range="—" notes="no OAs" />
          <Row type="bonus" n="Hide" dmg="—" range="—" notes="re-stealth · sneak next turn" color="blue" />

          <tr className="group"><td colSpan="6">reactions</td></tr>
          <Row type="reaction" n="Uncanny Dodge" dmg="halve dmg" range="self" notes="vs one attacker you can see" color="blue" />
          <Row type="reaction" n="Opportunity Attack" dmg="d20+9 · 1d6+4" range="reach" notes="vs leaving threat" />

          <tr className="group"><td colSpan="6">other</td></tr>
          <Row type="action" n="Help" dmg="—" range="5ft" notes="ally gets advantage" />
          <Row type="action" n="Use object · potion" dmg="—" range="self" notes="3 healing potions on belt" />
          <Row type="free" n="Speak · Thieves' Cant" dmg="—" range="—" notes="signal Doruk" />
        </tbody>
      </table>
    </div>
  );
}

function SheetSpells() {
  return (
    <div>
      <div className="row" style={{gap: 14, marginBottom: 12}}>
        <span className="stat">Psi-dice <b>3/4</b> · d6</span>
        <span className="stat">Save DC <b>13</b></span>
        <span className="stat">Atk <b>+5</b></span>
        <span className="stat">Slots · n/a (rogue)</span>
      </div>
      <div className="grid-2" style={{gap: 14}}>
        <div className="box soft">
          <div className="box-title"><h3>Psionic Power</h3><span className="meta">3/4</span></div>
          <div className="col" style={{gap: 8}}>
            {[
              {n:'Psi-Bolstered Knack', d:'spend die · failed check → succeed', cost:'1 die'},
              {n:'Psionic Whispers', d:'mental message · 1 mile', cost:'1 die'},
              {n:'Psychic Veil', d:'invisible until you act · 1hr', cost:'1 die'},
            ].map(p => (
              <div key={p.n} className="box" style={{padding: 10}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <b>{p.n}</b>
                  <span className="chip gold sm" style={{fontSize: 9}}>{p.cost}</span>
                </div>
                <div className="muted" style={{fontSize: 13, marginTop: 4}}>{p.d}</div>
                <div className="row" style={{gap: 6, marginTop: 6}}>
                  <button className="btn sm">→ manifest</button>
                  <button className="btn sm">read</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="box soft">
          <div className="box-title"><h3>Items as spells</h3><span className="meta">scroll · wand</span></div>
          <div className="col" style={{gap: 8}}>
            <div className="box" style={{padding: 10}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <b>Scroll · Shield</b>
                <span className="chip sm" style={{fontSize: 9}}>1 of 1</span>
              </div>
              <div className="muted" style={{fontSize: 13, marginTop: 4}}>reaction · +5 AC until next turn</div>
            </div>
            <div className="box" style={{padding: 10}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <b>Hat of Disguise</b>
                <span className="chip sm" style={{fontSize: 9}}>1/day</span>
              </div>
              <div className="muted" style={{fontSize: 13, marginTop: 4}}>action · attune · 1hr</div>
            </div>
          </div>
        </div>
      </div>

      <div className="aside" style={{marginTop: 14, fontSize: 16}}>
        ↳ for full casters, this tab renders a leveled grimoire with prepared toggles, slots,
        ritual marks. Same vocabulary.
      </div>
    </div>
  );
}

function SheetInventory() {
  return (
    <div>
      <div className="row" style={{gap: 10, marginBottom: 10, alignItems:'center'}}>
        <span className="stat">Carry <b>23 / 60 lb</b> · light</span>
        <div className="bar gold" style={{flex:1}}><span style={{width: '38%'}} /></div>
        <span className="stat">Coin · <b>180gp</b> 12sp 4cp</span>
        <button className="btn sm">＋ add</button>
      </div>
      <div className="muted" style={{fontSize: 13, marginBottom: 10}}>
        Full inventory lives on your <a style={{color:'var(--accent-blue)'}}>Player Dashboard</a> (local · stash · ally · mount).
        This panel surfaces only what you can <i>reach this turn</i>.
      </div>
      <table className="inv">
        <thead><tr><th>item</th><th>qty</th><th>action to use</th><th></th></tr></thead>
        <tbody>
          <tr><td><b>Potion of healing</b></td><td>3</td><td className="muted">action · 2d4+2 HP</td><td><button className="btn sm">→ drink</button></td></tr>
          <tr><td><b>Alchemist's fire</b></td><td>2</td><td className="muted">action · 1d4 fire/round · DC 10 dex</td><td><button className="btn sm">→ throw</button></td></tr>
          <tr><td><b>Caltrops</b></td><td>1 bag</td><td className="muted">action · 5ft sq · DC 15 dex</td><td><button className="btn sm">→ scatter</button></td></tr>
          <tr><td><b>Smokestick</b></td><td>2</td><td className="muted">bonus · 10ft cloud, 1 round</td><td><button className="btn sm">→ pop</button></td></tr>
          <tr><td><b>Boots of Elvenkind</b></td><td>1 worn</td><td className="muted">passive · adv stealth</td><td></td></tr>
        </tbody>
      </table>
    </div>
  );
}

function SheetFeatures() {
  return (
    <div className="grid-2" style={{gap: 14}}>
      {[
        {h:'Class · Rogue 7', items:[
          {n:'Sneak Attack', d:'+4d6 · 1/turn · finesse or ranged · ally w/in 5ft of target or advantage'},
          {n:'Cunning Action', d:'bonus: Dash / Disengage / Hide'},
          {n:'Uncanny Dodge', d:'reaction: halve dmg from one seen attacker'},
          {n:'Evasion', d:'DEX save: half → none, fail → half'},
          {n:'Expertise', d:'×2 prof in Stealth, Deception'},
        ]},
        {h:'Subclass · Soulknife', items:[
          {n:'Psionic Power · 4d6', d:'regen short rest'},
          {n:'Psychic Blades', d:'1d6 psychic · finesse · throw 60'},
          {n:'Psi-Bolstered Knack / Whispers', d:'spend dice'},
        ]},
        {h:'Race · Half-elf', items:[
          {n:'Darkvision', d:'60ft'},
          {n:'Fey Ancestry', d:'adv vs charm · immune sleep'},
          {n:'Skill Versatility', d:'2 extra skills'},
        ]},
        {h:'Background · Charlatan', items:[
          {n:'False Identity', d:'one alternate persona, fully documented'},
          {n:'Forgery kit', d:'tool prof'},
        ]},
      ].map(g => (
        <div key={g.h} className="box soft">
          <div className="box-title"><h3>{g.h}</h3><span className="meta"></span></div>
          <div className="col" style={{gap: 6}}>
            {g.items.map(it => (
              <div key={it.n} style={{borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 6}}>
                <b>{it.n}</b>
                <div className="muted" style={{fontSize: 13, marginTop: 2}}>{it.d}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SheetNotes() {
  return (
    <div className="grid-2" style={{gap: 14}}>
      <div className="box soft">
        <div className="box-title"><h3>Personality</h3><span className="meta">RP</span></div>
        <ul style={{margin:0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7}}>
          <li><b>Trait</b> — keeps multiple holy symbols, just in case.</li>
          <li><b>Ideal</b> — Independence. No god, no master.</li>
          <li><b>Bond</b> — owes Pell more than I can ever repay.</li>
          <li><b>Flaw</b> — trusts easy when there's gold on the table.</li>
        </ul>
      </div>
      <div className="box soft">
        <div className="box-title"><h3>Backstory · short</h3><span className="meta">DM read</span></div>
        <p className="muted" style={{fontSize: 13, lineHeight: 1.7}}>
          Mulmaster street kid. Old Pell took her in at 12 — fence work, then forgery. The Banite
          priestess Selvys "questioned" Pell three winters ago; he came back wrong. Kaelith fled
          to Waterdeep. The job in the Sunset Vault is the first time she's heard Selvys's name in
          two years.
        </p>
      </div>
      <div className="box dashed" style={{gridColumn:'span 2'}}>
        <div className="box-title"><h3>Free notes</h3><span className="meta">scratchpad</span></div>
        <div className="placeholder" style={{minHeight: 80}}>
          markdown notes · auto-tagged by AI · searchable across sessions
        </div>
      </div>
    </div>
  );
}

