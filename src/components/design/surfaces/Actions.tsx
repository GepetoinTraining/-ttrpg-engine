// @ts-nocheck
'use client'

import React from 'react'
import { useWorld } from '@/lib/use-world'
import { FidelityBadge } from './_chips'

// surfaces/Actions.tsx — Surface 44. Canonical slow-life entry point.
// 8 PlayerIntent variants in a single tabbed surface.
// Reads engine/interactions.ts. Surfaced contextually, not in main nav by design.
//
// WIRED via `useWorld()` (Slice 3 C11): submit → engineClient.applyIntent
// → buffers a `writeKappa` action → push() → /api/world/slot/push.
// The cron drain copies it into `tpb_entries` in arrival order.

export default function Actions() {
  const intents = [
    {k:'examine_deposit', cat:'production', cost:'1h · perception roll',
     desc:'Inspect a deposit. On success, advances material mastery for this resource.',
     fields:[{l:'deposit', t:'select', opts:['d-iron-1 (East Reach)','d-stone-1 (Saerb)','d-silver-1 (Wheloon)','d-clay-1 (fen)']}, {l:'roll bonus', t:'number'}]},
    {k:'extract', cat:'production', cost:'N days · workers required',
     desc:'Extract raw resource from a deposit. Drains reserves; quality follows mastery band.',
     fields:[{l:'deposit', t:'select', opts:['d-iron-1','d-stone-1','d-silver-1']}, {l:'workers', t:'number'}, {l:'days', t:'number'}]},
    {k:'study_material', cat:'production', cost:'2h per level',
     desc:'Advance mastery on a material you\'ve seen. Caps at 2 without a master tutor.',
     fields:[{l:'material', t:'select', opts:['iron','silver','stone','wool','flax']}, {l:'hours', t:'number'}]},
    {k:'claim_plot', cat:'land', cost:'10gp filing · 30d defense window',
     desc:'File claim on unclaimed land. Becomes contested if another claimant files within 30d.',
     fields:[{l:'location (edge:mile)', t:'text'}, {l:'plot type', t:'select', opts:['farm','herd','quarry','forest']}]},
    {k:'tend_herd', cat:'husbandry', cost:'2h per herd',
     desc:'Maintain a herd\'s health. Skipping > 14d drops health; > 60d lapses claim.',
     fields:[{l:'herd', t:'select', opts:['h-cattle-1','h-sheep-1','h-chick-1']}, {l:'feed bonus (gp)', t:'number'}]},
    {k:'slaughter', cat:'husbandry', cost:'returns meat / leather / tallow',
     desc:'Cull head from herd. Returns scale with species + health.',
     fields:[{l:'herd', t:'select', opts:['h-cattle-1','h-sheep-1','h-chick-1']}, {l:'count', t:'number'}, {l:'category', t:'select', opts:['adults','elders']}]},
    {k:'plant_crops', cat:'agriculture', cost:'4h · seasonal',
     desc:'Sow a fallow plot. Crop choice gated by current season.',
     fields:[{l:'plot', t:'select', opts:['p-east-1 (East Reach west)']}, {l:'crop', t:'select', opts:['wheat','barley','flax','turnip','rye']}]},
    {k:'sell_item', cat:'market', cost:'price follows market tier',
     desc:'List item at local market. Final price modulated by Markets surface.',
     fields:[{l:'item', t:'text'}, {l:'qty', t:'number'}, {l:'asking price (gp)', t:'number'}]},
  ]

  // mock κ-mutation previews per intent. surfaced when 'preview resolution' is toggled.
  const previews = {
    examine_deposit: {
      check: 'Wisdom (Perception) DC 14',
      onPass: [
        {k:'mastery.advance', p:'iron', from: 2, to: 3, tag:'gold'},
        {k:'deposit.reveal',  p:'d-iron-1.hiddenAffix', from:'████', to:'cold-iron seam'},
        {k:'log.append',      p:'examined d-iron-1; mastery iron → 3'},
      ],
      onFail: [{k:'mastery.attempt', p:'iron · +0.5h study credit'}],
      cost: [{k:'time.consume', p:'1h'}],
    },
    extract: {
      check: '— (deterministic)',
      onPass: [
        {k:'deposit.drain',   p:'d-iron-1.reserves', from: 4200, to: 4116},
        {k:'inventory.add',   p:'iron ore × 84', tag:'green'},
        {k:'workers.assign',  p:'4 workers × 3 days = 12 worker-days'},
      ],
      onFail: [],
      cost: [{k:'time.consume', p:'3 days'}, {k:'gp.deduct', p:'12gp wages', tag:'red'}],
    },
    study_material: {
      check: 'Intelligence DC scales with target level',
      onPass: [{k:'mastery.advance', p:'iron', from: 2, to: 3, tag:'gold'}],
      onFail: [{k:'mastery.attempt', p:'iron · +1h study credit'}],
      cost: [{k:'time.consume', p:'2h per level'}],
    },
    claim_plot: {
      check: '— (filing)',
      onPass: [
        {k:'claim.create',    p:'plot @ E12:7 · type=farm', tag:'green'},
        {k:'claim.window',    p:'30d defense · contestable until day 502'},
      ],
      onFail: [],
      cost: [{k:'gp.deduct', p:'10gp filing', tag:'red'}],
    },
    tend_herd: {
      check: '— (deterministic)',
      onPass: [
        {k:'herd.health',     p:'h-cattle-1', from: 0.84, to: 0.92, tag:'green'},
        {k:'herd.lastTended', p:'h-cattle-1 → day 472'},
      ],
      onFail: [],
      cost: [{k:'time.consume', p:'2h'}],
    },
    slaughter: {
      check: '—',
      onPass: [
        {k:'herd.cull',     p:'h-cattle-1.adults −2', tag:'red'},
        {k:'inventory.add', p:'beef 640 lb · 2 hides · 24 lb tallow', tag:'green'},
      ],
      onFail: [],
      cost: [{k:'herd.health', p:'−0.04 (cull stress)'}],
    },
    plant_crops: {
      check: '— (seasonal gate)',
      onPass: [
        {k:'plot.plant',  p:'p-east-1 · wheat', tag:'green'},
        {k:'plot.harvestDay', p:'planted day 472 + 90 = day 562'},
      ],
      onFail: [{k:'season.gate', p:'wheat is spring crop — cannot plant in Eleasis', tag:'red'}],
      cost: [{k:'time.consume', p:'4h'}, {k:'inventory.deduct', p:'wheat seed × 1'}],
    },
    sell_item: {
      check: 'Markets tier modulation',
      onPass: [
        {k:'market.list',    p:'iron ore × 50 @ 12gp'},
        {k:'gp.add',         p:'estimated 540gp (Saerb tier B × 0.9)', tag:'green'},
      ],
      onFail: [],
      cost: [{k:'market.fee', p:'5% listing fee', tag:'red'}],
    },
  }

  const [sel, setSel] = React.useState('examine_deposit')
  const [showPreview, setShowPreview] = React.useState(true)
  const cur = intents.find(i => i.k === sel)
  const preview = previews[sel]

  // ── Wired plumbing ──
  const worldApi = useWorld()
  const [formValues, setFormValues] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)

  // Reset form values when intent changes
  React.useEffect(() => {
    setFormValues({})
    setFeedback(null)
  }, [sel])

  const handleField = (label: string, value: string) => {
    setFormValues((v) => ({ ...v, [label]: value }))
  }

  const handleSubmit = async () => {
    if (!worldApi.account || !worldApi.character) {
      setFeedback('no active character — log in first')
      setTimeout(() => setFeedback(null), 2400)
      return
    }
    setSubmitting(true)
    try {
      worldApi.applyIntent(cur.k, formValues)
      await worldApi.push()
      setFeedback(`✓ ${cur.k} queued for next drain`)
      setFormValues({})
    } catch (e: any) {
      setFeedback(`failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setSubmitting(false)
      setTimeout(() => setFeedback(null), 3200)
    }
  }

  const handleBuffer = () => {
    if (!worldApi.account || !worldApi.character) {
      setFeedback('no active character — log in first')
      setTimeout(() => setFeedback(null), 2400)
      return
    }
    worldApi.applyIntent(cur.k, formValues)
    setFeedback(`buffered (${worldApi.pendingCount + 1} pending) — push when ready`)
    setTimeout(() => setFeedback(null), 3200)
  }

  const catColor = {production:'gold', land:'', husbandry:'green', agriculture:'green', market:'blue'}

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">44 · L5 · slow-life · canonical entry</div>
          <h2>Actions <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player view · contextual surface</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ all 8 PlayerIntent variants. <i>not advertised</i> — surfaced when context warrants
        (standing on a deposit hex → "examine" appears; near unclaimed land → "claim_plot").
        each form routes to engine/interactions.ts resolver.
      </div>

      <div className="grid-3" style={{gap: 18, alignItems:'flex-start'}}>
        <div className="col" style={{gap: 6}}>
          {intents.map(i => (
            <a key={i.k} onClick={() => setSel(i.k)} style={{
              padding:'8px 12px', cursor:'pointer', display:'block',
              border:'1px solid '+(sel===i.k?'var(--rule)':'var(--rule-soft)'),
              background: sel===i.k ? 'var(--paper-2)' : 'var(--paper)',
            }}>
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', gap: 6}}>
                <span style={{fontFamily:'var(--mono)', fontSize: 13, fontWeight: 600}}>{i.k}</span>
                <span className={`chip sm ${catColor[i.cat]}`}>{i.cat}</span>
              </div>
            </a>
          ))}
        </div>

        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="tiny">INTENT · {cur.cat.toUpperCase()}</div>
          <div style={{fontFamily:'var(--mono)', fontSize: 24, fontWeight: 600, marginTop: 2}}>{cur.k}</div>
          <div className="tiny muted" style={{marginTop: 4}}>{cur.cost}</div>
          <hr className="rule dashed" />
          <p style={{fontSize: 14, color:'var(--ink-2)', margin: 0}}>{cur.desc}</p>

          <div className="section-title">Form</div>
          <div className="col" style={{gap: 10}}>
            {cur.fields.map((f, i) => (
              <label key={i} style={{display:'block'}}>
                <div className="tiny" style={{marginBottom: 4}}>{f.l.toUpperCase()}</div>
                {f.t === 'select' && (
                  <select
                    value={formValues[f.l] ?? ''}
                    onChange={(e) => handleField(f.l, e.target.value)}
                    style={{width:'100%', border:'1px solid var(--rule)', background:'var(--paper-2)', padding:'6px 10px', fontFamily:'var(--serif)', fontSize: 14}}
                  >
                    <option value="">— select —</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {f.t === 'text' && (
                  <input
                    type="text"
                    value={formValues[f.l] ?? ''}
                    onChange={(e) => handleField(f.l, e.target.value)}
                    style={{width:'100%', border:'1px solid var(--rule)', background:'var(--paper-2)', padding:'6px 10px', fontFamily:'var(--serif)', fontSize: 14}}
                  />
                )}
                {f.t === 'number' && (
                  <input
                    type="number"
                    value={formValues[f.l] ?? ''}
                    onChange={(e) => handleField(f.l, e.target.value)}
                    style={{width: 140, border:'1px solid var(--rule)', background:'var(--paper-2)', padding:'6px 10px', fontFamily:'var(--mono)', fontSize: 13}}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="row" style={{gap: 6, marginTop: 16, alignItems: 'center', flexWrap: 'wrap'}}>
            <button
              className="btn primary"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'pushing…' : 'submit intent →'}
            </button>
            <button
              className="btn"
              disabled={submitting}
              onClick={handleBuffer}
            >
              buffer (push later)
            </button>
            <button className="btn" onClick={() => setShowPreview(s => !s)}>
              {showPreview ? 'hide κ-preview' : 'show κ-preview'}
            </button>
            {worldApi.pendingCount > 0 && (
              <span className="tiny muted" style={{marginLeft: 8}}>
                {worldApi.pendingCount} pending action{worldApi.pendingCount === 1 ? '' : 's'}
              </span>
            )}
            {feedback && (
              <span className="tiny" style={{marginLeft: 8, color: feedback.startsWith('✓') ? 'var(--accent-green)' : feedback.startsWith('failed') ? 'var(--accent-red)' : 'var(--ink-2)'}}>
                {feedback}
              </span>
            )}
          </div>
          <div className="tiny" style={{marginTop: 8}}>
            routes via engine-client.applyIntent(intent) → /api/world/slot/push → cron drain → tpb_entries
          </div>

          {showPreview && preview && (
            <div className="box soft" style={{marginTop: 14, background:'var(--paper-2)'}}>
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <span className="hand ink" style={{fontSize: 18}}>Preview · κ-mutations</span>
                <span className="tiny muted">resolver dry-run · no state written</span>
              </div>
              <div className="tiny" style={{margin:'6px 0 10px'}}>CHECK · {preview.check}</div>

              {preview.cost.length > 0 && (
                <div style={{marginBottom: 10}}>
                  <div className="tiny" style={{color:'var(--accent-red)'}}>COST — always applied</div>
                  <div className="col" style={{gap: 2, marginTop: 4, fontFamily:'var(--mono)', fontSize: 12}}>
                    {preview.cost.map((m,i) => <KappaRow key={i} m={m} />)}
                  </div>
                </div>
              )}

              <div style={{marginBottom: 10}}>
                <div className="tiny" style={{color:'var(--accent-green)'}}>ON PASS</div>
                <div className="col" style={{gap: 2, marginTop: 4, fontFamily:'var(--mono)', fontSize: 12}}>
                  {preview.onPass.length > 0
                    ? preview.onPass.map((m,i) => <KappaRow key={i} m={m} />)
                    : <div className="muted">— no further mutations</div>}
                </div>
              </div>

              {preview.onFail.length > 0 && (
                <div>
                  <div className="tiny" style={{color:'var(--ink-3)'}}>ON FAIL</div>
                  <div className="col" style={{gap: 2, marginTop: 4, fontFamily:'var(--mono)', fontSize: 12}}>
                    {preview.onFail.map((m,i) => <KappaRow key={i} m={m} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KappaRow({m}) {
  return (
    <div className="row" style={{gap: 6, alignItems:'baseline'}}>
      <span style={{color:'var(--ink-3)'}}>·</span>
      <span style={{color:'var(--ink-2)', fontWeight: 600}}>{m.k}</span>
      {m.p && <span>{m.p}</span>}
      {m.from !== undefined && <span className="muted">({String(m.from)} → <b style={{color:'var(--ink)'}}>{String(m.to)}</b>)</span>}
      {m.tag && <span className={`chip sm ${m.tag}`} style={{marginLeft: 4}}>Δ</span>}
    </div>
  )
}
