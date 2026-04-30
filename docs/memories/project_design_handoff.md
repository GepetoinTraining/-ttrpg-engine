---
name: Claude Design DM Helper handoff
description: 11-surface design for the centaur DM frontend; ported into the Next.js app on 2026-04-29.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
The user worked with **Claude Design** (claude.ai/design) to mock up the frontend before code. The handoff bundle was at `https://api.anthropic.com/v1/design/h/4JSt1kqA9B4kAv8eUNeNpA` (gzipped tar; cached locally during the session under `tool-results/`). The chat transcript inside the bundle is the source of truth for intent — read it before changing surface shapes.

**What's in the bundle / what got ported:**
- Aesthetic: dashboard bones + handwritten/serifed paper. Crimson Pro (serif), Caveat (hand), JetBrains Mono.
- 11 surfaces (numbered 00–11), all live at `src/components/design/surfaces/`:
  - 00 Sitemap, 02 DMConsole, 03 Player, 04 Cards, 05 Group, 06 Villain (Faerûn CTF map), 07 Table, 08 Locations (Holdings/Downtime), 09 Rumors, 10 Oneshot (Solo with Claude BETA), 11 InlineCards (6 chat card primitives).
- 3D dice (`Die.tsx`) — Three.js polyhedral with face-slerp tumble + 3/4 tilt camera, originally lifted from the Crag & Coin design project. Used in InlineCards' dice prompt and Oneshot's dice tray.
- Tweaks panel — role switcher, density (compact/regular/comfy), hand-annotation toggle, surface jump buttons. Reachable from the floating ⚙ button bottom-right.

**Why:** Mocked up over two iterations (initial 7 surfaces, then locations/rumors/oneshot, then dice + inline cards). The user landed on this shape; we're now implementing it for real.

**How to apply:**
- Surfaces are static design layouts — no engine wiring yet. Live data is the next pass and depends on the persistence-gap work.
- Routing is hash-based (`/#dm`, `/#oneshot`) inside a single page, matching the prototype. If we need real per-surface routes for SSR/links, that's a refactor.
- Bulk-ported JS surfaces are marked `// @ts-nocheck` (Cards, DMConsole, Group, Locations, Player, Rumors, Table, Villain, InlineCards, Oneshot). Die.tsx, Sitemap.tsx, DMHelperApp.tsx, TweaksPanel.tsx have proper TypeScript.
- Style system lives entirely in `src/app/globals.css` (verbatim port of the prototype's `styles.css`). All paper/ink/accent CSS variables are defined at `:root`.
- The original prototype expected to run inside the design-tool iframe host (postMessage protocol for the tweaks panel). Dropped that — local state only. Floating ⚙ toggles the panel.
- Dropped the prototype's `window.X = X` global-export pattern; everything uses ES module imports.

**Open backlog from the design's own assistant feedback (worth pushing on with the user before changing):**
- Group view (05) — designer flagged the three voting/leader/intentions sketches as "not right yet"; needs a real conversation about how parties actually disagree.
- Worker-assignment flow on Locations (08) — drag PC into slot → pick action wasn't drawn.
- Rumor → action linking (09) — should confirming a rumor auto-spawn a downtime task on its location?
- One-shot canon merge review queue (10) — the DM's review surface is implied but not built.
