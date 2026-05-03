// @ts-nocheck
'use client'

import React from 'react'
import {
  loadCharacterSheet,
  listCharacters,
  loadInventory,
  type SheetData,
  type CharacterListItem,
  type CharacterInventory,
} from '@/lib/character'
import { loadSpells } from '@/lib/world-detail'
import { useSession } from '@/lib/session-context'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Sheet.tsx — Character sheet wired to /api/character/:id.
// Top half (identity, abilities, saves, skills, combat block, conditions,
// resources, proficiencies) is fully derived from loadCharacterSheet().
// Bottom half action/spell/inventory/features/notes panels are EmptyState
// pending engine bridges — Sheet doesn't ship mock action data anymore.

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
  const [tab, setTab] = React.useState<'actions' | 'spells' | 'inventory' | 'features' | 'notes'>('actions')
  const [sheet, setSheet] = React.useState<SheetData | null>(null)
  const [list, setList] = React.useState<CharacterListItem[] | null>(null)
  const [inventory, setInventory] = React.useState<CharacterInventory | null>(null)
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

  // Inventory is fetched separately so a slow inventory query doesn't block sheet render.
  React.useEffect(() => {
    if (!activeCharacterId) return
    loadInventory(activeCharacterId).then(setInventory).catch(() => setInventory(null))
  }, [activeCharacterId])

  // Spells list — same pattern; the Spells surface (#25) is the deeper detail
  // view, this is the quick-cast strip.
  const [spells, setSpells] = React.useState<any | null>(null)
  React.useEffect(() => {
    if (!activeCharacterId) return
    loadSpells(activeCharacterId).then(setSpells).catch(() => setSpells(null))
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
            <h2>Pick a character <FidelityBadge level="partial" /></h2>
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
          <EmptyState
            label="no characters yet"
            hint={<a onClick={() => { window.location.hash = 'chargen' }} style={{ cursor: 'pointer', color: 'var(--accent-blue)' }}>build one →</a>}
          />
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
          <h2>{character.name} <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">
          {classLine} · derived live ·{' '}
          <a onClick={() => { setActiveCharacterId(null); setSheet(null) }} style={{ cursor: 'pointer' }}>switch character</a>
        </span>
      </div>

      <p style={{maxWidth: 740, color:'var(--ink-2)', marginTop: 0}}>
        Top half is the <b>paper stat block</b> — abilities, saves, skills, combat numbers — derived
        from <span className="kbd">engine/mm-character.ts</span>. Bottom half flips to <b>modern action panels</b>:
        what you can <i>do</i> right now. <i>Action panels pending engine bridges (mm-character actions / spell registry / inventory).</i>
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
            <EmptyState label="no active conditions" hint="bind to mm-character.conditions when concentration / status effects fire." />
          </div>

          <div className="box">
            <div className="box-title"><h3>Resources</h3><span className="meta">short / long rest</span></div>
            <div className="col" style={{gap: 8}}>
              <div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="stat">Hit dice ({primaryHitDie})</span>
                  <span className="stat"><b>{level}/{level}</b></span>
                </div>
                <div className="bar"><span style={{width: '100%'}} /></div>
                <div className="tiny muted">spend during short rest · button pending</div>
              </div>
              <div className="tiny muted">
                ↳ class resources (psi-dice, slots, ki) wired in a future pass
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Proficiencies</h3><span className="meta">tools · weapons · armor</span></div>
            <EmptyState label="proficiencies pending" hint="character_proficiencies table writes are a future pass." />
          </div>
        </div>
      </div>

      {/* ===== BOTTOM: modern panels ===== */}
      <div className="section-title">In play · what you can do right now</div>
      <div className="tabs">
        {([
          ['actions', 'Actions'],
          ['spells', 'Spells / psionics'],
          ['inventory', 'Inventory'],
          ['features', 'Features'],
          ['notes', 'Notes'],
        ] as const).map(([k, lbl]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>

      <div className="box" style={{borderTop:'none', borderTopLeftRadius: 0, borderTopRightRadius: 0}}>
        {tab === 'actions' && sheet && (
          <ActionsPanel sheet={sheet} inventory={inventory} />
        )}
        {tab === 'spells' && (
          <SpellsPanel spells={spells} />
        )}
        {tab === 'inventory' && (
          inventory && inventory.totals.items > 0 ? (
            <div>
              <div className="row" style={{ gap: 14, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="stat">
                  Carry <b>{inventory.totals.weight.toFixed(1)} lb</b>
                </span>
                <span className="stat">
                  Value <b>{inventory.totals.valueGP.toFixed(0)} gp</b>
                </span>
                <span className="stat">
                  Containers <b>{inventory.totals.containers}</b>
                </span>
                <span className="stat">
                  Items <b>{inventory.totals.items}</b>
                </span>
              </div>
              {inventory.inventories.map((inv) =>
                inv.containers.map((c) => (
                  <div key={c.id} className="box soft" style={{ marginBottom: 10 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <b>{c.name}</b> <span className="tiny muted">· {c.type}</span>
                      </div>
                      <span className="tiny muted">
                        {c.items.length} item{c.items.length === 1 ? '' : 's'} · {c.weightCapacity}lb cap
                      </span>
                    </div>
                    {c.items.length === 0 ? (
                      <div className="tiny muted" style={{ marginTop: 6 }}>empty</div>
                    ) : (
                      <table className="inv" style={{ marginTop: 6 }}>
                        <thead><tr><th>item</th><th>qty</th><th>category</th><th>rarity</th><th style={{ textAlign: 'right' }}>weight</th><th style={{ textAlign: 'right' }}>value</th></tr></thead>
                        <tbody>
                          {c.items.map((it) => (
                            <tr key={it.id}>
                              <td>
                                <b>{it.name}</b>
                                {it.magical && <span className="chip sm gold" style={{ marginLeft: 6, fontSize: 9 }}>magical</span>}
                                {it.requiresAttunement && <span className="chip sm blue" style={{ marginLeft: 4, fontSize: 9 }}>attune</span>}
                              </td>
                              <td className="stat">{it.quantity}</td>
                              <td className="tiny muted">{it.category}</td>
                              <td className="tiny">{it.rarity}</td>
                              <td className="stat" style={{ textAlign: 'right' }}>{(it.weight * it.quantity).toFixed(1)}</td>
                              <td className="stat" style={{ textAlign: 'right' }}>{(it.valueGP * it.quantity).toFixed(0)}gp</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )),
              )}
            </div>
          ) : (
            <EmptyState
              label={inventory ? 'no items' : 'inventory pending'}
              hint={inventory
                ? 'inventory rows exist but no items yet. Loot, craft, or buy to populate.'
                : 'bind to engine/inventory.ts polymorphic owner_type=character once the bag system seeds.'}
            />
          )
        )}
        {tab === 'features' && (
          <EmptyState
            label="features panel pending"
            hint="bind to character_features (class/subclass/race/background) once seeded by chargen commit."
          />
        )}
        {tab === 'notes' && (
          <EmptyState
            label="notes panel pending"
            hint="markdown scratchpad with AI auto-tagging — wires once player-notes table lands."
          />
        )}
      </div>
    </div>
  )
}

// ── ActionsPanel ───────────────────────────────────────────────────────────
// Derives action list from sheet (for the basic attack) + inventory items
// flagged as weapons.
function ActionsPanel({ sheet, inventory }: { sheet: SheetData; inventory: CharacterInventory | null }) {
  const dexMod = sheet.modifiers.dexterity ?? 0
  const strMod = sheet.modifiers.strength ?? 0
  const profBonus = sheet.proficiencyBonus

  const weaponItems = inventory?.inventories
    .flatMap((inv) => inv.containers)
    .flatMap((c) => c.items)
    .filter((it) => /weapon|sword|axe|bow|dagger|mace|staff|spear|hammer/.test((it.category ?? '').toLowerCase())) ?? []

  const baseAttackBonus = strMod + profBonus
  const baseDamage = `1d8${strMod >= 0 ? '+' : ''}${strMod}`

  return (
    <div>
      <div className="row" style={{ gap: 14, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="stat">PB <b>+{profBonus}</b></span>
        <span className="stat">STR <b>{strMod >= 0 ? '+' : ''}{strMod}</b></span>
        <span className="stat">DEX <b>{dexMod >= 0 ? '+' : ''}{dexMod}</b></span>
      </div>
      <div className="section-title" style={{marginTop: 0}}>Standard actions</div>
      <table className="inv">
        <thead><tr><th>action</th><th>attack</th><th>damage</th><th>notes</th></tr></thead>
        <tbody>
          <tr>
            <td><b>Basic Attack</b></td>
            <td className="stat">+{baseAttackBonus}</td>
            <td className="stat">{baseDamage}</td>
            <td className="tiny muted">unarmed / improvised</td>
          </tr>
          {weaponItems.length === 0 ? null : weaponItems.map((w) => (
            <tr key={w.id}>
              <td><b>{w.name}</b> {w.magical && <span className="chip sm gold" style={{marginLeft: 4, fontSize: 9}}>magical</span>}</td>
              <td className="stat">+{baseAttackBonus}</td>
              <td className="stat">{baseDamage}</td>
              <td className="tiny muted">{w.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {weaponItems.length === 0 && (
        <div className="tiny muted" style={{marginTop: 8}}>
          Equip a weapon (Inventory tab) to see weapon attacks here. Attack/damage formulas use STR + PB heuristically; engine/mm-character.ts derived actions land in v2.
        </div>
      )}
    </div>
  )
}

// ── SpellsPanel ────────────────────────────────────────────────────────────
function SpellsPanel({ spells }: { spells: any | null }) {
  if (!spells) {
    return <EmptyState label="no spells data" hint="bind via /api/character/[id]/spells. The character may not have spell slots." />
  }
  const slots: Array<{ level: number; current: number; max: number }> = spells.slots ?? []
  const prepared: Array<{ id: string; name: string; level: number; school?: string }> = spells.prepared ?? spells.spells ?? []
  const cantrips = prepared.filter((s) => s.level === 0)
  const leveled = prepared.filter((s) => s.level > 0)

  return (
    <div>
      {slots.length > 0 && (
        <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {slots.map((slot) => (
            <span key={slot.level} className="chip sm">
              L{slot.level} <b>{slot.current}</b>/<span className="muted">{slot.max}</span>
            </span>
          ))}
        </div>
      )}
      {cantrips.length > 0 && (
        <>
          <div className="section-title" style={{marginTop: 0}}>Cantrips</div>
          <ul className="kvs">
            {cantrips.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b> {s.school && <span className="tiny muted">· {s.school}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {leveled.length > 0 && (
        <>
          <div className="section-title">Prepared / known</div>
          <ul className="kvs">
            {leveled.map((s) => (
              <li key={s.id}>
                <span className="chip sm">L{s.level}</span> <b>{s.name}</b> {s.school && <span className="tiny muted">· {s.school}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {cantrips.length === 0 && leveled.length === 0 && (
        <EmptyState label="no spells prepared" hint="cast or prepare spells via the Spells surface (#25)." />
      )}
    </div>
  )
}
