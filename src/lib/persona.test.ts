import { describe, it, expect } from 'vitest'
import {
  PERSONA_DEFAULT,
  PERSONA_LABELS,
  PERSONA_GLYPHS,
  personaKey,
  type Persona,
} from './persona'

describe('PERSONA_DEFAULT', () => {
  it('starts as DM with no character', () => {
    expect(PERSONA_DEFAULT.type).toBe('dm')
    expect(PERSONA_DEFAULT.characterId).toBeNull()
  })
})

describe('PERSONA_LABELS / PERSONA_GLYPHS', () => {
  it('has labels and glyphs for all 4 persona types', () => {
    const types = ['dm', 'player', 'gm-ai', 'dmless'] as const
    for (const t of types) {
      expect(PERSONA_LABELS[t]).toBeTruthy()
      expect(PERSONA_GLYPHS[t]).toBeTruthy()
    }
  })
})

describe('personaKey', () => {
  it('returns just the type for non-character personas', () => {
    expect(personaKey({ type: 'dm', characterId: null })).toBe('dm')
    expect(personaKey({ type: 'dmless', characterId: null })).toBe('dmless')
  })

  it('includes the character id for player persona', () => {
    const p: Persona = { type: 'player', characterId: 'char_abc' }
    expect(personaKey(p)).toBe('player:char_abc')
  })

  it('includes the character id for gm-ai persona', () => {
    const p: Persona = { type: 'gm-ai', characterId: 'char_xyz' }
    expect(personaKey(p)).toBe('gm-ai:char_xyz')
  })

  it('falls back to none when character id is missing for player', () => {
    const p: Persona = { type: 'player', characterId: null }
    expect(personaKey(p)).toBe('player:none')
  })

  it('different characters produce different keys', () => {
    const p1: Persona = { type: 'player', characterId: 'a' }
    const p2: Persona = { type: 'player', characterId: 'b' }
    expect(personaKey(p1)).not.toBe(personaKey(p2))
  })
})
