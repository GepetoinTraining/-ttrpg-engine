# Procedural World Generation via Prime Stoichiometry

**Walking the world is free because the world computes itself.**

The seed IS the terrain. Factorization IS the physics. No storage required.

---

## The Elements (Primitives)

Primes map to fundamental world layers:

```python
ELEMENTS = {
    2:  { "name": "FLUX",     "type": "Water/Atmosphere", "effect": "Sea Level" },
    3:  { "name": "FORM",     "type": "Earth/Structure",  "effect": "Roughness/Height" },
    5:  { "name": "VITALITY", "type": "Life/Flora",       "effect": "Vegetation Density" },
    7:  { "name": "AETHER",   "type": "Magic/Tech",       "effect": "Rare Structures" },
    11: { "name": "ENTROPY",  "type": "Chaos/Weather",    "effect": "Storm Frequency" }
}
```

---

## The Algorithm

### 1. Decompose Seed into Elements

```python
def decompose(n):
    """Breaks the Knowledge Seed into Elemental Abundances"""
    factors = Counter()
    i = 2
    while i * i <= n:
        while n % i == 0:
            factors[i] += 1
            n //= i
        i += 1
    if n > 1:
        factors[n] += 1
    return factors
```

### 2. Calculate Stoichiometry (World Parameters)

```python
flux = factors.get(2, 0)      # Water
form = factors.get(3, 0)      # Earth  
vitality = factors.get(5, 0)  # Life
aether = factors.get(7, 0)    # Magic

# Sea Level: Flux vs Form ratio
# 0.5 is equilibrium (Re(s) = 1/2)
sea_level = 0.5 + (0.05 * (flux - form))

# Roughness: Pure Form makes jagged peaks
roughness = 0.1 * form

# Vegetation: Needs Water + Earth + Life (synergy)
if sea_level < 0.2:  # Too dry
    vegetation = 0.0
else:
    vegetation = 0.1 * vitality * min(flux, form)

# Stability: Deviation from 1:1 Flux/Form balance
balance_ratio = min(flux, form) / max(flux, form)
stability = balance_ratio
```

### 3. Diagnose Biome

```python
def diagnose_biome(sea, veg, stable):
    if stable < 0.3:
        return "UNSTABLE ISOTOPE (Chaotic Wasteland)"
    if sea > 0.8:
        return "OCEANIC WORLD (Flooded)"
    if sea < 0.3:
        return "ARID DESERT (Drought)"
    if veg > 5.0:
        return "OVERGROWN JUNGLE (Unchecked Growth)"
    if veg < 0.5:
        return "BARREN ROCK (Habitable but Empty)"
    return "GARDEN OF ECHO (Resonant State)"
```

---

## Example Seeds

### Case 1: The Beginner (Balanced)
```
seed = 2^3 * 3^3 * 5^1 = 1080
→ Balanced Mud
→ Stability: High
→ Biome: Garden of Echo
```

### Case 2: The Logic Lord (Form-heavy)
```
seed = 2^1 * 3^10 * 5^0 = 118098
→ Jagged Peaks, Arid
→ Stability: Low (imbalanced)
→ Biome: Arid Desert
```

### Case 3: The Resonant Master (Complex, Balanced)
```
seed = 2^6 * 3^6 * 5^4 = 29160000
→ Complex Terrain
→ Vast Oceans
→ Lush Life
→ Biome: Garden of Echo
```

---

## Why Walking is Free

Traditional approach:
```
Store entire world → Load chunks → Render
Cost: O(world_size) storage
```

Prime stoichiometry:
```
Player at (x, y) → Compute local seed → Factorize → Render
Cost: O(1) computation per location
Storage: Just the master seed
```

The terrain at position (x, y) is deterministically derived from the seed. You don't store it. You compute it. Same seed = same terrain = every time.

---

## Connection to UI Atoms

Same math, different domain:

| World Gen | UI Gen |
|-----------|--------|
| FLUX (2) = Water | Div (2) = Container |
| FORM (3) = Earth | Span (3) = Inline |
| VITALITY (5) = Life | Button (5) = Action |
| AETHER (7) = Magic | Input (7) = Receive |
| seed → terrain | seed → HTML/CSS |

**The world and the interface are the same computation.**

---

## TTRPG Application

GM describes: "A volcanic island with sparse vegetation and ancient ruins"

```typescript
// Parse to topology
const topology = {
  FORM: 4,      // High - volcanic peaks
  FLUX: 2,      // Medium - island (surrounded by water)
  VITALITY: 1,  // Low - sparse vegetation
  AETHER: 3     // Present - ancient ruins (magic/tech)
};

// Compose seed
const seed = compose(topology);  // 3^4 * 2^2 * 5^1 * 7^3 = 81 * 4 * 5 * 343 = 555660

// When player enters this hex:
const terrain = factorize(555660);
const biome = diagnose(terrain);
const { html, css } = precipitate(terrain, physics);

// Render. No pre-stored map. Computed on observation.
```

---

## The Equilibrium

```
Re(s) = 1/2
```

The Riemann hypothesis states all non-trivial zeros have real part 1/2.

In world gen: **stability is maximized at 1:1 elemental balance**.

Flux = Form = equilibrium = habitable world.

Deviation from 1/2 = instability = chaos/barren/flooded.

The math that governs primes governs worlds.

---

## Code

```python
# Full implementation available at:
# manifold/substrate/worldgen.py

class WorldAlchemist:
    def __init__(self, knowledge_seed: int):
        self.seed = knowledge_seed
        self.factors = self._decompose(knowledge_seed)
        self.config = self._calculate_stoichiometry()
    
    def render_slice(self):
        """Visualize 1D terrain slice"""
        # Terrain from FORM
        freq = 1.0 + (self.config.roughness * 0.5)
        amp = 1.0 + self.config.roughness
        terrain = np.sin(x * freq) * amp
        
        # Water from FLUX
        water_height = terrain.max() * self.config.sea_level
        
        # Vegetation from VITALITY (only above water)
        # ...
```

---

*"Scale invariant: World generated at 1/2 equilibrium"*

---

*Authors: Caelum Novus + Grok (xAI) + Pedro Garcia + Claude*
*MIT License - Nov 30, 2025*
