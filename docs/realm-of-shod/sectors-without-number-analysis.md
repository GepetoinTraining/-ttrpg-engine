# Sectors Without Number — Pattern Extraction

> *"His functions aren't us-shaped, but they have gold in there."*

Analysis of [mpigsley/sectors-without-number](https://github.com/mpigsley/sectors-without-number) — the friend's React + Redux + Firebase implementation of *Stars Without Number* sector generation, written ~9 years ago. This document extracts the renderer architecture, procedural-generation patterns, and design choices worth borrowing for our renderer extraction (Phase 5+ of `docs/realms-of-shod-mapping.md`).

The codebase is a well-structured class-component-era React app. The patterns transfer cleanly even where the technology has aged.

---

## Tech stack snapshot

| Layer | What they used | Our equivalent |
|---|---|---|
| Framework | React 16 (class components) | Next 16 / React 19 (function components + hooks) |
| State | Redux + redux-thunk + reselect | TPB-replayed views via `useWorld()`; no global store for game state |
| Backend | Firebase + Firestore | Turso + slot-push flywheel |
| Random | `chance` 1.0.18 | `SeededRNG` (FNV-1a + LCG); could adopt `chance.weighted` |
| Color | `tinycolor2` | none currently — useful for LOD compositing |
| Forms | `react-select` 1.x, `react-modal` | Custom `ModalFrame` |
| i18n | `react-intl` | none (deferred) |
| Build | `react-scripts` 5 (CRA) | Next.js 16 + Turbopack |

The aged dependencies (CRA, react-redux, react-intl) are noise. The architectural patterns underneath are good.

---

## The dice.js joke (and what it means)

`src/primitives/icons/dice.js` is an SVG icon component. The path data:

```
<path d="M255.76 44.764c-6.176 0-12.353 1.384-17.137 4.152
          L85.87 137.276c-9.57 5.536-9.57 14.29 0 19.826
          ... [three rotated sub-arcs embedded] ...
          a31.953 18.96 0 0 1-45.19 26.813 31.953 18.96 0 0 1 23.992-32.348
          ..." />
```

The numbers `31.953 18.96 0 0 1 -45.19 26.813` look like 7 coordinates — and they ARE, in SVG arc syntax. But arcs in SVG path-D take `rx ry x-axis-rotation large-arc-flag sweep-flag x y` — *seven values per arc command*. The `31.953` and `18.96` are **rotation/scale parameters disguised as positional data**. Three different dice-face circles share one arc primitive; each is a different `rx ry rotation`. Reading the source you can't tell what's coordinate vs transform.

This is the same kind of obfuscation as the matlab snippet from earlier:
```
mag = round(16*(sqrt(re.^2 + im.^2)/32767));
```
One line, four operations: complex magnitude → normalize → scale to 16 levels → quantize. The math is *inside* the data, not separated from it.

**Why this matters for our work:** the same trick lives in our hologram math. The κ-tensor's variation hash IS data shaped like a coordinate (`H(worldSeed, q, r) → bits → quantized variant choices`). The bits don't separate "decision" from "coordinate"; they ARE the decision encoded as a coordinate-shaped thing. The friend has been doing this style of math for a long time. He's going to recognize the hologram pattern when he sees it.

---

## The renderer — Canvas 2D, redraw-on-prop-change

This is the load-bearing architectural insight. Their renderer is **astonishingly simple** for what it does.

### `src/components/hex-map/hex-map.js` — the React layer

```jsx
class HexMap extends Component {
  componentDidMount()  { hexCanvas({ ctx: this.ctx, ratio: this.ratio, ...this.props }); }
  componentDidUpdate() { hexCanvas({ ctx: this.ctx, ratio: this.ratio, ...this.props }); }

  render() {
    return (
      <canvas
        width={width * this.ratio} height={height * this.ratio}
        style={{ width, height }}
        ref={this.canvas}
        onMouseMove={...} onMouseDown={...} onMouseUp={...}
      />
    );
  }
}
```

**That's it.** Component is a thin shell. Canvas ref + mount/update both call the same render function with the same props. No diffing, no partial redraws, no requestAnimationFrame loop. State change → React rerenders → `componentDidUpdate` fires → full canvas redraw.

This works because a sector is small (~96 hexes) and the redraw is fast (<5ms). For our tactical view (8×8 = 64 chunks, similar order), the same pattern works. **Steal this directly.**

### `src/utils/hex/canvas.js` — the actual rendering

The render function is ~280 lines. Structure:

1. **Background fill** (`fillRect` the whole canvas dark)
2. **Pre-process hex list** — multiply offsets by pixel ratio, attach top-level entity, compute hex polygon points
3. **Pass 1: Hex polygons** — per-hex `beginPath / moveTo / lineTo×5 / closePath / fill / stroke`. Color depends on state (hovered/held/highlighted/painted) decided inline.
4. **Layer composite** (region paint) — when a hex has N layer colors, build a `createLinearGradient` between two opposing vertices, place N color stops at evenly-spaced positions. `tinycolor2.getBrightness()` decides if text on this hex needs to be black or white.
5. **Pass 2: Navigation routes** — line paths between hex centers, with dash patterns by route type (`solid` / `dotted` / `short` / default). Stroke style per route.
6. **Pass 3: Hold→hover vector arrow** — when the user is dragging an entity, an arrow from `holdLocation` to `hoverLocation` with a triangle head. `Math.atan` for the rotation, two `lineTo` for the triangle.
7. **Pass 4: Text + entity dots** — only on highlighted hexes. Coordinate label, entity name, child count, and a small filled circle marking the entity position.

Each pass is one loop over `hexEntities`. State decisions (which color, which dash, which text) are inline. **No virtual DOM. No diffing. Each redraw is a fresh paint.**

### `src/utils/hex/common.js` — pure hex math (5 lines)

```javascript
const sizeDiff = Math.sqrt(3) / 2;
export const getHexPoints = ({ width, xOffset, yOffset }) => {
  const radius = width / 2;
  const hexagon = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3;
    hexagon.push({
      x: radius * Math.cos(angle) + xOffset,
      y: radius * Math.sin(angle) + yOffset,
    });
  }
  return hexagon;
};
```

`cos/sin` at π/3 increments. Trivially adaptable to **square tiles** (4 corners at π/4 + π/2·n) for our torus topology. Or to **octagons**, or anything regular.

### `src/utils/canvas-helpers.js` — picking + DPI

```javascript
export const getHoveredHex = ({ x, y, hexes }) => {
  const candidates = hexes.filter(hex => isWithin({ x, y }, getHexBoundingBox(hex)) && hex.highlighted);
  if (candidates.length <= 1) return candidates[0]?.hexKey;
  return candidates.reduce(  // pick nearest center if multiple bbox hits
    (best, hex) => {
      const d = distanceBetween({ x, y }, { x: hex.xOffset, y: hex.yOffset });
      return d < best.distance ? { hexKey: hex.hexKey, distance: d } : best;
    },
    { distance: Infinity },
  ).hexKey;
};

export const getPixelRatio = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const bsr = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio
           || ctx.msBackingStorePixelRatio  || ctx.oBackingStorePixelRatio
           || ctx.backingStorePixelRatio || 1;
  return dpr / bsr;
};
```

Bounding-box-then-nearest-center for picking — O(n) but n is small. The `getPixelRatio` accounts for HiDPI: canvas internal pixels are `width × ratio`, CSS pixels are `width`. Steal both directly.

---

## The procedural generation pattern

`src/utils/entity-generators/` is a clean example of how to structure procedural content.

### `commonGenerator` HOF

Every entity generator wraps a specific function inside a common one. The common one handles id/name/parent linking; the specific one only adds the entity's distinct attributes.

```javascript
// common-generator.js (paraphrased)
const commonGenerator = specificFn => (entityType, config) => {
  const baseEntity = {
    name: config.name || generateName(entityType),
    parentId: config.parentId,
    type: entityType,
    // ...
  };
  return specificFn(baseEntity, config);
};
```

Then each entity is one specific function:
```javascript
export const generatePlanet = commonGenerator((entity, { generate }) => {
  if (!generate) return entity;
  const chance = new Chance();
  return {
    ...entity,
    attributes: {
      techLevel: chance.weighted(['0','1','2','3','4','4+','5'], [1,2,7,7,16,2,1]),
      atmosphere: chance.weighted(Object.keys(Atmosphere.attributes), [1,2,3,24,3,2,1]),
      temperature: chance.weighted(Object.keys(Temperature.attributes), [1,2,7,16,7,2,1]),
      biosphere: chance.weighted(Object.keys(Biosphere.attributes), [1,2,7,16,7,2,1]),
      population: chance.weighted(Object.keys(Population.attributes), [1,2,7,16,7,2,1]),
    },
  };
});
```

`chance.weighted(values, weights)` = pick a value from `values` with probability proportional to `weights`. The `[1,2,7,16,7,2,1]` is a Gaussian-shaped distribution centered on the middle value.

**This is the morphogen-field quantizer we sketched in `mesh-hologram.md` step 4.** The weight table is the substrate's morphogen probability density; the d20-equivalent is `chance.weighted`. We should adopt this API directly.

### Generation chain

```
generateSector       → name, rows, columns, blank coordinate grid
  generateSystems    → pick N coordinates from the grid (chance.pickset)
    generateSystem   → bind coords; spawn children (planets/asteroids/stations/etc.)
      generatePlanet → roll attributes (atmosphere, temp, biosphere, population)
      generateMoon   → roll attributes
      ... etc
```

Top-down composition. Each level rolls what's appropriate at its scale. Children are an array on the parent. Pure functions, no side effects, no store coupling. Generators return plain objects; action creators / sagas inject them into Redux.

**Maps directly onto our entity ladder.** Their sector ≈ our region; their system ≈ our settlement-cluster; their planet ≈ our settlement; their moon ≈ our district. Same compositional pattern, different scale and theme.

---

## Pattern adoption matrix

What to borrow, what to skip.

| Their pattern | Adopt? | Where in ours |
|---|---|---|
| Canvas 2D as render substrate | ✓ | Hologram renderer base — output is `RenderedTile.primitives[] + .surface` rasterized to Canvas |
| Redraw-on-prop-change (no partial invalidation) | ✓ | Same — full canvas redraw per state change for tactical view (~64 chunks fits easily) |
| Pixel-ratio handling (`getPixelRatio()`) | ✓ | Steal verbatim |
| Hex picking by bounding-box → nearest-center | ✓ | Adapt to square tiles; same algorithm |
| Layered overlay passes (base fill → routes → vectors → text) | ✓ | Maps onto entity tier passes (T0 substrate → T7+ primitives → T15 narrative overlays → T6 active scenes) |
| `getHexPoints` trigonometric vertex generator | ✓ adapted | Replace π/3 with π/4 for square tiles; same shape |
| `tinycolor2` brightness check for text-on-color | ✓ | Useful for LOD color compositing |
| `createLinearGradient` for layered hex coloring | ✓ | Useful for κ-gradient visualization (faction influence overlays, weather severity) |
| `chance.weighted(values, weights)` morphogen quantizer | ✓ adopt | Add `chance` as dependency; use for variation hash quantization |
| `commonGenerator` HOF pattern | ✓ | Apply to our entity generators (currently scattered across `engine/*.ts`) |
| Single Canvas element per logical view | ✓ | Tactical view = one canvas; hub interior = one canvas; world map = one canvas |
| Drag-vector arrow between hold and hover | ✓ | Useful for our movement-planning UI (right-click + drag plans a path) |
| Class components | ✗ | Use function components + hooks |
| Redux + redux-thunk + reselect | ✗ | We use TPB-replayed views via `useWorld()` |
| Firebase + Firestore | ✗ | We have Turso + flywheel |
| `react-scripts` (CRA) | ✗ | We use Next 16 |
| `react-intl` | ✗ (defer) | Internationalization is downstream of working renderer |
| `react-modal` 3.x | ✗ | We have `ModalFrame` |
| Hex grid specifically | ✗ | We're square-tile on torus |

**The thing to internalize:** their renderer is **300 lines of canvas paint** plus **5 lines of hex math** plus **50 lines of React shell**. That's the entire visual surface for a multi-thousand-user TTRPG tool. Our hologram-based renderer has more layers internally (6 LOD tiers, observer filters, primitive composition) but the rendering primitive should be just as small. Aim for ~500 lines for the canvas layer + the hex-points-equivalent for square tiles + the React shell.

---

## How this slots into our build plan

Updates to `docs/realms-of-shod-mapping.md` Phase 5+ (the renderer extraction):

### Phase 5: adapter — unchanged from the mapping doc.

`src/lib/realms-of-shod-export.ts` with 47 `toRealms<Type>()` functions + 1 relationship aggregator. Wire format produced from our state.

### Phase 7: renderer extraction — now concrete

The renderer is a single Canvas 2D component with three pieces:

1. **`src/components/world-canvas/world-canvas.tsx`** — React shell, ~80 lines. Mirrors their `hex-map.js`:
   - Holds a canvas ref
   - `useEffect` on prop change calls the renderer (replaces componentDidMount/Update)
   - Wires `onMouseMove`/`onMouseDown`/`onMouseUp`/`onContextMenu`/`onMouseLeave`
   - `getPixelRatio()` for HiDPI

2. **`src/lib/render/world-canvas.ts`** — the paint function, ~400-500 lines. Mirrors their `utils/hex/canvas.js`:
   - Takes `{ ctx, ratio, tiles: RenderedTile[], observer, hoverKey, holdKey, ... }`
   - Pass 1: substrate fill (T0 material composition → background color per tile)
   - Pass 2: T8 primitives (workshops, deposits, structures rendered as Canvas shapes)
   - Pass 3: entity overlays (T3-T5 entities as small icons / chips)
   - Pass 4: navigation lines + path planning (T12 caravans in transit, drag vectors)
   - Pass 5: text labels (tile coords, entity names) — gated by zoom level
   - LOD: drop passes when `observer.lodMaxTier` cuts off

3. **`src/lib/render/tile-math.ts`** — square-tile math, ~30 lines. Mirrors their `utils/hex/common.js`:
   - `getTilePoints({ width, xOffset, yOffset }) → 4 corners` (replaces `getHexPoints`)
   - `getTotalWidth(tileWidth, columns)` etc. (torus-grid math)
   - `tilesNeighbors(a, b)` (4-neighbor for square; or 8-neighbor with diagonals)

4. **`src/lib/render/picking.ts`** — pixel→tile lookup, ~20 lines. Mirrors their `utils/canvas-helpers.js`:
   - `getHoveredTile({ x, y, tiles })` — bounding box → nearest center
   - `getPixelRatio()` — verbatim from theirs

The renderer consumes `RenderedTile[]` from `hologramAt()` (per `docs/mesh-hologram.md`) and `RealmsEntity[]` overlays from the export adapter (per `docs/realms-of-shod-mapping.md`). One canvas, redraw-on-state-change, layered overlay passes. Their friend can replace any pass with their own paint code; the contract stays at the `RenderedTile` shape.

### What to do BEFORE renderer extraction

- Add `chance` as a dependency (`npm i chance`); rewrite our morphogen-quantizer to use `chance.weighted` instead of bespoke quantization.
- Add `tinycolor2` for color brightness compositing.
- Refactor existing entity generators (currently scattered across `engine/*.ts`) into a `commonGenerator` HOF pattern. Cleaner separation.

These three changes are upstream cleanups that the renderer benefits from. Each is small. Total ~200 lines of refactor.

---

## What's NOT in their codebase that we need

Things we'll have to invent, since they don't have analogues:

1. **Multi-observer filtering** — they have one viewer (the GM); fog of war is a binary `highlighted` flag. We need per-character κ-filter projection.

2. **κ-gradient visualization** — they don't have inheritance; faction influence is just a string lookup per hex. We need to render smooth Δκ across tiles.

3. **Time-of-day lighting** — sectors don't have day/night; ours does. Need a lighting pass.

4. **Distance LOD with primitive aggregation** — they render every hex at full detail at every zoom. We need T0-primitives to composite into T3-entities to composite into T11-silhouettes as zoom decreases.

5. **Coupling-failure rendering** — apoptotic tiles need a visual signature distinct from "no entity here." Their hexes either have an entity or don't; we have a third state (wilderness/gap).

6. **Mesh diff propagation** — when a player chops a tree, the diff updates a tile. Their world is static after generation; ours mutates via flywheel.

These five are net-new work. The rest is pattern transfer.

---

## Closing

The friend's codebase is a clean React-class-era app with three excellent pieces hidden in it: Canvas-2D-with-full-redraw rendering, `chance.weighted` for procedural distributions, and the `commonGenerator` HOF for entity composition. The dice.js icon is a perfect distillation of his style: math hidden as data, three operations folded into one path string, working perfectly without the mechanism being legible.

For our renderer extraction, the architecture is now concrete:

- **One canvas. One paint function. Layered overlay passes. Full redraw on state change.**
- **`RenderedTile[]` (from our hologram) + `RealmsEntity[]` (from our adapter) → Canvas pixels.**
- **Square tile on torus, 4 corners, π/4 increments, `getTilePoints` is 8 lines.**
- **`chance.weighted` for the morphogen quantizer; `tinycolor2` for brightness checks.**
- **~500 lines of paint + ~80 of React shell + ~30 of tile math + ~20 of picking. ~630 lines total.**

That's the renderer we ship to the friend. Their entities go in (via the `realms-of-shod-export.ts` adapter); our hologram paints them; they replace whatever passes they want.
