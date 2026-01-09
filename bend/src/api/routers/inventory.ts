/**
 * INVENTORY ROUTER
 * =================
 *
 * API endpoints for the entity-based inventory system including:
 * - Inventory CRUD for any entity (characters, NPCs, parties, locations)
 * - Item management (add, remove, transfer)
 * - Equipment slots (equip, unequip)
 * - Attunement management
 * - Currency operations
 * - Mount and follower inventory
 * - NPC inventory generation
 * - Merchant stock management
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
  router,
  campaignProcedure,
  gmProcedure,
} from '../trpc'
import {
  ItemSchema,
  EquipmentSlotSchema,
  InventoryContainerTypeSchema,
  StandardCurrencySchema,
  EncumbranceRuleSchema,
  currencyToGP,
} from '../../engine/inventory/schema'
import {
  HomebrewRequestSchema,
  generateHomebrewItem,
  validateItem,
  calculateBalanceScore
} from '../../engine/inventory/homebrew-builder'
import * as inventoryQueries from '../../db/queries/inventory'
import * as inventoryEngine from '../../engine/inventory/inventory'

// Entity type schema
const EntityTypeSchema = z.enum(['character', 'npc', 'party', 'location', 'vehicle', 'building', 'mount'])

// ============================================
// INVENTORY ROUTER
// ============================================

export const inventoryRouter = router({
  // ==========================================
  // ENTITY INVENTORY SYSTEM CRUD
  // ==========================================

  /**
   * Get an entity's inventory system
   */
  get: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character')
    }))
    .query(async ({ ctx, input }) => {
      const overview = await inventoryEngine.getInventoryOverview(input.entityId, input.entityType)

      if (!overview.system) {
        // Auto-create inventory for entity
        const system = await inventoryQueries.createEntityInventorySystem({
          entityId: input.entityId,
          entityType: input.entityType,
          campaignId: ctx.campaignId,
        })

        const containers = await inventoryQueries.getContainersForInventory(system.id)

        return {
          id: system.id,
          entityId: input.entityId,
          entityType: input.entityType,
          campaignId: ctx.campaignId,
          encumbranceRule: system.encumbranceRule,
          trackWeight: system.trackWeight,
          wallet: system.wallet,
          attunementSlots: system.attunementSlots,
          attunedItems: system.attunedItems,
          containers,
          items: [],
          equippedItems: [],
          totalWeight: 0,
          totalValue: 0,
          isMerchant: system.isMerchant,
        }
      }

      return {
        id: overview.system.id,
        entityId: input.entityId,
        entityType: input.entityType,
        campaignId: ctx.campaignId,
        encumbranceRule: overview.system.encumbranceRule,
        trackWeight: overview.system.trackWeight,
        wallet: overview.wallet,
        attunementSlots: overview.system.attunementSlots,
        attunedItems: overview.system.attunedItems,
        containers: overview.containers,
        items: overview.items,
        equippedItems: overview.equippedItems,
        totalWeight: overview.totalWeight,
        totalValue: overview.totalValue,
        isMerchant: overview.system.isMerchant,
      }
    }),

  /**
   * Create inventory system for an entity
   */
  create: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      name: z.string().optional(),
      description: z.string().optional(),
      encumbranceRule: EncumbranceRuleSchema.optional(),
      trackWeight: z.boolean().optional(),
      trackAmmunition: z.boolean().optional(),
      isMerchant: z.boolean().optional(),
      priceModifier: z.number().optional(),
      buysCategories: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.createEntityInventorySystem({
        entityId: input.entityId,
        entityType: input.entityType,
        campaignId: ctx.campaignId,
        name: input.name,
        description: input.description,
        isMerchant: input.isMerchant,
        priceModifier: input.priceModifier,
        buysCategories: input.buysCategories,
      })

      const containers = await inventoryQueries.getContainersForInventory(system.id)

      return {
        ...system,
        containers,
      }
    }),

  /**
   * Update inventory settings
   */
  updateSettings: campaignProcedure
    .input(z.object({
      inventoryId: z.string().uuid(),
      encumbranceRule: EncumbranceRuleSchema.optional(),
      trackWeight: z.boolean().optional(),
      trackAmmunition: z.boolean().optional(),
      attunementSlots: z.number().int().min(0).max(10).optional(),
      isMerchant: z.boolean().optional(),
      priceModifier: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const system = await inventoryQueries.getEntityInventorySystemById(input.inventoryId)
      if (!system) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory system not found'
        })
      }
      return { success: true }
    }),

  // ==========================================
  // ITEMS
  // ==========================================

  /**
   * Add an item to inventory
   */
  addItem: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      containerId: z.string().uuid().optional(),
      item: z.object({
        name: z.string(),
        category: z.string(),
        description: z.string().optional(),
        weight: z.number().optional(),
        baseValue: z.number().optional(),
        magical: z.boolean().optional(),
        rarity: z.string().optional(),
        properties: z.record(z.any()).optional(),
      }),
      quantity: z.number().int().min(1).default(1),
      equipped: z.boolean().optional(),
      equippedSlot: EquipmentSlotSchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Get or create inventory system
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      // Determine container
      let containerId = input.containerId
      if (!containerId) {
        containerId = system.carriedContainerId ?? undefined
      }

      // Create the inventory item
      const inventoryItem = await inventoryQueries.createInventoryItem({
        ownerId: input.entityId,
        ownerType: input.entityType,
        name: input.item.name,
        description: input.item.description,
        quantity: input.quantity,
        equipped: input.equipped,
        equippedSlot: input.equippedSlot,
        containerId,
        properties: {
          category: input.item.category,
          weight: input.item.weight ?? 0,
          baseValue: input.item.baseValue ?? 0,
          magical: input.item.magical ?? false,
          rarity: input.item.rarity ?? 'common',
          ...input.item.properties,
        },
      })

      return {
        id: inventoryItem.id,
        ...input.item,
        quantity: input.quantity,
        containerId,
      }
    }),

  /**
   * Remove an item from inventory
   */
  removeItem: campaignProcedure
    .input(z.object({
      inventoryItemId: z.string().uuid(),
      quantity: z.number().int().min(1).optional()
    }))
    .mutation(async ({ input }) => {
      const item = await inventoryQueries.getInventoryItem(input.inventoryItemId)
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found'
        })
      }

      if (input.quantity && input.quantity < item.quantity) {
        await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
          quantity: item.quantity - input.quantity
        })
      } else {
        await inventoryQueries.deleteInventoryItem(input.inventoryItemId)
      }

      return { success: true }
    }),

  /**
   * Transfer item between containers
   */
  transferItem: campaignProcedure
    .input(z.object({
      inventoryItemId: z.string().uuid(),
      toContainerId: z.string().uuid(),
      quantity: z.number().int().min(1).optional()
    }))
    .mutation(async ({ input }) => {
      const item = await inventoryQueries.getInventoryItem(input.inventoryItemId)
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found'
        })
      }

      const targetContainer = await inventoryQueries.getContainer(input.toContainerId)
      if (!targetContainer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target container not found'
        })
      }

      if (input.quantity && input.quantity < item.quantity) {
        await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
          quantity: item.quantity - input.quantity
        })

        await inventoryQueries.createInventoryItem({
          ownerId: item.ownerId,
          ownerType: item.ownerType,
          itemTemplateId: item.itemTemplateId ?? undefined,
          itemId: item.itemId ?? undefined,
          name: item.name,
          description: item.description ?? undefined,
          quantity: input.quantity,
          containerId: input.toContainerId,
          properties: item.properties,
        })
      } else {
        await inventoryQueries.moveInventoryItem(input.inventoryItemId, input.toContainerId)
      }

      return { success: true }
    }),

  /**
   * Update item properties
   */
  updateItem: campaignProcedure
    .input(z.object({
      inventoryItemId: z.string().uuid(),
      updates: z.object({
        quantity: z.number().int().min(1).optional(),
        properties: z.record(z.any()).optional(),
      })
    }))
    .mutation(async ({ input }) => {
      const item = await inventoryQueries.getInventoryItem(input.inventoryItemId)
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found'
        })
      }

      await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
        quantity: input.updates.quantity,
        properties: input.updates.properties
          ? { ...item.properties, ...input.updates.properties }
          : undefined,
      })

      return { success: true }
    }),

  // ==========================================
  // EQUIPMENT SLOTS
  // ==========================================

  /**
   * Equip an item to a slot
   */
  equip: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      inventoryItemId: z.string().uuid(),
      slot: EquipmentSlotSchema
    }))
    .mutation(async ({ input }) => {
      const validation = await inventoryEngine.validateEquipmentChange(
        input.entityId,
        input.inventoryItemId,
        input.slot,
        input.entityType
      )

      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.errors.join(', ')
        })
      }

      // Unequip any existing item in that slot
      const equippedItems = await inventoryQueries.getEquippedItems(input.entityId, input.entityType)
      for (const equipped of equippedItems) {
        if (equipped.equippedSlot === input.slot) {
          await inventoryQueries.updateInventoryItem(equipped.id, {
            equipped: false,
            equippedSlot: null,
          })
        }
      }

      // Equip the new item
      await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
        equipped: true,
        equippedSlot: input.slot,
      })

      return { success: true, warnings: validation.warnings }
    }),

  /**
   * Unequip an item
   */
  unequip: campaignProcedure
    .input(z.object({
      inventoryItemId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const item = await inventoryQueries.getInventoryItem(input.inventoryItemId)
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found'
        })
      }

      await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
        equipped: false,
        equippedSlot: null,
      })

      return { success: true }
    }),

  /**
   * Get equipped items by slot
   */
  getEquipped: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character')
    }))
    .query(async ({ input }) => {
      const equippedItems = await inventoryQueries.getEquippedItems(input.entityId, input.entityType)

      const slots: Record<string, typeof equippedItems[0] | null> = {
        head: null,
        face: null,
        neck: null,
        shoulders: null,
        chest: null,
        back: null,
        arms: null,
        hands: null,
        waist: null,
        legs: null,
        feet: null,
        ring_left: null,
        ring_right: null,
        main_hand: null,
        off_hand: null,
        ammunition: null,
        component: null,
      }

      for (const item of equippedItems) {
        const slot = item.equippedSlot
        if (slot && slot in slots) {
          slots[slot] = item
        }
      }

      return slots
    }),

  // ==========================================
  // ATTUNEMENT
  // ==========================================

  /**
   * Attune to an item
   */
  attune: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      inventoryItemId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const result = await inventoryEngine.attuneToItem(
        input.entityId,
        input.inventoryItemId,
        input.entityType
      )

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Cannot attune to this item'
        })
      }

      return { success: true }
    }),

  /**
   * End attunement to an item
   */
  unattune: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      inventoryItemId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const result = await inventoryEngine.unattuneFromItem(
        input.entityId,
        input.inventoryItemId,
        input.entityType
      )

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Cannot unattune from this item'
        })
      }

      return { success: true }
    }),

  /**
   * Get attunement status
   */
  getAttunement: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character')
    }))
    .query(async ({ input }) => {
      const slots = await inventoryEngine.getAttunementSlots(input.entityId, input.entityType)

      return {
        slots: slots.max,
        used: slots.used,
        items: slots.items,
      }
    }),

  // ==========================================
  // CURRENCY
  // ==========================================

  /**
   * Add currency
   */
  addCurrency: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      currency: StandardCurrencySchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      await inventoryQueries.updateWallet(system.id, input.currency, 'add')

      return { success: true }
    }),

  /**
   * Remove currency
   */
  removeCurrency: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      currency: StandardCurrencySchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      if (!inventoryEngine.hasSufficientFunds(system.wallet.standard, input.currency)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient funds'
        })
      }

      try {
        await inventoryQueries.updateWallet(system.id, input.currency, 'remove')
      } catch (_error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient funds'
        })
      }

      return { success: true }
    }),

  /**
   * Convert currency between denominations
   */
  convertCurrency: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      from: z.enum(['copper', 'silver', 'electrum', 'gold', 'platinum']),
      to: z.enum(['copper', 'silver', 'electrum', 'gold', 'platinum']),
      amount: z.number().int().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      const wallet = system.wallet.standard

      if (wallet[input.from] < input.amount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Not enough ${input.from} to convert`
        })
      }

      const conversion = inventoryEngine.convertCurrency(input.from, input.to, input.amount)

      await inventoryQueries.updateWallet(system.id, { [input.from]: input.amount }, 'remove')
      await inventoryQueries.updateWallet(system.id, { [input.to]: conversion.toAmount }, 'add')

      return {
        success: true,
        converted: {
          from: { type: input.from, amount: input.amount },
          to: { type: input.to, amount: conversion.toAmount },
        }
      }
    }),

  /**
   * Get total wealth in gold pieces
   */
  getTotalWealth: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      includeItems: z.boolean().default(false)
    }))
    .query(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      const currencyTotal = currencyToGP(system.wallet.standard)

      let itemsTotal = 0
      if (input.includeItems) {
        const items = await inventoryQueries.getInventoryItemsByOwner(input.entityId, input.entityType)
        for (const item of items) {
          const value = item.properties?.baseValue ?? 0
          itemsTotal += value * item.quantity
        }
      }

      return {
        currency: currencyTotal,
        items: itemsTotal,
        total: currencyTotal + itemsTotal,
      }
    }),

  // ==========================================
  // CONTAINERS
  // ==========================================

  /**
   * Create a new container
   */
  createContainer: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      type: InventoryContainerTypeSchema,
      name: z.string(),
      weightCapacity: z.number().optional(),
      itemSlots: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      const container = await inventoryQueries.createContainer({
        inventorySystemId: system.id,
        type: input.type,
        name: input.name,
        weightCapacity: input.weightCapacity,
        itemSlots: input.itemSlots,
      })

      return container
    }),

  /**
   * Delete a container
   */
  deleteContainer: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      containerId: z.string().uuid(),
      moveItemsTo: z.string().uuid().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const container = await inventoryQueries.getContainer(input.containerId)
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found'
        })
      }

      if (container.type === 'worn' || container.type === 'carried') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete default containers'
        })
      }

      const items = await inventoryQueries.getInventoryItemsByContainer(input.containerId)

      if (items.length > 0) {
        let targetContainerId = input.moveItemsTo

        if (!targetContainerId) {
          const system = await inventoryQueries.getOrCreateEntityInventorySystem(
            input.entityId,
            input.entityType,
            ctx.campaignId
          )
          targetContainerId = system.carriedContainerId ?? undefined
        }

        if (targetContainerId) {
          for (const item of items) {
            await inventoryQueries.moveInventoryItem(item.id, targetContainerId)
          }
        }
      }

      await inventoryQueries.deleteContainer(input.containerId)

      return { success: true }
    }),

  // ==========================================
  // MOUNTS
  // ==========================================

  /**
   * Add a mount
   */
  addMount: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      name: z.string(),
      type: z.enum([
        'horse_riding', 'horse_war', 'horse_draft', 'pony', 'mule',
        'donkey', 'camel', 'elephant', 'mastiff', 'exotic', 'magical'
      ]),
      strength: z.number().int().optional(),
      carryingCapacity: z.number().optional(),
      speed: z.number().int().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.entityId,
        input.entityType,
        ctx.campaignId
      )

      const mount = await inventoryQueries.createMount({
        inventorySystemId: system.id,
        name: input.name,
        type: input.type,
        strength: input.strength,
        carryingCapacity: input.carryingCapacity,
        speed: input.speed,
      })

      return mount
    }),

  /**
   * Remove a mount
   */
  removeMount: campaignProcedure
    .input(z.object({
      mountId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const mount = await inventoryQueries.getMount(input.mountId)
      if (!mount) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Mount not found'
        })
      }

      for (const containerId of mount.containers) {
        await inventoryQueries.deleteContainer(containerId)
      }

      await inventoryQueries.deleteMount(input.mountId)

      return { success: true }
    }),

  /**
   * Get mounts for an entity
   */
  getMounts: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character')
    }))
    .query(async ({ ctx: _ctx, input }) => {
      const system = await inventoryQueries.getEntityInventorySystem(input.entityId, input.entityType)
      if (!system) {
        return []
      }

      return inventoryQueries.getMountsForInventory(system.id)
    }),

  // ==========================================
  // FOLLOWERS
  // ==========================================

  /**
   * Add a follower with inventory
   */
  addFollower: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      name: z.string(),
      type: z.enum(['hireling', 'companion', 'cohort', 'summoned', 'undead', 'construct']),
      count: z.number().int().min(1).optional(),
      stats: z.record(z.any()).optional(),
      loyalty: z.number().int().min(0).max(100).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const follower = await inventoryQueries.createFollower({
        campaignId: ctx.campaignId,
        ownerId: input.entityId,
        name: input.name,
        type: input.type,
        count: input.count,
        stats: input.stats,
        loyalty: input.loyalty,
      })

      return follower
    }),

  /**
   * Remove a follower
   */
  removeFollower: campaignProcedure
    .input(z.object({
      followerId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const follower = await inventoryQueries.getFollower(input.followerId)
      if (!follower) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Follower not found'
        })
      }

      if (follower.inventoryContainerId) {
        await inventoryQueries.deleteContainer(follower.inventoryContainerId)
      }

      await inventoryQueries.deleteFollower(input.followerId)

      return { success: true }
    }),

  /**
   * Get followers for an entity
   */
  getFollowers: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid()
    }))
    .query(async ({ input }) => {
      return inventoryQueries.getFollowersForOwner(input.entityId)
    }),

  // ==========================================
  // ENCUMBRANCE
  // ==========================================

  /**
   * Calculate encumbrance status
   */
  getEncumbrance: campaignProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      entityType: EntityTypeSchema.default('character'),
      strength: z.number().int(),
      sizeModifier: z.number().default(1),
      encumbranceRule: EncumbranceRuleSchema.default('variant')
    }))
    .query(async ({ input }) => {
      const result = await inventoryEngine.calculateEncumbrance(
        input.entityId,
        input.strength,
        input.encumbranceRule,
        input.sizeModifier,
        input.entityType
      )

      return result
    }),

  // ==========================================
  // NPC INVENTORY GENERATION
  // ==========================================

  /**
   * Generate inventory for an NPC based on role
   */
  generateNPCInventory: gmProcedure
    .input(z.object({
      npcId: z.string().uuid(),
      role: z.string(),
      occupation: z.string().optional(),
      level: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryEngine.generateNPCInventory(
        input.npcId,
        ctx.campaignId,
        input.role,
        input.occupation,
        input.level
      )

      return system
    }),

  /**
   * Seed default NPC loadouts
   */
  seedLoadouts: gmProcedure
    .mutation(async ({ ctx }) => {
      await inventoryEngine.seedDefaultLoadouts(ctx.campaignId)
      return { success: true }
    }),

  // ==========================================
  // MERCHANT OPERATIONS
  // ==========================================

  /**
   * Get merchant stock
   */
  getMerchantStock: campaignProcedure
    .input(z.object({
      npcId: z.string().uuid()
    }))
    .query(async ({ input }) => {
      const system = await inventoryQueries.getNPCInventorySystem(input.npcId)
      if (!system || !system.isMerchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found'
        })
      }

      return inventoryQueries.getMerchantStock(system.id)
    }),

  /**
   * Add item to merchant stock
   */
  addMerchantStock: gmProcedure
    .input(z.object({
      npcId: z.string().uuid(),
      itemId: z.string().uuid().optional(),
      itemTemplateId: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
      buyPrice: z.number().optional(),
      sellPrice: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreateNPCInventory(input.npcId, ctx.campaignId, {
        isMerchant: true
      })

      const stock = await inventoryQueries.addMerchantStock({
        inventorySystemId: system.id,
        itemId: input.itemId,
        itemTemplateId: input.itemTemplateId,
        quantity: input.quantity,
        buyPrice: input.buyPrice,
        sellPrice: input.sellPrice,
      })

      return stock
    }),

  /**
   * Purchase item from merchant
   */
  purchaseFromMerchant: campaignProcedure
    .input(z.object({
      merchantNpcId: z.string().uuid(),
      stockId: z.string().uuid(),
      buyerEntityId: z.string().uuid(),
      buyerEntityType: EntityTypeSchema.default('character'),
      quantity: z.number().int().min(1).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get merchant stock
      const merchantSystem = await inventoryQueries.getNPCInventorySystem(input.merchantNpcId)
      if (!merchantSystem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found'
        })
      }

      const stockItem = (await inventoryQueries.getMerchantStock(merchantSystem.id))
        .find(s => s.id === input.stockId)

      if (!stockItem || stockItem.quantity < input.quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Item not available in requested quantity'
        })
      }

      // Calculate cost
      const unitPrice = stockItem.sellPrice ?? 0
      const totalCost = unitPrice * input.quantity

      // Get buyer's inventory
      const buyerSystem = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.buyerEntityId,
        input.buyerEntityType,
        ctx.campaignId
      )

      // Check buyer has enough gold
      const buyerWealth = currencyToGP(buyerSystem.wallet.standard)
      if (buyerWealth < totalCost) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient funds'
        })
      }

      // Deduct from buyer
      await inventoryQueries.updateWallet(buyerSystem.id, { gold: totalCost }, 'remove')

      // Add to merchant
      await inventoryQueries.updateWallet(merchantSystem.id, { gold: totalCost }, 'add')

      // Update stock quantity
      await inventoryQueries.updateMerchantStock(input.stockId, {
        quantity: stockItem.quantity - input.quantity
      })

      // Add item to buyer's inventory
      const item = stockItem.itemId ? await inventoryQueries.getItem(stockItem.itemId) : null

      await inventoryQueries.createInventoryItem({
        ownerId: input.buyerEntityId,
        ownerType: input.buyerEntityType,
        itemId: stockItem.itemId ?? undefined,
        itemTemplateId: stockItem.itemTemplateId ?? undefined,
        name: item?.name ?? 'Purchased Item',
        quantity: input.quantity,
        containerId: buyerSystem.carriedContainerId ?? undefined,
      })

      return { success: true, totalCost }
    }),

  // ==========================================
  // HOMEBREW ITEMS
  // ==========================================

  /**
   * Generate a homebrew item using AI
   */
  generateHomebrew: gmProcedure
    .input(HomebrewRequestSchema)
    .mutation(async ({ input }) => {
      const aiClient = {
        generate: async (_systemPrompt: string, _userPrompt: string) => {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'AI generation not yet connected'
          })
        }
      }

      try {
        const result = await generateHomebrewItem(input, aiClient)
        return result
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate item: ${err}`
        })
      }
    }),

  /**
   * Validate a homebrew item
   */
  validateHomebrew: campaignProcedure
    .input(z.object({
      item: ItemSchema
    }))
    .query(async ({ ctx: _ctx, input }) => {
      const validation = validateItem(input.item)
      const balanceScore = calculateBalanceScore(input.item)

      return {
        valid: validation.valid,
        errors: validation.errors,
        balanceScore,
        isBalanced: balanceScore >= 40 && balanceScore <= 60
      }
    }),

  // ==========================================
  // PARTY SHARED INVENTORY
  // ==========================================

  /**
   * Get party shared inventory
   */
  getPartyInventory: campaignProcedure
    .input(z.object({
      partyId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreatePartyInventory(
        input.partyId,
        ctx.campaignId
      )

      const containers = await inventoryQueries.getContainersForInventory(system.id)
      const sharedContainer = containers.find(c => c.type === 'shared_party')

      const items = sharedContainer
        ? await inventoryQueries.getInventoryItemsByContainer(sharedContainer.id)
        : []

      return {
        id: system.id,
        partyId: input.partyId,
        currency: system.wallet.standard,
        items,
        totalValue: items.reduce((sum, item) => {
          const value = item.properties?.baseValue ?? 0
          return sum + (value * item.quantity)
        }, 0),
      }
    }),

  /**
   * Add currency to party inventory
   */
  addPartyGold: campaignProcedure
    .input(z.object({
      partyId: z.string().uuid(),
      currency: StandardCurrencySchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const system = await inventoryQueries.getOrCreatePartyInventory(
        input.partyId,
        ctx.campaignId
      )

      await inventoryQueries.updateWallet(system.id, input.currency, 'add')

      return { success: true }
    }),

  /**
   * Transfer item to party inventory
   */
  transferToParty: campaignProcedure
    .input(z.object({
      partyId: z.string().uuid(),
      inventoryItemId: z.string().uuid(),
      quantity: z.number().int().min(1).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await inventoryQueries.getInventoryItem(input.inventoryItemId)
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found'
        })
      }

      const partySystem = await inventoryQueries.getOrCreatePartyInventory(
        input.partyId,
        ctx.campaignId
      )

      const containers = await inventoryQueries.getContainersForInventory(partySystem.id)
      const sharedContainer = containers.find(c => c.type === 'shared_party')

      if (!sharedContainer) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Party container not found'
        })
      }

      const quantity = input.quantity ?? item.quantity

      if (quantity < item.quantity) {
        await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
          quantity: item.quantity - quantity
        })

        await inventoryQueries.createInventoryItem({
          ownerId: input.partyId,
          ownerType: 'party',
          itemTemplateId: item.itemTemplateId ?? undefined,
          itemId: item.itemId ?? undefined,
          name: item.name,
          description: item.description ?? undefined,
          quantity,
          containerId: sharedContainer.id,
          properties: item.properties,
        })
      } else {
        await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
          containerId: sharedContainer.id,
        })
      }

      return { success: true }
    }),

  /**
   * Transfer item from party to entity
   */
  transferFromParty: campaignProcedure
    .input(z.object({
      partyId: z.string().uuid(),
      inventoryItemId: z.string().uuid(),
      toEntityId: z.string().uuid(),
      toEntityType: EntityTypeSchema.default('character'),
      quantity: z.number().int().min(1).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await inventoryQueries.getInventoryItem(input.inventoryItemId)
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found'
        })
      }

      const entitySystem = await inventoryQueries.getOrCreateEntityInventorySystem(
        input.toEntityId,
        input.toEntityType,
        ctx.campaignId
      )

      const targetContainerId = entitySystem.carriedContainerId
      if (!targetContainerId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Entity container not found'
        })
      }

      const quantity = input.quantity ?? item.quantity

      if (quantity < item.quantity) {
        await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
          quantity: item.quantity - quantity
        })

        await inventoryQueries.createInventoryItem({
          ownerId: input.toEntityId,
          ownerType: input.toEntityType,
          itemTemplateId: item.itemTemplateId ?? undefined,
          itemId: item.itemId ?? undefined,
          name: item.name,
          description: item.description ?? undefined,
          quantity,
          containerId: targetContainerId,
          properties: item.properties,
        })
      } else {
        await inventoryQueries.updateInventoryItem(input.inventoryItemId, {
          containerId: targetContainerId,
        })
      }

      return { success: true }
    }),
})
