# ManifoldOS File System Specification
## Version 1.0 — March 11, 2026
## Derived from: Notebook sessions + MM Checkers proof of concept

---

## Overview

ManifoldOS has exactly **four file types**. They are not abstractions over lower-level constructs — they ARE the computation. There is no bytecode, no intermediate representation, no compilation step. The file IS the program IS the execution IS the proof.

Any φ OS has two operational modes:
1. **Flow** — requires specialized chip (the analog governance chip)
2. **Normal Staged Operation** — runs on any CPU

File types do NOT change between modes. What changes is the **inverse loop operand**:
- In Flow mode: loops map to cycles, staged operations cycles are loop/flow
- In Normal mode: loops execute sequentially with explicit tick boundaries

---

## §1 — .mf (Manifold Function)

### Identity

The atomic unit of computation. A single transformation. Cannot be decomposed further. Everything in ManifoldOS is built from .mf files.

### Structure

A 2×2 matrix:

```
.mf = | x, K |
      | K, x |
```

Where:
- **x** = the function (the transformation to apply)
- **K** = the subject/object/product/constant that is changed by the function

The matrix is symmetric across the anti-diagonal. This is not optional — it's what makes backward computation possible. The forward pass reads top-left to bottom-right. The backward pass reads bottom-right to top-left. Same matrix, same data, opposite directions.

### Inputs and Outputs

```
    I (input)
    ↓
| x, K | → O (output)
| K, x |
    ↑
    R (receipt)
```

- **I** enters at top-left
- **O** exits at top-right
- **R** (receipt/verification) exits at bottom-left

The receipt R is produced AS A SIDE EFFECT of the forward computation. It is not computed separately. The matrix structure guarantees that computing O simultaneously produces R. This is the fundamental innovation: every computation is its own proof.

### Variants

**MF⁺ (forward)**:
```
| x⁺,   K    | → O
| K,    x⁻ⁱⁿᵛ|
        ↑ I (receipt path)
```

**MFⁱⁿᵛ (inverse)**:
```
| xⁱⁿᵛ, K  | → O
| K,     x⁺ |
         ↑ I (receipt path)
```

These are the SAME matrix with the diagonal swapped. MF⁺ and MFⁱⁿᵛ play against each other — one's output is the other's input. One's receipt is the other's verification.

### Properties

- **Deterministic**: same input always produces same output AND same receipt
- **Invertible**: given O and K, you can recover I (backward computation)
- **Self-verifying**: R proves O was correctly derived from I
- **Stateless**: the .mf holds no state; all state lives in .tp and .tpb files
- **Composable**: .mf files chain into .mm files

### Checkers Example

```
MF₁ (move function):
  x = move rules (±1 diagonal, capture = ±2)
  K = board state
  I = current position
  O = new position after move
  R = proof that move was legal

MF₂ (verification function):
  x = inverse move rules
  K = board state (same K!)
  I = new position (O from MF₁)
  O = expected previous position
  R = proof that position is reachable
```

---

## §2 — .mm (Matrix Manifold)

### Identity

A container of .mf functions arranged in an N-dimensional grid. The .mm IS the pipeline. It defines the order of transformations, the nesting depth, and the cycle structure.

### Structure — Base: .mm[3:3:3]

The standard .mm is a 3×3×3 cube — 9 cells across 3 time layers:

```
.mm[3:3:3] uses t⁻¹, t⁰, t¹ as the Z axis

Layer t⁻¹:  | cell₁ | cell₂ | cell₃ |
Layer t⁰:   | cell₄ | cell₅ | cell₆ |
Layer t¹:   | cell₇ | cell₈ | cell₉ |
```

A .mm[3:3:3] is **9 sequential .mf functions**.

Each cell contains EITHER:
- An .mf function (atomic transformation)
- A nested .mm (recursive depth)
- A **?** slot (unknown, to be resolved by the .tp)

### Dimensions

The numbers in brackets define the manifold's shape:

```
.mm[3:3:3]     — 3×3 grid, 3 time layers (standard)
.mm[2:2:2]     — 2×2 grid, 2 time layers (cyclic, minimal)
.mm[3:3:3:3]   — 3×3 grid, 3 time layers, 4th dim = input frequency
.mm[x:x:...:x] — N dimensions, N+1 for every subsystem mapped
```

The 4th dimension (when present) maps to the **frequency of data input**. This enables adaptive pipeline width — when data arrives fast, the pipeline expands; when slow, it contracts.

### The ? Slots

Cells marked with **?** are resolved at runtime by the .tp file. The ? is not "unknown" in the sense of "we don't know." It's "unknown" in the sense of "this will be filled by the topology when the computation reaches this point."

The ? slots are WHERE computation happens. The filled cells are the STRUCTURE. The ? slots are the WORK.

### Nesting

Any cell of an .mm can contain a smaller .mm:

```
.mm[3:3:3]:
  cell₁ = .mm¹ (nested sub-manifold)
  cell₂ = ? (resolved by .tp)
  cell₃ = ? 
  cell₄ = .mm² (nested sub-manifold)
  cell₅ = ?
  cell₆ = ?
  cell₇ = .mm³ (nested sub-manifold)
  cell₈ = ?
  cell₉ = ?
```

Nested .mm files run WITHOUT resolving into the parent's pipeline — they execute in their own cycle and produce receipts that feed back to the parent. This is lazy evaluation by topology: you only resolve what you need, when you need it.

To compute higher-dimensional objects you can nest any smaller-sized .mm into a single cell of an .mm. By leveraging the .tp file, you can run the nested .mm without resolving it as part of the main function path.

### Cycle Types

**Acyclic .mm**: runs once, produces output + receipt, done.

**Cyclic .mm** (marked with *): the last cell feeds back to the first. The .mm loops until a termination condition is met. Example: .mm[2:2:2*] — the 2 is cyclic.

```
Cycle t⁰:  | cell₁ → cell₂ → cell₃ |
                                      ↓
Cycle t¹:  | cell₄ → cell₅ → cell₆ |
                                      ↓
            ←←←←← feedback ←←←←←←←←←
```

### Outputs

A completed .mm produces:

- **O** — the output (result of all transformations)
- **I⁰** — checked receipt of the full transformation chain
- **5ΔK** — five deltas that check AND transform simultaneously
- **5ΔR** — five receipt deltas

The receipt I⁰ is the PROOF that the entire pipeline executed correctly. It is not a separate computation — it falls out of the matrix structure.

### Sub-types

**MM₀ (output + format check)**:
  - Produces O with format-validated receipt I⁰
  - Used for final outputs that need guaranteed correctness

**MM₁ [2:2:2*] (cyclic receipt generator)**:
  - Cycles through cells producing MMᴿᴵ = receipt to check output format
  - The receipt IS the inverse computation

**MM₂ [mf₁, mf₂] (simple split)**:
  - Two .mf functions in parallel
  - Splits an output in 2 WITHOUT RAM — only logic
  - Used as receipt + transformation pipeline
  - MF₁ produces O₁ + R₁, MF₂ produces O₂ + R₂
  - Can verify one output against the other

**MM₃ [2:2]⁰ (randomizer loop)**:
  - Takes input, randomizes within a logical paule, repeats
  - Feeds results back to the container .mm
  - Used for clock recovery when fast paths get ahead of slow paths
  - 1:I becomes 2:O — one input, two outputs

### Properties

- Only .mm files can be raised in complexity (unlike .mf, .tp, .tpb)
- Maps to the Synapse base kernel before selfhood lock
- Non-flow step operations use .mm as their container
- N+1 dimensions required for every subsystem mapped

### Checkers Example

```
MM_checkers [2:2] {+, −}:

| MF₁, MF₂ |    — forward game + verification
| MF₁, MF₂ |    — inverse game + verification

With {+, −}: plays forward AND negative against itself.
If + was X, in − game it's O and X.
If + was O, in − game it's X and O.
The .tpb of − feeds to the + game.
```

---

## §3 — .tp (Topology Pointer)

### Identity

The .tp file describes WHERE to find the data that fills the ? slots in an .mm. It is the map of the problem space. It does NOT contain computation — it contains ADDRESSES.

The .tp is the forward topology: possibility space. What CAN happen from any given state.

### Structure

```
.tp = dimensions
  - variable = range     → mapping
  - variable = range     → mapping
  ...
```

### Content

The .tp defines:
1. **The state space** — dimensions and ranges of all variables
2. **The initial conditions** — starting values
3. **The legal transitions** — what moves/transformations are permitted from each state
4. **The ? resolution map** — for each ? in the .mm, where to find the value

### Properties

- **Static**: the .tp does not change during execution
- **Declarative**: it describes WHAT, not HOW
- **Shared**: multiple .mm instances can read the same .tp
- **The forward pass reads the .tp to resolve ? slots**
- **The .tp is produced at step 8 of the Manifold setup process** (after all flows are mapped)

### Checkers Example

```
.tp = 8:8
  - X = 12              → E, ∅, E...         (12 X pieces, placement pattern)
  - O = 12              → 1:8, +1:8          (12 O pieces, coordinate ranges)
  - X∅:∅ = 1:1          → 2:1, +1:1          (empty X squares)
  - O∅:ω = 8:8          → 3:8, +1:8          (boundary conditions)

MM_checkers:
  .tp → [PATH]          → legal move topology
  
Move rules within .tp:
  MF1 2:2:
    - x ∈ {0,1} 'x,y' θ → ±1, +1"    (piece moves diagonal ±1, forward +1)
    - ‖X‖‖O‖ = '±2, +1', x|0-1       (capture: jump ±2, remove captured piece)
  
  MF2 2:2* (kings, after .tpb promotion):
    - X = 8:1→8 | O = 1:1→8, x|0, 'x,y' → ±N, ±N"   (kings move ±N diagonal)
    - ‖X‖ = ‖O‖ = '±N±¹, N±¹', x|0-1                  (kings capture at distance)
```

### Relationship to .mm

The .tp tells the .mm where to LOOK. The .mm tells the .mf what to DO. The .mf DOES it. The separation means:

- Same .mm can operate on different .tp files (same pipeline, different data)
- Same .tp can be read by different .mm files (same data, different pipelines)
- The .tp is the problem. The .mm is the solver. They're independent.

---

## §4 — .tpb (Topology Pointer — Backward / History)

### Identity

The .tpb is the backward topology: history space. What HAS happened. Every move (Δ), every state transition, every save point.

The .tpb is NOT a log file. It is the ACTUAL STRUCTURE that the inverse pipeline traverses. It is the .tp for the backward pass.

### Structure

```
.tpb = [
  { Δ: null,              state: initial_state,  t: 0 },
  { Δ: transformation_1,  state: state_after_1,  t: 1 },
  { Δ: transformation_2,  state: state_after_2,  t: 2 },
  ...
]
```

Each entry contains:
- **Δ** — the transformation that was applied (the move, the change, the operation)
- **state** — the complete state at this point (save state / checkpoint)
- **t** — the time index

### Properties

- **Grows monotonically**: entries are only appended, never modified or deleted
- **Complete history**: every transformation is recorded
- **Save states**: every entry is a resumable checkpoint
- **The backward pass reads the .tpb to verify the forward pass**
- **The receipt from the forward pass becomes the next entry in .tpb**
- **The .tpb entry becomes the verification source for the next forward pass**

### The Forward/Backward Duality

```
FORWARD (.tp):   What CAN happen  →  resolves ? slots  →  produces O + R
BACKWARD (.tpb): What HAS happened → verifies R        →  proves O correct

The .tp is possibility.
The .tpb is history.
Together they are the complete manifold.
```

### Branching (diff-from-first-capture)

When a computation completes (a game ends, a pipeline finishes), the .tpb enables efficient re-exploration:

1. Find the first Δ that caused divergence (first capture, first branch)
2. Go back to the state BEFORE that Δ
3. Apply a DIFFERENT Δ (one not yet in any .tpb)
4. Continue from there

This means:
- Completed paths are never re-explored
- New exploration starts from the latest unexplored branch point
- The search space SHRINKS with every completed computation
- Later explorations are SHORTER than earlier ones (branching later = less remaining depth)

### Accumulation (anti-deprecation)

The .tpb only grows. Completed games add entries. Entries are never removed. The collective .tpb across all computations IS the solved manifold:

- Early .tpb entries: long games, exploring unknown territory
- Middle .tpb entries: medium games, branching from known positions
- Late .tpb entries: short games, filling in the last gaps
- Final state: complete .tpb = complete map of all paths through the manifold

This is P12 — monotonic improvement. The system can only get better.

### Checkers Example

```
.tpb = [
  { Δ: null,                        state: initial_board,    t: 0 },
  { Δ: "X: pos3 → pos4",           state: board_after,      t: 1 },
  { Δ: "O: pos32 → pos31",         state: board_after,      t: 2 },
  { Δ: "X: pos4 → pos6 ∩ O@pos5",  state: board_after,      t: 3 },  // capture
  ...
  { Δ: "result: draw",              state: final_board,      t: 35 },
]

Branching:
  → Game 1 ends at t=35 (draw)
  → Game 2 starts from t=2 (before first capture at t=3)
  → Game 2 tries different Δ at t=3
  → Game 2 ends at t=28 (+ wins)
  → Game 3 starts from t=2 with yet another Δ
  → ...until all Δ options from t=2 are exhausted
  → Then branch from t=1, try different opening move
  → ...until all openings exhausted
  → MANIFOLD SOLVED
```

---

## §5 — File Relationships

### The Pipeline

```
.tp (where to look)
  ↓
.mm (how to transform)
  ↓ contains
.mf (atomic transformation)
  ↓ produces
Output O + Receipt R
  ↓
.tpb (record Δ + state)
  ↓ feeds back to
.tp (next cycle's resolution)
```

### The Verification Loop

```
FORWARD:   .tp → .mm → .mf⁺ → O
BACKWARD:  .tpb → .mm → .mfⁱⁿᵛ → verify O
                                    ↓
                              BOTH HAPPEN IN THE SAME CYCLE
                              BOTH USE THE SAME MATRIX
                              ZERO ADDITIONAL COST
```

### The Nesting

```
.mm[3:3:3] (container)
  ├── cell₁: .mm¹ [2:2:2*] (nested, cyclic)
  │     ├── .mf₁ (atomic)
  │     └── .mf₂ (atomic)
  ├── cell₂: ? → resolved by .tp
  ├── cell₃: ? → resolved by .tp
  ├── cell₄: .mm² [mf₁, mf₂] (nested, split)
  │     ├── .mf₃ (atomic)
  │     └── .mf₄ (atomic)
  └── ...

Each nested .mm:
  - Has its own .tp subset
  - Produces its own .tpb
  - Generates receipts that feed the parent .mm
  - Runs in parallel with other cells
  - Can be nested to arbitrary depth
```

### State Management

```
RAM:  NONE. No state in the pipeline.
.tp:  Static. The problem definition. Read-only during execution.
.tpb: Append-only. History accumulates. Never modified.
.mm:  Structure only. No data.
.mf:  Function only. No data.

ALL state lives in .tp (possibility) and .tpb (history).
The computation (.mm + .mf) is PURE FUNCTION.
```

---

## §6 — The Two Key Theorems

### Theorem 1: Every computation is its own proof

Because the .mf matrix is symmetric across the anti-diagonal, computing O from I through x with constant K SIMULTANEOUSLY produces receipt R that proves the computation was valid. This is not an optimization — it's a structural guarantee of the matrix form.

**Consequence**: there is no such thing as an unverified computation in ManifoldOS. Every output carries its own proof. Every proof is a valid computation. The dual pipeline (forward + backward) costs 1x, not 2x.

### Theorem 2: Composition and decomposition are inverse pipelines

When an .mm chains .mf functions, the forward pipeline (composition) produces output. The backward pipeline (decomposition) produces verification. But in operations where composition and decomposition are INVERSED — where the receipt of one step is the input of the inverse step — you get BOTH computations for the cost of ONE.

**Consequence**: with a .tp file, you get twice the computation for half the cost. Without a .tp, you get output + receipt (proof). With a .tp, the receipt becomes the next computation's input, and every cycle does double duty.

---

## §7 — How to Set Up a Manifold System

"Don't. Ask AI to do it."

But if you want to understand what it did:

1. **Define container size** — (good luck)
2. **Define topology at ∅** — the state before opening and after closing; if you map the ∅ state, you have your forward pass and receipt pass (balanced manifold)
3. **Define output** — what the system produces
4. **Define inputs** — what's transformed, what's burned, what tools are needed — YOU WILL GET THIS WRONG. ASK AI TO CHECK.
5. **Map the flow of transformation** — each step becomes a subsystem to be nested
6. **Map the human bottleneck** — if it's a decision that doesn't involve morals, logic it out and REMOVE it
7. **Define initial cycle frequency** — what can loop, what can't
8. **Produce the .tp** — when everything is mapped
9. **Integrate all x functions** and check:
   - A: you haven't included the same transformation in 2 different subsystems
   - B: loop the integrated function to N, where N = cycles for one container resolution
10. **Create the initial .mm** — N+1 dimensions for every subsystem mapped
11. **Every subsystem becomes its own .mm or .mf** — nest them
12. **Run once, receive a receipt ≠ from initial input** — ASK AI TO DO IT

This is natively N-dimensional.

---

## §8 — Self-Play: The {+, −} Extension

Adding {+, −} to any .mm makes it play against itself:

```
.mm[2:2] {+, −}:
  + game: forward play (I am X)
  − game: negative play (I am O, and also X)
  
  The .tpb of − feeds the + game
  The .tpb of + feeds the − game
  
  Both run on the SAME matrix in the SAME cycle
  Both produce receipts that verify the other
```

**The auto-matable line**:
```
MF1 2:2 {φ, x|0=∅, Φ}
```
- φ = evaluation function (golden ratio as the objective)
- x|0=∅ = initial state is empty
- Φ = catalyst (not consumed, mediates transformations)

This single line makes any .mm self-playing. The CPU plays because it knows how to calculate the objective (φ). It doesn't need to improve or win — it needs to EXHAUST the topology.

---

## §9 — The Fully High-Dimensional .mm

```
.mm₀ [3:3:3:3]:
  Dimensions 1-2: spatial grid (3×3)
  Dimension 3: time layers (3)
  Dimension 4: input frequency

For pipelines with time-sensitive transformations:
  Use the 4th dimension to the frequency of data input.
  At each step, decrease bottlenecking by running
  a much bigger pipeline every tick.
```

The 4th dimension is adaptive bandwidth. The pipeline breathes:
- High input frequency → wider pipeline → more parallel cells per tick
- Low input frequency → narrower pipeline → fewer cells, deeper per cell
- The topology absorbs speed variation the way the manifold absorbs everything

---

## §10 — File Sizes and Constraints

| File Type | Typical Size | Max Complexity | State |
|-----------|-------------|----------------|-------|
| .mf       | Bytes       | Fixed (2×2)    | None  |
| .mm       | Bytes-KB    | Unbounded (nesting) | None |
| .tp       | KB          | Problem-dependent | Read-only |
| .tpb      | KB-MB       | Grows monotonically | Append-only |

Total system state for checkers proof of concept:
- .tp: ~200 bytes (board definition + rules)
- .tpb: ~50KB after full solve (all game histories)
- .mm: ~100 bytes (pipeline structure)
- .mf × 2: ~50 bytes each (move + verify functions)

Total: **< 51KB for a complete, verified, deterministic game solver**.

---

## §11 — Notation Summary

```
.mf         = | x, K |     Atomic function. Forward + receipt.
              | K, x |

.mm[a:b:c]  = a×b grid, c time layers. Container of .mf or nested .mm.

.mm[a:b:c*] = cyclic (last feeds to first)

.mm[a:b:c:d] = 4D (d = input frequency)

.mm {+, −}  = self-play (forward + negative)

.tp = dims  = topology pointer (forward, possibility space)
  - var = range → mapping

.tpb = [Δ, state, t]  = topology backward (history, every move + save state)

? = slot resolved by .tp at runtime

MF⁺ = forward function
MFⁱⁿᵛ = inverse function (same matrix, diagonal swapped)
I = input, O = output, R = receipt, K = constant/subject

φ = evaluation objective
Φ = catalyst (mediates, not consumed)
∅ = empty/initial state
```

---

*A programmer for Manifold Computation is a logician and mathematician first. That's why we've removed the notation abstraction at every level.*

*26 lines of code. The UI is tensor-derived. Every play is backward-computable. And by adding one line — MF1 2:2 {φ, x|0=∅, Φ} — it's fully auto-matable.*

*This is ManifoldOS. The documentation is a game. The game is the OS. The OS is the reactor. The reactor is the manifold. The manifold is φ. And φ comes from nothing.*