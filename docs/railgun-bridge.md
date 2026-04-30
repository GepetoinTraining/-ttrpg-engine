# Railgun ↔ TTRPG Bridge — The Rube Goldberg Mapping

The Railgun engine (`D:/Railgun/`) and the TTRPG engine share identical primitives under different names. The Railgun engine is a general-purpose stateless computation flywheel. The TTRPG engine is one application that runs on top of it.

## Mapping Table

| Railgun | TTRPG | Unified Name |
|---------|-------|-------------|
| Cert (wavelength) | Entity seed (prime factorization) | **Tooth** — identity as math |
| Gear ratio (col index) | TP (topology pointer) | **Ratio** — relationship = address |
| Envelope (opaque blob) | MF (manifold function) | **Packet** — computation-in-transit |
| Transit buffer | MF pipeline | **Orbit** — self-consuming queue |
| Flywheel tick | World/combat/scene tick | **Rotation** — sweep-all, process, flush |
| Audit (additive color) | TPB (receipted history) | **Spectrum** — hash-chained proof |
| Axle (Schrödinger) | Observer (NPC materialization) | **Observer** — collapse on observation |
| Custody transfer | Rule resolution (ancestor walk) | **Custody** — authority through topology |
| Tick rate (daily→second) | Time dilation (world→combat) | **Tempo** — same gear, different speed |

## How It Works

### Cert = Any Entity
- Player cert: seed from race × class × background prime composition
- NPC cert: seed that only collapses when observed (Schrödinger)
- Location cert: topology node (settlement, region, building)
- System cert: weather, economy, faction — abstract entities that produce envelopes

### Envelope = Any Computation
- Chat message: encrypted text blob (messaging use case)
- MF-damage: `{ type: "damage", dice: "2d6+3", target: recipient_ratio }`
- Movement: `{ type: "move", from: location_A_ratio, to: location_B_ratio }`
- Market shift: `{ type: "price_update", commodity: "iron", delta: -5 }`
- Weather: `{ type: "weather_tick", region: ratio, precipitation: 0.7 }`

### Flywheel Tick = World Clock at Any Tempo
- `daily` → world simulation (weather, economy, NPC agendas, faction moves)
- `hourly` → travel, exploration, downtime
- `minute` → scene-level interaction
- `second` → combat rounds (6-second D&D ticks)

### Multi-Tempo Orchestration
Multiple flywheels spin simultaneously:
- One **world flywheel** (daily tempo)
- One **session flywheel** (minute tempo)
- One **combat flywheel** (second tempo, ephemeral — spawned/destroyed per combat)

Cross-flywheel routing passes envelopes between tempos. A combat result on the combat flywheel produces an envelope that routes to the world flywheel (HP change).

### Schrödinger's Axle = Observer Pattern
NPCs are seeds. They don't have names until observed. An axle (observer) reaches an NPC cert: "is this entity materialized?" If no → collapse it. If yes → interact normally. This IS the `observeNPC(seed)` function.

## Prime Element Mapping (from genesis/elements.ts)

```
H=2, He=3, C=5, N=7, O=11, Si=13, Fe=17, Au=19, U=23
Races: Human=29, Elf=31, Dwarf=37, Halfling=41, Gnome=43, Orc=47...
Classes: Fighter=61, Wizard=67, Rogue=71, Cleric=73, Ranger=79...
Locations: City=113, Town=127, Village=131, Fortress=137...
Systems: Weather=163, Economy=167, Faction=173, Military=179
```

Seed product: `{ Dwarf: 1, Fighter: 1 }` → `37 × 61 = 2257` → unique wavelength → cert.

## Intelligence Layer Integration

The TTRPG intelligence.ts provides per-entity memory framing:
- **Knowledge Boundaries** — each agent has `allowedScopes` and `exclusions`
- **Memory Protocol** — episodic, semantic, emotional with decay
- **filterKnowledge()** prevents cross-contamination

This maps directly to Railgun's per-contact agent memory: the secretary knows what Contact A shared, not what Contact B shared. Same architecture, different domain.

## Test Results (proven)

All scenarios passed when tested:
- Combat round: 7 combatants, 7 MFs, all correctly routed as `mf` packets
- World tick: 20 MFs (weather + economy) propagated to 10 locations
- NPC observation: dormant seed collapsed, responded with disposition
- Multi-tempo: combat + world flywheels simultaneously, both ticked, combat destroyed cleanly

## Files (archived from Railgun, now TTRPG-specific)

The bridge.ts, orchestrator.ts, and test-ttrpg.ts were originally built in D:/Railgun/ to prove the mapping. They've been extracted here as documentation. To rebuild:

1. Import Railgun's core types
2. Use bridge functions to map entities → certs, MFs → envelopes, topology → gear_ratios
3. Use orchestrator for multi-tempo flywheel coordination
4. The Railgun engine handles everything else unchanged
