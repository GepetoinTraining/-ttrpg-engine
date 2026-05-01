# Fauna Predation and Domestication Blueprint

## Overview

This blueprint extends the fauna mapping from `docs/fauna-flora-mapping.md` to introduce predation and domestication mechanics. It focuses on carnivore/herbivore interactions via skills: **hunt** (lethal gathering), **trap** (non-lethal capture), **tame** (wild ally), and **domesticate** (permanent companion/livestock). These arise from ecological realism—herbivores sustain food chains (grazing → herds), carnivores enforce predation (apex hunters → rare trophies).

Key principles:
- **Deterministic skills**: Use MFs like `mfHunt` or `mfAnimalHandling` for rolls (output: success metrics; receipt: DC, mods).
- **TP κ progression**: Successful interactions append knowledge deltas (e.g., `κ.knowledge.fauna[<species>].habits`), lowering future DCs (-2 per tier).
- **MM ties**: `mm-ecology` for population dynamics (depletion/growth); `mm-party`/`mm-followers` for tamed/domesticated entities; `mm-economy` for pelts/meat markets.
- **Risk/reward**: Herbivores: Low DC, sustainable (herd respawn). Carnivores: High DC, dangerous (injury, alerts).
- **Persistence**: Actions buffer as TPB variants (`huntFauna`, etc.) via `applyIntent()` → flywheel push. Domesticated fauna become κ-attached to party/settlement nodes.
- **Lore bag integration**: Each species contributes keywords/embeddings for ML (e.g., "pack hunter tactics" → vector search for strategies).

No breaking changes: Builds on existing fauna templates (e.g., rabbit, deer, owl). Max 5-10 species per biome to avoid bloat; procedural via `noise.ts` (seed: worldDay + regionId).

## Core Interaction Flow

1. **Detection/Encounter**: In `useWorld()` hook or `observe(regionNode)`, scan for fauna density (from `mm-ecology.accumulate()`). Roll Perception (DC 10 + rarity mod) to spot.
   
2. **Skill Application** (Client `engine-client.ts`):
   - **Hunt**: Lethal, yields resources (meat, pelts). `applyIntent('huntFauna', {speciesId, method: 'bow' | 'spear'})` → `mfHunt(skillMod, DC)`.
   - **Trap**: Capture alive. `applyIntent('trapFauna', {baitType, durationDays})` → `mfTrap(DC + weatherMod)`.
   - **Tame**: Temporary bond (1-7 days). `applyIntent('tameFauna', {foodOffering, patienceDays})` → `mfAnimalHandling(DC - priorKnowledge)`.
   - **Domesticate**: Permanent (requires settlement). `applyIntent('domesticateFauna', {facilityLevel, trainingTime})` → Multi-stage resolves over weeks (cron-ticked).
   
3. **Outcomes and Receipts**:
   - Success: `{output: {yield: {meat: 1d6, pelt: boolean}, bondLevel: 1-5}, receipt: {roll, DC, mods}}`.
   - Failure: Hazards (e.g., carnivore counterattack → `mfDamage(1d8)`; herbivore escape → density +0.1).
   - Depletion: Reduce local density by 0.05-0.2 (regen via ecology MM seasonal ticks).

4. **TP Deltas**:
   - Stored in `κ.knowledge.fauna[<region>][<species>] = {habits: {...}, tactics: [...], bondTier: number}`.
   - Cross-wires: Hunt → `MM_ECONOMY.marketUpdate(supply)`; Tame → `MM_PARTY.followers.add(tempCompanion)`; Domesticate → `MM_SETTLEMENT.livestock += {species, count}`.

5. **API Hooks** (`src/app/api/fauna/`):
   - **POST /api/fauna/interact**: `{action: 'hunt' | 'trap' | ..., speciesId, params}` → Validate cert, return JSON output + buffer TPB action.
     - Zod: 
       ```typescript
       const FaunaInteractSchema = z.object({
         action: z.enum(['hunt', 'trap', 'tame', 'domesticate']),
         speciesId: z.string(),
         skill: z.enum(['survival', 'animalHandling']),
         roll: z.number(),
         params: z.object({method?: string, duration?: number}),
       });
       ```
   - **GET /api/fauna/state?regionId=123**: Returns `{species: [{id, density, knowledgeTier}]} from TP resolve or mm_states`.
   - Cron: `/api/cron/fauna-regen` (seasonal): Regrow densities if > threshold days unobserved.

6. **MM Wiring** (Extend `engine/mm-ecology.ts` and `mm-followers.ts`):
   - **Accumulate** (daily): 
     ```typescript
     onAccumulate(days: number): void {
       this.fauna.forEach(species => {
         species.density += growthRate * days; // Cap at 1.0; herbivores faster (0.02/day)
         if (species.domesticatedCount > 0) {
           // Breed: +0.1 count if facilityLevel >=2
         }
       });
     }
     ```
   - **Resolve** (on interact/observe): Apply skill MF, emit TPB action, snapshot to `mm_states`.
   - Clockwork: L5 ECOLOGY (daily for wild; weekly for domesticated). Deps: L4 FACTION (poaching laws), L2 ECONOMY (demand mods DCs).

## Herbivore Mapping

Herbivores: Grazers/prey. Focus: Sustainable hunting/trapping for food/fiber. Lower risks, higher yields in herds.

### Templates & Examples

- **Small Herbivores (Common, Density 0.7-1.0, Base DC 10-12)**: Quick, low yield.
  - **Rabbit** (from prior mapping):
    - **Hunt** (Survival DC 10): `mfHunt` → Yield: 1d4 meat, pelt (crafting). Failure: Escapes, +noise (alerts predators 20%).
    - **Trap** (Survival DC 12): Bait (veggies) → Capture live (sell/train as pet). Duration: 1 day; failure: Gnaws free.
    - **Tame** (Animal Handling DC 11): Feed carrots → Temp scout ( +2 Perception, 3 days). Bond: Shares burrow locations.
    - **Domesticate** (DC 15, 7 days training): Farm rabbit → +1 food/day/settlement. TP Delta: `knowledge.fauna.rabbit = {habits: 'burrow networks', breedRate: 0.1/week}`.
    - Lore Bag: Keywords: ["prey", "fur", "burrow", "prolific", "trap-bait"].
    - MM Tie: Depletes density -0.05; regens fast (seasonal +0.2).

  - **Squirrel**:
    - **Hunt** (DC 12): Acorn season bonus (-2 DC) → Nuts (rations), tail (fletching).
    - **Trap** (DC 13): Nut bait → Live for study (intelligence +1d4 lore).
    - **Tame** (DC 10): → Hoarder ally (finds hidden caches, 1/day).
    - **Domesticate** (DC 16): Rare; pest control in settlements.
    - TP Delta: `tactics: ['tree-leap evasion']`; unlocks foraging progression.
    - Lore Bag: Keywords: ["nut-hoarder", "agile", "tree-dweller", "small-game"].

- **Medium Herbivores (Medium, Density 0.4-0.8, Base DC 14-16)**: Herds, moderate yield.
  - **Deer** (from prior):
    - **Hunt** (Survival DC 15): Stealth mod ( -1 per tracker) → 2d6 meat, antlers (tools). Failure: Stag charge (1d8 bludgeoning).
    - **Trap** (DC 16): Pitfall → Live for transport (trade value x2). Risk: Injury to animal (reduces yield).
    - **Tame** (DC 14): Lure with salt lick → Mount (speed +10ft, 5 days). Bond: Warns of ambushes.
    - **Domesticate** (DC 18, 14 days): Herd animal → Milk/meat production (+5 food/week). Requires pasture κ in settlement.
    - TP Delta: `knowledge.fauna.deer = {migration: 'autumn rut', herdSize: 10-20}`.
    - Lore Bag: Keywords: ["grazer", "antler", "herd", "seasonal", "mount"].
    - MM Tie: Herd depletion -0.1; faction quest if overhunted (enmity +1).

  - **Goat** (Wild variant):
    - **Hunt** (DC 14): Cliff terrain +2 DC → Milk glands (healing), horns (weapons).
    - **Trap** (DC 15): → Live for cheese production.
    - **Tame** (DC 13): → Sure-footed guide in mountains.
    - **Domesticate** (DC 17): Livestock staple (+3 utility/settlement).
    - TP Delta: `habits: 'browse scrub', terrainAdapt: 'rocky'`.
    - Lore Bag: Keywords: ["climber", "milk", "stubborn", "herbivore", "domestic-potential"].

- **Large Herbivores (Rare, Density 0.2-0.5, Base DC 18-20)**: Epic hunts, high reward.
  - **Boar**:
    - **Hunt** (DC 19): Tusks for gore → 3d6 meat, hide (armor). Failure: Charge (2d6 slashing).
    - **Trap** (DC 20): Heavy snare → Trophy (faction prestige).
    - **Tame** (DC 18): → Guard beast ( +4 intimidation).
    - **Domesticate** (DC 22, 30 days): Pork production (+10 food/month).
    - TP Delta: `tactics: ['charge defense', wallowHabits]`.
    - Lore Bag: Keywords: ["tusked", "ferocious", "forager", "wild-pig", "trophy"].

## Carnivore Mapping

Carnivores: Predators. Focus: High-risk taming for combat allies; hunting yields status items but depletes food chains.

### Templates & Examples

- **Small Carnivores (Common, Density 0.6-0.9, Base DC 12-15)**: Scavengers, trainable pets.
  - **Fox**:
    - **Hunt** (Survival DC 13): Cunning prey → Pelt (stealth cloak), meat (minor poison resist).
    - **Trap** (DC 14): Live bait (chicken) → Study for trickster lore.
    - **Tame** (DC 12): Meat offerings → Scout (detect traps, 4 days).
    - **Domesticate** (DC 16, 10 days): Pet/hunter aid (+1 to tracking rolls).
    - TP Delta: `knowledge.fauna.fox = {habits: 'den vulpine', cunning: 3}`.
    - Lore Bag: Keywords: ["sly", "pelt", "scavenger", "kit-fox", "trickster"].
    - MM Tie: Density -0.08; alerts MM_narrative (theft quests).

  - **Weasel**:
    - **Hunt** (DC 14): Ferret-like → Fur (warmth), small trophy.
    - **Trap** (DC 15): → Eradicate pests in farms.
    - **Tame** (DC 13): → Vermin hunter companion.
    - **Domesticate** (DC 17): Rare; barn guardian.
    - TP Delta: `tactics: ['squeeze entry', ferocity]`.
    - Lore Bag: Keywords: ["ferret", "slender", "predator", "pest-control"].

- **Medium Carnivores (Medium, Density 0.3-0.7, Base DC 16-18)**: Pack hunters, dangerous.
  - **Wolf**:
    - **Hunt** (Survival DC 17): Pack bonus if solo (+3 DC) → Pelt (cold resist), fangs (daggers). Failure: Pack retaliation (1d10 bite swarm).
    - **Trap** (DC 18): Alpha bait → Capture for breeding.
    - **Tame** (DC 16): Howl mimicry → Pack ally (flank bonus, 7 days).
    - **Domesticate** (DC 20, 21 days): Guard dog (+2 settlement defense).
    - TP Delta: `knowledge.fauna.wolf = {packDynamics: 'alpha-led', territory: 5km^2}`.
    - Lore Bag: Keywords: ["pack", "howl", "apex", "loyal", "fierce"].
    - MM Tie: Depletes herbivore density indirectly (+wire to ecology accumulate).

  - **Owl** (Nocturnal predator, from prior):
    - **Hunt** (DC 16, night -2 DC): Silent kill → Feathers (arrows), talons (jewelry).
    - **Trap** (DC 17): → Aviary study.
    - **Tame** (DC 15): → Night scout (darkvision share).
    - **Domesticate** (DC 19): Messenger bird.
    - TP Delta: `habits: 'silent flight', preySense`.
    - Lore Bag: Keywords: ["nocturnal", "talons", "hunter", "wise", "feathered"].

- **Large Carnivores (Rare, Density 0.1-0.4, Base DC 20-25)**: Apex, quest bosses.
  - **Bear**:
    - **Hunt** (DC 22): Hibernation window (-3 DC) → Hide (armor +1 AC), claws (weapons). Failure: Maul (3d8 damage).
    - **Trap** (DC 23): Honey lure → Rare capture (circus/trophy).
    - **Tame** (DC 21): → Berserker mount (rage bonus, 14 days).
    - **Domesticate** (DC 25, 60 days): Impossible solo; requires druidic κ.
    - TP Delta: `knowledge.fauna.bear = {denning: 'winter', strength: 18}`.
    - Lore Bag: Keywords: ["apex", "claw", "hibernation", "fierce", "guardian"].
    - MM Tie: Major depletion (-0.2 density); triggers MM_faction hunts.

## System Edges and Hazards

- **Edges** (`engine/system-edges.ts`):
  - Hunt/Trap → `MM_ECONOMY` (supply influx, price drops).
  - Tame → `MM_SCENE` (temp follower AI in combat).
  - Domesticate → `MM_SETTLEMENT` (livestock boosts economy/faction loyalty).
  - Predation Chain: Carnivore hunt success mods herbivore growth (-0.05 in ecology accumulate).

- **Hazards**:
  - Failure rolls: Carnivores → Counterattack (`HazardEvent: {type: 'predatorRevenge', severity: 0.5-0.8}`).
  - Overhunting: If density <0.2, κ: `region.faunaExtinction = true` → Quests, economy shocks.
  - Ethical: DM persona can enforce alignment checks (e.g., good chars +2 DC on unnecessary hunts).

## Implementation Roadmap

1. **Phase 1**: Define MFs (`mfHunt`, `mfTame` in `engine/mf-predation.ts`), add TPB variants (`huntFaunaSchema` in `tpb-world.ts`).
2. **Phase 2**: Extend mm-ecology/followers (accumulate for breeding, resolve for bonds), unit tests (DCs, deltas).
3. **Phase 3**: API routes (`/api/fauna/interact`), validation in slot push.
4. **Phase 4**: UI in `surfaces/Play.tsx` (fauna HUD icons, intent buttons), lore bag entries (add to grok/lore-bag.json).
5. **Tests/Milestone**: Cover 20+ interactions; ensure 88+ files pass `npm run test`. Tie to mining (e.g., trap for mine mules).

Risks: Balance taming DCs to avoid OP companions; limit domesticated to 5/party for scalability. Synergies: Herbivore tames aid mining (pack animals); carnivore guards protect ecology studies.

---
*Last Updated: Builds on fauna-flora-mapping.md; cross-ref mining-layers for beast-of-burden domestication.*
```

This new doc slots cleanly into the docs/ hierarchy and aligns with the grok/ workspace (e.g., update `grok/fauna-flora-mapping.md` with links if needed). It adds ~15 new fauna templates, emphasizing the predation chain for realism.

### Next Steps
- **Immediate**: If good, I can implement the MFs and API stubs (e.g., draft `engine/mf-predation.ts`).
- **Expansion**: Flesh out more biomes (e.g., aquatic carnivores) or wire domestication to `MM_followers`.
- **Validation**: Run `npx tsc --noEmit` post-integration—no issues anticipated.

What do you think—proceed to code, or refine the DCs/templates?
