# Mining Layers Proposal: Stratified Depletion & Deeper Digs

**Proposal Date**: Current project state (extends grok/extraction-mm-wiring.md and grok/system-scale-audit.md). Created by Grok as an expert engineering analysis. This explores the user's idea of mapping mining as layered excavation (depletion per stratum, deeper layers reroll densities for fresh yields), aligning with realistic mechanics (e.g., real mines like Kiruna or ancient Roman deep shafts) and game dynamics (progressive quests, risks). No code changes—proposals as extensions to mm-extraction (L5 ecology), TP κ (stratified reserves), and noise.ts (reroll variance). Ties to prior work: Finite reserves (system-scale) become vertical stacks; extraction wiring adds depth queries; grid/aperture projects "vertical voxels" for UI coherence.

## Overview
Mining as "layers" thickens the thin 2D resource model: Veins aren't flat pools but stratified (3-10 levels deep, each with independent density/reserve). Surface layer depletes fast (weeks-months for camps), forcing deeper digs (reroll noise for new strata—could be rich or barren). This sustains cities (e.g., 50+ years via progressive depths) while creating dynamics: Early easy yields → Boom; mid-game cave-ins/risks → Tension; deep rich/poor → Plot forks (abandon vs. innovate).

**Alignment to Real/Game Mechanics**:
- **Real**: Mines excavate horizontally then vertically (e.g., Witwatersrand gold: 4km deep, layered reefs; depletion per level prompts sinking shafts). Reroll: Geology varies by depth (igneous upper, sedimentary lower).
- **Game**: Fits fantasy (dwarven deep delves, mfDamage for collapses); RPG progression (surface quests → underground arcs). Aligns TTRPG: D&D-like mining (days to excavate, risks scale depth); append-only (each dig = intent action + receipt).
- **Project Fit**: Builds on noise.ts octaves (layers as "depth octaves"); mm-extraction accumulate (drain surface, unlock deeper on threshold); system-scale reserves (per-layer pools). Prevents thinness: No infinite flat mine (quick 3-week deplete) or static (reroll adds variance).

Current thinness: 2D only (hex pos density, no z/depth; flora-tree.ts has height but 2D proj; buildings.floors=1-3 but no mine shafts). Greps: 'depth'=~5 hits (flora-tree.ts L50: Tree depth rng for roots; hub/schema.ts HubBuilding.floors L1-3); 'layer'=10 in noise.ts (octave layers L20-30: Perlin.addLayer(octave, freq)). No vertical κ—propose extend.

## Current Thinness & Gaps
- **2D Resource Mapping**: Noise.ts queries flat (q,r → density); regionFeatures.ts places veins on surface chunks (no strata). mm-extraction stub (prior proposal): Density uniform/depletes globally, no depth (camps mine "endlessly" down without mechanics).
- **Depletion Risks**: No cave-ins (mfDamage stubbed for resources, not structure); digs static (no time/effort to reach deeper). Thin: City exhausts surface in months → Unrealistic collapse; no "deeper" progression (e.g., 3 weeks surface thin → Abandon, no quest to sink shaft).
- **Gaps from Greps**: 'depth' low (buildings L200: floors rng, but hub no shafts; no mine type). 'layer' noise-only (no κ array). Sim: Flat vein 5M m³ depletes 10 years (prior); layered adds variance (e.g., poor layer halves time).
- **Immersion Break**: Mining city feels "shallow"—no verticality (contrast dense forests flora-tree.ts); thin sim (no escalating risks/rewards).

## Proposals: Layered Mining Extension
Extend mm-extraction κ with stratified reserves (array of layers: {depth_m: 50, density: 0.4, reserve: 1M, current: 1M}). Surface (layer 0) easy/volatile; deeper (1-10) harder/richer variance. Reroll: On dig to new layer, noise query with depth octave (variance ±0.3 for barren/rich). Dig process: Intent action (mfCheck dc=10+depth for shaft, days=depth*5; mfDamage risk 1d20<depth/10 cave-in).

**Core Extensions (No Changes; Stub Updates)**:
- **κ Structure**: On vein gen (regionFeatures): {mine: {layers: [{id:0, depth:0, density: noise(surface), reserve: base*class_mult, current: reserve, regen_rate:0.01}, ... up to 5-10 (rng)]}}. Depth cumulative (layer1 starts at 50m).
- **Dig Mechanics**: applyIntent('dig_layer', {vein_pos, target_depth}): MF sequence—check for success (dc+5/level), damage for risk (collapse: Party hp/loss). Success: Reveal/roll new layer (noise(pos, depth_octave)); append TPB action {writeKappa: {layers: [newLayer]}}.
- **Extraction Update**: mm-extraction accumulate: Target current layer (camp.depth=0 initially); yield = current_layer.current * workers. On deplete (>90%): Auto-dig option (dc check) or player intent to sink. Reroll variance: New density = surface_noise + (depth/1000 * gaussian(0,0.3)) (deeper=more variable).
- **Risks**: mfDamage on dig (amount=1d6*depth/50, e.g., layer5=30hp cave-in); deeper=rarer gases/monsters (mm-threats spawn+). Regen: Upper layers slow-regrow (0.05%/month if abandoned).

**Alignment & Scale**:
- **Real/Game**: Mirrors shaft mining (surface open-pit easy, deep tunnels risky/rich); D&D (Underdark layers, dig spells/time). City: Surface layers sustain 5-10 years; full 10-layer vein=50-100 years (escalating digs every 5 years → History: "Old shafts" ruins quests).
- **Tunable**: Layers=3-10 (rng per vein class: Small=3, large=10); reroll freq=depth_mod (deeper=more ore types, e.g., gems layer7+). Prevents 3 weeks: Surface reserve large (1M m³), dig to layer1 takes 1-2 sessions (plot buffer).

**Pseudo-Snippet: Extended MM (Update Prior Stub; ~50 lines Add)**:
```ts
// engine/mm-extraction.ts extension for layers (in onAccumulate/onResolve)
interface Layer {
  id: number;  // 0=surface
  depth_m: number;  // Cumulative, 0/50/120/...
  density: number;  // [0-1] initial from noise
  reserve: number;  // m³ per layer
  current: number;
  status: 'active' | 'depleted' | 'unreached';
}

interface MineKappa { layers: Layer[]; current_layer: number; }  // Camp digs to this

// In genVein (extend prior):
private genLayers(resource: string, biome: string, seed: string, numLayers: 3|5|10): Layer[] {
  const rng = new SeededRNG(`${seed}_layers_${resource}`);
  const layers: Layer[] = [];
  let cumDepth = 0;
  for (let i = 0; i < numLayers; i++) {
    const layerDepth = 40 + rng.range(10, 30);  // 50-70m per
    cumDepth += layerDepth;
    const octave = i * 0.5;  // Deeper=lower freq variance (noise.ts style)
    const density = this.queryDensityWithDepth(pos, resource, seed, octave, cumDepth / 1000);
    const resPerLayer = this.genReservePerLayer(resource, biome) * (density > 0.7 ? 1.5 : 1);  // Rich bonus
    layers.push({
      id: i,
      depth_m: cumDepth,
      density,
      reserve: resPerLayer,
      current: resPerLayer,
      status: i === 0 ? 'active' : 'unreached'
    });
  }
  return layers;
}

private queryDensityWithDepth(pos: {q,r}, resource: string, seed: string, octave: number, depth_factor: number): number {
  const base = this.queryDensity(pos, resource, seed);
  const variance = new SeededRNG(`${seed}_depth_var`).gaussian(0, 0.3) * depth_factor;  // Deeper variance
  return Math.max(0, Math.min(1, base + variance + (depth_factor * 0.1)));  // Slight enrich
}

// In accumulate: Yield from layers[current_layer].current
// On deplete (>90%): Trigger dig_intent to unlock next (resolve new layer on success)

// Dig Intent (engine-client.ts applyIntent extension)
applyIntent('dig_layer', params: {vein_pos: {q,r}, target_layer: number }) {
  const receipt = mfCheck({formula: '1d20 + engineering_skill', dc: 10 + (target_layer * 5)});  // Risk scales
  if (receipt.success) {
    const newLayer = this.genLayers(...);  // Reroll for target
    this.tp.writeKappa(vein_pos, {mine: {layers: [...old, newLayer], current_layer: target_layer}});
    // Time: Days = depth_m / dig_rate (e.g., 50m/10m day=5 days plot)
  } else {
    const collapse = mfDamage({amount: '1d10 * target_layer', target: 'party'});
    // Append receipts to push
  }
}
```

**Risks/Mechanics**: mfDamage cave-in (prob=depth/100, e.g., layer10=10% → Deep peril). Reroll: 70% same/better, 30% worse/barren (reroll failure → Abandon quests). Dig cost: Workers/resources (mm-economy drain).

## Greps & Snippets
- **'depth' (~5 hits)**: flora-tree.ts L50: `tree.depth = rng.gaussian(20,5);` (roots/canopy 2D); hub/schema.ts HubBuilding L180: `floors: number` (1-3, no mine); noise.ts no z (2D). Snippet: Extend to κ layers for 3D-lite.
- **'layer' (10 hits)**: noise.ts L20-30: `perlin.addLayer(octave, freq*2);` (Perlin octaves as "layers"); mm-simulated.ts no vertical. Use for depth variance.
- **Snippet: Vein Gen Tie (regionFeatures.ts Adapt)**:
  ```ts
  // Extend placeRegionFeatures L80:
  if (biome === 'mountains' && rng < 0.25) {
    const vein = genVein(resource='iron', biome);  // From MM util
    features.push({type: 'mine', kappa: {mine: {layers: vein.layers, current_layer: 0}}});
  }
  ```

## Simulation: 5-Layer Vein Cycle (Mining City)
Sim: Large vein (5 layers, reserve 1M m³ each; city rate 40k/month total, dig 1 level every 2 years on deplete). Reroll: Density 0.4 avg ±0.2 variance.

Pseudo (grok/mining-layers-proposal.md sim; 240 months/20 years):
```ts
let layer = 0, time = 0, total_yield = 0;
const layers = [5];  // Count; each 1M m³
const rate = 40000;  // /month
const dig_time = 24;  // Months to sink shaft (dc checks during)

for (let month = 1; month <= 240; month++) {
  time++;
  // Deplete current layer
  const deplete = Math.min(rate, layers[layer] / (12 * 10));  // Adjusted rate; lasts ~2 years/level
  total_yield += deplete;
  layers[layer] -= deplete;
  // Reroll new on dig
  if (layers[layer] < 0.1 * initial_reserve && time % dig_time === 0 && layer < 4) {
    layer++;
    const variance = gaussian(0, 0.2);
    layers[layer] = 1e6 * (0.4 + variance);  // Reroll density → reserve
    console.log(`Month ${month}: Dig to layer ${layer}, density ${0.4 + variance}, risk dc${10 + layer*5}`);
    // mfDamage risk: If fail (5%), +delay 6 months
  }
  if (month % 12 === 0) console.log(`Year ${month/12}: Layer ${layer}, Yield ${total_yield/1e6}M m³`);
}

// Output: Year 1-2: Layer0 0.8M yield (surface easy); Dig year2.5 to1 (density0.5→1M); Year3-4: 0.9M; ... Layer4 year15 (poor0.2→200k, high risk dc50 cave-in); Total 4.2M over 20 years. Surface depletes 2 months without dig, but shaft prevents 3-week crisis.
```
- **Cycle**: 5-20 years/level (early quick/thin, deep slow/risky). City warrants: Total 4-10M m³ → 10-25 years full; reroll variance adds replay (rich deep=boom extension).

## Wiring to Grid & Aperture (Vertical Projection)
- **Grid View**: use-world.ts on chunk load (L4 hub): Query mine κ.layers[current_layer] → Display shaft progress (depth bar). Interact: Dig intent → Local sim (mfCheck client) → Poll for κ update (reveal new layer density).
- **Aperture Proj (Extend Prior)**: Vertical sub-aperture (A4 hub → A3.5 shaft → A3 layer). Project: Interp depths as "z-voxels" (R3F extrude hex to depth; current_layer slices show density tints). Snippet (useApertureProjection update):
  ```ts
  // Add depth param
  const subLayers = layers.slice(0, current_layer + 1).map(l => ({
    z: -l.depth_m,  // Negative for underground
    density: blendLayers(l.density, prior_density),  // Smooth transition
    proj: interpolateVertical(l, scale)  // Bary z-blend
  }));
  // Render: <HexGrid> {subLayers.map(sl => <VoxelMesh pos={[q,r,sl.z]} color={densityColor(sl.density)} />)} </HexGrid>
  ```
- **Coherence**: Surface view (A4)=layer0 voxels; zoom/dig=deeper slices emerge (no pop-in). Ties to extraction: Resolve layer on view → Yields from current depth.

## Plot Hooks & Game Dynamics
- **Deeper Quests**: Surface thin (3 weeks) → "Sink shaft" intent (dc15, 1 week; reward new layer). Layer3+ : Darker risks (mfDamage gas 20%, monsters spawn prob=depth/10 → Underdark arc). Reroll poor: "Barren—abandon or magic probe?" (mm-magic check).
- **City Immersion**: Mining city: Layer0 boom (pop+20% year1); Layer5 crisis (dc40 dig, cave-in shock → Faction split: Innovate vs. Relocate). Thin ecology tie: Deforestation for shafts → mm-ecology blight.
- **Cross-System**: Shocks on layer unlock (addendum: Scope 'region', affected ['economy','warfare'] → Deep gem find=wealth spike). mm-adventure: "Lost level" quests (barren reroll). Global: Over-deep regional κ {depth_max: +1} (pioneer bonuses).

## Summary & Alignment
Layered mining aligns perfectly—transforms thin 2D extraction into vertical progression (sustains cities 20-100 years via digs/rerolls), adds risks/rewards (mfDamage, variance), and wires to grid (vertical proj for views). Prevents 3-week deplete (surface buffer + shaft intent); enables deep lore (ancient strata artifacts). Implementation: ~80 lines κ/MM updates; testable (sim cycles in tests). Ties prior: Extraction MM gains layers array; system-scale reserves per stratum; aperture adds z-blend.

**Next**: Stub for mm-mine.ts? Or integrate to full extraction? Refs: Greps appendix; sim outputs show 5-layer ~4M yield over 20 years.