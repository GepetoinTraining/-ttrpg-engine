/**
 * CURRENCY — Multi-Kingdom Coinage & Gems as International Credit
 * ==================================================
 *
 * Every kingdom mints its own coins. Exchange rates fluctuate.
 * Gems from dungeons are UNIVERSAL value — the international standard.
 *
 * Why dungeons matter economically:
 *   Dungeons → gems → universal credit → trade between kingdoms
 *   Without gem inflow, inter-kingdom trade relies on barter or
 *   trust-based credit (bank letters, guild vouchers).
 *
 * Weekly tick: exchange rates shift with trade volume
 * Yearly tick: gem market recalibration
 */

// ============================================================
// CURRENCY SYSTEMS — Each kingdom's coinage
// ============================================================

export interface CurrencySystem {
  id: string
  worldId: string
  name: string               // "Golden Lion", "Harbor Moon", "Ceramic Bit"
  issuingKingdom: string      // faction/kingdom ID
  /** Custom denomination names (map to standard cp/sp/ep/gp/pp ratios) */
  denominations: {
    copper: string            // "copper nib", "ceramic bit"
    silver: string            // "silver falcon", "silver shard"
    electrum: string          // "half-lion", "electrum trade bar"
    gold: string              // "golden lion", "harbor moon"
    platinum: string          // "platinum crown", "dragon"
  }
  /** Trust multiplier — new/unstable currencies trade at a discount */
  trust: number               // 0.0 - 1.0 (1.0 = fully trusted)
  /** Is this currency still being minted? */
  active: boolean
}

/**
 * Standard D&D exchange rates (base):
 * 1 pp = 10 gp = 20 ep = 100 sp = 1000 cp
 */
export const BASE_DENOMINATION_RATES = {
  copper: 0.01,
  silver: 0.1,
  electrum: 0.5,
  gold: 1.0,
  platinum: 10.0,
} as const

// ============================================================
// EXCHANGE RATES — Currency ↔ Currency
// ============================================================

export interface ExchangeRate {
  id: string
  fromCurrencyId: string
  toCurrencyId: string
  /** How many 'to' gold pieces per 'from' gold piece */
  rate: number
  /** Trade volume in the last period (affects stability) */
  tradeVolume: number
  lastUpdatedDay: number
}

/**
 * Calculate effective exchange rate between two currencies.
 * Base rate × trust ratio × trade volume modifier.
 *
 * Low trust currency → sells at discount
 * Low trade volume → wider spread (worse rate)
 */
export function effectiveExchangeRate(
  rate: ExchangeRate,
  fromCurrency: CurrencySystem,
  toCurrency: CurrencySystem,
): number {
  const trustRatio = fromCurrency.trust / Math.max(0.1, toCurrency.trust)
  // High trade volume → rate converges to fair value
  // Low trade volume → up to 20% spread
  const volumeModifier = Math.min(1, 0.8 + rate.tradeVolume / 5000)
  return rate.rate * trustRatio * volumeModifier
}

/**
 * Convert an amount in gold pieces from one currency to another.
 */
export function convertCurrency(
  amountGP: number,
  rate: ExchangeRate,
  fromCurrency: CurrencySystem,
  toCurrency: CurrencySystem,
): { amountInTarget: number; fee: number } {
  const effective = effectiveExchangeRate(rate, fromCurrency, toCurrency)
  const gross = amountGP * effective
  // Money changer fee: 2-5% depending on volume
  const feeRate = Math.max(0.02, 0.05 - rate.tradeVolume / 100000)
  const fee = gross * feeRate
  return {
    amountInTarget: gross - fee,
    fee,
  }
}

// ============================================================
// GEMS — Dungeon-Sourced International Credit
// ============================================================

export type GemTier = 'ornamental' | 'semi_precious' | 'precious' | 'gem' | 'jewel'

export const GEM_BASE_VALUES: Record<GemTier, number> = {
  ornamental:   10,    // agate, lapis lazuli, turquoise
  semi_precious: 50,   // garnet, jade, moonstone
  precious:     100,   // amber, amethyst, pearl
  gem:          500,   // emerald, sapphire, ruby
  jewel:        5000,  // diamond, star sapphire, black opal
}

export interface GemType {
  id: string
  name: string           // "Star Sapphire", "Fire Opal"
  tier: GemTier
  baseValueGP: number    // standard universal value
  /** Rarity affects how often this appears in dungeon loot tables */
  rarityWeight: number   // 1-100 (100 = common in tier)
}

/**
 * The gem catalog — standard gem types.
 * These are the "dollars" of inter-kingdom trade.
 */
export const GEM_CATALOG: GemType[] = [
  // Ornamental (10 GP)
  { id: 'gem_agate',       name: 'Agate',        tier: 'ornamental',   baseValueGP: 10,   rarityWeight: 90 },
  { id: 'gem_lapis',       name: 'Lapis Lazuli',  tier: 'ornamental',   baseValueGP: 10,   rarityWeight: 80 },
  { id: 'gem_turquoise',   name: 'Turquoise',     tier: 'ornamental',   baseValueGP: 10,   rarityWeight: 85 },
  { id: 'gem_obsidian',    name: 'Obsidian',      tier: 'ornamental',   baseValueGP: 10,   rarityWeight: 95 },
  // Semi-precious (50 GP)
  { id: 'gem_garnet',      name: 'Garnet',        tier: 'semi_precious', baseValueGP: 50,   rarityWeight: 70 },
  { id: 'gem_jade',        name: 'Jade',          tier: 'semi_precious', baseValueGP: 50,   rarityWeight: 60 },
  { id: 'gem_moonstone',   name: 'Moonstone',     tier: 'semi_precious', baseValueGP: 50,   rarityWeight: 65 },
  { id: 'gem_onyx',        name: 'Onyx',          tier: 'semi_precious', baseValueGP: 50,   rarityWeight: 75 },
  // Precious (100 GP)
  { id: 'gem_amber',       name: 'Amber',         tier: 'precious',     baseValueGP: 100,  rarityWeight: 55 },
  { id: 'gem_amethyst',    name: 'Amethyst',      tier: 'precious',     baseValueGP: 100,  rarityWeight: 50 },
  { id: 'gem_pearl',       name: 'Pearl',         tier: 'precious',     baseValueGP: 100,  rarityWeight: 40 },
  { id: 'gem_coral',       name: 'Coral',         tier: 'precious',     baseValueGP: 100,  rarityWeight: 45 },
  // Gem (500 GP)
  { id: 'gem_emerald',     name: 'Emerald',       tier: 'gem',          baseValueGP: 500,  rarityWeight: 30 },
  { id: 'gem_sapphire',    name: 'Sapphire',      tier: 'gem',          baseValueGP: 500,  rarityWeight: 25 },
  { id: 'gem_ruby',        name: 'Ruby',          tier: 'gem',          baseValueGP: 500,  rarityWeight: 20 },
  { id: 'gem_topaz',       name: 'Topaz',         tier: 'gem',          baseValueGP: 500,  rarityWeight: 35 },
  // Jewel (5000 GP)
  { id: 'gem_diamond',     name: 'Diamond',       tier: 'jewel',        baseValueGP: 5000, rarityWeight: 10 },
  { id: 'gem_star_sapph',  name: 'Star Sapphire', tier: 'jewel',        baseValueGP: 5000, rarityWeight: 8 },
  { id: 'gem_black_opal',  name: 'Black Opal',    tier: 'jewel',        baseValueGP: 5000, rarityWeight: 5 },
  { id: 'gem_jacinth',     name: 'Jacinth',       tier: 'jewel',        baseValueGP: 5000, rarityWeight: 3 },
]

/**
 * Appraise a gem — actual value varies ±20% from base depending on quality.
 * d20 roll determines quality grade.
 */
export function appraiseGem(gem: GemType, d20: number): {
  quality: 'flawed' | 'fair' | 'good' | 'excellent' | 'perfect'
  value: number
} {
  if (d20 <= 3) return { quality: 'flawed', value: Math.round(gem.baseValueGP * 0.8) }
  if (d20 <= 8) return { quality: 'fair', value: Math.round(gem.baseValueGP * 0.9) }
  if (d20 <= 14) return { quality: 'good', value: gem.baseValueGP }
  if (d20 <= 18) return { quality: 'excellent', value: Math.round(gem.baseValueGP * 1.1) }
  return { quality: 'perfect', value: Math.round(gem.baseValueGP * 1.2) }
}

// ============================================================
// EXCHANGE RATE TICK — Weekly fluctuation
// ============================================================

export interface ExchangeTickResult {
  rateId: string
  previousRate: number
  newRate: number
  tradeVolume: number
  reason: string
}

/**
 * Weekly exchange rate tick.
 * Rates drift based on trade volume and random noise (d20).
 *
 * High trade volume → stable (drift ±1%)
 * Low trade volume → volatile (drift ±5%)
 * Currency trust changes → immediate 10% shift
 */
export function weeklyExchangeTick(
  rate: ExchangeRate,
  fromCurrency: CurrencySystem,
  toCurrency: CurrencySystem,
  d20: number,
  worldDay: number,
): ExchangeTickResult {
  const previousRate = rate.rate
  let reason = 'market drift'

  // Volatility: inversely proportional to trade volume
  const volatility = Math.max(0.01, 0.05 - rate.tradeVolume / 50000)

  // d20 maps to -1..+1 normalized
  const driftDirection = (d20 - 10.5) / 9.5 // -1 to +1
  let drift = driftDirection * volatility

  // Trust differential causes additional pressure
  const trustDiff = fromCurrency.trust - toCurrency.trust
  if (Math.abs(trustDiff) > 0.1) {
    drift += trustDiff * 0.02
    reason = trustDiff > 0 ? 'from-currency strengthening' : 'to-currency strengthening'
  }

  // Inactive currencies depreciate
  if (!fromCurrency.active) {
    drift -= 0.03
    reason = 'from-currency no longer minted'
  }
  if (!toCurrency.active) {
    drift += 0.03
    reason = 'to-currency no longer minted'
  }

  rate.rate = Math.max(0.1, rate.rate * (1 + drift))
  rate.lastUpdatedDay = worldDay

  // Trade volume decays toward baseline
  rate.tradeVolume = Math.max(0, rate.tradeVolume * 0.95)

  return {
    rateId: rate.id,
    previousRate,
    newRate: rate.rate,
    tradeVolume: rate.tradeVolume,
    reason,
  }
}

/**
 * Record a trade transaction — increases trade volume on the exchange rate.
 */
export function recordTrade(rate: ExchangeRate, amountGP: number): void {
  rate.tradeVolume += amountGP
}

/**
 * Create a default currency system for a kingdom.
 */
export function createCurrencySystem(
  worldId: string,
  name: string,
  issuingKingdom: string,
  denominations?: Partial<CurrencySystem['denominations']>,
): CurrencySystem {
  return {
    id: `currency_${issuingKingdom}`,
    worldId,
    name,
    issuingKingdom,
    denominations: {
      copper: denominations?.copper ?? 'copper piece',
      silver: denominations?.silver ?? 'silver piece',
      electrum: denominations?.electrum ?? 'electrum piece',
      gold: denominations?.gold ?? 'gold piece',
      platinum: denominations?.platinum ?? 'platinum piece',
    },
    trust: 1.0,
    active: true,
  }
}
