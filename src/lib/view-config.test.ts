import { describe, it, expect } from 'vitest'
import {
  defaultViewConfig,
  toggleHidden,
  togglePinned,
} from './view-config'

describe('defaultViewConfig', () => {
  it('returns empty hidden + pinned for a fresh owner', () => {
    const c = defaultViewConfig('char_1')
    expect(c.ownerId).toBe('char_1')
    expect(c.hidden).toEqual([])
    expect(c.pinned).toEqual([])
    expect(c.updatedAt).toBe(0)
  })
})

describe('toggleHidden', () => {
  it('adds a surface id when not present', () => {
    const c = defaultViewConfig('char_1')
    const next = toggleHidden(c, 'guild')
    expect(next.hidden).toContain('guild')
  })

  it('removes a surface id when already present', () => {
    let c = defaultViewConfig('char_1')
    c = toggleHidden(c, 'guild')
    c = toggleHidden(c, 'guild')
    expect(c.hidden).not.toContain('guild')
  })

  it('does not mutate the input', () => {
    const c = defaultViewConfig('char_1')
    const next = toggleHidden(c, 'guild')
    expect(c.hidden).toEqual([])
    expect(next).not.toBe(c)
  })
})

describe('togglePinned', () => {
  it('adds and removes pin state', () => {
    let c = defaultViewConfig('char_1')
    c = togglePinned(c, 'spells')
    expect(c.pinned).toContain('spells')
    c = togglePinned(c, 'spells')
    expect(c.pinned).not.toContain('spells')
  })

  it('hidden and pinned are independent', () => {
    let c = defaultViewConfig('char_1')
    c = togglePinned(c, 'spells')
    c = toggleHidden(c, 'guild')
    expect(c.pinned).toEqual(['spells'])
    expect(c.hidden).toEqual(['guild'])
  })
})
