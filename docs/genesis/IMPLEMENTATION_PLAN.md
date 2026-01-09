# Genesis Implementation Plan

## Phase 1: Foundation (bend/src/genesis/)

### 1.1 laws.ts
Port the fundamental constants from manifold:

```typescript
export const Φ = 1.618033988749895;
export const PHI_INV = 0.618033988749895;
export const INTENT_TAX = 1 - PHI_INV;  // 0.382
export const ALLOC = 0.5;
export const FREE = 0.5;
```

### 1.2 elements.ts
Map UI atoms to primes following Sephirot structure:

```typescript
export const SEPHIROT = {
  KETHER:    { prime: 1,  symbol: 'Void',   tag: null,     type: 'VOID' },
  CHOKMAH:   { prime: 2,  symbol: 'Div',    tag: 'div',    type: 'FLUX' },
  BINAH:     { prime: 3,  symbol: 'Span',   tag: 'span',   type: 'FORM' },
  CHESED:    { prime: 5,  symbol: 'Button', tag: 'button', type: 'ACTION' },
  GEBURAH:   { prime: 7,  symbol: 'Input',  tag: 'input',  type: 'RECEIVE' },
  TIPHARETH: { prime: 11, symbol: 'Link',   tag: 'a',      type: 'PORTAL' },
  NETZACH:   { prime: 13, symbol: 'Text',   tag: 'p',      type: 'VOICE' },
  HOD:       { prime: 17, symbol: 'Image',  tag: 'img',    type: 'VISION' },
  YESOD:     { prime: 19, symbol: 'Icon',   tag: 'svg',    type: 'SYMBOL' },
  MALKUTH:   { prime: 23, symbol: 'Canvas', tag: 'canvas', type: 'REALITY' },
};
```

### 1.3 compose.ts
Topology → Seed (prime multiplication):

```typescript
export function compose(topology: Record<string, number>): bigint {
  let seed = 1n;
  for (const [symbol, count] of Object.entries(topology)) {
    const prime = getPrime(symbol);
    if (prime && count > 0) {
      seed *= BigInt(prime) ** BigInt(count);
    }
  }
  return seed;
}
```

### 1.4 factorize.ts
Seed → Topology (prime factorization):

```typescript
export function factorize(seed: bigint): Map<number, number> {
  const factors = new Map<number, number>();
  const primes = Object.values(ELEMENTS).map(e => e.prime).sort((a,b) => a-b);
  
  let remaining = seed;
  for (const p of primes) {
    const bigP = BigInt(p);
    let count = 0;
    while (remaining % bigP === 0n) {
      count++;
      remaining = remaining / bigP;
    }
    if (count > 0) factors.set(p, count);
  }
  return factors;
}
```

### 1.5 physics.ts
Port the Φ tensor from fend - physics → CSS:

```typescript
export interface Physics {
  mass: number;        // 0-1, shadow/elevation
  density: Density;    // void/gas/liquid/solid/dense
  temperature: Temperature;  // cold/warm/hot/critical/fusion
  charge: number;      // padding/gap
  friction: number;    // transition timing
  pressure: number;    // flex grow/shrink
  buoyancy: number;    // flex direction
}

export function physicsToCSS(physics: Physics): string {
  // Implement the 7 laws from phi.ts
}
```

### 1.6 precipitate.ts
The core: Topology + Physics → { html, css }

```typescript
export function precipitate(
  seed: bigint, 
  physics: Physics,
  context?: PrecipitationContext
): { html: string; css: string } {
  const factors = factorize(seed);
  const css = physicsToCSS(physics);
  const html = buildHTML(factors, context);
  return { html, css };
}
```

---

## Phase 2: Lattice Cache (Database)

### 2.1 Schema Addition

```sql
CREATE TABLE ui_lattice (
    config      TEXT PRIMARY KEY,  -- BigInt as string
    html        TEXT NOT NULL,
    css         TEXT NOT NULL,
    physics     TEXT NOT NULL,     -- JSON
    hits        INTEGER DEFAULT 1,
    created_at  INTEGER NOT NULL,
    last_hit    INTEGER NOT NULL
);

CREATE INDEX idx_lattice_hits ON ui_lattice(hits DESC);
CREATE INDEX idx_lattice_last_hit ON ui_lattice(last_hit);
```

### 2.2 Cache Operations

```typescript
// Check cache before precipitating
async function getOrPrecipitate(seed: bigint, physics: Physics) {
  const cached = await db.get('ui_lattice', seed.toString());
  
  if (cached) {
    await db.update('ui_lattice', seed.toString(), { 
      hits: cached.hits + 1,
      last_hit: Date.now() 
    });
    return { html: cached.html, css: cached.css };
  }
  
  const result = precipitate(seed, physics);
  await db.insert('ui_lattice', {
    config: seed.toString(),
    ...result,
    physics: JSON.stringify(physics),
    created_at: Date.now(),
    last_hit: Date.now()
  });
  
  return result;
}
```

### 2.3 Cache Maintenance (Heartbeat)

```typescript
// Prune cold paths
async function pruneColdPaths() {
  const threshold = Date.now() - 86400000; // 24 hours
  await db.delete('ui_lattice', {
    hits: { lt: 3 },
    last_hit: { lt: threshold }
  });
}
```

---

## Phase 3: Observation Layer (WebSocket)

### 3.1 PostgreSQL NOTIFY/LISTEN

```sql
-- Trigger on world_nodes changes
CREATE OR REPLACE FUNCTION notify_topology_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('topology_change', json_build_object(
    'operation', TG_OP,
    'id', NEW.id,
    'seed', NEW.seed
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER topology_changed
AFTER INSERT OR UPDATE ON world_nodes
FOR EACH ROW EXECUTE FUNCTION notify_topology_change();
```

### 3.2 WebSocket Server

```typescript
// bend/src/ws/observer.ts
import { Pool } from 'pg';

const pool = new Pool();

pool.connect((err, client) => {
  client.on('notification', async (msg) => {
    const payload = JSON.parse(msg.payload);
    const topology = await getTopology(payload.id);
    const { html, css } = await getOrPrecipitate(topology.seed, topology.physics);
    
    // Broadcast to all connected observers
    broadcast(payload.id, { html, css });
  });
  
  client.query('LISTEN topology_change');
});
```

### 3.3 Client Connection

```typescript
// The entire frontend
const socket = new WebSocket('ws://localhost:3001');

socket.onmessage = (event) => {
  const { html, css } = JSON.parse(event.data);
  document.getElementById('root').innerHTML = html;
  document.getElementById('styles').textContent = css;
};
```

---

## Phase 4: Atom Migration

### 4.1 Audit Existing Atoms

Current atoms in fend/src/styles/processors/_internal/atomic/:
- button.tsx → prime: 5 (CHESED/ACTION)
- input.tsx → prime: 7 (GEBURAH/RECEIVE)
- link.tsx → prime: 11 (TIPHARETH/PORTAL)
- text.tsx → prime: 13 (NETZACH/VOICE)
- icon.tsx → prime: 19 (YESOD/SYMBOL)
- badge.tsx → prime: 29 (PATH/ALEPH)
- avatar.tsx → prime: 31 (PATH/BETH)
- spinner.tsx → prime: 37 (PATH/GIMEL)
- pill.tsx → prime: 41 (PATH/DALETH)

### 4.2 Extract Topology from Each Atom

For each atom, extract:
1. HTML structure (tag, attributes)
2. Physics defaults
3. Variants as physics overrides
4. Children slots

### 4.3 Create Precipitation Templates

```typescript
// bend/src/genesis/templates/button.ts
export const ButtonTemplate = {
  prime: 5,
  tag: 'button',
  defaultPhysics: { mass: 0.7, temperature: 'hot', friction: 0.2 },
  variants: {
    primary: { temperature: 'hot' },
    secondary: { temperature: 'warm' },
    ghost: { density: 'gas', mass: 0.3 },
    danger: { temperature: 'critical' }
  },
  precipitate: (physics, children, attrs) => {
    const css = physicsToCSS(physics);
    return {
      html: `<button style="${css}" ${attrsToString(attrs)}>${children}</button>`,
      css: '' // inline for now, could be class-based
    };
  }
};
```

---

## Phase 5: Molecule Migration

### 5.1 Molecules as Composite Primes

```typescript
// Card = Div + Text = 2 * 13 = 26
// Modal = Div^2 + Button = 4 * 5 = 20
// Form = Div + Input^3 + Button = 2 * 343 * 5 = 3430

export const MOLECULES = {
  Card: { seed: 26n, composition: { Div: 1, Text: 1 } },
  Modal: { seed: 20n, composition: { Div: 2, Button: 1 } },
  Form: { seed: 3430n, composition: { Div: 1, Input: 3, Button: 1 } },
  // ...
};
```

### 5.2 Molecule Precipitation

```typescript
function precipitateMolecule(seed: bigint, physics: Physics, slots: Record<string, string>) {
  const factors = factorize(seed);
  // Build nested structure from factors
  // Insert slot content where specified
  // Apply physics cascade (parent → children)
}
```

---

## Phase 6: Frontend Deletion

### 6.1 Dependencies to Remove

```json
// Remove from fend/package.json:
{
  "react": "DELETE",
  "react-dom": "DELETE", 
  "@tanstack/react-router": "DELETE",
  "@tanstack/react-query": "DELETE",
  // Keep only:
  // - TypeScript (for bend)
  // - Vite (for dev server, maybe)
}
```

### 6.2 New Frontend Structure

```
fend/
├── index.html          # Single HTML file
├── styles/
│   └── variables.css   # CSS variables (the physics constants)
└── main.ts             # WebSocket connection only
```

### 6.3 The Final Frontend

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/styles/variables.css">
  <style id="styles"></style>
</head>
<body>
  <div id="root"></div>
  <script>
    const ws = new WebSocket('ws://localhost:3001');
    ws.onmessage = (e) => {
      const { html, css } = JSON.parse(e.data);
      document.getElementById('root').innerHTML = html;
      document.getElementById('styles').textContent = css;
    };
  </script>
</body>
</html>
```

---

## Phase 7: Testing

### 7.1 Round-Trip Test

```typescript
// Test: topology → seed → factors → precipitation → verify
const topology = { Button: 1, Text: 1 };  // Simple card
const seed = compose(topology);           // 5 * 13 = 65
const factors = factorize(seed);          // { 5: 1, 13: 1 }
const { html, css } = precipitate(seed, defaultPhysics);

assert(html.includes('<button'));
assert(html.includes('<p') || html.includes('<span'));
assert(css.includes('transition'));
```

### 7.2 Cache Test

```typescript
// First call: precipitate and cache
const result1 = await getOrPrecipitate(65n, physics);
const cached = await db.get('ui_lattice', '65');
assert(cached.hits === 1);

// Second call: cache hit
const result2 = await getOrPrecipitate(65n, physics);
assert(cached.hits === 2);
assert(result1.html === result2.html);
```

### 7.3 WebSocket Test

```typescript
// Insert topology → verify client receives precipitation
await db.insert('world_nodes', { id: 'test', seed: '65', physics: {...} });
// Client should receive { html, css } via WebSocket
```

---

## Success Metrics

- [ ] laws.ts compiles and exports constants
- [ ] elements.ts maps 10 Sephirot + 22 Paths
- [ ] compose({ Button: 1 }) returns 5n
- [ ] factorize(5n) returns { 5: 1 }
- [ ] precipitate(5n, physics) returns valid { html, css }
- [ ] lattice_cache stores and retrieves
- [ ] PostgreSQL NOTIFY triggers on insert
- [ ] WebSocket broadcasts to clients
- [ ] Client renders received HTML
- [ ] React dependencies removed
- [ ] Total frontend < 50 lines

---

## Order of Operations

1. **Create bend/src/genesis/** folder structure
2. **Port laws.ts** from manifold
3. **Create elements.ts** with prime mappings
4. **Implement compose.ts** and **factorize.ts**
5. **Port physics.ts** from fend phi.ts
6. **Implement precipitate.ts** (basic version)
7. **Add ui_lattice table** to migrations
8. **Test round-trip** (compose → factorize → precipitate)
9. **Add PostgreSQL triggers**
10. **Create WebSocket server**
11. **Reduce frontend** to WebSocket client
12. **Migrate atoms** one by one
13. **Migrate molecules**
14. **Delete React**
15. **Celebrate**

---

*"The frontend was always a lie. We just stopped pretending."*
