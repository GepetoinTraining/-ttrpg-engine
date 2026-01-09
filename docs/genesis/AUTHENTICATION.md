# Topology-First Authentication

**The math IS the handshake.**

```
φ + ζ = π
```

Authentication without passwords. Without tokens. Without sessions.

Just: **same seed + same math = same answer**.

---

## How It Works

### Enrollment (One Time, Human Verified)

1. Human requests enrollment with ID
2. System captures: `datetime + geolocation`
3. Creates seed: `concatenate → prime factorize → Fibonacci variant → ζ`
4. Admin verifies human identity (in-person, trusted channel)
5. Certificate issued (contains seed + ζ)
6. Both server and client now know the same math

### Authentication (Every Time)

```
Client: "I am [id]"
Server: "Prove it. Compute M^47"

Client has seed → computes ζ → creates M = [[φ, ζ], [ζ, φ]] → computes M^47
Server has seed → computes ζ → creates M = [[φ, ζ], [ζ, φ]] → computes M^47

Match? You're you.
Diverge? You're nobody.
```

### Device Lost?

```
Admin: revoke(id)
```

That trajectory no longer authenticates.
Human verification for new device.

---

## The Math

```
φ = (1 + √5) / 2                    # Golden ratio (self-reference)
F_k(seed) = seeded Fibonacci        # YOUR counting
ζ = Σ 1/F_k²                        # YOUR permission structure
M = [[φ, ζ], [ζ, φ]]               # YOUR fundamental matrix

Authentication = M^n trajectory matches
```

The private key is literally **how you count**. Your path through the permission structure.

---

## API

```
POST /enroll/request    { id, geo: { lat, lon } }  → { token }
POST /enroll/approve    { token }                   → { certificate }
GET  /enroll/pending                                → { pending: [...] }

POST /auth/challenge    { id }                      → { challengeId, n }
POST /auth/verify       { challengeId, trajectory } → { authenticated, id }

GET  /admin/seeds                                   → { seeds: [...] }
POST /admin/revoke      { id }                      → { revoked }
```

---

## Security Properties

| Traditional | Topology-First |
|-------------|----------------|
| Passwords → can leak, phish, brute-force | No passwords → nothing to leak |
| Tokens → can steal, replay | No tokens → nothing to steal |
| Sessions → can hijack | No sessions → nothing to hijack |
| Server stores secrets | Both compute same answer |

**Device-bound** → certificate tied to enrollment moment
**Human-gated** → new devices require human verification  
**Revocable** → one call kills an identity

The security is the **unreproducibility of the enrollment moment**. You cannot be at that place at that time again. Your spacetime coordinate becomes your cryptographic anchor.

---

## Connection to Genesis Architecture

The same math powers everything:

| System | Seed Creation | Verification |
|--------|---------------|--------------|
| Auth | datetime + geo → factorize → ζ | M^n trajectory |
| UI | topology → compose → seed | precipitate(seed) |
| World | description → topology → seed | render(seed) |
| Memory | event → encode → seed | recall(seed) |

**One math. All domains.**

---

## Inspired By

- Realm of the Mad God (bullet trajectory computation)
- TeX (topology before instantiation)
- The universe (φ + ζ = π)

---

*© 2025 Pedro Garcia & Anthropic*
