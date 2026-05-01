# Aquatic Wildlife Mapping: Ocean and Water Body Expansion

## Overview

This blueprint extends the fauna and ecology mappings (`docs/fauna-flora-mapping.md`, `docs/fauna-predation-domestication.md`) to aquatic environments, enabling procedural generation and interactions in oceans, rivers, lakes, and estuaries. It covers shellfish (bivalves, crustaceans), fish (prey and predators across sizes), aquatic mammals, cephalopods (octopi, squid), and sessile organisms (sponges, anemones). Variants distinguish freshwater (rivers/lakes), saltwater (oceans), and brackish (estuaries) biomes, with size tiers (small: forageable; medium: fishing yields; large: epic hunts).

The model supports ocean expansion: Hex/axial coords in `game/hex.ts` gain water depths (0-10 levels, e.g., coastal shallows to abyssal trenches), generating wildlife density via `noise.ts` (seed: worldDay + nodeId + depth). Interactions drive skills like Fishing (Survival), Diving (Athletics), and Marine Handling (Animal Handling variant), tying into predation/domestication (e.g., hunt fish for food, tame dolphins for scouts).

Core principles:
- **Deterministic aquatic gen**: Noise-driven populations (e.g., high fish in reefs, sparse in deep sea); depletion via ecology MM.
- **TP κ progression**: Deltas store knowledge (e.g., `κ.knowledge.aquatic[<body>][<species>].habits`), reducing DCs for repeat dives (-1 per success).
- **MM integration**: Extend `mm-ecology` for water currents/migration; `mm-economy` for seafood markets; `mm-party` for aquatic followers.
- **Risk/reward**: Saltwater: Higher yields, hazards (currents, predators). Freshwater: Sustainable, but seasonal (dry-ups). Large species: Group efforts required.
- **Persistence**: Aquatic actions as TPB variants (`fishHarvest`, `diveTrap`) via `applyIntent()` → flywheel. Tamed swimmers attach as κ-followers.
- **Lore bag prep**: Keywords/embeddings for ML (e.g., "ink cloud evasion" → semantic tactics queries).

No breaking changes: Builds on existing region features (`game/regionFeatures.ts` adds `aquaticBiome` types). Limit to 10-15 species per water body for scalability; procedural via biome noise.

## Core Interaction Flow

1. **Generation and Observation**: On `observe(waterNodeId)` or worldgen (`game/world.ts`), instantiate via depth/biome:
   - `density`: 0-1 (high in shallows/coastal; low in deep/abyssal).
   - `properties`: Edibility, toxicity, mobility (swim speed).
   - Water types: Freshwater (rivers/lakes: +regen, low hazard); Saltwater (oceans: +yield, high predators); Brackish (estuaries: hybrid, migration hubs).

2. **Aquatic Skills** (Client `engine-client.ts`):
   - **Fish/Harvest**: Passive (nets/lines) or active (spear). `applyIntent('fishAquatic', {method: 'net' | 'spear', depthLevel})` → `mfFish(skillMod, DC)`.
   - **Dive/Trap**: Submerge for capture. `applyIntent('diveTrap', {gear: 'hook' | 'cage', duration})` → `mfAthletics(DC + depthMod)`.
   - **Tame**: Bond with intelligent species. `applyIntent('tameAquatic', {bait, patience})` → `mfMarineHandling(DC - knowledge)`.
   - **Domesticate**: For aquaculture/farms. `applyIntent('domesticateAquatic', {pondLevel, time})` → Multi-tick resolves (seasonal breeding).
   - Mods: Gear (-2 DC for fins), weather (+3 in storms), pollution (from settlements: -density).

3. **Outcomes and Receipts**:
   - Success: `{output: {yield: {meat: 1d8, scales: boolean}, bondLevel: 1-4}, receipt: {roll, DC, hazards}}`.
   - Failure: Aquatic hazards (e.g., riptide → exhaustion `mfDamage(1d6)`; predator attract → ambush).
   - Depletion: -0.03-0.15 density (faster in overfished areas); regen via tides/seasons in ecology MM.

4. **TP Deltas**:
   - `κ.knowledge.aquatic[<waterBody>][<species>] = {migration: {...}, toxins: boolean, swimDepth: number}`.
   - Cross-wires: Harvest → `MM_ECONOMY` (seafood supply); Tame → `MM_PARTY` (aquatic scout); Domesticate → `MM_SETTLEMENT` (fish ponds +food/utility).

5. **API Hooks** (`src/app/api/aquatic/`):
   - **POST /api/aquatic/interact**: `{action: 'fish' | 'dive' | ..., speciesId, depth, params}` → Zod validation, JSON output + TPB buffer.
     ```typescript
     const AquaticInteractSchema = z.object({
       action: z.enum(['fish', 'diveTrap', 'tameAquatic', 'domesticateAquatic']),
       speciesId: z.string(),
       waterType: z.enum(['fresh', 'salt', 'brackish']),
       skill: z.enum(['survival', 'athletics', 'marineHandling']),
       roll: z.number(),
       params: z.object({method?: string, depth?: number}),
     });
     ```
   - **GET /api/aquatic/state?nodeId=123&depth=2**: `{species: [{id, density, variant}], currents: {speed, direction}}` (from TP/mm_states).
   - Cron: `/api/cron/aquatic-migrate` (monthly): Shift densities by currents; unobserved regen.

6. **MM Wiring** (Extend `engine/mm-ecology.ts` for water layers):
   - **Accumulate** (tidal/daily):
     ```typescript
     onAccumulate(days: number): void {
       this.aquaticSpecies.forEach(species => {
         species.density += migrationRate * days; // Saltwater: +0.01 (tides); Freshwater: seasonal +0.05
         if (species.depth > 5) species.density *= 0.9; // Deep pressure decay
         if (domesticatedCount > 0) { // Aquaculture: +0.2 yield if pondLevel >=1
         }
       });
     }
     ```
   - **Resolve** (on interact/dive): Apply MF, emit TPB, snapshot currents/hazards.
   - Clockwork: L5 ECOLOGY (tidal for coastal, monthly for deep). Deps: L1 PHYSICAL (weather/waves), L2 ECONOMY (fishing demand).

## Ocean Biome Expansion

- **Spatial Layers** (`game/hex.ts` extension): Water nodes get `depthLevel: 0 (surface) to 10 (abyssal)`. Coastal (depth 0-2: high density shellfish/fish); Pelagic (3-6: migrants/mammals); Abyssal (7-10: rare predators/sponges, high DC +10).
- **Generation** (`noise.ts`): `generateAquaticDensity(seed, biome, depth, salinity)` – Perlin for schools (clustered +0.2), salinity gradient (fresh: clear water +regen; salt: turbulent -stability).
- **Currents/Edges** (`system-edges.ts`): Wire to weather MM (storms disperse schools); settlement pollution κ reduces density in rivers.
- **UI Hooks** (`surfaces/Play.tsx`): Depth-projected grid (blue hues for layers); dive mini-game (progress bar for Athletics); boat/ship interfaces for ocean travel.

## Shellfish Mapping

Sessile/bottom-dwellers. Focus: Foraging/harvesting for food/tools. Low mobility, high sustainability.

### Templates & Examples

- **Small Shellfish (Common, Density 0.8-1.0, Base DC 8-10, Freshwater/Salt Variants)**:
  - **Clams** (Bivalves, Freshwater: Rivers; Salt: Coastal):
    - **Harvest** (Survival DC 9, -2 with rake): `mfHarvest` → 1d6 meat (protein), shells (tools). Salt variant: Pearl chance (1%). Failure: Burrow escape.
    - **Trap** (DC 10): Bed collection → Live for pearls/aquaculture.
    - **Tame/Domesticate**: N/A (sessile); but farm beds (DC 12, ponds +1 food/day).
    - TP Delta: `knowledge.aquatic.clams = {bedDepth: 0.5m, filterFeeder: true}`.
    - Lore Bag: Keywords: ["bivalve", "pearl", "burrow", "filter", "coastal"] (Salt); ["freshwater", "edible", "riverbed"] (Fresh).
    - MM Tie: Density -0.02; regens fast in currents.

  - **Crayfish** (Crustaceans, Freshwater: Lakes; Brackish: Estuaries):
    - **Harvest** (DC 10): Trap pots → 1d4 meat, claws (bait). Failure: Pinch (1d4 piercing).
    - **Trap** (DC 11): Live for bait/trade.
    - **Domesticate** (DC 14, 5 days): Pond stock (+0.5 food/utility).
    - TP Delta: `habits: 'nocturnal scavenger', trapBait: 'fish scraps'`.
    - Lore Bag: Keywords: ["crustacean", "pinch", "scavenger", "fresh", "estuary"].

- **Medium Shellfish (Medium, Density 0.5-0.8, Base DC 12-14)**:
  - **Oysters** (Saltwater: Reefs):
    - **Harvest** (DC 13, diving gear -2): → Oysters (aphrodisiac food), pearls (wealth). Hazard: Barnacle cuts (1d6 slashing).
    - **Trap** (DC 14): Reef farms.
    - **Domesticate** (DC 16): Aquaculture beds (+2 trade/settlement).
    - TP Delta: `toxins: 'red tide risk', pearlRarity: 0.1`.
    - Lore Bag: Keywords: ["oyster", "pearl", "reef", "aphrodisiac", "salt"].

  - **Lobster** (Salt/Brackish: Deep coastal):
    - **Harvest** (DC 14, depth +3): → Meat (feast), shell (armor). Failure: Claw trap (1d8).
    - **Trap** (DC 15): Pots for live export.
    - **Domesticate** (DC 18): Rare farms (+3 luxury economy).
    - TP Delta: `molting: 'summer', hideouts: 'crevices'`.
    - Lore Bag: Keywords: ["crustacean", "claw", "luxury", "deep", "brackish"].

- **Large Shellfish (Rare, Density 0.2-0.5, Base DC 16-18)**:
  - **Giant Clam** (Saltwater: Coral depths 3-5):
    - **Harvest** (DC 17, group -4): → Massive meat/feed, iridescent shell (shields). Hazard: Clamp (2d6 crushing).
    - **Trap** (DC 18): For pearl quests.
    - **Domesticate** (DC 20): Monumental farms (legendary yield).
    - TP Delta: `symbiosis: 'algae', size: '2m'`.
    - Lore Bag: Keywords: ["giant", "clamp", "coral", "pearl", "abyssal"].

## Fish Mapping

Swimming schools. Prey fish (omnivorous/herbivorous) vs. predators. Sizes scale yield/risk.

### Templates & Examples (Prey Fish)

- **Small Prey Fish (Common, Density 0.9-1.0, Base DC 6-9, All Waters)**:
  - **Minnows** (Freshwater: Rivers; Salt: Schools):
    - **Fish** (Survival DC 7, line -1): → Bait/fodder (1d4). Salt: +swim speed for lures.
    - **Trap** (DC 8): Nets for aquariums.
    - **Tame** (N/A); Domesticate (DC 10): Bait farms.
    - TP Delta: `schools: 'shoal behavior', baitValue: high`.
    - Lore Bag: Keywords: ["prey", "shoal", "bait", "fresh", "minnow"] (Fresh); ["silver", "ocean", "fodder"] (Salt).

  - **Sardines** (Saltwater: Pelagic):
    - **Fish** (DC 9, net): → Oil/food (1d6 rations). Hazard: Over-net (entangle 1d4).
    - **Trap** (DC 10): For preserves.
    - **Domesticate** (DC 12): Canned economy boost.
    - TP Delta: `migration: 'seasonal runs'`.
    - Lore Bag: Keywords: ["sardine", "oil", "school", "pelagic", "salt"].

- **Medium Prey Fish (Medium, Density 0.4-0.7, Base DC 11-13)**:
  - **Trout** (Freshwater: Lakes; Brackish: Rivers):
    - **Fish** (DC 12, fly -2): → Fillets (healing food), scales (craft). Failure: Hook slip.
    - **Trap** (DC 13): Weirs for stocking.
    - **Domesticate** (DC 15): Pond trout (+2 food, fresh purity).
    - TP Delta: `habits: 'cold stream', jumping: evasion`.
    - Lore Bag: Keywords: ["trout", "fly-fishing", "fresh", "jumpy", "fillet"].

  - **Mackerel** (Saltwater: Coastal):
    - **Fish** (DC 13): → Smoked meat, fins (lures). Hazard: Storm scatter.
    - **Trap** (DC 14): Purse seines.
    - **Domesticate** (DC 16): Offshore pens.
    - TP Delta: `speed: 20knots, oily: preserve well`.
    - Lore Bag: Keywords: ["mackerel", "smoke", "coastal", "fast", "salt"].

- **Large Prey Fish (Rare, Density 0.1-0.4, Base DC 15-17)**:
  - **Salmon** (Fresh/Brackish: Rivers, anadromous):
    - **Fish** (DC 16, spear): → Huge fillets (2d8 food), eggs (spawn). Failure: Upstream fight.
    - **Trap** (DC 17): Fish ladders (sustainable).
    - **Domesticate** (DC 19): Salmon runs (+5 economy, migration quests).
    - TP Delta: `lifeCycle: 'spawn upstream', strength: 16`.
    - Lore Bag: Keywords: ["salmon", "spawn", "anadromous", "river", "brackish"].

## Predator Fish Mapping

Aggressive hunters. High risk (bites), rewards (trophies).

- **Small Predators (Common, Density 0.6-0.9, Base DC 10-12)**:
  - **Piranha** (Freshwater: Rivers):
    - **Fish** (DC 11, chum bait): → Jaws (tools), meat (minor poison). Hazard: Swarm bite (1d6).
    - **Trap** (DC 12): For aquariums (exotic trade).
    - **Tame** (N/A); Domesticate (DC 14): Guard ponds (deter thieves).
    - TP Delta: `packHunt: 'frenzy', bloodScent`.
    - Lore Bag: Keywords: ["piranha", "swarm", "bite", "fresh", "frenzy"].

- **Medium Predators (Medium, Density 0.3-0.6, Base DC 14-16)**:
  - **Barracuda** (Saltwater: Reefs):
    - **Fish** (DC 15, lure): → Teeth (daggers), flesh (speed potion base). Failure: Strike (1d10 piercing).
    - **Trap** (DC 16): Harpoons for sport.
    - **Tame** (DC 15): Rare solo guard.
    - **Domesticate** (DC 18): Training for fighters.
    - TP Delta: `ambush: 'strike fast', solitary`.
    - Lore Bag: Keywords: ["barracuda", "teeth", "ambush", "reef", "salt"].

- **Large Predators (Rare, Density 0.1-0.3, Base DC 18-22)**:
  - **Shark** (Saltwater: Open ocean, depths 4+):
    - **Fish** (DC 20, chum boat): → Fins (soup/wealth), jaws (legendary weapon). Hazard: Jaw lock (3d8).
    - **Trap** (DC 21): Group hunt only.
    - **Tame** (DC 19): Mythic rider (druid only).
    - **Domesticate** (N/A); but trophy κ prestige +10.
    - TP Delta: `senses: 'electro-location', migration: global`.
    - Lore Bag: Keywords: ["shark", "fin", "apex", "deep", "salt"].

  - **Great White** (Rare variant, DC +5): Epic quest (whale hunt parallel).

## Aquatic Mammals Mapping

Intelligent, tamable. Focus: Allies/utility over food (ethical DCs +2 for hunting).

- **Small Mammals (Medium, Density 0.4-0.7, Base DC 12-15, Salt/Fresh)**:
  - **Otter** (Fresh/Brackish: Rivers):
    - **Hunt** (DC 13, rare): Fur (warmth), playfulness lore. (Prefer tame.)
    - **Trap** (DC 14): Live for study.
    - **Tame** (DC 12): Tool user ally (+2 crafting underwater, 5 days).
    - **Domesticate** (DC 16, 10 days): River guide (+navigation).
    - TP Delta: `habits: 'playful diver', toolUse: shells`.
    - Lore Bag: Keywords: ["otter", "fur", "playful", "river", "fresh"].

- **Medium Mammals (Rare, Density 0.2-0.5, Base DC 16-19)**:
  - **Dolphin** (Saltwater: Coastal/pelagic):
    - **Hunt** (DC 17, taboo +3): Blubber (oil), echolocation study.
    - **Trap** (N/A); Tame (DC 16): Pod scout (sonar detect, 7 days).
    - **Domesticate** (DC 20): Ship companion (+2 sea travel).
    - TP Delta: `intelligence: high, podTactics: flank`.
    - Lore Bag: Keywords: ["dolphin", "echolocation", "pod", "intelligent", "salt"].

- **Large Mammals (Very Rare, Density 0.05-0.2, Base DC 20-25)**:
  - **Whale** (Saltwater: Deep ocean):
    - **Hunt** (DC 24, harpoon fleet): Ambergris (perfume wealth), baleen (tools). Hazard: Tail slap (4d10).
    - **Trap** (N/A); Tame (DC 22, mythic): Legendary mount.
    - **Domesticate** (N/A); but songs in κ.narrative.
    - TP Delta: `migration: 'seasonal songs', size: colossal`.
    - Lore Bag: Keywords: ["whale", "song", "baleen", "deep", "apex"].

## Cephalopods and Sessile Mapping

- **Cephalopods (Mobile hunters, Saltwater dominant)**:
  - **Octopus** (Coastal reefs, depths 1-4; Density 0.3-0.6, DC 14-17):
    - **Hunt** (DC 15, ink dodge): Tentacles (potions), ink (stealth). Failure: Squeeze (1d8).
    - **Trap** (DC 16): Pots for food.
    - **Tame** (DC 15): Camouflage ally (+3 stealth, 3 days).
    - **Domesticate** (DC 18): Ink farms (alchemical).
    - TP Delta: `camouflage: 'color shift', intelligence: puzzle-solver`.
    - Lore Bag: Keywords: ["octopus", "ink", "tentacle", "camouflage", "reef"].
    - Variants: Giant Octopus (Large, DC +5, abyssal).

  - **Squid** (Pelagic/open sea; Density 0.2-0.5, DC 13-16):
    - Similar to octopus, but faster: **Fish** (DC 14) → Beak (weapons), mantle (leather).
    - Tame for speed bursts; Lore: ["squid", "jet", "school", "deep", "salt"].

- **Sessile Organisms (Fixed, like sponges; Density 0.7-1.0, DC 9-12)**:
  - **Sea Sponge** (Saltwater: Reefs/abyssal; all depths):
    - **Harvest** (DC 10, knife): Absorbent (bandages), skeleton (filters). Failure: Fragment sting.
    - **Trap** (N/A); Domesticate (DC 13): Reef farms (healing trade).
    - TP Delta: `growth: 'slow filter', toxicity: low`.
    - Lore Bag: Keywords: ["sponge", "absorbent", "reef", "filter", "sessile"].
    - Variants: Freshwater Sponge (Rivers, DC 9, +regen).

  - **Anemone** (Coastal, Salt/Brackish; symbiotic):
    - **Harvest** (DC 11): Tentacles (poison), host fish lore.
    - Tame clownfish (DC 12): Symbiotic pet (+1 poison resist).
    - TP Delta: `sting: nematocysts`, mutualism.
    - Lore Bag: Keywords: ["anemone", "sting", "symbiosis", "clownfish", "coastal"].

## System Edges and Hazards

- **Edges** (`engine/system-edges.ts`):
  - Harvest → `MM_ECONOMY` (seafood prices, pearl booms).
  - Tame → `MM_SCENE` (underwater combat aids, e.g., dolphin push).
  - Domesticate → `MM_SETTLEMENT` (aquafarms +sustainability).
  - Predation: Sharks deplete fish schools (-0.1 in accumulate); currents migrate mammals.

- **Hazards**:
  - Depth/Current: +DC per level; riptide `HazardEvent: {type: 'undertow', severity: 0.6}` → Swim check or drown.
  - Toxicity: Salt red tides (DC 15 Con save or poisoned); Fresh algae blooms.
  - Overfishing: Density <0.1 → `κ.aquaticDepletion = true` (famine quests, +5 DCs).

## Implementation Roadmap

1. **Phase 1**: Extend noise.ts for aquatic gen (depth/salinity), define MFs (`mfFish`, `mfDive` in `engine/mf-aquatic.ts`), TPB variants (`fishHarvestSchema`).
2. **Phase 2**: Wire mm-ecology (tidal accumulate, migration resolve), unit tests (DCs, deltas, hazards).
3. **Phase 3**: API routes (`/api/aquatic/interact`), hex depth in game/hex.ts, validation.
4. **Phase 4**: UI (dive HUD in Play/Settlement, ocean visuals in aperture), lore bag additions (grok/lore-bag.json aquatic section).
5. **Tests/Milestone**: 15+ interactions covered; `npm run test` to 1900+ passing. Synergies: Aquatic tames for deep mining (submarine hauls), ecology studies (coral knowledge).

Risks: Balance deep-sea DCs (avoid unbeatable); limit tamed swimmers to coastal (no abyssal parties). Expansion enables sea campaigns: Pirate quests, underwater ruins via depth nodes.

---
*Last Updated: Complements fauna-predation; cross-ref mining-layers for aquatic ore (e.g., pearl synergies).*
