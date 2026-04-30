// @ts-nocheck
'use client'

import React from 'react'
import { loadAttunement, unattune, getActiveCharacter, type AttunementState } from '@/lib/character'

// surfaces/Attunement.tsx — magic-item binding · 3-slot economy.
// Live data: /api/character/[id]/attunement (GET/POST/DELETE).

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Attunement() {
  const [live, setLive] = React.useState<AttunementState | null>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async (id: string) => {
    try {
      setLive(await loadAttunement(id))
    } catch (e: any) {
      setError(e?.message ?? 'load failed')
    }
  }, [])

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    if (charId) reload(charId)
  }, [reload])

  const handleBreak = async (slotIndex: number) => {
    if (!characterId) return
    try {
      await unattune(characterId, slotIndex)
      reload(characterId)
    } catch (e: any) {
      setError(e?.message ?? 'unattune failed')
    }
  }

  const slots = [
    {idx: 0, item:{
      n:'Cloak of the Compact',  rarity:'rare', kind:'cloak',
      bonded:'S07 · 2 sessions to attune',
      effects:['+1 AC','adv. on stealth in shadow','reroll fear (1/day)'],
      curse: null,
    }},
    {idx: 1, item:{
      n:'Belt of Doruk',         rarity:'uncommon', kind:'belt',
      bonded:'S03',
      effects:['set STR 19','disadv. on DEX checks (heavy)'],
      curse: null,
    }},
    {idx: 2, item:null}, // free slot
  ];

  const inventory = [
    {n:'Sunblade',                rarity:'rare',     wantsAttune:true,  fits:'longsword', why:'2d8 radiant · daylight'},
    {n:'Ring of mind shielding',  rarity:'uncommon', wantsAttune:true,  fits:'ring',      why:'immune detect/charm read'},
    {n:'Tome of Selvys',          rarity:'rare',     wantsAttune:true,  fits:'tome · arcanist', why:'+1 prep · spell-thief 1/wk', cursed:true},
    {n:'Boots of the winterlands',rarity:'uncommon', wantsAttune:true,  fits:'boots',     why:'cold immune · +1 day rations'},
    {n:'Bag of holding',          rarity:'uncommon', wantsAttune:false, fits:'utility',   why:'no attune required'},
    {n:'Gauntlets of ogre power', rarity:'uncommon', wantsAttune:true,  fits:'gauntlets', why:'STR 19 · conflicts w/ Belt of Doruk'},
  ];

  const partyOverview = [
    {n:'Kaelith', used: 2, max: 3},
    {n:'Vessa',   used: 3, max: 3},
    {n:'Doruk',   used: 1, max: 3},
  ];

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">32 · Magic-item binding</div>
          <h2>Attunement</h2>
        </div>
        <span className="who">player surface · 3 slots, hard-capped</span>
      </div>

      <div className="aside blue" style={{marginBottom: 18}}>
        ↳ Player inventory tags items but doesn't track the 3-slot economy. each PC has
        exactly three attunement slots; bonding takes a short rest, breaking takes none.
        Cursed items reveal slot-locks the hard way.
      </div>

      {/* Live attunement strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live attunements</h3>
          <span className="meta">→ /api/character/{characterId?.slice(0,8) ?? '…'}/attunement · character_attunements</span>
        </div>
        {!characterId && <div className="tiny muted">no active character — set one via Sheet (14)</div>}
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {live && (
          <div className="row" style={{gap: 10, marginTop: 8}}>
            <span className="stat">{live.used}/{live.max} slots in use</span>
            {live.slots.map((s, idx) => (
              <span key={idx} className={`chip sm ${s ? 'green' : ''}`}>
                slot {idx}: {s ? (s.item?.name ?? `item ${s.itemId.slice(0,6)}…`) : 'empty'}
                {s && (
                  <button
                    className="btn sm"
                    onClick={() => handleBreak(idx)}
                    style={{marginLeft: 4, padding:'1px 6px', fontSize: 10}}
                  >break</button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="surface-head" style={{borderBottom: 0, marginBottom: 8}}>
        <h3 style={{margin: 0, fontFamily:'var(--serif)', fontSize: 22}}>Kaelith · 2/3 slots used</h3>
        <span className="tiny">tap any slot to break / re-bind</span>
      </div>

      {/* the three slots */}
      <div className="grid-3" style={{marginBottom: 22}}>
        {slots.map(s => s.item ? (
          <div key={s.idx} className="box" style={{padding: 16, position:'relative', borderColor:'var(--ink)'}}>
            <span className="chip sm" style={{position:'absolute', top: 10, right: 10}}>slot {s.idx+1}</span>
            <div className="tiny">{s.item.kind.toUpperCase()} · {s.item.rarity.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight: 600, marginTop: 4}}>{s.item.n}</div>
            <div className="tiny muted" style={{marginTop: 4}}>bonded {s.item.bonded}</div>

            <div className="section-title" style={{margin:'12px 0 6px'}}>Effects</div>
            <ul style={{margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.5}}>
              {s.item.effects.map((e,i) => <li key={i}>{e}</li>)}
            </ul>

            {s.item.curse && (
              <div className="aside" style={{marginTop: 10, fontSize: 14}}>↳ curse: {s.item.curse}</div>
            )}

            <div className="row" style={{gap: 6, marginTop: 12, paddingTop: 8, borderTop:'1px dashed var(--rule-soft)'}}>
              <button className="btn sm">inspect</button>
              <button className="btn sm danger" style={{marginLeft:'auto'}}>break bond (short rest)</button>
            </div>
          </div>
        ) : (
          <div key={s.idx} className="box dashed" style={{padding: 16, minHeight: 200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center'}}>
            <span className="tiny">SLOT {s.idx+1}</span>
            <div style={{fontFamily:'var(--hand)', fontSize: 28, color:'var(--accent-gold)', margin:'14px 0 8px'}}>open</div>
            <div className="tiny muted" style={{maxWidth: 200}}>drag an item from inventory below — short rest to bond</div>
          </div>
        ))}
      </div>

      {/* party row */}
      <div className="grid-3" style={{marginBottom: 22}}>
        {partyOverview.map(p => (
          <div key={p.n} className="box soft">
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{p.n}</span>
              <span className={`stat ${p.used===p.max?'':''}`}>{p.used}/{p.max} slots</span>
            </div>
            <div className="row" style={{gap: 4, marginTop: 8}}>
              {Array.from({length: p.max}).map((_,i) => (
                <div key={i} style={{
                  flex: 1, height: 24,
                  background: i < p.used ? 'var(--ink)' : 'var(--paper-2)',
                  border: '1.5px solid var(--ink)',
                }} />
              ))}
            </div>
            {p.used === p.max && <div className="tiny" style={{color:'var(--accent-red)', marginTop: 6}}>full · cannot bond more</div>}
          </div>
        ))}
      </div>

      {/* inventory wanting attune */}
      <div className="section-title">Inventory · wants attune</div>
      <table className="inv">
        <thead>
          <tr><th>item</th><th>fits</th><th>rarity</th><th>why bond</th><th>conflicts</th><th></th></tr>
        </thead>
        <tbody>
          {inventory.map((it,i) => (
            <tr key={i}>
              <td>
                <span style={{fontFamily:'var(--serif)', fontWeight: 500}}>{it.n}</span>
                {it.cursed && <span className="chip sm red" style={{marginLeft: 6}}>cursed?</span>}
              </td>
              <td className="tiny">{it.fits}</td>
              <td><span className={`chip sm ${it.rarity==='rare'?'gold':''}`}>{it.rarity}</span></td>
              <td className="tiny" style={{fontStyle:'italic'}}>{it.why}</td>
              <td className="tiny muted">
                {it.n.includes('Gauntlets') ? 'Belt of Doruk (STR set)' : '—'}
              </td>
              <td>
                {it.wantsAttune
                  ? <button className="btn sm primary">→ bind (slot 3)</button>
                  : <span className="tiny muted">no attune</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* attune economy notes */}
      <div className="grid-2" style={{marginTop: 22}}>
        <div className="box dark">
          <div className="tiny" style={{color:'var(--paper-3)'}}>WHEN BREAKING A BOND</div>
          <ul style={{margin: '8px 0 0', paddingLeft: 16, fontSize: 14, lineHeight: 1.55}}>
            <li>cursed items resist · DC 15 CHA save to release</li>
            <li>sentient items may bargain</li>
            <li>some grant a parting echo (1 last use, 24h cooldown)</li>
          </ul>
        </div>
        <div className="box">
          <div className="box-title"><h3>Class-locked bonds</h3><span className="meta">flagged</span></div>
          <ul style={{margin: 0, paddingLeft: 16, fontSize: 14, lineHeight: 1.55}}>
            <li><b>Tome of Selvys</b> — wizard / arcanist only · Vessa eligible, slots full</li>
            <li><b>Sunblade</b> — non-evil only (Bane-touched cannot bond)</li>
            <li><b>Cloak of the Compact</b> — bound to faction; breaks if Compact dissolves</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

