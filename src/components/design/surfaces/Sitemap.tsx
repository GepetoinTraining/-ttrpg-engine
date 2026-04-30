'use client'

// Surfaces/Sitemap — Information architecture overview

export default function Sitemap() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">00 · System Overview</div>
          <h2>Information Architecture</h2>
        </div>
        <span className="who">who sees what →</span>
      </div>

      <p style={{ maxWidth: 720, color: 'var(--ink-2)', marginTop: 0 }}>
        The system has <b>four roles</b> (DM, Player, Group, AI co-pilot) and one shared
        <i> Table Screen</i> projected during in-person play. Below is the surface map and
        which roles can reach each one.
      </p>

      <div className="row" style={{ gap: 14, marginTop: 18 }}>
        <span className="chip">
          <span className="dot" /> Everyone
        </span>
        <span className="chip red">
          <span className="dot red" /> DM only
        </span>
        <span className="chip blue">
          <span className="dot blue" /> Player
        </span>
        <span className="chip gold">
          <span className="dot gold" /> Group / shared
        </span>
        <span className="chip solid">AI co-pilot</span>
      </div>

      <div className="sitemap" style={{ marginTop: 18 }}>
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <marker
              id="arr"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#1f1b16" />
            </marker>
          </defs>
          <path
            d="M 230,90 C 320,90 320,90 380,90"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            markerEnd="url(#arr)"
          />
          <path
            d="M 470,140 C 470,220 470,220 470,290"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            strokeDasharray="3 3"
            markerEnd="url(#arr)"
          />
          <path
            d="M 130,150 C 130,220 130,220 130,290"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            markerEnd="url(#arr)"
          />
          <path
            d="M 130,360 C 130,420 130,420 130,460"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            markerEnd="url(#arr)"
          />
          <path
            d="M 580,330 C 660,330 660,330 720,330"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            markerEnd="url(#arr)"
          />
          <path
            d="M 810,400 C 810,470 810,470 810,520"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            strokeDasharray="3 3"
            markerEnd="url(#arr)"
          />
          <path
            d="M 200,460 C 400,490 600,510 740,540"
            stroke="#1f1b16"
            strokeWidth="1"
            fill="none"
            strokeDasharray="3 3"
            markerEnd="url(#arr)"
          />
        </svg>

        <div className="sm-node dm" style={{ top: 50, left: 30 }}>
          <h4>DM Console</h4>
          <div className="tiny">02 · Session HQ</div>
          <ul>
            <li>Initiative + state</li>
            <li>Scene control</li>
            <li>Logs (tabbed)</li>
          </ul>
        </div>

        <div className="sm-node ai" style={{ top: 50, left: 380 }}>
          <h4>AI Co-pilot</h4>
          <div className="tiny" style={{ color: 'var(--paper-3)' }}>
            3 views · always-on
          </div>
          <ul>
            <li>Orchestrator</li>
            <li>NPC voicebox</li>
            <li>Whisper Q&amp;A</li>
          </ul>
        </div>

        <div className="sm-node" style={{ top: 290, left: 30 }}>
          <h4>Campaign Cards</h4>
          <div className="tiny">04 · Authoring</div>
          <ul>
            <li>Arcs · Locations · Factions</li>
          </ul>
        </div>

        <div className="sm-node dm" style={{ top: 460, left: 30 }}>
          <h4>Villain Org</h4>
          <div className="tiny">06 · CTF map</div>
          <ul>
            <li>Influence over Faerûn</li>
            <li>Clocks + agents</li>
          </ul>
        </div>

        <div className="sm-node player" style={{ top: 290, left: 380 }}>
          <h4>Player Dashboard</h4>
          <div className="tiny">03 · One per PC</div>
          <ul>
            <li>Inventory (local / non-local)</li>
            <li>Ally NPCs</li>
            <li>Pre-planned actions</li>
          </ul>
        </div>

        <div className="sm-node shared" style={{ top: 290, left: 720 }}>
          <h4>Group / Party</h4>
          <div className="tiny">05 · Shared</div>
          <ul>
            <li>Leader / votes</li>
            <li>Party loot &amp; coin</li>
            <li>Downtime</li>
          </ul>
        </div>

        <div className="sm-node" style={{ top: 480, left: 720 }}>
          <h4>Table Screen</h4>
          <div className="tiny">07 · Projected</div>
          <ul>
            <li>Initiative · scene · NPC voice</li>
            <li>Map (read-only)</li>
          </ul>
        </div>

        <div
          className="hand"
          style={{
            position: 'absolute',
            top: 25,
            left: 245,
            transform: 'rotate(-3deg)',
          }}
        >
          DM ←→ AI is the
          <br />
          main loop
        </div>
        <div
          className="hand blue"
          style={{
            position: 'absolute',
            top: 230,
            left: 360,
            transform: 'rotate(2deg)',
          }}
        >
          whispers go direct
          <br />
          to one player
        </div>
        <div
          className="hand ink"
          style={{
            position: 'absolute',
            top: 470,
            left: 460,
            transform: 'rotate(-1.5deg)',
          }}
        >
          everything funnels into
          <br />
          the shared table view ↘
        </div>
      </div>

      <div className="section-title">Role responsibilities at a glance</div>
      <div className="grid-4">
        <div className="box">
          <div className="box-title">
            <h3>DM</h3>
            <span className="meta">orchestrator</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            <li>Sets scenes, controls pace</li>
            <li>Authors campaign cards</li>
            <li>Runs villain org between sessions</li>
            <li>Approves AI suggestions</li>
          </ul>
        </div>
        <div className="box">
          <div className="box-title">
            <h3>Player</h3>
            <span className="meta">×4–6</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            <li>Inventory: local / stash / ally</li>
            <li>Pre-plan actions before session</li>
            <li>Talk to absent NPC allies (async)</li>
            <li>Whisper to AI privately</li>
          </ul>
        </div>
        <div className="box">
          <div className="box-title">
            <h3>Group</h3>
            <span className="meta">collective</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            <li>Appoint leader / rotate</li>
            <li>Vote on shared resources</li>
            <li>Track party loot &amp; downtime</li>
            <li>Set session intentions</li>
          </ul>
        </div>
        <div className="box dark">
          <div className="box-title">
            <h3 style={{ color: 'var(--paper)' }}>AI</h3>
            <span className="meta" style={{ color: 'var(--paper-3)' }}>
              always-on
            </span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 16,
              fontSize: 13,
              color: 'var(--paper-2)',
            }}
          >
            <li>Voices NPCs in dialogue</li>
            <li>Improvises scenes for DM</li>
            <li>Summarizes &amp; updates state</li>
            <li>Whispers to individuals</li>
            <li>Ticks villain clocks async</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
