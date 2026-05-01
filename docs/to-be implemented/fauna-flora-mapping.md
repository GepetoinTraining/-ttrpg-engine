# Fauna-Flora Mapping: Ecology Interactables

This document outlines a detailed mapping for ecology interactables in the TTRPG Engine's world generation and interaction layers. It expands on the forest/understory ecology proposal, focusing on fauna, flora, fungi, and mosses as dynamic, skill-based elements. These interactables drive player progression in professions (e.g., herbalism, survival, tracking) and integrate with the engine's core principles: deterministic generation via noise/region features (`game/regionFeatures.ts`, `game/flora-tree.ts`, `game/noise.ts`), TP κ storage for knowledge deltas (`engine/tp.ts`), and preparation for a lore bag to enable future ML/vector-based processing (e.g., NLP for emergent narratives or vector embeddings for similarity searches).

The goal is to create a "living understory" beneath dominant flora-trees, enabling richer interactions during exploration, downtime, or scene resolves. Interactables are generated procedurally per region/biome (e.g., temperate forest: high fungi/moss density; arid scrub: sparse resilient flora). Density scales with biome noise values and depletes on interaction (via MM accumulate/resolve in `engine/mm-ecology.ts`).

## Core Interaction Flow

1. **Generation**: During worldgen (`game/world.ts`) or on-observation (`engine/tp.resolve()`), interactables are instantiated as κ nodes under region/settlement TP pointers. Each has:
   - `id`: Seed-derived unique identifier.
   - `type`: `fauna` | `flora` | `fungi` | `moss`.
   - `density`: [0-1] float (noise-driven; affects encounter rate).
   - `properties`: Biome-specific traits (e.g., edibility, rarity).
   - `knowledgeDelta`: Potential TP write on successful interaction (stored in player MM_intelligence κ).

2. **Interaction Template** (Client-side via `engine-client.ts` `applyIntent()`):
   - **Study**: Nature/Survival check → reveal properties + lore snippet → store delta in TP κ.
   - **Harvest/Track**: Profession skill check (Herbalism/Tracking) → gain resource/effect + depletion.
   - **Outcome**: `{output: {resource, effect}, receipt: {dc, roll, success}}` (MF-style, e.g., `mfEcologicalStudy`).
   - Push via flywheel slot (`src/lib/engine-client.ts` `push()`) as `writeKappa` action with system=`client-intent:ecology-study:<certId>`.

3. **TP Deltas**: On success, append to character's knowledge κ (e.g., `κ.knowledge.ecology[<regionId>].interactables[<type>][<name>] = {properties, lore}`).
   - Enables progression: Repeat interactions lower DCs (e.g., -2 per prior success) via ancestor walk in `tp.resolve()`.
   - Cross-system: Deltas feed MM_narrative (quests) and MM_economy (resource markets).

4. **Lore Bag Prep**: Each interactable contributes to a centralized "lore bag" (future `src/lib/lore-bag.ts`): A JSON/DB store of `{name, description, keywords[], embeddings?}` for ML integration.
   - Keywords: 5-10 terms (e.g., "poisonous", "medicinal", "nocturnal") for initial bag-of-words.
   - Embeddings: Placeholder for vector DB (e.g., via external API like OpenAI embeddings) to enable semantic search (e.g., "find healing herbs in this biome").
   - API Path: `/api/ecology/study` → POST interactable data → returns JSON response + stores in lore bag (via `tpb_entries` for persistence).

5. **Depletion & Dynamics**: Interactables tie to ecology MM (`engine/mm-ecology.ts`): `accumulatePotential(days)` simulates growth/depletion; `resolve(worldDay)` applies hazards (e.g., overharvest → local extinction, triggering faction quests).
   - Cadence: Daily for flora/moss; hourly for fauna (migration); seasonal for fungi.

Skill DCs baseline on rarity/commonality (DC 10 easy, DC 20 expert). Modifiers: +2 tool proficiency, -5 prior knowledge.

## Flora Mapping

Flora includes non-tree plants: herbs, shrubs, flowers, vines. Generated via `flora-tree.ts` extensions (understory layer). Focus: Medicinal/craftable resources.

### Categories & Examples
- **Herbs (Common, Density 0.7-1.0)**: Quick-growth, low-value.
  - Willow Bark: Pain relief (Healing kit component).
    - Interact: Study (Nature DC 12): Reveals anti-inflammatory properties.
    - Harvest (Herbalism DC 10): Yields 1d4 doses; depletion -0.1 density.
    - TP Delta: `knowledge.ecology[<region>].flora.willowBark = {medicinal: true, potency: 1d6 HP}`.
    - Lore Bag: `{name: "Willow Bark", desc: "Flexible tree bark with analgesic sap.", keywords: ["healing", "bark", "river-side", "anti-inflammatory"]}`.
  - Nettle: Stinging defense, fiber for rope.
    - Interact: Study (Survival DC 14): Identifies safe handling.
    - Harvest (Herbalism DC 13): Yields fiber (crafting); risk 1d4 piercing if failed.
    - TP Delta: Adds anti-itch remedy recipe.
    - Lore Bag: Keywords: ["stinging", "fiber", "defensive", "weedy"].

- **Shrubs/Flowers (Medium, Density 0.4-0.8)**: Seasonal blooms, moderate value.
  - Foxglove: Poison/heart medicine (Digitalis analog).
    - Interact: Study (Nature DC 16): Dual-use warning.
    - Harvest (Herbalism DC 15): 1d6 poison doses or 1d4 healing (choice).
    - TP Delta: Unlocks poisoner/alchemist progression.
    - Lore Bag: `{desc: "Tall spikes of tubular flowers, toxic in excess.", keywords: ["poison", "cardiac", "fox-like", "purple"]}`.
  - Lavender: Calming, insect repellent.
    - Interact: Study (Survival DC 11): Aromatherapy effects.
    - Harvest (DC 10): Yields essence (rest bonus).
    - TP Delta: +1 to calm checks in κ.narrative.
    - Lore Bag: Keywords: ["aromatic", "calming", "bee-attractor", "drought-resistant"].

- **Vines/Undergrowth (Rare, Density 0.1-0.4)**: Entangling hazards/resources.
  - Ivy: Climbing, structural (potions base).
    - Interact: Study (Nature DC 18): Poison ivy variant risk.
    - Harvest (Herbalism DC 17): Yields adhesive/climbing gear.
    - TP Delta: Terrain knowledge for traversal.
    - Lore Bag: Keywords: ["climbing", "poisonous", "evergreen", "wall-crawler"].

## Fauna Mapping

Fauna: Animals, insects, birds. Mobile, trackable. Generated via biome noise (e.g., high in forests). Focus: Tracking/hunting for food/pelts.

### Categories & Examples
- **Small Mammals/Insects (Common, Density 0.8-1.0)**: Forage-able, low risk.
  - Rabbit: Quick prey, fur/leather.
    - Interact: Track (Survival DC 10): Reveals burrows.
    - Hunt (Tracking DC 12): Yields meat/pelt; noise alerts predators (10% chance).
    - TP Delta: `knowledge.ecology[<region>].fauna.rabbit = {habits: "nocturnal herbivore", tracks: "small prints"}`.
    - Lore Bag: `{name: "Forest Rabbit", desc: "Swift burrower with soft fur.", keywords: ["prey", "fur", "herbivore", "burrow"]}`.
  - Bees: Pollination, honey source.
    - Interact: Study (Nature DC 13): Hive location.
    - Harvest (Survival DC 15): Honey (healing/food); sting risk 1d4 damage.
    - TP Delta: Apiary knowledge for settlements.
    - Lore Bag: Keywords: ["insect", "honey", "sting", "pollinator"].

- **Birds/Reptiles (Medium, Density 0.5-0.9)**: Aerial/ground, seasonal migration.
  - Owl: Nocturnal hunter, feathers for arrows.
    - Interact: Track (Survival DC 14): Night calls.
    - Hunt (DC 16): Rare feathers; stealth bonus on success.
    - TP Delta: Adds scouting intel (e.g., predator avoidance).
    - Lore Bag: `{desc: "Silent winged predator of the night.", keywords: ["nocturnal", "feathers", "hunter", "forest"]}`.
  - Lizard: Camouflage, scales for armor.
    - Interact: Study (Nature DC 12): Heat-seeking behavior.
    - Capture (Survival DC 14): Pet/experiment subject.
    - TP Delta: Reptile husbandry progression.
    - Lore Bag: Keywords: ["reptile", "camouflage", "scales", "warm-blooded"].

- **Larger Fauna (Rare, Density 0.2-0.5)**: Quest-worthy, high risk/reward.
  - Deer: Herd animal, antlers/meat.
    - Interact: Track (Survival DC 18): Migration paths.
    - Hunt (DC 20): Major yield; alerts faction (poaching quest hook).
    - TP Delta: Unlocks herd management in MM_settlement.
    - Lore Bag: `{name: "Stag Deer", desc: "Majestic grazer with branching antlers.", keywords: ["herbivore", "antlers", "herd", "trophy"]}`.

## Fungi Mapping

Fungi: Mushrooms, molds. Spores/damp areas. Focus: Alchemical/poison risks.

### Categories & Examples
- **Edible/Poisonous Mushrooms (Common/Medium, Density 0.6-0.9)**: Ground-level.
  - Morel: Nutty flavor, gourmet.
    - Interact: Study (Nature DC 11): Identification.
    - Harvest (Herbalism DC 10): Food (temp HP); false morel risk if failed.
    - TP Delta: Foraging expertise.
    - Lore Bag: `{desc: "Honeycomb-capped delicacy in spring.", keywords: ["edible", "nutty", "spring", "forest-floor"]}`.
  - Amanita (Fly Agaric): Hallucinogenic poison.
    - Interact: Study (DC 16): Psychedelic warnings.
    - Harvest (DC 18): Potion ingredient; overdose 1d6 psychic damage.
    - TP Delta: Shamanic lore unlock.
    - Lore Bag: Keywords: ["poison", "hallucinogen", "red-cap", "deadly"].

- **Molds/Lichens (Rare, Density 0.3-0.7)**: On rocks/trees.
  - Penicillium Mold: Antibiotic precursor.
    - Interact: Study (Nature DC 15): Medicinal mold.
    - Harvest (Herbalism DC 14): Healing salve base.
    - TP Delta: Early medicine knowledge.
    - Lore Bag: `{desc: "Blue-green fuzz on decaying wood.", keywords: ["antibiotic", "mold", "decay", "healing"]}`.

## Mosses Mapping

Mosses: Ground cover, moisture indicators. Focus: Environmental cues/camouflage.

### Categories & Examples
- **Common Moss (Density 0.9-1.0)**: Cushion-forming.
  - Sphagnum: Water-retentive, wound dressing.
    - Interact: Study (Survival DC 10): Absorbent properties.
    - Harvest (DC 9): Bandages (reduces bleeding).
    - TP Delta: Wilderness medicine.
    - Lore Bag: `{name: "Peat Moss", desc: "Spongy green carpet in wetlands.", keywords: ["absorbent", "wound", "wetland", "cushion"]}`.
  - Reindeer Lichen: Crustose, food for grazers.
    - Interact: Study (Nature DC 12): Slow-growing indicator.
    - Harvest (DC 11): Lichen meal (rations).
    - TP Delta: Famine survival.
    - Lore Bag: Keywords: ["lichen", "crust", "slow-growth", "arctic"].

- **Specialized Moss (Medium/Rare, Density 0.4-0.8)**: Glowing/toxic variants.
  - Bioluminescent Moss: Night visibility.
    - Interact: Study (DC 14): Glow mechanism.
    - Harvest (Survival DC 13): Light source (1hr duration).
    - TP Delta: Cave exploration aid.
    - Lore Bag: `{desc: "Faintly glowing strands in dark undergrowth.", keywords: ["bioluminescent", "cave", "glow", "moss"]}`.

## Implementation Ties & Next Steps

- **Engine Integration**: Extend `mm-ecology.ts` with `onAccumulate` for density updates and `onResolve` for interaction resolves. Use `mfEcologicalStudy` for atomic MFs.
- **TP Schema Extension** (see `docs/tp_schema.md`): Add `ecology` domain under κ.knowledge with sub-nodes for types.
- **API Wiring**: New endpoint `/api/ecology/study` (Zod schema: `{interactableId, skill, roll}` → `{success, delta, lore}`); store in `tpb_entries` as `ecologyStudy` action.
- **Tests**: Add to `engine/__tests__/mm-ecology.test.ts`: Coverage for DC rolls, depletion, and delta persistence.
- **UI Hooks**: In `surfaces/Play.tsx`, render interactables as clickable tiles (density-based scatter); on click → intent apply + visual feedback (e.g., harvest animation).
- **Lore Bag Scaffolding**: Initialize `grok/lore-bag.json` with above examples; future cron job (`/api/cron/populate-lore`) to vectorize via external API.

This mapping provides a foundation for 50+ interactables (expand per biome). Prioritize temperate forest for initial rollout.

---
*Last Updated: Aligns with layered mining proposal; cross-ref `docs/mining-layers-proposal.md` for resource synergies (e.g., mine-adjacent fungi).*