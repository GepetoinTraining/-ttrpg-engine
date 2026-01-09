# CLAUDE.md - Genesis Engine Knowledge Map

This document helps Claude understand the codebase architecture and where knowledge lives.

## Core Philosophy

**"No topology = no existence."**

Everything in this system exists as a **seed** - a number whose prime factorization encodes identity. The engine **precipitates** seeds into observable reality (HTML/CSS, game entities, NPCs, locations).

```
Seed → Topology → Physics → Φ() → Reality
```

## Project Structure

```
ttrpg-engine/
├── bend/                 # Backend (Bun + tRPC + SQLite)
│   └── src/
│       ├── api/          # tRPC routers
│       ├── auth/         # Topology-based authentication
│       ├── db/           # Database schema, migrations, queries
│       ├── engine/       # Game engine (combat, simulation, rules)
│       └── genesis/      # THE CORE - Reality precipitation
│
├── fend/                 # Frontend (Vue 3 + TypeScript)
│   └── src/
│       ├── api/          # tRPC client
│       ├── components/   # Vue components
│       ├── composables/  # Vue composables (useGenesis, useTrpc)
│       ├── viewport/     # Genesis viewport (renders precipitated content)
│       └── styles/processors/_internal/
│           ├── definitions.ts  # Component physics definitions
│           └── phi.ts          # Φ tensor reference
│
├── data/
│   └── topology.json     # Pre-extracted component topologies
│
└── docs/genesis/         # Genesis documentation
    ├── PRECIPITATION.md  # How seeds become reality
    └── CHARACTER_TOPOLOGY.md  # Character creation system
```

## Genesis Engine (bend/src/genesis/)

This is the heart of the system. Understanding these files is critical:

| File | Purpose |
|------|---------|
| `elements.ts` | Prime number system, element types (FLUX, FORM, VITALITY, AETHER, ENTROPY) |
| `laws.ts` | Universal constants: PHI, Fibonacci, entropy thresholds |
| `precipitate.ts` | **THE Φ TENSOR** - Transforms topology → physics → CSS/HTML |
| `atoms.ts` | UI component factory - creates buttons, inputs, forms from seeds |
| `character.ts` | Character topology - races, classes as primes |
| `observer.ts` | Wave function collapse - what exists when observed |
| `identity.ts` | Self-sovereign identity, birth certificates |
| `director.ts` | Evolutionary pressure system for game balance |
| `materials.ts` | Crafting system using element composition |
| `infer.ts` | Semantic inference - intent → topology |

### Key Concepts

**Prime Identity System:**
```typescript
// UI Components
Button = 2   // Pure action
Text = 3     // Pure structure  
Input = 5    // Pure reception
Icon = 7     // Pure visual
Avatar = 11  // Identity visual

// Molecules = products of primes
Card = 6     // Button × Text = 2 × 3
Form = 15    // Text × Input = 3 × 5
Navbar = 42  // Button × Text × Icon = 2 × 3 × 7
```

**Character Primes:**
```typescript
// Races (primes 29-47)
Human = 29, Elf = 31, Dwarf = 37, Halfling = 41

// Classes (primes 53-79)
Fighter = 53, Wizard = 59, Cleric = 61, Rogue = 67
```

**Physics → CSS (The Φ Tensor):**
```typescript
mass → shadow depth, border weight
density → background opacity, padding
temperature → color warmth (cold=blue, hot=red, critical=red glow)
charge → spacing, alignment
friction → transition duration
pressure → border radius
buoyancy → z-index, elevation
```

## Authentication (bend/src/auth/topology/)

Custom topology-based auth. No external services.

- `math.ts` - Core math (φ, ζ, M^n matrix operations)
- `enrollment.ts` - Device enrollment with human verification
- `challenge.ts` - Challenge/response authentication
- `verify.ts` - Auth verification for tRPC context

**Flow:** Enrollment captures datetime + geo → prime factorize → Fibonacci variant → ζ. Auth: both sides compute M^n trajectory, if match → authenticated.

## Database (bend/src/db/)

SQLite with Drizzle ORM.

- `schema.ts` - Core tables
- `migrations/` - Database migrations
- `queries/` - Query helpers
- `seeds/` - Seed data (Toril world, etc.)

Key tables: `users`, `campaigns`, `characters`, `character_tokens`, `topology_seeds`, `topology_certificates`

## API (bend/src/api/)

tRPC v11 routers:

| Router | Purpose |
|--------|---------|
| `auth` | Topology authentication |
| `genesis` | Precipitation API - serves HTML to frontend |
| `character` | Character CRUD, birthGenesis mutation |
| `campaign` | Campaign management |
| `combat` | Combat system |
| `world` | World graph, regions, locations |
| `npc` | NPC management |

## Frontend Viewport

The frontend **does not compute** - it displays what the backend precipitates.

**CRITICAL: The viewport receives ONE HTML payload - the entire world.**

The backend builds up: `atoms → molecules → organisms → WORLD`

Then wraps EVERYTHING in a **WorldSurface** (prime 81 = 9×9 = Surface²).

**Timespace requires a surface.** Without it, there's nowhere for reality to precipitate.

```
Backend: atoms → molecules → organisms → WORLD (complete HTML)
         ↓
Frontend: Display it (dumb viewport)
```

Key endpoint: `genesis.world` - Returns the complete precipitated world.

```typescript
// Backend builds content, wraps in WorldSurface
const content = `...atoms, molecules, organisms...`;
const html = worldSurface(content, campaignId, 'campaign');
return { html }; // ONE payload, wrapped in surface

// Frontend just displays it
<div v-html="world"></div>
```

**WorldSurface** (seed 81):
- Physics: zero mass, zero density, minimal temperature
- The timespace container onto which everything precipitates
- Every world view MUST be wrapped in this

Key files:
- `bend/src/api/routers/genesis.ts` - World builders, world endpoint
- `fend/src/viewport/GenesisViewport.vue` - Dumb container, displays world HTML
- `fend/src/composables/useGenesis.ts` - Helpers for fetching precipitated content

## Token + Atom Pattern

Every entity has two parts:

1. **Token** - The seed, source of truth. Exists in configuration space.
2. **Atom** - Projected stats, cached. Derived from token.

```typescript
// Token (physics-enabled, EXISTS)
character_tokens: {
  seed: "72392829002",
  topology: { Fe: 5, Si: 1, Dwarf: 1, Fighter: 1 },
  isRepresented: 1  // 0 = config space, 1 = world physics
}

// Atom (projection, cached)
characters: {
  name: "Thorin",
  hp: 12,
  ac: 16,
  // ... derived stats
}
```

## NPC Philosophy

NPCs exist as seeds. Names are generated **only when observed**.

```typescript
// NPC has no name until interaction
function observeNPC(seed: bigint) {
  // Name derived deterministically from seed
  const name = generateNameFromSeed(seed);
  return { name, appearance: precipitate(seed) };
}
```

## Common Tasks

**Create a new UI atom:**
1. Add prime to `UI_PRIMES` in `bend/src/genesis/atoms.ts`
2. Add physics variants to `VARIANT_PHYSICS`
3. Create helper function if needed
4. Export from `bend/src/genesis/index.ts`

**Create a new character race/class:**
1. Add prime to `CHARACTER_ELEMENTS` in `bend/src/genesis/character.ts`
2. Add topology to `RACE_TOPOLOGIES` or `CLASS_TOPOLOGIES`

**Add new tRPC endpoint:**
1. Add to appropriate router in `bend/src/api/routers/`
2. Use `publicProcedure`, `protectedProcedure`, or `campaignProcedure`

**Precipitate custom content:**
```typescript
import { precipitateHTML, precipitateCustom } from './genesis';

// From seed
const html = precipitateHTML(42n, 'div', 'Hello');

// With custom physics
const html = precipitateCustom(42n, { mass: 0.8, temperature: 0.9 }, 'Hot!');
```

## Key Documentation

- `docs/genesis/PRECIPITATION.md` - Full precipitation pipeline docs
- `docs/genesis/CHARACTER_TOPOLOGY.md` - Character creation system
- `fend/src/styles/processors/_internal/definitions.ts` - All component physics
- `fend/src/styles/processors/_internal/phi.ts` - Φ tensor implementation

## Running the Project

```bash
# Backend
cd bend && bun run dev

# Frontend  
cd fend && bun run dev
```

## CRITICAL: Viewport Nucleation Breakthrough

The viewport failed to fill the screen until ONE key change was made. This documents why.

### The Problem

Content rendered but stayed constrained - didn't fill the viewport. The precipitated form had:
```css
max-width: 600px;
margin: 0 auto;
```

This created a centered column that ignored available space.

### The Solution

Remove constraints. Let the world FILL its container:

```css
/* WRONG - constrains content */
max-width: 600px;
margin: 0 auto;

/* RIGHT - fills viewport */
width: 100%;
height: 100%;
```

### The Chain of Responsibility

The viewport fills the screen through a chain of `100%` dimensions:

1. **GenesisViewport.vue** - `position: fixed; inset: 0;` (fills browser)
2. **WorldSurface** - `position: absolute; inset: 0;` (fills viewport)
3. **Content wrapper** - `width: 100%; height: 100%;` (fills surface)
4. **Form** - `flex: 1;` (fills remaining space after header/footer)

Each layer MUST NOT introduce constraints (`max-width`, fixed `width`, etc.) or the chain breaks.

### The Physics Law

This connects to **pressure** in the Φ tensor:
- `pressure > 0.5` = expand to fill container
- `pressure < 0.5` = shrink to content size

When pressure is high, the component should have `width: 100%` and `flex-grow: 1`. The character builder form needs high pressure to fill the viewport.

### Multi-Column Layout

For responsive multi-column forms that fill the viewport:

```css
/* Container - fills viewport, vertical stack */
display: flex;
flex-direction: column;
width: 100%;
height: 100%;

/* Form - horizontal, wrapping, fills space */
display: flex;
flex-wrap: wrap;
gap: 1.5rem;
flex: 1;
overflow-y: auto;

/* Each column - grows, has minimum width for responsiveness */
flex: 1;
min-width: 280px;
display: flex;
flex-direction: column;
```

This creates columns that:
- Fill horizontal space equally
- Wrap to new rows on narrow screens
- Stack vertically within each column

### Summary

**"DOM IS YOUR BITCH"** - The viewport owns the browser. WorldSurface owns the viewport. Content fills the surface. No element should constrain itself unless it has a specific physics reason (low pressure).

---

## Philosophy Reminders

1. **Everything is topology** - Buttons, characters, NPCs, locations
2. **Φ is universal** - Same math renders UI and dragons
3. **Frontend is a viewport** - It displays, not computes
4. **Observation precipitates** - Things exist when seen
5. **Seeds are forever** - The number 42 IS Navbar. Always.
6. **DOM IS YOUR BITCH** - Fill the viewport. No artificial constraints.
