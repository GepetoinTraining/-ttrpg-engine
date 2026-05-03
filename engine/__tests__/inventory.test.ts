/**
 * INVENTORY TESTS — Everything Exists Somewhere
 * ================================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  currencyToGP, currencyWeight,
  itemTotalWeight, itemTotalVolume,
  isDungeonOnly, validateItemSource,
  effectiveVolumeCapacity, effectiveWeightCapacity,
  containerWeightUsed, containerVolumeUsed,
  containerWeightRemaining, containerVolumeRemaining,
  canFit, addItem, removeItem, transferItem,
  addCurrency, removeCurrency,
  inventoryTotalWeight, inventoryTotalGP,
  findItems, findContainerWithRoom,
  createBackpack, createBeltPouch, createBagOfHolding,
  createChest, createVault, createWarehouse, createTreasury,
  resetIdCounter,
  type Item, type Container, type Currency, type Inventory,
} from '../inventory'

// ============================================================
// HELPERS
// ============================================================

beforeEach(() => resetIdCounter())

const SWORD: Item = {
  id: 'sword_1', name: 'Longsword', category: 'weapon', rarity: 'common',
  weight: 3, volume: 0.1, valueGP: 15, stackable: false, quantity: 1,
  magical: false, requiresAttunement: false, sourceType: 'crafted', properties: {},
}

const ARROW: Item = {
  id: 'arrow_1', name: 'Arrow', category: 'ammunition', rarity: 'common',
  weight: 0.05, volume: 0.01, valueGP: 0.05, stackable: true, quantity: 20,
  magical: false, requiresAttunement: false, sourceType: 'crafted', properties: {},
}

const RUBY: Item = {
  id: 'ruby_1', name: 'Ruby', category: 'gem', rarity: 'rare',
  weight: 0.02, volume: 0.001, valueGP: 500, stackable: false, quantity: 1,
  magical: false, requiresAttunement: false, sourceType: 'dungeon', properties: {},
}

const RATION: Item = {
  id: 'ration_1', name: 'Rations (1 day)', category: 'food', rarity: 'common',
  weight: 2, volume: 0.05, valueGP: 0.5, stackable: true, quantity: 5,
  magical: false, requiresAttunement: false, sourceType: 'purchased', properties: {},
}

// ============================================================
// CURRENCY
// ============================================================

describe('Currency', () => {
  it('converts to gold pieces', () => {
    const c: Currency = { copper: 100, silver: 10, electrum: 2, gold: 5, platinum: 1 }
    // 1 + 1 + 1 + 5 + 10 = 18
    expect(currencyToGP(c)).toBe(18)
  })

  it('calculates weight (50 coins = 1 lb)', () => {
    const c: Currency = { copper: 100, silver: 0, electrum: 0, gold: 0, platinum: 0 }
    expect(currencyWeight(c)).toBe(2) // 100/50 = 2 lbs
  })

  it('empty wallet weighs nothing', () => {
    const c: Currency = { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 }
    expect(currencyWeight(c)).toBe(0)
  })
})

// ============================================================
// ITEMS
// ============================================================

describe('Items', () => {
  it('calculates total weight of stack', () => {
    expect(itemTotalWeight(ARROW)).toBe(1) // 0.05 × 20
  })

  it('calculates total volume of stack', () => {
    expect(itemTotalVolume(ARROW)).toBe(0.2) // 0.01 × 20
  })
})

// ============================================================
// GEM — DUNGEON ONLY
// ============================================================

describe('Dungeon-Only Items', () => {
  it('gem is dungeon-only', () => {
    expect(isDungeonOnly('gem')).toBe(true)
  })

  it('weapon is NOT dungeon-only', () => {
    expect(isDungeonOnly('weapon')).toBe(false)
  })

  it('gem from dungeon is valid', () => {
    expect(validateItemSource(RUBY).valid).toBe(true)
  })

  it('gem from crafted is invalid', () => {
    const fake = { ...RUBY, sourceType: 'crafted' as const }
    const result = validateItemSource(fake)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('dungeon')
  })

  it('gem from looted is valid (adventurers bring to market)', () => {
    const looted = { ...RUBY, sourceType: 'looted' as const }
    expect(validateItemSource(looted).valid).toBe(true)
  })
})

// ============================================================
// CONTAINERS — Capacity
// ============================================================

describe('Container Capacity', () => {
  it('backpack has correct base capacity', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    expect(effectiveWeightCapacity(bp)).toBe(30)
    expect(effectiveVolumeCapacity(bp)).toBe(1)
  })

  it('bag of holding tier 1 multiplies volume by 10', () => {
    const boh = createBagOfHolding('char_1', 'node_suzail', 'tier1')
    expect(effectiveVolumeCapacity(boh)).toBe(40) // 4 × 10
    expect(effectiveWeightCapacity(boh)).toBe(500) // spatial weight limit
  })

  it('bag of holding tier 4 multiplies volume by 1000', () => {
    const boh = createBagOfHolding('char_1', 'node_suzail', 'tier4')
    expect(effectiveVolumeCapacity(boh)).toBe(4000) // 4 × 1000
    expect(effectiveWeightCapacity(boh)).toBe(5000) // tier 4 weight limit
  })

  it('empty container has full capacity remaining', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    expect(containerWeightRemaining(bp)).toBe(30)
    expect(containerVolumeRemaining(bp)).toBe(1)
  })

  it('items reduce remaining capacity', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addItem(bp, SWORD)
    expect(containerWeightRemaining(bp)).toBe(27) // 30 - 3
  })

  it('currency adds weight', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addCurrency(bp, { gold: 100 })
    expect(containerWeightUsed(bp)).toBe(2) // 100/50 = 2 lbs
  })
})

// ============================================================
// CONTAINER OPS — Add, Remove, Transfer
// ============================================================

describe('Container Operations', () => {
  it('add item to container', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    const added = addItem(bp, SWORD)
    expect(added).toBe(true)
    expect(bp.items).toHaveLength(1)
    expect(bp.items[0].name).toBe('Longsword')
  })

  it('reject item that exceeds weight', () => {
    const pouch = createBeltPouch('char_1', 'node_suzail')
    // Pouch = 6 lbs, try to add 10-lb item
    const bigItem: Item = { ...SWORD, weight: 10 }
    expect(addItem(pouch, bigItem)).toBe(false)
  })

  it('reject item that exceeds volume', () => {
    const pouch = createBeltPouch('char_1', 'node_suzail')
    // Pouch = 0.2 cu ft, sword = 0.1 cu ft (fits), but 3 of them don't
    const bulky: Item = { ...SWORD, volume: 0.3 }
    expect(addItem(pouch, bulky)).toBe(false)
  })

  it('stackable items stack on add', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addItem(bp, ARROW, 20)
    addItem(bp, { ...ARROW }, 10) // same name, stackable → should merge
    expect(bp.items).toHaveLength(1)
    expect(bp.items[0].quantity).toBe(30)
  })

  it('remove item from container', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addItem(bp, SWORD)
    const removed = removeItem(bp, 'sword_1')
    expect(removed).not.toBeNull()
    expect(bp.items).toHaveLength(0)
  })

  it('remove partial stack', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addItem(bp, ARROW, 20)
    removeItem(bp, 'arrow_1', 5)
    expect(bp.items[0].quantity).toBe(15)
  })

  it('reject remove with insufficient quantity', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addItem(bp, ARROW, 10)
    expect(removeItem(bp, 'arrow_1', 20)).toBeNull()
  })

  it('transfer between containers', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    const chest = createChest('char_1', 'node_suzail')
    addItem(bp, SWORD)
    const result = transferItem(bp, chest, 'sword_1')
    expect(result.success).toBe(true)
    expect(bp.items).toHaveLength(0)
    expect(chest.items).toHaveLength(1)
  })

  it('transfer fails if destination full', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    const pouch = createBeltPouch('char_1', 'node_suzail')
    // Fill pouch to weight limit
    addCurrency(pouch, { gold: 300 }) // 6 lbs
    addItem(bp, SWORD)
    const result = transferItem(bp, pouch, 'sword_1')
    expect(result.success).toBe(false)
    expect(result.reason).toContain('heavy')
  })
})

// ============================================================
// CURRENCY OPS
// ============================================================

describe('Currency Operations', () => {
  it('add currency', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addCurrency(bp, { gold: 50, silver: 100 })
    expect(bp.currency.gold).toBe(50)
    expect(bp.currency.silver).toBe(100)
  })

  it('remove currency', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addCurrency(bp, { gold: 50 })
    const removed = removeCurrency(bp, { gold: 30 })
    expect(removed).toBe(true)
    expect(bp.currency.gold).toBe(20)
  })

  it('reject insufficient currency removal', () => {
    const bp = createBackpack('char_1', 'node_suzail')
    addCurrency(bp, { gold: 10 })
    expect(removeCurrency(bp, { gold: 50 })).toBe(false)
    expect(bp.currency.gold).toBe(10) // unchanged
  })
})

// ============================================================
// INVENTORY — Multi-container queries
// ============================================================

describe('Inventory Queries', () => {
  it('total weight across containers', () => {
    const inv: Inventory = {
      ownerId: 'char_1', ownerType: 'character', locationNodeId: 'node_suzail',
      containers: [createBackpack('char_1', 'node_suzail'), createBeltPouch('char_1', 'node_suzail')],
    }
    addItem(inv.containers[0], SWORD) // 3 lbs
    addCurrency(inv.containers[1], { gold: 50 }) // 1 lb
    expect(inventoryTotalWeight(inv)).toBe(4)
  })

  it('total GP across containers', () => {
    const inv: Inventory = {
      ownerId: 'char_1', ownerType: 'character', locationNodeId: 'node_suzail',
      containers: [createBackpack('char_1', 'node_suzail'), createBeltPouch('char_1', 'node_suzail')],
    }
    addCurrency(inv.containers[0], { gold: 100 })
    addCurrency(inv.containers[1], { silver: 50 })
    expect(inventoryTotalGP(inv)).toBe(105) // 100 + 5
  })

  it('find items by predicate', () => {
    const inv: Inventory = {
      ownerId: 'char_1', ownerType: 'character', locationNodeId: 'node_suzail',
      containers: [createBackpack('char_1', 'node_suzail'), createBeltPouch('char_1', 'node_suzail')],
    }
    addItem(inv.containers[0], SWORD)
    addItem(inv.containers[0], RATION, 5)
    addItem(inv.containers[1], RUBY)

    const weapons = findItems(inv, i => i.category === 'weapon')
    expect(weapons).toHaveLength(1)

    const gems = findItems(inv, i => i.category === 'gem')
    expect(gems).toHaveLength(1)
    expect(gems[0].item.name).toBe('Ruby')
  })

  it('find container with room', () => {
    const inv: Inventory = {
      ownerId: 'char_1', ownerType: 'character', locationNodeId: 'node_suzail',
      containers: [createBeltPouch('char_1', 'node_suzail'), createBackpack('char_1', 'node_suzail')],
    }
    // Pouch is small (6 lbs, 0.2 cu ft)
    // Backpack is bigger (30 lbs, 1 cu ft)
    const bigItem: Item = { ...SWORD, weight: 10, volume: 0.5 }
    const container = findContainerWithRoom(inv, bigItem)
    // Pouch can't fit it, backpack can
    expect(container).not.toBeNull()
    expect(container!.type).toBe('backpack')
  })
})

// ============================================================
// SPATIAL MAGIC
// ============================================================

describe('Spatial Magic', () => {
  it('bag of holding holds much more volume than weight suggests', () => {
    const boh = createBagOfHolding('char_1', 'node_suzail', 'tier1')
    // 40 cu ft of volume but only 500 lbs of weight
    // Add lots of non-stackable light but bulky items
    for (let i = 0; i < 30; i++) {
      addItem(boh, { ...SWORD, id: `bulky_${i}`, name: `Bulky Item ${i}`, volume: 1, weight: 0.5, stackable: false })
    }
    expect(boh.items.length).toBe(30)
    expect(containerWeightUsed(boh)).toBe(15) // 30 × 0.5
    expect(containerVolumeUsed(boh)).toBe(30) // 30 × 1 (still room — capacity is 40)
  })

  it('spatial magic has its own weight limit', () => {
    const boh = createBagOfHolding('char_1', 'node_suzail', 'tier1')
    // Try to add 501 lbs → exceeds tier1 limit of 500
    const heavy: Item = { ...SWORD, id: 'heavy_1', weight: 501, volume: 0.01 }
    expect(addItem(boh, heavy)).toBe(false)
  })
})

// ============================================================
// SETTLEMENT SCALE
// ============================================================

describe('Settlement Containers', () => {
  it('vault is secured', () => {
    const vault = createVault('suzail', 'node_suzail')
    expect(vault.locked).toBe(true)
    expect(vault.lockDC).toBe(25)
  })

  it('treasury holds massive wealth', () => {
    const treasury = createTreasury('suzail', 'node_suzail')
    addCurrency(treasury, { gold: 100000, platinum: 10000 })
    expect(currencyToGP(treasury.currency)).toBe(200000)
    // Weight: 110000 coins / 50 = 2200 lbs (well within 50000 capacity)
    expect(containerWeightUsed(treasury)).toBe(2200)
  })

  it('warehouse holds bulk materials', () => {
    const wh = createWarehouse('suzail', 'node_suzail')
    // Add 100 different non-stackable crates
    for (let i = 0; i < 100; i++) {
      addItem(wh, { ...RATION, id: `crate_${i}`, name: `Crate ${i}`, quantity: 1, weight: 20, stackable: false })
    }
    // 100 items × 1 qty × 20 lbs = 2000 lbs
    expect(containerWeightUsed(wh)).toBe(2000)
    expect(wh.items.length).toBe(100)
  })
})
