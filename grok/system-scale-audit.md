# System Scale Audit: Extending Deposit Thinking to Thin Systems

**Audit Date**: Current project state (post-aperture/extraction analysis; references grok/index.md, grok/deposit-scale-analysis.md). Purpose: Apply "deposit-scale thinking" (finite local reserves with procedural global regen, tunable depletions for plot/economy dynamics) to thicken "thin" systems. Thinness = static/infinite yields (no pools/thresholds), risking toy-like sims (e.g., endless farms without famine). Focus: World tree MMs (L2-L6 per docs/mm_nesting.md); lighter on player tree (session-bound).

**Overall Patterns** (from greps across engine/mm-*.ts, game/*: 'yield'=28 hits (mostly static mults in biome.ts/noise.ts); 'regen'=4 (noise only, no pools); 'deplete'=2 (stubs); 'reserve'=0. Diagnostics: 85-90% coverage on ecology/econ MMs, gaps in long-term (e.g., no 10-year sim tests).):
- **Thin Hallmarks**: Uniform noise (infinite regen); no κ pools (e.g., {flora: {reserve: 1M, current:1M}}); weak crosses (logging ignores pop impact).
- **Scaling Framework**: Reserves as classes (small/medium/large; prob 0.6/0.3/0.1); deplete (0.1%/day observed); regen (0.05%/month low-activity). Wire: TP κ writes (deltas to TPB); MM accumulate (potential build), resolve (outputs on view/interact). Thresholds → shocks (e.g., <20% → narrative quest). UI: Aperture proj (grok/aperture-grid-analysis.md) for health maps.
- **Realism Targets**: L4 hub (city): 10-50 year cycles; L1 (chunk): Weeks-months for quests. Global: Noise bias (-- on over-thin) for migration.
- **Implementation Fit**: ~100-200 lines stubs (add κ in onAccumulate); tests: Vitest cycles (e.g., 5-year decay). No purity break—client computes views, server appends deltas.

## 1. Ecology (Flora, Biomes, Forests/Farms—Core for Extraction)

### Current Thinness
- **Implementation Summary**: mm-ecology.ts (~150 lines stub): ISimulatedMMBase with accumulate("flora potential" = static biome_mult * days, no deplete); resolve("project biomes" = noise query, infinite). game/biome.ts: Yield mults (e.g., forest.logging=1.1, no caps); noise.ts L20-80: Perlin density [0-1] regens always (octaves for veins, but no evolution). regionFeatures.ts L40-120: Place 'oak_tree' prob=0.4 (rng; infinite on re-resolve). flora-tree.ts: Procedural trees (height/density from seed, no pool).
  - Greps: 'yield' in biome.ts=12 (static); 'regen' in noise.ts=3 (just gen function); 'deplete' in mm-ecology.ts=0. Tests: __tests__/mm-ecology.test.ts covers basic accumulate (92%), no threshold sims.
- **Thin Issues**: Uniform biomes don't thin (forest yields forever); farms/forests static (city 10k pop eats 100k crops/year indefinitely). Extraction (camps) produces without consuming → quick "barren" if no param (3 weeks over-farm small field=10k units at 500/day). Global infinite (noise regen); local no impact (no deforestation → no animal migration quests).

### Scaled Proposal
- **Reserves**: Per L3 biome chunk κ {flora: {type: 'trees'|'crops', reserve: 10k (small grove/field)/100k (medium)/1M (large forest/farm), current: reserve, regen_rate: 0.02/month (natural), overtax_factor: 0 if low activity}}. Class prob from biome (forest.large=0.2; plains.farm.medium=0.4). Volume math: Hex area (L3~1km²=1e6 m²) * density (0.1 trees/m²) * height (20m for logs) → 2M units large; tune for crops (yield=1k kg/hectare).
  - Gen/Placement: Extend regionFeatures.ts placeFeature: If biome=forest, rng class → write κ to TP node (seed-derived size).
- **Deplete/Regen**: 
  - Accumulate (L5 Clockwork monthly): Drain = extraction_activities (from mm-extraction) + natural (0.001 * pop for farms) * days; current -= drain. Regen = regen_rate * (1 - overtax_factor) * (current < 0.5 ? 1.5 : 1) * days; if current<0.1: Shock (blight → mm-weather -temp). Overtax = drain / capacity (e.g., >1.2 → +0.1 factor, thin faster).
  - Resolve (on grid view/interact): Outputs = current * efficiency (e.g., harvest mfCheck dc10 for bonus); if observed, full compute (player farm → +yield).
  - Rates: Forest logging: Deplete 0.5%/day (1 camp); regen 0.03%/month (grows back slow). Farm: Deplete 1%/day (pop food); regen 0.1%/month (seasonal, mm-weather tie).
- **Extraction Wiring**: mm-extraction.queryDensity → ecology κ.current / reserve (yields drop as thin). Deltas: On deplete, write {flora: {current -= yield}} (TPB append). Cross: Thin flora → mm-ecology notify mm-settlement (pop growth-0.01).
- **Grid View & Resources**: use-world on poll: If chunk biome, resolve ecology → project health (aperture-1: Voxel tint green=full/red=thin; tree count interp). Resources mapped: Noise bias (if regional thin>50%, global density-0.05 in queryResourceDensity stub). UI: Settlement surface farm overlay (health bar per district).
- **Realism for Mining City (Adjacent Forest/Farm)**: Large forest reserve 1M trees at 200 logs/day (5 camps) → Deplete to 50% in ~13 years (regen keeps ~30-year cycle); small field 10k crops / 1k/day (pop food) → 10 days thin → Famine shock (3 weeks crisis if no imports). Sustains city 20-50 years (diversify quests: Hunt/fish ties).
- **Plot Hooks & Cross-Wires**: <20% → Shock (addendum: Scope 'hub', affected ['economy','faction'] → Deforest → Monster bloom (mm-threats +density)). mm-caravan: Migrate farms on thin. Tests: Sim 10-year cycle (vitest: Assert current~0.7 after 5 years moderate use).
  - Snippet (extend mm-ecology.ts onAccumulate; grok L130-150):
    ```ts
    // mm-ecology.ts proposal extension
    onAccumulate(days: number, worldDay: number, tp: TP): void {
      this.state.biomes.forEach(biome => {
        const node = tp.resolve(biome.pos, 'A3_REGION');
        const flora = node.readKappa('flora') ?? this.genFloraReserve(biome.type, tp.seed);
        const drain = (biome.extraction_yield ?? 0) + (biome.pop_demand ?? 0) * 0.001;  // From mm-extraction/settlement
        flora.current = Math.max(0, flora.current - drain * days);
        const regen = flora.regen_rate * (flora.current < flora.reserve * 0.5 ? 1.5 : 1) * days;
        flora.current += regen * (1 - this.overtax(drain, flora.reserve));
        if (flora.current < flora.reserve * 0.1) {
          this.emitShock({scope: 'region', type: 'blight', affected: ['economy', 'narrative']});  // To clockwork
        }
        tp.attachWriteLog({system: 'ecology', kappa: {flora: {current: flora.current}}});
      });
    }

    private genFloraReserve(type: string, seed: string): {reserve: number, current: number, regen_rate: number} {
      const rng = new SeededRNG(`${seed}_${type}_reserve`);
      const classProb = rng.next();
      const baseReserve = type === 'forest' ? 100000 : 50000;  // Units (logs/crops)
      const mult = classProb < 0.1 ? 10 : classProb < 0.4 ? 2 : 1;  // Large: 1M
      return {reserve: baseReserve * mult, current: baseReserve * mult, regen_rate: 0.02};
    }

    private overtax(drain: number, reserve: number): number {
      return Math.min(0.5, drain / (reserve * 0.001));  // Scale factor 0-0.5
    }
    ```
- **Sim Example**: Forest reserve=1M, drain=200/day, regen=0.02/month (~0.67/day). Net -199.33/day → To 50% in ~12.6 years; <10% → Shock at year 25. With seasons (mm-weather): +20% regen spring → Extends to 35 years.

## 2. Economy/Market (Trade Goods, Services—Hub Core)

### Current Thinness
- **Implementation Summary**: mm-economy.ts (~200 lines): Accumulate("supply potential" = static trades * days, no pools); resolve("market prices" = fixed formulas, infinite stock). src/db/schema.ts hubVendors: Inventory FK infinite; mm-market.ts stub (supply/demand static). economy.ts in hub: Exports/imports arrays (fixed, no qty). No scarcity (grok L200: Grep 'supply' =4, all const).
  - Greps: 'yield' in mm-economy.ts=6 (trade yields fixed); 'deplete' =1 (price up on demand, no stock drain). Tests: Covers basics (88%), no long-trade sims.
- **Thin Issues**: Goods don't thin (market always stocked); over-extract floods without crash (iron prices static). City trade sustains forever, no busts (e.g., mining boom → no glut quests).

### Scaled Proposal
- **Reserves**: Per district/market κ {market: {good: {reserve: 1k (stall)/10k (market)/100k (guildhall), current: reserve, restock_rate: 0.1/week}}}. Class from hub.economy.type (trade.large=0.3). Qty math: Good units (e.g., iron ton=1000kg; reserve=tons *1000 for scale).
- **Deplete/Regen**: 
  - Accumulate (L2 weekly): Drain = observed_sales (from mm-services interacts) * rate (0.05/good); current -= drain. Restock = rate * (extraction_inputs + caravan_imports); if flooded (>150%) price-0.2. Low <20%: Spike +0.5 price (yield=1/current * base).
  - Resolve: Outputs prices/supply (view: Full stock list; interact mfCheck for deal).
  - Rates: Iron market: Deplete 2%/week (100 sales); restock 5% from mines (mm-extraction tie). Luxury (gold): Slower regen, higher spikes.
- **Extraction Wiring**: mm-extraction.outputs → economy current+ for materials (e.g., +100 ingots). Over-supply: -restock if ecology thin (depleted mines slow input). Cross: Thin market → mm-faction unrest (+decay if <30%).
- **Grid View & Resources**: use-world resolve district chunks → proj supply voxels (stall icons scale=sqrt(current/reserve); thin=dim). Mapped goods: Global trade via mm-caravan (thin local → import price+).
- **Realism for Mining City Market**: Large iron reserve 50k tons at 500 tons/week trade → To 50% in ~2 years (restock from camps); glut (extraction high) → Price drop year 1 → Diversify quests. 3 weeks? Demand surge (war) drains small stall (1k tons /200/week~5 weeks) → Shortage → Thieves guild rise.
- **Plot Hooks & Cross-Wires**: <20% → Shock (scope 'hub', affected ['faction','narrative'] → Black market). mm-services: Thin goods → HasSmith=false. Tests: 10-week trade cycle (assert price+ on low).
  - Snippet (extend mm-economy.ts; grok L260-280):
    ```ts
    // mm-economy.ts proposal extension
    onAccumulate(days: number, worldDay: number, tp: TP): void {
      this.state.goods.forEach(good => {
        const node = tp.resolve(good.market_node, 'A4_HUB');
        const supply = node.readKappa('market')?.[good.type] ?? this.genSupplyReserve(good.type, tp.seed);
        const demand = this.getDemand(good, node);  // From pop/services
        const drain = demand * 0.05 * days;  // Sales rate
        supply.current = Math.max(0, supply.current - drain);
        const restock = supply.restock_rate * (this.extraction_inputs[good.type] ?? 0) * days;
        supply.current += restock;
        const flood = supply.current / supply.reserve;
        if (flood > 1.5) good.price *= 0.8;  // Glut
        else if (supply.current < supply.reserve * 0.2) good.price *= 1.5;  // Scarce
        tp.attachWriteLog({system: 'economy', kappa: {market: {[good.type]: {current: supply.current}}}});
      });
    }

    private genSupplyReserve(type: string, seed: string): {reserve: number, current: number, restock_rate: number} {
      const rng = new SeededRNG(`${seed}_${type}_supply`);
      const classProb = rng.next();
      const baseReserve = type === 'iron' ? 50000 : 10000;  // Tons
      const mult = classProb < 0.1 ? 10 : classProb < 0.4 ? 3 : 1;  // Large: 500k
      return {reserve: baseReserve * mult, current: baseReserve * mult, restock_rate: 0.1};
    }

    private getDemand(good: string, node: TPNode): number {
      return node.readKappa('settlement')?.pop ?? 10000 * 0.01;  // 1% pop demand base
    }
    ```
- **Sim Example**: Iron reserve=50k, demand=500/week, restock=200/week (mines). Net -300/week → To 20% in ~18 months; price spikes year 1.5 → Econ shock (trade war).

## 3. Settlement/Hub (Pop, Services, Defenses—Hub Impact)

### Current Thinness
- **Implementation Summary**: mm-settlement.ts (~180 lines): Accumulate("pop growth" = fixed 0.01 * days, no decay); resolve("services" = has* booleans static). src/db/schema.ts settlements: Pop integer default0, stability real50 (no auto-decay); districtHubs: Wealth/crime levels fixed. hubNodes: Infinite access.
  - Greps: 'yield' =2 (growth yield); 'regen'=0; 'deplete'=0. Tests: Covers resolve (90%), no decay sims.
- **Thin Issues**: Pop/services static (thin ecology → no famine drop); defenses fixed (militia=pop*0.01, but pop infinite). Hub thins quick if no params (pop boom without food → unrealistic).

### Scaled Proposal
- **Reserves**: κ {settlement: {pop_reserve: 5k (town)/50k (city)/500k (metropolis), current_pop: initial, growth_rate: 0.01/year, decay_factors: {ecology:0, econ:0}}}. Services % current_pop (e.g., guards=2% pop).
- **Deplete/Regen**: 
  - Accumulate (L4 daily): Decay = base0.0005 + thin_factors (ecology_thin*0.01 + econ_thin*0.005) * current_pop * days; current_pop = max(100, current_pop * (1 - decay + growth)). Growth = rate * (wealth_level + services_mult); low pop<10% reserve: Shrink (hasMarket=false).
  - Resolve: Outputs pop/services (view: Dynamic district crowds; interact recruit mfCheck).
  - Rates: Good times: +1%/year; thin ecology: +1% decay/month. Plague shock: -10% one-shot.
- **Extraction Wiring**: Thin extraction (depleted camps) → +decay (econ_thin=0.2). Cross: Ecology current <50% → ecology_factor=0.01 decay.
- **Grid View & Resources**: Hub resolve → pop voxels (district proj: Density=pop/reserve; thin=sparse meshes). Services mapped: Thin pop → fewer node icons (hubNodes.ownerId empty).
- **Realism for Mining City**: Pop reserve 20k at +2% growth -1% decay (rich mines) → Peaks 40k in 20 years, thins to 10k in 40 (depleted). 3 weeks? Famine (ecology tie) -20% → To 16k, defenses thin (militia=320→256 → bandit raids).
- **Plot Hooks & Cross-Wires**: <20% reserve → Shock (scope 'kingdom', affected ['faction','warfare'] → Migration). mm-party settle boosts growth. Tests: 20-year cycle (assert thin at year 30).
  - Snippet (extend mm-settlement.ts; grok L380-400):
    ```ts
    // mm-settlement.ts proposal extension
    onAccumulate(days: number, worldDay: number, tp: TP): void {
      const node = tp.resolve(this.hubId, 'A4_HUB');
      const pop = node.readKappa('settlement')?.pop ?? this.genPopReserve(this.size, tp.seed);
      const ecologyThin = this.getThinFactor('ecology');  // From mm-ecology
      const econThin = this.getThinFactor('economy');
      const decay = 0.0005 + ecologyThin * 0.01 + econThin * 0.005;
      const growth = this.growth_rate * (1 - decay) * pop * days;
      pop.current_pop = Math.max(pop.min_pop, pop.current_pop + growth - (decay * pop.current_pop * days));
      if (pop.current_pop < pop.reserve * 0.2) {
        this.emitShock({scope: 'hub', type: 'overpopulation_strain', affected: ['services', 'defenses']});
        // Thin services: e.g., hasInn = pop.current_pop > 5000
      }
      tp.attachWriteLog({system: 'settlement', kappa: {pop: {current_pop: pop.current_pop}}});
      // Services update: militia = pop.current_pop * 0.02
    }

    private genPopReserve(size: HubSize, seed: string): {reserve: number, current_pop: number, growth_rate: number, min_pop: number} {
      const rng = new SeededRNG(`${seed}_pop`);
      const baseReserve = size === 'city' ? 50000 : size === 'town' ? 10000 : 2000;
      return {reserve: baseReserve, current_pop: baseReserve * 0.5, growth_rate: 0.01, min_pop: 100};
    }

    private getThinFactor(system: string): number {
      // Query cross-MM (e.g., ecology.current < 0.5 ? 0.2 : 0)
      return 0;  // Stub
    }
    ```
- **Sim Example**: Reserve=20k, start 10k, growth=0.01, decay=0.005 (mild thin) → Net +0.5%/year → To 25k in 20 years; heavy thin (decay=0.015) → Decline to 5k in 10 years. Shock at 4k → Famine event.

## 4. Faction/Social (Influence, Goals—Abstract Pools)

### Current Thinness
- **Implementation Summary**: mm-faction.ts (~120 lines stub): Accumulate("influence shift" = fixed alliances, no erosion); resolve("goals" = static list). districtHubs: Factions array {influence: number fixed}. mm-social.ts light (morale static).
  - Greps: 'yield'=3 (alliance yields); 'regen'=1 (influence regen monthly fixed+1); 'deplete'=0. Tests: Basic shifts (95%), no erosion sims.
- **Thin Issues**: Influence static (guilds never weaken); thin econ/ecology no backlash (mining guild infinite power). Social thins quick (unrest fixed, no pop tie).

### Scaled Proposal
- **Reserves**: κ {faction: {influence_reserve: 100 (minor)/1000 (major guild)/10k (kingdom), current: initial, decay_rate: 0.005/month, loyalty_mult:1}}. Class from settlement.governance (guild.type=major prob0.2).
- **Deplete/Regen**: 
  - Accumulate (L3 quarterly): Decay = rate * thin_threats (econ_thin*0.1 + ecology_thin*0.05 + rival_wins*0.2); current -= decay. Regen = +0.01 * successes (mm-diplomacy ties) * loyalty (pop support).
  - Resolve: Outputs influence/goals (view: District tint by strength; interact scheme mfCheck).
  - Rates: Miner guild: Decay 0.5%/month if mines thin; regen +1% per trade win.
- **Extraction Wiring**: Thin extraction → +decay for miners (influence- on deplete). Cross: Ecology thin → All factions +0.05 decay (unrest).
- **Grid View & Resources**: Resolve district → Influence voxels (proj: Strong=bright overlay, thin=fade; goal icons). Social mapped: Global via mm-intelligence (thin faction → Spy quests).
- **Realism for Mining City**: Major miners 800 influence at +1% regen -0.5% decay (prosper) → Stable 10 years; thin deposits → Decay to 400 in 5 years (power struggle). 3 weeks? Betrayal (stolen vein) -15% → Coup (player ally choice).
- **Plot Hooks & Cross-Wires**: <20% → Shock (scope 'region', affected ['warfare','narrative'] → Revolt). mm-intelligence goals: Low→ "seize resources". Tests: 5-year shift cycle.
  - Snippet (extend mm-faction.ts; grok L490-510):
    ```ts
    // mm-faction.ts proposal extension
    onAccumulate(days: number, worldDay: number, tp: TP): void {
      this.state.factions.forEach(fac => {
        const node = tp.resolve(fac.district, 'A4_HUB');
        const inf = node.readKappa('faction')?.[fac.id] ?? this.genInfluenceReserve(fac.type, tp.seed);
        const econThin = this.getThinFactor('economy', node);  // From mm-economy
        const decay = inf.decay_rate * (econThin * 0.1 + this.rival_activity * 0.2) * days;
        inf.current = Math.max(0, inf.current - decay);
        const regen = 0.01 * this.successes * inf.loyalty_mult * days;  // Ties to pop
        inf.current += regen;
        if (inf.current < inf.reserve * 0.2) {
          this.emitShock({scope: 'hub', type: 'faction_weakening', affected: ['social', 'quests']});
        }
        tp.attachWriteLog({system: 'faction', kappa: {[fac.id]: {current: inf.current}}});
      });
    }

    private genInfluenceReserve(type: string, seed: string): {reserve: number, current: number, decay_rate: number, loyalty_mult: number} {
      const rng = new SeededRNG(`${seed}_${type}_inf`);
      const baseReserve = type === 'major' ? 1000 : 100;
      const mult = rng.range(0.8, 1.2);
      return {reserve: baseReserve * mult, current: baseReserve * 0.8, decay_rate: 0.005, loyalty_mult: 1};
    }

    private getThinFactor(system: string, node: TPNode): number {
      return node.readKappa(system)?.current < 0.5 ? 0.2 : 0;
    }
    ```
- **Sim Example**: Reserve=1000, start 800, regen=0.01/month, decay=0.005 (stable) → +0.5%/month → Peaks 1200 in 10 months; thin (decay=0.015) → To 400 in 30 months. Shock at 200 → Revolt.

## 5. Quick Hits for Other Systems

### Caravans/Edges (mm-caravan.ts Stub)
- **Thinness**: Routes static; traffic infinite (no wear).
- **Scale**: κ {edge: {traffic_reserve: 100 trips/month, current_load:0, wear_rate:0.01/trip}}. Deplete: Over>reserve → danger+0.2 (3 weeks heavy=bandit event). Regen: Monthly -0.1 if low.
- **Wiring**: Extraction hauls thin on deplete (caravan capacity=reserve*0.5). View: Edge proj (voxel wear tint).
- **Realism**: Mining city caravan 50 trips/month reserve → Thin to danger in 2 months overuse. Hooks: Collapse on thin.

### Monsters/Threats (No Dedicated MM; Stub in mm-ecology?)
- **Thinness**: Spawns prob fixed (infinite lairs).
- **Scale**: κ {threat: {lair_reserve: 50 (small pack)/500 (nest), current: reserve, spawn_rate:0.1/day}}. Deplete on kill (mm-combat); regen seasonal.
- **Wiring**: Ecology thin → +spawn (deforest=monster+). Grid: Proj lairs (density voxels).
- **Realism**: City thin resources → Monster migrate (3 weeks → Raid wave). Hooks: Clear lair → Temp thin threats.

### Quests/Narrative (mm-adventure.ts)
- **Thinness**: Pool static (infinite arcs).
- **Scale**: No full reserve; "budget" from thin (e.g., ecology_thin → +20% depletion quests). Thresholds auto-gen (low econ → "Trade route" prob*2).
- **Wiring**: Shocks input to pool (e.g., faction thin → Rival arc). View: Quest board updates on resolve.
- **Realism**: Mining thin → 30% quests "New vein" (sustains arc). No 3-week deplete—quests regen procedurally.

## Summary & Recommendations
- **Thickness Gains**: Finite κ prevents infinity (10-50 year hubs); thresholds → 20% more plot (shocks/quests). Global procedural (noise bias) keeps endless exploration.
- **Total Edits**: 5-10 MMs (~150 lines each: Add κ/params); Clockwork registers (L2-L5). Tests: Add cycle suites (npm run test:watch; sim 20 years → Assert no crash).
- **Risks**: Over-param (tune rates in config); Perf: Client resolve cheap (memo blends). Next: Full stubs or UI mocks?

**Grok Refs**: Greps appendix (L550+); Sims in code blocks (e.g., ecology 50-year curve).