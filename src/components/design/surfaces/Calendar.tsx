// @ts-nocheck
'use client'

import React from 'react'
import { loadCalendar, type CalendarData } from '@/lib/world'

// surfaces/Calendar.tsx — World calendar / time scrubber (engine/clockwork.ts).
// Live band loads parties.currentTick + clockwork_events for the active campaign.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Calendar() {
  const months = ['Hammer','Alturiak','Ches','Tarsakh','Mirtul','Kythorn','Flamerule','Eleasis','Eleint','Marpenoth','Uktar','Nightal'];
  const today = {m:7, d:23}; // Eleasis 23

  const [live, setLive] = React.useState<CalendarData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    if (!cid) { setError('no campaign in url — append #calendar?campaign=CID'); return }
    loadCalendar({ campaignId: cid }).then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">22 · World · calendar &amp; clockwork</div>
          <h2>World Calendar</h2>
        </div>
        <span className="who">
          {live?.party
            ? `tick ${live.today} · party "${live.party.name}" L${live.party.level}`
            : (error ?? 'loading…')}
        </span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/clockwork.ts runs cadences (daily → yearly). this is the
        &ldquo;what&rsquo;s the date · when&rsquo;s the next market · fast-forward to date X&rdquo; widget.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="row" style={{gap: 14, alignItems:'baseline', flexWrap:'wrap'}}>
          <div>
            <div className="tiny">LIVE PARTY TICK</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 24, fontWeight: 600}}>
              {live?.today ?? '—'}
            </div>
          </div>
          <div>
            <div className="tiny">BIRTH TICK</div>
            <div className="stat">{live?.party?.birthTick ?? '—'}</div>
          </div>
          <div>
            <div className="tiny">DAYS PLAYED</div>
            <div className="stat">{live?.party ? (live.today - live.party.birthTick) : '—'}</div>
          </div>
          <div>
            <div className="tiny">UPCOMING EVENTS</div>
            <div className="stat">{live?.upcoming?.length ?? 0}</div>
          </div>
          <div>
            <div className="tiny">SESSIONS LOGGED</div>
            <div className="stat">{live?.recentSessions?.length ?? 0}</div>
          </div>
          <span style={{flex:1}} />
          <span className="tiny muted">→ /api/world/calendar · parties + clockwork_events</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)', marginTop: 8}}>{error}</div>}
      </div>

      {/* Today panel */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box dark" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="tiny" style={{color:'var(--paper-3)'}}>TODAY · IN-WORLD</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 36, fontWeight: 600, lineHeight: 1.1, marginTop: 4}}>Eleasis 23, 1492 DR</div>
              <div className="hand" style={{color:'var(--paper-3)', fontSize: 20}}>year of three ships sailing</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="stat" style={{color:'var(--paper-3)'}}>Hightide season · 4d before Eleint</div>
              <div className="stat" style={{color:'var(--paper-3)'}}>21:42 · waning gibbous</div>
              <div className="stat" style={{color:'var(--paper-3)'}}>tide: high at 22:18</div>
            </div>
          </div>
          <hr className="rule" style={{borderColor:'var(--ink-3)', margin: '14px 0'}} />
          <div className="row" style={{gap: 10, alignItems:'center'}}>
            <span className="tiny" style={{color:'var(--paper-3)'}}>SCRUBBER</span>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>← 1 day</button>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>← 1 week</button>
            <div style={{flex:1, height: 6, background:'rgba(255,255,255,0.06)', position:'relative', border:'1px solid var(--ink-3)'}}>
              <div style={{position:'absolute', left: `${(today.m + today.d/30)/12*100}%`, top: -4, width: 14, height: 14, background:'var(--accent-gold)', borderRadius:'50%', border: '2px solid var(--paper)', transform: 'translateX(-50%)'}} />
            </div>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>1 week →</button>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>1 month →</button>
            <button className="btn sm" style={{background:'var(--paper-2)', color:'var(--ink)'}}>jump to…</button>
          </div>
          <div className="row" style={{justifyContent:'space-between', marginTop: 6, fontFamily:'var(--mono)', fontSize: 10, color:'var(--paper-3)'}}>
            {months.map((m, i) => <span key={m} style={{flex:1, textAlign:'center', color: i===today.m?'var(--accent-gold)':'inherit'}}>{m.slice(0,3)}</span>)}
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Cadence ticks</h3><span className="meta">due now</span></div>
          <div className="col" style={{gap: 6, fontSize: 13}}>
            <div className="row" style={{justifyContent:'space-between'}}><span><span className="dot blue" /> daily world tick</span><span className="stat">in 2h 18m</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span><span className="dot gold" /> weekly market tick</span><span className="stat">in 4d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span><span className="dot red" /> villain ticks (4)</span><span className="stat">in 4d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span><span className="dot green" /> downtime resolve</span><span className="stat">in 7d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span><span className="dot" /> seasonal tick</span><span className="stat">in 8d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span><span className="dot" /> yearly · holidays</span><span className="stat">109d</span></div>
          </div>
          <button className="btn sm" style={{marginTop: 10}}>force tick →</button>
        </div>
      </div>

      {/* Month grid */}
      <div className="section-title">Eleasis · 30 days · current month</div>
      <div className="box" style={{padding: 14}}>
        <div style={{display:'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4}}>
          {Array.from({length:30}).map((_, i) => {
            const day = i+1;
            const events = {
              5:  [{c:'red',  l:'Zhent move'}],
              9:  [{c:'blue', l:'visit Suzail'}],
              12: [{c:'red',  l:'kill enforcer'}],
              14: [{c:'gold', l:'Selgaunt closed'}],
              17: [{c:'blue', l:'session 14 · vault'}],
              19: [{c:'red',  l:'unrest spike'}],
              22: [{c:'gold', l:'refugee surge'}],
              23: [{c:'gold', l:'TODAY · 21:42'},{c:'blue', l:'sess 14 cont.'}],
              26: [{c:'green',l:'next session'}],
              28: [{c:'gold', l:'Sembia news'}],
              30: [{c:'gold', l:'month tick'}],
            }[day] || [];
            return (
              <div key={day} style={{
                border: '1px solid var(--rule-soft)',
                background: day === today.d ? 'var(--ink)' : 'var(--paper)',
                color: day === today.d ? 'var(--paper)' : 'var(--ink)',
                padding: 6, minHeight: 78, position:'relative'}}>
                <div className="tiny" style={{color: day === today.d ? 'var(--paper-3)' : 'var(--ink-3)'}}>{day}</div>
                <div className="col" style={{gap: 2, marginTop: 4}}>
                  {events.map((e, i) => (
                    <div key={i} style={{fontSize: 9, fontFamily:'var(--mono)', display:'flex', alignItems:'center', gap: 3}}>
                      <span className={`dot ${e.c}`} style={{width: 5, height: 5}} />
                      <span style={{lineHeight: 1.1}}>{e.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming */}
      <div className="grid-2" style={{marginTop: 18}}>
        <div className="box">
          <div className="box-title"><h3>Upcoming · scheduled</h3><span className="meta">live · clockwork_events</span></div>
          <div className="col" style={{gap: 6, fontSize: 14}}>
            {!live && <div className="muted">{error ?? 'loading…'}</div>}
            {live && live.upcoming.length === 0 && (
              <div className="muted">no clockwork events scheduled past day {live.today}.</div>
            )}
            {live && live.upcoming.map((e) => {
              const delta = e.worldDay - live.today
              const tone = e.eventType === 'combat' ? 'red'
                : e.eventType === 'social' ? 'blue'
                : e.eventType === 'discovery' ? 'gold'
                : 'green'
              return (
                <div key={e.id} className="row" style={{justifyContent:'space-between', padding: '6px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
                  <span><span className={`dot ${tone}`} /> <b>day {e.worldDay}</b> <span className="muted">· +{delta}d · {e.eventType}</span></span>
                  <span title={e.description ?? ''}>{e.title}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="box">
          <div className="box-title"><h3>Holidays &amp; cycles</h3><span className="meta">Faerûn calendar</span></div>
          <div className="col" style={{gap: 6, fontSize: 14}}>
            <div className="row" style={{justifyContent:'space-between'}}><span>Higharvestide (feast)</span><span className="stat">Eleint 21 · +28d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Last Sunset (autumn)</span><span className="stat">Marpenoth 30 · +67d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>The Feast of the Moon</span><span className="stat">Uktar 30 · +97d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Midwinter</span><span className="stat">Hammer 31 · +159d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Greengrass</span><span className="stat">Tarsakh 31 · +249d</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Shieldmeet (every 4y)</span><span className="stat">Flamerule · +ny</span></div>
          </div>
          <div className="aside" style={{marginTop: 10, fontSize: 16}}>
            ↳ holidays trigger world events automatically · clockwork pre-rolls them.
          </div>
        </div>
      </div>
    </div>
  );
}

