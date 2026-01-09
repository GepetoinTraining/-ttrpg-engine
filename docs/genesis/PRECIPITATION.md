# Genesis Precipitation Pipeline

## Core Concept

Everything in Genesis exists as **topology** - a mathematical description using prime factorization. The precipitation pipeline transforms topology into observable reality (HTML/CSS).

```
Seed → Topology → Physics → Φ() → HTML/CSS → Viewport
```

## The Pipeline

### 1. Seed (Source of Truth)

A seed is a number whose prime factorization encodes what something IS.

```typescript
// A primary action button
const buttonSeed = 2n;  // Prime 2 = Action

// A Dwarf Fighter character
const characterSeed = 2n * 37n * 53n;  // Base(2) × Dwarf(37) × Fighter(53)

// A medieval tavern
const tavernSeed = 3n * 11n * 17n;  // Structure(3) × Identity(11) × Material(17)
```

### 2. Topology (Element Composition)

Factorizing the seed reveals its composition - what elements make it up.

```typescript
import { factorize } from './elements';

factorize(2n * 37n * 53n);
// Returns: { Action: 1, Dwarf: 1, Fighter: 1 }
```

### 3. Physics (Behavioral Properties)

Topology determines physics - how something behaves in the world.

```typescript
interface PhysicsState {
  mass: number;        // Visual weight (shadows, borders)
  density: number;     // Compactness (padding, spacing)
  temperature: number; // Energy (color warmth, animation)
  charge: number;      // Polarity (alignment)
  friction: number;    // Resistance (transition speed)
  pressure: number;    // Containment (border radius)
  buoyancy: number;    // Lift (z-index, elevation)
}
```

Element types influence base physics:

| Type | Physics Tendency |
|------|-----------------|
| FLUX | High temperature, low friction, medium charge |
| FORM | High mass, high density, high pressure |
| VITALITY | Medium temperature, medium buoyancy |
| AETHER | High buoyancy, low friction, low density |
| ENTROPY | High temperature, high pressure, high friction |

### 4. Φ (The Actualization Tensor)

The Φ function transforms physics into CSS. This is where math becomes visual reality.

```typescript
function projectToCSS(physics: PhysicsState): CSSProjection {
  // Mass → shadow depth
  const shadowDepth = physics.mass * 24;
  
  // Density → padding (inverse)
  const padding = (1 - physics.density) * 32;
  
  // Temperature → color hue (0=blue, 1=red)
  const hue = physics.temperature * 60;
  
  // Friction → transition duration
  const transition = 100 + physics.friction * 400;
  
  // Pressure → border radius
  const borderRadius = physics.pressure * 24;
  
  // Buoyancy → z-index and elevation
  const zIndex = physics.buoyancy * 100;
  
  return { /* CSS properties */ };
}
```

### 5. Precipitation (Rendering)

The final step: generating HTML with computed styles.

```typescript
function precipitateHTML(seed: bigint, tag: string, content: string): string {
  const topology = factorize(seed);
  const physics = derivePhysics(topology);
  const css = projectToCSS(physics);
  const style = cssToString(css);
  
  return `<${tag} style="${style}" data-seed="${seed}">${content}</${tag}>`;
}
```

## Creating Atoms

Atoms are the smallest renderable units. Each has a prime identity.

```typescript
// UI Component Primes
const PRIMES = {
  Button: 2,    // Pure action
  Text: 3,      // Pure structure
  Input: 5,     // Pure reception
  Icon: 7,      // Pure visual
  Avatar: 11,   // Identity visual
  Spinner: 13,  // Loading state
};
```

### Atom Variants

Same atom, different physics = different appearance.

```typescript
// Button variants
const BUTTON = {
  primary: {
    physics: { mass: 0.7, temperature: 'hot', friction: 0.2 }
  },
  secondary: {
    physics: { mass: 0.5, temperature: 'warm', friction: 0.3 }
  },
  ghost: {
    physics: { mass: 0.3, density: 'gas', friction: 0.2 }
  },
  danger: {
    physics: { mass: 0.7, temperature: 'critical', friction: 0.2 }
  },
};
```

## Creating Molecules

Molecules combine atoms. Their seed is the product of constituent primes.

```typescript
// Card = Button × Text = 2 × 3 = 6
const Card = 6n;

// Form = Text × Input = 3 × 5 = 15
const Form = 15n;

// Navbar = Button × Text × Icon = 2 × 3 × 7 = 42
const Navbar = 42n;
```

## Creating Organisms

Organisms are complex compositions that form complete UI sections.

```typescript
// Character creation form
const CharacterBuilder = {
  seed: 15n * 211n * 223n * 227n,  // Form × RacePicker × ClassPicker × BackgroundPicker
  children: [
    { seed: 211n, content: 'Race Selection' },
    { seed: 223n, content: 'Class Selection' },
    { seed: 227n, content: 'Background Selection' },
    { seed: 199n, content: 'Ability Scores' },
  ]
};

// Precipitate the whole tree
const html = precipitateTree(
  CharacterBuilder.seed,
  CharacterBuilder.children
);
```

## Entity Topology (Characters, NPCs, Locations)

Everything in the game world follows the same pattern.

### Character Primes

```typescript
// Races
const RACES = {
  Human: 29, Elf: 31, Dwarf: 37, Halfling: 41, Gnome: 43, HalfOrc: 47
};

// Classes
const CLASSES = {
  Fighter: 53, Wizard: 59, Cleric: 61, Rogue: 67, Barbarian: 71, Bard: 73
};

// Character seed = baseSeed × racePrime × classPrime
const dwarfFighter = baseSeed * 37n * 53n;
```

### NPC Generation

NPCs exist as seeds. Names are generated **only when observed**.

```typescript
function observeNPC(seed: bigint): { name: string; description: string } {
  // Deterministic name from seed
  const name = generateNameFromSeed(seed);
  
  // Precipitate appearance
  const appearance = precipitateDescription(seed);
  
  return { name, description: appearance };
}
```

### Location Primes

```typescript
const LOCATIONS = {
  Tavern: 17,
  Temple: 19,
  Market: 23,
  Castle: 29,
  Dungeon: 31,
  Forest: 37,
};

// A haunted tavern in a forest
const hauntedForestTavern = 17n * 37n * ENTROPY_PRIME;
```

## The Viewport

The frontend viewport receives pre-precipitated HTML/CSS. It doesn't compute - it displays.

```
┌─────────────────────────────────────────────┐
│                   BACKEND                    │
│  Seed → Topology → Physics → Φ() → HTML/CSS │
└────────────────────┬────────────────────────┘
                     │ (ready to render)
                     ▼
┌─────────────────────────────────────────────┐
│                  FRONTEND                    │
│              Genesis Viewport                │
│           (just renders HTML/CSS)            │
└─────────────────────────────────────────────┘
```

## API Endpoints

### Precipitate Component

```typescript
// POST /api/genesis/precipitate
{
  seed: "2",           // or bigint string
  variant: "primary",  // optional variant
  content: "Click me"  // inner content
}

// Returns
{
  html: '<button style="..." data-seed="2">Click me</button>'
}
```

### Precipitate Form

```typescript
// POST /api/genesis/form
{
  type: "character-builder",
  campaign_id: "..."
}

// Returns full form HTML with all atoms precipitated
{
  html: '<div data-seed="...">...</div>'
}
```

## Key Principles

1. **Topology is identity** - A seed defines what something IS
2. **Physics is behavior** - How it looks/acts derives from what it is
3. **Φ is universal** - Same math renders buttons and dragons
4. **No topology = no existence** - Everything must have a seed
5. **Observation precipitates** - NPCs get names when seen, not before
6. **GM creates topology** - Human or AI, they compose seeds

## File Structure

```
bend/src/genesis/
├── elements.ts       # Prime definitions, factorization
├── laws.ts           # PHI constants
├── precipitate.ts    # Topology → HTML/CSS
├── character.ts      # Character topology composition
├── observer.ts       # NPC observation/naming
├── identity.ts       # Seed generation
└── index.ts          # Exports

fend/src/
├── viewport/
│   └── GenesisViewport.vue  # Renders precipitated output
└── styles/processors/_internal/
    ├── definitions.ts       # Component physics definitions
    └── phi.ts               # Φ tensor (reference/shared)
```

## Example: Full Character Creation Flow

```typescript
// 1. GM (or AI) requests character builder
const builderHTML = await precipitateForm('character-builder', campaignId);

// 2. Viewport displays the form
// User fills in: Race=Dwarf, Class=Fighter, Name="Thorin"

// 3. Backend creates character token
const token = await birthCharacter({
  name: "Thorin",
  race: "Dwarf",
  class: "Fighter",
  abilityScores: { str: 16, dex: 12, con: 16, int: 10, wis: 13, cha: 8 }
});

// token.seed = 72392829002 (baseSeed × 37 × 53)
// token.topology = { Fe: 5, Si: 1, H: 1, Dwarf: 1, Fighter: 1 }

// 4. Character can now be precipitated anywhere
const characterCard = precipitateHTML(token.seed, 'div', token.name);
```

---

*"From nothing but numbers, worlds emerge."*
