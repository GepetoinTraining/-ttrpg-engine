# UI Elements Needed — Handoff to Claude Design

Scope: every modal, drawer, action-bar element, banner, toast, and sidebar widget the app will need across the cert flow + world dashboard + grid + slow-life + combat. Organized by category. Many are stubs today; this is the "what design needs to produce" punch list.

Engineering side is mostly wired (cert flow + slot push + grid renderer). UI fidelity is "strip-only" → "fully bound" upgrade work.

**Status legend:**
- 🟢 **Live** — exists in the codebase with at least functional UX, just needs design polish
- 🟡 **Partial** — engineering side wired (lib/endpoint), UI is a stub or missing entirely
- 🔴 **Pending** — neither code nor UI yet; depends on later slices

---

## Sprint 3 update (2026-04-30) — what changed since first handoff

The cert-hierarchy + chargen + grid + dashboard sprint landed. Things that moved status:

- **🟢 NEW LIVE** — Account-create flow (Auth.tsx with geo permission probe + manual fallback), Persona picker (CharacterSelect 4-card grid), 4d6-drop dice with 3D polyhedrons + lock/reroll, prime-element spell composer (StepSpells for casters), equipment catalog browser (~95 SRD items, searchable), grid viewport with 6 zoom levels, world dashboard layout shell.
- **🟢 NEW MODAL** — **M00. Method-lock confirmation** (Chargen abilities step). Already wired and styled passably; *"if you choose rolling there's no going back"* — gates entry to 4d6/Heroic methods.
- **🟢 NEW SURFACE** — **`#world` (slot 48)** — WorldDashboard layout shell. Sidebar / center grid / right-rail drawers / bottom action bar.
- **🟢 NEW SURFACE** — **`#map` (slot 47)** — Standalone Map surface with zoom/pan/inspector.
- **🟢 NEW SURFACE** — **`#character-select` (slot 46)** — Character cert list + persona picker + chargen launcher.

The sections below are updated with the new statuses.

---

## Modals (full overlay, dismissable)

### Cert + account
- 🟡 **M00. Method-lock confirmation** (chargen — abilities step) — *NEW; in-place modal exists. Style polish.* Fires when player picks 4d6 or Heroic. Body: "If you choose rolling, there's no going back. The other ability methods will be locked out — you can't escape unlucky rolls by swapping methods later." Two buttons: cancel + commit.
- 🔴 **M01. Confirm sign out** — clears local account from IDB. "This will remove the account cert from this browser. Anyone else can re-mint with the same email/geo+datetime if they were physically present at creation."
- 🔴 **M02. Forget character** — confirmation before `deleteCharacterCert`. Shows the cert id, ownerChain length, and warning if the character has unattached `characterTpb` entries.
- 🔴 **M03. Account details** — full cert dump (id, seed, primes count, ζ, geo, createdAt) + raw JSON copy button. Diagnostic / debug view.
- 🔴 **M03b. Geolocation permission help** — when probe returns "denied", show step-by-step screenshots for re-enabling per browser (Chrome / Firefox / Safari / Brave).

### Trade flow (Slice 6)
- **M04. Initiate trade** — current owner picks target account by id (or scans QR / pastes URL). Shows the character cert summary + persona badge. Generates initiate sig + posts to `/api/character/trade/initiate`.
- **M05. Pending trade — outbound** — shows the pending trade's recipient, when initiated, with a "cancel" button. Reads from server.
- **M06. Pending trade — inbound** — receiver sees "X offered you Y character (persona: dm)". Has accept + decline buttons. Post-accept, the cert lands in the receiver's IDB.
- **M07. Trade history** — `character_trades` log for the current cert, with status + who.

### Party flow (Slice 6)
- **M08. Party invite — share** — shows your active character cert hash as QR + copy-paste URL (`claudedm-party:<certId>`). Shareable link.
- **M09. Party invite — paste** — input field for the cert hash / URL. Calls `parseInviteString` + `addPartyMember`.
- **M10. Persona incompatibility warning** — if `checkPartyCompatibility` returns an error (dmless ↔ DM-led), show the conflict + "I understand" cancel button.
- **M11. Party member detail** — shows joined cert, alias, persona, current location (when known via spectrum sync).

### Chargen / level-up
- 🔴 **M12. Level up wizard** — XP threshold met. Shows ability score / hit die / class feature choices.
- 🔴 **M13. Multiclass dialog** — choose new class + verify ability score requirements.
- 🔴 **M14. Spell preparation** — pick which spells from spellbook to prepare, gated by class slots.

### Chargen flow (sprint 3 — needs polish, not new builds)

These are functional today but visually stub-grade. Listed here so design can polish:

- 🟢 **C01. Persona picker (CharacterSelect)** — 4 cards (player / dm / gm-ai / dmless) with one-line blurbs and time-flow tag. Click → mints a character cert. Needs: better card hover/selected states, glyph treatment, time-flow badge clarity (DMless = "server-time" needs a clock icon).
- 🟢 **C02. Race + subrace cards (StepRace)** — race grid + dynamic subrace section per chosen race. Auto-selects first subrace when race changes. Needs: silhouette / portrait per race, sub-race "no variants" empty state styling.
- 🟢 **C03. Class + subclass cards (StepClass)** — same shape as race step. Needs: class iconography (sword, holy symbol, spellbook, etc.).
- 🟢 **C04. Method picker (StepAbilities)** — 4 tiles (point-buy / standard-array / 4d6-drop / heroic). Once a rolling method is committed, the other tiles are hidden. Needs: locked-state visual treatment.
- 🟢 **C05. Roll-and-lock slots (StepAbilities, rolling methods)** — 6 rows, each with 4 dice + roll button + (after first roll) a primary "🔒 lock at X" button. Pool consumption — assigning a value removes it from other ability dropdowns. Status line at bottom shows "all 6 assigned" or remaining unassigned. Needs: better dice-tray styling, slot row layout polish, locked-state badge.
- 🟢 **C06. Spell composer (StepSpells, casters)** — element chips by category (damage / delivery / school / duration), live preview of seed/school/level, auto-generated spell name (editable). Two panels: cantrip (Minor) + first spell (Lesser). Needs: chip aesthetics, intensity-locked badge clarity, validation message styling.
- 🟢 **C07. Background detail panel (StepBackground)** — selected card expands to show skills/tools/languages/equipment + feature description. Plus hook textarea + alignment dropdown. Needs: typography hierarchy.
- 🟢 **C08. Equipment catalog browser (StepEquipment)** — searchable table of ~95 items, category tabs, weapon/armor/pack details inline. Needs: better column treatment, weight/cost emphasis.
- 🔴 **C09. Equipment cart UI (V2)** — gold balance widget + add-to-cart on each row + cart drawer. Wires onto the same catalog data.
- 🔴 **C10. AI homebrew composer (chargen sidekick)** — Sonnet conversation that drafts custom races/classes/backgrounds and pins approved ones to server canon for future players to pick.

### Play / combat
- 🟡 **M15. Roll dice** — formula input (`1d20+5`, `2d6`, etc.), advantage/disadvantage toggle, target DC, advantage source. Returns the receipt + result. Calls `engineClient.roll`. *Dice components (`<StandardD20>`, `<FourDSixDropOne>`) and engine math both live; needs the modal harness.*
- 🔴 **M16. Apply damage** — target picker (party + active scene), damage type, amount, half/save options. Pushes a `writeKappa` action.
- 🔴 **M17. Apply healing** — same shape, but inverse.
- 🔴 **M18. Cast spell** — spell from prepared list, slot level picker, target picker, save DC display, components consumed. Routes through MF_check.
- 🔴 **M19. Death save** — d20 roll for unconscious character; shows successes/failures bar, auto-stabilize at 3.
- 🔴 **M20. Short rest** — hit dice spend picker, ability resource recharge.
- 🔴 **M21. Long rest** — full HP recovery, half hit dice restored, all spell slots, exhaustion -1.
- 🔴 **M22. Reaction prompt** — appears when something triggers a reaction (opportunity attack, counterspell, etc.). Time-limited.
- 🔴 **M23. Initiative roll** — combat start; rolls everyone's initiative, shows turn order.

### NPC + interaction
- **M24. NPC dialog** — talk-to-NPC modal. Shows disposition, known facts, dialog choices, skill check options. Routes through `engine/intelligence.ts`.
- **M25. NPC quick view** — disposition, recent interactions, hire/recruit option.
- **M26. NPC creation (DM-only)** — quick NPC stub: name, role, disposition, location.
- **M27. Loot drop** — list of items with claim buttons; routes to inventory transfer.
- **M28. Inventory transfer** — pick item, qty, target (party member / shared). Slot push for `entityMove` if moving between certs.

### World / DM superpowers
- **M29. Transport party (DM)** — destination picker + travel mode (instant / travel / N days). Already in Play.tsx as inline panel — promote to modal for repeated use.
- **M30. Time skip (DM)** — advance world day by N. Shows what cron-driven changes will fire.
- **M31. Force scene change (DM)** — pick scene type (combat, social, exploration, downtime), seed it.
- **M32. Inject NPC (DM)** — drop an NPC into the current scene with disposition + brief.
- **M33. Random encounter roll (DM)** — d100 against current node's encounter table.
- **M34. Map travel confirmation** — clicking a tile in `Map` surface: "travel here? (3 days, costs ration)". Routes to engine-client transport.

### Quests + narrative
- **M35. Quest detail** — full quest view: objectives (active/completed), rewards, related arcs, party progress, time limit.
- **M36. Beat reveal** — when a beat fires, modal shows the read-aloud + GM notes (DM only) or just narrative (player).
- **M37. Rabbit hole prompt** — when an unrelated thread escalates, ask if party wants to pursue.

### Settlement / world
- **M38. Settlement detail** — full settlement view: residents, buildings, services, faction control, current state (foodSecurity, unrest).
- **M39. Faction view** — relationships, members, territory, current goals.
- **M40. Diplomacy action** — declare war, offer peace, ally, sign treaty.
- **M41. Banking** — deposit, withdraw, transfer, exchange between currencies.
- **M42. Market** — buy/sell with current prices, haggling roll, market mood.

### System / settings
- **M43. View config (existing)** — pin/hide surfaces per persona. Already in `ConfigMenu.tsx`.
- **M44. Settings** — density, sound, animations, autopush interval, notification preferences.
- **M45. Diagnostics** — IDB status, pending count, last push, last log poll, server health.
- **M46. About / version** — git sha, build time, schema version, links.

---

## Drawers (collapsible side panels — right rail of WorldDashboard)

The WorldDashboard now has 5 of these as **inline panels** (tabbed in the right rail). Each is functional but stub-grade — listed below with current status:

- 🟢 **D01. Companions / Party** — party members with HP bars. *Currently mock data; bind to engine party state.*
- 🟢 **D02. Quests** — active quest list. *Currently mock; bind to `mm-narrative` quest state.*
- 🟢 **D03. Inventory** — *Currently a placeholder note. Inventory engine exists in `engine/inventory.ts`; needs wiring through chargen + sheet.*
- 🔴 **D04. Spells** — prepared spells, slots remaining, click to cast (M18). Needs hook to `draft.startingSpells` initially, then character's spellbook.
- 🔴 **D05. Minimap** — small grid view + waypoints; clickable for jump. The full Map surface (#map) covers this for now.
- 🟢 **D06. Event log** — live feed from `/api/world/log` poll. *Working — shows recent action types + worldDay + timestamp.* Needs filter UI + clickable rows for detail.
- 🔴 **D07. Nearby NPCs** — list at current node, click → M24/M25.
- 🔴 **D08. Notes** — player free-text notes per character. Local IDB.
- 🔴 **D09. Party chat** — text + dice roll feed for party members (when spectrum bridge lands).
- 🟡 **D10. Cert sync (NEW)** — shows the player's character cert hash + "copy invite link" button (writes `claudedm-party:<certId>` to clipboard). *Foundation for party-invite flow.*
- 🔴 **D11. DM tools** (DM persona only) — collapses M29-M33 into a drawer.

---

## Action bar (bottom, sticky, scoped to active character)

### Common actions (always visible)
- **A01. Talk** — opens M24 (target picker)
- **A02. Examine** — opens tile inspector or scene detail
- **A03. Roll d20** — quick roll button → M15
- **A04. Inventory** — toggles D03
- **A05. Rest** — short / long rest picker (M20/M21)
- **A06. Travel** — opens M34 or Map surface
- **A07. Wait** — advance time at current node

### Slow-life chips (contextual — appear based on current node)
- **A08. Examine deposit** (when at deposit)
- **A09. Extract** (when at deposit + workers available)
- **A10. Study material** (anywhere)
- **A11. Plant crops** (when at farm + season match)
- **A12. Tend herd** (when at herd)
- **A13. Sell item** (when at market)
- **A14. Train** (when at training facility)
- **A15. Pray** (when at temple)
- **A16. Research** (when at library)

### Combat actions (when in scene)
- **A17. Attack** — target picker → M15 → M16
- **A18. Cast spell** — M18
- **A19. Dash** — double movement
- **A20. Dodge** — defensive stance
- **A21. Disengage** — avoid OAs
- **A22. Ready action** — set trigger + reaction
- **A23. Help** — give ally advantage
- **A24. Object interact** — door, lever, etc.

### DM-only actions (when DM persona)
- **A25. Force scene** (M31)
- **A26. Inject NPC** (M32)
- **A27. Time skip** (M30)
- **A28. Roll encounter** (M33)
- **A29. Tick world +1d / +1w** (existing)

### Persistent indicators (right side of action bar)
- **A30. Pending count** — "3 pending" with click → push button
- **A31. Push button** — manual push trigger
- **A32. Last sync** — "synced 2m ago"
- **A33. World day** — current day display
- **A34. Connection** — online/offline dot
- **A35. Persona badge** — small icon showing active character's persona

---

## Sidebar (left, workspace nav)

- **S01. Workspace tabs** — Home / Player / DM / Table (existing in DMHelperApp)
- **S02. Surface categories** within each workspace (existing)
- **S03. Pinned surfaces** (★ group at top) (existing in view-config)
- **S04. Active character chip** — persona glyph + truncated name
- **S05. Account chip** — bottom of sidebar; click → M03
- **S06. IDB health dot** — green/yellow/red; click → M45
- **S07. Quick character switcher** — dropdown of owned characters; click switches active

---

## Toasts / banners (transient)

- **T01. Action queued** — "Push +1 (intent: examine_deposit)"
- **T02. Push success** — "✓ 3 actions queued for next drain"
- **T03. Push failed** — "× retry / discard"
- **T04. Trade incoming** — "X offered you Thorin (dm). View?"
- **T05. Party invite incoming** — "X invited you to a party. Accept?"
- **T06. Cron tick** — "World advanced to day N"
- **T07. Connection lost** — "Reconnecting…"
- **T08. Cert mismatch** — "Cert validation failed. Re-create account?"
- **T09. Level up available** — "Reached XP threshold — open level-up?"
- **T10. New quest** — "New quest available: X"
- **T11. NPC reaction** — "Elara's disposition shifted: friendly → neutral"
- **T12. World event** — "Storm approaching. -2 to perception checks until clear."

---

## Forms (inline, not modals)

- **F01. Account create** — geo permission prompt → button (existing)
- **F02. Character create** — chargen stepper (existing, 9 steps)
- **F03. Persona picker** — 4-card grid (existing in CharacterSelect)
- **F04. Party invite paste** — single input (existing pattern in Auth's PasteTokenDialog — promote to its own modal M09)
- **F05. Trade init** — target account search/picker
- **F06. Settings** — checkbox/slider grid

---

## Specialty surfaces (full-screen, not modals)

- 🟢 **SP01. WorldDashboard (slot 48, `#world`)** — *NEW THIS SPRINT.* Layout shell with sidebar / center grid / right-rail drawers / bottom action bar. Functional + click-tested by Pedro. Visual polish needed across all panels.
- 🟢 **SP02. Map (slot 47, `#map`)** — *NEW THIS SPRINT.* Standalone grid viewer with 6-level zoom (combat → continent), WASD pan, layer toggles, tile inspector. Functional. Needs: better category tabs (zoom levels could use little icons), settlement markers richer.
- 🟢 **SP03. CharacterSelect (slot 46, `#character-select`)** — *NEW THIS SPRINT.* Persona picker + character cards + log-into-world. Needs: better empty state, character card art treatment.
- 🔴 **SP04. Combat tracker** — exists as Combat surface; needs upgrade to support full encounter flow with initiative + turn timer.
- 🔴 **SP05. Settlement view** — when player enters a settlement; full state + actions.
- 🔴 **SP06. Dungeon runner** — exists as Dungeon surface; needs grid integration for tactical view.
- 🔴 **SP07. Diplomacy briefing** — DM tool for pre-session faction state.
- 🔴 **SP08. Recap** — session recap; existing surface, needs TPB-replay wiring.

### Chargen step polish (existing 9-step flow under `#chargen`)
- 🟢 **CH01. Step 00 — Import** — D&D Beyond PDF importer (working).
- 🟢 **CH02. Step 01 — Race** — see C02.
- 🟢 **CH03. Step 02 — Class** — see C03.
- 🟢 **CH04. Step 03 — Abilities** — see C04 + C05.
- 🟢 **CH05. Step 04 — Skills** — class-driven choice count, background-grant overlay.
- 🟢 **CH06. Step 05 — Background** — see C07.
- 🟢 **CH07. Step 06 — Spells** — see C06.
- 🟢 **CH08. Step 07 — Equipment** — see C08.
- 🟢 **CH09. Step 08 — Review** — derived stats summary + "log into world →" commit.

---

## Sprite library (per `project_sprite_spec.md`)

- **SPR01-50.** Character chips + portraits per race × class combo. ~70 SVGs across folders.
- **SPR51-100.** NPC archetypes (merchant, guard, priest, smith, bandit, noble, etc.).
- **SPR101-150.** Bestiary chips (orc, dragon, goblin, troll, etc. across CR ranges).
- **SPR151-200.** Settlement glyphs (capital, city, town, village, hamlet, ruin, fortress, port).
- **SPR201-250.** Building tiles for hub layout (forge, tavern, temple, library, market, etc.).
- **SPR251-300.** Terrain biome tiles (the 11 BiomeTypes from biome.ts × seasonal variants).
- **SPR301-350.** Item icons (weapons, armor, potions, scrolls, treasure, food).

---

## Implementation priority (engineering side)

For Claude Design's planning, here's what's most-needed-first based on the cert flow + slot push being live:

**P0 (immediate — needed to actually play)**
- M15, M16, M17, M18 (dice/damage/heal/spell — combat needs these). *Dice components live; modal harness needed.*
- M22 (reaction prompt)
- A17-A24 (combat actions)
- T01-T03 (push status toasts)
- D01, D03, D06 (companions / inventory / event log drawers — D01 + D06 stub-grade live in WorldDashboard)
- C09 (equipment cart V2 — engineering side ready, just needs UI)
- CH polish across the chargen 9 steps (every step is functional but visually stub-grade)

**P1 (next — slow-life + cert ergonomics)**
- M04-M07 (trade flow — Slice 6)
- M08-M11 (party flow — Slice 6)
- A08-A16 (slow-life chips — wired in Actions.tsx, needs nicer UX)
- T04, T05 (trade + party invite toasts)

**P2 (after WorldDashboard lands)**
- All drawers
- Persistent action-bar indicators
- Sidebar character switcher
- M29-M33 (DM tools — currently inline in Play.tsx)

**P3 (polish)**
- Animations / transitions
- Sprite library upgrades
- Settings / diagnostics modals

---

*Generated 2026-04-30. Memory pointer: `project_cert_hierarchy.md` for the cert/party model; `project_next_routing_pass.md` for the slot push pattern; this doc for the UI deliverable list.*
