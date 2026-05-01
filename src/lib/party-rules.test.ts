import { describe, it, expect } from 'vitest'
import {
  checkPartyCompatibility,
  checkPartyJoin,
  buildInviteString,
  parseInviteString,
} from './party-rules'

describe('checkPartyCompatibility', () => {
  it('allows two players', () => {
    expect(checkPartyCompatibility('player', 'player')).toBeNull()
  })

  it('allows player + dm', () => {
    expect(checkPartyCompatibility('player', 'dm')).toBeNull()
    expect(checkPartyCompatibility('dm', 'player')).toBeNull()
  })

  it('allows player + gm-ai', () => {
    expect(checkPartyCompatibility('player', 'gm-ai')).toBeNull()
  })

  it('rejects two DMs', () => {
    const r = checkPartyCompatibility('dm', 'dm')
    expect(r).toMatch(/two DMs/i)
  })

  it('rejects dmless + player (time-flow mismatch)', () => {
    const r = checkPartyCompatibility('dmless', 'player')
    expect(r).toMatch(/time-flow/)
  })

  it('rejects dmless + dm', () => {
    expect(checkPartyCompatibility('dmless', 'dm')).toMatch(/dmless/)
  })

  it('rejects dmless + gm-ai', () => {
    expect(checkPartyCompatibility('dmless', 'gm-ai')).toMatch(/dmless/)
  })

  it('allows dmless + dmless', () => {
    expect(checkPartyCompatibility('dmless', 'dmless')).toBeNull()
  })
})

describe('checkPartyJoin', () => {
  it('returns null for empty existing roster', () => {
    expect(checkPartyJoin([], 'player')).toBeNull()
  })

  it('returns null for compatible joiner', () => {
    expect(checkPartyJoin(['player', 'dm'], 'player')).toBeNull()
  })

  it('returns first offender when joiner conflicts', () => {
    const r = checkPartyJoin(['player', 'dm'], 'dmless')
    expect(r).toMatch(/dmless|time-flow/)
  })

  it('rejects second DM joining a party that already has one', () => {
    expect(checkPartyJoin(['dm', 'player'], 'dm')).toMatch(/two DMs/)
  })
})

describe('buildInviteString / parseInviteString', () => {
  it('round-trips a UUID-shaped id', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(parseInviteString(buildInviteString(id))).toBe(id)
  })

  it('accepts a bare UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(parseInviteString(id)).toBe(id)
  })

  it('extracts from ?invite-party= URL', () => {
    const id = 'abc-123-def-4567'
    expect(parseInviteString(`https://example.com/?invite-party=${id}`)).toBe(id)
  })

  it('returns null for empty / garbage', () => {
    expect(parseInviteString('')).toBeNull()
    expect(parseInviteString('   ')).toBeNull()
    expect(parseInviteString('ab')).toBeNull()
    expect(parseInviteString('!@#$%')).toBeNull()
  })

  it('returns null for prefix-only', () => {
    expect(parseInviteString('claudedm-party:')).toBeNull()
  })
})
