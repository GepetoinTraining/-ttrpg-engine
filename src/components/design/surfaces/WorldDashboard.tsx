// @ts-nocheck
'use client'

/**
 * WorldDashboard — Slice 4 layout shell for the in-world experience.
 *
 * Layout (per Pedro's spec):
 *   ┌──────────────┬───────────────────────────────────────┬──────────────┐
 *   │              │                                       │              │
 *   │   sidebar    │       grid viewport (center)          │   drawers    │
 *   │  (character  │     (square voxel terrain)            │ (companions, │
 *   │   info,      │                                       │  quests,     │
 *   │   persona,   │                                       │  log,        │
 *   │   nav)       │                                       │  inventory)  │
 *   │              │                                       │              │
 *   ├──────────────┴───────────────────────────────────────┴──────────────┤
 *   │                       action bar (sticky bottom)                    │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * Wires:
 *   - `useWorld()` for engine-client + log poll
 *   - GridViewport for center pane
 *   - Click a tile → pop a "travel here" prompt → engineClient.transport()
 *   - Action chips → engineClient.applyIntent() → push
 */

import * as React from 'react'
import { useWorld } from '@/lib/use-world'
import GridViewport, { type TileViewItem } from '@/components/grid/GridViewport'
import { MAX_LEVEL, SCALE_LABELS, feetPerTile, type ScaleLevel } from '@/game/grid'
import { clearActiveCharacter } from '@/lib/character-cert'

const PERSONA_GLYPH: Record<string, string> = {
  player: '🛡',
  'gm-ai': '✦',
  dm: '◉',
  dmless: '∞',
}

type DrawerTab = 'companions' | 'quests' | 'log' | 'inventory' | 'party'

const DRAWER_TABS: { id: DrawerTab; label: string; meta: string }[] = [
  { id: 'companions', label: 'Party',     meta: 'D01' },
  { id: 'quests',     label: 'Quests',    meta: 'D02' },
  { id: 'log',        label: 'Log',       meta: 'D06' },
  { id: 'inventory',  label: 'Inventory', meta: 'D03' },
  { id: 'party',      label: 'Cert sync', meta: 'D09' },
]

// Stub data for drawers until each is fully bound
const COMPANIONS = [
  { id: 'k', name: 'Kaelith', role: 'wizard',  hp: 24, maxHp: 30, you: true },
  { id: 'b', name: 'Bren',    role: 'fighter', hp: 38, maxHp: 42 },
  { id: 'i', name: 'Iris',    role: 'rogue',   hp: 22, maxHp: 25 },
]

const QUESTS = [
  { id: 'q1', label: 'Retrieve mythril for Valk', src: 'Smithy', danger: 3, reward: 320 },
  { id: 'q2', label: 'Bounty: brigand chief Rake', src: "Adventurer's Guild", danger: 3, reward: 500 },
]

export default function WorldDashboard() {
  const worldApi = useWorld()
  const [centerX, setCenterX] = React.useState(0)
  const [centerY, setCenterY] = React.useState(0)
  const [level, setLevel] = React.useState<ScaleLevel>(0)
  const [selected, setSelected] = React.useState<TileViewItem | null>(null)
  const [drawer, setDrawer] = React.useState<DrawerTab>('companions')
  const [busy, setBusy] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)

  // Pan via WASD/arrows
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const step = 3
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setCenterY((y) => y - step); break
        case 'ArrowDown':
        case 's':
        case 'S':
          setCenterY((y) => y + step); break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setCenterX((x) => x - step); break
        case 'ArrowRight':
        case 'd':
        case 'D':
          setCenterX((x) => x + step); break
        case '+':
        case '=':
          setLevel((l) => (l > 0 ? ((l - 1) as ScaleLevel) : l)); break
        case '-':
        case '_':
          setLevel((l) => (l < MAX_LEVEL ? ((l + 1) as ScaleLevel) : l)); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleAction = React.useCallback(
    async (intent: string, params: Record<string, unknown> = {}) => {
      if (!worldApi.account || !worldApi.character) {
        setFeedback('no active character')
        setTimeout(() => setFeedback(null), 2400)
        return
      }
      setBusy(intent)
      try {
        worldApi.applyIntent(intent, params)
        await worldApi.push()
        setFeedback(`✓ ${intent} queued for next drain`)
      } catch (e: any) {
        setFeedback(`× ${e?.message ?? 'failed'}`)
      } finally {
        setBusy(null)
        setTimeout(() => setFeedback(null), 2400)
      }
    },
    [worldApi],
  )

  const handleSignOut = React.useCallback(async () => {
    await clearActiveCharacter()
    window.location.hash = 'character-select'
  }, [])

  // ── Loading / error states ──
  if (worldApi.loading) {
    return (
      <div style={{ padding: 24, color: 'var(--ink-2)' }}>
        … hydrating world state
      </div>
    )
  }

  if (!worldApi.account) {
    return (
      <div style={{ padding: 24 }}>
        <div className="surface-head">
          <div>
            <div className="crumbs">48 · World dashboard</div>
            <h2>No account</h2>
          </div>
        </div>
        <p className="aside" style={{ color: 'var(--ink-2)' }}>
          Mint an account first.{' '}
          <a onClick={() => (window.location.hash = 'auth')} style={{ cursor: 'pointer' }}>go to Auth →</a>
        </p>
      </div>
    )
  }

  if (!worldApi.character) {
    return (
      <div style={{ padding: 24 }}>
        <div className="surface-head">
          <div>
            <div className="crumbs">48 · World dashboard</div>
            <h2>No active character</h2>
          </div>
        </div>
        <p className="aside" style={{ color: 'var(--ink-2)' }}>
          Pick a character to log into the world.{' '}
          <a onClick={() => (window.location.hash = 'character-select')} style={{ cursor: 'pointer' }}>
            character select →
          </a>
        </p>
      </div>
    )
  }

  if (!worldApi.worldStatus) {
    return (
      <div style={{ padding: 24, color: 'var(--accent-red)' }}>
        world state unavailable: {worldApi.error}
      </div>
    )
  }

  const character = worldApi.character
  const persona = character.personaType
  const isDM = persona === 'dm' || persona === 'gm-ai'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 300px',
        gridTemplateRows: '1fr auto',
        gap: 12,
        height: 'calc(100vh - 60px)',
        minHeight: 600,
      }}
    >
      {/* ═══ LEFT RAIL — character + persona + nav ═══ */}
      <div
        className="col"
        style={{
          gap: 10,
          gridRow: '1 / 2',
          overflowY: 'auto',
        }}
      >
        <div className="box">
          <div className="box-title">
            <h3>Character</h3>
            <span className="meta">{PERSONA_GLYPH[persona]} {persona}</span>
          </div>
          <div className="tiny" style={{ marginTop: 6, fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
            id: {character.id.slice(0, 8)}…<br />
            ζ: {character.zeta.toFixed(6)}<br />
            owners: {character.ownerChain.length}<br />
            day: <b>{worldApi.worldStatus.worldDay}</b><br />
            at: <b>{worldApi.worldStatus.partyNodeLabel}</b>
          </div>
        </div>

        <div className="box dashed">
          <div className="box-title">
            <h3>Quick nav</h3>
            <span className="meta">surfaces</span>
          </div>
          <div className="col" style={{ gap: 4, marginTop: 6 }}>
            <button className="btn sm" onClick={() => (window.location.hash = 'sheet')}>📜 sheet</button>
            <button className="btn sm" onClick={() => (window.location.hash = 'combat')}>⚔ combat</button>
            <button className="btn sm" onClick={() => (window.location.hash = 'spells')}>✨ spells</button>
            <button className="btn sm" onClick={() => (window.location.hash = 'attunement')}>💎 attunement</button>
            <button className="btn sm" onClick={() => (window.location.hash = 'play')}>▶ play surface</button>
            <button className="btn sm" onClick={() => (window.location.hash = 'map')}>🗺 full map</button>
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>Account</h3>
            <span className="meta">{worldApi.account.id.slice(0, 6)}…</span>
          </div>
          <div className="col" style={{ gap: 4, marginTop: 6 }}>
            <button className="btn sm" onClick={() => (window.location.hash = 'character-select')}>
              switch character
            </button>
            <button className="btn sm" onClick={handleSignOut} style={{ color: 'var(--accent-red)' }}>
              log out (clear active)
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CENTER — grid viewport ═══ */}
      <div
        style={{
          gridRow: '1 / 2',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'hidden',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="crumbs">48 · World dashboard · {SCALE_LABELS[level]}</div>
            <h2 style={{ margin: '4px 0 0' }}>{worldApi.worldStatus.partyNodeLabel}</h2>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {([0, 1, 2, 3, 4, 5] as ScaleLevel[]).map((l) => (
              <button
                key={l}
                className={'btn sm' + (l === level ? ' primary' : '')}
                onClick={() => setLevel(l)}
                title={`${SCALE_LABELS[l]} (${feetPerTile(l)}ft/tile)`}
              >
                L{l}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--paper-2)',
            border: '1px solid var(--rule)',
            overflow: 'auto',
          }}
        >
          <GridViewport
            seed={worldApi.worldStatus.seed}
            centerX={centerX}
            centerY={centerY}
            level={level}
            radius={9}
            tilePx={28}
            showRoads
            showRivers
            showSettlements
            onTileClick={(t) => setSelected(t)}
            highlightTile={selected ? { x: selected.x, y: selected.y } : null}
            partyTiles={
              centerX === 0 && centerY === 0
                ? [{ x: 0, y: 0, label: worldApi.worldStatus.partyNodeLabel }]
                : []
            }
          />
        </div>

        {selected && (
          <div className="aside" style={{ padding: '6px 10px', fontSize: 12 }}>
            ↳ ({selected.x}, {selected.y}) · <b>{selected.label}</b> · elev {(selected.elevation * 100).toFixed(0)}% · move-cost {selected.moveCost === Infinity ? '∞' : selected.moveCost.toFixed(1)}
            {isDM && (
              <button
                className="btn sm"
                style={{ marginLeft: 8 }}
                onClick={() => handleAction('travel_to', { x: selected.x, y: selected.y, biome: selected.type })}
                disabled={busy !== null}
              >
                travel here →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ RIGHT RAIL — drawers ═══ */}
      <div
        className="col"
        style={{
          gap: 10,
          gridRow: '1 / 2',
          overflowY: 'auto',
        }}
      >
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {DRAWER_TABS.map((t) => (
            <button
              key={t.id}
              className={'btn sm' + (drawer === t.id ? ' primary' : '')}
              onClick={() => setDrawer(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {drawer === 'companions' && (
          <div className="box">
            <div className="box-title">
              <h3>Party</h3>
              <span className="meta">{COMPANIONS.length}</span>
            </div>
            <div className="col" style={{ gap: 6, marginTop: 8 }}>
              {COMPANIONS.map((c) => (
                <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: c.you ? 700 : 500, fontFamily: 'var(--serif)' }}>
                      {c.you && '› '}{c.name}
                    </div>
                    <div className="tiny muted">{c.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="bar gold" style={{ width: 64 }}>
                      <span style={{ width: `${(c.hp / c.maxHp) * 100}%` }} />
                    </div>
                    <div className="tiny">{c.hp}/{c.maxHp}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="tiny muted" style={{ marginTop: 8 }}>
              stub — bind to engine party state in Slice 6
            </div>
          </div>
        )}

        {drawer === 'quests' && (
          <div className="box">
            <div className="box-title">
              <h3>Quests</h3>
              <span className="meta">{QUESTS.length} active</span>
            </div>
            <div className="col" style={{ gap: 6, marginTop: 8 }}>
              {QUESTS.map((q) => (
                <div key={q.id} style={{ borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{q.label}</div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
                    <span className="tiny muted">{q.src}</span>
                    <span className="tiny">
                      <span className="chip sm gold">{q.reward}gp</span>{' '}
                      <span className="chip sm red">d{q.danger}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {drawer === 'log' && (
          <div className="box">
            <div className="box-title">
              <h3>Event log</h3>
              <span className="meta">{worldApi.log.length} recent</span>
            </div>
            <div className="col" style={{ gap: 4, marginTop: 8, maxHeight: 360, overflowY: 'auto' }}>
              {worldApi.log.length === 0 && (
                <p className="tiny muted">no events yet — push an action to populate</p>
              )}
              {worldApi.log.map((entry) => (
                <div key={entry.id} className="tiny" style={{ borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 3 }}>
                  <span className="chip sm" style={{ marginRight: 4 }}>{entry.action.type}</span>
                  <span className="muted">day {entry.worldDay}</span>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)', marginTop: 2 }}>
                    {entry.realTs ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {drawer === 'inventory' && (
          <div className="box">
            <div className="box-title">
              <h3>Inventory</h3>
              <span className="meta">stub</span>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Inventory drawer wires once the bag system lands. The `engine/inventory.ts`
              module is built but not yet bound to the cert flow.
            </p>
          </div>
        )}

        {drawer === 'party' && (
          <div className="box">
            <div className="box-title">
              <h3>Cert sync</h3>
              <span className="meta">peer-to-peer</span>
            </div>
            <p className="tiny" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Your character cert hash:
              <br />
              <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{character.id}</code>
            </p>
            <button
              className="btn sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                navigator.clipboard?.writeText(`claudedm-party:${character.id}`)
                setFeedback('✓ invite link copied')
                setTimeout(() => setFeedback(null), 2000)
              }}
            >
              copy invite link
            </button>
            <div className="tiny muted" style={{ marginTop: 8 }}>
              Slice 6 trade + party UI lands modals M04-M11 over this drawer.
            </div>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM — action bar ═══ */}
      <div
        style={{
          gridRow: '2 / 3',
          gridColumn: '1 / 4',
          background: 'var(--paper)',
          borderTop: '2px solid var(--rule)',
          padding: '10px 14px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span className="tiny muted">ACTIONS:</span>
        {/* Common */}
        <button className="btn sm" onClick={() => handleAction('talk')}                disabled={busy !== null}>✦ talk</button>
        <button className="btn sm" onClick={() => handleAction('examine')}             disabled={busy !== null}>↳ examine</button>
        <button className="btn sm" onClick={() => handleAction('rest_short')}          disabled={busy !== null}>🛏 rest</button>
        <button className="btn sm" onClick={() => handleAction('roll_d20')}            disabled={busy !== null}>🎲 d20</button>
        {/* Slow-life */}
        <span className="tiny muted" style={{ marginLeft: 12 }}>slow-life:</span>
        <button className="btn sm" onClick={() => handleAction('study_material')}      disabled={busy !== null}>study</button>
        <button className="btn sm" onClick={() => handleAction('tend_herd')}           disabled={busy !== null}>tend</button>
        <button className="btn sm" onClick={() => handleAction('plant_crops')}         disabled={busy !== null}>plant</button>
        <button className="btn sm" onClick={() => handleAction('sell_item')}           disabled={busy !== null}>sell</button>
        {/* DM-only */}
        {isDM && (
          <>
            <span className="tiny" style={{ marginLeft: 12, color: 'var(--accent-red)' }}>DM:</span>
            <button className="btn sm" onClick={() => handleAction('force_scene')}       disabled={busy !== null}>scene change</button>
            <button className="btn sm" onClick={() => handleAction('inject_npc')}        disabled={busy !== null}>inject NPC</button>
            <button className="btn sm" onClick={() => handleAction('random_encounter')}  disabled={busy !== null}>encounter</button>
          </>
        )}

        {/* Right-aligned status */}
        <div style={{ flex: 1 }} />
        {worldApi.pendingCount > 0 && (
          <span className="chip blue">{worldApi.pendingCount} pending</span>
        )}
        <button
          className="btn sm primary"
          disabled={worldApi.pendingCount === 0 || busy !== null}
          onClick={() => worldApi.push()}
        >
          push slot
        </button>
        {feedback && (
          <span className="tiny" style={{ color: feedback.startsWith('✓') ? 'var(--accent-green)' : feedback.startsWith('×') ? 'var(--accent-red)' : 'var(--ink-2)' }}>
            {feedback}
          </span>
        )}
        <span className="tiny muted">
          day <b>{worldApi.worldStatus.worldDay}</b> · ζ {character.zeta.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
