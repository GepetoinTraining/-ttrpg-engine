/**
 * INVENTORY ENGINE
 * =================
 *
 * Core inventory system logic including:
 * - Weight and encumbrance calculations
 * - Currency operations
 * - Equipment slot validation
 * - Attunement management
 * - Container capacity checks
 * - NPC inventory generation
 */

import {
  type StandardCurrency,
  type EquipmentSlot,
  type ItemCategory,
  type EncumbranceRule,
  CURRENCY_TO_GP,
  currencyToGP,
  gpToCurrency,
  calculateCarryingCapacity,
  getEncumbrancePenalties,
  SLOT_COMPATIBILITY,
} from './schema'

import {
  type EntityInventorySystem,
  type EntityType,
  type InventoryContainer,
  type InventoryItem,
  type NPCLoadout,
  getEntityInventorySystem,
  getContainersForInventory,
  getInventoryItemsByOwner,
  getInventoryItemOrThrow,
  getAttunedItems as dbGetAttunedItems,
  updateInventoryItem,
  updateAttunedItems,
  getItem,
  getNPCLoadout,
  createInventoryItem,
  getOrCreateEntityInventorySystem,
} from '../../db/queries/inventory'

// ============================================
// WEIGHT & ENCUMBRANCE
// ============================================

/**
 * Calculate total weight of items for an entity
 */
export async function calculateTotalWeight(
  entityId: string,
  entityType: EntityType = 'character'
): Promise<number> {
  const items = await getInventoryItemsByOwner(entityId, entityType)

  let totalWeight = 0
  for (const item of items) {
    const weight = item.properties?.weight ?? 0
    totalWeight += weight * item.quantity
  }

  return totalWeight
}

/**
 * Calculate encumbrance level for an entity
 */
export async function calculateEncumbrance(
  entityId: string,
  strength: number,
  encumbranceRule: EncumbranceRule = 'variant',
  sizeModifier: number = 1,
  entityType: EntityType = 'character'
): Promise<{
  currentWeight: number
  capacity: ReturnType<typeof calculateCarryingCapacity>
  penalties: ReturnType<typeof getEncumbrancePenalties>
  status: 'normal' | 'encumbered' | 'heavily_encumbered' | 'immobile'
}> {
  const currentWeight = await calculateTotalWeight(entityId, entityType)
  const capacity = calculateCarryingCapacity(strength, encumbranceRule, sizeModifier)
  const penalties = getEncumbrancePenalties(currentWeight, capacity)

  let status: 'normal' | 'encumbered' | 'heavily_encumbered' | 'immobile' = 'normal'
  if (penalties.cannotMove) {
    status = 'immobile'
  } else if (penalties.hasDisadvantageOnPhysical) {
    status = 'heavily_encumbered'
  } else if (penalties.speedPenalty > 0) {
    status = 'encumbered'
  }

  return { currentWeight, capacity, penalties, status }
}

/**
 * Check if entity is over-encumbered
 */
export async function isOverEncumbered(
  entityId: string,
  strength: number,
  encumbranceRule: EncumbranceRule = 'variant',
  entityType: EntityType = 'character'
): Promise<boolean> {
  const result = await calculateEncumbrance(entityId, strength, encumbranceRule, 1, entityType)
  return result.status !== 'normal'
}

// ============================================
// CURRENCY OPERATIONS
// ============================================

/**
 * Calculate total currency value in gold pieces
 */
export function calculateTotalGP(currency: Partial<StandardCurrency>): number {
  return currencyToGP({
    copper: currency.copper ?? 0,
    silver: currency.silver ?? 0,
    electrum: currency.electrum ?? 0,
    gold: currency.gold ?? 0,
    platinum: currency.platinum ?? 0,
  })
}

/**
 * Check if wallet has sufficient funds for a cost
 */
export function hasSufficientFunds(
  wallet: StandardCurrency,
  cost: Partial<StandardCurrency>
): boolean {
  const walletTotal = currencyToGP(wallet)
  const costTotal = calculateTotalGP(cost)
  return walletTotal >= costTotal
}

/**
 * Convert currency between denominations
 */
export function convertCurrency(
  from: keyof StandardCurrency,
  to: keyof StandardCurrency,
  amount: number
): { fromAmount: number; toAmount: number } {
  // Convert to GP first, then to target denomination
  const gpValue = amount * CURRENCY_TO_GP[from]
  const toAmount = Math.floor(gpValue / CURRENCY_TO_GP[to])

  return {
    fromAmount: amount,
    toAmount,
  }
}

/**
 * Auto-convert currency to optimal denominations
 */
export function optimizeCurrency(
  currency: StandardCurrency,
  includeElectrum: boolean = false
): StandardCurrency {
  const totalGP = currencyToGP(currency)
  return gpToCurrency(totalGP, includeElectrum)
}

/**
 * Calculate change when making a purchase
 * Returns the new wallet state after purchase, or null if insufficient funds
 */
export function makePurchase(
  wallet: StandardCurrency,
  cost: Partial<StandardCurrency>
): StandardCurrency | null {
  const walletTotal = currencyToGP(wallet)
  const costTotal = calculateTotalGP(cost)

  if (walletTotal < costTotal) {
    return null
  }

  const remaining = walletTotal - costTotal
  return gpToCurrency(remaining)
}

// ============================================
// EQUIPMENT SLOT VALIDATION
// ============================================

/**
 * Get compatible slots for an item category
 */
export function getCompatibleSlots(category: ItemCategory): EquipmentSlot[] {
  return SLOT_COMPATIBILITY[category] ?? []
}

/**
 * Check if an item can be equipped to a specific slot
 */
export function canEquipToSlot(
  itemCategory: ItemCategory,
  slot: EquipmentSlot
): boolean {
  const compatibleSlots = getCompatibleSlots(itemCategory)
  return compatibleSlots.includes(slot)
}

/**
 * Validate equipment change
 */
export interface EquipmentValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export async function validateEquipmentChange(
  entityId: string,
  inventoryItemId: string,
  targetSlot: EquipmentSlot,
  entityType: EntityType = 'character'
): Promise<EquipmentValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Get the inventory item
  const inventoryItem = await getInventoryItemOrThrow(inventoryItemId)

  // Check ownership
  if (inventoryItem.ownerId !== entityId || inventoryItem.ownerType !== entityType) {
    errors.push('Item does not belong to this entity')
    return { valid: false, errors, warnings }
  }

  // Get the item template to check category
  let category: ItemCategory = 'other'
  if (inventoryItem.itemTemplateId) {
    const template = await getItem(inventoryItem.itemTemplateId)
    if (template) {
      category = template.category as ItemCategory
    }
  } else if (inventoryItem.properties?.category) {
    category = inventoryItem.properties.category as ItemCategory
  }

  // Check slot compatibility
  if (!canEquipToSlot(category, targetSlot)) {
    errors.push(`${category} items cannot be equipped to ${targetSlot} slot`)
  }

  // Check if item is already equipped
  if (inventoryItem.equipped) {
    warnings.push('Item is already equipped, will be moved to new slot')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ============================================
// ATTUNEMENT MANAGEMENT
// ============================================

/**
 * Get attunement slot status for an entity
 */
export async function getAttunementSlots(
  entityId: string,
  entityType: EntityType = 'character'
): Promise<{ used: number; max: number; items: InventoryItem[] }> {
  const system = await getEntityInventorySystem(entityId, entityType)
  const max = system?.attunementSlots ?? 3

  const items = await dbGetAttunedItems(entityId, entityType)

  return {
    used: items.length,
    max,
    items,
  }
}

/**
 * Check if an item requires attunement
 */
export async function requiresAttunement(itemId: string): Promise<boolean> {
  const item = await getItem(itemId)
  return item?.requiresAttunement ?? false
}

/**
 * Check if entity can attune to an item
 */
export async function canAttune(
  entityId: string,
  inventoryItemId: string,
  entityType: EntityType = 'character'
): Promise<{ canAttune: boolean; reason?: string }> {
  const slots = await getAttunementSlots(entityId, entityType)

  if (slots.used >= slots.max) {
    return { canAttune: false, reason: `Already attuned to ${slots.max} items (maximum)` }
  }

  const inventoryItem = await getInventoryItemOrThrow(inventoryItemId)

  // Check ownership
  if (inventoryItem.ownerId !== entityId || inventoryItem.ownerType !== entityType) {
    return { canAttune: false, reason: 'Item does not belong to this entity' }
  }

  // Check if already attuned
  if (inventoryItem.attuned) {
    return { canAttune: false, reason: 'Already attuned to this item' }
  }

  // Check if item requires attunement
  if (inventoryItem.itemTemplateId) {
    const needsAttunement = await requiresAttunement(inventoryItem.itemTemplateId)
    if (!needsAttunement) {
      return { canAttune: false, reason: 'This item does not require attunement' }
    }
  }

  return { canAttune: true }
}

/**
 * Attune to an item
 */
export async function attuneToItem(
  entityId: string,
  inventoryItemId: string,
  entityType: EntityType = 'character'
): Promise<{ success: boolean; error?: string }> {
  const check = await canAttune(entityId, inventoryItemId, entityType)
  if (!check.canAttune) {
    return { success: false, error: check.reason }
  }

  await updateInventoryItem(inventoryItemId, { attuned: true })

  // Update inventory system's attuned items list
  const system = await getEntityInventorySystem(entityId, entityType)
  if (system) {
    const newAttunedItems = [...system.attunedItems, inventoryItemId]
    await updateAttunedItems(system.id, newAttunedItems)
  }

  return { success: true }
}

/**
 * End attunement to an item
 */
export async function unattuneFromItem(
  entityId: string,
  inventoryItemId: string,
  entityType: EntityType = 'character'
): Promise<{ success: boolean; error?: string }> {
  const inventoryItem = await getInventoryItemOrThrow(inventoryItemId)

  if (!inventoryItem.attuned) {
    return { success: false, error: 'Item is not attuned' }
  }

  if (inventoryItem.ownerId !== entityId || inventoryItem.ownerType !== entityType) {
    return { success: false, error: 'Item does not belong to this entity' }
  }

  await updateInventoryItem(inventoryItemId, { attuned: false })

  // Update inventory system's attuned items list
  const system = await getEntityInventorySystem(entityId, entityType)
  if (system) {
    const newAttunedItems = system.attunedItems.filter(id => id !== inventoryItemId)
    await updateAttunedItems(system.id, newAttunedItems)
  }

  return { success: true }
}

// ============================================
// CONTAINER MANAGEMENT
// ============================================

/**
 * Calculate container capacity usage
 */
export async function getContainerCapacity(
  _containerId: string,
  container: InventoryContainer
): Promise<{
  weightUsed: number
  weightCapacity: number | null
  itemCount: number
  itemCapacity: number | null
  isFull: boolean
}> {
  const items = container.items

  let weightUsed = 0
  for (const _item of items) {
    // Weight would need to be fetched from item properties
    // For now, assume items track their own weight
    weightUsed += 0 // TODO: calculate from item data
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const isFull =
    (container.weightCapacity !== null && weightUsed >= container.weightCapacity) ||
    (container.itemSlots !== null && itemCount >= container.itemSlots)

  return {
    weightUsed,
    weightCapacity: container.weightCapacity,
    itemCount,
    itemCapacity: container.itemSlots,
    isFull,
  }
}

/**
 * Check if an item can fit in a container
 */
export async function canFitInContainer(
  container: InventoryContainer,
  itemWeight: number,
  quantity: number
): Promise<{ canFit: boolean; reason?: string }> {
  const capacity = await getContainerCapacity(container.id, container)

  // Check item slots
  if (container.itemSlots !== null) {
    if (capacity.itemCount + quantity > container.itemSlots) {
      return { canFit: false, reason: 'Container is full (item slots)' }
    }
  }

  // Check weight capacity (unless dimensional space)
  if (!container.dimensionalSpace && container.weightCapacity !== null) {
    const totalWeight = capacity.weightUsed + (itemWeight * quantity)
    if (totalWeight > container.weightCapacity) {
      return { canFit: false, reason: 'Container cannot hold this weight' }
    }
  }

  return { canFit: true }
}

/**
 * Find a container that can hold an item
 */
export async function findContainerForItem(
  inventorySystemId: string,
  itemWeight: number,
  quantity: number = 1,
  preferredType?: string
): Promise<InventoryContainer | null> {
  const containers = await getContainersForInventory(inventorySystemId)

  // First try preferred type
  if (preferredType) {
    const preferred = containers.find(c => c.type === preferredType)
    if (preferred) {
      const check = await canFitInContainer(preferred, itemWeight, quantity)
      if (check.canFit) {
        return preferred
      }
    }
  }

  // Try carried container first, then others
  const sorted = containers.sort((a, b) => {
    if (a.type === 'carried') return -1
    if (b.type === 'carried') return 1
    return 0
  })

  for (const container of sorted) {
    const check = await canFitInContainer(container, itemWeight, quantity)
    if (check.canFit) {
      return container
    }
  }

  return null
}

// ============================================
// INVENTORY AGGREGATION
// ============================================

/**
 * Get complete inventory overview for an entity
 */
export async function getInventoryOverview(
  entityId: string,
  entityType: EntityType = 'character'
): Promise<{
  system: EntityInventorySystem | null
  containers: InventoryContainer[]
  items: InventoryItem[]
  equippedItems: InventoryItem[]
  attunedItems: InventoryItem[]
  totalWeight: number
  totalValue: number
  wallet: StandardCurrency
}> {
  const system = await getEntityInventorySystem(entityId, entityType)

  if (!system) {
    return {
      system: null,
      containers: [],
      items: [],
      equippedItems: [],
      attunedItems: [],
      totalWeight: 0,
      totalValue: 0,
      wallet: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    }
  }

  const containers = await getContainersForInventory(system.id)
  const items = await getInventoryItemsByOwner(entityId, entityType)

  const equippedItems = items.filter(i => i.equipped)
  const attunedItems = items.filter(i => i.attuned)

  let totalWeight = 0
  let totalValue = 0

  for (const item of items) {
    const weight = item.properties?.weight ?? 0
    const value = item.properties?.baseValue ?? 0
    totalWeight += weight * item.quantity
    totalValue += value * item.quantity
  }

  return {
    system,
    containers,
    items,
    equippedItems,
    attunedItems,
    totalWeight,
    totalValue,
    wallet: system.wallet.standard,
  }
}

// ============================================
// ITEM STACKING
// ============================================

/**
 * Check if two items can be stacked together
 */
export function canStackItems(item1: InventoryItem, item2: InventoryItem): boolean {
  // Must have same template
  if (item1.itemTemplateId !== item2.itemTemplateId) {
    return false
  }

  // Must both be unequipped and unattuned
  if (item1.equipped || item2.equipped || item1.attuned || item2.attuned) {
    return false
  }

  // Must be in same container
  if (item1.containerId !== item2.containerId) {
    return false
  }

  // Must have same properties (for custom items)
  if (JSON.stringify(item1.properties) !== JSON.stringify(item2.properties)) {
    return false
  }

  return true
}

// ============================================
// NPC INVENTORY GENERATION
// ============================================

/**
 * Roll dice notation string (e.g., "2d6+3")
 */
function rollDice(notation: string): number {
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/)
  if (!match) {
    // Try parsing as plain number
    const num = parseInt(notation, 10)
    return isNaN(num) ? 0 : num
  }

  const count = parseInt(match[1] || '1', 10)
  const sides = parseInt(match[2], 10)
  const modifier = parseInt(match[3] || '0', 10)

  let total = modifier
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1
  }

  return Math.max(0, total)
}

/**
 * Generate starting inventory for an NPC based on their role
 */
export async function generateNPCInventory(
  npcId: string,
  campaignId: string,
  role: string,
  occupation?: string,
  level?: number
): Promise<EntityInventorySystem> {
  // Get or create inventory system for NPC
  const system = await getOrCreateEntityInventorySystem(npcId, 'npc', campaignId)

  // Get loadout for this role
  const loadout = await getNPCLoadout(role, occupation, level, campaignId)

  if (!loadout) {
    // No loadout defined, return empty inventory
    return system
  }

  // Add equipment items
  for (const [slot, itemName] of Object.entries(loadout.equipment)) {
    if (!itemName) continue

    await createInventoryItem({
      ownerId: npcId,
      ownerType: 'npc',
      name: itemName,
      quantity: 1,
      equipped: true,
      equippedSlot: slot,
      containerId: system.wornContainerId ?? undefined,
      properties: {
        fromLoadout: true,
        role,
      },
    })
  }

  // Add carried items
  for (const carried of loadout.carried) {
    const quantity = rollDice(carried.quantity)
    if (quantity <= 0) continue

    await createInventoryItem({
      ownerId: npcId,
      ownerType: 'npc',
      name: carried.item,
      quantity,
      containerId: system.carriedContainerId ?? undefined,
      properties: {
        fromLoadout: true,
        role,
      },
    })
  }

  // Add currency
  const currency: Partial<StandardCurrency> = {}
  for (const [coinType, diceNotation] of Object.entries(loadout.currency)) {
    const amount = rollDice(diceNotation)
    if (amount > 0) {
      currency[coinType as keyof StandardCurrency] = amount
    }
  }

  if (Object.keys(currency).length > 0) {
    const { updateWallet } = await import('../../db/queries/inventory')
    await updateWallet(system.id, currency, 'add')
  }

  // Return updated system
  const updatedSystem = await getEntityInventorySystem(npcId, 'npc')
  return updatedSystem!
}

/**
 * Default loadouts for common NPC roles
 */
export const DEFAULT_NPC_LOADOUTS: Record<string, Omit<NPCLoadout, 'id' | 'createdAt' | 'updatedAt'>> = {
  guard: {
    role: 'guard',
    occupation: null,
    tier: 'common',
    levelMin: 1,
    levelMax: 5,
    equipment: {
      main_hand: 'Longsword',
      off_hand: 'Shield',
      chest: 'Chain Mail',
      head: 'Helmet',
    },
    carried: [
      { item: 'Manacles', quantity: '1' },
      { item: 'Torch', quantity: '2' },
    ],
    currency: {
      gold: '1d4',
      silver: '2d6',
    },
    isSystem: true,
    campaignId: null,
  },
  merchant: {
    role: 'merchant',
    occupation: null,
    tier: 'common',
    levelMin: 1,
    levelMax: 10,
    equipment: {
      chest: 'Fine Clothes',
    },
    carried: [
      { item: 'Ledger', quantity: '1' },
      { item: 'Ink and Quill', quantity: '1' },
    ],
    currency: {
      gold: '5d10',
      silver: '10d10',
      copper: '20d10',
    },
    isSystem: true,
    campaignId: null,
  },
  bandit: {
    role: 'bandit',
    occupation: null,
    tier: 'common',
    levelMin: 1,
    levelMax: 5,
    equipment: {
      main_hand: 'Scimitar',
      chest: 'Leather Armor',
    },
    carried: [
      { item: 'Light Crossbow', quantity: '1' },
      { item: 'Crossbow Bolts', quantity: '20' },
    ],
    currency: {
      gold: '1d6',
      silver: '3d6',
    },
    isSystem: true,
    campaignId: null,
  },
  adventurer: {
    role: 'adventurer',
    occupation: null,
    tier: 'common',
    levelMin: 1,
    levelMax: 20,
    equipment: {
      main_hand: 'Longsword',
      chest: 'Chain Mail',
      back: 'Backpack',
    },
    carried: [
      { item: 'Rations', quantity: '5' },
      { item: 'Waterskin', quantity: '1' },
      { item: 'Rope (50 ft)', quantity: '1' },
      { item: 'Torch', quantity: '5' },
      { item: 'Healing Potion', quantity: '1d2' },
    ],
    currency: {
      gold: '2d6',
      silver: '5d6',
    },
    isSystem: true,
    campaignId: null,
  },
  noble: {
    role: 'noble',
    occupation: null,
    tier: 'notable',
    levelMin: 1,
    levelMax: 10,
    equipment: {
      chest: 'Fine Clothes',
      neck: 'Signet Ring',
    },
    carried: [
      { item: 'Perfume', quantity: '1' },
      { item: 'Letter of Introduction', quantity: '1' },
    ],
    currency: {
      platinum: '1d4',
      gold: '10d10',
    },
    isSystem: true,
    campaignId: null,
  },
  priest: {
    role: 'priest',
    occupation: null,
    tier: 'common',
    levelMin: 1,
    levelMax: 10,
    equipment: {
      main_hand: 'Mace',
      chest: 'Vestments',
      neck: 'Holy Symbol',
    },
    carried: [
      { item: 'Prayer Book', quantity: '1' },
      { item: 'Holy Water', quantity: '2' },
      { item: 'Candles', quantity: '10' },
    ],
    currency: {
      gold: '2d6',
      silver: '3d6',
    },
    isSystem: true,
    campaignId: null,
  },
  mage: {
    role: 'mage',
    occupation: null,
    tier: 'notable',
    levelMin: 1,
    levelMax: 20,
    equipment: {
      main_hand: 'Staff',
      chest: 'Robes',
    },
    carried: [
      { item: 'Spellbook', quantity: '1' },
      { item: 'Component Pouch', quantity: '1' },
      { item: 'Scroll Case', quantity: '1' },
    ],
    currency: {
      gold: '3d10',
      silver: '5d6',
    },
    isSystem: true,
    campaignId: null,
  },
  commoner: {
    role: 'commoner',
    occupation: null,
    tier: 'background',
    levelMin: 1,
    levelMax: 1,
    equipment: {
      chest: 'Common Clothes',
    },
    carried: [
      { item: 'Pouch', quantity: '1' },
    ],
    currency: {
      copper: '5d6',
      silver: '1d6',
    },
    isSystem: true,
    campaignId: null,
  },
}

/**
 * Seed default NPC loadouts to database
 */
export async function seedDefaultLoadouts(campaignId?: string): Promise<void> {
  const { createNPCLoadout, getNPCLoadout } = await import('../../db/queries/inventory')

  for (const [role, loadout] of Object.entries(DEFAULT_NPC_LOADOUTS)) {
    // Check if already exists
    const existing = await getNPCLoadout(role, undefined, undefined, campaignId)
    if (existing) continue

    await createNPCLoadout({
      ...loadout,
      occupation: loadout.occupation ?? undefined,
      role,
      campaignId,
    })
  }
}
