/**
 * INVENTORY QUERIES
 * ==================
 *
 * Database queries for the entity-based inventory system.
 * Supports any entity type: characters, NPCs, parties, locations, vehicles, etc.
 */

import {
  query,
  queryOne,
  queryAll,
  toJson,
  parseJson,
  uuid,
  now,
  NotFoundError,
  transaction,
  type Transaction,
} from '../client'

// ============================================
// ENTITY TYPES
// ============================================

export type EntityType =
  | 'character'   // Player characters
  | 'npc'         // NPCs (guards, merchants, adventurers)
  | 'party'       // Party shared inventory (caravan, trolley)
  | 'location'    // Treasure chests, vaults, stashes
  | 'vehicle'     // Ship cargo, cart storage
  | 'building'    // Shop inventory, guild storage
  | 'mount'       // Saddlebags

// ============================================
// ROW TYPES
// ============================================

export interface EntityInventorySystemRow {
  id: string
  campaignId: string
  entityId: string
  entityType: string
  name: string | null
  description: string | null
  wallet: string // JSON
  wornContainerId: string | null
  carriedContainerId: string | null
  attunementSlots: number
  attunedItems: string // JSON array
  weightCapacity: number | null
  itemCapacity: number | null
  trackWeight: number
  trackAmmunition: number
  encumbranceRule: string
  isMerchant: number
  priceModifier: number
  buysCategories: string // JSON array
  restockInterval: string | null
  lastRestockedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface InventoryContainerRow {
  id: string
  inventorySystemId: string
  type: string
  name: string
  weightCapacity: number | null
  itemSlots: number | null
  dimensionalSpace: number
  items: string // JSON
  createdAt: string
  updatedAt: string
  version: number
}

export interface ItemRow {
  id: string
  campaignId: string | null
  isTemplate: number
  templateId: string | null
  name: string
  description: string | null
  category: string
  subcategory: string | null
  rarity: string
  weight: number
  baseValue: number
  magical: number
  requiresAttunement: number
  attunementRequirements: string | null // JSON
  weapon: string | null // JSON
  armor: string | null // JSON
  container: string | null // JSON
  charges: string | null // JSON
  abilities: string // JSON array
  tags: string // JSON array
  createdAt: string
  updatedAt: string
  version: number
}

export interface FullInventoryItemRow {
  id: string
  ownerId: string
  ownerType: string
  itemTemplateId: string | null
  itemId: string | null
  name: string
  description: string | null
  quantity: number
  equipped: number
  attuned: number
  containerId: string | null
  equippedSlot: string | null
  properties: string // JSON
  createdAt: string
  updatedAt: string
}

export interface MountRow {
  id: string
  inventorySystemId: string
  name: string
  type: string
  strength: number
  carryingCapacity: number
  speed: number
  barding: string | null // JSON
  saddle: string | null // JSON
  containers: string // JSON array
  hpCurrent: number | null
  hpMax: number | null
  status: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface FollowerRow {
  id: string
  campaignId: string
  ownerId: string
  name: string
  type: string
  count: number
  stats: string // JSON
  inventoryContainerId: string | null
  loyalty: number
  status: string
  mission: string | null
  missionStartedAt: string | null
  missionEndsAt: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface NPCLoadoutRow {
  id: string
  role: string
  occupation: string | null
  tier: string
  levelMin: number
  levelMax: number
  equipment: string // JSON
  carried: string // JSON array
  currency: string // JSON
  isSystem: number
  campaignId: string | null
  createdAt: string
  updatedAt: string
}

export interface MerchantStockRow {
  id: string
  inventorySystemId: string
  itemId: string | null
  itemTemplateId: string | null
  quantity: number
  maxQuantity: number | null
  restockQuantity: string | null
  buyPrice: number | null
  sellPrice: number | null
  priceModifier: number
  isAvailable: number
  availableFrom: string | null
  availableUntil: string | null
  restockDays: string // JSON array
  lastRestockedAt: string | null
  createdAt: string
  updatedAt: string
}

// ============================================
// CONVERTERS
// ============================================

export interface EntityInventorySystem {
  id: string
  campaignId: string
  entityId: string
  entityType: EntityType
  name: string | null
  description: string | null
  wallet: {
    standard: { copper: number; silver: number; electrum: number; gold: number; platinum: number }
  }
  wornContainerId: string | null
  carriedContainerId: string | null
  attunementSlots: number
  attunedItems: string[]
  weightCapacity: number | null
  itemCapacity: number | null
  trackWeight: boolean
  trackAmmunition: boolean
  encumbranceRule: string
  isMerchant: boolean
  priceModifier: number
  buysCategories: string[]
  restockInterval: string | null
  lastRestockedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export function convertEntityInventorySystem(row: EntityInventorySystemRow): EntityInventorySystem {
  return {
    ...row,
    entityType: row.entityType as EntityType,
    wallet: parseJson(row.wallet) || { standard: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 } },
    attunedItems: parseJson(row.attunedItems) || [],
    trackWeight: row.trackWeight === 1,
    trackAmmunition: row.trackAmmunition === 1,
    isMerchant: row.isMerchant === 1,
    buysCategories: parseJson(row.buysCategories) || [],
  }
}

// Alias for backwards compatibility
export type InventorySystem = EntityInventorySystem

export interface InventoryContainer {
  id: string
  inventorySystemId: string
  type: string
  name: string
  weightCapacity: number | null
  itemSlots: number | null
  dimensionalSpace: number
  items: Array<{
    itemId: string
    quantity: number
    equipped: boolean
    equippedSlot?: string
    attuned: boolean
  }>
  createdAt: string
  updatedAt: string
  version: number
}

export function convertContainer(row: InventoryContainerRow): InventoryContainer {
  return {
    ...row,
    items: parseJson(row.items) || [],
  }
}

export interface Item {
  id: string
  campaignId: string | null
  isTemplate: boolean
  templateId: string | null
  name: string
  description: string | null
  category: string
  subcategory: string | null
  rarity: string
  weight: number
  baseValue: number
  magical: boolean
  requiresAttunement: boolean
  attunementRequirements: Record<string, any> | null
  weapon: Record<string, any> | null
  armor: Record<string, any> | null
  container: Record<string, any> | null
  charges: Record<string, any> | null
  abilities: Array<Record<string, any>>
  tags: string[]
  createdAt: string
  updatedAt: string
  version: number
}

export function convertItem(row: ItemRow): Item {
  return {
    ...row,
    isTemplate: row.isTemplate === 1,
    magical: row.magical === 1,
    requiresAttunement: row.requiresAttunement === 1,
    attunementRequirements: parseJson(row.attunementRequirements),
    weapon: parseJson(row.weapon),
    armor: parseJson(row.armor),
    container: parseJson(row.container),
    charges: parseJson(row.charges),
    abilities: parseJson(row.abilities) || [],
    tags: parseJson(row.tags) || [],
  }
}

export interface InventoryItem {
  id: string
  ownerId: string
  ownerType: string
  itemTemplateId: string | null
  itemId: string | null
  name: string
  description: string | null
  quantity: number
  equipped: boolean
  attuned: boolean
  containerId: string | null
  equippedSlot: string | null
  properties: Record<string, any>
  createdAt: string
  updatedAt: string
}

export function convertInventoryItem(row: FullInventoryItemRow): InventoryItem {
  return {
    ...row,
    equipped: row.equipped === 1,
    attuned: row.attuned === 1,
    properties: parseJson(row.properties) || {},
  }
}

export interface Mount {
  id: string
  inventorySystemId: string
  name: string
  type: string
  strength: number
  carryingCapacity: number
  speed: number
  barding: Record<string, any> | null
  saddle: Record<string, any> | null
  containers: string[]
  hpCurrent: number | null
  hpMax: number | null
  status: string
  createdAt: string
  updatedAt: string
  version: number
}

export function convertMount(row: MountRow): Mount {
  return {
    ...row,
    barding: parseJson(row.barding),
    saddle: parseJson(row.saddle),
    containers: parseJson(row.containers) || [],
  }
}

export interface Follower {
  id: string
  campaignId: string
  ownerId: string
  name: string
  type: string
  count: number
  stats: Record<string, any>
  inventoryContainerId: string | null
  loyalty: number
  status: string
  mission: string | null
  missionStartedAt: string | null
  missionEndsAt: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export function convertFollower(row: FollowerRow): Follower {
  return {
    ...row,
    stats: parseJson(row.stats) || {},
  }
}

export interface NPCLoadout {
  id: string
  role: string
  occupation: string | null
  tier: string
  levelMin: number
  levelMax: number
  equipment: Record<string, string>
  carried: Array<{ item: string; quantity: string }>
  currency: Record<string, string>
  isSystem: boolean
  campaignId: string | null
  createdAt: string
  updatedAt: string
}

export function convertNPCLoadout(row: NPCLoadoutRow): NPCLoadout {
  return {
    ...row,
    equipment: parseJson(row.equipment) || {},
    carried: parseJson(row.carried) || [],
    currency: parseJson(row.currency) || {},
    isSystem: row.isSystem === 1,
  }
}

export interface MerchantStock {
  id: string
  inventorySystemId: string
  itemId: string | null
  itemTemplateId: string | null
  quantity: number
  maxQuantity: number | null
  restockQuantity: string | null
  buyPrice: number | null
  sellPrice: number | null
  priceModifier: number
  isAvailable: boolean
  availableFrom: string | null
  availableUntil: string | null
  restockDays: string[]
  lastRestockedAt: string | null
  createdAt: string
  updatedAt: string
}

export function convertMerchantStock(row: MerchantStockRow): MerchantStock {
  return {
    ...row,
    isAvailable: row.isAvailable === 1,
    restockDays: parseJson(row.restockDays) || [],
  }
}

// ============================================
// ENTITY INVENTORY SYSTEM QUERIES
// ============================================

export async function getEntityInventorySystem(
  entityId: string,
  entityType: EntityType
): Promise<EntityInventorySystem | null> {
  const row = await queryOne<EntityInventorySystemRow>(
    'SELECT * FROM entity_inventory_systems WHERE entity_id = ? AND entity_type = ?',
    [entityId, entityType]
  )
  return row ? convertEntityInventorySystem(row) : null
}

export async function getEntityInventorySystemById(
  id: string
): Promise<EntityInventorySystem | null> {
  const row = await queryOne<EntityInventorySystemRow>(
    'SELECT * FROM entity_inventory_systems WHERE id = ?',
    [id]
  )
  return row ? convertEntityInventorySystem(row) : null
}

export async function getEntityInventorySystemOrThrow(
  entityId: string,
  entityType: EntityType
): Promise<EntityInventorySystem> {
  const system = await getEntityInventorySystem(entityId, entityType)
  if (!system) throw new NotFoundError('EntityInventorySystem', `${entityType}:${entityId}`)
  return system
}

// Backwards compatibility aliases
export const getInventorySystem = (characterId: string) =>
  getEntityInventorySystem(characterId, 'character')
export const getInventorySystemById = getEntityInventorySystemById
export const getInventorySystemOrThrow = (characterId: string) =>
  getEntityInventorySystemOrThrow(characterId, 'character')

export interface CreateEntityInventorySystemInput {
  entityId: string
  entityType: EntityType
  campaignId: string
  name?: string
  description?: string
  attunementSlots?: number
  weightCapacity?: number
  itemCapacity?: number
  isMerchant?: boolean
  priceModifier?: number
  buysCategories?: string[]
}

export async function createEntityInventorySystem(
  input: CreateEntityInventorySystemInput
): Promise<EntityInventorySystem> {
  const id = uuid()
  const timestamp = now()

  // Only create worn/carried containers for characters and NPCs
  const needsContainers = input.entityType === 'character' || input.entityType === 'npc'
  const wornContainerId = needsContainers ? uuid() : null
  const carriedContainerId = needsContainers ? uuid() : null

  await transaction(async (tx: Transaction) => {
    // Create inventory system
    await tx.query(
      `INSERT INTO entity_inventory_systems (
        id, campaign_id, entity_id, entity_type, name, description,
        wallet, worn_container_id, carried_container_id,
        attunement_slots, attuned_items,
        weight_capacity, item_capacity,
        track_weight, track_ammunition, encumbrance_rule,
        is_merchant, price_modifier, buys_categories,
        restock_interval, last_restocked_at,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'none', ?, ?, ?, NULL, NULL, ?, ?, 1)`,
      [
        id,
        input.campaignId,
        input.entityId,
        input.entityType,
        input.name ?? null,
        input.description ?? null,
        toJson({ standard: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 } }),
        wornContainerId,
        carriedContainerId,
        input.attunementSlots ?? 3,
        toJson([]),
        input.weightCapacity ?? null,
        input.itemCapacity ?? null,
        input.isMerchant ? 1 : 0,
        input.priceModifier ?? 1.0,
        toJson(input.buysCategories ?? []),
        timestamp,
        timestamp,
      ]
    )

    // Create containers for characters/NPCs
    if (needsContainers) {
      // Worn container (equipment slots)
      await tx.query(
        `INSERT INTO inventory_containers (
          id, inventory_system_id, type, name,
          weight_capacity, item_slots, dimensional_space, items,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 1)`,
        [wornContainerId, id, 'worn', 'Worn Equipment', toJson([]), timestamp, timestamp]
      )

      // Carried container (backpack)
      await tx.query(
        `INSERT INTO inventory_containers (
          id, inventory_system_id, type, name,
          weight_capacity, item_slots, dimensional_space, items,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 1)`,
        [carriedContainerId, id, 'carried', 'Backpack', toJson([]), timestamp, timestamp]
      )
    }
  })

  return getEntityInventorySystemOrThrow(input.entityId, input.entityType)
}

// Backwards compatibility
export const createInventorySystem = (input: { characterId: string; campaignId: string; attunementSlots?: number }) =>
  createEntityInventorySystem({
    entityId: input.characterId,
    entityType: 'character',
    campaignId: input.campaignId,
    attunementSlots: input.attunementSlots,
  })

export async function getOrCreateEntityInventorySystem(
  entityId: string,
  entityType: EntityType,
  campaignId: string,
  options?: Partial<CreateEntityInventorySystemInput>
): Promise<EntityInventorySystem> {
  const existing = await getEntityInventorySystem(entityId, entityType)
  if (existing) return existing
  return createEntityInventorySystem({
    entityId,
    entityType,
    campaignId,
    ...options,
  })
}

// Backwards compatibility
export const getOrCreateInventorySystem = (characterId: string, campaignId: string) =>
  getOrCreateEntityInventorySystem(characterId, 'character', campaignId)

export interface UpdateWalletInput {
  copper?: number
  silver?: number
  electrum?: number
  gold?: number
  platinum?: number
}

export async function updateWallet(
  inventorySystemId: string,
  currency: UpdateWalletInput,
  operation: 'add' | 'remove' | 'set'
): Promise<EntityInventorySystem> {
  const system = await getEntityInventorySystemById(inventorySystemId)
  if (!system) throw new NotFoundError('EntityInventorySystem', inventorySystemId)

  const currentWallet = system.wallet.standard
  let newWallet: typeof currentWallet

  if (operation === 'set') {
    newWallet = {
      copper: currency.copper ?? currentWallet.copper,
      silver: currency.silver ?? currentWallet.silver,
      electrum: currency.electrum ?? currentWallet.electrum,
      gold: currency.gold ?? currentWallet.gold,
      platinum: currency.platinum ?? currentWallet.platinum,
    }
  } else if (operation === 'add') {
    newWallet = {
      copper: currentWallet.copper + (currency.copper ?? 0),
      silver: currentWallet.silver + (currency.silver ?? 0),
      electrum: currentWallet.electrum + (currency.electrum ?? 0),
      gold: currentWallet.gold + (currency.gold ?? 0),
      platinum: currentWallet.platinum + (currency.platinum ?? 0),
    }
  } else {
    // remove
    newWallet = {
      copper: currentWallet.copper - (currency.copper ?? 0),
      silver: currentWallet.silver - (currency.silver ?? 0),
      electrum: currentWallet.electrum - (currency.electrum ?? 0),
      gold: currentWallet.gold - (currency.gold ?? 0),
      platinum: currentWallet.platinum - (currency.platinum ?? 0),
    }

    // Check for negative values
    if (
      newWallet.copper < 0 ||
      newWallet.silver < 0 ||
      newWallet.electrum < 0 ||
      newWallet.gold < 0 ||
      newWallet.platinum < 0
    ) {
      throw new Error('Insufficient funds')
    }
  }

  await query(
    `UPDATE entity_inventory_systems
     SET wallet = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [toJson({ standard: newWallet }), now(), inventorySystemId]
  )

  const updated = await getEntityInventorySystemById(inventorySystemId)
  if (!updated) throw new NotFoundError('EntityInventorySystem', inventorySystemId)
  return updated
}

export async function updateAttunedItems(
  inventorySystemId: string,
  attunedItems: string[]
): Promise<void> {
  await query(
    `UPDATE entity_inventory_systems
     SET attuned_items = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [toJson(attunedItems), now(), inventorySystemId]
  )
}

// ============================================
// CONTAINER QUERIES
// ============================================

export async function getContainer(
  containerId: string
): Promise<InventoryContainer | null> {
  const row = await queryOne<InventoryContainerRow>(
    'SELECT * FROM inventory_containers WHERE id = ?',
    [containerId]
  )
  return row ? convertContainer(row) : null
}

export async function getContainerOrThrow(
  containerId: string
): Promise<InventoryContainer> {
  const container = await getContainer(containerId)
  if (!container) throw new NotFoundError('Container', containerId)
  return container
}

export async function getContainersForInventory(
  inventorySystemId: string
): Promise<InventoryContainer[]> {
  const rows = await queryAll<InventoryContainerRow>(
    'SELECT * FROM inventory_containers WHERE inventory_system_id = ? ORDER BY type, name',
    [inventorySystemId]
  )
  return rows.map(convertContainer)
}

export interface CreateContainerInput {
  inventorySystemId: string
  type: string
  name: string
  weightCapacity?: number
  itemSlots?: number
  dimensionalSpace?: number
}

export async function createContainer(
  input: CreateContainerInput
): Promise<InventoryContainer> {
  const id = uuid()
  const timestamp = now()

  await query(
    `INSERT INTO inventory_containers (
      id, inventory_system_id, type, name,
      weight_capacity, item_slots, dimensional_space, items,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      input.inventorySystemId,
      input.type,
      input.name,
      input.weightCapacity ?? null,
      input.itemSlots ?? null,
      input.dimensionalSpace ?? 0,
      toJson([]),
      timestamp,
      timestamp,
    ]
  )

  return getContainerOrThrow(id)
}

export async function updateContainerItems(
  containerId: string,
  items: InventoryContainer['items']
): Promise<void> {
  await query(
    `UPDATE inventory_containers
     SET items = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [toJson(items), now(), containerId]
  )
}

export async function deleteContainer(containerId: string): Promise<void> {
  await query('DELETE FROM inventory_containers WHERE id = ?', [containerId])
}

// ============================================
// ITEM QUERIES (Master Item Registry)
// ============================================

export async function getItem(itemId: string): Promise<Item | null> {
  const row = await queryOne<ItemRow>(
    'SELECT * FROM items WHERE id = ?',
    [itemId]
  )
  return row ? convertItem(row) : null
}

export async function getItemOrThrow(itemId: string): Promise<Item> {
  const item = await getItem(itemId)
  if (!item) throw new NotFoundError('Item', itemId)
  return item
}

export async function getItemsByCampaign(
  campaignId: string,
  filters?: {
    category?: string
    rarity?: string
    magical?: boolean
    isTemplate?: boolean
  }
): Promise<Item[]> {
  let sql = 'SELECT * FROM items WHERE (campaign_id = ? OR campaign_id IS NULL)'
  const params: any[] = [campaignId]

  if (filters?.category) {
    sql += ' AND category = ?'
    params.push(filters.category)
  }
  if (filters?.rarity) {
    sql += ' AND rarity = ?'
    params.push(filters.rarity)
  }
  if (filters?.magical !== undefined) {
    sql += ' AND magical = ?'
    params.push(filters.magical ? 1 : 0)
  }
  if (filters?.isTemplate !== undefined) {
    sql += ' AND is_template = ?'
    params.push(filters.isTemplate ? 1 : 0)
  }

  sql += ' ORDER BY name'

  const rows = await queryAll<ItemRow>(sql, params)
  return rows.map(convertItem)
}

export interface CreateItemInput {
  campaignId?: string
  isTemplate?: boolean
  templateId?: string
  name: string
  description?: string
  category: string
  subcategory?: string
  rarity?: string
  weight?: number
  baseValue?: number
  magical?: boolean
  requiresAttunement?: boolean
  attunementRequirements?: Record<string, any>
  weapon?: Record<string, any>
  armor?: Record<string, any>
  container?: Record<string, any>
  charges?: Record<string, any>
  abilities?: Array<Record<string, any>>
  tags?: string[]
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const id = uuid()
  const timestamp = now()

  await query(
    `INSERT INTO items (
      id, campaign_id, is_template, template_id,
      name, description, category, subcategory, rarity,
      weight, base_value, magical, requires_attunement, attunement_requirements,
      weapon, armor, container, charges, abilities, tags,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      input.campaignId ?? null,
      input.isTemplate ? 1 : 0,
      input.templateId ?? null,
      input.name,
      input.description ?? null,
      input.category,
      input.subcategory ?? null,
      input.rarity ?? 'common',
      input.weight ?? 0,
      input.baseValue ?? 0,
      input.magical ? 1 : 0,
      input.requiresAttunement ? 1 : 0,
      input.attunementRequirements ? toJson(input.attunementRequirements) : null,
      input.weapon ? toJson(input.weapon) : null,
      input.armor ? toJson(input.armor) : null,
      input.container ? toJson(input.container) : null,
      input.charges ? toJson(input.charges) : null,
      toJson(input.abilities ?? []),
      toJson(input.tags ?? []),
      timestamp,
      timestamp,
    ]
  )

  return getItemOrThrow(id)
}

export async function updateItem(
  itemId: string,
  updates: Partial<CreateItemInput>
): Promise<Item> {
  const setClauses: string[] = ['updated_at = ?', 'version = version + 1']
  const params: any[] = [now()]

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    params.push(updates.name)
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?')
    params.push(updates.description)
  }
  if (updates.category !== undefined) {
    setClauses.push('category = ?')
    params.push(updates.category)
  }
  if (updates.subcategory !== undefined) {
    setClauses.push('subcategory = ?')
    params.push(updates.subcategory)
  }
  if (updates.rarity !== undefined) {
    setClauses.push('rarity = ?')
    params.push(updates.rarity)
  }
  if (updates.weight !== undefined) {
    setClauses.push('weight = ?')
    params.push(updates.weight)
  }
  if (updates.baseValue !== undefined) {
    setClauses.push('base_value = ?')
    params.push(updates.baseValue)
  }
  if (updates.magical !== undefined) {
    setClauses.push('magical = ?')
    params.push(updates.magical ? 1 : 0)
  }
  if (updates.requiresAttunement !== undefined) {
    setClauses.push('requires_attunement = ?')
    params.push(updates.requiresAttunement ? 1 : 0)
  }
  if (updates.attunementRequirements !== undefined) {
    setClauses.push('attunement_requirements = ?')
    params.push(toJson(updates.attunementRequirements))
  }
  if (updates.weapon !== undefined) {
    setClauses.push('weapon = ?')
    params.push(updates.weapon ? toJson(updates.weapon) : null)
  }
  if (updates.armor !== undefined) {
    setClauses.push('armor = ?')
    params.push(updates.armor ? toJson(updates.armor) : null)
  }
  if (updates.container !== undefined) {
    setClauses.push('container = ?')
    params.push(updates.container ? toJson(updates.container) : null)
  }
  if (updates.charges !== undefined) {
    setClauses.push('charges = ?')
    params.push(updates.charges ? toJson(updates.charges) : null)
  }
  if (updates.abilities !== undefined) {
    setClauses.push('abilities = ?')
    params.push(toJson(updates.abilities))
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = ?')
    params.push(toJson(updates.tags))
  }

  params.push(itemId)

  await query(
    `UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  )

  return getItemOrThrow(itemId)
}

export async function deleteItem(itemId: string): Promise<void> {
  await query('DELETE FROM items WHERE id = ?', [itemId])
}

// ============================================
// INVENTORY ITEM QUERIES (Items in containers)
// ============================================

export async function getInventoryItem(
  inventoryItemId: string
): Promise<InventoryItem | null> {
  const row = await queryOne<FullInventoryItemRow>(
    'SELECT * FROM inventory_items WHERE id = ?',
    [inventoryItemId]
  )
  return row ? convertInventoryItem(row) : null
}

export async function getInventoryItemOrThrow(
  inventoryItemId: string
): Promise<InventoryItem> {
  const item = await getInventoryItem(inventoryItemId)
  if (!item) throw new NotFoundError('InventoryItem', inventoryItemId)
  return item
}

export async function getInventoryItemsByOwner(
  ownerId: string,
  ownerType: string
): Promise<InventoryItem[]> {
  const rows = await queryAll<FullInventoryItemRow>(
    'SELECT * FROM inventory_items WHERE owner_id = ? AND owner_type = ? ORDER BY name',
    [ownerId, ownerType]
  )
  return rows.map(convertInventoryItem)
}

export async function getInventoryItemsByContainer(
  containerId: string
): Promise<InventoryItem[]> {
  const rows = await queryAll<FullInventoryItemRow>(
    'SELECT * FROM inventory_items WHERE container_id = ? ORDER BY name',
    [containerId]
  )
  return rows.map(convertInventoryItem)
}

export async function getEquippedItems(
  ownerId: string,
  ownerType: string
): Promise<InventoryItem[]> {
  const rows = await queryAll<FullInventoryItemRow>(
    'SELECT * FROM inventory_items WHERE owner_id = ? AND owner_type = ? AND equipped = 1',
    [ownerId, ownerType]
  )
  return rows.map(convertInventoryItem)
}

export async function getAttunedItems(
  ownerId: string,
  ownerType: string
): Promise<InventoryItem[]> {
  const rows = await queryAll<FullInventoryItemRow>(
    'SELECT * FROM inventory_items WHERE owner_id = ? AND owner_type = ? AND attuned = 1',
    [ownerId, ownerType]
  )
  return rows.map(convertInventoryItem)
}

export interface CreateInventoryItemInput {
  ownerId: string
  ownerType: string
  itemTemplateId?: string
  itemId?: string
  name: string
  description?: string
  quantity?: number
  equipped?: boolean
  attuned?: boolean
  containerId?: string
  equippedSlot?: string
  properties?: Record<string, any>
}

export async function createInventoryItem(
  input: CreateInventoryItemInput
): Promise<InventoryItem> {
  const id = uuid()
  const timestamp = now()

  await query(
    `INSERT INTO inventory_items (
      id, owner_id, owner_type, item_template_id, item_id,
      name, description, quantity, equipped, attuned,
      container_id, equipped_slot, properties, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.ownerId,
      input.ownerType,
      input.itemTemplateId ?? null,
      input.itemId ?? null,
      input.name,
      input.description ?? null,
      input.quantity ?? 1,
      input.equipped ? 1 : 0,
      input.attuned ? 1 : 0,
      input.containerId ?? null,
      input.equippedSlot ?? null,
      toJson(input.properties ?? {}),
      timestamp,
      timestamp,
    ]
  )

  return getInventoryItemOrThrow(id)
}

export interface UpdateInventoryItemInput {
  quantity?: number
  equipped?: boolean
  attuned?: boolean
  containerId?: string
  equippedSlot?: string | null
  properties?: Record<string, any>
}

export async function updateInventoryItem(
  inventoryItemId: string,
  updates: UpdateInventoryItemInput
): Promise<InventoryItem> {
  const setClauses: string[] = ['updated_at = ?']
  const params: any[] = [now()]

  if (updates.quantity !== undefined) {
    setClauses.push('quantity = ?')
    params.push(updates.quantity)
  }
  if (updates.equipped !== undefined) {
    setClauses.push('equipped = ?')
    params.push(updates.equipped ? 1 : 0)
  }
  if (updates.attuned !== undefined) {
    setClauses.push('attuned = ?')
    params.push(updates.attuned ? 1 : 0)
  }
  if (updates.containerId !== undefined) {
    setClauses.push('container_id = ?')
    params.push(updates.containerId)
  }
  if (updates.equippedSlot !== undefined) {
    setClauses.push('equipped_slot = ?')
    params.push(updates.equippedSlot)
  }
  if (updates.properties !== undefined) {
    setClauses.push('properties = ?')
    params.push(toJson(updates.properties))
  }

  params.push(inventoryItemId)

  await query(
    `UPDATE inventory_items SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  )

  return getInventoryItemOrThrow(inventoryItemId)
}

export async function deleteInventoryItem(inventoryItemId: string): Promise<void> {
  await query('DELETE FROM inventory_items WHERE id = ?', [inventoryItemId])
}

export async function moveInventoryItem(
  inventoryItemId: string,
  newContainerId: string
): Promise<InventoryItem> {
  return updateInventoryItem(inventoryItemId, { containerId: newContainerId })
}

// ============================================
// MOUNT QUERIES
// ============================================

export async function getMount(mountId: string): Promise<Mount | null> {
  const row = await queryOne<MountRow>(
    'SELECT * FROM mounts WHERE id = ?',
    [mountId]
  )
  return row ? convertMount(row) : null
}

export async function getMountOrThrow(mountId: string): Promise<Mount> {
  const mount = await getMount(mountId)
  if (!mount) throw new NotFoundError('Mount', mountId)
  return mount
}

export async function getMountsForInventory(
  inventorySystemId: string
): Promise<Mount[]> {
  const rows = await queryAll<MountRow>(
    'SELECT * FROM mounts WHERE inventory_system_id = ? ORDER BY name',
    [inventorySystemId]
  )
  return rows.map(convertMount)
}

export interface CreateMountInput {
  inventorySystemId: string
  name: string
  type: string
  strength?: number
  carryingCapacity?: number
  speed?: number
  hpMax?: number
}

export async function createMount(input: CreateMountInput): Promise<Mount> {
  const id = uuid()
  const timestamp = now()

  // Default carrying capacity based on type
  const defaultCapacity = input.carryingCapacity ?? getDefaultMountCapacity(input.type)
  const defaultSpeed = input.speed ?? getDefaultMountSpeed(input.type)
  const defaultStrength = input.strength ?? 16

  await query(
    `INSERT INTO mounts (
      id, inventory_system_id, name, type,
      strength, carrying_capacity, speed,
      barding, saddle, containers,
      hp_current, hp_max, status,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'healthy', ?, ?, 1)`,
    [
      id,
      input.inventorySystemId,
      input.name,
      input.type,
      defaultStrength,
      defaultCapacity,
      defaultSpeed,
      toJson([]),
      input.hpMax ?? null,
      input.hpMax ?? null,
      timestamp,
      timestamp,
    ]
  )

  return getMountOrThrow(id)
}

function getDefaultMountCapacity(type: string): number {
  const capacities: Record<string, number> = {
    horse_riding: 480,
    horse_war: 540,
    horse_draft: 540,
    pony: 225,
    mule: 420,
    donkey: 420,
    camel: 480,
    elephant: 1320,
    mastiff: 195,
    exotic: 400,
    magical: 500,
  }
  return capacities[type] ?? 400
}

function getDefaultMountSpeed(type: string): number {
  const speeds: Record<string, number> = {
    horse_riding: 60,
    horse_war: 60,
    horse_draft: 40,
    pony: 40,
    mule: 40,
    donkey: 40,
    camel: 50,
    elephant: 40,
    mastiff: 40,
    exotic: 50,
    magical: 60,
  }
  return speeds[type] ?? 40
}

export async function updateMount(
  mountId: string,
  updates: Partial<Omit<CreateMountInput, 'inventorySystemId'>>
): Promise<Mount> {
  const setClauses: string[] = ['updated_at = ?', 'version = version + 1']
  const params: any[] = [now()]

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    params.push(updates.name)
  }
  if (updates.type !== undefined) {
    setClauses.push('type = ?')
    params.push(updates.type)
  }
  if (updates.strength !== undefined) {
    setClauses.push('strength = ?')
    params.push(updates.strength)
  }
  if (updates.carryingCapacity !== undefined) {
    setClauses.push('carrying_capacity = ?')
    params.push(updates.carryingCapacity)
  }
  if (updates.speed !== undefined) {
    setClauses.push('speed = ?')
    params.push(updates.speed)
  }
  if (updates.hpMax !== undefined) {
    setClauses.push('hp_max = ?')
    params.push(updates.hpMax)
  }

  params.push(mountId)

  await query(
    `UPDATE mounts SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  )

  return getMountOrThrow(mountId)
}

export async function deleteMount(mountId: string): Promise<void> {
  await query('DELETE FROM mounts WHERE id = ?', [mountId])
}

// ============================================
// FOLLOWER QUERIES
// ============================================

export async function getFollower(followerId: string): Promise<Follower | null> {
  const row = await queryOne<FollowerRow>(
    'SELECT * FROM followers WHERE id = ?',
    [followerId]
  )
  return row ? convertFollower(row) : null
}

export async function getFollowerOrThrow(followerId: string): Promise<Follower> {
  const follower = await getFollower(followerId)
  if (!follower) throw new NotFoundError('Follower', followerId)
  return follower
}

export async function getFollowersForOwner(ownerId: string): Promise<Follower[]> {
  const rows = await queryAll<FollowerRow>(
    'SELECT * FROM followers WHERE owner_id = ? ORDER BY name',
    [ownerId]
  )
  return rows.map(convertFollower)
}

export interface CreateFollowerInput {
  campaignId: string
  ownerId: string
  name: string
  type: string
  count?: number
  stats?: Record<string, any>
  loyalty?: number
}

export async function createFollower(input: CreateFollowerInput): Promise<Follower> {
  const id = uuid()
  const timestamp = now()

  await query(
    `INSERT INTO followers (
      id, campaign_id, owner_id, name, type, count,
      stats, inventory_container_id, loyalty, status,
      mission, mission_started_at, mission_ends_at,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'available', NULL, NULL, NULL, ?, ?, 1)`,
    [
      id,
      input.campaignId,
      input.ownerId,
      input.name,
      input.type,
      input.count ?? 1,
      toJson(input.stats ?? {}),
      input.loyalty ?? 50,
      timestamp,
      timestamp,
    ]
  )

  return getFollowerOrThrow(id)
}

export async function updateFollower(
  followerId: string,
  updates: Partial<Omit<CreateFollowerInput, 'campaignId' | 'ownerId'>>
): Promise<Follower> {
  const setClauses: string[] = ['updated_at = ?', 'version = version + 1']
  const params: any[] = [now()]

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    params.push(updates.name)
  }
  if (updates.type !== undefined) {
    setClauses.push('type = ?')
    params.push(updates.type)
  }
  if (updates.count !== undefined) {
    setClauses.push('count = ?')
    params.push(updates.count)
  }
  if (updates.stats !== undefined) {
    setClauses.push('stats = ?')
    params.push(toJson(updates.stats))
  }
  if (updates.loyalty !== undefined) {
    setClauses.push('loyalty = ?')
    params.push(updates.loyalty)
  }

  params.push(followerId)

  await query(
    `UPDATE followers SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  )

  return getFollowerOrThrow(followerId)
}

export async function deleteFollower(followerId: string): Promise<void> {
  await query('DELETE FROM followers WHERE id = ?', [followerId])
}

// ============================================
// NPC LOADOUT QUERIES
// ============================================

export async function getNPCLoadout(
  role: string,
  occupation?: string,
  level?: number,
  campaignId?: string
): Promise<NPCLoadout | null> {
  let sql = `
    SELECT * FROM npc_loadouts
    WHERE role = ?
    AND (campaign_id = ? OR (campaign_id IS NULL AND is_system = 1))
  `
  const params: any[] = [role, campaignId ?? null]

  if (occupation) {
    sql += ' AND (occupation = ? OR occupation IS NULL)'
    params.push(occupation)
  }

  if (level !== undefined) {
    sql += ' AND level_min <= ? AND level_max >= ?'
    params.push(level, level)
  }

  sql += ' ORDER BY campaign_id DESC, occupation DESC LIMIT 1'

  const row = await queryOne<NPCLoadoutRow>(sql, params)
  return row ? convertNPCLoadout(row) : null
}

export async function getLoadoutsForRole(
  role: string,
  campaignId?: string
): Promise<NPCLoadout[]> {
  const rows = await queryAll<NPCLoadoutRow>(
    `SELECT * FROM npc_loadouts
     WHERE role = ?
     AND (campaign_id = ? OR (campaign_id IS NULL AND is_system = 1))
     ORDER BY tier, level_min`,
    [role, campaignId ?? null]
  )
  return rows.map(convertNPCLoadout)
}

export interface CreateNPCLoadoutInput {
  role: string
  occupation?: string
  tier?: string
  levelMin?: number
  levelMax?: number
  equipment?: Record<string, string>
  carried?: Array<{ item: string; quantity: string }>
  currency?: Record<string, string>
  isSystem?: boolean
  campaignId?: string
}

export async function createNPCLoadout(input: CreateNPCLoadoutInput): Promise<NPCLoadout> {
  const id = uuid()
  const timestamp = now()

  await query(
    `INSERT INTO npc_loadouts (
      id, role, occupation, tier, level_min, level_max,
      equipment, carried, currency,
      is_system, campaign_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.role,
      input.occupation ?? null,
      input.tier ?? 'common',
      input.levelMin ?? 1,
      input.levelMax ?? 20,
      toJson(input.equipment ?? {}),
      toJson(input.carried ?? []),
      toJson(input.currency ?? {}),
      input.isSystem ? 1 : 0,
      input.campaignId ?? null,
      timestamp,
      timestamp,
    ]
  )

  const row = await queryOne<NPCLoadoutRow>(
    'SELECT * FROM npc_loadouts WHERE id = ?',
    [id]
  )
  if (!row) throw new Error('Failed to create NPC loadout')
  return convertNPCLoadout(row)
}

// ============================================
// MERCHANT STOCK QUERIES
// ============================================

export async function getMerchantStock(
  inventorySystemId: string
): Promise<MerchantStock[]> {
  const rows = await queryAll<MerchantStockRow>(
    'SELECT * FROM merchant_stock WHERE inventory_system_id = ? AND is_available = 1 ORDER BY item_id',
    [inventorySystemId]
  )
  return rows.map(convertMerchantStock)
}

export async function getMerchantStockItem(
  inventorySystemId: string,
  itemId: string
): Promise<MerchantStock | null> {
  const row = await queryOne<MerchantStockRow>(
    'SELECT * FROM merchant_stock WHERE inventory_system_id = ? AND item_id = ?',
    [inventorySystemId, itemId]
  )
  return row ? convertMerchantStock(row) : null
}

export interface CreateMerchantStockInput {
  inventorySystemId: string
  itemId?: string
  itemTemplateId?: string
  quantity?: number
  maxQuantity?: number
  buyPrice?: number
  sellPrice?: number
  priceModifier?: number
}

export async function addMerchantStock(input: CreateMerchantStockInput): Promise<MerchantStock> {
  const id = uuid()
  const timestamp = now()

  await query(
    `INSERT INTO merchant_stock (
      id, inventory_system_id, item_id, item_template_id,
      quantity, max_quantity, restock_quantity,
      buy_price, sell_price, price_modifier,
      is_available, available_from, available_until,
      restock_days, last_restocked_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, NULL, NULL, ?, NULL, ?, ?)`,
    [
      id,
      input.inventorySystemId,
      input.itemId ?? null,
      input.itemTemplateId ?? null,
      input.quantity ?? 1,
      input.maxQuantity ?? null,
      input.buyPrice ?? null,
      input.sellPrice ?? null,
      input.priceModifier ?? 1.0,
      toJson([]),
      timestamp,
      timestamp,
    ]
  )

  const row = await queryOne<MerchantStockRow>(
    'SELECT * FROM merchant_stock WHERE id = ?',
    [id]
  )
  if (!row) throw new Error('Failed to create merchant stock')
  return convertMerchantStock(row)
}

export async function updateMerchantStock(
  stockId: string,
  updates: Partial<Pick<CreateMerchantStockInput, 'quantity' | 'buyPrice' | 'sellPrice' | 'priceModifier'>>
): Promise<void> {
  const setClauses: string[] = ['updated_at = ?']
  const params: any[] = [now()]

  if (updates.quantity !== undefined) {
    setClauses.push('quantity = ?')
    params.push(updates.quantity)
  }
  if (updates.buyPrice !== undefined) {
    setClauses.push('buy_price = ?')
    params.push(updates.buyPrice)
  }
  if (updates.sellPrice !== undefined) {
    setClauses.push('sell_price = ?')
    params.push(updates.sellPrice)
  }
  if (updates.priceModifier !== undefined) {
    setClauses.push('price_modifier = ?')
    params.push(updates.priceModifier)
  }

  params.push(stockId)

  await query(
    `UPDATE merchant_stock SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  )
}

// ============================================
// PARTY INVENTORY QUERIES (using entity system)
// ============================================

export async function getPartyInventorySystem(
  partyId: string
): Promise<EntityInventorySystem | null> {
  return getEntityInventorySystem(partyId, 'party')
}

export async function getOrCreatePartyInventory(
  partyId: string,
  campaignId: string
): Promise<EntityInventorySystem> {
  return getOrCreateEntityInventorySystem(partyId, 'party', campaignId, {
    name: 'Party Treasury',
    description: 'Shared party inventory',
  })
}

// ============================================
// NPC INVENTORY QUERIES (using entity system)
// ============================================

export async function getNPCInventorySystem(
  npcId: string
): Promise<EntityInventorySystem | null> {
  return getEntityInventorySystem(npcId, 'npc')
}

export async function getOrCreateNPCInventory(
  npcId: string,
  campaignId: string,
  options?: {
    isMerchant?: boolean
    priceModifier?: number
    buysCategories?: string[]
  }
): Promise<EntityInventorySystem> {
  return getOrCreateEntityInventorySystem(npcId, 'npc', campaignId, options)
}
