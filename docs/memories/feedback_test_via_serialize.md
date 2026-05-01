---
name: Test MM domain state via serialize().domain — never via protected getDomainState
description: Reaching into protected `getDomainState` from a test with `mm.getDomainState!()` + ReturnType-keyof type gymnastics produces hangs / brittle compiles. Always go through the public `serialize()` path.
type: feedback
originSessionId: -home-pgarcia
---

When testing an MM extending `SimulatedMMBase` (engine/mm-simulated.ts), use the public `serialize()` accessor — `const dom = mm.serialize().domain as <DomainShape>` — to read the MM's domain state. Never write tests that call the `protected getDomainState()` method directly via `mm.getDomainState!()` or with `ReturnType<MMx['getDomainState' & keyof MMx]>` type expressions.

**Why:** Pedro flagged 2026-05-01 that one of my mm-mining-layers tests was "waiting for something that won't come in" — the test was reaching into a `protected` method via `mm.getDomainState!() as ReturnType<MMMineNode['getDomainState' & keyof MMMineNode]>`. The intersection `'getDomainState' & keyof T` is typically `never` because TS `keyof` only includes public members; the resulting type is unusable, the runtime call is an access violation in spirit even if TS protected is erased at runtime, and the construct is brittle/confusing for a reader. Vitest didn't actually hang in this run, but Pedro's read of the test was that it looked like it was waiting on a never-arriving value — meaning the pattern is unreadable.

**How to apply:**
- `SimulatedMMBase.serialize()` returns `{ state, domain: unknown }` — that's the canonical public read.
- In tests: `const dom = mm.serialize().domain as { ...the MM's domain shape... }`. Cast to the concrete domain interface the MM declares. Done.
- Don't use `mm.getDomainState!()` in tests. Don't use `ReturnType<keyof>` gymnastics to recover the protected return type — write the domain type out by hand or import the exported `<MMx>DomainState` interface and cast to it.
- Same rule for any MM-style class with a `protected get<X>State()` and a public `serialize()`: tests use `serialize()`.
