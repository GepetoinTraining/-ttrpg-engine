// Dice notation parser and roller

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

export interface DiceRoll {
  notation: string
  rolls: number[]
  modifier: number
  total: number
  isCrit?: boolean
  isFumble?: boolean
}

export interface ParsedDice {
  count: number
  sides: number
  modifier: number
}

// Parse dice notation like "2d6+3" or "1d20-2"
export function parseDiceNotation(notation: string): ParsedDice | null {
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i)
  if (!match) return null

  return {
    count: parseInt(match[1] || '1', 10),
    sides: parseInt(match[2], 10),
    modifier: parseInt(match[3] || '0', 10),
  }
}

// Roll a single die
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

// Roll dice from notation
export function roll(notation: string): DiceRoll {
  const parsed = parseDiceNotation(notation)

  if (!parsed) {
    return { notation, rolls: [], modifier: 0, total: 0 }
  }

  const rolls: number[] = []
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rollDie(parsed.sides))
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + parsed.modifier

  // Check for crit/fumble on d20s
  const isCrit = parsed.sides === 20 && parsed.count === 1 && rolls[0] === 20
  const isFumble = parsed.sides === 20 && parsed.count === 1 && rolls[0] === 1

  return {
    notation,
    rolls,
    modifier: parsed.modifier,
    total,
    isCrit,
    isFumble,
  }
}

// Roll with advantage (roll twice, take higher)
export function rollAdvantage(notation: string): DiceRoll {
  const roll1 = roll(notation)
  const roll2 = roll(notation)

  const winner = roll1.total >= roll2.total ? roll1 : roll2

  return {
    ...winner,
    notation: `${notation} (advantage)`,
  }
}

// Roll with disadvantage (roll twice, take lower)
export function rollDisadvantage(notation: string): DiceRoll {
  const roll1 = roll(notation)
  const roll2 = roll(notation)

  const loser = roll1.total <= roll2.total ? roll1 : roll2

  return {
    ...loser,
    notation: `${notation} (disadvantage)`,
  }
}

// Format roll result for display
export function formatRoll(result: DiceRoll): string {
  const rollsStr = result.rolls.join(' + ')
  const modStr = result.modifier > 0 ? ` + ${result.modifier}` : result.modifier < 0 ? ` - ${Math.abs(result.modifier)}` : ''

  let suffix = ''
  if (result.isCrit) suffix = ' 🎯 CRIT!'
  if (result.isFumble) suffix = ' 💀 FUMBLE!'

  return `${result.notation}: [${rollsStr}]${modStr} = ${result.total}${suffix}`
}

// Common rolls
export const d20 = () => roll('1d20')
export const d6 = () => roll('1d6')
export const initiative = (modifier: number) => roll(`1d20${modifier >= 0 ? '+' : ''}${modifier}`)
export const attack = (modifier: number) => roll(`1d20${modifier >= 0 ? '+' : ''}${modifier}`)
export const damage = (notation: string) => roll(notation)
