import { describe, it, expect } from 'vitest'
import { buildSpriteSpec, generateMonsterSprite } from './generator'

describe('buildSpriteSpec — base species behavior', () => {
  it('uses the species color and intrinsic size when no overrides given', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin' })
    expect(spec.color).toBe('#5a8a3a')
    expect(spec.size).toBe('Small')
    expect(spec.framePx).toBe(24)
    expect(spec.sheetWidth).toBe(24 * 8)
    expect(spec.sheetHeight).toBe(24)
    expect(spec.frameCount).toBe(8)
    expect(spec.overlays).toEqual([])
  })

  it('respects colorOverride', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', colorOverride: '#ff00ff' })
    expect(spec.color).toBe('#ff00ff')
  })

  it('respects sizeOverride', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', sizeOverride: 'Huge' })
    expect(spec.size).toBe('Huge')
    expect(spec.framePx).toBe(128)
  })

  it('falls back to crToMobSize for unknown species', () => {
    const spec = buildSpriteSpec({ speciesId: 'totally_made_up', cr: 12 })
    // generic profile baseCR 0.5 / size Medium → species size wins
    expect(spec.size).toBe('Medium')
  })

  it('fire elemental is Large + orange', () => {
    const spec = buildSpriteSpec({ speciesId: 'fire_elemental' })
    expect(spec.size).toBe('Large')
    expect(spec.color).toBe('#ff5a1a')
    expect(spec.framePx).toBe(64)
  })

  it('gibbering_mouther is Medium aberrant', () => {
    const spec = buildSpriteSpec({ speciesId: 'gibbering_mouther' })
    expect(spec.species.kingdom).toBe('aberrant')
    expect(spec.size).toBe('Medium')
  })
})

describe('buildSpriteSpec — adaptation overlays', () => {
  it('no adaptations → no overlays', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin' })
    expect(spec.overlays).toHaveLength(0)
  })

  it('ARMORED produces an armor_band overlay', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', adaptations: ['ARMORED'] })
    expect(spec.overlays).toHaveLength(1)
    expect(spec.overlays[0].kind).toBe('armor_band')
  })

  it('SWIFT produces motion_trails colored with the body color', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', adaptations: ['SWIFT'] })
    expect(spec.overlays[0].kind).toBe('motion_trails')
    if (spec.overlays[0].kind === 'motion_trails') {
      expect(spec.overlays[0].color).toBe('#5a8a3a')
      expect(spec.overlays[0].trailCount).toBe(3)
    }
  })

  it('PACK produces satellites with count 4', () => {
    const spec = buildSpriteSpec({ speciesId: 'orc', adaptations: ['PACK'] })
    expect(spec.overlays[0].kind).toBe('satellites')
    if (spec.overlays[0].kind === 'satellites') {
      expect(spec.overlays[0].count).toBe(4)
    }
  })

  it('STEALTH dims and dashes', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', adaptations: ['STEALTH'] })
    if (spec.overlays[0].kind === 'stealth_dim') {
      expect(spec.overlays[0].opacity).toBeLessThan(1)
      expect(spec.overlays[0].dashed).toBe(true)
    }
  })

  it('REGEN produces a green halo', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', adaptations: ['REGEN'] })
    expect(spec.overlays[0].kind).toBe('regen_halo')
    if (spec.overlays[0].kind === 'regen_halo') {
      expect(spec.overlays[0].color).toMatch(/^#/)
    }
  })

  it('CUNNING enlarges eyes', () => {
    const spec = buildSpriteSpec({ speciesId: 'goblin', adaptations: ['CUNNING'] })
    expect(spec.overlays[0].kind).toBe('cunning_eyes')
    if (spec.overlays[0].kind === 'cunning_eyes') {
      expect(spec.overlays[0].eyeScale).toBeGreaterThan(1)
    }
  })

  it('multiple adaptations produce overlays in order', () => {
    const spec = buildSpriteSpec({
      speciesId: 'goblin',
      adaptations: ['ARMORED', 'PACK', 'STEALTH'],
    })
    expect(spec.overlays).toHaveLength(3)
    expect(spec.overlays[0].kind).toBe('armor_band')
    expect(spec.overlays[1].kind).toBe('satellites')
    expect(spec.overlays[2].kind).toBe('stealth_dim')
  })

  it('all 10 adaptations produce 10 overlays', () => {
    const spec = buildSpriteSpec({
      speciesId: 'goblin',
      adaptations: ['ARMORED', 'SWIFT', 'PACK', 'REGEN', 'STEALTH', 'REFLECT', 'DRAIN', 'SPLIT', 'ADAPT', 'CUNNING'],
    })
    expect(spec.overlays).toHaveLength(10)
    const kinds = spec.overlays.map(o => o.kind)
    expect(kinds).toEqual([
      'armor_band',
      'motion_trails',
      'satellites',
      'regen_halo',
      'stealth_dim',
      'reflect_sheen',
      'drain_tendrils',
      'split_crack',
      'adapt_shimmer',
      'cunning_eyes',
    ])
  })
})

describe('buildSpriteSpec — determinism', () => {
  it('identical inputs produce identical specs', () => {
    const a = buildSpriteSpec({ speciesId: 'wolf', adaptations: ['ARMORED', 'PACK'], cr: 1 })
    const b = buildSpriteSpec({ speciesId: 'wolf', adaptations: ['ARMORED', 'PACK'], cr: 1 })
    expect(a).toEqual(b)
  })

  it('overlay order matches adaptation order in input', () => {
    const a = buildSpriteSpec({ speciesId: 'orc', adaptations: ['ARMORED', 'PACK'] })
    const b = buildSpriteSpec({ speciesId: 'orc', adaptations: ['PACK', 'ARMORED'] })
    expect(a.overlays.map(o => o.kind)).not.toEqual(b.overlays.map(o => o.kind))
  })
})

describe('generateMonsterSprite (browser path)', () => {
  it('returns null in node test environment without canvas', () => {
    const result = generateMonsterSprite({ speciesId: 'goblin' })
    expect(result).toBeNull()
  })
})
