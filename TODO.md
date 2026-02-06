# TTRPG Engine — To-Code Plan

> Generated 2026-02-06 from full codebase audit.
> **142k lines, ~80% written, ~30% end-to-end integrated.**
> The engine subsystems exist. The routers exist. The views exist.
> What's missing is the **wiring** — connecting frontend actions to backend
> logic and making the full loops work.

---

## Phase 0: Foundation (Can't test anything without these)

### 0.1 — Local database mode
- **File:** `bend/.env`
- **What:** Change `TURSO_DATABASE_URL=file:local.db` so the app runs without a remote Turso instance
- **Why:** Remote Turso credentials are environment-specific; local SQLite lets anyone `bun run dev`
- **Also:** `bend/src/db/client.ts` already supports `file:` URLs (line 43 of dev-server.ts logs it)

### 0.2 — Untrack credentials from git
- **Files:** `bend/.env`, `fend/.env`
- **What:** `git rm --cached bend/.env fend/.env` — they're in `.gitignore` but were added before the rule
- **Why:** Turso token, Clerk secret, Gemini key are all exposed in git history
- **Then:** Rotate the exposed keys, create `.env.example` files with placeholder values

### 0.3 — Fix Session.vue missing view prop
- **File:** `fend/src/views/campaign/Session.vue` ~line 50
- **What:** Add `view="session"` prop to the `<GenesisViewport>` component
- **Why:** Without it, defaults to `'world'` view instead of session gameplay view
- **Code:** `<GenesisViewport :campaignId="campaignId" view="session" ...>`

### 0.4 — Seed the database on first run
- **File:** `bend/src/dev-server.ts` (after `initSchema()`)
- **What:** After migrations, check if seed data exists; if not, run the seed importer
- **Why:** World nodes, factions, deities, settlements are all in `bend/src/db/seeds/*.json` but need to be loaded
- **References:** `bend/src/db/seeds/importer.ts`, `bend/src/db/seeds/loader.ts`

---

## Phase 1: End-to-End Happy Path

> **Goal:** One player can: create account → create campaign → create character → enter the world → see content.

### 1.1 — Genesis viewport event delegation
- **File:** `fend/src/viewport/GenesisViewport.vue`
- **What:** Add a click handler on `.viewport-world` that intercepts `data-dest-*` attributes from precipitated HTML
- **Why:** Backend precipitates buttons with `data-dest-type="route"`, `data-dest="/campaign/:id/characters"` etc. but the frontend never reads them
- **Pattern:**
  ```
  onClick(e) → find nearest [data-dest] → switch on data-dest-type:
    "route"    → router.push(dest)
    "event"    → emit custom event (genesis:exit, etc.)
    "mutation" → call trpc[dest].mutate(params)
    "action"   → handle local state change
  ```
- **This unlocks:** All precipitated buttons becoming clickable (character builder submit, campaign dashboard navigation, alignment grid, exit buttons)

### 1.2 — Genesis viewport form submission
- **File:** `fend/src/viewport/GenesisViewport.vue`
- **What:** Add a submit handler that collects form data from precipitated `<form>` elements and calls the appropriate tRPC mutation
- **Why:** The character builder form is precipitated HTML — the frontend needs to collect its values and call `character.birthGenesis`
- **Flow:** `<form> submit → FormData → extract race/class/name/abilities → trpc.character.birthGenesis.mutate(data)`

### 1.3 — Campaign dashboard button wiring
- **File:** `bend/src/api/routers/genesis.ts` → `buildCampaignWorld()`
- **What:** Add `data-dest-type="route"` and `data-dest` attributes to the "View Characters", "View World", "Enter Session" buttons
- **Why:** Currently they're dead `atoms.button()` calls with no navigation targets
- **Also:** The "Exit to Campaigns" button uses `onclick` inline JS — should use `data-dest-type="route"` instead

### 1.4 — Character birth end-to-end
- **File:** `bend/src/api/routers/character.ts` → `birthGenesis` procedure
- **What:** Verify the full flow: form data → topology computation → token creation → atom (stats) projection → DB insert → redirect
- **Check:** Does `birthCharacter()` in `bend/src/genesis/character.ts` actually compute ability score modifiers, HP, AC from the topology?
- **Frontend:** After successful birth, redirect to character list or character detail

### 1.5 — World view: load seed data
- **File:** `fend/src/views/campaign/World.vue`
- **What:** The view calls `trpc.world.listNodes.query({ campaignId })` but returns empty unless the Toril seed data has been imported for this campaign
- **Fix:** Either auto-seed when a campaign is created, or add a "Seed World" button that calls the importer
- **Backend:** Need an endpoint or migration step that links seed data to a campaign ID

### 1.6 — Character list: show real data
- **File:** `fend/src/views/campaign/Characters.vue`
- **What:** Verify `trpc.character.list` returns characters with the fields the template expects (`name`, `level`, `race`, `className`, `hp`, `maxHp`, `status`)
- **Check:** The DB query in `bend/src/db/queries/characters.ts` — does it join character_tokens with characters to get both atom and token data?

---

## Phase 2: Session Gameplay Loop

> **Goal:** Player enters a session, sees a location, types an action, gets a response.

### 2.1 — Session initialization
- **File:** `bend/src/api/routers/session.ts` → `create` / `start`
- **What:** Wire the Session.vue "Start Session" button to actually create a session record and start it
- **Frontend:** `Session.vue` needs to call `trpc.session.create.mutate()` then `trpc.session.start.mutate()` before mounting GenesisViewport
- **Backend:** `start` procedure should set the initial scene/location

### 2.2 — Session world view: dynamic content
- **File:** `bend/src/api/routers/genesis.ts` → `buildSessionWorld()`
- **What:** Currently returns hardcoded "Yawning Portal" content. Should:
  1. Load the session's current location from DB
  2. Load NPCs present at that location
  3. Precipitate location description + NPC list + action input
- **Dependencies:** `session.get` → `world.getNode` → `npc.list` (by location)

### 2.3 — Player action input → engine → response
- **File:** New or extend `bend/src/api/routers/session.ts`
- **What:** Add a `playerAction` mutation:
  1. Receive player text input
  2. Log as session event (`logPlayerAction`)
  3. If AI enabled: send to GM orchestrator for response
  4. If no AI: just log and return acknowledgment
  5. Re-precipitate the world with updated state
- **Frontend:** The action input in session world needs to submit via the event delegation (1.1)

### 2.4 — Location navigation
- **File:** `bend/src/api/routers/session.ts` or `world.ts`
- **What:** When a player clicks a location link in the session world, update session location and re-precipitate
- **Flow:** Click "Go to Market" → `session.setLocation.mutate({ locationId })` → re-fetch `genesis.world`

---

## Phase 3: Combat

> **Goal:** GM can start combat, players see initiative order, take turns, resolve attacks.

### 3.1 — Combat viewport
- **File:** `bend/src/api/routers/genesis.ts` — add `buildCombatWorld()`
- **What:** New genesis view `'combat'` that precipitates:
  - Initiative order (from `combat.initiativeOrder`)
  - Current turn indicator
  - Participant HP bars
  - Action buttons (Attack, Cast Spell, Dash, Disengage, etc.)
  - Combat log (recent actions)
- **Router:** Add `'combat'` to the view enum in `genesis.world`

### 3.2 — Combat initiation flow
- **Frontend:** GM clicks "Start Combat" → calls `trpc.combat.create.mutate()` → adds participants → `trpc.combat.start.mutate()`
- **Backend:** Already implemented in combat router
- **Viewport:** Switch to combat view when combat is active

### 3.3 — Turn actions
- **What:** Wire action buttons to combat router mutations:
  - Attack → `combat.damage.mutate()`
  - Heal → `combat.heal.mutate()`
  - Move → `combat.move.mutate()`
  - Add condition → `combat.addCondition.mutate()`
- **Engine:** `bend/src/engine/rules/dnd5e.ts` has attack/save/check resolution

### 3.4 — Combat end and XP
- **What:** When combat ends, calculate and distribute XP to participants
- **Backend:** `combat.end` procedure — needs to trigger XP distribution
- **Flow:** End combat → calculate XP from encounter difficulty → add to characters

---

## Phase 4: GM Tools

> **Goal:** GM has a functional dashboard for running sessions.

### 4.1 — GM view in genesis
- **File:** `bend/src/api/routers/genesis.ts` — add `buildGMWorld()`
- **What:** GM-specific viewport with:
  - Session controls (start/pause/end)
  - Scene description editor
  - NPC quick-spawn
  - Secret notes panel
  - Player status overview (HP, conditions, location)

### 4.2 — NPC management UI
- **Frontend:** New view or section in GM tools
- **What:** List NPCs for current location, add new NPCs, edit personality/motivations
- **Backend:** `npc.list`, `npc.create`, `npc.update` — all implemented

### 4.3 — GM notes and secrets
- **Frontend:** New view or section in GM tools
- **What:** Create/edit campaign notes, mark secrets, reveal to players
- **Backend:** `gm.createNote`, `gm.secrets`, `gm.revealSecret` — all implemented

### 4.4 — Scene generation (AI-assisted)
- **What:** GM clicks "Generate Next Scene" → `gmOrchestrator.generateNextScene` → AI generates scene description based on context
- **Backend:** Fully implemented in gm-orchestrator router
- **Depends on:** Gemini API key configured

---

## Phase 5: AI Integration

> **Goal:** NPCs talk back. Scenes generate themselves. The world feels alive.

### 5.1 — NPC chat
- **What:** Wire NPC chat in session view — player clicks NPC → chat interface → `npc.chat` or `ai.npcChat`
- **Backend:** Fully implemented with Gemini, context building, memory storage
- **Requires:** `GOOGLE_AI_API_KEY` in `.env`

### 5.2 — Scene narration
- **What:** After player actions, AI generates narrative response describing what happens
- **Backend:** `ai.orchestrate` routes to appropriate agent (narrator/combat/world)
- **Frontend:** Display AI response in session viewport, append to scene history

### 5.3 — Encounter generation
- **What:** GM clicks "Random Encounter" → AI generates balanced encounter for party level
- **Backend:** `ai.generateEncounter` — implemented with Gemini
- **Also fix:** `gm.randomEncounter` is a stub with hardcoded tables — should call the AI version or have real tables

### 5.4 — NPC deepening
- **What:** GM clicks "Deepen NPC" → AI expands NPC with backstory, motivations, secrets, dialogue patterns
- **Backend:** `ai.deepenNpc` — fully implemented

---

## Phase 6: Multiplayer / Realtime

> **Goal:** Multiple players in the same session see the same world updating in real time.

### 6.1 — WebSocket server
- **File:** `bend/src/dev-server.ts` or new `ws-server.ts`
- **What:** Create WebSocket server on `WS_PORT` (3002, already in .env)
- **Pattern:** On session event → broadcast to all session participants
- **References:** `bend/src/api/routers/sync.ts` has delta sync infrastructure

### 6.2 — Frontend WebSocket client
- **File:** New composable `fend/src/composables/useRealtime.ts`
- **What:** Connect to WS, listen for session events, trigger viewport refresh
- **Pattern:** `onMessage(delta) → if delta affects current view → re-nucleate`

### 6.3 — Delta sync integration
- **Backend:** `sync.push` and `sync.changes` are implemented
- **What:** Wire session events to delta creation → broadcast → client acknowledgment
- **Flow:** Player action → server processes → creates delta → broadcasts → all clients re-precipitate

### 6.4 — Player presence
- **What:** Show which players are connected to the session
- **Backend:** Track via WebSocket connections
- **Frontend:** Display player avatars/names in session header

---

## Phase 7: Polish, Testing, Hardening

### 7.1 — Test coverage: genesis pipeline
- **What:** Snapshot tests for `projectToCSS()` with various physics inputs
- **Verify:** Known physics → expected CSS (color, padding, layout, shadow)
- **Framework:** Bun test runner (`bun test`)

### 7.2 — Test coverage: character creation
- **What:** Integration tests for `birthGenesis` — topology computation, stat derivation, DB round-trip
- **Verify:** Human Fighter → expected HP, AC, proficiencies

### 7.3 — Test coverage: combat resolution
- **What:** Unit tests for `dnd5e.ts` — attack rolls, damage, saves, conditions
- **Verify:** Known inputs → expected outcomes (hit/miss, damage ranges, save results)

### 7.4 — Frontend error boundaries
- **What:** Add error handling to all tRPC calls in views
- **Pattern:** Loading/error/empty states for every data-fetching component
- **Fix:** `Login.vue` line 71 swallows `me` endpoint errors silently

### 7.5 — Responsive viewport
- **What:** Test precipitated content at mobile/tablet/desktop widths
- **Fix:** Character builder columns already use `min-width: 280px` + flex-wrap — verify it works

### 7.6 — Update README.md and PROGRESS.md
- **What:** README claims features are missing that exist; PROGRESS.md tracks React (actual is Vue 3)
- **Do:** Rewrite both to reflect actual state

---

## Known Stubs / TODOs in Code

| Location | Issue | Priority |
|----------|-------|----------|
| `party.ts:49` | `mine` returns null — needs party_memberships query | Medium |
| `auth.ts:390` | `revokeSeed` has no admin check — security risk | High |
| `combat.ts:357,391` | Hardcoded `round: 0, turnIndex: 0` in logging | Low |
| `gm.ts:412-425` | `randomEncounter` uses hardcoded tables | Low |
| `gm.ts:446-488` | `randomNPC` uses hardcoded arrays | Low |
| `inventory.ts:1104` | `generateHomebrew` throws NOT_IMPLEMENTED | Low |
| `campaigns.ts:~200` | TODO: delete parties/characters on campaign delete | Medium |
| `ai-gm.ts:~290` | TODO: use actual LLM (not stubbed) | Medium |
| `challenge.ts:140,160` | TODO: secure seed storage/retrieval | Low |

---

## Suggested Work Order

If working solo, the most impactful sequence is:

1. **Phase 0** (1-2 hours) — Get the app bootable
2. **Phase 1.1 + 1.2** (half day) — Event delegation + form submission = ALL precipitated content becomes interactive
3. **Phase 1.3 + 1.4** (half day) — Dashboard navigation + character birth = first real user flow
4. **Phase 2.1 + 2.2** (1 day) — Session init + dynamic content = entering the world
5. **Phase 7.1-7.3** (1 day) — Tests for the three most complex systems
6. Everything else follows from playtesting

**Phase 1.1 (event delegation) is the single highest-leverage task.** It makes every precipitated button in the entire app functional with one piece of code.
