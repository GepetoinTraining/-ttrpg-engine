---
name: Tier 1 wiring complete (Auth · Onboarding · Chargen · Sheet · Combat)
description: All five Tier-1 surfaces wired end-to-end on 2026-04-29. Route handlers + browser libs + live surfaces. Smoke-tested against local.db.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
Pattern: thin Next.js route handler → browser lib (`src/lib/*.ts`) → surface. Each surface uses real DB writes/reads + engine math. Persistence-bridge-first path was the choice (vs sandbox-first); only Combat keeps in-memory state for the card pile (no scene table yet).

**Endpoints (all under `src/app/api/`):**
- `auth/enroll/request` · `auth/enroll/approve` · `auth/challenge` · `auth/verify` — wraps `src/auth/{enroll,verify,seed}.ts`
- `campaign/create` (parties + adventures + campaigns + play_mode_configs + simulation_depth + gm_profile_overrides)
- `campaign/[id]/invite` (wraps `requestEnrollment`, returns invite-token; URL builder lives in `src/lib/campaign.ts`)
- `character/create` (characters + character_classes + character_abilities + character_saves + optional players row)
- `character/[id]` GET (returns sheet derivation: scores, modifiers, saves with prof bonus, all 18 skills, AC, init)
- `character/list` GET
- `sim/roll` (wraps `engine/mf-dice.ts`, writes `dice_receipts` row)

**Browser libs:**
- `src/lib/auth.ts` — cert in localStorage `claudedm:cert`; `redeemInvite`, `authenticate`, `computeTrajectory` from `src/auth/math/matrix.ts` (browser-safe pure math)
- `src/lib/campaign.ts` — `createCampaign`, `inviteToCampaign`, `buildInviteUrl`, `captureGeo` (navigator.geolocation, falls back to `{0,0}`)
- `src/lib/character.ts` — `createCharacter`, `loadCharacterSheet`, `listCharacters`, `setActiveCharacter` / `getActiveCharacter` in localStorage `claudedm:active-character[:cid]`
- `src/lib/dice.ts` — `rollDice` wrapper

**Wired surfaces:**
- 01 Auth — URL `?invite=TOKEN` → redeem → cert saved → unlocked. Cert in storage → challenge/verify roundtrip. Chips become preview override with "return to live" link. PasteTokenDialog accepts URL or raw token.
- 12 Onboarding — DM flow captures geo on mount, `createCampaign` writes 5 tables, then per-seat `inviteToCampaign` produces sharable URLs (`?invite=TOKEN&campaign=CID`). Player flow reads campaign from URL, saves prefs to `claudedm:player-prefs:CID`, navigates to chargen.
- 13 Chargen — draft state lifted to top; race click + class click + ability +/- update `draft`; CharPreview renders from draft (live HP, AC, mods); Review POSTs to `character/create` and stores active character id.
- 14 Sheet — loads via `/api/character/:id`, renders abilities / saves / skills / combat block from server-derived data. Empty state shows character picker via `/api/character/list`. Bottom panels (Actions / Spells / Inventory / Features / Notes) still wireframe.
- 15 Combat — added `LiveRollWidget` at top: clickable buttons fire d20 / attack vs DC / DEX save / damage / sneak attack via `/api/sim/roll` → `mfDice` → `dice_receipts`. Uses real `Die.tsx` for visual. Receipts include natural20/1, verified flag, persisted id. Card piles below remain wireframe (no scene/scene_card table writes yet).

**Smoke-test results saved to local.db:**
- Multiple test campaigns (Sunset Vault Heist), invitation tokens, characters (Kaelith Vex, Elena Brightwood), users, dice receipts. Schema migrations were already run; all tables existed.

**Why:** User asked to wire Tier-1 with Tier-2 design in flight. Persistence-first proves the bridge works on real surfaces; future tiers (NPC roster, scene editor, market) can reuse the route-handler/browser-lib/wired-surface pattern.

**How to apply / gotchas:**
- The 5e math (proficiency bonus by level, skill→ability map, racial bonuses) lives in `/api/character/[id]/route.ts`. If/when `engine/mm-character.ts` becomes hydratable from DB, the route can call it instead of hand-rolling.
- `parties.adventureId` has no FK constraint, so the insert order (parties first with placeholder adventureId, then adventures, then campaigns) works without circular issues.
- `approveEnrollment` is not admin-gated; the token is the proof. Anyone with the URL can redeem.
- `next dev` lock corruption: if build is killed mid-compile, `rm -rf .next` and restart.
- TS strict + 'use client' + Babel-style JSX: every wired surface keeps `// @ts-nocheck` as line 1. Live state hooks added INSIDE the existing wireframe; visual structure mostly preserved.
- Tests not yet written. Smoke tests were curl + sqlite inspection.

**What's NOT wired (Tier 2+ candidates that the user has design coming for):**
- Settlement detail (mm-settlement.ts has rich sim, no DB hydration)
- NPC roster / agendas (mm-npc + npc-agenda + knowledge-pool not wired)
- Scene card editor (mm-session.ts contingencies + mutations not authored)
- Session recap / TPB browser (tpb.ts append-only, no UI)
- Economy / market dashboard (market.ts ticks but no surface)
- Faction reputation matrix per PC
- World calendar / time scrubber (clockwork.ts cadences not exposed)
- Magic / spell prep / casting (magic.ts, character spells)
- Combat *runner* proper (cards in piles are still UI-state-only; no scene/scene_card writes)
- The static-vs-procedural-Faerûn question — user said Blender connector is the future answer, deferred.
