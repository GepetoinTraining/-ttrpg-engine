'use client'

import React from 'react'
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakToggle,
  TweakButton,
} from './TweaksPanel'
import { SessionProvider, useSession } from '@/lib/session-context'
import { useViewConfig } from '@/lib/view-config'
import { usePersona, personaKey, PERSONA_LABELS, PERSONA_GLYPHS, type Persona, type PersonaType } from '@/lib/persona'
import ConfigMenu from './ConfigMenu'
import { loadAccount, type AccountCert } from '@/lib/account-cert'
import { getActiveCharacterCert, type CharacterCert } from '@/lib/character-cert'

import Sitemap from './surfaces/Sitemap'
import Auth from './surfaces/Auth'
import DMConsole from './surfaces/DMConsole'
import Player from './surfaces/Player'
import Cards from './surfaces/Cards'
import Group from './surfaces/Group'
import Villain from './surfaces/Villain'
import Table from './surfaces/Table'
import Locations from './surfaces/Locations'
import Rumors from './surfaces/Rumors'
import Oneshot from './surfaces/Oneshot'
import { InlineCardsDemo } from './surfaces/InlineCards'
import Onboarding from './surfaces/Onboarding'
import Chargen from './surfaces/Chargen'
import Sheet from './surfaces/Sheet'
import Combat from './surfaces/Combat'
import Settlement from './surfaces/Settlement'
import Roster from './surfaces/Roster'
import SceneEditor from './surfaces/SceneEditor'
import Recap from './surfaces/Recap'
import Markets from './surfaces/Markets'
import Reputation from './surfaces/Reputation'
import Calendar from './surfaces/Calendar'
import TPEditor from './surfaces/TPEditor'
import Lore from './surfaces/Lore'
import Spells from './surfaces/Spells'
import Studies from './surfaces/Studies'
import Tactical from './surfaces/Tactical'
import Dungeon from './surfaces/Dungeon'
import Weather from './surfaces/Weather'
import Quests from './surfaces/Quests'
import Companions from './surfaces/Companions'
import Diplomacy from './surfaces/Diplomacy'
import Warfare from './surfaces/Warfare'
import Attunement from './surfaces/Attunement'
import Modals from './surfaces/Modals'
import Sprites from './surfaces/Sprites'
import Guild from './surfaces/Guild'
import Gate from './surfaces/Gate'
import MonsterCamp from './surfaces/MonsterCamp'
import Ecology from './surfaces/Ecology'
import Bestiary from './surfaces/Bestiary'
import Farms from './surfaces/Farms'
import Herds from './surfaces/Herds'
import Deposits from './surfaces/Deposits'
import Materials from './surfaces/Materials'
import Actions from './surfaces/Actions'
import Play from './surfaces/Play'
import CharacterSelect from './surfaces/CharacterSelect'
import Map from './surfaces/Map'
import WorldDashboard from './surfaces/WorldDashboard'

const TWEAK_DEFAULTS = {
  role: 'dm',
  density: 'regular',
  showAside: true,
}

type SurfaceComp = React.ComponentType

const SURFACES: { id: string; num: string; label: string; Comp: SurfaceComp }[] = [
  { id: 'sitemap', num: '00', label: 'System overview', Comp: Sitemap },
  { id: 'auth', num: '01', label: 'Auth · cert', Comp: Auth },
  { id: 'dm', num: '02', label: 'DM Console', Comp: DMConsole },
  { id: 'player', num: '03', label: 'Player Dashboard', Comp: Player },
  { id: 'cards', num: '04', label: 'Campaign Cards', Comp: Cards },
  { id: 'group', num: '05', label: 'Group · Party', Comp: Group },
  { id: 'villain', num: '06', label: 'Villain · Faerûn', Comp: Villain },
  { id: 'table', num: '07', label: 'Table Screen', Comp: Table },
  { id: 'locations', num: '08', label: 'Holdings · Downtime', Comp: Locations },
  { id: 'rumors', num: '09', label: 'Rumors', Comp: Rumors },
  { id: 'oneshot', num: '10', label: 'Solo with Claude', Comp: Oneshot },
  { id: 'cards-demo', num: '11', label: 'Inline chat cards', Comp: InlineCardsDemo },
  { id: 'onboarding', num: '12', label: 'Onboarding', Comp: Onboarding },
  { id: 'chargen', num: '13', label: 'Character creation', Comp: Chargen },
  { id: 'sheet', num: '14', label: 'Character sheet', Comp: Sheet },
  { id: 'combat', num: '15', label: 'Combat runner', Comp: Combat },
  { id: 'settlement', num: '16', label: 'Settlement (non-owned)', Comp: Settlement },
  { id: 'roster', num: '17', label: 'NPC Roster', Comp: Roster },
  { id: 'scene', num: '18', label: 'Scene Card editor', Comp: SceneEditor },
  { id: 'recap', num: '19', label: 'Session Recap · TPB', Comp: Recap },
  { id: 'markets', num: '20', label: 'Markets · economy', Comp: Markets },
  { id: 'reputation', num: '21', label: 'Reputation matrix', Comp: Reputation },
  { id: 'calendar', num: '22', label: 'World calendar', Comp: Calendar },
  { id: 'tp', num: '23', label: '.tp editor · κ audit', Comp: TPEditor },
  { id: 'lore', num: '24', label: 'Lore · world firsts', Comp: Lore },
  { id: 'spells', num: '25', label: 'Spell prep · casting', Comp: Spells },
  { id: 'dungeon', num: '26', label: 'Dungeon runner', Comp: Dungeon },
  { id: 'weather', num: '27', label: 'Weather · seasons', Comp: Weather },
  { id: 'quests', num: '28', label: 'Quests · beat tracker', Comp: Quests },
  { id: 'companions', num: '29', label: 'Companions · mounts', Comp: Companions },
  { id: 'diplomacy', num: '30', label: 'Diplomacy · briefings', Comp: Diplomacy },
  { id: 'warfare', num: '31', label: 'Warfare · armies', Comp: Warfare },
  { id: 'attunement', num: '32', label: 'Attunement · 3 slots', Comp: Attunement },
  { id: 'modals', num: '33', label: 'Modals & dialogs', Comp: Modals },
  { id: 'sprites', num: '34', label: 'Map sprite library', Comp: Sprites },
  { id: 'guild', num: '35', label: "Adventurer's Guild", Comp: Guild },
  { id: 'gate', num: '36', label: 'Dungeon gate', Comp: Gate },
  { id: 'camp', num: '37', label: 'Monster camp', Comp: MonsterCamp },
  { id: 'ecology', num: '38', label: 'Ecology · region', Comp: Ecology },
  { id: 'bestiary', num: '39', label: 'Bestiary · sprites', Comp: Bestiary },
  { id: 'farms', num: '40', label: 'Farms · plots', Comp: Farms },
  { id: 'herds', num: '41', label: 'Herds', Comp: Herds },
  { id: 'deposits', num: '42', label: 'Deposits', Comp: Deposits },
  { id: 'materials', num: '43', label: 'Material knowledge', Comp: Materials },
  { id: 'actions', num: '44', label: 'Actions · intents', Comp: Actions },
  { id: 'play', num: '45', label: 'Play · live world', Comp: Play },
  { id: 'character-select', num: '46', label: 'Character select', Comp: CharacterSelect },
  { id: 'map', num: '47', label: 'Map · square voxel grid', Comp: Map },
  { id: 'world', num: '48', label: 'World · live dashboard', Comp: WorldDashboard },
  { id: 'studies', num: '49', label: 'Studies · research', Comp: Studies },
  { id: 'tactical', num: '50', label: 'Tactical · DM combat canvas', Comp: Tactical },
]

// Surfaces visitable without a verified cert. Everything else gates to #auth.
const PUBLIC_SURFACES = new Set(['auth', 'sitemap'])

// ============================================================
// WORKSPACES — top-level role-driven groupings of surfaces
// ============================================================

type WorkspaceId = 'home' | 'player' | 'dm' | 'table'

interface CategoryDef {
  label: string
  surfaceIds: string[]
}

interface WorkspaceDef {
  id: WorkspaceId
  label: string
  glyph: string
  /** Default surface to show when this workspace is opened */
  landingSurfaceId: string
  /** Categories with their surface members */
  categories: CategoryDef[]
}

const WORKSPACES: WorkspaceDef[] = [
  {
    id: 'home',
    label: 'Home',
    glyph: '⌂',
    landingSurfaceId: 'sitemap',
    categories: [
      { label: 'System', surfaceIds: ['sitemap', 'auth', 'onboarding'] },
    ],
  },
  {
    id: 'player',
    label: 'Player',
    glyph: '⚔',
    landingSurfaceId: 'play',
    categories: [
      { label: 'Live world', surfaceIds: ['play', 'combat', 'cards', 'cards-demo'] },
      { label: 'Character', surfaceIds: ['player', 'sheet', 'spells', 'attunement', 'companions', 'chargen'] },
      { label: 'Slow life', surfaceIds: ['actions', 'studies', 'farms', 'herds', 'deposits', 'materials'] },
      { label: 'Field guide', surfaceIds: ['bestiary', 'lore', 'rumors'] },
    ],
  },
  {
    id: 'dm',
    label: 'DM',
    glyph: '◆',
    landingSurfaceId: 'dm',
    categories: [
      { label: 'Console', surfaceIds: ['dm', 'play', 'tactical', 'recap'] },
      { label: 'World', surfaceIds: ['settlement', 'calendar', 'weather', 'locations', 'tp'] },
      { label: 'People', surfaceIds: ['roster', 'villain'] },
      { label: 'Factions', surfaceIds: ['diplomacy', 'reputation', 'warfare'] },
      { label: 'Story', surfaceIds: ['quests', 'scene', 'lore', 'rumors'] },
      { label: 'Economy', surfaceIds: ['markets'] },
      { label: 'Engine', surfaceIds: ['guild', 'gate', 'camp', 'ecology', 'bestiary', 'sprites', 'modals'] },
    ],
  },
  {
    id: 'table',
    label: 'Table',
    glyph: '☷',
    landingSurfaceId: 'play',
    categories: [
      { label: 'Live play', surfaceIds: ['play', 'table', 'group', 'combat', 'dungeon', 'cards', 'oneshot', 'recap'] },
    ],
  },
]

// Reverse index: surface id → workspace + category. First match wins (a surface
// like 'lore' appears in both Player>Field guide and DM>Story; we want hash-nav
// to land in whichever workspace currently matches the role).
function findWorkspaceForSurface(surfaceId: string, preferred: WorkspaceId): WorkspaceDef {
  // Prefer current workspace if it owns this surface
  const pref = WORKSPACES.find((w) => w.id === preferred)
  if (pref?.categories.some((c) => c.surfaceIds.includes(surfaceId))) return pref
  // Otherwise the first workspace that owns it
  const owner = WORKSPACES.find((w) =>
    w.categories.some((c) => c.surfaceIds.includes(surfaceId)),
  )
  return owner ?? WORKSPACES[0]
}

// Persona type → workspace landing
const PERSONA_TO_WORKSPACE: Record<PersonaType, WorkspaceId> = {
  dm:       'dm',
  player:   'player',
  'gm-ai':  'table',
  dmless:   'table',
}

export default function DMHelperApp() {
  return (
    <SessionProvider>
      <DMHelperShell />
    </SessionProvider>
  )
}

function DMHelperShell() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [active, setActive] = React.useState<string>('sitemap')
  // Workspace can be set explicitly (clicking a workspace tab); otherwise it's
  // derived from the current surface's owning workspace.
  const [workspaceOverride, setWorkspaceOverride] = React.useState<WorkspaceId | null>(null)
  const [configOpen, setConfigOpen] = React.useState(false)
  const session = useSession()

  // Persona — the role + character lens this cert is playing as. Drives both
  // the active workspace AND the view-config owner key.
  const certId = session.cert?.id ?? null
  const [persona, setPersona] = usePersona(certId)

  // Active character cert (IDB) is the source of truth for personaType — it's
  // FIXED at chargen and survives the legacy localStorage persona default. An
  // invited player who never opens ConfigMenu would otherwise inherit the
  // hardcoded `{ type: 'dm' }` default and land in the DM workspace.
  const [activeCharCert, setActiveCharCert] = React.useState<CharacterCert | null>(null)
  React.useEffect(() => {
    let cancelled = false
    const refresh = () => {
      getActiveCharacterCert()
        .then((c) => { if (!cancelled) setActiveCharCert(c) })
        .catch(() => {})
    }
    refresh()
    // setActiveCharacter writes to IDB then nav changes the hash; re-read
    // on hashchange to pick up the new active cert immediately.
    window.addEventListener('hashchange', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', refresh)
    }
  }, [])

  const effectivePersonaType: PersonaType = activeCharCert?.personaType ?? persona.type

  // View config keyed by persona — same persona always = same lens, regardless
  // of which cert is signed in (within the persona scope).
  const [viewConfig, setViewConfig] = useViewConfig(personaKey(persona))

  // Active workspace: explicit override > surface's owning workspace > persona mapping
  const activeWorkspace: WorkspaceId = (() => {
    if (workspaceOverride) return workspaceOverride
    const owning = findWorkspaceForSurface(active, PERSONA_TO_WORKSPACE[effectivePersonaType] ?? 'home')
    return owning.id
  })()

  // Hash-based routing — sync to/from window.location.hash on the client only.
  // The hash supports query params (e.g. `#chargen?certId=X`) — surfaces read
  // those via their own URL parsing helpers. We match the surface id off the
  // pre-`?` portion only.
  const surfaceFromHash = (raw: string): string | null => {
    const trimmed = raw.replace(/^#/, '')
    const id = trimmed.split('?')[0]
    return id && SURFACES.some((s) => s.id === id) ? id : null
  }

  React.useEffect(() => {
    const matched = surfaceFromHash(window.location.hash || '')
    if (matched) setActive(matched)
    const onHash = () => {
      const m = surfaceFromHash(window.location.hash || '')
      if (m) setActive(m)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    // Only rewrite if the surface portion changed — preserve any `?query`
    // the surface depends on (e.g. chargen?certId=X).
    const currentSurfacePart = (window.location.hash || '').replace(/^#/, '').split('?')[0]
    if (currentSurfacePart !== active) {
      window.location.hash = active
    }
    // Clear workspace override once the surface naturally lives in another workspace
    if (workspaceOverride) {
      const wsForSurface = findWorkspaceForSurface(active, workspaceOverride)
      if (wsForSurface.id === workspaceOverride) {
        setWorkspaceOverride(null)
      }
    }
  }, [active, workspaceOverride])

  // density override on root
  React.useEffect(() => {
    const root = document.documentElement
    if (t.density === 'compact') root.style.setProperty('font-size', '14px')
    else if (t.density === 'comfy') root.style.setProperty('font-size', '17px')
    else root.style.setProperty('font-size', '16px')
  }, [t.density])

  // Auth gating — once session has hydrated, kick anyone without a cert
  // back to #auth if they try to visit a non-public surface.
  //
  // EITHER form of cert grants access:
  //   - Legacy invite-flow cert in localStorage (`session.cert`)
  //   - New IDB account cert (`idbAccount`)
  // We track the IDB account presence here so the gate honors the new flow.
  const [idbAccount, setIdbAccount] = React.useState<AccountCert | null>(null)
  const [idbChecked, setIdbChecked] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    loadAccount()
      .then((acc) => {
        if (cancelled) return
        setIdbAccount(acc)
        setIdbChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setIdbChecked(true)
      })
    // Re-check on hashchange — after mint, the user navigates and we want
    // the gate to release immediately rather than waiting for a refresh.
    const onHash = () => {
      loadAccount().then((acc) => !cancelled && setIdbAccount(acc)).catch(() => {})
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  React.useEffect(() => {
    if (!session.hydrated) return
    if (!idbChecked) return       // wait for IDB probe
    if (session.cert) return      // legacy cert grants access
    if (idbAccount) return        // new IDB account cert grants access
    if (PUBLIC_SURFACES.has(active)) return
    setActive('auth')
  }, [session.hydrated, session.cert, idbChecked, idbAccount, active])

  const current = SURFACES.find((s) => s.id === active) || SURFACES[0]
  const Surface = current.Comp
  const workspace = WORKSPACES.find((w) => w.id === activeWorkspace) ?? WORKSPACES[0]

  // Click a workspace tab → jump to its landing surface.
  const switchWorkspace = (wsId: WorkspaceId) => {
    const ws = WORKSPACES.find((w) => w.id === wsId)
    if (!ws) return
    setWorkspaceOverride(wsId)
    setActive(ws.landingSurfaceId)
  }

  // Build a flat lookup so we can render labels for surfaces inside categories.
  const surfaceById = React.useMemo(() => {
    const m: Record<string, typeof SURFACES[number]> = {}
    for (const s of SURFACES) m[s.id] = s
    return m
  }, [])

  return (
    <div className="app" data-screen-label={`${active} surface`}>
      <aside className="sidebar">
        <h1>Claude DM</h1>
        <span className="tag">centaur build · v0.1</span>

        {/* Workspace tabs */}
        <div className="ws-tabs" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          marginTop: 14,
          marginBottom: 12,
          padding: 3,
          border: '1px solid var(--rule-soft)',
          background: 'var(--paper-2)',
        }}>
          {WORKSPACES.map((w) => (
            <button
              key={w.id}
              className={'ws-tab' + (w.id === activeWorkspace ? ' active' : '')}
              onClick={() => switchWorkspace(w.id)}
              style={{
                padding: '6px 4px',
                background: w.id === activeWorkspace ? 'var(--paper)' : 'transparent',
                border: w.id === activeWorkspace ? '1px solid var(--rule)' : '1px solid transparent',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: w.id === activeWorkspace ? 'var(--ink)' : 'var(--ink-3)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                lineHeight: 1.1,
              }}
              title={`Switch to ${w.label} workspace`}
            >
              <span style={{ fontSize: 14 }}>{w.glyph}</span>
              <span>{w.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-group" style={{ marginTop: 6 }}>
          <div className="nav-label">Session</div>
          <div className="tiny" style={{ lineHeight: 1.6 }}>
            <div>
              <span style={{ color: session.cert ? 'var(--accent-green)' : 'var(--accent-red)' }}>●</span>{' '}
              {session.hydrated
                ? session.cert
                  ? <>cert · <span className="kbd">{session.cert.id.slice(0, 8)}</span></>
                  : <>no cert · <a onClick={() => setActive('auth')} style={{ cursor: 'pointer' }}>sign in</a></>
                : 'loading…'}
            </div>
            <div>
              <span style={{ color: session.activeCharacterId ? 'var(--accent-blue)' : 'var(--ink-3)' }}>●</span>{' '}
              {session.activeCharacterId
                ? <>active · <span className="kbd">{session.activeCharacterId.slice(0, 8)}</span></>
                : 'no active character'}
            </div>
            {session.cert && (
              <div style={{ marginTop: 6 }}>
                <a
                  onClick={() => { session.clearCert(); setActive('auth') }}
                  style={{ cursor: 'pointer', color: 'var(--ink-3)' }}
                >
                  sign out
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Pinned surfaces (cross-category, always at top) */}
        {viewConfig.pinned.length > 0 && (() => {
          // Only include pins that exist in the current workspace
          const inWs = new Set<string>()
          workspace.categories.forEach((c) => c.surfaceIds.forEach((id) => inWs.add(id)))
          const pinnedHere = viewConfig.pinned.filter(
            (id) => inWs.has(id) && !viewConfig.hidden.includes(id) && surfaceById[id],
          )
          if (pinnedHere.length === 0) return null
          return (
            <div className="nav-group">
              <div className="nav-label">★ Pinned</div>
              <nav className="nav">
                {pinnedHere.map((id) => {
                  const s = surfaceById[id]
                  return (
                    <a
                      key={s.id}
                      className={active === s.id ? 'active' : ''}
                      onClick={() => setActive(s.id)}
                    >
                      <span className="num">{s.num}</span>
                      {s.label}
                    </a>
                  )
                })}
              </nav>
            </div>
          )
        })()}

        {/* Active workspace categories (with hidden surfaces filtered out) */}
        {workspace.categories.map((cat) => {
          const visible = cat.surfaceIds.filter(
            (id) => !viewConfig.hidden.includes(id) && surfaceById[id],
          )
          if (visible.length === 0) return null
          return (
            <div key={cat.label} className="nav-group">
              <div className="nav-label">{cat.label}</div>
              <nav className="nav">
                {visible.map((id) => {
                  const s = surfaceById[id]
                  return (
                    <a
                      key={s.id}
                      className={active === s.id ? 'active' : ''}
                      onClick={() => setActive(s.id)}
                    >
                      <span className="num">{s.num}</span>
                      {s.label}
                    </a>
                  )
                })}
              </nav>
            </div>
          )
        })}

        {/* Persona + configure view button */}
        <div className="nav-group" style={{ marginTop: 8 }}>
          <div className="nav-label">Playing as</div>
          <div className="tiny" style={{ lineHeight: 1.5, marginBottom: 6 }}>
            <span style={{ fontSize: 14, marginRight: 4 }}>{PERSONA_GLYPHS[effectivePersonaType]}</span>
            <b>{PERSONA_LABELS[effectivePersonaType]}</b>
            {(activeCharCert?.id || persona.characterId) && (
              <> · <span className="kbd">{(activeCharCert?.id ?? persona.characterId!).slice(0, 8)}</span></>
            )}
          </div>
          <button
            className="btn sm"
            onClick={() => setConfigOpen(true)}
            style={{ width: '100%', textAlign: 'left' }}
          >
            ⚙ Configure view
            {(viewConfig.hidden.length + viewConfig.pinned.length > 0) && (
              <span className="tiny muted" style={{ marginLeft: 8 }}>
                {viewConfig.pinned.length}★ · {viewConfig.hidden.length}✕
              </span>
            )}
          </button>
        </div>

        <div className="nav-group" style={{ marginTop: 24 }}>
          <div className="nav-label">Legend</div>
          <div className="tiny" style={{ lineHeight: 1.6 }}>
            <div>
              <span style={{ color: 'var(--accent-red)' }}>●</span> villain / danger / DM
            </div>
            <div>
              <span style={{ color: 'var(--accent-blue)' }}>●</span> player / ally
            </div>
            <div>
              <span style={{ color: 'var(--accent-gold)' }}>●</span> loot / contested
            </div>
            <div>
              <span style={{ color: 'var(--accent-green)' }}>●</span> safe / ready
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <Surface />
      </main>

      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakToggle
          label="Hand annotations"
          value={t.showAside}
          onChange={(v) => setTweak('showAside', v)}
        />

        <TweakSection label="Quick jump (all surfaces)" />
        {SURFACES.map((s) => (
          <TweakButton
            key={s.id}
            label={`${s.num} · ${s.label}`}
            onClick={() => setActive(s.id)}
          />
        ))}
      </TweaksPanel>

      {!t.showAside && (
        <style>{`.hand, .aside { display: none !important; }`}</style>
      )}

      <ConfigMenu
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        persona={persona}
        setPersona={setPersona}
        config={viewConfig}
        setConfig={setViewConfig}
        categories={workspace.categories}
        surfacesById={surfaceById}
      />
    </div>
  )
}
