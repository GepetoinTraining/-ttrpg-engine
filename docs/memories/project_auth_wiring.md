---
name: Auth wiring (Tier 1, surface 01)
description: First wired surface. /api/auth/* route handlers + browser cert client + lifecycle in Auth.tsx. Smoke-tested end-to-end against local.db.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
First Tier-1 surface wired to live state on 2026-04-29. Pattern proven; reuse for the remaining Tier-1 surfaces (Onboarding, Chargen, Sheet, Combat).

**Files:**
- `src/app/api/auth/{enroll/request,enroll/approve,challenge,verify}/route.ts` — thin Next.js handlers wrapping `requestEnrollment` / `approveEnrollment` / `generateChallenge` / `verifyChallenge`.
- `src/lib/auth.ts` — browser-side: `loadCert / saveCert / clearCert` (localStorage `claudedm:cert`), `redeemInvite`, `authenticate`, plus typed wrappers around the four endpoints. Imports `computeTrajectory` from `@/auth/math/matrix` so the client uses the same fingerprint format as the server.
- `src/components/design/surfaces/Auth.tsx` — replaced the chip state-picker with a real lifecycle: URL `?invite=TOKEN` → redeem; cert in storage → challenge/verify; otherwise → uninvited. Chips now drive a *preview* state with a "return to live" link.

**Smoke-test result (live):** request → token; approve → `{id, seed, zeta=0.606…}`; challenge → `{challengeId, n}`. Verify completes client-side via `computeTrajectory(cert.zeta, n)`.

**Why:** Auth had the smallest viable bridge — server functions were already prod-ready, no MM hydration, no upstream deps. Validated the pattern of (route handler → browser client → wired surface) before tackling Onboarding which writes campaigns + invites players.

**How to apply / gotchas:**
- The math chain (`prime.ts`, `phi.ts`, `matrix.ts`) is browser-safe — pure math, no node imports. `enroll.ts` / `verify.ts` / `seed.ts` import from `@/db/connection` so they're server-only.
- `approveEnrollment` is *not* gated by admin auth — the design treats the token itself as the proof (only the DM has it before sending to the player). When the player opens `?invite=TOKEN`, the call succeeds.
- Turbopack `.next/dev/lock` corruption can happen if a dev process is killed mid-compile. Fix: `rm -rf .next` and restart.
- No tests yet for the API routes. Smoke-test was via curl.
- `geo` is required at request time; surface for capturing it (`navigator.geolocation`) belongs in Onboarding-DM, not Auth.
