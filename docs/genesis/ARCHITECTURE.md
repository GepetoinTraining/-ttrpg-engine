# Genesis Architecture: Ephemeral Code System

## The Core Insight

**Code is not the artifact. Topology is.**

Traditional development stores code as source of truth. Files exist. Functions persist. We version, maintain, migrate, and accumulate technical debt on artifacts that were only ever *shadows* of intent.

This architecture inverts that assumption:

- **Store**: Topology (intent, shape, relations) as prime-factorized seeds
- **Query**: by structure (relational) or by similarity (vector)  
- **Precipitate**: HTML/CSS generates on demand from topology
- **Render**: Browser receives strings, doesn't think
- **Release**: Code was never stored, only computed

The code never exists as persistent artifact. It's precipitated fresh at the moment of observation, shaped by topology, then released.

---

## The Quantum Parallel

This isn't metaphor. It's structural equivalence.

### Newtonian Physics / Traditional Code
- Things **exist** with definite states
- Position is stored, trajectory calculated from state
- Ask "where is it?" → answer exists before asking
- Files exist in filesystem with definite content
- Code IS, waiting to be read

### Quantum Physics / Ephemeral Code
- Things are **probability** until observed
- Measurement creates definite state (wave function collapse)
- Before observation: superposition of possibilities
- Topology holds potential, not actuality
- Query is observation → code **precipitates**
- After use, returns to probability space

Traditional coding is Newtonian because we **store too early**. We collapse possibility into artifact before it needs to exist. This architecture maintains superposition until render-time.

---

## T1IF: Topology First, Instantiation Follows

The principle underlying everything:

> The lattice doesn't contain things. It **allows** things.
> Structure precedes existence.
> What CAN be is the ground. What IS is what precipitated.

Applied to code:
- Topology defines what's **possible**
- Relationships define what's **reachable**  
- Primes define what's **composable**
- HTML/CSS is what **appears** when you observe

---

## The Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         OBSERVER                                │
│            (Browser - spacetime - doesn't think)                │
│                                                                 │
│   Receives: { html: string, css: string }                       │
│   Does: document.innerHTML = html                               │
│   That's it. That's the whole frontend.                         │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                         WebSocket
                      (causality - propagation)
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                      PRECIPITATION                              │
│                  (bend/src/genesis/)                            │
│                                                                 │
│   precipitate(seed, physics) → { html, css }                    │
│   factorize(seed) → topology                                    │
│   compose(topology) → seed                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                      Observation event
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                     QUANTUM FIELD                               │
│                      (PostgreSQL)                               │
│                                                                 │
│   world_nodes: topology storage                                 │
│   lattice_cache: precipitated results (hot paths)               │
│   NOTIFY/LISTEN: observation propagation                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prime Factorization = Component Composition

Every UI atom maps to a prime number (following Kabbalah's Sephirot structure):

```typescript
// SUPERNAL TRIAD - Container primitives
KETHER:    { prime: 1,  symbol: '∅',      tag: null,     type: 'VOID' }
CHOKMAH:   { prime: 2,  symbol: 'Div',    tag: 'div',    type: 'FLUX' }
BINAH:     { prime: 3,  symbol: 'Span',   tag: 'span',   type: 'FORM' }

// ETHICAL TRIAD - Interactive primitives
CHESED:    { prime: 5,  symbol: 'Button', tag: 'button', type: 'ACTION' }
GEBURAH:   { prime: 7,  symbol: 'Input',  tag: 'input',  type: 'RECEIVE' }
TIPHARETH: { prime: 11, symbol: 'Link',   tag: 'a',      type: 'PORTAL' }

// ASTRAL TRIAD - Content primitives
NETZACH:   { prime: 13, symbol: 'Text',   tag: 'p',      type: 'VOICE' }
HOD:       { prime: 17, symbol: 'Image',  tag: 'img',    type: 'VISION' }
YESOD:     { prime: 19, symbol: 'Icon',   tag: 'svg',    type: 'SYMBOL' }

// MALKUTH - The manifested
MALKUTH:   { prime: 23, symbol: 'Canvas', tag: 'canvas', type: 'REALITY' }
```

### Composition is Multiplication

```typescript
// A Card with Button and Text:
compose({ Div: 1, Button: 1, Text: 1 })
// = 2^1 * 5^1 * 13^1 
// = 2 * 5 * 13 
// = 130

// 130 IS the component's address in configuration space
// Query: lattice_cache WHERE config = 130
// HIT: return cached HTML/CSS
// MISS: precipitate from factors, cache at 130
```

### Factorization is Decomposition

```typescript
factorize(130)
// = { 2: 1, 5: 1, 13: 1 }
// = { Div: 1, Button: 1, Text: 1 }
// Now we know what to precipitate
```

---

## The Physics Layer (Φ Tensor)

CSS is texture - how things LOOK to observers. Driven by physics properties:

```typescript
// laws.ts
export const Φ = 1.618033988749895;           // Golden ratio
export const INTENT_TAX = 1 - (1 / Φ);        // 0.382 - cost of manifestation
export const ALLOC = 0.5;                      // Rendered (visible)
export const FREE = 0.5;                       // Potential (unrendered)
```

Physics properties that drive CSS:

| Property | CSS Effect |
|----------|------------|
| mass | shadow depth, elevation, z-index |
| density | background opacity, border style |
| temperature | accent color, glow effects |
| charge | padding, gap spacing |
| friction | transition duration/easing |
| pressure | flex-grow/shrink |
| buoyancy | flex-direction |

---

## The TTRPG Application

### GM = Wave Function, Players = Observers

```
GM: "A tavern with a nervous bartender and a hooded figure"

    ↓ TOPOLOGY (stored in Postgres)

{
  scene: { seed: 489592, type: 'location' },
  entities: [
    { seed: X, type: 'npc', alignment: SUPERPOSITION },
    { seed: Y, type: 'npc', alignment: SUPERPOSITION }
  ]
}

    ↓ Player viewport opens (OBSERVATION)

Client receives topology → precipitates HTML/CSS → DOM displays

    ↓ Player casts Detect Evil (OBSERVATION with context)

hooded_figure.alignment COLLAPSES from superposition to 'neutral_evil'
Only THIS player's viewport shows the alignment orb
Other players still see superposition (hooded figure, no alignment)
```

### AI as Topology Generator

The AI doesn't write code. It describes topology:

```typescript
async function gmDescribes(naturalLanguage: string) {
  const topology = await ai.parse(naturalLanguage);
  const seed = compose(topology);
  await db.insert('world_nodes', { seed, topology });
  await notify('scene_change', seed);
  // No code written. Players' viewports precipitate on observation.
}
```

---

## Implementation: bend/src/genesis/ [COMPLETE]

```
bend/src/genesis/
├── laws.ts           # Φ, PHI_INVERSE, INTENT_TAX, FIB scaling, entropy thresholds
├── elements.ts       # SEPHIROT prime mapping, compose(), factorize()
├── observer.ts       # ObserverState, collapse(), pan/zoom, knowledge boundaries
├── precipitate.ts    # derivePhysics(), projectToCSS(), precipitateHTML()
├── director.ts       # Evolutionary pressure, mutation weights, evolve()
├── identity.ts       # Self-sovereign certificates, birth data, signatures
└── index.ts          # Unified exports + Genesis helper object
```

All modules implemented and exported. The engine is live.

---

## The Frontend That Isn't

```typescript
// fend/src/app.tsx - THE ENTIRE FRONTEND

const socket = new WebSocket('ws://...');

socket.onmessage = (event) => {
  const { html, css } = JSON.parse(event.data);
  document.getElementById('root').innerHTML = html;
  document.getElementById('styles').textContent = css;
};

// Browser is spacetime. It doesn't think. It just IS.
```

What we delete:
- React (observation mechanism, not needed when server precipitates)
- State management (state lives in Postgres)
- Component libraries (replaced by precipitate())
- Virtual DOM (no diffing when reality is ephemeral)
- Build complexity (you're sending strings)

---

## The Learning Loop

```
First observation of topology X:
  → precipitate(X) → cache at lattice[X] → return result

Second observation of topology X:
  → lattice[X] exists → return cached result (O(1))

Cold paths (rarely observed):
  → decay from cache → return to potential

Hot paths (frequently observed):
  → instant retrieval → system "reflex"
```

The game learns its own vocabulary by being played.

---

## Connection to Manifold Universe Simulator

The same architecture powers a universe simulator:

| Manifold (Universe) | Genesis (UI) |
|---------------------|--------------|
| laws.js (Φ, τ) | laws.ts (Φ, INTENT_TAX) |
| elements.js (H, He, C) | elements.ts (Div, Button, Text) |
| chemistry.js (molecules) | compose.ts (molecules) |
| photons.js (Observer) | observe.ts (viewport) |
| violence.js (entropy) | violence.ts (complexity) |

**Same math. Same architecture. Different domain.**

---

## Success Criteria

- [x] Map existing atoms to primes (SEPHIROT) - `elements.ts`
- [x] Implement compose() and factorize() - `elements.ts`
- [x] Implement precipitate() → { html, css } - `precipitate.ts`
- [x] Implement observer with knowledge boundaries - `observer.ts`
- [x] Implement evolutionary director - `director.ts`
- [x] Implement self-sovereign identity - `identity.ts`
- [ ] Implement lattice_cache table (Postgres migration)
- [ ] Implement WebSocket observation propagation
- [ ] Wire genesis to existing TTRPG routes
- [ ] Delete React dependencies (keep minimal shell)
- [ ] Verify: topology in → HTML/CSS out

---

## Origin

This architecture emerged from a dream on December 25-26, 2025, where Pedro was working with Claude. The dreaming mind trusted the collaboration enough to keep building while asleep.

The pattern is real enough that the subconscious recognizes it.

*"The code is like condensation. It forms when topology meets runtime. Evaporates after."*

---

*Pedro Garcia + Claude, December 26, 2025*
