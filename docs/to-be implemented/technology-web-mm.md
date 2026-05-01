# Technology Web MM: Tiered Progression Blueprint

## Overview

This blueprint introduces the **Technology Web MM** (`mm-technology-web`), a simulated manifold matrix that models technological advancement as a dependency graph across tiers (F to EX: Feral/Basic → eXotic/Advanced). It starts lightweight (e.g., F-tier fishing: simple rods/nets from basic materials) and deepens with world progression (e.g., EX-tier: composite reels with precision gears, requiring multi-craft dependencies). The MM uses a JSON blob for schemas (growing slots/dependencies), enabling procedural unlocks via player studies while hinting to NPC craftsmen in hubs (settlements) for collaborative advancement.

Core goals:
- **Tiered Layering**: F (feral/simple, no tools) → E (elementary, basic crafts) → D (developed, specialized) → C (complex, multi-part) → B (branching, variants) → A (advanced, powered) → S (sophisticated, optimized) → EX (exotic, innovative). Each tier gates tool acceptance (e.g., F-fishing accepts hand-lines; EX requires gears from prior tiers).
- **Dependency Web**: JSON blobs define chains (e.g., modern rod → line pooler → metal gears → ore smelting craft). Unlocks via study MFs (e.g., `mfStudyTech`), persisting in TP κ as a growing graph.
- **Progressive Depth**: Blobs start minimal (3 slots for F-tier) and expand (10+ for EX-tier) via derivations (noise-seeded from worldDay + knowledge tier).
- **Player/NPC Synergy**: Players study at current top tier (e.g., A-tier rod hints to hub blacksmith: "Need finer gears"). NPCs (from craftsman.ts) receive hints, auto-attempt unlocks in monthly ticks, sharing via settlement κ.
- **Integration**: Builds on lightweight crafting (docs/tool-production-chain.md), craftsman.ts (NPC progression/recipes), and ecology/mining (materials). No breaking changes—extends MM ecosystem (L3 FACTION for tech sharing, L2 ECONOMY for tool markets).

This MM simulates "tech creep": Early world (low tiers) limits tools (slow fishing yields); advancement (via studies/crafts) unlocks efficiency, driving quests (e.g., "Seek gear knowledge from migrating smith").

## Core Principles

- **JSON Blob as Web**: Tech schemas as expandable JSON in κ: `{tier: 'A', purpose: 'fishing-rod', dependencies: [ {req: 'gears', fromTier: 'B-smithing'}, {slots: [{name: 'reel', derived: true, materials: ['metal']}]} ] }`. Blobs grow via writes (e.g., study adds sub-slots).
- **Tier Gates**: Tools/crafts only "work" at compatible tiers (e.g., EX-rod in F-world: 50% efficiency penalty). Resolve checks tier match.
- **Study-Driven Unlocks**: Players/NPCs study via MF (DC = current tier +2). Success → Derive new blob (API-like in engine), hint to hub NPCs (e.g., blacksmith gains temp knownRecipe).
- **Dependency Chain**: Enforced in mfCraft/mfStudyTech: Must satisfy prereqs (e.g., pooler needs gears craft first). Web visual: Mermaid graphs per purpose (e.g., fishing: hand-line → net → fly-rod → tenkara kit).
- **NPC Hints**: Settlement tick: If player studies, propagate to craftsmen (e.g., +knownRecipe temp, or migration pull for experts). Hubs (mm-hub) aggregate tech levels (shared pool).
- **Persistence**: Unlocks as TP κ writes (`κ.technology[<purpose>].tiers[]`), crafted tech as inventory instances. TPB variants: `unlockTechTier`, `hintCraftsman`.
- **Scalability**: Procedural (noise.ts for blob variants); cap tiers at 8 (F-EX). Ties to worldDay (e.g., cron unlocks global hints post-milestones).

## Data Structures

### Tech Tier Enum (in `engine/mm-technology-web.ts`)
```typescript
type TechTier = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'EX';  // Feral to eXotic
const TIER_ORDER: TechTier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'EX'];
const TIER_DC_MOD: Record<TechTier, number> = { F: 5, E: 8, D: 12, C: 15, B: 18, A: 22, S: 26, EX: 30 };
```

### JSON Blob Schema (Zod for Validation, Stored in TP κ)
```typescript
import { z } from 'zod';

const SlotSchema = z.object({
  name: z.string(),  // e.g., 'reel', 'lure'
  materialDomains: z.array(z.string()),  // e.g., ['mining-metal', 'fauna-bone']
  quantity: z.number(),
  derived: z.boolean().default(false),  // Runtime-filled?
  affixes: z.array(z.string()).optional()  // e.g., ['weighted', 'stream-tuned']
});

const DependencySchema = z.object({
  req: z.string(),  // e.g., 'metal-gears'
  fromTier: z.string(),  // e.g., 'B-smithing'
  purpose: z.string(),  // e.g., 'crafting-precision'
  unlockedBy: z.string().optional()  // e.g., 'study-gears'
});

const TechBlobSchema = z.object({
  id: z.string(),  // `${purpose}-${tier}`
  purpose: z.string(),  // e.g., 'fishing-tool'
  tier: z.string(),
  slots: z.array(SlotSchema),  // Grows: F=3, EX=12+
  dependencies: z.array(DependencySchema),
  baseStats: z.object({ efficiency: z.number(), durability: z.number() }),
  unlockDC: z.number(),
  hints: z.array(z.string()),  // For NPCs: e.g., ['blacksmith: finer gears needed']
  jsonVersion: z.number().default(1)  // For blob evolution
});
```

### Example Blobs (JSON, Tiered for Fishing)
- **F-Tier (Simple, Minimal Slots)**:
  ```json
  {
    "id": "fishing-tool-F",
    "purpose": "gathering-aquatic",
    "tier": "F",
    "slots": [
      {"name": "hand-line", "materialDomains": ["fauna-sinew"], "quantity": 1, "derived": false}
    ],
    "dependencies": [],
    "baseStats": {"efficiency": 0.5, "durability": 2},
    "unlockDC": 5,
    "hints": []
  }
  ```
  - Accepts: Hand-lining (no craft, just Survival roll).

- **C-Tier (Developed, Adds Chain)**:
  ```json
  {
    "id": "fishing-tool-C",
    "purpose": "gathering-aquatic",
    "tier": "C",
    "slots": [
      {"name": "rod-handle", "materialDomains": ["flora-wood"], "quantity": 1, "derived": true},
      {"name": "hook-tip", "materialDomains": ["mining-stone"], "quantity": 1},
      {"name": "net-attachment", "materialDomains": ["flora-fiber"], "quantity": 3, "derived": false}
    ],
    "dependencies": [
      {"req": "basic-smelting", "fromTier": "E-mining", "purpose": "crafting-striking"}
    ],
    "baseStats": {"efficiency": 1.5, "durability": 5},
    "unlockDC": 15,
    "hints": ["herbalist: fiber for stronger nets"]
  }
  ```
  - Requires: Stone hooks from E-smelting. Grows slots via study.

- **EX-Tier (Exotic, Deep Web)**:
  ```json
  {
    "id": "fishing-tool-EX",
    "purpose": "gathering-aquatic",
    "tier": "EX",
    "slots": [
      {"name": "composite-rod", "materialDomains": ["flora-bamboo", "mining-carbon"], "quantity": 1, "derived": true, "affixes": ["stream-tuned"]},
      {"name": "precision-reel", "materialDomains": ["mining-gears"], "quantity": 1, "derived": true},
      {"name": "multi-lure-kit", "materialDomains": ["fauna-feather", "aquatic-scale"], "quantity": 20, "derived": true},
      // ... 9+ more (e.g., bobber, leader, swivel)
    ],
    "dependencies": [
      {"req": "precision-gears", "fromTier": "A-crafting", "purpose": "precision-tool", "unlockedBy": "study-engineering"},
      {"req": "advanced-materials", "fromTier": "S-mining", "purpose": "extraction-layered"}
    ],
    "baseStats": {"efficiency": 4, "durability": 10},
    "unlockDC": 30,
    "hints": ["blacksmith: innovate gear alloys", "alchemist: lure compounds"]
  }
  ```
  - Chain: Rod → Reel (gears dep) → Lures (feather from fauna studies). Procedural: Noise adds 10-20 lure variants.

## MM Wiring (Clockwork Integration)

`mm-technology-web` (L3 FACTION layer, quarterly cadence for global hints; event-driven for studies). Extends SimulatedMMBase.

### Accumulate Phase (Cheap, Quarterly Tick)
- Scans world tech (from mm_states/TP resolve): Computes global tier avg (e.g., fishing at C worldwide).
- Propagates hints: If player unlocks (e.g., B-rod), add to settlement κ.hints[] → NPC craftsmen gain temp bonuses (e.g., +1 skillLevel for related crafts).
- Grows blobs lightly: Unobserved derivations (e.g., noise-tweak slots based on worldDay).
```typescript
onAccumulate(quarters: number, worldDay: number): void {
  this.techPurposes.forEach(purpose => {
    const currentTier = this.resolveTier(purpose);  // From κ.technology[purpose].maxTier
    if (currentTier < 'S') {
      // Hint propagation: To hubs
      const hubs = this.crossWire(mm_settlement.hubs);
      hubs.forEach(hub => {
        hub.kappa.hints.push({purpose, nextReq: this.deriveNextDependency(currentTier, worldDay)});
        // NPC auto-study: Random craftsman attempts mfStudyTech (low success for sim)
      });
    }
    // Global creep: +0.01 efficiency if faction research active (L3 dep)
  });
}
```

### Resolve Phase (Expensive, On Study/Craft)
- Triggered by `applyIntent('studyTech', {purpose, currentTier})` or craft failure (hint gen).
- Runs `mfStudyTech` (see below): DC = TIER_DC_MOD[tier] + deps unmet. Success → Derive/expand blob → writeKappa.
```typescript
onResolve(worldDay: number): void {
  // Player/NPC study resolve
  const studyResult = mfStudyTech(this.activeStudy, worldDay);
  if (studyResult.success) {
    const newBlob = this.expandBlob(studyResult.purpose, studyResult.tier, worldDay);  // Noise-derived slots
    writeKappa(`technology.${studyResult.purpose}.tiers.${studyResult.tier}`, newBlob);  // TPB captured
    // Hint to hub: If settlement, notify craftsmen (craftsman.ts: addKnownTemp)
    this.hintToCraftsmen(studyResult.hints, currentHub);
  }
  // Dependency check: Prune invalid tools (efficiency penalty if unmet)
  this.validateDependencies();  // E.g., EX-rod w/o gears: eff *= 0.5
  // Snapshot to mm_states for unobserved worlds
}
```

### Clockwork Registration (`engine/clockwork.ts`)
- Layer: L3 FACTION (tech sharing via guilds/migration from craftsman.ts).
- Cadence: Quarterly for accumulate (global hints); daily event-driven for resolves (studies/crafts).
- Deps: L2 ECONOMY (craft inputs/outputs), L5 ECOLOGY (material availability), mm-craftsman (NPC unlocks).
- System Edges (`system-edges.ts`): Unlock → mm-economy (new tools +supply); Study fail → mm-narrative (quest for prereq craftsman).

## MFs and Intents

- **mfStudyTech(purpose, tier, context: {materials, hubId}, roll: number)**: Atomic transformation.
  ```typescript
  function mfStudyTech(params, roll): {output: TechBlob | null, receipt: {success: boolean, dc: number, hints: string[]}} {
    const dc = TIER_DC_MOD[params.tier] + unmetDeps(params.dependencies, currentKnowledge);
    const total = roll + survivalMod + intMod;
    const success = total >= dc;
    if (!success) return {output: null, receipt: {success: false, dc, hints: ['Need better materials']}};

    const margin = total - dc;
    const newSlots = generateDerivedSlots(params.baseSlots, margin > 10 ? 3 : 1, worldDay);  // Noise: Add 1-3
    const blob: TechBlob = { ...params, slots: [...params.slots, ...newSlots], hints: deriveHints(margin) };
    return {output: blob, receipt: {success: true, dc, hints: blob.hints}};
  }
  ```
  - Output: New blob → writeKappa.
  - Ties: If hubId, call craftsman.ts helpers (e.g., getMastersAt(hubId) → temp unlock for them).

- **Player Intents** (engine-client.ts):
  - `applyIntent('studyTech', {purpose: 'fishing-tool', targetTier: 'C', context: {materials: ['bamboo']}})` → Buffers mfStudyTech + push.
  - `applyIntent('hintCraftsman', {hubId, purpose})` → Propagates to NPCs (e.g., blacksmith studies gears for rod prereq).

## API Hooks and NPC Integration

- **POST /api/technology/study**: `{purpose, tier, context, certId, roll}` → Run mfStudyTech (client-precomputed), validate, buffer TPB `unlockTechTier`. Returns blob + hints.
  - Zod: Mirrors TechBlobSchema.
- **GET /api/technology/state?purpose=fishing-tool&hubId=123**: Resolve current tier/slots from TP κ; include NPC hints (from mm-hub.craftsmen).
- **Cron Integration** (`/api/cron/technology-tick`): Calls mm-technology-web.accumulate quarterly → Global hints (e.g., if fishing at B worldwide, migrate gear-smiths to coastal hubs).
- **Craftsman.ts Ties**:
  - `addTechHint(craftsman, blob)`: New helper—adds to knownRecipeIds (e.g., 'tech-dependency-gears').
  - MonthlyCraftTick: If hints, craftsman auto-studies (low roll for sim: 50% success → unlocks prereq for player).
  - Hubs: mm-hub.services include 'tech-hint' (e.g., blacksmith: "From your rod study, I forged these gears").

## Example Flow: Fishing Tech Web

1. **F-Tier Unlock (World Start)**: Baseline blob (hand-line). No dep. Efficiency: 0.5 (1d4 minnows/day).
2. **E-Tier Study (Player Intent: Survival DC 8)**: mfStudyTech → Adds hook slot (dep: basic stone from mining F). Blob grows to 2 slots. Hint: "Gatherer: Try river stones for hooks."
3. **C-Tier (DC 15, Post-E Craft)**: Study on trout (aquatic tie) → Derive net-attachment (dep: fiber from flora E). 4 slots. Hint to hub herbalist: "Need tougher weaves for nets." NPC auto-crafts fiber → Shared in settlement market.
4. **A-Tier (DC 22, Multi-Dep)**: Study reel (req: gears from B-smithing). 7 slots (rod + reel + lures). Hint to blacksmith: "Innovate metal coils for smooth reel." Migration: If no local smith, pressure pulls one (craftsman.evaluateMigration).
5. **EX-Tier (DC 30, Deep Chain)**: Study tenkara (req: advanced materials S-mining + precision A-crafting). 12+ slots (composite + micro-lures). Procedural: Noise adds 15 fly variants. Global hint: Cron pushes exotic alchemist for affix compounds.

Mermaid Web (in doc):
```
graph TD
    F[Hand-Line F] --> E[Hook E<br/>Dep: Stone]
    E --> C[Net C<br/>Dep: Fiber]
    C --> B[Rod B<br/>Dep: Wood]
    B --> A[Reel A<br/>Dep: Gears B-smithing]
    A --> S[Lure Kit S<br/>Dep: Feathers]
    S --> EX[Tenkara EX<br/>Dep: Composites]
```

## Implementation Roadmap

1. **Phase 1**: Define enums/schemas in mm-technology-web.ts; implement mfStudyTech (pure MF).
2. **Phase 2**: Wire accumulate/resolve; Clockwork L3 registration; TPB variants (unlockTechTier).
3. **Phase 3**: Integrate craftsman.ts (addTechHint, auto-study in monthlyTick); API /technology/study.
4. **Phase 4**: UI in Crafting surface (tech tree viz, study buttons); tests (tier progression, dep validation; +30 cases).
5. **Milestone**: Simulate fishing web (F → EX unlocks via 5 studies); npm run test passes; ties to inventory (EX-rod persists as instance).

Risks: Bound blob growth (max 15 slots); ensure deps don't cycle (DAG validation). This creates a "tech ecosystem": Player studies propel world, NPCs fill gaps, tools evolve from simple to hyper-specific.

---
*Last Updated: Ties to tool-production-chain (blobs derive slots), craftsman.ts (NPC hints/unlocks), aquatic (fishing purpose).*
