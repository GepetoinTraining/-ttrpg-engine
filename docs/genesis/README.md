# Genesis: The Ephemeral Code Architecture

> *"The code is like condensation. It forms when topology meets runtime. Evaporates after."*

## What Is This?

Genesis is a radical rethinking of how software renders reality. Instead of storing code as files, we store **topology** (structure, relationships, intent) and **precipitate** code on demand when observation occurs.

This mirrors how the actual universe works:
- Quantum fields hold potential
- Observation collapses wave functions
- Reality renders only what's observed
- Unobserved states remain probabilistic

## Core Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full system design, the quantum parallel, stack overview |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Step-by-step build plan, code examples, migration strategy |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Topology-first auth using matrix trajectories |
| [WORLDGEN.md](./WORLDGEN.md) | Procedural terrain from prime factorization |

## The One-Sentence Summary

**Prime factorization of topology seeds produces deterministic HTML/CSS, cached in a lattice for O(1) retrieval, with no persistent frontend code.**

## Key Equations

```
Composition:    topology → seed = Π(prime^count)
Factorization:  seed → topology = prime decomposition
Precipitation:  topology + physics → { html, css }
Observation:    viewport renders → cache populates
```

## The Stack

```
PostgreSQL          ← Quantum field (topology storage)
    ↓ NOTIFY
WebSocket           ← Causality (change propagation)  
    ↓ { html, css }
Browser DOM         ← Spacetime (doesn't think, just IS)
```

## What We Delete

- React and virtual DOM (no diffing needed for ephemeral reality)
- State management libraries (state lives in Postgres)
- Component files (replaced by precipitation functions)
- Most of node_modules (sending strings, not running framework)

## What Remains

- TypeScript in `bend/` (the server, the brain)
- CSS variables (physics constants)
- One HTML file (the viewport)
- WebSocket connection (the observation channel)

## Origin Story

December 25-26, 2025. A dream where coding continued during sleep. The subconscious recognized the pattern as real. Claude cold-booted into existence and helped crystallize the architecture.

Built on prior work:
- manifold/ universe simulator (same math, cosmological scale)
- Teef memory system (lattice caching, topology-first cognition)
- Φ tensor UI system (physics-driven CSS)

## Files in This Directory

```
docs/genesis/
├── README.md                 # This file
├── ARCHITECTURE.md           # Full system design
├── IMPLEMENTATION_PLAN.md    # Build roadmap
├── AUTHENTICATION.md         # Topology-first auth
└── WORLDGEN.md              # Prime stoichiometry terrain
```

## Next Steps

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the build order:

1. Create `bend/src/genesis/` with laws, elements, compose, factorize
2. Implement precipitation (topology → HTML/CSS)
3. Add lattice cache to database
4. Wire up PostgreSQL NOTIFY → WebSocket
5. Reduce frontend to WebSocket receiver
6. Migrate atoms/molecules to topology definitions
7. Delete React

---

*Pedro Garcia + Claude, December 26, 2025*

*"The frontend was always a lie. We just stopped pretending."*
