/**
 * INVENTORY ENGINE
 * =================
 *
 * Comprehensive inventory management system for D&D 5e campaigns.
 *
 * Features:
 * - Slot-based equipment (worn items)
 * - Container-based storage (backpack, bags, mount saddlebags)
 * - Mount and follower inventory expansion
 * - Optional encumbrance/carrying capacity
 * - Standard and fantasy currencies
 * - Hidden commodity trading for advanced campaigns
 * - Magic item rarity and attunement
 * - AI-powered homebrew item generation
 */

// Core schemas and values
export {
  // Item types
  ItemSchema,
  ItemCategorySchema,
  ItemRaritySchema,
  RARITY_DATA,

  // Weapon/Armor
  WeaponDataSchema,
  WeaponPropertySchema,
  DamageTypeSchema,
  ArmorDataSchema,
  ArmorTypeSchema,

  // Containers
  ContainerDataSchema,
  InventoryContainerSchema,
  InventoryContainerTypeSchema,

  // Equipment slots
  EquipmentSlotSchema,
  SLOT_COMPATIBILITY,

  // Currency
  StandardCurrencySchema,
  FantasyCurrencySchema,
  CommoditySchema,
  WalletSchema,
  CURRENCY_TO_GP,
  currencyToGP,
  gpToCurrency,

  // Attunement
  AttunementRequirementSchema,

  // Carrying capacity
  EncumbranceRuleSchema,
  calculateCarryingCapacity,
  getEncumbrancePenalties,

  // Mounts and followers
  MountDataSchema,
  FollowerDataSchema,

  // Complete inventory system
  InventorySystemSchema,

  // Consumables and charges
  ConsumableDataSchema,
  ChargesDataSchema,

  // Templates
  ItemTemplateSchema,
} from './schema'

// Type exports
export type {
  Item,
  ItemCategory,
  ItemRarity,
  WeaponData,
  WeaponProperty,
  DamageType,
  ArmorData,
  ArmorType,
  ContainerData,
  InventoryContainer,
  InventoryContainerType,
  EquipmentSlot,
  StandardCurrency,
  FantasyCurrency,
  Commodity,
  Wallet,
  AttunementRequirement,
  EncumbranceRule,
  MountData,
  FollowerData,
  InventorySystem,
  ConsumableData,
  ChargesData,
  ItemTemplate,
} from './schema'

// Homebrew item builder - values
export {
  HomebrewRequestSchema,
  HomebrewResponseSchema,
  HOMEBREW_SYSTEM_PROMPT,
  buildUserPrompt,
  validateItem,
  calculateBalanceScore,
  REFERENCE_ITEMS,
  generateHomebrewItem,
  generatePlusWeapon,
  generatePlusArmor,
} from './homebrew-builder'

// Homebrew item builder - types
export type {
  HomebrewRequest,
  HomebrewResponse,
} from './homebrew-builder'
