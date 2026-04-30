// @ts-nocheck
'use client'

// surfaces/Table.jsx — Shared Table screen (projected during in-person play)

export default function Table() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">07 · Shared screen · projected at table</div>
          <h2>Table View</h2>
        </div>
        <span className="who">read-only · big type · everyone reads from across the room</span>
      </div>

      <div className="aside" style={{marginBottom: 24, maxWidth: 720}}>
        ↳ designed for one shared screen + DM laptop. No clickable controls — DM
        drives, players watch, AI's voiced lines appear here in big type.
      </div>

      {/* Mock projected screen — bigger type, simpler layout */}
      <div style={{
        border: '2px solid var(--ink)',
        background: 'var(--paper)',
        padding: 32,
        boxShadow: '6px 6px 0 var(--rule-soft)',
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 32
      }}>
        <div>
          {/* Scene header */}
          <div className="tiny" style={{marginBottom: 8}}>NOW · ROUND 3 · Eleasis 17, 21:42</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 42, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em'}}>
            The Sunset Vault
          </div>
          <div className="hand" style={{fontSize: 26, marginTop: 6}}>Waterdeep · dim torchlight · trap active</div>

          <hr className="rule" />

          {/* NPC voiced line — huge */}
          <div style={{borderLeft: '3px solid var(--accent-red)', paddingLeft: 18}}>
            <div className="tiny" style={{color:'var(--accent-red)', letterSpacing:'0.1em', marginBottom: 6}}>SELVYS · BANITE PRIESTESS</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontStyle:'italic', lineHeight: 1.3, color: 'var(--ink)'}}>
              "You. Mulmaster's little shadow. I told Lord Manshoon you would crawl back."
            </div>
            <div className="tiny" style={{marginTop: 10, fontStyle:'italic'}}>— eyes the rogue, raises pendant</div>
          </div>

          <hr className="rule dashed" />

          {/* Initiative — table-sized */}
          <div className="tiny" style={{marginBottom: 8}}>INITIATIVE</div>
          <div className="col" style={{gap: 6}}>
            {[
              {i:21, n:'Kaelith',     s:'acted'},
              {i:18, n:'Selvys',      s:'now',  hl:true},
              {i:15, n:'Doruk',       s:''},
              {i:14, n:'Enforcer A',  s:'bloodied'},
              {i:11, n:'Vessa',       s:''},
              {i: 9, n:'Enforcer B',  s:''},
            ].map(r => (
              <div key={r.n} style={{
                display:'grid', gridTemplateColumns: '60px 1fr auto',
                gap: 14, alignItems:'baseline',
                padding: '6px 12px',
                background: r.hl ? 'var(--ink)' : 'transparent',
                color: r.hl ? 'var(--paper)' : 'var(--ink)',
                fontFamily: 'var(--serif)',
                fontSize: 22,
                fontWeight: r.hl ? 600 : 400,
              }}>
                <span style={{fontFamily:'var(--mono)', fontWeight: 600}}>{r.i}</span>
                <span>{r.n}</span>
                <span className="tiny" style={{color: r.hl ? 'var(--paper-3)' : 'var(--ink-3)'}}>{r.s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side rail: party HP only — big bars */}
        <div>
          <div className="tiny" style={{marginBottom: 8}}>PARTY</div>
          <div className="col" style={{gap: 14}}>
            {[
              {n:'Kaelith', hp: 34, max: 52, col:'blue'},
              {n:'Doruk',   hp: 48, max: 58, col:'blue'},
              {n:'Vessa',   hp: 29, max: 41, col:'blue'},
              {n:'Aramil',  hp: 12, max: 64, col:'red'},
            ].map(p => (
              <div key={p.n}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight: 600}}>{p.n}</span>
                  <span style={{fontFamily:'var(--mono)', fontSize: 16}}>{p.hp}/{p.max}</span>
                </div>
                <div className={`bar ${p.col}`} style={{height: 14, marginTop: 4}}>
                  <span style={{width: `${(p.hp/p.max)*100}%`}} />
                </div>
              </div>
            ))}
          </div>

          <hr className="rule dashed" />

          <div className="tiny" style={{marginBottom: 8}}>SCENE</div>
          <div className="placeholder" style={{minHeight: 120, fontSize: 13}}>
            scene image · the vault interior
          </div>

          <div className="hand ink" style={{marginTop: 18, fontSize: 18, transform:'rotate(-1.5deg)'}}>
            big type, low chrome →<br/>readable from across the table
          </div>
        </div>
      </div>

      <div className="section-title">What's intentionally OFF the table screen</div>
      <div className="grid-3">
        <div className="box">
          <div className="box-title"><h3>Whispers</h3></div>
          <div className="muted" style={{fontSize: 13}}>private to the player's own device. Never on shared screen.</div>
        </div>
        <div className="box">
          <div className="box-title"><h3>Secret rolls</h3></div>
          <div className="muted" style={{fontSize: 13}}>DM laptop only. Result revealed by the DM, not the system.</div>
        </div>
        <div className="box">
          <div className="box-title"><h3>NPC stat blocks</h3></div>
          <div className="muted" style={{fontSize: 13}}>DM-only. The shared screen shows voice + visible state, not numbers.</div>
        </div>
      </div>
    </div>
  );
}

