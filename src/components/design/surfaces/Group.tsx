// @ts-nocheck
'use client'

// surfaces/Group.jsx — Group / Party screen

export default function Group() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">05 · Shared · Party</div>
          <h2>The Lantern Compact</h2>
        </div>
        <span className="who">group view · all 4 see this</span>
      </div>

      <div className="aside" style={{marginBottom: 24, maxWidth: 720}}>
        ⚠ this is the screen we flagged as the hardest piece. lo-fi here is
        intentional — three concepts to react to, not a final layout.
      </div>

      {/* Leadership + voting */}
      <div className="grid-2" style={{marginBottom: 22}}>
        <div className="box">
          <div className="box-title"><h3>Leader</h3><span className="meta">rotates · arc</span></div>
          <div className="row" style={{alignItems:'center', gap: 14}}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: '2px solid var(--accent-gold)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600,
              background: 'var(--paper-2)'
            }}>D</div>
            <div>
              <div style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight: 600}}>Doruk</div>
              <div className="tiny">since Eleasis 14 · Arc 02</div>
              <div className="row" style={{gap: 6, marginTop: 6}}>
                <button className="btn sm">propose new leader</button>
                <button className="btn sm">step down</button>
              </div>
            </div>
          </div>
          <hr className="rule dashed" />
          <div className="tiny" style={{marginBottom: 4}}>LEADER POWERS</div>
          <ul style={{margin:0, paddingLeft: 16, fontSize: 13}}>
            <li>Spends from party purse without vote (under 50gp)</li>
            <li>Tie-breaker on votes</li>
            <li>Speaks for party in formal settings</li>
          </ul>
        </div>

        <div className="box">
          <div className="box-title"><h3>Open vote</h3><span className="meta">closes in 6 hrs</span></div>
          <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600}}>
            Spend 600gp to bribe Lord Manshoon's archivist?
          </div>
          <div className="muted" style={{fontSize: 13, marginTop: 4}}>
            Proposed by <b>Kaelith</b> · would get us the priestess's full dossier before the next session.
          </div>
          <div className="col" style={{gap: 8, marginTop: 12}}>
            <div>
              <div className="row" style={{justifyContent:'space-between', fontSize: 13}}>
                <span>👍 in favor · <b>Kaelith</b>, <b>Doruk</b></span>
                <span className="stat">2/4</span>
              </div>
              <div className="bar green"><span style={{width: '50%'}} /></div>
            </div>
            <div>
              <div className="row" style={{justifyContent:'space-between', fontSize: 13}}>
                <span>👎 against · <b>Vessa</b></span>
                <span className="stat">1/4</span>
              </div>
              <div className="bar red"><span style={{width: '25%'}} /></div>
            </div>
            <div>
              <div className="row" style={{justifyContent:'space-between', fontSize: 13}}>
                <span>· abstain · <b>Aramil</b></span>
                <span className="stat">1/4</span>
              </div>
              <div className="bar"><span style={{width: '25%', background:'var(--ink-4)'}} /></div>
            </div>
          </div>
          <div className="row" style={{gap: 6, marginTop: 12}}>
            <button className="btn sm">cast vote</button>
            <button className="btn sm">comment</button>
            <button className="btn sm danger">withdraw</button>
          </div>
        </div>
      </div>

      {/* Shared resources */}
      <div className="grid-3">
        <div className="box">
          <div className="box-title"><h3>Party purse</h3><span className="meta">tracked</span></div>
          <div style={{fontFamily:'var(--mono)', fontSize: 22, marginBottom: 8}}>
            <b>4,287</b> gp · <span className="muted">114 sp · 230 cp</span>
          </div>
          <div className="bar gold"><span style={{width: '52%'}} /></div>
          <div className="tiny" style={{marginTop: 6}}>52% of session-start float</div>
          <hr className="rule dashed" />
          <div className="col" style={{gap: 4, fontSize: 13}}>
            <div className="row" style={{justifyContent:'space-between'}}><span>+1,200</span><span className="muted">vault haul · pending</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>−180</span><span className="muted">Doruk · supplies (under 50: ok ×4)</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>−600</span><span className="muted">archivist bribe (vote pending)</span></div>
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Party loot</h3><span className="meta">unclaimed</span></div>
          <table className="inv">
            <tbody>
              <tr><td><b>Wand of Magic Missile</b><div className="tiny">5 charges · arcane · vault</div></td><td className="stat" style={{textAlign:'right'}}><span className="chip blue sm">claim</span></td></tr>
              <tr><td><b>Banite holy symbol</b><div className="tiny">evidence · do not wear</div></td><td className="stat" style={{textAlign:'right'}}><span className="chip sm">hold</span></td></tr>
              <tr><td><b>3× silver bars</b><div className="tiny">~75gp ea · split?</div></td><td className="stat" style={{textAlign:'right'}}><span className="chip gold sm">split</span></td></tr>
              <tr><td><b>Priestess's letters</b><div className="tiny">to Manshoon · sealed</div></td><td className="stat" style={{textAlign:'right'}}><span className="chip red sm">DM hold</span></td></tr>
            </tbody>
          </table>
        </div>

        <div className="box">
          <div className="box-title"><h3>Downtime</h3><span className="meta">between sessions</span></div>
          <div className="col" style={{gap: 6, fontSize: 13}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <span><b>Kaelith</b> <span className="muted">forging signet</span></span>
              <span className="stat">2/2 days</span>
            </div>
            <div className="bar"><span style={{width: '100%'}} /></div>
            <div className="row" style={{justifyContent:'space-between', marginTop:6}}>
              <span><b>Doruk</b> <span className="muted">temple service</span></span>
              <span className="stat">3/4 days</span>
            </div>
            <div className="bar"><span style={{width: '75%'}} /></div>
            <div className="row" style={{justifyContent:'space-between', marginTop:6}}>
              <span><b>Vessa</b> <span className="muted">scribing scrolls</span></span>
              <span className="stat">1/3 days</span>
            </div>
            <div className="bar"><span style={{width: '33%'}} /></div>
            <div className="row" style={{justifyContent:'space-between', marginTop:6}}>
              <span><b>Aramil</b> <span className="muted">— idle</span></span>
              <span className="chip sm">assign</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Session intentions · what we're trying to do this session</div>
      <div className="grid-3">
        <div className="box filled">
          <div className="box-title"><h3>Take the priestess alive</h3><span className="meta">primary</span></div>
          <div className="tiny" style={{marginBottom: 6}}>proposed by Kaelith · all agreed</div>
          <p style={{margin: 0, fontSize: 14}}>She knows Manshoon's Waterdeep network. Worth a real prisoner.</p>
        </div>
        <div className="box filled">
          <div className="box-title"><h3>Don't burn the vault</h3><span className="meta">secondary</span></div>
          <div className="tiny" style={{marginBottom: 6}}>proposed by Doruk · all agreed</div>
          <p style={{margin: 0, fontSize: 14}}>Loot is bonus. Records are the point. Fire is forbidden.</p>
        </div>
        <div className="box dashed">
          <div className="muted" style={{fontSize: 13}}>＋ propose intention</div>
          <div className="tiny" style={{marginTop: 4}}>becomes group goal if 3/4 agree</div>
        </div>
      </div>
    </div>
  );
}

