# Codec — Client-Side Rolling Migration

> *"We don't tell the client how to roll the creature. We give them the dictionaries; their PC rolls every creature it sees. Server is silent unless it's checking what happened in-world."*
> — Pedro, 2026-05-06

This document is a note from past-me to future-me. I built the disc + mold + SDF pipeline by **hardcoding a goblin** so we could validate the architecture end-to-end. That hardcode is now technical debt with a known shape. Here's what to remove, what to replace it with, and the architectural contract the replacement has to honor.

---

## What's hardcoded today (and shouldn't be)

The architecture-violating bits are concentrated in three files. Everything else (`disc-codec.ts`, `disc-spec.ts`, `WedgeDisc.tsx`) is shared infrastructure that stays exactly as it is — those are the rules, not the content.

### 1. `src/components/scene-3d/Scene3D.tsx` — "the server told us about a goblin"

Currently calls `composeGoblin({...})` directly with hand-picked spec values:

```ts
const goblinTensor = useMemo(() => composeGoblin({
  level: 2, hpCurrent: 7, hpMax: 10, ac: 13, attackMod: 4,
  baseXpAwarded: 50, size: CreatureSizeIdx.Small, build,
  poseFamily, poseProgress: 0.4, ...
}), [poseFamily, build, size])
```

This is wrong because **the spec values aren't being rolled** — they're literal numbers I typed. In production, the client *rolls* this from `(worldSeed, entity_id, encounter_time, archetype)` against the game-rules dictionaries. The server never sends the spec.

**Replace with:** a `useRolledCreature(worldSeed, entityId, encounterTime, archetype)` hook that returns a `DiscTensor` deterministically. The hook reads the loaded game-rules dictionaries from a context, runs the deterministic roller, and returns the result.

### 2. `src/lib/mold/goblin-instance.ts` — `composeGoblin(spec)` is the encoder, not the roller

`composeGoblin` is correct and stays. It takes a designer-readable spec and writes the disc tensor.

What's wrong: nothing about the function itself. What's wrong is that **the only caller is hand-typing the spec.** The roller (a new module) should produce the spec from rolled values, then call `composeGoblin` to encode it.

**Add (don't replace):**
- `src/lib/roll/roll-monster.ts` — pure deterministic function: `(worldSeed, entityId, encounterTime, archetype, gameRules) → GoblinSpec` (or `MonsterSpec` more generally)
- The roller uses `SeededRNG` over `${worldSeed}:${entityId}:${encounterTime}` so two clients reading the same TPB event roll the *same* monster bit-for-bit
- Roller reads stat tables, equipment chances, palette options, etc. from `gameRules`
- Then `composeGoblin(rolledSpec)` produces the tensor — same code path, different input source

### 3. `src/components/scene-3d/EntitySDFMesh.tsx` — `composeGoblinField()` is the mold, hardcoded inline

```ts
function composeGoblinField(mc: MarchingCubes, entity: DecodedEntity): void {
  mc.reset()
  mc.isolation = 80
  mc.addBall(0.5, 0.85, 0.5, 0.55, 12)  // head
  mc.addBall(0.5, 0.73, 0.5, 0.30, 12)  // neck
  // ... 17 more balls hardcoded ...
}
```

This whole function is **the humanoid mold descriptor as code.** In production, mold descriptors are *data* (JSON-like blobs in the catalog) loaded from the CDN, cached in IndexedDB, and consumed by a generic mold evaluator.

**Replace with:**

a) A mold-descriptor schema (JSON) — see "The Mold Catalog" section below.

b) A generic `applyMoldToMarchingCubes(mc, descriptor, entityParams)` function that reads the descriptor and populates `mc.addBall(...)` calls accordingly. The descriptor includes the metaball positions + strengths + isolation, plus parameter bindings (e.g., `"strength_multiplier": "{entity.size}"` so the mold scales with the disc's SIZE slot).

c) Delete `composeGoblinField`. Move its contents into a JSON file as the *first entry* in the humanoid mold catalog.

---

## What client-side rolling needs (the new files)

```
src/lib/roll/
├── roll-monster.ts        # (worldSeed, entityId, time, archetype) → MonsterSpec
├── roll-npc.ts            # same pattern for NPCs
├── roll-item.ts           # same for items (loot drops)
├── roll-prng.ts           # SeededRNG-derived per-entity PRNG (deterministic)
└── README.md              # how rolling works

src/lib/catalog/
├── catalog-loader.ts      # fetch + IndexedDB cache the chunk's mold catalog
├── catalog-context.tsx    # React context providing the loaded catalog
├── mold-evaluator.ts      # apply mold descriptor → marching cubes
└── types.ts               # MoldDescriptor, GameRules, ArchetypeStatTable, etc.

src/lib/game-rules/
├── stat-tables.ts         # HP/AC/level scaling per archetype + tier
├── equipment-tables.ts    # equipment drop chances per archetype + level
├── palette-tables.ts      # color palettes per race/biome
└── encounter-tables.ts    # which archetypes spawn in which biomes
```

The shared `disc-spec.ts` + `disc-codec.ts` stay untouched. They're the interop contract.

---

## The roller's deterministic recipe

For ANY entity the player encounters:

```
input:
  worldSeed:       bigint                 (the world's identity)
  entityId:        string                 (deterministic from chunk + spawn slot)
  encounterTime:   number                 (worldDay when player first observed it)
  archetype:       MonsterArchetype       (looked up from biome via game rules)
  gameRules:       GameRules              (loaded dictionaries)

steps:
  1. rng = new SeededRNG(`${worldSeed}:${entityId}:${encounterTime}`)
  2. statTier  = gameRules.statTables[archetype][biomeTier]
  3. spec.level = rng.rangeInt(statTier.minLevel, statTier.maxLevel)
  4. spec.hpMax = computeHp(spec.level, statTier)  // pure formula, no rolls
  5. spec.hpCurrent = rng.rangeInt(Math.floor(spec.hpMax * 0.6), spec.hpMax)
  6. spec.ac = statTier.acByLevel[spec.level]
  7. spec.attackMod = statTier.atkByLevel[spec.level]
  8. spec.baseXpAwarded = computeXp(spec.level, archetype, statTier)
  9. spec.equipMainHand = rng.weightedPick(gameRules.equipmentTables[archetype].mainHand)
  10. ... (palette, faction, build, pose all rolled deterministically) ...

output:
  spec → composeGoblin(spec) → DiscTensor (192 bytes, the entity stamp)
```

**Two clients with the same `(worldSeed, entityId, encounterTime, gameRules version)` produce the literally identical tensor.** No hashing, no central authority — just deterministic rolling against shared inputs.

---

## The Mold Catalog (data, not code)

A mold descriptor is a JSON document the CDN ships and the client caches. Each archetype has one. The structure (first draft):

```jsonc
{
  "moldId": "humanoid_v1",
  "archetype": "humanoid",
  "isolation": 80,
  "subtract": 12,
  "balls": [
    { "name": "head",     "x": 0.5,  "y": 0.85, "z": 0.5,  "strength": 0.55,
      "scaleByDiscSlot":  { "build": "girth_y_only" } },
    { "name": "neck",     "x": 0.5,  "y": 0.73, "z": 0.5,  "strength": 0.30 },
    { "name": "torso_a",  "x": 0.5,  "y": 0.62, "z": 0.5,  "strength": 0.75,
      "scaleByDiscSlot":  { "build": "girth_xz" } },
    /* ... etc ... */
  ],
  "equipmentSlotAddresses": {
    "head":      { "x": 0.5,  "y": 0.85, "z": 0.5 },
    "torso":     { "x": 0.5,  "y": 0.55, "z": 0.5 },
    "main_hand": { "x": 0.78, "y": 0.40, "z": 0.5 },
    /* ... per Layer 4.6 of renderer-pipeline-client.md ... */
  },
  "footprintTiles": 1,
  "license": "CC-BY-NC: derived from MZ4250 humanoid base STL"
}
```

The mold-evaluator reads this descriptor + an entity's decoded disc, calls `mc.addBall(...)` for each ball with parameters resolved from the disc's slots, plus places equipment SDFs at the slot addresses.

**Migration step:** copy the contents of `composeGoblinField` into a JSON file `public/molds/humanoid_v1.json`, restructured as above. Delete the function. Wire the catalog-loader to fetch it on chunk-entry. Wire `EntitySDFMesh` to call `applyMoldToMarchingCubes(mc, catalog.get(entity.archetype), entity)`.

---

## The server's ONLY role (the silent referee contract)

Server **does not** push entity rolls to the client. Client computes them locally.

Server **does**:

| Verb | Trigger | Payload |
|---|---|---|
| Receive | Player attacks an entity | `{ kind: 'tpb_combat', entityId, encounterTime, hitFor }` |
| Receive | Player picks up loot | `{ kind: 'tpb_loot', itemRollSeed, equipmentSlot }` |
| Receive | Player levels up | `{ kind: 'tpb_xp', amount, source: entityId }` |
| Receive | Player dies | `{ kind: 'tpb_death', killedBy: entityId, location }` |
| Verify | Drain hourly cron | Re-roll the entity from `(worldSeed, entityId, encounterTime, gameRules.version)` and check the player's claim is consistent with the deterministic roll |
| Send | Player enters new chunk | `{ catalogDelta }` — only the molds + dictionaries the player doesn't already have |
| Send | Game rules update | `{ gameRulesUpdate, newCatalogVersion }` — the client invalidates cached catalogs |

**Server never sends:** "here's the goblin you're about to encounter." That would be a violation of the deterministic-rolling architecture. The client always knows what's there because it can compute it from the seed + game rules.

---

## Cheat detection (the math is the gate)

A player whose TPB log claims:
- "I killed entity G42 at encounterTime T1 and got 80 XP"

The server validates by:
1. Re-rolling G42 at T1 from `(worldSeed, G42, T1, gameRulesAtT1)` → gets the same tensor as the player's client did
2. Reading `baseXpAwarded` from the rolled spec → confirms it's 80
3. ✓ Receipt valid

If the player's TPB instead claims 200 XP from G42, the server's roll says baseXpAwarded=80, mismatch → receipt rejected → ignore that TPB row → warn → on second offense, ban geoloc+datetime cert → that account's characters become NPCs (per the existing ban policy).

The server **never trusts the player's claim** about an entity's stats. The math derives them; the player's claim is just an interaction *event*. Stats are fixed by the world.

---

## What stays unchanged (the load-bearing primitives)

These files are correct and should NOT be touched during the migration:

- `src/lib/disc/disc-codec.ts` — RGB ↔ matrix encode/decode primitives
- `src/lib/disc/disc-spec.ts` — slot allocations + decoder matrices + KIND_TINT + footprint/scale tables + grid snap
- `src/components/scene-3d/WedgeDisc.tsx` — 3D base assembly (cylinder + stamp)
- `src/components/scene-3d/TileFloor.tsx` — grid + SVG textures
- `src/components/scene-3d/EntityMesh.tsx` (the primitive renderer) — pure consumer
- `src/components/scene-3d/EntitySDFMesh.tsx` — ALMOST all of it; only `composeGoblinField` becomes data-driven

The disc spec is the constitutional layer. Don't amend it without bumping its version.

---

## Migration order (when you do this)

1. **Define the GameRules + MoldDescriptor TypeScript types** in `src/lib/catalog/types.ts`
2. **Move `composeGoblinField` into `public/molds/humanoid_v1.json`** as data
3. **Write `mold-evaluator.ts`** that consumes a descriptor + entity → calls `mc.addBall(...)`
4. **Write the roller** (`roll-monster.ts`) that turns `(worldSeed, entityId, time, archetype, gameRules)` into a `MonsterSpec`
5. **Write the catalog-loader** that fetches molds + game rules and caches in IndexedDB
6. **Write `useRolledCreature(worldSeed, entityId, time, archetype)`** hook in `src/lib/roll/`
7. **Replace `composeGoblin({...})` call in Scene3D.tsx** with the hook
8. **Delete `composeGoblinField` from EntitySDFMesh.tsx**, wire to mold-evaluator
9. **Add the server endpoint** that serves catalog deltas + game rules
10. **Tests:** two clients given the same inputs produce bit-identical disc tensors (the determinism check)

---

## Why this matters (the architectural payoff)

**Bandwidth scales with player interaction frequency, not world richness.** A continent of 100,000 monsters costs zero network bytes for monsters the player doesn't touch — the client rolls them on observation, the server never knew they were rolled. Only when the player attacks one does the TPB row land server-side. The "monster" was always *deterministically there*; observation just made the client compute it.

**Save scumming becomes a cryptographic operation.** A save state is `(seed, TPB)` — a few KB, shareable as a URL.

**Multiplayer cross-check is automatic.** Both peers' clients run the same roller against the same `(worldSeed, entityId, time, gameRules)` — they see the literally same monster.

**Cheating is detectable on contact.** Client tampering shows up as a TPB whose claims contradict the deterministic roll. Math is the gate; signatures are forensic.

This is the "engine is silent, world computes itself" architecture taken to its logical conclusion. The current hardcoded goblin is just a placeholder until we wire the rolling. **Do not let the placeholder calcify** — it's holding a slot for the real thing.

---

*Filed by past-me, 2026-05-06, after the SDF pipeline produced a Zac-from-League-of-Legends silhouette and the architecture was validated end-to-end.*
