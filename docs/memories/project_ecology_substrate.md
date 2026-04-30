---
name: Ecology substrate (biome→fauna→adaptation→monster→sprite) — landed
description: Foundation layer beneath L5. Wires biome.ts/regionFeatures.ts into engine, adds the adaptation evolution engine, the lifecycle orchestrator, and a procedural blob sprite generator. Read before starting MM wraps for L5.
type: project
originSessionId: 52de7968-e736-4f04-8243-4b79fbcaf509
---
**This is the substrate L5 sits on.** Before the user pivoted, the plan was to wrap dungeon-gate / monster-actor / guild as MMs directly. The substrate landed instead — those entities now derive species + CR + adaptations from biome geology rather than caller-provided strings.

## What landed (74 files / 1704 tests / TS clean)

### New modules

| File | Role |
|---|---|
| `engine/adaptation.ts` | 10 mutation pool (ARMORED/SWIFT/PACK/REGEN/STEALTH/REFLECT/DRAIN/SPLIT/ADAPT/CUNNING). `createAdaptationPool`, `selectAdaptations`, `reportClear`, `evolvePool`, `combineModifiers` (CR / troops / DC / dangerRadius / behavior tags). |
| `engine/biome-fauna.ts` | Bridge to `src/game/biome.ts` + `src/game/regionFeatures.ts`. Master `SPECIES_TABLE` (28 species, 5 kingdoms — humanoid/beast/undead/planar/aberrant). D&D 6 sizes (Tiny/Small/Medium/Large/Huge/Gargantuan). `BIOME_GATE_SPECIES` (11 biomes × 4 gate types). `selectMonsterSpecies(worldSeed, q, r, gateType, d20)`, `deriveBaseCR`, `crToMobSize`. Owns `Temperament` + `MobObjective` enums. |
| `engine/ecology-pool.ts` | Region-scope adaptation pool storage via `κ.ecology.adaptations[speciesId]`. `getAdaptationPool`, `writeAdaptationPool`, `regionForNode` (walk up parent chain), `ecologyAt(tp, worldSeed, q, r, nodeId) → { biome, faunaPool, regionNodeId, getAdaptations, selectSpecies }`. |
| `engine/mob-ai.ts` | Turn-based decision function ported from real-time MobAI. `decideMobIntent(behavior, ctx, d20) → { action, targetId?, targetPos? }`. 11 behavior primitives (IDLE/APPROACH/FLEE/STRAFE/FLANK/ATTACK_MELEE/ATTACK_RANGED/BLOCK/PHASE/SACRIFICE/SPAWN). Adaptation tags modulate (CUNNING → low-HP target + flank, STEALTH → ambush, PACK → gang up, DRAIN → prefer melee, no_flee → ignore morale). `resolveDeathSpawn` for SPLIT minions. |
| `engine/gate-lifecycle.ts` | The orchestrator that wires clear→pool feedback→respawn. `clearGateWithEcology` (attempts clear + on success reportClear + write pool). `tickGateWithEcology` (tickDungeonGate + on respawn evolve+select+apply mods+write pool). `spawnMonsterActorWithEcology` (creates actor + auto-persists evolved pool — handles migration to a different region cleanly). |
| `src/lib/sprite/generator.ts` | Browser-canvas blob sprite. `buildSpriteSpec` (pure, testable) + `renderSpriteToDataURL` (browser only). 8-direction sheet. 10 adaptation overlays (armor_band, motion_trails, satellites, regen_halo, stealth_dim, reflect_sheen, drain_tendrils, split_crack, adapt_shimmer, cunning_eyes). |

### Edits to existing files
- `engine/tp.ts` — `EcologyRulesSchema.adaptations` extended for region-scope pool persistence.
- `engine/dungeon-gate.ts` — `DungeonGate.adaptations: Adaptation[]` field. `createDungeonGateFromEcology(input)` factory using ecology-pool. Existing `createDungeonGate` signature untouched.
- `engine/monster-actor.ts` — `adaptations: string[]` → `Adaptation[]`. `applyAdaptationsToActor` mutator. `createMonsterActorFromEcology` factory. Existing `createMonsterActor` signature untouched.

## Architecture

```
src/game/biome.ts (q,r → BiomeType from noise)
src/game/regionFeatures.ts (biome → fauna pool with abundance/danger)
                  ↓
engine/biome-fauna.ts (species table + biome×gateType candidates + CR/size derive)
                  ↓
engine/ecology-pool.ts (κ.ecology.adaptations region-scoped reads/writes)
                  ↓                              ↓
engine/adaptation.ts (pool, fitness, evolve, modifiers)
                  ↓                              ↓
engine/dungeon-gate.ts          engine/monster-actor.ts
  createDungeonGateFromEcology   createMonsterActorFromEcology
                  ↓                              ↓
engine/gate-lifecycle.ts (the orchestrator — clear, tick/respawn, monster spawn — handles ALL κ writes)
                  ↓
engine/mob-ai.ts (per-turn decision; decideMobIntent reads adaptations.behaviorTags)
                  ↓
src/lib/sprite/generator.ts (visual realization with adaptation overlays)
```

## Persistence design (matches `feedback_observation_writes.md`)

- Pool state in `κ.ecology.adaptations[speciesId]` at the region node.
- Reads use κ inheritance (any child node sees the region's pool).
- Writes are observation-driven: `clearGateWithEcology` writes only on player-initiated clear; `tickGateWithEcology` writes only on respawn (state transition `capped → active`). Regular ticks (spawn/overflow) accumulate in-memory and write nothing.
- Migration spawning (monster-actor moves to a new region) reads the DESTINATION region's pool — Sword Coast goblins evolve differently than Cormyr goblins.

## Lifecycle flow (verified by tests)

```
1. createDungeonGateFromEcology({ ..., pool, generation: 0 })
   → evolves pool → draws adaptations → applies troopMultiplier to spawnRate

2. clearGateWithEcology(...) — players clear
   → attemptClearGate → on success reportClear with gate.adaptations + casualties
   → writeAdaptationPool to region

3. tickGateWithEcology(...) every week — most ticks no-op the pool
   → on respawn (state capped→active): evolvePool → selectAdaptations → apply mods → write

4. spawnMonsterActorWithEcology(...) — emerges from gate or migrates
   → reads region pool → createMonsterActorFromEcology → writes evolved pool

After 4 cycles at tier 5: gate.adaptations.length = 3 (max), pool.generation = 5.
```

## What's left for L5 proper (the MM wraps)

Per `project_build_log_v2`:

| Module | Substrate-ready? | MM wrapper to write |
|---|---|---|
| `monster-actor.ts` | ✓ has `createMonsterActorFromEcology`; gate-lifecycle has `spawnMonsterActorWithEcology` | ⏳ MMMonsterActor (per-camp, monthly, layer 5). Folds `tickMonsterAdvancement`. |
| `dungeon-gate.ts` | ✓ has `createDungeonGateFromEcology`; `clearGateWithEcology` + `tickGateWithEcology` are the canonical entry points now | ⏳ MMDungeonGate (per-gate, weekly, layer 5). Wraps `tickGateWithEcology`. |
| `guild.ts` | ⚠ no substrate dep — guild doesn't need biome flora; it's the connector | ⏳ MMGuild (per-chapter, weekly, layer 5). Folds `tickGuildChapter`. The connector — needs `factionOwnerId` field added to Guild, and `digestCaravanArrival` hook for caravan-borne intel/rumors. |
| `mob-ai.ts` | ✓ standalone & tested | ⏳ Wire into `mm-scene.ts` combat round (call `decideMobIntent` per NPC turn). |

Other L5/post-L5 work in the build log v2:
- L6 remaining (npc-agenda, entertainment, lore-MM, services, religion-MM, narrative-MM)
- Wave 3 — player tree bridge (`mm-adventure.ts` → take Clockwork ref)
- Wave 4 — full persistence bridge (TP hydration on boot + `mm_states` + `tpb_entries`)

## Things to know before touching

- κ.ecology was already in `INHERITABLE_DOMAINS` — the adaptation extension piggybacks on existing inheritance.
- Pre-existing TS errors in `local-actor.test.ts` and `settlement.test.ts` are not from this substrate work; they're partial-object fixtures vitest accepts at runtime.
- `regionForNode` walks up parent chain looking for `type==='region'`, falling back to kingdom/continent/planet. If you put adaptation pools in a graph without a 'region' node, set the parent-walk fallback expectations accordingly.
- The blob sprite generator returns null without DOM — by design. Don't try to render in vitest unless you set up jsdom.

## Test count delta

Before substrate: 67 files / 1569 tests
After substrate:  74 files / 1704 tests (+7 files, +135 tests, 0 regressions)

New test files:
- `engine/__tests__/adaptation.test.ts` (30)
- `engine/__tests__/biome-fauna.test.ts` (30)
- `engine/__tests__/ecology-pool.test.ts` (15)
- `engine/__tests__/mob-ai.test.ts` (23)
- `engine/__tests__/ecology-substrate.test.ts` (9)
- `engine/__tests__/gate-lifecycle.test.ts` (10)
- `src/lib/sprite/generator.test.ts` (18)
