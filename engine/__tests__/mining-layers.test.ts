import { describe, it, expect } from 'vitest'
import {
  createSurfaceLayer,
  revealNextLayer,
  applyDailyDepletion,
  densityOf,
  shouldRollHazard,
  depthForLayer,
  maxReserveForDepth,
  MineLayerSchema,
  RESOURCE_DEPTH_BAND,
} from '../mining-layers'

describe('depthForLayer', () => {
  it('layer 0 is at the surface', () => {
    expect(depthForLayer(0)).toBe(0)
  })
  it('layer 1 is 50m down, layer N is 50 + (N-1)*100', () => {
    expect(depthForLayer(1)).toBe(50)
    expect(depthForLayer(2)).toBe(150)
    expect(depthForLayer(5)).toBe(450)
  })
})

describe('maxReserveForDepth', () => {
  it('grows monotonically with depth', () => {
    expect(maxReserveForDepth(0)).toBeLessThan(maxReserveForDepth(100))
    expect(maxReserveForDepth(100)).toBeLessThan(maxReserveForDepth(500))
  })
  it('caps the depth bonus past 800', () => {
    expect(maxReserveForDepth(900) - maxReserveForDepth(800)).toBe(
      maxReserveForDepth(1000) - maxReserveForDepth(900),
    )
  })
})

describe('createSurfaceLayer', () => {
  it('returns a revealed layer 0 with positive reserve', () => {
    const l = createSurfaceLayer('mine-suzail-1')
    expect(MineLayerSchema.safeParse(l).success).toBe(true)
    expect(l.layerId).toBe(0)
    expect(l.depth).toBe(0)
    expect(l.revealed).toBe(true)
    expect(l.reserve).toBeGreaterThan(0)
    expect(l.reserve).toBe(l.initialReserve)
    expect(l.structuralIntegrity).toBe(1.0)
  })

  it('is deterministic from the mineNodeId', () => {
    const a = createSurfaceLayer('mine-suzail-1')
    const b = createSurfaceLayer('mine-suzail-1')
    expect(a).toEqual(b)
  })

  it('different mines produce different layers', () => {
    const a = createSurfaceLayer('mine-suzail-1')
    const b = createSurfaceLayer('mine-wheloon-1')
    // At least one of (resourceType, initialReserve) should differ — if both
    // collide it's a flake against the FNV hash, but it's astronomically rare.
    expect(a.resourceType !== b.resourceType || a.initialReserve !== b.initialReserve).toBe(true)
  })

  it('only picks resources within the surface depth band', () => {
    for (let i = 0; i < 20; i++) {
      const l = createSurfaceLayer(`mine-${i}`)
      const band = RESOURCE_DEPTH_BAND[l.resourceType]
      expect(band.minDepth).toBeLessThanOrEqual(0)
    }
  })
})

describe('revealNextLayer', () => {
  it('returns a deeper layer with depth > parent.depth', () => {
    const surface = createSurfaceLayer('mine-x')
    const next = revealNextLayer(surface, 'mine-x', 100)
    expect(next).not.toBeNull()
    expect(next!.layerId).toBe(1)
    expect(next!.depth).toBeGreaterThan(surface.depth)
    expect(next!.revealed).toBe(true)
  })

  it('caps at MAX_LAYERS (10)', () => {
    let cur = createSurfaceLayer('mine-deep')
    for (let i = 0; i < 10; i++) {
      cur = revealNextLayer(cur, 'mine-deep', 100)!
    }
    expect(cur.layerId).toBe(10)
    const overflow = revealNextLayer(cur, 'mine-deep', 100)
    expect(overflow).toBeNull()
  })

  it('is deterministic from (mineNodeId, layerId, worldDay)', () => {
    const surface = createSurfaceLayer('mine-y')
    const a = revealNextLayer(surface, 'mine-y', 50)
    const b = revealNextLayer(surface, 'mine-y', 50)
    expect(a).toEqual(b)
  })

  it('worldDay variation produces different rolls', () => {
    const surface = createSurfaceLayer('mine-z')
    const a = revealNextLayer(surface, 'mine-z', 1)!
    const b = revealNextLayer(surface, 'mine-z', 999)!
    // Either resource or initial reserve should differ across worldDays.
    expect(a.resourceType !== b.resourceType || a.initialReserve !== b.initialReserve).toBe(true)
  })
})

describe('applyDailyDepletion', () => {
  it('drops reserve by depletionRate * days', () => {
    const l = createSurfaceLayer('mine-d')
    const next = applyDailyDepletion(l, 5)
    expect(next.reserve).toBe(Math.max(0, l.reserve - l.depletionRate * 5))
  })
  it('floors at zero', () => {
    const l = { ...createSurfaceLayer('mine-d'), reserve: 1, depletionRate: 100 }
    const next = applyDailyDepletion(l, 1)
    expect(next.reserve).toBe(0)
  })
  it('no-op for unrevealed layer', () => {
    const l = { ...createSurfaceLayer('mine-d'), revealed: false }
    expect(applyDailyDepletion(l, 5)).toEqual(l)
  })
  it('no-op for already-depleted layer', () => {
    const l = { ...createSurfaceLayer('mine-d'), reserve: 0 }
    expect(applyDailyDepletion(l, 5)).toEqual(l)
  })
})

describe('densityOf + shouldRollHazard', () => {
  it('density is reserve / initialReserve, clamped', () => {
    const l = createSurfaceLayer('mine-d')
    expect(densityOf(l)).toBe(1)
    const half = applyDailyDepletion(l, Math.floor(l.initialReserve / 2 / l.depletionRate))
    expect(densityOf(half)).toBeGreaterThan(0.4)
    expect(densityOf(half)).toBeLessThan(0.6)
  })
  it('shouldRollHazard fires when integrity < threshold', () => {
    const l = createSurfaceLayer('mine-h')
    expect(shouldRollHazard(l)).toBe(false)
    const cracked = { ...l, structuralIntegrity: l.hazardThreshold - 0.05 }
    expect(shouldRollHazard(cracked)).toBe(true)
  })
})
