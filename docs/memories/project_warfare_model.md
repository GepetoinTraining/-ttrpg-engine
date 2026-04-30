---
name: Warfare model — siege resolver spec
description: User's spec for the siege/army system — d20 modifiers, health portions, front/back line resolution, real-time when players are present.
type: project
originSessionId: 92460290-3807-47be-aa30-110d925ae40a
---
User's spec for the siege resolver and army modeling, given 2026-04-29:

> siege resolver needs to be better mapped, basically we need geography, strategy, preparation, armaments, all of these different modifiers are add to the d20 rolls per turn. we also need to make the encounter itself, if there are players, to have a local node where they are and that one is real time, every 10 turns we need to make a war roll. we need to map armies courage and their health, every score (20+leader) is a health portion, when we do the rolls, resolve the front and fill from the back line... freshness... a lot to model there

**Decoded model:**
- Each war turn = a single d20 roll modified by:
  - **Geography** — terrain advantage/disadvantage
  - **Strategy** — chosen plan, formations, flanks
  - **Preparation** — siege engines built, supplies stockpiled, scouting done
  - **Armaments** — weapons / armor tier, magic items deployed
- **Army health** is bucketed into **portions**. Each portion absorbs damage equal to `20 + leader_bonus`. When a portion is destroyed, the front line collapses into the back line ("resolve the front and fill from the back line").
- **Courage** is a separate stat (probably a save-or-rout check after damage).
- **Freshness** — units fatigue with use, fresh reserves matter.
- **Player-present mode**: when PCs are present in a battle, a *local node* is created where the players are operating in real time. The wider war continues at slower cadence — **every 10 player-time turns triggers one war roll**.

**Implications for schema (future work):**
- `armies` already exists but is too thin. Need:
  - portions count + per-portion HP
  - leader bonus (probably refs an NPC or character)
  - courage / morale state
  - freshness (per portion, decays each turn used)
  - geography modifier (per battle)
  - active strategy, prep state, armament tier
  - frontIndex / backIndex pointers
- New `battles` table linking armies + battlefield + player-local-node + turn counter.
- `battle_turns` log: per-turn roll, modifiers applied, damage dealt, portions destroyed, freshness shifts.

**Implications for the Warfare surface (31):**
- Surface needs: army list (existing), battle resolver tab (new), turn-by-turn log (new), portion HP visualization (front line / back line / fresh reserves), modifier breakdown panel.
- Wiring this fully is a Phase 4+ effort. For Phase 3 wire: read-only `armies` table list + a "spec parked here" call-out pointing to this memory.

**Why:** User explicitly flagged this as "a lot to model there" in the same breath as scoping Phase 3. Saving the full spec so future-me can build it without re-asking.

**How to apply:**
- Don't try to wire siege resolution in Phase 3. Just list armies and surface that the resolver is parked.
- When the Warfare engine module + schema land, this memory has the full spec.
- The 10-turns-per-war-roll cadence is a *clockwork* mechanic — should plug into `engine/clockwork.ts` as a new cadence type once authored.
- The "local node" for player-present battles aligns with the "pocket manifold" pattern from CLAUDE.md (combat scenes spawn locally and collapse back). Reuse the same shape.
