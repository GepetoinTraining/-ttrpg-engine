// @ts-nocheck
'use client'

import React from 'react'
// surfaces/Modals.jsx — Modal & dialog primitives across the app.
// Each modal is staged on a dimmed paper surface so you can see what
// surface called it and which trigger fires it.

function ModalStage({tag, trigger, tall, children}) {
  return (
    <div className={`modal-stage ${tall ? 'tall' : ''}`}>
      <div className="modal-dim" />
      <span className="stage-tag">{tag}</span>
      {trigger && <span className="stage-trigger">↳ {trigger}</span>}
      <div style={{position:'relative', zIndex: 1, width:'100%', display:'flex', justifyContent:'center'}}>
        {children}
      </div>
    </div>
  );
}

function ModalShell({kind, title, variant, wide, narrow, children, foot, dismiss = '×'}) {
  return (
    <div className={`modal ${variant || ''} ${wide ? 'wide' : ''} ${narrow ? 'narrow' : ''}`}>
      <div className="modal-head">
        <div>
          <div className="kind">{kind}</div>
          <h4>{title}</h4>
        </div>
        <span className="x">{dismiss}</span>
      </div>
      <div className="modal-body">{children}</div>
      {foot && <div className="modal-foot">{foot}</div>}
    </div>
  );
}

function Radio({on, main, sub, color}) {
  return (
    <label className={on ? 'on' : ''}>
      <span className="radio" />
      <span>
        <span className="lbl-main">{color && <span className={`dot ${color}`} />}{main}</span>
        {sub && <span className="lbl-sub">{sub}</span>}
      </span>
    </label>
  );
}

export default function Modals() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">33 · UI Primitives</div>
          <h2>Modals &amp; Dialogs</h2>
        </div>
        <span className="who">paper popped over the table →</span>
      </div>

      <p style={{maxWidth: 760, color:'var(--ink-2)', marginTop: 0}}>
        Every modal is a <b>paper card</b> with a hard ink shadow, pinned over a dimmed
        surface. Headers carry a mono <span className="kbd">kind</span> tag (what called this), a serif title,
        and an ✕. Footers always have <i>cancel · primary action</i> right-aligned, with a
        mono <span className="kbd">where the work goes</span> note on the left.
      </p>

      <div className="row" style={{gap: 14, marginTop: 14, flexWrap:'wrap'}}>
        <span className="chip"><span className="dot" /> Neutral</span>
        <span className="chip red"><span className="dot red" /> Destructive / DM-only</span>
        <span className="chip blue"><span className="dot blue" /> Player-facing</span>
        <span className="chip gold"><span className="dot gold" /> Loot / commit / reveal</span>
        <span className="chip solid">AI co-pilot</span>
      </div>

      {/* ---------- SECTION: Confirmations ---------- */}
      <div className="section-title">Confirmations · destructive · commit</div>

      <div className="modal-grid">
        <ModalStage tag="04 · Campaign Cards" trigger="DM clicks ✕ on an arc card">
          <ModalShell kind="confirm · destructive" title="Delete arc “The Open Lord's Seal”?"
            variant="danger"
            foot={<>
              <span className="note">⌫ also unlinks 7 scenes · 12 rumors</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm danger">delete arc</button>
            </>}>
            <p>This arc has <b>7 scenes</b>, <b>3 active beats</b>, and <b>12 linked rumors</b>.
            Children stay but are <i>orphaned</i> — find them in <span className="kbd">filter: orphaned</span>.</p>
            <label style={{display:'flex', alignItems:'center', gap:6, marginTop: 8, fontSize: 13}}>
              <input type="checkbox" /> archive instead (recoverable for 30 days)
            </label>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="13 · Chargen" trigger="player clicks “commit character”">
          <ModalShell kind="commit · final" title="Commit Kaelith Vex?" variant="gold"
            foot={<>
              <span className="note">→ lands on Player Dashboard · DM gets ping</span>
              <span className="spacer" />
              <button className="btn sm">keep editing</button>
              <button className="btn sm primary">commit ↵</button>
            </>}>
            <p>Sheet locks after this. The DM can <b>unlock for retcon</b> at any time.</p>
            <div className="modal-list" style={{marginTop: 8}}>
              <div><span>Race · class</span><span className="k">Tiefling · Bard 5</span></div>
              <div><span>Stats</span><span className="k">15/14/13/12/10/8 +2/+1</span></div>
              <div><span>Spells prepared</span><span className="k">11 known · 8 prepared</span></div>
              <div><span>Lines · veils</span><span className="k">2 lines · 3 veils</span></div>
              <div><span>Hook to arc 01</span><span className="k">linked → Lady Mireska</span></div>
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="01 · Auth" trigger="DM clicks “re-seed cert”">
          <ModalShell kind="confirm · auth" title="Re-seed Kaelith's invite?" variant="danger" narrow
            foot={<>
              <span className="note">old cert revoked instantly</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm danger">re-seed</button>
            </>}>
            <p>The current browser cert will be <b>revoked</b>. Player will need the new invite link to get back in.</p>
            <div className="aside" style={{fontSize: 14, marginTop: 6}}>
              ↳ use this if a player lost their device or the wrong person enrolled.
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="32 · Attunement" trigger="player picks 4th item">
          <ModalShell kind="cap · 3 slots" title="Break attunement to free a slot?" variant="danger"
            foot={<>
              <span className="note">1hr ritual in fiction · instant in mech</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm danger">break &amp; attune new</button>
            </>}>
            <p>You're already attuned to <b>3 / 3</b>. Pick which to release:</p>
            <div className="radio-row">
              <Radio main="Cloak of Many Fashions" sub="cosmetic · low value · easy to swap back" color="blue" />
              <Radio main="Bag of Holding" sub="will dump contents to local space" color="gold" />
              <Radio on main="Driftglobe" sub="off the lockpick rotation 24h" color="blue" />
            </div>
          </ModalShell>
        </ModalStage>
      </div>

      {/* ---------- SECTION: Pickers ---------- */}
      <div className="section-title">Pickers · linkers · choosers</div>

      <div className="modal-grid">
        <ModalStage tag="18 · Scene editor" trigger="DM clicks “link rumor”">
          <ModalShell kind="picker · rumor → scene" title="Link a rumor to scene 04" wide
            foot={<>
              <span className="note">2 selected · scene becomes their reveal point</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm primary">link 2 ↵</button>
            </>}>
            <input type="text" placeholder="search rumors…" defaultValue="vault" />
            <div className="hint">7 match · filtered by tag <span className="kbd">vault</span></div>
            <div className="modal-list" style={{marginTop: 10, maxHeight: 200, overflow:'auto'}}>
              {[
                {t:'Selvys keeps a wax seal of the Open Lord', src:'Lady Mireska', cred:'confirmed', on:true},
                {t:'A second vault under the Yawning Portal', src:'tavern', cred:'likely', on:true},
                {t:'Banite priestess running the spice angle', src:'AI inference', cred:'unverified'},
                {t:'Manshoon scrying the team weekly', src:'downtime', cred:'speculative'},
                {t:'Vault rune shifts at moonset', src:'Vessa research', cred:'confirmed'},
              ].map((r,i) => (
                <div key={i}>
                  <span><input type="checkbox" defaultChecked={r.on} /> {r.t}</span>
                  <span className="k">{r.src} · <i>{r.cred}</i></span>
                </div>
              ))}
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="05 · Group" trigger="leader clicks “appoint successor”">
          <ModalShell kind="picker · single" title="Pass leadership token to…"
            foot={<>
              <span className="note">takes effect next session</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm primary">pass token →</button>
            </>}>
            <div className="radio-row">
              <Radio on main="Brann (Cleric · Light)" sub="last led 6 sessions ago · CHA 12" color="blue" />
              <Radio main="Vessa (Wizard · Divination)" sub="never led · INT 18 · scribes notes" color="blue" />
              <Radio main="Tomas (Fighter · Battle Master)" sub="led 2 sessions ago · CHA 14" color="blue" />
              <Radio main="rotate weekly · auto" sub="system picks · alphabetical" />
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="14 · Sheet" trigger="player drags item to “stash”">
          <ModalShell kind="picker · stash" title="Stash 3 items where?" narrow
            foot={<>
              <span className="note">non-local items take 1 downtime to retrieve</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm primary">stash here</button>
            </>}>
            <div className="radio-row">
              <Radio on main="Yawning Portal · room 12" sub="rented · 5gp/week · 2 already stashed" color="gold" />
              <Radio main="Lady Mireska's safehouse" sub="ally · trust 78 · capacity ∞" color="green" />
              <Radio main="Party wagon" sub="travels with you · risk: encounters" />
              <Radio main="Bag of Holding" sub="instant · weight 0 · dimensional risk" color="gold" />
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="25 · Spells" trigger="player long-presses cantrip slot">
          <ModalShell kind="grimoire · pick" title="Prepare spells · Bard 5" wide
            foot={<>
              <span className="note">8 / 8 prepared · long rest to change</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm primary">save preparation</button>
            </>}>
            <div className="row" style={{gap:6, marginBottom: 8}}>
              <span className="seg">
                <span className="on">all</span><span>cantrips</span><span>1</span><span>2</span><span>3</span>
              </span>
              <span className="spacer" style={{flex:1}} />
              <input type="text" placeholder="search…" style={{maxWidth: 160}} />
            </div>
            <div className="modal-list" style={{maxHeight: 220, overflow:'auto'}}>
              {[
                {n:'Vicious Mockery', l:'cantrip', on:true, sch:'enchantment'},
                {n:'Healing Word', l:'1', on:true, sch:'evocation'},
                {n:'Faerie Fire', l:'1', on:true, sch:'evocation'},
                {n:'Suggestion', l:'2', on:true, sch:'enchantment'},
                {n:'Heat Metal', l:'2', on:false, sch:'transmutation'},
                {n:'Hypnotic Pattern', l:'3', on:true, sch:'illusion'},
                {n:'Major Image', l:'3', on:false, sch:'illusion'},
              ].map((s,i) => (
                <div key={i}>
                  <span><input type="checkbox" defaultChecked={s.on} /> <b>{s.n}</b> <span className="muted">· {s.sch}</span></span>
                  <span className="k">L{s.l}</span>
                </div>
              ))}
            </div>
          </ModalShell>
        </ModalStage>
      </div>

      {/* ---------- SECTION: Forms ---------- */}
      <div className="section-title">Form modals · authoring · invite</div>

      <div className="modal-grid">
        <ModalStage tag="12 · Onboarding" trigger="DM clicks “＋ add seat”" tall>
          <ModalShell kind="form · invite" title="Invite a player" wide
            foot={<>
              <span className="note">link expires in 72h · single-use</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm">copy link</button>
              <button className="btn sm primary">send &amp; copy</button>
            </>}>
            <div className="grid-2" style={{gap: 10}}>
              <label className="field">
                <span>display name</span>
                <input type="text" defaultValue="Kaelith" />
              </label>
              <label className="field">
                <span>seat slot</span>
                <select defaultValue="3"><option>1</option><option>2</option><option>3</option><option>4 (empty)</option></select>
              </label>
            </div>
            <label className="field">
              <span>note · shown on join screen</span>
              <textarea defaultValue="Tiefling bard. Heist tone. Hook: Mireska owes you a favor." />
            </label>
            <hr />
            <div className="row" style={{gap: 14, fontSize: 13}}>
              <label><input type="checkbox" defaultChecked /> auto-create empty PC slot</label>
              <label><input type="checkbox" defaultChecked /> include lines/veils intake</label>
              <label><input type="checkbox" /> DM-pick race/class for me</label>
            </div>
            <div className="hint" style={{marginTop: 8}}>
              <span className="kbd">claudedm.app/sunset-vault?inv=4f9c…2e</span>
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="04 · Cards" trigger="DM clicks “＋ new faction”" tall>
          <ModalShell kind="form · authoring" title="New faction"
            foot={<>
              <span className="note">creates card + appears on Villain map</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm">save draft</button>
              <button className="btn sm primary">create →</button>
            </>}>
            <label className="field">
              <span>name</span>
              <input type="text" defaultValue="The Vellum Hand" />
            </label>
            <div className="grid-2" style={{gap: 10}}>
              <label className="field">
                <span>archetype</span>
                <select defaultValue="cabal"><option>cabal</option><option>guild</option><option>cult</option><option>noble house</option></select>
              </label>
              <label className="field">
                <span>scope</span>
                <select defaultValue="city"><option>local</option><option>city</option><option>region</option><option>realm</option></select>
              </label>
            </div>
            <label className="field">
              <span>one-line goal</span>
              <input type="text" defaultValue="control the spice trade north of the Sword Coast" />
            </label>
            <div className="hint">AI will draft 3 agents, 2 holdings, and 1 clock from these fields.</div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="22 · Calendar" trigger="DM clicks day cell">
          <ModalShell kind="form · event" title="New event · 12 Marpenoth, 1494 DR" narrow
            foot={<>
              <span className="note">visible to: DM only</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm primary">add</button>
            </>}>
            <label className="field">
              <span>label</span>
              <input type="text" defaultValue="Manshoon scries the party" />
            </label>
            <div className="grid-2" style={{gap: 10}}>
              <label className="field">
                <span>kind</span>
                <select defaultValue="villain"><option>villain tick</option><option>festival</option><option>weather</option><option>arc beat</option></select>
              </label>
              <label className="field">
                <span>visible to</span>
                <select defaultValue="dm"><option>DM only</option><option>party</option><option>specific PC</option></select>
              </label>
            </div>
            <label style={{display:'flex', alignItems:'center', gap:6, marginTop: 10, fontSize: 13}}>
              <input type="checkbox" /> recurring · every <input type="number" defaultValue="7" style={{width: 50, marginLeft: 4}} /> days
            </label>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="23 · .tp editor" trigger="κ audit fails on save">
          <ModalShell kind="diff · audit" title="κ audit · 3 invariants will break" wide variant="danger"
            foot={<>
              <span className="note">⚠ committing breaks 2 player sheets</span>
              <span className="spacer" />
              <button className="btn sm">back to editor</button>
              <button className="btn sm">force commit</button>
              <button className="btn sm primary">apply auto-fix</button>
            </>}>
            <p>This change to <span className="kbd">economy.spice.supply_shock</span> violates:</p>
            <div className="modal-list">
              <div><span>κ.market.bounded</span><span className="k">supply ∈ [-3, +3] — would be +5</span></div>
              <div><span>κ.rumor.referent</span><span className="k">3 rumors point to Selvys.alive</span></div>
              <div><span>κ.sheet.derived</span><span className="k">Vessa's downtime projection invalidated</span></div>
            </div>
            <div className="hint" style={{marginTop: 8}}>auto-fix: clamp to +3 · resolve rumors as <i>uncertain</i> · re-derive sheets</div>
          </ModalShell>
        </ModalStage>
      </div>

      {/* ---------- SECTION: AI / reveal / share ---------- */}
      <div className="section-title">AI co-pilot · reveal · share to table</div>

      <div className="modal-grid">
        <ModalStage tag="02 · DM Console" trigger="DM clicks “send to table”">
          <ModalShell kind="reveal · projector" title="Push to shared Table screen?" variant="gold"
            foot={<>
              <span className="note">stays up until DM dismisses</span>
              <span className="spacer" />
              <button className="btn sm">just to my console</button>
              <button className="btn sm primary">push to table →</button>
            </>}>
            <p>Show <b>“Vault rune flares — moonlight flickers across the chamber”</b> on the projected screen?</p>
            <div className="row" style={{gap: 14, marginTop: 8, fontSize: 13}}>
              <label><input type="checkbox" defaultChecked /> include AI's voiced line</label>
              <label><input type="checkbox" /> dramatic typewriter pace</label>
              <label><input type="checkbox" /> dim NPC stat block</label>
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="06 · Villain" trigger="DM clicks “simulate next tick”">
          <ModalShell kind="ai · simulate" title="Simulate Zhentarim · next tick" wide variant="dm"
            foot={<>
              <span className="note">async · runs without players</span>
              <span className="spacer" />
              <button className="btn sm">discard</button>
              <button className="btn sm">re-roll</button>
              <button className="btn sm primary">accept &amp; commit</button>
            </>}>
            <p style={{fontStyle:'italic', color:'var(--ink)'}}>
              "Selvys, alive, sends two enforcers to the Yawning Portal. They ask for the bard
              by name. Heat against the party in Waterdeep rises by 12."
            </p>
            <div className="modal-list" style={{marginTop: 8}}>
              <div><span>npc.selvys.status</span><span className="k">→ "regrouping"</span></div>
              <div><span>party.heat.zhent</span><span className="k">+12 (44 → 56)</span></div>
              <div><span>rumor.spawn</span><span className="k">"Zhent enforcers asking after a tiefling"</span></div>
              <div><span>clock.spice_lockdown</span><span className="k">3 / 6 → 4 / 6</span></div>
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="02 · DM Console" trigger="AI flags scene drift">
          <ModalShell kind="ai · flag" title="Tone drift detected"
            foot={<>
              <span className="note">your call · AI never overrides DM</span>
              <span className="spacer" />
              <button className="btn sm">dismiss</button>
              <button className="btn sm">soften next line</button>
              <button className="btn sm primary">show me options</button>
            </>}>
            <p>Last 3 NPC lines drifted from <b>heist-noir</b> toward <b>high-fantasy oratory</b>. Players set
            tone to "Ocean's 11 in robes" at session start.</p>
            <div className="aside" style={{marginTop: 6, fontSize: 14}}>
              ↳ flagged because Selvys called you "champion of the realms" — that's outside the
              tone envelope.
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="03 · Player" trigger="player whispers to AI">
          <ModalShell kind="whisper · private" title="Whisper to Claude" variant="player"
            foot={<>
              <span className="note">only you see this · DM never sees</span>
              <span className="spacer" />
              <button className="btn sm">cancel</button>
              <button className="btn sm primary">send <span className="kbd">↵</span></button>
            </>}>
            <label className="field">
              <span>your question</span>
              <textarea defaultValue="If I tip Mireska off about the seal, is she likely to tell the Lords' Alliance, or sit on it?" />
            </label>
            <div className="row" style={{gap: 6, marginTop: 8}}>
              <span className="chip blue">use her bond profile</span>
              <span className="chip">use Faerûn lore</span>
              <span className="chip">in-character only</span>
            </div>
            <div className="hint" style={{marginTop: 8}}>
              answers cost ⏱ 1 thinking-token · 3 / 5 left this session
            </div>
          </ModalShell>
        </ModalStage>
      </div>

      {/* ---------- SECTION: Inline / contextual ---------- */}
      <div className="section-title">Light-weight · toasts · sheets · context</div>

      <div className="modal-grid">
        <ModalStage tag="any" trigger="autosave">
          <ModalShell kind="toast · status" title="Saved · all good" narrow
            foot={<>
              <span className="note">dismisses in 3s</span>
              <span className="spacer" />
              <button className="btn sm">undo</button>
            </>}>
            <p style={{fontSize: 13, color:'var(--ink-3)'}}>3 cards updated · κ audit clean · pushed to engine.</p>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="15 · Combat" trigger="AI nudges DM mid-round">
          <ModalShell kind="hint · subtle" title="Brann at 0 HP · death save" variant="dm" narrow
            foot={<>
              <span className="note">priority: high · dismiss to silence</span>
              <span className="spacer" />
              <button className="btn sm">silence 1 round</button>
              <button className="btn sm primary">jump to Brann</button>
            </>}>
            <p>Failed 1 / 3 · Vessa is 1 turn out · Healing Word in range from Kaelith (bonus).</p>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="07 · Table" trigger="DM long-presses NPC">
          <ModalShell kind="context · bottom-sheet" title="Selvys Mariam" wide
            foot={<>
              <span className="note">bottom sheet · DM laptop only</span>
              <span className="spacer" />
              <button className="btn sm">push to table</button>
              <button className="btn sm">open full card</button>
              <button className="btn sm primary">voice in scene</button>
            </>}>
            <div className="grid-3" style={{gap: 10}}>
              <div className="modal-list">
                <div><span>AC · HP</span><span className="k">15 · 84/120</span></div>
                <div><span>condition</span><span className="k">none</span></div>
                <div><span>spell save</span><span className="k">DC 16</span></div>
              </div>
              <div className="modal-list">
                <div><span>knows party?</span><span className="k">Kaelith only</span></div>
                <div><span>bond w/ PC</span><span className="k">Vessa: rival 22</span></div>
                <div><span>last seen</span><span className="k">scene 03</span></div>
              </div>
              <div>
                <div className="tiny">VOICE</div>
                <div className="hand" style={{fontSize: 16, marginTop: 4}}>
                  clipped, transactional, drops volume when angry
                </div>
              </div>
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="20 · Markets" trigger="player rolls Persuasion to haggle">
          <ModalShell kind="result · pop-in" title="Haggle · 18 + 4 = 22 vs DC 17" variant="gold"
            foot={<>
              <span className="note">applied to current cart · undo possible 30s</span>
              <span className="spacer" />
              <button className="btn sm">undo</button>
              <button className="btn sm primary">close</button>
            </>}>
            <p><b>Success.</b> Vendor drops price by <b>15%</b> on healer's kits and rope.</p>
            <div className="modal-list" style={{marginTop: 8}}>
              <div><span>healer's kit ×3</span><span className="k">15g → 12.75g</span></div>
              <div><span>silk rope 50ft</span><span className="k">10g → 8.5g</span></div>
              <div><span>relationship</span><span className="k">+1 (mild)</span></div>
            </div>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="any" trigger="connection blip">
          <ModalShell kind="error · soft" title="Engine offline · 4s" variant="danger" narrow
            foot={<>
              <span className="note">your edits queued · will replay</span>
              <span className="spacer" />
              <button className="btn sm">retry now</button>
            </>}>
            <p style={{fontSize: 13}}>Last sync 11s ago. State frozen at <span className="kbd">v.491</span>.
            Players see the same paused state — you can keep narrating off-engine.</p>
          </ModalShell>
        </ModalStage>

        <ModalStage tag="29 · Companions" trigger="bond drops below 20">
          <ModalShell kind="alert · narrative" title="Mireska's bond cooling" variant="player" narrow
            foot={<>
              <span className="note">alerts again at 10 · -5 below = leaves</span>
              <span className="spacer" />
              <button className="btn sm">later</button>
              <button className="btn sm primary">spend downtime</button>
            </>}>
            <p>Three sessions of unanswered letters and a missed favor. Bond at <b>18 / 100</b>.</p>
            <div className="bar blue" style={{marginTop: 6}}><span style={{width:'18%'}} /></div>
            <div className="hint" style={{marginTop: 6}}>downtime: <i>"answer her letters"</i> auto-suggested</div>
          </ModalShell>
        </ModalStage>
      </div>

      {/* ---------- Anatomy ---------- */}
      <div className="section-title">Anatomy · what every modal carries</div>

      <div className="grid-2" style={{gap: 18}}>
        <div className="box">
          <div className="box-title"><h3>Required parts</h3><span className="meta">spec</span></div>
          <ol style={{margin:0, paddingLeft: 16, fontSize: 14, lineHeight: 1.7}}>
            <li><b>kind</b> tag (mono, uppercase) — what called this · who it's for</li>
            <li><b>title</b> in serif, &lt;= 6 words, action-oriented</li>
            <li><b>body</b> — short paragraph + at most one table/list/form</li>
            <li><b>footer</b> — left: where the work goes (mono note) · right: ✕ cancel + 1 primary action</li>
            <li><b>shadow color</b> — neutral · red (destructive) · blue (player) · gold (commit/loot)</li>
          </ol>
        </div>
        <div className="box">
          <div className="box-title"><h3>Rules of thumb</h3><span className="meta">don't</span></div>
          <ul style={{margin:0, paddingLeft: 16, fontSize: 14, lineHeight: 1.7}}>
            <li>No nested modals — open a second surface in the sidebar instead</li>
            <li>No more than <b>one primary button</b>. Secondary actions are <span className="kbd">btn sm</span> ghosts.</li>
            <li>Destructive primary always carries a <span className="kbd">btn danger</span>, never <span className="kbd">primary</span>.</li>
            <li>If the modal could become a side panel, prefer the side panel — modals only for <i>blocking</i> moments.</li>
            <li>Confirmations always show <b>downstream consequences</b> (orphaned children, broken invariants, etc.)</li>
          </ul>
        </div>
      </div>

      <hr className="rule" />

      <div className="aside" style={{maxWidth: 760}}>
        ↳ next: actual UI primitives still missing — <i>toasts &amp; banners, side sheets,
        empty states, inline errors, skeleton/loading states, command bar, tooltips</i>.
        ping me when you want those drafted.
      </div>
    </div>
  );
}

