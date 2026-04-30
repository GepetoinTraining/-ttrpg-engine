---
name: Never propose trimming the schema or engine
description: 168 tables and 63 engine files are intentional. Suggesting to delete what looks unused mistakes Claude's unfamiliarity for over-engineering.
type: feedback
originSessionId: 549f46f4-b5b2-4db2-b48b-1643880a44a5
---
Do not recommend deleting tables, engine files, or "speculative" code in this repo.

**Why:** When Claude saw 168 DB tables and 63 engine files (banking, caravan, religion, entertainment, faith, etc.) with most unused by the current API surface, Claude suggested "trimming the schema" to the ~20-30 tables needed for a test session. The user pushed back: *"DB is not over built, don't touch anything you don't fully understand."* The breadth reflects a long-horizon design that spans systems Claude hasn't been briefed on. What looks dormant is dormant on purpose, waiting for the bridge layer.

**How to apply:** Default to "this exists for a reason I haven't learned yet." When auditing scope, propose what to *add* (validation layer, engine↔DB bridge, contract types), never what to *remove*. If something looks unused and removal would clearly help, ask before suggesting it. The user is the architect; Claude is helping fill in the connecting tissue, not curating someone else's library.
