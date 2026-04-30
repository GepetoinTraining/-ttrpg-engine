---
name: Cert hierarchy — account cert + character cert + dual-signed receipts
description: The new cert model Pedro confirmed 2026-04-30. Account cert is topology-derived from (serverNow, playerGeo). Character cert is the same math at chargen time. Receipts in-world are signed by (currentOwnerAccountCert × characterCert). One active character at a time. Trades are 2-step. No emails, no passwords, ever.
type: project
originSessionId: c4678600-677f-44e4-a8bd-70ec4da04141
---
**Confirmed 2026-04-30.** This replaces the current single-cert / invite-only model entirely. No migration — wipe + reseed when build is ready.

## The math is already built

Both cert types use the SAME existing primitive: [`createSeedData(datetime, geo)`](file:///D:/-ttrpg-engine/src/auth/seed.ts) → `{ seed, primes, zeta }`. The pipeline `createSeedNumber → primeFactorize → computeSeededZeta` is browser-safe pure math (no DB). The current `requestEnrollment` / `approveEnrollment` already captures geo + datetime — we just stop calling it "enrollment" and call it `createAccount`, then run the SAME function a second time at chargen.

## Cert types

| Cert | Seed input | Lifetime | Stored where |
|---|---|---|---|
| Account cert | `(serverNow, playerGeo)` at landing | Permanent identity | IDB (browser) + `accounts` row (server) |
| Character cert | `(serverNow, playerGeo)` at chargen | Permanent character | IDB + `character_certs` row |

## Cert payloads

**Account cert** carries a `characterCreatedLog: [{ characterId, characterSeed, createdAt }]` — append-only origin record. This survives trades; it always shows who *minted* a character even if they no longer command it.

**Character cert** carries `ownerChain: [accountId₁, accountId₂, …]` — the last entry is the current commander. Prepend on accept of a trade.

## Dual signatures are forensic, not gating

Every in-world receipt carries **both** signatures (current-owner account cert AND character cert) — but the validator does NOT check them on the happy path. Pedro's rule (2026-04-30):

> "only when the math diverges, never when it agrees. if it agrees we don't care about the actual cert that signed the receipt. if it diverges we care — that's a person who messed with their local client."

**The math is the gate.** The .mf forward pass is deterministic — same input + same `(zeta, n)` = same output + same receipt. If the math agrees across the chain, the cert chain is provably consistent and we don't need to spend cycles re-verifying signatures. Compute isn't something we splurge on.

**Signatures are the forensic tool.** They're attached to every receipt, but only inspected when:
1. A divergence is detected (client A's view of `.tpb` head ≠ server's, or peer audits expose a mismatch)
2. A trade dispute (was this `characterTransfer` actually signed by both parties?)
3. Periodic / on-demand audit walks the receipt chain and checks the math

In any of those cases, the dual-sig pinpoints the bad actor: stolen character cert without account cert can't have signed a valid receipt; tampered client produces signatures that don't match the trajectory math.

**Routing-pass implication:** `/api/world/append` does NOT verify signatures per receipt. It does:
- Zod parse the action payload
- Coherence check (`atDay`, `partyMustBeAt`)
- Atomic insert (signatures stored as audit data alongside the action)
- Spectrum emit

Forensic verification is a separate path: `/api/world/audit?fromDay=...&toDay=...` (later), which replays the math and checks signatures only at the divergence point.

Why this works:
- A stolen character cert without the matching account cert produces signatures that won't verify — but only if anyone checks. As long as math agrees, no one bothers.
- The original creator (recorded in `account.characterCreatedLog`) can't impersonate the current commander — their signature wouldn't match the current `ownerChain` head, and that mismatch surfaces only on audit.
- Trade integrity is provable when needed (initiate + accept signatures recorded), not enforced on every action.
- Determinism and cheap math wins; cryptographic verification is the exception path, not the rule.

## Trade (2-step)

1. **Initiate**: current owner signs `{ characterId, fromAccountId, toAccountId, ts }` with their account cert. Server records pending trade.
2. **Accept**: receiver signs `{ characterId, fromAccountId, toAccountId, ts }` with their account cert. Server validates both signatures match the respective `accounts.zeta` values, then:
   - Append to `character_certs.ownerChain` → `[…existing, toAccountId]`
   - Append a `characterReceived` log entry on receiver's account cert
   - Emit a `tpb_entries` row of type `characterTransfer`

No race condition — the character is bound to ONE active session per browser, so you can't accidentally trade an in-use character.

## One active character at a time (per browser session)

Signing-chain unambiguity. If two characters were active simultaneously, every receipt would need to know WHICH dual-sig to apply. One-at-a-time keeps `(activeAccountCert, activeCharacterCert)` deterministic.

If a player wants multiple characters in one party (e.g., NPC followers they fully control), those go through `mm-followers.ts` and inherit the controlling character's signing chain — they're not separate certs.

## Client-side TPB + flywheel slot pattern (the cheap-compute trick)

Pedro's framing (2026-04-30):
> "what makes this cheap to run is the fact that nothing that hasn't been interacted with doesn't really exist. it only exists when a player interacts and changes the view. think of a tree: on world creation the tree is there, character sees it rendered, but it's there for everyone at every time it's observed — there's nothing really to do server side besides trust the seed. if a character interacts with the tree and cuts it down, we need to register the delta of that chunk."

**The rule**: world content is a deterministic projection from the seed. Until a player **changes** state, the server stores nothing about that content. The tree exists because every observer can derive it from the seed; it doesn't need a row anywhere.

**What gets stored where:**
- **Character interaction log + skill scaling + level-ups** → IDB on the player's browser. This is THEIR `.tpb`, local to their cert chain.
- **World state deltas** (felled tree, looted chest, NPC reaction shift, κ writes) → these get **batched into a flywheel slot** on the player's browser, then **pushed to the server periodically**. The server has a per-cert "slot" that the client writes to.
- **Server canonical ledger** = an **hourly job** sweeps all flywheel slots, drains them in arrival order, writes that order into `tpb_entries`. The arrival order IS the canonical sequence — no clock arbitration, no merge logic.

This is the railgun flywheel from `docs/railgun-bridge.md` made concrete: each player cert has an orbit (slot); the rotation tick (hourly job) sweeps and emits to the spectrum (`tpb_entries`); the audit chain (hash-chained spectrum) survives.

**Implication for the routing pass**: `/api/world/append` isn't a sync-write per action. It's a **slot push** — client batches `WorldTPBAction[]` locally, calls `POST /api/world/slot/push` when ready (or when a forced sync is needed for cross-player state). The hourly job is the actual canonical-write moment. Real-time spectrum delivery to other connected clients still happens via the railgun bridge, but the durable record is hourly.

## DM-as-shard-host (party push timing differs)

Pedro's clarification (2026-04-30):
> "for a party we'll make the DM's computer 'host' the server math, they'll take over for the server, and the DM cert will sign the party table tpb. it'll land somewhere in the past of the server time every time, and that's okay — that's literally worldline theory from Pratchett (Long Earth...) or any other quantum information theory available. for DM parties don't push the tpb hourly... simply wait for session end, or session pause."

**Two push regimes coexist:**

1. **Solo / dmless push** (hourly cron-drained slot)
   - Player's client batches actions into `flywheelSlot` IDB store
   - Client posts `POST /api/world/slot/push` periodically (or when forced — e.g. cross-cert state visibility needed)
   - Hourly cron drains `flywheel_slots` table → writes to `tpb_entries` in arrival order
   - Suitable for: dmless characters (server-time bound), solo-AI characters between AI turns, cross-cert observation pings

2. **DM-hosted session push** (session-end / session-pause)
   - During a session, the **DM's computer acts as the shard host** — it runs all the engine math for the party in-process
   - Players in the party send their action intents to the DM's client (peer-to-peer via spectrum or direct), DM's client computes resolutions, all party state stays in the DM's local TPB during the session
   - The whole session's TPB is **signed by the DM cert** (as the shard authority for that timeline)
   - **Push happens at session end OR session pause** — one large bundle: `POST /api/world/slot/push { dmCertId, sessionId, actions[], receipts[], dmSignature }`
   - The bundle lands "in the past" of server time (in-world hours/days happen during a 4-hour real-time session) — that's **expected**, the .tpb is append-only and absorbs out-of-order timestamps naturally

**Why this works (worldline reconciliation):**
- Multiple parties play simultaneously, each on their own DM-hosted timeline shard
- Each shard produces a coherent .tpb chunk during the session
- Canonical server is the convergence point — eventual consistency absorbs all shards
- Hourly cron drains everything into one ordered ledger; sessions get drained at-end
- The DM cert signature on the bundle is the audit anchor: "this entire chunk came from a real DM-hosted session, not a tampered client"

**Cert-level implication:** the dual-sig rule (account cert × character cert) still applies to individual receipts inside the bundle, but the BUNDLE itself carries an additional outer signature (DM cert). On audit, the outer DM-sig validates the shard authority; per-receipt sigs only get checked on internal divergence.

**Routing-pass implication:** `/api/world/slot/push` accepts BOTH shapes:
- Solo: `{ characterCertId, atDay, actions[], receipts[] }`
- DM session bundle: `{ dmCertId, sessionId, atDay (start), endDay, actions[], receipts[], dmSignature }`

Cron drain treats both identically — they're just rows in `flywheel_slots` waiting to be sequenced.

## Persona is baked into the character cert at creation

Pedro's clarification (2026-04-30, refining the earlier "DM is a lens" rule):
> "this is tied to the character. a DMless character is DMless. I think we chose to not allow it to party up later... because they can't fast travel — they're alive at servertime. DMless character cannot join a DM party."

**Persona is per-character, not per-session and not per-account.** When the character cert is minted at chargen, the player picks one of `player | dm | gm-ai | dmless`, and that **fixes the persona on that character cert forever**. It's a property of the character, not a runtime toggle.

What persona means at the math level:
- `player` — has a human DM. Lives in **session time** (DM controls advancement: "skip to dawn", transport, etc.).
- `dm` — looks at the world as god. Lives in session time. Their "character" IS the table they run.
- `gm-ai` — solo player with AI as DM. Lives in session time.
- `dmless` — pure clockwork solo. Lives in **server time** (no DM, no session — autonomous world ticks ARE the timeline).

**Time flow is the load-bearing distinction**: session-time personas (`player`, `dm`, `gm-ai`) can fast-forward arbitrarily because their DM has authority over advancement. `dmless` can't — they're bound to the cron tick.

**Party compatibility (Pedro confirmed at minimum):**
- `dmless` ✗ DM-led party — different time flows, can't reconcile (DM party fast-travels, DMless can't follow)
- Other compatibility rules TBD when party logic ships. Likely: one DM per party, DMless only parties with DMless.

What this means for the build:
- `characterCerts` IDB store gets a `personaType: 'player' | 'dm' | 'gm-ai' | 'dmless'` column
- `character_certs` server table gets `persona_type` column
- Chargen UI lets the player pick persona — but only at character creation, never afterward
- The existing `Persona = { type, characterId }` in `src/lib/persona.ts` is **derived** from the active character's cert, not stored separately. Switching personas = switching characters.
- `ConfigMenu`'s persona picker UI is replaced by character picker; persona surfaces as a label on each character card.

What this kills:
- The user-toggleable persona switch in `ConfigMenu`
- The `personaType` field I had proposed on `sessionState` (it's derived, not stored)
- Any "DM mode" runtime flag on the account cert

## Parties via cert hash

> "give people the possibility to invite to a group using the actual hash of the cert. we group the cert hashes and sync their state."

A party is just a **set of character cert hashes**. Group formation:
1. Player A shares their character cert hash (URL, QR, copy/paste — small string)
2. Player B's client adds A's hash to its `partyMembers` IDB store
3. When both clients have the same set of hashes in `partyMembers`, they're party-synced
4. Their flywheel slots feed into a shared spectrum subscription so each party member sees the others' state changes in near-real-time

Server's role: maintain a `parties` table that's just `{ partyId, memberCertHashes[] }`. Spectrum dispatcher reads it to fan out envelopes. No central coordinator beyond that.

This means **parties are peer-to-peer at the cert level**, with the server as a fan-out router. The same "cert hash sharing" pattern can later cover guilds, factions, alliances — anything that's "a set of certs that synchronize."

## IndexedDB schema (`db: claudedm`)

```ts
accounts: {
  id: string             // UUID
  seed: string           // numeric seed
  primes: string[]
  zeta: number
  geoLat: number
  geoLon: number
  createdAt: string      // ISO datetime — server-provided
  characterCreatedLog: { characterId, seed, createdAt }[]
}                        // typically 1 row per browser

characterCerts: {
  id: string             // UUID
  seed: string
  primes: string[]
  zeta: number
  geoLat: number
  geoLon: number
  createdAt: string
  ownerChain: string[]   // accountIds, last is current commander
  characterDataId: string // FK to local character data record
  personaType: 'player' | 'dm' | 'gm-ai' | 'dmless'  // FIXED at creation
}

characterTpb: {            // per-character interaction log, fully local
  id: string               // auto-increment
  characterId: string      // index
  worldDay: number
  action: WorldTPBAction   // matches engine/tpb-world.ts shape
  receipts: Receipt[]      // dual-sig stored as audit; never verified on happy path
  ts: number
}

flywheelSlot: {            // pending push queue for world-state deltas
  id: string               // auto-increment
  characterId: string
  action: WorldTPBAction
  receipts: Receipt[]
  queuedAt: number
  pushedAt: number | null  // null until POST /api/world/slot/push succeeds
}

partyMembers: {            // cert hashes the player is grouped with
  certHash: string         // index — the character cert id of a party member
  alias: string | null     // human-readable name they shared
  joinedAt: number
}

sessionState: {
  activeAccountId: string | null
  activeCharacterId: string | null   // persona is derived from this character's cert
  lastWorldDay: number
  // ...UI ephemera
}

tradeLog: {
  characterId, fromAccountId, toAccountId
  initiatedAt, acceptedAt | null
  initiateSig, acceptSig | null
  status: 'pending' | 'accepted' | 'cancelled'
}
```

## Server schema reshape (no migration — wipe + reseed)

- `users` table → rename to `accounts`. Add `character_created_log` JSON column (array of `{ characterId, seed, createdAt }`).
- New `character_certs` table: `id, account_id (current owner), seed, primes_json, zeta, geo_lat, geo_lon, created_at, owner_chain_json, character_data_id, persona_type ('player' | 'dm' | 'gm-ai' | 'dmless')`.
- Existing `characters` table: stays for character DATA (sheet, hp, etc.), gains an FK to `character_certs.id`.
- New `character_trades` table for 2-step trade state.
- New `flywheel_slots` table: `id, account_id, character_id, action_json, receipts_json, queued_at, processed_at`. The hourly canonical-write job drains by `queued_at ASC`, copies into `tpb_entries`, sets `processed_at`.
- New `parties` table: `{ id, member_cert_hashes_json, created_at }`. Just the membership list; everything else flows through spectrum.
- `tpb_entries`: add `characterTransfer` action variant.

## UX flow (3 phases)

1. **Landing** (no certs in IDB) → `CreateAccount` → asks for geolocation permission → calls `/api/account/create` with `{ geo }` → server timestamps + runs `createSeedData` → returns account cert → IDB writes → routes to character select.
2. **CharacterSelect** (account cert in IDB, no active character) → lists owned characters from IDB (server reconcile) → "Create new" runs chargen + `/api/character-cert/create` (server timestamps + runs `createSeedData` again) → "Log into world" sets `sessionState.activeCharacterId` → routes to dashboard.
3. **WorldDashboard** (both certs active) → all in-world surfaces. Sidebar/drawers/action bar/viewport. Every action POSTs to `/api/world/append` with dual signatures.

## Phase 1 build order (after Pedro's greenlight)

1. Schema reshape (`accounts`, `character_certs`, `character_trades`, ownerChain on tpb-world action union)
2. IDB layer (`src/lib/idb.ts`, `src/lib/account-cert.ts`, `src/lib/character-cert.ts`)
3. `/api/account/create` route (replaces `/api/auth/enroll/*`)
4. `/api/character-cert/create` route (called by chargen)
5. `Landing.tsx` + `CreateAccount.tsx` (replace Auth.tsx's uninvited state)
6. `CharacterSelect.tsx` (new)
7. Wire dual-signature into `/api/world/append` validator (this is the crossover with the routing pass)
8. Trade endpoints `/api/character/trade/{initiate,accept}` (later — not gating play)

## Things this kills

- Email + password (decoy or otherwise)
- Invite tokens (`?invite=...`) — replaced by self-serve geo-bootstrap
- The whole "uninvited / pending / unlocked / mismatch" state machine in `Auth.tsx` (replace with simpler "no cert / has account / has character / in world")
- Single-cert assumption everywhere — every receipt-emitting code path needs the dual-sig

## Things this preserves

- All the topology auth math (`prime.ts`, `phi.ts`, `matrix.ts`, `computeTrajectory`)
- The receipt-as-side-effect pattern from `mfDice` and friends
- The `.tpb` append-only log
- Observation-driven persistence rule (still applies; just every observation now has 2 signatures)
