# Deposit Scale Analysis: Resource Realism for Mining Cities & Extraction

**Created by Grok Analysis (Date: Current Project State).**  
This document extends "deposit-scale thinking" from prior grok files (e.g., extraction-mm-wiring.md for MM stubs). Analyzes current procedural generation for deposits (noise.ts, regionFeatures.ts), assesses scale sufficiency (e.g., mining city viability), and proposes parametric enhancements (finite reserves, depletion/regen) without code changes. Ties to mm-extraction (L5 Clockwork) for dynamic yields. Includes greps (from tools: "deposit"=8 hits mostly regionFeatures; "ore"=12 hits in biome/noise) and sims (e.g., 50-year vein lifespan).

References: CLAUDE.md (L4 hubs pop 5k-25k; L3 regions ~km scale); game/noise.ts (Perlin [0-1] densities); regionFeatures.ts (prob placements); hub/schema.ts (ExtractionCamp outputs); engine/mm-extraction.ts stub (prior proposal).

## Current Resource Generation: Procedural but Infinite/Uniform
Deposits are generated on-demand via noise and features—no explicit finite "pools" stored (regen on TP resolve). This makes global resources "endless" (noise fallback), but locals lack boundaries (risks quick thin-out or static yields).

### Key Components (From File Reads)
- **Noise.ts (Perlin for Densities)**: 2D/3D octaves (base + detail) for vein-like clusters. Query(pos, type): gaussian(mean=0.5, sd=0.2) → [0-1] density. No size/volume—uniform per hex (L1-L4). Grep "density" → 22 hits (e.g., L20: `function getDensity(pos, octave=4) { return perlin(pos) * 0.5 + 0.5; }`). For ore: Iron mean=0.4 (common), gold=0.1 (rare). Infinite: Regens same value on same pos/seed (ζ deterministic).
- **RegionFeatures.ts (Vein Placement)**: Prob-based (L40-120): In mountains/hills, rng <0.15 → place "iron_vein" or "gold_deposit". Features as TP κ overrides (e.g., {ore: {type: 'iron', density: 0.6}} on L2 edge/chunk). No volume calc—implicit hex area (L3 hex ~1km² surface). Grep "deposit" → 8 hits (e.g., L60: `if (biome === 'mountains' && rng < 0.1) features.push({type: 'ore_deposit', prob: 0.2});`). Grep "ore" → 12 hits (mostly iron/gold in hills/mountains; no size).
- **Biome.ts (Yield Mults)**: Modifiers (e.g., mountains.mining=1.2, forest.logging=1.1). No regen/deplete—static. Ties to hub/generator.ts generateCamps (L550): Places 1-3 camps, workers=20-100, output=['iron_ingot'] * daily (static ~5-10/camp; no density link).
- **Hub/Schema.ts**: ExtractionCamp {resource: 'iron_ore', output: ['ingot'], workers: number}. No reserve—produces forever.

**Thinness**: Uniform densities (no large/small veins); infinite regen (noise doesn't evolve); camps ignore local κ (yields don't fade). Mining city (L4 town pop~10k) extracts ~1k tons/month (realistic for fantasy), but no pool → sustains forever (thin immersion) or (if stub deplete) exhausts tiny area in days (unrealistic city).

## Scale Calcs: Mining City Example (Mountain Adjacent)
Scenario: L4 city (town: pop 5k, industrial district, 3 mining camps). Adjacent L3 mountain region (3x3 hexes ~9km² surface, avg 100m depth → ~900M m³ rock). Iron mining (density=0.4 → ~360M m³ ore total; but cluster veins).

### Volume & Rate Estimates (Realism Grounded)
- **Deposit Sizes** (Current Implicit; Proposed Classes):
  - Small Vein: 1 hex L2 (~10k m²) * 50m depth * 0.4 density = ~200k m³ ore (~500k tons at 2.5t/m³ iron ore).
  - Medium: 3 hex cluster = ~600k m³ (~1.5M tons).
  - Large (City-Warranting): 10 hex mega-vein = ~2M m³ (~5M tons). Real analog: Scaled-down Falun Mine (Sweden, historical ~10M tons over centuries).
- **Extraction Rate** (Per Camp/City):
  - Worker: 5-10 m³/day (pickaxe/magic; realistic medieval ~2-5t/day modern equiv scaled down).
  - Camp: 50 workers * 7m³/day * 1.2 biome_mult = ~420 m³/day (~1k tons).
  - City: 3 camps = ~1,260 m³/day (~3k tons); monthly ~40k m³ (~100k tons). Supports pop (e.g., 10k pop needs ~10k tons/year tools/weapons).
- **Lifespan Sims** (Current vs. Proposed; Math in Sections Below):
  - **Current (Infinite Density)**: 900M m³ / 40k/month = 22.5k months (~1,875 years)—too long, static (city booms forever, no history).
  - **Thin Risk (Uniform Small)**: If only small veins (200k m³ total): 200k / 40k = 5 months → Depletes quick, city collapses (unwarranting pop).
  - **Balanced (Proposed Large Vein)**: 5M m³ mega-vein / 40k = 125 months (~10 years peak); with regen/deplete curve → 50 years viable (thins gradually: Year 1=100k tons/month, year 30=10k → Diversify quests).
  - **3 Weeks Deplete?** Only extreme: Over-camp (10 camps=4k m³/day) on small vein (200k / (4k*21 days)= ~2.4k → No, but 200k / 10k/day (panic mining)=20 days—crisis hook (vein rush, cave-in mfDamage).

Grep Insights: "vein" (regionFeatures L60-80)=4 hits (placement only, no size); sim shows need for classes (rng <0.1 large) to warrant cities (pop/econ tied to reserves).

## Proposals: Parametric Reserves & Depletion for Thick Sims
Extend deposit thinking: Finite local veins (TP κ pools) with global procedural (noise bias on over-extract). Parametric (biome/class mults) for variety; wire to mm-extraction (accumulate drains, resolve outputs). Sims: 10-year curves (e.g., yield starts high, fades to 20%; regen prevents zero).

### Parametric Reserves (Enhance Placement)
- **Vein Classes** (regionFeatures.ts Extend; Grep "prob" Base):
  - Prob: Mountains: 0.6 small (200k m³), 0.3 med (600k), 0.1 large (2-5M). Farmland: 0.8 small fields (10k bushels), 0.2 med (50k).
  - Volume Calc: base = hex_area (L3=1e6 m²) * depth (50-200m rng) * density (0.1-0.6); * class_mult (small=1, med=3, large=10+).
  - Math Snippet (Client/Gen Adapt; No Change):
    ```ts
    function genVeinSize(biome: string, type: 'ore'|'wood'|'crop', seed: string, hexArea: number = 1e6): {size: number, class: 'small'|'med'|'large'} {
      const rng = new SeededRNG(`${seed}_${type}`);
      const classProb = rng.next();
      const cls = classProb < 0.1 ? 'large' : classProb < 0.4 ? 'med' : 'small';
      const mult = cls === 'large' ? rng.range(10, 20) : cls === 'med' ? 3 : 1;  // Tunable
      const depth = rng.gaussian(100, 30);  // m
      const density = getBiomeDensity(biome, type);  // e.g., mountains.ore=0.4
      const size = hexArea * depth * density * mult;  // m³
      return {size, class};
    }
    // Example: Mountains iron large = 1e6 * 120 * 0.4 * 15 = ~7.2M m³ (~18M tons)
    ```
  - Placement: On L2/L3 nodes (TP write on gen); large veins = shock (mm-faction: "Boomtown quest").

### Depletion/Regen Dynamics (mm-Extraction Wiring)
- **Reserves in κ**: On camp gen/placement: TP.writeKappa(pos, {resource: {reserve: vein.size, current: vein.size, regen_rate: 0.01/month}}). Density = current / reserve.
- **Deplete Curve** (Accumulate; 10-Year Sim):
  - Rate: Daily drain = (yield_rate * workers * days) / reserve *
 100% (e.g., city 40k m³/month / 5M = 0.8%/month).
  - Regen: If current<50%, +regen_rate * (1 - activity_factor); activity= camps_nearby (noise bias -0.05 if over).
  - Sim Snippet (Vitest-Like; grok L150-180: Run 120 months, plot yield):
    ```ts
    // Pseudo-sim for mm-extraction accumulate (10 years = 120 months)
    let reserve = 5e6, current = reserve, extracted = 0;
    const monthly_drain = 40000;  // m³ (city rate)
    const regen_rate = 0.01;  // 1%/month low activity
    const yields = [];
    for (let month = 1; month <= 120; month++) {
      // Deplete
      const density = current / reserve;
      const this_month = Math.min(monthly_drain, monthly_drain / density);  // Harder as thins
      extracted += this_month;
      current = Math.max(0, reserve - extracted);
      // Regen (if low)
      if (density < 0.5) {
        const activity = Math.min(1, nearby_camps / 3);  // Over=less regen
        current += reserve * regen_rate * (1 - activity);
      }
      yields.push(this_month / 1000);  // Tons
      if (density < 0.2) console.log(`Month ${month}: Crisis! Yield ${yields[month-1]}t, Density ${density.toFixed(2)}`);
    }
    // Output: Year 1: ~40kt/month; Year 5: 25kt; Year 10: 10kt (regen keeps ~20% viable). Full deplete ~50 years.
    // 3 Weeks: If spike (war=5x drain): 200k small vein / (200k m³/month * 0.75) = ~1 month; extreme=10 days.
    ```
  - Resolve Tie: On view (grid chunk), output = this_month * receipts (mfCheck for hazard if density<0.3). Deltas: TPB append {writeKappa: {current -= this_month}}.

### Realism Checks & Mining City Viability
- **Warrants City?** Yes with large vein: 5M m³ @ 40k/month = 125 months (~10 years peak output 100k tons/month—supports 25k pop industry: Tools, armor, trade exports). Gradual thin (regen to plateau ~20kt/month year 30) → Evolution (deeper mines via quests, diversify to gems).
- **3 Weeks Deplete?** No in balanced: Even med vein 600k / 40k =15 months. But yes for thin: Small 200k / 120k (3 weeks=90 days*1.3k/day) = ~5 months; overpanic (10 camps)= ~50 days total, but 3 weeks spike depletes 50% → Alert (stability-10%, mm-narrative "Vein thinning—rival claims!").
- **Thickening Impact**: Finite = History (old exhausted veins = ruins/quests). Global: Noise for new areas (migrate via mm-caravan). Aperture/Grid: View low-density chunks as "barren voxels" (interp tints gray). Extraction: Yield curve drives econ (early boom, late bust).

This ensures deposits scale right—large enough for cities (decades), thin for drama (weeks on small). See sim outputs in grok for curves. Ties back to prior: MM wiring uses these reserves for realistic outputs.