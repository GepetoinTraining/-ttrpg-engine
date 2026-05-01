# Mining Layers Proposal

## Overview

This proposal outlines a layered mining model to introduce finite, stratified resource extraction mechanics into the TTRPG engine. Surface-level deposits will deplete over time, revealing deeper layers through player-driven digs. Each layer features its own resource density and reserves, with rerolls upon exposure to simulate geological variability. This creates longer-term economic and narrative dynamics (e.g., decades-long mining operations in settlements), enabling plots around depletion, cave-ins, labor disputes, and deep-earth discoveries.

The model aligns with core principles:
- **Deterministic computation**: Client-side engine handles depletion and rerolls; server appends via TPB actions.
- **Observation-driven persistence**: Layers are κ rules in TP nodes (e.g., under a settlement's mine hub); resolved only on interaction.
- **MM integration**: Extends `mm-extraction` for accumulation (daily depletion) and resolution (dig/reveal events).
- **Risk and realism**: Introduces hazards like cave-ins, tied to skill checks (e.g., Mining proficiency) and environmental factors (e.g., weather, structural integrity).

This is an incremental addition: no breaking changes to existing worldgen or economy MMs. New actions will be added to `WorldTPBActionSchema` for digs, depletions, and reveals.

## Data Structures

### Core Types (in `engine/game/` or `src/lib/`)

1. **MineLayer** (interface, extends existing resource node in TP κ):
   ```typescript
   interface MineLayer {
     layerId: number;  // 0 = surface, 1 = shallow, ..., N = abyssal (max 10 layers per mine for scalability)
     depth: number;    // Meters below surface (e.g., 0, 50, 200, 500+)
     resourceType: string;  // e.g., 'iron_ore', 'gold_vein', 'gem_cluster' (from regionFeatures.ts biomes)
     reserve: number;       // Total extractable units (initially rolled via noise.ts seeded by worldDay + nodeId)
     currentDensity: number; // 0-1 scalar (depletes over time; rerolled on reveal)
     depletionRate: number;  // Units per day (base + modifiers from economy/labor MMs)
     hazardThreshold: number; // 0-1; if depletion > threshold, triggers cave-in risk
     structuralIntegrity: number; // 0-1; decreases with digs, affects hazard rolls
     revealed: boolean;     // False until dug to; surface starts true
     kappaDomain: 'mine-layer'; // For TP resolution: child layers override parent densities
   }
   ```

2. **Layer** (class for in-memory simulation, in `engine/mm-extraction.ts`):
   ```typescript
   class Layer implements MineLayer {
     // ... props as above
     accumulate(days: number): void {
       // Daily tick: deplete reserve based on rate, update density
       this.reserve -= this.depletionRate * days;
       if (this.reserve < 0) this.reserve = 0;
       this.currentDensity = this.reserve / initialReserve; // Normalize
       if (this.currentDensity < this.hazardThreshold) {
         this.triggerHazardCheck(); // Roll for cave-in (mfCheck with Mining DC)
       }
     }

     reveal(worldDay: number): void {
       // Reroll density/reserve using noise.ts (seed: worldDay * layerId * nodeId)
       this.currentDensity = noise.generateDensity(this.layerId, worldDay); // 0.1-0.9
       this.reserve = this.currentDensity * maxReserveForDepth(this.depth);
       this.revealed = true;
       // Emit TPB action: 'revealLayer' with receipt (success/failure from dig check)
     }

     dig(amount: number, skillMod: number): { extracted: number; integrityLoss: number; hazard?: HazardEvent } {
       // Player intent: applyIntent('mineDig', { layerId, amount })
       const success = mfCheck('mining', skillMod, this.currentDensity * 100); // DC scaled by density
       if (success.output) {
         const extracted = Math.min(amount, this.reserve);
         this.reserve -= extracted;
         this.structuralIntegrity -= 0.01 * amount; // Base loss, mod by tools/safety
         return { extracted, integrityLoss: 0.01 * amount };
       } else {
         // Failure: potential hazard
         return { extracted: 0, integrityLoss: 0.05, hazard: this.generateHazard() };
       }
     }
   }
   ```

3. **MineKappa** (TP extension, in `engine/tp.ts`):
   - κ rule for mine nodes: `{ mine: { layers: MineLayer[] } }`
   - On writeKappa('mineUpdate'), capture depletion/reveal as TPBAction.
   - Ancestor walk resolves global modifiers (e.g., faction tech boosts depletionRate).

4. **HazardEvent** (Zod schema for receipts):
   ```typescript
   const HazardEventSchema = z.object({
     type: z.enum(['caveIn', 'gasLeak', 'flood']),
     severity: z.number().min(0).max(1), // Affects party damage/immobilization
     mitigationDC: z.number(), // Survival/Engineering check to contain
   });
   ```

### Integration with Existing Structures
- **TP Node**: Mines attach to `MM_settlement` or `MM_region` via κ: `settlement.mine = { layers: Layer[] }`.
- **Noise.ts**: Extend for vertical noise: `generateLayerDensity(seed, depth)` using Perlin for stratification (richer near bedrock).
- **RegionFeatures.ts**: Surface layers seeded at worldgen; deeper layers procedural until revealed.

## MM Wiring (Clockwork Integration)

Extend `mm-extraction` (L1 EXTRACTION layer, daily cadence) to handle layers. Reference `docs/clockwork_wiring.md` for registration.

1. **Accumulate Phase** (cheap, every tick):
   - For each active mine (observed settlements):
     ```typescript
     onAccumulate(days: number, worldDay: number): void {
       this.layers.forEach(layer => {
         if (layer.revealed && layer.reserve > 0) {
           layer.accumulate(days);
           // Queue TPBAction: 'depleteLayer' { layerId, depletedAmount, newReserve }
         }
       });
       // Aggregate to economy: total extracted -> market supply delta
     }
     ```

2. **Resolve Phase** (expensive, on observation/dig):
   - Triggered by player intent or cron tick if unobserved depletion hits zero.
     ```typescript
     onResolve(worldDay: number): void {
       this.layers.forEach(layer => {
         if (layer.reserve === 0 && !layer.revealed) {
           // Auto-reveal on exhaustion? Or require dig? (Configurable via κ)
         }
         // Snapshot to mm_states cache if server-side
       });
       // Cross-wire to L2 ECONOMY: depletion affects prices
     }
     ```

3. **Clockwork Registration** (in `engine/clockwork.ts`):
   - Add `mmExtractionLayers` to L1 deps: `[MM_PHYSICAL, MM_ECONOMY]` (physical for terrain, economy for demand).
   - Cadence: Daily for accumulation; event-driven (dig) for resolves.

4. **System Edges** (`engine/system-edges.ts`):
   - Wire `depleteLayer` -> `MM_ECONOMY.marketUpdate` (supply shock).
   - Wire `revealLayer` -> `MM_FACTION.intelligence` (discovery rumors).
   - Wire `hazardEvent` -> `MM_SCENE` (immediate combat/environmental challenge).

## Depletion Mechanics

1. **Surface Depletion**:
   - Starts at layer 0 (revealed=true).
   - Daily: `reserve -= rate * days` (rate from labor MM, mod by tools/tech).
   - When reserve=0: Trigger reveal of layer 1 (requires dig action to access).

2. **Deeper Digs**:
   - Player: `applyIntent('digLayer', { mineNodeId, targetLayer: 1, effortDays: 5 })` -> mfCheck(Mining DC 15 + depth).
   - Success: Reveal next layer, reroll its density/reserve.
   - Reroll: Use `noise.ts` with seed `(worldDay + nodeId * layerId)` for determinism.
   - Vertical Stratification: Deeper layers have higher-value resources (e.g., gems > iron) but higher hazards (DC +5 per layer).

3. **Time Horizons**:
   - Surface: 1-5 years depletion.
   - Deep: 10-50 years, scaling with reserve rolls (e.g., 1000-10000 units/layer).
   - Enables quests: "The vein is running dry—scout for new digs!"

4. **Hazards and Cave-Ins**:
   - On dig/accumulate: If integrity < 0.3, roll `mfCheck('stability', partyAvgMining, DC=20)`.
   - Failure: `HazardEvent` -> party damage (mfDamage), immobilize mine (κ: `mine.active=false` for days).
   - Mitigation: Engineering feats restore integrity.

## API Hooks and Persistence

1. **Client-Side (engine-client.ts)**:
   - `observe(mineNodeId)`: Hydrates layers from TP κ.
   - `applyIntent('mineDig' | 'digLayer', params)`: Buffers `writeKappa` + receipt.
   - `push()`: Sends to `/api/world/slot/push` as `WorldTPBAction` variant.

2. **Server Routes** (`src/app/api/world/`):
   - **GET /api/world/mine/state?nodeId=123**: Returns `{ layers: MineLayer[] }` (from tpb_entries replay or mm_states cache).
   - **POST /api/world/slot/push**: Validate actions (`depleteLayer`, `revealLayer`, `digLayer`), insert flywheel_slot.
     - New variants in `tpb-world.ts`:
       ```typescript
       const DepleteLayerAction = z.object({ type: z.literal('depleteLayer'), layerId: z.number(), depleted: z.number() });
       const RevealLayerAction = z.object({ type: z.literal('revealLayer'), layerId: z.number(), newDensity: z.number() });
       const DigLayerAction = z.object({ type: z.literal('digLayer'), targetLayer: z.number(), success: z.boolean() });
       ```
   - **Cron Drain** (`/api/cron/drain-slots`): On insert to tpb_entries, update mm_states snapshot for unobserved mines.

3. **Validation**:
   - Server: Check action shape + cert signature (forensic if dispute).
   - No compute: Rely on client engine for rolls/depletions.

4. **UI Hooks** (`src/components/design/surfaces/`):
   - Extend `Settlement` surface: Show layer stack (progress bars for reserves).
   - `Play` HUD: Mine intent buttons, depth visualization (e.g., cross-section grid).
   - Aperture grid: Project layers as sub-voxels (depth color-coding).

## Implementation Roadmap

1. **Phase 1**: Define types/schemas, extend noise.ts for layer gen, unit tests for Layer class (depletion/reroll).
2. **Phase 2**: Wire into mm-extraction (accumulate/resolve), add TPBAction variants, server route stubs.
3. **Phase 3**: Hazard integration (mfCheck/Damage), cross-MM edges, API validation.
4. **Phase 4**: UI mocks in Settlement/Play, full tests (88+ files target), cron drain updates.

## Risks and Caveats
- **Scalability**: Limit layers to 10/mine; unobserved mines accumulate server-side via cron (lightweight).
- **Balance**: Tune depletion rates to avoid instant exhaustion; tie to world scale (small mine: 100 units/day).
- **Edge Cases**: Multi-party digs (DM session bundles), trade of mine claims (characterTransfer variant).
- **Migration**: Existing surface deposits become layer 0; no data loss.

This model thickens the extraction layer, creating emergent gameplay around resource management. Next: Flesh out fauna-flora integration for surface mining synergies (e.g., herbalism aids dig safety).

---
*Last updated: [Current Date]. Ties to grok/extraction-mm-wiring.md for detailed flowcharts.*
