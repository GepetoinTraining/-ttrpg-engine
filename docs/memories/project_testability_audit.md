---
name: Testability audit — what's missing before a real test pass
description: The small things — inert buttons, missing nav, untriggered modals, empty/loading states. Punchlist for the next conversation to make the app testable.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
The user asked at the end of conversation 1: "now we need to check for missing buttons, menus, modals... all of these tiny things that tend to make us forget."

Audit run on 2026-04-29. Below is the punchlist — concrete and surface-by-surface.

## 1 — Inert buttons (the biggest single gap)

Counts of `<button>` elements that have an `onClick` vs total per surface, after the wiring waves:

| Surface | onClick / Total | Notable misses |
|---|---|---|
| **Modals** | 0 / 48 | catalog only — nothing fires these from parent surfaces |
| **Combat** | 1 / 24 | only LiveRollWidget has wires; round controls / "advance turn" / "DM secret roll" / per-card edit/commit are inert |
| **TPEditor** | 0 / 19 | "force tick" / "revert mutation" / "author node" / batch script |
| **Sheet** | 0 / 12 | -dmg / +heal / temp HP / death save buttons all visual; skill names aren't clickable to roll |
| **Locations** | 0 / 10 | deposit / withdraw / assign worker / DM config sliders |
| **Oneshot** | 3 / 18 | only phase transitions wired; quick-dice rail is wired via Die but most narrative chips inert |
| **DMConsole** | 0 / 9 | the entire AI panel (Orchestrator / Voicebox / Whisper) is inert |
| **SceneEditor** | 0 / 9 | author / save / preview / commit |
| **Player** | 0 / 8 | inventory tabs visual; "send to ally" / "stash" / "pre-plan action" |
| **Spells** | 0 / 8 | prep / unprep / cast / ritual-cast |
| **Recap** | 0 / 8 | rewind / replay / branch / export |
| **Rumors** | 0 / 6 | confirm / link / share / leak |
| **Calendar** | 0 / 6 | scrubber / force tick / jump-to-date |
| **Companions** | 0 / 5 | feed / heal / dismiss / bond |
| **Group** | 0 / 5 | vote / pass leader / spend party gold |
| **Auth** | 4 / 8 | uninvited "DM start campaign" + "paste invite link" wired; mismatch "ping DM" still inert |
| **Onboarding** | 4 / 9 | DM flow wired; player flow has handle/AI-mode/lines/hook saved but no "save & come back" handler beyond persist |
| **Chargen** | 10 / 14 | most wired; Equipment / Background / Spells steps mostly visual |
| Most others | 0 / N | Cards · Diplomacy · Warfare · Quests · Lore · Markets · Roster · Reputation · Settlement · Attunement · Weather · Dungeon — all show 0 wired |

**Strategy for the next conversation:** triage by usefulness for a real test session. The high-leverage wires:
- Sheet skill click → `/api/sim/roll` with `<Skill> + DEX_mod + prof?`
- Combat advance turn / round controls
- Locations deposit/withdraw (needs an inventory schema decision)
- Modals → trigger pairs (each modal needs a parent surface to fire it)

## 2 — Modals catalog → trigger wiring

Surface 33 has 22 modal variants. NONE are triggered from their parent surfaces yet. They're a design reference.

What needs to happen: factor each modal in `Modals.tsx` into reusable components in `src/components/design/modals/*.tsx`, then call from parent surfaces. Best modals to start with:
- **Confirm delete arc** → Cards (04)
- **Commit character** → Chargen Review step
- **Re-seed cert** → Auth mismatch state
- **Break attunement** → Attunement (32)
- **Link rumor to scene** → Rumors (09)
- **Pass leadership** → Group (05)
- **Stash item** → Player (03) inventory
- **Prepare spells** → Spells (25)
- **Invite player** → Onboarding DM
- **New faction** → Cards (04)

## 3 — Cross-surface navigation (missing links)

The sidebar lets you jump anywhere directly, but the contextual cross-links are mostly inert. Examples that should work but don't:

- Click NPC name in DMConsole / Roster → jump to that NPC detail (needs a `/?#roster?npc=ID` URL convention)
- Click settlement name in Markets → Settlement (16) for that id
- Click campaign card / arc / faction → Cards (04) filtered to that entity
- Click rumor → Rumors (09) detail
- Click event in Calendar → Recap (19) at that worldDay
- Click character in DMConsole party HP bar → Sheet (14) for that character
- Click "send to whisper" in InlineCards → DMConsole AI panel Whisper tab

Convention to adopt: `#<surfaceId>?<key>=<value>` for deep-linking. The Auth → Onboarding flow already uses this pattern (`?invite=TOKEN&campaign=CID`).

## 4 — Empty / loading / error states

Most "live engine strip" components show "loading…" while fetching, then either real data OR a "no data" muted message. But the static wireframe content BELOW the strip stays the same regardless. Real test sessions will see: empty DB + demo wireframe = misleading UX.

For each Phase 2/3 wired surface, the pattern should be: when the live data is zero, REPLACE the demo wireframe with a real empty state ("no NPCs yet · seed Faerûn factions" with CTA). Not append the strip on top of demo data.

## 5 — Auth gating

The sidebar lets users visit any surface regardless of cert state. There's no `<AuthGate>` wrapper around the rest of the app. Real auth flow:

- App boot loads cert from localStorage; if absent or invalid, redirect/lock to `#auth`.
- Once authed, header shows current user + active campaign + a "switch character" button (Sheet has this in-surface; should be global).
- Logout / cert-revoke clears state and returns to Auth.

Currently `loadCert()` is called from a few surfaces to check status; nothing GATES navigation.

## 6 — Cross-cutting features missing for a real test session

- **Toasts / notifications** — no system. Errors render as tiny red text at strip bottom; successes are silent. Use the lightweight toast modal style from surface 33 as a base. Add `src/lib/toast.ts` (subscribe + emit pattern) + a `<ToastHost>` mounted in `DMHelperApp`.
- **Cert / user / active-character / active-campaign in header** — partially per-surface, never global. Lift to a React context.
- **Search across the app** — ⌘K command palette would be huge. Not built.
- **Keyboard shortcuts** — none.
- **Form validation** — light; many text inputs have no constraints (max length, required, pattern).
- **Real-time / multiplayer** — design assumes multiple players. We have no SSE/WebSocket layer; everything is request-response. For a single-player test that's OK, but flag for "real session" testing.
- **Persistence of in-progress state** — Chargen draft lost on page refresh. Should auto-save to localStorage between steps.
- **Undo / redo** — TPB exists in DB; no UI surfaces a revert.

## 7 — Engine ticking hasn't started

Most "live engine strip" components show 0 because no clockwork ticks have fired:
- 0 NPCs (none seeded; engine populates them via world-tick which hasn't run)
- 0 weather_state rows (266 regions exist; no weather generated)
- 0 commodity_prices rows (markets exist but unpriced)
- 0 tpb_entries (no mutations recorded)
- 0 clockwork_events (no events scheduled)

**Action**: a `/api/admin/tick` endpoint that runs `engine/clockwork.ts` once (or N days at a cadence). Surfaces would then have data to show. Without it, "live" surfaces look empty.

## 8 — Seed data gaps

`local.db` has Faerûn topology (14 worlds, 266 regions, 13 settlements, 1438 buildings) but not much else:
- 1 faction (the test "Test Faction" added during smoke test)
- 0 npcs / merchants / commodity_prices / armies / quests / scene_cards / wiki_articles
- A few characters from earlier tests (Kaelith Vex × 2, Elena Brightwood × 2, Aiji Kazuya post-import)

A seed script that loads canonical Faerûn factions (Zhentarim, Harpers, Lords' Alliance, etc.), a starter NPC roster per major settlement, and a few hook threads would unblock most "live engine strip" surfaces immediately.

## 9 — Sheet → roll wiring (high value, small effort)

Sheet shows 18 skill rows with bonuses and 6 saving throw rows. Clicking any of them should fire `rollDice({count:1, sides:20, modifier: <bonus>})` and write a `dice_receipts` row tagged with the skill/save name. Right now they're plain text.

Same for the HP buttons (-dmg / +heal / temp HP) — should hit a small `/api/character/[id]/hp` PATCH.

## 10 — Reputation deltas have no UI

`/api/reputation/delta` works (smoke-tested). No surface fires it. Should be triggered from:
- NPC interactions in DMConsole (positive/negative outcomes)
- Scene resolutions in Recap
- Faction-impacting choices in InlineCards

## 11 — Persistent active-character / active-campaign

These live in localStorage `claudedm:active-character` / `claudedm:active-character:<cid>`. Several surfaces read it at mount. There's no React context propagating it across surfaces — when you switch character on Sheet, other surfaces don't know unless they re-read localStorage.

Lift to a context provider in `DMHelperApp`.

## 12 — Sprite slots ready but no sprites yet

`<DungeonObjectGlyph>` / `<HazardMark>` / `<Door>` / `<Chip>` all have inline-glyph fallbacks. The `iconUrl?` / sprite-path slot is implied but not fully threaded through the prop signatures yet. When Claude Design's SVGs land:

1. Add `iconUrl?: string` to `DungeonObject`, `Hazard`, `Door` types in `src/lib/dungeon/types.ts`.
2. Update each component to render `<image>` when iconUrl is set.
3. Build `src/lib/dungeon/sprites.ts` registry mapping `ObjectKind` etc. → default sprite path with variant rotation.

## 13 — Importer post-flow

After Chargen commits an imported character, the sheet/spells/equipment endpoints don't yet show:
- Equipment (we don't write items to `items` + `character_carried` on import; the equipment array is parsed but not persisted into the inventory schema).
- Spells (similar — `spells_known` rows aren't written).

These would need separate schema wiring: items table writes, spells_known writes from the parser's spell list. Persona is the only "extra" we currently persist.

## 14 — Modals + Toasts + Side-sheets pyramid

The user noted in chat5 that "the rest of the UI primitives we'll need once I start testing is still missing": **toasts, banners, side sheets, empty states, inline errors, skeleton/loading, command bar, tooltips.** Some of these can be done in code with the existing modal styles; others need design.

## Recommended order for next conversation

1. ✅ **DONE 2026-04-29** — SessionContext + auth gating + sidebar status chip. `src/lib/session-context.tsx` is the source of truth for `cert`, `campaignId`, `activeCharacterId`. `<SessionProvider>` wraps `DMHelperApp`; non-public surfaces force-route to `#auth` when no cert. Sheet migrated as proof. `saveCert`/`clearCert`/`setActiveCharacter` in lib auto-dispatch a `claudedm:session-change` window event so legacy direct-localStorage callers (Auth.tsx, Chargen, etc.) propagate automatically — migrating other surfaces to `useSession()` is opportunistic, not required.
2. **Build the `<Toast>` host + toast lib** (small, unblocks error/success feedback everywhere).
3. **Wire 3–5 modals** from surface 33 to actual triggers (Confirm Delete, Commit Character, Re-seed Cert, Break Attunement, Pass Leadership).
4. **Wire Sheet skill clicks → /api/sim/roll** (fast, satisfying, demonstrates the live engine reach).
5. **Build `/api/admin/tick`** + trigger button somewhere (Calendar surface) to populate weather + clockwork events.
6. **Seed canonical Faerûn factions + a few NPCs** so live strips have data.
7. ✅ **DONE 2026-04-29** — covered by #1 above (auth gating bundled in).
8. **Modal extraction**: factor `Modals.tsx` variants into `src/components/design/modals/*.tsx` callable from anywhere.
9. **Cross-surface navigation links** (Settlement → Markets, NPC → Roster, etc.) using `#<surface>?<key>=<value>`. Note: `campaignId` already comes through `useSession()` for any consumer that wants to deep-link.
10. **Surface 26 Dungeon encounter builder** — the AI ↔ JSON ↔ grid pipeline. Now unblocked: types, primitives, textures, tokens all exist.

Each one is small individually. Together they take the app from "wireframe with live strips" to "navigable testable session."
