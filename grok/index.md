# Grok Analysis Index: Aperture/Grid Mapping & Extraction MM Wiring

## Overview
This index serves as a high-level navigation for my analysis artifacts in the `grok/` directory, focused on multi-scale aperture/grid systems and extraction Manifold Matrix (MM) integration. The work builds on the TTRPG Engine's spatial hierarchy (TP apertures in `engine/tp.ts`), procedural generation (`src/game/hex.ts`, `noise.ts`, `regionFeatures.ts`), and MM layers (`engine/mm-*.ts`). No code alterations—pure proposals grounded in existing structures (e.g., κ resolution, Clockwork L4/L5 ticks, flywheel deltas).

Key themes:
- **Smooth Mapping**: Projecting fine-detail (Aperture N-1) onto coarser grids (A N) for coherent UI display (e.g., voxel-like blends without backend changes).
- **Extraction Wiring**: Dynamic resource extraction via MM stubs, tying procedural deposits (noise-based) to grid views (observer loading in `src/lib/use-world.ts`) and global mapping (TP κ overrides).
- **Scale Extensions**: Applying finite reserves/depletion thinking to thicken "thin" systems (e.g., ecology/economy lifecycles of 10-50 years).

Cross-reference: `CLAUDE.md` for principles (observation writes, client computes); `docs/tp_schema.md` for aperture domains; `docs/mm_nesting.md` for L4-L5 layers. All line refs are approximate (from reads/greps); update as files evolve.

## Topics & Artifacts
### 1. Aperture/Grid Analysis
- **Focus**: Current multi-scale setup (axial hex in `src/game/hex.ts`, TP resolve in `engine/tp.ts`), interpolation for A(N-1) → N (barycentric/blend for hex, bilinear for square migration). Greps: "aperture"=12 hits (tp.ts heavy); "scale"=18 (hex.ts dist/ring).
- **Key Questions**: How to display sub-details (e.g., ore voxels) smoothly on higher chunks without pop-in? Ties to UI (ChunkManager trajectory) and rendering (R3F meshes).
- **Artifacts**:
  - `aperture-grid-analysis.md`: Full breakdown.
    - L20-70: Current implementation (TP walk, hex helpers; snippet from hex.ts#L100-120 for rings).
    - L80-160: Mapping proposals (pseudo-hook useApertureProjection.ts; barycentric math example).
    - L140-160: Square migration interp (bilinear pseudocode).
    - L170-200: UI ties (use-world.ts extension, aperture param in /api/world/state).
- **Project Links**: See `engine/tp.ts` for κ merge (L140-160 resolve); `src/game/hex.ts` for coords (L50-100 dist/neighbor).

### 2. Extraction MM Wiring
- **Focus**: Wiring camps/resources (hub/schema.ts ExtractionCamp) to MM (proposed `mm-extraction.ts` at L5 ecology), grid views (ChunkManager.loadForObserver), and global procedural mapping (noise.ts density queries). Greps: "camp"=20 hits (schema/generator.ts); "extraction"=15 (hub-focused); "density"=22 (noise/regionFeatures).
- **Key Questions**: How to deplete local veins (TP κ) while regenerating globally (noise bias)? Display dynamic yields in views (e.g., camp icons + heatmaps)?
- **Artifacts**:
  - `extraction-mm-wiring.md`: Detailed notes.
    - L30-100: Current state (camps gen in generator.ts L550-610; resources in regionFeatures.ts L40-120 probs).
    - L110-220: Proposals (MM stub with accumulate/resolve; flow diagram L200-220 mermaid; cross to mm-economy).
    - L170-190: Grid/UI snippet (useExtractionProjection hook for Play.tsx render).
    - L230-250: Challenges (depletion edges, regen rates).
- **Project Links**: `src/game/hub/schema.ts` for ExtractionCamp interface (L100-120); `src/game/noise.ts` for density (L20-50 Perlin); `engine/mm-simulated.ts` for base class (L1-50).

### 3. System Scale Extensions (Deposit-Thinking Applied)
- **Focus**: Extending finite reserves/depletion to thin systems (ecology/economy/settlement/faction), ensuring 10-50 year cycles. Builds on extraction (e.g., thin mines → econ decay). Greps: "yield"=~30 (biome/mm stubs); "regen"/"deplete"=low (2-5, add needed).
- **Key Questions**: How to parameterize pools (class probs, rates) for realism (e.g., no 3-week city collapse)? Wire thresholds to shocks/quests (mm-narrative)?
- **Artifacts**:
  - `system-scale-audit.md`: Extensions audit.
    - L60-120: Ecology (flora reserves; sim: 50-year forest cycle).
    - L200-250: Economy (market pools; 10-year trade curve).
    - L320-370: Settlement (pop decay; mining city example: 50 years stable).
    - L440-480: Faction (influence erosion; 5-20 year arcs).
    - L490-520: Other (caravans/monsters; quick stubs).
    - L50-120/260-300: Sims (e.g., yield curves, greps).
- **Project Links**: `engine/mm-ecology.ts` for L5 base (stub accumulate); `src/db/schema.ts` settlements/districtHubs (L541-551 hubSeed, L2220-2227 factions); `docs/mm_nesting.md` for cadences (L4 daily, L3 quarterly).

### 4. Deposit Scale Analysis (Mining City Example)
- **Focus**: Specific thinness check (deposits too uniform/small; risk 3-week deplete). Params for vein classes (small/large volumes), lifespans (years vs. weeks).
- **Artifacts**:
  - `deposit-scale-analysis.md`: Standalone sim.
    - L50-120: Calcs (10M m³ vein → 50 years at 1k m³/day; greps "ore"/"vein").
    - L150-200: Proposals (genVeinSize in MM; city realism: Decades with regen).
- **Project Links**: `src/game/biome.ts` for yield mults (L100-150 mountains); `engine/mm-extraction.ts` (proposed stub).

## 5. Mining Layers Proposal
- **Focus**: Proposal to model mining depletion as layered excavation (e.g., exhaust surface layer → dig deeper for new rolled reserves/process), aligning with realistic mechanics (reroll density/depth per layer). Addresses thinness in extraction (infinite uniform vs. progressive challenge). Layers: 5-10 per vein (shallow easy, deep risky dc/mfDamage for cave-ins); total scale 50+ years for cities.
- **Key Questions**: How to represent depth in TP κ (e.g., {mine: {current_layer:1, max_layers:8, reserve_per_layer:1M}})? Tie dig to intents (applyIntent('excavate')) → resolve mfCheck + noise reroll for next layer.
- **Artifacts**:
  - `mining-layers-proposal.md`: Full details (to be created).
    - L20-50: Current thinness (uniform noise, no depth in mm-extraction stub).
    - L60-100: Layered model (κ structure, dig process as MF sequence; reroll via SeededRNG on exhaust).
    - L110-140: Scale sims (e.g., 8 layers * 5M reserve = 40M total; 1 layer/5 years at city rate → 40-year cycle; deep layers +dc for realism).
    - L150-170: Wiring (extend mm-extraction.onResolve: If layer exhausted, intent to dig → new receipt; cross to mm-settlement stability- on deep risks).
- **Project Links**: See `engine/mm-extraction.ts` stub (add layer κ to accumulate/deplete); `src/game/noise.ts` for density reroll (gaussian per layer depth); `engine/mf-check.ts` for dig dc (e.g., +2/layer).
- **Cross-Refs**: Builds on grok/extraction-mm-wiring.md (reserve gen in queryDensity → per-layer); grok/system-scale-audit.md (ecology thin from over-deep mining → regional blight); grok/deposit-scale-analysis.md (vein classes as starting layers).

## Usage Notes
- **Navigation**: Use line refs (e.g., `grep thin grok/system-scale-audit.md`) for quick pulls; artifacts are self-contained (snippets/greps included).
- **Updates**: Append new topics here (e.g., "Player Tree Scaling" post-audit). Deterministic: All math seeded (RNG from auth.ts ζ).
- **Cross-Project**: Aligns with `CLAUDE.md` (L100-150 principles: Finite local, global proc); test via `npm run test` (add cycle sims to `__tests__/`).
- **Next?**: Potential: `grok/ui-projection.md` for R3F visuals.

Last Updated: [Current Date]. Total Artifacts: 5 (growing as tasks extend).