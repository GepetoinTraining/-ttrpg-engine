# Tool Production Chain: Lightweight Runtime-Derived Schema

## Overview

This document defines a lightweight, scalable production chain for tools and equipment, emphasizing runtime derivation over static mapping. Rather than pre-defining exhaustive baselines (e.g., no hardcoding 20+ hammer variants), we use abstract component slots (e.g., handle/tip/attachment) as primitives. Specific tools emerge dynamically from player progression: Study intents (e.g., ecology studies on fish behavior) or skill checks trigger API calls to derive advanced components/recipes, unlocking hyper-specific complexity (e.g., basic fishing rod → Japanese-style tenkara lures with weighted flies for stream trout).

This aligns with core principles:
- **Runtime derivation**: Client requests discoveries via `/api/crafting/discover` (based on TP κ knowledge), server responds with procedurally generated schemas (seeded by worldDay + certId for determinism). No full upfront enum—tools "grow" with player/settlement knowledge.
- **Progressive complexity**: Starts simple (3-5 slots for basics); advances to modular add-ons (10+ for expert). Materials from ecology/mining/aquatic slot in without redesign.
- **Minimal static mapping**: Only 3-5 abstract archetypes (e.g., Striking, Cutting, Gathering). Full specificity from deltas (e.g., fishing study → derive "split-cane bamboo rod" from flora knowledge).
- **Persistence**: Discoveries as TP κ writes (`writeKappa('crafting-recipe', {slots: [...], affixes: []})`); crafts via `mfCraft` (output: ToolInstance with derived stats).
- **Scalability**: Handles "Japanese levels" of specificity (e.g., 50+ lure variants) via noise.ts seeding + ML prep (lore bag keywords for future semantic derivation).

No breaking changes: Extends existing MFs (add `mfCraft` in `engine/mf-crafting.ts`) and TPB (`discoverRecipe` action). Avoids bloat—static baselines <100 lines total.

## Core Data Structures (Minimal Abstracts)

Define tools as configurable slots, not rigid types. Stored in TP κ under `κ.knowledge.crafting[<purpose>]` (e.g., 'fishing').

### Tool Archetype (in `src/lib/crafting.ts`)
```typescript
interface ToolArchetype {
  purpose: string;  // e.g., 'gathering-fish', 'striking-forge', 'cutting-wood'
  baseSlots: Slot[];  // 3-5 abstract components (handle, tip, attachment, etc.)
  baseStats: { durability: number; efficiency: number };  // Defaults: 1-5 scalars
  skillReq: { type: string; dc: number };  // e.g., {type: 'survival', dc: 10} for basics
  derivationHooks: string[];  // Triggers for runtime expansion, e.g., ['ecology-study-fish', 'material-ore']
}

interface Slot {
  name: string;  // e.g., 'handle', 'line', 'hook'
  materialDomains: string[];  // e.g., ['flora-wood', 'fauna-bone', 'mining-metal'] (from expansions)
  quantity: number;  // 1-5
  modular: boolean;  // Can add sub-slots/affixes? (true for advanced)
  derived: boolean;  // Runtime-filled? (e.g., true for lures from study)
}
```

### Example Base Archetypes (Static: Only 5 Core)
1. **Gathering (e.g., Fishing/Harvesting)**:
   - Purpose: 'gathering-aquatic'
   - Base Slots: [{name: 'rod/handle', materialDomains: ['flora-wood'], quantity: 1, modular: true}, {name: 'line', materialDomains: ['fauna-sinew'], quantity: 2m, modular: false}, {name: 'hook/tip', materialDomains: ['mining-metal'], quantity: 1, derived: true}]
   - Base Stats: Durability 3, Efficiency 1 (catches 1d4 small fish/day)
   - Skill Req: Survival DC 10

2. **Striking (e.g., Hammer/Mining)**:
   - Purpose: 'striking-mine'
   - Base Slots: [{name: 'shaft/handle', materialDomains: ['flora-wood'], quantity: 1}, {name: 'head/tip', materialDomains: ['mining-stone'], quantity: 1, modular: true}]
   - Base Stats: Durability 4, Efficiency 1 (breaks 1d6 ore/day)
   - Skill Req: Mining DC 12

3. **Cutting (e.g., Axe/Saw)**:
   - Purpose: 'cutting-flora'
   - Base Slots: [{name: 'blade/tip', materialDomains: ['mining-stone'], quantity: 1, derived: true}, {name: 'handle', materialDomains: ['fauna-bone'], quantity: 1}]
   - Base Stats: Durability 5, Efficiency 1 (harvests 1d6 wood)
   - Skill Req: Carpentry DC 11

4. **Precision (e.g., Chisel/Needle)**:
   - Purpose: 'precision-craft'
   - Base Slots: [{name: 'tip', materialDomains: ['mining-metal'], quantity: 1, modular: true}, {name: 'grip/attachment', materialDomains: ['flora-fiber'], quantity: 1}]
   - Base Stats: Durability 2, Efficiency 2 (fine work, low wear)
   - Skill Req: Smithing DC 13

5. **Kit (e.g., Herbal/Angler Bag)**:
   - Purpose: 'kit-study'
   - Base Slots: [{name: 'container', materialDomains: ['fauna-hide'], quantity: 1}, {name: 'tools/attachments', materialDomains: ['precision-craft'], quantity: 2-4, derived: true}]
   - Base Stats: Durability 6, Efficiency 1 (holds 10 items, +2 to related DCs)
   - Skill Req: Survival DC 8

### Derived Tool Instance (Runtime Output)
```typescript
interface DerivedTool extends ToolArchetype {
  id: string;  // Generated: `${purpose}-${seedHash}`
  filledSlots: Slot[];  // Base + derived (e.g., hook → 'barbed-iron-fly' from study)
  stats: { ...baseStats, affixes: Affix[] };  // e.g., {efficiency: 1.5, affixes: [{name: 'weighted', bonus: +0.5}]}
  recipeSource: string;  // e.g., 'ecology-study-trout-migration'
}
```

## Runtime Derivation Flow

Tools start abstract; complexity unfolds via player actions/studies. No static full list—derivation pulls from knowledge κ, ecology deltas, and procedural noise.

1. **Basic Instantiation** (No Study Needed):
   - Client: `observe(κ.crafting.gathering-aquatic)` → Loads base archetype.
   - Craft: `applyIntent('craftBasic', {purpose: 'gathering-aquatic', materials: ['wood-branch', 'sinew']})` → `mfCraft` resolves simple rod (3 slots, DC 10).
   - Output: Basic fishing tool (rod + line + hook; catches minnows).

2. **Study-Triggered Discovery** (Progressive Unlock):
   - Player: During ecology study (e.g., `applyIntent('studyFauna', {species: 'trout'})` from aquatic doc) or skill use (Survival check on failed fish).
   - If success (DC 12+): Triggers derivation hook → Buffers `discoverRecipe` TPB action.
   - Client: Calls `/api/crafting/discover` with context (e.g., {hook: 'ecology-study-trout', knowledgeTier: 2, certId}).
   - Server: Derives via seed (worldDay * speciesId): Expands slots (e.g., hook → ['barbed', 'feathered-lure'] sub-options). Returns partial schema + lore keywords.
   - TP Write: `writeKappa('crafting.gathering-aquatic.advanced', {newSlots: [{name: 'lure/attachment', derived: true, materialDomains: ['fauna-feather', 'aquatic-scale']}]})`.
   - Progression: Tier 1 (basic): Rod/line/hook. Tier 2 (study river fish): Add reel. Tier 3 (deep study): Hyper-specific (e.g., 'tenkara rod' with silk line + micro-flies for fly-fishing; efficiency +2 for trout, DC 18 to craft).

3. **Advanced Complexity** (Hyper-Specificity):
   - Example: Fishing Progression to "Japanese Levels":
     - Basic (Tier 0): Rod (wood handle) + line (sinew) + hook (bone tip). Yield: 1d4 minnows/day.
     - Post-Study Trout (Tier 1): Derive 'fly-lure' attachment (feather + thread from fauna/flora). +1 efficiency for medium fish.
     - Post-Deep Dive (Tier 2, aquatic study on salmon): Add 'weighted-split-cane' rod variant (bamboo from specific flora, noise-derived pattern). Slots expand to 6: Handle + tip + line + reel + lure + bobber. DC 15, yields 1d8 salmon.
     - Expert (Tier 3+, multi-studies): Hyper-specific 'ikejime spike' tool (precision sub-tool for instant kill, preserves meat quality; derived from marine handling + fishing chain). 10+ slots, affixes like 'stream-tuned' (+3 in currents). Noise seeds variants (e.g., 20+ lure types: dry flies, nymphs, streamers).
   - Affix Derivation: Post-craft `mfAffix` (e.g., input: tool + pearl from shellfish → 'iridescent' for saltwater +1). From lore bag semantics (future: vector match "trout-enticing colors").

4. **Workbench Scaling** (From Tools to Chains):
   - Basic: Hand-craft (no bench, 1x output).
   - Derived Bench: Use basic tool to craft 'fishing-bench' (adds slots like vise for lures). Runtime: Study unlocks 'advanced-fly-tying-station' (10x efficiency, derives micro-tools).
   - Industrial: Settlement κ + power (waterwheel from hex) → Batch derive (e.g., 50 lures from one study). Complexity caps at knowledge tier (e.g., tier 4: full Japanese tackle box with 50+ specifics).

## API Hooks and Derivation

- **POST /api/crafting/discover** (Runtime Core):
  - Input: `{purpose: 'gathering-aquatic', trigger: 'ecology-study-trout', context: {regionId, knowledgeTier: 2, materialsAvailable: ['bamboo', 'silk']}, certId}`
  - Server: 
    - Resolve TP κ for base archetype.
    - Procedural gen: `noise.deriveSlots(seed = worldDay * triggerHash, tier)` → Expand slots (e.g., add 2-3 derived options).
    - Validate: Cert signature (forensic); no compute beyond shape.
    - Output: `{derivedTool: DerivedTool, newKnowledge: {slots: [...], loreKeywords: ['tenkara', 'fly-fishing', 'trout-stream']}, nextDC: 15}` (buffers as TPB `discoverRecipe`).
  - Zod Schema:
    ```typescript
    const DiscoverSchema = z.object({
      purpose: z.string(),
      trigger: z.enum(['ecology-study', 'skill-fail', 'material-combo']),
      context: z.object({tier: z.number().min(0), materials: z.array(z.string())}),
      certId: z.string()
    });
    const ResponseSchema = z.object({
      derivedTool: z.custom<DerivedTool>(),
      newKnowledge: z.object({slots: z.array(z.custom<Slot>()), keywords: z.array(z.string())}),
      recipeId: z.string()
    });
    ```

- **GET /api/crafting/archetypes?purpose=gathering-aquatic**: Returns base (static 5), filtered by κ knowledge.
- **POST /api/crafting/craft**: Uses derived schema → `mfCraft` → TPB `craftItem` push.

Cron: `/api/cron/derive-trends` (quarterly): Unobserved derivations from world events (e.g., new fish migration → global recipe hints).

## MM and Engine Integrations

- **MF-Crafting** (`engine/mf-crafting.ts`): `mfCraft(archetype, slots, tier)` → {output: DerivedTool, receipt: {success, qualityTier}}. Deterministic, invertible.
- **MM Wiring**:
  - `mm-economy` (L2): Accumulate derives market supply (e.g., advanced lures +price if rare study). Resolve: Craft actions update settlement production.
  - `mm-ecology` (L5): Study triggers link to fauna/aquatic (e.g., trout habits → lure designs).
  - Clockwork: Event-driven (study/craft) for derivations; daily for tool depletion/repair.
- **TP Schema**: `κ.crafting[<purpose>].tiers[]` (append discoveries); ancestor walk resolves available slots.
- **UI Hooks** (`surfaces/Crafting.tsx`): Dynamic builder (drag slots from inventory); study button → API discover popup (e.g., "Unlock fly-tying? Roll Survival"). Progress tree: Basic rod → Expert tenkara kit.
- **Lore Bag Tie**: Derived keywords (e.g., ['nymph-lure', 'weighted', 'trout-entice']) feed bag for ML (future: "Suggest lure for salmon run").

## Examples: Fishing Progression

1. **Tier 0 - Basic (No Derivation)**:
   - Tool: Simple Rod (wood handle + sinew line + bone hook).
   - Craft: Survival DC 10, materials from basic gather.
   - Use: `applyIntent('fishAquatic', {tool: 'simple-rod'})` → 1d4 minnows.

2. **Tier 1 - Post-Study (Runtime Derive)**:
   - Trigger: Ecology study on minnows (DC 12 success).
   - API Call: Derive {newSlot: {name: 'bait-attachment', derived: true, domains: ['flora-worm']}}.
   - Tool: Baited Rod (adds +1 efficiency for small prey).
   - Complexity: 4 slots.

3. **Tier 2 - Advanced Study (Hyper-Specific)**:
   - Trigger: Aquatic study on trout + failed fish (Survival DC 15).
   - Derive: Expand to 'fly-rod' (split-cane handle from bamboo flora; add reel + dry-fly lure from feather/silk).
   - Tool: Fly-Fishing Kit (6 slots, efficiency 2 for medium fish; variants: 5 lure types via noise).
   - Use: DC 14, yields 1d6 trout; unlocks further (e.g., streamer for predators).

4. **Tier 3+ - Expert Chain (Japanese Hyper-Specificity)**:
   - Multi-Triggers: Deep marine handling + material combos (e.g., silk from fauna + pearl weights).
   - Derive: 8-12 slots (tenkara rod: collapsible bamboo + furled line + kebari hooks; 20+ fly variants: elk-hair caddis, pheasant-tail nymph).
   - Tool: Tenkara Kit (durability 7, efficiency 3; affixes like 'current-tuned' from brackish studies).
   - Bench: Fly-tying station (derived from precision archetype) → Batch 10 lures/craft.
   - Economy: Rare kits trade for 50+ silver; quests for "perfect lure" from faction lore.

## Implementation Roadmap

1. **Phase 1**: Define 5 archetypes in lib/crafting.ts; implement mfCraft basics.
2. **Phase 2**: Build /api/crafting/discover (noise derivation, Zod); TPB `discoverRecipe` variant.
3. **Phase 3**: Wire study intents (ecology/aquatic) to triggers; UI builder mocks.
4. **Phase 4**: Affix/repair MFs; tests (progression sims, 20+ derivations); lore bag hooks.
5. **Milestone**: `npm run test` covers dynamic crafts; no static bloat—full fishing chain derivable in ~5 studies.

Risks: Bound derivations (max 15 slots/tool to avoid UI overload); seed determinism ensures replayability. This enables infinite specificity (e.g., 100+ fishing tools) from minimal bases.

---
*Last Updated: Lightweight pivot from static baselines; ties to aquatic/fauna studies for derivation triggers.*
