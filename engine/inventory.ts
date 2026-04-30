/**
 * INVENTORY — Physically-Grounded Resource System
 * ==================================================
 * 
 * RULE: Everything exists SOMEWHERE. No black holes.
 * 
 * Hierarchy:
 *   Region → Settlement → Building → Container → Item
 *   Party → Character → Equipment/Bag → Item
 * 
 * Containers have:
 *   - weightCapacity (lbs)
 *   - volumeCapacity (cubic feet)
 *   - Both must have room, or the item won't fit
 * 
 * Spatial magic (bags of holding, portable holes):
 *   - Multiplies volume capacity by magic tier
 *   - Does NOT change weight (extradimensional space)
 *   - Tier 1 (uncommon): ×10 volume
 *   - Tier 2 (rare): ×50 volume
 *   - Tier 3 (very rare): ×200 volume
 *   - Tier 4 (legendary): ×1000 volume
 * 
 * Currency has weight (50 coins = 1 lb in D&D 5e)
 */

import { z } from 'zod'

// ============================================================
// CURRENCY — Coins have weight, coins exist in containers
// ============================================================

export const CurrencySchema = z.object({
  copper:   z.number().int().nonnegative().default(0),
  silver:   z.number().int().nonnegative().default(0),
  electrum: z.number().int().nonnegative().default(0),
  gold:     z.number().int().nonnegative().default(0),
  platinum: z.number().int().nonnegative().default(0),
})
export type Currency = z.infer<typeof CurrencySchema>

const GP_RATES: Record<keyof Currency, number> = {
  copper: 0.01, silver: 0.1, electrum: 0.5, gold: 1, platinum: 10,
}

/** Total value in gold pieces */
export function currencyToGP(c: Currency): number {
  return c.copper * GP_RATES.copper + c.silver * GP_RATES.silver +
    c.electrum * GP_RATES.electrum + c.gold * GP_RATES.gold +
    c.platinum * GP_RATES.platinum
}

/** How much coins weigh (50 coins = 1 lb) */
export function currencyWeight(c: Currency): number {
  const totalCoins = c.copper + c.silver + c.electrum + c.gold + c.platinum
  return totalCoins / 50
}

// ============================================================
// ITEM — The physical thing
// ============================================================

export const ItemCategorySchema = z.enum([
  'weapon', 'armor', 'shield', 'potion', 'scroll', 'wand',
  'ring', 'amulet', 'tool', 'supply', 'treasure', 'material',
  'food', 'ammunition', 'container', 'clothing',
  'gem',         // DUNGEON ONLY — adventurer guilds bring these to market
  'book',        // Knowledge resource — tomes, codices, treatises, maps
  'artwork',     // Cultural resource — paintings, sculptures, tapestries, instruments
  'other',
])
export type ItemCategory = z.infer<typeof ItemCategorySchema>

/** Categories that can only originate from dungeons */
const DUNGEON_ONLY_CATEGORIES: Set<ItemCategory> = new Set(['gem'])

export const ItemRaritySchema = z.enum([
  'common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact',
])
export type ItemRarity = z.infer<typeof ItemRaritySchema>

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ItemCategorySchema,
  rarity: ItemRaritySchema.default('common'),
  /** Weight in pounds (per unit) */
  weight: z.number().nonnegative(),
  /** Volume in cubic feet (per unit) */
  volume: z.number().nonnegative(),
  /** Base value in gold pieces */
  valueGP: z.number().nonnegative().default(0),
  /** How many can stack in one slot */
  stackable: z.boolean().default(false),
  quantity: z.number().int().nonnegative().default(1),
  /** Is this item magical? */
  magical: z.boolean().default(false),
  /** Does it require attunement? */
  requiresAttunement: z.boolean().default(false),
  /** Where this item originally came from */
  sourceType: z.enum(['crafted', 'purchased', 'looted', 'dungeon', 'quest', 'natural']).default('crafted'),
  /** Custom properties */
  properties: z.record(z.string(), z.any()).default({}),
})
export type Item = z.infer<typeof ItemSchema>

/** Check if an item category can only come from dungeons */
export function isDungeonOnly(category: ItemCategory): boolean {
  return DUNGEON_ONLY_CATEGORIES.has(category)
}

/** Validate item source — gems must come from dungeons */
export function validateItemSource(item: Item): { valid: boolean; reason?: string } {
  if (isDungeonOnly(item.category) && item.sourceType !== 'dungeon' && item.sourceType !== 'looted') {
    return { valid: false, reason: `${item.category} items can only originate from dungeons` }
  }
  return { valid: true }
}

/** Total weight of a stack */
export function itemTotalWeight(item: Item): number {
  return item.weight * item.quantity
}

/** Total volume of a stack */
export function itemTotalVolume(item: Item): number {
  return item.volume * item.quantity
}

// ============================================================
// CONTAINER — Where items live
// ============================================================

export const ContainerTypeSchema = z.enum([
  // Character containers
  'worn',         // on body (equipment slots)
  'backpack',     // standard backpack
  'belt_pouch',   // small pouch
  'quiver',       // arrows/bolts only
  'bag',          // generic bag
  // Spatial magic containers
  'bag_of_holding',    // extradimensional
  'portable_hole',     // extradimensional
  'handy_haversack',   // extradimensional
  // Building containers
  'chest',        // storage chest
  'shelf',        // shop shelf
  'vault',        // secured storage
  'warehouse',    // large storage
  'stable',       // animals/mounts
  'cellar',       // underground storage
  // Settlement containers
  'treasury',     // settlement gold
  'granary',      // food storage
  'armory',       // weapons/armor
  'stockpile',    // raw materials
  // Knowledge containers — modifier to research/lore checks
  'library',      // books, codices, atlases — large permanent collection
  'scroll_rack',  // scrolls, letters, maps — smaller or specialized
  // Art containers — modifier to cultural/entertainment scores
  'gallery',      // paintings, sculptures, tapestries — prestige + morale
])
export type ContainerType = z.infer<typeof ContainerTypeSchema>

export const SpatialMagicTierSchema = z.enum(['none', 'tier1', 'tier2', 'tier3', 'tier4'])
export type SpatialMagicTier = z.infer<typeof SpatialMagicTierSchema>

/** Volume multiplier by spatial magic tier */
const SPATIAL_MULTIPLIER: Record<SpatialMagicTier, number> = {
  none:  1,
  tier1: 10,    // uncommon (bag of holding)
  tier2: 50,    // rare
  tier3: 200,   // very rare
  tier4: 1000,  // legendary (portable hole)
}

/** Max weight for spatial magic (extradimensional space has its own limit) */
const SPATIAL_WEIGHT_LIMIT: Record<SpatialMagicTier, number> = {
  none:  Infinity,  // uses container's own limit
  tier1: 500,       // bag of holding
  tier2: 1000,
  tier3: 2000,
  tier4: 5000,      // portable hole
}

export const ContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ContainerTypeSchema,
  /** Where this container IS (the .tp node) */
  locationNodeId: z.string(),
  /** Who owns this container (character id, NPC id, settlement id) */
  ownerId: z.string(),
  /** Base weight capacity in lbs (before magic) */
  weightCapacity: z.number().nonnegative(),
  /** Base volume capacity in cubic feet (before magic) */
  volumeCapacity: z.number().nonnegative(),
  /** Spatial magic tier */
  spatialMagic: SpatialMagicTierSchema.default('none'),
  /** Items stored here */
  items: z.array(ItemSchema).default([]),
  /** Currency stored here */
  currency: CurrencySchema.default({ copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 }),
  /** Is this container locked? */
  locked: z.boolean().default(false),
  /** DC to pick / force lock */
  lockDC: z.number().int().default(0),
})
export type Container = z.infer<typeof ContainerSchema>

// ============================================================
// CONTAINER CAPACITY — The core constraint
// ============================================================

/** Effective volume capacity (after spatial magic) */
export function effectiveVolumeCapacity(container: Container): number {
  return container.volumeCapacity * SPATIAL_MULTIPLIER[container.spatialMagic]
}

/** Effective weight capacity (spatial magic has its own limits) */
export function effectiveWeightCapacity(container: Container): number {
  if (container.spatialMagic !== 'none') {
    return SPATIAL_WEIGHT_LIMIT[container.spatialMagic]
  }
  return container.weightCapacity
}

/** Current weight used */
export function containerWeightUsed(container: Container): number {
  let w = currencyWeight(container.currency)
  for (const item of container.items) w += itemTotalWeight(item)
  return w
}

/** Current volume used */
export function containerVolumeUsed(container: Container): number {
  let v = 0
  // Currency volume: ~negligible in small amounts, but 1000 coins ≈ 0.1 cu ft
  const totalCoins = container.currency.copper + container.currency.silver +
    container.currency.electrum + container.currency.gold + container.currency.platinum
  v += totalCoins / 10000 // roughly
  for (const item of container.items) v += itemTotalVolume(item)
  return v
}

/** Weight remaining */
export function containerWeightRemaining(container: Container): number {
  return Math.max(0, effectiveWeightCapacity(container) - containerWeightUsed(container))
}

/** Volume remaining */
export function containerVolumeRemaining(container: Container): number {
  return Math.max(0, effectiveVolumeCapacity(container) - containerVolumeUsed(container))
}

/** Can an item fit? */
export function canFit(container: Container, item: Item, quantity: number = 1): {
  fits: boolean
  reason?: string
} {
  const addWeight = item.weight * quantity
  const addVolume = item.volume * quantity

  if (addWeight > containerWeightRemaining(container)) {
    return { fits: false, reason: `Too heavy: needs ${addWeight} lb, only ${containerWeightRemaining(container).toFixed(1)} lb free` }
  }
  if (addVolume > containerVolumeRemaining(container)) {
    return { fits: false, reason: `Too bulky: needs ${addVolume} cu ft, only ${containerVolumeRemaining(container).toFixed(2)} cu ft free` }
  }
  return { fits: true }
}

// ============================================================
// INVENTORY — Owns multiple containers
// ============================================================

export const InventoryOwnerTypeSchema = z.enum([
  'character', 'npc', 'party', 'settlement', 'building',
])
export type InventoryOwnerType = z.infer<typeof InventoryOwnerTypeSchema>

export const InventorySchema = z.object({
  ownerId: z.string(),
  ownerType: InventoryOwnerTypeSchema,
  /** The .tp node where this inventory lives */
  locationNodeId: z.string(),
  /** All containers owned */
  containers: z.array(ContainerSchema).default([]),
})
export type Inventory = z.infer<typeof InventorySchema>

// ============================================================
// INVENTORY OPERATIONS — Move items between containers
// ============================================================

/**
 * Add an item to a specific container.
 * Returns true if item was added, false if it doesn't fit.
 */
export function addItem(container: Container, item: Item, quantity: number = 1): boolean {
  const check = canFit(container, item, quantity)
  if (!check.fits) return false

  // Try to stack with existing item
  if (item.stackable) {
    const existing = container.items.find(i => i.id === item.id || (i.name === item.name && i.stackable))
    if (existing) {
      existing.quantity += quantity
      return true
    }
  }

  container.items.push({ ...item, quantity })
  return true
}

/**
 * Remove an item from a container.
 * Returns the removed item, or null if not found / insufficient quantity.
 */
export function removeItem(container: Container, itemId: string, quantity: number = 1): Item | null {
  const idx = container.items.findIndex(i => i.id === itemId)
  if (idx === -1) return null

  const item = container.items[idx]
  if (item.quantity < quantity) return null

  if (item.quantity === quantity) {
    container.items.splice(idx, 1)
  } else {
    item.quantity -= quantity
  }

  return { ...item, quantity }
}

/**
 * Transfer an item between containers.
 * Enforces: destination must have room, source must have item.
 */
export function transferItem(
  from: Container,
  to: Container,
  itemId: string,
  quantity: number = 1,
): { success: boolean; reason?: string } {
  const item = from.items.find(i => i.id === itemId)
  if (!item) return { success: false, reason: 'Item not found in source' }
  if (item.quantity < quantity) return { success: false, reason: 'Insufficient quantity' }

  const check = canFit(to, item, quantity)
  if (!check.fits) return { success: false, reason: check.reason }

  // Remove from source
  removeItem(from, itemId, quantity)
  // Add to destination
  addItem(to, { ...item }, quantity)

  return { success: true }
}

/**
 * Add currency to a container.
 */
export function addCurrency(container: Container, currency: Partial<Currency>): void {
  if (currency.copper) container.currency.copper += currency.copper
  if (currency.silver) container.currency.silver += currency.silver
  if (currency.electrum) container.currency.electrum += currency.electrum
  if (currency.gold) container.currency.gold += currency.gold
  if (currency.platinum) container.currency.platinum += currency.platinum
}

/**
 * Remove currency from a container.
 * Returns true if successful, false if insufficient funds.
 */
export function removeCurrency(container: Container, currency: Partial<Currency>): boolean {
  const needed = {
    copper: currency.copper ?? 0,
    silver: currency.silver ?? 0,
    electrum: currency.electrum ?? 0,
    gold: currency.gold ?? 0,
    platinum: currency.platinum ?? 0,
  }

  // Check each denomination
  if (container.currency.copper < needed.copper) return false
  if (container.currency.silver < needed.silver) return false
  if (container.currency.electrum < needed.electrum) return false
  if (container.currency.gold < needed.gold) return false
  if (container.currency.platinum < needed.platinum) return false

  container.currency.copper -= needed.copper
  container.currency.silver -= needed.silver
  container.currency.electrum -= needed.electrum
  container.currency.gold -= needed.gold
  container.currency.platinum -= needed.platinum

  return true
}

// ============================================================
// INVENTORY QUERIES — Find items across containers
// ============================================================

/**
 * Get total weight of all containers in an inventory.
 */
export function inventoryTotalWeight(inventory: Inventory): number {
  return inventory.containers.reduce((sum, c) => sum + containerWeightUsed(c), 0)
}

/**
 * Get total gold value across all containers.
 */
export function inventoryTotalGP(inventory: Inventory): number {
  return inventory.containers.reduce((sum, c) => sum + currencyToGP(c.currency), 0)
}

/**
 * Find all items matching a predicate across all containers.
 */
export function findItems(inventory: Inventory, pred: (item: Item) => boolean): { container: Container; item: Item }[] {
  const results: { container: Container; item: Item }[] = []
  for (const c of inventory.containers) {
    for (const item of c.items) {
      if (pred(item)) results.push({ container: c, item })
    }
  }
  return results
}

/**
 * Find first container with room for an item.
 */
export function findContainerWithRoom(
  inventory: Inventory,
  item: Item,
  quantity: number = 1,
): Container | null {
  for (const c of inventory.containers) {
    if (canFit(c, item, quantity).fits) return c
  }
  return null
}

// ============================================================
// STANDARD CONTAINERS — Factory functions
// ============================================================

let _containerId = 0
function nextId(prefix: string): string { return `${prefix}_${++_containerId}` }

/** Reset ID counter (for tests) */
export function resetIdCounter(): void { _containerId = 0 }

export function createBackpack(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('backpack'), name: 'Backpack', type: 'backpack',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 30, volumeCapacity: 1, // 1 cu ft, 30 lbs
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

export function createBeltPouch(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('pouch'), name: 'Belt Pouch', type: 'belt_pouch',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 6, volumeCapacity: 0.2,
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

export function createBagOfHolding(ownerId: string, nodeId: string, tier: SpatialMagicTier = 'tier1'): Container {
  return {
    id: nextId('boh'), name: `Bag of Holding (${tier})`, type: 'bag_of_holding',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 15, // the bag itself weighs 15 lbs regardless
    volumeCapacity: 4, // 4 cu ft base, multiplied by tier
    spatialMagic: tier, items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

export function createChest(ownerId: string, nodeId: string, locked = false, lockDC = 15): Container {
  return {
    id: nextId('chest'), name: 'Chest', type: 'chest',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 300, volumeCapacity: 12, // ~12 cu ft
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked, lockDC,
  }
}

export function createVault(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('vault'), name: 'Vault', type: 'vault',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 10000, volumeCapacity: 200,
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: true, lockDC: 25,
  }
}

export function createWarehouse(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('warehouse'), name: 'Warehouse', type: 'warehouse',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 100000, volumeCapacity: 5000,
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: true, lockDC: 15,
  }
}

export function createTreasury(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('treasury'), name: 'Treasury', type: 'treasury',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 50000, volumeCapacity: 500,
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: true, lockDC: 30,
  }
}

export function createGranary(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('granary'), name: 'Granary', type: 'granary',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 200000, volumeCapacity: 10000,
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

// ============================================================
// KNOWLEDGE CONTAINERS — Library, Scroll Rack
// ============================================================

export function createLibrary(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('library'), name: 'Library', type: 'library',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 10000, volumeCapacity: 500,  // shelves full of books
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

export function createScrollRack(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('scroll_rack'), name: 'Scroll Rack', type: 'scroll_rack',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 2000, volumeCapacity: 100,   // smaller, specialized
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

// ============================================================
// ART CONTAINERS — Gallery
// ============================================================

export function createGallery(ownerId: string, nodeId: string): Container {
  return {
    id: nextId('gallery'), name: 'Gallery', type: 'gallery',
    locationNodeId: nodeId, ownerId,
    weightCapacity: 50000, volumeCapacity: 2000,  // large display space
    spatialMagic: 'none', items: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    locked: false, lockDC: 0,
  }
}

// ============================================================
// KNOWLEDGE RESOURCE — Books as aggregate modifier
// ============================================================

/**
 * Count books in a container (books + scrolls with category 'book').
 * Returns total count and a breakdown by rarity.
 */
export function countBooks(container: Container): {
  total: number
  byRarity: Record<string, number>
  totalValue: number
} {
  const books = container.items.filter(i => i.category === 'book')
  const byRarity: Record<string, number> = {}
  let totalValue = 0
  for (const b of books) {
    byRarity[b.rarity] = (byRarity[b.rarity] ?? 0) + b.quantity
    totalValue += b.valueGP * b.quantity
  }
  return {
    total: books.reduce((sum, b) => sum + b.quantity, 0),
    byRarity,
    totalValue,
  }
}

/**
 * Knowledge modifier from a library/scroll_rack.
 * Each book gives +1 to research checks. Rare+ books give extra.
 * Capped at +10.
 *
 * Used by lore.ts attemptResearch() as a bonus.
 */
export function knowledgeModifier(containers: Container[]): number {
  let mod = 0
  const knowledgeContainers = containers.filter(
    c => c.type === 'library' || c.type === 'scroll_rack',
  )
  for (const c of knowledgeContainers) {
    const { total, byRarity } = countBooks(c)
    mod += Math.min(5, Math.floor(total / 10)) // +1 per 10 books, max +5
    mod += (byRarity['rare'] ?? 0)             // +1 per rare book
    mod += (byRarity['very_rare'] ?? 0) * 2    // +2 per very rare
    mod += (byRarity['legendary'] ?? 0) * 3    // +3 per legendary
    mod += (byRarity['artifact'] ?? 0) * 5     // +5 per artifact tome
  }
  return Math.min(10, mod) // hard cap
}

// ============================================================
// ART RESOURCE — Artworks as aggregate modifier
// ============================================================

/**
 * Count artworks in a container.
 */
export function countArtworks(container: Container): {
  total: number
  byRarity: Record<string, number>
  totalValue: number
} {
  const art = container.items.filter(i => i.category === 'artwork')
  const byRarity: Record<string, number> = {}
  let totalValue = 0
  for (const a of art) {
    byRarity[a.rarity] = (byRarity[a.rarity] ?? 0) + a.quantity
    totalValue += a.valueGP * a.quantity
  }
  return {
    total: art.reduce((sum, a) => sum + a.quantity, 0),
    byRarity,
    totalValue,
  }
}

/**
 * Cultural modifier from galleries.
 * Each artwork gives +1 to cultural score. Rare+ give prestige bonus.
 * Capped at +10.
 *
 * Used by entertainment.ts calculateCulturalScore() as a bonus.
 */
export function culturalModifier(containers: Container[]): number {
  let mod = 0
  const galleries = containers.filter(c => c.type === 'gallery')
  for (const g of galleries) {
    const { total, byRarity } = countArtworks(g)
    mod += Math.min(5, Math.floor(total / 5))  // +1 per 5 artworks, max +5
    mod += (byRarity['rare'] ?? 0)             // +1 per rare piece
    mod += (byRarity['very_rare'] ?? 0) * 2    // +2 per masterwork
    mod += (byRarity['legendary'] ?? 0) * 3    // +3 per legendary piece
    mod += (byRarity['artifact'] ?? 0) * 5     // +5 per artifact-level art
  }
  return Math.min(10, mod) // hard cap
}
